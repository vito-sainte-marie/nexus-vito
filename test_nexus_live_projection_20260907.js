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

// Le GABARIT rendu, et non tout le fichier : les fonctions sont DÉFINIES plus
// haut que l'endroit où elles sont appelées, donc comparer des positions dans
// le fichier entier mesurait la mauvaise chose. L'ordre qui compte est celui
// des blocs dans le template.
function gabaritRendu() {
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  const i = ecran.indexOf('root.innerHTML = `');
  assert.ok(i > 0, 'le gabarit de rendu doit être trouvable');
  return ecran.slice(i, ecran.indexOf('`;', i));
}

t('CONTRAT — l’écran rend le verdict AVANT toute donnée', () => {
  // « Quand tu ouvres NEXUS Live, il devrait être possible de répondre en
  // moins de cinq secondes à : est-ce que NEXUS travaille normalement ? y
  // a-t-il quelque chose qui bloque ? est-ce que je dois intervenir ? »
  const ecran = gabaritRendu();
  const iVerdict = ecran.indexOf('${blocVerdict(verdict)}');
  const iDetail = ecran.indexOf('${blocEnCours(travail, projection)}');
  // Le titre a changé le 08/09 : « Timeline » est devenu « Ce qui s’est
  // passé », parce que ce n'en était pas une. Ce contrat suit le libellé
  // réel plutôt que d'être contourné.
  const iHistorique = ecran.indexOf('Ce qui s’est passé');
  assert.ok(iVerdict > 0, 'le verdict doit être rendu');
  assert.ok(iDetail > iVerdict, 'le bloc « En cours » vient APRÈS le verdict');
  assert.ok(iHistorique > iVerdict, 'l’historique aussi');
});

t('CONTRAT — le risque de Production sort du journal et monte en haut', () => {
  // « Ce message ne doit absolument pas être enfoui dans la timeline. C'est
  // un risque structurel majeur. »
  const ecran = gabaritRendu();
  const iRisques = ecran.indexOf('${blocRisques(verdict.risques)}');
  const iEnCours = ecran.indexOf('${blocEnCours(travail, projection)}');
  assert.ok(iRisques > 0 && iRisques < iEnCours, 'les risques passent avant le reste');
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


// ── LA TIMELINE RÉSUMÉE (08/09/2026) ────────────────────────────────────
// « Ce n'est pas vraiment une timeline. C'est un journal système brut. »

const garde = (id, statut, t) => ({ occurred_at: t, lot_id: 'L', run_id: 'gardes',
  actor: { id, role: 'guardian' }, phase: 'GUARDIAN_REVIEW', status: statut,
  summary: `${id} : …`, evidence: { type: 'garde', ref: `outils/${id}.js` } });
const depl = (t, dette, compteurs) => ({ occurred_at: t, lot_id: 'L', run_id: 'deploiement',
  actor: { id: 'etat-deploiement', role: 'ci' }, phase: 'ANALYSE', status: 'PASSED', summary: 'Déploiements — …',
  evidence: { type: 'deploiement', ref: 'outils/etat-deploiement.js',
    compteurs: compteurs || { en_developpement: 0, attente_arbitrage: 0, clos: 24 }, dette } });

t('les contrôles d’un même instant tiennent en UNE ligne', () => {
  // Cinq gardes au même horodatage produisaient cinq lignes identiques en
  // apparence. Le lecteur veut savoir combien passent, pas les lire une à une.
  const r = P.resumerTimeline([
    garde('guardian-qa', 'PASSED', '2026-09-08T12:00:00Z'),
    garde('verifier-apprentissage', 'PASSED', '2026-09-08T12:00:00Z'),
    garde('guardian-bible', 'BLOCKED', '2026-09-08T12:00:00Z'),
    garde('guardians-router', 'BLOCKED', '2026-09-08T12:00:00Z'),
  ]);
  assert.strictEqual(r.entrees.length, 1, JSON.stringify(r.entrees));
  assert.ok(/2 conformes, 2 à surveiller/.test(r.entrees[0].titre), r.entrees[0].titre);
  assert.strictEqual(r.entrees[0].ton, 'vigilance');
  assert.ok(/rien n’est arrêté/.test(r.entrees[0].detail), 'et dire que rien n’est bloqué');
});

t('une garde en ÉCHEC change le ton de la ligne entière', () => {
  const r = P.resumerTimeline([
    garde('a', 'PASSED', '2026-09-08T12:00:00Z'),
    garde('b', 'FAILED', '2026-09-08T12:00:00Z'),
  ]);
  assert.strictEqual(r.entrees[0].ton, 'grave');
  assert.ok(/1 en échec/.test(r.entrees[0].titre), r.entrees[0].titre);
  assert.ok(/arrêtée/.test(r.entrees[0].detail), r.entrees[0].detail);
});

t('des contrôles à DES INSTANTS différents ne sont pas fondus ensemble', () => {
  // Grouper au-delà de l'instant effacerait la chronologie, qui est le seul
  // intérêt d'une timeline.
  const r = P.resumerTimeline([
    garde('a', 'PASSED', '2026-09-08T12:00:00Z'),
    garde('b', 'PASSED', '2026-09-08T13:00:00Z'),
  ]);
  assert.strictEqual(r.entrees.length, 2);
});

t('un relevé de déploiement IDENTIQUE est écarté — et COMPTÉ', () => {
  // Le cœur du bruit signalé par Frédéric. Mais écarter en silence serait la
  // même faute que les cartes qui disparaissaient : le nombre d'écartés est
  // rendu avec le résumé.
  const r = P.resumerTimeline([
    depl('2026-09-08T12:00:00Z', { total: 29, p0: 18 }),
    depl('2026-09-08T12:30:00Z', { total: 29, p0: 18 }),
    depl('2026-09-08T13:00:00Z', { total: 29, p0: 18 }),
  ]);
  assert.strictEqual(r.entrees.length, 1, 'un seul relevé conservé');
  assert.strictEqual(r.masques, 2, 'et les deux répétitions sont comptées, pas escamotées');
});

t('un relevé qui CHANGE décrit le changement, pas l’état', () => {
  // « 12:35 — 2 nouveaux sujets prioritaires détectés » plutôt que la
  // répétition d'un tableau de compteurs.
  const r = P.resumerTimeline([
    depl('2026-09-08T12:00:00Z', { total: 29, p0: 18 }),
    depl('2026-09-08T13:00:00Z', { total: 31, p0: 20 }),
  ]);
  assert.strictEqual(r.entrees.length, 2);
  assert.ok(/2 sujets ajoutés au suivi/.test(r.entrees[1].titre), r.entrees[1].titre);
  assert.ok(/2 prioritaires/.test(r.entrees[1].titre), r.entrees[1].titre);
  assert.strictEqual(r.masques, 0);
});

t('un lot terminé ou un arbitrage qui arrive sont dits en clair', () => {
  const r = P.resumerTimeline([
    depl('2026-09-08T12:00:00Z', { total: 29, p0: 18 }, { en_developpement: 1, attente_arbitrage: 0, clos: 24 }),
    depl('2026-09-08T13:00:00Z', { total: 29, p0: 18 }, { en_developpement: 0, attente_arbitrage: 1, clos: 25 }),
  ]);
  const titre = r.entrees[1].titre;
  assert.ok(/arbitrage/.test(titre), titre);
  assert.ok(/1 lot terminé/.test(titre), titre);
});

t('le risque Production et la CI sont traduits', () => {
  const r = P.resumerTimeline([
    { occurred_at: '2026-09-08T14:00:00Z', lot_id: 'L', run_id: 'r', actor: { id: 'gh', role: 'ci' },
      phase: 'CI', status: 'FAILED', summary: 'CI sur abc : failure', evidence: { type: 'ci', ref: '1' } },
    { occurred_at: '2026-09-08T14:35:00Z', lot_id: 'L', run_id: 'production', actor: { id: 'gh', role: 'ci' },
      phase: 'GATE', status: 'BLOCKED', summary: 'x', evidence: { type: 'protection', ref: 'refs/heads/production' } },
  ]);
  assert.strictEqual(r.entrees[0].titre, 'Intégration continue en échec');
  assert.strictEqual(r.entrees[1].titre, 'Risque Production détecté');
  assert.ok(/push direct/.test(r.entrees[1].detail), r.entrees[1].detail);
  assert.strictEqual(r.entrees[1].ton, 'grave');
});

t('un type d’événement INCONNU est rendu tel quel, et marqué comme tel', () => {
  // On ne cache pas ce qu'on ne comprend pas. L'écarter serait exactement la
  // faute que ce résumé existe pour corriger, retournée.
  const r = P.resumerTimeline([{ occurred_at: '2026-09-08T15:00:00Z', lot_id: 'L', run_id: 'r',
    actor: { id: 'x', role: 'ci' }, phase: 'TEST', status: 'PASSED',
    summary: 'Quelque chose de nouveau', evidence: { type: 'type-futur', ref: 'z' } }]);
  assert.strictEqual(r.entrees.length, 1);
  assert.strictEqual(r.entrees[0].titre, 'Quelque chose de nouveau');
  assert.strictEqual(r.entrees[0].nonInterprete, true);
  assert.strictEqual(r.masques, 0, 'un inconnu n’est jamais masqué');
});

t('un journal vide ou absent ne fabrique aucune entrée', () => {
  for (const cas of [[], null, undefined]) {
    const r = P.resumerTimeline(cas);
    vide(r.entrees, 'journal ' + JSON.stringify(cas));
    assert.strictEqual(r.masques, 0);
  }
});

t('le résumé respecte la chronologie même si le journal ne l’est pas', () => {
  const r = P.resumerTimeline([
    { occurred_at: '2026-09-08T16:00:00Z', lot_id: 'L', run_id: 'r', actor: { id: 'x', role: 'ci' },
      phase: 'CI', status: 'PASSED', summary: 'tard', evidence: { type: 'ci', ref: '2' } },
    { occurred_at: '2026-09-08T09:00:00Z', lot_id: 'L', run_id: 'r', actor: { id: 'x', role: 'ci' },
      phase: 'CI', status: 'PASSED', summary: 'tôt', evidence: { type: 'ci', ref: '1' } },
  ]);
  // `.join()` plutôt que `deepStrictEqual` sur un tableau : frontière de realm,
  // troisième rencontre du même piège aujourd'hui. Comparer des chaînes le
  // contourne sans y penser.
  assert.strictEqual(r.entrees.map(e => e.detail).join(' → '), 'tôt → tard');
});

t('CONTRAT — l’écran montre le RÉSUMÉ, et garde le journal brut derrière un dépli', () => {
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  assert.ok(/resumerTimeline\(evenements\)/.test(ecran), 'l’écran doit consommer le résumé');
  assert.ok(/Ce qui s’est passé/.test(ecran), 'et le titrer en langage d’exploitant');
  assert.ok(!/<div class="section-label">Timeline<\/div>/.test(ecran),
    'le titre « Timeline » disparaît : ce n’en était pas une');
  // Le journal brut reste ACCESSIBLE — le résumé ne doit pas être le seul
  // accès à la vérité.
  assert.ok(/<details class="journal">/.test(ecran), 'le journal technique doit rester consultable');
  assert.ok(/Voir le journal technique/.test(ecran), 'et être nommé');
  // Et le nombre d'écartés est AFFICHÉ, jamais silencieux.
  assert.ok(/resume\.masques/.test(ecran) && /écarté\(s\)/.test(ecran),
    'les relevés écartés doivent être dits, pas escamotés');
});


// ── LE FLUX VERS PRODUCTION (08/09/2026) ────────────────────────────────
// « La chaîne existe dans l'infrastructure, mais elle n'est pas visible dans
// l'interface. »

const evtPhase = (phase, t, extra) => Object.assign({ occurred_at: t, lot_id: 'L', run_id: 'r',
  actor: { id: 'x', role: 'ci' }, phase, status: 'PASSED', summary: 's' }, extra || {});
const etatDe = (flux, cle) => flux.etapes.find(e => e.cle === cle).etat;

t('l’étape courante se déduit de la phase du dernier événement', () => {
  const f = P.fluxLive({ events: [evtPhase('GUARDIAN_REVIEW', '2026-09-08T12:00:00Z')],
    projection: { guardians: { a: 'PASSED' } } });
  assert.strictEqual(etatDe(f, 'GUARDIANS'), 'courante');
  assert.strictEqual(etatDe(f, 'CLAUDE'), 'faite');
  assert.strictEqual(etatDe(f, 'TEST'), 'a_venir');
  assert.strictEqual(f.inconnue, false);
});

t('le DERNIER événement fait foi, quel que soit l’ordre de la liste', () => {
  const f = P.fluxLive({
    events: [evtPhase('CI', '2026-09-08T14:00:00Z'), evtPhase('EXECUTION', '2026-09-08T09:00:00Z')],
    projection: { guardians: {} } });
  assert.strictEqual(etatDe(f, 'TEST'), 'courante', 'CI est plus récent qu’EXECUTION');
});

t('ce qui attend un humain situe la chaîne mieux que la phase', () => {
  const pourFrederic = P.fluxLive({ events: [evtPhase('EXECUTION', '2026-09-08T12:00:00Z')],
    projection: { guardians: {}, human_gate: { who: 'frederic', question: 'Autoriser ?' } } });
  assert.strictEqual(etatDe(pourFrederic, 'FREDERIC'), 'courante');

  const pourOrchestrator = P.fluxLive({ events: [evtPhase('EXECUTION', '2026-09-08T12:00:00Z')],
    projection: { guardians: {}, human_gate: { who: 'orchestrator', question: 'Arbitrer ?' } } });
  assert.strictEqual(etatDe(pourOrchestrator, 'ORCHESTRATOR'), 'courante');
});

t('AUCUNE phase d’exécution ne peut désigner ton autorisation ni Production', () => {
  // L'invariant central de ce flux, et il a failli n'être qu'un décor.
  //
  // Une première version le portait par un garde explicite dans le rendu. Une
  // mutation l'a supprimé sans qu'aucune épreuve ne bronche : il était
  // INATTEIGNABLE, puisque aucune phase ne mène à ces étapes. Une protection
  // qu'aucun cas ne peut atteindre n'est pas une protection.
  //
  // L'invariant est donc vérifié là où il vit réellement : dans la table de
  // correspondance. Un événement d'exécution ne doit JAMAIS pouvoir rendre
  // courante l'étape qui appartient à Frédéric, ni celle de la mise en
  // service.
  for (const etape of P.ETAPES_JAMAIS_ATTEINTES_PAR_UN_EVENEMENT) {
    assert.ok(!Object.values(P.PHASE_VERS_ETAPE).includes(etape),
      `aucune phase ne doit mener à ${etape} : ` + JSON.stringify(P.PHASE_VERS_ETAPE));
  }
  // Et aucune phase du contrat, même future, ne doit y mener par accident.
  for (const phase of ['ANALYSE', 'EXECUTION', 'TEST', 'GUARDIAN_REVIEW', 'CI', 'GATE', 'DONE']) {
    const cle = P.etapeCourante([evtPhase(phase, '2026-09-08T12:00:00Z')], { guardians: {} });
    assert.ok(!P.ETAPES_JAMAIS_ATTEINTES_PAR_UN_EVENEMENT.includes(cle),
      `la phase ${phase} ne doit pas désigner ${cle}`);
  }
});

t('TON AUTORISATION et PRODUCTION ne se cochent JAMAIS toutes seules', () => {
  // Le point le plus important de ce flux. Aucune décision de recette ne vaut
  // autorisation de production : laisser l'écran marquer ces étapes « faites »
  // reviendrait à fabriquer l'autorisation qu'il a mission de seulement
  // transmettre.
  //
  // Le cas est réel : quand un gate attend Frédéric, toutes les étapes
  // antérieures sont « faites » — mais la sienne reste à venir, et Production
  // aussi.
  const f = P.fluxLive({ events: [], projection: { guardians: {}, human_gate: { who: 'frederic', question: '?' } } });
  assert.strictEqual(etatDe(f, 'FREDERIC'), 'courante');
  assert.strictEqual(etatDe(f, 'PRODUCTION'), 'a_venir');
  for (const e of f.etapes) {
    if (e.cle === 'FREDERIC' || e.cle === 'PRODUCTION') {
      assert.notStrictEqual(e.etat, 'faite', `${e.cle} ne doit jamais être marquée faite par l’écran`);
    }
  }
});

t('une garde en échec BLOQUE l’étape des contrôles, pas les autres', () => {
  const f = P.fluxLive({ events: [evtPhase('CI', '2026-09-08T12:00:00Z')],
    projection: { guardians: { a: 'FAILED', b: 'PASSED' } } });
  assert.strictEqual(etatDe(f, 'GUARDIANS'), 'bloquee');
  assert.notStrictEqual(etatDe(f, 'CLAUDE'), 'bloquee');
});

t('un risque structurel BLOQUE l’étape Production', () => {
  const barriere = { occurred_at: '2026-09-08T12:00:00Z', lot_id: 'L', status: 'BLOCKED',
    phase: 'GATE', evidence: { type: 'protection', ref: 'refs/heads/production' } };
  const f = P.fluxLive({ events: [barriere], projection: { guardians: {} } });
  assert.strictEqual(etatDe(f, 'PRODUCTION'), 'bloquee');
});

t('sans fait exploitable, le flux DIT qu’il ne sait pas', () => {
  // Une chaîne qui désigne une étape au hasard vaut moins qu'une chaîne qui
  // admet ne pas savoir — critère 8 de la doctrine Philosophie.
  for (const cas of [{ events: [], projection: { guardians: {} } },
    { events: null, projection: null },
    { events: [evtPhase('DONE', '2026-09-08T12:00:00Z')], projection: { guardians: {} } }]) {
    const f = P.fluxLive(cas);
    assert.strictEqual(f.inconnue, true, JSON.stringify(cas));
    assert.ok(f.etapes.every(e => e.etat === 'inconnue' || e.etat === 'bloquee'),
      'aucune étape ne doit être déclarée faite au hasard');
  }
});

t('les huit étapes de la chaîne sont là, dans l’ordre', () => {
  assert.strictEqual(P.ETAPES_FLUX.map(e => e.cle).join(' → '),
    'DEMANDE → ORCHESTRATOR → CLAUDE → GUARDIANS → TEST → PRET_PRODUCTION → FREDERIC → PRODUCTION');
  // « Prêt pour Production » est une PROPOSITION : son libellé doit le dire.
  const pret = P.ETAPES_FLUX.find(e => e.cle === 'PRET_PRODUCTION');
  assert.ok(/jamais une autorisation/.test(pret.qui), pret.qui);
});

t('CONTRAT — l’écran rend le flux, et dit quand il ne sait pas situer l’étape', () => {
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  assert.ok(/\$\{blocFlux\(flux\)\}/.test(ecran), 'le flux doit être rendu');
  assert.ok(/Où en est la chaîne/.test(ecran), 'et titré en langage d’exploitant');
  assert.ok(/mieux vaut ne pas savoir que désigner au hasard/.test(ecran),
    'l’écran doit DIRE qu’il ne sait pas situer l’étape, plutôt qu’en désigner une');
  // Le flux vient après « ce qui t'attend » et avant le détail technique.
  const g = gabaritRendu();
  const iAttente = g.indexOf('${blocAttente(projection.human_gate)}');
  const iFlux = g.indexOf('${blocFlux(flux)}');
  const iHisto = g.indexOf('Ce qui s’est passé');
  assert.ok(iAttente > 0 && iAttente < iFlux && iFlux < iHisto,
    'ordre attendu : ce qui t’attend, puis le flux, puis l’historique');
});


// ── LE TRAVAIL VIVANT (08/09/2026) ──────────────────────────────────────
// « Ton écran affiche "Agent actif : etat-deploiement", mais ce n'est pas ce
// que toi tu veux savoir. Tu veux savoir : que fait actuellement l'équipe ? »

const acteur = (role, id, t, lot) => ({ occurred_at: t, lot_id: lot || 'NEXUS-LIVE-CONTROL-CENTER-1-20260906',
  run_id: 'r', actor: { id, role }, phase: 'GUARDIAN_REVIEW', status: 'PASSED', summary: 's' });

t('le nom du lot est transformé MÉCANIQUEMENT, jamais réécrit', () => {
  // Inventer un joli titre raconterait autre chose que ce que le registre
  // contient. La transformation est prévisible, et l'identifiant technique
  // reste disponible à côté.
  assert.strictEqual(P.nommerLot('NEXUS-ORCHESTRATION-GUARDIANS-1-20260907'), 'Orchestration Guardians');
  assert.strictEqual(P.nommerLot('CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906'),
    'Carburants Performance Optimisation Camion');
  assert.strictEqual(P.nommerLot('NEXUS-LIVE-CONTROL-CENTER-1-20260906'), 'Live Control Center');
});

t('un identifiant vide ou illisible ne fabrique pas de titre', () => {
  for (const cas of [null, undefined, '', '   ', 42, {}]) {
    assert.strictEqual(P.nommerLot(cas), null, JSON.stringify(cas));
  }
});

t('le travail est décrit par RÔLE, en langage d’équipe', () => {
  const r = P.travailVivant({
    events: [acteur('guardian', 'qa', '2026-09-08T12:00:00Z'),
      acteur('guardian', 'bible', '2026-09-08T12:00:00Z'),
      acteur('execution', 'claude', '2026-09-08T12:00:00Z')],
    projection: { active_lots: ['NEXUS-LIVE-CONTROL-CENTER-1-20260906'] } });
  assert.strictEqual(r.titre, 'Live Control Center');
  assert.ok(r.lignes.includes('Claude développe'), JSON.stringify(r.lignes));
  assert.ok(r.lignes.some(l => /2 Guardians contrôlent/.test(l)), JSON.stringify(r.lignes));
  // Le nom technique reste accessible, il ne disparaît pas.
  assert.strictEqual(r.lotTechnique, 'NEXUS-LIVE-CONTROL-CENTER-1-20260906');
  memesElements(r.acteursTechniques, ['bible', 'claude', 'qa'], 'les acteurs techniques restent listés');
});

t('seul le DERNIER relevé compte, pas tout l’historique', () => {
  // Découper autrement (« les 10 derniers », « depuis 5 minutes ») ferait
  // dépendre l'affichage d'un réglage arbitraire, et montrerait comme « en
  // cours » un travail terminé depuis longtemps.
  const r = P.travailVivant({
    events: [acteur('execution', 'claude', '2026-09-08T09:00:00Z'),
      acteur('guardian', 'qa', '2026-09-08T12:00:00Z')],
    projection: {} });
  assert.ok(!r.lignes.includes('Claude développe'), 'le travail d’il y a trois heures n’est pas « en cours »');
  assert.ok(r.lignes.some(l => /1 Guardian contrôle/.test(l)), JSON.stringify(r.lignes));
});

t('ce qui attend un humain est dit en premier', () => {
  const pourToi = P.travailVivant({ events: [acteur('guardian', 'qa', '2026-09-08T12:00:00Z')],
    projection: { human_gate: { who: 'frederic', question: '?' } } });
  assert.strictEqual(pourToi.lignes[0], 'En attente de ta décision');

  const pourOrch = P.travailVivant({ events: [acteur('guardian', 'qa', '2026-09-08T12:00:00Z')],
    projection: { human_gate: { who: 'orchestrator', question: '?' } } });
  assert.strictEqual(pourOrch.lignes[0], 'L’Orchestrator arbitre');
});

t('aucune activité reconnue se DIT, au lieu de laisser un bloc vide', () => {
  // Un bloc vide se lit « rien ne fonctionne ». Ne pas reconnaître une
  // activité n'est pas la même chose que constater qu'il n'y en a pas.
  const r = P.travailVivant({
    events: [{ occurred_at: '2026-09-08T12:00:00Z', lot_id: 'L', run_id: 'r',
      actor: { id: 'x', role: 'inconnu-futur' }, phase: 'TEST', status: 'PASSED', summary: 's' }],
    projection: {} });
  assert.strictEqual(r.lignes.length, 1);
  assert.ok(/Aucune activité reconnue/.test(r.lignes[0]), r.lignes[0]);
  assert.strictEqual(r.inconnu, false, 'on a bien lu un relevé — c’est l’activité qui n’est pas reconnue');
});

t('sans aucun événement, le travail est INCONNU — pas « rien en cours »', () => {
  for (const cas of [[], null, undefined]) {
    const r = P.travailVivant({ events: cas, projection: {} });
    assert.strictEqual(r.inconnu, true, JSON.stringify(cas));
    vide(r.lignes, 'aucune ligne inventée');
    assert.strictEqual(r.titre, null);
  }
});

t('CONTRAT — l’écran dit ce que fait l’équipe, plus « Agent actif : … »', () => {
  const brut = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  const code = brut.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  assert.ok(gabaritRendu().includes('${blocEnCours(travail, projection)}'), 'le bloc « En cours » doit être rendu');
  assert.ok(!/Agent actif\s*:/.test(code), 'le nom technique ne doit plus être la première information');
  assert.ok(/Noms techniques/.test(code), 'mais il doit rester accessible, replié');

  // « Pas de "—" pour une prochaine étape sans explication. » Un tiret ne dit
  // pas s'il n'y a rien, ou si personne n'a regardé.
  assert.ok(!/\|\|\s*'—'/.test(code), 'aucun tiret muet ne doit subsister');
  assert.ok(/non renseignée par le dernier événement/.test(code),
    'une information absente doit dire POURQUOI elle l’est');

  // L'ordre des zones demandé : verdict, risques, en cours, ce qui t’attend, flux.
  const g = gabaritRendu();
  const ordre = ['${blocVerdict(verdict)}', '${blocRisques(verdict.risques)}',
    '${blocEnCours(travail, projection)}', '${blocAttente(projection.human_gate)}', '${blocFlux(flux)}']
    .map(m => g.indexOf(m));
  assert.ok(ordre.every((v, i) => v > 0 && (i === 0 || v > ordre[i - 1])),
    'les zones doivent se suivre dans l’ordre demandé : ' + JSON.stringify(ordre));
});

// ——— Le vocabulaire du cockpit ————————————————————————————————————————
// Frédéric, 08/09/2026 : « "Dette", "entrée(s)", "P0" … je les comprends, mais
// pas comme langage principal du cockpit. Les SHA doivent être du niveau
// expert. »

t('VOCABULAIRE — la dette se dit en sujets à traiter, pas en dette ni en P0', () => {
  const f = P.formulerDeploiements({
    compteurs: { en_developpement: 1, attente_arbitrage: 0, clos: 12 },
    dette: { total: 29, p0: 18 },
  });
  const texte = f.phrases.join(' ');
  assert.ok(/29 sujets restent à traiter/.test(texte), 'le total se dit en sujets : ' + texte);
  assert.ok(/18 prioritaires/.test(texte), 'les P0 se disent « prioritaires » : ' + texte);
  assert.ok(!/dette/i.test(texte), '« dette » ne doit plus être le langage principal : ' + texte);
  assert.ok(!/\bP0\b/.test(texte), '« P0 » ne doit plus être le langage principal : ' + texte);
  assert.ok(!/entrée/i.test(texte), '« entrée(s) » ne doit plus être le langage principal : ' + texte);
});

t('VOCABULAIRE — l’écart entre Production et le travail se dit en retard, pas en SHA', () => {
  const f = P.formulerDeploiements({
    compteurs: { en_developpement: 1, attente_arbitrage: 0, clos: 12 },
    ecart: { production: 'a1b2c3d', canonique: '9f8e7d6', commits: 242, fichiers: 87 },
  });
  const texte = f.phrases.join(' ');
  assert.ok(/Production est en retard sur la version de travail/.test(texte), texte);
  assert.ok(/242 évolutions séparent les deux états/.test(texte), texte);
  assert.ok(!texte.includes('a1b2c3d') && !texte.includes('9f8e7d6'),
    'aucune empreinte de commit dans le langage principal : ' + texte);

  // Elles ne disparaissent pas : elles descendent d'un étage.
  const tech = f.technique.map(x => `${x.libelle}=${x.valeur}`).join(' ');
  assert.ok(tech.includes('a1b2c3d') && tech.includes('9f8e7d6'),
    'les empreintes restent accessibles au niveau expert : ' + tech);
});

t('VOCABULAIRE — « Lots clos » devient « Terminés »', () => {
  const f = P.formulerDeploiements({ compteurs: { en_developpement: 2, attente_arbitrage: 0, clos: 12 } });
  const libelles = f.compteurs.map(c => c.libelle);
  assert.ok(libelles.includes('Terminés'), JSON.stringify(libelles));
  assert.ok(!libelles.some(l => /clos/i.test(l)), '« clos » se lisait comme un classement : ' + JSON.stringify(libelles));
  assert.ok(libelles.includes('En attente de ton arbitrage'), JSON.stringify(libelles));
  assert.strictEqual(f.compteurs[2].n, 12, 'le chiffre est relevé, pas recalculé');
});

t('VOCABULAIRE — l’accord singulier/pluriel suit le nombre', () => {
  const un = P.formulerDeploiements({
    compteurs: { en_developpement: 0, attente_arbitrage: 0, clos: 0 },
    dette: { total: 1, p0: 1 },
    ecart: { commits: 1, fichiers: 1 },
  }).phrases.join(' ');
  assert.ok(/1 sujet reste à traiter, dont 1 prioritaire\./.test(un), un);
  assert.ok(/1 évolution sépare les deux états \(1 fichier concerné\)\./.test(un), un);
});

t('VOCABULAIRE — zéro se dit, absence se tait', () => {
  const zero = P.formulerDeploiements({
    compteurs: { en_developpement: 0, attente_arbitrage: 0, clos: 0 },
    dette: { total: 0, p0: 0 },
    ecart: { commits: 0 },
  }).phrases.join(' ');
  assert.ok(/Aucun sujet en attente de traitement\./.test(zero), zero);
  assert.ok(/Production est à jour avec la version de travail\./.test(zero), zero);

  // Une mesure ABSENTE n'est pas une mesure nulle : ne rien annoncer plutôt
  // qu'un « aucun sujet » rassurant et faux.
  const sans = P.formulerDeploiements({ compteurs: { en_developpement: 0, attente_arbitrage: 0, clos: 0 } });
  assert.strictEqual(sans.phrases.length, 0, 'sans mesure, aucune phrase : ' + JSON.stringify(sans.phrases));
  assert.strictEqual(sans.technique.length, 0, 'et rien à afficher au niveau expert');

  const nul = P.formulerDeploiements({
    compteurs: { en_developpement: 0, attente_arbitrage: 0, clos: 0 },
    dette: { total: null, p0: null },
  });
  assert.strictEqual(nul.phrases.length, 0, 'un total à null n’est pas un total à zéro');
});

t('VOCABULAIRE — sans relevé de déploiement, on le dit', () => {
  assert.strictEqual(P.formulerDeploiements(null).inconnu, true);
  assert.strictEqual(P.formulerDeploiements({}).inconnu, true, 'un objet sans compteurs reste inconnu');
});

t('CONTRAT — l’écran ne réintroduit pas le vocabulaire technique', () => {
  const brut = fs.readFileSync(path.join(__dirname, 'NEXUS-Live-Developpement-v1.html'), 'utf8');
  const code = brut.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');

  assert.ok(/NexusLiveProjection\.formulerDeploiements\(dep\)/.test(code),
    'l’écran doit prendre son vocabulaire dans la projection, éprouvée, plutôt que le réécrire');

  // Ces mots ne sont pas interdits dans NEXUS : ils sont interdits comme
  // libellé fabriqué par l'écran, hors du détail replié.
  assert.ok(!/Dette ouverte au Backlog/.test(code), '« Dette ouverte au Backlog » ne doit plus être écrit par l’écran');
  assert.ok(!/>Lots clos</.test(code), '« Lots clos » ne doit plus être écrit par l’écran');
  assert.ok(!/canonique <code>/.test(code), 'les SHA ne doivent plus être affichés au premier niveau');
  // Constater que le texte EXISTE dans le fichier ne prouve pas qu'il est
  // AFFICHÉ : supprimer `${technique}` du gabarit laissait sa définition en
  // place, et l'épreuve passait toujours. On regarde donc dans le bloc rendu.
  const iBloc = code.indexOf('function blocDeploiements');
  const bloc = code.slice(iBloc, code.indexOf('\n  function ', iBloc + 1));
  assert.ok(/<summary>Repères techniques<\/summary>/.test(bloc),
    'mais ils doivent rester accessibles, repliés');
  assert.ok(/\$\{technique\}/.test(bloc),
    'et le niveau expert doit être réellement inséré dans le gabarit, pas seulement défini');
  assert.ok(/\$\{phrases\}/.test(bloc), 'comme les phrases en langage clair');
});

console.log(`\n${n} assertions Live-Projection passées.`);
