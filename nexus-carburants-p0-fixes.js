// NEXUS Carburants — correctifs P0 isolés (31/08/2026)
// Branche audit-carburants-p0-20260831 uniquement.
//
// Doctrine :
// - le relevé quotidien reste le jaugeage d'ouverture ;
// - une réception postérieure n'écrase jamais cette ancre ;
// - les quantités BL de Réception alimentent les calculs sans ressaisie ;
// - aucune vente intrajournalière n'est inventée tant qu'Insite360 ne fournit
//   pas de volumes réellement horodatés ;
// - une réception physiquement dupliquée/suspecte bloque la sommation
//   automatique plutôt que d'être corrigée silencieusement ;
// - un carburant non calculable ou à consommation nulle ne sert jamais à
//   compléter automatiquement un camion.
(function (global) {
  'use strict';

  var INSTALLE = false;
  var TIMER = null;

  function dateSuivanteISO(dateISO) {
    var d = new Date(dateISO + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dateMoinsJoursISO(dateISO, jours) {
    var d = new Date(dateISO + 'T12:00:00');
    d.setDate(d.getDate() - jours);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function n(v) {
    return v == null || v === '' ? null : Number(v);
  }

  function cleMesure(m) {
    return [m.carburant || '', m.cuve_id || '', n(m.jaugeage_avant_l), n(m.jaugeage_apres_l)].join(':');
  }

  function cleLigne(l) {
    return [l.carburant || '', n(l.quantite_bl_l)].join(':');
  }

  function litresIdentiques(a, b) {
    return ['litrage_gazole', 'litrage_sp95', 'litrage_gnr'].every(function (champ) {
      var av = a ? a[champ] : null;
      var bv = b ? b[champ] : null;
      return (av == null && bv == null) || Number(av) === Number(bv);
    });
  }

  // Charge les réceptions terminées sur [dateDebutIncluse, dateFinExclue),
  // somme les BL par carburant et détecte une signature physique strictement
  // identique entre deux visites distinctes le même jour. Une telle signature
  // est une EXCEPTION À ARBITRER, jamais une autorisation de doubler le BL.
  async function chargerLivraisonsDocumentaires(client, siteId, dateDebutIncluse, dateFinExclue) {
    var zero = { go: 0, sp95: 0, gnr: 0 };
    if (!dateDebutIncluse || !dateFinExclue || dateDebutIncluse >= dateFinExclue) {
      return { volumes: zero, ambigus: {}, aRapprocher: {}, visites: [], aDesVisites: false };
    }

    var qVisites = await client.from('carburant_reception_visites')
      .select('id,date_visite,heure_debut,heure_fin,statut')
      .eq('site', siteId)
      .gte('date_visite', dateDebutIncluse)
      .lt('date_visite', dateFinExclue)
      .neq('statut', 'en_cours')
      .neq('statut', 'annulee_doublon')
      .order('date_visite', { ascending: true })
      .order('heure_debut', { ascending: true });
    if (qVisites.error) {
      console.error('P0 — chargement réceptions documentaires:', qVisites.error);
      return { volumes: zero, ambigus: { global: true }, aRapprocher: {}, visites: [], aDesVisites: false, error: qVisites.error };
    }
    var visites = qVisites.data || [];
    if (!visites.length) return { volumes: zero, ambigus: {}, aRapprocher: {}, visites: [], aDesVisites: false };

    var ids = visites.map(function (v) { return v.id; });
    var resultats = await Promise.all([
      client.from('carburant_reception_visite_lignes')
        .select('visite_id,carburant,quantite_bl_l,statut')
        .in('visite_id', ids),
      client.from('carburant_reception_mesures')
        .select('visite_id,carburant,cuve_id,jaugeage_avant_l,jaugeage_apres_l')
        .in('visite_id', ids),
    ]);
    var qLignes = resultats[0], qMesures = resultats[1];
    if (qLignes.error || qMesures.error) {
      console.error('P0 — détail réceptions documentaires:', qLignes.error || qMesures.error);
      return { volumes: zero, ambigus: { global: true }, aRapprocher: {}, visites: visites, aDesVisites: true, error: qLignes.error || qMesures.error };
    }

    var lignes = qLignes.data || [];
    var mesures = qMesures.data || [];
    var lignesParVisite = {}, mesuresParVisite = {};
    ids.forEach(function (id) { lignesParVisite[id] = []; mesuresParVisite[id] = []; });
    lignes.forEach(function (l) { if (lignesParVisite[l.visite_id]) lignesParVisite[l.visite_id].push(l); });
    mesures.forEach(function (m) { if (mesuresParVisite[m.visite_id]) mesuresParVisite[m.visite_id].push(m); });

    var empreintes = {};
    visites.forEach(function (v) {
      var lignesCle = (lignesParVisite[v.id] || []).map(cleLigne).sort().join('|');
      var mesuresCle = (mesuresParVisite[v.id] || []).map(cleMesure).sort().join('|');
      var fp = v.date_visite + '#' + lignesCle + '#' + mesuresCle;
      if (!empreintes[fp]) empreintes[fp] = [];
      empreintes[fp].push(v.id);
    });

    var visitesAmbigues = new Set();
    Object.keys(empreintes).forEach(function (fp) {
      if (empreintes[fp].length > 1) empreintes[fp].forEach(function (id) { visitesAmbigues.add(id); });
    });

    var ambigus = {};
    var aRapprocher = {};
    lignes.forEach(function (l) {
      if (visitesAmbigues.has(l.visite_id) && l.carburant) ambigus[l.carburant] = true;
      if (l.statut === 'a_rapprocher' && l.carburant) aRapprocher[l.carburant] = true;
    });

    var volumes = { go: 0, sp95: 0, gnr: 0 };
    lignes.forEach(function (l) {
      if (!l.carburant || ambigus[l.carburant]) return;
      var qte = n(l.quantite_bl_l);
      if (qte != null) volumes[l.carburant] = (volumes[l.carburant] || 0) + qte;
    });

    return {
      volumes: volumes,
      ambigus: ambigus,
      aRapprocher: aRapprocher,
      visites: visites,
      visitesAmbigues: Array.from(visitesAmbigues),
      aDesVisites: true,
    };
  }

  // Historique journalier qualifié pour la prévision : une journée n'est
  // exploitable que si tous les quarts configurés existent et si le litrage
  // du carburant est renseigné sur chacun. Un Q1=Q2 strictement identique sur
  // les trois carburants est conservé comme observation, mais exclu du calcul
  // tant que la suspicion de duplication n'est pas arbitrée.
  async function chargerHistoriqueVentesQualifie(client, siteId, dateFinExclusiveISO, joursHistorique) {
    var debutISO = dateMoinsJoursISO(dateFinExclusiveISO, joursHistorique || 180);
    var resultats = await Promise.all([
      client.from('station_config').select('horaires').eq('site', siteId).maybeSingle(),
      client.from('audits_caisse')
        .select('date,quart,litrage_gazole,litrage_sp95,litrage_gnr')
        .eq('site', siteId).gte('date', debutISO).lt('date', dateFinExclusiveISO),
    ]);
    var qConfig = resultats[0], qVentes = resultats[1];
    if (qVentes.error) {
      console.error('P0 — historique ventes qualifié:', qVentes.error);
      return [];
    }

    var horaires = qConfig && !qConfig.error && qConfig.data ? (qConfig.data.horaires || {}) : {};
    var quartsAttendus = Object.keys(horaires)
      .map(function (k) { var m = /^quart(\d+)$/i.exec(k); return m ? m[1] : null; })
      .filter(Boolean)
      .sort();
    if (!quartsAttendus.length) quartsAttendus = ['1', '2'];

    var parDate = {};
    (qVentes.data || []).forEach(function (l) {
      if (!parDate[l.date]) parDate[l.date] = [];
      parDate[l.date].push(l);
    });

    var champs = { go: 'litrage_gazole', sp95: 'litrage_sp95', gnr: 'litrage_gnr' };
    return Object.keys(parDate).sort().map(function (date) {
      var lignes = parDate[date];
      var parQuart = {};
      lignes.forEach(function (l) {
        var q = String(l.quart);
        if (!parQuart[q]) parQuart[q] = [];
        parQuart[q].push(l);
      });
      var couvertureComplete = quartsAttendus.every(function (q) { return parQuart[q] && parQuart[q].length === 1; });
      var lignesAttendues = couvertureComplete ? quartsAttendus.map(function (q) { return parQuart[q][0]; }) : [];
      var suspicionDuplication = couvertureComplete && lignesAttendues.length >= 2
        && lignesAttendues.slice(1).every(function (l) { return litresIdentiques(lignesAttendues[0], l); });
      var ventes = {};
      Object.keys(champs).forEach(function (cle) {
        var champ = champs[cle];
        if (!couvertureComplete || suspicionDuplication || lignesAttendues.some(function (l) { return l[champ] == null; })) {
          ventes[cle] = null;
        } else {
          ventes[cle] = lignesAttendues.reduce(function (s, l) { return s + Number(l[champ]); }, 0);
        }
      });
      return {
        date: date,
        ventes: ventes,
        qualite: suspicionDuplication ? 'suspicion_duplication' : (couvertureComplete ? 'complete' : 'partielle'),
        quartsAttendus: quartsAttendus.length,
        quartsPresents: lignes.length,
      };
    });
  }

  function construireEvaluationGlobaleSecurisee(MC, args) {
    var toutes = args.evaluationsParCarburant || {};
    var eligibles = {};
    var caps = {};
    Object.keys(toutes).forEach(function (cle) {
      var ev = toutes[cle];
      var conso = ev ? Number(ev.consommationMoyenneJour) : NaN;
      if (!ev || ev.etat === 'non_calculable' || !Number.isFinite(conso) || conso <= 0) return;
      eligibles[cle] = ev;
      if (args.capacitesDisponiblesL && args.capacitesDisponiblesL[cle] != null) caps[cle] = args.capacitesDisponiblesL[cle];
    });

    var resultat = MC.construireEvaluationGlobale({
      evaluationsParCarburant: eligibles,
      config: args.config,
      capacitesDisponiblesL: caps,
      viserCamionComplet: args.viserCamionComplet,
    });
    resultat.parCarburant = toutes;
    resultat.etatGlobal = MC.determinerEtatGlobal(toutes);
    resultat.carburantsExclusCompletion = Object.keys(toutes).filter(function (c) { return !eligibles[c]; });
    return resultat;
  }

  function installer() {
    if (INSTALLE) return true;
    var NCD = global.NexusCarburantDonnees;
    var CMD = global.NexusCarburantCommandeDonnees;
    var M = global.NexusCarburantMoteur;
    var MC = global.NexusCarburantCommandeMoteur;
    if (!NCD || !CMD || !M || !MC) return false;

    var originalControleJour = NCD.chargerControleJour;
    var originalStockCommande = CMD.chargerStockEtFiabiliteParCarburant;
    var originalEvaluerCommandeSite = CMD.evaluerCommandeCarburantSite;

    // 1) Réception -> relevé : neutralise l'ancien pont destructif.
    // Le stock post-livraison reste disponible via les tables Réception et
    // stockPhysiquePostLivraison(), mais la ligne carburant_releves du matin
    // demeure l'ancre métier.
    NCD.enregistrerReleveDepuisReceptionLivraison = async function (client, siteId, args) {
      var date = args && args.date;
      var releve = date ? await NCD.chargerReleveDuJour(client, siteId, date) : null;
      return {
        ok: true,
        dejaAJour: true,
        pontNeutralise: true,
        releve: releve,
        message: "Réception conservée comme preuve séparée ; relevé d'ouverture inchangé.",
      };
    };

    // 2) Contrôle inter-relevés : la livraison vient directement des BL des
    // réceptions terminées depuis l'ancre précédente. Aucun recopiage dans
    // carburant_releves n'est nécessaire.
    // A3 / C1c-5 : cette enveloppe NOMME ses paramètres au lieu de faire
    // apply(this, arguments) comme les deux autres — elle laissait donc
    // tomber le 4ᵉ argument en silence. `timezone` doit y figurer
    // explicitement, sinon le correctif P0 rétablit l'ancien défaut.
    NCD.chargerControleJour = async function (client, siteId, date, timezone) {
      var base = await originalControleJour(client, siteId, date, timezone);
      if (!base || base.aucunReleve || !base.parCarburant) return base;
      if (base.referenceCertifieeCeJour || base.ancreEstPointZero) return base;

      var dateAncre = base.dateDernierReleve;
      if (!dateAncre) return base;
      var docs = await chargerLivraisonsDocumentaires(client, siteId, dateAncre, date);
      var parCarburant = {};

      Object.keys(base.parCarburant).forEach(function (cle) {
        var r = base.parCarburant[cle];
        if (!r) { parCarburant[cle] = r; return; }
        if (docs.ambigus.global || docs.ambigus[cle]) {
          parCarburant[cle] = Object.assign({}, r, {
            theorique: null,
            ecart: null,
            ecartRatio: null,
            statut: 'Données insuffisantes',
            livraisonDocumentaireAmbigue: true,
            livraisonDocumentaireSource: 'reception_bl',
          });
          return;
        }

        var livraisonLegacy = Number(r.livraison) || 0;
        var livraisonBL = Number(docs.volumes[cle]) || 0;
        if (livraisonLegacy > 0 && livraisonBL > 0) {
          // Deux sources portent un volume de livraison sur la même fenêtre :
          // ne jamais les additionner sans savoir si elles représentent le
          // même camion.
          parCarburant[cle] = Object.assign({}, r, {
            theorique: null,
            ecart: null,
            ecartRatio: null,
            statut: 'Données insuffisantes',
            livraisonDocumentaireAmbigue: true,
            livraisonDocumentaireSource: 'double_source_releve_et_reception',
          });
          return;
        }
        var livraison = livraisonBL > 0 ? livraisonBL : livraisonLegacy;
        var calc = M.calculerCarburant({
          dernierReel: r.dernierReel,
          reelDuJour: r.reelDuJour,
          livraison: livraison,
          mouvement: r.mouvement,
          ventes: r.ventesDepuis,
        });
        parCarburant[cle] = Object.assign({}, r, calc, {
          livraison: livraison,
          livraisonDocumentaireL: livraisonBL,
          livraisonDocumentaireSource: livraisonBL > 0 ? 'reception_bl' : null,
        });
      });

      return Object.assign({}, base, {
        parCarburant: parCarburant,
        livraisonsDocumentaires: docs,
      });
    };

    // 3) Commandes engagées : confirmation fournisseur et commande hors
    // NEXUS restent des commandes réelles jusqu'à livraison/annulation.
    CMD.chargerCommandeEnCoursParCarburant = async function (client, siteId) {
      var q = await client.from('carburant_commandes')
        .select('id,carburants,livraison_prevue_le,statut')
        .eq('site', siteId)
        .in('statut', ['validee', 'modifiee', 'confirmee_fournisseur', 'hors_nexus'])
        .order('proposee_le', { ascending: false });
      if (q.error) {
        console.error('P0 — chargement commandes engagées:', q.error);
        return {};
      }
      var parCarburant = {};
      (q.data || []).forEach(function (cmd) {
        if (!cmd.carburants) return;
        Object.keys(cmd.carburants).forEach(function (c) {
          if (parCarburant[c]) return;
          var ligne = cmd.carburants[c];
          if (!ligne || ligne.volumeL == null) return;
          parCarburant[c] = {
            commandeId: cmd.id,
            volumeL: Number(ligne.volumeL),
            livraisonPrevueLe: cmd.livraison_prevue_le,
            statut: cmd.statut,
          };
        });
      });
      return parCarburant;
    };

    // Export utile aux tests/à la future intégration dans le fichier métier.
    CMD.chargerHistoriqueVentesParJourQualifie = function (client, siteId, dateFinExclusiveISO, joursHistorique) {
      return chargerHistoriqueVentesQualifie(client, siteId, dateFinExclusiveISO, joursHistorique);
    };

    // 4) Lecture directe du stock : utile aux écrans qui appellent cette
    // fonction exportée. L'évaluation complète est sécurisée plus bas car la
    // fonction originale l'appelle par référence locale.
    CMD.chargerStockEtFiabiliteParCarburant = async function (client, siteId, dateISO, horaires, fuseau, maintenant) {
      var base = await originalStockCommande(client, siteId, dateISO, horaires, fuseau, maintenant);
      if (!base || base.aucunReleve || !base.parCarburant || !base.sourceAncre || !base.sourceAncre.utiliseAujourdhui) return base;

      var docs = await chargerLivraisonsDocumentaires(client, siteId, dateISO, dateSuivanteISO(dateISO));
      Object.keys(base.parCarburant).forEach(function (cle) {
        var r = base.parCarburant[cle];
        if (!r) return;
        if (docs.ambigus.global || docs.ambigus[cle]) {
          r.stockAncreCommandeFiable = false;
          r.stockFiable = false;
          r.livraisonDocumentaireAmbigue = true;
          return;
        }
        var livraison = Number(docs.volumes[cle]) || 0;
        if (livraison <= 0) return;
        if (r.stockAncreCommandeL != null) r.stockAncreCommandeL = Number(r.stockAncreCommandeL) + livraison;
        if (r.stockActuelL != null) r.stockActuelL = Number(r.stockActuelL) + livraison;
        r.livraisonDocumentaireAujourdhuiL = livraison;
        r.livraisonDocumentaireSource = 'reception_bl';
      });
      base.livraisonsDocumentairesAujourdhui = docs;
      base.sourceAncre = Object.assign({}, base.sourceAncre, {
        livraisonDocumentaireAjoutee: true,
        livraisonsDocumentairesL: docs.volumes,
      });
      return base;
    };

    // 5) Évaluation complète : l'implémentation d'origine est d'abord appelée
    // pour conserver tout son contexte/UI. La décision est ensuite recalculée
    // avec une histoire qualifiée, les statuts engagés corrigés et l'ancre
    // ouverture + BL reçus aujourd'hui. Aucun découpage horaire des ventes.
    CMD.evaluerCommandeCarburantSite = async function (client, siteId, options) {
      var base = await originalEvaluerCommandeSite(client, siteId, options);
      if (!base || base.ok === false || !base.parCarburant || !base.config) return base;
      if (!base.sourceAncreCommande || !base.sourceAncreCommande.utiliseAujourdhui) return base;

      var dateISO = base.dateISO;
      var donnees = await Promise.all([
        chargerHistoriqueVentesQualifie(client, siteId, dateISO, 180),
        CMD.chargerJoursFeries(client, siteId),
        CMD.chargerCommandeEnCoursParCarburant(client, siteId),
        chargerLivraisonsDocumentaires(client, siteId, dateISO, dateSuivanteISO(dateISO)),
      ]);
      var historique = donnees[0], joursFeriesISO = donnees[1], commandes = donnees[2], docsAujourdhui = donnees[3];
      var evaluations = {};
      var capacites = {};

      Object.keys(base.parCarburant).forEach(function (cle) {
        var ancien = base.parCarburant[cle];
        var consommation = MC.moyenneRecente(historique, cle, dateISO, 14).moyenne;
        var commande = commandes[cle] || null;
        var ouverture = ancien.jaugeageOuvertureL != null ? Number(ancien.jaugeageOuvertureL) : null;
        var livraisonJour = Number(docsAujourdhui.volumes[cle]) || 0;
        var ambigu = !!(docsAujourdhui.ambigus.global || docsAujourdhui.ambigus[cle]);
        var stockAncre = ouverture != null && !ambigu ? ouverture + livraisonJour : ouverture;
        var ancienStockFiable = ancien.stockFiable !== false && ouverture != null;
        var stockFiable = ancienStockFiable && !ambigu;
        var facteurs = ancien.detailConfiance && ancien.detailConfiance.facteurs ? ancien.detailConfiance.facteurs : {};
        var anomalieExistante = facteurs.aucune_anomalie_majeure === false;
        var anomalieReception = !!docsAujourdhui.aRapprocher[cle];
        var limite = ancien.limiteRemplissageL;

        var recalcul = MC.evaluerCarburant({
          carburant: cle,
          maintenantISO: dateISO,
          heureMaintenantHHMM: base.heureMaintenantHHMM,
          config: base.config,
          joursFeriesISO: joursFeriesISO,
          stockActuelL: stockAncre,
          limiteRemplissageL: limite,
          consommationMoyenneJour: consommation,
          historiqueParJour: historique,
          commandeEnCoursVolumeL: commande ? commande.volumeL : 0,
          stockFiable: stockFiable,
          jaugeageOuvertureLe: ancien.jaugeageOuvertureLe,
          ventesDepuisJaugeageL: ancien.ventesDepuisJaugeageL,
          pointZeroExiste: facteurs.point_zero_fiable === true,
          anomalieMajeure: anomalieExistante || anomalieReception || ambigu,
          commandeEnCoursLivraisonPrevueLe: commande ? commande.livraisonPrevueLe : null,
        });

        var stockEstimeMaintenant = ancien.stockEstimeMaintenantL;
        if (stockEstimeMaintenant != null && livraisonJour > 0 && !ambigu) stockEstimeMaintenant = Number(stockEstimeMaintenant) + livraisonJour;

        evaluations[cle] = Object.assign({}, ancien, recalcul, {
          limiteRemplissageL: limite,
          commandeEnCours: commande,
          consommationMoyenneJour: consommation,
          stockEstimeMaintenantL: stockEstimeMaintenant,
          stockFiable: stockFiable,
          stockAncreCommandeL: stockAncre,
          livraisonDocumentaireAujourdhuiL: livraisonJour,
          livraisonDocumentaireAmbigue: ambigu,
          qualiteHistoriqueP0: true,
        });

        capacites[cle] = recalcul.scenarioMaintenant && limite != null
          ? MC.capaciteDisponibleLivraison(limite, recalcul.scenarioMaintenant.stockPrevuLivraisonL)
          : null;
      });

      var globalSecurise = construireEvaluationGlobaleSecurisee(MC, {
        evaluationsParCarburant: evaluations,
        config: base.config,
        capacitesDisponiblesL: capacites,
        viserCamionComplet: !base.modeFinDeMois,
      });
      var inclus = globalSecurise.commandeRecommandee ? Object.keys(globalSecurise.commandeRecommandee.volumes || {}) : null;
      var causes = MC.resumerCausesConfirmationCommande(evaluations, inclus);
      var etatConfirmation = MC.etatConfirmationCommande({
        commandeRecommandee: globalSecurise.commandeRecommandee,
        causesAConfirmer: causes,
      });

      // Corrige aussi le journal après l'évaluation historique d'origine.
      Object.keys(evaluations).forEach(function (cle) {
        var ev = evaluations[cle];
        if (!ev || ev.etat === 'non_calculable') return;
        var rec = globalSecurise.commandeRecommandee && globalSecurise.commandeRecommandee.volumes[cle] != null
          ? globalSecurise.commandeRecommandee.volumes[cle] : 0;
        CMD.enregistrerRecommandationCarburant(client, siteId, cle, {
          recommandationL: rec,
          etat: ev.etat,
          ventesPrevuesL: ev.scenarioMaintenant ? ev.scenarioMaintenant.ventesPrevuesL : null,
          stockAncreCommandeL: ev.stockAncreCommandeL,
        }).catch(function (e) { console.error('P0 — journal recommandation corrigé:', e); });
      });

      return Object.assign({}, base, globalSecurise, {
        parCarburant: evaluations,
        causesAConfirmer: causes,
        etatConfirmationCommande: etatConfirmation,
        livraisonsDocumentairesAujourdhui: docsAujourdhui,
        historiqueVentesQualifie: historique,
        sourceAncreCommande: Object.assign({}, base.sourceAncreCommande, {
          doctrine: 'ouverture_plus_bl_sans_decoupage_intrajournalier',
          livraisonsDocumentairesL: docsAujourdhui.volumes,
        }),
      });
    };

    global.NexusCarburantsP0 = {
      actif: true,
      doctrine: 'ouverture_plus_bl_sans_decoupage_intrajournalier',
      chargerLivraisonsDocumentaires: chargerLivraisonsDocumentaires,
      chargerHistoriqueVentesQualifie: chargerHistoriqueVentesQualifie,
    };
    INSTALLE = true;
    console.info('NEXUS Carburants P0 installé — ouverture préservée, BL raccordés, historique qualifié.');
    return true;
  }

  if (!installer()) {
    TIMER = setInterval(function () {
      if (installer() && TIMER) {
        clearInterval(TIMER);
        TIMER = null;
      }
    }, 20);
    setTimeout(function () {
      if (TIMER) {
        clearInterval(TIMER);
        TIMER = null;
        console.error('NEXUS Carburants P0 non installé : moteurs indisponibles après 15 s.');
      }
    }, 15000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
