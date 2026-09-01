// NEXUS — chargeur compatible du moteur Commande Carburant.
// Le cœur historique reste inchangé dans nexus-carburant-commande-donnees-core.js.
// Ce point d'entrée charge en plus, uniquement sur Carburants Performance,
// les correctifs UI validés après les captures Safari iOS du 01/09/2026.
(function () {
  'use strict';

  // Ce fichier est chargé par une balise <script> classique dans le <head>.
  // document.write conserve volontairement l'ordre synchrone historique :
  // NexusCarburantCommandeDonnees est donc disponible exactement au même
  // moment qu'avant pour les scripts et le bootstrap de la page.
  document.write('<script src="nexus-carburant-commande-donnees-core.js?v=20260901-0718"><\/script>');

  function estPilotageCarburants() {
    return (location.pathname.split('/').pop() || '').toLowerCase() === 'nexus-carburants-pilotage-v1.html';
  }

  function chargerCorrectifUI() {
    if (!estPilotageCarburants()) return;
    if (document.querySelector('script[data-nexus-carburants-ui-correctifs="20260901"]')) return;
    var s = document.createElement('script');
    s.src = 'nexus-carburants-ui-correctifs-20260901.js?v=20260901-0718';
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
