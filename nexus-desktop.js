// NEXUS — nexus-desktop.js
// Vue bureau (02/08/2026, demande de Frédéric) : "par défaut, NEXUS reste en
// vue mobile — un bouton permet de passer en vue bureau si on travaille sur
// ordinateur." Le mobile reste donc TOUJOURS le comportement par défaut,
// sur tous les appareils, tant que ce choix n'a pas été fait explicitement.
//
// PILOTE (02/08/2026) : n'est inclus pour l'instant QUE sur NEXUS-Verify-v1
// (écran choisi avec Frédéric pour valider le style avant de généraliser à
// tout NEXUS). À inclure sur une nouvelle page : <script src="nexus-desktop.js"></script>
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
const NEXUS_SIDEBAR_GROUPES = [
  {
    nom: 'Piloter',
    items: [
      { label: 'Cockpit', href: 'NEXUS-Cockpit-v2.html', icon: 'assets/icons/icon-home.png' },
      { label: 'Journal', href: 'NEXUS-Journal-v1.html', icon: 'assets/icons/icon-journal-nexus.png' },
      { label: 'Capital NEXUS', href: 'NEXUS-Capital-v1.html', icon: 'assets/icons/icon-capital.png' },
      { label: 'Scanner NEXUS', href: 'NEXUS-Scanner-v1.html', icon: 'assets/icons/icon-scanner.png' },
      { label: 'Radar du Manager', href: 'NEXUS-Radar-Manager-v1.html', icon: 'assets/icons/icon-radar.png' },
    ],
  },
  {
    nom: 'Performer',
    items: [
      { label: 'Produits', href: 'NEXUS-Produits-v1.html', icon: 'assets/icons/icon-produits.png' },
      { label: 'Tempo', href: 'NEXUS-Tempo-v1.html', icon: 'assets/icons/icon-nexus-tempo.png' },
      { label: 'Campagnes', href: 'NEXUS-Campagne-v1.html', icon: 'assets/icons/icon-campagne-nexus.png' },
      { label: 'Scanner Stock', href: 'NEXUS-Scanner-Stock-v1.html', icon: 'assets/icons/icon-scanner-stock.png' },
    ],
  },
  {
    nom: 'Exécuter',
    items: [
      { label: 'Verify', href: 'NEXUS-Verify-v1.html', icon: 'assets/icons/icon-nexus-verify.png' },
      { label: 'Inventaire', href: 'NEXUS-Inventaire-v1.html', icon: 'assets/icons/icon-inventaire.png' },
      { label: 'Contrôle inventaire', href: 'NEXUS-Inventaire-Manager-v1.html', icon: null, emoji: '🧭' },
      { label: 'Missions', href: 'NEXUS-Missions-v1.html', icon: 'assets/icons/icon-missions.png' },
      { label: 'Assignations', href: 'NEXUS-Assignations-v1.html', icon: 'assets/icons/icon-assignations.png' },
      { label: 'Planning', href: 'NEXUS-Planning-v1.html', icon: 'assets/icons/icon-planner.png' },
    ],
  },
  {
    nom: 'Équipe',
    items: [
      { label: 'Évaluations', href: 'NEXUS-Evaluation-Employe-v1.html', icon: 'assets/icons/icon-evaluation.png' },
      { label: 'Résultats', href: 'NEXUS-Resultats-Equipe-v1.html', icon: 'assets/icons/icon-resultats-equipe.png' },
    ],
  },
  {
    nom: 'Administrer',
    items: [
      { label: 'Imports', href: 'NEXUS-Import-v1.html', icon: 'assets/icons/icon-import.png' },
      { label: 'Paramètres', href: 'NEXUS-Parametres-Station-v1.html', icon: null, emoji: '⚙️' },
      { label: 'Rappels', href: 'NEXUS-Parametres-Rappels-v1.html', icon: 'assets/icons/icon-rappels.png' },
    ],
  },
];

function nexusConstruireSidebarHTML() {
  const pageActuelle = window.location.pathname.split('/').pop();
  const lienIcone = (item) => item.icon
    ? `<img src="${item.icon}" alt="">`
    : `<span style="font-size:15px;">${item.emoji || '•'}</span>`;
  const groupesHTML = NEXUS_SIDEBAR_GROUPES.map(g => `
    <div class="nexus-sidebar-group">${g.nom}</div>
    ${g.items.map(item => `
      <a class="nexus-sidebar-link${item.href === pageActuelle ? ' active' : ''}" href="${item.href}">
        ${lienIcone(item)}
        <span>${item.label}</span>
      </a>
    `).join('')}
  `).join('');

  return `
    <div class="nexus-sidebar-brand">
      <img src="nexus-avatar.png" alt="NEXUS">
      <span>NEXUS</span>
    </div>
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
  .nexus-sidebar-brand{display:flex; align-items:center; gap:10px; padding:20px 18px 16px;}
  .nexus-sidebar-brand img{width:30px; height:30px; border-radius:8px; object-fit:cover;}
  .nexus-sidebar-brand span{font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:700; color:#EDF1F5; letter-spacing:0.03em;}
  .nexus-sidebar-scroll{flex:1; overflow-y:auto; padding:0 10px 16px;}
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
`;

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
