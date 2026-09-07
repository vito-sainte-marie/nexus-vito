// Test — Projection Live (nexus-live-projection.js)
// Lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §6.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-live-projection.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const P = sandbox.NexusLiveProjection;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function evt(overrides) {
  return Object.assign({
    protocol: 'nexus-execution-event/1',
    event_id: 'evt-1',
    occurred_at: '2026-09-07T00:00:00.000Z',
    lot_id: 'LOT-TEST',
    run_id: 'run-1',
    actor: { id: 'claude', role: 'execution' },
    phase: 'EXECUTION',
    status: 'STARTED',
    summary: 'x',
  }, overrides);
}

// 1) Aucun événement -> projection vide, statut IDLE.
let proj = P.construireProjectionLive([]);
assert.strictEqual(proj.system_status, 'IDLE');
assert.strictEqual(proj.active_lots.length, 0);
ok('journal vide -> projection IDLE');

// 2) Un seul événement STARTED -> AUTONOMOUS, lot actif détecté.
proj = P.construireProjectionLive([evt({ event_id: 'e1' })]);
assert.strictEqual(proj.system_status, 'AUTONOMOUS');
assert.strictEqual(Array.prototype.join.call(proj.active_lots, ','), 'LOT-TEST');
assert.strictEqual(proj.active_actor, 'claude');
ok('événement unique -> AUTONOMOUS, lot/agent identifiés');

// 3) DONE + PASSED en dernier -> IDLE (travail terminé, pas de gate).
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', phase: 'EXECUTION', status: 'STARTED', occurred_at: '2026-09-07T00:00:00.000Z' }),
  evt({ event_id: 'e2', phase: 'DONE', status: 'PASSED', occurred_at: '2026-09-07T00:05:00.000Z' }),
]);
assert.strictEqual(proj.system_status, 'IDLE');
ok('DONE+PASSED en dernier -> IDLE');

// 4) BLOCKED sans gate humain -> FAIL_CLOSED.
proj = P.construireProjectionLive([evt({ event_id: 'e1', status: 'BLOCKED' })]);
assert.strictEqual(proj.system_status, 'FAIL_CLOSED');
ok('BLOCKED sans gate -> FAIL_CLOSED');

// 5) human_gate.required=true -> HUMAN_REQUIRED, question exposée.
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', status: 'BLOCKED', human_gate: { required: true, question: 'Frédéric doit-il arbitrer ?' } }),
]);
assert.strictEqual(proj.system_status, 'HUMAN_REQUIRED');
assert.strictEqual(proj.human_gate.question, 'Frédéric doit-il arbitrer ?');
ok('gate humain requis -> HUMAN_REQUIRED, question portée');

// 6) Gate refermé par un événement postérieur -> retour à AUTONOMOUS.
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', occurred_at: '2026-09-07T00:00:00.000Z', status: 'BLOCKED', human_gate: { required: true, question: 'Q ?' } }),
  evt({ event_id: 'e2', occurred_at: '2026-09-07T00:10:00.000Z', phase: 'EXECUTION', status: 'PROGRESS', human_gate: { required: false } }),
]);
assert.strictEqual(proj.system_status, 'AUTONOMOUS');
assert.strictEqual(proj.human_gate, undefined);
ok('gate refermé par un événement postérieur -> AUTONOMOUS');

// 7) Guardians : dernier statut connu par acteur, pas un historique complet.
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', occurred_at: '2026-09-07T00:00:00.000Z', actor: { id: 'guardian-qa', role: 'guardian' }, phase: 'GUARDIAN_REVIEW', status: 'STARTED' }),
  evt({ event_id: 'e2', occurred_at: '2026-09-07T00:05:00.000Z', actor: { id: 'guardian-qa', role: 'guardian' }, phase: 'GUARDIAN_REVIEW', status: 'PASSED' }),
]);
assert.strictEqual(proj.guardians['guardian-qa'], 'PASSED');
ok('Guardians projettent le dernier statut connu, pas un doublon');

// 8) Tests/CI par lot, indépendants des autres phases.
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', occurred_at: '2026-09-07T00:00:00.000Z', phase: 'TEST', status: 'PASSED' }),
  evt({ event_id: 'e2', occurred_at: '2026-09-07T00:01:00.000Z', phase: 'CI', status: 'FAILED' }),
]);
assert.strictEqual(proj.tests['LOT-TEST'], 'PASSED');
assert.strictEqual(proj.ci['LOT-TEST'], 'FAILED');
ok('tests et CI projetés séparément par lot');

// 9) L'ordre d'entrée n'affecte pas le résultat (tri par occurred_at).
const e1 = evt({ event_id: 'e1', occurred_at: '2026-09-07T00:00:00.000Z' });
const e2 = evt({ event_id: 'e2', occurred_at: '2026-09-07T00:05:00.000Z', phase: 'DONE', status: 'PASSED' });
assert.strictEqual(P.construireProjectionLive([e1, e2]).system_status, P.construireProjectionLive([e2, e1]).system_status);
ok('projection indépendante de l\'ordre d\'insertion (tri interne par occurred_at)');

// 10) Plusieurs lots actifs simultanément sont tous listés.
proj = P.construireProjectionLive([
  evt({ event_id: 'e1', lot_id: 'LOT-A' }),
  evt({ event_id: 'e2', lot_id: 'LOT-B', occurred_at: '2026-09-07T00:01:00.000Z' }),
]);
assert.strictEqual(Array.prototype.sort.call(proj.active_lots).join(','), 'LOT-A,LOT-B');
ok('plusieurs lots actifs listés sans perte');

console.log(`\n${n} assertions Live-Projection passées.`);
