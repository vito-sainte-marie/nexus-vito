// Une seule source pour les décisions de TVA du pilote par rayon (18/11/2026) : accueil Produits, Mes produits et Scanner.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
['nexus-conseiller.js', 'nexus-marge.js', 'nexus-tva-regles-pilote.js', 'nexus-produits-mesure.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sb, { filename: f }));
const M = sb.NexusProduitsMesure;
const R = require('./nexus-tva-regles-pilote.js');
const P = require('./nexus-politique-tarifaire.js');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function ok(c, m) { assert.ok(c, m); n++; }
const D = '2026-11-01', F = '2026-11-30', PILOTE = 'vito-sainte-marie';

// Une référence par rayon décidé le 18/11, plus un pair taxé dans le rayon (sinon le contrôle de rayon ne se déclenche pas).
const CAS = [
  ['Cartes prépayées', 'Carte Haïti 5', 0],
  ['Cigarettes', 'Marlboro rouge', 0],
  ['Cigares', 'Cigare Corona', 0],
  ['Tabac à rouler - 30g', 'Drum 30g', 0],
  ['Gaz', 'Gaz bleu 12,5 kg', 0],
  ['Cartes prépayées', 'Recharge Orange 10', 8.5],
  ['Cartes prépayées', 'Recharge Digicel Jamaïque', 8.5]
];
const ligne = (cat, art, tva, extra) => Object.assign({ site: PILOTE, periode_debut: D, periode_fin: F, categorie: cat, article: art, code_barres: null, quantite: 5, prix_achat: 6, prix_vente: 10, tva, ca: 50, marge: 20 }, extra || {});
const pairs = [...new Set(CAS.map(c => c[0]))].map(c => ligne(c, 'Pair taxé ' + c, 20));
const lot = CAS.map(c => ligne(c[0], c[1], c[2])).concat(pairs);

const mesure = (rows, site, conf) => M.mesurer({ products: rows.map(r => Object.assign({}, r, { site })), site, periodeDebut: D, periodeFin: F, tvaConfirmations: conf || [], dateReference: '2026-11-20' });
const etatM = (o, art) => o.index.get(M.normaliserNom(art)).tva;
const scanner = (rows, site, conf) => {
  const ctx = E.construireContexteTarif({ site, periode: { debut: D, fin: F }, declarations: { produits_tva_confirmations: conf || [] } });
  return P.analyser(rows.map(r => Object.assign({}, r, { site })), [], ctx);
};
const etatS = (a, art) => a.lignes.find(l => l.article === art).tva;

// 1. Les règles sont une donnée unique, datée et sourcée
ok(R.SITE_PILOTE === PILOTE, 'site pilote');
ok(R.TVA_CONFIRMATIONS_PILOTE.length === 7, 'sept règles');
ok(R.TVA_CONFIRMATIONS_PILOTE.every(r => r.source === 'pilote, 18/11/2026' && r.confirme_le === '2026-11-18'), 'source et date sur chaque règle');
ok(E.construireContexteTarif({ site: PILOTE, periode: { debut: D, fin: F } }).tva.confirmations.length === 7, 'le Scanner lit les mêmes règles');

// 2. Cinq rayons : confirmée dans la mesure ET dans le Scanner
const om = mesure(lot, PILOTE), as = scanner(lot, PILOTE);
CAS.forEach(([cat, art, t]) => {
  const m = etatM(om, art), s = etatS(as, art);
  ok(m.etat === 'confirmee' && m.taux_retenu === t, 'mesure confirmée : ' + art + ' (' + m.etat + ')');
  ok(s.etat !== 'a_verifier', 'Scanner non à vérifier : ' + art + ' (' + s.etat + ')');
  ok(m.confirmation.source === 'pilote, 18/11/2026', 'source portée : ' + art);
  ok(/le 18\/11\/2026/.test(m.raison) && !/le\s*$/.test(m.raison), 'libellé daté : ' + m.raison);
});

// 3. Autre site : aucune règle héritée (la mesure et le Scanner sortent du même rayon, sans confirmation)
const autre = mesure(lot, 'autre-site'), autreS = scanner(lot, 'autre-site');
ok(etatM(autre, 'Marlboro rouge').etat === 'incoherente', 'autre site : à vérifier dans la mesure');
ok(etatS(autreS, 'Marlboro rouge').etat === 'a_verifier', 'autre site : à vérifier dans le Scanner');
ok((((E.construireContexteTarif({ site: 'autre-site', periode: { debut: D, fin: F } }).tva || {}).confirmations) || []).length === 0, 'autre site : aucune règle dans le contexte');

// 4. Le registre passe avant la règle de rayon : Rizla confirmé à 8,5 sous Tabac à rouler reste à 8,5
const rizla = ligne('Tabac à rouler - 30g', 'Rizla regular', 8.5);
const reg = [{ id: 'r1', site: PILOTE, article: 'Rizla regular', code_barres: '', taux_confirme: 8.5, confirme_le: '2026-11-21T10:00:00Z', confirme_par: 'x', annule_le: null, remplace_id: null }];
const lotR = lot.concat([rizla]);
const mr = etatM(mesure(lotR, PILOTE, reg), 'Rizla regular');
ok(mr.etat === 'confirmee' && mr.taux_retenu === 8.5 && mr.confirmation.taux === 8.5, 'registre gagne dans la mesure');
const sr = etatS(scanner(lotR, PILOTE, reg), 'Rizla regular');
ok(sr.etat !== 'a_verifier' && sr.taux === 8.5, 'registre gagne dans le Scanner');
// Sans registre, la règle de rayon (0 %) contredit l'export à 8,5 % : la référence reste à vérifier des deux côtés
ok(etatM(mesure(lotR, PILOTE), 'Rizla regular').etat === 'incoherente', 'sans registre : à vérifier dans la mesure');
ok(etatS(scanner(lotR, PILOTE), 'Rizla regular').etat === 'a_verifier', 'sans registre : à vérifier dans le Scanner');

// 5. Parité : même nombre de « TVA à vérifier » sur un lot mêlant confirmées, contredites et hors rayons
const hors = [ligne('Snacking', 'Chips sel', 0), ligne('Snacking', 'Chips taxé', 20)];
const lotP = lotR.concat(hors);
[PILOTE, 'autre-site'].forEach(site => {
  const a = lotP.filter(() => true), nm = mesure(a, site), ns = scanner(a, site);
  const cm = nm.mesures.filter(x => x.tva && x.tva.etat === 'incoherente').map(x => x.article).sort();
  const cs = ns.lignes.filter(l => l.tva && l.tva.etat === 'a_verifier').map(l => l.article).sort();
  assert.deepStrictEqual(cm, cs, 'parité ' + site); n++;
  ok(site !== PILOTE || cm.filter(x => !/^Pair taxé /.test(x)).join('|') === ['Chips sel', 'Rizla regular'].join('|'), 'pilote : hors pairs taxés (qui contredisent la règle), restent Chips sel (hors rayons) et Rizla (contredit) : ' + cm);
});


// 6. Chemin réel de la carte « TVA à vérifier » de l'accueil : la page Produits est exécutée telle quelle
//    (chargement, déclarations, mesure, indicateursAccueil, pointsVigilance), puis comparée au filtre de Mes produits.
const APPEL = 'if (!APERCU) afficherSyntheseAccueil();';
const MODULES = ['nexus-vocabulaire.js', 'nexus-periodes.js', 'nexus-conseiller.js', 'nexus-marge.js', 'nexus-tva-regles-pilote.js', 'nexus-produits-mesure.js', 'nexus-produits-vues.js', 'nexus-badge-etat.js', 'nexus-politique-tarifaire.js', 'nexus-politique-tarifaire-registres.js', 'nexus-politique-tarifaire-ecran.js', 'nexus-produits-securite.js', 'nexus-scanner-tarifaire.js'];
function executerCarte(ROWS, site) {
  const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const code = scripts[scripts.length - 1];
  const mk = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'length' ? 0 : mk(), apply: () => mk(), construct: () => mk(), set: () => true, has: () => true });
  const errs = [], win = {};
  const ctx = vm.createContext(new Proxy(win, { get: (t, k) => k in t ? t[k] : (k === 'undefined' ? undefined : mk()), set: (t, k, v) => { t[k] = v; return true; }, has: () => true }));
  Object.assign(ctx, { URLSearchParams, Promise, console: { log() {}, warn() {}, error: (...a) => errs.push(a.map(String).join(' ')) }, Date, Math, Number, String, Array, Object, JSON, Set, Map, Intl, Error, RegExp, isNaN, parseFloat, parseInt, Boolean, encodeURIComponent });
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.nexusRequireAuth = () => Promise.resolve({ id: 'e1', site_id: site, role: 'manager', nom: 'T' });
  ctx.nexusEstManager = () => true; ctx.nexusFuseauSite = () => Promise.resolve('Europe/Paris');
  const qb = t => { const filtres = {}; let lt = null, ord = null, lim = null;
    const donnees = () => { let d = (ROWS[t] || []).filter(r => Object.keys(filtres).every(c => r[c] === undefined || r[c] === filtres[c]));
      if (lt) d = d.filter(r => r[lt.c] < lt.v);
      if (ord) d = d.slice().sort((a, b) => (a[ord.c] < b[ord.c] ? 1 : a[ord.c] > b[ord.c] ? -1 : 0) * (ord.desc ? 1 : -1));
      if (lim != null) d = d.slice(0, lim); return d; };
    const o = new Proxy({}, { get: (_, k) => k === 'then' ? res => { const d = donnees(); res({ data: d, error: null, count: d.length }); } : k === 'eq' ? (c, v) => { filtres[c] = v; return o; } : k === 'lt' ? (c, v) => { lt = { c, v }; return o; } : k === 'order' ? (c, opt) => { ord = { c, desc: !(opt && opt.ascending) }; return o; } : k === 'limit' ? m => { lim = m; return o; } : () => o }); return o; };
  ctx.nexusClient = { from: qb, storage: { from: () => qb('x') }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } };
  const corps = { innerHTML: '', querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {} };
  ctx.document = { getElementById: id => id === 'vueCorps' ? corps : mk(), querySelector: () => mk(), querySelectorAll: () => [], addEventListener() {}, createElement: () => mk(), body: mk(), documentElement: mk() };
  ctx.location = { search: '', href: 'http://x/', pathname: '/x' };
  for (const f of MODULES) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
  ctx.setTimeout = f => { try { f(); } catch (e) { errs.push(String(e)); } };
  let res = null;
  ctx.__carte = x => { res = x; };
  ctx.__errCarte = e => errs.push(String(e && e.message));
  const code2 = code.replace(APPEL, APPEL + `
    __calc = () => { try {
      const I = indicateursAccueil(), L = pointsVigilance(I);
      const filtre = NexusProduitsVues.produits(entreesVues(), { tva: 'incoherente' }).lignes.map(e => e.article).sort();
      __carte({ nbTva: I.nbTva, carte: L.find(x => x.id === 'tva') || null, filtre });
    } catch (e) { __errCarte(e); } };
`);
  assert.notStrictEqual(code2, code, 'point d ancrage de la page trouvé');
  try { vm.runInContext(code2, ctx, { filename: 'page.js' }); } catch (e) { errs.push(String(e)); }
  return new Promise(ok2 => setTimeout(() => { if (ctx.__calc) ctx.__calc(); setTimeout(() => ok2({ errs, res }), 300); }, 1200));
}

(async () => {
  const C0 = '2026-10-05', C1 = '2026-11-09', P0 = '2026-08-31', P1 = '2026-10-04';
  const l2 = (cat, art, tva, cb) => [[C0, C1], [P0, P1]].map(([d, f]) => ({ site: PILOTE, periode_debut: d, periode_fin: f, categorie: cat, article: art, code_barres: cb, quantite: 5, prix_achat: 6, prix_vente: 10, tva, ca: 50, marge: 20 }));
  const decl = (art, cb, taux, extra) => Object.assign({ id: 'd-' + art, site: PILOTE, article: art, code_barres: cb, taux_confirme: taux, confirme_le: '2026-10-01T10:00:00Z', annule_le: null, remplace_id: null, commentaire: 'épreuve' }, extra || {});
  const jeuCarte = {
    products: [].concat(
      l2('Snacking', 'Pair taxé Snacking', 20, '9000001'),
      l2('Snacking', 'Conf registre', 0, '9000002'),        // confirmée au registre au taux importé : sort
      l2('Cigarettes', 'Marlboro rouge', 0, '9000003'),     // rayon décidé par le gérant : sort
      l2('Snacking', 'Conf annulee', 0, '9000004'),          // confirmation annulée : reste
      l2('Snacking', 'Conf contredite', 8.5, '9000005'),     // confirmée à 0, importée à 8,5 après la confirmation : reste
      l2('Snacking', 'Libre', 0, '9000006')                  // aucune décision : reste
    ),
    stock_releves: [], produits_appel: [], marge_exceptions: [], journal_decisions: [],
    produits_nature_reference: [], produits_justifications_marge: [],
    produits_tva_confirmations: [
      decl('Conf registre', '9000002', 0),
      decl('Conf annulee', '9000004', 0, { annule_le: '2026-10-20T10:00:00Z' }),
      decl('Conf contredite', '9000005', 0)
    ]
  };
  const { errs, res } = await executerCarte(jeuCarte, PILOTE);
  ok(errs.length === 0, 'la page s exécute sans erreur : ' + errs.join(' | '));
  ok(res && typeof res.nbTva === 'number', 'le compteur nbTva de l accueil est calculé par la page');
  const dedans = nom => res.filtre.includes(nom);
  ok(!dedans('Conf registre'), 'carte : une confirmation au registre au taux importé sort du compteur');
  ok(!dedans('Marlboro rouge'), 'carte : une référence d un rayon décidé par le gérant sort du compteur');
  ok(dedans('Conf annulee'), 'carte : une confirmation annulée laisse la référence dans le compteur');
  ok(dedans('Conf contredite'), 'carte : une confirmation contredite par un taux importé différent laisse la référence dans le compteur');
  ok(dedans('Libre'), 'carte : une référence sans décision reste dans le compteur');
  ok(res.nbTva === res.filtre.length, 'carte : le compteur de l accueil (' + res.nbTva + ') égale le filtre « TVA à vérifier » de Mes produits (' + res.filtre.length + ')');
  ok(res.carte && res.carte.n === res.nbTva, 'carte : la carte affichée porte le même nombre');
  ok(res.carte.info === 'Taux à vérifier dans Decenium. Vos confirmations sont déjà déduites.', 'carte : info-bulle attendue, affichée parce que les conditions tiennent');

  // Garde inverse : si tout est confirmé, plus de carte, donc plus d info-bulle affirmant « déjà déduites ».
  const toutConf = Object.assign({}, jeuCarte, {
    products: [].concat(l2('Snacking', 'Conf registre', 0, '9000002')),
    produits_tva_confirmations: [decl('Conf registre', '9000002', 0)]
  });
  const b = await executerCarte(toutConf, PILOTE);
  ok(b.errs.length === 0 && b.res && b.res.nbTva === 0 && b.res.carte === null, 'tout confirmé : compteur à 0 et aucune carte (donc aucune info-bulle)');

  console.log('test_tva_regle_unique_20261121 : ' + n + ' vérifications OK');
})().catch(e => { console.error(e); process.exit(1); });
