// Test — Audit "NEXUS Inventaire Produit — Chaîne de données" (21/08/2026),
// Phase 2 "contrôle qualité de l'import Decenium" (§5 étape 5 : doublon,
// référence inconnue, quantité négative inhabituelle).
//
// Rappel du contexte (voir NEXUS-Data-Dictionary-v2.md v2.202) : l'enquête
// sur le pipeline existant (parserFichierVentesDecenium/rapprocherLignes
// Ventes/comparerVentesQuart) a montré que le staging, le mapping par
// alias explicite et l'idempotence (réimport = remplace, jamais de
// doublon) étaient déjà construits et conformes à l'audit — seul un
// contrôle qualité explicite manquait. Ce lot ajoute UNIQUEMENT
// NexusInventaireMoteur.controleQualiteImportVentes (pur), purement
// informatif, jamais bloquant.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join('/sessions/dazzling-compassionate-ride/mnt/image nexus project', 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');
assert.ok(typeof M.controleQualiteImportVentes === 'function', 'controleQualiteImportVentes non exportée');

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

test('Fichier vide ou undefined -> les 3 listes sont vides, jamais une exception', () => {
  const r1 = M.controleQualiteImportVentes([]);
  assert.strictEqual(r1.doublons.length, 0);
  assert.strictEqual(r1.quantitesNegatives.length, 0);
  assert.strictEqual(r1.referencesInconnues.length, 0);
  const r2 = M.controleQualiteImportVentes(undefined);
  assert.strictEqual(r2.doublons.length, 0);
});

test('Aucun doublon quand chaque référence n\'apparaît qu\'une fois', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: '111', designation_brute: 'Baguette', quantite_vendue: 5, produit_id: 'p1', designation_matchee: 'Baguette' },
    { code_barres_brut: '222', designation_brute: 'Croissant', quantite_vendue: 3, produit_id: 'p2', designation_matchee: 'Croissant' },
  ]);
  assert.strictEqual(r.doublons.length, 0);
});

test('Même code-barres sur 2 lignes -> doublon détecté avec le bon nombre d\'occurrences', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: '111', designation_brute: 'Baguette', quantite_vendue: 5, produit_id: 'p1', designation_matchee: 'Baguette' },
    { code_barres_brut: '111', designation_brute: 'Baguette', quantite_vendue: 2, produit_id: 'p1', designation_matchee: 'Baguette' },
  ]);
  assert.strictEqual(r.doublons.length, 1);
  assert.strictEqual(r.doublons[0].occurrences, 2);
  assert.strictEqual(r.doublons[0].reference, 'Baguette');
});

test('Sans code-barres, la désignation brute sert de clé de regroupement', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: null, designation_brute: 'Gaz 3KG', quantite_vendue: 1, produit_id: null, designation_matchee: null },
    { code_barres_brut: null, designation_brute: 'Gaz 3KG', quantite_vendue: 1, produit_id: null, designation_matchee: null },
    { code_barres_brut: null, designation_brute: 'Glaçons', quantite_vendue: 1, produit_id: null, designation_matchee: null },
  ]);
  assert.strictEqual(r.doublons.length, 1);
  assert.strictEqual(r.doublons[0].occurrences, 2);
});

test('Ligne sans code-barres NI désignation -> ignorée pour le regroupement (jamais fusionnée au hasard)', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: null, designation_brute: '', quantite_vendue: 1, produit_id: null },
    { code_barres_brut: null, designation_brute: '', quantite_vendue: 1, produit_id: null },
  ]);
  assert.strictEqual(r.doublons.length, 0);
});

test('Quantité négative -> signalée avec la référence et la valeur exacte, jamais rejetée', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: '111', designation_brute: 'Gaz 3KG', quantite_vendue: -4, produit_id: 'p1', designation_matchee: 'Gaz 3KG' },
    { code_barres_brut: '222', designation_brute: 'Croissant', quantite_vendue: 3, produit_id: 'p2', designation_matchee: 'Croissant' },
  ]);
  assert.strictEqual(r.quantitesNegatives.length, 1);
  assert.strictEqual(r.quantitesNegatives[0].reference, 'Gaz 3KG');
  assert.strictEqual(r.quantitesNegatives[0].quantite, -4);
});

test('Quantité nulle ou positive -> jamais signalée comme négative', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: '111', designation_brute: 'A', quantite_vendue: 0, produit_id: 'p1' },
    { code_barres_brut: '222', designation_brute: 'B', quantite_vendue: 12, produit_id: 'p2' },
  ]);
  assert.strictEqual(r.quantitesNegatives.length, 0);
});

test('Référence non rapprochée (produit_id null) -> listée nommément, pas seulement comptée', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: null, designation_brute: 'TICKET LOTO', quantite_vendue: 2, produit_id: null },
    { code_barres_brut: '333', designation_brute: 'Croissant', quantite_vendue: 3, produit_id: 'p2' },
  ]);
  assert.strictEqual(r.referencesInconnues.length, 1);
  assert.strictEqual(r.referencesInconnues[0].designation, 'TICKET LOTO');
});

test('Même référence inconnue répétée -> listée une seule fois (pas un doublon de la liste elle-même)', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: null, designation_brute: 'TICKET LOTO', quantite_vendue: 2, produit_id: null },
    { code_barres_brut: null, designation_brute: 'TICKET LOTO', quantite_vendue: 1, produit_id: null },
  ]);
  assert.strictEqual(r.referencesInconnues.length, 1);
  // Deux lignes identiques (même désignation, pas de code-barres) sont en
  // revanche un doublon légitime au sens de controleQualiteImportVentes —
  // les deux contrôles sont indépendants et peuvent tous deux se déclencher.
  assert.strictEqual(r.doublons.length, 1);
});

test('Référence rapprochée (produit_id renseigné) -> jamais dans referencesInconnues', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: '111', designation_brute: 'Baguette', quantite_vendue: 5, produit_id: 'p1' },
  ]);
  assert.strictEqual(r.referencesInconnues.length, 0);
});

test('Ligne sans désignation ni code-barres, non rapprochée -> libellé de repli explicite, jamais vide', () => {
  const r = M.controleQualiteImportVentes([
    { code_barres_brut: null, designation_brute: '', quantite_vendue: 1, produit_id: null },
  ]);
  assert.strictEqual(r.referencesInconnues.length, 1);
  assert.strictEqual(r.referencesInconnues[0].designation, '(sans désignation)');
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
