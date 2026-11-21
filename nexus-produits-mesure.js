// ============================================================
// Produits, lot P1-A : mesure d'une référence (contribution financière, taux, qualification, couverture).
// Module pur : aucun réseau. Il reçoit les lignes `products` et `stock_releves` déjà chargées.
// Seuils : NexusConseiller.SEUILS_PRODUITS_MESURE (constantes nommées). Famille de marge : NexusMarge.familleMarge.
// Inclure après nexus-conseiller.js et nexus-marge.js :
//   <script src="nexus-produits-mesure.js?v=20261115-1"></script>
// ============================================================
(function (global) {
  'use strict';

  const QUALIFICATIONS = {
    moteur: 'Produit moteur',
    moteur_volume: 'Moteur par le volume',
    fort_taux_non_comparable: 'Fort contributeur, taux non comparable',
    fort_ventes_peu_frequentes: 'Fort contributeur, ventes peu fréquentes',
    bon_taux_moyenne: 'Bon taux, contribution moyenne',
    bon_taux_faible: 'Bon taux, faible contribution',
    a_etudier: 'À étudier',
    faible_contribution: 'Faible contribution',
    sans_qualification: 'Sans qualification',
    ventes_insuffisantes: 'Ventes insuffisantes',
    marge_negative: 'Marge négative',
  };

  const RAISONS_NON_COMPARABLE = {
    prix_impose: 'prix imposé',
    peu_de_references: 'moins de 8 références comparables dans le rayon',
    taux_uniforme: 'taux uniforme dans le rayon',
    ventes_insuffisantes: 'ventes trop peu fréquentes',
  };

  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function normaliserNom(n) { return String(n === null || n === undefined ? '' : n).trim().replace(/\s+/g, ' '); }
  function ms(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function jourIso(iso) { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || '')); return m ? m[1] : null; }
  // Durée inclusive d'une période : du 05/10 au 09/11 = 36 jours.
  function jours(debut, fin) { const a = ms(debut), b = ms(fin); return a === null || b === null || b < a ? null : Math.round((b - a) / 86400000) + 1; }
  function arrondi(v, d) { const f = Math.pow(10, d); return Math.round(v * f) / f; }
  function quantile(triees, q) {
    if (!triees.length) return null;
    const pos = (triees.length - 1) * q, bas = Math.floor(pos), haut = Math.ceil(pos);
    return triees[bas] + (triees[haut] - triees[bas]) * (pos - bas);
  }

  function dependances(opts) {
    const o = opts || {};
    const seuils = o.seuils || (global.NexusConseiller && global.NexusConseiller.SEUILS_PRODUITS_MESURE);
    const famille = o.familleMarge || (global.NexusMarge && global.NexusMarge.familleMarge);
    if (!seuils) throw new Error('SEUILS_PRODUITS_MESURE introuvable (charger nexus-conseiller.js)');
    return { seuils, famille: famille || (() => ({ exclue: false })), exclusions: o.exclusionsManuelles || null };
  }

  // Classe les lignes d'une période : rang financier, éligibilité, position du taux, qualification.
  // Retourne { resultats (parallèle à rows), resume }.
  function classer(rows, periodeDebut, periodeFin, opts) {
    const d = dependances(opts);
    const S = d.seuils;
    const nbJours = jours(periodeDebut, periodeFin);
    const seuilUnites = nbJours === null ? null : Math.floor(nbJours / S.joursParUniteMinimale);
    const lignes = (rows || []).map((r, i) => {
      const marge = num(r.marge), ca = num(r.ca), qte = num(r.quantite);
      return { i, r, marge, ca, qte, taux: marge !== null && ca !== null && ca > 0 ? marge / ca * 100 : null,
        eligible: qte !== null && seuilUnites !== null && qte >= seuilUnites, famille: d.famille(r.categorie, r.article, d.exclusions) };
    });
    const positives = lignes.filter(l => l.marge !== null && l.marge > 0)
      .sort((a, b) => b.marge - a.marge || String(a.r.article).localeCompare(String(b.r.article), 'fr'));
    const N = positives.length;
    const nbForts = Math.ceil(S.partContributionForte * N);
    const nbFaibles = Math.ceil(S.partContributionFaible * N);
    positives.forEach((l, k) => { l.rang = k + 1; l.fort = l.rang <= nbForts; l.faible = l.rang > N - nbFaibles; });
    // Taux jugé dans le rayon, hors familles à prix imposé, parmi les références éligibles.
    const rayons = new Map();
    positives.forEach(l => {
      if (!l.eligible || l.taux === null || l.famille.exclue) return;
      const k = l.r.categorie || '';
      if (!rayons.has(k)) rayons.set(k, []);
      rayons.get(k).push(l.taux);
    });
    const stats = new Map();
    rayons.forEach((taux, k) => {
      const t = taux.slice().sort((a, b) => a - b);
      const p25 = quantile(t, 0.25), p75 = quantile(t, 0.75);
      let raison = null;
      if (t.length < S.minReferencesRayon) raison = 'peu_de_references';
      else if (p75 - p25 < S.ecartMinQuartilesPoints) raison = 'taux_uniforme';
      stats.set(k, { nb: t.length, p25, p75, comparable: raison === null, raison });
    });
    let margeTotale = 0, caTotal = 0;
    const parRayon = new Map();
    lignes.forEach(l => {
      const k = l.r.categorie || '';
      if (!parRayon.has(k)) parRayon.set(k, { marge: 0, ca: 0 });
      const p = parRayon.get(k);
      if (l.marge !== null && l.marge > 0) p.marge += l.marge;
      if (l.ca !== null && l.ca > 0) p.ca += l.ca;
    });
    // Dénominateur : marge totale de la boutique, marges négatives comprises (aligné sur le contre-audit).
    lignes.forEach(l => { if (l.marge !== null) margeTotale += l.marge; });
    let margeForts = 0, forts = 0;
    const resultats = lignes.map(l => {
      const res = { rang: null, total: N, fort: false, faible: false, eligible: l.eligible, taux: l.taux,
        position: null, raison: null, rayon: stats.get(l.r.categorie || '') || null, qualification: null,
        partMargeRayon: null, partCaRayon: null };
      const pr = parRayon.get(l.r.categorie || '');
      if (pr && l.marge !== null && l.marge > 0 && pr.marge > 0) res.partMargeRayon = l.marge / pr.marge * 100;
      if (pr && l.ca !== null && l.ca > 0 && pr.ca > 0) res.partCaRayon = l.ca / pr.ca * 100;
      if (l.marge === null || l.marge < 0) { res.qualification = 'marge_negative'; return res; }
      if (l.marge === 0) { res.qualification = 'sans_qualification'; return res; }
      res.rang = l.rang; res.fort = l.fort; res.faible = l.faible;
      if (l.fort) { forts++; margeForts += l.marge; }
      if (!l.eligible) {
        res.raison = 'ventes_insuffisantes';
        res.qualification = l.fort ? 'fort_ventes_peu_frequentes' : 'ventes_insuffisantes';
        return res;
      }
      if (l.famille.exclue) res.raison = 'prix_impose';
      else if (!res.rayon || l.taux === null) res.raison = 'peu_de_references';
      else if (!res.rayon.comparable) res.raison = res.rayon.raison;
      else if (l.taux <= res.rayon.p25 - S.margeAutourQuartilePoints) res.position = 'bas';
      else if (l.taux >= res.rayon.p75 + S.margeAutourQuartilePoints) res.position = 'haut';
      else res.position = 'intermediaire';
      if (l.fort) {
        res.qualification = res.position === null ? 'fort_taux_non_comparable' : res.position === 'bas' ? 'moteur_volume' : 'moteur';
      } else if (l.faible) {
        res.qualification = res.position === 'bas' ? 'a_etudier' : res.position === 'haut' ? 'bon_taux_faible' : 'faible_contribution';
      } else {
        res.qualification = res.position === 'haut' ? 'bon_taux_moyenne' : 'sans_qualification';
      }
      return res;
    });
    const seuilFort = nbForts > 0 ? positives[nbForts - 1].marge : null;
    return { resultats, jours: nbJours, resume: {
      references: lignes.length, referencesMargePositive: N, nbForts, seuilMargeFort: seuilFort,
      margeForts: arrondi(margeForts, 2), margeBoutique: arrondi(margeTotale, 2), partMargeForts: margeTotale > 0 ? margeForts / margeTotale * 100 : null,
      seuilUnites, jours: nbJours,
    } };
  }

  // Index par nom normalisé, accepté seulement si le nom désigne une référence unique du site.
  function indexerParNom(rows) {
    const vus = new Map();
    (rows || []).forEach((r, i) => {
      const k = normaliserNom(r.article);
      if (!k) return;
      vus.set(k, vus.has(k) ? -1 : i);
    });
    const idx = new Map();
    vus.forEach((i, k) => { if (i >= 0) idx.set(k, i); });
    return idx;
  }

  function valeur(v, source, periode, fiabilite, site) {
    return { valeur: v, source, periode_debut: periode.debut || null, periode_fin: periode.fin || null, fiabilite, site: site || null };
  }

  // Dernier relevé de stock théorique d'une référence : par code-barres, sinon par nom normalisé.
  function dernierReleve(releves, row) {
    const cb = row.code_barres ? String(row.code_barres).trim() : '';
    const nom = normaliserNom(row.article);
    let best = null;
    (releves || []).forEach(s => {
      const mem = (cb && s.code_barres && String(s.code_barres).trim() === cb) || normaliserNom(s.article) === nom;
      if (!mem) return;
      if (!best || String(s.releve_le) > String(best.releve_le)) best = s;
    });
    return best;
  }

  // ---- Lot P1-B : natures, TVA confirmée, justifications ----
  const NATURES = {
    produit_commercial: 'Produit commercial',
    service_commercial: 'Service commercial',
    operation_caisse: 'Opération de caisse',
    demarque_perime_casse: 'Démarque : périmé ou casse',
    a_identifier: 'À identifier',
  };
  const MOTIFS_JUSTIFICATION = {
    dlc: 'DLC courte', fin_gamme: 'Fin de gamme', emballage_deteriore: 'Emballage détérioré', surstock: 'Surstock', autre: 'Autre motif',
  };
  const PV_UN_EURO_MIN = 0.98, PV_UN_EURO_MAX = 1.02, QTE_A_IDENTIFIER_MIN = 100;

  // Lignes déclaratives en vigueur : ni annulées, ni remplacées par une correction non annulée.
  function actives(lignes, cleDate) {
    const l = (lignes || []).filter(x => x && !x.annule_le);
    const remplacees = new Set(l.map(x => x.remplace_id).filter(Boolean));
    return l.filter(x => !remplacees.has(x.id)).sort((a, b) => String(b[cleDate] || '').localeCompare(String(a[cleDate] || '')));
  }
  // Une déclaration se rattache au code-barres exact, sinon au nom normalisé s'il est unique sur le site.
  function trouverDeclaration(lignesActives, row, nomUnique) {
    const cb = row.code_barres ? String(row.code_barres).trim() : '';
    const k = normaliserNom(row.article);
    if (cb) { const h = lignesActives.find(x => x.code_barres && String(x.code_barres).trim() === cb); if (h) return h; }
    if (k && nomUnique) return lignesActives.find(x => !x.code_barres && normaliserNom(x.article) === k) || lignesActives.find(x => normaliserNom(x.article) === k) || null;
    return null;
  }
  function virgule(n) { return String(n).replace('.', ','); }
  // « le JJ/MM/AAAA » si la date est lisible, sinon rien : jamais de « le » orphelin en fin de raison.
  function dateLe(iso) { const d = dateFr(iso); return d ? ' le ' + d : ''; }
  function dateFr(iso) { const j = jourIso(iso); return j ? j.slice(8, 10) + '/' + j.slice(5, 7) + '/' + j.slice(0, 4) : ''; }

  // Trois états de TVA. Jamais de correction d'un taux à partir du rayon : on signale, on ne déduit pas.
  //   confirmee : un responsable a confirmé le taux (table produits_tva_confirmations).
  //   importee  : taux Decenium cohérent, non confirmé.
  //   incoherente : taux vide, différent d'une période à l'autre, ou 0 % alors que le rayon est taxé, ou différent du taux confirmé.
  // Un export postérieur à la confirmation qui apporte un taux différent ramène la référence à « incohérente ».
  // Un export antérieur ou égal à la confirmation n'invalide pas la confirmation : le responsable corrige un taux qu'il sait faux.
  function etatTva(tva, tvaPrecedente, rayonTaxe, confirmation, exportLe) {
    if (confirmation) {
      const c = num(confirmation.taux_confirme);
      const confLe = jourIso(confirmation.confirme_le);
      const exp = jourIso(exportLe);
      if (tva !== null && tva !== c) {
        if (confLe && exp && exp <= confLe) {
          return { etat: 'confirmee', taux: c, raison: 'TVA confirmée à ' + virgule(c) + ' %' + dateLe(confirmation.confirme_le) + ' · Decenium exporte ' + virgule(tva) + ' %, différent du taux confirmé ' + virgule(c) + ' %', confirme: c, ecart_export: tva };
        }
        return { etat: 'incoherente', taux: tva, raison: 'taux importé ' + virgule(tva) + ' % différent du taux confirmé ' + virgule(c) + ' %' + dateLe(confirmation.confirme_le), confirme: c };
      }
      return { etat: 'confirmee', taux: c, raison: 'TVA confirmée à ' + virgule(c) + ' %' + dateLe(confirmation.confirme_le), confirme: c };
    }
    if (tva === null) return { etat: 'incoherente', taux: null, raison: 'TVA absente de l\'import' };
    if (tvaPrecedente !== null && tvaPrecedente !== undefined && tvaPrecedente !== tva) {
      return { etat: 'incoherente', taux: tva, raison: 'TVA différente sur la période précédente (' + virgule(tvaPrecedente) + ' %), comparaison avec la seule période précédente' };
    }
    if (tva === 0 && rayonTaxe) return { etat: 'incoherente', taux: tva, raison: 'TVA importée à 0 % alors que d\'autres références du rayon sont taxées' };
    return { etat: 'importee', taux: tva, raison: 'TVA importée de Decenium, non confirmée' };
  }

  // Exclusion d'une opération de caisse des indicateurs commerciaux : on garde les lignes, on retire du classement.
  // Articles de caisse hors catalogue : codés par règle NEXUS. Le libellé change à chaque vente (préfixe de date
  // JJ-MM-AAAA, complément libre) et l'article n'a jamais de code-barres : une déclaration par libellé ne suivrait pas.
  const ARTICLES_CAISSE_HORS_CATALOGUE = ['ACOMPTE'];
  // On retire un préfixe de date en tête, puis le libellé doit commencer par le mot entier. Jamais de recherche ailleurs.
  function articleCaisseHorsCatalogue(article) {
    const k = normaliserNom(article).replace(/^\s*\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\s*[-:]?\s*/, '').toUpperCase();
    return ARTICLES_CAISSE_HORS_CATALOGUE.some(mot => k === mot || (k.startsWith(mot) && !/^[\p{L}\p{N}_]/u.test(k.slice(mot.length))));
  }
  // Libellé daté : JJ-MM-AAAA suivi d'au moins un mot qui n'est pas ACOMPTE (règle du pilote, 18/11/2026) = sortie de stock par bon de livraison,
  // compte périmé et casse. Date en tête seulement, jamais au milieu ; une date seule ou suivie d'ACOMPTE n'en relève pas.
  function libelleDateDemarque(article) {
    const m = normaliserNom(article).match(/^\s*\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\s*[-:]?\s*(.*)$/u);
    if (!m) return false;
    const reste = m[1].trim();
    return /[\p{L}\p{N}]/u.test(reste) && !articleCaisseHorsCatalogue(article);
  }
  // Déclaration d'un responsable en priorité ; à défaut, la règle NEXUS (objet marqué regle: true, sans id).
  function natureDe(natures, row, nomUnique) {
    const d = trouverDeclaration(natures, row, nomUnique);
    if (d && NATURES[d.nature]) return d;
    if (articleCaisseHorsCatalogue(row.article)) return { nature: 'operation_caisse', regle: true, declare_par: 'règle NEXUS', declare_le: null, commentaire: 'Article de caisse hors catalogue', id: null };
    if (libelleDateDemarque(row.article)) return { nature: 'demarque_perime_casse', regle: true, declare_par: 'règle NEXUS', declare_le: null, commentaire: 'Libellé daté : sortie de stock par bon de livraison, compte périmé et casse (règle du pilote, 18/11/2026).', id: null };
    return null;
  }

  // products : lignes de la période affichée (un site). precedent : { rows, debut, fin } de la période importée précédente.
  // releves : lignes stock_releves. dateReference : date de comparaison du stock (par défaut la fin de la période).
  function mesurer(args, opts) {
    const a = args || {};
    const d = dependances(opts);
    const S = d.seuils;
    const rows = a.products || [];
    const site = a.site || null;
    const per = { debut: a.periodeDebut, fin: a.periodeFin };
    const natures = actives(a.natures, 'declare_le');
    const tvaConf = actives(a.tvaConfirmations, 'confirme_le');
    const justifs = actives(a.justifications, 'valide_le');
    const idxCur = indexerParNom(rows);
    const natureLigne = rows.map((r, i) => natureDe(natures, r, idxCur.get(normaliserNom(r.article)) === i));
    const hors = (nat) => !!(nat && nat.nature === 'operation_caisse');
    // Le classement ne porte que sur les lignes commerciales : une opération de caisse reste dans les données importées.
    const gardees = [];
    rows.forEach((r, i) => { if (!hors(natureLigne[i])) gardees.push(i); });
    const clCur = classer(gardees.map(i => rows[i]), per.debut, per.fin, opts);
    const cur = { resume: clCur.resume, jours: clCur.jours, resultats: new Array(rows.length).fill(null) };
    gardees.forEach((i, k) => { cur.resultats[i] = clCur.resultats[k]; });
    const prevRowsAll = a.precedent && a.precedent.rows && a.precedent.rows.length ? a.precedent.rows : null;
    let prev = null;
    if (prevRowsAll) {
      const idxP = indexerParNom(prevRowsAll);
      const gp = [];
      prevRowsAll.forEach((r, i) => { if (!hors(natureDe(natures, r, idxP.get(normaliserNom(r.article)) === i))) gp.push(i); });
      const clP = classer(gp.map(i => prevRowsAll[i]), a.precedent.debut, a.precedent.fin, opts);
      const resP = new Array(prevRowsAll.length).fill(null);
      gp.forEach((i, k) => { resP[i] = clP.resultats[k]; });
      prev = { cl: { resultats: resP, jours: clP.jours }, rows: prevRowsAll, idx: idxP, debut: a.precedent.debut, fin: a.precedent.fin };
    }
    // Rayons où au moins une référence est taxée (pour repérer un 0 % isolé).
    const rayonsTaxes = new Map();
    rows.forEach((r, i) => {
      if (hors(natureLigne[i])) return;
      const t = r.tva === null || r.tva === undefined || r.tva === '' ? null : num(r.tva);
      if (t !== null && t > 0) rayonsTaxes.set(r.categorie || '', (rayonsTaxes.get(r.categorie || '') || 0) + 1);
    });
    const dateRef = a.dateReference || per.fin;
    const mesures = rows.map((r, i) => {
      const nat = natureLigne[i];
      const c = cur.resultats[i] || { qualification: null, taux: num(r.ca) > 0 && num(r.marge) !== null ? num(r.marge) / num(r.ca) * 100 : null, rang: null, total: cur.resume.referencesMargePositive,
        partMargeRayon: null, partCaRayon: null, position: null, raison: null, rayon: null, fort: false, faible: false, eligible: false };
      const qte = num(r.quantite), marge = num(r.marge), ca = num(r.ca), pmp = num(r.prix_achat), pv = num(r.prix_vente);
      const tva = r.tva === null || r.tva === undefined || r.tva === '' ? null : num(r.tva);
      const exportLe = jourIso(r.periode_fin) || jourIso(per.fin);
      const m = { article: r.article, categorie: r.categorie || null, qualificationCle: c.qualification, qualification: QUALIFICATIONS[c.qualification] };
      m.nature = { cle: nat ? nat.nature : 'produit_commercial', libelle: NATURES[nat ? nat.nature : 'produit_commercial'], declaree: !!nat && !nat.regle, source: nat ? (nat.regle ? 'règle NEXUS' : 'déclaration') : null,
        declare_par: nat ? nat.declare_par : null, declare_le: nat ? nat.declare_le : null, commentaire: nat ? nat.commentaire || null : null, id: nat ? nat.id : null };
      m.exclue_indicateurs = m.nature.cle === 'operation_caisse';
      m.pmp = valeur(pmp, 'Export Decenium', per, 'exporte', site); m.pmp.date_export = exportLe;
      m.pv_ht = valeur(pv, 'Export Decenium', per, 'exporte', site);
      const prevRow = prev && idxCur.get(normaliserNom(r.article)) === i && prev.idx.has(normaliserNom(r.article)) ? prev.rows[prev.idx.get(normaliserNom(r.article))] : null;
      const tvaP = prevRow ? (prevRow.tva === null || prevRow.tva === undefined || prevRow.tva === '' ? null : num(prevRow.tva)) : null;
      const autresTaxes = (rayonsTaxes.get(r.categorie || '') || 0) - (tva !== null && tva > 0 ? 1 : 0);
      const confRow = trouverDeclaration(tvaConf, r, idxCur.get(normaliserNom(r.article)) === i);
      const et = etatTva(tva, tvaP, autresTaxes > 0, confRow, exportLe);
      m.tva = { etat: et.etat, taux_importe: tva, taux_retenu: et.etat === 'incoherente' ? null : et.taux, raison: et.raison, ecart_export: et.ecart_export === undefined ? null : et.ecart_export,
        confirmation: confRow ? { id: confRow.id, taux: num(confRow.taux_confirme), confirme_par: confRow.confirme_par, confirme_le: confRow.confirme_le, commentaire: confRow.commentaire || null } : null };
      if (pv === null) {
        m.pv_ttc = Object.assign(valeur(null, 'Calcul NEXUS', per, 'non_disponible', site), { mention: 'TTC non disponible' });
      } else if (et.etat === 'incoherente') {
        m.pv_ttc = Object.assign(valeur(null, 'Calcul NEXUS', per, 'a_verifier', site), { mention: 'TTC à vérifier' });
      } else {
        m.pv_ttc = valeur(arrondi(pv * (1 + et.taux / 100), 2), 'PV HT x (1 + TVA)', per, et.etat === 'confirmee' ? 'confirme' : 'calcule', site);
        m.pv_ttc.mention = et.etat === 'confirmee' ? null : 'TVA importée de Decenium, non confirmée';
      }
      if (tva !== null) m.pv_ttc.tva = tva;
      m.pv_ttc.tva_etat = et.etat; m.pv_ttc.raison = et.raison;
      m.marge_unitaire = valeur(qte && qte > 0 && marge !== null ? marge / qte : null, 'Marge HT de la période / unités', per, 'estime', site);
      m.marge_totale = valeur(marge, 'Marge estimée au PMP du ' + (exportLe || 'export'), per, 'estime', site);
      m.taux_marque = valeur(c.taux, 'Marge / CA HT', per, 'calcule', site);
      m.rang = valeur(c.rang, 'Rang de la marge HT totale', per, c.rang === null ? 'non_classe' : 'calcule', site);
      m.rang.sur = c.total;
      m.part_marge_rayon = valeur(c.partMargeRayon, 'Part de la marge du rayon', per, 'calcule', site);
      m.part_ca_rayon = valeur(c.partCaRayon, 'Part du CA du rayon', per, 'calcule', site);
      m.position_taux = valeur(c.position, 'Quartiles du rayon', per, c.position ? 'calcule' : 'non_comparable', site);
      m.position_taux.raison = c.raison ? RAISONS_NON_COMPARABLE[c.raison] : null;
      m.position_taux.rayon = c.rayon ? { references: c.rayon.nb, p25: c.rayon.p25, p75: c.rayon.p75 } : null;
      m.fort = c.fort; m.faible = c.faible; m.eligible = c.eligible;
      m.eligibilite = { unites: qte, minimum: cur.resume.seuilUnites, jours: cur.jours };
      // Confirmation sur la période précédente : même nom normalisé, désignant une seule référence de chaque côté.
      m.confirmation = { disponible: false, forte_contribution_confirmee: false, qualification_confirmee: false,
        precedente: null, duree_actuelle_jours: cur.jours, duree_precedente_jours: null };
      const k = normaliserNom(r.article);
      if (prev && idxCur.get(k) === i && prev.idx.has(k) && prev.cl.resultats[prev.idx.get(k)] && cur.resultats[i]) {
        const p = prev.cl.resultats[prev.idx.get(k)];
        m.confirmation = { disponible: true, forte_contribution_confirmee: !!(c.fort && p.fort),
          qualification_confirmee: !!(c.qualification && c.qualification !== 'sans_qualification' && c.qualification === p.qualification),
          precedente: QUALIFICATIONS[p.qualification], precedente_cle: p.qualification,
          duree_actuelle_jours: cur.jours, duree_precedente_jours: prev.cl.jours, periode_precedente: { debut: prev.debut, fin: prev.fin } };
      }
      // Stock théorique Decenium et couverture estimée : jamais présenté comme compté.
      const rel = dernierReleve(a.stockReleves, r);
      m.stock = { disponible: false };
      if (rel && num(rel.quantite_theorique) !== null) {
        const q = num(rel.quantite_theorique), date = jourIso(rel.releve_le);
        const age = ms(dateRef) !== null && ms(date) !== null ? Math.round((ms(dateRef) - ms(date)) / 86400000) : null;
        const service = m.nature.cle === 'service_commercial';
        const ventesJour = !service && qte !== null && cur.jours ? qte / cur.jours : null;
        m.stock = { disponible: true, quantite: q, date, source: 'Stock théorique Decenium', fiabilite: 'theorique',
          valeur_pmp: pmp !== null ? arrondi(q * pmp, 2) : null, ventes_par_jour: ventesJour,
          couverture_jours: ventesJour && ventesJour > 0 ? q / ventesJour : null,
          service: service, ventes_periode: { debut: per.debut, fin: per.fin }, donnees_anciennes: age !== null && age > S.joursStockAncien, age_jours: age, site };
      }
      // Signal sans exclusion : prix voisin de 1 € et forte quantité (quantité possiblement exprimée en euros).
      const prixUnEuro = pv !== null && pv >= PV_UN_EURO_MIN && pv <= PV_UN_EURO_MAX;
      m.a_identifier = !m.exclue_indicateurs && (m.nature.cle === 'a_identifier' || (!m.nature.declaree && prixUnEuro && qte !== null && qte >= QTE_A_IDENTIFIER_MIN));
      m.quantite_possiblement_en_euros = m.nature.cle === 'service_commercial' && prixUnEuro;
      // Observation factuelle des ventes quotidiennes, jamais une tendance confirmée.
      m.observation = null;
      if (prevRow && !m.exclue_indicateurs) {
        const qP = num(prevRow.quantite), caP = num(prevRow.ca), jP = prev.cl.jours;
        const vjP = qP !== null && jP ? qP / jP : null, vjC = qte !== null && cur.jours ? qte / cur.jours : null;
        if (vjP && vjP > 0 && vjC !== null) {
          const evo = (vjC - vjP) / vjP;
          const hausse = global.NexusConseiller && global.NexusConseiller.SEUIL_HAUSSE !== undefined ? global.NexusConseiller.SEUIL_HAUSSE : 0.2;
          const baisse = global.NexusConseiller && global.NexusConseiller.SEUIL_BAISSE !== undefined ? global.NexusConseiller.SEUIL_BAISSE : -0.3;
          if (evo >= hausse || evo <= baisse) {
            m.observation = { sens: evo > 0 ? 'hausse' : 'baisse', ventes_jour_precedent: vjP, ventes_jour_actuel: vjC, variation_pct: evo * 100,
              ca_precedent: caP, periode_precedente: { debut: prev.debut, fin: prev.fin },
              libelle: evo > 0 ? 'Ventes quotidiennes plus élevées sur la dernière période' : 'Ventes quotidiennes plus faibles sur la dernière période' };
          }
        }
      }
      // Déstockage justifié : valable pour la seule période affichée. La marge et le CA ne changent jamais.
      m.marge_negative = marge !== null && marge < 0 && !m.exclue_indicateurs;
      const just = m.marge_negative ? trouverDeclaration(justifs.filter(x => jourIso(x.periode_debut) === jourIso(per.debut) && jourIso(x.periode_fin) === jourIso(per.fin)), r, idxCur.get(normaliserNom(r.article)) === i) : null;
      m.justification = just ? { id: just.id, motif: just.motif, libelle: MOTIFS_JUSTIFICATION[just.motif] || just.motif, commentaire: just.commentaire || null, valide_par: just.valide_par, valide_le: just.valide_le } : null;
      m.explication = explication(m, cur.resume);
      return m;
    });
    // Synthèse de l'accueil : réconciliation CA analytique, opérations de caisse, CA importé ; compteurs distincts.
    let caAnalytique = 0, caCaisse = 0, nbCaisse = 0, neg = 0, justifiees = 0, aIdentifier = 0;
    mesures.forEach((m, i) => {
      const ca = num(rows[i].ca) || 0;
      if (m.exclue_indicateurs) { caCaisse += ca; nbCaisse++; } else caAnalytique += ca;
      if (m.marge_negative) { neg++; if (m.justification) justifiees++; }
      if (m.a_identifier) aIdentifier++;
    });
    cur.resume.synthese = {
      ca_analytique: arrondi(caAnalytique, 2), operations_caisse: arrondi(caCaisse, 2), ca_importe: arrondi(caAnalytique + caCaisse, 2), references_operations_caisse: nbCaisse,
      marge_negative: neg, destockages_justifies: justifiees, marges_a_verifier: neg - justifiees, references_a_identifier: aIdentifier,
    };
    const index = new Map();
    idxCur.forEach((i, k) => index.set(k, mesures[i]));
    return { mesures, index, resume: cur.resume, jours: cur.jours };
  }

  function pct(v, d) { return v === null || v === undefined ? 'n.d.' : v.toFixed(d === undefined ? 1 : d).replace('.', ',') + ' %'; }

  // Phrase factuelle courte pour le Conseiller. Aucune recommandation de suppression.
  function phrase(m) {
    if (!m) return '';
    const cle = m.qualificationCle;
    const lieu = ' de la boutique';
    if (cle === 'fort_taux_non_comparable') return 'Fort contributeur' + lieu + ', taux non comparable' + (m.position_taux.raison ? ' (' + m.position_taux.raison + ')' : '') + '.';
    if (cle === 'fort_ventes_peu_frequentes') return 'Fort contributeur' + lieu + ', à ventes peu fréquentes.';
    if (cle === 'moteur') return 'Produit moteur' + lieu + ' : forte contribution, taux ' + (m.position_taux.valeur === 'haut' ? 'élevé' : 'intermédiaire') + ' dans son rayon.';
    if (cle === 'moteur_volume') return 'Moteur par le volume' + lieu + ' : forte contribution, taux bas dans son rayon.';
    if (cle === 'bon_taux_moyenne') return 'Bon taux dans son rayon, contribution moyenne.';
    if (cle === 'bon_taux_faible') return 'Bon taux dans son rayon, faible contribution.';
    if (cle === 'a_etudier') return 'Faible contribution et taux bas dans son rayon : à étudier.';
    if (cle === 'faible_contribution') return 'Faible contribution à la marge de la boutique.';
    if (cle === 'ventes_insuffisantes') return 'Ventes trop peu fréquentes pour juger le taux.';
    if (cle === 'marge_negative') return 'Marge négative sur la période.';
    return '';
  }

  // Explication détaillée (sous « Comprendre cette analyse ») : rang, dénominateur, position du taux, garde-fous.
  function explication(m, resume) {
    const l = [];
    if (m.rang.valeur !== null) l.push('Rang ' + m.rang.valeur + ' sur ' + m.rang.sur + ' en marge HT totale' + (m.fort ? ' (20 % supérieurs)' : m.faible ? ' (20 % inférieurs)' : '') + '.');
    else if (m.qualificationCle === 'marge_negative') l.push('Marge négative : référence traitée à part, hors classement.');
    if (m.position_taux.valeur) l.push('Taux de marque ' + pct(m.taux_marque.valeur, 2) + ' : ' + (m.position_taux.valeur === 'haut' ? 'haut' : m.position_taux.valeur === 'bas' ? 'bas' : 'intermédiaire')
      + ' (rayon : ' + m.position_taux.rayon.references + ' références, P25 ' + pct(m.position_taux.rayon.p25) + ', P75 ' + pct(m.position_taux.rayon.p75) + ').');
    else if (m.position_taux.raison) l.push('Taux non comparable : ' + m.position_taux.raison + '.');
    if (!m.eligible && m.eligibilite.minimum !== null) l.push('Ventes insuffisantes : ' + (m.eligibilite.unites === null ? 0 : m.eligibilite.unites) + ' unité(s) sur ' + m.eligibilite.jours + ' jours, minimum ' + m.eligibilite.minimum + '.');
    const c = m.confirmation;
    if (c.disponible) {
      const dur = ' (' + c.duree_actuelle_jours + ' jours contre ' + c.duree_precedente_jours + ' jours)';
      if (c.qualification_confirmee) l.push('Qualification confirmée sur la période précédente' + dur + '.');
      else if (c.forte_contribution_confirmee) l.push('Forte contribution confirmée sur la période précédente' + dur + '.');
      else if (c.precedente_cle !== 'sans_qualification') l.push('Période précédente : ' + c.precedente + dur + '.');
    }
    l.push('Marge calculée avec le PMP exporté par Decenium, arrondi à deux décimales.');
    return l;
  }

  global.NexusProduitsMesure = { NATURES, MOTIFS_JUSTIFICATION, etatTva, actives, trouverDeclaration, QUALIFICATIONS, RAISONS_NON_COMPARABLE, mesurer, classer, normaliserNom, indexerParNom, natureDe, articleCaisseHorsCatalogue, libelleDateDemarque, ARTICLES_CAISSE_HORS_CATALOGUE, jours, phrase, explication };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusProduitsMesure;
})(typeof window !== 'undefined' ? window : globalThis);
