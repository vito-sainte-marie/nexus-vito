// Test — accueil V1.1 (04/11/2026) : survol/focus des cartes de service, point vert,
// grille de la prise de poste en vue bureau (CSS seul), Auto = Jour 6 h–18 h.
// SRC_MUTE_HTML / SRC_MUTE_PDP / SRC_MUTE_THEME : sources mutées pour la preuve de mutation.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const lire = (env, f) => fs.readFileSync(process.env[env] || path.join(__dirname, f), 'utf8');
const HTML = lire('SRC_MUTE_HTML', 'NEXUS-App-v1.html');
const PDP = lire('SRC_MUTE_PDP', 'nexus-prise-de-poste.js');
const THEME = lire('SRC_MUTE_THEME', 'nexus-theme.js');

let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }
const regles = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), corps: m[2] }));

cas('survol (dans hover:hover) et focus-visible des deux cartes, jetons seuls', () => {
  const bloc = HTML.match(/@media \(hover:hover\)\{([\s\S]*?)\n  \}/);
  assert(bloc, 'bloc hover:hover absent');
  const hov = regles(bloc[1]);
  assert(hov.some(r => /\.chemins-btn-service:hover/.test(r.sel) && /\.chemins-rappel:hover/.test(r.sel) && /border-color:var\(--green\)/.test(r.corps) && /var\(--service-survol\)[\s\S]*var\(--green-dim\)/.test(r.corps) && /box-shadow/.test(r.corps) && /translateY\(-1px\)/.test(r.corps) && !/panel-raised|--cyan/.test(r.corps)));
  assert(hov.some(r => /\.chemins-rappel-lien:hover/.test(r.sel)));
  assert(/\.chemins-btn-service, \.chemins-rappel, \.chemins-rappel-lien\{cursor:pointer;\}/.test(bloc[1]));
  assert(/\.chemins-btn-service:focus-visible, \.chemins-rappel:focus-within\{border-color:var\(--green\); background:linear-gradient\(rgba\(var\(--green-rgb\),var\(--service-survol\)\)/.test(HTML));
  assert(/:root\{--service-survol:0\.12;\} \[data-theme="jour"\]\{--service-survol:0\.05;\}/.test(HTML), 'jetons de survol absents');
  assert(/@media \(prefers-reduced-motion: reduce\)\{ \.chemins-point\{animation:none;\} \}/.test(HTML), 'prefers-reduced-motion absent');
  assert(/\.chemins-rappel-lien:focus-visible\{outline:2px solid var\(--cyan\)/.test(HTML));
  for (const r of hov) assert(!/#[0-9a-fA-F]{3,6}\b/.test(r.corps), 'couleur en dur dans ' + r.sel);
});

cas('le point du rappel est un vrai point --green, hors du texte', () => {
  assert(/\.chemins-point\{[^}]*background:var\(--green\)[^}]*animation:statutPulse/.test(HTML));
  assert(!/>● Service en cours/.test(HTML), 'ancien glyphe ● resté');
  assert.strictEqual((HTML.match(/<span class=\\"chemins-point\\" aria-hidden=\\"true\\"><\/span>Service en cours/g) || []).length, 0);
  assert.strictEqual((HTML.match(/class=\\?"chemins-point\\?" aria-hidden=\\?"true\\?"/g) || []).length, 2);
});

cas('prise de poste : toute règle V1.1 est sous body.nexus-desktop', () => {
  const css = PDP.match(/const CSS = `([\s\S]*?)`;/)[1];
  const apresV11 = css.slice(css.indexOf('/* V1.1')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rs = regles(apresV11);
  assert(rs.length >= 6);
  for (const r of rs) assert(/^body\.nexus-desktop /.test(r.sel), 'hors body.nexus-desktop : ' + r.sel);
  assert(rs.some(r => /\.pdp-cartes$/.test(r.sel) && /display:grid/.test(r.corps)));
  assert(rs.some(r => /\.pdp-carte$/.test(r.sel) && /aspect-ratio:3\/4/.test(r.corps)));
  assert(!/@media/.test(apresV11));
  assert(rs.some(r => /\.desktop-grid > \.pdp$/.test(r.sel) && /column-span:all/.test(r.corps)), 'column-span:all absent');
  assert(rs.some(r => /\.desktop-grid:has\(> \.pdp\)$/.test(r.sel) && /column-count:1/.test(r.corps)), 'column-count:1 absent');
  const avant = css.slice(0, css.indexOf('/* V1.1'));
  assert(!/aspect-ratio|display:grid/.test(avant), 'règle de grille hors bureau');
});

cas('prise de poste : cartes, ordre et gestionnaires inchangés', () => {
  assert(/rolesDisponibles\(\)\.map\(r => `/.test(PDP));
  assert(/querySelectorAll\('\.pdp-carte'\)\.forEach\(el => \{\s*el\.addEventListener\('click', \(\) => confirmerPriseDePoste\(el\.dataset\.role, el\)\);/.test(PDP));
  assert(/<button type="button" class="pdp-carte" data-role="\$\{r\.value\}">/.test(PDP));
});

cas('Auto : Jour de 6 h à 18 h (fuseau de la station) et la prise de poste le pose', () => {
  assert(/NexusTheme\.definirFuseau\(FUSEAU_STATION_PDP\)/.test(PDP));
  const sandbox = { Intl, Date, setInterval: () => 0, self: null, module: { exports: {} },
    document: { head: { appendChild() {} }, documentElement: { setAttribute() {}, getAttribute() {} }, createElement: () => ({}), querySelector: () => ({ setAttribute() {} }), addEventListener() {} } };
  sandbox.self = sandbox;
  vm.createContext(sandbox); vm.runInContext(THEME, sandbox);
  const api = sandbox.module.exports;
  const h = (iso) => api.heureDansFuseau('Europe/Paris', new Date(iso));
  const t = (iso) => api.calculerTheme('auto', h(iso));
  assert.strictEqual(t('2026-11-04T07:26:00Z'), 'jour');   // 08:26 Paris
  assert.strictEqual(t('2026-11-04T04:59:00Z'), 'sombre'); // 05:59 Paris
  assert.strictEqual(t('2026-11-04T05:00:00Z'), 'jour');   // 06:00 Paris
  assert.strictEqual(t('2026-11-04T16:59:00Z'), 'jour');   // 17:59 Paris
  assert.strictEqual(t('2026-11-04T17:00:00Z'), 'sombre'); // 18:00 Paris
});

// Mesure rendue : un CSS lu ne prouve pas la largeur (défaut de 1d7c95ab : .pdp coincée dans
// la demi-colonne de .desktop-grid). Nécessite Playwright ; sans lui, le contrôle est SAUTÉ
// et le dit (le CI n'embarque pas encore Playwright : PR séparée prévue).
let pw = null;
try { pw = require('playwright'); } catch (e) { /* absent */ }
if (!pw) {
  console.log('  - largeur rendue de .pdp : SAUTÉ (playwright absent)');
  console.log(`${ok} contrôles OK, 1 sauté`);
} else {
  (async () => {
    const dsk = lire('SRC_MUTE_DESKTOP', 'nexus-desktop.js').match(/NEXUS_DESKTOP_CSS = `([\s\S]*?)`;/)[1];
    const pdp = PDP.match(/const CSS = `([\s\S]*?)`;/)[1];
    const page = `<!doctype html><html><head><style>:root{--panel:#fff;--panel-rgb:255,255,255}body{margin:0}</style><style>${dsk}</style><style>${pdp}</style></head>
<body class="nexus-desktop"><div class="phone"><div class="section desktop-grid"><div class="pdp"><h1 class="pdp-titre">Titre</h1><p class="pdp-sous">Sous</p>
<div class="pdp-cartes">${['a','b','c','d'].map(r => `<button class="pdp-carte"><span class="pdp-visuel"></span><span class="pdp-corps">${r}</span></button>`).join('')}</div></div></div></div></body></html>`;
    const exe = process.env.CHR || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const b = await pw.chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
    const pg = await b.newPage({ viewport: { width: 1440, height: 720 } });
    await pg.setContent(page);
    const m = await pg.evaluate(() => {
      const r = document.querySelector('.pdp').getBoundingClientRect();
      const tops = [...document.querySelectorAll('.pdp-carte')].map(c => Math.round(c.getBoundingClientRect().top));
      return { largeur: r.width, gauche: r.left, droite: innerWidth - r.right, tops };
    });
    await b.close();
    assert(m.largeur > 900, 'largeur rendue de .pdp = ' + m.largeur);
    assert(Math.abs(m.gauche - m.droite) < 2, 'non centrée : ' + m.gauche + ' / ' + m.droite);
    assert.strictEqual(new Set(m.tops).size, 1, 'les 4 cartes ne tiennent pas sur une ligne : ' + m.tops);
    console.log('  ✓ largeur rendue de .pdp > 900 px, centrée, 4 cartes sur une ligne (' + Math.round(m.largeur) + ' px)');
    console.log(`${ok + 1} contrôles OK`);
  })().catch(e => { console.error(e); process.exit(1); });
}
