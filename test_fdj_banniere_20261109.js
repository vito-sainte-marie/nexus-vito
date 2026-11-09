// Bannière « FDJ Opérations » (Guardian 6740337699, 09/11/2026) : gabarit commun, photo fdj-operations, Sainte-Marie seulement.
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
const HTML = lire('NEXUS-FDJ-Manager-v1.html');
const BAN = lire('nexus-banniere-station.js');
function extraireInit(src) {
  const i = src.indexOf('(function initialiserBanniereFdj() {');
  const j = src.indexOf('})();', i);
  assert.ok(i >= 0 && j > i, 'bloc initialiserBanniereFdj introuvable');
  return src.slice(i, j + 5);
}
function executer(src, siteId, search) {
  const posé = [];
  const haut = { insertAdjacentHTML: (pos, h) => posé.push(h) };
  const sandbox = {
    console, URLSearchParams,
    MutationObserver: function () { this.observe = () => {}; },
    Image: function () {},
    siteId,
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
const cadrage = c => /\.header\{--banniere-cadrage:72% 50%(?:;--banniere-cadrage-tel:\d+% \d+%)?\}/.test(c);
const module_ = c => /<script src="nexus-banniere-station\.js[^"]*"><\/script>/.test(c);
const photoJN = c => { const h = executer(c, 'vito-sainte-marie', ''); return h.includes('data-photo-jour="assets/fdj/fdj-operations-1200.webp"') && h.includes('data-photo-nuit="assets/fdj/fdj-operations-1200.webp"'); };

t('Sainte-Marie : la bannière est posée', () => { assert.ok(gabarit(executer(HTML, 'vito-sainte-marie', ''))); });
t('Test avec ?apercu_banniere=1 : la bannière est posée', () => { assert.ok(gabarit(executer(HTML, 'nexus-station-test', '?apercu_banniere=1'))); });
t('Test sans aperçu : pas de bannière', () => { assert.strictEqual(executer(HTML, 'nexus-station-test', ''), ''); });
t('autre site, même avec l\'aperçu : pas de bannière', () => { assert.strictEqual(executer(HTML, 'autre-station', '?apercu_banniere=1'), ''); });
t('une seule photo pour Jour et Nuit, trois largeurs', () => { assert.ok(photoJN(HTML)); const h = executer(HTML, 'vito-sainte-marie', ''); assert.ok(h.includes('fdj-operations-800.webp 800w') && h.includes('fdj-operations-1600.webp 1600w')); });
t('les trois images existent', () => { [800, 1200, 1600].forEach(w => assert.ok(fs.existsSync(path.join(__dirname, 'assets/fdj/fdj-operations-' + w + '.webp')), w)); });
t('module partagé chargé avant le premier script inline', () => { assert.ok(module_(HTML)); assert.ok(HTML.search(/<script src="nexus-banniere-station\.js/) < HTML.search(/<script>/)); });
t('cadrage 72 % 50 %, aucune règle locale de bannière ni de pastille Menu', () => { assert.ok(cadrage(HTML)); assert.ok(!/\.am-banniere\{/.test(HTML)); assert.ok(!/\.menu-btn\{/.test(HTML)); });
t('titre et sous-titre dans le bloc texte, ids conservés', () => { assert.ok(/<div class="entete-texte">[\s\S]*id="titre"[\s\S]*id="sousTitre"[\s\S]*<\/div>\s*<\/div>\s*<div class="divider">/.test(HTML)); });
t('présentation seulement : l\'initialisation ne touche ni requête ni table', () => { assert.ok(!/supabase|\.from\(|fetch\(/.test(extraireInit(HTML))); });

garde('mutation : window. rend l\'initialisation muette', HTML, s => gabarit(executer(s, 'vito-sainte-marie', '')), "typeof NexusBanniereStation !== 'undefined'", 'window.NexusBanniereStation');
garde('mutation : autre photo', HTML, photoJN, "'assets/fdj/fdj-operations'", "'assets/fdj/autre'");
garde('mutation : sans data-photo-nuit', HTML, photoJN, ' data-photo-nuit="${b}-1200.webp"', '');
garde('cadrage de la photo', HTML, cadrage, '--banniere-cadrage:72% 50%', '--banniere-cadrage:0% 0%');
garde('module partagé', HTML, module_, '<script src="nexus-banniere-station.js', '<script src="autre-module.js');
console.log(n + ' épreuves OK');
