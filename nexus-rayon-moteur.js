/*
 * nexus-rayon-moteur.js — extraction pure du calcul par catégorie ("rayon"),
 * jusque-là codé uniquement à l'intérieur de construireRayons() dans
 * NEXUS-Rayon-v1.html. Extrait le 11/08/2026 pour que le nouveau chapitre
 * "Commerce" du Rapport NEXUS de Direction réutilise EXACTEMENT le même
 * calcul (CA/marge/évolution par catégorie) sans en écrire une deuxième
 * version (Article 11, "une seule vérité").
 *
 * Ce fichier ne fait AUCUN accès Supabase — il reçoit les lignes `products`
 * déjà chargées par l'appelant (même discipline que nexus-marge.js,
 * nexus-carburant-moteur.js, nexus-secteurs-moteur.js...).
 *
 * Dépendance : NexusPeriodes.analyserPeriodes (nexus-periodes.js), doit être
 * chargé avant ce fichier.
 */
(function (global) {
  'use strict';

  // Rayons "de trafic" — le rôle premier de ces familles n'est pas la marge
  // mais d'attirer/retenir le client (recharges, cartes prépayées, presse,
  // jeux, timbres...). Détection par mot-clé sur le nom de catégorie.
  const MOTCLE_RAYON_TRAFIC = /cart.?e?s?\s*pr[ée]pay|pr[ée]pay[ée]e|\bfdj\b|\bpresse\b|\btimbre/i;
  function estRayonTrafic(nomCategorie) {
    return MOTCLE_RAYON_TRAFIC.test(nomCategorie || '');
  }

  // Sous-familles par mot-clé — utile surtout pour les rayons "trafic" qui
  // regroupent plusieurs opérateurs/marques sous une même catégorie. Si aucun
  // mot-clé connu ne matche une part significative des références, la
  // section ne s'affiche pas — pas de découpage forcé.
  const MOTSCLES_SOUS_FAMILLE = ['Transcash', 'PCS', 'Digicel', 'Orange', 'SFR', 'Claro', 'Vitocarte', 'Lyca', 'Free Mobile', 'Bouygues', 'Western Union', 'MoneyGram'];
  function detecterSousFamilles(produits) {
    const groupes = {};
    produits.forEach(p => {
      const trouve = MOTSCLES_SOUS_FAMILLE.find(m => new RegExp(m.replace(/\s/g, '\\s*'), 'i').test(p.article));
      const cle = trouve || 'Autres';
      if (!groupes[cle]) groupes[cle] = { nom: cle, ca: 0, marge: 0, nb: 0 };
      groupes[cle].ca += p.ca || 0;
      groupes[cle].marge += p.marge || 0;
      groupes[cle].nb += 1;
    });
    const liste = Object.values(groupes).sort((a, b) => b.ca - a.ca);
    const caTotal = produits.reduce((s, p) => s + (p.ca || 0), 0);
    const partAutres = caTotal > 0 ? (groupes['Autres'] ? groupes['Autres'].ca / caTotal : 0) : 1;
    // Si "Autres" représente la quasi-totalité du CA, aucun mot-clé connu n'a
    // vraiment matché ce rayon — on n'affiche rien plutôt qu'un faux découpage.
    return partAutres >= 0.95 ? [] : liste;
  }

  /**
   * construireRayonsDepuisLignes(rows) — extraction fidèle, comportement
   * identique à l'ancien construireRayons() de NEXUS-Rayon-v1.html, moins
   * l'appel réseau. rows = lignes `products` déjà chargées pour le site
   * (select: categorie, article, ca, marge, periode_debut, periode_fin).
   */
  function construireRayonsDepuisLignes(rows) {
    if (!rows || !rows.length) return { rayons: {}, magasin: null };
    if (!global.NexusPeriodes || !global.NexusPeriodes.analyserPeriodes) {
      throw new Error('nexus-rayon-moteur.js requiert NexusPeriodes.analyserPeriodes (nexus-periodes.js non chargé)');
    }

    const { periodeAffichage, rowsAffichage, paire, rowsPaireActuelle, rowsPairePrecedente, periodeEnCours } =
      global.NexusPeriodes.analyserPeriodes(rows);
    if (!periodeAffichage) return { rayons: {}, magasin: null };

    const caActuelleParCat = {}, caPrecedentParCat = {};
    rowsPaireActuelle.forEach(r => { caActuelleParCat[r.categorie] = (caActuelleParCat[r.categorie] || 0) + (r.ca || 0); });
    rowsPairePrecedente.forEach(r => { caPrecedentParCat[r.categorie] = (caPrecedentParCat[r.categorie] || 0) + (r.ca || 0); });

    const parCategorie = {};
    rowsAffichage.forEach(r => {
      if (!parCategorie[r.categorie]) parCategorie[r.categorie] = [];
      parCategorie[r.categorie].push(r);
    });
    if (paire) {
      Object.keys(caActuelleParCat).forEach(nom => { if (!parCategorie[nom]) parCategorie[nom] = []; });
    }

    const rayons = {};
    Object.entries(parCategorie).forEach(([nom, produits]) => {
      const ca_total = produits.reduce((s, p) => s + (p.ca || 0), 0);
      const marge_total = produits.reduce((s, p) => s + (p.marge || 0), 0);
      const marge_pct_moyenne = ca_total > 0 ? marge_total / ca_total : 0;

      let evolution_ca = null, raison_indisponible = null;
      if (!paire) {
        raison_indisponible = 'aucune_paire';
      } else {
        const caPrec = caPrecedentParCat[nom];
        const caAct = caActuelleParCat[nom] || 0;
        if (caPrec && caPrec > 0) {
          evolution_ca = (caAct - caPrec) / caPrec;
        } else {
          raison_indisponible = 'baseline_nulle';
        }
      }

      const avecMarge = produits.map(p => ({ ...p, marge_pct: p.ca > 0 ? (p.marge || 0) / p.ca : 0 }));
      const top_ventes = [...produits].sort((a, b) => b.ca - a.ca).slice(0, 5).map(p => ({ article: p.article, ca: p.ca }));
      const top_marge = [...avecMarge].sort((a, b) => b.marge_pct - a.marge_pct).slice(0, 5).map(p => ({ article: p.article, marge_pct: p.marge_pct, ca: p.ca }));
      const top_marge_eur = [...produits].sort((a, b) => (b.marge || 0) - (a.marge || 0)).slice(0, 5).map(p => ({ article: p.article, marge: p.marge || 0 }));
      const produits_faibles = [...produits].sort((a, b) => a.ca - b.ca).slice(0, 8).map(p => ({ article: p.article, ca: p.ca }));
      const sous_familles = detecterSousFamilles(produits);

      rayons[nom] = {
        nom, nb_references: produits.length, ca_total, marge_total, marge_pct_moyenne,
        evolution_ca, raison_indisponible, top_ventes, top_marge, top_marge_eur, produits_faibles, sous_familles,
        trafic: estRayonTrafic(nom),
        nb_decisions_actives: 0,
      };
    });

    const caTotalMagasin = Object.values(rayons).reduce((s, r) => s + r.ca_total, 0);
    const margeTotalMagasin = Object.values(rayons).reduce((s, r) => s + r.marge_total, 0);

    return {
      rayons,
      magasin: {
        ca_total: caTotalMagasin, marge_total: margeTotalMagasin,
        periodeAffichage, periodeEnCours,
        paire,
      },
    };
  }

  /**
   * classerRayons(rayons) — classement dirigeant des catégories (utilisé par
   * le chapitre Marge du Rapport de Direction) : "moteurs de marge"
   * (marge_pct élevée et CA significatif), "neutres", "qui détruisent de la
   * marge" (marge_pct nettement sous la moyenne pondérée du magasin) — les
   * rayons de trafic (FDJ, cartes prépayées, presse) sont exclus de ce
   * classement car leur rôle n'est pas la marge (même logique que
   * estRayonTrafic ci-dessus, cohérent avec nexus-marge.js qui les exclut
   * aussi des écarts de marge détectés).
   */
  function classerRayons(rayons) {
    const liste = Object.values(rayons || {}).filter(r => !r.trafic && r.ca_total > 0);
    if (!liste.length) return { moteurs: [], neutres: [], destructeurs: [] };
    const margeMoyennePonderee = liste.reduce((s, r) => s + r.marge_total, 0) / liste.reduce((s, r) => s + r.ca_total, 0);
    const SEUIL_ECART_PTS = 5; // points de marge % d'écart à la moyenne pondérée du magasin
    const moteurs = [], neutres = [], destructeurs = [];
    liste.forEach(r => {
      const ecartPts = (r.marge_pct_moyenne - margeMoyennePonderee) * 100;
      if (ecartPts >= SEUIL_ECART_PTS) moteurs.push({ ...r, ecartPts });
      else if (ecartPts <= -SEUIL_ECART_PTS) destructeurs.push({ ...r, ecartPts });
      else neutres.push({ ...r, ecartPts });
    });
    moteurs.sort((a, b) => b.marge_total - a.marge_total);
    destructeurs.sort((a, b) => a.ecartPts - b.ecartPts);
    return { moteurs, neutres, destructeurs, margeMoyennePonderee };
  }

  global.NexusRayonMoteur = { construireRayonsDepuisLignes, classerRayons, estRayonTrafic, detecterSousFamilles };
})(typeof window !== 'undefined' ? window : globalThis);
