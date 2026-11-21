// Épreuve 21/11/2026, pictogrammes de cause S1 à S7 (Guardian #160 7068395828).
// (1) FICHIERS : les 7 SVG existent, en currentColor, sans fill coloré ni script.
// (2) PUCES : chaque puce S1 à S7 porte son pictogramme (aria-hidden, 18 px), « Toutes » n'en a pas, aucun autre écran n'en porte.
// (3) GÉOMÉTRIE avec Playwright si présent : aucun débordement à 375 px, Jour et Nuit.
const fs = require('fs'), path = require('path'), assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
const ok = (nom, f) => { f(); n++; };
const dir = path.join(__dirname, 'assets/icones/v2/causes');
const codes = [1, 2, 3, 4, 5, 6, 7];
ok('les 7 fichiers existent, en currentColor, sans fill coloré ni script', () => {
  for (const i of codes) {
    const f = path.join(dir, 'cause-s' + i + '.svg');
    assert(fs.existsSync(f), 'fichier absent : cause-s' + i + '.svg');
    const s = fs.readFileSync(f, 'utf8');
    assert(/stroke="currentColor"/.test(s), 'cause-s' + i + ' : pas currentColor');
    assert(!/<script/i.test(s), 'cause-s' + i + ' : script');
    const fills = [...s.matchAll(/fill="([^"]*)"/g)].map(m => m[1]);
    assert(fills.every(v => v === 'none' || v === 'currentColor'), 'cause-s' + i + ' : fill coloré ' + fills);
    assert(!/#[0-9a-f]{3,8}\b|rgb\(/i.test(s), 'cause-s' + i + ' : couleur en dur');
  }
});
const src = fs.readFileSync(path.join(__dirname, 'nexus-politique-tarifaire-ecran.js'), 'utf8');
ok('la copie en ligne reproduit le contenu de chaque fichier', () => {
  for (const i of codes) {
    const s = fs.readFileSync(path.join(dir, 'cause-s' + i + '.svg'), 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s*\n\s*/g, '');
    assert(src.includes("S" + i + ":'" + s + "'"), 'S' + i + ' : copie en ligne différente du fichier');
  }
});
ok('le pictogramme est décoratif, 18 px, hérité du texte, et propre aux puces de cause', () => {
  assert(/class="pt-picto" aria-hidden="true"/.test(src) && /width="18" height="18"/.test(src));
  assert((src.match(/pictoCause\(/g) || []).length === 2, 'pictoCause doit servir seulement dans les puces de cause');
  assert(/\.pt-pastille\[aria-pressed=true\] \.pt-picto\{color:var\(--t-accent/.test(E.CSS));
  assert(/\.pt-pastille \.pt-picto\{[^}]*color:var\(--t-mid\)/.test(E.CSS));
  assert(!/\.pt-picto\{[^}]*(red|#[0-9a-f]{3,6}|violet|purple)/i.test(E.CSS));
});
console.log('test_controler_pictogrammes_causes_20261121 : ' + n + ' épreuves de structure OK');

let pw = null; try { pw = require('playwright'); } catch (e) { /* absent */ }
if (!pw) { console.log('test_controler_pictogrammes_causes_20261121 : géométrie NON EXÉCUTÉE (Playwright absent)'); process.exit(0); }
(async () => {
  const http = require('http'), root = __dirname;
  const srv = http.createServer((q, r) => { try { r.end(fs.readFileSync(path.join(root, decodeURIComponent(q.url.split('?')[0])))); } catch (e) { r.statusCode = 404; r.end(); } }).listen(0);
  const port = srv.address().port;
  let br; try { br = await pw.chromium.launch(); } catch (e) { srv.close(); console.log('test_controler_pictogrammes_causes_20261121 : géométrie NON EXÉCUTÉE (Chromium absent)'); return; }
  try {
    for (const largeur of [375, 1280]) for (const theme of ['jour', 'nuit']) {
      const page = await br.newPage({ viewport: { width: largeur, height: 812 } });
      await page.goto('http://localhost:' + port + '/outils/recette/ecran_scanner/banc.html?scenario=cas_production&theme=' + theme);
      await page.waitForSelector('.pt-pastille', { timeout: 10000 });
      const m = await page.evaluate(() => {
        const ps = [...document.querySelectorAll('.pt-pastille[data-ctl-cause]')];
        return {
          debord: document.documentElement.scrollWidth > innerWidth,
          chips: ps.map(b => { const s = b.querySelector('svg.pt-picto'), r = s && s.getBoundingClientRect(); return { code: b.dataset.ctlCause, picto: !!s, l: r && Math.round(r.width), h: r && Math.round(r.height), aria: s && s.getAttribute('aria-hidden'), coupe: b.scrollWidth > b.clientWidth + 1 }; }),
          toutes: !!document.querySelector('.pt-pastille:not([data-ctl-cause]) svg, .pt-pastille[data-ctl-cause=""] svg'),
          ailleurs: document.querySelectorAll('svg.pt-picto').length - ps.filter(b => b.querySelector('svg.pt-picto')).length,
        };
      });
      assert(!m.debord, 'débordement horizontal à ' + largeur + ' px (' + theme + ')');
      assert(m.chips.length > 0 && m.chips.every(c => c.code === '' || (c.picto && c.l === 18 && c.h === 18 && c.aria === 'true')), 'puce sans pictogramme 18 px aria-hidden : ' + JSON.stringify(m.chips));
      assert(!m.chips.some(c => c.coupe), 'puce coupée');
      assert(!m.toutes && m.ailleurs === 0, 'pictogramme hors puces de cause');
      await page.close();
    }
    console.log('test_controler_pictogrammes_causes_20261121 : géométrie OK (375, 1280 ; Jour, Nuit)');
  } finally { await br.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
