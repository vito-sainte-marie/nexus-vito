'use strict';
// A4-1f, recette visuelle de Guardian : plancher sans cible, statut du plancher, « hors vue » après coupe,
// aide, icône, récapitulatif, proposition vide. Présentation seulement. Valeurs fictives.
const assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
// A4-1f-bis : la carte est repliée par défaut ; ces épreuves portent sur son corps, donc déplié sauf indication contraire.
const htmlReplie = E.htmlObjectifsFamilles;
E.htmlObjectifsFamilles = (e) => htmlReplie(Object.assign({}, e, { groupe: Object.assign({ ouvert: true }, e && e.groupe) }));
function t(nom, f) { Promise.resolve().then(f).then(() => console.log('OK ' + nom), e => { console.error('AssertionError: ' + nom + ' : ' + String(e.message).split('\n')[0]); process.exitCode = 1; }); }
const lg = (famille, ca) => ({ famille, ca_ht: ca, article: famille + '1' });
const reg = (f, c, sc, m, sm) => ({ niveau: 'famille', cible_niveau: f, cible: c, minimum: m, statut_cible: sc, statut_minimum: sm, id: 'o-' + f });
const base = (o) => Object.assign({ userId: 'u2', analyse: { lignes: [lg('Boissons', 500), lg('Epicerie', 900), lg('Jus', 300)] },
  objectifs: [], propositions: [], droitsObjectif: { proposer: true, valider: true }, groupe: {} }, o || {});

t('plancher sans cible : ligne gardée, badge « Non définie », non proposable', () => {
  const e = base({ objectifs: [reg('Jus', null, null, 0.2, 'indicatif')] });
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('20,0 %'), 'plancher affiché');
  const l = E.lignesObjectifsFamilles(e).filter(o => o.famille === 'Jus')[0];
  assert.strictEqual(l.ligne, null); assert.ok(l.ligneMin); assert.strictEqual(E.cleStatut(l), 'non_defini');
  assert.deepStrictEqual(E.selectionRapide(e, 'toutes'), []);
});
t('statut du plancher écrit quand il diffère de celui de la cible', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [reg('Epicerie', 0.4, 'valide', 0.2, 'indicatif')] }));
  assert.ok(h.includes('data-objf-plancher-statut="indicatif"'));
  const h2 = E.htmlObjectifsFamilles(base({ objectifs: [reg('Epicerie', 0.4, 'valide', 0.2, 'valide')] }));
  assert.ok(!h2.includes('data-objf-plancher-statut'));
});
t('hors vue compté après la coupe à 10 lignes, détail par statut', () => {
  const noms = []; for (let i = 0; i < 12; i++) noms.push('F' + String(i).padStart(2, '0'));
  const e = base({ analyse: { lignes: noms.map((f, i) => lg(f, 1000 - i)) }, objectifs: noms.map(f => reg(f, 0.3, 'indicatif', 0.1, 'indicatif')) });
  e.groupe = { selProposer: ['F00', 'F11'] };
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('dont 1 hors de la vue'), 'F11 est coupée');
  assert.ok(h.includes('2 indicatives'));
});
t('aide : formulations du registre', () => {
  const h = E.htmlObjectifsFamilles(base());
  assert.ok(h.includes('valeur de travail du registre, pas encore validée') && h.includes('valeur provisoire, sans historique suffisant'));
});
t('icône d\'en-tête : module Produits', () => {
  const h = E.htmlObjectifsFamilles(base());
  assert.ok(h.includes('data-objf-icone="mod-produits"'));
});
t('récapitulatif : plancher par ligne et avis sur les cibles non indicatives', () => {
  const e = base({ objectifs: [reg('Jus', 0.3, 'a_l_etude', 0.2, 'indicatif')], groupe: { selProposer: ['Jus'], confirmer: { mode: 'proposer' } } });
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('plancher 20,0 %'));
  assert.ok(h.includes('1 cible n\'est pas indicative'));
});
t('« Proposition : aucune » masqué sur les cartes', () => {
  const e = base({ objectifs: [reg('Epicerie', 0.4, 'indicatif', 0.2, 'indicatif')], groupe: { vue: 'cartes' } });
  const h = E.htmlObjectifsFamilles(Object.assign(e, { cartes: true }));
  assert.ok(!h.includes('Proposition : <span class="sc-note">aucune'));
});
t('barre de sélection : après la liste sur mobile (collée en bas), avant sur bureau', () => {
  const o = [reg('Epicerie', 0.4, 'indicatif', 0.2, 'indicatif')];
  const mob = E.htmlObjectifsFamilles(base({ objectifs: o, largeur: 375, groupe: { selProposer: ['Epicerie'] } }));
  const bur = E.htmlObjectifsFamilles(base({ objectifs: o, largeur: 1280, groupe: { selProposer: ['Epicerie'] } }));
  assert.strictEqual((mob.match(/data-objf-barre/g) || []).length, 1);
  assert.ok(mob.indexOf('data-objf-barre') > mob.indexOf('data-objf-cartes'), 'mobile : barre après les cartes');
  assert.ok(bur.indexOf('data-objf-barre') < bur.indexOf('pt-objf-table'), 'bureau : barre avant le tableau');
});
