// ============================================================
// Campagne V2, lot C3 : moteur pur des livraisons, du stock de départ et du stock théorique.
// Aucune écriture, aucun accès réseau. Le stock théorique est toujours « théorique » : il porte sa date et ses sources.
// Inclure : <script src="nexus-campagne-stock.js?v=20261114-1900"></script>
// ============================================================
(function (global) {
  'use strict';

  const JOUR_MS = 86400000;
  function aDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function ecartJours(a, b) { return Math.round((aDate(b) - aDate(a)) / JOUR_MS); }
  function cle(s) { return String(s || '').trim().toLowerCase(); }

  // Conditionnement d'achat : trois cas distincts. « À l'unité » = 1 par carton, explicite ; différent d'inconnu.
  // `reglage` est la dernière version du réglage par article (ou null).
  function conditionnement(article, reglage) {
    if (reglage && reglage.mode === 'a_l_unite') return { source: 'a_l_unite', unitesParCarton: 1, aRenseigner: false };
    if (reglage && reglage.mode === 'suffixe_np' && Number(reglage.unites_par_carton) > 0) return { source: 'suffixe_np', unitesParCarton: Number(reglage.unites_par_carton), aRenseigner: false };
    const m = /-\s*(\d+)\s*P\s*$/i.exec(String(article || ''));
    if (m && Number(m[1]) > 0) return { source: 'suffixe_np', unitesParCarton: Number(m[1]), aRenseigner: false };
    return { source: 'inconnu', unitesParCarton: null, aRenseigner: true };
  }

  // Ligne de livraison : cartons x unités par carton, ou saisie directe en unités (cartons vide).
  function convertirLigne({ cartons, unites, unitesParCarton }) {
    const c = cartons === '' || cartons == null ? null : Number(cartons);
    const u = unites === '' || unites == null ? null : Number(unites);
    const upc = unitesParCarton === '' || unitesParCarton == null ? null : Number(unitesParCarton);
    if (c != null) {
      if (!(upc > 0)) return { unites: null, aRenseigner: true };
      return { unites: c * upc, aRenseigner: false };
    }
    if (u != null) return { unites: u, aRenseigner: upc == null ? false : false };
    return { unites: null, aRenseigner: false };
  }

  // Le PA saisi est conservé à côté du proposé ; l'écart est signalé, jamais écrasé.
  function ecartPa(paFacture, paPropose) {
    if (paFacture == null || paPropose == null) return null;
    return Number(paFacture) - Number(paPropose);
  }

  // Livraisons valides : ni annulées, ni remplacées par une livraison elle-même valide.
  function livraisonsValides(livraisons, annulations) {
    const annulees = new Set((annulations || []).map(a => a.livraison_id));
    const vivantes = (livraisons || []).filter(l => !annulees.has(l.id));
    const remplacees = new Set(vivantes.map(l => l.remplace_livraison_id).filter(Boolean));
    return vivantes.filter(l => !remplacees.has(l.id));
  }

  // Dernière version du stock de départ par article.
  function stockDepartCourant(lignes, cleDe) {
    const kf = cleDe || cle;
    const m = new Map();
    (lignes || []).forEach(l => {
      const k = kf(l.article);
      if (!m.has(k) || l.version > m.get(k).version) m.set(k, l);
    });
    return m;
  }

  // Écart entre la date du stock de départ et le début de la promotion : jours de ventes non couverts.
  function ecartDepart(dateStock, campagneDebut) {
    if (!aDate(dateStock) || !aDate(campagneDebut)) return 0;
    return Math.max(0, ecartJours(dateStock, campagneDebut));
  }

  // Livraisons saisies dans Inventaire pendant la promotion : affichées, jamais ajoutées.
  function livraisonsInventaireNonComptees(mouvements, { articles, campagneDebut, campagneFin, resoudre }) {
    const cl = s => { const c = resoudre ? resoudre(s) : null; return String(c || s || '').trim().toLowerCase(); };
    const cibles = new Set((articles || []).map(cl));
    return (mouvements || []).filter(m =>
      m.type_mouvement === 'livraison' && cibles.has(cl(m.article)) &&
      m.date >= String(campagneDebut).slice(0, 10) && m.date <= String(campagneFin).slice(0, 10))
      .map(m => ({ article: m.article, date: m.date, quantite: Number(m.quantite || 0), mention: 'livraison saisie dans Inventaire, non comptée ici' }));
  }

  // Stock théorique = stock de départ + livraisons valides - ventes du dernier import valide.
  // Retourne par article { stock, a_confirmer, sources, manque_depart, jours_non_couverts }.
  // `resoudre(designation)` rend la désignation canonique après alias (ou null) : une vente sous un alias
  // encore dû est comptée sur l'article canonique, jamais perdue.
  function stockTheorique({ articles, stockDepart, livraisons, annulations, lignesLivraison, ventes, dateVentes, campagneDebut, resoudre }) {
    const cle = s => { const c = resoudre ? resoudre(s) : null; return String(c || s || '').trim().toLowerCase(); };
    const dep = stockDepartCourant(stockDepart, cle);
    const valides = new Map(livraisonsValides(livraisons, annulations).map(l => [l.id, l]));
    // Une livraison compte seulement si elle est datée strictement après le stock de départ de l'article.
    // Le jour même, on ne sait pas si elle est déjà dans le stock compté : elle est signalée, pas comptée.
    const livre = new Map();
    const memeJour = new Map();
    (lignesLivraison || []).filter(l => valides.has(l.livraison_id)).forEach(l => {
      const k = cle(l.article);
      const d = dep.get(k);
      const dl = String(valides.get(l.livraison_id).date_livraison || '').slice(0, 10);
      const dd = d ? String(d.date_stock || '').slice(0, 10) : '';
      if (d && dl && dd && dl < dd) return;
      if (d && dl && dd && dl === dd) { memeJour.set(k, (memeJour.get(k) || 0) + Number(l.unites || 0)); return; }
      livre.set(k, (livre.get(k) || 0) + Number(l.unites || 0));
    });
    const vendu = new Map();
    (ventes || []).forEach(v => vendu.set(cle(v.article), (vendu.get(cle(v.article)) || 0) + Number(v.quantite || 0)));
    return (articles || []).map(article => {
      const k = cle(article);
      const d = dep.get(k);
      if (!d) return { article, stock: null, manque_depart: true, a_confirmer: true, sources: [], libelle: 'Stock théorique' };
      const jours = ecartDepart(d.date_stock, campagneDebut);
      return {
        article,
        stock: Number(d.quantite) + (livre.get(k) || 0) - (vendu.get(k) || 0),
        manque_depart: false,
        a_confirmer: !!d.a_confirmer || jours > 0 || memeJour.has(k),
        livraison_meme_jour_a_verifier: memeJour.get(k) || 0,
        jours_non_couverts: jours,
        sources: ['stock de départ du ' + String(d.date_stock).slice(0, 10) + ' (' + d.source + ')', 'livraisons valides', 'ventes au ' + (dateVentes ? String(dateVentes).slice(0, 10) : 'inconnu')],
        libelle: 'Stock théorique',
      };
    });
  }

  // Arrondi d'une recommandation d'achat : à l'unité supérieure pour un article « à l'unité », au carton sinon.
  function arrondirAchat(besoinUnites, cond) {
    const b = Math.max(0, Math.ceil(Number(besoinUnites || 0)));
    if (cond.source === 'a_l_unite') return { unites: b, cartons: null, mention: null };
    if (cond.aRenseigner) return { unites: b, cartons: null, mention: 'conditionnement à renseigner' };
    const cartons = Math.ceil(b / cond.unitesParCarton);
    return { unites: cartons * cond.unitesParCarton, cartons, mention: null };
  }

  global.NexusCampagneStock = {
    conditionnement, convertirLigne, ecartPa, livraisonsValides, stockDepartCourant, ecartDepart,
    livraisonsInventaireNonComptees, stockTheorique, arrondirAchat,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneStock;
})(typeof window !== 'undefined' ? window : globalThis);
