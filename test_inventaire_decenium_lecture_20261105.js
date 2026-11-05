// L2a (05/11/2026) — lecture des exports Decenium réels : virgule française,
// en-têtes "Libellé"/"Stock actuel", stock sans code-barres relié par la
// ligne Ventes. Fixtures anonymisées et réduites (les vrais fichiers ne sont
// pas dans le dépôt).
const assert = require('assert');
require('./nexus-inventaire-decenium-lecture.js');
const L = globalThis.NexusInventaireDeceniumLecture;

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('OK — ' + nom); } catch (e) { echecs++; console.log('FAIL — ' + nom + '\n  ' + e.message); }
}

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
const code = (v) => (v ? String(v).replace(/[\s ]/g, '').replace(/^0+/, '') : null);

const NB = ' ';
const VENTES = [
  { 'Categ': 'BOISSONS', 'lib article': 'Eau plate 50 cl', 'QTE': '3,00', 'PA HT': '0,30', 'PV HT': '0,90', 'TVA': '2,10', 'Code Barres': '0' + '3000000000011' },
  { 'Categ': 'TABAC', 'lib article': 'Cigarettes Marque A 20', 'QTE': '1,00', 'PA HT': '9,00', 'PV HT': '10,00', 'TVA': '20', 'Code Barres': '3000000000028' },
  { 'Categ': 'BOULANGERIE', 'lib article': 'Pain du jour', 'QTE': '2,00', 'PA HT': '0,50', 'PV HT': '1,00', 'TVA': '5,5', 'Code Barres': null },
  { 'Categ': 'BOISSONS', 'lib article': 'Boisson absente du stock', 'QTE': '1,00', 'PA HT': '1,00', 'PV HT': '2,00', 'TVA': '20', 'Code Barres': '3000000000035' },
];
const STOCK = [
  { 'Catégorie': 'BOISSONS', 'Libellé': 'Eau plate 50 cl', 'Stock actuel': '24,00', 'Mouvements': '0,00', 'Stock date': '24,00', 'PA net HT': '0,30', 'Valeur stock HT': '7,20' },
  { 'Catégorie': 'TABAC', 'Libellé': 'Cigarettes Marque A 20', 'Stock actuel': '0,00', 'PA net HT': '9,00' },
  { 'Catégorie': 'TABAC', 'Libellé': 'Cigarettes Marque A 20', 'Stock actuel': '160,00', 'PA net HT': '9,00' },
  { 'Catégorie': 'BOULANGERIE', 'Libellé': 'Pain du jour', 'Stock actuel': '-44,00', 'PA net HT': '0,50' },
  { 'Catégorie': 'DIVERS', 'Libellé': 'Jeton machine', 'Stock actuel': '-3' + NB + '792,00' },
  { 'Catégorie': 'DIVERS', 'Libellé': 'Article sans nombre', 'Stock actuel': 'abc' },
];
const PRODUITS = [
  { id: 'p-eau', designation: 'Eau 50CL', code_barres: '3000000000011' },
  { id: 'p-cig', designation: 'Cigarettes A', code_barres: '3000000000028' },
];
const opts = (extra) => Object.assign({ normaliser: norm, normaliserCode: code, categoriesNegatifsExclues: null }, extra);

t('nombreDecenium — virgule française, milliers et nombres déjà numériques', () => {
  assert.strictEqual(L.nombreDecenium('3,00'), 3);
  assert.strictEqual(L.nombreDecenium('-3' + NB + '792,00'), -3792);
  assert.strictEqual(L.nombreDecenium('-3 792,00'), -3792);
  assert.strictEqual(L.nombreDecenium(12.5), 12.5);
  assert.strictEqual(L.nombreDecenium('abc'), null);
  assert.strictEqual(L.nombreDecenium(null), null);
  assert.strictEqual(L.nombreDecenium(''), null);
});

t('rapprochement — le stock sans code-barres est relié par libellé+catégorie via la ligne Ventes', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts());
  assert.strictEqual(r[0].produit_id, 'p-eau');
  assert.strictEqual(r[0].quantite_stock, 24);
  assert.strictEqual(r[0].prix_achat_ht, 0.3);
});

t('rapprochement — un libellé présent deux fois au stock reste non rapproché (jamais deviné)', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts());
  assert.strictEqual(r[1].produit_id, null);
  assert.strictEqual(r[1].motif, 'libelle_ambigu');
  assert.strictEqual(r[2].produit_id, null);
  assert.strictEqual(r[2].motif, 'libelle_ambigu');
});

t('stock négatif — exclu, quantité conservée, motif posé', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts());
  assert.strictEqual(r[3].motif, 'stock_negatif');
  assert.strictEqual(r[3].produit_id, null);
  assert.strictEqual(r[4].quantite_stock, -3792);
  assert.strictEqual(r[4].motif, 'stock_negatif');
});

t('stock négatif — exclusion limitée aux catégories nommées', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts({ categoriesNegatifsExclues: ['divers'] }));
  assert.strictEqual(r[4].motif, 'stock_negatif');
  assert.notStrictEqual(r[3].motif, 'stock_negatif');
});

t('quantité illisible — motif posé, quantité 0, jamais NaN', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts());
  assert.strictEqual(r[5].motif, 'quantite_illisible');
  assert.strictEqual(r[5].quantite_stock, 0);
});

t('alias — repli sur la résolution d\'alias quand rien d\'autre ne relie la ligne', () => {
  const r = L.rapprocherStockDecenium(
    [{ 'Catégorie': 'X', 'Libellé': 'Pain', 'Stock actuel': '5,00' }], [], PRODUITS,
    opts({ resoudreAlias: () => ({ id: 'p-pain', designation: 'Pain' }) }));
  assert.strictEqual(r[0].produit_id, 'p-pain');
});

t('bilan — articles vendus retrouvés et à vérifier, avec la raison', () => {
  const r = L.rapprocherStockDecenium(STOCK, VENTES, PRODUITS, opts());
  const b = L.bilanArticlesVendus(VENTES, r, norm);
  assert.strictEqual(b.nbVendus, 4);
  assert.strictEqual(b.nbRetrouves, 1);
  const raisons = Object.fromEntries(b.aVerifier.map(a => [a.libelle, a.raison]));
  assert.strictEqual(raisons['Cigarettes Marque A 20'], '2 lignes au stock');
  assert.strictEqual(raisons['Pain du jour'], 'stock négatif au fichier');
  assert.strictEqual(raisons['Boisson absente du stock'], 'absent du stock');
});

if (echecs) { console.log('\nDes tests ont échoué.'); process.exit(1); }
console.log('\nTous les tests sont passés.');
