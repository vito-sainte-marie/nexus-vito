// Bannière de l'en-tête Carburants (Guardian 6724691440, 08/11/2026) : l'initialisation est EXÉCUTÉE.
// Un `const` global n'est pas une propriété de window : le test `window.NexusBanniereStation` était toujours faux.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
const HTML = lire('NEXUS-Carburants-Pilotage-v1.html');
const BAN = lire('nexus-banniere-station.js');
function extraireInit(src) {
  const i = src.indexOf('(function initialiserEnteteRefonte() {');
  const j = src.indexOf('})();', i);
  assert.ok(i >= 0 && j > i, 'bloc initialiserEnteteRefonte introuvable');
  return src.slice(i, j + 5);
}
// Exécute l'initialisation dans un contexte où NexusBanniereStation est un `const` de script (comme dans le navigateur).
function executer(src, siteId, search) {
  const posé = [];
  const haut = { insertAdjacentHTML: (pos, h) => posé.push(h) };
  const sandbox = {
    console, URLSearchParams,
    MutationObserver: function () { this.observe = () => {}; },
    Image: function () {},
    todayISO: () => '2026-11-08', SITE_ID: siteId,
    document: {
      documentElement: { getAttribute: () => 'sombre' },
      getElementById: () => null,
      querySelector: sel => (sel === '#heroCarburants' ? haut : null),
      querySelectorAll: () => [],
    },
  };
  sandbox.window = sandbox;
  sandbox.window.location = { search };
  vm.createContext(sandbox);
  vm.runInContext(BAN, sandbox); // déclare `const NexusBanniereStation` : PAS une propriété de window
  assert.strictEqual(typeof sandbox.window.NexusBanniereStation, 'undefined', 'le const global n\'est pas sur window');
  vm.runInContext(extraireInit(src), sandbox);
  return posé.join('');
}
const gabarit = h => /<div class="am-banniere"[^>]*><img /.test(h);

t('Sainte-Marie : la bannière est posée (img dans .am-banniere)', () => {
  assert.ok(gabarit(executer(HTML, 'vito-sainte-marie', '')));
});
t('Test avec ?apercu_banniere=1 : la bannière est posée', () => {
  assert.ok(gabarit(executer(HTML, 'nexus-station-test', '?apercu_banniere=1')));
});
t('Test sans aperçu : pas de bannière', () => {
  assert.strictEqual(executer(HTML, 'nexus-station-test', ''), '');
});
t('autre site, même avec l\'aperçu : pas de bannière', () => {
  assert.strictEqual(executer(HTML, 'autre-station', '?apercu_banniere=1'), '');
});
t('la bannière porte l\'illustration jaugeage pour les deux thèmes (suivreTheme ne remet pas la photo d\'Accueil)', () => {
  const h = executer(HTML, 'vito-sainte-marie', '');
  assert.ok(h.includes('data-photo-jour="assets/pompiste/jaugeage-1200.webp"'), h);
  assert.ok(h.includes('data-photo-nuit="assets/pompiste/jaugeage-1200.webp"'), h);
  assert.ok(!h.includes('accueil-station'));
});
t('le test n\'utilise plus window.', () => {
  assert.ok(!/window\.NexusBanniereStation/.test(extraireInit(HTML)));
  assert.ok(/typeof NexusBanniereStation !== 'undefined'/.test(extraireInit(HTML)));
});

garde('mutation : remettre window. rend l\'initialisation muette',
  HTML, s => gabarit(executer(s, 'vito-sainte-marie', '')),
  "typeof NexusBanniereStation !== 'undefined'", 'window.NexusBanniereStation');
garde('mutation : sans data-photo-nuit, la garde rougit',
  HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-nuit="assets/pompiste/jaugeage-1200.webp"'),
  ' data-photo-nuit="${b}-1200.webp"', '');
garde('mutation : sans data-photo-jour, la garde rougit',
  HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-jour="assets/pompiste/jaugeage-1200.webp"'),
  ' data-photo-jour="${b}-1200.webp"', '');

console.log(n + ' épreuves OK');
