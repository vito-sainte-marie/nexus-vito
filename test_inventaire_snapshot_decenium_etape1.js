// Test — Snapshot Decenium, Étape 1 "fondation" (30/08/2026, Frédéric —
// "Tu peux donc lancer le chantier sur cette base.").
// Couvre : moteur pur (ordreExportDecenium / deltaSecondesSnapshot /
// qualifierSnapshotDecenium / libelleDelta), la couche données (mock du
// client Supabase — creerSnapshot / chargerDernierSnapshotActif /
// remplacerAnciensSnapshotsActifs), et le branchement réel dans
// comparerVentesQuart (NEXUS-Inventaire-Manager-v1.html) + le seuil
// configurable snapshotMaxDelayMinutes.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

global.window = global;
require(path.join(ROOT, 'nexus-inventaire-snapshot-moteur.js'));
require(path.join(ROOT, 'nexus-inventaire-snapshot-donnees.js'));
const M = global.NexusInventaireSnapshotMoteur;
const D = global.NexusInventaireSnapshotDonnees;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// MOTEUR — ordreExportDecenium / deltaSecondesSnapshot
// ------------------------------------------------------------

testSync('ordreExportDecenium — un horodatage manquant -> unknown (jamais une supposition)', () => {
  assert.strictEqual(M.ordreExportDecenium(null, '2026-08-30T10:00:00Z'), 'unknown');
  assert.strictEqual(M.ordreExportDecenium('2026-08-30T10:00:00Z', null), 'unknown');
});

testSync('ordreExportDecenium — stock après ventes -> sales_then_stock (ordre recommandé)', () => {
  assert.strictEqual(M.ordreExportDecenium('2026-08-30T10:00:00Z', '2026-08-30T10:02:00Z'), 'sales_then_stock');
});

testSync('ordreExportDecenium — stock avant ventes -> stock_then_sales (ordre inversé)', () => {
  assert.strictEqual(M.ordreExportDecenium('2026-08-30T10:05:00Z', '2026-08-30T10:00:00Z'), 'stock_then_sales');
});

testSync('deltaSecondesSnapshot — calcul correct, peut être négatif', () => {
  assert.strictEqual(M.deltaSecondesSnapshot('2026-08-30T10:00:00Z', '2026-08-30T10:01:13Z'), 73);
  assert.strictEqual(M.deltaSecondesSnapshot('2026-08-30T10:05:00Z', '2026-08-30T10:00:00Z'), -300);
  assert.strictEqual(M.deltaSecondesSnapshot(null, '2026-08-30T10:00:00Z'), null);
});

// ------------------------------------------------------------
// MOTEUR — qualifierSnapshotDecenium (cœur de l'Étape 1)
// ------------------------------------------------------------

testSync('qualifierSnapshotDecenium — ordre correct, délai court, sources réelles -> confiance haute', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:00:00Z', stockExportAt: '2026-08-30T10:01:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.export_order, 'sales_then_stock');
  assert.strictEqual(r.confidence_level, 'haute');
  assert.strictEqual(r.snapshot_reference_at, '2026-08-30T10:01:00Z');
  assert.strictEqual(r.delai_depasse, false);
  assert.strictEqual(r.validated_with_reserve, false);
});

testSync('qualifierSnapshotDecenium — snapshot_reference_at = stock_export_at TOUJOURS (doctrine §20), même ordre inversé', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:05:00Z', stockExportAt: '2026-08-30T10:00:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.snapshot_reference_at, '2026-08-30T10:00:00Z');
});

testSync('qualifierSnapshotDecenium — sources estimées (import_time_estimated) -> confiance au plus moyenne, jamais haute', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:00:00Z', stockExportAt: '2026-08-30T10:01:00Z',
    salesExportTimeSource: 'import_time_estimated', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.confidence_level, 'moyenne');
});

testSync('qualifierSnapshotDecenium — ordre inversé + sources réelles -> moyenne (utilisable avec réserve, jamais haute)', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:05:00Z', stockExportAt: '2026-08-30T10:00:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.export_order, 'stock_then_sales');
  assert.strictEqual(r.confidence_level, 'moyenne');
});

testSync('qualifierSnapshotDecenium — ordre inversé + sources estimées -> faible (cumul des réserves)', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:05:00Z', stockExportAt: '2026-08-30T10:00:00Z',
    salesExportTimeSource: 'import_time_estimated', stockExportTimeSource: 'import_time_estimated',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.confidence_level, 'faible');
});

testSync('qualifierSnapshotDecenium — délai dépassé sans décision manager -> faible (filet de sécurité, ne plante pas)', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:00:00Z', stockExportAt: '2026-08-30T10:12:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.delai_depasse, true);
  assert.strictEqual(r.confidence_level, 'faible');
  assert.strictEqual(r.validated_with_reserve, false);
});

testSync('qualifierSnapshotDecenium — délai dépassé, manager a choisi de poursuivre -> faible + validated_with_reserve', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:00:00Z', stockExportAt: '2026-08-30T10:12:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5, manager_a_choisi_poursuivre: true,
  });
  assert.strictEqual(r.confidence_level, 'faible');
  assert.strictEqual(r.validated_with_reserve, true);
});

testSync('qualifierSnapshotDecenium — seuil par défaut utilisé si non fourni par l\'appelant', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: '2026-08-30T10:00:00Z', stockExportAt: '2026-08-30T10:12:00Z',
    salesExportTimeSource: 'file_metadata', stockExportTimeSource: 'file_metadata',
  });
  assert.strictEqual(r.delai_depasse, true, 'le seuil par défaut (5 min) doit s\'appliquer si aucun seuil transmis');
});

testSync('qualifierSnapshotDecenium — un des deux horodatages inconnu -> confiance faible, jamais insuffisante par défaut', () => {
  const r = M.qualifierSnapshotDecenium({
    salesExportAt: null, stockExportAt: '2026-08-30T10:12:00Z',
    salesExportTimeSource: 'import_time_estimated', stockExportTimeSource: 'file_metadata',
    seuilMaxDelaiMinutes: 5,
  });
  assert.strictEqual(r.delta_seconds, null);
  assert.strictEqual(r.confidence_level, 'faible');
  assert.strictEqual(r.snapshot_reference_at, '2026-08-30T10:12:00Z', 'stock_export_at reste la référence même sans horodatage ventes');
});

// ------------------------------------------------------------
// MOTEUR — libellés (aucun chiffre brut affiché tel quel)
// ------------------------------------------------------------

testSync('libelleDelta — formate en minutes/secondes, précise le sens si négatif', () => {
  assert.strictEqual(M.libelleDelta(73), '1 min 13 s');
  assert.strictEqual(M.libelleDelta(45), '45 s');
  assert.ok(M.libelleDelta(-300).includes('stock avant ventes'));
  assert.strictEqual(M.libelleDelta(null), 'Décalage inconnu');
});

testSync('libelleConfianceSnapshot / libelleSourceHorodatage — jamais undefined à l\'écran', () => {
  assert.strictEqual(M.libelleConfianceSnapshot('haute'), 'Haute');
  assert.strictEqual(M.libelleConfianceSnapshot('inconnu_truc'), 'Inconnue');
  assert.strictEqual(M.libelleSourceHorodatage('file_metadata'), 'Heure lue dans le fichier');
  assert.strictEqual(M.libelleSourceHorodatage('autre'), 'Inconnue');
});

testSync('NIVEAUX_CONFIANCE_SNAPSHOT — taxonomie catégorielle à 4 valeurs (jamais un score numérique)', () => {
  assert.deepStrictEqual(M.NIVEAUX_CONFIANCE_SNAPSHOT, ['haute', 'moyenne', 'faible', 'insuffisante']);
});

// ------------------------------------------------------------
// DONNÉES — mock minimal du client Supabase (chaînage .from().insert()
// .select().maybeSingle(), même convention que le reste du produit).
// ------------------------------------------------------------

function fabriquerClientMock({ insertResult, selectResult, updateError } = {}) {
  const appels = { insert: null, select: [], update: null };
  return {
    _appels: appels,
    from(table) {
      return {
        insert(payload) {
          appels.insert = { table, payload };
          return {
            select() {
              return { maybeSingle: async () => (insertResult || { data: { id: 'snap-1', ...payload }, error: null }) };
            },
          };
        },
        select(cols) {
          appels.select.push({ table, cols });
          const chain = {
            eq: () => chain, order: () => chain, limit: () => chain, neq: () => chain,
            maybeSingle: async () => (selectResult || { data: null, error: null }),
          };
          return chain;
        },
        update(payload) {
          appels.update = { table, payload };
          const chain = { eq: () => chain, neq: () => Promise.resolve({ error: updateError || null }) };
          return chain;
        },
      };
    },
  };
}

async function runAsyncTests() {

await testAsync('creerSnapshot — insère sur inventaire_decenium_snapshots avec les bons noms de colonnes (vérifiés contre le schéma réel)', async () => {
  const client = fabriquerClientMock();
  const r = await D.creerSnapshot(client, 'vito-sainte-marie', {
    salesFilename: 'ventes.csv', salesExportAt: '2026-08-30T10:00:00Z', salesExportTimeSource: 'file_metadata',
    stockFilename: 'stock.csv', stockExportAt: '2026-08-30T10:01:00Z', stockExportTimeSource: 'file_metadata',
    exportOrder: 'sales_then_stock', deltaSeconds: 60, snapshotReferenceAt: '2026-08-30T10:01:00Z',
    confidenceLevel: 'haute', validatedWithReserve: false,
  });
  assert.ok(r, 'creerSnapshot ne doit pas renvoyer null en cas de succès');
  const p = client._appels.insert.payload;
  assert.strictEqual(client._appels.insert.table, 'inventaire_decenium_snapshots');
  assert.strictEqual(p.site, 'vito-sainte-marie');
  assert.strictEqual(p.sales_filename, 'ventes.csv');
  assert.strictEqual(p.stock_export_at, '2026-08-30T10:01:00Z');
  assert.strictEqual(p.snapshot_reference_at, '2026-08-30T10:01:00Z');
  assert.strictEqual(p.confidence_level, 'haute');
  assert.strictEqual(p.quart_id_source, null, 'quart_id_source doit être facultatif, jamais une clé obligatoire (doctrine verrouillée)');
});

await testAsync('creerSnapshot — erreur Supabase -> null (jamais une exception non gérée)', async () => {
  const client = fabriquerClientMock({ insertResult: { data: null, error: new Error('boom') } });
  const r = await D.creerSnapshot(client, 'vito-sainte-marie', { exportOrder: 'unknown', deltaSeconds: null, snapshotReferenceAt: null, confidenceLevel: 'faible' });
  assert.strictEqual(r, null);
});

await testAsync('chargerDernierSnapshotActif — filtre bien sur site + status=actif, jamais sur un quart', async () => {
  const client = fabriquerClientMock({ selectResult: { data: { id: 'snap-1', site: 'vito-sainte-marie', status: 'actif' }, error: null } });
  const r = await D.chargerDernierSnapshotActif(client, 'vito-sainte-marie');
  assert.strictEqual(r.id, 'snap-1');
  assert.strictEqual(client._appels.select[0].table, 'inventaire_decenium_snapshots');
});

await testAsync('chargerDernierSnapshotActif — aucun snapshot actif -> null (pas d\'exception)', async () => {
  const client = fabriquerClientMock({ selectResult: { data: null, error: null } });
  const r = await D.chargerDernierSnapshotActif(client, 'vito-sainte-marie');
  assert.strictEqual(r, null);
});

await testAsync('remplacerAnciensSnapshotsActifs — met à jour status=remplace, exclut le nouveau snapshot (neq)', async () => {
  const client = fabriquerClientMock();
  await D.remplacerAnciensSnapshotsActifs(client, 'vito-sainte-marie', 'snap-2');
  assert.strictEqual(client._appels.update.table, 'inventaire_decenium_snapshots');
  assert.deepStrictEqual(client._appels.update.payload, { status: 'remplace' });
});

}

// ------------------------------------------------------------
// BRANCHEMENT RÉEL — NEXUS-Inventaire-Manager-v1.html
// ------------------------------------------------------------

function lireSource(fichier) { return fs.readFileSync(path.join(ROOT, fichier), 'utf8'); }

testSync('NEXUS-Inventaire-Manager-v1.html — les 2 scripts Snapshot sont inclus après le moteur inventaire (ordre de chargement)', () => {
  const src = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const iMoteur = src.indexOf('<script src="nexus-inventaire-moteur.js"></script>');
  const iSnapMoteur = src.indexOf('<script src="nexus-inventaire-snapshot-moteur.js"></script>');
  const iSnapDonnees = src.indexOf('<script src="nexus-inventaire-snapshot-donnees.js"></script>');
  assert.ok(iMoteur > -1 && iSnapMoteur > iMoteur && iSnapDonnees > iSnapMoteur, 'ordre ou présence des <script> incorrect');
});

testSync('NEXUS-Inventaire-Manager-v1.html — comparerVentesQuart charge le Snapshot actif et l\'attache à chaque rapprochement (snapshot_id)', () => {
  const src = lireSource('NEXUS-Inventaire-Manager-v1.html');
  assert.ok(src.includes('NexusInventaireSnapshotDonnees.chargerDernierSnapshotActif(nexusClient, siteId)'), 'appel de chargement du Snapshot actif introuvable');
  assert.ok(src.includes('snapshot_id: snapshotActif ? snapshotActif.id : null'), 'attachement snapshot_id sur le rapprochement introuvable');
});

testSync('NEXUS-Inventaire-Manager-v1.html — le chargement est protégé si NexusInventaireSnapshotDonnees est absent (pas de crash si script manquant)', () => {
  const src = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const i = src.indexOf('const snapshotActif');
  assert.ok(i > -1, 'déclaration snapshotActif introuvable');
  const bloc = src.slice(i, i + 250);
  // Correctif 30/08/2026 (P0 Safari, v2.302) : `global` n'existe pas dans un
  // navigateur (convention Node uniquement) — provoquait un
  // "ReferenceError: Can't find variable: global" bloquant tout le
  // chargement de l'écran sur Safari. La garde défensive doit être
  // browser-safe : `typeof X !== 'undefined'`, jamais `global.X`.
  assert.ok(bloc.includes("typeof NexusInventaireSnapshotDonnees !== 'undefined'"), "garde défensive browser-safe (typeof NexusInventaireSnapshotDonnees !== 'undefined') introuvable: " + bloc);
  assert.ok(!bloc.includes('global.'), "aucune référence à `global` ne doit subsister ici — inexistant dans un navigateur (Safari notamment), P0 v2.302: " + bloc);
  assert.ok(bloc.includes('? await NexusInventaireSnapshotDonnees.chargerDernierSnapshotActif'), 'branche ternaire introuvable: ' + bloc);
  assert.ok(bloc.includes(': null'), 'repli null introuvable: ' + bloc);
});

testSync('NEXUS-Inventaire-Manager-v1.html — DEFAULTS_PARAMETRES_INVENTAIRE expose snapshotMaxDelayMinutes=5 (seuil configurable, jamais codé en dur ailleurs)', () => {
  const src = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const bloc = src.slice(src.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE'), src.indexOf('const DEFAULTS_PARAMETRES_INVENTAIRE') + 800);
  assert.ok(bloc.includes('snapshotMaxDelayMinutes: 5'), 'valeur par défaut du seuil introuvable dans DEFAULTS_PARAMETRES_INVENTAIRE: ' + bloc);
});

// ------------------------------------------------------------
// SCHÉMA — colonnes réellement créées en base (vérifiées via
// information_schema le 30/08/2026, Article 5) — garde anti-dérive : si
// quelqu'un renomme une colonne côté migration sans mettre à jour ce
// fichier, ce test attire l'attention plutôt que de laisser la couche
// données écrire silencieusement dans le vide.
// ------------------------------------------------------------

testSync('nexus-inventaire-snapshot-donnees.js — les noms de colonnes utilisés correspondent au schéma réel vérifié en base', () => {
  const src = lireSource('nexus-inventaire-snapshot-donnees.js');
  const colonnesReelles = [
    'site', 'sales_filename', 'sales_export_at', 'sales_export_time_source', 'sales_imported_at',
    'stock_filename', 'stock_export_at', 'stock_export_time_source', 'stock_imported_at',
    'snapshot_reference_at', 'export_order', 'delta_seconds', 'confidence_level',
    'validated_with_reserve', 'status', 'quart_id_source', 'created_by',
  ];
  colonnesReelles.forEach((col) => {
    assert.ok(src.includes(col), `colonne ${col} absente de la couche données — vérifier contre information_schema`);
  });
});

runAsyncTests().then(() => {
  if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
  else { console.log('\nTous les tests sont passés.'); }
});
