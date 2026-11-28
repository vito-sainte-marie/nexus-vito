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
  // Périmètre comparable : lignes pilotables avec une cible validée ET une marge connue. La cible, la marge et la
  // couverture sont toutes mesurées sur ce même périmètre. Les lignes cibles mais sans marge sont comptées à part.
  function objectifStation(lignes, contexte) {
    var ctx = contexte || {}, exclus = {}, cibles = ctx.cibles || {};
    (ctx.exclus || []).forEach(function (r) { exclus[normaliserRayon(r && r.rayon_cle !== undefined ? r.rayon_cle : r)] = true; });
    var pil = 0, caC = 0, marge = 0, cible = 0, famC = {}, famPil = {}, famCiblees = {};
    var sm = { lignes: 0, ca: 0 }, caT = 0, cibleT = 0;
    (lignes || []).forEach(function (l) {
      if (!l || exclus[normaliserRayon(l.rayon)]) return;
      var ca = num(l.ca_ht); if (ca === null) return;
      pil += ca; if (l.famille) famPil[l.famille] = true;
      var c = l.famille ? num(cibles[l.famille]) : null;
      if (c === null) return;
      famCiblees[l.famille] = true; caT += ca; cibleT += ca * c;
      var m = l.margeEstimee ? num(l.margeEstimee.margeHt) : num(l.margeHt);
      if (m === null) { sm.lignes++; sm.ca += ca; return; }
      caC += ca; cible += ca * c; marge += m; famC[l.famille] = true;
    });
    var nbPil = Object.keys(famPil).length, nbCib = Object.keys(famCiblees).length, nb = Object.keys(famC).length;
    var covCa = pil > 0 ? caC / pil : 0;
    var res = {
      etat: 'non_evalue', cible: null, marge: null, familles: nb,
      couvertureCa: covCa, couverture: covCa,
      couvertureFamilles: nbPil > 0 ? nbCib / nbPil : 0, famillesCiblees: nbCib, famillesPilotables: nbPil,
      cibleMoyenne: caT > 0 ? cibleT / caT : null, sansMarge: sm
    };
    if (!nb || caC <= 0) return res;
    if (covCa < SEUIL_COUVERTURE) return res;
    res.etat = 'evalue'; res.cible = cible / caC; res.marge = marge / caC;
    return res;
  }

  var API = { normaliserRayon: normaliserRayon, objectifStation: objectifStation, SEUIL_COUVERTURE: SEUIL_COUVERTURE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else global.NexusCibleMarge = API;
})(typeof window !== 'undefined' ? window : globalThis);
