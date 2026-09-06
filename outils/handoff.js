#!/usr/bin/env node
// NEXUS Handoff v2 — registre adressable, enveloppe déterministe, validateur.
//
// POURQUOI CE FICHIER EXISTE. v1 tenait par la discipline de ses deux
// acteurs. L'audit de ses deux seuls lots l'a montré : au commit 67ecdce, le
// dépôt portait une demande S-5 ouverte face à une décision S-4 déjà
// consommée et toujours d'apparence autoritaire ; et `APPROVED_CLOSED`, qui
// ne figure nulle part au protocole, a fermé les deux lots aboutis sans que
// rien ne le remarque. C'est le défaut que la recette a trouvé partout
// ailleurs dans NEXUS — un contrat que seule la bonne conduite fait
// respecter. Ce validateur le transforme en échec de build.
//
// ÉCHEC FERMÉ. Toute ligne d'enveloppe non reconnue est une erreur, jamais un
// silence : ignorer ce qu'on ne comprend pas est exactement la mécanique qui
// a laissé le vocabulaire dériver.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.resolve(__dirname, '..');
// Racine surchargeable : les tests mutationnels éprouvent le validateur sur un
// registre jetable plutôt que sur le vrai, qu'ils salireraient à chaque
// corruption volontaire. Le dépôt Git reste RACINE — les refs protégées se
// lisent toujours au vrai endroit.
const HANDOFF = process.env.NEXUS_HANDOFF_DIR
  ? path.resolve(process.env.NEXUS_HANDOFF_DIR)
  : path.join(RACINE, 'docs', 'handoff');
const LOTS = path.join(HANDOFF, 'lots');
const ETAT = path.join(HANDOFF, 'STATE.json');
const MIROIR_DEMANDE = path.join(HANDOFF, 'CURRENT.md');
const MIROIR_DECISION = path.join(HANDOFF, 'DECISION.md');

// ── Vocabulaire clos ────────────────────────────────────────────────────
const PROTOCOLE = 'nexus-handoff/2';
const BRANCHE_AUTORISEE = 'config-par-environnement';
const REFS_PROTEGEES = ['main', 'production'];
const DECISIONS_CANONIQUES = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'BLOCKED', 'NEEDS_EVIDENCE'];
// `APPROVED_CLOSED` reste LISIBLE pour les décisions S-4 et S-5 déjà rendues.
// Il n'est pas canonique : un fichier du registre v2 qui l'emploie échoue.
// Compatibilité ascendante, sans perpétuer l'ambiguïté de modèle qui mêlait
// l'arbitrage (approuvé ?) et le cycle de vie (le lot est-il clos ?).
const DECISIONS_LEGACY = ['APPROVED_CLOSED'];
const STATUTS_DEMANDE = ['AWAITING_DECISION'];
const TOKEN_MODES = ['LEAN', 'STANDARD', 'DEEP'];
const CLASSES_PREUVE = ['VERIFIED', 'DECLARED', 'HUMAN', 'NOT_APPLICABLE'];
const LOT_ID_VALIDE = /^[A-Z0-9][A-Z0-9-]{2,63}$/;

// ── Journal ─────────────────────────────────────────────────────────────
const erreurs = [];
const avertissements = [];
// Chaque violation porte un CODE et le fichier concerné : c'est ce qui permet
// à une dérogation de viser exactement une règle sur exactement un fichier,
// au lieu de désactiver un contrôle entier.
const bloquant = (m, code, fichier) => erreurs.push({ message: m, code: code || 'AUTRE', fichier: fichier || null });
const avertir = (m) => avertissements.push(m);

// Une dérogation ne peut JAMAIS porter sur un invariant de sécurité. Sans
// cette liste, le mécanisme d'exception deviendrait la porte de sortie qu'il
// est censé ne pas être.
const CODES_NON_DEROGEABLES = ['BRANCHE_PROTEGEE', 'BRANCHE_INATTENDUE', 'REFS_PROTEGEES', 'REFS_ILLISIBLES'];

function git(...args) {
  return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' }).trim();
}

// ── Enveloppe ───────────────────────────────────────────────────────────
// Grammaire volontairement étroite : `clef: valeur`, plus des listes d'objets
// plats sous une clef. Pas de YAML général — un analyseur permissif finirait
// par accepter en silence une enveloppe qu'il n'a pas comprise.
function lireEnveloppe(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8');
  const lignes = brut.split('\n');
  if (lignes[0].trim() !== '---') return { absente: true, corps: brut };
  const fin = lignes.indexOf('---', 1);
  if (fin === -1) return { erreur: 'enveloppe non refermée' };

  const env = {};
  let listeCourante = null;
  let objetCourant = null;

  for (let i = 1; i < fin; i++) {
    const ligne = lignes[i];
    if (!ligne.trim() || /^\s*#/.test(ligne)) continue;

    let m = ligne.match(/^([a-z_]+):\s*(.*)$/);
    if (m) {
      listeCourante = null; objetCourant = null;
      if (m[2] === '') { listeCourante = m[1]; env[m[1]] = []; }
      else env[m[1]] = m[2].trim();
      continue;
    }
    m = ligne.match(/^ {2}- ([a-z_]+):\s*(.+)$/);
    if (m && listeCourante) {
      objetCourant = { [m[1]]: m[2].trim() };
      env[listeCourante].push(objetCourant);
      continue;
    }
    m = ligne.match(/^ {4}([a-z_]+):\s*(.+)$/);
    if (m && objetCourant) { objetCourant[m[1]] = m[2].trim(); continue; }

    return { erreur: `ligne d'enveloppe non reconnue (${i + 1}) : ${JSON.stringify(ligne)}` };
  }
  return { env, corps: lignes.slice(fin + 1).join('\n') };
}

// Normalisation legacy — EN MÉMOIRE seulement. Les fichiers historiques ne
// sont jamais réécrits : leur sens est celui qu'ils avaient quand ils ont été
// rendus.
function normaliserDecision(valeur) {
  if (valeur === 'APPROVED_CLOSED') return { decision: 'APPROVED', closes: true, legacy: true };
  return { decision: valeur, legacy: false };
}

// ── Registre ────────────────────────────────────────────────────────────
function lots() {
  if (!fs.existsSync(LOTS)) return [];
  return fs.readdirSync(LOTS).filter(d => fs.statSync(path.join(LOTS, d)).isDirectory()).sort();
}

function echanges(lot, genre) {
  const dir = path.join(LOTS, lot);
  if (!fs.existsSync(dir)) return [];
  const prefixe = genre === 'request' ? 'request-' : 'decision-';
  return fs.readdirSync(dir)
    .filter(f => f.startsWith(prefixe) && f.endsWith('.md'))
    .map(f => ({ fichier: f, seq: parseInt(f.slice(prefixe.length, -3), 10) }))
    .filter(e => Number.isInteger(e.seq) && e.seq > 0)
    .sort((a, b) => a.seq - b.seq);
}

const dernier = (liste) => (liste.length ? liste[liste.length - 1] : null);

// ── Validation ──────────────────────────────────────────────────────────
function validerCommuns(lot, e, env, genre) {
  const ou = `${lot}/${e.fichier}`;
  if (env.protocol !== PROTOCOLE) bloquant(`${ou} : protocol doit valoir ${PROTOCOLE}, trouvé ${JSON.stringify(env.protocol)}`);
  if (env.kind !== genre) bloquant(`${ou} : kind doit valoir ${genre}, trouvé ${JSON.stringify(env.kind)}`);
  if (env.lot_id !== lot) bloquant(`${ou} : lot_id ${JSON.stringify(env.lot_id)} ne correspond pas au répertoire ${lot}`);
  if (String(env.seq) !== String(e.seq)) bloquant(`${ou} : seq ${JSON.stringify(env.seq)} ne correspond pas au nom de fichier`);
  if (!env.author) bloquant(`${ou} : author manquant`);
  // Invariant de sécurité : jamais un avertissement. Une enveloppe qui
  // déclare travailler sur une ref protégée est refusée, quoi qu'elle dise
  // par ailleurs.
  // Trois cas distincts, et non deux. Le garde confondait « branche absente »
  // et « branche inattendue », donc il traitait une OMISSION comme une
  // revendication de travailler sur une ref protégée — et la rendait
  // indérogeable. Déclarer `production` reste absolument bloqué ; ne rien
  // déclarer est un défaut de forme.
  if (REFS_PROTEGEES.includes(env.branch)) bloquant(`${ou} : branch ${env.branch} est une ref protégée — refus`, 'BRANCHE_PROTEGEE', e.fichier);
  else if (env.branch === undefined) bloquant(`${ou} : branch manquante — l'enveloppe doit déclarer ${BRANCHE_AUTORISEE}`, 'BRANCHE_ABSENTE', e.fichier);
  else if (env.branch !== BRANCHE_AUTORISEE) bloquant(`${ou} : branch doit valoir ${BRANCHE_AUTORISEE}, trouvé ${JSON.stringify(env.branch)}`, 'BRANCHE_INATTENDUE', e.fichier);
}

function validerPreuves(ou, preuves) {
  if (!preuves) return;
  if (!Array.isArray(preuves)) { bloquant(`${ou} : preuves doit être une liste`); return; }
  for (const p of preuves) {
    if (!p.id) bloquant(`${ou} : une preuve sans id`);
    if (!CLASSES_PREUVE.includes(p.classe)) {
      bloquant(`${ou} : preuve ${p.id} — classe ${JSON.stringify(p.classe)} hors vocabulaire (${CLASSES_PREUVE.join('|')})`);
    }
  }
}

// La seule preuve recalculée qui BLOQUE : l'état des refs protégées. Q11
// autorise l'observation sur les métriques, jamais sur un invariant de
// protection Production.
function verifierRefsProtegees(ou, valeur) {
  let reelles;
  try {
    reelles = REFS_PROTEGEES.map(r => `${r}=${git('rev-parse', '--short', `origin/${r}`)}`).join(' ');
  } catch (err) {
    bloquant(`${ou} : impossible de lire les refs protégées (${REFS_PROTEGEES.join(', ')}) — un invariant de sécurité invérifiable est un échec, pas un avertissement.`, 'REFS_ILLISIBLES');
    return;
  }
  if (valeur.trim() !== reelles) {
    bloquant(`${ou} : refs protégées déclarées ${JSON.stringify(valeur.trim())}, constatées ${JSON.stringify(reelles)}`, 'REFS_PROTEGEES');
  }
}

function validerRegistre() {
  for (const lot of lots()) {
    if (!LOT_ID_VALIDE.test(lot)) { bloquant(`lots/${lot} : LOT_ID malformé`); continue; }

    const demandes = echanges(lot, 'request');
    const decisions = echanges(lot, 'decision');
    if (!demandes.length) bloquant(`lots/${lot} : aucun request-N.md`);

    // Séquence contiguë : un trou signalerait un échange effacé, ce que le
    // registre append-only est censé rendre impossible.
    demandes.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des demandes non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', e.fichier); });
    decisions.forEach((e, i) => { if (e.seq !== i + 1) bloquant(`lots/${lot} : séquence des décisions non contiguë (${e.fichier})`, 'SEQUENCE_NON_CONTIGUE', e.fichier); });

    for (const e of demandes) {
      const ou = `${lot}/${e.fichier}`;
      const r = lireEnveloppe(path.join(LOTS, lot, e.fichier));
      if (r.erreur) { bloquant(`${ou} : ${r.erreur}`); continue; }
      if (r.absente) { bloquant(`${ou} : enveloppe absente`); continue; }
      const env = r.env;
      validerCommuns(lot, e, env, 'request');
      if (!STATUTS_DEMANDE.includes(env.status)) bloquant(`${ou} : status ${JSON.stringify(env.status)} hors vocabulaire (${STATUTS_DEMANDE.join('|')})`);
      if (!TOKEN_MODES.includes(env.token_mode)) bloquant(`${ou} : token_mode ${JSON.stringify(env.token_mode)} hors vocabulaire (${TOKEN_MODES.join('|')})`);
      validerPreuves(ou, env.preuves);
      const refs = (env.preuves || []).find(p => p.id === 'refs-protegees');
      if (refs) verifierRefsProtegees(ou, refs.valeur || '');
    }

    const reponses = [];
    for (const e of decisions) {
      const ou = `${lot}/${e.fichier}`;
      const r = lireEnveloppe(path.join(LOTS, lot, e.fichier));
      if (r.erreur) { bloquant(`${ou} : ${r.erreur}`); continue; }
      if (r.absente) { bloquant(`${ou} : enveloppe absente`); continue; }
      const env = r.env;
      validerCommuns(lot, e, env, 'decision');

      if (DECISIONS_LEGACY.includes(env.decision)) {
        bloquant(`${ou} : ${env.decision} est une valeur legacy, lisible dans l'historique v1 mais interdite dans le registre v2 — employer decision + closes.`);
      } else if (!DECISIONS_CANONIQUES.includes(env.decision)) {
        bloquant(`${ou} : decision ${JSON.stringify(env.decision)} hors vocabulaire (${DECISIONS_CANONIQUES.join('|')})`, 'DECISION_HORS_VOCABULAIRE', e.fichier);
      }
      if (!['true', 'false'].includes(String(env.closes))) bloquant(`${ou} : closes doit valoir true ou false`);

      // Le défaut n°1 de v1 : une décision qui répond à une demande qui n'est
      // plus la demande active.
      if (!env.in_reply_to) bloquant(`${ou} : in_reply_to manquant`, 'IN_REPLY_TO_MANQUANT', e.fichier);
      else {
        // La forme attendue est le nom de fichier nu (`request-N.md`). Un
        // chemin qui désigne le même fichier est normalisé : c'est de la
        // manipulation de chemin, pas du vocabulaire — l'accepter n'ouvre
        // aucune ambiguïté de modèle. PROTOCOL.md ne le disait pas ; il le dit
        // désormais.
        const vise = path.basename(String(env.in_reply_to).trim());
        const cible = demandes.find(d => d.fichier === vise);
        if (!cible) bloquant(`${ou} : in_reply_to ${JSON.stringify(env.in_reply_to)} ne désigne aucune demande de ce lot`, 'IN_REPLY_TO_INCONNU', e.fichier);
        else {
          // Corrigé le 05/09/2026. La règle exigeait que TOUTE décision vise
          // la demande la plus récente. Elle rendait fausse, rétroactivement,
          // une décision légitimement rendue sur une demande antérieure : au
          // dépôt de request-2, decision-1 devenait « périmée » alors qu'elle
          // avait répondu à ce qui était alors la demande active.
          //
          // Ce qu'on peut vérifier depuis les fichiers seuls : une décision ne
          // répond jamais à une demande PLUS ANCIENNE que son propre rang, et
          // deux décisions ne répondent pas à la même demande. La fraîcheur,
          // elle, ne se contrôle qu'au moment de consommer — c'est là qu'elle
          // compte.
          reponses.push({ decision: e, viseSeq: cible.seq });
          if (cible.seq < e.seq) {
            bloquant(`${ou} : in_reply_to désigne ${vise} (rang ${cible.seq}), antérieur au rang de la décision (${e.seq})`, 'IN_REPLY_TO_ANTERIEUR', e.fichier);
          }
        }
      }
    }

    for (let i = 1; i < reponses.length; i++) {
      if (reponses[i].viseSeq <= reponses[i - 1].viseSeq) {
        bloquant(`lots/${lot} : ${reponses[i].decision.fichier} répond à une demande déjà arbitrée par ${reponses[i - 1].decision.fichier}`,
          'DEMANDE_DEJA_ARBITREE', reponses[i].decision.fichier);
      }
    }

    if (decisions.length > demandes.length) bloquant(`lots/${lot} : plus de décisions que de demandes`);
  }
}

// ── STATE.json ──────────────────────────────────────────────────────────
function validerEtat() {
  if (!fs.existsSync(ETAT)) { bloquant('docs/handoff/STATE.json absent'); return null; }
  let etat;
  try { etat = JSON.parse(fs.readFileSync(ETAT, 'utf8')); }
  catch (e) { bloquant(`STATE.json illisible : ${e.message}`); return null; }

  if (etat.protocol !== PROTOCOLE) bloquant(`STATE.json : protocol doit valoir ${PROTOCOLE}`);
  if (!etat.lots || typeof etat.lots !== 'object') { bloquant('STATE.json : lots manquant'); return etat; }

  // Un seul lot actif pour cette version — règle explicite, contrôlée. Le
  // format reste une table par lot_id : ouvrir plusieurs lots plus tard ne
  // demandera pas de changer la forme du fichier.
  const actifs = Object.entries(etat.lots).filter(([, v]) => v.statut === 'ATTENTE_DECISION').map(([k]) => k);
  if (actifs.length > 1) bloquant(`STATE.json : ${actifs.length} lots en attente (${actifs.join(', ')}) — un seul lot actif dans cette version`);
  if (etat.lot_actif && !etat.lots[etat.lot_actif]) bloquant(`STATE.json : lot_actif ${etat.lot_actif} absent de lots`);

  for (const [lot, v] of Object.entries(etat.lots)) {
    const demandes = echanges(lot, 'request');
    const decisions = echanges(lot, 'decision');
    if (v.derniere_demande) {
      if (!demandes.find(d => d.fichier === v.derniere_demande)) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} absente du registre`);
      else if (v.derniere_demande !== dernier(demandes).fichier) bloquant(`STATE.json : ${lot}.derniere_demande ${v.derniere_demande} n'est pas la plus récente (${dernier(demandes).fichier})`);
    }
    if (v.derniere_decision && v.source_decision === 'registre') {
      if (!decisions.find(d => d.fichier === v.derniere_decision)) bloquant(`STATE.json : ${lot}.derniere_decision ${v.derniere_decision} absente du registre`);
    }
    if (v.consomme_le && !v.commit_decision) bloquant(`STATE.json : ${lot} marqué consommé sans commit_decision`);
    if (!['ATTENTE_DECISION', 'DECISION_CONSOMMEE', 'CLOS'].includes(v.statut)) bloquant(`STATE.json : ${lot}.statut ${JSON.stringify(v.statut)} hors vocabulaire`);
  }
  if (etat.derogations !== undefined) {
    if (!Array.isArray(etat.derogations)) bloquant('STATE.json : derogations doit être une liste');
    else for (const d of etat.derogations) {
      for (const champ of ['fichier', 'regle', 'motif', 'autorise_par', 'le']) {
        if (!d[champ]) bloquant(`STATE.json : dérogation incomplète — ${champ} manquant`);
      }
      if (CODES_NON_DEROGEABLES.includes(d.regle)) {
        bloquant(`STATE.json : ${d.regle} est un invariant de sécurité — aucune dérogation n'est recevable`);
      }
    }
  }
  return etat;
}

// ── Miroirs v1 ──────────────────────────────────────────────────────────
// Ils restent utilisables tels quels par un lecteur qui ne connaît que v1,
// mais ne sont plus la source : l'en-tête le dit, pour que personne n'aille
// les éditer en croyant agir sur le protocole.
function enTeteMiroir(source) {
  return `<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/${source}\n` +
         `     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->\n`;
}

function regenererMiroirs() {
  const etat = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT, 'utf8')) : { lots: {} };
  const lot = etat.lot_actif;
  if (!lot) return;
  const d = dernier(echanges(lot, 'request'));
  if (d) {
    const src = path.join('lots', lot, d.fichier);
    fs.writeFileSync(MIROIR_DEMANDE, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, d.fichier), 'utf8'));
  }
  const dec = dernier(echanges(lot, 'decision'));
  // Sans décision v2 pour ce lot, DECISION.md n'est PAS régénéré : écraser
  // l'arbitrage v1 encore en place le ferait disparaître sans trace.
  if (dec) {
    const src = path.join('lots', lot, dec.fichier);
    fs.writeFileSync(MIROIR_DECISION, enTeteMiroir(src) + fs.readFileSync(path.join(LOTS, lot, dec.fichier), 'utf8'));
  }
}

// ── Consommation ────────────────────────────────────────────────────────
function consommer(lot) {
  // v2 initiale : `consommer` n'appelait pas le validateur. On pouvait donc
  // enregistrer la consommation d'une décision que le protocole refuse — soit
  // exactement le silence que ce protocole existe pour supprimer.
  if (verifier() !== 0) {
    console.error('\nREFUS — le registre ne valide pas ; aucune décision ne peut être consommée dans cet état.');
    process.exit(1);
  }
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  const v = etat.lots[lot];
  if (!v) { console.error(`Lot ${lot} inconnu.`); process.exit(1); }

  const dec = dernier(echanges(lot, 'decision'));
  // C'est ICI que la fraîcheur compte : consommer une décision qui ne répond
  // pas à la demande active, c'est exactement la fenêtre du commit 67ecdce.
  if (dec) {
    const demandes = echanges(lot, 'request');
    const r = lireEnveloppe(path.join(LOTS, lot, dec.fichier));
    const vise = r.env && r.env.in_reply_to ? path.basename(String(r.env.in_reply_to).trim()) : null;
    const active = dernier(demandes);
    if (active && vise !== active.fichier) {
      console.error(`REFUS — ${dec.fichier} répond à ${vise}, mais la demande active est ${active.fichier}.`);
      console.error('Une décision périmée ne se consomme pas : une décision sur la demande active doit être rendue.');
      process.exit(1);
    }
  }
  const source = dec ? 'registre' : 'legacy';
  const cible = path.relative(RACINE, dec ? path.join(LOTS, lot, dec.fichier) : MIROIR_DECISION);
  let commit;
  try { commit = git('log', '-1', '--format=%H', '--', cible); } catch (e) { commit = ''; }
  if (!commit) { console.error(`Aucun commit trouvé pour ${cible} — refus de marquer une consommation invérifiable.`); process.exit(1); }

  // Preuve 5 : une décision déjà consommée ne se rejoue pas en silence.
  if (v.consomme_le && v.commit_decision === commit) {
    console.error(`REFUS — la décision ${commit.slice(0, 7)} du lot ${lot} est déjà marquée consommée le ${v.consomme_le}.`);
    console.error('Une nouvelle décision doit être rendue avant de poursuivre.');
    process.exit(1);
  }

  v.statut = 'DECISION_CONSOMMEE';
  v.derniere_decision = dec ? dec.fichier : null;
  v.source_decision = source;
  v.commit_decision = commit;
  v.consomme_le = new Date().toISOString();
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  console.log(`Décision ${commit.slice(0, 7)} (${source}) marquée consommée pour ${lot}.`);
}

// ── Création d'une demande ──────────────────────────────────────────────
// L'enveloppe est FABRIQUÉE, jamais recopiée à la main : c'est ce qui rend sa
// justesse structurelle. La preuve `refs-protegees` est calculée ici même, de
// sorte qu'elle ne peut pas être déclarée fausse par distraction.
function nouvelleDemande(lot, corpsFichier, options) {
  if (!LOT_ID_VALIDE.test(lot)) { console.error(`LOT_ID malformé : ${lot}`); process.exit(1); }
  if (!fs.existsSync(corpsFichier)) { console.error(`Corps introuvable : ${corpsFichier}`); process.exit(1); }
  const mode = options.tokenMode || 'STANDARD';
  if (!TOKEN_MODES.includes(mode)) { console.error(`token_mode inconnu : ${mode} (${TOKEN_MODES.join('|')})`); process.exit(1); }

  const dir = path.join(LOTS, lot);
  fs.mkdirSync(dir, { recursive: true });
  const seq = (dernier(echanges(lot, 'request')) || { seq: 0 }).seq + 1;
  const fichier = `request-${seq}.md`;
  const cible = path.join(dir, fichier);
  if (fs.existsSync(cible)) { console.error(`${fichier} existe déjà — le registre est append-only.`); process.exit(1); }

  const refs = REFS_PROTEGEES.map(r => `${r}=${git('rev-parse', '--short', `origin/${r}`)}`).join(' ');
  const preuves = [{ id: 'refs-protegees', classe: 'VERIFIED', valeur: refs }].concat(options.preuves);

  let env = '---\n';
  env += `protocol: ${PROTOCOLE}\nkind: request\nlot_id: ${lot}\nseq: ${seq}\n`;
  env += `author: Claude\nbranch: ${BRANCHE_AUTORISEE}\nstatus: AWAITING_DECISION\ntoken_mode: ${mode}\n`;
  env += 'preuves:\n';
  for (const p of preuves) env += `  - id: ${p.id}\n    classe: ${p.classe}\n    valeur: ${p.valeur}\n`;
  env += '---\n';

  fs.writeFileSync(cible, env + fs.readFileSync(corpsFichier, 'utf8'));

  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  etat.lots[lot] = etat.lots[lot] || {};
  Object.assign(etat.lots[lot], { statut: 'ATTENTE_DECISION', derniere_demande: fichier });
  etat.lot_actif = lot;
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');

  regenererMiroirs();
  console.log(`${lot}/${fichier} créé (token_mode ${mode}, ${preuves.length} preuve(s)), miroirs v1 régénérés.`);
}

// ── Couche session ──────────────────────────────────────────────────────
// Vocabulaire imposé par la décision. `session unavailable` n'est PAS un
// échec : c'est l'aveu que rien ne réveille une session éteinte tant qu'un
// orchestrateur externe n'existe pas. Ne pas simuler cette capacité.
function veiller(lot, intervalle) {
  const etat = JSON.parse(fs.readFileSync(ETAT, 'utf8'));
  const v = etat.lots[lot] || {};
  const avant = dernier(echanges(lot, 'decision'));
  try { git('fetch', '-q', 'origin', BRANCHE_AUTORISEE); } catch (e) { /* hors ligne : on rendra compte plus bas */ }
  const apres = dernier(echanges(lot, 'decision'));
  if (apres && (!avant || apres.seq > avant.seq)) { console.log(`event detected — ${lot}/${apres.fichier}`); return 0; }
  if (v.statut === 'ATTENTE_DECISION') { console.log(`session unavailable — aucune décision pour ${lot} ; relance humaine (secours v1) requise après extinction.`); return 0; }
  console.log(`session resumed — ${lot} au statut ${v.statut}`);
  return 0;
}

// ── Entrée ──────────────────────────────────────────────────────────────
function verifier() {
  validerRegistre();
  const etat = validerEtat();

  // Écart de suite : avertissement pendant le lot d'observation (Q11).
  if (etat && etat.lot_actif) {
    const d = dernier(echanges(etat.lot_actif, 'request'));
    if (d) {
      const r = lireEnveloppe(path.join(LOTS, etat.lot_actif, d.fichier));
      const p = ((r.env && r.env.preuves) || []).find(x => x.id === 'suite');
      const sortie = process.env.NEXUS_SORTIE_SUITE;
      if (p && sortie && fs.existsSync(sortie)) {
        const m = fs.readFileSync(sortie, 'utf8').match(/(\d+)\/(\d+) tests passent/);
        if (m && p.valeur.trim() !== `${m[1]}/${m[2]}`) {
          avertir(`suite déclarée ${p.valeur.trim()}, mesurée ${m[1]}/${m[2]} — lot d'observation : avertissement, pas blocage.`);
        }
      }
    }
  }

  // Dérogations : une violation nommément couverte devient un avertissement
  // PERMANENT et bruyant. Elle n'est pas effacée — elle est assumée, datée et
  // attribuée. C'est la différence entre une exception auditable et un
  // contrôle qu'on aurait discrètement désactivé.
  const derogations = (etat && Array.isArray(etat.derogations)) ? etat.derogations : [];
  const restantes = [];
  for (const e of erreurs) {
    const d = derogations.find(x => x.fichier === e.fichier && x.regle === e.code);
    if (d && CODES_NON_DEROGEABLES.includes(e.code)) {
      restantes.push({ ...e, message: `${e.message}\n         (une dérogation existe mais ${e.code} est un invariant de sécurité : elle ne s'applique pas)` });
    } else if (d) {
      avertir(`DÉROGATION ${d.regle} sur ${d.fichier} — ${e.message}\n         motif : ${d.motif}\n         autorisée par ${d.autorise_par}, le ${d.le}`);
    } else restantes.push(e);
  }

  for (const a of avertissements) console.log(`AVERTISSEMENT — ${a}`);
  if (restantes.length) {
    for (const e of restantes) console.error(`ÉCHEC — ${e.message}`);
    console.error(`\n${restantes.length} violation(s) du protocole Handoff v2.`);
    return 1;
  }
  console.log(`Handoff v2 : registre, enveloppes et STATE.json conformes (${lots().length} lot(s), ${avertissements.length} avertissement(s), ${derogations.length} dérogation(s)).`);
  return 0;
}

const [, , commande, arg1, arg2] = process.argv;
switch (commande) {
  case undefined:
  case 'verifier': process.exit(verifier()); break;
  case 'miroirs': regenererMiroirs(); console.log('Miroirs v1 régénérés.'); break;
  case 'consommer': consommer(arg1); break;
  case 'demande': {
    // --preuve id:CLASSE:valeur, répétable ; --token-mode LEAN|STANDARD|DEEP
    const args = process.argv.slice(5); // [node, script, 'demande', <LOT_ID>, <corps>, …options]
    const preuves = [];
    let tokenMode = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--preuve') {
        const m = args[++i].match(/^([a-z0-9-]+):([A-Z_]+):([\s\S]+)$/);
        if (!m) { console.error(`--preuve mal formée : ${args[i]}`); process.exit(1); }
        preuves.push({ id: m[1], classe: m[2], valeur: m[3] });
      } else if (args[i] === '--token-mode') tokenMode = args[++i];
      else { console.error(`Option inconnue : ${args[i]}`); process.exit(1); }
    }
    nouvelleDemande(arg1, arg2, { preuves, tokenMode });
    break;
  }
  case 'veiller': process.exit(veiller(arg1, Number(arg2) || 60)); break;
  default:
    console.error('Usage : handoff.js [verifier|miroirs|consommer <LOT_ID>|demande <LOT_ID> <corps.md> [--token-mode M] [--preuve id:CLASSE:valeur]…|veiller <LOT_ID>]');
    process.exit(1);
}
