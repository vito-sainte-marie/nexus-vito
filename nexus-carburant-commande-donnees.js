// NEXUS — chargeur compatible du moteur Commande Carburant.
// Le cœur historique reste inchangé dans nexus-carburant-commande-donnees-core.js.
// Ce point d'entrée charge en plus, uniquement sur Carburants Performance,
// les correctifs UI validés après les captures Safari iOS du 01/09/2026.
(function () {
  'use strict';

  // Compatibilité des tests Node : le navigateur conserve le chargement
  // synchrone historique ci-dessous ; hors navigateur, on charge directement
  // le cœur CommonJS-compatible sans simuler un DOM.
  if (typeof document === 'undefined') {
    if (typeof require === 'function') require('./nexus-carburant-commande-donnees-core.js');
    return;
  }

  function estPilotageCarburants() {
    return (location.pathname.split('/').pop() || '').toLowerCase() === 'nexus-carburants-pilotage-v1.html';
  }

  // Ce fichier est chargé par une balise <script> classique dans le <head>.
  // document.write conserve volontairement l'ordre synchrone historique :
  // NexusCarburantCommandeDonnees est donc disponible exactement au même
  // moment qu'avant pour les scripts et le bootstrap de la page.
  document.write('<script src="nexus-carburant-commande-donnees-core.js?v=20260902-2341"><\/script>');

  // Le correctif de cohérence charge lui-même le polish mobile. On le force
  // ici avec une version neuve AVANT le rendu de la page afin qu'un ancien
  // exemplaire mis en cache par Safari ne puisse pas réinjecter le script
  // destructif qui effaçait situationZone.
  if (estPilotageCarburants()) {
    document.write('<script src="nexus-carburant-commande-coherence-v1.js?v=20260902-2341"><\/script>');
  }

  function chargerCorrectifUI() {
    if (!estPilotageCarburants()) return;
    if (document.querySelector('script[data-nexus-carburants-ui-correctifs="20260901"]')) return;
    var s = document.createElement('script');
    s.src = 'nexus-carburants-ui-correctifs-20260901.js?v=20260902-2341';
    s.dataset.nexusCarburantsUiCorrectifs = '20260901';
    document.head.appendChild(s);
  }

  // Le correctif agit sur #moteurZone, l'historique et le sélecteur P0 :
  // on attend donc que le DOM existe. Son MutationObserver prendra ensuite
  // en charge les blocs rendus/re-rendus asynchronement par la page.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', chargerCorrectifUI, { once: true });
  } else {
    chargerCorrectifUI();
  }
})();
