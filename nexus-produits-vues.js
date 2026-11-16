// ============================================================
// Produits, lot P1-C : trois vues (Mes produits, Mes meilleures ventes, Mes marges).
// Module pur : aucune mesure nouvelle. Il ne fait que préparer, filtrer et trier les mesures
// déjà produites par NexusProduitsMesure.mesurer (une seule source des chiffres).
//   <script src="nexus-produits-vues.js?v=20261116-1"></script>
// ============================================================
(function (global) {
  'use strict';

  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  // items : [{m, row}] (mesure + ligne importée). familleMarge : NexusMarge.familleMarge (injectée).
  function preparer(items, familleMarge) {
    return (items || []).filter(x => x && x.m && x.row).map(({ m, row }) => {
      const fam = familleMarge ? familleMarge(m.categorie || row.categorie, row.article) : { exclue: false };
      const nature = (m.nature && m.nature.cle) || 'produit_commercial';
      return {
        article: row.article,
        code_barres: row.code_barres || '',
        rayon: m.categorie || row.categorie || '',
        ca: num(row.ca),
        marge: num(m.marge_totale && m.marge_totale.valeur !== undefined ? m.marge_totale.valeur : row.marge),
        quantite: num(row.quantite),
        taux: m.taux_marque ? m.taux_marque.valeur : null,
        marge_unitaire: m.marge_unitaire ? m.marge_unitaire.valeur : null,
        rang: m.rang ? m.rang.valeur : null,
        sur: m.rang ? m.rang.sur : null,
        qualificationCle: m.qualificationCle,
        qualification: m.qualification,
        nature,
        natureLibelle: m.nature && m.nature.libelle,
        tvaEtat: m.tva && m.tva.etat,
        aIdentifier: nature === 'a_identifier' || !!m.a_identifier,
        caisse: !!m.exclue_indicateurs,
        libre: !(fam && fam.exclue) && nature !== 'service_commercial',
        euros: !!m.quantite_possiblement_en_euros,
        negative: !!m.marge_negative,
        justification: m.justification || null,
        stock: m.stock && m.stock.disponible ? m.stock : { disponible: false },
        service: !!(m.stock && m.stock.service) || nature === 'service_commercial',
      };
    });
  }

  const commerciales = entries => entries.filter(e => !e.caisse);
  const caisses = entries => entries.filter(e => e.caisse);
  const somme = (entries, k) => entries.reduce((s, e) => s + e[k], 0);
  const cmp = (a, b, k) => (b[k] - a[k]) || String(a.article).localeCompare(String(b.article), 'fr');

  // A. Mes produits : tri par CA décroissant, filtres cumulables. Opérations de caisse exclues.
  function produits(entries, f) {
    f = f || {};
    const q = norm(f.recherche);
    const liste = commerciales(entries).filter(e =>
      (!q || norm(e.article).includes(q) || String(e.code_barres).includes(q)) &&
      (!f.rayon || e.rayon === f.rayon) &&
      (!f.qualification || e.qualificationCle === f.qualification) &&
      (!f.nature || e.nature === f.nature) &&
      (!f.tva || e.tvaEtat === f.tva)
    ).sort((a, b) => cmp(a, b, 'ca'));
    return { lignes: liste, ca: somme(liste, 'ca'), marge: somme(liste, 'marge'), caisses: caisses(entries) };
  }

  // B. Meilleures ventes : CA boutique décroissant, part du CA total. Le filtre ne change que l'affichage.
  function meilleuresVentes(entries, o) {
    const base = commerciales(entries);
    const total = somme(base, 'ca');
    const tri = base.slice().sort((a, b) => cmp(a, b, 'ca'));
    const lignes = (o && o.libreSeulement ? tri.filter(e => e.libre) : tri)
      .map(e => ({ ...e, part: total ? e.ca / total : null }));
    return { lignes, total, caisses: caisses(entries) };
  }

  // C. Mes marges : rang de la fiche (marge totale décroissante, marges positives). Négatives à part.
  function marges(entries, resume) {
    const base = commerciales(entries);
    const positives = base.filter(e => e.rang !== null && e.rang !== undefined)
      .sort((a, b) => (a.rang - b.rang) || String(a.article).localeCompare(String(b.article), 'fr'));
    const negatives = base.filter(e => e.negative).sort((a, b) => a.marge - b.marge);
    return {
      lignes: positives,
      negatives,
      margeBoutique: resume ? num(resume.margeBoutique) : somme(base, 'marge'),
      margeForts: resume ? num(resume.margeForts) : null,
      partForts: resume ? resume.partMargeForts : null,
      nbForts: resume ? resume.nbForts : null,
      caisses: caisses(entries),
    };
  }

  // D. Mes produits à revoir (P1-D) : aucune règle nouvelle, seulement un regroupement des signaux existants.
  // statutDe(entry) -> {cle, label, niveau, action} fourni par la page (NexusConseiller.statutProduit).
  const ORDRE_STATUTS = ['surveiller', 'rupture-probable', 'dormant'];
  function aRevoir(entries, statutDe) {
    const base = commerciales(entries);
    const negatives = base.filter(e => e.negative && !e.justification).sort((a, b) => a.marge - b.marge || String(a.article).localeCompare(String(b.article), 'fr'));
    const statuts = [];
    if (statutDe) base.forEach(e => { const st = statutDe(e); if (st && st.niveau === 'a-verifier' && ORDRE_STATUTS.includes(st.cle)) statuts.push({ ...e, statut: st }); });
    statuts.sort((a, b) => (ORDRE_STATUTS.indexOf(a.statut.cle) - ORDRE_STATUTS.indexOf(b.statut.cle)) || cmp(a, b, 'ca'));
    const aEtudier = base.filter(e => e.qualificationCle === 'a_etudier').sort((a, b) => cmp(a, b, 'ca'));
    return {
      negatives, statuts, aEtudier,
      nbAIdentifier: base.filter(e => e.aIdentifier).length,
      nbTvaAVerifier: base.filter(e => e.tvaEtat === 'incoherente').length,
      total: negatives.length + statuts.length + aEtudier.length,
    };
  }

  // E. Mes stocks et couverture (P1-D) : stock théorique Decenium uniquement, jamais « rupture », jamais de qualificatif.
  // comptageDe(entry) -> {quantite, compte_le} | null : dernier comptage physique d'Inventaire, affiché à part.
  function stocks(entries, comptageDe) {
    const tous = entries || [];
    const avec = tous.filter(e => e.stock && e.stock.disponible);
    const sansReleve = tous.length - avec.length;
    const enrichi = e => ({ ...e, comptage: comptageDe ? (comptageDe(e) || null) : null,
      sansObjet: e.caisse || e.service || e.euros });
    const nuls = avec.filter(e => e.stock.quantite <= 0).map(enrichi)
      .sort((a, b) => String(a.article).localeCompare(String(b.article), 'fr'));
    const positifs = avec.filter(e => e.stock.quantite > 0).map(enrichi);
    const couv = e => (e.sansObjet || e.stock.couverture_jours === null || e.stock.couverture_jours === undefined) ? Infinity : e.stock.couverture_jours;
    positifs.sort((a, b) => { const ca = couv(a), cb = couv(b); return (ca === cb ? 0 : ca < cb ? -1 : 1) || String(a.article).localeCompare(String(b.article), 'fr'); });
    const dates = avec.map(e => e.stock.date).filter(Boolean).sort();
    return {
      lignes: positifs, nuls, sansReleve,
      nbAvecReleve: avec.length,
      date: dates.length ? dates[dates.length - 1] : null,
      valeurPositive: positifs.reduce((s, e) => s + (e.stock.valeur_pmp || 0), 0),
    };
  }

  function rayons(entries) { return Array.from(new Set(commerciales(entries).map(e => e.rayon).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')); }
  function qualifications(entries) {
    const mp = new Map();
    commerciales(entries).forEach(e => { if (e.qualificationCle) mp.set(e.qualificationCle, e.qualification || e.qualificationCle); });
    return Array.from(mp, ([cle, libelle]) => ({ cle, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  }

  // Les taux du module de mesure sont déjà en pourcentage (40,95 = 40,95 %) : jamais multipliés par 100.
  function pourcent(v) { return v === null || v === undefined || isNaN(Number(v)) ? 'n.d.' : Number(v).toFixed(2).replace('.', ',') + '\u00a0%'; }

  const API = { pourcent, preparer, produits, meilleuresVentes, marges, aRevoir, stocks, rayons, qualifications };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusProduitsVues = API;
})(typeof window !== 'undefined' ? window : globalThis);
