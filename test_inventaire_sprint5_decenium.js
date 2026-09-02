// Test — Sprint 5 "Decenium sans API" (18/08/2026, cahier Inventaire 2.0
// §8/§11, INV2-12/INV2-18). Charge le vrai fichier moteur (jamais réécrit à
// la main), comme tous les tests de ce module.

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
// PARTIE 1 — qualiteRapprochementProduit (INV2-12 : préférer "non
// comparable" à un faux écart).
// ------------------------------------------------------------

test('Écoulement et ventes connus -> fiable', () => {
  assert.strictEqual(M.qualiteRapprochementProduit(10, 8), 'fiable');
});

test('Écoulement à zéro (valeur falsy mais connue) reste fiable, jamais confondu avec "absent"', () => {
  assert.strictEqual(M.qualiteRapprochementProduit(0, 0), 'fiable');
});

test('Écoulement null (comptage ouverture/clôture manquant) -> non_comparable, jamais un écart inventé', () => {
  assert.strictEqual(M.qualiteRapprochementProduit(null, 8), 'non_comparable');
  assert.strictEqual(M.qualiteRapprochementProduit(undefined, 8), 'non_comparable');
});

test('Écoulement connu mais ventes pas encore importées -> provisoire', () => {
  assert.strictEqual(M.qualiteRapprochementProduit(10, null), 'provisoire');
  assert.strictEqual(M.qualiteRapprochementProduit(10, undefined), 'provisoire');
});

test('Écoulement null prime sur ventes inconnues -> non_comparable (comptage manquant est le problème structurant)', () => {
  assert.strictEqual(M.qualiteRapprochementProduit(null, null), 'non_comparable');
});

test('libelleQualiteRapprochement fournit un libellé pour chaque statut connu, jamais vide', () => {
  assert.strictEqual(M.libelleQualiteRapprochement('fiable'), 'Fiable');
  assert.ok(M.libelleQualiteRapprochement('provisoire').toLowerCase().includes('attente'));
  assert.ok(M.libelleQualiteRapprochement('non_comparable').toLowerCase().includes('manquant'));
  assert.strictEqual(M.libelleQualiteRapprochement('inconnu'), 'Statut inconnu');
});

// ------------------------------------------------------------
// PARTIE 2 — couverturePhysique (cahier §11, INV2-18 : couverture physique
// 7/14/30 jours affichée au manager).
// ------------------------------------------------------------

test('4 produits, 2 observés dans la fenêtre -> 50%, 2 en retard listés', () => {
  const dateISO = '2026-08-18';
  const produitsActifs = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];
  const dernierControleParProduit = {
    p1: '2026-08-17', // hier, dans la fenêtre 7j
    p2: '2026-08-12', // il y a 6j, dans la fenêtre 7j
    p3: '2026-08-01', // il y a 17j, hors fenêtre 7j
    // p4 : jamais contrôlé -> hors fenêtre par construction
  };
  const c = M.couverturePhysique({ produitsActifs, dernierControleParProduit, dateISO, fenetreJours: 7 });
  assert.strictEqual(c.total, 4);
  assert.strictEqual(c.observes, 2, 'p1 et p2 dans la fenêtre 7j, p3 et p4 non');
  assert.strictEqual(c.pourcentage, 50);
  assert.deepStrictEqual(c.enRetard.sort(), ['p3', 'p4']);
});

test('Un produit jamais contrôlé compte explicitement comme en retard, jamais une omission silencieuse', () => {
  const c = M.couverturePhysique({
    produitsActifs: [{ id: 'jamais_compte' }],
    dernierControleParProduit: {},
    dateISO: '2026-08-18', fenetreJours: 30,
  });
  assert.strictEqual(c.observes, 0);
  assert.deepStrictEqual(c.enRetard, ['jamais_compte']);
  assert.strictEqual(c.pourcentage, 0);
});

test('Fenêtre exactement au bord (joursDepuis === fenetreJours) compte comme observé, cohérent avec delaiMaxJours', () => {
  const c = M.couverturePhysique({
    produitsActifs: [{ id: 'p1' }],
    dernierControleParProduit: { p1: '2026-08-11' }, // exactement 7 jours avant le 18
    dateISO: '2026-08-18', fenetreJours: 7,
  });
  assert.strictEqual(c.observes, 1);
  assert.strictEqual(c.pourcentage, 100);
});

test('Catalogue actif vide -> pourcentage null (jamais une division par zéro déguisée en 0%)', () => {
  const c = M.couverturePhysique({ produitsActifs: [], dernierControleParProduit: {}, dateISO: '2026-08-18', fenetreJours: 7 });
  assert.strictEqual(c.total, 0);
  assert.strictEqual(c.pourcentage, null);
});

test('couverturePhysique(7) <= couverturePhysique(30) en observés, sur le même jeu de données (fenêtre plus large = au moins autant de couverture)', () => {
  const produitsActifs = [{ id: 'p1' }, { id: 'p2' }];
  const dernierControleParProduit = { p1: '2026-08-17', p2: '2026-07-25' }; // p2 : il y a 24j
  const c7 = M.couverturePhysique({ produitsActifs, dernierControleParProduit, dateISO: '2026-08-18', fenetreJours: 7 });
  const c30 = M.couverturePhysique({ produitsActifs, dernierControleParProduit, dateISO: '2026-08-18', fenetreJours: 30 });
  assert.ok(c30.observes >= c7.observes);
  assert.strictEqual(c7.observes, 1);
  assert.strictEqual(c30.observes, 2);
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
