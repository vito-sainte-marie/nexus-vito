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

// Assemblage depuis les lignes en baseAsm : cas Heineken 14 / 48 / 30, PMP avant promotion mémorisé.
const baseAsm = {
  campagne: { date_debut: '2026-11-12' },
  objectifs: [{ article: 'Heineken', version: 1, pa_habituel_ht: 1.18, pa_promo_ht: 0.94, pv_habituel_ttc: 2.4, tva_pct: 20, ventes_ref_jour: 2 }],
  depart: [{ article: 'Heineken', version: 1, quantite: 14 }],
  livraisons: [{ id: 'l1', date_livraison: '2026-11-13', cree_le: '2026-11-13T10:00' }],
  lignesLivraison: [{ livraison_id: 'l1', article: 'Heineken', unites: 48, pa_ht_facture: 0.94 }],
  point: { date_fin: '2026-11-20', lignes: [{ article: 'Heineken', quantite: 30, ca_ht: 50 }] },
  pmp: [{ article: 'Heineken', version: 1, pmp_ht: 1.18, date_reference: '2026-11-09' }],
  actualises: new Map([['Heineken', 1.18]]),
};
const r1A = B.bilanCampagne(baseAsm);
assert.strictEqual(r1A.articles[0].cout_ventes, 31.56);
assert.strictEqual(r1A.articles[0].stock_restant.unites, 32);
assert.strictEqual(r1A.pertes, 'pertes non renseignées');
assert.strictEqual(r1A.arrete_au, '2026-11-20');

// Non-écrasement : un import Decenium ultérieur change le PMP actualisé, jamais le PMP avant promotion.
const r2A = B.bilanCampagne(Object.assign({}, baseAsm, { actualises: new Map([['Heineken', 1.31]]) }));
assert.strictEqual(r2A.articles[0].prix.pmp_avant_promotion, 1.18);
assert.strictEqual(r2A.articles[0].prix.pmp_actualise, 1.31);
assert.strictEqual(r2A.articles[0].marge_promotion, r1A.articles[0].marge_promotion);

// Une correction versionnée : la version la plus haute fait foi, la précédente reste en baseAsm.
const r3A = B.bilanCampagne(Object.assign({}, baseAsm, { pmp: baseAsm.pmp.concat([{ article: 'Heineken', version: 2, pmp_ht: 1.2, date_reference: '2026-11-09' }]) }));
assert.strictEqual(r3A.articles[0].prix.pmp_avant_promotion, 1.2);

// Aucune référence : « absent », marge estimée avec sa raison.
const r4A = B.bilanCampagne(Object.assign({}, baseAsm, { pmp: [] }));
assert.strictEqual(r4A.articles[0].reference.statut, 'absent');
assert.strictEqual(r4A.articles[0].estimee, true);

// Les douze désignations réelles Petromix traversent l'assemblage sans confusion d'article.
const nomsA = ['Biere Heineken 0.0 25 cl - 24P', 'Bisc Oreo 66gr -20P', 'Quadratini chocolate 125g -12P', 'Quadratini napoliter 125g - 12P', 'Quadratini vanille 125g -12P', 'Pringles Origl 175g - 19P', 'Chips Lays Nature 75gr - 15P', 'Eau didier gazeux 50 cl -8P', 'Schweppes agrumes 50cl -8P', 'Schweppes pomme 50cl -8P', 'Schweppes Tonic 50cl -8P', 'Jus caresse 50cl TS PARF'];
const grandA = {
  campagne: { date_debut: '2026-11-12' },
  objectifs: nomsA.map((n, k) => ({ article: n, version: 1, pa_habituel_ht: 1 + k / 10, pa_promo_ht: 0.9, pv_habituel_ttc: 2.4, tva_pct: 20, ventes_ref_jour: 1 })),
  depart: nomsA.map(n => ({ article: n, version: 1, quantite: 10 })),
  livraisons: [{ id: 'l1', date_livraison: '2026-11-13', cree_le: 'x' }],
  lignesLivraison: nomsA.map(n => ({ livraison_id: 'l1', article: n, unites: 24, pa_ht_facture: 0.9 })),
  point: { date_fin: '2026-11-20', lignes: nomsA.map((n, k) => ({ article: n, quantite: k + 1, ca_ht: 2 * (k + 1) })) },
  pmp: nomsA.map((n, k) => ({ article: n, version: 1, pmp_ht: 1 + k / 10, date_reference: '2026-11-09' })),
  actualises: new Map(),
};
const rgA = B.bilanCampagne(grandA);
assert.strictEqual(rgA.articles.length, 12);
nomsA.forEach((n, k) => {
  const a = rgA.articles.find(x => x.article === n);
  assert.ok(a, n);
  assert.strictEqual(a.prix.pmp_avant_promotion, 1 + k / 10, n);
  assert.strictEqual(a.stock_restant.unites, 10 + 24 - (k + 1), n);
});
assert.strictEqual(rgA.totaux.estimee, false);

// --- Économie attendue sur la page Achats : information seule, quantité inchangée.
{
  const A = require('./nexus-campagne-achats.js');
  const camp = { id: 'c', date_debut: '2026-11-12', date_fin: '2026-12-12' };
  const mk = pmp => ({ reglages: [], conds: [], depart: [{ article: 'HEINEKEN', version: 1, quantite: 14, date_stock: '2026-11-11', a_confirmer: false }], livraisons: [], livraisonsAnnulations: [], lignesLivraison: [], points: [{ batch_id: 'b1', article: 'HEINEKEN', date_fin: '2026-11-13', importe_le: '2026-11-14T08:00:00Z', quantite: 2 }], ventesAnnulations: [], commandes: [], lignesCommande: [], commandesAnnulations: [], clotures: [], liens: [], alias: [],
    objectifs: [{ article: 'HEINEKEN', version: 1, objectif_valide_jour: 10, ventes_ref_jour: 4, pa_promo_ht: 0.94 }], pmp });
  const ctx = A.recommandationsCampagne({ campagne: camp, donnees: mk([{ article: 'HEINEKEN', version: 1, pmp_ht: 1.18, date_reference: '2026-11-09' }]), aujourdhui: '2026-11-14' });
  const r = ctx.reco[0];
  assert.ok(r.b.a_commander > 0, 'le cas doit produire une recommandation');
  {
    assert.strictEqual(r.eco.montant_ht, Math.round(r.b.a_commander * 0.24 * 100) / 100);
    assert.strictEqual(r.eco.indicative, false);
  }
  const ctx2 = A.recommandationsCampagne({ campagne: camp, donnees: mk([{ article: 'HEINEKEN', version: 1, pmp_ht: 1.18, date_reference: '2026-11-20' }]), aujourdhui: '2026-11-14' });
  assert.strictEqual(ctx2.reco[0].eco.indicative, true);
  assert.strictEqual(ctx2.reco[0].b.a_commander, r.b.a_commander, 'la quantité recommandée ne dépend pas du PMP');
  assert.strictEqual(A.recommandationsCampagne({ campagne: camp, donnees: mk([]), aujourdhui: '2026-11-14' }).reco[0].eco, null);
}
console.log('OK test_campagne_c5_bilan_20261115');
