// Garde déterministe de la boucle autonome Fast Track — préparation sans
// armement (GO de Frédéric, 10/10/2026, issue #28). Couvre explicitement les
// scénarios exigés par le GO : interrupteur absent/désarmé, STOP humain,
// échec CI, répétition, absence de nouvelle demande — plus les plafonds et
// une mutation négative sur l'ordre de priorité des gardes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const {
  INTERRUPTEUR_VAR, VALEUR_ARMEE, PLAFOND_TOURS_PAR_LOT, PLAFOND_TOURS_PAR_JOUR,
  CODES, evaluerTour, dejaTraite, verdictRepete, toursPourLot, toursAujourdhui,
  chargerJournal, enregistrerTour, estArme,
} = require('./outils/garde-boucle-autonome.js');

const LOT = 'LOT-BOUCLE-TEST-20261010';

function basique(overrides) {
  return Object.assign({
    env: { [INTERRUPTEUR_VAR]: VALEUR_ARMEE },
    lot: LOT,
    commitDecision: 'deadbeef1',
    verdictHash: 'APPROVED|ok',
    motifsStopPresents: [],
    ciConclusion: 'success',
    nouvelleDecisionDisponible: true,
    journal: { tours: [] },
    maintenant: '2026-10-10T12:00:00.000Z',
  }, overrides || {});
}

let total = 0, passes = 0;
function verifier(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  OK — ${nom}`); }
  catch (e) { console.error(`  ÉCHEC — ${nom}\n    ${e.stack}`); }
}

// --- 1. Interrupteur absent ---
verifier('interrupteur absent -> DESARME, autorise=false', () => {
  const r = evaluerTour(basique({ env: {} }));
  assert.strictEqual(r.autorise, false);
  assert.strictEqual(r.code, CODES.DESARME);
});

verifier('estArme(undefined) ne lève pas et vaut false', () => {
  assert.strictEqual(estArme(undefined), false);
  assert.strictEqual(estArme({}), false);
});

// --- 2. Interrupteur présent mais désarmé (mauvaise valeur) ---
verifier('interrupteur présent avec une valeur fausse ("true") -> DESARME', () => {
  const r = evaluerTour(basique({ env: { [INTERRUPTEUR_VAR]: 'true' } }));
  assert.strictEqual(r.code, CODES.DESARME);
});

verifier('interrupteur présent mais vide -> DESARME (défaut sûr)', () => {
  const r = evaluerTour(basique({ env: { [INTERRUPTEUR_VAR]: '' } }));
  assert.strictEqual(r.code, CODES.DESARME);
});

verifier('comportement par défaut du dépôt réel : NEXUS_BOUCLE_AUTONOME absent de process.env -> désarmé', () => {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(process.env, INTERRUPTEUR_VAR), false,
    'NEXUS_BOUCLE_AUTONOME ne doit être défini nulle part dans cet environnement tant que ce lot reste une préparation');
  assert.strictEqual(estArme(process.env), false);
});

// --- 3. STOP humain, priorité absolue ---
verifier('armé + motif STOP humain présent -> STOP_HUMAIN, prioritaire sur le reste', () => {
  const r = evaluerTour(basique({ motifsStopPresents: ['ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC'] }));
  assert.strictEqual(r.autorise, false);
  assert.strictEqual(r.code, CODES.STOP_HUMAIN);
  assert.ok(r.motif.includes('ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC'));
});

// Mutation négative : si STOP humain ET plafond jour sont vrais en même
// temps, le code retourné doit rester STOP_HUMAIN — un dispositif qui
// inverserait l'ordre masquerait un motif du palier Frédéric derrière un
// simple plafond de volume.
verifier('mutation négative : STOP humain reste prioritaire même si le plafond jour est aussi atteint', () => {
  const journalSature = { tours: Array.from({ length: PLAFOND_TOURS_PAR_JOUR }, (_, i) => ({
    lot: `AUTRE-LOT-${i}`, commit_decision: `c${i}`, horodate: '2026-10-10T08:00:00.000Z',
  })) };
  const r = evaluerTour(basique({ motifsStopPresents: ['SECRET_PERMISSION_SURFACE_SECURITE'], journal: journalSature }));
  assert.strictEqual(r.code, CODES.STOP_HUMAIN, `attendu STOP_HUMAIN, obtenu ${r.code}`);
});

// --- 4. Échec CI ---
verifier('armé, pas de STOP, CI rouge -> CI_ROUGE', () => {
  const r = evaluerTour(basique({ ciConclusion: 'failure' }));
  assert.strictEqual(r.code, CODES.CI_ROUGE);
});

verifier('CI conclusion absente (undefined) -> CI_ROUGE, jamais autorisé par défaut', () => {
  const r = evaluerTour(basique({ ciConclusion: undefined }));
  assert.strictEqual(r.code, CODES.CI_ROUGE);
});

// --- 5. Répétition (idempotence sur un commit déjà rejoué) ---
verifier('même commit_decision déjà présent au journal pour ce lot -> DECISION_DEJA_TRAITEE', () => {
  const journal = { tours: [{ lot: LOT, commit_decision: 'deadbeef1', horodate: '2026-10-10T09:00:00.000Z' }] };
  const r = evaluerTour(basique({ journal }));
  assert.strictEqual(r.code, CODES.DECISION_DEJA_TRAITEE);
});

verifier('dejaTraite() ignore les autres lots', () => {
  const journal = { tours: [{ lot: 'UN-AUTRE-LOT', commit_decision: 'deadbeef1', horodate: '2026-10-10T09:00:00.000Z' }] };
  assert.strictEqual(dejaTraite(journal, LOT, 'deadbeef1'), false);
});

// --- 6. Absence de nouvelle demande ---
verifier('aucune décision consommée actionnable -> AUCUNE_NOUVELLE_DEMANDE, avant même de regarder la CI', () => {
  const r = evaluerTour(basique({ nouvelleDecisionDisponible: false, ciConclusion: 'success' }));
  assert.strictEqual(r.code, CODES.AUCUNE_NOUVELLE_DEMANDE);
});

// --- 7. Verdict qui se répète entre décisions distinctes ---
verifier('le même verdict_hash revient 2 fois de suite (commits différents) -> VERDICT_REPETE', () => {
  const journal = { tours: [
    { lot: LOT, commit_decision: 'c1', verdict_hash: 'BLOCKED|attente', horodate: '2026-10-10T08:00:00.000Z' },
    { lot: LOT, commit_decision: 'c2', verdict_hash: 'BLOCKED|attente', horodate: '2026-10-10T09:00:00.000Z' },
  ] };
  const r = evaluerTour(basique({ commitDecision: 'c3', verdictHash: 'BLOCKED|attente', journal }));
  assert.strictEqual(r.code, CODES.VERDICT_REPETE);
});

verifier('verdictRepete() ne déclenche pas si un seul tour antérieur existe', () => {
  const journal = { tours: [{ lot: LOT, commit_decision: 'c1', verdict_hash: 'BLOCKED|attente', horodate: '2026-10-10T08:00:00.000Z' }] };
  assert.strictEqual(verdictRepete(journal, LOT, 'BLOCKED|attente', 2), false);
});

verifier('verdictRepete() ne déclenche pas si les verdicts diffèrent', () => {
  const journal = { tours: [
    { lot: LOT, commit_decision: 'c1', verdict_hash: 'BLOCKED|a', horodate: '2026-10-10T08:00:00.000Z' },
    { lot: LOT, commit_decision: 'c2', verdict_hash: 'APPROVED|b', horodate: '2026-10-10T09:00:00.000Z' },
  ] };
  assert.strictEqual(verdictRepete(journal, LOT, 'APPROVED|c', 2), false);
});

// --- 8. Plafond par lot ---
verifier(`${PLAFOND_TOURS_PAR_LOT} tours déjà consommés pour ce lot -> PLAFOND_LOT_ATTEINT`, () => {
  const journal = { tours: Array.from({ length: PLAFOND_TOURS_PAR_LOT }, (_, i) => ({
    lot: LOT, commit_decision: `anterieur-${i}`, horodate: '2026-10-10T08:00:00.000Z',
  })) };
  const r = evaluerTour(basique({ journal }));
  assert.strictEqual(r.code, CODES.PLAFOND_LOT_ATTEINT);
});

verifier('toursPourLot() ne compte que le lot demandé', () => {
  const journal = { tours: [{ lot: LOT, commit_decision: 'a' }, { lot: 'X', commit_decision: 'b' }] };
  assert.strictEqual(toursPourLot(journal, LOT), 1);
});

// --- 9. Plafond par jour, tous lots ---
verifier(`${PLAFOND_TOURS_PAR_JOUR} tours déjà consommés aujourd'hui (tous lots) -> PLAFOND_JOUR_ATTEINT`, () => {
  const journal = { tours: Array.from({ length: PLAFOND_TOURS_PAR_JOUR }, (_, i) => ({
    lot: `AUTRE-LOT-${i}`, commit_decision: `c${i}`, horodate: '2026-10-10T07:00:00.000Z',
  })) };
  const r = evaluerTour(basique({ journal }));
  assert.strictEqual(r.code, CODES.PLAFOND_JOUR_ATTEINT);
});

verifier("toursAujourdhui() ignore les tours d'un autre jour", () => {
  const journal = { tours: [{ lot: 'X', commit_decision: 'a', horodate: '2026-10-09T23:59:00.000Z' }] };
  assert.strictEqual(toursAujourdhui(journal, '2026-10-10T00:00:01.000Z'), 0);
});

// --- 10. Tout est clair ---
verifier('toutes les conditions réunies -> AUTORISE', () => {
  const r = evaluerTour(basique());
  assert.strictEqual(r.autorise, true);
  assert.strictEqual(r.code, CODES.AUTORISE);
});

// --- Journal : persistance réelle et idempotence bout en bout ---
verifier('enregistrerTour() écrit réellement, et un second tour sur le même commit redevient DECISION_DEJA_TRAITEE', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-boucle-journal-'));
  const fichier = path.join(dir, 'journal.json');
  assert.deepStrictEqual(chargerJournal(fichier), { version: 1, tours: [] });
  enregistrerTour(fichier, { lot: LOT, commit_decision: 'c1', verdict_hash: 'APPROVED|ok', horodate: '2026-10-10T10:00:00.000Z' });
  assert.ok(fs.existsSync(fichier), 'le fichier journal doit exister après enregistrerTour');
  const relu = chargerJournal(fichier);
  assert.strictEqual(relu.tours.length, 1);
  const r = evaluerTour(basique({ journal: relu, commitDecision: 'c1' }));
  assert.strictEqual(r.code, CODES.DECISION_DEJA_TRAITEE, 'une mutation réelle sur disque doit être relue, pas seulement supposée');
});

verifier('chargerJournal() refuse un fichier corrompu plutôt que de continuer en silence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-boucle-journal-corrompu-'));
  const fichier = path.join(dir, 'journal.json');
  fs.writeFileSync(fichier, JSON.stringify({ tours: 'pas-un-tableau' }));
  assert.throws(() => chargerJournal(fichier), /corrompu/);
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
