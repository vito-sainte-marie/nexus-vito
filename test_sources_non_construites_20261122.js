'use strict';
// Garde « source » (Guardian 7089480665) : aucune page versionnée ne doit porter les traces du build.
// Le build (outils/build.sh) épingle chaque script sur un identifiant de 12 hex et injecte la configuration,
// nexus-page.js et le bandeau. Ces épreuves lisent l'arbre SOURCE (avant build) : un arbre construit commité les rougit.
// La CI les lance avant build.sh ; sur un arbre construit à dessein elles ne s'appliquent pas.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

// Exceptions source, une par une : page -> balises injectées qu'elle porte légitimement en source.
// Aucune au 22/11 : NEXUS-Login-v1.html cite nexus-config.js dans un message d'erreur, mais ne charge pas la balise.
const EXCEPTIONS = {};
const BALISES = ['nexus-config.js', 'nexus-page.js', 'nexus-bandeau-environnement.js'];
const pages = fs.readdirSync(D).filter(f => /\.html$/.test(f));

t('aucune page source ne porte une épingle de build (?v= de 12 hex)', () => {
  const fautes = [];
  pages.forEach(p => {
    const h = fs.readFileSync(path.join(D, p), 'utf8');
    const r = /src="[^"]*\.js\?v=[0-9a-f]{12}"/g; let m;
    while ((m = r.exec(h))) fautes.push(p + ' : ' + m[0]);
  });
  assert.deepStrictEqual(fautes, [], 'arbre construit commité ? épingles de build en source :\n' + fautes.join('\n'));
});

t('aucune page source ne porte les balises injectées par generer-config.js (hors exceptions listées)', () => {
  const fautes = [];
  pages.forEach(p => {
    const h = fs.readFileSync(path.join(D, p), 'utf8');
    BALISES.forEach(b => {
      if ((EXCEPTIONS[p] || []).includes(b)) return;
      if (new RegExp('<script[^>]*src="' + b.replace(/\./g, '\\.') + '[?"]').test(h)) fautes.push(p + ' : ' + b);
    });
  });
  assert.deepStrictEqual(fautes, [], 'balises injectées en source :\n' + fautes.join('\n'));
});

t('les exceptions listées existent encore (liste à jour)', () => {
  Object.keys(EXCEPTIONS).forEach(p => {
    assert.ok(pages.includes(p), 'exception périmée : ' + p);
    const h = fs.readFileSync(path.join(D, p), 'utf8');
    EXCEPTIONS[p].forEach(b => assert.ok(h.includes('src="' + b), p + ' ne porte plus ' + b + ' : retirer l\'exception'));
  });
});

console.log(n + ' épreuves OK');
