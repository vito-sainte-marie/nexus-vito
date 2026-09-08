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


// `vide(x)` plutôt que `deepStrictEqual(x, [])` : le module est chargé dans
// un contexte `vm`, donc ses tableaux portent le prototype Array de CE
// contexte-là. `deepStrictEqual` compare aussi les prototypes et échoue en
// affichant « [] » contre « [] » — un message qui ne veut rien dire tant
// qu'on n'a pas identifié la frontière de realm. Piège rencontré deux fois
// le 08/09/2026 ; il vaut mieux un helper qu'un rattrapage à chaque ligne.
function vide(x, message) { assert.strictEqual(x.length, 0, message + ' — obtenu : ' + JSON.stringify(x)); }
function memesElements(x, attendu, message) {
  assert.deepStrictEqual([...x].sort(), attendu.slice().sort(), message);
}

// ── LE VERDICT (08/09/2026) ─────────────────────────────────────────────
// « On lit SYSTÈME AUTONOME, puis deux Guardians BLOCKED. Pour un humain, ces
// éléments réunis créent une question immédiate : est-ce que ça fonctionne ou
// est-ce que c'est bloqué ? Un système NEXUS ne devrait jamais laisser cette
// ambiguïté. » — Frédéric, 08/09/2026.

const barriereCassee = { occurred_at: '2026-09-08T15:00:00Z', lot_id: 'L', status: 'BLOCKED',
  evidence: { type: 'protection', ref: 'refs/heads/production' } };
const barriereTenue = { ...barriereCassee, status: 'WAITING' };

t('rien à signaler se DIT, au lieu de laisser une page muette', () => {
  const v = P.verdictLive({ events: [barriereTenue], projection: { guardians: { g: 'PASSED' } },
    fraicheur: { niveau: 'FRAIS', ageMinutes: 2 } });
  assert.strictEqual(v.niveau, P.VERDICT.NORMAL);
  assert.strictEqual(v.decisions, 0);
  assert.ok(/fonctionne normalement/.test(v.titre), v.titre);
  vide(v.risques, 'aucun risque structurel attendu');
});

t('ce qui attend Frédéric l’emporte sur TOUT le reste', () => {
  // Un gate en attente doit passer devant une garde en échec ET devant un
  // risque structurel : c'est la seule chose qui réclame une personne.
  const v = P.verdictLive({
    events: [barriereCassee],
    projection: { guardians: { a: 'FAILED', b: 'BLOCKED' }, human_gate: { question: 'Autoriser la promotion ?' } },
  });
  assert.strictEqual(v.niveau, P.VERDICT.INTERVENTION);
  assert.strictEqual(v.decisions, 1);
  assert.strictEqual(v.explication, 'Autoriser la promotion ?', 'la question posée doit être LA phrase affichée');
  assert.ok(/décision t’attend/.test(v.titre), v.titre);
});

t('une garde en ÉCHEC arrête la chaîne, et les gardes sont nommées', () => {
  const v = P.verdictLive({ events: [barriereTenue], projection: { guardians: { 'guardian-qa': 'FAILED', b: 'PASSED' } } });
  assert.strictEqual(v.niveau, P.VERDICT.INTERVENTION);
  assert.ok(/guardian-qa/.test(v.explication), v.explication);
  assert.strictEqual(v.decisions, 0, 'une garde en échec n’est pas une décision à prendre, c’est un travail à faire');
});

t('un invariant NON GARANTI interdit de dire « tout va bien »', () => {
  // Le point le plus important du retour de Frédéric : « le statut global ne
  // devrait pas être vert "système autonome" tant qu'un invariant aussi
  // important n'est pas garanti ». Le verdict dit donc littéralement
  // « Autonome en Test ».
  const v = P.verdictLive({ events: [barriereCassee], projection: { guardians: { g: 'PASSED' } } });
  assert.strictEqual(v.niveau, P.VERDICT.VIGILANCE);
  assert.strictEqual(v.titre, 'Autonome en Test');
  assert.ok(/Production/.test(v.explication), v.explication);
  assert.strictEqual(v.risques.length, 1);
  assert.strictEqual(v.risques[0].code, 'PRODUCTION_NON_PROTEGEE');
  assert.ok(/push direct/.test(v.risques[0].texte), 'le risque doit être expliqué, pas seulement nommé');
});

t('des signalements sans blocage ne se lisent pas comme un arrêt', () => {
  const v = P.verdictLive({ events: [barriereTenue], projection: { guardians: { a: 'BLOCKED', b: 'BLOCKED', c: 'PASSED' } } });
  assert.strictEqual(v.niveau, P.VERDICT.VIGILANCE);
  assert.ok(/sans rien bloquer/.test(v.explication), v.explication);
  assert.ok(/Aucune décision ne t’est demandée/.test(v.explication), v.explication);
  memesElements(v.aSurveiller, ['a', 'b'], 'les gardes signalant doivent être nommées');
});

t('le risque de Production est lu sur l’événement le PLUS RÉCENT', () => {
  // Une barrière réparée ne doit pas rester affichée comme cassée à cause
  // d'un événement plus ancien resté dans le journal.
  const ancien = { ...barriereCassee, occurred_at: '2026-09-07T10:00:00Z' };
  const recent = { ...barriereTenue, occurred_at: '2026-09-08T10:00:00Z' };
  vide(P.risquesStructurels([ancien, recent]), 'barrière réparée');
  vide(P.risquesStructurels([recent, ancien]), 'quel que soit l’ordre de la liste');
  assert.strictEqual(P.risquesStructurels([recent, { ...barriereCassee, occurred_at: '2026-09-08T11:00:00Z' }]).length, 1);
});

t('sans aucun événement de barrière, aucun risque n’est INVENTÉ', () => {
  // Ne pas savoir n'est pas « tout va bien », mais ce n'est pas non plus une
  // alerte : on ne fabrique pas un risque faute d'information.
  vide(P.risquesStructurels([]), 'aucun événement');
  vide(P.risquesStructurels(null), 'journal absent');
  vide(P.risquesStructurels([{ occurred_at: '2026-09-08T10:00:00Z', evidence: { type: 'ci' } }]), 'preuve d’un autre type');
});

t('BLOCKED est traduit en langage d’exploitant, et n’est plus un arrêt', () => {
  // « BLOCKED est beaucoup trop violent et trop ambigu » — le producteur
  // l'emploie pour une garde de RAPPORT qui a trouvé quelque chose : elle n'a
  // rien bloqué du tout.
  assert.strictEqual(P.libelleStatutGarde({ status: 'BLOCKED' }).texte, 'À surveiller');
  assert.strictEqual(P.libelleStatutGarde({ status: 'PASSED' }).texte, 'Conforme');
  assert.strictEqual(P.libelleStatutGarde({ status: 'FAILED' }).texte, 'Action requise');
  assert.strictEqual(P.libelleStatutGarde({ status: 'FAILED' }).ton, 'grave');
  assert.strictEqual(P.libelleStatutGarde({ status: 'WAITING' }).texte, 'En attente');
  // Un statut qu'on ne comprend pas n'est pas traduit à tout hasard.
  assert.strictEqual(P.libelleStatutGarde({ status: 'ZORGLUB' }).texte, 'État non interprété');
  assert.strictEqual(P.libelleStatutGarde(null).texte, 'État non interprété');
});


// ── CONTRAT D'ÉCRAN (08/09/2026) ────────────────────────────────────────

t('CONTRAT — l’écran rend le verdict AVANT toute donnée', () => {
  // « Quand tu ouvres NEXUS Live, il devrait être possible de répondre en
  // moins de cinq secondes à : est-ce que NEXUS travaille normalement ? y
  // a-t-il quelque chose qui bloque ? est-ce que je dois intervenir ? »
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  const iVerdict = ecran.indexOf('${blocVerdict(verdict)}');
  const iDetail = ecran.indexOf('Détail technique');
  const iTimeline = ecran.indexOf('<div class="section-label">Timeline</div>');
  assert.ok(iVerdict > 0, 'le verdict doit être rendu');
  assert.ok(iDetail > iVerdict, 'le détail technique vient APRÈS le verdict');
  assert.ok(iTimeline > iVerdict, 'la timeline aussi');
});

t('CONTRAT — le risque de Production sort du journal et monte en haut', () => {
  // « Ce message ne doit absolument pas être enfoui dans la timeline. C'est
  // un risque structurel majeur. »
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  const iRisques = ecran.indexOf('${blocRisques(verdict.risques)}');
  const iDetail = ecran.indexOf('Détail technique');
  assert.ok(iRisques > 0 && iRisques < iDetail, 'les risques passent avant le détail technique');
});

t('CONTRAT — « ce qui t’attend » est TOUJOURS rendu, même vide', () => {
  // Le Guardian Philosophie signalait cet écran : la carte disparaissait quand
  // aucun arbitrage n'attendait. On ne pouvait pas distinguer « vérifié, rien
  // à faire » de « pas vérifié ». Critères 4 et 8 de sa doctrine.
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  assert.ok(/\$\{blocAttente\(projection\.human_gate\)\}/.test(ecran),
    'le bloc doit être appelé sans condition');
  assert.ok(/Rien ne t’attend/.test(ecran), 'et dire explicitement qu’il n’y a rien');
  assert.ok(/Vérifié à l’instant/.test(ecran),
    'en précisant que l’absence a été VÉRIFIÉE, pas seulement constatée');
  // Et le guardian lui-même ne doit plus signaler cet écran.
  const G = require(path.join(__dirname, 'outils', 'guardian-philosophie.js'));
  const findings = G.analyserSource(ecran, 'NEXUS-Live-Developpement-v1.html');
  assert.strictEqual(findings.length, 0,
    'aucune section de cet écran ne doit plus disparaître en silence : ' + JSON.stringify(findings));
});

t('CONTRAT — l’âge affiché dit CE QU’IL MESURE', () => {
  // « Environnement Test — IL Y A 1 H 51 : je ne sais pas immédiatement ce que
  // signifie cette durée. Dernière synchronisation ? Dernier événement ? »
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  assert.ok(/dernière analyse/i.test(ecran), 'la durée doit être nommée');
});

t('CONTRAT — l’écran ne montre plus de statut brut de garde', () => {
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  assert.ok(/libelleStatutGarde/.test(ecran), 'les statuts doivent être traduits');
  assert.ok(!/<span>\$\{statut\}<\/span>/.test(ecran),
    'le statut brut ne doit plus être affiché tel quel');
});

console.log(`\n${n} assertions Live-Projection passées.`);
