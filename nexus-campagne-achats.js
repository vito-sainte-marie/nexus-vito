// ============================================================
// Campagne V2, lot C4 : moteur pur des achats de promotion (besoin, date limite, reste à recevoir, alerte).
// Aucune écriture, aucun accès réseau, rien n'est jamais envoyé à un fournisseur : une commande est une trace interne.
// Dépend de nexus-campagne-stock.js (arrondirAchat, cartonDepasseBesoin, conditionnement, stockTheorique).
// Inclure : <script src="nexus-campagne-achats.js?v=20261115-1000"></script> après nexus-campagne-stock.js
// ============================================================
(function (global) {
  'use strict';
  const S = (typeof require === 'function' && typeof module !== 'undefined') ? require('./nexus-campagne-stock.js') : global.NexusCampagneStock;
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
      joursCouverture: l && Number(l.jours_couverture_apres) > 0 ? Number(l.jours_couverture_apres) : COUVERTURE_DEFAUT,
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
    const nb = (recommandations || []).filter(r => !r.indicatif && !r.hors_delai && r.a_commander > 0).length;
    return { code: 'achats', date: limite, couvert: nb === 0 };
  }

  const api = { COUVERTURE_DEFAUT, DELAI_DEFAUT, reglages, dateLimiteCommande, statutDelai, joursPromoRestants, commandesValides, resteARecevoir, besoinAchat, alerteAchats, echeanceAchats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.NexusCampagneAchats = api;
})(typeof window !== 'undefined' ? window : globalThis);
