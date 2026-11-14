// ============================================================
// Campagne V2, lot C5 : moteur pur du bilan de promotion (valorisation).
// Aucune écriture, aucun accès réseau. Les pourcentages ne sont jamais moyennés : tout se somme en euros.
// Quatre prix, jamais confondus : PMP Decenium avant promotion, PMP Decenium actualisé,
// PA promo négocié, PA facturé. Méthode Campagne (FIFO analytique) : analyse commerciale,
// elle ne reflète ni l'ordre physique de vente ni la valorisation Decenium.
// Inclure : <script src="nexus-campagne-bilan.js?v=20261115-1"></script>
// ============================================================
(function (global) {
  'use strict';

  const LIBELLE_PMP = 'PMP Decenium';
  const LIBELLE_METHODE = 'Méthode Campagne (FIFO analytique) : analyse commerciale, ne reflète ni l\'ordre physique de vente ni la valorisation Decenium';

  const num = v => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v));
  const arrondi = v => (v === null ? null : Math.round(v * 100) / 100);
  const jour = d => (d ? String(d).slice(0, 10) : '');

  // Ordre chronologique des livraisons : date_livraison, puis cree_le.
  function ordonnerLivraisons(livraisons) {
    return (livraisons || []).slice().sort((a, b) => {
      const da = jour(a.date_livraison), db = jour(b.date_livraison);
      if (da !== db) return da < db ? -1 : 1;
      const ca = String(a.cree_le || ''), cb = String(b.cree_le || '');
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
  }

  // Fiabilité du PMP avant promotion. ref = { pmp_ht, date_reference } (version courante) ou null.
  // Fiable : date_reference <= date_debut ET strictement antérieure à la première livraison promo valide.
  function fiabiliteReference(ref, dateDebut, premiereLivraison) {
    if (!ref || num(ref.pmp_ht) === null) return { statut: 'absent', raison: 'PMP avant promotion absent' };
    const dr = jour(ref.date_reference);
    if (!dr || (dateDebut && dr > jour(dateDebut)) || (premiereLivraison && dr >= jour(premiereLivraison))) {
      return { statut: 'a_confirmer', raison: 'référence à confirmer' };
    }
    return { statut: 'fiable', raison: null };
  }

  // Imputation FIFO analytique : seule fonction à modifier si la règle change.
  // Entrée : stockDepart { unites, pmp }, livraisons [{ unites, pa_ht_facture, pa_promo_ht, date_livraison, cree_le }], unitesVendues.
  // Sortie : coût des ventes, stock promo restant par lot, excédent non valorisé, drapeaux « estimée ».
  function imputerFifo(entree) {
    const e = entree || {};
    const lots = [];
    const sd = e.stockDepart || {};
    if (num(sd.unites) > 0) lots.push({ origine: 'stock_depart', unites: num(sd.unites), pa: num(sd.pmp), estime: false });
    ordonnerLivraisons(e.livraisons).forEach(l => {
      const u = num(l.unites);
      if (!(u > 0)) return;
      const facture = num(l.pa_ht_facture);
      const pa = facture !== null ? facture : num(l.pa_promo_ht);
      lots.push({ origine: 'livraison', unites: u, pa, estime: facture === null });
    });
    let aImputer = Math.max(0, num(e.unitesVendues) || 0);
    let cout = 0, sansPrix = 0;
    const raisons = [];
    for (const lot of lots) {
      if (aImputer <= 0) break;
      const prises = Math.min(lot.unites, aImputer);
      lot.unites -= prises;
      aImputer -= prises;
      if (lot.pa === null) sansPrix += prises; else cout += prises * lot.pa;
      if (lot.estime) raisons.push('livraison sans PA facturé : valorisée au PA promo négocié');
      if (lot.pa === null) raisons.push(lot.origine === 'stock_depart' ? 'PMP avant promotion absent' : 'PA de livraison inconnu');
    }
    const excedent = aImputer;
    if (excedent > 0) raisons.push('ventes supérieures au stock de départ et aux livraisons : coût des unités en excédent inconnu');
    const restant = lots.filter(l => l.unites > 0).map(l => ({ origine: l.origine, unites: l.unites, pa: l.pa, estime: l.estime }));
    if (restant.some(l => l.estime)) raisons.push('stock restant valorisé au PA promo négocié');
    return {
      cout_ventes: arrondi(cout),
      unites_sans_prix: sansPrix,
      excedent_unites: excedent,
      restant,
      estimee: raisons.length > 0,
      raisons: Array.from(new Set(raisons)),
    };
  }

  // Bilan d'un article : cinq grandeurs distinctes, jamais additionnées entre elles.
  // a = { ca_ht_promo, unitesVendues, pmp_avant (objet ref), pmp_actualise, pa_promo_negocie, pv_habituel_ht,
  //       ventes_ref_jour, jours_couverts, date_debut, stockDepart {unites}, livraisons [...] }
  function bilanArticle(a) {
    const ref = a.pmp_avant || null;
    const premiere = ordonnerLivraisons(a.livraisons)[0];
    const fiab = fiabiliteReference(ref, a.date_debut, premiere && premiere.date_livraison);
    const pmpUtilisable = fiab.statut === 'fiable' ? num(ref.pmp_ht) : (fiab.statut === 'a_confirmer' ? num(ref.pmp_ht) : null);
    const fifo = imputerFifo({
      stockDepart: { unites: a.stockDepart && a.stockDepart.unites, pmp: pmpUtilisable },
      livraisons: a.livraisons,
      unitesVendues: a.unitesVendues,
    });
    const raisons = fifo.raisons.slice();
    if (fiab.raison) raisons.push(fiab.raison);
    const ca = num(a.ca_ht_promo);
    const pvHab = num(a.pv_habituel_ht);

    const marge = ca === null ? null : arrondi(ca - fifo.cout_ventes);
    if (ca === null) raisons.push('chiffre d\'affaires de la promotion absent');
    let margeRef = null;
    if (pmpUtilisable !== null && pvHab !== null && num(a.ventes_ref_jour) !== null && num(a.jours_couverts) !== null) {
      margeRef = arrondi(num(a.ventes_ref_jour) * num(a.jours_couverts) * (pvHab - pmpUtilisable));
    } else raisons.push('marge de référence incalculable');
    const gain = marge !== null && margeRef !== null ? arrondi(marge - margeRef) : null;

    const unitesRestantes = fifo.restant.reduce((s, l) => s + l.unites, 0);
    const valeurRestante = fifo.restant.every(l => l.pa !== null)
      ? arrondi(fifo.restant.reduce((s, l) => s + l.unites * l.pa, 0)) : null;
    // Économie d'achat : sur le stock restant seulement (les unités vendues l'ont déjà dans le coût FIFO).
    let economie = null;
    if (pmpUtilisable !== null && fifo.restant.every(l => l.pa !== null)) {
      economie = arrondi(fifo.restant.reduce((s, l) => s + (l.origine === 'livraison' ? l.unites * (pmpUtilisable - l.pa) : 0), 0));
    }
    // Marge supplémentaire potentielle : le gain d'achat est déjà inclus, jamais ajouté à (4).
    let potentielle = null;
    if (pvHab !== null && fifo.restant.every(l => l.pa !== null)) {
      potentielle = arrondi(fifo.restant.reduce((s, l) => s + l.unites * (pvHab - l.pa), 0));
    }
    return {
      libelle_prix: LIBELLE_PMP,
      methode: LIBELLE_METHODE,
      prix: {
        pmp_avant_promotion: ref ? num(ref.pmp_ht) : null,
        pmp_actualise: num(a.pmp_actualise),
        pa_promo_negocie: num(a.pa_promo_negocie),
      },
      reference: fiab,
      marge_promotion: marge,
      gain_perte_vs_habituel: gain,
      marge_reference: margeRef,
      stock_restant: { unites: unitesRestantes, valeur_ht: valeurRestante, lots: fifo.restant },
      economie_achat_stock_restant: economie,
      marge_potentielle_apres: potentielle,
      dont_economie_achat: economie,
      cout_ventes: fifo.cout_ventes,
      excedent_unites: fifo.excedent_unites,
      estimee: raisons.length > 0,
      raisons: Array.from(new Set(raisons)),
    };
  }

  // Totaux : somme des composantes en euros, par grandeur. Aucun total ne cumule (1) + (4) + (5).
  function totaux(bilans) {
    const somme = cle => {
      const vals = (bilans || []).map(b => b[cle]);
      if (vals.some(v => v === null || v === undefined)) return null;
      return arrondi(vals.reduce((s, v) => s + v, 0));
    };
    return {
      marge_promotion: somme('marge_promotion'),
      gain_perte_vs_habituel: somme('gain_perte_vs_habituel'),
      stock_restant_valeur_ht: (bilans || []).some(b => b.stock_restant.valeur_ht === null) ? null
        : arrondi((bilans || []).reduce((s, b) => s + b.stock_restant.valeur_ht, 0)),
      economie_achat_stock_restant: somme('economie_achat_stock_restant'),
      marge_potentielle_apres: somme('marge_potentielle_apres'),
      estimee: (bilans || []).some(b => b.estimee),
    };
  }

  // Économie attendue d'une recommandation d'achat : informative, la quantité recommandée ne change pas.
  function economieAttendue(quantiteRecommandee, ref, paPromoNegocie, dateDebut, premiereLivraison) {
    const q = num(quantiteRecommandee), pa = num(paPromoNegocie);
    if (q === null || pa === null || !ref || num(ref.pmp_ht) === null) return null;
    const fiab = fiabiliteReference(ref, dateDebut, premiereLivraison);
    return { montant_ht: arrondi(q * (num(ref.pmp_ht) - pa)), indicative: fiab.statut !== 'fiable' };
  }

  global.NexusCampagneBilan = {
    LIBELLE_PMP, LIBELLE_METHODE, ordonnerLivraisons, fiabiliteReference, imputerFifo, bilanArticle, totaux, economieAttendue,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneBilan;
})(typeof window !== 'undefined' ? window : globalThis);
