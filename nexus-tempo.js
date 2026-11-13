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
    // Météo (25/07/2026) : nombre minimum de jours pluvieux ET de
    // jours secs nécessaires avant d'oser comparer les deux — croiser
    // deux sources est plus risqué qu'une simple tendance hebdo, donc
    // le seuil est volontairement prudent.
    MIN_OCCURRENCES_METEO: 3,
    // Un jour est considéré "pluvieux" à partir de ce cumul de
    // précipitations (mm/jour) — en dessous, la pluie est jugée trop
    // faible pour avoir un effet mesurable sur la fréquentation.
    SEUIL_PLUIE_MM: 1,
    // "Jour à renforcer" pour le constat Conseiller (NEXUS-App-v1.html et
    // NEXUS-Brief-v1.html) : évolution combinée en dessous de -10 % avant
    // de qualifier un jour comme suffisamment fragile pour être remonté
    // (ajouté ici le 11/08/2026, Article 11 — les deux pages avaient chacune
    // leur propre copie de cette même valeur -0.10).
    SEUIL_CONSTAT_TEMPO: -0.10,
    // Scanner Stock (25/07/2026) : nombre minimum de jours "à
    // surveiller" ET de jours "sans alerte" nécessaires avant de
    // comparer leur CA. Aujourd'hui, stock_sante_historique n'est
    // recalculé qu'occasionnellement (pas encore un cron quotidien) —
    // ce seuil protège contre une fausse lecture tant que les jours
    // disponibles ne sont pas assez nombreux ni assez réguliers.
    MIN_OCCURRENCES_STOCK: 3,
    // Vacances scolaires (25/07/2026) : nombre minimum de jours EN
    // vacances ET HORS vacances nécessaires avant de comparer leur CA.
    MIN_OCCURRENCES_VACANCES: 3,
  };

  // Coordonnées de la station (25/07/2026) — dérivées du Plus Code
  // "Q2P2+CX Sainte-Marie, Martinique" donné par Frédéric, recoupé avec
  // le centre de Sainte-Marie (source : géocodage Open-Meteo). Utilisées
  // uniquement pour interroger l'API météo Open-Meteo (gratuite, sans
  // clé) — voir NEXUS-Tempo-v1.html pour l'appel réseau lui-même,
  // volontairement gardé hors de ce fichier qui ne fait que des calculs
  // purs, jamais d'appel réseau.
  const COORDONNEES_STATION = {
    latitude: 14.7861,
    longitude: -60.9976,
    timezone: 'America/Martinique',
    lieu: 'Sainte-Marie, Martinique',
  };

  const NOM_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const LITRAGE_INDISPONIBLE = "Litrage non calculable pour l'instant — aucun audit de caisse n'a encore été saisi avec le détail par carburant (gazole / SP95 / GNR) introduit le 25/07/2026 dans Nexus Verify. Dès le premier audit saisi avec ce détail, cette section affichera le litrage réel par jour de semaine.";

  // Jour le plus rentable (26/07/2026, demande de Frédéric) : "jour
  // moteur" se base sur le CA boutique brut, ce qui peut être trompeur
  // — une forte journée de cartes prépayées/téléphonie/gaz/tabac génère
  // beaucoup de CA mais très peu de valeur réelle pour la station (voir
  // nexus-marge.js, qui exclut déjà ces "produits d'appel" de toute
  // comparaison de marge). Plutôt que d'imposer une nouvelle saisie
  // manuelle quotidienne (rejeté par Frédéric le 26/07/2026 : "nexus
  // doit simplifier le travail du manager pas le compliquer"), NEXUS
  // Tempo croise deux données qui existent déjà sans effort
  // supplémentaire :
  //   - la part de CA "produits d'appel" de chaque période d'import
  //     products (Rayon/Cockpit/Produits/Marge+, déjà fait tous les
  //     15 jours environ) ;
  //   - le CA boutique quotidien déjà saisi par Nexus Verify.
  // Le résultat (venteBoutiqueValorisee) est une ESTIMATION explicitement
  // nommée comme telle, jamais présentée comme une marge réelle mesurée
  // jour par jour — même principe que "Rotation réelle" ailleurs dans
  // NEXUS. Un jour dont la date ne tombe dans aucune période importée
  // reste explicitement "non calculable", jamais complété par une
  // estimation approximative (Article 5).
  const VALORISATION_INDISPONIBLE = "Jour le plus rentable non calculable pour l'instant — NEXUS a besoin qu'au moins une période d'import de produits (Rayon, Cockpit, Produits ou Marge+) recouvre des jours déjà audités par Nexus Verify. Dès qu'un import et des audits se recoupent, cette estimation s'affichera.";

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
  // 1bis) Jours "clos" vs jour en cours (25/07/2026, demande de
  // Frédéric — éviter toute incohérence apparente entre le Conseiller
  // et la jauge de maturité). Trois notions distinctes doivent
  // toujours être nommées séparément dans NEXUS Tempo :
  //   - jours enregistrés  : agregerParJour(...).length — tout audit
  //     saisi, y compris celui d'aujourd'hui, même en cours ;
  //   - jours exploitables : le sous-ensemble de jours enregistrés
  //     dont la date est strictement antérieure à aujourd'hui — le
  //     jour courant n'est jamais compté comme "clos" tant que la
  //     journée n'est pas terminée, même si un audit a déjà été saisi ;
  //   - jours inclus dans l'analyse : les jours exploitables
  //     effectivement utilisés par calculerClassement (aujourd'hui,
  //     les deux coïncident — aucun filtre supplémentaire n'existe
  //     encore).
  // Toute la mémoire temporelle (maturité, confiance globale,
  // décision, saisonnier, découvertes) doit être calculée à partir
  // des jours exploitables, jamais des jours enregistrés bruts.
  // ------------------------------------------------------------
  function aujourdHuiISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function filtrerJoursClos(joursAgreges) {
    const aujourdhui = aujourdHuiISO();
    return (joursAgreges || []).filter(j => j.date < aujourdhui);
  }

  // ------------------------------------------------------------
  // 1ter) Jour le plus rentable (26/07/2026) — voir le commentaire de
  //    VALORISATION_INDISPONIBLE ci-dessus pour le principe complet.
  //
  //    calculerPeriodesProduitsAppel : regroupe les lignes `products`
  //    (déjà chargées pour d'autres écrans — Rayon/Cockpit/Produits/
  //    Marge+) par période d'import, et calcule pour chacune la part du
  //    CA venant de familles "produits d'appel". `estProduitAppelFn`
  //    est injectée depuis la page (et non importée en dur ici) pour
  //    que ce fichier reste indépendant de nexus-marge.js, exactement
  //    comme employesParId ou meteoParDate sont déjà injectés ailleurs
  //    dans ce fichier plutôt que chargés directement.
  // ------------------------------------------------------------
  function calculerPeriodesProduitsAppel(rowsProducts, estProduitAppelFn) {
    const parPeriode = {};
    (rowsProducts || []).forEach(r => {
      if (!(Number(r.ca) > 0)) return; // CA non exploitable pour un ratio
      const cle = `${r.periode_debut}|${r.periode_fin}`;
      if (!parPeriode[cle]) parPeriode[cle] = { periodeDebut: r.periode_debut, periodeFin: r.periode_fin, caTotal: 0, caProduitsAppel: 0 };
      const p = parPeriode[cle];
      const ca = Number(r.ca) || 0;
      p.caTotal += ca;
      if (estProduitAppelFn && estProduitAppelFn(r.categorie, r.article)) p.caProduitsAppel += ca;
    });
    return Object.values(parPeriode)
      .map(p => ({ ...p, partProduitsAppel: p.caTotal > 0 ? p.caProduitsAppel / p.caTotal : 0 }))
      .sort((a, b) => a.periodeDebut < b.periodeDebut ? -1 : 1);
  }

  // Attribue à chaque jour agrégé une estimation de CA boutique
  // "valorisé" (hors produits d'appel), à partir de la période
  // d'import qui recouvre sa date. Si plusieurs périodes se chevauchent
  // (import corrigé après coup), on retient celle dont la période a
  // débuté le plus récemment — le reflet le plus à jour de ce qui a été
  // réellement vendu à cette date. Un jour hors de toute période
  // importée reste honnêtement non calculable (valorisationDisponible:
  // false), jamais comblé par une estimation approximative.
  function attribuerValorisationBoutique(joursAgreges, periodesProduitsAppel) {
    const periodes = periodesProduitsAppel || [];
    return (joursAgreges || []).map(j => {
      const periode = periodes
        .filter(p => p.periodeDebut <= j.date && (!p.periodeFin || j.date <= p.periodeFin))
        .sort((a, b) => a.periodeDebut < b.periodeDebut ? 1 : -1)[0];
      if (!periode) {
        return { ...j, valorisationDisponible: false, venteBoutiqueValorisee: null, partProduitsAppelPeriode: null };
      }
      return {
        ...j,
        valorisationDisponible: true,
        venteBoutiqueValorisee: j.venteBoutique * (1 - periode.partProduitsAppel),
        partProduitsAppelPeriode: periode.partProduitsAppel,
      };
    });
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
          litrageMoyenGazole: null, litrageMoyenSp95: null, litrageMoyenGnr: null, litrageMoyenTotal: null, nbOccLitrage: 0,
          moyennePisteValorisation: null, moyenneBoutiqueValorisee: null, moyenneCombineeValorisee: null, nbOccValorisation: 0 };
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

      // Jour le plus rentable (26/07/2026) : moyenne calculée uniquement
      // sur le sous-ensemble d'occurrences dont la date recoupe une
      // période d'import products (voir attribuerValorisationBoutique)
      // — même logique de prudence que le litrage ci-dessus, jamais de
      // moyenne mélangeant des jours valorisés et non valorisés.
      const occValorisation = occ.filter(o => o.valorisationDisponible);
      const moyennePisteValorisation = occValorisation.length ? moyenne(occValorisation.map(o => o.ventePiste)) : null;
      const moyenneBoutiqueValorisee = occValorisation.length ? moyenne(occValorisation.map(o => o.venteBoutiqueValorisee)) : null;
      const moyenneCombineeValorisee = occValorisation.length ? (moyennePisteValorisation + moyenneBoutiqueValorisee) : null;

      return { ...bucket, moyennePiste, moyenneBoutique, moyenneCombinee, derniere,
        evolutionPiste, evolutionBoutique, evolutionCombinee, coefficientVariation, confianceTendance,
        litrageMoyenGazole, litrageMoyenSp95, litrageMoyenGnr, litrageMoyenTotal, nbOccLitrage: occLitrage.length,
        moyennePisteValorisation, moyenneBoutiqueValorisee, moyenneCombineeValorisee, nbOccValorisation: occValorisation.length };
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
  // 4quater) Jour le plus rentable (26/07/2026) — classement séparé basé
  //    sur le CA valorisé (piste inchangé + boutique hors produits
  //    d'appel), calculé UNIQUEMENT parmi les jours de semaine disposant
  //    d'au moins une occurrence valorisable. Volontairement distinct de
  //    "Jour moteur" (CA brut) : les deux peuvent diverger, c'est
  //    précisément ce que Frédéric a demandé de révéler. Retourne null
  //    tant qu'aucun jour n'est valorisable (voir VALORISATION_INDISPONIBLE).
  // ------------------------------------------------------------
  function identifierJourPlusRentable(classement) {
    const disponibles = (classement || []).filter(a => a.nbOccValorisation > 0);
    if (!disponibles.length) return null;
    const trie = [...disponibles].sort((a, b) => b.moyenneCombineeValorisee - a.moyenneCombineeValorisee);
    trie.forEach((a, i) => { a.rangValorise = i + 1; });
    return trie[0];
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
  //
  //    Mise à jour du 26/07/2026 (demande de Frédéric) : pour la piste,
  //    le litrage est une mesure plus juste que le CA — le CA piste
  //    dépend du prix de vente du carburant (qui varie chaque mois,
  //    hors du contrôle du pompiste), alors que le litrage reflète le
  //    volume réellement servi. On calcule donc, en plus du CA, une
  //    moyenne de litrage par quart pour chaque pompiste — uniquement
  //    sur les quarts saisis avec le détail par carburant (même
  //    prudence que classementLitrage/nbOccLitrage plus haut : jamais de
  //    moyenne mélangeant des quarts avec et sans détail).
  // ------------------------------------------------------------
  function analyserEquipe(joursAgreges, employesParId) {
    const parEmploye = {}; // employeeId|role -> { employeeId, role, valeurs: [], ecarts: [], litrages: [] }
    (joursAgreges || []).forEach(jour => {
      jour.quarts.forEach(q => {
        q.employesPiste.forEach(empId => {
          const cle = empId + '|piste';
          if (!parEmploye[cle]) parEmploye[cle] = { employeeId: empId, role: 'piste', valeurs: [], ecarts: [], litrages: [] };
          parEmploye[cle].valeurs.push(q.ventePiste);
          parEmploye[cle].ecarts.push(q.ecartPiste);
          if (q.litrageDisponible) {
            parEmploye[cle].litrages.push((Number(q.litrageGazole) || 0) + (Number(q.litrageSp95) || 0) + (Number(q.litrageGnr) || 0));
          }
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
      const litrages = e.litrages || [];
      return {
        employeeId: e.employeeId,
        nom: (employesParId && employesParId[e.employeeId] && employesParId[e.employeeId].nom) || 'Employé inconnu',
        role: e.role,
        nbQuarts: nb,
        moyenneVente: moyenne(e.valeurs),
        moyenneEcart: moyenne(e.ecarts),
        moyenneLitrage: litrages.length ? moyenne(litrages) : null,
        nbQuartsLitrage: litrages.length,
        confiance,
      };
    }).sort((a, b) => {
      // Piste classée par litrage moyen quand il est disponible pour les
      // deux (mesure la plus juste) ; boutique et repli piste restent
      // classés par CA moyen.
      if (a.role === 'piste' && b.role === 'piste') {
        const va = a.moyenneLitrage !== null ? a.moyenneLitrage : -Infinity;
        const vb = b.moyenneLitrage !== null ? b.moyenneLitrage : -Infinity;
        return vb - va;
      }
      return b.moyenneVente - a.moyenneVente;
    });
  }

  // ------------------------------------------------------------
  // 6) Décision NEXUS — une seule priorité, seulement si
  //    l'historique global est assez long pour la justifier.
  // ------------------------------------------------------------
  function genererDecisionPrioritaire(joursAgreges, classement) {
    const nbJoursTotal = (joursAgreges || []).length;
    if (nbJoursTotal < SEUILS.MIN_JOURS_DECISION) {
      const joursRestants = SEUILS.MIN_JOURS_DECISION - nbJoursTotal;
      return {
        disponible: false,
        message: `Encore ${joursRestants} jour${joursRestants > 1 ? 's' : ''} d'historique ${joursRestants > 1 ? 'sont nécessaires' : 'est nécessaire'} avant que Tempo puisse détecter des tendances fiables. Continuez simplement vos audits quotidiens : chaque journée renforce la précision de NEXUS.`,
      };
    }
    const { jourARenforcer } = identifierJoursReveles(classement);
    if (!jourARenforcer) {
      return { disponible: false, message: "Aucun jour ne se distingue suffisamment pour justifier une priorité aujourd'hui." };
    }
    return {
      disponible: true,
      jour: jourARenforcer,
      message: `Concentrer votre attention sur le ${jourARenforcer.nom} : c'est votre principale opportunité d'amélioration sur la période observée (CA piste + boutique moyen de ${Math.round(jourARenforcer.moyenneCombinee).toLocaleString('fr-FR')} €${jourARenforcer.evolutionCombinee !== null ? `, ${jourARenforcer.evolutionCombinee >= 0 ? '+' : ''}${(jourARenforcer.evolutionCombinee * 100).toFixed(1).replace('.', ',')} % sur la dernière occurrence` : ''}).`,
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
      return { niveau: 1, emoji: '🟥', label: 'Découverte', joursHistorique: 0, seuilPrecedent: 0, seuilSuivant: SEUILS.MATURITE_NIVEAU2_JOURS, joursRestants: SEUILS.MATURITE_NIVEAU2_JOURS };
    }
    const premiereDate = dateLocale(joursAgreges[0].date);
    const joursHistorique = Math.max(0, Math.floor((new Date() - premiereDate) / 86400000));
    let niveau, emoji, label, seuilPrecedent, seuilSuivant;
    if (joursHistorique >= SEUILS.MATURITE_NIVEAU4_JOURS) { niveau = 4; emoji = '💎'; label = 'Intelligence'; seuilPrecedent = SEUILS.MATURITE_NIVEAU4_JOURS; seuilSuivant = null; }
    else if (joursHistorique >= SEUILS.MATURITE_NIVEAU3_JOURS) { niveau = 3; emoji = '🟩'; label = 'Confiance'; seuilPrecedent = SEUILS.MATURITE_NIVEAU3_JOURS; seuilSuivant = SEUILS.MATURITE_NIVEAU4_JOURS; }
    else if (joursHistorique >= SEUILS.MATURITE_NIVEAU2_JOURS) { niveau = 2; emoji = '🟨'; label = 'Apprentissage'; seuilPrecedent = SEUILS.MATURITE_NIVEAU2_JOURS; seuilSuivant = SEUILS.MATURITE_NIVEAU3_JOURS; }
    else { niveau = 1; emoji = '🟥'; label = 'Découverte'; seuilPrecedent = 0; seuilSuivant = SEUILS.MATURITE_NIVEAU2_JOURS; }
    return { niveau, emoji, label, joursHistorique, seuilPrecedent, seuilSuivant, joursRestants: seuilSuivant !== null ? seuilSuivant - joursHistorique : 0 };
  }

  // ------------------------------------------------------------
  // 7bis) Confiance Tempo — indice global unique (0-100 %), pensé pour
  // que le manager comprenne d'un coup d'œil "les informations
  // existent, mais restent prudentes" (25/07/2026, demande de
  // Frédéric). Il combine quatre signaux objectifs, jamais un
  // jugement qualitatif :
  //   - l'ancienneté réelle de l'historique (jusqu'à 50 pts, complet
  //     au seuil du Niveau 4) ;
  //   - le volume de jours effectivement enregistrés, indépendamment
  //     des trous de calendrier (jusqu'à 25 pts, complet au seuil de
  //     décision) ;
  //   - la couverture des 7 jours de semaine par au moins une
  //     occurrence (jusqu'à 15 pts) ;
  //   - la part de jours de semaine où une évolution est déjà
  //     calculable, càd au moins 2 occurrences (jusqu'à 10 pts).
  // ------------------------------------------------------------
  function composantesConfiance(joursAgreges, classement, premierJour) {
    const nbJours = (joursAgreges || []).length;
    const observes = (classement || []).filter(a => a.occurrences.length > 0);
    const nbJoursSemaineCouverts = observes.length;
    const nbAvecTendance = observes.filter(a => a.confianceTendance).length;
    // Ancienneté : depuis le premier jour de données de l'activité, même s'il précède la fenêtre lue.
    const debutAnciennete = premierJour && joursAgreges && joursAgreges.length && premierJour < joursAgreges[0].date ? [{ date: premierJour }] : joursAgreges;
    const joursHistorique = calculerMaturite(debutAnciennete).joursHistorique;
    return {
      anciennete: Math.min(50, (joursHistorique / SEUILS.MATURITE_NIVEAU4_JOURS) * 50),
      volume: Math.min(25, (nbJours / SEUILS.MIN_JOURS_DECISION) * 25),
      couverture: (nbJoursSemaineCouverts / 7) * 15,
      tendances: (nbAvecTendance / 7) * 10,
      joursHistorique, nbJours, nbJoursSemaineCouverts, nbAvecTendance
    };
  }

  function calculerConfianceGlobale(joursAgreges, classement) {
    const c = composantesConfiance(joursAgreges, classement);
    return Math.max(0, Math.min(100, Math.round(c.anciennete + c.volume + c.couverture + c.tendances)));
  }

  // Confiance d'une activité (12/11/2026) : mêmes seuils et mêmes poids que
  // la page V1, appliqués aux seuls jours complets de l'activité. Une
  // activité sans date par jour (la boutique) n'a pas de niveau calculable.
  // jours : [{ date: 'YYYY-MM-DD', valeur }].
  function confianceActivite(jours, premierJour) {
    const tries = (jours || []).filter(j => j && j.date).slice().sort((a, b) => a.date < b.date ? -1 : 1)
      .map(j => ({ date: j.date, jourSemaine: dateLocale(j.date).getDay(), ventePiste: Number(j.valeur) || 0, venteBoutique: 0 }));
    const classement = calculerClassement(regrouperParJourSemaine(tries));
    const debut = premierJour && tries.length && premierJour < tries[0].date ? [{ date: premierJour }] : tries;
    const m = calculerMaturite(debut);
    const c = composantesConfiance(tries, classement, premierJour);
    return {
      niveau: m.niveau, label: m.label, joursHistorique: m.joursHistorique, joursRestants: m.joursRestants, seuilSuivant: m.seuilSuivant, seuilPrecedent: m.seuilPrecedent,
      pct: Math.max(0, Math.min(100, Math.round(c.anciennete + c.volume + c.couverture + c.tendances))),
      composantes: [
        { nom: 'Ancienneté', points: Math.round(c.anciennete), max: 50, detail: c.joursHistorique + ' jours d\u2019historique' },
        { nom: 'Volume', points: Math.round(c.volume), max: 25, detail: c.nbJours + ' jours complets' },
        { nom: 'Couverture', points: Math.round(c.couverture), max: 15, detail: c.nbJoursSemaineCouverts + ' jours de la semaine sur 7' },
        { nom: 'Tendances', points: Math.round(c.tendances), max: 10, detail: c.nbAvecTendance + ' jours de la semaine avec au moins ' + SEUILS.MIN_OCCURRENCES_TENDANCE + ' mesures' }
      ]
    };
  }

  // ------------------------------------------------------------
  // 8) Calendrier français — jours fériés (fixes + mobiles via le
  //    calcul de Pâques). Ce sont des faits de calendrier, pas des
  //    données inventées : ils peuvent donc être calculés d'avance,
  //    contrairement aux vacances scolaires (zone-dépendantes) ou aux
  //    ponts/événements locaux, volontairement laissés en "Prévue"
  //    dans SOURCES_DONNEES tant qu'ils ne sont pas branchés.
  // ------------------------------------------------------------
  // Le calcul vit dans nexus-jours-feries.js (partagé avec Paye) : un seul endroit.
  // Repli sans exception : une page qui oublie le module n'affiche aucun férié (et le dit en console).
  const JF = (function () {
    if (typeof NexusJoursFeries !== 'undefined') return NexusJoursFeries;
    try { if (typeof require === 'function') return require('./nexus-jours-feries.js'); } catch (e) {}
    if (typeof console !== 'undefined') console.error('nexus-jours-feries.js non chargé : fériés indisponibles');
    return { datePaques: () => null, joursFeries: () => [], estJourFerie: () => false, joursFeriesMartinique: () => [], estJourFerieMartinique: () => false };
  })();
  const { datePaques, joursFeries, estJourFerie, joursFeriesMartinique, estJourFerieMartinique } = JF;

  // ------------------------------------------------------------
  // Ponts calendaires (25/07/2026) — un jour férié tombant un mardi
  // "fait le pont" avec le lundi précédent, un jeudi avec le vendredi
  // suivant. Calcul purement algorithmique à partir des jours fériés
  // Martinique — valable pour n'importe quelle année, y compris 2027.
  // Un férié tombant un autre jour (dont le samedi/dimanche) ne crée
  // pas de pont au sens usuel du terme.
  // ------------------------------------------------------------
  function identifierPonts(annee) {
    const ponts = [];
    joursFeriesMartinique(annee).forEach(f => {
      const d = dateLocale(f.date);
      const jourSemaine = d.getDay();
      if (jourSemaine === 2) {
        const veille = new Date(d.getTime() - 86400000);
        ponts.push({ date: veille.toISOString().slice(0, 10), nom: `Pont — veille de ${f.nom}` });
      } else if (jourSemaine === 4) {
        const lendemain = new Date(d.getTime() + 86400000);
        ponts.push({ date: lendemain.toISOString().slice(0, 10), nom: `Pont — lendemain de ${f.nom}` });
      }
    });
    return ponts.sort((a, b) => a.date < b.date ? -1 : 1);
  }

  function estPont(dateStr) {
    const annee = Number(dateStr.slice(0, 4));
    const trouve = identifierPonts(annee).find(p => p.date === dateStr);
    return { pont: !!trouve, nom: trouve ? trouve.nom : null };
  }

  // ------------------------------------------------------------
  // Vacances scolaires Martinique (25/07/2026) — dates officielles
  // publiées par l'académie de Martinique (ac-martinique.fr, arrêtés
  // du calendrier scolaire 2025-2026 et 2026-2027). Liste figée : on
  // n'y ajoute une période que lorsqu'elle a été officiellement
  // publiée — jamais une date estimée. L'été 2027 n'a pas encore de
  // date de fin publiée (arrêté 2027-2028 pas encore paru) : "fin:
  // null" le signale explicitement plutôt que d'inventer une date de
  // rentrée.
  // ------------------------------------------------------------
  const VACANCES_SCOLAIRES_MARTINIQUE = [
    { nom: 'Vacances de Toussaint', debut: '2025-10-18', fin: '2025-11-03' },
    { nom: 'Vacances de Noël', debut: '2025-12-20', fin: '2026-01-05' },
    { nom: 'Vacances de Carnaval', debut: '2026-02-07', fin: '2026-02-23' },
    { nom: 'Vacances de Pâques', debut: '2026-04-02', fin: '2026-04-20' },
    { nom: 'Grandes vacances (été 2026)', debut: '2026-07-04', fin: '2026-08-31' },
    { nom: 'Vacances de Toussaint', debut: '2026-10-20', fin: '2026-11-03' },
    { nom: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-04' },
    { nom: 'Vacances de Carnaval', debut: '2027-02-06', fin: '2027-02-22' },
    { nom: 'Fêtes pascales', debut: '2027-03-24', fin: '2027-04-01' },
    { nom: 'Vacances de Pâques', debut: '2027-04-20', fin: '2027-05-03' },
    { nom: 'Grandes vacances (été 2027)', debut: '2027-07-03', fin: null },
  ];

  // 10/11/2026 — Calendrier du site : quand l'appelant injecte les lignes `type='vacances'` de
  // inventaire_calendrier_site (une ligne par jour : { date, libelle }), elles font foi ; la liste
  // figée ci-dessus ne sert plus que de repli tant que rien n'a été injecté (ou si la table est vide).
  // Aucun accès réseau ici : Tempo reste un module de calcul.
  let vacancesDuSite = null;
  function definirVacances(lignes) {
    if (!Array.isArray(lignes)) { vacancesDuSite = null; return 0; }
    const m = new Map();
    lignes.forEach(l => { if (l && l.date && (l.type == null || l.type === 'vacances')) m.set(String(l.date).slice(0, 10), l.libelle || 'Vacances scolaires'); });
    vacancesDuSite = m.size ? m : null;
    return m.size;
  }

  function estVacancesScolaires(dateStr) {
    if (vacancesDuSite) {
      const nom = vacancesDuSite.get(dateStr);
      return { vacances: nom !== undefined, nom: nom !== undefined ? nom : null };
    }
    const trouve = VACANCES_SCOLAIRES_MARTINIQUE.find(v => dateStr >= v.debut && (v.fin === null || dateStr <= v.fin));
    return { vacances: !!trouve, nom: trouve ? trouve.nom : null };
  }

  function tagCalendaire(dateStr) {
    const d = dateLocale(dateStr);
    const annee = d.getFullYear(), mois = d.getMonth(), jourMois = d.getDate();
    const dernierJourDuMois = new Date(annee, mois + 1, 0).getDate();
    const ferie = estJourFerie(dateStr);
    const feriemq = estJourFerieMartinique(dateStr);
    const pont = estPont(dateStr);
    const vacances = estVacancesScolaires(dateStr);
    return {
      annee, mois, nomMois: NOM_MOIS[mois], jourMois, dernierJourDuMois,
      debutMois: jourMois <= 5,
      finMois: jourMois >= dernierJourDuMois - 4,
      ferie: ferie.ferie, nomFerie: ferie.nom,
      ferieMartinique: feriemq.ferie, nomFerieMartinique: feriemq.nom,
      pont: pont.pont, nomPont: pont.nom,
      vacancesScolaires: vacances.vacances, nomVacances: vacances.nom,
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
  // 9bis) Vacances scolaires & ponts (25/07/2026) — dates officielles
  // (voir VACANCES_SCOLAIRES_MARTINIQUE) plutôt que devinées. Les
  // ponts sont trop rares dans l'année pour une comparaison
  // statistique fiable (2 à 6 par an) : on se contente de les lister
  // comme repère, sans jamais affirmer un effet chiffré dessus. Les
  // vacances scolaires, en revanche, couvrent assez de jours pour une
  // vraie comparaison une fois le seuil atteint.
  // ------------------------------------------------------------
  function analyserVacancesScolaires(joursAgreges) {
    const tagues = (joursAgreges || []).map(j => ({ ...j, ...tagCalendaire(j.date) }));
    const vacances = tagues.filter(j => j.vacancesScolaires);
    const horsVacances = tagues.filter(j => !j.vacancesScolaires);
    if (vacances.length < SEUILS.MIN_OCCURRENCES_VACANCES || horsVacances.length < SEUILS.MIN_OCCURRENCES_VACANCES) {
      return { disponible: false, message: `Corrélation vacances scolaires non encore mesurable — il faut au moins ${SEUILS.MIN_OCCURRENCES_VACANCES} jours en vacances et ${SEUILS.MIN_OCCURRENCES_VACANCES} jours hors vacances à comparer (actuellement ${vacances.length} en vacances, ${horsVacances.length} hors vacances).` };
    }
    const calc = liste => ({
      nbJours: liste.length,
      moyennePiste: moyenne(liste.map(j => j.ventePiste)),
      moyenneBoutique: moyenne(liste.map(j => j.venteBoutique)),
    });
    const joursVacances = calc(vacances);
    const joursHorsVacances = calc(horsVacances);
    return {
      disponible: true,
      joursVacances, joursHorsVacances,
      ecartPiste: evolution(joursVacances.moyennePiste, joursHorsVacances.moyennePiste),
      ecartBoutique: evolution(joursVacances.moyenneBoutique, joursHorsVacances.moyenneBoutique),
    };
  }

  function prochainsPonts(depuisDateStr, nbMax) {
    const depuis = depuisDateStr || aujourdHuiISO();
    const annees = [Number(depuis.slice(0, 4)), Number(depuis.slice(0, 4)) + 1];
    const tous = annees.flatMap(a => identifierPonts(a)).filter(p => p.date >= depuis);
    return tous.slice(0, nbMax || 6);
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
          : `Les ${a.nom}s représentent systématiquement la principale marge de progression.`,
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

  // ------------------------------------------------------------
  // Météo (25/07/2026) — première source externe réellement branchée
  // (Open-Meteo, gratuite, sans clé). croiserMeteo/analyserMeteo sont
  // des fonctions pures : l'appel réseau lui-même vit dans
  // NEXUS-Tempo-v1.html (ce fichier ne fait jamais d'I/O). Un jour sans
  // correspondance météo (API indisponible ou donnée pas encore
  // publiée par le modèle de réanalyse) est explicitement exclu de la
  // comparaison plutôt que traité comme "sec" par défaut.
  // ------------------------------------------------------------
  function croiserMeteo(joursAgreges, meteoParDate) {
    return (joursAgreges || []).map(j => {
      const m = meteoParDate ? meteoParDate[j.date] : null;
      if (!m || m.precipitationMm === null || m.precipitationMm === undefined) {
        return { ...j, meteoDisponible: false, pluvieux: null, precipitationMm: null, tempMax: null, tempMin: null };
      }
      return { ...j, meteoDisponible: true, pluvieux: m.precipitationMm >= SEUILS.SEUIL_PLUIE_MM, precipitationMm: m.precipitationMm, tempMax: m.tempMax, tempMin: m.tempMin };
    });
  }

  function analyserMeteo(joursAvecMeteo) {
    const avecMeteo = (joursAvecMeteo || []).filter(j => j.meteoDisponible);
    if (!avecMeteo.length) {
      return { disponible: false, message: "Météo indisponible pour l'instant — nouvelle tentative au prochain chargement de la page." };
    }
    const pluie = avecMeteo.filter(j => j.pluvieux);
    const sec = avecMeteo.filter(j => !j.pluvieux);
    if (pluie.length < SEUILS.MIN_OCCURRENCES_METEO || sec.length < SEUILS.MIN_OCCURRENCES_METEO) {
      return { disponible: false, message: `Corrélation météo non encore mesurable — il faut au moins ${SEUILS.MIN_OCCURRENCES_METEO} jours pluvieux et ${SEUILS.MIN_OCCURRENCES_METEO} jours secs à comparer (actuellement ${pluie.length} pluvieux, ${sec.length} sec${sec.length > 1 ? 's' : ''}).` };
    }
    const calc = liste => ({
      nbJours: liste.length,
      moyennePiste: moyenne(liste.map(j => j.ventePiste)),
      moyenneBoutique: moyenne(liste.map(j => j.venteBoutique)),
    });
    const joursPluie = calc(pluie);
    const joursSecs = calc(sec);
    return {
      disponible: true,
      joursPluie, joursSecs,
      ecartPiste: evolution(joursPluie.moyennePiste, joursSecs.moyennePiste),
      ecartBoutique: evolution(joursPluie.moyenneBoutique, joursSecs.moyenneBoutique),
    };
  }

  function detecterCorrelationMeteo(joursAvecMeteo) {
    if (!joursAvecMeteo || !joursAvecMeteo.length) return [];
    const avecMeteo = joursAvecMeteo.filter(j => j.meteoDisponible);
    const pluie = avecMeteo.filter(j => j.pluvieux);
    const sec = avecMeteo.filter(j => !j.pluvieux);
    if (pluie.length < SEUILS.MIN_OCCURRENCES_METEO || sec.length < SEUILS.MIN_OCCURRENCES_METEO) return [];

    const decouvertes = [];
    [['venteBoutique', 'la boutique'], ['ventePiste', 'la piste']].forEach(([champ, libelle]) => {
      const moyPluie = moyenne(pluie.map(j => j[champ]));
      const moySec = moyenne(sec.map(j => j[champ]));
      const ecart = evolution(moyPluie, moySec);
      if (ecart !== null && Math.abs(ecart) >= 0.15) {
        const pct = `${ecart >= 0 ? '+' : ''}${(ecart * 100).toFixed(1).replace('.', ',')} %`;
        decouvertes.push({
          titre: `Les jours de pluie, ${libelle} vend ${ecart >= 0 ? 'plus' : 'moins'} (${pct}) que les jours secs.`,
          impact: 'Modéré',
          source: 'Croisement audits de caisse × météo (Open-Meteo)',
          nbObservations: Math.min(pluie.length, sec.length),
          variabilite: null,
          historiqueLabel: `${pluie.length} jour${pluie.length > 1 ? 's' : ''} de pluie vs ${sec.length} jour${sec.length > 1 ? 's' : ''} sec${sec.length > 1 ? 's' : ''}`,
        });
      }
    });
    return decouvertes;
  }

  // ------------------------------------------------------------
  // Scanner Stock (25/07/2026) — deuxième source interne connectée.
  // stock_sante_historique est recalculé de façon irrégulière
  // (plusieurs fois le même jour, parfois aucun jour pendant une
  // semaine), donc pas encore utilisable comme une série quotidienne
  // fiable façon météo. Deux usages honnêtes sont possibles dès
  // maintenant :
  //   - un contexte "état actuel du stock" (dernierEtatStock), toujours
  //     affichable, jamais présenté comme une tendance ;
  //   - une tentative de corrélation CA / jours "sous surveillance"
  //     (analyserStock), qui se déclare "insuffisant" tant que les deux
  //     groupes comparés n'ont pas assez de jours — ce qui est
  //     honnêtement le cas aujourd'hui.
  // Article 5 : on ne garde qu'un instantané par jour calendaire
  // LOCAL (Martinique, UTC-4 fixe, pas d'heure d'été) — le plus
  // récent — plutôt que de mélanger plusieurs recalculs du même jour.
  // ------------------------------------------------------------
  function dateLocaleMartiniqueDepuisTimestamp(isoTimestamp) {
    const d = new Date(isoTimestamp);
    return new Date(d.getTime() - 4 * 3600000).toISOString().slice(0, 10);
  }

  function agregerStockParJour(rowsStockSante) {
    const parDate = {};
    (rowsStockSante || []).forEach(r => {
      const date = dateLocaleMartiniqueDepuisTimestamp(r.calcule_le);
      if (!parDate[date] || r.calcule_le > parDate[date].calculeLe) {
        parDate[date] = {
          date,
          calculeLe: r.calcule_le,
          indiceConfiance: Number(r.indice_confiance),
          nbStables: r.nb_references_stables,
          nbASurveiller: r.nb_references_a_surveiller,
          nbAVerifier: r.nb_references_a_verifier,
          nbNonConcluantes: r.nb_references_non_concluantes,
          risqueEstimeEur: Number(r.risque_estime_eur),
        };
      }
    });
    return parDate;
  }

  function dernierEtatStock(stockParDate) {
    const dates = Object.keys(stockParDate || {}).sort();
    if (!dates.length) return null;
    return stockParDate[dates[dates.length - 1]];
  }

  function croiserStock(joursAgreges, stockParDate) {
    return (joursAgreges || []).map(j => {
      const s = stockParDate ? stockParDate[j.date] : null;
      if (!s) return { ...j, stockDisponible: false, stockSousSurveillance: null, risqueEstimeEur: null, indiceConfiance: null };
      const stockSousSurveillance = (s.nbASurveiller + s.nbAVerifier) > 0;
      return { ...j, stockDisponible: true, stockSousSurveillance, risqueEstimeEur: s.risqueEstimeEur, indiceConfiance: s.indiceConfiance };
    });
  }

  function analyserStock(joursAvecStock) {
    const avecStock = (joursAvecStock || []).filter(j => j.stockDisponible);
    if (!avecStock.length) {
      return { disponible: false, message: "Aucun calcul Scanner Stock ne correspond encore à un jour d'audit — la corrélation s'activera dès que les deux historiques se recouperont davantage." };
    }
    const sousSurveillance = avecStock.filter(j => j.stockSousSurveillance);
    const sansAlerte = avecStock.filter(j => !j.stockSousSurveillance);
    if (sousSurveillance.length < SEUILS.MIN_OCCURRENCES_STOCK || sansAlerte.length < SEUILS.MIN_OCCURRENCES_STOCK) {
      return { disponible: false, message: `Corrélation stock non encore mesurable — il faut au moins ${SEUILS.MIN_OCCURRENCES_STOCK} jours avec alerte stock et ${SEUILS.MIN_OCCURRENCES_STOCK} jours sans alerte à comparer (actuellement ${sousSurveillance.length} avec, ${sansAlerte.length} sans). Scanner Stock ne recalcule pas encore son indice tous les jours.` };
    }
    const calc = liste => ({
      nbJours: liste.length,
      moyennePiste: moyenne(liste.map(j => j.ventePiste)),
      moyenneBoutique: moyenne(liste.map(j => j.venteBoutique)),
    });
    const joursSousSurveillance = calc(sousSurveillance);
    const joursSansAlerte = calc(sansAlerte);
    return {
      disponible: true,
      joursSousSurveillance, joursSansAlerte,
      ecartPiste: evolution(joursSousSurveillance.moyennePiste, joursSansAlerte.moyennePiste),
      ecartBoutique: evolution(joursSousSurveillance.moyenneBoutique, joursSansAlerte.moyenneBoutique),
    };
  }

  function detecterCorrelationStock(joursAvecStock) {
    if (!joursAvecStock || !joursAvecStock.length) return [];
    const avecStock = joursAvecStock.filter(j => j.stockDisponible);
    const sousSurveillance = avecStock.filter(j => j.stockSousSurveillance);
    const sansAlerte = avecStock.filter(j => !j.stockSousSurveillance);
    if (sousSurveillance.length < SEUILS.MIN_OCCURRENCES_STOCK || sansAlerte.length < SEUILS.MIN_OCCURRENCES_STOCK) return [];

    const decouvertes = [];
    [['venteBoutique', 'la boutique'], ['ventePiste', 'la piste']].forEach(([champ, libelle]) => {
      const moySurveillance = moyenne(sousSurveillance.map(j => j[champ]));
      const moySansAlerte = moyenne(sansAlerte.map(j => j[champ]));
      const ecart = evolution(moySurveillance, moySansAlerte);
      if (ecart !== null && Math.abs(ecart) >= 0.15) {
        const pct = `${ecart >= 0 ? '+' : ''}${(ecart * 100).toFixed(1).replace('.', ',')} %`;
        decouvertes.push({
          titre: `Les jours où Scanner Stock signale des références à surveiller, ${libelle} vend ${ecart >= 0 ? 'plus' : 'moins'} (${pct}) que les jours sans alerte.`,
          impact: 'Modéré',
          source: 'Croisement audits de caisse × Scanner Stock',
          nbObservations: Math.min(sousSurveillance.length, sansAlerte.length),
          variabilite: null,
          historiqueLabel: `${sousSurveillance.length} jour${sousSurveillance.length > 1 ? 's' : ''} avec alerte vs ${sansAlerte.length} sans`,
        });
      }
    });
    return decouvertes;
  }

  // ------------------------------------------------------------
  // Inventaires (25/07/2026) — troisième source Scanner Stock connectée.
  // stock_releves ne contient pour l'instant que des imports ponctuels
  // (quantite_theorique), jamais de comptage réel (quantite_reelle est
  // encore vide sur 100% des lignes) : impossible d'en tirer un écart
  // théorique/réel honnête pour l'instant. On expose donc uniquement
  // un contexte factuel et vérifiable — date et taille du dernier
  // import — plutôt qu'une analyse d'écart qui n'existe pas encore.
  // Article 5 : un instantané par jour calendaire LOCAL (Martinique),
  // le plus récent en cas de doublon.
  // ------------------------------------------------------------
  function agregerInventaireParDate(rowsStockReleves) {
    const parDate = {};
    (rowsStockReleves || []).forEach(r => {
      const date = dateLocaleMartiniqueDepuisTimestamp(r.releve_le);
      if (!parDate[date]) {
        parDate[date] = { date, nbArticles: 0, categories: new Set(), avecReel: 0, dernierImportLe: r.importe_le };
      }
      const j = parDate[date];
      j.nbArticles += 1;
      if (r.categorie) j.categories.add(r.categorie);
      if (r.quantite_reelle != null) j.avecReel += 1;
      if (r.importe_le && r.importe_le > j.dernierImportLe) j.dernierImportLe = r.importe_le;
    });
    Object.values(parDate).forEach(j => { j.nbCategories = j.categories.size; delete j.categories; });
    return parDate;
  }

  function dernierEtatInventaire(inventaireParDate) {
    const dates = Object.keys(inventaireParDate || {}).sort();
    if (!dates.length) return null;
    return inventaireParDate[dates[dates.length - 1]];
  }

  // ------------------------------------------------------------
  // Capital NEXUS (25/07/2026) — journal_decisions est déjà alimenté
  // par les autres modules NEXUS (R2/R3/R4, exclusions manuelles) et,
  // depuis peu, par NEXUS Tempo lui-même (R6-TEMPO-JOUR) à chaque
  // création de mission "jour à renforcer". Deux usages honnêtes :
  //   - un contexte global (dernierEtatCapital), toujours affichable ;
  //   - une mesure d'impact des décisions R6-TEMPO-JOUR
  //     (analyserImpactDecisionsTempo) comparant le CA moyen du jour
  //     concerné avant/après chaque mission créée — "insuffisant" tant
  //     qu'il n'y a pas assez d'occurrences des deux côtés, ou tant
  //     qu'aucune décision R6-TEMPO-JOUR n'existe encore (le cas
  //     aujourd'hui : 0 décision Tempo dans journal_decisions).
  // ------------------------------------------------------------
  function dernierEtatCapital(rowsJournal) {
    const rows = rowsJournal || [];
    if (!rows.length) return null;
    const impactCumuleEur = rows.reduce((s, r) => s + (Number(r.impact_eur) || 0), 0);
    const decisionsTempo = rows.filter(r => r.rule_id === 'R6-TEMPO-JOUR');
    const derniereDate = rows.reduce((max, r) => (!max || r.date > max) ? r.date : max, null);
    return { nbDecisions: rows.length, impactCumuleEur, nbDecisionsTempo: decisionsTempo.length, derniereDate };
  }

  function analyserImpactDecisionsTempo(rowsJournal, joursAgreges) {
    const decisions = (rowsJournal || []).filter(r => r.rule_id === 'R6-TEMPO-JOUR');
    if (!decisions.length) {
      return { disponible: false, message: "Aucune décision NEXUS Tempo n'a encore été transformée en mission — l'impact réel pourra être mesuré dès la première mission « jour à renforcer » créée depuis la Décision NEXUS." };
    }
    const moyCombinee = liste => moyenne(liste.map(j => j.ventePiste + j.venteBoutique));
    const resultats = decisions.map(d => {
      const jourSemaine = NOM_JOURS.indexOf(d.article);
      const joursConcernes = (joursAgreges || []).filter(j => j.jourSemaine === jourSemaine);
      const avant = joursConcernes.filter(j => j.date < d.date);
      const apres = joursConcernes.filter(j => j.date > d.date);
      if (avant.length < SEUILS.MIN_OCCURRENCES_TENDANCE || apres.length < SEUILS.MIN_OCCURRENCES_TENDANCE) {
        return {
          disponible: false, jourNom: d.article, dateDecision: d.date, nbAvant: avant.length, nbApres: apres.length,
          message: `Impact non encore mesurable pour le ${d.article} — il faut au moins ${SEUILS.MIN_OCCURRENCES_TENDANCE} occurrences avant et après la mission (actuellement ${avant.length} avant, ${apres.length} après).`,
        };
      }
      const moyAvant = moyCombinee(avant);
      const moyApres = moyCombinee(apres);
      return { disponible: true, jourNom: d.article, dateDecision: d.date, nbAvant: avant.length, nbApres: apres.length, moyAvant, moyApres, evolution: evolution(moyApres, moyAvant) };
    });
    return { disponible: resultats.some(r => r.disponible), resultats };
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
  function genererDecouvertes(classement, joursAgreges, employesParId, joursAvecMeteo, joursAvecStock) {
    const brutes = [
      ...detecterJourExtremeStable(classement),
      ...detecterProgressionConsecutive(classement),
      ...detecterContexteEquipe(joursAgreges, employesParId),
      ...detecterCorrelationMeteo(joursAvecMeteo),
      ...detecterCorrelationStock(joursAvecStock),
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
  // 10bis) Constat Conseiller (11/08/2026, audit "philosophie/architecture",
  //     Article 11 "une seule vérité") — NEXUS-App-v1.html et
  //     NEXUS-Brief-v1.html avaient chacun leur propre copie EXACTE de
  //     chargerConstatTempoHome()/chargerConstatTempo() et de
  //     construireCandidatTempoHome()/construireCandidatTempo(), l'une
  //     explicitement commentée "repris à l'identique de ... App-v1.html".
  //     Une vraie divergence s'était déjà glissée entre les deux copies :
  //     la version Brief ne construisait jamais le bloc `opportunites`
  //     (jour en progression / jour à renforcer, hors jourCible), alors que
  //     celle d'App-v1 le fait — un manager lisant sa décision Tempo sur
  //     Brief voyait donc moins d'information que sur l'accueil, sans
  //     raison. calculerConstatTempo() et construireCandidatTempo()
  //     devenues ici la source unique corrigent cette divergence : les deux
  //     pages appellent désormais directement ces fonctions à partir des
  //     lignes déjà chargées (audits_caisse, products), chacune gardant sa
  //     propre requête Supabase (glue, pas de logique) et son propre
  //     estProduitAppel (déjà une source unique via NexusMarge.familleMarge).
  // ------------------------------------------------------------
  function calculerConstatTempo(auditsCaisseRows, productsRows, estProduitAppelFn) {
    const joursAgreges = agregerParJour(auditsCaisseRows || []);
    const joursExploitables = filtrerJoursClos(joursAgreges);
    const periodesProduitsAppel = calculerPeriodesProduitsAppel(productsRows || [], estProduitAppelFn);
    const joursValorises = attribuerValorisationBoutique(joursExploitables, periodesProduitsAppel);
    const regroupement = regrouperParJourSemaine(joursValorises);
    const classement = calculerClassement(regroupement);
    const { jourARenforcer, jourMoteur: jourMoteurBrut, jourProgression: jourProgressionBrut } = identifierJoursReveles(classement);
    const jourPlusRentableBrut = identifierJourPlusRentable(classement);

    const jourARenforcerRetenu = (!jourARenforcer || !jourARenforcer.confianceTendance || jourARenforcer.evolutionCombinee === null || jourARenforcer.evolutionCombinee > SEUILS.SEUIL_CONSTAT_TEMPO)
      ? null : jourARenforcer;
    const jourMoteur = (jourMoteurBrut && jourMoteurBrut.confianceTendance) ? jourMoteurBrut : null;
    const jourPlusRentable = (jourPlusRentableBrut && jourPlusRentableBrut.nbOccValorisation > 0) ? jourPlusRentableBrut : null;
    const jourProgression = (jourProgressionBrut && jourProgressionBrut.confianceTendance) ? jourProgressionBrut : null;

    // Correctif (23/08/2026, audit "Anti-dégradation temporelle" §5
    // Verify — voir NEXUS-Data-Dictionary-v2.md v2.221) : `detailOperations`/
    // `totalJours` (Maîtrise du secteur Opérations, nexus-secteurs-moteur.js)
    // étaient calculés sur `joursAgreges` (les jours ENREGISTRÉS bruts, qui
    // incluent aujourd'hui dès qu'UN SEUL quart est saisi) — en contradiction
    // directe avec la règle posée juste au-dessus dans ce même fichier dès
    // le 25/07/2026 : *"Toute la mémoire temporelle (maturité, confiance
    // globale, décision, saisonnier, découvertes) doit être calculée à
    // partir des jours EXPLOITABLES, jamais des jours enregistrés bruts."*
    // `totalJours`/`detailOperations` avaient été ajoutés dans un lot
    // ultérieur sans reprendre cette règle déjà établie. Un jour en cours
    // (ex. Q1 saisi, Q2 pas encore fait) pesait donc dans la moyenne d'écart
    // de caisse exactement comme une journée complète — la dégradation
    // artificielle décrite par l'audit ("le secteur Operations ne doit pas
    // chuter uniquement parce que la journée n'est pas terminée"). Corrigé
    // en réutilisant `joursExploitables` (déjà calculé ci-dessus, Article 11
    // — aucune 2e définition de "jour exploitable").
    const totalJours = joursExploitables.length;
    const detailOperations = totalJours > 0
      ? joursExploitables.reduce((s, j) => s + Math.abs(j.ecartPiste) + Math.abs(j.ecartBoutique), 0) / totalJours
      : null;

    // Fraîcheur Opérations (23/08/2026, même audit, §5/§12 — exemple UX
    // cible : "Dernier etat fiable : hier / Aujourd'hui : 2 controles en
    // attente / 1 brouillon"). Distinct du fallback Carburants/FDJ (aucun
    // score figé sur UN jour précis ici — Opérations mesure déjà une
    // moyenne glissante sur tout l'historique exploitable, qui se met à
    // jour d'elle-même dès qu'un nouveau jour devient exploitable) : ce
    // qu'il faut exposer, c'est simplement LA DATE du dernier jour déjà
    // inclus dans cette moyenne, et si aujourd'hui porte déjà un contrôle
    // (même partiel) qui n'y est pas encore intégré.
    const dernierJourExploitableLe = joursExploitables.length ? joursExploitables[joursExploitables.length - 1].date : null;
    const aujourdhuiAUnControle = joursAgreges.some(j => j.date === aujourdHuiISO());

    // Lot G8 (11/11/2026) : constat en litres sur fenêtre glissante, base
    // de la carte Tempo (accueil et Brief). `jourPlusRentable` reste exposé
    // pour la page Tempo (hors périmètre G8) mais n'alimente plus la carte.
    const constatLitres = calculerConstatLitres(joursExploitables);

    return {
      jourARenforcer: jourARenforcerRetenu, jourMoteur, jourPlusRentable, jourProgression, totalJours, detailOperations,
      dernierJourExploitableLe, aujourdhuiAUnControle, constatLitres,
    };
  }

  // ------------------------------------------------------------
  // Lot G8 — constat en litres par jour de semaine (carte Tempo).
  //
  // Un CONSTAT, pas une décision : Tempo explique, il ne décide pas
  // (frontière Tempo / Cockpit). Mesure : litres vendus (GO + SP95 + GNR),
  // moyenne par jour de semaine, sur les journées CLOSES (filtrerJoursClos,
  // aucune deuxième définition) des FENETRE_SEMAINES dernières semaines
  // complètes, journée en cours exclue.
  // ------------------------------------------------------------
  // arbitrage G9 : 8 semaines étudiées, comparées aux 8 semaines qui les précèdent
  const FENETRE_SEMAINES = 8;
  // arbitrage G5 : sous ce nombre d'occurrences
  // d'un jour de semaine dans la fenêtre, aucun jour n'est désigné.
  const OCCURRENCES_MIN_JOUR = 4;

  function decalerJourISO(dateISO, nbJours) {
    const [a, m, j] = dateISO.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, j + nbJours)).toISOString().slice(0, 10);
  }

  // Date du jour DANS LE FUSEAU DE LA STATION (G8, revue Guardian 6786038072) :
  // aujourdHuiISO() est une date UTC — en Martinique (UTC−4) elle bascule à
  // demain dès 20 h locales, alors que le quart 2 dure jusqu'à 22 h 05. Le
  // constat borne donc sa fenêtre sur la date station. aujourdHuiISO() et
  // filtrerJoursClos() restent inchangées (usages ailleurs).
  function dateStationISO(fuseau, instant) {
    const tz = fuseau || 'America/Martinique';
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(instant instanceof Date ? instant : new Date());
  }

  function calculerConstatLitres(joursExploitables, fuseau) {
    const fin = dateStationISO(fuseau);                            // exclu : journée en cours (date station)
    const debut = decalerJourISO(fin, -7 * FENETRE_SEMAINES);      // 56 jours
    const dansFenetre = (joursExploitables || []).filter(j =>
      j.date < fin && j.date >= debut && j.litrageDisponible &&
      (j.litrageGazole + j.litrageSp95 + j.litrageGnr) > 0);
    const parJour = [];
    for (let d = 0; d < 7; d++) {
      const jours = dansFenetre.filter(j => j.jourSemaine === d);
      const total = jours.reduce((s, j) => s + j.litrageGazole + j.litrageSp95 + j.litrageGnr, 0);
      parJour.push({
        jourSemaine: d, nom: NOM_JOURS[d], occurrences: jours.length,
        moyenneLitres: jours.length ? total / jours.length : null,
      });
    }
    const insuffisant = parJour.filter(x => x.occurrences < OCCURRENCES_MIN_JOUR);
    if (insuffisant.length) {
      return { suffisant: false, fenetreSemaines: FENETRE_SEMAINES, occurrencesMin: OCCURRENCES_MIN_JOUR, parJour, plusFort: null, plusFaible: null };
    }
    const tries = parJour.slice().sort((a, b) => b.moyenneLitres - a.moyenneLitres);
    return {
      suffisant: true, fenetreSemaines: FENETRE_SEMAINES, occurrencesMin: OCCURRENCES_MIN_JOUR, parJour,
      plusFort: tries[0], plusFaible: tries[tries.length - 1],
    };
  }

  // ------------------------------------------------------------
  // Tempo v2 — lot V2 « branchement », partie 1 : les trois indicateurs
  // (brief Guardian 6795638585, GO Frédéric 11/11/2026). Calculs purs, sans
  // lecture ni écriture : la page v2 leur passe les lignes qu'elle a lues.
  //   - Période : les FENETRE_SEMAINES dernières semaines closes, en date
  //     STATION (dateStationISO, jamais aujourdHuiISO ni filtrerJoursClos,
  //     qui sont en UTC). Le jour en cours est exclu.
  //   - Jour complet (piste) : les quarts 1 ET 2 présents, litrage renseigné
  //     sur les deux, total > 0 (même règle que le constat G8).
  //   - Moins de OCCURRENCES_MIN_JOUR jours retenus : « insuffisant », jamais
  //     une moyenne présentée comme fiable. Aucun jour : « absent ».
  // ------------------------------------------------------------
  function bornesPeriodeIndicateurs(fuseau, instant) {
    const exclu = dateStationISO(fuseau, instant);
    const jours = 7 * FENETRE_SEMAINES;
    return { debut: decalerJourISO(exclu, -jours), fin: decalerJourISO(exclu, -1), exclu, semaines: FENETRE_SEMAINES, jours };
  }

  function joursLitresCompletsPiste(auditsRows) {
    return agregerParJour(auditsRows)
      .filter(j => {
        const total = j.litrageGazole + j.litrageSp95 + j.litrageGnr;
        const quartOk = q => j.quarts.some(x => String(x.quart) === q && x.litrageDisponible);
        return j.litrageDisponible && quartOk('1') && quartOk('2') && total > 0;
      })
      .map(j => ({ date: j.date, valeur: j.litrageGazole + j.litrageSp95 + j.litrageGnr }));
  }

  // CA des jeux du jour = grattage + tirages (même formule que FDJ Analyse,
  // vue view_fdj_daily_summary). Jour complet : les deux quarts contrôlés.
  function joursCaFdjComplets(fdjRows) {
    return (fdjRows || [])
      .filter(r => r && r.date && Number(r.nb_quarts_controles) >= 2)
      .map(r => ({ date: r.date, valeur: (Number(r.ca_grattage) || 0) + (Number(r.caisse_tirages) || 0) }));
  }

  function resumerParJour(valeursParJour, bornes) {
    const retenus = (valeursParJour || []).filter(v => v && Number.isFinite(v.valeur) &&
      v.date >= bornes.debut && v.date <= bornes.fin);
    const jours = retenus.length;
    const total = retenus.reduce((s, v) => s + v.valeur, 0);
    const etat = jours === 0 ? 'absent' : (jours < OCCURRENCES_MIN_JOUR ? 'insuffisant' : 'ok');
    return { etat, jours, total, moyenne: jours ? total / jours : null, seuil: OCCURRENCES_MIN_JOUR, debut: bornes.debut, fin: bornes.fin };
  }

  // ------------------------------------------------------------
  // « Quarts et équipes » : moyenne PAR QUART (Q1 et Q2 séparés), même fenêtre
  // de 56 jours que les indicateurs, jour en cours exclu (via `bornes`).
  //   - Litres : un quart n'est retenu que si GO, SP95 et GNR sont tous trois
  //     renseignés ; valeur = somme des trois.
  //   - Boutique : vente_boutique renseignée.
  //   - FDJ : quart comptabilisable (view_fdj_shift_facts) ; valeur =
  //     ventes_grattage_valeur + caisse_tirages.
  //   - Moins de OCCURRENCES_MIN_JOUR quarts d'un côté : « insuffisant ».
  //   - Source absente (null) : « absent ». Rien n'est écrit, rien n'est estimé.
  // ------------------------------------------------------------
  const nombreOuNull = x => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x))) ? null : Number(x);

  function quartsLitresPiste(auditsRows) {
    const out = [];
    for (const r of (auditsRows || [])) {
      if (!r || !r.date) continue;
      const a = nombreOuNull(r.litrage_gazole), b = nombreOuNull(r.litrage_sp95), c = nombreOuNull(r.litrage_gnr);
      if (a === null || b === null || c === null) continue;
      out.push({ date: r.date, quart: String(r.quart), valeur: a + b + c });
    }
    return out;
  }

  function quartsBoutique(auditsRows) {
    const out = [];
    for (const r of (auditsRows || [])) {
      if (!r || !r.date) continue;
      const v = nombreOuNull(r.vente_boutique);
      if (v === null) continue;
      out.push({ date: r.date, quart: String(r.quart), valeur: v });
    }
    return out;
  }

  function quartsFdj(factsRows) {
    const out = [];
    for (const r of (factsRows || [])) {
      if (!r || !r.date || r.caisse_comptabilisable !== true) continue;
      out.push({ date: r.date, quart: String(r.quart),
        valeur: (nombreOuNull(r.ventes_grattage_valeur) || 0) + (nombreOuNull(r.caisse_tirages) || 0) });
    }
    return out;
  }

  function indexSemaine(dateISO, debutISO) {
    const ms = s => { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
    return Math.floor((ms(dateISO) - ms(debutISO)) / (7 * 86400000));
  }

  function comparerQuarts(valeursQuart, bornes) {
    if (valeursQuart === null || valeursQuart === undefined) {
      return { etat: 'absent', seuil: OCCURRENCES_MIN_JOUR, q1: { effectif: 0, moyenne: null }, q2: { effectif: 0, moyenne: null },
        ecartPct: null, semainesQ1Depasse: 0, semainesCommunes: 0 };
    }
    const retenus = valeursQuart.filter(v => v && Number.isFinite(v.valeur) && v.date >= bornes.debut && v.date <= bornes.fin &&
      (String(v.quart) === '1' || String(v.quart) === '2'));
    const par = q => retenus.filter(v => String(v.quart) === q);
    const moy = l => l.length ? l.reduce((s, v) => s + v.valeur, 0) / l.length : null;
    const l1 = par('1'), l2 = par('2');
    const m1 = moy(l1), m2 = moy(l2);
    const res = { etat: 'ok', seuil: OCCURRENCES_MIN_JOUR, q1: { effectif: l1.length, moyenne: m1 }, q2: { effectif: l2.length, moyenne: m2 },
      ecartPct: null, semainesQ1Depasse: 0, semainesCommunes: 0 };
    if (!l1.length && !l2.length) { res.etat = 'absent'; return res; }
    if (l1.length < OCCURRENCES_MIN_JOUR || l2.length < OCCURRENCES_MIN_JOUR) { res.etat = 'insuffisant'; return res; }
    res.ecartPct = m2 > 0 ? (m1 - m2) / m2 * 100 : null;
    const sem = new Map();
    for (const v of retenus) {
      const i = indexSemaine(v.date, bornes.debut);
      if (!sem.has(i)) sem.set(i, { 1: [], 2: [] });
      sem.get(i)[String(v.quart)].push(v.valeur);
    }
    for (const s of sem.values()) {
      if (!s[1].length || !s[2].length) continue;
      res.semainesCommunes++;
      const mn = l => l.reduce((x, y) => x + y, 0) / l.length;
      if (mn(s[1]) > mn(s[2])) res.semainesQ1Depasse++;
    }
    return res;
  }

  // Marge de la période d'import affichée (la plus récente) : MOYENNE de la
  // période d'import, pas une marge jour par jour. Mêmes filtres que Capital :
  // articles hors produits d'appel, lignes cohérentes (ca > 0, 0 <= marge <= ca).
  function resumerMargeImport(productsRows, articlesAppel, analyserPeriodes) {
    const appel = new Set(articlesAppel || []);
    const brut = (productsRows || []).filter(r => !appel.has(r.article));
    const { periodeAffichage, rowsAffichage } = analyserPeriodes(brut);
    if (!periodeAffichage) return { etat: 'absent', ca: 0, marge: 0, taux: null, debut: null, fin: null, nbArticles: 0 };
    const propres = rowsAffichage.filter(r => (r.ca || 0) > 0 && (r.marge || 0) >= 0 && (r.marge || 0) <= (r.ca || 0));
    const ca = propres.reduce((s, r) => s + (Number(r.ca) || 0), 0);
    const marge = propres.reduce((s, r) => s + (Number(r.marge) || 0), 0);
    if (!propres.length || ca <= 0) return { etat: 'absent', ca: 0, marge: 0, taux: null, debut: periodeAffichage.debut, fin: periodeAffichage.fin, nbArticles: 0 };
    return { etat: 'ok', ca, marge, taux: marge / ca, debut: periodeAffichage.debut, fin: periodeAffichage.fin, nbArticles: propres.length };
  }

  // Candidat Tempo pour le Conseiller — lot G8 (11/11/2026) : CONSTAT
  // seulement, en litres (GO + SP95 + GNR). Plus d'estimation de valeur,
  // plus de phrase de décision (Tempo explique, il ne décide pas).
  // Retourne null si aucun constat n'est disponible. Consommée par
  // NexusConseiller.normaliserTempo().
  function construireCandidatTempo(constatTempo) {
    const c = constatTempo && constatTempo.constatLitres;
    if (!c) return null;
    const fmtL = v => `${Math.round(v).toLocaleString('fr-FR')} L`;
    const occ = n => `${n} journée${n > 1 ? 's' : ''}`;
    const niveau = 'Fait mesuré';
    if (!c.suffisant) {
      return {
        jourCible: null, niveau,
        decision: 'Historique insuffisant',
        pourquoi: `Historique insuffisant pour comparer les jours de la semaine : il faut au moins ${c.occurrencesMin} journées complètes de chaque jour sur les ${c.fenetreSemaines} dernières semaines (${c.fenetreSemaines * 7} jours).`,
        pourquoiBullets: null, pourquoiPasAutre: null, opportunites: null,
        impactAttendu: null,
        limites: null,
      };
    }
    const f = c.plusFort, w = c.plusFaible;
    return {
      jourCible: f, niveau,
      decision: `Le ${f.nom} est le jour le plus fort en litres, le ${w.nom} le plus faible.`,
      pourquoi: `Fait mesuré sur les ${c.fenetreSemaines} dernières semaines (${c.fenetreSemaines * 7} jours) : le ${f.nom} vend en moyenne ${fmtL(f.moyenneLitres)} par jour et le ${w.nom} ${fmtL(w.moyenneLitres)}.`,
      pourquoiBullets: [
        `Plus fort : ${f.nom}, ${fmtL(f.moyenneLitres)} par jour (${occ(f.occurrences)})`,
        `Plus faible : ${w.nom}, ${fmtL(w.moyenneLitres)} par jour (${occ(w.occurrences)})`,
        `Carburants : gazole, SP95 et GNR cumulés`,
        `Niveau : ${niveau}`,
      ],
      pourquoiPasAutre: null, opportunites: null,
      impactAttendu: null,
      limites: null,
    };
  }

  // ------------------------------------------------------------
  // 11) Architecture — sources de données que NEXUS Tempo est déjà
  //     capable de lire, et celles prévues pour affiner sa mémoire
  //     temporelle à mesure qu'elles seront branchées. Déclarer une
  //     source ici ne l'active pas : tant qu'aucune donnée réelle
  //     n'arrive, elle reste "Prévue".

  // ------------------------------------------------------------
  // Tempo v2 — lot V2, partie 3 : comparabilité et lignes « Évolution »
  // (arbitrages G9 et G5, Guardian 6798544703 et 6798744933). Calculs purs :
  // la page passe les lignes qu'elle a lues, rien n'est lu ni écrit ici.
  //   - Période de référence : les mêmes jours, juste avant la période étudiée.
  //   - Évolution : moyenne par jour complet, étudiée contre référence, en %.
  //   - Minimum : 4 jours complets de chaque jour de semaine, dans CHAQUE période.
  //   - Écart net : Welch ; si ±2 erreurs-types contiennent zéro, « variation habituelle ».
  //   - Jour exceptionnel : écart à la médiane ≥ 3,5 × (MAD × 1,4826). Signalé, jamais retiré en silence.
  //   - Aucun jour manquant n'est remplacé ni extrapolé.
  // ------------------------------------------------------------
  const SEUIL_JOUR_EXCEPTIONNEL = 3.5;
  const SEUIL_ECART_TYPES = 2;
  // Garde des rythmes hebdomadaires (carte « jours forts et faibles » seulement) : part minimale des occurrences
  // d'un jour de semaine repérées hors norme dans le même sens pour parler de rythme récurrent. Règle initiale, configurable.
  const SEUIL_RYTHME_RECURRENT = 0.5;
  // Un jour est dit « irrégulier » quand son coefficient de variation vaut au moins 1,5 fois celui du jour fort ou faible récurrent de référence.
  const RATIO_CV_IRREGULIER = 1.5;
  const SEUIL_RAPPORT_DUREES = 2;
  const SEUIL_POINTS_CALENDRIER = 20;

  // ------------------------------------------------------------
  // Lot B « Le quart 1 vend-il plus que le quart 2 ? » : moyenne par jour de la
  // semaine ET par quart. Une case (jour × quart) n'est lue qu'à partir de
  // OCCURRENCES_MIN_JOUR valeurs ; en dessous elle reste grise (`suffisant: false`).
  // Écart d'un jour = (Q1 − Q2) / Q2, en %, seulement si les deux cases sont lisibles
  // et que Q2 n'est pas nul. Aucune estimation, aucune écriture.
  // ------------------------------------------------------------
  const ORDRE_JOURS_SEMAINE = [1, 2, 3, 4, 5, 6, 0];

  function comparerQuartsParJour(valeursQuart, bornes) {
    const cases = {};
    for (const j of ORDRE_JOURS_SEMAINE) cases[j] = { '1': [], '2': [] };
    for (const v of (valeursQuart || [])) {
      if (!v || !v.date || !Number.isFinite(v.valeur) || v.date < bornes.debut || v.date > bornes.fin) continue;
      const q = String(v.quart);
      if (q !== '1' && q !== '2') continue;
      cases[jourSemaineISO(v.date)][q].push(v.valeur);
    }
    const lire = vals => ({ effectif: vals.length, suffisant: vals.length >= OCCURRENCES_MIN_JOUR,
      moyenne: vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null });
    const parJour = ORDRE_JOURS_SEMAINE.map(j => {
      const q1 = lire(cases[j]['1']), q2 = lire(cases[j]['2']);
      const lisible = q1.suffisant && q2.suffisant && q2.moyenne !== 0;
      return { jourSemaine: j, nom: NOM_JOURS[j], q1, q2, ecartPct: lisible ? (q1.moyenne - q2.moyenne) / q2.moyenne * 100 : null };
    });
    const avecEcart = parJour.filter(x => x.ecartPct !== null);
    let plusFort = null, plusFaible = null;
    for (const x of avecEcart) {
      if (!plusFort || x.ecartPct > plusFort.ecartPct) plusFort = x;
      if (!plusFaible || x.ecartPct < plusFaible.ecartPct) plusFaible = x;
    }
    const effectifTotal = parJour.reduce((s, x) => s + x.q1.effectif + x.q2.effectif, 0);
    return { etat: effectifTotal === 0 ? 'absent' : (avecEcart.length ? 'ok' : 'insuffisant'),
      seuil: OCCURRENCES_MIN_JOUR, parJour, plusFort, plusFaible, joursLisibles: avecEcart.length };
  }

  // Journées exceptionnelles, par jour de la semaine : on compare entre eux les
  // totaux (Q1 + Q2) des jours où les deux quarts sont relevés, avec le même
  // détecteur que Tempo (joursExceptionnels). Le jour est SIGNALÉ, jamais retiré
  // en silence : on rend l'écart Q1/Q2 du jour de semaine avec lui, puis sans lui.
  function exceptionsParJourSemaine(valeursQuart, bornes) {
    const par = new Map();
    for (const v of (valeursQuart || [])) {
      if (!v || !v.date || !Number.isFinite(v.valeur) || v.date < bornes.debut || v.date > bornes.fin) continue;
      const q = String(v.quart);
      if (q !== '1' && q !== '2') continue;
      if (!par.has(v.date)) par.set(v.date, { 1: null, 2: null });
      const e = par.get(v.date);
      e[q] = (e[q] || 0) + v.valeur;
    }
    const complets = [];
    par.forEach((e, date) => { if (e[1] !== null && e[2] !== null) complets.push({ date, valeur: e[1] + e[2] }); });
    const avec = comparerQuartsParJour(valeursQuart, bornes).parJour;
    const out = [];
    for (const j of ORDRE_JOURS_SEMAINE) {
      const exc = joursExceptionnels(complets.filter(c => jourSemaineISO(c.date) === j));
      if (!exc.length) continue;
      const dates = new Set(exc.map(x => x.date));
      const sans = comparerQuartsParJour((valeursQuart || []).filter(v => !(v && dates.has(v.date))), bornes).parJour.find(x => x.jourSemaine === j);
      out.push({ jourSemaine: j, nom: NOM_JOURS[j], exceptionnels: exc.map(x => ({ date: x.date, valeur: x.valeur })),
        ecartAvec: avec.find(x => x.jourSemaine === j).ecartPct, ecartSans: sans.ecartPct });
    }
    return out;
  }

  function bornesReference(bornes) {
    return { debut: decalerJourISO(bornes.debut, -bornes.jours), fin: decalerJourISO(bornes.debut, -1), jours: bornes.jours };
  }
  function jourSemaineISO(dateISO) {
    const [a, m, j] = dateISO.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  }
  function datesDeLaPeriode(p) {
    const out = [];
    for (let d = p.debut; d <= p.fin; d = decalerJourISO(d, 1)) out.push(d);
    return out;
  }
  function enPeriode(jours, p) {
    return (jours || []).filter(j => j && j.date >= p.debut && j.date <= p.fin);
  }
  const moyenneTab = a => a.reduce((s, x) => s + x, 0) / a.length;
  function varianceEchantillon(a, m) {
    return a.length < 2 ? 0 : a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
  }
  function medianeTab(a) {
    const t = a.slice().sort((x, y) => x - y), n = t.length;
    return n % 2 ? t[(n - 1) / 2] : (t[n / 2 - 1] + t[n / 2]) / 2;
  }

  // Jours dont l'écart à la médiane atteint 3,5 écarts robustes (MAD × 1,4826).
  function joursExceptionnels(jours) {
    if (!jours || jours.length < 3) return [];
    const valeurs = jours.map(j => j.valeur);
    const med = medianeTab(valeurs);
    const echelle = medianeTab(valeurs.map(v => Math.abs(v - med))) * 1.4826;
    if (!(echelle > 0)) return [];
    return jours.filter(j => Math.abs(j.valeur - med) >= SEUIL_JOUR_EXCEPTIONNEL * echelle);
  }

  function minParJourSemaine(jours) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    jours.forEach(j => { c[jourSemaineISO(j.date)]++; });
    return Math.min.apply(null, c);
  }

  function pourcentage(m1, m0) { return m0 > 0 ? (m1 - m0) / m0 : null; }

  // jours* : [{date, valeur}] des jours complets de chaque période.
  // manquantsMax (optionnel, 0 par défaut) : nombre de jours de la semaine tolérés en moins sur OCCURRENCES_MIN_JOUR occurrences
  // de chacun, par période. Seul moisParMois le passe ; tous les autres appelants gardent la règle stricte.
  function deficitOccurrences(jours) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    jours.forEach(j => { c[jourSemaineISO(j.date)]++; });
    return c.reduce((s, n) => s + Math.max(0, OCCURRENCES_MIN_JOUR - n), 0);
  }
  function comparerPeriodes(joursEtudie, joursRef, borneEtudiee, borneRef, manquantsMax) {
    const E = enPeriode(joursEtudie, borneEtudiee), R = enPeriode(joursRef, borneRef);
    const minE = minParJourSemaine(E), minR = minParJourSemaine(R);
    const tol = manquantsMax > 0 ? manquantsMax : 0;
    if (tol === 0 ? (minE < OCCURRENCES_MIN_JOUR || minR < OCCURRENCES_MIN_JOUR) : (deficitOccurrences(E) > tol || deficitOccurrences(R) > tol)) {
      return { etat: 'insuffisant', minimum: OCCURRENCES_MIN_JOUR, minEtudiee: minE, minReference: minR, nEtudiee: E.length, nReference: R.length };
    }
    const vE = E.map(j => j.valeur), vR = R.map(j => j.valeur);
    const mE = moyenneTab(vE), mR = moyenneTab(vR);
    const ecart = mE - mR;
    const se = Math.sqrt(varianceEchantillon(vE, mE) / vE.length + varianceEchantillon(vR, mR) / vR.length);
    const exc = joursExceptionnels(E.concat(R)).map(j => ({ date: j.date, valeur: j.valeur, periode: j.date >= borneEtudiee.debut ? 'etudiee' : 'reference' }));
    let sans = null;
    if (exc.length) {
      const dates = new Set(exc.map(x => x.date));
      const E2 = E.filter(j => !dates.has(j.date)).map(j => j.valeur), R2 = R.filter(j => !dates.has(j.date)).map(j => j.valeur);
      sans = { dates: exc.map(x => x.date), pct: E2.length && R2.length ? pourcentage(moyenneTab(E2), moyenneTab(R2)) : null };
    }
    return {
      etat: 'ok', nEtudiee: E.length, nReference: R.length, moyenneEtudiee: mE, moyenneReference: mR,
      pct: pourcentage(mE, mR), ecart, erreurType: se,
      dansVariationHabituelle: Math.abs(ecart) <= SEUIL_ECART_TYPES * se,
      exceptionnels: exc, sans,
    };
  }

  // Jours de la période sans jour complet, avec la raison (jamais remplacés).
  function exclusionsPiste(auditsRows, p) {
    const parDate = new Map(agregerParJour(auditsRows).map(j => [j.date, j]));
    const out = [];
    datesDeLaPeriode(p).forEach(d => {
      const j = parDate.get(d);
      const quartPresent = q => !!j && j.quarts.some(x => String(x.quart) === q);
      const quartOk = q => !!j && j.quarts.some(x => String(x.quart) === q && x.litrageDisponible);
      if (!quartPresent('1') || !quartPresent('2')) out.push({ date: d, raison: 'quart manquant' });
      else if (!quartOk('1') || !quartOk('2') || !(j.litrageGazole + j.litrageSp95 + j.litrageGnr > 0)) out.push({ date: d, raison: 'litrage manquant' });
    });
    return out;
  }
  function exclusionsFdj(fdjRows, p) {
    const ok = new Set(joursCaFdjComplets(fdjRows).map(j => j.date));
    return datesDeLaPeriode(p).filter(d => !ok.has(d)).map(d => ({ date: d, raison: 'quart FDJ non contrôlé' }));
  }

  // Composition du calendrier d'une période : vacances, fériés, week-ends (jours et %).
  // lignesFeries : lignes inventaire_calendrier_site de type 'ferie' (date) ; le calendrier officiel complète.
  function compositionCalendrier(p, lignesFeries) {
    const feries = new Set((lignesFeries || []).filter(l => l && l.date && l.type === 'ferie').map(l => String(l.date).slice(0, 10)));
    const dates = datesDeLaPeriode(p);
    let vacances = 0, ferie = 0, weekend = 0;
    dates.forEach(d => {
      if (estVacancesScolaires(d).vacances) vacances++;
      if (feries.has(d) || estJourFerieMartinique(d).ferie) ferie++;
      const w = jourSemaineISO(d);
      if (w === 0 || w === 6) weekend++;
    });
    const n = dates.length || 1;
    return { jours: dates.length, vacances, feries: ferie, weekends: weekend, pctVacances: vacances / n, pctFeries: ferie / n, pctWeekends: weekend / n };
  }

  // ------------------------------------------------------------
  // Jours fériés et ponts (Lot 3). Chaque férié ou pont travaillé est comparé à une
  // journée habituelle : la moyenne du même jour de semaine sur les 8 semaines qui
  // précèdent, journées complètes seulement, fériés et ponts exclus de la référence.
  // Le moteur ne rend que des données et des codes ; les phrases vivent dans le lexique.
  //   jours complets : [{ date, valeur }] (joursLitresCompletsPiste / joursCaFdjComplets)
  //   bornes         : { debut, fin } (début de l'historique complet, veille du jour en cours)
  //   etat 'comparable' | 'non_comparable' ; raison : 'jour_incomplet' | 'reference_insuffisante'
  //   effets         : écart moyen des fériés puis des ponts, rendu à partir de 4 observés.
  // ------------------------------------------------------------
  const FERIES_SEMAINES_REFERENCE = 8;
  const FERIES_REFERENCE_MIN = 4;
  const FERIES_OBSERVES_MIN = 4;
  function qualifierJourSpecial(date, feriesSite, libelles) {
    const f = estJourFerieMartinique(date);
    if (f.ferie || feriesSite.has(date)) return { type: 'ferie', nom: f.nom || (libelles && libelles.get(date)) || null };
    if (estPont(date).pont) {
      const veille = estJourFerieMartinique(decalerJourISO(date, 1));
      const lend = estJourFerieMartinique(decalerJourISO(date, -1));
      return veille.ferie ? { type: 'pont', nom: veille.nom, sens: 'veille' } : { type: 'pont', nom: lend.nom, sens: 'lendemain' };
    }
    return null;
  }
  function analyseFeries(joursComplets, lignesFeries, bornes) {
    const feriesSite = new Set((lignesFeries || []).filter(l => l && l.date && l.type === 'ferie').map(l => String(l.date).slice(0, 10)));
    const libelles = new Map();
    (lignesFeries || []).forEach(l => { if (l && l.date && l.type === 'ferie' && l.libelle) libelles.set(String(l.date).slice(0, 10), String(l.libelle).trim()); });
    const parDate = new Map();
    (joursComplets || []).forEach(j => { if (j && j.date && Number.isFinite(j.valeur)) parDate.set(j.date, j.valeur); });
    const premier = [...parDate.keys()].sort()[0];
    const special = d => qualifierJourSpecial(d, feriesSite, libelles);
    // Journées exceptionnelles (même règle que partout dans Tempo), repérées sur les jours ordinaires : elles ne servent pas de référence.
    const exceptionnels = new Set(joursExceptionnels([...parDate.entries()].filter(e => !special(e[0])).map(e => ({ date: e[0], valeur: e[1] }))).map(j => j.date));
    const jours = [];
    if (premier) {
      datesDeLaPeriode({ debut: premier > bornes.debut ? premier : bornes.debut, fin: bornes.fin }).forEach(date => {
        const q = special(date);
        if (!q) return;
        const jour = { date, type: q.type, nom: q.nom, sens: q.sens || null, jourSemaine: jourSemaineISO(date) };
        if (!parDate.has(date)) return jours.push(Object.assign(jour, { etat: 'non_comparable', raison: 'jour_incomplet', valeur: null }));
        const ref = [], exclus = [];
        for (let k = 1; k <= FERIES_SEMAINES_REFERENCE; k++) {
          const d = decalerJourISO(date, -7 * k);
          if (!parDate.has(d) || special(d)) continue;
          if (exceptionnels.has(d)) exclus.push(d); else ref.push(parDate.get(d));
        }
        jour.valeur = parDate.get(date);
        jour.reference = { n: ref.length, min: FERIES_REFERENCE_MIN, moyenne: ref.length ? moyenneTab(ref) : null, exclus: exclus.sort() };
        if (ref.length < FERIES_REFERENCE_MIN || !(jour.reference.moyenne > 0)) {
          return jours.push(Object.assign(jour, { etat: 'non_comparable', raison: 'reference_insuffisante' }));
        }
        jour.etat = 'comparable';
        jour.ecartValeur = jour.valeur - jour.reference.moyenne;
        jour.ecartPct = jour.ecartValeur / jour.reference.moyenne * 100;
        jours.push(jour);
      });
    }
    const effet = type => {
      const c = jours.filter(j => j.type === type && j.etat === 'comparable');
      const ok = c.length >= FERIES_OBSERVES_MIN;
      return { type, n: c.length, min: FERIES_OBSERVES_MIN, etat: ok ? 'ok' : 'insuffisant',
        ecartPct: ok ? moyenneTab(c.map(j => j.ecartPct)) : null, ecartValeur: ok ? moyenneTab(c.map(j => j.ecartValeur)) : null };
    };
    return { jours, effets: { ferie: effet('ferie'), pont: effet('pont') }, semaines: FERIES_SEMAINES_REFERENCE, referenceMin: FERIES_REFERENCE_MIN };
  }

  // exceptionnels : [{ activite, date, valeur }] des deux périodes, toutes activités.
  function evaluerComparabilite(borneEtudiee, borneRef, calE, calR, exceptionnels) {
    const raisons = [];
    const dE = borneEtudiee.jours || datesDeLaPeriode(borneEtudiee).length, dR = borneRef.jours || datesDeLaPeriode(borneRef).length;
    if (Math.max(dE, dR) / Math.max(1, Math.min(dE, dR)) > SEUIL_RAPPORT_DUREES) raisons.push({ critere: 'durees', texte: 'durées très différentes (' + dE + ' jours contre ' + dR + ')' });
    const pts = x => Math.round(Math.abs(x) * 100);
    if (Math.abs(calE.pctVacances - calR.pctVacances) * 100 > SEUIL_POINTS_CALENDRIER) raisons.push({ critere: 'calendrier', texte: 'vacances inégales entre les deux périodes (' + pts(calE.pctVacances) + ' % contre ' + pts(calR.pctVacances) + ' % des jours)' });
    if (Math.abs(calE.pctFeries - calR.pctFeries) * 100 > SEUIL_POINTS_CALENDRIER) raisons.push({ critere: 'calendrier', texte: 'jours fériés inégaux entre les deux périodes (' + pts(calE.pctFeries) + ' % contre ' + pts(calR.pctFeries) + ' % des jours)' });
    (exceptionnels || []).forEach(x => raisons.push({ critere: 'exceptionnel', texte: 'journée exceptionnelle le ' + x.date.split('-').reverse().join('/') + ' (' + x.activite + ')' }));
    return { faible: raisons.length > 0, raisons };
  }

  // Prix moyen de vente mesuré : somme de vente_piste / somme des litres (gazole + SP95 + GNR), sur les quarts
  // dont les trois litrages sont renseignés. C'est un fait mesuré : il suit les variations de prix, ce que
  // le tarif d'achat (une seule ligne par carburant) ne peut pas faire. Information seule.
  function prixMoyenMesure(auditsRows) {
    let vente = 0, litres = 0, quarts = 0;
    (auditsRows || []).forEach(r => {
      if (!r || r.litrage_gazole == null || r.litrage_sp95 == null || r.litrage_gnr == null) return;
      const l = (Number(r.litrage_gazole) || 0) + (Number(r.litrage_sp95) || 0) + (Number(r.litrage_gnr) || 0);
      if (!(l > 0)) return;
      vente += Number(r.vente_piste) || 0;
      litres += l;
      quarts++;
    });
    return litres > 0 ? { prix: vente / litres, litres, quarts } : null;
  }

  // ------------------------------------------------------------
  // Découvertes (lot A) : calculs purs sur les lignes déjà lues. Aucune lecture, aucune écriture.
  // CA piste et boutique d'un jour : mêmes jours complets que les litres (les deux quarts renseignés).
  function joursCaPiste(auditsRows) {
    const ok = new Set(joursLitresCompletsPiste(auditsRows).map(j => j.date));
    return agregerParJour(auditsRows).filter(j => ok.has(j.date)).map(j => ({ date: j.date, valeur: j.ventePiste }));
  }
  function joursCaBoutique(auditsRows) {
    const ok = new Set(joursLitresCompletsPiste(auditsRows).map(j => j.date));
    return agregerParJour(auditsRows).filter(j => ok.has(j.date)).map(j => ({ date: j.date, valeur: j.venteBoutique }));
  }

  // ------------------------------------------------------------
  // Lot D1 « Piste en litres par carburant » : calculs purs sur les lignes déjà lues.
  // Lecture seule, filtrée par site ; rien n'est écrit, rien n'est estimé.
  //   - Hors service (A3) : 0 L sur chaque jour complet des 31 derniers jours de la fenêtre.
  //     Il revient au premier litre non nul. Exclu des parts, des comparaisons et des découvertes.
  //   - Écart net (Welch) ; un jour exceptionnel est jugé sans lui, et la carte montre les deux valeurs.
  //   - Candidats : (a) variation masquée, (b) changement de répartition ≥ SEUIL_PART_POINTS points,
  //     (c) variation simple des litres totaux. Ordre par défaut a, b, c ; (c) dépasse (a) quand
  //     I(c) ≥ I(a) et z(c) ≥ K_DEPASSEMENT × z(a) (K_DEPASSEMENT : constante provisoire, à arbitrer).
  // ------------------------------------------------------------
  const CARBURANTS = [
    { cle: 'gazole', nom: 'Gazole', champ: 'litrageGazole' },
    { cle: 'sp95', nom: 'SP95', champ: 'litrageSp95' },
    { cle: 'gnr', nom: 'GNR', champ: 'litrageGnr' },
  ];
  const JOURS_HORS_SERVICE = 31;
  const SEUIL_PART_POINTS = 2.0;
  const K_DEPASSEMENT = 2.0;

  function joursLitresCarburant(auditsRows, cle) {
    const c = CARBURANTS.find(x => x.cle === cle);
    const ok = new Set(joursLitresCompletsPiste(auditsRows).map(j => j.date));
    return agregerParJour(auditsRows).filter(j => ok.has(j.date)).map(j => ({ date: j.date, valeur: j[c.champ] }));
  }

  // Quarts par carburant : mêmes quarts que « Litres » (trois litrages renseignés), valeur = le litrage du carburant.
  function quartsLitresCarburant(auditsRows, cle) {
    const c = CARBURANTS.find(x => x.cle === cle);
    const champ = { gazole: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' }[c.cle];
    const ok = quartsLitresPiste(auditsRows);
    const cles = new Set(ok.map(q => q.date + '|' + q.quart));
    const out = [];
    for (const r of (auditsRows || [])) {
      if (r && r.date && cles.has(r.date + '|' + String(r.quart))) out.push({ date: r.date, quart: String(r.quart), valeur: nombreOuNull(r[champ]) || 0 });
    }
    return out;
  }

  function horsServiceCarburant(joursE, joursR, bornes, bRef) {
    const debut31 = decalerJourISO(bornes.fin, -(JOURS_HORS_SERVICE - 1));
    const dern = (joursE || []).filter(j => j.date >= debut31 && j.date <= bornes.fin);
    const hs = dern.length > 0 && dern.every(j => j.valeur === 0);
    const ref = enPeriode(joursR, bRef);
    return { horsService: hs, joursControles: dern.length, depuisReference: hs && ref.length > 0 && ref.every(j => j.valeur === 0) };
  }

  // Comparaison avec la valeur « nette » : si un jour exceptionnel est signalé, la clarté est jugée sans lui.
  function comparerNet(jE, jR, bornes, bRef) {
    const avec = comparerPeriodes(jE, jR, bornes, bRef);
    if (avec.etat !== 'ok' || !avec.exceptionnels.length) return { avec, net: avec, dates: [], jugeSansJour: false };
    const dates = new Set(avec.exceptionnels.map(x => x.date));
    const net = comparerPeriodes(jE.filter(j => !dates.has(j.date)), jR.filter(j => !dates.has(j.date)), bornes, bRef);
    const ok = net.etat === 'ok';
    return { avec, net: ok ? net : avec, dates: [...dates].sort(), jugeSansJour: ok };
  }
  const zComparaison = c => (c && c.etat === 'ok' && c.erreurType > 0) ? Math.abs(c.ecart) / c.erreurType : null;
  const claire = c => !!c && c.etat === 'ok' && !c.dansVariationHabituelle;

  // Règle de dépassement : la variation simple S passe devant la variation masquée M si I(S) ≥ I(M),
  // z(S) ≥ k × z(M), et z calculables des deux côtés (égalité exacte avec k : S passe).
  function departagerDepassement(m, s, k) {
    if (m.z === null || s.z === null) return { passe: false, motif: 'dispersion nulle, ordre par défaut' };
    if (s.I >= m.I && s.z >= k * m.z) return { passe: true, motif: 'retenue par dépassement, z ' + s.z.toFixed(1).replace('.', ',') + ' contre ' + m.z.toFixed(1).replace('.', ',') + ', k = ' + k.toFixed(1).replace('.', ',') };
    return { passe: false, motif: 'ordre par défaut' };
  }

  function analysePiste(audE, audR, bornes, bRef, kDepassement) {
    const kDep = (typeof kDepassement === 'number' && kDepassement > 0) ? kDepassement : K_DEPASSEMENT;
    const parCle = {};
    CARBURANTS.forEach(c => {
      const jE = joursLitresCarburant(audE, c.cle), jR = joursLitresCarburant(audR, c.cle);
      const hs = horsServiceCarburant(jE, jR, bornes, bRef);
      parCle[c.cle] = { cle: c.cle, nom: c.nom, jE, jR, horsService: hs.horsService, joursControles: hs.joursControles, depuisReference: hs.depuisReference };
    });
    const actifs = CARBURANTS.filter(c => !parCle[c.cle].horsService).map(c => parCle[c.cle]);
    const somme = (cote) => {
      const m = new Map();
      actifs.forEach(f => f[cote].forEach(j => m.set(j.date, (m.get(j.date) || 0) + j.valeur)));
      return [...m.entries()].map(([date, valeur]) => ({ date, valeur })).filter(j => j.valeur > 0);
    };
    const totE = somme('jE'), totR = somme('jR');
    const resE = resumerParJour(totE, bornes), resR = resumerParJour(totR, bRef);
    const sommeMoyE = actifs.reduce((s, f) => s + (resumerParJour(f.jE, bornes).moyenne || 0), 0);
    const sommeMoyR = actifs.reduce((s, f) => s + (resumerParJour(f.jR, bRef).moyenne || 0), 0);
    const carburants = CARBURANTS.map(c => {
      const f = parCle[c.cle];
      if (f.horsService) return { cle: c.cle, nom: c.nom, horsService: true, joursControles: f.joursControles, depuisReference: f.depuisReference };
      const rE = resumerParJour(f.jE, bornes), rR = resumerParJour(f.jR, bRef);
      const cn = comparerNet(f.jE, f.jR, bornes, bRef);
      return {
        cle: c.cle, nom: c.nom, horsService: false, moyenneE: rE.moyenne, moyenneR: rR.moyenne,
        partE: rE.moyenne !== null && sommeMoyE > 0 ? rE.moyenne / sommeMoyE : null,
        partR: rR.moyenne !== null && sommeMoyR > 0 ? rR.moyenne / sommeMoyR : null,
        cmp: cn.net, cmpAvec: cn.avec, datesExceptionnelles: cn.dates, jugeSansJour: cn.jugeSansJour,
        z: zComparaison(cn.net), claire: claire(cn.net),
      };
    });
    const T = comparerNet(totE, totR, bornes, bRef);
    const total = { moyenneE: resE.moyenne, moyenneR: resR.moyenne, cmp: T.net, cmpAvec: T.avec, datesExceptionnelles: T.dates, jugeSansJour: T.jugeSansJour,
      z: zComparaison(T.net), claire: claire(T.net), jours: resE.jours, joursRef: resR.jours };
    const horsServiceNoms = carburants.filter(f => f.horsService).map(f => f.nom);
    if (T.net.etat !== 'ok') return { etat: 'insuffisant', carburants, total, candidats: [], retenue: null, motif: null, k: kDep, seuilPartPoints: SEUIL_PART_POINTS, horsService: horsServiceNoms };

    const signe = x => x > 0 ? 1 : x < 0 ? -1 : 0;
    const actifsOk = carburants.filter(f => !f.horsService && f.cmp && f.cmp.etat === 'ok');
    const candidats = [];
    // (a) variation masquée : un carburant net que le total ne montre pas (total non net, ou sens opposé).
    let m = null;
    actifsOk.forEach(f => {
      if (!f.claire) return;
      if (total.claire && signe(f.cmp.ecart) === signe(total.cmp.ecart)) return;
      if (!m || (f.z === null ? -1 : f.z) > (m.z === null ? -1 : m.z)) m = f;
    });
    if (m) candidats.push({ type: 'masquee', carburant: m.cle, nom: m.nom, I: Math.abs(m.cmp.ecart), z: m.z });
    // (b) changement de répartition d'au moins SEUIL_PART_POINTS points (au moins deux carburants actifs).
    if (actifsOk.length >= 2 && sommeMoyE > 0 && sommeMoyR > 0) {
      let b = null;
      actifsOk.forEach(f => {
        if (f.partE === null || f.partR === null) return;
        const pts = (f.partE - f.partR) * 100;
        if (Math.abs(pts) >= SEUIL_PART_POINTS && (!b || Math.abs(pts) > Math.abs(b.points))) b = { carburant: f.cle, nom: f.nom, points: pts };
      });
      if (b) candidats.push(Object.assign({ type: 'repartition' }, b));
    }
    // (c) variation simple des litres totaux.
    if (total.claire) candidats.push({ type: 'variation', I: Math.abs(total.cmp.ecart), z: total.z });
    let motif = candidats.length ? 'ordre par défaut' : null;
    const a = candidats.find(x => x.type === 'masquee'), c = candidats.find(x => x.type === 'variation');
    if (a && c) {
      const d = departagerDepassement(a, c, kDep);
      motif = d.motif;
      if (d.passe) { candidats.splice(candidats.indexOf(c), 1); candidats.unshift(c); }
    }
    return { etat: 'ok', carburants, total, candidats, retenue: candidats[0] || null, motif, k: kDep, seuilPartPoints: SEUIL_PART_POINTS, horsService: horsServiceNoms };
  }

  // ------------------------------------------------------------
  // Lot D3 « FDJ : composition grattage et tirages » : calculs purs sur les lignes déjà lues.
  // Lecture seule, filtrée par site ; rien n'est écrit, rien n'est estimé.
  //   - Deux familles seulement : grattage (ca_grattage) et tirages (caisse_tirages), jours à deux quarts contrôlés.
  //     Total = grattage + tirages, sans double compte. Pas de détail par jeu de tirage.
  //   - Contribution signée d'une famille = écart de sa moyenne par jour ; part = contribution ÷ écart du total.
  //   - Constat : cite la famille dont la part dépasse strictement 50 % (les deux sinon) ; si les deux
  //     contributions sont de signes opposés et dépassent chacune l'écart net, c'est une compensation.
  //   - Palier de prix et jeu : grattage seulement, sur les jours complets où le détail existe (couverture montrée).
  // ------------------------------------------------------------
  const SEUIL_PART_FAMILLE = 0.5;
  // Décision de Frédéric (11/11) : une famille n'est citée seule que si sa part dépasse SEUIL_PART_FAMILLE
  // ET que l'autre famille n'est pas nette dans le même sens. Sinon, les deux sont citées.
  const AUTRE_FAMILLE_NETTE_EMPECHE_CITATION_SEULE = true;
  const FAMILLES_FDJ = [
    { cle: 'grattage', nom: 'Grattage', champ: 'ca_grattage', article: 'le grattage' },
    { cle: 'tirages', nom: 'Tirages', champ: 'caisse_tirages', article: 'les tirages' },
  ];
  function joursFamilleFdj(fdjRows, cle) {
    const f = FAMILLES_FDJ.find(x => x.cle === cle);
    return (fdjRows || []).filter(r => r && r.date && Number(r.nb_quarts_controles) >= 2)
      .map(r => ({ date: r.date, valeur: Number(r[f.champ]) || 0 }));
  }

  function constatCompositionFdj(total, familles) {
    if (!total || !total.claire) return null;
    const D = total.cmpAvec.ecart;
    if (!(Math.abs(D) > 0)) return null;
    const mot = D > 0 ? 'Hausse' : 'Baisse';
    const [g, t] = familles;
    const cg = g.contribution, ct = t.contribution;
    const verbe = c => c > 0 ? 'monte' : 'baisse';
    if (cg * ct < 0 && Math.abs(cg) > Math.abs(D) && Math.abs(ct) > Math.abs(D)) {
      return { type: 'compensation', texte: 'Le ' + g.nom.toLowerCase() + ' ' + verbe(cg) + ', les ' + t.nom.toLowerCase() + ' ' + verbe(ct), familles: [] };
    }
    // Une seule famille n'est citée que si sa part dépasse strictement 50 % ET que l'autre ne varie pas nettement
    // dans le même sens (G5) : deux familles nettes de même sens portent ensemble la variation (attendu Production 53 % / 47 %).
    const fortes = familles.filter(f => f.part !== null && f.part > SEUIL_PART_FAMILLE);
    const autreNette = AUTRE_FAMILLE_NETTE_EMPECHE_CITATION_SEULE && fortes.length === 1 && familles.some(f => f !== fortes[0] && f.claire && f.contribution * D > 0);
    if (fortes.length === 1 && !autreNette) return { type: 'famille', texte: mot + ' portée par ' + fortes[0].article, familles: [fortes[0].cle] };
    return { type: 'deux', texte: mot + ' portée par le grattage et les tirages', familles: ['grattage', 'tirages'] };
  }

  function analyseFdj(fdjE, fdjR, bornes, bRef, kDepassement) {
    const kDep = (typeof kDepassement === 'number' && kDepassement > 0) ? kDepassement : K_DEPASSEMENT;
    const jT = rows => joursCaFdjComplets(rows);
    const totE = jT(fdjE), totR = jT(fdjR);
    const cnT = comparerNet(totE, totR, bornes, bRef);
    const rT = resumerParJour(totE, bornes), rTR = resumerParJour(totR, bRef);
    const total = { nom: 'Total', moyenneE: rT.moyenne, moyenneR: rTR.moyenne, cmp: cnT.net, cmpAvec: cnT.avec,
      datesExceptionnelles: cnT.dates, jugeSansJour: cnT.jugeSansJour, z: zComparaison(cnT.net), claire: claire(cnT.net) };
    if (cnT.avec.etat !== 'ok') return { etat: 'insuffisant', total, familles: [], constat: null, candidats: [], retenue: null, motif: null, k: kDep };
    const D = cnT.avec.ecart;
    const familles = FAMILLES_FDJ.map(f => {
      const jE = joursFamilleFdj(fdjE, f.cle), jR = joursFamilleFdj(fdjR, f.cle);
      const cn = comparerNet(jE, jR, bornes, bRef);
      const contribution = cn.avec.etat === 'ok' ? cn.avec.ecart : null;
      return { cle: f.cle, nom: f.nom, article: f.article, moyenneE: cn.avec.moyenneEtudiee, moyenneR: cn.avec.moyenneReference,
        cmp: cn.net, cmpAvec: cn.avec, datesExceptionnelles: cn.dates, jugeSansJour: cn.jugeSansJour,
        z: zComparaison(cn.net), claire: claire(cn.net), contribution, part: (contribution !== null && D !== 0) ? contribution / D : null };
    });
    const constat = constatCompositionFdj(total, familles);
    // Candidats de découverte : (a) variation masquée, (c) variation simple du total (avec la composition en facteur).
    const signe = x => x > 0 ? 1 : x < 0 ? -1 : 0;
    const candidats = [];
    let m = null;
    familles.forEach(f => {
      if (!f.claire) return;
      if (total.claire && signe(f.cmp.ecart) === signe(total.cmp.ecart)) return;
      if (!m || (f.z === null ? -1 : f.z) > (m.z === null ? -1 : m.z)) m = f;
    });
    if (m) candidats.push({ type: 'masquee', famille: m.cle, nom: m.nom, I: Math.abs(m.cmp.ecart), z: m.z });
    if (total.claire) candidats.push({ type: 'variation', I: Math.abs(total.cmp.ecart), z: total.z });
    let motif = candidats.length ? 'ordre par défaut' : null;
    const a = candidats.find(x => x.type === 'masquee'), c = candidats.find(x => x.type === 'variation');
    if (a && c) {
      const d = departagerDepassement(a, c, kDep);
      motif = d.motif;
      if (d.passe) { candidats.splice(candidats.indexOf(c), 1); candidats.unshift(c); }
    }
    return { etat: 'ok', total, familles, constat, candidats, retenue: candidats[0] || null, motif, k: kDep };
  }

  // Détail par palier ou par jeu (grattage seulement). lignes : {date, cle, ca}. Seuls comptent les jours complets
  // (deux quarts contrôlés) ; un jour complet sans ligne de détail n'est pas couvert : il n'est jamais complété à 0.
  function detailGrattageFdj(fdjE, fdjR, lignesE, lignesR, bornes, bRef, cleDe) {
    const cote = (fdj, lignes, p) => {
      const complets = new Set(joursCaFdjComplets(fdj).map(j => j.date).filter(d => d >= p.debut && d <= p.fin));
      const parJour = new Map();
      (lignes || []).forEach(l => {
        if (!l || !complets.has(l.date)) return;
        const k = cleDe(l);
        if (k === null || k === undefined) return;
        const j = parJour.get(l.date) || new Map();
        j.set(k, (j.get(k) || 0) + (Number(l.ca) || 0));
        parJour.set(l.date, j);
      });
      return { complets: complets.size, couverts: parJour.size, parJour };
    };
    const E = cote(fdjE, lignesE, bornes), R = cote(fdjR, lignesR, bRef);
    const cles = new Set();
    [E, R].forEach(c => c.parJour.forEach(j => j.forEach((_, k) => cles.add(k))));
    const moy = (c, k) => { let s = 0; c.parJour.forEach(j => { s += j.get(k) || 0; }); return c.couverts ? s / c.couverts : null; };
    const lignes = [...cles].map(k => {
      const mE = moy(E, k), mR = moy(R, k);
      return { cle: k, moyenneE: mE, moyenneR: mR, contribution: (mE !== null && mR !== null) ? mE - mR : null };
    }).filter(l => l.contribution !== null);
    return { couvertureE: { couverts: E.couverts, complets: E.complets }, couvertureR: { couverts: R.couverts, complets: R.complets },
      complete: E.couverts === E.complets && R.couverts === R.complets && E.complets > 0, lignes };
  }
  function detailPaliersFdj(fdjE, fdjR, tiersE, tiersR, bornes, bRef) {
    const d = detailGrattageFdj(fdjE, fdjR, tiersE, tiersR, bornes, bRef, l => l.palier === null || l.palier === undefined ? null : Number(l.palier));
    d.lignes.sort((a, b) => a.cle - b.cle);
    return d;
  }
  function detailJeuxFdj(fdjE, fdjR, jeuxE, jeuxR, bornes, bRef, nomsJeux, limite) {
    const d = detailGrattageFdj(fdjE, fdjR, jeuxE, jeuxR, bornes, bRef, l => l.game_id === null || l.game_id === undefined ? null : String(l.game_id));
    d.lignes.forEach(l => { l.nom = (nomsJeux && nomsJeux[l.cle]) || 'Jeu ' + l.cle; });
    d.lignes.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    d.lignes = d.lignes.slice(0, limite || 5);
    return d;
  }

  // Quantile 97,5 % de la loi de Student (test bilatéral à 5 %), développement de Cornish-Fisher.
  function studentCritique5(df) {
    const z = 1.959964;
    return z + (z * z * z + z) / (4 * df) + (5 * Math.pow(z, 5) + 16 * z * z * z + 3 * z) / (96 * df * df);
  }
  // Valeurs d'un jour moins la moyenne de son jour de semaine.
  function residusJourSemaine(jours) {
    const somme = {}, nb = {};
    jours.forEach(j => { const k = jourSemaineISO(j.date); somme[k] = (somme[k] || 0) + j.valeur; nb[k] = (nb[k] || 0) + 1; });
    return jours.map(j => { const k = jourSemaineISO(j.date); return j.valeur - somme[k] / nb[k]; });
  }
  function correlationResidus(joursA, joursB) {
    const a = residusJourSemaine(joursA), b = residusJourSemaine(joursB), n = a.length;
    const ma = moyenneTab(a), mb = moyenneTab(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb); }
    if (!(saa > 0 && sbb > 0)) return { n, r: null, t: null, df: n - 8, significative: false };
    const r = sab / Math.sqrt(saa * sbb), df = n - 8;
    const t = df > 0 ? r * Math.sqrt(df / Math.max(1e-12, 1 - r * r)) : null;
    return { n, r, t, df, significative: df > 0 && Math.abs(t) >= studentCritique5(df) };
  }

  const SEUIL_RELATION_JOURS = 30;
  // Boutique et FDJ : jours de la période où piste, boutique et FDJ sont complets ; relation des écarts au jour de semaine.
  function relationBoutiqueFdj(auditsRows, fdjRows, bornes) {
    const boutique = enPeriode(joursCaBoutique(auditsRows), bornes);
    const litres = enPeriode(joursLitresCompletsPiste(auditsRows), bornes);
    const fdj = new Map(enPeriode(joursCaFdjComplets(fdjRows), bornes).map(j => [j.date, j.valeur]));
    const dates = boutique.filter(j => fdj.has(j.date)).map(j => j.date);
    const pris = new Set(dates);
    const B = boutique.filter(j => pris.has(j.date));
    const L = litres.filter(j => pris.has(j.date));
    const F = B.map(j => ({ date: j.date, valeur: fdj.get(j.date) }));
    if (B.length < SEUIL_RELATION_JOURS || L.length !== B.length) {
      return { etat: 'insuffisant', n: B.length, seuil: SEUIL_RELATION_JOURS };
    }
    const bf = correlationResidus(B, F), bl = correlationResidus(B, L), lf = correlationResidus(L, F);
    if (!bf.significative) return { etat: 'non-significative', n: B.length, seuil: SEUIL_RELATION_JOURS, boutiqueFdj: bf, boutiqueLitres: bl, litresFdj: lf };
    return { etat: 'ok', n: B.length, seuil: SEUIL_RELATION_JOURS, dates, boutiqueFdj: bf, boutiqueLitres: bl, litresFdj: lf };
  }

  // FDJ au quart 1 : rapport des moyennes Q1/Q2 (comparerQuarts), arrondi au dixième.
  function rapportFdjQuart1(cmpQuartsFdj) {
    if (!cmpQuartsFdj || cmpQuartsFdj.etat !== 'ok' || !(cmpQuartsFdj.q2.moyenne > 0)) return null;
    const rapport = Math.round(cmpQuartsFdj.q1.moyenne / cmpQuartsFdj.q2.moyenne * 10) / 10;
    return { rapport, q1: cmpQuartsFdj.q1, q2: cmpQuartsFdj.q2 };
  }

  // ------------------------------------------------------------
  const SOURCES_DONNEES = [
    { id: 'audits_caisse', nom: 'Audits de caisse (piste + boutique)', statut: 'connectee' },
    { id: 'litrage_carburant', nom: 'Litrage carburant (GO / SP95 / GNR)', statut: 'connectee' },
    { id: 'prix_carburants', nom: 'Prix carburants mensuels', statut: 'connectee' },
    { id: 'equipe', nom: 'Présence équipe (piste / boutique)', statut: 'connectee' },
    { id: 'jours_feries', nom: 'Calendrier jours fériés', statut: 'connectee' },
    { id: 'ventes_horaires', nom: 'Ventes par tranche horaire', statut: 'prevue' },
    { id: 'meteo', nom: 'Météo locale (Open-Meteo)', statut: 'connectee' },
    { id: 'planning', nom: "Rythme d'équipe (Nexus Planning — via audits de caisse, plannings pas encore publiés)", statut: 'connectee' },
    { id: 'promotions', nom: 'Promotions en cours (page dédiée Campagne NEXUS)', statut: 'connectee' },
    { id: 'sante_stock', nom: 'Indice santé stock (Scanner Stock)', statut: 'connectee' },
    { id: 'ruptures', nom: 'Ruptures de stock (Scanner Stock)', statut: 'prevue' },
    { id: 'evenements_locaux', nom: 'Événements locaux', statut: 'prevue' },
    { id: 'inventaires', nom: 'Inventaires (Scanner Stock)', statut: 'connectee' },
    { id: 'capital_nexus', nom: 'Impact des décisions (Capital NEXUS)', statut: 'connectee' },
    { id: 'vacances_scolaires', nom: 'Vacances scolaires (académie Martinique)', statut: 'connectee' },
    { id: 'ponts', nom: 'Ponts calendaires', statut: 'connectee' },
  ];

  // ------------------------------------------------------------
  // Lot D2 « Boutique : marge par catégorie » (Guardian 6807845745, 6808820162).
  // Calculs purs sur les lignes `products` déjà lues. Marges réelles seulement (hors produits d'appel).
  // Les imports sont des agrégats de période : jamais de marge par quart ni par date déduite.
  //   - Étudiée = dernière période d'import ; référence = périodes d'import précédentes cumulées
  //     jusqu'à couvrir au moins la même durée.
  //   - Comparabilité (G5) : rapport de durées ≤ 2, écart de vacances et de fériés ≤ 20 points.
  //     Comparabilité faible : la comparaison est gardée, avec sa raison. « Tendance non déterminée »
  //     seulement quand aucune référence ne peut être constituée.
  //   - Marge globale éligible : |écart par jour| ≥ SEUIL_MARGE_GLOBALE_PCT ou ≥ SEUIL_MARGE_GLOBALE_EUROS_JOUR.
  //   - Catégorie candidate : écart ≥ SEUIL_CATEGORIE_EUROS_JOUR (en valeur absolue, € par jour).
  //   - A2 : une catégorie est citée seule si elle explique strictement plus de SEUIL_CONCENTRATION_CATEGORIE
  //     de la variation nette de la marge.
  //   - Types de découverte, ordre par défaut : (a) masquée / compensation, (b) décrochage chiffre
  //     d'affaires / marge, (c) variation simple. Pas de doublon : si (b) tient, il cite les catégories
  //     de (a), qui n'ouvrent pas de découverte à part ; une seule découverte Boutique est retenue.
  // ------------------------------------------------------------
  const SEUIL_MARGE_GLOBALE_PCT = 0.03;
  const SEUIL_MARGE_GLOBALE_EUROS_JOUR = 30;
  const SEUIL_CATEGORIE_EUROS_JOUR = 30;
  const SEUIL_CONCENTRATION_CATEGORIE = 0.5;
  const SEUIL_CA_DECROCHAGE_PCT = 0.03;
  const CATEGORIE_SANS_NOM = 'Sans catégorie';

  function analyseBoutique(productsRows, articlesAppel, analyserPeriodes, lignesFeries) {
    const vide = (etat, extra) => Object.assign({ etat, etudiee: null, reference: null, global: null, categories: [], candidats: [], retenue: null, motif: null, comparabilite: null,
      seuils: { margePct: SEUIL_MARGE_GLOBALE_PCT, margeEuros: SEUIL_MARGE_GLOBALE_EUROS_JOUR, categorieEuros: SEUIL_CATEGORIE_EUROS_JOUR, concentration: SEUIL_CONCENTRATION_CATEGORIE } }, extra || {});
    const appel = new Set(articlesAppel || []);
    const propres = (productsRows || []).filter(r => r && !appel.has(r.article) && (Number(r.ca) || 0) > 0 && (Number(r.marge) || 0) >= 0 && (Number(r.marge) || 0) <= (Number(r.ca) || 0));
    const { periodesTriees } = analyserPeriodes(propres);
    if (!periodesTriees.length) return vide('absent');
    const pE = periodesTriees[0];
    const refs = [];
    let joursRef = 0;
    for (let i = 1; i < periodesTriees.length && joursRef < pE.duree; i++) { refs.push(periodesTriees[i]); joursRef += periodesTriees[i].duree; }
    if (!refs.length) return vide('sans_reference', { etudiee: { debut: pE.debut, fin: pE.fin, jours: pE.duree } });
    const etudiee = { debut: pE.debut, fin: pE.fin, jours: pE.duree };
    const reference = { debut: refs[refs.length - 1].debut, fin: refs[0].fin, jours: joursRef, periodes: refs.map(r => ({ debut: r.debut, fin: r.fin, jours: r.duree })) };
    // Comparabilité : les calendriers des périodes d'import cumulées s'additionnent.
    const calE = compositionCalendrier(pE, lignesFeries);
    const calsR = refs.map(r => compositionCalendrier(r, lignesFeries));
    const sum = k => calsR.reduce((t, c) => t + c[k], 0);
    const calR = { jours: joursRef, vacances: sum('vacances'), feries: sum('feries'), weekends: sum('weekends'),
      pctVacances: sum('vacances') / joursRef, pctFeries: sum('feries') / joursRef, pctWeekends: sum('weekends') / joursRef };
    const comparabilite = evaluerComparabilite(etudiee, reference, calE, calR, []);
    comparabilite.calE = calE; comparabilite.calR = calR;
    // Agrégation par catégorie, par jour.
    const agr = (rows, jours) => {
      const m = {};
      rows.forEach(r => { const c = (r.categorie && String(r.categorie).trim()) || CATEGORIE_SANS_NOM;
        if (!m[c]) m[c] = { marge: 0, ca: 0 }; m[c].marge += Number(r.marge) || 0; m[c].ca += Number(r.ca) || 0; });
      Object.values(m).forEach(v => { v.marge /= jours; v.ca /= jours; });
      return m;
    };
    const clesR = new Set(refs.map(r => r.debut + '|' + r.fin));
    const mE = agr(propres.filter(r => r.periode_debut === pE.debut && r.periode_fin === pE.fin), pE.duree);
    const mR = agr(propres.filter(r => clesR.has(r.periode_debut + '|' + r.periode_fin)), joursRef);
    const noms = Array.from(new Set(Object.keys(mE).concat(Object.keys(mR))));
    const tot = m => Object.values(m).reduce((t, v) => ({ marge: t.marge + v.marge, ca: t.ca + v.ca }), { marge: 0, ca: 0 });
    const tE = tot(mE), tR = tot(mR);
    const ecart = tE.marge - tR.marge;
    const pctMarge = tR.marge > 0 ? ecart / tR.marge : null;
    const pctCa = tR.ca > 0 ? (tE.ca - tR.ca) / tR.ca : null;
    const eligible = (pctMarge !== null && Math.abs(pctMarge) >= SEUIL_MARGE_GLOBALE_PCT) || Math.abs(ecart) >= SEUIL_MARGE_GLOBALE_EUROS_JOUR;
    const global = { margeE: tE.marge, margeR: tR.marge, caE: tE.ca, caR: tR.ca, ecart, pctMarge, pctCa, eligible, sens: ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'stable' };
    const categories = noms.map(nom => {
      const e = mE[nom] || { marge: 0, ca: 0 }, r = mR[nom] || { marge: 0, ca: 0 };
      const contribution = e.marge - r.marge;
      return { nom, margeE: e.marge, margeR: r.marge, caE: e.ca, caR: r.ca, contribution, contributionCa: e.ca - r.ca,
        candidate: Math.abs(contribution) >= SEUIL_CATEGORIE_EUROS_JOUR, part: ecart !== 0 ? contribution / ecart : null };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const base = { etudiee, reference, global, categories, comparabilite, seuils: vide('x').seuils };
    // Comparabilité faible : on garde la comparaison et on affiche la raison (comme Piste et FDJ).
    const cand = categories.filter(c => c.candidate);
    // Évolution masquée : une catégorie à 30 € par jour ou plus (hausse ou baisse), même seule, dont le sens
    // n'est pas celui du total, ou dont le total est stable. La compensation en est le cas où deux sens s'opposent.
    const masquantes = cand.filter(c => !eligible || (c.contribution > 0) !== (ecart > 0));
    const hausses2 = cand.some(c => c.contribution > 0), baisses2 = cand.some(c => c.contribution < 0);
    const candidats = [];
    if (masquantes.length) candidats.push({ type: 'masquee', categories: cand.map(c => c.nom) });
    const caBouge = pctCa !== null && Math.abs(pctCa) >= SEUIL_CA_DECROCHAGE_PCT;
    const decroche = caBouge && (!eligible || (ecart > 0) !== (tE.ca - tR.ca > 0));
    if (decroche) candidats.push({ type: 'decrochage', categories: cand.map(c => c.nom) });
    const forte = eligible ? categories.find(c => c.part !== null && c.part > SEUIL_CONCENTRATION_CATEGORIE) : null;
    if (eligible) candidats.push({ type: 'simple', categorie: forte ? forte.nom : null });
    let retenue = null, motif = 'aucune variation à signaler';
    const dec = candidats.find(c => c.type === 'decrochage'), mas = candidats.find(c => c.type === 'masquee');
    if (dec) {
      retenue = dec;
      motif = mas ? 'le décrochage cite les catégories concernées, l\'évolution masquée n\'ouvre pas de découverte à part' : 'décrochage entre chiffre d\'affaires et marge';
    } else if (mas) { retenue = mas; motif = hausses2 && baisses2 ? 'compensation entre catégories' : 'évolution masquée par une catégorie'; }
    else if (candidats.length) { retenue = candidats[0]; motif = forte ? 'une catégorie explique plus de la moitié de la variation' : 'variation de la marge sans catégorie dominante'; }
    return Object.assign(vide('ok'), base, { candidats, retenue, motif });
  }

  // ------------------------------------------------------------
  // Lot D4 « Sélecteur global des découvertes » : fonctions pures, aucune règle nouvelle.
  //   - Candidats : ceux que les moteurs produisent déjà (Piste, FDJ, Boutique) et la relation boutique/FDJ.
  //   - Filtre : un candidat non net n'est pas une découverte. Il reste dans la fiche de son activité.
  //   - Rang : masqué, répartition, découplage (1) ; variation simple (2) ; relation croisée (3).
  //     Dans une activité, l'ordre du moteur (dépassement k compris) est conservé ; entre activités, aucun départage par z.
  //   - Diversité : le premier candidat de chaque activité, puis on complète jusqu'à NB_DECOUVERTES_ACCUEIL.
  //     La relation croisée n'est prise que s'il reste une place.
  //   - Fraîcheur : même sélecteur sur la période précédente, sans mémoire stockée. Une découverte déjà retenue
  //     dans le même sens descend de RANGS_PERDUS_FRAICHEUR rang ; sens opposé ou période précédente non nette : aucun effet.
  // ------------------------------------------------------------
  const NB_DECOUVERTES_ACCUEIL = 3;
  const RANGS_PERDUS_FRAICHEUR = 1;
  const ACTIVITES_DECOUVERTES = ['piste', 'boutique', 'fdj'];
  const RANG_PRIORITE = { masquee: 1, repartition: 1, decrochage: 1, variation: 2, simple: 2, relation: 3, rupture: 3, mois: 3 };
  const LIBELLE_PRIORITE = { masquee: 'masqué', repartition: 'répartition', decrochage: 'découplage', variation: 'variation simple', simple: 'variation simple', relation: 'relation croisée', rupture: 'changement durable', mois: 'mois inhabituel' };
  const signeDec = x => x > 0 ? 1 : x < 0 ? -1 : 0;

  // Candidats normalisés d'une activité, dans l'ordre du moteur : { etat, motif, candidats:[{activite, type, cle, sens, rang, net, source}] }.
  function candidatsDecouvertes(activite, analyse) {
    if (!analyse || analyse.etat !== 'ok') return { etat: analyse && analyse.etat ? analyse.etat : 'absent', motif: null, candidats: [] };
    const fab = (type, cle, sens, source) => ({ activite, type, cle: cle || '', sens, rang: RANG_PRIORITE[type], net: true, source });
    let liste = [];
    if (activite === 'piste') {
      liste = (analyse.candidats || []).map(c => {
        const f = c.carburant ? analyse.carburants.find(x => x.cle === c.carburant) : null;
        const sens = c.type === 'masquee' ? signeDec(f && f.cmp ? f.cmp.ecart : 0) : c.type === 'repartition' ? signeDec(c.points) : signeDec(analyse.total.cmp.ecart);
        return fab(c.type, c.carburant, sens, c);
      });
    } else if (activite === 'fdj') {
      liste = (analyse.candidats || []).map(c => {
        const f = c.famille ? analyse.familles.find(x => x.cle === c.famille) : null;
        const sens = c.type === 'masquee' ? signeDec(f && f.cmp ? f.cmp.ecart : 0) : signeDec(analyse.total.cmp.ecart);
        return fab(c.type, c.famille, sens, c);
      });
    } else if (activite === 'boutique') {
      const g = analyse.global || {};
      const tous = analyse.candidats || [];
      const dec = tous.find(c => c.type === 'decrochage');
      // Le découplage cite déjà les catégories : l'évolution masquée n'ouvre pas de découverte à part.
      const ordre = [analyse.retenue].concat(tous.filter(c => c !== analyse.retenue && !(dec && c.type === 'masquee'))).filter(Boolean);
      liste = ordre.map(c => {
        let sens;
        if (c.type === 'decrochage') sens = signeDec((g.caE || 0) - (g.caR || 0));
        else if (c.type === 'masquee') {
          const cat = (analyse.categories || []).find(x => x.nom === (c.categories || [])[0]);
          sens = signeDec(cat ? cat.contribution : g.ecart);
        } else sens = signeDec(g.ecart);
        return fab(c.type, (c.categories || [c.categorie]).filter(Boolean).join('|'), sens, c);
      });
    }
    return { etat: 'ok', motif: analyse.motif || null, candidats: liste };
  }
  function candidatRelation(rel) {
    if (!rel || rel.etat !== 'ok') return { etat: rel && rel.etat ? rel.etat : 'absent', motif: null, candidats: [] };
    return { etat: 'ok', motif: null, candidats: [{ activite: 'croise', type: 'relation', cle: '', sens: signeDec(rel.boutiqueFdj && rel.boutiqueFdj.r), rang: 3, net: !!(rel.boutiqueFdj && rel.boutiqueFdj.significative), source: rel }] };
  }
  const trierDec = liste => liste.map((c, i) => ({ c, i })).sort((a, b) => a.c.rang - b.c.rang || a.i - b.i).map(x => x.c);
  // Sélection sans fraîcheur. entrees = { piste, boutique, fdj, croise } (sorties de candidatsDecouvertes / candidatRelation).
  function classerDecouvertes(entrees, nb) {
    const n = typeof nb === 'number' ? nb : NB_DECOUVERTES_ACCUEIL;
    const premiers = [], suite = [];
    ACTIVITES_DECOUVERTES.forEach(a => {
      const e = entrees && entrees[a];
      if (!e || e.etat !== 'ok') return;
      e.candidats.filter(c => c.net !== false).forEach((c, i) => (i === 0 ? premiers : suite).push(Object.assign({}, c, { positionActivite: i + 1, motifMoteur: i === 0 ? e.motif : null })));
    });
    const croises = entrees && entrees.croise && entrees.croise.etat === 'ok'
      ? entrees.croise.candidats.filter(c => c.net !== false).map(c => Object.assign({}, c, { positionActivite: 1, motifMoteur: null })) : [];
    // Un candidat par activité d'abord, puis la suite dans l'ordre de priorité ; la relation croisée passe en dernier.
    // Découvertes historiques (lot D5b) : même rang que la relation croisée, après elle, dans l'ordre fourni (rupture, mois inhabituel, activités).
    const historiques = entrees && entrees.historique && entrees.historique.etat === 'ok'
      ? entrees.historique.candidats.filter(c => c.net !== false).map(c => Object.assign({}, c, { positionActivite: 1, motifMoteur: null, historique: true })) : [];
    return trierDec(trierDec(premiers).concat(trierDec(suite)).concat(croises).concat(historiques).slice(0, n));
  }
  // Raison réelle pour laquelle la période précédente ne peut pas servir de repère.
  function raisonNonEvaluable(e) {
    const etat = e && e.etat ? e.etat : 'absent';
    if (etat === 'sans_reference') return 'la période précédente n\'a pas de période de référence pour être comparée.';
    if (etat === 'absent') return 'la période précédente n\'a pas de mesure pour cette activité.';
    if (etat === 'insuffisant') {
      const cmp = e && e.total && e.total.cmp;
      const min = cmp && cmp.minimum;
      const pE = cmp && min != null && cmp.minEtudiee < min, pR = cmp && min != null && cmp.minReference < min;
      if (pE && !pR) return 'la période précédente n\'a pas assez de jours mesurés.';
      if (pR && !pE) return 'la référence de la période précédente n\'a pas assez de jours mesurés.';
      return 'la période précédente ou sa référence n\'a pas assez de jours mesurés.';
    }
    return 'la période précédente n\'a pas pu être comparée à sa référence pour cette activité.';
  }
  const NOM_ACTIVITE_DEC = { piste: 'Piste', boutique: 'Boutique', fdj: 'FDJ', croise: 'Boutique et FDJ' };
  // Découvertes nettes qui n'ont pas eu de place, nommées une à une. Une relation non significative n'est pas une découverte.
  function decouvertesEcartees(entrees, choix) {
    const pris = (choix || []).map(c => identiteDec(c));
    const tous = classerDecouvertes(entrees, 99);
    return tous.filter(c => pris.indexOf(identiteDec(c)) < 0)
      .map(c => NOM_ACTIVITE_DEC[c.activite] + ' : ' + LIBELLE_PRIORITE[c.type] + detailHistorique(c));
  }
  // Une découverte historique écartée est nommée avec sa période : « mois inhabituel (octobre 2026) », « changement durable depuis le 12/10 ».
  function detailHistorique(c) {
    if (!c.historique) return '';
    if (c.type === 'mois') return c.source && c.source.mois && c.source.mois.libelle ? ' (' + c.source.mois.libelle + ')' : '';
    const d = /^\d{4}-(\d{2})-(\d{2})$/.exec(c.cle || '');
    return d ? ' depuis le ' + d[2] + '/' + d[1] : '';
  }
  // Un découplage Boutique porte sur la boutique entière : les catégories citées sont des facteurs mesurés, pas le périmètre.
  const identiteDec = c => [c.activite, c.type, c.type === 'decrochage' ? '' : c.cle, c.sens].join('/');
  function selectionnerDecouvertes(entrees, precedent, nb) {
    const courants = classerDecouvertes(entrees, nb);
    const prec = precedent ? classerDecouvertes(precedent, 99) : [];
    const ordinal = i => (i === 0 ? '1re' : (i + 1) + 'e');
    const decores = courants.map(c => {
      const eAct = precedent && precedent[c.activite];
      let fraicheur;
      if (c.historique) fraicheur = { etat: 'non_evaluable', perdu: false, texte: 'Fraîcheur sans objet : une découverte historique se lit sur plusieurs semaines. Aucun effet sur le rang.' };
      else if (!eAct || eAct.etat !== 'ok') fraicheur = { etat: 'non_evaluable', perdu: false, texte: 'Fraîcheur non évaluable : ' + raisonNonEvaluable(eAct) + ' Aucun effet sur le rang.' };
      else if (prec.some(p => identiteDec(p) === identiteDec(c))) fraicheur = { etat: 'evaluable', perdu: true, texte: 'Déjà retenue dans le même sens sur la période précédente : elle descend d\'un rang.' };
      else fraicheur = { etat: 'evaluable', perdu: false, texte: 'Nouvelle, ou de sens opposé à la période précédente : aucun effet sur le rang.' };
      let motifRang;
      if (c.historique) motifRang = 'Découverte historique : retenue parce qu\'une place restait après les découvertes de la période.';
      else if (c.activite === 'croise') motifRang = 'Relation croisée : retenue parce qu\'une place restait.';
      else if (c.positionActivite === 1 && c.motifMoteur && /dépassement/.test(c.motifMoteur)) motifRang = c.motifMoteur.charAt(0).toUpperCase() + c.motifMoteur.slice(1) + '.';
      else motifRang = ordinal(c.positionActivite - 1) + ' de son activité, ordre de priorité : ' + LIBELLE_PRIORITE[c.type] + '.';
      return Object.assign({}, c, { fraicheur, motifRang });
    });
    const ordonnes = decores.map((c, i) => ({ c, cle: i + (c.fraicheur.perdu ? RANGS_PERDUS_FRAICHEUR + 0.5 : 0) })).sort((a, b) => a.cle - b.cle).map(x => x.c);
    return ordonnes.map((c, i) => Object.assign(c, { rangAffiche: i + 1 }));
  }

  // Vocabulaire d'évolution (lot V4) : fonction pure, jamais de conclusion sur le seul pourcentage.
  function libelleEvolution(cmp) {
    if (!cmp || cmp.etat !== 'ok' || cmp.pct === null || cmp.pct === undefined) return 'Tendance non déterminée';
    if (cmp.dansVariationHabituelle) return 'Variation habituelle';
    return cmp.ecart < 0 ? 'Baisse confirmée' : cmp.ecart > 0 ? 'Hausse confirmée' : 'Variation habituelle';
  }

  // ------------------------------------------------------------
  // Lot D5a : mois contre mois précédent, en moyenne par jour complet (jamais en total).
  // Un mois ne compte qu'avec au moins OCCURRENCES_MIN_JOUR occurrences de chaque jour de la semaine en jours complets ;
  // le mois en cours, incomplet, est exclu. Fonctions pures : aucune lecture, aucune écriture.
  const DEBUT_MOIS_PISTE = '2026-08-01'; // audits depuis le 18/07 : juillet est incomplet
  const DEBUT_MOIS_FDJ = '2026-01-01';
  const JOURS_MANQUANTS_MAX_MOIS = 1; // un jour complet manquant par mois est toléré (arbitrage du 12/11/2026), jamais deux
  const ECART_JOURS_COMPOSITION_MAX = 0; // composition des jours : même nombre de chaque jour de la semaine
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function bornesMois(cle) {
    const [a, m] = cle.split('-').map(Number);
    const nb = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { debut: cle + '-01', fin: cle + '-' + pad2(nb), jours: nb };
  }
  function moisPrecedentCle(cle) {
    const [a, m] = cle.split('-').map(Number);
    return m === 1 ? (a - 1) + '-12' : a + '-' + pad2(m - 1);
  }
  function libelleMois(cle) {
    const [a, m] = cle.split('-').map(Number);
    return NOM_MOIS[m - 1] + ' ' + a;
  }
  // Clés 'AAAA-MM' des mois entiers écoulés : de la date de disponibilité au mois précédant celui de la date du jour.
  function clesMoisEcoules(debutDispo, exclu) {
    const out = [];
    const fin = exclu.slice(0, 7);
    for (let c = debutDispo.slice(0, 7); c < fin; c = (() => { const [a, m] = c.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + pad2(m + 1); })()) out.push(c);
    return out;
  }
  function comptesJoursSemaine(jours) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    jours.forEach(j => { c[jourSemaineISO(j.date)]++; });
    return c;
  }
  function libelleJourSemaine(i, n) { return n + ' ' + NOM_JOURS[i].toLowerCase() + (n > 1 ? 's' : ''); }

  // « 1 jeudi manquant (17/09) » : le jour complet absent d'un mois retenu, avec sa date.
  function mentionManquants(manq) {
    if (!manq || !manq.length) return null;
    const par = {};
    manq.forEach(x => { (par[x.jour] = par[x.jour] || []).push(x.date); });
    return Object.keys(par).map(j => par[j].length + ' ' + j + (par[j].length > 1 ? 's' : '') + ' manquant' + (par[j].length > 1 ? 's' : '')
      + ' (' + par[j].map(d => d.slice(8, 10) + '/' + d.slice(5, 7)).join(', ') + ')').join(', ');
  }

  // jours : [{date, valeur}] des jours complets. Retourne un élément par mois écoulé, du plus ancien au plus récent.
  function moisParMois(jours, debutDispo, exclu, lignesFeries) {
    const cles = clesMoisEcoules(debutDispo, exclu);
    const parMois = cles.map(cle => {
      const b = bornesMois(cle);
      const js = enPeriode(jours, b);
      const valeurs = js.map(j => j.valeur);
      const total = valeurs.reduce((s, x) => s + x, 0);
      const compte = comptesJoursSemaine(js);
      const present = new Set(js.map(j => j.date));
      const manquants = [];
      datesDeLaPeriode(b).forEach(d => { if (!present.has(d) && compte[jourSemaineISO(d)] < OCCURRENCES_MIN_JOUR) manquants.push({ jour: NOM_JOURS[jourSemaineISO(d)].toLowerCase(), date: d }); });
      const deficit = compte.reduce((a, n) => a + Math.max(0, OCCURRENCES_MIN_JOUR - n), 0);
      return { cle, libelle: libelleMois(cle), bornes: b, jours: js, nbJours: js.length, total, moyenne: js.length ? total / js.length : null,
        compte, manquants, assez: js.length > 0 && deficit <= JOURS_MANQUANTS_MAX_MOIS };
    });
    return parMois.map((m, i) => {
      const sortie = { cle: m.cle, libelle: m.libelle, bornes: m.bornes, nbJours: m.nbJours, total: m.total, moyenne: m.moyenne, assez: m.assez,
        manquants: m.assez ? m.manquants : [], mentionManquants: m.assez ? mentionManquants(m.manquants) : null,
        evolution: null, comparabilite: null, precedent: null, cmp: null };
      const p = i > 0 && parMois[i - 1].cle === moisPrecedentCle(m.cle) ? parMois[i - 1] : null;
      if (!m.assez || !p) return sortie;
      sortie.precedent = p.cle;
      if (!p.assez) return sortie;
      const cmp = comparerPeriodes(m.jours, p.jours, m.bornes, p.bornes, JOURS_MANQUANTS_MAX_MOIS);
      sortie.cmp = cmp;
      sortie.evolution = libelleEvolution(cmp);
      // Comparabilité : calendrier (G5) et composition des jours, affichées sans bloquer.
      const calE = compositionCalendrier(m.bornes, lignesFeries), calR = compositionCalendrier(p.bornes, lignesFeries);
      const comp = evaluerComparabilite(m.bornes, p.bornes, calE, calR, (cmp.exceptionnels || []).map(x => ({ activite: x.periode === 'etudiee' ? 'ce mois' : 'mois précédent', date: x.date })));
      const raisons = comp.raisons.slice();
      const ecarts = m.compte.map((n, k) => ({ k, n, nPrec: p.compte[k] })).filter(x => Math.abs(x.n - x.nPrec) > ECART_JOURS_COMPOSITION_MAX);
      if (ecarts.length) {
        raisons.push({ critere: 'composition', texte: 'composition des jours inégale (' + ecarts.map(x => libelleJourSemaine(x.k, x.n) + ' contre ' + x.nPrec).join(', ') + ')' });
      }
      sortie.comparabilite = { faible: raisons.length > 0, raisons };
      return sortie;
    });
  }

  // Phrase d'un mois, toujours au passé (« Ce mois a été … », jamais au présent). Aucune saisonnalité affirmée.
  function phraseMois(m) {
    if (!m || !m.assez) return 'Ce mois n’a pas assez de jours complets pour être comparé.';
    if (!m.evolution) return 'Ce mois a été le premier mesuré, ou son précédent n\u2019a pas pu être comparé.';
    if (m.evolution === 'Baisse confirmée') return 'Ce mois a été en baisse nette par rapport au mois précédent.';
    if (m.evolution === 'Hausse confirmée') return 'Ce mois a été en hausse nette par rapport au mois précédent.';
    if (m.evolution === 'Variation habituelle') return 'Ce mois a été dans la variation habituelle du mois précédent.';
    return 'Ce mois a été sans tendance déterminée par rapport au mois précédent.';
  }

  // Carte « Mois » : lignes du graphique, de l'infobulle et du tableau, tirées d'un seul calcul (moisParMois).
  // Hauteur = moyenne par jour complet, jamais le total. Un mois non retenu garde sa place, sans hauteur.
  // Aucun mot d'affichage ici : tout vient de NexusVocab.mois.
  function barresMois(mois, activite, fdjRows) {
    const V = typeof window !== 'undefined' ? window.NexusVocab : null;
    const M = V && V.mois;
    if (!M || !Array.isArray(mois)) return [];
    const a = activite === 'fdj' ? M.fdj : M.piste;
    return mois.map((m, i) => {
      const retenu = !!m.assez && m.moyenne != null;
      const mm = Number(m.cle.slice(5, 7));
      const lignes = [m.libelle];
      // cmp.pct est une fraction (0,167) ; le lexique et l'écran affichent des pourcentages (16,7).
      const pct = retenu && m.cmp && m.cmp.etat === 'ok' && m.cmp.pct != null ? m.cmp.pct * 100 : null;
      if (retenu) {
        lignes.push(M.moyenne(m.moyenne, a), M.jours(m.nbJours));
        if (m.evolution) lignes.push(M.evolution(m.evolution, pct));
        else lignes.push(M.sansEvolution);
        if (m.comparabilite && m.comparabilite.faible) (m.comparabilite.raisons || []).forEach(r => lignes.push(M.fiabilite + ' : ' + r.texte));
        if (m.mentionManquants) lignes.push(M.mentionManquants(m.mentionManquants));
        if (activite === 'fdj' && i > 0) {
          const c = compositionMoisFdj(fdjRows, m, mois[i - 1]);
          if (c) lignes.push(c);
        }
      } else {
        lignes.push(M.nonRetenu);
      }
      return {
        cle: m.cle, libelle: m.libelle, court: M.courts[mm - 1], annee: m.cle.slice(0, 4),
        retenu, hauteur: retenu ? m.moyenne : null, nbJours: m.nbJours,
        marqueManquant: retenu && !!m.mentionManquants, manquants: retenu ? m.mentionManquants || null : null,
        evolution: retenu ? m.evolution || null : null,
        pct,
        fragile: retenu && !!(m.comparabilite && m.comparabilite.faible),
        lignes,
      };
    });
  }

  // FDJ : composition grattage / tirages d'un mois par la règle D3 (analyseFdj), seulement si l'écart du mois est net.
  function compositionMoisFdj(fdjRows, m, p) {
    if (!m || !p || !m.cmp || m.cmp.etat !== 'ok' || m.cmp.dansVariationHabituelle) return null;
    const rows = (b) => (fdjRows || []).filter(r => r && r.date >= b.debut && r.date <= b.fin);
    const af = analyseFdj(rows(m.bornes), rows(p.bornes), m.bornes, p.bornes);
    return af && af.etat === 'ok' && af.constat ? af.constat.texte : null;
  }


  // ------------------------------------------------------------
  // Lot D5b : rupture de tendance et mois inhabituel (découvertes historiques). Fonctions pures, aucune lecture.
  // Semaines du lundi au dimanche, entières, jusqu'au dernier jour complet. Tendance précédente = moyenne par jour complet des
  // 8 semaines qui précèdent les 4 dernières. Il y a rupture quand chacune des 4 dernières semaines est du même côté de cette
  // moyenne ET que la moyenne des 4 semaines s'en écarte nettement (Welch, 2 erreurs types). Au moins 12 semaines d'historique.
  const SEMAINES_RECENTES = 4, SEMAINES_PRECEDENTES = 8, JOURS_SEMAINE_MIN = 6; // 6 jours complets par semaine : arbitrage du 12/11/2026
  function ruptureTendance(jours, fin) {
    const nonEval = motif => ({ etat: 'non_evaluable', motif, rupture: false });
    if (!fin) return nonEval('aucun jour complet n\'est disponible.');
    let dim = fin;
    while (jourSemaineISO(dim) !== 0) dim = decalerJourISO(dim, -1);
    const total = SEMAINES_RECENTES + SEMAINES_PRECEDENTES;
    const semaines = []; // 0 = la plus récente
    for (let k = 0; k < total; k++) {
      const b = { debut: decalerJourISO(dim, -6 - 7 * k), fin: decalerJourISO(dim, -7 * k) };
      const js = enPeriode(jours, b);
      semaines.push({ bornes: b, jours: js, moyenne: js.length ? moyenneTab(js.map(j => j.valeur)) : null });
    }
    if (semaines.some(w => w.jours.length < JOURS_SEMAINE_MIN)) return nonEval('il faut ' + total + ' semaines d\'historique avec au moins ' + JOURS_SEMAINE_MIN + ' jours complets chacune.');
    const rec = semaines.slice(0, SEMAINES_RECENTES), prec = semaines.slice(SEMAINES_RECENTES);
    const vR = [].concat.apply([], rec.map(w => w.jours.map(j => j.valeur))), vP = [].concat.apply([], prec.map(w => w.jours.map(j => j.valeur)));
    const mR = moyenneTab(vR), mP = moyenneTab(vP);
    const se = Math.sqrt(varianceEchantillon(vR, mR) / vR.length + varianceEchantillon(vP, mP) / vP.length);
    const ecart = mR - mP;
    const dessus = rec.every(w => w.moyenne > mP), dessous = rec.every(w => w.moyenne < mP);
    const nette = se > 0 ? Math.abs(ecart) > SEUIL_ECART_TYPES * se : ecart !== 0;
    const memeCote = dessus || dessous;
    const rupture = memeCote && nette;
    return { etat: 'ok', rupture, sens: ecart > 0 ? 1 : ecart < 0 ? -1 : 0,
      depuis: rec[SEMAINES_RECENTES - 1].bornes.debut, jusqu: rec[0].bornes.fin, debutPrecedent: prec[prec.length - 1].bornes.debut,
      moyenneRecente: mR, moyennePrecedente: mP, pct: pourcentage(mR, mP), ecart, erreurType: se, memeCote, nette,
      semainesRecentes: rec.map(w => ({ debut: w.bornes.debut, moyenne: w.moyenne })).reverse(), nbJoursRecents: vR.length, nbJoursPrecedents: vP.length };
  }
  function phraseRupture(r, unite, fmt) {
    const f = fmt || (x => String(Math.round(x)));
    if (!r || r.etat !== 'ok') return 'Le changement durable n\u2019a pas pu être évalué : ' + (r && r.motif ? r.motif : 'pas de donnée.');
    const d = r.depuis.slice(8, 10) + '/' + r.depuis.slice(5, 7);
    if (!r.rupture) return 'Pas de changement durable : ' + (r.memeCote ? 'les quatre dernières semaines sont du même côté, mais l\u2019écart à la tendance précédente reste dans la variation habituelle.' : 'les quatre dernières semaines ne sont pas toutes du même côté de la tendance précédente.');
    return 'Changement durable depuis le ' + d + ' : ' + f(r.moyenneRecente) + ' ' + unite + ' par jour complet, contre ' + f(r.moyennePrecedente) + ' ' + unite + ' avant.';
  }
  // Mois inhabituel : le dernier mois entier écoulé, s'il a été en hausse ou en baisse nette par rapport au mois précédent (D5a).
  function moisInhabituel(mois) {
    const m = mois && mois.length ? mois[mois.length - 1] : null;
    if (!m || !m.assez || !m.cmp || m.cmp.etat !== 'ok') return { etat: 'non_evaluable', motif: 'le dernier mois n\u2019a pas pu être comparé au précédent.', inhabituel: false, mois: m };
    const inhabituel = m.evolution === 'Hausse confirmée' || m.evolution === 'Baisse confirmée';
    return { etat: 'ok', inhabituel, sens: signeDec(m.cmp.ecart), mois: m };
  }
  // Entrée « historique » du sélecteur : ruptures d'abord, puis mois inhabituels, chacun dans l'ordre des activités.
  function candidatsHistoriques(parActivite) {
    const ordre = ['piste', 'fdj'], cands = [];
    ordre.forEach(a => { const x = parActivite && parActivite[a]; if (x && x.rupture && x.rupture.etat === 'ok') cands.push({ activite: a, type: 'rupture', cle: x.rupture.depuis, sens: x.rupture.sens, rang: 3, net: x.rupture.rupture, source: x.rupture }); });
    ordre.forEach(a => { const x = parActivite && parActivite[a]; if (x && x.mois && x.mois.etat === 'ok') cands.push({ activite: a, type: 'mois', cle: x.mois.mois.cle, sens: x.mois.sens, rang: 3, net: x.mois.inhabituel, source: x.mois }); });
    return { etat: 'ok', motif: null, candidats: cands };
  }

  // Synthèse « En bref » : une ligne de période, trois phrases au plus, une note de prudence à part.
  // Bâtie uniquement sur ce que la page affiche déjà : aucun calcul, aucune source, aucune consigne.
  // Ordre : 1) situation générale, ce qui est stable d'abord, puis ce qui bouge après « tandis que » ;
  // 2) première découverte retenue, avec ses chiffres et son motif (masqué, découplage) ; 3) autre évolution notable, si elle existe.
  const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateLongue = (iso, avecAnnee) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    return Number(m[3]) + (Number(m[3]) === 1 ? 'er' : '') + ' ' + MOIS_LONGS[Number(m[2]) - 1] + (avecAnnee ? ' ' + m[1] : '');
  };
  const casseMinuscule = t => (/^[A-ZÉÈÊ][a-zéèêàâîïôûùç]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const sansPoint = t => String(t || '').trim().replace(/[.\s]+$/, '');
  function syntheseEnBref(entree) {
    const e = entree || {};
    const acts = e.activites || [];
    const V = typeof window !== 'undefined' && window.NexusVocab && window.NexusVocab.enBref;
    if (!acts.length || !V) return { periode: '', texte: '', note: '' };
    const per = e.periode && e.periode.debut && e.periode.fin ? e.periode : null;
    const periode = per ? 'Du ' + dateLongue(per.debut, per.debut.slice(0, 4) !== per.fin.slice(0, 4)) + ' au ' + dateLongue(per.fin, true) + '.' : '';
    const imp = e.importBoutique && e.importBoutique.debut && e.importBoutique.fin
      ? 'import du ' + dateLongue(e.importBoutique.debut, e.importBoutique.debut.slice(0, 4) !== e.importBoutique.fin.slice(0, 4)) + ' au ' + dateLongue(e.importBoutique.fin, true) : '';
    const liste = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l[0];
    const maj = t => t.charAt(0).toUpperCase() + t.slice(1);
    const stables = [], hausses = [], baisses = [], inconnus = [];
    acts.forEach(a => {
      const c = V.classe(a.evol);
      const reserves = [];
      if (a.nom === 'Boutique' && imp) reserves.push(imp);
      if (a.reserve) reserves.push(a.reserve);
      const parenth = reserves.length ? ' (' + reserves.join(', ') + ')' : '';
      const pct = /^[+−-]/.test(String(a.evol)) ? String(a.evol).split(' · ')[0].trim().replace(/^[+−-]\s*/, '') : '';
      const it = { nom: a.nom, parenth, pct };
      (c === 'stable' ? stables : c === 'hausse' ? hausses : c === 'baisse' ? baisses : inconnus).push(it);
    });
    // Ce qui est stable : un seul verbe, un seul sujet. Aucun pourcentage.
    const partieStable = stables.length ? V.maintient + ' ' + liste(stables.map(x => V.sujet(x.nom, true) + x.parenth)) : '';
    // Ce qui bouge : un verbe par sens ; le pourcentage n'est donné que lorsqu'un seul sujet porte ce sens.
    const mouv = (l, classe) => {
      if (!l.length) return '';
      const seul = l.length === 1;
      return liste(l.map(x => V.sujet(x.nom, false) + x.parenth)) + ' ' + V.mouvement(classe, !seul, seul ? l[0].pct : '');
    };
    const bouge = [mouv(hausses, 'hausse'), mouv(baisses, 'baisse')].filter(Boolean);
    let s1 = partieStable && bouge.length ? partieStable + ', ' + V.contraste + ' ' + liste(bouge) : (partieStable || liste(bouge) || '');
    if (inconnus.length) {
      const absent = V.absente + ' ' + liste(inconnus.map(x => V.sujet(x.nom, false) + x.parenth));
      s1 = s1 ? s1 + ', mais ' + absent : absent;
    }
    const phrases = s1 ? [maj(s1) + '.'] : [];
    const d1 = e.decouverte;
    const titre1 = d1 && d1.titre ? sansPoint(d1.titre) : '';
    if (titre1) {
      const clause = V.masquee(d1.activite, d1.sens);
      phrases.push(V.attention + casseMinuscule(titre1) + (clause ? ', ' + clause : '') + '.');
    }
    const titre2 = e.decouverte2 && e.decouverte2.titre ? sansPoint(e.decouverte2.titre) : '';
    if (titre1 && titre2) phrases.push(V.aNoter + casseMinuscule(titre2) + '.');
    const note = e.faible === true ? V.prudence : '';
    return { periode, texte: phrases.join(' '), note };
  }

  // ------------------------------------------------------------
  // Carte « Quels sont mes jours forts et faibles ? » (Tempo V2, Analyses).
  // UNE fonction pour toutes les mesures : elle reçoit des jours complets
  // [{date, valeur}] et ne connaît ni litres, ni euros, ni marge.
  //   - Moyenne par jour complet (jamais un total), mêmes semaines pour les sept jours.
  //   - Fériés, ponts et journées exceptionnelles (médiane, MAD) sortent de la moyenne
  //     et sont rendus dans `ecartes` : rien n'est écarté sans être nommé.
  //   - Un jour de la semaine sous OCCURRENCES_MIN_JOUR occurrences reste grisé, sans moyenne ;
  //     tant qu'un jour est grisé, aucun jour n'est désigné.
  //   - Désigné : écart à la moyenne des six autres jours au-delà de SEUIL_ECART_TYPES erreurs
  //     types (Welch). Sinon « habituel ». Tri fort -> faible seulement si un jour est désigné ;
  //     sinon l'ordre de la semaine reste intact (lundi -> dimanche).
  // Aucun mot d'affichage ici : tout vient de NexusVocab.jours (voir lignesJours).
  // ------------------------------------------------------------
  function joursFortsFaibles(jours, bornes, lignesFeries) {
    const feriesSite = new Set((lignesFeries || []).filter(l => l && l.date && l.type === 'ferie').map(l => String(l.date).slice(0, 10)));
    const libelles = new Map();
    (lignesFeries || []).forEach(l => { if (l && l.date && l.type === 'ferie' && l.libelle) libelles.set(String(l.date).slice(0, 10), String(l.libelle).trim()); });
    const dansLaPeriode = enPeriode((jours || []).filter(j => j && j.date && Number.isFinite(j.valeur)), bornes);
    const ecartes = [];
    const ordinaires = [];
    dansLaPeriode.forEach(j => {
      const q = qualifierJourSpecial(j.date, feriesSite, libelles);
      if (q) ecartes.push({ date: j.date, motif: q.type, nom: q.nom || null, sens: q.sens || null });
      else ordinaires.push(j);
    });
    // Méthode commune de Tempo (médiane, MAD) appliquée à TOUS les jours ordinaires de la période,
    // jamais jour de semaine par jour de semaine. Le résultat est montré sans, puis avec ces journées.
    const exceptionnels = joursExceptionnels(ordinaires);
    // Garde des rythmes : sur les occurrences exploitables d'un jour de semaine (au moins OCCURRENCES_MIN_JOUR),
    // si au moins SEUIL_RYTHME_RECURRENT d'entre elles sont hors norme dans un seul et même sens (au-dessus ou
    // en dessous de la médiane commune), ces journées restent dans l'analyse. Sens opposés : jamais un rythme.
    const rythmes = [];
    const gardes = new Set();
    if (exceptionnels.length) {
      const med = medianeTab(ordinaires.map(j => j.valeur));
      ORDRE_JOURS_SEMAINE.forEach(js => {
        const occ = ordinaires.filter(j => jourSemaineISO(j.date) === js);
        if (occ.length < OCCURRENCES_MIN_JOUR) return;
        const exJ = exceptionnels.filter(j => jourSemaineISO(j.date) === js);
        const haut = exJ.filter(j => j.valeur > med), bas = exJ.filter(j => j.valeur < med);
        const actif = l => l.length / occ.length >= SEUIL_RYTHME_RECURRENT;
        if (actif(haut) === actif(bas)) return;
        const l = actif(haut) ? haut : bas;
        l.forEach(j => gardes.add(j.date));
        rythmes.push({ jourSemaine: js, sens: l === haut ? 'au-dessus' : 'en-dessous', nb: l.length, occurrences: occ.length });
      });
    }
    const exc = new Set(exceptionnels.map(j => j.date));
    const excApres = new Set(exceptionnels.filter(j => !gardes.has(j.date)).map(j => j.date));
    exceptionnels.filter(j => !gardes.has(j.date)).forEach(j => ecartes.push({ date: j.date, motif: 'exceptionnel', nom: null, sens: null, valeur: j.valeur }));
    ecartes.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const analyser = retenus => {
      const valeurs = ORDRE_JOURS_SEMAINE.map(() => []);
      retenus.forEach(j => { valeurs[ORDRE_JOURS_SEMAINE.indexOf(jourSemaineISO(j.date))].push(j.valeur); });
      const parJour = ORDRE_JOURS_SEMAINE.map((js, i) => {
        const v = valeurs[i];
        const suffisant = v.length >= OCCURRENCES_MIN_JOUR;
        const moyenne = suffisant ? moyenneTab(v) : null;
        const ecartType = suffisant ? Math.sqrt(varianceEchantillon(v, moyenne)) : null;
        const cv = suffisant && moyenne > 0 ? ecartType / moyenne : null;
        return { jourSemaine: js, effectif: v.length, suffisant, moyenne, ecartType, cv, ecart: null, ecartPct: null, erreurType: null, verdict: suffisant ? 'habituel' : 'grise' };
      });
      const toutLisible = retenus.length > 0 && parJour.every(p => p.suffisant);
      if (toutLisible) {
        parJour.forEach((p, i) => {
          const autres = [].concat(...valeurs.filter((_, k) => k !== i));
          const mA = moyenneTab(autres), mJ = p.moyenne;
          const se = Math.sqrt(varianceEchantillon(valeurs[i], mJ) / valeurs[i].length + varianceEchantillon(autres, mA) / autres.length);
          p.ecart = mJ - mA; p.erreurType = se; p.ecartPct = mA > 0 ? (mJ - mA) / mA : null;
          const nette = se > 0 ? Math.abs(p.ecart) > SEUIL_ECART_TYPES * se : p.ecart !== 0;
          p.verdict = nette ? (p.ecart > 0 ? 'au-dessus' : 'en-dessous') : 'habituel';
        });
      }
      const designe = toutLisible && parJour.some(p => p.verdict !== 'habituel');
      const etat = retenus.length === 0 ? 'absent' : (!toutLisible ? 'insuffisant' : (designe ? 'designe' : 'ressemblent'));
      const ordre = designe ? parJour.slice().sort((a, b) => b.moyenne - a.moyenne) : parJour.slice();
      return { etat, designe, parJour, ordre, nbJours: retenus.length };
    };
    const sans = analyser(ordinaires.filter(j => !excApres.has(j.date)));
    const avantGarde = analyser(ordinaires.filter(j => !exc.has(j.date)));
    const avec = analyser(ordinaires);
    const changements = sans.parJour.filter((p, i) => p.verdict !== avec.parJour[i].verdict).map(p => p.jourSemaine);
    const changementsGarde = avantGarde.parJour.filter((p, i) => p.verdict !== sans.parJour[i].verdict).map(p => p.jourSemaine);
    return Object.assign({}, sans, { ecartes, avec, avantGarde, rythmes, changementsGarde, changements, aDesExceptionnels: exceptionnels.length > 0, debut: bornes.debut, fin: bornes.fin, seuil: OCCURRENCES_MIN_JOUR, seuilRythme: SEUIL_RYTHME_RECURRENT });
  }

  // Une série par mesure : {ca: [...], marge: null, ...}. Une série absente (null) reste « indisponible »,
  // jamais vide ni estimée. Ajouter une mesure ne demande aucun changement de code.
  function joursFortsFaiblesMesures(series, bornes, lignesFeries) {
    return Object.keys(series || {}).map(cle => {
      const s = series[cle];
      return Array.isArray(s)
        ? { cle, disponible: true, resultat: joursFortsFaibles(s, bornes, lignesFeries) }
        : { cle, disponible: false, resultat: null };
    });
  }

  // Tuiles de la carte : données seules, aucun texte. Rien hors de l'état « designe ».
  // Jour récurrent = jour désigné par G5 (plus grand écart aux six autres s'il y en a plusieurs).
  // Plus forte / plus faible moyenne = classement descriptif, montré seulement si ce n'est pas le même jour.
  function tuilesJours(res) {
    if (!res || res.etat !== 'designe') return null;
    const rythmes = (res.rythmes || []).map(r => r.jourSemaine);
    const tuile = (p, role, ref) => ({
      role, jourSemaine: p.jourSemaine, moyenne: p.moyenne, ecart: p.ecart, verdict: p.verdict, effectif: p.effectif,
      cv: p.cv, irregulier: !!(ref && p.verdict === 'habituel' && ref.cv > 0 && p.cv != null && p.cv >= RATIO_CV_IRREGULIER * ref.cv),
      rythme: rythmes.indexOf(p.jourSemaine) > -1,
    });
    const cote = (verdict, signe) => {
      const designes = res.parJour.filter(p => p.verdict === verdict).sort((a, b) => signe * (b.ecart - a.ecart));
      const ref = designes[0] || null;
      const extreme = res.parJour.slice().sort((a, b) => signe * (b.moyenne - a.moyenne))[0];
      return {
        recurrent: ref ? tuile(ref, 'recurrent', null) : null,
        moyenne: !ref || extreme.jourSemaine !== ref.jourSemaine ? tuile(extreme, 'moyenne', ref) : null,
      };
    };
    return { haut: cote('au-dessus', 1), bas: cote('en-dessous', -1) };
  }

  // Textes de la carte, tous tirés de NexusVocab.jours. Sans lexique : rien.
  function lignesJours(res, mesure) {
    const V = typeof window !== 'undefined' ? window.NexusVocab : null;
    const J = V && V.jours;
    if (!J || !res) return null;
    const m = J[mesure] || J.piste;
    const etiquette = p => J.verdicts[p.verdict];
    return {
      jours: res.ordre.map(p => ({
        jourSemaine: p.jourSemaine, nom: J.noms[p.jourSemaine], moyenne: p.moyenne, verdict: p.verdict, etiquette: etiquette(p),
        lignes: p.suffisant
          ? [J.noms[p.jourSemaine], J.moyenne(p.moyenne, m), J.occurrences(p.effectif), J.ecartAutres(p.ecartPct, res.designe || res.etat === 'ressemblent'), etiquette(p)].filter(Boolean)
          : [J.noms[p.jourSemaine], J.pasAssez(p.effectif, res.seuil)],
      })),
      constat: J.constat[res.etat] || '',
      tuiles: (() => {
        const t = tuilesJours(res);
        if (!t || !J.tuiles) return null;
        const mise = (x, c) => x && {
          role: x.role, titre: J.tuiles.titres[x.role][c],
          jourSemaine: x.jourSemaine, nom: J.noms[x.jourSemaine], moyenne: J.tuiles.moyenne(x.moyenne, m), ecart: J.tuiles.ecart(x.ecart, m),
          etiquette: J.verdicts[x.verdict], irregulier: x.irregulier ? J.tuiles.irregulier : '', rythme: x.rythme ? J.tuiles.rythme : '',
        };
        const jours = [];
        ['haut', 'bas'].forEach(c => ['recurrent', 'moyenne'].forEach(r => { if (t[c][r] && jours.indexOf(t[c][r].jourSemaine) < 0) jours.push(t[c][r].jourSemaine); }));
        const nomsJours = js => J.noms[js];
        return {
          haut: [mise(t.haut.recurrent, 'haut'), mise(t.haut.moyenne, 'haut')].filter(Boolean),
          bas: [mise(t.bas.recurrent, 'bas'), mise(t.bas.moyenne, 'bas')].filter(Boolean),
          lecture: (lh => [lh, J.tuiles.lecture(t.bas, 'bas', m, nomsJours, !!lh)].filter(Boolean).join(' '))(J.tuiles.lecture(t.haut, 'haut', m, nomsJours, false)),
          preuve: J.tuiles.preuve(jours.map(js => ({ nom: J.noms[js], effectif: res.parJour.filter(p => p.jourSemaine === js)[0].effectif }))),
        };
      })(),
      ecartes: res.ecartes.length ? J.ecartes(res.ecartes, m) : '',
      rythmes: res.rythmes && res.rythmes.length && J.rythmes ? {
        texte: J.rythmes.texte(res.rythmes.map(r => ({ nom: J.noms[r.jourSemaine], sens: r.sens, nb: r.nb, occurrences: r.occurrences }))),
        avantApres: J.rythmes.avantApres(res.changementsGarde.map(js => J.noms[js]), res.avantGarde.etat, res.etat),
      } : null,
      avecSans: res.aDesExceptionnels && J.avecSans ? {
        titre: J.avecSans.titre,
        jours: res.avec.parJour.map((p, i) => ({
          jourSemaine: p.jourSemaine, nom: J.noms[p.jourSemaine], change: res.changements.indexOf(p.jourSemaine) > -1,
          effectifSans: res.parJour[i].effectif, effectifAvec: p.effectif,
          texte: J.avecSans.ligne(J.noms[p.jourSemaine], p, m, res.parJour[i], res.changements.indexOf(p.jourSemaine) > -1),
        })),
        resume: J.avecSans.resume(res.changements.map(js => J.noms[js]), res.avec.etat),
        echantillon: J.avecSans.echantillon(res.nbJours, res.avec.nbJours),
      } : null,
    };
  }

  // ------------------------------------------------------------
  // Carte « Les vacances changent-elles mon activité ? » (12/11/2026, arbitrages A, B, C de Frédéric).
  // Calcul pur, aucun mot d'affichage (tout vient de NexusVocab.vacances).
  //   - Deux groupes comparés chacun à « hors vacances », à jour de semaine égal : petites vacances
  //     (Toussaint, Noël, Carnaval, Pâques) et vacances d'été. Le pont de l'Ascension n'entre dans aucun groupe.
  //   - G5 par groupe : 4 jours complets au moins par jour de semaine, des deux côtés, sinon ce jour est insuffisant.
  //   - Fériés et ponts exclus des deux côtés (comptés). Jours hors norme : résultat sans eux et avec eux.
  //   - Fenêtre : 52 semaines closes (lundi au dimanche), jour en cours exclu (date station), bornée au début des données.
  //   - Verdict par groupe : 4 jours de semaine lisibles sur 7 au moins ; écart net si la moitié des jours lisibles
  //     vont dans le même sens et qu'aucun écart net ne va dans l'autre ; sens opposés : partage ; sinon pas d'écart net.
  // ------------------------------------------------------------
  const FENETRE_VACANCES_SEMAINES = 52;
  const JOURS_LISIBLES_MIN_VACANCES = 4;
  const GROUPES_VACANCES = ['petites', 'ete'];
  function groupeDeVacances(libelle) {
    const l = String(libelle || '').toLowerCase();
    if (/ascension/.test(l)) return 'pont';
    if (/toussaint|noël|noel|carnaval|pâques|paques|pascal/.test(l)) return 'petites';
    if (/été|grandes vacances/.test(l)) return 'ete';
    return 'autre';
  }
  function fenetreVacances(joursTous, aujourdhui) {
    const dimanche = j => { let d = j; while (jourSemaineISO(d) !== 0) d = decalerJourISO(d, -1); return d; };
    const fin = dimanche(decalerJourISO(aujourdhui, -1));
    const debutTheorique = decalerJourISO(fin, -(7 * FENETRE_VACANCES_SEMAINES - 1));
    const dates = (joursTous || []).map(j => j.date).filter(Boolean).sort();
    const premier = dates.length ? dates[0] : null;
    const debut = premier && premier > debutTheorique ? premier : debutTheorique;
    return { debut, fin, borneParLesDonnees: !!(premier && premier > debutTheorique) };
  }
  function calculVacancesGroupe(jours, groupe) {
    const seuil = OCCURRENCES_MIN_JOUR;
    const parJour = ORDRE_JOURS_SEMAINE.map(js => {
      const V = jours.filter(j => j.groupe === groupe && jourSemaineISO(j.date) === js).map(j => j.valeur);
      const H = jours.filter(j => j.groupe === 'hors' && jourSemaineISO(j.date) === js).map(j => j.valeur);
      const suffisant = V.length >= seuil && H.length >= seuil;
      const p = { jourSemaine: js, effectifVacances: V.length, effectifHors: H.length, suffisant };
      if (!suffisant) return Object.assign(p, { sens: null, net: false, pct: null });
      const mV = moyenneTab(V), mH = moyenneTab(H), ecart = mV - mH;
      const se = Math.sqrt(varianceEchantillon(V, mV) / V.length + varianceEchantillon(H, mH) / H.length);
      const net = se > 0 ? Math.abs(ecart) > SEUIL_ECART_TYPES * se : ecart !== 0;
      return Object.assign(p, { moyenneVacances: mV, moyenneHors: mH, ecart, pct: net ? pourcentage(mV, mH) : null, net, sens: net ? (ecart > 0 ? 'hausse' : 'baisse') : null });
    });
    const lisibles = parJour.filter(p => p.suffisant);
    if (lisibles.length < JOURS_LISIBLES_MIN_VACANCES) return { etat: 'grise', verdict: null, sens: null, parJour, lisibles: lisibles.length };
    const hausse = lisibles.filter(p => p.sens === 'hausse').length, baisse = lisibles.filter(p => p.sens === 'baisse').length;
    let verdict = 'pas-ecart', sens = null;
    if (hausse > 0 && baisse > 0) verdict = 'partage';
    else if (Math.max(hausse, baisse) > 0 && Math.max(hausse, baisse) >= SEUIL_RYTHME_RECURRENT * lisibles.length) { verdict = 'net'; sens = hausse ? 'hausse' : 'baisse'; }
    return { etat: 'lisible', verdict, sens, parJour, lisibles: lisibles.length, nbHausse: hausse, nbBaisse: baisse };
  }
  function vacancesParJourSemaine(joursTous, lignesCalendrier, aujourdhui) {
    const fen = fenetreVacances(joursTous, aujourdhui);
    const lignes = (lignesCalendrier || []).filter(l => l && l.date);
    const feriesSite = new Set(lignes.filter(l => l.type === 'ferie').map(l => String(l.date).slice(0, 10)));
    const libellesFeries = new Map();
    lignes.filter(l => l.type === 'ferie' && l.libelle).forEach(l => libellesFeries.set(String(l.date).slice(0, 10), String(l.libelle).trim()));
    const vac = new Map();
    lignes.filter(l => l.type === 'vacances').forEach(l => vac.set(String(l.date).slice(0, 10), String(l.libelle || '').trim()));
    const exclus = { feries: 0, ponts: 0, ascension: 0, autres: 0 };
    const jours = [];
    (joursTous || []).filter(j => j && j.date && Number.isFinite(j.valeur) && j.date >= fen.debut && j.date <= fen.fin).forEach(j => {
      const sp = qualifierJourSpecial(j.date, feriesSite, libellesFeries);
      if (sp) { exclus[sp.type === 'ferie' ? 'feries' : 'ponts']++; return; }
      if (!vac.has(j.date)) { jours.push({ date: j.date, valeur: j.valeur, groupe: 'hors' }); return; }
      const g = groupeDeVacances(vac.get(j.date));
      if (g === 'pont') { exclus.ascension++; return; }
      if (g === 'autre') { exclus.autres++; return; }
      jours.push({ date: j.date, valeur: j.valeur, groupe: g, libelle: vac.get(j.date) });
    });
    const exc = new Set(joursExceptionnels(jours).map(j => j.date));
    const sansExc = jours.filter(j => !exc.has(j.date));
    const groupes = {};
    GROUPES_VACANCES.forEach(g => {
      const sans = calculVacancesGroupe(sansExc, g), avec = calculVacancesGroupe(jours, g);
      const pris = jours.filter(j => j.groupe === g).sort((a, b) => a.date < b.date ? -1 : 1);
      const periodes = [];
      pris.forEach(j => {
        const dernier = periodes[periodes.length - 1];
        if (dernier && dernier.libelle === j.libelle && j.date <= decalerJourISO(dernier.fin, 7)) { dernier.fin = j.date; dernier.nbJours++; }
        else periodes.push({ libelle: j.libelle, debut: j.date, fin: j.date, nbJours: 1 });
      });
      const parMois = new Array(12).fill(0);
      pris.forEach(j => { parMois[Number(j.date.slice(5, 7)) - 1]++; });
      groupes[g] = { sans, avec, periodes, nbJours: pris.length, parMois, changeAvecSans: sans.verdict !== avec.verdict || sans.etat !== avec.etat };
    });
    return {
      fenetre: fen, semaines: FENETRE_VACANCES_SEMAINES, groupes, exclus,
      nbHors: jours.filter(j => j.groupe === 'hors').length,
      exceptionnels: [...exc].sort(), aDesExceptionnels: exc.size > 0,
    };
  }

  window.NexusTempo = {
    syntheseEnBref, joursFortsFaibles, joursFortsFaiblesMesures, lignesJours, tuilesJours, RATIO_CV_IRREGULIER,
    SEUILS, NOM_JOURS, NOM_JOURS_COURT, NOM_MOIS, LITRAGE_INDISPONIBLE, VALORISATION_INDISPONIBLE, SOURCES_DONNEES, COORDONNEES_STATION,
    agregerParJour, filtrerJoursClos, regrouperParJourSemaine, calculerClassement,
    calculerPeriodesProduitsAppel, attribuerValorisationBoutique, identifierJourPlusRentable,
    identifierJoursReveles, identifierMeilleursJoursSepares, classementLitrage,
    analyserEquipe, genererDecisionPrioritaire,
    calculerMaturite, calculerConfianceGlobale, confianceActivite, joursFeries, estJourFerie, tagCalendaire,
    joursFeriesMartinique, estJourFerieMartinique, identifierPonts, estPont,
    VACANCES_SCOLAIRES_MARTINIQUE, estVacancesScolaires, definirVacances, analyserVacancesScolaires, prochainsPonts,
    analyserDebutFinMois, analyserSaisonnier, genererDecouvertes,
    croiserMeteo, analyserMeteo,
    agregerStockParJour, dernierEtatStock, croiserStock, analyserStock,
    agregerInventaireParDate, dernierEtatInventaire,
    dernierEtatCapital, analyserImpactDecisionsTempo,
    dateLocale, moyenne, ecartType, evolution,
    calculerConstatTempo, construireCandidatTempo, calculerConstatLitres, dateStationISO, FENETRE_SEMAINES, OCCURRENCES_MIN_JOUR,
    bornesPeriodeIndicateurs, joursLitresCompletsPiste, joursCaFdjComplets, resumerParJour, resumerMargeImport,
    quartsLitresPiste, quartsBoutique, quartsFdj, comparerQuarts, comparerQuartsParJour, exceptionsParJourSemaine, ORDRE_JOURS_SEMAINE,
    bornesReference, comparerPeriodes, joursExceptionnels, exclusionsPiste, exclusionsFdj,
    compositionCalendrier, analyseFeries, FERIES_OBSERVES_MIN, evaluerComparabilite, prixMoyenMesure,
    joursCaPiste, joursCaBoutique, analysePiste, departagerDepassement, joursLitresCarburant, quartsLitresCarburant, horsServiceCarburant, CARBURANTS, JOURS_HORS_SERVICE, SEUIL_PART_POINTS, K_DEPASSEMENT, correlationResidus, relationBoutiqueFdj, rapportFdjQuart1, SEUIL_RELATION_JOURS,
    libelleEvolution,
    candidatsDecouvertes, candidatRelation, classerDecouvertes, selectionnerDecouvertes, decouvertesEcartees, NB_DECOUVERTES_ACCUEIL, RANGS_PERDUS_FRAICHEUR,
    analyseBoutique, SEUIL_MARGE_GLOBALE_PCT, SEUIL_MARGE_GLOBALE_EUROS_JOUR, SEUIL_CATEGORIE_EUROS_JOUR, SEUIL_CONCENTRATION_CATEGORIE, SEUIL_CA_DECROCHAGE_PCT,
    moisParMois, barresMois, phraseMois, ruptureTendance, phraseRupture, moisInhabituel, candidatsHistoriques, compositionMoisFdj, clesMoisEcoules, bornesMois, DEBUT_MOIS_PISTE, DEBUT_MOIS_FDJ, ECART_JOURS_COMPOSITION_MAX,
    vacancesParJourSemaine, fenetreVacances, groupeDeVacances, FENETRE_VACANCES_SEMAINES,
    analyseFdj, constatCompositionFdj, detailPaliersFdj, detailJeuxFdj, joursFamilleFdj, FAMILLES_FDJ, SEUIL_PART_FAMILLE, AUTRE_FAMILLE_NETTE_EMPECHE_CITATION_SEULE,
  };
})();
