// Reprise des objectifs validés dans la mesure de compensation (Campagne V2, lot C8).
// Logique pure : aucun accès réseau, aucune écriture. Les prix TTC sont convertis en HT par NexusSimulateurPromo.ttcVersHt.
(function (global) {
  'use strict';

  const CHAMPS = ['achatAvant', 'achatPendant', 'venteAvant', 'ventePendant'];
  const num = (v) => {
    if (v === null || v === undefined) return null;
    const t = typeof v === 'string' ? v.trim().replace(',', '.') : v;
    if (t === '' || !isFinite(Number(t))) return null;
    return Number(t);
  };
  const arrondi = (v) => (v === null ? null : Math.round(v * 100) / 100);

  // Dernière version validée de l'objectif d'un article pour une campagne, ou null.
  function derniereValidee(rows, campagneId, article) {
    let best = null;
    (rows || []).forEach((r) => {
      if (r.campagne_id !== campagneId || r.article !== article) return;
      if (num(r.objectif_valide_jour) === null) return;
      if (!best || Number(r.version) > Number(best.version)) best = r;
    });
    return best;
  }

  // Les quatre prix HT repris d'un objectif. Un prix inconnu ou une TVA inconnue reste null : jamais 0.
  function reprendre(obj, ttcVersHt) {
    const out = { achatAvant: null, achatPendant: null, venteAvant: null, ventePendant: null };
    if (!obj) return out;
    out.achatAvant = arrondi(num(obj.pa_habituel_ht));
    out.achatPendant = arrondi(num(obj.pa_promo_ht));
    const tva = num(obj.tva_pct);
    const conv = (ttc) => {
      const t = num(ttc);
      if (t === null || tva === null) return null;
      const v = ttcVersHt(t, tva);
      return v === null || v === undefined || !isFinite(v) ? null : arrondi(v);
    };
    out.venteAvant = conv(obj.pv_habituel_ttc);
    out.ventePendant = conv(obj.pv_promo_ttc);
    return out;
  }

  // Applique la reprise sur une saisie : ne remplace jamais une valeur déjà présente, signale l'écart.
  // Retourne {repris: [champs remplis], ecarts: [{champ, saisi, objectif}]}.
  function appliquer(saisie, repris) {
    const res = { repris: [], ecarts: [] };
    CHAMPS.forEach((c) => {
      const o = repris[c];
      if (o === null) return;
      const s = num(saisie[c]);
      if (s === null) { saisie[c] = String(o).replace('.', ','); res.repris.push(c); }
      else if (Math.abs(s - o) > 0.005) res.ecarts.push({ champ: c, saisi: s, objectif: o });
      else res.repris.push(c);
    });
    return res;
  }

  // Écarts seuls, sans modifier la saisie (pour une mesure déjà enregistrée).
  function ecarts(saisie, repris) {
    const res = [];
    CHAMPS.forEach((c) => {
      const o = repris[c], s = num(saisie[c]);
      if (o !== null && s !== null && Math.abs(s - o) > 0.005) res.push({ champ: c, saisi: s, objectif: o });
    });
    return res;
  }

  const api = { CHAMPS, derniereValidee, reprendre, appliquer, ecarts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.NexusCampagnePrefill = api;
})(typeof window !== 'undefined' ? window : globalThis);
