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
const prop = (o) => Object.assign({ id: 'p1', niveau: 'famille', cible_niveau: 'EAUX', cible: 0.35, propose_par: 'u1', statut: 'ouverte' }, o || {});
t('M8 : proposition ouverte, la cible validée reste affichée en place', () => {
  const h = E.htmlObjectifMarge(l, base({ objectifs: [ligne()], propositions: [prop()] }));
  assert.ok(h.includes('data-objectif-statut="valide"'));
  assert.ok(h.includes('data-objectif-proposition="p1"'));
  assert.ok(h.includes('en attente de validation'));
  assert.ok(!h.includes('data-objectif-proposer'), 'une seule proposition ouverte par clé');
});
t('proposition : valider visible pour un autre compte, avec l id de la proposition', () => {
  const h = E.htmlObjectifMarge(l, base({ objectifs: [ligne()], propositions: [prop()] }));
  assert.ok(h.includes('data-objectif-valider="p1"'));
  assert.ok(h.includes('data-objectif-retirer="p1"'));
  assert.ok(h.includes('data-objectif-motif'));
});
t('proposition : valider caché pour l auteur, retrait possible', () => {
  const h = E.htmlObjectifMarge(l, base({ userId: 'u1', objectifs: [ligne()], propositions: [prop()] }));
  assert.ok(!h.includes('data-objectif-valider'));
  assert.ok(h.includes('Un autre compte doit valider'));
  assert.ok(h.includes('data-objectif-retirer="p1"'));
});
t('proposition d un autre niveau ignorée', () => {
  const h = E.htmlObjectifMarge(l, base({ objectifs: [ligne()], propositions: [prop({ cible_niveau: 'AUTRE' })] }));
  assert.ok(!h.includes('data-objectif-proposition'));
});
t('sans droit : proposition visible, aucune action', () => {
  const h = E.htmlObjectifMarge(l, base({ droitsObjectif: { proposer: false, valider: false }, objectifs: [ligne()], propositions: [prop()] }));
  assert.ok(h.includes('data-objectif-proposition="p1"'));
  assert.ok(!h.includes('data-objectif-valider') && !h.includes('data-objectif-retirer'));
});
t('sans droit : lecture seule', () => {
  const h = E.htmlObjectifMarge(l, base({ droitsObjectif: { proposer: false, valider: false } }));
  assert.ok(!h.includes('data-objectif-proposer'));
});
t('messages d erreur', () => {
  assert.ok(E.messageErreurObjectif({ message: 'objectif_auto_validation_interdite' }).length > 10);
  assert.ok(E.messageErreurObjectif('marge_cible_invalide').length > 10);
  assert.ok(E.messageErreurObjectif('marge_cible_proposition_existante').includes('proposition'));
  assert.ok(E.messageErreurObjectif('marge_cible_motif_requis').includes('motif'));
  assert.ok(E.messageErreurObjectif({ message: 'inconnu' }).length > 10);
});
console.log(n + ' épreuves');
