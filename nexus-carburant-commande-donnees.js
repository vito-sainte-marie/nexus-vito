// NEXUS — Moteur Commande Carburant, colle Supabase (24/08/2026)
//
// Charge les données réelles nécessaires à NexusCarburantCommandeMoteur et
// assemble l'évaluation complète (§27 du cahier) pour un site. Aucun
// calcul ici (Article 11) — uniquement des lectures Supabase, transmises
// telles quelles au moteur pur (nexus-carburant-commande-moteur.js,
// nexus-carburant-moteur.js, nexus-carburant-donnees.js doivent être
// chargés AVANT ce fichier).
//
// Réutilise explicitement l'existant plutôt que de dupliquer :
//   - station_config.cuves_carburants (limite_remplissage ajoutée par la
//     migration carburant_commande_schema_v1) et .carburant_commande_config
//     — mêmes colonnes que NexusCarburantDonnees.chargerCuvesConfig,
//     jamais une deuxième lecture de la config des cuves.
//   - NexusCarburantDonnees.chargerControleJour() pour le stock physique du
//     jour ET sa fiabilité (statut) — jamais un deuxième calcul du stock
//     théorique/de la qualité de chaîne, déjà couvert par le Sprint C2-C7
//     Carburants Pilotage.
//   - inventaire_calendrier_site (type='ferie') pour les jours fériés —
//     table générique déjà éditable par le manager dans Paramètres
//     Inventaire, jamais une deuxième table de jours fériés créée pour ce
//     module.
//   - audits_caisse.litrage_* pour l'historique de ventes — même source
//     que sommerVentesPeriode/chargerConsommationJournaliereMoyenne.
//
// Inclure après nexus-carburant-moteur.js, nexus-carburant-donnees.js et
// nexus-carburant-commande-moteur.js :
// <script src="nexus-carburant-commande-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  'use strict';

  function dateISOAujourdhui() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function heureHHMMAujourdhui(fuseau) {
    try {
      return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau || 'America/Martinique', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    } catch (e) {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }

  // Config carburant_commande_config + cuves_carburants (avec
  // limite_remplissage) + fuseau_horaire — une seule lecture station_config,
  // jamais trois requêtes séparées pour trois colonnes de la même table.
  // Repli explicite si le site n'a pas encore de config commande (colonne
  // NOT NULL avec défaut en base depuis la migration — ce cas ne devrait
  // survenir qu'en test) : jamais un plantage, mais aucune recommandation
  // fabriquée non plus (l'appelant verra config=null et devra l'afficher
  // comme "réglages non configurés", pas comme une valeur par défaut
  // inventée ici).
  async function chargerConfigEtCuves(client, siteId) {
    const { data, error } = await client.from('station_config')
      .select('carburant_commande_config, cuves_carburants, fuseau_horaire')
      .eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement config Commande Carburant:', error); return { config: null, cuves: null, fuseau: 'America/Martinique' }; }
    return {
      config: (data && data.carburant_commande_config) || null,
      cuves: (data && data.cuves_carburants) || null,
      fuseau: (data && data.fuseau_horaire) || 'America/Martinique',
    };
  }

  // Jours fériés déclarés pour ce site (inventaire_calendrier_site,
  // type='ferie' uniquement — 'vacances' n'entre pas dans ce lot, voir
  // Data Dictionary "Portée non traitée" : la prévision saisonnière/
  // vacances du cahier §8 priorités 5-7 demande davantage d'historique que
  // ce que ce lot peut raisonnablement exploiter). Retourne l'ensemble
  // complet connu du site (passé ET futur) : le moteur en a besoin des
  // deux côtés (passé pour la prévision, futur pour le calendrier de
  // livraison).
  async function chargerJoursFeries(client, siteId) {
    const { data, error } = await client.from('inventaire_calendrier_site')
      .select('date').eq('site', siteId).eq('type', 'ferie');
    if (error) { console.error('Chargement jours fériés (Commande Carburant):', error); return []; }
    return (data || []).map(r => r.date);
  }

  // Historique de ventes par jour, agrégé (une ligne par date, litrage
  // sommé sur tous les quarts de ce jour) — format attendu par
  // NexusCarburantCommandeMoteur.prevoirConsommationJour/Fenetre :
  // [{ date, ventes: { go, sp95, gnr } }]. `joursHistorique` = 180 par
  // défaut (~6 mois, large marge pour que la recherche "même jour de
  // semaine" du moteur (§8) puisse remonter jusqu'à 8 occurrences même sur
  // un site encore jeune).
  async function chargerHistoriqueVentesParJour(client, siteId, dateFinExclusiveISO, joursHistorique) {
    const fenetre = joursHistorique || 180;
    const fin = new Date(`${dateFinExclusiveISO}T00:00:00`);
    const debut = new Date(fin);
    debut.setDate(debut.getDate() - fenetre);
    const debutISO = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`;
    const { data, error } = await client.from('audits_caisse')
      .select('date,litrage_gazole,litrage_sp95,litrage_gnr')
      .eq('site', siteId).gte('date', debutISO).lt('date', dateFinExclusiveISO);
    if (error) { console.error('Chargement historique ventes (Commande Carburant):', error); return []; }
    const parDate = {};
    (data || []).forEach(l => {
      if (!parDate[l.date]) parDate[l.date] = { go: null, sp95: null, gnr: null };
      const j = parDate[l.date];
      if (l.litrage_gazole != null) j.go = (j.go || 0) + Number(l.litrage_gazole);
      if (l.litrage_sp95 != null) j.sp95 = (j.sp95 || 0) + Number(l.litrage_sp95);
      if (l.litrage_gnr != null) j.gnr = (j.gnr || 0) + Number(l.litrage_gnr);
    });
    return Object.keys(parDate).sort().map(date => ({ date, ventes: parDate[date] }));
  }

  // Dernière commande NEXUS non encore livrée pour un carburant donné
  // (statut 'validee' ou 'modifiee', pas 'hors_nexus'/'annulee'/'livree') —
  // §10 du cahier : une commande déjà en cours doit être intégrée, jamais
  // une deuxième recommandation comme si elle n'existait pas. Lit
  // `carburants` (jsonb {sp95:{volumeL},go:{...},gnr:{...}}) et n'expose
  // que la part du volume concernant CE carburant.
  async function chargerCommandeEnCoursParCarburant(client, siteId) {
    const { data, error } = await client.from('carburant_commandes')
      .select('id, carburants, livraison_prevue_le, statut')
      .eq('site', siteId).in('statut', ['validee', 'modifiee'])
      .order('proposee_le', { ascending: false });
    if (error) { console.error('Chargement commandes en cours (Commande Carburant):', error); return {}; }
    const parCarburant = {};
    (data || []).forEach(cmd => {
      if (!cmd.carburants) return;
      Object.keys(cmd.carburants).forEach(c => {
        if (parCarburant[c]) return; // déjà pris la plus récente (order desc ci-dessus)
        const ligne = cmd.carburants[c];
        if (!ligne || ligne.volumeL == null) return;
        parCarburant[c] = { commandeId: cmd.id, volumeL: ligne.volumeL, livraisonPrevueLe: cmd.livraison_prevue_le };
      });
    });
    return parCarburant;
  }

  // Stock physique actuel + fiabilité, par carburant actif — réutilise
  // intégralement NexusCarburantDonnees.chargerControleJour (Article 11,
  // même chaîne de calcul que Carburants Pilotage, jamais une deuxième
  // lecture du stock physique). `stockFiable` : tout statut autre que
  // 'Données insuffisantes' est considéré comme un stock physique
  // exploitable — même distinction que le reste de Carburants Pilotage.
  async function chargerStockEtFiabiliteParCarburant(client, siteId, dateISO) {
    const NCD = global.NexusCarburantDonnees;
    if (!NCD) { console.error('NexusCarburantDonnees non chargé — impossible de lire le stock physique.'); return { parCarburant: {}, aucunReleve: true }; }
    const controle = await NCD.chargerControleJour(client, siteId, dateISO);
    if (controle.aucunReleve || !controle.parCarburant) return { parCarburant: {}, aucunReleve: true };
    const resultat = {};
    Object.entries(controle.parCarburant).forEach(([cle, r]) => {
      resultat[cle] = {
        stockActuelL: r.stockPhysiqueAffiche != null ? Number(r.stockPhysiqueAffiche) : null,
        stockFiable: r.statut !== 'Données insuffisantes' && r.stockPhysiqueAffiche != null,
      };
    });
    return { parCarburant: resultat, aucunReleve: false };
  }

  // ============================================================
  // ORCHESTRATION — construit l'évaluation complète du site (§27) en une
  // seule fonction, consommée directement par l'écran (carte "Prochaine
  // commande") et par Cockpit/Brief (signal, sans recalcul, Article 11).
  // ============================================================

  async function evaluerCommandeCarburantSite(client, siteId, options) {
    const M = global.NexusCarburantCommandeMoteur;
    if (!M) { console.error('NexusCarburantCommandeMoteur non chargé — évaluation Commande Carburant impossible.'); return null; }

    const dateISO = (options && options.dateISO) || dateISOAujourdhui();
    const { config, cuves, fuseau } = await chargerConfigEtCuves(client, siteId);
    if (!config || !cuves) {
      return { ok: false, motif: "Configuration Commande Carburant absente pour ce site (station_config.carburant_commande_config / cuves_carburants).", etatGlobal: 'non_calculable' };
    }
    const heureMaintenantHHMM = (options && options.heureHHMM) || heureHHMMAujourdhui(fuseau);

    const carburantsActifs = Object.keys(cuves).filter(c => cuves[c] && cuves[c].actif);
    if (!carburantsActifs.length) {
      return { ok: false, motif: 'Aucun carburant actif configuré pour ce site.', etatGlobal: 'non_calculable' };
    }

    const [historiqueParJour, joursFeriesISO, stockInfo, commandesEnCours] = await Promise.all([
      chargerHistoriqueVentesParJour(client, siteId, dateISO),
      chargerJoursFeries(client, siteId),
      chargerStockEtFiabiliteParCarburant(client, siteId, dateISO),
      chargerCommandeEnCoursParCarburant(client, siteId),
    ]);

    const evaluationsParCarburant = {};
    const capacitesDisponiblesL = {};
    carburantsActifs.forEach(carburant => {
      const cuvesCarburant = cuves[carburant].cuves || [];
      const limiteRemplissageL = cuvesCarburant.reduce((s, c) => s + (Number(c.limite_remplissage) || 0), 0);
      const stock = stockInfo.parCarburant[carburant] || { stockActuelL: null, stockFiable: false };
      const consommationMoyenneJour = M.moyenneRecente(historiqueParJour, carburant, dateISO, 14).moyenne;
      const commandeEnCours = commandesEnCours[carburant] || null;

      const evaluation = M.evaluerCarburant({
        carburant, maintenantISO: dateISO, heureMaintenantHHMM, config, joursFeriesISO,
        stockActuelL: stock.stockActuelL, limiteRemplissageL, consommationMoyenneJour,
        historiqueParJour, commandeEnCoursVolumeL: commandeEnCours ? commandeEnCours.volumeL : 0,
        stockFiable: stock.stockFiable,
      });
      evaluationsParCarburant[carburant] = { ...evaluation, limiteRemplissageL, commandeEnCours, consommationMoyenneJour };
      capacitesDisponiblesL[carburant] = evaluation.scenarioMaintenant
        ? M.capaciteDisponibleLivraison(limiteRemplissageL, evaluation.scenarioMaintenant.stockPrevuLivraisonL)
        : null;
    });

    const global_ = M.construireEvaluationGlobale({ evaluationsParCarburant, config, capacitesDisponiblesL });
    return { ok: true, dateISO, heureMaintenantHHMM, fuseau, cuves, config, ...global_ };
  }

  // ============================================================
  // ÉCRITURE — cycle de vie d'une commande (§31-34 du cahier).
  // ============================================================

  // Propose/enregistre une commande (§31, bouton "Préparer ma commande").
  // `volumes` = { sp95: L, go: L } (déjà arrondis par le moteur/l'écran).
  // `confidence`/`raison` viennent de l'évaluation globale déjà calculée —
  // jamais recalculés ici (Article 11, ce fichier ne fait qu'écrire).
  async function creerPropositionCommande(client, siteId, { volumes, total, confidence, raison, cutoffDeadline, livraisonPrevueLe, createdBy }) {
    const carburants = {};
    Object.entries(volumes || {}).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
    const { data, error } = await client.from('carburant_commandes').insert({
      site: siteId, statut: 'proposee', carburants, volume_total_l: total,
      confidence: confidence || 'a_confirmer', raison: raison || null,
      cutoff_deadline: cutoffDeadline || null, livraison_prevue_le: livraisonPrevueLe || null,
      created_by: createdBy || null,
    }).select().single();
    if (error) { console.error('Création proposition commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Valide une proposition (§31, "Valider la commande") — le manager
  // confirme qu'il commande réellement ce volume auprès du fournisseur.
  async function validerCommande(client, commandeId, { validePar, volumes, total }) {
    // `statut` reste 'validee' même si le manager a ajusté les volumes
    // avant de confirmer (§31, "Modifier" puis "Valider la commande") — le
    // détail du changement vit dans `carburants` lui-même, jamais un statut
    // 'modifiee' séparé qui compliquerait inutilement le cycle de vie sans
    // information supplémentaire réelle (le volume final EST la source de
    // vérité, peu importe qu'il ait été ajusté avant validation).
    const patch = { statut: 'validee', valide_par: validePar || null, valide_le: new Date().toISOString() };
    if (volumes) {
      const carburants = {};
      Object.entries(volumes).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
      patch.carburants = carburants;
      if (total != null) patch.volume_total_l = total;
    }
    const { data, error } = await client.from('carburant_commandes').update(patch).eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Validation commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Reporte une proposition (§32) — jamais un simple "fermer l'alerte" :
  // motif obligatoire côté écran, catégorisé (§32 : commande déjà passée
  // hors NEXUS / fournisseur indisponible / décision de trésorerie / volume
  // à modifier / autre).
  async function reporterCommande(client, commandeId, { motifCategorie, motif }) {
    const { data, error } = await client.from('carburant_commandes')
      .update({ statut: 'reportee', motif_report_categorie: motifCategorie || 'autre', motif_report: motif || null })
      .eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Report commande carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Enregistre une commande passée EN DEHORS de NEXUS (§33) — évite qu'une
  // recommandation persistante et incorrecte continue de s'afficher alors
  // qu'une commande a bien été passée par un autre canal.
  async function enregistrerCommandeHorsNexus(client, siteId, { volumes, total, dateCommande, livraisonPrevueLe, createdBy }) {
    const carburants = {};
    Object.entries(volumes || {}).forEach(([c, v]) => { carburants[c] = { volumeL: v }; });
    const { data, error } = await client.from('carburant_commandes').insert({
      site: siteId, statut: 'hors_nexus', source: 'hors_nexus', carburants, volume_total_l: total,
      confidence: 'fiable', proposee_le: dateCommande ? new Date(dateCommande).toISOString() : new Date().toISOString(),
      livraison_prevue_le: livraisonPrevueLe || null, created_by: createdBy || null,
    }).select().single();
    if (error) { console.error('Enregistrement commande hors NEXUS:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Rapprochement réception (§34) — appelé par NEXUS-Carburant-Reception-v1.html
  // une fois une visite terminée, pour relier la commande à sa livraison
  // réelle (chaîne recommandation -> commande -> livraison prévue ->
  // réception). Marque 'livree', jamais une réécriture des volumes
  // recommandés d'origine (la vérité "ce qui a été reçu" reste dans
  // carburant_reception_visite_lignes, ce champ ne fait que pointer vers
  // elle — Article 5, jamais un double enregistrement de la même mesure).
  async function rapprocherCommandeReception(client, commandeId, visiteId, dateLivraison) {
    const { data, error } = await client.from('carburant_commandes')
      .update({ statut: 'livree', visite_reception_id: visiteId, livree_le: dateLivraison || new Date().toISOString().slice(0, 10) })
      .eq('id', commandeId).select().maybeSingle();
    if (error) { console.error('Rapprochement commande/réception carburant:', error); return { ok: false, error }; }
    return { ok: true, commande: data };
  }

  // Historique des commandes du site, le plus récent en premier — écran
  // "Historique des commandes" / audit léger, jamais recalculé.
  async function chargerHistoriqueCommandes(client, siteId, limite) {
    const { data, error } = await client.from('carburant_commandes')
      .select('*').eq('site', siteId).order('proposee_le', { ascending: false }).limit(limite || 30);
    if (error) { console.error('Chargement historique commandes carburant:', error); return []; }
    return data || [];
  }

  global.NexusCarburantCommandeDonnees = {
    chargerConfigEtCuves, chargerJoursFeries, chargerHistoriqueVentesParJour,
    chargerCommandeEnCoursParCarburant, chargerStockEtFiabiliteParCarburant,
    evaluerCommandeCarburantSite,
    creerPropositionCommande, validerCommande, reporterCommande,
    enregistrerCommandeHorsNexus, rapprocherCommandeReception, chargerHistoriqueCommandes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
