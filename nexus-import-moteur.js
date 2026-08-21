// ============================================================
// NEXUS Import — moteur pur (aucun DOM, aucun Supabase).
// Refonte du 21/08/2026 suite à NEXUS_Audit_Import_Donnees_UX_
// DataPipeline_Developpeur (Sprints 1-3) : l'écran Import devient un
// assistant d'intégration en 4 étapes (intention -> source ->
// vérification -> publication), avec staging brut, mapping versionné,
// anti-doublon serveur et rapport qualité — voir Data Dictionary v2.206.
//
// Portée assumée (voir Data Dictionary pour le détail des écarts) :
//  - pas de "data_sources"/"canonical_product_id" séparés : le fichier
//    reste la seule source en V1 (Google Sheets/API = plus tard, même
//    pipeline) et NEXUS n'a nulle part un catalogue produit unique
//    cross-module (Inventaire, Photos, Ventes ont chacun leur propre
//    notion de produit) — inventer une identité canonique globale ici
//    serait une fausse précision (Article 5), pas une vraie donnée.
//  - "data_versions" = import_batches (statut published/superseded +
//    remplace_batch_id) : une seule vérité (Article 11), pas de table
//    séparée qui dupliquerait la même information.
//  - "propagation ciblée" = information affichée au manager (quels
//    écrans liront cette donnée), pas un job de recalcul : NEXUS n'a
//    aucun cache/vue matérialisée à invalider aujourd'hui, tous les
//    écrans lisent products/stock_releves/panier_moyen_quotidien en
//    direct à chaque affichage.
// ============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // Normalisation — reprise à l'identique des fonctions déjà
  // éprouvées de NEXUS-Import-v1.html (norm) et de
  // NEXUS-Inventaire-Manager-v1.html (normaliserCodeBarresVentes,
  // normaliserTexteVentes) pour ne jamais avoir deux définitions
  // divergentes du même calcul (Article 11).
  // ------------------------------------------------------------
  function norm(s) {
    return (s || '').toString()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim();
  }

  function normaliserCodeBarresImport(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/[\s  ]/g, '').replace(/^0+/, '');
    return s || null;
  }

  function normaliserArticleImport(v) {
    return norm(v).replace(/[^a-z0-9/]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    let s = String(v).replace(/\s| | /g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  // Correction CBD (trouvée le 15/07/2026, voir Data Dictionary v2) —
  // identique à NEXUS-Import-v1.html, reprise ici pour que le moteur
  // et l'écran ne divergent jamais.
  function corrigerCategorie(categorieBrute, article) {
    if (/cbd/i.test(article || '')) return 'CBD';
    return categorieBrute;
  }

  // ------------------------------------------------------------
  // Définitions de champs par intention — section 4/17.1 de l'audit :
  // Ventes/Catalogue et Campagne partagent exactement les mêmes champs
  // (même table products), Stock instantané n'a besoin que d'une
  // désignation, une quantité et éventuellement un code-barres.
  // ------------------------------------------------------------
  const FIELD_DEFS_VENTES = [
    { key: 'categorie', label: 'Catégorie', synonyms: ['categ', 'categorie', 'famille', 'rayon'] },
    { key: 'article', label: 'Article', synonyms: ['lib article', 'libelle', 'designation', 'produit', 'article'] },
    { key: 'quantite', label: 'Quantité', synonyms: ['qte', 'quantite', 'qty', 'stock actuel'] },
    { key: 'prix_achat', label: "Prix d'achat", synonyms: ['pma', 'pa ht', 'prix achat', 'cout', 'cost'] },
    { key: 'prix_vente', label: 'Prix de vente HT', synonyms: ['pu ht', 'pv ht', 'prix vente', 'prix', 'pvht'] },
    { key: 'tva', label: 'TVA', synonyms: ['tva', 'vat'] },
    { key: 'code_barres', label: 'Code-barres', synonyms: ['code barres', 'ean', 'codebarre'] },
  ];

  const FIELD_DEFS_STOCK = [
    { key: 'categorie', label: 'Catégorie', synonyms: ['categ', 'categorie', 'famille', 'rayon'] },
    { key: 'article', label: 'Article', synonyms: ['lib article', 'libelle', 'designation', 'produit', 'article'] },
    { key: 'quantite_theorique', label: 'Quantité', synonyms: ['qte', 'quantite', 'qty', 'stock actuel', 'stock theorique'] },
    { key: 'code_barres', label: 'Code-barres', synonyms: ['code barres', 'ean', 'codebarre'] },
  ];

  function fieldDefsPourIntention(intention) {
    if (intention === 'stock_theorique') return FIELD_DEFS_STOCK;
    if (intention === 'ventes_catalogue' || intention === 'campagne') return FIELD_DEFS_VENTES;
    return [];
  }

  // detectMapping : essaie d'abord la mémoire (mapping déjà confirmé
  // pour ce site+intention par un import précédent — I07 "mapping
  // proposé puis mémorisé par source"), puis retombe sur les synonymes
  // codés en dur. Ne devine jamais au-delà de ces deux sources.
  function detectMapping(headers, fieldDefs, memoire) {
    const mapping = {};
    const auto = {};
    const memoireParChamp = {};
    (memoire || []).forEach(m => { memoireParChamp[m.champ_canonique] = m.colonne_source; });

    fieldDefs.forEach(f => {
      let found = null;
      const colonneMemorisee = memoireParChamp[f.key];
      if (colonneMemorisee && headers.includes(colonneMemorisee)) {
        found = colonneMemorisee;
      } else {
        found = headers.find(h => f.synonyms.some(s => norm(h).includes(s))) || null;
      }
      mapping[f.key] = found;
      auto[f.key] = !!found;
    });
    return { mapping, auto };
  }

  // ------------------------------------------------------------
  // Alias produit (section 10-11 de l'audit) — remplace le principe
  // ALIAS_VENTES_SANS_CODE_BARRES (objet JS codé en dur dans
  // NEXUS-Inventaire-Manager-v1.html) par un mécanisme réutilisable
  // pour le pipeline Import général. Même doctrine stricte : jamais de
  // fuzzy matching, correspondance exacte uniquement.
  // ------------------------------------------------------------
  function resoudreAlias(designationBrute, aliases) {
    if (!designationBrute) return null;
    const cle = normaliserArticleImport(designationBrute);
    const trouve = (aliases || []).find(a => a.designation_brute_normalisee === cle);
    return trouve ? trouve.designation_canonique : null;
  }

  // ------------------------------------------------------------
  // Clé métier par intention (section 7 de l'audit — "Cas: Même date +
  // même produit + même source -> Clé métier ou external_id pour
  // upsert idempotent"). Le code-barres prime toujours sur le libellé
  // quand il est disponible : c'est la seule clé qui ne varie jamais
  // selon la façon dont l'export orthographie l'article.
  // ------------------------------------------------------------
  function cleMetierVentes({ periodeDebut, periodeFin, categorie, article, codeBarres }) {
    const cb = normaliserCodeBarresImport(codeBarres);
    if (cb) return `${periodeDebut}|${periodeFin}|cb:${cb}`;
    return `${periodeDebut}|${periodeFin}|art:${normaliserArticleImport(article)}`;
  }

  function cleMetierStock({ dateReleve, article, codeBarres }) {
    const cb = normaliserCodeBarresImport(codeBarres);
    if (cb) return `${dateReleve}|cb:${cb}`;
    return `${dateReleve}|art:${normaliserArticleImport(article)}`;
  }

  function cleMetierPanier({ date }) {
    return `${date}`;
  }

  // Isole les champs réellement comparables pour détecter une
  // modification (nouvelle_identique vs connue_modifiee) — les champs
  // de routage (periodeDebut/periodeFin/dateReleve, utiles seulement au
  // calcul de la clé métier) ne doivent jamais faire basculer une ligne
  // en "modifiée" alors que sa vraie valeur métier n'a pas changé.
  function champsComparables(intention, valeurs) {
    if (intention === 'ventes_catalogue' || intention === 'campagne') {
      const { categorie, article, code_barres, quantite, prix_achat, prix_vente, tva } = valeurs;
      return { categorie, article, code_barres, quantite, prix_achat, prix_vente, tva };
    }
    if (intention === 'stock_theorique') {
      const { categorie, article, code_barres, quantite_theorique } = valeurs;
      return { categorie, article, code_barres, quantite_theorique };
    }
    const { date, nb_tickets, panier_moyen_ht, panier_moyen_ttc } = valeurs;
    return { date, nb_tickets, panier_moyen_ht, panier_moyen_ttc };
  }

  // ------------------------------------------------------------
  // Classification anti-doublon (section 7-8-9 de l'audit). Prend en
  // entrée les lignes déjà mappées vers leurs champs canoniques
  // (jamais un second passage sur le fichier brut) et retourne, pour
  // chaque ligne dans l'ordre d'origine, son verdict.
  //
  // Comportement volontairement différent selon l'intention pour la
  // publication d'un "doublon_fichier" (deux lignes du même fichier
  // avec la même clé) :
  //  - ventes_catalogue/campagne : la table products historique garde
  //    une ligne par ligne d'export (deux lignes "Coca Cola 33CL" à
  //    des moments différents d'un même export peuvent être deux
  //    ventes réelles distinctes) — le doublon est SIGNALÉ mais jamais
  //    exclu de la publication, exactement comme le fait déjà
  //    controleQualiteImportVentes côté Inventaire ("jamais fusionnées
  //    automatiquement").
  //  - stock_theorique/panier_moyen : une clé (date+article / date)
  //    doit être unique par construction (un relevé, un jour) — seule
  //    la première occurrence est publiée, les suivantes sont
  //    signalées et exclues (jamais moyennées ni sommées à la place du
  //    manager).
  // ------------------------------------------------------------
  function classifierLignesImport({ intention, lignes, connuesParCle }) {
    const vuesDansCeFichier = new Set();
    const connues = connuesParCle || new Map();

    return lignes.map(ligne => {
      if (ligne.invalide) {
        return { statut: 'rejetee', cle_metier: null, raison: ligne.raisonInvalide || 'Ligne invalide.', valeurs: ligne.valeurs || null };
      }

      let cle;
      if (intention === 'ventes_catalogue' || intention === 'campagne') cle = cleMetierVentes(ligne.valeurs);
      else if (intention === 'stock_theorique') cle = cleMetierStock(ligne.valeurs);
      else cle = cleMetierPanier(ligne.valeurs);

      const dejaVueDansCeFichier = vuesDansCeFichier.has(cle);
      vuesDansCeFichier.add(cle);

      if (dejaVueDansCeFichier) {
        return { statut: 'doublon_fichier', cle_metier: cle, raison: 'Référence déjà présente ailleurs dans ce même fichier.', valeurs: ligne.valeurs };
      }

      const connue = connues.get(cle);
      if (connue) {
        const identique = JSON.stringify(connue) === JSON.stringify(champsComparables(intention, ligne.valeurs));
        return {
          statut: identique ? 'connue_identique' : 'connue_modifiee',
          cle_metier: cle,
          raison: identique ? 'Valeur déjà publiée, inchangée.' : 'Valeur déjà publiée, différente dans ce fichier.',
          valeurs: ligne.valeurs,
        };
      }

      return { statut: 'nouvelle', cle_metier: cle, raison: null, valeurs: ligne.valeurs };
    });
  }

  // ------------------------------------------------------------
  // Score qualité + décision recommandée (section 8/20-I17 de
  // l'audit). Formule volontairement simple et documentée — un score
  // n'a de valeur que si son calcul est explicable, pas une boîte
  // noire (Article 5).
  // ------------------------------------------------------------
  function calculerScoreQualite({ lignesTotal, lignesRejetees, referencesInconnuesCount, lignesDoublonsFichier }) {
    if (!lignesTotal) return { score: 0, decision: 'bloque' };
    const ratioRejet = lignesRejetees / lignesTotal;
    const ratioInconnues = referencesInconnuesCount / lignesTotal;
    const ratioDoublons = lignesDoublonsFichier / lignesTotal;
    if (ratioRejet >= 0.5) return { score: Math.round(100 * (1 - ratioRejet)), decision: 'bloque' };

    let score = 100 * (1 - ratioRejet) - ratioInconnues * 15 - ratioDoublons * 5;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const decision = score < 90 ? 'publication_deconseillee' : 'publication_conseillee';
    return { score, decision };
  }

  function construireQualityReport({ lignesTotal, resultats, referencesInconnues, joursManquants }) {
    const compte = (statut) => resultats.filter(r => r.statut === statut).length;
    const lignesRejetees = compte('rejetee');
    const lignesDoublonsFichier = compte('doublon_fichier');
    const { score, decision } = calculerScoreQualite({
      lignesTotal,
      lignesRejetees,
      referencesInconnuesCount: (referencesInconnues || []).length,
      lignesDoublonsFichier,
    });
    const causes = [];
    if (lignesRejetees > 0) causes.push({ code: 'lignes_rejetees', libelle: `${lignesRejetees} ligne(s) rejetée(s)`, nb: lignesRejetees });
    if ((referencesInconnues || []).length > 0) causes.push({ code: 'references_inconnues', libelle: `${referencesInconnues.length} référence(s) non reconnue(s)`, nb: referencesInconnues.length });
    if (lignesDoublonsFichier > 0) causes.push({ code: 'doublons_fichier', libelle: `${lignesDoublonsFichier} doublon(s) dans le fichier`, nb: lignesDoublonsFichier });
    if ((joursManquants || []).length > 0) causes.push({ code: 'jours_manquants', libelle: `${joursManquants.length} jour(s) manquant(s) sur la période`, nb: joursManquants.length });

    return {
      lignes_total: lignesTotal,
      lignes_nouvelles: compte('nouvelle'),
      lignes_connues: compte('connue_identique'),
      lignes_modifiees: compte('connue_modifiee'),
      lignes_doublons_fichier: lignesDoublonsFichier,
      lignes_rejetees: lignesRejetees,
      references_inconnues: referencesInconnues || [],
      jours_manquants: joursManquants || [],
      score_qualite: score,
      decision_recommandee: decision,
      causes,
    };
  }

  // ------------------------------------------------------------
  // Trous temporels et chevauchements (section 15/16 de l'audit —
  // règles Decenium). Fonctions pures, réutilisables pour Panier moyen
  // (granularité jour) et pour la détection de chevauchement de
  // périodes (Ventes/Catalogue, Campagne).
  // ------------------------------------------------------------
  function detecterJoursManquants(datesTrouvees, dateDebut, dateFin) {
    if (!dateDebut || !dateFin) return [];
    const connues = new Set(datesTrouvees);
    const manquants = [];
    let d = new Date(dateDebut + 'T12:00:00');
    const fin = new Date(dateFin + 'T12:00:00');
    while (d <= fin) {
      const iso = d.toISOString().slice(0, 10);
      if (!connues.has(iso)) manquants.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return manquants;
  }

  function detecterChevauchement(nouveauDebut, nouveauFin, periodesExistantes) {
    return (periodesExistantes || []).filter(p => nouveauDebut <= p.fin && p.debut <= nouveauFin);
  }

  // ------------------------------------------------------------
  // Conseiller NEXUS — messages contextuels (section 16 de l'audit).
  // Pure fonction de présentation : à partir d'un contexte déjà
  // calculé, jamais un accès réseau ici.
  // ------------------------------------------------------------
  function construireMessageConseiller(ctx) {
    if (ctx.situation === 'chevauchement') {
      return `${ctx.nbJoursChevauchement} jour(s) se chevauchent. ${ctx.nbLignesConnues} ligne(s) sont déjà connues ; elles ne seront pas dupliquées.`;
    }
    if (ctx.situation === 'trou_temporel') {
      return `Aucune vente détectée pour le ${ctx.dateManquante}. Vérifiez si le site était fermé ou si une journée manque.`;
    }
    if (ctx.situation === 'produit_inconnu') {
      return `${ctx.nbReferencesInconnues} référence(s) ne sont pas encore reliées à une désignation connue.`;
    }
    if (ctx.situation === 'qualite_faible') {
      return `Le fichier est lisible mais ${ctx.pourcentageIncomplet}% des lignes sont incomplètes. Publication déconseillée.`;
    }
    if (ctx.situation === 'pret') {
      return `Fichier cohérent. ${ctx.nbNouvellesLignes} nouvelle(s) ligne(s) seront publiées et ${ctx.nbMoteurs} moteur(s) recalculés.`;
    }
    // 'a_jour' par défaut
    return `Dernière période couverte : ${ctx.dernierePeriodeFin || '—'}. Le fichier suivant devrait commencer après cette date.`;
  }

  // ------------------------------------------------------------
  // Impact — quels écrans NEXUS liront cette donnée (section 13).
  // Purement informatif ; NEXUS ne relance aucun job de recalcul, tous
  // les écrans lisent products/stock_releves/panier_moyen_quotidien en
  // direct à l'affichage.
  // ------------------------------------------------------------
  const IMPACT_PAR_INTENTION = {
    ventes_catalogue: ['Produits', 'Tempo', 'Scanner', 'Rayon', 'Brief', 'Centre d\'Intelligence NEXUS'],
    campagne: ['Campagnes NEXUS', 'Capital (si mesure attribuable)'],
    stock_theorique: ['Inventaire', 'Scanner Stock'],
    panier_moyen: ['Tempo', 'Campagnes NEXUS', 'Brief'],
  };
  function impactPourIntention(intention) { return IMPACT_PAR_INTENTION[intention] || []; }

  // ------------------------------------------------------------
  // Vocabulaire recommandé (section 17.1) — une seule source pour les
  // libellés, jamais un texte réécrit différemment à deux endroits.
  // ------------------------------------------------------------
  const VOCABULAIRE_IMPORT = {
    dropzone: 'Déposez votre fichier',
    typeVentes: 'Ventes / catalogue',
    typeStock: 'Stock théorique instantané',
    typeCampagne: 'Campagne NEXUS',
    typePanier: 'Panier moyen',
    conseillerLabel: 'Conseiller NEXUS — Import',
    boutonVerifier: 'Vérifier le fichier',
    boutonPublier: 'Publier dans NEXUS',
    succesPublication: 'Données publiées dans NEXUS',
    erreurAvantPublication: 'À corriger avant publication',
  };

  // ------------------------------------------------------------
  // États UX (section 9) — {code, message, couleur} pour piloter
  // l'affichage sans dupliquer la logique de couleur à chaque écran.
  // ------------------------------------------------------------
  function etatUX(code, extra) {
    const table = {
      vide: { message: 'Déposez votre fichier', couleur: 'neutre' },
      lecture: { message: 'NEXUS analyse la structure…', couleur: 'cyan' },
      reconnu: { message: 'Fichier compris — vérification prête', couleur: 'vert' },
      a_confirmer: { message: `${extra || 0} colonne(s) à confirmer`, couleur: 'ambre' },
      doublons: { message: `${extra || 0} ligne(s) déjà connues — elles ne seront pas dupliquées`, couleur: 'ambre' },
      erreur_bloquante: { message: extra || 'Impossible de publier ce fichier.', couleur: 'rouge' },
      brouillon: { message: 'Analyse enregistrée, non publiée', couleur: 'gris' },
      publie: { message: 'Données publiées — moteurs recalculés', couleur: 'vert' },
      recalcul: { message: 'NEXUS reconstruit les indicateurs impactés', couleur: 'cyan' },
    };
    return table[code] || { message: '', couleur: 'neutre' };
  }

  const NexusImportMoteur = {
    norm,
    normaliserCodeBarresImport,
    normaliserArticleImport,
    toNumber,
    corrigerCategorie,
    FIELD_DEFS_VENTES,
    FIELD_DEFS_STOCK,
    fieldDefsPourIntention,
    detectMapping,
    resoudreAlias,
    cleMetierVentes,
    cleMetierStock,
    cleMetierPanier,
    champsComparables,
    classifierLignesImport,
    calculerScoreQualite,
    construireQualityReport,
    detecterJoursManquants,
    detecterChevauchement,
    construireMessageConseiller,
    impactPourIntention,
    VOCABULAIRE_IMPORT,
    etatUX,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NexusImportMoteur;
  } else {
    global.NexusImportMoteur = NexusImportMoteur;
  }
})(typeof window !== 'undefined' ? window : this);
