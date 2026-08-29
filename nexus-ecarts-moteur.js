// NEXUS Écarts — moteur de calcul partagé (28/08/2026, v2.268)
//
// Origine : "Audit_NEXUS_Analyse_des_Ecarts_Verify_FDJ_PAYE.pdf" (cadrage
// de Frédéric, 28/08/2026) — outil transversal "Analyse des écarts" pour
// NEXUS Verify, FDJ Opération et le futur NEXUS Paye. Principe directeur du
// cadrage : "NEXUS doit distinguer le constat, l'investigation, la
// régularisation et l'éventuel impact PAYE. Un écart positif ou négatif
// n'est pas, à lui seul, une dette, une faute, ni même un écart réel
// définitif."
//
// Même principe que nexus-fdj-moteur.js / nexus-conseiller.js (Article 11
// de la Constitution NEXUS, "une seule vérité") : la logique de cycle de
// vie d'un écart (constaté -> corrigé à zéro OU restant -> statut) ne vit
// qu'ICI. `situationVerificationEcart`/`motifEcartObligatoire` existaient
// déjà, identiques, dans nexus-fdj-moteur.js (v2.267, avant que ce fichier
// transversal n'existe) — nexus-fdj-moteur.js délègue désormais à cette
// version canonique (voir son commentaire "PROVENANCE v2.268") plutôt que
// de garder sa propre copie, pour qu'il n'existe plus qu'UNE implémentation
// réelle de cette règle, consommée par FDJ, Verify et la nouvelle page
// "Analyse des écarts".
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-ecarts-moteur.js"></script>
// ------------------------------------------------------------

(function (global) {
  // ------------------------------------------------------------
  // SITUATION DE VÉRIFICATION — identique à la règle FDJ v2.267, désormais
  // canonique ici. Trois situations :
  //   - 'aucun_ecart' : rien à expliquer (écart final nul et pas d'écart
  //     initial connu non-nul).
  //   - 'corrige_a_zero' : l'écart initialement constaté a disparu après
  //     vérification (écart final nul, écart initial non nul et connu) —
  //     une vraie cause est exigée.
  //   - 'restant' : l'écart persiste malgré la vérification (écart final
  //     non nul, quel que soit l'état de l'écart initial) — NEXUS ne force
  //     jamais une fausse explication, motif automatique "Origine non
  //     identifiée".
  // ------------------------------------------------------------
  function situationVerificationEcart(ecartFinal, ecartInitial) {
    if (ecartFinal === null || ecartFinal === undefined) return 'aucun_ecart';
    if (ecartFinal === 0) {
      if (ecartInitial === null || ecartInitial === undefined || ecartInitial === 0) return 'aucun_ecart';
      return 'corrige_a_zero';
    }
    return 'restant';
  }

  // Motif obligatoire dès qu'il y a quelque chose à documenter (vraie cause
  // choisie, ou auto-motif "Origine non identifiée" posé par l'écran) —
  // jamais quand il n'y a rien à expliquer.
  function motifEcartObligatoire(ecartFinal, ecartInitial) {
    return situationVerificationEcart(ecartFinal, ecartInitial) !== 'aucun_ecart';
  }

  // Ajoute "Remboursement" à une liste de causes de base UNIQUEMENT si
  // l'écart initial était un MANQUE (négatif) — jamais pour un excédent.
  // Utilisé par chaque module (FDJ, Verify...) sur SA propre liste de
  // causes de base, qui reste spécifique au module (le vocabulaire des
  // causes n'est pas transversal, seule cette règle de construction l'est).
  function ajouterRemboursementSiManque(causesBase, ecartInitial, labelRemboursement) {
    const liste = (causesBase || []).slice();
    if (typeof ecartInitial === 'number' && ecartInitial < 0) {
      liste.push({ value: 'remboursement', label: labelRemboursement || 'Remboursement' });
    }
    return liste;
  }

  // Libellé + classe de style pour un écart RESTANT (jamais un choix
  // manuel, toujours ce même libellé factuel — "vocabulaire à éviter" du
  // cadrage : jamais "faute", "dette", "anomalie employé", "manque
  // salarié").
  function libelleEcartRestant(ecartFinal) {
    if (ecartFinal === null || ecartFinal === undefined) return null;
    return ecartFinal > 0
      ? { emoji: '🟢', texte: 'Excédent non expliqué', classe: 'green' }
      : { emoji: '🔴', texte: 'Manque non expliqué', classe: 'red' };
  }

  // ------------------------------------------------------------
  // STATUTS NORMALISÉS — §10 du cadrage. Dérivé, jamais saisi librement.
  // "En cours de vérification" n'est pas distingué de "À vérifier" dans ce
  // lot (P0) : aucune des deux sources (Verify, FDJ) ne trace aujourd'hui
  // un instant "investigation ouverte" distinct de "pas encore clôturé" —
  // limite assumée, documentée plutôt que fabriquée (Article 5).
  // ------------------------------------------------------------
  const STATUTS_ECART = {
    A_VERIFIER: 'a_verifier',
    REGULARISE: 'regularise',
    CLOTURE_NON_EXPLIQUE: 'cloture_non_explique',
    CLOTURE_EXPLIQUE: 'cloture_explique',
  };
  const LABELS_STATUT_ECART = {
    a_verifier: 'À vérifier',
    regularise: 'Régularisé',
    cloture_non_explique: 'Clôturé — non expliqué',
    cloture_explique: 'Clôturé — expliqué',
  };
  function labelStatutEcart(statut) { return LABELS_STATUT_ECART[statut] || statut; }

  // `cloture` : vrai dès que le contrôle source porte une clôture/validation
  // (FDJ : resultat_controle choisi ; Verify : valide_le_{piste|boutique}
  // posé). `causeConnue` : vrai si un vrai motif documenté existe (pas
  // 'non_explique' ni vide) — couvre aussi bien un `cause_code` structuré
  // qu'un verdict manager du type "Conforme avec écart justifié" (FDJ),
  // que ce moteur ne connaît pas directement : c'est à l'appelant de
  // fournir `causeConnue` en tenant compte de SA propre notion de verdict,
  // ce moteur ne fait que dériver le statut final à partir de ces 3 faits.
  function deriverStatutEcart({ ecartInitial, ecartFinal, cloture, causeConnue } = {}) {
    const situation = situationVerificationEcart(ecartFinal, ecartInitial);
    if (situation === 'aucun_ecart') return null; // rien à consolider dans "Analyse des écarts"
    if (!cloture) return STATUTS_ECART.A_VERIFIER;
    if (situation === 'corrige_a_zero') return STATUTS_ECART.REGULARISE;
    return causeConnue ? STATUTS_ECART.CLOTURE_EXPLIQUE : STATUTS_ECART.CLOTURE_NON_EXPLIQUE;
  }

  // ------------------------------------------------------------
  // AGRÉGATS — §15 du cadrage. Toujours calculés sur ecartFinal (jamais
  // ecartInitial) pour la "situation retenue", mais le NOMBRE d'écarts
  // détectés (§16) reste disponible séparément côté appelant via
  // ecartInitial ≠ 0 sur la liste brute — ce moteur ne recalcule que les 5
  // cartes KPI de la vue d'ensemble (§5), pas les statistiques de
  // détection.
  // ------------------------------------------------------------
  function calculerKpisEcarts(liste) {
    const l = Array.isArray(liste) ? liste : [];
    let totalPositif = 0, nbPositif = 0, totalNegatif = 0, nbNegatif = 0, aInvestiguer = 0, volume = 0;
    l.forEach(e => {
      const f = e && e.ecartFinal;
      if (f === null || f === undefined || f === 0) return;
      volume += Math.abs(f);
      if (f > 0) { totalPositif += f; nbPositif++; }
      else { totalNegatif += f; nbNegatif++; }
      if (e.statut === STATUTS_ECART.A_VERIFIER) aInvestiguer++;
    });
    return {
      soldeNet: Math.round((totalPositif + totalNegatif) * 100) / 100,
      positifs: { total: Math.round(totalPositif * 100) / 100, nb: nbPositif },
      negatifs: { total: Math.round(totalNegatif * 100) / 100, nb: nbNegatif },
      aInvestiguer,
      volume: Math.round(volume * 100) / 100,
    };
  }

  // Vue par employé (§11) — distingue explicitement écarts INITIAUX
  // détectés (ecartInitial ≠ 0) des écarts FINAUX réellement retenus
  // (ecartFinal ≠ 0), pour ne jamais présenter "10 écarts initiaux dont 9
  // régularisés" comme "10 erreurs de caisse" (citation exacte du cadrage).
  function agregerEcartsParEmploye(liste) {
    const l = Array.isArray(liste) ? liste : [];
    const parEmploye = {};
    l.forEach(e => {
      if (!e || !e.employeeId) return;
      if (!parEmploye[e.employeeId]) {
        parEmploye[e.employeeId] = {
          employeeId: e.employeeId, employeeNom: e.employeeNom || null,
          controles: 0, ecartsInitiaux: 0, regularises: 0, ecartsFinaux: 0, soldeFinal: 0,
        };
      }
      const agg = parEmploye[e.employeeId];
      agg.controles++;
      if (e.ecartInitial) agg.ecartsInitiaux++;
      if (e.statut === STATUTS_ECART.REGULARISE) agg.regularises++;
      if (e.ecartFinal) { agg.ecartsFinaux++; agg.soldeFinal += e.ecartFinal; }
    });
    return Object.values(parEmploye).map(a => ({ ...a, soldeFinal: Math.round(a.soldeFinal * 100) / 100 }));
  }

  global.NexusEcartsMoteur = {
    situationVerificationEcart, motifEcartObligatoire, ajouterRemboursementSiManque, libelleEcartRestant,
    STATUTS_ECART, labelStatutEcart, deriverStatutEcart,
    calculerKpisEcarts, agregerEcartsParEmploye,
  };
})(typeof window !== 'undefined' ? window : globalThis);
