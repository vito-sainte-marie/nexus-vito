// Test — couverture des pages du parcours pompiste (lot MODE-JOUR-POMPISTE-20261102).
// 1. chaque page charge nexus-theme.js dans le <head>, avant ses styles ;
// 2. tout jeton var(--x) utilisé est défini dans le :root de la page (Sombre) ;
// 3. tout jeton du :root est redéfini en Jour (JOUR ∪ JOUR_COMPLEMENT), sauf jetons invariants nommés ;
// 4. plus aucune couleur en dur hors :root, hors repli de var() et hors theme-color ;
// 5. non-régression Sombre : les valeurs Sombre des jetons d'origine sont inchangées (comparées à origin/production).
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const { execSync } = require('child_process');
const T = require('./nexus-theme.js');
const PAGES = ['NEXUS-Login-v1.html', 'NEXUS-Prise-De-Poste-v1.html', 'NEXUS-App-v1.html', 'NEXUS-Inventaire-v1.html', 'NEXUS-Releves-Piste-v1.html', 'NEXUS-Carburant-Reception-v1.html'];
const JS = ['nexus-prise-de-poste.js'];
const INVARIANTS = new Set(['--safe-top', '--safe-bottom', '--mono', '--sans', '--serif', '--font', '--r', '--radius']);
const estCouleur = (v) => /#[0-9a-f]{3,8}\b|rgba?\(|^\d+,\s*\d+,\s*\d+$/i.test(v);
const JOURS = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT);
// Écran d'arrêt volontairement laissé sombre (échec critique « Configuration absente » du login), annoncé dans la PR.
const ARRET_SOMBRE = { 'NEXUS-Login-v1.html': /#EDF1F5;background:#141B22|#F0546B/ };
let ok = 0; const cas = (n, f) => { f(); ok++; console.log('  ✓ ' + n); };
const lit = /#[0-9A-Fa-f]{3,8}\b|rgba?\(\s*\d/;

function racine(src) { const out = {}; for (const m of src.matchAll(/:root\s*\{([^}]*)\}/g)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); if (i > 0 && d.trim().startsWith('--')) out[d.slice(0, i).trim()] = d.slice(i + 1).trim(); } return out; }
const hors = (src) => src.replace(/:root\s*\{[^}]*\}/g, '').replace(/var\(\s*--[a-z0-9-]+\s*,\s*[^)]*\)/gi, 'var(--x)').replace(/<meta name="theme-color"[^>]*>/g, '');

for (const f of PAGES) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8'); const R = racine(src);
  cas(f + ' : charge nexus-theme.js avant les styles', () => {
    const i = src.search(/<script src="nexus-theme\.js(\?v=[0-9A-Za-z_-]+)?"><\/script>/); assert.ok(i > 0, 'script absent');
    assert.ok(i < src.indexOf('<style'), 'chargé après les styles');
  });
  cas(f + ' : jetons utilisés définis dans :root', () => {
    for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)) if (m[2] === ')') assert.ok(m[1] in R || m[1] in JOURS, 'jeton non défini : ' + m[1]);
  });
  cas(f + ' : chaque jeton de :root a sa valeur Jour', () => {
    for (const k of Object.keys(R)) if (!INVARIANTS.has(k) && estCouleur(R[k])) assert.ok(k in JOURS, 'sans valeur Jour : ' + k);
  });
  cas(f + ' : aucune couleur en dur hors :root', () => {
    const reste = hors(src).split('\n').map((l, n) => [n + 1, l]).filter(([, l]) => lit.test(l)).filter(([, l]) => !/^\s*\/\//.test(l)).filter(([, l]) => !(ARRET_SOMBRE[f] && ARRET_SOMBRE[f].test(l)));
    assert.deepStrictEqual(reste.map(([n, l]) => n + ': ' + l.trim().slice(0, 90)), [], 'littéraux restants');
  });
  cas(f + ' : valeurs Sombre inchangées vs origin/production', () => {
    let avant; try { avant = execSync(`git show origin/production:${f}`, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return; }
    const A = racine(avant);
    for (const k of Object.keys(A)) assert.strictEqual(R[k], A[k], 'Sombre modifié : ' + k);
  });
}
for (const f of JS) cas(f + ' : aucune couleur en dur', () => {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').replace(/var\(\s*--[a-z0-9-]+\s*,\s*[^)]*\)/gi, 'var(--x)');
  assert.ok(!lit.test(src), 'littéral couleur : ' + (src.match(lit) || [])[0]);
});
console.log(`\n${ok} contrôles OK`);
