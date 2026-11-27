// Brief perf-8 : la fonction base stock_releves_derniers(p_site), passée dans
// NexusStock.calculerAnalyseStock, donne EXACTEMENT les mêmes résultats que la
// lecture brute de stock_releves (jeu fictif : égalités et changement de
// catégorie). Contient aussi le repli, le journal ?diag=perf et le contrat SQL.
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
const FICHIERS = ['nexus-stock.js', 'nexus-conseiller.js', 'nexus-conseiller-donnees.js'];

// Port JS fidèle de la fonction SQL : deux plus récents par (article, catégorie)
// (releve_le, importe_le, id décroissants), rendus dans l'ordre total
// releve_le, importe_le, id croissants.
function derniersCommeLaBase(lignes, site) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const asc = (a, b) => cmp(a.releve_le, b.releve_le) || cmp(a.importe_le, b.importe_le) || cmp(a.id, b.id);
  const groupes = new Map();
  lignes.filter(l => l.site === site).forEach(l => {
    const k = JSON.stringify([l.article, l.categorie]);
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(l);
  });
  const sortie = [];
  groupes.forEach(g => g.sort((a, b) => asc(b, a)).slice(0, 2).forEach(l => sortie.push(l)));
  return sortie.sort(asc).map(l => ({ article: l.article, categorie: l.categorie, quantite_theorique: l.quantite_theorique, releve_le: l.releve_le }));
}

// Jeu fictif. ART-A : 3 relevés. ART-B : égalité de releve_le (départage par
// importe_le puis id). ART-C : changement de catégorie au dernier relevé.
// ART-D : catégorie « hors rayon » au dernier relevé (filtre navigateur).
// ART-E : un seul relevé. ART-F : site différent (jamais lu).
let id = 0;
const R = (article, categorie, q, le, imp, site) => ({ id: ++id, site: site || 'site-x', article, categorie, quantite_theorique: q, releve_le: le, importe_le: imp || le });
const tous = [
  R('ART-A', 'confiserie', 50, '2026-10-01'), R('ART-A', 'confiserie', 30, '2026-10-08'), R('ART-A', 'confiserie', 10, '2026-10-14'),
  R('ART-B', 'confiserie', 40, '2026-10-01'), R('ART-B', 'confiserie', 25, '2026-10-14', '2026-10-15T08:00'), R('ART-B', 'confiserie', 20, '2026-10-14', '2026-10-15T09:00'),
  R('ART-B', 'confiserie', 21, '2026-10-14', '2026-10-15T09:00'),
  R('ART-C', 'boissons', 30, '2026-10-01'), R('ART-C', 'boissons', 28, '2026-10-08'), R('ART-C', 'confiserie', 5, '2026-10-14'),
  R('ART-D', 'boissons', 9, '2026-10-01'), R('ART-D', 'boissons', 9, '2026-10-08'), R('ART-D', 'carte prépayée', 9, '2026-10-14'),
  R('ART-E', 'boissons', 8, '2026-10-14'),
  R('ART-F', 'boissons', 3, '2026-10-01', null, 'site-y'),
];
const brut = tous.filter(l => l.site === 'site-x').map(l => ({ article: l.article, categorie: l.categorie, quantite_theorique: l.quantite_theorique, releve_le: l.releve_le }));
const ventes = [
  { article: 'ART-A', quantite: 6, prix_vente: 2.5, periode_debut: '2026-10-01', periode_fin: '2026-10-07' },
  { article: 'ART-B', quantite: 5, prix_vente: 7, periode_debut: '2026-10-01', periode_fin: '2026-10-14' },
  { article: 'ART-C', quantite: 2, prix_vente: 3, periode_debut: '2026-10-08', periode_fin: '2026-10-14' },
];
const controles = [{ article: 'ART-A', ecart: 1, controle_le: '2026-10-10' }];

(async () => {
  const g = charger(FICHIERS);
  const D = g.NexusConseillerDonnees;
  const S = g.NexusStock;
  const base = derniersCommeLaBase(tous, 'site-x');

  await t('port SQL : filtré sur le site, au plus 2 lignes par article et catégorie', () => {
    assert.ok(!base.some(l => l.article === 'ART-F'));
    assert.strictEqual(base.filter(l => l.article === 'ART-A').length, 2);
    assert.strictEqual(base.filter(l => l.article === 'ART-C' && l.categorie === 'boissons').length, 2);
    assert.strictEqual(base.filter(l => l.article === 'ART-C' && l.categorie === 'confiserie').length, 1);
    assert.ok(base.length < brut.length);
  });

  await t('égalité de releve_le : le dernier importé (puis le plus grand id) gagne', () => {
    const b = base.filter(l => l.article === 'ART-B' && l.releve_le === '2026-10-14');
    assert.strictEqual(b.length, 2);
    assert.deepStrictEqual(b.map(l => l.quantite_theorique).sort(), [20, 21].sort());
  });

  await t('équivalence ligne à ligne de calculerAnalyseStock (brut contre base)', () => {
    const a = S.calculerAnalyseStock(brut, ventes, controles);
    const b = S.calculerAnalyseStock(base, ventes, controles);
    assert.strictEqual(a.length, b.length);
    const trie = x => [...x].sort((p, q) => p.article.localeCompare(q.article));
    // nbReleves = nombre de relevés reçus : seule valeur qui diffère (la base n'en
    // rend que 2 par article et catégorie). Aucun écran ne la lit (git grep).
    const sans = o => { const c = Object.assign({}, o); delete c.nbReleves; return c; };
    trie(a).forEach((x, i) => {
      assert.deepStrictEqual(sans(trie(b)[i]), sans(x), 'ligne ' + x.article);
      assert.ok(trie(b)[i].nbReleves <= x.nbReleves, 'nbReleves base <= brut ' + x.article);
    });
    assert.deepStrictEqual(S.calculerRisqueParRayon(a), S.calculerRisqueParRayon(b));
  });

  await t('changement de catégorie : la catégorie vient du dernier relevé, ART-C compté une fois', () => {
    const b = S.calculerAnalyseStock(base, ventes, controles).filter(x => x.article === 'ART-C');
    assert.strictEqual(b.length, 1); assert.strictEqual(b[0].categorie, 'confiserie');
  });

  await t('dernier relevé hors rayon : ART-D suit la même règle brut / base', () => {
    const a = S.calculerAnalyseStock(brut, ventes, controles).find(x => x.article === 'ART-D');
    const b = S.calculerAnalyseStock(base, ventes, controles).find(x => x.article === 'ART-D');
    assert.deepStrictEqual(b, a);
  });

  // Client factice : rpc paginé (range) ou refus.
  function client(mode, journal) {
    const c = {
      from(table) {
        journal.push('from:' + table);
        const rows = table === 'stock_releves' ? brut : table === 'controles_stock' ? controles : ventes;
        const q = { select: () => q, eq: () => q, order: () => q, range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) };
        return q;
      },
    };
    if (mode !== 'sans-rpc') c.rpc = (nom, args) => {
      journal.push('rpc:' + nom + ':' + args.p_site);
      if (mode === 'refus') return { range: () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }) };
      if (mode === 'jette') throw new Error('réseau');
      const lignes = derniersCommeLaBase(tous, args.p_site);
      return { range: (a, b) => Promise.resolve({ data: lignes.slice(a, b + 1), error: null }) };
    };
    return c;
  }

  await t('chemin base : rpc appelé avec p_site, stock_releves non lu', async () => {
    const j = []; await D.chargerCandidatsStock(client('ok', j), 'site-x');
    assert.ok(j.includes('rpc:stock_releves_derniers:site-x'));
    assert.ok(!j.includes('from:stock_releves'));
  });

  for (const mode of ['refus', 'jette', 'sans-rpc']) {
    await t('repli sur la lecture brute : ' + mode, async () => {
      const j = []; await D.chargerCandidatsStock(client(mode, j), 'site-x');
      assert.ok(j.includes('from:stock_releves'));
    });
  }

  await t('candidats identiques base / repli', async () => {
    const a = await D.chargerCandidatsStock(client('ok', []), 'site-x');
    const b = await D.chargerCandidatsStock(client('refus', []), 'site-x');
    assert.deepStrictEqual(a, b);
  });

  await t('journal ?diag=perf seulement avec le paramètre', async () => {
    const lignes = [];
    const avec = charger(FICHIERS, { location: { search: '?diag=perf' }, console: { info: m => lignes.push(m), error() {}, log() {} } });
    await avec.NexusConseillerDonnees.chargerCandidatsStock(client('refus', []), 'site-x');
    assert.ok(lignes.some(m => /\[diag perf\] relevés stock : repli lecture brute \(42501\)/.test(m)), lignes.join('|'));
    const sans = [];
    const g2 = charger(FICHIERS, { location: { search: '' }, console: { info: m => sans.push(m), error() {}, log() {} } });
    await g2.NexusConseillerDonnees.chargerCandidatsStock(client('refus', []), 'site-x');
    assert.strictEqual(sans.length, 0);
  });

  // La migration : contrat de sécurité écrit.
  const sql = fs.readFileSync(__dirname + '/supabase/migrations/20261127150000_stock_releves_derniers.sql', 'utf8');
  const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  await t('migration : invoker, search_path vide, p_site obligatoire et filtré, lecture seule', () => {
    assert.ok(/security invoker/i.test(code));
    assert.ok(/set search_path\s*=\s*''/i.test(code));
    assert.ok(/p_site is null or btrim\(p_site\) = ''/.test(code));
    assert.ok(/where r\.site = p_site/.test(code));
    assert.ok(/order by r\.releve_le desc, r\.importe_le desc, r\.id desc/.test(code));
    assert.ok(/order by t\.releve_le, t\.importe_le, t\.id;/.test(code));
    assert.ok(!/\b(insert|update|delete|truncate|alter)\b/i.test(code));
  });
  await t('migration : revoke public/anon, grant authenticated seul, drop de products_ventes_stock', () => {
    assert.ok(/revoke all on function public\.stock_releves_derniers\(text\) from public;/.test(code));
    assert.ok(/revoke all on function public\.stock_releves_derniers\(text\) from anon;/.test(code));
    const grants = code.match(/grant execute[^;]*;/gi) || [];
    assert.strictEqual(grants.length, 1); assert.ok(/to authenticated;/.test(grants[0]));
    assert.ok(/drop function if exists public\.products_ventes_stock\(text\);/.test(code));
    assert.ok(/drop function public\.stock_releves_derniers\(text\);/.test(sql));
  });

  console.log(ok + ' ok');
})();
