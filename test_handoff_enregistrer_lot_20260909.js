// `handoff.js enregistrer-lot` — combler un trou trouvé le 09/09/2026 sur
// NEXUS-PRODUCTION-READINESS-1-20260908 : ses request-1.md/decision-1.md sont
// des enveloppes conformes, déposées par un commit direct plutôt que par
// `demande`/`decision`, et STATE.json.lots n'en savait rien. Résultat mesuré
// sur le registre réel : `verifier` bloque (LOT_HORS_REGISTRE) et donc
// `consommer` refuse pour TOUT lot, pas seulement celui-ci.
//
// Cette commande n'est pas une dérogation : elle rejoue les mêmes contrôles
// que `verifier` sur le lot avant de l'enregistrer, et refuse s'ils échouent.
// Chaque épreuve mute une seule chose et exige le bon comportement.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'LOT-ENREGISTREMENT-20260909';

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

// Un lot déposé DIRECTEMENT (comme le serait un commit humain) : les fichiers
// existent sous lots/, avec une enveloppe conforme, mais STATE.json.lots ne
// le connaît pas encore — exactement le cas réel trouvé.
function registreAvecLotNonEnregistre({ decision } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-enreg-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'),
    ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, 'seq: 1',
     'author: Frédéric Bragance', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
     'token_mode: STANDARD', 'preuves:',
     '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
     '---', '', 'Corps de la demande, déposé directement.', ''].join('\n'));
  if (decision) {
    fs.writeFileSync(path.join(lot, 'decision-1.md'),
      ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, 'seq: 1',
       'author: Frédéric Bragance', 'branch: config-par-environnement', 'decision: APPROVED',
       'closes: false', 'in_reply_to: request-1.md', '---', '', 'Corps de la décision.', ''].join('\n'));
  }
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: null, lots: {},
  }, null, 2) + '\n');
  return dir;
}

function executer(args, dir) {
  try {
    const sortie = execFileSync('node', [OUTIL, ...args],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

let total = 0, passes = 0;
function verifier(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  OK — ${nom}`); }
  catch (e) { console.error(`  ÉCHEC — ${nom}\n    ${e.message}`); }
}

verifier('un lot conforme mais absent de STATE.json.lots est refusé par verifier (LOT_HORS_REGISTRE)', () => {
  const dir = registreAvecLotNonEnregistre();
  const r = executer(['verifier'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/LOT_HORS_REGISTRE|absent de STATE\.json\.lots/.test(r.sortie), r.sortie);
});

verifier('enregistrer-lot inscrit le lot avec statut ATTENTE_DECISION et derniere_demande', () => {
  const dir = registreAvecLotNonEnregistre();
  const r = executer(['enregistrer-lot', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].statut, 'ATTENTE_DECISION');
  assert.strictEqual(etat.lots[LOT].derniere_demande, 'request-1.md');
  assert.strictEqual(etat.lots[LOT].derniere_decision, undefined, 'derniere_decision ne se pose que par consommer, jamais par enregistrer-lot');
});

verifier('après enregistrer-lot, verifier passe et consommer fonctionne sur une décision déjà déposée', () => {
  const dir = registreAvecLotNonEnregistre({ decision: true });
  let r = executer(['enregistrer-lot', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  r = executer(['verifier'], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  // consommer exige un commit git réel pour le fichier de décision — hors
  // dépôt git, il doit refuser proprement plutôt qu'inventer une trace.
  r = executer(['consommer', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Aucun commit trouvé/.test(r.sortie), r.sortie);
});

verifier('un lot déjà enregistré est refusé (pas de double inscription silencieuse)', () => {
  const dir = registreAvecLotNonEnregistre();
  let r = executer(['enregistrer-lot', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  r = executer(['enregistrer-lot', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/déjà enregistré/.test(r.sortie), r.sortie);
});

verifier('un répertoire absent de lots/ est refusé', () => {
  const dir = registreAvecLotNonEnregistre();
  const r = executer(['enregistrer-lot', 'LOT-INEXISTANT-20260909'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Lot inconnu/.test(r.sortie), r.sortie);
});

verifier('un lot déclaré dans artefacts_hors_registre est refusé (pas les deux statuts à la fois)', () => {
  const dir = registreAvecLotNonEnregistre();
  const p = path.join(dir, 'STATE.json'), etat = JSON.parse(fs.readFileSync(p, 'utf8'));
  etat.artefacts_hors_registre = [{ lot_id: LOT, motif: 'test', autorise_par: 'test', le: '2026-09-09' }];
  fs.writeFileSync(p, JSON.stringify(etat, null, 2) + '\n');
  const r = executer(['enregistrer-lot', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/hors registre/.test(r.sortie), r.sortie);
});

// Mutation négative réelle : une enveloppe non conforme (branche protégée)
// doit être détectée AVANT enregistrement — l'écran d'entrée de
// `enregistrer-lot` ne doit pas être plus laxiste que `verifier`.
verifier('une enveloppe non conforme (branche protégée) est refusée, rien n\'est enregistré', () => {
  const dir = registreAvecLotNonEnregistre();
  const req = path.join(dir, 'lots', LOT, 'request-1.md');
  const mute = fs.readFileSync(req, 'utf8').replace('branch: config-par-environnement', 'branch: main');
  fs.writeFileSync(req, mute);
  const r = executer(['enregistrer-lot', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/BRANCHE_PROTEGEE|est une ref protégée/.test(r.sortie), r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT], undefined, 'un lot refusé ne doit jamais apparaître dans STATE.json.lots');
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
