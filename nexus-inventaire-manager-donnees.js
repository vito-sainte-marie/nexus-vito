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
// <script src="nexus-inventaire-manager-donnees.js?v=20260904-0104"></script>
// ------------------------------------------------------------

(function (global) {
  // A3 / C2-2 : plus de seuil par défaut reçu en argument. Cette couche de
  // données lit la configuration du site et refuse de deviner sans elle.
  // Limite connue, traitée en C2-3 : l'heure comparée est encore celle de
  // l'appareil.
  // A3 / C2-3 : `timezone` reçu de l'écran résolveur, jamais résolu ici —
  // cette couche de données ne va pas chercher sites.timezone (règle C1).
  async function quartDuMoment(client, site, timezone) {
    if (!timezone) { console.warn('Quart du moment : fuseau du commerce non résolu — aucun quart n’est déterminé.'); return null; }
    const { data, error } = await client
      .from('station_config').select('horaires').eq('site', site).maybeSingle();
    if (error) { console.error('Chargement horaires station (quart du moment) :', error); return null; }
    const bascule = global.NexusStation.minutesDepuisMinuit(data && data.horaires && data.horaires.quart2 && data.horaires.quart2.normal);
    if (bascule === null) {
      console.warn('Quart du moment : aucun horaire de bascule configuré pour ce commerce.');
      return null;
    }
    // Vocabulaire : Inventaire Manager nomme ses quarts « matin » / « soir » — c'est
    // ce que la contrainte inventaire_plans_comptage_quart_check exige. FDJ
    // les nomme « 1 » / « 2 ». Deux notations pour la même notion, dette de
    // vocabulaire de la même famille qu'A11-5 ; la primitive reste neutre et
    // chaque appelant traduit, plutôt que d'imposer un choix ici.
    const quart = global.NexusStation.quartDepuisMinutes(global.NexusStation.minutesLocalesStation(timezone), bascule);
    return quart === '1' ? 'matin' : quart === '2' ? 'soir' : null;
  }


  async function chargerQuart(client, site, date, quart) {
    const { data, error } = await client.from('inventaire_quarts').select('*').eq('site', site).eq('date', date).eq('quart', quart).maybeSingle();
    if (error) { console.error('Chargement quart:', error); return null; }
    return data;
  }

  // 'sous_observation'/'controle_manager_requis' ajoutés le 30/08/2026
  // (cycle "NEXUS observe avant de conclure") — sans cet ajout, une alerte
  // du cycle deviendrait invisible du manager sur l'écran du quart où elle
  // a été détectée (Article 5, même catch que côté sélection du plan).
  async function chargerAlertesOuvertesQuart(client, site, quartId) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation)')
      .eq('site', site).eq('quart_id', quartId).in('statut', ['ouverte', 'sous_observation', 'controle_manager_requis'])
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

  // Seuils d'écart par catégorie (20/08/2026, Sprint 5 "Seuils d'écart par
  // catégorie", demande de Frédéric — "éventuellement seuils d'écart" dans
  // sa liste de réglages par catégorie). `inventaire_seuils` existait déjà
  // en base (categorie_id, cle, valeur) mais n'était lue nulle part —
  // vocabulaire de `cle` fixé ici pour la première fois : 'quantite_alerte'
  // (miroir de station_config.parametres_inventaire.quantityAlertThreshold)
  // et 'valeur_alerte' (miroir de .valueAlertThreshold), les deux seuls
  // seuils déjà consommés par la vue par exception du manager
  // (depasseSeuilException) — aucun autre seuil inventé sans consommateur
  // réel (Article 5). Retourne une map categorie_id -> { quantite_alerte,
  // valeur_alerte } (clés absentes si non réglées pour cette catégorie —
  // jamais un 0 fabriqué).
  //
  // 30/08/2026 (chantier convergence Inventaire V2, Article 11) : cette
  // fonction faisait sa propre requête, en doublon strict d'une copie
  // inline dans NEXUS-Parametres-Inventaire-v1.html. Les deux délèguent
  // désormais à NexusInventairePlanDonnees.chargerSeuilsEcart (source
  // unique, fichier déjà chargé par les trois écrans concernés) et
  // n'extraient que .parCategorie pour préserver exactement la forme que
  // cette fonction a toujours exposée à ses appelants (depasseSeuilException
  // notamment) — aucun changement de comportement pour eux.
  async function chargerSeuilsEcartCategorie(client, site) {
    const P = global.NexusInventairePlanDonnees;
    if (!P) { console.error('NexusInventairePlanDonnees non chargé — impossible de charger les seuils écart.'); return {}; }
    const { parCategorie } = await P.chargerSeuilsEcart(client, site);
    return parCategorie;
  }

  async function chargerDecisionsQuart(client, quartId) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation)').eq('quart_id', quartId).eq('statut', 'resolue')
      .order('resolue_le', { ascending: false });
    if (error) { console.error('Chargement décisions du quart:', error); return []; }
    return data || [];
  }

  // 'sous_observation'/'controle_manager_requis' ajoutés le 30/08/2026
  // (cycle "NEXUS observe avant de conclure") — mêmes raisons que
  // chargerAlertesOuvertesQuart ci-dessus, appliquées à la vue période.
  async function chargerAlertesOuvertesPeriode(client, site, debut, fin) {
    const { data, error } = await client.from('inventaire_alertes')
      .select('*, inventaire_zone_produit(designation, categorie_id)')
      .eq('site', site).in('statut', ['ouverte', 'en_cours', 'sous_observation', 'controle_manager_requis'])
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

  // Signaux "État de confiance" (audit "NEXUS Inventaire Produit — Chaîne
  // de données", 21/08/2026, §7.1/§8.1) : deux booléens site-larges,
  // jamais un recalcul — un simple comptage de ce qui a déjà été persisté
  // par le flux d'import/rapprochement Decenium existant (Sprint 5/7,
  // comparerVentesQuart). "Démarré" = au moins une ligne importée un jour ;
  // "fiable" = au moins un produit déjà réellement rapproché avec succès.
  // Volontairement SANS fenêtre de date : la maturité de la chaîne est une
  // propriété du site dans le temps, pas de la période consultée à
  // l'écran — sinon changer de période ferait "régresser" un site mature.
  // Le calcul du niveau lui-même reste dans
  // nexus-inventaire-moteur.js::evaluerMaturiteInventaire.
  // 21/08/2026 (cutover production, défense en profondeur demandée par
  // Frédéric) : un import/rapprochement Decenium antérieur au dernier
  // PRODUCTION_START du site ne doit plus faire croire que "Decenium est
  // rapproché" — sinon un ancien fichier de test importé pendant le pilote
  // ferait afficher "Base physique en construction" ou mieux dès le
  // lendemain du cutover, avant même le premier vrai import en production.
  // Réutilise NexusInventairePlanDonnees.chargerDernierPointReference (déjà
  // chargé sur cet écran, Article 11 — jamais une deuxième lecture divergente
  // de inventaire_points_reference).
  async function chargerSignauxMaturiteInventaire(client, site) {
    const PD = global.NexusInventairePlanDonnees;
    const cutover = PD ? await PD.chargerDernierPointReference(client, site, 'PRODUCTION_START') : null;
    let requeteImports = client.from('inventaire_ventes_import').select('id', { count: 'exact', head: true }).eq('site', site);
    let requeteRapprochements = client.from('inventaire_rapprochements').select('statut_validation, importe_le').eq('site', site).eq('statut_validation', 'fiable');
    if (cutover && cutover.date_heure) {
      requeteImports = requeteImports.gte('importe_le', cutover.date_heure);
      requeteRapprochements = requeteRapprochements.gte('importe_le', cutover.date_heure);
    }
    const [{ count: nbImports, error: e1 }, { data: rapprochements, error: e2 }] = await Promise.all([
      requeteImports,
      requeteRapprochements.limit(1),
    ]);
    if (e1) console.error('Chargement imports Decenium (état de confiance):', e1);
    if (e2) console.error('Chargement rapprochements fiables (état de confiance):', e2);
    return {
      deceniumImporte: (nbImports || 0) > 0,
      rapprochementFiable: !!(rapprochements && rapprochements.length > 0),
    };
  }

  global.NexusInventaireManagerDonnees = {
    quartDuMoment, chargerQuart, chargerAlertesOuvertesQuart, chargerComptagesQuart,
    chargerProduitsSensibles, chargerTousProduitsActifsSite, chargerHorairesStation,
    chargerParametresInventaire, chargerCategoriesSite, chargerDecisionsQuart,
    chargerAlertesOuvertesPeriode, chargerDecisionsPeriode, chargerReviewPeriode,
    chargerEmployesSite, chargerModesAveugleActifs, chargerModeJaugeageActif,
    chargerHistoriqueEcartsRecents, chargerCatalogueProduitsPourVentes,
    chargerCategoriesProduitsParId, chargerComptageActuel, chargerImpactCorrection,
    chargerRapprochementsQuart, chargerSeuilsEcartCategorie,
    chargerSignauxMaturiteInventaire,
  };
})(typeof window !== 'undefined' ? window : globalThis);
