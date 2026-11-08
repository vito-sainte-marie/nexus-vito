// NEXUS — nexus-desktop.js
// Vue bureau (02/08/2026, demande de Frédéric) : "par défaut, NEXUS reste en
// vue mobile — un bouton permet de passer en vue bureau si on travaille sur
// ordinateur." Le mobile reste donc TOUJOURS le comportement par défaut,
// sur tous les appareils, tant que ce choix n'a pas été fait explicitement.
//
// PILOTE (02/08/2026) : n'est inclus pour l'instant QUE sur NEXUS-Verify-v1
// (écran choisi avec Frédéric pour valider le style avant de généraliser à
// tout NEXUS). À inclure sur une nouvelle page : <script src="nexus-desktop.js?v=20260904-0104"></script>
// après nexus-auth.js, plus un peu de CSS spécifique à l'écran (voir le
// bloc "Vue bureau" dans le <style> de NEXUS-Verify-v1.html) pour que son
// contenu se réorganise en plusieurs colonnes — ce fichier pose la coquille
// commune (bascule + barre latérale), pas la mise en page de chaque écran.
//
// Choix technique : préférence stockée en localStorage (par appareil), pas
// en base — c'est un réglage d'affichage, pas une donnée métier. Se
// souvient du choix sur CET ordinateur, indépendamment du compte qui se
// connecte dessus.
// ------------------------------------------------------------

const NEXUS_DESKTOP_KEY = 'nexus_vue_bureau';

function nexusEstVueBureau() {
  try { return localStorage.getItem(NEXUS_DESKTOP_KEY) === 'on'; } catch (e) { return false; }
}

function nexusBasculerVueBureau() {
  try {
    const actuel = nexusEstVueBureau();
    localStorage.setItem(NEXUS_DESKTOP_KEY, actuel ? 'off' : 'on');
  } catch (e) {}
  window.location.reload();
}

// Navigation reprise du menu "☰ Menu" de NEXUS-App-v1.html (mêmes écrans,
// mêmes icônes, mêmes libellés — 02/08/2026). Les entrées réservées au
// créateur (Administration multi-site, Debug créateur) et les badges
// Professional/Preview de App-v1 ne sont volontairement pas repris ici pour
// ce pilote : la barre latérale montre la navigation, pas l'habillage
// commercial des forfaits — à revoir ensemble si on généralise.
// Descriptions au survol (24/08/2026, demande de Frédéric — "un
// micro-tooltip très court, une phrase maximum, répond instantanément à
// 'à quoi sert-il ?'") : `desc` sur chaque item ci-dessous, consommé par le
// tooltip générique installé par nexusInstallerTooltipsSidebar(). Objectif
// explicite : un nouveau manager doit comprendre la navigation sans
// formation lourde, particulièrement à l'approche du 2e site pilote. Les
// phrases fournies par Frédéric sont reprises littéralement ; celles qu'il
// n'a pas couvertes (Rapport NEXUS, Comptes Clients, Boîte de réception,
// Paramètres Comptes Clients, Comprendre NEXUS, Imports, Paramètres,
// Paramètres Inventaire, Paramètres FDJ, Rappels, FDJ, Accueil) suivent le
// même registre (une phrase, verbe d'action, jamais un titre).
const NEXUS_SIDEBAR_GROUPES = [
  {
    nom: 'Piloter',
    items: [
      { label: 'Brief NEXUS', module: 'mod-brief', href: 'NEXUS-Brief-v1.html', icon: 'assets/icons/icon-brief-nexus.png', desc: 'Synthèse des priorités et décisions du moment.' },
      // Rapport NEXUS (10/08/2026, cadrage développeur de Frédéric) : rejoint
      // Piloter juste après Brief NEXUS — Brief est l'instantané "aujourd'hui"
      // (toujours 1 page), Rapport compare une période calendaire choisie
      // (semaine/mois/trimestre/année/dates libres) à une référence résolue
      // automatiquement. V1 : Chapitres 1 (Synthèse dirigeant) + 2 (Santé de
      // l'entreprise) seulement — les 10 autres chapitres du cadrage restent
      // à construire.
      { label: 'Rapport NEXUS', module: 'mod-rapport', href: 'NEXUS-Rapport-v1.html', icon: null, emoji: '📑', desc: 'Compare une période choisie à une référence pour l’entreprise.' },
      { label: 'Cockpit', module: 'mod-cockpit', href: 'NEXUS-Cockpit-v2.html', icon: 'assets/icons/icon-home.png', desc: 'Votre plan d’action opérationnel du jour.' },
      { label: 'Journal', module: 'mod-journal', href: 'NEXUS-Journal-v1.html', icon: 'assets/icons/icon-journal-nexus.png', desc: 'Historique des faits, actions et événements NEXUS.' },
      { label: 'Capital NEXUS', module: 'mod-capital', href: 'NEXUS-Capital-v1.html', icon: 'assets/icons/icon-capital.png', desc: 'Valeur économique générée ou sécurisée par vos décisions.' },
      { label: 'Scanner NEXUS', module: 'mod-scanner', href: 'NEXUS-Scanner-v1.html', icon: 'assets/icons/icon-scanner.png', desc: 'Détecte les anomalies, écarts et opportunités commerciales.' },
      { label: 'Radar du Manager', module: 'mod-radar', href: 'NEXUS-Radar-Manager-v1.html', icon: 'assets/icons/icon-radar.png', desc: 'Vue rapide des zones qui nécessitent votre attention.' },
    ],
  },
  {
    nom: 'Performer',
    items: [
      { label: 'Produits', module: 'mod-produits', href: 'NEXUS-Produits-v1.html', icon: 'assets/icons/icon-produits.png', desc: 'Analyse les ventes, rotations et performances produits.' },
      { label: 'Tempo', module: 'mod-tempo', href: 'NEXUS-Tempo-v1.html', icon: 'assets/icons/icon-nexus-tempo.png', desc: 'Repère les jours et périodes à renforcer.' },
      { label: 'Campagnes', module: 'mod-campagnes', href: 'NEXUS-Campagne-v1.html', icon: 'assets/icons/icon-campagne-nexus.png', desc: 'Suit la performance de vos actions commerciales.' },
      { label: 'Scanner Stock', module: 'mod-scanner-stock', href: 'NEXUS-Scanner-Stock-v1.html', icon: 'assets/icons/icon-scanner-stock.png', desc: 'Repère les écarts et références à recompter.' },
    ],
  },
  {
    nom: 'Exécuter',
    items: [
      { label: 'Verify', module: 'mod-verify', href: 'NEXUS-Verify-v1.html', icon: 'assets/icons/icon-nexus-verify.png', desc: 'Contrôle les caisses et rapproche les moyens de paiement.' },
      // Carburants (10/08/2026, demande de Frédéric) : rejoint Exécuter,
      // juste à côté de Verify — le litrage vendu qu'il consomme vient de
      // là (litrage_gazole/sp95/gnr), jamais ressaisi.
      { label: 'Carburants', module: 'mod-carburants', href: 'NEXUS-Carburants-v1.html', icon: null, emoji: '⛽', desc: 'Saisie et suivi des jaugeages carburant.' },
      // Réception carburant (14/08/2026, audit "Réceptions, deltas et
      // effet économique du stock", P1) : parcours employé dédié à la
      // réception d'une livraison (jaugeage avant/après, BL, calcul NEXUS)
      // — juste à côté de Carburants, comme FDJ/FDJ Opérations.
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-reception-carburant-24.png
      { label: 'Réception carburant', module: 'mod-reception-carburant', href: 'NEXUS-Carburant-Reception-v1.html', icon: 'assets/icons/icon-reception-carburant-24.png', desc: 'Contrôle les livraisons et les volumes réellement reçus.' },
      // Carburants Performance (11/08/2026, Phase 1 de la montée en
      // puissance demandée par Frédéric ; renommé "Performance" le
      // 24/08/2026 pour se distinguer nettement de Carburants) : la couche
      // dirigeant, juste après le Relevé du jour — même position relative
      // que FDJ Performance après FDJ Opérations.
      { label: 'Carburants Performance', module: 'mod-carburants-performance', href: 'NEXUS-Carburants-Pilotage-v1.html', icon: null, emoji: '📈', desc: 'Analyse volumes, autonomie, écarts et tendances carburant.' },
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-inventaire-24.png
      // remplace l'ancienne icon-inventaire.png — même icône réutilisée sur
      // Contrôle inventaire juste en dessous (même domaine, cf. Article 11).
      { label: 'Inventaire', module: 'mod-inventaire', href: 'NEXUS-Inventaire-v1.html', icon: 'assets/icons/icon-inventaire-24.png', desc: 'Guide les comptages terrain de l’équipe.' },
      { label: 'Contrôle inventaire', module: 'mod-controle-inventaire', href: 'NEXUS-Inventaire-Manager-v1.html', icon: 'assets/icons/icon-inventaire-24.png', desc: 'Analyse les écarts, anomalies et comptages à traiter.' },
      // NEXUS FDJ (09/08/2026, demande de Frédéric) : rejoint Exécuter,
      // juste à côté d'Inventaire — même logique de comptage de quart.
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-fdj-24.png,
      // réutilisée sur FDJ Opérations et FDJ Performance (même domaine).
      { label: 'FDJ', module: 'mod-fdj', href: 'NEXUS-FDJ-v1.html', icon: 'assets/icons/icon-fdj-24.png', desc: 'Grattage, tirages et caisse FDJ du quart.' },
      // Contrôle FDJ → FDJ Opérations (24/08/2026, demande de Frédéric) :
      // "Contrôle FDJ" et "FDJ Pilotage" trop proches lexicalement pour des
      // fonctions très différentes — Opérations (registre quarts/caisse/
      // stock/mouvements) vs Performance (analyse/décision), vocabulaire
      // figé par Frédéric.
      { label: 'FDJ Opérations', href: 'NEXUS-FDJ-Manager-v1.html', icon: 'assets/icons/icon-fdj-24.png', desc: 'Gère quarts, caisse, carnets et mouvements FDJ.' },
      // FDJ Pilotage → FDJ Performance (24/08/2026, même demande) : NEXUS
      // FDJ - Analyse (09/08/2026, Phase C de l'audit "Moteur de
      // clairvoyance manager") : moteur de statistiques/tendances/
      // décisions, juste après FDJ Opérations.
      { label: 'FDJ Performance', module: 'mod-fdj-performance', href: 'NEXUS-FDJ-Analyse-v1.html', icon: null, emoji: '📊', desc: 'Analyse ventes, jeux, écarts et tendances FDJ.' },
      // NEXUS Coach x FDJ Pilotage (09/08/2026, étape "écran employé" de
      // l'audit "Coach x FDJ Pilotage") : micro-coaching quotidien par
      // employé, juste après FDJ Performance.
      // Icône pack NEXUS (20/08/2026, uniformisation) : avatar_coach — sens
      // littéral "Coach".
      { label: 'Coach FDJ', module: 'mod-coach-fdj', href: 'NEXUS-Coach-FDJ-v1.html', icon: 'assets/icons/icon-avatar-coach-24.png', desc: 'Donne à l’employé une priorité FDJ claire et contextualisée.' },
      { label: 'Missions', module: 'mod-missions', href: 'NEXUS-Missions-v1.html', icon: 'assets/icons/icon-missions.png', desc: 'Crée et suit les tâches opérationnelles.' },
      { label: 'Assignations', module: 'mod-assignations', href: 'NEXUS-Assignations-v1.html', icon: 'assets/icons/icon-assignations.png', desc: 'Répartit les actions entre les membres de l’équipe.' },
      { label: 'Planning', module: 'mod-planning', href: 'NEXUS-Planning-v1.html', icon: 'assets/icons/icon-planner.png', desc: 'Organise la présence et les horaires de l’équipe.' },
    ],
  },
  {
    nom: 'Équipe',
    items: [
      { label: 'Évaluations', module: 'mod-evaluations', href: 'NEXUS-Evaluation-Employe-v1.html', icon: 'assets/icons/icon-evaluation.png', desc: 'Évalue la réalisation et la qualité du travail.' },
      { label: 'Résultats', module: 'mod-resultats', href: 'NEXUS-Resultats-Equipe-v1.html', icon: 'assets/icons/icon-resultats-equipe.png', desc: 'Suit la progression et les performances de l’équipe.' },
      // Paye (09/10/2026, demande de Frédéric) : l'écran n'était joignable que
      // par le menu ☰ de l'accueil. Pas d'icône dédiée dans assets/icons.
      { label: 'Paye', module: 'mod-paye', href: 'NEXUS-Paye-v1.html', icon: null, emoji: '💶', desc: 'Prépare les variables de paye du mois pour la comptabilité.' },
    ],
  },
  {
    // Groupe ajouté le 07/08/2026, demande de Frédéric : les 3 écrans du
    // module Comptes Clients (accueil, boîte de réception, paramètres)
    // rejoignent la vue bureau et le menu latéral, comme NEXUS Verify.
    nom: 'Comptes Clients',
    items: [
      // 👥 harmonisé avec le tiroir Explorer NEXUS (qui utilisait 🧾) le
      // 20/08/2026 — pas d'icône dédiée dans le pack NEXUS pour ce domaine.
      { label: 'Comptes Clients', module: 'mod-comptes-clients', href: 'NEXUS-Comptes-Clients-v1.html', icon: null, emoji: '👥', desc: 'Gère les comptes clients à crédit et leurs mouvements.' },
      { label: 'Boîte de réception', module: 'mod-boite-reception', href: 'NEXUS-Boite-Reception-v1.html', icon: null, emoji: '📥', desc: 'Centralise les demandes des comptes clients.' },
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-parametres-24.png.
      { label: 'Paramètres Comptes Clients', href: 'NEXUS-Parametres-Comptes-Clients-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les règles et plafonds des comptes clients.' },
    ],
  },
  {
    // Ajouté 07/08/2026, demande de Frédéric — renommé le même jour
    // ("Comprendre NEXUS" plutôt que "Documentation" / "Mode d'emploi") :
    // point d'entrée par intention vers les moteurs NEXUS, avec sa
    // propre recherche par mots-clés.
    nom: 'Aide',
    items: [
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-aide-24.png.
      { label: 'Comprendre NEXUS', module: 'mod-aide', href: 'NEXUS-Documentation-v1.html', icon: 'assets/icons/icon-aide-24.png', desc: 'Explique à quoi sert chaque écran NEXUS.' },
    ],
  },
  {
    nom: 'Administrer',
    items: [
      { label: 'Imports', module: 'mod-imports', href: 'NEXUS-Import-v1.html', icon: 'assets/icons/icon-import.png', desc: 'Importe vos données externes dans NEXUS.' },
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-parametres-24.png,
      // même icône sur les 4 écrans "Paramètres…" (Station, Comptes Clients,
      // Inventaire, FDJ) — un seul concept visuel pour un seul concept métier.
      { label: 'Paramètres', module: 'mod-parametres', href: 'NEXUS-Parametres-Station-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les réglages généraux de la station.' },
      // Ajouté 07/08/2026, demande de Frédéric — rejoint aussi le tiroir
      // "Explorer NEXUS" (NEXUS-App-v1.html, groupe Administrer) le même jour.
      { label: 'Paramètres Inventaire', href: 'NEXUS-Parametres-Inventaire-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les règles et seuils de l’inventaire.' },
      // Paramètres FDJ (10/08/2026, audit "Paramétrage autonome & multi-
      // site", étape 3) : rejoint Paramètres Inventaire, même logique.
      { label: 'Paramètres FDJ', href: 'NEXUS-FDJ-Parametres-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les seuils et réglages du module FDJ.' },
      { label: 'Rappels', module: 'mod-rappels', href: 'NEXUS-Parametres-Rappels-v1.html', icon: 'assets/icons/icon-rappels.png', desc: 'Gère les rappels officiels FDJ à traiter.' },
    ],
  },
];

// Échappement minimal pour les attributs data-* — les libellés/descriptions
// ci-dessus sont tous des constantes internes (jamais une saisie
// utilisateur), donc ce n'est pas une protection XSS à proprement parler,
// juste de quoi ne pas casser le HTML si une description contient un
// guillemet double un jour.
function nexusEchapperAttribut(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function nexusConstruireSidebarHTML() {
  const pageActuelle = window.location.pathname.split('/').pop();
  const lienIcone = (item) => {
    const ancien = item.icon
      ? `<img src="${item.icon}" alt="">`
      : `<span class="nexus-sidebar-emoji" style="font-size:15px;">${item.emoji || '•'}</span>`;
    // Icônes de modules v2 (07/11/2026) : via le registre nexus-icones.js ; ICONES_V2 = false → ancien rendu.
    return (item.module && window.NexusIcones)
      ? window.NexusIcones.img(item.module, 16, { decoratif: true, ancien })
      : ancien;
  };
  const groupesHTML = NEXUS_SIDEBAR_GROUPES.map(g => `
    <div class="nexus-sidebar-group">${g.nom}</div>
    ${g.items.map(item => `
      <a class="nexus-sidebar-link${item.href === pageActuelle ? ' active' : ''}" href="${item.href}"${item.desc ? ` data-tooltip="${nexusEchapperAttribut(item.label)}" data-tooltip-desc="${nexusEchapperAttribut(item.desc)}"` : ''}>
        ${lienIcone(item)}
        <span>${item.label}</span>
      </a>
    `).join('')}
  `).join('');

  return `
    <div class="nexus-sb-barre">
      <button type="button" class="nexus-sb-pli" aria-controls="nexus-sidebar-principal" aria-expanded="true" aria-label="Replier le menu" title="Replier le menu (Ctrl+\\)">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 3 3.5 8 8 13M13 3 8.5 8 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <a class="nexus-sidebar-brand" href="NEXUS-App-v1.html" title="Retour à l'accueil NEXUS">
      <img src="assets/avatar/nexus-avatar-64.png" srcset="assets/avatar/nexus-avatar-64.png 64w, assets/avatar/nexus-avatar-96.png 96w, assets/avatar/nexus-avatar-128.png 128w" sizes="30px" width="30" height="30" alt="NEXUS">
      <span>NEXUS</span>
    </a>
    <div class="nexus-sidebar-scroll">
      <a class="nexus-sidebar-link${pageActuelle === 'NEXUS-App-v1.html' ? ' active' : ''}" href="NEXUS-App-v1.html" style="margin-bottom:8px;">
        ${window.NexusIcones ? window.NexusIcones.img('mod-accueil', 16, { decoratif: true, ancien: '<img src="assets/icons/icon-home.png" alt="">' }) : '<img src="assets/icons/icon-home.png" alt="">'}
        <span>Accueil</span>
      </a>
      ${groupesHTML}
    </div>
    <div class="nexus-sidebar-foot">
      <button type="button" class="nexus-sidebar-toggle" onclick="nexusBasculerVueBureau()">📱 Repasser en vue mobile</button>
    </div>
  `;
}

// Feuille de style de la coquille bureau — injectée en JS pour rester
// centralisée dans ce seul fichier plutôt que copiée dans chaque écran
// NEXUS (même logique que nexus-auth.js : un seul endroit à corriger).
const NEXUS_DESKTOP_CSS = `
  body.nexus-desktop{justify-content:flex-start !important; align-items:stretch;}
  body.nexus-desktop .menu-btn{display:none !important;}
  body.nexus-desktop > .phone, body.nexus-desktop > .app{
    max-width:none !important; flex:1; min-width:0;
    border-left:none !important;
  }
  .nexus-sidebar{
    width:230px; flex-shrink:0; background:#0d131a; border-right:1px solid #242e38;
    display:flex; flex-direction:column; min-height:100vh; position:sticky; top:0; align-self:flex-start;
    font-family:'IBM Plex Sans',sans-serif;
  }
  .nexus-sidebar-brand{display:flex; align-items:center; gap:10px; padding:20px 18px 16px; text-decoration:none; cursor:pointer;}
  .nexus-sidebar-brand img{width:30px; height:30px; border-radius:8px; object-fit:cover;}
  .nexus-sidebar-brand span{font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:700; color:#EDF1F5; letter-spacing:0.03em;}
  .nexus-sidebar-scroll{flex:1; overflow-y:auto; padding:0 10px 16px;}
  /* Curseur de défilement dédié au menu — le menu défile déjà indépendamment
     du contenu principal (overflow-y:auto ci-dessus, sur
     .nexus-sidebar-scroll uniquement, jamais sur body). Premier essai
     (13/08/2026) : styler le curseur natif du navigateur (scrollbar-width/
     ::-webkit-scrollbar). Insuffisant en pratique — sur macOS et plusieurs
     navigateurs, le curseur natif reste invisible au repos (barres overlay
     auto-masquées par l'OS, indépendamment de la couleur CSS), donc Frédéric
     ne voyait toujours rien tant qu'il ne scrollait pas activement. Corrigé
     (13/08/2026, v2) : curseur natif masqué, remplacé par un vrai petit
     curseur custom (.nexus-sidebar-curseur-*), positionné/dimensionné en JS
     (nexusInstallerCurseurSidebar ci-dessous) pour rester calé exactement
     sur .nexus-sidebar-scroll, toujours visible dès que le menu dépasse la
     hauteur d'écran, déplaçable à la souris comme un vrai curseur. */
  .nexus-sidebar-scroll{ scrollbar-width:none; }
  .nexus-sidebar-scroll::-webkit-scrollbar{ display:none; }
  .nexus-sidebar-curseur-track{
    position:absolute; right:3px; width:4px; border-radius:3px;
    background:rgba(255,255,255,0.05); z-index:5;
  }
  .nexus-sidebar-curseur-thumb{
    width:100%; border-radius:3px; background:rgba(79,195,217,0.5);
    cursor:pointer; touch-action:none;
  }
  .nexus-sidebar-curseur-thumb:hover, .nexus-sidebar-curseur-thumb.glisse{ background:rgba(79,195,217,0.85); }
  .nexus-sidebar-group{font-family:'IBM Plex Mono',monospace; font-size:9.5px; letter-spacing:0.08em; text-transform:uppercase; color:#57626F; padding:14px 10px 6px;}
  /* Lisibilité au survol (07/11/2026, Guardian 6715088867) : la rangée a une HAUTEUR RÉSERVÉE (44 px, 48 px sur grand écran),
     donc agrandir l'icône (16 → 24 px) et le titre (→ 16 px, semi-gras) au survol ou au focus clavier ne déplace aucune autre rangée.
     L'icône v2 ≤ 24 px est déjà le -24.svg simplifié : le passage à 24 px ne l'agrandit pas à partir d'un 16 px flou. */
  .nexus-sidebar-link{display:flex; align-items:center; gap:10px; height:44px; box-sizing:border-box; padding:0 10px; border-radius:8px; color:#8A96A5; text-decoration:none; font-size:12.5px; line-height:1.2; margin-bottom:2px;
    transition:background-color 150ms ease, color 150ms ease, font-size 150ms ease;}
  .nexus-sidebar-link > span:last-child{display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; min-width:0;}
  .nexus-sidebar-link:hover, .nexus-sidebar-link:focus-visible{background:#222D3A; color:#EDF1F5; font-size:16px; font-weight:600;}
  .nexus-sidebar-link:focus-visible{outline:2px solid #4FC3D9; outline-offset:-2px;}
  .nexus-sidebar-link.active{background:rgba(79,195,217,0.12); color:#4FC3D9; font-weight:600;}
  .nexus-sidebar-link img{width:16px; height:16px; flex-shrink:0; opacity:0.85; transition:width 150ms ease, height 150ms ease, opacity 150ms ease;}
  .nexus-sidebar-link .nexus-sidebar-emoji{display:inline-block; flex-shrink:0; width:16px; text-align:center; transition:font-size 150ms ease;}
  .nexus-sidebar-link:hover img, .nexus-sidebar-link:focus-visible img{width:24px; height:24px; opacity:1;}
  .nexus-sidebar-link:hover .nexus-sidebar-emoji, .nexus-sidebar-link:focus-visible .nexus-sidebar-emoji{font-size:22px !important; width:24px;}
  .nexus-sidebar-link.active img{opacity:1;}
  /* Grands écrans (iMac) : tailles de base plus larges même sans survol. */
  @media (min-width:1600px){
    .nexus-sidebar{width:270px;}
    .nexus-sidebar-link{height:48px; font-size:15px; line-height:1.3;}
    .nexus-sidebar-link img{width:20px; height:20px;}
    .nexus-sidebar-link .nexus-sidebar-emoji{font-size:18px !important; width:20px;}
    .nexus-sidebar-link:hover, .nexus-sidebar-link:focus-visible{font-size:16px;}
  }
  /* Mouvement réduit : pas d'animation, seulement le changement d'état. */
  @media (prefers-reduced-motion:reduce){
    .nexus-sidebar-link, .nexus-sidebar-link img, .nexus-sidebar-link .nexus-sidebar-emoji{transition:none;}
  }
  /* Effet de loupe façon Dock macOS (07/11/2026, Guardian 6715331183) : l'échelle de l'icône et du titre dépend de la DISTANCE
     du pointeur (en lignes), calculée en JS au mousemove (nexusEchelleLoupe). transform: scale() ne touche pas à la mise en page :
     la hauteur des lignes reste fixe. Actif seulement quand la classe .nexus-sidebar-loupe est posée (souris + mouvement autorisé) ;
     elle remplace alors l'agrandissement simple du survol par le transform. Le focus clavier garde l'agrandissement simple. */
  .nexus-sidebar-loupe .nexus-sidebar-link img, .nexus-sidebar-loupe .nexus-sidebar-link .nexus-sidebar-emoji{
    transform:scale(var(--nl-icone, 1)); transform-origin:left center; transition:transform 120ms ease-out, opacity 120ms ease-out;}
  .nexus-sidebar-loupe .nexus-sidebar-link > span:last-child{
    transform:translateX(var(--nl-dec, 0px)) scale(var(--nl-titre, 1)); transform-origin:left center; transition:transform 120ms ease-out;}
  /* Plus prononcé (Guardian 6715419690) : marge à droite réservée pour que le titre agrandi (x1,25 + décalage) ne soit jamais coupé,
     et interligne élargi de 4 px sur TOUTES les lignes tant que le pointeur est dans le menu (classe .nexus-sidebar-loupe-actif). */
  .nexus-sidebar-loupe .nexus-sidebar-link{padding-right:46px; transition:background-color .15s ease, color .15s ease, font-size .15s ease, margin-bottom 120ms ease-out;}
  .nexus-sidebar-loupe-actif .nexus-sidebar-link{margin-bottom:6px;}
  .nexus-sidebar-loupe .nexus-sidebar-link:hover{font-size:12.5px;}
  .nexus-sidebar-loupe .nexus-sidebar-link:hover img{width:16px; height:16px;}
  .nexus-sidebar-loupe .nexus-sidebar-link:hover .nexus-sidebar-emoji{font-size:15px !important; width:16px;}
  @media (min-width:1600px){
    .nexus-sidebar-loupe .nexus-sidebar-link:hover{font-size:15.0px;}
    .nexus-sidebar-loupe .nexus-sidebar-link:hover img{height:20px; width:20px;}
    .nexus-sidebar-loupe .nexus-sidebar-link:hover .nexus-sidebar-emoji{font-size:18px !important; width:20px;}
  }
  @media (prefers-reduced-motion:reduce), (hover:none){
    .nexus-sidebar-loupe .nexus-sidebar-link img, .nexus-sidebar-loupe .nexus-sidebar-link .nexus-sidebar-emoji, .nexus-sidebar-loupe .nexus-sidebar-link > span:last-child{transform:none; transition:none;}
  }
  .nexus-sidebar-foot{padding:14px 16px 18px; border-top:1px solid #242e38;}
  .nexus-sidebar-toggle{width:100%; padding:8px 10px; border-radius:8px; border:1px solid rgba(79,195,217,0.3); background:rgba(79,195,217,0.08); color:#4FC3D9; font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;}
  .nexus-sidebar-toggle:active{background:rgba(79,195,217,0.16);}

  /* Menu repliable (07/11/2026, Guardian 6715363735) : « le rideau de verre et le filament ». Trois états posés en classe sur <body> :
     (rien) = ouvert ; .nexus-menu-rail = rail d'icônes de 68 px ; .nexus-menu-cache = menu masqué, seul reste le filament lumineux.
     Seuls transform / opacity / filtre sont animés (plus la largeur du menu, pour que le contenu suive). Les sélecteurs passent par l'identifiant
     #nexus-sidebar-principal pour l'emporter sur la loupe sans toucher à ses règles. */
  .nexus-sb-barre{display:flex; justify-content:flex-end; padding:8px 10px 0;}
  .nexus-sb-pli{width:28px; height:24px; display:flex; align-items:center; justify-content:center; border:0; border-radius:6px; background:transparent; color:#7C8A99; cursor:pointer; transition:color 150ms ease, background-color 150ms ease, rotate 260ms ease; -webkit-tap-highlight-color:transparent;}
  .nexus-sb-pli:hover, .nexus-sb-pli:focus-visible{color:#4FC3D9; background:rgba(79,195,217,0.1);}
  .nexus-sb-pli:focus-visible{outline:2px solid #4FC3D9; outline-offset:1px;}
  body.nexus-menu-rail .nexus-sb-pli{rotate:180deg;}
  #nexus-sidebar-principal{transition:width 420ms cubic-bezier(.2,.9,.25,1.15);}
  #nexus-sidebar-principal::after{content:""; position:absolute; inset:0; pointer-events:none; opacity:0; background:rgba(13,19,26,0.15); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);}
  #nexus-sidebar-principal.nexus-sb-bouge{will-change:width; overflow:hidden;}
  #nexus-sidebar-principal.nexus-sb-bouge::after{animation:nexus-sb-rideau 420ms ease both;}
  @keyframes nexus-sb-rideau{0%{opacity:0;} 40%{opacity:1;} 100%{opacity:0;}}
  #nexus-sidebar-principal .nexus-sidebar-link > span:last-child{
    max-width:200px; transition:transform 120ms ease-out, opacity 220ms ease, max-width 260ms ease, translate 260ms cubic-bezier(.2,.9,.25,1.15);
    transition-delay:0ms, calc(120ms + min(var(--nl-i, 0), 24) * 12ms), 0ms, calc(120ms + min(var(--nl-i, 0), 24) * 12ms);}
  #nexus-sidebar-principal .nexus-sidebar-link img, #nexus-sidebar-principal .nexus-sidebar-link .nexus-sidebar-emoji{
    transition:transform 120ms ease-out, opacity 220ms ease, scale 260ms ease, width 150ms ease, height 150ms ease;}
  body.nexus-menu-rail #nexus-sidebar-principal, body.nexus-menu-rail #nexus-sidebar-principal.nexus-sidebar{width:68px; overflow:hidden;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-scroll{padding:0 6px 16px;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-link{justify-content:center; gap:0; padding:0;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-link > span:last-child{max-width:0; opacity:0; translate:-6px 0; transition-delay:0ms;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-link img, body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-link .nexus-sidebar-emoji{transform-origin:center center;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-brand{justify-content:center; padding:6px 0 14px;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-brand span{display:none;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sb-barre{justify-content:center; padding:8px 0 0;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-group{font-size:0; height:1px; padding:0; margin:10px 14px; background:#242e38;}
  body.nexus-menu-rail #nexus-sidebar-principal .nexus-sidebar-foot{display:none;}
  body.nexus-menu-cache #nexus-sidebar-principal, body.nexus-menu-cache #nexus-sidebar-principal.nexus-sidebar{width:0; border-right-width:0; overflow:hidden; visibility:hidden; transition:width 420ms cubic-bezier(.2,.9,.25,1.15), visibility 0s linear 440ms;}
  body.nexus-menu-cache #nexus-sidebar-principal .nexus-sidebar-link{opacity:0; scale:.85; transition:opacity 180ms ease, scale 180ms ease; transition-delay:calc(min(var(--nl-i, 0), 24) * 12ms);}
  .nexus-sb-pastille{position:fixed; z-index:95; pointer-events:none; opacity:0; translate:-6px 0; padding:7px 13px; border-radius:10px; border:1px solid rgba(79,195,217,0.4); background:rgba(20,27,34,0.62); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); color:#EDF1F5; font-family:'IBM Plex Sans',sans-serif; font-size:13px; font-weight:600; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,0.35); transition:opacity 140ms ease, translate 180ms ease;}
  .nexus-sb-pastille.show{opacity:1; translate:0 0;}
  .nexus-sb-filament{display:none; position:fixed; z-index:90; left:0; top:0; bottom:0; width:12px; padding:0; border:0; background:transparent; cursor:pointer; align-items:center; -webkit-tap-highlight-color:transparent; transition:width 220ms ease, background-color 220ms ease;}
  body.nexus-menu-cache .nexus-sb-filament{display:flex;}
  .nexus-sb-fil{position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg, #4FC3D9, rgba(79,195,217,0)); opacity:.35; animation:nexus-sb-souffle 4s ease-in-out infinite; overflow:hidden;}
  .nexus-sb-fil::after{content:""; position:absolute; left:0; right:0; top:-30%; height:30%; background:linear-gradient(180deg, transparent, #EAFBFF, transparent); opacity:0;}
  .nexus-sb-filament.nexus-sb-eclat .nexus-sb-fil::after{animation:nexus-sb-eclat 900ms ease-out 1 both;}
  @keyframes nexus-sb-souffle{0%,100%{opacity:.35;} 50%{opacity:.7;}}
  @keyframes nexus-sb-eclat{0%{top:-30%; opacity:1;} 100%{top:100%; opacity:0;}}
  .nexus-sb-chev{margin-left:5px; color:#4FC3D9; font-size:15px; opacity:0; transition:opacity 180ms ease;}
  .nexus-sb-filament:focus-visible{outline:2px solid #4FC3D9; outline-offset:-2px; width:20px;}
  .nexus-sb-filament:focus-visible .nexus-sb-chev{opacity:1;}
  @media (hover:hover){
    .nexus-sb-filament:hover{width:20px; background:rgba(20,27,34,0.55); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);}
    .nexus-sb-filament:hover .nexus-sb-chev{opacity:1;}
  }
  @media (hover:none){
    .nexus-sb-filament{width:28px;}
  }
  [data-theme="jour"] .nexus-sb-pastille{background:rgba(255,255,255,0.72); color:#0F172A; border-color:rgba(11,114,133,0.45); box-shadow:0 6px 20px rgba(15,23,42,0.18);}
  [data-theme="jour"] .nexus-sb-pli{color:#475569;}
  [data-theme="jour"] .nexus-sb-pli:hover, [data-theme="jour"] .nexus-sb-pli:focus-visible{color:#0B7285; background:rgba(11,114,133,0.1);}
  [data-theme="jour"] .nexus-sb-fil{background:linear-gradient(180deg, #0B7285, rgba(11,114,133,0));}
  [data-theme="jour"] .nexus-sb-chev{color:#0B7285;}
  @media (prefers-reduced-motion:reduce) and (min-width:0px){
    #nexus-sidebar-principal, #nexus-sidebar-principal .nexus-sidebar-link > span:last-child, #nexus-sidebar-principal .nexus-sidebar-link img, #nexus-sidebar-principal .nexus-sidebar-link .nexus-sidebar-emoji, body.nexus-menu-cache #nexus-sidebar-principal .nexus-sidebar-link{transition:opacity 120ms linear; transition-delay:0ms;}
    body.nexus-menu-cache #nexus-sidebar-principal{transition:opacity 120ms linear, visibility 0s linear 120ms;}
    #nexus-sidebar-principal.nexus-sb-bouge::after, .nexus-sb-fil, .nexus-sb-filament.nexus-sb-eclat .nexus-sb-fil::after{animation:none;}
    .nexus-sb-fil{opacity:.55;}
    .nexus-sb-pastille, .nexus-sb-filament, .nexus-sb-chev, .nexus-sb-pli{transition:opacity 120ms linear;}
    .nexus-sb-pli{rotate:0deg !important;}
  }

  /* Bouton flottant "passer en vue bureau" — jamais affiché sous 900px de
     large : un vrai téléphone ne le verra donc jamais, seul un écran
     d'ordinateur peut le déclencher. C'est le remplaçant du bouton "au
     login" demandé initialement : NEXUS-Login-v1.html n'existe pas dans ce
     dossier de travail (lien mort déjà présent dans index.html avant ce
     chantier) donc la bascule ne peut pas vivre là — ce bouton flottant,
     présent sur chaque écran équipé de nexus-desktop.js, couvre le même
     besoin sans dépendre de cette page manquante.
  */
  .nexus-vue-bureau-flottant{display:none;}
  @media (min-width:900px){
    .nexus-vue-bureau-flottant{
      display:flex; align-items:center; gap:8px; position:fixed; right:18px; bottom:18px; z-index:80;
      background:#141B22; border:1px solid rgba(79,195,217,0.35); color:#4FC3D9;
      font-family:'IBM Plex Mono',monospace; font-size:11.5px; font-weight:600;
      padding:10px 16px; border-radius:30px; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.4);
      -webkit-tap-highlight-color:transparent;
    }
    .nexus-vue-bureau-flottant:hover{background:#1A222C;}
  }

  /* Mise en colonnes générique (02/08/2026) — un seul wrapper réutilisable
     sur tous les écrans NEXUS plutôt que du CSS dupliqué dans chaque
     <style> : chaque écran enveloppe sa pile de blocs dans
     <div class="desktop-grid">...</div> (purement additif, aucun effet en
     mobile) pour obtenir une vraie mise en colonnes en vue bureau, comme
     NEXUS Verify. Un écran peut ensuite affiner (ex: .app-top-row de
     NEXUS-App-v1 pour la paire Conseiller/État global) sans toucher à ce
     comportement par défaut.
     Règle générique sur "> *" (02/08/2026) et non seulement "> .card" : les
     écrans NEXUS n'utilisent pas tous la même convention pour leurs blocs
     (.card sur certains écrans, .section sur d'autres) — cette règle
     s'applique donc à n'importe quel enfant direct du conteneur, quelle que
     soit sa classe, pour couvrir tous les écrans avec un seul wrapper. */
  body.nexus-desktop .desktop-grid{column-count:2; column-gap:20px; column-fill:balance;}
  body.nexus-desktop .desktop-grid > *{break-inside:avoid; -webkit-column-break-inside:avoid; page-break-inside:avoid;}

  /* Point rouge clignotant (09/08/2026, demande de Frédéric) — voir
     nexusVerifierAlertesFdj() plus bas : signale une alerte NEXUS FDJ non
     vue directement sur son lien de la barre latérale, comme une
     notification. Le clignotement (halo qui pulse) doit rester discret,
     pas une animation agressive. */
  .nexus-sidebar-dot{
    width:8px; height:8px; border-radius:50%; background:#F0575A; flex-shrink:0;
    margin-left:auto; animation:nexusSidebarDotPulse 1.6s infinite;
  }
  @keyframes nexusSidebarDotPulse{
    0%{box-shadow:0 0 0 0 rgba(240,87,90,0.55);}
    70%{box-shadow:0 0 0 6px rgba(240,87,90,0);}
    100%{box-shadow:0 0 0 0 rgba(240,87,90,0);}
  }

  /* Micro-tooltip au survol du menu (24/08/2026, demande de Frédéric) —
     "répond instantanément à 'à quoi sert-il ?'", volontairement discret :
     pas de gros titre, pas de bouton, une phrase maximum + une ligne
     secondaire "Cliquez pour ouvrir". Apparition retardée (voir le
     setTimeout de nexusInstallerTooltipsSidebar), disparition immédiate
     (pas de transition sur la sortie — seule l'entrée est adoucie). */
  .nexus-tooltip{
    position:fixed; z-index:200; width:240px; background:#141B22;
    border:1px solid rgba(79,195,217,0.25); border-radius:10px; padding:10px 12px;
    box-shadow:0 8px 24px rgba(0,0,0,0.45); font-family:'IBM Plex Sans',sans-serif;
    pointer-events:none; opacity:0; transform:translateY(2px);
    transition:opacity 0.12s ease, transform 0.12s ease;
  }
  .nexus-tooltip.show{opacity:1; transform:translateY(0);}
  .nexus-tooltip-title{font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:700; color:#EDF1F5; margin-bottom:4px;}
  .nexus-tooltip-desc{font-size:12px; line-height:1.4; color:#B7C0CA;}
  .nexus-tooltip-cta{font-family:'IBM Plex Mono',monospace; font-size:9.5px; color:#4FC3D9; margin-top:6px; letter-spacing:0.02em;}

  /* Mode Jour (Guardian #160, 6630497855) : la barre latérale posait ses couleurs en
     dur et restait sombre sur une page claire. Surcharges présentation seule, toutes
     sous [data-theme="jour"] : sans ce réglage (Sombre, et les pages qui ne chargent
     pas nexus-theme.js) rien ne s'applique et les valeurs ci-dessus restent seules.
     Palette = JOUR de nexus-theme.js ; contrastes mesurés par
     test_nexus_desktop_theme_jour_20261104.js. */
  [data-theme="jour"] .nexus-sidebar{background:#FFFFFF; border-right-color:#D5DCE3;}
  [data-theme="jour"] .nexus-sidebar-brand span{color:#0F172A;}
  [data-theme="jour"] .nexus-sidebar-group{color:#56657A;}
  [data-theme="jour"] .nexus-sidebar-link{color:#475569;}
  [data-theme="jour"] .nexus-sidebar-link:hover, [data-theme="jour"] .nexus-sidebar-link:focus-visible{background:#E3E9EE; color:#0F172A;}
  [data-theme="jour"] .nexus-sidebar-link:focus-visible{outline-color:#0B7285;}
  [data-theme="jour"] .nexus-sidebar-link.active{background:#EAF4F6; color:#0B7285;}
  [data-theme="jour"] .nexus-sidebar-foot{border-top-color:#D5DCE3;}
  [data-theme="jour"] .nexus-sidebar-toggle{border-color:rgba(11,114,133,0.35); background:#EAF4F6; color:#0B7285;}
  [data-theme="jour"] .nexus-sidebar-toggle:active{background:#CFE8EE;}
  [data-theme="jour"] .nexus-sidebar-curseur-track{background:rgba(15,23,42,0.06);}
  [data-theme="jour"] .nexus-sidebar-curseur-thumb{background:rgba(11,114,133,0.5);}
  [data-theme="jour"] .nexus-sidebar-curseur-thumb:hover, [data-theme="jour"] .nexus-sidebar-curseur-thumb.glisse{background:rgba(11,114,133,0.85);}
  [data-theme="jour"] .nexus-sidebar-dot{background:#B91C1C;}
  @media (min-width:900px){
    [data-theme="jour"] .nexus-vue-bureau-flottant{background:#FFFFFF; border-color:rgba(11,114,133,0.4); color:#0B7285; box-shadow:0 6px 20px rgba(15,23,42,0.18);}
    [data-theme="jour"] .nexus-vue-bureau-flottant:hover{background:#EEF2F5;}
  }
  [data-theme="jour"] .nexus-tooltip{background:#FFFFFF; border-color:#D5DCE3; box-shadow:0 8px 24px rgba(15,23,42,0.18);}
  [data-theme="jour"] .nexus-tooltip-title{color:#0F172A;}
  [data-theme="jour"] .nexus-tooltip-desc{color:#475569;}
  [data-theme="jour"] .nexus-tooltip-cta{color:#0B7285;}
`;

// Alerte NEXUS FDJ (09/08/2026, demande de Frédéric) : "envoie au manager
// une alerte avec un point rouge scintillant sur la capsule FDJ dans son
// bureau" — dès qu'un employé corrige un stock initial hérité du quart
// précédent (voir fdj_alertes, NEXUS-FDJ-v1.html), ce stock final du quart
// précédent est potentiellement faux et mérite l'attention du manager. Ce
// script tourne indépendamment de la page qui l'a chargé (nexus-desktop.js
// n'a pas accès à l'`employee` déjà résolu par nexusRequireAuth() de la
// page) : lecture directe et légère de la session — jamais bloquant, une
// erreur réseau laisse simplement le point éteint plutôt que de gêner la
// navigation.
async function nexusVerifierAlertesFdj() {
  try {
    if (typeof nexusClient === 'undefined') return;
    const { data: { session } } = await nexusClient.auth.getSession();
    if (!session) return;
    const { data: employee, error: eEmp } = await nexusClient.from('employees').select('site_id').eq('id', session.user.id).maybeSingle();
    if (eEmp || !employee) return;
    const { count, error } = await nexusClient.from('fdj_alertes')
      .select('id', { count: 'exact', head: true }).eq('site', employee.site_id).eq('vue', false).eq('resolue_automatiquement', false);
    if (error) { console.error('Vérification alertes FDJ (sidebar):', error); return; }
    if (!count) return;
    const lien = document.querySelector('.nexus-sidebar-link[href="NEXUS-FDJ-Manager-v1.html"]');
    if (!lien) return;
    const dot = document.createElement('span');
    dot.className = 'nexus-sidebar-dot';
    dot.title = `${count} alerte${count > 1 ? 's' : ''} FDJ à examiner`;
    lien.appendChild(dot);
  } catch (e) { console.error('Vérification alertes FDJ (sidebar):', e); }
}

// Curseur de défilement custom du menu (13/08/2026, v2 — voir commentaire
// CSS .nexus-sidebar-curseur-track ci-dessus pour le pourquoi). Piste
// positionnée en JS pour rester calée exactement sur .nexus-sidebar-scroll
// (offsetTop/clientHeight, relatifs à .nexus-sidebar qui est "positioned"
// via position:sticky) quel que soit le nombre d'items du menu — jamais de
// coordonnées codées en dur qui casseraient si le menu change de longueur.
function nexusInstallerCurseurSidebar() {
  const scrollEl = document.querySelector('.nexus-sidebar-scroll');
  const sidebar = document.querySelector('.nexus-sidebar');
  if (!scrollEl || !sidebar) return;

  const track = document.createElement('div');
  track.className = 'nexus-sidebar-curseur-track';
  const thumb = document.createElement('div');
  thumb.className = 'nexus-sidebar-curseur-thumb';
  track.appendChild(thumb);
  sidebar.appendChild(track);

  function positionnerTrack() {
    track.style.top = `${scrollEl.offsetTop}px`;
    track.style.height = `${scrollEl.clientHeight}px`;
  }

  function majThumb() {
    const { scrollHeight, clientHeight, scrollTop } = scrollEl;
    if (scrollHeight <= clientHeight + 1) { track.style.display = 'none'; return; } // rien à faire défiler : pas de curseur
    track.style.display = 'block';
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight);
    const maxThumbTop = trackHeight - thumbHeight;
    const thumbTop = maxThumbTop > 0 ? maxThumbTop * (scrollTop / (scrollHeight - clientHeight)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  }

  function rafraichir() { positionnerTrack(); majThumb(); }

  scrollEl.addEventListener('scroll', majThumb, { passive: true });
  window.addEventListener('resize', rafraichir);
  window.addEventListener('load', rafraichir);
  setTimeout(rafraichir, 0); // laisse le temps aux icônes de se mettre en page avant la 1ère mesure
  rafraichir();

  // Glisser le curseur (souris/tactile/stylet via Pointer Events) pour
  // scroller le menu — clic sur la piste hors curseur : saute directement à
  // cet endroit, comme n'importe quelle scrollbar.
  function deplacerVers(clientY, decalage) {
    const rectTrack = track.getBoundingClientRect();
    const maxThumbTop = rectTrack.height - thumb.offsetHeight;
    if (maxThumbTop <= 0) return;
    const thumbTop = Math.max(0, Math.min(maxThumbTop, clientY - rectTrack.top - decalage));
    scrollEl.scrollTop = (thumbTop / maxThumbTop) * (scrollEl.scrollHeight - scrollEl.clientHeight);
  }
  let decalagePrise = 0;
  thumb.addEventListener('pointerdown', (e) => {
    thumb.classList.add('glisse');
    decalagePrise = e.clientY - thumb.getBoundingClientRect().top;
    thumb.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  thumb.addEventListener('pointermove', (e) => { if (thumb.hasPointerCapture(e.pointerId)) deplacerVers(e.clientY, decalagePrise); });
  thumb.addEventListener('pointerup', () => thumb.classList.remove('glisse'));
  track.addEventListener('pointerdown', (e) => { if (e.target !== thumb) deplacerVers(e.clientY, thumb.offsetHeight / 2); });
}

// Micro-tooltip au survol du menu (24/08/2026, demande de Frédéric) — un
// seul élément tooltip partagé, repositionné à chaque survol plutôt que
// d'en dupliquer un par lien (plus léger, et un seul endroit à ajuster si
// le style change demain). Délai d'apparition 300-400ms (ici 350ms, au
// milieu de la fourchette demandée) ; disparition immédiate dès que la
// souris quitte le lien, sans attendre — c'est cette dissymétrie qui rend
// le tooltip "discret" plutôt qu'intrusif.
function nexusInstallerTooltipsSidebar() {
  const liens = document.querySelectorAll('.nexus-sidebar-link[data-tooltip]');
  if (!liens.length) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'nexus-tooltip';
  tooltip.innerHTML = `
    <div class="nexus-tooltip-title"></div>
    <div class="nexus-tooltip-desc"></div>
    <div class="nexus-tooltip-cta">Cliquez pour ouvrir</div>
  `;
  document.body.appendChild(tooltip);
  const titreEl = tooltip.querySelector('.nexus-tooltip-title');
  const descEl = tooltip.querySelector('.nexus-tooltip-desc');

  let minuteur = null;
  function masquer() {
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    tooltip.classList.remove('show');
  }
  function positionner(lien) {
    const r = lien.getBoundingClientRect();
    const marge = 10;
    let left = r.right + marge;
    // Rabat à gauche si jamais 240px ne tiennent pas à droite — la vue
    // bureau n'existe qu'à partir de 900px de large donc ça ne devrait
    // jamais arriver en pratique, garde-fou seulement.
    if (left + 240 > window.innerWidth) left = Math.max(8, r.left - 240 - marge);
    let top = r.top + (r.height / 2) - 10;
    top = Math.max(8, Math.min(top, window.innerHeight - 90));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  liens.forEach(lien => {
    lien.addEventListener('mouseenter', () => {
      if (document.body.classList.contains('nexus-menu-rail')) return; // en rail, la pastille de verre remplace l'info-bulle
      minuteur = setTimeout(() => {
        titreEl.textContent = lien.dataset.tooltip;
        descEl.textContent = lien.dataset.tooltipDesc;
        positionner(lien);
        tooltip.classList.add('show');
      }, 350);
    });
    lien.addEventListener('mouseleave', masquer);
    lien.addEventListener('click', masquer);
  });

  // Un tooltip resté affiché pendant un défilement du menu ne suivrait pas
  // la souris et se retrouverait mal placé — plus honnête de le masquer
  // tout de suite que d'essayer de le repositionner en continu pour une
  // info aussi secondaire.
  const scrollEl = document.querySelector('.nexus-sidebar-scroll');
  if (scrollEl) scrollEl.addEventListener('scroll', masquer, { passive: true });
}

// Effet de loupe façon Dock (07/11/2026, Guardian 6715331183). Fonction PURE : distance au pointeur (en lignes) -> échelle de l'icône.
// Ancres (Guardian 6715419690) : 0 ligne = x2,2 ; 1 = x1,6 ; 2 = x1,25 ; 3 = x1,08 ; 3,5 lignes et au-delà = x1. Entre deux ancres,
// interpolation en cosinus (courbe lisse). Le titre grossit moins : x1,25 au maximum, ~x1,1 sur les lignes voisines (nexusEchelleTitreLoupe).
function nexusEchelleLoupe(distanceLignes) {
  const ANCRES = [2.2, 1.6, 1.25, 1.08, 1];
  const POSITIONS = [0, 1, 2, 3, 3.5];
  const d = Math.max(0, Number(distanceLignes) || 0);
  if (d >= POSITIONS[POSITIONS.length - 1]) return 1;
  let i = 0;
  while (d >= POSITIONS[i + 1]) i++;
  const e = (1 - Math.cos(Math.PI * (d - POSITIONS[i]) / (POSITIONS[i + 1] - POSITIONS[i]))) / 2;
  return ANCRES[i] + (ANCRES[i + 1] - ANCRES[i]) * e;
}
function nexusEchelleTitreLoupe(echelleIcone) {
  return 1 + 0.25 * Math.pow(Math.max(0, echelleIcone - 1) / 1.2, 1.3);
}

// Installe la loupe sur le menu. Pas d'effet (et pas de classe) pour un écran tactile ou un utilisateur qui demande moins de mouvement :
// l'agrandissement simple du survol et du focus suffit alors. Mise à jour par requestAnimationFrame, mesurée sur le pointeur dans tout
// le menu (pas seulement la ligne survolée) ; le défilement relance le calcul avec la dernière position du pointeur.
function nexusInstallerLoupeSidebar() {
  const scrollEl = document.querySelector('.nexus-sidebar-scroll');
  const sidebar = document.querySelector('.nexus-sidebar');
  if (!scrollEl || !sidebar || !window.matchMedia) return;
  const mqSouris = window.matchMedia('(hover:hover) and (pointer:fine)');
  const mqCalme = window.matchMedia('(prefers-reduced-motion:reduce)');
  if (!mqSouris.matches || mqCalme.matches) return;
  sidebar.classList.add('nexus-sidebar-loupe');
  let y = null, planifie = false;
  const liens = () => scrollEl.querySelectorAll('.nexus-sidebar-link');
  function appliquer() {
    planifie = false;
    const tous = liens();
    if (!tous.length) return;
    sidebar.classList.toggle('nexus-sidebar-loupe-actif', y !== null);
    // Pas entre deux lignes = hauteur + interligne (2 px au repos, 6 px tant que le pointeur est dans le menu).
    const pas = tous[0].offsetHeight + (y !== null ? 6 : 2);
    tous.forEach(lien => {
      let echelle = 1, titre = 1, dec = 0;
      if (y !== null) {
        const r = lien.getBoundingClientRect();
        echelle = nexusEchelleLoupe(Math.abs(y - (r.top + r.height / 2)) / pas);
        titre = nexusEchelleTitreLoupe(echelle);
        const icone = lien.querySelector('img, .nexus-sidebar-emoji');
        // Écart constant entre l'icône agrandie (origine à gauche) et le titre : on pousse le titre de (échelle - 1) x largeur de l'icône.
        dec = icone ? Math.max(0, (echelle - 1) * icone.offsetWidth) : 0;
      }
      const cle = echelle.toFixed(3) + '|' + dec.toFixed(1);
      if (lien._nlCle === cle) return;
      lien._nlCle = cle;
      lien.style.setProperty('--nl-icone', echelle.toFixed(3));
      lien.style.setProperty('--nl-titre', titre.toFixed(3));
      lien.style.setProperty('--nl-dec', dec.toFixed(1) + 'px');
    });
  }
  function planifier() {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(appliquer);
  }
  scrollEl.addEventListener('mousemove', e => { y = e.clientY; planifier(); }, { passive: true });
  scrollEl.addEventListener('scroll', () => { if (y !== null) planifier(); }, { passive: true });
  scrollEl.addEventListener('mouseleave', () => { y = null; planifier(); });
}

// Repli si une icône PNG du menu ne charge pas (24/08/2026 — constat de
// Frédéric : plusieurs icônes du menu bureau manquantes dans
// assets/icons/, ex. icon-home.png, icon-journal-nexus.png,
// icon-capital.png, icon-scanner.png, icon-radar.png, icon-produits.png,
// icon-scanner-stock.png, icon-nexus-verify.png, icon-missions.png,
// icon-assignations.png, icon-planner.png, icon-evaluation.png,
// icon-resultats-equipe.png, icon-import.png, icon-rappels.png — gap
// préexistant du pack d'icônes, pas causé par le renommage v2.235).
// N'invente PAS une icône de remplacement dans le pack visuel NEXUS (ce
// serait fabriquer une fausse précision, Article 5) : remplace juste
// l'image cassée par une puce neutre, pour que le menu reste propre en
// attendant que les fichiers manquants soient fournis.
function nexusInstallerReplisIconesSidebar() {
  document.querySelectorAll('.nexus-sidebar-link img').forEach(img => {
    img.addEventListener('error', () => {
      const puce = document.createElement('span');
      puce.className = 'nexus-sidebar-emoji';
      puce.style.fontSize = '15px';
      puce.textContent = '•';
      img.replaceWith(puce);
    }, { once: true });
  });
}

// ---- Menu repliable (07/11/2026, Guardian 6715363735) ----
// Trois états, mémorisés par personne : 'ouvert' → 'rail' (icônes seules) → 'cache' (filament seul) → 'ouvert'.
const NEXUS_MENU_ETATS = ['ouvert', 'rail', 'cache'];
const NEXUS_MENU_CLE = 'nexus_menu_etat_v1';
function nexusEtatMenuSuivant(etat) {
  const i = NEXUS_MENU_ETATS.indexOf(etat);
  return NEXUS_MENU_ETATS[(i + 1) % NEXUS_MENU_ETATS.length];
}
// Lecture / écriture tolérantes : localStorage peut manquer ou lever (navigation privée, données bloquées) ; valeur inconnue = ouvert.
function nexusLireEtatMenu(stockage) {
  try {
    const v = (stockage || window.localStorage).getItem(NEXUS_MENU_CLE);
    return NEXUS_MENU_ETATS.indexOf(v) >= 0 ? v : 'ouvert';
  } catch (e) { return 'ouvert'; }
}
function nexusEcrireEtatMenu(etat, stockage) {
  try { (stockage || window.localStorage).setItem(NEXUS_MENU_CLE, etat); return true; } catch (e) { return false; }
}
// ⌘+\ (Mac) ou Ctrl+\ (ailleurs) ; ignoré dans un champ de saisie, avec Alt ou Maj.
function nexusRaccourciMenuValide(ev) {
  if (!ev || ev.key !== '\\' || ev.altKey || ev.shiftKey || !(ev.metaKey || ev.ctrlKey)) return false;
  const c = ev.target;
  const nom = c && c.tagName ? String(c.tagName).toUpperCase() : '';
  if (nom === 'INPUT' || nom === 'TEXTAREA' || nom === 'SELECT' || (c && c.isContentEditable)) return false;
  return true;
}
function nexusAppliquerEtatMenu(etat, animer) {
  const corps = document.body;
  const menu = document.getElementById('nexus-sidebar-principal');
  if (!menu) return;
  if (animer) {
    menu.classList.add('nexus-sb-bouge');
    clearTimeout(menu._nexusFinBouge);
    menu._nexusFinBouge = setTimeout(() => menu.classList.remove('nexus-sb-bouge'), 460);
  }
  corps.classList.toggle('nexus-menu-rail', etat === 'rail');
  corps.classList.toggle('nexus-menu-cache', etat === 'cache');
  const cache = etat === 'cache';
  menu.inert = cache; // liens hors de l'ordre de tabulation et du lecteur d'écran quand le menu est masqué
  const etiquette = cache ? 'Afficher le menu' : 'Replier le menu';
  document.querySelectorAll('.nexus-sb-pli, .nexus-sb-filament').forEach(b => {
    b.setAttribute('aria-expanded', cache ? 'false' : 'true');
    b.setAttribute('aria-label', etiquette);
  });
  const fil = document.querySelector('.nexus-sb-filament');
  if (fil && cache && animer) {
    fil.classList.remove('nexus-sb-eclat'); void fil.offsetWidth; fil.classList.add('nexus-sb-eclat');
  }
}
function nexusInstallerPliMenuSidebar() {
  const menu = document.getElementById('nexus-sidebar-principal');
  if (!menu) return;
  menu.querySelectorAll('.nexus-sidebar-link').forEach((l, i) => l.style.setProperty('--nl-i', String(i)));

  const fil = document.createElement('button');
  fil.type = 'button';
  fil.className = 'nexus-sb-filament';
  fil.setAttribute('aria-controls', 'nexus-sidebar-principal');
  fil.setAttribute('aria-expanded', 'false');
  fil.setAttribute('aria-label', 'Afficher le menu');
  fil.title = 'Afficher le menu (Ctrl+\\)';
  fil.innerHTML = '<span class="nexus-sb-fil"></span><span class="nexus-sb-chev" aria-hidden="true">›</span>';
  document.body.appendChild(fil);

  let etat = nexusLireEtatMenu();
  nexusAppliquerEtatMenu(etat, false);
  function aller(nouveau, depuis) {
    etat = nouveau;
    nexusEcrireEtatMenu(etat);
    nexusAppliquerEtatMenu(etat, true);
    // Le focus reste sur le bouton qui vient d'agir (ou sur le filament quand le menu disparaît).
    const cible = etat === 'cache' ? fil : (depuis === 'fil' || depuis === 'clavier') ? menu.querySelector('.nexus-sb-pli') : null;
    if (cible) cible.focus();
  }
  menu.querySelector('.nexus-sb-pli').addEventListener('click', () => aller(nexusEtatMenuSuivant(etat), 'pli'));
  fil.addEventListener('click', () => aller('ouvert', 'fil')); // depuis le filament, un clic ouvre le menu
  document.addEventListener('keydown', ev => {
    if (!nexusRaccourciMenuValide(ev)) return;
    ev.preventDefault();
    aller(nexusEtatMenuSuivant(etat), 'clavier');
  });

  // Pastille de verre : en rail, le titre apparaît à droite de l'icône (survol souris ou focus clavier).
  const pastille = document.createElement('div');
  pastille.className = 'nexus-sb-pastille';
  pastille.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pastille);
  function montrer(lien) {
    if (!document.body.classList.contains('nexus-menu-rail')) return;
    const t = lien.querySelector('span:last-child');
    if (!t) return;
    pastille.textContent = t.textContent.trim();
    const r = lien.getBoundingClientRect();
    pastille.style.left = (r.right + 8) + 'px';
    pastille.style.top = (r.top + r.height / 2 - 17) + 'px';
    pastille.classList.add('show');
  }
  const cacher = () => pastille.classList.remove('show');
  menu.addEventListener('mouseover', ev => { const l = ev.target.closest && ev.target.closest('.nexus-sidebar-link'); if (l) montrer(l); });
  menu.addEventListener('mouseout', cacher);
  menu.addEventListener('focusin', ev => { const l = ev.target.closest && ev.target.closest('.nexus-sidebar-link'); if (l) montrer(l); });
  menu.addEventListener('focusout', cacher);
  const defil = menu.querySelector('.nexus-sidebar-scroll');
  if (defil) defil.addEventListener('scroll', cacher, { passive: true });
}

function nexusInitVueBureau() {
  const style = document.createElement('style');
  style.textContent = NEXUS_DESKTOP_CSS;
  document.head.appendChild(style);

  if (nexusEstVueBureau()) {
    document.body.classList.add('nexus-desktop');
    const sidebar = document.createElement('div');
    sidebar.className = 'nexus-sidebar';
    sidebar.id = 'nexus-sidebar-principal';
    sidebar.innerHTML = nexusConstruireSidebarHTML();
    document.body.insertBefore(sidebar, document.body.firstChild);
    nexusInstallerCurseurSidebar();
    nexusInstallerTooltipsSidebar();
    nexusInstallerReplisIconesSidebar();
    nexusInstallerLoupeSidebar();
    nexusInstallerPliMenuSidebar();
    nexusVerifierAlertesFdj();
  } else {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'nexus-vue-bureau-flottant';
    bouton.innerHTML = '🖥️ Vue bureau';
    bouton.addEventListener('click', nexusBasculerVueBureau);
    document.body.appendChild(bouton);
  }
}

document.addEventListener('DOMContentLoaded', nexusInitVueBureau);
