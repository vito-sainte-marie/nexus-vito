// Test — le sous-titre de l'écran d'ouverture demande de compter et ne promet aucune quantité préremplie (comptage aveugle, #168 ; 02/11).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SRC = fs.readFileSync(process.env.SRC_MUTE || path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');

let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

// Sous-titre posé juste après le titre « Inventaire d'ouverture ».
const m = SRC.match(/"Inventaire d'ouverture";\s*\n\s*document\.getElementById\('sousTitre'\)\.textContent = '([^']*)';/);
assert.ok(m, 'sous-titre de l\'écran d\'ouverture introuvable');
const libelle = m[1];

cas('le libellé demande de compter', () => {
  assert.ok(/compt/i.test(libelle), libelle);
});
cas('le libellé ne promet aucune quantité transmise ni préremplie', () => {
  assert.ok(!/transmis|préremplie|corrigez|vérifiez/i.test(libelle), libelle);
});

console.log(`\n${ok} contrôles OK`);
