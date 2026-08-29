// NEXUS Inventaire — moteur pur (aucun accès Supabase, Article 11 du projet).
// Créé le 17/08/2026 pour le cahier "Inventaire 2.0 - Audit & implémentation"
// (P0 : Sprint 1 "Vérité physique", Sprint 2 "Plan tournant", Sprint 3 "Total
// produit"). Premier moteur pur d'Inventaire — jusqu'ici toute la logique de
// calcul restait inline dans NEXUS-Inventaire-v1.html/-Manager-v1.html
// (confirmé par cartographie du 17/08/2026) ; ce fichier ne fait QUE calculer
// à partir de données déjà chargées, jamais une requête réseau.
//
// Doctrine du cahier (§2), rappelée ici car elle gouverne chaque fonction :
//  - NEXUS décide ce qui mérite d'être compté.
//  - L'employé observe le physique ; il ne reconstitue jamais le théorique.
//  - NEXUS consolide les lieux en un total produit.
//  - Le manager corrige le total produit retenu, pas les sous-comptages.
//  - Donnée manquante = contrôle provisoire, jamais faux écart.

(function (global) {
  'use strict';

  // ============================================================
  // Sprint 2 — Plan tournant : sélection de ce qui doit être compté.
  // ============================================================

  // Délai maximum par défaut (en jours) sans contrôle physique avant qu'un
  // produit devienne "en retard", par famille (cahier §5). `critique`=0 :
  // un jour déjà écoulé depuis le dernier contrôle (y compris "compté au
  // quart précédent, il y a quelques heures") suffit à le rendre à nouveau
  // dû — ce qui traduit exactement "chaque quart" sans avoir besoin d'un
  // second mécanisme séparé pour les critiques (Article 11 : une seule
  // règle, coverage_gap, couvre à la fois "critique" et "standard").
  const DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE = {
    critique: 0,
    standard: 7,
    faible_rotation: 21,
  };

  const FAMILLES_CONTROLE = [
    { cle: 'critique', label: 'Critique / forte rotation', delaiDefautJours: 0 },
    { cle: 'standard', label: 'Standard', delaiDefautJours: 7 },
    { cle: 'faible_rotation', label: 'Faible rotation fiable', delaiDefautJours: 21 },
  ];

  const LIBELLE_RAISON_SELECTION = {
    critique: 'Référence critique — contrôle dû chaque quart',
    coverage_gap: 'Délai maximum sans contrôle atteint',
    anomalie_recente: 'Écart récent à reconfirmer',
    quota_tournant: 'Parcours tournant du jour',
    surprise: 'Contrôle surprise NEXUS',
    manager_forced: 'Ajout manuel manager',
  };

  function libelleRaisonSelection(raison) {
    return LIBELLE_RAISON_SELECTION[raison] || 'Sélectionné par NEXUS';
  }

  // Nombre de jours calendaires entiers entre deux dates ISO ('YYYY-MM-DD').
  // `dernierControleISO` peut être une date+heure ISO complète (compte_le) —
  // on ne compare que la partie date, un contrôle fait à 23h reste "du jour".
  function joursEntreDates(dateDebutISO, dateFinISO) {
    if (!dateDebutISO || !dateFinISO) return null;
    const d1 = new Date(String(dateDebutISO).slice(0, 10) + 'T00:00:00Z').getTime();
    const d2 = new Date(String(dateFinISO).slice(0, 10) + 'T00:00:00Z').getTime();
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }

  // Délai maximum applicable à un produit : override explicite si présent,
  // sinon défaut de la famille — jamais un troisième nombre inventé ailleurs.
  function delaiMaxJours(regle) {
    if (!regle) return DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE.standard;
    if (regle.delai_max_jours_sans_controle != null) return regle.delai_max_jours_sans_controle;
    return DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE[regle.frequence_controle] != null
      ? DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE[regle.frequence_controle]
      : DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE.standard;
  }

  // Un produit est éligible à ce quart si sa règle ne restreint pas
  // `quarts_comptage`, ou si le quart cible y figure — même logique que
  // l'existant `chargerProduitsZone` (NEXUS-Inventaire-v1.html), reprise ici
  // pour que le moteur de sélection utilise exactement la même règle
  // d'affectation aux quarts (Article 11).
  function produitEligibleQuart(regle, quart) {
    const quarts = regle && regle.quarts_comptage;
    if (!quarts || !quarts.length) return true;
    return quarts.includes(quart);
  }

  // ============================================================
  // Sprint "Catégorie porte les règles" (20/08/2026, demande de Frédéric —
  // "règle de catégorie par défaut + exceptions produit" : le manager règle
  // une catégorie une fois, chaque produit hérite, seuls les produits qui
  // dérogent portent leur propre ligne). Cascade à 3 niveaux :
  //   1. inventaire_regles_produit (ligne du produit) — si elle existe,
  //      prime TOUJOURS, quoi que porte sa catégorie (c'est l'exception).
  //   2. inventaire_categories (ligne de la catégorie du produit) — ne
  //      s'applique QUE si son interrupteur explicite `regle_active` est
  //      vrai (jamais déduit de la simple présence d'une valeur — voir
  //      migration inventaire_categories_regles_heritees).
  //   3. Sinon `regle` reste null — comportement historique inchangé :
  //      chaque fonction du moteur retombe déjà sur ses propres défauts
  //      internes (DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE, produitEligibleQuart
  //      qui traite l'absence de quarts_comptage comme "tous les quarts",
  //      etc.). Aucune de ces fonctions n'est modifiée par ce sprint — elles
  //      continuent de recevoir un simple objet `regle` par produit sans
  //      jamais savoir s'il vient du produit ou de sa catégorie
  //      (Article 11 : le moteur de sélection reste générique).
  // ============================================================
  function regleEffectiveProduit(regleProduit, regleCategorie) {
    if (regleProduit) return Object.assign({}, regleProduit, { origineRegle: 'produit' });
    if (regleCategorie && regleCategorie.regle_active) return Object.assign({}, regleCategorie, { origineRegle: 'categorie' });
    return null;
  }

  // Version "toute la liste" de regleEffectiveProduit, pour construire en
  // une passe la map produit_id -> règle effective que consomment déjà
  // construirePlanComptage (reglesParProduit) et les écrans employé/manager.
  // `produits` doit porter `id` et `categorie_id` ; `reglesParProduitId` et
  // `reglesParCategorieId` sont des maps déjà indexées (par produit_id /
  // categorie_id respectivement) — jamais reconstruites différemment à deux
  // endroits (Article 11).
  function construireReglesEffectivesParProduit(produits, reglesParProduitId, reglesParCategorieId) {
    const reglesProduit = reglesParProduitId || {};
    const reglesCategorie = reglesParCategorieId || {};
    const resultat = {};
    (produits || []).forEach(p => {
      const regleCategorie = p.categorie_id ? reglesCategorie[p.categorie_id] : null;
      const regle = regleEffectiveProduit(reglesProduit[p.id], regleCategorie);
      if (regle) resultat[p.id] = regle;
    });
    return resultat;
  }

  // ============================================================
  // Sprint 5 "Seuils d'écart par catégorie" (20/08/2026, demande de
  // Frédéric — "éventuellement seuils d'écart" dans sa liste de réglages
  // par catégorie). Cascade à 2 niveaux, plus simple que
  // regleEffectiveProduit ci-dessus car inventaire_seuils n'a pas de
  // niveau "exception produit" — seulement catégorie ou défaut du site :
  //   1. inventaire_seuils de la catégorie du produit, SI la clé y est
  //      réglée (une catégorie peut régler quantite_alerte sans régler
  //      valeur_alerte, et inversement — résolution par clé, pas par ligne
  //      entière).
  //   2. Sinon le défaut du site (station_config.parametres_inventaire.
  //      quantityAlertThreshold / .valueAlertThreshold, déjà existant).
  // ============================================================
  function seuilEcartEffectif(cle, categorieId, seuilsParCategorie, defautSite) {
    const parCategorie = categorieId && seuilsParCategorie ? seuilsParCategorie[categorieId] : null;
    const overrideCategorie = parCategorie && parCategorie[cle] != null ? parCategorie[cle] : null;
    return overrideCategorie != null ? overrideCategorie : defautSite;
  }

  // Hash déterministe simple (djb2) d'une chaîne — sert uniquement à graine
  // un PRNG, jamais de la cryptographie. Toujours le même résultat pour la
  // même chaîne, sur n'importe quelle machine (critère de recette INV2-04 :
  // un rechargement ne doit jamais changer les surprises).
  function hashDeterministe(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  // PRNG mulberry32 — déterministe, pas de dépendance externe. `seed` est un
  // entier 32 bits (issu de hashDeterministe). Retourne une fonction qui
  // produit des flottants [0,1) reproductibles pour une même graine.
  function prngDeterministe(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tire `n` éléments de `pool` (liste de produit_id) de façon déterministe
  // à partir de `seed`. Évite en priorité les produit_id de
  // `recemmentTires` (déjà tirés en surprise récemment, cahier §5.2 étape 6)
  // — mais ne bloque jamais le tirage si le pool restreint est trop petit
  // (Article 5 : jamais une exception plutôt qu'un résultat honnête).
  function tirerSurprisesDeterministe(pool, n, seed, recemmentTires) {
    if (!pool || !pool.length || n <= 0) return [];
    const recents = recemmentTires instanceof Set ? recemmentTires : new Set(recemmentTires || []);
    const poolPrefere = pool.filter(id => !recents.has(id));
    const source = poolPrefere.length >= n ? poolPrefere : pool.slice();
    // Fisher-Yates déterministe sur une copie, jamais l'ordre d'entrée brut
    // (sinon les N premiers produits du catalogue seraient toujours tirés).
    const rng = prngDeterministe(hashDeterministe(String(seed)));
    const copie = source.slice();
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie.slice(0, Math.min(n, copie.length));
  }

  // ------------------------------------------------------------
  // construirePlanComptage — cœur du Sprint 2. Reproduit l'algorithme du
  // cahier §5.2 en une seule passe déterministe :
  //  1-2-3. Critiques + coverage_gap + anomalie récente -> TOUJOURS inclus,
  //     jamais plafonnés (satisfait aussi l'étape 7 : aucune référence ne
  //     dépasse son délai maximum, même si le socle est déjà atteint).
  //  4. Complété avec le quota tournant (produits pas encore en retard,
  //     triés par ancienneté décroissante de contrôle) jusqu'au socle cible.
  //  5-6. Exactement N surprises tirées hors du plan déjà constitué,
  //     déterministe, en évitant les surprises trop récentes.
  //
  // Entrées : produits (array {id, actif, quarts_comptage éventuel via
  // regle}), reglesParProduit (map produit_id -> ligne inventaire_regles_
  // produit ou équivalent), dernierControleParProduit (map produit_id ->
  // ISO date/datetime du dernier contrôle physique, ou absent si jamais
  // contrôlé), produitsAvecAnomalieRecente (Set/array de produit_id),
  // quart, dateISO, socleCible, surprisesCible, seed (déterministe,
  // typiquement `${site}|${dateISO}|${quart}`), surprisesRecentesParProduit
  // (Set/array de produit_id tirés en surprise récemment).
  // ------------------------------------------------------------
  // File de recontrôle priorisée et plafonnée (21/08/2026, demande de
  // Frédéric après constat réel : sur le site pilote, 96 produits sur 112
  // avaient une anomalie ouverte dans les 7 derniers jours, faisant
  // exploser l'aperçu "Prochain inventaire" à 98 produits — "une
  // accumulation d'anomalies non critiques ne doit jamais rendre le
  // prochain inventaire interminable"). Choix pragmatique assumé, pas un
  // calcul scientifique (Article 5) : les anomalies critiques restent
  // toujours incluses, sans plafond — seules les non critiques sont
  // réparties dans le temps.
  const PLAFOND_ANOMALIES_NON_CRITIQUES_PAR_QUART_DEFAUT = 8;

  function construirePlanComptage({
    produits, reglesParProduit, dernierControleParProduit, produitsAvecAnomalieRecente,
    anomaliesDetailParProduit, plafondAnomaliesNonCritiques,
    quart, dateISO, socleCible, surprisesCible, seed, surprisesRecentesParProduit,
  }) {
    const regles = reglesParProduit || {};
    const dernierControle = dernierControleParProduit || {};
    const anomalies = produitsAvecAnomalieRecente instanceof Set
      ? produitsAvecAnomalieRecente : new Set(produitsAvecAnomalieRecente || []);
    const socle = Number.isFinite(socleCible) ? socleCible : 0;
    const surprisesN = Number.isFinite(surprisesCible) ? surprisesCible : 0;

    const eligibles = (produits || []).filter(p => p && p.actif !== false && produitEligibleQuart(regles[p.id], quart));

    const analyse = eligibles.map(p => {
      const regle = regles[p.id];
      const famille = (regle && regle.frequence_controle) || 'standard';
      const delaiMax = delaiMaxJours(regle);
      const dernier = dernierControle[p.id] || null;
      const joursDepuis = dernier ? joursEntreDates(dernier, dateISO) : null;
      const enRetard = joursDepuis == null || joursDepuis >= delaiMax;
      return { produit: p, famille, delaiMax, joursDepuis: joursDepuis == null ? Infinity : joursDepuis, enRetard, anomalieRecente: anomalies.has(p.id) };
    });

    const items = [];
    const dejaInclus = new Set();
    let ordre = 0;

    const ajouter = (a, raison) => {
      if (dejaInclus.has(a.produit.id)) return;
      dejaInclus.add(a.produit.id);
      items.push({ produit_id: a.produit.id, raison_selection: raison, obligatoire: true, ordre: ordre++ });
    };

    // 1. Critiques dus (toujours inclus, jamais plafonnés).
    analyse.filter(a => a.famille === 'critique' && a.enRetard).forEach(a => ajouter(a, 'critique'));

    // 3. Anomalie récente : priorisée en tant que déclencheur À PART ENTIÈRE
    // (cahier §5.2 étape 3, "OU confiance faible"), jamais un simple sous-cas
    // de coverage_gap — un produit récemment en écart doit être recontrôlé
    // même s'il vient d'être compté et n'est donc pas encore "en retard" par
    // le seul délai.
    if (anomaliesDetailParProduit) {
      // Comportement enrichi (21/08/2026) : la gravité de l'ANOMALIE elle-même
      // (pas la famille du produit) détermine si elle est plafonnée. Une
      // anomalie critique reste toujours incluse, illimité — seules les non
      // critiques sont triées (ancienneté d'abord, puis répétition) et
      // plafonnées par quart ; celles qui dépassent le plafond ne sont pas
      // perdues, simplement reportées : elles restent "ouvertes" en base et
      // seront reconsidérées au prochain appel tant qu'un recontrôle fiable
      // ne les résout pas.
      const detail = anomaliesDetailParProduit;
      const candidats = analyse.filter(a => a.famille !== 'critique' && detail[a.produit.id]);
      candidats
        .filter(a => detail[a.produit.id].graviteMax === 'critique')
        .forEach(a => ajouter(a, 'anomalie_recente'));
      const plafond = Number.isFinite(plafondAnomaliesNonCritiques)
        ? plafondAnomaliesNonCritiques : PLAFOND_ANOMALIES_NON_CRITIQUES_PAR_QUART_DEFAUT;
      candidats
        .filter(a => detail[a.produit.id].graviteMax !== 'critique')
        .map(a => {
          const d = detail[a.produit.id];
          const anciennete = d.plusAncienneCreeLe ? joursEntreDates(d.plusAncienneCreeLe, dateISO) : 0;
          return { a, anciennete: anciennete == null ? 0 : anciennete, occurrences: d.occurrences || 1 };
        })
        .sort((x, y) => (y.anciennete - x.anciennete) || (y.occurrences - x.occurrences))
        .slice(0, Math.max(0, plafond))
        .forEach(({ a }) => ajouter(a, 'anomalie_recente'));
    } else {
      // Comportement historique inchangé (aucun détail enrichi fourni) :
      // toutes les anomalies récentes incluses, illimité.
      analyse.filter(a => a.famille !== 'critique' && a.anomalieRecente).forEach(a => ajouter(a, 'anomalie_recente'));
    }

    // 2-7. Non-critiques en retard restants (délai dépassé, pas déjà inclus
    // ci-dessus, qu'ils aient ou non une anomalie associée — une anomalie
    // reportée par le plafond reste éligible ici si elle est également en
    // retard au sens du délai) — jamais plafonnés (étape 7).
    analyse
      .filter(a => a.famille !== 'critique' && a.enRetard && !dejaInclus.has(a.produit.id))
      .sort((a, b) => b.joursDepuis - a.joursDepuis)
      .forEach(a => ajouter(a, 'coverage_gap'));

    // 4. Compléter avec le quota tournant (pas encore en retard, les plus
    // proches de leur échéance en premier) jusqu'au socle cible.
    if (items.length < socle) {
      analyse
        .filter(a => !a.enRetard && !dejaInclus.has(a.produit.id))
        .sort((a, b) => b.joursDepuis - a.joursDepuis)
        .forEach(a => { if (items.length < socle) ajouter(a, 'quota_tournant'); });
    }

    // 5-6. Surprises : tirées parmi les produits éligibles NON déjà dans le
    // plan, déterministe (seed), en évitant les surprises trop récentes.
    const poolSurprises = eligibles.map(p => p.id).filter(id => !dejaInclus.has(id));
    const surprisesTirees = tirerSurprisesDeterministe(poolSurprises, surprisesN, seed, surprisesRecentesParProduit);
    surprisesTirees.forEach(id => {
      const a = analyse.find(x => x.produit.id === id);
      if (a) ajouter(a, 'surprise');
    });

    return {
      items,
      compteurs: {
        critique: items.filter(i => i.raison_selection === 'critique').length,
        coverage_gap: items.filter(i => i.raison_selection === 'coverage_gap').length,
        anomalie_recente: items.filter(i => i.raison_selection === 'anomalie_recente').length,
        quota_tournant: items.filter(i => i.raison_selection === 'quota_tournant').length,
        surprise: items.filter(i => i.raison_selection === 'surprise').length,
      },
    };
  }

  // Agrège les alertes ouvertes brutes par produit — gravité maximale
  // observée, date de la plus ancienne occurrence, nombre d'occurrences —
  // pour alimenter la file de recontrôle priorisée ci-dessus. Alertes déjà
  // résolues : à exclure AVANT l'appel (jamais recalculé ici, ce n'est
  // qu'une agrégation de ce qui est fourni, Article 11).
  function agregerAnomaliesParProduit(alertes) {
    const resultat = {};
    (alertes || []).forEach(a => {
      if (!a || !a.produit_id) return;
      const cur = resultat[a.produit_id] || { graviteMax: null, plusAncienneCreeLe: null, occurrences: 0 };
      cur.occurrences++;
      if (a.gravite === 'critique') cur.graviteMax = 'critique';
      else if (!cur.graviteMax) cur.graviteMax = a.gravite || 'attention';
      if (a.cree_le && (!cur.plusAncienneCreeLe || a.cree_le < cur.plusAncienneCreeLe)) cur.plusAncienneCreeLe = a.cree_le;
      resultat[a.produit_id] = cur;
    });
    return resultat;
  }

  // Point de référence "PRODUCTION_START" (21/08/2026, demande de Frédéric
  // suite à l'audit "Chaîne de données") : un contrôle physique antérieur
  // au cutover ne doit plus alimenter les indicateurs opérationnels
  // (couverture, sélection du prochain inventaire) — traité comme "jamais
  // contrôlé" plutôt qu'effacé (Article 5, rien n'est supprimé, seulement
  // exclu du calcul courant). Le cutover ne fabrique jamais un stock de
  // référence — uniquement un filtre temporel sur des données déjà réelles.
  function appliquerCutoverControles(dernierControleParProduit, cutoverDateHeureISO) {
    const source = dernierControleParProduit || {};
    if (!cutoverDateHeureISO) return source;
    const seuil = new Date(cutoverDateHeureISO).getTime();
    if (!Number.isFinite(seuil)) return source;
    const resultat = {};
    Object.keys(source).forEach(produitId => {
      const dernier = source[produitId];
      const t = dernier ? new Date(dernier).getTime() : NaN;
      if (Number.isFinite(t) && t >= seuil) resultat[produitId] = dernier;
    });
    return resultat;
  }

  // ============================================================
  // Sprint 3 — Total produit : agrégation dépôt/boutique (cahier §9).
  // `inventaire_comptages` porte déjà quantite (total) ET quantite_depot/
  // quantite_boutique sur la MÊME ligne (vérifié le 17/08/2026) — ce moteur
  // ne fait donc que formuler la preuve, jamais un second calcul du total
  // (Article 11 : la somme est déjà faite côté écran employé au moment de
  // la saisie, ce moteur sert la lecture manager après coup).
  // ============================================================

  function libelleTotalProduit(comptage) {
    if (!comptage) return null;
    const depot = comptage.quantite_depot;
    const boutique = comptage.quantite_boutique;
    if (depot == null && boutique == null) return `Total observé : ${comptage.quantite}`;
    const d = depot != null ? depot : 0;
    const b = boutique != null ? boutique : 0;
    return `Dépôt ${d} + Boutique ${b} = Total ${comptage.quantite}`;
  }

  // ============================================================
  // Sprint 5 — Decenium sans API : rapprochement différé + couverture
  // (cahier §8, §11, INV2-12, INV2-18). Reprend l'écoulement physique déjà
  // calculé côté Manager (ouverture - clôture + mouvements signés,
  // calculerEcoulementPhysiqueQuart dans NEXUS-Inventaire-Manager-v1.html —
  // jamais un second calcul ici, ce moteur ne fait QUE qualifier le
  // résultat et mesurer la couverture, Article 11).
  // ============================================================

  // Doctrine du cahier §8.3/§12 : "La V1 doit préférer non comparable à un
  // faux écart." Un produit sans comptage d'ouverture ET de clôture sur le
  // quart ne peut STRUCTURELLEMENT pas avoir d'écoulement physique — le
  // rapprochement reste non_comparable plutôt que d'afficher un écart
  // inventé. Une fois l'écoulement connu, le rapprochement contre les
  // ventes Decenium importées est fiable (le fichier ne peut être importé
  // qu'après coup, source distincte, jamais partiel sur une seule ligne).
  function qualiteRapprochementProduit(ecoulementPhysique, ventesDecenium) {
    if (ecoulementPhysique === null || ecoulementPhysique === undefined) return 'non_comparable';
    if (ventesDecenium === null || ventesDecenium === undefined) return 'provisoire';
    return 'fiable';
  }

  const LIBELLE_QUALITE_RAPPROCHEMENT = {
    fiable: 'Fiable',
    provisoire: 'Provisoire — rapprochement en attente',
    non_comparable: 'Non comparable — comptage manquant',
  };

  function libelleQualiteRapprochement(statut) {
    return LIBELLE_QUALITE_RAPPROCHEMENT[statut] || 'Statut inconnu';
  }

  // Synthèse qualité (cahier §11, bloc manager "Qualité : Fiable /
  // provisoire / non comparable") : agrège les lignes déjà persistées dans
  // inventaire_rapprochements (Sprint 5) par statut_validation — jamais un
  // second calcul de la qualité elle-même, uniquement un comptage de ce que
  // qualiteRapprochementProduit a déjà décidé au moment de l'import.
  function syntheseQualiteRapprochements(rapprochements) {
    const lignes = rapprochements || [];
    const compte = { fiable: 0, provisoire: 0, non_comparable: 0 };
    lignes.forEach(r => {
      const statut = r && r.statut_validation;
      if (compte[statut] !== undefined) compte[statut]++;
    });
    return {
      total: lignes.length, fiable: compte.fiable, provisoire: compte.provisoire,
      nonComparable: compte.non_comparable,
      toutFiable: lignes.length > 0 && compte.fiable === lignes.length,
    };
  }

  // Couverture physique 7/14/30 jours (cahier §11 "Couverture physique",
  // INV2-18) : proportion du catalogue actif réellement observé (comptage
  // physique, tout type confondu) dans la fenêtre. Un produit jamais
  // contrôlé (absent de dernierControleParProduit) compte comme non
  // observé, jamais comme une donnée manquante silencieuse (doctrine
  // §2 "donnée manquante = contrôle provisoire, jamais faux écart" —
  // appliquée ici à la couverture : il apparaît explicitement en retard).
  function couverturePhysique({ produitsActifs, dernierControleParProduit, dateISO, fenetreJours }) {
    const dernier = dernierControleParProduit || {};
    const produits = produitsActifs || [];
    const enRetard = [];
    let observes = 0;
    produits.forEach(p => {
      const dernierControle = dernier[p.id] || null;
      const joursDepuis = dernierControle ? joursEntreDates(dernierControle, dateISO) : null;
      const estObserve = joursDepuis != null && joursDepuis <= fenetreJours;
      if (estObserve) observes++;
      else enRetard.push(p.id);
    });
    const total = produits.length;
    return {
      total, observes, enRetard,
      pourcentage: total > 0 ? Math.round((observes / total) * 1000) / 10 : null,
    };
  }

  // ============================================================
  // Sprint 6 — Chaîne : recalcul, alertes résolues, jamais un effacement
  // silencieux (cahier §13 "Alertes dynamiques", INV2-13). Avant ce sprint,
  // comparerVentesQuart (NEXUS-Inventaire-Manager-v1.html) supprimait
  // purement et simplement toutes les alertes démarque encore ouvertes du
  // quart avant d'en réinsérer de nouvelles à chaque réimport — un écart
  // qui disparaissait au réimport perdait toute trace (violant "une
  // anomalie résolue sort des alertes actives mais reste dans
  // l'historique", INV2-13, et "Export importé plus tard -> Recalcul", pas
  // "Export importé plus tard -> table rasée"). Ce moteur calcule le
  // diff : les alertes dont le produit n'a plus d'écart exploitable
  // deviennent résolues (jamais supprimées), celles dont le produit a
  // toujours un écart sont mises à jour en place (préserve assignee_a/
  // vue_par/cree_le — pas une nouvelle ligne), et seuls les produits
  // réellement nouveaux en écart déclenchent une insertion.
  // ============================================================

  function reconciliationAlertesDemarque({ alertesOuvertesExistantes, ecartsAuDessusSeuil }) {
    const existantes = alertesOuvertesExistantes || [];
    const ecarts = ecartsAuDessusSeuil || [];
    const ecartParProduit = new Map(ecarts.map(e => [e.produit_id, e]));
    const produitsAvecAlerteExistante = new Set(existantes.map(a => a.produit_id));

    const aResoudre = existantes
      .filter(a => !ecartParProduit.has(a.produit_id))
      .map(a => a.id);

    const aMettreAJour = existantes
      .filter(a => ecartParProduit.has(a.produit_id))
      .map(a => {
        const e = ecartParProduit.get(a.produit_id);
        return {
          id: a.id, valeur_attendue: e.valeur_attendue, valeur_constatee: e.valeur_constatee,
          valeur_estimee: e.valeur_estimee != null ? e.valeur_estimee : null,
          gravite: e.gravite,
        };
      });

    const aCreer = ecarts.filter(e => !produitsAvecAlerteExistante.has(e.produit_id));

    return { aResoudre, aMettreAJour, aCreer };
  }

  // ============================================================
  // Sprint 8 — Adoption : mesure papier/NEXUS + rapport temps/gestes
  // (cahier §16, INV2-19 "Les mesures de temps/taps sont enregistrées sans
  // action supplémentaire"). Ce moteur ne calcule qu'à partir de données
  // déjà persistées automatiquement : ouvert_le/cloture_le existent depuis
  // toujours sur inventaire_quarts, nexus_taps_total/nexus_interruptions_
  // total sont posés par NEXUS-Inventaire-v1.html à des points de geste
  // déjà existants (jamais un nouvel événement synthétique), et
  // papier_temps_minutes/papier_produits_comptes/papier_corrections/
  // nexus_temps_minutes/is_simulation sont saisis manuellement, après coup,
  // par un manager via l'onglet "Simulation" de
  // NEXUS-Parametres-Inventaire-v1.html — jamais une évaluation employé (la
  // feuille papier reste la référence officielle tant que le pilote n'a pas
  // conclu, cahier §16 tâche 35 "Étendre seulement si NEXUS est au moins
  // aussi rapide que le papier").
  // ============================================================

  // Durée automatique d'une session NEXUS (18/08/2026, Sprint 8) — dérivée
  // d'ouvert_le/cloture_le, jamais une colonne dupliquée (Article 11 : ces
  // deux timestamps existent déjà sur inventaire_quarts pour tout quart réel
  // ou simulé). Retourne null si l'un des deux horodatages manque ou si
  // cloture_le n'est pas postérieur à ouvert_le (donnée corrompue plutôt
  // qu'une durée négative fabriquée — Article 5).
  function dureeSessionAutomatiqueMinutes(ouvertLe, clotureLe) {
    if (!ouvertLe || !clotureLe) return null;
    const debut = new Date(ouvertLe).getTime();
    const fin = new Date(clotureLe).getTime();
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return null;
    return Math.round(((fin - debut) / 60000) * 10) / 10;
  }

  // Synthèse d'un quart pour la comparaison Papier/NEXUS (18/08/2026,
  // Sprint 8) : combine les valeurs papier saisies manuellement (référence
  // officielle) avec le temps NEXUS — priorité à la durée automatique
  // (ouvert_le/cloture_le, un quart réel travaillé normalement) et repli sur
  // nexus_temps_minutes (le chronomètre manuel de l'onglet Simulation) s'il
  // n'y a pas encore de clôture automatique, jamais l'inverse (l'automatique
  // est toujours la source la plus honnête quand elle existe). `gainMinutes`
  // reste null tant que l'une des deux durées manque — jamais un gain
  // inventé à partir d'une seule mesure (Article 5).
  function syntheseComparaisonAdoption(quart) {
    if (!quart) return null;
    const nexusTempsAuto = dureeSessionAutomatiqueMinutes(quart.ouvert_le, quart.cloture_le);
    const nexusTemps = nexusTempsAuto != null ? nexusTempsAuto
      : (quart.nexus_temps_minutes != null ? quart.nexus_temps_minutes : null);
    const papierTemps = quart.papier_temps_minutes != null ? quart.papier_temps_minutes : null;
    const gainMinutes = (papierTemps != null && nexusTemps != null)
      ? Math.round((papierTemps - nexusTemps) * 10) / 10 : null;
    return {
      papierTempsMinutes: papierTemps,
      papierProduitsComptes: quart.papier_produits_comptes != null ? quart.papier_produits_comptes : null,
      papierCorrections: quart.papier_corrections != null ? quart.papier_corrections : null,
      nexusTempsMinutes: nexusTemps,
      nexusTempsAutomatique: nexusTempsAuto != null,
      nexusTapsTotal: quart.nexus_taps_total != null ? quart.nexus_taps_total : null,
      nexusInterruptionsTotal: quart.nexus_interruptions_total != null ? quart.nexus_interruptions_total : null,
      gainMinutes,
    };
  }

  // Agrégat multi-quarts pour le tableau de bord manager (18/08/2026,
  // Sprint 8) — remplace le calcul de moyennes qui vivait directement dans
  // NEXUS-Parametres-Inventaire-v1.html (Article 11 : une seule fonction,
  // testable, réutilisée partout où une synthèse Papier/NEXUS est affichée).
  function moyenneSyntheseAdoption(quarts) {
    const lignes = (quarts || []).map(syntheseComparaisonAdoption).filter(Boolean);
    const moyenne = (valeurs) => {
      const v = valeurs.filter(x => x != null);
      return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
    };
    const tempsMoyenPapier = moyenne(lignes.map(l => l.papierTempsMinutes));
    const tempsMoyenNexus = moyenne(lignes.map(l => l.nexusTempsMinutes));
    return {
      nb: lignes.length,
      tempsMoyenPapier, tempsMoyenNexus,
      correctionsMoyennes: moyenne(lignes.map(l => l.papierCorrections)),
      tapsMoyens: moyenne(lignes.map(l => l.nexusTapsTotal)),
      interruptionsMoyennes: moyenne(lignes.map(l => l.nexusInterruptionsTotal)),
      gainMoyenMinutes: (tempsMoyenPapier != null && tempsMoyenNexus != null)
        ? Math.round((tempsMoyenPapier - tempsMoyenNexus) * 10) / 10 : null,
      nbAvecComparatif: lignes.filter(l => l.papierTempsMinutes != null).length,
    };
  }

  // ============================================================
  // Production journalière (18/08/2026, cahier "Audit Inventaire -
  // Production, mouvements & réceptions") — M2 : moteur de recommandation de
  // préparation (§4). Déterministe, sans IA, sans dépendance réseau (ce
  // moteur ne fait QUE calculer à partir de données déjà chargées).
  // ============================================================

  const LIBELLE_CONTEXTE_JOUR = {
    special: 'Règle spéciale du jour', vacances: 'Vacances scolaires', ferie: 'Jour férié',
    samedi: 'Samedi', dimanche: 'Dimanche', semaine: 'Jour de semaine',
  };
  function libelleContexteJour(contexte) { return LIBELLE_CONTEXTE_JOUR[contexte] || 'Jour de semaine'; }

  // Jour calendaire pur (samedi/dimanche/semaine), sans tenir compte du
  // calendrier vacances/férié du site (traité séparément, priorité au-dessus
  // — §4.1 étapes 2-3). Lecture en UTC pour rester déterministe quel que
  // soit le fuseau du navigateur (même logique que joursEntreDates).
  function contexteCalendaireJour(dateISO) {
    const jour = new Date(String(dateISO).slice(0, 10) + 'T12:00:00Z').getUTCDay();
    if (jour === 6) return 'samedi';
    if (jour === 0) return 'dimanche';
    return 'semaine';
  }

  function valeurOuNull(v) { return (v === null || v === undefined) ? null : v; }

  // Priorité §4.1 : 1. valeur spéciale explicite (produit+date) -> 2.
  // vacances/férié configuré au niveau du site -> 3. week-end -> 4. jour de
  // semaine. Le cahier mentionne une 5e priorité "valeur par défaut du
  // produit" mais §12 ne configure qu'un seul champ hebdomadaire
  // (valeur_semaine) : il n'existe pas de 6e nombre à inventer ici (Article
  // 5) — la semaine EST la valeur par défaut. Si `regle` est absent ou que
  // le champ visé n'est pas renseigné, quantiteConseillee reste null : "pas
  // de recommandation configurée" doit rester distinct de "recommandation
  // = 0".
  function calculerRecommandationPreparation({ dateISO, regle, valeurSpeciale, jourCalendrierSite }) {
    const regleId = regle ? regle.id : null;
    if (valeurSpeciale) {
      return { contexte: 'special', quantiteConseillee: valeurOuNull(valeurSpeciale.valeur), regleId };
    }
    if (jourCalendrierSite) {
      const contexte = jourCalendrierSite.type === 'ferie' ? 'ferie' : 'vacances';
      return { contexte, quantiteConseillee: regle ? valeurOuNull(regle.valeur_vacances) : null, regleId };
    }
    const jour = contexteCalendaireJour(dateISO);
    if (jour === 'samedi') return { contexte: 'samedi', quantiteConseillee: regle ? valeurOuNull(regle.valeur_samedi) : null, regleId };
    if (jour === 'dimanche') return { contexte: 'dimanche', quantiteConseillee: regle ? valeurOuNull(regle.valeur_dimanche) : null, regleId };
    return { contexte: 'semaine', quantiteConseillee: regle ? valeurOuNull(regle.valeur_semaine) : null, regleId };
  }

  // Signal simple pour la lecture manager future (§13 "Reste final élevé
  // plusieurs samedis -> Surproduction probable") : le reste dépasse-t-il le
  // seuil de surveillance configuré par le manager (§12) ? null tant que
  // l'un des deux nombres manque (jamais un jugement sur une donnée
  // absente).
  function resteDepasseSeuilSurveillance(restePhysique, seuil) {
    if (restePhysique === null || restePhysique === undefined) return null;
    if (seuil === null || seuil === undefined) return null;
    return restePhysique > seuil;
  }

  // ============================================================
  // Production journalière — M5 : calcul pâtisserie (§3.1). Ne confond
  // jamais recommandation et fait (§3.2) : ces fonctions ne consomment QUE
  // des quantités réelles (préparation confirmée, fournées, reste physique
  // compté) -- jamais quantiteConseillee.
  // ============================================================

  function sommeMouvementsProduction(mouvements) {
    return (mouvements || []).reduce((s, m) => s + (Number(m && m.quantite) || 0), 0);
  }

  // apportInitial : Q1 = préparation réellement mise au four
  // (production_initiale.quantite) ; Q2 = reste transmis du Q1 -- déjà
  // fourni par le mécanisme type_comptage='transmis' existant (Article 11,
  // ce moteur ne le recalcule jamais, il le reçoit en entrée).
  function disponibleQuartProduction({ apportInitial, fourneesQuart }) {
    if (apportInitial === null || apportInitial === undefined) return null;
    return apportInitial + sommeMouvementsProduction(fourneesQuart);
  }

  // Écoulement = disponible - reste physique compté. null tant que le reste
  // physique n'est pas connu (Article 5 : jamais un faux écart avant
  // clôture réelle du quart).
  function ecoulementQuartProduction(disponible, restePhysique) {
    if (disponible === null || disponible === undefined) return null;
    if (restePhysique === null || restePhysique === undefined) return null;
    return disponible - restePhysique;
  }

  // Synthèse journée complète (§3.1 "Journée", §10 "Lecture NEXUS") : pour
  // la vue manager (chronologie produit + résumé production/écoulement).
  function syntheseProductionJournee({ prepInitiale, fourneesQ1, resteFinQ1, fourneesQ2, resteFinal, retraitsTraces }) {
    const disponibleQ1 = disponibleQuartProduction({ apportInitial: prepInitiale, fourneesQuart: fourneesQ1 });
    const ecoulementQ1 = ecoulementQuartProduction(disponibleQ1, resteFinQ1);
    const apportQ2 = (resteFinQ1 === undefined) ? null : resteFinQ1;
    const disponibleQ2 = disponibleQuartProduction({ apportInitial: apportQ2, fourneesQuart: fourneesQ2 });
    const ecoulementQ2 = ecoulementQuartProduction(disponibleQ2, resteFinal);
    const productionTotale = (prepInitiale === null || prepInitiale === undefined) ? null
      : prepInitiale + sommeMouvementsProduction(fourneesQ1) + sommeMouvementsProduction(fourneesQ2);
    const retraits = Number(retraitsTraces) || 0;
    const ecoulementJournee = (productionTotale === null || resteFinal === null || resteFinal === undefined)
      ? null : productionTotale - resteFinal - retraits;
    return {
      disponibleQ1, ecoulementQ1, disponibleQ2, ecoulementQ2, productionTotale, ecoulementJournee,
      nbFourneesSupplementaires: (fourneesQ1 || []).length + (fourneesQ2 || []).length,
    };
  }

  // ============================================================
  // M8 — Analyse : conseillé vs préparé vs écoulé (fondations, 19/08/2026).
  // Compare ce que NEXUS a recommandé (M2, calculerRecommandationPreparation)
  // à ce qui a réellement été préparé et écoulé (M5/M7, syntheseProduction
  // Journee) — fondations seulement : classification pure à partir de
  // valeurs déjà calculées ailleurs, jamais un second calcul du conseillé,
  // du préparé ou de l'écoulé ici (Article 11). Écran manager dédié laissé
  // pour un sprint ultérieur si Frédéric le demande ; ce sprint pose le
  // moteur de comparaison + son chargeur (nexus-inventaire-production-
  // donnees.js::chargerAnalyseConseillePrepareEcoule).
  // ============================================================

  // Tolérance par défaut : un écart de préparation dans cette fourchette
  // (±15% du conseillé, ou ±1 unité si le conseillé est petit/nul) est
  // considéré "conforme" — jamais un seuil à 0% qui signalerait en rouge
  // la moindre variation normale (pâte qui lève différemment, etc.).
  const TOLERANCE_ECART_PREPARATION_RATIO = 0.15;
  const TOLERANCE_ECART_PREPARATION_MIN = 1;

  // Seuil "reste notable" : au-delà de 20% du préparé non écoulé, le
  // produit mérite un signalement (surproduction récurrente, ou casse/
  // périmé non tracés) — sous ce seuil, un reste résiduel est normal et
  // attendu (une préparation pile-poil sans aucune marge serait suspecte).
  const SEUIL_RESTE_NOTABLE_RATIO = 0.20;

  function toleranceEcartPreparation(conseille) {
    if (conseille === null || conseille === undefined) return TOLERANCE_ECART_PREPARATION_MIN;
    return Math.max(TOLERANCE_ECART_PREPARATION_MIN, Math.abs(conseille) * TOLERANCE_ECART_PREPARATION_RATIO);
  }

  // Compare le conseillé (M2) au préparé réel (M5/M7) pour UNE journée (un
  // produit, une date). Une valeur manquante -> statut dédié, jamais un
  // écart inventé (Article 5).
  function analyserPreparationVsConseil({ conseille, prepare }) {
    if (conseille === null || conseille === undefined) return { ecart: null, ecartRatio: null, statut: 'sans_recommandation' };
    if (prepare === null || prepare === undefined) return { ecart: null, ecartRatio: null, statut: 'preparation_inconnue' };
    const ecart = prepare - conseille;
    const ecartRatio = conseille !== 0 ? ecart / conseille : (ecart === 0 ? 0 : null);
    const tolerance = toleranceEcartPreparation(conseille);
    let statut;
    if (Math.abs(ecart) <= tolerance) statut = 'conforme';
    else if (ecart > 0) statut = 'sur_preparation';
    else statut = 'sous_preparation';
    return { ecart, ecartRatio, statut };
  }

  // Compare le préparé à l'écoulé (M5/M7) — le "reste non écoulé", jamais
  // qualifié de "perte" : une part peut être légitimement transmise/vendue
  // plus tard, ce moteur ne tranche jamais entre les deux sans donnée de
  // transmission (Article 5, ne jamais fabriquer une conclusion non prouvée).
  function analyserEcoulementVsPreparation({ prepare, ecoule }) {
    if (prepare === null || prepare === undefined) return { reste: null, resteRatio: null, statut: 'sans_donnee' };
    if (ecoule === null || ecoule === undefined) return { reste: null, resteRatio: null, statut: 'ecoulement_inconnu' };
    const reste = prepare - ecoule;
    const resteRatio = prepare !== 0 ? reste / prepare : (reste === 0 ? 0 : null);
    const statut = (resteRatio !== null && resteRatio > SEUIL_RESTE_NOTABLE_RATIO) ? 'reste_notable' : 'ecoule';
    return { reste, resteRatio, statut };
  }

  // Assemble les deux comparaisons pour une journée — une seule fonction
  // publique consommée par la colle Supabase, jamais deux appels dupliqués
  // côté appelant.
  function analyserJourneeProduction({ conseille, prepare, ecoule }) {
    return {
      preparation: analyserPreparationVsConseil({ conseille, prepare }),
      ecoulement: analyserEcoulementVsPreparation({ prepare, ecoule }),
    };
  }

  // Synthèse sur une période (plusieurs journées, un produit) : compte les
  // jours conformes/sur-préparés/sous-préparés et l'écart moyen — UNIQUEMENT
  // sur les jours réellement comparables (ni "sans_recommandation" ni
  // "preparation_inconnue"), jamais une moyenne polluée par des jours sans
  // donnée.
  function syntheseAnalysePeriode(lignes) {
    const comparables = (lignes || []).filter(l => l.preparation && l.preparation.statut !== 'sans_recommandation' && l.preparation.statut !== 'preparation_inconnue');
    const nbConforme = comparables.filter(l => l.preparation.statut === 'conforme').length;
    const nbSurPreparation = comparables.filter(l => l.preparation.statut === 'sur_preparation').length;
    const nbSousPreparation = comparables.filter(l => l.preparation.statut === 'sous_preparation').length;
    const nbResteNotable = (lignes || []).filter(l => l.ecoulement && l.ecoulement.statut === 'reste_notable').length;
    const ecartMoyen = comparables.length
      ? comparables.reduce((s, l) => s + Math.abs(l.preparation.ecart), 0) / comparables.length
      : null;
    return {
      nbJours: (lignes || []).length, nbJoursComparables: comparables.length,
      nbConforme, nbSurPreparation, nbSousPreparation, nbResteNotable, ecartMoyen,
    };
  }

  // ============================================================
  // Mouvements — M3/M8 : registre unique des types (§8, §8.1, §11.1). Avant
  // ce lot, NEXUS-Inventaire-Manager-v1.html gardait sa propre liste
  // (TYPES_MOUVEMENT_MANAGER) avec des valeurs absentes du CHECK réel de
  // inventaire_mouvements.type_mouvement ('transfert_recu', 'retour_recu',
  // 'produit_abime', 'perime', 'retrait_interne', 'retour_fournisseur') --
  // tout mouvement rétroactif utilisant l'une d'elles aurait échoué en
  // base (contrainte violée). Ce registre devient la SEULE source de vérité
  // (Article 11), consommée par l'écran employé (+ Mouvement) ET l'écran
  // manager (mouvement oublié) — plus jamais deux listes divergentes.
  // ============================================================

  const TYPES_MOUVEMENT = [
    { value: 'livraison', label: 'Marchandise reçue', sens: 'entrant', impactStockGlobal: true },
    { value: 'reassort', label: 'Réassort depuis la réserve', sens: 'entrant', impactStockGlobal: true },
    { value: 'production_initiale', label: 'Préparation initiale', sens: 'entrant', impactStockGlobal: true },
    { value: 'production_additionnelle', label: 'Nouvelle préparation', sens: 'entrant', impactStockGlobal: true },
    { value: 'casse', label: 'Produit cassé / abîmé', sens: 'sortant', impactStockGlobal: true },
    { value: 'retour', label: 'Retour fournisseur', sens: 'sortant', impactStockGlobal: true },
    { value: 'retrait', label: 'Retrait interne', sens: 'sortant', impactStockGlobal: true },
    { value: 'transfert', label: 'Déplacé dépôt / boutique', sens: 'neutre', impactStockGlobal: false },
    { value: 'autre', label: 'Autre mouvement', sens: 'sortant', impactStockGlobal: true },
  ];
  const TYPE_MOUVEMENT_PAR_VALEUR = TYPES_MOUVEMENT.reduce((m, t) => { m[t.value] = t; return m; }, {});
  function infoTypeMouvement(typeMouvement) { return TYPE_MOUVEMENT_PAR_VALEUR[typeMouvement] || null; }
  function libelleTypeMouvement(typeMouvement) { const t = infoTypeMouvement(typeMouvement); return t ? t.label : 'Mouvement'; }
  // §8.1 : "Le moteur doit distinguer impact_stock_global et
  // impact_localisation." Défaut true (jamais 'transfert') si le type est
  // inconnu -- plus prudent qu'un faux neutre sur un mouvement mal formé.
  function mouvementImpacteStockGlobal(typeMouvement) {
    const t = infoTypeMouvement(typeMouvement);
    return t ? t.impactStockGlobal : true;
  }

  // §5 : actions proposées par le bouton "+ Ajouter un mouvement" selon le
  // profil du produit -- jamais 'production_initiale' ici (créée par le
  // parcours Q1 dédié, §3/§6, pas par ce bouton générique). Profil inconnu
  // ou non configuré retombe sur le comportement 'continu' historique
  // (Article 5 : jamais un bouton qui bloque faute de profil reconnu).
  const ACTIONS_MOUVEMENT_PAR_PROFIL = {
    production_journaliere: ['production_additionnelle', 'retrait', 'retour', 'casse'],
    continu: ['livraison', 'casse', 'retour', 'transfert', 'reassort'],
    cycle_journalier: ['livraison', 'casse', 'retour', 'transfert', 'reassort'],
    presse: ['livraison', 'retour', 'casse'],
    lot_glissant: ['livraison', 'retour', 'retrait'],
    consommable: ['livraison', 'retrait'],
  };
  function actionsMouvementPourProfil(profil) {
    const types = ACTIONS_MOUVEMENT_PAR_PROFIL[profil] || ACTIONS_MOUVEMENT_PAR_PROFIL.continu;
    return types.map(v => infoTypeMouvement(v)).filter(Boolean);
  }

  // "Tester ma configuration" (21/08/2026, cahier UX de Frédéric —
  // "Vérifier les produits sans emplacement ou sans règle... Afficher un
  // verdict : Configuration exploitable / À corriger"). Vérifications
  // RÉELLES sur les données déjà chargées côté écran Paramètres — pas une
  // simulation complète d'un Q1/Q2 en base (ça resterait à construire
  // séparément si le besoin se confirme), mais des contrôles de cohérence
  // concrets et vérifiables, jamais un verdict de façade (Article 5).
  function evaluerConfigurationInventaire(ctx) {
    const produits = (ctx && ctx.produits) || [];
    const categories = (ctx && ctx.categories) || [];
    const produitsProduction = (ctx && ctx.produitsProduction) || [];
    const reglesProductionMap = (ctx && ctx.reglesProductionMap) || {};
    const actifs = produits.filter(p => p.actif);
    const problemes = [];

    const sansCategorie = actifs.filter(p => !p.categorie_id);
    if (sansCategorie.length) problemes.push({
      code: 'produits_sans_categorie', gravite: 'a_corriger', nb: sansCategorie.length,
      message: `${sansCategorie.length} produit${sansCategorie.length > 1 ? 's' : ''} actif${sansCategorie.length > 1 ? 's' : ''} sans catégorie — n'hérite${sansCategorie.length > 1 ? 'nt' : ''} jamais d'une règle commune.`,
    });

    const sansEmplacement = actifs.filter(p => !p.zone_id);
    if (sansEmplacement.length) problemes.push({
      code: 'produits_sans_emplacement', gravite: 'a_corriger', nb: sansEmplacement.length,
      message: `${sansEmplacement.length} produit${sansEmplacement.length > 1 ? 's' : ''} actif${sansEmplacement.length > 1 ? 's' : ''} sans emplacement de comptage (dépôt/boutique) — l'employé ne saura pas où le${sansEmplacement.length > 1 ? 's' : ''} compter.`,
    });

    const idsCategoriesUtilisees = new Set(actifs.map(p => p.categorie_id).filter(Boolean));
    const categoriesOrphelines = categories.filter(c => !idsCategoriesUtilisees.has(c.id));
    if (categoriesOrphelines.length) problemes.push({
      code: 'categories_orphelines', gravite: 'info', nb: categoriesOrphelines.length,
      message: `${categoriesOrphelines.length} catégorie${categoriesOrphelines.length > 1 ? 's' : ''} configurée${categoriesOrphelines.length > 1 ? 's' : ''} sans aucun produit actif rattaché.`,
    });

    const productionSansQuantites = produitsProduction.filter(p => {
      const r = reglesProductionMap[p.id];
      return !r || (r.valeur_semaine == null && r.valeur_samedi == null && r.valeur_dimanche == null && r.valeur_vacances == null);
    });
    if (productionSansQuantites.length) problemes.push({
      code: 'production_sans_quantites', gravite: 'a_corriger', nb: productionSansQuantites.length,
      message: `${productionSansQuantites.length} produit${productionSansQuantites.length > 1 ? 's' : ''} en production journalière sans aucune quantité conseillée renseignée — l'employé n'aura aucune recommandation au Quart 1.`,
    });

    const verdict = problemes.some(p => p.gravite === 'a_corriger') ? 'a_corriger' : 'exploitable';
    return { problemes, verdict };
  }

  // Retour de Frédéric (21/08/2026) sur l'écran d'accueil : "0 catégorie
  // avec règle commune / 52 exceptions... donne l'impression que la
  // configuration est très fragmentée. Je ferais remonter une
  // recommandation NEXUS." Détecte les catégories qui ont plusieurs
  // produits réglés INDIVIDUELLEMENT (une ligne inventaire_regles_produit
  // propre) alors qu'aucune règle commune n'est activée pour la catégorie
  // — exactement le scénario que l'inhéritage Site → Catégorie → Produit
  // (Sprint 1-2) a été construit pour éviter, mais que rien ne signalait au
  // manager jusqu'ici. `seuilExceptions` est un choix pragmatique assumé,
  // pas un calcul scientifique (Article 5) : en dessous, une poignée
  // d'exceptions ponctuelles est normale et ne mérite pas d'alerte.
  function identifierCategoriesAOptimiser(categories, produits, reglesProduitMap, seuilExceptions) {
    const seuil = Number.isFinite(seuilExceptions) ? seuilExceptions : 3;
    const regles = reglesProduitMap || {};
    const actifs = (produits || []).filter(p => p.actif);
    const resultat = [];
    (categories || []).forEach(c => {
      if (c.regle_active) return; // déjà consolidée, rien à suggérer
      const produitsCategorie = actifs.filter(p => p.categorie_id === c.id);
      const exceptions = produitsCategorie.filter(p => !!regles[p.id]).length;
      if (exceptions >= seuil) resultat.push({ categorieId: c.id, nom: c.nom, exceptions, total: produitsCategorie.length });
    });
    return resultat.sort((a, b) => b.exceptions - a.exceptions);
  }

  // Retour de Frédéric (21/08/2026) : "Prochain inventaire : 24 produits ·
  // ~7 min... c'est ce qui permettra au manager de voir immédiatement
  // l'impact réel de sa configuration sur les employés." Estimation RÉELLE
  // à partir de l'historique effectif des quarts déjà clôturés sur ce site
  // (jamais un chiffre inventé) : `historiqueQuarts` doit être une liste de
  // { ouvertLe, clotureLe, nbProduitsComptes } déjà préparée côté appelant
  // (lecture pure ici, Article 11). Hypothèse assumée et documentée : le
  // temps évolue linéairement avec le nombre de produits (secondes/produit
  // constantes) — une approximation, pas une mesure directe du prochain
  // quart, mais bien réelle et vérifiable, pas une estimation de façade.
  // Retourne `null` si l'historique est trop mince (< 3 quarts exploitables)
  // : mieux vaut ne rien afficher qu'un chiffre non fiable (Article 5).
  const HISTORIQUE_MINIMAL_ESTIMATION_TEMPS = 3;
  function estimerTempsProchainInventaire(historiqueQuarts, nbProduitsEstimes) {
    if (!Number.isFinite(nbProduitsEstimes) || nbProduitsEstimes <= 0) return null;
    const exploitables = (historiqueQuarts || [])
      .map(q => {
        const duree = dureeSessionAutomatiqueMinutes(q.ouvertLe, q.clotureLe);
        const nb = q.nbProduitsComptes;
        if (duree == null || !Number.isFinite(nb) || nb <= 0) return null;
        return (duree * 60) / nb; // secondes par produit, ce quart-ci
      })
      .filter(x => x != null);
    if (exploitables.length < HISTORIQUE_MINIMAL_ESTIMATION_TEMPS) return null;
    const secParProduitMoyen = exploitables.reduce((s, x) => s + x, 0) / exploitables.length;
    const minutesEstimees = Math.round(((secParProduitMoyen * nbProduitsEstimes) / 60) * 10) / 10;
    return { minutesEstimees, nbQuartsHistorique: exploitables.length, secParProduitMoyen: Math.round(secParProduitMoyen * 10) / 10 };
  }

  // Bloc "État de confiance" (audit développeur "NEXUS Inventaire Produit —
  // Chaîne de données", 21/08/2026, §7.1 "Bloc 1" + §8.1 "Cycle de maturité
  // visible") : un badge honnête de maturité de la chaîne de contrôle
  // Inventaire, jamais un indicateur de fiabilité fabriqué. Chaque niveau ne
  // peut être atteint que si le niveau précédent est réellement observé
  // dans des données déjà chargées ailleurs sur cet écran (Article 11 —
  // aucune nouvelle source de vérité : couverturePhysique ci-dessus,
  // Sprint 5 ; import/rapprochement Decenium persistés, Sprint 5/7).
  // SEUIL_COUVERTURE_BASE_PHYSIQUE=80 : choix pragmatique assumé pour
  // distinguer "on commence à compter" de "la base terrain est
  // suffisamment large pour être comparée à une théorie" — ce n'est pas un
  // calcul scientifique (Article 5), documenté comme tel.
  const SEUIL_COUVERTURE_BASE_PHYSIQUE_MATURITE = 80;
  const LIBELLE_MATURITE_INVENTAIRE = {
    initialisation: 'Initialisation',
    observation_terrain: 'Observation terrain',
    base_physique_en_construction: 'Base physique en construction',
    rapprochement_provisoire: 'Rapprochement provisoire',
    controle_fiable: 'Contrôle fiable',
  };
  function evaluerMaturiteInventaire(ctx) {
    const catalogueConfigure = !!(ctx && ctx.catalogueConfigure);
    const couverturePourcentage = ctx && Number.isFinite(ctx.couverturePourcentage) ? ctx.couverturePourcentage : null;
    const deceniumImporte = !!(ctx && ctx.deceniumImporte);
    const rapprochementFiable = !!(ctx && ctx.rapprochementFiable);
    let niveau;
    if (!catalogueConfigure || couverturePourcentage == null || couverturePourcentage === 0) {
      niveau = 'initialisation';
    } else if (couverturePourcentage < SEUIL_COUVERTURE_BASE_PHYSIQUE_MATURITE) {
      niveau = 'observation_terrain';
    } else if (!deceniumImporte) {
      niveau = 'base_physique_en_construction';
    } else if (!rapprochementFiable) {
      niveau = 'rapprochement_provisoire';
    } else {
      niveau = 'controle_fiable';
    }
    return { niveau, libelle: LIBELLE_MATURITE_INVENTAIRE[niveau] };
  }

  // Contrôle qualité de l'import Decenium (audit "NEXUS Inventaire Produit
  // — Chaîne de données", 21/08/2026, §5 étape 5 "Contrôle qualité :
  // doublon, trou de période, référence inconnue, quantité négative
  // inhabituelle" — Phase 2). Purement informatif, jamais bloquant : NEXUS
  // signale, le manager décide (même philosophie que le reste de l'écran
  // Contrôle Inventaire). "Trou de période" n'est pas couvert ici — un
  // import est rattaché à un seul quart, pas à une plage de dates
  // (principe du pont, cité par Frédéric le 08/08/2026 : le mapping/import
  // actuel est un pont temporaire vers Decenium, pas un système de gestion
  // — pas de nouvelle notion de "période d'import" tant que l'API réelle
  // n'existe pas).
  function controleQualiteImportVentes(lignesRapprochees) {
    const lignes = lignesRapprochees || [];

    // Doublons : une même référence (code-barres si connu, sinon
    // désignation brute) apparaît sur plusieurs lignes du même fichier —
    // jamais fusionnées automatiquement (une fusion silencieuse cacherait
    // l'anomalie d'export plutôt que de la signaler).
    const groupesParCle = new Map();
    lignes.forEach(l => {
      const cle = l.code_barres_brut || l.designation_brute || null;
      if (!cle) return;
      if (!groupesParCle.has(cle)) groupesParCle.set(cle, []);
      groupesParCle.get(cle).push(l);
    });
    const doublons = [];
    groupesParCle.forEach(groupe => {
      if (groupe.length > 1) {
        doublons.push({ reference: groupe[0].designation_matchee || groupe[0].designation_brute, occurrences: groupe.length });
      }
    });

    // Quantités négatives : peut être un retour légitime — jamais rejetée,
    // seulement signalée pour vérification humaine (I09/§5 de l'audit).
    const quantitesNegatives = lignes
      .filter(l => Number(l.quantite_vendue) < 0)
      .map(l => ({ reference: l.designation_matchee || l.designation_brute, quantite: l.quantite_vendue }));

    // Références inconnues : liste exploitable (pas seulement un compteur)
    // — ce que le manager doit pouvoir corriger via un alias, jamais un
    // rapprochement deviné à sa place (I09 : "pas de mapping inventé").
    const vues = new Set();
    const referencesInconnues = [];
    lignes.forEach(l => {
      if (l.produit_id) return;
      const cle = l.designation_brute || '(sans désignation)';
      if (vues.has(cle)) return;
      vues.add(cle);
      referencesInconnues.push({ designation: cle });
    });

    return { doublons, quantitesNegatives, referencesInconnues };
  }

  // ============================================================
  // INVENTAIRE V2 — Sprint 1 "Configuration multi-site" (29/08/2026,
  // doctrine complète transmise par Frédéric — "NEXUS Inventaire V2").
  // Objectif du sprint, verbatim : "sortir définitivement les règles
  // métier du code" — aucune règle Sainte-Marie n'est codée ici, seulement
  // des fonctions PURES qui savent résoudre une configuration déjà chargée
  // (inventaire_mission_rules, table créée par ce sprint) contre un
  // contexte (quart, moment, rôles réellement présents). Le générateur de
  // missions complet (construireMissionsInventaire, qui combinera ceci avec
  // construirePlanComptage) est explicitement HORS SCOPE de ce sprint —
  // prévu au Sprint 2 du plan de Frédéric (§46).
  //
  // Vocabulaire NEXUS Core (doctrine §5/§37) : le "moment" d'un quart.
  // Générique par construction — jamais un horaire de station particulière.
  // ============================================================
  const MOMENTS_QUART = [
    { cle: 'debut', label: 'Début de quart' },
    { cle: 'pendant', label: 'Pendant le quart' },
    { cle: 'fin', label: 'Fin de quart (transmission)' },
  ];
  function libelleMoment(momentCode) {
    const m = MOMENTS_QUART.find(x => x.cle === momentCode);
    return m ? m.label : momentCode;
  }

  const STRATEGIES_REPLI = [
    { cle: 'reporter_quart_suivant', label: 'Reporter au quart suivant' },
    { cle: 'reduire_perimetre', label: 'Réduire le périmètre de la mission' },
    { cle: 'reporter_prochain_jour_disponible', label: 'Reporter au prochain jour avec ce rôle' },
    { cle: 'aucune', label: 'Aucune (mission simplement non affectée)' },
  ];
  function libelleStrategieRepli(strategieCode) {
    const s = STRATEGIES_REPLI.find(x => x.cle === strategieCode);
    return s ? s.label : (strategieCode || 'Aucune stratégie configurée');
  }

  // Une inventaire_mission_rules s'applique-t-elle à ce (quart, moment) ?
  // `regle.quart` null = les deux quarts (doctrine : "Piste ... début et fin
  // Q1 ; début et fin Q2" — une seule règle couvre les deux quarts quand la
  // mission ne dépend pas du quart, exactement le cas Piste/Renfort).
  function regleApplicableContexte(regle, quart, moment) {
    if (!regle || regle.actif === false) return false;
    if (regle.moment_code !== moment) return false;
    if (regle.quart != null && regle.quart !== quart) return false;
    return true;
  }

  // Résout l'affectation d'UNE règle contre les rôles RÉELLEMENT présents ce
  // quart (doctrine §9, "règle de repli en cas d'absence") :
  //   - rôle principal présent -> affectée telle quelle ;
  //   - rôle principal absent, rôle de repli configuré ET présent ->
  //     affectée au rôle de repli, `viaRepli: true` (jamais silencieux : le
  //     champ existe précisément pour que Sprint 2/l'écran puisse le
  //     signaler) ;
  //   - rôle principal absent, aucun repli exploitable -> `non_affectee`,
  //     accompagnée de la stratégie CONFIGURÉE (jamais exécutée ici — ce
  //     sprint ne fait que la RESTITUER, conformément à son périmètre).
  // `rolesPresents` : Set ou array de role_code (ex. valeurs employees.role
  // réellement en poste ce quart, typiquement issues de
  // inventaire_quart_employes — jamais recalculées différemment ici,
  // Article 11 : ce moteur reçoit la présence, il ne la déduit pas).
  function resoudreAffectationRegleMission(regle, rolesPresents) {
    const presents = rolesPresents instanceof Set ? rolesPresents : new Set(rolesPresents || []);
    if (!regle) return null;
    if (presents.has(regle.role_code)) {
      return { regle, statut: 'affectee', roleAffecte: regle.role_code, viaRepli: false };
    }
    if (regle.role_repli && presents.has(regle.role_repli)) {
      return { regle, statut: 'affectee', roleAffecte: regle.role_repli, viaRepli: true };
    }
    return {
      regle, statut: 'non_affectee', roleAffecte: null, viaRepli: false,
      strategieAppliquee: regle.strategie_repli || 'aucune',
    };
  }

  // Résout TOUTES les mission_rules applicables à un contexte (site déjà
  // filtré en amont par le chargeur — Article 11, jamais un second filtre
  // de site ici). Retourne une ligne de résolution par règle applicable,
  // triée par ordre_affichage — jamais un tri différent de celui que verra
  // le manager dans Paramètres.
  function resoudreMissionRulesApplicables({ missionRules, quart, moment, rolesPresents }) {
    return (missionRules || [])
      .filter(r => regleApplicableContexte(r, quart, moment))
      .sort((a, b) => (a.ordre_affichage || 0) - (b.ordre_affichage || 0))
      .map(r => resoudreAffectationRegleMission(r, rolesPresents));
  }

  // ------------------------------------------------------------
  // Configuration par défaut NEXUS (doctrine §2/§39) — template générique
  // installé pour un NOUVEAU site, AUCUNE référence à Vito/Sainte-Marie.
  // Les catégories par défaut sont désignées par leur NOM (pas un uuid,
  // qui n'existe pas encore pour un site qui n'a pas été créé) — c'est au
  // chargeur d'installation (nexus-inventaire-mission-rules-donnees.js) de
  // créer d'abord les catégories, puis de résoudre ces noms en uuid avant
  // d'insérer les mission_rules. Cette fonction reste pure : elle ne fait
  // AUCUN accès réseau, elle décrit seulement la configuration à poser.
  // ------------------------------------------------------------
  const CATEGORIES_DEFAUT_NEXUS = [
    { nom: 'Produits sensibles', ordre_affichage: 10 },
    { nom: 'Tabac', ordre_affichage: 20 },
    { nom: 'Presse', ordre_affichage: 30 },
    { nom: 'Produits frais', ordre_affichage: 40 },
    { nom: 'Boissons', ordre_affichage: 50 },
    { nom: 'Lubrifiants', ordre_affichage: 60 },
    { nom: 'Gaz', ordre_affichage: 70 },
    { nom: 'Produits froids / glace', ordre_affichage: 80 },
    { nom: 'Autres produits boutique', ordre_affichage: 90 },
  ];

  // Rôles par défaut — LIBELLÉS génériques uniquement (doctrine §2). Le code
  // de rôle réel reste celui déjà en vigueur dans `employees.role`
  // (pompiste/caissier/renfort/manager/gerant/vacataire) : jamais un second
  // référentiel de rôles créé pour Inventaire (Article 11). Ce tableau sert
  // seulement à afficher un nom lisible ("Caisse" plutôt que "caissier")
  // dans les écrans génériques de configuration.
  const ROLES_DEFAUT_NEXUS = [
    { code: 'caissier', label: 'Caisse' },
    { code: 'pompiste', label: 'Piste' },
    { code: 'renfort', label: 'Renfort' },
    { code: 'manager', label: 'Manager' },
  ];

  // Mission_rules génériques, par NOM de catégorie (résolu à l'installation
  // — voir en-tête ci-dessus). Volontairement minimal et prudent (doctrine
  // §46 Sprint 1 : "aucune évolution complexe du rapprochement à ce
  // stade") : deux missions de bon sens (tabac à l'ouverture, périssables à
  // la transmission), pas une doctrine complète Sainte-Marie généralisée à
  // tort à tous les sites.
  const MISSION_RULES_DEFAUT_NEXUS = [
    {
      nom: 'Caisse · Début de quart',
      role_code: 'caissier', moment_code: 'debut', quart: null,
      categorie_noms: ['Tabac', 'Produits sensibles'],
      mode_selection: 'complet', priorite: 'sensible', ordre_affichage: 10,
    },
    {
      nom: 'Caisse · Fin de quart (transmission)',
      role_code: 'caissier', moment_code: 'fin', quart: null,
      categorie_noms: ['Presse', 'Produits frais'],
      mode_selection: 'complet', priorite: 'normale', ordre_affichage: 20,
    },
    {
      nom: 'Renfort · Pendant le quart',
      role_code: 'renfort', role_repli: null, moment_code: 'pendant', quart: null,
      categorie_noms: ['Boissons', 'Lubrifiants'],
      mode_selection: 'complet', priorite: 'normale',
      strategie_repli: 'reporter_quart_suivant', ordre_affichage: 30,
    },
  ];

  // ============================================================
  // INVENTAIRE V2 — Sprint 2 "Génération des missions" (29/08/2026, suite de
  // la doctrine "NEXUS Inventaire V2" — Frédéric a confirmé "ok sprint 2").
  // Ordre de développement demandé explicitement par Frédéric (§ clôture de
  // sa doctrine) : "Paramètres → Génération des missions → Expérience
  // employé → Deux jauges → Répartition par rôles." Ce sprint construit
  // UNIQUEMENT le générateur (résoudre le contexte réel du quart en
  // missions concrètes, avec leur périmètre produit) — la nouvelle
  // expérience employé qui les CONSOMME à l'écran reste Sprint 3.
  //
  // Toujours des fonctions PURES (aucun accès réseau, Article 11) : elles
  // reçoivent des ingrédients déjà chargés par la couche données
  // (nexus-inventaire-missions-donnees.js, qui réutilise chargerMissionRules
  // /chargerRolesPresentsQuart du Sprint 1 et chargerIngredientsSelection de
  // nexus-inventaire-plan-donnees.js — jamais une deuxième requête produits
  // parallèle, Article 11).
  // ============================================================

  // Filtre le catalogue actif par le périmètre catégorie/zone d'UNE
  // mission_rule. `categorie_ids`/`zone_ids` vides ou absents = pas de
  // restriction sur cette dimension (doctrine : une mission peut couvrir
  // "toutes les catégories" d'une zone, ou une catégorie dans toutes les
  // zones).
  function perimetreProduitsMission(missionRule, produitsActifs) {
    const categorieIds = (missionRule.categorie_ids && missionRule.categorie_ids.length) ? new Set(missionRule.categorie_ids) : null;
    const zoneIds = (missionRule.zone_ids && missionRule.zone_ids.length) ? new Set(missionRule.zone_ids) : null;
    return (produitsActifs || []).filter(p => {
      if (categorieIds && !categorieIds.has(p.categorie_id)) return false;
      if (zoneIds && !zoneIds.has(p.zone_id)) return false;
      return true;
    });
  }

  // Applique le mode_selection de la mission_rule au périmètre déjà filtré :
  //   - 'complet' : tout le périmètre, sans réduction.
  //   - 'tournant' : les `nombre_references` produits les moins récemment
  //     contrôlés d'abord (jamais contrôlé = priorité absolue), tie-break
  //     déterministe (hashDeterministe) pour ne jamais dépendre de l'ordre
  //     brut du catalogue — reproductible pour un même (site, date, quart,
  //     mission), jamais un tirage aléatoire différent à chaque génération.
  //   - 'cible' : traité comme 'complet' dans ce sprint — **limitation
  //     assumée (Article 5)** : aucune règle réelle (Sainte-Marie ou
  //     gabarit par défaut) n'utilise ce mode aujourd'hui ; sa sémantique
  //     propre (cibler QUOI, exactement ?) n'a pas été spécifiée par la
  //     doctrine et reste à clarifier avec Frédéric avant implémentation
  //     réelle — jamais une fausse précision inventée ici.
  //   - valeur inconnue : repli sûr sur le périmètre complet, jamais un
  //     tableau vide silencieux qui ferait disparaître une mission entière.
  function selectionnerPerimetreMission(missionRule, produitsActifs, dernierControleParProduit, seed) {
    const candidats = perimetreProduitsMission(missionRule, produitsActifs);
    const mode = missionRule.mode_selection || 'complet';
    if (mode !== 'tournant') return candidats.map(p => p.id);
    const n = (missionRule.nombre_references && missionRule.nombre_references > 0) ? missionRule.nombre_references : candidats.length;
    const carte = dernierControleParProduit || {};
    const trie = candidats.slice().sort((a, b) => {
      const da = carte[a.id] || null;
      const db = carte[b.id] || null;
      if (da !== db) {
        if (!da) return -1;
        if (!db) return 1;
        return da < db ? -1 : 1;
      }
      return hashDeterministe(`${seed}|${a.id}`) - hashDeterministe(`${seed}|${b.id}`);
    });
    return trie.slice(0, n).map(p => p.id);
  }

  // Le générateur complet : pour CHAQUE moment du quart, résout les
  // mission_rules applicables contre les rôles réellement présents
  // (Sprint 1 ::resoudreMissionRulesApplicables), puis calcule le périmètre
  // produit de chaque mission AFFECTÉE. Une mission NON affectée est
  // conservée dans le résultat (statut 'non_affectee', périmètre vide) —
  // jamais silencieusement supprimée : c'est la "dette de couverture" de la
  // doctrine, une information que le manager doit pouvoir voir, pas un
  // trou invisible dans le contrôle du site.
  function genererMissionsPourContexte({ missionRules, rolesPresents, quart, produitsActifs, dernierControleParProduit, seed }) {
    const missions = [];
    MOMENTS_QUART.forEach(m => {
      const resolues = resoudreMissionRulesApplicables({ missionRules, quart, moment: m.cle, rolesPresents });
      resolues.forEach(res => {
        const produitIds = res.statut === 'affectee'
          ? selectionnerPerimetreMission(res.regle, produitsActifs, dernierControleParProduit, `${seed}|${res.regle.id}`)
          : [];
        missions.push({
          missionRuleId: res.regle.id, nom: res.regle.nom, momentCode: m.cle,
          statut: res.statut, roleAffecte: res.roleAffecte, viaRepli: res.viaRepli,
          strategieAppliquee: res.strategieAppliquee || null, produitIds,
        });
      });
    });
    return missions;
  }

  // Synthèse de couverture (doctrine : distinguer strictement Couverture —
  // "toutes les missions ont-elles un rôle pour les faire ?" — de
  // Fiabilité/conformité — traitée ailleurs, jamais mélangée ici). Une
  // mission non affectée n'est PAS une anomalie de comptage, c'est un trou
  // d'ORGANISATION (personne présent pour la faire) — vocabulaire
  // volontairement différent (Article 5 : ne jamais faire porter à
  // l'employé une faute d'organisation).
  function couvertureMissions(missions) {
    const total = (missions || []).length;
    const affectees = (missions || []).filter(m => m.statut === 'affectee').length;
    return {
      total, affectees, nonAffectees: total - affectees,
      tauxCouverture: total > 0 ? affectees / total : null,
    };
  }

  // ============================================================
  // INVENTAIRE V2 — Sprint 3 "Expérience employé" (29/08/2026, Frédéric a
  // confirmé "sprint 3"). Doctrine : deux jauges strictement distinctes —
  // une jauge de MISSION (ce périmètre précis est-il fini ?) et une jauge
  // COLLECTIVE (l'inventaire du quart est-il fini, tous rôles confondus ?)
  // — et Couverture (100% = toutes les observations faites) ne doit JAMAIS
  // être confondue avec Fiabilité/conformité (l'écart, traité ailleurs par
  // nexus-ecarts-moteur.js, Article 11 : jamais un second calcul d'écart
  // ici). Cette fonction est volontairement générique : la MÊME fonction
  // sert à calculer la jauge d'une mission (périmètre = produit_ids de la
  // mission) et la jauge collective (périmètre = tous les produit_id du
  // plan du quart) — jamais deux implémentations séparées pour la même
  // question "combien sur combien ?" (Article 11).
  // ============================================================

  // `produitIds` : le périmètre à mesurer (mission ou quart entier).
  // `produitsComptesSet` : Set des produit_id déjà comptés (la source de
  // cette information — session en cours ou statut persisté — est décidée
  // par l'appelant, cette fonction reste pure et ne préjuge jamais d'où
  // vient l'information de comptage). Périmètre vide -> 100% (rien à faire
  // n'est jamais présenté comme "à faire").
  function jaugePerimetre(produitIds, produitsComptesSet) {
    const liste = produitIds || [];
    const comptes = produitsComptesSet instanceof Set ? produitsComptesSet : new Set(produitsComptesSet || []);
    const total = liste.length;
    const faits = liste.filter(id => comptes.has(id)).length;
    return { total, faits, pct: total > 0 ? Math.round((faits / total) * 100) : 100 };
  }

  global.NexusInventaireMoteur = {
    FAMILLES_CONTROLE, DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE,
    libelleRaisonSelection, joursEntreDates, delaiMaxJours, produitEligibleQuart,
    regleEffectiveProduit, construireReglesEffectivesParProduit, seuilEcartEffectif,
    hashDeterministe, prngDeterministe, tirerSurprisesDeterministe,
    construirePlanComptage, libelleTotalProduit,
    qualiteRapprochementProduit, libelleQualiteRapprochement, couverturePhysique,
    reconciliationAlertesDemarque, syntheseQualiteRapprochements,
    dureeSessionAutomatiqueMinutes, syntheseComparaisonAdoption, moyenneSyntheseAdoption,
    libelleContexteJour, contexteCalendaireJour, calculerRecommandationPreparation,
    resteDepasseSeuilSurveillance,
    sommeMouvementsProduction, disponibleQuartProduction, ecoulementQuartProduction,
    syntheseProductionJournee,
    analyserPreparationVsConseil, analyserEcoulementVsPreparation, analyserJourneeProduction, syntheseAnalysePeriode,
    TYPES_MOUVEMENT, infoTypeMouvement, libelleTypeMouvement, mouvementImpacteStockGlobal,
    ACTIONS_MOUVEMENT_PAR_PROFIL, actionsMouvementPourProfil,
    evaluerConfigurationInventaire, identifierCategoriesAOptimiser, estimerTempsProchainInventaire,
    evaluerMaturiteInventaire, controleQualiteImportVentes,
    agregerAnomaliesParProduit, appliquerCutoverControles,
    MOMENTS_QUART, libelleMoment, STRATEGIES_REPLI, libelleStrategieRepli,
    regleApplicableContexte, resoudreAffectationRegleMission, resoudreMissionRulesApplicables,
    CATEGORIES_DEFAUT_NEXUS, ROLES_DEFAUT_NEXUS, MISSION_RULES_DEFAUT_NEXUS,
    perimetreProduitsMission, selectionnerPerimetreMission, genererMissionsPourContexte, couvertureMissions,
    jaugePerimetre,
  };
})(typeof window !== 'undefined' ? window : globalThis);
