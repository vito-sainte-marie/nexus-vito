// Test — FDJ Fiabilisation Étape 3 (18/08/2026, cahier
// NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf, §12 "Boîte d'exceptions
// manager"). Couvre NexusFdjMoteur.syntheseExceptionsManager : pure
// agrégation de signaux déjà calculés ailleurs — ne détecte rien elle-même.
// Charge le vrai fichier moteur (jamais réécrit à la main), comme tous les
// tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-fdj-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusFdjMoteur;
assert.ok(M, 'NexusFdjMoteur non chargé');
assert.strictEqual(typeof M.syntheseExceptionsManager, 'function', 'syntheseExceptionsManager absent du moteur');

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

test('Tous les signaux vides/absents -> total 0, phrase "aucune exception", jamais une exception', () => {
  const s = M.syntheseExceptionsManager({});
  assert.strictEqual(s.total, 0);
  assert.strictEqual(s.phrase, "Aucune exception à vérifier aujourd'hui.");
  assert.strictEqual(s.categories.length, 5);
  s.categories.forEach(c => assert.strictEqual(c.count, 0));
});

test('undefined en entrée -> comportement identique à {}, jamais une exception (Article 5)', () => {
  const s = M.syntheseExceptionsManager(undefined);
  assert.strictEqual(s.total, 0);
});

test('Une seule catégorie renseignée -> total = son compte, singulier correct', () => {
  const s = M.syntheseExceptionsManager({ quartsManquants: [{ id: 'a1' }] });
  assert.strictEqual(s.total, 1);
  const cat = s.categories.find(c => c.cle === 'quartsManquants');
  assert.strictEqual(cat.count, 1);
  assert.strictEqual(cat.libelle, 'quart manquant');
  assert.strictEqual(s.phrase, "À vérifier aujourd'hui : 1 quart manquant.");
});

test('Plusieurs catégories renseignées -> total cumulé, phrase liste uniquement les non-vides, pluriel correct', () => {
  const s = M.syntheseExceptionsManager({
    correctionsRetroactives: [{ id: 'c1' }, { id: 'c2' }],
    quartsManquants: [{ id: 'm1' }],
    carnetsARapprocher: [{ game_id: 'g1' }, { game_id: 'g2' }, { game_id: 'g3' }],
    ecartsRecalcules: [],
    replaysRequis: [],
  });
  assert.strictEqual(s.total, 6);
  assert.strictEqual(s.phrase, "À vérifier aujourd'hui : 2 corrections rétroactives - 1 quart manquant - 3 carnets à rapprocher.");
  const catEcarts = s.categories.find(c => c.cle === 'ecartsRecalcules');
  assert.strictEqual(catEcarts.count, 0);
});

test('items conservés tels quels dans chaque catégorie (pour le rendu détaillé)', () => {
  const item = { id: 'x1', shift_id: 's1', type: 'stock_initial_modifie' };
  const s = M.syntheseExceptionsManager({ correctionsRetroactives: [item] });
  assert.strictEqual(s.categories.find(c => c.cle === 'correctionsRetroactives').items[0], item);
});

test('replaysRequis toujours présent dans les catégories même vide (Étape 4 pas encore construite)', () => {
  const s = M.syntheseExceptionsManager({});
  const cat = s.categories.find(c => c.cle === 'replaysRequis');
  assert.ok(cat);
  assert.strictEqual(cat.count, 0);
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
