// Icônes de « Vos raccourcis » agrandies (Guardian 6721554975, 08/11/2026).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const bloc = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j + 1, k); } }
  return '';
};
const APP = lire('NEXUS-App-v1.html');
const MOBILE = bloc(APP, '@media (max-width:599px){\n    .outil-icon{');
const hors = APP.replace(MOBILE, '');
const px = (c, re) => { const m = c.match(re); return m ? Number(m[1]) : null; };

t('bureau : icône 56 px dans une pastille de 72 px', () => {
  assert.strictEqual(px(hors, /\.outil-icon\{width:(\d+)px/), 72);
  assert.strictEqual(px(hors, /\.outil-icon\{[^}]*height:(\d+)px/), 72);
  assert.strictEqual(px(hors, /\.outil-icon img\{width:(\d+)px/), 56);
  assert.strictEqual(px(hors, /\.outil-icon img\{[^}]*height:(\d+)px/), 56);
});
t('mobile (< 600 px) : icône 48 px dans une pastille de 64 px', () => {
  assert.ok(MOBILE, 'bloc mobile introuvable');
  assert.strictEqual(px(MOBILE, /\.outil-icon\{width:(\d+)px/), 64);
  assert.strictEqual(px(MOBILE, /\.outil-icon img\{width:(\d+)px/), 48);
  assert.strictEqual(px(MOBILE, /\.outil-icon img\{[^}]*height:(\d+)px/), 48);
});
t('l\'icône reste plus grande que les pictogrammes des cartes du dessus', () => {
  const carte = px(APP, /\.intention-icon\{font-size:(\d+)px/);
  assert.ok(carte && carte < 48, 'pictogramme des cartes : ' + carte);
});
t('rayon proportionnel de la pastille', () => {
  assert.strictEqual(px(hors, /\.outil-icon\{[^}]*border-radius:(\d+)px/), 20);
  assert.strictEqual(px(MOBILE, /\.outil-icon\{[^}]*border-radius:(\d+)px/), 18);
});
t('pas de tuile dans la tuile : la pastille n\'a plus de fond propre', () => {
  assert.ok(/\.outil-icon\{[^}]*background:transparent/.test(hors));
  assert.ok(!/\.outil-icon\{[^}]*background:var\(--panel-raised\)/.test(APP));
});
t('source détaillée au-delà de 24 px : le registre est appelé à 56 px (srcset), jamais à 20', () => {
  assert.ok(APP.includes('window.NexusIcones.img(cat.module, 56, { decoratif: true, ancien })'));
  assert.ok(!/NexusIcones\.img\(cat\.module, (20|24|16)\b/.test(APP));
  const R = lire('nexus-icones.js');
  assert.ok(/SEUIL_SIMPLIFIE\s*=\s*24/.test(R));
  assert.ok(/t <= SEUIL_SIMPLIFIE\s*\?\s*\{ src: c\.simplifie \}\s*:\s*\{ src: c\.detail1x, srcset: c\.srcset \}/.test(R));
  assert.ok(/srcset: d \+ '@1x\.webp 1x, ' \+ d \+ '@2x\.webp 2x, ' \+ d \+ '@3x\.webp 3x'/.test(R));
});
t('rendu réel du registre : 56 px → @2x.webp en srcset, pas de -24.svg', () => {
  const g = {}; new Function('window', 'self', 'globalThis', lire('nexus-icones.js'))(g, g, g);
  const NI = g.NexusIcones || globalThis.NexusIcones;
  assert.ok(NI, "registre non chargé");
  const h = NI.img('mod-verify', 56, { decoratif: true });
  assert.ok(/srcset="[^"]*@2x\.webp 2x[^"]*@3x\.webp 3x"/.test(h), h);
  assert.ok(!/-24\.svg/.test(h), h);
  assert.ok(/width="56"/.test(h));
});
t('repli emoji proportionné (plus de 18 px en dur)', () => {
  assert.ok(!/<span style="font-size:18px;">\$\{cat\.emoji/.test(APP));
  assert.ok(/\.outil-icon > span\{font-size:40px/.test(hors));
  assert.ok(/\.outil-icon > span\{font-size:34px/.test(MOBILE));
});
t('effet #229 inchangé : survol et focus ×1.08, transition 160 ms', () => {
  assert.ok(APP.includes('.outil-card:hover .outil-icon{transform:scale(1.08);}'));
  assert.ok(APP.includes('.outil-card:focus-visible .outil-icon{transform:scale(1.08);}'));
  assert.ok(APP.includes('.intention-icon, .outil-icon{transition:transform 160ms ease-out;}'));
});
t('alignement : la pastille garde sa marge basse et le centrage', () => {
  assert.ok(/\.outil-icon\{[^}]*display:flex; align-items:center; justify-content:center; margin-bottom:10px/.test(hors));
});

garde('bureau : icône à 56 px', hors, c => px(c, /\.outil-icon img\{width:(\d+)px/) === 56, '.outil-icon img{width:56px; height:56px;', '.outil-icon img{width:20px; height:20px;');
garde('bureau : pastille à 72 px', hors, c => px(c, /\.outil-icon\{width:(\d+)px/) === 72, '.outil-icon{width:72px; height:72px;', '.outil-icon{width:36px; height:36px;');
garde('mobile : icône à 48 px', MOBILE, c => px(c, /\.outil-icon img\{width:(\d+)px/) === 48, '.outil-icon img{width:48px; height:48px;', '.outil-icon img{width:56px; height:56px;');
garde('mobile : pastille à 64 px', MOBILE, c => px(c, /\.outil-icon\{width:(\d+)px/) === 64, '.outil-icon{width:64px; height:64px;', '.outil-icon{width:72px; height:72px;');
garde('seuil mobile à 600 px', APP, c => c.includes('@media (max-width:599px){\n    .outil-icon{'), '@media (max-width:599px){\n    .outil-icon{', '@media (max-width:899px){\n    .outil-icon{');
garde('fond de pastille retiré', hors, c => /\.outil-icon\{[^}]*background:transparent/.test(c), 'background:transparent', 'background:var(--panel-raised)');
garde('source détaillée : appel à 56 px', APP, c => c.includes('NexusIcones.img(cat.module, 56,') && !/NexusIcones\.img\(cat\.module, 2\d,/.test(c), 'img(cat.module, 56,', 'img(cat.module, 20,');
garde('seuil du registre à 24 px', lire('nexus-icones.js'), c => /SEUIL_SIMPLIFIE\s*=\s*24/.test(c) && /t <= SEUIL_SIMPLIFIE/.test(c), 't <= SEUIL_SIMPLIFIE', 't <= 96');
garde('survol ×1.08 conservé', APP, c => c.includes('.outil-card:hover .outil-icon{transform:scale(1.08);}'), '.outil-card:hover .outil-icon{transform:scale(1.08);}', '.outil-card:hover .outil-icon{transform:scale(1);}');
garde('emoji de repli proportionné', hors, c => /\.outil-icon > span\{font-size:40px/.test(c), '.outil-icon > span{font-size:40px', '.outil-icon > span{font-size:18px');

console.log(n + ' épreuves OK');
