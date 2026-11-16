// ============================================================
// Produits, Scanner tarifaire S1 (GO gérant du 15/11/2026, Test, LECTURE SEULE).
// Module pur : aucun réseau, aucune écriture, aucune modification de prix, de coût, de TVA ni de données Decenium.
//   <script src="nexus-scanner-tarifaire.js?v=20261116-1"></script>
//
// controler(lignesCourantes, lignesPrecedentes, contexte) rapproche deux périodes importées et produit trois contrôles :
//   A. ventes à perte (PA >= PV)                       : une perte non justifiée est toujours en tête, la justification n'efface pas la perte ;
//   B. hausses de PA non répercutées (PA↑, PV inchangé) : « impact estimé à volume observé », jamais présenté comme une perte ;
//   C. données de prix suspectes (variation de PA importante ou suspecte, valeur nulle ou manquante, identité à vérifier).
// Aucun registre parallèle : nature et justification viennent de NexusProduitsMesure, la famille de NexusMarge.familleMarge,
// les seuils de NexusConseiller.SEUILS_SCANNER_TARIFAIRE.
//
// contexte = {
//   jours            : durée (jours) de la période courante, sinon calculée depuis periode ;
//   periode          : { debut, fin } de la période courante (filtre exact des justifications) ;
//   natures          : lignes produits_nature_reference (brutes ou déjà actives) ;
//   justifications   : lignes produits_justifications_marge (brutes ou déjà actives) ;
//   exclusionsManuelles : Set d'articles (facultatif) ;
//   contractuels     : Map/Set de clés (code-barres ou libellé normalisé) à prix contractuel. AUCUNE saisie en S1 : vide aujourd'hui.
// }
// ============================================================
(function (global) {
  'use strict';

  // Type de prix : `contractuel` est prévu mais sans source aujourd'hui.
  const PRIX_TYPES = { libre: 'libre', reglemente: 'reglemente', contractuel: 'contractuel' };

  const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const r4 = n => Math.round(n * 10000) / 10000;
  const r2 = n => Math.round(n * 100) / 100;
  const cb = r => (r && r.code_barres ? String(r.code_barres).trim() : '');

  function dep(ctx) {
    const PM = global.NexusProduitsMesure || (typeof require !== 'undefined' ? require('./nexus-produits-mesure.js') : null);
    const NC = global.NexusConseiller;
    const seuils = (ctx && ctx.seuils) || (NC && NC.SEUILS_SCANNER_TARIFAIRE);
    if (!PM) throw new Error('NexusProduitsMesure introuvable (charger nexus-produits-mesure.js)');
    if (!seuils) throw new Error('SEUILS_SCANNER_TARIFAIRE introuvable (charger nexus-conseiller.js)');
    const famille = (ctx && ctx.familleMarge) || (global.NexusMarge && global.NexusMarge.familleMarge) || (() => ({ exclue: false }));
    return { PM, seuils, famille };
  }

  function niveauVariation(abs, s) {
    const v = s.variationPa;
    return abs >= v.suspecte ? 'suspecte' : abs >= v.importante ? 'importante' : abs >= v.notable ? 'notable' : 'ordinaire';
  }
  function niveauImpact(impact, s) {
    return impact >= s.impactEuros.prioritaire ? 'prioritaire' : impact >= s.impactEuros.aExaminer ? 'a_examiner' : 'information';
  }

  function indexer(rows, PM) {
    const parCb = new Map(), parNom = new Map();
    rows.forEach(r => {
      const c = cb(r); if (c && !parCb.has(c)) parCb.set(c, r);
      const k = PM.normaliserNom(r.article); if (!k) return;
      parNom.set(k, (parNom.get(k) || []).concat([r]));
    });
    return { parCb, parNom };
  }

  function controler(courantes, precedentes, contexte) {
    const ctx = contexte || {};
    const { PM, seuils, famille } = dep(ctx);
    const cur = courantes || [], prev = precedentes || [];
    const jours = ctx.jours || (ctx.periode ? PM.jours(ctx.periode.debut, ctx.periode.fin) : null);
    const natures = PM.actives(ctx.natures || [], 'declare_le');
    const justifs = PM.actives(ctx.justifications || [], 'valide_le');
    const jourIso = x => (x ? String(x).slice(0, 10) : '');
    const justifsPeriode = ctx.periode ? justifs.filter(x => jourIso(x.periode_debut) === jourIso(ctx.periode.debut) && jourIso(x.periode_fin) === jourIso(ctx.periode.fin)) : justifs;
    const ixCur = PM.indexerParNom(cur);
    const ixPrev = indexer(prev, PM);
    const contractuels = ctx.contractuels || null;

    const lignes = [];
    cur.forEach((r, i) => {
      const nomUnique = ixCur.get(PM.normaliserNom(r.article)) === i;
      // Nature lue via le module de mesure (déclaration d'un responsable, sinon règle NEXUS des articles de caisse).
      const nat = PM.natureDe(natures, r, nomUnique);
      const operation = !!(nat && nat.nature === 'operation_caisse');
      if (operation) return;

      const pa = num(r.prix_achat), pv = num(r.prix_vente), qte = num(r.quantite) || 0;
      const fam = famille(r.categorie, r.article, ctx.exclusionsManuelles);
      const cle = cb(r) || PM.normaliserNom(r.article);
      const typePrix = contractuels && (contractuels.has ? contractuels.has(cle) : false) ? PRIX_TYPES.contractuel : fam.exclue ? PRIX_TYPES.reglemente : PRIX_TYPES.libre;

      // Rapprochement : code-barres d'abord, sinon libellé normalisé (s'il est unique dans la période précédente).
      const identite = [];
      let p = null, par = null;
      const c = cb(r);
      if (c && ixPrev.parCb.has(c)) {
        p = ixPrev.parCb.get(c); par = 'code_barres';
        if (PM.normaliserNom(p.article) !== PM.normaliserNom(r.article)) identite.push('libelle_change');
      } else {
        const cand = ixPrev.parNom.get(PM.normaliserNom(r.article));
        if (cand && cand.length === 1) {
          p = cand[0]; par = 'libelle';
          if (c && cb(p) && cb(p) !== c) identite.push('code_barres_change');
        }
      }
      if (!c) identite.push('sans_code_barres');

      const paPrec = p ? num(p.prix_achat) : null, pvPrec = p ? num(p.prix_vente) : null;
      const manquantes = [];
      if (pa === null || pa <= 0) manquantes.push('pa');
      if (pv === null || pv <= 0) manquantes.push('pv');

      let variation = null, niveau = null, sens = null;
      if (pa !== null && pa > 0 && paPrec !== null && paPrec > 0) {
        variation = (pa - paPrec) / paPrec;
        niveau = niveauVariation(Math.abs(variation), seuils);
        sens = r4(pa) > r4(paPrec) ? 'hausse' : r4(pa) < r4(paPrec) ? 'baisse' : 'stable';
      }

      // A. Vente à perte : PA strictement supérieur au PV, avec des ventes. PA égal au PV : donnée à vérifier (voir plus bas). Justification de la période : jamais d'effacement de la perte.
      let perte = null;
      if (!manquantes.length && qte > 0 && r4(pa) > r4(pv)) {
        const j = PM.trouverDeclaration(justifsPeriode, r, nomUnique);
        perte = {
          montant: r2((pa - pv) * qte),
          justifiee: !!j,
          motif: j ? (PM.MOTIFS_JUSTIFICATION[j.motif] || j.motif) : null,
          commentaire: j ? (j.commentaire || null) : null,
        };
      }

      // B. Hausse de PA non répercutée : PA en hausse, PV inchangé, quel que soit le pourcentage.
      let hausse = null;
      if (sens === 'hausse' && pv !== null && pvPrec !== null && r4(pv) === r4(pvPrec)) {
        const impact = r2((pa - paPrec) * qte);
        hausse = { impact, impact30: jours ? r2(impact / jours * 30) : null, niveau: niveauImpact(impact, seuils) };
      }

      // C. Données de prix suspectes (importante, suspecte, valeur nulle ou manquante, identité modifiée).
      const raisons = [];
      if (niveau === 'importante' || niveau === 'suspecte') raisons.push('variation_' + niveau);
      manquantes.forEach(m => raisons.push(m === 'pa' ? 'pa_manquant' : 'pv_manquant'));
      // Identité modifiée et PV égal au PA : « à vérifier », sans message de coût suspect.
      const averifier = [];
      identite.filter(x => x !== 'sans_code_barres').forEach(x => averifier.push('identite_' + x));
      if (!manquantes.length && qte > 0 && r4(pa) === r4(pv)) averifier.push('pv_egal_pa');

      lignes.push({
        article: r.article, categorie: r.categorie || null, code_barres: c || null,
        prix_type: typePrix, famille: fam.id,
        quantite: qte, pa, pv, pa_precedent: paPrec, pv_precedent: pvPrec,
        rapprochement: par || 'absente', variation, niveau_variation: niveau, sens,
        identite, donnees_manquantes: manquantes,
        a_verifier: averifier.length ? { raisons: averifier, ancien_libelle: p ? p.article : null, ancien_code_barres: p ? (cb(p) || null) : null } : null,
        perte, hausse, suspect: raisons.length ? { raisons, niveau: niveau === 'suspecte' || niveau === 'importante' ? niveau : null } : null,
        cout_a_verifier: niveau === 'importante' || niveau === 'suspecte' || manquantes.length > 0,
        // Prix réglementé ou contractuel : jamais de hausse ni de baisse proposée.
        suggestion_prix: null,
        montant_global: Math.max(perte ? perte.montant : 0, hausse ? hausse.impact : 0),
      });
    });

    return { lignes, resume: synthese(lignes, jours, seuils), jours };
  }

  function synthese(lignes, jours, seuils) {
    const cnt = (f) => lignes.filter(f).length;
    const R = {
      analysees: lignes.length,
      absentes_precedente: cnt(l => l.rapprochement === 'absente'),
      variation: {
        hausses: cnt(l => l.sens === 'hausse'), baisses: cnt(l => l.sens === 'baisse'),
        ordinaire: cnt(l => l.niveau_variation === 'ordinaire'), notable: cnt(l => l.niveau_variation === 'notable'),
        importante: cnt(l => l.niveau_variation === 'importante'), suspecte: cnt(l => l.niveau_variation === 'suspecte'),
      },
      donnees_manquantes: cnt(l => l.donnees_manquantes.length > 0),
      identite: {
        libelle_change: cnt(l => l.identite.includes('libelle_change')),
        code_barres_change: cnt(l => l.identite.includes('code_barres_change')),
        sans_code_barres: cnt(l => l.identite.includes('sans_code_barres')),
      },
    };
    const sommeP = a => r2(a.reduce((s, x) => s + x, 0));
    const pertes = lignes.filter(l => l.perte);
    R.perte = { nb: pertes.length, montant: sommeP(pertes.map(l => l.perte.montant)), non_justifiees: pertes.filter(l => !l.perte.justifiee).length, justifiees: pertes.filter(l => l.perte.justifiee).length };
    const bloc = f => {
      const hs = lignes.filter(l => l.hausse && f(l));
      return {
        nb: hs.length, impact: sommeP(hs.map(l => l.hausse.impact)), impact30: jours ? sommeP(hs.map(l => l.hausse.impact)) / jours * 30 : null,
        information: hs.filter(l => l.hausse.niveau === 'information').length,
        a_examiner: hs.filter(l => l.hausse.niveau === 'a_examiner').length,
        prioritaire: hs.filter(l => l.hausse.niveau === 'prioritaire').length,
      };
    };
    R.hausse = bloc(() => true);
    R.hausse.impact30 = R.hausse.impact30 === null ? null : r2(R.hausse.impact30);
    R.hausse.libre = bloc(l => l.prix_type === PRIX_TYPES.libre);
    R.hausse.reglemente = bloc(l => l.prix_type !== PRIX_TYPES.libre);
    [R.hausse.libre, R.hausse.reglemente].forEach(b => { b.impact30 = b.impact30 === null ? null : r2(b.impact30); });
    R.suspect = { nb: cnt(l => l.suspect) };
    R.a_verifier = { nb: cnt(l => l.a_verifier), identite: cnt(l => l.a_verifier && l.a_verifier.raisons.some(x => x.indexOf('identite_') === 0)), pv_egal_pa: cnt(l => l.a_verifier && l.a_verifier.raisons.includes('pv_egal_pa')) };
    // Total global : chaque référence une seule fois, au plus grand de ses impacts (la perte d'une vente à perte
    // est déjà incluse dans la hausse de PA qui l'a causée).
    const touchees = lignes.filter(l => l.perte || l.hausse || l.suspect);
    R.global = { nb: touchees.length, montant: sommeP(touchees.map(l => l.montant_global)) };
    return R;
  }

  // ---- Préparation de l'affichage (ordre de lecture demandé par le gérant) ----
  // 1. ventes à perte, non justifiées d'abord (toujours en tête, quel que soit le montant), puis justifiées ;
  // 2. coûts suspects à vérifier ; 3. hausses non répercutées : 10 premières par impact décroissant, prix libres et
  //    prix réglementés séparés, le reste dans une ligne repliable, puis « N références à moins de 1 € ».
  function affichage(res, opts) {
    const s = (opts && opts.seuils) || (global.NexusConseiller && global.NexusConseiller.SEUILS_SCANNER_TARIFAIRE);
    const L = res.lignes;
    const parImpact = (a, b) => b.hausse.impact - a.hausse.impact || String(a.article).localeCompare(String(b.article));
    const pertes = L.filter(l => l.perte).sort((a, b) => (a.perte.justifiee - b.perte.justifiee) || (b.perte.montant - a.perte.montant));
    const ordreNiveau = { suspecte: 0, importante: 1 };
    const averifier = L.filter(l => l.a_verifier).sort((a, b) => String(a.article).localeCompare(String(b.article)));
    const suspects = L.filter(l => l.suspect).sort((a, b) => ((ordreNiveau[a.niveau_variation] ?? 2) - (ordreNiveau[b.niveau_variation] ?? 2)) || Math.abs(b.variation || 0) - Math.abs(a.variation || 0));
    const groupe = (filtre) => {
      const tous = L.filter(l => l.hausse && filtre(l)).sort(parImpact);
      const petites = tous.filter(l => l.hausse.impact < s.impactNegligeableEuros);
      const grandes = tous.filter(l => l.hausse.impact >= s.impactNegligeableEuros);
      const premieres = grandes.slice(0, s.nombreAffiche);
      const reste = grandes.slice(s.nombreAffiche);
      const somme = a => r2(a.reduce((t, l) => t + l.hausse.impact, 0));
      return { total: tous.length, impact: somme(tous), premieres, impact_premieres: somme(premieres), reste: { nb: reste.length, impact: somme(reste), lignes: reste }, petites: { nb: petites.length, impact: somme(petites), lignes: petites } };
    };
    return {
      pertes, suspects, averifier,
      hausses: groupe(l => l.prix_type === PRIX_TYPES.libre),
      reglementes: groupe(l => l.prix_type !== PRIX_TYPES.libre),
    };
  }

  // ---- Textes (vocabulaire imposé : jamais « perte » pour une hausse non répercutée) ----
  const TEXTES = {
    titre: 'Scanner tarifaire',
    sousTitre: 'Ventes à perte, coûts suspects, hausses de PA non répercutées',
    hausse: 'Hausse de PA non répercutée',
    hausses: 'Hausses de PA non répercutées',
    niveaux: { a_examiner: 'À examiner', prioritaire: 'Prioritaire' },
    impact: 'Impact estimé à volume observé',
    coutAVerifier: 'coût à vérifier avant toute décision de prix',
    suspectMessage: 'Vérifier le conditionnement, l\'unité d\'achat, le PMP Decenium HT, les dates et l\'identité du produit. Aucune modification de prix n\'est conseillée tant que le coût n\'est pas vérifié.',
    identiteMessage: 'Libellé (ou code-barres) modifié depuis la période précédente : vérifier qu\'il s\'agit du même produit.',
    pvEgalPaMessage: 'PV égal au PA : opération de caisse ou service possible, nature à déclarer dans la fiche.',
    reglemente: {
      titre: 'Prix réglementés',
      sousTitre: 'Surveillance financière · Prix non librement modifiables',
      constat: 'Le coût d\'achat a augmenté sans évolution du prix de vente enregistré',
      action: 'Vérifier le tarif applicable, le coût fournisseur et la cohérence des données Decenium',
      pied: 'Aucune suggestion de prix pour ces références',
    },
  };

  const eur = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const pct = v => (v >= 0 ? '+' : '−') + (Math.round(Math.abs(v) * 1000) / 10).toFixed(1).replace('.', ',') + ' %';

  // Texte de la fiche produit d'une référence dont le coût est suspect ; null si rien à signaler.
  function texteFiche(l) {
    if (!l || !l.cout_a_verifier || l.pa === null || l.pa_precedent === null) return null;
    const a = l.pa_precedent, b = l.pa;
    const mouvement = b >= 2 * a ? 'a plus que doublé' : b > a ? 'a augmenté' : 'a baissé';
    const perte = l.perte ? ' et le produit se vend à perte' : '';
    return `Le coût d'achat ${mouvement} (${eur(a)} → ${eur(b)}, ${pct(l.variation)})${perte}. Vérifier le prix fournisseur, le conditionnement et le PMP Decenium HT avant de modifier le prix de vente.`;
  }

  // ---- S2 : écarts de marge dans le groupe (Marge+ R5), LECTURE SEULE ----
  // Un écart à la médiane est une HYPOTHÈSE ; une hausse de PA est un impact observé : jamais de total commun.
  // `ecarts` vient de NexusMarge.ecartsMargeDeLaPeriode (une seule préparation pour tous les consommateurs).
  // Validation et mission restent dans Scanner NEXUS (lien « Traiter dans Scanner NEXUS »), aucune écriture ici.
  function affichageMarge(ecarts, lignes, opts) {
    const s = (opts && opts.seuils) || (global.NexusConseiller && global.NexusConseiller.SEUILS_SCANNER_TARIFAIRE);
    const enHausse = new Set((lignes || []).filter(l => l.hausse).map(l => l.article));
    const tri = (a, b) => b.gainPotentiel - a.gainPotentiel || String(a.article).localeCompare(String(b.article));
    const marque = e => ({ ...e, aussi_hausse_pa: enHausse.has(e.article) });
    const tous = (ecarts || []).map(marque);
    const ouverts = tous.filter(e => !e.validee).sort(tri);
    const valides = tous.filter(e => e.validee).sort(tri);
    const somme = a => r2(a.reduce((t, e) => t + e.gainPotentiel, 0));
    const n = s ? s.nombreAffiche : 10;
    const premiers = ouverts.slice(0, n), reste = ouverts.slice(n);
    return {
      total: ouverts.length, ecart: somme(ouverts),
      premiers, reste: { nb: reste.length, ecart: somme(reste), lignes: reste },
      valides: { nb: valides.length, ecart: somme(valides), lignes: valides },
      aussi_hausse_pa: ouverts.filter(e => e.aussi_hausse_pa).length,
    };
  }
  const pctSimple = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + ' %';
  TEXTES.marge = {
    titre: 'Écarts de marge dans le groupe (Marge+)',
    sousTitre: 'Écart à la médiane du groupe, hypothèse à vérifier',
    ecart: 'Écart à la médiane du groupe, hypothèse à vérifier',
    aussiHausse: 'aussi en hausse de PA non répercutée',
    lien: 'Traiter dans Scanner NEXUS',
    valides: 'validés pour cette période',
    pied: 'Lecture seule : validation et mission se font dans Scanner NEXUS. Cet écart n\'est pas additionné aux hausses de PA.',
  };
  // Phrase de la fiche produit (en plus du texte S1) ; null si pas d'écart.
  function texteFicheMarge(e) {
    if (!e) return null;
    return `Taux ${pctSimple(e.margePct)}, médiane du groupe ${pctSimple(e.medianeGroupe)} sur ${e.tailleGroupe} références comparables : écart à vérifier.`;
  }

  const API = { PRIX_TYPES, TEXTES, controler, affichage, texteFiche, texteFicheMarge, affichageMarge, synthese, niveauVariation, niveauImpact };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.NexusScannerTarifaire = API;
})(typeof window !== 'undefined' ? window : globalThis);
