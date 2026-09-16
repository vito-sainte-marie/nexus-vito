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

  /**
   * Journée terminée SANS service ouvert, distincte de « rien commencé ».
   *
   * `serviceDuJour` peut être absent pour deux raisons opposées : la
   * journée n'a pas débuté (aucun pointage), ou un départ l'a déjà
   * refermée (S-2, clôture au pointage de départ). Confondre les deux
   * fait retomber un appelant sur le même état vide dans les deux cas, et
   * rouvrir « Pointer l'arrivée » sur une journée déjà finie — l'étape que
   * l'écran Pointage refuse déjà pour ce même cas (sa propre garde
   * interne, non dupliquée ici).
   *
   * Relevé sur l'accueil (NEXUS-App-v1.html) le 14/09/2026, parcours
   * Employé Test B après déconnexion/reconnexion : Supabase confirmait le
   * dernier service clos par `pointage_depart`, zéro service ouvert, et
   * l'accueil annonçait pourtant « Votre service est en cours » /
   * « Pointer l'arrivée ».
   *
   * `pointagesJour` porte les pointages de la journée entière, tous
   * services confondus (comme lu par l'appelant) : un seul suffit à
   * prouver que la journée a débuté.
   */
  function journeeTermineeSansService(serviceDuJour, pointagesJour) {
    return !serviceDuJour && !!(pointagesJour && pointagesJour.length);
  }

  // ============================================================
  // CYCLE DE VIE DES SERVICES PENDANT LA PHASE PILOTE (16/09/2026)
  //
  // Arbitrage de Frédéric Bragance : NEXUS est utilisé de façon intermittente.
  // Un employé ouvre son service, travaille, et ne pointe pas son départ. Le
  // service reste « en_cours » indéfiniment — trois l'étaient encore au
  // 16/09/2026, dont un ouvert le 14.
  //
  // DEUX MODÈLES ÉTAIENT POSSIBLES : exiger que tout le monde pointe (le
  // trigger `nexus_pointage_exige_service`, qui refuse un pointage sans
  // service), ou tolérer l'usage partiel. Le premier suppose une adoption qui
  // n'a pas eu lieu ; il reste suspendu. C'est le second qui est implémenté
  // ici.
  //
  // CE QUE CES RÈGLES NE FONT PAS : deviner une heure de fin. Un service dont
  // le départ n'a pas été pointé se ferme SANS heure de fin, et le dit. La
  // migration P-1 applique exactement la même règle côté base, et P-2 a effacé
  // les heures de fin que l'ancien code avait fabriquées (2 en Production,
  // jusqu'à 2 jours de « présence » écrits pour un écran rouvert).
  // ------------------------------------------------------------

  // Les motifs écrits dans `shifts.cloture_motif`. Ils sont ici et pas dans un
  // écran : la clôture peut venir de la prise de poste (base), du retour dans
  // l'application (client) ou du manager (action en masse), et les trois
  // doivent écrire la même chose — sinon le même fait porterait trois noms
  // selon l'endroit où il a été constaté.
  const MOTIF_CLOTURE_PILOTE = {
    jour_precedent: 'Fin non enregistrée — service d\'un jour précédent clos automatiquement (phase pilote)',
    quart_termine:  'Fin non enregistrée — quart planifié terminé, service clos automatiquement (phase pilote)',
    manager:        'Fin non enregistrée — régularisation par le manager (phase pilote)',
  };

  /**
   * Ce service ouvert doit-il cesser d'être considéré comme actif ?
   *
   * Rend { obsolete, motif } — `motif` est une clé de MOTIF_CLOTURE_PILOTE,
   * jamais un texte libre, pour que l'appelant ne réécrive pas le libellé.
   *
   * DEUX CRITÈRES, ET PAS UN DE PLUS :
   *
   * 1. `jour_precedent` — le service a commencé un autre jour STATION que
   *    celui en cours. C'est le critère de `serviceDuJourSeulement`, appliqué
   *    ici à la clôture au lieu du rattachement.
   *
   * 2. `quart_termine` — le service a commencé le jour même, sur le quart du
   *    matin, et l'heure locale de la station a dépassé le seuil de bascule
   *    vers le quart du soir. Ce seuil est LE MÊME que celui qui a servi à
   *    nommer le quart (NexusStation.seuilDeBascule) : la fin d'un quart 1
   *    est le début du quart 2, il n'existe pas d'autre borne configurée.
   *
   * POURQUOI LE QUART DU SOIR N'EST JAMAIS « TERMINÉ » LE JOUR MÊME :
   * `station_config.horaires` ne déclare aucune heure de fermeture — il ne
   * porte que la bascule quart1/quart2. Conclure qu'un quart du soir est fini
   * exigerait d'inventer cette heure. Il attendra donc le changement de jour
   * station, et relèvera de `jour_precedent`.
   *
   * INDÉTERMINATION : sans seuil exploitable, le critère 2 ne conclut rien
   * (et ne conclut surtout pas « terminé »). Le critère 1 reste évaluable.
   *
   * @param {object} service              la ligne shifts (heure_debut, quart, statut)
   * @param {object} ctx
   * @param {string} ctx.jourStation      jour station courant, ISO (yyyy-mm-dd)
   * @param {function} ctx.jourDeService  (Date) -> jour station ISO
   * @param {number} ctx.minutesStation   heure locale station, minutes depuis minuit
   * @param {number} ctx.seuilBascule     seuil quart1→quart2 du jour, en minutes
   */
  function serviceObsolete(service, ctx) {
    const vide = { obsolete: false, motif: null };
    if (!service || service.statut !== 'en_cours' || !service.heure_debut) return vide;
    if (!ctx || typeof ctx.jourDeService !== 'function' || !ctx.jourStation) return vide;

    const jourDuService = ctx.jourDeService(new Date(service.heure_debut));
    if (jourDuService !== ctx.jourStation) return { obsolete: true, motif: 'jour_precedent' };

    const estDuMatin = service.quart === 'matin' || service.quart === 'quart1';
    if (!estDuMatin) return vide;
    if (!Number.isFinite(ctx.minutesStation) || !Number.isFinite(ctx.seuilBascule)) return vide;
    if (ctx.minutesStation < ctx.seuilBascule) return vide;

    return { obsolete: true, motif: 'quart_termine' };
  }

  /**
   * Les services obsolètes d'une liste, chacun avec son motif — la forme dont
   * l'action de régularisation en masse du manager a besoin (un seul geste
   * pour plusieurs services, exigence du 16/09/2026).
   */
  function servicesObsoletes(services, ctx) {
    return (services || [])
      .map(s => { const v = serviceObsolete(s, ctx); return v.obsolete ? { service: s, motif: v.motif } : null; })
      .filter(Boolean);
  }

  /**
   * Ce service s'est-il refermé sans que sa fin soit enregistrée ?
   *
   * C'est le fait que NEXUS doit AFFICHER — « fin non enregistrée » — au lieu
   * d'une heure ou d'une durée. `heure_fin` nulle sur un service qui n'est
   * plus en cours n'est pas une donnée manquante par accident : c'est la
   * forme exacte que P-1 et P-2 donnent à « nous ne savons pas ».
   */
  function finNonEnregistree(service) {
    return !!service && service.statut !== 'en_cours' && !service.heure_fin;
  }

  /**
   * La durée d'un service, ou null.
   *
   * Null n'est pas une absence à combler : c'est l'interdiction de conclure.
   * « Aucune sanction ou conclusion de présence ne doit être produite à partir
   * d'un usage incomplet de NEXUS » (16/09/2026). Tout appelant qui veut une
   * durée passe par ici, et doit traiter le null — un `|| 0` reproduirait en
   * affichage le défaut que P-2 vient d'effacer en base.
   */
  function dureeServiceMs(service) {
    if (!service || !service.heure_debut || !service.heure_fin) return null;
    const debut = new Date(service.heure_debut).getTime();
    const fin   = new Date(service.heure_fin).getTime();
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) return null;
    return fin - debut;
  }

  const API = { ORDRE_TYPES, estDisponible, prochaineEtape, dejaFaitDuService, serviceDuJourSeulement, journeeTermineeSansService,
                 MOTIF_CLOTURE_PILOTE, serviceObsolete, servicesObsoletes, finNonEnregistree, dureeServiceMs };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusPointageRegles = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
