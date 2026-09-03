// ============================================================
// NEXUS Indice — moteur unique de calcul de l'Indice NEXUS.
//
// Correctif du 24/07/2026 (audit doublons de données) : l'Indice NEXUS a
// été calculé une première fois dans NEXUS-Cockpit-v2.html (calculerIndiceNexus
// + INDICE_FACTEURS, pondération PROVISOIRE basée sur la marge et
// l'évolution du CA), puis re-câblé à l'identique dans
// NEXUS-Radar-Manager-v1.html pour remplacer le SANTE_SCORE=74 codé en dur
// du domaine "Résultats" — deux copies du même calcul, exactement le
// même risque de divergence que celui déjà corrigé pour les périodes
// (nexus-periodes.js) et la marge (nexus-marge.js). Ce fichier en fait la
// source unique de vérité, utilisée par toutes les pages qui affichent
// l'Indice NEXUS.
//
// Dépend de nexus-periodes.js — l'inclure AVANT ce fichier dans la page :
//   <script src="nexus-periodes.js?v=20260903-1206"></script>
//   <script src="nexus-indice.js?v=20260903-1206"></script>
// ============================================================

(function (global) {
  // Pondération PROVISOIRE, non recalibrée (voir NEXUS-Cockpit-v2.html) :
  //   - margeReelle : point neutre à 25 % de marge (score 50), ±1 point
  //     d'Indice par ±1 point de marge autour de ce point neutre.
  //   - evolutionReelle : pondérée à moitié (±50 points pour ±100 %
  //     d'évolution du CA), car elle n'est pas toujours disponible
  //     (absence de paire de périodes comparables).
  // Retourne null si la marge réelle n'est pas mesurable — jamais un
  // chiffre inventé (Article 5 de la Constitution NEXUS).
  function calculerIndiceNexus(facteurs) {
    if (!facteurs || facteurs.margeReelle == null) return null;
    let score = 50 + (facteurs.margeReelle - 0.25) * 100;
    if (facteurs.evolutionReelle != null) score += facteurs.evolutionReelle * 50;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Calcule les facteurs (margeReelle, evolutionReelle, periodeEnCours) à
  // partir de lignes brutes portant chacune ca/marge/periode_debut/
  // periode_fin (typiquement la table `products`) — même dérivation que
  // celle historiquement utilisée dans construirePlansAction() du
  // Cockpit. Ne fait AUCUNE requête réseau : l'appelant fournit rowsBrut
  // (déjà chargé, filtré par site) pour rester compatible avec le
  // pattern fetchAllRows() propre à chaque écran.
  function calculerFacteurs(rowsBrut) {
    const { periodeAffichage, rowsAffichage, paire, rowsPaireActuelle, rowsPairePrecedente, periodesTriees } =
      global.NexusPeriodes.analyserPeriodes(rowsBrut);
    if (!periodeAffichage) return null;

    const caTotalAffichage = rowsAffichage.reduce((s, r) => s + (r.ca || 0), 0);
    const margeTotaleAffichage = rowsAffichage.reduce((s, r) => s + (r.marge || 0), 0);
    const caPaireActuelleTotal = rowsPaireActuelle.reduce((s, r) => s + (r.ca || 0), 0);
    const caPairePrecedenteTotal = rowsPairePrecedente.reduce((s, r) => s + (r.ca || 0), 0);

    return {
      margeReelle: caTotalAffichage > 0 ? margeTotaleAffichage / caTotalAffichage : null,
      evolutionReelle: (paire && caPairePrecedenteTotal > 0)
        ? (caPaireActuelleTotal - caPairePrecedenteTotal) / caPairePrecedenteTotal : null,
      periodeEnCours: paire
        ? (periodeAffichage.debut !== paire.actuelle.debut || periodeAffichage.fin !== paire.actuelle.fin)
        : periodesTriees.length > 0,
    };
  }

  // Raccourci pratique : calcule directement le score à partir des lignes
  // brutes, sans exposer les facteurs intermédiaires à l'appelant.
  function calculerScore(rowsBrut) {
    const facteurs = calculerFacteurs(rowsBrut);
    return facteurs ? calculerIndiceNexus(facteurs) : null;
  }

  global.NexusIndice = { calculerIndiceNexus, calculerFacteurs, calculerScore };
})(window);
