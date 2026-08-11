/*
 * nexus-verify-moteur.js — extraction pure de la classification d'écart de
 * caisse (classifierEcart/GRAVITE_ORDRE/STATUT_LABEL), jusque-là définie
 * uniquement à l'intérieur de NEXUS-Verify-v1.html. Extrait le 11/08/2026
 * pour que le nouveau chapitre "Opérations" du Rapport NEXUS de Direction
 * réutilise EXACTEMENT la même classification (Article 11, "une seule
 * vérité") au lieu d'un deuxième jeu de seuils.
 *
 * Ce fichier ne fait AUCUN accès Supabase.
 */
(function (global) {
  'use strict';

  // Seuils de gravité en euros d'écart absolu — identiques à ceux du cahier
  // des charges (section 11), un seul jeu de seuils pour toute l'app.
  function classifierEcart(montantAbs) {
    if (montantAbs <= 2) return 'conforme';
    if (montantAbs <= 5) return 'surveiller';
    if (montantAbs <= 20) return 'anomalie';
    return 'critique';
  }
  const GRAVITE_ORDRE = { conforme: 0, surveiller: 1, anomalie: 2, critique: 3 };
  const STATUT_LABEL = { conforme: 'Conforme', surveiller: 'À surveiller', anomalie: 'Anomalie', critique: 'Critique' };

  /**
   * agregerAudits(audits) — même calcul que assemblerDonneesRapportVerify()
   * de NEXUS-Verify-v1.html, extrait pour être réutilisable sans accès
   * réseau : reçoit des lignes déjà chargées
   * (date, quart, ecart_piste, ecart_boutique, statut, commentaire).
   * L'ampleur d'un audit est le MAX des deux composantes (piste, boutique),
   * jamais leur somme signée.
   */
  function agregerAudits(rows) {
    const audits = (rows || []).map(a => ({ ...a, ecartMax: Math.max(Math.abs(Number(a.ecart_piste || 0)), Math.abs(Number(a.ecart_boutique || 0))) }));
    const total = audits.length;
    const parStatut = { conforme: 0, surveiller: 0, anomalie: 0, critique: 0 };
    audits.forEach(a => { if (parStatut[a.statut] != null) parStatut[a.statut]++; });
    const tauxConforme = total > 0 ? parStatut.conforme / total : null;
    const ecartCumule = audits.reduce((s, a) => s + a.ecartMax, 0);
    const triesParEcart = [...audits].sort((a, b) => b.ecartMax - a.ecartMax);
    const pireEcart = triesParEcart[0] || null;
    const topEcarts = triesParEcart.slice(0, 5);
    let nbPisteDominant = 0, nbBoutiqueDominant = 0;
    audits.forEach(a => {
      if (Math.abs(a.ecart_piste || 0) > Math.abs(a.ecart_boutique || 0)) nbPisteDominant++;
      else if (Math.abs(a.ecart_boutique || 0) > Math.abs(a.ecart_piste || 0)) nbBoutiqueDominant++;
    });
    const composantePlusTouchee = nbPisteDominant === nbBoutiqueDominant ? 'Équilibré entre piste et boutique' : (nbPisteDominant > nbBoutiqueDominant ? 'Piste' : 'Boutique');
    return { total, parStatut, tauxConforme, ecartCumule, pireEcart, topEcarts, composantePlusTouchee, audits };
  }

  global.NexusVerifyMoteur = { classifierEcart, GRAVITE_ORDRE, STATUT_LABEL, agregerAudits };
})(typeof window !== 'undefined' ? window : globalThis);
