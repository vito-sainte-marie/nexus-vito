// Test — Sprint 7 "Manager" (18/08/2026, cahier Inventaire 2.0 §11, INV2-14
// "Le manager voit le total produit et accède aux lieux via Voir la
// preuve", INV2-18 "Le mode manager affiche la couverture physique 7/14/30
// jours"). Charge le vrai fichier moteur (jamais réécrit à la main), comme
// tous les tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join(__dirname, 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');

let nbTests = 0, nbOk = 0;
function test(nom, fn) {
  nbTests++;
  try {
    fn();
    nbOk++;
    console.log(`  OK  ${nom}`);
  } catch (e) {
    console.log(`FAIL  ${nom}`);
    console.log(`      ${e.message}`);
  }
}

// ------------------------------------------------------------
// syntheseQualiteRapprochements
// ------------------------------------------------------------

test('Aucune ligne -> total 0, toutFiable false (jamais un 100% trompeur)', () => {
  const q = M.syntheseQualiteRapprochements([]);
  assert.deepStrictEqual(q, { total: 0, fiable: 0, provisoire: 0, nonComparable: 0, toutFiable: false });
});

test('undefined traité comme une liste vide, jamais une exception', () => {
  const q = M.syntheseQualiteRapprochements(undefined);
  assert.strictEqual(q.total, 0);
});

test('Mélange réaliste : fiable/provisoire/non_comparable comptés séparément', () => {
  const q = M.syntheseQualiteRapprochements([
    { statut_validation: 'fiable' },
    { statut_validation: 'fiable' },
    { statut_validation: 'provisoire' },
    { statut_validation: 'non_comparable' },
  ]);
  assert.strictEqual(q.total, 4);
  assert.strictEqual(q.fiable, 2);
  assert.strictEqual(q.provisoire, 1);
  assert.strictEqual(q.nonComparable, 1);
  assert.strictEqual(q.toutFiable, false);
});

test('Toutes les lignes fiables -> toutFiable true', () => {
  const q = M.syntheseQualiteRapprochements([
    { statut_validation: 'fiable' },
    { statut_validation: 'fiable' },
  ]);
  assert.strictEqual(q.toutFiable, true);
});

test('Statut inconnu ou ligne malformée ignoré sans faire planter le comptage', () => {
  const q = M.syntheseQualiteRapprochements([
    { statut_validation: 'fiable' },
    { statut_validation: 'valeur_inattendue' },
    null,
    {},
  ]);
  assert.strictEqual(q.total, 4);
  assert.strictEqual(q.fiable, 1);
  assert.strictEqual(q.provisoire, 0);
  assert.strictEqual(q.nonComparable, 0);
});

// ------------------------------------------------------------
// libelleTotalProduit (INV2-14 "Voir la preuve" — utilisé par
// renderFormulaireCorrectionCorps depuis le Sprint 7)
// ------------------------------------------------------------

test('Comptage avec détail dépôt+boutique -> libellé détaillé', () => {
  const libelle = M.libelleTotalProduit({ quantite: 12, quantite_depot: 5, quantite_boutique: 7 });
  assert.strictEqual(libelle, 'Dépôt 5 + Boutique 7 = Total 12');
});

test('Comptage sans détail deux lieux -> libellé simple, jamais un faux détail inventé', () => {
  const libelle = M.libelleTotalProduit({ quantite: 9, quantite_depot: null, quantite_boutique: null });
  assert.strictEqual(libelle, 'Total observé : 9');
});

test('Comptage manquant (null) -> null, jamais une exception (Article 5)', () => {
  assert.strictEqual(M.libelleTotalProduit(null), null);
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
