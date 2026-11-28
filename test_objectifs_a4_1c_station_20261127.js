'use strict';
// A4-1c : carte « Objectif de marge de la station » (niveau defaut), formulaire empilé, confirmation.
const assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const base = (o) => Object.assign({ userId: 'u2', objectifs: [], propositions: [], droitsObjectif: { proposer: true, valider: true } }, o || {});
const ligne = (o) => Object.assign({ niveau: 'defaut', cible_niveau: 'defaut', cible: 0.28, statut_cible: 'valide', id: 'id1' }, o || {});
const prop = (o) => Object.assign({ id: 'p1', niveau: 'defaut', cible_niveau: 'defaut', cible: 0.3, propose_par: 'u1', statut: 'ouverte' }, o || {});

t('non défini : titre, phrase du Brief, formulaire empilé avec % et exemple', () => {
  const h = E.htmlObjectifStation(base());
  assert.ok(h.includes('Objectif de marge de la station'));
  assert.ok(h.includes('data-objectif-statut="non_defini"') && h.includes('non défini'));
  assert.ok(h.includes('Le Brief note la marge à partir de cet objectif.'));
  assert.ok(h.includes('placeholder="ex. 28"') && h.includes('class="pt-obj-pct"'));
  assert.ok(h.includes('data-niveau="defaut"') && h.includes('data-cible-niveau="defaut"'));
  assert.ok(/<label[^>]*for="pt-obj-cible-station"/.test(h));
});
t('proposition en attente : visible, pas de nouveau formulaire', () => {
  const h = E.htmlObjectifStation(base({ propositions: [prop()] }));
  assert.ok(h.includes('data-objectif-proposition="p1"') && h.includes('en attente de validation'));
  assert.ok(h.includes('data-objectif-valider="p1"'));
  assert.ok(!h.includes('data-objectif-proposer'));
});
t('auteur : pas de bouton Valider', () => {
  const h = E.htmlObjectifStation(base({ userId: 'u1', propositions: [prop()] }));
  assert.ok(!h.includes('data-objectif-valider'));
  assert.ok(h.includes('Un autre compte doit valider votre proposition.'));
});
t('défini valide', () => {
  const h = E.htmlObjectifStation(base({ objectifs: [ligne()] }));
  assert.ok(h.includes('data-objectif-statut="valide"'));
  assert.ok(!h.includes('data-objectif-valider'));
});
t('sans droits : lecture seule, aucun bouton', () => {
  const h = E.htmlObjectifStation(base({ droitsObjectif: {} }));
  assert.ok(h.includes('Lecture seule'));
  assert.ok(!h.includes('data-objectif-proposer') && !h.includes('data-objectif-valider'));
});
t('confirmation visible dans la bonne carte seulement', () => {
  const m = { zone: 'station', texte: 'Proposition enregistrée : un autre compte doit la valider.' };
  assert.ok(E.htmlObjectifStation(base({ objectifMsg: m })).includes(m.texte));
  assert.ok(!E.htmlObjectifMarge({ famille: 'EAUX' }, base({ objectifMsg: m })).includes(m.texte));
});
t('deux cartes : identifiants distincts', () => {
  const a = E.htmlObjectifStation(base()), b = E.htmlObjectifMarge({ famille: 'EAUX' }, base());
  assert.ok(a.includes('id="pt-obj-cible-station"') && b.includes('id="pt-obj-cible-fiche"'));
});
console.log(n + ' tests');
