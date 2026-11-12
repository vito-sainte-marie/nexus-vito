// Lot D5a : mois contre mois précédent (Piste, FDJ). Fonctions pures, jours complets seulement.
global.window = global; require('./nexus-tempo.js'); const T = window.NexusTempo;
const assert = require('assert'); const fs = require('fs');
let n = 0; const t = (nom, f) => { f(); n++; };
const iso = (a, m, j) => a + '-' + String(m).padStart(2, '0') + '-' + String(j).padStart(2, '0');
// Tous les jours d'un mois, valeur = base (+ 1 le week-end pour garder une dispersion), sauf dates à sauter.
const mois = (a, m, base, saut) => { const out = []; const nb = new Date(Date.UTC(a, m, 0)).getUTCDate();
  for (let j = 1; j <= nb; j++) { const d = iso(a, m, j); if (saut && saut.includes(d)) continue; out.push({ date: d, valeur: base + (j % 7) }); } return out; };

t('mois incomplet exclu : un jour manquant fait passer sous 4 occurrences', () => {
  // Septembre 2026 : 4 jeudis seulement ; on retire le jeudi 3 => 3 occurrences, le mois n'est plus assez fourni.
  const jours = mois(2026, 8, 1000).concat(mois(2026, 9, 1000, [iso(2026, 9, 3)]));
  const r = T.moisParMois(jours, '2026-08-01', '2026-10-15');
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].assez, true);
  assert.strictEqual(r[1].assez, false);
  assert.strictEqual(r[1].evolution, null);
  assert(/pas assez de jours complets/.test(T.phraseMois(r[1])));
});
t('mois en cours exclu', () => {
  const jours = mois(2026, 8, 1000).concat(mois(2026, 9, 1000), mois(2026, 10, 1000));
  const r = T.moisParMois(jours, '2026-08-01', '2026-10-15');
  assert.deepStrictEqual(r.map(x => x.cle), ['2026-08', '2026-09']);
});
t('Piste : juillet 2026 ne compte pas', () => {
  const jours = mois(2026, 7, 1000).concat(mois(2026, 8, 1000), mois(2026, 9, 1000));
  const r = T.moisParMois(jours, T.DEBUT_MOIS_PISTE, '2026-10-15');
  assert.deepStrictEqual(r.map(x => x.cle), ['2026-08', '2026-09']);
  assert.strictEqual(r[0].evolution, null); // pas de juillet à comparer
  assert.notStrictEqual(r[1].evolution, null);
  assert.deepStrictEqual(T.clesMoisEcoules(T.DEBUT_MOIS_FDJ, '2026-11-11').length, 10);
});
t('composition des jours inégale : comparabilité affichée, sans blocage', () => {
  // Août 2026 : 5 samedis, 5 dimanches, 5 lundis ; septembre 2026 : 5 mardis, 5 mercredis.
  const jours = mois(2026, 8, 1000).concat(mois(2026, 9, 1000));
  const r = T.moisParMois(jours, '2026-08-01', '2026-10-15');
  const m = r[1];
  assert.strictEqual(m.cmp.etat, 'ok'); // le calcul n'est pas bloqué
  assert.strictEqual(m.comparabilite.faible, true);
  assert(m.comparabilite.raisons.some(x => x.critere === 'composition' && /inégale/.test(x.texte)));
});
t('écart net : baisse confirmée, tournure au passé', () => {
  const jours = mois(2026, 8, 3000).concat(mois(2026, 9, 1000));
  const m = T.moisParMois(jours, '2026-08-01', '2026-10-15')[1];
  assert.strictEqual(m.evolution, 'Baisse confirmée');
  assert(/^Ce mois a été en baisse nette/.test(T.phraseMois(m)));
});
t('écart faible : variation habituelle', () => {
  const jours = mois(2026, 8, 1000).concat(mois(2026, 9, 1001));
  const m = T.moisParMois(jours, '2026-08-01', '2026-10-15')[1];
  assert.strictEqual(m.evolution, 'Variation habituelle');
});
t('aucune formulation « ce mois est » dans le moteur ni dans la page', () => {
  const src = fs.readFileSync('./nexus-tempo.js', 'utf8') + fs.readFileSync('./NEXUS-Tempo-v2.html', 'utf8');
  assert(!/ce mois est\b/i.test(src));
  const tous = [1, 2, 3, 4].map(k => T.phraseMois({ assez: true, evolution: ['Baisse confirmée', 'Hausse confirmée', 'Variation habituelle', 'Tendance non déterminée'][k - 1] }));
  tous.concat(T.phraseMois(null)).forEach(p => assert(!/ce mois est\b/i.test(p) && /^Ce mois (a|n)/.test(p)));
});
t('moyenne par jour complet, jamais un total comparé', () => {
  const m = T.moisParMois(mois(2026, 8, 1000), '2026-08-01', '2026-10-15')[0];
  assert.strictEqual(m.nbJours, 31);
  assert(Math.abs(m.moyenne - m.total / 31) < 1e-9);
});
t('FDJ : composition grattage / tirages réutilise la règle D3', () => {
  const rows = (a, m, g, ti) => mois(a, m, 0).map(j => ({ date: j.date, nb_quarts_controles: 2, ca_grattage: g + (j.valeur % 3), caisse_tirages: ti + (j.valeur % 2) }));
  const fdj = rows(2026, 8, 3000, 500).concat(rows(2026, 9, 1000, 500));
  const jours = T.joursCaFdjComplets(fdj);
  const r = T.moisParMois(jours, T.DEBUT_MOIS_FDJ, '2026-10-15');
  const m = r[r.length - 1], p = r[r.length - 2];
  assert.strictEqual(m.evolution, 'Baisse confirmée');
  assert(/grattage/.test(T.compositionMoisFdj(fdj, m, p)));
});
t('FDJ disponible depuis janvier 2026 ; Boutique et N-1 : mentions affichées, aucun calcul', () => {
  assert.strictEqual(T.DEBUT_MOIS_FDJ, '2026-01-01');
  const html = fs.readFileSync('./NEXUS-Tempo-v2.html', 'utf8');
  assert(/Mois par mois/.test(html));
  assert(/Pas de comparaison mois par mois pour la boutique/.test(html));
  assert(/année précédente/.test(html));
  assert(!/\(G\d\)/.test(html));
});
console.log(n + ' épreuves');
