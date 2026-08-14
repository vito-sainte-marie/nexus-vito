// NEXUS Carburants — Réceptions — moteur de calcul partagé (14/08/2026)
//
// Origine : "Audit_NEXUS_Carburants_Receptions_Effet_Prix_Stock.pdf" de
// Frédéric (14/08/2026) — nouveau parcours Employé "Réception carburant"
// (calqué sur le formulaire papier existant) + sous-bloc "Qualité des
// réceptions" dans Carburants Pilotage. Priorité développeur P1 de l'audit.
//
// Règle de conception explicite de l'audit, structurante pour ce moteur :
// "L'employé saisit les faits. NEXUS calcule. Le manager qualifie
// uniquement lorsque les éléments sont suffisants." Conséquence directe :
// ce moteur peut proposer un statut initial ('a_completer', 'coherente',
// 'a_rapprocher') à partir des seuls faits saisis par l'employé, mais ne
// doit JAMAIS produire lui-même 'anomalie_confirmee' — cette qualification
// est une décision manager, réservée à la mise à jour côté Pilotage (voir
// RLS de carburant_receptions : UPDATE restreint à manager/gérant).
//
// Article 5 (non-invention) : trois vérités distinctes ne se substituent
// jamais l'une à l'autre — quantite_bl_l (le bon de livraison, ce que le
// fournisseur déclare), le jaugeage terrain (jaugeage_avant_l/
// jaugeage_apres_l, ce que l'employé mesure physiquement), et
// quantite_systeme_l (Insite360 ou autre système, saisi séparément, P3
// pour la connexion automatique). Ce moteur calcule des ÉCARTS entre ces
// vérités, ne recopie jamais l'une sur l'autre.
//
// Schéma consommé (migration Supabase "carburant_receptions_p1",
// 14/08/2026) :
//   carburant_receptions (1 ligne par carburant livré) : quantite_bl_l,
//     quantite_systeme_l, statut, heure_debut, heure_fin, ...
//   carburant_reception_mesures (1 ligne par cuve de destination) :
//     jaugeage_avant_l, jaugeage_avant_le, jaugeage_apres_l,
//     jaugeage_apres_le, delta_mesure_l, ventes_pendant_livraison_l,
//     reception_corrigee_l.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul, même
// discipline que nexus-carburant-moteur.js (à qui ce fichier est un
// complément, pas un remplaçant — les deux coexistent).
// Inclure : <script src="nexus-reception-moteur.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Seuil provisoire, non recalibré (même esprit que SEUIL_ECART_PCT_* de
  // nexus-carburant-moteur.js) — aucune donnée réelle de plusieurs
  // réceptions n'est encore disponible pour calibrer ce seuil ; à ajuster
  // avec Frédéric une fois quelques semaines de réceptions réelles saisies.
  // Volontairement plus large que les seuils du contrôle quotidien
  // (1 %/3 %) : une livraison est un événement ponctuel de gros volume, où
  // l'imprécision de jaugeage manuel pèse proportionnellement plus qu'un
  // stock cumulé sur une journée.
  const SEUIL_ECART_RECEPTION_PCT_RAPPROCHER = 0.02; // 2 %

  const LIBELLES_STATUT = {
    a_completer: 'À compléter',
    coherente: 'Cohérente',
    a_rapprocher: 'À rapprocher',
    anomalie_confirmee: 'Anomalie confirmée',
  };

  // ============================================================
  // FAITS TERRAIN — variation de cuve mesurée pendant la livraison.
  // ============================================================

  // Variation de cuve pendant la livraison (jaugeage après - jaugeage
  // avant). Null si l'un des deux jaugeages manque — jamais déduit d'une
  // seule mesure (Article 5).
  function calculerDeltaMesure(jaugeageAvantL, jaugeageApresL) {
    if (jaugeageAvantL == null || jaugeageApresL == null) return null;
    return Number(jaugeageApresL) - Number(jaugeageAvantL);
  }

  // "Réception corrigée" (audit §3.3) = variation de cuve + ventes
  // réalisées PENDANT la fenêtre de livraison (des ventes ont pu continuer
  // au poste pendant que le camion livrait, ce qui fait paraître la
  // variation de cuve plus faible que la quantité réellement livrée).
  // `ventesPendantLivraisonL` doit venir d'un rapprochement explicite avec
  // audits_caisse sur la fenêtre [heure_debut, heure_fin] — non calculé en
  // P1 (colonnes créées, calcul différé à P2). Tant que cette valeur n'est
  // pas fournie, retourne null plutôt que de supposer zéro vente pendant
  // la livraison (Article 5 : un zéro non vérifié n'est pas un fait).
  function calculerReceptionCorrigee(deltaMesureL, ventesPendantLivraisonL) {
    if (deltaMesureL == null || ventesPendantLivraisonL == null) return null;
    return deltaMesureL + Number(ventesPendantLivraisonL);
  }

  // ============================================================
  // ÉCARTS ENTRE VÉRITÉS DISTINCTES — jamais un remplacement d'une valeur
  // par une autre, uniquement des écarts calculés en lecture seule.
  // ============================================================

  // Écart terrain vs BL. Utilise la réception corrigée si elle est
  // disponible (P2), sinon retombe sur la variation de cuve brute (P1) —
  // toujours la meilleure mesure terrain disponible à cet instant, jamais
  // un mélange des deux dans le même calcul.
  function calculerEcartTerrainBl(deltaMesureL, quantiteBlL, receptionCorrigeeL) {
    const mesureTerrain = receptionCorrigeeL != null ? receptionCorrigeeL : deltaMesureL;
    if (mesureTerrain == null || quantiteBlL == null) return null;
    return mesureTerrain - Number(quantiteBlL);
  }

  // Écart système (Insite360/autre) vs BL. Retourne null si la quantité
  // système n'est pas encore renseignée — le cas normal tant que la
  // connexion Insite360 (P3) n'existe pas et que la saisie manuelle
  // optionnelle n'a pas été faite.
  function calculerEcartSystemeBl(quantiteSystemeL, quantiteBlL) {
    if (quantiteSystemeL == null || quantiteBlL == null) return null;
    return Number(quantiteSystemeL) - Number(quantiteBlL);
  }

  // Ratio écart/BL (0.02 = 2 %) — le BL est la référence documentaire de
  // la livraison, dénominateur naturel de l'écart de réception (même
  // logique que le ratio écart/ventes du contrôle quotidien). Null si le
  // BL est nul ou manquant (pas de division par zéro, pas de ratio
  // fabriqué).
  function calculerEcartRatio(ecartL, quantiteBlL) {
    if (ecartL == null || !quantiteBlL) return null;
    return ecartL / Number(quantiteBlL);
  }

  // ============================================================
  // STATUT — proposition automatique limitée à 3 des 4 statuts de l'audit
  // (§4.3). 'anomalie_confirmee' est EXCLUSIVEMENT une décision manager
  // (voir en-tête) : ce moteur ne le retourne jamais.
  // ============================================================

  // `ctx` = { jaugeageApresL, quantiteBlL, ecartTerrainBl, ecartRatioTerrainBl }
  // - jaugeageApresL absent → la mesure terrain n'est pas terminée, rien à
  //   qualifier : 'a_completer'.
  // - quantiteBlL absent → le BL n'a pas encore été renseigné (cas rare,
  //   l'écran employé le rend obligatoire, mais le moteur reste honnête si
  //   appelé sur des données partielles) : 'a_completer'.
  // - écart dans le seuil : 'coherente'.
  // - écart hors seuil : 'a_rapprocher' — le manager doit qualifier plus
  //   avant, jamais 'anomalie_confirmee' automatique.
  function statutInitialReception(ctx) {
    const c = ctx || {};
    if (c.jaugeageApresL == null || c.quantiteBlL == null) return 'a_completer';
    if (c.ecartRatioTerrainBl == null) return 'a_completer';
    const abs = Math.abs(c.ecartRatioTerrainBl);
    return abs <= SEUIL_ECART_RECEPTION_PCT_RAPPROCHER ? 'coherente' : 'a_rapprocher';
  }

  // Assemble le résultat complet d'une mesure de réception (delta, écarts,
  // statut proposé) à partir des faits bruts — évite qu'un appelant
  // recompose les fonctions ci-dessus dans un ordre différent (Article 11).
  function calculerReception({ jaugeageAvantL, jaugeageApresL, quantiteBlL, quantiteSystemeL, ventesPendantLivraisonL }) {
    const deltaMesureL = calculerDeltaMesure(jaugeageAvantL, jaugeageApresL);
    const receptionCorrigeeL = calculerReceptionCorrigee(deltaMesureL, ventesPendantLivraisonL);
    const ecartTerrainBl = calculerEcartTerrainBl(deltaMesureL, quantiteBlL, receptionCorrigeeL);
    const ecartRatioTerrainBl = calculerEcartRatio(ecartTerrainBl, quantiteBlL);
    const ecartSystemeBl = calculerEcartSystemeBl(quantiteSystemeL, quantiteBlL);
    const ecartRatioSystemeBl = calculerEcartRatio(ecartSystemeBl, quantiteBlL);
    const statut = statutInitialReception({ jaugeageApresL, quantiteBlL, ecartTerrainBl, ecartRatioTerrainBl });
    return {
      deltaMesureL, receptionCorrigeeL,
      ecartTerrainBl, ecartRatioTerrainBl,
      ecartSystemeBl, ecartRatioSystemeBl,
      statut,
    };
  }

  // Statut global d'une réception à plusieurs cuves (ex. Gasoil sur cuve1 +
  // cuve2) — le PIRE statut des mesures, jamais une moyenne (même
  // discipline que statutGlobalControle() de nexus-carburant-moteur.js) :
  // un écart sur une seule cuve ne doit jamais être dilué par une autre
  // cuve cohérente. 'a_rapprocher' prime sur 'a_completer' (un écart réel
  // détecté est plus significatif qu'une mesure simplement pas encore
  // terminée) — jamais 'anomalie_confirmee' (voir en-tête).
  const ORDRE_GRAVITE_RECEPTION = ['a_rapprocher', 'a_completer', 'coherente'];
  function statutGlobalReception(statuts) {
    if (!statuts || !statuts.length) return 'a_completer';
    return ORDRE_GRAVITE_RECEPTION.find(s => statuts.includes(s)) || 'a_completer';
  }

  // ============================================================
  // COHÉRENCE CHRONOLOGIQUE — l'audit insiste sur l'horodatage précis de
  // chaque étape (début/fin livraison, chaque jaugeage). Validation simple
  // avant soumission employé : chaque "après" doit être postérieur à son
  // "avant" correspondant. Ne bloque rien côté données déjà enregistrées,
  // sert uniquement à guider la saisie (l'écran, pas la base).
  // ============================================================

  function chronologieValide({ heureDebut, heureFin, jaugeageAvantLe, jaugeageApresLe }) {
    const erreurs = [];
    const toTime = v => (v ? new Date(v).getTime() : null);
    const debut = toTime(heureDebut), fin = toTime(heureFin);
    const avant = toTime(jaugeageAvantLe), apres = toTime(jaugeageApresLe);
    if (debut != null && fin != null && fin < debut) erreurs.push('L\'heure de fin de livraison est antérieure à l\'heure de début.');
    if (avant != null && apres != null && apres < avant) erreurs.push('Le jaugeage après est antérieur au jaugeage avant.');
    if (debut != null && avant != null && avant < debut) erreurs.push('Le jaugeage avant est antérieur au début de la livraison.');
    if (fin != null && apres != null && apres < fin) { /* toléré : le jaugeage après peut suivre de peu la fin, non bloquant */ }
    return { valide: erreurs.length === 0, erreurs };
  }

  // ============================================================
  // AFFICHAGE — libellé + niveau de gravité pour un statut de réception,
  // même convention (texte/niveau) que fiabiliteControle() de
  // nexus-carburant-moteur.js pour rester cohérent visuellement entre les
  // deux moteurs sur le même écran Pilotage.
  // ============================================================

  function libelleStatutReception(statut) {
    switch (statut) {
      case 'coherente': return { texte: LIBELLES_STATUT.coherente, niveau: 'ok' };
      case 'a_rapprocher': return { texte: LIBELLES_STATUT.a_rapprocher, niveau: 'attention' };
      case 'anomalie_confirmee': return { texte: LIBELLES_STATUT.anomalie_confirmee, niveau: 'alerte' };
      case 'a_completer':
      default: return { texte: LIBELLES_STATUT.a_completer, niveau: 'attente' };
    }
  }

  // Formate un écart en texte court, même convention que les autres
  // moteurs NEXUS (signe explicite, séparateur milliers fr-FR).
  function texteEcart(ecartL, ecartRatio) {
    if (ecartL == null) return 'non calculable';
    const litres = `${ecartL >= 0 ? '+' : ''}${Math.round(ecartL).toLocaleString('fr-FR')} L`;
    if (ecartRatio == null) return litres;
    return `${litres} (${(ecartRatio * 100).toFixed(1)} % du BL)`;
  }

  global.NexusReceptionMoteur = {
    LIBELLES_STATUT, SEUIL_ECART_RECEPTION_PCT_RAPPROCHER,
    calculerDeltaMesure, calculerReceptionCorrigee,
    calculerEcartTerrainBl, calculerEcartSystemeBl, calculerEcartRatio,
    statutInitialReception, calculerReception,
    statutGlobalReception,
    chronologieValide,
    libelleStatutReception, texteEcart,
  };
})(typeof window !== 'undefined' ? window : globalThis);
