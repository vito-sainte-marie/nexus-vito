// Test — signalement de Frédéric le 27/08/2026 : "à ma dernière livraison
// j'ai eu le cas où le compartiment 3 était vide, en revanche le 4 et le 5
// oui, donne la possibilité de valider une livraison même en sautant 1 ou
// plusieurs compartiments."
//
// Vérification (lecture du code, NEXUS-Carburant-Reception-v1.html) : cette
// possibilité EXISTE DÉJÀ depuis le 15/08/2026 (bouton "Marquer ce
// compartiment comme vide", cf. test_reception_m3_et_vide.js) — le moteur
// (`sommeCompartimentsParCarburant`/`verifierCompartimentsVsBl`,
// nexus-reception-moteur.js) ignore tout compartiment `vide:true` sans
// limite de nombre ni de position. Ce fichier couvre spécifiquement ce que
// l'ancien test ne couvrait pas : (a) EXACTEMENT le scénario numéroté par
// Frédéric (compartiment 3 vide, 4 et 5 chargés, non contigu au milieu de la
// liste — pas seulement en fin de liste), (b) PLUSIEURS compartiments vides
// à la fois ("1 OU PLUSIEURS"), (c) le message "Encore incomplet" mentionne
// désormais explicitement l'option "vide" (27/08/2026, correctif de
// découvrabilité — la fonctionnalité existait mais n'était jamais suggérée
// au moment où l'employé se retrouve bloqué).

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
// Mock DOM (même stratégie que les autres tests reception_*)
// ------------------------------------------------------------
function parseAttrs(attrStr) {
  const out = {};
  const re = /([a-zA-Z_-][\w-]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(attrStr))) out[m[1]] = m[2] !== undefined ? m[2] : '';
  return out;
}
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
  let byId = {};
  let byAttr = {};
  const registreExterne = new Map();
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
const managersFixture = [{ id: 'mgr1', nom: 'Loane' }];
const nexusClientMock = {
  from(table) {
    if (table === 'employees') {
      return { select() { return this; }, eq() { return this; }, in() { return this; },
        then(resolve) { resolve({ data: managersFixture, error: null }); } };
    }
    throw new Error(`Table non mockée dans ce test : ${table}`);
  },
};
const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Réservoir 1', capacite: 30000, carburant: 'sp95' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Réservoir 1', capacite: 30000 }] },
    go: { actif: false, cuves: [] },
    gnr: { actif: false, cuves: [] },
  },
  nombreCompartimentsDefaut: 6,
  seuilEcartCompartimentsPct: 2,
  seuilEcartMesurePct: 2,
  consignesSecurite: [],
  contactManager: { nom: '', telephone: '' },
};
const NexusReceptionDonneesMock = {
  async chargerConfigReception() { return configFixture; },
  async chargerHistoriqueEcartsRatio() { return []; },
  async soumettreVisiteComplete() { return { data: {} }; },
};
const sandbox = {
  document: documentMock, console,
  nexusRequireAuth: () => Promise.resolve({ id: 'emp1', nom: 'Loane', site_id: 'site-test' }),
  nexusClient: nexusClientMock, setInterval: () => 0, Date,
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
  get compartiments(){ return compartiments; },
  get compartimentOuvert(){ return compartimentOuvert; }, set compartimentOuvert(v){ compartimentOuvert = v; },
  get controleCompartiments(){ return controleCompartiments; },
  allerEtape, demarrerVisite, renderCompartimentsEtape, renderFicheCompartiment,
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

  H.demarrerVisite();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  const qteBl = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  qteBl.value = '19'; qteBl._listeners.input({ target: qteBl }); // BL = 19000 L
  sandbox.document.getElementById('fHeureDebut').value = '2026-08-27T09:00';
  sandbox.document.getElementById('fHeureDebut')._listeners.input();
  sandbox.document.getElementById('btnContinuerLivraison')._listeners.click();
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => { el.value = '1000'; el._listeners.input(); });
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();
  assert.strictEqual(H.etape, 'compartiments');
  assert.strictEqual(H.compartiments.length, 6, '6 compartiments par défaut, comme le camion réel de Frédéric');

  function ouvrirCompartiment(numero) { H.compartimentOuvert = numero; H.renderFicheCompartiment(); }
  function marquerVide(numero) {
    ouvrirCompartiment(numero);
    sandbox.document.getElementById('btnToggleVideCompartiment')._listeners.click();
    sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  }
  function assignerCompartiment(numero, quantiteLitres) {
    ouvrirCompartiment(numero);
    sandbox.document.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === 'sp95')._listeners.click();
    const qte = sandbox.document.getElementById('fQteCompartiment');
    qte.value = String(quantiteLitres / 1000); qte._listeners.input({ target: qte });
    sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  }

  // ------------------------------------------------------------
  // 1) Scénario EXACT de Frédéric : compartiment 3 vide, 4 ET 5 chargés
  //    (donc pas seulement un compartiment vide en fin de liste — un
  //    compartiment vide AU MILIEU, avec des compartiments chargés après).
  //    Avant de traiter le compartiment 3, le message "Encore incomplet"
  //    doit maintenant suggérer explicitement l'option "vide".
  // ------------------------------------------------------------
  assignerCompartiment(1, 5000);
  assignerCompartiment(2, 4000);
  // Compartiment 3 volontairement laissé tel quel (non chargé par le
  // camion) — reproduit l'état AVANT que l'employé sache qu'il peut le
  // marquer vide : le message doit maintenant lui suggérer l'option.
  assignerCompartiment(4, 5000);
  assignerCompartiment(5, 5000);
  let contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenu.includes('compartiment 3'), 'le compartiment 3 (non chargé) doit être listé comme incomplet : ' + contenu);
  assert.ok(contenu.includes('marquez-le "vide"'), 'le message doit maintenant suggérer explicitement l\'option "vide" (correctif découvrabilité 27/08/2026) : ' + contenu);
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, true, 'toujours bloqué tant que le compartiment 3 n\'est ni chargé ni marqué vide');
  console.log('✓ 1. Compartiment 3 non traité -> message "Encore incomplet" suggère désormais explicitement l\'option "vide"');

  // Marque le compartiment 3 comme vide, exactement le geste attendu de
  // Frédéric — 4 et 5 restent chargés, comme dans son cas réel.
  marquerVide(3);
  assert.strictEqual(H.compartiments.find(c => c.numero === 3).vide, true, 'compartiment 3 marqué vide, geste identique au cas réel de Frédéric (4 et 5 restent chargés)');
  console.log('✓ 2. Compartiment 3 marqué vide (mécanisme déjà existant depuis le 15/08/2026) -> geste identique au cas réel de Frédéric');

  // ------------------------------------------------------------
  // 3) PLUSIEURS compartiments sautés à la fois ("1 OU PLUSIEURS", exigence
  //    explicite de Frédéric) — nouveau scénario complet : compartiments 3
  //    ET 6 vides, 1/2/4/5 chargés, somme exacte au BL (19000 L).
  // ------------------------------------------------------------
  H.compartiments.forEach(c => { c.vide = false; c.carburant = null; c.quantite_declaree_l = ''; c.cuve_destination_id = null; });
  assignerCompartiment(1, 5000);
  assignerCompartiment(2, 4000);
  marquerVide(3);
  assignerCompartiment(4, 5000);
  assignerCompartiment(5, 5000);
  marquerVide(6);
  contenu = sandbox.document.getElementById('content').innerHTML;
  assert.ok(H.controleCompartiments, 'le contrôle vs BL doit se déclencher : tous les compartiments sont soit chargés, soit explicitement vides');
  assert.strictEqual(H.controleCompartiments.coherentGlobal, true, '5000+4000+5000+5000 = 19000, exactement le BL, malgré 2 compartiments sautés (3 et 6)');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, false, '"Continuer" activé : sauter PLUSIEURS compartiments (3 et 6) n\'a jamais été bloquant');
  assert.ok(contenu.includes('Chargement cohérent avec le bon de livraison'), 'verdict cohérent malgré 2 compartiments sautés, non contigus (3 puis 6)');
  console.log('✓ 3. Compartiments 3 ET 6 vides (2 sautés, non contigus) + 1/2/4/5 chargés = 19000 L exact -> "Continuer" activé, verdict cohérent');

  console.log('\nTous les tests reception_compartiments_saut_multiple passent.');
})().catch(e => { console.error(e); process.exit(1); });
