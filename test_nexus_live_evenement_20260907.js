// Test — Contrat d'événement Live (nexus-live-evenement.js)
// Lot NEXUS-LIVE-CONTROL-CENTER-1-20260906, spec-1.md §5 : validation,
// idempotence, refus de contenu sensible.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-live-evenement.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const M = sandbox.NexusLiveEvenement;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function evtBase(overrides) {
  return Object.assign({
    protocol: 'nexus-execution-event/1',
    event_id: 'evt-1',
    occurred_at: '2026-09-07T00:00:00.000Z',
    lot_id: 'LOT-TEST',
    run_id: 'run-1',
    actor: { id: 'claude', role: 'execution' },
    phase: 'EXECUTION',
    status: 'STARTED',
    summary: 'Démarrage du correctif',
  }, overrides);
}

// 1) Événement conforme accepté sans erreur.
assert.strictEqual(M.validerEvenementLive(evtBase()).length, 0);
ok('événement conforme -> aucune erreur');

// 2) Protocole erroné rejeté.
assert.ok(M.validerEvenementLive(evtBase({ protocol: 'autre/1' })).includes('protocol_invalide'));
ok('protocole non conforme rejeté');

// 3) Phase / statut hors énumération rejetés.
assert.ok(M.validerEvenementLive(evtBase({ phase: 'INEXISTANTE' })).includes('phase_invalide'));
assert.ok(M.validerEvenementLive(evtBase({ status: 'INEXISTANT' })).includes('status_invalide'));
ok('phase/statut hors énumération rejetés');

// 4) Acteur invalide (rôle inconnu) rejeté.
assert.ok(M.validerEvenementLive(evtBase({ actor: { id: 'x', role: 'humain' } })).includes('actor_invalide'));
ok('rôle acteur hors énumération rejeté');

// 5) human_gate.required=true sans question -> rejeté (pas de gate muet).
assert.ok(M.validerEvenementLive(evtBase({ human_gate: { required: true } })).includes('human_gate_sans_question'));
ok('gate humain sans question rejeté');

// 6) human_gate.required=true avec question -> accepté.
assert.strictEqual(
  M.validerEvenementLive(evtBase({ human_gate: { required: true, question: 'Pourquoi un humain doit-il intervenir ici ?' } })).length,
  0
);
ok('gate humain avec question accepté');

// 7) Contenu ressemblant à un secret -> refusé, même structurellement valide.
assert.ok(M.validerEvenementLive(evtBase({ summary: 'export SUPABASE_SERVICE_ROLE=abc' })).includes('contenu_potentiellement_sensible_refuse'));
ok('résumé contenant "service_role" refusé');

// 8) Idempotence : le même event_id n'est jamais accepté deux fois.
let resultat = M.accepterEvenementLive(evtBase({ event_id: 'evt-A' }), []);
assert.strictEqual(resultat.accepte, true);
resultat = M.accepterEvenementLive(evtBase({ event_id: 'evt-A', summary: 'Résumé différent' }), resultat.journal);
assert.strictEqual(resultat.accepte, false);
assert.strictEqual(resultat.raison, 'doublon_idempotent');
assert.strictEqual(resultat.journal.length, 1);
ok('doublon event_id refusé (idempotence)');

// 9) accepterEvenementLive ne mute jamais le journal reçu.
const journalOriginal = [];
M.accepterEvenementLive(evtBase({ event_id: 'evt-B' }), journalOriginal);
assert.strictEqual(journalOriginal.length, 0);
ok('journal fourni non muté (immutabilité)');

// 10) Événement invalide non ajouté au journal.
resultat = M.accepterEvenementLive(evtBase({ lot_id: '' }), []);
assert.strictEqual(resultat.accepte, false);
assert.strictEqual(resultat.journal.length, 0);
ok('événement invalide non journalisé');

console.log(`\n${n} assertions Live-Événement passées.`);
