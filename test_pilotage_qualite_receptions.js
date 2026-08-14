// Test dédié au sous-bloc "Qualité des réceptions" ajouté dans
// NEXUS-Carburants-Pilotage-v1.html (14/08/2026) — même harnais que
// test_pilotage_redesign_dom.js (mock global + table CANNED par nom), mais
// cette fois avec nexus-reception-moteur.js / nexus-reception-donnees.js
// réellement chargés et des lignes carburant_receptions/
// carburant_reception_mesures fournies, pour vérifier le rendu réel du
// nouveau sous-accordéon (pas seulement l'absence d'exception).
const fs = require('fs');
const assert = require('assert');
const path = '/sessions/dazzling-compassionate-ride/mnt/image nexus project/NEXUS-Carburants-Pilotage-v1.html';
const html = fs.readFileSync(path, 'utf-8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

const afterHead = html.split('</head>')[1];
const body = afterHead.split('<script>')[0];
const staticIds = [...new Set([...body.matchAll(/id="([^"]+)"/g)].map(m => m[1]))];
const accordionHeaders = [...body.matchAll(/<button type="button" class="accordion-header" data-key="([^"]+)">/g)].map(m => m[1]);

function makeStyleProxy() { const store = {}; return new Proxy(store, { get: (t,k)=>t[k], set:(t,k,v)=>{t[k]=v; return true;} }); }
function makeClassList() { const set = new Set(); return { add:(...c)=>c.forEach(x=>set.add(x)), remove:(...c)=>c.forEach(x=>set.delete(x)), toggle:(c,f)=>{const on=f!=null?f:!set.has(c); if(on)set.add(c); else set.delete(c); return on;}, contains:(c)=>set.has(c) }; }
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
staticIds.forEach(id => { elements[id] = makeElement(id); });
const headerEls = accordionHeaders.map(key => { const el = makeElement(null); el.dataset.key = key; el.classList = makeClassList(); return el; });

const documentStub = {
  getElementById: (id) => elements[id] || makeElement(id),
  querySelectorAll: (sel) => (sel === '.accordion-header' ? headerEls : []),
  querySelector: () => null,
  body: makeElement('body'),
};

const SITE_ID = 'site-test';
const employee = { role: 'manager', site_id: SITE_ID, id: 'mgr-1' };

const POINT_ZERO_ROW = { id: 'pz-1', site: SITE_ID, date: '2026-08-14', heure: '02:00:29', source: 'insite360', type: 'initialisation', statut: 'valide', note: null };
const POINT_ZERO_LIGNES = [{ carburant: 'go', stock_reel: 24537 }, { carburant: 'sp95', stock_reel: 22402 }, { carburant: 'gnr', stock_reel: 4371 }];
const RELEVE_JOUR = {
  site: SITE_ID, date: '2026-08-14',
  stock_reel_sp95: 22300, stock_reel_go_cuve1: 14400, stock_reel_go_cuve2: 9900, stock_reel_gnr: 4300,
  livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0, mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
};
const RECEPTION = {
  id: 'recu-1', site: SITE_ID, carburant: 'go', date_livraison: '2026-08-14',
  quantite_bl_l: 10000, statut: 'coherente', quantite_systeme_l: null, quantite_systeme_source: null,
  commentaire_rapprochement: null,
};
const RECEPTION_MESURES = [
  { reception_id: 'recu-1', cuve_id: 'cuve1', jaugeage_avant_l: 2000, jaugeage_apres_l: 8050, delta_mesure_l: 6050 },
  { reception_id: 'recu-1', cuve_id: 'cuve2', jaugeage_avant_l: 1000, jaugeage_apres_l: 5000, delta_mesure_l: 4000 },
];

global.window = global;
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-carburant-moteur.js');
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-carburant-donnees.js');
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-periodes.js');
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-reception-moteur.js');
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-reception-donnees.js');

global.document = documentStub;

const CANNED = {
  carburant_stock_references: [POINT_ZERO_ROW],
  carburant_stock_reference_lignes: POINT_ZERO_LIGNES,
  carburant_releves: [RELEVE_JOUR],
  audits_caisse: [{ date: '2026-08-14', litrage_gazole: 400, litrage_sp95: 300, litrage_gnr: 100 }],
  station_config: {
    cuves_carburants: {
      go: { actif: true, cuves: [{ label: 'Cuve 1', capacite: 30000 }, { label: 'Cuve 2', capacite: 20000 }] },
      sp95: { actif: true, cuves: [{ label: 'Cuve unique', capacite: 30000 }] },
      gnr: { actif: true, cuves: [{ label: 'Cuve unique', capacite: 10000 }] },
    },
  },
  carburant_receptions: [RECEPTION],
  carburant_reception_mesures: RECEPTION_MESURES,
};

function chainableFor(table) {
  const raw = CANNED[table];
  const arr = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
  const respond = () => ({ data: raw, error: null });
  const respondSingle = () => ({ data: arr[0] || null, error: null });
  const target = () => {};
  const proxy = new Proxy(target, {
    apply() { return proxy; },
    get(_t, prop) {
      if (prop === 'then') {
        const { data, error } = respond();
        return (onFulfilled, onRejected) => Promise.resolve({ data, error }).then(onFulfilled, onRejected);
      }
      if (prop === 'catch' || prop === 'finally') return undefined;
      if (prop === 'maybeSingle' || prop === 'single') return async () => respondSingle();
      // .eq('reception_id', 'recu-1') doit filtrer carburant_reception_mesures
      if (prop === 'eq') return (col, val) => {
        if (table === 'carburant_reception_mesures' && col === 'reception_id') {
          const filtres = RECEPTION_MESURES.filter(m => m.reception_id === val);
          return chainableForRows(table, filtres);
        }
        return proxy;
      };
      return (..._args) => proxy;
    },
  });
  return proxy;
}
function chainableForRows(table, rows) {
  const target = () => {};
  const proxy = new Proxy(target, {
    apply() { return proxy; },
    get(_t, prop) {
      if (prop === 'then') return (f, r) => Promise.resolve({ data: rows, error: null }).then(f, r);
      if (prop === 'catch' || prop === 'finally') return undefined;
      if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: rows[0] || null, error: null });
      return (..._args) => proxy;
    },
  });
  return proxy;
}

global.nexusClient = {
  from(table) {
    if (!(table in CANNED)) throw new Error('Table non mockée: ' + table);
    return chainableFor(table);
  },
};
global.nexusRequireAuth = async () => employee;
global.requestAnimationFrame = (fn) => fn();
global.alert = () => {};

(async () => {
  try {
    const vm = require('vm');
    const context = vm.createContext(global);
    const wrapped = script + '\n;globalThis.__NEXUS_TEST_HANDLE2__ = { chargerEtRendreQualiteReceptions, toggleSousAccordionQualite };';
    vm.runInContext(wrapped, context, { filename: 'pilotage-inline-qualite.js' });

    await new Promise(r => setTimeout(r, 80));

    const H = global.__NEXUS_TEST_HANDLE2__;
    assert.ok(H, 'Le handle de test doit être exposé');

    const zoneHTML = elements.qualiteReceptionsZone.innerHTML;
    assert.ok(zoneHTML.length > 0 && !zoneHTML.includes('Chargement'), `qualiteReceptionsZone doit être rempli, reçu: ${zoneHTML.slice(0,120)}`);
    assert.ok(zoneHTML.includes('Gasoil (GO)'), 'doit afficher le nom du carburant');
    assert.ok(zoneHTML.includes('10 000 L') || zoneHTML.includes('10000 L') || zoneHTML.includes('10 000'), `doit afficher la quantité BL, reçu: ${zoneHTML}`);
    assert.ok(zoneHTML.includes('Cohérente'), 'doit afficher le libellé du statut coherente');
    assert.ok(zoneHTML.includes('cuve1') && zoneHTML.includes('cuve2'), 'doit afficher chaque cuve mesurée');
    // Delta total = 6050 + 4000 = 10050
    assert.ok(/10.?050/.test(zoneHTML.replace(/ | /g, '')), `doit afficher le total mesuré terrain (10050), reçu: ${zoneHTML}`);

    // Toggle du sous-accordéon ne doit jamais lever d'exception.
    H.toggleSousAccordionQualite();
    H.toggleSousAccordionQualite();

    console.log('OK — sous-bloc "Qualité des réceptions" rendu correctement, aucune exception.');
    process.exit(0);
  } catch (e) {
    console.error('ÉCHEC TEST QUALITÉ RÉCEPTIONS:', e);
    process.exit(1);
  }
})();
