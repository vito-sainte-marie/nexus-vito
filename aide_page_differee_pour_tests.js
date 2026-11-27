'use strict';
// B0-perf-6 : les 8 pages portent désormais leurs scripts en `defer` et leur script principal en
// <script type="text/plain" id="nexus-script-principal"> (relancé par nexus-demarrer-principal.js).
// Les anciens tests lisent la page telle qu'elle était : un <script> inline, des <script src> sans attribut.
// avantDefer() rend cette forme ; l'ordre d'exécution réel est prouvé par test_scripts_differes_ordre_20261127.js.
function avantDefer(html) {
  return String(html)
    .replace(/<script defer src="nexus-(?:charger-pdf|demarrer-principal)\.js[^"]*"><\/script>\n?/g, '')
    .replace(/<script type="text\/plain" id="nexus-script-principal">/g, '<script>')
    .replace(/<script defer src=/g, '<script src=');
}
module.exports = { avantDefer };
