// ============================================================
// NEXUS Forfait — deux offres, Essential et Professional.
//
// Demande de Frédéric le 26/07/2026 : un bouton à cocher Essential/
// Professional dans Paramètres Station (lecture seule pour le manager),
// et une option réservée au créateur pour attribuer le forfait à un site
// (NEXUS-Admin-Sites-v1.html). Essential donne accès à Cockpit, Produits,
// Rayon, Centre d'Intelligence NEXUS (Alertes), Scanner Stock, Import,
// Paramètres Station, Nexus Verify et Missions/Plans d'action — les outils
// du quotidien. Professional ajoute TOUTES les autres fonctionnalités.
//
// Le champ source de vérité est sites.forfait (migration
// ajouter_forfait_sites, 26/07/2026) — jamais un état local ou un
// paramètre d'URL : un manager ne doit jamais pouvoir se donner
// lui-même l'accès Professional.
//
// Deux niveaux de protection, comme le reste de NEXUS (jamais un seul
// lien masqué qui suffirait à "protéger" une page) :
//   1. NEXUS-App-v1.html verrouille visuellement les entrées de menu
//      Professional quand le site est Essential (voir nexusChargerForfait
//      + verrouillerNavProfessional côté App).
//   2. Chaque page Professional appelle nexusRequireProfessional() juste
//      après nexusRequireAuth() — un lien direct copié/collé ne suffit
//      donc pas à contourner la restriction.
//
// Inclure dans une page : <script src="nexus-forfait.js"></script>
// (même mécanisme que nexus-auth.js, nexus-tempo.js, nexus-campagnes.js)
// ============================================================

(function (global) {
  // Les 10 pages qui exigent le forfait Professional — tout le reste de
  // NEXUS (Cockpit, Produits, Rayon, Centre d'Intelligence NEXUS, Scanner
  // Stock, Import, Paramètres Station, Nexus Verify, Missions, écrans
  // employés) reste accessible en Essential.
  const PAGES_PROFESSIONAL = [
    'NEXUS-Tempo-v1.html',
    'NEXUS-Campagne-v1.html',
    'NEXUS-Capital-v1.html',
    'NEXUS-Planning-v1.html',
    'NEXUS-Scanner-v1.html',
    'NEXUS-Journal-v1.html',
    'NEXUS-Assignations-v1.html',
    'NEXUS-Resultats-Equipe-v1.html',
    'NEXUS-Evaluation-Employe-v1.html',
    'NEXUS-Radar-Manager-v1.html',
  ];

  const FORFAIT_LABELS = { essential: 'Essential', professional: 'Professional' };

  function estProfessional(forfait) {
    return forfait === 'professional';
  }

  function pageEstProfessional(nomFichier) {
    return PAGES_PROFESSIONAL.includes(nomFichier);
  }

  // Lit le forfait réel du site depuis Supabase — jamais depuis un cache
  // local, pour qu'un changement du créateur s'applique immédiatement à
  // la prochaine navigation.
  async function chargerForfait(siteId) {
    const { data, error } = await nexusClient.from('sites').select('forfait').eq('site_id', siteId).maybeSingle();
    if (error) {
      console.error('Chargement forfait site:', error);
      return null; // ne bloque jamais sur une erreur réseau — voir nexusRequireProfessional
    }
    return (data && data.forfait) || 'essential';
  }

  // À appeler juste après nexusRequireAuth() dans chaque page Professional.
  // Redirige vers l'accueil si le site n'a pas (ou plus) le forfait
  // Professional. En cas d'erreur réseau, laisse passer plutôt que de
  // bloquer un manager légitime sur un souci de connexion — la vraie
  // barrière reste la RLS/logique métier des tables sensibles, pas cet
  // écran seul.
  async function nexusRequireProfessional(nomFichier, siteId) {
    const forfait = await chargerForfait(siteId);
    if (forfait === null) return true;
    if (!estProfessional(forfait)) {
      window.location.href = 'NEXUS-App-v1.html?forfait_requis=' + encodeURIComponent(nomFichier);
      return false;
    }
    return true;
  }

  global.NexusForfait = {
    PAGES_PROFESSIONAL, FORFAIT_LABELS,
    estProfessional, pageEstProfessional, chargerForfait, nexusRequireProfessional,
  };
})(typeof window !== 'undefined' ? window : globalThis);
