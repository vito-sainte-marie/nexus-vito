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
const photo = c => /\.header>\.am-banniere\{position:relative; aspect-ratio:3\/1; margin:-24px -20px 12px;/.test(c);
const pastille = c => /\.menu-btn\{[^}]*background:#0F2F38;[^}]*z-index:5;/.test(c);
const photoSousMenu = c => /\.menu-btn\{[^}]*z-index:5;/.test(c) && /\.header>\.am-banniere\{[^}]*pointer-events:none/.test(c);

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
t('photo pleine largeur en haut, Menu posé dessus, lien vers Carburants Performance conservé', () => {
  assert.ok(photo(HTML)); assert.ok(photoSousMenu(HTML));
  assert.ok(/id="lienPilotage"/.test(HTML) && /NEXUS-Carburants-Pilotage-v1\.html/.test(HTML));
});
t('mouvement réduit : plus de fondu animé', () => { assert.ok(/prefers-reduced-motion:reduce\)\{\.header>\.am-banniere img\.am-fondu\{transition:none;\}/.test(HTML)); });
t('présentation seulement : l\'initialisation ne touche ni requête ni table', () => { assert.ok(!/supabase|\.from\(|fetch\(/.test(extraireInit(HTML))); });
t('pastille « Menu » opaque sur Relevé du jour et sur Verify', () => { assert.ok(pastille(HTML)); assert.ok(pastille(VERIFY)); });
t('plus de fond translucide sur le bouton Menu', () => {
  assert.ok(!/\.menu-btn\{[^}]*background:rgba\(79,195,217,0\.1\)/.test(HTML));
  assert.ok(!/\.menu-btn\{[^}]*background:rgba\(79,195,217,0\.1\)/.test(VERIFY));
});

garde('mutation : remettre window. rend l\'initialisation muette', HTML, s => gabarit(executer(s, 'vito-sainte-marie', '')), "typeof NexusBanniereStation !== 'undefined'", 'window.NexusBanniereStation');
garde('mutation : sans data-photo-nuit', HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-nuit="assets/pompiste/releve-index-1200.webp"'), ' data-photo-nuit="${b}-1200.webp"', '');
garde('mutation : sans data-photo-jour', HTML, s => executer(s, 'vito-sainte-marie', '').includes('data-photo-jour="assets/pompiste/releve-index-1200.webp"'), ' data-photo-jour="${b}-1200.webp"', '');
garde('mutation : autre photo', HTML, s => executer(s, 'vito-sainte-marie', '').includes('releve-index-800.webp 800w'), "'assets/pompiste/releve-index'", "'assets/pompiste/jaugeage'");
garde('module partagé', HTML, module_, '<script src="nexus-banniere-station.js', '<script src="autre-module.js');
garde('cadrage de la photo', HTML, photo, 'aspect-ratio:3/1; margin:-24px -20px 12px;', 'aspect-ratio:3/1; margin:0;');
garde('pastille opaque Relevé du jour', HTML, pastille, 'background:#0F2F38;', 'background:rgba(79,195,217,0.1);');
garde('pastille opaque Verify', VERIFY, pastille, 'background:#0F2F38;', 'background:rgba(79,195,217,0.1);');
garde('Menu au-dessus de la photo', HTML, photoSousMenu, 'z-index:5;\n  }', 'z-index:0;\n  }');
console.log(n + ' épreuves OK');
