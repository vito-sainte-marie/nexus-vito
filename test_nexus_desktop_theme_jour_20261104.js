// Test — la barre latérale de la vue bureau suit le Mode Jour (Guardian #160, 6630497855).
// Présentation seule : chaque couleur en dur de la barre, du bouton flottant et des infobulles
// a sa surcharge sous [data-theme="jour"] ; rien ne s'applique hors Jour ; contrastes AA.
const assert = require('assert');
const fs = require('fs');
const T = require('./nexus-theme.js');

const SRC = process.env.SRC_MUTE || 'nexus-desktop.js';
const src = fs.readFileSync(SRC, 'utf8');
const m = src.match(/const NEXUS_DESKTOP_CSS = `([\s\S]*?)`;/);
assert.ok(m, 'NEXUS_DESKTOP_CSS introuvable');
const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '');

const regles = [];
const re = /([^{}]+)\{([^{}]*)\}/g;
let r;
while ((r = re.exec(css))) {
  regles.push({ sel: r[1].trim().replace(/\s+/g, ' '), corps: r[2] });
}
const JOUR = /^\[data-theme="jour"\] /;
const enJour = regles.filter((x) => x.sel.split(',').some((s) => JOUR.test(s.trim())));
const hors = regles.filter((x) => !enJour.includes(x));

let ok = 0;
function t(nom, f) { f(); ok++; console.log('✓ ' + nom); }

const COULEUR = /(^|[;\s])(color|background|background-color|border|border-right|border-top|border-color|box-shadow)\s*:[^;]*(#[0-9A-Fa-f]{3,8}|rgba?\()/;
const CIBLE = /^\.(nexus-sidebar|nexus-tooltip|nexus-vue-bureau-flottant)/;

t('aucune règle de Jour hors du sélecteur [data-theme="jour"]', () => {
  for (const x of enJour) {
    for (const s of x.sel.split(',')) assert.ok(JOUR.test(s.trim()), 'sélecteur hors Jour : ' + s);
  }
  for (const x of hors) assert.ok(!/data-theme/.test(x.sel), 'data-theme hors du bloc Jour : ' + x.sel);
  assert.ok(enJour.length >= 15, 'trop peu de surcharges : ' + enJour.length);
});

// Les règles de la barre qui posent une couleur : chacune doit avoir sa surcharge Jour,
// avec le même sélecteur (état :hover, .active, :active… compris).
const aCouvrir = hors.flatMap((x) => x.sel.split(',').map((s) => s.trim()).filter((s) => CIBLE.test(s)).map((s) => ({ s, corps: x.corps })))
  .filter((x) => COULEUR.test(x.corps) && !/keyframes/.test(x.s));

t('chaque couleur en dur de la barre a une surcharge Jour', () => {
  assert.ok(aCouvrir.length >= 18, 'inventaire trop court : ' + aCouvrir.length);
  const surcharges = new Set(enJour.flatMap((x) => x.sel.split(',').map((s) => s.trim().replace(JOUR, ''))));
  const manquants = aCouvrir.filter((x) => !surcharges.has(x.s)).map((x) => x.s);
  // Exceptions voulues : sans couleur propre à changer (marque, géométrie seule).
  const EXEMPTES = ['.nexus-sidebar-link img', '.nexus-sidebar-link.active img', '.nexus-sidebar-brand img'];
  const reste = manquants.filter((s) => !EXEMPTES.includes(s));
  assert.deepStrictEqual(reste, [], 'sans surcharge Jour : ' + reste.join(' | '));
});

t('Sombre inchangé : aucune valeur par défaut ne dépend du thème', () => {
  const brut = hors.map((x) => x.sel + '{' + x.corps + '}').join('\n');
  for (const c of ['#0d131a', '#242e38', '#EDF1F5', '#8A96A5', '#1A222C', '#141B22']) {
    assert.ok(brut.includes(c), 'valeur par défaut Sombre disparue : ' + c);
  }
});

// Contrastes AA des paires que Jour pose (texte sur fond), mesurés dans le CSS lui-même.
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function val(sel, prop) {
  const x = enJour.find((y) => y.sel.split(',').map((s) => s.trim()).includes('[data-theme="jour"] ' + sel));
  assert.ok(x, 'surcharge absente : ' + sel);
  const mm = x.corps.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*(#[0-9A-Fa-f]{6})'));
  assert.ok(mm, 'propriété absente : ' + sel + ' ' + prop);
  return mm[1];
}
t('contraste AA en Jour : texte, groupes, lien actif, infobulle, pastille', () => {
  const blanc = val('.nexus-sidebar', 'background');
  const paires = [
    ['marque', val('.nexus-sidebar-brand span', 'color'), blanc],
    ['groupe', val('.nexus-sidebar-group', 'color'), blanc],
    ['lien', val('.nexus-sidebar-link', 'color'), blanc],
    ['survol', val('.nexus-sidebar-link:hover', 'color'), val('.nexus-sidebar-link:hover', 'background')],
    ['actif', val('.nexus-sidebar-link.active', 'color'), val('.nexus-sidebar-link.active', 'background')],
    ['bouton pied', val('.nexus-sidebar-toggle', 'color'), val('.nexus-sidebar-toggle', 'background')],
    ['titre infobulle', val('.nexus-tooltip-title', 'color'), val('.nexus-tooltip', 'background')],
    ['texte infobulle', val('.nexus-tooltip-desc', 'color'), val('.nexus-tooltip', 'background')],
    ['cta infobulle', val('.nexus-tooltip-cta', 'color'), val('.nexus-tooltip', 'background')],
    ['pastille rouge (graphique, 3:1)', val('.nexus-sidebar-dot', 'background'), blanc, 3],
  ];
  for (const [nom, fg, bg, seuil] of paires) {
    const q = ratio(fg, bg);
    assert.ok(q >= (seuil || 4.5), `${nom} : ${fg} sur ${bg} = ${q.toFixed(2)}:1`);
  }
  // Le bouton flottant est dans une @media : sa couleur est lue dans la même table.
  const q = ratio(val('.nexus-vue-bureau-flottant', 'color'), val('.nexus-vue-bureau-flottant', 'background'));
  assert.ok(q >= 4.5, 'bouton flottant ' + q.toFixed(2));
  // Les valeurs viennent de la palette Jour de nexus-theme.js.
  assert.strictEqual(blanc.toUpperCase(), T.JOUR['--panel']);
  assert.strictEqual(val('.nexus-sidebar-link.active', 'color').toUpperCase(), T.JOUR['--cyan']);
  assert.strictEqual(val('.nexus-sidebar-brand span', 'color').toUpperCase(), T.JOUR['--text']);
});

console.log(`OK — ${ok} épreuves`);
