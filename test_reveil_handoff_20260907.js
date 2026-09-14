// Épreuve du réveil automatique (outils/reveil-handoff.js).
//
// L'enjeu n'est pas qu'il dise « réveil » — un outil qui répond toujours oui
// serait vert sur le cas utile et transformerait le cron en réveil horaire
// pour rien. L'enjeu est qu'il DISTINGUE : une décision à consommer réveille,
// une décision périmée non (`consommer` la refuserait, le run échouerait à
// coup sûr), un registre absent ou corrompu non plus.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'reveil-handoff.js');
const LOT = 'LOT-REVEIL-20260907';
let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

function demande(seq) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
    'author: Claude', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
    'token_mode: STANDARD', 'preuves:', '  - id: refs-protegees', '    classe: VERIFIED',
    `    valeur: ${refsReelles()}`, '---', '', 'Corps.', ''].join('\n');
}
function decision(seq, repondA) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, `seq: ${seq}`,
    'author: ChatGPT', 'branch: config-par-environnement', 'decision: APPROVED', 'closes: false',
    `in_reply_to: ${repondA}`, '---', '', 'Corps.', ''].join('\n');
}

// Registre jetable : une demande, une décision, et un STATE.json qui déclare
// la décision DÉJÀ consommée — donc « rien à faire » par défaut. Chaque
// épreuve n'en change qu'une chose.
function registre(muter) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reveil-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'), demande(1));
  fs.writeFileSync(path.join(lot, 'decision-1.md'), decision(1, 'request-1.md'));
  const etat = {
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-1.md',
      derniere_decision: 'decision-1.md', source_decision: 'registre',
      commit_decision: 'f'.repeat(40), consomme_le: '2026-09-07T00:00:00.000Z' } },
  };
  if (muter) muter(etat, lot);
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(etat, null, 2) + '\n');
  return dir;
}

function lancer(dir, extra) {
  const env = { ...process.env, NEXUS_HANDOFF_DIR: dir, ...(extra || {}) };
  const r = spawnSync('node', [OUTIL, '--json'], { encoding: 'utf8', env, cwd: RACINE });
  assert.strictEqual(r.status, 0, 'le réveil ne doit JAMAIS sortir non-zéro : ' + r.stderr);
  return JSON.parse(r.stdout);
}

verifier('un registre à jour ne réveille personne', () => {
  const r = lancer(registre());
  assert.strictEqual(r.reveil, false);
  assert.strictEqual(r.motif, 'RIEN_A_FAIRE');
});

verifier('une décision déposée et non consommée réveille', () => {
  const dir = registre((etat, lot) => {
    fs.writeFileSync(path.join(lot, 'request-2.md'), demande(2));
    fs.writeFileSync(path.join(lot, 'decision-2.md'), decision(2, 'request-2.md'));
    etat.lots[LOT].statut = 'ATTENTE_DECISION';
    etat.lots[LOT].derniere_demande = 'request-2.md';
  });
  const r = lancer(dir);
  assert.strictEqual(r.reveil, true, JSON.stringify(r, null, 2));
  assert.strictEqual(r.motif, 'DECISION_NON_CONSOMMEE');
  assert.strictEqual(r.lot, LOT);
  assert.strictEqual(r.lots[0].decision, 'decision-2.md');
});

verifier('une décision PÉRIMÉE ne réveille pas — le run échouerait à coup sûr', () => {
  // Le cas réel du 07/09 : decision-3 répondait à request-3, request-4 était
  // déjà publiée. `handoff.js consommer` refuse ce cas. Réveiller Claude
  // produirait un run condamné, et GOV-001 interdit de le rejouer ensuite.
  const dir = registre((etat, lot) => {
    fs.writeFileSync(path.join(lot, 'request-2.md'), demande(2));
    etat.lots[LOT].statut = 'ATTENTE_DECISION';
    etat.lots[LOT].derniere_demande = 'request-2.md';
    etat.lots[LOT].derniere_decision = null;
    delete etat.lots[LOT].consomme_le;
  });
  const r = lancer(dir);
  assert.strictEqual(r.reveil, false, 'ne doit PAS réveiller : ' + JSON.stringify(r, null, 2));
  assert.strictEqual(r.motif, 'DECISION_PERIMEE');
  assert.strictEqual(r.lots[0].repond_a, 'request-1.md');
  assert.strictEqual(r.lots[0].demande_active, 'request-2.md');
});

verifier('un STATE.json absent ne réveille pas et ne plante pas', () => {
  const dir = registre();
  fs.unlinkSync(path.join(dir, 'STATE.json'));
  const r = lancer(dir);
  assert.strictEqual(r.reveil, false);
  assert.strictEqual(r.motif, 'REGISTRE_ABSENT');
});

verifier('un STATE.json corrompu ne réveille pas', () => {
  // Un réveil déclenché sur un registre illisible enverrait Claude travailler
  // sans savoir sur quoi. Fail-closed, comme le reste.
  const dir = registre();
  fs.writeFileSync(path.join(dir, 'STATE.json'), '{ ceci n est pas du json');
  const r = lancer(dir);
  assert.strictEqual(r.reveil, false);
  assert.strictEqual(r.motif, 'REGISTRE_ILLISIBLE');
});

verifier('la sortie GitHub Actions est écrite, et dit la même chose que le JSON', () => {
  const dir = registre((etat, lot) => {
    fs.writeFileSync(path.join(lot, 'request-2.md'), demande(2));
    fs.writeFileSync(path.join(lot, 'decision-2.md'), decision(2, 'request-2.md'));
    etat.lots[LOT].statut = 'ATTENTE_DECISION';
    etat.lots[LOT].derniere_demande = 'request-2.md';
  });
  const sortie = path.join(dir, 'sortie-actions.txt');
  fs.writeFileSync(sortie, '');
  const r = lancer(dir, { GITHUB_OUTPUT: sortie });
  const contenu = fs.readFileSync(sortie, 'utf8');
  assert.ok(/^reveil=true$/m.test(contenu), 'sortie Actions : ' + contenu);
  assert.ok(new RegExp(`^lot=${LOT}$`, 'm').test(contenu), contenu);
  assert.strictEqual(r.reveil, true, 'le JSON et la sortie Actions ne doivent jamais diverger');
});

verifier('un lot sans aucune décision est ignoré, pas signalé', () => {
  const dir = registre((etat, lot) => {
    fs.unlinkSync(path.join(lot, 'decision-1.md'));
    etat.lots[LOT].statut = 'ATTENTE_DECISION';
    etat.lots[LOT].derniere_decision = null;
    delete etat.lots[LOT].consomme_le;
  });
  const r = lancer(dir);
  assert.strictEqual(r.reveil, false);
  assert.strictEqual(r.motif, 'RIEN_A_FAIRE');
  assert.strictEqual(r.lots.length, 0, 'un lot qui attend une décision n’est pas un lot à réveiller');
});

console.log(`\n${passes}/${passes} vérifications passées — le cron ne réveillera que pour du travail réel.`);
