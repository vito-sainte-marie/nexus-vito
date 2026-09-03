// Généré par outils/poser-build-id.js — ne pas éditer à la main.
// Identifiant unique de la génération déployée. Toutes les ressources
// fonctionnelles de ce déploiement portent ?v=<id> : un écran servi depuis le
// cache charge donc forcément un ensemble cohérent, jamais un mélange de
// générations.
(function (global) {
  'use strict';
  global.NEXUS_BUILD = { id: '20260903-1221', commit: 'b1ef9e6' };
  // Estampille discrète en pied de page, pour savoir d'un coup d'œil si le
  // téléphone, le Mac et le serveur exécutent la même version.
  function estampiller() {
    var pied = document.querySelector('footer');
    if (!pied || pied.querySelector('.nexus-build-estampille')) return;
    var s = document.createElement('span');
    s.className = 'nexus-build-estampille';
    s.style.cssText = 'display:block; margin-top:4px; font-size:10px; opacity:.55;';
    s.textContent = 'NEXUS build 20260903-1221 · commit b1ef9e6';
    pied.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', estampiller, { once: true });
  else estampiller();
})(typeof window !== 'undefined' ? window : globalThis);
