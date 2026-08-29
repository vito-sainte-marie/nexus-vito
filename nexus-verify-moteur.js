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

  /**
   * statutValidationQuart(a) — v2.234, demande de Frédéric ("Amélioration
   * UX — NEXUS Verify / Historique") : statut global discret par quart,
   * synthétisant les validations Piste et Boutique SANS jamais mélanger ce
   * statut avec le résultat individuel d'une caisse (Conforme/À surveiller
   * viennent de classifierEcart, restent inchangés).
   *
   * "Caisses attendues" n'est JAMAIS codé en dur à 2 : c'est le nombre de
   * composantes (piste, boutique) qui ont réellement un écart calculé sur
   * cette ligne (ecart_piste/ecart_boutique non nuls). En pratique le
   * formulaire "Nouvel audit" écrit toujours les deux ensemble, donc c'est 2
   * aujourd'hui — mais le calcul reste correct si une ligne historique n'en
   * a jamais eu qu'une (legacy pré-boutique, saisie corrigée à la main...).
   *
   * Depuis le split de validation (migration
   * split_validation_piste_boutique_audits_caisse), chaque composante a sa
   * propre paire (valide_le_X = dernier évènement, premiere_validation_le_X
   * = tout premier évènement, immuable). Si les deux diffèrent pour au moins
   * une composante validée, la ligne a été corrigée après coup ("Validé
   * puis ajusté") — jamais deviné, seulement lu depuis ces deux colonnes
   * réelles.
   *
   * Retourne { etat, caissesAttendues, caissesValidees, dernierInstant,
   * dernierAuteurId, slots } où etat ∈ 'valide' | 'ajuste' | 'partiel' |
   * 'en_attente'. `slots` porte le détail par composante (type, valideLe,
   * premiereValidationLe, validePar) pour l'écran de détail au clic.
   */
  function statutValidationQuart(a) {
    if (!a) return null;
    const slots = [];
    if (a.ecart_piste != null) {
      slots.push({ type: 'piste', valideLe: a.valide_le_piste || null, premiereValidationLe: a.premiere_validation_le_piste || null, validePar: a.valide_par_piste || null });
    }
    if (a.ecart_boutique != null) {
      slots.push({ type: 'boutique', valideLe: a.valide_le_boutique || null, premiereValidationLe: a.premiere_validation_le_boutique || null, validePar: a.valide_par_boutique || null });
    }
    const caissesAttendues = slots.length;
    const validees = slots.filter(s => !!s.valideLe);
    const caissesValidees = validees.length;
    const aUnAjustement = validees.some(s => s.premiereValidationLe && s.valideLe && new Date(s.premiereValidationLe).getTime() !== new Date(s.valideLe).getTime());

    let dernierEvenement = null;
    validees.forEach(s => {
      if (!dernierEvenement || new Date(s.valideLe) > new Date(dernierEvenement.valideLe)) dernierEvenement = s;
    });

    let etat;
    if (caissesAttendues === 0 || caissesValidees === 0) etat = 'en_attente';
    else if (caissesValidees < caissesAttendues) etat = 'partiel';
    else etat = aUnAjustement ? 'ajuste' : 'valide';

    return {
      etat,
      caissesAttendues,
      caissesValidees,
      dernierInstant: dernierEvenement ? dernierEvenement.valideLe : null,
      dernierAuteurId: dernierEvenement ? dernierEvenement.validePar : null,
      slots,
    };
  }

  // ------------------------------------------------------------
  // "POURQUOI CET ÉCART ?" — v2.268, cadrage "Analyse des écarts" de
  // Frédéric : même structure que FDJ (nexus-fdj-moteur.js, v2.267 —
  // NexusEcartsMoteur.situationVerificationEcart en est la version
  // canonique désormais), mais un vocabulaire de causes propre à Verify
  // (piste/boutique), jamais les libellés FDJ ("rapport FDJ" n'a aucun
  // sens ici). "Vente ou article non enregistré" reprend l'exemple exact
  // du cadrage (§8) : l'écart positif qui révèle une vente oubliée.
  // ------------------------------------------------------------
  const MOTIFS_ECART_CORRIGE_VERIFY = [
    { value: 'erreur_comptage', label: 'Erreur de comptage' },
    { value: 'erreur_saisie', label: 'Erreur de saisie' },
    { value: 'erreur_montant_caisse', label: 'Erreur sur le montant caisse' },
    { value: 'vente_non_enregistree', label: 'Vente ou article non enregistré' },
  ];
  function motifsEcartCorrigeDisponiblesVerify(ecartInitial) {
    const base = [{ value: '', label: 'Choisir un motif…' }, ...MOTIFS_ECART_CORRIGE_VERIFY];
    return global.NexusEcartsMoteur
      ? global.NexusEcartsMoteur.ajouterRemboursementSiManque(base, ecartInitial)
      : (typeof ecartInitial === 'number' && ecartInitial < 0 ? [...base, { value: 'remboursement', label: 'Remboursement' }] : base);
  }
  function labelMotifEcartVerify(v) {
    if (v === 'remboursement') return 'Remboursement';
    if (v === 'non_explique') return 'Origine non identifiée';
    const m = MOTIFS_ECART_CORRIGE_VERIFY.find(x => x.value === v);
    return m ? m.label : (v || '—');
  }

  global.NexusVerifyMoteur = {
    classifierEcart, GRAVITE_ORDRE, STATUT_LABEL, agregerAudits, statutValidationQuart,
    MOTIFS_ECART_CORRIGE_VERIFY, motifsEcartCorrigeDisponiblesVerify, labelMotifEcartVerify,
  };
})(typeof window !== 'undefined' ? window : globalThis);
