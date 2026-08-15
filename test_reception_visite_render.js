// Test — rendu réel et flux complet de NEXUS-Carburant-Reception-v1.html
// (v2, 15/08/2026, modèle "visite camion").
//
// Exécute le VRAI script inline via vm.runInContext, avec un mock DOM
// générique (registre d'éléments par id + querySelectorAll par sélecteur
// d'attribut `[data-xxx]`, reconstruits à chaque affectation de
// #content.innerHTML — même stratégie que test_reception_entete_partagee.js
// et test_fdj_manager_stock_render.js, étendue pour supporter les
// interactions plus riches de ce nouvel écran (toggles, fiches
// compartiment, panneaux de dérogation).
//
// Scénarios couverts :
//  1) Accueil : consignes de sécurité affichées depuis la config du site.
//  2) Étape 1 : sélection multi-carburant (SP95+GO), GNR non prévu.
//  3) Étape 2 : jaugeage avant limité aux cuves des carburants prévus.
//  4) Étape 3 : compartiments cohérents avec le BL → "Continuer" activé
//     sans dérogation.
//  5) Étape 3 (site) : compartiments incohérents → blocage, dérogation
//     manager déverrouille "Continuer".
//  6) Étape 4 : compartiment non réceptionné (motif bloquant) bloque la
//     suite ; motif "oubli_validation" ne bloque pas et permet de revenir
//     dessus ; dérogation manager déverrouille un motif bloquant.
//  7) Soumission : payload exact transmis à
//     NexusReceptionDonnees.soumettreVisiteComplete (lignes/compartiments/
//     mesures/anomalies).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Carburant-Reception-v1.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Attendu 1 <script> inline, trouvé ${scripts.length}`);
let scriptSrc = scripts[0];

const moteurSrc = fs.readFileSync(path.join(DIR, 'nexus-reception-moteur.js'), 'utf8');

// ------------------------------------------------------------
// Mock DOM générique
// ------------------------------------------------------------
function parseAttrs(attrStr) {
  const out = {};
  const re = /([a-zA-Z_-][\w-]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrStr))) out[m[1]] = m[2] !== undefined ? m[2] : '';
  return out;
}
// `indexer` : fonction partagée (byId/byAttr) injectée après coup, pour que
// N'IMPORTE QUEL stub dont on fixe .innerHTML (pas seulement #content —
// aussi les zones imbriquées comme #ficheCompartimentZone) enregistre ses
// nouveaux éléments dans le MÊME registre global que querySelectorAll et
// getElementById interrogent — reproduit le fait qu'en DOM réel,
// document.querySelectorAll cherche dans tout le document, quel que soit le
// conteneur qui vient d'être modifié.
function fabriquerStub(attrs, indexer) {
  return {
    _attrs: attrs,
    value: attrs.value !== undefined ? attrs.value : '',
    textContent: '', _innerHTML: '',
    disabled: 'disabled' in attrs,
    style: {}, dataset: {},
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    _listeners: {},
    addEventListener(evt, fn) { this._listeners[evt] = fn; },
    getAttribute(n) { return this._attrs[n] !== undefined ? this._attrs[n] : null; },
    click() { if (this._listeners.click) this._listeners.click(); },
    dispatchEvent(evt) { const fn = this._listeners[evt]; if (fn) fn({ target: this }); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; if (indexer) indexer(v, { reset: false }); },
  };
}

function fabriquerDocument() {
  let byId = {};      // id -> stub (reconstruit à chaque set de #content.innerHTML)
  let byAttr = {};     // attrName -> [stub...] (idem)
  const registreExterne = new Map(); // éléments hors #content (titre, sousTitre, ...), stables

  function indexerFragment(htmlStr, { reset }) {
    if (reset) { byId = {}; byAttr = {}; }
    const reTag = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_-][\w-]*(?:="[^"]*")?)*)\s*\/?>/g;
    let m;
    while ((m = reTag.exec(htmlStr))) {
      const attrs = parseAttrs(m[2]);
      const stub = fabriquerStub(attrs, indexerFragment);
      if (attrs.id) byId[attrs.id] = stub;
      Object.keys(attrs).forEach(a => {
        if (a.startsWith('data-')) { byAttr[a] = byAttr[a] || []; byAttr[a].push(stub); }
      });
    }
  }

  function contentElement() {
    return {
      classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
      offsetWidth: 0,
      get innerHTML() { return this._html || ''; },
      set innerHTML(v) { this._html = v; indexerFragment(v, { reset: true }); },
    };
  }
  const contentStub = contentElement();

  function elementExterne(id) {
    if (!registreExterne.has(id)) {
      registreExterne.set(id, {
        id, value: '', textContent: '', _innerHTML: '', style: {},
        classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
        addEventListener(){}, click(){},
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) { this._innerHTML = v; },
      });
    }
    return registreExterne.get(id);
  }

  return {
    getElementById(id) {
      if (id === 'content') return contentStub;
      if (byId[id]) return byId[id];
      return elementExterne(id);
    },
    querySelectorAll(selector) {
      const m = selector.match(/^\[([\w-]+)\]$/);
      if (!m) return [];
      return byAttr[m[1]] || [];
    },
    querySelector() { return null; },
  };
}

const documentMock = fabriquerDocument();

// Mock nexusClient minimal (managers du site + rien d'autre requis par ce test).
const managersFixture = [{ id: 'mgr1', nom: 'Loane' }, { id: 'mgr2', nom: 'Samantha' }];
const nexusClientMock = {
  from(table) {
    if (table === 'employees') {
      return { select() { return this; }, eq() { return this; }, in() { return this; },
        then(resolve) { resolve({ data: managersFixture, error: null }); } };
    }
    throw new Error(`Table non mockée dans ce test : ${table}`);
  },
};

// Config fixture — reproduit Vito Sainte-Marie (SP95/GO x2/GNR), seuils par défaut.
const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Cuve unique', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Cuve 1', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Cuve 2', capacite: 10000, carburant: 'go' },
    { id: 'unique', label: 'Cuve unique', capacite: 30000, carburant: 'gnr' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
    go: { actif: true, cuves: [{ id: 'cuve1', label: 'Cuve 1', capacite: 20000 }, { id: 'cuve2', label: 'Cuve 2', capacite: 10000 }] },
    gnr: { actif: true, cuves: [{ id: 'unique', label: 'Cuve unique', capacite: 30000 }] },
  },
  nombreCompartimentsDefaut: 3,
  seuilEcartCompartimentsPct: 2,
  seuilEcartMesurePct: 2,
  consignesSecurite: [
    { theme: 'Sécurisation', texte: 'Balisez la zone avant le dépotage.' },
    { theme: 'EPI', texte: 'Portez vos équipements de protection.' },
  ],
  contactManager: { nom: 'Frédéric', telephone: '06 00 00 00 00' },
};

let dernierAppelSoumission = null;
const NexusReceptionDonneesMock = {
  async chargerConfigReception() { return configFixture; },
  async chargerHistoriqueEcartsRatio() { return []; }, // échantillon insuffisant : pas de comparaison
  async soumettreVisiteComplete(client, visite, lignes, compartiments, mesures, anomalies) {
    dernierAppelSoumission = { visite, lignes, compartiments, mesures, anomalies };
    return { data: { id: 'visite-test-1', ...visite } };
  },
};

const sandbox = {
  document: documentMock,
  console,
  nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom: 'Loane', site_id: 'site-test' }),
  nexusClient: nexusClientMock,
  setInterval: () => 0,
  Date,
  alert: (msg) => { throw new Error(`alert() appelé de façon inattendue : ${msg}`); },
  confirm: () => true,
};
vm.createContext(sandbox);
vm.runInContext(moteurSrc, sandbox);
sandbox.NexusReceptionDonnees = NexusReceptionDonneesMock;

scriptSrc += `
;globalThis.__NEXUS_TEST__ = {
  get etape(){ return etape; },
  get lignes(){ return lignes; },
  get compartiments(){ return compartiments; },
  get compartimentOuvert(){ return compartimentOuvert; }, set compartimentOuvert(v){ compartimentOuvert = v; },
  get controleCompartiments(){ return controleCompartiments; },
  get derogationGlobaleCompartiments(){ return derogationGlobaleCompartiments; },
  get derogationsParCompartiment(){ return derogationsParCompartiment; },
  get resultatsParCarburant(){ return resultatsParCarburant; },
  allerEtape, demarrerVisite, renderCompartimentsEtape, renderReceptionEtape, renderFicheCompartiment, renderFicheReception,
  soumettreVisite,
};
`;
vm.runInContext(scriptSrc, sandbox);

// Attendre l'initialisation asynchrone (nexusRequireAuth().then(...)).
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
  // 1) Accueil — consignes de sécurité affichées depuis la config
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'accueil', 'Étape initiale : accueil');
  let contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Balisez la zone avant le dépotage.'), 'Consigne sécurité 1 absente');
  assert.ok(contenu.includes('Portez vos équipements de protection.'), 'Consigne sécurité 2 absente');
  assert.ok(contenu.includes('Démarrons ensemble'), 'Bouton "Démarrons ensemble" absent');
  console.log('✓ 1. Accueil — consignes de sécurité paramétrées par site');

  // ------------------------------------------------------------
  // 2) Étape 1 — Livraison attendue (SP95 + GO, GNR non prévu)
  // ------------------------------------------------------------
  H.demarrerVisite();
  assert.strictEqual(H.etape, 'livraison');
  // Toggle SP95 et GO actifs.
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
  assert.strictEqual(H.lignes.sp95.actif, true);
  assert.strictEqual(H.lignes.go.actif, true);
  assert.strictEqual(H.lignes.gnr.actif, false, 'GNR doit rester non prévu (non touché)');
  // Quantités attendues.
  const qteSp95 = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  qteSp95.value = '17000'; qteSp95._listeners.input({ target: qteSp95 });
  const qteGo = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
  qteGo.value = '15000'; qteGo._listeners.input({ target: qteGo });
  sandbox.document.getElementById('fHeureDebut').value = '2026-08-15T07:03';
  sandbox.document.getElementById('fHeureDebut')._listeners.input();
  assert.strictEqual(sandbox.document.getElementById('btnContinuerLivraison').disabled, false, '"Continuer" doit être activé (SP95+GO prévus, heure renseignée)');
  sandbox.document.getElementById('btnContinuerLivraison')._listeners.click();
  console.log('✓ 2. Étape 1 — sélection multi-carburant (SP95+GO), GNR non prévu');

  // ------------------------------------------------------------
  // 3) Étape 2 — Jaugeage avant : uniquement les cuves SP95/GO (pas GNR)
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'jaugeage_avant');
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('SP95'), 'Cuve SP95 absente du jaugeage avant');
  assert.ok(contenu.includes('Cuve 1') && contenu.includes('Cuve 2'), 'Cuves GO absentes du jaugeage avant');
  assert.ok(!contenu.includes('GNR'), 'GNR ne doit PAS apparaître au jaugeage (non prévu à l\'étape 1)');
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => {
    el.value = '8000'; el._listeners.input();
  });
  assert.strictEqual(sandbox.document.getElementById('btnContinuerJaugeage').disabled, false);
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();
  console.log('✓ 3. Étape 2 — jaugeage avant limité aux cuves des carburants prévus');

  // ------------------------------------------------------------
  // 4) Étape 3 — Compartiments COHÉRENTS avec le BL
  //    3 compartiments par défaut (config.nombreCompartimentsDefaut=3) :
  //    SP95 17000 sur 1 compartiment, GO 15000 réparti sur 2.
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'compartiments');
  assert.strictEqual(H.compartiments.length, 3, 'Nombre de compartiments par défaut = config (3)');

  function assignerCompartiment(numero, carburant, quantite, cuveId) {
    H.compartimentOuvert = numero;
    H.renderFicheCompartiment();
    sandbox.document.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === carburant)._listeners.click();
    const qte = sandbox.document.getElementById('fQteCompartiment');
    qte.value = String(quantite); qte._listeners.input({ target: qte });
    const cuve = sandbox.document.getElementById('fCuveCompartiment');
    cuve.value = cuveId; cuve._listeners.change({ target: cuve });
    sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  }
  assignerCompartiment(1, 'sp95', 17000, 'unique');
  assignerCompartiment(2, 'go', 8000, 'cuve1');
  assignerCompartiment(3, 'go', 7000, 'cuve2');

  assert.ok(H.controleCompartiments, 'controleCompartiments doit être calculé (tous assignés)');
  assert.strictEqual(H.controleCompartiments.coherentGlobal, true, 'Chargement cohérent avec le BL attendu');
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Chargement cohérent avec le bon de livraison'), 'Verdict "cohérent" absent');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, false, '"Continuer vers la réception" doit être activé sans dérogation (cas cohérent)');
  console.log('✓ 4. Étape 3 — compartiments cohérents avec le BL, "Continuer" activé sans dérogation');

  // ------------------------------------------------------------
  // 5) Étape 3 — Compartiments INCOHÉRENTS → blocage + dérogation manager
  // ------------------------------------------------------------
  // Ré-assigne le compartiment 3 pour créer un écart GO (8000+6000=14000 vs 15000 attendu = -6.7%, > seuil 2%).
  assignerCompartiment(3, 'go', 6000, 'cuve2');
  assert.strictEqual(H.controleCompartiments.coherentGlobal, false, 'Écart GO doit être détecté');
  assert.ok(H.controleCompartiments.carburantsEnAnomalie.includes('go'));
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Anomalie détectée'), 'Bandeau anomalie absent');
  assert.ok(contenu.includes('Ne commencez pas la réception. Contactez votre manager.'), 'Consigne de blocage absente');
  assert.ok(contenu.includes('Frédéric') && contenu.includes('06 00 00 00 00'), 'Contact manager absent du bandeau de blocage');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, true, '"Continuer" doit être bloqué tant qu\'aucune dérogation n\'est enregistrée');

  // Déverrouillage manager.
  sandbox.document.getElementById('btnOuvrirDerogation')._listeners.click();
  const selectManager = sandbox.document.getElementById('fDerogationManager');
  selectManager.value = 'Loane'; selectManager._listeners.change();
  const inputMotif = sandbox.document.getElementById('fDerogationMotif');
  inputMotif.value = 'Écart contrôlé sur place avec le chauffeur'; inputMotif._listeners.input();
  assert.strictEqual(sandbox.document.getElementById('btnConfirmerDerogation').disabled, false, 'Confirmation activée une fois manager+motif renseignés');
  sandbox.document.getElementById('btnConfirmerDerogation')._listeners.click();
  assert.ok(H.derogationGlobaleCompartiments, 'Dérogation globale doit être enregistrée en mémoire');
  assert.strictEqual(H.derogationGlobaleCompartiments.nom, 'Loane');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, false, '"Continuer" doit être débloqué après dérogation manager');
  sandbox.document.getElementById('btnContinuerCompartiments')._listeners.click();
  console.log('✓ 5. Étape 3 — anomalie compartiments vs BL bloque, dérogation manager déverrouille (tracée)');

  // ------------------------------------------------------------
  // 6) Étape 4 — Réception compartiment par compartiment
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'reception');
  function ouvrirCompartimentReception(numero) { H.compartimentOuvert = numero; H.renderFicheReception(); }

  // Compartiment 1 : réceptionné normalement.
  ouvrirCompartimentReception(1);
  sandbox.document.getElementById('btnMarquerReceptionne')._listeners.click();
  assert.strictEqual(H.compartiments.find(c => c.numero === 1).statut, 'receptionne');

  // Compartiment 2 : motif "oubli_validation" — ne bloque pas, remet à "à réceptionner".
  ouvrirCompartimentReception(2);
  sandbox.document.querySelectorAll('[data-motif]').find(el => el.getAttribute('data-motif') === 'oubli_validation')._listeners.click();
  assert.strictEqual(H.compartiments.find(c => c.numero === 2).statut, 'a_receptionner', 'oubli_validation ne doit jamais bloquer, juste remettre "à réceptionner"');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerReception').disabled, true, 'Compartiment 2 toujours non traité : "Continuer" bloqué');
  ouvrirCompartimentReception(2);
  sandbox.document.getElementById('btnMarquerReceptionne')._listeners.click();
  assert.strictEqual(H.compartiments.find(c => c.numero === 2).statut, 'receptionne');

  // Compartiment 3 : motif bloquant "compartiment_non_livre" → blocage réel.
  ouvrirCompartimentReception(3);
  sandbox.document.querySelectorAll('[data-motif]').find(el => el.getAttribute('data-motif') === 'compartiment_non_livre')._listeners.click();
  assert.strictEqual(H.compartiments.find(c => c.numero === 3).statut, 'non_receptionne');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerReception').disabled, true, '"Continuer vers le jaugeage final" doit être bloqué (compartiment 3 non résolu)');
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('non réceptionné'), 'Bandeau "compartiment non réceptionné" absent');
  // Le détail du blocage (message par motif) est écrit dans la zone imbriquée
  // #ficheReceptionZone par renderFicheReception(), APRÈS que #content ait
  // déjà reçu son propre innerHTML — en DOM réel ce nested write fait partie
  // du même arbre et remonte donc dans #content.innerHTML, mais le mock ne
  // fait que garder la dernière chaîne assignée à #content sans re-sérialiser
  // ses enfants. On vérifie donc directement la zone imbriquée, comme le
  // reste du test le fait déjà pour les fiches compartiment.
  const contenuFiche = sandbox.document.getElementById('ficheReceptionZone').innerHTML;
  assert.ok(contenuFiche.includes('Contactez votre manager immédiatement'), 'Message spécifique "compartiment non livré" absent');

  // Dérogation manager pour ce compartiment précis.
  ouvrirCompartimentReception(3);
  sandbox.document.getElementById('btnOuvrirDerogation')._listeners.click();
  const selectManager2 = sandbox.document.getElementById('fDerogationManager');
  selectManager2.value = 'Samantha'; selectManager2._listeners.change();
  const inputMotif2 = sandbox.document.getElementById('fDerogationMotif');
  inputMotif2.value = 'Compartiment vide confirmé par le transporteur'; inputMotif2._listeners.input();
  sandbox.document.getElementById('btnConfirmerDerogation')._listeners.click();
  assert.ok(H.derogationsParCompartiment[3], 'Dérogation du compartiment 3 doit être enregistrée');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerReception').disabled, false, '"Continuer" débloqué une fois la dérogation du compartiment 3 enregistrée');
  sandbox.document.getElementById('btnContinuerReception')._listeners.click();
  console.log('✓ 6. Étape 4 — motif bloquant vs non bloquant, dérogation manager par compartiment');

  // ------------------------------------------------------------
  // 7) Étape 5 — Jaugeage final + rapprochement + soumission
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'jaugeage_final');
  // SP95 : 8000 -> 25000 (+17000, cohérent avec 17000 prévu).
  // GO cuve1 : 8000 -> 16200 (+8200) ; GO cuve2 : 8000 -> 14700 (+6700) => total GO mesuré 14900 (~14900 vs 15000 prévu, -0.67%, dans le seuil).
  // data-cuve porte la clé composite `${carburant}__${id}` (voir cleCuve
  // côté écran) et non l'id brut de cuve — la fixture réutilise l'id
  // "unique" pour SP95 ET GNR (comme la vraie config Vito), donc seule la
  // clé composite lève l'ambiguïté. GNR n'étant pas prévu ici, seule la clé
  // "sp95__unique" existe réellement dans le DOM pour cette étape.
  const valeursApres = { 'sp95__unique': '25000', 'go__cuve1': '16200', 'go__cuve2': '14700' };
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => {
    const cle = el.getAttribute('data-cuve');
    el.value = valeursApres[cle];
    el._listeners.input();
  });
  assert.strictEqual(sandbox.document.getElementById('btnContinuerJaugeage').disabled, false);
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();
  console.log('✓ 7. Étape 5 — jaugeage final saisi');

  // ------------------------------------------------------------
  // 8) Rapprochement automatique (étape "calcul")
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'calcul');
  assert.ok(H.resultatsParCarburant.sp95, 'Résultat SP95 doit être calculé');
  assert.strictEqual(H.resultatsParCarburant.sp95.statut, 'coherente', `SP95 attendu cohérent, obtenu ${H.resultatsParCarburant.sp95.statut}`);
  assert.strictEqual(H.resultatsParCarburant.go.statut, 'coherente', `GO attendu cohérent (écart ~0.67% < seuil 2%), obtenu ${H.resultatsParCarburant.go.statut}`);
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('Terminer la réception'), 'Bouton de soumission finale absent');
  console.log('✓ 8. Rapprochement automatique — 2 carburants cohérents');

  // ------------------------------------------------------------
  // 9) Soumission — payload transmis à soumettreVisiteComplete
  // ------------------------------------------------------------
  await H.soumettreVisite();
  assert.ok(dernierAppelSoumission, 'soumettreVisiteComplete doit avoir été appelé');
  assert.strictEqual(dernierAppelSoumission.visite.statut, 'terminee_avec_derogation', 'Visite avec 2 dérogations doit être tracée "terminee_avec_derogation"');
  assert.strictEqual(dernierAppelSoumission.lignes.length, 2, '2 lignes attendues (SP95 + GO)');
  assert.strictEqual(dernierAppelSoumission.compartiments.length, 3, '3 compartiments attendus');
  assert.strictEqual(dernierAppelSoumission.mesures.length, 3, '3 mesures de cuve attendues (unique/cuve1/cuve2)');
  assert.strictEqual(dernierAppelSoumission.anomalies.length, 2, '2 anomalies tracées (compartiments_vs_bl GO + compartiment_non_receptionne #3)');
  const anomalieCompartiments = dernierAppelSoumission.anomalies.find(a => a.type === 'compartiments_vs_bl');
  assert.strictEqual(anomalieCompartiments.derogation_manager_nom, 'Loane');
  const anomalieCompartiment3 = dernierAppelSoumission.anomalies.find(a => a.type === 'compartiment_non_receptionne');
  assert.strictEqual(anomalieCompartiment3.compartiment_numero, 3);
  assert.strictEqual(anomalieCompartiment3.derogation_manager_nom, 'Samantha');
  assert.strictEqual(H.etape, 'succes');
  console.log('✓ 9. Soumission atomique — payload exact (lignes/compartiments/mesures/anomalies), écran de succès');

  console.log('\nTous les tests reception_visite_render passent.');
})().catch(e => { console.error(e); process.exit(1); });
