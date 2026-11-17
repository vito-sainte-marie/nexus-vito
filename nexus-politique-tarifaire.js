// ============================================================
// NEXUS Scanner, politique tarifaire T1 (moteur pur, LECTURE SEULE). Version 2 du 16/11/2026 :
// seuils indicatifs non décisionnels, régime de prix déclaré, matérialité A6, simulations insuffisantes en preuve technique.
// Examen du gérant du 16/11/2026 : APPROVED_WITH_CONDITIONS pour T1 uniquement.
// Aucun réseau, aucune écriture, aucune modification de prix, de coût, de TVA ni de données Decenium.
//   <script src="nexus-politique-tarifaire.js?v=20261116-t1"></script>   (navigateur)
//   const T = require('./nexus-politique-tarifaire.js');                 (Node, tests)
//
// analyser(lignesCourantes, lignesPrecedentes, contexte) rend, par référence :
//   - la famille commerciale et la règle applicable (prix décidé, exception, seuil de famille, de rayon ou par défaut) ;
//   - le coût AVEC sa provenance et sa méthode de valorisation (jamais appelé « PMP » sans preuve) ;
//   - la fiabilité COMPTABLE (fiable, à confirmer, insuffisante), sans aucun critère réglementaire ;
//   - la conformité RÉGLEMENTAIRE, axe indépendant (non concerné, contrôle ouvert, à compléter, conforme, non conforme) ;
//   - l'état d'application d'un prix décidé (décidé, saisie déclarée, cohérence constatée, application vérifiée, écart constaté) ;
//   - un statut parmi : à vérifier, proposition à valider, à surveiller, conforme, sans seuil validé ;
//   - les alertes A1 à A8 ; les simulations (prix décidés, minimum, cible) rangées dans UN SEUL compartiment par niveau de fiabilité.
// « Conforme » n'est jamais attribué sans règle applicable validée. Un prix n'est « appliqué » que sur preuve explicite.
// ============================================================
(function (global) {
  'use strict';

  const FIABILITE = { fiable: 'fiable', a_confirmer: 'a_confirmer', insuffisante: 'insuffisante' };
  const CONFORMITE = { non_concerne: 'non_concerne', controle_ouvert: 'controle_ouvert', a_completer: 'a_completer', conforme: 'conforme', non_conforme: 'non_conforme' };
  const STATUTS = { a_verifier: 'a_verifier', proposition_a_valider: 'proposition_a_valider', a_surveiller: 'a_surveiller', conforme: 'conforme', sans_seuil_valide: 'sans_seuil_valide' };
  const APPLICATION = { decide: 'decide', saisie_declaree: 'saisie_declaree', coherence_constatee: 'coherence_constatee', application_verifiee: 'application_verifiee', ecart_constate: 'ecart_constate', maintenu: 'maintenu' };
  // Statut d'un seuil : seul « valide » fonde une règle applicable. « a_l_etude » et « hypothese » sont affichés, jamais appliqués.
  // valide : décisionnel (peut fonder une proposition et le statut « conforme ») ;
  // indicatif : repère du gérant, comparé et signalé, jamais décisionnel ; a_l_etude, hypothese : affichés seulement.
  const STATUT_SEUIL = { valide: 'valide', indicatif: 'indicatif', a_l_etude: 'a_l_etude', hypothese: 'hypothese' };
  const ALERTES = {
    A1: { code: 'A1', libelle: 'Marge en baisse par hausse du coût', gravite: 'information', action: 'verifier' },
    A2: { code: 'A2', libelle: 'Référence sous son seuil', gravite: 'information', action: 'decider' },
    A3: { code: 'A3', libelle: 'Vente à marge négative', gravite: 'critique', action: 'verifier' },
    A4: { code: 'A4', libelle: 'Variation anormale de prix ou de coût', gravite: 'a_verifier', action: 'verifier' },
    A5: { code: 'A5', libelle: 'Incohérence entre sources', gravite: 'a_verifier', action: 'verifier' },
    A6: { code: 'A6', libelle: "Produit d'appel en dégradation", gravite: 'information', action: 'surveiller' },
    A7: { code: 'A7', libelle: 'Exception hors de ses conditions', gravite: 'a_verifier', action: 'decider' },
    A8: { code: 'A8', libelle: 'Contrôle réglementaire ouvert', gravite: 'critique', action: 'verifier' },
  };
  const REGLAGES_DEFAUT = {
    palierTtc: 0.05,                 // arrondi des prix envisageables, au palier TTC supérieur
    toleranceConstatTtc: 0.02,       // écart TTC admis entre PV moyen et prix décidé pour « cohérence constatée »
    variationNotable: 0.10, variationSuspecte: 0.50,
    ecartStockConfirmer: 0.05, ecartStockInsuffisant: 0.10,
    // A6, matérialité proposée et réglable : baisse du taux de plus de 2 points, ou baisse de marge unitaire d'au moins
    // 0,02 € ET d'au moins 5 % ; dans les deux cas, marge perdue estimée d'au moins 5 € sur la période.
    a6: { baissePoints: 0.02, baisseMargeUnitaireEuros: 0.02, baisseMargeUnitaireRelative: 0.05, montantMinimal: 5 },
    toleranceCoutException: 0.10,    // A7, condition proposée par défaut
    quantiteMinimale: 3, prixUnitaireBas: 0.50,
    joursReference: 30,
  };
  const COUT_DEFAUT = { libelle: 'PA HT', provenance: 'Export ventes Decenium, colonne « PA HT »', methode: null };

  const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const r2 = n => (n === null || n === undefined) ? null : Math.round(n * 100) / 100;
  const r4 = n => (n === null || n === undefined) ? null : Math.round(n * 10000) / 10000;
  const nom = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const cb = r => (r && r.code_barres ? String(r.code_barres).trim() : '');
  const jour = d => (d ? String(d).slice(0, 10) : null);
  const eur = n => (n === null || n === undefined) ? '' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

  // Arrondi au palier TTC supérieur, en centimes entiers pour éviter les erreurs de virgule flottante.
  function arrondiPalier(ttc, palier) {
    if (ttc === null || ttc === undefined || !Number.isFinite(ttc)) return null;
    const p = Math.round((palier || REGLAGES_DEFAUT.palierTtc) * 100);
    const cents = Math.round(ttc * 100 * 1e6) / 1e6;       // 479.99999999 → 480
    return Math.ceil(cents / p - 1e-9) * p / 100;
  }
  // Prix envisageable pour atteindre un seuil de taux de marque : coût / (1 − seuil), TVA ajoutée, arrondi au palier.
  function prixEnvisageable(cout, seuil, tva, palier) {
    if (cout === null || cout === undefined || seuil === null || seuil === undefined || seuil >= 1) return null;
    const t = (tva || 0) / 100;
    const ttc = arrondiPalier(cout / (1 - seuil) * (1 + t), palier);
    const ht = ttc / (1 + t);
    return { ttc, ht: r4(ht), taux: r4((ht - cout) / ht) };
  }

  // Correspondance d'une entrée de registre avec une ligne : code-barres si les deux en ont un, sinon libellé exact normalisé.
  function correspond(entree, row) {
    if (entree.code_barres && cb(row)) return String(entree.code_barres).trim() === cb(row);
    if (entree.article) return nom(entree.article) === nom(row.article);
    if (entree.rayon && entree.motif) return entree.rayon === row.categorie && new RegExp(entree.motif, 'i').test(row.article || '');
    if (entree.rayon) return entree.rayon === row.categorie;
    return false;
  }
  const premier = (liste, row) => (liste || []).find(e => correspond(e, row)) || null;

  function familleDe(row, cfg) {
    const f = cfg || {};
    const ref = (f.parReference || []).find(e => (e.code_barres || e.article) && correspond(e, row));
    if (ref) return { famille: ref.famille, source: 'reference', motif: ref.motif || null };
    const m = (f.parMotif || []).find(e => e.rayon === row.categorie && new RegExp(e.motif, 'i').test(row.article || ''));
    if (m) return { famille: m.famille, source: 'motif', motif: m.note || null };
    if (f.parRayon && f.parRayon[row.categorie]) return { famille: f.parRayon[row.categorie], source: 'rayon', motif: null };
    return { famille: null, source: 'aucune', motif: null };
  }

  // Seuil de famille, puis de rayon, puis par défaut. Un seuil par défaut non activé reste une hypothèse.
  function seuilDe(famille, rayon, ctx) {
    const s = (ctx.seuils && famille && ctx.seuils[famille]) ? { ...ctx.seuils[famille], niveau: 'famille' }
      : (ctx.seuilsRayon && ctx.seuilsRayon[rayon]) ? { ...ctx.seuilsRayon[rayon], niveau: 'rayon' }
      : ctx.seuilDefaut ? { ...ctx.seuilDefaut, niveau: 'defaut' } : null;
    if (!s) return null;
    const a = (v, st, attendu) => v !== null && v !== undefined && st === attendu;
    const minimumValide = a(s.minimum, s.statutMinimum, STATUT_SEUIL.valide), cibleValide = a(s.cible, s.statutCible, STATUT_SEUIL.valide);
    const minimumIndicatif = a(s.minimum, s.statutMinimum, STATUT_SEUIL.indicatif), cibleIndicative = a(s.cible, s.statutCible, STATUT_SEUIL.indicatif);
    return { ...s, minimumValide, cibleValide, minimumIndicatif, cibleIndicative, valide: minimumValide || cibleValide, indicatif: minimumIndicatif || cibleIndicative };
  }

  // TVA : règle partagée de NexusProduitsMesure si chargée, sinon règle identique ici. Une explication documentée
  // (exonération possible) fait passer une TVA non confirmée à « à confirmer » ; rien n'est corrigé.
  function etatTvaPartage(tva, tvaPrec, rayonTaxe, confirmation, exportLe) {
    const PM = global.NexusProduitsMesure;
    if (PM && PM.etatTva) return PM.etatTva(tva, tvaPrec, rayonTaxe, confirmation, exportLe);
    if (confirmation) {
      const c = num(confirmation.taux_confirme);
      if (tva !== null && tva !== c) return { etat: 'incoherente', taux: tva, raison: 'taux importé différent du taux confirmé' };
      return { etat: 'confirmee', taux: c, raison: 'TVA confirmée' };
    }
    if (tva === null) return { etat: 'incoherente', taux: null, raison: "TVA absente de l'import" };
    if (tvaPrec !== null && tvaPrec !== undefined && tvaPrec !== tva) return { etat: 'incoherente', taux: tva, raison: 'TVA différente sur la période précédente' };
    if (tva === 0 && rayonTaxe) return { etat: 'incoherente', taux: tva, raison: "TVA importée à 0 % alors que d'autres références du rayon sont taxées" };
    return { etat: 'importee', taux: tva, raison: 'TVA importée de Decenium, non confirmée' };
  }
  function controleTva(row, prec, rayonTaxe, ctx) {
    const tva = num(row.tva), tvaP = prec ? num(prec.tva) : null;
    const conf = premier(ctx.tva && ctx.tva.confirmations, row);
    const e = etatTvaPartage(tva, tvaP, rayonTaxe, conf, ctx.periode && ctx.periode.fin);
    if (e.etat === 'confirmee') return { taux: e.taux, etat: 'confirmee', raison: e.raison };
    const expl = (ctx.tva && ctx.tva.explications || []).find(x => correspond(x, row) && (x.taux === undefined || x.taux === tva));
    const changee = tvaP !== null && tvaP !== tva;
    if (expl && !changee) return { taux: tva, etat: 'a_confirmer', raison: expl.raison };
    if (e.etat === 'incoherente') return { taux: tva, etat: 'a_verifier', raison: e.raison };
    return { taux: tva, etat: 'coherente', raison: e.raison };
  }

  function indexer(rows) {
    const parCb = new Map(), parNom = new Map();
    for (const r of rows || []) { if (cb(r) && !parCb.has(cb(r))) parCb.set(cb(r), r); const k = nom(r.article); if (!parNom.has(k)) parNom.set(k, r); }
    return r => (cb(r) && parCb.get(cb(r))) || parNom.get(nom(r.article)) || null;
  }

  // État d'application d'un prix décidé. Le PV moyen ne prouve jamais à lui seul qu'un prix est appliqué.
  function suiviPrixDecide(pd, pvTtc, pvTtcPrec, periode, reglages) {
    const tol = reglages.toleranceConstatTtc;
    const s = { prix_ttc: pd.prix_ttc, nature: pd.nature || 'changement', decide_le: pd.decide_le || null,
      saisie_declaree_le: pd.saisie_declaree_le || null, preuve: pd.preuve_application || null,
      etat: APPLICATION.decide, periodeChevauchante: false, changementProbableEnCours: false, partEstimee: null, ecartTtc: null };
    if (s.nature === 'maintenu' || s.prix_ttc === null || s.prix_ttc === undefined) { s.etat = APPLICATION.maintenu; return s; }
    s.ecartTtc = pvTtc === null ? null : r2(pvTtc - s.prix_ttc);
    const coherent = pvTtc !== null && Math.abs(pvTtc - s.prix_ttc) <= tol + 1e-9;
    const debut = jour(periode && periode.debut), fin = jour(periode && periode.fin), saisie = jour(s.saisie_declaree_le);
    const entre = pvTtcPrec !== null && pvTtc !== null && Math.abs(s.prix_ttc - pvTtcPrec) > tol
      && ((pvTtc - pvTtcPrec) / (s.prix_ttc - pvTtcPrec)) > 0.02 && ((pvTtc - pvTtcPrec) / (s.prix_ttc - pvTtcPrec)) < 0.98;
    if (entre) s.partEstimee = r2((pvTtc - pvTtcPrec) / (s.prix_ttc - pvTtcPrec));
    if (saisie && debut && fin && saisie > debut && saisie <= fin) { s.periodeChevauchante = true; s.etat = APPLICATION.saisie_declaree; }
    else if (saisie && fin && saisie > fin) { s.etat = APPLICATION.saisie_declaree; }
    else if (coherent) { s.etat = APPLICATION.coherence_constatee; }
    else if (entre) { s.changementProbableEnCours = true; s.etat = saisie ? APPLICATION.saisie_declaree : APPLICATION.decide; }
    else if (saisie || s.nature === 'en_vigueur') { s.etat = APPLICATION.ecart_constate; }
    // Application vérifiée : uniquement sur preuve explicite (export de prix, ticket, relevé en rayon) datée au plus tard en fin de période,
    // et sans contradiction du PV moyen sur une période entièrement postérieure à la preuve.
    if (s.preuve && s.preuve.type && jour(s.preuve.date) && (!fin || jour(s.preuve.date) <= fin)) {
      const contredit = debut && jour(s.preuve.date) <= debut && pvTtc !== null && !coherent;
      s.etat = contredit ? APPLICATION.ecart_constate : APPLICATION.application_verifiee;
    }
    return s;
  }

  function analyser(courantes, precedentes, contexte) {
    const ctx = contexte || {};
    const R = { ...REGLAGES_DEFAUT, ...(ctx.reglages || {}) };
    const cout = { ...COUT_DEFAUT, ...(ctx.cout || {}) };
    const methodeEtablie = !!cout.methode;
    const prec = indexer(precedentes);
    const stock = indexer((ctx.stock || []).map(s => ({ article: s.article, code_barres: s.code_barres || '', pa: num(s.pa_net_ht) })));
    const taxe = new Map();
    for (const r of courantes || []) if (num(r.tva) > 0) taxe.set(r.categorie, (taxe.get(r.categorie) || 0) + 1);
    const debut = jour(ctx.periode && ctx.periode.debut), fin = jour(ctx.periode && ctx.periode.fin);
    const jours = num(ctx.jours) || (debut && fin ? Math.round((Date.parse(fin) - Date.parse(debut)) / 864e5) + 1 : null);

    const lignes = [];
    for (const row of courantes || []) {
      const q = num(row.quantite) || 0, pv = num(row.prix_vente), pa = num(row.prix_achat);
      const p = prec(row);
      const pvP = p ? num(p.prix_vente) : null, paP = p ? num(p.prix_achat) : null;
      const nature = (ctx.natureDe && ctx.natureDe(row)) || null;           // ex. 'sortie_perimes', 'operation_caisse'
      const commerciale = !nature;
      // Régime de prix : déclaré dans un registre (contexte.regimes) ou par une règle fournie ; jamais déduit d'un libellé ici.
      const regDecl = premier(ctx.regimes, row);
      const regime = (regDecl && regDecl.regime) || (ctx.regimeDe && ctx.regimeDe(row)) || 'libre';
      const fam = familleDe(row, ctx.familles);
      const tva = controleTva(row, p, (taxe.get(row.categorie) || 0) - (num(row.tva) > 0 ? 1 : 0) > 0, ctx);
      const t = (tva.taux || 0) / 100;
      const pvTtc = pv === null ? null : r4(pv * (1 + t));
      const pvTtcP = pvP === null ? null : r4(pvP * (1 + ((p && num(p.tva)) || 0) / 100));
      const taux = (pv && pa !== null) ? r4((pv - pa) / pv) : null;
      const tauxP = (pvP && paP !== null) ? r4((pvP - paP) / pvP) : null;
      const varCout = (paP && pa !== null && paP > 0) ? r4((pa - paP) / paP) : null;
      const varPv = (pvP && pv !== null && pvP > 0) ? r4((pv - pvP) / pvP) : null;
      const st = stock(row);
      const paStock = st ? st.pa : undefined;
      const ecartStock = (st && paStock > 0 && pa !== null) ? r4((pa - paStock) / paStock) : null;

      // Coût : provenance et méthode conservées ; jamais renommé PMP sans preuve.
      const coutLigne = { valeur: pa, libelle: cout.libelle, provenance: cout.provenance, methode: cout.methode || 'non établie (PMP ou dernier prix d\'achat)',
        stock: st ? { pa_net_ht: paStock, ecart: ecartStock, source: ctx.stockSource || 'valorisation du stock Decenium, colonne « PA net HT »' } : null };

      // Fiabilité comptable : aucun critère réglementaire ni d'application de prix.
      const ins = [], conf = [];
      if (!commerciale) ins.push('hors ventes commerciales (' + nature + ')');
      if (pa === null || pa <= 0) ins.push('coût absent ou nul');
      if (pv === null || pv <= 0) ins.push('prix de vente absent ou nul');
      if (pv !== null && pa !== null && pa >= pv) ins.push('marge négative ou nulle');
      if (varCout !== null && Math.abs(varCout) >= R.variationSuspecte) ins.push('coût en variation de ' + Math.round(varCout * 100) + ' % sur la période précédente');
      else if (varCout !== null && Math.abs(varCout) >= R.variationNotable) conf.push('coût en variation de ' + Math.round(varCout * 100) + ' % sur la période précédente');
      if (!st) conf.push('absent du relevé de stock : coût non contrôlé');
      else if (!(paStock > 0)) conf.push('PA net HT nul au relevé de stock');
      else if (ecartStock !== null && Math.abs(ecartStock) > R.ecartStockInsuffisant) ins.push('coût écarté de ' + Math.round(ecartStock * 100) + ' % du PA net HT du stock');
      else if (ecartStock !== null && Math.abs(ecartStock) > R.ecartStockConfirmer) conf.push('coût écarté de ' + Math.round(ecartStock * 100) + ' % du PA net HT du stock');
      if (tva.etat === 'a_verifier') ins.push('TVA à vérifier : ' + tva.raison);
      else if (tva.etat === 'a_confirmer') conf.push('TVA à confirmer : ' + tva.raison);
      if (q < R.quantiteMinimale) conf.push('moins de ' + R.quantiteMinimale + ' unités vendues');
      if (pv !== null && pv < R.prixUnitaireBas) conf.push('prix unitaire inférieur à ' + String(R.prixUnitaireBas).replace('.', ',') + ' € : montants arrondis au centime');
      if (/^\d{2}-\d{2}-\d{4}\s/.test(row.article || '')) conf.push("libellé préfixé d'une date");
      if (!p) conf.push('sans historique sur la période précédente');
      const niveau = ins.length ? FIABILITE.insuffisante : conf.length ? FIABILITE.a_confirmer : FIABILITE.fiable;

      // Conformité réglementaire, axe indépendant.
      const reg = premier(ctx.reglementaire, row);
      const conformite = reg ? { etat: reg.etat || CONFORMITE.controle_ouvert, motif: reg.raison || null, type_element: reg.type_element || null } : { etat: CONFORMITE.non_concerne, motif: null, type_element: null };
      const reglementaireOuvert = [CONFORMITE.controle_ouvert, CONFORMITE.a_completer, CONFORMITE.non_conforme].includes(conformite.etat);

      const exc = premier(ctx.exceptions, row);
      const exception = exc ? { statut: exc.statut, type: exc.type || null, motif: exc.motif || null, conditions: exc.conditions || null } : null;
      const excValidee = !!(exception && exception.statut === 'validee');
      const pd = premier(ctx.prixDecides, row);
      const suivi = pd ? suiviPrixDecide(pd, pvTtc, pvTtcP, ctx.periode, R) : null;
      const seuil = seuilDe(fam.famille, row.categorie, ctx);
      const seuilRef = seuil ? (seuil.minimumValide ? seuil.minimum : seuil.cibleValide ? seuil.cible : null) : null;
      const regleValide = !!(seuil && seuil.valide);
      const repere = (!regleValide && seuil) ? (seuil.minimumIndicatif ? seuil.minimum : seuil.cibleIndicative ? seuil.cible : null) : null;

      // Simulations : prix décidé (changement), minimum (ou objectif unique), cible. Jamais pour une exception validée,
      // un contrôle réglementaire ouvert, un régime non libre, une ligne non commerciale ou une règle non validée.
      // Repères indicatifs : calculés à part, marqués non décisionnels, jamais rangés avec les gains décisionnels.
      const sim = { prixDecide: null, minimum: null, cible: null, repereMinimum: null, repereCible: null, exclusion: null };
      if (!commerciale) sim.exclusion = 'hors ventes commerciales';
      else if (reglementaireOuvert) sim.exclusion = 'contrôle réglementaire ouvert';
      else if (excValidee) sim.exclusion = 'exception commerciale validée';
      else if (regime !== 'libre') sim.exclusion = 'régime de prix non établi ou non libre';
      if (!sim.exclusion && suivi && suivi.nature === 'changement' && pv !== null) {
        const ht = suivi.prix_ttc / (1 + t);
        sim.prixDecide = { ttc: suivi.prix_ttc, ht: r4(ht), taux: pa !== null ? r4((ht - pa) / ht) : null, gain: r2((ht - pv) * q) };
      }
      if (!sim.exclusion && !suivi && pa !== null && pa > 0 && pv !== null && taux !== null) {
        if (seuilRef !== null && taux < seuilRef - 1e-9) { const x = prixEnvisageable(pa, seuilRef, tva.taux, R.palierTtc); sim.minimum = { ...x, seuil: seuilRef, gain: r2((x.ht - pv) * q) }; }
        if (seuil && seuil.cibleValide && taux < seuil.cible - 1e-9) { const x = prixEnvisageable(pa, seuil.cible, tva.taux, R.palierTtc); sim.cible = { ...x, seuil: seuil.cible, gain: r2((x.ht - pv) * q) }; }
        if (repere !== null && taux < repere - 1e-9) { const x = prixEnvisageable(pa, repere, tva.taux, R.palierTtc); sim.repereMinimum = { ...x, seuil: repere, gain: r2((x.ht - pv) * q), decisionnel: false }; }
        if (seuil && !regleValide && seuil.cibleIndicative && taux < seuil.cible - 1e-9) { const x = prixEnvisageable(pa, seuil.cible, tva.taux, R.palierTtc); sim.repereCible = { ...x, seuil: seuil.cible, gain: r2((x.ht - pv) * q), decisionnel: false }; }
      }
      // Une référence insuffisante ne garde ses simulations qu'à titre de preuve technique.
      if (niveau === FIABILITE.insuffisante) for (const k of ['prixDecide', 'minimum', 'cible', 'repereMinimum', 'repereCible']) if (sim[k]) sim[k] = { ...sim[k], decisionnel: false, usage: 'preuve technique' };
      if (!sim.exclusion && suivi && suivi.nature !== 'changement') sim.exclusion = 'prix déclaré par le gérant, sans hausse à simuler';

      // Statut : « conforme » exige une règle applicable validée.
      let statut, raisonStatut;
      if (reglementaireOuvert) { statut = STATUTS.a_verifier; raisonStatut = 'contrôle réglementaire ' + conformite.etat.replace('_', ' '); }
      else if (niveau === FIABILITE.insuffisante) { statut = STATUTS.a_verifier; raisonStatut = 'fiabilité comptable insuffisante'; }
      else if (suivi && suivi.etat === APPLICATION.ecart_constate) { statut = STATUTS.a_verifier; raisonStatut = 'prix déclaré ou décidé non retrouvé dans le PV moyen'; }
      else if (suivi && suivi.etat === APPLICATION.application_verifiee && (!seuil || !seuil.minimumValide || (sim.prixDecide ? sim.prixDecide.taux : taux) >= seuil.minimum - 1e-9)) { statut = STATUTS.conforme; raisonStatut = 'prix décidé, application vérifiée sur preuve'; }
      else if (suivi && suivi.etat !== APPLICATION.maintenu) { statut = STATUTS.a_surveiller; raisonStatut = 'prix décidé : ' + suivi.etat.replace(/_/g, ' '); }
      else if (excValidee) { statut = STATUTS.a_surveiller; raisonStatut = 'exception commerciale validée'; }
      else if (regime !== 'libre') { statut = STATUTS.sans_seuil_valide; raisonStatut = 'régime de prix ' + regime.replace(/_/g, ' ') + (regDecl && regDecl.raison ? ' : ' + regDecl.raison : ''); }
      else if (!regleValide && repere !== null && taux !== null && taux < repere - 1e-9) { statut = STATUTS.a_surveiller; raisonStatut = 'sous le seuil indicatif de ' + Math.round(repere * 100) + ' %, non décisionnel'; }
      else if (!regleValide) { statut = STATUTS.sans_seuil_valide; raisonStatut = seuil ? 'seuil ' + (seuil.statutMinimum || seuil.statutCible).replace(/_/g, ' ') + ', non validé' : 'aucun seuil pour cette famille'; }
      else if (taux !== null && taux < seuilRef - 1e-9) { statut = STATUTS.proposition_a_valider; raisonStatut = 'sous le seuil validé de ' + Math.round(seuilRef * 100) + ' %'; }
      else if (niveau === FIABILITE.a_confirmer) { statut = STATUTS.a_surveiller; raisonStatut = 'données à confirmer'; }
      else if (seuil.cibleValide && taux < seuil.cible - 1e-9) { statut = STATUTS.a_surveiller; raisonStatut = 'entre le minimum et la cible'; }
      else { statut = STATUTS.conforme; raisonStatut = 'au-dessus du seuil validé'; }

      // Alertes. Une exception reste soumise à A3, A4, A5 et A8.
      const alertes = [];
      const ca = pv !== null ? r2(pv * q) : null;
      const ajoute = (code, consequence, donnees) => alertes.push({ ...ALERTES[code], consequence, donnees });
      if (p && pa !== null && paP !== null && pa > paP + 0.005 && pv !== null && pvP !== null && Math.abs(pv - pvP) <= 0.005 && taux !== null && tauxP !== null && taux < tauxP)
        ajoute('A1', { montant: r2((pa - paP) * q), nature: 'impact estimé à volume observé' }, { coutPrecedent: paP, cout: pa, tauxPrecedent: tauxP, taux });
      if (statut === STATUTS.proposition_a_valider && sim.minimum)
        ajoute('A2', { montant: sim.minimum.gain, nature: 'gain théorique au seuil, volume constant' }, { taux, seuil: seuilRef, prixEnvisageableTtc: sim.minimum.ttc, exceptionCandidate: !!(exception && exception.statut === 'candidate') });
      if (pv !== null && pa !== null && pa >= pv) {
        const just = premier(ctx.justifications, row);
        ajoute('A3', { montant: r2((pa - pv) * q), nature: 'perte' }, { cout: pa, pv, justification: just ? just.motif : null, note: just ? "la justification n'efface pas la perte" : null });
      }
      const a4 = [];
      if (varCout !== null && Math.abs(varCout) >= R.variationSuspecte) a4.push('coût ' + Math.round(varCout * 100) + ' %');
      if (varPv !== null && Math.abs(varPv) >= R.variationSuspecte) a4.push('prix ' + Math.round(varPv * 100) + ' %');
      if (ecartStock !== null && Math.abs(ecartStock) > R.ecartStockInsuffisant) a4.push('écart au stock ' + Math.round(ecartStock * 100) + ' %');
      if (a4.length) ajoute('A4', { montant: (ecartStock !== null && paStock > 0) ? r2((pa - paStock) * q) : null, nature: 'écart de valorisation, jamais un gain' }, { constats: a4, cout: pa, coutPrecedent: paP, paStock: paStock === undefined ? null : paStock });
      const a5 = [];
      if (tva.etat === 'a_verifier') a5.push('TVA : ' + tva.raison);
      if (!st) a5.push('référence absente du relevé de stock');
      if (/^\d{2}-\d{2}-\d{4}\s/.test(row.article || '')) a5.push("libellé préfixé d'une date");
      const div = premier(ctx.motifsDivergents, row);
      if (div) a5.push('motif déclaré « ' + div.motif_declare + ' » contre motif enregistré « ' + div.motif_enregistre + ' »');
      if (suivi && suivi.changementProbableEnCours) a5.push('PV moyen entre l\'ancien prix et le prix ' + (suivi.nature === 'en_vigueur' ? 'déclaré' : 'décidé') + ' : changement probable en cours de période, date d\'effet à déclarer (part estimée ' + Math.round(suivi.partEstimee * 100) + ' %)');
      if (suivi && suivi.etat === APPLICATION.ecart_constate && !excValidee) a5.push('prix ' + (suivi.nature === 'en_vigueur' ? 'déclaré' : 'décidé') + ' non retrouvé dans le PV moyen');
      if (a5.length) ajoute('A5', { montant: null, nature: 'à qualifier' }, { constats: a5 });
      if (excValidee && tauxP !== null && taux !== null) {
        const m6 = { ...REGLAGES_DEFAUT.a6, ...(R.a6 || {}) };
        const mu = pv - pa, muP = pvP - paP, baisseMu = muP - mu;
        const parTaux = tauxP - taux > m6.baissePoints + 1e-9;
        const parMarge = baisseMu >= m6.baisseMargeUnitaireEuros - 1e-9 && muP > 0 && baisseMu / muP >= m6.baisseMargeUnitaireRelative - 1e-9;
        const perte = r2(Math.max(parTaux && ca !== null ? (tauxP - taux) * ca : 0, parMarge ? baisseMu * q : 0));
        if ((parTaux || parMarge) && perte >= m6.montantMinimal - 1e-9)
          ajoute('A6', { montant: perte, nature: 'marge perdue estimée, volume observé' }, { tauxPrecedent: tauxP, taux, margeUnitairePrecedente: r4(muP), margeUnitaire: r4(mu), declencheur: parTaux ? 'baisse du taux' : 'baisse de marge unitaire', seuils: m6 });
      }
      if (excValidee) {
        const c = exception.conditions || {}, hors = [];
        const prixCond = c.prix_ttc !== undefined && c.prix_ttc !== null ? c.prix_ttc : (suivi && suivi.prix_ttc);
        if (!(suivi && (suivi.changementProbableEnCours || suivi.periodeChevauchante)) && prixCond !== null && prixCond !== undefined && pvTtc !== null && Math.abs(pvTtc - prixCond) > R.toleranceConstatTtc + 1e-9) hors.push('PV moyen ' + eur(pvTtc) + ' € TTC contre ' + eur(prixCond) + ' € déclaré');
        if (pv !== null && pa !== null && pa >= pv) hors.push('marge non positive');
        const ref = num(c.cout_reference) !== null ? num(c.cout_reference) : paP;
        if (ref && pa !== null && Math.abs(pa - ref) / ref > (c.tolerance_cout || R.toleranceCoutException)) hors.push('coût hors de ±' + Math.round((c.tolerance_cout || R.toleranceCoutException) * 100) + ' %');
        if (hors.length) ajoute('A7', { montant: (prixCond && pvTtc !== null) ? r2((prixCond - pvTtc) / (1 + t) * q) : null, nature: 'écart au prix déclaré, volume observé' }, { constats: hors });
      }
      if (reglementaireOuvert) ajoute('A8', { montant: ca, nature: "chiffre d'affaires HT concerné, aucun gain" }, { etat: conformite.etat, type_element: conformite.type_element });

      lignes.push({
        article: row.article, code_barres: cb(row), rayon: row.categorie, famille: fam.famille, sourceFamille: fam.source, noteFamille: fam.motif,
        quantite: q, pv_ht: pv, pv_ttc: pvTtc, ca_ht: ca, tva, cout: coutLigne, taux, tauxPrecedent: tauxP, variationCout: varCout, variationPv: varPv,
        historique: !!p, nature, regime,
        regle: seuil ? { niveau: seuil.niveau, minimum: seuil.minimum ?? null, cible: seuil.cible ?? null, statutMinimum: seuil.statutMinimum || null, statutCible: seuil.statutCible || null,
          nature: regleValide ? 'validee' : seuil.indicatif ? 'indicative' : 'non_validee', valide: regleValide, seuilApplique: seuilRef, repereIndicatif: repere } : null,
        regimeDeclare: regDecl ? { regime: regDecl.regime, raison: regDecl.raison || null } : null,
        exception, prixDecide: suivi, conformite, fiabilite: { niveau, raisons: ins.concat(conf) },
        simulation: sim, statut, raisonStatut, alertes,
      });
    }

    // Gains : chaque référence entre dans UNE case par scénario, celle de son niveau de fiabilité.
    //   decisionnels        : prix décidés, minimum validé, cible validée ; fiables et à confirmer seulement.
    //   reperesIndicatifs   : mêmes calculs au seuil indicatif ; jamais décisionnels.
    //   preuvesTechniques   : simulations des références insuffisantes ; jamais un gain exploitable.
    // « minimum » et « cible » sont deux hypothèses alternatives : aucun total n'est additionnable.
    const vide = () => ({ fiable: { montant: 0, references: 0 }, a_confirmer: { montant: 0, references: 0 } });
    const gains = {
      decisionnels: { prixDecides: vide(), minimum: vide(), cible: vide() },
      reperesIndicatifs: { minimum: vide(), cible: vide(), decisionnel: false },
      preuvesTechniques: { prixDecides: { montant: 0, references: 0 }, minimum: { montant: 0, references: 0 }, cible: { montant: 0, references: 0 },
        repereMinimum: { montant: 0, references: 0 }, repereCible: { montant: 0, references: 0 }, usage: 'preuve technique, jamais un gain exploitable' },
      alternatives: ['minimum', 'cible'], additionnables: false, jours,
    };
    const CASE = { prixDecide: ['decisionnels', 'prixDecides'], minimum: ['decisionnels', 'minimum'], cible: ['decisionnels', 'cible'], repereMinimum: ['reperesIndicatifs', 'minimum'], repereCible: ['reperesIndicatifs', 'cible'] };
    const PREUVE = { prixDecide: 'prixDecides', minimum: 'minimum', cible: 'cible', repereMinimum: 'repereMinimum', repereCible: 'repereCible' };
    for (const l of lignes) for (const sc of Object.keys(CASE)) {
      const s = l.simulation[sc]; if (!s || s.gain === null) continue;
      const g = l.fiabilite.niveau === FIABILITE.insuffisante ? gains.preuvesTechniques[PREUVE[sc]] : gains[CASE[sc][0]][CASE[sc][1]][l.fiabilite.niveau];
      g.montant = r2(g.montant + s.gain); g.references += 1;
    }
    const exclus = {
      reglementaire: lignes.filter(l => l.simulation.exclusion === 'contrôle réglementaire ouvert'),
      exception: lignes.filter(l => l.simulation.exclusion === 'exception commerciale validée'),
    };
    const compte = (k, f) => lignes.reduce((m, l) => { const v = f(l); m[v] = (m[v] || 0) + 1; return m; }, {});
    const synthese = {
      periode: ctx.periode || null, jours, references: lignes.length,
      regles: compte('regles', l => l.regle ? l.regle.nature : 'aucune'),
      fiabilite: compte('fiabilite', l => l.fiabilite.niveau), conformite: compte('conformite', l => l.conformite.etat), statuts: compte('statut', l => l.statut),
      alertes: lignes.reduce((m, l) => { for (const a of l.alertes) m[a.code] = (m[a.code] || 0) + 1; return m; }, {}),
      exclusReglementaire: { references: exclus.reglementaire.length, ca_ht: r2(exclus.reglementaire.reduce((s, l) => s + (l.ca_ht || 0), 0)) },
      exclusException: { references: exclus.exception.length },
      cout: { ...cout, methode: cout.methode || 'non établie (PMP ou dernier prix d\'achat)', methodeEtablie },
    };
    return { lignes, gains, synthese };
  }

  // Ramène un montant d'une période à 30 jours (affichage Scanner) ; null si la durée est inconnue.
  const ramener = (montant, jours, ref) => (montant === null || !jours) ? null : r2(montant * (ref || REGLAGES_DEFAUT.joursReference) / jours);

  const VERSION_MOTEUR = 'politique-tarifaire-t2-v2';
  const API = { VERSION_MOTEUR, FIABILITE, CONFORMITE, STATUTS, APPLICATION, STATUT_SEUIL, ALERTES, REGLAGES_DEFAUT, COUT_DEFAUT,
    arrondiPalier, prixEnvisageable, familleDe, seuilDe, suiviPrixDecide, analyser, ramener };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusPolitiqueTarifaire = API;
})(typeof window !== 'undefined' ? window : globalThis);
