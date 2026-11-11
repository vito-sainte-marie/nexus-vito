// Tempo V2 — lot V2, partie 1 : les trois indicateurs (calculs purs + page en lecture seule).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const racine = __dirname;

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const bornes = { debut: '2026-09-15', fin: '2026-11-09' };
const quart = (date, q, g, s, n) => ({ date, quart: q, litrage_gazole: g, litrage_sp95: s, litrage_gnr: n });

t('bornes : 56 jours, jour en cours exclu, en date station (Martinique)', () => {
  // 11/11 02:00 UTC = 10/11 22:00 à Martinique : le jour en cours est le 10.
  const b = T.bornesPeriodeIndicateurs('America/Martinique', new Date('2026-11-11T02:00:00Z'));
  assert.strictEqual(b.exclu, '2026-11-10');
  assert.strictEqual(b.fin, '2026-11-09');
  assert.strictEqual(b.debut, '2026-09-15');
  assert.strictEqual(b.jours, 56);
  // Même instant lu en UTC donnerait le 11 : le fuseau compte.
  const u = T.bornesPeriodeIndicateurs('UTC', new Date('2026-11-11T02:00:00Z'));
  assert.strictEqual(u.exclu, '2026-11-11');
});

t('moyenne et total sur jours retenus', () => {
  const r = T.resumerParJour([10, 20, 30, 40].map((v, i) => ({ date: '2026-10-0' + (i + 1), valeur: v })), bornes);
  assert.strictEqual(r.etat, 'ok');
  assert.strictEqual(r.jours, 4);
  assert.strictEqual(r.total, 100);
  assert.strictEqual(r.moyenne, 25);
});

t('jour en cours et jours hors fenêtre exclus', () => {
  const v = [1, 2, 3, 4].map(i => ({ date: '2026-10-0' + i, valeur: 10 }));
  v.push({ date: '2026-11-10', valeur: 999 }, { date: '2026-09-14', valeur: 999 });
  const r = T.resumerParJour(v, bornes);
  assert.strictEqual(r.jours, 4);
  assert.strictEqual(r.total, 40);
});

t('période vide : absent, aucune moyenne', () => {
  const r = T.resumerParJour([], bornes);
  assert.strictEqual(r.etat, 'absent');
  assert.strictEqual(r.moyenne, null);
  assert.strictEqual(T.resumerParJour(null, bornes).etat, 'absent');
});

t('moins de 4 jours : insuffisant ; 4 jours : ok', () => {
  const mk = n => Array.from({ length: n }, (_, i) => ({ date: '2026-10-0' + (i + 1), valeur: 5 }));
  assert.strictEqual(T.resumerParJour(mk(3), bornes).etat, 'insuffisant');
  assert.strictEqual(T.resumerParJour(mk(4), bornes).etat, 'ok');
  assert.strictEqual(T.OCCURRENCES_MIN_JOUR, 4);
});

t('piste : litres GO + SP95 + GNR, jour complet seulement (Q1 et Q2)', () => {
  const rows = [
    quart('2026-10-01', '1', 100, 50, 10), quart('2026-10-01', '2', 200, 60, 0),
    quart('2026-10-02', '1', 300, 0, 0), // Q2 absent : jour incomplet, écarté
  ];
  const j = T.joursLitresCompletsPiste(rows);
  assert.deepStrictEqual(j, [{ date: '2026-10-01', valeur: 420 }]);
});

t('piste : litrage manquant sur un quart ou total nul : jour écarté', () => {
  const rows = [
    quart('2026-10-01', '1', 100, 50, 10), quart('2026-10-01', '2', null, 60, 0),
    quart('2026-10-02', '1', 0, 0, 0), quart('2026-10-02', '2', 0, 0, 0),
  ];
  assert.deepStrictEqual(T.joursLitresCompletsPiste(rows), []);
});

t('FDJ : CA = grattage + tirages, jour à deux quarts contrôlés seulement', () => {
  const rows = [
    { date: '2026-10-01', nb_quarts_controles: 2, ca_grattage: 1000, caisse_tirages: 250 },
    { date: '2026-10-02', nb_quarts_controles: 1, ca_grattage: 900, caisse_tirages: 10 },
    { date: '2026-10-03', nb_quarts_controles: 2, ca_grattage: 400, caisse_tirages: null },
  ];
  assert.deepStrictEqual(T.joursCaFdjComplets(rows), [
    { date: '2026-10-01', valeur: 1250 }, { date: '2026-10-03', valeur: 400 }]);
});

t('boutique : taux de la période d\'import affichée, produits d\'appel et lignes incohérentes écartés', () => {
  const analyser = rows => ({ periodeAffichage: { debut: '2026-10-01', fin: '2026-10-31' }, rowsAffichage: rows });
  const rows = [
    { article: 'A', ca: 100, marge: 30 },
    { article: 'B', ca: 100, marge: 20 },
    { article: 'APPEL', ca: 500, marge: 5 },   // produit d'appel : exclu
    { article: 'C', ca: 50, marge: 80 },       // marge > ca : écarté
    { article: 'D', ca: 0, marge: 0 },         // ca nul : écarté
  ];
  const r = T.resumerMargeImport(rows, ['APPEL'], analyser);
  assert.strictEqual(r.etat, 'ok');
  assert.strictEqual(r.ca, 200);
  assert.strictEqual(r.marge, 50);
  assert.strictEqual(r.taux, 0.25);
  assert.strictEqual(r.debut, '2026-10-01');
});

t('boutique : aucune période ou aucune ligne propre : absent', () => {
  assert.strictEqual(T.resumerMargeImport([], [], () => ({ periodeAffichage: null, rowsAffichage: [] })).etat, 'absent');
  const r = T.resumerMargeImport([{ article: 'X', ca: 0, marge: 0 }], [], rows => ({ periodeAffichage: { debut: 'a', fin: 'b' }, rowsAffichage: rows }));
  assert.strictEqual(r.etat, 'absent');
});

const html = fs.readFileSync(path.join(racine, 'NEXUS-Tempo-v2.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

t('la page n\'écrit rien : ni insert/update/upsert/delete ni RPC', () => {
  assert.ok(!/\.(insert|update|upsert|delete)\s*\(/.test(scripts));
  assert.ok(!/\.rpc\s*\(/.test(scripts));
});

t('la page lit uniquement les sources annoncées, filtrées par site', () => {
  const tables = [...scripts.matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(tables, ['audits_caisse', 'products', 'produits_appel', 'sites', 'view_fdj_daily_summary', 'view_fdj_shift_facts']);
  const eq = scripts.match(/\.eq\('site', siteId\)/g) || [];
  assert.strictEqual(eq.length, 5); // + view_fdj_shift_facts (sites se lit par site_id)
});

t('jamais d\'horloge UTC : ni aujourdHuiISO ni filtrerJoursClos', () => {
  assert.ok(!/aujourdHuiISO|filtrerJoursClos|toISOString/.test(scripts));
});

t('mentions imposées et lignes G1, G3, G5 présentes', () => {
  for (const s of ["Chiffre d'affaires, pas la marge de la station.", "hors produits d'appel", "Comparaison non disponible",
    'Donnée absente', 'Historique insuffisant', 'Fait mesuré', 'Non qualifié', 'Marge quotidienne non disponible pour cette période', 'Commissions FDJ non renseignées']) {
    assert.ok(html.includes(s), 'manque : ' + s);
  }
  assert.ok(/id="pillComparabilite"\s+hidden/.test(html));
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
