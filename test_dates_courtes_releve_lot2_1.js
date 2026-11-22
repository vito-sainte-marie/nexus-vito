// Test de NEXUS-Dates-Courtes-Releve-v1.html (Lot 2.1, nom de tournée généré et renommage).
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
  console.log('Page Dates courtes, nom de tournée (Lot 2.1)');

  await test('Nouvelle tournée : un seul geste, aucun nom envoyé, nom et heure du serveur affichés', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: null });
    m.reponses.rpc = (nom) => nom === 'dates_courtes_creer_tournee'
      ? { data: { statut: 'cree', tournee_id: 't-9', nom: 'Contrôle DLC · R1 · 22/11', commencee_a: '23 h 30' }, error: null } : { data: [], error: null };
    await m.dc.clic(bouton('nouvelle')); await tick(); await tick();
    const a = m.appels.find(x => x.nom === 'dates_courtes_creer_tournee');
    assert(a, 'appel de création');
    assert.strictEqual(a.args.p_nom, null);
    assert(a.args.p_cle_idempotence);
    assert.strictEqual(m.get('bandeNom').textContent, 'Contrôle DLC · R1 · 22/11');
    assert.strictEqual(m.get('sousTitre').textContent, 'Commencée à 23 h 30 · En cours');
  });

  await test('Mes tournées : plus de champ de nom, liste lue côté serveur, deux tournées du même jour distinguées par l\'heure', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: null });
    m.reponses.rpc = () => ({ data: [
      { id: 'a', nom: 'Contrôle DLC · R1 · 22/11', etat: 'EN_COURS', commencee_a: '14 h 05' },
      { id: 'b', nom: 'Contrôle DLC · R1 · 22/11', etat: 'CORRECTION_DEMANDEE', commencee_a: '09 h 10' }], error: null });
    m.dc.ecranTournees(); await tick(); await tick();
    const h = m.get('ecran').innerHTML;
    assert(!/nomTournee|facultatif/.test(h), 'champ supprimé');
    assert(h.includes('Commencée à 14 h 05 · En cours'));
    assert(h.includes('Commencée à 09 h 10 · Correction demandée'));
    assert.strictEqual((h.match(/Contrôle DLC · R1 · 22\/11/g) || []).length >= 2, true);
    assert(h.includes('data-act="renommer"'));
    assert(m.appels.some(x => x.nom === 'dates_courtes_lire_tournees'));
  });

  await test('étiquettes d\'état : terminée à certifier et certifiée', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: null });
    m.reponses.rpc = () => ({ data: [], error: null });
    await m.dc.ouvrirTournee({ id: 't', nom: 'N', etat: 'TERMINEE_A_CERTIFIER', commencee_a: '08 h 00' });
    assert.strictEqual(m.get('sousTitre').textContent, 'Commencée à 08 h 00 · Terminée, à certifier');
    await m.dc.ouvrirTournee({ id: 't', nom: 'N', etat: 'CERTIFIEE', commencee_a: '08 h 00' });
    assert.strictEqual(m.get('sousTitre').textContent, 'Commencée à 08 h 00 · Certifiée');
  });

  await test('Renommer : feuille préremplie, enregistre le nom nettoyé avec une clé, met à jour la bande', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: { id: 't-1', nom: 'Ancien', etat: 'EN_COURS', commencee_a: '14 h 05' } });
    m.reponses.rpc = (nom) => ({ data: nom === 'dates_courtes_renommer_tournee' ? { statut: 'renomme', nom: 'Rayon frais' } : [], error: null });
    m.dc.ouvrirRenommer({ id: 't-1', nom: 'Ancien' });
    assert(m.get('fiche').innerHTML.includes('value="Ancien"'));
    assert(m.get('fiche').innerHTML.includes('Enregistrer') && m.get('fiche').innerHTML.includes('Annuler'));
    m.get('champNom').value = '  Rayon   frais ';
    await m.dc.enregistrerNom();
    const a = m.appels.find(x => x.nom === 'dates_courtes_renommer_tournee');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a.args)), { p_tournee: 't-1', p_nom: 'Rayon frais', p_cle_idempotence: a.args.p_cle_idempotence });
    assert(a.args.p_cle_idempotence);
    assert.strictEqual(m.get('bandeNom').textContent, 'Rayon frais');
    assert.strictEqual(m.get('sousTitre').textContent, 'Commencée à 14 h 05 · En cours');
  });

  await test('Renommer : refus du serveur affiché sous le champ, nom vide refusé sans appel', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: { id: 't-1', nom: 'Ancien', etat: 'EN_COURS' } });
    m.dc.ouvrirRenommer({ id: 't-1', nom: 'Ancien' });
    m.get('champNom').value = '   ';
    await m.dc.enregistrerNom();
    assert(!m.appels.some(x => x.nom === 'dates_courtes_renommer_tournee'));
    assert(/1 à 60/.test(m.get('ficheMsg').textContent));
    m.get('champNom').value = 'Nouveau';
    m.reponses.rpc = () => ({ data: null, error: { message: 'droit_refuse : cette action est réservée à l\'auteur de la tournée' } });
    await m.dc.enregistrerNom();
    assert(/réservée/.test(m.get('ficheMsg').textContent));
    assert.strictEqual(m.get('fiche').open, true);
  });

  await test('Renommer : la page n\'envoie que l\'étiquette (aucun champ d\'auteur ou d\'heure)', async () => {
    const m = monde(); m.dc.etat({ employee: EMP, tournee: { id: 't-1', nom: 'A', etat: 'EN_COURS' } });
    m.reponses.rpc = () => ({ data: { statut: 'renomme', nom: 'B' }, error: null });
    m.dc.ouvrirRenommer({ id: 't-1', nom: 'A' }); m.get('champNom').value = 'B';
    await m.dc.enregistrerNom();
    const a = m.appels.find(x => x.nom === 'dates_courtes_renommer_tournee');
    assert.deepStrictEqual(Object.keys(a.args).sort(), ['p_cle_idempotence', 'p_nom', 'p_tournee']);
  });

  console.log(`\n${passes} réussis, ${echecs.length} échecs`);
  process.exit(echecs.length ? 1 : 0);
})();
