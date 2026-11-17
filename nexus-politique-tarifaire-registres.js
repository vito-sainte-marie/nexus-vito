// ============================================================
// NEXUS Scanner, politique tarifaire T2 : adaptateur registres → contexte du moteur T1 (module pur, LECTURE SEULE).
// Reçoit les lignes des vues v_tarif_*_actifs et v_tarif_exceptions_effectives, déjà filtrées par la RLS du site,
// et rend le `contexte` attendu par NexusPolitiqueTarifaire.analyser. Aucun réseau, aucune écriture.
// Le moteur T1 n'est pas modifié : seul l'origine des paramètres change (registres au lieu d'un fichier).
// ============================================================
(function (global) {
  'use strict';
  const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
  const ref = r => ({ ...(r.code_barres ? { code_barres: String(r.code_barres).trim() } : {}), ...(r.article ? { article: r.article } : {}) });
  const REGLAGES = {
    palier_ttc: ['palierTtc'], tolerance_constat_ttc: ['toleranceConstatTtc'], variation_notable: ['variationNotable'], variation_suspecte: ['variationSuspecte'],
    ecart_stock_confirmer: ['ecartStockConfirmer'], ecart_stock_insuffisant: ['ecartStockInsuffisant'], quantite_minimale: ['quantiteMinimale'],
    prix_unitaire_bas: ['prixUnitaireBas'], tolerance_cout_exception: ['toleranceCoutException'], jours_reference: ['joursReference'],
    a6_baisse_points: ['a6', 'baissePoints'], a6_baisse_marge_unitaire_euros: ['a6', 'baisseMargeUnitaireEuros'],
    a6_baisse_marge_unitaire_relative: ['a6', 'baisseMargeUnitaireRelative'], a6_montant_minimal: ['a6', 'montantMinimal'],
  };
  const plusRecent = (a, b, k) => (!a || String(b[k]) > String(a[k])) ? b : a;

  function contexteDepuisRegistres(reg, base) {
    const R = reg || {};
    const unSite = new Set([].concat(...['familles', 'rattachements', 'seuils', 'reglages', 'exceptions', 'prixDecides', 'applications', 'regimes', 'controles']
      .map(k => (R[k] || []).map(x => x.site)).filter(Boolean)));
    if (unSite.size > 1) throw new Error('registres de plusieurs sites mélangés : ' + [...unSite].join(', '));
    const libelles = Object.fromEntries((R.familles || []).map(f => [f.famille_code, f.libelle]));
    const familles = { parRayon: {}, parReference: [], parMotif: [] };
    for (const r of R.rattachements || []) {
      if (r.portee === 'rayon') familles.parRayon[r.rayon] = r.famille_code;
      else familles.parReference.push({ ...ref(r), famille: r.famille_code, motif: r.motif || null });
    }
    const seuils = {}, seuilsRayon = {}; let seuilDefaut = null;
    for (const s of R.seuils || []) {
      const v = { minimum: num(s.minimum), cible: num(s.cible), statutMinimum: s.statut_minimum || null, statutCible: s.statut_cible || null, seuil_id: s.id };
      if (s.niveau === 'famille') seuils[s.cible_niveau] = v;
      else if (s.niveau === 'rayon') seuilsRayon[s.cible_niveau] = v;
      else seuilDefaut = v;
    }
    const reglages = {};
    for (const g of R.reglages || []) {
      const chemin = REGLAGES[g.parametre]; if (!chemin) continue;
      if (chemin.length === 2) { reglages[chemin[0]] = reglages[chemin[0]] || {}; reglages[chemin[0]][chemin[1]] = num(g.valeur); }
      else reglages[chemin[0]] = num(g.valeur);
    }
    const exceptions = (R.exceptions || []).map(e => ({ ...ref(e), statut: e.statut, type: e.type, motif: e.motif, source: e.source || 'tarif_exceptions',
      conditions: { prix_ttc: num(e.cond_prix_ttc), tolerance_cout: num(e.cond_tolerance_cout), cout_reference: num(e.cond_cout_reference) } }));
    // Événements d'application : dernière saisie déclarée et dernière preuve, par prix décidé.
    const ev = new Map();
    for (const a of R.applications || []) {
      const e = ev.get(a.prix_decide_id) || {};
      if (a.evenement === 'saisie_declaree') e.saisie = plusRecent(e.saisie, a, 'date_effet');
      else e.preuve = plusRecent(e.preuve, a, 'date_effet');
      ev.set(a.prix_decide_id, e);
    }
    const prixDecides = (R.prixDecides || []).map(p => {
      const e = ev.get(p.id) || {};
      return { ...ref(p), prix_ttc: num(p.prix_ttc), nature: p.nature, decide_le: p.decide_le,
        saisie_declaree_le: e.saisie ? e.saisie.date_effet : null,
        preuve_application: e.preuve ? { type: e.preuve.preuve_type, date: e.preuve.date_effet } : null };
    });
    const regimes = (R.regimes || []).map(g => ({ ...ref(g), regime: g.regime, raison: g.raison }));
    const reglementaire = (R.controles || []).map(c => ({ ...(c.portee === 'rayon' ? { rayon: c.rayon } : ref(c)), etat: c.etat, type_element: c.type_element || null, raison: c.raison }));
    return { ...(base || {}), familles, seuils, seuilsRayon, seuilDefaut, reglages, exceptions, prixDecides, regimes, reglementaire, libellesFamilles: libelles };
  }

  const API = { contexteDepuisRegistres, REGLAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusPolitiqueTarifaireRegistres = API;
})(typeof window !== 'undefined' ? window : globalThis);
