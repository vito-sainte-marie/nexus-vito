// ============================================================
// NEXUS Secteurs — moteur de calcul partagé (11/08/2026)
//
// Née de l'audit stratégique de Frédéric
// ("NEXUS_Audit_Strategique_Brief_Rapport_Direction.pdf") : Brief NEXUS et
// Rapport NEXUS s'organisent désormais autour du "contrat commun d'un
// secteur" (Annexe A de l'audit : statut, évolution, indicateurs
// structurants, principale cause, principale force, principale fragilité,
// niveau de confiance, décision éventuelle, route vers le moteur/la preuve)
// — jamais un tableau de bord supplémentaire, l'équivalent numérique d'un
// directeur d'exploitation qui consolide l'information avant le dirigeant.
//
// Article 11 ("une seule vérité") : ce fichier ne RECALCULE jamais un
// résultat métier qui existe déjà ailleurs. Chaque constructeur de secteur
// assemble uniquement des valeurs déjà produites par nexus-boussole-moteur.js
// (Commerce/Marge/Opérations/Équipe), nexus-carburant-moteur.js (Carburants)
// ou déjà chargées par NEXUS-Brief-v1.html (FDJ, via chargerCandidatsFdj).
// Aucun accès Supabase ici (comme tout moteur NEXUS) — pures fonctions.
//
// Granularité stratégique (audit, "Règle de granularité" section 2 et
// critères d'acceptation section 20) : "Une référence produit ne remonte au
// Brief que si elle est structurante." estDecisionStrategique() est le
// filtre appliqué par NEXUS-Brief-v1.html AVANT de normaliser/fusionner les
// candidats Produits/Marge (nexus-conseiller.js) — ce fichier ne modifie
// jamais nexus-conseiller.js lui-même, la granularité est une politique
// d'affichage propre à Brief NEXUS, pas une règle générale du Conseiller
// (le Cockpit/Produits doit continuer à voir CHAQUE décision, y compris au
// niveau SKU).
//
// Inclure : <script src="nexus-secteurs-moteur.js"></script>
// (après nexus-boussole-moteur.js et nexus-carburant-moteur.js)
// ------------------------------------------------------------

(function (global) {
  function boussole() { return global.NexusBoussoleMoteur; }
  function carburantMoteur() { return global.NexusCarburantMoteur; }

  // ------------------------------------------------------------
  // Granularité stratégique (Bloc G de l'audit).
  // ------------------------------------------------------------
  //
  // Seuil de matérialité pour qu'une décision au niveau SKU (référence
  // produit individuelle, règles R2-BAISSE/R3-HAUSSE/R5-MARGE-ECART de
  // nexus-conseiller.js) remonte malgré tout au Brief dirigeant : première
  // valeur documentée comme un premier jet à ajuster avec l'usage réel
  // (même esprit que les seuils SEUIL_* de nexus-boussole-moteur.js,
  // "pondération provisoire, non recalibrée").
  const SEUIL_IMPACT_STRATEGIQUE_EUR = 500;
  // Une référence dont la contribution au CA de son rayon dépasse ce seuil
  // est déjà considérée structurante par nexus-conseiller.js lui-même
  // (règle R4-RENFORT-A, contribution >= 0.15) — repris ici à l'identique,
  // jamais une deuxième valeur qui pourrait diverger. Ce seuil est DÉJÀ
  // adaptatif à l'importance du secteur : un pourcentage du CA du rayon,
  // pas un montant fixe (P2.1 ne le touche pas).
  const SEUIL_CONTRIBUTION_STRATEGIQUE = 0.15;

  // Matérialité relative (12/08/2026, cadrage §4/§15, lot P2.1) : "Seuils
  // adaptatifs selon la taille du site et l'importance du secteur."
  // SEUIL_IMPACT_STRATEGIQUE_EUR (500 €, montant ABSOLU) ne s'adaptait pas
  // à la taille du site — vérifié en base sur le site pilote : CA total
  // produits sur 2 semaines (24/07-06/08/2026) = 65 907 €, sur 3 semaines
  // (01/07-23/07) = 113 279 € ; 500 € y représente 0,44 à 0,76 % du CA de
  // la période, une proportion cohérente à CETTE échelle. Le même montant
  // fixe deviendrait dérisoire sur un site bien plus gros (tout
  // paraîtrait "structurant") ou écrasant sur un site bien plus petit
  // (rien ne remonterait jamais) — exactement le défaut que l'audit
  // signale. `PROPORTION_IMPACT_STRATEGIQUE_CA` est calibrée pour
  // retomber près de 500 € à l'échelle réelle du site pilote ; plancher et
  // plafond évitent les deux cas pathologiques (site quasi sans donnée,
  // ou site déjà très grand).
  const PROPORTION_IMPACT_STRATEGIQUE_CA = 0.006; // 0,6 % du CA total de la période
  const PLANCHER_IMPACT_STRATEGIQUE_EUR = 150;
  const PLAFOND_IMPACT_STRATEGIQUE_EUR = 2000;

  // caTotalPeriode : somme du CA de la période affichée, déjà calculée par
  // l'appelant (Brief a déjà `rowsBrut`/`periodeAffichage` en mémoire —
  // aucune nouvelle lecture Supabase). Repli explicite sur le seuil fixe
  // si le CA n'est pas connu (Article 5 : ne jamais laisser un seuil
  // tomber à 0, ce qui ferait paraître n'importe quel euro "structurant").
  function calculerSeuilImpactAdaptatif(caTotalPeriode) {
    if (!caTotalPeriode || caTotalPeriode <= 0) return SEUIL_IMPACT_STRATEGIQUE_EUR;
    const propose = caTotalPeriode * PROPORTION_IMPACT_STRATEGIQUE_CA;
    return Math.min(PLAFOND_IMPACT_STRATEGIQUE_EUR, Math.max(PLANCHER_IMPACT_STRATEGIQUE_EUR, propose));
  }

  // candidatBrut : un candidat AVANT normalisation (ex. un élément de
  // candidatsProduitsBrut, ou margePlusResultat.candidatTop) — c'est-à-dire
  // avant que normaliserProduit()/normaliserMarge() n'aient éventuellement
  // perdu le champ `contribution`. Un candidat sans `article` (Tempo,
  // Caisse, Stock, Rappel, FDJ, Coach, Advisor) est par construction déjà
  // au niveau agrégé/transversal — jamais un SKU — donc toujours considéré
  // stratégique.
  //
  // `seuilImpactEur` (12/08/2026, P2.1) : 2e paramètre optionnel — l'appelant
  // qui connaît le CA de la période doit passer `calculerSeuilImpactAdaptatif(caTotalPeriode)`
  // ici ; à défaut (paramètre omis), repli sur `SEUIL_IMPACT_STRATEGIQUE_EUR`
  // (non-régression totale pour tout appelant existant qui n'a pas encore
  // été mis à jour).
  function estDecisionStrategique(candidatBrut, seuilImpactEur) {
    if (!candidatBrut) return false;
    if (!candidatBrut.article) return true;
    if (candidatBrut.contribution != null && candidatBrut.contribution >= SEUIL_CONTRIBUTION_STRATEGIQUE) return true;
    const seuil = seuilImpactEur != null ? seuilImpactEur : SEUIL_IMPACT_STRATEGIQUE_EUR;
    return (candidatBrut.impact_eur || 0) >= seuil;
  }

  // ------------------------------------------------------------
  // Constructeurs par secteur — chacun assemble le contrat commun à partir
  // de données DÉJÀ calculées par l'appelant (jamais un second calcul).
  // ------------------------------------------------------------

  function secteurVide(entree, raison) {
    return {
      ...entree, type: 'reel', confiance: 'INSUFFISANT', statut: 'Données insuffisantes', valeur: null,
      detail: raison, moteurs: [], changement: null, force: null, frein: null, risques: [], coherence: null,
      activite: null, maitrise: null, couverture: null,
    };
  }

  // `confiance` (12/08/2026, corrigé — audit stratégique Brief NEXUS,
  // P0 "sécuriser l'Indice Boussole") : AVANT ce correctif, `confiance`
  // était piloté par `aucunReleve` (fraîcheur du CONTRÔLE — a-t-on un relevé
  // carburant aujourd'hui ?) alors que `valeur` (le score qui alimente
  // l'Indice Boussole) est piloté par `evolution` (la PERFORMANCE — tendance
  // volume sur 7 jours), une donnée totalement indépendante. Résultat
  // observé par l'audit : un site sans relevé du jour affichait "Données
  // insuffisantes" alors que sa valeur (calculée depuis une évolution très
  // négative) tirait quand même l'Indice Boussole vers le bas — exactement
  // ce que la philosophie "vérité avant certitude" interdit ("une donnée
  // insuffisante ne doit jamais dégrader un score comme une mauvaise
  // performance"). Invariant maintenant imposé sur TOUS les secteurs
  // (voir aussi construireSecteurEquipe, construireSecteurFdj) :
  // confiance === 'RÉEL' si et seulement si valeur !== null — c'est ce même
  // champ `confiance` que NEXUS-Brief-v1.html utilise pour décider quels
  // secteurs entrent dans la moyenne de l'Indice Boussole. La fraîcheur du
  // relevé du jour reste une information réelle, mais elle vit uniquement
  // dans `statut`/`detail`/`frein` (contrôle), jamais dans `confiance`
  // (mesurabilité de la performance) — les deux ne sont pas la même
  // question, exactement la distinction demandée par l'audit ("Carburants :
  // non évalué sur la fiabilité stock ; litrage commercial disponible.
  // L'indice n'intègre pas la composante non mesurable").
  // Reformulation Performance/Maîtrise (13/08/2026, remplace le correctif
  // `coherence` de la v2.55 — voir le commentaire détaillé dans
  // nexus-boussole-moteur.js). Carburants est le cas qui a déclenché la
  // reformulation : `evolution` (volumes 7 jours, PERFORMANCE) et
  // `carburants.controle` (jaugeage du jour, MAÎTRISE) restent deux sources
  // indépendantes comme avant P0.1/v2.55, mais elles ne sont plus mélangées
  // dans un seul `valeur` ambigu — chacune devient une contribution bornée
  // à ±25, combinées en `valeur = 50 + performance + maîtrise`. Exemple
  // donné par Frédéric, rejoué dans les tests : volumes -19,9 % (Performance
  // ≈ -25) + jaugeage non fait (Maîtrise = -10) => 50-25-10 = 15/100,
  // "À corriger" — plus aucune contradiction possible entre `statut`
  // (dérivé du même score) et `valeur`.
  // `carburants.fraicheur` (22/08/2026, fallback temporel "dernier état
  // fiable" — voir NEXUS-Data-Dictionary-v2.md v2.214/v2.215) : posé par
  // NexusBriefDonnees.chargerCarburantsBriefAvecFallback(), jamais recalculé
  // ici (Article 11). Absent (undefined) pour tout appelant qui continuerait
  // à utiliser chargerCarburantsBrief() seul — traité alors comme le mode
  // normal 'jour', comportement strictement inchangé (non-régression totale
  // pour un éventuel appelant qui ne serait pas encore migré).
  //
  // Cas 'perime' à part : le seul jour fiable trouvé dépasse le seuil de
  // péremption (Frédéric, "36 ou 48h") — le score ne doit plus être présenté
  // comme un état courant (Article 5), NEXUS bascule sur un statut dédié
  // "À actualiser" plutôt que de continuer à afficher un chiffre de plus en
  // plus périmé. `confiance: 'INSUFFISANT'` exclut volontairement ce
  // secteur de l'Indice Boussole (même invariant que secteurVide) : un état
  // trop vieux pour être montré comme courant ne doit pas non plus peser
  // dans la moyenne globale.
  function construireSecteurCarburants(entree, carburants) {
    if (!carburants) return secteurVide(entree, "Aucune donnée carburant chargée pour l'instant.");
    const fraicheur = carburants.fraicheur || { mode: 'jour' };
    if (fraicheur.mode === 'perime') {
      const dateTxt = (fraicheur.dateReference || '').split('-').reverse().join('/');
      return {
        ...entree, type: 'reel', confiance: 'INSUFFISANT', statut: 'À actualiser', valeur: null,
        detail: `Dernier contrôle fiable trop ancien (${dateTxt}, ${fraicheur.joursEcoules} jour${fraicheur.joursEcoules > 1 ? 's' : ''}) pour être présenté comme un état courant — NEXUS attend une nouvelle donnée complète avant de recalculer.`,
        moteurs: [], changement: null, force: null, frein: null, risques: [], coherence: null,
        activite: null, maitrise: null, couverture: 'perimee', fraicheur, enCours: carburants.enCours || null,
      };
    }
    const B = boussole();
    const M = carburantMoteur();
    const { aucunReleve, parCarburant } = carburants.controle;
    const evolution = carburants.evolution;
    // Performance : évolution des volumes sur 7 jours. MÊME slope que
    // l'ancien scoreDepuisEvolution (×250, extrême atteint vers ±20 %) —
    // seul le budget final change (clamp à ±25 au lieu de ±50, la Maîtrise
    // occupant l'autre moitié). Calibrage vérifié sur les deux exemples
    // donnés par Frédéric : -19,9 % => -25 (plafond) ; +6 % => +15 (pas de
    // plafond, 0,06×250=15).
    const contribPerformance = B.clampContribution(evolution != null ? evolution * 250 : null);
    // Maîtrise : 3 situations distinctes (règle fondamentale de Frédéric).
    //  - Contrôle réalisé, conforme -> légère prime (+15).
    //  - Contrôle réalisé, écart à surveiller/corriger -> pénalité graduée.
    //  - Contrôle attendu mais pas encore réalisé (aucunReleve) -> légère
    //    pénalité (-10, valeur exacte donnée par Frédéric) — jamais assimilé
    //    à une "donnée indisponible" : NEXUS SAIT que le jaugeage n'a pas
    //    été fait aujourd'hui, ce n'est pas une absence d'information.
    let contribMaitrise;
    if (aucunReleve) {
      contribMaitrise = -10;
    } else if (parCarburant) {
      const statutControle = M.statutGlobalControle(parCarburant);
      contribMaitrise = statutControle === 'Sous contrôle' ? 15 : statutControle === 'À surveiller' ? -10 : -25;
    } else {
      contribMaitrise = null; // ni relevé ni contrôle explicite : rien à évaluer aujourd'hui.
    }
    const valeur = B.assemblerScoreSecteur(contribPerformance, contribMaitrise);
    // Statut MÉTIER (22/08/2026) : dérivé séparément de chaque contribution
    // via B.statutMetier() — plus de B.statutDepuisScore(valeur). Un
    // jaugeage non fait ou un écart confirmé (Maîtrise mauvaise/mitigée)
    // donne "À corriger"/"À confirmer" quels que soient les volumes ; des
    // volumes en repli SANS problème de contrôle donne "À relancer", jamais
    // "À corriger" (même principe que FDJ ci-dessous).
    const statut = B.statutMetier({
      perfBucket: B.performanceBucket(contribPerformance, B.BUDGET_DIMENSION),
      maitriseBucket: B.maitriseBucket(contribMaitrise, B.BUDGET_DIMENSION),
    });
    const detail = M.texteControleJour(parCarburant, aucunReleve);
    let changement = null;
    if (evolution != null && Math.abs(evolution) >= 0.05) {
      const moteurTxt = carburants.produitMoteur ? ` (moteur : ${M.NOM_CARBURANT_COURT[carburants.produitMoteur.cle] || carburants.produitMoteur.cle})` : '';
      changement = `Les volumes carburant ${evolution >= 0 ? 'progressent' : 'reculent'} de ${Math.abs(evolution * 100).toFixed(1)} % sur 7 jours${moteurTxt}.`;
    }
    const force = (evolution != null && evolution >= 0.05) ? { titre: 'Volumes carburant en hausse', detail: changement, cible: entree.cible } : null;
    const frein = (statut === 'À corriger' || statut === 'À confirmer' || statut === 'À relancer') ? { titre: 'Écart carburant à traiter', detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: [], changement, force, frein, risques: [], coherence: null,
      activite: B.scoreDimension(contribPerformance), maitrise: B.scoreDimension(contribMaitrise),
      couverture: (evolution != null && !aucunReleve) ? 'complete' : 'partielle',
      fraicheur, enCours: fraicheur.mode !== 'jour' ? (carburants.enCours || null) : null,
    };
  }

  // Commerce n'a, à ce jour, aucune dimension Maîtrise modélisée (pas de
  // "contrôle" du commerce boutique distinct de son activité elle-même —
  // précision de Frédéric : *"Maîtrise : neutre pour l'instant."*). Il
  // garde donc l'ancienne formule PLEINE ÉCHELLE (`scoreDepuisEvolution`,
  // budget ±50, pas ±25) plutôt que la contribution partagée ±25 des
  // secteurs à double dimension : rien ne justifie de comprimer sa
  // sensibilité de moitié pour une dimension qui n'existe pas encore.
  // `statut` reste piloté par `statutCommerce` (même formule, jamais
  // `statutDepuisScore`) — les deux restent par construction alignés
  // puisque `valeur` et `statut` dérivent tous deux de la seule
  // `evolutionReelle`.
  function construireSecteurCommerce(entree, facteurs) {
    const B = boussole();
    const valeur = B.scoreDepuisEvolution(facteurs ? facteurs.evolutionReelle : null);
    // Statut MÉTIER (22/08/2026) : Commerce n'a pas de dimension Maîtrise
    // modélisée (voir commentaire ci-dessus) — même vocabulaire que les
    // autres secteurs malgré tout (Article 11 : un radar ne doit pas mélanger
    // deux glossaires de statuts). Un repli de CA n'est jamais un problème de
    // contrôle : "En repli" devient "À relancer", cohérent avec la même
    // décision prise pour FDJ ci-dessous (une baisse d'activité appelle une
    // relance, pas une correction).
    const statut = B.statutMetier({
      perfBucket: B.performanceBucket(valeur != null ? valeur - 50 : null, B.BUDGET_DIMENSION_UNIQUE),
      maitriseBucket: 'inconnue',
    });
    const detail = facteurs && facteurs.evolutionReelle != null
      ? `Évolution du CA : ${facteurs.evolutionReelle >= 0 ? '+' : ''}${(facteurs.evolutionReelle * 100).toFixed(1)} % vs période précédente comparable.`
      : "Pas encore de paire de périodes comparables.";
    let changement = null;
    if (facteurs && facteurs.evolutionReelle != null && Math.abs(facteurs.evolutionReelle) >= 0.05) {
      changement = `Le chiffre d'affaires commerce ${facteurs.evolutionReelle >= 0 ? 'progresse' : 'recule'} de ${Math.abs(facteurs.evolutionReelle * 100).toFixed(1)} % vs la période précédente comparable.`;
    }
    const frein = statut === 'À relancer' ? { titre: 'Activité commerciale en repli', detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: facteurs && facteurs.evolutionReelle != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['produits'], changement, force: null, frein, risques: [], coherence: null,
      activite: valeur, maitrise: null, couverture: valeur != null ? 'complete' : null,
    };
  }

  // `phrasesRisqueMarge` (12/08/2026, moteur de risques v2.46-v2.49) —
  // phrases déjà formatées par l'appelant (une par catégorie qualifiée
  // signal_faible+ par NexusRisques, comparaison à SA PROPRE référence
  // historique — distinct de `margePlusResultat.nbEcarts` ci-dessus, qui
  // vient de la comparaison à la médiane du groupe économique sur la seule
  // période en cours). Les deux se complètent dans `risques[]`, jamais
  // fusionnés en un seul décompte : une catégorie peut être signalée par
  // l'un sans l'autre.
  // Bloc E, agrégateur Marge (12/08/2026, cadrage §5/§7, lot P1.1) : "La
  // liste actuelle de nombreux signaux faibles de marge est trop détaillée
  // pour un dirigeant. Elle doit être agrégée avant d'être présentée dans
  // Brief." Avant ce lot, `frein.detail` faisait `risques.join(' ')` —
  // concaténait toutes les phrases une par une ("Signal faible — Snacking.
  // Signal faible — Boissons. ..."), exactement la "liste de 30 écarts"
  // que l'audit interdit. Cible donnée par le cadrage, reprise ici : "Marge
  // - dispersion à surveiller : 30 écarts actifs détectés, dont 10
  // catégories avec signal faible récurrent. Les principales concentrations
  // concernent X, Y et Z. Voir Marge+." Combine deux comptages déjà
  // disponibles et déjà distincts (voir commentaire v2.50 : jamais fusionnés
  // en un seul décompte) — `nbEcartsMargePlus` (comparaison de pairs sur la
  // période en cours) et `signauxRisqueMarge` (comparaison à la propre
  // référence historique, qualifiée par NexusRisques) — sans jamais
  // prétendre qu'ils mesurent la même chose.
  function construireSyntheseFreinMarge(nbEcartsMargePlus, signauxRisqueMarge) {
    const nbEcarts = nbEcartsMargePlus || 0;
    const signaux = signauxRisqueMarge || [];
    const nbCategoriesQualifiees = signaux.length;
    if (!nbEcarts && !nbCategoriesQualifiees) return null;
    const top = signaux.slice(0, 3).map(s => s.categorie).filter(Boolean);
    let corps;
    if (nbEcarts && nbCategoriesQualifiees) {
      corps = `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} actif${nbEcarts > 1 ? 's' : ''} détecté${nbEcarts > 1 ? 's' : ''}, dont ${nbCategoriesQualifiees} catégorie${nbCategoriesQualifiees > 1 ? 's' : ''} confirmée${nbCategoriesQualifiees > 1 ? 's' : ''} par NexusRisques`;
    } else if (nbEcarts) {
      corps = `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} actif${nbEcarts > 1 ? 's' : ''} détecté${nbEcarts > 1 ? 's' : ''} sur la période`;
    } else {
      corps = `${nbCategoriesQualifiees} catégorie${nbCategoriesQualifiees > 1 ? 's' : ''} avec signal faible ou plus, confirmée${nbCategoriesQualifiees > 1 ? 's' : ''} par NexusRisques`;
    }
    const concentration = top.length ? ` Principale${top.length > 1 ? 's' : ''} concentration${top.length > 1 ? 's' : ''} : ${top.join(', ')}.` : '';
    return `Marge — dispersion à surveiller : ${corps}.${concentration} Voir Marge+.`;
  }

  // Reformulation Performance/Maîtrise (13/08/2026 — voir Carburants
  // ci-dessus et le commentaire détaillé dans nexus-boussole-moteur.js).
  // Performance = niveau de marge globale (`margeReelle`, même formule que
  // l'ancien `scoreDepuisMarge`, désormais bornée à ±25). Maîtrise = écarts
  // Marge+ actifs (`nbEcarts`, comparaison de pairs sur la période en
  // cours) via `contributionMaitriseEcarts()`, partagée avec FDJ (Article
  // 11 : un seul barème écarts -> pénalité). Le cas exact rapporté par
  // Frédéric ("Marge +8, statut à surveiller — le dirigeant se demande si
  // +8 est bon ou mauvais") devient structurellement impossible : `statut`
  // dérive maintenant du même score combiné que `valeur`, jamais d'un
  // signal séparé (`nbEcarts` seul, comme avant ce lot).
  function construireSecteurMarge(entree, { facteurs, margePlusResultat, phrasesRisqueMarge, signauxRisqueMargeQualifies }) {
    const B = boussole();
    const margeReelle = facteurs ? facteurs.margeReelle : null;
    const nbEcarts = margePlusResultat ? margePlusResultat.nbEcarts : null;
    if (margeReelle == null) return secteurVide(entree, "Marge non calculable sur les données actuelles.");
    const contribPerformance = B.clampContribution((margeReelle - 0.25) * 100);
    const contribMaitrise = B.contributionMaitriseEcarts(nbEcarts);
    const valeur = B.assemblerScoreSecteur(contribPerformance, contribMaitrise);
    // Statut MÉTIER (22/08/2026) : plus de B.statutDepuisScore(valeur).
    const statut = B.statutMetier({
      perfBucket: B.performanceBucket(contribPerformance, B.BUDGET_DIMENSION),
      maitriseBucket: B.maitriseBucket(contribMaitrise, B.BUDGET_DIMENSION),
    });
    // Cause principale (22/08/2026, retour de Frédéric : "la cause doit être
    // les écarts confirmés par rapport aux références, et non le taux de
    // marge absolu sans référentiel") : AVANT ce correctif, `detail`
    // commençait par le pourcentage brut ("Marge réelle : X %"), sans jamais
    // dire par rapport à QUOI — un dirigeant ne peut pas juger "8 %" sans
    // connaître la référence. Désormais la référence (25 %, la même valeur
    // que celle déjà utilisée par le calcul de `contribPerformance` ci-dessus
    // — Article 11, jamais un 2e chiffre) est TOUJOURS explicite, et les
    // écarts confirmés (Maîtrise) passent en tête de phrase dès qu'il y en a
    // — c'est la cause, le taux de marge n'est plus que le contexte.
    const detail = nbEcarts
      ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge confirmé${nbEcarts > 1 ? 's' : ''} vs référence (marge réelle ${(margeReelle * 100).toFixed(1)} % pour une référence de 25 %).`
      : `Marge réelle ${(margeReelle * 100).toFixed(1)} % vs référence de 25 % — aucun écart confirmé sur la période.`;
    const changement = nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge actif${nbEcarts > 1 ? 's' : ''} détecté${nbEcarts > 1 ? 's' : ''} sur la période.` : null;
    const risques = phrasesRisqueMarge || [];
    const syntheseFrein = construireSyntheseFreinMarge(nbEcarts, signauxRisqueMargeQualifies);
    const frein = (!['Sous contrôle', 'En progression'].includes(statut) || risques.length)
      ? { titre: 'Écarts de marge actifs', detail: syntheseFrein || detail, cible: entree.cible }
      : null;
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: ['marge'], changement, force: null, frein, risques, coherence: null,
      activite: B.scoreDimension(contribPerformance), maitrise: B.scoreDimension(contribMaitrise),
      couverture: margePlusResultat != null ? 'complete' : 'partielle',
    };
  }

  // Seuil repris à l'identique de nexus-fdj-moteur.js (règles
  // FDJ-JOUR-RECUL / FDJ-CROISSANCE, ±15 %) — jamais une deuxième valeur.
  const SEUIL_FDJ_EVOLUTION = 0.15;
  // Reformulation Performance/Maîtrise (13/08/2026 — voir Carburants/Marge
  // ci-dessus). Performance = évolution du CA FDJ sur 7 jours (même slope
  // ×250 que Carburants, extrême atteint vers ±20 %, clampé au budget ±25).
  // Maîtrise = écarts de caisse FDJ (`nbEcarts`), même
  // barème partagé que Marge (`contributionMaitriseEcarts`). Répond
  // explicitement à la question de Frédéric ("le score -42 vient-il du CA,
  // des écarts de caisse, ou des deux ?") : les deux causes sont maintenant
  // deux nombres visibles séparément (`activite`/`maitrise`) plutôt qu'une
  // seule valeur agrégée à décoder.
  // `resume.fraicheur`/`resume.enCours` (22/08/2026, extension du fallback
  // temporel à FDJ — voir nexus-fdj-moteur.js et chargerCandidatsFdj) :
  // posés par le chargeur, jamais recalculés ici (Article 11), même
  // structure que `carburants.fraicheur` dans construireSecteurCarburants
  // ci-dessus. Absent -> mode `'jour'` par défaut, non-régression totale.
  function construireSecteurFdj(entree, resume) {
    if (!resume || !resume.nbQuartsControles) return secteurVide(entree, "Pas encore assez de quarts FDJ contrôlés sur 7 jours.");
    const fraicheur = resume.fraicheur || { mode: 'jour' };
    if (fraicheur.mode === 'perime') {
      const dateTxt = (fraicheur.dateReference || '').split('-').reverse().join('/');
      return {
        ...entree, type: 'reel', confiance: 'INSUFFISANT', statut: 'À actualiser', valeur: null,
        detail: `Dernier jour FDJ clôturé fiable trop ancien (${dateTxt}, ${fraicheur.joursEcoules} jour${fraicheur.joursEcoules > 1 ? 's' : ''}) pour être présenté comme un état courant — NEXUS attend une nouvelle clôture avant de recalculer la Maîtrise.`,
        moteurs: ['fdj', 'coach'], changement: null, force: null, frein: null, risques: [], coherence: null,
        activite: null, maitrise: null, couverture: 'perimee', fraicheur, enCours: resume.enCours || null,
      };
    }
    const { caGrattage, evolutionCa, jeuMoteur, nbEcarts } = resume;
    const contribPerformance = boussole().clampContribution(evolutionCa != null ? evolutionCa * 250 : null);
    const contribMaitrise = boussole().contributionMaitriseEcarts(nbEcarts);
    const valeur = boussole().assemblerScoreSecteur(contribPerformance, contribMaitrise);
    // Statut MÉTIER (22/08/2026, demande explicite de Frédéric : "FDJ ne
    // doit pas être automatiquement 'à corriger' uniquement parce que le CA
    // recule : une baisse d'activité relève plutôt de 'à relancer'. 'À
    // corriger' doit être réservé à un problème de maîtrise confirmé.")
    // B.statutMetier() applique exactement cette règle : seuls des écarts de
    // caisse confirmés (Maîtrise mauvaise) donnent "À corriger" ; un CA en
    // recul sans écart de caisse donne "À relancer".
    const statut = boussole().statutMetier({
      perfBucket: boussole().performanceBucket(contribPerformance, boussole().BUDGET_DIMENSION),
      maitriseBucket: boussole().maitriseBucket(contribMaitrise, boussole().BUDGET_DIMENSION),
    });
    const detail = `CA FDJ : ${Math.round(caGrattage).toLocaleString('fr-FR')} € sur 7 jours${evolutionCa != null ? ` (${evolutionCa >= 0 ? '+' : ''}${(evolutionCa * 100).toFixed(1)} % vs 7 jours précédents)` : ''}${jeuMoteur ? ` · Jeu moteur : ${jeuMoteur.nom}` : ''}.`;
    let changement = null;
    if (evolutionCa != null && Math.abs(evolutionCa) >= SEUIL_FDJ_EVOLUTION) {
      changement = `Le CA FDJ ${evolutionCa >= 0 ? 'progresse' : 'recule'} de ${Math.abs(evolutionCa * 100).toFixed(1)} % sur 7 jours.`;
    }
    const force = (evolutionCa != null && evolutionCa >= SEUIL_FDJ_EVOLUTION) ? { titre: 'CA FDJ en forte progression', detail: changement, cible: entree.cible } : null;
    const frein = !['Sous contrôle', 'En progression'].includes(statut)
      ? { titre: nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de caisse FDJ non nul${nbEcarts > 1 ? 's' : ''}` : 'CA FDJ en recul', detail, cible: entree.cible }
      : null;
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: ['fdj', 'coach'], changement, force, frein, risques: [], coherence: null,
      activite: boussole().scoreDimension(contribPerformance), maitrise: boussole().scoreDimension(contribMaitrise),
      couverture: evolutionCa != null ? 'complete' : 'partielle',
      fraicheur, enCours: fraicheur.mode !== 'jour' ? (resume.enCours || null) : null,
    };
  }

  // `phrasesRisqueCaisse` (12/08/2026, moteur de risques v2.46-v2.49) —
  // phrases déjà formatées par l'appelant (une par quart qualifié
  // signal_faible+ par NexusRisques.qualifierEcartCaisse, comparaison au
  // propre historique du quart sur une fenêtre glissante — distinct de
  // `nbCritiquesCaisse` ci-dessous, qui compte les écarts individuels
  // encore À TRAITER au sens de v_caisse_ecart_a_traiter). Un quart peut
  // apparaître dans l'un sans l'autre : le moteur de risques répond à "ce
  // quart montre-t-il un vrai motif dans le temps ?", pas "reste-t-il un
  // écart non justifié aujourd'hui ?".
  // Reformulation Performance/Maîtrise (13/08/2026 — voir Carburants/Marge/
  // FDJ ci-dessus). Opérations est, par nature, déjà un secteur de
  // MAÎTRISE (caisse vérifiée, inventaire fait, procédures suivies) — pas
  // d'axe "performance" distinct identifié à ce jour (précision de
  // Frédéric : *"Opérations : principalement Maîtrise"*). `scoreOperations`
  // (écart de caisse moyen, formule inchangée, Article 11) devient donc
  // directement la contribution Maîtrise, recentrée sur le budget ±25 ;
  // Performance reste neutre (null) — pas une absence de donnée, un choix
  // de modélisation assumé (`couverture` reste 'complete' pour ce secteur,
  // un axe non modélisé n'est pas un axe manquant).
  function construireSecteurOperations(entree, { constatTempo, controlesVerifyRestants, nbCritiquesCaisse, alertesInvOuvertes, risqueStockTotal, phrasesRisqueCaisse }) {
    const B = boussole();
    if (!constatTempo.totalJours) return secteurVide(entree, "Pas encore assez d'audits de caisse enregistrés.");
    const scoreEcart = B.scoreOperations(constatTempo.detailOperations, constatTempo.totalJours);
    const contribMaitrise = B.clampContributionPleine(scoreEcart != null ? scoreEcart - 50 : null);
    const valeur = B.assemblerScoreSecteur(null, contribMaitrise);
    // Statut MÉTIER (22/08/2026) : Opérations n'a pas d'axe Performance
    // (perfBucket toujours 'inconnue') — seul l'écart de caisse (Maîtrise)
    // qualifie l'action attendue : "À corriger" (écart confirmé important),
    // "À confirmer" (écart mineur) ou "Sous contrôle".
    const statut = B.statutMetier({ perfBucket: 'inconnue', maitriseBucket: B.maitriseBucket(contribMaitrise, B.BUDGET_DIMENSION_UNIQUE) });
    const detail = `Écart de caisse moyen : ${Math.round(constatTempo.detailOperations)} €/jour${controlesVerifyRestants ? ` · ${controlesVerifyRestants} contrôle${controlesVerifyRestants > 1 ? 's' : ''} caisse en attente aujourd'hui` : ''}.`;
    // Risques (Annexe A) : distincts du statut lui-même — Opérations est le
    // secteur transversal qui agrège caisse/inventaire/stock, exactement
    // comme demandé par l'audit ("Opérations est transversal... sans
    // dupliquer les moteurs détaillés").
    const risques = [];
    if (nbCritiquesCaisse) risques.push(`${nbCritiquesCaisse} écart${nbCritiquesCaisse > 1 ? 's' : ''} de caisse critique${nbCritiquesCaisse > 1 ? 's' : ''}.`);
    if (alertesInvOuvertes) risques.push(`${alertesInvOuvertes} alerte${alertesInvOuvertes > 1 ? 's' : ''} inventaire ouverte${alertesInvOuvertes > 1 ? 's' : ''}.`);
    if (risqueStockTotal > 0) risques.push(`${Math.round(risqueStockTotal).toLocaleString('fr-FR')} € de risque stock estimé.`);
    (phrasesRisqueCaisse || []).forEach(p => risques.push(p));
    const frein = (statut !== 'Sous contrôle' || risques.length)
      ? { titre: statut !== 'Sous contrôle' ? 'Écarts de caisse à corriger' : 'Risques opérationnels ouverts', detail: risques.length ? risques.join(' ') : detail, cible: entree.cible }
      : null;
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: ['caisse', 'stock'], changement: null, force: null, frein, risques, coherence: null,
      activite: null, maitrise: B.scoreDimension(contribMaitrise), couverture: 'complete',
    };
  }

  // Portée du phénomène Équipe (12/08/2026, cadrage §11, lot P1.4) :
  // *"Un libellé comme « Ponctualité mesurée sur 41 pointages » décrit la
  // quantité de données, pas la performance... Distinguer incident
  // individuel, récurrence individuelle et problème collectif. Ne jamais
  // conclure à un besoin de formation collective à partir d'un seul
  // collaborateur."* `collaborateursRecurrents` réutilise le seuil déjà
  // établi pour `employesASurveiller` (≥3 retards) — jamais un 2e seuil
  // inventé pour la même idée (Article 11). "Collectif" exige AU MOINS 2
  // collaborateurs individuellement récurrents : un seul collaborateur, si
  // récurrent, reste "récurrence individuelle", jamais promu "collectif"
  // — c'est exactement la règle demandée par l'audit.
  function classifierPorteeEquipe(collaborateursConcernes, collaborateursRecurrents) {
    if (!collaborateursConcernes) return null;
    if (collaborateursRecurrents >= 2) return 'collectif';
    if (collaborateursRecurrents === 1 && collaborateursConcernes === 1) return 'recurrence_individuelle';
    if (collaborateursConcernes === 1) return 'incident_individuel';
    // Plusieurs collaborateurs concernés, mais aucun n'atteint seul le
    // seuil de récurrence — des incidents isolés répartis, pas encore une
    // preuve de motif individuel NI collectif (Article 5 : ne pas trancher
    // au-delà de ce que les faits démontrent).
    return 'incidents_isoles';
  }

  function libellePorteeEquipe(portee) {
    switch (portee) {
      case 'collectif': return 'semble collectif';
      case 'recurrence_individuelle': return "concerne un seul collaborateur, de façon récurrente";
      case 'incident_individuel': return 'reste un incident isolé chez un seul collaborateur';
      case 'incidents_isoles': return 'reste ponctuel, réparti sur plusieurs collaborateurs sans récurrence individuelle démontrée';
      default: return null;
    }
  }

  // Reformulation Performance/Maîtrise (13/08/2026 — voir Carburants/Marge/
  // FDJ/Opérations ci-dessus). Équipe, comme Opérations, est fondamentalement
  // un secteur de MAÎTRISE (ponctualité, fiabilité, récurrence des
  // anomalies) — pas d'axe "performance" distinct (précision de Frédéric :
  // *"Performance/maîtrise opérationnelle : ponctualité, missions,
  // fiabilité"*, les deux notions se confondent ici). `equipeScore` (formule
  // inchangée, Article 11) devient la contribution Maîtrise ; Performance
  // reste neutre (null), même logique que Opérations.
  function construireSecteurEquipe(entree, { domaineEquipe, seuilMinPointages }) {
    const B = boussole();
    const mesureSuffisante = domaineEquipe.totalPointages != null && domaineEquipe.totalPointages >= seuilMinPointages;
    // `mesureSuffisante` (12/08/2026, corrigé — même correctif que
    // Carburants, pendant symétrique du même bug) : `domaineEquipe.equipeScore`
    // est calculé dès qu'il existe AU MOINS UN pointage (0 retard sur 1
    // pointage = score 100), sans jamais vérifier `seuilMinPointages` —
    // avant ce correctif, un échantillon minuscule pouvait donc peser dans
    // l'Indice Boussole exactement comme une mesure fiable. Reste, après la
    // reformulation Performance/Maîtrise, le SEUL cas d'exclusion totale de
    // ce secteur (`confiance: 'INSUFFISANT'`) : un échantillon trop petit
    // n'est vraiment "pas assez de données" (situation 1), pas un contrôle
    // non réalisé (situation 2) — NEXUS ne choisit pas de pénaliser une
    // maîtrise qu'il ne peut même pas mesurer.
    if (!mesureSuffisante) return secteurVide(entree, "Pas encore assez de pointages enregistrés.");
    const contribMaitrise = B.clampContributionPleine(domaineEquipe.equipeScore - 50);
    const valeur = B.assemblerScoreSecteur(null, contribMaitrise);
    // Statut MÉTIER (22/08/2026) : Équipe, comme Opérations, n'a pas d'axe
    // Performance distinct — seule la Maîtrise (fiabilité/ponctualité)
    // qualifie l'action attendue.
    const statut = B.statutMetier({ perfBucket: 'inconnue', maitriseBucket: B.maitriseBucket(contribMaitrise, B.BUDGET_DIMENSION_UNIQUE) });
    const totalAnomalies = domaineEquipe.totalAnomalies || 0;
    const collaborateursConcernes = domaineEquipe.collaborateursConcernes || 0;
    const portee = classifierPorteeEquipe(collaborateursConcernes, domaineEquipe.employesASurveiller || 0);
    // Ratio + comparaison historique (22/08/2026, retour de Frédéric : "le
    // score doit exposer le ratio et la comparaison historique") —
    // `chargerDomaineEquipe()` calcule désormais ce taux sur une fenêtre
    // glissante 7 jours vs 7 jours précédents (même convention que
    // Carburants/FDJ ci-dessus). Historique insuffisant (site trop récent,
    // ou aucun pointage sur la période précédente) -> comparaison omise
    // plutôt qu'inventée (Article 5).
    const tauxTxt = domaineEquipe.tauxAnomalies != null ? `${Math.round(domaineEquipe.tauxAnomalies * 100)} %` : null;
    const tauxPrecTxt = domaineEquipe.tauxAnomaliesPeriodePrecedente != null ? `${Math.round(domaineEquipe.tauxAnomaliesPeriodePrecedente * 100)} %` : null;
    let comparaison = '';
    if (tauxTxt && tauxPrecTxt != null) {
      const sens = domaineEquipe.tauxAnomalies > domaineEquipe.tauxAnomaliesPeriodePrecedente ? 'en hausse' : (domaineEquipe.tauxAnomalies < domaineEquipe.tauxAnomaliesPeriodePrecedente ? 'en baisse' : 'stable');
      comparaison = ` Taux d'anomalies ${tauxTxt}, ${sens} vs ${tauxPrecTxt} sur les 7 jours précédents.`;
    } else if (tauxTxt) {
      comparaison = ` Taux d'anomalies ${tauxTxt} (historique insuffisant pour comparer à la période précédente).`;
    }
    const detail = totalAnomalies > 0
      ? `Équipe — fiabilité à renforcer : ${totalAnomalies} anomalie${totalAnomalies > 1 ? 's' : ''} de ponctualité sur ${domaineEquipe.totalPointages} pointages sur 7 jours.${comparaison} Le phénomène concerne ${collaborateursConcernes} collaborateur${collaborateursConcernes > 1 ? 's' : ''} et ${libellePorteeEquipe(portee)}.`
      : `Ponctualité sous contrôle sur ${domaineEquipe.totalPointages} pointages sur 7 jours.${comparaison}`;
    const force = statut === 'Sous contrôle' ? { titre: "Ponctualité de l'équipe sous contrôle", detail, cible: entree.cible } : null;
    // Titre du frein reflète désormais la portée réelle (12/08/2026) —
    // jamais "à surveiller" générique quand NEXUS peut dire précisément si
    // le sujet touche un collaborateur ou plusieurs, ce qui change l'action
    // du dirigeant (entretien individuel vs revue d'équipe).
    const freinTitre = portee === 'collectif' ? "Fiabilité d'équipe à surveiller (plusieurs collaborateurs)"
      : (portee === 'recurrence_individuelle' || portee === 'incident_individuel') ? "Fiabilité à surveiller (un seul collaborateur)"
      : "Fiabilité d'équipe à surveiller";
    const frein = (statut === 'À confirmer' || statut === 'À corriger') ? { titre: freinTitre, detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: [], changement: null, force, frein, risques: [], coherence: null,
      activite: null, maitrise: B.scoreDimension(contribMaitrise), couverture: 'complete',
    };
  }

  const CONSTRUCTEURS_SECTEUR = {
    carburants: (entree, d) => construireSecteurCarburants(entree, d.carburants),
    commerce: (entree, d) => construireSecteurCommerce(entree, d.facteurs),
    marge: (entree, d) => construireSecteurMarge(entree, { facteurs: d.facteurs, margePlusResultat: d.margePlusResultat, phrasesRisqueMarge: d.phrasesRisqueMarge, signauxRisqueMargeQualifies: d.signauxRisqueMargeQualifies }),
    fdj: (entree, d) => construireSecteurFdj(entree, d.fdjResume),
    operations: (entree, d) => construireSecteurOperations(entree, {
      constatTempo: d.constatTempo, controlesVerifyRestants: d.controlesVerifyRestants,
      nbCritiquesCaisse: d.nbCritiquesCaisse, alertesInvOuvertes: d.alertesInvOuvertes, risqueStockTotal: d.risqueStockTotal,
      phrasesRisqueCaisse: d.phrasesRisqueCaisse,
    }),
    equipe: (entree, d) => construireSecteurEquipe(entree, { domaineEquipe: d.domaineEquipe, seuilMinPointages: d.seuilMinPointages }),
  };

  // secteursActifs : le champ `.secteurs` du résultat de
  // NexusSecteursCatalogue.secteursActifsSite() (depuis le 11/08/2026 cette
  // fonction retourne { secteurs, statut, typeCommerce } — c'est à
  // l'appelant de vérifier `.statut === 'ok'` AVANT d'arriver ici ; voir
  // NEXUS-Brief-v1.html) — un secteur du catalogue sans constructeur ici
  // (autres métiers, section 5 de l'audit) est ignoré plutôt que de faire
  // planter le rendu : mieux vaut un secteur absent qu'un secteur affiché
  // sans données.
  function construireSecteurs(secteursActifs, donnees) {
    return secteursActifs.map(entree => {
      const constructeur = CONSTRUCTEURS_SECTEUR[entree.id];
      return constructeur ? constructeur(entree, donnees) : null;
    }).filter(Boolean);
  }

  // ------------------------------------------------------------
  // Blocs A/C/D/E/F de la structure Brief V3 (audit, section 4).
  // ------------------------------------------------------------

  // Vocabulaire mis à jour (22/08/2026, refonte statut métier) : 'Stable' et
  // 'En repli' ne sont plus produits par aucun constructeur (Commerce migré
  // vers statutMetier ci-dessus) — conservés en toute fin de liste, sans
  // effet, uniquement en cas d'appelant externe non encore migré (non-
  // régression). STATUTS_ATTENTION regroupe les deux nouveaux statuts
  // intermédiaires ('À confirmer'/'À relancer'), qui remplacent l'ancien
  // 'À surveiller' unique — les deux restent "à regarder" pour le verdict de
  // direction et le tri des freins, sans confondre leurs natures distinctes
  // au niveau du statut lui-même.
  const STATUTS_POSITIFS = ['Sous contrôle', 'En progression', 'Stable'];
  const STATUTS_DEGRADES = ['À corriger', 'En repli'];
  const STATUTS_ATTENTION = ['À confirmer', 'À relancer', 'À surveiller'];

  // Priorité de direction (13/08/2026, correctif direct — retour d'usage
  // de Frédéric sur l'écran Brief live, "rupture de niveau") : AVANT ce
  // correctif, la phrase "Priorité :" du verdict reprenait verbatim
  // `premiereDecision.decision` — la première décision du Bloc G, qui reste
  // filtrée au stratégique (P0.2) mais peut très bien être une décision
  // SKU individuelle ("renforcez le facing de Vin chavron..."). Le verdict
  // de direction (Bloc A) parle au niveau ENTREPRISE ("Marge, FDJ sont à
  // surveiller") ; faire suivre cette phrase d'une action produit précise
  // rompt le niveau de lecture — exactement le "score global parle
  // d'entreprise ; la priorité descend immédiatement au SKU" rapporté.
  // Cette fonction reste au même niveau que `phrase1` : elle nomme la
  // priorité à partir des secteurs déjà classés en difficulté/à surveiller
  // (mêmes tableaux que ci-dessus, aucun second calcul — Article 11),
  // via `frein.titre` — déjà un texte secteur, jamais un SKU. La décision
  // SKU d'origine n'est pas perdue : elle reste affichée telle quelle,
  // inchangée, dans la carte "Décisions recommandées" juste en dessous du
  // verdict (voir NEXUS-Brief-v1.html/construireBrief).
  function construirePrioriteDirection(enDifficulte, aSurveiller) {
    const cibles = [...enDifficulte, ...aSurveiller].filter(s => s.frein && s.frein.titre).slice(0, 2);
    if (!cibles.length) return '';
    const titres = cibles.map(s => s.frein.titre.charAt(0).toLowerCase() + s.frein.titre.slice(1));
    return ` Priorité : ${titres.join(' et ')}.`;
  }

  // Bloc A — verdict de direction, 2 à 4 lignes maximum. `premiereDecision`
  // (13/08/2026) : paramètre retiré — voir construirePrioriteDirection
  // ci-dessus. Les appelants existants qui passent encore un 2e argument ne
  // cassent rien (simplement ignoré), non-régression totale.
  function construireVerdictDirection(secteurs) {
    const enDifficulte = secteurs.filter(s => STATUTS_DEGRADES.includes(s.statut));
    const aSurveiller = secteurs.filter(s => STATUTS_ATTENTION.includes(s.statut));
    const sousControle = secteurs.filter(s => STATUTS_POSITIFS.includes(s.statut));
    let phrase1;
    if (!enDifficulte.length && !aSurveiller.length) {
      phrase1 = sousControle.length
        ? `L'entreprise est globalement sous contrôle sur les ${sousControle.length} secteur${sousControle.length > 1 ? 's' : ''} mesuré${sousControle.length > 1 ? 's' : ''} aujourd'hui.`
        : "NEXUS n'a pas encore assez de données pour qualifier la situation globale.";
    } else {
      const noms = l => l.map(s => s.label).join(', ');
      const parts = [];
      if (enDifficulte.length) parts.push(`${noms(enDifficulte)} nécessite${enDifficulte.length > 1 ? 'nt' : ''} une correction`);
      if (aSurveiller.length) parts.push(`${noms(aSurveiller)} ${aSurveiller.length > 1 ? 'sont' : 'est'} à surveiller`);
      phrase1 = `L'activité progresse de façon inégale : ${parts.join(' ; ')}.`;
    }
    const phrase2 = construirePrioriteDirection(enDifficulte, aSurveiller);
    return phrase1 + phrase2;
  }

  // Bloc C — ce qui a changé, 3 évolutions maximum.
  function construireCeQuiAChange(secteurs) {
    return secteurs.map(s => s.changement).filter(Boolean).slice(0, 3);
  }

  // Bloc E — ce qui freine la performance, 3 fragilités maximum. Priorise
  // les secteurs en difficulté avant ceux simplement "à surveiller".
  function construireFreins(secteurs) {
    const tries = [...secteurs].sort((a, b) => {
      const rang = s => STATUTS_DEGRADES.includes(s.statut) ? 0 : (STATUTS_ATTENTION.includes(s.statut) ? 1 : 2);
      return rang(a) - rang(b);
    });
    return tries.map(s => s.frein).filter(Boolean).slice(0, 3);
  }

  // Bloc F — lecture du directeur d'exploitation : interprétation courte
  // issue de règles déterministes (jamais une génération de texte libre),
  // sur le modèle des exemples donnés par l'audit. Repli honnête si aucune
  // règle croisée ne s'applique, plutôt qu'une phrase inventée (Article 5).
  function construireLectureDirecteur(secteurs) {
    const parId = {};
    secteurs.forEach(s => { parId[s.id] = s; });
    const { commerce, marge, carburants, operations } = parId;

    if (commerce && marge && commerce.statut === 'En progression' && marge.statut === 'À confirmer') {
      return "La croissance est réelle mais insuffisamment transformée en marge — les écarts de marge actifs méritent d'être vérifiés avant que la croissance ne s'installe sur une base moins rentable.";
    }
    // 'À actualiser' (22/08/2026, fallback temporel carburant) exclu au même
    // titre que 'Données insuffisantes' : un état périmé n'est pas un signal
    // à surveiller, c'est une absence de preuve fraîche — ne doit jamais
    // déclencher la phrase "le signal à surveiller vient du carburant".
    if (carburants && commerce && !['Sous contrôle', 'Données insuffisantes', 'À actualiser'].includes(carburants.statut) && STATUTS_POSITIFS.includes(commerce.statut)) {
      return "Le signal à surveiller vient du carburant, pas du commerce boutique — la fréquentation et les ventes en magasin restent le point stable de la période.";
    }
    if (operations && ['À confirmer', 'À corriger'].includes(operations.statut) && operations.risques.length) {
      return "L'exploitation reste globalement stable, mais la récurrence des écarts opérationnels fragilise la fiabilité des données remontées — une correction de procédure limiterait ce bruit.";
    }
    if (secteurs.every(s => STATUTS_POSITIFS.includes(s.statut) || s.statut === 'Données insuffisantes' || s.statut === 'À actualiser')) {
      return "Aucun signal croisé ne se distingue aujourd'hui — l'exploitation évolue normalement sur l'ensemble des secteurs mesurés.";
    }
    return "Les signaux ne permettent pas encore de dégager une lecture croisée fiable entre secteurs — historique insuffisant pour relier une cause à une conséquence avec confiance.";
  }

  global.NexusSecteursMoteur = {
    SEUIL_IMPACT_STRATEGIQUE_EUR, SEUIL_CONTRIBUTION_STRATEGIQUE, SEUIL_FDJ_EVOLUTION,
    PROPORTION_IMPACT_STRATEGIQUE_CA, PLANCHER_IMPACT_STRATEGIQUE_EUR, PLAFOND_IMPACT_STRATEGIQUE_EUR,
    calculerSeuilImpactAdaptatif,
    estDecisionStrategique,
    construireSecteurs,
    construireVerdictDirection, construirePrioriteDirection, construireCeQuiAChange, construireFreins, construireLectureDirecteur,
    construireSyntheseFreinMarge, classifierPorteeEquipe, libellePorteeEquipe,
  };
})(typeof window !== 'undefined' ? window : globalThis);
