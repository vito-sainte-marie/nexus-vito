// NEXUS Inventaire — lecture des exports Decenium (L2a, 05/11/2026).
//
// Les exports Ventes et Stock actuel de Decenium sont des tableaux HTML
// enregistrés en .xls : nombres à virgule française ("3,00", "-3 792,00"),
// codes-barres en texte avec espace insécable. Lus par SheetJS sans option,
// "3,00" devient 300 et "-3 792,00" reste du texte. Ce module porte la
// lecture sûre (cellules brutes + conversion décimale française) et le
// rapprochement du stock par libellé, qui n'a pas de code-barres.
//
// Règle : jamais de devinette. Un libellé absent, ambigu ou en stock négatif
// reste non rapproché et est signalé.

(function (global) {
  'use strict';

  // Stock négatif : exclu de la comparaison. null = toutes les catégories ;
  // un tableau limite l'exclusion aux catégories nommées.
  const STOCK_NEGATIF_CATEGORIES_EXCLUES_DEFAUT = null;

  function nombreDecenium(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/[\s ]/g, '').replace(',', '.');
    if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }

  function normaliserEntete(v) {
    return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Valeur de la première colonne dont l'en-tête, accents et casse ignorés,
  // correspond à l'un des noms demandés.
  function valeurColonne(ligne, noms) {
    const voulus = noms.map(normaliserEntete);
    for (const cle of Object.keys(ligne || {})) {
      if (voulus.indexOf(normaliserEntete(cle)) !== -1 && ligne[cle] !== null && ligne[cle] !== '') return ligne[cle];
    }
    return null;
  }

  const ENTETES_LIBELLE = ['lib article', 'libelle', 'designation'];
  const ENTETES_CATEGORIE = ['categ', 'categorie'];
  const ENTETES_STOCK = ['stock actuel', 'stock', 'qte stock'];

  function lireLigneStock(ligne) {
    const libelle = valeurColonne(ligne, ENTETES_LIBELLE);
    const categorie = valeurColonne(ligne, ENTETES_CATEGORIE);
    const code = valeurColonne(ligne, ['code barres']);
    return {
      libelle: String(libelle || '').trim(),
      categorie: String(categorie || '').trim(),
      codeBarres: code ? String(code).replace(/[\s ]/g, '') : null,
      quantite: nombreDecenium(valeurColonne(ligne, ENTETES_STOCK)),
      prixAchatHt: nombreDecenium(valeurColonne(ligne, ['pa net ht', 'pa ht'])),
    };
  }

  function cleLibelle(normaliser, categorie, libelle) {
    return normaliser(categorie) + '|' + normaliser(libelle);
  }

  // Libellé+catégorie -> code-barres, tiré des lignes Ventes qui en portent un.
  // Deux codes différents pour une même clé : la clé est écartée.
  function indexerCodesBarresVentes(lignesVentes, normaliser, normaliserCode) {
    const index = new Map();
    const conflits = new Set();
    (lignesVentes || []).forEach(l => {
      const libelle = valeurColonne(l, ENTETES_LIBELLE);
      const cb = normaliserCode(valeurColonne(l, ['code barres']));
      if (!libelle || !cb) return;
      const cle = cleLibelle(normaliser, valeurColonne(l, ENTETES_CATEGORIE), libelle);
      if (index.has(cle) && index.get(cle) !== cb) conflits.add(cle);
      index.set(cle, cb);
    });
    conflits.forEach(c => index.delete(c));
    return index;
  }

  function negatifExclu(quantite, categorie, categoriesExclues) {
    if (quantite === null || quantite >= 0) return false;
    if (!categoriesExclues) return true;
    return categoriesExclues.some(c => normaliserEntete(c) === normaliserEntete(categorie));
  }

  // Rapproche les lignes du stock avec le catalogue. Ordre : code-barres du
  // stock (s'il existe), puis code-barres porté par la ligne Ventes de même
  // libellé et catégorie. Chaque ligne reçoit un `motif` quand elle n'est pas
  // rapprochée : 'libelle_ambigu', 'stock_negatif', 'quantite_illisible',
  // 'inconnu'.
  function rapprocherStockDecenium(lignesStock, lignesVentes, produits, options) {
    const { normaliser, normaliserCode, categoriesNegatifsExclues } = options;
    const parCodeBarres = new Map();
    produits.forEach(p => { const cb = normaliserCode(p.code_barres); if (cb) parCodeBarres.set(cb, p); });
    const codesVentes = indexerCodesBarresVentes(lignesVentes, normaliser, normaliserCode);

    const lues = (lignesStock || []).map(lireLigneStock);
    const compte = new Map();
    lues.forEach(l => { const k = cleLibelle(normaliser, l.categorie, l.libelle); compte.set(k, (compte.get(k) || 0) + 1); });

    return lues.map(l => {
      const cle = cleLibelle(normaliser, l.categorie, l.libelle);
      let produit = null;
      let motif = null;
      if (l.quantite === null) motif = 'quantite_illisible';
      else if (negatifExclu(l.quantite, l.categorie, categoriesNegatifsExclues)) motif = 'stock_negatif';
      else {
        const cb = normaliserCode(l.codeBarres) || (compte.get(cle) === 1 ? codesVentes.get(cle) : null);
        if (compte.get(cle) > 1) motif = 'libelle_ambigu';
        else if (cb && parCodeBarres.has(cb)) produit = parCodeBarres.get(cb);
        else if (options.resoudreAlias) produit = options.resoudreAlias(l.libelle, produits) || null;
        if (!produit && !motif) motif = 'inconnu';
      }
      return {
        designation_brute: l.libelle,
        categorie_brute: l.categorie,
        code_barres_brut: l.codeBarres,
        quantite_stock: l.quantite === null ? 0 : l.quantite,
        prix_achat_ht: l.prixAchatHt,
        produit_id: produit ? produit.id : null,
        designation_matchee: produit ? produit.designation : null,
        motif,
      };
    });
  }

  // Pour chaque article vendu : retrouvé au stock ou non, et pourquoi.
  // `lignesStockRapprochees` vient de rapprocherStockDecenium.
  function bilanArticlesVendus(lignesVentes, lignesStockRapprochees, normaliser) {
    const parCle = new Map();
    lignesStockRapprochees.forEach(l => {
      const k = cleLibelle(normaliser, l.categorie_brute, l.designation_brute);
      if (!parCle.has(k)) parCle.set(k, []);
      parCle.get(k).push(l);
    });
    const retrouves = []; const aVerifier = [];
    (lignesVentes || []).forEach(v => {
      const libelle = String(valeurColonne(v, ENTETES_LIBELLE) || '').trim();
      if (!libelle) return;
      const trouvees = parCle.get(cleLibelle(normaliser, valeurColonne(v, ENTETES_CATEGORIE), libelle)) || [];
      if (!trouvees.length) aVerifier.push({ libelle, raison: 'absent du stock' });
      else if (trouvees.length > 1) aVerifier.push({ libelle, raison: trouvees.length + ' lignes au stock' });
      else if (trouvees[0].motif === 'stock_negatif') aVerifier.push({ libelle, raison: 'stock négatif au fichier' });
      else if (!trouvees[0].produit_id) aVerifier.push({ libelle, raison: 'absent du catalogue' });
      else retrouves.push(libelle);
    });
    return { nbVendus: retrouves.length + aVerifier.length, nbRetrouves: retrouves.length, aVerifier };
  }

  global.NexusInventaireDeceniumLecture = {
    STOCK_NEGATIF_CATEGORIES_EXCLUES_DEFAUT,
    nombreDecenium, valeurColonne, lireLigneStock,
    indexerCodesBarresVentes, rapprocherStockDecenium, bilanArticlesVendus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
