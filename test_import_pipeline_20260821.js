// Tests — refonte NEXUS Import (audit UX/DataPipeline du 21/08/2026).
// Convention établie : require() direct des vrais fichiers, jamais une
// copie de la logique testée.
const assert = require('assert');
const path = require('path');
const PROJET = path.join(__dirname);

global.window = global;
const M = require(path.join(PROJET, 'nexus-import-moteur.js'));
const D = require(path.join(PROJET, 'nexus-import-donnees.js'));

let pass = 0, fail = 0;
function test(nom, fn) {
  try { fn(); pass++; console.log('OK —', nom); }
  catch (e) { fail++; console.error('FAIL —', nom, '\n  ', e.message); }
}
async function testAsync(nom, fn) {
  try { await fn(); pass++; console.log('OK —', nom); }
  catch (e) { fail++; console.error('FAIL —', nom, '\n  ', e.message); }
}

// ============================================================
// PARTIE 1 — nexus-import-moteur.js
// ============================================================

test('detectMapping : synonymes codés en dur, insensible aux accents', () => {
  const headers = ['Catégorie', 'Lib Article', 'QTE', 'PA HT', 'PV HT', 'Code Barres'];
  const { mapping, auto } = M.detectMapping(headers, M.FIELD_DEFS_VENTES, []);
  assert.strictEqual(mapping.categorie, 'Catégorie');
  assert.strictEqual(mapping.article, 'Lib Article');
  assert.strictEqual(mapping.quantite, 'QTE');
  assert.strictEqual(mapping.prix_achat, 'PA HT');
  assert.strictEqual(mapping.prix_vente, 'PV HT');
  assert.strictEqual(mapping.tva, null);
  assert.strictEqual(auto.categorie, true);
});

test('detectMapping : la mémoire (mapping déjà confirmé) prime sur les synonymes codés en dur', () => {
  // En-tête renommé par l'export (I07) — ne matche plus aucun synonyme,
  // mais a déjà été mémorisé pour ce site/cette intention.
  const headers = ['Rayon NEXUS', 'Nom Court'];
  const memoire = [{ champ_canonique: 'categorie', colonne_source: 'Rayon NEXUS' }];
  const { mapping } = M.detectMapping(headers, M.FIELD_DEFS_VENTES, memoire);
  assert.strictEqual(mapping.categorie, 'Rayon NEXUS', 'colonne renommée retrouvée via la mémoire, pas via un synonyme');
  assert.strictEqual(mapping.article, null, '"Nom Court" ne matche aucun synonyme ni mémoire -> non détecté, jamais deviné');
});

test('cleMetierVentes : code-barres prioritaire sur l\'article quand disponible', () => {
  const avecCb = M.cleMetierVentes({ periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'Coca Cola 33CL', codeBarres: '5449000000996' });
  const memeCbAutreArticleOrtho = M.cleMetierVentes({ periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'COCA-COLA 33 CL', codeBarres: '5449000000996' });
  assert.strictEqual(avecCb, memeCbAutreArticleOrtho, 'même code-barres -> même clé, quelle que soit l\'orthographe de l\'article');
  const sansCb = M.cleMetierVentes({ periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'Coca Cola 33CL', codeBarres: null });
  assert.ok(sansCb.includes('art:'), 'sans code-barres -> repli sur l\'article normalisé');
});

test('resoudreAlias : correspondance exacte uniquement, jamais de fuzzy matching', () => {
  const aliases = [{ designation_brute_normalisee: 'baguette', designation_canonique: 'Baguette' }];
  assert.strictEqual(M.resoudreAlias('BAGUETTE', aliases), 'Baguette');
  assert.strictEqual(M.resoudreAlias('Baguette tradition', aliases), null, 'texte proche mais différent -> jamais rapproché automatiquement');
});

test('classifierLignesImport (ventes) : nouvelle / connue_identique / connue_modifiee / doublon_fichier jamais exclu', () => {
  const connuesParCle = new Map();
  const cleConnue = M.cleMetierVentes({ periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'Sprite', codeBarres: null });
  connuesParCle.set(cleConnue, { categorie: 'Boissons', article: 'Sprite', code_barres: null, quantite: 10, prix_achat: 1, prix_vente: 2, tva: 20 });

  const lignes = [
    { valeurs: { periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'Sprite', code_barres: null, quantite: 10, prix_achat: 1, prix_vente: 2, tva: 20 } },
    { valeurs: { periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Boissons', article: 'Sprite', code_barres: null, quantite: 99, prix_achat: 1, prix_vente: 2, tva: 20 } },
    { valeurs: { periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Snack', article: 'Chips', code_barres: null, quantite: 5, prix_achat: 1, prix_vente: 2, tva: 20 } },
    { valeurs: { periodeDebut: '2026-08-01', periodeFin: '2026-08-15', categorie: 'Snack', article: 'Chips', code_barres: null, quantite: 5, prix_achat: 1, prix_vente: 2, tva: 20 } },
  ];
  // Note : la 2e ligne "Sprite" partage la même clé métier que la 1e
  // (même article, pas de code-barres) -> le test porte volontairement
  // sur la 1ère occurrence pour connue_identique et vérifie que la
  // logique de "doublon dans le fichier" s'applique à la répétition.
  const resultats = M.classifierLignesImport({ intention: 'ventes_catalogue', lignes, connuesParCle });
  assert.strictEqual(resultats[0].statut, 'connue_identique');
  assert.strictEqual(resultats[1].statut, 'doublon_fichier', 'même clé déjà vue dans ce fichier');
  assert.strictEqual(resultats[2].statut, 'nouvelle');
  assert.strictEqual(resultats[3].statut, 'doublon_fichier');
  // Vérifie explicitement la doctrine : le moteur ne décide PAS d'exclure
  // les doublons ventes de la publication — ça reste la responsabilité
  // du SQL de publication (import_publier_ventes), qui ne filtre que
  // 'rejetee'. Ici on vérifie juste que le statut est informatif, pas
  // un signal de suppression.
  assert.ok(resultats.every(r => r.statut !== undefined));
});

test('classifierLignesImport (stock) : valeur modifiée à la même date -> connue_modifiee, pas un doublon', () => {
  const connuesParCle = new Map();
  const cle = M.cleMetierStock({ dateReleve: '2026-08-21', article: 'Café moulu', codeBarres: null });
  connuesParCle.set(cle, { categorie: 'Épicerie', article: 'Café moulu', code_barres: null, quantite_theorique: 12 });
  const lignes = [{ valeurs: { dateReleve: '2026-08-21', categorie: 'Épicerie', article: 'Café moulu', code_barres: null, quantite_theorique: 8 } }];
  const resultats = M.classifierLignesImport({ intention: 'stock_theorique', lignes, connuesParCle });
  assert.strictEqual(resultats[0].statut, 'connue_modifiee');
});

test('classifierLignesImport : ligne invalide -> rejetee avec raison explicite, jamais silencieuse', () => {
  const lignes = [{ invalide: true, raisonInvalide: 'Article manquant', valeurs: null }];
  const resultats = M.classifierLignesImport({ intention: 'ventes_catalogue', lignes, connuesParCle: new Map() });
  assert.strictEqual(resultats[0].statut, 'rejetee');
  assert.strictEqual(resultats[0].raison, 'Article manquant');
});

test('calculerScoreQualite : fichier propre -> 100, publication conseillée (I01)', () => {
  const r = M.calculerScoreQualite({ lignesTotal: 100, lignesRejetees: 0, referencesInconnuesCount: 0, lignesDoublonsFichier: 0 });
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.decision, 'publication_conseillee');
});

test('calculerScoreQualite : 12% de lignes incomplètes -> score < 90, publication déconseillée (I17)', () => {
  const r = M.calculerScoreQualite({ lignesTotal: 100, lignesRejetees: 12, referencesInconnuesCount: 0, lignesDoublonsFichier: 0 });
  assert.ok(r.score < 90, `score attendu < 90, obtenu ${r.score}`);
  assert.strictEqual(r.decision, 'publication_deconseillee');
});

test('calculerScoreQualite : majorité de lignes rejetées -> bloqué, jamais publiable', () => {
  const r = M.calculerScoreQualite({ lignesTotal: 100, lignesRejetees: 60, referencesInconnuesCount: 0, lignesDoublonsFichier: 0 });
  assert.strictEqual(r.decision, 'bloque');
});

test('calculerScoreQualite : aucune ligne -> bloqué (fichier vide ou illisible)', () => {
  const r = M.calculerScoreQualite({ lignesTotal: 0, lignesRejetees: 0, referencesInconnuesCount: 0, lignesDoublonsFichier: 0 });
  assert.strictEqual(r.decision, 'bloque');
  assert.strictEqual(r.score, 0);
});

test('construireQualityReport : agrège correctement les compteurs et les causes', () => {
  const resultats = [
    { statut: 'nouvelle' }, { statut: 'nouvelle' },
    { statut: 'connue_identique' }, { statut: 'connue_modifiee' },
    { statut: 'doublon_fichier' }, { statut: 'rejetee' },
  ];
  const rapport = M.construireQualityReport({ lignesTotal: 6, resultats, referencesInconnues: [{ designation: 'Mystère' }], joursManquants: [] });
  assert.strictEqual(rapport.lignes_nouvelles, 2);
  assert.strictEqual(rapport.lignes_connues, 1);
  assert.strictEqual(rapport.lignes_modifiees, 1);
  assert.strictEqual(rapport.lignes_doublons_fichier, 1);
  assert.strictEqual(rapport.lignes_rejetees, 1);
  assert.strictEqual(rapport.references_inconnues.length, 1);
  assert.ok(rapport.causes.some(c => c.code === 'references_inconnues'));
});

test('detecterJoursManquants : trou temporel isolé (I04)', () => {
  const manquants = M.detecterJoursManquants(['2026-08-08', '2026-08-09'], '2026-08-08', '2026-08-11');
  assert.deepStrictEqual(manquants, ['2026-08-10', '2026-08-11']);
});

test('detecterJoursManquants : aucun trou -> tableau vide', () => {
  const manquants = M.detecterJoursManquants(['2026-08-08', '2026-08-09'], '2026-08-08', '2026-08-09');
  assert.deepStrictEqual(manquants, []);
});

test('detecterChevauchement : période partiellement chevauchante détectée (I03)', () => {
  const existantes = [{ debut: '2026-08-01', fin: '2026-08-15' }, { debut: '2026-07-01', fin: '2026-07-15' }];
  const r = M.detecterChevauchement('2026-08-10', '2026-08-20', existantes);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].debut, '2026-08-01');
});

test('construireMessageConseiller : copy exacte par situation (section 16 de l\'audit)', () => {
  assert.strictEqual(
    M.construireMessageConseiller({ situation: 'trou_temporel', dateManquante: '10/08' }),
    'Aucune vente détectée pour le 10/08. Vérifiez si le site était fermé ou si une journée manque.'
  );
  assert.ok(M.construireMessageConseiller({ situation: 'qualite_faible', pourcentageIncomplet: 12 }).includes('Publication déconseillée'));
});

test('impactPourIntention : jamais vide pour une intention connue', () => {
  assert.ok(M.impactPourIntention('ventes_catalogue').length > 0);
  assert.deepStrictEqual(M.impactPourIntention('inconnu'), []);
});

test('etatUX : couleur ambre pour "à confirmer" et "doublons", jamais rouge (cohérent avec la doctrine anti-doublon non bloquante)', () => {
  assert.strictEqual(M.etatUX('a_confirmer', 2).couleur, 'ambre');
  assert.strictEqual(M.etatUX('doublons', 5).couleur, 'ambre');
  assert.strictEqual(M.etatUX('erreur_bloquante').couleur, 'rouge');
});

// ============================================================
// PARTIE 2 — nexus-import-donnees.js (mock Supabase minimal)
// ============================================================

function buildMockClient(tables) {
  const calls = [];
  function chain(table) {
    const state = { table, filters: [], op: null, payload: null, singleMode: null };
    const c = {
      select() { return c; },
      insert(payload) { state.op = 'insert'; state.payload = payload; calls.push({ table, op: 'insert', payload }); return c; },
      upsert(payload, opts) { state.op = 'upsert'; state.payload = payload; calls.push({ table, op: 'upsert', payload, opts }); return c; },
      update(payload) { state.op = 'update'; state.payload = payload; calls.push({ table, op: 'update', payload }); return c; },
      eq(col, val) { state.filters.push([col, val]); return c; },
      gte() { return c; },
      lte() { return c; },
      in() { return c; },
      order() { return c; },
      limit() { return c; },
      maybeSingle() { state.singleMode = 'maybeSingle'; return resolve(); },
      single() { state.singleMode = 'single'; return resolve(); },
      then(resolveFn, rejectFn) { return resolve().then(resolveFn, rejectFn); },
    };
    async function resolve() {
      if (state.op === 'insert' || state.op === 'upsert') return { data: state.payload, error: null };
      if (state.op === 'update') return { data: null, error: null };
      const rows = (tables[table] || []).filter(r => state.filters.every(([col, val]) => r[col] === val));
      if (state.singleMode === 'maybeSingle') return { data: rows[0] || null, error: null };
      if (state.singleMode === 'single') return { data: rows[0] || { id: 'mock-id' }, error: null };
      return { data: rows, error: null };
    }
    return c;
  }
  return {
    _calls: calls,
    from(table) { return chain(table); },
    async rpc(fn, args) { calls.push({ rpc: fn, args }); return { data: [{ lignes_publiees: 3 }], error: null }; },
  };
}

(async () => {

await testAsync('chargerMappingMemoire : ne garde que la ligne la plus récente par champ', async () => {
  // Le mock générique ne trie pas réellement par cree_le desc (order()
  // est un no-op) : la fixture est donc déjà dans l'ordre "plus récent
  // d'abord" attendu en sortie de la vraie requête Supabase.
  const client = buildMockClient({
    import_mappings: [
      { site: 'vito-sainte-marie', intention: 'ventes_catalogue', champ_canonique: 'article', colonne_source: 'Désignation produit', cree_le: '2026-08-20' },
      { site: 'vito-sainte-marie', intention: 'ventes_catalogue', champ_canonique: 'article', colonne_source: 'Lib Article', cree_le: '2026-08-01' },
    ],
  });
  const memoire = await D.chargerMappingMemoire(client, 'vito-sainte-marie', 'ventes_catalogue');
  assert.strictEqual(memoire.length, 1);
  assert.strictEqual(memoire[0].colonne_source, 'Désignation produit', 'la plus récente doit gagner');
});

await testAsync('enregistrerLignesBrutes : découpe en lots de 500', async () => {
  const client = buildMockClient({});
  const rows = Array.from({ length: 1200 }, (_, i) => ({ x: i }));
  const ok = await D.enregistrerLignesBrutes(client, 'batch-1', rows);
  assert.strictEqual(ok, true);
  const inserts = client._calls.filter(c => c.table === 'import_rows_raw' && c.op === 'insert');
  assert.strictEqual(inserts.length, 3, '1200 lignes / 500 par lot = 3 lots');
  assert.strictEqual(inserts[0].payload.length, 500);
  assert.strictEqual(inserts[2].payload.length, 200);
});

await testAsync('publierBatch : refuse si la décision qualité est "bloque", même si appelé explicitement', async () => {
  const client = buildMockClient({
    import_quality_reports: [{ batch_id: 'batch-x', decision_recommandee: 'bloque' }],
  });
  const r = await D.publierBatch(client, 'batch-x', 'ventes_catalogue');
  assert.ok(r.erreur, 'doit refuser sans appeler le RPC');
  assert.ok(!client._calls.some(c => c.rpc));
});

await testAsync('publierBatch : choisit la bonne fonction RPC selon l\'intention', async () => {
  for (const [intention, fnAttendue] of [['ventes_catalogue', 'import_publier_ventes'], ['stock_theorique', 'import_publier_stock'], ['panier_moyen', 'import_publier_panier'], ['campagne', 'import_publier_ventes']]) {
    const client = buildMockClient({ import_quality_reports: [] });
    const r = await D.publierBatch(client, 'batch-y', intention);
    assert.strictEqual(r.lignesPubliees, 3);
    assert.ok(client._calls.some(c => c.rpc === fnAttendue), `attendu ${fnAttendue} pour ${intention}`);
  }
});

await testAsync('publierBatch : une erreur RPC marque le batch failed, jamais publié à moitié', async () => {
  const client = buildMockClient({ import_quality_reports: [] });
  client.rpc = async () => ({ data: null, error: { message: 'coupure réseau simulée' } });
  const r = await D.publierBatch(client, 'batch-z', 'ventes_catalogue');
  assert.ok(r.erreur);
  const updateFailed = client._calls.find(c => c.table === 'import_batches' && c.op === 'update' && c.payload.statut === 'failed');
  assert.ok(updateFailed, 'le batch doit être marqué failed');
});

console.log(`\n${pass} test(s) réussi(s), ${fail} échec(s).`);
if (fail > 0) process.exit(1);

})();
