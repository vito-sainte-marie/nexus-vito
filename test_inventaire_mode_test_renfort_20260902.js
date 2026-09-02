// Non-régression — test terrain Renfort (02/09/2026).
// Garantit que la projection est purement en lecture, expose la mission
// "pendant le quart" et conserve les zones configurées par le manager.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = global;
global.location = { search: '?test_role=renfort', pathname: '/NEXUS-Inventaire-v1.html' };
require(path.join(__dirname, 'nexus-inventaire-moteur.js'));
require(path.join(__dirname, 'nexus-inventaire-missions-donnees.js'));

let planOfficielAppele = false;
global.NexusInventaireMissionRulesDonnees = {
  normaliserRoleCode: role => role === 'caissiere' ? 'caissier' : role,
  chargerMissionRules: async () => ([{
    id: 'mission-renfort', nom: 'Renfort · Pendant le quart', actif: true,
    role_code: 'renfort', role_repli: null, moment_code: 'pendant', quart: null,
    categorie_ids: ['boissons', 'huiles'], zone_ids: ['zone-boutique'],
    mode_selection: 'tournant', nombre_references: 2, ordre_affichage: 10,
  }]),
  chargerRolesPresentsQuart: async () => ([]),
};
global.NexusInventairePlanDonnees = {
  chargerOuGenererPlan: async () => { planOfficielAppele = true; throw new Error('interdit en simulation'); },
  chargerIngredientsSelection: async () => ({
    produits: [
      { id: 'b1', categorie_id: 'boissons', zone_id: 'zone-boutique' },
      { id: 'b2', categorie_id: 'boissons', zone_id: 'zone-boutique' },
      { id: 'h1', categorie_id: 'huiles', zone_id: 'zone-boutique' },
    ],
    reglesParProduit: {}, dernierControleParProduit: {},
    produitsAvecAnomalieRecente: [], anomaliesDetailParProduit: {},
  }),
  chargerSurprisesRecentes: async () => ([]),
};

(async () => {
  const missions = await global.NexusInventaireMissionsDonnees.chargerMissionsPourRole(
    {}, 'vito-sainte-marie', '2026-09-02', 'matin', 'manager'
  );
  assert.strictEqual(planOfficielAppele, false, 'la simulation ne doit jamais générer un plan officiel');
  assert.strictEqual(missions.length, 1);
  assert.strictEqual(missions[0].moment_code, 'pendant');
  assert.deepStrictEqual(missions[0].zone_ids, ['zone-boutique']);
  assert.strictEqual(missions[0].produit_ids.length, 2, 'la mission ciblée respecte son quota tournant');

  const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-v1.html'), 'utf8');
  const authJs = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
  const testJs = fs.readFileSync(path.join(__dirname, 'nexus-inventaire-mode-test.js'), 'utf8');
  const stockEntryJs = fs.readFileSync(path.join(__dirname, 'nexus-inventaire-stock-localise-entry.js'), 'utf8');
  const transfertJs = fs.readFileSync(path.join(__dirname, 'nexus-inventaire-transferts-internes.js'), 'utf8');
  assert.ok(html.includes("if (modeTestInventaireActif()) return {\n      id: '00000000-0000-4000-8000-000000000101'"), 'quart virtuel imposé dans le cœur de l’écran');
  assert.ok(html.includes('if (modeTestInventaireActif()) return { id: `simulation:${idempotencyKey}`'), 'comptages et mouvements neutralisés à la source');
  assert.ok(html.includes("terminerModeTestInventaire(moment === 'pendant' ? 'mission' : 'ouverture')"), 'validation de mission interceptée avant toute écriture');
  assert.ok(testJs.includes('nexusTesterMissionPendant'), 'bouton dédié au contrôle pendant le quart');
  assert.ok(html.includes("const zoneIdsMission = new Set((missionsDuJour || []).flatMap(m => m.zone_ids || []))"), 'zones dérivées des règles de mission par l’initialisation unique');

  // Stabilité de l'état visuel : la garde est statique et ne lance jamais un
  // second rendu concurrent après l'initialisation principale.
  assert.ok(html.includes('<script src="nexus-inventaire-mode-test.js?v=20260902-2415"></script>\n<script>'), 'garde Simulation chargée statiquement juste avant le cœur de l’écran');
  assert.ok(!authJs.includes("scriptTest = document.createElement('script')"), 'aucun chargement dynamique tardif de la garde');
  assert.ok(!testJs.includes('appliquerModeTestInitial'), 'aucune seconde initialisation concurrente');
  assert.ok(!testJs.includes('timerInitialisation'), 'aucun rendu différé susceptible de remplacer l’écran');
  assert.ok(testJs.includes('Mode simulation') && testJs.includes('Aucune donnée réelle n’est enregistrée'), 'état Simulation explicite et durable');

  // Les outils manager sont intégrés au flux normal et ne sont jamais
  // exposés dans une URL de simulation.
  assert.ok(html.includes('id="nexusOutilsStock"') && html.includes('Emplacements et mouvements'), 'bloc outils manager intégré');
  assert.ok(!stockEntryJs.includes('position:fixed') && !transfertJs.includes('#nexusTransfertInterneBtn{position:fixed'), 'aucun petit bouton flottant');
  assert.ok(stockEntryJs.includes("has('test_role')") && transfertJs.includes("has('test_role')"), 'outils opérationnels masqués en simulation');

  console.log('OK — test Renfort stable, explicite, ciblé par zone et strictement non persistant.');
})().catch(err => { console.error(err); process.exit(1); });
