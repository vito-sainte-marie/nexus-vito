// Test — contrastes WCAG des deux palettes (lot MODE-JOUR-POMPISTE-20261102).
// Chaque paire texte / fond d'usage doit atteindre 4,5:1 (texte normal), en Sombre comme en Jour.
const assert = require('assert');
const T = require(process.env.SRC_MUTE || './nexus-theme.js');

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

// Écart connu, non corrigé par ce lot :
//  - Sombre : --text-dim (#57626F) est sous 4,5:1 en production ; le lot ne change rien en Sombre.
//  Jour : --text-dim passé de #64748B (4,39 sur --bg, 4,23 sur --panel-raised) à #56657A, proposé par Guardian
//  (#160, 6578724451) : plus aucune exception en Jour.
const EXCEPTIONS = {
  'Sombre|--text-dim|--panel': '2.80', 'Sombre|--text-dim|--bg': '3.10',
    'Sombre|--text-dim|--panel-raised': '2.58',
};

// [texte, fond] : les paires réellement utilisées par les écrans du parcours.
const PAIRES = [
  ['--text', '--bg'], ['--text', '--panel'], ['--text', '--panel-raised'],
  ['--text-mid', '--bg'], ['--text-mid', '--panel'], ['--text-mid', '--panel-raised'],
  ['--text-dim', '--panel'], ['--text-dim', '--bg'], ['--text-dim', '--panel-raised'],
  ['--cyan', '--bg'], ['--cyan', '--panel'],
  ['--on-cyan', '--cyan'],
  ['--green', '--panel'], ['--green', '--green-dim'], ['--green', '--bg'],
  ['--amber', '--panel'], ['--amber', '--amber-dim'], ['--amber', '--bg'],
  ['--red', '--panel'], ['--red', '--red-dim'], ['--red', '--bg'],
  ['--gold', '--panel'], ['--gold', '--gold-dim'],
];

let ok = 0;
const lignes = [];
for (const [nom, pal] of [['Sombre', T.SOMBRE], ['Jour', T.JOUR]]) {
  for (const [t, f] of PAIRES) {
    assert.ok(pal[t] && pal[f], `${nom} : jeton manquant (${t} / ${f})`);
    const r = ratio(pal[t], pal[f]);
    lignes.push(`${nom.padEnd(6)} ${t.padEnd(12)} ${pal[t]} / ${f.padEnd(14)} ${pal[f]}  ${r.toFixed(2)}:1`);
    const cle = `${nom}|${t}|${f}`;
    if (cle in EXCEPTIONS) {
      // Exception nommée : le rapport mesuré est épinglé, tout changement de couleur la fait rougir.
      assert.strictEqual(r.toFixed(2), EXCEPTIONS[cle], `exception ${cle} : rapport changé (${r.toFixed(2)}:1)`);
      assert.ok(r < 4.5, `exception ${cle} devenue inutile (${r.toFixed(2)}:1) : la retirer de la liste`);
    } else {
      assert.ok(r >= 4.5, `${nom} : ${t} ${pal[t]} sur ${f} ${pal[f]} = ${r.toFixed(2)}:1 < 4,5:1`);
    }
    ok++;
  }
}
// Textes sur jetons complémentaires (Jour) : zones « texte rouge / ambre / vert sur teinte pâle ».
const C = Object.assign({}, T.JOUR, T.JOUR_COMPLEMENT);
for (const [t, f] of [['--red-text', '--red-dim'], ['--amber-text', '--amber-dim'], ['--green-text', '--green-dim'],
  ['--on-green', '--green'], ['--on-red', '--red'], ['--rec-texte', '--rec-fond'], ['--rec-texte', '--rec-attendue']]) {
  const r = ratio(C[t], C[f]);
  lignes.push(`Jour   ${t.padEnd(12)} ${C[t]} / ${f.padEnd(14)} ${C[f]}  ${r.toFixed(2)}:1`);
  assert.ok(r >= 4.5, `Jour : ${t} ${C[t]} sur ${f} ${C[f]} = ${r.toFixed(2)}:1 < 4,5:1`);
  ok++;
}
if (process.env.VERBOSE) console.log(lignes.join('\n'));
console.log(`${ok} paires texte / fond contrôlées (Sombre + Jour) : toutes ≥ 4,5:1 sauf ${Object.keys(EXCEPTIONS).length} exceptions nommées et épinglées`);
