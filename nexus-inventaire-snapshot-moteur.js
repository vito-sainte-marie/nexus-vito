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

  // ==============================================================
  // Étape 3 "reconstruction temporelle" (30/08/2026) — calcule le stock
  // théorique à un instant T0 (antérieur au Snapshot) à partir du Snapshot
  // à T1 (Stock actuel réellement compté) et de tout ce qui a bougé entre
  // les deux. Formule verrouillée avec Frédéric :
  //
  //   Stock théorique à T0 = Stock Snapshot à T1
  //                          + ventes(T0,T1]
  //                          - mouvements signés(T0,T1]
  //                          - corrections signées(T0,T1]
  //
  // (aller de T1 vers le passé revient à défaire ce qui s'est produit
  // depuis : on RAJOUTE ce qui a été vendu — puisque ça a fait baisser le
  // stock entre T0 et T1 — et on RETIRE les mouvements/corrections qui ont
  // fait monter ou baisser le stock pour d'autres raisons que la vente).
  //
  // Prudence assumée après vérification du schéma réel (Article 5) :
  //  - `inventaire_ventes_import` n'a qu'un horodatage par IMPORT (donc
  //    par quart), jamais par ligne de vente — les ventes ne peuvent donc
  //    être attribuées à la fenêtre (T0,T1] qu'au niveau du QUART entier,
  //    jamais à la minute près. Un quart n'est utilisable que si tout son
  //    intervalle réel [ouvert_le, cloture_le] est contenu dans (T0,T1] ;
  //    sinon il est exclu et signalé (jamais un partage arbitraire de ses
  //    ventes entre deux fenêtres).
  //  - `inventaire_mouvements.cree_le` et `inventaire_corrections.
  //    created_at` sont de vrais horodatages précis (vérifiés dans le
  //    code réel avant ce lot) — utilisables directement pour la fenêtre.
  //  - `inventaire_mouvements.quantite` est DÉJÀ signée à la saisie
  //    (positif = entrant, négatif = sortant) — jamais redérivée depuis
  //    `type_mouvement`, qui peut être ambigu (ex: 'transfert' couvre
  //    recu ET sortant).
  // ==============================================================

  // Garde d'entrée : une reconstruction n'a de sens que si T0 est
  // strictement antérieur à T1 (l'instant de référence du Snapshot).
  // Jamais une tentative "à l'envers" ou sur un instant égal.
  function qualifierReconstructionT0T1(instantT0, instantT1) {
    if (!instantT0 || !instantT1) return { possible: false, motif: 'horodatage_manquant' };
    const t0 = new Date(instantT0).getTime();
    const t1 = new Date(instantT1).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return { possible: false, motif: 'horodatage_invalide' };
    if (t0 >= t1) return { possible: false, motif: 'T0_posterieur_ou_egal_T1' };
    return { possible: true, motif: null };
  }

  // Classe un quart vis-à-vis de la fenêtre (T0,T1] — ses ventes ne sont
  // utilisables que si son intervalle réel y est ENTIÈREMENT contenu.
  // Retourne toujours un motif explicite si exclu, jamais un simple
  // booléen muet (traçabilité pour l'écran / les tests).
  function classerQuartDansFenetre({ ouvertLe, clotureLe }, instantT0, instantT1) {
    if (!clotureLe) return { utilisable: false, motif: 'quart_non_cloture' };
    const ouvert = ouvertLe ? new Date(ouvertLe).getTime() : null;
    const cloture = new Date(clotureLe).getTime();
    const t0 = new Date(instantT0).getTime();
    const t1 = new Date(instantT1).getTime();
    if (!Number.isFinite(cloture)) return { utilisable: false, motif: 'horodatage_invalide' };
    if (cloture > t1) return { utilisable: false, motif: 'hors_fenetre_apres_T1' };
    if (ouvert == null || !Number.isFinite(ouvert)) return { utilisable: false, motif: 'ouverture_inconnue' };
    if (ouvert <= t0) return { utilisable: false, motif: 'chevauche_T0' };
    return { utilisable: true, motif: null };
  }

  // Agrégations simples par produit — volontairement triviales et isolées
  // ici (Article 11 : ne rappelle aucun moteur d'un autre domaine pour un
  // simple total) pour rester testables indépendamment de la couche
  // données qui les alimente.
  function agregerVentesParProduit(lignesVentes) {
    const parProduit = {};
    (lignesVentes || []).forEach(l => {
      if (!l.produit_id) return;
      parProduit[l.produit_id] = (parProduit[l.produit_id] || 0) + Number(l.quantite_vendue || 0);
    });
    return parProduit;
  }

  function agregerMouvementsParProduit(mouvements) {
    const parProduit = {};
    (mouvements || []).forEach(m => {
      if (!m.produit_id) return;
      parProduit[m.produit_id] = (parProduit[m.produit_id] || 0) + Number(m.quantite || 0);
    });
    return parProduit;
  }

  // Une correction n'est intégrable que si elle porte à la fois
  // old_value/new_value (le delta signé est alors new_value - old_value) —
  // sinon (ex: type 'mouvement_oublie') elle est explicitement IGNORÉE et
  // listée, jamais silencieusement perdue (Article 5).
  function agregerCorrectionsParProduit(corrections) {
    const parProduit = {};
    const ignorees = [];
    (corrections || []).forEach(c => {
      if (c.old_value == null || c.new_value == null) { ignorees.push(c); return; }
      if (!c.produit_id) { ignorees.push(c); return; }
      parProduit[c.produit_id] = (parProduit[c.produit_id] || 0) + (Number(c.new_value) - Number(c.old_value));
    });
    return { parProduit, ignorees };
  }

  // Cœur de l'Étape 3 — pure, ne touche à aucune base. `quartsExclusCount`
  // permet de qualifier honnêtement le résultat : 'fiable' si aucune donnée
  // n'a dû être exclue de la fenêtre, 'partielle' sinon (le stock théorique
  // reste la meilleure estimation possible, mais peut sous/sur-estimer
  // faute d'avoir pu inclure un quart chevauchant ou une correction
  // incomplète — jamais présenté comme équivalent à 'fiable').
  function reconstituerStockTheorique({
    produitId, quantiteSnapshotT1, sommeVentesFenetre, sommeMouvementsFenetre, sommeCorrectionsFenetre, quartsExclusCount,
  }) {
    if (quantiteSnapshotT1 == null) {
      return { produit_id: produitId, stock_theorique: null, qualite: 'impossible', motif: 'produit_absent_du_snapshot' };
    }
    const stock_theorique = quantiteSnapshotT1
      + (sommeVentesFenetre || 0)
      - (sommeMouvementsFenetre || 0)
      - (sommeCorrectionsFenetre || 0);
    const qualite = (quartsExclusCount || 0) > 0 ? 'partielle' : 'fiable';
    return { produit_id: produitId, stock_theorique, qualite, motif: null };
  }

  // ==============================================================
  // Étape 4 "complétude temporelle" (30/08/2026) — la reconstruction de
  // l'Étape 3 sait déjà EXCLURE un quart chevauchant ou non clôturé
  // (classerQuartDansFenetre) et compter combien ont été exclus
  // (quartsExclusCount -> qualité 'partielle'). Ce que l'Étape 3 ne dit pas
  // : OÙ, dans le temps, se situent les zones sans aucune couverture — un
  // manager ne peut pas juger si un trou de 20 minutes ou de 2 jours a été
  // ignoré. Cette étape calcule exactement ces plages ("trous").
  //
  // Vérification Article 11 avant d'écrire ce code : nexus-fdj-moteur.js
  // possède déjà un mécanisme de "continuité de chaîne de quarts"
  // (chaineContinuite / chaineInterrompueDynamique). Examiné et jugé NON
  // réutilisable tel quel : il répond à une question différente (un
  // calendrier FDJ à exactement 2 quarts fixes par jour, comparé quart par
  // quart) alors qu'ici il s'agit de mesurer une COUVERTURE TEMPORELLE
  // continue sur une fenêtre (T0,T1] arbitraire, à partir des intervalles
  // réels [ouvert_le, cloture_le] des quarts Inventaire (dont le nombre par
  // jour n'est pas fixe). Les deux mécanismes restent donc distincts,
  // chacun répondant à sa propre question — pas une duplication de la même
  // vérité.
  // ==============================================================

  // Libellé "2 j 3 h" / "1 h 12 min" / "45 s" — même esprit que libelleDelta
  // mais pour des durées potentiellement longues (plusieurs jours).
  function libelleDureeTrou(secondes) {
    if (secondes == null || !Number.isFinite(secondes)) return 'Durée inconnue';
    const abs = Math.abs(Math.round(secondes));
    const jours = Math.floor(abs / 86400);
    const heures = Math.floor((abs % 86400) / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const secs = abs % 60;
    if (jours > 0) return `${jours} j ${heures} h`;
    if (heures > 0) return `${heures} h ${minutes} min`;
    if (minutes > 0) return `${minutes} min ${secs} s`;
    return `${secs} s`;
  }

  // Fusionne une liste d'intervalles {debut,fin} (timestamps ms) qui se
  // chevauchent ou se touchent — utilitaire pur, isolé pour rester testable
  // indépendamment (Article 11 : pas de logique de fusion dupliquée
  // ailleurs dans ce fichier).
  function fusionnerIntervallesCouverts(intervalles) {
    const valides = (intervalles || [])
      .filter(i => i && Number.isFinite(i.debut) && Number.isFinite(i.fin) && i.fin > i.debut)
      .sort((a, b) => a.debut - b.debut);
    const fusionnes = [];
    valides.forEach(i => {
      const dernier = fusionnes[fusionnes.length - 1];
      if (dernier && i.debut <= dernier.fin) {
        dernier.fin = Math.max(dernier.fin, i.fin);
      } else {
        fusionnes.push({ debut: i.debut, fin: i.fin });
      }
    });
    return fusionnes;
  }

  // Cœur de l'Étape 4 — pure. Reçoit les quarts BRUTS (pas encore filtrés)
  // et refait elle-même l'appel à classerQuartDansFenetre (Article 11 :
  // même règle d'inclusion que l'Étape 3, jamais une deuxième version de
  // cette décision) pour ne retenir que les intervalles réellement
  // couverts, puis calcule ce qui reste non couvert dans (T0,T1].
  //
  // `quarts` : [{ id, ouvertLe, clotureLe }]. Retourne { qualification:
  // 'complete' | 'incomplete' | 'impossible', trous: [{debut, fin,
  // dureeSecondes}] (ISO, triés), dureeCouverteSecondes, dureeFenetreSecondes }.
  // 'impossible' réutilise exactement le même motif que qualifierReconstructionT0T1
  // (T0/T1 invalides) — jamais une deuxième garde d'entrée écrite en double.
  function detecterTrousTemporels(quarts, instantT0, instantT1) {
    const garde = qualifierReconstructionT0T1(instantT0, instantT1);
    if (!garde.possible) {
      return {
        qualification: 'impossible', motif: garde.motif, trous: [],
        dureeCouverteSecondes: 0, dureeFenetreSecondes: 0,
      };
    }
    const t0 = new Date(instantT0).getTime();
    const t1 = new Date(instantT1).getTime();
    const dureeFenetreSecondes = Math.round((t1 - t0) / 1000);

    const intervallesCouverts = (quarts || [])
      .filter(q => classerQuartDansFenetre({ ouvertLe: q.ouvertLe, clotureLe: q.clotureLe }, instantT0, instantT1).utilisable)
      .map(q => ({ debut: new Date(q.ouvertLe).getTime(), fin: new Date(q.clotureLe).getTime() }));

    const fusionnes = fusionnerIntervallesCouverts(intervallesCouverts);

    // Un quart n'est utilisable (classerQuartDansFenetre) que s'il ouvre
    // STRICTEMENT après T0 — borne intentionnellement ouverte, verrouillée
    // dès l'Étape 3 pour ne jamais présumer qu'un quart commençant pile à
    // T0 n'a rien chevauché avant. Conséquence mécanique assumée ici :
    // même une couverture parfaite laisse un écart infime (souvent
    // inférieur à la seconde) entre T0 et l'ouverture du premier quart
    // utilisable. Un "trou" de 0 s affiché à un manager serait un artefact
    // de précision, pas un vrai signal (Article 5) — seuls les écarts d'au
    // moins 1 seconde arrondie sont retenus comme de vrais trous.
    const SEUIL_TROU_SIGNIFICATIF_SECONDES = 1;
    const trous = [];
    let curseur = t0;
    fusionnes.forEach(intervalle => {
      if (intervalle.debut > curseur) {
        const dureeSecondes = Math.round((intervalle.debut - curseur) / 1000);
        if (dureeSecondes >= SEUIL_TROU_SIGNIFICATIF_SECONDES) {
          trous.push({ debut: new Date(curseur).toISOString(), fin: new Date(intervalle.debut).toISOString(), dureeSecondes });
        }
      }
      curseur = Math.max(curseur, intervalle.fin);
    });
    if (curseur < t1) {
      const dureeSecondes = Math.round((t1 - curseur) / 1000);
      if (dureeSecondes >= SEUIL_TROU_SIGNIFICATIF_SECONDES) {
        trous.push({ debut: new Date(curseur).toISOString(), fin: new Date(t1).toISOString(), dureeSecondes });
      }
    }

    const dureeCouverteSecondes = fusionnes.reduce((somme, i) => somme + Math.round((i.fin - i.debut) / 1000), 0);

    return {
      qualification: trous.length > 0 ? 'incomplete' : 'complete',
      motif: null, trous, dureeCouverteSecondes, dureeFenetreSecondes,
    };
  }

  global.NexusInventaireSnapshotMoteur = {
    SEUIL_DEFAUT_DELAI_MAX_MINUTES, NIVEAUX_CONFIANCE_SNAPSHOT,
    libelleConfianceSnapshot, libelleSourceHorodatage, libelleDelta,
    ordreExportDecenium, deltaSecondesSnapshot, qualifierSnapshotDecenium,
    qualifierReconstructionT0T1, classerQuartDansFenetre,
    agregerVentesParProduit, agregerMouvementsParProduit, agregerCorrectionsParProduit,
    reconstituerStockTheorique,
    libelleDureeTrou, fusionnerIntervallesCouverts, detecterTrousTemporels,
  };
})(typeof window !== 'undefined' ? window : globalThis);
