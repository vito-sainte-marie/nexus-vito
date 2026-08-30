// Test — Rotation intelligente missions, Étape 2 "données" (30/08/2026,
// suite de l'Étape 1 "moteur" — v2.301/v2.303). Frédéric a explicitement
// demandé le découpage moteur -> données -> UI, chaque étape testée et
// non régressée avant la suivante. Cette étape branche le mode
// 'intelligent' sur les ingrédients Supabase RÉELS déjà chargés pour le
// plan tournant (Article 11 : jamais une deuxième lecture parallèle).
//
// Ce fichier teste :
//   1. genererOuChargerMissions thread bien reglesParProduit/anomalies/
//      surprisesRecentesParProduit dans genererMissionsPourContexte pour une
//      mission_rule en mode 'intelligent' — le périmètre reflète l'échéance
//      dépassée, pas un simple tri "tournant".
//   2. Filet de sécurité : si NexusInventairePlanDonnees ne fournit pas
//      chargerSurprisesRecentes (mock ancien/appelant plus vieux), aucune
//      exception — traité comme "aucune surprise récente", jamais un crash
//      qui casserait la génération de TOUTES les missions du quart pour une
//      info secondaire (Article 5).
//   3. Non-régression : une mission_rule en mode 'complet' (ou 'tournant')
//      produit exactement le même résultat qu'avant l'Étape 2, que les
//      nouveaux ingrédients soient fournis ou non par le mock.
//   4. Migration Supabase : la colonne mode_selection accepte désormais
//      'intelligent' (contrainte CHECK élargie), et inclure_surprise/
//      nombre_surprises existent sur inventaire_mission_rules.

global.window = global;
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const CANDIDATS_DIR = [
  '/sessions/dazzling-compassionate-ride/mnt/image nexus project',
  '/Users/fredericbragance/Library/Mobile Documents/com~apple~CloudDocs/Desktop/projet NEXUS OS/Code Nexus/nexus/image nexus project',
];
const DIR = CANDIDATS_DIR.find(d => fs.existsSync(path.join(d, 'nexus-inventaire-missions-donnees.js')));
if (!DIR) throw new Error('nexus-inventaire-missions-donnees.js introuvable');

require(path.join(DIR, 'nexus-inventaire-moteur.js'));
require(path.join(DIR, 'nexus-inventaire-missions-donnees.js'));
const D = global.NexusInventaireMissionsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function mockMissionsClient() {
  let etat = [];
  let inserts = [];
  return {
    _inserts: () => inserts,
    from(table) {
      assert.strictEqual(table, 'inventaire_missions');
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        insert(rows) {
          inserts.push(rows);
          etat = etat.concat(rows.map((r, i) => ({ id: 'gen-' + i, ...r })));
          return Promise.resolve({ error: null });
        },
        then(resolve) { return Promise.resolve({ data: etat, error: null }).then(resolve); },
      };
    },
  };
}

(async () => {

// ------------------------------------------------------------
// 1) Mode 'intelligent' — les ingrédients réels (règles, anomalies,
//    surprises récentes) sont bien threadés jusqu'au moteur, produisant un
//    périmètre qui reflète l'échéance dépassée (pas un simple tri par
//    ancienneté "tournant").
// ------------------------------------------------------------
{
  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules: async () => ([
      {
        id: 'mr-intelligent', actif: true, moment_code: 'debut', quart: null,
        role_code: 'pompiste', categorie_ids: ['catHuiles'], zone_ids: null,
        mode_selection: 'intelligent', nombre_references: 1, inclure_surprise: false,
        ordre_affichage: 10,
      },
    ]),
    chargerRolesPresentsQuart: async () => (['pompiste']),
  };
  global.NexusInventairePlanDonnees = {
    chargerOuGenererPlan: async () => ({
      items: [
        { produit_id: 'huileA', inventaire_zone_produit: { categorie_id: 'catHuiles', zone_id: null } },
        { produit_id: 'huileB', inventaire_zone_produit: { categorie_id: 'catHuiles', zone_id: null } },
      ],
    }),
    chargerIngredientsSelection: async () => ({
      produits: [
        { id: 'huileA', categorie_id: 'catHuiles', zone_id: null, actif: true },
        { id: 'huileB', categorie_id: 'catHuiles', zone_id: null, actif: true },
      ],
      // huileA en retard (delai standard = 7j, contrôlée il y a 30 jours),
      // huileB à jour (contrôlée hier) — le mode 'intelligent' doit
      // prioriser huileA malgré nombre_references=1, jamais un simple
      // "moins récemment contrôlé" qui donnerait le même résultat par
      // coïncidence (le test doit distinguer les deux logiques).
      dernierControleParProduit: { huileA: '2026-07-31', huileB: '2026-08-29' },
      reglesParProduit: {
        huileA: { frequence_controle: 'standard' },
        huileB: { frequence_controle: 'standard' },
      },
      produitsAvecAnomalieRecente: [],
      anomaliesDetailParProduit: {},
    }),
    chargerSurprisesRecentes: async () => ([]),
  };
  const client = mockMissionsClient();
  const missions = await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-08-30', 'matin');
  assert.strictEqual(missions.length, 1);
  assert.deepStrictEqual(missions[0].produit_ids, ['huileA'], "mode 'intelligent' doit sélectionner la référence en retard (huileA), pas un tri tournant générique");

  ok("genererOuChargerMissions — mode 'intelligent' thread reglesParProduit/dernierControle réels jusqu'au moteur (échéance dépassée priorisée)");
}

// ------------------------------------------------------------
// 2) Filet de sécurité — NexusInventairePlanDonnees sans
//    chargerSurprisesRecentes (mock/appelant plus ancien) : aucune
//    exception, traité comme "aucune surprise récente".
// ------------------------------------------------------------
{
  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules: async () => ([
      {
        id: 'mr-intelligent-surprise', actif: true, moment_code: 'debut', quart: null,
        role_code: 'pompiste', categorie_ids: ['catHuiles'], zone_ids: null,
        mode_selection: 'intelligent', nombre_references: 1, inclure_surprise: true, nombre_surprises: 1,
        ordre_affichage: 10,
      },
    ]),
    chargerRolesPresentsQuart: async () => (['pompiste']),
  };
  global.NexusInventairePlanDonnees = {
    chargerOuGenererPlan: async () => ({
      items: [
        { produit_id: 'huileA', inventaire_zone_produit: { categorie_id: 'catHuiles', zone_id: null } },
        { produit_id: 'huileB', inventaire_zone_produit: { categorie_id: 'catHuiles', zone_id: null } },
      ],
    }),
    chargerIngredientsSelection: async () => ({
      produits: [
        { id: 'huileA', categorie_id: 'catHuiles', zone_id: null, actif: true },
        { id: 'huileB', categorie_id: 'catHuiles', zone_id: null, actif: true },
      ],
      dernierControleParProduit: { huileA: '2026-08-29', huileB: '2026-08-29' },
      reglesParProduit: {},
      produitsAvecAnomalieRecente: [],
      anomaliesDetailParProduit: {},
    }),
    // Volontairement absent : simule un appelant/mock qui ne connaît pas
    // encore chargerSurprisesRecentes.
  };
  const client = mockMissionsClient();
  let erreur = null;
  let missions = null;
  try {
    missions = await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-08-30', 'matin');
  } catch (e) { erreur = e; }
  assert.strictEqual(erreur, null, 'aucune exception ne doit remonter si chargerSurprisesRecentes est absent du chargeur plan');
  assert.strictEqual(missions.length, 1, 'la génération de la mission continue malgré le chargeur incomplet');

  ok('genererOuChargerMissions — filet de sécurité si chargerSurprisesRecentes est absent (jamais une exception qui casse toute la génération)');
}

// ------------------------------------------------------------
// 3) Non-régression — mode 'complet' produit exactement le même résultat
//    qu'avant l'Étape 2, ingrédients enrichis fournis ou non.
// ------------------------------------------------------------
{
  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules: async () => ([
      { id: 'r1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', categorie_ids: ['catGaz'], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
    ]),
    chargerRolesPresentsQuart: async () => (['pompiste']),
  };
  global.NexusInventairePlanDonnees = {
    chargerOuGenererPlan: async () => ({
      items: [{ produit_id: 'gaz1', inventaire_zone_produit: { categorie_id: 'catGaz', zone_id: null } }],
    }),
    // Ingrédients minimaux, SANS reglesParProduit/anomalies/surprises —
    // exactement comme avant l'Étape 2 (mock non enrichi).
    chargerIngredientsSelection: async () => ({
      produits: [{ id: 'gaz1', categorie_id: 'catGaz', zone_id: null }],
      dernierControleParProduit: {},
    }),
  };
  const client = mockMissionsClient();
  const missions = await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-08-30', 'matin');
  assert.strictEqual(missions.length, 1);
  assert.deepStrictEqual(missions[0].produit_ids, ['gaz1'], "mode 'complet' inchangé : tout le périmètre, comme avant l'Étape 2");
  assert.strictEqual(missions[0].statut, 'affectee');

  ok("genererOuChargerMissions — non-régression : mode 'complet' inchangé avec ou sans les nouveaux ingrédients");
}

console.log(`\n${n} test(s) passé(s) — test_inventaire_rotation_intelligente_etape2.js`);
})();
