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
  assert(hov.some(r => /\.chemins-btn-service:hover/.test(r.sel) && /\.chemins-rappel:hover/.test(r.sel) && /border-color:var\(--cyan\)/.test(r.corps) && /var\(--panel-raised\)/.test(r.corps) && /box-shadow/.test(r.corps)));
  assert(hov.some(r => /\.chemins-rappel-lien:hover/.test(r.sel)));
  assert(/\.chemins-btn-service, \.chemins-rappel, \.chemins-rappel-lien\{cursor:pointer;\}/.test(bloc[1]));
  assert(/\.chemins-btn-service:focus-visible, \.chemins-rappel:focus-within\{border-color:var\(--cyan\)/.test(HTML));
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

console.log(`${ok} contrôles OK`);
