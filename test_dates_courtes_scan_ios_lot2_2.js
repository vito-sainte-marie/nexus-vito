// Test de NEXUS-Dates-Courtes-Releve-v1.html (Lot 2.2, scan caméra sur Safari iOS, sans BarcodeDetector).
// Même approche que test_reception_v1_dom.js : pas de navigateur, le script inline
// tourne dans un contexte vm avec un DOM minimal et un client Supabase simulé.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(`${__dirname}/NEXUS-Dates-Courtes-Releve-v1.html`, 'utf-8');
const script = /<script>(?:(?!<\/script>)[\s\S])*?\(function\(\)\{[\s\S]*?<\/script>/.exec(html)
  ? [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0]
  : null;
assert(script, 'script inline introuvable');

let passes = 0;
const echecs = [];
async function test(nom, fn) {
  try { await fn(); passes++; console.log('  ok  ' + nom); }
  catch (e) { echecs.push(nom); console.log('  KO  ' + nom + '\n      ' + (e && e.message)); }
}

function monde() {
  const els = {};
  function mk(id) {
    const attrs = {};
    return { id, innerHTML: '', textContent: '', value: '', hidden: false, open: false, disabled: false,
      style: {}, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
      addEventListener() {}, focus() {}, appendChild() {}, querySelectorAll() { return []; }, querySelector() { return null; },
      showModal() { this.open = true; }, close() { this.open = false; } };
  }
  const get = id => (els[id] = els[id] || mk(id));
  const ecouteurs = { doc: {}, win: {} };
  const appels = [];
  const intervalles = [];
  const reponses = { rpc: () => ({ data: {}, error: null }), acces: [{ actif: true }] };
  const requete = (table) => {
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; },
      then(ok, ko) { const data = table === 'dates_courtes_acces_caissier' ? reponses.acces : []; return Promise.resolve({ data, error: null }).then(ok, ko); } };
    return q;
  };
  const stockage = {};
  const ctx = {
    console, Date, Math, JSON, parseInt, parseFloat, Promise, setTimeout, clearTimeout, String, Number, Object, Array, RegExp, Error,
    setInterval: (fn, ms) => { intervalles.push({ fn, ms }); return intervalles.length; }, clearInterval() {},
    document: { body: mk('body'), head: mk('head'), hidden: false, activeElement: null,
      getElementById: get, createElement: () => mk('x'), querySelector: () => null, querySelectorAll: () => [],
      addEventListener: (t, f) => { (ecouteurs.doc[t] = ecouteurs.doc[t] || []).push(f); } },
    localStorage: { getItem: k => (k in stockage ? stockage[k] : null), setItem: (k, v) => { stockage[k] = String(v); } },
    navigator: {},
    crypto: { randomUUID: (() => { let n = 0; return () => 'uuid-' + (++n); })() },
    nexusClient: {
      rpc: (nom, args) => { appels.push({ nom, args }); return Promise.resolve(reponses.rpc(nom, args)); },
      from: requete,
    },
    nexusRequireAuth: () => Promise.resolve(null),
  };
  ctx.window = ctx;
  ctx.__DC_TEST__ = true;
  ctx.window.addEventListener = (t, f) => { (ecouteurs.win[t] = ecouteurs.win[t] || []).push(f); };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return { dc: ctx.__dc, ctx, els, get, ecouteurs, appels, intervalles, reponses, stockage };
}

const tick = () => new Promise(r => setTimeout(r, 0));
const EMP = { id: 'emp-1', role: 'renfort', est_createur: false };

// Faux ZXing qui RESPECTE la signature réelle de @zxing/library 0.21.3 :
//  - decodeFromVideoElement(source) renvoie une promesse et IGNORE tout rappel ;
//  - decodeFromVideoElementContinuously(source, rappel) appelle le rappel (res, err) à chaque image.
function fauxZxing() {
  const z = { lecteurs: [], hints: null, aLire: [] };
  z.BarcodeFormat = { EAN_13: 'EAN_13', EAN_8: 'EAN_8', UPC_A: 'UPC_A', UPC_E: 'UPC_E', CODE_128: 'CODE_128', ITF: 'ITF' };
  z.DecodeHintType = { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS', TRY_HARDER: 'TRY_HARDER' };
  z.BrowserMultiFormatReader = function (hints) {
    const l = { resets: 0, decodes: 0, continus: 0, unique: 0 };
    z.hints = hints; z.lecteurs.push(l);
    // Réel : decode(video) lit l'image courante, lève NotFoundException si rien ; TRY_HARDER ne lit rien ici (constat de Guardian).
    l.decode = function (video) {
      l.decodes++;
      if (hints && hints.get('TRY_HARDER')) throw { name: 'NotFoundException' };
      const t = z.aLire.shift();
      if (t === undefined) throw { name: 'NotFoundException' };
      return { getText: () => t };
    };
    // Réel : attend l'événement « playing » de la vidéo ; la page l'a déjà reçu avant le chargement de ZXing, donc rien ne démarre.
    l.decodeFromVideoElementContinuously = function () { l.continus++; };
    l.decodeFromVideoElement = function () { l.unique++; return new Promise(() => {}); };
    l.reset = function () { l.resets++; };
    return l;
  };
  return z;
}
function monde2(opts = {}) {
  const m = monde();
  const z = fauxZxing();
  m.ctx.ZXing = z;
  m.get('video').play = () => Promise.resolve(); m.get('video').readyState = 4;
  m.efface = [];
  m.ctx.clearInterval = (id) => { m.efface.push(id); };
  const piste = { contraintes: [], getCapabilities: () => opts.sansFocus ? {} : { focusMode: ['manual', 'continuous'] }, applyConstraints(c) { piste.contraintes.push(c); return Promise.resolve(); }, stopped: false, stop() { piste.stopped = true; } };
  const flux = { getTracks: () => [piste], getVideoTracks: () => [piste] };
  m.ctx.navigator = { mediaDevices: { getUserMedia: (c) => { m.contraintesCamera = c; return Promise.resolve(flux); } }, vibrate: (n) => { m.vibre = (m.vibre || 0) + 1; return true; } };
  const minuteurs = [];
  m.ctx.setTimeout = (fn, ms) => { minuteurs.push({ fn, ms, annule: false }); return minuteurs.length; };
  m.ctx.clearTimeout = (id) => { if (minuteurs[id - 1]) minuteurs[id - 1].annule = true; };
  m.minuteurs = minuteurs; m.z = z; m.piste = piste;
  m.reponses.rpc = (nom) => nom === 'dates_courtes_rechercher_produit' ? { data: [{ ean: '3017620422003', libelle: 'Pâte à tartiner' }], error: null } : { data: [], error: null };
  m.dc.etat({ employee: EMP, tournee: { id: 't-1', nom: 'N', etat: 'EN_COURS', commencee_a: '08 h 00' } });
  return m;
}
const attendre = async () => { for (let i = 0; i < 6; i++) await tick(); };
const res = (t) => ({ getText: () => t });

(async () => {
  console.log('Page Dates courtes, scan caméra iPhone (Lot 2.2)');

  const boucleZ = (m) => m.intervalles.find(x => x.ms === 250);
  const tour = async (m) => { boucleZ(m).fn(); await attendre(); };
  const rech = (m) => m.appels.filter(a => a.nom === 'dates_courtes_rechercher_produit');

  await test('ZXing : boucle de 250 ms avec decode(video), sans decodeFrom…Continuously (qui attend « playing »), un code lu fait avancer', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    assert(boucleZ(m), 'boucle setInterval de 250 ms');
    const l = m.z.lecteurs[0];
    assert.strictEqual(l.continus + l.unique, 0, 'aucune fonction decodeFrom… de ZXing');
    m.z.aLire.push('3017620422003'); await tour(m);
    assert.strictEqual(l.decodes, 1);
    assert(rech(m).some(a => a.args.p_requete === '03017620422003'), 'recherche du produit lue (forme GTIN-14)');
    assert.strictEqual(m.dc.lire().produit.ean, '3017620422003');
  });

  await test('Entre deux images (NotFoundException) : ignoré, la boucle continue ; pas de décodage tant que la vidéo n\'est pas prête', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    const l = m.z.lecteurs[0];
    await tour(m); await tour(m);
    assert.strictEqual(l.decodes, 2); assert.strictEqual(l.resets, 0); assert.strictEqual(rech(m).length, 0); assert.strictEqual(m.efface.length, 0);
    m.get('video').readyState = 1; await tour(m);
    assert.strictEqual(l.decodes, 2, 'readyState < 2 : pas de décodage');
  });

  await test('Un seul résultat traité : boucle, lecteur et caméra s\'arrêtent à la première lecture valide', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    const l = m.z.lecteurs[0];
    m.z.aLire.push('3017620422003', '5449000000996');
    await tour(m); await tour(m);
    assert.strictEqual(rech(m).length, 1, 'une seule recherche');
    assert.strictEqual(l.decodes, 1, 'plus de décodage après la première lecture');
    assert.strictEqual(m.efface.length, 1, 'boucle arrêtée');
    assert.strictEqual(l.resets, 1, 'lecteur arrêté');
    assert.strictEqual(m.piste.stopped, true, 'caméra arrêtée');
    assert.strictEqual(m.vibre, 1, 'courte vibration');
  });

  await test('Indices : POSSIBLE_FORMATS seul (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, ITF), sans TRY_HARDER', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    const h = m.z.hints;
    assert.deepStrictEqual([...h.get('POSSIBLE_FORMATS')].sort(), ['CODE_128', 'EAN_13', 'EAN_8', 'ITF', 'UPC_A', 'UPC_E']);
    assert.strictEqual(h.has('TRY_HARDER'), false);
    m.z.aLire.push('3017620422003'); await tour(m);
    assert.strictEqual(rech(m).length, 1, 'avec ces indices le code est lu');
  });

  await test('Caméra arrière, mise au point continue si la piste le permet', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    assert.strictEqual(m.contraintesCamera.video.facingMode.ideal, 'environment');
    assert.strictEqual(JSON.stringify(m.piste.contraintes), JSON.stringify([{ advanced: [{ focusMode: 'continuous' }] }]));
    const n = monde2({ sansFocus: true }); n.dc.ecranIdentifier(); await attendre();
    assert.strictEqual(n.piste.contraintes.length, 0);
  });

  await test('Message « Recherche du code… », puis conseil après 8 s sans lecture, annulé à la lecture', async () => {
    const m = monde2(); m.dc.ecranIdentifier(); await attendre();
    assert.strictEqual(m.get('scanMsg').textContent, 'Recherche du code…');
    const t = m.minuteurs.find(x => x.ms === 8000); assert(t, 'minuteur de 8 s');
    t.fn();
    assert.strictEqual(m.get('scanMsg').textContent, 'Approchez le code à 10 à 15 cm, bien éclairé, ou saisissez-le ci-dessous');
    const n = monde2(); n.dc.ecranIdentifier(); await attendre();
    n.z.aLire.push('3017620422003'); await tour(n);
    assert.strictEqual(n.minuteurs.find(x => x.ms === 8000).annule, true, 'minuteur annulé');
  });

  console.log(`\n${passes} ok, ${echecs.length} KO`);
  if (echecs.length) process.exit(1);
})();
