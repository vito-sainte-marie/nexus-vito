// ============================================================
// NEXUS Risques — moteur de qualification du risque (11/08/2026)
//
// Vision de Frédéric (verbatim, en substance) : NEXUS ne doit jamais
// appeler "risque" quelque chose qui n'est qu'un écart, une anomalie ou
// une tendance faible. Il faut d'abord CLASSIFIER le signal, puis
// seulement décider s'il mérite de remonter dans Brief ou Rapport.
//
// 4 niveaux, du moins au plus grave :
//   1. anomalie       — fait inhabituel observé, risque pas encore connu.
//   2. signal_faible  — plusieurs éléments vont dans le même sens, sans
//                        preuve suffisante d'un risque avéré.
//   3. exposition     — une situation connue PEUT produire une perte si
//                        elle perdure, même si l'impact n'est pas encore
//                        constaté.
//   4. risque_avere   — l'impact existe déjà ou la situation est
//                        suffisamment démontrée.
//
// Principe fondamental : comparer chaque signal à SA PROPRE référence
// (médiane de son groupe économique, sa propre moyenne historique, son
// propre quart habituel...) — jamais à une moyenne générale. Voir
// NEXUS-Cartographie-Moteur-Risques-2026.md pour l'inventaire complet de
// ce qui existait déjà avant ce fichier.
//
// DÉCISIONS D'ARCHITECTURE (les 3 points laissés ouverts par la
// cartographie, tranchés ici pour ne pas refaire ce travail plus tard) :
//
// 1. Contradiction marge/rayon : `nexus-marge.js` compare chaque produit à
//    la médiane de SA famille économique (avec exclusions tabac/gaz/
//    presse) — c'est LE patron de référence propre à généraliser.
//    `nexus-rayon-moteur.js` compare au contraire chaque rayon à la
//    moyenne pondérée de tout le magasin, sans ces exclusions — ce fichier
//    ne le corrige PAS (`nexus-rayon-moteur.js` n'est pas touché, aucun
//    calcul existant n'est modifié), mais `qualifierMargeCategorie`
//    ci-dessous n'utilise QUE la propre référence historique de la
//    catégorie, jamais une moyenne du magasin — donc le nouveau moteur ne
//    reproduit pas le biais. Migrer le chapitre Risques du Rapport de
//    Direction vers ce moteur est une étape ultérieure, pas faite ici.
//
// 2. Couche SQL (advisor_messages/advisor_rules/v_caisse_ecart_recurrent)
//    vs moteur JS : ce fichier suit la convention dominante de NEXUS
//    (moteur JS pur + fichier -donnees.js séparé, consommé par plusieurs
//    pages — Brief/Cockpit/Rapport/secteurs), comme tous les autres
//    moteurs (nexus-marge.js, nexus-fdj-moteur.js, nexus-coach-fdj-
//    moteur.js...). La couche SQL existante n'est PAS dupliquée : pour le
//    domaine Caisse, ce moteur réutilise directement
//    `NexusVerifyMoteur.agregerAudits()` (déjà extrait le 11/08/2026, zéro
//    accès réseau) comme source de vérité du calcul d'écart — il ne
//    réécrit pas une 2e classification de gravité caisse.
//
// 3. Domaine pilote : Marge et Caisse, les deux domaines où la
//    cartographie a trouvé le plus de matière déjà exploitable (référence
//    propre pour la marge, agrégation + seuils gradués pour la caisse).
//    Stock/Carburant/FDJ suivront une fois ce pilote validé par Frédéric.
//
// Ce fichier ne fait AUCUN accès Supabase (voir nexus-risques-donnees.js
// pour le chargement des données et la mémoire du signal dans le temps,
// table nexus_risk_signals).
//
// Inclure après nexus-marge.js et nexus-verify-moteur.js :
// <script src="nexus-risques-moteur.js?v=20260903-1303"></script>
// ------------------------------------------------------------

(function (global) {
  const NIVEAUX = ['anomalie', 'signal_faible', 'exposition', 'risque_avere'];
  const RANG_NIVEAU = { anomalie: 0, signal_faible: 1, exposition: 2, risque_avere: 3 };
  const LABEL_NIVEAU = {
    anomalie: 'Anomalie à expliquer',
    signal_faible: 'Signal faible',
    exposition: 'Exposition',
    risque_avere: 'Risque avéré',
  };

  // ------------------------------------------------------------
  // CŒUR DU MOTEUR — matrice de matérialité explicite (pas un score
  // opaque). 4 dimensions, exactement celles demandées par Frédéric :
  // impact, récurrence, confiance des données, urgence (dérivée de
  // l'ampleur + l'ancienneté). Chaque règle est lisible et nommée, pas un
  // calcul pondéré caché.
  //
  // Entrée normalisée (chaque domaine construit cet objet à sa manière,
  // voir qualifierEcartCaisse/qualifierMargeCategorie plus bas) :
  //   impactMesureEur    : montant déjà constaté (perte/écart réel), ou
  //                        null si rien n'est encore mesurable.
  //   impactPotentielEur : montant que la situation POURRAIT produire si
  //                        elle perdure, ou null si non estimable.
  //   recurrenceCount    : nombre d'occurrences du signal dans la fenêtre
  //                        d'observation (1 = première fois vue).
  //   tailleEchantillon  : nombre total d'observations disponibles pour
  //                        juger (ex: nb de quarts, nb de périodes) — sert
  //                        à calculer le niveau de confiance, jamais à
  //                        remplacer la question "est-ce significatif ?".
  //   ancienneteJours    : depuis combien de jours ce signal (même
  //                        cle_signal) est-il observé.
  //
  // Sortie : { niveau, niveauConfiance, motif } — motif est une phrase
  // courte expliquant la règle déclenchée (jamais un score sans
  // explication, demande explicite de Frédéric).
  // ------------------------------------------------------------

  // Confiance des données (échelle reprise d'advisor_messages, A/B/C/D) :
  // dépend UNIQUEMENT de la taille de l'échantillon disponible, jamais de
  // l'ampleur du signal — un gros écart mesuré une seule fois reste peu
  // fiable statistiquement.
  function niveauConfiance(tailleEchantillon) {
    if (tailleEchantillon >= 10) return 'A';
    if (tailleEchantillon >= 5) return 'B';
    if (tailleEchantillon >= 2) return 'C';
    return 'D';
  }

  // Seuils de matérialité — calibrés directement sur les exemples chiffrés
  // donnés par Frédéric (voir les tests unitaires, qui rejouent chacun de
  // ces exemples mot pour mot) plutôt que choisis arbitrairement. À
  // ajuster avec lui une fois le pilote en usage réel.
  //
  // Deux chemins INDÉPENDANTS mènent à risque_avere (règle A ci-dessous) :
  // - un impact déjà mesuré, même modeste, mais RÉPÉTÉ un nombre
  //   suffisant de fois ("6 écarts non justifiés sur 18 quarts, cumul
  //   84,30 €" — le montant est petit, c'est la répétition qui démontre
  //   le risque) ;
  // - un impact déjà mesuré et matériel en lui-même, même sur une seule
  //   période ("catégorie passée de 18 % à 12 %, CA stable, perte de
  //   marge de 740 €" — pas besoin de récurrence quand le fait est déjà
  //   suffisamment démontré).
  // Important : "3 occurrences" ne suffit PAS seule à atteindre
  // risque_avere (exemple de Frédéric : "écart caisse > seuil sur 3
  // quarts en 10 jours" reste Signal faible/Exposition) — le seuil de
  // récurrence pour l'avéré est volontairement plus haut que celui du
  // signal faible.
  const SEUIL_IMPACT_MESURE_MATERIEL_EUR = 500; // impact isolé mais assez gros pour être démontré seul (ex. marge 740€)
  const SEUIL_IMPACT_POTENTIEL_SIGNIFICATIF_EUR = 200; // impact futur, jugé significatif s'il perdure
  const SEUIL_RECURRENCE_SIGNAL_FAIBLE = 2; // occurrences minimum pour sortir du simple constat isolé (ex. "3 périodes de suite")
  const SEUIL_RECURRENCE_RISQUE_AVERE = 5; // occurrences minimum pour parler de risque avéré par répétition seule (ex. "6 écarts sur 18 quarts")

  // ------------------------------------------------------------
  // EXPOSITION NON FINANCIÈRE — cadrage risques Phase 4 (18/08/2026, tâche
  // #233, "Exposition non financière (impact qualitatif)"). Question de
  // cadrage posée à Frédéric avant d'écrire ce code (Règles A/B ci-dessus
  // exigent TOUTES DEUX un montant en € — un domaine dont l'impact ne se
  // monétise pas proprement ne pouvait donc jamais dépasser signal_faible,
  // quelle que soit sa gravité réelle) : il a choisi d'étendre
  // `classifierNiveau` MAINTENANT plutôt que d'attendre la Phase 5
  // (Carburants), en infrastructure prête avant le besoin — l'exemple de
  // Frédéric cité dans le commentaire de Règle B plus bas ("autonomie
  // carburant faible") ne se traduit pas naturellement en perte constatée
  // en €, c'est le premier cas réel visé.
  //
  // Nouveau champ d'entrée OPTIONNEL, en plus de impactMesureEur/
  // impactPotentielEur : `severiteQualitative` — un jugement de gravité
  // posé par le domaine appelant lui-même (lui seul connaît le sens de sa
  // propre mesure, ex. Carburants Phase 5 jugera "autonomie < 24h" majeure
  // et "autonomie < 3 jours" significative) :
  //   'majeure'       — assez grave pour être démontré seul, même sans
  //                      récurrence (miroir qualitatif de la branche
  //                      "impact matériel à lui seul" de la Règle A).
  //   'significative' — pourrait devenir un risque avéré si elle se répète,
  //                      ou constitue déjà une exposition isolée (miroir
  //                      qualitatif de la Règle B).
  //   'mineure'/absent — n'apporte AUCUNE escalade qualitative ; le niveau
  //                      retombe sur les règles € puis la récurrence seule
  //                      (Règles C/D), comportement STRICTEMENT INCHANGÉ.
  // Les deux domaines déjà branchés (`qualifierEcartCaisse`,
  // `qualifierMargeCategorie`) ne renseignent jamais ce champ — il vaut
  // donc toujours `undefined` pour eux, les nouvelles Règles A2/B2
  // ci-dessous ne se déclenchent jamais, zéro changement de comportement
  // pour l'existant (vérifié par la suite de tests déjà en place,
  // ré-exécutée sans modification après ce lot).
  const RANG_SEVERITE_QUALITATIVE = { mineure: 0, significative: 1, majeure: 2 };

  function classifierNiveau(input) {
    const impactMesure = input.impactMesureEur != null ? Number(input.impactMesureEur) : null;
    const impactPotentiel = input.impactPotentielEur != null ? Number(input.impactPotentielEur) : null;
    const recurrence = Math.max(1, Number(input.recurrenceCount || 1));
    const echantillon = Math.max(1, Number(input.tailleEchantillon || 1));
    const confiance = niveauConfiance(echantillon);

    // Règle A — Risque avéré : un impact réellement mesuré (pas juste
    // potentiel) ET (répété suffisamment de fois OU matériel à lui seul).
    if (impactMesure != null && impactMesure > 0
      && (recurrence >= SEUIL_RECURRENCE_RISQUE_AVERE || impactMesure >= SEUIL_IMPACT_MESURE_MATERIEL_EUR)) {
      const parRecurrence = recurrence >= SEUIL_RECURRENCE_RISQUE_AVERE;
      return {
        niveau: 'risque_avere', niveauConfiance: confiance,
        motif: parRecurrence
          ? `Impact mesuré (${impactMesure.toFixed(0)} €) sur ${recurrence} occurrences — la répétition démontre le risque, même si le montant unitaire reste modeste.`
          : `Impact mesuré de ${impactMesure.toFixed(0)} € — suffisamment matériel pour être démontré même sans récurrence.`,
      };
    }

    // Règle B — Exposition : la situation pourrait produire une perte si
    // elle perdure (impact potentiel significatif), même si rien n'est
    // encore mesuré comme perte réelle. Exemple de Frédéric : "produit
    // moteur en rupture, autonomie carburant faible".
    if (impactPotentiel != null && impactPotentiel >= SEUIL_IMPACT_POTENTIEL_SIGNIFICATIF_EUR) {
      return {
        niveau: 'exposition', niveauConfiance: confiance,
        motif: `Impact potentiel estimé à ${impactPotentiel.toFixed(0)} € si la situation perdure — aucun impact mesuré à ce stade.`,
      };
    }

    // Règles A2/B2 — Exposition non financière (Phase 4, tâche #233) :
    // miroir qualitatif des Règles A/B ci-dessus, pour un domaine dont
    // l'impact ne se traduit pas proprement en €. Évaluées seulement si
    // `severiteQualitative` est renseigné ET qu'aucune Règle A/B € n'a déjà
    // conclu (jamais un doublon d'évaluation — un impact déjà mesuré en €
    // prime toujours sur un jugement qualitatif, plus concret). Les deux
    // domaines existants ne renseignent jamais ce champ : ces deux blocs
    // sont un no-op garanti pour eux (`severite` reste `undefined`, aucune
    // des deux conditions ne peut être vraie).
    const severite = input.severiteQualitative;
    if (severite === 'majeure') {
      // Miroir de la branche "matériel à lui seul" de la Règle A : assez
      // grave pour être démontré même sans récurrence.
      return {
        niveau: 'risque_avere', niveauConfiance: confiance,
        motif: `Situation jugée majeure par le domaine — suffisamment grave pour être démontrée même sans récurrence, sans qu'un montant en € soit disponible pour la chiffrer.`,
      };
    }
    if (severite === 'significative' && recurrence >= SEUIL_RECURRENCE_RISQUE_AVERE) {
      // Miroir de la branche récurrence de la Règle A : la répétition
      // démontre le risque même si chaque occurrence, prise seule, ne
      // suffirait qu'à une exposition.
      return {
        niveau: 'risque_avere', niveauConfiance: confiance,
        motif: `Situation jugée significative par le domaine et observée sur ${recurrence} occurrences — la répétition démontre le risque, sans qu'un montant en € soit disponible pour la chiffrer.`,
      };
    }
    if (severite === 'significative') {
      // Miroir de la Règle B : pourrait produire une perte si elle
      // perdure, même sans récurrence suffisante pour l'avéré.
      return {
        niveau: 'exposition', niveauConfiance: confiance,
        motif: `Situation jugée significative par le domaine si elle perdure — aucun montant en € disponible pour la chiffrer à ce stade.`,
      };
    }

    // Règle C — Signal faible : plusieurs occurrences vont dans le même
    // sens, mais ni l'impact mesuré ni l'impact potentiel ne sont encore
    // assez significatifs pour parler d'exposition ou de risque avéré.
    // Exemples de Frédéric : "baisse de marge sur 3 périodes", "−60/−80/
    // −75 L sur 3 relevés".
    if (recurrence >= SEUIL_RECURRENCE_SIGNAL_FAIBLE) {
      return {
        niveau: 'signal_faible', niveauConfiance: confiance,
        motif: `${recurrence} occurrences vont dans le même sens — pas encore une preuve suffisante d'un risque avéré.`,
      };
    }

    // Règle D — par défaut, un fait inhabituel isolé reste une anomalie à
    // expliquer : NEXUS ne sait pas encore s'il représente un risque.
    // Exemple de Frédéric : "écart caisse de 2 € une fois".
    return {
      niveau: 'anomalie', niveauConfiance: confiance,
      motif: 'Fait inhabituel observé une seule fois — pas encore assez d\'éléments pour conclure.',
    };
  }

  // ------------------------------------------------------------
  // CYCLE DE VIE — un signal peut monter (anomalie -> ... -> risque
  // avéré) ou redescendre (signal_faible -> résolu/non confirmé), jamais
  // changer d'état silencieusement. Utilisé par nexus-risques-donnees.js
  // au moment d'écrire une nouvelle observation sur un signal déjà connu.
  // ------------------------------------------------------------
  function determinerTransition(ancienNiveau, nouveauNiveau) {
    const ancienRang = RANG_NIVEAU[ancienNiveau];
    const nouveauRang = RANG_NIVEAU[nouveauNiveau];
    if (ancienRang == null || nouveauRang == null || ancienNiveau === nouveauNiveau) {
      return { type: 'stable', ancienNiveau, nouveauNiveau };
    }
    return { type: nouveauRang > ancienRang ? 'escalade' : 'desescalade', ancienNiveau, nouveauNiveau };
  }

  // Phrase de contexte lisible par un dirigeant, jamais un simple voyant
  // rouge — demande explicite de Frédéric ("beaucoup plus crédible qu'un
  // simple voyant rouge"). `domaineLabel`/`sujet` sont fournis par
  // l'appelant (ex: "Marge", "Boissons énergisantes").
  function genererPhraseContexte({ domaineLabel, sujet, niveau, motif }) {
    const entete = `${LABEL_NIVEAU[niveau] || niveau} — ${domaineLabel}${sujet ? ' / ' + sujet : ''}`;
    return `${entete}\n${motif}`;
  }

  // ------------------------------------------------------------
  // DOMAINE PILOTE 1 — CAISSE
  //
  // Réutilise NexusVerifyMoteur.agregerAudits() tel quel (aucune 2e
  // classification de gravité écrite ici) : `agregation` est directement
  // son résultat pour une fenêtre d'audits déjà chargée par l'appelant
  // (ex: les N derniers audits du même quart — "à sa propre référence",
  // comme le fait déjà le Conseiller NEXUS Verify).
  //
  // cle attendue par l'appelant pour nexus_risk_signals :
  // `caisse:quart:${quart}` (ou `caisse:site` pour une vue globale).
  // ------------------------------------------------------------
  function qualifierEcartCaisse(agregation) {
    const nbNonConformes = (agregation.parStatut.anomalie || 0) + (agregation.parStatut.critique || 0);
    const classification = classifierNiveau({
      impactMesureEur: agregation.ecartCumule || 0,
      impactPotentielEur: null, // la caisse n'a pas d'impact "futur", l'écart est déjà un fait constaté
      recurrenceCount: nbNonConformes,
      tailleEchantillon: agregation.total,
    });
    return {
      ...classification,
      impactMesureEur: agregation.ecartCumule || 0,
      impactPotentielEur: null,
      recurrenceCount: nbNonConformes,
      tailleEchantillon: agregation.total,
      preuve: {
        ecartCumule: agregation.ecartCumule,
        nbNonConformes,
        totalAudits: agregation.total,
        pireEcart: agregation.pireEcart ? { date: agregation.pireEcart.date, quart: agregation.pireEcart.quart, montant: agregation.pireEcart.ecartMax } : null,
        composantePlusTouchee: agregation.composantePlusTouchee,
      },
    };
  }

  // ------------------------------------------------------------
  // DOMAINE PILOTE 2 — MARGE (comparaison à SA PROPRE référence
  // historique, complémentaire de NexusMarge.detecterEcartsMarge qui
  // compare à la médiane du groupe SUR UNE SEULE période — ici on compare
  // la catégorie à elle-même, dans le temps).
  //
  // input :
  //   categorie            : nom de la catégorie/famille observée.
  //   margePctActuelle     : marge % de la période en cours.
  //   margeHistorique      : tableau des marge % des N périodes
  //                          précédentes (la propre référence).
  //   caActuel             : CA de la période en cours.
  //   caHistoriqueMoyen    : CA moyen des périodes précédentes (pour
  //                          vérifier que le CA reste stable — sinon
  //                          l'écart de marge peut s'expliquer autrement,
  //                          ex: un changement de mix produit).
  //   seuilCaStablePct     : au-delà de cet écart de CA (défaut 15%), le
  //                          signal est dégradé (voir plus bas) — un CA
  //                          qui bouge fortement peut expliquer la marge
  //                          sans qu'il s'agisse d'un risque de marge.
  //
  // cle attendue par l'appelant pour nexus_risk_signals :
  // `marge:categorie:${categorie}`.
  // ------------------------------------------------------------
  function qualifierMargeCategorie(input) {
    const seuilCaStablePct = input.seuilCaStablePct != null ? input.seuilCaStablePct : 0.15;
    const historique = (input.margeHistorique || []).filter(v => v != null && !isNaN(v));
    if (!historique.length) {
      return {
        niveau: 'anomalie', niveauConfiance: 'D',
        motif: 'Aucun historique disponible pour cette catégorie — comparaison à sa propre référence impossible pour l\'instant.',
        impactMesureEur: null, impactPotentielEur: null, recurrenceCount: 1, tailleEchantillon: 0,
        preuve: { margePctActuelle: input.margePctActuelle, margeHistorique: [] },
      };
    }

    const margeMoyenneHistorique = historique.reduce((s, v) => s + v, 0) / historique.length;
    const deltaPoints = margeMoyenneHistorique - input.margePctActuelle;
    const caStable = input.caHistoriqueMoyen ? Math.abs((input.caActuel - input.caHistoriqueMoyen) / input.caHistoriqueMoyen) <= seuilCaStablePct : null;
    // Nombre de périodes historiques déjà EN DESSOUS de la moyenne globale
    // (elle-même incluse) — sert de récurrence : une dégradation vue sur
    // plusieurs périodes de suite, pas juste la période en cours.
    const recurrence = historique.filter(v => v < margeMoyenneHistorique).length + (deltaPoints > 0 ? 1 : 0);

    // Impact mesuré : uniquement si la marge recule réellement (deltaPoints
    // > 0) ET que le CA est resté stable (sinon la baisse de marge peut
    // simplement refléter un changement de mix produit, pas une perte de
    // rentabilité — Frédéric : "CA stable, perte de marge de 740€").
    const impactMesureEur = (deltaPoints > 0 && caStable !== false) ? (deltaPoints / 100) * input.caActuel : null;
    // Impact potentiel : la marge recule mais le CA a trop bougé pour
    // conclure avec certitude — l'impact reste une hypothèse tant que le
    // CA ne s'est pas stabilisé sur une prochaine période.
    const impactPotentielEur = (deltaPoints > 0 && caStable === false) ? (deltaPoints / 100) * input.caActuel : null;

    const classification = classifierNiveau({
      impactMesureEur, impactPotentielEur,
      recurrenceCount: recurrence,
      tailleEchantillon: historique.length,
    });

    return {
      ...classification,
      impactMesureEur, impactPotentielEur,
      recurrenceCount: recurrence,
      tailleEchantillon: historique.length,
      preuve: {
        margePctActuelle: input.margePctActuelle,
        margeMoyenneHistorique,
        deltaPoints,
        caActuel: input.caActuel,
        caHistoriqueMoyen: input.caHistoriqueMoyen,
        caStable,
      },
    };
  }

  // ------------------------------------------------------------
  // Assemblage de l'historique marge d'UNE catégorie à partir de lignes
  // `products` déjà en mémoire (categorie, ca, marge, periode_debut) —
  // ajouté le 12/08/2026 pour brancher Brief NEXUS sans requête Supabase
  // supplémentaire : Brief charge déjà l'intégralité de `products` du site
  // (toutes périodes confondues, voir NexusConseillerDonnees.
  // chargerProduitsBrut) pour ses propres besoins (Marge+, secteurs...) —
  // recalculer la même chose par une requête ciblée serait un doublon
  // d'accès réseau, pas un doublon de RÈGLE (Article 11 porte sur les
  // règles de calcul, pas sur la source des lignes). Regroupe par période,
  // exclut la période actuelle et les périodes à CA nul, garde les
  // `nbPeriodes` plus récentes — même forme de sortie que
  // NexusRisquesDonnees.chargerHistoriqueMargeCategorie() (requête
  // Supabase ciblée, utilisée par les appelants qui n'ont pas `rowsBrut`
  // déjà en mémoire, ex. un futur contrôle isolé depuis Rapport/Cockpit) :
  // { margeHistorique: [pct...], caHistoriqueMoyen }.
  function assemblerHistoriqueMargeCategorie(rowsBrut, categorie, periodeActuelleDebut, nbPeriodes) {
    const parPeriode = {};
    (rowsBrut || []).forEach(r => {
      if (r.categorie !== categorie || r.periode_debut === periodeActuelleDebut) return;
      const cle = r.periode_debut;
      if (!parPeriode[cle]) parPeriode[cle] = { ca: 0, marge: 0 };
      parPeriode[cle].ca += Number(r.ca) || 0;
      parPeriode[cle].marge += Number(r.marge) || 0;
    });
    const periodesTriees = Object.keys(parPeriode)
      .filter(debut => parPeriode[debut].ca > 0)
      .sort((a, b) => (a < b ? 1 : -1)) // décroissant (plus récent d'abord)
      .slice(0, nbPeriodes || 3);
    const valides = periodesTriees.map(debut => ({
      ca: parPeriode[debut].ca, margePct: (parPeriode[debut].marge / parPeriode[debut].ca) * 100,
    }));
    if (!valides.length) return { margeHistorique: [], caHistoriqueMoyen: null };
    return {
      margeHistorique: valides.map(v => v.margePct),
      caHistoriqueMoyen: valides.reduce((s, v) => s + v.ca, 0) / valides.length,
    };
  }

  // ------------------------------------------------------------
  // URGENCE — 2e dimension du signal (cadrage développeur "Évolution du
  // moteur Risques NEXUS", 12/08/2026, §9) : *"Séparer gravité et urgence
  // ... Brief doit montrer en priorité l'urgence, tout en conservant la
  // gravité. Une exposition immédiate peut être plus importante aujourd'hui
  // qu'un risque avéré de moyen terme."* Gravité (`niveau`, ci-dessus)
  // répond à "est-ce grave/démontré ?" ; urgence répond à "faut-il agir
  // maintenant ?" — deux questions différentes, jamais un simple mapping
  // 1:1 de l'une vers l'autre, sinon ce ne serait pas une 2e dimension.
  //
  // Dérivée du niveau ET de l'ancienneté RÉELLE du signal (jours écoulés
  // depuis `premiere_detection_le` en mémoire, `nexus_risk_signals`) —
  // jamais inventée : le champ `ancienneteJours` correspond exactement à
  // ce que le commentaire d'origine de ce fichier annonçait sans jamais le
  // câbler ("urgence dérivée de l'ampleur + l'ancienneté", voir plus haut).
  // Calculée par l'appelant à l'écriture/lecture en mémoire
  // (nexus-risques-donnees.js), jamais ici (ce fichier ne connaît pas
  // l'horloge ni la base) — voir joursDepuisISO() + chargerSignauxSite().
  const URGENCES = ['faible', 'moyenne', 'immediate'];
  const RANG_URGENCE = { faible: 0, moyenne: 1, immediate: 2 };
  const LABEL_URGENCE = { immediate: 'Immédiate', moyenne: 'Moyenne', faible: 'Faible' };

  // Ancienneté au-delà de laquelle un risque avéré est considéré "installé"
  // (déjà sous surveillance, l'enjeu devient la correction structurelle,
  // pas l'urgence du jour) plutôt que "vient d'être démontré" (rien n'est
  // encore en place pour y répondre). 14 jours = 2 cycles hebdomadaires de
  // lecture du Brief par le dirigeant — pas un seuil arbitraire déconnecté
  // du rythme réel de consultation.
  const SEUIL_ANCIENNETE_INSTALLEE_JOURS = 14;

  // Rejoue exactement les 4 exemples du cadrage §9 (voir test unitaire) :
  // - Marge en baisse depuis 6 mois (risque_avere, ancien) -> Moyenne
  // - Autonomie GO sous délai de livraison (exposition)    -> Immédiate
  // - Écart caisse isolé (anomalie)                        -> Faible
  // - 3 écarts de marge dans le même sens (signal_faible)  -> Moyenne
  function classifierUrgence({ niveau, ancienneteJours }) {
    const anciennete = ancienneteJours != null ? Number(ancienneteJours) : 0;
    if (niveau === 'exposition') {
      // Une exposition est par nature une fenêtre qui se referme : agir
      // avant que l'impact ne devienne réel est tout le sens du mot.
      return 'immediate';
    }
    if (niveau === 'risque_avere') {
      return anciennete >= SEUIL_ANCIENNETE_INSTALLEE_JOURS ? 'moyenne' : 'immediate';
    }
    if (niveau === 'signal_faible') {
      // Tendance qui se dessine : à ne pas ignorer, mais rien ne démontre
      // encore qu'une action immédiate change l'issue.
      return 'moyenne';
    }
    // Anomalie : fait isolé, rien ne dit qu'il se reproduira.
    return 'faible';
  }

  // ------------------------------------------------------------
  // DOMAINE PILOTE 3 — CARBURANTS (autonomie de stock, cadrage risques
  // Phase 5, tâche #234, 18/08/2026). Premier consommateur RÉEL de la voie
  // qualitative posée en Phase 4 (`severiteQualitative`) : l'autonomie en
  // jours ne se traduit pas proprement en €, exactement le cas cité dans le
  // commentaire d'origine de la Règle B ("produit moteur en rupture,
  // autonomie carburant faible").
  //
  // Ce fichier ne dépend JAMAIS d'un autre moteur de domaine (même
  // discipline que qualifierEcartCaisse/qualifierMargeCategorie, qui
  // reçoivent des agrégats déjà calculés par l'appelant, jamais une
  // référence à NexusVerifyMoteur ou NexusMarge) : les seuils
  // (SEUIL_AUTONOMIE_ALERTE_JOURS/VIGILANCE_JOURS de
  // NexusCarburantMoteur, déjà en production depuis le 13/08/2026 pour
  // colorer la jauge de Carburants Pilotage) sont fournis par l'appelant,
  // pas relus ici — une seule définition de ces seuils, dans
  // nexus-carburant-moteur.js (Article 11).
  //
  // input :
  //   autonomieJours            : NexusCarburantMoteur.calculerAutonomieJours(stock actuel, conso moyenne) — peut être null.
  //   seuilAlerteJours          : NexusCarburantMoteur.SEUIL_AUTONOMIE_ALERTE_JOURS.
  //   seuilVigilanceJours       : NexusCarburantMoteur.SEUIL_AUTONOMIE_VIGILANCE_JOURS.
  //   historiqueAutonomieJours  : autonomies des jours précédents (même
  //                        carburant, même consommation moyenne récente
  //                        appliquée rétroactivement — approximation
  //                        assumée et documentée par l'appelant : NEXUS ne
  //                        recalcule pas une consommation glissante propre
  //                        à chaque jour passé, ce serait une fausse
  //                        précision. Voir Constitution NEXUS, complément
  //                        "fait/calcul/décision" du 18/08/2026, point 3).
  //
  // cle attendue par l'appelant pour nexus_risk_signals :
  // `carburant:autonomie:${carburant}` (carburant = 'go'/'sp95'/'gnr').
  // ------------------------------------------------------------
  function qualifierAutonomieCarburant(input) {
    const jours = input.autonomieJours != null ? Number(input.autonomieJours) : null;
    if (jours == null) {
      return {
        niveau: 'anomalie', niveauConfiance: 'D',
        motif: 'Autonomie non calculable — stock physique ou consommation moyenne récente indisponible pour ce carburant.',
        impactMesureEur: null, impactPotentielEur: null, recurrenceCount: 1, tailleEchantillon: 0,
        preuve: { autonomieJours: null },
      };
    }

    const seuilAlerte = input.seuilAlerteJours;
    const seuilVigilance = input.seuilVigilanceJours;
    let severite = 'mineure';
    if (seuilAlerte != null && jours < seuilAlerte) severite = 'majeure';
    else if (seuilVigilance != null && jours < seuilVigilance) severite = 'significative';

    // Récurrence = aujourd'hui + nombre de jours récents déjà sous le seuil
    // de vigilance (miroir du principe déjà appliqué par
    // qualifierMargeCategorie : une dégradation vue sur plusieurs jours de
    // suite pèse plus qu'un instantané, sans jamais suffire seule si elle
    // n'est vue qu'une fois — Règle C, seuil de récurrence 2).
    const historique = (input.historiqueAutonomieJours || []).filter(v => v != null);
    const recurrence = 1 + (seuilVigilance != null ? historique.filter(v => v < seuilVigilance).length : 0);

    const classification = classifierNiveau({
      severiteQualitative: severite,
      recurrenceCount: recurrence,
      tailleEchantillon: historique.length + 1,
    });

    return {
      ...classification,
      impactMesureEur: null, impactPotentielEur: null,
      recurrenceCount: recurrence, tailleEchantillon: historique.length + 1,
      preuve: { autonomieJours: jours, joursRecentsSousVigilance: recurrence - 1, fenetreJours: historique.length },
    };
  }

  // ------------------------------------------------------------
  // DOMAINE PILOTE 4 — INVENTAIRE (Cadrage risques Phase 6, tâche #235,
  // 18/08/2026 — motivé directement par l'incident "Glaçons Crystal" du
  // 18/08/2026, cité dans le complément de Constitution fait/calcul/
  // décision de la même date : une fiche produit dupliquée avait fait
  // perdre 11 jours d'historique de comptage sans qu'aucun signal ne le
  // signale nulle part).
  //
  // Zéro dépendance à un autre moteur de domaine (même discipline que les
  // 3 domaines précédents) : `inventaire_alertes` qualifie déjà chaque
  // alerte avec un champ `gravite` ('critique'/'attention') posé par le
  // moteur Inventaire au moment de la détection (écart d'ouverture,
  // anomalie répétée, clôture en retard) — ce fichier ne réévalue jamais
  // cette gravité, il la traduit simplement en `severiteQualitative`
  // (Article 11 : la gravité métier de l'alerte a déjà été décidée une
  // fois, par le domaine qui connaît le contexte du comptage).
  //
  // input :
  //   gravite            : 'critique' / 'attention' / autre valeur/absent.
  //   nbAlertesRecentes   : nombre d'alertes (même produit) sur la fenêtre
  //                         d'observation de l'appelant (récurrence).
  //   valeurEstimeeTotal  : somme des `valeur_estimee` (€) des alertes de
  //                         la fenêtre, si le domaine Inventaire a pu
  //                         l'estimer — jamais un montant mesuré avec
  //                         certitude (d'où `impactPotentielEur`, jamais
  //                         `impactMesureEur`, Article 5 : une estimation
  //                         reste une estimation).
  //
  // cle attendue par l'appelant pour nexus_risk_signals :
  // `inventaire:produit:${designation}`.
  // ------------------------------------------------------------
  function qualifierAlerteInventaire(input) {
    const severite = input.gravite === 'critique' ? 'majeure' : input.gravite === 'attention' ? 'significative' : undefined;
    const recurrence = Math.max(1, Number(input.nbAlertesRecentes || 1));
    const impactPotentielEur = input.valeurEstimeeTotal != null ? Number(input.valeurEstimeeTotal) : null;
    const classification = classifierNiveau({
      impactPotentielEur, // une estimation prime sur le jugement qualitatif si assez significative — cohérent avec la priorité déjà posée en Phase 4.
      severiteQualitative: severite,
      recurrenceCount: recurrence,
      tailleEchantillon: recurrence,
    });
    return {
      ...classification,
      impactMesureEur: null, impactPotentielEur,
      recurrenceCount: recurrence, tailleEchantillon: recurrence,
      preuve: { gravite: input.gravite || null, nbAlertesRecentes: recurrence, valeurEstimeeTotal: impactPotentielEur },
    };
  }

  // ------------------------------------------------------------
  // DOMAINE PILOTE 5 — ÉQUIPE (ponctualité, Cadrage risques Phase 6,
  // 18/08/2026). Reprend EXACTEMENT le seuil déjà utilisé par
  // `nexus-brief-donnees.js`/`nexus-secteurs-moteur.js` pour distinguer un
  // collaborateur "à surveiller" (`SEUIL_RETARDS_RECURRENTS`, ex-littéral
  // `3` codé en dur dans `chargerDomaineEquipe`) — une seule définition
  // désormais, jamais un 2e seuil qui pourrait diverger (Article 11).
  //
  // Volontairement PAR COLLABORATEUR (jamais un signal de site agrégé) :
  // le garde-fou du 18/08/2026 formulé par Frédéric pour la Constitution
  // ("le manager ne doit voir que ce qui nécessite réellement sa
  // décision") et la règle de portée déjà posée en P1.4
  // (`classifierPorteeEquipe`, "ne jamais conclure à un besoin de
  // formation collective à partir d'un seul collaborateur") exigent que
  // chaque collaborateur reste un fait distinct, jamais mélangé aux
  // autres avant que NEXUS n'ait vu la récurrence individuelle ou
  // collective se former dans le temps (persistée signal par signal).
  //
  // input :
  //   nbRetards               : nombre de retards du collaborateur sur la
  //                             fenêtre (récurrence).
  //   totalPointages          : nombre total de pointages du collaborateur
  //                             sur la même fenêtre (taille d'échantillon).
  //
  // cle attendue par l'appelant pour nexus_risk_signals :
  // `equipe:collaborateur:${nomCollaborateur}`.
  // ------------------------------------------------------------
  const SEUIL_RETARDS_RECURRENTS = 3;
  function qualifierPonctualiteCollaborateur(input) {
    const nbRetards = Math.max(1, Number(input.nbRetards || 1));
    const severite = nbRetards >= SEUIL_RETARDS_RECURRENTS ? 'majeure' : undefined;
    const classification = classifierNiveau({
      severiteQualitative: severite,
      recurrenceCount: nbRetards,
      tailleEchantillon: Math.max(nbRetards, Number(input.totalPointages || nbRetards)),
    });
    return {
      ...classification,
      impactMesureEur: null, impactPotentielEur: null,
      recurrenceCount: nbRetards, tailleEchantillon: Number(input.totalPointages || nbRetards),
      preuve: { nbRetards, totalPointages: input.totalPointages != null ? input.totalPointages : null },
    };
  }

  // ------------------------------------------------------------
  // LIBELLÉS PAR DOMAINE — un seul mapping domaine/cle_signal -> libellé
  // lisible, désormais partagé par Brief/Cockpit/Rapport (Cadrage risques
  // Phase 5, 18/08/2026). Avant ce lot, ce mapping était DUPLIQUÉ en 3
  // exemplaires (un ternaire binaire `s.domaine === 'marge' ? 'Marge' :
  // 'Caisse'` par fichier) — jamais un problème tant que seuls 2 domaines
  // existaient, mais l'ajout de Carburants comme 3e domaine aurait fait
  // AFFICHER À TORT tout signal carburant comme "Caisse" (le ternaire
  // binaire retombe sur la branche `else`) dans les 3 écrans si ce mapping
  // n'avait pas été centralisé ici avant d'ajouter le domaine (Article 11 —
  // 3 copies qui auraient divergé silencieusement dès qu'un domaine change).
  // Étendu en Phase 6 (18/08/2026) pour Inventaire/FDJ/Équipe — même
  // mécanisme, aucun changement de forme.
  const LABEL_DOMAINE = { marge: 'Marge', caisse: 'Caisse', carburant: 'Carburants', inventaire: 'Inventaire', fdj: 'FDJ', equipe: 'Équipe' };
  const NOM_CARBURANT_RISQUE = { go: 'Gazole', sp95: 'SP95', gnr: 'GNR' };
  const PREFIXES_CLE_SIGNAL = {
    marge: 'marge:categorie:', caisse: 'caisse:quart:', carburant: 'carburant:autonomie:',
    inventaire: 'inventaire:produit:', fdj: 'fdj:quart:', equipe: 'equipe:collaborateur:',
  };

  function domaineLabelSignal(s) {
    return LABEL_DOMAINE[s.domaine] || s.domaine;
  }

  function sujetSignal(s) {
    const prefixe = PREFIXES_CLE_SIGNAL[s.domaine];
    const brut = prefixe ? (s.cle_signal || '').replace(prefixe, '') : (s.cle_signal || '');
    if (s.domaine === 'caisse' || s.domaine === 'fdj') return `Quart ${brut}`;
    if (s.domaine === 'carburant') return NOM_CARBURANT_RISQUE[brut] || brut;
    return brut; // marge, inventaire, equipe, et tout domaine futur non encore mappé : identifiant brut (déjà un nom lisible pour ces 3 domaines).
  }

  global.NexusRisques = {
    NIVEAUX, RANG_NIVEAU, LABEL_NIVEAU,
    URGENCES, RANG_URGENCE, LABEL_URGENCE, SEUIL_ANCIENNETE_INSTALLEE_JOURS,
    classifierNiveau, determinerTransition, genererPhraseContexte, classifierUrgence,
    qualifierEcartCaisse, qualifierMargeCategorie, assemblerHistoriqueMargeCategorie,
    qualifierAutonomieCarburant,
    qualifierAlerteInventaire, qualifierPonctualiteCollaborateur, SEUIL_RETARDS_RECURRENTS,
    niveauConfiance,
    SEUIL_IMPACT_MESURE_MATERIEL_EUR, SEUIL_IMPACT_POTENTIEL_SIGNIFICATIF_EUR,
    SEUIL_RECURRENCE_SIGNAL_FAIBLE, SEUIL_RECURRENCE_RISQUE_AVERE,
    RANG_SEVERITE_QUALITATIVE,
    LABEL_DOMAINE, domaineLabelSignal, sujetSignal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
