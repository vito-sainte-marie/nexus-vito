// Mise en page de l'écran Paye (09/10/2026, signalé par Frédéric sur Safari).
// Vue bureau : le `body{display:block}` de l'écran annulait la coquille de
// nexus-desktop.js (body en flex) et la barre latérale repoussait le cockpit
// sous elle. Vue mobile : en cartes, les cellules en flex `space-between`
// étalaient leurs blocs et les heures (texte nu) échappaient à l'alignement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const ok = (m) => console.log('  ✓ ' + m);

// Bloc mobile : du @media(max-width:820px) à l'accolade qui le ferme.
function blocMedia(src, entete) {
  const i = src.indexOf(entete);
  assert.ok(i >= 0, entete + ' absent');
  let p = src.indexOf('{', i), n = 0;
  for (let j = p; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}' && --n === 0) return src.slice(p + 1, j);
  }
  throw new Error('bloc non fermé');
}
const mobile = blocMedia(css, '@media(max-width:820px)');
const horsMobile = css.replace(mobile, '');

assert.ok(/body\.nexus-desktop\{display:flex\}/.test(horsMobile), 'la coquille bureau doit rendre body en flex');
assert.ok(/body\.nexus-desktop>\.cockpit\{[^}]*flex:1[^}]*min-width:0/.test(horsMobile), 'le cockpit doit prendre la largeur restante');
ok('vue bureau : body en flex, cockpit à côté de la barre latérale');

const regleTd = (mobile.match(/table\.sal tbody td\{[^}]*\}/) || [''])[0];
assert.ok(/display:grid/.test(regleTd), 'les cellules mobiles doivent être en grille');
assert.ok(!/space-between/.test(regleTd), 'plus de space-between sur les cellules mobiles');
assert.ok(/table\.sal tbody td>\*\{[^}]*grid-column:2[^}]*justify-self:end/.test(mobile), 'les valeurs s’alignent à droite');
ok('vue mobile : en-tête à gauche, valeurs empilées à droite');

const heures = (html.match(/<td data-col="Heures"[^\n]*/) || [''])[0];
assert.ok(/class="cell-num[^"]*"[^>]*><span>\$\{inclus\?/.test(heures), 'la valeur des heures doit être un élément, pas du texte nu');
ok('vue mobile : les heures sont dans un élément aligné');
