// Écran 1 « Politique tarifaire » (T3) : lecture seule.
// Toute la logique de calcul reste dans le moteur T2 (NexusPolitiqueTarifaire) ; cet écran ne recalcule rien,
// il agrège, trie, filtre et affiche ce que le moteur rend. Aucune écriture, nulle part.
(function (global) {
  'use strict';

  var T = global.NexusPolitiqueTarifaire || (typeof require === 'function' ? require('./nexus-politique-tarifaire.js') : null);
  var PM = global.NexusProduitsMesure || (typeof require === 'function' ? require('./nexus-produits-mesure.js') : null);
  var AR = global.NexusPolitiqueTarifaireRegistres || (typeof require === 'function' ? require('./nexus-politique-tarifaire-registres.js') : null);
  var V = global.NexusVocabTarif || (typeof require === 'function' ? require('./nexus-vocabulaire-tarif.js') : null);
  var CP = global.NexusComposantsPilotage || (typeof require === 'function' ? (function () { try { return require('./nexus-composants-pilotage.js'); } catch (e) { return null; } })() : null);
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
  var SRC_PILOTE = 'pilote, 18/11/2026';
  var HAITI = 'ha[iïí]ti';
  var TVA_CONFIRMATIONS_PILOTE = [
    { rayon: 'Cartes prépayées', motif: HAITI, taux_confirme: 0, source: SRC_PILOTE },
    { rayon: 'Cartes prépayées', motif: 'digicel|orange|sfr', taux_confirme: 8.5, source: SRC_PILOTE },
    { rayon: 'Cartes prépayées', taux_confirme: 0, source: SRC_PILOTE }
  ].concat(['Cigarettes', 'Cigares', 'Tabac à rouler - 30g', 'Gaz'].map(function (r) {
    return { rayon: r, taux_confirme: 0, source: SRC_PILOTE };
  }));
  // Ces confirmations valent pour le seul site du pilote, lu dans la session par l'appelant (S.site), jamais saisi librement.
  var SITE_PILOTE = 'vito-sainte-marie';
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
  function conseiller(analyse, role) {
    var c = Object.assign({}, analyse.synthese.alertes || {}), st = analyse.synthese.statuts || {};
    // Les références en démarque ne comptent ni dans les ventes à marge négative ni dans les sources qui se contredisent.
    var hors = sansDemarque(analyse.lignes);
    c.A3 = lignesAlerte(hors, 'A3').length; c.A5 = lignesAlerte(hors, 'A5').length;
    var gerant = role === 'gerant' || role === 'createur';
    var pas;
    if (c.A3) pas = { code: 'A3', filtre: { alerte: 'A3' }, quoi: plur(c.A3, 'référence vendue', 'références vendues') + ' à marge négative', pourquoi: 'chaque vente creuse la caisse tant que le prix ou le coût n\'est pas vérifié' };
    else if (controlesActifs(analyse) > 0) { var nc = controlesActifs(analyse); pas = { code: 'CTRL', filtre: null, bloc: 'controles', quoi: plur(nc, 'contrôle', 'contrôles') + ' à comparer avec Decenium', pourquoi: 'aucune vente n\'est à marge négative ; la liste des contrôles est le premier point à regarder. Un contrôle n\'est pas une erreur constatée' }; }
    else if (c.A8) pas = { code: 'A8', filtre: { alerte: 'A8' }, quoi: plur(c.A8, 'contrôle réglementaire ouvert', 'contrôles réglementaires ouverts'), pourquoi: 'ils bloquent toute proposition de prix sur ces références' };
    else if (st.proposition_a_valider) pas = { code: 'PROP', filtre: { statut: 'proposition_a_valider' }, quoi: plur(st.proposition_a_valider, 'proposition', 'propositions') + ' à valider', pourquoi: 'c\'est là que se trouve le gain le plus net' };
    else if (c.A5 || c.A4 || c.A7) pas = { code: 'VERIF', filtre: { statut: 'a_verifier' }, quoi: 'les références signalées à vérifier', pourquoi: 'des sources se contredisent ou une variation sort de l\'ordinaire' };
    else pas = null;
    if (!pas) return { code: 'RAS', texte: gerant ? 'Rien d\'urgent : aucune alerte forte sur cette période. Vous pouvez surveiller les prix décidés.' : 'Rien d\'urgent sur cette période.', filtre: null };
    var texte = gerant
      ? 'Je vous conseille de commencer par ' + pas.quoi + ' : ' + pas.pourquoi + '.'
      : 'Priorité du jour : ' + pas.quoi + '. Raison : ' + pas.pourquoi + '.';
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
    if (!m) return 'Marge ' + esc(pct(l.taux));
    if (m.etat === 'non_calculable' || m.taux === null || m.taux === undefined) return '<span class="pt-marge-l1">Marge estimée : ' + B.qualification('non-calculable') + '</span>';
    return '<span class="pt-marge-l1">Marge estimée : <span class="pt-mono pt-marge-prin">' + esc(pct(m.taux)) + '</span> ' + badgeMarge(l) + '</span>' +
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
    if (m.controle) h += li('Écart au relevé', 'PA net HT du relevé ' + eur(m.controle.paNetHtReleve) + ' (' + pct(m.controle.ecart) + ')');
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
      return 'Marge : ' + pct(v.taux);
    }
    if (c === 'S2') return 'Écart : ' + pct(v.ecart) + ' · PA net HT du relevé de stock : ' + eur(v.paNetHtReleve);
    if (c === 'S3') return 'Variation du coût : ' + pct(v.variationCout);
    if (c === 'S4') return 'Unités par colis : ' + (v.unites === undefined || v.unites === null ? 'n/d' : v.unites) + ' · rapport du relevé : ' + (num(v.rapportReleve) === null ? 'n/d' : v.rapportReleve) + ' · rapport du prix de vente : ' + (num(v.rapportPv) === null ? 'n/d' : v.rapportPv);
    if (c === 'S5') return 'Constats de correspondance : ' + (v.constats === undefined || v.constats === null ? 'n/d' : v.constats);
    if (c === 'S6') return 'Variation du prix de vente : ' + pct(v.variationPv);
    if (c === 'S7') return 'Taux de TVA : ' + (v.tva === undefined || v.tva === null ? 'n/d' : v.tva + ' %') + ' · état : ' + (v.etat === 'a_verifier' ? 'à confirmer' : esc(v.etat || 'n/d'));
    return '';
  }
  function htmlVerification(an, l, droits, etat, suivant) {
    var code = an.code, idc = 'ptc-' + String(l.article).replace(/[^A-Za-z0-9_-]/g, '_') + '-' + code;
    var fiable = !!(an.identiteDonnees || {}).fichierHash;
    if (!droits || an.cycle === 'verifiee') return '';
    if (!fiable) return '<p class="sc-note pt-verif-indispo" data-verif-indispo="1">Donnée non fiable : l\'import de référence est introuvable, la vérification n\'est pas possible.</p>';
    var cleC = code + '|' + l.article, comOuvert = !!(etat && etat.comOuvert && etat.comOuvert.indexOf(cleC) >= 0);
    var com = comOuvert
      ? '<div class="pt-verif-champ"><label class="sc-lib" for="' + idc + '">Commentaire (facultatif)</label>' +
        '<div class="pt-verif-zone"><textarea id="' + idc + '" class="pt-verif-com" rows="2" data-com-article="' + esc(l.article) + '" data-com-code="' + esc(code) + '" aria-describedby="' + idc + '-n"></textarea>' +
        '<span id="' + idc + '-n" class="sc-note pt-verif-n" data-com-compteur="1">0 / ' + LIMITE_COMMENTAIRE + '</span></div></div>'
      : '<button type="button" class="pt-com-lien" data-com-ouvrir="' + esc(cleC) + '">Ajouter un commentaire</button>';
    var bouton = '<button type="button" class="detail-btn pt-verifier" data-verifier="' + esc(code) + '" data-ver-article="' + esc(l.article) + '">✓ Marquer comme vérifié</button>';
    return suivant === undefined ? com + bouton : com + '<div class="pt-actions" data-ctl-actions="1">' + suivant + bouton + '</div>';
  }
  // L2 : pièces communes d'un contrôle. La consigne est toujours visible (plus de (i)) ; la source et le calcul sont dans un bloc natif replié.
  function pieceControle(an, l) {
    var AL = A_LIB(), code = an.code, cd = AL.codes[code] || {};
    var s1Contredit = code === 'S1' && (l.anomalies || []).some(function (x) { return x.code === 'S2'; });
    var niveauAff = s1Contredit ? 'a_verifier' : an.niveau;
    var cycle = AL.cycles[an.cycle] || '';
    return { AL: AL, code: code, cd: cd, s1Contredit: s1Contredit, niveau: LIB_NIVEAU[niveauAff] || '',
      statut: an.cycle === 'verifiee' ? 'Vérifié' : an.cycle === 'nouvelle' ? 'Nouveau' : cycle,
      chiffres: valeursAComparer(an, l) + (s1Contredit ? ' · coût de l\'export contredit par le relevé de stock' : '') };
  }
  function htmlCorpsControle(an, l, droits, etat, pc, suivant) {
    var AL = pc.AL, code = pc.code;
    var masque = (an.peutExpliquerAussi || []).length ? '<p class="sc-note">' + esc(AL.masque) + ' ' + esc(an.peutExpliquerAussi.map(function (c) { return (AL.codes[c] || {}).titre || c; }).join(', ')) + '</p>' : '';
    var marge = code === 'S1' && perteUnitaire(l) ? '<p class="sc-note" data-s1-pct="1">Marge : ' + esc(pct((an.valeurs || {}).taux)) + '</p>' : '';
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
  function htmlLigneCompacte(x, choisi) {
    var pc = pieceControle(x.a, x.l), cle = cleControle(x);
    return '<li class="pt-ctl-item" data-anomalie="' + esc(pc.code) + '"><button type="button" class="pt-ctl-ligne" data-ctl-ligne="1" data-ctl-sel="' + esc(cle) + '"' +
      (choisi ? ' aria-current="true" tabindex="0"' : ' tabindex="-1"') + '>' +
      '<span class="vp-nom pt-l-art">' + esc(x.l.article) + '</span><span class="pt-l-cause">' + esc(pc.cd.titre || pc.code) + '</span>' +
      '<span class="pt-l-chiffre">' + pc.chiffres + '</span><span class="nbe-qualif" data-axe="niveau">' + esc(pc.niveau) + '</span></button></li>';
  }
  function htmlDetailControle(x, droits, etat, nav) {
    var pc = pieceControle(x.a, x.l), n = nav || { restants: 0, suivant: false };
    var retour = '<button type="button" class="detail-btn pt-ctl-retour" data-ctl-retour="1">‹ Retour à la liste (' + n.restants + (n.restants > 1 ? ' restants' : ' restant') + ')</button>';
    var pos = n.total ? '<span class="pt-ctl-pos" data-ctl-pos="1">' + n.pos + ' / ' + n.total + '</span>' : '';
    var suiv = '<button type="button" class="detail-btn pt-ctl-suivant" data-ctl-suivant="1"' + (n.suivant ? '' : ' disabled') + '>Suivant</button>';
    return '<section class="pt-detail" data-ctl-detail="1" aria-label="Détail du contrôle"><div class="pt-ctl-entete">' + retour + pos + '</div><div class="pt-ctl-1"><button type="button" class="vp-ligne-prod pt-ctl-prod" data-article="' + esc(x.l.article) + '"><span class="vp-nom">' + esc(x.l.article) + '</span></button> ' +
      '<span class="sc-nom">' + esc(pc.cd.titre || pc.code) + '</span> <span class="nbe-qualif" data-axe="cycle">' + esc(pc.statut) + '</span></div>' +
      '<p class="pt-ctl-2 pt-ctl-chiffre" data-ctl-chiffre="1"><span class="pt-mono">' + pc.chiffres + '</span> <span class="nbe-qualif" data-axe="niveau">' + esc(pc.niveau) + '</span></p>' +
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
  function controlesFiltres(etat) {
    var cy = etat.ctlCycles || CYCLES_DEFAUT, q = String(etat.ctlRecherche || '').trim().toLowerCase();
    var L = tousControles(etat.analyse).filter(function (x) { return cy.indexOf(x.a.cycle || 'nouvelle') >= 0 && (!q || String(x.l.article).toLowerCase().indexOf(q) >= 0); });
    if ((etat.ctlTri || 'gravite') === 'produit') L.sort(function (x, y) { return String(x.l.article).localeCompare(String(y.l.article), 'fr'); });
    else L.sort(function (x, y) { return (y.a.gravite || 0) - (x.a.gravite || 0) || String(x.l.article).localeCompare(String(y.l.article), 'fr'); });
    return L;
  }
  function htmlBlocControles(etat) {
    var a = etat.analyse, droits = peutVerifier(etat.role, etat.estCreateur), tous = tousControles(a);
    var actifs = tous.filter(function (x) { return CYCLES_ACTIFS.indexOf(x.a.cycle || 'nouvelle') >= 0; });
    var AL = A_LIB(), S = a.synthese || {}, ouvert = etat.ctlReplie ? '' : ' open';
    var h = '<details class="vp-bloc sc-carte pt-bloc-controles" data-bloc-controles="1"' + ouvert + '><summary><span class="sc-nom">Contrôles à effectuer (' + actifs.length + ')</span><span class="sc-chev"></span></summary>';
    if (!tous.length) {
      var id = a.identiteDonnees || S.identiteDonnees || {};
      return h + '<p class="sc-note" data-ctl-vide="1">Aucune anomalie à vérifier sur cet import' + (id.dateReleve ? ' (relevé du ' + esc(jourFr(String(id.dateReleve).slice(0, 10))) + ')' : '') + (id.fichierHash ? ', empreinte ' + esc(String(id.fichierHash).slice(0, 8)) : '') + '.</p></details>';
    }
    if (etat.messageVerif) h += '<p class="sc-note pt-verif-msg" role="status" data-verif-ok="1">' + esc(etat.messageVerif) + '</p>';
    if (etat.erreurEcriture) h += '<p class="sc-note pt-erreur" role="alert" data-ctl-erreur="1">' + esc(etat.erreurEcriture) + '</p>';
    h += '<p class="sc-methode pt-ctl-expl" data-ctl-expl="1">' + esc(AL.explication || 'Un contrôle indique où comparer avec Decenium. Ce n\'est pas une erreur constatée : comparez les valeurs, puis marquez la ligne comme vérifiée.') + '</p>';
    if (!droits) h += '<p class="sc-note" data-ctl-lecture="1">Lecture seule : seuls le gérant et le manager marquent un contrôle comme vérifié.</p>';
    var L = controlesFiltres(etat);
    if (tous.length > SEUIL_OUTILS) {
      var cy = etat.ctlCycles || CYCLES_DEFAUT;
      h += '<div class="vp-filtres pt-ctl-outils"><label class="pt-f pt-f-rech"><span class="sc-methode">Recherche</span><input type="search" id="ptCtlRecherche" placeholder="Nom du produit" value="' + esc(etat.ctlRecherche || '') + '"></label>' +
        '<label class="pt-f"><span class="sc-methode">Tri</span><select data-ctl-tri="1">' + TRI_CTL.map(function (o) { return '<option value="' + o[0] + '"' + ((etat.ctlTri || 'gravite') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
        '<fieldset class="pt-ctl-cycles"><legend class="sc-methode">Historique</legend>' + ['nouvelle', 'persistante', 'aggravee', 'verifiee', 'resolue'].map(function (k) {
          return '<label class="pt-chk"><input type="checkbox" data-ctl-cycle="' + k + '"' + (cy.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(LIB_CYCLE[k]) + '</label>'; }).join('') + '</fieldset></div>';
    }
    var vis = etat.ctlToutes || tous.length <= SEUIL_OUTILS ? L : L.slice(0, SEUIL_OUTILS);
    // Sélection : le contrôle choisi, sinon le premier de la vue (la ligne vérifiée quitte la vue, la suivante prend la place).
    var sel = null; vis.forEach(function (x) { if (!sel && cleControle(x) === etat.ctlSel) sel = x; }); if (!sel) sel = vis[0] || null;
    var iSel = vis.indexOf(sel), nav = { restants: Math.max(0, L.length - 1), suivant: iSel >= 0 && iSel < vis.length - 1, pos: L.indexOf(sel) + 1, total: L.length };
    h += '<div class="pt-ctl-deux" data-mode="' + (sel && etat.ctlDetail ? 'detail' : 'liste') + '"><div class="pt-ctl-gauche"><ul class="vp-liste pt-ctl-liste" data-ctl-liste="1">' + vis.map(function (x) { return htmlLigneCompacte(x, x === sel); }).join('') + '</ul>';
    if (!L.length) h += '<p class="sc-note">Aucun contrôle ne correspond à ces filtres.</p>';
    if (L.length > vis.length) h += '<button type="button" class="detail-btn vp-plus" data-ctl-plus="1">Afficher la suite (' + (L.length - vis.length) + ')</button>';
    h += '</div>' + (sel ? '<div class="pt-ctl-droite">' + htmlDetailControle(sel, droits, etat, nav) + '</div>' : '') + '</div>';
    return h + '</details>';
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
    return "L'enregistrement a échoué. Rien n'a été modifié, vous pouvez réessayer.";
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
  function htmlFiche(l, etat) {
    var droits = etat ? peutVerifier(etat.role, etat.estCreateur) : false;
    return '<div class="pt-fond" data-fermer="1"></div><aside class="sc-fiche pt-fiche" role="dialog" aria-modal="true" aria-label="Fiche de ' + esc(l.article) + '" tabindex="-1" data-fiche-ouverte="' + esc(l.article) + '">' +
      '<div class="pt-fiche-tete"><div class="sc-nom">' + esc(l.article) + '</div><button type="button" class="detail-btn pt-fermer" data-fermer="1" aria-label="Fermer la fiche">Fermer</button></div>' +
      '<div class="pt-fiche-corps">' + ficheMarge(l) + htmlControlesAFaire(l, droits, etat) + blocFiche(l) + '</div></aside>';
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
  var FILTRES_HISTO = [['verifiee', 'Vérifiés'], ['persistante', 'Persistants'], ['aggravee', 'Aggravés'], ['resolue', 'Résolus au nouvel import'], ['tous', 'Tous']];
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
        auteur: noms[x.saisi_par] || null, reevaluation: reeval[x.id] || null };
    });
    return { verifications: lignes };
  }
  function historiqueLignes(analyse, verifications, filtre) {
    var f = filtre || 'actifs', out = [];
    var derniere = function (code, cle) {
      return (verifications || []).filter(function (v) { return v.code === code && v.cle === cle; }).sort(function (a, b) { return String(b.verifie_le).localeCompare(String(a.verifie_le)); })[0] || null;
    };
    (analyse.lignes || []).forEach(function (l) {
      (l.anomalies || []).forEach(function (a) { out.push({ article: l.article, code: a.code, cle: a.cle, cycle: a.cycle || 'nouvelle', verif: derniere(a.code, a.cle) }); });
      (l.anomaliesResolues || []).forEach(function (a) { out.push({ article: l.article, code: a.code, cle: a.cle, cycle: 'resolue', verif: derniere(a.code, a.cle) }); });
    });
    return out.filter(function (x) { return f === 'tous' ? true : f === 'actifs' ? CYCLES_ACTIFS.indexOf(x.cycle) >= 0 : x.cycle === f; });
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
        return '<li class="vp-ligne pt-histo-li"><div class="pt-histo-t"><span class="pt-histo-txt"><strong>' + esc(x.article) + '</strong> · <span class="nbe-qualif" data-axe="cycle">' + esc(LIB_CYCLE[x.cycle] || x.cycle) + '</span></span>' +
          '<button type="button" class="detail-btn pt-histo-i" data-histo-info="' + esc(k) + '" aria-expanded="' + (ouvert ? 'true' : 'false') + '" aria-label="Détail de la vérification de ' + esc(x.article) + '">(i)</button></div>' + (ouvert ? htmlDetailHistorique(x, etat) : '') + '</li>';
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
  // Effet commun d'une vérification enregistrée : la ligne passe « vérifiée » (elle quitte la liste active), message daté. Page et banc.
  function effetVerificationEnregistree(an, etat, auteur) {
    if (etat.ctlDetail) {
      // L3 : en détail plein écran, la ligne vérifiée quitte la vue ; on passe au contrôle suivant (sinon au précédent).
      try {
        var Lv = controlesFiltres(etat), iv = -1; Lv.forEach(function (x, i) { if (x.a === an) iv = i; });
        var vo = iv >= 0 ? (Lv[iv + 1] || Lv[iv - 1]) : null; if (vo) etat.ctlSel = cleControle(vo);
      } catch (e) {}
    }
    an.cycle = 'verifiee';
    etat.messageVerif = messageApresEcriture({ date: new Date().toISOString().slice(0, 10), auteur: auteur });
  }
  function lierOuvertures(corps, etat, rendre) {
    function ouvrirControles() {
      etat.ctlReplie = false; etat.axe = 'controler'; memoriserAxe('controler'); rendre();
      var bl = corps.querySelector('[data-bloc-controles]');
      if (bl) { if (bl.scrollIntoView) bl.scrollIntoView({ block: 'start' }); var sm = bl.querySelector('summary'); if (sm) sm.focus(); }
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
    Array.prototype.forEach.call(corps.querySelectorAll('[data-carte="controles_a_effectuer"], [data-bloc-conseil="controles"]'), function (b) { b.addEventListener('click', ouvrirControles); });
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
    // Écouteurs globaux liés une seule fois ; ils appellent toujours les dernières fermetures.
    etat.ctlRetourFn = demanderRetour; etat.ctlFermerDirect = fermerDetailDirect;
    if (!etat.ctlGlobaux && typeof window !== 'undefined' && window.addEventListener) {
      etat.ctlGlobaux = true;
      window.addEventListener('popstate', function () { if (etat.ctlDetail && etat.ctlFermerDirect) etat.ctlFermerDirect(); });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && etat.ctlDetail && etroit() && etat.ctlRetourFn) { ev.preventDefault(); etat.ctlRetourFn(); } });
    }
    var bRetour = corps.querySelector('[data-ctl-retour]'); if (bRetour) bRetour.addEventListener('click', demanderRetour);
    var bSuiv = corps.querySelector('[data-ctl-suivant]'); if (bSuiv) bSuiv.addEventListener('click', suivant);
    lignes.forEach(function (b, i) {
      b.addEventListener('click', function () { if (etroit()) ouvrirDetail(b.dataset.ctlSel); else choisirLigne(b.dataset.ctlSel); });
      b.addEventListener('keydown', function (ev) {
        var k = ev.key, j = k === 'ArrowDown' ? i + 1 : k === 'ArrowUp' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? lignes.length - 1 : -1;
        if (j < 0 || j >= lignes.length) return; ev.preventDefault(); choisirLigne(lignes[j].dataset.ctlSel);
      });
    });
    var ctlPlus = corps.querySelector('[data-ctl-plus]'); if (ctlPlus) ctlPlus.addEventListener('click', function () { etat.ctlToutes = true; rendre(); });
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
    var c = conseiller(a, etat.role);
    h += '<div class="carte conseiller sc-conseiller"><img class="conseiller-avatar" src="assets/avatar/nexus-avatar-128.png" srcset="assets/avatar/nexus-avatar-64.png 64w, assets/avatar/nexus-avatar-96.png 96w, assets/avatar/nexus-avatar-128.png 128w, assets/avatar/nexus-avatar-256.png 256w" sizes="80px" alt="Conseiller NEXUS">' +
      '<div class="conseiller-corps"><div class="conseiller-titre">Conseiller NEXUS</div><p class="sc-conseil">' + esc(c.texte) + '</p>' +
      (c.filtre ? '<button type="button" class="detail-btn" data-conseil="1">Voir dans la liste</button>' : c.bloc ? '<button type="button" class="detail-btn" data-conseil="1" data-bloc-conseil="controles">Voir les contrôles</button>' : '') + '</div></div>';
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
    var pC = '<div class="sc-inds pt-inds">' + carte('marge_negative') + carte('a_verifier') + htmlCarteControles(a, s) + '</div>';
    pC += htmlBlocControles(etat);
    if (etat.messageReeval) pC += '<p class="sc-note pt-reeval-msg" role="status" data-reeval-msg="1">' + esc(etat.messageReeval) + '</p>';
    if (etat.role !== 'manager' && etat.incoherences && etat.incoherences.length) pC += '<div class="pt-integrite sc-note" role="alert">Incohérence dans les registres tarifaires : ' + plur(etat.incoherences.length, 'ligne', 'lignes') + ' à corriger.</div>';
    pC += htmlFamille('pertes');
    // Panneau Analyser : comprendre les chiffres et les références.
    var pA = '<div class="sc-inds pt-inds"><div class="sc-ind sc-info" data-carte="marge_estimee"><span class="sc-ind-val">' + esc(cm.valeur) + '</span><span class="sc-ind-lib">' + esc(cm.titre) + ' : ' + esc(cm.unite) + '</span><span class="sc-ind-sous">' + esc(cm.secondaire) + '</span></div><p class="sc-note">' + esc(cm.limite) + '</p></div>';
    if (s.stockFourni === false) pA += '<p class="sc-note pt-stock-absent"><b>Relevé de stock</b> : non fourni. Le coût des références n\'est pas comparé au PA net HT du stock.</p>';
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

  var CSS = '.vue-p1c .pt-axes{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}.vue-p1c .pt-axe{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:60px;padding:8px 10px;background:var(--t-panel);color:var(--t-text);border:1px solid var(--t-line);border-radius:14px;cursor:pointer;text-align:left;font:inherit}' +
    '.vue-p1c .pt-axe.on{border:1.5px solid var(--t-text);background:rgba(34,211,238,.12)}.vue-p1c .pt-axe:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c .pt-axe-nom{font-weight:600;font-size:14px}.vue-p1c .pt-axe-n{font-size:18px;font-weight:700}.vue-p1c .pt-axe-l{font-size:11px;color:var(--t-mid)}.vue-p1c .pt-axe-pan[hidden]{display:none}' +
    '@media (min-width:900px){.vue-p1c .pt-axes{grid-template-columns:repeat(4,1fr)}.vue-p1c .pt-axe{min-height:110px;padding:14px}}' +
    '.vue-p1c .pt-inds{grid-template-columns:repeat(2,1fr)}@media (min-width:900px){.vue-p1c .pt-inds{grid-template-columns:repeat(4,1fr)}}' +
    '.vue-p1c .pt-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.vue-p1c .pt-pol{margin:8px 0}.vue-p1c .pt-pol-l{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:2px 0}' +
    '.vue-p1c details.pt-filtres[open]>summary .sc-chev{transform:rotate(45deg)}.vue-p1c details.pt-histo-sec[open]>summary .sc-chev{transform:rotate(45deg)}.vue-p1c .pt-histo-sec>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.vue-p1c .pt-histo-reset{margin:6px 0}.vue-p1c .pt-histo-plus{margin:6px 0}.vue-p1c .pt-ctrl .vp-liste{margin:8px 0}.vue-p1c .pt-f{display:flex;flex-direction:column;gap:2px;min-width:0}.vue-p1c .pt-f select,.vue-p1c .pt-f input{min-height:44px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:0 8px}.vue-p1c .pt-f-rech{flex:1 1 100%}.vue-p1c .pt-f:not(.pt-f-rech){flex:1 1 140px}.vue-p1c .pt-scenarios{margin:8px 0}.vue-p1c .pt-aucun{margin:4px 0 0}.vue-p1c .sc-conseiller{margin:0 0 10px}.vue-p1c .pt-histo-t{display:flex;align-items:center;gap:6px}.vue-p1c .pt-histo-txt{flex:1;min-width:0}.vue-p1c .pt-li{display:flex;align-items:center;gap:6px}.vue-p1c .pt-li .vp-ligne-prod{flex:1;min-width:0}.vue-p1c .pt-li .pt-info{flex:none}.vue-p1c .pt-ctl{list-style:none;padding:10px 0;border-top:1px solid var(--t-line)}.vue-p1c .pt-ctl-2,.vue-p1c .pt-ctl-3{margin:4px 0}.vue-p1c .pt-ctl .pt-verifier{width:100%;min-height:44px;margin-top:8px}.vue-p1c .pt-ctl-titre{margin:0 0 8px}.vue-p1c .pt-controles-faire{margin:14px 0 10px}.vue-p1c .pt-bloc-controles{margin:10px 0}.vue-p1c .pt-ctl-outils{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.vue-p1c .pt-ctl-cycles{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 12px}.vue-p1c .pt-carte-ctl{text-align:left;font:inherit;cursor:pointer;width:100%;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);min-height:44px}.vue-p1c .pt-com-lien{background:none;border:0;padding:0 2px;min-height:44px;font:inherit;font-size:13px;color:var(--accent,inherit);text-decoration:underline;cursor:pointer}.vue-p1c input[type=checkbox]{accent-color:var(--accent)}.vue-p1c .pt-chk{display:inline-flex;align-items:center;gap:6px;min-height:44px}.vue-p1c .pt-verif-champ{margin-top:8px}.vue-p1c .pt-verif-zone{display:flex;flex-direction:column;gap:4px}.vue-p1c .pt-verif-com{width:100%;box-sizing:border-box;min-height:64px;border-radius:8px;border:1px solid var(--t-line);background:var(--t-panel);color:var(--t-text);font:inherit;padding:8px;resize:vertical}.vue-p1c .pt-verif-n{align-self:flex-end}.vue-p1c .pt-fond{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:40}.vue-p1c .pt-fiche{position:fixed;z-index:41;background:var(--t-panel);overflow:auto;box-sizing:border-box;left:0;right:0;bottom:0;max-height:85vh;border-radius:16px 16px 0 0;padding:12px 16px 24px}@media (min-width:900px){.vue-p1c .pt-fiche{left:auto;top:0;bottom:0;right:0;width:420px;max-height:none;border-radius:0}}.vue-p1c .pt-fiche-tete{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.vue-p1c .pt-fermer{min-height:44px}.vue-p1c .pt-marge-l1{display:block;color:var(--t-text)}.vue-p1c .pt-marge-prin{color:var(--t-text);font-family:var(--t-mono);font-weight:700;font-size:17px}.vue-p1c .pt-marge-sec{display:block;color:var(--t-mid);font-family:var(--t-mono);font-size:12px}.vue-p1c .vp-filtres{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}.vue-p1c .pt-filtres{flex:1 1 100%}.vue-p1c .pt-filtres>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.vue-p1c .pt-filtres-corps{display:flex;flex-wrap:wrap;gap:8px}@media (min-width:900px){.vue-p1c .pt-filtres-corps{flex-wrap:wrap}.vue-p1c .pt-filtres-corps>.pt-f{flex:1 1 160px;min-width:0}}@media (max-width:599px){.vue-p1c .sc-conseiller .conseiller-avatar{width:48px;height:48px}.vue-p1c .sc-ind{padding:10px 12px}.vue-p1c .sc-ind-val{font-size:20px}}';
  CSS += '.vue-p1c .pt-ctl-deux{display:block}.vue-p1c .pt-ctl-liste{list-style:none;margin:0;padding:0}.vue-p1c .pt-ctl-item{margin:0;border-top:1px solid var(--t-line)}.vue-p1c .pt-ctl-ligne{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:6px 10px;background:transparent;color:var(--t-text);border:0;border-left:3px solid transparent;text-align:left;font:inherit;cursor:pointer}.vue-p1c .pt-ctl-ligne>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vue-p1c .pt-ctl-ligne[aria-current=true]{background:var(--t-panel);border-left-color:var(--t-text)}.vue-p1c .pt-ctl-ligne:focus-visible,.vue-p1c details.pt-sources-calcul>summary:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c .pt-ctl-ligne:focus-visible{outline-offset:-2px}.vue-p1c .pt-detail{margin-top:12px;padding:12px;border:1px solid var(--t-line);border-radius:14px;background:var(--t-panel)}.vue-p1c .pt-detail .pt-ctl-prod{background:none;border:0;padding:0;margin:0;color:var(--t-text);font:inherit;font-weight:700;text-align:left;cursor:pointer;min-height:44px}.vue-p1c .pt-detail .pt-ctl-prod:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}.vue-p1c details.pt-sources-calcul>summary{min-height:44px;display:flex;align-items:center;cursor:pointer}@media (max-width:899.98px){.vue-p1c .pt-ctl-deux[data-mode=liste]>.pt-ctl-droite{display:none}.vue-p1c .pt-ctl-deux[data-mode=detail]>.pt-ctl-gauche{display:none}.vue-p1c .pt-ctl-deux[data-mode=detail]>.pt-ctl-droite{position:fixed;top:0;right:0;bottom:0;left:0;z-index:50;overflow-y:auto;overflow-x:hidden;background:var(--t-panel);-webkit-overflow-scrolling:touch}.vue-p1c .pt-ctl-deux[data-mode=detail] .pt-detail{margin:0;min-height:100%;display:flex;flex-direction:column;border:0;border-radius:0;padding:12px 16px 0;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere}.vue-p1c .pt-ctl-entete{display:flex;align-items:center;justify-content:space-between;gap:8px}.vue-p1c .pt-ctl-pos{white-space:nowrap;color:var(--t-text)}.vue-p1c .pt-ctl-retour,.vue-p1c .pt-ctl-suivant{min-height:44px;min-width:44px;margin:0 0 8px}.vue-p1c .pt-ctl-suivant[disabled]{opacity:.5}.vue-p1c .pt-actions{position:sticky;bottom:0;display:flex;gap:8px;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));margin-top:auto;background:var(--t-panel);border-top:1px solid var(--t-line)}.vue-p1c .pt-actions>button{flex:1 1 0;min-height:44px}.vue-p1c .pt-ctl-retour:focus-visible,.vue-p1c .pt-actions>button:focus-visible{outline:2px solid var(--t-text);outline-offset:2px}}@media (min-width:900px){.vue-p1c .pt-ctl-retour,.vue-p1c .pt-ctl-suivant{display:none}.vue-p1c .pt-actions{display:block}.vue-p1c .pt-ctl-deux{display:grid;grid-template-columns:46% 1fr;gap:16px;align-items:start}.vue-p1c .pt-ctl-ligne{min-height:36px;padding:4px 10px}.vue-p1c .pt-ctl-deux>.pt-ctl-droite{position:sticky;top:8px;align-self:start;max-height:calc(100vh - 16px);overflow-y:auto}.vue-p1c .pt-detail{margin-top:0}}';

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
  var API = { estDemarque: estDemarque, lignesControle: lignesControle, nombreReleve: nombreReleve, lotStockPublie: lotStockPublie, lignesStockDepuisLot: lignesStockDepuisLot, chargerStockPublie: chargerStockPublie, TVA_CONFIRMATIONS_PILOTE: TVA_CONFIRMATIONS_PILOTE, cartes: cartes, scenarios: scenarios, alertesCartes: alertesCartes, trier: trier, filtrer: filtrer, valeursFiltres: valeursFiltres,
    preuves: preuves, conseiller: conseiller, lierOuvertures: lierOuvertures, effetVerificationEnregistree: effetVerificationEnregistree, fiche: fiche, etatAcces: etatAcces, peutVoirOnglet: peutVoirOnglet, filtrerSite: filtrerSite,
    regimeDe: regimeDe, contexteDeclaratif: contexteDeclaratif, construireContexteTarif: construireContexteTarif, stockParLibelle: stockParLibelle, controle: controle, familles: familles, avertissementRegime: avertissementRegime, infoRegime: infoRegime, badgeRegime: badgeRegime, badgeLigne: badgeLigne, blocFiche: blocFiche,
    chargerRegistres: chargerRegistres, chargerVerifications: chargerVerifications, historiqueLignes: historiqueLignes, htmlHistorique: htmlHistorique, chargerVentes: chargerVentes, lireCompte: lireCompte, libellePeriode: libellePeriode,
    reevaluationsAEcrire: reevaluationsAEcrire, enregistrerReevaluations: enregistrerReevaluations, htmlPage: htmlPage, htmlControlesAFaire: htmlControlesAFaire, htmlDetailHistorique: htmlDetailHistorique, htmlLigne: htmlLigne, htmlControle: htmlControle, htmlFiche: htmlFiche, carteMarge: carteMarge, AXES: AXES, NOTE_PISTES: NOTE_PISTES, axeCourant: axeCourant, compteursAxes: compteursAxes, htmlMarge: htmlMarge, ficheMarge: ficheMarge, peutVerifier: peutVerifier, commentaireValide: commentaireValide, messageApresEcriture: messageApresEcriture, messageErreurEcriture: messageErreurEcriture, payloadVerification: payloadVerification, LIMITE_COMMENTAIRE: LIMITE_COMMENTAIRE, graviteLigne: graviteLigne, CSS: CSS };
  global.NexusPolitiqueTarifaireEcran = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
