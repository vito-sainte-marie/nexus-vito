// Test — Point zéro carburants : motif obligatoire + statut actif/remplacé
// (28/08/2026, refonte qualitative §19).
//
// "Le point zéro doit avoir date/heure/utilisateur/source/volumes/motif/
// statut actif-remplacé/justification, les corrections ne doivent jamais
// supprimer les précédentes."
//
// Couverture :
//  1) motif obligatoire — certifierPointZero refuse sans motifCategorie.
//  2) Première certification d'un site (aucune référence existante) —
//     insérée directement en statut 'actif', reference_precedente_id null.
//  3) Nouvelle certification alors qu'une référence 'initialisation' est
//     déjà active — l'ancienne passe en 'remplace' par UPDATE (jamais
//     supprimée), la nouvelle est 'actif' et pointe vers l'ancienne via
//     reference_precedente_id (chaîne d'audit immuable).
//  4) Un 'recomptage' n'est jamais l'ancre — statut 'remplace' (lu comme
//     "non actif"), reference_precedente_id null, et ne déclenche AUCUN
//     update de l'ancienne référence (elle reste active).
//  5) chargerDernierPointZero ne filtre plus sur `statut` — vérifié en
//     inspectant la requête construite — pour ne jamais casser la
//     reconstruction historique point-dans-le-temps (chargerControleJour /
//     chargerHistoriqueReleves) après qu'une certification plus récente ait
//     fait passer une ancienne référence en 'remplace'.

const path = require('path');
const assert = require('assert');

const PROJET = __dirname;

async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-donnees.js'));
const Donnees = global.NexusCarburantDonnees;
assert.strictEqual(typeof Donnees.certifierPointZero, 'function', 'certifierPointZero doit être exportée');
assert.strictEqual(typeof Donnees.chargerDernierPointZero, 'function', 'chargerDernierPointZero doit être exportée');

// ------------------------------------------------------------
// Mock Supabase chaînable — même discipline que
// test_carburant_commande_donnees_v2238.js : réponses en file par table,
// trace tous les appels (dont les `eq` posés) pour vérifier la requête
// construite, pas seulement son résultat.
// ------------------------------------------------------------
function creerClientMock(reponses) {
  const appels = [];
  const compteurs = {};
  function prochaine(table) {
    const liste = reponses[table] || [];
    const i = compteurs[table] || 0;
    compteurs[table] = i + 1;
    return liste[i] || { data: null, error: null };
  }
  function b(table, type, payload) {
    const appel = { table, type, payload, eq: {} };
    appels.push(appel);
    const chain = {
      select() { return chain; },
      eq(k, v) { appel.eq[k] = v; return chain; },
      gte() { return chain; },
      lt() { return chain; },
      lte() { return chain; },
      in() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      async maybeSingle() { return prochaine(table); },
      async single() { return prochaine(table); },
      then(resolve, reject) { return Promise.resolve(prochaine(table)).then(resolve, reject); },
    };
    return chain;
  }
  return {
    appels,
    from(table) {
      return {
        select() { return b(table, 'select'); },
        insert(payload) { return b(table, 'insert', payload); },
        update(payload) { return b(table, 'update', payload); },
      };
    },
  };
}

const VALEURS = { go: { stockReel: 10000 }, sp95: { stockReel: 5000 }, gnr: { stockReel: 3000 } };

(async function main() {
  // ------------------------------------------------------------
  // 1) motif obligatoire.
  // ------------------------------------------------------------
  await testAsync('certifierPointZero refuse sans motifCategorie (aucun appel Supabase)', async () => {
    const client = creerClientMock({});
    const r = await Donnees.certifierPointZero(client, 'vito-sainte-marie', {
      date: '2026-08-28', source: 'terrain', controlePar: 'mgr1', type: 'initialisation',
      valeurs: VALEURS,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'motif_requis');
    assert.strictEqual(client.appels.length, 0, 'aucune requête Supabase ne doit partir sans motif');
  });

  // ------------------------------------------------------------
  // 2) Première certification — aucune référence existante.
  // ------------------------------------------------------------
  await testAsync('certifierPointZero — première certification du site : statut actif, reference_precedente_id null', async () => {
    const client = creerClientMock({
      // chargerDernierPointZero (appelé en interne) : aucune référence.
      carburant_stock_references: [{ data: null, error: null }, { data: { id: 'ref-nouvelle' }, error: null }],
      carburant_stock_reference_lignes: [{ data: null, error: null }],
    });
    const r = await Donnees.certifierPointZero(client, 'vito-sainte-marie', {
      date: '2026-08-28', heure: '07:00', source: 'terrain', controlePar: 'mgr1',
      type: 'initialisation', motifCategorie: 'controle_physique', note: 'Vérification trimestrielle',
      valeurs: VALEURS,
    });
    assert.strictEqual(r.ok, true);
    const insertRef = client.appels.find(a => a.table === 'carburant_stock_references' && a.type === 'insert');
    assert.strictEqual(insertRef.payload.statut, 'actif');
    assert.strictEqual(insertRef.payload.reference_precedente_id, null);
    assert.strictEqual(insertRef.payload.motif, 'controle_physique');
    assert.strictEqual(insertRef.payload.note, 'Vérification trimestrielle');
    // Aucun UPDATE : il n'y avait rien à remplacer.
    assert.ok(!client.appels.some(a => a.table === 'carburant_stock_references' && a.type === 'update'));
  });

  // ------------------------------------------------------------
  // 3) Nouvelle certification alors qu'une référence est déjà active —
  //    chaîne d'audit : ancienne -> 'remplace', nouvelle -> 'actif'.
  // ------------------------------------------------------------
  await testAsync('certifierPointZero — nouvelle certification : ancienne référence passée en remplace, nouvelle en actif avec reference_precedente_id', async () => {
    const client = creerClientMock({
      carburant_stock_references: [
        { data: { id: 'ref-ancienne', date: '2026-07-01', type: 'initialisation' }, error: null }, // chargerDernierPointZero
        { data: null, error: null }, // update ancienne -> remplace (pas de .select(), donc ignoré, mais on garde une réponse par sécurité)
        { data: { id: 'ref-nouvelle' }, error: null }, // insert nouvelle référence
      ],
      carburant_stock_reference_lignes: [{ data: null, error: null }, { data: null, error: null }],
    });
    const r = await Donnees.certifierPointZero(client, 'vito-sainte-marie', {
      date: '2026-08-28', source: 'insite360', controlePar: 'mgr2',
      type: 'initialisation', motifCategorie: 'ecart_constate', note: null,
      valeurs: VALEURS,
    });
    assert.strictEqual(r.ok, true);
    const updateAncienne = client.appels.find(a => a.table === 'carburant_stock_references' && a.type === 'update');
    assert.ok(updateAncienne, 'un UPDATE doit repasser l\'ancienne référence en remplace');
    assert.strictEqual(updateAncienne.payload.statut, 'remplace');
    assert.strictEqual(updateAncienne.eq.id, 'ref-ancienne', 'l\'UPDATE doit cibler précisément l\'ancienne référence, jamais un UPDATE de masse');
    const insertNouvelle = client.appels.find(a => a.table === 'carburant_stock_references' && a.type === 'insert');
    assert.strictEqual(insertNouvelle.payload.statut, 'actif');
    assert.strictEqual(insertNouvelle.payload.reference_precedente_id, 'ref-ancienne');
    assert.strictEqual(insertNouvelle.payload.motif, 'ecart_constate');
  });

  // ------------------------------------------------------------
  // 4) Un recomptage n'est jamais l'ancre — ne touche pas la référence
  //    active existante.
  // ------------------------------------------------------------
  await testAsync('certifierPointZero — un recomptage reste en remplace (non-actif), sans jamais toucher la référence active', async () => {
    const client = creerClientMock({
      carburant_stock_reference_lignes: [{ data: null, error: null }],
      carburant_stock_references: [{ data: { id: 'ref-recomptage' }, error: null }],
    });
    const r = await Donnees.certifierPointZero(client, 'vito-sainte-marie', {
      date: '2026-08-28', source: 'terrain', controlePar: 'mgr3',
      type: 'recomptage', motifCategorie: 'controle_physique', valeurs: VALEURS,
    });
    assert.strictEqual(r.ok, true);
    // Un recomptage ne consulte même pas chargerDernierPointZero (voir le
    // code : ancienneRef reste null sans requête) — donc AUCUN update, et
    // un seul insert (la ligne recomptage elle-même).
    assert.ok(!client.appels.some(a => a.type === 'update'), 'un recomptage ne doit jamais modifier la référence active en vigueur');
    const insertRecomptage = client.appels.find(a => a.table === 'carburant_stock_references' && a.type === 'insert');
    assert.strictEqual(insertRecomptage.payload.statut, 'remplace');
    assert.strictEqual(insertRecomptage.payload.reference_precedente_id, null);
    assert.strictEqual(insertRecomptage.payload.type, 'recomptage');
  });

  // ------------------------------------------------------------
  // 5) chargerDernierPointZero ne filtre JAMAIS par statut (protection
  //    contre une régression de la reconstruction historique).
  // ------------------------------------------------------------
  await testAsync('chargerDernierPointZero — la requête ne filtre pas par statut (seule type=initialisation + date font foi)', async () => {
    const client = creerClientMock({
      carburant_stock_references: [{ data: { id: 'ref-x', lignes: null }, error: null }],
      carburant_stock_reference_lignes: [{ data: [], error: null }],
    });
    await Donnees.chargerDernierPointZero(client, 'vito-sainte-marie', '2026-06-15');
    const selectAppel = client.appels.find(a => a.table === 'carburant_stock_references' && a.type === 'select');
    assert.strictEqual(selectAppel.eq.type, 'initialisation');
    assert.strictEqual('statut' in selectAppel.eq, false, 'aucun filtre statut ne doit exister ici — sinon une certification plus récente casserait silencieusement les calculs sur des dates passées');
  });

  console.log('\nTous les tests point zéro (motif + statut actif/remplacé, §19) sont passés.');
})();
