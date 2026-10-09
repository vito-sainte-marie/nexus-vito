// `handoff.js rattraper-demande` — combler un second trou trouvé le
// 09/09/2026 sur NEXUS-PRODUCTION-READINESS-1-20260908 : request-5.md et
// decision-5.md ont été déposés directement (commit humain/Orchestrator),
// avec une enveloppe conforme, mais STATE.json.lots[...].derniere_demande
// pointait encore vers request-4.md. Résultat mesuré sur le registre réel :
// `verifier` bloque (« derniere_demande n'est pas la plus récente ») et donc
// `consommer` refuse pour TOUT le registre, pas seulement ce lot.
//
// Distinct de `enregistrer-lot` (lot totalement absent de STATE.json.lots) :
// ici le lot existe déjà, seul son pointeur est en retard. Cette commande
// rejoue les mêmes contrôles que `verifier` avant de rattraper, et refuse
// s'ils échouent. Chaque épreuve mute une seule chose et exige le bon
// comportement.
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

function enveloppeDemande(seq, corps) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
    'author: Frédéric Bragance', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
    'token_mode: STANDARD', 'preuves:',
    '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
    '---', '', corps, ''].join('\n');
}

function enveloppeDecision(seq, repondA, corps) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, `seq: ${seq}`,
    'author: Frédéric Bragance', 'branch: config-par-environnement', 'decision: APPROVED',
    'closes: false', `in_reply_to: ${repondA}`, '---', '', corps, ''].join('\n');
}

// Un lot déjà enregistré (comme après un `handoff.js demande` réel), sur
// lequel un request-2.md a ensuite été déposé DIRECTEMENT — exactement le
// cas réel trouvé — sans jamais repasser par l'outil.
function registreEnRetard({ decision2 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-rattrap-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'), enveloppeDemande(1, 'Première demande, déposée par l\'outil.'));
  fs.writeFileSync(path.join(lot, 'decision-1.md'), enveloppeDecision(1, 'request-1.md', 'Première décision.'));
  fs.writeFileSync(path.join(lot, 'request-2.md'), enveloppeDemande(2, 'Seconde demande, déposée directement — STATE.json l\'ignore encore.'));
  if (decision2) fs.writeFileSync(path.join(lot, 'decision-2.md'), enveloppeDecision(2, 'request-2.md', 'Seconde décision.'));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2',
    lot_actif: LOT,
    lots: {
      [LOT]: {
        statut: 'DECISION_CONSOMMEE',
        derniere_demande: 'request-1.md',
        derniere_decision: 'decision-1.md',
        source_decision: 'registre',
        commit_decision: 'deadbeef',
        consomme_le: '2026-09-08T00:00:00.000Z',
      },
    },
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

verifier('un request-N.md déposé directement, ignoré par STATE.json, bloque verifier', () => {
  const dir = registreEnRetard();
  const r = executer(['verifier'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/derniere_demande request-1\.md n'est pas la plus récente \(request-2\.md\)/.test(r.sortie), r.sortie);
});

verifier('rattraper-demande met à jour derniere_demande et repasse le lot en ATTENTE_DECISION', () => {
  const dir = registreEnRetard();
  const r = executer(['rattraper-demande', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].derniere_demande, 'request-2.md');
  assert.strictEqual(etat.lots[LOT].statut, 'ATTENTE_DECISION');
});

verifier('rattraper-demande ne touche jamais derniere_decision/commit_decision/consomme_le', () => {
  const dir = registreEnRetard();
  executer(['rattraper-demande', LOT], dir);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].derniere_decision, 'decision-1.md');
  assert.strictEqual(etat.lots[LOT].commit_decision, 'deadbeef');
  assert.strictEqual(etat.lots[LOT].consomme_le, '2026-09-08T00:00:00.000Z');
});

verifier('après rattraper-demande, verifier passe et consommer fonctionne sur une décision déjà déposée', () => {
  const dir = registreEnRetard({ decision2: true });
  let r = executer(['rattraper-demande', LOT], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  r = executer(['verifier'], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  // consommer exige un commit git réel pour le fichier de décision — hors
  // dépôt git, il doit refuser proprement plutôt qu'inventer une trace.
  r = executer(['consommer', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Aucun commit trouvé/.test(r.sortie), r.sortie);
});

verifier('un lot déjà à jour est refusé (rien à rattraper)', () => {
  const dir = registreEnRetard();
  fs.rmSync(path.join(dir, 'lots', LOT, 'request-2.md'));
  const r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/rien à rattraper/.test(r.sortie), r.sortie);
});

verifier('un lot absent de STATE.json.lots est refusé (utiliser enregistrer-lot)', () => {
  const dir = registreEnRetard();
  const r = executer(['rattraper-demande', 'LOT-JAMAIS-ENREGISTRE-20260909'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Lot inconnu/.test(r.sortie), r.sortie);
});

verifier('un lot dans STATE.json.lots mais sans répertoire lots/ est refusé', () => {
  const dir = registreEnRetard();
  const p = path.join(dir, 'STATE.json'), etat = JSON.parse(fs.readFileSync(p, 'utf8'));
  etat.lots['LOT-FANTOME-20260909'] = { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-1.md' };
  fs.writeFileSync(p, JSON.stringify(etat, null, 2) + '\n');
  const r = executer(['rattraper-demande', 'LOT-FANTOME-20260909'], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/Lot inconnu/.test(r.sortie), r.sortie);
});

// Mutation négative réelle : une enveloppe non conforme (branche protégée)
// doit être détectée AVANT rattrapage — l'écran d'entrée de
// `rattraper-demande` ne doit pas être plus laxiste que `verifier`.
verifier('une enveloppe non conforme (branche protégée) est refusée, rien n\'est rattrapé', () => {
  const dir = registreEnRetard();
  const req = path.join(dir, 'lots', LOT, 'request-2.md');
  const mute = fs.readFileSync(req, 'utf8').replace('branch: config-par-environnement', 'branch: main');
  fs.writeFileSync(req, mute);
  const r = executer(['rattraper-demande', LOT], dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/BRANCHE_PROTEGEE|est une ref protégée/.test(r.sortie), r.sortie);
  const etat = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(etat.lots[LOT].derniere_demande, 'request-1.md', 'un rattrapage refusé ne doit jamais modifier STATE.json');
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
