#!/usr/bin/env node
'use strict';
/**
 * Évalue les dix critères PRET_POUR_PRODUCTION du lot
 * NEXUS-PRODUCTION-READINESS-1-20260908, et rend le verdict.
 *
 * POURQUOI CET OUTIL EXISTE. Jusqu'ici l'état de préparation vivait dans de la
 * prose : chaque critère avait sa preuve, mais le VERDICT n'était calculé nulle
 * part — il était raconté. Un verdict raconté ne peut pas être contredit par
 * les faits, seulement par un relecteur attentif.
 *
 * DEUX FAITS SONT MESURÉS ICI, PAS DÉCLARÉS :
 *   * le SHA candidat, lu sur `git rev-parse HEAD` ;
 *   * l'état de la CI sur ce SHA exact, lu par `gh`.
 * Le reste vient du fichier de faits, où chaque valeur porte sa preuve. Un
 * fait non fourni rend INCONNU — jamais OK par optimisme.
 *
 * LA CI EST LUE SUR TOUS LES ÉVÉNEMENTS. Un même SHA peut porter un run
 * `push` et un run `pull_request`. Si l'un des deux a échoué, la CI n'est pas
 * verte sur ce candidat, même si l'autre est au vert : c'est le sens du mot
 * « verte ».
 *
 *   node outils/evaluer-pret-pour-production.js [--sha <sha>] [--faits <fichier.json>]
 *
 * Sortie : 0 si PRET_POUR_PRODUCTION, 1 sinon. L'autorisation Production,
 * elle, n'est jamais rendue par ce script — elle exige la gate humaine.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.resolve(__dirname, '..');
const FAITS_PAR_DEFAUT = path.join(RACINE,
  'docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/faits-pret-pour-production.json');
const { STATUT, evaluerCriteresProduction } = require(path.join(RACINE, 'nexus-live-criteres-production.js'));

function argument(argv, nom) {
  const i = argv.indexOf(nom);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

function shaCourant() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }).trim();
  } catch (e) { return null; }
}

/**
 * Vrai si tous les runs terminés sur ce SHA sont au vert, faux si l'un a
 * échoué, null si aucun run n'existe ou si l'un est encore en cours — un run
 * en cours n'est pas une CI verte, c'est une CI inconnue.
 */
function ciSurLeSha(sha) {
  if (!sha) return { valeur: null, detail: 'aucun SHA' };
  let brut;
  try {
    brut = execFileSync('gh', ['run', 'list', '--commit', sha, '--limit', '20',
      '--json', 'databaseId,event,status,conclusion,workflowName'],
      { cwd: RACINE, encoding: 'utf8' });
  } catch (e) {
    return { valeur: null, detail: 'gh indisponible ou non authentifié' };
  }
  return verdictCi(JSON.parse(brut));
}

/**
 * Verdict CI à partir de la liste des runs d'un SHA. Fonction pure, pour
 * qu'elle soit éprouvable sans réseau.
 *
 * UN SEUL ÉCHEC SUFFIT. Le 10/09/2026, le SHA ea561f6 portait un run
 * `pull_request` vert ET un run `push` rouge. Ne regarder que le premier
 * aurait déclaré la CI verte sur un candidat dont une exécution échouait.
 */
function verdictCi(runs) {
  if (!Array.isArray(runs) || !runs.length) return { valeur: null, detail: 'aucun run sur ce SHA' };
  const enCours = runs.filter((r) => r.status !== 'completed');
  const echecs = runs.filter((r) => r.conclusion && r.conclusion !== 'success' && r.conclusion !== 'skipped');
  const detail = runs.map((r) => `${r.event}:${r.conclusion || r.status}`).join(' · ');
  if (echecs.length) {
    return { valeur: false, detail, echecs: echecs.map((r) => `${r.event} ${r.databaseId}`) };
  }
  if (enCours.length) return { valeur: null, detail: `${detail} (run non terminé)` };
  return { valeur: true, detail };
}

function principal(argv) {
  const fichierFaits = argument(argv, '--faits') || FAITS_PAR_DEFAUT;
  if (!fs.existsSync(fichierFaits)) {
    console.error(`  fichier de faits introuvable : ${fichierFaits}`);
    return 2;
  }
  const dossier = JSON.parse(fs.readFileSync(fichierFaits, 'utf8'));
  const declares = dossier.faits || {};

  const sha = argument(argv, '--sha') || shaCourant();
  const ci = ciSurLeSha(sha);

  const valeur = (nom) => (declares[nom] && Object.prototype.hasOwnProperty.call(declares[nom], 'valeur'))
    ? declares[nom].valeur : undefined;

  const faits = {
    candidateSha: sha,
    ciVerteSurCandidate: ci.valeur === null ? undefined : ci.valeur,
    guardiansRequisConformes: valeur('guardiansRequisConformes'),
    railHandoffConforme: valeur('railHandoffConforme'),
    manifesteMigrationsAJour: valeur('manifesteMigrationsAJour'),
    // Ce fait ne porte pas de `valeur` mais un `horodatage` : c'est lui que
    // le critère lit, et c'est lui qui périme au bout de 24 h.
    mesuresProductionFraiches: (declares.mesuresProductionFraiches
      && typeof declares.mesuresProductionFraiches.horodatage === 'string')
      ? { horodatage: declares.mesuresProductionFraiches.horodatage } : undefined,
    aucunImpactDmlInconnu: valeur('aucunImpactDmlInconnu'),
    preprodAnonymiseOuEquivalent: valeur('preprodAnonymiseOuEquivalent'),
    repetitionMigrationsRecetteReussie: valeur('repetitionMigrationsRecetteReussie'),
    planReparationRollbackDocumente: valeur('planReparationRollbackDocumente'),
    fenetreDeploiementConfirmee: valeur('fenetreDeploiementConfirmee'),
    aucunBlocageNonResolu: valeur('aucunBlocageNonResolu'),
    gateHumaineFrederic: valeur('gateHumaineFrederic'),
  };

  const r = evaluerCriteresProduction(faits);

  console.log(`  candidat : ${sha ? sha.slice(0, 7) : '(inconnu)'}`);
  console.log(`  CI       : ${ci.detail}`);
  console.log(`  faits    : ${path.relative(RACINE, fichierFaits)}`);
  console.log('');
  const marque = { [STATUT.OK]: '✓', [STATUT.BLOQUE]: '✗', [STATUT.INCONNU]: '?' };
  for (const [critere, statut] of Object.entries(r.criteres)) {
    const preuve = critere === 'candidate_immuable_identifiee' ? 'git rev-parse HEAD'
      : critere === 'ci_et_guardians_conformes' ? `gh run list --commit ${sha || "?"}`
      : (declares[correspondance(critere)] || {}).preuve || '—';
    console.log(`  ${marque[statut] || '?'} ${statut.padEnd(8)} ${critere}`);
    console.log(`             ${preuve}`);
  }
  console.log('');
  console.log(`  VERDICT               : ${r.verdict}`);
  console.log(`  gate humaine Frédéric : ${r.gate_humaine_frederic}`);
  console.log(`  autorisation          : ${r.autorisation_production}`);
  if (ci.echecs) console.log(`\n  run(s) en échec sur le candidat : ${ci.echecs.join(', ')}`);
  return r.verdict === 'PRET_POUR_PRODUCTION' ? 0 : 1;
}

/** Nom du fait qui alimente un critère — un seul endroit où la table vit. */
function correspondance(critere) {
  return {
    rail_handoff_conforme: 'railHandoffConforme',
    manifeste_migrations_a_jour: 'manifesteMigrationsAJour',
    impacts_production_mesures_horodates: 'mesuresProductionFraiches',
    aucun_impact_dml_inconnu: 'aucunImpactDmlInconnu',
    preprod_anonymise_ou_equivalent: 'preprodAnonymiseOuEquivalent',
    repetition_migrations_recette_reussie: 'repetitionMigrationsRecetteReussie',
    plan_reparation_rollback_documente: 'planReparationRollbackDocumente',
    fenetre_deploiement_confirmee: 'fenetreDeploiementConfirmee',
    aucun_blocage_non_resolu: 'aucunBlocageNonResolu',
  }[critere] || critere;
}

if (require.main === module) process.exit(principal(process.argv.slice(2)));
module.exports = { ciSurLeSha, verdictCi, correspondance };
