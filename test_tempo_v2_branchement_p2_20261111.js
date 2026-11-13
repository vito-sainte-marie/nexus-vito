// Tempo V2 — branchement partie 2 : « Quarts et équipes », pastille du site, valeur et unité.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }

global.window = {};
require(path.join(__dirname, 'nexus-tempo.js'));
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const B = { debut: '2026-09-15', fin: '2026-11-10', exclu: '2026-11-11' };
const q = (date, quart, valeur) => ({ date, quart: String(quart), valeur });
// 4 jours par quart, dans 4 semaines différentes
const jeu = [
  q('2026-09-16', 1, 100), q('2026-09-23', 1, 100), q('2026-09-30', 1, 100), q('2026-10-07', 1, 100),
  q('2026-09-16', 2, 50), q('2026-09-23', 2, 50), q('2026-09-30', 2, 200), q('2026-10-07', 2, 50),
];

t('moyennes par quart, effectifs, écart et semaines', () => {
  const r = T.comparerQuarts(jeu, B);
  assert.strictEqual(r.etat, 'ok');
  assert.strictEqual(r.q1.effectif, 4); assert.strictEqual(r.q2.effectif, 4);
  assert.strictEqual(r.q1.moyenne, 100); assert.strictEqual(r.q2.moyenne, 87.5);
  assert.ok(Math.abs(r.ecartPct - (12.5 / 87.5 * 100)) < 1e-9);
  assert.strictEqual(r.semainesCommunes, 4); assert.strictEqual(r.semainesQ1Depasse, 3);
});

t('quart incomplet (un litrage manquant) écarté', () => {
  const rows = [{ date: '2026-09-16', quart: 1, litrage_gazole: 10, litrage_sp95: 5, litrage_gnr: null },
    { date: '2026-09-16', quart: 2, litrage_gazole: 10, litrage_sp95: 5, litrage_gnr: 1 }];
  const r = T.quartsLitresPiste(rows);
  assert.deepStrictEqual(r, [{ date: '2026-09-16', quart: '2', valeur: 16 }]);
});

t('boutique : vente_boutique nulle écartée ; FDJ : seuls les quarts comptabilisables', () => {
  assert.strictEqual(T.quartsBoutique([{ date: '2026-09-16', quart: 1, vente_boutique: null }, { date: '2026-09-16', quart: 2, vente_boutique: 300 }]).length, 1);
  const f = T.quartsFdj([
    { date: '2026-09-16', quart: 1, ventes_grattage_valeur: 100, caisse_tirages: 20, caisse_comptabilisable: true },
    { date: '2026-09-16', quart: 2, ventes_grattage_valeur: 100, caisse_tirages: 20, caisse_comptabilisable: false }]);
  assert.deepStrictEqual(f, [{ date: '2026-09-16', quart: '1', valeur: 120 }]);
});

t('jour en cours et hors fenêtre exclus', () => {
  const r = T.comparerQuarts(jeu.concat([q('2026-11-11', 1, 9999), q('2026-09-14', 2, 9999)]), B);
  assert.strictEqual(r.q1.effectif, 4); assert.strictEqual(r.q2.effectif, 4);
});

t('seuil : moins de 4 quarts d\'un côté → insuffisant', () => {
  const r = T.comparerQuarts(jeu.slice(0, 7), B);
  assert.strictEqual(r.etat, 'insuffisant'); assert.strictEqual(r.ecartPct, null);
});

t('source absente → absent', () => {
  assert.strictEqual(T.comparerQuarts(null, B).etat, 'absent');
  assert.strictEqual(T.comparerQuarts([], B).etat, 'absent');
});

t('semaine sans les deux quarts non comptée', () => {
  const rows = jeu.concat([q('2026-10-14', 1, 500)]);
  const r = T.comparerQuarts(rows, B);
  assert.strictEqual(r.semainesCommunes, 4);
});

t('pastille : lue dans sites, jamais codée en dur', () => {
  assert.ok(/from\('sites'\)\.select\('nom_entreprise'\)/.test(scripts));
  assert.ok(/pillSite'\)\.textContent = nomSite/.test(scripts));
  assert.ok(!/Vito Sainte-Marie/.test(html));
  assert.ok(!/pillSite'\)\.textContent\s*=\s*'Station/.test(scripts));
});

t('valeur et unité dans deux éléments distincts, sans préfixe « Marge : »', () => {
  assert.ok(/className = 'nb'/.test(scripts) && /className = 'unite'/.test(scripts));
  assert.ok(/\.valeur \.nb\{[^}]*font-size:30px/.test(html));
  assert.ok(/\.valeur \.unite\{[^}]*font-size:12\.5px[^}]*var\(--t-mid\)/.test(html));
  assert.ok(!/Marge : /.test(scripts));
  assert.ok(/fmtNb\(mi\.marge\)\+' €'|fmtNb\(mi\.marge\) \+ ' €'/.test(scripts), 'marge Boutique en euros');
  assert.ok(/'par jour'/.test(scripts));
});

t('lecture seule : aucune écriture', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\s*\(/.test(scripts));
  assert.ok(/view_fdj_shift_facts/.test(scripts));
});

t('FDJ garde Hypothèse et G4 ; pas de lien actif', () => {
  assert.ok(/id="qFdj"[\s\S]*?niveau hypothese[\s\S]*?data-arbitrage="G4"/.test(html));
  assert.deepStrictEqual([...html.slice(html.indexOf('<body>')).matchAll(/<a\s[^>]*href="([^"]*)"/gi)].map(m => m[1]), ['NEXUS-Tempo-v2-Quarts.html', 'NEXUS-Tempo-v2-Pompistes.html', 'NEXUS-Tempo-v2-Jours.html', 'NEXUS-Tempo-v2-Mois.html', 'NEXUS-Tempo-v2-Vacances.html', 'NEXUS-Tempo-v2-PisteBoutique.html', 'NEXUS-Cockpit-v2.html']);
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
