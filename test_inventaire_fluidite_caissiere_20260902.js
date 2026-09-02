// Régression — fluidité du parcours caissière après le test terrain du 02/09/2026.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fluidite = require('./nexus-inventaire-fluidite.js');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

assert.strictEqual(fluidite.quantiteApresConditionnement('2', 8), '16',
  '2 conditionnements de 8 doivent devenir immédiatement 16 unités');
assert.strictEqual(fluidite.quantiteApresConditionnement('', 10), '10',
  'un appui sans quantité doit représenter un conditionnement');
assert.strictEqual(fluidite.quantiteApresConditionnement('2,5', 8), '20',
  'la virgule décimale doit rester compatible avec le clavier français');

assert(html.includes('📍 Caisse uniquement — bureau géré par le manager'),
  'le carrousel doit rappeler que le bureau est réservé au manager');
assert(html.includes("placeholder=\"${estCigaretteCaisseEmploye(p) ? 'Comptage caisse' : 'Votre comptage'}\""),
  'le champ du carrousel cigarettes doit être nommé Comptage caisse');
assert(html.includes('let repriseAutomatiquePremierAccueil = true;'),
  'la reprise automatique doit être limitée au premier accueil');
assert(html.includes('await demarrerOuvertureComptage();\n        return;'),
  'un brouillon positionné doit reprendre directement le comptage');

console.log('OK — parcours caissière : libellé caisse, ×conditionnement immédiat et reprise directe.');
