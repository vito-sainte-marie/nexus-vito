// NEXUS — Moteur Commande Carburant (24/08/2026)
//
// Origine : cahier fonctionnel/technique complet transmis par Frédéric
// ("NEXUS — Moteur Commande Carburant"), 38 sections. Décisions de portée
// actées avec Frédéric avant tout code (AskUserQuestion) :
//   - Construction complète dès ce lot (§37 "Phase 3"), pas de phase
//     d'observation silencieuse préalable.
//   - §17-19 (optimisation tarifaire mensuelle) explicitement REPORTÉE à un
//     lot séparé — ce moteur ne compare jamais un prix futur à un prix
//     actuel, il n'en a même pas connaissance en entrée.
//   - GNR posé dès maintenant comme un 3ᵉ carburant à part entière du
//     moteur (même logique que SP95/GO), mais désactivé
//     (station_config.cuves_carburants.gnr.actif = false, migration
//     carburant_commande_schema_v1) — pompe indisponible. Le jour où elle
//     redevient active, aucune modification de CE fichier n'est nécessaire.
//
// Fichier PUR (Article 11 : un moteur ne touche jamais Supabase/le DOM) —
// toutes les fonctions reçoivent des données déjà chargées par l'appelant
// (nexus-carburant-commande-donnees.js) et ne font que calculer. Réutilise
// directement NexusCarburantMoteur (nexus-carburant-moteur.js, doit être
// chargé AVANT ce fichier) pour tout ce qui existe déjà : autonomie
// (calculerAutonomieJours/statutAutonomie), capacité/remplissage
// (pourcentageRemplissage/capaciteTotale), fuseau horaire
// (instantLocalVersUTC) — jamais une deuxième version de ces calculs ici.
//
// Principe cadre (§1/§38 du cahier) : NEXUS ne réagit pas à un stock
// devenu faible — il identifie À L'AVANCE le meilleur moment pour
// commander, en tenant compte du stock réel, des ventes attendues, des
// jours de livraison, de la réserve de sécurité, des capacités
// disponibles et des commandes déjà engagées. Le moteur recommande, le
// manager décide (§1, §31-33 côté écran — pas dans ce fichier).
//
// Article 5 rappelé explicitement pour ce lot : chaque seuil marqué
// "provisoire" ci-dessous est une estimation raisonnable documentée, pas
// une valeur validée par plusieurs semaines de recul réel (le moteur
// n'existait pas avant ce jour) — à recalibrer avec Frédéric une fois
// l'historique de décisions réelles disponible (§35, mesure de
// performance future).
// ------------------------------------------------------------

(function (global) {
  'use strict';

  // ============================================================
  // A. CALENDRIER — jours de livraison, cutoff, jours fériés (§4 du cahier)
  // ============================================================

  function ajouterJoursISO(dateISO, n) {
    const d = new Date(`${dateISO}T12:00:00Z`); // midi UTC : jamais de bascule de jour par arrondi de fuseau
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Liste des dates [debutISOInclus, finISOExclu) — jamais plus de 400
  // jours d'un coup (filet de sécurité, évite une boucle quasi infinie sur
  // une paire de dates inversée par erreur d'appelant).
  function joursEntre(debutISOInclus, finISOExclu) {
    const dates = [];
    let cursor = debutISOInclus;
    let garde = 0;
    while (cursor < finISOExclu && garde < 400) {
      dates.push(cursor);
      cursor = ajouterJoursISO(cursor, 1);
      garde++;
    }
    return dates;
  }

  // 1=lundi ... 7=dimanche (convention ISO déjà utilisée ailleurs dans
  // NEXUS, ex. inventaire_categories.jours_rotation).
  function jourSemaineIso(dateISO) {
    const dow = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  // `config` = station_config.carburant_commande_config ({ jours_livraison_iso,
  // cutoff_heure, ... }). `joursFeriesISO` = dates (YYYY-MM-DD) déjà lues
  // dans inventaire_calendrier_site (table générique de jours fériés/
  // vacances du site, réutilisée telle quelle — Article 11, jamais une
  // deuxième table de jours fériés créée pour ce lot).
  function estJourLivraisonPossible(dateISO, config, joursFeriesISO) {
    if (!config || !config.jours_livraison_iso) return false;
    if (!config.jours_livraison_iso.includes(jourSemaineIso(dateISO))) return false;
    if ((joursFeriesISO || []).includes(dateISO)) return false;
    return true;
  }

  // Premier jour de livraison possible STRICTEMENT après `dateDepartISO` —
  // jamais le jour même (le camion n'arrive jamais le jour de la commande,
  // §4 : "commande avant 11h -> livraison le PROCHAIN jour de livraison
  // disponible"). Borné à 21 jours de recherche : au-delà, la config est
  // probablement incohérente (aucun jour de livraison autorisé) — retourne
  // null plutôt qu'une boucle qui tournerait longtemps pour rien.
  function prochainJourLivraisonPossible(dateDepartISO, config, joursFeriesISO) {
    let cursor = dateDepartISO;
    for (let i = 0; i < 21; i++) {
      cursor = ajouterJoursISO(cursor, 1);
      if (estJourLivraisonPossible(cursor, config, joursFeriesISO)) return cursor;
    }
    return null;
  }

  // Fenêtre "fin de mois" (25/08/2026, retour de Frédéric : "Mode normal du
  // mois" vs "Mode fin de mois") — les JOURS_FIN_MOIS derniers jours
  // calendaires du mois, quelle que soit sa longueur (28/29/30/31 j).
  // Valeur provisoire (Frédéric a choisi cette option plutôt qu'un champ
  // configurable par site, 25/08/2026) — à recalibrer si un site a un cycle
  // fournisseur différent. Calculée en LOCAL, jamais en UTC (une date-only
  // ISO comme 'YYYY-MM-DD' n'a pas de fuseau propre — traitée comme un
  // calendrier civil, cohérent avec `ajouterJoursISO`/`jourSemaineIso`
  // ci-dessus, qui utilisent déjà midi UTC pour ne jamais basculer de jour).
  const JOURS_FIN_MOIS = 5;
  function nombreJoursDansLeMois(dateISO) {
    const [an, mo] = dateISO.split('-').map(Number);
    // Jour 0 du mois SUIVANT = dernier jour du mois courant (astuce classique,
    // fiable même pour février/années bissextiles — Date gère déjà ça).
    return new Date(Date.UTC(an, mo, 0)).getUTCDate();
  }
  function estFinDeMois(dateISO, joursFinMois) {
    if (!dateISO) return false;
    const jours = joursFinMois || JOURS_FIN_MOIS;
    const jourDuMois = Number(dateISO.split('-')[2]);
    const dernierJour = nombreJoursDansLeMois(dateISO);
    return jourDuMois > dernierJour - jours;
  }

  // Fenêtre de livraison si une commande est passée à `dateCommandeISO`
  // `heureCommandeHHMM` (§4, exemple vendredi §13) : avant le cutoff, la
  // recherche part du jour de commande lui-même ; après le cutoff, la
  // commande est traitée comme si elle avait été passée le lendemain (un
  // jour de délai supplémentaire), modélisation explicite en l'absence de
  // règle plus précise dans le cahier pour ce cas.
  function calculerFenetreLivraison({ dateCommandeISO, heureCommandeHHMM, config, joursFeriesISO }) {
    if (!config) return { avantCutoff: null, dateEffective: null, livraisonISO: null };
    const avantCutoff = (heureCommandeHHMM || '00:00') < (config.cutoff_heure || '11:00');
    const dateEffective = avantCutoff ? dateCommandeISO : ajouterJoursISO(dateCommandeISO, 1);
    const livraisonISO = prochainJourLivraisonPossible(dateEffective, config, joursFeriesISO);
    return { avantCutoff, dateEffective, livraisonISO };
  }

  // ============================================================
  // B. PRÉVISION PONDÉRÉE DE CONSOMMATION (§8 du cahier)
  // ============================================================

  // Sous ce nombre de points same-jour-de-semaine, la prévision reste
  // "à confirmer" plutôt que "fiable" (provisoire — §28/§29).
  const SEUIL_POINTS_JOUR_SEMAINE_FIABLE = 3;

  // `historiqueParJour` = [{ date: 'YYYY-MM-DD', ventes: { go, sp95, gnr } }],
  // déjà chargé et agrégé par l'appelant (une ligne par jour, litrage
  // sommé — même granularité que sommerVentesPeriode côté moteur
  // Carburants existant). Moyenne des N dernières occurrences du MÊME jour
  // de semaine que `dateCibleISO`, strictement antérieures à cette date,
  // pondérées linéairement décroissant (la plus récente pèse le plus) —
  // priorité 1 du cahier §8 ("il vaut mieux regarder les derniers samedis
  // comparables que la moyenne lundi->dimanche").
  function moyennePondereeMemeJourSemaine(historiqueParJour, carburant, dateCibleISO, maxOccurrences) {
    const max = maxOccurrences || 8;
    const jourCible = jourSemaineIso(dateCibleISO);
    const candidats = (historiqueParJour || [])
      .filter(j => j && j.date < dateCibleISO && j.ventes && j.ventes[carburant] != null && jourSemaineIso(j.date) === jourCible)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, max);
    if (!candidats.length) return { moyenne: null, nbPoints: 0 };
    let sommePonderee = 0, sommePoids = 0;
    candidats.forEach((j, i) => {
      const poids = candidats.length - i;
      sommePonderee += j.ventes[carburant] * poids;
      sommePoids += poids;
    });
    return { moyenne: sommePonderee / sommePoids, nbPoints: candidats.length };
  }

  // Moyenne simple des N derniers jours AVEC donnée (jamais diluée par des
  // jours sans litrage — même discipline que chargerConsommationJournaliereMoyenne
  // déjà existant dans nexus-carburant-donnees.js) — priorité 2 du cahier
  // §8 ("comportement récent").
  function moyenneRecente(historiqueParJour, carburant, dateCibleISO, joursFenetre) {
    const fenetre = joursFenetre || 7;
    const candidats = (historiqueParJour || [])
      .filter(j => j && j.date < dateCibleISO && j.ventes && j.ventes[carburant] != null)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, fenetre);
    if (!candidats.length) return { moyenne: null, nbPoints: 0 };
    const somme = candidats.reduce((s, j) => s + j.ventes[carburant], 0);
    return { moyenne: somme / candidats.length, nbPoints: candidats.length };
  }

  // Moyenne des jours fériés historiques connus (priorité 4 du cahier §8) —
  // `joursFeriesHistoriquesISO` : toutes les dates fériées passées connues
  // (pas seulement à venir). Retourne null si aucun jour férié passé n'a de
  // litrage capté — cas normal pour un site jeune (Article 5, jamais une
  // estimation inventée faute de mieux).
  function moyenneJoursFeries(historiqueParJour, carburant, joursFeriesHistoriquesISO) {
    const set = new Set(joursFeriesHistoriquesISO || []);
    const candidats = (historiqueParJour || []).filter(j => j && set.has(j.date) && j.ventes && j.ventes[carburant] != null);
    if (!candidats.length) return { moyenne: null, nbPoints: 0 };
    const somme = candidats.reduce((s, j) => s + j.ventes[carburant], 0);
    return { moyenne: somme / candidats.length, nbPoints: candidats.length };
  }

  // Prévision d'UN jour, combinant les priorités disponibles. Un jour férié
  // avec au moins un point d'historique férié utilise CETTE moyenne en
  // priorité (jamais mélangée au calcul jour-de-semaine normal — un férié
  // n'est structurellement pas comparable à un mardi ordinaire), confiance
  // plafonnée à 'a_confirmer' (peu de points en pratique). Sinon, combine
  // jour-de-semaine (poids dominant, priorité 1) et tendance récente
  // (priorité 2) ; si un seul des deux existe, il est utilisé seul ; si
  // aucun, la prévision est 'non_calculable' — jamais un chiffre à partir
  // de rien (Article 5).
  function prevoirConsommationJour({ historiqueParJour, carburant, dateCibleISO, estJourFerie, joursFeriesHistoriquesISO }) {
    if (estJourFerie) {
      const ferie = moyenneJoursFeries(historiqueParJour, carburant, joursFeriesHistoriquesISO);
      if (ferie.moyenne != null) {
        return { prevision: ferie.moyenne, methode: 'moyenne_jours_feries', confiance: 'a_confirmer', detail: { ferie } };
      }
      // Aucun historique férié -> repli sur le calcul normal ci-dessous,
      // mais jamais présenté comme 'fiable' (un jour férié reste
      // structurellement différent d'un jour ordinaire).
    }
    const memeJour = moyennePondereeMemeJourSemaine(historiqueParJour, carburant, dateCibleISO);
    const recent = moyenneRecente(historiqueParJour, carburant, dateCibleISO);
    if (memeJour.moyenne == null && recent.moyenne == null) {
      return { prevision: null, methode: 'aucune_donnee', confiance: 'non_calculable' };
    }
    if (memeJour.moyenne == null) {
      return { prevision: recent.moyenne, methode: 'moyenne_recente_seule', confiance: estJourFerie ? 'a_confirmer' : 'a_confirmer' };
    }
    if (recent.moyenne == null) {
      const confiance = memeJour.nbPoints >= SEUIL_POINTS_JOUR_SEMAINE_FIABLE && !estJourFerie ? 'fiable' : 'a_confirmer';
      return { prevision: memeJour.moyenne, methode: 'meme_jour_semaine_seul', confiance };
    }
    // Blend : le jour comparable domine (65%, priorité 1 du cahier), la
    // tendance récente vient corriger (35%, priorité 2) — pondération
    // provisoire, à recalibrer avec Frédéric une fois plusieurs semaines de
    // prévisions comparées aux ventes réelles disponibles (§35).
    const prevision = memeJour.moyenne * 0.65 + recent.moyenne * 0.35;
    const confiance = memeJour.nbPoints >= SEUIL_POINTS_JOUR_SEMAINE_FIABLE && !estJourFerie ? 'fiable' : 'a_confirmer';
    return { prevision, methode: 'combinee', confiance, detail: { memeJour, recent } };
  }

  // Somme des prévisions jour par jour sur une fenêtre de dates (typiquement
  // "aujourd'hui jusqu'à la livraison exclue", §9). Strictement honnête :
  // si UN SEUL jour de la fenêtre est non calculable, la fenêtre entière
  // l'est aussi (jamais une somme partielle présentée comme complète,
  // même discipline que resoudreVentesFenetre côté moteur Carburants
  // existant). La confiance retenue est la PIRE des jours de la fenêtre.
  function prevoirConsommationFenetre({ historiqueParJour, carburant, datesCiblesISO, joursFeriesISO, joursFeriesHistoriquesISO }) {
    const dates = datesCiblesISO || [];
    if (!dates.length) return { total: 0, confiance: 'fiable' };
    const ordreConfiance = { fiable: 0, a_confirmer: 1, non_calculable: 2 };
    let total = 0, confiance = 'fiable';
    for (let i = 0; i < dates.length; i++) {
      const dateISO = dates[i];
      const estFerie = (joursFeriesISO || []).includes(dateISO);
      const p = prevoirConsommationJour({
        historiqueParJour, carburant, dateCibleISO: dateISO,
        estJourFerie: estFerie, joursFeriesHistoriquesISO: joursFeriesHistoriquesISO || joursFeriesISO,
      });
      if (p.prevision == null) return { total: null, confiance: 'non_calculable' };
      total += p.prevision;
      if (ordreConfiance[p.confiance] > ordreConfiance[confiance]) confiance = p.confiance;
    }
    return { total, confiance };
  }

  // ============================================================
  // C. STOCK PRÉVISIONNEL À LA LIVRAISON (§9-10 du cahier)
  // ============================================================

  function stockPrevuLivraison({ dernierStockFiable, livraisonsIntermediaires, ventesPrevuesJusquaLivraison }) {
    if (dernierStockFiable == null || ventesPrevuesJusquaLivraison == null) return null;
    return dernierStockFiable + (livraisonsIntermediaires || 0) - ventesPrevuesJusquaLivraison;
  }

  // Jamais négative (une capacité disponible ne peut pas être "en dette" à
  // l'affichage — un stock prévu déjà au-delà de la limite signale plutôt
  // une incohérence à faire remonter, pas une capacité négative).
  function capaciteDisponibleLivraison(limiteRemplissage, stockPrevuLivraisonL) {
    if (limiteRemplissage == null || stockPrevuLivraisonL == null) return null;
    return Math.max(0, limiteRemplissage - stockPrevuLivraisonL);
  }

  // Intègre une commande déjà en cours (§10, exemple exact du cahier :
  // "SP95 physique 12 600 L, commande déjà passée 15 000 L, livraison
  // prévue demain -> stock estimé avant réception 10 900 L, après réception
  // 25 900 L"). `commandeEnCours` = { volumeL, livraisonPrevueLe } ou null.
  function integrerCommandeEnCours({ stockActuelL, commandeEnCours, ventesPrevuesJusquaReception }) {
    if (!commandeEnCours) return null;
    const stockAvantReception = (stockActuelL != null && ventesPrevuesJusquaReception != null)
      ? stockActuelL - ventesPrevuesJusquaReception : null;
    const stockApresReception = stockAvantReception != null ? stockAvantReception + commandeEnCours.volumeL : null;
    return {
      volumeL: commandeEnCours.volumeL, livraisonPrevueLe: commandeEnCours.livraisonPrevueLe,
      stockAvantReception, stockApresReception,
    };
  }

  // ============================================================
  // D. STOCK DE SÉCURITÉ, SCÉNARIOS, 4 ÉTATS, COÛT DE L'ATTENTE
  //    (§7, 11-13, 21 du cahier)
  // ============================================================

  function stockSecuriteLitres(consommationMoyenneJour, stockSecuriteJours) {
    if (consommationMoyenneJour == null || stockSecuriteJours == null) return null;
    return consommationMoyenneJour * stockSecuriteJours;
  }

  // Évalue UN scénario de commande (§12 : scénario A/B/C du cahier — cette
  // fonction calcule un seul scénario, l'appelant la rejoue avec des
  // dates/heures différentes pour comparer). Retourne la fenêtre de
  // livraison, le stock prévu à la livraison, la marge au-dessus de la
  // réserve de sécurité (en L et en jours) et la confiance de la prévision
  // sous-jacente — jamais un chiffre affiché sans sa confiance associée.
  //
  // `ancreStockISO` (optionnel, défaut = dateCommandeISO) : date du dernier
  // stock physique FIABLE connu (`stockActuelL`), distincte de
  // `dateCommandeISO` quand on évalue un scénario "attendre" — la
  // consommation entre AUJOURD'HUI et la livraison compte en entier, même
  // si la commande elle-même n'est simulée que plus tard (§13 : le stock
  // continue de baisser qu'on commande aujourd'hui ou dans 3 jours, seule
  // la date de LIVRAISON change selon quand on déclenche la commande).
  function evaluerScenarioCommande({
    dateCommandeISO, heureCommandeHHMM, config, joursFeriesISO,
    stockActuelL, consommationMoyenneJour, historiqueParJour, carburant,
    commandesEnCoursVolumeL, ancreStockISO,
  }) {
    const fenetre = calculerFenetreLivraison({ dateCommandeISO, heureCommandeHHMM, config, joursFeriesISO });
    if (!fenetre.livraisonISO) return null;
    const dates = joursEntre(ancreStockISO || dateCommandeISO, fenetre.livraisonISO);
    const ventesPrevues = prevoirConsommationFenetre({ historiqueParJour, carburant, datesCiblesISO: dates, joursFeriesISO });
    const stockPrevu = stockPrevuLivraison({
      dernierStockFiable: stockActuelL,
      livraisonsIntermediaires: commandesEnCoursVolumeL || 0,
      ventesPrevuesJusquaLivraison: ventesPrevues.total,
    });
    const securiteL = stockSecuriteLitres(consommationMoyenneJour, config ? config.stock_securite_jours : null);
    const margeL = (stockPrevu != null && securiteL != null) ? stockPrevu - securiteL : null;
    const margeJours = (margeL != null && consommationMoyenneJour) ? margeL / consommationMoyenneJour : null;
    return {
      ...fenetre, dates, ventesPrevuesL: ventesPrevues.total, confiance: ventesPrevues.confiance,
      stockPrevuLivraisonL: stockPrevu, securiteL, margeL, margeJours,
    };
  }

  // Marge (en jours) au-delà de laquelle un carburant a une vraie marge de
  // manœuvre, pas seulement "pas de souci immédiat" (provisoire — §35).
  const SEUIL_MARGE_JOURS_CONFORTABLE = 5;

  // Les 4 états NEXUS (§11) : compare le scénario "commander maintenant" et
  // le scénario "attendre le prochain créneau" (typiquement demain) —
  // exactement la logique de l'exemple vendredi (§13) : l'autonomie brute
  // seule ne suffit pas, ce qui compte est ce qui se passe si on attend.
  function determinerEtatCommande({ scenarioMaintenant, scenarioAttente }) {
    if (!scenarioMaintenant) return { etat: 'non_calculable' };
    if (scenarioMaintenant.margeJours != null && scenarioMaintenant.margeJours < 0) {
      return { etat: 'securite', scenarioMaintenant, scenarioAttente };
    }
    if (scenarioAttente && scenarioAttente.margeJours != null && scenarioAttente.margeJours < 0) {
      return { etat: 'moment_ideal', scenarioMaintenant, scenarioAttente };
    }
    if (scenarioMaintenant.margeJours != null && scenarioMaintenant.margeJours < SEUIL_MARGE_JOURS_CONFORTABLE) {
      return { etat: 'a_anticiper', scenarioMaintenant, scenarioAttente };
    }
    if (scenarioMaintenant.margeJours == null) return { etat: 'non_calculable', scenarioMaintenant, scenarioAttente };
    return { etat: 'confortable', scenarioMaintenant, scenarioAttente };
  }

  // evaluerAttenteCommande() (§21, fonction explicitement demandée par le
  // cahier) — compare "maintenant" vs "attendre" du seul point de vue
  // sécurité (l'angle tarifaire, §17-19, est explicitement hors périmètre
  // de ce lot). Utilisable directement par le simulateur manuel (§30).
  function evaluerAttenteCommande({ scenarioMaintenant, scenarioAttente }) {
    if (!scenarioMaintenant) return { recommandation: 'non_calculable' };
    if (scenarioAttente && scenarioAttente.margeJours != null && scenarioAttente.margeJours < 0) {
      return {
        recommandation: 'commander_maintenant',
        // Formulation orientée décision (25/08/2026, retour de Frédéric :
        // "plus orienté décision") — même information (marge estimée si le
        // manager attend), reformulée autour de l'action à prendre plutôt
        // que de la conséquence à éviter.
        motif: `Commander maintenant évite de passer sous la réserve de sécurité avant le prochain créneau de livraison (marge estimée si vous attendez : ${arrondi1(scenarioAttente.margeJours)} j).`,
        scenarioMaintenant, scenarioAttente,
      };
    }
    return {
      recommandation: 'attendre_possible',
      motif: scenarioAttente && scenarioAttente.margeJours != null
        ? `Attendre reste compatible avec la réserve de sécurité (marge estimée : ${arrondi1(scenarioAttente.margeJours)} j).`
        : 'Attendre reste possible (donnée de marge insuffisante pour un chiffre précis).',
      scenarioMaintenant, scenarioAttente,
    };
  }

  function arrondi1(n) { return n == null ? null : Math.round(n * 10) / 10; }

  // ============================================================
  // E. MINIMUM CAMION, COMPARTIMENTS, OPTIMISATION MULTI-CARBURANT
  //    (§6, 14-16 du cahier)
  // ============================================================

  // Arrondit un besoin théorique au millier de litres (§6, exemple exact :
  // "besoin 13 200 L -> commande potentielle 13 000 L ou 14 000 L") —
  // inférieur par défaut (évite l'immobilisation inutile de trésorerie),
  // supérieur si l'appelant signale explicitement que l'inférieur ne
  // maintiendrait pas la sécurité (`margeSecuriteOk === false`).
  function arrondirVolumeCommande(volumeTheorique, { margeSecuriteOk, pasArrondi } = {}) {
    if (volumeTheorique == null) return null;
    const pas = pasArrondi || 1000;
    const inferieur = Math.floor(volumeTheorique / pas) * pas;
    const superieur = inferieur + pas;
    if (margeSecuriteOk === false) return superieur;
    return inferieur > 0 ? inferieur : superieur;
  }

  function verifierMinimumCamion(volumeTotalL, minimumCamionL) {
    if (volumeTotalL == null || minimumCamionL == null) return { valide: null, manqueL: null };
    return { valide: volumeTotalL >= minimumCamionL, manqueL: Math.max(0, minimumCamionL - volumeTotalL) };
  }

  // Un carburant n'est avancé pour compléter le camion que si son propre
  // besoin arrive sous ce nombre de jours (§15 : ne jamais remplir un
  // camion en avançant un carburant confortable pendant encore 8 jours) —
  // provisoire, à recalibrer avec Frédéric (§35).
  const SEUIL_ANTICIPATION_MAX_JOURS = 3;

  // Capacité maximale du camion de référence (§3 du cahier développeur,
  // 25/08/2026) — repli si `config.maximum_camion_litres` n'est pas encore
  // renseigné en base (migration `carburant_commande_config_maximum_camion`,
  // même valeur pour le site pilote). "Aucune recommandation ne peut
  // dépasser 36 000 L au total" — un plafond dur, distinct du minimum
  // camion (10 000 L).
  const MAXIMUM_CAMION_LITRES = 36000;

  // Plafond d'autonomie après réception pour la phase de complétion "camion
  // complet" (voir plus bas) — un carburant n'est jamais complété au point
  // que son stock après livraison dépasserait ce nombre de jours de vente
  // (25/08/2026, retour de Frédéric : "sans surcharger inutilement un
  // carburant" — le garde-fou explicite qui rend "viser 36 000 L" compatible
  // avec "pas nécessairement 36 000 L à tout prix"). Provisoire, à
  // recalibrer avec Frédéric une fois plusieurs semaines de recommandations
  // "camion complet" observées (même esprit que SEUIL_ANTICIPATION_MAX_JOURS
  // ci-dessus, jamais présenté comme une règle métier définitive).
  const SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION = 20;

  // Cœur du §14-16 : construit la commande multi-carburant optimale, ou
  // recommande d'attendre. `parCarburant` = { sp95: {etat, besoinMinimumSecuriteL,
  // joursAvantBesoin, consommationMoyenneJour, stockPrevuLivraisonL}, go: {...},
  // gnr: {...} } — carburants INACTIFS déjà exclus par l'appelant (jamais un
  // besoin GNR pris en compte tant que cuves_carburants.gnr.actif = false).
  // `capacitesDisponiblesL` = capacité encore disponible à la livraison par
  // carburant (pour compléter en dernier recours sur un carburant déjà
  // urgent, §16, plutôt que d'inventer un besoin sur un carburant confortable
  // sans rapport).
  //
  // `viserCamionComplet` (25/08/2026, retour de Frédéric — "philosophie de
  // volume", deux modes) : booléen OPTIONNEL, PAR DÉFAUT absent/falsy =
  // comportement HISTORIQUE strictement inchangé (s'arrête dès le minimum
  // camion atteint, jamais plus) — rétrocompatible avec tous les appels
  // existants (Article 11, même précédent que le paramètre `fenetreIsolable`
  // de `qualiteChaineCarburant`, v2.205). Quand `true` ("mode normal du
  // mois", hors fin de mois — voir `estFinDeMois` ci-dessus), une phase
  // supplémentaire cherche ensuite à approcher `maximumCamionL` en
  // complétant avec TOUS les carburants actifs éligibles (pas seulement ceux
  // "à anticiper sous 3 jours", restriction qui ne s'applique qu'à l'atteinte
  // du MINIMUM ci-dessus), au prorata de leur consommation moyenne, jamais
  // au-delà de leur capacité disponible ni du plafond de surstock
  // (`SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION`).
  function optimiserCommandeMultiCarburant({ parCarburant, minimumCamionL, maximumCamionL, capacitesDisponiblesL, viserCamionComplet }) {
    const cles = Object.keys(parCarburant || {});
    const urgents = cles.filter(c => parCarburant[c] && (parCarburant[c].etat === 'securite' || parCarburant[c].etat === 'moment_ideal'));

    if (!urgents.length) {
      return {
        decision: 'attendre',
        motif: "Aucun carburant n'est dans sa fenêtre de commande aujourd'hui — avancer un achat maintenant immobiliserait du stock sans nécessité (§15).",
        volumesRetenus: {}, total: 0,
      };
    }

    const volumesRetenus = {};
    urgents.forEach(c => { volumesRetenus[c] = parCarburant[c].besoinMinimumSecuriteL || 0; });
    let total = urgents.reduce((s, c) => s + volumesRetenus[c], 0);
    let carburantsAnticipes = [];
    let optimise = false;
    let motif = null;

    if (total >= minimumCamionL) {
      // Rien à faire ici : déjà au-dessus du minimum via les seuls urgents.
    } else {
      const candidats = cles
        .filter(c => !urgents.includes(c) && parCarburant[c] && parCarburant[c].etat === 'a_anticiper'
          && parCarburant[c].joursAvantBesoin != null && parCarburant[c].joursAvantBesoin <= SEUIL_ANTICIPATION_MAX_JOURS)
        .sort((a, b) => parCarburant[a].joursAvantBesoin - parCarburant[b].joursAvantBesoin);

      candidats.forEach(c => {
        if (total >= minimumCamionL) return;
        const v = parCarburant[c].besoinMinimumSecuriteL || 0;
        if (v <= 0) return;
        volumesRetenus[c] = v;
        total += v;
        carburantsAnticipes.push(c);
      });

      if (total >= minimumCamionL) {
        optimise = carburantsAnticipes.length > 0;
        motif = carburantsAnticipes.length
          ? `Complète le camion avec ${carburantsAnticipes.join(', ')}, dont le besoin approche (sous ${SEUIL_ANTICIPATION_MAX_JOURS} j).`
          : null;
      } else {
        // Toujours sous le minimum : la sécurité prime (§20) — on rapproche
        // le(s) carburant(s) déjà urgent(s) de leur capacité disponible
        // plutôt que de forcer un carburant confortable sans rapport avec le
        // besoin réel.
        const manque = minimumCamionL - total;
        if (urgents.length === 1 && capacitesDisponiblesL && capacitesDisponiblesL[urgents[0]] != null) {
          const c = urgents[0];
          const capaciteRestante = Math.max(0, capacitesDisponiblesL[c] - volumesRetenus[c]);
          const ajout = Math.min(manque, capaciteRestante);
          volumesRetenus[c] += ajout;
          total += ajout;
        }
        if (total >= minimumCamionL) {
          optimise = true;
          motif = 'Volume complété sur le(s) carburant(s) déjà urgent(s), au plus près de la limite de remplissage, pour atteindre le minimum de commande.';
        } else {
          return {
            decision: 'insuffisant_meme_optimise', carburantsAnticipes, volumesRetenus, total,
            manqueL: minimumCamionL - total,
            motif: `Même optimisé, le besoin (${Math.round(total).toLocaleString('fr-FR')} L) reste sous le minimum de commande (${Math.round(minimumCamionL).toLocaleString('fr-FR')} L) — capacités disponibles insuffisantes, à vérifier manuellement.`,
          };
        }
      }
    }

    // Phase "camion complet" (mode normal uniquement, opt-in) — cf.
    // commentaire de la fonction ci-dessus.
    let carburantsCompletes = [];
    if (viserCamionComplet) {
      const complement = completerVersCamionPlein({ parCarburant, volumesRetenus, total, cles, maximumCamionL, capacitesDisponiblesL });
      total = complement.total;
      carburantsCompletes = complement.carburantsCompletes;
      if (carburantsCompletes.length) {
        optimise = true;
        motif = `Camion complété vers ${Math.round(total).toLocaleString('fr-FR')} L (${carburantsCompletes.join(', ')}), au prorata de la consommation, sans dépasser la capacité disponible ni un stock immobilisé disproportionné.`;
      }
    }

    return { decision: 'commander', optimise, carburantsAnticipes, carburantsCompletes, volumesRetenus, total, motif };
  }

  // Phase de complétion "camion complet" (25/08/2026, retour de Frédéric) —
  // répartit l'écart entre `total` déjà retenu et `maximumCamionL` (ou la
  // somme des capacités disponibles si elle est plus petite) au PRORATA de
  // la consommation moyenne de chaque carburant actif éligible — pas
  // seulement le(s) carburant(s) déjà urgent(s), c'est tout l'intérêt de ce
  // mode par rapport à la phase minimum-camion ci-dessus (§14-16). Boucle
  // bornée (jamais plus de `cles.length` tours, garde-fou à 100) car un
  // carburant peut atteindre son plafond (capacité OU surstock) avant les
  // autres, auquel cas l'écart restant est redistribué aux carburants
  // encore éligibles au tour suivant — même discipline de boucle bornée que
  // la recomposition du plafond camion existante (construireEvaluationGlobale).
  function completerVersCamionPlein({ parCarburant, volumesRetenus, total, cles, maximumCamionL, capacitesDisponiblesL }) {
    const maxCamion = maximumCamionL || MAXIMUM_CAMION_LITRES;
    const capaciteTotaleDisponible = cles.reduce((s, c) => s + ((capacitesDisponiblesL && capacitesDisponiblesL[c] != null) ? capacitesDisponiblesL[c] : 0), 0);
    const cible = Math.min(maxCamion, capaciteTotaleDisponible);
    const besoinInitial = { ...volumesRetenus };

    // Volume ADDITIONNEL maximal qu'un carburant peut encore recevoir sans
    // dépasser sa capacité disponible NI le plafond de surstock (autonomie
    // après réception). Un carburant sans consommation moyenne connue n'est
    // borné que par la capacité (jamais bloqué sur une donnée manquante,
    // Article 5 — mais jamais non plus le premier servi si sa consommation
    // est inconnue : le tri par consommation le place naturellement en
    // dernier via un poids nul dans la répartition proportionnelle).
    function plafondAdditionnelL(c) {
      const ev = parCarburant[c] || {};
      const capaciteRestante = Math.max(0, ((capacitesDisponiblesL && capacitesDisponiblesL[c] != null) ? capacitesDisponiblesL[c] : 0) - (volumesRetenus[c] || 0));
      if (!ev.consommationMoyenneJour || ev.stockPrevuLivraisonL == null) return capaciteRestante;
      const stockMaxAutorise = ev.consommationMoyenneJour * SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION;
      const margeAutonomie = Math.max(0, stockMaxAutorise - (ev.stockPrevuLivraisonL + (volumesRetenus[c] || 0)));
      return Math.min(capaciteRestante, margeAutonomie);
    }

    let restant = cible - total;
    let tour = cles.filter(c => plafondAdditionnelL(c) > 0);
    let garde = 0;
    while (restant > 0.01 && tour.length && garde < 100) {
      garde++;
      const sommeConso = tour.reduce((s, c) => s + (parCarburant[c].consommationMoyenneJour || 0), 0);
      let ajouteCeTour = 0;
      tour.forEach(c => {
        const poids = sommeConso > 0 ? (parCarburant[c].consommationMoyenneJour || 0) / sommeConso : 1 / tour.length;
        const part = Math.min(restant * poids, plafondAdditionnelL(c));
        if (part <= 0) return;
        volumesRetenus[c] = (volumesRetenus[c] || 0) + part;
        ajouteCeTour += part;
      });
      if (ajouteCeTour <= 0) break; // plus aucun carburant ne peut recevoir -> sortir, jamais une boucle infinie.
      total += ajouteCeTour;
      restant -= ajouteCeTour;
      tour = tour.filter(c => plafondAdditionnelL(c) > 0.01);
    }

    const carburantsCompletes = cles.filter(c => (volumesRetenus[c] || 0) > (besoinInitial[c] || 0) + 0.01);
    return { total, carburantsCompletes };
  }

  // ============================================================
  // F. QUALITÉ DES DONNÉES (§28-29 du cahier)
  // ============================================================

  // 3 niveaux du cahier §28. `stockFiable` : le dernier stock physique
  // utilisé comme ancre est-il lui-même fiable (voir NexusCarburantMoteur.
  // qualiteChaineCarburant, réutilisé par l'appelant, Article 11 — jamais
  // un 2ᵉ calcul de fiabilité de la chaîne physique ici).
  function qualiteDonneesCommande({ stockFiable, previsionConfiance }) {
    if (!stockFiable) return 'non_calculable';
    if (previsionConfiance === 'non_calculable') return 'non_calculable';
    if (previsionConfiance === 'a_confirmer') return 'a_confirmer';
    return 'fiable';
  }

  // ============================================================
  // G. ÉVALUATION COMPLÈTE D'UN CARBURANT, PUIS DE TOUS LES CARBURANTS
  //    (§27, l'objet de sortie du moteur)
  // ============================================================

  // Recherche bornée (14 jours, horizon de planification raisonnable pour
  // ce cahier — au-delà, "confortable" suffit comme réponse, jamais un
  // calcul de précision inutile sur un horizon lointain) du premier jour où
  // ce carburant entrerait lui-même dans sa fenêtre de commande (moment
  // idéal ou sécurité) — alimente l'optimisation multi-carburant (§14-16)
  // et le message "à anticiper" (§11, "SP95 — commande probablement
  // nécessaire demain avant 11h").
  function joursAvantBesoinCarburant(args) {
    for (let j = 1; j <= 14; j++) {
      const dISO = ajouterJoursISO(args.maintenantISO, j);
      const prochainCreneau = prochainJourLivraisonPossible(dISO, args.config, args.joursFeriesISO);
      // `ancreStockISO` reste TOUJOURS args.maintenantISO ici : le seul stock
      // physique fiable connu est celui d'aujourd'hui — on simule "et si on
      // décidait de commander dans j jours", pas "et si on avait un nouveau
      // relevé dans j jours" (qu'on n'a évidemment pas encore).
      const sc = evaluerScenarioCommande({ ...args, dateCommandeISO: dISO, heureCommandeHHMM: '00:00', ancreStockISO: args.maintenantISO });
      const scAttente = prochainCreneau
        ? evaluerScenarioCommande({ ...args, dateCommandeISO: prochainCreneau, heureCommandeHHMM: '00:00', ancreStockISO: args.maintenantISO })
        : null;
      const e = determinerEtatCommande({ scenarioMaintenant: sc, scenarioAttente: scAttente });
      if (e.etat === 'moment_ideal' || e.etat === 'securite') return j;
    }
    return null;
  }

  // Évaluation complète d'UN carburant — l'entrée que l'écran/le chargeur
  // consomment directement pour construire la carte "Prochaine commande"
  // (§22) et alimenter l'optimisation multi-carburant.
  function evaluerCarburant({
    carburant, maintenantISO, heureMaintenantHHMM, config, joursFeriesISO,
    stockActuelL, limiteRemplissageL, consommationMoyenneJour, historiqueParJour,
    commandeEnCoursVolumeL, stockFiable,
  }) {
    const args = { config, joursFeriesISO, stockActuelL, consommationMoyenneJour, historiqueParJour, carburant, commandesEnCoursVolumeL: commandeEnCoursVolumeL, maintenantISO };
    const scenarioMaintenant = evaluerScenarioCommande({ ...args, dateCommandeISO: maintenantISO, heureCommandeHHMM: heureMaintenantHHMM });
    // "Attendre" = rater le cutoff d'aujourd'hui et agir au PROCHAIN créneau
    // valide (le prochain jour de livraison autorisé, jamais simplement
    // "demain" — un samedi/dimanche/férié ne change rien à la fenêtre par
    // rapport à aujourd'hui, exactement l'exemple vendredi du cahier §13 :
    // attendre jusqu'à samedi ne change rien, la vraie perte vient de rater
    // le cutoff du jour ouvré lui-même).
    const prochainCreneauISO = prochainJourLivraisonPossible(maintenantISO, config, joursFeriesISO);
    const scenarioAttente = prochainCreneauISO
      ? evaluerScenarioCommande({ ...args, dateCommandeISO: prochainCreneauISO, heureCommandeHHMM: '00:00', ancreStockISO: maintenantISO })
      : null;
    const etatInfo = determinerEtatCommande({ scenarioMaintenant, scenarioAttente });
    const attente = evaluerAttenteCommande({ scenarioMaintenant, scenarioAttente });

    // Besoin minimum de sécurité (§5 du cahier développeur "NEXUS — Règles
    // du moteur de commande carburant", 25/08/2026) : max(0, réserve cible -
    // stock prévu à la livraison) — JAMAIS la capacité disponible de la
    // cuve. Corrige une confusion identifiée par l'audit développeur : ce
    // champ (alors nommé besoinTheoriqueL) valait auparavant
    // capaciteDisponibleLivraison(...), transformant directement "capacité
    // restante" en "volume à commander" — exactement la "Règle absolue"
    // interdite en page 2 du cahier ("Le moteur ne doit jamais transformer
    // directement « capacité restante dans la cuve » en « volume à
    // commander ». Il doit d'abord calculer le besoin de sécurité, la
    // capacité disponible, les scénarios de livraison, puis choisir une
    // quantité optimale entre ces bornes."). C'est ce bug précis qui
    // produisait une recommandation automatiquement égale à la capacité
    // disponible (ex. 23 170 L pour SP95 sur vito-sainte-marie, cas cité
    // nommément par l'audit comme exemple à ne jamais reproduire) au lieu du
    // besoin réel de sécurité, généralement bien inférieur.
    let besoinMinimumSecuriteL = null;
    if (scenarioMaintenant && scenarioMaintenant.securiteL != null && scenarioMaintenant.stockPrevuLivraisonL != null) {
      besoinMinimumSecuriteL = Math.max(0, scenarioMaintenant.securiteL - scenarioMaintenant.stockPrevuLivraisonL);
    }
    // Capacité disponible à la livraison — plafond dur DISTINCT du besoin
    // (§11 de l'audit : "la carte doit distinguer « capacité disponible » et
    // « volume conseillé »"), exposée ici pour que l'écran l'affiche sans la
    // recalculer (Article 11 — même formule que celle utilisée par le
    // chargeur pour capacitesDisponiblesL, jamais un second calcul divergent).
    let capaciteDisponibleL = null;
    if (scenarioMaintenant && limiteRemplissageL != null && scenarioMaintenant.stockPrevuLivraisonL != null) {
      capaciteDisponibleL = capaciteDisponibleLivraison(limiteRemplissageL, scenarioMaintenant.stockPrevuLivraisonL);
    }

    const joursAvantBesoin = (etatInfo.etat === 'moment_ideal' || etatInfo.etat === 'securite')
      ? 0
      : joursAvantBesoinCarburant(args);

    const previsionConfiance = scenarioMaintenant ? scenarioMaintenant.confiance : 'non_calculable';

    return {
      carburant, etat: etatInfo.etat, scenarioMaintenant, scenarioAttente, attente,
      besoinMinimumSecuriteL, capaciteDisponibleL, joursAvantBesoin,
      confiance: qualiteDonneesCommande({ stockFiable, previsionConfiance }),
    };
  }

  // Pire état parmi tous les carburants actifs (jamais une moyenne — un
  // seul carburant en sécurité doit dominer l'affichage, même règle que
  // statutGlobalControle dans le moteur Carburants existant, Article 11).
  const ORDRE_ETAT_GLOBAL = ['securite', 'moment_ideal', 'a_anticiper', 'confortable', 'non_calculable'];
  function determinerEtatGlobal(parCarburant) {
    const etats = Object.values(parCarburant || {}).map(e => e.etat);
    return ORDRE_ETAT_GLOBAL.find(e => etats.includes(e)) || 'non_calculable';
  }

  // Construit l'objet complet §27 : évaluation par carburant + décision
  // multi-carburant + volumes arrondis finaux. `evaluationsParCarburant` =
  // { sp95: evaluerCarburant(...), go: ..., gnr: ... si actif } — construit
  // par l'appelant (la boucle sur les carburants actifs appartient à la
  // couche données, ce moteur reste pur et ne sait rien de la config des
  // cuves du site).
  // `viserCamionComplet` (25/08/2026, retour de Frédéric) : transmis tel
  // quel à `optimiserCommandeMultiCarburant` — calculé par l'appelant
  // (couche données, via `estFinDeMois`), ce moteur reste pur et ne connaît
  // pas la date du jour par lui-même (Article 11, même discipline que
  // `maintenantISO` déjà injecté partout ailleurs dans ce fichier).
  function construireEvaluationGlobale({ evaluationsParCarburant, config, capacitesDisponiblesL, viserCamionComplet }) {
    const pourOptimisation = {};
    Object.entries(evaluationsParCarburant || {}).forEach(([c, ev]) => {
      pourOptimisation[c] = {
        etat: ev.etat, besoinMinimumSecuriteL: ev.besoinMinimumSecuriteL, joursAvantBesoin: ev.joursAvantBesoin,
        // Nécessaires à la phase "camion complet" (complétion au prorata de
        // la consommation, plafond de surstock) — déjà calculés ailleurs,
        // jamais un second calcul (Article 11).
        consommationMoyenneJour: ev.consommationMoyenneJour,
        stockPrevuLivraisonL: ev.scenarioMaintenant ? ev.scenarioMaintenant.stockPrevuLivraisonL : null,
      };
    });

    const optim = optimiserCommandeMultiCarburant({
      parCarburant: pourOptimisation,
      minimumCamionL: config ? config.minimum_camion_litres : null,
      maximumCamionL: (config && config.maximum_camion_litres) || MAXIMUM_CAMION_LITRES,
      capacitesDisponiblesL,
      viserCamionComplet,
    });

    let commandeRecommandee = null;
    if (optim.decision === 'commander') {
      // Compartiments camion en m³ complets (25/08/2026, retour de Frédéric :
      // "les compartiments du camion sont en m3 complet et non au litre") —
      // TOUT volume final recommandé doit être un multiple de 1000 L, y
      // compris quand il est plafonné par la capacité physique disponible.
      // Déclaré avant son premier usage (avant, seulement défini plus bas,
      // dupliqué implicitement par le Math.floor() nu du plafond ci-dessous).
      const pasArrondi = 1000;
      const volumesArrondis = {};
      let totalArrondi = 0;
      Object.entries(optim.volumesRetenus).forEach(([c, v]) => {
        const ev = evaluationsParCarburant[c];
        const margeSecuriteOk = ev && ev.scenarioMaintenant && ev.scenarioMaintenant.margeJours != null
          ? ev.scenarioMaintenant.margeJours >= 0 : null;
        let arrondi = arrondirVolumeCommande(v, { margeSecuriteOk });
        // P0 (25/08/2026, retour de Frédéric — cas réel vito-sainte-marie :
        // SP95 stock prévu 5 591 L, limite de remplissage 28 761 L, capacité
        // disponible 23 170 L, mais recommandation affichée 24 000 L,
        // dépassant la capacité physique de 830 L). arrondirVolumeCommande
        // arrondit AU-DESSUS quand la marge de sécurité est insuffisante
        // (margeSecuriteOk === false) sans jamais savoir ce que la cuve peut
        // physiquement recevoir — l'arrondi de sécurité ne doit cependant
        // jamais dépasser la capacité disponible à la livraison. Priorité
        // explicite du cahier : "sécurité > capacité physique > réserve 3
        // jours [...]" — la capacité physique reste un plafond dur, même si
        // cela signifie rester en-dessous de l'arrondi "sécurité".
        //
        // Correctif (25/08/2026, retour de Frédéric sur v2.245 : "sa
        // recommandation doit être par exemple 24000 ou 23000 et non
        // 23470") — le plafond de capacité physique (ex. 23 170 L restants
        // en cuve) n'est PAS lui-même un multiple de 1000 L ; l'ancien
        // Math.floor(capacitesDisponiblesL[c]) ne faisait que supprimer les
        // décimales, laissant passer un plafond comme 23 170 tel quel. Un
        // camion ne livre que des compartiments pleins (unités de 1000 L,
        // "m³ complet") : le plafond physique doit donc lui-même être
        // arrondi AU MULTIPLE DE 1000 INFÉRIEUR avant de brider `arrondi` —
        // rester en dessous de la capacité réelle est toujours sûr (jamais
        // l'inverse), cohérent avec la priorité "sécurité > capacité
        // physique" déjà actée ci-dessus.
        if (capacitesDisponiblesL && capacitesDisponiblesL[c] != null) {
          const plafond = Math.floor(capacitesDisponiblesL[c] / pasArrondi) * pasArrondi;
          if (arrondi > plafond) arrondi = plafond;
        }
        volumesArrondis[c] = arrondi;
        totalArrondi += arrondi || 0;
      });
      // Filet de sécurité : si l'arrondi (toujours au multiple de 1000
      // inférieur par défaut) repasse sous le minimum camion, on remonte le
      // plus gros volume d'un cran — mais JAMAIS au-delà de sa propre
      // capacité disponible (même plafond dur que ci-dessus, désormais lui
      // aussi arrondi au multiple de 1000 inférieur). Si aucun carburant
      // retenu n'a plus de marge de capacité, la commande reste honnêtement
      // sous le minimum camion plutôt que de proposer un volume
      // matériellement impossible à recevoir (Article 5).
      if (config && totalArrondi < config.minimum_camion_litres) {
        const tri = Object.entries(volumesArrondis).sort((a, b) => b[1] - a[1]);
        for (const [cle] of tri) {
          const plafondCle = (capacitesDisponiblesL && capacitesDisponiblesL[cle] != null)
            ? Math.floor(capacitesDisponiblesL[cle] / pasArrondi) * pasArrondi : Infinity;
          if (volumesArrondis[cle] + pasArrondi <= plafondCle) {
            volumesArrondis[cle] += pasArrondi;
            totalArrondi += pasArrondi;
            break;
          }
        }
      }
      // Plafond camion (§3/§15-16 du cahier développeur : "Camion recommandé
      // 38 000 L -> Refus : maximum 36 000 L. Recomposition obligatoire.") —
      // aucune recommandation ne peut dépasser la capacité maximale du
      // camion, quelle que soit la somme des besoins de sécurité individuels
      // (deux carburants peuvent chacun être en déficit sans que leur somme
      // tienne dans un seul camion). Recompose en réduisant par pas de
      // 1000 L le volume le plus élevé jusqu'à repasser sous le plafond —
      // jamais un simple refus silencieux (le manager doit voir un volume
      // réellement livrable, quitte à ce qu'il soit incomplet).
      const maximumCamionL = (config && config.maximum_camion_litres) || MAXIMUM_CAMION_LITRES;
      if (totalArrondi > maximumCamionL) {
        let exces = totalArrondi - maximumCamionL;
        while (exces > 0) {
          const candidats = Object.entries(volumesArrondis).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
          if (!candidats.length) break;
          const [cle] = candidats[0];
          const retrait = Math.min(pasArrondi, volumesArrondis[cle], exces);
          if (retrait <= 0) break;
          volumesArrondis[cle] -= retrait;
          totalArrondi -= retrait;
          exces -= retrait;
        }
      }
      commandeRecommandee = { volumes: volumesArrondis, total: totalArrondi };
    }

    return {
      parCarburant: evaluationsParCarburant, optimisation: optim, commandeRecommandee,
      etatGlobal: determinerEtatGlobal(evaluationsParCarburant),
      // Exposé pour l'écran (25/08/2026, retour de Frédéric) — permet de
      // reformuler "pourquoi un carburant n'est pas inclus" selon le mode
      // réellement appliqué, jamais un texte qui suppose le mauvais mode.
      viserCamionComplet: !!viserCamionComplet,
    };
  }

  // ============================================================
  // H. NOTIFICATION COCKPIT/BRIEF (§24-25 du cahier) — au plus UNE
  // notification par appel : `evaluation.etatGlobal` est un état unique
  // (jamais deux à la fois), donc ce moteur ne contribue jamais plus d'un
  // candidat au tri fusionné de Cockpit/Brief — satisfait trivialement le
  // plafond "2 notifications maximum (anticipation + action)" du cahier.
  // Aucun calcul ici (Article 11) : relit l'évaluation déjà construite par
  // construireEvaluationGlobale() (chargée une seule fois par
  // NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite, réutilisée
  // telle quelle par la carte "Prochaine commande" ET par cette
  // notification — jamais un second calcul de statut).
  // ============================================================
  function fmtLCandidat(v) { return v == null ? '—' : `${Math.round(v).toLocaleString('fr-FR')} L`; }
  const CONFIANCE_TEXTE = { fiable: 'Élevée', a_confirmer: 'Moyenne', non_calculable: 'Faible' };

  function calculerCandidatCommande(evaluation) {
    if (!evaluation || evaluation.ok === false) return null;
    const etat = evaluation.etatGlobal;
    if (etat !== 'securite' && etat !== 'moment_ideal' && etat !== 'a_anticiper') return null;

    const NOM = (global.NexusCarburantMoteur && global.NexusCarburantMoteur.NOM_CARBURANT_COURT) || {};
    const parCarburant = evaluation.parCarburant || {};
    const clesRecommandees = evaluation.commandeRecommandee ? Object.keys(evaluation.commandeRecommandee.volumes) : [];
    const clesAnticipees = Object.keys(parCarburant).filter(c => parCarburant[c].etat === 'a_anticiper');
    const cles = clesRecommandees.length ? clesRecommandees : clesAnticipees;
    const cleRef = cles[0] || Object.keys(parCarburant)[0];
    const evRef = cleRef ? parCarburant[cleRef] : null;
    if (!evRef) return null;

    const noms = (cles.length ? cles : [cleRef]).map(c => NOM[c] || c).join(', ');
    let decision, constat, impactAttendu, preuve;
    if (evaluation.commandeRecommandee) {
      decision = `Préparez la commande carburant : ${noms} — ${fmtLCandidat(evaluation.commandeRecommandee.total)} recommandé.`;
      preuve = evRef.scenarioMaintenant && evRef.scenarioMaintenant.margeJours != null
        ? `Marge estimée avant réserve de sécurité : ${Math.round(evRef.scenarioMaintenant.margeJours * 10) / 10} j.`
        : null;
    } else if (evaluation.optimisation && evaluation.optimisation.decision === 'insuffisant_meme_optimise') {
      decision = `Vérifiez la commande carburant : ${noms} approche sa fenêtre de commande, mais le volume reste sous le minimum camion même optimisé.`;
      preuve = evaluation.optimisation.motif || null;
    } else {
      decision = `Anticipez la commande carburant : ${noms} entrera dans sa fenêtre de commande dans ${evRef.joursAvantBesoin != null ? `${evRef.joursAvantBesoin} j` : 'quelques jours'}.`;
      preuve = null;
    }
    constat = (evRef.attente && evRef.attente.motif) || 'Recommandation calculée à partir du stock actuel, de la consommation prévue et du calendrier de livraison.';
    impactAttendu = "Livraison au bon moment — évite une rupture de stock carburant ou une commande précipitée sous le minimum camion.";

    return {
      id: `COMMANDE-CARBURANT-${evaluation.dateISO || ''}`,
      type: etat === 'securite' ? 'critique' : (etat === 'moment_ideal' ? 'attention' : 'attention'),
      niveau: etat === 'securite' ? 'critique' : 'attention',
      // rang plus favorable (0) pour les 2 états réellement actionnables
      // (moment_ideal/sécurité) que pour la simple anticipation (1) — même
      // logique que RANG_FDJ (nexus-conseiller.js), jamais un rang inventé.
      rangInterne: (etat === 'a_anticiper') ? 1 : 0,
      titre: 'Commande carburant',
      decision, constat, impactAttendu, preuve,
      limites: "Recommandation calculée automatiquement par NEXUS — vérifiez la disponibilité fournisseur avant de valider la commande.",
      cible: 'NEXUS-Carburants-Pilotage-v1.html',
      confiance: CONFIANCE_TEXTE[evRef.confiance] || 'Moyenne',
    };
  }

  // ============================================================
  // I. CONTEXTE HISTORIQUE DE PLAUSIBILITÉ (25/08/2026, retour de Frédéric,
  //    cahier "NEXUS Carburants / moteur de recommandation" — "historique de
  //    commandes réel comme référence de plausibilité"). Jamais une règle
  //    rigide : ce contexte ne bloque et ne force aucune décision du moteur
  //    (§ explicite du cahier), c'est un simple repère pour juger si une
  //    recommandation est cohérente avec ce qui s'est réellement passé sur
  //    ce site — affiché, jamais appliqué en coupe-circuit. Noms de champs
  //    en français, alignés sur le reste du fichier (Article 11) — mapping
  //    vers le vocabulaire du cahier documenté ci-dessous :
  //      average_order_volume        -> volumeMoyenL
  //      median_order_volume         -> volumeMedianL
  //      typical_sp_volume           -> volumeSpTypiqueL
  //      typical_go_volume           -> volumeGoTypiqueL
  //      average_days_between_orders -> intervalleMoyenJours
  //      projected_days_until_next_order -> joursAvantProchaineCommandeEstimee
  //      deviation_from_historical_pattern -> ecartAuPattern
  // ============================================================

  function median(valeurs) {
    if (!valeurs || !valeurs.length) return null;
    const tri = [...valeurs].sort((a, b) => a - b);
    const milieu = Math.floor(tri.length / 2);
    return tri.length % 2 === 0 ? (tri[milieu - 1] + tri[milieu]) / 2 : tri[milieu];
  }

  function moyenneListe(valeurs) {
    if (!valeurs || !valeurs.length) return null;
    return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  }

  // historique : lignes brutes carburant_commandes (quel que soit `source`
  // — Article 11, jamais un second calcul selon l'origine des lignes ; le
  // filtrage éventuel par source/statut est la responsabilité du chargeur,
  // pas du moteur). volumeProposeL : volume total de la recommandation
  // actuelle, optionnel — si fourni, calcule l'écart au pattern.
  function construireContextePlausibilite(historique, volumeProposeL, maintenant) {
    const commandes = (historique || [])
      .filter(c => c && c.volume_total_l != null && c.proposee_le)
      .map(c => ({
        timestamp: new Date(c.proposee_le).getTime(),
        volumeTotal: Number(c.volume_total_l),
        sp95: c.carburants && c.carburants.sp95 && c.carburants.sp95.volumeL != null ? Number(c.carburants.sp95.volumeL) : null,
        go: c.carburants && c.carburants.go && c.carburants.go.volumeL != null ? Number(c.carburants.go.volumeL) : null,
      }))
      .filter(c => !isNaN(c.timestamp) && !isNaN(c.volumeTotal))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (commandes.length === 0) {
      return {
        nombreCommandes: 0, volumeMoyenL: null, volumeMedianL: null,
        volumeSpTypiqueL: null, volumeGoTypiqueL: null,
        intervalleMoyenJours: null, joursDepuisDerniereCommande: null,
        joursAvantProchaineCommandeEstimee: null, ecartAuPattern: null,
      };
    }

    const volumes = commandes.map(c => c.volumeTotal);
    const volumesSp = commandes.map(c => c.sp95).filter(v => v != null);
    const volumesGo = commandes.map(c => c.go).filter(v => v != null);

    const intervallesJours = [];
    for (let i = 1; i < commandes.length; i++) {
      intervallesJours.push((commandes[i].timestamp - commandes[i - 1].timestamp) / 86400000);
    }

    const volumeMoyenL = moyenneListe(volumes);
    const volumeMedianL = median(volumes);
    const intervalleMoyenJours = intervallesJours.length ? moyenneListe(intervallesJours) : null;
    const derniere = commandes[commandes.length - 1];
    const nowTs = maintenant ? new Date(maintenant).getTime() : Date.now();
    const joursDepuisDerniereCommande = (nowTs - derniere.timestamp) / 86400000;
    const joursAvantProchaineCommandeEstimee = intervalleMoyenJours != null
      ? intervalleMoyenJours - joursDepuisDerniereCommande : null;

    // Écart au pattern habituel — seuils indicatifs (±15%/±30% autour de la
    // médiane), un repère de lecture NEXUS, jamais une règle métier validée
    // par Frédéric contrairement aux autres seuils de ce fichier.
    let ecartAuPattern = null;
    if (volumeProposeL != null && volumeMedianL) {
      const ecartPct = (volumeProposeL - volumeMedianL) / volumeMedianL;
      let niveau = 'dans_la_norme';
      if (Math.abs(ecartPct) > 0.3) niveau = 'inhabituel';
      else if (Math.abs(ecartPct) > 0.15) niveau = 'a_surveiller';
      ecartAuPattern = { ecartPct, niveau };
    }

    return {
      nombreCommandes: commandes.length,
      volumeMoyenL, volumeMedianL,
      volumeSpTypiqueL: moyenneListe(volumesSp),
      volumeGoTypiqueL: moyenneListe(volumesGo),
      intervalleMoyenJours,
      joursDepuisDerniereCommande,
      joursAvantProchaineCommandeEstimee,
      ecartAuPattern,
    };
  }

  global.NexusCarburantCommandeMoteur = {
    // Calendrier
    ajouterJoursISO, joursEntre, jourSemaineIso, estJourLivraisonPossible,
    prochainJourLivraisonPossible, calculerFenetreLivraison,
    JOURS_FIN_MOIS, estFinDeMois,
    // Prévision
    SEUIL_POINTS_JOUR_SEMAINE_FIABLE,
    moyennePondereeMemeJourSemaine, moyenneRecente, moyenneJoursFeries,
    prevoirConsommationJour, prevoirConsommationFenetre,
    // Stock prévisionnel
    stockPrevuLivraison, capaciteDisponibleLivraison, integrerCommandeEnCours,
    // États / fenêtre idéale / attente
    stockSecuriteLitres, SEUIL_MARGE_JOURS_CONFORTABLE,
    evaluerScenarioCommande, determinerEtatCommande, evaluerAttenteCommande,
    // Camion / multi-carburant
    arrondirVolumeCommande, verifierMinimumCamion, SEUIL_ANTICIPATION_MAX_JOURS,
    MAXIMUM_CAMION_LITRES, SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION, optimiserCommandeMultiCarburant,
    // Qualité des données
    qualiteDonneesCommande,
    // Évaluation complète
    evaluerCarburant, determinerEtatGlobal, construireEvaluationGlobale,
    // Notification Cockpit/Brief
    calculerCandidatCommande,
    // Contexte historique de plausibilité
    construireContextePlausibilite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
