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

  // Les valeurs écrites dans `shifts.cloture_source`. Elles répondent à une
  // question que le motif ne répond pas : QUI a décidé de refermer. Le motif
  // dit ce qui a été constaté ; la source dit d'où vient la décision, et c'est
  // elle qui permettra de mesurer ce que le pilote mesure réellement —
  // combien de services l'équipe ferme elle-même, combien NEXUS ferme à sa
  // place, combien un manager a dû reprendre à la main.
  //
  // Elles sont ici, et pas dans le module d'écriture, pour la même raison que
  // les motifs : la contrainte `shifts_cloture_source_check` les connaît
  // toutes les deux, et un appelant qui en inventerait une troisième serait
  // refusé par la base au pire moment — pendant l'action du manager, après
  // qu'il a cliqué.
  const SOURCE_CLOTURE_PILOTE = {
    automatique: 'cycle_pilote', // NEXUS, au retour dans l'application
    manager:     'manager',      // un humain, que `cloture_par` nomme
  };

  /**
   * Ce service ouvert doit-il cesser d'être considéré comme actif ?
   *
   * Rend { obsolete, motif } — `motif` est une clé de MOTIF_CLOTURE_PILOTE,
   * jamais un texte libre, pour que l'appelant ne réécrive pas le libellé.
   *
   * DEUX CRITÈRES, ET PAS UN DE PLUS :
   *
   * 1. `jour_precedent` — le service a commencé un jour STATION ANTÉRIEUR à
   *    celui en cours. C'est le critère de `serviceDuJourSeulement`, appliqué
   *    ici à la clôture au lieu du rattachement — mais avec une différence
   *    que le nom du motif dit déjà : le rattachement écarte tout jour
   *    DIFFÉRENT, la clôture ne referme que le jour PASSÉ. Un service daté du
   *    futur n'est pas obsolète, il n'a pas commencé.
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
   * UN SERVICE DU FUTUR EST RENDU INTACT, par aucun des deux critères. La
   * clôture écrit en base sans geste humain : sur un service qui n'a pas
   * commencé, le silence est la seule réponse défendable.
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

    // ATTENTION : un jour DIFFERENT n'est pas un jour ANTERIEUR.
    //
    // Ce test s'ecrivait `!== ctx.jourStation`, et refermait donc aussi les
    // services dates du FUTUR, sous le motif `jour_precedent` — un motif
    // faux. Ce n'etait pas une anomalie d'affichage : la cloture ECRIT
    // (`statut`, `cloture_source`, `cloture_motif`, `cloture_par`) et elle
    // est declenchee sans geste humain, au retour dans l'application. Un
    // service pris d'avance — ou date du futur par une horloge d'appareil
    // deregle, ou par une saisie — etait detruit en silence.
    //
    // Les deux valeurs viennent de `Intl` en 'en-CA' : 'AAAA-MM-JJ', mois et
    // jour toujours sur deux chiffres. L'ordre lexicographique EST donc
    // l'ordre chronologique, sans conversion ni fuseau a re-appliquer.
    if (jourDuService < ctx.jourStation) return { obsolete: true, motif: 'jour_precedent' };

    // Jour POSTERIEUR : on ne conclut rien, et surtout pas via le critere 2.
    // Celui-ci compare `minutesStation` — l'heure du jour COURANT — au seuil
    // de bascule ; applique a un service qui n'a pas encore commence, il
    // aurait rendu « quart_termine » des que la station passe l'apres-midi.
    // Le non-choix est ici le seul choix juste : ce service sera obsolete le
    // moment venu, par ce meme critere, quand son jour sera passe.
    if (jourDuService !== ctx.jourStation) return vide;

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

  // ------------------------------------------------------------
  // LE RETARD — 19/09/2026 (mandat 33)
  //
  // Le retard a été calculé pendant des mois contre `shifts.heure_debut`,
  // qui vaut `created_at` quand le service est ouvert d'un clic : l'écran
  // annonçait des heures de retard à qui arrivait à l'heure. Le 18/09, le
  // calcul a donc été arrêté net et `retard_min` écrit à 0 — ce qui a
  // remplacé un faux retard par un faux « à l'heure », 33 lignes en
  // Production. Les deux erreurs ont la même racine : affirmer quelque
  // chose quand on ne sait pas.
  //
  // Le contrat arbitré le 19/09/2026 nomme les sources :
  //   Paramètres Station = horaires canoniques du site ;
  //   Planning           = affectation réelle (journée / quart / site) ;
  //   Pointage           = heure réellement constatée ;
  //   retard             = rapprochement des trois.
  // `shifts.heure_debut` est INTERDIT comme horaire théorique.
  //
  // Ce module ne lit rien : l'appelant apporte les minutes des deux côtés.
  // L'heure attendue vient de `calculer_horaires_quart(site, quart, date)`,
  // moteur unique — celui-là même dont le Planning tire ses horaires. Quand
  // il ne rend pas d'horaire, il ne rend PAS de ligne, et le retard vaut
  // null. Aucun repli, aucune heure fabriquée.
  // ------------------------------------------------------------

  // Les seuls pointages qui ont une heure attendue. Un départ, un début ou
  // une fin de pause n'en ont pas : les Paramètres Station ne déclarent ni
  // heure de fin due, ni horaire de pause opposable. Leur retard n'est pas
  // nul, il est SANS OBJET — donc null, jamais 0.
  const TYPES_AVEC_HEURE_ATTENDUE = ['arrivee'];

  /**
   * Le retard de ce pointage, en minutes — ou `null` s'il n'est PAS calculable.
   *
   *   0     : retard CALCULÉ, l'employé est à l'heure (ou en avance) ;
   *   > 0   : retard CALCULÉ ;
   *   null  : NON calculable — et `null` ne veut JAMAIS dire « à l'heure ».
   *
   * Le temps d'habillage n'est ni ajouté ni retranché ici : il est déjà
   * compris dans le début de quart des Paramètres Station, qui décalent
   * l'ouverture au public de `temps_habillage_min` APRÈS ce début
   * (05:45 + 15 = 06:00). L'y ajouter une seconde fois transformerait
   * l'habillage en tolérance de retard, ce que l'arbitrage refuse.
   *
   * @param {object} pointage
   * @param {string} pointage.type          'arrivee' | 'depart' | 'pause_debut' | 'pause_fin'
   * @param {object} ctx
   * @param {number|null} ctx.minutesAttendues  début de quart dû, minutes depuis minuit,
   *                                            tel que rendu par calculer_horaires_quart
   *                                            POUR LE SITE RÉELLEMENT TRAVAILLÉ ; null si
   *                                            l'horaire n'est pas déclaré (renfort sans
   *                                            horaire, quart 'non_defini', site inconnu).
   * @param {number|null} ctx.minutesPointage   heure constatée, minutes depuis minuit du
   *                                            même jour station.
   * @returns {number|null}
   */
  function retardDuPointage(pointage, ctx) {
    if (!pointage || TYPES_AVEC_HEURE_ATTENDUE.indexOf(pointage.type) === -1) return null;
    ctx = ctx || {};
    if (!Number.isFinite(ctx.minutesAttendues)) return null;
    if (!Number.isFinite(ctx.minutesPointage)) return null;
    const ecart = ctx.minutesPointage - ctx.minutesAttendues;
    // Arriver en avance n'est pas un retard négatif : c'est zéro retard, et
    // c'est un zéro MESURÉ, celui que la sémantique autorise à écrire.
    return ecart > 0 ? ecart : 0;
  }

  // Les statuts de planning qui ouvrent une journée TRAVAILLÉE, donc une heure
  // attendue. Liste POSITIVE, et volontairement : la contrainte de la base
  // (`planning_shifts_statut_check`) en déclare six, dont `repos` et `conge`
  // qui n'en ouvrent aucune — et la Production porte bien des lignes
  // `repos/quart1` ou `conge/quart2`, qui rendraient pourtant un horaire si
  // on les passait au moteur. Une liste positive fait qu'un statut inconnu
  // donne « non calculable » au lieu d'un faux retard : c'est le sens du
  // filet, il doit tomber du bon côté.
  const STATUTS_PLANNING_TRAVAILLES = ['travail_normal', 'manager', 'renfort', 'transfert_site'];

  /**
   * L'affectation de la journée, à partir des lignes de planning de cet
   * employé pour ce jour — ou `null` si elle n'est pas déterminable.
   *
   * Zéro ligne travaillée : NEXUS ne sait pas ce qui était dû. Plusieurs :
   * il ne sait pas laquelle oppose son horaire. Dans les deux cas le retard
   * est non calculable, pas nul. (La Production ne porte aujourd'hui aucune
   * journée à deux lignes travaillées : les 82 doublons mesurés le 19/09/2026
   * sont tous `repos`+`repos` ou `conge`+`conge`. Le cas ambigu est donc
   * théorique — raison de plus pour ne pas l'arbitrer en douce.)
   *
   * Le site rendu est celui RÉELLEMENT TRAVAILLÉ : `site_transfert` prime sur
   * `site_id`, comme l'exige le contrat pour un transfert de site.
   *
   * @param {Array<object>} lignes  lignes de `planning_shifts` du jour
   * @returns {{quart: string, site: string}|null}
   */
  function affectationDuJour(lignes) {
    if (!Array.isArray(lignes)) return null;
    const travaillees = lignes.filter(l =>
      l && STATUTS_PLANNING_TRAVAILLES.indexOf(l.statut) !== -1);
    if (travaillees.length !== 1) return null;
    const ligne = travaillees[0];
    const site = ligne.site_transfert || ligne.site_id;
    if (!site || !ligne.quart) return null;
    return { quart: ligne.quart, site: site };
  }

  const API = { ORDRE_TYPES, estDisponible, prochaineEtape, dejaFaitDuService, serviceDuJourSeulement, journeeTermineeSansService,
                 MOTIF_CLOTURE_PILOTE, SOURCE_CLOTURE_PILOTE, serviceObsolete, servicesObsoletes, finNonEnregistree, dureeServiceMs,
                 TYPES_AVEC_HEURE_ATTENDUE, retardDuPointage,
                 STATUTS_PLANNING_TRAVAILLES, affectationDuJour };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusPointageRegles = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
