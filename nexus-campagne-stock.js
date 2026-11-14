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
  // Une seule fonction de clé pour tout : l'alias résolu, sinon le nom lui-même.
  function cleResolue(resoudre) { return s => cle((resoudre ? resoudre(s) : null) || s); }
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function dateLongue(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? (+m[3]) + (m[3] === '01' ? 'er' : '') + ' ' + MOIS[+m[2] - 1] : 'inconnue';
  }

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
    const cle = cleResolue(resoudre);
    const dep = stockDepartCourant(stockDepart, cle);
    const valides = new Map(livraisonsValides(livraisons, annulations).map(l => [l.id, l]));
    // Une livraison compte seulement si elle est datée strictement après le stock de départ de l'article.
    // Le jour même, on ne sait pas si elle est déjà dans le stock compté : elle est signalée, pas comptée.
    // C2 : le stock est daté au dernier point de ventes valide. Une livraison après cette date n'est pas retirée
    // des ventes qu'on ne connaît pas : elle est montrée à part, jamais mêlée au stock.
    const dv = String(dateVentes || '').slice(0, 10);
    const livre = new Map();
    const memeJour = new Map();
    const apres = new Map();
    const apresDate = new Map();
    (lignesLivraison || []).filter(l => valides.has(l.livraison_id)).forEach(l => {
      const k = cle(l.article);
      const d = dep.get(k);
      const dl = String(valides.get(l.livraison_id).date_livraison || '').slice(0, 10);
      const dd = d ? String(d.date_stock || '').slice(0, 10) : '';
      if (d && dl && dd && dl < dd) return;
      if (d && dl && dd && dl === dd) { memeJour.set(k, (memeJour.get(k) || 0) + Number(l.unites || 0)); return; }
      if (dv && dl && dl > dv) {
        apres.set(k, (apres.get(k) || 0) + Number(l.unites || 0));
        if (!apresDate.has(k) || dl > apresDate.get(k)) apresDate.set(k, dl);
        return;
      }
      livre.set(k, (livre.get(k) || 0) + Number(l.unites || 0));
    });
    const vendu = new Map();
    (ventes || []).forEach(v => vendu.set(cle(v.article), (vendu.get(cle(v.article)) || 0) + Number(v.quantite || 0)));
    return (articles || []).map(article => {
      const k = cle(article);
      const d = dep.get(k);
      if (!d) return { article, stock: null, manque_depart: true, a_confirmer: true, fiable_pour_achat: false, sources: [], libelle: 'Stock théorique' };
      const jours = ecartDepart(d.date_stock, campagneDebut);
      const base = {
        article,
        manque_depart: false,
        date_depart: String(d.date_stock).slice(0, 10),
        jours_non_couverts: jours,
        livraison_meme_jour_a_verifier: memeJour.get(k) || 0,
        livraisons_apres_ventes: apres.get(k) || 0,
        livraisons_apres_ventes_date: apresDate.get(k) || null,
        libelle: 'Stock théorique',
      };
      // Sans import de ventes, aucun chiffre : retirer zéro vente donnerait un stock faux et rassurant.
      if (!dv) {
        return Object.assign(base, { stock: null, non_calculable: true, a_confirmer: true, fiable_pour_achat: false, sources: [] });
      }
      const aConfirmer = !!d.a_confirmer || jours > 0 || memeJour.has(k);
      return Object.assign(base, {
        stock: Number(d.quantite) + (livre.get(k) || 0) - (vendu.get(k) || 0),
        non_calculable: false,
        a_confirmer: aConfirmer,
        fiable_pour_achat: !aConfirmer && !apres.has(k),
        sources: ['stock de départ du ' + dateLongue(d.date_stock) + ' (' + String(d.source || '').replace(/_/g, ' ') + ')', 'livraisons valides jusqu\u2019au ' + dateLongue(dv), 'ventes au ' + dateLongue(dv)],
      });
    });
  }

  // C3 : choix du relevé par article. Chaque article garde la date et la référence de SON relevé le plus récent.
  // Un relevé postérieur au début de la campagne n'est pas repris : il est signalé (`posterieurs`), à proposer explicitement.
  // Source : `comptage` si une quantité réelle est saisie, sinon `releve_theorique_decenium` (jamais présentée comme un comptage).
  // Appariement (décision de Frédéric, 14/11) : la désignation exacte par défaut, le code-barres seulement en cas de confusion.
  // Confusion : (a) plusieurs relevés de même désignation avec des EAN différents ; (b) l'EAN du relevé trouvé par le nom diffère de
  // l'EAN connu de l'article (`eanDe`) ; (c) aucune désignation exacte, mais un relevé porte l'EAN de l'article.
  // En confusion, le relevé de même EAN est retenu (`rapproche_par: 'code_barres'`). Sans EAN utilisable, sans EAN concordant, ou avec
  // plusieurs relevés du même EAN à la même date : aucun rapprochement, l'article va dans `sans` et dans `a_verifier`.
  // Jamais d'approximation : deux désignations voisines sans EAN commun restent distinctes.
  function choisirReleves(releves, { articles, campagneDebut, resoudre, eanDe } = {}) {
    const cle = cleResolue(resoudre);
    const ean = v => { const x = String(v == null ? '' : v).replace(/\D/g, ''); return x.length >= 8 ? x : null; };
    const deb = String(campagneDebut || '').slice(0, 10);
    const parArticle = new Map();
    const parEan = new Map();
    const ajout = (m, k, x) => { if (!m.has(k)) m.set(k, []); m.get(k).push(x); };
    (releves || []).forEach(r => {
      const date = String(r.releve_le || '').slice(0, 10);
      if (!date) return;
      const x = { r, date, ean: ean(r.code_barres) };
      ajout(parArticle, cle(r.article), x);
      if (x.ean) ajout(parEan, x.ean, x);
    });
    const tri = l => l.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const retenus = [], posterieurs = [], sans = [], aVerifier = [];
    (articles || []).forEach(article => {
      const eA = eanDe ? ean(eanDe(article)) : null;
      const parNom = parArticle.get(cle(article)) || [];
      const eansNom = new Set(parNom.map(x => x.ean).filter(Boolean));
      const confusion = parNom.length
        ? (eansNom.size > 1 || (!!eA && eansNom.size === 1 && !eansNom.has(eA)))
        : !!(eA && parEan.get(eA));
      let liste = parNom, mode = 'nom';
      if (confusion) {
        liste = eA ? (parEan.get(eA) || []) : [];
        mode = 'code_barres';
        if (!liste.length) { sans.push(article); aVerifier.push(article); return; }
      }
      liste = tri(liste);
      if (!liste.length) { sans.push(article); return; }
      const reprise = liste.find(x => !deb || x.date <= deb);
      const poster = liste.find(x => deb && x.date > deb);
      const ambigu = x => x && liste.filter(y => y.date === x.date).length > 1 && mode === 'code_barres';
      if (ambigu(reprise) || ambigu(poster)) { sans.push(article); aVerifier.push(article); return; }
      const fabrique = x => {
        const reel = x.r.quantite_reelle != null;
        return { article, quantite: Number(reel ? x.r.quantite_reelle : x.r.quantite_theorique), date: x.date, reference: x.r.id || null,
          source: reel ? 'comptage' : 'releve_theorique_decenium',
          libelle_source: reel ? 'comptage' : 'quantité théorique Decenium',
          rapproche_par: mode };
      };
      if (poster) posterieurs.push(fabrique(poster));
      if (reprise) retenus.push(fabrique(reprise)); else sans.push(article);
    });
    return { retenus, posterieurs, sans, a_verifier: aVerifier };
  }

  // Articles de la promotion sans stock de départ, avec la même clé que le calcul du stock.
  function articlesSansDepart(articles, stockDepart, resoudre) {
    const k = cleResolue(resoudre);
    const dep = stockDepartCourant(stockDepart, k);
    return (articles || []).filter(a => !dep.has(k(a)));
  }

  // Signal : un carton complet dépasse nettement le besoin. `seuil` = part du carton qui resterait en surplus (à valider, 0,5 par défaut).
  // L'arrondi au carton supérieur ne change pas : c'est une alerte, pas une correction.
  function cartonDepasseBesoin(besoinUnites, cond, seuil) {
    if (!cond || cond.aRenseigner || cond.source === 'a_l_unite' || !(cond.unitesParCarton > 0)) return false;
    const b = Math.max(0, Math.ceil(Number(besoinUnites || 0)));
    if (!(b > 0)) return false;
    const surplus = Math.ceil(b / cond.unitesParCarton) * cond.unitesParCarton - b;
    return surplus / cond.unitesParCarton > (seuil == null ? 0.5 : seuil);
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
    livraisonsInventaireNonComptees, choisirReleves, stockTheorique, arrondirAchat, cartonDepasseBesoin, cleResolue, dateLongue, articlesSansDepart,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneStock;
})(typeof window !== 'undefined' ? window : globalThis);
