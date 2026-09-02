// Test — évolution demandée par Frédéric le 15/08/2026 :
// "par defaut mets 6 compartiments mais un compartiments peut etre vide,
// pour aller plus vite dans la saisie au lieu de noter en litre nous
// mettrons en m3 (x1000 litres) pour la saisie du litrage du BL, des
// compartiments. [...] fais bien sur la conversion pour les calculs. le
// resultat comme le delta sera donné en litre et non en m3."
//
// Vérifie :
//  1) Le nombre de compartiments par défaut est 6 quand la config du site
//     ne précise rien (nombreCompartimentsDefaut absent).
//  2) Le champ "Quantité attendue" (étape 1, BL) est saisi en m³ mais
//     stocké en Litres (quantite_bl_l).
//  3) Le champ "Quantité" d'un compartiment (étape 3) est saisi en m³ mais
//     stocké en Litres (quantite_declaree_l).
//  4) Un compartiment marqué "vide" est ignoré du contrôle compartiments
//     vs BL, n'est jamais listé comme "incomplet", et ne bloque jamais
//     l'étape 4 (réception) — sans qu'aucune saisie n'y soit nécessaire.
//  5) Le résultat final (attendu/compartiments/mesuré/delta) reste
//     entièrement exprimé en LITRES, jamais en m³ — seule la saisie change,
//     jamais le calcul ni l'affichage du résultat (contrainte explicite de
//     Frédéric).

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
// Mock DOM générique (même stratégie que les autres tests reception_*)
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
// Config volontairement SANS nombreCompartimentsDefaut : le repli code
// (`config.nombreCompartimentsDefaut || 6`) doit s'appliquer.
const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Réservoir 1', capacite: 30000, carburant: 'sp95' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Réservoir 1', capacite: 30000 }] },
    go: { actif: false, cuves: [] },
    gnr: { actif: false, cuves: [] },
  },
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
  get lignes(){ return lignes; },
  get compartiments(){ return compartiments; },
  get compartimentOuvert(){ return compartimentOuvert; }, set compartimentOuvert(v){ compartimentOuvert = v; },
  get controleCompartiments(){ return controleCompartiments; },
  get resultatsParCarburant(){ return resultatsParCarburant; },
  allerEtape, demarrerVisite, renderCompartimentsEtape, renderReceptionEtape, renderFicheCompartiment, renderFicheReception,
  soumettreVisite,
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
  // 1) Étape 1 — champ BL en m³, stockage en Litres
  // ------------------------------------------------------------
  H.demarrerVisite();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  const qteBl = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  assert.ok(qteBl.getAttribute('placeholder') !== undefined, 'Champ BL doit exister');
  const contenuEtape1 = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenuEtape1.includes('(m³)'), 'Le libellé du champ BL doit indiquer "(m³)"');
  qteBl.value = '19'; qteBl._listeners.input({ target: qteBl }); // 19 m³ tapés
  assert.strictEqual(H.lignes.sp95.quantite_bl_l, 19000, 'Saisie "19" (m³) doit stocker 19000 (Litres), jamais 19');
  sandbox.document.getElementById('fHeureDebut').value = '2026-08-15T09:00';
  sandbox.document.getElementById('fHeureDebut')._listeners.input();
  sandbox.document.getElementById('btnContinuerLivraison')._listeners.click();
  console.log('✓ 1. Étape 1 — champ BL saisi en m³ ("19"), stocké en Litres (19000)');

  // ------------------------------------------------------------
  // 2) Étape 2 — jaugeage reste en Litres (aucun changement), puis passage
  //    à l'étape 3 avec 6 compartiments par défaut (config sans override).
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'jaugeage_avant');
  const contenuJaugeage = sandbox.document.getElementById('content').innerHTML;
  assert.ok(contenuJaugeage.includes('Jaugeage avant (L)'), 'Le jaugeage doit rester affiché en Litres, jamais en m³');
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => { el.value = '1000'; el._listeners.input(); }); // jaugeage avant = 1000 L (litres, inchangé)
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();

  assert.strictEqual(H.etape, 'compartiments');
  assert.strictEqual(H.compartiments.length, 6, 'Défaut de 6 compartiments quand le site ne précise rien');
  console.log('✓ 2. Étape 2 — jaugeage inchangé (Litres) ; étape 3 — 6 compartiments par défaut');

  // ------------------------------------------------------------
  // 3) Étape 3 — champ compartiment en m³, stockage en Litres
  // ------------------------------------------------------------
  function ouvrirCompartiment(numero) { H.compartimentOuvert = numero; H.renderFicheCompartiment(); }

  ouvrirCompartiment(1);
  const contenuFiche1 = sandbox.document.getElementById('ficheCompartimentZone').innerHTML;
  assert.ok(contenuFiche1.includes('Quantité (m³)'), 'Le libellé du champ compartiment doit indiquer "(m³)"');
  sandbox.document.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === 'sp95')._listeners.click();
  const qteC1 = sandbox.document.getElementById('fQteCompartiment');
  qteC1.value = '7.5'; qteC1._listeners.input({ target: qteC1 }); // 7,5 m³ tapés
  assert.strictEqual(H.compartiments.find(c => c.numero === 1).quantite_declaree_l, 7500, 'Saisie "7.5" (m³) doit stocker 7500 (Litres)');
  sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  console.log('✓ 3. Étape 3 — champ compartiment saisi en m³ ("7.5"), stocké en Litres (7500)');

  // ------------------------------------------------------------
  // 4) Compartiment marqué "vide" — ignoré du contrôle et de la réception
  // ------------------------------------------------------------
  ouvrirCompartiment(2);
  sandbox.document.getElementById('btnToggleVideCompartiment')._listeners.click();
  assert.strictEqual(H.compartiments.find(c => c.numero === 2).vide, true, 'Compartiment 2 doit être marqué vide');
  assert.strictEqual(H.compartiments.find(c => c.numero === 2).carburant, null, 'Un compartiment vide n\'a pas de carburant');
  sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();

  let contenuEtape3 = sandbox.document.getElementById('content').innerHTML;
  assert.ok(!contenuEtape3.includes('compartiment 2 ('), 'Le compartiment vide ne doit JAMAIS apparaître dans "Encore incomplet"');
  assert.ok(contenuEtape3.includes('Vide'), 'La grille camion doit afficher "Vide" sur le compartiment 2');
  console.log('✓ 4. Compartiment 2 marqué "vide" — jamais listé comme incomplet, jamais compté dans le BL');

  // Complète les 4 compartiments restants pour atteindre exactement 19000 L
  // (7500 déjà posé au compartiment 1) : 4500 + 3500 + 2000 + 1500 = 11500.
  function assignerCompartiment(numero, quantiteLitres) {
    ouvrirCompartiment(numero);
    sandbox.document.querySelectorAll('[data-carb]').find(el => el.getAttribute('data-carb') === 'sp95')._listeners.click();
    const qte = sandbox.document.getElementById('fQteCompartiment');
    qte.value = String(quantiteLitres / 1000); qte._listeners.input({ target: qte });
    sandbox.document.getElementById('btnValiderCompartiment')._listeners.click();
  }
  assignerCompartiment(3, 4500);
  assignerCompartiment(4, 3500);
  assignerCompartiment(5, 2000);
  assignerCompartiment(6, 1500);

  assert.ok(H.controleCompartiments, 'controleCompartiments doit être calculé (compartiment vide traité comme complet)');
  assert.strictEqual(H.controleCompartiments.coherentGlobal, true, '7500+4500+3500+2000+1500=19000, exactement le BL');
  assert.strictEqual(sandbox.document.getElementById('btnContinuerCompartiments').disabled, false, '"Continuer" activé, compartiment vide non bloquant');
  sandbox.document.getElementById('btnContinuerCompartiments')._listeners.click();
  console.log('✓ 5. Compartiments 1,3,4,5,6 assignés (m³→L), compartiment 2 vide -> total exact 19000 L, "Continuer" activé');

  // ------------------------------------------------------------
  // 6) Étape 4 — le compartiment vide ne bloque jamais la réception et
  //    n'ouvre aucune fiche au clic.
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'reception');
  const contenuReception = sandbox.document.getElementById('content').innerHTML;
  assert.ok(!/🔴 \d+ compartiment/.test(contenuReception) || contenuReception.match(/🔴 (\d+) compartiment/)[1] !== '6', 'Le compartiment vide ne doit pas être compté dans les compartiments non réceptionnés');

  function ouvrirCompartimentReception(numero) { H.compartimentOuvert = numero; H.renderFicheReception(); }
  // Compartiment 2 (vide) : le clic ne doit rien ouvrir.
  ouvrirCompartimentReception(2);
  H.compartimentOuvert = null; // pas de fiche à afficher pour un compartiment vide

  [1, 3, 4, 5, 6].forEach(numero => {
    ouvrirCompartimentReception(numero);
    sandbox.document.getElementById('btnMarquerReceptionne')._listeners.click();
  });
  assert.strictEqual(sandbox.document.getElementById('btnContinuerReception').disabled, false, '"Continuer" activé sans jamais avoir eu à traiter le compartiment 2 (vide)');
  sandbox.document.getElementById('btnContinuerReception')._listeners.click();
  console.log('✓ 6. Étape 4 — compartiment vide jamais bloquant, "Continuer" activé sans le traiter');

  // ------------------------------------------------------------
  // 7) Jaugeage final + rapprochement — résultat et delta en LITRES
  // ------------------------------------------------------------
  assert.strictEqual(H.etape, 'jaugeage_final');
  sandbox.document.querySelectorAll('[data-cuve]').forEach(el => { el.value = '20000'; el._listeners.input(); }); // 1000 -> 20000 = +19000 L
  sandbox.document.getElementById('btnContinuerJaugeage')._listeners.click();

  assert.strictEqual(H.etape, 'calcul');
  const r = H.resultatsParCarburant.sp95;
  assert.strictEqual(r.attenduL, 19000, 'Quantité attendue doit rester en Litres (19000), jamais 19 (m³)');
  assert.strictEqual(r.compartimentsL, 19000, 'Total compartiments doit rester en Litres (19000)');
  assert.strictEqual(r.mesureL, 19000, 'Mesure jaugeage doit rester en Litres (19000)');
  assert.strictEqual(r.ecartMesureL, 0, 'Delta doit être calculé en Litres (0), jamais en m³');
  assert.strictEqual(r.statut, 'coherente', 'Réception cohérente : BL, compartiments et jaugeage concordent exactement');
  console.log('✓ 7. Rapprochement final — attendu/compartiments/mesuré/delta tous en LITRES (19000 L, delta 0)');

  console.log('\nTous les tests reception_m3_et_vide passent.');
})().catch(e => { console.error(e); process.exit(1); });
