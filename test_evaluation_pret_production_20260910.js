#!/usr/bin/env node
// Le verdict de préparation doit être CALCULÉ, et la CI lue sur TOUS les runs.
//
// LE DÉFAUT, constaté le 10/09/2026. Le SHA candidat `ea561f6` portait deux
// exécutions de la même suite : `pull_request` au VERT, `push` au ROUGE. Une
// lecture qui s'arrête au premier run trouvé déclare « CI verte » sur un
// candidat dont une exécution échoue — et le verdict de préparation devient
// faux sans que rien ne le signale.
//
// L'autre moitié du défaut est plus ancienne : jusqu'à ce jour, le verdict
// vivait dans de la prose. Un verdict raconté ne peut pas être contredit par
// les faits.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const { verdictCi } = require(path.join(RACINE, 'outils/evaluer-pret-pour-production.js'));
const { evaluerCriteresProduction, STATUT } = require(path.join(RACINE, 'nexus-live-criteres-production.js'));
const FAITS = path.join(RACINE, 'docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/faits-pret-pour-production.json');

const run = (event, conclusion, status = 'completed') => ({ databaseId: 1, event, conclusion, status });

t('un run vert et un run rouge sur le même SHA : la CI n\'est PAS verte', () => {
  // Le cas réel du 10/09/2026. C'est le témoin qui compte.
  const r = verdictCi([run('pull_request', 'success'), run('push', 'failure')]);
  assert.strictEqual(r.valeur, false, `verdict ${r.valeur} au lieu de false — un échec a été ignoré`);
});

t('l\'ordre des runs ne change rien', () => {
  assert.strictEqual(verdictCi([run('push', 'failure'), run('pull_request', 'success')]).valeur, false);
});

t('tous verts : la CI est verte', () => {
  assert.strictEqual(verdictCi([run('push', 'success'), run('pull_request', 'success')]).valeur, true);
});

t('un run encore en cours rend INCONNU, jamais vert', () => {
  const r = verdictCi([run('push', null, 'in_progress'), run('pull_request', 'success')]);
  assert.strictEqual(r.valeur, null, 'un run non terminé a été pris pour un succès');
});

t('aucun run : INCONNU, pas vert par défaut', () => {
  assert.strictEqual(verdictCi([]).valeur, null);
  assert.strictEqual(verdictCi(null).valeur, null);
});

t('un run annulé compte comme un échec, pas comme un succès', () => {
  assert.strictEqual(verdictCi([run('push', 'cancelled')]).valeur, false);
});

t('un run skipped ne fait pas échouer', () => {
  assert.strictEqual(verdictCi([run('push', 'success'), run('pull_request', 'skipped')]).valeur, true);
});

// ── Le fichier de faits est lisible et honnête ─────────────────────────────

t('le fichier de faits existe et chaque fait porte une preuve', () => {
  const d = JSON.parse(fs.readFileSync(FAITS, 'utf8'));
  const noms = Object.keys(d.faits);
  assert.ok(noms.length >= 10, `${noms.length} faits déclarés, au moins 10 attendus`);
  for (const [nom, f] of Object.entries(d.faits)) {
    assert.ok(typeof f.preuve === 'string' && f.preuve.trim().length > 10,
      `le fait ${nom} n'a pas de preuve lisible`);
  }
});

t('la mesure Production porte un horodatage exploitable', () => {
  const d = JSON.parse(fs.readFileSync(FAITS, 'utf8'));
  const h = d.faits.mesuresProductionFraiches.horodatage;
  assert.ok(Number.isFinite(Date.parse(h)), `horodatage illisible : ${h}`);
  // Une mesure datée du futur n'est jamais OK — le critère le refuse déjà,
  // mais un fichier qui en porte une est une erreur de saisie, pas un cas.
  assert.ok(Date.parse(h) <= Date.now() + 60000, 'la mesure Production est datée du futur');
});

t('la gate humaine n\'est jamais déclarée par le fichier de faits', () => {
  // Elle appartient à Frédéric. Un fichier du dépôt qui la porterait à `true`
  // rendrait l'autorisation Production atteignable par un commit.
  const d = JSON.parse(fs.readFileSync(FAITS, 'utf8'));
  const g = d.faits.gateHumaineFrederic;
  assert.strictEqual(g.valeur, null,
    'le fichier de faits déclare une gate humaine : l\'autorisation deviendrait atteignable par un commit');
});

t('MUTATION : une gate posée dans le fichier n\'autorise toujours pas sans les dix critères', () => {
  // Preuve que l'autorisation exige les DEUX, et qu'un fichier seul ne suffit pas.
  const r = evaluerCriteresProduction({
    candidateSha: 'a'.repeat(40),
    ciVerteSurCandidate: false,          // un critère au rouge
    guardiansRequisConformes: true, railHandoffConforme: true, manifesteMigrationsAJour: true,
    mesuresProductionFraiches: { horodatage: new Date().toISOString() },
    aucunImpactDmlInconnu: true, preprodAnonymiseOuEquivalent: true,
    repetitionMigrationsRecetteReussie: true, planReparationRollbackDocumente: true,
    fenetreDeploiementConfirmee: true, aucunBlocageNonResolu: true,
    gateHumaineFrederic: { release: 'a'.repeat(40), autorise: true, impact: 'tout' },
  });
  assert.strictEqual(r.gate_humaine_frederic, STATUT.OK);
  assert.strictEqual(r.autorisation_production, 'NON_AUTORISEE',
    'une gate humaine a suffi à autoriser malgré un critère au rouge');
});

console.log(`\n${passes}/11 vérifications passées — le verdict est calculé, et un seul run rouge suffit à retirer le vert.`);
