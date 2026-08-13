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
// Inclure : <script src="nexus-boussole-moteur.js"></script>
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
  // Statut générique dérivé du score COMBINÉ, mêmes seuils que couleurAxe()
  // ci-dessous (70/40, déjà établis) — remplace les statuts propres à
  // chaque secteur (basés sur des règles disparates : nbEcarts pour Marge,
  // aucunReleve pour Carburants...) par une seule vérité (Article 11) :
  // puisque `statut` dérive maintenant TOUJOURS de `valeur`, les deux ne
  // peuvent plus jamais se contredire à l'écran — la contradiction
  // rapportée par Frédéric (Marge "+8" mais "à surveiller") devient
  // structurellement impossible plutôt que simplement expliquée. Réservé
  // aux secteurs à double dimension (Carburants/Marge/FDJ/Opérations/
  // Équipe) ; Commerce garde `statutCommerce` (sa Maîtrise étant neutre,
  // son statut reste par construction aligné avec sa seule Performance).
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

  function couleurAxe(valeur) {
    if (valeur === null) return { hex: '#57626F', nom: 'Donnée insuffisante' };
    if (valeur >= 70) return { hex: '#34D399', nom: 'Sous contrôle' };
    if (valeur >= 40) return { hex: '#F5A623', nom: 'À surveiller' };
    return { hex: '#F0575A', nom: 'Priorité' };
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
      const c = couleurAxe(a.valeur);
      if (a.valeur != null) { const [x, y] = point(i, rMax * Math.max(a.valeur, 8) / 100); dots += `<circle cx="${x}" cy="${y}" r="5.5" fill="${c.hex}" stroke="#0B0F14" stroke-width="2"/>`; }
      else { const [x, y] = point(i, rMax * 0.35); dots += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#57626F" stroke-width="1.5" stroke-dasharray="2,2"/>`; }
    });
    let labels = '';
    axes.forEach((a, i) => {
      const [x, y] = point(i, rMax + 24);
      const c = couleurAxe(a.valeur);
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
