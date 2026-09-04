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
    // de l'écran. On mesure sa hauteur réelle plutôt que de la supposer —
    // elle dépend de l'encoche et du retour à la ligne sur mobile.
    //
    // La compensation est posée sur <html>, jamais sur <body>. Écrire un
    // `padding-top` en style inline sur le body écraserait les règles
    // responsives des 53 écrans — le padding calculé sur un grand écran
    // resterait figé sur mobile. La marge de <html> n'est stylée nulle part
    // dans NEXUS : elle décale la page sans rien recouvrir ni rien contredire.
    var hauteur = bandeau.offsetHeight || 28;
    document.documentElement.style.marginTop = hauteur + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poser, { once: true });
  } else {
    poser();
  }
})();
