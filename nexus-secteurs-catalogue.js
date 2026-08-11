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
// Inclure dans une page : <script src="nexus-secteurs-catalogue.js"></script>
// ------------------------------------------------------------

(function (global) {
  const SECTEURS_CATALOGUE = {
    carburants: { id: 'carburants', label: 'Carburants', icone: '⛽', cible: 'NEXUS-Carburants-Pilotage-v1.html' },
    commerce:   { id: 'commerce',   label: 'Commerce',   icone: '🛒', cible: 'NEXUS-Produits-v1.html' },
    marge:      { id: 'marge',      label: 'Marge',      icone: '💰', cible: 'NEXUS-Scanner-v1.html' },
    fdj:        { id: 'fdj',        label: 'FDJ',        icone: '🎟️', cible: 'NEXUS-FDJ-Analyse-v1.html' },
    operations: { id: 'operations', label: 'Opérations', icone: '⚙️', cible: 'NEXUS-Verify-v1.html' },
    equipe:     { id: 'equipe',     label: 'Équipe',     icone: '👥', cible: 'NEXUS-Resultats-Equipe-v1.html' },
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
  // secteurs} — ex. une ligne de la table sites). Ne retombe jamais sur une
  // liste vide silencieuse : un type_commerce inconnu ou un site sans
  // colonne renseignée utilise le preset station-service par défaut.
  // Filtre ensuite sur SECTEURS_CATALOGUE (id inconnu = ignoré plutôt que de
  // planter le rendu).
  function secteursActifsSite(site) {
    const typeCommerce = (site && site.type_commerce) || SECTEUR_PRESET_DEFAUT;
    const override = site && Array.isArray(site.secteurs) && site.secteurs.length ? site.secteurs : null;
    const ids = override || SECTEURS_PRESET_METIER[typeCommerce] || SECTEURS_PRESET_METIER[SECTEUR_PRESET_DEFAUT];
    return ids.map(id => SECTEURS_CATALOGUE[id]).filter(Boolean);
  }

  global.NexusSecteursCatalogue = {
    SECTEURS_CATALOGUE, SECTEURS_PRESET_METIER, SECTEUR_PRESET_DEFAUT, secteursActifsSite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
