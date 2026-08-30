// Tests Snapshot Decenium — Étape 4 "complétude temporelle" (30/08/2026).
// Convention reprise des Étapes 1/2/3 : chargement direct des fichiers
// réels (Article 5), mock Supabase minimal pour la couche données.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CANDIDATS_LIVE = [
  '/Users/fredericbragance/Library/Mobile Documents/com~apple~CloudDocs/Desktop/projet NEXUS OS/Code Nexus/nexus/image nexus project',
  '/sessions/dazzling-compassionate-ride/mnt/image nexus project',
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
// s'attachent directement au globalThis réel du process (même convention
// que le test de l'Étape 3).
new Function(fs.readFileSync(path.join(LIVE, 'nexus-inventaire-snapshot-moteur.js'), 'utf8'))();
const Moteur = globalThis.NexusInventaireSnapshotMoteur;

new Function(fs.readFileSync(path.join(LIVE, 'nexus-inventaire-snapshot-donnees.js'), 'utf8'))();
const Donnees = globalThis.NexusInventaireSnapshotDonnees;

const T0 = '2026-08-30T08:00:00Z';
const T1 = '2026-08-30T10:00:00Z';
// Le moteur restitue toujours ses horodatages via `Date.prototype.toISOString`
// (millisecondes explicites) — les assertions comparent donc contre ces
// formes normalisées, jamais contre la chaîne d'entrée brute.
const T0_ISO = new Date(T0).toISOString();
const T1_ISO = new Date(T1).toISOString();

// ============================================================
// Moteur pur — libelleDureeTrou
// ============================================================

test('libelleDureeTrou : null/NaN -> "Durée inconnue"', () => {
  assert.strictEqual(Moteur.libelleDureeTrou(null), 'Durée inconnue');
  assert.strictEqual(Moteur.libelleDureeTrou(NaN), 'Durée inconnue');
});

test('libelleDureeTrou : secondes seules', () => {
  assert.strictEqual(Moteur.libelleDureeTrou(45), '45 s');
});

test('libelleDureeTrou : minutes + secondes', () => {
  assert.strictEqual(Moteur.libelleDureeTrou(75), '1 min 15 s');
});

test('libelleDureeTrou : heures + minutes', () => {
  assert.strictEqual(Moteur.libelleDureeTrou(3600 + 12 * 60), '1 h 12 min');
});

test('libelleDureeTrou : jours + heures', () => {
  assert.strictEqual(Moteur.libelleDureeTrou(2 * 86400 + 3 * 3600), '2 j 3 h');
});

// ============================================================
// Moteur pur — fusionnerIntervallesCouverts
// ============================================================

test('fusionnerIntervallesCouverts : intervalles disjoints -> inchangés', () => {
  const r = Moteur.fusionnerIntervallesCouverts([{ debut: 0, fin: 10 }, { debut: 20, fin: 30 }]);
  assert.deepStrictEqual(r, [{ debut: 0, fin: 10 }, { debut: 20, fin: 30 }]);
});

test('fusionnerIntervallesCouverts : intervalles qui se chevauchent -> fusionnés', () => {
  const r = Moteur.fusionnerIntervallesCouverts([{ debut: 0, fin: 15 }, { debut: 10, fin: 25 }]);
  assert.deepStrictEqual(r, [{ debut: 0, fin: 25 }]);
});

test('fusionnerIntervallesCouverts : intervalles qui se touchent exactement -> fusionnés', () => {
  const r = Moteur.fusionnerIntervallesCouverts([{ debut: 0, fin: 10 }, { debut: 10, fin: 20 }]);
  assert.deepStrictEqual(r, [{ debut: 0, fin: 20 }]);
});

test('fusionnerIntervallesCouverts : ordre quelconque en entrée -> trié en sortie', () => {
  const r = Moteur.fusionnerIntervallesCouverts([{ debut: 20, fin: 30 }, { debut: 0, fin: 10 }]);
  assert.deepStrictEqual(r, [{ debut: 0, fin: 10 }, { debut: 20, fin: 30 }]);
});

test('fusionnerIntervallesCouverts : intervalle invalide (fin <= debut) ignoré', () => {
  const r = Moteur.fusionnerIntervallesCouverts([{ debut: 10, fin: 10 }, { debut: 0, fin: 5 }]);
  assert.deepStrictEqual(r, [{ debut: 0, fin: 5 }]);
});

test('fusionnerIntervallesCouverts : liste vide/absente -> vide', () => {
  assert.deepStrictEqual(Moteur.fusionnerIntervallesCouverts([]), []);
  assert.deepStrictEqual(Moteur.fusionnerIntervallesCouverts(null), []);
});

// ============================================================
// Moteur pur — detecterTrousTemporels
// ============================================================

test('detecterTrousTemporels : T0 >= T1 -> impossible', () => {
  const r = Moteur.detecterTrousTemporels([], T1, T0);
  assert.strictEqual(r.qualification, 'impossible');
  assert.strictEqual(r.motif, 'T0_posterieur_ou_egal_T1');
  assert.deepStrictEqual(r.trous, []);
});

test('detecterTrousTemporels : un seul quart couvrant exactement (T0,T1] -> complete, aucun trou', () => {
  const r = Moteur.detecterTrousTemporels([{ id: 'q1', ouvertLe: '2026-08-30T08:00:00.001Z', clotureLe: T1 }], T0, T1);
  assert.strictEqual(r.qualification, 'complete');
  assert.strictEqual(r.trous.length, 0);
  assert.strictEqual(r.dureeFenetreSecondes, 7200);
});

test('detecterTrousTemporels : aucun quart -> incomplete, un seul trou = toute la fenêtre', () => {
  const r = Moteur.detecterTrousTemporels([], T0, T1);
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.trous[0].debut, T0_ISO);
  assert.strictEqual(r.trous[0].fin, T1_ISO);
  assert.strictEqual(r.trous[0].dureeSecondes, 7200);
  assert.strictEqual(r.dureeCouverteSecondes, 0);
});

test('detecterTrousTemporels : trou au début (quart ne commence pas à T0)', () => {
  const r = Moteur.detecterTrousTemporels(
    [{ id: 'q1', ouvertLe: '2026-08-30T09:00:00Z', clotureLe: T1 }], T0, T1
  );
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.trous[0].debut, T0_ISO);
  assert.strictEqual(r.trous[0].fin, '2026-08-30T09:00:00.000Z');
  assert.strictEqual(r.trous[0].dureeSecondes, 3600);
});

test('detecterTrousTemporels : trou à la fin (quart ne va pas jusqu\'à T1)', () => {
  const r = Moteur.detecterTrousTemporels(
    [{ id: 'q1', ouvertLe: '2026-08-30T08:00:00.001Z', clotureLe: '2026-08-30T09:00:00Z' }], T0, T1
  );
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.trous[0].debut, '2026-08-30T09:00:00.000Z');
  assert.strictEqual(r.trous[0].fin, T1_ISO);
});

test('detecterTrousTemporels : trou au milieu entre deux quarts', () => {
  const r = Moteur.detecterTrousTemporels([
    { id: 'q1', ouvertLe: '2026-08-30T08:00:00.001Z', clotureLe: '2026-08-30T08:30:00Z' },
    { id: 'q2', ouvertLe: '2026-08-30T09:00:00Z', clotureLe: T1 },
  ], T0, T1);
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.trous[0].debut, '2026-08-30T08:30:00.000Z');
  assert.strictEqual(r.trous[0].fin, '2026-08-30T09:00:00.000Z');
  assert.strictEqual(r.trous[0].dureeSecondes, 1800);
  // Couverture = 30 min + 60 min = 90 min = 5400 s.
  assert.strictEqual(r.dureeCouverteSecondes, 5400);
});

test('detecterTrousTemporels : quart non clôturé exclu -> compte comme un trou (jamais une couverture supposée)', () => {
  const r = Moteur.detecterTrousTemporels([
    { id: 'q1', ouvertLe: '2026-08-30T08:00:00.001Z', clotureLe: null },
  ], T0, T1);
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.dureeCouverteSecondes, 0);
});

test('detecterTrousTemporels : quart chevauchant T0 exclu -> ne comble pas le trou de début', () => {
  const r = Moteur.detecterTrousTemporels([
    { id: 'q1', ouvertLe: '2026-08-30T07:30:00Z', clotureLe: '2026-08-30T09:00:00Z' },
  ], T0, T1);
  // Ce quart chevauche T0 (classerQuartDansFenetre -> chevauche_T0), donc
  // non utilisable : toute la fenêtre reste un trou.
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(r.trous[0].debut, T0_ISO);
  assert.strictEqual(r.trous[0].fin, T1_ISO);
});

test('detecterTrousTemporels : quarts qui se chevauchent entre eux et couvrent tout -> complete', () => {
  const r = Moteur.detecterTrousTemporels([
    { id: 'q1', ouvertLe: '2026-08-30T08:00:00.001Z', clotureLe: '2026-08-30T09:15:00Z' },
    { id: 'q2', ouvertLe: '2026-08-30T09:00:00Z', clotureLe: T1 },
  ], T0, T1);
  assert.strictEqual(r.qualification, 'complete');
  assert.strictEqual(r.trous.length, 0);
});

// ============================================================
// Couche données — mock Supabase minimal, style Étapes 1/2/3
// ============================================================

function creerClientMock({ quarts, snapshots } = {}) {
  const appels = { quarts: [] };
  function chainQuarts() {
    const q = {
      select() { return q; }, eq() { return q; }, lte() { return q; }, or() { return q; }, order() { return q; },
      then(resolve, reject) { return Promise.resolve({ data: quarts || [], error: null }).then(resolve, reject); },
    };
    appels.quarts.push(q);
    return q;
  }
  function chainSnapshots() {
    const q = {
      select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
      then(resolve, reject) { return Promise.resolve({ data: snapshots || [], error: null }).then(resolve, reject); },
    };
    return q;
  }
  return {
    from(table) {
      if (table === 'inventaire_quarts') return chainQuarts();
      if (table === 'inventaire_decenium_snapshots') return chainSnapshots();
      throw new Error('Table non mockée: ' + table);
    },
    _appels: appels,
  };
}

async function main() {

await testAsync('detecterTrousTemporelsSite : orchestration simple, un trou de milieu de fenêtre', async () => {
  const client = creerClientMock({
    quarts: [
      { id: 'q1', ouvert_le: '2026-08-30T08:00:00.001Z', cloture_le: '2026-08-30T08:30:00Z' },
      { id: 'q2', ouvert_le: '2026-08-30T09:00:00Z', cloture_le: T1 },
    ],
  });
  const r = await Donnees.detecterTrousTemporelsSite(client, 'vito-sainte-marie', T0, T1);
  assert.strictEqual(r.qualification, 'incomplete');
  assert.strictEqual(r.trous.length, 1);
  assert.strictEqual(client._appels.quarts.length, 1);
});

await testAsync('detecterTrousTemporelsSite : T0 >= T1 -> impossible, sans planter', async () => {
  const client = creerClientMock({ quarts: [] });
  const r = await Donnees.detecterTrousTemporelsSite(client, 'site', T1, T0);
  assert.strictEqual(r.qualification, 'impossible');
});

await testAsync('detecterTrousEntreSnapshots : moins de 2 Snapshots -> aucune paire, jamais une erreur', async () => {
  const client = creerClientMock({ snapshots: [{ id: 's1', snapshot_reference_at: T1 }] });
  const r = await Donnees.detecterTrousEntreSnapshots(client, 'site');
  assert.deepStrictEqual(r.paires, []);
});

await testAsync('detecterTrousEntreSnapshots : 3 Snapshots -> 2 paires, ordre chronologique correct', async () => {
  const T2 = '2026-08-30T12:00:00Z';
  const T3 = '2026-08-30T14:00:00Z';
  // chargerHistoriqueSnapshots renvoie DESC (le plus récent en premier).
  const client = creerClientMock({
    snapshots: [
      { id: 's3', snapshot_reference_at: T3 },
      { id: 's2', snapshot_reference_at: T2 },
      { id: 's1', snapshot_reference_at: T1 },
    ],
    quarts: [],
  });
  const r = await Donnees.detecterTrousEntreSnapshots(client, 'site');
  assert.strictEqual(r.paires.length, 2);
  assert.strictEqual(r.paires[0].snapshot_precedent_id, 's1');
  assert.strictEqual(r.paires[0].snapshot_suivant_id, 's2');
  assert.strictEqual(r.paires[0].instant_t0, T1);
  assert.strictEqual(r.paires[0].instant_t1, T2);
  assert.strictEqual(r.paires[1].snapshot_precedent_id, 's2');
  assert.strictEqual(r.paires[1].snapshot_suivant_id, 's3');
  // Aucun quart mocké -> chaque paire doit être 'incomplete' (trou total).
  assert.strictEqual(r.paires[0].qualification, 'incomplete');
  assert.strictEqual(r.paires[1].qualification, 'incomplete');
});

console.log(`\n${passed}/${total} tests passés.`);
if (passed !== total) process.exitCode = 1;

}

main();
