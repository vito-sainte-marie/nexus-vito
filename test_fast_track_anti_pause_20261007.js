// Fast Track anti-pause — reproduction causale du cas réel request-6.
//
// Le 07/10/2026, `GOUVERNANCE-REFERENCE-CODE-20261005/request-6.md` déclarait
// `wake_to: ChatGPT`, la CI mesurait un rail vert, et pourtant aucune relance
// n'est jamais arrivée sur l'issue #28 : l'étape de publication
// (tests.yml, « Réveil Orchestrateur — publication au destinataire déclaré »)
// n'accepte qu'une adresse `<serveur>/<dépôt>/issues/<numéro>`, et « ChatGPT »
// n'en est pas une. Le réveil restait cantonné au résumé du run — une
// limitation de CANAL confondue, en pratique, avec une absence de relais.
//
// Cette épreuve rejoue EXACTEMENT ce registre (même lot, même `wake_to`, même
// forme de décision dépassée) dans un dépôt jetable, et prouve trois choses :
//   A. sans correction (pas de docs/handoff/CANAUX.json), l'adresse calculée
//      reste « ChatGPT » et NE PASSERAIT PAS le filtre de tests.yml — le bug
//      originel, rejoué, pas supposé ;
//   B. avec la correction, l'adresse calculée est l'URL d'issue résolue et
//      PASSE ce même filtre ;
//   C. une entrée de résolution vide ou absente retombe proprement sur le
//      comportement A, jamais sur une adresse fabriquée.
//
// Et une seconde partie éprouve `outils/classification-canal.js` par mutation
// directe de chacune de ses branches : un STOP fermé gagne toujours contre un
// canal qui marche (jamais de bypass Production via un simple relais), une
// adresse non résolue reste un vrai blocage, et un acteur ne se réveille
// jamais lui-même.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTIL_REVEIL = path.join(RACINE, 'outils', 'reveil-orchestrateur.js');
const LOT = 'LOT-FAST-TRACK-ANTI-PAUSE-20261007';
const ISSUE_URL = 'https://github.com/vito-sainte-marie/nexus-vito/issues/28';

// Le MÊME motif de filtre que tests.yml (`"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY
// /issues/"[0-9]*`), traduit en JS pour rejouer le verdict sans bash ni CI :
// une adresse qui ne commence pas par un hôte GitHub suivi de `/issues/<chiffres>`
// échoue exactement comme l'étape `arret ADRESSE_HORS_DEPOT` du workflow.
const ADRESSE_POSTABLE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/[0-9]+$/;

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.stack || e}`); }
}

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

function demande(seq, wakeTo) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
    'author: Claude', 'branch: handoff-continuite-20260920', 'status: AWAITING_DECISION',
    'token_mode: STANDARD', `wake_to: ${wakeTo}`, 'preuves:', '  - id: refs-protegees',
    '    classe: VERIFIED', `    valeur: ${refsReelles()}`, '---', '',
    '# Demande — reproduction request-6', '', 'Corps de test.', ''].join('\n');
}
// Une décision plus ancienne existe déjà (répond à request-1), la demande
// active est request-2 : exactement la forme DEMANDE_DEPASSEE mesurée sur le
// vrai lot (decision-5 répond à request-5, request-6 est la demande active).
function decisionAncienne() {
  return ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, 'seq: 1',
    'author: ChatGPT', 'branch: handoff-continuite-20260920', 'decision: APPROVED_WITH_CONDITIONS',
    'closes: false', 'in_reply_to: request-1.md', '---', '', 'Corps.', ''].join('\n');
}

/** Monte un registre jetable portant UNE demande active avec `wake_to`, et une
 * décision déjà périmée — la forme exacte du cas réel. `canaux` : contenu à
 * écrire dans CANAUX.json, ou `undefined` pour reproduire l'absence (le bug). */
function registre(wakeTo, canaux) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-track-anti-pause-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'), demande(1, wakeTo));
  fs.writeFileSync(path.join(lot, 'decision-1.md'), decisionAncienne());
  fs.writeFileSync(path.join(lot, 'request-2.md'), demande(2, wakeTo));
  const etat = {
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-2.md',
      rail: 'handoff-continuite-20260920' } },
  };
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(etat, null, 2) + '\n');
  if (canaux !== undefined) {
    fs.writeFileSync(path.join(dir, 'CANAUX.json'), JSON.stringify({ canaux }, null, 2) + '\n');
  }
  return dir;
}

function reveilJSON(dir) {
  const r = spawnSync('node', [OUTIL_REVEIL, '--json'],
    { encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir }, cwd: RACINE });
  assert.strictEqual(r.status, 0, `le réveil ne doit jamais sortir non-zéro :\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

console.log('\nFast Track anti-pause — reproduction causale de request-6\n');

// ── A. LE BUG ORIGINEL, REJOUÉ ──────────────────────────────────────────────
epreuve('A — sans CANAUX.json, "ChatGPT" reste tel quel et échoue au filtre tests.yml (le bug)', () => {
  const dir = registre('ChatGPT', undefined);
  const r = reveilJSON(dir);
  assert.strictEqual(r.reveil, true, JSON.stringify(r));
  const l = r.lots[0];
  assert.strictEqual(l.adresse, 'ChatGPT', JSON.stringify(l));
  assert.strictEqual(l.adresse_resolue, false, JSON.stringify(l));
  assert.ok(!ADRESSE_POSTABLE.test(l.adresse),
    `"${l.adresse}" a été acceptée par le filtre d'adresse de tests.yml — ce n'est pas le bug qu'on rejoue`);
});

// ── B. LA CORRECTION ─────────────────────────────────────────────────────────
epreuve('B — avec CANAUX.json, "ChatGPT" se résout en URL postable et passerait tests.yml', () => {
  const dir = registre('ChatGPT', { ChatGPT: ISSUE_URL, Claude: ISSUE_URL });
  const r = reveilJSON(dir);
  const l = r.lots[0];
  assert.strictEqual(l.adresse, ISSUE_URL, JSON.stringify(l));
  assert.strictEqual(l.adresse_role, 'ChatGPT', JSON.stringify(l));
  assert.strictEqual(l.adresse_resolue, true, JSON.stringify(l));
  assert.ok(ADRESSE_POSTABLE.test(l.adresse),
    `"${l.adresse}" échoue encore au filtre d'adresse de tests.yml après correction`);
});

epreuve('B — le même mécanisme résout "Claude" (sens Orchestrateur → Claude)', () => {
  const dir = registre('Claude', { ChatGPT: ISSUE_URL, Claude: ISSUE_URL });
  const r = reveilJSON(dir);
  const l = r.lots[0];
  assert.strictEqual(l.adresse, ISSUE_URL, JSON.stringify(l));
  assert.strictEqual(l.adresse_role, 'Claude', JSON.stringify(l));
});

// ── C. UNE RÉSOLUTION ABSENTE OU VIDE NE FABRIQUE JAMAIS D'ADRESSE ──────────
epreuve('C — une adresse déjà conforme (URL) traverse inchangée, résolution ou non', () => {
  const dir = registre(ISSUE_URL, { ChatGPT: ISSUE_URL });
  const r = reveilJSON(dir);
  const l = r.lots[0];
  assert.strictEqual(l.adresse, ISSUE_URL, JSON.stringify(l));
  assert.strictEqual(l.adresse_resolue, false, JSON.stringify(l));
});

epreuve('C — une entrée de canal vide retombe sur le rôle brut, jamais sur une adresse fabriquée', () => {
  const dir = registre('ChatGPT', { ChatGPT: '   ' });
  const r = reveilJSON(dir);
  const l = r.lots[0];
  assert.strictEqual(l.adresse, 'ChatGPT', JSON.stringify(l));
  assert.strictEqual(l.adresse_resolue, false, JSON.stringify(l));
});

epreuve('C — un CANAUX.json illisible (JSON cassé) ne fait pas planter le réveil', () => {
  const dir = registre('ChatGPT', undefined);
  fs.writeFileSync(path.join(dir, 'CANAUX.json'), '{ ceci n\'est pas du JSON');
  const r = reveilJSON(dir);
  assert.strictEqual(r.reveil, true, JSON.stringify(r));
  assert.strictEqual(r.lots[0].adresse, 'ChatGPT', JSON.stringify(r.lots[0]));
});

epreuve('C — un rôle non déclaré dans CANAUX.json (ni ChatGPT ni Claude) reste non résolu', () => {
  const dir = registre('Frederic', { ChatGPT: ISSUE_URL });
  const r = reveilJSON(dir);
  const l = r.lots[0];
  assert.strictEqual(l.adresse, 'Frederic', JSON.stringify(l));
  assert.strictEqual(l.adresse_resolue, false, JSON.stringify(l));
});

// ── D. LA FONCTION DE RÉSOLUTION, EN DIRECT ─────────────────────────────────
epreuve('D — resoudreCanal/canauxConnus sont exportés et rejouables hors subprocess', () => {
  const dir = registre('ChatGPT', { ChatGPT: ISSUE_URL });
  const r = spawnSync('node', ['-e',
    `const m = require(${JSON.stringify(OUTIL_REVEIL)}); console.log(JSON.stringify(m.resoudreCanal('ChatGPT')));`],
    { encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir }, cwd: RACINE });
  assert.strictEqual(r.status, 0, r.stderr);
  const sortie = JSON.parse(r.stdout);
  assert.strictEqual(sortie.adresse, ISSUE_URL);
  assert.strictEqual(sortie.resolue, true);
  assert.strictEqual(sortie.role, 'ChatGPT');
});

// ── E. CLASSIFICATION CHANNEL_LIMITATION / BLOCKED_TECHNIQUE ────────────────
console.log('\n── classification-canal.js — chaque branche, par mutation ciblée');
const { classifier, MOTIFS_STOP_FERMES } = require(path.join(RACINE, 'outils', 'classification-canal.js'));

epreuve('E — destinataire déclaré + canal résolu = CHANNEL_LIMITATION (relais, pas STOP)', () => {
  const r = classifier({ acteurCourant: 'Claude', wakeTo: 'ChatGPT', canalResolu: ISSUE_URL });
  assert.strictEqual(r.etat, 'CHANNEL_LIMITATION', JSON.stringify(r));
});

epreuve('E — aucun destinataire déclaré = BLOCKED_TECHNIQUE', () => {
  const r = classifier({ acteurCourant: 'Claude' });
  assert.strictEqual(r.etat, 'BLOCKED_TECHNIQUE', JSON.stringify(r));
  assert.strictEqual(r.motif, 'AUCUN_DESTINATAIRE');
});

epreuve('E — canal non résolu = BLOCKED_TECHNIQUE, jamais un relais fantôme', () => {
  const r = classifier({ acteurCourant: 'Claude', wakeTo: 'ChatGPT' });
  assert.strictEqual(r.etat, 'BLOCKED_TECHNIQUE', JSON.stringify(r));
  assert.strictEqual(r.motif, 'CANAL_NON_RESOLU');
});

epreuve('E — le destinataire déclaré est l’acteur courant = BLOCKED_TECHNIQUE (pas d’auto-réveil)', () => {
  const r = classifier({ acteurCourant: 'Claude', wakeTo: 'Claude', canalResolu: ISSUE_URL });
  assert.strictEqual(r.etat, 'BLOCKED_TECHNIQUE', JSON.stringify(r));
  assert.strictEqual(r.motif, 'DESTINATAIRE_EST_ACTEUR_COURANT');
});

epreuve('E — un STOP de la liste fermée gagne contre un canal qui marche (mutation : chaque motif)', () => {
  for (const motif of MOTIFS_STOP_FERMES) {
    const r = classifier({ acteurCourant: 'Claude', wakeTo: 'ChatGPT', canalResolu: ISSUE_URL, motifStop: motif });
    assert.strictEqual(r.etat, 'BLOCKED_TECHNIQUE', `motif ${motif} a été contourné par un canal résolu : ${JSON.stringify(r)}`);
  }
});

epreuve('E — un motif qui ne figure PAS dans la liste fermée ne bloque pas à tort (pas de faux positif)', () => {
  const r = classifier({ acteurCourant: 'Claude', wakeTo: 'ChatGPT', canalResolu: ISSUE_URL, motifStop: 'CECI_NEST_PAS_UN_STOP' });
  assert.strictEqual(r.etat, 'CHANNEL_LIMITATION', JSON.stringify(r));
});

console.log(`\nFast Track anti-pause — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
