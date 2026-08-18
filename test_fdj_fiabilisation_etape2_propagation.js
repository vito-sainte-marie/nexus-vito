// Test — FDJ Fiabilisation Étape 2 (18/08/2026, cahier NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts)
// "versionner les corrections de stock + propagation".
// Couvre NexusFdjMoteur.propagationCorrectionStock : quand un manager corrige
// le stock_final d'un jeu sur un quart déjà clos, comment cette correction se
// propage (ou non) vers le stock_initial du quart suivant.
// Charge le vrai fichier moteur (jamais réécrit à la main), comme tous les
// tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-fdj-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusFdjMoteur;
assert.ok(M, 'NexusFdjMoteur non chargé');
assert.strictEqual(typeof M.propagationCorrectionStock, 'function', 'propagationCorrectionStock absent du moteur');

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

test('stock_initial_auto === true -> correction applicable automatiquement', () => {
  const corrections = [{ game_id: 'g1', nouvelle_valeur: 12 }];
  const contexte = { g1: { stock_initial: 5, stock_initial_auto: true } };
  const r = M.propagationCorrectionStock(corrections, contexte);
  assert.strictEqual(r.applicables.length, 1);
  assert.strictEqual(r.applicables[0].game_id, 'g1');
  assert.strictEqual(r.applicables[0].stock_final_precedent, 12);
  assert.strictEqual(r.aRevoir.length, 0);
});

test('stock_initial_auto === false et valeur différente -> à revoir par le manager (jamais auto-écrasé)', () => {
  const corrections = [{ game_id: 'g1', nouvelle_valeur: 12 }];
  const contexte = { g1: { stock_initial: 9, stock_initial_auto: false } };
  const r = M.propagationCorrectionStock(corrections, contexte);
  assert.strictEqual(r.applicables.length, 0);
  assert.strictEqual(r.aRevoir.length, 1);
  assert.strictEqual(r.aRevoir[0].game_id, 'g1');
  assert.strictEqual(r.aRevoir[0].valeur_quart_precedent, 12);
  assert.strictEqual(r.aRevoir[0].valeur_saisie, 9);
});

test('stock_initial_auto === false mais valeur déjà coïncidente -> ni applicable ni à revoir (pas de fausse alerte, Article 5)', () => {
  const corrections = [{ game_id: 'g1', nouvelle_valeur: 12 }];
  const contexte = { g1: { stock_initial: 12, stock_initial_auto: false } };
  const r = M.propagationCorrectionStock(corrections, contexte);
  assert.strictEqual(r.applicables.length, 0);
  assert.strictEqual(r.aRevoir.length, 0);
});

test('Pas de contexte pour ce jeu (quart suivant n\'a pas encore de ligne) -> ignoré, pas d\'exception', () => {
  const corrections = [{ game_id: 'g1', nouvelle_valeur: 12 }];
  const r = M.propagationCorrectionStock(corrections, {});
  assert.strictEqual(r.applicables.length, 0);
  assert.strictEqual(r.aRevoir.length, 0);
});

test('game_id manquant -> ignoré, pas d\'exception', () => {
  const corrections = [{ nouvelle_valeur: 12 }];
  const r = M.propagationCorrectionStock(corrections, { g1: { stock_initial: 5, stock_initial_auto: true } });
  assert.strictEqual(r.applicables.length, 0);
  assert.strictEqual(r.aRevoir.length, 0);
});

test('Liste de corrections vide/undefined -> résultat vide, jamais une exception', () => {
  assert.deepStrictEqual(M.propagationCorrectionStock([], {}), { applicables: [], aRevoir: [] });
  assert.deepStrictEqual(M.propagationCorrectionStock(undefined, undefined), { applicables: [], aRevoir: [] });
});

test('Plusieurs jeux mélangés (auto + à revoir + coïncident + sans contexte) traités indépendamment', () => {
  const corrections = [
    { game_id: 'auto', nouvelle_valeur: 10 },
    { game_id: 'revoir', nouvelle_valeur: 20 },
    { game_id: 'coincidence', nouvelle_valeur: 30 },
    { game_id: 'absent', nouvelle_valeur: 40 },
  ];
  const contexte = {
    auto: { stock_initial: 1, stock_initial_auto: true },
    revoir: { stock_initial: 99, stock_initial_auto: false },
    coincidence: { stock_initial: 30, stock_initial_auto: false },
  };
  const r = M.propagationCorrectionStock(corrections, contexte);
  assert.strictEqual(r.applicables.length, 1);
  assert.strictEqual(r.applicables[0].game_id, 'auto');
  assert.strictEqual(r.aRevoir.length, 1);
  assert.strictEqual(r.aRevoir[0].game_id, 'revoir');
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
