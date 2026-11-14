const assert = require('assert');
const S = require('./nexus-campagne-stock.js');
let n = 0; const t = (nom, f) => { f(); n++; };

t('conversion carton vers unités, plusieurs articles', () => {
  assert.strictEqual(S.convertirLigne({ cartons: 3, unitesParCarton: 12 }).unites, 36);
  assert.strictEqual(S.convertirLigne({ cartons: 2, unitesParCarton: 24 }).unites, 48);
});
t('carton sans conditionnement : à renseigner', () => {
  const r = S.convertirLigne({ cartons: 3 });
  assert.strictEqual(r.unites, null); assert.strictEqual(r.aRenseigner, true);
});
t('saisie directe en unités permise', () => {
  assert.strictEqual(S.convertirLigne({ unites: 7 }).unites, 7);
});
t('trois cas de conditionnement', () => {
  assert.strictEqual(S.conditionnement('Jus Caresse 50cl', { mode: 'a_l_unite', unites_par_carton: 1 }).source, 'a_l_unite');
  assert.strictEqual(S.conditionnement('X-NP', { mode: 'suffixe_np', unites_par_carton: 12 }).unitesParCarton, 12);
  assert.strictEqual(S.conditionnement('Y', null).aRenseigner, true);
});
t('à l\'unité : pas d\'arrondi au carton, pas de mention', () => {
  const r = S.arrondirAchat(7.2, S.conditionnement('Jus', { mode: 'a_l_unite', unites_par_carton: 1 }));
  assert.deepStrictEqual(r, { unites: 8, cartons: null, mention: null });
});
t('inconnu : mention conservée', () => {
  assert.strictEqual(S.arrondirAchat(5, S.conditionnement('Z', null)).mention, 'conditionnement à renseigner');
});
t('carton connu : arrondi au carton', () => {
  const r = S.arrondirAchat(13, S.conditionnement('X-NP', { mode: 'suffixe_np', unites_par_carton: 12 }));
  assert.strictEqual(r.cartons, 2); assert.strictEqual(r.unites, 24);
});
t('PA modifié conservé à côté du proposé', () => {
  assert.strictEqual(S.ecartPa(1.5, 1.2).toFixed(2), '0.30');
  assert.strictEqual(S.ecartPa(null, 1.2), null);
});
t('livraison annulée ou remplacée exclue', () => {
  const l = [{ id: 'a' }, { id: 'b', remplace_livraison_id: 'a' }, { id: 'c' }];
  const v = S.livraisonsValides(l, [{ livraison_id: 'c' }]).map(x => x.id);
  assert.deepStrictEqual(v, ['b']);
});
t('remplaçante annulée : l\'ancienne redevient valide', () => {
  const l = [{ id: 'a' }, { id: 'b', remplace_livraison_id: 'a' }];
  assert.deepStrictEqual(S.livraisonsValides(l, [{ livraison_id: 'b' }]).map(x => x.id), ['a']);
});
const base = { articles: ['A'], campagneDebut: '2026-11-12', dateVentes: '2026-11-15',
  stockDepart: [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-12', source: 'saisie_initiale' }],
  livraisons: [{ id: 'l1' }], annulations: [], lignesLivraison: [{ livraison_id: 'l1', article: 'A', unites: 50 }],
  ventes: [{ article: 'A', quantite: 30 }] };
t('stock théorique recalculé et libellé', () => {
  const r = S.stockTheorique(base)[0];
  assert.strictEqual(r.stock, 120); assert.strictEqual(r.libelle, 'Stock théorique'); assert.strictEqual(r.a_confirmer, false);
});
t('livraison annulée non comptée', () => {
  assert.strictEqual(S.stockTheorique({ ...base, annulations: [{ livraison_id: 'l1' }] })[0].stock, 70);
});
t('stock de départ manquant détecté', () => {
  const r = S.stockTheorique({ ...base, stockDepart: [] })[0];
  assert.strictEqual(r.manque_depart, true); assert.strictEqual(r.stock, null);
});
t('écart 10/11 au 12/11 : à confirmer, 2 jours non couverts', () => {
  const r = S.stockTheorique({ ...base, stockDepart: [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-10', source: 'inventaire' }] })[0];
  assert.strictEqual(r.a_confirmer, true); assert.strictEqual(r.jours_non_couverts, 2);
});
t('nouvelle version du stock remplace sans effacer', () => {
  const dep = [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-10', source: 'inventaire' },
               { article: 'A', version: 2, quantite: 90, date_stock: '2026-11-12', source: 'saisie_initiale' }];
  const r = S.stockTheorique({ ...base, stockDepart: dep })[0];
  assert.strictEqual(r.stock, 110); assert.strictEqual(r.a_confirmer, false);
});
t('livraison Inventaire signalée, jamais ajoutée', () => {
  const mv = [{ type_mouvement: 'livraison', article: 'a', date: '2026-11-13', quantite: 20 },
              { type_mouvement: 'livraison', article: 'A', date: '2026-11-01', quantite: 5 }];
  const r = S.livraisonsInventaireNonComptees(mv, { articles: ['A'], campagneDebut: '2026-11-12', campagneFin: '2026-11-30' });
  assert.strictEqual(r.length, 1); assert.match(r[0].mention, /non comptée ici/);
  assert.strictEqual(S.stockTheorique(base)[0].stock, 120);
});
t('vente sous un alias encore dû comptée sur l\'article canonique', () => {
  const resoudre = d => (String(d).trim().toLowerCase() === 'coca 33 canette' ? 'A' : null);
  const r = S.stockTheorique({ ...base, ventes: [{ article: 'Coca 33 canette', quantite: 7 }, { article: 'A', quantite: 3 }], resoudre })[0];
  const sans = S.stockTheorique({ ...base, ventes: [{ article: 'Coca 33 canette', quantite: 7 }, { article: 'A', quantite: 3 }] })[0];
  assert.strictEqual(sans.stock - r.stock, 7);
});
t('douze noms réels Petromix : conditionnement extrait du suffixe', () => {
  const att = { 'Heineken 25cl-24P': 24, 'Oreo 154g-20P': 20, 'Quadratini Noisette-12P': 12, 'Quadratini Choco-12P': 12, 'Quadratini Vanille-12P': 12, 'Pringles 165g-19P': 19, 'Lays 130g-15P': 15, 'Didier 1l-8P': 8, 'Schweppes Agrumes-8P': 8, 'Schweppes Tonic-8P': 8, 'Schweppes Zero-8P': 8 };
  Object.keys(att).forEach(n => { const c = S.conditionnement(n, null); assert.strictEqual(c.source, 'suffixe_np'); assert.strictEqual(c.unitesParCarton, att[n]); assert.strictEqual(c.aRenseigner, false); });
  assert.strictEqual(S.conditionnement('Jus Caresse 50cl', null).source, 'inconnu');
  assert.strictEqual(S.conditionnement('Jus Caresse 50cl', { mode: 'a_l_unite', unites_par_carton: 1 }).source, 'a_l_unite');
  assert.strictEqual(S.conditionnement('Heineken 25cl-24P', { mode: 'a_l_unite', unites_par_carton: 1 }).unitesParCarton, 1);
});
t('livraison Inventaire retrouvée par désignation après alias', () => {
  const mv = [{ type_mouvement: 'livraison', article: 'Coca 33 canette', date: '2026-11-13', quantite: 20 }];
  const r = S.livraisonsInventaireNonComptees(mv, { articles: ['Coca-Cola 33cl'], campagneDebut: '2026-11-12', campagneFin: '2026-11-30', resoudre: a => (a === 'Coca 33 canette' ? 'Coca-Cola 33cl' : a) });
  assert.strictEqual(r.length, 1);
});
t('livraison avant, le jour même, après le stock de départ', () => {
  const mk = d => S.stockTheorique({ ...base, ventes: [], livraisons: [{ id: 'l1', date_livraison: d }] })[0];
  assert.strictEqual(mk('2026-11-10').stock, 100);
  const m = mk('2026-11-12'); assert.strictEqual(m.stock, 100); assert.strictEqual(m.a_confirmer, true); assert.strictEqual(m.livraison_meme_jour_a_verifier, 50);
  assert.strictEqual(mk('2026-11-13').stock, 150);
});

console.log(n + ' épreuves C3 passent.');
