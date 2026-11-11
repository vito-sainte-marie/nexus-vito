// Tempo V2 — lot A « découvertes » : trois calculs purs + câblage en lecture seule.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

// Générateur déterministe.
function alea(graine) { let s = graine; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
function jours(debut, n) {
  const r = []; const d = new Date(debut + 'T12:00:00Z');
  for (let i = 0; i < n; i++) { r.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return r;
}
const bornes = { debut: '2026-09-15', fin: '2026-11-09' };
const bRef = { debut: '2026-07-21', fin: '2026-09-14' };

// Audits : prix = litres → CA piste ; boutique pilotée par `liaison` (bruit commun avec la FDJ).
function simuler(dates, { prix, litres, liaison, graine }) {
  const a = alea(graine), audits = [], fdj = [];
  dates.forEach(d => {
    const commun = liaison ? a() * 600 : 0;
    const L = litres + a() * 400;
    [1, 2].forEach(q => audits.push({ date: d, quart: String(q), litrage_gazole: L / 4, litrage_sp95: L / 4, litrage_gnr: 0,
      vente_piste: L / 2 * prix, vente_boutique: 900 + commun / 2 + a() * 40 }));
    fdj.push({ date: d, nb_quarts_controles: 2, ca_grattage: 500 + commun + a() * 40, caisse_tirages: 300 });
  });
  return { audits, fdj };
}
const E = simuler(jours(bornes.debut, 56), { prix: 2.13, litres: 5600, liaison: true, graine: 7 });
const R = simuler(jours(bRef.debut, 56), { prix: 1.93, litres: 5700, liaison: true, graine: 11 });

t('sources : la carte FDJ garde sa source, « Prix et volume » a disparu', () => {
  assert.ok(html.includes("'Source : NEXUS FDJ et Verify · '"), 'source FDJ');
  assert.ok(!html.includes("'Source : Verify · ' + fq.q1"), 'ancienne source');
  assert.ok(!/decouvertePrixVolume|titrePrixVolume|Prix et volume/.test(html + fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8')));
});

t('relation : boutique et FDJ liées → retenue (≥ 30 jours, significative)', () => {
  const r = T.relationBoutiqueFdj(E.audits, E.fdj, bornes);
  assert.strictEqual(r.etat, 'ok');
  assert.ok(r.n >= 30 && r.boutiqueFdj.significative && r.boutiqueFdj.r > 0.5);
  assert.strictEqual(r.boutiqueFdj.df, r.n - 8);
  assert.ok(!r.boutiqueLitres.significative, 'litres indépendants de la boutique');
});

t('relation : sous 30 jours → insuffisant', () => {
  const p = simuler(jours('2026-10-15', 20), { prix: 2, litres: 5600, liaison: true, graine: 3 });
  const r = T.relationBoutiqueFdj(p.audits, p.fdj, bornes);
  assert.strictEqual(r.etat, 'insuffisant');
  assert.strictEqual(r.seuil, 30);
});

t('relation : boutique et FDJ indépendantes → non significative, carte masquée', () => {
  const p = simuler(jours(bornes.debut, 56), { prix: 2, litres: 5600, liaison: false, graine: 5 });
  const r = T.relationBoutiqueFdj(p.audits, p.fdj, bornes);
  assert.strictEqual(r.etat, 'non-significative');
});

t('relation : un jour FDJ incomplet est écarté', () => {
  const f = E.fdj.map((x, i) => i === 3 ? Object.assign({}, x, { nb_quarts_controles: 1 }) : x);
  const a = T.relationBoutiqueFdj(E.audits, E.fdj, bornes), b = T.relationBoutiqueFdj(E.audits, f, bornes);
  assert.strictEqual(b.n, a.n - 1);
});

t('FDJ au quart 1 : rapport arrondi au dixième, null sans quart 2', () => {
  const ok = T.rapportFdjQuart1({ etat: 'ok', q1: { effectif: 40, moyenne: 210 }, q2: { effectif: 40, moyenne: 100 } });
  assert.strictEqual(ok.rapport, 2.1);
  assert.strictEqual(T.rapportFdjQuart1({ etat: 'ok', q1: { moyenne: 5 }, q2: { moyenne: 0 } }), null);
  assert.strictEqual(T.rapportFdjQuart1(null), null);
});

t('page : trois cartes remplies par script, preuves en <details>, aucun lien', () => {
  assert.ok(/remplirDecouverte\(0,/.test(scripts) && /remplirDecouverte\(1,/.test(scripts) && /remplirDecouverte\(2,/.test(scripts));
  assert.ok(/'details'/.test(scripts) && /Voir les preuves/.test(scripts));
  assert.ok(/Une relation, pas une cause\./.test(scripts));
  assert.ok(/Rattachement des tirages au quart à confirmer/.test(scripts) && /arbitrage: 'G4'/.test(scripts));
  assert.ok(/Fait mesuré/.test(scripts) && /Relation observée/.test(scripts) && /Hypothèse/.test(scripts));
  assert.deepStrictEqual([...html.slice(html.indexOf('<body>')).matchAll(/<a\s[^>]*href="([^"]*)"/gi)].map(m => m[1]), ['NEXUS-Tempo-v2-Quarts.html', 'NEXUS-Cockpit-v2.html']);
});

t('page : la carte relation n\'est remplie que si la relation est retenue', () => {
  assert.ok(/rel\.etat === 'ok'/.test(scripts));
});

t('page : aucune écriture, aucune lecture ajoutée', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\s*\(/.test(scripts));
  assert.strictEqual((scripts.match(/\.from\s*\(/g) || []).length, 12, 'nombre de lectures changé');
  assert.ok(!/\(G\d\)/.test(scripts), 'code G visible dans le script');
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
