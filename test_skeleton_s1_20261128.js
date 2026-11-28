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
const creees = [];
function noeud(cls) { const n = { style: {}, className: cls || '', children: [], ecouteurs: {}, textContent: '', parentNode: null, isConnected: true,
  setAttribute() {}, appendChild(c) { c.parentNode = n; n.children.push(c); }, insertBefore(c) { c.parentNode = n; n.children.push(c); },
  addEventListener(k, f) { n.ecouteurs[k] = f; }, classList: { add() {}, remove() {} } }; creees.push(n); return n; }
function trouver(n, f) { if (f(n)) return n; for (const c of n.children) { const r = trouver(c, f); if (r) return r; } return null; }
function el() {
  const a = {}; const zone = { v: null };
  const e = { style: {}, offsetHeight: 10, isConnected: true, _a: a, children: [], setAttribute(k, v) { a[k] = v; }, getAttribute(k) { return a[k] === undefined ? null : a[k]; },
    querySelectorAll() { return []; }, querySelector() { return zone.v; }, appendChild(c) { zone.v = c; e.children.push(c); c.parentNode = e; }, classList: { add() {}, remove() {} }, parentNode: { insertBefore(c) { c.parentNode = e.parentNode; } } };
  return e;
}
global.document = { body: noeud(), createElement(t) { return noeud(t); } };
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

  // Corrections Guardian 7244113538 : points 3, 4, 5, 9.
  const bouton = z => trouver(z, n => n.ecouteurs && n.ecouteurs.click);
  const e6 = el(); let relances = 0;
  await SK.charge(e6, () => Promise.reject(new Error('x')), { relancer: () => { relances++; } }).catch(() => {}); await dormir(50);
  const b6 = bouton(e6.children[0]);
  t('relance : options.relancer est appelée', () => { assert(b6); b6.ecouteurs.click(); assert.strictEqual(relances, 1); });

  const e7 = el(); let lectures = 0;
  await SK.charge(e7, () => { lectures++; return Promise.reject(new Error('x')); }).catch(() => {}); await dormir(50);
  bouton(e7.children[0]).ecouteurs.click(); await dormir(50);
  t('relance par défaut : la même lecture est refaite', () => assert.strictEqual(lectures, 2));

  const e8 = el(); let l8 = 0, rej;
  await SK.charge(e8, () => { l8++; return Promise.reject(new Error('x')); }).catch(() => {}); await dormir(50);
  const b8 = bouton(e8.children[0]);
  SK.charge(e8, () => new Promise(() => {})); // une lecture est en cours
  t('relance : pas de doublon si une lecture est déjà en cours', () => { b8.ecouteurs.click(); assert.strictEqual(l8, 1); });
  e8.isConnected = false;

  t('messages neutres : aucune cause inventée', () => {
    const m = trouver(e6.children[0], n => n.textContent && /impossible|indisponible/.test(n.textContent));
    assert(m); assert(!/serveur|r[eé]seau|connexion|r[eé]essayez plus tard/i.test(JSON.stringify(creees.map(n => n.textContent))));
  });
  const e9 = el();
  await SK.charge(e9, () => Promise.reject(new Error('x')), { messages: { error: { titre: 'Texte de la page', bouton: 'Recharger' } } }).catch(() => {}); await dormir(50);
  t('messages : la page peut fournir les siens', () => assert(trouver(e9.children[0], n => n.textContent === 'Texte de la page') && trouver(e9.children[0], n => n.textContent === 'Recharger')));

  // sortie longue : une section retirée de la page ne doit ni garder ni placer la bannière
  SK.T.LONG = 60;
  const nb = creees.length;
  const eA = el(); SK.charge(eA, () => new Promise(() => {}));
  eA.isConnected = false;
  const eB = el(); await SK.charge(eB, () => dormir(5)); await dormir(150);
  t('bannière : section retirée purgée, aucune bannière', () => assert(!creees.slice(nb).some(n => n.className === 'nsk-longload')));
  const eC = el(); SK.charge(eC, () => new Promise(() => {})); await dormir(150);
  t('bannière : placée avant la section en attente', () => { const b = creees.slice(nb).find(n => n.className === 'nsk-longload'); assert(b); assert.strictEqual(b.parentNode, eC.parentNode); });
  SK.T.LONG = 5000; eC.isConnected = false;

  const lu = f => require('fs').readFileSync(f, 'utf8');
  t('première ligne des deux fichiers : pas de tiret cadratin', () => { assert(!lu('nexus-skeleton.js').split('\n')[0].includes('\u2014')); assert(!lu('nexus-skeleton.css').split('\n')[0].includes('\u2014')); });
  t('CSS : aucun repli hexadécimal', () => assert(!/#[0-9a-fA-F]{3,8}\b/.test(lu('nexus-skeleton.css'))));
  t('Produits : ?v= sur skeleton css, js et tarifaire', () => { const h = lu('NEXUS-Produits-v1.html');
    assert(/nexus-skeleton\.css\?v=\d{8}-\d{4}/.test(h)); assert(/nexus-skeleton\.js\?v=\d{8}-\d{4}/.test(h)); assert(/nexus-politique-tarifaire-ecran\.js\?v=20261128-1800/.test(h)); });
  console.log(ok + ' vérifications'); process.exit(process.exitCode || 0);
})();
