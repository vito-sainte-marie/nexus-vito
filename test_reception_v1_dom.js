// Test DOM simulé de NEXUS-Carburant-Reception-v1.html (14/08/2026) — même
// approche que test_pilotage_redesign_dom.js : pas de vrai navigateur
// disponible, on exécute le script inline dans un contexte vm.Script avec
// document/nexusClient/nexusRequireAuth/NexusForfait mockés, et les vrais
// moteurs/glue (nexus-reception-moteur.js, nexus-reception-donnees.js)
// chargés tels quels pour vérifier la logique réelle, pas une doublure.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const OUT = '/sessions/dazzling-compassionate-ride/mnt/outputs';

const moteurSrc = fs.readFileSync(`${OUT}/nexus-reception-moteur.js`, 'utf-8');
const donneesSrc = fs.readFileSync(`${OUT}/nexus-reception-donnees.js`, 'utf-8');
const html = fs.readFileSync(`${OUT}/NEXUS-Carburant-Reception-v1.html`, 'utf-8');
const script = /<script>([\s\S]*?)<\/script>\s*<\/body>/.exec(html)[1];

// --- DOM minimal : auto-crée un élément à la demande pour tout id demandé,
// résout les querySelectorAll utilisés par le fichier (data-carburant,
// data-cuve, data-idx, data-retirer) contre le dernier HTML injecté. ---
function makeStyleProxy() { const store = {}; return new Proxy(store, { get: (t,k)=>t[k], set:(t,k,v)=>{t[k]=v; return true;} }); }
function makeClassList() { const set = new Set(); return { add:(...c)=>c.forEach(x=>set.add(x)), remove:(...c)=>c.forEach(x=>set.delete(x)), contains:(c)=>set.has(c) }; }
function makeElement(id) {
  const el = {
    id, _innerHTML: '', get innerHTML(){ return this._innerHTML; }, set innerHTML(v){ this._innerHTML = v; },
    textContent: '', value: '', style: makeStyleProxy(), classList: makeClassList(), dataset: {}, disabled: false,
    listeners: {}, addEventListener(evt, fn){ (this.listeners[evt] = this.listeners[evt] || []).push(fn); },
    click(){ (this.listeners.click || []).forEach(fn => fn()); },
    querySelectorAll(){ return []; }, querySelector(){ return null; },
  };
  return el;
}
const elements = {};
function el(id) { if (!elements[id]) elements[id] = makeElement(id); return elements[id]; }

const documentStub = {
  getElementById: (id) => el(id),
  querySelectorAll: () => [], // le test appelle les fonctions internes directement plutôt que de simuler des clics DOM
  querySelector: () => null,
  body: makeElement('body'),
};

// --- Mocks Supabase / auth ---
const SITE_ID = 'site-test';
const employee = { id: 'emp-1', nom: 'Testeur', role: 'employe', site_id: SITE_ID };
const STATION_CONFIG = {
  cuves_carburants: {
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Cuve 1', capacite: 20000 }, { id: 'cuve2', label: 'Cuve 2', capacite: 10000 }] },
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
    gnr: { actif: true, label: 'Gasoil non routier (GNR)', cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
  },
};
const insertedReceptions = [];
const insertedMesures = [];
function makeQuery(table) {
  const q = {
    _table: table,
    select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
    async maybeSingle() {
      if (table === 'station_config') return { data: STATION_CONFIG, error: null };
      return { data: null, error: null };
    },
    async single() { return { data: q._lastInsert, error: null }; },
    insert(rows) {
      const arr = Array.isArray(rows) ? rows : [rows];
      if (table === 'carburant_receptions') { const row = { ...arr[0], id: 'recu-1' }; insertedReceptions.push(row); q._lastInsert = row; }
      if (table === 'carburant_reception_mesures') arr.forEach(r => insertedMesures.push(r));
      return q;
    },
    delete() { return q; },
  };
  return q;
}
const nexusClientStub = { from: (table) => makeQuery(table) };
const nexusRequireAuthStub = async () => employee;
const NexusForfaitStub = { nexusRequireProfessional: async () => true };

const sandbox = {
  document: documentStub,
  window: undefined,
  console,
  nexusClient: nexusClientStub,
  nexusRequireAuth: nexusRequireAuthStub,
  NexusForfait: NexusForfaitStub,
  alert: (msg) => { sandbox._dernierAlert = msg; },
  confirm: () => true,
  setTimeout, setInterval, Date, Math, Number, String, Array, Object, JSON, isNaN, Promise,
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(moteurSrc, sandbox);
vm.runInContext(donneesSrc, sandbox);
assert.ok(sandbox.NexusReceptionMoteur, 'NexusReceptionMoteur doit être chargé');
assert.ok(sandbox.NexusReceptionDonnees, 'NexusReceptionDonnees doit être chargé');

process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION PENDANT INIT:', e); });

// Les `let`/`const` de premier niveau d'un script exécuté via vm ne
// deviennent PAS des propriétés du contexte (contrairement à `var`) — on
// expose donc un handle en fin du MÊME script (même portée lexicale) pour
// pouvoir lire/piloter l'état réel depuis le test, exactement comme
// test_pilotage_redesign_dom.js le fait pour NEXUS-Carburants-Pilotage-v1.html.
const wrapped = script + `
;globalThis.__NEXUS_TEST__ = {
  get siteId(){ return siteId; },
  get etape(){ return etape; }, set etape(v){ etape = v; },
  get carburantChoisi(){ return carburantChoisi; },
  get cuvesDuCarburant(){ return cuvesDuCarburant; },
  get cuvesActives(){ return cuvesActives; },
  get entete(){ return entete; },
  get mesuresParCuve(){ return mesuresParCuve; },
  get heureFin(){ return heureFin; }, set heureFin(v){ heureFin = v; },
  get quantiteSystemeSaisie(){ return quantiteSystemeSaisie; }, set quantiteSystemeSaisie(v){ quantiteSystemeSaisie = v; },
  get resultatCalcul(){ return resultatCalcul; }, set resultatCalcul(v){ resultatCalcul = v; },
  get dernierRecu(){ return dernierRecu; }, set dernierRecu(v){ dernierRecu = v; },
  get employeeCourant(){ return employeeCourant; },
  demarrerReception, allerEtape, calculerResultatAgrege, soumettreReception, render,
};
`;
vm.runInContext(wrapped, sandbox);

(async () => {
  // Laisse la chaîne de promesses d'initialisation (nexusRequireAuth().then(...)) se dérouler.
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 5));

  const H = sandbox.__NEXUS_TEST__;
  assert.ok(H, 'Le handle de test doit être exposé');

  assert.strictEqual(H.siteId, SITE_ID);
  assert.strictEqual(H.cuvesActives.go.length, 2, 'GO doit avoir 2 cuves (cuve1 + cuve2)');
  assert.strictEqual(H.cuvesActives.sp95.length, 1, 'SP95 doit avoir 1 cuve');
  assert.strictEqual(H.etape, 'accueil');

  // --- Démarrer une réception GO (cas nominal cohérent) ---
  H.demarrerReception('go');
  assert.strictEqual(H.etape, 'livraison');
  assert.strictEqual(H.cuvesDuCarburant.length, 2);

  H.entete.quantite_bl_l = '10000';
  H.entete.heure_debut = '2026-08-14T08:00';
  H.allerEtape('jaugeage_avant');
  assert.strictEqual(H.etape, 'jaugeage_avant');

  H.mesuresParCuve['cuve1'].jaugeage_avant_l = '2000';
  H.mesuresParCuve['cuve2'].jaugeage_avant_l = '1000';
  H.allerEtape('compartiments'); // simule la validation de l'étape (timestamps posés manuellement ci-dessous)
  H.mesuresParCuve['cuve1'].jaugeage_avant_le = '2026-08-14T08:05:00.000Z';
  H.mesuresParCuve['cuve2'].jaugeage_avant_le = '2026-08-14T08:05:00.000Z';

  H.allerEtape('jaugeage_apres');
  H.mesuresParCuve['cuve1'].jaugeage_apres_l = '8050'; // +6050 sur cuve1
  H.mesuresParCuve['cuve2'].jaugeage_apres_l = '5000'; // +4000 sur cuve2 => total +10050
  H.mesuresParCuve['cuve1'].jaugeage_apres_le = '2026-08-14T08:30:00.000Z';
  H.mesuresParCuve['cuve2'].jaugeage_apres_le = '2026-08-14T08:30:00.000Z';
  H.heureFin = '2026-08-14T08:30:00.000Z';

  const resultat = H.calculerResultatAgrege();
  assert.strictEqual(resultat.deltasParCuve.cuve1, 6050);
  assert.strictEqual(resultat.deltasParCuve.cuve2, 4000);
  assert.strictEqual(resultat.deltaMesureTotal, 10050);
  assert.strictEqual(resultat.ecartTerrainBl, 50); // 10050 - 10000
  assert.strictEqual(resultat.statut, 'coherente'); // 0.5% < seuil 2%
  assert.notStrictEqual(resultat.statut, 'anomalie_confirmee');

  H.allerEtape('calcul');
  assert.strictEqual(H.etape, 'calcul');
  H.allerEtape('confirmation');
  assert.strictEqual(H.etape, 'confirmation');

  await H.soumettreReception();
  assert.strictEqual(H.etape, 'succes', 'la soumission réussie doit mener à l\'écran succès');
  assert.strictEqual(insertedReceptions.length, 1);
  assert.strictEqual(insertedReceptions[0].carburant, 'go');
  assert.strictEqual(insertedReceptions[0].statut, 'coherente');
  assert.strictEqual(insertedReceptions[0].quantite_bl_l, 10000);
  assert.strictEqual(insertedReceptions[0].employe_id, 'emp-1');
  assert.strictEqual(insertedMesures.length, 2, 'une ligne de mesure par cuve');
  assert.strictEqual(insertedMesures.find(m => m.cuve_id === 'cuve1').delta_mesure_l, 6050);
  assert.strictEqual(insertedMesures.find(m => m.cuve_id === 'cuve2').delta_mesure_l, 4000);
  assert.strictEqual(insertedMesures[0].ventes_pendant_livraison_l, null, 'P2 différé — jamais un zéro fabriqué');
  assert.strictEqual(insertedMesures[0].reception_corrigee_l, null);

  // --- Cas SP95 (1 cuve) avec écart significatif -> 'a_rapprocher', jamais 'anomalie_confirmee' ---
  H.demarrerReception('sp95');
  assert.strictEqual(H.cuvesDuCarburant.length, 1);
  H.entete.quantite_bl_l = '5000';
  H.mesuresParCuve['unique'].jaugeage_avant_l = '1000';
  H.mesuresParCuve['unique'].jaugeage_apres_l = '5600'; // +4600 vs BL 5000 => -8% écart
  const resultatSp95 = H.calculerResultatAgrege();
  assert.strictEqual(resultatSp95.deltaMesureTotal, 4600);
  assert.strictEqual(resultatSp95.ecartTerrainBl, -400);
  assert.strictEqual(resultatSp95.statut, 'a_rapprocher');
  assert.notStrictEqual(resultatSp95.statut, 'anomalie_confirmee');

  // --- Mesure incomplète (jaugeage après manquant) -> 'a_completer' ---
  H.demarrerReception('gnr');
  H.entete.quantite_bl_l = '3000';
  H.mesuresParCuve['unique'].jaugeage_avant_l = '500';
  const resultatIncomplet = H.calculerResultatAgrege();
  assert.strictEqual(resultatIncomplet.deltaMesureTotal, null);
  assert.strictEqual(resultatIncomplet.statut, 'a_completer');

  // --- Tous les écrans se rendent sans exception (aucun render() ne doit jeter) ---
  ['accueil', 'livraison', 'jaugeage_avant', 'compartiments', 'jaugeage_apres', 'calcul', 'confirmation', 'succes'].forEach(e => {
    H.etape = e;
    if (!H.dernierRecu) H.dernierRecu = { statut: 'coherente' };
    if (!H.resultatCalcul) H.resultatCalcul = resultatIncomplet;
    H.render();
  });

  console.log('TOUS LES TESTS DOM RÉCEPTION PASSENT.');
  process.exit(0); // demarrerHorloge() pose un setInterval(15000) qui garderait sinon le process vivant indéfiniment
})().catch(e => { console.error('ÉCHEC TEST:', e); process.exit(1); });
