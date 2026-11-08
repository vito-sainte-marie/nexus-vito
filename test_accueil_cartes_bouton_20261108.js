// Cartes de l'accueil = boutons qu'on va presser (Guardian 6721323193, 08/11/2026).
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
const APP = fs.readFileSync(path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
const bloc = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j + 1, k); } }
  return '';
};
const debut = APP.indexOf('Cartes de l\'accueil = boutons');
const fin = APP.indexOf('Refonte du 26/07/2026', debut);
const css = APP.slice(debut, fin);
const SURVOL = css.split('@media (hover:hover){').slice(1).map(x => bloc('@media (hover:hover){' + x, '@media')).join('\n');
const REDUIT = bloc(css, '@media (prefers-reduced-motion:reduce)');
const CARTES = ['intention-card', 'outil-card', 'outil-quart-card', 'intention-demarrage'];

t('le bloc de styles existe', () => { assert.ok(debut > 0 && fin > debut); assert.ok(SURVOL && REDUIT); });
t('survol sous @media (hover:hover) : lever de 3 px, ombre, contour cyan 55 %, halo intérieur', () => {
  CARTES.forEach(c => assert.ok(SURVOL.includes('.' + c + ':hover'), c));
  assert.ok(/translateY\(-3px\)/.test(SURVOL));
  assert.ok(/box-shadow:0 10px 24px rgba\(var\(--shadow-rgb\),0\.35\), inset 0 0 0 1px/.test(SURVOL));
  assert.ok(/border-color:rgba\(var\(--cyan-rgb\),0\.55\)/.test(SURVOL));
});
t('survol : fond +4 %, icône ×1,08, titre blanc, « → » qui apparaît, flèche du bandeau glisse de 4 px', () => {
  assert.ok(/color-mix\(in srgb, var\(--text\) 4%, var\(--panel\)\)/.test(SURVOL));
  assert.ok(/scale\(1\.08\)/.test(SURVOL));
  assert.ok(/\.intention-title[^{]*\{color:var\(--titre-survol,#fff\)/.test(SURVOL));
  assert.ok(/::after\{opacity:1/.test(SURVOL));
  assert.ok(/translateX\(4px\)/.test(SURVOL));
});
t('le survol n\'existe QUE sous hover:hover (rien au toucher)', () => {
  let hors = css.replace('@media (prefers-reduced-motion:reduce){' + REDUIT + '}', '');
  for (let i = 0; i < 5; i++) { const b = bloc(hors, '@media (hover:hover)'); if (!b) break; hors = hors.replace('@media (hover:hover){' + b + '}', ''); }
  assert.ok(!/:hover/.test(hors), 'un :hover traîne : ' + hors.slice(Math.max(0,hors.search(/:hover/) - 100), hors.search(/:hover/) + 40));
});
t('transition d\'environ 160 ms, curseur pointeur', () => {
  assert.ok(/transform 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out, background-color 160ms ease-out/.test(css));
  assert.ok(/cursor:pointer/.test(css));
});
t(':active : à plat puis enfoncé, 80 ms', () => {
  CARTES.forEach(c => assert.ok(css.includes('.' + c + ':active'), c));
  assert.ok(/translateY\(0\) scale\(\.985\)/.test(css));
  assert.ok(/transition-duration:80ms/.test(css));
});
t(':focus-visible : même rendu que le survol + anneau cyan 2 px, décalage 3 px', () => {
  CARTES.forEach(c => assert.ok(css.includes('.' + c + ':focus-visible'), c));
  assert.ok(/outline:2px solid var\(--cyan\); outline-offset:3px/.test(css));
  assert.ok(/:focus-visible\{\s*transform:translateY\(-3px\)/.test(css));
});
t('mouvement réduit : aucun transform, seuls couleur/contour/ombre', () => {
  assert.ok(/transform:none/.test(REDUIT));
  assert.ok(!/translateY\(-3px\)|scale\(1\.08\)/.test(REDUIT));
});
t('thème Jour : ombre plus douce, cyan clair, titre qui ne devient pas blanc', () => {
  assert.ok(/\[data-theme="jour"\] \.intention-card:hover/.test(css));
  assert.ok(/box-shadow:0 8px 18px rgba\(var\(--shadow-rgb\),0\.14\)/.test(css));
  assert.ok(/\[data-theme="jour"\][^{]*\.intention-title\{color:var\(--text\)/.test(css) || /\.id-titre\{color:var\(--text\)/.test(css));
});
t('clavier : chaque carte est une vraie balise <a href> (modèle et gabarit JS)', () => {
  assert.strictEqual((APP.match(/<a class="intention-card" href="/g) || []).length, 6);
  assert.ok(/<a class="intention-demarrage" href="NEXUS-Brief-v1\.html"/.test(APP));
  assert.ok(/<a class="outil-card" href="\$\{href\}">/.test(APP));
  assert.ok(/<a class="outil-quart-card" href="\$\{t\.href\}">/.test(APP));
  CARTES.forEach(c => assert.ok(!new RegExp('<div[^>]*class="' + c + '"').test(APP), c + ' en <div>'));
});

garde('hover : lever de 3 px', SURVOL, c => /translateY\(-3px\)/.test(c), 'translateY(-3px)', 'translateY(0)');
garde('hover : ombre 0 10px 24px', SURVOL, c => /0 10px 24px rgba/.test(c), '0 10px 24px', '0 1px 2px');
garde('hover : contour cyan', SURVOL, c => /border-color:rgba\(var\(--cyan-rgb\),0\.55\)/.test(c), 'border-color:rgba(var(--cyan-rgb),0.55)', 'border-color:var(--hairline)');
garde('hover : icône ×1,08', SURVOL, c => /scale\(1\.08\)/.test(c), 'scale(1.08)', 'scale(1)');
garde('hover : sous hover:hover seulement', css, c => (c.match(/@media \(hover:hover\)\{/g) || []).length === 2, '@media (hover:hover){', '@media all{');
garde('active : enfoncé', css, c => /translateY\(0\) scale\(\.985\)/.test(c), 'scale(.985)', 'scale(1)');
garde('active : 80 ms', css, c => /transition-duration:80ms/.test(c), 'transition-duration:80ms', 'transition-duration:160ms');
garde('focus-visible : anneau cyan', css, c => /outline:2px solid var\(--cyan\); outline-offset:3px/.test(c), 'outline:2px solid var(--cyan); outline-offset:3px', 'outline:none');
garde('mouvement réduit : plus de transform', REDUIT, c => /transform:none/.test(c) && !/transform:inherit/.test(c), 'transform:none', 'transform:inherit');
garde('transition 160 ms', css, c => /transform 160ms ease-out/.test(c) && !/transform 0ms/.test(c), 'transform 160ms ease-out', 'transform 0ms');
garde('clavier : les raccourcis restent des <a>', APP, c => /<a class="outil-card" href=/.test(c), '<a class="outil-card" href=', '<div class="outil-card" data-href=');
garde('clavier : le bandeau reste un <a>', APP, c => /<a class="intention-demarrage" href=/.test(c), '<a class="intention-demarrage" href=', '<div class="intention-demarrage" data-href=');

console.log(n + ' épreuves OK');
