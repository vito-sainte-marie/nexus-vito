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

    // --- Mémoire temporelle (25/07/2026, Niveaux 3 & 4) ---------------
    // Un même mois calendaire doit avoir été observé au moins deux fois
    // (généralement sur deux années différentes) avant qu'on ose parler
    // d'un effet saisonnier plutôt que d'une coïncidence.
    MIN_OCCURRENCES_SAISON: 2,
    // Une "tendance cachée" (Niveau 4) exige davantage d'observations
    // qu'une simple tendance hebdomadaire : on cherche un motif que le
    // manager ne voit pas spontanément, le risque de faux positif est
    // donc traité avec plus de prudence.
    MIN_OCCURRENCES_DECOUVERTE: 4,
    // Maturité de NEXUS Tempo — nombre de jours calendaires écoulés
    // depuis le tout premier audit de caisse enregistré.
    MATURITE_NIVEAU2_JOURS: 30,
    MATURITE_NIVEAU3_JOURS: 90,
    MATURITE_NIVEAU4_JOURS: 365,
  };

  const NOM_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

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

  // ==============================================================
  // Mémoire temporelle (25/07/2026) — Niveaux 3 & 4
  //
  // NEXUS Tempo ne doit pas seulement décrire le passé : il doit
  // apprendre le fonctionnement réel de la station et devenir de plus
  // en plus précis à mesure que l'historique s'accumule. Trois briques
  // ajoutées ici :
  //   - la "maturité" de Tempo (combien de temps d'historique dispose-
  //     t-on réellement, pour situer honnêtement ce que Tempo peut ou
  //     ne peut pas encore affirmer) ;
  //   - le Niveau 3 : cycles saisonniers (mois, débuts/fins de mois,
  //     jours fériés) ;
  //   - le Niveau 4 : découverte automatique de rythmes cachés, sans
  //     aucune règle codée en dur sur "quel jour est bon" — uniquement
  //     des détecteurs génériques appliqués aux données réelles.
  //
  // Article 5 toujours : chaque brique renvoie explicitement
  // "insuffisant" tant que le nombre d'observations ne dépasse pas le
  // seuil déclaré dans SEUILS — jamais de valeur reconstituée pour
  // combler un trou.
  // ==============================================================

  // ------------------------------------------------------------
  // 7) Maturité de Tempo — ancienneté réelle de l'historique
  //    (25/07/2026). Sert à afficher en haut de page un indicateur
  //    honnête : plus la station accumule d'audits, plus Tempo peut
  //    se permettre d'affirmer des choses.
  // ------------------------------------------------------------
  function calculerMaturite(joursAgreges) {
    if (!joursAgreges || !joursAgreges.length) {
      return { niveau: 1, emoji: '🟥', label: 'Découverte', joursHistorique: 0, seuilSuivant: SEUILS.MATURITE_NIVEAU2_JOURS, joursRestants: SEUILS.MATURITE_NIVEAU2_JOURS };
    }
    const premiereDate = dateLocale(joursAgreges[0].date);
    const joursHistorique = Math.max(0, Math.floor((new Date() - premiereDate) / 86400000));
    let niveau, emoji, label, seuilSuivant;
    if (joursHistorique >= SEUILS.MATURITE_NIVEAU4_JOURS) { niveau = 4; emoji = '💎'; label = 'Intelligence'; seuilSuivant = null; }
    else if (joursHistorique >= SEUILS.MATURITE_NIVEAU3_JOURS) { niveau = 3; emoji = '🟩'; label = 'Confiance'; seuilSuivant = SEUILS.MATURITE_NIVEAU4_JOURS; }
    else if (joursHistorique >= SEUILS.MATURITE_NIVEAU2_JOURS) { niveau = 2; emoji = '🟨'; label = 'Apprentissage'; seuilSuivant = SEUILS.MATURITE_NIVEAU3_JOURS; }
    else { niveau = 1; emoji = '🟥'; label = 'Découverte'; seuilSuivant = SEUILS.MATURITE_NIVEAU2_JOURS; }
    return { niveau, emoji, label, joursHistorique, seuilSuivant, joursRestants: seuilSuivant !== null ? seuilSuivant - joursHistorique : 0 };
  }

  // ------------------------------------------------------------
  // 8) Calendrier français — jours fériés (fixes + mobiles via le
  //    calcul de Pâques). Ce sont des faits de calendrier, pas des
  //    données inventées : ils peuvent donc être calculés d'avance,
  //    contrairement aux vacances scolaires (zone-dépendantes) ou aux
  //    ponts/événements locaux, volontairement laissés en "Prévue"
  //    dans SOURCES_DONNEES tant qu'ils ne sont pas branchés.
  // ------------------------------------------------------------
  function datePaques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const moisJour = h + l - 7 * m + 114;
    const mois = Math.floor(moisJour / 31); // 3 = mars, 4 = avril
    const jour = (moisJour % 31) + 1;
    return new Date(annee, mois - 1, jour, 12);
  }

  function joursFeries(annee) {
    const iso = d => d.toISOString().slice(0, 10);
    const decaler = (date, jours) => { const d2 = new Date(date); d2.setDate(d2.getDate() + jours); return d2; };
    const paques = datePaques(annee);
    return [
      { date: `${annee}-01-01`, nom: "Jour de l'an" },
      { date: iso(decaler(paques, 1)), nom: 'Lundi de Pâques' },
      { date: `${annee}-05-01`, nom: 'Fête du Travail' },
      { date: `${annee}-05-08`, nom: 'Victoire 1945' },
      { date: iso(decaler(paques, 39)), nom: 'Ascension' },
      { date: iso(decaler(paques, 50)), nom: 'Lundi de Pentecôte' },
      { date: `${annee}-07-14`, nom: 'Fête Nationale' },
      { date: `${annee}-08-15`, nom: 'Assomption' },
      { date: `${annee}-11-01`, nom: 'Toussaint' },
      { date: `${annee}-11-11`, nom: 'Armistice' },
      { date: `${annee}-12-25`, nom: 'Noël' },
    ];
  }

  function estJourFerie(dateStr) {
    const annee = Number(dateStr.slice(0, 4));
    const trouve = joursFeries(annee).find(f => f.date === dateStr);
    return { ferie: !!trouve, nom: trouve ? trouve.nom : null };
  }

  function tagCalendaire(dateStr) {
    const d = dateLocale(dateStr);
    const annee = d.getFullYear(), mois = d.getMonth(), jourMois = d.getDate();
    const dernierJourDuMois = new Date(annee, mois + 1, 0).getDate();
    const ferie = estJourFerie(dateStr);
    return {
      annee, mois, nomMois: NOM_MOIS[mois], jourMois, dernierJourDuMois,
      debutMois: jourMois <= 5,
      finMois: jourMois >= dernierJourDuMois - 4,
      ferie: ferie.ferie, nomFerie: ferie.nom,
    };
  }

  // ------------------------------------------------------------
  // 9) Niveau 3 — Cycles saisonniers.
  //    a) Débuts / fins / milieux de mois — seul signal saisonnier
  //       exploitable dès aujourd'hui avec un historique court, car
  //       il ne nécessite pas plusieurs années de recul.
  //    b) Comparaison par mois calendaire (août vs août, etc.) — exige
  //       qu'un même mois ait été observé au moins
  //       SEUILS.MIN_OCCURRENCES_SAISON fois ; avec l'historique
  //       actuel (un seul mois en cours), ce module reste donc
  //       honnêtement "en apprentissage".
  // ------------------------------------------------------------
  function analyserDebutFinMois(joursAgreges) {
    const buckets = { debut: [], milieu: [], fin: [] };
    (joursAgreges || []).forEach(j => {
      const tag = tagCalendaire(j.date);
      const cle = tag.debutMois ? 'debut' : (tag.finMois ? 'fin' : 'milieu');
      buckets[cle].push(j);
    });
    const calc = liste => {
      if (liste.length < SEUILS.MIN_OCCURRENCES_TENDANCE) return { disponible: false, nbJours: liste.length };
      return {
        disponible: true, nbJours: liste.length,
        moyenneCombinee: moyenne(liste.map(j => j.ventePiste + j.venteBoutique)),
        moyennePiste: moyenne(liste.map(j => j.ventePiste)),
        moyenneBoutique: moyenne(liste.map(j => j.venteBoutique)),
      };
    };
    const debut = calc(buckets.debut), fin = calc(buckets.fin), milieu = calc(buckets.milieu);
    let comparaisonDisponible = false, ecartFinVsDebut = null;
    if (debut.disponible && fin.disponible) {
      comparaisonDisponible = true;
      ecartFinVsDebut = evolution(fin.moyenneCombinee, debut.moyenneCombinee);
    }
    return { debut, milieu, fin, comparaisonDisponible, ecartFinVsDebut };
  }

  function analyserSaisonnier(joursAgreges) {
    const periodes = {};
    (joursAgreges || []).forEach(j => {
      const d = dateLocale(j.date);
      const cle = `${d.getFullYear()}-${d.getMonth()}`;
      if (!periodes[cle]) periodes[cle] = { annee: d.getFullYear(), mois: d.getMonth(), jours: [] };
      periodes[cle].jours.push(j);
    });
    const periodesArr = Object.values(periodes);
    const parMoisCalendaire = {};
    periodesArr.forEach(p => { (parMoisCalendaire[p.mois] = parMoisCalendaire[p.mois] || []).push(p); });

    const moisAnalyse = Object.keys(parMoisCalendaire).map(moisStr => {
      const mois = Number(moisStr);
      const periodesDuMois = parMoisCalendaire[mois];
      const moyennesPeriode = periodesDuMois.map(p => moyenne(p.jours.map(j => j.ventePiste + j.venteBoutique)));
      return {
        mois, nomMois: NOM_MOIS[mois],
        nbPeriodesObservees: periodesDuMois.length,
        disponible: periodesDuMois.length >= SEUILS.MIN_OCCURRENCES_SAISON,
        moyenneCombinee: moyenne(moyennesPeriode),
      };
    }).sort((a, b) => a.mois - b.mois);

    const moisDisponibles = moisAnalyse.filter(m => m.disponible);
    return {
      disponible: moisDisponibles.length > 0,
      nbPeriodesTotal: periodesArr.length,
      moisAnalyse,
      message: moisDisponibles.length > 0 ? null : "Analyse saisonnière en apprentissage. Les tendances apparaîtront automatiquement lorsque suffisamment d'historique sera disponible.",
    };
  }

  // ------------------------------------------------------------
  // 10) Niveau 4 — Rythmes cachés. Trois détecteurs génériques,
  //     aucune règle codée en dur sur "quel jour/quelle personne est
  //     bonne" : chaque détecteur applique le même seuil
  //     (SEUILS.MIN_OCCURRENCES_DECOUVERTE) à des données réelles et
  //     ne produit de résultat que si le motif est statistiquement
  //     soutenu (régularité + volume d'observations).
  // ------------------------------------------------------------
  function detecterJourExtremeStable(classement) {
    const decouvertes = [];
    const nbRanges = classement.filter(a => a.occurrences.length > 0).length;
    classement.filter(a => a.occurrences.length >= SEUILS.MIN_OCCURRENCES_DECOUVERTE).forEach(a => {
      if (a.rang !== 1 && a.rang !== nbRanges) return;
      if (a.coefficientVariation === null || a.coefficientVariation > SEUILS.VARIABILITE_IRREGULIERE) return;
      const positionForte = a.rang === 1;
      decouvertes.push({
        titre: positionForte
          ? `Les ${a.nom}s restent systématiquement la journée la plus performante.`
          : `Les ${a.nom}s restent systématiquement la journée la plus faible.`,
        impact: positionForte ? 'Fort' : 'Modéré',
        source: 'Historique des audits de caisse',
        nbObservations: a.occurrences.length,
        variabilite: a.coefficientVariation,
        historiqueLabel: `${a.occurrences.length} occurrences observées`,
      });
    });
    return decouvertes;
  }

  function detecterProgressionConsecutive(classement) {
    const decouvertes = [];
    classement.forEach(a => {
      const occ = a.occurrences;
      if (occ.length < SEUILS.MIN_OCCURRENCES_DECOUVERTE) return;
      let streak = 0;
      for (let i = occ.length - 1; i > 0; i--) {
        const actuel = occ[i].ventePiste + occ[i].venteBoutique;
        const precedent = occ[i - 1].ventePiste + occ[i - 1].venteBoutique;
        if (actuel > precedent) streak++; else break;
      }
      if (streak >= SEUILS.MIN_OCCURRENCES_DECOUVERTE - 1) {
        decouvertes.push({
          titre: `Les ${a.nom}s progressent depuis ${streak} occurrence${streak > 1 ? 's' : ''} consécutive${streak > 1 ? 's' : ''}.`,
          impact: streak >= SEUILS.MIN_OCCURRENCES_DECOUVERTE ? 'Fort' : 'Modéré',
          source: 'Historique des audits de caisse',
          nbObservations: occ.length,
          variabilite: a.coefficientVariation,
          historiqueLabel: `${occ.length} occurrences observées, ${streak} en progression continue`,
        });
      }
    });
    return decouvertes;
  }

  function analyserEquipeParJour(joursAgreges, employesParId) {
    const parEmploye = {};
    (joursAgreges || []).forEach(jour => {
      jour.quarts.forEach(q => {
        q.employesPiste.forEach(empId => {
          const cle = empId + '|piste';
          if (!parEmploye[cle]) parEmploye[cle] = { employeeId: empId, role: 'piste', global: [], parJour: {} };
          parEmploye[cle].global.push(q.ventePiste);
          (parEmploye[cle].parJour[jour.jourSemaine] = parEmploye[cle].parJour[jour.jourSemaine] || []).push(q.ventePiste);
        });
        q.employesBoutique.forEach(empId => {
          const cle = empId + '|boutique';
          if (!parEmploye[cle]) parEmploye[cle] = { employeeId: empId, role: 'boutique', global: [], parJour: {} };
          parEmploye[cle].global.push(q.venteBoutique);
          (parEmploye[cle].parJour[jour.jourSemaine] = parEmploye[cle].parJour[jour.jourSemaine] || []).push(q.venteBoutique);
        });
      });
    });
    const resultats = [];
    Object.values(parEmploye).forEach(e => {
      const moyenneGlobale = moyenne(e.global);
      Object.keys(e.parJour).forEach(jourStr => {
        const valeurs = e.parJour[jourStr];
        if (valeurs.length < SEUILS.CONFIANCE_MOYENNE) return;
        const ecart = evolution(moyenne(valeurs), moyenneGlobale);
        if (ecart === null) return;
        resultats.push({
          employeeId: e.employeeId, role: e.role, jourSemaine: Number(jourStr),
          nom: (employesParId && employesParId[e.employeeId] && employesParId[e.employeeId].nom) || 'Employé inconnu',
          nbQuarts: valeurs.length, ecart,
        });
      });
    });
    return resultats;
  }

  function detecterContexteEquipe(joursAgreges, employesParId) {
    return analyserEquipeParJour(joursAgreges, employesParId)
      .filter(a => a.nbQuarts >= SEUILS.CONFIANCE_FORTE && a.ecart >= 0.15)
      .map(a => ({
        titre: `${a.nom} obtient de meilleurs résultats ${a.role === 'piste' ? 'en piste' : 'en boutique'} le ${NOM_JOURS[a.jourSemaine]} (contribution observée dans ce contexte).`,
        impact: 'Modéré',
        source: 'Croisement audits de caisse × équipe',
        nbObservations: a.nbQuarts,
        variabilite: null,
        historiqueLabel: `${a.nbQuarts} quarts observés ce jour`,
      }));
  }

  function confianceDecouverte(nbObservations, variabilite) {
    const base = Math.min(60, nbObservations * 10);
    const bonusRegularite = (variabilite === null || variabilite === undefined) ? 15 : Math.max(0, (1 - Math.min(variabilite, 1)) * 35);
    const pct = Math.min(97, Math.round(base + bonusRegularite));
    let label;
    if (pct >= 90) label = 'Très forte';
    else if (pct >= 75) label = 'Forte';
    else if (pct >= 60) label = 'Moyenne';
    else if (pct >= 40) label = 'Faible';
    else label = 'Très faible';
    return { pct, label };
  }

  // NEXUS ne dit jamais "cette tendance est certaine" — seulement
  // "NEXUS a détecté une tendance", assortie d'un indice de confiance
  // qui ne dépend que du nombre d'observations et de leur régularité.
  function genererDecouvertes(classement, joursAgreges, employesParId) {
    const brutes = [
      ...detecterJourExtremeStable(classement),
      ...detecterProgressionConsecutive(classement),
      ...detecterContexteEquipe(joursAgreges, employesParId),
    ];
    if (!brutes.length) {
      return [{ disponible: false, titre: 'Aucune tendance fiable détectée.', note: 'Historique encore insuffisant.' }];
    }
    return brutes.map(d => {
      const { pct, label } = confianceDecouverte(d.nbObservations, d.variabilite);
      return { disponible: true, titre: d.titre, confiancePct: pct, confianceLabel: label, impact: d.impact, source: d.source, historiqueLabel: d.historiqueLabel };
    }).sort((a, b) => b.confiancePct - a.confiancePct);
  }

  // ------------------------------------------------------------
  // 11) Architecture — sources de données que NEXUS Tempo est déjà
  //     capable de lire, et celles prévues pour affiner sa mémoire
  //     temporelle à mesure qu'elles seront branchées. Déclarer une
  //     source ici ne l'active pas : tant qu'aucune donnée réelle
  //     n'arrive, elle reste "Prévue".
  // ------------------------------------------------------------
  const SOURCES_DONNEES = [
    { id: 'audits_caisse', nom: 'Audits de caisse (piste + boutique)', statut: 'connectee' },
    { id: 'litrage_carburant', nom: 'Litrage carburant (GO / SP95 / GNR)', statut: 'connectee' },
    { id: 'prix_carburants', nom: 'Prix carburants mensuels', statut: 'connectee' },
    { id: 'equipe', nom: 'Présence équipe (piste / boutique)', statut: 'connectee' },
    { id: 'jours_feries', nom: 'Calendrier jours fériés', statut: 'connectee' },
    { id: 'ventes_horaires', nom: 'Ventes par tranche horaire', statut: 'prevue' },
    { id: 'meteo', nom: 'Météo locale', statut: 'prevue' },
    { id: 'planning', nom: 'Planning équipe (Nexus Planning)', statut: 'prevue' },
    { id: 'promotions', nom: 'Promotions en cours', statut: 'prevue' },
    { id: 'ruptures', nom: 'Ruptures de stock (Scanner Stock)', statut: 'prevue' },
    { id: 'evenements_locaux', nom: 'Événements locaux', statut: 'prevue' },
    { id: 'trafic', nom: 'Trafic routier', statut: 'prevue' },
    { id: 'inventaires', nom: 'Inventaires (Scanner Stock)', statut: 'prevue' },
    { id: 'capital_nexus', nom: 'Impact des décisions (Capital NEXUS)', statut: 'prevue' },
    { id: 'vacances_scolaires', nom: 'Vacances scolaires (zone)', statut: 'prevue' },
    { id: 'ponts', nom: 'Ponts calendaires', statut: 'prevue' },
  ];

  window.NexusTempo = {
    SEUILS, NOM_JOURS, NOM_JOURS_COURT, NOM_MOIS, LITRAGE_INDISPONIBLE, SOURCES_DONNEES,
    agregerParJour, regrouperParJourSemaine, calculerClassement,
    identifierJoursReveles, identifierMeilleursJoursSepares, classementLitrage,
    analyserEquipe, genererDecisionPrioritaire,
    calculerMaturite, joursFeries, estJourFerie, tagCalendaire,
    analyserDebutFinMois, analyserSaisonnier, genererDecouvertes,
    dateLocale, moyenne, ecartType, evolution,
  };
})();
