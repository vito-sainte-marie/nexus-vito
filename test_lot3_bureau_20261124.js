'use strict';
// Lot 3 bureau (24/11) : deux colonnes réelles de l'accueil employé, en vue bureau activée seulement.
// Recette Guardian 7139515182 : plus de rangées étirées (écart ≤ 16 px dans chaque colonne), bouton principal du renfort en colonne gauche.
// Mesure faite sur banc navigateur (1280×800, pompiste/caissière/renfort : tous les écarts = 12 px) ; ici, les gardes qui la tiennent.
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
function wrapJs(s) {
  const i = s.indexOf("className = 'ap-col ap-col-g'");
  assert(i > -1, 'enveloppes JS absentes');
  return s.slice(i - 80, s.indexOf('})();', i));
}
const HOTE = 'body.accueil-piste.nexus-desktop #accueilPisteHote';

const garde = {
  'deux colonnes seulement dans un @media ≥ 900 px': (s) => {
    assert(/^@media \(min-width:900px\)\{/.test(bloc(s)));
  },
  'deux colonnes seulement en vue bureau activée (nexus-desktop)': (s) => {
    const regles = bloc(s).split('\n').filter((l) => /\{/.test(l) && !/^@media/.test(l.trim()));
    assert(regles.length >= 5);
    regles.forEach((l) => assert(l.trim().indexOf(HOTE) === 0, 'règle hors vue bureau : ' + l.trim().slice(0, 60)));
  },
  'grille 7/5, écart 16 px, largeur 1040 px centrée': (s) => {
    const b = bloc(s);
    assert(/display:grid;grid-template-columns:minmax\(0,7fr\) minmax\(0,5fr\);column-gap:16px/.test(b));
    assert(/max-width:1040px;margin:0 auto/.test(b));
  },
  'rangées non étirées : align-content:start et align-items:start': (s) => {
    const b = bloc(s);
    assert(/align-content:start;align-items:start/.test(b));
    assert(!/grid-row:\d+ \/ span/.test(b), 'bloc étalé sur plusieurs rangées partagées');
  },
  'chaque colonne est une pile flex dont l\'écart est ≤ 16 px': (s) => {
    const m = bloc(s).match(/> \.ap-col\{display:flex;flex-direction:column;gap:(\d+)px;/);
    assert(m, 'pile flex absente');
    assert(Number(m[1]) <= 16, 'écart > 16 px');
  },
  'les marges des blocs sont remises à zéro dans les colonnes': (s) => {
    assert(/> \.ap-col > \*\{margin:0;\}/.test(bloc(s)));
  },
  'colonne gauche en 1, colonne droite en 2, salutation sur toute la largeur': (s) => {
    const b = bloc(s);
    assert(/> \.ap-col-g\{grid-column:1;\}/.test(b));
    assert(/> \.ap-col-d\{grid-column:2;\}/.test(b));
    assert(/> \.ap-salut\{grid-column:1 \/ -1;/.test(b));
  },
  'le bouton principal (renfort compris) est rangé dans la colonne gauche, sous le poste': (s) => {
    const j = wrapJs(s);
    assert(/matches\('\.ap-poste, \.ap-fil, #apBoutonPrincipal'\) \? g : d/.test(j));
    assert(/g\.className = 'ap-col ap-col-g'/.test(j) && /d\.className = 'ap-col ap-col-d'/.test(j));
    assert(/classList\.contains\('ap-salut'\)\) return/.test(j));
  },
  'hors vue bureau et mobile : l\'hôte reste un bloc, les enveloppes sont display:contents': (s) => {
    assert(/body\.accueil-piste #accueilPisteHote\{display:block;padding:0 20px 24px;\}/.test(s));
    assert(/\n  #accueilPisteHote > \.ap-col\{display:contents;\}/.test(s));
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
  ['sans nexus-desktop', 'deux colonnes seulement en vue bureau activée (nexus-desktop)', (s) => s.replace('body.accueil-piste.nexus-desktop #accueilPisteHote > .ap-col-g{', 'body.accueil-piste #accueilPisteHote > .ap-col-g{')],
  ['grille 1/1', 'grille 7/5, écart 16 px, largeur 1040 px centrée', (s) => s.replace('minmax(0,7fr) minmax(0,5fr)', 'minmax(0,1fr) minmax(0,1fr)')],
  ['rangées étirées (sans align-content:start)', 'rangées non étirées : align-content:start et align-items:start', (s) => s.replace('align-content:start;align-items:start;', 'align-items:start;')],
  ['rangées partagées (span 12)', 'rangées non étirées : align-content:start et align-items:start', (s) => s.replace('> .ap-col-g{grid-column:1;}', '> .ap-col-g{grid-column:1;grid-row:3 / span 12;}')],
  ['pile sans écart maîtrisé (gap 40)', 'chaque colonne est une pile flex dont l\'écart est ≤ 16 px', (s) => s.replace('flex-direction:column;gap:12px;', 'flex-direction:column;gap:40px;')],
  ['pile abandonnée (block)', 'chaque colonne est une pile flex dont l\'écart est ≤ 16 px', (s) => s.replace('.ap-col{display:flex;flex-direction:column;gap:12px;', '.ap-col{display:block;')],
  ['marges conservées', 'les marges des blocs sont remises à zéro dans les colonnes', (s) => s.replace('> .ap-col > *{margin:0;}', '> .ap-col > *{padding:0;}')],
  ['colonnes inversées', 'colonne gauche en 1, colonne droite en 2, salutation sur toute la largeur', (s) => s.replace('> .ap-col-g{grid-column:1;}', '> .ap-col-g{grid-column:2;}')],
  ['bouton principal à droite', 'le bouton principal (renfort compris) est rangé dans la colonne gauche, sous le poste', (s) => s.replace("'.ap-poste, .ap-fil, #apBoutonPrincipal'", "'.ap-poste, .ap-fil'")],
  ['grille partout', 'hors vue bureau et mobile : l\'hôte reste un bloc, les enveloppes sont display:contents', (s) => s.replace('body.accueil-piste #accueilPisteHote{display:block;padding:0 20px 24px;}', 'body.accueil-piste #accueilPisteHote{display:grid;padding:0 20px 24px;}')],
  ['enveloppes en boîtes partout', 'hors vue bureau et mobile : l\'hôte reste un bloc, les enveloppes sont display:contents', (s) => s.replace('#accueilPisteHote > .ap-col{display:contents;}', '#accueilPisteHote > .ap-col{display:block;}')],
  ['hauteur imposée', 'cibles 44 px et focus : le bloc ne touche ni hauteur, ni outline', (s) => s.replace('align-items:start;max-width', 'align-items:start;min-height:0;max-width')],
  ['masquage', 'ni masquage ni flash : aucun display:none dans le bloc', (s) => s.replace('> .ap-col-g{grid-column:1;}', '> .ap-col-g{display:none;grid-column:1;}')],
];
MUT.forEach(([nom, g, f]) => {
  const m = f(app); assert.notStrictEqual(m, app, 'mutation sans effet : ' + nom);
  let rouge = false; try { garde[g](m); } catch (e) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
});
console.log('Lot 3 bureau : gardes et mutations OK');
