// Test — Continuité des stocks Q1/Q2 (FDJ Manager), arbitrage définitif du
// 10/10/2026 (Frédéric). Il remplace la règle « priorité au stock initial
// du quart suivant » du même jour.
//
//   1. Initialisation bidirectionnelle : fin Q1 absente -> renseignée depuis
//      le début Q2 ; début Q2 absent -> prérempli depuis la fin Q1.
//   2. Le début Q2 fait autorité : sa modification rapproche la fin Q1 ;
//      une modification de Q1 n'écrase jamais Q2.
//   3. Rupture signalée, manager alerté quand une fin Q1 enregistrée est
//      corrigée, motif exigé pour toute correction d'une valeur enregistrée.
//   4. Ventes recalculées après correction.
//
// Ce fichier couvre le moteur (vrai fichier chargé) et le câblage de l'écran
// (lecture du HTML servi). La base (journal, caisse, valide_le, accès) est
// éprouvée sous rollback sur nexus-test : voir
// docs/recette/fdj-priorite-stock-initial-suivant-20261010.md.

const fs = require('fs');
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

// Situation 1 — fin Q1 absente, début Q2 présent.
test('S1 : fin Q1 absente -> renseignée depuis le début Q2, sans alerte', () => {
  assert.deepStrictEqual(M.initialisationContinuite(null, 18), { action: 'renseigner_fin_q1', valeur: 18 });
  assert.deepStrictEqual(M.initialisationContinuite('', 18), { action: 'renseigner_fin_q1', valeur: 18 });
  const r = M.rapprochementFinQ1({ g15: 18 }, { g15: null });
  assert.deepStrictEqual(r.corrections, [{ game_id: 'g15', ancienne_valeur: null, nouvelle_valeur: 18, correction_valeur_enregistree: false }]);
  assert.strictEqual(r.alerteManager, false, 'renseigner une fin absente n\'est pas corriger');
});

// Situation 2 — début Q2 absent, fin Q1 présente.
test('S2 : début Q2 absent -> prérempli depuis la fin Q1', () => {
  assert.deepStrictEqual(M.initialisationContinuite(25, null), { action: 'preremplir_debut_q2', valeur: 25 });
  assert.deepStrictEqual(M.initialisationContinuite(0, undefined), { action: 'preremplir_debut_q2', valeur: 0 },
    'un stock nul est une valeur, pas une absence');
  // Un début absent ne rapproche rien.
  assert.deepStrictEqual(M.rapprochementFinQ1({ g10: null }, { g10: 25 }).corrections, []);
});

// Situation 3 — rupture : les deux présents et différents.
test('S3 : rupture détectée, Q2 fait autorité', () => {
  assert.deepStrictEqual(M.initialisationContinuite(25, 26), { action: 'rupture', valeur: 26, ecart: -1 });
  assert.deepStrictEqual(M.initialisationContinuite(26, 26), { action: 'aucune', valeur: 26 });
  assert.deepStrictEqual(M.initialisationContinuite(null, null), { action: 'aucune', valeur: null },
    'jamais 0 par défaut');
  assert.strictEqual(M.verdictContinuiteStock({ shiftPrecedentId: 'q1', stockFinalPrecedent: 25, stockInitialActuel: 26 }).verdict, 'ecart_reel');
});

// Situation 4 — modification du début Q2 : la fin Q1 enregistrée est
// corrigée, le manager alerté, un motif exigé.
test('S4 : début Q2 modifié -> fin Q1 corrigée, alerte manager, motif exigé', () => {
  const r = M.rapprochementFinQ1({ g10: 26, g15: 18 }, { g10: 25, g15: 18 });
  assert.deepStrictEqual(r.corrections, [{ game_id: 'g10', ancienne_valeur: 25, nouvelle_valeur: 26, correction_valeur_enregistree: true }]);
  assert.strictEqual(r.alerteManager, true);
  assert.strictEqual(M.motifCorrectionStockValide(''), false);
  assert.strictEqual(M.motifCorrectionStockValide('    ok  '), false);
  assert.strictEqual(M.motifCorrectionStockValide('Recomptage début Q2'), true);
  assert.strictEqual(M.MOTIF_CORRECTION_STOCK_MIN, 5);
});

// Situation 5 — correction de Q1 : Q2 n'est jamais écrasé.
test('S5 : correction de Q1 -> Q2 jamais réécrit, hérité ou confirmé', () => {
  [true, false].forEach(auto => {
    const r = M.propagationCorrectionStock(
      [{ game_id: 'g10', nouvelle_valeur: 24 }],
      { g10: { stock_initial: 26, stock_initial_auto: auto } });
    assert.strictEqual(r.applicables.length, 0, `Q2 (auto=${auto}) serait réécrit`);
    assert.deepStrictEqual(r.aRevoir, [{ game_id: 'g10', valeur_quart_precedent: 24, valeur_saisie: 26 }]);
  });
});

test('Corrections de valeurs enregistrées : renseigner un champ vide n\'en est pas une', () => {
  const out = M.correctionsValeursEnregistrees(
    { g10: { stock_initial: 30, stock_final: 25 }, g15: { stock_initial: 20, stock_final: null } },
    { g10: { stock_initial: 30, stock_final: 26 }, g15: { stock_initial: 20, stock_final: 18 } });
  assert.deepStrictEqual(out, [{ game_id: 'g10', champ: 'stock_final', ancienne_valeur: 25, nouvelle_valeur: 26 }]);
});

test('Recalcul des ventes de Q1 après alignement (prix réels : 10 € et 15 €)', () => {
  // G10 : 30 en début, aucun appro, fin 25 corrigée en 26.
  assert.deepStrictEqual(M.calculerVentesJeu({ stock_initial: 30, appro: 0, stock_final: 25 }, 10), { qte: 5, valeur: 50 });
  assert.deepStrictEqual(M.calculerVentesJeu({ stock_initial: 30, appro: 0, stock_final: 26 }, 10), { qte: 4, valeur: 40 });
  // G15 : 20 en début, fin absente renseignée à 18.
  assert.deepStrictEqual(M.calculerVentesJeu({ stock_initial: 20, appro: 0, stock_final: 18 }, 15), { qte: 2, valeur: 30 });
});

// Câblage : les fonctions pures ne prouvent rien si l'écran ne les appelle pas.
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-FDJ-Manager-v1.html'), 'utf8');
test('Câblage écran : rapprochement serveur après enregistrement, motif exigé avant', () => {
  assert.ok(html.includes("rpc('fdj_manager_aligner_fin_quart_precedent'"), 'l\'écran n\'appelle pas la commande de rapprochement');
  assert.ok(/NexusFdjMoteur\.rapprochementFinQ1\(/.test(html), 'le pré-contrôle n\'utilise pas rapprochementFinQ1');
  assert.ok(/NexusFdjMoteur\.motifCorrectionStockValide\(/.test(html), 'le motif n\'est pas contrôlé');
  assert.ok(!html.includes('appliquerCorrectionsAutomatiquesContinuite'), 'la réécriture automatique de Q2 est revenue');
});

const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261010170000_fdj_continuite_stock_q1_q2.sql'), 'utf8');
test('Migration : contrôle d\'accès, motif, journal, caisse, valide_le', () => {
  assert.ok(/fdj_quart_du_manager\(p_shift_id\)/.test(sql) && /fdj_quart_du_manager\(v_prec\.id\)/.test(sql), 'contrôle d\'accès sur Q2 et Q1');
  assert.ok(/length\(btrim\(p_motif\)\) < 5/.test(sql), 'motif exigé pour une correction');
  assert.ok(sql.includes('stock_final_aligne_quart_suivant') && sql.includes('alignement_fin_sur_quart_suivant'), 'journal');
  assert.ok(sql.includes('fdj_corriger_caisse_manager(v_prec.id'), 'recalcul de caisse par la commande existante');
  assert.ok(/coalesce\(valide_le, now\(\)\)/.test(sql), 'valide_le préservé');
  assert.ok(!/update public\.fdj_shift_counts[\s\S]{0,200}stock_initial\s*=/.test(sql), 'Q2 ne doit jamais être réécrit');
  assert.ok(/revoke all on function public\.fdj_manager_aligner_fin_quart_precedent\(uuid, text\) from anon/.test(sql), 'anon fermé');
});

console.log(`\n${nbOk}/${nbTests} tests OK`);
if (nbOk !== nbTests) process.exit(1);
