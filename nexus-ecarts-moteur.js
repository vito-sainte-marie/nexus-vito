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
  // ARRONDI CENTIMES — v2.269 (28/08/2026, retour de Frédéric après test
  // réel du P0 : "Volume d'écarts" affichait 271,96 € au lieu de 271,95 €
  // pour +190,05 € et -81,90 €). Cause réelle : sommer des flottants JS
  // (0.1 + 0.2 !== 0.3) puis arrondir UNE SEULE FOIS à la fin laisse
  // s'accumuler la dérive binaire sur une liste de plusieurs lignes. Le
  // correctif structurel n'est pas d'arrondir plus tard mais de ne JAMAIS
  // sommer des flottants : chaque montant est converti en centimes entiers
  // (`Math.round(v*100)`) AVANT toute addition, la somme reste un entier
  // exact du début à la fin, et n'est reconvertie en euros qu'à la toute
  // dernière étape (division par 100). `arrondiCentimes` applique la même
  // règle à un montant isolé (ex. à la normalisation des lignes dans
  // nexus-ecarts-donnees.js), pour qu'un `ecartFinal` de contrôle ne soit
  // jamais un flottant du type 0.0000000001 qui échapperait à un test
  // `=== 0` (autre bug réel constaté : un "+0,00 €" apparaissant à tort
  // dans "À vérifier").
  // ------------------------------------------------------------
  function arrondiCentimes(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return v;
    return Math.round(Number(v) * 100) / 100;
  }

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
  // MONTANT RETENU — v2.269 (28/08/2026, retour de Frédéric, §7 : "règle
  // métier fondamentale", séparation stricte entre l'ANALYSE opérationnelle
  // (tous les écarts, positifs et négatifs, jamais compensés entre eux) et
  // le TRAITEMENT retenu (ce que NEXUS retient réellement à l'issue de la
  // vérification) :
  //   - écart non encore résolu (statut 'à vérifier') : rien n'est encore
  //     retenu — 0, en attente.
  //   - excédent qui persiste (positif, régularisé ou non) : jamais
  //     transformé automatiquement en crédit — retenu = 0. Trouver de
  //     l'argent en trop n'est jamais "gagné" par NEXUS de son propre chef.
  //   - manque qui persiste (négatif, expliqué ou non) : retenu = le
  //     montant négatif lui-même — un manque reste un manque réel, que sa
  //     cause soit connue ou non.
  //   - écart corrigé à zéro (régularisé) : retenu = 0.
  // Citation exacte du cadrage : "+35 € d'excédents, -13 € de manques non
  // expliqués ne donnent JAMAIS +22 € retenus" — le solde opérationnel
  // (+22 €) et le montant retenu (-13 €) sont deux nombres distincts,
  // jamais compensés l'un dans l'autre.
  // ------------------------------------------------------------
  function calculerMontantRetenuLigne(ligne) {
    if (!ligne || ligne.statut === STATUTS_ECART.A_VERIFIER || !ligne.statut) return 0;
    const f = ligne.ecartFinal;
    if (f === null || f === undefined || f >= 0) return 0;
    return f;
  }

  // ------------------------------------------------------------
  // AGRÉGATS — §15 du cadrage. Toujours calculés sur ecartFinal (jamais
  // ecartInitial) pour la "situation retenue", mais le NOMBRE d'écarts
  // détectés (§16) reste disponible séparément côté appelant via
  // ecartInitial ≠ 0 sur la liste brute.
  //
  // v2.269 : accumulation en CENTIMES ENTIERS (voir arrondiCentimes
  // ci-dessus) — plus aucune dérive flottante possible sur le volume ou le
  // solde, quel que soit le nombre de lignes. Ajoute `soldeOperationnel`
  // (même valeur que `soldeNet`, conservé pour rétrocompatibilité — nom
  // clarifié à la demande de Frédéric, "Solde opérationnel" plutôt que
  // "Solde retenu" qui prêtait à confusion avec le nouveau `montantRetenu`)
  // et `montantRetenu` (voir calculerMontantRetenuLigne).
  // ------------------------------------------------------------
  function calculerKpisEcarts(liste) {
    const l = Array.isArray(liste) ? liste : [];
    let cPositifs = 0, nbPositif = 0, cNegatifs = 0, nbNegatif = 0, aInvestiguer = 0, cVolume = 0, cRetenu = 0;
    l.forEach(e => {
      const f = e && e.ecartFinal;
      if (f === null || f === undefined || f === 0) return;
      const cf = Math.round(f * 100);
      cVolume += Math.abs(cf);
      if (cf > 0) { cPositifs += cf; nbPositif++; }
      else { cNegatifs += cf; nbNegatif++; }
      if (e.statut === STATUTS_ECART.A_VERIFIER) aInvestiguer++;
      cRetenu += Math.round(calculerMontantRetenuLigne(e) * 100);
    });
    const soldeOperationnel = (cPositifs + cNegatifs) / 100;
    return {
      soldeNet: soldeOperationnel, // conservé (rétrocompatibilité, ancien nom)
      soldeOperationnel,
      montantRetenu: cRetenu / 100,
      positifs: { total: cPositifs / 100, nb: nbPositif },
      negatifs: { total: cNegatifs / 100, nb: nbNegatif },
      aInvestiguer,
      volume: cVolume / 100,
    };
  }

  // Vue par employé (§11, refonte §9) — distingue explicitement écarts
  // INITIAUX détectés (ecartInitial ≠ 0) des écarts FINAUX réellement
  // retenus (ecartFinal ≠ 0), pour ne jamais présenter "10 écarts initiaux
  // dont 9 régularisés" comme "10 erreurs de caisse" (citation exacte du
  // cadrage). v2.269 : sépare aussi explicitement excédents/manques
  // CONSTATÉS (jamais compensés — §7) du montant RETENU (voir
  // calculerMontantRetenuLigne), et transmet `employeeRole` (fourni par
  // l'appelant, une seule ligne suffit puisqu'un employé garde le même
  // rôle sur toute la période) pour la détection d'activité inhabituelle.
  function agregerEcartsParEmploye(liste) {
    const l = Array.isArray(liste) ? liste : [];
    const parEmploye = {};
    l.forEach(e => {
      if (!e || !e.employeeId) return;
      if (!parEmploye[e.employeeId]) {
        parEmploye[e.employeeId] = {
          employeeId: e.employeeId, employeeNom: e.employeeNom || null, employeeRole: e.employeeRole || null,
          controles: 0, ecartsInitiaux: 0, regularises: 0, ecartsFinaux: 0,
          cExcedents: 0, cManques: 0, cSoldeOperationnel: 0, cMontantRetenu: 0,
        };
      }
      const agg = parEmploye[e.employeeId];
      agg.controles++;
      if (!agg.employeeRole && e.employeeRole) agg.employeeRole = e.employeeRole;
      if (e.ecartInitial) agg.ecartsInitiaux++;
      if (e.statut === STATUTS_ECART.REGULARISE) agg.regularises++;
      if (e.ecartFinal) {
        agg.ecartsFinaux++;
        const cf = Math.round(e.ecartFinal * 100);
        agg.cSoldeOperationnel += cf;
        if (cf > 0) agg.cExcedents += cf; else agg.cManques += cf;
      }
      agg.cMontantRetenu += Math.round(calculerMontantRetenuLigne(e) * 100);
    });
    return Object.values(parEmploye).map(a => ({
      employeeId: a.employeeId, employeeNom: a.employeeNom, employeeRole: a.employeeRole,
      controles: a.controles, ecartsInitiaux: a.ecartsInitiaux, regularises: a.regularises, ecartsFinaux: a.ecartsFinaux,
      excedentsConstates: a.cExcedents / 100,
      manquesConstates: a.cManques / 100,
      soldeOperationnel: a.cSoldeOperationnel / 100,
      soldeFinal: a.cSoldeOperationnel / 100, // conservé (rétrocompatibilité, ancien nom)
      montantRetenu: a.cMontantRetenu / 100,
    }));
  }

  // ------------------------------------------------------------
  // ACTIVITÉ INHABITUELLE — v2.269 (28/08/2026, §5/§6 du retour de
  // Frédéric). NEXUS n'exclut JAMAIS un manager des analyses ("rôle =
  // Manager ne signifie pas aucune activité caisse autorisée" — un
  // remplacement exceptionnel d'un absent est légitime), mais un manager
  // ou gérant associé à une activité caisse réelle EST une situation
  // suffisamment rare pour mériter un signalement — jamais une conclusion
  // d'erreur automatique (aucune donnée de planning n'existe dans NEXUS
  // aujourd'hui pour confirmer ou infirmer un remplacement légitime,
  // Article 5 : ce signal reste un simple constat de rôle, à qualifier
  // par le manager lui-même, jamais une accusation).
  // ------------------------------------------------------------
  const ROLES_CAISSE_INHABITUELLE = ['manager', 'gerant'];
  function roleCaisseInhabituelle(role) {
    return !!role && ROLES_CAISSE_INHABITUELLE.includes(role);
  }

  // ------------------------------------------------------------
  // ATTRIBUTION CAISSE (VERIFY) — v2.285 (29/08/2026, P0 signalé par
  // Frédéric : "Composition — Audrey" montrait un écart Piste de Ruddy).
  // Chaque écart Piste/Boutique doit être attribué à la personne RÉELLEMENT
  // affectée à CETTE caisse sur CE quart (audits_caisse.employes_piste /
  // .employes_boutique — des tableaux d'ids, posés par
  // employesSelectionnes.piste/.boutique dans NEXUS-Verify-v1.html), jamais
  // au manager qui a saisi/validé l'audit (audits_caisse.employee_id — un
  // champ totalement différent : l'auteur de la ligne, pas un employé de
  // caisse ; confirmé sur données réelles, 17/08/2026 Quart 2 : employee_id
  // = Audrey, mais employes_piste = [Ruddy], employes_boutique = [loane]).
  // Un audit peut avoir 0 (composante non traitée), 1 (cas normal) ou
  // plusieurs personnes (relève en cours de quart) sur une même caisse : on
  // n'attribue JAMAIS arbitrairement à l'une d'elles quand il y en a
  // plusieurs — mieux vaut un écart non rattaché à un employé (exclu
  // proprement de "Par employé", agregerEcartsParEmploye ignore déjà
  // employeeId=null ci-dessus) qu'une fausse précision sur qui est
  // responsable (Article 5). Le nom reste affiché à titre informatif dans
  // ce cas (`employeeNom` renseigné même si `employeeId` est null), pour ne
  // pas rendre la ligne totalement muette dans "Analyse des écarts".
  // ------------------------------------------------------------
  function resoudreEmployeCaisseVerify(idsCaisse, nomParEmploye, roleParEmploye) {
    const ids = Array.isArray(idsCaisse) ? idsCaisse.filter(Boolean) : [];
    if (ids.length !== 1) {
      const noms = ids.map(id => (nomParEmploye || {})[id]).filter(Boolean);
      return { employeeId: null, employeeNom: noms.length ? noms.join(', ') : null, employeeRole: null };
    }
    const id = ids[0];
    return {
      employeeId: id,
      employeeNom: (nomParEmploye || {})[id] || null,
      employeeRole: (roleParEmploye || {})[id] || null,
    };
  }

  global.NexusEcartsMoteur = {
    arrondiCentimes,
    situationVerificationEcart, motifEcartObligatoire, ajouterRemboursementSiManque, libelleEcartRestant,
    STATUTS_ECART, labelStatutEcart, deriverStatutEcart,
    calculerMontantRetenuLigne, calculerKpisEcarts, agregerEcartsParEmploye,
    ROLES_CAISSE_INHABITUELLE, roleCaisseInhabituelle,
    resoudreEmployeCaisseVerify,
  };
})(typeof window !== 'undefined' ? window : globalThis);
