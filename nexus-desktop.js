// NEXUS — nexus-desktop.js
// Vue bureau (02/08/2026, demande de Frédéric) : "par défaut, NEXUS reste en
// vue mobile — un bouton permet de passer en vue bureau si on travaille sur
// ordinateur." Le mobile reste donc TOUJOURS le comportement par défaut,
// sur tous les appareils, tant que ce choix n'a pas été fait explicitement.
//
// PILOTE (02/08/2026) : n'est inclus pour l'instant QUE sur NEXUS-Verify-v1
// (écran choisi avec Frédéric pour valider le style avant de généraliser à
// tout NEXUS). À inclure sur une nouvelle page : <script src="nexus-desktop.js?v=20260903-1143"></script>
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
      { label: 'Brief NEXUS', href: 'NEXUS-Brief-v1.html', icon: 'assets/icons/icon-brief-nexus.png', desc: 'Synthèse des priorités et décisions du moment.' },
      // Rapport NEXUS (10/08/2026, cadrage développeur de Frédéric) : rejoint
      // Piloter juste après Brief NEXUS — Brief est l'instantané "aujourd'hui"
      // (toujours 1 page), Rapport compare une période calendaire choisie
      // (semaine/mois/trimestre/année/dates libres) à une référence résolue
      // automatiquement. V1 : Chapitres 1 (Synthèse dirigeant) + 2 (Santé de
      // l'entreprise) seulement — les 10 autres chapitres du cadrage restent
      // à construire.
      { label: 'Rapport NEXUS', href: 'NEXUS-Rapport-v1.html', icon: null, emoji: '📑', desc: 'Compare une période choisie à une référence pour l’entreprise.' },
      { label: 'Cockpit', href: 'NEXUS-Cockpit-v2.html', icon: 'assets/icons/icon-home.png', desc: 'Votre plan d’action opérationnel du jour.' },
      { label: 'Journal', href: 'NEXUS-Journal-v1.html', icon: 'assets/icons/icon-journal-nexus.png', desc: 'Historique des faits, actions et événements NEXUS.' },
      { label: 'Capital NEXUS', href: 'NEXUS-Capital-v1.html', icon: 'assets/icons/icon-capital.png', desc: 'Valeur économique générée ou sécurisée par vos décisions.' },
      { label: 'Scanner NEXUS', href: 'NEXUS-Scanner-v1.html', icon: 'assets/icons/icon-scanner.png', desc: 'Détecte les anomalies, écarts et opportunités commerciales.' },
      { label: 'Radar du Manager', href: 'NEXUS-Radar-Manager-v1.html', icon: 'assets/icons/icon-radar.png', desc: 'Vue rapide des zones qui nécessitent votre attention.' },
    ],
  },
  {
    nom: 'Performer',
    items: [
      { label: 'Produits', href: 'NEXUS-Produits-v1.html', icon: 'assets/icons/icon-produits.png', desc: 'Analyse les ventes, rotations et performances produits.' },
      { label: 'Tempo', href: 'NEXUS-Tempo-v1.html', icon: 'assets/icons/icon-nexus-tempo.png', desc: 'Repère les jours et périodes à renforcer.' },
      { label: 'Campagnes', href: 'NEXUS-Campagne-v1.html', icon: 'assets/icons/icon-campagne-nexus.png', desc: 'Suit la performance de vos actions commerciales.' },
      { label: 'Scanner Stock', href: 'NEXUS-Scanner-Stock-v1.html', icon: 'assets/icons/icon-scanner-stock.png', desc: 'Repère les écarts et références à recompter.' },
    ],
  },
  {
    nom: 'Exécuter',
    items: [
      { label: 'Verify', href: 'NEXUS-Verify-v1.html', icon: 'assets/icons/icon-nexus-verify.png', desc: 'Contrôle les caisses et rapproche les moyens de paiement.' },
      // Carburants (10/08/2026, demande de Frédéric) : rejoint Exécuter,
      // juste à côté de Verify — le litrage vendu qu'il consomme vient de
      // là (litrage_gazole/sp95/gnr), jamais ressaisi.
      { label: 'Carburants', href: 'NEXUS-Carburants-v1.html', icon: null, emoji: '⛽', desc: 'Saisie et suivi des jaugeages carburant.' },
      // Réception carburant (14/08/2026, audit "Réceptions, deltas et
      // effet économique du stock", P1) : parcours employé dédié à la
      // réception d'une livraison (jaugeage avant/après, BL, calcul NEXUS)
      // — juste à côté de Carburants, comme FDJ/FDJ Opérations.
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-reception-carburant-24.png
      { label: 'Réception carburant', href: 'NEXUS-Carburant-Reception-v1.html', icon: 'assets/icons/icon-reception-carburant-24.png', desc: 'Contrôle les livraisons et les volumes réellement reçus.' },
      // Carburants Performance (11/08/2026, Phase 1 de la montée en
      // puissance demandée par Frédéric ; renommé "Performance" le
      // 24/08/2026 pour se distinguer nettement de Carburants) : la couche
      // dirigeant, juste après le Relevé du jour — même position relative
      // que FDJ Performance après FDJ Opérations.
      { label: 'Carburants Performance', href: 'NEXUS-Carburants-Pilotage-v1.html', icon: null, emoji: '📈', desc: 'Analyse volumes, autonomie, écarts et tendances carburant.' },
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-inventaire-24.png
      // remplace l'ancienne icon-inventaire.png — même icône réutilisée sur
      // Contrôle inventaire juste en dessous (même domaine, cf. Article 11).
      { label: 'Inventaire', href: 'NEXUS-Inventaire-v1.html', icon: 'assets/icons/icon-inventaire-24.png', desc: 'Guide les comptages terrain de l’équipe.' },
      { label: 'Contrôle inventaire', href: 'NEXUS-Inventaire-Manager-v1.html', icon: 'assets/icons/icon-inventaire-24.png', desc: 'Analyse les écarts, anomalies et comptages à traiter.' },
      // NEXUS FDJ (09/08/2026, demande de Frédéric) : rejoint Exécuter,
      // juste à côté d'Inventaire — même logique de comptage de quart.
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-fdj-24.png,
      // réutilisée sur FDJ Opérations et FDJ Performance (même domaine).
      { label: 'FDJ', href: 'NEXUS-FDJ-v1.html', icon: 'assets/icons/icon-fdj-24.png', desc: 'Grattage, tirages et caisse FDJ du quart.' },
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
      { label: 'FDJ Performance', href: 'NEXUS-FDJ-Analyse-v1.html', icon: null, emoji: '📊', desc: 'Analyse ventes, jeux, écarts et tendances FDJ.' },
      // NEXUS Coach x FDJ Pilotage (09/08/2026, étape "écran employé" de
      // l'audit "Coach x FDJ Pilotage") : micro-coaching quotidien par
      // employé, juste après FDJ Performance.
      // Icône pack NEXUS (20/08/2026, uniformisation) : avatar_coach — sens
      // littéral "Coach".
      { label: 'Coach FDJ', href: 'NEXUS-Coach-FDJ-v1.html', icon: 'assets/icons/icon-avatar-coach-24.png', desc: 'Donne à l’employé une priorité FDJ claire et contextualisée.' },
      { label: 'Missions', href: 'NEXUS-Missions-v1.html', icon: 'assets/icons/icon-missions.png', desc: 'Crée et suit les tâches opérationnelles.' },
      { label: 'Assignations', href: 'NEXUS-Assignations-v1.html', icon: 'assets/icons/icon-assignations.png', desc: 'Répartit les actions entre les membres de l’équipe.' },
      { label: 'Planning', href: 'NEXUS-Planning-v1.html', icon: 'assets/icons/icon-planner.png', desc: 'Organise la présence et les horaires de l’équipe.' },
    ],
  },
  {
    nom: 'Équipe',
    items: [
      { label: 'Évaluations', href: 'NEXUS-Evaluation-Employe-v1.html', icon: 'assets/icons/icon-evaluation.png', desc: 'Évalue la réalisation et la qualité du travail.' },
      { label: 'Résultats', href: 'NEXUS-Resultats-Equipe-v1.html', icon: 'assets/icons/icon-resultats-equipe.png', desc: 'Suit la progression et les performances de l’équipe.' },
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
      { label: 'Comptes Clients', href: 'NEXUS-Comptes-Clients-v1.html', icon: null, emoji: '👥', desc: 'Gère les comptes clients à crédit et leurs mouvements.' },
      { label: 'Boîte de réception', href: 'NEXUS-Boite-Reception-v1.html', icon: null, emoji: '📥', desc: 'Centralise les demandes des comptes clients.' },
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
      { label: 'Comprendre NEXUS', href: 'NEXUS-Documentation-v1.html', icon: 'assets/icons/icon-aide-24.png', desc: 'Explique à quoi sert chaque écran NEXUS.' },
    ],
  },
  {
    nom: 'Administrer',
    items: [
      { label: 'Imports', href: 'NEXUS-Import-v1.html', icon: 'assets/icons/icon-import.png', desc: 'Importe vos données externes dans NEXUS.' },
      // Icône pack NEXUS (20/08/2026, uniformisation) : icon-parametres-24.png,
      // même icône sur les 4 écrans "Paramètres…" (Station, Comptes Clients,
      // Inventaire, FDJ) — un seul concept visuel pour un seul concept métier.
      { label: 'Paramètres', href: 'NEXUS-Parametres-Station-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les réglages généraux de la station.' },
      // Ajouté 07/08/2026, demande de Frédéric — rejoint aussi le tiroir
      // "Explorer NEXUS" (NEXUS-App-v1.html, groupe Administrer) le même jour.
      { label: 'Paramètres Inventaire', href: 'NEXUS-Parametres-Inventaire-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les règles et seuils de l’inventaire.' },
      // Paramètres FDJ (10/08/2026, audit "Paramétrage autonome & multi-
      // site", étape 3) : rejoint Paramètres Inventaire, même logique.
      { label: 'Paramètres FDJ', href: 'NEXUS-FDJ-Parametres-v1.html', icon: 'assets/icons/icon-parametres-24.png', desc: 'Configure les seuils et réglages du module FDJ.' },
      { label: 'Rappels', href: 'NEXUS-Parametres-Rappels-v1.html', icon: 'assets/icons/icon-rappels.png', desc: 'Gère les rappels officiels FDJ à traiter.' },
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
  const lienIcone = (item) => item.icon
    ? `<img src="${item.icon}" alt="">`
    : `<span style="font-size:15px;">${item.emoji || '•'}</span>`;
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
    <a class="nexus-sidebar-brand" href="NEXUS-App-v1.html" title="Retour à l'accueil NEXUS">
      <img src="nexus-avatar.png" alt="NEXUS">
      <span>NEXUS</span>
    </a>
    <div class="nexus-sidebar-scroll">
      <a class="nexus-sidebar-link${pageActuelle === 'NEXUS-App-v1.html' ? ' active' : ''}" href="NEXUS-App-v1.html" style="margin-bottom:8px;">
        <img src="assets/icons/icon-home.png" alt="">
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
  .nexus-sidebar-link{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; color:#8A96A5; text-decoration:none; font-size:12.5px; margin-bottom:2px;}
  .nexus-sidebar-link:hover{background:#1A222C; color:#EDF1F5;}
  .nexus-sidebar-link.active{background:rgba(79,195,217,0.12); color:#4FC3D9; font-weight:600;}
  .nexus-sidebar-link img{width:16px; height:16px; flex-shrink:0; opacity:0.85;}
  .nexus-sidebar-link.active img{opacity:1;}
  .nexus-sidebar-foot{padding:14px 16px 18px; border-top:1px solid #242e38;}
  .nexus-sidebar-toggle{width:100%; padding:8px 10px; border-radius:8px; border:1px solid rgba(79,195,217,0.3); background:rgba(79,195,217,0.08); color:#4FC3D9; font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;}
  .nexus-sidebar-toggle:active{background:rgba(79,195,217,0.16);}

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
      .select('id', { count: 'exact', head: true }).eq('site', employee.site_id).eq('vue', false);
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
      puce.style.fontSize = '15px';
      puce.textContent = '•';
      img.replaceWith(puce);
    }, { once: true });
  });
}

function nexusInitVueBureau() {
  const style = document.createElement('style');
  style.textContent = NEXUS_DESKTOP_CSS;
  document.head.appendChild(style);

  if (nexusEstVueBureau()) {
    document.body.classList.add('nexus-desktop');
    const sidebar = document.createElement('div');
    sidebar.className = 'nexus-sidebar';
    sidebar.innerHTML = nexusConstruireSidebarHTML();
    document.body.insertBefore(sidebar, document.body.firstChild);
    nexusInstallerCurseurSidebar();
    nexusInstallerTooltipsSidebar();
    nexusInstallerReplisIconesSidebar();
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
