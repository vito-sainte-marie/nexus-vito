// NEXUS Inventaire V2 — Snapshot Decenium, Étape 1 "fondation" (30/08/2026).
//
// Demande de Frédéric, verrouillée explicitement dans sa réponse du
// 30/08/2026 : "VENTES + STOCK ACTUEL = SNAPSHOT DECENIUM". Le rapprochement
// actuel (inventaire_rapprochements, quart_id + produit_id) reste la couche
// de RÉSULTAT — Article 11, jamais réécrit. Ce fichier introduit la couche
// de SOURCE temporelle qui manquait : une Photo Decenium horodatée,
// composée d'un export Ventes et d'un export Stock actuel réalisés l'un
// après l'autre, avec son propre niveau de confiance.
//
// Séparation stricte imposée par Frédéric : "Snapshot = source temporelle
// Decenium" — AUCUN statut métier (sous_observation, contrôle manager
// requis, etc.) ne doit apparaître ici. Ce fichier ne qualifie QUE la
// fiabilité de la source elle-même, jamais l'interprétation d'un écart —
// cette interprétation reste du ressort de nexus-inventaire-moteur.js
// (rapprochement) et du cycle d'observation (v2.295).
//
// Architecture verrouillée par Frédéric (30/08/2026) :
//   1 Snapshot -> N rapprochements -> N quarts possibles
// (jamais l'inverse). Un Snapshot appartient au SITE et à un instant de
// référence (snapshot_reference_at = stock_export_at), jamais à un quart.

(function (global) {
  'use strict';

  // Seuil de délai par défaut entre les deux exports, au-delà duquel le
  // Snapshot est signalé au manager avant d'être utilisé (doctrine §5 de
  // Frédéric : "il ne faut pas coder arbitrairement si > 5 min = erreur").
  // Choix pragmatique assumé (Article 5, même logique que les autres
  // seuils "par défaut ajustables" de ce produit) — TOUJOURS transmis en
  // paramètre explicite par l'appelant (station_config.parametres_
  // inventaire.snapshotMaxDelayMinutes), jamais lu directement ici.
  const SEUIL_DEFAUT_DELAI_MAX_MINUTES = 5;

  // Catégories métier explicables (doctrine §17) — jamais un faux score
  // numérique sans modèle qui le justifie ("87,42% de confiance").
  const NIVEAUX_CONFIANCE_SNAPSHOT = ['haute', 'moyenne', 'faible', 'insuffisante'];

  const LIBELLES_CONFIANCE_SNAPSHOT = {
    haute: 'Haute',
    moyenne: 'Moyenne',
    faible: 'Faible',
    insuffisante: 'Insuffisante',
  };

  const LIBELLES_SOURCE_HORODATAGE = {
    file_metadata: "Heure lue dans le fichier",
    manager_declared: 'Heure déclarée par le manager',
    import_time_estimated: "Heure d'import NEXUS (estimation)",
  };

  function libelleConfianceSnapshot(niveau) { return LIBELLES_CONFIANCE_SNAPSHOT[niveau] || 'Inconnue'; }
  function libelleSourceHorodatage(source) { return LIBELLES_SOURCE_HORODATAGE[source] || 'Inconnue'; }

  // Ordre réel des deux exports — doctrine §3 : "l'ordre ne doit pas être
  // un simple champ informatif ; il participe à la qualification du
  // Snapshot." Jamais déduit silencieusement si l'un des deux horodatages
  // manque (unknown plutôt qu'une supposition, Article 5).
  function ordreExportDecenium(salesExportAt, stockExportAt) {
    if (!salesExportAt || !stockExportAt) return 'unknown';
    const tVentes = new Date(salesExportAt).getTime();
    const tStock = new Date(stockExportAt).getTime();
    if (!Number.isFinite(tVentes) || !Number.isFinite(tStock)) return 'unknown';
    return tStock >= tVentes ? 'sales_then_stock' : 'stock_then_sales';
  }

  // stock_export_at - sales_export_at, en secondes. Peut être négatif
  // (export_order = 'stock_then_sales'). null si l'un des deux horodatages
  // est inconnu — jamais un delta inventé.
  function deltaSecondesSnapshot(salesExportAt, stockExportAt) {
    if (!salesExportAt || !stockExportAt) return null;
    const tVentes = new Date(salesExportAt).getTime();
    const tStock = new Date(stockExportAt).getTime();
    if (!Number.isFinite(tVentes) || !Number.isFinite(tStock)) return null;
    return Math.round((tStock - tVentes) / 1000);
  }

  // ------------------------------------------------------------
  // qualifierSnapshotDecenium — cœur de l'Étape 1. Pure : ne touche à
  // aucune base, ne connaît aucun ID, ne décide d'aucune action réseau.
  // Reçoit tout ce dont elle a besoin en entrée, renvoie exactement ce
  // qu'il faut écrire dans inventaire_decenium_snapshots.
  //
  // Entrées :
  //  - salesExportAt / stockExportAt : ISO ou null (heure réelle de
  //    génération du fichier, si connue).
  //  - salesExportTimeSource / stockExportTimeSource : 'file_metadata' |
  //    'manager_declared' | 'import_time_estimated'.
  //  - seuilMaxDelaiMinutes : fourni par l'appelant (station_config),
  //    jamais une constante interne (voir SEUIL_DEFAUT_DELAI_MAX_MINUTES
  //    ci-dessus, qui n'est qu'un filet de sécurité si l'appelant ne
  //    transmet rien).
  //  - manager_a_choisi_poursuivre : true si le manager a explicitement
  //    cliqué "Poursuivre quand même" après avertissement (doctrine §7) —
  //    jamais posé automatiquement.
  //
  // Sortie : { export_order, delta_seconds, snapshot_reference_at,
  // confidence_level, validated_with_reserve, delai_depasse,
  // delai_minutes }.
  // ------------------------------------------------------------
  function qualifierSnapshotDecenium({
    salesExportAt, stockExportAt, salesExportTimeSource, stockExportTimeSource,
    seuilMaxDelaiMinutes, manager_a_choisi_poursuivre,
  }) {
    const seuil = Number.isFinite(seuilMaxDelaiMinutes) ? seuilMaxDelaiMinutes : SEUIL_DEFAUT_DELAI_MAX_MINUTES;
    const export_order = ordreExportDecenium(salesExportAt, stockExportAt);
    const delta_seconds = deltaSecondesSnapshot(salesExportAt, stockExportAt);
    // Doctrine §20 : le stock actuel EST la photographie Decenium à
    // l'instant T1 — snapshot_reference_at = stock_export_at, toujours
    // (jamais recalculé autrement, même si l'ordre est inversé : doctrine
    // §21, le Snapshot reste utilisable, seule la confiance change).
    const snapshot_reference_at = stockExportAt || null;

    const delaiMinutesAbs = delta_seconds != null ? Math.abs(delta_seconds) / 60 : null;
    const delai_depasse = delaiMinutesAbs != null && delaiMinutesAbs > seuil;

    // Sans aucun horodatage réel exploitable pour l'un des deux fichiers,
    // impossible d'affirmer quoi que ce soit sur la fraîcheur relative des
    // deux exports — confiance au plus 'faible', jamais 'haute'/'moyenne'
    // sur la base d'une simple estimation d'heure d'import.
    const sourcesEstimees = salesExportTimeSource === 'import_time_estimated' || stockExportTimeSource === 'import_time_estimated';
    const ordreNonRecommande = export_order === 'stock_then_sales';

    let confidence_level;
    if (delta_seconds == null) {
      // Ordre/délai inconnu : on ne peut rien garantir sur la cohérence
      // temporelle des deux fichiers entre eux.
      confidence_level = 'faible';
    } else if (delai_depasse && !manager_a_choisi_poursuivre) {
      // Ne devrait pas être appelé sans decision manager si délai dépassé
      // (l'écran doit avertir avant) — filet de sécurité : traité comme
      // faible plutôt que de planter.
      confidence_level = 'faible';
    } else if (delai_depasse && manager_a_choisi_poursuivre) {
      confidence_level = 'faible';
    } else if (ordreNonRecommande) {
      // Doctrine §21 : ordre inversé -> "utilisable avec réserve", jamais
      // 'haute'.
      confidence_level = sourcesEstimees ? 'faible' : 'moyenne';
    } else if (sourcesEstimees) {
      confidence_level = 'moyenne';
    } else {
      confidence_level = 'haute';
    }

    return {
      export_order, delta_seconds, snapshot_reference_at,
      confidence_level,
      validated_with_reserve: !!(delai_depasse && manager_a_choisi_poursuivre),
      delai_depasse, delai_minutes: delaiMinutesAbs,
    };
  }

  // Libellé "Décalage : 1 min 13 s" (doctrine §4/§6, UX Photo Decenium) —
  // jamais un nombre de secondes brut affiché tel quel.
  function libelleDelta(deltaSecondes) {
    if (deltaSecondes == null) return 'Décalage inconnu';
    const abs = Math.abs(deltaSecondes);
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    const texte = min > 0 ? `${min} min ${sec} s` : `${sec} s`;
    return deltaSecondes < 0 ? `${texte} (stock avant ventes)` : texte;
  }

  global.NexusInventaireSnapshotMoteur = {
    SEUIL_DEFAUT_DELAI_MAX_MINUTES, NIVEAUX_CONFIANCE_SNAPSHOT,
    libelleConfianceSnapshot, libelleSourceHorodatage, libelleDelta,
    ordreExportDecenium, deltaSecondesSnapshot, qualifierSnapshotDecenium,
  };
})(typeof window !== 'undefined' ? window : globalThis);
