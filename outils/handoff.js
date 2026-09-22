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
const BRANCHE_HISTORIQUE = 'config-par-environnement';
const REFS_PROTEGEES = ['main', 'production'];
const FORME_RAIL = /^handoff-[A-Za-z0-9._/-]+$/;
const VARIABLES_RAIL = ['NEXUS_CLAUDE_BASE_BRANCH', 'NEXUS_BASE_BRANCH'];
// LE RAIL D'UN LOT EST UN FAIT DU REGISTRE — PAS DE L'ENVIRONNEMENT.
//
// 21/09/2026. Le rail actif se lisait jusqu'ici ainsi :
//
//   const BRANCHE_ACTIVE = process.env.NEXUS_CLAUDE_BASE_BRANCH
//     || process.env.NEXUS_BASE_BRANCH || BRANCHE_HISTORIQUE;
//
// C'était une anomalie d'infrastructure, pas une commodité. Les enveloppes
// du registre déclarent `branch:` ; le validateur comparait cette
// déclaration écrite à une valeur ambiante. Les MÊMES octets recevaient donc
// deux verdicts opposés selon l'endroit où le validateur tournait : vert sur
// le rail, et vingt violations BRANCHE_INATTENDUE partout ailleurs — sur
// `main`, sur une branche de PR, dans un run `claude/issue-*`, dans un
// worktree propre. Le repli sur `config-par-environnement` était silencieux,
// et le message imprimait deux fois la même valeur (« config-par-environnement
// ou config-par-environnement »), seul indice que personne n'avait fourni de
// rail. BRANCHE_INATTENDUE étant un invariant non dérogeable, rien ne pouvait
// absorber cet échec : le registre devenait invalide, et `consommer` — qui
// valide d'abord — refusait tout.
//
// Le colmatage correspondant (étape « Résoudre le rail Handoff de ce run » de
// tests.yml) devinait le rail depuis la ref du run : il ne pouvait avoir
// raison que quand le run tournait déjà SUR le rail, c'est-à-dire exactement
// dans le cas où l'on n'avait besoin de personne.
//
// La réparation est à la base : le rail de chaque lot est déclaré dans
// STATE.json.lots[LOT].rail, à côté du reste de sa vérité (statut, dernière
// demande, décision consommée). Le validateur le lit là et nulle part
// ailleurs. Conséquences :
//   — le verdict ne dépend plus de l'endroit où l'outil tourne ;
//   — un lot qui ne déclare rien vaut BRANCHE_HISTORIQUE, donc tout le
//     registre antérieur reste vert sans qu'un seul fichier soit réécrit ;
//   — changer de rail devient un acte inscrit (`declarer-rail`) au lieu
//     d'être absorbé par l'environnement ;
//   — un rail interdit (`main`, `production`) ou malformé est refusé par un
//     code non dérogeable, comme le faisait l'ancien garde de démarrage —
//     mais en violation nommée, et non plus par un `process.exit` au
//     chargement du module, qui tuait aussi ses simples lecteurs
//     (`outils/reveil-handoff.js` requiert ce fichier).
//
// Les variables d'environnement historiques ne sont plus une source de
// vérité. Elles restent lues pour une seule raison : si elles contredisent le
// registre, on le dit à voix haute. Un avertissement, jamais un échec —
// faire échouer sur leur contenu rendrait de nouveau le verdict dépendant de
// l'environnement, c'est-à-dire exactement le défaut réparé ici.
function railSecurise(rail) {
  return typeof rail === 'string' && rail !== '' && !REFS_PROTEGEES.includes(rail) &&
    (rail === BRANCHE_HISTORIQUE || FORME_RAIL.test(rail));
}
function railDuLot(etat, lot) {
  const v = etat && etat.lots && etat.lots[lot];
  return v && v.rail !== undefined ? v.rail : BRANCHE_HISTORIQUE;
}
function brancheRailValide(branch, rail) {
  return branch === BRANCHE_HISTORIQUE || branch === rail;
}
// Un message qui se répète ne dit rien. Quand un lot ne déclare pas de rail,
// le rail résolu EST la branche historique, et énumérer « X ou X » était le
// seul indice, en Production, que personne n'avait fourni de rail — indice
// illisible. La liste se dédoublonne donc, et le cas d'un seul terme nomme le
// geste qui manque au lieu de laisser deviner.
function railsAcceptes(rail) {
  const valeurs = [...new Set([BRANCHE_HISTORIQUE, rail])];
  if (valeurs.length > 1) return `${valeurs.join(' ou ')}`;
  return `${valeurs[0]} seule — ce lot ne déclare aucun rail`;
}
function railPretenduParEnv() {
  for (const v of VARIABLES_RAIL) if (process.env[v]) return { variable: v, valeur: process.env[v] };
  return null;
}
function signalerEnvDivergent(lot, rail, signaler) {
  const pretendu = railPretenduParEnv();
  if (!pretendu || pretendu.valeur === rail) return;
  signaler(`${pretendu.variable}=${pretendu.valeur} contredit le rail déclaré au registre pour ${lot} (${rail}) — le registre fait foi, la variable n'a aucun effet.`);
}
// Garde des commandes qui ÉCRIVENT : un rail interdit ne doit pas devenir une
// violation à constater après coup, il doit empêcher l'écriture.
function exigerRailSecurise(etat, lot) {
  const rail = railDuLot(etat, lot);
  if (!railSecurise(rail)) {
    console.error(`REFUS — rail non autorisé pour ${lot} : ${JSON.stringify(rail)}`);
    console.error(`Un rail vaut ${BRANCHE_HISTORIQUE} ou porte la forme handoff-*, et jamais ${REFS_PROTEGEES.join('/')}.`);
    process.exit(1);
  }
  signalerEnvDivergent(lot, rail, m => console.error(`AVERTISSEMENT — ${m}`));
  return rail;
}
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
const CODES_NON_DEROGEABLES = ['BRANCHE_PROTEGEE', 'BRANCHE_INATTENDUE', 'RAIL_NON_AUTORISE', 'REFS_PROTEGEES', 'REFS_ILLISIBLES'];
// 21/09/2026 — une dérogation savait dire « ce défaut de forme est toléré ».
// Elle ne savait pas dire « et voici la valeur retenue ». Or `in_reply_to`
// n'est pas seulement validé : trois outils LISENT la demande qu'une décision
// vise (consommation, réveil du Handoff, réveil de l'Orchestrateur). Une
// dérogation sur IN_REPLY_TO_MANQUANT rendait donc `verifier` vert et
// laissait `consommer` refuser (« répond à null »), et l'Orchestrateur croire
// la demande sans réponse — il réveillait Claude sur une demande que le
// Créateur avait déjà arbitrée. Les dérogations historiques consignaient bien
// la valeur retenue (« en réponse à request-1.md ») : en prose, qu'aucun
// outil ne lit. `valeur_retenue` lui donne un domicile lisible.
//
// Le mécanisme est volontairement étroit : seules les substitutions déclarées
// ici sont admises, jamais sur un code non dérogeable, jamais contre une
// valeur que l'enveloppe porte réellement, toujours annoncée à voix haute, et
// toujours re-soumise aux contrôles de cohérence normaux — une valeur retenue
// qui désigne une demande inexistante échoue encore (IN_REPLY_TO_INCONNU).
const SUBSTITUTIONS_ADMISES = { IN_REPLY_TO_MANQUANT: ['in_reply_to'] };
function derogationsDuRegistre() { try { const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); return Array.isArray(etat.derogations) ? etat.derogations : []; } catch (e) { return []; } }
// Valeur qu'un humain a retenue pour un champ absent d'une enveloppe, ou null.
// Relit STATE.json à chaque appel : le registre est la source unique, et aucun
// état intermédiaire ne peut se périmer entre deux commandes.
function valeurRetenue(ou, regle, champ) {
  if (!(SUBSTITUTIONS_ADMISES[regle] || []).includes(champ) || CODES_NON_DEROGEABLES.includes(regle)) return null;
  const d = derogationsDuRegistre().find(x => x.fichier === ou && x.regle === regle && x.valeur_retenue);
  if (!d) return null;
  const v = d.valeur_retenue[champ];
  return v === undefined || v === null || !String(v).trim() ? null : { valeur: String(v).trim(), derogation: d };
}
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
// La demande qu'une décision vise, telle que le registre la désigne.
// Ce n'est PAS `basename(in_reply_to)` : quand l'enveloppe ne déclare rien, la
// désignation peut venir d'une dérogation nommée (valeur_retenue). Trois
// outils recalculaient ce basename chacun de son côté — `consommer`,
// `reveil-handoff.js`, `reveil-orchestrateur.js` — et aucun ne pouvait voir
// l'arbitrage humain. La désignation vit ici, une seule fois.
// Une valeur déclarée par l'enveloppe l'emporte toujours : une dérogation
// comble une absence, elle ne réécrit jamais ce qu'un auteur a écrit.
function demandeVisee(lot, fichierDecision) {
  const r = lireEnveloppe(path.join(LOTS, lot, fichierDecision));
  const brut = r.env && r.env.in_reply_to ? String(r.env.in_reply_to).trim() : '';
  if (brut) return path.basename(brut);
  const retenue = valeurRetenue(`${lot}/${fichierDecision}`, 'IN_REPLY_TO_MANQUANT', 'in_reply_to');
  return retenue ? path.basename(retenue.valeur) : null;
}
function normaliserDecision(valeur) { if (valeur === 'APPROVED_CLOSED') return { decision: 'APPROVED', closes: true, legacy: true }; return { decision: valeur, legacy: false }; }
function lots() { if (!fs.existsSync(LOTS)) return []; return fs.readdirSync(LOTS).filter(d => fs.statSync(path.join(LOTS, d)).isDirectory()).sort(); }
function echanges(lot, genre) {
  const dir = path.join(LOTS, lot); if (!fs.existsSync(dir)) return [];
  const prefixe = genre === 'request' ? 'request-' : 'decision-';
  return fs.readdirSync(dir).filter(f => f.startsWith(prefixe) && f.endsWith('.md')).map(f => ({ fichier: f, seq: parseInt(f.slice(prefixe.length, -3), 10) })).filter(e => Number.isInteger(e.seq) && e.seq > 0).sort((a, b) => a.seq - b.seq);
}
const dernier = liste => liste.length ? liste[liste.length - 1] : null;
function validerCommuns(lot, e, env, genre, rail) {
  const ou = `${lot}/${e.fichier}`;
  if (env.protocol !== PROTOCOLE) bloquant(`${ou} : protocol doit valoir ${PROTOCOLE}, trouvé ${JSON.stringify(env.protocol)}`, 'PROTOCOLE_INATTENDU', ou);
  if (env.kind !== genre) bloquant(`${ou} : kind doit valoir ${genre}, trouvé ${JSON.stringify(env.kind)}`, 'KIND_INATTENDU', ou);
  if (env.lot_id !== lot) bloquant(`${ou} : lot_id ${JSON.stringify(env.lot_id)} ne correspond pas au répertoire ${lot}`, 'LOT_ID_INCOHERENT', ou);
  if (String(env.seq) !== String(e.seq)) bloquant(`${ou} : seq ${JSON.stringify(env.seq)} ne correspond pas au nom de fichier`, 'SEQ_INCOHERENTE', ou);
  if (!env.author) bloquant(`${ou} : author manquant`, 'AUTEUR_MANQUANT', ou);
  if (REFS_PROTEGEES.includes(env.branch)) bloquant(`${ou} : branch ${env.branch} est une ref protégée — refus`, 'BRANCHE_PROTEGEE', ou);
  else if (env.branch === undefined) bloquant(`${ou} : branch manquante — l'enveloppe doit déclarer ${rail}`, 'BRANCHE_ABSENTE', ou);
  else if (!brancheRailValide(env.branch, rail)) bloquant(`${ou} : branch doit appartenir au rail du lot tel que le registre le déclare (${railsAcceptes(rail)}), trouvé ${JSON.stringify(env.branch)}`, 'BRANCHE_INATTENDUE', ou);
}
function validerPreuves(ou, preuves) {
  if (!preuves) return; if (!Array.isArray(preuves)) { bloquant(`${ou} : preuves doit être une liste`, 'PREUVES_MAL_FORMEES', ou); return; }
  for (const p of preuves) { if (!p.id) bloquant(`${ou} : une preuve sans id`, 'PREUVE_SANS_ID', ou); if (!CLASSES_PREUVE.includes(p.classe)) bloquant(`${ou} : preuve ${p.id} — classe ${JSON.stringify(p.classe)} hors vocabulaire (${CLASSES_PREUVE.join('|')})`, 'PREUVE_CLASSE_HORS_VOCABULAIRE', ou); }
}
// L'empreinte est une preuve historique. Un avancement fast-forward est légitime ;
// un SHA inconnu ou une divergence/réécriture de l'histoire échoue fermé.
function verifierRefsProtegees(ou, valeur) {
  const brut = String(valeur || '').trim();
  const m = brut.match(/^main=([0-9a-f]{7,40})\s+production=([0-9a-f]{7,40})$/i);
  if (!m) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — format invalide`, 'REFS_PROTEGEES', ou); return; }
  const attendues = { main: m[1], production: m[2] };
  for (const ref of REFS_PROTEGEES) {
    let historique, courant;
    try { historique = git('rev-parse', '--verify', `${attendues[ref]}^{commit}`); courant = git('rev-parse', '--verify', `origin/${ref}^{commit}`); }
    catch (err) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — impossible de résoudre ${ref}=${attendues[ref]} ou origin/${ref}`, 'REFS_ILLISIBLES', ou); continue; }
    try { git('merge-base', '--is-ancestor', historique, courant); }
    catch (err) { bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(brut)} — ${ref} historique ${attendues[ref]} n'est pas ancêtre de la ref actuelle ${courant.slice(0, 7)}`, 'REFS_PROTEGEES', ou); }
  }
}
// Une décision peut légitimement en superséder une autre répondant à la même
// demande — mais seulement si un champ d'enveloppe `supersedes_..._of` désigne
// explicitement la décision immédiatement précédente sur cette même demande.
// Sans ce champ, un second arbitrage sur la même demande reste un doublon.
function supersessionValide(env, fichierPrecedent) {
  for (const cle of Object.keys(env)) {
    if (/^supersedes_[a-z0-9_]+_of$/.test(cle) && path.basename(String(env[cle]).trim()) === fichierPrecedent) return cle;
  }
  return null;
}
// Un répertoire hors registre n'est toléré que s'il figure, complet et sans
// ambiguïté, dans STATE.json.artefacts_hors_registre — jamais par défaut.
function artefactsHorsRegistreValides(etat) {
  const valides = new Map();
  if (!etat || etat.artefacts_hors_registre === undefined) return valides;
  if (!Array.isArray(etat.artefacts_hors_registre)) { bloquant('STATE.json : artefacts_hors_registre doit être une liste'); return valides; }
  const vus = new Set();
  for (const a of etat.artefacts_hors_registre) {
    const id = a && a.lot_id; const manquants = ['lot_id', 'motif', 'autorise_par', 'le'].filter(c => !a || !a[c]);
    if (manquants.length) { bloquant(`STATE.json : artefacts_hors_registre incomplet${id ? ` (${id})` : ''} — ${manquants.join(', ')} manquant(s)`); continue; }
    if (vus.has(id)) { bloquant(`STATE.json : artefacts_hors_registre — lot_id ${id} déclaré plusieurs fois`); continue; }
    vus.add(id);
    if (etat.lots && etat.lots[id]) { bloquant(`STATE.json : artefacts_hors_registre — ${id} est aussi un lot enregistré ; un lot est soit canonique soit hors registre, jamais les deux`); continue; }
    if (!fs.existsSync(path.join(LOTS, id))) { bloquant(`STATE.json : artefacts_hors_registre — ${id} ne correspond à aucun répertoire sous docs/handoff/lots/`); continue; }
    valides.set(id, a);
  }
  return valides;
}
// Valide les enveloppes request/decision d'UN lot déjà connu du registre
// (ou sur le point de l'être — voir `enregistrerLot`). Extrait de
// `validerRegistre` pour que `enregistrer-lot` puisse rejouer exactement la
// même exigence AVANT d'ajouter un lot à STATE.json.lots, plutôt que
// d'inventer une seconde vérité plus laxiste.
function validerEnveloppesLot(lot, rail) {
    const demandes = echanges(lot, 'request'), decisions = echanges(lot, 'decision'); if (!demandes.length) bloquant(`lots/${lot} : aucun request-N.md`);
    demandes.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des demandes non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', `${lot}/${e.fichier}`); });
    decisions.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des décisions non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', `${lot}/${e.fichier}`); });
    // 07/09/2026 — les deux défauts d'enveloppe d'une DEMANDE portent
    // désormais un code et un fichier, comme ceux d'une DÉCISION en portent
    // depuis l'origine (BRANCHE_ABSENTE, DECISION_HORS_VOCABULAIRE). Sans
    // code, aucune dérogation ne pouvait les viser : le registre n'offrait
    // que « réécrire le fichier » — c'est-à-dire fabriquer après coup une
    // enveloppe qui n'a jamais existé, exactement ce que le protocole
    // interdit. Ce n'est pas un assouplissement : une dérogation reste un
    // acte humain nommé, daté, motivé, et réimprimé à chaque exécution.
    //
    // Ces deux codes sont volontairement qualifiés par le LOT
    // (`<LOT_ID>/request-N.md`) et non par le seul nom de fichier. Les
    // dérogations historiques visent un basename : « decision-1.md »
    // s'applique au decision-1.md de N'IMPORTE quel lot portant le même code.
    // Une dérogation doit couvrir le fichier qu'un humain a lu, pas ses
    // homonymes futurs. Une dérogation sur ces deux codes doit donc nommer
    // le chemin qualifié ; un basename seul ne les couvre pas.
    for (const e of demandes) {
      const ou = `${lot}/${e.fichier}`, r = lireEnveloppe(path.join(LOTS, lot, e.fichier)); if (r.erreur) { bloquant(`${ou} : ${r.erreur}`, 'ENVELOPPE_ILLISIBLE', ou); continue; } if (r.absente) { bloquant(`${ou} : enveloppe absente`, 'ENVELOPPE_ABSENTE', ou); continue; }
      const env = r.env; validerCommuns(lot, e, env, 'request', rail); if (!STATUTS_DEMANDE.includes(env.status)) bloquant(`${ou} : status ${JSON.stringify(env.status)} hors vocabulaire (${STATUTS_DEMANDE.join('|')})`, 'STATUT_HORS_VOCABULAIRE', ou); if (!TOKEN_MODES.includes(env.token_mode)) bloquant(`${ou} : token_mode ${JSON.stringify(env.token_mode)} hors vocabulaire (${TOKEN_MODES.join('|')})`, 'TOKEN_MODE_HORS_VOCABULAIRE', ou); validerPreuves(ou, env.preuves); const refs = (env.preuves || []).find(p => p.id === 'refs-protegees'); if (refs) verifierRefsProtegees(ou, refs.valeur || '');
    }
    const reponses = [];
    for (const e of decisions) {
      const ou = `${lot}/${e.fichier}`, r = lireEnveloppe(path.join(LOTS, lot, e.fichier)); if (r.erreur) { bloquant(`${ou} : ${r.erreur}`, 'ENVELOPPE_ILLISIBLE', ou); continue; } if (r.absente) { bloquant(`${ou} : enveloppe absente`, 'ENVELOPPE_ABSENTE', ou); continue; }
      const env = r.env; validerCommuns(lot, e, env, 'decision', rail); if (DECISIONS_LEGACY.includes(env.decision)) bloquant(`${ou} : ${env.decision} est une valeur legacy, lisible dans l'historique v1 mais interdite dans le registre v2 — employer decision + closes.`, 'DECISION_LEGACY', ou); else if (!DECISIONS_CANONIQUES.includes(env.decision)) bloquant(`${ou} : decision ${JSON.stringify(env.decision)} hors vocabulaire (${DECISIONS_CANONIQUES.join('|')})`, 'DECISION_HORS_VOCABULAIRE', ou); if (!['true', 'false'].includes(String(env.closes))) bloquant(`${ou} : closes doit valoir true ou false`, 'CLOSES_INVALIDE', ou);
      // La validité d'une décision dépend de la demande qu'elle référence (elle
      // doit exister dans CE lot) et de sa relation éventuelle de supersession
      // avec une décision précédente — jamais d'une comparaison numérique entre
      // le rang de la décision et celui de la demande visée. Plusieurs décisions
      // successives peuvent légitimement répondre à la même demande, et une
      // décision peut tout aussi légitimement répondre à une demande plus
      // récente que la précédente décision du lot (cf. decision-3 -> request-2
      // du lot CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906).
      // `in_reply_to` n'est pas qu'une exigence de forme : c'est la désignation
      // que trois outils lisent. Quand l'enveloppe ne la porte pas, une
      // dérogation nommée peut la fournir — et elle est alors contrôlée comme
      // si l'enveloppe l'avait portée.
      const retenue = env.in_reply_to ? null : valeurRetenue(ou, 'IN_REPLY_TO_MANQUANT', 'in_reply_to');
      if (retenue) avertir(`DÉROGATION IN_REPLY_TO_MANQUANT sur ${ou} — in_reply_to absent de l'enveloppe ; valeur retenue : ${retenue.valeur}\n         motif : ${retenue.derogation.motif}\n         autorisée par ${retenue.derogation.autorise_par}, le ${retenue.derogation.le}`);
      const designation = env.in_reply_to || (retenue && retenue.valeur);
      if (!designation) bloquant(`${ou} : in_reply_to manquant`, 'IN_REPLY_TO_MANQUANT', ou); else { const brut = String(designation).trim(), segments = brut.split('/').filter(Boolean), vise = segments[segments.length - 1], dossierCible = segments.length > 1 ? segments[segments.length - 2] : lot; if (dossierCible !== lot) bloquant(`${ou} : in_reply_to ${JSON.stringify(brut)} désigne le lot ${dossierCible}, incohérent avec ${lot}`, 'IN_REPLY_TO_AUTRE_LOT', ou); else { const cible = demandes.find(d => d.fichier === vise); if (!cible) bloquant(`${ou} : in_reply_to ${JSON.stringify(brut)} ne désigne aucune demande de ce lot`, 'IN_REPLY_TO_INCONNU', ou); else reponses.push({ decision: e, viseSeq: cible.seq, env }); } }
    }
    let supersessionsLegitimes = 0;
    for (let i = 1; i < reponses.length; i++) {
      if (reponses[i].viseSeq <= reponses[i - 1].viseSeq) {
        const champ = supersessionValide(reponses[i].env, reponses[i - 1].decision.fichier);
        if (champ) { supersessionsLegitimes++; avertir(`lots/${lot} : ${reponses[i].decision.fichier} supersède ${reponses[i - 1].decision.fichier} via ${champ} — arbitrage successif légitime sur la même demande.`); }
        else bloquant(`lots/${lot} : ${reponses[i].decision.fichier} répond à une demande déjà arbitrée par ${reponses[i - 1].decision.fichier}`, 'DEMANDE_DEJA_ARBITREE', `${lot}/${reponses[i].decision.fichier}`);
      }
    }
    if (decisions.length - supersessionsLegitimes > demandes.length) bloquant(`lots/${lot} : plus de décisions que de demandes`);
}
function validerRegistre(etat, artefactsValides) {
  const registreLots = etat && etat.lots && typeof etat.lots === 'object' ? etat.lots : {};
  for (const lot of lots()) {
    if (!LOT_ID_VALIDE.test(lot)) { bloquant(`lots/${lot} : LOT_ID malformé`); continue; }
    if (artefactsValides.has(lot)) { const a = artefactsValides.get(lot); avertir(`lots/${lot} est un artefact historique hors registre, toléré (motif : ${a.motif} — autorisé par ${a.autorise_par}, le ${a.le}). Aucune validation d'enveloppe request/decision n'est appliquée à ce répertoire.`); continue; }
    if (!registreLots[lot]) { bloquant(`lots/${lot} : répertoire présent sous docs/handoff/lots/ mais absent de STATE.json.lots et non déclaré dans artefacts_hors_registre`, 'LOT_HORS_REGISTRE', null); continue; }
    // Le rail se lit ici, dans le registre, et non dans l'environnement. Un
    // rail inadmissible arrête la validation de CE lot : valider ses
    // enveloppes contre une valeur interdite n'apprendrait rien et noierait
    // la seule violation qui compte.
    const rail = railDuLot(etat, lot);
    if (!railSecurise(rail)) { bloquant(`STATE.json : ${lot}.rail ${JSON.stringify(rail)} n'est pas un rail autorisé — attendu ${BRANCHE_HISTORIQUE} ou handoff-*, jamais ${REFS_PROTEGEES.join('/')}`, 'RAIL_NON_AUTORISE', null); continue; }
    validerEnveloppesLot(lot, rail);
  }
}
function validerEtatContenu(etat) {
  if (!etat) return etat;
  if (etat.protocol !== PROTOCOLE) bloquant(`STATE.json : protocol doit valoir ${PROTOCOLE}`); if (!etat.lots || typeof etat.lots !== 'object') { bloquant('STATE.json : lots manquant'); return etat; }
  const actifs = Object.entries(etat.lots).filter(([, v]) => STATUTS_LOT_ACTIFS.includes(v.statut)).map(([k]) => k); if (actifs.length > 1) bloquant(`STATE.json : ${actifs.length} lots en attente (${actifs.join(', ')}) — un seul lot actif dans cette version`, 'PLUSIEURS_LOTS_ACTIFS'); if (etat.lot_actif && !etat.lots[etat.lot_actif]) bloquant(`STATE.json : lot_actif ${etat.lot_actif} absent de lots`);
  for (const [lot, v] of Object.entries(etat.lots)) { const demandes = echanges(lot, 'request'), decisions = echanges(lot, 'decision'); if (v.derniere_demande) { if (!demandes.find(d => d.fichier === v.derniere_demande)) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} absente du registre`); else if (v.derniere_demande !== dernier(demandes).fichier) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} n'est pas la plus récente (${dernier(demandes).fichier})`); } if (v.derniere_decision && v.source_decision === 'registre' && !decisions.find(d => d.fichier === v.derniere_decision)) bloquant(`STATE.json : ${lot}.derniere_decision ${v.derniere_decision} absente du registre`); if (v.consomme_le && !v.commit_decision) bloquant(`STATE.json : ${lot} marqué consommé sans commit_decision`); if (!STATUTS_LOT.includes(v.statut)) bloquant(`STATE.json : ${lot}.statut ${JSON.stringify(v.statut)} hors vocabulaire`);
    // Un rail déclaré pour un lot SANS répertoire échapperait à validerRegistre,
    // qui n'itère que sur le disque. Là où le répertoire existe, la violation a
    // déjà été posée : on ne la dit pas deux fois.
    if (v.rail !== undefined && !railSecurise(v.rail) && !fs.existsSync(path.join(LOTS, lot))) bloquant(`STATE.json : ${lot}.rail ${JSON.stringify(v.rail)} n'est pas un rail autorisé — attendu ${BRANCHE_HISTORIQUE} ou handoff-*, jamais ${REFS_PROTEGEES.join('/')}`, 'RAIL_NON_AUTORISE', null); }
  if (etat.derogations !== undefined) { if (!Array.isArray(etat.derogations)) bloquant('STATE.json : derogations doit être une liste'); else for (const d of etat.derogations) { for (const champ of ['fichier', 'regle', 'motif', 'autorise_par', 'le']) if (!d[champ]) bloquant(`STATE.json : dérogation incomplète — ${champ} manquant`); if (CODES_NON_DEROGEABLES.includes(d.regle)) bloquant(`STATE.json : ${d.regle} est un invariant de sécurité — aucune dérogation n'est recevable`); if (d.valeur_retenue !== undefined) { const admis = SUBSTITUTIONS_ADMISES[d.regle] || []; if (!d.valeur_retenue || typeof d.valeur_retenue !== 'object' || Array.isArray(d.valeur_retenue)) bloquant(`STATE.json : dérogation ${d.regle} sur ${d.fichier} — valeur_retenue doit être un objet`); else if (!admis.length) bloquant(`STATE.json : dérogation ${d.regle} sur ${d.fichier} — aucune valeur retenue n'est admise pour cette règle (règles substituables : ${Object.keys(SUBSTITUTIONS_ADMISES).join('|')})`); else for (const champ of Object.keys(d.valeur_retenue)) if (!admis.includes(champ)) bloquant(`STATE.json : dérogation ${d.regle} sur ${d.fichier} — valeur retenue interdite pour ${champ} (admis : ${admis.join('|')})`); } } }
  return etat;
}
function enTeteMiroir(source) { return `<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/${source}\n     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->\n`; }
function regenererMiroirs() { const etat = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} }, lot = etat.lot_actif; if (!lot) return; const d = dernier(echanges(lot, 'request')); if (d) { const src = path.join('lots', lot, d.fichier); fs.writeFileSync(MIROIR_DEMANDE, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, d.fichier), 'utf8')); } const dec = dernier(echanges(lot, 'decision')); if (dec) { const src = path.join('lots', lot, dec.fichier); fs.writeFileSync(MIROIR_DECISION, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, dec.fichier), 'utf8')); } }
function verifier(ignorer) {
  erreurs.length = 0; avertissements.length = 0;
  let etat = null;
  if (!fs.existsSync(ETAT)) bloquant('docs/handoff/STATE.json absent');
  else { try { etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); } catch (e) { bloquant(`STATE.json illisible : ${e.message}`); } }
  const artefactsValides = artefactsHorsRegistreValides(etat);
  validerRegistre(etat, artefactsValides); validerEtatContenu(etat);
  if (etat && etat.lot_actif) signalerEnvDivergent(etat.lot_actif, railDuLot(etat, etat.lot_actif), avertir);
  if (etat && etat.lot_actif) { const d = dernier(echanges(etat.lot_actif, 'request')); if (d) { const r = lireEnveloppe(path.join(LOTS, etat.lot_actif, d.fichier)), p = ((r.env && r.env.preuves) || []).find(x => x.id === 'suite'), sortie = process.env.NEXUS_SORTIE_SUITE; if (p && sortie && fs.existsSync(sortie)) { const m = fs.readFileSync(sortie, 'utf8').match(/(\d+)\/(\d+) tests passent/); if (m && p.valeur.trim() !== `${m[1]}/${m[2]}`) avertir(`suite déclarée ${p.valeur.trim()}, mesurée ${m[1]}/${m[2]} — lot d'observation : avertissement, pas blocage.`); } } }
  const derogations = etat && Array.isArray(etat.derogations) ? etat.derogations : [], restantes = [];
  for (const e of erreurs) { const d = derogations.find(x => x.fichier === e.fichier && x.regle === e.code); if (d && CODES_NON_DEROGEABLES.includes(e.code)) restantes.push({ ...e, message: `${e.message}\n         (une dérogation existe mais ${e.code} est un invariant de sécurité : elle ne s'applique pas)` }); else if (d) avertir(`DÉROGATION ${d.regle} sur ${d.fichier} — ${e.message}\n         motif : ${d.motif}\n         autorisée par ${d.autorise_par}, le ${d.le}`); else if (ignorer && ignorer.includes(e.code)) avertir(`${e.code} toléré le temps de l'opération en cours — ${e.message}`); else restantes.push(e); }
  for (const a of avertissements) console.log(`AVERTISSEMENT — ${a}`); if (restantes.length) { for (const e of restantes) console.error(`ÉCHEC — ${e.message}`); console.error(`\n${restantes.length} violation(s) du protocole Handoff v2.`); return 1; } console.log(`Handoff v2 : registre, enveloppes et STATE.json conformes (${lots().length} lot(s), ${avertissements.length} avertissement(s), ${derogations.length} dérogation(s)).`); return 0;
}
function consommer(lot) {
  if (verifier(['PLUSIEURS_LOTS_ACTIFS']) !== 0) { console.error('\nREFUS — le registre ne valide pas ; aucune décision ne peut être consommée dans cet état.'); process.exit(1); }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')), v = etat.lots[lot]; if (!v) { console.error(`Lot ${lot} inconnu.`); process.exit(1); } const dec = dernier(echanges(lot, 'decision'));
  if (dec) { const demandes = echanges(lot, 'request'), vise = demandeVisee(lot, dec.fichier), active = dernier(demandes); if (active && vise !== active.fichier) { console.error(`REFUS — ${dec.fichier} répond à ${vise}, mais la demande active est ${active.fichier}.`); console.error('Une décision périmée ne se consomme pas : une décision sur la demande active doit être rendue.'); process.exit(1); } }
  const source = dec ? 'registre' : 'legacy', cible = path.relative(RACINE, dec ? path.join(LOTS, lot, dec.fichier) : MIROIR_DECISION); let commit; try { commit = git('log', '-1', '--format=%H', '--', cible); } catch (e) { commit = ''; } if (!commit) { console.error(`Aucun commit trouvé pour ${cible} — refus de marquer une consommation invérifiable.`); process.exit(1); }
  if (v.consomme_le && v.commit_decision === commit) { console.error(`REFUS — la décision ${commit.slice(0, 7)} du lot ${lot} est déjà marquée consommée le ${v.consomme_le}.`); console.error('Une nouvelle décision doit être rendue avant de poursuivre.'); process.exit(1); }
  v.statut = 'DECISION_CONSOMMEE'; v.derniere_decision = dec ? dec.fichier : null; v.source_decision = source; v.commit_decision = commit; v.consomme_le = new Date().toISOString(); fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n'); console.log(`Décision ${commit.slice(0, 7)} (${source}) marquée consommée pour ${lot}.`);
}
// Dépose une DÉCISION avec une enveloppe conforme par construction.
//
// POURQUOI CETTE COMMANDE EXISTE. Quatre dépôts consécutifs ont présenté un
// écart d'enveloppe : `status:` au lieu de `decision:`, `branch:` absent,
// `status`/`token_mode` manquants, `decision: REJECTED` hors vocabulaire.
// Chacun a été dérogé plutôt que réécrit, et la note du troisième disait déjà
// que le contrat n'était « manifestement pas assez découvrable ». C'était
// exact, et la raison est simple : `handoff.js demande` existait pour les
// demandes, et RIEN pour les décisions. L'auteur d'une décision devait donc
// écrire son en-tête à la main, de mémoire, à chaque fois.
//
// Une cinquième dérogation aurait traité le symptôme. Cette commande traite
// la cause : le vocabulaire est vérifié AVANT écriture, la séquence est
// calculée, `in_reply_to` doit désigner une demande réellement existante du
// lot, et la branche est posée par l'outil — jamais retapée.
function nouvelleDecision(lot, corpsFichier, options) {
  if (!fs.existsSync(path.join(LOTS, lot))) { console.error(`Lot inconnu : ${lot}`); process.exit(1); }
  if (!fs.existsSync(corpsFichier)) { console.error(`Corps introuvable : ${corpsFichier}`); process.exit(1); }
  const verdict = options.decision;
  if (!DECISIONS_CANONIQUES.includes(verdict)) {
    console.error(`REFUS — decision ${JSON.stringify(verdict)} hors vocabulaire.`);
    console.error(`Valeurs admises : ${DECISIONS_CANONIQUES.join(' | ')}`);
    if (verdict) console.error('Un verdict de refus se dit BLOCKED ; « closes: true » dit qu\'il ferme le lot.');
    process.exit(1);
  }
  if (!['true', 'false'].includes(String(options.closes))) { console.error('--closes doit valoir true ou false.'); process.exit(1); }
  const demandes = echanges(lot, 'request');
  if (!demandes.length) { console.error(`Le lot ${lot} n'a aucune demande : une décision ne répond à rien.`); process.exit(1); }
  const vise = options.enReponseA || dernier(demandes).fichier;
  if (!demandes.find(d => d.fichier === vise)) {
    console.error(`REFUS — in_reply_to ${vise} ne désigne aucune demande de ${lot}.`);
    console.error(`Demandes existantes : ${demandes.map(d => d.fichier).join(', ')}`);
    process.exit(1);
  }
  const seq = (dernier(echanges(lot, 'decision')) || { seq: 0 }).seq + 1;
  const fichier = `decision-${seq}.md`, cible = path.join(LOTS, lot, fichier);
  if (fs.existsSync(cible)) { console.error(`${fichier} existe déjà — le registre est append-only.`); process.exit(1); }
  const auteur = options.auteur || 'NEXUS Orchestrator';
  const etatDecision = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} };
  const rail = exigerRailSecurise(etatDecision, lot);
  let env = '---\n';
  env += `protocol: ${PROTOCOLE}\nkind: decision\nlot_id: ${lot}\nseq: ${seq}\n`;
  env += `author: ${auteur}\nbranch: ${rail}\ndecision: ${verdict}\ncloses: ${options.closes}\n`;
  env += `in_reply_to: ${vise}\n---\n`;
  fs.writeFileSync(cible, env + fs.readFileSync(corpsFichier, 'utf8'));
  console.log(`${lot}/${fichier} créé (${verdict}, closes=${options.closes}, en réponse à ${vise}).`);
  console.log('Enveloppe conforme par construction — à commiter, puis à consommer par `handoff.js consommer`.');
}

// Enregistre dans STATE.json.lots un lot déjà présent sous docs/handoff/lots/
// avec des enveloppes request/decision déjà conformes, mais jamais inscrit —
// parce qu'il a été déposé par un commit direct (Frédéric ou l'Orchestrator),
// pas via `demande`/`decision`. Découvert le 09/09/2026 sur
// NEXUS-PRODUCTION-READINESS-1-20260908 : ses deux fichiers sont conformes
// par construction (auteur, branche, vocabulaire, in_reply_to — tout y est),
// seul STATE.json.lots ignorait son existence, ce qui bloque `verifier` et
// donc `consommer` pour TOUT le registre, pas seulement ce lot.
//
// Ce n'est PAS une dérogation : aucune règle n'est assouplie, aucun fichier
// n'est réécrit, rien n'est toléré malgré un défaut. Cette commande rejoue
// exactement les mêmes contrôles que `verifier` sur ce lot AVANT de
// l'enregistrer, et refuse s'ils échouent — un lot mal formé ne devient
// jamais un lot enregistré parce qu'on l'a demandé. `artefacts_hors_registre`
// reste le mécanisme réservé aux répertoires qui n'ont jamais porté
// d'enveloppe et n'en porteront jamais rétroactivement ; celui-ci est pour
// les lots dont l'enveloppe a toujours été correcte.
function enregistrerLot(lot, railDemande) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); }
  if (railDemande !== undefined && !railSecurise(railDemande)) { refuserRail(railDemande); }
  if (!fs.existsSync(path.join(LOTS, lot))) { console.error(`Lot inconnu : aucun répertoire lots/${lot}`); process.exit(1); }
  if (!fs.existsSync(ETAT)) { console.error('docs/handoff/STATE.json absent.'); process.exit(1); }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  etat.lots = etat.lots || {};
  if (etat.lots[lot]) { console.error(`REFUS — ${lot} est déjà enregistré dans STATE.json.lots.`); process.exit(1); }
  const horsRegistre = Array.isArray(etat.artefacts_hors_registre) ? etat.artefacts_hors_registre : [];
  if (horsRegistre.some(a => a && a.lot_id === lot)) { console.error(`REFUS — ${lot} est déclaré dans artefacts_hors_registre : un lot est soit canonique soit hors registre, jamais les deux.`); process.exit(1); }
  const rail = railDemande !== undefined ? railDemande : BRANCHE_HISTORIQUE;
  erreurs.length = 0; avertissements.length = 0;
  validerEnveloppesLot(lot, rail);
  if (erreurs.length) {
    console.error(`REFUS — les enveloppes de ${lot} ne sont pas conformes ; aucun enregistrement n'est fait.`);
    if (railDemande === undefined && erreurs.some(e => e.code === 'BRANCHE_INATTENDUE')) console.error(`Aucun rail n'a été déclaré : ${lot} est donc lu sur ${BRANCHE_HISTORIQUE}. Si ses enveloppes vivent sur un autre rail, passez --rail <handoff-…>.`);
    for (const e of erreurs) console.error(`ÉCHEC — ${e.message}`);
    process.exit(1);
  }
  const demandes = echanges(lot, 'request'), decisions = echanges(lot, 'decision'), derniereDemande = dernier(demandes);
  etat.lots[lot] = { statut: 'ATTENTE_DECISION', derniere_demande: derniereDemande.fichier, rail };
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  console.log(`${lot} enregistré dans STATE.json.lots (rail ${rail}, derniere_demande ${derniereDemande.fichier}${decisions.length ? `, ${decisions.length} décision(s) déjà déposée(s) — à consommer via handoff.js consommer` : ', aucune décision déposée'}).`);
}
// Rattrape `STATE.json.lots[lot].derniere_demande` quand un request-N.md a
// été déposé DIRECTEMENT (commit humain/Orchestrator, pas `handoff.js
// demande`) sur un lot déjà enregistré. Découvert le 09/09/2026 sur
// NEXUS-PRODUCTION-READINESS-1-20260908 : request-5.md/decision-5.md étaient
// des enveloppes conformes, mais STATE.json pointait encore vers
// request-4.md — `verifier` bloque (« derniere_demande n'est pas la plus
// récente ») et donc `consommer` refuse pour TOUT le registre.
//
// Distinct de `enregistrer-lot` : celui-ci initialise un lot totalement
// absent de STATE.json.lots ; celui-ci rattrape un lot déjà présent mais en
// retard sur le disque. Même garde-fou : les enveloppes du lot sont
// revalidées avant tout rattrapage, et seul `derniere_demande`/`statut`
// bouge — jamais `derniere_decision`/`commit_decision`/`consomme_le`, qui ne
// se posent que par `consommer`.
function rattraperDemande(lot) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); }
  if (!fs.existsSync(path.join(LOTS, lot))) { console.error(`Lot inconnu : aucun répertoire lots/${lot}`); process.exit(1); }
  if (!fs.existsSync(ETAT)) { console.error('docs/handoff/STATE.json absent.'); process.exit(1); }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  etat.lots = etat.lots || {};
  if (!etat.lots[lot]) { console.error(`REFUS — ${lot} n'est pas encore enregistré dans STATE.json.lots ; utilisez enregistrer-lot.`); process.exit(1); }
  const rail = exigerRailSecurise(etat, lot);
  erreurs.length = 0; avertissements.length = 0;
  validerEnveloppesLot(lot, rail);
  if (erreurs.length) {
    console.error(`REFUS — les enveloppes de ${lot} ne sont pas conformes ; aucun rattrapage n'est fait.`);
    for (const e of erreurs) console.error(`ÉCHEC — ${e.message}`);
    process.exit(1);
  }
  const derniereDemande = dernier(echanges(lot, 'request'));
  if (!derniereDemande) { console.error(`REFUS — ${lot} n'a aucune demande déposée.`); process.exit(1); }
  if (etat.lots[lot].derniere_demande === derniereDemande.fichier) { console.error(`REFUS — ${lot}.derniere_demande est déjà à jour (${derniereDemande.fichier}) ; rien à rattraper.`); process.exit(1); }
  etat.lots[lot].statut = 'ATTENTE_DECISION';
  etat.lots[lot].derniere_demande = derniereDemande.fichier;
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  console.log(`${lot}.derniere_demande rattrapé à ${derniereDemande.fichier} (statut ATTENTE_DECISION).`);
}
function nouvelleDemande(lot, corpsFichier, options) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); } if (!fs.existsSync(corpsFichier)) { console.error(`Corps introuvable : ${corpsFichier}`); process.exit(1); } const mode = options.tokenMode || 'STANDARD'; if (!TOKEN_MODES.includes(mode)) { console.error(`token_mode inconnu : ${mode} (${TOKEN_MODES.join('|')})`); process.exit(1); }
  const etatAvant = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} }; for (const [autre, v] of Object.entries(etatAvant.lots || {})) { if (autre === lot || !STATUTS_LOT_ACTIFS.includes(v.statut)) continue; const d = dernier(echanges(autre, 'decision')); if (d) { console.error(`REFUS — le lot ${autre} a une décision (${d.fichier}) qui n'est pas consommée.`); console.error('Consommez-la avant d\'ouvrir un nouveau lot : le protocole ne tient qu\'un lot actif.'); process.exit(1); } }
  let rail;
  if (options.rail !== undefined) {
    if (!railSecurise(options.rail)) refuserRail(options.rail);
    const deja = (etatAvant.lots || {})[lot] || {};
    if (deja.rail !== undefined && deja.rail !== options.rail) { console.error(`REFUS — ${lot} déclare déjà le rail ${deja.rail} au registre. Changer de rail est un acte à part : handoff.js declarer-rail ${lot} ${options.rail}`); process.exit(1); }
    rail = options.rail;
  } else rail = exigerRailSecurise(etatAvant, lot);
  const dir = path.join(LOTS, lot); fs.mkdirSync(dir, { recursive: true }); const seq = (dernier(echanges(lot, 'request')) || { seq: 0 }).seq + 1, fichier = `request-${seq}.md`, cible = path.join(dir, fichier); if (fs.existsSync(cible)) { console.error(`${fichier} existe déjà — le registre est append-only.`); process.exit(1); }
  const refs = REFS_PROTEGEES.map(r => `${r}=${git('rev-parse', '--short', `origin/${r}`)}`).join(' '), preuves = [{ id: 'refs-protegees', classe: 'VERIFIED', valeur: refs }].concat(options.preuves); let env = '---\n'; env += `protocol: ${PROTOCOLE}\nkind: request\nlot_id: ${lot}\nseq: ${seq}\n`; env += `author: Claude\nbranch: ${rail}\nstatus: AWAITING_DECISION\ntoken_mode: ${mode}\n`; env += 'preuves:\n'; for (const p of preuves) env += `  - id: ${p.id}\n    classe: ${p.classe}\n    valeur: ${p.valeur}\n`; env += '---\n'; fs.writeFileSync(cible, env + fs.readFileSync(corpsFichier, 'utf8'));
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); etat.lots[lot] = etat.lots[lot] || {}; Object.assign(etat.lots[lot], { statut: 'ATTENTE_DECISION', derniere_demande: fichier, rail }); etat.lot_actif = lot; fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n'); regenererMiroirs(); console.log(`${lot}/${fichier} créé (token_mode ${mode}, ${preuves.length} preuve(s)), miroirs v1 régénérés.`);
}
function refuserRail(rail) {
  console.error(`REFUS — rail non autorisé : ${JSON.stringify(rail)}`);
  console.error(`Un rail vaut ${BRANCHE_HISTORIQUE} ou porte la forme handoff-*, et jamais ${REFS_PROTEGEES.join('/')}.`);
  process.exit(1);
}
// Change le rail d'un lot déjà enregistré. C'est le geste qui remplace la
// variable d'environnement : un rail ne se devine plus, il s'inscrit.
//
// La garde n'est pas « le registre doit être parfait » — il ne l'est
// jamais : un dépôt tiers non conforme, une séquence trouée, une dérogation
// en attente vivent leur vie indépendamment du rail. La garde est « déclarer
// ce rail ne doit RIEN casser » : on valide les enveloppes du lot sous
// l'ancien rail puis sous le nouveau, et on refuse si le changement
// introduit une violation qui n'existait pas. Le compte de violations
// résolues est affiché : un rail qui ne résout rien et ne change rien n'a
// pas à être déclaré.
function declarerRail(lot, rail) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); }
  if (!fs.existsSync(path.join(LOTS, lot))) { console.error(`Lot inconnu : aucun répertoire lots/${lot}`); process.exit(1); }
  if (!fs.existsSync(ETAT)) { console.error('docs/handoff/STATE.json absent.'); process.exit(1); }
  if (rail === undefined) { console.error('Usage : handoff.js declarer-rail <LOT_ID> <rail>'); process.exit(1); }
  if (!railSecurise(rail)) refuserRail(rail);
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  etat.lots = etat.lots || {};
  if (!etat.lots[lot]) { console.error(`REFUS — ${lot} n'est pas enregistré dans STATE.json.lots ; utilisez enregistrer-lot.`); process.exit(1); }
  const ancien = railDuLot(etat, lot);
  if (ancien === rail && etat.lots[lot].rail !== undefined) { console.error(`REFUS — ${lot} déclare déjà ${rail} ; rien à faire.`); process.exit(1); }
  const messages = () => { erreurs.length = 0; avertissements.length = 0; return null; };
  messages(); validerEnveloppesLot(lot, ancien);
  const avant = erreurs.map(e => e.message);
  messages(); validerEnveloppesLot(lot, rail);
  const apres = erreurs.map(e => e.message);
  messages();
  const introduites = apres.filter(m => !avant.includes(m));
  if (introduites.length) {
    console.error(`REFUS — déclarer ${rail} pour ${lot} introduirait ${introduites.length} violation(s) absente(s) sous ${ancien} ; le registre n'est pas modifié.`);
    for (const m of introduites) console.error(`ÉCHEC — ${m}`);
    process.exit(1);
  }
  const resolues = avant.filter(m => !apres.includes(m));
  let resolu = null;
  try { resolu = git('rev-parse', '--short', `origin/${rail}`); } catch (e) {}
  if (!resolu) console.error(`AVERTISSEMENT — origin/${rail} n'est pas résoluble dans ce clone ; la déclaration porte sur un nom, pas sur une ref fetchée.`);
  etat.lots[lot].rail = rail;
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  console.log(`${lot} : rail ${etat.lots[lot].rail === ancien ? ancien : `${ancien} → ${rail}`}${resolu ? ` (origin/${rail}=${resolu})` : ''}, ${resolues.length} violation(s) résolue(s), 0 introduite.`);
  if (apres.length) console.log(`${apres.length} violation(s) subsistent, sans lien avec le rail — handoff.js verifier les détaille.`);
}
// LIRE LE RAIL EST UN GESTE, PAS UNE DÉDUCTION.
//
// 22/09/2026. Depuis le 21/09 le rail est un fait du registre, mais rien ne
// permettait de le LIRE : `declarer-rail` l'écrit, `verifier` le consomme en
// silence. Un appelant extérieur — l'étape d'un workflow qui doit savoir si
// elle tourne sur le rail — n'avait donc d'autre choix que de le redécouvrir
// par lui-même, c'est-à-dire de le deviner. Cinq étapes de tests.yml en sont
// mortes : conditionnées au nom gelé `refs/heads/config-par-environnement`,
// elles ont cessé de s'exécuter le jour où le travail a changé de rail. Elles
// ne rougissaient pas — elles étaient `skipped`, ce qui ne se voit nulle part
// dans un run vert.
//
// Cette commande ne calcule rien et n'écrit rien : elle imprime sur stdout la
// désignation portée par le registre, pour le lot nommé ou, à défaut, pour
// `lot_actif`. Un rail interdit ou illisible sort en erreur plutôt que de
// laisser un appelant bâtir une condition sur une valeur fausse.
function imprimerRail(lot) {
  if (!fs.existsSync(ETAT)) { console.error('docs/handoff/STATE.json absent — aucun rail à lire.'); process.exit(1); }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  const cible = lot || etat.lot_actif;
  if (!cible) { console.error('REFUS — STATE.json ne désigne aucun lot_actif ; nommez le lot : handoff.js rail <LOT_ID>'); process.exit(1); }
  if (!etat.lots || !etat.lots[cible]) { console.error(`REFUS — lot inconnu au registre : ${cible}`); process.exit(1); }
  const rail = railDuLot(etat, cible);
  if (!railSecurise(rail)) { console.error(`REFUS — rail non autorisé pour ${cible} : ${JSON.stringify(rail)}`); process.exit(1); }
  console.log(rail);
}
function veiller(lot, intervalle) { const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')), v = etat.lots[lot] || {}, rail = exigerRailSecurise(etat, lot), avant = dernier(echanges(lot, 'decision')); try { git('fetch', '-q', 'origin', rail); } catch (e) {} const apres = dernier(echanges(lot, 'decision')); if (apres && (!avant || apres.seq > avant.seq)) { console.log(`event detected — ${lot}/${apres.fichier}`); return 0; } if (v.statut === 'ATTENTE_DECISION') { console.log(`session unavailable — aucune décision pour ${lot} ; relance humaine (secours v1) requise après extinction.`); return 0; } console.log(`session resumed — ${lot} au statut ${v.statut}`); return 0; }
// Lecture du registre exposée aux autres outils (ARCH-001 : une vérité métier,
// un propriétaire logique). `outils/reveil-handoff.js` en a besoin pour savoir
// s'il reste une décision à consommer ; réimplémenter la lecture ailleurs
// ferait diverger deux idées de ce qu'est « une décision en attente ».
module.exports = { lots, echanges, dernier, lireEnveloppe, demandeVisee, CHEMINS: { HANDOFF, LOTS, ETAT } };

if (require.main !== module) return;

const [, , commande, arg1, arg2] = process.argv;
switch (commande) {
  case undefined: case 'verifier': process.exit(verifier()); break;
  case 'miroirs': regenererMiroirs(); console.log('Miroirs v1 régénérés.'); break;
  case 'consommer': consommer(arg1); break;
  case 'enregistrer-lot': { const args = process.argv.slice(4); let rail; for (let i = 0; i < args.length; i++) { if (args[i] === '--rail') rail = args[++i]; else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); } } enregistrerLot(arg1, rail); break; }
  case 'declarer-rail': declarerRail(arg1, arg2); break;
  case 'rail': imprimerRail(arg1); break;
  case 'rattraper-demande': rattraperDemande(arg1); break;
  case 'demande': { const args = process.argv.slice(5), preuves = []; let tokenMode = null, rail; for (let i = 0; i < args.length; i++) { if (args[i] === '--preuve') { const m = args[++i].match(/^([a-z0-9-]+):([A-Z_]+):([\s\S]+)$/); if (!m) { console.error(`--preuve mal formée : ${args[i]}`); process.exit(1); } preuves.push({ id: m[1], classe: m[2], valeur: m[3] }); } else if (args[i] === '--token-mode') tokenMode = args[++i]; else if (args[i] === '--rail') rail = args[++i]; else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); } } nouvelleDemande(arg1, arg2, { preuves, tokenMode, rail }); break; }
  case 'decision': { const args = process.argv.slice(5); const o = { closes: undefined }; for (let i = 0; i < args.length; i++) { if (args[i] === '--decision') o.decision = args[++i]; else if (args[i] === '--closes') o.closes = args[++i]; else if (args[i] === '--en-reponse-a') o.enReponseA = path.basename(String(args[++i]).trim()); else if (args[i] === '--auteur') o.auteur = args[++i]; else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); } } nouvelleDecision(arg1, arg2, o); break; }
  case 'veiller': process.exit(veiller(arg1, Number(arg2) || 60)); break;
  default: console.error('Usage : handoff.js [verifier|miroirs|consommer <LOT_ID>|enregistrer-lot <LOT_ID> [--rail R]|declarer-rail <LOT_ID> <rail>|rail [LOT_ID]|rattraper-demande <LOT_ID>|demande <LOT_ID> <corps.md> [--token-mode M] [--rail R] [--preuve id:CLASSE:valeur]…|decision <LOT_ID> <corps.md> --decision V --closes true|false [--en-reponse-a request-N.md] [--auteur X]|veiller <LOT_ID>]'); process.exit(1);
}
