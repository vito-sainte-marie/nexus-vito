// B0-perf-4a : les diagnostics ?diag=perf du repli carburant ne changent AUCUN résultat
// et n'apparaissent que sous ?diag=perf.
const assert = require('assert');
const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-boussole-moteur.js'));
require(path.join(__dirname, 'nexus-carburant-moteur.js'));
require(path.join(__dirname, 'nexus-periodes.js'));
require('./outils/fuseau-metier-pour-tests.js').installerAvecFuseau('America/Martinique');
require(path.join(__dirname, 'nexus-carburant-donnees.js'));
const M = global.NexusCarburantMoteur, P = global.NexusPeriodes, D = global.NexusCarburantDonnees;

const AUJ = '2026-08-27', SITE = 'site-test';
const jour = n => P.ajouterJours(AUJ, -n);
const MAINTENANT = new Date('2026-08-27T15:00:00.000Z').getTime();
const DateReelle = Date;
global.Date = class extends DateReelle {
  constructor(...a) { if (a.length === 0) super(MAINTENANT); else super(...a); }
  static now() { return MAINTENANT; }
};
const estComplet = c => M.jourCarburantEstComplet(c.parCarburant, c.aucunReleve);
const releve = date => ({ site: SITE, date, origine: 'jaugeage', mesure_le: `${date}T10:00:00+00:00`,
  stock_reel_go_cuve1: 1000, stock_reel_go_cuve2: 1000, stock_reel_sp95: 2000, stock_reel_gnr: 500,
  livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0 });
const audit = date => ({ site: SITE, date, quart: 'quart1', litrage_gazole: 100, litrage_sp95: 100, litrage_gnr: 100 });
function tables() {
  const t = {
    carburant_releves: [], carburant_stock_references: [], carburant_stock_reference_lignes: [],
    station_config: [{ site: SITE, horaires: { quart1: { etendu: '05:45', fin_etendu: '13:45' }, quart2: { etendu: '13:40', fin_etendu: '22:05' } }, fuseau_horaire: 'America/Martinique' }],
    audits_caisse: [], carburant_reception_visites: [], carburant_reception_mesures: [], carburant_reception_visite_lignes: [],
  };
  [8, 7, 6, 5, 4, 3, 2, 1].forEach(n => { t.carburant_releves.push(releve(jour(n))); t.audits_caisse.push(audit(jour(n))); });
  return t;
}
const CANDIDATS = Array.from({ length: 6 }, (_, i) => jour(i));

async function lancer(diag) {
  global.location = { search: diag ? '?diag=perf' : '' };
  delete global.__diagRepli;
  const logs = [];
  const info = console.info;
  console.info = (...a) => logs.push(a.join(' '));
  try {
    const m = D.creerClientMemoire(tables());
    const r = await D.chargerControlesRepliEnPlage(m.client, SITE, CANDIDATS, AUJ, estComplet);
    return { r: JSON.parse(JSON.stringify(r)), logs, diag: global.__diagRepli };
  } finally { console.info = info; }
}

(async () => {
  const sans = await lancer(false), avec = await lancer(true);
  assert.deepStrictEqual(avec.r, sans.r, 'résultat identique avec et sans diag');
  assert.strictEqual(sans.logs.filter(l => l.includes('[diag perf]')).length, 0, 'aucun log sans diag');
  assert.strictEqual(sans.diag, undefined, 'pas de __diagRepli sans diag');
  assert.ok(avec.diag, '__diagRepli sous diag');
  assert.strictEqual(avec.diag.candidats, CANDIDATS.length, 'nombre de candidats');
  const noms = avec.diag.vagues.map(v => v.vague);
  ['vague 1', 'vague 2', 'vague 3'].forEach(n => assert.ok(noms.includes(n), n));
  avec.diag.vagues.forEach(v => assert.ok(typeof v.debut === 'number' && v.fin >= v.debut, 'bornes ' + v.vague));
  ['carburant_releves', 'audits_caisse'].forEach(k => assert.ok(k in avec.diag.lignes, 'lignes ' + k));
  assert.ok(avec.diag.lignes.carburant_releves > 0, 'lignes relevés comptées');
  assert.ok(avec.logs.some(l => l.includes('[diag perf] repli en plage')), 'log de plage');
  console.log('ok  diagnostics repli : neutres, présents seulement sous ?diag=perf');
})().catch(e => { console.error(e); process.exit(1); });
