'use strict';
// Lot 2.3 : Dates courtes dans le menu latéral bureau, la recherche et le catalogue des raccourcis.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(D, f), 'utf8');
const desktop = lire('nexus-desktop.js'), recherche = lire('nexus-recherche.js'), catalogue = lire('nexus-raccourcis-catalogue.js');

t('menu bureau : entrée dans Performer, juste après Produits, module v2', () => {
  const i = desktop.indexOf("label: 'Produits', module: 'mod-produits'");
  const j = desktop.indexOf("label: 'Dates courtes', module: 'mod-dates-courtes'");
  assert.ok(i > 0 && j > i);
  assert.ok(desktop.slice(i, j).split('\n').length === 2, 'Dates courtes doit suivre Produits immédiatement');
  const ligne = desktop.slice(j, desktop.indexOf('\n', j));
  assert.ok(ligne.includes("href: 'NEXUS-Dates-Courtes-v1.html'"));
  assert.ok(!/emoji/.test(ligne));
});
t('menu bureau : l\'ancien rendu (si ICONES_V2 = false) reste l\'icône v2, jamais un emoji', () => {
  const m = desktop.match(/label: 'Dates courtes'[^\n]*icon: '([^']+)'/);
  assert.ok(m && fs.existsSync(path.join(D, m[1])), 'icône absente');
  assert.ok(m[1].startsWith('assets/icones/v2/mod-dates-courtes/'));
});
t('le rendu passe par NexusIcones.img(item.module) comme les voisins', () => {
  assert.ok(/NexusIcones\.img\(item\.module, 16/.test(desktop));
  assert.ok(/'mod-dates-courtes':/.test(lire('nexus-icones.js')));
});
t('recherche : deux entrées, pages existantes, rôle manager', () => {
  [['Dates courtes', 'NEXUS-Dates-Courtes-v1.html'], ['Relevé des dates courtes', 'NEXUS-Dates-Courtes-Releve-v1.html']].forEach(([l, h]) => {
    const r = new RegExp("label: '" + l + "'[^\\n]*href: '" + h + "', role: 'manager' \\}");
    assert.ok(r.test(recherche), l);
    assert.ok(fs.existsSync(path.join(D, h)), h + ' absente');
  });
});
t('raccourcis : entrée au catalogue, hors RACCOURCIS_DEFAUT', () => {
  assert.ok(/'NEXUS-Dates-Courtes-v1\.html': \{ label: 'Dates courtes', module: 'mod-dates-courtes'/.test(catalogue));
  const def = catalogue.match(/RACCOURCIS_DEFAUT = \[([^\]]*)\]/)[1];
  assert.ok(!def.includes('Dates-Courtes'));
});
t('menu bureau : pas de filtre de rôle propre à Produits à répliquer', () => {
  assert.ok(!/role/.test(desktop.slice(desktop.indexOf("label: 'Dates courtes'"), desktop.indexOf('\n', desktop.indexOf("label: 'Dates courtes'")))));
});
console.log(n + '/' + n);
