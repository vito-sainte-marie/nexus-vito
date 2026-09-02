// Scénario de non-régression de l'autonomie opérationnelle (02/09/2026).
//
// Le jaugeage d'ouverture tombe à l'intérieur du quart 1 : ce quart chevauche
// donc toujours l'ancre. Avant la ventilation, cela suffisait à annuler
// l'estimation, à laisser `ventes` à null et à faire disparaître la
// couverture par quart ("Calcul par quart indisponible").
'use strict';

const { creerFauxClient } = require('./faux-client-supabase.js');
const { creerContexte } = require('./banc.js');
const S = require('./scenarios-carburant.js');

let echecs = 0;
const verifier = (l, ok) => { console.log(`     ${ok ? '✔' : '✘'} ${l}`); if (!ok) echecs++; };

(async () => {
  const histo = [];
  for (let j = 20; j >= 3; j--) {
    const d = new Date(Date.UTC(2026, 8, 2) - j * 86400000).toISOString().slice(0, 10);
    histo.push({ site: S.SITE, date: d, quart: '1', litrage_sp95: 1400, litrage_gazole: 1200, litrage_gnr: 0 });
    histo.push({ site: S.SITE, date: d, quart: '2', litrage_sp95: 1000, litrage_gazole: 1500, litrage_gnr: 0 });
  }
  const ctx = creerContexte(S.MODULES_ECRAN);
  if (ctx.NexusCarburantsP0Fixes && ctx.NexusCarburantsP0Fixes.installer) ctx.NexusCarburantsP0Fixes.installer();
  const client = creerFauxClient(S.base({ audits_caisse: histo.concat([S.QUART1_01]) }));

  // 10:30 locale — le quart 1 du jour est en cours, aucune ligne saisie
  // pour lui, et il chevauche le jaugeage d'ouverture de 05:55.
  const maintenant = new Date('2026-09-02T14:30:00Z');
  const r = await ctx.NexusCarburantCommandeDonnees.chargerStockEtFiabiliteParCarburant(
    client, S.SITE, '2026-09-02', S.HORAIRES, 'America/Martinique', maintenant);

  console.log('\n### Autonomie — stock estimé malgré le quart 1 à cheval sur le jaugeage');
  ['sp95', 'go'].forEach(cle => {
    const c = r.parCarburant ? r.parCarburant[cle] : null;
    const n = v => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
    console.log(`  ${cle.padEnd(5)} jaugeage ${n(c && c.jaugeageOuvertureL).padStart(7)}`
      + ` · ventes depuis ${n(c && c.ventesDepuisJaugeageL).padStart(6)}`
      + ` (estimées ${n(c && c.ventesEstimeesInclusesL)})`
      + ` · stock estimé ${n(c && c.stockActuelL).padStart(7)}`);
  });

  const sp = r.parCarburant.sp95;
  verifier('un stock estimé maintenant est produit (l’autonomie redevient calculable)', sp.stockActuelL != null);
  verifier('les ventes depuis le jaugeage ne sont plus nulles', sp.ventesDepuisJaugeageL != null);
  verifier('la part estimée est comptée et déclarée', sp.ventesEstimeesInclusesL > 0 && sp.stockEstimeParHistorique === true);
  verifier('le stock estimé reste inférieur au jaugeage d’ouverture (on consomme, on n’invente pas)',
    sp.stockActuelL < sp.jaugeageOuvertureL);

  console.log(`\n${echecs === 0 ? 'Tous les scénarios passent.' : echecs + ' scénario(s) en échec.'}`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
