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
// ============================================================
// CONVENTION TEMPORELLE (formalisée par Frédéric le 14/08/2026, après un
// aller-retour sur un bug de fenêtre de dates — voir Data Dictionary v2.82
// et v2.84) — SOURCE UNIQUE DE VÉRITÉ pour toute future modification de ce
// moteur ou de ses appelants :
//
//   Le relevé carburant représente le stock physique À L'OUVERTURE du jour.
//   Les ventes du jour D et les livraisons/mouvements intervenus APRÈS ce
//   relevé servent à calculer le théorique du PROCHAIN relevé D+1 — jamais
//   celui du relevé D lui-même (rien de ce qui se passe après une mesure ne
//   peut être comparé à cette même mesure).
//
//   Théorique(D) = Réel(D-1) + livraisons entre les deux relevés
//                            + mouvements entre les deux relevés
//                            - ventes depuis le relevé D-1
//
// Conséquences concrètes :
//   - `ventes` (paramètre de calculerTheorique ci-dessous) doit être sommé
//     sur les dates >= date du relevé précédent ET < date du relevé
//     courant (le jour du relevé précédent est INCLUS — ses propres ventes
//     ont eu lieu après SA propre ouverture ; le jour du relevé courant est
//     EXCLU — ses ventes n'ont pas encore eu lieu au moment de cette
//     ouverture). Voir chargerControleJour() dans nexus-carburant-donnees.js
//     et chargerVentesDepuisDernierReleve() dans NEXUS-Carburants-v1.html.
//   - `livraison`/`mouvement` sont saisis directement SUR la ligne du
//     relevé courant (champ "Livraison depuis le dernier relevé") : le
//     data-model respecte déjà la convention par construction — le manager
//     ne peut saisir que ce qu'il connaît au moment de la prise de mesure.
//     Point de vigilance opérationnel (non automatisable avec un simple
//     champ `date`, pas d'heure) : une livraison arrivée APRÈS l'ouverture
//     du jour D ne doit pas être ajoutée en correction sur la ligne D déjà
//     soumise — elle doit être saisie sur le relevé SUIVANT.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-carburant-moteur.js?v=20260903-1303"></script>
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

  // ------------------------------------------------------------
  // RÉFÉRENCE PHYSIQUE DU JOUR — 20/08/2026, demande de Frédéric : "les
  // cartes du haut doivent basculer automatiquement sur le dernier
  // jaugeage physique certifié, y compris celui effectué à la fin d'une
  // réception carburant. Attendre demain matin serait une perte de
  // fiabilité, puisque NEXUS possède déjà une information physique plus
  // récente." Compare l'heure du relevé du jour (jaugeage d'ouverture,
  // carburant_releves.created_at) à l'heure de fin de la dernière visite
  // de réception, SI elle a lieu aujourd'hui — et retient la plus récente
  // des deux comme référence physique. Une visite encore 'en_cours' n'est
  // jamais retenue (même garde que NexusReceptionDonnees.chargerDerniereVisite
  // : une visite en_cours n'est pas encore un fait établi). Pure fonction :
  // reçoit les objets déjà chargés par l'appelant, ne recalcule ni ne
  // requête rien elle-même (Article 11).
  function referencePhysiqueDuJour(releveDuJour, visiteDuJour, dateJour) {
    const visiteValide = (visiteDuJour && visiteDuJour.date_visite === dateJour && visiteDuJour.statut !== 'en_cours') ? visiteDuJour : null;
    if (!releveDuJour && !visiteValide) return { source: null, heure: null };
    if (!visiteValide) return { source: 'ouverture', heure: (releveDuJour && releveDuJour.created_at) || null };
    if (!releveDuJour || !releveDuJour.created_at) return { source: 'reception', heure: visiteValide.heure_fin || null };
    return new Date(visiteValide.heure_fin) > new Date(releveDuJour.created_at)
      ? { source: 'reception', heure: visiteValide.heure_fin }
      : { source: 'ouverture', heure: releveDuJour.created_at };
  }

  // Stock physique mesuré à la fin d'une visite de réception, pour un
  // carburant donné — somme du jaugeage_apres_l de toutes les cuves de ce
  // carburant sur la visite (une visite peut porter plusieurs cuves pour
  // un même carburant, ex. GO cuve1+cuve2 — même somme que
  // stockReelGoTotal côté relevé classique, Article 11). Retourne null si
  // une seule mesure manque — jamais une somme partielle présentée comme
  // un total fiable (Article 5).
  function stockPhysiquePostLivraison(visiteDuJour, carburant) {
    const mesures = ((visiteDuJour && visiteDuJour.mesures) || []).filter(m => m.carburant === carburant);
    if (!mesures.length) return null;
    if (mesures.some(m => m.jaugeage_apres_l === null || m.jaugeage_apres_l === undefined)) return null;
    return mesures.reduce((total, m) => total + Number(m.jaugeage_apres_l), 0);
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
  // CORRECTIF 14/08/2026 : 'Référence certifiée' (jour exact d'une
  // certification de point zéro, écart=0 par construction) est un statut
  // SAIN, jamais une absence de donnée — placé au même rang que 'Sous
  // contrôle' pour que ce moteur partagé (consommé par Brief/APP en plus
  // de Pilotage) ne redescende jamais ce jour-là vers "Données
  // insuffisantes" (Article 11 : une seule vérité, jamais deux lectures
  // différentes du même jour selon l'écran).
  const ORDRE_GRAVITE_CONTROLE = ['À corriger', 'À surveiller', 'Sous contrôle', 'Référence certifiée', 'Données insuffisantes'];

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
    if (statutGlobal === 'Référence certifiée') return 'Nouvelle référence carburants certifiée aujourd\'hui — écarts repartis à zéro.';
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
  function motifTheoriqueIndisponible({ dernierReleveExiste, dernierReel, releveDuJourExiste, ventes, fenetreIsolable, quartsChevauchants }) {
    if (!dernierReleveExiste) return 'Aucun relevé antérieur — première mesure, pas encore de référence pour calculer un théorique.';
    if (dernierReel == null) return 'Dernier relevé incomplet pour ce carburant (cuve non renseignée) — théorique non calculable.';
    if (!releveDuJourExiste) return 'Jaugeage du jour manquant.';
    if (fenetreIsolable === false) {
      const quarts = (quartsChevauchants || []).map(q => `${q.quart || 'quart'} du ${q.date || ''}`.trim()).join(', ');
      return `Écart non calculable : ${quarts || 'un quart de ventes'} chevauche la mesure physique de référence. NEXUS ne répartit pas des ventes qu'il ne peut pas isoler ; le prochain jaugeage d'ouverture rétablira automatiquement le contrôle.`;
    }
    if (ventes == null) return 'Ventes depuis la mesure physique de référence non disponibles — aucun quart avec litrage capté sur cette période.';
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
    // Correctif recette UI/UX (17/08/2026, CAR-UX-03) : le repli générique
    // n'utilise plus "Données insuffisantes" (texte non actionnable, source
    // de contradiction visuelle avec le badge "Rapprochement" voisin quand
    // celui-ci affiche "Fiable") mais "Historique d'analyse insuffisant" —
    // qui dit précisément QUOI manque (l'historique de ventes/relevés pour
    // juger l'écart), pas si le rapprochement lui-même est fiable.
    return { texte: motif || 'Historique d\'analyse insuffisant', niveau: 'attente' };
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

    // Point zéro (14/08/2026, correctif du même jour — retour de Frédéric :
    // "ne pas faire disparaître les jauges") : le jour de la certification,
    // un message d'accueil positif s'ajoute EN PLUS des jauges normales
    // (jamais à leur place) — la formulation "élégante" demandée par
    // Frédéric, prioritaire sur les autres messages.
    if (c.referenceCertifieeCeJour) {
      messages.push({ type: 'positif', texte: c.messageReferenceCertifiee || 'Nouvelle référence carburants certifiée aujourd\'hui.' });
    }

    // 0) Jaugeage du jour manquant (audit §8, exemple cible) — quand le
    // relevé du jour n'a pas été saisi mais qu'un relevé antérieur existe,
    // aucun écart n'est réellement calculable aujourd'hui : le dire
    // explicitement, avec les deux chiffres qui permettent d'agir, plutôt
    // que de laisser deviner via un simple "Données insuffisantes".
    if (!c.releveDuJour && c.dernierReleve && c.parCarburant && !c.referenceCertifieeCeJour) {
      const dateTxt = (c.dernierReleve.date || '').split('-').reverse().join('/');
      messages.push({
        type: 'attention',
        texte: `Jaugeage du jour manquant. Dernier relevé physique : ${dateTxt}. Saisissez le jaugeage pour contrôler l'écart.`,
      });
    }

    // 0bis) Qualité de chaîne dégradée (Sprint C6, audit §10 : "Ce que
    // NEXUS vous dit — Maximum 3 messages issus des contrôles fiables et
    // événements de réception"). Distinct des écarts d'ampleur ci-dessous
    // (statutCarburant) — ceci porte sur la CONFIANCE dans la chaîne elle-
    // même, condition préalable pour interpréter un écart. Priorité juste
    // après le jaugeage manquant : un contrôle non comparable/provisoire
    // explique souvent pourquoi l'écart affiché plus bas doit être lu avec
    // prudence, jamais un doublon silencieux du même problème.
    if (c.derniersControles) {
      CLES_CARBURANT.forEach(cle => {
        const ctrl = c.derniersControles[cle];
        if (!ctrl || ctrl.qualite === 'fiable') return;
        const causeTxt = libelleCauseQualiteChaine(ctrl.cause);
        const suffixe = causeTxt ? ` — ${causeTxt.charAt(0).toLowerCase()}${causeTxt.slice(1)}` : '';
        messages.push({
          type: 'attention',
          texte: `${NOM_CARBURANT_COURT[cle]} : contrôle ${ctrl.qualite === 'non_comparable' ? 'non comparable' : 'provisoire'}${suffixe}`,
        });
      });
    }

    // 0ter) Événement de réception récent nécessitant l'attention du
    // manager (Sprint C6) : une visite conclue avec dérogation manager
    // (compartiment non réceptionné débloqué) mérite un signalement au même
    // titre qu'un écart de contrôle — c'est un fait déjà tracé et qualifié
    // (Sprint C4), jamais recalculé ici.
    if (c.derniereVisite && c.derniereVisite.statut === 'terminee_avec_derogation') {
      const dateTxt = (c.derniereVisite.date_visite || '').split('-').reverse().join('/');
      messages.push({ type: 'attention', texte: `Réception du ${dateTxt} conclue avec dérogation manager (compartiment non réceptionné débloqué) — voir le relevé de réception.` });
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

    // 2) Livraison enregistrée sur ce relevé — événement à signaler
    // explicitement. Formulation volontairement neutre sur le moment exact
    // ("enregistrée sur le relevé du...", pas "livrée le...") : ce champ
    // capture une livraison reçue depuis le relevé précédent, entrée par le
    // manager au moment de CE jaugeage — elle a pu arriver la veille ou le
    // matin même, NEXUS ne connaît pas l'heure (convention temporelle,
    // voir l'en-tête du moteur), donc ne l'affirme jamais.
    if (c.releveDuJour) {
      const carburantsLivres = CLES_CARBURANT.filter(cle => Number(c.releveDuJour[`livraison_${cle}`]) > 0);
      if (carburantsLivres.length) {
        const details = carburantsLivres.map(cle => `${Math.round(c.releveDuJour[`livraison_${cle}`]).toLocaleString('fr-FR')} L ${NOM_CARBURANT_COURT[cle]}`).join(', ');
        messages.push({ type: 'info', texte: `Livraison enregistrée sur le relevé du ${(c.releveDuJour.date || '').split('-').reverse().join('/')}, intégrée à son théorique : ${details}.` });
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

  // ============================================================
  // CHAINE DE PREUVE — Sprint C1 (17/08/2026, NEXUS_Audit_Carburants_
  // Chaine_Preuve_Developpeur.pdf, cadrage transmis par Frédéric le
  // 16/08/2026) : transposer à Carburants la même discipline que la Trace
  // de contrôle FDJ (v2.116-v2.119) — "Un relevé physique est un fait : il
  // ne doit jamais être réécrit silencieusement" (audit, principe 1).
  // carburant_releves reste la vue COURANTE (comme fdj_cash_controls) ;
  // carburant_releve_versions est la preuve APPEND-ONLY de chaque écriture,
  // initiale ou correction (comme fdj_releves_cloture). Critère de sortie
  // du sprint (audit §16) : "Aucune correction silencieuse."
  // ============================================================

  // Détermine le prochain numéro de version et le type de version à partir
  // du relevé courant déjà en base pour ce (site, date) — jamais déduit
  // d'un compteur local qui pourrait diverger de la base. `precedent` :
  // ligne carburant_releves existante (ou null/undefined si aucun relevé
  // n'existe encore pour ce jour — première saisie).
  function prochaineVersionReleveCarburant(precedent) {
    return {
      versionNum: precedent ? (Number(precedent.version_num) || 1) + 1 : 1,
      typeVersion: precedent ? 'correction_manager' : 'saisie_initiale',
    };
  }

  // Diff minimal entre deux snapshots de relevé carburant — même discipline
  // que diffClotureFdj (nexus-fdj-moteur.js) : seulement les champs qui ont
  // réellement changé, jamais un diff bruyant qui recopie tout l'objet.
  // `precedent` : null pour une saisie initiale (pas de diff, c'est la
  // baseline). Retourne null si rien n'a changé (une "correction" qui ne
  // change aucune valeur ne doit pas produire un diff vide trompeur — voir
  // scénario C09 du plan de tests de l'audit).
  const CHAMPS_RELEVE_CARBURANT = [
    'stock_reel_go_cuve1', 'stock_reel_go_cuve2', 'stock_reel_sp95', 'stock_reel_gnr',
    'livraison_go', 'livraison_sp95', 'livraison_gnr',
    'mouvement_go', 'mouvement_sp95', 'mouvement_gnr',
    'motif_mouvement', 'commentaire',
  ];
  function diffReleveCarburant(precedent, nouveau) {
    if (!precedent) return null;
    const diff = {};
    CHAMPS_RELEVE_CARBURANT.forEach(champ => {
      const avant = precedent[champ] === undefined ? null : precedent[champ];
      const apres = nouveau[champ] === undefined ? null : nouveau[champ];
      if (avant !== apres) diff[champ] = { avant, apres };
    });
    return Object.keys(diff).length ? diff : null;
  }

  // ============================================================
  // PONT RÉCEPTION → CARBURANTS (21/08/2026, constat de Frédéric : "la
  // livraison a été bien enregistrée mais elle ne se voit pas dans le
  // stock"). Cause réelle : carburant_reception_mesures capture le vrai
  // jaugeage avant/après livraison (visite de réception carburant), mais
  // rien ne l'injectait dans carburant_releves — la seule table lue par
  // Carburants Pilotage pour le "stock". Même discipline que le pont
  // Jaugeage Inventaire → Carburants (19/08/2026) : cette fonction ne fait
  // QUE traduire des mesures déjà saisies en un patch de colonnes, la
  // VERSION (prochaineVersionReleveCarburant/diffReleveCarburant, ci-dessus)
  // reste la même pour toute écriture dans carburant_releves, jamais une
  // deuxième logique de versionnement.
  //
  // `mesures` = lignes carburant_reception_mesures d'UNE visite terminée :
  // [{cuve_id, carburant, jaugeage_apres_l, delta_mesure_l}]. `cuvesGo` =
  // station_config.cuves_carburants.go.cuves, DANS L'ORDRE physique du site
  // (index 0 -> stock_reel_go_cuve1, index 1 -> stock_reel_go_cuve2) — même
  // convention que l'écran manager NEXUS-Carburants-v1.html, qui n'expose
  // que ces deux emplacements fixes quel que soit l'id réel de la cuve
  // (Article 11 : pas une deuxième convention de mapping cuve→colonne).
  // N'écrit QUE les carburants réellement mesurés dans cette visite (un
  // carburant absent de `mesures` ressort à `undefined`, jamais un stock ou
  // une livraison de 0 fabriqués) — à l'appelant de compléter avec le
  // relevé précédent, exactement comme pour le pont pompiste.
  // `livraison` est un delta (le litrage mesuré au jaugeage pour CETTE
  // visite) : l'appelant doit l'ADDITIONNER à la livraison déjà posée le
  // même jour plutôt que l'écraser (une deuxième livraison le même jour ne
  // doit jamais faire disparaître la première, audit Carburants §6).
  function patchReleveDepuisReceptionMesures(mesures, cuvesGo) {
    const patch = { stockReel: {}, livraison: {} };
    const ordreGo = (Array.isArray(cuvesGo) ? cuvesGo : []).map(c => c.id);
    (mesures || []).forEach(m => {
      if (!m || m.jaugeage_apres_l == null || m.carburant == null) return;
      const stockMesure = Number(m.jaugeage_apres_l);
      const delta = Number(m.delta_mesure_l) || 0;
      if (m.carburant === 'sp95' || m.carburant === 'gnr') {
        patch.stockReel[m.carburant] = stockMesure;
        patch.livraison[m.carburant] = (patch.livraison[m.carburant] || 0) + delta;
      } else if (m.carburant === 'go') {
        const idx = ordreGo.indexOf(m.cuve_id);
        const slot = idx === 1 ? 'go_cuve2' : 'go_cuve1'; // repli sur cuve1 si l'ordre est inconnu/absent — jamais perdre la mesure
        patch.stockReel[slot] = stockMesure;
        patch.livraison.go = (patch.livraison.go || 0) + delta;
      }
    });
    return patch;
  }

  // ============================================================
  // QUALITÉ DE CHAÎNE — Sprint C2 (17/08/2026, audit Carburants §6 "Etats
  // et qualité : éviter les faux écarts") : "NEXUS ne doit jamais afficher
  // une perte ou un gain comme réel tant que la comparabilité de la chaine
  // n'est pas démontrée" (règle absolue, audit §2). Distinct du statut
  // d'écart (statutCarburant ci-dessus, qui mesure une AMPLEUR une fois le
  // théorique connu) : ceci qualifie la CONFIANCE dans la chaîne elle-même,
  // AVANT même de regarder si l'écart est grand ou petit. Critère de sortie
  // du sprint (roadmap audit §16) : "Aucun faux écart définitif."
  //
  // Seuls 2 états sont honnêtement détectables avec la granularité actuelle
  // du modèle (dates, sans horodatage précis du jaugeage) :
  //   - NON_COMPARABLE : une donnée critique manque -> le théorique n'est
  //     même pas calculable (calculerTheorique renverrait null). Jamais un
  //     écart affiché.
  //   - PROVISOIRE : le théorique EST calculable, mais un mouvement
  //     exceptionnel a été saisi sans être documenté (audit §6.1, "Mouvement
  //     exceptionnel non documenté") -> l'écart est affichable mais avec une
  //     cause de prudence explicite.
  //   - FIABLE sinon.
  // Les autres causes listées par l'audit (jaugeage pris après le début des
  // ventes, deux références concurrentes...) nécessitent un horodatage plus
  // fin que ce que `carburant_releves` capture aujourd'hui (dates seules) —
  // non fabriquées ici plutôt que de prétendre les détecter (Article 5,
  // "vérité avant certitude"). Reste ouvert pour un sprint ultérieur si
  // Frédéric confirme le besoin.
  function qualiteChaineCarburant({ referenceExiste, dernierReel, referenceCertifieeCeJour, reelDuJour, ventes, mouvement, commentaire, fenetreIsolable }) {
    if (referenceCertifieeCeJour) return { qualite: 'fiable', cause: null };
    if (!referenceExiste) return { qualite: 'non_comparable', cause: 'reference_absente' };
    if (dernierReel == null) return { qualite: 'non_comparable', cause: 'reference_incomplete' };
    if (reelDuJour == null) return { qualite: 'non_comparable', cause: 'mesure_finale_absente' };
    // Chaîne temporelle (21/08/2026) : un quart de ventes qui chevauche
    // l'ancre ou la mesure contrôlée ne peut pas être proprement inclus/exclu
    // avec la granularité actuelle (litrage agrégé par quart, pas de
    // ventilation interne) — provisoire, jamais un écart calculé sur une
    // ventilation devinée (Article 5). Vérifié AVANT ventes==null : une
    // fenêtre non isolable a délibérément ventes=null en amont (voir
    // resoudreVentesFenetre), mais la cause à afficher doit rester la
    // vraie raison (chevauchement), pas "ventes indisponibles" qui
    // laisserait croire à une simple absence de saisie.
    if (fenetreIsolable === false) return { qualite: 'provisoire', cause: 'fenetre_ventes_non_isolable' };
    if (ventes == null) return { qualite: 'non_comparable', cause: 'ventes_indisponibles' };
    if (mouvement && !commentaire) return { qualite: 'provisoire', cause: 'mouvement_exceptionnel_sans_motif' };
    return { qualite: 'fiable', cause: null };
  }

  const LIBELLE_CAUSE_QUALITE_CHAINE = {
    reference_absente: 'Aucun relevé antérieur — première mesure, pas encore de référence pour calculer un théorique.',
    reference_incomplete: 'Dernier relevé incomplet pour ce carburant (cuve non renseignée) — théorique non calculable.',
    mesure_finale_absente: 'Jaugeage du jour manquant ou incomplet pour ce carburant.',
    ventes_indisponibles: 'Ventes depuis le dernier relevé non disponibles — aucun quart avec litrage capté sur cette période.',
    mouvement_exceptionnel_sans_motif: 'Mouvement exceptionnel saisi sans motif documenté (champ Commentaire) — écart affiché avec prudence.',
    anterieur_au_point_zero: 'Période antérieure au point zéro certifié — aucun théorique qualifié sur cette période (Article 5).',
    fenetre_ventes_non_isolable: 'La dernière mesure a été prise en cours de journée (livraison ou contrôle intermédiaire) et un quart de vente chevauche cet instant — les litres vendus avant/après ne peuvent pas être isolés avec la précision actuelle des ventes (agrégées par quart). Écart non calculé tant qu\'un jaugeage pris en dehors de ce quart n\'est pas disponible.',
  };
  function libelleCauseQualiteChaine(cause) {
    return LIBELLE_CAUSE_QUALITE_CHAINE[cause] || null;
  }

  // ============================================================
  // CHAÎNE TEMPORELLE (21/08/2026, demande de Frédéric — faux écarts +1022L
  // SP95 / +912L GO du 21/08) : "Toute mesure physique de carburant possède
  // un horodatage, et NEXUS ne peut lui appliquer que les ventes et
  // mouvements survenus APRÈS cet horodatage." Règle absolue : Théorique(t1)
  // = Physique(t0) + livraisons(t0,t1) + mouvements(t0,t1) − ventes(t0,t1),
  // où t0/t1 sont des INSTANTS réels (mesure_le), jamais des dates civiles.
  //
  // NEXUS ne connaît les ventes qu'au grain du QUART (litrage agrégé par
  // audits_caisse.quart, aucun horodatage vente par vente) : un quart qui
  // chevauche t0 ou t1 ne peut pas être scindé sans inventer une
  // ventilation interne — dans ce cas la fenêtre est déclarée NON ISOLABLE
  // (voir qualiteChaineCarburant ci-dessus, cause 'fenetre_ventes_non_
  // isolable'), jamais un chiffre approché présenté comme précis.
  // ============================================================

  // Convertit une date civile + heure locale du fuseau DE LA STATION
  // (station_config.fuseau_horaire, ex. "America/Martinique" ; heure ex.
  // "05:45" issue de station_config.horaires) en instant UTC réel. Sans
  // dépendance externe (aucune lib de fuseaux dans NEXUS) : résout le
  // décalage réel via l'API Intl du runtime, en 2 passes pour rester
  // correct même si la première estimation tombe de l'autre côté d'un
  // changement d'heure. Hors périmètre assumé : l'instant exact d'une
  // éventuelle bascule DST elle-même (~2h, deux fois par an, en dehors des
  // horaires d'ouverture d'une station) — non géré, jamais silencieusement
  // approximé comme fiable au-delà de cette limite documentée.
  //
  // Renommée `instantLocalVersUTC` le 24/08/2026 (v2.232, anomalie
  // signalée par Frédéric : heures carburant fausses en Martinique) —
  // s'appelait `instantParisVersUTC` avec 'Europe/Paris' codé en dur,
  // alors que NEXUS ne tourne qu'en Martinique (UTC-4, jamais d'heure
  // d'été) : un décalage fixe de plusieurs heures sur TOUTES les fenêtres
  // de quart carburant. `fuseau` est désormais un paramètre obligatoire
  // (aucun défaut silencieux ici) — c'est à l'appelant (couche données) de
  // le lire depuis station_config.fuseau_horaire, seule source (Article
  // 11), avec son propre repli explicite si la colonne est absente.
  function instantLocalVersUTC(dateISO, heureHHMM, fuseau) {
    if (!dateISO || !heureHHMM || !fuseau) return null;
    const [h, mnt] = heureHHMM.split(':').map(Number);
    const [an, mo, jo] = dateISO.split('-').map(Number);
    if ([h, mnt, an, mo, jo].some(Number.isNaN)) return null;
    let dtf;
    try {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: fuseau, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch (e) {
      // Fuseau IANA invalide (ex. donnée corrompue en base) -> null, comme
      // toute autre entrée invalide de cette fonction, jamais une
      // exception qui remonterait jusqu'à l'écran.
      return null;
    }
    const lireCommeUTC = (ms) => {
      const parts = dtf.formatToParts(new Date(ms)).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
      const heure24 = parts.hour === '24' ? '00' : parts.hour;
      return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(heure24), Number(parts.minute), Number(parts.second));
    };
    const cible = Date.UTC(an, mo - 1, jo, h, mnt, 0);
    let offset = lireCommeUTC(cible) - cible;
    let instant = cible - offset;
    offset = lireCommeUTC(instant) - instant; // 2e passe : réévalue au voisinage de l'instant réel, pas de la première estimation.
    return new Date(cible - offset);
  }

  // Instant à utiliser comme borne de fenêtre pour UN relevé donné
  // (25/08/2026, retour de Frédéric : "le jaugeage que je mets le matin est
  // TOUJOURS celui de l'ouverture, même lorsqu'un employé oublie de le
  // saisir dans NEXUS au bon moment"). `mesure_le` capture l'instant
  // d'ENREGISTREMENT dans NEXUS (`new Date().toISOString()` au moment de la
  // saisie sur l'écran manager, limite documentée depuis v2.205, faute de
  // champ de saisie d'heure dédié) — PAS forcément l'instant physique réel
  // de la mesure. Vérifié sur données réelles (vito-sainte-marie, 23-24/08) :
  // les relevés du matin y sont systématiquement saisis en pleine fenêtre du
  // quart 1 (8h-12h), ce qui déclenchait à tort un "chevauchement" alors que
  // le jaugeage représentait bien le stock à l'ouverture.
  //
  // Distinction retenue, réutilisant le seul signal déjà présent en base
  // (`carburant_releves.origine`, Article 11 — jamais un nouveau champ) :
  //   - `origine !== 'reception_livraison'` (donc 'manager'/'terrain_pompiste',
  //     l'écrasante majorité des relevés) : un jaugeage d'ouverture, PAR
  //     CONVENTION toujours antérieur à tous les quarts de sa propre date —
  //     l'instant retenu est minuit local de `releve.date`, jamais
  //     `mesure_le`. Ceci restaure exactement la convention formalisée par
  //     Frédéric le 14/08/2026 (voir l'en-tête de ce fichier) pour ce cas.
  //   - `origine === 'reception_livraison'` : un relevé lié à une livraison
  //     représente un instant réel précis (ex. jaugeage post-livraison à
  //     15h01, le cas exact qui a motivé la chaîne temporelle horodatée de
  //     v2.205) — `mesure_le` reste l'ancre exacte, jamais remplacé par
  //     minuit, car LÀ le moment précis compte vraiment.
  function instantFenetreReleve(releve, fuseau) {
    if (!releve) return null;
    if (releve.origine === 'reception_livraison') {
      return releve.mesure_le ? new Date(releve.mesure_le) : null;
    }
    return instantLocalVersUTC(releve.date, '00:00', fuseau);
  }

  // Bornes LARGES (horaire étendu, jamais l'horaire normal) d'un quart pour
  // une date donnée — toujours la fourchette la plus prudente : mieux vaut
  // déclarer "chevauche" un quart qui ne chevauchait finalement pas vraiment
  // que l'inverse (Article 5, jamais une fausse certitude d'isolation).
  // `horaires` = station_config.horaires. `quartCle` = 'quart1' | 'quart2'.
  // Retourne null si ce quart n'est pas configuré pour ce site (jamais une
  // bascule silencieuse sur un horaire par défaut inventé).
  function fenetreQuartLarge(horaires, quartCle, dateISO, fuseau) {
    const q = horaires && horaires[quartCle];
    if (!q) return null;
    const debut = q.etendu || q.normal;
    const fin = q.fin_etendu || q.fin_normal;
    if (!debut || !fin) return null;
    const bDebut = instantLocalVersUTC(dateISO, debut, fuseau);
    const bFin = instantLocalVersUTC(dateISO, fin, fuseau);
    if (!bDebut || !bFin) return null;
    return { debut: bDebut, fin: bFin };
  }

  // Position d'un quart (ses bornes larges) par rapport à une fenêtre de
  // calcul [t0, t1] (Date, t0 exclu car déjà reflété dans l'ancre physique,
  // t1 inclus car c'est l'instant de la mesure contrôlée) :
  //  'avant'     quart entièrement terminé à ou avant t0 -> déjà dans l'ancre, exclu proprement.
  //  'apres'     quart débute à ou après t1 -> pas encore survenu, exclu (comptera dans la fenêtre suivante).
  //  'dans'      quart entièrement compris dans [t0, t1] -> inclus.
  //  'chevauche' le quart déborde d'un côté ou de l'autre -> non isolable.
  //  'inconnu'   horaires non configurés pour ce quart -> traité comme un chevauchement (jamais une fausse certitude).
  //  'instant_non_disponible' (27/08/2026, P0 — retour de Frédéric, crash
  //  réel sur vito-sainte-marie) : `t0` ou `t1` lui-même est absent (ex. un
  //  relevé `reception_livraison` sans `mesure_le` enregistré — anomalie de
  //  saisie réelle constatée le 26/08 — fait retourner `null` par
  //  `instantFenetreReleve`). AVANT ce correctif, cette fonction supposait
  //  toujours `t0`/`t1` valides et plantait sur `.getTime()` d'un `null` —
  //  remonté jusqu'au Brief NEXUS (écran d'accueil bloqué). Traité comme un
  //  chevauchement par l'appelant (jamais une fausse certitude, Article 5),
  //  mais jamais une exception (Article 5 également : un plantage n'est
  //  jamais préférable à une donnée honnêtement non calculable).
  function classerQuartFaceFenetre(fenetreQuart, t0, t1) {
    if (!fenetreQuart) return 'inconnu';
    if (!t0 || !t1) return 'instant_non_disponible';
    const { debut, fin } = fenetreQuart;
    if (fin.getTime() <= t0.getTime()) return 'avant';
    if (debut.getTime() >= t1.getTime()) return 'apres';
    if (debut.getTime() >= t0.getTime() && fin.getTime() <= t1.getTime()) return 'dans';
    return 'chevauche';
  }

  // Résout les ventes RÉELLEMENT isolables sur la fenêtre [t0, t1], quart
  // par quart — jamais une somme sur des dates civiles (voir l'en-tête de
  // cette section). `lignesQuarts` = [{date, quart, litrage_gazole,
  // litrage_sp95, litrage_gnr}] (déjà chargées par l'appelant sur une plage
  // large englobant t0/t1, Article 11 — cette fonction ne requête rien).
  // `horaires` = station_config.horaires du site. Dès qu'UN SEUL quart
  // chevauche ou a des horaires inconnus, la fenêtre entière est déclarée
  // non isolable (ventes=null sur les 3 carburants) : une seule ventilation
  // impossible à isoler suffit à rendre le calcul non fiable, jamais un
  // résultat partiel présenté comme complet.
  function resoudreVentesFenetre(lignesQuarts, horaires, t0, t1, fuseau) {
    const champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    const somme = { go: 0, sp95: 0, gnr: 0 };
    const trouve = { go: false, sp95: false, gnr: false };
    const quartsChevauchants = [];
    const quartsInclus = [];
    (lignesQuarts || []).forEach(ligne => {
      const quartCle = ligne.quart === '2' ? 'quart2' : 'quart1';
      const fenetreQuart = fenetreQuartLarge(horaires, quartCle, ligne.date, fuseau);
      const position = classerQuartFaceFenetre(fenetreQuart, t0, t1);
      if (position === 'chevauche' || position === 'inconnu' || position === 'instant_non_disponible') {
        const raison = position === 'inconnu' ? 'horaires_non_configures'
          : (position === 'instant_non_disponible' ? 'instant_ancre_ou_mesure_non_calculable' : 'chevauche_ancre_ou_mesure');
        quartsChevauchants.push({ date: ligne.date, quart: ligne.quart, raison });
        return;
      }
      if (position !== 'dans') return; // avant/après -> hors fenêtre, exclu proprement, jamais compté.
      quartsInclus.push({ date: ligne.date, quart: ligne.quart });
      Object.entries(champs).forEach(([cle, champ]) => {
        if (ligne[champ] != null) { somme[cle] += Number(ligne[champ]); trouve[cle] = true; }
      });
    });
    if (quartsChevauchants.length) {
      return { ventes: { go: null, sp95: null, gnr: null }, isolable: false, quartsChevauchants, quartsInclus };
    }
    return {
      ventes: { go: trouve.go ? somme.go : null, sp95: trouve.sp95 ? somme.sp95 : null, gnr: trouve.gnr ? somme.gnr : null },
      isolable: true, quartsChevauchants: [], quartsInclus,
    };
  }

  // Quarts "en cours ou pas encore clôturés" (25/08/2026, retour de Frédéric :
  // "nexus doit faire une estimation des ventes en fonction de son
  // historique" plutôt que de bloquer tout calcul de stock estimé maintenant
  // tant qu'un quart n'est pas clôturé). DISTINCT du chevauchement réel de
  // v2.205 (`resoudreVentesFenetre` ci-dessus, `quartsChevauchants`) : là-bas,
  // une ligne audits_caisse EXISTE déjà mais ses bornes débordent
  // l'ancre/la mesure — ventilation réellement ambiguë, jamais résolue par
  // une estimation (Article 5, précision réelle impossible). Ici, il n'y a
  // ENCORE AUCUNE ligne pour ce quart (le manager ne l'a pas clôturé) —
  // NEXUS peut légitimement estimer sa part avec l'historique du même
  // créneau plutôt que d'afficher un blocage total.
  // `lignesQuartsJour` = lignes audits_caisse du seul jour `dateISO` (déjà
  // filtrées par l'appelant — Article 11, jamais une deuxième lecture).
  // Retourne les quarts de CE jour dont la fenêtre large touche [t0,t1] mais
  // qui n'ont encore aucune ligne, avec la fraction de leur durée déjà
  // écoulée à l'instant `t1` (pour prorater l'estimation — un quart tout
  // juste ouvert ne doit pas se voir attribuer sa moyenne complète).
  function quartsAEstimerDansFenetre(lignesQuartsJour, horaires, dateISO, t0, t1, fuseau) {
    const presents = new Set((lignesQuartsJour || []).map(l => String(l.quart)));
    const quarts = [{ cle: 'quart1', num: '1' }, { cle: 'quart2', num: '2' }];
    const resultat = [];
    quarts.forEach(({ cle, num }) => {
      if (presents.has(num)) return; // déjà clôturé -> jamais recouvert ici, voir resoudreVentesFenetre.
      const fenetreQuart = fenetreQuartLarge(horaires, cle, dateISO, fuseau);
      if (!fenetreQuart) return; // horaires non configurés -> aucune estimation possible, reste non calculable.
      const position = classerQuartFaceFenetre(fenetreQuart, t0, t1);
      // 'avant'/'apres' -> hors fenêtre, rien à estimer. 'inconnu'/
      // 'instant_non_disponible' (27/08/2026, P0) -> t0/t1 lui-même
      // absent (ex. reception_livraison sans mesure_le) : jamais tenter
      // `.getTime()` sur un instant manquant (Article 5, jamais un
      // plantage), reste honnêtement non estimé plutôt qu'un chiffre
      // fabriqué sur une durée impossible à calculer.
      if (position === 'avant' || position === 'apres' || position === 'inconnu' || position === 'instant_non_disponible') return;
      const dureeMs = fenetreQuart.fin.getTime() - fenetreQuart.debut.getTime();
      const ecouleMs = Math.min(t1.getTime(), fenetreQuart.fin.getTime()) - fenetreQuart.debut.getTime();
      const fraction = dureeMs > 0 ? Math.max(0, Math.min(1, ecouleMs / dureeMs)) : 0;
      resultat.push({ quartCle: cle, quart: num, fraction });
    });
    return resultat;
  }

  // Part de la durée d'un quart réellement comprise dans [t0, t1]. Sert aussi
  // bien à un quart à cheval sur une borne qu'à un quart entièrement dedans.
  function fractionRecouvrementQuart(fenetreQuart, t0, t1) {
    if (!fenetreQuart || !t0 || !t1) return 0;
    const debutQ = fenetreQuart.debut.getTime();
    const finQ = fenetreQuart.fin.getTime();
    const duree = finQ - debutQ;
    if (!(duree > 0)) return 0;
    const debut = Math.max(debutQ, t0.getTime());
    const fin = Math.min(finQ, t1.getTime());
    return Math.max(0, Math.min(1, (fin - debut) / duree));
  }

  // Ventilation d'une fenêtre de contrôle AVEC estimation des parts non
  // mesurables (02/09/2026, doctrine posée par Frédéric : "un quart manquant
  // doit être remplacé par une estimation ; dès qu'on voit que le quart
  // manquant est intégré, il prend la place de l'estimation comme vérité").
  //
  // Trois natures de quart, jamais confondues dans le résultat :
  //   - entièrement DANS la fenêtre et saisi  -> vérité mesurée, telle quelle
  //   - saisi mais À CHEVAL sur une borne     -> la part interne est estimée
  //     (moyenne du même créneau x fraction de durée recouverte). Saisir
  //     davantage ne résoudra jamais ce cas : un litrage agrégé par quart
  //     n'est pas ventilable à l'intérieur du quart.
  //   - ABSENT alors que sa fenêtre touche    -> estimé de la même façon.
  //     Celui-là disparaît tout seul le jour où le quart est saisi : il
  //     bascule alors dans la première catégorie, sans rien à recalculer.
  //
  // Fonction PURE : les moyennes historiques sont fournies par l'appelant
  // (`moyennesParQuart` = { '1': {go, sp95, gnr}, '2': {...} }, litres pour
  // un quart complet), jamais lues ici — le moteur ne fait aucune requête.
  //
  // `contexte` est le journal de ce qui a été estimé et comment. Il existe
  // pour être affiché et tracé, jamais pour être promu en vérité métier :
  // une part estimée ne doit pas entrer dans carburant_controles comme un
  // écart constaté (décision de Frédéric, 02/09/2026).
  function ventilerFenetreAvecEstimation(lignesQuarts, horaires, t0, t1, fuseau, moyennesParQuart, datesFenetre) {
    const champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    const carbs = ['go', 'sp95', 'gnr'];
    const reelles = { go: 0, sp95: 0, gnr: 0 };
    const estimees = { go: 0, sp95: 0, gnr: 0 };
    const trouve = { go: false, sp95: false, gnr: false };
    const estime = { go: false, sp95: false, gnr: false };
    const contexte = [];
    const moyennes = moyennesParQuart || {};
    let bloque = null;

    function moyenneQuart(num, carb) {
      const m = moyennes[String(num)];
      const v = m ? m[carb] : null;
      return (v == null || !isFinite(Number(v))) ? null : Number(v);
    }

    function estimerPart(dateISO, num, quartCle, nature) {
      const fenetreQuart = fenetreQuartLarge(horaires, quartCle, dateISO, fuseau);
      if (!fenetreQuart) return;
      const fraction = fractionRecouvrementQuart(fenetreQuart, t0, t1);
      if (fraction <= 0) return;
      const volumes = {};
      let auMoinsUn = false;
      carbs.forEach(carb => {
        const moy = moyenneQuart(num, carb);
        if (moy == null) { volumes[carb] = null; return; }
        const v = moy * fraction;
        volumes[carb] = v;
        estimees[carb] += v;
        estime[carb] = true;
        auMoinsUn = true;
      });
      contexte.push({ date: dateISO, quart: String(num), nature, fraction, volumes,
                      estimable: auMoinsUn });
    }

    (lignesQuarts || []).forEach(ligne => {
      const num = String(ligne.quart) === '2' ? '2' : '1';
      const quartCle = num === '2' ? 'quart2' : 'quart1';
      const fenetreQuart = fenetreQuartLarge(horaires, quartCle, ligne.date, fuseau);
      const position = classerQuartFaceFenetre(fenetreQuart, t0, t1);
      if (position === 'inconnu' || position === 'instant_non_disponible') {
        // Ni mesure ni estimation possibles : la fenêtre du quart elle-même
        // n'est pas calculable. On ne fabrique rien (Article 5).
        bloque = position === 'inconnu' ? 'horaires_non_configures' : 'instant_ancre_ou_mesure_non_calculable';
        return;
      }
      if (position === 'avant' || position === 'apres') return;
      if (position === 'dans') {
        contexte.push({ date: ligne.date, quart: num, nature: 'reel', fraction: 1, volumes: null, estimable: true });
        carbs.forEach(carb => {
          const v = ligne[champs[carb]];
          if (v != null) { reelles[carb] += Number(v); trouve[carb] = true; }
        });
        return;
      }
      estimerPart(ligne.date, num, quartCle, 'estime_chevauchement');
    });

    // Quarts sans aucune ligne dont la fenêtre touche [t0, t1].
    const saisis = new Set((lignesQuarts || []).map(l => `${l.date}:${String(l.quart)}`));
    (datesFenetre || []).forEach(dateISO => {
      [['1', 'quart1'], ['2', 'quart2']].forEach(([num, quartCle]) => {
        if (saisis.has(`${dateISO}:${num}`)) return;
        estimerPart(dateISO, num, quartCle, 'estime_absent');
      });
    });

    if (bloque) {
      return { ventes: { go: null, sp95: null, gnr: null }, ventesReelles: { go: null, sp95: null, gnr: null },
               ventesEstimees: { go: null, sp95: null, gnr: null }, estime: false, bloque, contexte };
    }

    const ventes = {};
    carbs.forEach(carb => {
      if (!trouve[carb] && !estime[carb]) { ventes[carb] = null; return; }
      ventes[carb] = (trouve[carb] ? reelles[carb] : 0) + (estime[carb] ? estimees[carb] : 0);
    });
    return {
      ventes,
      ventesReelles: { go: trouve.go ? reelles.go : null, sp95: trouve.sp95 ? reelles.sp95 : null, gnr: trouve.gnr ? reelles.gnr : null },
      ventesEstimees: { go: estime.go ? estimees.go : null, sp95: estime.sp95 ? estimees.sp95 : null, gnr: estime.gnr ? estimees.gnr : null },
      estime: carbs.some(c => estime[c]),
      bloque: null,
      contexte,
    };
  }

  // Traduit une ventilation estimée en théorique/écart ESTIMÉS pour un
  // carburant, avec la phrase qui dit d'où ça vient (02/09/2026).
  //
  // Ne s'active que là où la chaîne mesurée se tait (`theorique == null`) :
  // une estimation ne vient jamais concurrencer un écart réellement calculé,
  // elle ne fait que remplir un silence. Le résultat porte `estime: true` et
  // n'a pas vocation à être enregistré dans carburant_controles — c'est la
  // règle posée par Frédéric : mémoriser le contexte, jamais promouvoir
  // l'estimation en vérité métier.
  function estimationControleCarburant(r, ventilation, cle) {
    const vide = { disponible: false, ventesEstimees: null, theoriqueEstime: null, ecartEstime: null, phrase: null, quarts: [] };
    if (!r || !ventilation || !ventilation.estime) return vide;
    if (r.theorique != null) return vide; // la mesure prime toujours
    const ventes = ventilation.ventes ? ventilation.ventes[cle] : null;
    if (ventes == null || r.dernierReel == null) return vide;
    const theorique = Number(r.dernierReel) + (Number(r.livraison) || 0) + (Number(r.mouvement) || 0) - Number(ventes);
    const ecart = r.reelDuJour != null ? Number(r.reelDuJour) - theorique : null;
    const quarts = (ventilation.contexte || []).filter(c => c.nature !== 'reel');
    const dire = c => `quart ${c.quart} du ${String(c.date).slice(8, 10)}/${String(c.date).slice(5, 7)}`
      + (c.nature === 'estime_chevauchement' ? ' (coupé par la livraison)' : ' (non saisi)');
    const phrase = quarts.length
      ? `Estimation — ${quarts.map(dire).join(', ')}. Part reconstituée à partir de la moyenne du même créneau sur 14 jours, au prorata du temps concerné. Ordre de grandeur pour situer la journée : ce n'est pas un écart constaté et rien n'est enregistré comme tel.`
      : null;
    return { disponible: true, ventesEstimees: Number(ventes), theoriqueEstime: theorique, ecartEstime: ecart, phrase, quarts };
  }

  // Sprint C6 "Pilotage" (17/08/2026, audit §10 : "Situation aujourd'hui —
  // Badge de qualité par carburant : référence fiable, contrôle provisoire,
  // non comparable"). Traduit une `qualite` de carburant_controles (posée
  // dès le Sprint C2) en {texte, niveau} — mêmes 4 niveaux que le reste de
  // l'écran (NIVEAU_COULEUR : ok/attention/alerte/attente), jamais une 5e
  // catégorie inventée pour ce badge. `non_comparable` reste volontairement
  // 'attente' (ni vert ni rouge) : l'audit est explicite, une chaîne non
  // comparable n'est PAS une alerte de performance, c'est une absence de
  // preuve — la confondre avec une alerte inciterait à y voir un problème
  // opérationnel qui n'est peut-être pas réel (Article 5).
  //
  // Correctif recette UI/UX (17/08/2026, cahier CAR-UX-03 + §2 "Grammaire
  // visuelle à figer") : les libellés sont désormais strictement pris dans
  // le vocabulaire "Qualité de donnée" figé par le cahier — Fiable / A
  // confirmer / Historique insuffisant / Comparaison partielle — jamais un
  // synonyme improvisé. `non_comparable` se scinde en deux formulations
  // selon la `cause` déjà posée par qualiteChaineCarburant() : une absence
  // totale de référence antérieure (reference_absente/reference_incomplete)
  // est un problème d'HISTORIQUE (rien à comparer), tandis qu'une mesure du
  // jour ou des ventes manquantes (mesure_finale_absente/ventes_indisponibles/
  // anterieur_au_point_zero) est une COMPARAISON PARTIELLE (l'historique
  // existe, seule la donnée du jour manque) — deux réalités différentes que
  // l'ancien libellé unique "Non comparable" confondait.
  const LIBELLE_QUALITE_CONTROLE = {
    fiable: { texte: 'Fiable', niveau: 'ok' },
    provisoire: { texte: 'A confirmer', niveau: 'attention' },
    non_comparable: { texte: 'Comparaison partielle', niveau: 'attente' },
  };
  const CAUSES_HISTORIQUE_INSUFFISANT = new Set(['reference_absente', 'reference_incomplete']);
  function libelleQualiteControle(qualite, cause) {
    if (qualite === 'non_comparable' && CAUSES_HISTORIQUE_INSUFFISANT.has(cause)) {
      return { texte: 'Historique insuffisant', niveau: 'attente' };
    }
    return LIBELLE_QUALITE_CONTROLE[qualite] || { texte: 'Non calculé', niveau: 'attente' };
  }

  // Diagnostic d'absence de contrôle posé (28/08/2026, retour de Frédéric —
  // "Relevé de contrôle" affichait le MÊME texte générique "Aucun contrôle
  // posé... jaugeage pas encore saisi, ou écriture de contrôle en
  // attente/échouée" pour 3 situations très différentes, ce qui laissait
  // croire à une panne alors qu'un pompiste avait simplement déjà saisi le
  // jaugeage (déjà visible dans "Situation aujourd'hui", calculée en direct
  // depuis carburant_releves) sans qu'un manager n'ait encore validé sa
  // saisie — seul l'écran manager NEXUS-Carburants-v1.html écrit la preuve
  // dans carburant_controles (bouton "Enregistrer"), jamais le formulaire
  // terrain (`enregistrerJaugeageOuverturePompiste`, Sprint C-terrain).
  // `releve` = ligne brute carburant_releves du jour (ou null), déjà chargée
  // par chargerControleJour/chargerReleveDuJour (Article 11, aucune 2ᵉ
  // requête ici — fonction pure, ne fait que qualifier ce qui est donné).
  // Distingue 3 cas honnêtement, jamais un texte unique qui confond une
  // absence normale avec une vraie panne :
  // - aucun jaugeage saisi du tout pour cette date (niveau neutre,
  //   'attente') ;
  // - jaugeage terrain saisi, en attente de validation manager (niveau
  //   'attention', amber — une action est requise, mais ce n'est pas une
  //   panne) ;
  // - écriture de la preuve réellement en échec, `carburant_releves.
  //   controle_statut='erreur'` (niveau 'alerte', rouge — panne réelle).
  function diagnosticAbsenceControle(releve) {
    if (!releve) {
      return { cas: 'aucun_jaugeage', niveau: 'attente', texte: 'Aucun jaugeage saisi pour cette date.' };
    }
    if (releve.controle_statut === 'erreur') {
      return {
        cas: 'ecriture_echouee', niveau: 'alerte',
        texte: "Le jaugeage a été saisi mais l'écriture de la preuve de contrôle a échoué — recommencez l'enregistrement depuis l'écran Carburants (manager).",
      };
    }
    if (releve.origine === 'terrain_pompiste') {
      return {
        cas: 'en_attente_validation', niveau: 'attention',
        texte: "Jaugeage saisi par le terrain — en attente de validation par un manager. Ouvrez l'écran Carburants et enregistrez pour poser la preuve de contrôle.",
      };
    }
    // Cas résiduel honnête (Article 5) : un relevé existe, ni en échec ni
    // d'origine terrain non validée, mais aucun contrôle n'a pourtant été
    // posé (ex. controle_statut resté au défaut 'en_attente' sans raison
    // identifiée) — pas de fausse certitude, on garde l'ancien texte
    // générique plutôt que de choisir arbitrairement l'un des 2 cas
    // ci-dessus.
    return { cas: 'aucun_jaugeage', niveau: 'attente', texte: 'Aucun contrôle posé pour cette date — jaugeage pas encore saisi, ou écriture de contrôle en attente/échouée.' };
  }

  // Diagnostic contextuel d'un écart physique/théorique (28/08/2026, retour
  // de Frédéric — nouvelle demande : "avant de conclure à une anomalie de
  // litrage, NEXUS doit d'abord vérifier si tous les contrôles de caisse
  // Verify nécessaires jusqu'à la date/au quart du relevé sont terminés
  // [...] l'ordre à respecter : Relevé saisi -> Relevé validé ? -> Verify
  // complet jusqu'au relevé ? -> Recalcul du théorique -> Écart toujours
  // présent ? -> Investigation carburant. NEXUS ne doit donc jamais envoyer
  // automatiquement vers Verify simplement parce qu'il existe un écart."
  // Fonction pure : ne calcule AUCUN écart ni statut elle-même — `statut`
  // (sortie de statutCarburant, seule source de vérité pour "y a-t-il un
  // écart significatif", Article 11) et `ecartL` (calculerEcart) restent
  // entièrement calculés en amont. Cette fonction ne fait que QUALIFIER un
  // écart déjà constaté 'À corriger', jamais un second seuil inventé ici.
  // `releveValide` : le relevé qui sert d'ancre à ce calcul a-t-il déjà été
  // validé par un manager (même convention que diagnosticAbsenceControle
  // ci-dessus : `origine !== 'terrain_pompiste'`) — si non, un écart
  // apparent peut n'être qu'une saisie terrain pas encore contrôlée, jamais
  // une anomalie confirmée (point 1, priorité avant même Verify — l'ordre
  // exact demandé : validé ? AVANT Verify complet ?).
  // `verifyManquants` : sous-ensemble de la sortie de
  // NexusCarburantCommandeDonnees.chargerAvisVerifyJour (Article 11, aucun
  // second calcul de statut de validation Verify ici) dont la date est
  // antérieure ou égale à la date du relevé ancre — les quarts dont la
  // maîtrise des litres vendus (donc du théorique) n'est pas encore
  // confirmée par un manager.
  // "Recalcul du théorique" et "Écart toujours présent ?" (étapes 4 et 5 de
  // l'ordre demandé) n'ont besoin d'aucun code dédié : `statut`/`ecartL`
  // sont déjà recalculés à chaque chargement de l'écran depuis les données
  // réelles courantes (aucun cache) — dès qu'un contrôle Verify est complété
  // ou qu'un relevé est validé/corrigé, le prochain chargement reflète
  // automatiquement le nouvel état, sans intervention supplémentaire.
  function diagnostiquerEcartCarburant({ statut, ecartL, releveValide, verifyManquants } = {}) {
    const ecart = ecartL != null ? Number(ecartL) : null;
    if (statut == null || statut === 'Données insuffisantes') {
      return { cas: 'donnees_insuffisantes', niveau: 'attente', ecartL: ecart };
    }
    if (statut === 'Sous contrôle' || statut === 'À surveiller') {
      return { cas: 'ecart_acceptable', niveau: 'ok', ecartL: ecart };
    }
    // statut === 'À corriger' à partir d'ici : écart significatif constaté
    // — reste à déterminer si NEXUS peut déjà le qualifier d'anomalie.
    if (releveValide === false) {
      return { cas: 'releve_non_valide', niveau: 'attention', ecartL: ecart };
    }
    const manquants = Array.isArray(verifyManquants) ? verifyManquants : [];
    if (manquants.length) {
      return { cas: 'verify_incomplet', niveau: 'attention', ecartL: ecart, verifyManquants: manquants };
    }
    return { cas: 'anomalie_a_investiguer', niveau: 'alerte', ecartL: ecart };
  }

  // Sprint C7 "Analyse" (17/08/2026, audit roadmap : "Signature delta
  // livraison / statistiques", critère de sortie "Historique suffisant et
  // fiable"). Agrège la qualité des N derniers contrôles DÉJÀ posés
  // (carburant_controles, une ligne par date — jamais recalculé ici,
  // Article 11) en pourcentages fiable/provisoire/non_comparable, pour que
  // le manager (et le futur Sprint C8 Économique) puisse juger si
  // l'historique physique du site est assez solide pour être exploité,
  // pas seulement contrôle-par-contrôle comme le fait déjà "Ce que NEXUS
  // vous dit" (C6). `controles` : un contrôle par date (dernière version
  // uniquement — dédupliqué par l'appelant/le chargeur, jamais toutes les
  // versions comptées comme des jours distincts).
  const SEUIL_HISTORIQUE_CHAINE_SUFFISANT = 10;
  function statistiquesFiabiliteChaine(controles) {
    const liste = controles || [];
    if (!liste.length) {
      return { total: 0, pctFiable: null, pctProvisoire: null, pctNonComparable: null, suffisant: false };
    }
    const compte = { fiable: 0, provisoire: 0, non_comparable: 0 };
    liste.forEach(c => { if (c && compte[c.qualite] !== undefined) compte[c.qualite]++; });
    const total = liste.length;
    return {
      total,
      pctFiable: compte.fiable / total,
      pctProvisoire: compte.provisoire / total,
      pctNonComparable: compte.non_comparable / total,
      suffisant: total >= SEUIL_HISTORIQUE_CHAINE_SUFFISANT,
    };
  }

  // Phrase de lecture pour le manager — jamais une conclusion ferme sur un
  // historique encore court (Article 5), et jamais un jugement de
  // performance sur le taux de non_comparable (c'est une mesure de PREUVE
  // disponible, pas d'exploitation du site).
  function libelleFiabiliteChaine(stats) {
    if (!stats || !stats.total) {
      return "Aucun contrôle posé pour l'instant — l'historique se construira au fil des jaugeages.";
    }
    if (!stats.suffisant) {
      return `Historique encore court (${stats.total} contrôle${stats.total > 1 ? 's' : ''} sur ${SEUIL_HISTORIQUE_CHAINE_SUFFISANT} nécessaires pour une lecture fiable) — à consolider avant d'en tirer une tendance.`;
    }
    const pctFiableTxt = Math.round(stats.pctFiable * 100);
    if (stats.pctNonComparable === 0 && stats.pctProvisoire === 0) {
      return `Historique solide : ${pctFiableTxt} % des ${stats.total} derniers contrôles sont fiables, aucun trou de preuve.`;
    }
    const pctDegradeTxt = Math.round((stats.pctProvisoire + stats.pctNonComparable) * 100);
    return `${pctFiableTxt} % des ${stats.total} derniers contrôles sont fiables (${pctDegradeTxt} % provisoires ou non comparables) — suffisant pour dégager une tendance, en gardant ces jours en réserve.`;
  }

  // ============================================================
  // VALORISATION ÉCONOMIQUE — Sprint C8 "Économique" (17/08/2026, audit
  // "Carburants — Réceptions, deltas et effet économique du stock" §6/§7 :
  // "Le moteur économique peut ensuite exploiter une chaîne physique
  // fiable [...] Il ne doit pas être mélangé à la phase P0", roadmap
  // §15/§16 : "Seulement si achats/CMP fiables"). Dernier sprint de la
  // roadmap C1-C8 — s'appuie sur toute la chaîne de preuve physique déjà
  // posée (C1-C7), n'invente aucune nouvelle source de vérité physique.
  //
  // Aucun coût d'achat n'existait nulle part dans NEXUS avant ce sprint
  // (vérifié explicitement : seul le PRIX DE VENTE est capturé,
  // station_config.prix_carburants et audits_caisse.prix_*). Le coût
  // d'achat par litre est désormais saisi a posteriori par le manager sur
  // une ligne de réception déjà posée (carburant_reception_visite_
  // lignes.cout_achat_par_litre, Sprint C8) — l'employé ne le connaît
  // jamais au moment de la livraison (le BL ne porte généralement pas le
  // prix). Tant qu'aucun coût n'a été saisi, aucun CMP n'est fabriqué
  // (Article 5) : ce bloc peut légitimement rester silencieux pendant des
  // semaines sur un site qui n'a pas encore commencé à saisir ses coûts.
  //
  // CMP (coût moyen pondéré) recalculé de façon PROGRESSIVE, livraison
  // coûtée après livraison coûtée (formule de référence de l'audit §7) :
  //   nouveau CMP = (ancien_stock × ancien_CMP + nouvelle_quantité × nouveau_coût) / nouveau_volume_total
  // `stockAvantL` de chaque livraison coûtée vient du jaugeage AVANT
  // livraison déjà mesuré par l'employé pendant cette même visite
  // (carburant_reception_mesures.jaugeage_avant_l, sommé par carburant) —
  // jamais une nouvelle mesure de stock fabriquée pour ce sprint
  // (Article 11 : réutilise une vérité physique déjà posée par C4).
  // ============================================================

  // Une seule livraison coûtée : CMP = coût de cette livraison (aucun
  // "ancien CMP" à pondérer — c'est le point de départ du suivi). Cas
  // suivants : moyenne pondérée classique. `stockAvantL` manquant/nul (cas
  // limite, jaugeage incomplet) -> repli sur le coût de cette livraison
  // plutôt qu'une division par un volume nul ou une exception.
  function calculerCmpApresLivraison({ cmpPrecedent, stockAvantL, quantiteLivreeL, coutAchatParLitre }) {
    if (coutAchatParLitre == null || quantiteLivreeL == null || quantiteLivreeL <= 0) return cmpPrecedent != null ? cmpPrecedent : null;
    if (cmpPrecedent == null || stockAvantL == null || stockAvantL <= 0) return coutAchatParLitre;
    const nouveauVolumeTotal = stockAvantL + quantiteLivreeL;
    if (nouveauVolumeTotal <= 0) return coutAchatParLitre;
    return (stockAvantL * cmpPrecedent + quantiteLivreeL * coutAchatParLitre) / nouveauVolumeTotal;
  }

  // Rejoue TOUTES les livraisons coûtées d'un carburant, triées
  // chronologiquement croissant, pour obtenir le CMP courant — même
  // discipline de reconstruction séquentielle que reconstruireControlesSuivants
  // (Sprint C3), appliquée ici à la valorisation plutôt qu'au théorique
  // physique. `livraisons` = [{stockAvantL, quantiteLivreeL, coutAchatParLitre}],
  // déjà filtrées par l'appelant sur coutAchatParLitre non nul (Article 5 :
  // ce moteur ne filtre pas lui-même une livraison "invalide", il fait
  // confiance à des données déjà correctes en entrée, comme le reste du
  // moteur carburant). `coutRemplacementActuel` = coût de la DERNIÈRE
  // livraison coûtée connue -- explicitement PAS un prix de marché temps
  // réel (non disponible), documenté comme tel dans le libellé affiché à
  // l'écran, jamais présenté comme davantage que ce qu'il est.
  function calculerCmpProgressif(livraisons) {
    let cmp = null;
    let coutRemplacementActuel = null;
    let nombreLivraisonsCoutees = 0;
    (livraisons || []).forEach(l => {
      if (l == null || l.coutAchatParLitre == null) return;
      cmp = calculerCmpApresLivraison({ cmpPrecedent: cmp, stockAvantL: l.stockAvantL, quantiteLivreeL: l.quantiteLivreeL, coutAchatParLitre: l.coutAchatParLitre });
      coutRemplacementActuel = l.coutAchatParLitre;
      nombreLivraisonsCoutees++;
    });
    return { suffisant: nombreLivraisonsCoutees > 0, cmp, coutRemplacementActuel, nombreLivraisonsCoutees };
  }

  function libelleCmp(cmpData) {
    if (!cmpData || !cmpData.suffisant) return "Aucun coût d'achat saisi pour l'instant — le coût moyen pondéré n'a pas encore de base de calcul.";
    const n = cmpData.nombreLivraisonsCoutees;
    return `Coût moyen pondéré : ${cmpData.cmp.toFixed(3)} €/L, calculé sur ${n} livraison${n > 1 ? 's' : ''} coûtée${n > 1 ? 's' : ''}. Dernier coût d'achat connu : ${cmpData.coutRemplacementActuel.toFixed(3)} €/L.`;
  }

  // Effet économique du stock hérité (audit §6.2/§6.3) : compare le CMP
  // (coût moyen réellement porté par le stock actuellement en cuve) au
  // dernier coût d'achat connu (proxy de "coût de remplacement", faute de
  // flux de prix marché temps réel) et au prix de vente en cours — jamais
  // une "perte", toujours une "pression potentielle sur marge" (sens
  // défavorable) ou un "avantage temporaire" (sens favorable), exactement
  // la formulation demandée par l'audit §6.2. `stockPhysiqueActuelL` vient
  // de la jauge déjà affichée dans "Situation aujourd'hui" (Article 11 —
  // jamais une deuxième mesure de stock physique inventée pour ce bloc).
  function calculerEffetPrixStockHerite({ cmp, coutRemplacementActuel, prixVenteDuMois, stockPhysiqueActuelL }) {
    if (cmp == null || coutRemplacementActuel == null || stockPhysiqueActuelL == null) {
      return { suffisant: false };
    }
    const margeReelleStockHerite = prixVenteDuMois != null ? prixVenteDuMois - cmp : null;
    const margeReference = prixVenteDuMois != null ? prixVenteDuMois - coutRemplacementActuel : null;
    const effetParLitre = coutRemplacementActuel - cmp;
    const effetTotal = effetParLitre * stockPhysiqueActuelL;
    const sens = effetTotal > 0 ? 'favorable' : (effetTotal < 0 ? 'defavorable' : 'neutre');
    return { suffisant: true, margeReelleStockHerite, margeReference, effetParLitre, effetTotal, sens };
  }

  function libelleEffetPrixStockHerite(effet) {
    if (!effet || !effet.suffisant) return "Aucun coût d'achat saisi pour l'instant — impossible de valoriser l'effet du stock sur la marge.";
    const montantTxt = `${Math.abs(Math.round(effet.effetTotal)).toLocaleString('fr-FR')} €`;
    if (effet.sens === 'favorable') return `Avantage économique temporaire estimé : +${montantTxt} — le stock actuellement en cuve a été acheté en moyenne moins cher que le dernier coût d'achat connu.`;
    if (effet.sens === 'defavorable') return `Pression potentielle sur marge estimée : -${montantTxt} — jamais une perte constatée, seulement l'effet du coût moyen du stock actuellement en cuve face au dernier coût d'achat connu.`;
    return "Coût moyen du stock aligné avec le dernier coût d'achat connu — aucun effet prix notable.";
  }

  // Task #480 (18/08/2026, "Brancher Brief/Rapport sur les indicateurs
  // économiques carburant validés") : Brief et le Rapport de Direction
  // n'ont la place que pour UNE ligne "Économie carburant", jamais un détail
  // par carburant comme dans Carburants Pilotage. Réduit un map
  // {cle: effetPrixStockHerite} à UN SEUL carburant à mettre en avant —
  // jamais un total additionné entre carburants (Article 5 : un effet
  // favorable sur un carburant et défavorable sur un autre ne doivent
  // jamais s'annuler silencieusement dans une moyenne ou une somme).
  // Priorité : le carburant le plus défavorable (le risque à signaler
  // d'abord) > le plus favorable > repli sur le premier carburant
  // disponible si tous sont neutres. `null` si aucun carburant n'a assez de
  // données (aucun coût d'achat saisi nulle part).
  function resumerEffetPrixCarburants(effetsParCarburant) {
    const entrees = Object.entries(effetsParCarburant || {}).filter(([, e]) => e && e.suffisant);
    if (!entrees.length) return null;
    const pire = (liste) => liste.reduce((max, cur) => (!max || Math.abs(cur[1].effetTotal) > Math.abs(max[1].effetTotal)) ? cur : max, null);
    const defavorables = entrees.filter(([, e]) => e.sens === 'defavorable');
    const favorables = entrees.filter(([, e]) => e.sens === 'favorable');
    const [cle, effet] = defavorables.length ? pire(defavorables) : (favorables.length ? pire(favorables) : entrees[0]);
    return { cle, effet };
  }

  // Résolution de l'ancre de calcul (dernier relevé réel OU point zéro
  // certifié, le plus récent des deux gagne) pour une date donnée — même
  // logique que l'écran depuis le 14/08/2026 (point zéro = plancher, pas
  // ancre permanente), désormais partagée entre l'initialisation de l'écran
  // et le recalcul en cascade (Sprint C3, 17/08/2026) plutôt que dupliquée
  // (Article 11 : une seule vérité pour "quelle est la référence de ce
  // jour"). Fonction pure — ne fait aucune requête, `dernierReleve`/
  // `pointZero` sont déjà chargés par l'appelant.
  function resoudreAncreCarburant({ dernierReleve, pointZero, date }) {
    const historiqueNonFiable = !!pointZero && date < pointZero.date;
    const ancreEstPointZero = !!pointZero && !historiqueNonFiable && (!dernierReleve || pointZero.date >= dernierReleve.date);
    const dateAncre = historiqueNonFiable ? null : (ancreEstPointZero ? pointZero.date : (dernierReleve ? dernierReleve.date : null));
    const referenceCertifieeCeJour = ancreEstPointZero && dateAncre === date;
    return { historiqueNonFiable, ancreEstPointZero, dateAncre, referenceCertifieeCeJour };
  }

  // Sprint C5 "Robustesse" (17/08/2026, audit §8/§12) : "Le moteur de
  // reconstruction doit pouvoir être relancé sans produire de doublons"
  // (scénario de test C16 de l'audit, "Recalcul relancé deux fois ->
  // Résultat identique, aucun doublon"). Compare un contrôle déjà écrit à
  // ce qui serait écrit maintenant pour la même clé (site,date,carburant) —
  // si rien n'a changé (même discipline que diffReleveCarburant, C1/C09),
  // l'écran (enregistrerControleDate) doit sauter l'insertion plutôt que de
  // poser une nouvelle version identique en boucle à chaque relance. Un
  // epsilon minime absorbe un éventuel bruit de flottant sans jamais
  // masquer un vrai changement de valeur.
  const EPSILON_CONTROLE = 1e-6;
  function nombresEgaux(a, b) {
    if (a == null || b == null) return a == null && b == null;
    return Math.abs(Number(a) - Number(b)) < EPSILON_CONTROLE;
  }
  function controleInchange(dernierControle, nouveau) {
    if (!dernierControle) return false; // rien d'existant -> jamais "inchangé", il faut poser la première version.
    return dernierControle.reference_date === nouveau.reference_date
      && dernierControle.reference_type === nouveau.reference_type
      && nombresEgaux(dernierControle.theorique, nouveau.theorique)
      && nombresEgaux(dernierControle.physique, nouveau.physique)
      && nombresEgaux(dernierControle.ecart, nouveau.ecart)
      && nombresEgaux(dernierControle.ventes, nouveau.ventes)
      && nombresEgaux(dernierControle.livraison, nouveau.livraison)
      && nombresEgaux(dernierControle.mouvement, nouveau.mouvement)
      && dernierControle.qualite === nouveau.qualite
      && dernierControle.cause === nouveau.cause;
  }

  // ============================================================
  // TARIFS D'ACHAT (cahier "Vocabulaire & intégration du prix d'achat",
  // 17/08/2026, §4/§5/§6). Le manager saisit un tarif d'achat de
  // référence par carburant et période tarifaire (carburant_tarifs_achat).
  // La résolution "quel tarif s'applique à telle date" est faite deux
  // fois par construction, jamais par accident : côté serveur (trigger
  // carburant_resoudre_prix_achat_snapshot, à la création d'une ligne de
  // réception — c'est la valeur qui compte, figée pour toujours) et ici,
  // côté client, UNIQUEMENT pour l'affichage (l'écran "Tarifs actifs" doit
  // savoir lequel des tarifs déjà saisis est actif aujourd'hui SANS
  // attendre une nouvelle réception). Même règle des deux côtés : le plus
  // récent date_effet <= date cible (Article 11 — une seule règle, deux
  // implémentations nécessaires seulement parce que l'une tourne en SQL
  // et l'autre en JS, jamais deux règles différentes).
  // ============================================================

  const MOTIFS_OVERRIDE_PRIX_ACHAT = [
    { cle: 'facture_differente', label: 'Facture différente' },
    { cle: 'avoir_rectification', label: 'Avoir / rectification fournisseur' },
    { cle: 'changement_exceptionnel', label: 'Changement exceptionnel' },
    { cle: 'autre', label: 'Autre' },
  ];

  // `tarifs` = lignes carburant_tarifs_achat d'UN SEUL carburant (déjà
  // filtrées par l'appelant), ordre quelconque. Retourne le tarif actif à
  // `dateCibleISO` ou null si aucun tarif n'a de date_effet <= cette date
  // (cas §5.6 du cahier : "Si aucun tarif n'existe").
  function resoudreTarifActifParmi(tarifs, dateCibleISO) {
    let trouve = null;
    (tarifs || []).forEach(t => {
      if (t.date_effet > dateCibleISO) return;
      if (!trouve || t.date_effet > trouve.date_effet) trouve = t;
    });
    return trouve;
  }

  const LIBELLE_SOURCE_TARIF = {
    facture_fournisseur: 'facture fournisseur',
    bareme: 'barème',
    saisie_manager: 'saisie manager',
    autre: 'autre source',
  };

  function libelleTarifActif(tarif) {
    if (!tarif) return "Aucun tarif d'achat actif pour l'instant — l'analyse économique restera non calculable tant qu'un tarif n'est pas saisi.";
    const dateTxt = (tarif.date_effet || '').split('-').reverse().join('/');
    const sourceTxt = LIBELLE_SOURCE_TARIF[tarif.source_type] || tarif.source_type || 'source non précisée';
    return `${tarif.prix_achat_par_litre.toFixed(3)} €/L — effet depuis ${dateTxt} (${sourceTxt})`;
  }

  // Provenance du prix effectivement appliqué à UNE ligne de réception
  // (carburant_reception_visite_lignes) — une seule fonction de mise en
  // phrase pour Économie ET la modale "Relevé de réception" (Article 11) :
  // jamais deux formulations différentes de la même origine.
  function libelleSourcePrixLigne(ligne) {
    if (!ligne || ligne.cout_achat_par_litre == null) return null;
    if (ligne.prix_achat_override) {
      const motif = (MOTIFS_OVERRIDE_PRIX_ACHAT.find(m => m.cle === ligne.prix_achat_override_motif) || {}).label || ligne.prix_achat_override_motif || 'motif non précisé';
      return `Prix spécifique à cette livraison — ${motif}${ligne.cout_saisi_par ? ` (${ligne.cout_saisi_par})` : ''}`;
    }
    if (ligne.prix_achat_source_id) return `Tarif d'achat actif du mois${ligne.cout_saisi_par ? ` (${ligne.cout_saisi_par})` : ''}`;
    // Ligne posée avant l'existence des tarifs d'achat (Sprint C8, saisie
    // manuelle a posteriori) — jamais confondue avec une résolution
    // automatique qui n'a pas eu lieu pour cette ligne.
    return `Saisie manuelle${ligne.cout_saisi_par ? ` (${ligne.cout_saisi_par})` : ''}`;
  }

  // ============================================================
  // FALLBACK TEMPOREL "DERNIER ÉTAT FIABLE" (22/08/2026, demande de
  // Frédéric — voir NEXUS-Data-Dictionary-v2.md v2.214) : capture du
  // 21/08 au soir, "🔴 Carburants — 0/100 · À corriger" alors que le
  // recul venait pour moitié d'un vrai recul de volume et pour l'autre
  // moitié d'une absence de donnée FRAÎCHE (Q2 pas remonté, jaugeage
  // d'ouverture du lendemain pas encore saisi) traitée avec la même
  // pénalité maximale qu'un écart réellement constaté. Principe posé par
  // Frédéric : "distinguer le dernier état complet et fiable de ce qui
  // est en train de se construire aujourd'hui" — ne jamais mélanger
  // silencieusement J-1 et J dans un même score, toujours annoncer
  // explicitement lequel des deux est affiché.
  //
  // Fonctions pures uniquement : la recherche du jour de repli se fait
  // sur un historique DÉJÀ chargé par l'appelant (chargerHistoriqueReleves,
  // Article 11 — jamais une deuxième requête/formule pour "quel jour est
  // fiable"). Le VRAI recalcul du score du jour de repli réutilise
  // chargerCarburantsBrief() à cette date antérieure (voir
  // nexus-brief-donnees.js, chargerCarburantsBriefAvecFallback) — jamais
  // une valeur figée à la main, toujours recalculée avec les mêmes
  // fonctions que pour "aujourd'hui", simplement à une autre date.
  // ============================================================

  // Borne haute (23/08/2026, recalibrée — "NEXUS_Audit_Brief_Cockpit_
  // Anti_Degradation_Verify_FDJ.pdf", section 3.1/13) : remplace la borne
  // initiale de Frédéric ("36 ou 48h", v2.214) par la politique NEXUS
  // formalisée par l'audit — un dernier état fiable reste présentable
  // jusqu'à J-3 inclus (avec fraîcheur explicite à chaque palier), et
  // devient "à actualiser" à partir de J-4 : *"Le dernier etat fiable est
  // conserve au maximum jusqu'a J-3... A partir de J-4, NEXUS affiche 'A
  // actualiser' et ne presente plus l'ancien score comme courant."*
  // Exprimée en JOURS plutôt qu'en heures (l'audit raisonne explicitement
  // en J-1/J-2/J-3/J-4, jamais en heures) — au-delà, un état gelé ne doit
  // plus être présenté comme le reflet de la situation courante (Article
  // 5) : l'écran doit basculer en "à actualiser" plutôt que d'afficher un
  // score de plus en plus périmé comme s'il était frais.
  const SEUIL_FALLBACK_JOURS_PEREMPTION = 3;

  // Un jour est "complet" pour Carburants si son contrôle physique a
  // produit un résultat interprétable (peu importe qu'il soit bon ou
  // mauvais — Sous contrôle/À surveiller/À corriger/Référence certifiée
  // comptent tous comme complets) : seul "Données insuffisantes" — jour
  // sans relevé, ou relevé présent mais écart non calculable — signale
  // une journée encore EN CONSTRUCTION, jamais un vrai résultat mesuré.
  function jourCarburantEstComplet(parCarburant, aucunReleve) {
    if (aucunReleve || !parCarburant) return false;
    return statutGlobalControle(parCarburant) !== 'Données insuffisantes';
  }

  // Cherche le premier jour complet en remontant un historique déjà trié
  // du plus récent au plus ancien (forme exacte de chargerHistoriqueReleves),
  // EXCLUANT toujours aujourd'hui (à l'appelant de ne transmettre que le
  // passé — voir chargerCarburantsBriefAvecFallback, dateFin = J-1).
  // `dateAujourdhui` ne sert qu'à calculer joursEcoules, jamais à filtrer
  // l'historique lui-même (déjà borné par l'appelant).
  //
  // `datesExclues` (27/08/2026, correctif P0 bis, retour de Frédéric
  // "toujours anomalie" après le correctif crash v2.247) : cette fonction
  // ne juge la complétude d'un jour QUE via chargerHistoriqueReleves — un
  // calcul approximatif par bornes de date civile, qui ignore `mesure_le`.
  // Un relevé de réception sans instant capturé (v2.247) peut donc être
  // jugé "complet" ICI alors que le calcul réel horodaté
  // (chargerControleJour, rejoué par l'appelant) le juge "Données
  // insuffisantes". `datesExclues` permet à l'appelant d'écarter un
  // candidat déjà invalidé par ce rejeu réel et de redemander le suivant,
  // sans dupliquer la logique de recherche (Article 11).
  function trouverJourFiableAnterieur(historiquePasse, dateAujourdhui, datesExclues) {
    const exclues = new Set(datesExclues || []);
    const trouve = (historiquePasse || []).find(j => jourCarburantEstComplet(j.parCarburant, false) && !exclues.has(j.date));
    if (!trouve) return { trouve: false };
    const joursEcoules = Math.round((new Date(`${dateAujourdhui}T00:00:00`) - new Date(`${trouve.date}T00:00:00`)) / 86400000);
    return { trouve: true, date: trouve.date, joursEcoules };
  }

  // Décide le mode de fraîcheur à afficher pour Carburants aujourd'hui —
  // 'jour' (aujourd'hui est complet, rien à faire), 'fallback' (un jour
  // antérieur fiable existe et n'est pas encore périmé, le score de CE
  // jour doit être figé et affiché à sa place), 'perime' (le seul jour
  // fiable trouvé dépasse le seuil de péremption — le score ne doit plus
  // être présenté comme courant) ou 'jour_incomplet_sans_repli' (aucun
  // jour fiable trouvé du tout dans la fenêtre balayée — reste honnête sur
  // le calcul du jour tel quel plutôt que d'inventer un repli qui n'existe
  // pas, Article 5).
  function fraicheurCarburant({ completAujourdhui, fallback }) {
    if (completAujourdhui) return { mode: 'jour' };
    if (!fallback || !fallback.trouve) return { mode: 'jour_incomplet_sans_repli' };
    if (fallback.joursEcoules > SEUIL_FALLBACK_JOURS_PEREMPTION) {
      return { mode: 'perime', dateReference: fallback.date, joursEcoules: fallback.joursEcoules };
    }
    return { mode: 'fallback', dateReference: fallback.date, joursEcoules: fallback.joursEcoules };
  }

  // Badge affiché à côté du secteur — jamais le même libellé que le mode
  // 'jour' normal (aucun badge nécessaire dans ce cas, l'écran n'affiche
  // rien de spécial). Vocabulaire aligné (23/08/2026) sur le tableau 3.1 de
  // l'audit : "Mis à jour hier" (J-1), "Mis à jour il y a N j" (J-2/J-3) —
  // remplace l'ancien libellé unique "Dernier état fiable J-1" qui ne
  // distinguait pas les paliers J-2/J-3 introduits par la recalibration
  // ci-dessus.
  function libelleBadgeFraicheur(fraicheur) {
    if (!fraicheur || fraicheur.mode === 'jour') return null;
    const dateTxt = (fraicheur.dateReference || '').split('-').reverse().join('/');
    if (fraicheur.mode === 'fallback') {
      if (fraicheur.joursEcoules === 1) return 'Mis à jour hier';
      if (fraicheur.joursEcoules <= SEUIL_FALLBACK_JOURS_PEREMPTION) return `Mis à jour il y a ${fraicheur.joursEcoules} j`;
      // Filet de sécurité seulement : avec le seuil ci-dessus, le mode
      // 'fallback' n'est plus jamais atteint au-delà de J-3 (bascule en
      // 'perime') — ne devrait jamais s'exécuter, gardé par honnêteté
      // plutôt que de supposer que joursEcoules restera toujours borné.
      return `Dernier état fiable — données complètes arrêtées au ${dateTxt}`;
    }
    if (fraicheur.mode === 'perime') {
      return `À actualiser — dernier état fiable trop ancien (${dateTxt})`;
    }
    return "Aujourd'hui incomplet — aucun état antérieur fiable disponible";
  }

  // Bloc "Aujourd'hui — en cours" : ce qui est déjà connu de la journée en
  // construction, à afficher SÉPARÉMENT du score figé — jamais fondu dedans
  // (règle absolue de Frédéric : "ne jamais mélanger silencieusement J-1 et
  // J dans un même score"). Phrasé au grain réellement disponible
  // (nbQuartsAvecLitrage/nbQuartsTotal, déjà remonté par
  // chargerVentesPeriode) plutôt que de nommer des quarts précis que NEXUS
  // ne peut pas identifier un par un ici (Article 5 — jamais une fausse
  // précision).
  function construireBlocEnCours({ nbQuartsAvecLitrage, nbQuartsTotal, releveDuJourExiste }) {
    const lignes = [];
    if (nbQuartsTotal) {
      lignes.push(`Ventes du jour : ${nbQuartsAvecLitrage || 0}/${nbQuartsTotal} quart${nbQuartsTotal > 1 ? 's' : ''} avec litrage renseigné.`);
    } else {
      lignes.push("Aucun quart clôturé pour l'instant aujourd'hui.");
    }
    lignes.push(releveDuJourExiste ? 'Jaugeage du jour déjà saisi.' : 'Jaugeage du jour en attente.');
    lignes.push('Aucun nouvel écart physique calculé pour l\'instant.');
    return lignes;
  }

  // Signal critique confirmé (23/08/2026, audit "Anti-dégradation
  // temporelle", section 3.2/règle de précédence #5) : *"La conservation
  // J-1 à J-3 n'est permise que si aucun signal nouveau contradictoire ou
  // critique n'est apparu depuis le dernier état fiable. [...] un écart
  // carburant physiquement mesuré doit remplacer immédiatement le
  // fallback, même si le cycle global du jour n'est pas encore complet."*
  //
  // Distinct de `jourCarburantEstComplet` : une journée peut être
  // INCOMPLÈTE (litrage du jour pas fini, jaugeage de clôture pas fait) et
  // pourtant déjà porter un écart RÉEL et CONFIRMÉ sur un relevé déjà
  // saisi — un manque de fraîcheur n'est jamais la même chose qu'une
  // anomalie prouvée. Réutilise `statutGlobalControle` (Article 11, aucun
  // 2ᵉ calcul) : "À corriger" signifie déjà, par la définition existante de
  // cette fonction, un écart mesuré au-delà du seuil de tolérance — c'est
  // très exactement la définition d'un "signal critique confirmé" pour
  // Carburants, jamais une 2ᵉ notion inventée pour ce lot.
  function signalCritiqueCarburantAujourdhui({ aucunReleve, parCarburant } = {}) {
    if (aucunReleve || !parCarburant) return false;
    return statutGlobalControle(parCarburant) === 'À corriger';
  }

  // ------------------------------------------------------------
  // Traçabilité minimale du fallback (23/08/2026, audit "Anti-dégradation
  // temporelle" §9.2/§10) : l'audit demande de journaliser fallback_used,
  // fallback_source_version, fallback_age_days et replaced_at à chaque
  // calcul de fraîcheur, pour que la décision reste explicable et
  // reconstructible a posteriori — aujourd'hui cette information n'existe
  // qu'en mémoire le temps du calcul (limite documentée dans
  // NEXUS-Data-Dictionary-v2.md depuis v2.219/v2.220).
  //
  // Cette fonction ne fait AUCUN accès Supabase (Article 11 — un moteur
  // reste pur) : elle traduit seulement un objet `fraicheur` déjà calculé
  // par `fraicheurCarburant` (réutilisée telle quelle par FDJ, voir plus
  // haut) en la forme minimale à journaliser. Le "quoi en faire" (upsert,
  // historique des transitions, pose de `replaced_at`) appartient à la
  // couche données (`nexus-brief-donnees.js`, fonction
  // `enregistrerFraicheurSecteur`), jamais ici.
  function resoudreEntreeJournalFraicheur({ fraicheur, signalCritique } = {}) {
    const f = fraicheur || { mode: 'jour' };
    return {
      fallbackUsed: f.mode === 'fallback' || f.mode === 'perime',
      fallbackMode: f.mode,
      fallbackSourceVersion: f.dateReference || null,
      fallbackAgeDays: (typeof f.joursEcoules === 'number') ? f.joursEcoules : null,
      signalCritique: !!signalCritique,
    };
  }

  global.NexusCarburantMoteur = {
    SEUIL_ECART_PCT_SURVEILLER, SEUIL_ECART_PCT_CORRIGER, CLES_CARBURANT, NOM_CARBURANT_COURT,
    stockReelGoTotal, sommerVentesPeriode,
    calculerTheorique, calculerEcart, calculerEcartRatio, statutCarburant,
    calculerCarburant,
    referencePhysiqueDuJour, stockPhysiquePostLivraison,
    calculerMixCarburant, calculerEvolutionVolume, identifierProduitMoteur,
    decomposerEvolution, identifierMoteurEvolution,
    statutGlobalControle, texteControleJour,
    controleInchange,
    SEUIL_AUTONOMIE_ALERTE_JOURS, SEUIL_AUTONOMIE_VIGILANCE_JOURS, SEUIL_AUTONOMIE_CONFORTABLE_JOURS,
    calculerAutonomieJours, statutAutonomie, pourcentageRemplissage, capaciteTotale,
    motifTheoriqueIndisponible, fiabiliteControle, libelleRapprochementLivraison, phraseDecisionMoteur,
    construireMessagesPilotage,
    prochaineVersionReleveCarburant, diffReleveCarburant, patchReleveDepuisReceptionMesures,
    qualiteChaineCarburant, libelleCauseQualiteChaine, resoudreAncreCarburant,
    instantLocalVersUTC, instantFenetreReleve, fenetreQuartLarge, classerQuartFaceFenetre, resoudreVentesFenetre,
    quartsAEstimerDansFenetre,
    fractionRecouvrementQuart,
    ventilerFenetreAvecEstimation,
    estimationControleCarburant,
    libelleQualiteControle, diagnosticAbsenceControle, diagnostiquerEcartCarburant,
    SEUIL_HISTORIQUE_CHAINE_SUFFISANT, statistiquesFiabiliteChaine, libelleFiabiliteChaine,
    calculerCmpApresLivraison, calculerCmpProgressif, libelleCmp,
    calculerEffetPrixStockHerite, libelleEffetPrixStockHerite, resumerEffetPrixCarburants,
    MOTIFS_OVERRIDE_PRIX_ACHAT, resoudreTarifActifParmi, libelleTarifActif, libelleSourcePrixLigne,
    SEUIL_FALLBACK_JOURS_PEREMPTION, jourCarburantEstComplet, trouverJourFiableAnterieur,
    signalCritiqueCarburantAujourdhui,
    fraicheurCarburant, libelleBadgeFraicheur, construireBlocEnCours,
    resoudreEntreeJournalFraicheur,
  };
})(typeof window !== 'undefined' ? window : globalThis);
