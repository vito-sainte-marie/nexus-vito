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


// Pont vers le style du fichier : `ok(nom)` compte, `t(nom, fn)` exécute
// puis compte. Les épreuves ajoutées le 08/09 sont écrites ainsi.
function t(nom, fn) { fn(); ok(nom); }

// ── Fraîcheur du journal (08/09/2026) ───────────────────────────────────
// L'écran a affiché huit événements vieux de treize heures sans le dire.
// Un journal mort ressemblait exactement à un journal vivant.

t('la fraîcheur est lue sur l’événement le PLUS RÉCENT, pas le dernier de la liste', () => {
  // Un journal n'arrive pas toujours trié. Prendre le dernier élément du
  // tableau ferait dépendre l'honnêteté de l'écran d'un ordre non garanti.
  const evts = [
    { occurred_at: '2026-09-08T12:00:00.000Z' },
    { occurred_at: '2026-09-08T09:00:00.000Z' },
  ];
  const f = P.fraicheurJournal(evts, '2026-09-08T12:10:00.000Z');
  assert.strictEqual(f.niveau, 'FRAIS');
  assert.strictEqual(f.ageMinutes, 10);
});

t('un journal vieux de treize heures est FROID, pas « frais »', () => {
  const f = P.fraicheurJournal([{ occurred_at: '2026-09-07T22:37:00.000Z' }], '2026-09-08T12:29:00.000Z');
  assert.strictEqual(f.niveau, 'FROID');
  assert.ok(f.ageMinutes > 800, String(f.ageMinutes));
});

t('les trois seuils sont exercés, bornes comprises', () => {
  const a = (min) => P.fraicheurJournal([{ occurred_at: '2026-09-08T00:00:00.000Z' }],
    new Date(Date.parse('2026-09-08T00:00:00.000Z') + min * 60000).toISOString()).niveau;
  assert.strictEqual(a(0), 'FRAIS');
  assert.strictEqual(a(P.SEUIL_TIEDE_MIN - 1), 'FRAIS');
  assert.strictEqual(a(P.SEUIL_TIEDE_MIN), 'TIEDE');
  assert.strictEqual(a(P.SEUIL_FROID_MIN - 1), 'TIEDE');
  assert.strictEqual(a(P.SEUIL_FROID_MIN), 'FROID');
});

t('sans horodatage exploitable, la fraîcheur est INCONNUE — jamais « fraîche »', () => {
  for (const cas of [[], null, undefined,
    [{ occurred_at: 'pas une date' }], [{}], [{ occurred_at: null }]]) {
    const f = P.fraicheurJournal(cas, '2026-09-08T12:00:00.000Z');
    assert.strictEqual(f.niveau, 'INCONNU', JSON.stringify(cas));
    assert.strictEqual(f.ageMinutes, null);
  }
  assert.strictEqual(P.fraicheurJournal([{ occurred_at: '2026-09-08T12:00:00.000Z' }], 'horloge cassée').niveau,
    'INCONNU', 'une horloge illisible ne rend pas un journal frais');
});

// ── Bloc « Déploiements » ───────────────────────────────────────────────

t('les compteurs sont LUS dans la preuve, et le plus récent gagne', () => {
  const evt = (iso, n) => ({ occurred_at: iso, evidence: { type: 'deploiement', ref: 'outils/etat-deploiement.js',
    compteurs: { en_developpement: n, attente_arbitrage: 0, clos: 24 }, dette: { total: 30, p0: 20 } } });
  // DÉSORDONNÉ volontairement : le plus récent est placé en PREMIER. Une liste
  // déjà triée ferait coïncider « le dernier » et « le plus récent », et une
  // mutation supprimant la comparaison y survivrait sans être vue.
  const d = P.extraireDeploiements([evt('2026-09-08T12:00:00.000Z', 5), evt('2026-09-08T09:00:00.000Z', 1)]);
  assert.strictEqual(d.compteurs.en_developpement, 5, 'le plus récent fait foi, quel que soit l’ordre');
  const inverse = P.extraireDeploiements([evt('2026-09-08T09:00:00.000Z', 1), evt('2026-09-08T12:00:00.000Z', 5)]);
  assert.strictEqual(inverse.compteurs.en_developpement, 5, 'et dans l’autre ordre aussi');
  assert.strictEqual(d.dette.total, 30);
  assert.strictEqual(d.source, 'outils/etat-deploiement.js');
});

t('sans événement de déploiement, on rend null — jamais trois zéros', () => {
  // Un tableau de bord qui affiche des zéros faute de données ment plus qu'un
  // tableau vide : le zéro se lit « rien en cours », pas « je ne sais pas ».
  assert.strictEqual(P.extraireDeploiements([]), null);
  assert.strictEqual(P.extraireDeploiements(null), null);
  assert.strictEqual(P.extraireDeploiements([{ occurred_at: '2026-09-08T12:00:00.000Z' }]), null);
  assert.strictEqual(P.extraireDeploiements([{ occurred_at: '2026-09-08T12:00:00.000Z',
    evidence: { type: 'ci', ref: 'x' } }]), null, 'un autre type de preuve n’est pas un état de déploiement');
  assert.strictEqual(P.extraireDeploiements([{ occurred_at: '2026-09-08T12:00:00.000Z',
    evidence: { type: 'deploiement', ref: 'x' } }]), null, 'sans compteurs, il n’y a rien à afficher');
});

t('« prêt pour Production » reste une proposition, sauf démenti explicite', () => {
  const base = (extra) => [{ occurred_at: '2026-09-08T12:00:00.000Z',
    evidence: Object.assign({ type: 'deploiement', ref: 'x', compteurs: { en_developpement: 0, attente_arbitrage: 0, clos: 1 } }, extra) }];
  assert.strictEqual(P.extraireDeploiements(base({})).pretProductionEstUneProposition, true,
    'par défaut, c’est une proposition — aucune décision de recette ne vaut autorisation de production');
  assert.strictEqual(P.extraireDeploiements(base({ pret_production_est_une_proposition: true })).pretProductionEstUneProposition, true);
});


// ── Le gate ne s'éteint que par un événement DE SON LOT (08/09/2026) ────

const gateWaiting = (lot) => ({ occurred_at: '2026-09-08T10:00:00Z', lot_id: lot, run_id: 'r',
  actor: { id: 'orchestrator', role: 'orchestrator' }, phase: 'GATE', status: 'WAITING',
  summary: 'Arbitrage attendu', human_gate: { required: true, question: 'Autoriser la promotion ?' } });
const evtLot = (lot, phase, extra) => Object.assign({ occurred_at: '2026-09-08T11:00:00Z', lot_id: lot,
  run_id: 'r', actor: { id: 'x', role: 'ci' }, phase, status: 'PASSED', summary: 's' }, extra || {});

t('un DONE d’un AUTRE lot n’éteint pas le gate', () => {
  // Le commentaire du code promettait « du même lot » depuis le premier jour ;
  // la condition ne le vérifiait pas. N'importe quel événement terminé
  // éteignait donc le compteur « en attente de ton arbitrage » — celui qui
  // porte la seule chose qui attend réellement Frédéric.
  const p = P.construireProjectionLive([gateWaiting('LOT-A'), evtLot('LOT-B', 'DONE')]);
  assert.ok(p.human_gate, 'le gate de LOT-A ne regarde pas LOT-B');
  assert.strictEqual(p.human_gate.lot_id, 'LOT-A');
  assert.strictEqual(p.system_status, P.STATUT_SYSTEME_LIVE.HUMAIN_REQUIS);
});

t('un état de déploiement n’éteint pas le gate de son propre lot', () => {
  // Le bloc « Déploiements » portait `DONE` dans son premier jet : il aurait
  // éteint le gate à chaque passage de CI, en silence. Un état observe, il ne
  // termine rien.
  const p = P.construireProjectionLive([gateWaiting('LOT-A'), evtLot('LOT-A', 'ANALYSE')]);
  assert.ok(p.human_gate, 'observer un état n’est pas répondre à une question');
});

t('un DONE du MÊME lot éteint bien le gate — sinon on ne fermerait jamais rien', () => {
  // La moitié qui donne son sens à la précédente.
  assert.ok(!P.construireProjectionLive([gateWaiting('LOT-A'), evtLot('LOT-A', 'DONE')]).human_gate);
  assert.ok(!P.construireProjectionLive([gateWaiting('LOT-A'),
    evtLot('LOT-A', 'GATE', { human_gate: { required: false } })]).human_gate,
    'une réponse explicite ferme aussi');
});


t('le gate transporte l’identifiant de l’événement qui l’a posé', () => {
  // Une autorisation doit pouvoir DÉSIGNER la question à laquelle elle répond.
  // Sans cette référence, elle flotte sans objet et rien ne permet de
  // rapprocher la réponse du gate.
  const g = Object.assign(gateWaiting('LOT-A'), { event_id: 'evt-gate-42' });
  const p = P.construireProjectionLive([g]);
  assert.strictEqual(p.human_gate.event_id, 'evt-gate-42');
  assert.strictEqual(p.human_gate.lot_id, 'LOT-A');
  assert.strictEqual(p.human_gate.question, 'Autoriser la promotion ?');
  // Sans identifiant, on rend null plutôt qu'une valeur inventée.
  const sans = P.construireProjectionLive([gateWaiting('LOT-A')]);
  assert.strictEqual(sans.human_gate.event_id, null);
});

console.log(`\n${n} assertions Live-Projection passées.`);
