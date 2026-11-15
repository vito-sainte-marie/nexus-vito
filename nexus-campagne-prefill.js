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

  // ---------- Préremplissage élargi : une saisie faite une fois sert à tous les moteurs ----------
  // Rien n'est enregistré ici. Sans source, un champ reste vide (null) : ni valeur de repli, ni zéro par défaut.
  const jour = (v) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : ''; };
  const cle = (a) => String(a || '').trim().toLowerCase();

  // Nombre de jours d'une période, bornes comprises (05/10 au 09/11 = 36). null si une borne manque.
  function joursPeriode(debut, fin) {
    const a = jour(debut), b = jour(fin);
    if (!a || !b) return null;
    const t = (j) => Date.UTC(+j.slice(0, 4), +j.slice(5, 7) - 1, +j.slice(8, 10));
    const n = Math.round((t(b) - t(a)) / 86400000) + 1;
    return n >= 1 ? n : null;
  }

  // Vrai tant que la promotion n'est pas terminée : aujourd'hui (date locale) strictement avant date_fin.
  function avantFin(dateFin, aujourdhui) {
    const f = jour(dateFin);
    if (!f) return false;
    if (typeof aujourdhui === 'string') return jour(aujourdhui) < f;
    const d = aujourdhui || new Date();
    const l = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return l < f;
  }

  // Dernière version par article (clé en minuscules).
  function derniers(rows) {
    const m = new Map();
    (rows || []).forEach((r) => {
      const k = cle(r.article);
      if (!m.has(k) || Number(r.version) > Number(m.get(k).version)) m.set(k, r);
    });
    return m;
  }

  // Unités vendues sur la période de référence des objectifs : la ligne `products` dont la période est exactement celle des objectifs.
  function ventesReference(produitsRows, article, debut, fin) {
    const a = jour(debut), b = jour(fin);
    if (!a || !b) return null;
    const l = (produitsRows || []).find((r) => cle(r.article) === cle(article) && jour(r.periode_debut) === a && jour(r.periode_fin) === b);
    const q = l ? num(l.quantite) : null;
    return q === null ? null : q;
  }

  // Propose toutes les valeurs d'un article. d = {
  //   campagne:{campagneId,dateDebut,dateFin}, article, objectifs, pmp, depart, livraisons (déjà valides), lignesLivraison,
  //   produitsRows, stockReleve:{valeur,source}|null (comptage ou relevé du jour de début), stockFinReleve:{valeur,source}|null, pertes:number|null }
  // deps = { ttcVersHt, fiabiliteReference }.
  // Retour : { valeurs:{champ: nombre|null}, sources:{champ: {type, ...}|null}, srcDebut, srcFin, stockDate }.
  function proposer(d, deps) {
    const out = { valeurs: {}, sources: {}, srcDebut: null, srcFin: null, stockDate: null };
    const v = out.valeurs, so = out.sources;
    const c = d.campagne || {};
    const obj = derniereValidee(d.objectifs, c.campagneId, d.article);

    // Prix : objectifs validés.
    const r = reprendre(obj, deps.ttcVersHt);
    ['venteAvant', 'achatPendant', 'ventePendant'].forEach((k) => { v[k] = r[k]; so[k] = r[k] === null ? null : { type: 'objectifs' }; });

    // PA avant : PMP de référence (C5), sinon le PA habituel des objectifs.
    // Les livraisons de la promotion sont calculées plus bas ; la fiabilité du PMP en dépend, on les rassemble d'abord.
    const dep = derniers(d.depart).get(cle(d.article)) || null;
    const rel = d.stockReleve && d.stockReleve.valeur !== null && d.stockReleve.valeur !== undefined ? d.stockReleve : null;
    let stockDate = null;
    if (rel && (!dep || !jour(dep.date_stock) || jour(dep.date_stock) < jour(c.dateDebut))) {
      v.stockDebut = rel.valeur; out.srcDebut = rel.source; stockDate = jour(c.dateDebut);
      so.stockDebut = { type: 'releve', source: rel.source };
    } else if (dep && num(dep.quantite) !== null) {
      v.stockDebut = num(dep.quantite); stockDate = jour(dep.date_stock) || null;
      so.stockDebut = { type: 'stock_depart', date: stockDate, source: dep.source || null, aConfirmer: !!dep.a_confirmer };
    } else { v.stockDebut = null; so.stockDebut = null; }
    out.stockDate = stockDate;

    // Livraisons de la promotion : mêmes règles de date que le bilan (avant le stock de départ : exclues ; même jour : signalée).
    const liv = new Map((d.livraisons || []).map((l) => [l.id, l]));
    let somme = 0, n = 0, memeJour = 0, premiere = '';
    (d.lignesLivraison || []).filter((l) => cle(l.article) === cle(d.article) && liv.has(l.livraison_id)).forEach((l) => {
      const dl = jour(liv.get(l.livraison_id).date_livraison);
      const u = num(l.unites);
      if (u === null) return;
      if (stockDate && dl && dl < stockDate) return;
      if (stockDate && dl && dl === stockDate) { memeJour += u; return; }
      somme += u; n += 1;
      if (dl && (!premiere || dl < premiere)) premiere = dl;
    });
    if (n > 0 || memeJour > 0) { v.livraisons = somme; so.livraisons = { type: 'livraisons', n, memeJour }; }
    else { v.livraisons = null; so.livraisons = null; }

    const ref = derniers(d.pmp).get(cle(d.article)) || null;
    const fi = deps.fiabiliteReference(ref, c.dateDebut, premiere || null);
    if (fi.statut !== 'absent') {
      v.achatAvant = arrondi(num(ref.pmp_ht));
      so.achatAvant = { type: 'pmp', date: jour(ref.date_reference) || null, aConfirmer: fi.statut === 'a_confirmer' };
    } else if (r.achatAvant !== null) { v.achatAvant = r.achatAvant; so.achatAvant = { type: 'objectifs' }; }
    else { v.achatAvant = null; so.achatAvant = null; }

    // Ventes de référence et jours : période de référence des objectifs.
    const jr = obj ? joursPeriode(obj.periode_ref_debut, obj.periode_ref_fin) : null;
    const q = obj ? ventesReference(d.produitsRows, d.article, obj.periode_ref_debut, obj.periode_ref_fin) : null;
    if (jr !== null && q !== null) {
      v.ventes = q; v.joursRef = jr;
      so.ventes = so.joursRef = { type: 'ventes', debut: jour(obj.periode_ref_debut), fin: jour(obj.periode_ref_fin) };
    } else { v.ventes = null; v.joursRef = null; so.ventes = so.joursRef = null; }

    // Stock de fin : seulement s'il existe un comptage ou un relevé daté du dernier jour.
    const fin = d.stockFinReleve && d.stockFinReleve.valeur !== null && d.stockFinReleve.valeur !== undefined ? d.stockFinReleve : null;
    if (fin) { v.stockFin = fin.valeur; out.srcFin = fin.source; so.stockFin = { type: 'releve', source: fin.source }; }
    else { v.stockFin = null; so.stockFin = null; }

    // Pertes : mouvements de casse ou de retrait de la période, sinon vide.
    const p = num(d.pertes);
    if (p !== null && p > 0) { v.pertes = p; so.pertes = { type: 'mouvements' }; } else { v.pertes = null; so.pertes = null; }
    return out;
  }

  // Applique une proposition à une saisie sans jamais remplacer une valeur déjà présente.
  // Retourne les écarts (saisi différent de la source) pour les champs numériques.
  function appliquerProposition(saisie, prop) {
    const ecartsSource = [];
    Object.keys(prop.valeurs).forEach((k) => {
      const o = prop.valeurs[k];
      if (o === null || o === undefined) return;
      const s = num(saisie[k]);
      if (s === null) { saisie[k] = String(o).replace('.', ','); saisie['src_' + k] = prop.sources[k]; }
      else if (Math.abs(s - o) > 0.005) ecartsSource.push({ champ: k, saisi: s, source: o, src: prop.sources[k] || null });
      else saisie['src_' + k] = prop.sources[k];
    });
    return ecartsSource;
  }

  const api = { CHAMPS, derniereValidee, reprendre, appliquer, ecarts, joursPeriode, avantFin, ventesReference, proposer, appliquerProposition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.NexusCampagnePrefill = api;
})(typeof window !== 'undefined' ? window : globalThis);
