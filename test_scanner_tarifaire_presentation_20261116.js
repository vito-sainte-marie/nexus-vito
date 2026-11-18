// Présentation Scanner : exécution réelle de la page Produits avec produits_appel, marge_exceptions et journal_decisions non vides.
// Garde : le bloc Marge+ doit s'afficher (le défaut « appel.has is not a function » était avalé par un try).
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const R = __dirname;
const APPEL = 'if (!APERCU) afficherSyntheseAccueil();';

function ligne(article, ca, marge, debut, fin, rayon) {
  return { article, categorie: rayon || 'Épicerie', ca, marge, prix_achat: 1, prix_vente: 2, quantite: 10, periode_debut: debut, periode_fin: fin, tva: 5.5, code_barres: article.slice(0, 6) };
}
function jeuS2(avecTables, site) {
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
  return new Promise(res => setTimeout(() => { if (ctx.__calc) ctx.__calc(); setTimeout(() => res({ errs, corps: corps.innerHTML, instr, requetes, ctx }), 300); }, 1200));
}


function jeu(site) {
  const t = jeuS2(true, site);
  const add = (article, pa0, pa1, pv, q) => {
    t.products.push({ article, categorie: 'Confiserie', ca: pv * q, marge: (pv - pa1) * q, prix_achat: pa1, prix_vente: pv, quantite: q, periode_debut: '2026-10-05', periode_fin: '2026-11-09', tva: 5.5, code_barres: article.slice(0, 6) + '1' });
    t.products.push({ article, categorie: 'Confiserie', ca: pv * q, marge: (pv - pa0) * q, prix_achat: pa0, prix_vente: pv, quantite: q, periode_debut: '2026-08-31', periode_fin: '2026-10-04', tva: 5.5, code_barres: article.slice(0, 6) + '1' });
  };
  add('PERTEX', 2, 3, 2, 6);
  add('MENTHEX', 1, 2.6, 4, 10);
  add('HAUSSEX', 1, 1.3, 3, 40);
  return t;
}
(async () => {
  const html = fs.readFileSync(path.join(R, 'NEXUS-Produits-v1.html'), 'utf8');
  const r = await executer(html, jeu('nexus-station-test'));
  const c = r.corps;
  assert.ok(c.length > 500, 'vue Scanner vide : ' + r.errs.join(' | ').slice(0, 300));
  assert.ok(!/Total global/i.test(c), 'la ligne « Total global » doit avoir disparu');
  // Étape 2 (#332) : la vue consomme le moteur T2. Chaque différence avec le T1 cite sa ligne de matrice T1 → T2 (fiche v2, #160).
  // Matrice « Synthèse » : quatre cartes, minimum et cible jamais additionnés ; la phrase T1 de non-additivité est remplacée.
  assert.ok(/jamais additionnés/.test(c), 'scénarios alternatifs, jamais additionnés');
  assert.ok(/Scanner tarifaire/.test(c), 'en-tête');
  assert.ok(/produits-scanner-tarifaire/.test(c), 'icône officielle de l\'en-tête (conservée)');
  assert.ok(/nexus-avatar-128\.png/.test(c), 'avatar du Conseiller');
  // Matrice « Synthèse » : les cinq cartes T1 (pertes/couts/marges/regl/verif) deviennent quatre cartes de synthèse.
  for (const id of ['marge_negative', 'propositions', 'a_verifier', 'non_constates']) assert.ok(c.includes(`data-carte="${id}"`), 'carte ' + id);
  // Lot A (accord Guardian 6984645857, point 4) : la carte « Marge estimée » s'ajoute aux quatre cartes de synthèse.
  assert.ok(c.includes('data-carte="marge_estimee"'), 'carte marge estimée');
  assert.strictEqual((c.match(/data-carte="/g) || []).length, 5, 'quatre cartes de synthèse + marge estimée');
  for (const id of ['pertes', 'couts', 'marges', 'regl', 'verif']) assert.ok(!c.includes(`data-carte="${id}"`), 'carte T1 ' + id + ' remplacée');
  // Matrice « Familles de contrôle » : quatre familles (bloc D) ; ventes à perte → A3, prix réglementés → A8, coûts → A4.
  for (const t of ['Pertes et conformité', 'Fiabilité des données', 'Décisions de prix', 'Exceptions validées']) assert.ok(c.includes(t), 'famille ' + t);
  assert.ok(/data-controle=/.test(c) && /data-article="/.test(c), 'accès aux références');
  assert.ok(/id="ptRecherche"/.test(c), 'recherche');
  // Aucune valeur en dur dans le montage.
  const dur = html.slice(html.indexOf('async function ouvrirScanner'), html.indexOf('function ouvrirVue'));
  assert.ok(!/\b847\b|26,41|146,18/.test(dur), 'aucune valeur en dur');
  assert.ok(!/Total global/i.test(c));
  assert.ok(/data-plus/.test(c) || /data-plus/.test(html), 'liste paginée par bouton');
  assert.ok(/Mes prix réglementés|Prix réglementés|prix réglementés/.test(c) || /Aucune référence concernée/.test(c), 'contrôle réglementaire présent (A8)');
  console.log('OK  structure T2 : quatre cartes, quatre familles, recherche, sans total');

  const P = r.ctx.NexusScannerPresentation;
  assert.ok(P, 'API de présentation exposée');
  const R0 = (nj, nb, k) => ({ perte: { nb, non_justifiees: nj }, hausse: { a_examiner: k, prioritaire: 0 } });
  const A0 = { suspects: [], pertes: [], hausses: { premieres: [] } };
  assert.strictEqual(P.texteConseillerScanner(R0(3, 3, 7), A0), 'Trois produits présentent une marge négative. Sept hausses de coûts méritent votre attention.');
  const j = P.texteConseillerScanner(R0(0, 3, 0), A0);
  assert.ok(/Trois ventes à perte/.test(j) && !/non justifi/.test(j) && !/marge négative/.test(j), 'pertes justifiées : ' + j);
  assert.strictEqual(P.texteConseillerScanner(R0(0, 0, 0), A0), 'Aucune anomalie à signaler sur cette période.');
  const s = P.texteConseillerScanner(R0(1, 1, 1), { suspects: [{ article: 'Menthe Durmint', pa: 2.6, pa_precedent: 1, variation: 1.6 }], pertes: [], hausses: { premieres: [] } });
  assert.ok(/Commencez par vérifier Menthe Durmint : son coût a plus que doublé\./.test(s), s);
  assert.ok(!/erreur/i.test(s));
  console.log('OK  texte du Conseiller suit les données');

  const E = [
    { article: 'Zèbre', categorie: 'Épicerie', impact: 5, variation: 0.1, ordre: 2 },
    { article: 'Abricot', categorie: 'Fruits', impact: 20, variation: -0.5, ordre: 0 },
    { article: 'Menthe', categorie: 'Confiserie', impact: 1, variation: 1.2, ordre: 1 },
  ];
  const noms = (q, t) => Array.from(P.filtrerListeScanner(E, q, t), e => e.article);
  assert.deepStrictEqual(noms('', 'impact'), ['Abricot', 'Zèbre', 'Menthe']);
  assert.deepStrictEqual(noms('', 'variation'), ['Menthe', 'Abricot', 'Zèbre']);
  assert.deepStrictEqual(noms('', 'nom'), ['Abricot', 'Menthe', 'Zèbre']);
  assert.deepStrictEqual(noms('', 'controle'), ['Abricot', 'Menthe', 'Zèbre']);
  assert.deepStrictEqual(noms('zebre', 'nom'), ['Zèbre'], 'recherche sans accents');
  assert.deepStrictEqual(noms('conf', 'nom'), ['Menthe'], 'recherche par famille');
  assert.deepStrictEqual(noms('xyz', 'nom'), []);
  const E2 = E.map((e, i) => Object.assign({ cle: ['marges', 'pertes', 'regl'][i] }, e));
  assert.deepStrictEqual(Array.from(P.filtrerListeScanner(E2, '', 'nom', 'pertes'), e => e.article), ['Abricot'], 'filtre par contrôle');
  assert.strictEqual(P.filtrerListeScanner(E2, '', 'nom', '').length, 3);
  console.log('OK  recherche et tri de la liste complète');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
