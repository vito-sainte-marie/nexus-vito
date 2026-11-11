// Lot 2 Produits (cohérence), PR C — GO #160 du 11/11/2026.
// Huit statuts, recherche, seuils en source unique, pied de page, chargement ciblé.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = global;
require(__dirname + '/nexus-periodes.js');
require(__dirname + '/nexus-conseiller.js');
const C = global.NexusConseiller;
const page = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
const conseillerSrc = fs.readFileSync(path.join(__dirname, 'nexus-conseiller.js'), 'utf8');
let n = 0; const t = (nom, f) => { f(); n++; console.log('✓ ' + nom); };

function extraire(src, signature) {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, 'fonction introuvable : ' + signature);
  const ouvre = src.indexOf('{', i);
  let prof = 0;
  for (let k = ouvre; k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}') { prof--; if (prof === 0) return src.slice(i, k + 1); }
  }
  throw new Error('accolade non fermée : ' + signature);
}

const AUJ = '2026-11-10';
const jourMoins = k => new Date(Date.parse(AUJ + 'T00:00:00Z') - k * 86400000).toISOString().slice(0, 10);
const base = { article: 'Crème test', categorie: 'Épicerie', ca_t2: 0, pct_contrib: null, tendance: null, periodesSansVente: 0, stock: null, periodeTendance: 'du 07/10/2026 au 23/10/2026' };
const st = (o) => C.statutProduit(Object.assign({}, base, o), AUJ);
const reco = { recommandable: true };

// ---------- Les huit statuts ----------
t('1 Stratégique : part du rayon ≥ 15 %, badge neutre', () => {
  const r = st({ ca_t2: 100, pct_contrib: 0.15 });
  assert.strictEqual(r.cle, 'strategique'); assert.strictEqual(r.niveau, null); assert.ok(r.action);
  assert.strictEqual(st({ ca_t2: 100, pct_contrib: 0.1499 }).cle, 'sans-signal');
});
t('2 En progression : recommandable et ≥ +20 %, badge Conforme, action citant la période', () => {
  const r = st({ ca_t2: 100, pct_contrib: 0.05, tendance: { recommandable: true, evolutionCA: 0.20 } });
  assert.strictEqual(r.cle, 'en-progression'); assert.strictEqual(r.niveau, 'conforme');
  assert.ok(r.action.includes('du 07/10/2026 au 23/10/2026'));
  assert.strictEqual(st({ ca_t2: 100, pct_contrib: 0.05, tendance: { recommandable: true, evolutionCA: 0.1999 } }).cle, 'sans-signal');
});
t('3 À surveiller : recommandable et ≤ −30 %, badge À vérifier', () => {
  const r = st({ ca_t2: 100, pct_contrib: 0.05, tendance: { recommandable: true, evolutionCA: -0.30 } });
  assert.strictEqual(r.cle, 'surveiller'); assert.strictEqual(r.niveau, 'a-verifier');
  assert.strictEqual(st({ ca_t2: 100, pct_contrib: 0.05, tendance: { recommandable: true, evolutionCA: -0.2999 } }).cle, 'sans-signal');
});
t('4 Tendance à confirmer : tendance présente non recommandable, neutre', () => {
  const r = st({ ca_t2: 100, pct_contrib: 0.05, tendance: { recommandable: false, evolutionCA: -0.9 } });
  assert.strictEqual(r.cle, 'a-confirmer'); assert.strictEqual(r.niveau, null);
});
t('5 Aucune vente récente : connu, sans vente, sans stock récent exploitable, aucune action', () => {
  const r = st({ ca_t2: 0 });
  assert.strictEqual(r.cle, 'aucune-vente'); assert.strictEqual(r.niveau, null); assert.strictEqual(r.action, null);
});
t('6 Dormant : deux périodes complètes sans vente ET quantité > 0 sur relevé < 30 j', () => {
  const stock = q => ({ quantite: q, releve_le: jourMoins(5) });
  const r = st({ periodesSansVente: 2, stock: stock(4) });
  assert.strictEqual(r.cle, 'dormant'); assert.strictEqual(r.niveau, 'a-verifier');
  assert.strictEqual(r.action, "Vérifiez la présence en rayon et le stock de Crème test. S'il reste sans vente, envisagez son déréférencement.");
  assert.strictEqual(st({ periodesSansVente: 1, stock: stock(4) }).cle, 'aucune-vente'); // règle des deux périodes
  assert.strictEqual(st({ periodesSansVente: 3, stock: stock(4) }).cle, 'dormant');
});
t('6 bis Limite de 30 jours : 29 j récent, 30 j non', () => {
  assert.strictEqual(C.DUREE_RELEVE_STOCK_JOURS, 30);
  assert.strictEqual(st({ periodesSansVente: 2, stock: { quantite: 4, releve_le: jourMoins(29) } }).cle, 'dormant');
  assert.strictEqual(st({ periodesSansVente: 2, stock: { quantite: 4, releve_le: jourMoins(30) } }).cle, 'aucune-vente');
  assert.strictEqual(st({ stock: { quantite: 0, releve_le: jourMoins(30) } }).cle, 'aucune-vente');
});
t('7 Rupture probable : sans vente et quantité ≤ 0 au dernier relevé', () => {
  const r = st({ stock: { quantite: 0, releve_le: jourMoins(3) } });
  assert.strictEqual(r.cle, 'rupture-probable'); assert.strictEqual(r.niveau, 'a-verifier');
  assert.strictEqual(r.action, 'Vérifiez le stock et le réassort de Crème test.');
  assert.strictEqual(st({ stock: { quantite: -2, releve_le: jourMoins(3) } }).cle, 'rupture-probable');
});
t('8 Sans signal particulier : ventes, aucune condition, neutre, sans action', () => {
  const r = st({ ca_t2: 100, pct_contrib: 0.05 });
  assert.strictEqual(r.cle, 'sans-signal'); assert.strictEqual(r.niveau, null); assert.strictEqual(r.action, null);
});
t('« Produit performant » a disparu partout', () => {
  ['NEXUS-Produits-v1.html', 'nexus-conseiller.js', 'nexus-vocabulaire.js'].forEach(f => {
    assert.ok(!/Produit performant/i.test(fs.readFileSync(path.join(__dirname, f), 'utf8')), f);
  });
});

// ---------- Constantes et seuils : source unique ----------
t('durées exportées, jamais recopiées dans la page', () => {
  assert.strictEqual(C.DUREE_DORMANT_PERIODES, 2);
  assert.strictEqual(C.DUREE_RELEVE_STOCK_JOURS, 30);
  assert.ok(/NexusConseiller\.DUREE_DORMANT_PERIODES/.test(page) && /NexusConseiller\.DUREE_RELEVE_STOCK_JOURS/.test(page));
  assert.ok(!/\b30\s*\*\s*86400000|\*\s*30\b|DUREE_RELEVE_STOCK_JOURS\s*=/.test(page));
});
t('seuils de statut inchangés (+20 %, −30 %, 15 %, 50 €)', () => {
  assert.strictEqual(C.SEUIL_HAUSSE, 0.20); assert.strictEqual(C.SEUIL_BAISSE, -0.30);
  assert.strictEqual(C.SEUIL_CONTRIBUTION_FORTE, 0.15); assert.strictEqual(C.SEUIL_VOLUME_CA_EUR, 50);
  assert.strictEqual(require(__dirname + '/nexus-periodes.js') && global.NexusPeriodes.FRAICHEUR_MAX_JOURS, 21);
});
t('rentabilité 40/25/10 % inchangée', () => {
  assert.deepStrictEqual(C.SEUILS_RENTABILITE, { tresRentable: 0.40, correcte: 0.25, faible: 0.10 });
  const v = [[0.40, 'tres_rentable'], [0.3999, 'correcte'], [0.25, 'correcte'], [0.2499, 'faible'], [0.10, 'faible'], [0.0999, 'insuffisante']];
  v.forEach(([m, e]) => assert.strictEqual(C.niveauRentabilite(m), e, 'marge ' + m));
});
t('rotation 7/15/30/60 j inchangée', () => {
  assert.deepStrictEqual(C.SEUILS_ROTATION_JOURS, { tresRapide: 7, rapide: 15, normale: 30, lente: 60 });
  const v = [[6.99, 'tres_rapide'], [7, 'rapide'], [14.99, 'rapide'], [15, 'normale'], [29.99, 'normale'], [30, 'lente'], [59.99, 'lente'], [60, 'tres_lente']];
  v.forEach(([j, e]) => assert.strictEqual(C.niveauRotation(j), e, 'jours ' + j));
  assert.strictEqual(C.niveauRotation(null), null);
});
t('stock 3/7/45 j inchangé', () => {
  assert.deepStrictEqual(C.SEUILS_STOCK_JOURS, { risqueRupture: 3, tendu: 7, maitrise: 45 });
  const v = [[2.99, 'risque_rupture'], [3, 'tendu'], [6.99, 'tendu'], [7, 'maitrise'], [44.99, 'maitrise'], [45, 'surstock']];
  v.forEach(([j, e]) => assert.strictEqual(C.niveauStock(j), e, 'jours ' + j));
  assert.strictEqual(C.niveauStock(undefined), null);
});
t('la page ne recopie plus aucun seuil de rentabilité, rotation ni stock', () => {
  const f = extraire(page, 'async function chargerStockGap');
  assert.ok(/NexusConseiller\.niveauRotation/.test(f) && /NexusConseiller\.niveauStock/.test(f));
  assert.ok(!/<\s*(7|15|30|60)\s*\?/.test(f) && !/<\s*(3|7|45)\s*\?/.test(f), 'paliers en dur dans chargerStockGap');
  assert.ok(/NexusConseiller\.niveauRentabilite/.test(page), 'rentabilité lue du moteur');
  assert.ok(!/>=\s*0\.40|>=\s*0\.25|>=\s*0\.10/.test(page), 'paliers de rentabilité en dur');
});
t('la source unique n’est pas dupliquée dans le moteur (un seul bloc de seuils)', () => {
  assert.strictEqual((conseillerSrc.match(/const SEUILS_RENTABILITE\s*=/g) || []).length, 1);
  assert.strictEqual((conseillerSrc.match(/const DUREE_DORMANT_PERIODES\s*=/g) || []).length, 1);
  assert.strictEqual((conseillerSrc.match(/const DUREE_RELEVE_STOCK_JOURS\s*=/g) || []).length, 1);
});

// ---------- Recherche ----------
const normaliser = new Function(extraire(page, 'function normaliserRecherche') + '; return normaliserRecherche;')();
const PRODUCTS = [
  { article: 'Crème solaire', categorie: 'Parapharmacie', code_barres: '3600000000017', source: null },
  { article: 'CRÈME DE JOUR', categorie: 'Parapharmacie', code_barres: null, source: 'période du 01/09/2026 au 14/09/2026' },
  { article: 'Biscuit seul en stock', categorie: 'Stock', code_barres: '3700000000024', source: 'stock du 02/11/2026' },
  { article: 'Eau', categorie: 'Boissons', code_barres: null, source: null },
];
const chercher = s => { const q = normaliser(s); return PRODUCTS.filter(p => normaliser(p.article).includes(q) || (p.code_barres && String(p.code_barres).includes(q))); };
t('recherche insensible aux accents et à la casse', () => {
  assert.strictEqual(normaliser('  CRÈME   '), 'creme');
  assert.deepStrictEqual(chercher('creme').map(p => p.article), ['Crème solaire', 'CRÈME DE JOUR']);
  assert.strictEqual(chercher('crème').length, 2);
});
t('recherche par code-barres', () => {
  assert.deepStrictEqual(chercher('3600000000017').map(p => p.article), ['Crème solaire']);
  assert.deepStrictEqual(chercher('37000').map(p => p.article), ['Biscuit seul en stock']);
});
t('article connu seulement par le stock : trouvé, avec sa source affichée', () => {
  const r = chercher('biscuit');
  assert.strictEqual(r.length, 1); assert.ok(/^stock du /.test(r[0].source));
  assert.ok(/p\.source/.test(extraire(page, 'searchInput.addEventListener') + page.slice(page.indexOf('searchInput.addEventListener'), page.indexOf('searchInput.addEventListener') + 2500)), 'la source est affichée dans les suggestions');
});
t('deux noms voisins ne sont jamais fusionnés (correspondance sur le nom exact)', () => {
  const src = page.slice(page.indexOf('async function construireProduitsLive'), page.indexOf('async function construireProduitsLive') + 12000);
  assert.ok(/Jamais de fusion de deux noms/.test(src));
  assert.ok(/nomsConnus\.has\(nom\)/.test(src) && /stockParArticle\[nom\]/.test(src) && !/toLowerCase|normaliserRecherche|levenshtein/i.test(src.slice(src.indexOf('const connus'))));
});
t('le texte d’accueil ne promet plus « toutes les références importées »', () => {
  assert.ok(!/toutes les références importées sont disponibles/i.test(page));
});

// ---------- Pied de page ----------
t('pied de page : nom de la station lu en base, période réelle, aucun nom en dur', () => {
  const pied = page.match(/<footer>[\s\S]*?<\/footer>/)[0];
  assert.ok(/class="nexus-nom-commerce"/.test(pied) && /id="piedPeriode"/.test(pied));
  assert.ok(!/Sainte-Marie|Vito/i.test(pied), 'nom de station en dur dans le pied de page');
  assert.ok(/données du ' \+ fmtDate\(PERIODE_DONNEES\.debut\)/.test(page));
  assert.ok(!/Dernier trimestre importé/.test(page), '« Dernier trimestre importé » doit devenir la période réelle');
  // nexus-auth.js remplit .nexus-nom-commerce depuis la base : la station de test affiche donc son propre nom
  const auth = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
  assert.ok(/nexus-nom-commerce/.test(auth));
});
t('explication « Aucune vente récente » neutre ; estimations datées ; limite des imports documentée', () => {
  assert.ok(/Aucune vente sur la période affichée\. NEXUS ne tire pas de conclusion sans relevé de stock récent\./.test(page));
  assert.ok(!/n'indique pas forcément un problème de demande/.test(page));
  assert.ok(/suggestion\$\{data\.assigne_le/.test(page), 'emplacement suggéré : mot et date');
  assert.ok(/estimation au PMA, relevé du \$\{dateRelv\}/.test(page), 'valeur du stock : mot et date');
  assert.ok(/même début mais de fin différente ne sont pas\s+\/\/ distingués/.test(page), 'limite des imports de même début documentée');
});
t('commentaires périmés corrigés', () => {
  assert.ok(!/~\s*40\s*%/.test(page), '« ~40 % » de rapprochement');
});

// ---------- Chargement ciblé : client Supabase simulé ----------
// Jeu : 6 périodes (14 jours chacune), 1 100 articles par période, soit 6 600 lignes (ordre de grandeur de #160).
function fabriquer() {
  const periodes = [];
  let fin = Date.parse('2026-10-23T00:00:00Z');
  for (let i = 0; i < 6; i++) {
    const debut = fin - 13 * 86400000;
    periodes.push({ periode_debut: new Date(debut).toISOString().slice(0, 10), periode_fin: new Date(fin).toISOString().slice(0, 10) });
    fin = debut - 86400000;
  }
  const lignes = [];
  periodes.forEach((p, k) => {
    for (let a = 0; a < 1100; a++) {
      // les articles 0..49 ne se vendent plus depuis les deux dernières périodes complètes (dormants potentiels)
      const vend = a >= 50 || k >= 3;
      lignes.push({ site: 'nexus-station-test', categorie: 'Rayon ' + (a % 5), article: 'Article ' + a, ca: vend ? 100 + a : 0, marge: 30, prix_achat: 1, prix_vente: 2, quantite: vend ? 10 : 0, periode_debut: p.periode_debut, periode_fin: p.periode_fin, code_barres: a % 3 ? null : '36000' + String(a).padStart(8, '0') });
    }
  });
  const stock = [];
  for (let a = 0; a < 60; a++) stock.push({ site: 'nexus-station-test', categorie: 'Rayon ' + (a % 5), article: 'Article ' + a, code_barres: null, quantite_theorique: a % 2 ? 0 : 5, quantite_reelle: null, releve_le: '2026-11-0' + (1 + (a % 8)) });
  stock.push({ site: 'nexus-station-test', categorie: 'Stock', article: 'Biscuit seul en stock', code_barres: '3700000000024', quantite_theorique: 3, quantite_reelle: null, releve_le: '2026-11-02' });
  stock.push({ site: 'nexus-station-test', categorie: 'Stock', article: 'Vieux relevé', code_barres: null, quantite_theorique: 3, quantite_reelle: null, releve_le: '2026-06-02' });
  return { lignes, stock, periodes };
}
function clientSimule(jeu, compteur) {
  const from = (table) => {
    const src = table === 'products' ? jeu.lignes : jeu.stock;
    let rows = src, cols = null, limite = null, plage = null; const ordres = [];
    const q = {
      select(c) { cols = c; return q; },
      eq(c, v) { rows = rows.filter(r => r[c] === v); return q; },
      lt(c, v) { rows = rows.filter(r => r[c] < v); return q; },
      gte(c, v) { rows = rows.filter(r => r[c] >= v); return q; },
      order(c, o) { ordres.push([c, o && o.ascending === false ? -1 : 1]); return q; },
      limit(l) { limite = l; return q; },
      range(a, b) { plage = [a, b]; return q; },
      then(res, rej) {
        let r = rows.slice();
        ordres.slice().reverse().forEach(([c, s]) => r.sort((x, y) => (x[c] < y[c] ? -s : x[c] > y[c] ? s : 0)));
        if (limite != null) r = r.slice(0, limite);
        if (plage) r = r.slice(plage[0], Math.min(plage[1], plage[0] + 999) + 1); // plafond Supabase de 1000
        const noms = cols.split(',').map(s => s.trim());
        r = r.map(x => Object.fromEntries(noms.map(c => [c, x[c]])));
        compteur[table] = (compteur[table] || 0) + r.length;
        return Promise.resolve({ data: r, error: null }).then(res, rej);
      },
    };
    return q;
  };
  return { from };
}
(async () => {
  const jeu = fabriquer();
  const total = jeu.lignes.length;
  const compteur = {};
  const code = [
    extraire(page, 'async function fetchAllRows'),
    'const LECTURES = { products: 0, stock_releves: 0, periodes: 0 };',
    page.match(/const COLONNES_PRODUCTS = .*;/)[0],
    'const NB_PERIODES_MAX = 6;',
    'let AUJOURDHUI_STATION = null; let PERIODE_DONNEES = null;',
    extraire(page, 'function jourDeLaStation'), extraire(page, 'function fmtJourFr'), extraire(page, 'function libellePeriode'),
    extraire(page, 'async function listerPeriodes'), extraire(page, 'async function lirePeriode'),
    extraire(page, 'async function lireStockRecent'), extraire(page, 'async function construireProduitsLive'),
    'return { run: async () => ({ produits: await construireProduitsLive(), lectures: LECTURES, periode: PERIODE_DONNEES }) };',
  ].join('\n');
  // jourDeLaStation lit l'horloge réelle : on la fige au 10/11/2026 pour que l'épreuve ne périme pas.
  const RealDate = Date;
  const figee = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super('2026-11-10T14:00:00Z'); } static now() { return new RealDate('2026-11-10T14:00:00Z').getTime(); } };
  global.Date = figee;
  let sortie;
  try {
    const run = new Function('nexusClient', 'SITE_ACTUEL', 'NexusPeriodes', 'NexusConseiller', 'window', 'nexusFuseauSite', code)(
      clientSimule(jeu, compteur), 'nexus-station-test', global.NexusPeriodes, C, {}, async () => 'America/Martinique');
    sortie = await run.run();
  } finally { global.Date = RealDate; }

  const lues = sortie.lectures.products + sortie.lectures.periodes;
  const ancien = total; // avant : toutes les lignes de toutes les périodes à chaque ouverture
  console.log(`  mesure simulée : avant ${ancien} lignes products ; après ${sortie.lectures.products} lignes + ${sortie.lectures.periodes} lignes de dates, ${sortie.lectures.stock_releves} relevés de stock`);
  assert.ok(sortie.lectures.products <= 4 * 1100, 'au plus 4 périodes lues (affichée, paire, deux complètes)');
  assert.ok(lues < ancien, 'chargement ciblé < lecture intégrale');
  assert.strictEqual(sortie.lectures.periodes <= 6, true);
  assert.ok(sortie.lectures.stock_releves <= 61, 'relevé de plus de 30 jours jamais lu');
  n++; console.log('✓ chargement ciblé : périodes utiles seulement, relevés de moins de 30 jours seulement');

  const parNom = {}; sortie.produits.forEach(p => { parNom[p.article] = p; });
  assert.ok(parNom['Biscuit seul en stock'] && /^stock du 02\/11\/2026$/.test(parNom['Biscuit seul en stock'].source));
  assert.ok(!parNom['Vieux relevé'], 'relevé de plus de 30 jours : hors chargement');
  n++; console.log('✓ article connu seulement par le stock : présent avec sa source ; relevé périmé absent');

  // Guardian 6783561611 point 1 : un article en stock seul, quantité > 0, relevé de 8 jours, aucune vente sur les périodes chargées = Dormant.
  assert.strictEqual(parNom['Biscuit seul en stock'].periodesSansVente, 2);
  assert.strictEqual(C.statutProduit(parNom['Biscuit seul en stock'], '2026-11-10').cle, 'dormant');
  n++; console.log('✓ article en stock seul, quantité > 0, relevé récent : Dormant');

  // Statuts de bout en bout sur le jeu simulé (affichée = 07/10→23/10, ventes sauf articles 0..49 depuis 3 périodes)
  const stat = nom => C.statutProduit(parNom[nom], '2026-11-10').cle;
  assert.ok(sortie.produits.every(p => p.site === undefined), 'aucune colonne site exposée');
  assert.ok(['dormant', 'rupture-probable', 'aucune-vente'].includes(stat('Article 0')), 'article éteint : statut sans vente');
  assert.strictEqual(stat('Article 100') === 'dormant', false);
  n++; console.log('✓ statuts calculés sur les données chargées');

  // Filtre de site : aucun relevé ni ligne d'un autre site
  const autre = fabriquer(); autre.lignes.forEach(r => { r.site = 'autre-site'; }); autre.stock.forEach(r => { r.site = 'autre-site'; });
  const c2 = {};
  global.Date = figee;
  try {
    const run2 = new Function('nexusClient', 'SITE_ACTUEL', 'NexusPeriodes', 'NexusConseiller', 'window', 'nexusFuseauSite', code)(
      clientSimule(autre, c2), 'nexus-station-test', global.NexusPeriodes, C, {}, async () => 'America/Martinique');
    const s2 = await run2.run();
    assert.deepStrictEqual(s2.produits, []);
    assert.strictEqual(s2.lectures.products, 0);
  } finally { global.Date = RealDate; }
  n++; console.log('✓ toujours filtré sur le site de l’employé : un autre site ne remonte rien');

  console.log(`\n${n} épreuves passées.`);
})().catch(e => { console.error('✗ ÉCHEC :', e); process.exit(1); });
