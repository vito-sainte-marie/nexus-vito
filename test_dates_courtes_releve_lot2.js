// Test de NEXUS-Dates-Courtes-Releve-v1.html (Lot 2, revue Guardian du 22/11/2026, point 10).
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
const bouton = (act, attrs = {}) => ({ target: { closest: () => ({ getAttribute: k => (k === 'data-act' ? act : attrs[k]) }) } });
const tick = () => new Promise(r => setTimeout(r, 0));
const EMP = { id: 'emp-1', role: 'renfort', est_createur: false };
const TOURNEE = { id: 'tour-1', nom: '', etat: 'EN_COURS' };

(async () => {
  console.log('Page Dates courtes, relevé employé (Lot 2)');

  await test('analyserCode : EAN-8, EAN-13, GS1 01 et 17, jour 00', () => {
    const { dc } = monde();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.analyserCode('96385074'))), { ean: '96385074', date: null });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.analyserCode('3168930171683'))), { ean: '3168930171683', date: null });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.analyserCode('0103168930171683'))), { ean: '3168930171683', date: null });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.analyserCode('(01)03168930171683(17)270615'))), { ean: '3168930171683', date: '2027-06-15' });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.analyserCode('0103168930171683172702' + '00'))), { ean: '3168930171683', date: '2027-02-28' });
    assert.strictEqual(dc.analyserCode('abc'), null);
    assert.strictEqual(dc.analyserCode(''), null);
  });

  await test('file : la clé est créée au geste et reprise au renvoi', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.reponses.rpc = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await m.dc.empiler('releve', { ean: '3168930171683', date_limite: '2027-01-10', quantite: 3 }, 'Jus', '2027-01-10', 3);
    const cle = m.dc.lireFile()[0].cle;
    assert(cle, 'clé créée au geste');
    m.reponses.rpc = () => ({ data: { ok: true }, error: null });
    await m.dc.vider();
    const envois = m.appels.filter(a => a.nom === 'dates_courtes_enregistrer');
    assert.strictEqual(envois.length, 2);
    assert.strictEqual(envois[0].args.p_cle_idempotence, cle);
    assert.strictEqual(envois[1].args.p_cle_idempotence, cle, 'même clé au renvoi');
    assert.strictEqual(m.dc.lireFile().length, 0, 'file vidée après succès');
  });

  await test('file : « Failed to fetch » laisse En attente', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.reponses.rpc = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await m.dc.empiler('releve', { ean: '1', date_limite: '2027-01-10', quantite: 1 }, 'X', '2027-01-10', 1);
    const f = m.dc.lireFile();
    assert.strictEqual(f.length, 1); assert.strictEqual(f[0].etat, 'attente');
  });

  await test('file : rejet réseau (promesse rejetée) laisse En attente', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.ctx.nexusClient.rpc = () => Promise.reject(new Error('offline'));
    await m.dc.empiler('releve', { ean: '1', date_limite: '2027-01-10', quantite: 1 }, 'X', '2027-01-10', 1);
    assert.strictEqual(m.dc.lireFile()[0].etat, 'attente');
  });

  await test('file : un code serveur passe en Refusé avec sa raison', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.reponses.rpc = () => ({ data: null, error: { message: 'quantite_invalide : La quantité doit être positive.' } });
    await m.dc.empiler('releve', { ean: '1', date_limite: '2027-01-10', quantite: 0 }, 'X', '2027-01-10', 0);
    const f = m.dc.lireFile();
    assert.strictEqual(f[0].etat, 'refuse');
    assert.strictEqual(f[0].raison, 'La quantité doit être positive.');
    assert.strictEqual(m.dc.enAttente().length, 0);
  });

  await test('file : non_authentifie reste En attente', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.reponses.rpc = () => ({ data: null, error: { message: 'non_authentifie : Session expirée.' } });
    await m.dc.empiler('releve', { ean: '1', date_limite: '2027-01-10', quantite: 1 }, 'X', '2027-01-10', 1);
    assert.strictEqual(m.dc.lireFile()[0].etat, 'attente');
  });

  await test('Terminer est bloqué quand une saisie est En attente', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE, lignes: [] });
    m.dc.ecrireFile([{ cle: 'k1', op: 'releve', donnees: { tournee_id: 'tour-1' }, etat: 'attente', libelle: 'X', date: '', qte: 1, raison: '' }]);
    m.dc.clic(bouton('confirmer-fin'));
    await tick();
    assert.strictEqual(m.appels.filter(a => a.nom === 'dates_courtes_terminer_tournee').length, 0, 'aucune clôture envoyée');
    assert(/en attente/i.test(m.get('ecran').innerHTML), 'message explicite');
    assert(/disabled/.test(m.get('ecran').innerHTML), 'bouton inactif');
  });

  await test('Terminer part quand rien n\'est En attente', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE, lignes: [] });
    m.dc.clic(bouton('confirmer-fin'));
    await tick();
    assert.strictEqual(m.appels.filter(a => a.nom === 'dates_courtes_terminer_tournee').length, 1);
  });

  for (const role of ['pompiste', 'vacataire']) {
    await test('refus de ' + role + ' (aucun appel, écran de refus)', async () => {
      const m = monde(); m.dc.etat({ employee: { id: 'e', role } });
      m.dc.init(); await tick();
      assert(/Accès non autorisé/.test(m.get('ecran').innerHTML));
      assert.strictEqual(m.appels.length, 0);
    });
  }

  await test('caissier sans accès ouvert : écran de refus', async () => {
    const m = monde(); m.reponses.acces = [{ actif: false }];
    m.dc.etat({ employee: { id: 'e', role: 'caissier', est_createur: false } });
    m.dc.init(); await tick(); await tick();
    assert(/Accès non ouvert/.test(m.get('ecran').innerHTML));
  });

  await test('caissier avec accès ouvert : accède aux tournées', async () => {
    const m = monde(); m.reponses.acces = [{ actif: true }];
    m.dc.etat({ employee: { id: 'e', role: 'caissier', est_createur: false } });
    m.dc.init(); await tick(); await tick();
    assert(/Mes tournées/.test(m.get('ecran').innerHTML));
  });

  await test('reprise automatique : visibilitychange et toutes les 30 s', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: TOURNEE });
    m.reponses.rpc = () => ({ data: null, error: { message: 'Failed to fetch' } });
    await m.dc.empiler('releve', { ean: '1', date_limite: '2027-01-10', quantite: 1 }, 'X', '2027-01-10', 1);
    const avant = m.appels.length;
    m.reponses.rpc = () => ({ data: {}, error: null });
    const vis = (m.ecouteurs.doc.visibilitychange || [])[0];
    assert(vis, 'écouteur visibilitychange');
    vis(); await tick(); await tick();
    assert(m.appels.length > avant, 'renvoi à la reprise de visibilité');
    assert.strictEqual(m.dc.lireFile().length, 0);
    const iv = m.intervalles.find(i => i.ms === 30000);
    assert(iv, 'minuteur de 30 s');
    m.dc.ecrireFile([{ cle: 'k2', op: 'releve', donnees: { tournee_id: 'tour-1' }, etat: 'attente', libelle: 'X', date: '', qte: 1, raison: '' }]);
    const avant2 = m.appels.length;
    iv.fn(); await tick(); await tick();
    assert(m.appels.length > avant2, 'renvoi au minuteur');
  });

  await test('correction : répartie sur les relevés, jamais seulement le dernier', () => {
    const { dc } = monde();
    const l = { releves: [{ id: 'a', q: 6 }, { id: 'b', q: 4 }] };
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.repartir(l, -7))), [{ id: 'b', delta: -4 }, { id: 'a', delta: -3 }]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.repartir(l, 3))), [{ id: 'b', delta: 3 }]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.repartir(l, -2))), [{ id: 'b', delta: -2 }]);
  });

  await test('annulation : une clé par relevé, le relevé visé est celui du bouton', async () => {
    const m = monde();
    m.dc.etat({ employee: EMP, tournee: TOURNEE, lignes: [{ k: 'x', ean: '1', libelle: 'Jus', date: '2027-01-10', releves: [{ id: 'a', q: 6 }, { id: 'b', q: 4 }], total: 10, retire: 0 }] });
    m.get('fMotif').value = 'Erreur de saisie';
    m.dc.clic(bouton('v-annule', { 'data-i': '0', 'data-r': '0' }));
    await tick();
    const ann = m.appels.filter(x => x.nom === 'dates_courtes_enregistrer' && x.args.p_operation === 'annulation');
    assert.strictEqual(ann.length, 1);
    assert.strictEqual(ann[0].args.p_donnees.id, 'a', 'premier relevé, pas le dernier');
    assert.strictEqual(ann[0].args.p_donnees.cible, 'releves');
  });

  await test('fiche Corriger : actions et Fermer d\'abord, clavier seulement après « Corriger la quantité »', () => {
    const m = monde();
    m.dc.etat({ employee: EMP, tournee: TOURNEE, lignes: [{ k: 'x', ean: '3168930171683', libelle: 'Jus', date: '2027-01-10', releves: [{ id: 'a', q: 6 }], total: 6, retire: 0 }] });
    m.dc.ouvrirAction(0);
    const h = m.get('fiche').innerHTML;
    for (const a of ['a-corr', 'a-date', 'a-trouve', 'a-annule']) assert(h.includes('data-act="' + a + '"'), a + ' présent');
    assert(h.includes('Corriger la quantité'));
    assert(!h.includes('f-touche') && !h.includes('fQteAff'), 'pas de clavier à l\'ouverture');
    m.dc.clic(bouton('a-corr', { 'data-i': '0' }));
    const z = m.get('ficheZone').innerHTML;
    assert(z.includes('f-touche') && z.includes('fQteAff'), 'clavier après le choix');
    assert(z.includes('Valider la quantité') && z.includes('data-act="v-corr"'));
  });

  await test('libellé vide ou réduit à un code : « Produit non identifié »', () => {
    const m = monde();
    for (const l of ['', '   ', '3168930171683', null]) {
      assert.strictEqual(m.dc.nomAff({ libelle: l }), 'Produit non identifié', JSON.stringify(l));
    }
    assert.strictEqual(m.dc.nomAff({ libelle: 'Jus' }), 'Jus');
  });

  await test('chaque data-act de la page a un case et mène à un écran', () => {
    const utilises = new Set();
    for (const mm of script.matchAll(/data-act="([a-z-]+)"/g)) utilises.add(mm[1]);
    for (const mm of html.matchAll(/data-act="([a-z-]+)"/g)) utilises.add(mm[1]);
    assert(utilises.size > 15, 'actions détectées : ' + utilises.size);
    const manquants = [...utilises].filter(a => !new RegExp("case '" + a + "'").test(script));
    assert.deepStrictEqual(manquants, []);
  });

  await test('aucun alert() et aucun code technique affiché', () => {
    assert(!/\balert\(/.test(script), 'alert() interdit');
    for (const mot of ['trouve_retire', 'changement_date']) {
      const aff = [...script.matchAll(/'([^']*)'/g)].map(x => x[1]).filter(s => /[A-Za-zÀ-ÿ] [A-Za-zÀ-ÿ]/.test(s) && s.includes(mot));
      assert.deepStrictEqual(aff, [], mot + ' ne doit pas apparaître dans un texte affiché');
    }
  });

  console.log(`\n${passes} réussis, ${echecs.length} échoués`);
  if (echecs.length) { console.log(echecs.join('\n')); process.exit(1); }
})();
