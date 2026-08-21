// Test — Cascade de règles "Catégorie porte les règles" (nexus-inventaire-moteur.js)
// 20/08/2026, demande de Frédéric : "règle de catégorie par défaut +
// exceptions produit". Charge le vrai fichier moteur (jamais réécrit à la
// main), comme tous les tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');
assert.ok(M.regleEffectiveProduit, 'regleEffectiveProduit non exportée');
assert.ok(M.construireReglesEffectivesParProduit, 'construireReglesEffectivesParProduit non exportée');

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
// regleEffectiveProduit — cascade à 3 niveaux
// ------------------------------------------------------------

test('produit avec ligne propre : sa ligne prime toujours, même si la catégorie a une règle active', () => {
  const regleProduit = { profil: 'presse', quarts_comptage: ['1'] };
  const regleCategorie = { regle_active: true, profil: 'continu', quarts_comptage: ['1', '2'] };
  const effective = M.regleEffectiveProduit(regleProduit, regleCategorie);
  assert.strictEqual(effective.profil, 'presse');
  assert.deepStrictEqual(effective.quarts_comptage, ['1']);
  assert.strictEqual(effective.origineRegle, 'produit');
});

test('pas de ligne produit, catégorie active : hérite de la catégorie', () => {
  const regleCategorie = { regle_active: true, profil: 'production_journaliere', comptage_masque: true };
  const effective = M.regleEffectiveProduit(null, regleCategorie);
  assert.strictEqual(effective.profil, 'production_journaliere');
  assert.strictEqual(effective.comptage_masque, true);
  assert.strictEqual(effective.origineRegle, 'categorie');
});

test('pas de ligne produit, catégorie présente mais regle_active=false : comportement historique (null)', () => {
  const regleCategorie = { regle_active: false, profil: 'production_journaliere' };
  const effective = M.regleEffectiveProduit(null, regleCategorie);
  assert.strictEqual(effective, null);
});

test('pas de ligne produit, pas de catégorie : null (comportement historique inchangé)', () => {
  assert.strictEqual(M.regleEffectiveProduit(null, null), null);
  assert.strictEqual(M.regleEffectiveProduit(undefined, undefined), null);
});

test('regle_active absent (undefined) sur la catégorie : traité comme inactif, jamais une exception', () => {
  const effective = M.regleEffectiveProduit(null, { profil: 'continu' });
  assert.strictEqual(effective, null);
});

// ------------------------------------------------------------
// construireReglesEffectivesParProduit — passe en lot
// ------------------------------------------------------------

test('construit la map produit_id -> règle effective sur un jeu mixte', () => {
  const produits = [
    { id: 'p_exception', categorie_id: 'cat_bieres' },     // a sa propre ligne
    { id: 'p_herite', categorie_id: 'cat_bieres' },        // hérite de la catégorie active
    { id: 'p_sans_cat', categorie_id: null },               // pas de catégorie du tout
    { id: 'p_cat_inactive', categorie_id: 'cat_viennoiserie' }, // catégorie existe mais regle_active=false
  ];
  const reglesParProduitId = {
    p_exception: { profil: 'presse', quarts_comptage: ['1'] },
  };
  const reglesParCategorieId = {
    cat_bieres: { regle_active: true, profil: 'continu', quarts_comptage: ['1', '2'], frequence_controle: 'standard' },
    cat_viennoiserie: { regle_active: false, profil: 'production_journaliere' },
  };
  const resultat = M.construireReglesEffectivesParProduit(produits, reglesParProduitId, reglesParCategorieId);

  assert.strictEqual(resultat.p_exception.profil, 'presse');
  assert.strictEqual(resultat.p_exception.origineRegle, 'produit');

  assert.strictEqual(resultat.p_herite.profil, 'continu');
  assert.strictEqual(resultat.p_herite.origineRegle, 'categorie');

  assert.strictEqual(resultat.p_sans_cat, undefined, 'sans catégorie ni ligne propre, le produit ne doit pas apparaître dans la map (comportement historique : absence = défauts internes du moteur)');
  assert.strictEqual(resultat.p_cat_inactive, undefined, 'catégorie non active ne doit jamais injecter de règle');
});

test('la règle héritée de la catégorie reste utilisable telle quelle par produitEligibleQuart/delaiMaxJours (aucune fonction du moteur ne doit être modifiée)', () => {
  const regleCategorie = { regle_active: true, quarts_comptage: ['1'], frequence_controle: 'critique', delai_max_jours_sans_controle: null };
  const effective = M.regleEffectiveProduit(null, regleCategorie);
  assert.strictEqual(M.produitEligibleQuart(effective, '1'), true);
  assert.strictEqual(M.produitEligibleQuart(effective, '2'), false);
  assert.strictEqual(M.delaiMaxJours(effective), 0); // 'critique' -> 0 jour, DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE
});

test('intégration avec construirePlanComptage : un produit sans ligne propre mais avec catégorie active devient sélectionnable comme "critique" au même titre qu\'une ligne produit', () => {
  const produits = [{ id: 'p1', actif: true, categorie_id: 'cat_x' }];
  const reglesParProduitId = {};
  const reglesParCategorieId = { cat_x: { regle_active: true, frequence_controle: 'critique' } };
  const reglesParProduit = M.construireReglesEffectivesParProduit(produits, reglesParProduitId, reglesParCategorieId);

  const resultat = M.construirePlanComptage({
    produits, reglesParProduit,
    dernierControleParProduit: {}, produitsAvecAnomalieRecente: [],
    quart: '1', dateISO: '2026-08-20', socleCible: 20, surprisesCible: 0,
    seed: 'test', surprisesRecentesParProduit: [],
  });
  const item = resultat.items.find(i => i.produit_id === 'p1');
  assert.ok(item, 'p1 doit être sélectionné (critique via catégorie héritée)');
  assert.strictEqual(item.raison_selection, 'critique');
});

console.log(`\n${nbOk}/${nbTests} tests OK`);
if (nbOk !== nbTests) process.exit(1);
