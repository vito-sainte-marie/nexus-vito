// Contrôle inventaire — correctif iPhone (06/11/2026) : aucune surface Sombre sous un texte Jour, ni l'inverse.
// Les feuilles injectées (premium-v2, réassort cigarettes, accès Photo Decenium) suivent data-theme. Présentation seulement.
const fs = require('fs');
const assert = require('assert');
const lire = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const premium = lire('nexus-inventaire-manager-premium-v2.js');
const reassort = lire('nexus-inventaire-manager-reassort-cigarettes-v3.js');
const plein = lire('nexus-inventaire-manager-fullwidth-v2.js');
const cas = [];
const verifier = (nom, f) => cas.push([nom, f]);

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const rap = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Jetons du thème Jour de nexus-theme.js (référence des variables var(--panel), var(--text-mid)…).
const JOUR = { panel: '#FFFFFF', bg: '#F4F6F8', 'text-mid': '#475569', text: '#0F172A' };
const jourDe = (src, prefixe) => {
  const bloc = src.match(new RegExp(':root\\[data-theme="jour"\\]\\{([^}]*)\\}'))[1];
  const m = {};
  bloc.split(';').forEach(d => { const p = d.split(/:(.+)/); if (p.length > 1) m[p[0].trim()] = p[1].trim(); });
  return m;
};
const sombreDe = (src) => {
  const m = {};
  (src.match(/:root\{([^}]*)\}/g) || []).forEach(b => b.replace(/^:root\{|\}$/g, '').split(';').forEach(d => { const p = d.split(/:(.+)/); if (p.length > 1) m[p[0].trim()] = p[1].trim(); }));
  return m;
};
const hex = (v, j) => { const r = /^var\(--([a-z-]+)\)$/.exec(v); return r ? JOUR[r[1]] : v; };

verifier('premium-v2 : chaque variable --ipv-* du Sombre a son pendant Jour', () => {
  const s = sombreDe(premium), j = jourDe(premium);
  const noms = Object.keys(s).filter(k => k.startsWith('--ipv-'));
  assert.ok(noms.length >= 15, 'variables ipv : ' + noms.length);
  noms.forEach(n => assert.ok(n in j, 'pas de valeur Jour pour ' + n));
});
verifier('premium-v2 : plus aucun fond ou texte sombre en dur hors variables', () => {
  const corps = premium.split('/* Jour :')[0].split('--ipv-body-bg:#0B0F14;')[1] || '';
  // Après le bloc de variables, les règles n'emploient que var(--ipv-*) pour les fonds et textes de surface.
  const regles = premium.replace(/:root\{[^}]*\}/g, '').replace(/:root\[data-theme="jour"\]\{[^}]*\}/g, '');
  ['rgba(21,30,40', 'rgba(17,24,32', 'rgba(25,35,47', '#0B0F14', '#667789', '#657585', '#758596']
    .forEach(x => assert.ok(!regles.includes(x), 'reste en dur : ' + x));
});
verifier('réassort cigarettes : chaque variable --nirc-* a son pendant Jour', () => {
  const s = sombreDe(reassort), j = jourDe(reassort);
  const noms = Object.keys(s).filter(k => k.startsWith('--nirc-'));
  assert.ok(noms.length >= 10);
  noms.forEach(n => assert.ok(n in j, 'pas de valeur Jour pour ' + n));
});
verifier('réassort cigarettes : le titre suit le texte du thème', () => {
  assert.ok(!/#141B22|#10171d|#1A222C|#242E38/.test(reassort.replace(/:root\{[^}]*\}/, '')));
  assert.ok(/\.nirc3t\{[^}]*color:var\(--text\)/.test(reassort), '.nirc3t sans color:var(--text)');
});
verifier('accès Photo Decenium : le lien d\'action suit le thème', () => {
  assert.ok(!/inv-photo-decenium-access-action\{[^}]*color:#56C7DC/.test(plein));
  assert.ok(!/access-title\{[^}]*#E9F2F5/.test(plein) && !/access-sub\{[^}]*#8293A3/.test(plein));
  assert.ok(plein.includes('--ipv-access-bg') && premium.includes('--ipv-access-bg:var(--panel)'));
});
verifier('Jour : textes de surface ≥ 4,5:1 sur leurs fonds', () => {
  const j = jourDe(premium);
  const fond = hex(j['--ipv-card-bg']);
  ['--ipv-eyebrow', '--ipv-titre', '--ipv-titre-cyan', '--ipv-titre-or', '--ipv-vide', '--ipv-desc'].forEach(n =>
    assert.ok(rap(hex(j[n]), fond) >= 4.5, n + ' ' + rap(hex(j[n]), fond).toFixed(2)));
  [['--ipv-statut', '--ipv-statut-bg'], ['--ipv-desc', '--ipv-file-bg'], ['--ipv-desc', '--ipv-badge-bg']].forEach(([t, b]) =>
    assert.ok(rap(hex(j[t]), hex(j[b])) >= 4.5, t + '/' + b));
  assert.ok(rap(hex(j['--ipv-titre-cyan']), hex(j['--ipv-card-secondary'])) >= 4.5);
  const r = jourDe(reassort);
  ['--nirc-mid', '--nirc-cyan', '--nirc-rouge', '--nirc-ambre', '--nirc-vert', '--nirc-bouton'].forEach(n => {
    [r['--nirc-fond'], r['--nirc-ligne'], r['--nirc-puce']].forEach(b =>
      assert.ok(rap(hex(r[n]), hex(b)) >= 4.5, n + ' sur ' + b + ' ' + rap(hex(r[n]), hex(b)).toFixed(2)));
  });
});
verifier('Sombre : fond conservé, textes remontés à 4,5:1', () => {
  const s = sombreDe(premium);
  assert.strictEqual(s['--ipv-body-bg'], '#0B0F14');
  assert.strictEqual(s['--ipv-titre'], '#8997A5');
  assert.ok(premium.includes('.synthese-card .param-note{color:var(--text-mid)}'));
  assert.strictEqual(sombreDe(reassort)['--nirc-fond'], '#141B22');
});

let ko = 0;
cas.forEach(([nom, f]) => { try { f(); console.log('ok  ' + nom); } catch (e) { ko++; console.log('KO  ' + nom + ' — ' + e.message); } });
if (ko) process.exit(1);
