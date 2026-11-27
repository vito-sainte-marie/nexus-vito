// Brief perf-7 (option c) : la fonction base products_ventes_stock donne, à travers
// NexusStock.calculerAnalyseStock, EXACTEMENT les mêmes résultats que la lecture
// brute de `products` (jeu fictif). Contient aussi le repli et le journal diag.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let ok = 0;
function t(nom, f) { return Promise.resolve().then(f).then(() => { ok++; }, e => { console.error('ECHEC', nom, e.message); process.exitCode = 1; }); }
function charger(fichiers, extra) {
  const g = Object.assign({ console }, extra || {}); g.window = g; g.self = g;
  vm.createContext(g);
  fichiers.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), g, { filename: f }));
  return g;
}

// Port JS fidèle de la fonction SQL : group by (article, debut, fin), somme des
// quantités, premier prix non nul par id croissant, tri article/debut/fin.
function agregerCommeLaBase(lignes) {
  const m = new Map();
  [...lignes].sort((a, b) => a.id - b.id).forEach(l => {
    const k = [l.article, l.periode_debut, l.periode_fin].join('|');
    if (!m.has(k)) m.set(k, { article: l.article, periode_debut: l.periode_debut, periode_fin: l.periode_fin, quantite: 0, prix_vente: null });
    const g = m.get(k);
    g.quantite += (l.quantite || 0);
    if (g.prix_vente === null && l.prix_vente !== null && l.prix_vente !== 0) g.prix_vente = l.prix_vente;
  });
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...m.values()].sort((a, b) => cmp(a.article, b.article) || cmp(a.periode_debut, b.periode_debut) || cmp(a.periode_fin, b.periode_fin));
}

// Jeu fictif : doublons sur une même période, prix nuls/null, article sans vente,
// période hors relevés, plusieurs articles. Un seul prix non nul par article.
const brut = [
  { id: 1, article: 'ART-A', quantite: 4, prix_vente: 0, periode_debut: '2026-10-01', periode_fin: '2026-10-07' },
  { id: 2, article: 'ART-A', quantite: 6, prix_vente: 2.5, periode_debut: '2026-10-01', periode_fin: '2026-10-07' },
  { id: 3, article: 'ART-A', quantite: 3, prix_vente: 2.5, periode_debut: '2026-10-08', periode_fin: '2026-10-14' },
  { id: 4, article: 'ART-B', quantite: 10, prix_vente: null, periode_debut: '2026-10-01', periode_fin: '2026-10-07' },
  { id: 5, article: 'ART-B', quantite: 5, prix_vente: 7, periode_debut: '2026-10-08', periode_fin: '2026-10-14' },
  { id: 6, article: 'ART-C', quantite: 1, prix_vente: 3, periode_debut: '2026-09-01', periode_fin: '2026-09-07' },
  { id: 7, article: 'ART-D', quantite: 2, prix_vente: 0, periode_debut: '2026-10-01', periode_fin: '2026-10-07' },
];
const releves = [
  { article: 'ART-A', categorie: 'confiserie', quantite_theorique: 50, releve_le: '2026-10-01' },
  { article: 'ART-A', categorie: 'confiserie', quantite_theorique: 10, releve_le: '2026-10-14' },
  { article: 'ART-B', categorie: 'confiserie', quantite_theorique: 40, releve_le: '2026-10-01' },
  { article: 'ART-B', categorie: 'confiserie', quantite_theorique: 20, releve_le: '2026-10-14' },
  { article: 'ART-C', categorie: 'boissons', quantite_theorique: 30, releve_le: '2026-10-01' },
  { article: 'ART-C', categorie: 'boissons', quantite_theorique: 5, releve_le: '2026-10-14' },
  { article: 'ART-D', categorie: 'boissons', quantite_theorique: 9, releve_le: '2026-10-01' },
  { article: 'ART-D', categorie: 'boissons', quantite_theorique: 9, releve_le: '2026-10-14' },
  { article: 'ART-E', categorie: 'boissons', quantite_theorique: 8, releve_le: '2026-10-01' },
  { article: 'ART-E', categorie: 'boissons', quantite_theorique: 1, releve_le: '2026-10-14' },
];
const controles = [{ article: 'ART-A', ecart: 1, controle_le: '2026-10-10' }];

(async () => {
  const g = charger(['nexus-stock.js', 'nexus-conseiller.js', 'nexus-conseiller-donnees.js']);
  const D = g.NexusConseillerDonnees;
  const S = g.NexusStock;
  const agr = agregerCommeLaBase(brut);

  await t('agrégat : une ligne par article/période, quantités sommées', () => {
    assert.strictEqual(agr.length, 6);
    const a = agr.find(x => x.article === 'ART-A' && x.periode_debut === '2026-10-01');
    assert.strictEqual(a.quantite, 10); assert.strictEqual(a.prix_vente, 2.5);
  });

  await t('équivalence ligne à ligne de calculerAnalyseStock (brut contre base)', () => {
    const a = S.calculerAnalyseStock(releves, brut, controles);
    const b = S.calculerAnalyseStock(releves, agr, controles);
    assert.strictEqual(a.length, b.length);
    a.forEach((x, i) => {
      // joursDepuisControle dépend de l'horloge : mêmes entrées, même instant à la minute près
      assert.deepStrictEqual(b[i], x, 'ligne ' + x.article);
    });
    assert.deepStrictEqual(S.calculerRisqueParRayon(a), S.calculerRisqueParRayon(b));
  });

  // Client factice : rpc paginé (range) ou refus ; from('products') pour le repli.
  function client(mode, journal) {
    const pageur = rows => { const q = { range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) }; return q; };
    const c = {
      from(table) {
        journal.push('from:' + table);
        const rows = table === 'stock_releves' ? releves : table === 'controles_stock' ? controles : brut;
        const q = { select: () => q, eq: () => q, order: () => q, range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) };
        return q;
      },
    };
    if (mode !== 'sans-rpc') c.rpc = (nom, args) => {
      journal.push('rpc:' + nom + ':' + args.p_site);
      if (mode === 'refus') return { range: () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }) };
      if (mode === 'jette') throw new Error('réseau');
      return pageur(agr);
    };
    return c;
  }

  await t('chemin base : rpc appelé avec p_site, products non lu', async () => {
    const j = []; const r = await D.chargerVentesStock(client('ok', j), 'site-x');
    assert.ok(j.includes('rpc:products_ventes_stock:site-x'));
    assert.ok(!j.includes('from:products'));
    assert.strictEqual(r.data.length, agr.length);
  });

  for (const mode of ['refus', 'jette', 'sans-rpc']) {
    await t('repli sur la lecture brute : ' + mode, async () => {
      const j = []; const r = await D.chargerVentesStock(client(mode, j), 'site-x');
      assert.ok(j.includes('from:products'));
      assert.strictEqual(r.data.length, brut.length);
    });
  }

  await t('candidats identiques base / repli', async () => {
    const a = await D.chargerCandidatsStock(client('ok', []), 's');
    const b = await D.chargerCandidatsStock(client('refus', []), 's');
    assert.deepStrictEqual(a, b);
  });

  await t('journal ?diag=perf seulement avec le paramètre', async () => {
    const lignes = [];
    const avec = charger(['nexus-stock.js', 'nexus-conseiller.js', 'nexus-conseiller-donnees.js'],
      { location: { search: '?diag=perf' }, console: { info: m => lignes.push(m), error() {}, log() {} } });
    await avec.NexusConseillerDonnees.chargerVentesStock(client('refus', []), 's');
    assert.ok(lignes.some(m => /\[diag perf\] ventes stock : repli lecture brute \(42501\)/.test(m)), lignes.join('|'));
    const sans = [];
    const g2 = charger(['nexus-stock.js', 'nexus-conseiller.js', 'nexus-conseiller-donnees.js'],
      { location: { search: '' }, console: { info: m => sans.push(m), error() {}, log() {} } });
    await g2.NexusConseillerDonnees.chargerVentesStock(client('refus', []), 's');
    assert.strictEqual(sans.length, 0);
  });

  // La migration : contrat de sécurité écrit.
  const sql = fs.readFileSync('supabase/migrations/20261127120000_products_ventes_stock_par_article.sql', 'utf8');
  const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  await t('migration : invoker, search_path vide, p_site obligatoire et filtré, lecture seule', () => {
    assert.ok(/security invoker/i.test(code));
    assert.ok(/set search_path\s*=\s*''/i.test(code));
    assert.ok(/p_site is null or btrim\(p_site\) = ''/.test(code));
    assert.ok(/where p\.site = p_site/.test(code));
    assert.ok(!/\b(insert|update|delete|truncate|alter|drop)\b/i.test(code));
  });
  await t('migration : revoke public/anon, grant authenticated seul, rollback écrit', () => {
    assert.ok(/revoke all on function public\.products_ventes_stock\(text\) from public;/.test(code));
    assert.ok(/revoke all on function public\.products_ventes_stock\(text\) from anon;/.test(code));
    const grants = code.match(/grant execute[^;]*;/gi) || [];
    assert.strictEqual(grants.length, 1); assert.ok(/to authenticated;/.test(grants[0]));
    assert.ok(/drop function public\.products_ventes_stock\(text\);/.test(sql));
  });

  console.log(ok + ' ok');
})();
