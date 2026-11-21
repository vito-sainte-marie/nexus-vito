// Épreuve 21/11/2026, axe Contrôler (Guardian #160 7067483165). Deux niveaux.
// (1) STRUCTURE, toujours exécutée : l'en-tête est en tête de l'axe, la grille ne confie pas la phrase du chiffre clé à une piste auto.
// (2) GÉOMÉTRIE avec Playwright, si présent : sur le banc cas_production, aucun nom d'article ne dépasse 3 lignes
// et la page ne déborde pas horizontalement à 375 px. Sans Playwright, le niveau 2 s'annonce « NON EXÉCUTÉ ».
const fs = require('fs'), path = require('path'), assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
const ok = (nom, f) => { f(); n++; };
ok('grille de ligne : 3 pistes, la phrase du chiffre clé passe sous le nom', () => {
  const css = E.CSS;
  assert(/\.pt-ctl-ligne\{grid-template-columns:40px minmax\(0,1fr\) auto;/.test(css));
  assert(/\.pt-ctl-ligne>\.pt-l-chiffre\{grid-column:2;grid-row:2;[^}]*white-space:normal/.test(css));
});
ok('rangée de pastilles : retour à la ligne, pas de défilement horizontal', () => {
  assert(!/\.pt-pastilles\{[^}]*overflow-x:auto/.test(E.CSS) && /\.pt-pastille\{white-space:normal/.test(E.CSS));
});
console.log('test_controler_mise_en_page_20261121 : ' + n + ' épreuves de structure OK');

let pw = null; try { pw = require('playwright'); } catch (e) { /* absent */ }
if (!pw) { console.log('test_controler_mise_en_page_20261121 : géométrie NON EXÉCUTÉE (Playwright absent)'); process.exit(0); }
(async () => {
  const http = require('http'), root = __dirname;
  const srv = http.createServer((q, r) => { try { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); r.end(fs.readFileSync(f)); } catch (e) { r.statusCode = 404; r.end(); } }).listen(0);
  const port = srv.address().port;
  let br; try { br = await pw.chromium.launch(); } catch (e) { srv.close(); console.log('test_controler_mise_en_page_20261121 : géométrie NON EXÉCUTÉE (Chromium absent)'); return; }
  try {
    for (const largeur of [375, 768, 1280]) for (const theme of ['jour', 'nuit']) {
      const page = await br.newPage({ viewport: { width: largeur, height: 812 } });
      await page.goto('http://localhost:' + port + '/outils/recette/ecran_scanner/banc.html?scenario=cas_production&theme=' + theme);
      const m = await page.evaluate(() => ({
        debord: document.documentElement.scrollWidth > innerWidth,
        lignes: [...document.querySelectorAll('.pt-ctl-ligne .vp-nom')].map(e => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight))),
        tete: !!document.querySelector('[data-bloc-controles] > header [data-ctl-sous]'),
      }));
      assert(!m.debord, 'débordement horizontal à ' + largeur + ' px (' + theme + ')');
      assert(m.lignes.length > 0 && m.lignes.every(l => l <= 3), 'nom d\'article sur plus de 3 lignes à ' + largeur + ' px : ' + m.lignes);
      assert(m.tete, 'en-tête de l\'axe absent');
      await page.close();
    }
    console.log('test_controler_mise_en_page_20261121 : géométrie OK (375, 768, 1280 ; Jour, Nuit)');
  } finally { await br.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
