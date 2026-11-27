// B0-perf-3 : (1) chargerCandidatsStock parallèle = mêmes lignes qu'en séquentiel,
// (2) départage des concentrations de marge par importance.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let ok = 0;
function t(nom, f) { return Promise.resolve().then(f).then(() => { ok++; }, e => { console.error('ECHEC', nom, e.message); process.exitCode = 1; }); }
function charger(fichier, extra) {
  const g = Object.assign({ console }, extra || {}); g.window = g; g.self = g;
  vm.createContext(g); vm.runInContext(fs.readFileSync(fichier, 'utf8'), g, { filename: fichier });
  return g;
}

(async () => {
  // --- Stock : 2500 relevés, 1200 ventes, 30 contrôles ; ordre et contenu transmis intacts.
  const releves = Array.from({ length: 2500 }, (_, i) => ({ article: 'A' + String(i).padStart(4, '0'), categorie: 'c', quantite_theorique: i, releve_le: '2026-01-01' }));
  const ventes = Array.from({ length: 1200 }, (_, i) => ({ article: 'A' + String(i).padStart(4, '0'), quantite: 1 }));
  const controles = Array.from({ length: 30 }, (_, i) => ({ article: 'A' + String(i).padStart(4, '0'), ecart: 1, controle_le: '2026-02-01' }));
  const tables = { stock_releves: releves, products: ventes, controles_stock: controles };
  let appels = {}; let vu = null;
  const client = { from(table) {
    const q = { select: () => q, eq: () => q, order: () => q,
      range: (a, b) => new Promise(r => { appels[table] = (appels[table] || 0) + 1; setTimeout(() => r({ data: tables[table].slice(a, b + 1), error: null }), table === 'stock_releves' ? 5 : 1); }) };
    return q;
  } };
  const g = charger('nexus-conseiller-donnees.js', {
    NexusStock: { calculerAnalyseStock: (r, v, c) => { vu = { r, v, c }; return 'analyse'; }, calculerRisqueParRayon: a => [a] },
    NexusConseiller: { normaliserStockRayon: x => 'norm:' + x },
  });
  await t('stock : mêmes lignes, même ordre', async () => {
    const res = await g.NexusConseillerDonnees.chargerCandidatsStock(client, 's');
    assert.strictEqual(JSON.stringify(res), JSON.stringify(['norm:analyse']));
    assert.strictEqual(JSON.stringify(vu.r), JSON.stringify(releves));
    assert.strictEqual(JSON.stringify(vu.v), JSON.stringify(ventes));
    assert.strictEqual(JSON.stringify(vu.c), JSON.stringify(controles));
    assert.strictEqual(appels.stock_releves, 1 + 4);
    assert.strictEqual(appels.products, 1 + 4);   // 1 page pleine, puis un lot de 4 (la 2e est courte)
    assert.strictEqual(appels.controles_stock, 1);
  });
  await t('stock : erreur sur les relevés => []', async () => {
    const c2 = { from(table) { const q = { select: () => q, eq: () => q, order: () => q,
      range: () => Promise.resolve(table === 'stock_releves' ? { data: null, error: { message: 'x' } } : { data: [], error: null }) }; return q; } };
    const err = console.error; console.error = () => {};
    try { assert.strictEqual(JSON.stringify(await g.NexusConseillerDonnees.chargerCandidatsStock(c2, 's')), '[]'); } finally { console.error = err; }
  });

  // --- Départage des concentrations de marge.
  const m = charger('nexus-secteurs-moteur.js', { NexusRisques: { RANG_NIVEAU: { anomalie: 0, faible: 1, moyen: 2, eleve: 3 } } });
  const syn = m.NexusSecteursMoteur ? m.NexusSecteursMoteur.construireSyntheseFreinMarge : (m.construireSyntheseFreinMarge);
  assert.ok(syn, 'construireSyntheseFreinMarge exposée');
  const cit = sigs => (syn(0, sigs).match(/concentrations? : ([^.]*)\./) || [])[1];
  await t('niveau d\'abord', () => assert.strictEqual(cit([
    { categorie: 'A', niveau: 'faible', impact_mesure_eur: 9999 }, { categorie: 'B', niveau: 'eleve', impact_mesure_eur: 1 }]), 'B, A'));
  await t('impact, puis récurrence, puis ancienneté, puis catégorie', () => {
    const base = { niveau: 'moyen' };
    assert.strictEqual(cit([{ ...base, categorie: 'A', impact_mesure_eur: 10 }, { ...base, categorie: 'B', impact_mesure_eur: 500 }]), 'B, A');
    assert.strictEqual(cit([{ ...base, categorie: 'A', recurrence_count: 1 }, { ...base, categorie: 'B', recurrence_count: 7 }]), 'B, A');
    assert.strictEqual(cit([{ ...base, categorie: 'A', premiere_detection_le: '2026-11-01' }, { ...base, categorie: 'B', premiere_detection_le: '2026-03-01' }]), 'B, A');
    assert.strictEqual(cit([{ ...base, categorie: 'Z' }, { ...base, categorie: 'A' }]), 'A, Z');
    assert.strictEqual(cit([{ ...base, categorie: 'A', impact_mesure_eur: 500, recurrence_count: 1 }, { ...base, categorie: 'B', impact_mesure_eur: 500, recurrence_count: 3 }]), 'B, A');
  });
  await t('impact null compte comme 0, trois cités au plus', () => assert.strictEqual(cit([
    { niveau: 'moyen', categorie: 'A', impact_mesure_eur: null }, { niveau: 'moyen', categorie: 'B', impact_mesure_eur: 5 },
    { niveau: 'moyen', categorie: 'C' }, { niveau: 'moyen', categorie: 'D' }]), 'B, A, C'));
  console.log(ok + ' ok');
})();
