// `handoff.js rattraper-demande` — combler un trou trouvé le 09/09/2026 sur
// NEXUS-PRODUCTION-READINESS-1-20260908 : un nouveau request-N.md déposé
// directement par commit (Frédéric ou l'Orchestrator) sur un lot DÉJÀ inscrit
// dans STATE.json.lots, sans que `derniere_demande` ne soit mise à jour.
// Résultat mesuré sur le registre réel : `verifier` bloque et donc
// `consommer` refuse pour TOUT lot, pas seulement celui-ci.
//
// Cette commande n'est pas une dérogation : elle rejoue les mêmes contrôles
// d'enveloppe que `verifier` avant de rattraper, et ne touche jamais
// `derniere_decision`/`commit_decision`/`consomme_le`/`statut` — ces champs
// restent exclusivement la responsabilité de `consommer`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'LOT-RATTRAPAGE-20260909';

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

function enveloppeRequest(seq, extra) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
    `author: ${extra && extra.author || 'Frédéric Bragance'}`, `branch: ${extra && extra.branch || 'config-par-environnement'}`,
    'status: AWAITING_DECISION', 'token_mode: STANDARD', 'preuves:',
    '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
    '---', '', `Corps de la demande ${seq}, déposée directement.`, ''].join('\n');
}

// Un lot déjà connu de STATE.json.lots (comme après un premier `demande`),
// puis un second request-N.md déposé directement par commit — exactement le
// cas réel : le registre ignore encore son existence.
function registreAvecDemandeEnRetard() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-rattr-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'), enveloppeRequest(1));
  fs.writeFileSync(path.join(lot, 'request-2.md'), enveloppeRequest(2));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' } },
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

verifier('derniere_demande en retard est refusée par verifier', () => {
  const dir = registreAvecDemandeEnRetard();
  const r = executer(['verifier'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/n'est pas la plus récente/.test(r.sortie), r.sortie);
});

verifier('rattraper-demande met à jour derniere_demande sans toucher au statut', () => {
  const dir = registreAvecDemandeEnRetard();
  const r = executer(['rattraper-demande', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].derniere_demande, 'request-2.md');
  assert.strictEqual(etat.lots[LOT].statut, 'ATTENTE_DECISION', 'le statut n\'est jamais la responsabilité de rattraper-demande');
  assert.strictEqual(etat.lots[LOT].derniere_decision, undefined, 'derniere_decision ne se pose que par consommer');
});

verifier('après rattraper-demande, verifier passe', () => {
  const dir = registreAvecDemandeEnRetard();
  let r = executer(['rattraper-demande', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  r = executer(['verifier'], dir);
  assert.strictEqual(r.code, 0, r.sortie);
});

verifier('un lot absent de STATE.json.lots est refusé (utiliser enregistrer-lot, pas rattraper-demande)', () => {
  const dir = registreAvecDemandeEnRetard();
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  delete etat.lots[LOT];
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(etat, null, 2) + '\n');
  const r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Lot inconnu dans STATE\.json\.lots/.test(r.sortie), r.sortie);
});

verifier('rien à rattraper (derniere_demande déjà à jour) est refusé, pas silencieusement ignoré', () => {
  const dir = registreAvecDemandeEnRetard();
  let r = executer(['rattraper-demande', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/rien à rattraper/.test(r.sortie), r.sortie);
});

// Mutation négative réelle : une enveloppe non conforme (branche protégée sur
// le NOUVEAU request) doit être détectée AVANT rattrapage — l'écran d'entrée
// de `rattraper-demande` ne doit pas être plus laxiste que `verifier`.
verifier('une enveloppe non conforme (branche protégée) est refusée, rien n\'est rattrapé', () => {
  const dir = registreAvecDemandeEnRetard();
  const req2 = path.join(dir, 'lots', LOT, 'request-2.md');
  fs.writeFileSync(req2, fs.readFileSync(req2, 'utf8').replace('branch: config-par-environnement', 'branch: main'));
  const r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/BRANCHE_PROTEGEE|est une ref protégée/.test(r.sortie), r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].derniere_demande, 'request-1.md', 'un rattrapage refusé ne doit jamais modifier derniere_demande');
});

verifier('STATE.json absent est refusé proprement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-rattr-vide-'));
  const r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/STATE\.json absent/.test(r.sortie), r.sortie);
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
