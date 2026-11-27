// Diagnostic du repli carburant (?diag=perf) : les vagues sont tracées, rien ne change sans le rappel.
const assert = require('assert');
const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-boussole-moteur.js'));
require(path.join(__dirname, 'nexus-carburant-moteur.js'));
require(path.join(__dirname, 'nexus-periodes.js'));
require('./outils/fuseau-metier-pour-tests.js').installerAvecFuseau('America/Martinique');
require(path.join(__dirname, 'nexus-carburant-donnees.js'));
const D = global.NexusCarburantDonnees;
const SITE = 'site-test';
const tables = () => ({
  carburant_releves: [], carburant_stock_references: [], carburant_stock_reference_lignes: [],
  station_config: [{ site: SITE, horaires: { quart1: { etendu: '05:45', fin_etendu: '13:45' }, quart2: { etendu: '13:40', fin_etendu: '22:05' } }, fuseau_horaire: 'America/Martinique' }],
  audits_caisse: [], carburant_reception_visites: [], carburant_reception_mesures: [], carburant_reception_visite_lignes: [],
});
(async () => {
  const cands = ['2026-08-26', '2026-08-25'];
  const sans = await D.chargerControlesRepliEnPlage(D.creerClientMemoire(tables()).client, SITE, cands, '2026-08-27', () => false);
  const ev = [];
  const avec = await D.chargerControlesRepliEnPlage(D.creerClientMemoire(tables()).client, SITE, cands, '2026-08-27', () => false, e => ev.push(e));
  assert.deepStrictEqual(avec, sans, 'le diagnostic ne change pas le résultat');
  assert.strictEqual(ev[0].evt, 'candidats'); assert.strictEqual(ev[0].n, 2);
  for (const v of [1, 2, 3]) {
    const deb = ev.find(e => e.vague === v && e.phase === 'debut'), fin = ev.find(e => e.vague === v && e.phase === 'fin');
    assert.ok(deb && fin && fin.t >= deb.t, 'vague ' + v);
  }
  assert.ok('carburant_releves' in ev.find(e => e.vague === 2 && e.phase === 'fin').lignes);
  // Un rappel qui plante ne casse rien.
  await D.chargerControlesRepliEnPlage(D.creerClientMemoire(tables()).client, SITE, cands, '2026-08-27', () => false, () => { throw new Error('x'); });
  console.log('OK test_brief_diag_repli');
})().catch(e => { console.error(e); process.exit(1); });
