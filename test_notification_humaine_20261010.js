// Notification humaine vérifiable (préparation Fast Track, 10/10/2026) —
// « sans confondre commentaire GitHub et réception ». Chaque épreuve mute une
// seule condition de `verifierConfirmation`.
'use strict';
const assert = require('assert');
const {
  ETATS, construireNotificationStop, verifierConfirmation, rapportCapacite,
} = require('./outils/notification-humaine.js');

let total = 0, passes = 0;
function verifier(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  OK — ${nom}`); }
  catch (e) { console.error(`  ÉCHEC — ${nom}\n    ${e.stack}`); }
}

const JETON = 'TEMOIN-ABC123';

verifier('construireNotificationStop() produit un corps contenant les 4 champs du contrat et l\'état PUBLIE', () => {
  const n = construireNotificationStop({ lot: 'LOT-X', motif: 'CI_ROUGE', horodate: '2026-10-10T12:00:00.000Z', jetonTemoin: JETON });
  assert.strictEqual(n.etat, ETATS.PUBLIE);
  assert.ok(n.corps.includes('LOT: LOT-X'));
  assert.ok(n.corps.includes('MOTIF: CI_ROUGE'));
  assert.ok(n.corps.includes(JETON));
});

verifier('construireNotificationStop() refuse si un champ obligatoire manque', () => {
  assert.throws(() => construireNotificationStop({ lot: 'LOT-X', motif: 'CI_ROUGE', horodate: '2026-10-10T12:00:00.000Z' }));
});

verifier('aucun commentaire -> PUBLIE seulement, receptionConfirmee=false (jamais supposée)', () => {
  const r = verifierConfirmation({ commentaires: [], compteAttendu: 'vito-sainte-marie', jetonTemoin: JETON, depuisISO: '2026-10-10T12:00:00.000Z' });
  assert.strictEqual(r.receptionConfirmee, false);
  assert.strictEqual(r.etat, ETATS.PUBLIE);
});

verifier('une réponse du bon compte, après l\'envoi, citant le jeton -> CONFIRME', () => {
  const r = verifierConfirmation({
    commentaires: [{ auteur: 'vito-sainte-marie', horodate: '2026-10-10T12:05:00.000Z', corps: `reçu, je m'en occupe ${JETON}` }],
    compteAttendu: 'vito-sainte-marie', jetonTemoin: JETON, depuisISO: '2026-10-10T12:00:00.000Z',
  });
  assert.strictEqual(r.etat, ETATS.CONFIRME);
  assert.strictEqual(r.receptionConfirmee, true);
  assert.strictEqual(r.preuve.auteur, 'vito-sainte-marie');
});

verifier('une réponse ANTÉRIEURE à l\'envoi ne compte pas comme confirmation', () => {
  const r = verifierConfirmation({
    commentaires: [{ auteur: 'vito-sainte-marie', horodate: '2026-10-10T11:00:00.000Z', corps: `à propos ${JETON}` }],
    compteAttendu: 'vito-sainte-marie', jetonTemoin: JETON, depuisISO: '2026-10-10T12:00:00.000Z',
  });
  assert.strictEqual(r.receptionConfirmee, false);
});

verifier('une réponse d\'un autre compte ne compte pas comme confirmation', () => {
  const r = verifierConfirmation({
    commentaires: [{ auteur: 'claude', horodate: '2026-10-10T12:05:00.000Z', corps: `exécution ${JETON}` }],
    compteAttendu: 'vito-sainte-marie', jetonTemoin: JETON, depuisISO: '2026-10-10T12:00:00.000Z',
  });
  assert.strictEqual(r.receptionConfirmee, false);
});

verifier('une réponse du bon compte SANS le jeton-témoin ne compte pas — un simple commentaire GitHub n\'est pas une réception', () => {
  const r = verifierConfirmation({
    commentaires: [{ auteur: 'vito-sainte-marie', horodate: '2026-10-10T12:05:00.000Z', corps: 'ok merci' }],
    compteAttendu: 'vito-sainte-marie', jetonTemoin: JETON, depuisISO: '2026-10-10T12:00:00.000Z',
  });
  assert.strictEqual(r.receptionConfirmee, false);
  assert.strictEqual(r.etat, ETATS.PUBLIE);
});

verifier('verifierConfirmation() refuse un appel mal formé plutôt que de retourner un faux négatif silencieux', () => {
  assert.throws(() => verifierConfirmation({ commentaires: 'pas-un-tableau', compteAttendu: 'x', jetonTemoin: JETON }));
  assert.throws(() => verifierConfirmation({ commentaires: [], compteAttendu: 'x' }));
});

verifier('rapportCapacite() classe la réception humaine en HUMAN, jamais en VERIFIED — capacité manquante déclarée, pas fabriquée', () => {
  const r = rapportCapacite();
  assert.ok(r.reception.startsWith('HUMAN'), r.reception);
  assert.ok(!r.reception.startsWith('VERIFIED'));
  assert.ok(r.capacite_manquante.length > 0);
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
