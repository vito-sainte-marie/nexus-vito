// Test — Règle métier « priorité au stock initial du quart suivant » (10/10/2026).
//
// Énoncé reçu : lorsqu'une différence est constatée entre le stock final de
// Q1 et le stock initial de Q2, le stock initial de Q2 est la référence. Le
// manager corrige rétroactivement le stock final de Q1 pour l'aligner ; la
// correction préserve le stock initial de Q2, recalcule ventes, caisse
// théorique et écart de Q1, conserve l'historique et l'auteur, exige un
// motif, et ne certifie jamais le contrôle manager.
//
// Ce fichier couvre la part que le moteur porte (fonctions pures, vrai
// fichier chargé). Les trois exigences qui vivent dans l'écran ou la base
// (motif, absence de certification, historique) sont des scénarios de
// recette sur nexus-test : voir
// docs/recette/fdj-priorite-stock-initial-suivant-20261010.md.
//
// Le dernier test CONTREDIT le premier test de
// test_fdj_fiabilisation_etape2_propagation.js, qui encode la décision du
// 16/08/2026 (« recalculer et réécrire automatiquement » un stock initial
// encore hérité). Les deux ne peuvent pas être verts ensemble : c'est un
// arbitrage, pas un défaut de test.

const path = require('path');
const assert = require('assert');

require(path.join(__dirname, 'nexus-fdj-moteur.js'));
const M = globalThis.NexusFdjMoteur;
assert.ok(M, 'NexusFdjMoteur non chargé');

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

// Valeurs de la recette (b) du 10/10 sur nexus-test : Q2 avait 50 en stock
// initial ; le jeu vaut 2 €.
const PRIX = 2;
const Q2_STOCK_INITIAL = 50;

test('Q1 aligné : ventes et montant recalculés depuis le stock final corrigé', () => {
  // Q1 : 56 au départ, aucun appro, final saisi 47 puis aligné sur 50.
  const avant = M.calculerVentesJeu({ stock_initial: 56, appro: 0, stock_final: 47 }, PRIX);
  const apres = M.calculerVentesJeu({ stock_initial: 56, appro: 0, stock_final: Q2_STOCK_INITIAL }, PRIX);
  assert.deepStrictEqual(avant, { qte: 9, valeur: 18 });
  assert.deepStrictEqual(apres, { qte: 6, valeur: 12 });
});

test('Q1 aligné : la continuité Q1 → Q2 est rétablie (l\'alerte peut se clore)', () => {
  const avant = M.verdictContinuiteStock({ shiftPrecedentId: 'q1', stockFinalPrecedent: 47, stockInitialActuel: Q2_STOCK_INITIAL });
  const apres = M.verdictContinuiteStock({ shiftPrecedentId: 'q1', stockFinalPrecedent: Q2_STOCK_INITIAL, stockInitialActuel: Q2_STOCK_INITIAL });
  assert.strictEqual(avant.verdict, 'ecart_reel');
  assert.strictEqual(apres.verdict, 'resolu');
  assert.strictEqual(apres.ecart, 0);
});

test('Q1 aligné, Q2 confirmé par un humain : ni réécriture ni nouvelle alerte', () => {
  const r = M.propagationCorrectionStock(
    [{ game_id: 'g1', nouvelle_valeur: Q2_STOCK_INITIAL }],
    { g1: { stock_initial: Q2_STOCK_INITIAL, stock_initial_auto: false } });
  assert.strictEqual(r.applicables.length, 0);
  assert.strictEqual(r.aRevoir.length, 0);
});

test('Q1 aligné, Q2 encore hérité : le stock initial de Q2 garde sa valeur', () => {
  const r = M.propagationCorrectionStock(
    [{ game_id: 'g1', nouvelle_valeur: Q2_STOCK_INITIAL }],
    { g1: { stock_initial: Q2_STOCK_INITIAL, stock_initial_auto: true } });
  r.applicables.forEach(a => assert.strictEqual(a.stock_final_precedent, Q2_STOCK_INITIAL,
    'une propagation ne peut réécrire Q2 qu\'avec sa propre valeur'));
  assert.strictEqual(r.aRevoir.length, 0);
});

test('Q1 corrigé SANS alignement, Q2 encore hérité : Q2 n\'est pas réécrit, l\'écart est signalé', () => {
  // Q2 est la référence : une correction de Q1 qui s'en écarte ne la
  // déplace pas, elle laisse un écart à examiner.
  const r = M.propagationCorrectionStock(
    [{ game_id: 'g1', nouvelle_valeur: 47 }],
    { g1: { stock_initial: Q2_STOCK_INITIAL, stock_initial_auto: true } });
  assert.strictEqual(r.applicables.length, 0,
    `le stock initial de Q2 serait réécrit à ${r.applicables[0] && r.applicables[0].stock_final_precedent}`);
  assert.deepStrictEqual(r.aRevoir, [{ game_id: 'g1', valeur_quart_precedent: 47, valeur_saisie: Q2_STOCK_INITIAL }]);
});

console.log(`\n${nbOk}/${nbTests} tests OK`);
if (nbOk !== nbTests) process.exit(1);
