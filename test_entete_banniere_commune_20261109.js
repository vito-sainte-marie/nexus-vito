// Guardian 6739596255 (09/11/2026) : cohérence graphique des 5 bannières d'en-tête, référence Contrôle inventaire.
// Les règles vivent une fois dans nexus-banniere-station.js (CSS_ENTETE) ; chaque page ne règle que son cadrage.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const BAN = lire('nexus-banniere-station.js');
const PAGES = {
  'NEXUS-Inventaire-Manager-v1.html': 'inventaire',
  'NEXUS-Carburants-v1.html': 'releve',
  'NEXUS-Verify-v1.html': 'verify',
  'NEXUS-Carburants-Pilotage-v1.html': 'performance',
  'NEXUS-Paye-v1.html': 'paye'
};
const src = {}; Object.keys(PAGES).forEach(p => { src[p] = lire(p); });

const regleModule = c => /CSS_ENTETE/.test(c) && /\.header>\.am-banniere\{position:absolute;inset:0/.test(c) && /\.header>\.am-banniere::after\{content:\"\";position:absolute;inset:0;background:linear-gradient\(to right,var\(--bg\) 0%/.test(c) && /object-position:var\(--banniere-cadrage/.test(c);
const regleMenu = c => /\.header>\.menu-btn\{position:absolute;top:18px;right:18px;z-index:5/.test(c);
const regleInjection = c => /id[=\s'"]*nexus-entete-banniere/.test(c) || /nexus-entete-banniere/.test(c);
const regleTexte = c => /\.header>\.entete-texte\{position:relative;z-index:1/.test(c);

t('le module porte les règles communes de la bannière', () => { assert.ok(regleModule(BAN)); });
t('le module porte la pastille Menu commune', () => { assert.ok(regleMenu(BAN)); });
t('le module injecte la feuille commune', () => { assert.ok(regleInjection(BAN)); });
t('le module règle le texte au-dessus de la photo', () => { assert.ok(regleTexte(BAN)); });

Object.keys(PAGES).forEach(p => {
  const H = src[p], nom = PAGES[p];
  t(nom + ' : charge le gabarit commun avant le premier script inline', () => {
    const m = /<script[^>]*src="nexus-banniere-station\.js(?:\?[^"]*)?"[^>]*>\s*<\/script>/.exec(H);
    assert.ok(m, 'balise nexus-banniere-station.js absente');
    const inline = /<script(?![^>]*\bsrc=)[^>]*>/.exec(H);
    assert.ok(!inline || m.index < inline.index, 'balise après le premier script inline');
  });
  t(nom + ' : plus de règle locale de bannière, de pastille ou de fondu', () => {
    assert.ok(!/\.am-banniere\s*\{/.test(H), '.am-banniere local');
    assert.ok(!/\.hero-haut|\.menu-pastille|\.am-fondu/.test(H.replace(/<script[\s\S]*?<\/script>/g, s => s.includes('classList') ? '' : s).split('</style>')[0]), 'règle locale résiduelle');
  });
  t(nom + ' : ne règle que son cadrage', () => { assert.ok(/\.header\{--banniere-cadrage:\d+% \d+%;?\}/.test(H)); });
  t(nom + ' : en-tête = pastille Menu puis bloc texte', () => {
    assert.ok(/<(?:header|div) class="header[^"]*"[^>]*>\s*<a (?:class="menu-btn" href="NEXUS-App-v1\.html"|href="NEXUS-App-v1\.html" class="menu-btn")>☰ Menu<\/a>[\s\S]{0,400}?<div class="entete-texte">/.test(H));
  });
});

const regleHauteur = c => /body\.nexus-desktop \.header\{min-height:220px\}/.test(c);
t('le module fixe une hauteur minimale bureau commune de 220 px', () => { assert.ok(regleHauteur(BAN)); });
Object.keys(PAGES).forEach(p => {
  t(PAGES[p] + ' : .header sans bordure, rayon ni fond de carte', () => {
    const css = src[p].split('</style>').slice(0, -1).join('</style>').replace(/\/\*[\s\S]*?\*\//g, '');
    const blocs = css.match(/(?:^|[},\n])\s*(?:\.header(?:\.hero)?)\s*\{[^}]*\}/g) || [];
    blocs.forEach(b => { assert.ok(!/border(?:-radius)?\s*:\s*(?!0)/.test(b) && !/background\s*:\s*(?!none)/.test(b), 'carte résiduelle : ' + b.trim()); });
  });
});
t('Paye : en-tête à plat (bordure, rayon et fond de la carte .hero neutralisés)', () => {
  assert.ok(/\.header\.hero\{[^}]*background:none;border:0;border-radius:0/.test(src['NEXUS-Paye-v1.html']));
});
t('Paye : actions bornées au bloc texte en bureau, pleine largeur en mobile', () => {
  assert.ok(/\.hero>\.topacts\{max-width:600px\}/.test(src['NEXUS-Paye-v1.html']));
  assert.ok(/\.hero>\.topacts\{max-width:none;position:fixed/.test(src['NEXUS-Paye-v1.html']));
});
garde('module : hauteur minimale bureau', BAN, regleHauteur, 'body.nexus-desktop .header{min-height:220px}', 'body.nexus-desktop .header{min-height:150px}');
garde('Paye : plus de carte', src['NEXUS-Paye-v1.html'], c => /\.header\.hero\{[^}]*background:none;border:0;border-radius:0/.test(c), 'background:none;border:0;border-radius:0', 'background:none;border:1px solid var(--line);border-radius:13px');

garde('module : bannière absolue pleine largeur', BAN, regleModule, '.header>.am-banniere{position:absolute;inset:0', '.header>.am-banniere{position:relative;inset:0');
garde('module : dégradé qui laisse lire le titre', BAN, regleModule, 'inset:0;background:linear-gradient(to right,var(--bg) 0%', 'inset:0;background:linear-gradient(to left,var(--bg) 0%');
garde('module : cadrage lu dans la variable de page', BAN, regleModule, 'object-position:var(--banniere-cadrage', 'object-position:center var(--banniere-cadrage');
garde('module : pastille Menu en haut à droite, au-dessus', BAN, regleMenu, 'top:18px;right:18px;z-index:5', 'top:18px;right:18px;z-index:0');
garde('module : texte au-dessus de la photo', BAN, regleTexte, '.header>.entete-texte{position:relative;z-index:1', '.header>.entete-texte{position:relative;z-index:0');
garde('page Verify : cadrage propre', src['NEXUS-Verify-v1.html'], c => /\.header\{--banniere-cadrage:\d+% \d+%;?\}/.test(c), '--banniere-cadrage:', '--cadrage-x:');
garde('page Paye : bloc texte', src['NEXUS-Paye-v1.html'], c => /<div class="entete-texte">/.test(c), '<div class="entete-texte">', '<div class="texte">');
console.log(n + ' épreuves OK');
