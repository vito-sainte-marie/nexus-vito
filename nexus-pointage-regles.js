// ============================================================
// NEXUS POINTAGE — LA RÈGLE, À UN SEUL ENDROIT (13/09/2026)
//
// Pourquoi ce fichier existe. Le 13/09, la même erreur a été corrigée à sept
// endroits en une journée : « ce qui est déjà pointé » se compte par SERVICE,
// pas par journée, et « la prochaine étape » est la première étape réellement
// DISPONIBLE, pas la première manquante d'une séquence.
//
//   1. dejaFait de l'écran Pointage          5. rejeu de la file
//   2. prochainType de l'écran Pointage      6. relecture de la fin de pause
//   3. relecture anti-doublon                7. prochaine action de l'accueil
//   4. déduplication de la file
//
// Les six premiers vivaient dans NEXUS-Pointage-v1.html : les corriger l'un
// après l'autre suffisait à croire la règle appliquée. Le septième vivait dans
// NEXUS-App-v1.html, une autre page, qui recalculait la séquence pour son
// bouton « Prochaine action » — et annonçait donc « fin de pause » sur un
// employé dont la journée portait déjà un départ, celui d'un AUTRE service.
//
// ARCH-001 : une vérité métier a un seul propriétaire logique. Tant que la
// règle vivait à l'intérieur d'un écran, toute autre page qui en avait besoin
// n'avait d'autre choix que de la réécrire. C'est ce fichier, désormais.
//
// AUCUNE lecture, AUCUNE écriture, AUCUN DOM : des fonctions pures, pour que
// les épreuves puissent les jouer sans navigateur ni base.
// ------------------------------------------------------------

(function (global) {
  'use strict';

  // L'ordre réel d'une journée de travail. Il sert à présenter, jamais à
  // décider seul : la décision appartient à estDisponible().
  const ORDRE_TYPES = ['arrivee', 'pause_debut', 'pause_fin', 'depart'];

  /**
   * Ce pointage-ci peut-il être posé, compte tenu de ce qui est déjà fait
   * DANS CE SERVICE ?
   *
   * La pause reste une séquence — on ne termine pas une pause qu'on n'a pas
   * commencée — mais elle n'est pas un passage obligé vers le départ :
   * dès l'arrivée pointée, partir est possible (correctif du 11/09/2026,
   * après 48 journées Production arrêtées sur la seule arrivée).
   */
  function estDisponible(type, dejaFait) {
    dejaFait = dejaFait || {};
    if (dejaFait[type]) return false;              // jamais deux fois dans le même service
    switch (type) {
      case 'arrivee':     return true;
      case 'pause_debut': return !!dejaFait.arrivee && !dejaFait.depart;
      case 'pause_fin':   return !!dejaFait.pause_debut && !dejaFait.depart;
      case 'depart':      return !!dejaFait.arrivee;
      default:            return false;
    }
  }

  /**
   * La prochaine étape, ou null s'il n'en reste aucune.
   *
   * JAMAIS `ORDRE_TYPES.find(t => !dejaFait[t])`. Ce calcul-là annonce
   * « début de pause » à quelqu'un qui vient de pointer son départ, parce
   * qu'il confond « pas encore fait » et « possible maintenant ».
   */
  function prochaineEtape(dejaFait) {
    return ORDRE_TYPES.find(t => estDisponible(t, dejaFait)) || null;
  }

  /**
   * Ce qui est déjà fait DANS CE SERVICE, à partir de pointages qui peuvent
   * appartenir à plusieurs services de la même journée.
   *
   * L'égalité est stricte : un pointage historique sans service (`null`)
   * n'appartient à aucun service et ne compte pour aucun.
   */
  function dejaFaitDuService(pointages, serviceId) {
    const dejaFait = {};
    if (!serviceId) return dejaFait;
    (pointages || []).forEach(p => {
      if (p && p.service_id === serviceId) dejaFait[p.type] = p;
    });
    return dejaFait;
  }

  /**
   * Le service ouvert, mais SEULEMENT s'il a commencé le même jour station
   * que le pointage — sinon un quart laissé ouvert la veille reviendrait
   * comme service du jour, et l'arrivée du matin serait comparée à son heure
   * de début (retard de 1028 minutes ÉCRIT en base, constaté le 11/09/2026).
   *
   * `jourDeService` reçoit une date et rend son jour station au format
   * ISO : l'appelant en est propriétaire, ce fichier ne lit aucune horloge.
   */
  function serviceDuJourSeulement(service, jourDuPointage, jourDeService) {
    if (!service || !service.heure_debut) return null;
    return jourDeService(new Date(service.heure_debut)) === jourDuPointage ? service : null;
  }

  const API = { ORDRE_TYPES, estDisponible, prochaineEtape, dejaFaitDuService, serviceDuJourSeulement };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusPointageRegles = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
