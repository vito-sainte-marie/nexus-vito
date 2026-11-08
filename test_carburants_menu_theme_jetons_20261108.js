// Carburants Pilotage : bouton « ☰ Menu », choix Affichage (Sombre/Jour/Auto), jetons Jour du jaune, audit des jetons (Guardian 6726565151).
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const T = require('./nexus-theme.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, lit, rempl) { t(nom, () => { assert.ok(regle(src), 'passe sur la source'); assert.ok(src.indexOf(lit) >= 0, 'littéral introuvable : ' + lit); assert.ok(!regle(src.replace(lit, rempl)), 'doit rougir une fois mutée'); }); }
const F = 'NEXUS-Carburants-Pilotage-v1.html';
const SRC = fs.readFileSync(path.join(__dirname, F), 'utf8');
const SANS_COM = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const INVARIANTS = new Set(['--safe-top', '--safe-bottom', '--mono', '--sans', '--icone-pompe', '--carb-couleur', '--surf']);
const estCouleur = v => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v);
function jetons(src, entete) {
  const out = {}; const s = SANS_COM(src);
  const re = new RegExp(entete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  for (const m of s.matchAll(re)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); if (i > 0 && d.trim().startsWith('--')) out[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }
  return out;
}
const SOMBRE = jetons(SRC, ':root');
const JOUR_PAGE = jetons(SRC, ':root[data-theme="jour"]');
const JOUR = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT, JOUR_PAGE);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

t('bouton « ☰ Menu » : lien vers l\'accueil dans .haut-page, avant l\'en-tête, 44 px', () => {
  assert.ok(/<div class="haut-page">[\s\S]*<a class="menu" href="NEXUS-App-v1\.html">☰ Menu<\/a>\s*<\/div>\s*<header class="hero"/.test(SRC));
  assert.ok(/\.haut-page \.menu\{[^}]*min-height:44px/.test(SRC));
});
t('Affichage : composant existant, rien de recodé (menuHtml + brancherMenu), état aria-expanded', () => {
  assert.ok(/id="btnAffichage"[^>]*aria-expanded="false"/.test(SRC));
  assert.ok(SRC.includes('NexusTheme.menuHtml()') && SRC.includes('NexusTheme.brancherMenu(pA)'));
  assert.ok(!/localStorage\.setItem\([^)]*theme/i.test(SRC), 'pas de stockage du thème recodé dans la page');
  assert.ok(/\.affichage-panneau \.mm-theme-btn\{[^}]*min-height:44px/.test(SRC));
});
t('le fil « NEXUS / Carburants » est conservé', () => { assert.ok(SRC.includes('<a href="NEXUS-App-v1.html" class="menu-btn-fil">NEXUS</a> / Carburants')); });
t('Jour : --yellow lisible (≥ 4,5:1) sur --yellow-dim', () => {
  assert.ok(JOUR_PAGE['--yellow'] && JOUR_PAGE['--yellow-dim']);
  assert.ok(ratio(JOUR_PAGE['--yellow'], JOUR_PAGE['--yellow-dim']) >= 4.5, String(ratio(JOUR_PAGE['--yellow'], JOUR_PAGE['--yellow-dim'])));
});
t('audit : tout jeton couleur Sombre a une valeur Jour (page ∪ JOUR ∪ JOUR_COMPLEMENT)', () => {
  const manques = Object.keys(SOMBRE).filter(k => !INVARIANTS.has(k) && estCouleur(SOMBRE[k]) && !(k in JOUR));
  assert.deepStrictEqual(manques, []);
});
t('audit : tout var(--x) sans repli est défini (Sombre ou invariant documenté)', () => {
  const s = SANS_COM(SRC); const inconnus = new Set();
  for (const m of s.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) if (!(m[1] in SOMBRE) && !(m[1] in JOUR) && !INVARIANTS.has(m[1])) inconnus.add(m[1]);
  assert.deepStrictEqual([...inconnus], []);
});
t('identifiants et libellés métier inchangés (présentation seule)', () => {
  assert.ok(SRC.includes("a_anticiper: { icone: '🟡', libelle: 'À surveiller'"));
  assert.ok(SRC.includes('id="heroCarburants"') && SRC.includes('id="btnInfoPage"'));
});

garde('bouton Menu : lien vers l\'accueil', SRC, c => /<a class="menu" href="NEXUS-App-v1\.html">☰ Menu<\/a>/.test(c), '<a class="menu" href="NEXUS-App-v1.html">☰ Menu</a>', '<a class="menu" href="#">☰ Menu</a>');
garde('bouton Menu : 44 px', SRC, c => /\.haut-page \.menu\{[^}]*min-height:44px/.test(c), 'min-height:44px; padding:0 12px', 'min-height:30px; padding:0 12px');
garde('Affichage branché sur le composant', SRC, c => c.includes('NexusTheme.brancherMenu(pA)'), 'NexusTheme.brancherMenu(pA)', 'x(pA)');
t('garde mutée : sans --yellow Jour, l\'audit rougit', () => {
  const S2 = Object.assign({}, JOUR_PAGE); delete S2['--yellow'];
  const J2 = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT, S2);
  assert.ok(Object.keys(SOMBRE).some(k => !INVARIANTS.has(k) && estCouleur(SOMBRE[k]) && !(k in J2)));
});
console.log(n + ' épreuves OK');
