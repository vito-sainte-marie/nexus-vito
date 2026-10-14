#!/usr/bin/env node
'use strict';
// Câblage CI de l'enregistrement d'incident (item 1, lot
// NEXUS-INCIDENTS-CI-1-20261014, successeur de decision-4 du lot
// NEXUS-REPARATION-HANDOFF-1-20261014) — épreuves du job
// `enregistrement-incident` dans tests.yml.
//
// Ce que ce fichier prouve : lease (push sans force sur une tête lue au
// début du job), concurrence DÉDIÉE (groupe propre, sans annulation),
// absence de récursion/relance (aucun GH_TOKEN, aucun gh, aucun dispatch),
// aucune permission nouvelle (aucun `permissions:` de job), et que les
// quatre identifiants transportés viennent bien de l'étape `boucle_autonome`
// du job `non-regression`, pas d'une source devinée.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const YML = path.join(RACINE, '.github', 'workflows', 'tests.yml');
const brut = fs.readFileSync(YML, 'utf8');
const LIGNES = brut.split('\n');

let total = 0, passes = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log('  OK — ' + nom); } catch (e) { console.log('  ÉCHEC — ' + nom + '\n      ' + e.message); }
}

// Le bloc du job `enregistrement-incident`, jusqu'au prochain job de même
// indentation (2 espaces) ou la fin du fichier.
function blocJob(nom) {
  const i = LIGNES.findIndex(l => l === `  ${nom}:`);
  assert.ok(i >= 0, `job « ${nom} » absent de tests.yml`);
  let j = i + 1;
  while (j < LIGNES.length && !/^ {2}[a-zA-Z_-]+:/.test(LIGNES[j])) j++;
  return LIGNES.slice(i, j);
}

const JOB = blocJob('enregistrement-incident');
const JOB_TXT = JOB.join('\n');

t('le job dépend de non-regression et ne part que sur incident_a_enregistrer == 1', () => {
  assert.ok(JOB.some(l => l.trim() === 'needs: non-regression'));
  const si = JOB.find(l => /^\s*if:/.test(l));
  assert.ok(si && /always\(\)/.test(si) && /needs\.non-regression\.outputs\.incident_a_enregistrer == '1'/.test(si), si);
});

t('concurrence DÉDIÉE : groupe propre à ce job, jamais d\'annulation', () => {
  const idx = JOB.findIndex(l => l.trim() === 'concurrency:');
  assert.ok(idx >= 0, 'aucun bloc concurrency sur ce job');
  const bloc = JOB.slice(idx, idx + 3).join('\n');
  assert.match(bloc, /group:\s*nexus-incidents-enregistrement-\$\{\{\s*github\.ref\s*\}\}/);
  assert.match(bloc, /cancel-in-progress:\s*false/);
});

t('aucun `permissions:` propre à ce job : il hérite du bloc du workflow, inchangé', () => {
  assert.ok(!JOB.some(l => /^\s*permissions:/.test(l)), 'un permissions de job ajouterait une occurrence hors du bloc unique');
});

t('aucun GH_TOKEN, aucun `gh`, aucun repository_dispatch/workflow_dispatch : pas de relance possible', () => {
  assert.ok(!/GH_TOKEN|secrets\.|\bgh\s|repository_dispatch|workflow_dispatch/.test(JOB_TXT), JOB_TXT.match(/GH_TOKEN|secrets\.|\bgh\s|repository_dispatch|workflow_dispatch/)?.[0]);
});

t('le push est sans force (lease) et vise le rail transporté par non-regression, jamais main/production', () => {
  assert.match(JOB_TXT, /git push --quiet origin "HEAD:refs\/heads\/\$RAIL"/);
  assert.ok(!/push.*--force/.test(JOB_TXT), 'aucun push forcé');
  assert.match(JOB_TXT, /ref:\s*\$\{\{\s*needs\.non-regression\.outputs\.incident_rail\s*\}\}/);
});

t('un push refusé (rail avancé) FAILED et ne boucle pas dans le même run', () => {
  assert.match(JOB_TXT, /PUSH_REFUSE/);
  // Une seule invocation de enregistrer-incident.js dans toute l'étape : pas
  // de nouvelle tentative locale après un push refusé.
  const appels = JOB_TXT.match(/node outils\/enregistrer-incident\.js/g) || [];
  assert.strictEqual(appels.length, 1, `enregistrer-incident.js appelé ${appels.length} fois : une reprise locale serait une boucle`);
});

t('l\'étape ne commit que si le verdict est ENREGISTRE, jamais sur DEJA_ENREGISTRE/NON_ENREGISTRE', () => {
  assert.match(JOB_TXT, /if \[ "\$ETAT" != "ENREGISTRE" \]/);
});

t('les quatre identifiants viennent de needs.non-regression.outputs, jamais recalculés ici', () => {
  for (const champ of ['incident_code', 'incident_lot', 'incident_rail', 'incident_sha']) {
    assert.ok(JOB_TXT.includes(`needs.non-regression.outputs.${champ}`), champ);
  }
});

// ── Le job non-regression expose ces sorties depuis boucle_autonome ────────
const NR = blocJob('non-regression');
const NR_TXT = NR.join('\n');

t('non-regression publie les 5 sorties incident_* depuis steps.boucle_autonome.outputs', () => {
  const attendu = {
    incident_a_enregistrer: 'alerte_humaine', incident_code: 'motif',
    incident_lot: 'lot', incident_rail: 'rail', incident_sha: 'sha',
  };
  for (const [sortie, step_output] of Object.entries(attendu)) {
    assert.ok(new RegExp(`${sortie}:\\s*\\$\\{\\{\\s*steps\\.boucle_autonome\\.outputs\\.${step_output}\\s*\\}\\}`).test(NR_TXT),
      `${sortie} doit venir de steps.boucle_autonome.outputs.${step_output}`);
  }
});

function etapeDe(lignes, nom) {
  const i = lignes.findIndex(l => l === `      - name: ${nom}`);
  assert.ok(i >= 0, `étape « ${nom} » absente`);
  let j = i + 1;
  while (j < lignes.length && !/^ {6}- name:/.test(lignes[j]) && !/^ {2}[a-zA-Z_-]+:/.test(lignes[j])) j++;
  return lignes.slice(i, j);
}

t('l\'étape boucle_autonome publie lot/rail/sha dans sa branche "notifier" (alerte_humaine)', () => {
  const etape = etapeDe(NR, 'Boucle autonome — relancer Claude (repository_dispatch)');
  const i = etape.findIndex(l => l.includes('alerte_humaine=1'));
  assert.ok(i >= 0, 'branche notifier introuvable dans boucle_autonome');
  const voisinage = etape.slice(i, i + 12).join('\n');
  assert.match(voisinage, /echo "lot=\$LOT" >> "\$GITHUB_OUTPUT"/);
  assert.match(voisinage, /echo "rail=\$RAIL" >> "\$GITHUB_OUTPUT"/);
  assert.match(voisinage, /echo "sha=\$SHA_RAIL" >> "\$GITHUB_OUTPUT"/);
});

// ── Mutation : sans la correction de FAMILLES, un plafond de sécurité se
// serait enregistré comme un incident système. ─────────────────────────────
t('MUTATION — sans STOP_HUMAIN/VERDICT_REPETE/PLAFOND_* dans FAMILLES.DECISION_HUMAINE, l\'arrêt de sécurité serait enregistré', () => {
  const W = require('./outils/watchdog-stagnation.js');
  for (const code of ['STOP_HUMAIN', 'VERDICT_REPETE', 'PLAFOND_LOT_ATTEINT', 'PLAFOND_JOUR_ATTEINT']) {
    assert.ok(W.FAMILLES.DECISION_HUMAINE.includes(code), `${code} doit être dans DECISION_HUMAINE`);
  }
  const src = fs.readFileSync(path.join(RACINE, 'outils', 'watchdog-stagnation.js'), 'utf8');
  const ancre = "'STOP_HUMAIN', 'VERDICT_REPETE', 'PLAFOND_LOT_ATTEINT', 'PLAFOND_JOUR_ATTEINT'";
  assert.strictEqual(src.split(ancre).length, 2, 'ancre de mutation non unique');
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mut-watchdog-'));
  const mute = path.join(dir, 'watchdog-stagnation.js');
  fs.copyFileSync(path.join(RACINE, 'outils', 'etat-maillon.js'), path.join(dir, 'etat-maillon.js'));
  fs.writeFileSync(mute, src.replace(ancre, ''));
  try {
    const M = require(mute);
    const c = M.classerArret({ code: 'STOP_HUMAIN', lot: 'X', sha: 'a'.repeat(40), maintenant: '2026-10-14T10:00:00Z', derniereActivite: '2026-10-14T10:00:00Z' });
    assert.strictEqual(c.humain, false, 'sans la correction, STOP_HUMAIN redevient INCONNU donc non humain — c\'est la panne que ce lot corrige');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
