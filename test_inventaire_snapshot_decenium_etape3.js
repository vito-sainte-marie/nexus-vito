// Tests Snapshot Decenium — Étape 3 "reconstruction temporelle" (30/08/2026).
// Convention reprise des Étapes 1/2 : chargement direct des fichiers réels
// (Article 5 : jamais une copie du code dans le test), mock Supabase
// minimal pour la couche données.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Chemin du dossier live : selon l'environnement d'exécution (outil Read/
// Write côté macOS vs shell mcp__workspace__bash monté sous /sessions/...),
// le même dossier iCloud a deux chemins différents — on essaie les deux
// avant de retomber sur le voisin du test lui-même (Article 5 : jamais
// tester silencieusement une copie potentiellement obsolète en outputs).
const CANDIDATS_LIVE = [
  __dirname,
  __dirname,
];
const LIVE = CANDIDATS_LIVE.find(p => fs.existsSync(path.join(p, 'nexus-inventaire-snapshot-moteur.js'))) || __dirname;

let total = 0, passed = 0;
function test(nom, fn) {
  total++;
  try { fn(); passed++; console.log(`OK   - ${nom}`); }
  catch (e) { console.error(`FAIL - ${nom}\n       ${e.message}`); }
}
async function testAsync(nom, fn) {
  total++;
  try { await fn(); passed++; console.log(`OK   - ${nom}`); }
  catch (e) { console.error(`FAIL - ${nom}\n       ${e.message}`); }
}

// Les deux fichiers s'auto-exécutent en IIFE avec
// `typeof window !== 'undefined' ? window : globalThis` — sous Node, ils
// s'attachent donc directement au globalThis réel du process, jamais à un
// objet qu'on leur passerait en paramètre (convention déjà rencontrée aux
// Étapes 1/2 : on relit après coup sur globalThis plutôt que d'espérer une
// injection de dépendance qui n'existe pas dans ces fichiers).
new Function(fs.readFileSync(path.join(LIVE, 'nexus-inventaire-snapshot-moteur.js'), 'utf8'))();
const Moteur = globalThis.NexusInventaireSnapshotMoteur;

new Function(fs.readFileSync(path.join(LIVE, 'nexus-inventaire-snapshot-donnees.js'), 'utf8'))();
const Donnees = globalThis.NexusInventaireSnapshotDonnees;

// ============================================================
// Moteur pur — qualifierReconstructionT0T1
// ============================================================

test('qualifierReconstructionT0T1 : horodatage manquant', () => {
  assert.strictEqual(Moteur.qualifierReconstructionT0T1(null, '2026-08-30T10:00:00Z').possible, false);
  assert.strictEqual(Moteur.qualifierReconstructionT0T1(null, '2026-08-30T10:00:00Z').motif, 'horodatage_manquant');
  assert.strictEqual(Moteur.qualifierReconstructionT0T1('2026-08-30T10:00:00Z', null).possible, false);
});

test('qualifierReconstructionT0T1 : horodatage invalide', () => {
  const r = Moteur.qualifierReconstructionT0T1('pas-une-date', '2026-08-30T10:00:00Z');
  assert.strictEqual(r.possible, false);
  assert.strictEqual(r.motif, 'horodatage_invalide');
});

test('qualifierReconstructionT0T1 : T0 >= T1 refusé', () => {
  const egal = Moteur.qualifierReconstructionT0T1('2026-08-30T10:00:00Z', '2026-08-30T10:00:00Z');
  assert.strictEqual(egal.possible, false);
  assert.strictEqual(egal.motif, 'T0_posterieur_ou_egal_T1');
  const inverse = Moteur.qualifierReconstructionT0T1('2026-08-30T12:00:00Z', '2026-08-30T10:00:00Z');
  assert.strictEqual(inverse.possible, false);
});

test('qualifierReconstructionT0T1 : cas valide', () => {
  const r = Moteur.qualifierReconstructionT0T1('2026-08-30T08:00:00Z', '2026-08-30T10:00:00Z');
  assert.strictEqual(r.possible, true);
  assert.strictEqual(r.motif, null);
});

// ============================================================
// Moteur pur — classerQuartDansFenetre
// ============================================================

const T0 = '2026-08-30T08:00:00Z';
const T1 = '2026-08-30T10:00:00Z';

test('classerQuartDansFenetre : quart non clôturé exclu', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: '2026-08-30T08:30:00Z', clotureLe: null }, T0, T1);
  assert.strictEqual(r.utilisable, false);
  assert.strictEqual(r.motif, 'quart_non_cloture');
});

test('classerQuartDansFenetre : clôture postérieure à T1 exclue', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: '2026-08-30T08:30:00Z', clotureLe: '2026-08-30T11:00:00Z' }, T0, T1);
  assert.strictEqual(r.utilisable, false);
  assert.strictEqual(r.motif, 'hors_fenetre_apres_T1');
});

test('classerQuartDansFenetre : ouverture inconnue exclue', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: null, clotureLe: '2026-08-30T09:00:00Z' }, T0, T1);
  assert.strictEqual(r.utilisable, false);
  assert.strictEqual(r.motif, 'ouverture_inconnue');
});

test('classerQuartDansFenetre : chevauche T0 exclu (jamais un partage arbitraire)', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: '2026-08-30T07:30:00Z', clotureLe: '2026-08-30T09:00:00Z' }, T0, T1);
  assert.strictEqual(r.utilisable, false);
  assert.strictEqual(r.motif, 'chevauche_T0');
});

test('classerQuartDansFenetre : entièrement contenu -> utilisable', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: '2026-08-30T08:15:00Z', clotureLe: '2026-08-30T09:30:00Z' }, T0, T1);
  assert.strictEqual(r.utilisable, true);
  assert.strictEqual(r.motif, null);
});

test('classerQuartDansFenetre : ouverture strictement égale à T0 exclue (borne ouverte à gauche)', () => {
  const r = Moteur.classerQuartDansFenetre({ ouvertLe: T0, clotureLe: '2026-08-30T09:00:00Z' }, T0, T1);
  assert.strictEqual(r.utilisable, false);
  assert.strictEqual(r.motif, 'chevauche_T0');
});

// ============================================================
// Moteur pur — agrégations
// ============================================================

test('agregerVentesParProduit : somme par produit, ignore sans produit_id', () => {
  const r = Moteur.agregerVentesParProduit([
    { produit_id: 'p1', quantite_vendue: 3 },
    { produit_id: 'p1', quantite_vendue: 2 },
    { produit_id: 'p2', quantite_vendue: 5 },
    { produit_id: null, quantite_vendue: 99 },
  ]);
  assert.strictEqual(r.p1, 5);
  assert.strictEqual(r.p2, 5);
  assert.strictEqual(r.hasOwnProperty('undefined'), false);
});

test('agregerVentesParProduit : liste vide/absente -> objet vide', () => {
  assert.deepStrictEqual(Moteur.agregerVentesParProduit([]), {});
  assert.deepStrictEqual(Moteur.agregerVentesParProduit(null), {});
});

test('agregerMouvementsParProduit : somme signée (entrant positif, sortant négatif)', () => {
  const r = Moteur.agregerMouvementsParProduit([
    { produit_id: 'p1', quantite: 10 },
    { produit_id: 'p1', quantite: -4 },
    { produit_id: 'p2', quantite: -2 },
  ]);
  assert.strictEqual(r.p1, 6);
  assert.strictEqual(r.p2, -2);
});

test('agregerCorrectionsParProduit : delta = new_value - old_value', () => {
  const { parProduit, ignorees } = Moteur.agregerCorrectionsParProduit([
    { produit_id: 'p1', old_value: 10, new_value: 8 },
    { produit_id: 'p1', old_value: 8, new_value: 12 },
  ]);
  assert.strictEqual(parProduit.p1, (8 - 10) + (12 - 8));
  assert.strictEqual(ignorees.length, 0);
});

test('agregerCorrectionsParProduit : old_value/new_value manquant -> ignorée, jamais perdue silencieusement', () => {
  const c1 = { produit_id: 'p1', old_value: null, new_value: 5 };
  const c2 = { produit_id: 'p1', old_value: 5, new_value: null };
  const { parProduit, ignorees } = Moteur.agregerCorrectionsParProduit([c1, c2]);
  assert.strictEqual(parProduit.p1, undefined);
  assert.strictEqual(ignorees.length, 2);
  assert.strictEqual(ignorees[0], c1);
  assert.strictEqual(ignorees[1], c2);
});

test('agregerCorrectionsParProduit : produit_id manquant -> ignorée', () => {
  const c1 = { produit_id: null, old_value: 1, new_value: 2 };
  const { parProduit, ignorees } = Moteur.agregerCorrectionsParProduit([c1]);
  assert.deepStrictEqual(parProduit, {});
  assert.strictEqual(ignorees.length, 1);
});

// ============================================================
// Moteur pur — reconstituerStockTheorique
// ============================================================

test('reconstituerStockTheorique : produit absent du Snapshot -> impossible', () => {
  const r = Moteur.reconstituerStockTheorique({ produitId: 'p1', quantiteSnapshotT1: null, sommeVentesFenetre: 5, sommeMouvementsFenetre: 0, sommeCorrectionsFenetre: 0, quartsExclusCount: 0 });
  assert.strictEqual(r.qualite, 'impossible');
  assert.strictEqual(r.motif, 'produit_absent_du_snapshot');
  assert.strictEqual(r.stock_theorique, null);
});

test('reconstituerStockTheorique : formule exacte, aucune exclusion -> fiable', () => {
  const r = Moteur.reconstituerStockTheorique({
    produitId: 'p1', quantiteSnapshotT1: 20, sommeVentesFenetre: 8, sommeMouvementsFenetre: 3, sommeCorrectionsFenetre: -2, quartsExclusCount: 0,
  });
  assert.strictEqual(r.stock_theorique, 20 + 8 - 3 - (-2));
  assert.strictEqual(r.qualite, 'fiable');
  assert.strictEqual(r.motif, null);
});

test('reconstituerStockTheorique : au moins un quart exclu -> partielle (jamais présentée comme fiable)', () => {
  const r = Moteur.reconstituerStockTheorique({
    produitId: 'p1', quantiteSnapshotT1: 20, sommeVentesFenetre: 8, sommeMouvementsFenetre: 0, sommeCorrectionsFenetre: 0, quartsExclusCount: 2,
  });
  assert.strictEqual(r.qualite, 'partielle');
});

test('reconstituerStockTheorique : sommes absentes traitées comme 0, jamais NaN', () => {
  const r = Moteur.reconstituerStockTheorique({ produitId: 'p1', quantiteSnapshotT1: 10, quartsExclusCount: 0 });
  assert.strictEqual(r.stock_theorique, 10);
});

// ============================================================
// Couche données — mock Supabase minimal, style Étapes 1/2
// ============================================================

function creerClientMock({ quarts, ventes, mouvements, corrections, lignesSnapshot, erreurTable } = {}) {
  const appels = { quarts: [], ventes: [], mouvements: [], corrections: [], lignes: [] };
  function chain(table, resultat, journal) {
    const q = {
      _filtres: {},
      select(cols) { journal && journal.push({ op: 'select', cols }); return q; },
      eq(col, val) { journal && journal.push({ op: 'eq', col, val }); return q; },
      lte(col, val) { journal && journal.push({ op: 'lte', col, val }); return q; },
      gt(col, val) { journal && journal.push({ op: 'gt', col, val }); return q; },
      or(expr) { journal && journal.push({ op: 'or', expr }); return q; },
      in(col, vals) { journal && journal.push({ op: 'in', col, vals }); return q; },
      order(col, opts) { journal && journal.push({ op: 'order', col, opts }); return q; },
      then(resolve, reject) {
        const p = (erreurTable === table)
          ? Promise.resolve({ data: null, error: { message: 'erreur simulée' } })
          : Promise.resolve({ data: resultat, error: null });
        return p.then(resolve, reject);
      },
    };
    return q;
  }
  return {
    from(table) {
      if (table === 'inventaire_quarts') return chain(table, quarts || [], appels.quarts);
      if (table === 'inventaire_ventes_import') return chain(table, ventes || [], appels.ventes);
      if (table === 'inventaire_mouvements') return chain(table, mouvements || [], appels.mouvements);
      if (table === 'inventaire_corrections') return chain(table, corrections || [], appels.corrections);
      if (table === 'inventaire_decenium_snapshot_lignes') return chain(table, lignesSnapshot || [], appels.lignes);
      throw new Error('Table non mockée: ' + table);
    },
    _appels: appels,
  };
}

async function main() {

await testAsync('chargerQuartsFenetre : requête bien formée et données renvoyées', async () => {
  const client = creerClientMock({ quarts: [{ id: 'q1', ouvert_le: T0, cloture_le: T1 }] });
  const r = await Donnees.chargerQuartsFenetre(client, 'vito-sainte-marie', T0, T1);
  assert.strictEqual(r.length, 1);
  const ops = client._appels.quarts.map(a => a.op);
  assert.ok(ops.includes('eq'));
  assert.ok(ops.includes('lte'));
  assert.ok(ops.includes('or'));
});

await testAsync('chargerQuartsFenetre : erreur Supabase -> tableau vide, jamais une exception', async () => {
  const client = creerClientMock({ erreurTable: 'inventaire_quarts' });
  const r = await Donnees.chargerQuartsFenetre(client, 'site', T0, T1);
  assert.deepStrictEqual(r, []);
});

await testAsync('chargerVentesQuarts : liste d\'ids vide -> aucun appel réseau (Article 5, pas de requête inutile)', async () => {
  const client = creerClientMock({ ventes: [{ quart_id: 'q1', produit_id: 'p1', quantite_vendue: 5 }] });
  const r = await Donnees.chargerVentesQuarts(client, []);
  assert.deepStrictEqual(r, []);
  assert.strictEqual(client._appels.ventes.length, 0);
});

await testAsync('chargerVentesQuarts : filtre in(quart_id) quand des ids sont fournis', async () => {
  const client = creerClientMock({ ventes: [{ quart_id: 'q1', produit_id: 'p1', quantite_vendue: 5 }] });
  const r = await Donnees.chargerVentesQuarts(client, ['q1']);
  assert.strictEqual(r.length, 1);
  const inOp = client._appels.ventes.find(a => a.op === 'in');
  assert.ok(inOp);
  assert.deepStrictEqual(inOp.vals, ['q1']);
});

await testAsync('chargerMouvementsFenetre : fenêtre gt/lte correcte', async () => {
  const client = creerClientMock({ mouvements: [{ produit_id: 'p1', quantite: 3 }] });
  const r = await Donnees.chargerMouvementsFenetre(client, 'site', T0, T1);
  assert.strictEqual(r.length, 1);
  const gtOp = client._appels.mouvements.find(a => a.op === 'gt');
  const lteOp = client._appels.mouvements.find(a => a.op === 'lte');
  assert.strictEqual(gtOp.col, 'cree_le'); assert.strictEqual(gtOp.val, T0);
  assert.strictEqual(lteOp.col, 'cree_le'); assert.strictEqual(lteOp.val, T1);
});

await testAsync('chargerCorrectionsFenetre : utilise created_at, pas operational_date', async () => {
  const client = creerClientMock({ corrections: [{ produit_id: 'p1', old_value: 1, new_value: 2 }] });
  const r = await Donnees.chargerCorrectionsFenetre(client, 'site', T0, T1);
  assert.strictEqual(r.length, 1);
  const gtOp = client._appels.corrections.find(a => a.op === 'gt');
  assert.strictEqual(gtOp.col, 'created_at');
});

await testAsync('reconstituerStockTheoriqueSite : T0 >= T1 -> impossible, aucun chargement déclenché', async () => {
  const client = creerClientMock({});
  const snapshot = { id: 'snap1', snapshot_reference_at: T0 };
  const r = await Donnees.reconstituerStockTheoriqueSite(client, 'site', snapshot, T1); // T0 fourni = T1 (>=)
  assert.strictEqual(r.qualification.possible, false);
  assert.deepStrictEqual(r.resultats, []);
  assert.strictEqual(client._appels.quarts.length, 0);
});

await testAsync('reconstituerStockTheoriqueSite : cas nominal, un quart chevauchant exclu -> partielle', async () => {
  const client = creerClientMock({
    quarts: [
      { id: 'q_ok', ouvert_le: '2026-08-30T08:15:00Z', cloture_le: '2026-08-30T09:30:00Z' },
      { id: 'q_chevauche', ouvert_le: '2026-08-30T07:00:00Z', cloture_le: '2026-08-30T09:00:00Z' },
    ],
    ventes: [{ quart_id: 'q_ok', produit_id: 'p1', quantite_vendue: 6 }],
    mouvements: [{ produit_id: 'p1', quantite: 2 }],
    corrections: [{ produit_id: 'p1', old_value: 10, new_value: 9 }],
    lignesSnapshot: [{ produit_id: 'p1', quantite_stock: 20, designation_brute: 'Produit 1' }],
  });
  const snapshot = { id: 'snap1', snapshot_reference_at: T1 };
  const r = await Donnees.reconstituerStockTheoriqueSite(client, 'site', snapshot, T0);
  assert.strictEqual(r.qualification.possible, true);
  assert.strictEqual(r.quartsExclus.length, 1);
  assert.strictEqual(r.quartsExclus[0].quart_id, 'q_chevauche');
  assert.strictEqual(r.quartsExclus[0].motif, 'chevauche_T0');
  assert.strictEqual(r.resultats.length, 1);
  const res = r.resultats[0];
  // stock(T0) = 20 + ventes(6) - mouvements(2) - corrections(9-10=-1) = 20+6-2-(-1) = 25
  assert.strictEqual(res.stock_theorique, 25);
  assert.strictEqual(res.qualite, 'partielle');
  assert.strictEqual(r.correctionsIgnorees.length, 0);
  // Les ventes du quart chevauchant ne doivent JAMAIS avoir été chargées.
  const inOp = client._appels.ventes.find(a => a.op === 'in');
  assert.deepStrictEqual(inOp.vals, ['q_ok']);
});

await testAsync('reconstituerStockTheoriqueSite : aucun quart exclu -> fiable', async () => {
  const client = creerClientMock({
    quarts: [{ id: 'q_ok', ouvert_le: '2026-08-30T08:15:00Z', cloture_le: '2026-08-30T09:30:00Z' }],
    ventes: [{ quart_id: 'q_ok', produit_id: 'p1', quantite_vendue: 4 }],
    mouvements: [],
    corrections: [],
    lignesSnapshot: [{ produit_id: 'p1', quantite_stock: 10, designation_brute: 'Produit 1' }],
  });
  const snapshot = { id: 'snap1', snapshot_reference_at: T1 };
  const r = await Donnees.reconstituerStockTheoriqueSite(client, 'site', snapshot, T0);
  assert.strictEqual(r.resultats[0].qualite, 'fiable');
  assert.strictEqual(r.resultats[0].stock_theorique, 14);
});

await testAsync('reconstituerStockTheoriqueSite : ligne Snapshot sans produit_id résolu -> impossible, jamais un zéro fabriqué', async () => {
  const client = creerClientMock({
    quarts: [],
    ventes: [], mouvements: [], corrections: [],
    lignesSnapshot: [{ produit_id: null, quantite_stock: 7, designation_brute: 'Article non reconnu' }],
  });
  const snapshot = { id: 'snap1', snapshot_reference_at: T1 };
  const r = await Donnees.reconstituerStockTheoriqueSite(client, 'site', snapshot, T0);
  assert.strictEqual(r.resultats.length, 1);
  assert.strictEqual(r.resultats[0].qualite, 'impossible');
  assert.strictEqual(r.resultats[0].motif, 'produit_non_resolu');
  assert.strictEqual(r.resultats[0].stock_theorique, null);
});

await testAsync('reconstituerStockTheoriqueSite : corrections sans old/new_value -> reportées dans correctionsIgnorees', async () => {
  const client = creerClientMock({
    quarts: [],
    ventes: [], mouvements: [],
    corrections: [{ produit_id: 'p1', old_value: null, new_value: 5 }],
    lignesSnapshot: [{ produit_id: 'p1', quantite_stock: 10, designation_brute: 'Produit 1' }],
  });
  const snapshot = { id: 'snap1', snapshot_reference_at: T1 };
  const r = await Donnees.reconstituerStockTheoriqueSite(client, 'site', snapshot, T0);
  assert.strictEqual(r.correctionsIgnorees.length, 1);
  // La correction ignorée ne doit jamais être comptée dans le résultat (0, pas fabriquée).
  assert.strictEqual(r.resultats[0].stock_theorique, 10);
});

console.log(`\n${passed}/${total} tests passés.`);
if (passed !== total) process.exitCode = 1;

}

main();
