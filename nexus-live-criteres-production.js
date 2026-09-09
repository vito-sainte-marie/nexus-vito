// Critères "Prêt pour Production" — NEXUS Live (NEXUS-PRODUCTION-READINESS-1-20260908).
//
// Module pur, aucun accès réseau/Supabase/secret. Chaque critère est évalué
// à partir de faits explicitement fournis par l'appelant (CI, Handoff,
// Guardians, ou une mesure Production déjà obtenue ailleurs) — ce module ne
// mesure rien lui-même, il ne fait que composer le verdict fail-closed :
// un fait absent est INCONNU, jamais OK par défaut. Voir
// docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/procedure-release-production-1.md
// pour la procédure complète, et decision-2.md §7 du même lot pour les dix
// critères exacts dont ce module est le résumé exécutable.
//
// Distinction volontaire, tirée du texte même de decision-2.md : « Prêt pour
// Production signifie seulement que la release peut être soumise à
// Frédéric. Cela n'autorise jamais Production. » La gate humaine
// (`gateHumaineFrederic`) n'est donc PAS un onzième critère de
// `PRET_POUR_PRODUCTION` — elle est calculée séparément, et c'est elle seule
// qui produit `autorisationProduction: 'AUTORISEE'`. Fusionner les deux
// rendrait `PRET_POUR_PRODUCTION` impossible à atteindre avant que Frédéric
// n'ait déjà tranché, ce qui viderait le verdict de son sens (il ne pourrait
// plus jamais servir à lui soumettre quoi que ce soit).
(function (global) {
  'use strict';

  const STATUT = Object.freeze({ OK: 'OK', BLOQUE: 'BLOQUE', INCONNU: 'INCONNU' });
  const VERDICT = Object.freeze({
    PRET: 'PRET_POUR_PRODUCTION',
    NON_PRET: 'NON_PRET',
    INCONNU: 'INCONNU',
  });
  const AUTORISATION = Object.freeze({
    AUTORISEE: 'AUTORISEE',
    NON_AUTORISEE: 'NON_AUTORISEE',
  });

  const VINGT_QUATRE_HEURES_MS = 24 * 60 * 60 * 1000;
  const SHA_VALIDE = /^[0-9a-f]{7,40}$/i;

  function statutBooleen(valeur) {
    if (valeur === true) return STATUT.OK;
    if (valeur === false) return STATUT.BLOQUE;
    return STATUT.INCONNU;
  }

  function statutCandidateSha(sha) {
    if (typeof sha !== 'string' || !SHA_VALIDE.test(sha)) return STATUT.INCONNU;
    return STATUT.OK;
  }

  // Decision-2.md §7 point 2 exige CI ET Guardians conformes — un seul des
  // deux à faux bloque, un seul des deux non fourni (l'autre vrai) reste
  // INCONNU : un fait manquant ne doit jamais être compensé par l'autre.
  function statutCiEtGuardians(ciVerte, guardiansConformes) {
    if (ciVerte === false || guardiansConformes === false) return STATUT.BLOQUE;
    if (ciVerte !== true || guardiansConformes !== true) return STATUT.INCONNU;
    return STATUT.OK;
  }

  function statutMesuresFraiches(mesures, maintenantMs) {
    if (!mesures || typeof mesures.horodatage !== 'string') return STATUT.INCONNU;
    const t = Date.parse(mesures.horodatage);
    if (!Number.isFinite(t)) return STATUT.INCONNU;
    const age = maintenantMs - t;
    if (age < 0) return STATUT.INCONNU; // horodatage dans le futur : donnée non fiable, jamais OK par optimisme
    return age <= VINGT_QUATRE_HEURES_MS ? STATUT.OK : STATUT.BLOQUE;
  }

  function statutGateHumaine(gate, candidateSha) {
    if (!gate || typeof gate.release !== 'string' || !gate.release) return STATUT.INCONNU;
    if (!candidateSha || gate.release !== candidateSha) return STATUT.BLOQUE; // gate donnée pour une AUTRE release : ne couvre pas celle-ci
    if (gate.autorise !== true) return STATUT.BLOQUE;
    if (!gate.impact || typeof gate.impact !== 'string') return STATUT.INCONNU; // autorisation sans impact nommé : forme incomplète, pas une gate valide
    return STATUT.OK;
  }

  // faits : {
  //   candidateSha, maintenantMs,
  //   ciVerteSurCandidate, guardiansRequisConformes,
  //   railHandoffConforme, manifesteMigrationsAJour,
  //   mesuresProductionFraiches: { horodatage }, aucunImpactDmlInconnu,
  //   preprodAnonymiseOuEquivalent, repetitionMigrationsRecetteReussie,
  //   planReparationRollbackDocumente, fenetreDeploiementConfirmee,
  //   aucunBlocageNonResolu,
  //   gateHumaineFrederic: { release, autorise, impact }
  // }
  function evaluerCriteresProduction(faits) {
    const f = faits || {};
    const maintenantMs = Number.isFinite(f.maintenantMs) ? f.maintenantMs : Date.now();
    // Les dix critères de decision-2.md §7 — et eux seuls — déterminent
    // PRET_POUR_PRODUCTION. La gate humaine est calculée à part (voir plus bas).
    const criteres = {
      candidate_immuable_identifiee: statutCandidateSha(f.candidateSha),
      ci_et_guardians_conformes: statutCiEtGuardians(f.ciVerteSurCandidate, f.guardiansRequisConformes),
      rail_handoff_conforme: statutBooleen(f.railHandoffConforme),
      manifeste_migrations_a_jour: statutBooleen(f.manifesteMigrationsAJour),
      impacts_production_mesures_horodates: statutMesuresFraiches(f.mesuresProductionFraiches, maintenantMs),
      aucun_impact_dml_inconnu: statutBooleen(f.aucunImpactDmlInconnu),
      preprod_anonymise_ou_equivalent: statutBooleen(f.preprodAnonymiseOuEquivalent),
      repetition_migrations_recette_reussie: statutBooleen(f.repetitionMigrationsRecetteReussie),
      plan_reparation_rollback_documente: statutBooleen(f.planReparationRollbackDocumente),
      fenetre_deploiement_confirmee: statutBooleen(f.fenetreDeploiementConfirmee),
      aucun_blocage_non_resolu: statutBooleen(f.aucunBlocageNonResolu),
    };
    const valeurs = Object.values(criteres);
    let verdict;
    if (valeurs.some(v => v === STATUT.BLOQUE)) verdict = VERDICT.NON_PRET;
    else if (valeurs.every(v => v === STATUT.OK)) verdict = VERDICT.PRET;
    else verdict = VERDICT.INCONNU;

    const gateHumaineFrederic = statutGateHumaine(f.gateHumaineFrederic, f.candidateSha);
    // Autorisation Production : distincte par construction de PRET_POUR_PRODUCTION.
    // Exige les dix critères ET la gate humaine, jamais l'un sans l'autre —
    // et n'est jamais déduite d'un verdict PRET seul.
    const autorisationProduction = (verdict === VERDICT.PRET && gateHumaineFrederic === STATUT.OK)
      ? AUTORISATION.AUTORISEE
      : AUTORISATION.NON_AUTORISEE;

    return { verdict, criteres, gate_humaine_frederic: gateHumaineFrederic, autorisation_production: autorisationProduction };
  }

  const api = { STATUT, VERDICT, AUTORISATION, evaluerCriteresProduction };
  global.NexusLiveCriteresProduction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
