// P1-E : exécution réelle du script de la page Produits (contexte vm, DOM permissif, client simulé).
// Garde contre la zone morte temporelle : afficherSyntheseAccueil() appelée avant la déclaration de ICONE_VUE / VUES
// provoquait un ReferenceError au chargement (aucune carte, recherche non câblée). Les tests statiques ne l'attrapent pas.
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const R = __dirname;
const APPEL = 'if (!APERCU) afficherSyntheseAccueil();';

function executer(html, extra, cible) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const code = scripts[scripts.length - 1];
  const mk = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'length' ? 0 : mk(), apply: () => mk(), construct: () => mk(), set: () => true, has: () => true });
  const errs = [], win = {};
  const ctx = vm.createContext(new Proxy(win, { get: (t, k) => k in t ? t[k] : (k === 'undefined' ? undefined : mk()), set: (t, k, v) => { t[k] = v; return true; }, has: () => true }));
  Object.assign(ctx, { URLSearchParams, Promise, console, Date, Math, Number, String, Array, Object, JSON, Set, Map, Intl, Error, RegExp, isNaN, parseFloat, parseInt, Boolean, encodeURIComponent });
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.nexusRequireAuth = () => Promise.resolve({ id: 'e1', site_id: 'nexus-station-test', role: 'manager', nom: 'T' });
  ctx.nexusEstManager = () => true;
  const ROWS = { products: [{ article: 'GAZ BLEU 12,5 KG', rayon: 'Gaz', ca_ht: 100, marge_ht: 20, quantite: 2, periode_debut: '2026-10-05', periode_fin: '2026-11-09', tva: 5.5, code_barres: '1' }], stock_releves: [], ...(extra || {}) };
  const qb = t => { const o = new Proxy({}, { get: (_, k) => k === 'then' ? res => res({ data: ROWS[t] || [], error: null, count: (ROWS[t] || []).length }) : () => o }); return o; };
  ctx.nexusClient = { from: qb, storage: { from: () => qb('x') }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } };
  const corpsRec = { innerHTML: '', querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {} };
  ctx.document = { getElementById: id => id === 'vueCorps' ? corpsRec : mk(), querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {}, createElement: () => mk(), body: mk(), documentElement: mk() };
  ctx.location = { search: '', href: 'http://x/', pathname: '/x' };
  for (const f of ['nexus-conseiller.js', 'nexus-marge.js', 'nexus-produits-mesure.js', 'nexus-campagne-outils.js', 'nexus-campagne-ventes.js', 'nexus-produits-vues.js', 'nexus-scanner-tarifaire.js', 'nexus-badge-etat.js', 'nexus-politique-tarifaire.js', 'nexus-politique-tarifaire-registres.js', 'nexus-politique-tarifaire-ecran.js', 'nexus-produits-securite.js']) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx, { filename: f });
  ctx.setTimeout = f => { try { f(); } catch (e) { errs.push(e); } };
  process.on('unhandledRejection', e => errs.push(e));
  const marque = []; ctx.__marque = s => marque.push(s);
  // Après l'appel d'accueil, expose les vues pour les ouvrir comme le ferait un clic, puis reviens à l'accueil.
  const code2 = code.replace(APPEL, APPEL + `__marque('accueil');
    try { for (const v of ['produits','ventes','marges','revoir','stocks','promo','scanner']) { ouvrirVue(v); __marque('vue:' + v); if (v === 'promo') __corpsPromo(); afficherAccueil(); __marque('retour:' + v); } __marque('badge:' + typeof badgePromotion({ article: 'GAZ BLEU 12,5 KG' })); } catch (e) { __errVues(e); }`);
  ctx.__errVues = e => errs.push(e);
  ctx.__corpsPromo = () => { if (cible) cible.html = corpsRec.innerHTML; };
  try { vm.runInContext(code2, ctx, { filename: 'page.js' }); } catch (e) { errs.push(e); }
  return new Promise(res => setTimeout(() => res({ errs, marque }), 300));
}

(async () => {
  const html = fs.readFileSync(path.join(R, 'NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(html.includes(APPEL), 'l\'appel de la synthèse d\'accueil est introuvable');

  // 1. La page réelle : aucune erreur, accueil affiché, sept vues ouvertes puis retour.
  const ok = await executer(html);
  assert.deepStrictEqual(ok.errs.map(e => String(e && e.message)), [], 'erreur à l\'exécution de la page');
  assert.deepStrictEqual(ok.marque, ['accueil', ...['produits','ventes','marges','revoir','stocks','promo','scanner'].flatMap(v => ['vue:' + v, 'retour:' + v]), 'badge:string']);
  console.log('OK  exécution réelle : accueil, sept vues, retour, zéro erreur');

  // 1b. Régression Guardian : le rapprochement se fait avec les produits du site chargés (PRODUCTS), pas avant.
  //     Un produit de la promotion présent une seule fois chez le site doit donner un lien vers sa fiche, jamais « à rapprocher ».
  const cible = {};
  const promo = { campagnes_nexus: [{ id: 'c1', nom: 'PETROMIX', date_debut: '2020-01-01', date_fin: '2099-12-31', produits_concernes: [] }],
    campagne_objectifs_produits: [{ article: 'GAZ BLEU 12,5 KG', version: 1, seuil_unites: 10, objectif_valide_jour: 5, pa_promo_ht: 1 }] };
  const rr = await executer(html, promo, cible);
  assert.deepStrictEqual(rr.errs.map(e => String(e && e.message)), [], 'erreur avec une promotion');
  assert.ok(/PETROMIX/.test(cible.html || ''), 'la promotion n\'apparaît pas dans la vue');
  assert.ok(/data-fiche="GAZ BLEU 12,5 KG"/.test(cible.html), 'le produit unique du site doit renvoyer vers sa fiche');
  assert.ok(!/à rapprocher/.test(cible.html), 'le produit unique ne doit pas être « à rapprocher »');
  console.log('OK  régression : produit unique du site → lien vers la fiche, pas « à rapprocher »');

  // 1c. Mutation : rapprochement figé avant le chargement de PRODUCTS (ancien défaut) → doit être attrapé.
  const vieux = html.replace('articlesSite: PRODUCTS_NOMS_SITE()', 'articlesSite: []');
  assert.notStrictEqual(vieux, html, 'mutation 1c non appliquée');
  const c2 = {}; await executer(vieux, promo, c2);
  assert.ok(/à rapprocher/.test(c2.html || ''), 'la mutation (articlesSite vide) aurait dû faire apparaître « à rapprocher »');
  console.log('OK  mutation (articlesSite vide) : le défaut est attrapé');

  // 2. Mutation : l'appel remis avant les déclarations doit être attrapé (la garde mord).
  const tot = html.replace(APPEL, '').replace('const ICONE_VUE', APPEL + '\n  const ICONE_VUE');
  assert.notStrictEqual(tot, html, 'mutation non appliquée');
  const ko = await executer(tot);
  assert.ok(ko.errs.some(e => /before initialization/.test(String(e && e.message))), 'la zone morte n\'a pas été détectée');
  console.log('OK  mutation (appel avant ICONE_VUE) : zone morte détectée');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
