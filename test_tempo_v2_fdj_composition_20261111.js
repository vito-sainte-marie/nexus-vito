// Tempo V2 — lot D3 : composition de la FDJ (grattage / tirages), paliers, jeux, lien Cockpit.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }

function jours(debut, n) { const r = []; const d = new Date(debut + 'T12:00:00Z'); for (let i = 0; i < n; i++) { r.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return r; }
function alea(g) { let s = g; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
const bornes = { debut: '2026-09-16', fin: '2026-11-10' };
const bRef = { debut: '2026-07-22', fin: '2026-09-15' };
function serie(dates, gr, ti, _, graine, quarts) {
  const a = alea(graine);
  return dates.map(d => ({ date: d, nb_quarts_controles: quarts === undefined ? 2 : quarts, ca_grattage: gr + a() * 60, caisse_tirages: ti + a() * 40 }));
}
const dE = jours(bornes.debut, 56), dR = jours(bRef.debut, 56);
const E = serie(dE, 1261, 789, 3, 5), R = serie(dR, 1082, 629, 4, 9);

t('total = grattage + tirages, sans double compte', () => {
  const a = T.analyseFdj(E, R, bornes, bRef);
  assert.strictEqual(a.etat, 'ok');
  const g = a.familles[0], ti = a.familles[1];
  assert.ok(Math.abs(a.total.moyenneE - (g.moyenneE + ti.moyenneE)) < 1e-6);
  assert.ok(Math.abs(a.total.moyenneR - (g.moyenneR + ti.moyenneR)) < 1e-6);
  assert.ok(Math.abs((g.contribution + ti.contribution) - (a.total.moyenneE - a.total.moyenneR)) < 1e-6);
});
t('contributions signées et parts', () => {
  const a = T.analyseFdj(E, R, bornes, bRef);
  const [g, ti] = a.familles;
  assert.ok(g.contribution > 150 && g.contribution < 210, String(g.contribution));
  assert.ok(ti.contribution > 130 && ti.contribution < 190);
  assert.ok(Math.abs(g.part + ti.part - 1) < 1e-6);
});
t('hausse nette des deux familles : les deux sont citées, même avec part > 50 %', () => {
  const a = T.analyseFdj(E, R, bornes, bRef);
  assert.ok(a.constat && /grattage et les tirages/.test(a.constat.texte), a.constat && a.constat.texte);
  assert.ok(!/\d/.test(a.constat.texte), 'aucun chiffre sur la carte');
});
t('une seule famille citée si elle porte > 50 % et que l\'autre est stable', () => {
  const R2 = serie(dR, 1082, 789, 4, 9);
  const a = T.analyseFdj(E, R2, bornes, bRef);
  assert.ok(a.constat && /le grattage/.test(a.constat.texte) && !/tirages/.test(a.constat.texte), a.constat && a.constat.texte);
});
t('seuil strict : exactement 50 % ne désigne pas une famille', () => {
  const c = T.constatCompositionFdj(
    { cmp: { ecart: 100 }, cmpAvec: { ecart: 100 }, claire: true },
    [{ cle: 'grattage', article: 'le grattage', contribution: 50, part: 0.5, claire: false, cmp: { ecart: 50 } },
     { cle: 'tirages', article: 'les tirages', contribution: 50, part: 0.5, claire: false, cmp: { ecart: 50 } }]);
  assert.ok(c && /grattage et les tirages/.test(c.texte), c && c.texte);
});
t('compensation : le grattage monte, les tirages baissent', () => {
  const R3 = serie(dR, 900, 1100, 4, 9);
  const E3 = serie(dE, 1300, 700, 3, 5);
  const a = T.analyseFdj(E3, R3, bornes, bRef);
  const c = a.constat || T.constatCompositionFdj(a.total, a.familles);
  if (c) assert.ok(/grattage monte, les tirages baissent/i.test(c.texte), c.texte);
  assert.ok(a.familles[0].contribution > 0 && a.familles[1].contribution < 0);
});
t('pas de constat si le total n\'est pas net', () => {
  const a = T.analyseFdj(serie(dE, 1000, 700, 3, 5), serie(dR, 1000, 700, 4, 9), bornes, bRef);
  assert.ok(!a.constat);
});
t('seuls les jours complets (2 quarts) comptent', () => {
  const E4 = serie(dE, 1261, 789, 3, 5).map((r, i) => i % 2 ? Object.assign(r, { nb_quarts_controles: 1, ca_grattage: 99999 }) : r);
  const a = T.analyseFdj(E4, R, bornes, bRef);
  assert.ok(a.familles[0].moyenneE < 2000);
});
t('variation masquée : une famille nette, total non net', () => {
  const E5 = serie(dE, 1400, 560, 3, 5), R5 = serie(dR, 1082, 878, 4, 9);
  const a = T.analyseFdj(E5, R5, bornes, bRef);
  assert.ok(a.candidats.some(c => c.type === 'masquee'), JSON.stringify(a.candidats));
});
t('découverte : le total net donne la variation simple, retenue sinon null', () => {
  const a = T.analyseFdj(E, R, bornes, bRef);
  assert.ok(a.candidats.some(c => c.type === 'variation'));
  const b = T.analyseFdj(serie(dE, 1000, 700, 3, 5), serie(dR, 1000, 700, 4, 9), bornes, bRef);
  assert.strictEqual(b.retenue, null);
});
t('seuil de dépassement k configurable', () => {
  const a = T.analyseFdj(E, R, bornes, bRef, 100);
  assert.strictEqual(a.k, 100);
});

// Paliers et jeux.
function lignesPaliers(dates, parPalier, completsSeulement) {
  const r = []; dates.forEach((d, i) => { if (completsSeulement && i % 7 === 0) return; Object.keys(parPalier).forEach(p => r.push({ date: d, palier: Number(p), ca: parPalier[p] })); }); return r;
}
t('somme des paliers = grattage du jour (jours couverts), couverture partielle affichée', () => {
  const E6 = dE.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 1000, caisse_tirages: 0 }));
  const R6 = dR.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 800, caisse_tirages: 0 }));
  const pE = lignesPaliers(dE, { 5: 400, 10: 300, 15: 300 }, false);
  const pR = lignesPaliers(dR, { 5: 300, 10: 300, 15: 200 }, true);
  const d = T.detailPaliersFdj(E6, R6, pE, pR, bornes, bRef);
  assert.strictEqual(d.complete, false);
  assert.ok(d.couvertureR.couverts < d.couvertureR.complets);
  assert.strictEqual(d.couvertureE.couverts, d.couvertureE.complets);
  const s = d.lignes.reduce((x, l) => x + l.contribution, 0);
  assert.ok(Math.abs(s - 200) < 1e-6, String(s));
  assert.deepStrictEqual(d.lignes.map(l => l.cle), [5, 10, 15]);
});
t('jours complets sans détail : jamais complétés par 0', () => {
  const E7 = dE.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 1000, caisse_tirages: 0 }));
  const R7 = dR.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 800, caisse_tirages: 0 }));
  const d = T.detailPaliersFdj(E7, R7, lignesPaliers(dE, { 5: 1000 }, false), [], bornes, bRef);
  assert.strictEqual(d.couvertureR.couverts, 0);
  assert.strictEqual(d.lignes.length, 0);
});
t('jeux : les 5 premiers par contribution absolue, signés, nommés', () => {
  const E8 = dE.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 1000, caisse_tirages: 0 }));
  const R8 = dR.map(d => ({ date: d, nb_quarts_controles: 2, ca_grattage: 1000, caisse_tirages: 0 }));
  const jE = [], jR = [];
  const vE = { 1: 300, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 200 }, vR = { 1: 100, 2: 150, 3: 100, 4: 100, 5: 100, 6: 100, 7: 350 };
  dE.forEach(d => Object.keys(vE).forEach(g => jE.push({ date: d, game_id: Number(g), ca: vE[g] })));
  dR.forEach(d => Object.keys(vR).forEach(g => jR.push({ date: d, game_id: Number(g), ca: vR[g] })));
  const r = T.detailJeuxFdj(E8, R8, jE, jR, bornes, bRef, { 1: 'Cash', 7: 'Millions' }, 5);
  assert.strictEqual(r.lignes.length, 5);
  assert.strictEqual(r.lignes[0].nom, 'Cash'); assert.strictEqual(r.lignes[0].contribution, 200);
  assert.strictEqual(r.lignes[1].nom, 'Millions'); assert.strictEqual(r.lignes[1].contribution, -150);
  assert.strictEqual(r.lignes[2].nom, 'Jeu 2');
});

// Câblage.
const page = lire('NEXUS-Tempo-v2.html');
const quarts = lire('NEXUS-Tempo-v2-Quarts.html');
t('lecture seule : aucune écriture ajoutée, lectures filtrées par site', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(page));
  ['view_fdj_price_tier_daily', 'view_fdj_game_daily', 'fdj_games'].forEach(v => {
    const i = page.indexOf("from('" + v + "')"); assert.ok(i > 0, v);
    assert.ok(/\.eq\('site', siteId\)/.test(page.slice(i, i + 300)), v + ' filtré par site');
  });
});
t('câblage : constat sur la carte, fiche, découverte en emplacement 2, repli sur le quart 1', () => {
  assert.ok(/T\.analyseFdj\(/.test(page));
  assert.ok(/constat: afFdj/.test(page));
  assert.ok(/titre: 'Grattage et tirages'/.test(page));
  assert.ok(/remplirDecouverte\(2, \{\s*niveau: 'Fait mesuré'/.test(page));
  assert.ok(/!decouverteFdj && !rFacts\.error/.test(page));
});
t('lien Cockpit présent sur les deux pages, cible identique au menu', () => {
  const app = lire('NEXUS-App-v1.html');
  assert.ok(/NEXUS-Cockpit-v2\.html/.test(app));
  [page, quarts].forEach(h => {
    assert.ok(/Les décisions se prennent dans le <a class="lien-cockpit" href="NEXUS-Cockpit-v2\.html" aria-label="Ouvrir le Cockpit">Cockpit<\/a>\./.test(h));
    assert.ok(/\.lien-cockpit\{[^}]*color:var\(--t-cyan\)[^}]*padding:10px/.test(h));
    assert.ok(/\.lien-cockpit:hover\{text-decoration:underline/.test(h));
    assert.ok(/\.lien-cockpit:focus-visible\{outline/.test(h));
  });
});
process.exit(echecs ? 1 : 0);
