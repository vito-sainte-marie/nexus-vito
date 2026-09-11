// Scénarios Carburant — rejouent la chaîne de contrôle sur des situations
// contrôlées, dont la situation réelle du 02/09/2026 signalée par Frédéric
// (« un écart énorme et positif, quasiment la livraison reçue la veille »).
'use strict';

const assert = require('assert');
const { creerFauxClient } = require('./faux-client-supabase.js');
const { creerContexte, formaterControle } = require('./banc.js');

const SITE = 'vito-sainte-marie';
const HORAIRES = {
  quart1: { normal: '05:45', etendu: '05:45', fin_normal: '12:45', fin_etendu: '13:45' },
  quart2: { normal: '12:40', etendu: '13:40', fin_normal: '20:05', fin_etendu: '22:05' },
};

// --- Données réelles du 01-02/09/2026 (lues en base le 02/09) -------------
const RELEVE_01 = {
  id: 'r-01', site: SITE, date: '2026-09-01', version_num: 1, origine: 'manager',
  stock_reel_sp95: 8796, stock_reel_go_cuve1: 2987, stock_reel_go_cuve2: 1595, stock_reel_gnr: 4373,
  livraison_sp95: 0, livraison_go: 0, livraison_gnr: 0,
  mouvement_sp95: 0, mouvement_go: 0, mouvement_gnr: 0,
  mesure_le: '2026-09-01T10:27:00Z', created_at: '2026-09-01T10:28:00Z', controle_statut: 'ok',
};
const RELEVE_02 = {
  id: 'r-02', site: SITE, date: '2026-09-02', version_num: 2, origine: 'manager',
  stock_reel_sp95: 22882, stock_reel_go_cuve1: 14082, stock_reel_go_cuve2: 7841, stock_reel_gnr: 4372,
  livraison_sp95: 0, livraison_go: 0, livraison_gnr: 0,
  mouvement_sp95: 0, mouvement_go: 0, mouvement_gnr: 0,
  mesure_le: '2026-09-02T09:55:00Z', created_at: '2026-09-02T09:55:00Z', controle_statut: 'en_attente',
};
const POINT_ZERO = {
  id: 'pz-1', site: SITE, date: '2026-09-01', heure: null, type: 'initialisation',
  statut: 'actif', source: 'veeder_root', motif: 'controle_physique',
  created_at: '2026-09-01T10:30:00Z',
};
const POINT_ZERO_LIGNES = [
  { reference_id: 'pz-1', site: SITE, carburant: 'sp95', stock_reel: 8796 },
  { reference_id: 'pz-1', site: SITE, carburant: 'go', stock_reel: 4582 },
  { reference_id: 'pz-1', site: SITE, carburant: 'gnr', stock_reel: 4373 },
];
const VISITE = {
  id: 'v-1', site: SITE, date_visite: '2026-09-01', statut: 'terminee',
  heure_debut: '2026-09-01T12:23:00Z', heure_fin: '2026-09-01T12:56:00Z',
  bon_livraison_reference: 'BL81100558', nombre_compartiments: 6,
};
const MESURES = [
  { visite_id: 'v-1', site: SITE, carburant: 'go',   cuve_id: 'cuve1', jaugeage_avant_l: 2574, jaugeage_apres_l: 15040, delta_mesure_l: 12466, jaugeage_apres_le: '2026-09-01T12:56:00Z' },
  { visite_id: 'v-1', site: SITE, carburant: 'go',   cuve_id: 'cuve2', jaugeage_avant_l: 1505, jaugeage_apres_l: 8496,  delta_mesure_l: 6991,  jaugeage_apres_le: '2026-09-01T12:56:00Z' },
  { visite_id: 'v-1', site: SITE, carburant: 'sp95', cuve_id: 'unique', jaugeage_avant_l: 8298, jaugeage_apres_l: 25280, delta_mesure_l: 16982, jaugeage_apres_le: '2026-09-01T12:56:00Z' },
];
const QUART1_01 = { site: SITE, date: '2026-09-01', quart: '1', litrage_sp95: 1379.69, litrage_gazole: 1149.83, litrage_gnr: 0 };
const QUART2_01 = { site: SITE, date: '2026-09-01', quart: '2', litrage_sp95: 1018,    litrage_gazole: 1465,    litrage_gnr: 0 };

const CONFIG = [{ site: SITE, fuseau_horaire: 'America/Martinique', horaires: HORAIRES }];

const MODULES_BASE = ['nexus-carburant-moteur.js', 'nexus-carburant-donnees.js'];
const MODULES_ECRAN = MODULES_BASE.concat([
  'nexus-carburant-commande-moteur.js',
  'nexus-carburant-commande-donnees-core.js',
  'nexus-carburants-p0-fixes.js',
]);

function base(extra) {
  return Object.assign({
    carburant_releves: [RELEVE_01, RELEVE_02],
    carburant_stock_references: [POINT_ZERO],
    carburant_stock_reference_lignes: POINT_ZERO_LIGNES,
    carburant_reception_visites: [VISITE],
    carburant_reception_mesures: MESURES,
    audits_caisse: [QUART1_01],
    station_config: CONFIG,
  }, extra || {});
}

async function executer(nom, tables, modules) {
  const ctx = creerContexte(modules || MODULES_BASE);
  if (ctx.NexusCarburantsP0Fixes && typeof ctx.NexusCarburantsP0Fixes.installer === 'function') {
    ctx.NexusCarburantsP0Fixes.installer();
  }
  const client = creerFauxClient(tables);
  const res = await ctx.NexusCarburantDonnees.chargerControleJour(client, SITE, '2026-09-02', 'America/Martinique');
  console.log(`\n### ${nom}`);
  console.log(formaterControle(res));
  return res;
}

module.exports = {
  SITE, HORAIRES, RELEVE_01, RELEVE_02, POINT_ZERO, POINT_ZERO_LIGNES,
  VISITE, MESURES, QUART1_01, QUART2_01, CONFIG,
  MODULES_BASE, MODULES_ECRAN, base, executer,
};
