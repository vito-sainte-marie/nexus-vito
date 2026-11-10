// NEXUS — Produits : briques pures de sécurité et de date (lot 1, PR A).
// L'échappement HTML reste UNE seule fonction : NexusBadgeEtat.esc.
(function (global) {
  'use strict';
  var FUSEAU_REPLI = 'America/Martinique';

  // URL d'image : https uniquement ; `hoteExige` restreint à un hôte (photos NEXUS = stockage Supabase).
  // Sinon chaîne vide : pas d'image plutôt qu'une URL douteuse.
  function urlImageSure(u, hoteExige, autorisees) {
    if (typeof u !== 'string') return '';
    if (autorisees && autorisees.indexOf(u) !== -1) return u; // valeurs internes fixes (aperçu)
    try {
      var x = new URL(u);
      if (x.protocol !== 'https:') return '';
      if (hoteExige && x.hostname !== hoteExige) return '';
      return x.href;
    } catch (e) { return ''; }
  }

  // Date (AAAA-MM-JJ) et heure (HH:MM) d'un instant dans le fuseau de la station.
  // Fuseau absent ou invalide : America/Martinique. Jamais UTC ni le fuseau du navigateur.
  function dateHeureDansFuseau(instant, fuseau) {
    var d = instant instanceof Date ? instant : new Date(instant);
    function parties(tz) {
      var f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      var o = {};
      f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      return { date: o.year + '-' + o.month + '-' + o.day, heure: o.hour + ':' + o.minute };
    }
    try { return parties(fuseau || FUSEAU_REPLI); } catch (e) { return parties(FUSEAU_REPLI); }
  }

  var API = { FUSEAU_REPLI: FUSEAU_REPLI, urlImageSure: urlImageSure, dateHeureDansFuseau: dateHeureDansFuseau };
  global.NexusProduitsSecurite = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
