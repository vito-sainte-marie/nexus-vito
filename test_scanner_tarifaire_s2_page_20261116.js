// S2 : exécution réelle de la page Produits avec produits_appel, marge_exceptions et journal_decisions non vides.
// Garde : le bloc Marge+ doit s'afficher (le défaut « appel.has is not a function » était avalé par un try).
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const R = __dirname;
const APPEL = 'if (!APERCU) afficherSyntheseAccueil();';

function ligne(article, ca, marge, debut, fin, rayon) {
  return { article, categorie: rayon || 'Épicerie', ca, marge, prix_achat: 1, prix_vente: 2, quantite: 10, periode_debut: debut, periode_fin: fin, tva: 5.5, code_barres: article.slice(0, 6) };
}
function jeu(avecTables, site) {
  const P = [], noms = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'BAS', 'APPEL', 'EXCL'];
  for (const n of noms) {
    const m = n === 'BAS' ? 30 : n === 'EXCL' ? 20 : 50;
    P.push(ligne(n, 100, m, '2026-10-05', '2026-11-09'));
    P.push(ligne(n, 100, m, '2026-08-31', '2026-10-04'));
  }
  const t = {
    products: P, stock_releves: [],
    produits_appel: avecTables ? [{ article: 'APPEL', site }, { article: 'BAS-AUTRE', site }] : [],
    marge_exceptions: avecTables ? [{ article: 'EXCL', site }] : [],
    journal_decisions: avecTables ? [{ rule_id: 'R5-MARGE-ECART', candidate_id: 'LIVE-R5-Épicerie|ZZ', periode_reference_debut: '2026-07-01T00:00:00Z', periode_reference_fin: '2026-07-31', site }] : [],
  };
  return t;
}

function executer(html, ROWS, vue) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const code = scripts[scripts.length - 1];
  const mk = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'length' ? 0 : mk(), apply: () => mk(), construct: () => mk(), set: () => true, has: () => true });
  const errs = [], win = {}, requetes = [];
  const ctx = vm.createContext(new Proxy(win, { get: (t, k) => k in t ? t[k] : (k === 'undefined' ? undefined : mk()), set: (t, k, v) => { t[k] = v; return true; }, has: () => true }));
  Object.assign(ctx, { URLSearchParams, Promise, console: { log() {}, warn() {}, error: (...a) => errs.push(a.map(String).join(' ')) }, Date, Math, Number, String, Array, Object, JSON, Set, Map, Intl, Error, RegExp, isNaN, parseFloat, parseInt, Boolean, encodeURIComponent });
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.nexusRequireAuth = () => Promise.resolve({ id: 'e1', site_id: 'nexus-station-test', role: 'manager', nom: 'T' });
  ctx.nexusEstManager = () => true; ctx.nexusFuseauSite = () => Promise.resolve('Europe/Paris');
  const qb = t => { const filtres = {}; let lt = null, ord = null, lim = null; requetes.push({ t, filtres });
    const donnees = () => { let d = (ROWS[t] || []).filter(r => Object.keys(filtres).every(c => r[c] === undefined || r[c] === filtres[c]));
      if (lt) d = d.filter(r => r[lt.c] < lt.v);
      if (ord) d = d.slice().sort((a, b) => (a[ord.c] < b[ord.c] ? 1 : a[ord.c] > b[ord.c] ? -1 : 0) * (ord.desc ? 1 : -1));
      if (lim != null) d = d.slice(0, lim); return d; };
    const o = new Proxy({}, { get: (_, k) => k === 'then' ? res => { const d = donnees(); res({ data: d, error: null, count: d.length }); } : k === 'eq' ? (c, v) => { filtres[c] = v; return o; } : k === 'lt' ? (c, v) => { lt = { c, v }; return o; } : k === 'order' ? (c, opt) => { ord = { c, desc: !(opt && opt.ascending) }; return o; } : k === 'limit' ? n => { lim = n; return o; } : () => o }); return o; };
  ctx.nexusClient = { from: qb, storage: { from: () => qb('x') }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } };
  const corps = { innerHTML: '', querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {} };
  ctx.document = { getElementById: id => id === 'vueCorps' ? corps : mk(), querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {}, createElement: () => mk(), body: mk(), documentElement: mk() };
  ctx.location = { search: '', href: 'http://x/', pathname: '/x' };
  for (const f of ['nexus-vocabulaire.js', 'nexus-periodes.js', 'nexus-conseiller.js', 'nexus-marge.js', 'nexus-produits-mesure.js', 'nexus-produits-vues.js', 'nexus-badge-etat.js', 'nexus-politique-tarifaire.js', 'nexus-politique-tarifaire-registres.js', 'nexus-politique-tarifaire-ecran.js', 'nexus-produits-securite.js', 'nexus-scanner-tarifaire.js']) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx, { filename: f });
  ctx.setTimeout = f => { try { f(); } catch (e) { errs.push(String(e)); } };
  const code2 = code.replace(APPEL, APPEL + `
    __calc = () => { try { __instr({ marge: scannerMarge(), texte: scannerTexteMarge('BAS') }); ouvrirVue('scanner'); } catch (e) { __errVues(e); } };
`);
  ctx.__errVues = e => errs.push(String(e && e.message));
  let instr = null; ctx.__instr = x => { instr = x; };
  try { vm.runInContext(code2, ctx, { filename: 'page.js' }); } catch (e) { errs.push(String(e)); }
  return new Promise(res => setTimeout(() => { if (ctx.__calc) ctx.__calc(); setTimeout(() => res({ errs, corps: corps.innerHTML, instr, requetes }), 300); }, 1200));
}

(async () => {
  const html = fs.readFileSync(path.join(R, 'NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(html.includes(APPEL));
  const site = 'nexus-station-test';
  const ok = await executer(html, jeu(true, site));
  assert.deepStrictEqual(ok.errs.filter(e => /appel\.has|TypeError/.test(e)), [], 'erreur de calcul R5 : ' + ok.errs.join(' | '));
  assert.ok(ok.instr && ok.instr.marge && !ok.instr.marge.erreur, 'scannerMarge ne doit pas échouer : ' + ok.errs.join(' | ').slice(0, 400));
  assert.deepStrictEqual(Array.from(ok.instr.marge.ecarts, e => e.article), ['BAS'], 'écarts : ' + JSON.stringify(ok.instr.marge.ecarts.map(e => e.article)));
  assert.ok(ok.instr.texte, 'texte R5 de la fiche présent');
  // Changement attendu (fiche v2, matrice T1 -> T2, ligne « Marge+ ») : le bloc T1 « Écarts de marge dans le groupe » disparaît ;
  // l'écart à la médiane n'est plus un gain, il n'est ni proposé ni additionné. Sans seuil validé, aucune carte A2 n'est affichée.
  assert.ok(!/Écarts de marge dans le groupe/.test(ok.corps), 'le bloc T1 Marge+ ne doit plus exister (matrice, ligne Marge+)');
  assert.ok(/data-carte="propositions"/.test(ok.corps) && /jamais additionnés/.test(ok.corps), 'la synthèse T2 porte le gain, jamais additionné');
  // Changement attendu (fiche v2, § actions autorisées) : seules quatre actions sont permises, le lien vers NEXUS-Scanner-v1.html est retiré de la vue.
  assert.ok(!/NEXUS-Scanner-v1\.html/.test(ok.corps), 'le lien vers l\'ancien Scanner n\'existe plus dans la vue (fiche v2, actions autorisées)');
  const tabs = ok.requetes.filter(r => ['produits_appel', 'marge_exceptions', 'journal_decisions'].includes(r.t));
  assert.strictEqual(tabs.length, 3);
  for (const r of tabs) assert.ok(r.filtres.site, `${r.t} doit être filtrée par site`);
  console.log('OK  page réelle : bloc Marge+, texte de fiche, exclusions, filtre de site sur les trois tables');

  // Mutation : un calcul R5 qui échoue ne doit pas faire disparaître le bloc en silence.
  const mut = html.replace("produitsAppel: new Set((LECTURES_MARGE.produits_appel || []).map(r => r.article))", 'produitsAppel: (() => { throw new Error("calcul R5 en échec"); })()');
  assert.notStrictEqual(mut, html, 'mutation non appliquée');
  const ko = await executer(mut, jeu(true, site));
  // Changement attendu (matrice, ligne « Marge+ ») : la vue ne porte plus le bloc Marge+ ; un échec du calcul R5 (fiche produit)
  // ne doit ni vider la vue T2 ni réintroduire le bloc T1 : la vue reste rendue, le calcul R5 reste isolé.
  assert.ok(/data-carte="marge_negative"/.test(ko.corps), 'un échec R5 ne doit pas casser la vue T2');
  assert.ok(!/Écarts de marge dans le groupe/.test(ko.corps));
  console.log('OK  échec du calcul R5 : la vue T2 reste rendue, sans bloc T1');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
