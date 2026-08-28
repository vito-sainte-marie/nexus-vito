// Test — Règle de permission "écart de caisse FDJ".
//
// 28/08/2026, demande de Frédéric : RENVERSE la règle du 16/08/2026
// ("Voir : oui" en permanence) — "l'employé ne devrait pas pouvoir
// rechercher la valeur attendue [...] NEXUS enregistrerait alors une caisse
// apparemment parfaite sans connaître la première déclaration." Nouvelle
// règle : "Voir : seulement après clôture. Corriger avant clôture : oui,
// avec traçabilité. Modifier après clôture : non. Régulariser après
// clôture : manager uniquement, sans effacer le constat d'origine."
//
// nexus-fdj-moteur.js est un IIFE qui s'attache à globalThis.NexusFdjMoteur
// dès qu'il est require()-é — aucun mock nécessaire, ce sont les vraies
// fonctions pures testées ici.

require(__dirname + '/nexus-fdj-moteur.js');
const assert = require('assert');
const M = globalThis.NexusFdjMoteur;

// ------------------------------------------------------------
// 1) permissionsEcartCaisseEmploye — source unique de la règle.
// ------------------------------------------------------------

// Quart pas encore clôturé (brouillon) : ne voit PAS l'écart, corrige
// directement (saisie libre, rien n'est encore figé).
let permsBrouillon = M.permissionsEcartCaisseEmploye({ statut: 'brouillon' });
assert.strictEqual(permsBrouillon.voir, false, 'L\'écart ne doit jamais être visible avant la clôture (28/08/2026)');
assert.strictEqual(permsBrouillon.corrigerDirectement, true, 'Avant clôture, l\'employé corrige librement');
assert.strictEqual(permsBrouillon.demanderCorrection, false, 'Avant clôture, pas besoin de "demander" — on corrige directement');
console.log('OK — quart brouillon : voir=false, corrigerDirectement=true, demanderCorrection=false.');

// Quart clôturé (validé) : voit l'écart (Point de clôture révélé), demande
// une correction, ne modifie plus jamais directement.
let permsValide = M.permissionsEcartCaisseEmploye({ statut: 'valide' });
assert.strictEqual(permsValide.voir, true, 'L\'écart devient visible une fois la caisse clôturée');
assert.strictEqual(permsValide.corrigerDirectement, false, 'Après clôture : "Modifier après clôture : non"');
assert.strictEqual(permsValide.demanderCorrection, true, 'Après clôture, seul recours : demander une correction');
console.log('OK — quart clôturé : voir=true, corrigerDirectement=false, demanderCorrection=true.');

// Absence de quart (shift null/undefined) — ne doit jamais planter, doit se
// comporter comme "pas encore clôturé" (le plus sûr : rien à révéler tant
// qu'aucune clôture n'a eu lieu).
let permsAbsent = M.permissionsEcartCaisseEmploye(null);
assert.strictEqual(permsAbsent.voir, false);
assert.strictEqual(permsAbsent.corrigerDirectement, true);
assert.strictEqual(permsAbsent.demanderCorrection, false);
console.log('OK — shift null : ne plante jamais, traité comme non-clôturé.');

// ------------------------------------------------------------
// 2) ecartCaisse — vérifie que l'écart reste identique, qu'il soit affiché
//    immédiatement (employé) ou après coup (manager) : même formule, une
//    seule fois calculée (Article 11).
// ------------------------------------------------------------
const attendue = M.caisseAttendue(M.caisseGrattage(500, 120), 80, 0); // 380 + 80 = 460
assert.strictEqual(attendue, 460);
const ecart = M.ecartCaisse(455, attendue);
assert.strictEqual(ecart, -5, 'Écart = caisse réelle - caisse attendue, jamais l\'inverse');
console.log('OK — ecartCaisse : même calcul, quel que soit le moment où il est affiché.');

console.log('Tous les tests permissions écart de caisse FDJ passent.');
