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
  };
})(typeof window !== 'undefined' ? window : globalThis);
