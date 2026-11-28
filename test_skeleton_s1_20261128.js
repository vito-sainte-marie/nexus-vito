'use strict';
// Lot S1 : composant NEXUS Skeleton (contrat, délais, règles) et page pilote Produits.
const fs = require('fs'), assert = require('assert');
const lire = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
let ok = 0;
function t(nom, fn) { try { fn(); ok++; console.log('ok  ' + nom); } catch (e) { console.error('KO  ' + nom + ' : ' + e.message); process.exitCode = 1; } }

const SK = require('./nexus-skeleton.js');
const css = lire('nexus-skeleton.css'), html = lire('NEXUS-Produits-v1.html'), ecran = lire('nexus-politique-tarifaire-ecran.js');

t('contrat : sept états', () => assert.deepStrictEqual(SK.ETATS, ['wait', 'loading', 'ready', 'refresh', 'error', 'empty', 'unavailable']));
t('délais : 300 / 600 / 5000', () => assert.deepStrictEqual(SK.T, { APPEAR: 300, MIN: 600, LONG: 5000 }));
t('contrat CSS : data-k couvre txt, num, para, chart, line, ico, img, block', () => {
  ['txt', 'num', 'para', 'chart', 'line', 'ico', 'img', 'block'].forEach(k => assert(css.includes('data-k=' + k), k));
});
t('CSS : aucune couleur en dur hors repli var()', () => {
  const sans = css.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
  assert.deepStrictEqual(sans.match(/#[0-9a-fA-F]{3,8}\b/g), null);
});
t('CSS : mouvement réduit respecté', () => assert(/prefers-reduced-motion:reduce/.test(css) && /animation:none!important/.test(css)));
t('CSS : animations sur opacity et transform seulement', () => {
  const kf = css.match(/@keyframes[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g).filter(b => !/nsk-a\b/.test(b));
  kf.forEach(b => assert(!/(width|height|top|left|margin)\s*:/.test(b.replace(/@keyframes[^{]+\{/, '')), b));
});
t('JS : aucun chiffre fictif dans les messages', () => {
  const m = lire('nexus-skeleton.js').match(/'[^']*'/g).filter(s => /textContent|[A-Za-zé]/.test(s)).filter(s => /\d/.test(s) && /[a-zé]{4}/i.test(s));
  assert.deepStrictEqual(m.filter(s => /\d+\s*(€|%|L\b)/.test(s)), []);
});
t('idiomes propres de Produits retirés', () => {
  assert(!/photo-loading|pt-objf-pulse|Chargement du scanner|\.pt-objf-squelette\{|\.pt-objf-squelette span/.test(html + ecran));
});
t('Produits charge le composant', () => assert(/nexus-skeleton\.css/.test(html) && /nexus-skeleton\.js/.test(html)));

// Comportement : délais, sans DOM (stub minimal).
function el() {
  const a = {}; return { style: {}, offsetHeight: 10, _a: a, setAttribute(k, v) { a[k] = v; }, getAttribute(k) { return a[k] === undefined ? null : a[k]; },
    querySelectorAll() { return []; }, querySelector() { return null; }, appendChild() {}, classList: { add() {}, remove() {} }, parentNode: null };
}
global.document = { body: { appendChild() {} }, createElement() { return { style: {}, className: '', setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} } }; } };
const dormir = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const e1 = el(); let t0 = Date.now(), fin = 0;
  await SK.charge(e1, () => dormir(10)).then(() => { fin = Date.now() - t0; });
  t('donnée rapide : retournée sans retard, jamais de squelette', () => { assert(fin < 150, fin + ' ms'); });
  await dormir(80);
  t('donnée rapide : état ready sans passer par loading', () => assert.strictEqual(e1.getAttribute('data-state'), 'ready'));

  const e2 = el(); t0 = Date.now(); let r2;
  const p = SK.charge(e2, () => dormir(450)).then(v => { r2 = Date.now() - t0; });
  await dormir(100); const avant = e2.getAttribute('data-state');
  await dormir(300); const apres = e2.getAttribute('data-state');
  await p;
  t('donnée lente : wait avant 300 ms, loading après', () => { assert.strictEqual(avant, 'wait'); assert.strictEqual(apres, 'loading'); });
  t('donnée lente : la promesse n\'est pas retardée par MIN', () => assert(r2 < 600, r2 + ' ms'));
  await dormir(700);
  t('donnée lente : ready après MIN', () => assert.strictEqual(e2.getAttribute('data-state'), 'ready'));
  t('aria-busy faux à la fin', () => assert.strictEqual(e2.getAttribute('aria-busy'), 'false'));

  const e3 = el(); let rejet = false;
  await SK.charge(e3, () => Promise.reject(new Error('x'))).catch(() => { rejet = true; });
  await dormir(50);
  t('erreur : relancée et état error', () => { assert(rejet); assert.strictEqual(e3.getAttribute('data-state'), 'error'); });

  const e4 = el();
  await SK.charge(e4, () => Promise.resolve([]), { estVide: r => !r.length }); await dormir(50);
  t('vide : état empty', () => assert.strictEqual(e4.getAttribute('data-state'), 'empty'));

  const e5 = el(); const st = [];
  await SK.pouls(e5, () => dormir(10)); st.push(e5.getAttribute('data-state')); await dormir(700); st.push(e5.getAttribute('data-state'));
  t('pouls : refresh puis ready', () => assert.deepStrictEqual(st, ['refresh', 'ready']));
  console.log(ok + ' vérifications'); process.exit(process.exitCode || 0);
})();
