// Critères "Prêt pour Production" — NEXUS Live (NEXUS-PRODUCTION-READINESS-1-20260908).
//
// Module pur, aucun accès réseau/Supabase/secret. Chaque critère est évalué
// à partir de faits explicitement fournis par l'appelant (CI, Handoff,
// Guardians, ou une mesure Production déjà obtenue ailleurs) — ce module ne
// mesure rien lui-même, il ne fait que composer le verdict fail-closed :
// un fait absent est INCONNU, jamais OK par défaut. Voir
// docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/procedure-release-production-1.md
// pour la procédure complète dont ces critères sont le résumé exécutable.
//
// La gate humaine de Frédéric (`gateHumaineFrederic`) n'est jamais déduite :
// elle doit nommer explicitement la release (SHA) qu'elle autorise, sinon
// elle est traitée comme absente. Ce module ne peut donc jamais faire
// franchir la gate Production à la place d'un humain.
(function (global) {
  'use strict';

  const STATUT = Object.freeze({ OK: 'OK', BLOQUE: 'BLOQUE', INCONNU: 'INCONNU' });
  const VERDICT = Object.freeze({
    PRET: 'PRET_POUR_PRODUCTION',
    NON_PRET: 'NON_PRET',
    INCONNU: 'INCONNU',
  });

  const VINGT_QUATRE_HEURES_MS = 24 * 60 * 60 * 1000;

  function statutBooleen(valeur) {
    if (valeur === true) return STATUT.OK;
    if (valeur === false) return STATUT.BLOQUE;
    return STATUT.INCONNU;
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
  //   ciVerteSurCandidate, railHandoffConforme, manifesteMigrationsAJour,
  //   mesuresProductionFraiches: { horodatage },
  //   fenetreDeploiementConfirmee, sauvegardesPrealables,
  //   gateHumaineFrederic: { release, autorise, impact }
  // }
  function evaluerCriteresProduction(faits) {
    const f = faits || {};
    const maintenantMs = Number.isFinite(f.maintenantMs) ? f.maintenantMs : Date.now();
    const criteres = {
      ci_verte_sur_candidate: statutBooleen(f.ciVerteSurCandidate),
      rail_handoff_conforme: statutBooleen(f.railHandoffConforme),
      manifeste_migrations_a_jour: statutBooleen(f.manifesteMigrationsAJour),
      mesures_production_fraiches: statutMesuresFraiches(f.mesuresProductionFraiches, maintenantMs),
      fenetre_deploiement_confirmee: statutBooleen(f.fenetreDeploiementConfirmee),
      sauvegardes_prealables: statutBooleen(f.sauvegardesPrealables),
      gate_humaine_frederic: statutGateHumaine(f.gateHumaineFrederic, f.candidateSha),
    };
    const valeurs = Object.values(criteres);
    let verdict;
    if (valeurs.some(v => v === STATUT.BLOQUE)) verdict = VERDICT.NON_PRET;
    else if (valeurs.every(v => v === STATUT.OK)) verdict = VERDICT.PRET;
    else verdict = VERDICT.INCONNU;
    return { verdict, criteres };
  }

  const api = { STATUT, VERDICT, evaluerCriteresProduction };
  global.NexusLiveCriteresProduction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
