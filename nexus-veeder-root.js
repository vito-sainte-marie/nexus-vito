// NEXUS — Jaugeage Veeder-Root : lecture du texte OCR de l'écran TLS4B (logique pure).
// Aucun accès réseau, aucun DOM. La lecture est une PROPOSITION à vérifier à l'œil ;
// elle n'écrit rien et ne décide rien. Lot FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016, Test.
(function (root) {
  'use strict';

  const PRODUITS = ['SP', 'GO', 'GNR'];
  const VOLUME_MAX_L = 60000; // au-delà : lecture jugée invraisemblable (cuves de 10 à 30 m3)

  // Un bloc commence par « RESERVOIR n : Rx NNM3 PRODUIT ». Le rattachement se fait
  // par ce libellé (produit + capacité), jamais par la position à l'écran.
  const RE_ENTETE = /R[EÉ]SERVOIR\s*(\d)\s*[:;.]?\s*R?(\d)?\s*(\d{1,3})\s*M3\s*(SP|GO|GNR)/gi;

  function entier(s) {
    const n = Number(String(s).replace(/[\s.,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  // texte -> [{ reservoir, code, capacite_m3, produit, volume_l, eau_mm, alerte }]
  function lireEcranVeederRoot(texte) {
    const t = String(texte || '').replace(/\r/g, '\n');
    const marques = [];
    let m;
    RE_ENTETE.lastIndex = 0;
    while ((m = RE_ENTETE.exec(t)) !== null) {
      marques.push({ idx: m.index, fin: RE_ENTETE.lastIndex, reservoir: Number(m[1]), code: m[2] ? 'R' + m[2] : null, capacite_m3: Number(m[3]), produit: m[4].toUpperCase() });
    }
    return marques.map((c, i) => {
      const corps = t.slice(c.fin, i + 1 < marques.length ? marques[i + 1].idx : t.length);
      const vol = /Volume\s*Produit\D{0,12}?(\d{1,3}(?: \d{3})+|\d+)/i.exec(corps);
      const eau = /Hauteur\s*eau\D{0,12}?(\d[\d.,]*)/i.exec(corps);
      const volume = vol ? entier(vol[1]) : null;
      return {
        reservoir: c.reservoir, code: c.code, capacite_m3: c.capacite_m3, produit: c.produit,
        volume_l: volume, eau_mm: eau ? Number(eau[1].replace(',', '.')) : null,
        alerte: controlerLecture(c, volume),
      };
    });
  }

  function controlerLecture(c, volume) {
    if (volume == null) return 'valeur_absente';
    if (volume > c.capacite_m3 * 1000) return 'au_dela_de_la_capacite';
    if (volume > VOLUME_MAX_L) return 'invraisemblable';
    return null;
  }

  // Ce qui manque pour proposer un jaugeage exploitable : GO (2 cuves), SP, GNR.
  function completude(cuves) {
    const nb = (p) => cuves.filter(c => c.produit === p && c.volume_l != null && !c.alerte).length;
    const manque = [];
    if (nb('SP') < 1) manque.push('SP');
    if (nb('GO') < 2) manque.push('GO');
    if (nb('GNR') < 1) manque.push('GNR');
    return { complet: manque.length === 0, manque };
  }

  // Écart entre la lecture proposée et la valeur confirmée par l'humain (trace de correction).
  function ecartCorrection(propose, confirme) {
    if (propose == null) return { corrige: true, delta: null };
    return { corrige: Number(propose) !== Number(confirme), delta: Number(confirme) - Number(propose) };
  }

  const api = { PRODUITS, VOLUME_MAX_L, lireEcranVeederRoot, controlerLecture, completude, ecartCorrection };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NexusVeederRoot = api;
})(typeof window !== 'undefined' ? window : globalThis);
