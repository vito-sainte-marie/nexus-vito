// NEXUS Carburants — Réceptions — moteur de calcul partagé (v2, 15/08/2026)
//
// Réécriture complète à partir de la demande détaillée de Frédéric
// ("Demande d'évolution — Module NEXUS Réception Carburant") : le parcours
// employé change de modèle — d'une réception "par carburant, répétée N
// fois" (v1, 14/08/2026) à une VISITE camion unique pouvant porter
// plusieurs carburants dans des compartiments différents, avec un vrai
// contrôle central (compartiments vs BL) qui peut BLOQUER la suite du
// parcours. Aucune ligne n'existait encore dans l'ancien schéma
// (carburant_receptions : 0 ligne) — recréation propre côté base
// (migration "carburant_receptions_visite_v2"), ce fichier réécrit en
// conséquence plutôt que patché.
//
// Principe NEXUS explicitement rappelé par Frédéric, structurant pour tout
// ce fichier : "Le document annonce. Le pompiste constate. NEXUS rapproche.
// Une anomalie est signalée. Le manager décide. L'historique permet
// ensuite d'apprendre le comportement réel de la station." — traduit ici
// en une règle stricte : L'EMPLOYÉ NE DOIT JAMAIS DEVOIR DÉCIDER LUI-MÊME
// SI UN ÉCART EST "NORMAL". Ce moteur ne retourne jamais un jugement
// définitif ('anomalie_confirmee') — uniquement des faits, des écarts, et
// une proposition de statut que le manager peut requalifier ailleurs.
//
// Article 5 (non-invention) : trois vérités distinctes ne se substituent
// jamais l'une à l'autre — quantité BL (documentaire), compartiments
// (déclaration terrain au chargement), jaugeage (mesure terrain à la
// livraison). Ce moteur calcule des ÉCARTS entre ces vérités, ne recopie
// jamais l'une sur l'autre, et ne fabrique jamais un jugement
// ("supérieur au comportement habituel") sans échantillon suffisant.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul, même
// discipline que nexus-carburant-moteur.js et nexus-fdj-moteur.js.
// Inclure : <script src="nexus-reception-moteur.js?v=20260903-1247"></script>
// ------------------------------------------------------------

(function (global) {
  // Seuils par défaut si le site n'a pas encore configuré
  // reception_carburant_config (station_config) — jamais un seuil différent
  // codé en dur ailleurs dans ce fichier ou dans l'écran (Article 11).
  const SEUIL_ECART_COMPARTIMENTS_PCT_DEFAUT = 2; // %
  const SEUIL_ECART_MESURE_PCT_DEFAUT = 2; // %
  // Nombre minimal de réceptions passées (même carburant, même site) avant
  // de pouvoir dire qu'un écart est "supérieur au comportement habituel" —
  // en dessous, aucune comparaison n'est affichée (Article 5 : un
  // échantillon de 1 ou 2 réceptions ne permet de fabriquer aucune norme).
  const ECHANTILLON_MIN_HISTORIQUE = 3;
  // Un écart est jugé "supérieur au comportement habituel" s'il dépasse ce
  // multiplicateur de la moyenne des écarts absolus passés — valeur
  // provisoire (même esprit que les seuils %, à recalibrer avec Frédéric
  // une fois plusieurs semaines de réceptions réelles disponibles).
  const MULTIPLICATEUR_HISTORIQUE_INHABITUEL = 1.5;

  const CARBURANTS = ['sp95', 'go', 'gnr'];
  const LABELS_CARBURANT = { sp95: 'SP95', go: 'GO', gnr: 'GNR' };

  const LIBELLES_STATUT = {
    a_completer: 'À compléter',
    coherente: 'Cohérente',
    a_rapprocher: 'À rapprocher',
  };

  // Motifs de non-réception d'un compartiment (Étape 4, écran "pourquoi ce
  // compartiment n'a-t-il pas été réceptionné ?") — liste fermée, reflète
  // exactement les 6 options de la demande de Frédéric. `bloquant: false`
  // (oubli_validation uniquement) permet à l'employé de revenir sur le
  // compartiment sans intervention manager ; tous les autres motifs
  // bloquent la suite du parcours tant qu'un manager n'a pas levé
  // l'anomalie (déverrouillage tracé, voir verifierAnomalieBloquante /
  // construireDerogationManager côté écran).
  const MOTIFS_NON_RECEPTION = {
    oubli_validation: { label: 'Oubli de validation', bloquant: false, message: 'Vous pouvez revenir sur ce compartiment et le valider maintenant.' },
    compartiment_non_livre: { label: 'Compartiment non livré', bloquant: true, message: 'Contactez votre manager immédiatement.' },
    probleme_technique: { label: 'Problème technique', bloquant: true, message: 'Stoppez la procédure selon les règles de sécurité du site et contactez le manager.' },
    erreur_transporteur: { label: 'Erreur du transporteur', bloquant: true, message: 'Ne poursuivez pas sans vérification — contactez votre manager.' },
    produit_refuse: { label: 'Produit refusé', bloquant: true, message: 'Ne poursuivez pas sans vérification — contactez votre manager.' },
    autre: { label: 'Autre', bloquant: true, message: 'Ne poursuivez pas sans vérification — contactez votre manager.' },
  };

  function libelleMotifNonReception(motif) {
    return MOTIFS_NON_RECEPTION[motif] || { label: motif || '—', bloquant: true, message: 'Contactez votre manager.' };
  }

  // ============================================================
  // ÉCRAN — ORDRE DES CUVES (reproduit le Veeder-Root du site)
  // ============================================================

  // Construit la liste plate et ORDONNÉE de toutes les cuves actives d'un
  // site, pour les étapes 2/5 (jaugeage) — reproduit l'ordre physique réel
  // dans lequel un employé lit son Veeder-Root, jamais un ordre fixe
  // "SP95 puis GO puis GNR" codé en dur (demande explicite de Frédéric,
  // point 9 : "ordre des cuves" doit être configurable par station).
  // `cuvesCarburants` = station_config.cuves_carburants (groupé par
  // carburant, {actif, cuves:[{id,label,capacite}]}). `ordreCuves` =
  // station_config.reception_carburant_config.ordre_cuves — array
  // [{carburant, cuve_id}] dans l'ordre physique réel, ou null/absent pour
  // utiliser le repli déterministe (groupé par carburant, dans l'ordre
  // CARBURANTS = sp95/go/gnr, cuves dans leur ordre de configuration) —
  // jamais un ordre aléatoire.
  function construireListeCuvesOrdonnee(cuvesCarburants, ordreCuves) {
    const cfg = cuvesCarburants || {};
    if (Array.isArray(ordreCuves) && ordreCuves.length) {
      return ordreCuves
        .map(ref => {
          const groupe = cfg[ref.carburant];
          if (!groupe || !groupe.actif || !Array.isArray(groupe.cuves)) return null;
          const cuve = groupe.cuves.find(c => c.id === ref.cuve_id);
          return cuve ? { ...cuve, carburant: ref.carburant } : null;
        })
        .filter(Boolean);
    }
    const out = [];
    CARBURANTS.forEach(carb => {
      const groupe = cfg[carb];
      if (!groupe || !groupe.actif || !Array.isArray(groupe.cuves)) return;
      groupe.cuves.forEach(cuve => out.push({ ...cuve, carburant: carb }));
    });
    return out;
  }

  // ============================================================
  // ÉTAPE 1 → 3 — CONTRÔLE COMPARTIMENTS VS BL
  // ============================================================

  // Somme des compartiments déclarés, groupée par carburant. `compartiments`
  // = [{ carburant, quantite_declaree_l }]. Ignore les compartiments non
  // encore assignés (carburant null) — un compartiment "vide" ne doit
  // jamais compter comme 0 L d'un carburant qu'il ne porte pas forcément.
  function sommeCompartimentsParCarburant(compartiments) {
    const out = {};
    (compartiments || []).forEach(c => {
      if (!c.carburant) return;
      out[c.carburant] = (out[c.carburant] || 0) + (Number(c.quantite_declaree_l) || 0);
    });
    return out;
  }

  // Compare, pour chaque carburant annoncé au BL (lignesAttendues =
  // [{carburant, quantite_bl_l}]), le total des compartiments déclarés à
  // la quantité BL. `seuilPct` vient de
  // station_config.reception_carburant_config.seuil_ecart_compartiments_pct
  // (jamais un seuil fabriqué ici si absent : repli explicite sur la
  // constante par défaut, jamais un silence). Retourne un résultat par
  // carburant + une liste des carburants en anomalie (ceux qui dépassent le
  // seuil) — jamais un seul "coherent: true/false" global qui masquerait
  // quel carburant précisément pose problème (le manager doit savoir
  // lequel).
  function verifierCompartimentsVsBl(lignesAttendues, compartiments, seuilPct) {
    const seuil = (seuilPct != null ? seuilPct : SEUIL_ECART_COMPARTIMENTS_PCT_DEFAUT) / 100;
    const declareParCarburant = sommeCompartimentsParCarburant(compartiments);
    const parCarburant = {};
    const carburantsEnAnomalie = [];
    (lignesAttendues || []).forEach(l => {
      const attendu = Number(l.quantite_bl_l) || 0;
      const declare = declareParCarburant[l.carburant] || 0;
      const ecart = declare - attendu;
      const ecartPct = attendu > 0 ? ecart / attendu : null;
      const coherent = attendu > 0 && ecartPct != null && Math.abs(ecartPct) <= seuil;
      parCarburant[l.carburant] = { attendu, declare, ecart, ecartPct, coherent };
      if (!coherent) carburantsEnAnomalie.push(l.carburant);
    });
    return { parCarburant, coherentGlobal: carburantsEnAnomalie.length === 0, carburantsEnAnomalie };
  }

  // ============================================================
  // ÉTAPE 4 — RÉCEPTION COMPARTIMENT PAR COMPARTIMENT
  // ============================================================

  // Un compartiment bloque la suite du parcours (impossible de passer à
  // l'étape 5) s'il n'est ni réceptionné, ni excusé par un motif non
  // bloquant (oubli_validation) déjà résolu. `compartiments` =
  // [{numero, statut, motif_non_receptionne}].
  function compartimentsBloquants(compartiments) {
    return (compartiments || []).filter(c => {
      if (c.statut === 'receptionne') return false;
      if (c.statut !== 'non_receptionne') return true; // 'a_receptionner' : pas encore traité, bloque tant que non traité
      const motif = libelleMotifNonReception(c.motif_non_receptionne);
      return motif.bloquant;
    });
  }

  function tousCompartimentsTraites(compartiments) {
    return compartimentsBloquants(compartiments).length === 0;
  }

  // ============================================================
  // ÉTAPES 2 & 5 — JAUGEAGE, DELTA PAR CUVE, AGRÉGATION PAR CARBURANT
  // ============================================================

  // Variation de cuve pendant la livraison. Null si l'un des deux jaugeages
  // manque — jamais déduit d'une seule mesure (Article 5).
  function calculerDeltaMesure(jaugeageAvantL, jaugeageApresL) {
    if (jaugeageAvantL == null || jaugeageApresL == null) return null;
    return Number(jaugeageApresL) - Number(jaugeageAvantL);
  }

  // Agrège les deltas de cuve par carburant. `mesures` =
  // [{carburant, jaugeage_avant_l, jaugeage_apres_l}]. Un carburant dont au
  // moins une cuve n'a pas encore de jaugeage après reste `null` (mesure
  // incomplète), jamais une somme partielle silencieuse.
  function agregerDeltaParCarburant(mesures) {
    const out = {};
    const incomplet = {};
    (mesures || []).forEach(m => {
      if (!m.carburant) return;
      const delta = calculerDeltaMesure(m.jaugeage_avant_l, m.jaugeage_apres_l);
      if (delta == null) { incomplet[m.carburant] = true; return; }
      out[m.carburant] = (out[m.carburant] || 0) + delta;
    });
    Object.keys(incomplet).forEach(c => { out[c] = null; });
    return out;
  }

  // ============================================================
  // RAPPROCHEMENT FINAL — les 3 vérités (prévu / compartiments / mesuré)
  // ============================================================

  function calculerEcartRatio(ecartL, referenceL) {
    if (ecartL == null || !referenceL) return null;
    return ecartL / Number(referenceL);
  }

  // `ctx` = { attenduL, compartimentsL, mesureL, seuilPct }. Calcule les 2
  // écarts pertinents pour le rapprochement final (compartiments vs BL,
  // déjà connu depuis l'étape 3 ; mesuré vs BL, la vraie mesure terrain) et
  // propose un statut. 'a_completer' tant que le jaugeage n'est pas
  // terminé ; jamais 'anomalie_confirmee' — décision manager exclusive
  // (même garde que le moteur v1).
  function calculerReceptionCarburant({ attenduL, compartimentsL, mesureL, seuilPct }) {
    const seuil = (seuilPct != null ? seuilPct : SEUIL_ECART_MESURE_PCT_DEFAUT) / 100;
    const ecartCompartimentsL = (compartimentsL != null && attenduL != null) ? compartimentsL - attenduL : null;
    const ecartCompartimentsRatio = calculerEcartRatio(ecartCompartimentsL, attenduL);
    const ecartMesureL = (mesureL != null && attenduL != null) ? mesureL - attenduL : null;
    const ecartMesureRatio = calculerEcartRatio(ecartMesureL, attenduL);
    let statut = 'a_completer';
    if (mesureL != null && attenduL != null && ecartMesureRatio != null) {
      statut = Math.abs(ecartMesureRatio) <= seuil ? 'coherente' : 'a_rapprocher';
    }
    return {
      attenduL, compartimentsL, mesureL,
      ecartCompartimentsL, ecartCompartimentsRatio,
      ecartMesureL, ecartMesureRatio,
      statut,
    };
  }

  // Pire statut parmi plusieurs carburants d'une même visite — jamais une
  // moyenne (même discipline que statutGlobalReception v1 / autres moteurs
  // NEXUS) : un écart sur un seul carburant ne doit jamais être dilué par
  // un autre carburant cohérent.
  const ORDRE_GRAVITE = ['a_rapprocher', 'a_completer', 'coherente'];
  function statutGlobalVisite(statuts) {
    if (!statuts || !statuts.length) return 'a_completer';
    return ORDRE_GRAVITE.find(s => statuts.includes(s)) || 'a_completer';
  }

  // ============================================================
  // COMPARAISON À L'HISTORIQUE — "cette différence est-elle supérieure au
  // comportement habituel observé sur les précédentes réceptions ?"
  // ============================================================

  // `ecartsRatioHistoriques` = tableau de ratios (nombres, positifs ou
  // négatifs) des réceptions passées du même carburant/site, les plus
  // récentes en premier ou dans n'importe quel ordre (non trié ici).
  // Retourne `comparable:false` si l'échantillon est trop petit — dans ce
  // cas, l'écran ne doit RIEN affirmer sur le caractère habituel ou non de
  // l'écart (Article 5), uniquement montrer le delta brut.
  function comparerHistorique(ecartRatioActuel, ecartsRatioHistoriques) {
    const echantillon = (ecartsRatioHistoriques || []).filter(v => v != null);
    if (ecartRatioActuel == null || echantillon.length < ECHANTILLON_MIN_HISTORIQUE) {
      return { comparable: false, moyenneAbsHistorique: null, superieurHabituel: null, tailleEchantillon: echantillon.length };
    }
    const moyenneAbsHistorique = echantillon.reduce((s, v) => s + Math.abs(v), 0) / echantillon.length;
    const superieurHabituel = Math.abs(ecartRatioActuel) > moyenneAbsHistorique * MULTIPLICATEUR_HISTORIQUE_INHABITUEL;
    return { comparable: true, moyenneAbsHistorique, superieurHabituel, tailleEchantillon: echantillon.length };
  }

  // ============================================================
  // SIGNATURE DELTA LIVRAISON — Sprint C7 "Analyse" (17/08/2026, audit §4 :
  // "Analyse statistique des deltas — pas de signature de réception propre
  // au site", roadmap "Signature delta livraison / statistiques", critère
  // de sortie "Historique suffisant et fiable"). Distincte de
  // comparerHistorique() ci-dessus, qui reste la comparaison LIVE utilisée
  // pendant le parcours employé (moyenne des écarts absolus, alerte
  // immédiate) — ici, on caractérise la distribution elle-même (médiane +
  // dispersion robuste) pour que le MANAGER puisse consulter après coup le
  // profil habituel du site, indépendamment d'une réception précise.
  // Médiane/MAD (écart absolu médian) plutôt que moyenne/écart-type :
  // robuste à un ou deux deltas exceptionnels dans un échantillon encore
  // petit (quelques dizaines de réceptions), sans qu'un seul incident ne
  // déplace toute la signature (Article 5 : la preuve doit rester honnête
  // même sur peu de données).
  // ============================================================
  const FACTEUR_DISPERSION_INHABITUEL = 3;
  // Jamais un seuil nul même si l'historique du site est parfaitement
  // stable (dispersion mesurée à 0) — 1 point de pourcentage plancher,
  // sinon la moindre variation future serait signalée à tort.
  const PLANCHER_DISPERSION_RATIO = 0.01;

  function medianeTrie(valeursTriees) {
    const n = valeursTriees.length;
    if (!n) return null;
    const milieu = Math.floor(n / 2);
    return n % 2 === 0 ? (valeursTriees[milieu - 1] + valeursTriees[milieu]) / 2 : valeursTriees[milieu];
  }

  // `ecartsRatioHistoriques` : même donnée source que comparerHistorique
  // (carburant_reception_visite_lignes.delta_ratio). En dessous du seuil
  // d'échantillon minimal, `suffisant:false` — aucune médiane/dispersion
  // n'est fabriquée sur un historique trop court (même discipline que
  // comparerHistorique/Article 5).
  function signatureDeltaLivraison(ecartsRatioHistoriques) {
    const echantillon = (ecartsRatioHistoriques || []).filter(v => v != null).slice().sort((a, b) => a - b);
    if (echantillon.length < ECHANTILLON_MIN_HISTORIQUE) {
      return { suffisant: false, tailleEchantillon: echantillon.length, mediane: null, dispersion: null };
    }
    const mediane = medianeTrie(echantillon);
    const ecartsAbsolusMediane = echantillon.map(v => Math.abs(v - mediane)).sort((a, b) => a - b);
    const dispersion = medianeTrie(ecartsAbsolusMediane);
    return { suffisant: true, tailleEchantillon: echantillon.length, mediane, dispersion };
  }

  // Situe un delta ponctuel (nouvelle réception) par rapport à la signature
  // déjà calculée du site — jamais "anormal"/"perte", toujours "dans la
  // normale du site" / "au-delà de l'habituel" avec les chiffres à l'appui.
  function situerFaceSignature(ecartRatio, signature) {
    if (ecartRatio == null || !signature || !signature.suffisant) {
      return {
        position: 'indetermine',
        texte: `Historique encore insuffisant pour situer cet écart par rapport au profil habituel du site (au moins ${ECHANTILLON_MIN_HISTORIQUE} réceptions nécessaires).`,
      };
    }
    const seuil = Math.max(signature.dispersion * FACTEUR_DISPERSION_INHABITUEL, PLANCHER_DISPERSION_RATIO);
    const inhabituel = Math.abs(ecartRatio - signature.mediane) > seuil;
    const medianeTxt = `${(signature.mediane * 100).toFixed(1)} %`;
    const texte = inhabituel
      ? `Écart au-delà du profil habituel du site (médiane ${medianeTxt} sur ${signature.tailleEchantillon} réceptions) — vérification manager recommandée.`
      : `Écart cohérent avec le profil habituel du site (médiane ${medianeTxt} sur ${signature.tailleEchantillon} réceptions).`;
    return { position: inhabituel ? 'inhabituel' : 'normal', texte };
  }

  // ============================================================
  // AFFICHAGE
  // ============================================================

  function libelleStatutReception(statut) {
    switch (statut) {
      case 'coherente': return { texte: LIBELLES_STATUT.coherente, niveau: 'ok' };
      case 'a_rapprocher': return { texte: LIBELLES_STATUT.a_rapprocher, niveau: 'attention' };
      case 'a_completer':
      default: return { texte: LIBELLES_STATUT.a_completer, niveau: 'attente' };
    }
  }

  function texteEcart(ecartL, ecartRatio) {
    if (ecartL == null) return 'non calculable';
    const litres = `${ecartL >= 0 ? '+' : ''}${Math.round(ecartL).toLocaleString('fr-FR')} L`;
    if (ecartRatio == null) return litres;
    return `${litres} (${(ecartRatio * 100).toFixed(1)} %)`;
  }

  // Phrase de lecture NEXUS pour un écart de rapprochement — jamais un
  // jugement brut ("433 L perdus"), toujours un constat factuel + la
  // comparaison historique si elle est disponible (demande explicite de
  // Frédéric, point 5 de la spec).
  function phraseRapprochement(carburantLabel, ecartL, ecartRatio, comparaisonHistorique) {
    if (ecartL == null) return `${carburantLabel} : mesure incomplète, écart non calculable.`;
    const base = `Écart de réception détecté sur ${carburantLabel} : ${texteEcart(ecartL, ecartRatio)}.`;
    if (!comparaisonHistorique || !comparaisonHistorique.comparable) return base;
    if (comparaisonHistorique.superieurHabituel) {
      return `${base} Cette différence est supérieure au comportement habituel observé sur les précédentes réceptions ${carburantLabel}. Une vérification manager est recommandée.`;
    }
    return `${base} Cet écart reste dans le comportement habituel observé sur les précédentes réceptions ${carburantLabel}.`;
  }

  global.NexusReceptionMoteur = {
    CARBURANTS, LABELS_CARBURANT,
    LIBELLES_STATUT, MOTIFS_NON_RECEPTION,
    SEUIL_ECART_COMPARTIMENTS_PCT_DEFAUT, SEUIL_ECART_MESURE_PCT_DEFAUT,
    ECHANTILLON_MIN_HISTORIQUE, MULTIPLICATEUR_HISTORIQUE_INHABITUEL,
    libelleMotifNonReception,
    construireListeCuvesOrdonnee,
    sommeCompartimentsParCarburant, verifierCompartimentsVsBl,
    compartimentsBloquants, tousCompartimentsTraites,
    calculerDeltaMesure, agregerDeltaParCarburant,
    calculerEcartRatio, calculerReceptionCarburant, statutGlobalVisite,
    comparerHistorique,
    signatureDeltaLivraison, situerFaceSignature,
    libelleStatutReception, texteEcart, phraseRapprochement,
  };
})(typeof window !== 'undefined' ? window : globalThis);
