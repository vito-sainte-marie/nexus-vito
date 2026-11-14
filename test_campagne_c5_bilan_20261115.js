// C5 : bilan de promotion, valorisation FIFO analytique, quatre prix, cinq grandeurs.
const assert = require('assert');
const B = require('./nexus-campagne-bilan.js');

// Heineken : 14 unités à 1,18, livraison de 48 à 0,94, 30 ventes.
const heineken = {
  stockDepart: { unites: 14, pmp: 1.18 },
  livraisons: [{ unites: 48, pa_ht_facture: 0.94, date_livraison: '2026-11-12', cree_le: '2026-11-12T08:00:00Z' }],
  unitesVendues: 30,
};
const f = B.imputerFifo(heineken);
assert.strictEqual(f.cout_ventes, 31.56);
assert.strictEqual(f.restant.length, 1);
assert.strictEqual(f.restant[0].unites, 32);
assert.strictEqual(f.restant[0].pa, 0.94);
assert.strictEqual(f.estimee, false);

// Deux livraisons, mêmes dates : tri sur cree_le.
const g = B.imputerFifo({
  stockDepart: { unites: 0 },
  livraisons: [
    { unites: 10, pa_ht_facture: 2, date_livraison: '2026-11-12', cree_le: '2026-11-12T10:00:00Z' },
    { unites: 10, pa_ht_facture: 1, date_livraison: '2026-11-12', cree_le: '2026-11-12T09:00:00Z' },
  ],
  unitesVendues: 15,
});
assert.strictEqual(g.cout_ventes, 20); // 10 x 1 puis 5 x 2
assert.strictEqual(g.restant[0].unites, 5);
assert.strictEqual(g.restant[0].pa, 2);

// Ventes au-dessus du stock : excédent signalé, estimée.
const h = B.imputerFifo({ stockDepart: { unites: 5, pmp: 1 }, livraisons: [], unitesVendues: 8 });
assert.strictEqual(h.excedent_unites, 3);
assert.strictEqual(h.estimee, true);
assert.strictEqual(h.cout_ventes, 5);

// Livraison sans PA facturé : valorisée au PA promo, estimée.
const i = B.imputerFifo({ stockDepart: { unites: 0 }, livraisons: [{ unites: 4, pa_ht_facture: null, pa_promo_ht: 0.9, date_livraison: '2026-11-12' }], unitesVendues: 2 });
assert.strictEqual(i.cout_ventes, 1.8);
assert.strictEqual(i.estimee, true);

// Fiabilité du PMP avant promotion.
assert.strictEqual(B.fiabiliteReference({ pmp_ht: 1.18, date_reference: '2026-11-09' }, '2026-11-12', '2026-11-12').statut, 'fiable');
assert.strictEqual(B.fiabiliteReference({ pmp_ht: 1.18, date_reference: '2026-11-13' }, '2026-11-12', null).statut, 'a_confirmer');
assert.strictEqual(B.fiabiliteReference({ pmp_ht: 1.18, date_reference: '2026-11-12' }, '2026-11-12', '2026-11-12').statut, 'a_confirmer');
assert.strictEqual(B.fiabiliteReference({ pmp_ht: 1.18, date_reference: '2026-11-11' }, '2026-11-12', '2026-11-10').statut, 'a_confirmer');
const absent = B.fiabiliteReference(null, '2026-11-12', null);
assert.strictEqual(absent.statut, 'absent');
assert.strictEqual(absent.raison, 'PMP avant promotion absent');

// Bilan complet : cinq grandeurs, aucun double compte.
const base = {
  ca_ht_promo: 30 * 1.5, unitesVendues: 30,
  pmp_avant: { pmp_ht: 1.18, date_reference: '2026-11-09' }, pmp_actualise: 1.05, pa_promo_negocie: 0.94,
  pv_habituel_ht: 1.6, ventes_ref_jour: 2, jours_couverts: 10, date_debut: '2026-11-12',
  stockDepart: { unites: 14 }, livraisons: heineken.livraisons,
};
const b = B.bilanArticle(base);
assert.strictEqual(b.cout_ventes, 31.56);
assert.strictEqual(b.marge_promotion, 13.44);
assert.strictEqual(b.marge_reference, 8.4); // 2 x 10 x (1,6 - 1,18)
assert.strictEqual(b.gain_perte_vs_habituel, 5.04);
assert.strictEqual(b.stock_restant.unites, 32);
assert.strictEqual(b.stock_restant.valeur_ht, 30.08);
assert.strictEqual(b.economie_achat_stock_restant, 7.68); // 32 x (1,18 - 0,94)
assert.strictEqual(b.marge_potentielle_apres, 21.12);     // 32 x (1,6 - 0,94)
assert.strictEqual(b.dont_economie_achat, b.economie_achat_stock_restant);
assert.strictEqual(b.estimee, false);
assert.strictEqual(b.prix.pmp_avant_promotion, 1.18);
assert.strictEqual(b.prix.pmp_actualise, 1.05);
assert.ok(b.methode.indexOf('Méthode Campagne (FIFO analytique)') === 0);
assert.strictEqual(b.libelle_prix, 'PMP Decenium');

// Mise à jour Decenium après lancement : le PMP avant promotion ne bouge pas.
const b2 = B.bilanArticle(Object.assign({}, base, { pmp_actualise: 0.8 }));
assert.strictEqual(b2.prix.pmp_avant_promotion, 1.18);
assert.strictEqual(b2.prix.pmp_actualise, 0.8);
assert.strictEqual(b2.marge_promotion, b.marge_promotion);

// Référence à confirmer : estimée avec sa raison, jamais silencieuse.
const b3 = B.bilanArticle(Object.assign({}, base, { pmp_avant: { pmp_ht: 1.18, date_reference: '2026-11-13' } }));
assert.strictEqual(b3.estimee, true);
assert.ok(b3.raisons.indexOf('référence à confirmer') >= 0);
// PMP absent.
const b4 = B.bilanArticle(Object.assign({}, base, { pmp_avant: null }));
assert.strictEqual(b4.estimee, true);
assert.ok(b4.raisons.indexOf('PMP avant promotion absent') >= 0);
assert.strictEqual(b4.economie_achat_stock_restant, null);

// Totaux : somme des composantes, (4) et (5) jamais additionnées.
const t = B.totaux([b, b]);
assert.strictEqual(t.marge_promotion, 26.88);
assert.strictEqual(t.economie_achat_stock_restant, 15.36);
assert.strictEqual(t.marge_potentielle_apres, 42.24);
assert.ok(!('total_cumule' in t));

// Économie attendue : quantité recommandée inchangée, indicative si référence à confirmer.
const e = B.economieAttendue(48, { pmp_ht: 1.18, date_reference: '2026-11-09' }, 0.94, '2026-11-12', null);
assert.deepStrictEqual(e, { montant_ht: 11.52, indicative: false });
assert.strictEqual(B.economieAttendue(48, { pmp_ht: 1.18, date_reference: '2026-11-13' }, 0.94, '2026-11-12', null).indicative, true);
assert.strictEqual(B.economieAttendue(48, null, 0.94, '2026-11-12', null), null);
console.log('OK test_campagne_c5_bilan_20261115');
