// Test — Règle de permission "écart de caisse FDJ" (16/08/2026, demande de
// Frédéric) : "Voir : oui. Corriger avant validation : oui, avec
// traçabilité. Modifier après validation : non. Régulariser après
// validation : manager uniquement, sans effacer le constat d'origine."
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

// Quart pas encore transmis (brouillon) : voir + corriger directement.
let permsBrouillon = M.permissionsEcartCaisseEmploye({ statut: 'brouillon' });
assert.strictEqual(permsBrouillon.voir, true, 'L\'écart doit toujours être visible, même avant validation');
assert.strictEqual(permsBrouillon.corrigerDirectement, true, 'Avant validation, l\'employé corrige librement');
assert.strictEqual(permsBrouillon.demanderCorrection, false, 'Avant validation, pas besoin de "demander" — on corrige directement');
console.log('OK — quart brouillon : voir=true, corrigerDirectement=true, demanderCorrection=false.');

// Quart transmis (validé) : voir + demander une correction, jamais modifier
// directement.
let permsValide = M.permissionsEcartCaisseEmploye({ statut: 'valide' });
assert.strictEqual(permsValide.voir, true, 'L\'écart reste visible après validation (règle "Voir : oui")');
assert.strictEqual(permsValide.corrigerDirectement, false, 'Après validation : "Modifier après validation : non"');
assert.strictEqual(permsValide.demanderCorrection, true, 'Après validation, seul recours : demander une correction');
console.log('OK — quart validé : voir=true, corrigerDirectement=false, demanderCorrection=true.');

// Absence de quart (shift null/undefined) — ne doit jamais planter, doit se
// comporter comme "pas encore validé" (comportement le plus permissif/sûr
// pour un quart qui n'existe pas encore).
let permsAbsent = M.permissionsEcartCaisseEmploye(null);
assert.strictEqual(permsAbsent.voir, true);
assert.strictEqual(permsAbsent.corrigerDirectement, true);
assert.strictEqual(permsAbsent.demanderCorrection, false);
console.log('OK — shift null : ne plante jamais, traité comme non-validé.');

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
