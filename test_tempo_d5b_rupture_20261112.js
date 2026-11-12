// Lot D5b : rupture de tendance et découvertes historiques dans le sélecteur.
global.window = global; require('./nexus-tempo.js'); const T = window.NexusTempo;
const assert = require('assert');
const FIN = '2026-11-08'; // dimanche
function jours(nbSem, f) { const out = []; for (let i = nbSem * 7 - 1; i >= 0; i--) { const d = new Date(Date.parse(FIN + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10); out.push({ date: d, valeur: f(Math.floor((nbSem * 7 - 1 - i) / 7), i) }); } return out; }
const bruit = i => (i % 3) - 1; // ±1
let n = 0; const ok = t => { n++; console.log('ok', t); };

// 1. Trois semaines du même côté seulement : pas de rupture.
let j = jours(12, (w, i) => 100 + bruit(i) + (w >= 9 ? 40 : 0)); // 3 dernières semaines hautes (w 9..11)
let r = T.ruptureTendance(j, FIN);
assert.strictEqual(r.etat, 'ok'); assert.strictEqual(r.rupture, false); ok('3 semaines du même côté : pas de rupture');

// 2. Quatre semaines du même côté mais écart pas net : pas de rupture.
j = jours(12, (w, i) => 100 + [-30, 30, -30, 30, -30, 30, 0][i % 7] + (w >= 8 ? 2 : 0));
r = T.ruptureTendance(j, FIN);
assert.strictEqual(r.etat, 'ok'); assert.strictEqual(r.memeCote, true); assert.strictEqual(r.nette, false); assert.strictEqual(r.rupture, false); ok('4 semaines, écart pas net : pas de rupture');

// 3. Moins de 12 semaines : non évaluable.
r = T.ruptureTendance(jours(11, () => 100), FIN);
assert.strictEqual(r.etat, 'non_evaluable'); assert.strictEqual(r.rupture, false); ok('historique < 12 semaines : non évaluable');

// Contrôle positif : une vraie rupture est vue et nommée au passé.
j = jours(12, (w, i) => 100 + bruit(i) + (w >= 8 ? 40 : 0));
r = T.ruptureTendance(j, FIN);
assert.strictEqual(r.rupture, true); assert.strictEqual(r.sens, 1);
assert(/^Changement durable depuis le \d\d\/\d\d/.test(T.phraseRupture(r, 'L')));

// 4. Aucune place libre : la découverte historique figure parmi les non retenues.
const c = (activite, rang) => ({ etat: 'ok', motif: null, candidats: [{ activite, type: 'variation', cle: 'x', sens: 1, rang, net: true, source: {} }] });
const entrees = { piste: c('piste', 2), boutique: c('boutique', 2), fdj: c('fdj', 2), croise: { etat: 'ok', candidats: [] },
  historique: T.candidatsHistoriques({ piste: { rupture: r, mois: null } }) };
const choix = T.selectionnerDecouvertes(entrees, {}, 3);
assert.strictEqual(choix.length, 3); assert(!choix.some(x => x.historique));
const ec = T.decouvertesEcartees(entrees, choix);
assert(ec.some(x => x === 'Piste : changement durable'), JSON.stringify(ec)); ok('plus de place : historique nommée parmi les non retenues');
// Et s'il reste une place, elle entre.
const e2 = Object.assign({}, entrees, { boutique: { etat: 'ok', candidats: [] }, fdj: { etat: 'ok', candidats: [] } });
assert(T.selectionnerDecouvertes(e2, {}, 3).some(x => x.historique)); ok('une place libre : historique retenue');
console.log(n + ' épreuves');
