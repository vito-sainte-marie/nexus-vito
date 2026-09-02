// Test — Sprint 8 "Adoption" (18/08/2026, cahier Inventaire 2.0 §16, INV2-19
// "Les mesures de temps/taps sont enregistrées sans action supplémentaire").
// Charge le vrai fichier moteur (jamais réécrit à la main), comme tous les
// tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join(__dirname, 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');

let nbTests = 0, nbOk = 0;
function test(nom, fn) {
  nbTests++;
  try {
    fn();
    nbOk++;
    console.log(`  OK  ${nom}`);
  } catch (e) {
    console.log(`FAIL  ${nom}`);
    console.log(`      ${e.message}`);
  }
}

// ------------------------------------------------------------
// dureeSessionAutomatiqueMinutes
// ------------------------------------------------------------

test('Ouvert 09:00, clôturé 09:42 -> 42 minutes exactement', () => {
  const d = M.dureeSessionAutomatiqueMinutes('2026-08-18T09:00:00.000Z', '2026-08-18T09:42:00.000Z');
  assert.strictEqual(d, 42);
});

test('Durée fractionnaire arrondie à 1 décimale', () => {
  const d = M.dureeSessionAutomatiqueMinutes('2026-08-18T09:00:00.000Z', '2026-08-18T09:07:25.000Z');
  assert.strictEqual(d, 7.4); // 7min25s = 7.4166... arrondi à 7.4
});

test('ouvert_le manquant -> null, jamais une exception', () => {
  assert.strictEqual(M.dureeSessionAutomatiqueMinutes(null, '2026-08-18T09:42:00.000Z'), null);
});

test('cloture_le manquant (quart encore ouvert) -> null', () => {
  assert.strictEqual(M.dureeSessionAutomatiqueMinutes('2026-08-18T09:00:00.000Z', null), null);
});

test('cloture_le antérieur à ouvert_le (donnée corrompue) -> null, jamais une durée négative', () => {
  assert.strictEqual(M.dureeSessionAutomatiqueMinutes('2026-08-18T09:42:00.000Z', '2026-08-18T09:00:00.000Z'), null);
});

// ------------------------------------------------------------
// syntheseComparaisonAdoption
// ------------------------------------------------------------

test('Quart réel avec ouvert_le/cloture_le -> temps NEXUS automatique prioritaire sur nexus_temps_minutes manuel', () => {
  const s = M.syntheseComparaisonAdoption({
    ouvert_le: '2026-08-18T09:00:00.000Z', cloture_le: '2026-08-18T09:30:00.000Z',
    nexus_temps_minutes: 999, // ne doit jamais être utilisé si l'automatique existe
    papier_temps_minutes: 40, papier_produits_comptes: 50, papier_corrections: 2,
    nexus_taps_total: 48, nexus_interruptions_total: 1,
  });
  assert.strictEqual(s.nexusTempsMinutes, 30);
  assert.strictEqual(s.nexusTempsAutomatique, true);
  assert.strictEqual(s.gainMinutes, 10);
  assert.strictEqual(s.nexusTapsTotal, 48);
  assert.strictEqual(s.nexusInterruptionsTotal, 1);
});

test('Simulation sans clôture automatique -> repli sur le chronomètre manuel nexus_temps_minutes', () => {
  const s = M.syntheseComparaisonAdoption({
    ouvert_le: '2026-08-18T09:00:00.000Z', cloture_le: null,
    nexus_temps_minutes: 25, papier_temps_minutes: 35,
  });
  assert.strictEqual(s.nexusTempsMinutes, 25);
  assert.strictEqual(s.nexusTempsAutomatique, false);
  assert.strictEqual(s.gainMinutes, 10);
});

test('Aucune donnée papier -> gainMinutes null, jamais un gain inventé à partir d\'une seule mesure', () => {
  const s = M.syntheseComparaisonAdoption({ ouvert_le: '2026-08-18T09:00:00.000Z', cloture_le: '2026-08-18T09:30:00.000Z' });
  assert.strictEqual(s.papierTempsMinutes, null);
  assert.strictEqual(s.gainMinutes, null);
});

test('quart null -> null', () => {
  assert.strictEqual(M.syntheseComparaisonAdoption(null), null);
});

// ------------------------------------------------------------
// moyenneSyntheseAdoption
// ------------------------------------------------------------

test('Liste vide -> nb 0, toutes les moyennes null', () => {
  const m = M.moyenneSyntheseAdoption([]);
  assert.strictEqual(m.nb, 0);
  assert.strictEqual(m.tempsMoyenPapier, null);
  assert.strictEqual(m.gainMoyenMinutes, null);
});

test('undefined traité comme une liste vide, jamais une exception', () => {
  const m = M.moyenneSyntheseAdoption(undefined);
  assert.strictEqual(m.nb, 0);
});

test('Moyenne sur plusieurs quarts réels, comparatif partiel (une seule ligne avec papier renseigné)', () => {
  const quarts = [
    { ouvert_le: '2026-08-18T09:00:00.000Z', cloture_le: '2026-08-18T09:40:00.000Z', papier_temps_minutes: 50, papier_corrections: 3, nexus_taps_total: 60, nexus_interruptions_total: 0 },
    { ouvert_le: '2026-08-18T09:00:00.000Z', cloture_le: '2026-08-18T09:20:00.000Z', nexus_taps_total: 40, nexus_interruptions_total: 2 }, // pas de comparatif papier
  ];
  const m = M.moyenneSyntheseAdoption(quarts);
  assert.strictEqual(m.nb, 2);
  assert.strictEqual(m.nbAvecComparatif, 1);
  assert.strictEqual(m.tempsMoyenNexus, 30); // (40+20)/2
  assert.strictEqual(m.tempsMoyenPapier, 50); // une seule valeur
  assert.strictEqual(m.tapsMoyens, 50); // (60+40)/2
  assert.strictEqual(m.interruptionsMoyennes, 1); // (0+2)/2
  assert.strictEqual(m.gainMoyenMinutes, 20); // 50 - 30
});

console.log(`\n${nbOk}/${nbTests} tests réussis`);
if (nbOk !== nbTests) process.exit(1);
