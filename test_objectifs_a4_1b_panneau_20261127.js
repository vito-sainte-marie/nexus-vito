'use strict';
// A4-1b : panneau « Objectifs de marge » de la fiche (recette M1 à M7, côté rendu).
const assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const l = { famille: 'EAUX', rayon: 'EPICERIE', article: 'x' };
const ligne = (o) => Object.assign({ niveau: 'famille', cible_niveau: 'EAUX', cible: 0.3, statut_cible: 'valide', saisi_par: 'u1', id: 'id1' }, o || {});
const base = (o) => Object.assign({ userId: 'u2', objectifs: [], droitsObjectif: { proposer: true, valider: true } }, o || {});

t('pourcentVersFraction', () => {
  assert.strictEqual(E.pourcentVersFraction('30'), 0.3);
  assert.strictEqual(E.pourcentVersFraction('30,5 %'), 0.305);
  assert.strictEqual(E.pourcentVersFraction(''), null);
  assert.strictEqual(E.pourcentVersFraction('100'), null);
  assert.strictEqual(E.pourcentVersFraction('abc'), null);
});
t('niveau : famille puis rayon', () => {
  assert.strictEqual(E.niveauObjectif(l).niveau, 'famille');
  assert.strictEqual(E.niveauObjectif({ rayon: 'R' }).niveau, 'rayon');
});
t('non défini', () => {
  const h = E.htmlObjectifMarge(l, base());
  assert.ok(h.includes('data-objectif-statut="non_defini"'));
  assert.ok(h.includes("aucune note d'équipe") || h.includes('aucune note d’équipe'));
  assert.ok(h.includes('data-objectif-proposer'));
});
t('défini valide : pas de bouton valider', () => {
  const h = E.htmlObjectifMarge(l, base({ objectifs: [ligne()] }));
  assert.ok(h.includes('data-objectif-statut="valide"'));
  assert.ok(!h.includes('data-objectif-valider'));
});
t('indicatif : valider visible pour un autre compte', () => {
  const h = E.htmlObjectifMarge(l, base({ objectifs: [ligne({ statut_cible: 'indicatif' })] }));
  assert.ok(h.includes('data-objectif-statut="indicatif"'));
  assert.ok(h.includes('data-objectif-valider="id1"'));
});
t('indicatif : valider caché pour le proposant', () => {
  const h = E.htmlObjectifMarge(l, base({ userId: 'u1', objectifs: [ligne({ statut_cible: 'indicatif' })] }));
  assert.ok(!h.includes('data-objectif-valider'));
  assert.ok(h.includes('Un autre compte doit valider'));
});
t('sans droit : lecture seule', () => {
  const h = E.htmlObjectifMarge(l, base({ droitsObjectif: { proposer: false, valider: false } }));
  assert.ok(!h.includes('data-objectif-proposer'));
});
t('messages d erreur', () => {
  assert.ok(E.messageErreurObjectif({ message: 'objectif_auto_validation_interdite' }).length > 10);
  assert.ok(E.messageErreurObjectif('marge_cible_invalide').length > 10);
  assert.ok(E.messageErreurObjectif({ message: 'inconnu' }).length > 10);
});
console.log(n + ' épreuves');
