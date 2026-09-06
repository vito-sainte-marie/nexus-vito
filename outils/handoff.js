#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RACINE = path.resolve(__dirname, '..');
const HANDOFF = process.env.NEXUS_HANDOFF_DIR ? path.resolve(process.env.NEXUS_HANDOFF_DIR) : path.join(RACINE, 'docs', 'handoff');
const LOTS = path.join(HANDOFF, 'lots');
const ETAT = path.join(HANDOFF, 'STATE.json');
const MIROIR_DEMANDE = path.join(HANDOFF, 'CURRENT.md');
const MIROIR_DECISION = path.join(HANDOFF, 'DECISION.md');
const PROTOCOLE = 'nexus-handoff/2';
const BRANCHE_AUTORISEE = 'config-par-environnement';
const REFS_PROTEGEES = ['main', 'production'];
const DECISIONS_CANONIQUES = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'BLOCKED', 'NEEDS_EVIDENCE'];
const DECISIONS_LEGACY = ['APPROVED_CLOSED'];
const STATUTS_DEMANDE = ['AWAITING_DECISION'];
const STATUTS_LOT_ACTIFS = ['ATTENTE_DECISION', 'ATTENTE_CONSOMMATION_DECISION'];
const STATUTS_LOT = [...STATUTS_LOT_ACTIFS, 'DECISION_CONSOMMEE', 'CLOS'];
const TOKEN_MODES = ['LEAN', 'STANDARD', 'DEEP'];
const CLASSES_PREUVE = ['VERIFIED', 'DECLARED', 'HUMAN', 'NOT_APPLICABLE'];
const LOT_ID_VALIDE = /^[A-Z0-9][A-Z0-9-]{2,63}$/;
const erreurs = [];
const avertissements = [];
const bloquant = (m, code, fichier) => erreurs.push({ message: m, code: code || 'AUTRE', fichier: fichier || null });
const avertir = (m) => avertissements.push(m);
const CODES_NON_DEROGEABLES = ['BRANCHE_PROTEGEE', 'BRANCHE_INATTENDUE', 'REFS_PROTEGEES', 'REFS_ILLISIBLES'];
function git(...args) { return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' }).trim(); }
function lireEnveloppe(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8'); const lignes = brut.split('\n');
  if (lignes[0].trim() !== '---') return { absente: true, corps: brut };
  const fin = lignes.indexOf('---', 1); if (fin === -1) return { erreur: 'enveloppe non refermée' };
  const env = {}; let listeCourante = null; let objetCourant = null;
  for (let i = 1; i < fin; i++) {
    const ligne = lignes[i]; if (!ligne.trim() || /^\s*#/.test(ligne)) continue;
    let m = ligne.match(/^([a-z_]+):\s*(.*)$/);
    if (m) { listeCourante = null; objetCourant = null; if (m[2] === '') { listeCourante = m[1]; env[m[1]] = []; } else env[m[1]] = m[2].trim(); continue; }
    m = ligne.match(/^ {2}- ([a-z_]+):\s*(.+)$/); if (m && listeCourante) { objetCourant = { [m[1]]: m[2].trim() }; env[listeCourante].push(objetCourant); continue; }
    m = ligne.match(/^ {4}([a-z_]+):\s*(.+)$/); if (m && objetCourant) { objetCourant[m[1]] = m[2].trim(); continue; }
    return { erreur: `ligne d'enveloppe non reconnue (${i + 1}) : ${JSON.stringify(ligne)}` };
  }
  return { env, corps: lignes.slice(fin + 1).join('\n') };
}
function normaliserDecision(valeur) { if (valeur === 'APPROVED_CLOSED') return { decision: 'APPROVED', closes: true, legacy: true }; return { decision: valeur, legacy: false }; }
function lots() { if (!fs.existsSync(LOTS)) return []; return fs.readdirSync(LOTS).filter(d => fs.statSync(path.join(LOTS, d)).isDirectory()).sort(); }
function echanges(lot, genre) {
  const dir = path.join(LOTS, lot); if (!fs.existsSync(dir)) return [];
  const prefixe = genre === 'request' ? 'request-' : 'decision-';
  return fs.readdirSync(dir).filter(f => f.startsWith(prefixe) && f.endsWith('.md')).map(f => ({ fichier: f, seq: parseInt(f.slice(prefixe.length, -3), 10) })).filter(e => Number.isInteger(e.seq) && e.seq > 0).sort((a, b) => a.seq - b.seq);
}
const dernier = liste => liste.length ? liste[liste.length - 1] : null;
function validerCommuns(lot, e, env, genre) {
  const ou = `${lot}/${e.fichier}`;
  if (env.protocol !== PROTOCOLE) bloquant(`${ou} : protocol doit valoir ${PROTOCOLE}, trouvé ${JSON.stringify(env.protocol)}`);
  if (env.kind !== genre) bloquant(`${ou} : kind doit valoir ${genre}, trouvé ${JSON.stringify(env.kind)}`);
  if (env.lot_id !== lot) bloquant(`${ou} : lot_id ${JSON.stringify(env.lot_id)} ne correspond pas au répertoire ${lot}`);
  if (String(env.seq) !== String(e.seq)) bloquant(`${ou} : seq ${JSON.stringify(env.seq)} ne correspond pas au nom de fichier`);
  if (!env.author) bloquant(`${ou} : author manquant`);
  if (REFS_PROTEGEES.includes(env.branch)) bloquant(`${ou} : branch ${env.branch} est une ref protégée — refus`, 'BRANCHE_PROTEGEE', e.fichier);
  else if (env.branch === undefined) bloquant(`${ou} : branch manquante — l'enveloppe doit déclarer ${BRANCHE_AUTORISEE}`, 'BRANCHE_ABSENTE', e.fichier);
  else if (env.branch !== BRANCHE_AUTORISEE) bloquant(`${ou} : branch doit valoir ${BRANCHE_AUTORISEE}, trouvé ${JSON.stringify(env.branch)}`, 'BRANCHE_INATTENDUE', e.fichier);
}
function validerPreuves(ou, preuves) {
  if (!preuves) return; if (!Array.isArray(preuves)) { bloquant(`${ou} : preuves doit être une liste`); return; }
  for (const p of preuves) { if (!p.id) bloquant(`${ou} : une preuve sans id`); if (!CLASSES_PREUVE.includes(p.classe)) bloquant(`${ou} : preuve ${p.id} — classe ${JSON.stringify(p.classe)} hors vocabulaire (${CLASSES_PREUVE.join('|')})`); }
}
// L'empreinte est une preuve historique. Un avancement fast-forward est légitime ;
// un SHA inconnu ou une divergence/réécriture de l'histoire échoue fermé.
function verifierRefsProtegees(ou, valeur) {
  const brut = String(valeur || '').trim();
  const m = brut.match(/^main=([0-9a-f]{7,40})\s+production=([0-9a-f]{7,40})$/i);
  if (!m) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — format invalide`, 'REFS_PROTEGEES'); return; }
  const attendues = { main: m[1], production: m[2] };
  for (const ref of REFS_PROTEGEES) {
    let historique, courant;
    try { historique = git('rev-parse', '--verify', `${attendues[ref]}^{commit}`); courant = git('rev-parse', '--verify', `origin/${ref}^{commit}`); }
    catch (err) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — impossible de résoudre ${ref}=${attendues[ref]} ou origin/${ref}`, 'REFS_ILLISIBLES'); continue; }
    try { git('merge-base', '--is-ancestor', historique, courant); }
    catch (err) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — ${ref} historique ${attendues[ref]} n'est pas ancêtre de la ref actuelle ${courant.slice(0, 7)}`, 'REFS_PROTEGEES'); }
  }
}
function validerRegistre() {
  for (const lot of lots()) {
    if (!LOT_ID_VALIDE.test(lot)) { bloquant(`lots/${lot} : LOT_ID malformé`); continue; }
    const demandes = echanges(lot, 'request'), decisions = echanges(lot, 'decision'); if (!demandes.length) bloquant(`lots/${lot} : aucun request-N.md`);
    demandes.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des demandes non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', e.fichier); });
    decisions.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des décisions non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', e.fichier); });
    for (const e of demandes) {
      const ou = `${lot}/${e.fichier}`, r = lireEnveloppe(path.join(LOTS, lot, e.fichier)); if (r.erreur) { bloquant(`${ou} : ${r.erreur}`); continue; } if (r.absente) { bloquant(`${ou} : enveloppe absente`); continue; }
      const env = r.env; validerCommuns(lot, e, env, 'request'); if (!STATUTS_DEMANDE.includes(env.status)) bloquant(`${ou} : status ${JSON.stringify(env.status)} hors vocabulaire (${STATUTS_DEMANDE.join('|')})`); if (!TOKEN_MODES.includes(env.token_mode)) bloquant(`${ou} : token_mode ${JSON.stringify(env.token_mode)} hors vocabulaire (${TOKEN_MODES.join('|')})`); validerPreuves(ou, env.preuves); const refs = (env.preuves || []).find(p => p.id === 'refs-protegees'); if (refs) verifierRefsProtegees(ou, refs.valeur || '');
    }
    const reponses = [];
    for (const e of decisions) {
      const ou = `${lot}/${e.fichier}`, r = lireEnveloppe(path.join(LOTS, lot, e.fichier)); if (r.erreur) { bloquant(`${ou} : ${r.erreur}`); continue; } if (r.absente) { bloquant(`${ou} : enveloppe absente`); continue; }
      const env = r.env; validerCommuns(lot, e, env, 'decision'); if (DECISIONS_LEGACY.includes(env.decision)) bloquant(`${ou} : ${env.decision} est une valeur legacy, lisible dans l'historique v1 mais interdite dans le registre v2 — employer decision + closes.`); else if (!DECISIONS_CANONIQUES.includes(env.decision)) bloquant(`${ou} : decision ${JSON.stringify(env.decision)} hors vocabulaire (${DECISIONS_CANONIQUES.join('|')})`, 'DECISION_HORS_VOCABULAIRE', e.fichier); if (!['true', 'false'].includes(String(env.closes))) bloquant(`${ou} : closes doit valoir true ou false`);
      if (!env.in_reply_to) bloquant(`${ou} : in_reply_to manquant`, 'IN_REPLY_TO_MANQUANT', e.fichier); else { const vise = path.basename(String(env.in_reply_to).trim()), cible = demandes.find(d => d.fichier === vise); if (!cible) bloquant(`${ou} : in_reply_to ${JSON.stringify(env.in_reply_to)} ne désigne aucune demande de ce lot`, 'IN_REPLY_TO_INCONNU', e.fichier); else { reponses.push({ decision: e, viseSeq: cible.seq }); if (cible.seq < e.seq) bloquant(`${ou} : in_reply_to désigne ${vise} (rang ${cible.seq}), antérieur au rang de la décision (${e.seq})`, 'IN_REPLY_TO_ANTERIEUR', e.fichier); } }
    }
    for (let i = 1; i < reponses.length; i++) if (reponses[i].viseSeq <= reponses[i - 1].viseSeq) bloquant(`lots/${lot} : ${reponses[i].decision.fichier} répond à une demande déjà arbitrée par ${reponses[i - 1].decision.fichier}`, 'DEMANDE_DEJA_ARBITREE', reponses[i].decision.fichier);
    if (decisions.length > demandes.length) bloquant(`lots/${lot} : plus de décisions que de demandes`);
  }
}
function validerEtat() {
  if (!fs.existsSync(ETAT)) { bloquant('docs/handoff/STATE.json absent'); return null; } let etat; try { etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); } catch (e) { bloquant(`STATE.json illisible : ${e.message}`); return null; }
  if (etat.protocol !== PROTOCOLE) bloquant(`STATE.json : protocol doit valoir ${PROTOCOLE}`); if (!etat.lots || typeof etat.lots !== 'object') { bloquant('STATE.json : lots manquant'); return etat; }
  const actifs = Object.entries(etat.lots).filter(([, v]) => STATUTS_LOT_ACTIFS.includes(v.statut)).map(([k]) => k); if (actifs.length > 1) bloquant(`STATE.json : ${actifs.length} lots en attente (${actifs.join(', ')}) — un seul lot actif dans cette version`, 'PLUSIEURS_LOTS_ACTIFS'); if (etat.lot_actif && !etat.lots[etat.lot_actif]) bloquant(`STATE.json : lot_actif ${etat.lot_actif} absent de lots`);
  for (const [lot, v] of Object.entries(etat.lots)) { const demandes = echanges(lot, 'request'), decisions = echanges(lot, 'decision'); if (v.derniere_demande) { if (!demandes.find(d => d.fichier === v.derniere_demande)) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} absente du registre`); else if (v.derniere_demande !== dernier(demandes).fichier) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} n'est pas la plus récente (${dernier(demandes).fichier})`); } if (v.derniere_decision && v.source_decision === 'registre' && !decisions.find(d => d.fichier === v.derniere_decision)) bloquant(`STATE.json : ${lot}.derniere_decision ${v.derniere_decision} absente du registre`); if (v.consomme_le && !v.commit_decision) bloquant(`STATE.json : ${lot} marqué consommé sans commit_decision`); if (!STATUTS_LOT.includes(v.statut)) bloquant(`STATE.json : ${lot}.statut ${JSON.stringify(v.statut)} hors vocabulaire`); }
  if (etat.derogations !== undefined) { if (!Array.isArray(etat.derogations)) bloquant('STATE.json : derogations doit être une liste'); else for (const d of etat.derogations) { for (const champ of ['fichier', 'regle', 'motif', 'autorise_par', 'le']) if (!d[champ]) bloquant(`STATE.json : dérogation incomplète — ${champ} manquant`); if (CODES_NON_DEROGEABLES.includes(d.regle)) bloquant(`STATE.json : ${d.regle} est un invariant de sécurité — aucune dérogation n'est recevable`); } }
  return etat;
}
function enTeteMiroir(source) { return `<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/${source}\n     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->\n`; }
function regenererMiroirs() { const etat = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} }, lot = etat.lot_actif; if (!lot) return; const d = dernier(echanges(lot, 'request')); if (d) { const src = path.join('lots', lot, d.fichier); fs.writeFileSync(MIROIR_DEMANDE, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, d.fichier), 'utf8')); } const dec = dernier(echanges(lot, 'decision')); if (dec) { const src = path.join('lots', lot, dec.fichier); fs.writeFileSync(MIROIR_DECISION, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, dec.fichier), 'utf8')); } }
function verifier(ignorer) {
  erreurs.length = 0; avertissements.length = 0; validerRegistre(); const etat = validerEtat();
  if (etat && etat.lot_actif) { const d = dernier(echanges(etat.lot_actif, 'request')); if (d) { const r = lireEnveloppe(path.join(LOTS, etat.lot_actif, d.fichier)), p = ((r.env && r.env.preuves) || []).find(x => x.id === 'suite'), sortie = process.env.NEXUS_SORTIE_SUITE; if (p && sortie && fs.existsSync(sortie)) { const m = fs.readFileSync(sortie, 'utf8').match(/(\d+)\/(\d+) tests passent/); if (m && p.valeur.trim() !== `${m[1]}/${m[2]}`) avertir(`suite déclarée ${p.valeur.trim()}, mesurée ${m[1]}/${m[2]} — lot d'observation : avertissement, pas blocage.`); } } }
  const derogations = etat && Array.isArray(etat.derogations) ? etat.derogations : [], restantes = [];
  for (const e of erreurs) { const d = derogations.find(x => x.fichier === e.fichier && x.regle === e.code); if (d && CODES_NON_DEROGEABLES.includes(e.code)) restantes.push({ ...e, message: `${e.message}\n         (une dérogation existe mais ${e.code} est un invariant de sécurité : elle ne s'applique pas)` }); else if (d) avertir(`DÉROGATION ${d.regle} sur ${d.fichier} — ${e.message}\n         motif : ${d.motif}\n         autorisée par ${d.autorise_par}, le ${d.le}`); else if (ignorer && ignorer.includes(e.code)) avertir(`${e.code} toléré le temps de l'opération en cours — ${e.message}`); else restantes.push(e); }
  for (const a of avertissements) console.log(`AVERTISSEMENT — ${a}`); if (restantes.length) { for (const e of restantes) console.error(`ÉCHEC — ${e.message}`); console.error(`\n${restantes.length} violation(s) du protocole Handoff v2.`); return 1; } console.log(`Handoff v2 : registre, enveloppes et STATE.json conformes (${lots().length} lot(s), ${avertissements.length} avertissement(s), ${derogations.length} dérogation(s)).`); return 0;
}
function consommer(lot) {
  if (verifier(['PLUSIEURS_LOTS_ACTIFS']) !== 0) { console.error('\nREFUS — le registre ne valide pas ; aucune décision ne peut être consommée dans cet état.'); process.exit(1); }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')), v = etat.lots[lot]; if (!v) { console.error(`Lot ${lot} inconnu.`); process.exit(1); } const dec = dernier(echanges(lot, 'decision'));
  if (dec) { const demandes = echanges(lot, 'request'), r = lireEnveloppe(path.join(LOTS, lot, dec.fichier)), vise = r.env && r.env.in_reply_to ? path.basename(String(r.env.in_reply_to).trim()) : null, active = dernier(demandes); if (active && vise !== active.fichier) { console.error(`REFUS — ${dec.fichier} répond à ${vise}, mais la demande active est ${active.fichier}.`); console.error('Une décision périmée ne se consomme pas : une décision sur la demande active doit être rendue.'); process.exit(1); } }
  const source = dec ? 'registre' : 'legacy', cible = path.relative(RACINE, dec ? path.join(LOTS, lot, dec.fichier) : MIROIR_DECISION); let commit; try { commit = git('log', '-1', '--format=%H', '--', cible); } catch (e) { commit = ''; } if (!commit) { console.error(`Aucun commit trouvé pour ${cible} — refus de marquer une consommation invérifiable.`); process.exit(1); }
  if (v.consomme_le && v.commit_decision === commit) { console.error(`REFUS — la décision ${commit.slice(0, 7)} du lot ${lot} est déjà marquée consommée le ${v.consomme_le}.`); console.error('Une nouvelle décision doit être rendue avant de poursuivre.'); process.exit(1); }
  v.statut = 'DECISION_CONSOMMEE'; v.derniere_decision = dec ? dec.fichier : null; v.source_decision = source; v.commit_decision = commit; v.consomme_le = new Date().toISOString(); fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n'); console.log(`Décision ${commit.slice(0, 7)} (${source}) marquée consommée pour ${lot}.`);
}
function nouvelleDemande(lot, corpsFichier, options) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); } if (!fs.existsSync(corpsFichier)) { console.error(`Corps introuvable : ${corpsFichier}`); process.exit(1); } const mode = options.tokenMode || 'STANDARD'; if (!TOKEN_MODES.includes(mode)) { console.error(`token_mode inconnu : ${mode} (${TOKEN_MODES.join('|')})`); process.exit(1); }
  const etatAvant = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} }; for (const [autre, v] of Object.entries(etatAvant.lots || {})) { if (autre === lot || !STATUTS_LOT_ACTIFS.includes(v.statut)) continue; const d = dernier(echanges(autre, 'decision')); if (d) { console.error(`REFUS — le lot ${autre} a une décision (${d.fichier}) qui n'est pas consommée.`); console.error('Consommez-la avant d\'ouvrir un nouveau lot : le protocole ne tient qu\'un lot actif.'); process.exit(1); } }
  const dir = path.join(LOTS, lot); fs.mkdirSync(dir, { recursive: true }); const seq = (dernier(echanges(lot, 'request')) || { seq: 0 }).seq + 1, fichier = `request-${seq}.md`, cible = path.join(dir, fichier); if (fs.existsSync(cible)) { console.error(`${fichier} existe déjà — le registre est append-only.`); process.exit(1); }
  const refs = REFS_PROTEGEES.map(r => `${r}=${git('rev-parse', '--short', `origin/${r}`)}`).join(' '), preuves = [{ id: 'refs-protegees', classe: 'VERIFIED', valeur: refs }].concat(options.preuves); let env = '---\n'; env += `protocol: ${PROTOCOLE}\nkind: request\nlot_id: ${lot}\nseq: ${seq}\n`; env += `author: Claude\nbranch: ${BRANCHE_AUTORISEE}\nstatus: AWAITING_DECISION\ntoken_mode: ${mode}\n`; env += 'preuves:\n'; for (const p of preuves) env += `  - id: ${p.id}\n    classe: ${p.classe}\n    valeur: ${p.valeur}\n`; env += '---\n'; fs.writeFileSync(cible, env + fs.readFileSync(corpsFichier, 'utf8'));
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); etat.lots[lot] = etat.lots[lot] || {}; Object.assign(etat.lots[lot], { statut: 'ATTENTE_DECISION', derniere_demande: fichier }); etat.lot_actif = lot; fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n'); regenererMiroirs(); console.log(`${lot}/${fichier} créé (token_mode ${mode}, ${preuves.length} preuve(s)), miroirs v1 régénérés.`);
}
function veiller(lot, intervalle) { const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')), v = etat.lots[lot] || {}, avant = dernier(echanges(lot, 'decision')); try { git('fetch', '-q', 'origin', BRANCHE_AUTORISEE); } catch (e) {} const apres = dernier(echanges(lot, 'decision')); if (apres && (!avant || apres.seq > avant.seq)) { console.log(`event detected — ${lot}/${apres.fichier}`); return 0; } if (v.statut === 'ATTENTE_DECISION') { console.log(`session unavailable — aucune décision pour ${lot} ; relance humaine (secours v1) requise après extinction.`); return 0; } console.log(`session resumed — ${lot} au statut ${v.statut}`); return 0; }
const [, , commande, arg1, arg2] = process.argv;
switch (commande) {
  case undefined: case 'verifier': process.exit(verifier()); break;
  case 'miroirs': regenererMiroirs(); console.log('Miroirs v1 régénérés.'); break;
  case 'consommer': consommer(arg1); break;
  case 'demande': { const args = process.argv.slice(5), preuves = []; let tokenMode = null; for (let i = 0; i < args.length; i++) { if (args[i] === '--preuve') { const m = args[++i].match(/^([a-z0-9-]+):([A-Z_]+):([\s\S]+)$/); if (!m) { console.error(`--preuve mal formée : ${args[i]}`); process.exit(1); } preuves.push({ id: m[1], classe: m[2], valeur: m[3] }); } else if (args[i] === '--token-mode') tokenMode = args[++i]; else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); } } nouvelleDemande(arg1, arg2, { preuves, tokenMode }); break; }
  case 'veiller': process.exit(veiller(arg1, Number(arg2) || 60)); break;
  default: console.error('Usage : handoff.js [verifier|miroirs|consommer <LOT_ID>|demande <LOT_ID> <corps.md> [--token-mode M] [--preuve id:CLASSE:valeur]…|veiller <LOT_ID>]'); process.exit(1);
}
