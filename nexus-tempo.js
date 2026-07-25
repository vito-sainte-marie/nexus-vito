/* ==============================================================
   NEXUS Tempo — moteur partagé du rythme réel de la station.
   Créé le 25/07/2026 à la demande de Frédéric.

   Principe : NEXUS Tempo lit les audits de caisse quotidiens
   (table audits_caisse — vente_piste et vente_boutique, par jour
   et par quart) et révèle des rythmes par jour de la semaine :
   quel jour performe, quel jour régresse, qui était présent.

   Mise à jour du 25/07/2026 (même jour, second passage) : NEXUS
   Verify capture désormais le litrage réel par carburant (gazole /
   SP95 / GNR) au lieu d'un seul montant "vente piste" global — voir
   audits_caisse.litrage_gazole / litrage_sp95 / litrage_gnr. NEXUS
   Tempo peut donc calculer un vrai litrage par jour de semaine dès
   qu'un audit a été saisi avec ce détail. Les audits antérieurs
   (litrage_gazole = null) restent exclus de tout calcul de litrage —
   jamais de valeur reconstituée a posteriori.

   Article 5 de la Constitution NEXUS ("jamais de chiffre inventé")
   gouverne tout ce fichier :
   - aucune tendance n'est affichée sans un minimum d'occurrences
     historiques du même jour (SEUILS.MIN_OCCURRENCES_TENDANCE) ;
   - aucune décision prioritaire n'est proposée tant que
     l'historique global est trop court (SEUILS.MIN_JOURS_DECISION) ;
   - aucun classement d'employé n'est affiché sans un minimum de
     quarts comparables (SEUILS.CONFIANCE_FORTE / CONFIANCE_MOYENNE) ;
   - le litrage carburant n'est agrégé pour un jour donné que si
     TOUS les quarts de ce jour ont été saisis avec le détail par
     carburant (voir litrageDisponible) — un jour à moitié renseigné
     ferait un total de litrage faux, pas approximatif.

   Comme nexus-periodes.js et nexus-marge.js, ce fichier expose un
   seul objet global : window.NexusTempo.
   ============================================================== */
(function () {

  const NOM_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const NOM_JOURS_COURT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const SEUILS = {
    // Nombre minimum d'occurrences passées d'un même jour de semaine
    // pour oser parler d'une évolution ("ce jour progresse / régresse").
    // En dessous, une seule mesure ne permet de décrire qu'un état, pas
    // une tendance.
    MIN_OCCURRENCES_TENDANCE: 2,
    // Nombre minimum de jours d'historique total (tous jours de semaine
    // confondus) avant que NEXUS Tempo ose proposer une décision
    // prioritaire. En dessous, le risque de généraliser à partir d'un
    // simple hasard de calendrier est trop grand.
    MIN_JOURS_DECISION: 14,
    // Confiance sur un employé : nombre de quarts comparables observés.
    CONFIANCE_FORTE: 5,
    CONFIANCE_MOYENNE: 2,
    // Coefficient de variation (écart-type / moyenne) au-delà duquel un
    // jour est qualifié d'irrégulier plutôt que stable.
    VARIABILITE_IRREGULIERE: 0.35,
  };

  const LITRAGE_INDISPONIBLE = "Litrage non calculable pour l'instant — aucun audit de caisse n'a encore été saisi avec le détail par carburant (gazole / SP95 / GNR) introduit le 25/07/2026 dans Nexus Verify. Dès le premier audit saisi avec ce détail, cette section affichera le litrage réel par jour de semaine.";

  function dateLocale(dateStr) {
    // Évite les décalages de fuseau horaire sur une date SQL "YYYY-MM-DD"
    // (même précaution que NEXUS-Planning-v1.html).
    return new Date(dateStr + 'T12:00:00');
  }

  function moyenne(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function ecartType(arr) {
    if (arr.length < 2) return 0;
    const m = moyenne(arr);
    const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  // ------------------------------------------------------------
  // 1) Regroupe les lignes audits_caisse (une ligne par quart) en
  //    totaux journaliers, en conservant le détail par quart pour
  //    l'analyse équipe. Le litrage n'est sommé pour un jour que si
  //    tous ses quarts ont le détail par carburant (litrageDisponible).
  // ------------------------------------------------------------
  function agregerParJour(rowsAuditsCaisse) {
    const parDate = {};
    (rowsAuditsCaisse || []).forEach(r => {
      if (!parDate[r.date]) {
        parDate[r.date] = {
          date: r.date,
          jourSemaine: dateLocale(r.date).getDay(),
          ventePiste: 0, venteBoutique: 0,
          ecartPiste: 0, ecartBoutique: 0,
          litrageGazole: 0, litrageSp95: 0, litrageGnr: 0,
          litrageDisponible: true,
          quarts: [],
        };
      }
      const j = parDate[r.date];
      j.ventePiste += Number(r.vente_piste) || 0;
      j.venteBoutique += Number(r.vente_boutique) || 0;
      j.ecartPiste += Number(r.ecart_piste) || 0;
      j.ecartBoutique += Number(r.ecart_boutique) || 0;

      const quartLitrageDisponible = r.litrage_gazole != null && r.litrage_sp95 != null && r.litrage_gnr != null;
      if (quartLitrageDisponible) {
        j.litrageGazole += Number(r.litrage_gazole) || 0;
        j.litrageSp95 += Number(r.litrage_sp95) || 0;
        j.litrageGnr += Number(r.litrage_gnr) || 0;
      } else {
        j.litrageDisponible = false;
      }

      j.quarts.push({
        quart: r.quart,
        ventePiste: Number(r.vente_piste) || 0,
        venteBoutique: Number(r.vente_boutique) || 0,
        ecartPiste: Number(r.ecart_piste) || 0,
        ecartBoutique: Number(r.ecart_boutique) || 0,
        litrageDisponible: quartLitrageDisponible,
        litrageGazole: r.litrage_gazole,
        litrageSp95: r.litrage_sp95,
        litrageGnr: r.litrage_gnr,
        employesPiste: Array.isArray(r.employes_piste) ? r.employes_piste : [],
        employesBoutique: Array.isArray(r.employes_boutique) ? r.employes_boutique : [],
      });
    });
    return Object.values(parDate).sort((a, b) => a.date < b.date ? -1 : 1);
  }

  // ------------------------------------------------------------
  // 2) Regroupe les jours agrégés par jour de semaine (0=dimanche
  //    … 6=samedi), triés du plus ancien au plus récent.
  // ------------------------------------------------------------
  function regrouperParJourSemaine(joursAgreges) {
    const buckets = NOM_JOURS.map((nom, idx) => ({ jourSemaine: idx, nom, nomCourt: NOM_JOURS_COURT[idx], occurrences: [] }));
    (joursAgreges || []).forEach(j => { buckets[j.jourSemaine].occurrences.push(j); });
    buckets.forEach(b => b.occurrences.sort((a, b2) => a.date < b2.date ? -1 : 1));
    return buckets;
  }

  function evolution(valeurActuelle, valeurReference) {
    if (!valeurReference || valeurReference <= 0) return null;
    return (valeurActuelle - valeurReference) / valeurReference;
  }

  // ------------------------------------------------------------
  // 3) Calcule, pour chaque jour de semaine, moyenne / dernière
  //    valeur / évolution / variabilité — puis classe les 7 jours
  //    par performance combinée (piste + boutique), MAIS AUSSI
  //    séparément par piste seule et par boutique seule (25/07/2026,
  //    demande de Frédéric : "meilleures ventes en piste le vendredi,
  //    en revanche la boutique a mieux fonctionné mardi" — les deux
  //    classements peuvent diverger, ils ne doivent pas être noyés
  //    dans une seule moyenne combinée).
  //    Ne classe QUE les jours qui ont au moins une occurrence
  //    réelle : un jour jamais observé n'apparaît pas dans le
  //    classement (on ne peut rien en dire).
  // ------------------------------------------------------------
  function calculerClassement(regroupement) {
    const analyses = regroupement.map(bucket => {
      const occ = bucket.occurrences;
      if (occ.length === 0) {
        return { ...bucket, moyennePiste: null, moyenneBoutique: null, moyenneCombinee: null,
          derniere: null, evolutionPiste: null, evolutionBoutique: null, evolutionCombinee: null,
          coefficientVariation: null, confianceTendance: false,
          litrageMoyenGazole: null, litrageMoyenSp95: null, litrageMoyenGnr: null, litrageMoyenTotal: null, nbOccLitrage: 0 };
      }
      const pistes = occ.map(o => o.ventePiste);
      const boutiques = occ.map(o => o.venteBoutique);
      const combinees = occ.map(o => o.ventePiste + o.venteBoutique);
      const moyennePiste = moyenne(pistes);
      const moyenneBoutique = moyenne(boutiques);
      const moyenneCombinee = moyenne(combinees);
      const derniere = occ[occ.length - 1];

      let evolutionPiste = null, evolutionBoutique = null, evolutionCombinee = null, confianceTendance = false;
      if (occ.length >= SEUILS.MIN_OCCURRENCES_TENDANCE) {
        const precedentes = occ.slice(0, occ.length - 1);
        evolutionPiste = evolution(derniere.ventePiste, moyenne(precedentes.map(o => o.ventePiste)));
        evolutionBoutique = evolution(derniere.venteBoutique, moyenne(precedentes.map(o => o.venteBoutique)));
        evolutionCombinee = evolution(derniere.ventePiste + derniere.venteBoutique, moyenne(precedentes.map(o => o.ventePiste + o.venteBoutique)));
        confianceTendance = true;
      }
      const coefficientVariation = combinees.length >= 2 && moyenneCombinee > 0 ? ecartType(combinees) / moyenneCombinee : null;

      const occLitrage = occ.filter(o => o.litrageDisponible);
      const litrageMoyenGazole = occLitrage.length ? moyenne(occLitrage.map(o => o.litrageGazole)) : null;
      const litrageMoyenSp95 = occLitrage.length ? moyenne(occLitrage.map(o => o.litrageSp95)) : null;
      const litrageMoyenGnr = occLitrage.length ? moyenne(occLitrage.map(o => o.litrageGnr)) : null;
      const litrageMoyenTotal = occLitrage.length ? (litrageMoyenGazole + litrageMoyenSp95 + litrageMoyenGnr) : null;

      return { ...bucket, moyennePiste, moyenneBoutique, moyenneCombinee, derniere,
        evolutionPiste, evolutionBoutique, evolutionCombinee, coefficientVariation, confianceTendance,
        litrageMoyenGazole, litrageMoyenSp95, litrageMoyenGnr, litrageMoyenTotal, nbOccLitrage: occLitrage.length };
    });

    // Classement combiné (piste + boutique) — sert au statut hebdomadaire,
    // aux "Jours révélés" et à la décision prioritaire.
    const observes = analyses.filter(a => a.occurrences.length > 0).sort((a, b) => b.moyenneCombinee - a.moyenneCombinee);
    observes.forEach((a, i) => { a.rang = i + 1; });

    // Classements séparés — piste seule, boutique seule. Un jour peut être
    // n°1 en piste sans l'être en boutique, et inversement : c'est
    // précisément ce que ces deux classements doivent pouvoir montrer.
    const observesPiste = analyses.filter(a => a.occurrences.length > 0).sort((a, b) => b.moyennePiste - a.moyennePiste);
    observesPiste.forEach((a, i) => { a.rangPiste = i + 1; });
    const observesBoutique = analyses.filter(a => a.occurrences.length > 0).sort((a, b) => b.moyenneBoutique - a.moyenneBoutique);
    observesBoutique.forEach((a, i) => { a.rangBoutique = i + 1; });

    analyses.forEach(a => {
      if (a.occurrences.length === 0) { a.rang = null; a.rangPiste = null; a.rangBoutique = null; }
    });

    const nbJoursRanges = observes.length;
    analyses.forEach(a => {
      if (a.occurrences.length === 0) { a.statut = 'Aucune donnée'; return; }
      if (a.rang === 1) { a.statut = 'Jour moteur'; return; }
      if (a.rang === nbJoursRanges && nbJoursRanges > 1) {
        a.statut = (a.evolutionCombinee !== null && a.evolutionCombinee < -0.05) ? 'Jour en recul' : 'Jour à renforcer';
        return;
      }
      if (a.coefficientVariation !== null && a.coefficientVariation > SEUILS.VARIABILITE_IRREGULIERE) { a.statut = 'Jour irrégulier'; return; }
      if (a.evolutionCombinee !== null && a.evolutionCombinee <= -0.10) { a.statut = 'Jour en recul'; return; }
      if (a.evolutionCombinee !== null && a.evolutionCombinee >= 0.10 && a.rang <= 3) { a.statut = 'Jour solide'; return; }
      a.statut = 'Jour stable';
    });

    return analyses;
  }

  // ------------------------------------------------------------
  // 4) "Jours révélés" : jour moteur, jour en progression (le plus
  //    fort évoluant parmi les jours dont la tendance est calculable),
  //    jour à renforcer (dernier du classement combiné).
  // ------------------------------------------------------------
  function identifierJoursReveles(classement) {
    const observes = classement.filter(a => a.occurrences.length > 0);
    if (observes.length === 0) return { jourMoteur: null, jourProgression: null, jourARenforcer: null };

    const jourMoteur = observes.find(a => a.rang === 1) || null;
    const jourARenforcer = observes.length > 1 ? observes.find(a => a.rang === observes.length) : null;

    const avecTendance = observes.filter(a => a.confianceTendance && a.evolutionCombinee !== null);
    const jourProgression = avecTendance.length
      ? avecTendance.reduce((meilleur, a) => (!meilleur || a.evolutionCombinee > meilleur.evolutionCombinee) ? a : meilleur, null)
      : null;

    return { jourMoteur, jourProgression, jourARenforcer };
  }

  // ------------------------------------------------------------
  // 4bis) Meilleur jour en piste et meilleur jour en boutique, pris
  //    séparément — même avec une seule occurrence de chaque jour,
  //    on peut honnêtement dire "le plus fort observé jusqu'ici" sans
  //    prétendre à une tendance confirmée (voir "confiance" retournée).
  // ------------------------------------------------------------
  function identifierMeilleursJoursSepares(classement) {
    const observes = classement.filter(a => a.occurrences.length > 0);
    if (observes.length === 0) return { meilleurPiste: null, meilleurBoutique: null };
    const meilleurPiste = observes.find(a => a.rangPiste === 1) || null;
    const meilleurBoutique = observes.find(a => a.rangBoutique === 1) || null;
    return { meilleurPiste, meilleurBoutique };
  }

  // ------------------------------------------------------------
  // 4ter) Classement des jours par litrage total (uniquement les jours
  //    où le détail par carburant est disponible). Retourne un tableau
  //    trié décroissant ; vide tant qu'aucun audit n'a le détail.
  // ------------------------------------------------------------
  function classementLitrage(classement) {
    return classement
      .filter(a => a.nbOccLitrage > 0)
      .sort((a, b) => b.litrageMoyenTotal - a.litrageMoyenTotal);
  }

  // ------------------------------------------------------------
  // 5) Analyse équipe : contribution observée par employé, par rôle
  //    (piste ou boutique), pendant les quarts où il/elle était
  //    présent(e). Jamais de causalité affirmée — seulement une
  //    contribution observée, avec un niveau de confiance explicite
  //    basé sur le nombre de quarts comparables.
  // ------------------------------------------------------------
  function analyserEquipe(joursAgreges, employesParId) {
    const parEmploye = {}; // employeeId|role -> { employeeId, role, valeurs: [], ecarts: [] }
    (joursAgreges || []).forEach(jour => {
      jour.quarts.forEach(q => {
        q.employesPiste.forEach(empId => {
          const cle = empId + '|piste';
          if (!parEmploye[cle]) parEmploye[cle] = { employeeId: empId, role: 'piste', valeurs: [], ecarts: [] };
          parEmploye[cle].valeurs.push(q.ventePiste);
          parEmploye[cle].ecarts.push(q.ecartPiste);
        });
        q.employesBoutique.forEach(empId => {
          const cle = empId + '|boutique';
          if (!parEmploye[cle]) parEmploye[cle] = { employeeId: empId, role: 'boutique', valeurs: [], ecarts: [] };
          parEmploye[cle].valeurs.push(q.venteBoutique);
          parEmploye[cle].ecarts.push(q.ecartBoutique);
        });
      });
    });

    return Object.values(parEmploye).map(e => {
      const nb = e.valeurs.length;
      const confiance = nb >= SEUILS.CONFIANCE_FORTE ? 'forte' : (nb >= SEUILS.CONFIANCE_MOYENNE ? 'moyenne' : 'insuffisante');
      return {
        employeeId: e.employeeId,
        nom: (employesParId && employesParId[e.employeeId] && employesParId[e.employeeId].nom) || 'Employé inconnu',
        role: e.role,
        nbQuarts: nb,
        moyenneVente: moyenne(e.valeurs),
        moyenneEcart: moyenne(e.ecarts),
        confiance,
      };
    }).sort((a, b) => b.moyenneVente - a.moyenneVente);
  }

  // ------------------------------------------------------------
  // 6) Décision NEXUS — une seule priorité, seulement si
  //    l'historique global est assez long pour la justifier.
  // ------------------------------------------------------------
  function genererDecisionPrioritaire(joursAgreges, classement) {
    const nbJoursTotal = (joursAgreges || []).length;
    if (nbJoursTotal < SEUILS.MIN_JOURS_DECISION) {
      return {
        disponible: false,
        message: `Historique encore insuffisant pour proposer une décision fiable (${nbJoursTotal} jour${nbJoursTotal > 1 ? 's' : ''} enregistré${nbJoursTotal > 1 ? 's' : ''} sur ${SEUILS.MIN_JOURS_DECISION} nécessaires). Continuez à compléter les audits de caisse quotidiens : NEXUS Tempo se construit avec le temps.`,
      };
    }
    const { jourARenforcer } = identifierJoursReveles(classement);
    if (!jourARenforcer) {
      return { disponible: false, message: "Aucun jour ne se distingue suffisamment pour justifier une priorité aujourd'hui." };
    }
    return {
      disponible: true,
      jour: jourARenforcer,
      message: `Contrôler le déroulement du ${jourARenforcer.nom} : c'est le jour le plus faible de la semaine sur la période observée (CA piste + boutique moyen de ${Math.round(jourARenforcer.moyenneCombinee).toLocaleString('fr-FR')} €${jourARenforcer.evolutionCombinee !== null ? `, ${jourARenforcer.evolutionCombinee >= 0 ? '+' : ''}${(jourARenforcer.evolutionCombinee * 100).toFixed(1).replace('.', ',')} % sur la dernière occurrence` : ''}).`,
    };
  }

  window.NexusTempo = {
    SEUILS, NOM_JOURS, NOM_JOURS_COURT, LITRAGE_INDISPONIBLE,
    agregerParJour, regrouperParJourSemaine, calculerClassement,
    identifierJoursReveles, identifierMeilleursJoursSepares, classementLitrage,
    analyserEquipe, genererDecisionPrioritaire,
    dateLocale, moyenne, ecartType, evolution,
  };
})();
