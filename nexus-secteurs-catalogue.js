// ============================================================
// NEXUS Secteurs — catalogue partagé (11/08/2026)
//
// Naît de l'audit stratégique fourni par Frédéric
// ("NEXUS_Audit_Strategique_Brief_Rapport_Direction.pdf") : Brief NEXUS et
// Rapport NEXUS s'organisent désormais autour d'une liste de "secteurs"
// (Carburants, Commerce, Marge, FDJ, Opérations, Équipe pour une
// station-service) plutôt que d'une Boussole à 5 axes de granularité
// hétérogène. L'audit exige explicitement que cette structure ne soit
// jamais codée en dur pour un seul métier ("station-service aujourd'hui,
// boulangerie, restaurant ou commerce demain, sans coder un Brief différent
// pour chaque métier").
//
// Ce fichier est le CATALOGUE (présentation : id/label/icône/route de
// détail) — Article 11, "une seule vérité" — utilisé à la fois par
// NEXUS-Brief-v1.html et NEXUS-Rapport-v1.html. La façon de CALCULER le
// contrat d'un secteur (statut/évolution/forces/fragilités/décision, voir
// Annexe A de l'audit) vit dans nexus-secteurs-moteur.js, sous un
// constructeur dédié par id (CONSTRUCTEUR_SECTEUR). Un secteur listé ici
// sans constructeur correspondant dans le moteur ne peut pas encore être
// affiché — volontaire : mieux vaut un secteur absent du Brief qu'un
// secteur affiché sans données réelles (Article 5).
//
// site.type_commerce / site.secteurs (colonnes Supabase, migration
// ajouter_secteurs_configurables_sites, 11/08/2026) déterminent la liste
// ACTIVE d'un site — voir secteursActifsSite() ci-dessous. Même principe
// que station_config.raccourcis (catalogue JS + config nullable par site,
// v2.30) : NULL = utilise le preset par défaut du métier, jamais un écran
// vide silencieux.
//
// Inclure dans une page : <script src="nexus-secteurs-catalogue.js?v=20260903-2159"></script>
// ------------------------------------------------------------

(function (global) {
  // `libelleChecklist` (22/08/2026, demande de Frédéric — "Brief doit
  // interroger la station, pas réciter une liste de modules codée en dur")
  // : phrase affichée pendant l'écran de chargement de Brief NEXUS pendant
  // que ce secteur est réellement interrogé (voir demarrerAnimationChargement
  // dans NEXUS-Brief-v1.html). Optionnel — un secteur ajouté demain sans
  // entrée dédiée ici obtient automatiquement un repli générique
  // (`${label} analysé`), jamais un écran cassé ou halte sur un id inconnu :
  // c'est ce filet qui permet à un futur métier (boulangerie, pharmacie...)
  // d'apparaître à l'écran de chargement sans toucher à Brief lui-même.
  const SECTEURS_CATALOGUE = {
    carburants: { id: 'carburants', label: 'Carburants', icone: '⛽', cible: 'NEXUS-Carburants-Pilotage-v1.html', libelleChecklist: 'Carburants analysés' },
    commerce:   { id: 'commerce',   label: 'Commerce',   icone: '🛒', cible: 'NEXUS-Produits-v1.html', libelleChecklist: 'Ventes analysées' },
    marge:      { id: 'marge',      label: 'Marge',      icone: '💰', cible: 'NEXUS-Scanner-v1.html', libelleChecklist: 'Marge analysée' },
    fdj:        { id: 'fdj',        label: 'FDJ',        icone: '🎟️', cible: 'NEXUS-FDJ-Analyse-v1.html', libelleChecklist: 'FDJ analysée' },
    operations: { id: 'operations', label: 'Opérations', icone: '⚙️', cible: 'NEXUS-Verify-v1.html', libelleChecklist: 'Contrôles consolidés' },
    equipe:     { id: 'equipe',     label: 'Équipe',     icone: '👥', cible: 'NEXUS-Resultats-Equipe-v1.html', libelleChecklist: 'Équipe analysée' },
  };

  // Presets par métier (audit, section 5). Seul 'station-service' a des
  // constructeurs réels dans nexus-secteurs-moteur.js aujourd'hui — c'est le
  // seul métier réel chez NEXUS actuellement. Les autres presets sont
  // documentés pour prouver que l'architecture n'est pas verrouillée sur la
  // station-service, mais ne seront affichables que le jour où un site de ce
  // type_commerce existera ET que les moteurs métier correspondants auront
  // été construits (Production/Matières premières/Pertes n'existent pas
  // encore dans NEXUS).
  const SECTEURS_PRESET_METIER = {
    'station-service': ['carburants', 'commerce', 'marge', 'fdj', 'operations', 'equipe'],
    'boulangerie': ['production', 'vente_boutique', 'marge', 'matieres_premieres', 'pertes_invendus', 'equipe'],
    'restaurant': ['salle', 'cuisine', 'marge', 'achats_stocks', 'pertes', 'equipe'],
    'commerce_detail': ['ventes', 'marge', 'stocks', 'clients', 'operations', 'equipe'],
  };

  const SECTEUR_PRESET_DEFAUT = 'station-service';

  // Résout la liste de secteurs ACTIFS pour un site donné ({type_commerce,
  // secteurs} — ex. une ligne de la table sites).
  //
  // DURCI le 11/08/2026 (audit "philosophie/architecture", section 6.4,
  // demande explicite de Frédéric) : cette fonction retombait auparavant
  // TOUJOURS, silencieusement, sur le preset station-service dès que `site`
  // était absent (site non chargé, erreur réseau, site_id invalide) ou que
  // `type_commerce` était vide/inconnu — un manager d'un site mal configuré
  // aurait alors vu les 6 secteurs d'une station-service (Carburants, FDJ...)
  // sans jamais savoir que NEXUS avait deviné à sa place. Pire : un
  // type_commerce RECONNU mais pas encore outillé (ex. 'boulangerie', dont
  // aucun id de preset n'existe dans SECTEURS_CATALOGUE aujourd'hui)
  // produisait une liste vide sans passer par ce repli — un Brief NEXUS
  // silencieusement sans aucun secteur, sans explication.
  //
  // Retourne désormais TOUJOURS { secteurs, statut, typeCommerce } — jamais
  // un simple tableau — pour que l'appelant distingue explicitement 3 cas :
  //   'ok'                  — configuration reconnue et outillée
  //   'non_configure'       — site absent ou type_commerce non renseigné
  //   'metier_non_outille'  — type_commerce reconnu (ou secteurs personnalisés
  //                           fournis) mais aucun des secteurs demandés
  //                           n'existe dans SECTEURS_CATALOGUE (aucun
  //                           constructeur métier construit pour l'instant)
  // Aucun des deux derniers cas ne retombe plus sur station-service : c'est
  // à l'appelant d'afficher explicitement "configuration métier incomplète"
  // (voir NEXUS-Brief-v1.html) plutôt que de laisser croire à une mesure
  // réelle.
  function secteursActifsSite(site) {
    if (!site || !site.type_commerce) {
      return { secteurs: [], statut: 'non_configure', typeCommerce: (site && site.type_commerce) || null };
    }
    const typeCommerce = site.type_commerce;
    const override = Array.isArray(site.secteurs) && site.secteurs.length ? site.secteurs : null;
    const presetConnu = SECTEURS_PRESET_METIER[typeCommerce];
    if (!override && !presetConnu) {
      return { secteurs: [], statut: 'non_configure', typeCommerce };
    }
    const ids = override || presetConnu;
    const secteurs = ids.map(id => SECTEURS_CATALOGUE[id]).filter(Boolean);
    // Couverture INTÉGRALE exigée, pas seulement "au moins un secteur"
    // (bug trouvé en testant ce correctif, 11/08/2026) : le preset
    // 'boulangerie' partage 2 ids avec le catalogue station-service
    // ('marge', 'equipe') sur ses 6 ids demandés — un simple `secteurs.length
    // > 0` aurait laissé passer un Brief à 2 secteurs sur 6, avec statut
    // 'ok', sans que rien ne signale les 4 secteurs manquants. Si TOUS les
    // ids demandés ne sont pas dans SECTEURS_CATALOGUE, le métier est
    // considéré comme non outillé dans son ensemble plutôt que partiellement
    // affiché.
    if (secteurs.length !== ids.length) {
      return { secteurs: [], statut: 'metier_non_outille', typeCommerce };
    }
    return { secteurs, statut: 'ok', typeCommerce };
  }

  global.NexusSecteursCatalogue = {
    SECTEURS_CATALOGUE, SECTEURS_PRESET_METIER, SECTEUR_PRESET_DEFAUT, secteursActifsSite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
