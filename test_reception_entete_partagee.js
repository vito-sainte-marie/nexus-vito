// Test — transporteur par défaut + réinitialisation propre entre deux
// visites camion (mis à jour 15/08/2026 pour le modèle v2 "visite camion").
//
// Historique : ce test couvrait à l'origine (14/08/2026, demande de
// Frédéric) la reprise du transporteur/chauffeur/immatriculation/n° BL
// entre DEUX RÉCEPTIONS D'UN MÊME CARBURANT lors d'un même passage
// ("Ajouter un autre carburant"). Ce modèle (1 réception = 1 carburant) a
// été entièrement remplacé le 15/08/2026 par le modèle "visite camion" :
// transporteur/chauffeur/immatriculation/n° BL ne sont plus saisis qu'UNE
// SEULE FOIS par visite (étape 1), et une même visite couvre nativement
// plusieurs carburants (via les compartiments du camion) — il n'y a donc
// plus de resaisie à éviter au sein d'une même visite, le besoin métier
// d'origine est structurellement satisfait par le nouveau schéma.
//
// Ce qui reste réellement à vérifier avec le nouveau modèle :
//  1) TRANSPORTEUR_DEFAUT ("TRANSHYDRO SARL") est bien prérempli au tout
//     premier démarrage d'une visite.
//  2) demarrerVisite() réinitialise TOUT l'état propre à une visite
//     (transporteur, carburants, compartiments, mesures, dérogations,
//     résultats) — pour qu'une nouvelle visite ne soit jamais polluée par
//     les données d'une visite précédente déjà terminée.
//
// Technique : identique aux autres tests DOM-mock du projet — vm.runInContext
// sur le <script> inline réel, via le handle globalThis.__NEXUS_TEST__.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');

// ------------------------------------------------------------
// Mock DOM minimal — un seul registre stable, suffisant ici puisqu'on ne
// pousse jamais jusqu'au rendu détaillé d'une étape (juste demarrerVisite()
// et l'état interne exposé par __NEXUS_TEST__).
// ------------------------------------------------------------
function fabriquerDocument() {
  const registre = new Map();
  function elementPour(id) {
    if (!registre.has(id)) {
      registre.set(id, {
        id, value: '', textContent: '', disabled: false, checked: false,
        style: {}, dataset: {},
        _innerHTML: '',
        _listeners: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        offsetWidth: 0,
        addEventListener(evt, fn) { this._listeners[evt] = fn; },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registre.get(id);
  }
  return {
    getElementById: elementPour,
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

const documentMock = fabriquerDocument();

const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Cuve unique', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Cuve 1', capacite: 20000, carburant: 'go' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
    go: { actif: true, cuves: [{ id: 'cuve1', label: 'Cuve 1', capacite: 20000 }] },
    gnr: { actif: false, cuves: [] },
  },
  nombreCompartimentsDefaut: 2,
  seuilEcartCompartimentsPct: 2,
  seuilEcartMesurePct: 2,
  consignesSecurite: [],
  contactManager: {},
};

const NexusReceptionDonneesMock = {
  async chargerConfigReception() { return configFixture; },
  async chargerHistoriqueEcartsRatio() { return []; },
  async soumettreVisiteComplete(client, visite, lignes, compartiments, mesures, anomalies) {
    return { data: { id: 'visite-test-1', ...visite } };
  },
};

const sandbox = {
  document: documentMock,
  console,
  nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom: 'Loane', site_id: 'site-test' }),
  nexusClient: { from() { return { select(){return this;}, eq(){return this;}, in(){return this;}, then(resolve){ resolve({ data: [], error: null }); } }; } },
  setInterval: () => 0,
  Date,
  alert: (msg) => { throw new Error(`alert() appelé de façon inattendue : ${msg}`); },
  confirm: () => true,
  crypto: { randomUUID: () => require('crypto').randomUUID() },
};
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);
sandbox.NexusReceptionDonnees = NexusReceptionDonneesMock;

scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get etape(){ return etape; },
  get visite(){ return visite; },
  get lignes(){ return lignes; },
  get compartiments(){ return compartiments; },
  get mesuresParCuve(){ return mesuresParCuve; },
  get derogationGlobaleCompartiments(){ return derogationGlobaleCompartiments; },
  get resultatsParCarburant(){ return resultatsParCarburant; },
  demarrerVisite, allerEtape,
};
`;
vm.runInContext(scriptSrc, sandbox);

async function attendreInit() {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 0));
    if (sandbox.__NEXUS_TEST__.etape) return;
  }
  throw new Error('Initialisation jamais terminée');
}

(async () => {
  await attendreInit();
  const H = sandbox.__NEXUS_TEST__;

  // ------------------------------------------------------------
  // 1) Premier démarrage : transporteur par défaut prérempli.
  // ------------------------------------------------------------
  H.demarrerVisite();
  assert.strictEqual(H.etape, 'livraison');
  assert.strictEqual(H.visite.transporteur, 'TRANSHYDRO SARL', 'Transporteur par défaut doit être prérempli dès le premier démarrage');
  assert.strictEqual(H.visite.chauffeur, '', 'Chauffeur vide par défaut (pas de valeur inventée)');
  console.log('✓ 1. Premier démarrage — transporteur par défaut (TRANSHYDRO SARL) prérempli');

  // ------------------------------------------------------------
  // 2) Simule une visite en cours avec des données saisies, puis une
  //    nouvelle visite démarrée depuis l'accueil : aucune pollution.
  // ------------------------------------------------------------
  H.visite.chauffeur = 'Jean Dupont';
  H.visite.immatriculation = 'AB-123-CD';
  H.visite.bon_livraison_reference = 'BL-2026-0815';
  H.lignes.sp95.actif = true;
  H.lignes.sp95.quantite_bl_l = '17000';
  H.compartiments.push({ numero: 1, carburant: 'sp95', quantite_declaree_l: 17000, cuve_destination_id: 'unique', statut: 'receptionne', motif_non_receptionne: null, receptionne_le: new Date().toISOString() });
  H.mesuresParCuve['sp95__unique'] = { cuve_id: 'unique', carburant: 'sp95', jaugeage_avant_l: 8000, jaugeage_avant_le: new Date().toISOString(), jaugeage_apres_l: null, jaugeage_apres_le: null };

  H.allerEtape('accueil'); // retour à l'accueil (ex. après "Terminer" sur l'écran de succès)
  assert.strictEqual(H.etape, 'accueil');
  // L'état de la visite précédente reste en mémoire tant que demarrerVisite()
  // n'a pas été rappelé — c'est bien demarrerVisite() qui doit tout purger,
  // pas le simple passage par l'accueil (l'accueil peut aussi être un point
  // d'entrée initial, sans visite en cours).
  H.demarrerVisite();
  assert.strictEqual(H.etape, 'livraison');
  assert.strictEqual(H.visite.transporteur, 'TRANSHYDRO SARL', 'Transporteur redevient la valeur par défaut à chaque nouvelle visite');
  assert.strictEqual(H.visite.chauffeur, '', 'Chauffeur de la visite précédente ne doit pas fuiter dans la nouvelle visite');
  assert.strictEqual(H.visite.immatriculation, '', 'Immatriculation de la visite précédente ne doit pas fuiter');
  assert.strictEqual(H.visite.bon_livraison_reference, '', 'N° BL de la visite précédente ne doit pas fuiter');
  assert.strictEqual(H.lignes.sp95.actif, false, 'Sélection carburant de la visite précédente ne doit pas fuiter');
  assert.strictEqual(H.lignes.sp95.quantite_bl_l, '', 'Quantité BL de la visite précédente ne doit pas fuiter');
  assert.strictEqual(H.compartiments.length, 0, 'Compartiments de la visite précédente ne doivent pas fuiter');
  // (deepStrictEqual évité : les objets vides créés dans le contexte vm et
  // dans ce module Node appartiennent à des royaumes distincts, avec des
  // Object.prototype différents — deepStrictEqual les jugerait inégaux
  // malgré un contenu identique. On compare donc juste l'absence de clés.)
  assert.strictEqual(Object.keys(H.mesuresParCuve).length, 0, 'Mesures de jaugeage de la visite précédente ne doivent pas fuiter');
  assert.strictEqual(H.derogationGlobaleCompartiments, null, 'Dérogation de la visite précédente ne doit pas fuiter');
  assert.strictEqual(H.resultatsParCarburant, null, 'Résultats de la visite précédente ne doivent pas fuiter');
  console.log('✓ 2. Nouvelle visite — aucune donnée de la visite précédente ne fuite (transporteur reste par défaut)');

  console.log('\nTous les tests reception_entete_partagee passent.');
})().catch(e => { console.error(e); process.exit(1); });
