// `handoff.js demande` refuse une classe de preuve hors vocabulaire AVANT toute écriture.
//
// Pourquoi : request-3 de PRISE-DE-POSTE-UN-ECRAN-20261025 est partie avec la classe MEASURED ; seul `verifier`
// la voyait, après le push, et la demande a dû être réécrite une fois publiée (INCIDENTS, 26/10/2026).
//   A. MEASURED → refus PREUVE_CLASSE_HORS_VOCABULAIRE, code 1, aucun fichier de demande écrit.
//   B. Les quatre classes du vocabulaire passent et la demande est écrite.
//   M. Mutation « retirer la garde » : MEASURED passe et écrit une demande → l'épreuve A rougit.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { execFileSync } = require('child_process');
const RACINE = __dirname, OUTIL = path.join(RACINE, 'outils', 'handoff.js'), MUT = path.join(RACINE, 'outils', '.mut-handoff-classe.js');
const LOT = 'LOT-CLASSE-EPREUVE-20261026';
let n = 0; const ok = (m) => { n++; console.log(`  ✅ ${m}`); };

function registre() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-classe-'));
  fs.mkdirSync(path.join(dir, 'lots', LOT), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lots: { [LOT]: { statut: 'DECISION_CONSOMMEE', rail: 'handoff-continuite-20260920' } } }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'corps.md'), 'Demande d\'épreuve.\n');
  return dir;
}
function cli(outil, dir, classe) {
  const args = [outil, 'demande', LOT, path.join(dir, 'corps.md'), '--rail', 'handoff-continuite-20260920', '--wake-to', 'ChatGPT', '--preuve', `x:${classe}:y`];
  try { return { code: 0, sortie: execFileSync('node', args, { cwd: RACINE, env: { ...process.env, NEXUS_HANDOFF_DIR: dir }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}
const ecrites = (dir) => fs.readdirSync(path.join(dir, 'lots', LOT)).filter((f) => /^request-/.test(f));

let dir = registre(), x = cli(OUTIL, dir, 'MEASURED');
assert.strictEqual(x.code, 1, `A: refus attendu, obtenu ${x.code} ${x.sortie}`);
assert.ok(x.sortie.includes('PREUVE_CLASSE_HORS_VOCABULAIRE') && x.sortie.includes('MEASURED'), `A: refus codé, obtenu ${x.sortie}`);
assert.deepStrictEqual(ecrites(dir), [], 'A: rien n\'est écrit');
ok('A — classe MEASURED refusée avant écriture (PREUVE_CLASSE_HORS_VOCABULAIRE)');

for (const c of ['VERIFIED', 'DECLARED', 'HUMAN', 'NOT_APPLICABLE']) {
  dir = registre(); x = cli(OUTIL, dir, c);
  assert.strictEqual(x.code, 0, `B: ${c} doit passer, obtenu ${x.code} ${x.sortie}`);
  assert.strictEqual(ecrites(dir).length, 1, `B: ${c} écrit une demande`);
}
ok('B — les quatre classes du vocabulaire passent et la demande est écrite');

const SRC = fs.readFileSync(OUTIL, 'utf8');
const ancre = "if (!CLASSES_PREUVE.includes(p.classe)) {\n      console.error(`REFUS PREUVE_CLASSE_HORS_VOCABULAIRE";
assert.strictEqual(SRC.split(ancre).length, 2, 'M: ancre de mutation unique');
fs.writeFileSync(MUT, SRC.replace(ancre, "if (false) {\n      console.error(`REFUS PREUVE_CLASSE_HORS_VOCABULAIRE"));
try {
  dir = registre(); x = cli(MUT, dir, 'MEASURED');
  assert.strictEqual(x.code, 0, `M: sans la garde MEASURED passe, obtenu ${x.code} ${x.sortie}`);
  assert.strictEqual(ecrites(dir).length, 1, 'M: sans la garde la demande est écrite — l\'épreuve A rougirait');
} finally { fs.rmSync(MUT, { force: true }); }
ok('M — mutation : sans la garde, MEASURED écrit une demande (A rougit)');
console.log(`${n}/3 épreuves`);
