// Rendu 375 x 812 de l'écran de saisie (WebKit si présent, sinon Chromium) : aucun débordement horizontal,
// champ date vide puis rempli, Jour et Nuit. Utilise le CSS et la fonction champDate réels de la page.
const fs = require('fs'); const assert = require('assert');
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('@playwright/test'); } catch (e2) { console.log('SKIP playwright absent'); process.exit(0); } }
const html = fs.readFileSync(`${__dirname}/NEXUS-Dates-Courtes-Releve-v1.html`, 'utf-8');
const css = html.slice(html.indexOf('<style') + html.slice(html.indexOf('<style')).indexOf('>') + 1, html.indexOf('</style>'));
const fn = /function champDate\(id,val\)\{[^\n]*\}/.exec(html)[0];
const esc = /function esc\(s\)\{[^\n]*\}/.exec(html)[0];
const themes = /<html[^>]*>/.exec(html)[0];
(async () => {
  const types = [pw.webkit, pw.chromium].filter(Boolean); let br, nom;
  for (const t of types) { try { br = await t.launch(); nom = t.name(); break; } catch (e) {} }
  if (!br) { console.log('SKIP aucun navigateur'); process.exit(0); }
  let ok = 0, ko = 0;
  for (const mode of ['jour', 'nuit']) for (const val of ['', '2026-12-05']) {
    const ctx = await br.newContext({ viewport: { width: 375, height: 812 }, colorScheme: mode === 'nuit' ? 'dark' : 'light' });
    const p = await ctx.newPage();
    await p.setContent(`<!doctype html>${themes}<head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="ecran"></main></body></html>`);
    await p.evaluate(([esc, fn, val]) => { eval(esc + ';' + fn + ';window.__c=champDate;'); document.getElementById('ecran').innerHTML = '<label class="champ">Date limite' + window.__c('champDate', val) + '</label><label class="champ">Nouvelle date limite' + window.__c('fNouv', '') + '</label>'; }, [esc, fn, val]);
    const r = await p.evaluate(() => { const w = document.documentElement.clientWidth; return { sw: document.documentElement.scrollWidth, w, droite: [...document.querySelectorAll('input[type=date]')].map(i => Math.round(i.getBoundingClientRect().right)), ph: [...document.querySelectorAll('.ph')].map(e => getComputedStyle(e).display) }; });
    try {
      assert(r.sw <= r.w, `débordement ${r.sw} > ${r.w}`); assert(r.droite.every(x => x <= r.w), 'champ au-delà du bord ' + r.droite);
      assert.strictEqual(r.ph[0], val ? 'none' : 'block');
      ok++; console.log(`  ok  ${nom} ${mode} date ${val || 'vide'}`);
    } catch (e) { ko++; console.log(`  KO  ${nom} ${mode} date ${val || 'vide'} : ${e.message}`); }
    await ctx.close();
  }
  await br.close(); console.log(`\n${ok} réussis, ${ko} échecs`); process.exit(ko ? 1 : 0);
})();
