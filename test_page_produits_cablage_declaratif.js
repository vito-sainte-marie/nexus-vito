// Câblage de la page Produits vers le moteur tarifaire : natures, justifications, stock. Données ENTIÈREMENT fictives.
const assert = require('assert');
const fs = require('fs');
const E = require('./nexus-politique-tarifaire-ecran.js');
const A = require('./nexus-politique-tarifaire-registres.js');
const T = require('./nexus-politique-tarifaire.js');

let n = 0;
const ok = (nom, f) => { f(); n++; };
const periode = { debut: '2030-03-01', fin: '2030-03-30' };
const prod = (article, cat, q, pv, pa) => ({ article, categorie: cat, quantite: q, prix_vente: pv, prix_achat: pa, tva: 20, code_barres: '' });
const rows = [
  prod('Produit perte', 'Rayon Alpha', 100, 1, 2),
  prod('Produit sain', 'Rayon Alpha', 100, 2, 1),
  prod('ACOMPTE', 'Rayon Alpha', 10, 1, 2),
];
const declarations = {
  produits_nature_reference: [],
  produits_justifications_marge: [{ id: 1, article: 'Produit perte', motif: 'dlc', periode_debut: '2030-03-01', periode_fin: '2030-03-30', valide_le: '2030-03-10' }],
  produits_tva_confirmations: [],
};
const analyse = () => {
  const base = Object.assign({ periode }, E.contexteDeclaratif(declarations, rows, periode));
  return T.analyser(rows, [], A.contexteDepuisRegistres({ familles: [], rattachements: [], seuils: [] }, base));
};
const ligne = (a, nom) => a.lignes.find(l => l.article === nom);
const alerte = (l, c) => (l.alertes || []).find(x => x.code === c);

ok('une perte justifiée reste justifiée', () => {
  const a = alerte(ligne(analyse(), 'Produit perte'), 'A3');
  assert.ok(a && a.donnees.justification, 'justification perdue');
});

ok('une justification d\'une autre période est ignorée', () => {
  const d = { ...declarations, produits_justifications_marge: [{ ...declarations.produits_justifications_marge[0], periode_debut: '2030-02-01', periode_fin: '2030-02-28' }] };
  const c = E.contexteDeclaratif(d, rows, periode);
  assert.strictEqual(c.justifications.length, 0);
});

ok('une opération de caisse est exclue des ventes commerciales', () => {
  const l = ligne(analyse(), 'ACOMPTE');
  assert.strictEqual(l.nature, 'operation_caisse');
  assert.strictEqual(l.simulation.exclusion, 'hors ventes commerciales');
  assert.ok(!alerte(l, 'A3'), 'ACOMPTE traité comme une vente à perte');
});

ok('sans stock : aucun constat par référence, une seule limite écrite', () => {
  const a = analyse();
  assert.strictEqual(a.synthese.stockFourni, false);
  a.lignes.forEach(l => {
    const a5 = alerte(l, 'A5');
    assert.ok(!a5 || !JSON.stringify(a5).includes('absent du relevé'), l.article);
  });
  assert.ok(/Relevé de stock<\/b> : non fourni/.test(E.htmlPage({ analyse: a, role: 'gerant', filtres: {}, incoherences: [] })));
});

ok('la page appelle l\'assistant déclaratif', () => {
  const h = fs.readFileSync('NEXUS-Produits-v1.html', 'utf8');
  assert.ok(/E\.construireContexteTarif\(\{[^}]*declarations: DECLARATIONS_PRODUITS/.test(h));
});

console.log('test_page_produits_cablage_declaratif : ' + n + ' épreuves OK');
