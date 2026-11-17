// Écran 1 « Politique tarifaire » (T3) : lecture seule.
// Toute la logique de calcul reste dans le moteur T2 (NexusPolitiqueTarifaire) ; cet écran ne recalcule rien,
// il agrège, trie, filtre et affiche ce que le moteur rend. Aucune écriture, nulle part.
(function (global) {
  'use strict';

  var T = global.NexusPolitiqueTarifaire || (typeof require === 'function' ? require('./nexus-politique-tarifaire.js') : null);
  var PM = global.NexusProduitsMesure || (typeof require === 'function' ? require('./nexus-produits-mesure.js') : null);
  var AR = global.NexusPolitiqueTarifaireRegistres || (typeof require === 'function' ? require('./nexus-politique-tarifaire-registres.js') : null);
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
      return fam && fam.exclue ? 'reglemente' : null;
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
    if (S.tvaExplications) base.tva = Object.assign({}, base.tva, { explications: S.tvaExplications });
    return AR.contexteDepuisRegistres(S.registres, base);
  }

  function alerteDe(l, code) { return (l.alertes || []).filter(function (a) { return a.code === code; })[0] || null; }
  function lignesAlerte(L, code) { return L.filter(function (l) { return !!alerteDe(l, code); }); }
  function montantAlerte(l, code) { var a = alerteDe(l, code); return a && a.consequence ? num(a.consequence.montant) : null; }

  // ---------- Quatre cartes de synthèse (fiche v2) ----------
  function cartes(analyse) {
    var s = analyse.synthese, g = analyse.gains, L = analyse.lignes;
    var per = libellePeriode(s.periode);
    var minimum = g.decisionnels.minimum;
    var a3 = lignesAlerte(L, 'A3'), nbPertes = 0, nbNulles = 0, sansJust = 0, pertes = 0;
    a3.forEach(function (l) {
      var m = montantAlerte(l, 'A3'), a = alerteDe(l, 'A3');
      if (m !== null && m > 0) { nbPertes++; pertes += m; } else nbNulles++;
      if (!(a.donnees && a.donnees.justification)) sansJust++;
    });
    var aVerifier = L.filter(function (l) {
      return l.fiabilite.niveau === 'insuffisante' || ETATS_REGL_OUVERTS.indexOf(l.conformite.etat) >= 0;
    });
    var nonConstates = L.filter(function (l) { return l.prixDecide && ETATS_PRIX_NON_CONSTATES.indexOf(l.prixDecide.etat) >= 0; }).length;
    var sansPrecedente = L.length > 0 && L.every(function (l) { return num(l.tauxPrecedent) === null; });
    return [
      { id: 'marge_negative', titre: 'Ventes à marge négative', valeur: String(a3.length), unite: 'références vendues à perte ou à marge nulle',
        secondaire: nbPertes + ' à perte (' + eur0(pertes) + '), ' + nbNulles + ' à marge nulle, dont ' + sansJust + ' sans justification',
        references: a3.length, periode: per, source: 'Ventes et coûts : dernier export Decenium ; justifications : registres.',
        limite: 'Pertes et marges nulles comptées à part. La perte est mesurée au volume observé, elle n\'est pas un gain manqué.' },
      { id: 'propositions', titre: 'Propositions à valider', valeur: eur0(minimum.fiable.montant), unite: '€ de gain, scénario minimum, références fiables',
        secondaire: eur0(minimum.a_confirmer.montant) + ' à confirmer', references: minimum.fiable.references, periode: per,
        source: 'Ventes et coûts : dernier export Decenium ; seuils : registres tarifaires.',
        limite: 'Gain théorique à volume constant, non cumulable avec le scénario cible. Les références à confirmer ne sont pas comptées dans le chiffre principal.' },
      { id: 'a_verifier', titre: 'Références à vérifier', valeur: String(aVerifier.length), unite: 'références',
        secondaire: 'fiabilité insuffisante ou contrôle réglementaire ouvert', references: aVerifier.length,
        periode: per, source: 'Moteur de politique tarifaire sur le dernier export Decenium et les registres.',
        limite: (sansPrecedente ? 'Sans période précédente : les variations de prix et de coût ne sont pas mesurées. ' : '') + 'Ces références restent hors des gains.' },
      { id: 'non_constates', titre: 'Prix décidés non constatés', valeur: String(nonConstates), unite: 'références',
        secondaire: 'prix décidé, pas encore vu en caisse', references: nonConstates,
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
    var table = T.ALERTES, comptes = analyse.synthese.alertes || {};
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
    return analyse.lignes.filter(function (l) { return l.fiabilite.niveau === 'insuffisante'; })
      .map(function (l) { return { article: l.article, raisons: l.fiabilite.raisons || [], mention: 'donnée à corriger' }; });
  }

  // ---------- Conseiller ----------
  function conseiller(analyse, role) {
    var c = analyse.synthese.alertes || {}, st = analyse.synthese.statuts || {};
    var gerant = role === 'gerant' || role === 'createur';
    var pas;
    if (c.A3) pas = { code: 'A3', filtre: { alerte: 'A3' }, quoi: c.A3 + ' référence(s) vendue(s) à marge négative', pourquoi: 'chaque vente creuse la caisse tant que le prix ou le coût n\'est pas vérifié' };
    else if (c.A8) pas = { code: 'A8', filtre: { alerte: 'A8' }, quoi: c.A8 + ' contrôle(s) réglementaire(s) ouvert(s)', pourquoi: 'ils bloquent toute proposition de prix sur ces références' };
    else if (st.proposition_a_valider) pas = { code: 'PROP', filtre: { statut: 'proposition_a_valider' }, quoi: st.proposition_a_valider + ' proposition(s) à valider', pourquoi: 'c\'est là que se trouve le gain le plus net' };
    else if (c.A5 || c.A4 || c.A7) pas = { code: 'VERIF', filtre: { statut: 'a_verifier' }, quoi: 'les références signalées à vérifier', pourquoi: 'des sources se contredisent ou une variation sort de l\'ordinaire' };
    else pas = null;
    if (!pas) return { code: 'RAS', texte: gerant ? 'Rien d\'urgent : aucune alerte forte sur cette période. Vous pouvez surveiller les prix décidés.' : 'Rien d\'urgent sur cette période.', filtre: null };
    var texte = gerant
      ? 'Je vous conseille de commencer par ' + pas.quoi + ' : ' + pas.pourquoi + '.'
      : 'Priorité du jour : ' + pas.quoi + '. Raison : ' + pas.pourquoi + '.';
    return { code: pas.code, texte: texte, filtre: pas.filtre };
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
    if (code === 'FI') return L.filter(function (l) { return l.fiabilite.niveau === 'insuffisante'; });
    if (code === 'EX') return L.filter(function (l) { return l.statut === 'a_surveiller' && l.exception; });
    var r = lignesAlerte(L, code);
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
  // Un seul état par ligne : le statut T2 de la référence. « À vérifier » seulement si le statut l'est ou si A4 ou A5 est levée.
  function badgeLigne(l) {
    var codes = (l.alertes || []).map(function (a) { return a.code; });
    if (l.statut === 'a_verifier' || codes.indexOf('A4') >= 0 || codes.indexOf('A5') >= 0) return B.gravite('a-verifier');
    var lib = LIB_STATUT[l.statut] || l.statut;
    if (l.statut === 'conforme') return B.gravite('conforme', { libelle: lib });
    return B.gravite('information', { libelle: lib });
  }

  // ---------- Rendu ----------
  function htmlLigne(l) {
    return '<li><button type="button" class="vp-ligne-prod" data-article="' + esc(l.article) + '">' +
      '<span class="vp-nom">' + esc(l.article) + ' ' + badgeRegime(l) + '</span>' +
      '<span class="vp-meta">' + esc(l.rayon || '') + ' · fiabilité ' + esc((LIB_FIABILITE[l.fiabilite.niveau] || l.fiabilite.niveau).toLowerCase()) + '</span>' +
      '<span class="vp-chiffres">Marge ' + esc(pct(l.taux)) + ' ' + badgeLigne(l) + '</span></button></li>';
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
      li('Fiabilité', (LIB_FIABILITE[f.fiabilite] || f.fiabilite) + (f.raisons.length ? ' : ' + f.raisons.join(', ') : '')) +
      li('Exception effective', f.exception ? (f.exception.type || 'oui') + ' (' + (f.exception.statut || '') + ')' : 'aucune') +
      li('Prix décidé', pd ? eur(pd.prix_ttc) + ', état : ' + (pd.etat || 'n/d') : 'aucun') +
      li('Alertes', alertes.length ? alertes.join(', ') : 'aucune') + '</details>';
  }
  function htmlFiche(l) {
    return '<div class="sc-fiche pt-fiche" data-fiche-ouverte="' + esc(l.article) + '"><div class="sc-nom">' + esc(l.article) + '</div>' + blocFiche(l)+ '</div>';
  }
  function htmlControle(c, icone) {
    var badgeG = c.nombre ? B.gravite(graviteBadge(c.gravite)) : B.gravite('conforme');
    var st = c.sousTotaux;
    var chiffres = st ? c.nombre + (c.nombre > 1 ? ' références' : ' référence') + ' · prix libres : ' + eur0(st.libres.montant) + ' (' + c.nature + ') ; prix réglementés et contractuels : aucune action de prix, ' + eur0(st.reglementes.montant) + ' (' + c.nature + ')'
      : c.nombre + (c.nombre > 1 ? ' références' : ' référence') + (c.montant !== null ? ' · ' + eur0(c.montant) + ' (' + c.nature + ')' : ' · ' + c.nature);
    return '<details class="sc-carte pt-ctrl" data-controle="' + c.code + '"><summary aria-label="Ouvrir le contrôle : ' + esc(c.titre) + '">' +
      (icone ? '<span class="sc-ico">' + icone(c.icone) + '</span>' : '') +
      '<span class="sc-carte-txt"><span class="sc-nom">' + esc(c.titre) + '</span><span class="vp-chiffres">' + esc(chiffres) + '</span>' +
      '<span class="pt-badges">' + badgeG + B.action(c.action, { clicable: false }) + '</span></span><span class="sc-chev"></span></summary>' +
      (c.nombre ? '<ul class="vp-liste">' + c.lignes.slice(0, 5).map(htmlLigne).join('') + '</ul>' +
        '<button type="button" class="detail-btn" data-controle-liste="' + c.code + '">Voir dans la liste</button>' : '<p class="sc-note">Aucune référence concernée.</p>') +
      '<p class="sc-methode">' + esc(c.methode) + '</p></details>';
  }
  function htmlPage(etat) {
    // etat : { analyse, role, filtres, incoherences, ouverte, toutes, site, icone }
    var a = etat.analyse, f = etat.filtres || {}, s = a.synthese;
    var lignes = trier(filtrer(a.lignes, f)), toutes = lignes.length, visibles = etat.toutes ? lignes : lignes.slice(0, 10);
    var vf = valeursFiltres(a.lignes);
    var opts = function (liste, sel, lib) { return '<option value="">Tous</option>' + liste.map(function (v) { return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(lib ? lib[v] || v : v) + '</option>'; }).join(''); };
    var h = '<div class="sc-entete">' + (etat.icone ? '<span class="sc-entete-ico">' + etat.icone('entete') + '</span>' : '') +
      '<div><h2 class="sc-h">Scanner tarifaire</h2><div class="sc-methode">' + esc((etat.site ? etat.site + ' · ' : '') + libellePeriode(s.periode) + ' · ' + s.references + ' références analysées') + '</div></div></div>';
    var cs = cartes(a), couleur = { marge_negative: 'sc-rouge', propositions: 'sc-info', a_verifier: 'sc-ambre', non_constates: 'sc-gris' };
    h += '<div class="sc-inds pt-inds">' + cs.map(function (c) {
      return '<div class="sc-ind ' + couleur[c.id] + '" data-carte="' + c.id + '"><span class="sc-ind-val">' + esc(c.valeur) + '</span><span class="sc-ind-lib">' + esc(c.titre) + '</span><span class="sc-ind-sous">' + esc(c.secondaire) + '</span></div>';
    }).join('') + '</div>';
    var sc = scenarios(a);
    h += '<p class="sc-note">' + sc.map(function (x) { return esc(x.libelle) + ' : ' + esc(eur0(x.fiable)); }).join(' · ') + ' (scénarios alternatifs, jamais additionnés).</p>';
    if (s.stockFourni === false) h += '<p class="sc-note pt-stock-absent"><b>Relevé de stock</b> : non fourni. Le coût des références n\'est pas comparé au PA net HT du stock.</p>';
    var c = conseiller(a, etat.role);
    h += '<div class="carte conseiller sc-conseiller"><img class="conseiller-avatar" src="assets/avatar/nexus-avatar-128.png" srcset="assets/avatar/nexus-avatar-64.png 64w, assets/avatar/nexus-avatar-96.png 96w, assets/avatar/nexus-avatar-128.png 128w, assets/avatar/nexus-avatar-256.png 256w" sizes="80px" alt="Conseiller NEXUS">' +
      '<div class="conseiller-corps"><div class="conseiller-titre">Conseiller NEXUS</div><p class="sc-conseil">' + esc(c.texte) + '</p>' +
      (c.filtre ? '<button type="button" class="detail-btn" data-conseil="1">Voir dans la liste</button>' : '') + '</div></div>';
    if (a.lignes.length && a.lignes.every(function (l) { return !l.regle; })) h += '<p class="sc-note">Aucun seuil validé : toutes les références restent sans seuil validé.</p>';
    if (etat.role !== 'manager' && etat.incoherences && etat.incoherences.length) h += '<div class="pt-integrite sc-note" role="alert">Incohérence dans les registres tarifaires : ' + etat.incoherences.length + ' ligne(s) à faire corriger.</div>';
    familles(a).forEach(function (fa) {
      h += '<section class="vp-bloc pt-famille" data-famille="' + fa.id + '"><h3 class="nbe-groupe-titre">' + esc(fa.titre) + '</h3>' +
        (fa.id === 'exceptions' ? '<p class="sc-note">Décisions du gérant : elles ne sont pas des anomalies.</p>' : '') +
        '<div class="sc-cartes">' + fa.cartes.map(function (x) { return htmlControle(x, etat.icone); }).join('') + '</div>' + (fa.id === 'decisions' && etat.margePlus ? etat.margePlus : '') + '</section>';
    });
    h += '<div class="vp-bloc sc-tout"><h3>Toutes les références</h3><div class="vp-filtres"><input type="search" id="ptRecherche" placeholder="Rechercher un article" value="' + esc(f.recherche || '') + '">' +
      '<select data-filtre="famille">' + opts(vf.famille, f.famille) + '</select><select data-filtre="rayon">' + opts(vf.rayon, f.rayon) + '</select>' +
      '<select data-filtre="statut">' + opts(Object.keys(LIB_STATUT), f.statut, LIB_STATUT) + '</select>' +
      '<select data-filtre="fiabilite">' + opts(Object.keys(LIB_FIABILITE), f.fiabilite, LIB_FIABILITE) + '</select>' +
      '<select data-filtre="exception"><option value="">Exceptions : toutes</option><option value="avec"' + (f.exception === 'avec' ? ' selected' : '') + '>Avec exception</option><option value="sans"' + (f.exception === 'sans' ? ' selected' : '') + '>Sans exception</option></select>' +
      (f.alerte ? '<button type="button" class="detail-btn" data-effacer="alerte">Alerte ' + esc(f.alerte) + ' ×</button>' : '') + '</div>';
    h += '<ul class="vp-liste">' + visibles.map(htmlLigne).join('') + '</ul>';
    if (!toutes) h += '<div class="empty-panel">Aucune référence ne correspond à ces filtres.</div>';
    if (toutes > visibles.length) h += '<button type="button" class="detail-btn vp-plus" data-plus="1">Voir les ' + (toutes - visibles.length) + ' autres références</button>';
    h += '</div>';
    var pr = preuves(a);
    if (pr.length) h += '<details class="sc-carte pt-preuves"><summary><span class="sc-nom">Preuves techniques (' + pr.length + ')</span><span class="sc-chev"></span></summary>' + pr.map(function (p) { return '<div class="sc-methode">' + esc(p.article) + ' : ' + esc(p.mention) + (p.raisons.length ? ' (' + esc(p.raisons.join(', ')) + ')' : '') + '</div>'; }).join('') + '</details>';
    h += '<details class="sc-carte pt-sources"><summary><span class="sc-nom">Sources et limites</span><span class="sc-chev"></span></summary>' + cs.map(function (x) {
      return '<p class="sc-methode"><b>' + esc(x.titre) + '</b> : ' + esc(x.unite) + '. ' + esc(x.periode) + '. ' + esc(x.source) + ' ' + esc(x.limite) + '</p>';
    }).join('') + '</details>';
    if (etat.ouverte) { var l = a.lignes.filter(function (x) { return x.article === etat.ouverte; })[0]; if (l) h += htmlFiche(l); }
    return h;
  }

  var CSS = '.vue-p1c .pt-inds{grid-template-columns:repeat(2,1fr)}@media (min-width:900px){.vue-p1c .pt-inds{grid-template-columns:repeat(4,1fr)}}' +
    '.vue-p1c .pt-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.vue-p1c .pt-pol{margin:8px 0}.vue-p1c .pt-pol-l{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:2px 0}' +
    '.vue-p1c .pt-ctrl .vp-liste{margin:8px 0}';

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
  var API = { cartes: cartes, scenarios: scenarios, alertesCartes: alertesCartes, trier: trier, filtrer: filtrer, valeursFiltres: valeursFiltres,
    preuves: preuves, conseiller: conseiller, fiche: fiche, etatAcces: etatAcces, peutVoirOnglet: peutVoirOnglet, filtrerSite: filtrerSite,
    regimeDe: regimeDe, contexteDeclaratif: contexteDeclaratif, construireContexteTarif: construireContexteTarif, stockParLibelle: stockParLibelle, controle: controle, familles: familles, avertissementRegime: avertissementRegime, infoRegime: infoRegime, badgeRegime: badgeRegime, badgeLigne: badgeLigne, blocFiche: blocFiche,
    chargerRegistres: chargerRegistres, chargerVentes: chargerVentes, lireCompte: lireCompte, libellePeriode: libellePeriode,
    htmlPage: htmlPage, htmlLigne: htmlLigne, htmlControle: htmlControle, htmlFiche: htmlFiche, graviteLigne: graviteLigne, CSS: CSS };
  global.NexusPolitiqueTarifaireEcran = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
