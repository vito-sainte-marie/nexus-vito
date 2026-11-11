// Tempo V2 — lot D2 : marge de la Boutique par catégorie (marges réelles des imports, deux périodes d'import comparables).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-periodes.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const AP = window.NexusPeriodes.analyserPeriodes;
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }

// Périodes hors vacances scolaires : référence 42 jours, étudiée 23 jours.
const REF = ['2026-04-27', '2026-06-07'], ETU = ['2026-06-08', '2026-06-30'];
const jr = (d, f) => (Date.parse(f) - Date.parse(d)) / 86400000 + 1;
// Une ligne d'import = total de la période : on part d'un montant par jour.
function lignes(per, cats) {
  const n = jr(per[0], per[1]);
  return cats.map(([categorie, margeJour, caJour, article]) => ({ article: article || categorie + '-1', categorie, ca: caJour * n, marge: margeJour * n, periode_debut: per[0], periode_fin: per[1] }));
}
const prod = (ref, etu) => lignes(REF, ref).concat(lignes(ETU, etu));

t('cas Sainte-Marie : CA +, marge stable → découverte « décrochage » qui cite Gaz et boissons', () => {
  const a = T.analyseBoutique(prod(
    [['Gaz', 100, 400], ['Boissons', 300, 1000], ['Épicerie', 660, 2200]],
    [['Gaz', 140, 560], ['Boissons', 270, 1000], ['Épicerie', 650, 2400]]), [], AP, []);
  assert.strictEqual(a.etat, 'ok');
  assert.strictEqual(a.global.eligible, false);
  assert.ok(a.global.pctCa > 0.03);
  assert.strictEqual(a.retenue.type, 'decrochage');
  assert.deepStrictEqual(a.retenue.categories.slice().sort(), ['Boissons', 'Gaz']);
  assert.ok(a.candidats.some(c => c.type === 'masquee'), 'la compensation est candidate mais absorbée');
  assert.strictEqual(a.candidats[0].type, 'masquee');
});

t('une seule découverte Boutique : la compensation citée par le décrochage n\'en ouvre pas une autre', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Boissons', 300, 1000]], [['Gaz', 140, 560], ['Boissons', 270, 1100]]), [], AP, []);
  assert.strictEqual(a.retenue.type, 'decrochage');
  assert.ok(/absorb|n'ouvre pas/.test(a.motif));
});

t('compensation cherchée même si la marge globale est stable et le CA aussi', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Boissons', 300, 1000]], [['Gaz', 135, 400], ['Boissons', 265, 1000]]), [], AP, []);
  assert.strictEqual(a.global.eligible, false);
  assert.strictEqual(a.retenue.type, 'masquee');
});

t('variation simple : catégorie dominante au-delà de 50 % de la variation', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Boissons', 300, 1000]], [['Gaz', 190, 500], ['Boissons', 310, 1000]]), [], AP, []);
  assert.strictEqual(a.global.eligible, true);
  assert.strictEqual(a.global.sens, 'hausse');
  assert.strictEqual(a.retenue.type, 'simple');
  assert.strictEqual(a.retenue.categorie, 'Gaz');
});

t('variation simple sans catégorie dominante : pas de catégorie citée', () => {
  const a = T.analyseBoutique(prod([['A', 100, 400], ['B', 100, 400], ['C', 100, 400]], [['A', 125, 400], ['B', 125, 400], ['C', 125, 400]]), [], AP, []);
  assert.strictEqual(a.retenue.type, 'simple');
  assert.ok(!a.retenue.categorie);
});

t('rien à signaler : marge stable, aucun écart de catégorie', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Boissons', 300, 1000]], [['Gaz', 101, 400], ['Boissons', 300, 1000]]), [], AP, []);
  assert.strictEqual(a.etat, 'ok');
  assert.strictEqual(a.global.eligible, false);
  assert.strictEqual(a.retenue, null);
});

t('seuil global : 3 % ou 30 € par jour', () => {
  const faible = T.analyseBoutique(prod([['A', 2000, 6000]], [['A', 2025, 6000]]), [], AP, []);
  assert.strictEqual(faible.global.eligible, false);
  const pct = T.analyseBoutique(prod([['A', 500, 2000]], [['A', 516, 2000]]), [], AP, []);
  assert.strictEqual(pct.global.eligible, true);
  const euros = T.analyseBoutique(prod([['A', 100, 400]], [['A', 131, 400]]), [], AP, []);
  assert.strictEqual(euros.global.eligible, true);
});

t('produits d\'appel exclus de la marge', () => {
  const rows = prod([['Gaz', 100, 400]], [['Gaz', 100, 400]]).concat(lignes(ETU, [['Gaz', 500, 600, 'APPEL']]));
  const a = T.analyseBoutique(rows, ['APPEL'], AP, []);
  assert.ok(Math.abs(a.global.margeE - 100) < 1e-6);
});

t('comparabilité faible : la comparaison est gardée, avec sa raison, et la découverte est produite', () => {
  const a = T.analyseBoutique([].concat(
    lignes(['2026-04-27', '2026-06-07'], [['Gaz', 100, 400]]),
    lignes(['2026-06-08', '2026-07-31'], [['Gaz', 200, 500]])), [], AP,
  [{ date: '2026-06-20', type: 'vacances' }].concat(Array.from({ length: 40 }, (_, i) => ({ date: new Date(Date.parse('2026-06-10') + i * 86400000).toISOString().slice(0, 10), type: 'vacances' }))));
  assert.strictEqual(a.etat, 'ok');
  assert.strictEqual(a.comparabilite.faible, true);
  assert.ok(a.comparabilite.raisons.length > 0 && a.comparabilite.raisons[0].texte);
  assert.ok(a.retenue, 'la découverte est produite malgré la comparabilité faible');
});

t('une seule catégorie à 30 € ou plus, total stable : évolution masquée candidate', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Épicerie', 900, 3000]], [['Gaz', 135, 400], ['Épicerie', 880, 3000]]), [], AP, []);
  assert.strictEqual(a.global.eligible, false);
  assert.ok(a.candidats.some(c => c.type === 'masquee' && c.categories.join() === 'Gaz'));
  assert.strictEqual(a.retenue.type, 'masquee');
});

t('catégorie seule de sens opposé au total éligible : évolution masquée candidate', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Épicerie', 900, 3000]], [['Gaz', 60, 400], ['Épicerie', 1000, 3000]]), [], AP, []);
  assert.strictEqual(a.global.sens, 'hausse');
  assert.ok(a.candidats.some(c => c.type === 'masquee' && c.categories.indexOf('Gaz') >= 0));
});

t('compensation dans les deux sens : les deux catégories sont citées', () => {
  const a = T.analyseBoutique(prod([['Gaz', 100, 400], ['Boissons', 300, 1000]], [['Gaz', 140, 400], ['Boissons', 260, 1000]]), [], AP, []);
  const m = a.candidats.find(c => c.type === 'masquee');
  assert.deepStrictEqual(m.categories.slice().sort(), ['Boissons', 'Gaz']);
});

t('Sainte-Marie : seul Gaz passe le seuil, les baisses sous le seuil ne sont pas citées', () => {
  const a = T.analyseBoutique(prod(
    [['Gaz', 100, 400], ['Bières', 100, 400], ['Sodas', 100, 400], ['Eaux', 100, 400], ['Épicerie', 700, 2300]],
    [['Gaz', 137, 686], ['Bières', 84, 400], ['Sodas', 90, 400], ['Eaux', 94, 400], ['Épicerie', 700, 2300]]), [], AP, []);
  assert.strictEqual(a.global.eligible, false);
  assert.strictEqual(a.retenue.type, 'decrochage');
  assert.deepStrictEqual(a.retenue.categories, ['Gaz']);
  assert.ok(a.categories.filter(c => c.contribution < 0 && !c.candidate).length === 3);
});

t('un seul import : « sans référence »', () => {
  const a = T.analyseBoutique(lignes(ETU, [['Gaz', 100, 400]]), [], AP, []);
  assert.strictEqual(a.etat, 'sans_reference');
});

t('aucun import : « absent »', () => {
  assert.strictEqual(T.analyseBoutique([], [], AP, []).etat, 'absent');
});

t('référence : imports cumulés jusqu\'à couvrir la durée étudiée', () => {
  const rows = [].concat(lignes(['2026-04-27', '2026-05-17'], [['Gaz', 100, 400]]), lignes(['2026-05-18', '2026-06-07'], [['Gaz', 100, 400]]), lignes(ETU, [['Gaz', 100, 400]]));
  const a = T.analyseBoutique(rows, [], AP, []);
  assert.ok(a.reference.jours >= a.etudiee.jours);
  assert.strictEqual(a.reference.periodes.length, 2);
});

t('seuils nommés et réglables, exposés', () => {
  assert.strictEqual(T.SEUIL_CATEGORIE_EUROS_JOUR, 30);
  assert.strictEqual(T.SEUIL_MARGE_GLOBALE_EUROS_JOUR, 30);
  assert.strictEqual(T.SEUIL_MARGE_GLOBALE_PCT, 0.03);
  assert.strictEqual(T.SEUIL_CONCENTRATION_CATEGORIE, 0.5);
});

const html = lire('NEXUS-Tempo-v2.html');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
t('page : étiquettes de la carte Boutique en langage courant, sans code d\'arbitrage', () => {
  ['Marge en hausse', 'Marge en baisse', 'Marge stable', 'Tendance non déterminée'].forEach(x => assert.ok(scripts.includes(x), x));
  assert.ok(!/confirmée/.test(scripts.slice(scripts.indexOf('evolBoutique'), scripts.indexOf('evolBoutique') + 400)));
  const bloc = scripts.slice(scripts.indexOf('Marge par catégorie (lot D2)'), scripts.indexOf('FDJ : chiffre d\'affaires des jeux par jour'));
  assert.ok(!/\bG[0-9]\b/.test(bloc));
  assert.ok(/analyseBoutique\(/.test(bloc));
});
t('page : une seule découverte Boutique, au quatrième rang la relation', () => {
  assert.strictEqual((scripts.match(/remplirDecouverte\(1,/g) || []).length, 1);
  assert.strictEqual((scripts.match(/remplirDecouverte\(3,/g) || []).length, 1);
});
t('page : lecture seule, aucune écriture ajoutée', () => {
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(scripts));
});
console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert'); process.exit(echecs ? 1 : 0);
