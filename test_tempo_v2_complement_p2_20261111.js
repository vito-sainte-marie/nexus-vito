// Tempo V2 — complément P2 : présentation seule (marge en euros, messages métier, périodes explicites).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const sansScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
const css = (html.match(/<style[\s\S]*?<\/style>/) || [''])[0];

t('aucun « (G » visible dans le texte rendu (balisage et JS)', () => {
  const visible = sansScripts.replace(/<style[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!/\(G\d\)/.test(visible), 'code visible dans le balisage');
  assert.ok(!/\(G\d\)/.test(scripts), 'code visible dans le JS');
});
t('codes conservés dans data-arbitrage', () => {
  for (const g of ['G1', 'G3', 'G4', 'G5']) assert.ok(html.includes('data-arbitrage="' + g + '"') || scripts.includes("'" + g + "'"), g);
});
t('valeur Boutique en euros', () => {
  assert.ok(/fmtNb\(mi\.marge\)\s*\+\s*' €'/.test(scripts));
  assert.ok(/Marge de la période d'import · /.test(scripts));
});
t('mention de période sur les trois cartes + pastille', () => {
  for (const id of ['indPiste', 'indBoutique', 'indFdj']) {
    const m = html.match(new RegExp('id="' + id + '"[\\s\\S]*?</article>'));
    assert.ok(m && /class="periode"/.test(m[0]), id);
  }
  assert.ok(/Période étudiée : du /.test(scripts));
  assert.ok(/Période différente des litres et de la FDJ/.test(scripts));
  assert.ok(/journée complète', 'journées complètes'/.test(scripts) && /' sur ' \+ total/.test(scripts));
});
t('aucun min-height étirant sur les indicateurs ; alignement en haut', () => {
  const ind = css.match(/\.indicateurs?\{[^}]*\}/g) || [];
  for (const r of ind) assert.ok(!/min-height/.test(r), r);
  assert.ok(/\.indicateurs\{[^}]*align-items:start/.test(css));
});
t('ligne factuelle des sous-cartes en texte secondaire 13 px sans', () => {
  assert.ok(/\.colonne > \.valeur\{[^}]*IBM Plex Sans|\.colonne > \.valeur\{[^}]*var\(--t-sans\)[^}]*font-size:13px[^}]*var\(--t-mid\)/.test(css));
});
t('mention « Période différente » dès que les périodes diffèrent', () => {
  assert.ok(/mi\.debut !== bornes\.debut \|\| mi\.fin !== bornes\.fin/.test(scripts));
});
console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
