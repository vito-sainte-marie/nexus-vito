// Test — survol/focus V1.1 des cartes de l'accueil du DIRIGEANT (page portant .am-marqueur).
// Défaut : body:has(.am-marqueur) .am-poste (0,2,1) écrasait .chemins-rappel:hover (0,2,0) et
// #cheminService n'avait aucune règle de survol. SRC_MUTE_HTML : source mutée (preuve de mutation).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const HTML = fs.readFileSync(process.env.SRC_MUTE_HTML || path.join(__dirname, 'NEXUS-App-v1.html'), 'utf8');
let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

// Spécificité (id, classe/pseudo, élément) ; :has(x) et :is(x) valent x.
function spec(sel) {
  let s = sel, a = 0, b = 0, c = 0, m;
  while ((m = s.match(/:(?:has|is)\(([^()]*)\)/))) { const t = spec(m[1]); a += t[0]; b += t[1]; c += t[2]; s = s.replace(m[0], ''); }
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+|:[\w-]+|\[[^\]]*\]/g) || []).length;
  s = s.replace(/#[\w-]+|\.[\w-]+|:[\w-]+|\[[^\]]*\]/g, ' ');
  c += (s.match(/[a-zA-Z][\w-]*/g) || []).length;
  return [a, b, c];
}
const sup = (x, y) => x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
const css = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const regles = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), corps: m[2] }));
const base = regles.find(r => r.sel === 'body:has(.am-marqueur) .am-poste');
assert(base, 'règle de base du dirigeant absente');

cas('le survol du lien « Commencer » (a.am-poste) et de la carte « Service en cours » bat la règle de base (sans !important)', () => {
  const hov = regles.filter(r => /:hover/.test(r.sel) && /am-marqueur/.test(r.sel));
  for (const cible of ['a.am-poste', '.chemins-rappel']) {
    const sels = hov.flatMap(r => r.sel.split(',').map(x => x.trim()).filter(x => x.includes(cible)).map(x => ({ x, corps: r.corps })));
    assert(sels.length, 'aucun survol pour ' + cible);
    for (const { x, corps } of sels) {
      assert(sup(spec(x), spec(base.sel)), 'spécificité insuffisante : ' + x);
      assert(/border-color:var\(--green\)/.test(corps) && /var\(--service-survol\)[\s\S]*var\(--green-dim\)/.test(corps) && /translateY\(-1px\)/.test(corps) && !/!important/.test(corps));
    }
  }
});
cas('le focus clavier des deux cartes est couvert', () => {
  const foc = regles.filter(r => /focus/.test(r.sel) && /am-marqueur/.test(r.sel));
  assert(foc.some(r => /a\.am-poste:focus-visible/.test(r.sel) && /\.chemins-rappel:focus-within/.test(r.sel) && /border-color:var\(--green\)/.test(r.corps)));
});

let pw = null;
try { pw = require('playwright'); } catch (e) { /* absent */ }
if (!pw) { console.log('  - couleur de bord rendue au survol : SAUTÉ (playwright absent)'); console.log(`${ok} contrôles OK, 1 sauté`); }
else (async () => {
  const exe = process.env.CHR || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const b = await pw.chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const pg = await b.newPage({ viewport: { width: 1440, height: 720 } });
  await pg.setContent(`<!doctype html><html data-theme="jour"><head><style>:root{--panel:#fff;--hairline:#ddd;--text:#111;--green:rgb(0,160,80);--green-rgb:0,160,80;--shadow-rgb:0,0,0;--green-dim:rgba(0,160,80,.1);--shadow-rgb:0,0,0;--r-md:12px}</style><style>${css}</style></head><body><span class="am-marqueur" hidden></span>
<a class="ap-poste am-poste" id="cheminService" href="#"><div class="ap-poste-texte"><div class="ap-poste-nom">Commencer</div></div></a>
<div class="ap-poste am-poste chemins-rappel"><div class="ap-poste-texte"><div class="ap-poste-nom">En cours</div></div></div></body></html>`);
  for (const sel of ['a.am-poste', '.chemins-rappel']) {
    const avant = await pg.$eval(sel, e => getComputedStyle(e).borderTopColor);
    await pg.mouse.move(5, 700); await pg.waitForTimeout(400); await pg.hover(sel); await pg.waitForTimeout(500);
    const apres = await pg.$eval(sel, e => getComputedStyle(e).borderTopColor);
    assert.notStrictEqual(avant, apres, sel + ' : bord inchangé au survol');
    const vert = await pg.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--green)'; document.body.append(d); return getComputedStyle(d).color; });
    assert.strictEqual(apres, vert, sel + ' : bord au survol = ' + apres);
  }
  await b.close();
  console.log('  ✓ bord --green rendu au survol des deux cartes (page .am-marqueur)');
  console.log(`${ok + 1} contrôles OK`);
})().catch(e => { console.error(e); process.exit(1); });
