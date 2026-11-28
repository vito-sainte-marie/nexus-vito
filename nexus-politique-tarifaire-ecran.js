// Écran 1 « Politique tarifaire » (T3) : lecture seule.
// Toute la logique de calcul reste dans le moteur T2 (NexusPolitiqueTarifaire) ; cet écran ne recalcule rien,
// il agrège, trie, filtre et affiche ce que le moteur rend. Aucune écriture, sauf le panneau « Objectifs de marge » de la fiche (A4-1b), qui passe par deux fonctions SQL.
(function (global) {
  'use strict';

  var T = global.NexusPolitiqueTarifaire || (typeof require === 'function' ? require('./nexus-politique-tarifaire.js') : null);
  var PM = global.NexusProduitsMesure || (typeof require === 'function' ? require('./nexus-produits-mesure.js') : null);
  var AR = global.NexusPolitiqueTarifaireRegistres || (typeof require === 'function' ? require('./nexus-politique-tarifaire-registres.js') : null);
  var V = global.NexusVocabTarif || (typeof require === 'function' ? require('./nexus-vocabulaire-tarif.js') : null);
  var CP = global.NexusComposantsPilotage || (typeof require === 'function' ? (function () { try { return require('./nexus-composants-pilotage.js'); } catch (e) { return null; } })() : null);
  var RF = global.NexusRayonsFamilles || (typeof require === 'function' ? (function () { try { return require('./nexus-rayons-familles.js'); } catch (e) { return null; } })() : null);
  var NI = global.NexusIcones || (typeof require === 'function' ? (function () { try { return require('./nexus-icones.js'); } catch (e) { return null; } })() : null);
  var NCM = global.NexusCibleMarge || (typeof require === 'function' ? require('./nexus-cible-marge.js') : null);
  var B = global.NexusBadgeEtat || (typeof require === 'function' ? require('./nexus-badge-etat.js') : null);

  var RANG_GRAVITE = { critique: 0, a_verifier: 1, information: 2 };
  var ETATS_REGL_OUVERTS = ['controle_ouvert', 'a_completer', 'non_conforme'];
  var ETATS_PRIX_NON_CONSTATES = ['decide', 'saisie_declaree', 'ecart_constate'];
  var LIB_STATUT = {
    a_verifier: 'À vérifier', proposition_a_valider: 'Proposition à valider', a_surveiller: 'À surveiller',
    conforme: 'Conforme', sans_seuil_valide: 'Sans seuil validé'
  };
  var LIB_FIABILITE = { fiable: 'Fiable', a_confirmer: 'À confirmer', insuffisante: 'Insuffisante' };
  var LIB_REGLE = { famille: 'Seuil de la famille', rayon: 'Seuil du rayon', defaut: 'Seuil par défaut' };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var graviteBadge = function (g) { return String(g).replace('_', '-'); };
  var num = function (v) { return (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v); };
  var eur = function (v) { var n = num(v); return n === null ? 'n/d' : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; };
  var eur0 = function (v) { var n = num(v); return n === null ? 'n/d' : Math.round(n).toLocaleString('fr-FR') + ' €'; };
  var pct = function (v) { var n = num(v); return n === null ? 'n/d' : (n * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; };
  var jourFr = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : 'n/d'; };

  function libellePeriode(p) {
    return p && p.debut && p.fin ? 'du ' + jourFr(p.debut) + ' au ' + jourFr(p.fin) : 'période inconnue';
  }

  // ---------- Régime de prix : règle du Scanner T1 fournie au moteur ----------
  // Contractuel avant famille exclue avant libre. Le registre des régimes (tarif_regimes_prix) reste prioritaire dans le moteur.
  function regimeDe(o) {
    o = o || {};
    var contr = o.contractuels || { has: function () { return false; } };
    return function (row) {
      var cle = String(row.code_barres || '').trim() || (o.normaliser ? o.normaliser(row.article) : String(row.article || '').trim().toLowerCase());
      if (contr.has(cle)) return 'contractuel';
      var fam = o.famille ? o.famille(row.categorie, row.article, o.exclusions) : null;
      if (!fam || !fam.exclue) return null;
      // Gaz : seul le 12,5 kg a un prix maximum préfectoral mensuel. Le régime des autres formats reste à décider : jamais « libre ».
      if (fam.id === 'gaz') return /(^|[^\d])12[.,]5\s*kg/i.test(String(row.article || '')) ? 'reglemente' : 'a_qualifier';
      return 'reglemente';
    };
  }


  // ---------- Contexte déclaratif du moteur : même lecture que le Scanner T1 (natures, justifications de la période, TVA confirmée) ----------
  // Sans lui, une perte justifiée redevient injustifiée et une opération de caisse est analysée comme une vente.
  // stockFourni vaut false : la page ne charge pas de relevé de stock avec PA net HT, le moteur n'écrit alors qu'une limite.
  function contexteDeclaratif(declarations, rows, periode) {
    var d = declarations || {}, R = rows || [];
    var jourIso = function (x) { return x ? String(x).slice(0, 10) : ''; };
    var natures = PM.actives(d.produits_nature_reference || [], 'declare_le');
    var justifs = PM.actives(d.produits_justifications_marge || [], 'valide_le');
    if (periode) justifs = justifs.filter(function (x) { return jourIso(x.periode_debut) === jourIso(periode.debut) && jourIso(x.periode_fin) === jourIso(periode.fin); });
    var ix = PM.indexerParNom(R);
    var position = new Map(); R.forEach(function (r, i) { position.set(r, i); });
    return {
      natureDe: function (row) {
        var nomUnique = ix.get(PM.normaliserNom(row.article)) === position.get(row);
        var n = PM.natureDe(natures, row, nomUnique);
        return n ? n.nature : null;
      },
      justifications: justifs,
      tva: { confirmations: PM.actives(d.produits_tva_confirmations || [], 'confirme_le') },
      stockFourni: false
    };
  }

  // ---------- Contexte complet du moteur : UNE seule construction, appelée par la page ET par le test de parité ----------
  // sources : { registres, declarations, lignes, periode, exclusions, famille, stock, stockSource, motifsDivergents, tvaExplications }
  //  - registres : registres tarifaires déjà filtrés par site ;
  //  - lignes : lignes de ventes de la période (objets) ; declarations : tables Produits (natures, justifications, TVA confirmée) ;
  //  - stock : relevé brut [{libelle, pa_net_ht}] ou null (alors stockFourni vaut false) ; rapproché par libellé normalisé, jamais par code-barres.
  // Règle du Scanner T1 : libellé exact (espaces normalisés, casse respectée), première ligne rencontrée retenue.
  // Un même libellé exact avec deux coûts différents est compté (conflits) : le choix de la ligne reste à arbitrer.
  // Un libellé dont les lignes portent des PA différents est retenu SANS PA (coût ambigu) : aucun coût tiré au hasard.
  function stockParLibelle(brut) {
    var par = new Map(), conflits = 0, ambigus = [];
    (brut || []).forEach(function (r) {
      var pa = num(r.pa_net_ht), lib = PM.normaliserNom(r.libelle), k = lib.toLowerCase(); // le moteur rapproche sans tenir compte de la casse
      if (!k || pa === null) return;
      var e = par.get(k);
      if (!e) par.set(k, { article: lib, pa_net_ht: pa, n: 1, min: pa, max: pa });
      else { e.n++; if (pa < e.min) e.min = pa; if (pa > e.max) e.max = pa; }
    });
    var lignes = [];
    par.forEach(function (e) {
      if (e.max - e.min > 0.005) {
        conflits++;
        var f = function (x) { return String(Math.round(x * 100) / 100).replace('.', ','); };
        var motif = 'coût ambigu dans le relevé : ' + e.n + ' lignes, PA de ' + f(e.min) + ' à ' + f(e.max);
        ambigus.push({ article: e.article, motif: motif });
        lignes.push({ article: e.article, pa_net_ht: null, ambigu: motif });
      } else lignes.push({ article: e.article, pa_net_ht: e.pa_net_ht });
    });
    return { lignes: lignes, conflits: conflits, ambigus: ambigus, libelles: par.size };
  }
  // Taux de TVA confirmés par le pilote le 18/11/2026. Données de paramétrage portées par le contexte, pas un registre :
  // le registre produits_tva_confirmations passe en premier s'il couvre la référence. Premier élément qui correspond gagne.
  // Recharges : Digicel Haïti à 0 % ; Digicel (hors Haïti), Orange, SFR à 8,5 % ; toute autre recharge à 0 %.
  var TR = global.NexusTvaReglesPilote || (typeof require === 'function' ? require('./nexus-tva-regles-pilote.js') : null);
  var TVA_CONFIRMATIONS_PILOTE = TR.TVA_CONFIRMATIONS_PILOTE, SITE_PILOTE = TR.SITE_PILOTE;
  function construireContexteTarif(sources) {
    var S = sources || {};
    var base = { periode: S.periode };
    if (S.exclusions || S.famille) {
      base.regimeDe = regimeDe({ contractuels: new Set(), exclusions: S.exclusions || new Set(), normaliser: PM.normaliserNom, famille: S.famille });
    }
    Object.assign(base, contexteDeclaratif(S.declarations, S.lignes, S.periode));
    if (S.stock) {
      var st = stockParLibelle(S.stock);
      base.stock = st.lignes; base.stockFourni = true; base.stockSource = S.stockSource || 'valorisation du stock Decenium, colonne « PA net HT »';
    } else base.stockFourni = false;
    if (S.motifsDivergents) base.motifsDivergents = S.motifsDivergents;
    if (S.site === SITE_PILOTE) base.tva = Object.assign({}, base.tva, { confirmations: ((base.tva && base.tva.confirmations) || []).concat(TVA_CONFIRMATIONS_PILOTE) });
    if (S.tvaExplications) base.tva = Object.assign({}, base.tva, { explications: S.tvaExplications });
    return AR.contexteDepuisRegistres(S.registres, base);
  }

  // Démarque (périmé ou casse) : libellé préfixé d'une date jj-mm-aaaa. Règle d'affichage seulement, le moteur n'est pas modifié.
  var LIB_DEMARQUE = 'Démarque : périmé ou casse';
  function estDemarque(l) { return !!l && /^\d{2}-\d{2}-\d{4}\s/.test(String(l.article || '')); }
  function sansDemarque(L) { return (L || []).filter(function (l) { return !estDemarque(l); }); }
  function alerteDe(l, code) { return (l.alertes || []).filter(function (a) { return a.code === code; })[0] || null; }
  function lignesAlerte(L, code) { return L.filter(function (l) { return !!alerteDe(l, code); }); }
  function montantAlerte(l, code) { var a = alerteDe(l, code); return a && a.consequence ? num(a.consequence.montant) : null; }

  // ---------- Quatre cartes de synthèse (fiche v2) ----------
  function cartes(analyse) {
    var s = analyse.synthese, g = analyse.gains, L = analyse.lignes;
    var per = libellePeriode(s.periode);
    var minimum = g.decisionnels.minimum;
    var a3 = lignesAlerte(sansDemarque(L), 'A3').filter(function (l) { return !l.nature; }), nbPertes = 0, nbNulles = 0, sansJust = 0, pertes = 0;
    a3.forEach(function (l) {
      var m = montantAlerte(l, 'A3'), a = alerteDe(l, 'A3');
      if (m !== null && m > 0) { nbPertes++; pertes += m; } else nbNulles++;
      if (!(a.donnees && a.donnees.justification)) sansJust++;
    });
    var aVerifier = sansDemarque(L).filter(function (l) {
      return l.fiabilite.niveau === 'insuffisante' || ETATS_REGL_OUVERTS.indexOf(l.conformite.etat) >= 0;
    });
    var nonConstates = L.filter(function (l) { return l.prixDecide && ETATS_PRIX_NON_CONSTATES.indexOf(l.prixDecide.etat) >= 0; }).length;
    var sansPrecedente = L.length > 0 && L.every(function (l) { return num(l.tauxPrecedent) === null; });
    return [
      { id: 'marge_negative', titre: 'Ventes à marge négative', valeur: String(a3.length), unite: 'références vendues à perte ou à marge nulle',
        secondaire: nbPertes + ' à perte · ' + nbNulles + ' à marge nulle',
        references: a3.length, periode: per, source: 'Ventes et coûts : dernier export Decenium ; justifications : registres.',
        limite: 'Pertes : ' + eur0(pertes) + '. Sans justification dans les registres : ' + sansJust + '. Pertes et marges nulles comptées à part. La perte est mesurée au volume observé, elle n\'est pas un gain manqué.' },
      { id: 'propositions', titre: 'Propositions à valider', valeur: eur0(minimum.fiable.montant), unite: '€ de gain, scénario minimum, références fiables',
        secondaire: eur0(minimum.a_confirmer.montant) + ' à confirmer', references: minimum.fiable.references, periode: per,
        source: 'Ventes et coûts : dernier export Decenium ; seuils : registres tarifaires.',
        limite: 'Gain théorique à volume constant, non cumulable avec le scénario cible. Les références à confirmer ne sont pas comptées dans le chiffre principal.' },
      { id: 'a_verifier', titre: 'Références à fiabilité incomplète', valeur: String(aVerifier.length), unite: 'références',
        secondaire: 'coût, TVA ou prix à revoir', references: aVerifier.length,
        periode: per, source: 'Moteur de politique tarifaire sur le dernier export Decenium et les registres.',
        limite: (sansPrecedente ? 'Sans période précédente : les variations de prix et de coût ne sont pas mesurées. ' : '') + 'Ces références restent hors des gains.' },
      { id: 'non_constates', titre: 'Prix décidés non constatés', valeur: String(nonConstates), unite: 'références',
        secondaire: 'pas encore vu en caisse', references: nonConstates,
        periode: per, source: 'Prix décidés : registres ; prix moyen constaté : dernier export Decenium.',
        limite: 'Le prix moyen de la période ne prouve pas à lui seul le prix affiché en rayon.' }
    ];
  }

  // Trois scénarios affichés côte à côte, jamais additionnés.
  function scenarios(analyse) {
    var d = analyse.gains.decisionnels;
    return [['prixDecides', 'Prix décidés'], ['minimum', 'Minimum'], ['cible', 'Cible']].map(function (x) {
      var v = d[x[0]];
      return { id: x[0], libelle: x[1], fiable: v.fiable.montant, aConfirmer: v.a_confirmer.montant, references: v.fiable.references };
    });
  }

  // ---------- Alertes ----------
  function alertesCartes(analyse) {
    var table = T.ALERTES, comptes = Object.assign({}, analyse.synthese.alertes || {}), hors = sansDemarque(analyse.lignes);
    comptes.A3 = lignesAlerte(hors, 'A3').length; comptes.A5 = lignesAlerte(hors, 'A5').length;
    return Object.keys(table).sort().map(function (code) {
      var a = table[code];
      return { code: code, libelle: a.libelle, gravite: a.gravite, action: a.action, nombre: comptes[code] || 0 };
    });
  }

  // ---------- Tri, filtres ----------
  function graviteLigne(l) {
    var r = 3;
    (l.alertes || []).forEach(function (a) { if (RANG_GRAVITE[a.gravite] < r) r = RANG_GRAVITE[a.gravite]; });
    return r;
  }
  function montantLigne(l) {
    var m = 0;
    (l.alertes || []).forEach(function (a) { var v = a.consequence && num(a.consequence.montant); if (v !== null && Math.abs(v) > m) m = Math.abs(v); });
    return m;
  }
  function trier(lignes) {
    return lignes.slice().sort(function (a, b) {
      return graviteLigne(a) - graviteLigne(b) || montantLigne(b) - montantLigne(a) || String(a.article).localeCompare(String(b.article), 'fr');
    });
  }
  function filtrer(lignes, f) {
    f = f || {};
    var q = String(f.recherche || '').trim().toLowerCase();
    return lignes.filter(function (l) {
      if (q && String(l.article).toLowerCase().indexOf(q) < 0 && String(l.code_barres || '').indexOf(q) < 0) return false;
      if (f.famille && l.famille !== f.famille) return false;
      if (f.rayon && l.rayon !== f.rayon) return false;
      if (f.statut && l.statut !== f.statut) return false;
      if (f.fiabilite && l.fiabilite.niveau !== f.fiabilite) return false;
      if (f.hors_insuffisante && l.fiabilite.niveau === 'insuffisante') return false;
      if (f.exception === 'avec' && !l.exception) return false;
      if (f.exception === 'sans' && l.exception) return false;
      if (f.alerte && !(l.alertes || []).some(function (a) { return a.code === f.alerte; })) return false;
      return true;
    });
  }
  function valeursFiltres(lignes) {
    var u = function (k) { var s = {}; lignes.forEach(function (l) { if (l[k]) s[l[k]] = 1; }); return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'fr'); }); };
    return { famille: u('famille'), rayon: u('rayon') };
  }

  // Preuves techniques : références de fiabilité insuffisante, derrière un seul chevron.
  function preuves(analyse) {
    return sansDemarque(analyse.lignes).filter(function (l) { return l.fiabilite.niveau === 'insuffisante'; })
      .map(function (l) { return { article: l.article, raisons: l.fiabilite.raisons || [], mention: 'donnée à corriger' }; });
  }

  // ---------- Conseiller ----------
  var plur = function (n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); };
  function controlesActifs(analyse) {
    var n = 0;
    ((analyse && analyse.lignes) || []).forEach(function (l) { (l.anomalies || []).forEach(function (x) { if (['nouvelle', 'persistante', 'aggravee'].indexOf(x.cycle || 'nouvelle') >= 0) n++; }); });
    return n;
  }
  // L5 : phrase courte du Conseiller, bâtie sur le premier contrôle du tri « gravité décroissante » (aucun chiffre écrit en dur).
  function texteCourtControle(analyse) {
    var L = [];
    ((analyse && analyse.lignes) || []).forEach(function (l) { (l.anomalies || []).forEach(function (x) { if (['nouvelle', 'persistante', 'aggravee'].indexOf(x.cycle || 'nouvelle') >= 0) L.push({ l: l, a: x }); }); });
    L.sort(function (x, y) { return (y.a.gravite || 0) - (x.a.gravite || 0) || String(x.l.article).localeCompare(String(y.l.article), 'fr'); });
    if (!L.length) return null;
    var v = L[0].a.valeurs || {}, c = L[0].a.code, f = null;
    if (c === 'S2') f = ['écart', v.ecart]; else if (c === 'S3') f = ['variation du coût', v.variationCout]; else if (c === 'S6') f = ['variation du prix', v.variationPv];
    var sous = f && num(f[1]) !== null ? f[0] + ' ' + pct(f[1]) : '';
    // Deux lignes : « Le plus grave : <article> » (coupé par « … » si long), puis le chiffre. Le nom complet reste dans le détail.
    return { art: 'Le plus grave : ' + L[0].l.article, sous: sous, article: L[0].l.article, texte: 'Le plus grave : ' + L[0].l.article + (sous ? ', ' + sous : '') };
  }
  // Branche « marge négative » : même format court que l'autre branche. L'article est celui dont la perte unitaire HT est la plus forte ;
  // le bouton « Commencer par » ouvre le contrôle de cette cause (S1) sur cet article, pas la ligne la plus grave du tri.
  function texteCourtVentePerte(analyse) {
    var hors = lignesAlerte(sansDemarque((analyse && analyse.lignes) || []), 'A3'), best = null;
    hors.forEach(function (l) {
      var pu = perteUnitaire(l);
      if (!best || (pu && (!best.pu || pu.perte > best.pu.perte)) || (!pu && !best.pu && String(l.article).localeCompare(String(best.l.article), 'fr') < 0)) best = { l: l, pu: pu };
    });
    if (!best) return null;
    var s1 = (best.l.anomalies || []).filter(function (x) { return x.code === 'S1' && ['nouvelle', 'persistante', 'aggravee'].indexOf(x.cycle || 'nouvelle') >= 0; })[0];
    var sousP = best.pu ? 'perte ' + eur(best.pu.perte) + ' HT/u' : '';
    return { art: 'Vente à perte : ' + best.l.article, sous: sousP, article: best.l.article, texte: 'Vente à perte : ' + best.l.article + (sousP ? ', ' + sousP : ''), cible: s1 ? 'S1|' + best.l.article : null };
  }
  function conseiller(analyse, role) {
    var c = Object.assign({}, analyse.synthese.alertes || {}), st = analyse.synthese.statuts || {};
    // Les références en démarque ne comptent ni dans les ventes à marge négative ni dans les sources qui se contredisent.
    var hors = sansDemarque(analyse.lignes);
    c.A3 = lignesAlerte(hors, 'A3').length; c.A5 = lignesAlerte(hors, 'A5').length;
    var gerant = role === 'gerant' || role === 'createur';
    var pas;
    var vp = c.A3 ? (texteCourtVentePerte(analyse) || {}) : {};
    if (c.A3) pas = { court: vp.texte || null, deux: vp.art ? vp : null, cible: vp.cible || null, bloc: 'controles', code: 'A3', filtre: null, quoi: plur(c.A3, 'référence vendue', 'références vendues') + ' à marge négative', pourquoi: 'chaque vente creuse la caisse tant que le prix ou le coût n\'est pas vérifié' };
    else if (controlesActifs(analyse) > 0) { var nc = controlesActifs(analyse); var tc = texteCourtControle(analyse); pas = { court: tc && tc.texte, deux: tc, code: 'CTRL', filtre: null, bloc: 'controles', quoi: plur(nc, 'contrôle', 'contrôles') + ' à comparer avec Decenium', pourquoi: 'aucune vente n\'est à marge négative ; la liste des contrôles est le premier point à regarder. Un contrôle n\'est pas une erreur constatée' }; }
    else if (c.A8) pas = { court: 'Commencer par les contrôles réglementaires : ' + c.A8 + (c.A8 > 1 ? ' ouverts' : ' ouvert'), code: 'A8', filtre: { alerte: 'A8' }, quoi: plur(c.A8, 'contrôle réglementaire ouvert', 'contrôles réglementaires ouverts'), pourquoi: 'ils bloquent toute proposition de prix sur ces références' };
    else if (st.proposition_a_valider) pas = { court: 'Commencer par les propositions : ' + st.proposition_a_valider + ' à valider', code: 'PROP', filtre: { statut: 'proposition_a_valider' }, quoi: plur(st.proposition_a_valider, 'proposition', 'propositions') + ' à valider', pourquoi: 'c\'est là que se trouve le gain le plus net' };
    else if (c.A5 || c.A4 || c.A7) pas = { court: 'Commencer par les références à vérifier', code: 'VERIF', filtre: { statut: 'a_verifier' }, quoi: 'les références signalées à vérifier', pourquoi: 'des sources se contredisent ou une variation sort de l\'ordinaire' };
    else pas = null;
    if (!pas) return gerant ? { code: 'RAS', texte: 'Rien d\'urgent sur cette période.', detail: 'Aucune alerte forte sur cette période. Vous pouvez surveiller les prix décidés.', filtre: null } : { code: 'RAS', texte: 'Rien d\'urgent sur cette période.', filtre: null };
    var texte = gerant
      ? 'Je vous conseille de commencer par ' + pas.quoi + ' : ' + pas.pourquoi + '.'
      : 'Priorité du jour : ' + pas.quoi + '. Raison : ' + pas.pourquoi + '.';
    if (pas.court) return { code: pas.code, texte: pas.court, detail: (pas.deux && pas.deux.article ? 'Article : ' + pas.deux.article + '. ' : '') + texte, filtre: pas.filtre, bloc: pas.bloc || null, cible: pas.cible || null, art: pas.deux ? pas.deux.art : null, sous: pas.deux ? pas.deux.sous : null };
    return { code: pas.code, texte: texte, filtre: pas.filtre, bloc: pas.bloc || null };
  }

  // ---------- Fiche tarifaire (lecture seule) ----------
  function fiche(l) {
    var r = l.regle;
    return {
      article: l.article, famille: l.famille || null, origineFamille: l.sourceFamille || null, noteFamille: l.noteFamille || null,
      tauxActuel: l.taux, seuil: r ? { niveau: r.niveau, minimum: r.minimum, cible: r.cible, statutMinimum: r.statutMinimum, statutCible: r.statutCible, version: r.seuilApplique !== undefined ? r.seuilApplique : null } : null,
      pvTtc: l.pv_ttc, margeUnitaire: (num(l.pv_ht) !== null && num(l.cout) !== null) ? num(l.pv_ht) - num(l.cout) : null,
      fiabilite: l.fiabilite.niveau, raisons: l.fiabilite.raisons || [],
      exception: l.exception || null, statut: l.statut, raisonStatut: l.raisonStatut || null
    };
  }

  // ---------- Message d'état du compte ----------
  // Une lecture vide ne vaut jamais « compte inactif » : le compte est lu à part.
  function etatAcces(compte, nbLignesRegistres) {
    if (!compte || compte.erreur) return { code: 'illisible', message: 'Impossible de vérifier votre compte' };
    if (compte.actif === false) return { code: 'inactif', message: 'Compte inactif, contactez votre gérant' };
    if (compte.actif === true && !nbLignesRegistres) return { code: 'vide', message: 'Aucune donnée tarifaire pour ce site' };
    if (compte.actif === true) return { code: 'ok', message: null };
    return { code: 'illisible', message: 'Impossible de vérifier votre compte' };
  }

  function peutVoirOnglet(role, estCreateur) { return !!estCreateur || role === 'gerant' || role === 'manager'; }
  // ---------- Contrôles : quatre familles, une carte par alerte du moteur ----------
  var FAMILLES_CTRL = [
    { id: 'pertes', titre: 'Pertes et conformité', codes: ['A3', 'A8'] },
    { id: 'fiabilite', titre: 'Fiabilité des données', codes: ['A4', 'A5', 'FI'] },
    { id: 'decisions', titre: 'Décisions de prix', codes: ['A1', 'A2'] },
    { id: 'exceptions', titre: 'Exceptions validées', codes: ['A6', 'A7', 'EX'] }
  ];
  var TITRES_CTRL = {
    A3: 'Quelles ventes se font à marge négative ?', A8: 'Quels contrôles réglementaires restent ouverts ?',
    A4: 'Quels prix ou coûts varient anormalement ?', A5: 'Quelles sources se contredisent ?', FI: 'Quelles références n\'ont pas de données fiables ?',
    A1: 'Quelles marges baissent par hausse du coût ?', A2: 'Quelles références sont sous leur seuil ?',
    A6: 'Quels produits d\'appel se dégradent ?', A7: 'Quelles exceptions sortent de leurs conditions ?', EX: 'Quelles références vivent sous exception validée ?'
  };
  var NATURES_CTRL = {
    A3: 'perte', A8: 'chiffre d\'affaires concerné, aucun gain', A4: 'écart de valorisation, aucun gain', A5: 'à qualifier, aucun montant',
    FI: 'aucun montant', A1: 'impact estimé', A2: 'gain théorique', A6: 'marge perdue estimée', A7: 'écart au prix déclaré', EX: 'aucun montant'
  };
  var METHODES_CTRL = {
    A3: 'Une vente est à marge négative quand le coût d\'achat dépasse le prix de vente ; à coût égal, la marge est nulle. Montant : écart unitaire multiplié par le volume observé.',
    A8: 'Contrôles ouverts dans le registre réglementaire. Aucune proposition de prix n\'est faite sur ces références.',
    A4: 'Variation de coût d\'au moins 50 % ou écart de plus de 10 % au coût du stock. L\'écart est une valorisation, jamais un gain.',
    A5: 'Sources qui se contredisent : identité changée, régime de prix déclaré, coût nul. Aucun montant n\'est calculé.',
    FI: 'Références dont les données ne permettent pas de conclure. Elles restent hors des gains et des propositions.',
    A1: 'Hausse du coût d\'achat non répercutée. Impact estimé au volume observé, information seulement.',
    A2: 'Taux de marge sous le seuil validé. Gain théorique au seuil, à volume constant. Les références à fiabilité insuffisante n\'apparaissent pas ici.',
    A6: 'Produit d\'appel dont la marge se dégrade au-delà du réglage. Marge perdue estimée au volume observé.',
    A7: 'Prix constaté hors des conditions de l\'exception validée. Écart au prix déclaré, au volume observé.',
    EX: 'Références sous exception validée par le gérant. Ce sont des décisions, pas des anomalies.'
  };
  function filtreControle(code) {
    if (code === 'FI') return { fiabilite: 'insuffisante' };
    if (code === 'EX') return { statut: 'a_surveiller', exception: 'avec' };
    if (code === 'A1' || code === 'A2') return { alerte: code, hors_insuffisante: true };
    return { alerte: code };
  }
  function lignesControle(L, code) {
    if (code === 'FI') return sansDemarque(L).filter(function (l) { return l.fiabilite.niveau === 'insuffisante'; });
    if (code === 'EX') return L.filter(function (l) { return l.statut === 'a_surveiller' && l.exception; });
    var r = lignesAlerte(code === 'A3' || code === 'A5' ? sansDemarque(L) : L, code);
    if (code === 'A1' || code === 'A2') r = r.filter(function (l) { return l.fiabilite.niveau !== 'insuffisante'; });
    return r;
  }
  function controle(analyse, code, familleId) {
    var meta = code === 'FI' ? { gravite: 'a_verifier', action: 'verifier' } : code === 'EX' ? { gravite: 'information', action: 'surveiller' } : T.ALERTES[code];
    var lignes = trier(lignesControle(analyse.lignes, code)), montant = null;
    var sousTotaux = null;
    if (code === 'A1') {
      // Jamais de total de grandeurs différentes : prix libres et prix réglementés ou contractuels restent séparés.
      sousTotaux = { libres: { nombre: 0, montant: 0 }, reglementes: { nombre: 0, montant: 0 } };
      lignes.forEach(function (l) { var m = montantAlerte(l, 'A1'), k = typeRegime(l) ? 'reglementes' : 'libres'; sousTotaux[k].nombre++; if (m !== null) sousTotaux[k].montant += m; });
    } else if (code !== 'FI' && code !== 'EX') lignes.forEach(function (l) { var m = montantAlerte(l, code); if (m !== null) montant = (montant || 0) + m; });
    return { code: code, famille: familleId, sousTotaux: sousTotaux, icone: familleId, titre: TITRES_CTRL[code], nombre: lignes.length, montant: montant, nature: NATURES_CTRL[code],
      gravite: meta.gravite, action: meta.action, lignes: lignes, methode: METHODES_CTRL[code], filtre: filtreControle(code) };
  }
  function familles(analyse) {
    return FAMILLES_CTRL.map(function (f) {
      return { id: f.id, titre: f.titre, cartes: f.codes.map(function (c) { return controle(analyse, c, f.id); }) };
    });
  }

  // ---------- Régime de prix à voir dans la liste et la fiche ----------
  var LIB_REGIME = { reglemente: 'réglementé', contractuel: 'contractuel', a_qualifier: 'à qualifier' };
  // Régime déclaré par le registre contre règle NEXUS : c'est le seul cas qui demande une vérification (constat A5).
  function desaccordRegime(l) {
    var res = null;
    (l.alertes || []).forEach(function (a) {
      if (a.code !== 'A5') return;
      ((a.donnees && a.donnees.constats) || []).forEach(function (c) { if (/^régime déclaré/.test(c)) res = c; });
    });
    return res;
  }
  function avertissementRegime(l) {
    var c = desaccordRegime(l);
    return c ? 'Régime à vérifier : ' + c + '. Aucune action de prix.' : null;
  }
  // Prix réglementé ou contractuel sans désaccord : une information, jamais un avertissement.
  function typeRegime(l) {
    var r = (l.regimeDeclare && l.regimeDeclare.regime) || (l.regime && l.regime !== 'libre' ? l.regime : null);
    return r === 'contractuel' ? 'contractuel' : r === 'reglemente' ? 'reglemente' : r ? 'a_qualifier' : null;
  }
  function infoRegime(l) {
    if (desaccordRegime(l)) return null;
    var t = typeRegime(l);
    return t === 'contractuel' ? 'Prix contractuel' : t === 'reglemente' ? 'Prix réglementé' : t ? 'Régime à qualifier' : null;
  }
  function badgeRegime(l) {
    if (desaccordRegime(l)) return B.gravite('a-verifier', { libelle: 'Régime à vérifier' });
    var i = infoRegime(l);
    return i ? '<span class="nbe-qualif" data-axe="regime">' + esc(i) + '</span>' : '';
  }
  // Ligne épurée : seuls « À vérifier » et « Proposition à valider » restent visibles, en étiquette discrète.
  // Les autres statuts (Conforme, À surveiller, Sans seuil validé, Aucune action de prix) sont dits dans le (i).
  function badgeLigne(l) {
    if (estDemarque(l)) return '';
    var codes = (l.alertes || []).map(function (a) { return a.code; });
    if (l.statut === 'a_verifier' || codes.indexOf('A4') >= 0 || codes.indexOf('A5') >= 0) return '<span class="nbe-qualif" data-axe="statut">' + esc(LIB_STATUT.a_verifier) + '</span>';
    if (l.statut === 'proposition_a_valider') return '<span class="nbe-qualif" data-axe="statut">' + esc(LIB_STATUT.proposition_a_valider) + '</span>';
    return '';
  }

  // ---------- Marge estimée (lot A) : textes du lexique, jamais de conclusion de prix ----------
  var LIMITE_COMMENTAIRE = 500;
  var QUALIF = { estimation: 'estimation', a_verifier: null, non_calculable: 'non-calculable' };
  function estReglemente(l) { return typeOf(l) === 'reglemente'; }
  function typeOf(l) { return typeRegime(l); }
  function infoBouton(cle, libelle) {
    return '<button type="button" class="info-btn pt-info" data-info-marge="' + esc(cle) + '" aria-label="Information : ' + esc(libelle) + '">i</button>';
  }
  // Aucune couleur d'état près de la marge : étiquettes neutres (nbe-qualif), régime compris (dit une fois, après le nom).
  function badgeMarge(l) {
    var m = l.margeEstimee;
    if (!m) return '';
    var E = V.margeEstimee.etats;
    if (m.etat === 'estimation') return B.qualification('estimation');
    if (m.etat === 'a_verifier') return '<span class="nbe-qualif" data-axe="marge">' + esc(E.a_verifier) + '</span>';
    return B.qualification('non-calculable');
  }
  // Deux niveaux : « Marge estimée : 9,8 % » (principal) puis « 2,59 € HT/unité » (secondaire). Non calculable : dit, raison dans le (i).
  function htmlMarge(l) {
    var m = l.margeEstimee;
    if (estDemarque(l)) return '<span class="pt-marge-l1"><span class="nbe-qualif" data-axe="demarque">' + esc(LIB_DEMARQUE) + '</span></span>';
    if (!m) return 'Marge ' + esc(moinsTypo(pct(l.taux)));
    if (m.etat === 'non_calculable' || m.taux === null || m.taux === undefined) return '<span class="pt-marge-l1">Marge estimée : ' + B.qualification('non-calculable') + '</span>';
    return '<span class="pt-marge-l1">Marge estimée : <span class="pt-mono pt-marge-prin">' + esc(moinsTypo(pct(m.taux))) + '</span> ' + badgeMarge(l) + '</span>' +
      (num(m.margeUnitaireHt) !== null ? '<span class="pt-marge-sec pt-mono">' + esc(eur(m.margeUnitaireHt)) + ' HT/unité</span>' : '');
  }
  // Une ligne ne porte jamais deux étiquettes de même texte : si la marge dit déjà « À vérifier », l'étiquette de statut ne le répète pas.
  function htmlLigneChiffres(l) {
    var hm = htmlMarge(l), bl = badgeLigne(l);
    var txt = function (h) { var m = /<span class="nbe-qualif"[^>]*>([^<]*)<\/span>/.exec(h || ''); return m ? m[1] : null; };
    var tm = (hm.match(/<span class="nbe-qualif"[^>]*>[^<]*<\/span>/g) || []).map(txt), tl = txt(bl);
    return hm + (bl && tm.indexOf(tl) < 0 ? ' ' + bl : '');
  }
  function ficheMarge(l) {
    var m = l.margeEstimee, T0 = V.margeEstimee, li = function (k, v) { return '<div class="pt-pol-l"><span class="sc-lib">' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; };
    if (estDemarque(l)) return '<div class="sc-carte pt-marge-fiche" data-marge-fiche="' + esc(l.article) + '"><div class="sc-nom">' + esc(LIB_DEMARQUE) + '</div><p class="sc-note">Aucune marge n\'est affichée pour une référence en démarque.</p></div>';
    if (!m) return '';
    var c = m.cout || {}, h = '<div class="sc-carte pt-marge-fiche" data-marge-fiche="' + esc(l.article) + '"><div class="sc-nom">Marge estimée : ' + esc(T0.etats[m.etat] || m.etat) + '</div>';
    if (estReglemente(l)) h += '<p class="sc-note">Prix fixé par un tiers : aucune variation de coût ni recommandation de prix.</p>';
    else if (typeOf(l) === 'a_qualifier') h += '<p class="sc-note">Régime de prix à qualifier : le prix de ce format peut être fixé par un tiers. Aucune recommandation de prix tant que le régime n\'est pas décidé.</p>';
    var lib = LIB_STATUT[l.statut] || l.statut;
    h += li('Statut', lib + (l.statut === 'sans_seuil_valide' && typeOf(l) ? ' : Aucune action de prix' : ''));
    if (m.etat === 'non_calculable') h += li('Marge', 'Non calculable : ' + (m.raisons || []).map(function (r) { return typeof r === 'string' ? r : (r.texte || r.code || ''); }).filter(Boolean).join(' ; ') || 'coût ou taux de TVA absent');
    h += li('Coût utilisé', c.valeur === undefined || c.valeur === null ? 'n/d' : eur(c.valeur)) +
      li('Source', c.source === 'releve' ? T0.sources.releve(c.dateReleve ? jourFr(c.dateReleve) : '') : T0.sources.export) +
      li('Méthode', c.methode || T0.methode);
    if (m.controle) h += li('Écart au relevé', 'PA net HT du relevé ' + eur(m.controle.paNetHtReleve) + ' (' + moinsTypo(pct(m.controle.ecart)) + ')');
    (m.raisons || []).forEach(function (r) { h += '<p class="sc-note">' + esc(typeof r === 'string' ? r : (r.texte || r.code || '')) + '</p>'; });
    h += '<p class="sc-methode">' + esc(T0.limites.remises) + ' ' + esc(T0.limites.decision) + '</p></div>';
    return h;
  }


  function carteMarge(analyse) {
    var L = sansDemarque(analyse.lignes), n = { estimation: 0, a_verifier: 0, non_calculable: 0 }, regl = 0;
    L.forEach(function (l) { if (l.margeEstimee) n[l.margeEstimee.etat] = (n[l.margeEstimee.etat] || 0) + 1; if (estReglemente(l)) regl++; });
    var calc = n.estimation + n.a_verifier, E = V.margeEstimee.etats;
    return { id: 'marge_estimee', titre: 'Marge estimée', valeur: calc + ' sur ' + L.length,
      secondaire: E.estimation + ' ' + n.estimation + ' · ' + E.a_verifier + ' ' + n.a_verifier + ' · ' + E.non_calculable + ' ' + n.non_calculable,
      unite: 'références dont la marge est calculable', reglementees: regl,
      limite: V.margeEstimee.limites.remises + ' ' + V.margeEstimee.limites.decision };
  }

  // ---------- Anomalies : contrôles à effectuer et marquage « vérifié » ----------
  var A_LIB = function () { return V.anomaliesTarifaires; };
  function peutVerifier(role, estCreateur) { return !estCreateur && (role === 'gerant' || role === 'manager'); }
  // Annuler une vérification est ouvert au créateur (qui ne vérifie pas lui-même), au gérant et au manager ; la base tranche le périmètre exact.
  function peutAnnuler(role, estCreateur) { return !!estCreateur || role === 'gerant' || role === 'manager'; }
  function commentaireValide(t) { return String(t == null ? '' : t).trim().length <= LIMITE_COMMENTAIRE; }
  var LIB_NIVEAU = { demontree: 'Démontré', a_verifier: 'À vérifier' };
  // Valeurs à comparer, dans un ordre fixe par cause (Decenium d'un côté, relevé de l'autre).
  // A1 : perte unitaire HT lue sur la ligne (PV HT et coût HT), sans toucher aux valeurs de S1 (l'empreinte reste stable).
  function perteUnitaire(l) {
    var pv = l ? num(l.pv_ht) : null, c = l && l.margeEstimee && l.margeEstimee.cout ? num(l.margeEstimee.cout.valeur) : null;
    if (pv === null || c === null || !(pv >= 0) || !(c > pv)) return null;
    return { perte: c - pv, pv: pv, cout: c };
  }
  function valeursAComparer(an, l) {
    var v = an.valeurs || {}, c = an.code;
    if (c === 'S1') {
      var pu = perteUnitaire(l);
      if (pu) return 'Perte de ' + eur(pu.perte) + ' HT par unité : vendu ' + eur(pu.pv) + ', coût ' + eur(pu.cout);
      return 'Marge : ' + moinsTypo(pct(v.taux));
    }
    if (c === 'S2') return 'Écart : ' + moinsTypo(pct(v.ecart)) + ' · PA net HT du relevé de stock : ' + eur(v.paNetHtReleve);
    if (c === 'S3') return 'Variation du coût : ' + moinsTypo(pct(v.variationCout));
    if (c === 'S4') return 'Unités par colis : ' + (v.unites === undefined || v.unites === null ? 'n/d' : v.unites) + ' · rapport du relevé : ' + (num(v.rapportReleve) === null ? 'n/d' : v.rapportReleve) + ' · rapport du prix de vente : ' + (num(v.rapportPv) === null ? 'n/d' : v.rapportPv);
    if (c === 'S5') return 'Constats de correspondance : ' + (v.constats === undefined || v.constats === null ? 'n/d' : v.constats);
    if (c === 'S6') return 'Variation du prix de vente : ' + moinsTypo(pct(v.variationPv));
    if (c === 'S7') return 'Taux de TVA : ' + (v.tva === undefined || v.tva === null ? 'n/d' : v.tva + ' %') + ' · état : ' + (v.etat === 'a_verifier' ? 'à confirmer' : esc(v.etat || 'n/d'));
    return '';
  }
  // Chiffre clé court de la ligne : une valeur, pas la phrase. La phrase complète reste dans le détail (pc.chiffres).
  function moinsTypo(t) { return String(t).replace(/-(?=\d)/g, '\u2212'); }
  function chiffreCourt(an, l) {
    var v = an.valeurs || {}, c = an.code, nd = function (x) { return x === undefined || x === null ? 'n/d' : x; }, pu = c === 'S1' ? perteUnitaire(l) : null;
    if (pu) return 'Perte ' + eur(pu.perte);
    if (c === 'S1') return 'Marge ' + moinsTypo(pct(v.taux));
    if (c === 'S2') return 'Écart ' + moinsTypo(pct(v.ecart));
    if (c === 'S3') return 'Coût ' + moinsTypo(pct(v.variationCout));
    if (c === 'S4') return nd(v.unites) + ' par colis';
    if (c === 'S5') return nd(v.constats) + ' constats';
    if (c === 'S6') return 'PV ' + moinsTypo(pct(v.variationPv));
    if (c === 'S7') return 'TVA ' + (v.tva === undefined || v.tva === null ? 'n/d' : v.tva + ' %');
    return 'n/d';
  }
  // Indicateurs du détail : le chiffre clé en grand (libellé + valeur) et le niveau. Mêmes valeurs que valeursAComparer, rien de recalculé.
  function indicateursControle(an, l, pc) {
    var v = an.valeurs || {}, c = an.code, nd = function (x) { return x === undefined || x === null ? 'n/d' : x; }, pu = c === 'S1' ? perteUnitaire(l) : null, i;
    if (pu) i = ['Perte par unité', eur(pu.perte) + ' HT'];
    else if (c === 'S1') i = ['Marge', moinsTypo(pct(v.taux))];
    else if (c === 'S2') i = ['Écart au relevé', moinsTypo(pct(v.ecart))];
    else if (c === 'S3') i = ['Variation du coût', moinsTypo(pct(v.variationCout))];
    else if (c === 'S4') i = ['Unités par colis', String(nd(v.unites))];
    else if (c === 'S5') i = ['Constats de correspondance', String(nd(v.constats))];
    else if (c === 'S6') i = ['Variation du prix de vente', moinsTypo(pct(v.variationPv))];
    else if (c === 'S7') i = ['Taux de TVA', v.tva === undefined || v.tva === null ? 'n/d' : v.tva + ' %'];
    else i = ['Chiffre clé', 'n/d'];
    var coutL = l && l.margeEstimee && l.margeEstimee.cout ? l.margeEstimee.cout.valeur : null, j;
    if (c === 'S2') j = ['PA net HT du relevé', eur(v.paNetHtReleve)];
    else if (c === 'S6') j = ['PV', eur(l && l.pv_ht)];
    else if (c === 'S4') j = ['Rapport du relevé', String(nd(v.rapportReleve))];
    else if (c === 'S5' || c === 'S7') j = ['PV', eur(l && l.pv_ht)];
    else j = ['Coût', eur(coutL)];
    return '<div class="pt-ind2" data-ctl-indicateurs="1"><div class="pt-ind pt-ind-cle"><span class="pt-ind-ico">' + vignetteFamille(l) + '</span><span class="pt-ind-txt"><span class="pt-ind-lib sc-methode">' + esc(i[0]) + '</span><span class="pt-ind-val pt-mono">' + esc(i[1]) + '</span></span></div>' +
      '<div class="pt-ind pt-ind-sec"><span class="pt-ind-ico">' + vignetteFamille(l) + '</span><span class="pt-ind-txt"><span class="pt-ind-lib sc-methode">' + esc(j[0]) + '</span><span class="pt-ind-val pt-mono">' + esc(j[1]) + '</span></span></div></div>';
  }
  function htmlVerification(an, l, droits, etat, suivant) {
    var code = an.code, idc = 'ptc-' + String(l.article).replace(/[^A-Za-z0-9_-]/g, '_') + '-' + code;
    var fiable = !!(an.identiteDonnees || {}).fichierHash;
    if (etat && etat.estCreateur && an.cycle !== 'verifiee') return '<p class="sc-note pt-lecture-seule" data-lecture-seule-createur="1">Lecture seule : le compte créateur ne vérifie pas.</p>';
    if (!droits || an.cycle === 'verifiee') return '';
    if (!fiable) return '<p class="sc-note pt-verif-indispo" data-verif-indispo="1">Donnée non fiable : l\'import de référence est introuvable, la vérification n\'est pas possible.</p>';
    var cleC = code + '|' + l.article, comOuvert = true;
    var com = comOuvert
      ? '<div class="pt-verif-champ"><label class="sc-lib" for="' + idc + '">Commentaire (facultatif)</label>' +
        '<div class="pt-verif-zone"><textarea id="' + idc + '" class="pt-verif-com" rows="2" data-com-article="' + esc(l.article) + '" data-com-code="' + esc(code) + '" aria-describedby="' + idc + '-n"></textarea>' +
        '<span id="' + idc + '-n" class="sc-note pt-verif-n" data-com-compteur="1">0 / ' + LIMITE_COMMENTAIRE + '</span></div></div>'
      : '<button type="button" class="pt-com-lien" data-com-ouvrir="' + esc(cleC) + '">Ajouter un commentaire</button>';
    var bouton = '<button type="button" class="detail-btn pt-verifier" data-verifier="' + esc(code) + '" data-ver-article="' + esc(l.article) + '">✓ Marquer comme vérifié</button>';
    return suivant === undefined ? com + bouton : com + '<div class="pt-actions" data-ctl-actions="1">' + bouton + suivant + '</div>';
  }
  // L2 : pièces communes d'un contrôle. La consigne est toujours visible (plus de (i)) ; la source et le calcul sont dans un bloc natif replié.
  function pieceControle(an, l) {
    var AL = A_LIB(), code = an.code, cd = AL.codes[code] || {};
    var s1Contredit = code === 'S1' && (l.anomalies || []).some(function (x) { return x.code === 'S2'; });
    var niveauAff = s1Contredit ? 'a_verifier' : an.niveau;
    var cycle = AL.cycles[an.cycle] || '';
    return { AL: AL, code: code, cd: cd, s1Contredit: s1Contredit, niveau: LIB_NIVEAU[niveauAff] || '',
      statut: an.cycle === 'verifiee' ? 'Vérifié' : an.cycle === 'nouvelle' ? 'Nouveau' : cycle,
      court: chiffreCourt(an, l),
      chiffres: valeursAComparer(an, l) + (s1Contredit ? ' · coût de l\'export contredit par le relevé de stock' : '') };
  }
  function htmlCorpsControle(an, l, droits, etat, pc, suivant) {
    var AL = pc.AL, code = pc.code;
    var masque = (an.peutExpliquerAussi || []).length ? '<p class="sc-note">' + esc(AL.masque) + ' ' + esc(an.peutExpliquerAussi.map(function (c) { return (AL.codes[c] || {}).titre || c; }).join(', ')) + '</p>' : '';
    var marge = code === 'S1' && perteUnitaire(l) ? '<p class="sc-note" data-s1-pct="1">Marge : ' + esc(moinsTypo(pct((an.valeurs || {}).taux))) + '</p>' : '';
    return '<p class="pt-ctl-3 sc-note">' + esc(pc.cd.controle || '') + '</p>' + marge + masque +
      '<details class="pt-sources-calcul" data-sources-calcul="1"><summary>Sources et calcul</summary>' + (suivant === undefined ? '<p class="pt-ctl-2 sc-methode">' + pc.chiffres + '</p>' : '') +
      '<p class="sc-methode">' + esc(AL.explication || 'Un contrôle indique où comparer avec Decenium. Ce n\'est pas une erreur constatée.') + '</p></details>' +
      htmlVerificationOuBarre(an, l, droits, etat, suivant);
  }
  // L3 : la barre d'action du détail (Suivant, Marquer comme vérifié) existe aussi quand la ligne est en lecture seule ou déjà vérifiée.
  function htmlVerificationOuBarre(an, l, droits, etat, suivant) {
    var v = htmlVerification(an, l, droits, etat, suivant);
    if (suivant === undefined || v.indexOf('data-ctl-actions') >= 0) return v;
    return v + '<div class="pt-actions" data-ctl-actions="1">' + suivant + '</div>';
  }
  function htmlAnomalie(an, l, droits, etat, avecProduit) {
    var pc = pieceControle(an, l);
    return '<li class="pt-anomalie pt-ctl" data-anomalie="' + esc(pc.code) + '">' +
      '<div class="pt-ctl-1">' + (avecProduit ? '<button type="button" class="vp-ligne-prod pt-ctl-prod" data-article="' + esc(l.article) + '"><span class="vp-nom">' + esc(l.article) + '</span></button>' : '') +
      '<span class="sc-nom">' + esc(pc.cd.titre || pc.code) + '</span> <span class="nbe-qualif" data-axe="niveau">' + esc(pc.niveau) + '</span> ' +
      '<span class="nbe-qualif" data-axe="cycle">' + esc(pc.statut) + '</span></div>' +
      htmlCorpsControle(an, l, droits, etat, pc) + '</li>';
  }
  // L2 : une ligne compacte par contrôle (article, cause, chiffre clé, un seul niveau) ; le détail s'affiche dans le panneau.
  function cleControle(x) { return x.a.code + '|' + x.l.article; }
  function vignetteFamille(l) {
    var id = RF && RF.iconeRayon ? RF.iconeRayon(l.rayon) : 'cat-petits-articles';
    var h = NI && NI.imgCategorie ? NI.imgCategorie(id, 40, { decoratif: true }) : '';
    if (!h && NI && NI.imgCategorie) {
      // Chaque identifiant non déclaré est tracé une fois (rayon et identifiant), pour ne plus jamais passer inaperçu.
      try {
        var vus = vignetteFamille.vus || (vignetteFamille.vus = {}), k = id + '|' + l.rayon;
        if (!vus[k]) { vus[k] = 1; if (typeof console !== 'undefined' && console.warn) console.warn('[recette] identifiant de famille inconnu : ' + id + ' (rayon : ' + l.rayon + ')'); }
      } catch (e) {}
      h = NI.imgCategorie('cat-petits-articles', 40, { decoratif: true });
    }
    return h || '<span class="pt-vign-neutre" aria-hidden="true"></span>';
  }
  function htmlLigneCompacte(x, choisi) {
    var pc = pieceControle(x.a, x.l), cle = cleControle(x), grav = pc.niveau === LIB_NIVEAU.demontree ? 'demontree' : 'averifier';
    return '<li class="pt-ctl-item" data-anomalie="' + esc(pc.code) + '"><button type="button" class="pt-ctl-ligne" data-ctl-ligne="1" data-ctl-sel="' + esc(cle) + '"' +
      (choisi ? ' aria-current="true" tabindex="0"' : ' tabindex="-1"') + '>' +
      '<span class="pt-l-vign">' + vignetteFamille(x.l) + '</span>' +
      '<span class="pt-l-corps"><span class="vp-nom pt-l-art">' + esc(x.l.article) + '</span>' +
      '<span class="pt-l-sec"><span class="pt-l-cause">' + esc(pc.cd.court || pc.cd.titre || pc.code) + '</span> <span class="nbe-qualif pt-l-niv" data-axe="niveau">' + esc(pc.niveau) + '</span> <span class="pt-l-etat nbe-qualif" data-axe="cycle">' + esc(LIB_CYCLE[x.a.cycle || 'nouvelle'] || '') + '</span></span></span>' +
      '<span class="pt-l-chiffre pt-l-gr-' + grav + '">' + esc(pc.court) + '</span><span class="pt-l-chev" aria-hidden="true">›</span></button></li>';
  }
  function htmlDetailControle(x, droits, etat, nav, avecSuivi) {
    var pc = pieceControle(x.a, x.l), n = nav || { restants: 0, suivant: false };
    var retour = '<button type="button" class="detail-btn pt-ctl-retour" data-ctl-retour="1">‹ Retour à la liste (' + n.restants + (n.restants > 1 ? ' restants' : ' restant') + ')</button>';
    var pos = n.total ? '<span class="pt-ctl-nav"><button type="button" class="detail-btn pt-ctl-fl" data-ctl-prec="1" aria-label="Contrôle précédent"' + (n.pos > 1 ? '' : ' disabled') + '>‹</button><span class="pt-ctl-pos" data-ctl-pos="1">' + n.pos + ' / ' + n.total + '</span><button type="button" class="detail-btn pt-ctl-fl" data-ctl-suiv-fl="1" aria-label="Contrôle suivant"' + (n.pos < n.total ? '' : ' disabled') + '>›</button></span>' : '';
    var suiv = '<button type="button" class="detail-btn pt-ctl-suivant" data-ctl-suivant="1"' + (n.suivant ? '' : ' disabled') + '>Passer au suivant sans vérifier</button>';
    return '<section class="pt-detail" data-ctl-detail="1" aria-label="Détail du contrôle"><div class="pt-ctl-entete">' + retour + pos + '</div>' + (avecSuivi ? htmlSuiviVerif(etat, droits) : '') + '<div class="pt-ctl-1"><div class="pt-ctl-nom"><button type="button" class="vp-ligne-prod pt-ctl-prod" data-article="' + esc(x.l.article) + '"><span class="vp-nom">' + esc(x.l.article) + '</span></button></div>' +
      '<div class="pt-ctl-cause"><span class="sc-nom">' + esc(pc.cd.titre || pc.code) + '</span> <span class="nbe-qualif" data-axe="niveau">' + esc(pc.niveau) + '</span> <span class="nbe-qualif" data-axe="cycle">' + esc(pc.statut) + '</span></div></div>' +
      indicateursControle(x.a, x.l, pc) + '<p class="pt-ctl-2 pt-ctl-chiffre" data-ctl-chiffre="1"><span class="pt-num">' + pc.chiffres + '</span></p>' +
      htmlCorpsControle(x.a, x.l, droits, etat, pc, suiv) + '</section>';
  }
  function htmlControlesAFaire(l, droits, etat) {
    var L = l.anomalies || [];
    if (!L.length) return '';
    return '<div class="sc-carte pt-controles-faire" data-controles-faire="1"><div class="sc-nom pt-ctl-titre">Contrôles à effectuer</div><ul class="vp-liste">' +
      L.map(function (a) { return htmlAnomalie(a, l, droits, etat, false); }).join('') + '</ul></div>';
  }
  // Liste de tous les contrôles de l'import : une ligne par référence et par cause, filtrée par cycle, recherche et tri.
  var CYCLES_DEFAUT = ['nouvelle', 'persistante', 'aggravee'];
  var TRI_CTL = [['gravite', 'Gravité décroissante'], ['produit', 'Produit, A à Z']];
  var SEUIL_OUTILS = 10;
  function tousControles(a) {
    var out = [];
    (a.lignes || []).forEach(function (l) { (l.anomalies || []).forEach(function (x) { out.push({ l: l, a: x }); }); });
    return out;
  }
  // Base de la ventilation par cause : cycles et recherche appliqués, cause non appliquée (les pastilles comptent sur cette base).
  function controlesBase(etat) {
    var cy = etat.ctlCycles || CYCLES_DEFAUT, q = String(etat.ctlRecherche || '').trim().toLowerCase();
    return tousControles(etat.analyse).filter(function (x) { return cy.indexOf(x.a.cycle || 'nouvelle') >= 0 && (!q || String(x.l.article).toLowerCase().indexOf(q) >= 0 || String(x.l.code_barres || '').toLowerCase().indexOf(q) >= 0); });
  }
  function ventilationCauses(etat) {
    var AL = A_LIB(), n = {}, ordre = [];
    controlesBase(etat).forEach(function (x) { if (!n[x.a.code]) { n[x.a.code] = 0; ordre.push(x.a.code); } n[x.a.code]++; });
    ordre.sort(function (p, q) { return n[q] - n[p] || String(p).localeCompare(String(q)); });
    return ordre.map(function (c) { return { code: c, n: n[c], titre: (AL.codes[c] || {}).titre || c, court: (AL.codes[c] || {}).court || (AL.codes[c] || {}).titre || c }; });
  }
  // Pictogrammes de cause S1 à S7 : copie en ligne de assets/icones/v2/causes/cause-sN.svg (currentColor, hérite de la puce).
  var PICTO_CAUSE = {S1:'<path d="M3 5v14h18"/><path d="m6 9 5 5 4-3 5 6"/><path d="M16 17h4v-4"/>',S2:'<path d="M3 5h12l3 3v8H3z"/><path d="M6 9h6M6 12h4"/><path d="M10 8h11v11H10z"/><path d="m13 13 5 3m0-3-5 3"/>',S3:'<path d="M3 17 9 11l4 3 8-8"/><path d="M17 6h4v4"/><path d="M3 21h18"/>',S4:'<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',S5:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2"/>',S6:'<path d="M3 5h10l8 8-8 8L3 11z"/><circle cx="8" cy="9" r="1"/><path d="m12 15 5-5m-4 0h4v4"/>',S7:'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M19 5 5 19"/>'};
  function pictoCause(code) { return PICTO_CAUSE[code] ? '<svg class="pt-picto" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">' + PICTO_CAUSE[code] + '</svg>' : ''; }
  function htmlPastillesCauses(etat) {
    var V = ventilationCauses(etat), tot = V.reduce(function (t, v) { return t + v.n; }, 0), cause = etat.ctlCause || '';
    if (cause && !V.some(function (v) { return v.code === cause; })) cause = '';
    if (!V.length) return '';
    var p = function (code, lib, n, complet) { var on = code === cause; return '<button type="button" class="pt-pastille" data-ctl-cause="' + esc(code) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(complet || lib) + ' : ' + n + '">' + pictoCause(code) + esc(lib) + ' <span class="pt-pastille-n">' + n + '</span></button>'; };
    return '<div class="pt-pastilles" role="group" aria-label="Filtrer par cause" data-ctl-causes="1">' + p('', 'Toutes', tot) + V.map(function (v) { return p(v.code, v.court, v.n, v.titre); }).join('') + '</div>';
  }
  function controlesFiltres(etat) {
    var cause = etat.ctlCause || '';
    var L = controlesBase(etat).filter(function (x) { return !cause || x.a.code === cause; });
    if (cause && !L.length) L = controlesBase(etat);
    if ((etat.ctlTri || 'gravite') === 'produit') L.sort(function (x, y) { return String(x.l.article).localeCompare(String(y.l.article), 'fr'); });
    else L.sort(function (x, y) { return (y.a.gravite || 0) - (x.a.gravite || 0) || String(x.l.article).localeCompare(String(y.l.article), 'fr'); });
    return L;
  }
  function htmlZoneAnnulation(etat) {
    return '<div class="pt-verif-champ" data-ctl-annul-zone="1"><label class="sc-lib" for="ptAnnulMotif">Motif de l\'annulation (obligatoire)</label>' +
        '<div class="pt-verif-zone"><textarea id="ptAnnulMotif" class="pt-verif-com" rows="2" maxlength="' + LIMITE_MOTIF + '" required aria-describedby="ptAnnulN" data-annul-motif="1">' + esc(etat.annulMotif || '') + '</textarea>' +
        '<span id="ptAnnulN" class="sc-note pt-verif-n" data-annul-compteur="1">' + String(etat.annulMotif || '').length + ' / ' + LIMITE_MOTIF + '</span></div>' +
        '<div class="pt-actions"><button type="button" class="detail-btn" data-annul-confirmer="1">Confirmer l\'annulation</button> <button type="button" class="pt-com-lien" data-annul-garder="1">Garder la vérification</button></div></div>';
  }
  // L4 : confirmation, annulation et erreurs. Affichées dans le détail quand il est ouvert (plein écran à 375 px), sinon au-dessus de la liste.
  function htmlSuiviVerif(etat, droits) {
    var r = '';
    r += '<div class="pt-live" aria-live="polite" data-ctl-live="1">';
    if (etat.messageVerif) r += '<p class="sc-note pt-verif-msg" role="status" data-verif-ok="1">' + esc(etat.messageVerif) + '</p>';
    if (etat.messageAnnul) r += '<p class="sc-note pt-verif-msg" role="status" data-annul-ok="1">' + esc(etat.messageAnnul) + '</p>';
    r += '</div>';
    var dv = etat.derniereVerif;
    if (dv && droits && etat.messageVerif && !etat.annulCible) {
      if (!etat.annulOuverte) r += '<button type="button" class="pt-com-lien" data-ctl-annuler="1">Annuler</button>';
      else r += htmlZoneAnnulation(etat);
    }
    if (etat.erreurAnnul && !etat.annulCible) r += '<p class="sc-note pt-erreur" role="alert" data-annul-erreur="1">' + esc(etat.erreurAnnul) + '</p>';
    if (etat.erreurEcriture) r += '<p class="sc-note pt-erreur" role="alert" data-ctl-erreur="1">' + esc(etat.erreurEcriture) + '</p>';
    return r;
  }
  function htmlEnteteControles(a, etat, n) {
    var S = a.synthese || {}, id = a.identiteDonnees || S.identiteDonnees || {};
    var parts = [];
    if (etat && etat.site) parts.push(etat.site);
    var per = libellePeriode(S.periode); if (per && per !== 'période inconnue') parts.push(per.replace(/^du /, 'ventes du '));
    if (id.dateReleve) parts.push('relevé du ' + jourFr(String(id.dateReleve).slice(0, 10)));
    if (S.references !== undefined && S.references !== null) parts.push(S.references + ' références');
    return '<header class="pt-ctl-tete" data-ctl-tete="1"><nav class="pt-ctl-fil sc-methode" aria-label="Fil d\'Ariane">Produits › Scanner tarifaire › Contrôler</nav>' +
      '<h2 class="pt-ctl-titre sc-nom">Contrôles à effectuer (' + n + ')</h2>' +
      '<p class="pt-ctl-sous sc-methode" data-ctl-sous="1">' + esc(parts.join(' · ')) + ' <span class="pt-ctl-pilule nbe-qualif" data-ctl-estimations="1">Estimations</span></p></header>';
  }
  function htmlBlocControles(etat, cartes) {
    var a = etat.analyse, droits = peutVerifier(etat.role, etat.estCreateur), tous = tousControles(a);
    var actifs = tous.filter(function (x) { return CYCLES_ACTIFS.indexOf(x.a.cycle || 'nouvelle') >= 0; });
    var AL = A_LIB(), S = a.synthese || {};
    var h = '<section class="vp-bloc pt-bloc-controles" data-bloc-controles="1" aria-label="Contrôles à effectuer">' + htmlEnteteControles(a, etat, actifs.length) + (cartes || '');
    if (!tous.length) {
      var id = a.identiteDonnees || S.identiteDonnees || {};
      return h + '<p class="sc-note" data-ctl-vide="1">Aucune anomalie à vérifier sur cet import' + (id.dateReleve ? ' (relevé du ' + esc(jourFr(String(id.dateReleve).slice(0, 10))) + ')' : '') + (id.fichierHash ? ', empreinte ' + esc(String(id.fichierHash).slice(0, 8)) : '') + '.</p></section>';
    }
    var L0 = controlesFiltres(etat);
    var enDetail = !!(etat.ctlDetail && L0.length);
    if (!enDetail) h += htmlSuiviVerif(etat, droits);
    var aideCtl = esc(AL.explication || 'Un contrôle indique où comparer avec Decenium. Ce n\'est pas une erreur constatée : comparez les valeurs, puis marquez la ligne comme vérifiée.');
    if (!droits) h += '<p class="sc-note" data-ctl-lecture="1">Lecture seule : seuls le gérant et le manager marquent un contrôle comme vérifié.</p>';
    var L = controlesFiltres(etat);
    {
      var cy = etat.ctlCycles || CYCLES_DEFAUT;
      h += '<div class="vp-filtres pt-ctl-outils"><label class="pt-f pt-f-rech"><span class="sc-methode">Recherche</span><input type="search" id="ptCtlRecherche" placeholder="Nom ou code-barres" aria-label="Rechercher par nom ou code-barres" value="' + esc(etat.ctlRecherche || '') + '"></label>' +
        '<label class="pt-f"><span class="sc-methode">Tri</span><select data-ctl-tri="1">' + TRI_CTL.map(function (o) { return '<option value="' + o[0] + '"' + ((etat.ctlTri || 'gravite') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
        '<details class="pt-ctl-aide" data-ctl-expl="1"><summary class="info-btn" aria-label="Comment lire un contrôle" role="button">i</summary><p class="sc-methode">' + aideCtl + '</p></details>' + '<button type="button" class="detail-btn pt-ctl-filtres-btn" data-ctl-filtres="1" aria-expanded="' + (etat.ctlFiltresOuverts ? 'true' : 'false') + '">Filtres (' + cy.length + ')</button><fieldset class="pt-ctl-cycles' + (etat.ctlFiltresOuverts ? '' : ' pt-ctl-cycles-ferme') + '"><legend class="sc-methode">Historique</legend>' + ['nouvelle', 'persistante', 'aggravee', 'verifiee', 'resolue'].map(function (k) {
          return '<label class="pt-chk"><input type="checkbox" data-ctl-cycle="' + k + '"' + (cy.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(LIB_CYCLE[k]) + '</label>'; }).join('') + '</fieldset></div>';
    }
    var vis = etat.ctlToutes || tous.length <= SEUIL_OUTILS ? L : L.slice(0, SEUIL_OUTILS);
    // Sélection : le contrôle choisi, sinon le premier de la vue (la ligne vérifiée quitte la vue, la suivante prend la place).
    var sel = null; vis.forEach(function (x) { if (!sel && cleControle(x) === etat.ctlSel) sel = x; }); if (!sel) sel = vis[0] || null;
    var iSel = vis.indexOf(sel), nav = { restants: Math.max(0, L.length - 1), suivant: iSel >= 0 && iSel < vis.length - 1, pos: L.indexOf(sel) + 1, total: L.length };
    h += htmlPastillesCauses(etat);
    h += '<div class="pt-ctl-deux" data-mode="' + (sel && etat.ctlDetail ? 'detail' : 'liste') + '"><div class="pt-ctl-gauche"><ul class="vp-liste pt-ctl-liste" data-ctl-liste="1">' + vis.map(function (x) { return htmlLigneCompacte(x, x === sel); }).join('') + '</ul>';
    if (!L.length && !actifs.length) h += '<p class="sc-note pt-traite" data-ctl-traite="1">Tout est traité pour cet import. Les contrôles vérifiés restent consultables dans l\'historique.</p>';
    else if (!L.length) h += '<p class="sc-note">Aucun contrôle ne correspond à ces filtres.</p>';
    if (L.length > vis.length) h += '<button type="button" class="detail-btn vp-plus" data-ctl-plus="1">Afficher la suite (' + (L.length - vis.length) + ')</button>';
    h += '</div>' + (sel ? '<div class="pt-ctl-droite">' + htmlDetailControle(sel, droits, etat, nav, enDetail) + '</div>' : '') + '</div>';
    return h + '</section>';
  }
  // Réévaluations à enregistrer : périmètre complet de l'import (jamais la vue filtrée), une ligne par anomalie dont le cycle change.
  // identite : { fichierHash, dateReleve } de l'import en cours. La vérification la plus récente de chaque (cause, clé) fait foi.
  var CYCLES_REEVAL = { persistante: 1, aggravee: 1, resolue: 1 };
  function reevaluationsAEcrire(analyse, verifications, identite) {
    var id = identite || {}, out = [];
    if (!id.fichierHash) return out;
    var derniere = function (code, cle) {
      return (verifications || []).filter(function (v) { return v.code === code && v.cle === cle; }).sort(function (a, b) { return String(b.verifie_le).localeCompare(String(a.verifie_le)); })[0] || null;
    };
    var ajouter = function (a, etat) {
      var v = derniere(a.code, a.cle);
      if (!v) return;
      if (v.reevaluation && v.reevaluation.fichier_hash === id.fichierHash) return; // déjà enregistrée pour cet import
      out.push({ verification_id: v.id, article: v.article, code_barres: v.code_barres || null, etat: etat, fichier_hash: id.fichierHash,
        date_releve: id.dateReleve || null, empreinte: a.empreinte, gravite: etat === 'resolue' ? null : (a.gravite == null ? null : a.gravite), valeurs: a.valeurs || null, cause: a.code });
    };
    ((analyse && analyse.lignes) || []).forEach(function (l) {
      (l.anomalies || []).forEach(function (a) { if (CYCLES_REEVAL[a.cycle]) ajouter(a, a.cycle); });
      (l.anomaliesResolues || []).forEach(function (a) { ajouter(a, 'resolue'); });
    });
    return out;
  }
  // Écrit les réévaluations si la personne a le droit. Retourne { statut: 'aucune' | 'ecrit' | 'droits' | 'erreur', n }.
  // 'droits' : calculées mais non enregistrées (la page l'indique). Une erreur n'empêche jamais l'affichage.
  async function enregistrerReevaluations(client, role, estCreateur, analyse, verifications, identite) {
    var L = reevaluationsAEcrire(analyse, verifications, identite);
    if (!L.length) return { statut: 'aucune', n: 0 };
    if (!peutVerifier(role, estCreateur)) return { statut: 'droits', n: L.length };
    try {
      for (var i = 0; i < L.length; i += 200) {
        var r = await client.rpc('tarif_enregistrer_reevaluations', { p_lignes: L.slice(i, i + 200) });
        if (r && r.error) throw r.error;
      }
      return { statut: 'ecrit', n: L.length };
    } catch (e) { return { statut: 'erreur', n: L.length, erreur: e }; }
  }
  function messageErreurEcriture(err) {
    var m = String((err && (err.message || err)) || '');
    if (m.indexOf('tarif_verif_commentaire_trop_long') >= 0) return 'Le commentaire dépasse ' + LIMITE_COMMENTAIRE + ' caractères. Raccourcissez-le puis réessayez.';
    var refus = [
      ['tarif_verif_createur_lecture_seule', 'Le compte créateur est en lecture seule : il ne peut pas marquer un contrôle comme vérifié.'],
      ['tarif_verif_reservee_manager_gerant', 'Cette action est réservée au manager et au gérant. Votre rôle ne permet pas de vérifier.'],
      ['tarif_verif_compte_inactif', 'Votre compte est désactivé : la vérification n\'est pas possible.'],
      ['tarif_verif_session_absente', 'Votre session a expiré. Reconnectez-vous puis réessayez.'],
      ['tarif_verif_lot_import_incoherent', "Le lot d'import ne correspond plus à ce fichier. Rechargez la page puis réessayez."],
      ['tarif_verif_reference_absente', "Cette ligne n'a ni code-barres ni libellé : la vérification n'est pas possible."]
    ];
    for (var i = 0; i < refus.length; i++) if (m.indexOf(refus[i][0]) >= 0) return refus[i][1] + " Rien n'a été modifié.";
    return "L'enregistrement a échoué. Rien n'a été modifié, vous pouvez réessayer.";
  }
  var MSG_VERIF_OK = 'Vérification enregistrée. Contrôle suivant ouvert.';
  var MSG_ANNUL_OK = 'Vérification annulée. Le contrôle est revenu dans les contrôles à effectuer.';
  var LIMITE_MOTIF = 500;
  function motifAnnulationValide(m) { var t = String(m == null ? '' : m).trim(); return t.length >= 1 && t.length <= LIMITE_MOTIF; }
  function messageErreurAnnulation(err) {
    var m = String((err && (err.message || err)) || '');
    if (/refus|denied|policy|permission|row-level|aucune ligne|droit/i.test(m)) return "Annulation refusée : seule la personne qui a saisi cette vérification, un gérant ou le créateur du site peut l'annuler. Rien n'a été modifié.";
    return "L'annulation a échoué. Rien n'a été modifié, vous pouvez réessayer.";
  }
  function messageApresEcriture(info) {
    var d = jourFr(info.date), qui = info.auteur || 'un responsable';
    return 'Vérifié le ' + d + ' par ' + qui + '. Réévalué au prochain import.';
  }
  function payloadVerification(an, l, lot) {
    var v = { article: l.article, code_barres: l.code_barres || null, cause: an.code, empreinte: an.empreinte,
      fichier_hash: (an.identiteDonnees || {}).fichierHash, date_releve: (an.identiteDonnees || {}).dateReleve || null,
      gravite: an.gravite, niveau: an.niveau, valeurs: an.valeurs || null, import_batch_id: lot.importBatchId, moteur_version: lot.moteurVersion };
    if (lot.commentaire && String(lot.commentaire).trim()) v.commentaire = String(lot.commentaire).trim().slice(0, LIMITE_COMMENTAIRE);
    return v;
  }

  // ---------- Rendu ----------
  function htmlLigne(l) {
    return '<li class="pt-li"><button type="button" class="vp-ligne-prod" data-article="' + esc(l.article) + '">' +
      '<span class="vp-nom">' + esc(l.article) + ' ' + badgeRegime(l) + '</span>' +
      '<span class="vp-meta">' + esc(l.rayon || '') + ' · Fiabilité : ' + esc((LIB_FIABILITE[l.fiabilite.niveau] || l.fiabilite.niveau).toLowerCase()) + '</span>' +
      '<span class="vp-chiffres">' + htmlLigneChiffres(l) + '</span></button>' + infoBouton(l.article, 'marge estimée de ' + l.article) + '</li>';
  }
  function blocFiche(l) {
    var f = fiche(l), s = f.seuil, pd = l.prixDecide, w = avertissementRegime(l);
    var li = function (k, v) { return '<div class="pt-pol-l"><span class="sc-lib">' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; };
    var alertes = (l.alertes || []).map(function (a) { return (T.ALERTES[a.code] || {}).libelle || a.code; });
    var version = s && s.version !== null ? ' (version ' + (s.version.seuil_id !== undefined ? s.version.seuil_id : s.version) + ')' : '';
    return '<details class="sc-carte pt-pol" data-pol="1"><summary><span class="sc-nom">Politique tarifaire</span><span class="sc-chev"></span></summary>' +
      (w ? '<p class="sc-conseil">' + esc(w) + '</p>' : (infoRegime(l) ? '<p class="sc-note">' + esc(infoRegime(l)) + '. Aucune action de prix.</p>' : '')) +
      li('Statut', (LIB_STATUT[f.statut] || f.statut) + (f.raisonStatut ? ' : ' + f.raisonStatut : '')) +
      li('Seuil applicable', s ? (LIB_REGLE[s.niveau] || s.niveau) + ' : minimum ' + pct(s.minimum) + ' (' + (s.statutMinimum || 'sans statut') + '), cible ' + pct(s.cible) + ' (' + (s.statutCible || 'sans statut') + ')' + version : 'aucun seuil valide') +
      li('Fiabilité', (LIB_FIABILITE[f.fiabilite] || f.fiabilite) + (f.raisons.length ? ' : ' + f.raisons.map(function (r) { return String(r).charAt(0).toUpperCase() + String(r).slice(1); }).join(' ; ') : '')) +
      li('Exception effective', f.exception ? (f.exception.type || 'oui') + ' (' + (f.exception.statut || '') + ')' : 'aucune') +
      li('Prix décidé', pd ? eur(pd.prix_ttc) + ', état : ' + (pd.etat || 'n/d') : 'aucun') +
      li('Alertes', alertes.length ? alertes.join(', ') : 'aucune') + '</details>';
  }
  // ---------- Objectifs de marge (A4-1b) : proposer puis valider une cible, par deux comptes distincts ----------
  // La cible validée vit dans tarif_seuils (registre versionné) et reste active tant qu'une proposition de révision attend.
  // La proposition vit dans marge_cible_propositions. L'écriture passe par trois fonctions SQL (proposer_marge_cible,
  // valider_marge_cible, retirer_marge_cible) ; l'écran ne les écrit jamais en direct. L'objectif n'entre dans aucune note d'équipe.
  var LIB_STATUT_OBJECTIF = { valide: 'défini, valide', indicatif: 'indicatif, à valider', a_l_etude: 'à l\'étude', hypothese: 'hypothèse' };
  function niveauObjectif(l) {
    if (l && l.famille) return { niveau: 'famille', cible_niveau: l.famille, libelle: 'famille ' + l.famille };
    if (l && l.rayon) return { niveau: 'rayon', cible_niveau: l.rayon, libelle: 'rayon ' + l.rayon };
    return null;
  }
  function objectifDe(l, etat) {
    var n = niveauObjectif(l); if (!n) return { niveau: null, ligne: null };
    var rows = (etat && etat.objectifs) || [];
    var ligne = rows.filter(function (r) { return r.niveau === n.niveau && r.cible_niveau === n.cible_niveau && r.cible !== null && r.cible !== undefined; })[0] || null;
    var props = (etat && etat.propositions) || [];
    var proposition = props.filter(function (r) { return r.statut === 'ouverte' && r.niveau === n.niveau && r.cible_niveau === n.cible_niveau; })[0] || null;
    return { niveau: n, ligne: ligne, proposition: proposition };
  }
  function pourcentVersFraction(texte) {
    var t = String(texte === undefined || texte === null ? '' : texte).replace(',', '.').replace('%', '').trim();
    if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
    var v = parseFloat(t) / 100;
    return v >= 0 && v < 1 ? Math.round(v * 10000) / 10000 : null;
  }
  var MESSAGES_OBJECTIF = {
    objectif_non_habilite_proposer: 'Vous n\'avez pas le droit de proposer un objectif de marge sur ce site.',
    objectif_non_habilite_valider: 'Vous n\'avez pas le droit de valider un objectif de marge sur ce site.',
    objectif_auto_validation_interdite: 'Vous ne pouvez pas valider votre propre proposition : un autre compte doit le faire.',
    marge_cible_sous_minimum: 'La cible proposée est inférieure au minimum déjà défini pour ce niveau.',
    marge_cible_invalide: 'La cible doit être un pourcentage compris entre 0 et moins de 100.',
    marge_cible_proposition_existante: 'Une proposition est déjà en attente sur ce niveau. Retirez-la ou faites-la valider avant d\'en proposer une autre.',
    marge_cible_proposition_close: 'Cette proposition n\'est plus en attente. Rechargez la fiche.',
    marge_cible_introuvable: 'Cette proposition n\'existe plus. Rechargez la fiche.',
    marge_cible_motif_requis: 'Un retrait demande un motif.',
    objectif_non_habilite_retirer: 'Vous n\'avez pas le droit de retirer cette proposition.',
    objectif_autre_station: 'Cet objectif concerne une autre station.',
    objectif_non_authentifie: 'Session expirée : reconnectez-vous.'
  };
  function messageErreurObjectif(e) {
    var m = String((e && (e.message || e)) || '');
    for (var k in MESSAGES_OBJECTIF) { if (m.indexOf(k) !== -1) return MESSAGES_OBJECTIF[k]; }
    return 'L\'objectif n\'a pas pu être enregistré. Aucune modification n\'a été faite.';
  }
  // Corps commun de la carte d'objectif : même circuit (proposer, valider par un autre compte, retirer) pour la fiche et pour la station.
  // z.id distingue les deux zones (identifiants de champs, message de confirmation) ; z.note est la phrase d'usage de l'objectif.
  function corpsObjectif(n, etat, z) {
    var d = (etat && etat.droitsObjectif) || {}, id = z.id;
    var rows = (etat && etat.objectifs) || [], props = (etat && etat.propositions) || [];
    var o = { niveau: n,
      ligne: rows.filter(function (r) { return r.niveau === n.niveau && r.cible_niveau === n.cible_niveau && r.cible !== null && r.cible !== undefined; })[0] || null,
      proposition: props.filter(function (r) { return r.statut === 'ouverte' && r.niveau === n.niveau && r.cible_niveau === n.cible_niveau; })[0] || null };
    var st = o.ligne ? (LIB_STATUT_OBJECTIF[o.ligne.statut_cible] || o.ligne.statut_cible) : 'non défini';
    var h = '<div class="pt-pol-l"><span class="sc-lib">Objectif (' + esc(n.libelle) + ')</span><span data-objectif-statut="' + (o.ligne ? esc(o.ligne.statut_cible) : 'non_defini') + '">' +
      (o.ligne ? esc(pct(num(o.ligne.cible))) + ' : ' : '') + esc(st) + '</span></div>';
    h += '<p class="sc-note">' + esc(z.note) + '</p>';
    var pr = o.proposition;
    if (pr) {
      h += '<div class="pt-pol-l"><span class="sc-lib">Proposition en attente</span><span data-objectif-proposition="' + esc(pr.id) + '">proposé ' + esc(pct(num(pr.cible))) + ', en attente de validation</span></div>';
      if (o.ligne && o.ligne.statut_cible === 'valide') h += '<p class="sc-note">L\'objectif validé reste en vigueur jusqu\'à la validation de cette proposition.</p>';
      var auteur = etat.userId && pr.propose_par === etat.userId;
      if (d.valider && etat.userId && !auteur) {
        h += '<button type="button" class="detail-btn pt-obj-btn" data-objectif-valider="' + esc(pr.id) + '">Valider cette proposition</button>';
      } else if (d.valider && auteur) {
        h += '<p class="sc-note" data-objectif-attente="1">Un autre compte doit valider votre proposition.</p>';
      }
      if ((d.valider || (d.proposer && auteur)) && etat.userId) {
        h += '<div class="pt-obj-form"><label class="sc-lib" for="pt-obj-motif-' + id + '">Motif du retrait</label><input id="pt-obj-motif-' + id + '" type="text" maxlength="300" data-objectif-motif="1">' +
          '<button type="button" class="detail-btn pt-obj-btn" data-objectif-retirer="' + esc(pr.id) + '">Retirer la proposition</button></div>';
      }
    }
    if (d.proposer && !pr) {
      h += '<div class="pt-obj-form"><label class="sc-lib" for="pt-obj-cible-' + id + '">Proposer une cible</label>' +
        '<span class="pt-obj-champ"><input id="pt-obj-cible-' + id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 28" aria-describedby="pt-obj-pct-' + id + '" data-objectif-cible="1"><span class="pt-obj-pct" id="pt-obj-pct-' + id + '">%</span></span>' +
        '<label class="sc-lib" for="pt-obj-com-' + id + '">Commentaire (facultatif)</label><input id="pt-obj-com-' + id + '" type="text" maxlength="300" data-objectif-commentaire="1">' +
        '<button type="button" class="detail-btn pt-obj-btn" data-objectif-proposer="1" data-niveau="' + esc(n.niveau) + '" data-cible-niveau="' + esc(n.cible_niveau) + '">Proposer</button></div>';
    } else if (!d.proposer && !d.valider) {
      h += '<p class="sc-note">Lecture seule : proposer ou valider un objectif demande une habilitation.</p>';
    }
    var m = etat && etat.objectifMsg && etat.objectifMsg.zone === id ? etat.objectifMsg.texte : '';
    return h + '<p class="sc-msg sc-note pt-obj-msg" role="status" data-objectif-msg="1">' + esc(m) + '</p>';
  }
  function htmlObjectifMarge(l, etat) {
    var h = '<details class="sc-carte pt-obj" data-objectif-marge="fiche"' + (etat && etat.objectifOuvert ? ' open' : '') + '><summary><span class="sc-nom">Objectifs de marge</span><span class="sc-chev"></span></summary>';
    var n = niveauObjectif(l);
    if (!n) return h + '<p class="sc-note">Aucune famille ni rayon : pas d\'objectif possible pour cette référence.</p></details>';
    return h + corpsObjectif(n, etat, { id: 'fiche', note: 'Cet objectif n\'entre dans aucune note d\'équipe.' }) + '</details>';
  }
  // ---------- A4-1e : objectifs par famille, validation et proposition groupées ----------
  // Une famille par ligne, triée par CA de la période. Aucune ligne « defaut » : l'objectif de la station est calculé, jamais saisi.
  var LIB_STATUT_FAMILLE = { valide: 'validée', indicatif: 'indicative', a_l_etude: 'à l\'étude', hypothese: 'hypothèse' };
  var MAX_LIGNES_FAMILLES = 10;
  // A4-1f : carte « Objectifs de marge par famille ». Aucune règle de calcul ni de circuit ici : présentation seule.
  function lignesObjectifsFamilles(etat) {
    var rows = (etat && etat.objectifs) || [], props = (etat && etat.propositions) || [];
    var analyse = (etat && etat.analyse) || {}, par = {}, ordre = [];
    function ajouter(f) { if (!par[f]) { par[f] = { famille: f, ca: 0, avecCa: false, rayon: '' }; ordre.push(f); } return par[f]; }
    (analyse.lignes || []).forEach(function (l) {
      if (!l.famille) return;
      var p = ajouter(l.famille);
      if (!p.rayon && l.rayon) p.rayon = l.rayon;
      var c = num(l.ca_ht); if (c !== null) { p.ca += c; if (c > 0) p.avecCa = true; }
    });
    rows.forEach(function (r) { if (r.niveau === 'famille') ajouter(r.cible_niveau); });
    props.forEach(function (r) { if (r.statut === 'ouverte' && r.niveau === 'famille') ajouter(r.cible_niveau); });
    return ordre.map(function (f) {
      var o = par[f];
      o.ligne = rows.filter(function (r) { return r.niveau === 'famille' && r.cible_niveau === f && r.cible !== null && r.cible !== undefined; })[0] || null;
      o.ligneMin = rows.filter(function (r) { return r.niveau === 'famille' && r.cible_niveau === f && ((r.cible !== null && r.cible !== undefined) || (r.minimum !== null && r.minimum !== undefined)); })[0] || null;
      o.proposition = props.filter(function (r) { return r.statut === 'ouverte' && r.niveau === 'famille' && r.cible_niveau === f; })[0] || null;
      o.statut = o.ligne ? o.ligne.statut_cible : 'non_defini';
      o.sansVente = !o.avecCa;
      return o;
    }).sort(function (a, b) {
      if (a.sansVente !== b.sansVente) return a.sansVente ? 1 : -1;
      if (b.ca !== a.ca) return b.ca - a.ca;
      var la = libelleFamille(etat, a.famille), lb = libelleFamille(etat, b.famille), c = la.localeCompare(lb, 'fr');
      return c || (a.famille < b.famille ? -1 : a.famille > b.famille ? 1 : 0);
    });
  }
  // Libellé de tarif_familles (« Chips et petits salés »), le code en repli quand il manque.
  function libelleFamille(etat, code) {
    var m = (etat && etat.libellesFamilles) || {}, v = m[code];
    return (typeof v === 'string' && v.trim()) ? v.trim() : code;
  }
  var FILTRES_FAMILLE = [['tous', 'Toutes'], ['valide', 'Validées'], ['indicatif', 'Indicatives'], ['etude', 'À l\'étude'], ['hypothese', 'Hypothèses'], ['sans_cible', 'Sans cible'], ['attente', 'En attente']];
  function correspondFiltre(o, f) {
    if (!f || f === 'tous') return true;
    if (f === 'valide') return !!o.ligne && o.statut === 'valide';
    if (f === 'attente') return !!o.proposition;
    if (f === 'indicatif') return !!o.ligne && o.statut === 'indicatif';
    if (f === 'etude') return !!o.ligne && o.statut === 'a_l_etude';
    if (f === 'hypothese') return !!o.ligne && o.statut === 'hypothese';
    if (f === 'sans_cible') return o.ligne === null;
    return true;
  }
  // Effectif de chaque filtre, toutes familles confondues (affiché dans la pastille).
  function compteFiltres(etat) {
    var lignes = lignesObjectifsFamilles(etat), r = {};
    FILTRES_FAMILLE.forEach(function (f) { r[f[0]] = lignes.filter(function (o) { return correspondFiltre(o, f[0]); }).length; });
    return r;
  }
  function filtreFamilles(etat) {
    var g = (etat && etat.groupe) || {}, q = String(g.recherche || '').trim().toLowerCase();
    return lignesObjectifsFamilles(etat).filter(function (o) {
      if (!correspondFiltre(o, g.filtre)) return false;
      return !q || libelleFamille(etat, o.famille).toLowerCase().indexOf(q) !== -1 || o.famille.toLowerCase().indexOf(q) !== -1;
    });
  }
  // Une ligne est éligible à valider (proposition d'un autre compte) ou à proposer (cible active non validée, sans proposition ouverte).
  function eligibleValider(o, d, uid) { return !!(d.valider && uid && o.proposition && o.proposition.propose_par !== uid); }
  function eligibleProposer(o, d, uid) { return !!(d.proposer && uid && !o.proposition && o.ligne && o.statut !== 'valide'); }
  // portee : 'visible' (défaut, lignes filtrées) ou 'toutes' (toutes les familles, filtres ignorés).
  function eligiblesGroupe(etat, mode, portee) {
    var d = (etat && etat.droitsObjectif) || {}, uid = etat && etat.userId; if (!uid) return [];
    var src = portee === 'toutes' ? lignesObjectifsFamilles(etat) : filtreFamilles(etat), out = [];
    src.forEach(function (o) {
      if (mode === 'valider') { if (eligibleValider(o, d, uid)) out.push(o.proposition.id); }
      else if (eligibleProposer(o, d, uid)) out.push(o.famille);
    });
    return out;
  }
  // Objectif de la station : calculé à partir des cibles validées, hors rayons exclus. Lecture seule.
  function htmlObjectifCalcule(etat) {
    if (!NCM) return '';
    var cibles = {};
    ((etat && etat.objectifs) || []).forEach(function (r) { if (r.niveau === 'famille' && r.statut_cible === 'valide' && r.cible !== null && r.cible !== undefined) cibles[r.cible_niveau] = r.cible; });
    var o = NCM.objectifStation(((etat && etat.analyse) || {}).lignes || [], { exclus: (etat && etat.rayonsExclus) || [], cibles: cibles });
    var h = '<p class="sc-note" data-objectif-calcule="' + esc(o.etat) + '"><span class="sc-lib">Objectif calculé</span> ';
    var cc = Math.round(o.couvertureCa * 100), cf = Math.round(o.couvertureFamilles * 100);
    var sm = o.sansMarge || { lignes: 0, ca: 0 };
    if (!o.famillesCiblees) return h + 'non évalué : aucune cible validée sur le périmètre.</p>';
    if (o.etat !== 'evalue') {
      h = h.replace('<span class="sc-lib">Objectif calculé</span> ', '');
      h += 'Objectif de la station non évalué : les cibles validées couvrent ' + cc + ' % du CA pilotable (seuil ' + Math.round(NCM.SEUIL_COUVERTURE * 100) + ' %). ';
      if (o.cibleMoyenne !== null) h += 'Cible moyenne des familles validées : ' + pct(o.cibleMoyenne) + '. ';
    } else {
      h += pct(o.cible) + ' sur ' + o.familles + (o.familles > 1 ? ' familles' : ' famille') + ' ; marge réelle ' + pct(o.marge) + ', sur le même périmètre. ';
    }
    h += 'Couverture : ' + cf + ' % des familles pilotables, ' + cc + ' % du chiffre d\'affaires pilotable. ';
    if (sm.lignes) h += sm.lignes + (sm.lignes > 1 ? ' lignes' : ' ligne') + ' avec une cible mais sans marge connue (' + eur0(sm.ca) + ' de CA), hors calcul.';
    return h + '</p>';
  }
  // Sélections rapides, toutes familles confondues : « Les indicatives » et « Toutes les cibles à proposer ».
  function selectionRapide(etat, type) {
    var d = (etat && etat.droitsObjectif) || {}, uid = etat && etat.userId; if (!uid) return [];
    return lignesObjectifsFamilles(etat).filter(function (o) { return eligibleProposer(o, d, uid) && (type !== 'indicatives' || o.statut === 'indicatif'); })
      .map(function (o) { return o.famille; });
  }
  function indicateursFamilles(etat) {
    var r = { total: 0, valides: 0, indicatives: 0, etude: 0, hypotheses: 0, aFaireValider: 0, attente: 0, sansCible: 0, sansCibleAvecAttente: 0 };
    lignesObjectifsFamilles(etat).forEach(function (o) {
      r.total++;
      if (o.proposition) r.attente++;
      if (o.ligne === null) { r.sansCible++; if (o.proposition) r.sansCibleAvecAttente++; return; }
      if (o.statut === 'valide') r.valides++; else if (o.statut === 'indicatif') r.indicatives++; else if (o.statut === 'hypothese') r.hypotheses++; else r.etude++;
    });
    r.aFaireValider = r.indicatives + r.etude + r.hypotheses;
    return r;
  }
  // Retire de l'envoi ce qui a changé depuis la sélection : proposition plus ouverte, ou famille déjà proposée.
  function filtrerDoublons(mode, items, propositions) {
    var ouvertes = (propositions || []).filter(function (p) { return p.statut === 'ouverte'; });
    var gardes = [], ecartes = [];
    (items || []).forEach(function (it) {
      var dejaId = mode === 'valider' ? !ouvertes.some(function (p) { return p.id === it.id; })
        : ouvertes.some(function (p) { return p.niveau === 'famille' && p.cible_niveau === it.famille; });
      (dejaId ? ecartes : gardes).push(it);
    });
    return { gardes: gardes, ecartes: ecartes };
  }
  function cleCachePrefs(site, uid) { return 'nexus.objf.' + String(site || '') + '.' + String(uid || ''); }
  function lirePrefsFamilles(storage, site, uid) {
    try { var v = JSON.parse(storage.getItem(cleCachePrefs(site, uid)) || 'null'); if (v && typeof v === 'object') return { tout: v.tout === true, repli: typeof v.repli === 'boolean' ? v.repli : null }; } catch (e) { /* stockage absent : valeurs par défaut */ }
    return { tout: false, repli: null };
  }
  function ecrirePrefsFamilles(storage, site, uid, prefs) {
    try { storage.setItem(cleCachePrefs(site, uid), JSON.stringify({ tout: !!prefs.tout, repli: prefs.repli === null || prefs.repli === undefined ? null : !!prefs.repli })); return true; } catch (e) { return false; }
  }
  var STATUTS_FAMILLE = [['valide', 'Validée', 'Validées'], ['indicatif', 'Indicative', 'Indicatives'], ['etude', 'À l\'étude', 'À l\'étude'], ['hypothese', 'Hypothèse', 'Hypothèses'], ['non_defini', 'Non définie', 'Non définies']];
  var SVG_CADENAS = '<svg class="pt-objf-cadenas" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"></rect><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"></path></svg>';
  var SVG_CIBLE = '<svg class="pt-objf-icone" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"></circle><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.8"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor"></circle></svg>';
  function cleStatut(o) {
    if (!o.ligne) return 'non_defini';
    if (o.statut === 'a_l_etude') return 'etude';
    if (o.statut === 'valide' || o.statut === 'indicatif' || o.statut === 'hypothese') return o.statut;
    return 'etude';
  }
  function libStatut(k, pluriel) {
    var r = STATUTS_FAMILLE.filter(function (s) { return s[0] === k; })[0];
    return r ? (pluriel ? r[2] : r[1]) : k;
  }
  // Statut d'une valeur (plancher ou cible) du registre, écrit en minuscules sous le chiffre.
  function libValeur(st) { return st === 'a_l_etude' ? 'à l\'étude' : st === 'valide' ? 'validé' : st === 'hypothese' ? 'hypothèse' : st === 'indicatif' ? 'indicatif' : String(st); }
  function badgeStatutFamille(o) {
    var k = cleStatut(o);
    return '<span class="pt-objf-badge pt-objf-st-' + k + '" data-objf-statut="' + k + '">' + esc(libStatut(k)) + '</span>';
  }
  // Bornes communes de l'échelle : toutes les familles ayant une cible, arrondies au multiple de 5 (points de marge).
  function bornesEchelle(etat) {
    var lo = null, hi = null;
    lignesObjectifsFamilles(etat).forEach(function (o) {
      if (!o.ligneMin) return;
      [num(o.ligneMin.cible), num(o.ligneMin.minimum)].forEach(function (v) {
        if (v === null) return;
        v = v * 100;
        if (lo === null || v < lo) lo = v;
        if (hi === null || v > hi) hi = v;
      });
    });
    if (lo === null) return { lo: 30, hi: 60 };
    var a = Math.max(0, Math.floor((lo - 5) / 5) * 5), b = Math.ceil((hi + 5) / 5) * 5;
    if (b <= a) b = a + 5;
    return { lo: a, hi: b };
  }
  function echelleFamille(o, b, avecBornes) {
    if (!o.ligneMin) return '<span class="sc-note">pas de cible</span>';
    var k = cleStatut(o), c = num(o.ligneMin.cible), m = num(o.ligneMin.minimum);
    var pos = function (v) { return Math.max(0, Math.min(100, (v * 100 - b.lo) / (b.hi - b.lo) * 100)).toFixed(1); };
    var txt = 'Échelle ' + b.lo + ' à ' + b.hi + ' %' + (m !== null ? ' · plancher ' + pct(m) : '') + (c !== null ? ' · cible ' + pct(c) : '');
    return '<span class="pt-objf-echelle pt-objf-st-' + k + '" role="img" aria-label="' + esc(txt) + '"><span class="pt-objf-rail">' +
      (m !== null && c !== null ? '<span class="pt-objf-zone" style="left:' + pos(m) + '%;width:' + (pos(c) - pos(m)).toFixed(1) + '%"></span>' : '') +
      (m !== null ? '<span class="pt-objf-rep pt-objf-plancher" style="left:' + pos(m) + '%"></span>' : '') +
      (c !== null ? '<span class="pt-objf-rep pt-objf-cible" style="left:' + pos(c) + '%"></span>' : '') + '</span>' +
      (avecBornes ? '<span class="pt-objf-bornes pt-num"><span>' + b.lo + ' %</span><span>' + b.hi + ' %</span></span>' : '') + '</span>';
  }
  function htmlSyntheseFamilles(ind) {
    var cles = [['valide', ind.valides, 'valides', 'Validées'], ['indicatif', ind.indicatives, 'indicatives', 'Indicatives'], ['etude', ind.etude, 'etude', 'À l\'étude'], ['hypothese', ind.hypotheses, 'hypotheses', 'Hypothèses'], ['non_defini', ind.sansCible, 'sans-cible', 'Sans cible']];
    var kpi = function (c) {
      var sous = c[0] === 'non_defini' && ind.sansCibleAvecAttente ? 'dont ' + ind.sansCibleAvecAttente + ' avec une proposition en attente' : '';
      return '<div class="pt-objf-kpi pt-objf-st-' + c[0] + '" data-objf-kpi="' + c[2] + '"><span class="pt-objf-kpi-n pt-num">' + c[1] + '</span><span class="pt-objf-kpi-l"><span class="pt-objf-pt" aria-hidden="true"></span>' + esc(c[3]) + '</span>' + (sous ? '<span class="pt-objf-kpi-s">' + esc(sous) + '</span>' : '') + '</div>';
    };
    var desc = cles.map(function (c) { return c[1] + ' ' + c[3].toLowerCase(); }).join(', ');
    return '<div class="pt-objf-synthese" data-objf-synthese="1">' + cles.map(kpi).join('') +
      '<div class="pt-objf-repart" role="img" aria-label="Répartition : ' + esc(desc) + '">' +
      cles.map(function (c) { return c[1] ? '<span class="pt-objf-seg pt-objf-st-' + c[0] + '" style="flex:' + c[1] + '" title="' + esc(c[3] + ' : ' + c[1]) + '"></span>' : ''; }).join('') + '</div>' +
      '<ul class="pt-objf-legende" data-objf-legende="1">' + cles.map(function (c) { return '<li class="pt-objf-st-' + c[0] + '"><span class="pt-objf-pt" aria-hidden="true"></span>' + esc(c[3]) + ' <b class="pt-num">' + c[1] + '</b></li>'; }).join('') + '</ul></div>';
  }
  function htmlAideFamilles(repli) {
    return '<aside class="pt-objf-aide" data-objf-aide="' + (repli ? 'replie' : 'ouvert') + '"><button type="button" class="detail-btn" data-objf-repli="1" aria-expanded="' + (repli ? 'false' : 'true') + '">' + (repli ? 'Afficher l\'aide' : 'Masquer l\'aide') + '</button>' +
      (repli ? '' : '<div class="pt-objf-aide-corps"><p class="sc-lib">Le circuit en 3 étapes</p><ol><li>Une cible est proposée pour la famille.</li><li>Un autre compte habilité la valide.</li><li>Elle devient la cible en vigueur de la station.</li></ol>' +
        '<p class="sc-lib">Lire un statut</p><ul><li>Validée : cible en vigueur, verrouillée.</li><li>Indicative : valeur de travail du registre, pas encore validée.</li><li>À l\'étude : valeur en cours d\'analyse, à confirmer avant de la proposer.</li><li>Hypothèse : valeur provisoire, sans historique suffisant.</li><li>Non définie : aucune cible pour cette famille.</li></ul>' +
        '<p class="sc-lib">Lire l\'échelle</p><ul><li>Le trait gris est le plancher, le trait coloré la cible.</li><li>Toutes les familles partagent les mêmes bornes.</li></ul></div>') + '</aside>';
  }
  function libelleItemRecap(etat, mode, cle) {
    var o = lignesObjectifsFamilles(etat).filter(function (x) { return mode === 'valider' ? (x.proposition && x.proposition.id === cle) : x.famille === cle; })[0];
    if (!o) return { texte: String(cle), risque: false, statut: 'non_defini', cle: cle };
    var v = mode === 'valider' ? (o.proposition ? o.proposition.cible : null) : (o.ligne ? o.ligne.cible : null);
    var pl = o.ligneMin ? num(o.ligneMin.minimum) : null;
    return { plancher: pl, texte: libelleFamille(etat, o.famille) + ' : ' + pct(num(v)) + (pl !== null ? ' (plancher ' + pct(pl) + ')' : ''), risque: !!o.ligne && (o.statut === 'a_l_etude' || o.statut === 'hypothese'), famille: o.famille, statut: cleStatut(o), cle: cle };
  }
  function enModeCartes(etat) { return !!etat && typeof etat.largeur === 'number' && etat.largeur < 900; }
  function phraseTri(etat) {
    var a = etat && etat.analyse, p = a && ((a.synthese && a.synthese.periode) || a.periode);
    if (p && p.debut && p.fin) return 'Tri : chiffre d\'affaires du ' + jourFr(p.debut).slice(0, 5) + ' au ' + jourFr(p.fin).slice(0, 5);
    return 'Tri : chiffre d\'affaires de la période';
  }
  function piecesFamille(etat, o, c) {
    var k = cleStatut(o), auteur = etat.userId && o.proposition && o.proposition.propose_par === etat.userId, case_ = '', prop = '';
    if (o.proposition) {
      prop = '<span class="pt-num">' + esc(pct(num(o.proposition.cible))) + '</span> ' + (B && B.traitement ? B.traitement('en-attente', { libelle: 'À valider' }) : 'à valider') + (auteur ? ' <span class="sc-note" data-objf-attente="1">Un autre compte doit valider.</span>' : '');
      if (c.peut && eligibleValider(o, c.d, etat.userId)) case_ = '<input type="checkbox" data-objf-valider="' + esc(o.proposition.id) + '" aria-label="Valider la proposition ' + esc(libelleFamille(etat, o.famille)) + '"' + (c.selV.indexOf(o.proposition.id) !== -1 ? ' checked' : '') + (c.occupe ? ' disabled' : '') + '>';
    } else if (c.peut && eligibleProposer(o, c.d, etat.userId)) {
      case_ = '<input type="checkbox" data-objf-proposer="' + esc(o.famille) + '" aria-label="Proposer la cible ' + esc(libelleFamille(etat, o.famille)) + '"' + (c.selP.indexOf(o.famille) !== -1 ? ' checked' : '') + (c.occupe ? ' disabled' : '') + '>';
    }
    var verrou = k === 'valide' && !case_ ? '<span class="pt-objf-vigueur" data-objf-vigueur="1">' + SVG_CADENAS + '<span>En vigueur</span></span>' : '';
    var m = o.ligneMin ? num(o.ligneMin.minimum) : null, ci = o.ligne ? num(o.ligne.cible) : null;
    var sm = o.ligneMin ? o.ligneMin.statut_minimum : null, sc = o.ligne ? o.ligne.statut_cible : null;
    var stPlancher = m !== null && sm && sm !== sc ? '<span class="pt-objf-plancher-st" data-objf-plancher-statut="' + esc(sm) + '">' + esc(libValeur(sm)) + '</span>' : '';
    return {
      k: k, case_: case_, verrou: verrou, prop: prop || '<span class="sc-note">aucune</span>',
      fam: '<span class="pt-objf-fam">' + vignetteFamille({ rayon: o.rayon }) + '<span><span class="sc-lib">' + esc(libelleFamille(etat, o.famille)) + '</span>' + (o.sansVente ? '<span class="sc-note">sans vente sur la période</span>' : '<span class="sc-note pt-num">' + esc(eur0(o.ca)) + '</span>') + '</span></span>',
      plancher: (m !== null ? esc(pct(m)) : '—') + stPlancher, cible: ci !== null ? esc(pct(ci)) : '—'
    };
  }
  // Icône du module Produits (registre nexus-icones.js), la cible dessinée en repli si la bibliothèque manque.
  function iconeEnTete() {
    var lib = NI && NI.img ? NI : global.NexusIcones;
    var i = lib && lib.img ? lib.img('mod-produits', 28, { decoratif: true, ancien: '' }) : '';
    return i ? '<span class="pt-objf-icone" data-objf-icone="mod-produits">' + i + '</span>' : SVG_CIBLE;
  }
  function htmlObjectifsFamilles(etat) {
    var d = (etat && etat.droitsObjectif) || {}, g = (etat && etat.groupe) || {};
    var peut = !!(d.valider || d.proposer) && !!(etat && etat.userId);
    var h = '<section class="sc-carte pt-obj pt-obj-familles" data-objectifs-familles="1" aria-label="Objectifs de marge par famille"><div class="pt-objf-tete">' + iconeEnTete() +
      '<div class="pt-objf-tete-txt"><div class="sc-nom">Objectifs de marge par famille</div><p class="sc-note">Pour chaque famille : le plancher à ne pas franchir, la cible visée et l\'état de validation.</p></div>' +
      '<span class="pt-objf-source sc-note" data-objf-source="1">Source unique : registre tarifaire de la station</span></div>';
    if (etat && etat.objectifsChargement) return h + '<div class="pt-objf-squelette" data-objf-chargement="1" aria-busy="true"><span></span><span></span><span></span><span></span></div></section>';
    if (etat && etat.objectifsErreur) return h + '<p class="sc-note" role="alert" data-objf-erreur="1">Lecture des objectifs impossible pour le moment. Votre sélection est conservée.</p><button type="button" class="detail-btn" data-objf-relire="1">Réessayer la lecture</button></section>';
    var lignes = lignesObjectifsFamilles(etat);
    if (!lignes.length) return h + '<p class="sc-note">Aucune famille sur la période.</p></section>';
    var ind = indicateursFamilles(etat), repli = g.repli === true, cartes = enModeCartes(etat);
    var filtrees = filtreFamilles(etat), vues = filtrees, totalVues = vues.length;
    var limite = !g.tout && totalVues > MAX_LIGNES_FAMILLES; if (limite) vues = vues.slice(0, MAX_LIGNES_FAMILLES);
    var selV = g.selValider || [], selP = g.selProposer || [], occupe = !!g.enCours;
    var c = { peut: peut, d: d, selV: selV, selP: selP, occupe: occupe }, b = bornesEchelle(etat), cnt = compteFiltres(etat);
    var pointFiltre = { valide: 'valide', indicatif: 'indicatif', etude: 'etude', hypothese: 'hypothese', sans_cible: 'non_defini' };
    h += htmlSyntheseFamilles(ind) + htmlObjectifCalcule(etat);
    var nbV = selV.length, nbP = selP.length, nbSel = nbV + nbP, barre = '';
    if (peut && (nbSel || occupe)) {
      var estSel = function (o) { return (o.proposition && selV.indexOf(o.proposition.id) !== -1) || selP.indexOf(o.famille) !== -1; };
      var visibles = vues.filter(estSel).length;
      var hors = Math.max(0, nbSel - visibles);
      var parSt = {}; lignes.filter(estSel).forEach(function (o) { var k = cleStatut(o); parSt[k] = (parSt[k] || 0) + 1; });
      var detailSt = STATUTS_FAMILLE.filter(function (x) { return parSt[x[0]]; }).map(function (x) { return parSt[x[0]] + ' ' + libStatut(x[0], parSt[x[0]] > 1).toLowerCase(); }).join(', ');
      barre += '<div class="pt-objf-barre" data-objf-barre="1" role="region" aria-label="Sélection"><span class="pt-objf-barre-txt" data-objf-selection="1"><b class="pt-num">' + nbSel + '</b> ' + (nbSel > 1 ? 'familles sélectionnées' : 'famille sélectionnée') + (hors ? ' <span class="sc-note" data-objf-hors-vue="1">dont ' + hors + ' hors de la vue</span>' : '') + (detailSt ? '<span class="sc-note pt-objf-detail-st" data-objf-detail-statuts="1">' + esc(detailSt) + '</span>' : '') + '</span>' +
        (nbV ? '<button type="button" class="detail-btn pt-obj-btn" data-objf-envoyer="valider"' + (occupe ? ' disabled' : '') + '>Valider ces ' + nbV + (nbV > 1 ? ' propositions' : ' proposition') + '</button>' : '') +
        (nbP ? '<button type="button" class="detail-btn pt-obj-btn" data-objf-envoyer="proposer"' + (occupe ? ' disabled' : '') + '>Proposer ' + (nbP > 1 ? 'ces ' + nbP + ' cibles telles quelles' : 'cette cible telle quelle') + '</button>' : '') +
        '<button type="button" class="detail-btn" data-objf-vider="1"' + (occupe ? ' disabled' : '') + '>Vider la sélection</button></div>';
    }
    // Bureau : barre collée en haut, avant la liste. Mobile : après la liste, collée en bas (un sticky bas ne colle que si sa place naturelle est sous l'écran).
    if (!cartes) h += barre;
    h += '<div class="pt-objf-outils"><label class="sc-lib" for="pt-objf-rech">Chercher une famille</label><input id="pt-objf-rech" type="search" data-objf-recherche="1" value="' + esc(g.recherche || '') + '">' +
      '<p class="sc-note pt-objf-tri" data-objf-tri="1">' + esc(phraseTri(etat)) + '</p>' +
      '<div class="pt-objf-pilules" role="group" aria-label="Filtrer par statut">' + FILTRES_FAMILLE.map(function (f) {
        return '<button type="button" class="pt-objf-pilule" data-objf-filtre="' + f[0] + '" aria-pressed="' + ((g.filtre || 'tous') === f[0] ? 'true' : 'false') + '">' +
          (pointFiltre[f[0]] ? '<span class="pt-objf-pt pt-objf-st-' + pointFiltre[f[0]] + '" aria-hidden="true"></span>' : '') + esc(f[1]) + ' <span class="pt-objf-n pt-num" data-objf-compte="' + f[0] + '">' + (cnt[f[0]] || 0) + '</span></button>';
      }).join('') + '</div></div>';
    if (peut) {
      var nbInd = selectionRapide(etat, 'indicatives').length, nbTout = selectionRapide(etat, 'toutes').length;
      h += '<div class="pt-objf-rapides"><button type="button" class="detail-btn" data-objf-rapide="indicatives"' + (occupe || !nbInd ? ' disabled' : '') + '>Les indicatives (' + nbInd + ')</button> ' +
        '<button type="button" class="detail-btn" data-objf-rapide="toutes"' + (occupe || !nbTout ? ' disabled' : '') + '>Toutes les cibles à proposer (' + nbTout + ')</button></div>';
    } else h += '<p class="sc-note">Lecture seule : proposer ou valider un objectif demande une habilitation.</p>';
    var entete = '';
    if (peut) {
      var elig = vues.filter(function (o) { return eligibleValider(o, d, etat.userId) || eligibleProposer(o, d, etat.userId); });
      var cochees = elig.filter(function (o) { return o.proposition && eligibleValider(o, d, etat.userId) ? selV.indexOf(o.proposition.id) !== -1 : selP.indexOf(o.famille) !== -1; }).length;
      entete = '<input type="checkbox" data-objf-entete="1" aria-label="Sélectionner les familles visibles"' + (elig.length && cochees === elig.length ? ' checked' : '') + (!elig.length || occupe ? ' disabled' : '') + (cochees && cochees < elig.length ? ' data-mixte="1"' : '') + '>';
    }
    h += '<div class="pt-objf-corps">';
    if (cartes) {
      h += '<div class="pt-objf-liste" data-objf-cartes="1">' + (peut ? '<label class="pt-objf-case pt-objf-tout">' + entete + ' Sélectionner les familles visibles</label>' : '');
      vues.forEach(function (o) {
        var p = piecesFamille(etat, o, c);
        h += '<article class="pt-objf-carte pt-objf-st-' + p.k + '" data-objf-famille="' + esc(o.famille) + '" data-objectif-statut="' + esc(o.statut) + '"><div class="pt-objf-carte-tete"><span class="pt-objf-carte-case">' + (p.case_ || p.verrou) + '</span>' + p.fam + badgeStatutFamille(o) + '</div>' +
          '<div class="pt-objf-carte-chiffres"><span>Plancher <b class="pt-num">' + p.plancher + '</b></span><span>Cible <b class="pt-num">' + p.cible + '</b></span></div>' + echelleFamille(o, b, true) + (o.proposition ? '<div class="pt-objf-carte-prop">Proposition : ' + p.prop + '</div>' : '') + '</article>';
      });
      h += '</div>';
    } else {
      h += '<div class="pt-objf-tablewrap"><table class="pt-objf-table"><thead><tr>' + (peut ? '<th class="pt-objf-c-case">' + entete + '</th>' : '') +
        '<th>Famille</th><th>Statut</th><th>Plancher</th><th>Cible</th><th>Échelle ' + b.lo + ' à ' + b.hi + ' %</th><th>Proposition</th></tr></thead><tbody>';
      vues.forEach(function (o) {
        var p = piecesFamille(etat, o, c);
        h += '<tr data-objf-famille="' + esc(o.famille) + '" data-objectif-statut="' + esc(o.statut) + '">' + (peut ? '<td class="pt-objf-c-case">' + (p.case_ || p.verrou) + '</td>' : '') +
          '<td class="pt-objf-c-fam">' + p.fam + '</td><td>' + badgeStatutFamille(o) + (!peut ? p.verrou : '') + '</td><td class="pt-num pt-objf-c-n">' + p.plancher + '</td><td class="pt-num pt-objf-c-n">' + p.cible + '</td><td>' + echelleFamille(o, b, false) + '</td><td>' + p.prop + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += htmlAideFamilles(repli) + '</div>';
    if (cartes) h += barre;
    if (!vues.length) h += '<p class="sc-note">Aucune famille ne correspond à ce filtre.</p>';
    if (totalVues > MAX_LIGNES_FAMILLES) h += '<button type="button" class="detail-btn" data-objf-afficher="1">' + (g.tout ? 'Afficher les ' + MAX_LIGNES_FAMILLES + ' premières' : 'Afficher les ' + totalVues + ' familles') + '</button>' + (limite ? '<span class="sc-note"> ' + (totalVues - MAX_LIGNES_FAMILLES) + ' autres familles masquées.</span>' : '');
    if (g.confirmer && !occupe) {
      var mode = g.confirmer.mode, reprise = !!g.confirmer.reprise;
      var cles = reprise ? (g.echecs || []) : (mode === 'valider' ? selV : selP), items = cles.map(function (x) { return libelleItemRecap(etat, mode, x); });
      var risque = items.some(function (x) { return x.risque; });
      var horsIndic = items.filter(function (x) { return x.statut !== 'indicatif' && x.statut !== 'non_defini'; });
      var avis = horsIndic.length ? '<p class="sc-note" data-objf-avis-statuts="1">' + horsIndic.length + (horsIndic.length > 1 ? ' cibles ne sont pas indicatives : ' : ' cible n\'est pas indicative : ') + esc(horsIndic.map(function (x) { return libelleFamille(etat, x.famille) + ' (' + libStatut(x.statut).toLowerCase() + ')'; }).join(', ')) + '.</p>' : '';
      var groupes = STATUTS_FAMILLE.map(function (s) {
        var liste = items.filter(function (x) { return x.statut === s[0]; });
        if (!liste.length) return '';
        return '<div class="pt-objf-groupe pt-objf-st-' + s[0] + '" data-objf-groupe="' + s[0] + '"><p class="sc-lib"><span class="pt-objf-pt" aria-hidden="true"></span>' + esc(s[2]) + ' (' + liste.length + ')</p><ul>' +
          liste.map(function (x) { return '<li>' + esc(x.texte) + ' <button type="button" class="detail-btn" data-objf-retirer="' + esc(mode + '|' + x.cle) + '">Retirer</button></li>'; }).join('') + '</ul></div>';
      }).join('');
      h += '<div class="pt-objf-confirm" role="alertdialog" aria-label="Confirmation" data-objf-confirm="' + esc(mode) + '"><p class="sc-lib">' + (reprise ? 'Réessayer ' : mode === 'valider' ? 'Valider ' : 'Proposer ') + items.length + (items.length > 1 ? ' objectifs ?' : ' objectif ?') + '</p>' + avis + groupes +
        (risque ? '<label class="pt-objf-case"><input type="checkbox" data-objf-risque="1"' + (g.risqueCoche ? ' checked' : '') + '> Je confirme l\'envoi de cibles à l\'étude ou en hypothèse.</label> ' : '') +
        '<button type="button" class="detail-btn pt-obj-btn" data-objf-confirmer="1"' + (items.length && (!risque || g.risqueCoche) ? '' : ' disabled') + '>Confirmer</button> <button type="button" class="detail-btn" data-objf-annuler="1">Annuler</button></div>';
    }
    if (occupe) h += '<p class="sc-note" role="status" data-objf-progres="1">Envoi en cours (' + ((g.progres && g.progres.k) || 0) + ' / ' + ((g.progres && g.progres.n) || 0) + ')</p>';
    if (g.erreurReseau) h += '<p class="sc-note" role="alert" data-objf-reseau="1">Connexion perdue pendant l\'envoi. Votre sélection est conservée.</p>';
    if (g.resultats && g.resultats.length) h += '<ul class="pt-objf-resultats" data-objf-resultats="1">' + g.resultats.map(function (r) { return '<li data-ok="' + (r.ok ? '1' : '0') + '">' + esc(r.libelle + ' : ' + r.message) + '</li>'; }).join('') + '</ul>';
    if (g.echecs && g.echecs.length && !occupe) h += '<button type="button" class="detail-btn" data-objf-reessayer="1">Réessayer les échecs (' + g.echecs.length + ')</button>';
    h += '<p class="sc-msg sc-note pt-obj-msg" role="status" data-objf-bilan="1">' + esc(g.bilan || '') + '</p>';
    return h + '</section>';
  }
  // Un appel par élément, dans l'ordre ; un échec n'arrête pas les suivants. items : [{ libelle, id | famille, cible }].
  async function envoyerGroupe(client, site, mode, items, onProgres) {
    var resultats = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], r;
      if (typeof onProgres === 'function') { try { onProgres(i, items.length); } catch (e) { /* affichage seul */ } }
      try {
        r = mode === 'valider' ? await client.rpc('valider_marge_cible', { p_proposition: it.id })
          : await client.rpc('proposer_marge_cible', { p_site: site, p_niveau: 'famille', p_cible_niveau: it.famille, p_cible: it.cible, p_commentaire: null });
        if (r && r.error) throw r.error;
        resultats.push({ libelle: it.libelle, ok: true, message: mode === 'valider' ? 'validée' : 'proposée' });
      } catch (e) { resultats.push({ libelle: it.libelle, ok: false, message: messageErreurObjectif(e), cle: mode === 'valider' ? it.id : it.famille }); }
    }
    if (typeof onProgres === 'function') { try { onProgres(items.length, items.length); } catch (e) { /* affichage seul */ } }
    return { resultats: resultats, bilan: bilanGroupe(mode, resultats) };
  }
  function bilanGroupe(mode, resultats) {
    var ok = resultats.filter(function (r) { return r.ok; }).length, ko = resultats.filter(function (r) { return !r.ok; });
    var fait = mode === 'valider' ? ['validé', 'validés'] : ['proposé', 'proposés'];
    var t = ok + ' ' + (ok > 1 ? fait[1] : fait[0]);
    if (ko.length) t += ', ' + ko.length + ' ' + (ko.length > 1 ? 'refusés' : 'refusé') + ' : ' + ko.map(function (r) { return r.libelle + ' (' + r.message + ')'; }).join(' ; ');
    return t + '.';
  }
  async function chargerObjectifs(client, site) {
    var lignes = [], droits = { proposer: false, valider: false };
    var props = [];
    var erreur = false, r;
    try { r = await client.from('v_tarif_seuils_actifs').select('*').eq('site', site); } catch (e) { r = { error: e }; }
    if (!r.error && r.data) lignes = r.data; else erreur = true;
    try { var pq = await client.from('marge_cible_propositions').select('id, niveau, cible_niveau, cible, commentaire, propose_par, propose_le, statut').eq('site', site).eq('statut', 'ouverte'); if (!pq.error && pq.data) props = pq.data; } catch (e) { props = []; }
    for (var k in droits) {
      try { var q = await client.rpc('objectif_habilite', { p_site: site, p_droit: k }); droits[k] = !q.error && q.data === true; } catch (e) { droits[k] = false; }
    }
    var libelles = {};
    try { var fq = await client.from('v_tarif_familles_actifs').select('famille_code, libelle').eq('site', site); if (!fq.error && fq.data) fq.data.forEach(function (f) { if (f.famille_code && f.libelle) libelles[f.famille_code] = f.libelle; }); } catch (e) { /* repli : le code */ }
    // Rayons exclus du périmètre pilotable : lignes actives du site (la RLS filtre déjà, le filtre de site reste explicite).
    var exclus = [];
    try { var eq = await client.from('tarif_perimetre_exclu').select('id, site, rayon_cle, motif').eq('site', site).is('annule_le', null); if (!eq.error && eq.data) exclus = eq.data; } catch (e) { exclus = []; }
    return { lignes: lignes, propositions: props, droits: droits, libelles: libelles, rayonsExclus: exclus, erreur: erreur };
  }
  function htmlFiche(l, etat) {
    var droits = etat ? peutVerifier(etat.role, etat.estCreateur) : false;
    return '<div class="pt-fond" data-fermer="1"></div><aside class="sc-fiche pt-fiche" role="dialog" aria-modal="true" aria-label="Fiche de ' + esc(l.article) + '" tabindex="-1" data-fiche-ouverte="' + esc(l.article) + '">' +
      '<div class="pt-fiche-tete"><div class="sc-nom">' + esc(l.article) + '</div><button type="button" class="detail-btn pt-fermer" data-fermer="1" aria-label="Fermer la fiche">Fermer</button></div>' +
      '<div class="pt-fiche-corps">' + ficheMarge(l) + htmlControlesAFaire(l, droits, etat) + htmlObjectifMarge(l, etat) + blocFiche(l) + '</div></aside>';
  }
  function htmlControle(c, icone) {
    var badgeG = c.nombre ? B.gravite(graviteBadge(c.gravite)) : B.gravite('conforme');
    var st = c.sousTotaux;
    var chiffres = st ? c.nombre + (c.nombre > 1 ? ' références' : ' référence') + ' · prix libres : ' + eur0(st.libres.montant) + ' (' + c.nature + ') ; prix réglementés et contractuels : aucune action de prix, ' + eur0(st.reglementes.montant) + ' (' + c.nature + ')'
      : c.nombre + (c.nombre > 1 ? ' références' : ' référence') + (c.montant !== null ? ' · ' + eur0(c.montant) + ' (' + c.nature + ')' : ' · ' + c.nature);
    return '<details class="sc-carte pt-ctrl" data-controle="' + c.code + '"><summary aria-label="Ouvrir le contrôle : ' + esc(c.titre) + '">' +
      (icone ? '<span class="sc-ico">' + icone(c.icone) + '</span>' : '') +
      '<span class="sc-carte-txt"><span class="sc-nom">' + esc(c.titre) + '</span><span class="vp-chiffres">' + esc(chiffres) + '</span>' +
      (c.nombre ? '<span class="pt-badges">' + badgeG + B.action(c.action, { clicable: false }) + '</span>' : '<span class="sc-note pt-aucun">Aucun cas sur la période</span>') + '</span><span class="sc-chev"></span></summary>' +
      (c.nombre ? '<ul class="vp-liste">' + c.lignes.slice(0, 5).map(htmlLigne).join('') + '</ul>' +
        '<button type="button" class="detail-btn" data-controle-liste="' + c.code + '">Voir dans la liste</button>' : '<p class="sc-note">Aucune référence concernée.</p>') +
      '<p class="sc-methode">' + esc(c.methode) + '</p></details>';
  }
  // ---------- Historique des vérifications (lecture des deux tables ; la RLS filtre par site) ----------
  var CYCLES_ACTIFS = ['nouvelle', 'persistante', 'aggravee'];
  var LIB_CYCLE = { nouvelle: 'Nouveau', persistante: 'Persistant', aggravee: 'Aggravé', verifiee: 'Vérifié', resolue: 'Résolu au nouvel import' };
  var FILTRES_HISTO = [['verifiee', 'Vérifiés'], ['persistante', 'Persistants'], ['aggravee', 'Aggravés'], ['resolue', 'Résolus'], ['tous', 'Tous']];
  async function chargerVerifications(client, site) {
    var v = await client.from('tarif_anomalies_verifications').select('id, article, code_barres, cause, empreinte, gravite, fichier_hash, date_releve, commentaire, saisi_par, saisi_le, cle').eq('site', site).is('annule_le', null).order('saisi_le', { ascending: false }).range(0, 4999);
    if (v.error) throw v.error;
    var r = await client.from('tarif_anomalies_reevaluations').select('verification_id, etat, fichier_hash, date_releve, saisi_le').eq('site', site).is('annule_le', null).order('saisi_le', { ascending: false }).range(0, 4999);
    if (r.error) throw r.error;
    var noms = {}, ids = {};
    (v.data || []).forEach(function (x) { if (x.saisi_par) ids[x.saisi_par] = 1; });
    try {
      var e = Object.keys(ids).length ? await client.from('employees').select('id, nom').in('id', Object.keys(ids)) : { data: [] };
      (e.data || []).forEach(function (x) { noms[x.id] = x.nom; });
    } catch (err) { /* nom non lisible : « un responsable » */ }
    var reeval = {};
    (r.data || []).forEach(function (x) { if (!reeval[x.verification_id]) reeval[x.verification_id] = x; });
    var lignes = (v.data || []).map(function (x) {
      return { id: x.id, code: x.cause, cle: x.cle, article: x.article, code_barres: x.code_barres || null, empreinte: x.empreinte, gravite: x.gravite, verifie_le: x.saisi_le,
        identiteDonnees: { fichierHash: x.fichier_hash, dateReleve: x.date_releve }, commentaire: x.commentaire || null,
        auteur: noms[x.saisi_par] || null, saisiPar: x.saisi_par || null, reevaluation: reeval[x.id] || null };
    });
    return { verifications: lignes };
  }
  function historiqueLignes(analyse, verifications, filtre) {
    var f = filtre || 'actifs', out = [];
    var derniere = function (code, cle) {
      return (verifications || []).filter(function (v) { return v.code === code && v.cle === cle; }).sort(function (a, b) { return String(b.verifie_le).localeCompare(String(a.verifie_le)); })[0] || null;
    };
    (analyse.lignes || []).forEach(function (l) {
      (l.anomalies || []).forEach(function (a) { out.push({ article: l.article, code: a.code, cle: a.cle, cycle: a.cycle || 'nouvelle', verif: derniere(a.code, a.cle), an: a }); });
      (l.anomaliesResolues || []).forEach(function (a) { out.push({ article: l.article, code: a.code, cle: a.cle, cycle: 'resolue', verif: derniere(a.code, a.cle) }); });
    });
    return out.filter(function (x) { return f === 'tous' ? true : f === 'actifs' ? CYCLES_ACTIFS.indexOf(x.cycle) >= 0 : x.cycle === f; });
  }
  // Droit d'annuler une ligne précise : le rôle, et pour un manager non créateur sa propre saisie quand l'identifiant de l'utilisateur est connu (la base reste l'arbitre).
  function peutAnnulerLigne(etat, v) {
    if (!v || !v.id || !etat || !peutAnnuler(etat.role, etat.estCreateur)) return false;
    if (!etat.estCreateur && etat.role === 'manager' && etat.userId && v.saisiPar && v.saisiPar !== etat.userId) return false;
    return true;
  }
  // Annulation directement sur la ligne de l'historique : bouton, puis zone de motif et message d'échec à côté de CETTE ligne.
  function htmlAnnulLigne(x, etat) {
    var v = x.verif;
    if (x.cycle !== 'verifiee' || !peutAnnulerLigne(etat, v)) return '';
    var r = '';
    if (etat.annulCible && etat.annulCible.id === v.id && etat.annulOuverte) {
      r = htmlZoneAnnulation(etat);
      if (etat.erreurAnnul) r += '<p class="sc-note pt-erreur" role="alert" data-annul-erreur="1">' + esc(etat.erreurAnnul) + '</p>';
    } else if (!etat.annulCible) {
      r = '<button type="button" class="pt-com-lien" data-histo-annuler="' + esc(v.id) + '" aria-label="Annuler la vérification de ' + esc(x.article) + '">Annuler</button>';
    }
    return r ? '<div class="pt-histo-annul" data-histo-annul-ligne="' + esc(v.id) + '">' + r + '</div>' : '';
  }
  function htmlDetailHistorique(x, etat) {
    var v = x.verif;
    if (!v) return '<p class="sc-note">Jamais vérifié.</p>';
    var re = v.reevaluation, LR = { persistante: 'persistante', aggravee: 'aggravée', resolue: 'résolue' };
    return '<p class="sc-note">Vérifié le ' + esc(jourFr(String(v.verifie_le).slice(0, 10))) + ' par ' + esc(v.auteur || 'un responsable') + '.' +
      (v.commentaire ? ' Commentaire : ' + esc(v.commentaire) : ' Aucun commentaire.') +
      (re ? ' Réévaluation : ' + esc(LR[re.etat] || re.etat) + ' au relevé du ' + esc(jourFr(String(re.date_releve || re.saisi_le).slice(0, 10))) + '.' : ' Pas encore réévalué.') +
      (etat && etat.reevalNonEnregistree && CYCLES_REEVAL[x.cycle] ? ' Réévaluation calculée : ' + esc(LR[x.cycle] || x.cycle) + ', non encore enregistrée.' : '') + '</p>';
  }
  // L5 : auteur, date, commentaire et import visibles sur la ligne elle-même (le (i) garde la réévaluation). Une vérification annulée n'est jamais chargée.
  function htmlLigneSuivi(x) {
    var v = x.verif;
    if (!v) return '<span class="pt-histo-suivi sc-note" data-histo-suivi="1">Jamais vérifié.</span>';
    var imp = v.identiteDonnees && v.identiteDonnees.dateReleve ? 'Import du ' + jourFr(String(v.identiteDonnees.dateReleve).slice(0, 10)) : 'Import non daté';
    return '<span class="pt-histo-suivi sc-note" data-histo-suivi="1">Vérifié le ' + esc(jourFr(String(v.verifie_le).slice(0, 10))) + ' par ' + esc(v.auteur || 'un responsable') +
      ' · ' + esc(imp) + ' · ' + (v.commentaire ? 'Commentaire : ' + esc(v.commentaire) : 'Aucun commentaire') + '</span>';
  }
  function htmlHistorique(etat) {
    if (!etat.historiqueDispo) return '';
    var AL = A_LIB(), f = etat.filtreHisto || 'verifiee';
    var L = historiqueLignes(etat.analyse, etat.verifications || [], f);
    var sel = '<label class="pt-f"><span class="sc-methode">Historique</span><select data-filtre-histo="1">' + FILTRES_HISTO.map(function (o) { return '<option value="' + o[0] + '"' + (f === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
    // Sections par cause (titre du lexique, jamais le code S1 à S7 dans le texte visible), tri par nombre de lignes décroissant.
    var parCause = {}, ordre = [];
    L.forEach(function (x) { if (!parCause[x.code]) { parCause[x.code] = []; ordre.push(x.code); } parCause[x.code].push(x); });
    ordre.sort(function (p, q) { return parCause[q].length - parCause[p].length || (p < q ? -1 : p > q ? 1 : 0); });
    var ouvertes = etat.histoOuvertes || (ordre.length ? [ordre[0]] : []), plus = etat.histoPlus || {};
    var sections = ordre.map(function (code) {
      var xs = parCause[code], titre = (AL.codes[code] || {}).titre || 'Cause non référencée', n = xs.length, tout = !!plus[code], vis = tout ? xs : xs.slice(0, 10);
      var li = vis.map(function (x) {
        var k = x.code + '|' + x.article, ouvert = etat.histoOuverte === k;
        return '<li class="vp-ligne pt-histo-li"><div class="pt-histo-t"><span class="pt-histo-txt"><strong>' + esc(x.article) + '</strong> · <span class="nbe-qualif" data-axe="cycle">' + esc(LIB_CYCLE[x.cycle] || x.cycle) + '</span>' + htmlLigneSuivi(x) + '</span>' +
          '<button type="button" class="detail-btn pt-histo-i" data-histo-info="' + esc(k) + '" aria-expanded="' + (ouvert ? 'true' : 'false') + '" aria-label="Détail de la vérification de ' + esc(x.article) + '">(i)</button></div>' + (ouvert ? htmlDetailHistorique(x, etat) : '') + htmlAnnulLigne(x, etat) + '</li>';
      }).join('');
      return '<details class="sc-carte pt-histo-sec" data-histo-sec="' + esc(code) + '"' + (ouvertes.indexOf(code) >= 0 ? ' open' : '') + '><summary aria-label="' + esc(titre) + ' : ' + n + (n > 1 ? ' lignes' : ' ligne') + '"><span class="sc-nom">' + esc(titre) + ' (' + n + ')</span><span class="sc-chev"></span></summary>' +
        '<ul class="vp-liste">' + li + '</ul>' + (n > 10 && !tout ? '<button type="button" class="detail-btn pt-histo-plus" data-histo-plus="' + esc(code) + '">Afficher la suite (' + (n - 10) + ')</button>' : '') + '</details>';
    }).join('');
    return '<div class="vp-bloc pt-historique" data-historique="1"><h3>Historique des vérifications</h3>' + sel +
      (sections || '<p class="sc-note">Aucune anomalie dans cette vue.</p>' + (f !== 'verifiee' ? '<button type="button" class="detail-btn pt-histo-reset" data-histo-reset="1">Changer de statut</button>' : '')) + '</div>';
  }

  function htmlCarteControles(a, s) {
    var actifs = tousControles(a).filter(function (x) { return CYCLES_ACTIFS.indexOf(x.a.cycle || 'nouvelle') >= 0; });
    var refs = {}; actifs.forEach(function (x) { refs[x.l.article] = true; });
    var n = actifs.length, m = Object.keys(refs).length;
    return '<button type="button" class="sc-ind sc-ambre pt-carte-ctl" data-carte="controles_a_effectuer" aria-label="Contrôles à effectuer : ' + n + ', ouvrir la liste"><span class="sc-ind-val">' + n + '</span><span class="sc-ind-lib">' + (n > 1 ? 'contrôles' : 'contrôle') + ' sur ' + m + (m > 1 ? ' références' : ' référence') + '</span><span class="sc-ind-sous">' + esc(libellePeriode(s.periode)) + ' · un contrôle n\'est pas une erreur constatée</span></button>';
  }
  // Câblage commun page et banc : ouverture du bloc des contrôles (carte, Conseiller) et du champ de commentaire. Aucune écriture.
  // Commentaire saisi pour CE contrôle : seul le champ dont l'article ET la cause sont ceux du bouton cliqué compte.
  // Aucun autre champ ouvert (autre contrôle, ancien rendu) ne peut fournir le texte. Page et banc.
  function commentaireDuControle(zone, article, code) {
    var champs = zone && zone.querySelectorAll ? zone.querySelectorAll('textarea.pt-verif-com') : [];
    for (var i = 0; i < champs.length; i++) {
      var d = champs[i].dataset || {};
      if (d.comArticle === String(article) && d.comCode === String(code)) return champs[i].value || '';
    }
    return '';
  }
  // Effet commun d'une vérification enregistrée : la ligne passe « vérifiée » (elle quitte la liste active), message daté. Page et banc.
  function effetVerificationEnregistree(an, etat, auteur, idVerif, extra) {
    var cycleAvant = an.cycle || 'nouvelle', cleAn = null;
    try { tousControles(etat.analyse).forEach(function (x) { if (x.a === an) cleAn = cleControle(x); }); } catch (e0) {}
    if (etat.ctlDetail) {
      // L3 : en détail plein écran, la ligne vérifiée quitte la vue ; on passe au contrôle suivant (sinon au précédent).
      try {
        var Lv = controlesFiltres(etat), iv = -1; Lv.forEach(function (x, i) { if (x.a === an) iv = i; });
        var vo = iv >= 0 ? (Lv[iv + 1] || Lv[iv - 1]) : null; if (vo) etat.ctlSel = cleControle(vo);
      } catch (e) {}
    }
    an.cycle = 'verifiee';
    // L5 : la vérification est aussi inscrite dans l'état en mémoire, pour que Suivre ne dise pas « Jamais vérifié ».
    if (idVerif && an) {
      var ex = extra || {}, ligneAn = null;
      try { tousControles(etat.analyse).forEach(function (x) { if (x.a === an) ligneAn = x.l; }); } catch (e1) {}
      if (!Array.isArray(etat.verifications)) etat.verifications = [];
      etat.verifications.push({ id: idVerif, code: an.code, cle: an.cle, article: ligneAn ? ligneAn.article : null,
        code_barres: ligneAn ? (ligneAn.code_barres || null) : null, empreinte: an.empreinte || null, gravite: an.gravite || null,
        verifie_le: ex.verifieLe || new Date().toISOString(), identiteDonnees: { fichierHash: (an.identiteDonnees || {}).fichierHash || ex.fichierHash || null, dateReleve: ex.dateReleve || (an.identiteDonnees || {}).dateReleve || null },
        commentaire: ex.commentaire || null, auteur: auteur || null, reevaluation: null });
    }
    var artMsg = null;
    try { tousControles(etat.analyse).forEach(function (x) { if (x.a === an) artMsg = x.l.article; }); } catch (e2) {}
    var comMsg = extra && extra.commentaire ? String(extra.commentaire) : '';
    etat.messageVerif = artMsg ? 'Vérification enregistrée pour ' + artMsg + (comMsg ? ' (commentaire : ' + comMsg + ')' : ' (sans commentaire)') + '. Contrôle suivant ouvert.' : MSG_VERIF_OK;
    etat.erreurEcriture = null; etat.messageAnnul = null; etat.erreurAnnul = null; etat.annulOuverte = false; etat.annulMotif = '';
    etat.derniereVerif = idVerif ? { an: an, id: idVerif, cle: cleAn, cycleAvant: cycleAvant } : null;
  }
  // Annulation tracée d'une vérification : la modification elle-même est faite par l'hôte (etat.surAnnulation), jamais par cet écran.
  // Retourne { ok: true } ou { ok: false, message }. Rien ne change dans l'état en cas de refus.
  async function annulerVerification(etat, motif) {
    var dv = etat.annulCible || etat.derniereVerif;
    if (!dv || !dv.id) return { ok: false, message: 'Aucune vérification récente à annuler.' };
    if (!motifAnnulationValide(motif)) return { ok: false, message: 'Indiquez un motif de 1 à ' + LIMITE_MOTIF + ' caractères.' };
    if (typeof etat.surAnnulation !== 'function') return { ok: false, message: messageErreurAnnulation(null) };
    var r;
    try { r = await etat.surAnnulation({ id: dv.id }, String(motif).trim()); } catch (e) { r = { ok: false, erreur: e }; }
    if (!r || !r.ok) return { ok: false, message: (r && r.message) || messageErreurAnnulation(r && r.erreur) };
    if (dv.an) dv.an.cycle = dv.cycleAvant; if (dv.cle) etat.ctlSel = dv.cle;
    if (Array.isArray(etat.verifications)) etat.verifications = etat.verifications.filter(function (v) { return v.id !== dv.id; });
    if (etat.derniereVerif && etat.derniereVerif.id === dv.id) { etat.derniereVerif = null; etat.messageVerif = null; }
    etat.annulCible = null; etat.annulOuverte = false; etat.annulMotif = ''; etat.erreurAnnul = null;
    etat.messageAnnul = MSG_ANNUL_OK;
    return { ok: true };
  }
  function lierOuvertures(corps, etat, rendre) {
    function ouvrirControles() {
      etat.ctlReplie = false; etat.axe = 'controler'; memoriserAxe('controler'); rendre();
      var bl = corps.querySelector('[data-bloc-controles]');
      if (bl) { if (bl.scrollIntoView) bl.scrollIntoView({ block: 'start' }); var sm = bl.querySelector('summary'); if (sm) sm.focus(); }
    }
    // L5 : « Commencer par » ouvre le premier contrôle du tri « Gravité décroissante » (filtres remis par défaut). Aucune écriture.
    function commencerPar(cible) {
      etat.ctlTri = 'gravite'; etat.ctlRecherche = ''; etat.ctlCycles = CYCLES_DEFAUT; etat.ctlCause = '';
      var L = controlesFiltres(etat), x = (cible && L.filter(function (y) { return cleControle(y) === cible; })[0]) || L[0] || null;
      ouvrirControles();
      if (x) { var cle = cleControle(x); if (etroit()) ouvrirDetail(cle); else choisirLigne(cle); }
    }
    // Axes : bascule sans rendu ni appel réseau, clavier complet (flèches, Début, Fin), dernier axe retenu.
    var onglets = Array.prototype.slice.call(corps.querySelectorAll('[data-axe-onglet]'));
    function choisirAxe(id, focus) {
      etat.axe = id; memoriserAxe(id);
      onglets.forEach(function (o) { var on = o.dataset.axeOnglet === id; o.classList.toggle('on', on); o.setAttribute('aria-selected', on ? 'true' : 'false'); o.setAttribute('tabindex', on ? '0' : '-1'); if (on && focus) o.focus(); });
      Array.prototype.forEach.call(corps.querySelectorAll('[data-axe-panneau]'), function (pn) { pn.hidden = pn.dataset.axePanneau !== id; });
    }
    onglets.forEach(function (o, i) {
      o.addEventListener('click', function () { choisirAxe(o.dataset.axeOnglet, false); });
      o.addEventListener('keydown', function (ev) {
        var n = onglets.length, k = ev.key, j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i + n - 1) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
        if (j < 0) return; ev.preventDefault(); choisirAxe(onglets[j].dataset.axeOnglet, true);
      });
    });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-carte="controles_a_effectuer"], [data-bloc-conseil="controles"]'), function (b) { b.addEventListener('click', (b.dataset && b.dataset.commencer) ? function () { commencerPar(b.dataset.cible || null); } : ouvrirControles); });
    // Bloc des contrôles : (i), « Voir plus », tri, cycle, recherche. Câblage unique, page et banc.
    // L2 : choix d'une ligne (clic, Entrée) et flèches haut/bas ; le focus suit la ligne choisie après le rendu.
    var lignes = Array.prototype.slice.call(corps.querySelectorAll('[data-ctl-sel]'));
    function choisirLigne(cle) { etat.ctlSel = cle; rendre(); var n = corps.querySelector('[data-ctl-sel][aria-current]'); if (n && n.focus) n.focus(); }
    // L3 (écran étroit) : le détail passe en plein écran. Une entrée d'historique par ouverture (bouton Retour du navigateur),
    // position de défilement et ligne gardées dans l'état, focus rendu à la ligne. Aucun appel réseau, aucune écriture.
    var etroit = function () { return typeof matchMedia === 'function' && !matchMedia('(min-width:900px)').matches; };
    function ouvrirDetail(cle) {
      etat.ctlSel = cle; etat.ctlDetail = true; etat.ctlScroll = typeof window !== 'undefined' ? (window.pageYOffset || 0) : 0;
      try { if (!etat.ctlHist && window.history && history.pushState) { history.pushState({ ptDetail: 1 }, ''); etat.ctlHist = true; } } catch (e) {}
      rendre(); if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
      var r = corps.querySelector('[data-ctl-retour]'); if (r && r.focus) r.focus();
    }
    function fermerDetailDirect() {
      if (!etat.ctlDetail) return;
      etat.ctlDetail = false; etat.ctlHist = false; rendre();
      if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, etat.ctlScroll || 0);
      var n = corps.querySelector('[data-ctl-sel][aria-current]'); if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    }
    function demanderRetour() {
      if (!etat.ctlDetail) return;
      if (etat.ctlHist) { try { history.back(); return; } catch (e) {} }
      fermerDetailDirect();
    }
    function suivant() {
      var ls = Array.prototype.slice.call(corps.querySelectorAll('[data-ctl-sel]')), i = -1;
      ls.forEach(function (b, k) { if (b.getAttribute('aria-current') === 'true') i = k; });
      if (i < 0 || i >= ls.length - 1) return;
      etat.ctlSel = ls[i + 1].dataset.ctlSel; rendre(); if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
      var b = corps.querySelector('[data-ctl-suivant]'); if (b && b.focus) b.focus();
    }
    function precedent() {
      var ls = Array.prototype.slice.call(corps.querySelectorAll('[data-ctl-sel]')), i = -1;
      ls.forEach(function (b, k) { if (b.getAttribute('aria-current') === 'true') i = k; });
      if (i <= 0) return;
      etat.ctlSel = ls[i - 1].dataset.ctlSel; rendre(); if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
    }
    // Écouteurs globaux liés une seule fois ; ils appellent toujours les dernières fermetures.
    etat.ctlRetourFn = demanderRetour; etat.ctlFermerDirect = fermerDetailDirect;
    if (!etat.ctlGlobaux && typeof window !== 'undefined' && window.addEventListener) {
      etat.ctlGlobaux = true;
      window.addEventListener('popstate', function () { if (etat.ctlDetail && etat.ctlFermerDirect) etat.ctlFermerDirect(); });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && etat.ctlDetail && etroit() && etat.ctlRetourFn) { ev.preventDefault(); etat.ctlRetourFn(); } });
    }
    Array.prototype.forEach.call(corps.querySelectorAll('[data-histo-annuler]'), function (b) {
      b.addEventListener('click', function () { var lg = null; historiqueLignes(etat.analyse, etat.verifications || [], 'tous').forEach(function (x) { if (x.verif && x.verif.id === b.dataset.histoAnnuler) lg = x; }); etat.annulCible = { id: b.dataset.histoAnnuler, an: lg ? lg.an : null, cle: lg ? lg.cle : null, cycleAvant: 'nouvelle' }; etat.annulOuverte = true; etat.annulMotif = ''; etat.erreurAnnul = null; rendre(); var t = corps.querySelector('#ptAnnulMotif'); if (t && t.focus) t.focus(); });
    });
    var bAnn = corps.querySelector('[data-ctl-annuler]');
    if (bAnn) bAnn.addEventListener('click', function () { etat.annulOuverte = true; etat.erreurAnnul = null; rendre(); var t = corps.querySelector('#ptAnnulMotif'); if (t && t.focus) t.focus(); });
    var tAnn = corps.querySelector('[data-annul-motif]');
    if (tAnn) tAnn.addEventListener('input', function () { etat.annulMotif = tAnn.value; var c = corps.querySelector('[data-annul-compteur]'); if (c) c.textContent = tAnn.value.length + ' / ' + LIMITE_MOTIF; });
    var bGarde = corps.querySelector('[data-annul-garder]');
    if (bGarde) bGarde.addEventListener('click', function () { etat.annulOuverte = false; etat.annulCible = null; etat.erreurAnnul = null; rendre(); });
    var bConf = corps.querySelector('[data-annul-confirmer]');
    if (bConf) bConf.addEventListener('click', async function () {
      bConf.disabled = true;
      var r = await annulerVerification(etat, tAnn ? tAnn.value : etat.annulMotif);
      if (!r.ok) etat.erreurAnnul = r.message;
      rendre();
    });
    var bRetour = corps.querySelector('[data-ctl-retour]'); if (bRetour) bRetour.addEventListener('click', demanderRetour);
    var bSuiv = corps.querySelector('[data-ctl-suivant]'); if (bSuiv) bSuiv.addEventListener('click', suivant);
    var bPrec = corps.querySelector('[data-ctl-prec]'); if (bPrec) bPrec.addEventListener('click', precedent);
    var bSf = corps.querySelector('[data-ctl-suiv-fl]'); if (bSf) bSf.addEventListener('click', suivant);
    lignes.forEach(function (b, i) {
      b.addEventListener('click', function () { if (etroit()) ouvrirDetail(b.dataset.ctlSel); else choisirLigne(b.dataset.ctlSel); });
      b.addEventListener('keydown', function (ev) {
        var k = ev.key, j = k === 'ArrowDown' ? i + 1 : k === 'ArrowUp' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? lignes.length - 1 : -1;
        if (j < 0 || j >= lignes.length) return; ev.preventDefault(); choisirLigne(lignes[j].dataset.ctlSel);
      });
    });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-ctl-cause]'), function (b) {
      b.addEventListener('click', function () { etat.ctlCause = b.dataset.ctlCause || ''; etat.ctlToutes = false; etat.ctlSel = null; rendre(); var n = corps.querySelector('[data-ctl-cause="' + (etat.ctlCause || '') + '"]'); if (n) n.focus(); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var P = Array.prototype.slice.call(corps.querySelectorAll('[data-ctl-cause]')), i = P.indexOf(b), j = (i + (e.key === 'ArrowRight' ? 1 : P.length - 1)) % P.length;
        e.preventDefault(); P[j].focus();
      });
    });
    var ctlPlus = corps.querySelector('[data-ctl-plus]'); if (ctlPlus) ctlPlus.addEventListener('click', function () { etat.ctlToutes = true; rendre(); });
    var ctlFb = corps.querySelector('[data-ctl-filtres]'); if (ctlFb) ctlFb.addEventListener('click', function () { etat.ctlFiltresOuverts = !etat.ctlFiltresOuverts; rendre(); var nb = corps.querySelector('[data-ctl-filtres]'); if (nb) nb.focus(); });
    var ctlTri = corps.querySelector('[data-ctl-tri]'); if (ctlTri) ctlTri.addEventListener('change', function () { etat.ctlTri = ctlTri.value; etat.ctlToutes = false; rendre(); });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-ctl-cycle]'), function (c) { c.addEventListener('change', function () { var cy = (etat.ctlCycles || ['nouvelle', 'persistante', 'aggravee']).filter(function (x) { return x !== c.dataset.ctlCycle; }); if (c.checked) cy.push(c.dataset.ctlCycle); etat.ctlCycles = cy; etat.ctlToutes = false; rendre(); }); });
    var ctlRech = corps.querySelector('#ptCtlRecherche'); if (ctlRech) ctlRech.addEventListener('input', function () { etat.ctlRecherche = ctlRech.value; etat.ctlToutes = false; var p = ctlRech.selectionStart; rendre(); var n = corps.querySelector('#ptCtlRecherche'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} } });
    var pf = corps.querySelector('[data-filtres-panneau]');
    if (pf) {
      if (etat.filtresOuverts === undefined && typeof matchMedia === 'function' && matchMedia('(min-width:900px)').matches) { etat.filtresOuverts = true; pf.open = true; }
      pf.addEventListener('toggle', function () { etat.filtresOuverts = pf.open; });
    }
    Array.prototype.forEach.call(corps.querySelectorAll('[data-histo-sec]'), function (d) {
      d.addEventListener('toggle', function () {
        var cur = etat.histoOuvertes || Array.prototype.filter.call(corps.querySelectorAll('[data-histo-sec]'), function (x) { return x !== d && x.open; }).map(function (x) { return x.dataset.histoSec; });
        cur = cur.filter(function (c) { return c !== d.dataset.histoSec; });
        if (d.open) cur.push(d.dataset.histoSec);
        etat.histoOuvertes = cur;
      });
    });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-histo-reset]'), function (b) {
      b.addEventListener('click', function () { etat.filtreHisto = 'verifiee'; etat.histoOuverte = null; etat.histoOuvertes = null; rendre(); });
    });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-histo-plus]'), function (b) {
      b.addEventListener('click', function () { etat.histoPlus = Object.assign({}, etat.histoPlus || {}); etat.histoPlus[b.dataset.histoPlus] = true; rendre(); });
    });
    Array.prototype.forEach.call(corps.querySelectorAll('[data-com-ouvrir]'), function (b) {
      b.addEventListener('click', function () {
        etat.comOuvert = (etat.comOuvert || []).concat([b.dataset.comOuvrir]); rendre();
        var t = Array.prototype.filter.call(corps.querySelectorAll('textarea.pt-verif-com'), function (x) { return x.dataset.comCode + '|' + x.dataset.comArticle === b.dataset.comOuvrir; })[0];
        if (t) t.focus();
      });
    });
  }
  // Filtres actifs du panneau (la recherche et l'alerte du Conseiller restent visibles, hors compte).
  function nbFiltres(f) { return ['famille', 'rayon', 'statut', 'fiabilite', 'exception'].filter(function (k) { return !!f[k]; }).length; }
  // ---------- Quatre axes : Contrôler, Analyser, Décider, Suivre. Affichage seul, aucun compteur écrit en dur. ----------
  var AXES = [{ id: 'controler', nom: 'Contrôler' }, { id: 'analyser', nom: 'Analyser' }, { id: 'decider', nom: 'Décider' }, { id: 'suivre', nom: 'Suivre' }];
  var NOTE_PISTES = 'Aucun seuil n\'est encore validé : aucune de ces pistes n\'est une décision tarifaire et aucune n\'est appliquée.';
  var CLE_AXE = 'nexus_scanner_axe';
  function axeValide(id) { return AXES.some(function (x) { return x.id === id; }); }
  function lireAxeMemorise() { try { var v = window.localStorage.getItem(CLE_AXE); return axeValide(v) ? v : null; } catch (e) { return null; } }
  function memoriserAxe(id) { try { window.localStorage.setItem(CLE_AXE, id); } catch (e) { /* stockage indisponible : l'axe reste en mémoire */ } }
  function axeCourant(etat) { if (etat.axe && axeValide(etat.axe)) return etat.axe; var m = lireAxeMemorise(); return m || 'controler'; }
  // Compteurs calculés depuis les données de l'analyse, jamais saisis.
  function compteursAxes(a, etat) {
    var actifs = tousControles(a).filter(function (x) { return CYCLES_ACTIFS.indexOf(x.a.cycle || 'nouvelle') >= 0; }).length;
    var fa = familles(a), piste = 0;
    fa.forEach(function (f) { if (f.id === 'decisions') f.cartes.forEach(function (c) { if (c.code === 'A1') piste += c.nombre || 0; }); });
    var verifies = etat.historiqueDispo ? historiqueLignes(a, etat.verifications || [], 'verifiee').length : 0;
    return {
      controler: { valeur: String(actifs), lib: 'à examiner' },
      analyser: { valeur: carteMarge(a).valeur, lib: 'marges estimées' },
      decider: { valeur: String(piste), lib: piste > 1 ? 'pistes indicatives' : 'piste indicative' },
      suivre: { valeur: etat.historiqueDispo ? String(verifies) : '-', lib: 'vérifiés sur cet import' }
    };
  }
  function htmlPage(etat) {
    // etat : { analyse, role, filtres, incoherences, ouverte, toutes, site, icone }
    var a = etat.analyse, f = etat.filtres || {}, s = a.synthese;
    var lignes = trier(filtrer(a.lignes, f)), toutes = lignes.length, visibles = etat.toutes ? lignes : lignes.slice(0, 10);
    var vf = valeursFiltres(a.lignes);
    var opts = function (liste, sel, lib) { return '<option value="">Tous</option>' + liste.map(function (v) { return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(lib ? lib[v] || v : v) + '</option>'; }).join(''); };
    var lab = function (t, k, o) { return '<label class="pt-f"><span class="sc-methode">' + t + '</span><select data-filtre="' + k + '">' + o + '</select></label>'; };
    var h = '<div class="sc-entete">' + (etat.icone ? '<span class="sc-entete-ico">' + etat.icone('entete') + '</span>' : '') +
      '<div><h2 class="sc-h">Scanner tarifaire</h2><div class="sc-methode">' + esc((etat.site ? etat.site + ' · ' : '') + libellePeriode(s.periode) + ' · ' + s.references + ' références analysées') + '</div></div></div>';
    // Visible quel que soit l'axe ouvert : sans relevé de stock, S2, S4 et S5 ne sont pas constatés, le manager doit le savoir dès Contrôler.
    if (s.stockFourni === false) h += '<p class="sc-note pt-stock-absent" data-stock-absent="1"><b>Relevé de stock</b> : non fourni. Le coût des références n\'est pas comparé au PA net HT du stock.</p>';
    var c = conseiller(a, etat.role);
    h += '<div class="carte conseiller sc-conseiller"><img class="conseiller-avatar" src="assets/avatar/nexus-avatar-128.png" srcset="assets/avatar/nexus-avatar-64.png 64w, assets/avatar/nexus-avatar-96.png 96w, assets/avatar/nexus-avatar-128.png 128w, assets/avatar/nexus-avatar-256.png 256w" sizes="80px" alt="Conseiller NEXUS">' +
      '<div class="conseiller-corps sc-conseil-ligne"><p class="sc-conseil' + (c.art ? ' sc-conseil-2l' : '') + '"><strong class="conseiller-titre">Conseiller NEXUS</strong> ' + (c.art ? '<span class="sc-conseil-art">' + esc(c.art) + '</span> <span class="sc-conseil-sous">' + esc(c.sous || '') + '</span>' : esc(c.texte)) + (c.detail ? ' <details class="sc-conseil-plus"><summary class="info-btn pt-info" aria-label="Pourquoi ce conseil">i</summary><span class="sc-methode" data-conseil-detail="1">' + esc(c.detail) + '</span></details>' : '') + '</p>' +
      (c.filtre ? '<button type="button" class="detail-btn" data-conseil="1">Voir dans la liste</button>' : c.bloc ? '<button type="button" class="detail-btn" data-conseil="1" data-bloc-conseil="controles" data-commencer="1"' + (c.cible ? ' data-cible="' + esc(c.cible) + '"' : '') + '>Commencer par</button>' : '') + '</div></div>';
    var cs = cartes(a), couleur = { marge_negative: 'sc-rouge', propositions: 'sc-info', a_verifier: 'sc-ambre', non_constates: 'sc-gris' };
    var carte = function (id) {
      var c = cs.filter(function (x) { return x.id === id; })[0];
      return c ? '<div class="sc-ind ' + couleur[c.id] + '" data-carte="' + c.id + '"><span class="sc-ind-val">' + esc(c.valeur) + '</span><span class="sc-ind-lib">' + esc(c.titre) + '</span><span class="sc-ind-sous">' + esc(c.secondaire) + '</span></div>' : '';
    };
    var cm = carteMarge(a), sc = scenarios(a);
    var fam = {}; familles(a).forEach(function (fa) { fam[fa.id] = fa; });
    var htmlFamille = function (id) {
      var fa = fam[id]; if (!fa) return '';
      return '<section class="vp-bloc pt-famille" data-famille="' + fa.id + '"><h3 class="nbe-groupe-titre">' + esc(fa.titre) + '</h3>' +
        (fa.id === 'exceptions' ? '<p class="sc-note">Décisions du gérant : elles ne sont pas des anomalies.</p>' : '') +
        '<div class="sc-cartes">' + fa.cartes.map(function (x) { return htmlControle(x, etat.icone); }).join('') + '</div>' + (fa.id === 'decisions' && etat.margePlus ? etat.margePlus : '') + '</section>';
    };
    // Panneau Contrôler : ce qu'il reste à examiner.
    var pC = htmlBlocControles(etat, '<div class="sc-inds pt-inds">' + carte('marge_negative') + carte('a_verifier') + '</div>');
    if (etat.messageReeval) pC += '<p class="sc-note pt-reeval-msg" role="status" data-reeval-msg="1">' + esc(etat.messageReeval) + '</p>';
    if (etat.role !== 'manager' && etat.incoherences && etat.incoherences.length) pC += '<div class="pt-integrite sc-note" role="alert">Incohérence dans les registres tarifaires : ' + plur(etat.incoherences.length, 'ligne', 'lignes') + ' à corriger.</div>';
    pC += htmlFamille('pertes');
    // Panneau Analyser : comprendre les chiffres et les références.
    var pA = htmlObjectifsFamilles(etat) + '<div class="sc-inds pt-inds"><div class="sc-ind sc-info" data-carte="marge_estimee"><span class="sc-ind-val">' + esc(cm.valeur) + '</span><span class="sc-ind-lib">' + esc(cm.titre) + ' : ' + esc(cm.unite) + '</span><span class="sc-ind-sous">' + esc(cm.secondaire) + '</span></div><p class="sc-note">' + esc(cm.limite) + '</p></div>';
    pA += htmlFamille('fiabilite');
    pA += '<div class="vp-bloc sc-tout"><h3>Toutes les références</h3><div class="vp-filtres"><label class="pt-f pt-f-rech"><span class="sc-methode">Recherche</span><input type="search" id="ptRecherche" placeholder="Nom ou code-barres" value="' + esc(f.recherche || '') + '"></label>' +
      '<details class="pt-filtres" data-filtres-panneau="1"' + (etat.filtresOuverts ? ' open' : '') + '><summary><span class="sc-nom">Filtres (' + nbFiltres(f) + ')</span><span class="sc-chev"></span></summary><div class="pt-filtres-corps">' +
      lab('Famille', 'famille', opts(vf.famille, f.famille)) + lab('Rayon', 'rayon', opts(vf.rayon, f.rayon)) +
      lab('Statut', 'statut', opts(Object.keys(LIB_STATUT), f.statut, LIB_STATUT)) +
      lab('Fiabilité', 'fiabilite', opts(Object.keys(LIB_FIABILITE), f.fiabilite, LIB_FIABILITE)) +
      lab('Exception', 'exception', '<option value="">Toutes</option><option value="avec"' + (f.exception === 'avec' ? ' selected' : '') + '>Avec exception</option><option value="sans"' + (f.exception === 'sans' ? ' selected' : '') + '>Sans exception</option>') +
      '</div></details>' +
      (f.alerte ? '<button type="button" class="detail-btn" data-effacer="alerte">Alerte ' + esc(f.alerte) + ' ×</button>' : '') + '</div>';
    pA += '<ul class="vp-liste">' + visibles.map(htmlLigne).join('') + '</ul>';
    if (!toutes) pA += '<div class="empty-panel">Aucune référence ne correspond à ces filtres.</div>';
    if (toutes > visibles.length) pA += '<button type="button" class="detail-btn vp-plus" data-plus="1">Voir les ' + (toutes - visibles.length) + ' autres références</button>';
    pA += '</div>';
    var pr = preuves(a);
    if (pr.length) pA += '<details class="sc-carte pt-preuves"><summary><span class="sc-nom">Preuves techniques (' + pr.length + ')</span><span class="sc-chev"></span></summary>' + pr.map(function (p) { return '<div class="sc-methode">' + esc(p.article) + ' : ' + esc(p.mention) + (p.raisons.length ? ' (' + esc(p.raisons.join(', ')) + ')' : '') + '</div>'; }).join('') + '</details>';
    pA += '<details class="sc-carte pt-sources"><summary><span class="sc-nom">Sources et limites</span><span class="sc-chev"></span></summary>' + cs.map(function (x) {
      return '<p class="sc-methode"><b>' + esc(x.titre) + '</b> : ' + esc(x.unite) + '. ' + esc(x.periode) + '. ' + esc(x.source) + ' ' + esc(x.limite) + '</p>';
    }).join('') + '</details>';
    // Panneau Décider : pistes indicatives, jamais une décision tarifaire.
    var pD = '<p class="sc-note pt-pistes" data-pistes="1"><b>Pistes indicatives</b>. ' + esc(NOTE_PISTES) + '</p>';
    pD += '<div class="sc-inds pt-inds">' + carte('propositions') + carte('non_constates') + '</div>';
    pD += '<details class="sc-carte pt-scenarios"><summary><span class="sc-nom">Scénarios de gain</span><span class="sc-chev"></span></summary><p class="sc-note">' + sc.map(function (x) { return esc(x.libelle) + ' : ' + esc(eur0(x.fiable)); }).join(' · ') + ' (scénarios alternatifs, jamais additionnés).</p></details>';
    if (a.lignes.length && a.lignes.every(function (l) { return !l.regle; })) pD += '<p class="sc-note">Aucun seuil validé : toutes les références restent sans seuil validé.</p>';
    pD += htmlFamille('decisions') + htmlFamille('exceptions');
    // Panneau Suivre : historique des vérifications.
    var pS = htmlHistorique(etat) || '<p class="sc-note">L\'historique des vérifications n\'est pas disponible.</p>';
    var ax = axeCourant(etat), cpt = compteursAxes(a, etat), panneaux = { controler: pC, analyser: pA, decider: pD, suivre: pS };
    h += '<div class="pt-axes" role="tablist" aria-label="Axes du Scanner" data-axes="1">' + AXES.map(function (x) {
      var on = x.id === ax;
      return '<button type="button" role="tab" class="pt-axe' + (on ? ' on' : '') + '" id="ptAxe_' + x.id + '" data-axe-onglet="' + x.id + '" aria-selected="' + (on ? 'true' : 'false') + '" aria-controls="ptPan_' + x.id + '" tabindex="' + (on ? '0' : '-1') + '">' +
        '<span class="pt-axe-nom">' + x.nom + '</span><span class="pt-axe-n">' + esc(cpt[x.id].valeur) + '</span><span class="pt-axe-l">' + esc(cpt[x.id].lib) + '</span></button>';
    }).join('') + '</div>';
    h += AXES.map(function (x) {
      return '<div class="pt-axe-pan" role="tabpanel" id="ptPan_' + x.id + '" data-axe-panneau="' + x.id + '" aria-labelledby="ptAxe_' + x.id + '"' + (x.id === ax ? '' : ' hidden') + '>' + panneaux[x.id] + '</div>';
    }).join('');
    if (etat.ouverte) { var l = a.lignes.filter(function (x) { return x.article === etat.ouverte; })[0]; if (l) h += htmlFiche(l, etat); }
    return h;
  }

  var CSS = '.vue-p1c .pt-obj{margin:10px 0}.vue-p1c .pt-obj-form{display:flex;flex-direction:column;gap:6px;margin:8px 0}.vue-p1c .pt-obj-form input[type=text]{width:100%;box-sizing:border-box;min-height:44px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:0 10px}.vue-p1c .pt-obj-champ{position:relative;display:block}.vue-p1c .pt-obj-champ input{padding-right:32px}.vue-p1c .pt-obj-pct{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--t-mid);pointer-events:none}.vue-p1c .pt-obj-btn{width:100%;min-height:44px;margin-top:4px}@media (min-width:900px){.vue-p1c .pt-obj-btn{width:auto;align-self:flex-start}}' +
    '.vue-p1c .pt-axes{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}.vue-p1c .pt-axe{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:60px;padding:8px 10px;background:var(--t-panel);color:var(--t-text);border:1px solid var(--t-line);border-radius:14px;cursor:pointer;text-align:left;font:inherit}' +
    '.vue-p1c .pt-axe.on{border:1.5px solid var(--t-text);background:rgba(34,211,238,.12)}.vue-p1c .pt-axe:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c .pt-axe-nom{font-weight:600;font-size:14px}.vue-p1c .pt-axe-n{font-size:18px;font-weight:700}.vue-p1c .pt-axe-l{font-size:11px;color:var(--t-mid)}.vue-p1c .pt-axe-pan[hidden]{display:none}' +
    '@media (min-width:900px){.vue-p1c .pt-axes{grid-template-columns:repeat(4,1fr)}.vue-p1c .pt-axe{min-height:110px;padding:14px}}' +
    '.vue-p1c .pt-inds{grid-template-columns:repeat(2,1fr)}@media (min-width:900px){.vue-p1c .pt-inds{grid-template-columns:repeat(4,1fr)}}' +
    '.vue-p1c .pt-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.vue-p1c .pt-pol{margin:8px 0}.vue-p1c .pt-pol-l{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:2px 0}' +
    '.vue-p1c details.pt-filtres[open]>summary .sc-chev{transform:rotate(45deg)}.vue-p1c details.pt-histo-sec[open]>summary .sc-chev{transform:rotate(45deg)}.vue-p1c .pt-histo-sec>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.vue-p1c .pt-histo-reset{margin:6px 0}.vue-p1c .pt-histo-plus{margin:6px 0}.vue-p1c .pt-ctrl .vp-liste{margin:8px 0}.vue-p1c .pt-f{display:flex;flex-direction:column;gap:2px;min-width:0}.vue-p1c .pt-f select,.vue-p1c .pt-f input{min-height:44px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:0 8px}.vue-p1c .pt-f-rech{flex:1 1 100%}.vue-p1c .pt-f:not(.pt-f-rech){flex:1 1 140px}.vue-p1c .pt-scenarios{margin:8px 0}.vue-p1c .pt-aucun{margin:4px 0 0}.vue-p1c .sc-conseiller{margin:0 0 10px}.vue-p1c .pt-histo-t{display:flex;align-items:center;gap:6px}.vue-p1c .sc-conseil-ligne{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.vue-p1c .sc-conseil-ligne .sc-conseil{margin:0;flex:1 1 220px;max-width:100%}.sc-conseil-plus{display:inline}.sc-conseil-plus>summary{display:inline-flex;list-style:none;cursor:pointer}.sc-conseil-plus>summary::-webkit-details-marker{display:none}.sc-conseil-plus[open]>span{display:block}.sc-conseiller .sc-conseil{overflow-wrap:anywhere}@media(min-width:900px){.sc-conseiller .sc-conseil:not(:has(details[open])){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}.vue-p1c .sc-conseiller{padding-top:8px;padding-bottom:8px;align-items:center}.vue-p1c .sc-conseiller .conseiller-avatar{width:32px;height:32px}.vue-p1c .pt-histo-suivi{display:block;margin-top:2px}.vue-p1c .pt-histo-txt{flex:1;min-width:0}.vue-p1c .pt-li{display:flex;align-items:center;gap:6px}.vue-p1c .pt-li .vp-ligne-prod{flex:1;min-width:0}.vue-p1c .pt-li .pt-info{flex:none}.vue-p1c .pt-ctl{list-style:none;padding:10px 0;border-top:1px solid var(--t-line)}.vue-p1c .pt-ctl-2,.vue-p1c .pt-ctl-3{margin:4px 0}.vue-p1c .pt-ctl .pt-verifier{width:100%;min-height:44px;margin-top:8px}.vue-p1c .pt-ctl-titre{margin:0 0 8px}.vue-p1c .pt-controles-faire{margin:14px 0 10px}.vue-p1c .pt-bloc-controles{margin:10px 0}.vue-p1c .pt-ctl-outils{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}@media(min-width:900px){.vue-p1c .pt-ctl-outils{flex-wrap:nowrap;align-items:flex-end}.vue-p1c .pt-ctl-outils .pt-f-rech{flex:1 1 220px}.vue-p1c .pt-ctl-outils .pt-f:not(.pt-f-rech){flex:0 1 190px}.vue-p1c .pt-ctl-cycles{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;border:0;padding:0;margin:0}.vue-p1c .pt-ctl-cycles legend{float:left;padding:0 4px 0 0}.vue-p1c .pt-ctl-aide{order:9}}.vue-p1c .pt-ctl-aide>summary{list-style:none;cursor:pointer}.vue-p1c .pt-ctl-aide>summary::-webkit-details-marker{display:none}.vue-p1c .pt-ctl-cycles{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 12px}.vue-p1c .pt-carte-ctl{text-align:left;font:inherit;cursor:pointer;width:100%;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);min-height:44px}.vue-p1c .pt-com-lien{background:none;border:0;padding:0 2px;min-height:44px;font:inherit;font-size:13px;color:var(--accent,inherit);text-decoration:underline;cursor:pointer}.vue-p1c input[type=checkbox]{accent-color:var(--accent)}.vue-p1c .pt-chk{display:inline-flex;align-items:center;gap:6px;min-height:44px}.vue-p1c .pt-verif-champ{margin-top:8px}.vue-p1c .pt-verif-zone{display:flex;flex-direction:column;gap:4px}.vue-p1c .pt-verif-com{width:100%;box-sizing:border-box;min-height:64px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:8px;resize:vertical}.vue-p1c .pt-verif-n{align-self:flex-end}.vue-p1c .pt-fond{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:40}.vue-p1c .pt-fiche{position:fixed;z-index:41;background:var(--t-panel);overflow:auto;box-sizing:border-box;left:0;right:0;bottom:0;max-height:85vh;border-radius:16px 16px 0 0;padding:12px 16px 24px}@media (min-width:900px){.vue-p1c .pt-fiche{left:auto;top:0;bottom:0;right:0;width:420px;max-height:none;border-radius:0}}.vue-p1c .pt-fiche-tete{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.vue-p1c .pt-fermer{min-height:44px}.vue-p1c .pt-marge-l1{display:block;color:var(--t-text)}.vue-p1c .pt-marge-prin{color:var(--t-text);font-family:var(--t-mono);font-weight:700;font-size:17px}.vue-p1c .pt-marge-sec{display:block;color:var(--t-mid);font-family:var(--t-mono);font-size:12px}.vue-p1c .vp-filtres{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}.vue-p1c .pt-filtres{flex:1 1 100%}.vue-p1c .pt-filtres>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.vue-p1c .pt-filtres-corps{display:flex;flex-wrap:wrap;gap:8px}@media (min-width:900px){.vue-p1c .pt-filtres-corps{flex-wrap:wrap}.vue-p1c .pt-filtres-corps>.pt-f{flex:1 1 160px;min-width:0}}@media (max-width:599px){.vue-p1c .sc-conseiller .conseiller-avatar{width:48px;height:48px}.vue-p1c .sc-ind{padding:10px 12px}.vue-p1c .sc-ind-val{font-size:20px}}';
  CSS += '@media(max-width:599px){.sc-conseiller:has(.sc-conseil-2l){display:grid;grid-template-columns:32px minmax(0,1fr) auto;column-gap:8px;row-gap:6px;align-items:center}.sc-conseiller:has(.sc-conseil-2l) .conseiller-corps,.sc-conseiller:has(.sc-conseil-2l) .sc-conseil-2l{display:contents}.sc-conseiller:has(.sc-conseil-2l)>.conseiller-avatar{grid-area:1/1/2/2}.sc-conseiller:has(.sc-conseil-2l) .conseiller-titre{grid-area:1/2/2/4}.sc-conseil-2l .sc-conseil-art{grid-area:2/1/3/4;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.sc-conseil-2l .sc-conseil-sous{grid-area:3/1/4/4;display:block}.sc-conseiller:has(.sc-conseil-2l) .detail-btn{grid-area:4/1/5/3;justify-self:start}.sc-conseil-2l .sc-conseil-plus{grid-area:4/3/5/4;justify-self:end}.sc-conseil-2l .sc-conseil-plus[open]{grid-area:5/1/6/4;justify-self:stretch}}';
  CSS += '.vue-p1c .pt-pastille{display:inline-flex;align-items:center;gap:6px}.vue-p1c .pt-pastille .pt-picto{flex:0 0 auto;width:18px;height:18px;color:var(--t-mid)}.vue-p1c .pt-pastille[aria-pressed=true] .pt-picto{color:var(--t-accent,currentColor)}';
  CSS += '.vue-p1c .pt-pastilles{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.vue-p1c .pt-pastille{min-height:44px;padding:4px 12px;border:1px solid var(--t-line);border-radius:999px;background:transparent;color:var(--t-text);font:inherit;cursor:pointer}.vue-p1c .pt-pastille[aria-pressed=true]{border-color:var(--t-accent,currentColor);font-weight:600}.vue-p1c .pt-pastille-n{opacity:.8}.vue-p1c .pt-l-etat{font-size:.9em;opacity:.9}';
  CSS += '.vue-p1c .pt-ctl-filtres-btn{display:none;min-height:44px}.vue-p1c .pt-num{font-variant-numeric:tabular-nums}@media (max-width:899px){.vue-p1c .pt-ctl-filtres-btn{display:inline-flex;align-items:center}.vue-p1c fieldset.pt-ctl-cycles.pt-ctl-cycles-ferme{display:none!important}.vue-p1c .pt-ctl-outils{display:flex;flex-wrap:wrap;gap:8px}.vue-p1c .pt-ctl-outils .pt-f-rech{flex:1 1 100%;min-width:0}.vue-p1c .pt-ctl-outils .pt-f:not(.pt-f-rech){flex:1 1 100%;min-width:0}.vue-p1c .pt-ctl-outils .pt-f select{width:100%;min-width:0;box-sizing:border-box}.vue-p1c .pt-ctl-outils .pt-ctl-filtres-btn{order:8;flex:1 1 0;min-width:0;justify-content:center;min-height:44px;background:transparent;border:1px solid var(--t-bordure-forte,currentColor);border-radius:8px;font-weight:600;text-decoration:none;color:inherit}.vue-p1c .pt-ctl-outils .pt-ctl-aide{order:9;flex:0 0 auto;align-self:center}.vue-p1c .pt-ctl-outils .pt-f-rech input{width:100%;box-sizing:border-box}}';
  CSS += '.vue-p1c .pt-ctl-deux{display:block}.vue-p1c .pt-ctl-liste{list-style:none;margin:0;padding:0}.vue-p1c .pt-ctl-item{margin:0;border-top:1px solid var(--t-line)}.vue-p1c .pt-ctl-ligne{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:6px 10px;background:transparent;color:var(--t-text);border:0;border-left:3px solid transparent;text-align:left;font:inherit;cursor:pointer}.vue-p1c .pt-ctl-ligne>span{min-width:0;overflow-wrap:anywhere;white-space:normal}.vue-p1c .pt-ctl-ligne{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;row-gap:2px;align-items:center}.vue-p1c .pt-ctl-ligne>.pt-l-tag{flex-shrink:0;overflow:visible;text-overflow:clip;white-space:nowrap;min-width:max-content;justify-self:end}.vue-p1c .pt-ctl-ligne>.pt-l-sec{grid-column:1 / -1;font-size:.85em;opacity:.85}.vue-p1c .pt-ctl-ligne[aria-current=true]{background:var(--t-panel);border-left-color:var(--t-text)}.vue-p1c .pt-ctl-ligne:focus-visible,.vue-p1c details.pt-sources-calcul>summary:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c .pt-ctl-ligne:focus-visible{outline-offset:-2px}.vue-p1c .pt-detail{margin-top:12px;padding:12px;border:1px solid var(--t-line);border-radius:14px;background:var(--t-panel)}.vue-p1c .pt-detail .pt-ctl-prod{background:none;border:0;padding:0;margin:0;color:var(--t-text);font:inherit;font-weight:700;text-align:left;cursor:pointer;min-height:44px}.vue-p1c .pt-detail .pt-ctl-prod:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c details.pt-sources-calcul>summary{min-height:44px;display:flex;align-items:center;cursor:pointer}@media (max-width:899.98px){.vue-p1c .pt-ctl-deux[data-mode=liste]>.pt-ctl-droite{display:none}.vue-p1c .pt-ctl-deux[data-mode=detail]>.pt-ctl-gauche{display:none}.vue-p1c .pt-ctl-deux[data-mode=detail]>.pt-ctl-droite{position:fixed;top:0;right:0;bottom:0;left:0;z-index:50;overflow-y:auto;overflow-x:hidden;background:var(--t-panel);-webkit-overflow-scrolling:touch}.vue-p1c .pt-ctl-deux[data-mode=detail] .pt-detail{margin:0;min-height:100%;display:flex;flex-direction:column;border:0;border-radius:0;padding:12px 16px 0;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}.vue-p1c .pt-ctl-entete{display:flex;align-items:center;justify-content:space-between;gap:8px}.vue-p1c .pt-ctl-pos{white-space:nowrap;color:var(--t-text)}.vue-p1c .pt-ctl-retour,.vue-p1c .pt-ctl-suivant{min-height:44px;min-width:44px;margin:0 0 8px}.vue-p1c .pt-ctl-suivant[disabled]{opacity:.5}.vue-p1c .pt-actions{position:sticky;bottom:0;display:flex;gap:8px;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));margin-top:auto;background:var(--t-panel);border-top:1px solid var(--t-line)}.vue-p1c .pt-actions>button{flex:1 1 0;min-height:44px}.vue-p1c .pt-ctl-retour:focus-visible,.vue-p1c .pt-actions>button:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}}@media (min-width:900px){.vue-p1c .pt-ctl-retour{display:none}.vue-p1c .pt-actions{display:block}.vue-p1c .pt-ctl-deux{display:grid;grid-template-columns:46% 1fr;gap:16px;align-items:start}.vue-p1c .pt-ctl-ligne{min-height:52px;padding:4px 10px}.vue-p1c .pt-ctl-deux>.pt-ctl-droite{position:sticky;top:8px;align-self:start;max-height:calc(100vh - 16px);overflow-y:auto}.vue-p1c .pt-detail{margin-top:0}}';

  CSS += '.vue-p1c .pt-ctl-fil,.vue-p1c .pt-ctl-sous{margin:4px 0;color:var(--t-mid)}.vue-p1c .pt-ctl-outils{padding:8px;border:1px solid var(--t-line);border-radius:12px;background:var(--t-panel);align-items:flex-end}.vue-p1c .pt-pastille-n{font-weight:700;opacity:1}.vue-p1c .pt-l-vign{flex:0 0 40px;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center}.vue-p1c .pt-l-vign img{width:40px;height:40px;object-fit:contain}.vue-p1c .pt-ctl-ligne{grid-template-columns:40px minmax(0,1fr) auto auto}.vue-p1c .pt-l-corps{display:flex;flex-direction:column;gap:2px;min-width:0}.vue-p1c .pt-l-art{font-weight:600;overflow-wrap:anywhere;white-space:normal}.vue-p1c .pt-l-sec{font-size:.85em;color:var(--t-mid)}.vue-p1c .pt-l-chiffre{font-family:inherit;font-variant-numeric:tabular-nums;font-weight:700;padding:2px 8px;border:1px solid var(--t-line);border-radius:999px;white-space:nowrap}.vue-p1c .pt-l-gr-demontree{border-color:var(--nbe-critique,var(--t-text));color:var(--t-text)}.vue-p1c .pt-l-gr-averifier{border-color:var(--nbe-verifier,var(--t-text));color:var(--t-text)}.vue-p1c .pt-l-chev{color:var(--t-mid)}.vue-p1c .pt-detail .pt-ctl-suivant{background:transparent;color:var(--t-text);border:1px solid var(--t-line)}.vue-p1c .pt-detail .pt-actions .pt-ctl-suivant{width:100%}';
  CSS += '.vue-p1c .pt-ctl-ligne{grid-template-columns:40px minmax(0,1fr) auto;grid-template-rows:auto auto}.vue-p1c .pt-ctl-ligne>.pt-l-vign{grid-column:1;grid-row:1 / span 2;align-self:start}.vue-p1c .pt-ctl-ligne>.pt-l-corps{grid-column:2;grid-row:1}.vue-p1c .pt-ctl-ligne>.pt-l-chiffre{grid-column:2;grid-row:2;justify-self:start;white-space:normal;overflow-wrap:anywhere;font-size:.9em}.vue-p1c .pt-ctl-ligne>.pt-l-chev{grid-column:3;grid-row:1 / span 2;align-self:center}.vue-p1c .pt-pastille{white-space:normal;max-width:100%}';
  CSS += '.vue-p1c .pt-ctl .pt-verifier,.vue-p1c .pt-actions>.pt-verifier{width:100%;min-height:48px;background:var(--t-cyan);color:var(--t-bg);border:1px solid var(--t-cyan);border-radius:10px;font-weight:700;font-size:16px}' +
    '.vue-p1c .pt-actions{flex-direction:column}.vue-p1c .pt-actions>button{flex:0 0 auto;width:100%}' +
    '.vue-p1c details.pt-sources-calcul{border:1px solid var(--t-line);border-radius:10px;padding:0 12px;margin:8px 0}' +
    '.vue-p1c details.pt-sources-calcul>summary{list-style:none;justify-content:space-between;font-weight:600}.vue-p1c details.pt-sources-calcul>summary::-webkit-details-marker{display:none}' +
    '.vue-p1c details.pt-sources-calcul>summary::after{content:"\\25BE";transition:transform .15s}.vue-p1c details.pt-sources-calcul[open]>summary::after{transform:rotate(180deg)}' +
    '.vue-p1c .pt-ctl-nav{display:inline-flex;align-items:center;gap:4px}.vue-p1c .pt-ctl-fl{min-width:44px;min-height:44px;font-size:1.4em;border:1px solid var(--t-line)}.vue-p1c .pt-ctl-fl[disabled]{opacity:.4}' +
    '.vue-p1c .pt-vign-neutre{display:inline-block;width:40px;height:40px;border:1px solid var(--t-line);border-radius:10px;background:var(--t-raised)}' +
    '.vue-p1c .pt-l-chiffre{white-space:nowrap}';
  CSS += '.vue-p1c .pt-ctl-tete{margin:0 0 8px}.vue-p1c .pt-ctl-titre{margin:4px 0;font-size:1.25em;overflow-wrap:anywhere}.vue-p1c .pt-ctl-pilule{display:inline-block;margin-left:6px}.vue-p1c .pt-ind2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}.vue-p1c .pt-ind{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--t-line);border-radius:12px;min-width:0}.vue-p1c .pt-ind-ico{flex:0 0 40px;display:inline-flex}.vue-p1c .pt-ind-txt{display:flex;flex-direction:column;gap:2px;min-width:0}.vue-p1c .pt-ind-val{font-size:1.5em;font-weight:700;overflow-wrap:anywhere}';
  // A4-1f : carte « Objectifs de marge par famille » (classes .pt-objf-*, jetons --t-*).
  CSS += '.vue-p1c .pt-objf-st-valide{--objf-c:var(--nbe-conforme,var(--t-green))}';
  CSS += '.vue-p1c .pt-objf-st-indicatif{--objf-c:var(--nbe-info,var(--t-cyan))}';
  CSS += '.vue-p1c .pt-objf-st-etude{--objf-c:var(--nbe-verifier,var(--t-amber))}';
  CSS += '.vue-p1c .pt-objf-st-hypothese{--objf-c:var(--nbe-attente,var(--t-mid))}';
  CSS += '.vue-p1c .pt-objf-st-non_defini{--objf-c:var(--t-line)}';
  CSS += '.vue-p1c .pt-objf-tete{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}';
  CSS += '.vue-p1c .pt-objf-icone{flex:0 0 auto;color:var(--t-cyan)}';
  CSS += '.vue-p1c .pt-objf-tete-txt{flex:1 1 240px;min-width:0}';
  CSS += '.vue-p1c .pt-objf-source{flex:0 1 auto;padding:4px 10px;border:1px solid var(--t-line);border-radius:999px}';
  CSS += '.vue-p1c .pt-objf-synthese{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}';
  CSS += '.vue-p1c .pt-objf-kpi{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--t-line);border-radius:12px;background:var(--t-panel);min-width:0}';
  CSS += '.vue-p1c .pt-objf-kpi-n{font-family:var(--t-mono);font-size:22px;font-weight:700;color:var(--t-text)}';
  CSS += '.vue-p1c .pt-objf-kpi-l{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-kpi-s{font-size:11px;color:var(--t-mid);overflow-wrap:anywhere}';
  CSS += '.vue-p1c .pt-objf-pt{display:inline-block;flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:var(--objf-c);box-sizing:border-box}';
  CSS += '.vue-p1c .pt-objf-st-hypothese .pt-objf-pt,.vue-p1c .pt-objf-st-non_defini .pt-objf-pt{background:transparent;border:2px dotted var(--objf-c)}';
  CSS += '.vue-p1c .pt-objf-st-non_defini .pt-objf-pt{border-color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-repart{grid-column:1 / -1;display:flex;height:8px;border-radius:999px;overflow:hidden;background:var(--t-raised);gap:2px}';
  CSS += '.vue-p1c .pt-objf-seg{display:block;min-width:4px;background:var(--objf-c)}';
  CSS += '.vue-p1c .pt-objf-seg.pt-objf-st-non_defini{background:var(--t-mid);opacity:.45}';
  CSS += '.vue-p1c .pt-objf-legende{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:6px 16px;margin:0;padding:0;list-style:none;font-size:12px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-legende li{display:flex;align-items:center;gap:6px}';
  CSS += '.vue-p1c .pt-objf-legende b{color:var(--t-text)}';
  CSS += '@media (min-width:900px){.vue-p1c .pt-objf-synthese{grid-template-columns:repeat(5,minmax(0,1fr))}}';
  CSS += '.vue-p1c .pt-objf-badge{display:inline-flex;align-items:center;padding:2px 10px;border-radius:999px;border:1px solid var(--objf-c);background:color-mix(in srgb,var(--objf-c) 14%,transparent);color:var(--t-text);font-size:12px;font-weight:600;white-space:nowrap}';
  CSS += '.vue-p1c .pt-objf-badge.pt-objf-st-hypothese,.vue-p1c .pt-objf-badge.pt-objf-st-non_defini{border-style:dotted;border-width:2px}';
  CSS += '.vue-p1c .pt-objf-badge.pt-objf-st-non_defini{border-color:var(--t-mid);color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-vigueur{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-cadenas{color:var(--objf-c)}';
  CSS += '.vue-p1c .pt-objf-outils{display:flex;flex-direction:column;gap:6px;margin:8px 0}';
  CSS += '.vue-p1c .pt-objf-outils input[type=search]{width:100%;box-sizing:border-box;min-height:44px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:0 10px}';
  CSS += '.vue-p1c .pt-objf-tri{margin:0}';
  CSS += '.vue-p1c .pt-objf-pilules{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:thin}';
  CSS += '.vue-p1c .pt-objf-pilule{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:4px 14px;border:1px solid var(--t-line);border-radius:999px;background:var(--t-panel);color:var(--t-text);font:inherit;cursor:pointer;white-space:nowrap}';
  CSS += '.vue-p1c .pt-objf-pilule[aria-pressed=true]{border-color:var(--t-cyan);background:var(--t-raised);font-weight:600}';
  CSS += '.vue-p1c .pt-objf-n{color:var(--t-mid);font-size:12px}';
  CSS += '.vue-p1c .pt-objf-pilule:focus-visible,.vue-p1c .pt-obj-familles input:focus-visible{outline:2px solid var(--t-cyan);outline-offset:2px}';
  CSS += '.vue-p1c .pt-objf-rapides{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}';
  CSS += '.vue-p1c .pt-objf-rapides .detail-btn{min-height:44px}';
  CSS += '.vue-p1c .pt-objf-corps{display:flex;flex-direction:column;gap:10px}';
  CSS += '.vue-p1c .pt-objf-tablewrap{overflow:auto;max-height:70vh;border:1px solid var(--t-line);border-radius:12px;background:var(--t-panel)}';
  CSS += '.vue-p1c .pt-objf-table{width:100%;border-collapse:separate;border-spacing:0;min-width:720px}';
  CSS += '.vue-p1c .pt-objf-table thead th{position:sticky;top:0;z-index:2;background:var(--t-raised);color:var(--t-mid);font-size:12px;font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid var(--t-line)}';
  CSS += '.vue-p1c .pt-objf-table tbody td{height:64px;padding:6px 10px;border-bottom:1px solid var(--t-line);vertical-align:middle;color:var(--t-text)}';
  CSS += '.vue-p1c .pt-objf-table tbody tr:last-child td{border-bottom:0}';
  CSS += '.vue-p1c .pt-objf-c-case{width:48px;text-align:center}';
  CSS += '.vue-p1c .pt-objf-c-n{white-space:nowrap}';
  CSS += '.vue-p1c .pt-obj-familles input[type=checkbox]{-webkit-appearance:none;appearance:none;position:relative;width:24px;height:24px;margin:0;border:2px solid var(--t-mid);border-radius:6px;background:transparent;cursor:pointer;vertical-align:middle}';
  CSS += '.vue-p1c .pt-obj-familles input[type=checkbox]:checked{background:var(--t-cyan);border-color:var(--t-cyan)}';
  CSS += '.vue-p1c .pt-obj-familles input[type=checkbox]:checked::after{content:"";position:absolute;left:6px;top:2px;width:6px;height:12px;border:solid var(--t-bg);border-width:0 2px 2px 0;transform:rotate(45deg)}';
  CSS += '.vue-p1c .pt-obj-familles input[type=checkbox][data-mixte]:not(:checked)::after{content:"";position:absolute;left:4px;top:9px;width:12px;height:2px;background:var(--t-cyan)}';
  CSS += '.vue-p1c .pt-obj-familles input[type=checkbox]:disabled{opacity:.4;cursor:not-allowed}';
  CSS += '.vue-p1c .pt-objf-fam{display:flex;align-items:center;gap:10px;min-width:0}';
  CSS += '.vue-p1c .pt-objf-fam .sc-note{display:block}';
  CSS += '.vue-p1c .pt-objf-fam .sc-lib{overflow-wrap:anywhere}';
  CSS += '.vue-p1c .pt-objf-echelle{display:flex;flex-direction:column;gap:4px;min-width:150px}';
  CSS += '.vue-p1c .pt-objf-rail{position:relative;display:block;height:8px;border-radius:999px;background:var(--t-raised)}';
  CSS += '.vue-p1c .pt-objf-zone{position:absolute;top:0;bottom:0;border-radius:999px;background:var(--objf-c);opacity:.35}';
  CSS += '.vue-p1c .pt-objf-rep{position:absolute;top:-3px;width:3px;height:14px;border-radius:2px;margin-left:-1px}';
  CSS += '.vue-p1c .pt-objf-plancher{background:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-cible{background:var(--objf-c)}';
  CSS += '.vue-p1c .pt-objf-st-non_defini .pt-objf-cible{background:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-bornes{display:flex;justify-content:space-between;font-size:11px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-liste{display:flex;flex-direction:column;gap:10px}';
  CSS += '.vue-p1c .pt-objf-carte{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--t-line);border-left:4px solid var(--objf-c);border-radius:12px;background:var(--t-panel)}';
  CSS += '.vue-p1c .pt-objf-carte-tete{display:flex;align-items:center;gap:10px;flex-wrap:wrap}';
  CSS += '.vue-p1c .pt-objf-carte-tete .pt-objf-fam{flex:1 1 160px}';
  CSS += '.vue-p1c .pt-objf-carte-case{display:inline-flex;min-width:24px}';
  CSS += '.vue-p1c .pt-objf-carte-chiffres{display:flex;gap:20px;font-size:13px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-carte-chiffres b{color:var(--t-text)}';
  CSS += '.vue-p1c .pt-objf-carte-prop{font-size:13px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-aide{border:1px solid var(--t-line);border-radius:12px;background:var(--t-panel);padding:8px 12px}';
  CSS += '.vue-p1c .pt-objf-aide .detail-btn{min-height:44px}';
  CSS += '.vue-p1c .pt-objf-aide-corps{font-size:13px;color:var(--t-mid)}';
  CSS += '.vue-p1c .pt-objf-aide-corps ol,.vue-p1c .pt-objf-aide-corps ul{margin:4px 0 10px;padding-left:18px}';
  CSS += '@media (min-width:900px){.vue-p1c .pt-objf-corps{flex-direction:row;align-items:flex-start}.vue-p1c .pt-objf-tablewrap{flex:1 1 auto;min-width:0}.vue-p1c .pt-objf-aide{flex:0 0 260px}}';
  CSS += '.vue-p1c .pt-objf-confirm{margin:10px 0;padding:12px;border:1px solid var(--t-cyan);border-radius:12px;background:var(--t-raised)}';
  CSS += '.vue-p1c .pt-objf-confirm ul{margin:6px 0;padding-left:18px}';
  CSS += '.vue-p1c .pt-objf-confirm li{margin:4px 0}';
  CSS += '.vue-p1c .pt-objf-groupe .sc-lib{display:flex;align-items:center;gap:6px;margin:8px 0 0}';
  CSS += '.vue-p1c .pt-objf-case{display:flex;gap:8px;align-items:center;min-height:44px}';
  CSS += '.vue-p1c .pt-objf-resultats{list-style:none;margin:8px 0;padding:0;font-size:13px}';
  CSS += '.vue-p1c .pt-objf-resultats li{padding:4px 0;border-bottom:1px solid var(--t-line)}';
  CSS += '.vue-p1c .pt-objf-resultats li[data-ok="0"]{color:var(--nbe-critique,var(--t-amber))}';
  CSS += '.vue-p1c .pt-objf-barre{position:sticky;top:0;z-index:3;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;margin:10px 0;border:1px solid var(--t-cyan);border-radius:12px;background:var(--t-raised)}';
  CSS += '.vue-p1c .pt-objf-barre-txt{flex:1 1 200px}';
  CSS += '.vue-p1c .pt-objf-detail-st{display:block}';
  CSS += '.vue-p1c .pt-objf-plancher-st{display:block;font-size:11px;font-weight:400;color:var(--t-mid)}';
  CSS += '@media (max-width:899px){.vue-p1c .pt-objf-barre{top:auto;bottom:0;padding-bottom:calc(10px + env(safe-area-inset-bottom))}}';
  CSS += '@media (max-width:899px){.vue-p1c .pt-objf-barre{flex-wrap:wrap}.vue-p1c .pt-objf-barre-txt{flex:1 1 100%}.vue-p1c .pt-objf-barre .detail-btn{flex:1 1 0;min-width:0;padding-left:8px;padding-right:8px}}';
  CSS += '.vue-p1c .pt-objf-barre .detail-btn{flex:0 1 auto;min-height:48px}';
  CSS += '.vue-p1c .pt-objf-squelette{display:flex;flex-direction:column;gap:8px;margin:10px 0}';
  CSS += '.vue-p1c .pt-objf-squelette span{display:block;height:64px;border-radius:12px;background:var(--t-raised);animation:pt-objf-pulse 1.4s ease-in-out infinite}';
  CSS += '@keyframes pt-objf-pulse{0%,100%{opacity:.5}50%{opacity:1}}';
  CSS += '@media (prefers-reduced-motion:reduce){.vue-p1c .pt-objf-squelette span{animation:none}}';
  // ---------- Montage : lecture seule, session de la personne connectée, clé publique, aucun paramètre de site ----------
  var VUES = { familles: 'v_tarif_familles_actifs', rattachements: 'v_tarif_rattachements_actifs', seuils: 'v_tarif_seuils_actifs', reglages: 'v_tarif_reglages_actifs',
    prixDecides: 'v_tarif_prix_decides_actifs', applications: 'v_tarif_prix_application_actifs', exceptions: 'v_tarif_exceptions_effectives',
    regimes: 'v_tarif_regimes_prix_actifs', controles: 'v_tarif_controles_reglementaires_actifs' };
  var COLONNES_PRODUCTS = 'categorie, article, ca, marge, prix_achat, prix_vente, tva, quantite, periode_debut, periode_fin, code_barres';

  function filtrerSite(reg, site) {
    var out = {};
    Object.keys(reg).forEach(function (k) { out[k] = (reg[k] || []).filter(function (r) { return !site || !r.site || r.site === site; }); });
    return out;
  }

  async function chargerRegistres(client) {
    var reg = {};
    var cles = Object.keys(VUES);
    var res = await Promise.all(cles.map(function (k) { return client.from(VUES[k]).select('*'); }));
    res.forEach(function (r, i) { if (r.error) throw r.error; reg[cles[i]] = r.data || []; });
    return reg;
  }
  async function chargerVentes(client, site) {
    var der = await client.from('products').select('periode_debut, periode_fin').eq('site', site).order('periode_fin', { ascending: false }).limit(1);
    if (der.error) throw der.error;
    if (!der.data || !der.data.length) return { courantes: [], precedentes: [], periode: null };
    var p = der.data[0];
    var lire = async function (debut, fin) {
      var r = await client.from('products').select(COLONNES_PRODUCTS).eq('site', site).eq('periode_debut', debut).eq('periode_fin', fin).range(0, 9999);
      if (r.error) throw r.error; return r.data || [];
    };
    var courantes = await lire(p.periode_debut, p.periode_fin);
    var prev = await client.from('products').select('periode_debut, periode_fin').eq('site', site).lt('periode_fin', p.periode_debut).order('periode_fin', { ascending: false }).limit(1);
    var precedentes = (!prev.error && prev.data && prev.data.length) ? await lire(prev.data[0].periode_debut, prev.data[0].periode_fin) : [];
    return { courantes: courantes, precedentes: precedentes, periode: { debut: p.periode_debut, fin: p.periode_fin } };
  }
  async function lireCompte(client, id) {
    try {
      var r = await client.from('employees').select('id, actif').eq('id', id).maybeSingle();
      if (r.error || !r.data) return { erreur: true };
      return { actif: r.data.actif };
    } catch (e) { return { erreur: true }; }
  }
  // ---------- Relevé de stock publié (option B du pilote) : lot import_batches stock_theorique publié le plus récent, lignes import_rows_raw.donnees ----------
  // Nombre lu dans un export : virgule décimale, espaces (y compris insécables), vide ou texte non numérique => null.
  function nombreReleve(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    return Number(t);
  }
  // Lot retenu : intention stock_theorique ET statut published, le plus récent (cree_le). Un lot brouillon est ignoré.
  function lotStockPublie(lots) {
    var L = (lots || []).filter(function (l) { return l && l.intention === 'stock_theorique' && l.statut === 'published'; });
    L.sort(function (a, b) { return String(b.cree_le || '') < String(a.cree_le || '') ? -1 : String(b.cree_le || '') > String(a.cree_le || '') ? 1 : 0; });
    return L[0] || null;
  }
  // Lignes du lot -> [{libelle, pa_net_ht, quantite}] ; quantite : null si Stock actuel vide ou non numérique.
  function lignesStockDepuisLot(rows) {
    return (rows || []).map(function (r) {
      var d = (r && r.donnees) || {};
      return { libelle: d['Libellé'], pa_net_ht: nombreReleve(d['PA net HT']), quantite: nombreReleve(d['Stock actuel']) };
    });
  }
  // Lecture seule (la RLS limite au gérant et au manager du site). Retour : { fourni:false } sans lot publié ou en cas d'erreur
  // (alors stockFourni=false, aucun faux contrôle) ; sinon { fourni:true, lignes, lot:{id, dateReleve, fichierHash} }.
  async function chargerStockPublie(client, site, taillePage) {
    var T = taillePage || 1000;
    try {
      var r1 = await client.from('import_batches').select('id, fichier_hash, date_releve, cree_le, intention, statut').eq('site', site).eq('intention', 'stock_theorique').eq('statut', 'published').order('cree_le', { ascending: false }).limit(1);
      if (r1.error) return { fourni: false, erreur: true };
      var lot = lotStockPublie(r1.data);
      if (!lot) return { fourni: false };
      var rows = [];
      for (var from = 0; ; from += T) {
        var r2 = await client.from('import_rows_raw').select('donnees').eq('batch_id', lot.id).order('numero_ligne', { ascending: true }).range(from, from + T - 1);
        if (r2.error) return { fourni: false, erreur: true };
        var d = r2.data || []; rows = rows.concat(d);
        if (d.length < T) break;
      }
      if (!rows.length) return { fourni: false };
      return { fourni: true, lignes: lignesStockDepuisLot(rows), lot: { id: lot.id, dateReleve: lot.date_releve ? String(lot.date_releve).slice(0, 10) : null, fichierHash: lot.fichier_hash || null } };
    } catch (e) { return { fourni: false, erreur: true }; }
  }
  var API = { htmlObjectifMarge: htmlObjectifMarge, htmlObjectifsFamilles: htmlObjectifsFamilles, libelleFamille: libelleFamille, eligiblesGroupe: eligiblesGroupe, selectionRapide: selectionRapide, indicateursFamilles: indicateursFamilles, compteFiltres: compteFiltres, bornesEchelle: bornesEchelle, cleStatut: cleStatut, enModeCartes: enModeCartes, filtrerDoublons: filtrerDoublons, lirePrefsFamilles: lirePrefsFamilles, ecrirePrefsFamilles: ecrirePrefsFamilles, filtreFamilles: filtreFamilles, libelleItemRecap: libelleItemRecap, lignesObjectifsFamilles: lignesObjectifsFamilles, envoyerGroupe: envoyerGroupe, bilanGroupe: bilanGroupe, objectifDe: objectifDe, niveauObjectif: niveauObjectif, pourcentVersFraction: pourcentVersFraction, messageErreurObjectif: messageErreurObjectif, chargerObjectifs: chargerObjectifs, estDemarque: estDemarque, lignesControle: lignesControle, nombreReleve: nombreReleve, lotStockPublie: lotStockPublie, lignesStockDepuisLot: lignesStockDepuisLot, chargerStockPublie: chargerStockPublie, TVA_CONFIRMATIONS_PILOTE: TVA_CONFIRMATIONS_PILOTE, cartes: cartes, scenarios: scenarios, alertesCartes: alertesCartes, trier: trier, filtrer: filtrer, valeursFiltres: valeursFiltres,
    preuves: preuves, conseiller: conseiller, lierOuvertures: lierOuvertures, effetVerificationEnregistree: effetVerificationEnregistree, commentaireDuControle: commentaireDuControle, annulerVerification: annulerVerification, peutAnnuler: peutAnnuler, motifAnnulationValide: motifAnnulationValide, messageErreurAnnulation: messageErreurAnnulation, fiche: fiche, etatAcces: etatAcces, peutVoirOnglet: peutVoirOnglet, filtrerSite: filtrerSite,
    regimeDe: regimeDe, contexteDeclaratif: contexteDeclaratif, construireContexteTarif: construireContexteTarif, stockParLibelle: stockParLibelle, controle: controle, familles: familles, avertissementRegime: avertissementRegime, infoRegime: infoRegime, badgeRegime: badgeRegime, badgeLigne: badgeLigne, blocFiche: blocFiche,
    chargerRegistres: chargerRegistres, chargerVerifications: chargerVerifications, historiqueLignes: historiqueLignes, htmlHistorique: htmlHistorique, chargerVentes: chargerVentes, lireCompte: lireCompte, libellePeriode: libellePeriode,
    reevaluationsAEcrire: reevaluationsAEcrire, enregistrerReevaluations: enregistrerReevaluations, htmlPage: htmlPage, htmlControlesAFaire: htmlControlesAFaire, htmlDetailHistorique: htmlDetailHistorique, htmlAnnulLigne: htmlAnnulLigne, peutAnnulerLigne: peutAnnulerLigne, htmlLigne: htmlLigne, htmlControle: htmlControle, htmlFiche: htmlFiche, carteMarge: carteMarge, AXES: AXES, NOTE_PISTES: NOTE_PISTES, axeCourant: axeCourant, compteursAxes: compteursAxes, htmlMarge: htmlMarge, ficheMarge: ficheMarge, peutVerifier: peutVerifier, commentaireValide: commentaireValide, messageApresEcriture: messageApresEcriture, messageErreurEcriture: messageErreurEcriture, payloadVerification: payloadVerification, LIMITE_COMMENTAIRE: LIMITE_COMMENTAIRE, graviteLigne: graviteLigne, CSS: CSS };
  global.NexusPolitiqueTarifaireEcran = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
