// NEXUS Carburants — moteur de calcul partagé (10/08/2026)
//
// Origine : demande de Frédéric ("je ne veux pas qu'on s'éparpille, je veux
// qu'on reste focus sur la philosophie NEXUS") — son vrai problème n'est
// pas un manque de données, c'est la ressaisie : le litrage vendu par
// carburant existe déjà, quart par quart, dans audits_caisse
// (litrage_gazole/sp95/gnr, saisi une seule fois dans NEXUS Verify). Ce
// moteur ne redemande JAMAIS cette donnée — il consomme les ventes déjà
// captées et ne calcule que ce qui manque réellement : stock théorique,
// écart, statut.
//
// Fidèle au fichier réel de Frédéric ("Variation carburant 2026.xlsx",
// analysé le 10/08/2026) pour la structure (Gasoil sur DEUX cuves physiques
// distinctes — 20000 L + 10000 L, additionnées ; SP95 et GNR sur une seule
// cuve chacun) et pour la définition de l'écart (%) : écart / ventes (ratio,
// jamais écart / théorique) — exactement la formule Excel H=ROUND(G/F,2).
//
// Écart volontaire avec le fichier Excel (décision de Frédéric, 10/08/2026,
// après qu'on lui a montré la dérive réelle sur son propre fichier : écart
// SP95 déjà à -575 L le tout premier jour de suivi, dérivant lentement
// jusqu'à -900/-1000 L en juillet, un chiffre quasi constant qui ne dit plus
// rien du jour présent) : dans Excel, THEORIQUE(jour N) = THEORIQUE(jour N-1)
// + LIVRAISON - VENTES — une chaîne jamais recalée sur une vraie mesure, qui
// accumule sa dérive sur des mois. Ici, THEORIQUE(jour N) = dernier STOCK
// RÉEL MESURÉ (pas le théorique) + LIVRAISON - VENTES depuis cette mesure :
// l'écart repart de zéro à chaque relevé physique, jamais de cumul invisible.
// Aucun changement de saisie pour Frédéric — uniquement une formule plus
// honnête (Article 5, "vérité avant certitude").
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-carburant-moteur.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Seuils provisoires, non recalibrés (même esprit que les autres seuils
  // NEXUS documentés comme provisoires) — à ajuster une fois plusieurs
  // semaines d'écarts réels disponibles avec la formule corrigée.
  const SEUIL_ECART_PCT_SURVEILLER = 0.01; // 1 %
  const SEUIL_ECART_PCT_CORRIGER = 0.03;   // 3 %

  // Gasoil réparti sur deux cuves physiques (20000 L + 10000 L) — total
  // fiable seulement si les DEUX cuves ont été relevées (jamais une somme
  // partielle qui masquerait un oubli de relevé sur une cuve).
  function stockReelGoTotal(releve) {
    if (!releve || releve.stock_reel_go_cuve1 == null || releve.stock_reel_go_cuve2 == null) return null;
    return Number(releve.stock_reel_go_cuve1) + Number(releve.stock_reel_go_cuve2);
  }

  // Somme des ventes déjà captées dans audits_caisse (litrage_gazole/sp95/
  // gnr) sur une période donnée. `lignes` : tableau d'objets
  // { litrage_gazole, litrage_sp95, litrage_gnr } (quarts audits_caisse déjà
  // filtrés par l'appelant sur la bonne plage de dates/site). Retourne null
  // pour un carburant si AUCUNE ligne de la période n'a de litrage renseigné
  // (donnée insuffisante plutôt qu'un zéro qui laisserait croire à des
  // ventes nulles).
  function sommerVentesPeriode(lignes) {
    const champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    const resultat = {};
    Object.entries(champs).forEach(([cle, champ]) => {
      let somme = 0, trouve = false;
      (lignes || []).forEach(l => {
        if (l && l[champ] != null) { somme += Number(l[champ]); trouve = true; }
      });
      resultat[cle] = trouve ? somme : null;
    });
    return resultat;
  }

  // Stock théorique du jour — voir la note d'en-tête pour la formule
  // corrigée (recalée sur le dernier stock réel, jamais sur une chaîne de
  // théoriques). `dernierReel` : dernier stock physiquement mesuré avant ce
  // relevé (n'importe quel carburant). `ventes` : somme des ventes captées
  // depuis ce dernier relevé (peut être null = donnée insuffisante).
  function calculerTheorique(dernierReel, livraison, mouvement, ventes) {
    if (dernierReel == null || ventes == null) return null;
    return dernierReel + (livraison || 0) + (mouvement || 0) - ventes;
  }

  function calculerEcart(reel, theorique) {
    if (reel == null || theorique == null) return null;
    return reel - theorique;
  }

  // Ratio écart/ventes (pas écart/théorique) — fidèle à la formule réelle du
  // fichier Excel de Frédéric (H=ROUND(G/F,2)). Retourne un ratio (0.25 =
  // 25 %), à multiplier par 100 uniquement à l'affichage.
  function calculerEcartRatio(ecart, ventes) {
    if (ecart == null || !ventes) return null;
    return ecart / ventes;
  }

  function statutCarburant(ecartRatio) {
    if (ecartRatio == null) return 'Données insuffisantes';
    const abs = Math.abs(ecartRatio);
    if (abs <= SEUIL_ECART_PCT_SURVEILLER) return 'Sous contrôle';
    if (abs <= SEUIL_ECART_PCT_CORRIGER) return 'À surveiller';
    return 'À corriger';
  }

  // Assemble le résultat complet d'un carburant (théorique, écart, ratio,
  // statut) à partir des mêmes entrées brutes — évite qu'un appelant
  // recompose les 4 fonctions ci-dessus dans un ordre différent.
  function calculerCarburant({ dernierReel, reelDuJour, livraison, mouvement, ventes }) {
    const theorique = calculerTheorique(dernierReel, livraison, mouvement, ventes);
    const ecart = calculerEcart(reelDuJour, theorique);
    const ecartRatio = calculerEcartRatio(ecart, ventes);
    return { theorique, ecart, ecartRatio, statut: statutCarburant(ecartRatio) };
  }

  global.NexusCarburantMoteur = {
    SEUIL_ECART_PCT_SURVEILLER, SEUIL_ECART_PCT_CORRIGER,
    stockReelGoTotal, sommerVentesPeriode,
    calculerTheorique, calculerEcart, calculerEcartRatio, statutCarburant,
    calculerCarburant,
  };
})(typeof window !== 'undefined' ? window : globalThis);
