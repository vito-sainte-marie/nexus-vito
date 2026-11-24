'use strict';
// Lot 3 bureau (24/11) : deux colonnes de l'accueil employé, en vue bureau activée seulement.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('NEXUS-App-v1.html', 'utf8');

// Le bloc du lot : de son commentaire à la fin de son @media.
function bloc(s) {
  const i = s.indexOf('/* Lot 3 bureau (24/11)');
  assert(i > -1, 'bloc Lot 3 bureau absent');
  const m = s.indexOf('@media', i);
  const fin = s.indexOf('\n  }', m);
  assert(m > -1 && fin > -1, 'bloc mal formé');
  return s.slice(m, fin + 4);
}
const HOTE = 'body.accueil-piste.nexus-desktop #accueilPisteHote';

const garde = {
  'deux colonnes seulement dans un @media ≥ 900 px': (s) => {
    assert(/^@media \(min-width:900px\)\{/.test(bloc(s)));
  },
  'deux colonnes seulement en vue bureau activée (nexus-desktop)': (s) => {
    const b = bloc(s);
    const regles = b.split('\n').filter((l) => /\{/.test(l) && !/^@media/.test(l.trim()));
    assert(regles.length >= 5);
    regles.forEach((l) => assert(l.trim().indexOf(HOTE) === 0, 'règle hors vue bureau : ' + l.trim().slice(0, 60)));
  },
  'grille 7/5, écart 16 px, largeur 1040 px centrée': (s) => {
    const b = bloc(s);
    assert(/display:grid;grid-template-columns:minmax\(0,7fr\) minmax\(0,5fr\);column-gap:16px/.test(b));
    assert(/max-width:1040px;margin:0 auto/.test(b));
  },
  'colonne gauche : poste et fil ; droite : le reste ; salutation sur toute la largeur': (s) => {
    const b = bloc(s);
    assert(/> \*\{grid-column:2;\}/.test(b));
    assert(/> \.ap-salut\{grid-column:1 \/ -1;\}/.test(b));
    assert(/> \.ap-poste\{grid-column:1;/.test(b));
    assert(/> \.ap-fil\{grid-column:1;/.test(b));
  },
  'vue bureau désactivée et mobile inchangés : l\'hôte reste un bloc simple hors du @media': (s) => {
    assert(/body\.accueil-piste #accueilPisteHote\{display:block;padding:0 20px 24px;\}/.test(s));
    const hors = s.replace(bloc(s), '');
    assert(!/nexus-desktop #accueilPisteHote\{display:grid/.test(hors), 'grille hors du @media');
  },
  'cibles 44 px et focus : le bloc ne touche ni hauteur, ni outline': (s) => {
    const b = bloc(s);
    assert(!/min-height|outline|:focus/.test(b));
    assert(!/(^|[^-])height:/.test(b));
  },
  'ni masquage ni flash : aucun display:none dans le bloc': (s) => {
    assert(!/display:none/.test(bloc(s)));
  },
};

Object.keys(garde).forEach((n) => { garde[n](app); console.log('ok', n); });

const MUT = [
  ['sans @media', 'deux colonnes seulement dans un @media ≥ 900 px', (s) => s.replace('@media (min-width:900px){\n    body.accueil-piste.nexus-desktop #accueilPisteHote{display:grid', '@media (min-width:0px){\n    body.accueil-piste.nexus-desktop #accueilPisteHote{display:grid')],
  ['sans nexus-desktop', 'deux colonnes seulement en vue bureau activée (nexus-desktop)', (s) => s.replace('body.accueil-piste.nexus-desktop #accueilPisteHote > .ap-fil{', 'body.accueil-piste #accueilPisteHote > .ap-fil{')],
  ['grille 1/1', 'grille 7/5, écart 16 px, largeur 1040 px centrée', (s) => s.replace('minmax(0,7fr) minmax(0,5fr)', 'minmax(0,1fr) minmax(0,1fr)')],
  ['fil à droite', 'colonne gauche : poste et fil ; droite : le reste ; salutation sur toute la largeur', (s) => s.replace('> .ap-fil{grid-column:1;', '> .ap-fil{grid-column:2;')],
  ['grille partout', 'vue bureau désactivée et mobile inchangés : l\'hôte reste un bloc simple hors du @media', (s) => s.replace('body.accueil-piste #accueilPisteHote{display:block;padding:0 20px 24px;}', 'body.accueil-piste #accueilPisteHote{display:grid;padding:0 20px 24px;}')],
  ['hauteur imposée', 'cibles 44 px et focus : le bloc ne touche ni hauteur, ni outline', (s) => s.replace('align-items:start;grid-auto-flow', 'align-items:start;min-height:0;grid-auto-flow')],
  ['masquage', 'ni masquage ni flash : aucun display:none dans le bloc', (s) => s.replace('> .ap-fil{grid-column:1;', '> .ap-fil{display:none;grid-column:1;')],
];
MUT.forEach(([nom, g, f]) => {
  const m = f(app); assert.notStrictEqual(m, app, 'mutation sans effet : ' + nom);
  let rouge = false; try { garde[g](m); } catch (e) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
});
console.log('Lot 3 bureau : gardes et mutations OK');
