// Test — Relevé de clôture FDJ / Trace de contrôle FDJ : fonctions pures
// du moteur (16/08/2026, demande de Frédéric : "je créerais [...] une fiche
// de clôture immuable [...] Situation au moment où l'employé valide, puis
// [...] Situation après régularisation manager"). Exemple donné par
// Frédéric, repris tel quel dans ce test :
//   16/08 — Correction manager : erreur de stock initial sur CASH
//   Ancienne valeur : 24 → Nouvelle valeur : 23
//   Écart recalculé : 0,00€ (écart original conservé : +5,00€)
//
// Consomme le vrai nexus-fdj-moteur.js (require() direct, aucune
// réécriture des fonctions testées).

const assert = require('assert');

require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-fdj-moteur.js');
const M = global.NexusFdjMoteur;

// ------------------------------------------------------------
// statutRelevecloture — jamais un jugement, un simple constat chiffré.
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.statutRelevecloture(1, 0), 'conforme', 'Version 1, écart nul -> conforme');
  assert.strictEqual(M.statutRelevecloture(1, 5), 'valide_avec_ecart', 'Version 1, écart positif -> valide_avec_ecart');
  assert.strictEqual(M.statutRelevecloture(1, -3.5), 'valide_avec_ecart', 'Version 1, écart négatif -> valide_avec_ecart');
  assert.strictEqual(M.statutRelevecloture(2, 0), 'regularise', 'Version 2 (régularisation manager) -> toujours regularise, même écart nul');
  assert.strictEqual(M.statutRelevecloture(3, 5), 'regularise', 'Toute version > 1 -> regularise');
  console.log('OK — statutRelevecloture : version 1 = conforme/valide_avec_ecart selon l\'écart, version 2+ = toujours regularise.');
})();

// ------------------------------------------------------------
// diffClotureFdj — reproduit l'exemple exact donné par Frédéric.
// ------------------------------------------------------------
(() => {
  // Pas de version précédente (première validation employé) -> jamais de diff.
  assert.strictEqual(M.diffClotureFdj(null, { ecart: 5 }), null, 'Aucune version précédente -> pas de diff (baseline)');

  // Rien n'a changé -> pas de diff (jamais un doublon vide dans le journal).
  const identique = { ecart: 5, caisse_reelle: 276.8, stock_initial_par_jeu: { CASH: 24 }, appro_par_jeu: { CASH: 3 }, stock_final_par_jeu: { CASH: 20 } };
  assert.strictEqual(M.diffClotureFdj(identique, { ...identique }), null, 'Snapshots identiques -> aucun diff');

  // Exemple exact de Frédéric : stock initial CASH 24 -> 23, écart +5 -> 0.
  const avant = {
    ecart: 5, caisse_reelle: 276.8, caisse_attendue: 271.8,
    stock_initial_par_jeu: { CASH: 24, GO: 10 }, appro_par_jeu: { CASH: 3, GO: 0 }, stock_final_par_jeu: { CASH: 20, GO: 8 },
  };
  const apres = {
    ecart: 0, caisse_reelle: 276.8, caisse_attendue: 276.8,
    stock_initial_par_jeu: { CASH: 23, GO: 10 }, appro_par_jeu: { CASH: 3, GO: 0 }, stock_final_par_jeu: { CASH: 20, GO: 8 },
  };
  const diff = M.diffClotureFdj(avant, apres);
  assert.deepStrictEqual(diff.ecart, { avant: 5, apres: 0 }, 'Diff écart : +5,00€ (original) -> 0,00€ (régularisé)');
  assert.deepStrictEqual(diff.caisse_attendue, { avant: 271.8, apres: 276.8 }, 'Diff caisse_attendue recalculée avec le nouveau stock');
  assert.deepStrictEqual(diff.stock_initial_par_jeu, { CASH: { avant: 24, apres: 23 } }, 'Diff stock initial : SEULEMENT CASH (GO inchangé, jamais bruyant)');
  assert.strictEqual(diff.caisse_reelle, undefined, 'caisse_reelle inchangée -> absente du diff');
  assert.strictEqual(diff.appro_par_jeu, undefined, 'appro inchangé pour tous les jeux -> absent du diff');
  assert.strictEqual(diff.stock_final_par_jeu, undefined, 'stock final inchangé pour tous les jeux -> absent du diff');
  console.log('OK — diffClotureFdj reproduit exactement l\'exemple de Frédéric (CASH 24→23, écart +5,00€→0,00€), diff minimal et ciblé.');

  // Jeu présent avant mais plus après (ex. jeu retiré du catalogue entre-temps)
  // -> traité comme avant=valeur, apres=null, jamais ignoré silencieusement.
  const diffDisparition = M.diffClotureFdj({ stock_initial_par_jeu: { X: 10 } }, { stock_initial_par_jeu: {} });
  assert.deepStrictEqual(diffDisparition.stock_initial_par_jeu, { X: { avant: 10, apres: null } }, 'Jeu disparu du snapshot -> apparaît avec apres:null, jamais silencieusement ignoré');
  console.log('OK — diffClotureFdj gère un jeu disparu entre deux versions sans jamais l\'ignorer.');
})();

// ------------------------------------------------------------
// caractereRelevecloture — 16/08/2026, demande de Frédéric : "Chaîne
// continue → Relevé définitif. Chaîne interrompue / donnée manquante →
// Relevé provisoire — continuité à régulariser."
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.caractereRelevecloture(false), 'definitif', 'Chaîne intacte -> relevé définitif');
  assert.strictEqual(M.caractereRelevecloture(true), 'provisoire', 'Chaîne rompue (ou anomalie de stock ouverte) -> relevé provisoire');
  console.log('OK — caractereRelevecloture : definitif/provisoire selon la qualité de la chaîne au moment du snapshot.');
})();

console.log('\nTous les tests "relevé de clôture FDJ — moteur" passent.');
