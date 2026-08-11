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
      ...entree, type: 'reel', confiance: carburants.controle.aucunReleve ? 'INSUFFISANT' : 'RÉEL',
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

  function construireSecteurMarge(entree, { facteurs, margePlusResultat }) {
    const B = boussole();
    const statut = B.statutValeur(facteurs, margePlusResultat);
    const valeur = B.scoreDepuisMarge(facteurs ? facteurs.margeReelle : null);
    const nbEcarts = margePlusResultat && margePlusResultat.nbEcarts;
    const detail = facteurs && facteurs.margeReelle != null
      ? `Marge réelle : ${(facteurs.margeReelle * 100).toFixed(1)} %${nbEcarts ? ` · ${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge actif${nbEcarts > 1 ? 's' : ''}` : ''}.`
      : "Marge non calculable sur les données actuelles.";
    const changement = nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''} de marge actif${nbEcarts > 1 ? 's' : ''} détecté${nbEcarts > 1 ? 's' : ''} sur la période.` : null;
    const frein = statut === 'À surveiller' ? { titre: 'Écarts de marge actifs', detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: facteurs && facteurs.margeReelle != null ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['marge'], changement, force: null, frein, risques: [],
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
    return {
      ...entree, type: 'reel', confiance: 'RÉEL',
      statut, valeur, detail, moteurs: ['fdj', 'coach'], changement, force, frein, risques: [],
    };
  }

  function construireSecteurOperations(entree, { constatTempo, controlesVerifyRestants, nbCritiquesCaisse, alertesInvOuvertes, risqueStockTotal }) {
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
    const frein = (statut !== 'Sous contrôle' || risques.length)
      ? { titre: statut !== 'Sous contrôle' ? 'Écarts de caisse à corriger' : 'Risques opérationnels ouverts', detail: risques.length ? risques.join(' ') : detail, cible: entree.cible }
      : null;
    return {
      ...entree, type: 'reel', confiance: constatTempo.totalJours ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: ['caisse', 'stock'], changement: null, force: null, frein, risques,
    };
  }

  function construireSecteurEquipe(entree, { domaineEquipe, seuilMinPointages }) {
    const B = boussole();
    const statut = B.statutEquipe(domaineEquipe.equipeScore, domaineEquipe.totalPointages);
    const valeur = domaineEquipe.equipeScore;
    const mesureSuffisante = domaineEquipe.totalPointages != null && domaineEquipe.totalPointages >= seuilMinPointages;
    const detail = mesureSuffisante
      ? `Ponctualité mesurée sur ${domaineEquipe.totalPointages} pointages${domaineEquipe.employesASurveiller ? ` · ${domaineEquipe.employesASurveiller} employé${domaineEquipe.employesASurveiller > 1 ? 's' : ''} à surveiller` : ''}.`
      : "Pas encore assez de pointages enregistrés.";
    const force = statut === 'Sous contrôle' ? { titre: "Ponctualité de l'équipe sous contrôle", detail, cible: entree.cible } : null;
    const frein = (statut === 'À surveiller' || statut === 'À corriger') ? { titre: "Fiabilité d'équipe à surveiller", detail, cible: entree.cible } : null;
    return {
      ...entree, type: 'reel', confiance: mesureSuffisante ? 'RÉEL' : 'INSUFFISANT',
      statut, valeur, detail, moteurs: [], changement: null, force, frein, risques: [],
    };
  }

  const CONSTRUCTEURS_SECTEUR = {
    carburants: (entree, d) => construireSecteurCarburants(entree, d.carburants),
    commerce: (entree, d) => construireSecteurCommerce(entree, d.facteurs),
    marge: (entree, d) => construireSecteurMarge(entree, { facteurs: d.facteurs, margePlusResultat: d.margePlusResultat }),
    fdj: (entree, d) => construireSecteurFdj(entree, d.fdjResume),
    operations: (entree, d) => construireSecteurOperations(entree, {
      constatTempo: d.constatTempo, controlesVerifyRestants: d.controlesVerifyRestants,
      nbCritiquesCaisse: d.nbCritiquesCaisse, alertesInvOuvertes: d.alertesInvOuvertes, risqueStockTotal: d.risqueStockTotal,
    }),
    equipe: (entree, d) => construireSecteurEquipe(entree, { domaineEquipe: d.domaineEquipe, seuilMinPointages: d.seuilMinPointages }),
  };

  // secteursActifs : résultat de NexusSecteursCatalogue.secteursActifsSite()
  // — un secteur du catalogue sans constructeur ici (autres métiers,
  // section 5 de l'audit) est ignoré plutôt que de faire planter le rendu :
  // mieux vaut un secteur absent qu'un secteur affiché sans données.
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
