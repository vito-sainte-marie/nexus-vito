// Objectif de marge de la station, calculé (A4-1d). Jamais saisi : il découle des cibles validées par famille.
// Module pur, sans accès réseau : le Brief, le Radar et l'App lisent le même résultat.
(function (global) {
  'use strict';
  var SEUIL_COUVERTURE = 0.5;
  var num = function (v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; };

  // Comparaison de rayons : répare « Ã » + espace(s) (mojibake), NFC, sans diacritiques, minuscules, espaces réduits.
  // Deux libellés réellement différents ne fusionnent pas.
  function normaliserRayon(c) {
    var s = String(c == null ? '' : c).replace(/Ã\s+/g, 'à ');
    try { s = s.normalize('NFC'); } catch (e) { /* environnement sans normalize */ }
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* idem */ }
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // lignes : lignes analysées {rayon, famille, ca_ht, margeEstimee:{margeHt}}.
  // contexte : { exclus: [rayons exclus], cibles: { famille: cible validée } }.
  function objectifStation(lignes, contexte) {
    var ctx = contexte || {}, exclus = {}, cibles = ctx.cibles || {};
    (ctx.exclus || []).forEach(function (r) { exclus[normaliserRayon(r && r.rayon_cle !== undefined ? r.rayon_cle : r)] = true; });
    var pil = 0, caP = 0, marge = 0, cible = 0, familles = {};
    (lignes || []).forEach(function (l) {
      if (!l || exclus[normaliserRayon(l.rayon)]) return;
      var ca = num(l.ca_ht); if (ca === null) return;
      pil += ca;
      var c = l.famille ? num(cibles[l.famille]) : null;
      if (c === null) return;
      var m = l.margeEstimee ? num(l.margeEstimee.margeHt) : num(l.margeHt);
      caP += ca; cible += ca * c; if (m !== null) marge += m; familles[l.famille] = true;
    });
    var nb = Object.keys(familles).length;
    var couverture = pil > 0 ? caP / pil : 0;
    if (!nb || caP <= 0) return { etat: 'non_evalue', cible: null, marge: null, couverture: couverture, familles: nb };
    var evalue = couverture >= SEUIL_COUVERTURE;
    return { etat: evalue ? 'evalue' : 'marge_non_evaluee', cible: cible / caP, marge: evalue ? marge / caP : null, couverture: couverture, familles: nb };
  }

  var API = { normaliserRayon: normaliserRayon, objectifStation: objectifStation, SEUIL_COUVERTURE: SEUIL_COUVERTURE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else global.NexusCibleMarge = API;
})(typeof window !== 'undefined' ? window : globalThis);
