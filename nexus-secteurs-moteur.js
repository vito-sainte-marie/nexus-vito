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
  // jamais une deuxième valeur qui pourrait diverger.
  const SEUIL_CONTRIBUTION_STRATEGIQUE = 0.15;

  // candidatBrut : un candidat AVANT normalisation (ex. un élément de
  // candidatsProduitsBrut, ou margePlusResultat.candidatTop) — c'est-à-dire
  // avant que normaliserProduit()/normaliserMarge() n'aient éventuellement
  // perdu le champ `contribution`. Un candidat sans `article` (Tempo,
  // Caisse, Stock, Rappel, FDJ, Coach, Advisor) est par construction déjà
  // au niveau agrégé/transversal — jamais un SKU — donc toujours considéré
  // stratégique.
  function estDecisionStrategique(candidatBrut) {
    if (!candidatBrut) return false;
    if (!candidatBrut.article) return true;
    if (candidatBrut.contribution != null && candidatBrut.contribution >= SEUIL_CONTRIBUTION_STRATEGIQUE) return true;
    return (candidatBrut.impact_eur || 0) >= SEUIL_IMPACT_STRATEGIQUE_EUR;
  }

  // ------------------------------------------------------------
  // Constructeurs par secteur — chacun assemble le contrat commun à partir
  // de données DÉJÀ calculées par l'appelant (jamais un second calcul).
  // ------------------------------------------------------------

  function secteurVide(entree, raison) {
    return {
      ...entree, type: 'reel', confiance: 'INSUFFISANT', statut: 'Données insuffisantes', valeur: null,
      detail: raison, moteurs: [], changement: null, force: null, frein: null, risques: [],
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
  function construireSecteurCarburants(entree, carburants) {
    if (!carburants) return secteurVide(entree, "Aucune donnée carburant chargée pour l'instant.");
    const M = carburantMoteur();
    const statut = M.statutGlobalControle(carburants.controle.aucunReleve ? null : carburants.controle.parCarburant);
    const detail = M.texteControleJour(carburants.controle.parCarburant, carburants.controle.aucunReleve);
    const evolution = carburants.evolution;
    const valeur = evolution != null ? boussole().scoreDepuisEvolution(evolution) : null;
    let changement = null;
    if (evolution != null && Math.abs(evolution) >= 0.05) {
      const moteurTxt = carburants.produitMoteur ? ` (moteur : ${M.NOM_CARBURANT_COURT[carburants.produitMoteur.cle] || carburants.produitMoteur.cle})` : '';
      changement = `Les volumes carburant ${evolution >= 0 ? 'progressent' : 'reculent'} de ${Math.abs(evolution * 100).toFixed(1)} % sur 7 jours${moteurTxt}.`;
    }
    const force = (evolution != null && evolution >= 0.05) ? { titre: 'Volumes carburant en hausse', detail: changement, cible: entree.cible } : null;
    const frein = (statut === 'À corriger' || statut === 'À surveiller') ? { titre: 'Écart carburant à traiter', detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: valeur != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: [], changement, force, frein, risques: [],
    };
  }

  function construireSecteurCommerce(entree, facteurs) {
    const B = boussole();
    const statut = B.statutCommerce(facteurs);
    const valeur = B.scoreDepuisEvolution(facteurs ? facteurs.evolutionReelle : null);
    const detail = facteurs && facteurs.evolutionReelle != null
      ? `Évolution du CA : ${facteurs.evolutionReelle >= 0 ? '+' : ''}${(facteurs.evolutionReelle * 100).toFixed(1)} % vs période précédente comparable.`
      : "Pas encore de paire de périodes comparables.";
    let changement = null;
    if (facteurs && facteurs.evolutionReelle != null && Math.abs(facteurs.evolutionReelle) >= 0.05) {
      changement = `Le chiffre d'affaires commerce ${facteurs.evolutionReelle >= 0 ? 'progresse' : 'recule'} de ${Math.abs(facteurs.evolutionReelle * 100).toFixed(1)} % vs la période précédente comparable.`;
    }
    const frein = statut === 'En repli' ? { titre: 'Activité commerciale en repli', detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: facteurs && facteurs.evolutionReelle != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['produits'], changement, force: null, frein, risques: [],
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

  function construireSecteurMarge(entree, { facteurs, margePlusResultat, phrasesRisqueMarge, signauxRisqueMargeQualifies }) {
    const B = boussole();
    const statut = B.statutValeur(facteurs, margePlusResultat);
    const valeur = B.scoreDepuisMarge(facteurs ? facteurs.margeReelle : null);
    const nbEcarts = margePlusResultat && margePlusResultat.nbEcarts;
    const detail = facteurs && facteurs.margeReelle != null
      ? `Marge réelle : ${(facteurs.margeReelle * 100).toFixed(1)} %${nbEcarts ? ` · ${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge actif${nbEcarts > 1 ? 's' : ''}` : ''}.`
      : "Marge non calculable sur les données actuelles.";
    const changement = nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge actif${nbEcarts > 1 ? 's' : ''} détecté${nbEcarts > 1 ? 's' : ''} sur la période.` : null;
    const risques = phrasesRisqueMarge || [];
    const syntheseFrein = construireSyntheseFreinMarge(nbEcarts, signauxRisqueMargeQualifies);
    const frein = (statut === 'À surveiller' || risques.length)
      ? { titre: 'Écarts de marge actifs', detail: syntheseFrein || detail, cible: entree.cible }
      : null;
    return {
      ...entree, type: 'reel', confiance: facteurs && facteurs.margeReelle != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['marge'], changement, force: null, frein, risques,
    };
  }

  // Seuil repris à l'identique de nexus-fdj-moteur.js (règles
  // FDJ-JOUR-RECUL / FDJ-CROISSANCE, ±15 %) — jamais une deuxième valeur.
  const SEUIL_FDJ_EVOLUTION = 0.15;
  function construireSecteurFdj(entree, resume) {
    if (!resume || !resume.nbQuartsControles) return secteurVide(entree, "Pas encore assez de quarts FDJ contrôlés sur 7 jours.");
    const { caGrattage, evolutionCa, jeuMoteur, nbEcarts } = resume;
    let statut = nbEcarts > 0 ? 'À surveiller' : (evolutionCa != null && evolutionCa <= -SEUIL_FDJ_EVOLUTION ? 'À surveiller' : 'Sous contrôle');
    const valeur = evolutionCa != null ? boussole().scoreDepuisEvolution(evolutionCa) : null;
    const detail = `CA FDJ : ${Math.round(caGrattage).toLocaleString('fr-FR')} € sur 7 jours${evolutionCa != null ? ` (${evolutionCa >= 0 ? '+' : ''}${(evolutionCa * 100).toFixed(1)} % vs 7 jours précédents)` : ''}${jeuMoteur ? ` · Jeu moteur : ${jeuMoteur.nom}` : ''}.`;
    let changement = null;
    if (evolutionCa != null && Math.abs(evolutionCa) >= SEUIL_FDJ_EVOLUTION) {
      changement = `Le CA FDJ ${evolutionCa >= 0 ? 'progresse' : 'recule'} de ${Math.abs(evolutionCa * 100).toFixed(1)} % sur 7 jours.`;
    }
    const force = (evolutionCa != null && evolutionCa >= SEUIL_FDJ_EVOLUTION) ? { titre: 'CA FDJ en forte progression', detail: changement, cible: entree.cible } : null;
    const frein = statut === 'À surveiller'
      ? { titre: nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de caisse FDJ non nul${nbEcarts > 1 ? 's' : ''}` : 'CA FDJ en recul', detail, cible: entree.cible }
      : null;
    // `confiance` (12/08/2026, corrigé pour le même invariant que les
    // autres secteurs) : était codée en dur à 'RÉEL' même quand `valeur`
    // est null (aucune évolution calculable) — mismatch mineur qui ne
    // faisait pas baisser l'Indice (un `valeur` null est déjà exclu de la
    // moyenne), mais affichait un badge "RÉEL" trompeur sur la carte.
    return {
      ...entree, type: 'reel', confiance: valeur != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['fdj', 'coach'], changement, force, frein, risques: [],
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
  function construireSecteurOperations(entree, { constatTempo, controlesVerifyRestants, nbCritiquesCaisse, alertesInvOuvertes, risqueStockTotal, phrasesRisqueCaisse }) {
    const B = boussole();
    const statut = constatTempo.statutOperations;
    const valeur = B.scoreOperations(constatTempo.detailOperations, constatTempo.totalJours);
    const detail = constatTempo.totalJours
      ? `Écart de caisse moyen : ${Math.round(constatTempo.detailOperations)} €/jour${controlesVerifyRestants ? ` · ${controlesVerifyRestants} contrôle${controlesVerifyRestants > 1 ? 's' : ''} caisse en attente aujourd'hui` : ''}.`
      : "Pas encore assez d'audits de caisse enregistrés.";
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
      ...entree, type: 'reel', confiance: constatTempo.totalJours ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['caisse', 'stock'], changement: null, force: null, frein, risques,
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

  function construireSecteurEquipe(entree, { domaineEquipe, seuilMinPointages }) {
    const B = boussole();
    const statut = B.statutEquipe(domaineEquipe.equipeScore, domaineEquipe.totalPointages);
    const mesureSuffisante = domaineEquipe.totalPointages != null && domaineEquipe.totalPointages >= seuilMinPointages;
    // `valeur` (12/08/2026, corrigé — même correctif que Carburants,
    // pendant symétrique du même bug) : `domaineEquipe.equipeScore` est
    // calculé dès qu'il existe AU MOINS UN pointage (0 retard sur 1
    // pointage = score 100), sans jamais vérifier `seuilMinPointages` —
    // avant ce correctif, un échantillon minuscule pouvait donc peser dans
    // l'Indice Boussole exactement comme une mesure fiable, alors que la
    // carte elle-même affiche "Pas encore assez de pointages enregistrés."
    // Gardé par `mesureSuffisante` désormais, pour respecter le même
    // invariant que les autres secteurs : confiance === 'RÉEL' ⟺ valeur
    // !== null.
    const valeur = mesureSuffisante ? domaineEquipe.equipeScore : null;
    const totalAnomalies = domaineEquipe.totalAnomalies || 0;
    const collaborateursConcernes = domaineEquipe.collaborateursConcernes || 0;
    const portee = classifierPorteeEquipe(collaborateursConcernes, domaineEquipe.employesASurveiller || 0);
    // Taille de l'échantillon affichée comme CONTEXTE ("sur N pointages"),
    // jamais comme conclusion (l'ancienne phrase EST la conclusion visible
    // en tête — "Ponctualité mesurée sur..." — corrigé ici : la conclusion
    // porte maintenant sur le phénomène observé, pas sur le volume de
    // données). "Contre N sur la période précédente" (exemple du cadrage)
    // n'est PAS reproduit : `chargerDomaineEquipe()` ne connaît aujourd'hui
    // aucune fenêtre de période pour les pointages (portée existante,
    // documentée depuis avant ce lot) — l'ajouter inventerait une
    // comparaison que NEXUS ne peut pas encore prouver (Article 5).
    const detail = mesureSuffisante
      ? (totalAnomalies > 0
          ? `Équipe — fiabilité à renforcer : ${totalAnomalies} anomalie${totalAnomalies > 1 ? 's' : ''} de ponctualité sur ${domaineEquipe.totalPointages} pointages. Le phénomène concerne ${collaborateursConcernes} collaborateur${collaborateursConcernes > 1 ? 's' : ''} et ${libellePorteeEquipe(portee)}.`
          : `Ponctualité sous contrôle sur ${domaineEquipe.totalPointages} pointages.`)
      : "Pas encore assez de pointages enregistrés.";
    const force = statut === 'Sous contrôle' ? { titre: "Ponctualité de l'équipe sous contrôle", detail, cible: entree.cible } : null;
    // Titre du frein reflète désormais la portée réelle (12/08/2026) —
    // jamais "à surveiller" générique quand NEXUS peut dire précisément si
    // le sujet touche un collaborateur ou plusieurs, ce qui change l'action
    // du dirigeant (entretien individuel vs revue d'équipe).
    const freinTitre = portee === 'collectif' ? "Fiabilité d'équipe à surveiller (plusieurs collaborateurs)"
      : (portee === 'recurrence_individuelle' || portee === 'incident_individuel') ? "Fiabilité à surveiller (un seul collaborateur)"
      : "Fiabilité d'équipe à surveiller";
    const frein = (statut === 'À surveiller' || statut === 'À corriger') ? { titre: freinTitre, detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: mesureSuffisante ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: [], changement: null, force, frein, risques: [],
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

  const STATUTS_POSITIFS = ['Sous contrôle', 'En progression', 'Stable'];
  const STATUTS_DEGRADES = ['À corriger', 'En repli'];

  // Bloc A — verdict de direction, 2 à 4 lignes maximum.
  function construireVerdictDirection(secteurs, premiereDecision) {
    const enDifficulte = secteurs.filter(s => STATUTS_DEGRADES.includes(s.statut));
    const aSurveiller = secteurs.filter(s => s.statut === 'À surveiller');
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
    const phrase2 = premiereDecision ? ` Priorité : ${premiereDecision.decision.charAt(0).toLowerCase()}${premiereDecision.decision.slice(1)}` : '';
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
      const rang = s => STATUTS_DEGRADES.includes(s.statut) ? 0 : (s.statut === 'À surveiller' ? 1 : 2);
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

    if (commerce && marge && commerce.statut === 'En progression' && marge.statut === 'À surveiller') {
      return "La croissance est réelle mais insuffisamment transformée en marge — les écarts de marge actifs méritent d'être vérifiés avant que la croissance ne s'installe sur une base moins rentable.";
    }
    if (carburants && commerce && !['Sous contrôle', 'Données insuffisantes'].includes(carburants.statut) && STATUTS_POSITIFS.includes(commerce.statut)) {
      return "Le signal à surveiller vient du carburant, pas du commerce boutique — la fréquentation et les ventes en magasin restent le point stable de la période.";
    }
    if (operations && ['À surveiller', 'À corriger'].includes(operations.statut) && operations.risques.length) {
      return "L'exploitation reste globalement stable, mais la récurrence des écarts opérationnels fragilise la fiabilité des données remontées — une correction de procédure limiterait ce bruit.";
    }
    if (secteurs.every(s => STATUTS_POSITIFS.includes(s.statut) || s.statut === 'Données insuffisantes')) {
      return "Aucun signal croisé ne se distingue aujourd'hui — l'exploitation évolue normalement sur l'ensemble des secteurs mesurés.";
    }
    return "Les signaux ne permettent pas encore de dégager une lecture croisée fiable entre secteurs — historique insuffisant pour relier une cause à une conséquence avec confiance.";
  }

  global.NexusSecteursMoteur = {
    SEUIL_IMPACT_STRATEGIQUE_EUR, SEUIL_CONTRIBUTION_STRATEGIQUE, SEUIL_FDJ_EVOLUTION,
    estDecisionStrategique,
    construireSecteurs,
    construireVerdictDirection, construireCeQuiAChange, construireFreins, construireLectureDirecteur,
    construireSyntheseFreinMarge, classifierPorteeEquipe, libellePorteeEquipe,
  };
})(typeof window !== 'undefined' ? window : globalThis);
