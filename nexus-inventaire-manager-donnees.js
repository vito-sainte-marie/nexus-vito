// ============================================================
// NEXUS Inventaire Manager — colle Supabase (11/08/2026)
//
// Refactoring des pages monolithiques, 4e page traitée après Brief,
// Cockpit et App : NEXUS-Inventaire-Manager-v1.html (2634 lignes, la plus
// grosse des 5 pages ciblées par l'audit). Contrairement à Brief/Cockpit/
// App (qui partagent tous le même "Conseiller cross-moteurs"), cette page
// est un domaine à part (comptage/contrôle d'inventaire par quart), sans
// recoupement significatif avec nexus-conseiller-donnees.js — un seul nom
// de fonction identique trouvé avec NEXUS-Inventaire-v1.html
// (chargerModeJaugeageActif), non centralisé dans ce lot car les deux
// pages ont des contextes d'appel différents (employé vs manager) et
// l'audit ne cible pas explicitement cette page-là.
//
// Ce fichier ne contient QUE des lectures (Article 11 — un chargeur ne
// fait jamais un deuxième calcul ni une écriture) : les 21 fonctions
// extraites sont chacune un simple SELECT/RPC en lecture, vérifiées une
// par une pour l'absence de insert/update/upsert/delete avant extraction.
// Restent volontairement dans NEXUS-Inventaire-Manager-v1.html : toutes
// les actions manager qui écrivent (résoudre une alerte, valider en masse,
// rouvrir une clôture, appliquer une correction rétroactive, activer un
// mode aveugle/jaugeage, sauvegarder les paramètres) — mélanger lecture et
// écriture dans un même fichier `-donnees.js` romprait la convention
// établie sur Brief/Cockpit/App, et ces actions ont une logique métier et
// des effets de bord (toasts, rechargements) trop entremêlés avec l'UI
// pour un déplacement mécanique sûr dans ce lot. Restent aussi en place :
// le rapprochement des ventes Decenium (parserFichierVentesDecenium,
// rapprocherLignesVentes, comparerVentesQuart) et les calculs d'écoulement
// physique — logique de calcul, pas de simple chargement, à traiter dans
// un futur "moteur" dédié si Frédéric le souhaite.
//
// Convention : chaque fonction reçoit `client` (nexusClient) en premier
// paramètre, puis les paramètres déjà explicites dans la version d'origine
// (site, quartId, etc. — cette page utilisait déjà des paramètres
// explicites partout, pas de fermeture sur une variable module-level
// comme SITE_ACTUEL ailleurs dans NEXUS, donc aucun changement de
// signature au-delà de l'ajout de `client`).
//
// chargerParametresInventaire() reçoit `defaults` en 3e paramètre plutôt
// que d'importer sa propre copie de DEFAULTS_PARAMETRES_INVENTAIRE : cette
// constante reste définie dans la page (utilisée aussi pour l'état local
// `parametresInventaire` et l'UI Paramètres), la dupliquer ici aurait créé
// exactement le risque de divergence que l'Article 11 interdit.
//
// Inclure après nexus-auth.js (nexusClient) :
// <script src="nexus-inventaire-manager-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  async function quartDuMoment(client, site, horaireDefautDebutQuart2) {
    let debutQuart2 = horaireDefautDebutQuart2;
    const { data, error } = await client
      .from('station_config').select('horaires').eq('site', site).maybeSingle();
    if (error) console.error('Chargement horaires station (quart par défaut):', error);
    else if (data && data.horaires && data.horaires.quart2 && data.horaires.quart2.normal) {
      debutQuart2 = data.horaires.quart2.normal;
    }
    const maintenant = new Date();
    const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
    const [hQ2, mQ2] = debutQuart2.split(':').map(Number);
    const minutesQ2 = hQ2 * 60 + (mQ2 || 0);
    return minutesMaintenant < minutesQ2 ? 'matin' : 'soir';
  }

  async function chargerQuart(client, site, date, quart) {
    const { data, error } = await client.from('inventaire_quarts').select('*').eq('site', site).eq('date', date).eq('quart', quart).maybeSingle();
    if (error) { console.error('Chargement quart:', error); return null; }
    return data;
  }

  async function chargerAlertesOuvertesQuart(client, site, quartId) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation)')
      .eq('site', site).eq('quart_id', quartId).eq('statut', 'ouverte')
      .order('cree_le', { ascending: false });
    if (error) { console.error('Chargement alertes ouvertes:', error); return []; }
    return data || [];
  }

  async function chargerComptagesQuart(client, quartId) {
    const { data, error } = await client.from('inventaire_comptages')
      .select('produit_id, type_comptage').eq('quart_id', quartId).in('type_comptage', ['ouverture', 'cloture']);
    if (error) { console.error('Chargement comptages du quart:', error); return { ouverts: new Set(), clotures: new Set() }; }
    const ouverts = new Set(), clotures = new Set();
    for (const row of (data || [])) {
      if (row.type_comptage === 'ouverture') ouverts.add(row.produit_id);
      if (row.type_comptage === 'cloture') clotures.add(row.produit_id);
    }
    return { ouverts, clotures };
  }

  async function chargerProduitsSensibles(client, site) {
    const { data, error } = await client.from('inventaire_zone_produit')
      .select('id, designation, zone_id, inventaire_zones(code)')
      .eq('site', site).eq('sensible', true).eq('actif', true).order('designation');
    if (error) { console.error('Chargement produits sensibles:', error); return []; }
    return data || [];
  }

  async function chargerTousProduitsActifsSite(client, site) {
    const { data, error } = await client.from('inventaire_zone_produit')
      .select('id, designation, categorie_id, inventaire_categories(nom), inventaire_zones(code)')
      .eq('site', site).eq('actif', true);
    if (error) { console.error('Chargement produits actifs (synthèse):', error); return []; }
    return data || [];
  }

  async function chargerHorairesStation(client, site) {
    const { data, error } = await client.from('station_config').select('horaires').eq('site', site).maybeSingle();
    if (error) { console.error('Chargement horaires station (état du quart):', error); return null; }
    return data ? data.horaires : null;
  }

  // `defaults` = DEFAULTS_PARAMETRES_INVENTAIRE de la page appelante (voir
  // note en tête de fichier).
  async function chargerParametresInventaire(client, site, defaults) {
    const { data, error } = await client.from('station_config').select('parametres_inventaire').eq('site', site).maybeSingle();
    if (error) { console.error('Chargement paramètres inventaire:', error); return { ...defaults }; }
    return { ...defaults, ...(data && data.parametres_inventaire ? data.parametres_inventaire : {}) };
  }

  async function chargerCategoriesSite(client, site) {
    const { data, error } = await client.from('inventaire_categories').select('id, nom')
      .eq('site', site).eq('actif', true).order('ordre_affichage');
    if (error) { console.error('Chargement catégories site:', error); return []; }
    return data || [];
  }

  async function chargerDecisionsQuart(client, quartId) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation)').eq('quart_id', quartId).eq('statut', 'resolue')
      .order('resolue_le', { ascending: false });
    if (error) { console.error('Chargement décisions du quart:', error); return []; }
    return data || [];
  }

  async function chargerAlertesOuvertesPeriode(client, site, debut, fin) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation, categorie_id)')
      .eq('site', site).in('statut', ['ouverte', 'en_cours'])
      .gte('cree_le', `${debut}T00:00:00`).lte('cree_le', `${fin}T23:59:59`)
      .order('cree_le', { ascending: false });
    if (error) { console.error('Chargement alertes ouvertes (période):', error); return []; }
    return data || [];
  }

  async function chargerDecisionsPeriode(client, site, debut, fin) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation, categorie_id)')
      .eq('site', site).in('statut', ['resolue', 'archivee', 'ignoree'])
      .gte('cree_le', `${debut}T00:00:00`).lte('cree_le', `${fin}T23:59:59`)
      .order('resolue_le', { ascending: false });
    if (error) { console.error('Chargement décisions (période):', error); return []; }
    return data || [];
  }

  async function chargerReviewPeriode(client, site, debut, fin, typeRevue) {
    const { data, error } = await client.rpc('generate_inventory_review', {
      p_site: site, p_period_start: debut, p_period_end: fin, p_review_type: typeRevue,
    });
    if (error) { console.error('Génération synthèse période:', error); return null; }
    return data;
  }

  async function chargerEmployesSite(client, site) {
    const { data, error } = await client.from('employees').select('id, nom, role').eq('site_id', site).eq('actif', true).order('nom');
    if (error) { console.error('Chargement employés:', error); return []; }
    // Le mode aveugle cible les employés qui comptent le stock sur le
    // terrain — pas les managers/gérants, qui ne sont pas concernés.
    return (data || []).filter(e => e.role !== 'manager' && e.role !== 'gerant');
  }

  async function chargerModesAveugleActifs(client, site) {
    const { data, error } = await client.from('inventaire_modes_controle')
      .select('*').eq('site', site).eq('mode', 'aveugle').eq('actif', true)
      .is('categorie_id', null).is('produit_id', null);
    if (error) { console.error('Chargement modes aveugle:', error); return []; }
    return data || [];
  }

  async function chargerModeJaugeageActif(client, site) {
    const { data, error } = await client.from('inventaire_modes_controle')
      .select('id').eq('site', site).eq('mode', 'jaugeage_actif').eq('actif', true).maybeSingle();
    if (error) { console.error('Chargement mode jaugeage:', error); return false; }
    return !!data;
  }

  async function chargerHistoriqueEcartsRecents(client, site) {
    const depuis = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await client.from('inventaire_alertes')
      .select('produit_id').eq('site', site).eq('type_alerte', 'ecart_ouverture').gte('cree_le', depuis);
    if (error) { console.error('Chargement historique écarts récents:', error); return []; }
    return data || [];
  }

  async function chargerCatalogueProduitsPourVentes(client, site) {
    const { data, error } = await client.from('inventaire_zone_produit')
      .select('id, designation, code_barres').eq('site', site).eq('actif', true);
    if (error) { console.error('Chargement catalogue produits (ventes):', error); return []; }
    return data || [];
  }

  async function chargerCategoriesProduitsParId(client, produitIds) {
    if (!produitIds || !produitIds.length) return {};
    const { data, error } = await client.from('inventaire_zone_produit')
      .select('id, inventaire_categories(nom)').in('id', produitIds);
    if (error) { console.error('Chargement catégories produits (écoulement journée):', error); return {}; }
    const map = {};
    (data || []).forEach(p => { map[p.id] = p.inventaire_categories ? p.inventaire_categories.nom : null; });
    return map;
  }

  async function chargerComptageActuel(client, produitId, quartId, typeComptage) {
    const { data, error } = await client.from('inventaire_comptages')
      .select('*').eq('produit_id', produitId).eq('quart_id', quartId).eq('type_comptage', typeComptage)
      .order('compte_le', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement comptage (correction):', error); return null; }
    return data;
  }

  // Impact de premier ordre uniquement — jamais un chiffre inventé sur une
  // chaîne complète qu'on ne garantit pas avoir parcourue : on compte les
  // comptages qui référencent DIRECTEMENT celui-ci comme comptage_source_id.
  async function chargerImpactCorrection(client, comptageId) {
    const { count, error } = await client.from('inventaire_comptages')
      .select('id', { count: 'exact', head: true }).eq('comptage_source_id', comptageId);
    if (error) { console.error('Chargement impact correction:', error); return 0; }
    return count || 0;
  }

  // Rapprochements Decenium persistés du quart (18/08/2026, Sprint 7 —
  // cahier §11, bloc manager "Qualité : Fiable / provisoire / non
  // comparable") : simple lecture de inventaire_rapprochements (peuplée
  // depuis le Sprint 5 par comparerVentesQuart) — l'agrégation par statut
  // reste dans nexus-inventaire-moteur.js::syntheseQualiteRapprochements,
  // ce chargeur ne fait que lire.
  async function chargerRapprochementsQuart(client, quartId) {
    const { data, error } = await client.from('inventaire_rapprochements')
      .select('produit_id, statut_validation').eq('quart_id', quartId);
    if (error) { console.error('Chargement rapprochements Decenium (qualité):', error); return []; }
    return data || [];
  }

  global.NexusInventaireManagerDonnees = {
    quartDuMoment, chargerQuart, chargerAlertesOuvertesQuart, chargerComptagesQuart,
    chargerProduitsSensibles, chargerTousProduitsActifsSite, chargerHorairesStation,
    chargerParametresInventaire, chargerCategoriesSite, chargerDecisionsQuart,
    chargerAlertesOuvertesPeriode, chargerDecisionsPeriode, chargerReviewPeriode,
    chargerEmployesSite, chargerModesAveugleActifs, chargerModeJaugeageActif,
    chargerHistoriqueEcartsRecents, chargerCatalogueProduitsPourVentes,
    chargerCategoriesProduitsParId, chargerComptageActuel, chargerImpactCorrection,
    chargerRapprochementsQuart,
  };
})(typeof window !== 'undefined' ? window : globalThis);
