// Tempo V2 — lot B : « Le quart 1 vend-il plus que le quart 2 ? » (calculs jour × quart, seuil, page, garde, lecture seule).
const assert = require('assert'), fs = require('fs'), path = require('path');
let echecs = 0;
function t(n, fn) { try { fn(); console.log('  ok   ' + n); } catch (e) { echecs++; console.log('  FAIL ' + n + '\n       ' + e.message); } }
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const bornes = { debut: '2026-09-14', fin: '2026-11-08' };
// lundis : 14/09, 21/09, 28/09, 05/10, 12/10, 19/10 ; mardis : lendemains
const lundis = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'];
const mardis = ['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06'];
const jeu = [];
for (const d of lundis) { jeu.push({ date: d, quart: 1, valeur: 1100 }, { date: d, quart: 2, valeur: 1000 }); }
for (const d of mardis.slice(0, 3)) { jeu.push({ date: d, quart: 1, valeur: 500 }, { date: d, quart: 2, valeur: 1000 }); }

t('ordre lundi → dimanche, sept jours', () => {
  const r = T.comparerQuartsParJour(jeu, bornes);
  assert.deepStrictEqual(r.parJour.map(x => x.nom), ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']);
});
t('écart du lundi : (1100 − 1000) / 1000 = +10 %', () => {
  const l = T.comparerQuartsParJour(jeu, bornes).parJour[0];
  assert.strictEqual(l.q1.effectif, 6); assert.strictEqual(l.q1.moyenne, 1100); assert.strictEqual(l.q2.moyenne, 1000);
  assert.ok(Math.abs(l.ecartPct - 10) < 1e-9);
});
t('seuil de 4 par case : le mardi (3 quarts) n\'a pas d\'écart', () => {
  const r = T.comparerQuartsParJour(jeu, bornes);
  const m = r.parJour[1];
  assert.strictEqual(r.seuil, 4);
  assert.strictEqual(m.q1.effectif, 3); assert.strictEqual(m.q1.suffisant, false); assert.strictEqual(m.ecartPct, null);
});
t('exactement 4 quarts : la case est lisible', () => {
  const j = [];
  for (const d of mardis) j.push({ date: d, quart: 1, valeur: 600 }, { date: d, quart: 2, valeur: 1000 });
  const m = T.comparerQuartsParJour(j, bornes).parJour[1];
  assert.strictEqual(m.q1.suffisant, true); assert.ok(Math.abs(m.ecartPct + 40) < 1e-9);
});
t('jour le plus fort et le plus faible', () => {
  const j = jeu.slice();
  const mercredis = ['2026-09-16', '2026-09-23', '2026-09-30', '2026-10-07'];
  for (const d of mercredis) j.push({ date: d, quart: 1, valeur: 800 }, { date: d, quart: 2, valeur: 1000 });
  const r = T.comparerQuartsParJour(j, bornes);
  assert.strictEqual(r.plusFort.nom, 'lundi'); assert.strictEqual(r.plusFaible.nom, 'mercredi');
  assert.strictEqual(r.joursLisibles, 2); assert.strictEqual(r.etat, 'ok');
});
t('hors période, quart inconnu et valeur non numérique ignorés', () => {
  const r = T.comparerQuartsParJour([{ date: '2026-08-31', quart: 1, valeur: 5 }, { date: '2026-09-14', quart: 3, valeur: 5 }, { date: '2026-09-14', quart: 1, valeur: NaN }], bornes);
  assert.strictEqual(r.etat, 'absent');
});
t('aucune case suffisante : état insuffisant, pas d\'écart', () => {
  const r = T.comparerQuartsParJour(jeu.slice(0, 4), bornes);
  assert.strictEqual(r.etat, 'insuffisant'); assert.strictEqual(r.plusFort, null);
});
t('entrée nulle : absent', () => { assert.strictEqual(T.comparerQuartsParJour(null, bornes).etat, 'absent'); });

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Quarts.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const corps = html.slice(html.indexOf('<body>'));
t('garde manager et message de réserve', () => {
  assert.ok(/nexusRequireAuth\s*\(/.test(scripts) && /nexusEstManager\s*\(/.test(scripts));
  assert.ok(/Cet écran est réservé aux managers\./.test(scripts));
});
t('lecture seule : aucune écriture, aucune RPC ; chaque lecture filtrée par site', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\s*\(/.test(scripts));
  const froms = (scripts.match(/\.from\s*\(/g) || []).length;
  const sites = (scripts.match(/\.eq\('site(?:_id)?', siteId\)/g) || []).length;
  assert.strictEqual(froms, 3); assert.strictEqual(sites, 3);
});
t('aucun repère de gouvernance (G n) dans le script, aucun nom réel', () => {
  assert.ok(!/\(G\d\)/.test(scripts));
  assert.ok(!/nom_employe|employe_nom|prenom/i.test(scripts));
});
t('textes imposés', () => {
  for (const s of ['Le quart 1 vend-il plus que le quart 2 ?', '‹ Tempo', 'Quart 1 contre quart 2', 'Rattachement des tirages au quart à confirmer',
    'Marge par quart non disponible', 'Durée réelle des quarts non connue', 'Transmettre au Cockpit', 'Transmission au Cockpit non ouverte',
    'semaines sur', 'Voir les preuves', 'Hypothèse']) assert.ok(html.includes(s), 'manque : ' + s);
});
t('lien retour vers Tempo et bouton Cockpit désactivé', () => {
  assert.ok(/<a class="retour" href="NEXUS-Tempo-v2\.html">‹ Tempo<\/a>/.test(corps));
  assert.ok(/<button[^>]*id="btnCockpit"[^>]*\bdisabled\b/.test(corps));
});
t('FDJ au niveau Hypothèse, boutique mesurée', () => {
  assert.ok(/ligne\('FDJ', fdj, '€', 'Hypothèse', 'hypothese'\)/.test(scripts));
  assert.ok(/ligne\('Boutique', boutique, '€', 'Fait mesuré', 'mesure'\)/.test(scripts));
});
t('aucun chiffre en dur dans les valeurs, totaux et évolutions', () => {
  for (const m of corps.matchAll(/<div class="(?:valeur|total|evol)"[^>]*>([^<]*)<\/div>/g)) assert.ok(!/\d/.test(m[1]));
});
t('tuile disponible de Tempo : seul lien, sans pastille « En préparation »', () => {
  const tempo = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
  const m = tempo.match(/<a class="tuile croisee disponible" href="NEXUS-Tempo-v2-Quarts\.html">[\s\S]*?<\/a>/);
  assert.ok(m && !/En préparation/.test(m[0]) && /Le quart 1 vend-il plus que le quart 2 \?/.test(m[0]));
});
t('page enregistrée dans les écrans opérationnels de nexus-auth.js', () => {
  assert.ok(fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8').includes("'NEXUS-Tempo-v2-Quarts.html',"));
});

// Journée exceptionnelle : signalée, jamais retirée en silence
const lunDates = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'];
const jeuExc = [];
lunDates.forEach((d, i) => {
  jeuExc.push({ date: d, quart: '1', valeur: [1100, 1120, 1080, 5000, 1110, 1090, 1130, 1070][i] });
  jeuExc.push({ date: d, quart: '2', valeur: 1000 + i * 5 });
});
t('exceptionsParJourSemaine signale la date et donne l\'écart avec et sans elle', () => {
  const r = T.exceptionsParJourSemaine(jeuExc, bornes);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].nom, 'lundi');
  assert.deepStrictEqual(r[0].exceptionnels.map(x => x.date), ['2026-10-05']);
  assert.ok(r[0].ecartAvec > 50 && r[0].ecartSans < 10);
});
t('exceptionsParJourSemaine : rien à signaler sur un jeu régulier', () => {
  assert.deepStrictEqual(T.exceptionsParJourSemaine(jeu, bornes), []);
});
t('page : boutique et FDJ jour par jour, barres Q1/Q2, journée exceptionnelle, constance x sur y, preuves complètes', () => {
  assert.ok(/id="corpsBoutiqueJours"/.test(html) && /id="corpsFdjJours"/.test(html));
  assert.ok(/comparerQuartsParJour\(boutique, bornes\)/.test(scripts) && /comparerQuartsParJour\(fdj, bornes\)/.test(scripts));
  assert.ok(/class="barre /.test(scripts) && /\.barre\.q2\{opacity:\.45/.test(html));
  assert.ok(/exceptionsParJourSemaine\(/.test(scripts) && /sans elle/.test(scripts) && /non retirée/.test(scripts));
  assert.ok(/semaines sur/.test(scripts) && /id="constanceBoutique"/.test(html));
  assert.ok(/somme par quart ÷ nombre de quarts, par jour de la semaine/.test(scripts));
  assert.ok(/Verify/.test(scripts) && /NEXUS FDJ/.test(scripts));
});
console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
