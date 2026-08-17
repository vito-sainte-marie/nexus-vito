// Test — Chaîne interrompue dynamique (16/08/2026, demande de Frédéric)
//
// Reproduit le scénario exact rapporté : Quart 1 (Samantha, 15/08) d'abord
// manquant/incomplet, ce qui avait déclenché une alerte "chaîne
// interrompue" sur le Quart 2 (Loane, 15/08). Une fois Samantha complétée
// (statut='valide'), l'alerte doit disparaître automatiquement — sans
// jamais avoir été un statut figé écrit une fois pour toutes.
//
// nexus-fdj-moteur.js est un IIFE qui s'attache à globalThis.NexusFdjMoteur
// dès qu'il est require()-é (voir la dernière ligne du fichier) — aucun
// mock nécessaire, ce sont les vraies fonctions pures testées ici.

require(__dirname + '/nexus-fdj-moteur.js');
const assert = require('assert');
const M = globalThis.NexusFdjMoteur;

// ------------------------------------------------------------
// 1) Scénario Samantha/Loane — AVANT correction (Q1 encore brouillon)
// ------------------------------------------------------------
const q1_14_soir = { id: 'q0', date: '2026-08-14', quart: '2', statut: 'valide' };
const q1_15_matin_brouillon = { id: 'q1', date: '2026-08-15', quart: '1', statut: 'brouillon' };
const q2_15_soir = { id: 'q2', date: '2026-08-15', quart: '2', statut: 'valide' };

let ensemble = [q1_14_soir, q1_15_matin_brouillon, q2_15_soir];

// Loane (Q2) : le quart attendu juste avant (Q1 15/08) existe mais n'est
// pas 'valide' -> rompue = true, motif 'quart_incomplet'.
let etatLoane = M.chaineInterrompueDynamique({ id: 'q2', date: '2026-08-15', quart: '2' }, ensemble);
assert.strictEqual(etatLoane.rompue, true, 'Loane (Q2) doit être rompue tant que Q1 est encore brouillon');
assert.strictEqual(etatLoane.motif, 'quart_incomplet');

// ------------------------------------------------------------
// 2) Samantha complète son Q1 -> passe à 'valide'. AUCUNE colonne
//    previous_shift_id à réécrire ailleurs : on relit juste l'ensemble mis
//    à jour et on recalcule — exactement la garantie demandée par
//    Frédéric ("calculée dynamiquement à partir de la chaîne chronologique
//    réelle", jamais un statut qu'il faudrait aller corriger à la main).
// ------------------------------------------------------------
const q1_15_matin_valide = { ...q1_15_matin_brouillon, statut: 'valide' };
ensemble = [q1_14_soir, q1_15_matin_valide, q2_15_soir];

// Samantha (Q1) elle-même : son propre quart précédent attendu (14/08 Q2)
// est valide -> plus aucune rupture sur SA carte.
let etatSamantha = M.chaineInterrompueDynamique({ id: 'q1', date: '2026-08-15', quart: '1' }, ensemble);
assert.strictEqual(etatSamantha.rompue, false, "La carte de Samantha (Q1) ne doit plus jamais afficher 'Chaîne interrompue' une fois complétée");

// Loane (Q2) : Q1 est maintenant valide -> plus aucune rupture, sans
// qu'aucune action manager n'ait touché la carte de Loane elle-même.
etatLoane = M.chaineInterrompueDynamique({ id: 'q2', date: '2026-08-15', quart: '2' }, ensemble);
assert.strictEqual(etatLoane.rompue, false, "Loane (Q2) doit se rétablir automatiquement dès que Q1 est complété — sans action manager");

console.log('OK — scénario Samantha/Loane : chaîne interrompue puis rétablie automatiquement, sans écriture manuelle.');

// ------------------------------------------------------------
// 3) Le tout premier quart connu du site n'a rien à attendre avant lui.
// ------------------------------------------------------------
let etatPremier = M.chaineInterrompueDynamique({ id: 'q1', date: '2026-08-15', quart: '1' }, [q1_15_matin_valide]);
assert.strictEqual(etatPremier.rompue, false, 'Le tout premier quart connu du site ne doit jamais être signalé "rompu"');
console.log('OK — premier quart connu du site : jamais signalé à tort.');

// ------------------------------------------------------------
// 4) Quart précédent totalement absent (jamais créé, pas juste brouillon).
// ------------------------------------------------------------
const q3_16_matin = { id: 'q3', date: '2026-08-16', quart: '1', statut: 'valide' };
let etatAbsent = M.chaineInterrompueDynamique({ id: 'q3', date: '2026-08-16', quart: '1' }, [q1_14_soir, q3_16_matin]);
assert.strictEqual(etatAbsent.rompue, true);
assert.strictEqual(etatAbsent.motif, 'quart_manquant');
console.log('OK — quart précédent totalement absent : signalé "quart_manquant".');

// ------------------------------------------------------------
// 5) Continuité de stock à vérifier — chaîne intacte mais chiffres qui ne
//    recollent pas -> jamais qualifié de "chaîne interrompue".
// ------------------------------------------------------------
let ecarts = M.ecartsContinuiteStock({ gameA: 120, gameB: 40 }, { gameA: 118, gameB: 40 });
assert.deepStrictEqual(ecarts, [{ game_id: 'gameA', stock_final_precedent: 120, stock_initial_actuel: 118 }]);
console.log('OK — ecartsContinuiteStock : détecte le seul jeu en écart, jamais les jeux cohérents.');

// Aucune valeur connue des deux côtés pour un jeu -> jamais un faux écart.
let ecartsIncomplets = M.ecartsContinuiteStock({ gameA: 120 }, { gameB: 40 });
assert.deepStrictEqual(ecartsIncomplets, [], 'Un jeu dont une seule des deux valeurs est connue ne doit jamais être comparé');
console.log('OK — ecartsContinuiteStock : ne compare jamais un jeu à moitié connu.');

// etatIntegriteFdj : stockAVerifier ne doit JAMAIS produire "ROMPUE".
let etatStock = M.etatIntegriteFdj({ rompue: false, stockAVerifier: true, aRevoir: false, validationManagerFaite: true });
assert.strictEqual(etatStock.integrite, 'PARTIELLE');
assert.strictEqual(etatStock.motif, 'continuite_stock_a_verifier');
console.log('OK — etatIntegriteFdj : continuité de stock à vérifier reste PARTIELLE, jamais ROMPUE.');

// rompue reste toujours prioritaire sur stockAVerifier.
let etatRompuePrioritaire = M.etatIntegriteFdj({ rompue: true, stockAVerifier: true, aRevoir: false, validationManagerFaite: true });
assert.strictEqual(etatRompuePrioritaire.integrite, 'ROMPUE');
assert.strictEqual(etatRompuePrioritaire.motif, 'quart_manquant');
console.log('OK — etatIntegriteFdj : une vraie rupture prime toujours sur un simple écart de stock.');

console.log('Tous les tests chaîne interrompue dynamique passent.');
