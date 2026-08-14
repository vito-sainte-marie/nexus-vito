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

  // ============================================================
  // Performance commerciale (11/08/2026) — Phase 1 de "NEXUS Carburants
  // Pilotage", à la demande de Frédéric (vision détaillée en 6 familles
  // d'intelligence sur le seul moteur existant, sans nouvelle saisie).
  // Ces fonctions consomment les MÊMES volumes déjà sommés par
  // sommerVentesPeriode() ci-dessus ({go, sp95, gnr}, litres, null si
  // aucune ligne de la période n'a de litrage renseigné) — jamais une
  // deuxième source de vérité pour "combien on a vendu".
  // ============================================================

  const CLES_CARBURANT = ['go', 'sp95', 'gnr'];

  // Répartition en % du volume total par carburant. Un carburant à null
  // (aucune vente captée) est exclu du total et de la répartition plutôt
  // que traité comme 0 L, pour ne pas fausser le mix affiché. Retourne
  // null si AUCUN carburant n'a de volume connu sur la période.
  function calculerMixCarburant(ventes) {
    if (!ventes) return null;
    const connus = CLES_CARBURANT.filter(c => ventes[c] != null);
    if (!connus.length) return null;
    const total = connus.reduce((s, c) => s + ventes[c], 0);
    const resultat = { total };
    CLES_CARBURANT.forEach(c => {
      resultat[c] = ventes[c] == null ? null : { litres: ventes[c], pct: total > 0 ? ventes[c] / total : null };
    });
    return resultat;
  }

  // Évolution en ratio (0.12 = +12 %) entre un volume actuel et une
  // référence — même convention que NexusPeriodes.evolutionAgregee : null
  // si la référence est nulle/absente ou nulle (0), jamais un pourcentage
  // fabriqué à partir de rien.
  function calculerEvolutionVolume(actuel, reference) {
    if (actuel == null || reference == null || !reference) return null;
    return (actuel - reference) / reference;
  }

  // Le "produit moteur" : le carburant qui pèse le plus dans les volumes
  // de la période. Retourne null si aucun volume connu.
  function identifierProduitMoteur(ventes) {
    const mix = calculerMixCarburant(ventes);
    if (!mix) return null;
    let meilleur = null;
    CLES_CARBURANT.forEach(c => {
      if (mix[c] == null) return;
      if (!meilleur || mix[c].litres > mix[meilleur].litres) meilleur = c;
    });
    return meilleur ? { cle: meilleur, litres: mix[meilleur].litres, pct: mix[meilleur].pct } : null;
  }

  // Décompose l'évolution TOTALE de volume entre deux périodes en
  // contribution par carburant — répond à "d'où vient la hausse/la
  // baisse", pas seulement "il y a une hausse/une baisse". Un carburant
  // sans donnée sur l'une des deux périodes est exclu du calcul (jamais
  // traité comme 0, qui gonflerait artificiellement sa "contribution").
  // `contributionPct` : part du delta total expliquée par ce carburant —
  // peut dépasser 100 % ou être négative si un carburant compense un
  // autre (ex. GO −1850 L, SP95 +310 L : SP95 a une contribution négative
  // au recul, il l'atténue).
  function decomposerEvolution(ventesActuel, ventesReference) {
    if (!ventesActuel || !ventesReference) return null;
    const parCarburant = {};
    let deltaTotal = 0;
    let auMoinsUn = false;
    CLES_CARBURANT.forEach(c => {
      if (ventesActuel[c] == null || ventesReference[c] == null) { parCarburant[c] = null; return; }
      const delta = ventesActuel[c] - ventesReference[c];
      parCarburant[c] = { delta, actuel: ventesActuel[c], reference: ventesReference[c] };
      deltaTotal += delta;
      auMoinsUn = true;
    });
    if (!auMoinsUn) return null;
    CLES_CARBURANT.forEach(c => {
      if (parCarburant[c]) parCarburant[c].contributionPct = deltaTotal !== 0 ? parCarburant[c].delta / deltaTotal : null;
    });
    return { parCarburant, deltaTotal };
  }

  // Le "moteur de progression" : le carburant dont le delta va dans le
  // même sens que le delta total et y contribue le plus — DIFFÉRENT du
  // produit moteur (le plus gros volume n'est pas forcément celui qui
  // explique le mouvement). Retourne null si aucune décomposition
  // possible ou si aucun carburant ne va dans le sens du mouvement total.
  function identifierMoteurEvolution(decomposition) {
    if (!decomposition || !decomposition.deltaTotal) return null;
    const sensTotal = decomposition.deltaTotal > 0;
    let meilleur = null;
    CLES_CARBURANT.forEach(c => {
      const d = decomposition.parCarburant[c];
      if (!d) return;
      const memeSens = sensTotal ? d.delta > 0 : d.delta < 0;
      if (!memeSens) return;
      if (!meilleur || Math.abs(d.delta) > Math.abs(decomposition.parCarburant[meilleur].delta)) meilleur = c;
    });
    return meilleur ? { cle: meilleur, ...decomposition.parCarburant[meilleur] } : null;
  }

  // ============================================================
  // Résumé "Contrôle du jour" en texte (11/08/2026) — extrait le 11/08 du
  // code initialement écrit deux fois (Brief NEXUS et la mini-fiche
  // Carburants de l'accueil APP) : exactement le genre de duplication que
  // l'Article 11 interdit ("une seule vérité"), corrigé ici avant qu'elle
  // ne diverge. Prend directement `parCarburant`/`aucunReleve`, la sortie
  // de NexusCarburantDonnees.chargerControleJour — aucun accès Supabase.
  // ============================================================

  const NOM_CARBURANT_COURT = { go: 'GO', sp95: 'SP95', gnr: 'GNR' };
  const ORDRE_GRAVITE_CONTROLE = ['À corriger', 'À surveiller', 'Sous contrôle', 'Données insuffisantes'];

  // Le pire statut des 3 carburants — jamais une moyenne, qui masquerait
  // un carburant à corriger derrière deux carburants sous contrôle.
  function statutGlobalControle(parCarburant) {
    if (!parCarburant) return 'Données insuffisantes';
    const statuts = Object.values(parCarburant).map(r => r.statut);
    return ORDRE_GRAVITE_CONTROLE.find(s => statuts.includes(s)) || 'Données insuffisantes';
  }

  // Phrase courte résumant le contrôle du jour — honnête si aucun relevé
  // n'existe encore, nomme le(s) carburant(s) à surveiller/corriger avec
  // leur écart sinon.
  function texteControleJour(parCarburant, aucunReleve) {
    if (aucunReleve || !parCarburant) {
      return "Aucun relevé enregistré pour l'instant — le contrôle s'activera dès le premier jaugeage saisi dans Carburants.";
    }
    const statutGlobal = statutGlobalControle(parCarburant);
    const aSurveiller = Object.entries(parCarburant).filter(([, r]) => r.statut === 'À surveiller' || r.statut === 'À corriger');
    if (aSurveiller.length) {
      let texte = aSurveiller.map(([cle, r]) => `${NOM_CARBURANT_COURT[cle]} : écart de ${r.ecart != null ? `${r.ecart >= 0 ? '+' : ''}${Math.round(r.ecart)} L` : 'non calculable'}.`).join(' ');
      const ok = Object.entries(parCarburant).filter(([, r]) => r.statut === 'Sous contrôle').map(([cle]) => NOM_CARBURANT_COURT[cle]);
      if (ok.length) texte += ` ${ok.join(' et ')} sous contrôle.`;
      return texte;
    }
    if (statutGlobal === 'Sous contrôle') return 'Les 3 carburants sont sous contrôle.';
    return "Le relevé du jour n'a pas encore été validé, ou des ventes ne sont pas encore captées — écart non calculable pour l'instant sur au moins un carburant.";
  }

  // ============================================================
  // AUTONOMIE & JAUGES (13/08/2026) — audit "NEXUS_Audit_Carburants_
  // Pilotage.pdf" de Frédéric : "l'autonomie est une information de
  // pilotage essentielle", jusqu'ici totalement absente de l'écran.
  // ============================================================

  // Seuils provisoires (même esprit que SEUIL_ECART_PCT_* ci-dessus) — le
  // délai réel de livraison et le stock de sécurité ne sont pas encore
  // paramétrés (audit §7) ; à recalibrer avec Frédéric une fois cette
  // information disponible. En attendant, mieux vaut un seuil honnêtement
  // provisoire qu'aucune alerte du tout.
  const SEUIL_AUTONOMIE_ALERTE_JOURS = 1.5;
  const SEUIL_AUTONOMIE_VIGILANCE_JOURS = 3;
  // Palier "Confortable" (14/08/2026, retour de Frédéric : "le dirigeant
  // doit savoir si c'est bon ou non" — un chiffre brut de jours ne suffit
  // pas) : au-delà de ce seuil, l'autonomie n'est plus juste "sous
  // contrôle", elle donne une vraie marge de manœuvre. Provisoire comme les
  // 2 seuils ci-dessus — le vrai délai de livraison et le stock de sécurité
  // ne sont toujours pas paramétrés (audit §7) ; à recalibrer avec Frédéric.
  const SEUIL_AUTONOMIE_CONFORTABLE_JOURS = 8;

  // Jours d'autonomie au rythme de consommation récent. Null si le stock
  // ou la consommation moyenne manquent, ou si la consommation est nulle/
  // négative (une autonomie "infinie" n'est pas une information utile —
  // NEXUS préfère se taire plutôt que d'afficher l'infini ou un zéro faux).
  function calculerAutonomieJours(stockPhysique, consommationMoyenneJour) {
    if (stockPhysique == null || consommationMoyenneJour == null || consommationMoyenneJour <= 0) return null;
    return stockPhysique / consommationMoyenneJour;
  }

  function statutAutonomie(jours) {
    if (jours == null) return 'Données insuffisantes';
    if (jours < SEUIL_AUTONOMIE_ALERTE_JOURS) return 'À corriger';
    if (jours < SEUIL_AUTONOMIE_VIGILANCE_JOURS) return 'À surveiller';
    if (jours < SEUIL_AUTONOMIE_CONFORTABLE_JOURS) return 'Sous contrôle';
    return 'Confortable';
  }

  // Remplissage d'une cuve/carburant (0..1), borné — un écart de saisie ne
  // doit jamais faire déborder visuellement une jauge au-delà de sa
  // capacité configurée.
  function pourcentageRemplissage(stock, capacite) {
    if (stock == null || !capacite) return null;
    return Math.max(0, Math.min(1, stock / capacite));
  }

  function capaciteTotale(cuves) {
    return (cuves || []).reduce((s, c) => s + (Number(c.capacite) || 0), 0);
  }

  // ============================================================
  // FIABILITÉ DU CONTRÔLE (14/08/2026, retour de Frédéric après le premier
  // test réel de Carburants Pilotage) — "Données insuffisantes" est trop
  // générique : le dirigeant doit savoir PRÉCISÉMENT pourquoi le théorique
  // n'est pas calculable pour ce carburant, pour pouvoir agir (faire le
  // jaugeage, compléter une cuve, attendre le prochain quart vérifié...)
  // plutôt que de rester face à un mot vague. Distingue explicitement les 4
  // causes possibles d'un théorique null (voir calculerTheorique) — une
  // seule sortie normalisée, jamais reconstruite différemment par chaque
  // écran (Article 11).
  function motifTheoriqueIndisponible({ dernierReleveExiste, dernierReel, releveDuJourExiste, ventes }) {
    if (!dernierReleveExiste) return 'Aucun relevé antérieur — première mesure, pas encore de référence pour calculer un théorique.';
    if (dernierReel == null) return 'Dernier relevé incomplet pour ce carburant (cuve non renseignée) — théorique non calculable.';
    if (!releveDuJourExiste) return 'Jaugeage du jour manquant.';
    if (ventes == null) return 'Ventes depuis le dernier relevé non disponibles — aucun quart avec litrage capté sur cette période.';
    return null;
  }

  // "Fiabilité du contrôle" à afficher pour un carburant : le statut
  // d'écart normal (Sous contrôle / À surveiller / À corriger) quand le
  // théorique est calculable, sinon le motif précis ci-dessus — jamais
  // "Données insuffisantes" tout seul, qui ne dit rien d'actionnable.
  function fiabiliteControle(resultatCarburant, contexteMotif) {
    if (resultatCarburant && resultatCarburant.statut && resultatCarburant.statut !== 'Données insuffisantes') {
      return { texte: resultatCarburant.statut, niveau: resultatCarburant.statut === 'À corriger' ? 'alerte' : (resultatCarburant.statut === 'À surveiller' ? 'attention' : 'ok') };
    }
    const motif = motifTheoriqueIndisponible(contexteMotif);
    return { texte: motif || 'Données insuffisantes', niveau: 'attente' };
  }

  // Libellé de rapprochement affiché à côté d'une livraison (14/08/2026,
  // retour de Frédéric : "Écart à vérifier" laissait penser qu'un écart
  // était déjà détecté, alors que la plupart du temps le théorique n'est
  // simplement pas encore calculable). Trois issues honnêtement
  // distinctes : un vrai écart trouvé, un contrôle propre, ou un
  // rapprochement pas encore possible — jamais la 3e confondue avec la 1re.
  function libelleRapprochementLivraison(statutCarburantJour) {
    if (statutCarburantJour === 'À corriger') return { texte: 'Écart détecté', niveau: 'alerte' };
    if (statutCarburantJour === 'Sous contrôle' || statutCarburantJour === 'À surveiller') return { texte: 'Intégrée', niveau: 'ok' };
    return { texte: 'Rapprochement à confirmer', niveau: 'attente' };
  }

  // ============================================================
  // PHRASE DE DÉCISION — "Moteur & progression" (14/08/2026, retour de
  // Frédéric : "on passe de l'analyse à la décision"). Ne recalcule rien :
  // relit la décomposition déjà produite par decomposerEvolution() pour
  // dire explicitement si le mouvement est généralisé sur les carburants
  // principaux (donc pas une anomalie de mix, rien à investiguer côté
  // produit) ou concentré sur un seul (donc une vraie piste à vérifier :
  // trafic, prix, ou spécifique à ce carburant).
  function phraseDecisionMoteur(decomposition) {
    if (!decomposition || !decomposition.deltaTotal) return null;
    const hausse = decomposition.deltaTotal > 0;
    const sens = hausse ? 'la hausse' : 'le recul';
    const accordGeneralise = hausse ? 'généralisée' : 'généralisé';
    const carburantsConnus = CLES_CARBURANT.filter(c => decomposition.parCarburant[c]);
    const memeSens = carburantsConnus.filter(c => {
      const d = decomposition.parCarburant[c].delta;
      return d !== 0 && Math.sign(d) === Math.sign(decomposition.deltaTotal);
    });
    if (memeSens.length >= 2) {
      return `À ce stade, ${sens} est ${accordGeneralise} sur les carburants principaux ; aucune anomalie de mix n'est identifiée.`;
    }
    if (memeSens.length === 1) {
      return `Priorité : vérifier si ${sens} provient du trafic global, d'un effet prix, ou d'une dynamique propre au ${NOM_CARBURANT_COURT[memeSens[0]]}.`;
    }
    return null;
  }

  // ============================================================
  // "CE QUE NEXUS VOUS DIT" (13/08/2026, audit §10) — le bloc qui doit
  // produire l'effet NEXUS : hiérarchiser et interpréter plutôt que
  // répéter les chiffres déjà affichés ailleurs sur la page. Compose au
  // maximum 3 messages, triés par priorité (écarts physique/théorique
  // d'abord — le sujet le plus concret et actionnable — puis livraison
  // intégrée, puis autonomie faible, puis mouvement de ventes marqué). Si
  // rien ne mérite l'attention, le dit explicitement plutôt que de laisser
  // un bloc vide (Article 5, "ne jamais laisser un silence ambigu").
  //
  // `ctx` = {
  //   parCarburant, aucunReleve, releveDuJour — sortie de
  //     NexusCarburantDonnees.chargerControleJour,
  //   autonomiesParCarburant: { go, sp95, gnr } (jours ou null),
  //   deltaTotal, evolutionTotale, moteurEvolution — sorties du calcul de
  //     période sélectionnée (decomposerEvolution/calculerEvolutionVolume/
  //     identifierMoteurEvolution),
  //   labelPeriode — libellé déjà résolu de la période sélectionnée.
  // }
  function construireMessagesPilotage(ctx) {
    const c = ctx || {};
    if (c.aucunReleve) {
      return [{ type: 'info', texte: "Aucun relevé enregistré pour l'instant — le pilotage s'activera dès le premier jaugeage saisi." }];
    }

    const messages = [];

    // 0) Jaugeage du jour manquant (audit §8, exemple cible) — quand le
    // relevé du jour n'a pas été saisi mais qu'un relevé antérieur existe,
    // aucun écart n'est réellement calculable aujourd'hui : le dire
    // explicitement, avec les deux chiffres qui permettent d'agir, plutôt
    // que de laisser deviner via un simple "Données insuffisantes".
    if (!c.releveDuJour && c.dernierReleve && c.parCarburant) {
      const dateTxt = (c.dernierReleve.date || '').split('-').reverse().join('/');
      messages.push({
        type: 'attention',
        texte: `Jaugeage du jour manquant. Dernier relevé physique : ${dateTxt}. Saisissez le jaugeage pour contrôler l'écart.`,
      });
    }

    // 1) Écarts physique/théorique.
    if (c.parCarburant) {
      CLES_CARBURANT.forEach(cle => {
        const r = c.parCarburant[cle];
        if (!r || (r.statut !== 'À corriger' && r.statut !== 'À surveiller')) return;
        const ecartTxt = r.ecart != null ? `${r.ecart >= 0 ? '+' : ''}${Math.round(r.ecart).toLocaleString('fr-FR')} L` : 'non calculable';
        messages.push({
          type: r.statut === 'À corriger' ? 'alerte' : 'attention',
          texte: `${NOM_CARBURANT_COURT[cle]} : écart physique/théorique de ${ecartTxt}${r.ecartRatio != null ? ` (${(r.ecartRatio * 100).toFixed(1)} % des ventes)` : ''} — ${r.statut === 'À corriger' ? 'à vérifier rapidement' : 'à surveiller'}.`,
        });
      });
    }

    // 2) Livraison du jour intégrée — événement à signaler explicitement.
    if (c.releveDuJour) {
      const carburantsLivres = CLES_CARBURANT.filter(cle => Number(c.releveDuJour[`livraison_${cle}`]) > 0);
      if (carburantsLivres.length) {
        const details = carburantsLivres.map(cle => `${Math.round(c.releveDuJour[`livraison_${cle}`]).toLocaleString('fr-FR')} L ${NOM_CARBURANT_COURT[cle]}`).join(', ');
        messages.push({ type: 'info', texte: `Livraison du ${(c.releveDuJour.date || '').split('-').reverse().join('/')} intégrée au stock théorique : ${details}.` });
      }
    }

    // 3) Autonomie faible.
    if (c.autonomiesParCarburant) {
      CLES_CARBURANT.forEach(cle => {
        const jours = c.autonomiesParCarburant[cle];
        if (jours != null && jours < SEUIL_AUTONOMIE_ALERTE_JOURS) {
          messages.push({ type: 'alerte', texte: `${NOM_CARBURANT_COURT[cle]} : autonomie de ${jours.toFixed(1)} jour${jours >= 2 ? 's' : ''} au rythme de vente actuel — réapprovisionnement à anticiper.` });
        }
      });
    }

    // 4) Mouvement de ventes marqué (≥ 15 %) — réutilise les calculs déjà
    // faits par l'appelant pour la section Ventes, jamais un second calcul.
    if (c.deltaTotal != null && Math.abs(c.deltaTotal) >= 1 && c.evolutionTotale != null && Math.abs(c.evolutionTotale) >= 0.15) {
      const sens = c.deltaTotal > 0 ? 'progressent' : 'reculent';
      let texte = `Les ventes ${sens} de ${Math.abs(Math.round(c.evolutionTotale * 100))} % sur ${c.labelPeriode || 'la période sélectionnée'}.`;
      if (c.moteurEvolution) texte += ` ${NOM_CARBURANT_COURT[c.moteurEvolution.cle]} explique la majorité du mouvement.`;
      messages.push({ type: c.deltaTotal > 0 ? 'positif' : 'attention', texte });
    }

    if (!messages.length) return [{ type: 'positif', texte: 'Situation carburants sous contrôle aujourd\'hui.' }];
    return messages.slice(0, 3);
  }

  global.NexusCarburantMoteur = {
    SEUIL_ECART_PCT_SURVEILLER, SEUIL_ECART_PCT_CORRIGER, CLES_CARBURANT, NOM_CARBURANT_COURT,
    stockReelGoTotal, sommerVentesPeriode,
    calculerTheorique, calculerEcart, calculerEcartRatio, statutCarburant,
    calculerCarburant,
    calculerMixCarburant, calculerEvolutionVolume, identifierProduitMoteur,
    decomposerEvolution, identifierMoteurEvolution,
    statutGlobalControle, texteControleJour,
    SEUIL_AUTONOMIE_ALERTE_JOURS, SEUIL_AUTONOMIE_VIGILANCE_JOURS, SEUIL_AUTONOMIE_CONFORTABLE_JOURS,
    calculerAutonomieJours, statutAutonomie, pourcentageRemplissage, capaciteTotale,
    motifTheoriqueIndisponible, fiabiliteControle, libelleRapprochementLivraison, phraseDecisionMoteur,
    construireMessagesPilotage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
