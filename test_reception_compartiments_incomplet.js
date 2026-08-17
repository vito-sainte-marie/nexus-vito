// Test — bug réel remonté par Frédéric le 15/08/2026 (2 captures d'écran) :
// "je n'arrive pas à aller à l'étape 3 [en fait : à la valider] tant que la
// somme des compartiments ne correspond au BL [...] en revanche quand la
// quantité correspond le bouton Valider [Continuer] doit s'enclencher".
// Dans les deux exemples fournis, les quantités déclarées correspondaient
// PARFAITEMENT au BL (SP95 19000/GO 17000 puis SP95 20000/GO 10000), mais
// le bouton "Continuer vers la réception" restait grisé sans AUCUNE
// explication.
//
// Cause réelle (lecture du code, confirmée ici) : `tousAssignes` exige
// carburant + quantité + cuve_destination_id sur CHAQUE compartiment avant
// même de lancer la comparaison au BL. Le GO a 2 cuves réelles sur le site
// (pas d'auto-sélection possible, contrairement à SP95/GNR qui n'en ont
// qu'une) — il suffit d'oublier de choisir la cuve de destination sur UN
// seul compartiment GO pour que `tousAssignes` reste faux, qu'aucune
// comparaison BL n'ait jamais lieu, et que le bouton reste grisé SANS
// aucun message — exactement le symptôme décrit. Corrigé en ajoutant un
// message explicite listant précisément quel(s) compartiment(s) et quel
// champ manque encore.

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
// Réplique exacte du site réel (Réservoir 1 = SP95, Réservoir 2/3 = GO).
const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Réservoir 1', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Réservoir 2', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Réservoir 3', capacite: 10000, carburant: 'go' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Réservoir 1', capacite: 30000 }] },
    go: { actif: true, cuves: [{ id: 'cuve1', label: 'Réservoir 2', capacite: 20000 }, { id: 'cuve2', label: 'Réservoir 3', capacite: 10000 }] },
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

  // Amène à l'étape 3, exactement le scénario de la 1ère capture : SP95
  // 19000 L, GO 17000 L, 6 compartiments.
  H.demarrerVisite();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'go')._listeners.click();
  // Champ en m³ depuis le 15/08/2026 : "19" tapé -> 19000 L stockés.
  const qteSp = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  qteSp.value = '19'; qteSp._listeners.input({ target: qteSp });
  const qteGo = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'go');
  qteGo.value = '17'; qteGo._listeners.input({ target: qteGo });
  sandbox.document.getElementById('fHeureDebut').value = '2026-08-15T09:07';
  sandbox.document.getElementById('fHeureDebut')._listeners.input();
  sandbox.document.getElementById('btnContinuerLivraison')._listeners.click();
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => { el.value = '1000'; el._listeners.input(); });
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();
  assert.strictEqual(H.etape, 'compartiments');

  // `quantiteLitres` reste en Litres pour la lisibilité du test — le champ
  // étant en m³, on divise par 1000 pour simuler la saisie réelle.
  function assigner(numero, carburant, quantiteLitres, cuveId) {
    H.compartimentOuvert = numero;
    H.renderFicheCompartiment();
    sandbox.document.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === carburant)._listeners.click();
    const qte = sandbox.document.getElementById('fQteCompartiment');
    qte.value = String(quantiteLitres / 1000); qte._listeners.input({ target: qte });
    if (cuveId !== undefined) {
      const cuve = sandbox.document.getElementById('fCuveCompartiment');
      cuve.value = cuveId; cuve._listeners.change({ target: cuve });
    }
    sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  }

  // 6 compartiments, quantités PARFAITEMENT conformes au BL (comme sur la
  // capture) : 1=SP95 7000, 2=GO 3000, 3=SP95 5000, 4=SP95 7000, 5=GO 7000,
  // 6=GO 7000 — SP95=19000 ✓, GO=17000 ✓. SP95 auto-sélectionne sa cuve
  // unique ; GO en a 2 (Réservoir 2/3), la cuve DOIT être choisie
  // explicitement — le compartiment 6 ne la choisit volontairement PAS
  // (`cuveId` omis), reproduisant l'oubli réel.
  assigner(1, 'sp95', 7000, undefined); // auto-sélection cuve unique
  assigner(2, 'go', 3000, 'cuve1');
  assigner(3, 'sp95', 5000, undefined);
  assigner(4, 'sp95', 7000, undefined);
  assigner(5, 'go', 7000, 'cuve2');
  assigner(6, 'go', 7000, undefined); // <- cuve de destination jamais choisie

  const contenu = sandbox.document.getElementById('content').innerHTML;
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, true, '"Continuer" doit rester grisé (compartiment 6 sans cuve de destination)');
  assert.ok(contenu.includes('Encore incomplet'), 'Un message explicite doit apparaître au lieu d\'un bouton grisé silencieux');
  assert.ok(contenu.includes('compartiment 6'), 'Le message doit désigner précisément le compartiment 6');
  assert.ok(contenu.includes('cuve de destination'), 'Le message doit préciser que c\'est la cuve de destination qui manque (pas le carburant ni la quantité, déjà corrects)');
  console.log('✓ 1. Compartiment 6 sans cuve choisie -> bouton grisé + message explicite désignant précisément le manque');

  // Complète le compartiment 6 -> les quantités correspondent exactement
  // au BL -> "Continuer" doit maintenant s'activer, sans dérogation.
  assigner(6, 'go', 7000, 'cuve2');
  const contenu2 = sandbox.document.getElementById('content').innerHTML;
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, false, '"Continuer" doit s\'activer une fois tous les compartiments complets ET conformes au BL');
  assert.ok(!contenu2.includes('Encore incomplet'), 'Le message "Encore incomplet" doit disparaître une fois tout complété');
  assert.ok(contenu2.includes('Chargement cohérent avec le bon de livraison'), 'Le verdict "cohérent" doit remplacer le message d\'incomplétude');
  console.log('✓ 2. Compartiment 6 complété (cuve choisie) -> quantités exactement conformes au BL -> "Continuer" activé, verdict cohérent affiché');

  console.log('\nTous les tests reception_compartiments_incomplet passent.');
})().catch(e => { console.error(e); process.exit(1); });
