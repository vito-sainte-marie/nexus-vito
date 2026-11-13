// Tempo V2 — interaction des cartes Analyses (visuel seul) et ligne neutre des découvertes vides.
const assert = require('assert'), fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
let echecs = 0;
function t(n, fn) { try { fn(); console.log('  ok   ' + n); } catch (e) { echecs++; console.log('  FAIL ' + n + '\n       ' + e.message); } }
const css = html.match(/<style[\s\S]*?<\/style>/)[0];
const tuiles = html.slice(html.indexOf('id="analyses"'), html.indexOf('id="flecheAnalyses"'));

t('cinq tuiles disponibles : Quarts, Jours, Mois, Vacances, Piste et boutique', () => {
  assert.strictEqual((tuiles.match(/class="tuile[^"]*disponible/g) || []).length, 5);
  const liens = [...tuiles.matchAll(/<a\s[^>]*>/gi)].map(m => m[0]);
  assert.strictEqual(liens.length, 5);
  assert.strictEqual(liens[1], '<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Jours.html">');
  assert.strictEqual(liens[2], '<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Mois.html">');
  assert.strictEqual(liens[3], '<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Vacances.html">');
  assert.strictEqual(liens[4], '<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-PisteBoutique.html">');
  assert.ok(/^<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Quarts\.html">$/.test(liens[0]));
  assert.ok(tuiles.indexOf(liens[0]) < tuiles.indexOf('Comment se situent les pompistes'));
  assert.ok(!/aria-disabled/.test(liens[0]) && !/<span class="prep">/.test(tuiles.slice(tuiles.indexOf(liens[0]), tuiles.indexOf('</a>'))));
  assert.strictEqual((tuiles.match(/<(?:div|a) class="tuile /g) || []).length, 6);
});
t('une tuile aria-disabled, sans tabindex ni href', () => {
  assert.strictEqual((tuiles.match(/<div class="tuile [^>]*aria-disabled="true"/g) || []).length, 1);
  assert.ok(!/tabindex/.test(tuiles));
  assert.strictEqual((tuiles.match(/\shref="(?!#i-)/g) || []).length, 5);
});
t('une pastille « En préparation », neutres', () => {
  assert.strictEqual((tuiles.match(/<span class="prep">En préparation<\/span>/g) || []).length, 1);
  assert.ok(/\.tuile \.prep\{[^}]*var\(--t-mid\)[^}]*var\(--t-raised\)/.test(css));
});
t('survol uniquement sur .tuile.disponible, dans @media (hover: hover) and (pointer: fine)', () => {
  const m = css.match(/@media \(hover: hover\) and \(pointer: fine\)\{([\s\S]*?)\n\}/);
  assert.ok(m, 'media absente');
  assert.ok(/translateY\(-3px\) scale\(1\.015\)/.test(m[1]));
  for (const sel of m[1].match(/[^{}]+(?=\{)/g)) assert.ok(/\.tuile\.disponible/.test(sel), sel);
  assert.ok(!/\.tuile:hover/.test(css));
  assert.ok(/\.tuile\.disponible\{[^}]*transition:transform \.2s[^}]*box-shadow[^}]*border-color/.test(css));
  assert.ok(/\.tuile\.disponible\{[^}]*cursor:pointer/.test(css));
});
t('mobile : :active seul (scale .99 + assombrissement)', () => {
  assert.ok(/\.tuile\.disponible:active\{[^}]*scale\(\.99\)[^}]*brightness/.test(css));
});
t(':focus-visible : anneau cyan 2 px, décalage 2 px', () => {
  assert.ok(/\.tuile\.disponible:focus-visible\{[^}]*outline:2px solid var\(--t-cyan\)[^}]*outline-offset:2px/.test(css));
});
t('prefers-reduced-motion : ni mouvement ni transition', () => {
  const m = css.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n\}/);
  assert.ok(m && /transition:none/.test(m[1]) && /transform:none/.test(m[1]));
});
t('flèche › sur tuile disponible seulement', () => {
  assert.ok(/\.tuile\.disponible::after\{content:"\\203A"/.test(css));
});
t('découvertes vides : une seule ligne neutre « Découvertes en préparation »', () => {
  const sec = html.slice(html.indexOf('id="decouvertes"'), html.indexOf('id="analyses"'));
  assert.strictEqual((sec.match(/class="decouvertes-attente">Découvertes en préparation</g) || []).length, 1);
  assert.strictEqual((sec.match(/class="carte decouverte vide"/g) || []).length, 4);
  assert.ok(/\.decouverte\.vide\{display:none/.test(css));
  assert.ok(/\.decouvertes:not\(:has\(\.decouverte:not\(\.vide\)\)\) \.decouvertes-attente\{display:block/.test(css));
  const ligne = css.match(/\.decouvertes-attente\{[^}]*\}/)[0];
  assert.ok(!/--c-rgb|a-piste|niveau|preuves/.test(ligne));
});
console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert'); process.exit(echecs ? 1 : 0);
