// ============================================================
// TVA : confirmations par rayon décidées par le pilote le 18/11/2026. UNE seule source pour tout NEXUS
// (accueil Produits, Mes produits, Scanner tarifaire). Données de paramétrage, pas un registre : le registre
// produits_tva_confirmations passe toujours en premier, puis ces règles ; le premier élément qui correspond gagne.
// Recharges : Digicel Haïti à 0 % ; Digicel (hors Haïti), Orange, SFR à 8,5 % ; toute autre recharge à 0 %.
// Valables pour le seul site du pilote, lu dans la session par l'appelant, jamais saisi librement.
// Inclure avant nexus-produits-mesure.js :
//   <script src="nexus-tva-regles-pilote.js?v=20261121-1"></script>
// ============================================================
(function (global) {
  'use strict';
  var SITE_PILOTE = 'vito-sainte-marie';
  var SRC_PILOTE = 'pilote, 18/11/2026';
  var DATE_PILOTE = '2026-11-18';
  var HAITI = 'ha[iïí]ti';
  var TVA_CONFIRMATIONS_PILOTE = [
    { rayon: 'Cartes prépayées', motif: HAITI, taux_confirme: 0, source: SRC_PILOTE, confirme_le: DATE_PILOTE },
    { rayon: 'Cartes prépayées', motif: 'digicel|orange|sfr', taux_confirme: 8.5, source: SRC_PILOTE, confirme_le: DATE_PILOTE },
    { rayon: 'Cartes prépayées', taux_confirme: 0, source: SRC_PILOTE, confirme_le: DATE_PILOTE }
  ].concat(['Cigarettes', 'Cigares', 'Tabac à rouler - 30g', 'Gaz'].map(function (r) {
    return { rayon: r, taux_confirme: 0, source: SRC_PILOTE, confirme_le: DATE_PILOTE };
  }));
  // Catégorie lue comme T1 : « Ã  » (accent mal encodé) devient « à », espaces réduits.
  function catNorm(c) { return String(c == null ? '' : c).replace(/Ã\s+/g, 'à ').replace(/\s+/g, ' ').trim(); }
  // Même ordre que le Scanner : rayon + motif, sinon rayon seul.
  function correspondRayon(regle, row) {
    if (!regle || !regle.rayon || !row) return false;
    if (catNorm(regle.rayon) !== catNorm(row.categorie)) return false;
    return regle.motif ? new RegExp(regle.motif, 'i').test(row.article || '') : true;
  }
  // Première règle de rayon applicable à la ligne, pour le site du pilote seulement.
  function regleDeRayon(row, site) {
    if (site !== SITE_PILOTE) return null;
    for (var i = 0; i < TVA_CONFIRMATIONS_PILOTE.length; i++) if (correspondRayon(TVA_CONFIRMATIONS_PILOTE[i], row)) return TVA_CONFIRMATIONS_PILOTE[i];
    return null;
  }
  var api = { SITE_PILOTE: SITE_PILOTE, SRC_PILOTE: SRC_PILOTE, TVA_CONFIRMATIONS_PILOTE: TVA_CONFIRMATIONS_PILOTE, catNorm: catNorm, correspondRayon: correspondRayon, regleDeRayon: regleDeRayon };
  global.NexusTvaReglesPilote = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
