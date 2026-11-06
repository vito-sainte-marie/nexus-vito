// Correctif Safari (Guardian #160, 6690062124) : la page Manager n'utilise plus les colonnes CSS
// (carte Photo Decenium non peinte, vide en bas de page) mais une grille ; le résumé Photo Decenium
// affiche des états réels au lieu d'un « Chargement… » sans fin.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const page = lire('NEXUS-Inventaire-Manager-v1.html');
const plein = lire('nexus-inventaire-manager-fullwidth-v2.js');

// 1. Grille deux colonnes, colonnes CSS neutralisées, blocs injectés sur toute la largeur.
assert.ok(/body\.nexus-desktop \.desktop-grid\{column-count:auto;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(page), 'grille à deux colonnes');
for (const sel of ['.indicateurs', '.conseiller-card', '.inv-photo-decenium-access', '#nexusManagerReassortCigarettesV3']) {
  assert.ok(page.includes('.desktop-grid>' + sel), 'pleine largeur : ' + sel);
}
assert.ok(/grid-column:1 \/ -1\}/.test(page), 'grid-column:1 / -1');
assert.ok(!/column-span:all/.test(page), 'plus de column-span (source des défauts Safari)');

// 2. États du résumé : posés par renderTout, lus par le script.
assert.ok(page.includes("ct.dataset.ventes = !quartRow ? 'quart-non-demarre'"), 'état des ventes selon le quart');
assert.ok(page.includes('ct.dataset.photoEtat'), 'état de la photo posé');
assert.ok(plein.includes("'Active · référence '") && plein.includes('quart pas encore démarré'), 'textes attendus');
assert.ok(!/classList\.add\('is-waiting'\)/.test(plein), 'is-waiting seulement avant le premier rendu');

// 3. Le texte d'état reste visible sur mobile.
assert.ok(!/inv-photo-decenium-access-sub\{display:none/.test(plein), 'sous-titre visible sur iPhone');
console.log('OK');
