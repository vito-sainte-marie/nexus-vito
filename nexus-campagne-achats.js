// ============================================================
// Campagne V2, lot C4 : moteur pur des achats de promotion (besoin, date limite, reste à recevoir, alerte).
// Aucune écriture, aucun accès réseau, rien n'est jamais envoyé à un fournisseur : une commande est une trace interne.
// Dépend de nexus-campagne-ventes.js, nexus-import-moteur.js et nexus-campagne-stock.js (arrondirAchat, cartonDepasseBesoin, conditionnement, stockTheorique).
// Inclure : <script src="nexus-campagne-achats.js?v=20261115-1000"></script> après nexus-campagne-stock.js
// ============================================================
(function (global) {
  'use strict';
  const NODE = typeof require === 'function' && typeof module !== 'undefined';
  const S = NODE ? require('./nexus-campagne-stock.js') : global.NexusCampagneStock;
  const CV = NODE ? require('./nexus-campagne-ventes.js') : global.NexusCampagneVentes;
  const M = NODE ? require('./nexus-import-moteur.js') : global.NexusImportMoteur;
  const JOUR_MS = 86400000;
  const COUVERTURE_DEFAUT = 15;
  const DELAI_DEFAUT = 7;

  function aDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  function cle(s) { return String(s || '').trim().toLowerCase(); }
  function jours(a, b) { const x = aDate(a), y = aDate(b); return x && y ? Math.round((y - x) / JOUR_MS) : null; }
  function ajouter(d, n) { const x = aDate(d); return x ? iso(new Date(x.getTime() + n * JOUR_MS)) : null; }

  // Dernier réglage (version la plus haute) du site ; valeurs par défaut si aucun.
  function reglages(lignes) {
    const l = (lignes || []).slice().sort((a, b) => Number(b.version) - Number(a.version))[0];
    return {
      joursCouverture: l && Number(l.jours_couverture_apres) >= 0 ? Number(l.jours_couverture_apres) : COUVERTURE_DEFAUT,
      delaiCommande: l && Number(l.delai_commande_jours) >= 0 ? Number(l.delai_commande_jours) : DELAI_DEFAUT,
      version: l ? Number(l.version) : 0,
    };
  }

  // D7 : dernier jour du mois de fin de campagne moins le délai. Antérieure au début : ramenée au début et marquée à vérifier.
  function dateLimiteCommande(campagneFin, campagneDebut, delai) {
    const f = aDate(campagneFin);
    if (!f) return null;
    const dernier = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0));
    let d = iso(new Date(dernier.getTime() - (delai == null ? DELAI_DEFAUT : delai) * JOUR_MS));
    const deb = String(campagneDebut || '').slice(0, 10);
    const deuxMois = !!aDate(campagneDebut) && (aDate(campagneDebut).getUTCFullYear() !== f.getUTCFullYear() || aDate(campagneDebut).getUTCMonth() !== f.getUTCMonth());
    if (deb && d < deb) return { date: deb, aVerifier: true, calculee: d, deuxMois };
    return { date: d, aVerifier: false, calculee: d, deuxMois };
  }

  // La veille et le jour même : normal. Le lendemain : hors délai fournisseur.
  function statutDelai(aujourdhui, limite) {
    const j = jours(aujourdhui, limite);
    if (j == null) return 'inconnu';
    if (j > 0) return 'avant';
    if (j === 0) return 'jour_meme';
    return 'hors_delai';
  }

  // Jours de promotion restants depuis la date du stock (dernier point de ventes valide) jusqu'à la fin.
  function joursPromoRestants(dateStock, campagneFin) {
    const j = jours(dateStock, campagneFin);
    return j == null ? 0 : Math.max(0, j);
  }

  // Commande valide : ni annulée, ni remplacée par une autre commande non annulée.
  function commandesValides(commandes, annulations) {
    const ann = new Set((annulations || []).map(a => a.commande_id));
    const remplacees = new Set((commandes || []).filter(c => c.remplace_commande_id && !ann.has(c.id)).map(c => c.remplace_commande_id));
    return (commandes || []).filter(c => !ann.has(c.id) && !remplacees.has(c.id));
  }

  // Reste à recevoir par article : unités commandées (commandes valides, non clôturées) moins unités reçues (lignes de livraisons
  // valides liées à ces commandes). Plancher à 0 ; l'excès est signalé, jamais retranché ailleurs.
  function resteARecevoir({ commandes, annulations, clotures, lignesCommande, livraisons, livraisonsAnnulations, liens, lignesLivraison }) {
    const clos = new Set((clotures || []).map(c => c.commande_id));
    const ouvertes = new Map(commandesValides(commandes, annulations).filter(c => !clos.has(c.id)).map(c => [c.id, c]));
    const livValides = new Map(S.livraisonsValides(livraisons, livraisonsAnnulations).map(l => [l.id, l]));
    const livVersCmd = new Map((liens || []).filter(l => ouvertes.has(l.commande_id) && livValides.has(l.livraison_id)).map(l => [l.livraison_id, l.commande_id]));
    const out = new Map();
    const fiche = a => { const k = cle(a); if (!out.has(k)) out.set(k, { article: a, commande: 0, recu: 0, reste: 0, exces: 0 }); return out.get(k); };
    (lignesCommande || []).filter(l => ouvertes.has(l.commande_id)).forEach(l => { fiche(l.article).commande += Number(l.unites_commandees || 0); });
    (lignesLivraison || []).filter(l => livVersCmd.has(l.livraison_id)).forEach(l => { fiche(l.article).recu += Number(l.unites || 0); });
    out.forEach(f => { f.reste = Math.max(0, f.commande - f.recu); f.exces = Math.max(0, f.recu - f.commande); });
    return out;
  }

  // Besoin d'achat d'un article (D3).
  // besoin promo = objectif validé par jour x jours restants ; besoin après = rythme habituel x jours de couverture ;
  // à commander = max(0, promo + après - stock théorique - reste à recevoir), arrondi au carton.
  function besoinAchat({ article, objectifJour, joursRestants, ventesRefJour, joursCouverture, stock, fiable, resteARecevoir: reste, cond, aujourdhui, limite }) {
    const couv = joursCouverture == null ? COUVERTURE_DEFAUT : joursCouverture;
    const c = cond || S.conditionnement(article, null);
    const refAbsent = ventesRefJour == null || ventesRefJour === '' || !(Number(ventesRefJour) >= 0);
    const promo = Math.max(0, Number(objectifJour || 0)) * Math.max(0, Number(joursRestants || 0));
    const apres = refAbsent ? 0 : Number(ventesRefJour) * couv;
    const statut = limite ? statutDelai(aujourdhui, limite) : 'inconnu';
    const r = { article, besoin_promo: promo, besoin_apres: apres, reste_a_recevoir: Number(reste || 0), stock, statut_delai: statut,
      hors_delai: statut === 'hors_delai', indicatif: false, motif_indicatif: null, a_commander: null, cartons: null, mention: null,
      alerte_carton: false, preremplir: false };
    if (stock == null) { r.indicatif = true; r.motif_indicatif = 'stock à confirmer'; return r; }
    const net = Math.max(0, promo + apres - Number(stock) - Number(reste || 0));
    const ar = S.arrondirAchat(net, c);
    r.besoin_net = net; r.a_commander = ar.unites; r.cartons = ar.cartons; r.mention = ar.mention;
    r.alerte_carton = S.cartonDepasseBesoin(net, c, 0.5);
    if (!fiable) { r.indicatif = true; r.motif_indicatif = 'stock à confirmer'; }
    else if (refAbsent) { r.indicatif = true; r.motif_indicatif = 'rythme habituel absent'; }
    r.preremplir = !r.indicatif && !r.hors_delai && r.a_commander > 0;
    return r;
  }

  // Alerte du menu : de D7 − 7 à D7 inclus (décision de Frédéric, 14/11), tant qu'une recommandation fiable reste non couverte.
  function alerteAchats({ aujourdhui, limite, recommandations }) {
    const nb = (recommandations || []).filter(r => !r.indicatif && !r.hors_delai && r.a_commander > 0).length;
    const j = limite ? jours(aujourdhui, limite) : null;
    if (j == null || j < 0 || nb === 0) return { actif: false, niveau: null, nb };
    if (j <= 7) return { actif: true, niveau: 'j7', nb };
    return { actif: false, niveau: null, nb };
  }

  // Entrée pour prochaineEcheance(..., autres) : la carte affiche « Préparer les achats » à la date limite.
  function echeanceAchats({ limite, recommandations }) {
    if (!limite) return null;
    // Tant qu'une recommandation chiffrée reste non commandée (fiable OU indicative) et que la date limite n'est pas passée, la carte garde « Préparer les achats ».
    const restantes = (recommandations || []).filter(r => !r.hors_delai && r.a_commander > 0);
    const fiables = restantes.filter(r => !r.indicatif).length;
    return { code: 'achats', date: limite, couvert: restantes.length === 0, aConfirmer: restantes.length > 0 && fiables === 0 };
  }

  // ---- Chargement et calcul PARTAGÉS : la page Achats, l'accueil des campagnes et le point du menu appellent exactement ce code. ----
  function derniers(rows, k) { const m = new Map(); (rows || []).forEach(r => { const a = m.get(r[k]); if (!a || r.version > a.version) m.set(r[k], r); }); return Array.from(m.values()); }

  // Lit toutes les données d'une campagne pour un site. client = client Supabase ; chargerAlias(client, site, 'campagne') = NexusImportDonnees.chargerAliasProduits.
  async function chargerDonnees(client, site, campagne, chargerAlias) {
    const q = t => client.from(t);
    const r = await Promise.all([
      q('campagne_objectifs_produits').select('article, version, objectif_valide_jour, ventes_ref_jour').eq('campagne_id', campagne.id).eq('site', site).order('version', { ascending: true }),
      q('campagne_conditionnement_achat').select('article, version, mode, unites_par_carton').eq('site', site),
      q('campagne_achats_reglages').select('version, jours_couverture_apres, delai_commande_jours').eq('site', site),
      q('campagne_stock_depart').select('article, version, quantite, date_stock, source, a_confirmer').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_livraisons').select('id, fournisseur, date_livraison, note, remplace_livraison_id, cree_le').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_livraisons_annulations').select('livraison_id, motif').eq('site', site),
      q('campagne_livraison_lignes').select('livraison_id, article, cartons, unites_par_carton, unites').eq('site', site),
      q('campagne_ventes_points').select('batch_id, article, date_fin, importe_le, quantite').eq('campagne_id', campagne.id).eq('site', site),
      q('campagne_ventes_annulations').select('batch_id, motif').eq('site', site),
      q('campagne_commandes').select('id, fournisseur, date_commande, date_livraison_prevue, note, remplace_commande_id, cree_le').eq('campagne_id', campagne.id).eq('site', site).order('date_commande', { ascending: false }),
      q('campagne_commande_lignes').select('commande_id, article, unites_commandees, cartons, unites_par_carton, recommande_unites').eq('site', site),
      q('campagne_commandes_annulations').select('commande_id, motif').eq('site', site),
      q('campagne_commandes_clotures').select('commande_id, motif').eq('site', site),
      q('campagne_livraison_commandes').select('livraison_id, commande_id').eq('site', site),
    ]);
    r.forEach(x => { if (x.error) console.error(x.error); });
    const d = r.map(x => x.data || []);
    const alias = chargerAlias ? await chargerAlias(client, site, 'campagne') : [];
    return { objectifs: derniers(d[0], 'article'), conds: d[1], reglages: d[2], depart: d[3], livraisons: d[4], livraisonsAnnulations: d[5], lignesLivraison: d[6],
      points: d[7], ventesAnnulations: d[8], commandes: d[9], lignesCommande: d[10], commandesAnnulations: d[11], clotures: d[12], liens: d[13], alias };
  }

  // Recommandations d'une campagne à une date : le calcul unique de la page Achats.
  function recommandationsCampagne({ campagne, donnees: d, aujourdhui }) {
    const reg = reglages(d.reglages);
    const lim = dateLimiteCommande(campagne.date_fin, campagne.date_debut, reg.delaiCommande);
    const pc = CV.pointCourant(d.points, d.ventesAnnulations);
    const resoudre = a => M.resoudreAlias(a, d.alias);
    const stocks = S.stockTheorique({ articles: d.objectifs.map(o => o.article), stockDepart: d.depart, livraisons: d.livraisons, annulations: d.livraisonsAnnulations, lignesLivraison: d.lignesLivraison, ventes: pc ? pc.lignes : [], dateVentes: pc ? pc.date_fin : null, campagneDebut: campagne.date_debut, resoudre });
    const reste = resteARecevoir({ commandes: d.commandes, annulations: d.commandesAnnulations, clotures: d.clotures, lignesCommande: d.lignesCommande, livraisons: d.livraisons, livraisonsAnnulations: d.livraisonsAnnulations, liens: d.liens, lignesLivraison: d.lignesLivraison });
    const jr = pc ? joursPromoRestants(pc.date_fin, campagne.date_fin) : 0;
    const reco = d.objectifs.map(ob => {
      const st = stocks.find(s => s.article === ob.article) || { stock: null, fiable_pour_achat: false };
      const rs = reste.get(cle(ob.article)) || { commande: 0, recu: 0, reste: 0, exces: 0 };
      const cd = derniers(d.conds, 'article').find(x => x.article === ob.article) || null;
      const cond = S.conditionnement(ob.article, cd);
      const b = besoinAchat({ article: ob.article, objectifJour: ob.objectif_valide_jour, joursRestants: jr, ventesRefJour: ob.ventes_ref_jour, joursCouverture: reg.joursCouverture, stock: st.stock, fiable: !!st.fiable_pour_achat, resteARecevoir: rs.reste, cond, aujourdhui, limite: lim ? lim.date : null });
      return { ob, cond, rs, b };
    });
    return { reg, lim, pc, auj: aujourdhui, reco };
  }

  // Ce que montrent le menu et l'accueil : alerte du point et échéance « Préparer les achats », issues des MÊMES recommandations.
  function etatAchats({ campagne, donnees, aujourdhui }) {
    const ctx = recommandationsCampagne({ campagne, donnees, aujourdhui });
    const limite = ctx.lim ? ctx.lim.date : null;
    const recs = ctx.reco.map(r => r.b);
    return { ctx, alerte: alerteAchats({ aujourdhui, limite, recommandations: recs }), echeance: echeanceAchats({ limite, recommandations: recs }) };
  }

  // Saisie d'une commande : en cartons si le conditionnement est connu et réel, sinon en unités.
  function modeSaisie(cond) {
    const upc = cond && Number(cond.unitesParCarton) > 0 ? Number(cond.unitesParCarton) : null;
    if (cond && !cond.aRenseigner && cond.source !== 'a_l_unite' && upc) return { mode: 'cartons', upc };
    return { mode: 'unites', upc };
  }
  // Ligne enregistrée : un article à l'unité ou sans conditionnement n'a jamais de cartons.
  function ligneCommande({ cond, saisie, article, recommande }) {
    const m = modeSaisie(cond), v = Number(saisie);
    const rec = recommande == null ? null : recommande;
    if (m.mode === 'cartons') return { article, unites_commandees: v * m.upc, cartons: v, unites_par_carton: m.upc, recommande_unites: rec };
    const upc = cond && cond.source === 'a_l_unite' ? 1 : null;
    return { article, unites_commandees: v, cartons: null, unites_par_carton: upc, recommande_unites: rec };
  }
  const api = { modeSaisie, ligneCommande, COUVERTURE_DEFAUT, DELAI_DEFAUT, reglages, dateLimiteCommande, statutDelai, joursPromoRestants, commandesValides, resteARecevoir, besoinAchat, alerteAchats, echeanceAchats, chargerDonnees, recommandationsCampagne, etatAchats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.NexusCampagneAchats = api;
})(typeof window !== 'undefined' ? window : globalThis);
