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
// <script src="nexus-risques-moteur.js"></script>
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

  global.NexusRisques = {
    NIVEAUX, RANG_NIVEAU, LABEL_NIVEAU,
    URGENCES, RANG_URGENCE, LABEL_URGENCE, SEUIL_ANCIENNETE_INSTALLEE_JOURS,
    classifierNiveau, determinerTransition, genererPhraseContexte, classifierUrgence,
    qualifierEcartCaisse, qualifierMargeCategorie, assemblerHistoriqueMargeCategorie,
    niveauConfiance,
    SEUIL_IMPACT_MESURE_MATERIEL_EUR, SEUIL_IMPACT_POTENTIEL_SIGNIFICATIF_EUR,
    SEUIL_RECURRENCE_SIGNAL_FAIBLE, SEUIL_RECURRENCE_RISQUE_AVERE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
