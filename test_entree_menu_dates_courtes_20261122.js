// Dates courtes : entrée de menu manager dans le groupe Performer, juste après Produits (#160, 22/11/2026).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const APP = lire('NEXUS-App-v1.html'), DOC = lire('NEXUS-Documentation-v1.html');
function entree(src) {
  const m = src.match(/<a class="nav-item"[^>]*href="NEXUS-Dates-Courtes-v1\.html"[^>]*>[\s\S]*?<\/a>/);
  return m ? m[0] : null;
}
const regle = src => { const e = entree(src); return !!e && /data-role="manager"/.test(e.split('>')[0]) && !/data-forfait/.test(e.split('>')[0]); };

t('l\'entrée existe, pointe vers la page et est réservée au rôle manager', () => {
  const e = entree(APP);
  assert.ok(e, 'entrée absente');
  const ouv = e.split('>')[0];
  assert.ok(/data-role="manager"/.test(ouv), 'data-role manager attendu');
  assert.ok(!/data-role="(?!manager)/.test(ouv), 'aucun autre rôle');
});
t('icône mod-dates-courtes en 34 px avec srcset 1x, 2x, 3x', () => {
  const e = entree(APP);
  assert.ok(/data-nexus-icone="mod-dates-courtes"/.test(e) && /data-nexus-taille="34"/.test(e));
  for (const d of ['1x', '2x', '3x']) assert.ok(new RegExp('mod-dates-courtes@' + d + '\\.webp ' + d).test(e), d);
});
t('l\'entrée vient juste après Produits', () => {
  const i = APP.indexOf('href="NEXUS-Produits-v1.html">'), j = APP.indexOf('href="NEXUS-Dates-Courtes-v1.html"');
  assert.ok(i > 0 && j > i);
  assert.ok(!/<a class="nav-item"/.test(APP.slice(i + 10, j).replace(/<a class="nav-item"[^>]*NEXUS-Dates[^>]*$/, '')) || APP.slice(i, j).split('<a class="nav-item"').length === 2);
});
t('aucun compteur ni résumé d\'accueil ajouté pour cette entrée', () => {
  assert.ok(!/href === 'NEXUS-Dates-Courtes-v1\.html'/.test(APP));
});
t('la fiche de documentation existe (module mod-dates-courtes, groupe performer)', () => {
  assert.ok(/id: 'dates-courtes', module: 'mod-dates-courtes', groupe: 'performer'/.test(DOC));
  assert.ok(/role: 'Manager'/.test(DOC.slice(DOC.indexOf("id: 'dates-courtes'"), DOC.indexOf("id: 'rayon'"))));
});
t('garde : sans data-role manager, la règle rougit', () => {
  assert.ok(regle(APP));
  const mut = APP.replace(/(<a class="nav-item") data-role="manager"( href="NEXUS-Dates-Courtes-v1\.html")/, '$1$2');
  assert.notStrictEqual(mut, APP);
  assert.ok(!regle(mut));
});
console.log(n + ' contrôles');
