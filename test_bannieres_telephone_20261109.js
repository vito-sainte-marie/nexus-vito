// Bannières recadrées pour téléphone (Guardian 6744785761, 09/11/2026) : source OPTIONNELLE par page.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
function t(nom, f) { f(); console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const BAN = lire('nexus-banniere-station.js');
const PAGES = [
  ['Verify', 'NEXUS-Verify-v1.html', 'verify-telephone'],
  ['FDJ Opérations', 'NEXUS-FDJ-Manager-v1.html', 'fdj-operations-telephone'],
  ['Réception carburant', 'NEXUS-Carburant-Reception-v1.html', 'reception-carburant-telephone'],
  ['Relevé du jour', 'NEXUS-Carburants-v1.html', 'releve-du-jour-telephone'],
  ['Carburants Performance', 'NEXUS-Carburants-Pilotage-v1.html', 'carburants-performance-telephone']
];
const sourcePosee = (c, nom) => new RegExp("NexusBanniereStation\\.sourceTelephone\\) NexusBanniereStation\\.sourceTelephone\\([^;]*'assets/telephone/" + nom + "\\.webp'\\)").test(c);
const memeBloc = c => /siteAvecBanniere\([^)]*apercuDemande\(\)\)\) \{[\s\S]*?sourceTelephone\([\s\S]*?suivreTheme\(\);/.test(c);
const cadrageTel = c => /\.header\{--banniere-cadrage:[^;}]+;?;?--banniere-cadrage-tel:\d+% \d+%;?\}/.test(c);

PAGES.forEach(([nom, f, img]) => {
  const H = lire(f);
  t(nom + ' : la source téléphone est présente, dans le bloc réservé aux sites autorisés', () => { assert.ok(sourcePosee(H, img)); assert.ok(memeBloc(H)); });
  t(nom + ' : l\'image téléphone existe (WebP 960x480, légère)', () => {
    const b = fs.readFileSync(path.join(__dirname, 'assets/telephone/' + img + '.webp'));
    assert.strictEqual(b.slice(0, 4).toString(), 'RIFF'); assert.strictEqual(b.slice(8, 12).toString(), 'WEBP');
    assert.ok(b.length <= 150 * 1024, String(b.length));
  });
  t(nom + ' : cadrage téléphone propre à la page, cadrage bureau inchangé', () => { assert.ok(cadrageTel(H)); assert.ok(/--banniere-cadrage:\d+% \d+%/.test(H)); });
  t(nom + ' : Sainte-Marie seulement (garde de site inchangée)', () => { assert.ok(/NexusBanniereStation\.siteAvecBanniere\([A-Za-z_]+, NexusBanniereStation\.apercuDemande\(\)\)/.test(H)); });
  garde(nom + ' : garde mutée (source retirée)', H, c => sourcePosee(c, img), "assets/telephone/" + img + ".webp", 'assets/x.webp');
});

// Module : comportement réel sur un faux DOM minimal.
function faux() {
  const attrs = {}; const img = { parentNode: null, tagName: 'IMG', attrs, setAttribute(k, v) { attrs[k] = v; } };
  const classes = new Set();
  const ban = { querySelector: () => img, classList: { add: c => classes.add(c) }, classes };
  img.parentNode = { tagName: 'DIV', insertBefore() {} };
  return { ban, img, classes };
}
const els = [];
global.document = { createElement: tag => { const e = { tagName: tag.toUpperCase(), attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(k) { this.kids.push(k); } }; els.push(e); return e; }, getElementById: () => ({}), documentElement: { getAttribute: () => 'nuit' } };
const M = require('./nexus-banniere-station.js');
t('sans source téléphone, la bannière garde son comportement (aucun changement)', () => {
  const { ban, classes } = faux(); const n0 = els.length;
  assert.strictEqual(M.sourceTelephone(ban, undefined), false); assert.strictEqual(M.sourceTelephone(ban, ''), false);
  assert.strictEqual(classes.size, 0); assert.strictEqual(els.length, n0);
});
t('avec une source, un <picture> media 599 px est posé et l\'erreur retire toute la bannière', () => {
  const { ban, img, classes } = faux();
  assert.strictEqual(M.sourceTelephone(ban, 'assets/telephone/x.webp'), true);
  const pic = els[els.length - 2], src = els[els.length - 1];
  assert.strictEqual(pic.tagName, 'PICTURE'); assert.strictEqual(src.attrs.media, '(max-width:599px)'); assert.strictEqual(src.attrs.srcset, 'assets/telephone/x.webp');
  assert.ok(/closest\('\.am-banniere'\)\.remove\(\)/.test(img.attrs.onerror)); assert.ok(classes.has('am-tel'));
});
t('le CSS téléphone ne vaut que sous 600 px et seulement avec une source (.am-tel)', () => { assert.ok(/@media \(max-width:599px\)\{\.header>\.am-banniere\.am-tel img\{object-position:var\(--banniere-cadrage-tel/.test(BAN)); });
garde('module : garde mutée (le média n\'est plus limité au téléphone)', BAN, c => /MEDIA_TELEPHONE = '\(max-width:599px\)'/.test(c), "'(max-width:599px)';", "'(min-width:0px)';");
t('la liste des sites du module n\'a pas bougé (Sainte-Marie seulement)', () => { assert.ok(/SITES_BANNIERE_VITO\s*=\s*\['vito-sainte-marie'\]/.test(BAN)); });
t('Paye et Inventaire ne sont pas concernés', () => { ['NEXUS-Paye-v1.html', 'NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'].forEach(f => assert.ok(!/sourceTelephone/.test(lire(f)), f)); });
