// NEXUS Boussole — moteur de calcul partagé (10/08/2026)
//
// Même principe que nexus-fdj-moteur.js / nexus-conseiller.js (Article 11
// de la Constitution NEXUS, "une seule vérité") : les statuts par axe
// (Commerce/Valeur/Équipe/Opérations/Risques) et les scores 0-100 de la
// Boussole NEXUS ne vivent qu'ICI. Avant le 10/08/2026, NEXUS-Brief-v1.html
// contenait sa propre copie de statutCommerce/statutValeur/statutEquipe,
// documentée dans un commentaire comme "reprise à l'identique" des
// fonctions de NEXUS-App-v1.html — mais c'était une promesse humaine, pas
// une garantie du code : les deux fichiers pouvaient diverger silencieusement
// à la prochaine modification. Cette extraction transforme la promesse en
// fait : NEXUS-App-v1.html et NEXUS-Brief-v1.html consomment maintenant les
// mêmes fonctions, jamais deux calculs séparés du même statut.
//
// Portée : Commerce/Valeur/Équipe sont communs aux deux écrans. Opérations
// et Risques sont nés sur Brief NEXUS (5e et 6e axes de la Boussole) et
// n'ont pas encore d'équivalent sur APP — exportés ici pour que APP puisse
// s'en servir dès que sa propre carte "Votre entreprise aujourd'hui" en
// aura besoin (voir NEXUS-App-Porte-NEXUS-v1.md, décision 3).
//
// SEUIL_ECART_OPERATIONS_EUR est aussi utilisé par
// calculerStatutOperations() dans NEXUS-Brief-v1.html (statut textuel du
// domaine Opérations, distinct du score 0-100 de la Boussole) : cette
// fonction reste dans Brief NEXUS mais lit désormais le seuil exporté ici
// plutôt qu'une copie locale.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-boussole-moteur.js?v=20260903-1247"></script>
// ------------------------------------------------------------

(function (global) {
  const SEUIL_ECART_OPERATIONS_EUR = 15;
  const SEUIL_MIN_POINTAGES_EQUIPE = 5;

  // ------------------------------------------------------------
  // Statuts textuels par axe.
  // ------------------------------------------------------------
  function statutCommerce(facteurs) {
    if (!facteurs || facteurs.evolutionReelle == null) return 'Données insuffisantes';
    if (facteurs.evolutionReelle >= 0.05) return 'En progression';
    if (facteurs.evolutionReelle <= -0.05) return 'En repli';
    return 'Stable';
  }
  function statutValeur(facteurs, margePlusResultat) {
    if (!facteurs || facteurs.margeReelle == null) return 'Données insuffisantes';
    if (margePlusResultat && margePlusResultat.nbEcarts > 0) return 'À surveiller';
    return 'Sous contrôle';
  }
  function statutEquipe(equipeScore, totalPointages) {
    if (equipeScore == null || totalPointages == null || totalPointages < SEUIL_MIN_POINTAGES_EQUIPE) return 'Données insuffisantes';
    if (equipeScore >= 90) return 'Sous contrôle';
    if (equipeScore >= 70) return 'À surveiller';
    return 'À corriger';
  }
  function statutRisques(score) {
    if (score == null) return 'Données insuffisantes';
    if (score >= 70) return 'Sous contrôle';
    if (score >= 40) return 'À surveiller';
    return 'À corriger';
  }

  // Scores numériques 0-100 pour la Boussole — pondération PROVISOIRE, non
  // recalibrée (même esprit que la pondération de nexus-indice.js, elle
  // aussi documentée comme provisoire). Chaque entrée est une donnée réelle
  // déjà calculée ailleurs dans NEXUS ; seule la façon de les combiner en
  // une position sur 100 est un premier jet à ajuster avec l'usage réel.
  function scoreDepuisEvolution(evol) {
    if (evol == null) return null;
    return Math.max(0, Math.min(100, Math.round(50 + evol * 250)));
  }
  function scoreDepuisMarge(margeReelle) {
    if (margeReelle == null) return null;
    return Math.max(0, Math.min(100, Math.round(50 + (margeReelle - 0.25) * 100)));
  }
  function scoreOperations(detailOperations, totalJours) {
    if (!totalJours || detailOperations == null) return null;
    return Math.max(0, Math.min(100, Math.round(100 - (detailOperations / SEUIL_ECART_OPERATIONS_EUR) * 50)));
  }
  function scoreRisques({ nbCritiquesCaisse, alertesInventaireOuvertes, risqueStockTotal, pertesR2Total }) {
    if (nbCritiquesCaisse == null && alertesInventaireOuvertes == null && risqueStockTotal == null && pertesR2Total == null) return null;
    let penalite = 0;
    penalite += Math.min(40, (nbCritiquesCaisse || 0) * 15);
    penalite += Math.min(20, (alertesInventaireOuvertes || 0) * 4);
    penalite += (risqueStockTotal || 0) > 0 ? 20 : 0;
    penalite += (pertesR2Total || 0) > 0 ? 20 : 0;
    return Math.max(0, Math.min(100, Math.round(100 - penalite)));
  }

  // ------------------------------------------------------------
  // Reformulation Performance/Maîtrise (13/08/2026, retour d'usage direct de
  // Frédéric sur une capture d'écran réelle de Brief NEXUS — voir aussi
  // v2.55, correctif immédiatement précédent). Constat de Frédéric : au lieu
  // d'AJOUTER un texte explicatif chaque fois que `statut` et `valeur`
  // semblaient se contredire (v2.55, champ `coherence`), il vaut mieux
  // changer la formule pour que la contradiction devienne structurellement
  // impossible. *"Je ne chercherais plus à l'expliquer. Je modifierais
  // légèrement la formule."*
  //
  // Trois situations, jamais confondues (règle fondamentale énoncée par
  // Frédéric) :
  //   1. La donnée n'existe pas / n'est pas accessible -> ne pas pénaliser
  //      (contribution neutre, 0).
  //   2. Le contrôle devait être réalisé mais ne l'est pas encore -> légère
  //      pénalité de MAÎTRISE (l'entreprise n'a pas encore vérifié, ce n'est
  //      pas la même chose que "je n'ai aucune information").
  //   3. Le contrôle est réalisé et révèle une anomalie -> pénalité de
  //      MAÎTRISE selon la matérialité/récurrence de l'anomalie.
  //
  // Chaque secteur du contrat commun (nexus-secteurs-moteur.js) se décompose
  // désormais en deux contributions bornées à budget égal :
  //   Performance : comment le secteur se comporte (évolution litres/CA,
  //   marge, fiabilité) — de -25 à +25.
  //   Maîtrise : l'entreprise contrôle-t-elle correctement ce secteur
  //   aujourd'hui (jaugeage fait, caisse vérifiée, écarts expliqués) —
  //   de -25 à +25.
  // Score secteur = 50 + Performance + Maîtrise, toujours dans [0,100].
  // Un secteur sans dimension Maîtrise modélisée (Commerce aujourd'hui) ou
  // sans dimension Performance distincte (Opérations, Équipe — déjà
  // fondamentalement des mesures de maîtrise) passe `null` pour la
  // contribution non pertinente : `null` est traité comme 0 (neutre),
  // jamais comme une pénalité — c'est la différence entre "non modélisé"
  // et "insuffisant", les deux ne doivent jamais peser pareil qu'une vraie
  // anomalie mesurée.
  const BUDGET_DIMENSION = 25;
  const BUDGET_DIMENSION_UNIQUE = 50;
  function clampContribution(x) {
    if (x == null) return null;
    return Math.max(-BUDGET_DIMENSION, Math.min(BUDGET_DIMENSION, Math.round(x)));
  }
  // Pour un secteur à UNE SEULE dimension modélisée (Commerce n'a que la
  // Performance ; Opérations/Équipe n'ont que la Maîtrise), la clamper à
  // ±25 comprimerait sa sensibilité de moitié sans raison : rien ne se
  // partage le budget avec une dimension neutre. Ces secteurs gardent donc
  // le budget PLEIN (±50, la totalité de l'écart possible à 50) pour leur
  // unique dimension — Commerce le fait déjà nativement via
  // `scoreDepuisEvolution` (jamais touché par cette reformulation) ;
  // Opérations/Équipe l'utilisent explicitement ici.
  function clampContributionPleine(x) {
    if (x == null) return null;
    return Math.max(-BUDGET_DIMENSION_UNIQUE, Math.min(BUDGET_DIMENSION_UNIQUE, Math.round(x)));
  }
  // Score d'affichage d'UNE dimension seule (0-100, 50 = neutre) — jamais
  // utilisé pour l'Indice Boussole lui-même (qui lit toujours `valeur`, la
  // combinaison des deux), uniquement pour le détail "Activité X/100 ·
  // Maîtrise Y/100" de la carte secteur, sur le modèle donné par Frédéric.
  function scoreDimension(contribution) {
    if (contribution == null) return null;
    return Math.max(0, Math.min(100, 50 + contribution));
  }
  function assemblerScoreSecteur(contributionPerformance, contributionMaitrise) {
    return Math.max(0, Math.min(100, Math.round(50 + (contributionPerformance || 0) + (contributionMaitrise || 0))));
  }
  // Statut générique dérivé du score COMBINÉ (10-13/08/2026) — conservé
  // pour compatibilité mais N'EST PLUS APPELÉ par nexus-secteurs-moteur.js
  // depuis le 22/08/2026 (voir statutMetier() ci-dessous). Historique : ce
  // correctif avait résolu la contradiction "Marge +8 mais à surveiller" en
  // dérivant `statut` du même score que `valeur` — mais Frédéric fait
  // remonter un défaut structurel différent : un score et un statut qui
  // dérivent tous deux du MÊME nombre ne peuvent plus se contredire, mais
  // ils ne disent plus non plus deux choses différentes. Score = niveau de
  // performance/maîtrise. Statut = nature de l'action attendue du manager
  // ("À corriger" ≠ "le score est bas", "À corriger" = "un problème de
  // maîtrise est confirmé"). Les deux dimensions redeviennent
  // indépendantes, comme demandé : *"le score et le statut métier doivent
  // devenir deux dimensions distinctes."*
  function statutDepuisScore(score) {
    if (score == null) return 'Données insuffisantes';
    if (score >= 70) return 'Sous contrôle';
    if (score >= 40) return 'À surveiller';
    return 'À corriger';
  }
  // Contribution Maîtrise dérivée d'un nombre d'écarts actifs déjà compté
  // ailleurs (Marge+ `nbEcarts`, écarts de caisse FDJ) — une seule échelle
  // partagée par les deux secteurs (Article 11), jamais deux barèmes qui
  // pourraient diverger. `nbEcarts` null/undefined -> contribution null
  // (neutre : la comparaison elle-même n'a pas pu tourner, situation 1, pas
  // situation 2/3).
  function contributionMaitriseEcarts(nbEcarts) {
    if (nbEcarts == null) return null;
    if (nbEcarts === 0) return 10;
    if (nbEcarts <= 2) return -5;
    if (nbEcarts <= 5) return -15;
    return -25;
  }

  // ------------------------------------------------------------
  // Statut MÉTIER (22/08/2026, demande de Frédéric : "le score et le statut
  // métier doivent devenir deux dimensions distinctes. Le score mesure le
  // niveau de performance/maîtrise. Le statut indique au manager la nature
  // de l'action : À confirmer, À relancer, À corriger, Sous contrôle, En
  // progression.")
  //
  // Le score (`valeur`, cf. assemblerScoreSecteur ci-dessus) continue de
  // mesurer un NIVEAU continu (0-100). Le statut mesure maintenant une
  // NATURE d'action, dérivée séparément de chacune des deux contributions
  // (Performance/Maîtrise) plutôt que du score combiné qui les mélange déjà
  // — exactement la distinction qui manquait : deux secteurs au même score
  // (ex. 45/100) peuvent avoir des causes totalement différentes (Maîtrise
  // dégradée vs Performance en repli) et appeler des actions différentes.
  //
  // maitriseBucket/performanceBucket sont VOLONTAIREMENT proportionnels au
  // budget de la dimension (±25 pour un secteur double dimension, ±50 pour
  // un secteur à dimension unique) plutôt que des seuils absolus dupliqués
  // par secteur (Article 11) : les coupures ci-dessous reproduisent
  // EXACTEMENT les paliers déjà établis par contributionMaitriseEcarts()
  // sur le budget ±25 (0 écart => +10 "bonne" ; 1-2 écarts => -5 "mitigée" ;
  // ≥3 écarts => -15/-25 "mauvaise", le palier -15 étant très exactement
  // -0.6×25) — vérifié et rejoué dans les tests. Appliquer la MÊME fraction
  // (60 %) au budget ±50 des secteurs à dimension unique (Opérations,
  // Équipe) donne un seuil "mauvaise" à -30, cohérent sans inventer un 2e
  // barème.
  //
  // Seuils PROVISOIRES (même discipline que tout le reste de ce fichier —
  // "pondération provisoire, non recalibrée") : à ajuster avec l'usage réel.
  const FRACTION_MAITRISE_MAUVAISE = 0.6;
  const FRACTION_PERFORMANCE_MARQUEE = 0.4;

  function maitriseBucket(contribution, budget) {
    if (contribution == null) return 'inconnue';
    if (contribution >= 0) return 'bonne';
    if (contribution <= -FRACTION_MAITRISE_MAUVAISE * budget) return 'mauvaise';
    return 'mitigee';
  }
  function performanceBucket(contribution, budget) {
    if (contribution == null) return 'inconnue';
    if (contribution >= FRACTION_PERFORMANCE_MARQUEE * budget) return 'positive';
    if (contribution <= -FRACTION_PERFORMANCE_MARQUEE * budget) return 'negative';
    return 'neutre';
  }

  // Règle de priorité ("le pire l'emporte", même philosophie que
  // statutGlobalControle/ORDRE_GRAVITE_CONTROLE dans nexus-carburant-moteur.js) :
  //  1. Maîtrise confirmée mauvaise -> "À corriger", quelle que soit la
  //     Performance. Répond littéralement à la demande de Frédéric :
  //     *"'À corriger' doit être réservé à un problème de maîtrise
  //     confirmé."* Une Performance excellente ne rachète jamais un vrai
  //     problème de contrôle.
  //  2. Maîtrise mitigée (écart(s) mineur(s), pas encore confirmé(s)) ->
  //     "À confirmer" — un état intermédiaire qui n'existait pas avant ce
  //     lot, entre "rien à signaler" et "problème avéré".
  //  3. Maîtrise bonne ou non modélisée (jamais traitée comme un problème,
  //     seulement comme neutre) : la Performance décide.
  //     - Performance négative -> "À relancer" (baisse d'activité, pas un
  //       défaut de contrôle). Cas exact donné par Frédéric : *"FDJ ne doit
  //       pas être automatiquement 'à corriger' uniquement parce que le CA
  //       recule : une baisse d'activité relève plutôt de 'à relancer'."*
  //     - Performance positive -> "En progression".
  //     - Performance neutre/non modélisée -> "Sous contrôle".
  function statutMetier({ perfBucket, maitriseBucket: mBucket }) {
    if (mBucket === 'inconnue' && (perfBucket == null || perfBucket === 'inconnue')) return 'Données insuffisantes';
    if (mBucket === 'mauvaise') return 'À corriger';
    if (mBucket === 'mitigee') return 'À confirmer';
    if (perfBucket === 'negative') return 'À relancer';
    if (perfBucket === 'positive') return 'En progression';
    return 'Sous contrôle';
  }

  // couleurAxe (22/08/2026, refonte statut métier) : lisait auparavant
  // `valeur` (le score numérique, seuils 70/40) — désormais lit `statut`
  // (la nature de l'action, déjà qualifiée par statutMetier() ci-dessus).
  // Demande explicite de Frédéric : *"Le radar doit utiliser ces statuts
  // métier et non simplement la couleur issue du score."* La palette reste
  // la même sémantique (vert = rien à faire, ambre = signal à traiter sans
  // urgence, rouge = correction confirmée, gris = pas de lecture fiable)
  // mais s'appuie maintenant sur le vocabulaire métier plutôt qu'un simple
  // seuil numérique — deux secteurs au même score peuvent afficher des
  // couleurs différentes si leur nature de problème diffère, ce qui est
  // exactement le but de cette refonte.
  const COULEUR_STATUT_METIER = {
    'En progression': { hex: '#34D399', nom: 'En progression' },
    'Sous contrôle': { hex: '#34D399', nom: 'Sous contrôle' },
    'Référence certifiée': { hex: '#34D399', nom: 'Référence certifiée' },
    'À confirmer': { hex: '#F5A623', nom: 'À confirmer' },
    'À relancer': { hex: '#F5A623', nom: 'À relancer' },
    'À corriger': { hex: '#F0575A', nom: 'À corriger' },
    'À actualiser': { hex: '#57626F', nom: 'À actualiser' },
    'Données insuffisantes': { hex: '#57626F', nom: 'Donnée insuffisante' },
  };
  function couleurAxe(statut) {
    return COULEUR_STATUT_METIER[statut] || { hex: '#57626F', nom: statut || 'Donnée insuffisante' };
  }

  // Radar SVG 5 axes — coordonnées polaires adaptées de genererRadarSVG()
  // dans NEXUS-Radar-Manager-v1.html (même principe : grille + polygone +
  // points colorés par statut), réduit à 5 axes pour la Boussole NEXUS.
  function genererBoussoleSVG(axes) {
    const cx = 140, cy = 140, rMax = 95, n = axes.length;
    const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const point = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
    let defs = `<defs><radialGradient id="glowBrief" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.30"/><stop offset="100%" stop-color="#D4AF37" stop-opacity="0.04"/>
    </radialGradient></defs>`;
    let grid = '';
    [0.33, 0.66, 1].forEach(f => {
      const pts = axes.map((_, i) => point(i, rMax * f).join(',')).join(' ');
      grid += `<polygon points="${pts}" fill="none" stroke="#242E38" stroke-width="1"/>`;
    });
    axes.forEach((_, i) => { const [x, y] = point(i, rMax); grid += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#242E38" stroke-width="1"/>`; });
    const mesures = axes.map((a, i) => a.valeur != null ? point(i, rMax * Math.max(a.valeur, 8) / 100) : null);
    let dataShape = '';
    const ptsValides = mesures.filter(p => p !== null);
    if (ptsValides.length >= 3) dataShape = `<polygon points="${ptsValides.map(p => p.join(',')).join(' ')}" fill="url(#glowBrief)" stroke="#D4AF37" stroke-width="2.5" stroke-linejoin="round"/>`;
    let dots = '';
    axes.forEach((a, i) => {
      // Couleur pilotée par le statut MÉTIER (a.statut), pas par le score
      // (a.valeur) — voir couleurAxe() ci-dessus, demande de Frédéric.
      // Position sur le radar (le rayon) reste, elle, bien fondée sur le
      // score continu : la couleur dit "quelle action", la position dit
      // "quel niveau" — deux questions différentes, non confondues.
      const c = couleurAxe(a.statut);
      if (a.valeur != null) { const [x, y] = point(i, rMax * Math.max(a.valeur, 8) / 100); dots += `<circle cx="${x}" cy="${y}" r="5.5" fill="${c.hex}" stroke="#0B0F14" stroke-width="2"/>`; }
      else { const [x, y] = point(i, rMax * 0.35); dots += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#57626F" stroke-width="1.5" stroke-dasharray="2,2"/>`; }
    });
    let labels = '';
    axes.forEach((a, i) => {
      const [x, y] = point(i, rMax + 24);
      const c = couleurAxe(a.statut);
      labels += `<circle cx="${x}" cy="${y}" r="14" fill="${a.valeur != null ? c.hex + '22' : '#1A222C'}" stroke="${a.valeur != null ? c.hex : '#242E38'}" stroke-width="1.5"/>`;
      labels += `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="13">${a.icone}</text>`;
    });
    return `<svg viewBox="0 0 280 280">${defs}${grid}${dataShape}${dots}${labels}</svg>`;
  }

  global.NexusBoussoleMoteur = {
    SEUIL_ECART_OPERATIONS_EUR, SEUIL_MIN_POINTAGES_EQUIPE,
    statutCommerce, statutValeur, statutEquipe, statutRisques,
    scoreDepuisEvolution, scoreDepuisMarge, scoreOperations, scoreRisques,
    couleurAxe, genererBoussoleSVG,
    BUDGET_DIMENSION, BUDGET_DIMENSION_UNIQUE, clampContribution, clampContributionPleine,
    scoreDimension, assemblerScoreSecteur, statutDepuisScore, contributionMaitriseEcarts,
    FRACTION_MAITRISE_MAUVAISE, FRACTION_PERFORMANCE_MARQUEE,
    maitriseBucket, performanceBucket, statutMetier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
