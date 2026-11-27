// B0-perf-6 : lanceur du script principal des pages à scripts différés.
// Le script principal de la page est stocké dans <script type="text/plain"
// id="nexus-script-principal">. Ce lanceur est le DERNIER script différé : il
// s'exécute donc après tous les autres (ordre du document conservé), avant
// DOMContentLoaded, et le script principal garde ses propres écouteurs
// DOMContentLoaded, enregistrés après ceux des scripts qui le précèdent,
// comme avant. Exécution en portée globale (un <script> injecté), pas dans
// une fonction : les déclarations de premier niveau restent globales.
(function () {
  'use strict';
  var src = document.getElementById('nexus-script-principal');
  if (!src) { console.error('NEXUS : script principal introuvable (#nexus-script-principal).'); return; }
  var s = document.createElement('script');
  s.text = src.textContent;
  document.body.appendChild(s);
})();
