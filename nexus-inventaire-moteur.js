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

  global.NexusInventaireMoteur = {
    FAMILLES_CONTROLE, DEFAUT_DELAI_MAX_JOURS_PAR_FAMILLE,
    libelleRaisonSelection, joursEntreDates, delaiMaxJours, produitEligibleQuart,
    hashDeterministe, prngDeterministe, tirerSurprisesDeterministe,
    construirePlanComptage, libelleTotalProduit,
  };
})(typeof window !== 'undefined' ? window : globalThis);
