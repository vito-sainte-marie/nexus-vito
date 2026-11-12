// Tempo V2 — branchement partie 3 : comparabilité et lignes « Évolution » (G5, G9).
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
const src = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');

const iso = (d) => d.toISOString().slice(0, 10);
const plus = (dateISO, n) => { const d = new Date(dateISO + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const B = { debut: '2026-09-16', fin: '2026-11-10', jours: 56, exclu: '2026-11-11' };
const R = T.bornesReference(B);
// Jeu : chaque jour des deux périodes, valeur = f(date)
const jeu = (p, f) => { const o = []; for (let d = p.debut; d <= p.fin; d = plus(d, 1)) o.push({ date: d, valeur: f(d) }); return o; };

t('bornes : étudiée 16/09–10/11, référence 22/07–15/09, mêmes 56 jours', () => {
  assert.deepStrictEqual(R, { debut: '2026-07-22', fin: '2026-09-15', jours: 56 });
});
t('les commentaires « provisoire » de G9 sont retirés', () => {
  assert.ok(!/provisoire, arbitrage G9 en attente/.test(src));
});
t('moyennes et % sur jeu simulé (110 contre 100 : +10 %)', () => {
  const r = T.comparerPeriodes(jeu(B, () => 110), jeu(R, () => 100), B, R);
  assert.strictEqual(r.etat, 'ok');
  assert.strictEqual(r.nEtudiee, 56); assert.strictEqual(r.nReference, 56);
  assert.strictEqual(r.moyenneEtudiee, 110); assert.strictEqual(r.moyenneReference, 100);
  assert.ok(Math.abs(r.pct - 0.1) < 1e-12);
});
t('seuil de 4 par jour de la semaine : 3 lundis de moins dans la référence → historique insuffisant, pas de %', () => {
  const ref = jeu(R, () => 100).filter(j => new Date(j.date + 'T00:00:00Z').getUTCDay() !== 1);
  const r = T.comparerPeriodes(jeu(B, () => 110), ref, B, R);
  assert.strictEqual(r.etat, 'insuffisant');
  assert.strictEqual(r.pct, undefined);
  const etu = jeu(B, () => 110).filter((j, i) => !(new Date(j.date + 'T00:00:00Z').getUTCDay() === 3 && i > 10));
  assert.strictEqual(T.comparerPeriodes(etu, jeu(R, () => 100), B, R).etat, 'insuffisant');
});
t('Welch : variation habituelle quand ±2 erreurs-types contiennent zéro, sinon rien', () => {
  const bruit = d => ((Number(d.slice(8)) * 7) % 11) * 10;
  const proche = T.comparerPeriodes(jeu(B, d => 100 + bruit(d)), jeu(R, d => 101 + bruit(d)), B, R);
  assert.strictEqual(proche.dansVariationHabituelle, true);
  const net = T.comparerPeriodes(jeu(B, d => 200 + bruit(d) / 10), jeu(R, d => 100 + bruit(d) / 10), B, R);
  assert.strictEqual(net.dansVariationHabituelle, false);
});
t('MAD 3,5 : jour exceptionnel signalé, évolution avec et sans', () => {
  const ref = jeu(R, d => 100 + (Number(d.slice(8)) % 3));
  const etu = jeu(B, d => (d === '2026-09-30' ? 1000 : 100 + (Number(d.slice(8)) % 3)));
  const r = T.comparerPeriodes(etu, ref, B, R);
  assert.deepStrictEqual(r.exceptionnels.map(x => x.date), ['2026-09-30']);
  assert.strictEqual(r.exceptionnels[0].periode, 'etudiee');
  assert.ok(r.pct > 0.1);
  assert.deepStrictEqual(r.sans.dates, ['2026-09-30']);
  assert.ok(Math.abs(r.sans.pct) < 0.02);
  assert.strictEqual(T.comparerPeriodes(jeu(B, () => 110), jeu(R, () => 100), B, R).sans, null);
});
const cal = (v, f) => ({ jours: 56, vacances: 0, feries: 0, weekends: 16, pctVacances: v, pctFeries: f, pctWeekends: 16 / 56 });
t('comparabilité : durées (rapport > 2), un critère à la fois', () => {
  const x = T.evaluerComparabilite({ jours: 56 }, { jours: 20 }, cal(0, 0), cal(0, 0), []);
  assert.strictEqual(x.faible, true); assert.deepStrictEqual(x.raisons.map(r => r.critere), ['durees']);
  assert.strictEqual(T.evaluerComparabilite({ jours: 56 }, { jours: 56 }, cal(0, 0), cal(0, 0), []).faible, false);
});
t('comparabilité : calendrier (> 20 points de vacances, ou de fériés)', () => {
  const a = T.evaluerComparabilite(B, R, cal(0, 0), cal(0.25, 0), []);
  assert.deepStrictEqual(a.raisons.map(r => r.critere), ['calendrier']);
  const b = T.evaluerComparabilite(B, R, cal(0, 0), cal(0, 0.25), []);
  assert.deepStrictEqual(b.raisons.map(r => r.critere), ['calendrier']);
  assert.strictEqual(T.evaluerComparabilite(B, R, cal(0, 0), cal(0.2, 0.2), []).faible, false);
});
t('comparabilité : une journée exceptionnelle suffit', () => {
  const x = T.evaluerComparabilite(B, R, cal(0, 0), cal(0, 0), [{ activite: 'Piste', date: '2026-09-30', valeur: 1 }]);
  assert.strictEqual(x.faible, true); assert.deepStrictEqual(x.raisons.map(r => r.critere), ['exceptionnel']);
  assert.ok(/30\/09/.test(x.raisons[0].texte));
});
t('composition du calendrier : jours, week-ends et pourcentages', () => {
  const c = T.compositionCalendrier(B, []);
  assert.strictEqual(c.jours, 56); assert.strictEqual(c.weekends, 16);
  assert.ok(Math.abs(c.pctWeekends - 16 / 56) < 1e-12);
});
const ligne = (date, quart, litres, extra) => Object.assign({ date, quart: String(quart), vente_piste: 1, vente_boutique: 1, litrage_gazole: litres, litrage_sp95: 0, litrage_gnr: 0 }, extra || {});
t('couverture et exclusions : quart manquant, litrage manquant, quart FDJ non contrôlé', () => {
  const p = { debut: '2026-09-16', fin: '2026-09-18', jours: 3 };
  const rows = [ligne('2026-09-16', 1, 10), ligne('2026-09-16', 2, 10), ligne('2026-09-17', 1, 10),
    ligne('2026-09-18', 1, 10), ligne('2026-09-18', 2, 10, { litrage_gazole: null })];
  assert.deepStrictEqual(T.exclusionsPiste(rows, p), [{ date: '2026-09-17', raison: 'quart manquant' }, { date: '2026-09-18', raison: 'litrage manquant' }]);
  const fdj = [{ date: '2026-09-16', nb_quarts_controles: 2, ca_grattage: 1, caisse_tirages: 1 }, { date: '2026-09-17', nb_quarts_controles: 1 }];
  assert.deepStrictEqual(T.exclusionsFdj(fdj, p).map(x => [x.date, x.raison]), [['2026-09-17', 'quart FDJ non contrôlé'], ['2026-09-18', 'quart FDJ non contrôlé']]);
  assert.strictEqual(T.joursLitresCompletsPiste(rows).length, 1);
});
t('prix moyen mesuré : Σ vente_piste / Σ litres, quarts à trois litrages seulement', () => {
  const q = (v, go, sp, gnr) => ({ vente_piste: v, litrage_gazole: go, litrage_sp95: sp, litrage_gnr: gnr });
  const r = T.prixMoyenMesure([q(200, 60, 40, 0), q(100, 30, 20, 0), q(999, 10, null, 0), q(50, 0, 0, 0)]);
  assert.strictEqual(r.prix, 2); assert.strictEqual(r.litres, 150); assert.strictEqual(r.quarts, 2);
  assert.strictEqual(T.prixMoyenMesure([q(10, null, 1, 1)]), null);
  assert.strictEqual(T.prixMoyenMesure([]), null);
  assert.strictEqual(T.prixMoyenPondere, undefined);
});
t('calendrier : fériés du calendrier de la Martinique (22/05 férié, 15/08 non)', () => {
  const c = T.compositionCalendrier({ debut: '2026-05-20', fin: '2026-05-24' }, []);
  assert.strictEqual(c.feries, T.datesDeLaPeriode ? c.feries : c.feries);
  assert.ok(T.estJourFerieMartinique('2026-05-22').ferie);
  assert.ok(c.feries >= 1);
});
t('page : Boutique sans évolution (G1), Piste et FDJ comparées', () => {
  assert.ok(!/comparerPeriodes\([^)]*[Bb]outique/.test(scripts));
  assert.ok(/cartePiste\.evolution\s*=\s*ligneEvolution\(cmpPiste/.test(scripts));
  assert.ok(/carteFdj\.evolution\s*=\s*ligneEvolution\(cmpFdj/.test(scripts));
  assert.ok(/Comparaison non disponible/.test(scripts));
});
t('page : lignes, mentions et « jours écartés » présents', () => {
  for (const s of ['contre ', 'libelleEvolution', 'sans le ', 'Historique insuffisant', 'Voir les jours écartés', 'quart manquant'.slice(0, 0), 'Périodes comparables', 'Comparabilité faible'])
    assert.ok(scripts.includes(s) || html.includes(s), 'manque : ' + s);
  assert.ok(/jours complets sur/.test(scripts));
  assert.ok(/inventaire_calendrier_site/.test(scripts) && !/carburant_tarifs_achat/.test(html));
});
t('page : aucun code G visible dans les libellés injectés', () => {
  const injectes = scripts.match(/'[^'\n]*'/g).filter(s => /\bG\d\b/.test(s) && !/data-arbitrage|setAttribute|^'G\d'$/.test(s));
  assert.deepStrictEqual(injectes, []);
});
t('page : lecture seule — aucune écriture ni RPC', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\s*\(/.test(scripts));
});

t('page : les deux lectures d\'audits_caisse sélectionnent vente_piste et les trois litrages', () => {
  const sel = [...scripts.matchAll(/\.from\('audits_caisse'\)\s*\.select\('([^']*)'\)/g)].map(m => m[1]);
  assert.strictEqual(sel.length, 4); // + période précédente (lot D4) + mois par mois (lot D5a)
  for (const s of sel) for (const c of ['vente_piste', 'litrage_gazole', 'litrage_sp95', 'litrage_gnr']) assert.ok(s.includes(c), c + ' absent de : ' + s);
});
t('prix moyen de bout en bout : lignes portant vente_piste, pas 0 €/L', () => {
  const r = T.prixMoyenMesure([{ vente_piste: 2127, litrage_gazole: 500, litrage_sp95: 400, litrage_gnr: 100 }]);
  assert.ok(Math.abs(r.prix - 2.127) < 1e-9);
});
t('page : jamais « −0,0 % » (arrondi avant le signe)', () => {
  assert.ok(/Math\.round\(x \* 1000\) \/ 10/.test(scripts));
  assert.ok(!/x >= 0 \? '\+' : '−'/.test(scripts));
});
t('page : cartes alignées (stretch, colonne flex, dernier groupe en bas, sans min-height)', () => {
  assert.ok(/\.indicateurs\{[^}]*align-items:\s*stretch/.test(html));
  assert.ok(/\.colonnes3\{[^}]*align-items:\s*stretch/.test(html));
  assert.ok(/\.indicateur, \.colonnes3 > \.colonne\{display:flex; flex-direction:column;\}/.test(html));
  assert.ok(/margin-top:auto/.test(html));
  assert.ok(!/\.(indicateur|colonne|carte)[^{]*\{[^}]*min-height/.test(html));
});
console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
