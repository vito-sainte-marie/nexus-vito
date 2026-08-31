// NEXUS — nexus-header-nav.js
// Bouton "Retour" partagé (20/08/2026, demande de Frédéric) : "dans toutes
// les pages qu'on ouvre, mettre une touche retour pour retourner à la page
// précédente et garder la touche menu pour aller à l'index."
//
// Contrairement au bouton "☰ Menu" (codé en dur, dupliqué dans chaque
// fichier HTML — voir cartographie du 20/08/2026), ce fichier pose UNE
// SEULE fois la logique et le style du bouton retour, injecté en JS dans
// le header de chaque page qui inclut ce script (même précédent que
// nexus-desktop.js pour la sidebar bureau : "un seul endroit à corriger").
//
// Comportement du bouton : un vrai retour navigateur (window.history.back())
// — jamais un lien codé en dur vers un écran fixe, qui ne serait pas
// réellement "la page précédente" si l'utilisateur est arrivé par un autre
// chemin. Repli sur NEXUS-App-v1.html (l'accueil) uniquement si la page a
// été ouverte directement (pas d'historique à dépiler) — jamais un bouton
// qui ne ferait rien.
//
// Le bouton "☰ Menu" n'est pas touché : il continue de mener explicitement
// à l'accueil (NEXUS-App-v1.html), c'est le rôle que Frédéric veut lui
// garder. Les deux boutons cohabitent, chacun avec un rôle distinct.
//
// Portée volontairement EXCLUE de ce fichier (décision explicite du
// 20/08/2026, voir NEXUS-Data-Dictionary-v2.md) :
// - NEXUS-Pointage-v1.html / NEXUS-Prise-De-Poste-v1.html (écrans de
//   passage obligatoire, "NEXUS_PAGES_SEQUENCE_OBLIGATOIRE" dans
//   nexus-auth.js) : un bouton retour y créerait une illusion de sortie
//   alors que la page obligatoire se redéclenchera de toute façon au
//   prochain chargement — mieux vaut n'avoir aucun bouton qui laisse
//   croire à un contournement possible.
// - NEXUS-App-v1.html (l'accueil lui-même, destination du bouton menu),
//   NEXUS-Login-v1.html (avant authentification), les 8 pages publiques
//   (CGU/FAQ/Mentions légales/...), et NEXUS-Home-Concept-v1.html (maquette
//   non connectée, pas un écran réel de l'app).
//
// Compatible avec les deux variantes de header trouvées dans le projet :
// - header "bloc" (`.header{position:relative}`, `.menu-btn` en
//   position:absolute top-right) — la grande majorité des écrans : le
//   bouton retour est posé en position:absolute top-left, en miroir.
// - header "flex" (`.header{display:flex}` ou `.topbar{display:flex}`,
//   ex. NEXUS-Cockpit-v2.html, NEXUS-Import-v1.html) : le bouton retour
//   est inséré comme premier élément du flux flex (jamais en absolute, qui
//   chevaucherait le logo/le titre déjà présents dans ces headers).
// Certains écrans (Comptes Clients, Boîte de réception, Paramètres Comptes
// Clients, Documentation) ont déjà un bouton `.back-btn`/`.icon-btn` en
// position:absolute top-left faisant un rôle voisin (menu, écran parent) —
// décision du 20/08/2026 : on les laisse tels quels et on ajoute le vrai
// retour à côté, légèrement plus bas pour ne jamais les superposer.
// Import en faisait partie jusqu'au 21/08/2026 : son bouton `.icon-btn`
// (lien fixe vers l'accueil) créait un DOUBLE bouton retour visuellement
// redondant avec le "‹ Précédent" injecté ici (signalé par Frédéric,
// capture à l'appui) — retiré du HTML d'Import, qui ne garde donc plus
// que ce bouton partagé.
(function () {
  'use strict';

  var headersDejaConnectes = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;

  function dejaConnecte(el) {
    if (!headersDejaConnectes) return false;
    if (headersDejaConnectes.has(el)) return true;
    headersDejaConnectes.add(el);
    return false;
  }

  function creerCss() {
    if (document.getElementById('nexus-retour-css')) return;
    var style = document.createElement('style');
    style.id = 'nexus-retour-css';
    style.textContent =
      // display:inline-flex (pas flex) : le bouton doit rester de la
      // largeur de son contenu ("‹ Précédent"), pas s'étirer sur toute la
      // largeur du header une fois sorti du positionnement absolu ci-dessous.
      '.nexus-retour-btn{display:inline-flex; align-items:center; gap:6px; font-family:\'IBM Plex Mono\',monospace; ' +
      'font-size:10.5px; font-weight:600; letter-spacing:0.03em; text-transform:uppercase; color:#8A96A5; ' +
      'background:rgba(138,150,165,0.10); border:1px solid rgba(138,150,165,0.28); border-radius:20px; ' +
      'padding:7px 12px; text-decoration:none; white-space:nowrap; z-index:5; cursor:pointer;}' +
      '.nexus-retour-btn:active{background:rgba(138,150,165,0.22);}' +
      // 21/08/2026 (retour de Frédéric — "PRÉCÉDENT est confondu avec
      // NEXUS PARAMÈTRES INVENTAIRE") : `position:absolute; top:18px;
      // left:18px` chevauchait l'eyebrow (".eyebrow", lui-même en flux
      // normal au tout début du header) sur tous les écrans à header
      // "bloc" — le miroir du bouton Menu (à droite, où rien d'autre ne
      // démarre au même endroit) ne fonctionnait pas à gauche, où
      // l'eyebrow démarre exactement là. Remplacé par un positionnement en
      // flux normal (premier enfant du header, comme avant), qui pousse
      // naturellement l'eyebrow/titre/sous-titre en dessous au lieu de se
      // superposer — plus besoin de deviner une valeur de padding qui
      // marcherait sur tous les headers du site (paddings différents d'un
      // écran à l'autre). Toujours inséré en premier enfant du header
      // (voir injecterDans ci-dessous), donc toujours au-dessus du reste.
      '.nexus-retour-btn--absolu{display:inline-flex; margin:0 0 10px;}' +
      '.nexus-retour-btn--absolu-bas{position:absolute; top:58px; left:18px;}' +
      '.nexus-retour-btn--flex{flex-shrink:0;}' +
      'body.nexus-desktop .nexus-retour-btn{display:none !important;}';
    document.head.appendChild(style);
  }

  function retourner() {
    // Un vrai retour navigateur : dépile l'historique si la page a été
    // atteinte depuis une autre page NEXUS ; sinon (lien direct, onglet
    // ouvert depuis un favori, etc.) repli explicite sur l'accueil — jamais
    // un bouton qui ne réagit pas au clic.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'NEXUS-App-v1.html';
    }
  }

  function creerBouton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nexus-retour-btn';
    btn.setAttribute('aria-label', 'Retour à la page précédente');
    btn.textContent = '‹ Précédent';
    btn.addEventListener('click', retourner);
    return btn;
  }

  function injecterDans(header) {
    if (!header || header.querySelector('.nexus-retour-btn')) return;
    creerCss();
    var cs = window.getComputedStyle(header);
    var enFlex = cs.display === 'flex' || cs.display === 'inline-flex';
    var btn = creerBouton();
    if (enFlex) {
      btn.classList.add('nexus-retour-btn--flex');
    } else {
      if (cs.position === 'static') header.style.position = 'relative';
      var dejaOccupe = header.querySelector('.back-btn, .icon-btn');
      btn.classList.add(dejaOccupe ? 'nexus-retour-btn--absolu-bas' : 'nexus-retour-btn--absolu');
    }
    header.insertBefore(btn, header.firstChild);
  }

  function surveillerHeader(header) {
    if (dejaConnecte(header)) return;
    injecterDans(header);
    // Certains écrans réécrivent header.innerHTML en bloc une fois l'auth
    // résolue (ex. NEXUS-Cockpit-v2.html) — ce qui efface le bouton déjà
    // inséré. On observe ce header précis (pas tout le document, coût
    // négligeable : un seul élément par header réel de la page) pour le
    // réinjecter aussitôt après toute réécriture.
    var mo = new MutationObserver(function () { injecterDans(header); });
    mo.observe(header, { childList: true });
  }

  function demarrer() {
    var trouves = document.querySelectorAll('.header, .topbar');
    trouves.forEach(surveillerHeader);
    if (trouves.length) return;

    // Filet de sécurité : header entièrement construit en JS, absent au
    // chargement initial. On observe le document le temps qu'il apparaisse
    // puis on arrête (jamais un observer qui tourne indéfiniment en fond).
    var bodyObserver = new MutationObserver(function () {
      var nouveaux = document.querySelectorAll('.header, .topbar');
      if (nouveaux.length) {
        nouveaux.forEach(surveillerHeader);
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { bodyObserver.disconnect(); }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();

// Branche P0 Carburants uniquement : charge un correctif isolé sans toucher
// aux gros moteurs. Le module se met lui-même en attente jusqu'à ce que les
// objets NexusCarburant* soient disponibles. Cette section est destinée à
// disparaître lors de l'intégration finale des correctifs dans leurs fichiers
// métier respectifs.
(function () {
  'use strict';
  var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  if (page.indexOf('nexus-carburant') !== 0) return;
  if (document.querySelector('script[data-nexus-carburants-p0]')) return;
  var script = document.createElement('script');
  script.src = 'nexus-carburants-p0-fixes.js';
  script.async = false;
  script.setAttribute('data-nexus-carburants-p0', '1');
  document.head.appendChild(script);
})();
