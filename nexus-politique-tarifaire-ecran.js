// Écran 1 « Politique tarifaire » (T3) : lecture seule.
// Toute la logique de calcul reste dans le moteur T2 (NexusPolitiqueTarifaire) ; cet écran ne recalcule rien,
// il agrège, trie, filtre et affiche ce que le moteur rend. Aucune écriture, nulle part.
(function (global) {
  'use strict';

  var T = global.NexusPolitiqueTarifaire || (typeof require === 'function' ? require('./nexus-politique-tarifaire.js') : null);
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

  // ---------- Quatre cartes ----------
  function cartes(analyse) {
    var s = analyse.synthese, g = analyse.gains, L = analyse.lignes;
    var per = libellePeriode(s.periode);
    var minimum = g.decisionnels.minimum;
    var aVerifier = L.filter(function (l) {
      return l.fiabilite.niveau === 'insuffisante' || ETATS_REGL_OUVERTS.indexOf(l.conformite.etat) >= 0;
    }).length;
    var nonConstates = L.filter(function (l) { return l.prixDecide && ETATS_PRIX_NON_CONSTATES.indexOf(l.prixDecide.etat) >= 0; }).length;
    var regl = L.filter(function (l) { return ETATS_REGL_OUVERTS.indexOf(l.conformite.etat) >= 0; }).length;
    return [
      { id: 'propositions', titre: 'Propositions à valider', valeur: eur0(minimum.fiable.montant), unite: '€ de gain, scénario minimum, références fiables',
        secondaire: eur0(minimum.a_confirmer.montant) + ' à confirmer', references: minimum.fiable.references, periode: per,
        source: 'Ventes et coûts : dernier export Decenium ; seuils : registres tarifaires.',
        limite: 'Gain théorique à volume constant, non cumulable avec le scénario cible. Les références à confirmer ne sont pas comptées dans le chiffre principal.' },
      { id: 'a_verifier', titre: 'Références à vérifier', valeur: String(aVerifier), unite: 'références',
        periode: per, source: 'Moteur de politique tarifaire sur le dernier export Decenium et les registres.',
        limite: 'Fiabilité insuffisante ou contrôle réglementaire ouvert : ces références restent hors des gains.' },
      { id: 'non_constates', titre: 'Prix décidés non constatés en caisse', valeur: String(nonConstates), unite: 'références',
        periode: per, source: 'Prix décidés : registres ; prix moyen constaté : dernier export Decenium.',
        limite: 'Le prix moyen de la période ne prouve pas à lui seul le prix affiché en rayon.' },
      { id: 'reglementaire', titre: 'Contrôles réglementaires ouverts', valeur: String(regl), unite: 'références',
        periode: per, source: 'Registre des contrôles réglementaires.',
        limite: 'Aucun gain n\'est calculé sur ces références.' }
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

  // ---------- Rendu ----------
  function htmlCartes(cs) {
    return '<div class="pt-cartes">' + cs.map(function (c) {
      return '<div class="pt-carte" data-carte="' + c.id + '"><div class="pt-carte-titre">' + esc(c.titre) + '</div>' +
        '<div class="pt-carte-valeur">' + esc(c.valeur) + '</div><div class="pt-carte-unite">' + esc(c.unite) + '</div>' +
        (c.secondaire ? '<div class="pt-carte-second">' + esc(c.secondaire) + '</div>' : '') +
        '<div class="pt-carte-meta">' + esc(c.periode) + '</div><div class="pt-carte-meta">' + esc(c.source) + '</div>' +
        '<div class="pt-carte-limite">' + esc(c.limite) + '</div></div>';
    }).join('') + '</div>';
  }
  function htmlAlertes(as) {
    return '<div class="pt-alertes">' + as.map(function (a) {
      return '<button type="button" class="pt-alerte" data-alerte="' + a.code + '"><span class="pt-alerte-n">' + a.nombre + '</span>' +
        '<span class="pt-alerte-lib">' + esc(a.libelle) + '</span>' + B.gravite(graviteBadge(a.gravite)) + B.action(a.action, { clicable: false }) + '</button>';
    }).join('') + '</div>';
  }
  function htmlLigne(l) {
    var g = graviteLigne(l), badge = g === 3 ? '' : B.gravite(graviteBadge(['critique', 'a_verifier', 'information'][g]));
    return '<tr class="pt-ligne" data-article="' + esc(l.article) + '" tabindex="0"><td>' + esc(l.article) + '</td><td>' + esc(l.rayon || '') + '</td><td>' +
      esc(LIB_STATUT[l.statut] || l.statut) + '</td><td>' + esc(LIB_FIABILITE[l.fiabilite.niveau] || l.fiabilite.niveau) + '</td><td>' + badge + '</td></tr>';
  }
  function htmlFiche(l) {
    var f = fiche(l), s = f.seuil;
    var li = function (k, v) { return '<div class="pt-fiche-l"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
    return '<div class="pt-fiche"><div class="pt-fiche-titre">' + esc(f.article) + '</div>' +
      li('Famille', (f.famille || 'non rattachée') + (f.origineFamille ? ' (' + f.origineFamille + ')' : '')) +
      li('Taux de marge actuel', pct(f.tauxActuel)) +
      li('Seuil applicable', s ? (LIB_REGLE[s.niveau] || s.niveau) + ' : minimum ' + pct(s.minimum) + ', cible ' + pct(s.cible) + (s.version !== null ? ' (version ' + (s.version.seuil_id !== undefined ? s.version.seuil_id : s.version) + ')' : '') : 'aucun seuil valide') +
      li('PV moyen TTC', eur(f.pvTtc)) + li('Marge unitaire', eur(f.margeUnitaire)) +
      li('Fiabilité', (LIB_FIABILITE[f.fiabilite] || f.fiabilite) + (f.raisons.length ? ' : ' + f.raisons.join(', ') : '')) +
      li('Exception effective', f.exception ? (f.exception.type || 'oui') + ' (' + (f.exception.statut || '') + ')' : 'aucune') +
      li('Statut', (LIB_STATUT[f.statut] || f.statut) + (f.raisonStatut ? ' : ' + f.raisonStatut : '')) + '</div>';
  }
  function htmlPage(etat) {
    // etat : { analyse, role, filtres, incoherences, ouverte }
    var a = etat.analyse, f = etat.filtres || {};
    var lignes = trier(filtrer(a.lignes, f)), toutes = lignes.length, visibles = etat.toutes ? lignes : lignes.slice(0, 10);
    var vf = valeursFiltres(a.lignes);
    var opts = function (liste, sel, lib) { return '<option value="">Tous</option>' + liste.map(function (v) { return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(lib ? lib[v] || v : v) + '</option>'; }).join(''); };
    var h = '';
    h += htmlCartes(cartes(a));
    var sc = scenarios(a);
    h += '<div class="pt-scenarios">' + sc.map(function (x) { return '<span>' + esc(x.libelle) + ' : ' + esc(eur0(x.fiable)) + '</span>'; }).join('') + '<em>Scénarios alternatifs, jamais additionnés.</em></div>';
    var c = conseiller(a, etat.role);
    h += '<div class="pt-conseiller"><div class="pt-section-titre">Par où commencer</div><p>' + esc(c.texte) + '</p></div>';
    h += htmlAlertes(alertesCartes(a));
    if (etat.role !== 'manager' && etat.incoherences && etat.incoherences.length) h += '<div class="pt-integrite" role="alert">Incohérence dans les registres tarifaires : ' + etat.incoherences.length + ' ligne(s) à faire corriger.</div>';
    h += '<div class="pt-filtres"><input type="search" id="ptRecherche" placeholder="Rechercher un article" value="' + esc(f.recherche || '') + '">' +
      '<select data-filtre="famille">' + opts(vf.famille, f.famille) + '</select><select data-filtre="rayon">' + opts(vf.rayon, f.rayon) + '</select>' +
      '<select data-filtre="statut">' + opts(Object.keys(LIB_STATUT), f.statut, LIB_STATUT) + '</select>' +
      '<select data-filtre="fiabilite">' + opts(Object.keys(LIB_FIABILITE), f.fiabilite, LIB_FIABILITE) + '</select>' +
      '<select data-filtre="exception"><option value="">Exceptions : toutes</option><option value="avec"' + (f.exception === 'avec' ? ' selected' : '') + '>Avec exception</option><option value="sans"' + (f.exception === 'sans' ? ' selected' : '') + '>Sans exception</option></select>' +
      (f.alerte ? '<button type="button" class="pt-puce" data-effacer="alerte">Alerte ' + esc(f.alerte) + ' ×</button>' : '') + '</div>';
    h += '<table class="pt-table"><thead><tr><th>Article</th><th>Rayon</th><th>Statut</th><th>Fiabilité</th><th>Gravité</th></tr></thead><tbody>' + visibles.map(htmlLigne).join('') + '</tbody></table>';
    if (!toutes) h += '<div class="empty-panel">Aucune référence ne correspond à ces filtres.</div>';
    if (toutes > visibles.length) h += '<button type="button" class="pt-plus" data-plus="1">Voir les ' + (toutes - visibles.length) + ' autres références</button>';
    var pr = preuves(a);
    if (pr.length) h += '<details class="pt-preuves"><summary>Preuves techniques (' + pr.length + ')</summary>' + pr.map(function (p) { return '<div>' + esc(p.article) + ' : ' + esc(p.mention) + (p.raisons.length ? ' (' + esc(p.raisons.join(', ')) + ')' : '') + '</div>'; }).join('') + '</details>';
    if (etat.ouverte) { var l = a.lignes.filter(function (x) { return x.article === etat.ouverte; })[0]; if (l) h += htmlFiche(l); }
    return h;
  }

  var CSS = '.pt-cartes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px}.pt-carte{border:1px solid var(--hairline,var(--nbe-line,#33414F));border-radius:12px;padding:12px;background:var(--panel,transparent)}' +
    '.pt-carte-titre{font-size:13px;opacity:.85}.pt-carte-valeur{font-size:28px;font-weight:700;line-height:1.2}.pt-carte-unite,.pt-carte-meta,.pt-carte-limite{font-size:11px;opacity:.75}.pt-carte-second{font-size:13px;opacity:.9}' +
    '.pt-scenarios{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin:8px 0}.pt-conseiller,.pt-integrite{margin:12px 0;padding:10px 12px;border-radius:10px;border:1px solid var(--hairline,var(--nbe-line,#33414F))}' +
    '.pt-section-titre{font-size:12px;text-transform:uppercase;opacity:.7}.pt-alertes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:8px}' +
    '.pt-alerte{display:flex;flex-wrap:wrap;gap:6px;align-items:center;text-align:left;padding:8px;border-radius:10px;border:1px solid var(--hairline,var(--nbe-line,#33414F));background:transparent;color:inherit;cursor:pointer}.pt-alerte-n{font-weight:700;font-size:18px}' +
    '.pt-filtres{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.pt-filtres input,.pt-filtres select{min-width:0;max-width:100%}.pt-table{width:100%;border-collapse:collapse;font-size:13px}.pt-table th,.pt-table td{text-align:left;padding:6px;border-bottom:1px solid var(--hairline,var(--nbe-line,#33414F))}' +
    '.pt-ligne{cursor:pointer}.pt-fiche{margin-top:12px;padding:12px;border:1px solid var(--hairline,var(--nbe-line,#33414F));border-radius:12px}.pt-fiche-titre{font-weight:700;margin-bottom:6px}.pt-fiche-l{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:2px 0}' +
    '.pt-tabs{display:flex;gap:6px;margin:0 0 12px}.pt-tab{padding:6px 12px;border-radius:999px;border:1px solid var(--hairline,var(--nbe-line,#33414F));background:transparent;color:inherit;cursor:pointer}.pt-tab[aria-selected="true"]{font-weight:700}';

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

  async function monter(conteneur, opts) {
    var Ad = global.NexusPolitiqueTarifaireRegistres || (typeof require === 'function' ? require('./nexus-politique-tarifaire-registres.js') : null);
    if (!conteneur.querySelector('style[data-pt]')) { var st = document.createElement('style'); st.setAttribute('data-pt', '1'); st.textContent = CSS; conteneur.appendChild(st); }
    var zone = document.createElement('div'); conteneur.appendChild(zone);
    var message = function (t) { zone.innerHTML = '<div class="empty-panel">' + esc(t) + '</div>'; };
    zone.innerHTML = '<div class="loading">Chargement de la politique tarifaire…</div>';
    var compte = await lireCompte(opts.client, opts.employeId);
    var acces0 = etatAcces(compte, 1);
    if (acces0.code === 'illisible' || acces0.code === 'inactif') { message(acces0.message); return; }
    var reg, ventes;
    try { reg = filtrerSite(await chargerRegistres(opts.client), opts.siteId); ventes = await chargerVentes(opts.client, opts.siteId); }
    catch (e) { console.error('Politique tarifaire :', e); message('Lecture impossible pour le moment.'); return; }
    var total = Object.keys(reg).reduce(function (n, k) { return n + reg[k].length; }, 0);
    var acces = etatAcces(compte, total);
    if (acces.code === 'vide') { message(acces.message); return; }
    var incoh = [];
    if (opts.role === 'gerant' || opts.estCreateur) { var ri = await opts.client.from('v_tarif_incoherences').select('*'); if (!ri.error) incoh = filtrerSite({ x: ri.data || [] }, opts.siteId).x; }
    var ctx = Ad.contexteDepuisRegistres(reg, { periode: ventes.periode });
    var analyse = T.analyser(ventes.courantes, ventes.precedentes, ctx);
    var etat = { analyse: analyse, role: opts.estCreateur ? 'createur' : opts.role, filtres: {}, incoherences: incoh, ouverte: null, toutes: false };
    var dessiner = function () {
      zone.innerHTML = '<div class="pt-source">Ventes et coûts : dernier export Decenium, ' + esc(libellePeriode(analyse.synthese.periode)) + '. Règles et décisions : registres tarifaires.</div>' + htmlPage(etat);
    };
    zone.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-alerte],[data-plus],[data-effacer],.pt-ligne'); if (!t) return;
      if (t.dataset.alerte) etat.filtres.alerte = t.dataset.alerte;
      else if (t.dataset.effacer) etat.filtres.alerte = "";
      else if (t.dataset.plus) etat.toutes = true;
      else if (t.dataset.article) etat.ouverte = t.dataset.article;
      dessiner();
    });
    zone.addEventListener('change', function (ev) {
      var k = ev.target.dataset && ev.target.dataset.filtre; if (!k) return;
      if (ev.target.value) etat.filtres[k] = ev.target.value; else etat.filtres[k] = "";
      dessiner();
    });
    zone.addEventListener('input', function (ev) {
      if (ev.target.id !== 'ptRecherche') return;
      etat.filtres.recherche = ev.target.value; dessiner();
      var i = zone.querySelector('#ptRecherche'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
    dessiner();
  }

  var API = { cartes: cartes, scenarios: scenarios, alertesCartes: alertesCartes, trier: trier, filtrer: filtrer, valeursFiltres: valeursFiltres,
    preuves: preuves, conseiller: conseiller, fiche: fiche, etatAcces: etatAcces, peutVoirOnglet: peutVoirOnglet, filtrerSite: filtrerSite,
    htmlPage: htmlPage, htmlCartes: htmlCartes, htmlAlertes: htmlAlertes, graviteLigne: graviteLigne, monter: monter, CSS: CSS };
  global.NexusPolitiqueTarifaireEcran = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
