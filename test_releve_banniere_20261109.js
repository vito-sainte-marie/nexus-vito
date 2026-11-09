// Bannière « Relevé du jour » (Guardian 6730210604, 09/11/2026) et pastille « ☰ Menu » opaque de Verify (Guardian 6738993264).
// L'initialisation est EXÉCUTÉE (un const global n'est pas sur window). Tolère l'épinglage ?v= posé par build.sh.
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
const HTML = lire('NEXUS-Carburants-v1.html');
const VERIFY = lire('NEXUS-Verify-v1.html');
const BAN = lire('nexus-banniere-station.js');
function extraireInit(src) {
  const i = src.indexOf('(function initialiserBanniereReleve() {');
  const j = src.indexOf('})();', i);
  assert.ok(i >= 0 && j > i, 'bloc initialiserBanniereReleve introuvable');
  return src.slice(i, j + 5);
}
function executer(src, siteId, search) {
  const posé = [];
  const haut = { insertAdjacentHTML: (pos, h) => posé.push(h) };
  const sandbox = {
    console, URLSearchParams,
    MutationObserver: function () { this.observe = () => {}; },
    Image: function () {},
    SITE_ID: siteId,
    document: {
      documentElement: { getAttribute: () => 'sombre' },
      getElementById: () => null,
      querySelector: sel => (sel === '.header' ? haut : null),
      querySelectorAll: () => [],
    },
  };
  sandbox.window = sandbox;
  sandbox.window.location = { search };
  vm.createContext(sandbox);
  vm.runInContext(BAN, sandbox);
  vm.runInContext(extraireInit(src), sandbox);
  return posé.join('');
}
const gabarit = h => /<div class="am-banniere"[^>]*><img /.test(h);
const module_ = c => /<script src="nexus-banniere-station\.js[^"]*"><\/script>/.test(c);
const photo = c => /\.header\{--banniere-cadrage:50% 45%\}/.test(c) && !/\.am-banniere\{/.test(c);
const photoModule = c => /\.header>\.am-banniere\{position:absolute;inset:0;z-index:0;overflow:hidden;/.test(c);
const pastille = c => /'\.header>\.menu-btn\{[^}]*z-index:5;[^}]*background:var\(--panel\)/.test(c);
const menuMarque = c => /<div class="header">\s*<a href="NEXUS-App-v1\.html" class="menu-btn">☰ Menu<\/a>/.test(c);
const photoSousMenu = c => /\.header>\.menu-btn\{[^}]*z-index:5;/.test(c) && /\.header>\.am-banniere\{position:absolute;inset:0;z-index:0;/.test(c);

t('Sainte-Marie : la bannière est posée', () => { assert.ok(gabarit(executer(HTML, 'vito-sainte-marie', ''))); });
t('Test avec ?apercu_banniere=1 : la bannière est posée', () => { assert.ok(gabarit(executer(HTML, 'nexus-station-test', '?apercu_banniere=1'))); });
t('Test sans aperçu : pas de bannière', () => { assert.strictEqual(executer(HTML, 'nexus-station-test', ''), ''); });
t('autre site, même avec l\'aperçu : pas de bannière', () => { assert.strictEqual(executer(HTML, 'autre-station', '?apercu_banniere=1'), ''); });
t('la photo est celle des relevés d\'index, la même pour Jour et Nuit', () => {
  const h = executer(HTML, 'vito-sainte-marie', '');
  assert.ok(h.includes('data-photo-jour="assets/pompiste/releve-index-1200.webp"'), h);
  assert.ok(h.includes('data-photo-nuit="assets/pompiste/releve-index-1200.webp"'), h);
  assert.ok(h.includes('releve-index-800.webp 800w') && h.includes('releve-index-1600.webp 1600w'));
});
t('les trois images existent', () => { [800, 1200, 1600].forEach(w => assert.ok(fs.existsSync(path.join(__dirname, 'assets/pompiste/releve-index-' + w + '.webp')), w)); });
t('le module partagé est chargé avant le script de la page', () => {
  assert.ok(module_(HTML));
  assert.ok(HTML.search(/<script src="nexus-banniere-station\.js/) < HTML.indexOf('<script>', HTML.indexOf('nexus-banniere-station.js')));
});
t('photo en fond de l\u2019en-tête (modèle commun), Menu posé dessus, lien vers Carburants Performance conservé', () => {
  assert.ok(photo(HTML)); assert.ok(photoModule(BAN)); assert.ok(photoSousMenu(BAN)); assert.ok(menuMarque(HTML));
  assert.ok(/id="lienPilotage"/.test(HTML) && /NEXUS-Carburants-Pilotage-v1\.html/.test(HTML));
});
t('mouvement réduit : plus de fondu animé', () => { assert.ok(/prefers-reduced-motion:reduce\)\{\.header>\.am-banniere img\.am-fondu\{transition:none\}/.test(BAN)); });
t('présentation seulement : l\'initialisation ne touche ni requête ni table', () => { assert.ok(!/supabase|\.from\(|fetch\(/.test(extraireInit(HTML))); });
t('pastille « Menu » opaque : une seule règle, celle du module commun', () => { assert.ok(pastille(BAN)); assert.ok(!/\.menu-btn\{/.test(HTML)); assert.ok(!/\.menu-btn\{/.test(VERIFY)); });
t('plus de fond translucide sur le bouton Menu', () => {
  assert.ok(!/\.menu-btn\{[^}]*background:rgba\(79,195,217,0\.1\)/.test(HTML));
  assert.ok(!/\.menu-btn\{[^}]*background:rgba\(79,195,217,0\.1\)/.test(VERIFY));
});

garde('mutation : remettre window. rend l\'initialisation muette', HTML, s => gabarit(executer(s, 'vito-sainte-marie', '')), "typeof NexusBanniereStation !== 'undefined'", 'window.NexusBanniereStation');
garde('mutation : sans data-photo-nuit', HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-nuit="assets/pompiste/releve-index-1200.webp"'), ' data-photo-nuit="${b}-1200.webp"', '');
garde('mutation : sans data-photo-jour', HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-jour="assets/pompiste/releve-index-1200.webp"'), ' data-photo-jour="${b}-1200.webp"', '');
garde('mutation : autre photo', HTML, s => executer(s, 'vito-sainte-marie', '').includes('releve-index-800.webp 800w'), "'assets/pompiste/releve-index'", "'assets/pompiste/jaugeage'");
garde('module partagé', HTML, module_, '<script src="nexus-banniere-station.js', '<script src="autre-module.js');
garde('cadrage de la photo', HTML, photo, '--banniere-cadrage:50% 45%', '--banniere-cadrage:0% 0%');
garde('photo en fond de l\u2019en-tête', BAN, photoModule, '.header>.am-banniere{position:absolute;inset:0;z-index:0;', '.header>.am-banniere{position:relative;z-index:0;');
garde('pastille opaque (module commun)', BAN, pastille, 'z-index:5;display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--cyan);background:var(--panel)', 'z-index:5;display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--cyan);background:rgba(79,195,217,0.1)');
garde('Menu en pastille de l\u2019en-tête', HTML, menuMarque, '<a href="NEXUS-App-v1.html" class="menu-btn">', '<a href="NEXUS-App-v1.html" class="menu-x">');
garde('Menu au-dessus de la photo', BAN, photoSousMenu, 'top:18px;right:18px;z-index:5;', 'top:18px;right:18px;z-index:0;');
console.log(n + ' épreuves OK');
