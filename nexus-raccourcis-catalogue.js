// ============================================================
// NEXUS Raccourcis — catalogue partagé (10/08/2026)
//
// Demande de Frédéric, vision "Parcours du manager" : rendre "Vos
// raccourcis" (NEXUS-App-v1.html) configurable par site depuis Paramètres
// Station, au lieu d'une liste fixe de 4 outils codée en dur. Ce fichier
// est la "une seule vérité" (Article 11) du catalogue proposable — utilisé
// À LA FOIS par NEXUS-App-v1.html (rendu écran) et
// NEXUS-Parametres-Station-v1.html (sélecteur) : jamais deux listes
// séparées qui pourraient diverger sur un libellé, une description ou le
// statut Professional d'un outil.
//
// `forfait: 'professional'` : identique en esprit à
// NexusForfait.PAGES_PROFESSIONAL (nexus-forfait.js) — un site Essential
// ne doit pas pouvoir choisir un raccourci vers un outil qu'il ne peut de
// toute façon pas ouvrir. Les deux listes sont volontairement tenues à la
// main plutôt que dérivées l'une de l'autre : nexus-forfait.js gate des
// PAGES entières (sécurité), ce catalogue ne fait que proposer un sous-
// ensemble pertinent d'entre elles comme raccourcis (confort) — les
// confondre risquerait de faire dépendre une vraie barrière d'accès d'un
// fichier de présentation.
//
// `desc` : description STATIQUE, affichée telle quelle pour tout
// raccourci choisi. Seuls Cockpit/Verify/Tempo/Produits ont en plus une
// description "vivante" recalculée à partir des données du jour — cette
// logique reste dans NEXUS-App-v1.html (descriptionRaccourci), pas ici :
// ce fichier ne fait AUCUN calcul, aucun accès Supabase (comme tout
// moteur NEXUS).
//
// Inclure dans une page : <script src="nexus-raccourcis-catalogue.js"></script>
// ------------------------------------------------------------

(function (global) {
  const RACCOURCIS_CATALOGUE = {
    'NEXUS-Cockpit-v2.html': { label: 'Cockpit', icone: 'assets/icons/icon-home.png', desc: "Le brief du matin, en un coup d'œil" },
    'NEXUS-Verify-v1.html': { label: 'Verify', icone: 'assets/icons/icon-nexus-verify.png', filtreIcone: 'filter:grayscale(1) brightness(1.05) contrast(1.05) sepia(1) hue-rotate(152deg) saturate(4);', desc: 'Contrôle caisse et écarts' },
    'NEXUS-Tempo-v1.html': { label: 'Tempo', icone: 'assets/icons/icon-nexus-tempo.png', desc: 'Les jours qui portent votre station' },
    'NEXUS-Produits-v1.html': { label: 'Produits', icone: 'assets/icons/icon-produits.png', desc: 'Fiche complète par référence' },
    'NEXUS-Brief-v1.html': { label: 'Brief NEXUS', emoji: '🧭', desc: 'La synthèse du dirigeant' },
    'NEXUS-Rapport-v1.html': { label: 'Rapport NEXUS', emoji: '📑', desc: 'CA, marge et décisions sur une période choisie' },
    'NEXUS-Rayon-v1.html': { label: 'Rayon', emoji: '🗂️', desc: 'CA, marge, top ventes par catégorie' },
    'NEXUS-Carburants-v1.html': { label: 'Carburants', emoji: '⛽', desc: "Jaugeage à l'ouverture, théorique et écart" },
    'NEXUS-Carburants-Pilotage-v1.html': { label: 'Carburants Pilotage', emoji: '📈', desc: 'Volumes, mix et moteurs de performance' },
    'NEXUS-FDJ-Analyse-v1.html': { label: 'FDJ Pilotage', emoji: '📊', desc: 'Tendances, jeux, équipe, stock et écarts', forfait: 'professional' },
    'NEXUS-Scanner-Stock-v1.html': { label: 'Scanner Stock', emoji: '📦', desc: "Où vous perdez de l'argent, quoi recompter" },
    'NEXUS-Missions-v1.html': { label: 'Missions', emoji: '✅', desc: '55 procédures · checklist interactive' },
    'NEXUS-Journal-v1.html': { label: 'Journal', emoji: '📓', desc: "Qu'est-ce qui a été fait aujourd'hui ?", forfait: 'professional' },
    'NEXUS-Capital-v1.html': { label: 'Capital NEXUS', emoji: '💎', desc: 'La valeur créée par vos décisions', forfait: 'professional' },
    'NEXUS-Scanner-v1.html': { label: 'Scanner NEXUS', emoji: '🔎', desc: 'CA, marge et répartition ABC', forfait: 'professional' },
    'NEXUS-Radar-Manager-v1.html': { label: 'Radar du Manager', emoji: '🧭', desc: '8 domaines de responsabilité', forfait: 'professional' },
    'NEXUS-Centre-Intelligence-v1.html': { label: "Centre d'Intelligence", emoji: '🧠', desc: 'Que détecte NEXUS dans mon commerce ?' },
    'NEXUS-Inventaire-Manager-v1.html': { label: 'Contrôle inventaire', emoji: '🧮', desc: 'Écarts, comptages manquants', forfait: 'professional' },
    'NEXUS-Import-v1.html': { label: 'Import', emoji: '⬆️', desc: 'Ventes, catalogue ou stock instantané' },
  };

  const RACCOURCIS_DEFAUT = ['NEXUS-Cockpit-v2.html', 'NEXUS-Verify-v1.html', 'NEXUS-Tempo-v1.html', 'NEXUS-Produits-v1.html'];
  const MAX_RACCOURCIS = 4;

  global.NexusRaccourcisCatalogue = { RACCOURCIS_CATALOGUE, RACCOURCIS_DEFAUT, MAX_RACCOURCIS };
})(typeof window !== 'undefined' ? window : globalThis);
