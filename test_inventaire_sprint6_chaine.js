// Test — Sprint 6 "Chaîne" (18/08/2026, cahier Inventaire 2.0 §13 "Alertes
// dynamiques", INV2-13 : "une anomalie résolue sort des alertes actives
// mais reste dans l'historique" — jamais un effacement silencieux). Charge
// le vrai fichier moteur (jamais réécrit à la main), comme tous les tests
// de ce module.

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
// reconciliationAlertesDemarque
// ------------------------------------------------------------

test('Écart qui disparaît (produit compté sans alerte fraîche) -> résolue, jamais supprimée', () => {
  const { aResoudre, aMettreAJour, aCreer } = M.reconciliationAlertesDemarque({
    alertesOuvertesExistantes: [{ id: 'alerte1', produit_id: 'p1' }],
    ecartsAuDessusSeuil: [], // le réimport ne trouve plus aucun écart au-dessus du seuil
  });
  assert.deepStrictEqual(aResoudre, ['alerte1']);
  assert.strictEqual(aMettreAJour.length, 0);
  assert.strictEqual(aCreer.length, 0);
});

test('Écart qui persiste -> mise à jour en place, jamais recréée (préserve assignee_a/vue_par/cree_le)', () => {
  const { aResoudre, aMettreAJour, aCreer } = M.reconciliationAlertesDemarque({
    alertesOuvertesExistantes: [{ id: 'alerte1', produit_id: 'p1' }],
    ecartsAuDessusSeuil: [{ produit_id: 'p1', valeur_attendue: 10, valeur_constatee: 7, valeur_estimee: 15, gravite: 'attention' }],
  });
  assert.strictEqual(aResoudre.length, 0);
  assert.strictEqual(aCreer.length, 0);
  assert.strictEqual(aMettreAJour.length, 1);
  assert.strictEqual(aMettreAJour[0].id, 'alerte1');
  assert.strictEqual(aMettreAJour[0].valeur_constatee, 7);
  assert.strictEqual(aMettreAJour[0].gravite, 'attention');
});

test('Nouvel écart sans alerte existante -> créée', () => {
  const { aResoudre, aMettreAJour, aCreer } = M.reconciliationAlertesDemarque({
    alertesOuvertesExistantes: [],
    ecartsAuDessusSeuil: [{ produit_id: 'p2', valeur_attendue: 5, valeur_constatee: 2, valeur_estimee: null, gravite: 'critique' }],
  });
  assert.strictEqual(aResoudre.length, 0);
  assert.strictEqual(aMettreAJour.length, 0);
  assert.strictEqual(aCreer.length, 1);
  assert.strictEqual(aCreer[0].produit_id, 'p2');
});

test('Mélange réaliste : un produit résolu, un mis à jour, un créé — dans le même réimport', () => {
  const alertesOuvertesExistantes = [
    { id: 'a_resolu', produit_id: 'p_resolu' },   // n'a plus d'écart -> résoudre
    { id: 'a_maj', produit_id: 'p_maj' },         // toujours en écart -> mettre à jour
  ];
  const ecartsAuDessusSeuil = [
    { produit_id: 'p_maj', valeur_attendue: 20, valeur_constatee: 15, valeur_estimee: 8, gravite: 'attention' },
    { produit_id: 'p_nouveau', valeur_attendue: 3, valeur_constatee: 0, valeur_estimee: null, gravite: 'critique' },
  ];
  const { aResoudre, aMettreAJour, aCreer } = M.reconciliationAlertesDemarque({ alertesOuvertesExistantes, ecartsAuDessusSeuil });
  assert.deepStrictEqual(aResoudre, ['a_resolu']);
  assert.strictEqual(aMettreAJour.length, 1);
  assert.strictEqual(aMettreAJour[0].id, 'a_maj');
  assert.strictEqual(aCreer.length, 1);
  assert.strictEqual(aCreer[0].produit_id, 'p_nouveau');
});

test('Rien n\'existe et rien à créer -> les trois listes vides, aucun appel réseau inutile côté appelant', () => {
  const { aResoudre, aMettreAJour, aCreer } = M.reconciliationAlertesDemarque({
    alertesOuvertesExistantes: [], ecartsAuDessusSeuil: [],
  });
  assert.strictEqual(aResoudre.length, 0);
  assert.strictEqual(aMettreAJour.length, 0);
  assert.strictEqual(aCreer.length, 0);
});

test('Entrées manquantes (undefined) traitées comme des listes vides, jamais une exception', () => {
  const resultat = M.reconciliationAlertesDemarque({});
  assert.deepStrictEqual(resultat, { aResoudre: [], aMettreAJour: [], aCreer: [] });
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
