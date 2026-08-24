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
  function calculerConfianceGlobale(joursAgreges, classement) {
    const nbJours = (joursAgreges || []).length;
    const observes = (classement || []).filter(a => a.occurrences.length > 0);
    const nbJoursSemaineCouverts = observes.length;
    const nbAvecTendance = observes.filter(a => a.confianceTendance).length;
    const joursHistorique = calculerMaturite(joursAgreges).joursHistorique;

    const scoreAnciennete = Math.min(50, (joursHistorique / SEUILS.MATURITE_NIVEAU4_JOURS) * 50);
    const scoreVolume = Math.min(25, (nbJours / SEUILS.MIN_JOURS_DECISION) * 25);
    const scoreCouverture = (nbJoursSemaineCouverts / 7) * 15;
    const scoreTendances = (nbAvecTendance / 7) * 10;

    return Math.max(0, Math.min(100, Math.round(scoreAnciennete + scoreVolume + scoreCouverture + scoreTendances)));
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

  // ------------------------------------------------------------
  // Jours fériés Martinique (25/07/2026) — les jours fériés nationaux
  // plus le 22 mai (Abolition de l'esclavage, loi n°83-550 du
  // 30/06/1983), fixe chaque année quel que soit le jour de semaine.
  // ------------------------------------------------------------
  function joursFeriesMartinique(annee) {
    const feries = joursFeries(annee).slice();
    feries.push({ date: `${annee}-05-22`, nom: "Abolition de l'esclavage (Martinique)" });
    return feries.sort((a, b) => a.date < b.date ? -1 : 1);
  }

  function estJourFerieMartinique(dateStr) {
    const annee = Number(dateStr.slice(0, 4));
    const trouve = joursFeriesMartinique(annee).find(f => f.date === dateStr);
    return { ferie: !!trouve, nom: trouve ? trouve.nom : null };
  }

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

  function estVacancesScolaires(dateStr) {
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

    return {
      jourARenforcer: jourARenforcerRetenu, jourMoteur, jourPlusRentable, jourProgression, totalJours, detailOperations,
      dernierJourExploitableLe, aujourdhuiAUnControle,
    };
  }

  // Candidat Tempo enrichi pour le Conseiller (27/07/2026, demande de
  // Frédéric) : priorité au jour le plus rentable (CA valorisé, produits
  // d'appel exclus) plutôt qu'au seul jour à renforcer — structure
  // Décision → Pourquoi → Impact attendu → Preuves → Limites, avec le même
  // exemple travaillé qu'il a fourni (jeudi plus rentable, vendredi plus
  // fort en CA brut mais tiré par des produits d'appel). Retourne null si
  // aucun jour n'est identifiable. Consommée par NexusConseiller.normaliserTempo().
  function construireCandidatTempo(constatTempo) {
    const { jourPlusRentable, jourMoteur, jourARenforcer, jourProgression } = constatTempo;
    const jourCible = jourPlusRentable || jourMoteur;
    if (!jourCible) return null;

    const fmt = v => `${Math.round(v).toLocaleString('fr-FR')} €`;
    const fmtPct = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')} %`;
    const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1);
    const diverge = !!(jourPlusRentable && jourMoteur && jourPlusRentable.jourSemaine !== jourMoteur.jourSemaine);

    let pourquoi = `Le ${jourCible.nom} est actuellement la journée qui crée le plus de valeur pour votre station.`;
    let pourquoiBullets = null;
    let pourquoiPasAutre = null;

    if (jourPlusRentable) {
      pourquoiBullets = [
        `Meilleure performance piste : ${fmt(jourPlusRentable.moyennePisteValorisation)}`,
        `Meilleure estimation de valeur : ${fmt(jourPlusRentable.moyenneCombineeValorisee)}`,
        `Données issues de ${jourPlusRentable.nbOccValorisation} journée${jourPlusRentable.nbOccValorisation > 1 ? 's' : ''} exploitable${jourPlusRentable.nbOccValorisation > 1 ? 's' : ''}`,
      ];
    }
    if (diverge) {
      pourquoi += ` Le ${jourMoteur.nom} génère davantage de chiffre d'affaires brut, mais une part importante provient de produits d'appel à faible contribution.`;
      pourquoiPasAutre = {
        titre: `Pourquoi pas le ${jourMoteur.nom} ?`,
        texte: `Le chiffre d'affaires boutique y est supérieur (${fmt(jourMoteur.moyenneBoutique)}), mais il est fortement influencé par des produits d'appel (cartes prépayées, téléphonie, presse, gaz, tabac). Ces ventes génèrent beaucoup de trafic mais relativement peu de valeur.`,
      };
    } else if (jourPlusRentable) {
      pourquoi += ` Cette estimation reste cohérente une fois les produits d'appel retirés du calcul.`;
    }

    const opportunitesTempo = [];
    if (jourProgression && jourProgression.jourSemaine !== jourCible.jourSemaine && jourProgression.evolutionCombinee !== null) {
      opportunitesTempo.push({ icone: '🟢', label: majuscule(jourProgression.nom), detail: `Plus forte progression : ${fmtPct(jourProgression.evolutionCombinee)}` });
    }
    if (jourARenforcer && jourARenforcer.jourSemaine !== jourCible.jourSemaine && jourARenforcer.evolutionCombinee !== null) {
      opportunitesTempo.push({ icone: '⚠️', label: majuscule(jourARenforcer.nom), detail: `Journée la plus faible : ${fmtPct(jourARenforcer.evolutionCombinee)}` });
    }

    let limites = null;
    if (jourMoteur && jourMoteur.nbOccValorisation === 0 && jourMoteur.occurrences && jourMoteur.occurrences.length > 0) {
      limites = `Le ${jourMoteur.nom} n'a pas encore été entièrement valorisé. Sa dernière occurrence est postérieure au dernier import Produits. Le calcul sera automatiquement actualisé lors du prochain import.`;
    }

    return {
      jourCible,
      decision: `Concentrez vos prochaines actions commerciales le ${jourCible.nom}.`,
      pourquoi, pourquoiBullets, pourquoiPasAutre,
      opportunites: opportunitesTempo.length ? opportunitesTempo : null,
      impactAttendu: `En privilégiant le ${jourCible.nom} pour vos animations et mises en avant, vous exploitez la journée offrant aujourd'hui le meilleur potentiel économique.`,
      limites,
    };
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

  window.NexusTempo = {
    SEUILS, NOM_JOURS, NOM_JOURS_COURT, NOM_MOIS, LITRAGE_INDISPONIBLE, VALORISATION_INDISPONIBLE, SOURCES_DONNEES, COORDONNEES_STATION,
    agregerParJour, filtrerJoursClos, regrouperParJourSemaine, calculerClassement,
    calculerPeriodesProduitsAppel, attribuerValorisationBoutique, identifierJourPlusRentable,
    identifierJoursReveles, identifierMeilleursJoursSepares, classementLitrage,
    analyserEquipe, genererDecisionPrioritaire,
    calculerMaturite, calculerConfianceGlobale, joursFeries, estJourFerie, tagCalendaire,
    joursFeriesMartinique, estJourFerieMartinique, identifierPonts, estPont,
    VACANCES_SCOLAIRES_MARTINIQUE, estVacancesScolaires, analyserVacancesScolaires, prochainsPonts,
    analyserDebutFinMois, analyserSaisonnier, genererDecouvertes,
    croiserMeteo, analyserMeteo,
    agregerStockParJour, dernierEtatStock, croiserStock, analyserStock,
    agregerInventaireParDate, dernierEtatInventaire,
    dernierEtatCapital, analyserImpactDecisionsTempo,
    dateLocale, moyenne, ecartType, evolution,
    calculerConstatTempo, construireCandidatTempo,
  };
})();
