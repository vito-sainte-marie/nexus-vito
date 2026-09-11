// NEXUS — bandeau d'environnement (04/09/2026).
//
// Un seul bandeau, une seule implémentation, posé au build sur les mêmes
// écrans que `nexus-config.js` — connexion comprise, puisque c'est là qu'on
// a le plus besoin de savoir à quelle base on s'apprête à parler.
//
// POURQUOI CE FICHIER EXISTE : jusqu'ici la recette était visuellement
// indiscernable de la production. Mêmes écrans, mêmes couleurs, mêmes
// libellés. Un manager qui saisit un comptage d'inventaire sur la recette
// croit travailler pour sa station, et son travail est perdu ; l'inverse est
// pire encore. `NEXUS_ENVIRONNEMENT` existait déjà dans nexus-auth.js, mais
// n'était lu nulle part.
//
// RÈGLE ABSOLUE : rien ne s'affiche hors de l'environnement « test ». La
// condition porte sur une égalité stricte, pas sur une négation de
// « production » — une valeur inattendue ne doit pas faire apparaître un
// bandeau chez un client.
(function () {
  'use strict';

  var cfg = (typeof window !== 'undefined' && window.NEXUS_CONFIG) || null;
  if (!cfg || cfg.environnement !== 'test') return;

  var ID = 'nexus-bandeau-environnement';

  // Hauteur d'une barre d'une ligne, bordure comprise. Sert de repli quand la
  // mesure n'est pas croyable.
  var REPLI = 30;

  function ajuster(bandeau) {
    var h = bandeau.getBoundingClientRect().height;

    // Une barre d'une à trois lignes ne dépasse jamais 120 px. Au-delà, la
    // mesure a été prise alors que la page n'avait pas encore de largeur —
    // onglet ouvert en arrière-plan, page préchargée, démarrage à froid d'une
    // PWA. Le texte s'enroule alors sur une vingtaine de lignes et la marge
    // resterait fausse pour de bon : constaté sur la recette, 306 px de vide
    // en haut de l'écran, pour un bandeau qui en fait 30.
    if (!(h > 0 && h <= 120)) h = REPLI;

    document.documentElement.style.marginTop = Math.round(h) + 'px';
  }

  function poser() {
    if (!document.body || document.getElementById(ID)) return;

    var bandeau = document.createElement('div');
    bandeau.id = ID;
    bandeau.setAttribute('role', 'status');
    bandeau.textContent =
      'MODE TEST — base de recette. Rien de ce qui est saisi ici ne compte pour la station.';
    bandeau.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'z-index:2147483647',
      'background:#FFB020', 'color:#101418',
      'font:600 12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.04em', 'text-align:center',
      'padding:6px 10px', 'padding-top:calc(6px + env(safe-area-inset-top,0px))',
      'border-bottom:2px solid #101418',
      'pointer-events:none', 'user-select:none'
    ].join(';') + ';';

    document.body.appendChild(bandeau);

    // Le bandeau est en `fixed` : sans compensation il recouvrirait le haut
    // de l'écran. La compensation est posée sur <html>, jamais sur <body> —
    // un `padding-top` en style inline sur le body écraserait les règles
    // responsives des 53 écrans, et le padding calculé sur grand écran
    // resterait figé sur mobile.
    ajuster(bandeau);

    // Et on remesure : la première mesure peut être prise trop tôt, et la
    // hauteur change quand le texte s'enroule sur un écran étroit.
    var remesurer = function () { ajuster(bandeau); };
    window.addEventListener('load', remesurer);
    window.addEventListener('resize', remesurer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poser, { once: true });
  } else {
    poser();
  }
})();
