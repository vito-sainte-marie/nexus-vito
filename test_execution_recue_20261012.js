// E5 de NEXUS-EXECUTOR-SUPABASE-1 — retour d'exécution et reprise (`handoff.js execution`).
//
// PROPRIÉTÉS (CLI réel sur registre jetable, puis mutation de câblage) :
//   A. Un retour valide d'un lot DECISION_CONSOMMEE → execution-N-k.json, lot EXECUTION_RECUE, verifier vert.
//   B. Refus sans écriture : lot non consommé, hash inconnu, retour contredisant l'ordre, état hors liste, ordre altéré.
//   C. Rejeu : un EXECUTE est terminal ; un EXECUTION_INCERTAINE peut être suivi d'un retour réconcilié (-r2), jamais deux fois le même.
//   D. verifier refuse un retour orphelin ou incohérent (EXECUTION_ORPHELINE / EXECUTION_INCOHERENTE) et un ordre altéré.
//   E. verifier refuse CAPACITE_SANS_ORDRE sur un lot actif ; ne dit rien d'un lot clos.
//   F. Mutation « débrancher » : sans la commande, rien n'est déposé ; sans l'appel de contrôle, D rougirait.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { execFileSync } = require('child_process');
const O = require('./outils/ordre-execution');
const RACINE = __dirname, OUTIL = path.join(RACINE, 'outils', 'handoff.js'), MUT = path.join(RACINE, 'outils', '.mut-handoff-e5.js');
const LOT = 'LOT-E5-EPREUVE-20261012';
let n = 0; const ok = (m) => { n++; console.log(`  ✅ ${m}`); };

const ordre = O.construire({ operation: 'MIGRATION_APPLY', lot: LOT, request: 'request-1', cible: { env: 'test', project_ref: O.ENVS.test },
  artefact: { chemin: 'supabase/migrations/20261012000000_exemple.sql', blob: 'a'.repeat(40), commit: 'b'.repeat(40) },
  preconditions: { registre_taille: 310 }, postconditions: { registre_taille: 311 }, retour_arriere: 'aucun, justifié : additive',
  cree_le: '2026-10-12T10:00:00Z', expire_le: '2026-10-13T10:00:00Z' });
const exec = (etat = 'EXECUTE', extra = {}) => ({ operation_hash: ordre.operation_hash, etat, executant: 'session-claude-habilitee',
  go: { operation_hash: ordre.operation_hash, env: 'test', acteur: 'arbitre-chatgpt' }, mesures_avant: { registre_taille: 310 },
  mesures_apres: { registre_taille: etat === 'EXECUTE' ? 311 : 310 }, debut: '2026-10-12T11:00:00Z', fin: '2026-10-12T11:00:05Z',
  reprise: { prochaine_action: 'constat passif' }, ...extra });

function registre(statut = 'DECISION_CONSOMMEE', avecOrdre = true, corps = 'Demande d\'épreuve E5.\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-e5-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lots: {} }, null, 2) + '\n');
  const c = path.join(dir, '.corps.md'); fs.writeFileSync(c, corps);
  const r = run(OUTIL, dir, ['demande', LOT, c, '--rail', 'handoff-continuite-20260920', '--wake-to', 'ChatGPT']);
  assert.strictEqual(r.code, 0, `fixture : demande\n${r.sortie}`);
  const st = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')); st.lots[LOT].statut = statut;
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(st, null, 2) + '\n');
  if (avecOrdre) fs.writeFileSync(path.join(dir, 'lots', LOT, 'order-1-1.json'), JSON.stringify(ordre, null, 2) + '\n');
  return dir;
}
const lot = (dir) => path.join(dir, 'lots', LOT);
const state = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')).lots[LOT];
const fichiers = (dir) => fs.readdirSync(lot(dir)).filter((f) => /^execution-/.test(f)).sort();
function run(outil, dir, args) {
  try { return { code: 0, sortie: execFileSync('node', [outil, ...args], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) }; }
  catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}
function depose(dir, e, outil = OUTIL) { const f = path.join(dir, '.retour.json'); fs.writeFileSync(f, JSON.stringify(e)); return run(outil, dir, ['execution', LOT, f]); }
const verifier = (dir, outil = OUTIL) => run(outil, dir, ['verifier']);

// A
let dir = registre(); let x = depose(dir, exec());
assert.strictEqual(x.code, 0, x.sortie);
assert.deepStrictEqual(fichiers(dir), ['execution-1-1.json']);
assert.strictEqual(state(dir).statut, 'EXECUTION_RECUE');
assert.strictEqual(state(dir).derniere_execution, 'execution-1-1.json');
x = verifier(dir); assert.strictEqual(x.code, 0, `A: verifier vert\n${x.sortie}`);
ok('A — retour valide déposé, lot EXECUTION_RECUE, verifier vert');

// B
const refus = (d, e, motif, msg) => { const av = fichiers(d).length; const r = depose(d, e); assert.notStrictEqual(r.code, 0, msg); assert.match(r.sortie, motif, msg); assert.strictEqual(fichiers(d).length, av, `${msg} : rien écrit`); };
refus(registre('ATTENTE_DECISION'), exec(), /consommez la décision/, 'B lot non consommé');
refus(registre(), exec('EXECUTE', { operation_hash: 'f'.repeat(64) }), /aucun ordre du lot/, 'B hash inconnu');
refus(registre(), exec('EXECUTE', { mesures_apres: { registre_taille: 310 } }), /contredit/, 'B postcondition non tenue');
refus(registre(), exec('INVENTE'), /hors EXECUTE/, 'B état hors liste');
refus(registre('DECISION_CONSOMMEE', false), exec(), /aucun ordre du lot/, 'B lot sans ordre');
dir = registre(); const alt = JSON.parse(fs.readFileSync(path.join(lot(dir), 'order-1-1.json'), 'utf8')); alt.lot = 'AUTRE';
fs.writeFileSync(path.join(lot(dir), 'order-1-1.json'), JSON.stringify(alt));
refus(dir, exec(), /aucun ordre du lot|altéré/, 'B ordre altéré');
ok('B — six refus, aucune écriture');

// C
dir = registre(); assert.strictEqual(depose(dir, exec()).code, 0);
x = depose(dir, exec()); assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /terminal/); assert.deepStrictEqual(fichiers(dir), ['execution-1-1.json']);
dir = registre(); assert.strictEqual(depose(dir, exec('EXECUTION_INCERTAINE')).code, 0);
assert.match(depose(dir, exec('EXECUTION_INCERTAINE')).sortie, /r2/, 'C: second incertain accepté sous -r2');
assert.deepStrictEqual(fichiers(dir), ['execution-1-1-r2.json', 'execution-1-1.json'].sort());
assert.strictEqual(depose(dir, exec('EXECUTE')).code, 0);
assert.ok(fichiers(dir).includes('execution-1-1-r3.json'));
assert.notStrictEqual(depose(dir, exec('EXECUTE')).code, 0, 'C: un EXECUTE réconcilié est terminal');
ok('C — EXECUTE terminal ; INCERTAIN suivi de -r2, -r3 ; jamais deux fois le même terminal');

// D
dir = registre('EXECUTION_RECUE'); fs.writeFileSync(path.join(lot(dir), 'execution-1-1.json'), JSON.stringify(exec('EXECUTE', { operation_hash: 'e'.repeat(64) })));
x = verifier(dir); assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /ne cite aucun ordre/);
dir = registre('EXECUTION_RECUE'); fs.writeFileSync(path.join(lot(dir), 'execution-1-1.json'), JSON.stringify(exec('EXECUTE', { mesures_apres: { registre_taille: 310 } })));
x = verifier(dir); assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /contredit/);
dir = registre('EXECUTION_RECUE'); const alt2 = JSON.parse(JSON.stringify(ordre)); alt2.lot = 'AUTRE'; fs.writeFileSync(path.join(lot(dir), 'order-1-1.json'), JSON.stringify(alt2));
x = verifier(dir); assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /hash altéré/);
ok('D — verifier refuse orphelin, incohérent, ordre altéré (messages explicites)');

// E
const corps = (cap) => `Demande d'épreuve E5.\nCAPACITE_REQUISE: ${cap}\n`;
dir = registre('ATTENTE_DECISION', false, corps('SUPABASE_TEST_ECRITURE'));
x = verifier(dir); assert.match(x.sortie, /aucun order-\*\.json/, `E: lot actif sans ordre refusé\n${x.sortie}`);
dir = registre('DECISION_CONSOMMEE', false, corps('SUPABASE_TEST_ECRITURE'));
x = verifier(dir); assert.ok(!/aucun order-\*\.json/.test(x.sortie), 'E: lot clos, aucun reproche');
ok('E — CAPACITE_SANS_ORDRE refusé sur lot actif, tu sur lot clos');

// F : débrancher
const src = fs.readFileSync(OUTIL, 'utf8');
const ancre = '  validerExecutionsEtOrdres(etat);\n';
assert.strictEqual(src.split(ancre).length, 2, 'F: ancre unique');
fs.writeFileSync(MUT, src.replace(ancre, ''));
try {
  dir = registre('EXECUTION_RECUE'); fs.writeFileSync(path.join(lot(dir), 'execution-1-1.json'), JSON.stringify(exec('EXECUTE', { operation_hash: 'e'.repeat(64) })));
  assert.ok(!/ne cite aucun ordre/.test(verifier(dir, MUT).sortie), 'F: contrôle débranché → l\'orphelin passe : l\'épreuve D rougirait');
  ok('F — mutation « débrancher le contrôle de verifier » : l\'épreuve D le verrait');
} finally { fs.rmSync(MUT, { force: true }); }

console.log(`\nexécution reçue : ${n} groupes d'épreuves passés.`);
