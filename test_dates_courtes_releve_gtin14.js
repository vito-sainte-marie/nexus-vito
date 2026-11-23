// Test de NEXUS-Dates-Courtes-Releve-v1.html (normalisation GTIN-14 des codes-barres).
// Même approche que test_dates_courtes_releve_lot2_1.js : script inline dans un contexte vm, client Supabase simulé.
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
const bouton = (act, attrs = {}) => ({ target: { closest: () => ({ getAttribute: k => (k === 'data-act' ? act : attrs[k]) }) } });
const tick = () => new Promise(r => setTimeout(r, 0));
const EMP = { id: 'emp-1', role: 'renfort', est_createur: false };

// Codes de calcul : la clé mod-10 est recalculée ici, indépendamment de la page.
function cle(corps) { let s = 0; for (let i = 0; i < corps.length; i++) s += +corps[corps.length - 1 - i] * (i % 2 === 0 ? 3 : 1); return String((10 - s % 10) % 10); }
const avec = c => c + cle(c);
const UPCA = avec('12345678901');            // 12 chiffres
const EAN13 = '0' + UPCA;                    // même GTIN-14 que l'UPC-A
const EAN8 = avec('1234567');
const GTIN14_0 = '0' + EAN13;                // GTIN-14 commençant par 0
const COLIS = avec('1234567890123');         // 14 chiffres, ne commence pas par 0
const ONZE = UPCA.slice(0, 11);
const mauvaiseCle = EAN13.slice(0, 12) + String((+EAN13[12] + 1) % 10);

function nouveau() {
  const m = monde();
  m.dc.etat({ employee: EMP, tournee: { id: 't-1', nom: 'N', etat: 'EN_COURS', commencee_a: '10 h 00' } });
  return m;
}
async function lire(m, texte, lignes, camera) {
  m.reponses.rpc = (nom) => ({ data: nom === 'dates_courtes_rechercher_produit' ? (lignes || []) : {}, error: null });
  m.dc.reconnaitre(texte, !!camera);
  await tick(); await tick();
}
const recherches = m => m.appels.filter(x => x.nom === 'dates_courtes_rechercher_produit');
async function enregistrer3(m) {
  await m.dc.clic(bouton('touche', { 'data-k': '3' }));
  await m.dc.clic(bouton('enregistrer'));
  await tick(); await tick();
  const a = m.appels.filter(x => x.nom === 'dates_courtes_enregistrer')[0];
  return a ? { op: a.args.p_operation, donnees: a.args.p_donnees } : null;
}

(async () => {
  console.log('Page Dates courtes, normalisation GTIN-14');

  await test('classerCode : forme de stockage EAN-13 (UPC-A, EAN-13, GTIN-14 en 0, GTIN-8)', () => {
    const c = monde().dc.classerCode;
    assert.strictEqual(c(UPCA).ean, EAN13);
    assert.strictEqual(c(EAN13).ean, EAN13);
    assert.strictEqual(c(GTIN14_0).ean, EAN13);
    assert.strictEqual(c(EAN8).ean, EAN8);
    assert.strictEqual(c(UPCA).g14, '00' + UPCA);
    assert.strictEqual(c(EAN8).g14, '000000' + EAN8);
    assert.strictEqual(c(UPCA).etat, 'ok');
  });

  await test('classerCode : colis GTIN-14 hors 0 = logistique, jamais converti en EAN-13', () => {
    const r = monde().dc.classerCode(COLIS);
    assert.strictEqual(r.etat, 'logistique');
    assert.strictEqual(r.ean, null);
    assert.strictEqual(r.g14, COLIS);
  });

  await test('classerCode : 9, 10, 11 chiffres incomplets et jamais complétés', () => {
    const c = monde().dc.classerCode;
    ['123456789', '1234567890', ONZE].forEach(x => {
      const r = c(x); assert.strictEqual(r.etat, 'incomplet'); assert.strictEqual(r.g14, null); assert.strictEqual(r.ean, null); assert.strictEqual(r.brut, x);
    });
  });

  await test('classerCode : clé fausse, lettres, 15 chiffres refusés', () => {
    const c = monde().dc.classerCode;
    assert.strictEqual(c(mauvaiseCle).etat, 'cle_invalide');
    assert(['refuse', 'cle_invalide'].includes(c('12A456789012').etat));
    assert.notStrictEqual(c('0' + GTIN14_0).etat, 'ok');
    assert.strictEqual(c('0' + GTIN14_0).g14 || null, null);
  });

  await test('analyserCode : AI 01 + AI 17 (jour 00 = fin de mois), GTIN-14 en 0 ramené à l\'EAN-13', () => {
    const dc = monde().dc;
    const a = dc.analyserCode('01' + GTIN14_0 + '17280200');
    assert.strictEqual(a.ean, EAN13);
    assert.strictEqual(a.date, '2028-02-29');
    assert.strictEqual(dc.analyserCode('01' + COLIS).etat, 'logistique');
  });

  await test('Saisie ou douchette, UPC-A 12 chiffres : recherche en GTIN-14, article trouvé, ean = EAN-13', async () => {
    const m = nouveau();
    await lire(m, UPCA, [{ libelle: 'LAIT DEMI', ean: EAN13, rayon: 'Frais' }]);
    assert.strictEqual(recherches(m)[0].args.p_requete, '00' + UPCA);
    const h = m.get('ecran').innerHTML;
    assert(h.includes('LAIT DEMI'));
    assert(!h.includes('Identification à vérifier'));
    assert(h.includes(EAN13));
  });

  await test('UPC-A (AI 01 + AI 17) puis scan 13 chiffres : même article, même ean EAN-13 enregistré', async () => {
    const lignes = [{ libelle: 'LAIT DEMI', ean: EAN13, rayon: 'Frais' }];
    const eans = [];
    for (const texte of ['01' + '00' + UPCA + '17301231', '01' + '0' + EAN13 + '17301231']) {
      const m = nouveau();
      await lire(m, texte, lignes);
      assert.strictEqual(recherches(m)[0].args.p_requete, '00' + UPCA);
      const it = await enregistrer3(m);
      assert(it, 'une entrée empilée');
      assert.strictEqual(it.donnees.date_limite, '2030-12-31');
      assert.strictEqual(it.donnees.nom_libre, undefined);
      eans.push(it.donnees.ean);
    }
    assert.deepStrictEqual(eans, [EAN13, EAN13]);
  });

  await test('Code valide inconnu : entrée provisoire, ean EAN-13 conservé, code lu visible', async () => {
    const m = nouveau();
    await lire(m, UPCA, []);
    const h = m.get('ecran').innerHTML;
    assert(h.includes('Identification à vérifier'));
    assert(h.includes(EAN13));
    assert(h.includes('lu : ' + UPCA));
  });

  await test('11 chiffres saisis : « Code incomplet, à vérifier », aucune recherche, rien n\'est complété', async () => {
    const m = nouveau();
    await lire(m, ONZE, [{ libelle: 'NE DOIT PAS ETRE TROUVE', ean: EAN13, rayon: 'x' }]);
    assert.strictEqual(recherches(m).length, 0);
    const h = m.get('ecran').innerHTML;
    assert(h.includes('Code incomplet, à vérifier'));
    assert(h.includes(ONZE));
    assert(!h.includes('NE DOIT PAS'));
  });

  await test('11 chiffres + date saisie : ean null, libellé non vide, code lu dans nom_libre', async () => {
    const m = nouveau();
    let onChange = null;
    m.get('champDate').addEventListener = (t, f) => { if (t === 'change') onChange = f; };
    await lire(m, ONZE, []);
    assert(onChange, 'champ date câblé');
    m.get('champDate').value = '2030-12-31'; onChange();
    const it = await enregistrer3(m);
    assert(it, 'une entrée envoyée');
    assert.strictEqual(it.donnees.ean, null);
    assert(it.donnees.libelle && it.donnees.libelle.length > 0);
    assert.strictEqual(it.donnees.nom_libre, 'Code lu : ' + ONZE);
  });

  await test('Clé fausse : message de refus, aucune recherche', async () => {
    const m = nouveau();
    m.get('scanMsg');
    await lire(m, mauvaiseCle, []);
    assert.strictEqual(recherches(m).length, 0);
    assert(m.get('scanMsg').textContent.includes('clé de contrôle'));
  });

  await test('Deux articles pour le même code : « Plusieurs articles pour ce code », aucun choix automatique', async () => {
    const m = nouveau();
    await lire(m, UPCA, [{ libelle: 'LAIT A', ean: EAN13, rayon: 'Frais' }, { libelle: 'LAIT B', ean: UPCA, rayon: 'Frais' }]);
    const h = m.get('ecran').innerHTML;
    assert(h.includes('Plusieurs articles pour ce code'));
    assert(h.includes('LAIT A') && h.includes('LAIT B'));
    assert(!h.includes('data-act="enregistrer"'));
  });

  await test('Caméra : une lecture à 11 chiffres ne déclenche aucune recherche et ouvre aucune saisie', async () => {
    const m = nouveau();
    m.dc.ecranIdentifier();
    await lire(m, ONZE, [], true);
    assert.strictEqual(recherches(m).length, 0);
    assert(!m.get('ecran').innerHTML.includes('Code incomplet, à vérifier ·'));
  });

  console.log(`\n${passes} réussis, ${echecs.length} échecs`);
  process.exit(echecs.length ? 1 : 0);
})();
