// Test — thème Sombre / Jour / Auto du parcours pompiste (lot MODE-JOUR-POMPISTE-20261102).
// Auto : Jour de 6 h 00 (inclus) à 18 h 00 (exclu), heure de la station ; réglage absent → Auto ;
// localStorage inaccessible → Auto sans erreur. SRC_MUTE : source mutée pour la preuve de mutation.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FICHIER = process.env.SRC_MUTE || path.join(__dirname, 'nexus-theme.js');
const SRC = fs.readFileSync(FICHIER, 'utf8');

let ok = 0;
function cas(nom, f) { f(); ok++; console.log('  ✓ ' + nom); }

// Charge le module dans un contexte isolé, avec un « appareil » simulé.
function charger({ stockage, maintenant, fuseau } = {}) {
  const attrs = {};
  const meta = { v: '#0B0F14', setAttribute(k, v) { this.v = v; }, getAttribute() { return this.v; } };
  const head = { enfants: [], appendChild(n) { this.enfants.push(n); } };
  const doc = {
    head, documentElement: { setAttribute(k, v) { attrs[k] = v; }, getAttribute: (k) => attrs[k] },
    createElement: () => ({}), querySelector: () => meta, addEventListener() {},
  };
  const RealDate = Date;
  const instant = maintenant ? new RealDate(maintenant) : new RealDate();
  class FauxDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [instant.getTime()])); }
    static now() { return instant.getTime(); }
  }
  const sandbox = { Intl, Date: FauxDate, setInterval: () => 0, document: doc, self: null };
  if (stockage !== undefined) Object.defineProperty(sandbox, 'localStorage', { get: () => { if (stockage instanceof Error) throw stockage; return stockage; } });
  sandbox.self = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: FICHIER });
  if (fuseau) sandbox.NexusTheme.definirFuseau(fuseau);
  return { api: sandbox.module.exports, attrs, meta, sandbox, head };
}
const stockageMemoire = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

const { api } = charger();

// ── Calcul pur aux quatre bornes horaires ──
cas('Auto à 5:59 → sombre', () => assert.strictEqual(api.calculerTheme('auto', 5 + 59 / 60), 'sombre'));
cas('Auto à 6:00 → jour', () => assert.strictEqual(api.calculerTheme('auto', 6), 'jour'));
cas('Auto à 17:59 → jour', () => assert.strictEqual(api.calculerTheme('auto', 17 + 59 / 60), 'jour'));
cas('Auto à 18:00 → sombre', () => assert.strictEqual(api.calculerTheme('auto', 18), 'sombre'));
cas('Auto à minuit et à midi', () => {
  assert.strictEqual(api.calculerTheme('auto', 0), 'sombre');
  assert.strictEqual(api.calculerTheme('auto', 12), 'jour');
});
cas('Jour et Sombre forcés, quelle que soit l\'heure', () => {
  assert.strictEqual(api.calculerTheme('jour', 2), 'jour');
  assert.strictEqual(api.calculerTheme('sombre', 12), 'sombre');
});
cas('réglage absent ou inconnu = Auto', () => {
  for (const r of [undefined, null, '', 'nimporte', 42]) {
    assert.strictEqual(api.calculerTheme(r, 12), 'jour');
    assert.strictEqual(api.calculerTheme(r, 23), 'sombre');
  }
});
cas('Auto sans heure exploitable → sombre (jamais d\'exception)', () => {
  for (const h of [undefined, null, NaN, Infinity, 'midi']) assert.strictEqual(api.calculerTheme('auto', h), 'sombre');
});

// ── Heure de la station (fuseau) ──
cas('heure dans le fuseau de la station, indépendante de l\'appareil', () => {
  // 02/11/2026 : Paris = UTC+1, Réunion = UTC+4
  assert.strictEqual(api.heureDansFuseau('Europe/Paris', new Date('2026-11-02T04:59:00Z')), 5 + 59 / 60);
  assert.strictEqual(api.heureDansFuseau('Europe/Paris', new Date('2026-11-02T05:00:00Z')), 6);
  assert.strictEqual(api.heureDansFuseau('Europe/Paris', new Date('2026-11-02T16:59:00Z')), 17 + 59 / 60);
  assert.strictEqual(api.heureDansFuseau('Europe/Paris', new Date('2026-11-02T17:00:00Z')), 18);
  assert.strictEqual(api.heureDansFuseau('Indian/Reunion', new Date('2026-11-02T02:00:00Z')), 6);
});
cas('fuseau absent ou illisible → null', () => {
  for (const f of [undefined, null, '', '  ', 'Mars/Olympus']) assert.strictEqual(api.heureDansFuseau(f, new Date()), null);
});
cas('bout en bout : le fuseau de la station décide, pas l\'appareil', () => {
  // 17:30 UTC : Paris 18:30 → sombre ; Réunion 21:30 → sombre ; New York 12:30 → jour
  const t = (tz) => charger({ stockage: stockageMemoire(), maintenant: '2026-11-02T17:30:00Z', fuseau: tz }).attrs['data-theme'];
  assert.strictEqual(t('Europe/Paris'), 'sombre');
  assert.strictEqual(t('America/New_York'), 'jour');
});
cas('bout en bout : la bascule 5:59 → 6:00 est suivie sans recharger', () => {
  const p = charger({ stockage: stockageMemoire(), maintenant: '2026-11-02T04:59:00Z', fuseau: 'Europe/Paris' });
  assert.strictEqual(p.attrs['data-theme'], 'sombre');
  const p2 = charger({ stockage: stockageMemoire(), maintenant: '2026-11-02T05:00:00Z', fuseau: 'Europe/Paris' });
  assert.strictEqual(p2.attrs['data-theme'], 'jour');
});

// ── Mémorisation ──
cas('aucun réglage mémorisé → Auto', () => {
  assert.strictEqual(api.lireReglage(stockageMemoire()), 'auto');
  assert.strictEqual(charger({ stockage: stockageMemoire(), maintenant: '2026-11-02T10:00:00Z', fuseau: 'Europe/Paris' }).api.reglageCourant(), 'auto');
});
cas('réglage mémorisé relu au chargement suivant', () => {
  const s = stockageMemoire();
  const a = charger({ stockage: s, maintenant: '2026-11-02T23:00:00Z', fuseau: 'Europe/Paris' });
  a.sandbox.NexusTheme.definirReglage('jour');
  assert.strictEqual(s.m.nexus_theme, 'jour');
  const b = charger({ stockage: s, maintenant: '2026-11-02T23:00:00Z' });
  assert.strictEqual(b.attrs['data-theme'], 'jour');
});
cas('valeur mémorisée corrompue → Auto', () => assert.strictEqual(api.lireReglage(stockageMemoire({ nexus_theme: '{x' })), 'auto'));
cas('localStorage inaccessible (getItem lève) → Auto, sans erreur', () => {
  const casse = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.strictEqual(api.lireReglage(casse), 'auto');
  const p = charger({ stockage: casse, maintenant: '2026-11-02T10:00:00Z', fuseau: 'Europe/Paris' });
  assert.strictEqual(p.attrs['data-theme'], 'jour');
  assert.doesNotThrow(() => p.sandbox.NexusTheme.definirReglage('sombre'));
  assert.strictEqual(p.attrs['data-theme'], 'sombre');
});
cas('accès à window.localStorage qui lève (cookies bloqués) → Auto, sans erreur', () => {
  const p = charger({ stockage: new Error('SecurityError'), maintenant: '2026-11-02T10:00:00Z', fuseau: 'Europe/Paris' });
  assert.strictEqual(p.attrs['data-theme'], 'jour');
});
cas('localStorage absent → Auto, sans erreur', () => {
  const inst = new Date('2026-11-02T20:00:00Z');
  const p = charger({ maintenant: '2026-11-02T20:00:00Z' });
  // sans fuseau connu : heure de l'appareil (teinte d'affichage seulement)
  assert.strictEqual(p.attrs['data-theme'], api.calculerTheme('auto', inst.getHours() + inst.getMinutes() / 60));
});

// ── Application ──
cas('theme-color suit le thème', () => {
  const p = charger({ stockage: stockageMemoire(), maintenant: '2026-11-02T10:00:00Z', fuseau: 'Europe/Paris' });
  assert.strictEqual(p.meta.v, '#F4F6F8');
  p.sandbox.NexusTheme.definirReglage('sombre');
  assert.strictEqual(p.meta.v, '#0B0F14');
});
cas('le CSS Jour ne redéfinit que des jetons (aucune règle de mise en page)', () => {
  const css = api.cssJour();
  assert.ok(/^:root\[data-theme="jour"\]\{/.test(css));
  const corps = css.slice(css.indexOf('{') + 1, css.indexOf('}'));
  corps.split(';').filter(Boolean).forEach((d) => assert.ok(/^(color-scheme:light|--[a-z0-9-]+:[^;]+)$/.test(d), 'déclaration inattendue : ' + d));
});

console.log(`\n${ok} contrôles OK`);
