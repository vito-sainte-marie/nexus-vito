// Test — 2 correctifs remontés par Frédéric le 15/08/2026 sur l'étape 2
// (jaugeage initial) de NEXUS-Carburant-Reception-v1.html :
//  A) le clavier numérique du téléphone se fermait à chaque chiffre saisi,
//     causé par un re-rendu complet de #content.innerHTML sur CHAQUE
//     évènement 'input' (recréait le nœud <input> lui-même) — corrigé en
//     ne mettant plus à jour QUE les éléments dérivés (jauge, %, bandeau
//     capacité) par id, jamais l'input.
//  B) alerte capacité : si le litrage attendu (BL, étape 1) ne rentre pas
//     dans la place restante des cuves d'un carburant, un bandeau ambre
//     doit apparaître au jaugeage avant.
//
// Même stratégie que test_reception_visite_render.js (vm.runInContext sur
// le vrai script inline + mock DOM générique par registre id/attribut) —
// réutilisée ici pour rester focalisé sur l'étape 2 uniquement.

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

// Cuve SP95 unique, capacité volontairement PETITE (20 000 L) pour pouvoir
// déclencher facilement l'alerte capacité avec une livraison de 19 000 L.
const configFixture = {
  cuvesOrdonnees: [
    { id: 'unique', label: 'Réservoir 1', capacite: 20000, carburant: 'sp95' },
  ],
  cuvesCarburants: {
    sp95: { actif: true, cuves: [{ id: 'unique', label: 'Réservoir 1', capacite: 20000 }] },
    go: { actif: false, cuves: [] },
    gnr: { actif: false, cuves: [] },
  },
  nombreCompartimentsDefaut: 1,
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
  get mesuresParCuve(){ return mesuresParCuve; },
  allerEtape, demarrerVisite,
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

  // Amène l'écran jusqu'à l'étape 2 (jaugeage avant) avec SP95 = 19 000 L
  // attendus, pour une cuve de 20 000 L de capacité.
  H.demarrerVisite();
  sandbox.document.querySelectorAll('[data-toggle]').find(el => el.getAttribute('data-toggle') === 'sp95')._listeners.click();
  const qte = sandbox.document.querySelectorAll('[data-qte]').find(el => el.getAttribute('data-qte') === 'sp95');
  qte.value = '19000'; qte._listeners.input({ target: qte });
  sandbox.document.getElementById('fHeureDebut').value = '2026-08-15T07:00';
  sandbox.document.getElementById('fHeureDebut')._listeners.input();
  sandbox.document.getElementById('btnContinuerLivraison')._listeners.click();
  assert.strictEqual(H.etape, 'jaugeage_avant');

  // ------------------------------------------------------------
  // A) Le nœud <input> ne doit JAMAIS être recréé pendant la frappe.
  // ------------------------------------------------------------
  const inputAvant1 = sandbox.document.querySelectorAll('[data-cuve]').find(el => el.getAttribute('data-cuve') === 'sp95__unique');
  assert.ok(inputAvant1, 'Champ jaugeage avant SP95 introuvable');
  inputAvant1.value = '1000'; inputAvant1._listeners.input();
  const inputAvant2 = sandbox.document.querySelectorAll('[data-cuve]').find(el => el.getAttribute('data-cuve') === 'sp95__unique');
  assert.strictEqual(inputAvant1, inputAvant2, 'Le nœud <input> doit rester EXACTEMENT le même objet entre deux frappes (sinon le clavier mobile se ferme)');
  inputAvant2.value = '1500'; inputAvant2._listeners.input();
  const inputAvant3 = sandbox.document.querySelectorAll('[data-cuve]').find(el => el.getAttribute('data-cuve') === 'sp95__unique');
  assert.strictEqual(inputAvant2, inputAvant3, 'Le nœud <input> doit rester le même après une 2e frappe');
  assert.strictEqual(H.mesuresParCuve['sp95__unique'].jaugeage_avant_l, '1500', 'La valeur saisie doit être mémorisée malgré l\'absence de re-rendu complet');
  console.log('✓ A. Étape 2 — le champ jaugeage reste le même nœud DOM d\'une frappe à l\'autre (clavier ne se ferme plus)');

  // La jauge visuelle (%) doit malgré tout se mettre à jour en direct.
  const pctTexte = sandbox.document.getElementById('jaugePct_sp95__unique');
  assert.ok(pctTexte, 'Élément #jaugePct_sp95__unique introuvable');
  assert.ok(pctTexte.textContent.includes('%'), 'Le pourcentage affiché doit contenir "%"');
  assert.ok(pctTexte.textContent.includes('7,5') || pctTexte.textContent.includes('7.5'), `Pourcentage attendu ~7,5 % (1500/20000), obtenu "${pctTexte.textContent}"`);
  console.log('✓ A-bis. La jauge visuelle (%) se met bien à jour malgré l\'absence de re-rendu complet');

  // ------------------------------------------------------------
  // B) Alerte capacité — 1500 L déjà jaugés + 19 000 L attendus = 20 500 L
  //    pour une cuve de 20 000 L => dépassement de 500 L, doit apparaître.
  // ------------------------------------------------------------
  let alerteZone = sandbox.document.getElementById('jaugeageAlerteZone');
  assert.ok(alerteZone, 'Zone #jaugeageAlerteZone introuvable');
  assert.ok(alerteZone.innerHTML.includes('la livraison risque de ne pas rentrer'), 'Alerte capacité attendue (19000+1500 > 20000)');
  assert.ok(alerteZone.innerHTML.includes('SP95'), 'Alerte capacité doit citer le carburant concerné');
  console.log('✓ B. Alerte capacité — dépassement détecté et affiché en direct pendant la saisie du jaugeage avant');

  // Redescend sous la capacité (jaugeage avant = 500 => 19000+500=19500 < 20000) : l'alerte doit disparaître.
  inputAvant3.value = '500'; inputAvant3._listeners.input();
  alerteZone = sandbox.document.getElementById('jaugeageAlerteZone');
  assert.strictEqual(alerteZone.innerHTML.trim(), '', 'Alerte capacité doit disparaître une fois la livraison à nouveau compatible avec la place disponible');
  console.log('✓ B-bis. Alerte capacité — disparaît en direct dès que la livraison rentre à nouveau');

  console.log('\nTous les tests reception_jaugeage_correctifs passent.');
})().catch(e => { console.error(e); process.exit(1); });
