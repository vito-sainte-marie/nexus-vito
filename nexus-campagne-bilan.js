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
  const frDate = d => { const j = jour(d); return j ? j.slice(8, 10) + '/' + j.slice(5, 7) + '/' + j.slice(0, 4) : '?'; };

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
      lots.push({ origine: 'livraison', unites: u, pa, estime: facture === null, date_livraison: l.date_livraison || null });
    });
    const consommes = [];
    let aImputer = Math.max(0, num(e.unitesVendues) || 0);
    let cout = 0, sansPrix = 0;
    const raisons = [];
    for (const lot of lots) {
      if (aImputer <= 0) break;
      const prises = Math.min(lot.unites, aImputer);
      lot.unites -= prises;
      aImputer -= prises;
      consommes.push({ origine: lot.origine, unites: prises, pa: lot.pa, estime: lot.estime, date_livraison: lot.date_livraison || null });
      if (lot.pa === null) sansPrix += prises; else cout += prises * lot.pa;
      if (lot.estime) raisons.push('livraison sans PA facturé : valorisée au PA promo négocié');
      if (lot.pa === null) raisons.push(lot.origine === 'stock_depart' ? 'PMP avant promotion absent' : 'PA de livraison inconnu');
    }
    const excedent = aImputer;
    // Livraisons reçues après le dernier point de ventes : jamais consommées par des ventes connues, elles entrent dans le stock restant.
    ordonnerLivraisons(e.livraisonsApres).forEach(l => {
      const u = num(l.unites);
      if (!(u > 0)) return;
      const facture = num(l.pa_ht_facture);
      lots.push({ origine: 'livraison', unites: u, pa: facture !== null ? facture : num(l.pa_promo_ht), estime: facture === null, apres: true });
    });
    if (excedent > 0) raisons.push('ventes supérieures au stock de départ et aux livraisons : coût des unités en excédent inconnu');
    const restant = lots.filter(l => l.unites > 0).map(l => ({ origine: l.origine, unites: l.unites, pa: l.pa, estime: l.estime, apres: !!l.apres }));
    if (restant.some(l => l.estime)) raisons.push('stock restant valorisé au PA promo négocié');
    return {
      cout_ventes: arrondi(cout),
      unites_sans_prix: sansPrix,
      excedent_unites: excedent,
      consommes,
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
      livraisonsApres: a.livraisonsApres,
      unitesVendues: a.unitesVendues,
    });
    const raisons = fifo.raisons.slice();
    const mentions = [];
    (a.livraisonsApres || []).forEach(l => { if (num(l.unites) > 0) mentions.push('reçue après les ventes au ' + frDate(a.date_ventes) + ' : ' + num(l.unites) + ' unités dans le stock restant'); });
    if (num(a.unites_meme_jour) > 0) raisons.push('livraison du jour du stock de départ, à vérifier : ' + num(a.unites_meme_jour) + ' unités non imputées');
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
      unites_vendues: num(a.unitesVendues),
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
      unites_sans_prix: fifo.unites_sans_prix,
      consommes: fifo.consommes,
      estimee: raisons.length > 0,
      raisons: Array.from(new Set(raisons)),
      mentions: Array.from(new Set(mentions)),
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


  // Version courante par article (plus grande version).
  function derniersParArticle(rows) {
    const m = new Map();
    (rows || []).forEach(r => { const a = m.get(r.article); if (!a || Number(r.version) > Number(a.version)) m.set(r.article, r); });
    return m;
  }
  const joursEntre = (a, b) => Math.round((Date.UTC(+jour(b).slice(0, 4), +jour(b).slice(5, 7) - 1, +jour(b).slice(8, 10)) - Date.UTC(+jour(a).slice(0, 4), +jour(a).slice(5, 7) - 1, +jour(a).slice(8, 10))) / 86400000);

  // Assemble les entrées du bilan, article par article, depuis les lignes lues en base. Fonction pure.
  // d : { campagne, objectifs, depart, livraisons (déjà valides), lignesLivraison, point ({date_fin, lignes}), pmp (toutes versions), actualises (Map article -> prix_achat) }
  function assemblerEntrees(d) {
    const objs = derniersParArticle(d.objectifs), deps = derniersParArticle(d.depart), refs = derniersParArticle(d.pmp);
    const liv = new Map((d.livraisons || []).map(l => [l.id, l]));
    const lignesPoint = new Map(((d.point && d.point.lignes) || []).map(l => [l.article, l]));
    const joursCouverts = d.point ? Math.max(0, joursEntre(d.campagne.date_debut, d.point.date_fin) + 1) : null;
    return Array.from(objs.values()).map(o => {
      const dep = deps.get(o.article), pt = lignesPoint.get(o.article);
      const dd = jour(dep && dep.date_stock), dv = d.point ? jour(d.point.date_fin) : '';
      const lv = [], apres = [];
      let memeJour = 0;
      (d.lignesLivraison || []).filter(l => l.article === o.article && liv.has(l.livraison_id)).forEach(l => {
        const v = { unites: l.unites, pa_ht_facture: l.pa_ht_facture, pa_promo_ht: o.pa_promo_ht,
          date_livraison: liv.get(l.livraison_id).date_livraison, cree_le: liv.get(l.livraison_id).cree_le };
        const dl = jour(v.date_livraison);
        if (dep && dl && dd && dl < dd) return;
        if (dep && dl && dd && dl === dd) { memeJour += Number(l.unites || 0); return; }
        if (dv && dl && dl > dv) { apres.push(v); return; }
        lv.push(v);
      });
      const tva = num(o.tva_pct), ttc = num(o.pv_habituel_ttc);
      const act = d.actualises && d.actualises.get ? d.actualises.get(o.article) : null;
      return {
        article: o.article, date_debut: d.campagne.date_debut,
        pmp_avant: refs.get(o.article) || null, pmp_actualise: act === undefined ? null : act,
        pa_promo_negocie: o.pa_promo_ht,
        stockDepart: { unites: dep ? dep.quantite : 0, a_confirmer: !!(dep && dep.a_confirmer), date_stock: dep ? dep.date_stock || null : null },
        livraisons: lv, livraisonsApres: apres, unites_meme_jour: memeJour, date_ventes: dv || null, unitesVendues: pt ? pt.quantite : 0, ca_ht_promo: pt ? pt.ca_ht : (d.point ? 0 : null),
        ca_estime: !!(pt && pt.ca_estime),
        pv_habituel_ht: ttc === null ? null : (tva === null ? null : ttc / (1 + tva / 100)),
        ventes_ref_jour: o.ventes_ref_jour, jours_couverts: joursCouverts,
        pa_habituel_objectif: o.pa_habituel_ht,
      };
    });
  }

  // Dernière annulation d'un import de ventes : le bilan en est recalculé. { le, import_du } ou null.
  function derniereAnnulation(points, annulations) {
    const importe = new Map();
    (points || []).forEach(p => { if (!importe.has(p.batch_id)) importe.set(p.batch_id, p.importe_le); });
    const a = (annulations || []).filter(x => importe.has(x.batch_id) && x.annule_le)
      .sort((x, y) => String(y.annule_le).localeCompare(String(x.annule_le)))[0];
    return a ? { le: a.annule_le, import_du: importe.get(a.batch_id) || null } : null;
  }

  // Bilan d'une campagne : un bilan par article, plus les totaux par grandeur.
  function bilanCampagne(d) {
    const entrees = assemblerEntrees(d);
    const articles = entrees.map(e => {
      const b = bilanArticle(e);
      const raisons = b.raisons.slice();
      if (e.stockDepart.a_confirmer) raisons.push('stock de départ à confirmer');
      if (e.ca_estime) raisons.push('chiffre d\'affaires estimé');
      return Object.assign({ article: e.article }, b, { raisons: Array.from(new Set(raisons)), estimee: raisons.length > 0 });
    });
    const rc = d.recalcul || null;
    return { articles, totaux: totaux(articles), arrete_au: d.point ? d.point.date_fin : null,
      recalcule: rc ? { le: jour(rc.le), import_du: jour(rc.import_du),
        texte: 'Recalculé le ' + frDate(rc.le) + ' après annulation de l\'import du ' + frDate(rc.import_du) } : null,
      pertes: 'pertes non renseignées' };
  }

  // Lecture en base (aucune écriture). SC / CV : modules stock et ventes.
  async function chargerBilan(client, site, campagne, SC, CV) {
    const q = t => client.from(t);
    const ob = await q('campagne_objectifs_produits').select('article, version, pa_habituel_ht, pa_promo_ht, pv_habituel_ttc, tva_pct, ventes_ref_jour').eq('campagne_id', campagne.id).eq('site', site);
    const articlesCampagne = (ob.data || []).map(o => o.article);
    const r = await Promise.all([
      Promise.resolve(ob),
      q('campagne_stock_depart').select('article, version, quantite, a_confirmer, date_stock').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_livraisons').select('id, date_livraison, remplace_livraison_id, cree_le').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_livraisons_annulations').select('livraison_id').eq('site', site),
      q('campagne_livraison_lignes').select('livraison_id, article, unites, pa_ht_facture').eq('site', site),
      q('campagne_ventes_points').select('batch_id, article, date_fin, importe_le, quantite, ca_ht, ca_estime').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_ventes_annulations').select('batch_id, annule_le').eq('site', site),
      q('campagne_pmp_reference').select('article, version, pmp_ht, date_reference').eq('campagne_id', campagne.id).eq('site', site),
      q('products').select('article, prix_achat, periode_fin').eq('site', site).in('article', Array.from(new Set(articlesCampagne))).not('prix_achat', 'is', null).order('periode_fin', { ascending: false }),
    ]);
    r.forEach(x => { if (x.error) console.error('bilan', x.error); });
    const D = r.map(x => x.data || []);
    const actualises = new Map();
    D[8].forEach(p => { if (!actualises.has(p.article)) actualises.set(p.article, Number(p.prix_achat)); });
    return bilanCampagne({ campagne, objectifs: D[0], depart: D[1], livraisons: SC.livraisonsValides(D[2], D[3]), lignesLivraison: D[4],
      point: CV.pointCourant(D[5], D[6]), pmp: D[7], actualises, recalcul: derniereAnnulation(D[5], D[6]) });
  }

  global.NexusCampagneBilan = {
    LIBELLE_PMP, LIBELLE_METHODE, ordonnerLivraisons, fiabiliteReference, imputerFifo, bilanArticle, totaux, economieAttendue, assemblerEntrees, bilanCampagne, chargerBilan, derniereAnnulation,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneBilan;
})(typeof window !== 'undefined' ? window : globalThis);
