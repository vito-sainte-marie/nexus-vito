const assert = require('assert');

global.window = global;
require('./nexus-carburant-moteur.js');
require('./nexus-carburant-donnees.js');

const D = global.NexusCarburantDonnees;
const M = global.NexusCarburantMoteur;

function query(table) {
  const f = { eq: {}, lt: {} };
  const q = {
    select() { return q; }, eq(k, v) { f.eq[k] = v; return q; }, neq() { return q; },
    lt(k, v) { f.lt[k] = v; return q; }, lte() { return q; }, gte() { return q; },
    not() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
    maybeSingle() { return Promise.resolve(resolve(true)); },
    then(ok, ko) { return Promise.resolve(resolve(false)).then(ok, ko); },
  };
  function resolve(single) {
    if (table === 'carburant_releves') {
      if (f.eq.date === '2026-09-02') return { data: {
        date: '2026-09-02', origine: 'manager', mesure_le: '2026-09-02T11:00:00Z',
        stock_reel_go_cuve1: 14082, stock_reel_go_cuve2: 7841,
        stock_reel_sp95: 22882, stock_reel_gnr: 4372,
      }, error: null };
      if (f.lt.date === '2026-09-02') return { data: {
        date: '2026-09-01', origine: 'manager', mesure_le: '2026-09-01T10:27:59Z',
        stock_reel_go_cuve1: 2987, stock_reel_go_cuve2: 1595,
        stock_reel_sp95: 8796, stock_reel_gnr: 4373,
      }, error: null };
    }
    if (table === 'carburant_stock_references') return { data: null, error: null };
    if (table === 'station_config') return { data: { fuseau_horaire: 'America/Martinique', horaires: {
      quart1: { etendu: '05:45', fin_etendu: '13:45' },
      quart2: { etendu: '13:40', fin_etendu: '22:05' },
    } }, error: null };
    if (table === 'carburant_reception_visites') return { data: [{
      id: 'liv-1', date_visite: '2026-09-01', heure_fin: '2026-09-01T12:56:42Z', statut: 'validee',
    }], error: null };
    if (table === 'carburant_reception_mesures') return { data: [
      { visite_id: 'liv-1', carburant: 'go', jaugeage_apres_l: 15040, jaugeage_apres_le: '2026-09-01T12:56:42Z' },
      { visite_id: 'liv-1', carburant: 'go', jaugeage_apres_l: 8496, jaugeage_apres_le: '2026-09-01T12:56:42Z' },
      { visite_id: 'liv-1', carburant: 'sp95', jaugeage_apres_l: 25280, jaugeage_apres_le: '2026-09-01T12:56:42Z' },
    ], error: null };
    if (table === 'audits_caisse') return { data: [
      { date: '2026-09-01', quart: '1', litrage_gazole: 1149.83, litrage_sp95: 1379.69, litrage_gnr: 0 },
    ], error: null };
    return { data: single ? null : [], error: null };
  }
  return q;
}

(async () => {
  const client = { from: query };
  const controle = await D.chargerControleJour(client, 'vito-sainte-marie', '2026-09-02', 'America/Martinique');
  assert.strictEqual(controle.parCarburant.go.dernierReel, 23536, 'GO repart du jaugeage post-livraison, cuves sommées');
  assert.strictEqual(controle.parCarburant.sp95.dernierReel, 25280, 'SP95 repart du jaugeage post-livraison');
  ['go', 'sp95'].forEach(cle => {
    const r = controle.parCarburant[cle];
    assert.strictEqual(r.ancreCalculSource, 'reception');
    assert.strictEqual(r.fenetreIsolable, false, 'le Q1 chevauche 08:56 locale');
    assert.strictEqual(r.theorique, null, 'jamais de théorique inventé');
    assert.strictEqual(r.ecart, null, 'jamais de faux écart massif');
    assert.strictEqual(r.statut, 'Données insuffisantes');
  });
  const motif = M.motifTheoriqueIndisponible({
    dernierReleveExiste: true, dernierReel: 23536, releveDuJourExiste: true,
    ventes: null, fenetreIsolable: false, quartsChevauchants: [{ date: '2026-09-01', quart: '1' }],
  });
  assert.ok(motif.includes('ne répartit pas'), motif);

  const actuelles = [
    { date: '2026-08-31', quart: '1', litrage_gazole: 1 },
    { date: '2026-08-31', quart: '2', litrage_gazole: 1 },
    { date: '2026-09-01', quart: '1', litrage_gazole: 1 },
  ];
  const reference = [
    { date: '2026-08-24', quart: '1', litrage_gazole: 10 },
    { date: '2026-08-24', quart: '2', litrage_gazole: 20 },
    { date: '2026-08-25', quart: '1', litrage_gazole: 30 },
    { date: '2026-08-25', quart: '2', litrage_gazole: 999 },
  ];
  const alignes = D.alignerQuartsComparables(actuelles, '2026-08-31', reference, '2026-08-24');
  assert.strictEqual(alignes.length, 3, '3 quarts courants = 3 quarts de référence, jamais 4');
  assert.strictEqual(M.sommerVentesPeriode(alignes).go, 60);
  console.log('OK — ancre post-livraison, faux écarts neutralisés et quarts strictement comparables');
})().catch(e => { console.error(e); process.exitCode = 1; });
