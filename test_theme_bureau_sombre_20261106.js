// Test — thème par défaut Sombre en vue bureau (Guardian #160, demande de Frédéric 05/11).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, 'nexus-theme.js'), 'utf8');
let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

function charger(init, heureIso) {
  const attrs = {};
  const doc = { head: { appendChild() {} }, documentElement: { setAttribute(k, v) { attrs[k] = v; }, getAttribute: (k) => attrs[k] },
    createElement: () => ({}), querySelector: () => null, addEventListener() {} };
  const RealDate = Date;
  const t = new RealDate(heureIso).getTime();
  class FauxDate extends RealDate { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }
  const m = { ...init };
  const stockage = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const sb = { Intl, Date: FauxDate, setInterval: () => 0, document: doc, localStorage: stockage, self: null, module: { exports: {} } };
  sb.self = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb);
  return { api: sb.module.exports, attrs, sb };
}
const DIX_H = '2026-11-06T10:00:00'; // heure locale du processus de test
const dix = 10;

cas('calculerTheme : bureau + réglage absent → sombre à 10 h', () => {
  const { api } = charger({}, DIX_H);
  assert.strictEqual(api.calculerTheme(null, dix, true), 'sombre');
  assert.strictEqual(api.calculerTheme(undefined, dix, true), 'sombre');
});
cas('calculerTheme : mobile + réglage absent → jour à 10 h (inchangé)', () => {
  const { api } = charger({}, DIX_H);
  assert.strictEqual(api.calculerTheme(null, dix, false), 'jour');
  assert.strictEqual(api.calculerTheme(undefined, dix), 'jour');
});
cas('calculerTheme : choix explicite « jour » en bureau → jour', () => {
  const { api } = charger({}, DIX_H);
  assert.strictEqual(api.calculerTheme('jour', dix, true), 'jour');
});
cas('calculerTheme : « auto » explicite en bureau → bascule horaire', () => {
  const { api } = charger({}, DIX_H);
  assert.strictEqual(api.calculerTheme('auto', dix, true), 'jour');
  assert.strictEqual(api.calculerTheme('auto', 22, true), 'sombre');
});
cas('calculerTheme : choix explicite « sombre » partout', () => {
  const { api } = charger({}, DIX_H);
  assert.strictEqual(api.calculerTheme('sombre', dix, false), 'sombre');
  assert.strictEqual(api.calculerTheme('sombre', dix, true), 'sombre');
});
cas('page chargée : bureau + rien de mémorisé → data-theme sombre posé au chargement', () => {
  const { attrs } = charger({ nexus_vue_bureau: 'on' }, DIX_H);
  assert.strictEqual(attrs['data-theme'], 'sombre');
});
cas('page chargée : mobile + rien de mémorisé → jour à 10 h', () => {
  const { attrs } = charger({ nexus_vue_bureau: 'off', nexus_theme_fuseau: 'UTC' }, '2026-11-06T10:00:00Z');
  assert.strictEqual(attrs['data-theme'], 'jour');
});
cas('page chargée : bureau + choix explicite jour → jour', () => {
  const { attrs } = charger({ nexus_vue_bureau: 'on', nexus_theme: 'jour' }, DIX_H);
  assert.strictEqual(attrs['data-theme'], 'jour');
});
cas('page chargée : bureau + choix explicite auto → bascule horaire (jour à 10 h)', () => {
  const { attrs } = charger({ nexus_vue_bureau: 'on', nexus_theme: 'auto', nexus_theme_fuseau: 'UTC' }, '2026-11-06T10:00:00Z');
  assert.strictEqual(attrs['data-theme'], 'jour');
});
cas('changement de vue (rechargement) sans choix : la règle se réapplique', () => {
  assert.strictEqual(charger({ nexus_vue_bureau: 'on' }, DIX_H).attrs['data-theme'], 'sombre');
  assert.strictEqual(charger({ nexus_vue_bureau: 'off', nexus_theme_fuseau: 'UTC' }, '2026-11-06T10:00:00Z').attrs['data-theme'], 'jour');
});
cas('menu : bureau sans choix → « Sombre » actif ; choix explicite respecté', () => {
  const a = charger({ nexus_vue_bureau: 'on' }, DIX_H).sb.NexusTheme.menuHtml();
  assert.ok(/mm-theme-actif" data-theme-reglage="sombre"/.test(a));
  const b = charger({ nexus_vue_bureau: 'on', nexus_theme: 'auto' }, DIX_H).sb.NexusTheme.menuHtml();
  assert.ok(/mm-theme-actif" data-theme-reglage="auto"/.test(b));
});
cas('stockage inaccessible : pas d’exception, sombre', () => {
  const sb = { Intl, Date, setInterval: () => 0, self: null, module: { exports: {} },
    document: { head: { appendChild() {} }, documentElement: { setAttribute() {} }, createElement: () => ({}), querySelector: () => null, addEventListener() {} } };
  Object.defineProperty(sb, 'localStorage', { get() { throw new Error('refusé'); } });
  sb.self = sb; vm.createContext(sb); vm.runInContext(SRC, sb);
  assert.strictEqual(sb.module.exports.calculerTheme(null, 10, false), 'jour');
});
console.log(ok + ' épreuves');
