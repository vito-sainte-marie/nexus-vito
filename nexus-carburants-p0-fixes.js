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
//   automatique plutôt que d'être corrigée silencieusement.
(function (global) {
  'use strict';

  var INSTALLE = false;
  var TIMER = null;

  function dateSuivanteISO(dateISO) {
    var d = new Date(dateISO + 'T12:00:00');
    d.setDate(d.getDate() + 1);
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

  // Charge les réceptions terminées sur [dateDebutIncluse, dateFinExclue),
  // somme les BL par carburant et détecte une signature physique strictement
  // identique entre deux visites distinctes le même jour. Une telle signature
  // est une EXCEPTION À ARBITRER, jamais une autorisation de doubler le BL.
  async function chargerLivraisonsDocumentaires(client, siteId, dateDebutIncluse, dateFinExclue) {
    var zero = { go: 0, sp95: 0, gnr: 0 };
    if (!dateDebutIncluse || !dateFinExclue || dateDebutIncluse >= dateFinExclue) {
      return { volumes: zero, ambigus: {}, visites: [], aDesVisites: false };
    }

    var qVisites = await client.from('carburant_reception_visites')
      .select('id,date_visite,heure_debut,heure_fin,statut')
      .eq('site', siteId)
      .gte('date_visite', dateDebutIncluse)
      .lt('date_visite', dateFinExclue)
      .neq('statut', 'en_cours')
      .order('date_visite', { ascending: true })
      .order('heure_debut', { ascending: true });
    if (qVisites.error) {
      console.error('P0 — chargement réceptions documentaires:', qVisites.error);
      return { volumes: zero, ambigus: { global: true }, visites: [], aDesVisites: false, error: qVisites.error };
    }
    var visites = qVisites.data || [];
    if (!visites.length) return { volumes: zero, ambigus: {}, visites: [], aDesVisites: false };

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
      return { volumes: zero, ambigus: { global: true }, visites: visites, aDesVisites: true, error: qLignes.error || qMesures.error };
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
    lignes.forEach(function (l) {
      if (visitesAmbigues.has(l.visite_id) && l.carburant) ambigus[l.carburant] = true;
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
      visites: visites,
      visitesAmbigues: Array.from(visitesAmbigues),
      aDesVisites: true,
    };
  }

  function installer() {
    if (INSTALLE) return true;
    var NCD = global.NexusCarburantDonnees;
    var CMD = global.NexusCarburantCommandeDonnees;
    var M = global.NexusCarburantMoteur;
    if (!NCD || !CMD || !M) return false;

    var originalControleJour = NCD.chargerControleJour;
    var originalStockCommande = CMD.chargerStockEtFiabiliteParCarburant;

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
    NCD.chargerControleJour = async function (client, siteId, date) {
      var base = await originalControleJour(client, siteId, date);
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
        var livraison = livraisonLegacy + livraisonBL;
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

    // 4) Recommandation du jour : ouverture + BL déjà reçus aujourd'hui.
    // On conserve une projection de journée complète ; aucun découpage de
    // ventes avant/après l'heure de réception n'est tenté.
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

    global.NexusCarburantsP0 = {
      actif: true,
      doctrine: 'ouverture_plus_bl_sans_decoupage_intrajournalier',
      chargerLivraisonsDocumentaires: chargerLivraisonsDocumentaires,
    };
    INSTALLE = true;
    console.info('NEXUS Carburants P0 installé — ouverture préservée, BL raccordés sans découpage horaire.');
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
