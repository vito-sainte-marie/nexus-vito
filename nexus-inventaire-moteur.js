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
  function construirePlanComptage({
    produits, reglesParProduit, dernierControleParProduit, produitsAvecAnomalieRecente,
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
    // le seul délai. Toujours inclus, jamais plafonné.
    analyse.filter(a => a.famille !== 'critique' && a.anomalieRecente).forEach(a => ajouter(a, 'anomalie_recente'));

    // 2-7. Non-critiques en retard restants (délai dépassé, sans anomalie
    // récente déjà traitée ci-dessus) — jamais plafonnés (étape 7).
    analyse
      .filter(a => a.famille !== 'critique' && a.enRetard && !a.anomalieRecente)
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

  global.NexusInventaireMoteur = {
    FAMILLES_CONTROLE, DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE,
    libelleRaisonSelection, joursEntreDates, delaiMaxJours, produitEligibleQuart,
    regleEffectiveProduit, construireReglesEffectivesParProduit,
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
