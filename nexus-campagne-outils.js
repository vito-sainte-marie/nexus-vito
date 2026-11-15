// Mes outils commerciaux (Campagne V2, lot C7). Logique pure : aucun accès réseau, aucune écriture, aucun nouveau seuil.
// Les règles viennent des moteurs existants : suivi des ventes (80 %), bilan (gain ou perte de marge), mesure de la compensation.
(function (global) {
  'use strict';

  const ORDRE_STATUT = { encours: 0, avenir: 1, terminee: 2 };

  function statutPromotion(c, auj) {
    if (c.date_debut > auj) return 'avenir';
    if (c.date_fin < auj) return 'terminee';
    return 'encours';
  }

  // Toutes les promotions du site : en cours, à venir, puis terminées (la plus récente d'abord).
  function listerPromotions(campagnes, auj, bilansDispo) {
    const dispo = bilansDispo || new Set();
    return (campagnes || []).map(c => {
      const statut = statutPromotion(c, auj);
      return {
        id: c.id, nom: c.nom, date_debut: c.date_debut, date_fin: c.date_fin, statut,
        nb_produits: Array.isArray(c.produits_concernes) ? c.produits_concernes.length : 0,
        bilan: statut === 'terminee' && (dispo.has ? dispo.has(c.id) : false),
      };
    }).sort((a, b) => ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut]
      || (a.statut === 'avenir' ? (a.date_debut < b.date_debut ? -1 : a.date_debut > b.date_debut ? 1 : 0)
        : (a.date_fin < b.date_fin ? 1 : a.date_fin > b.date_fin ? -1 : 0)));
  }

  // Moteurs et produits à revoir. En cours : statut du suivi (règle des 80 %). Terminées : signe du gain ou de la perte de marge du bilan.
  // Un produit sans mesure (non mesurable, gain absent ou nul) n'est classé nulle part : jamais de chiffre inventé.
  function classerProduits({ campagnes, suivis, bilans, auj }) {
    const moteurs = [], aRevoir = [];
    (campagnes || []).forEach(c => {
      const statut = statutPromotion(c, auj);
      if (statut === 'encours') {
        const sv = suivis && suivis.get ? suivis.get(c.id) : null;
        if (!sv || sv.vide) return;
        sv.lignes.forEach(l => {
          if (l.statut !== 'moteur' && l.statut !== 'a_revoir') return;
          const e = { campagne_id: c.id, campagne: c.nom, article: l.article, source: 'suivi', quantite: l.vendu, seuil: l.seuil, gain: null, estimee: !!l.marge_estimee };
          (l.statut === 'moteur' ? moteurs : aRevoir).push(e);
        });
      } else if (statut === 'terminee') {
        const b = bilans && bilans.get ? bilans.get(c.id) : null;
        if (!b) return;
        b.articles.forEach(a => {
          const g = a.gain_perte_vs_habituel;
          if (g === null || g === undefined || g === 0) return;
          const e = { campagne_id: c.id, campagne: c.nom, article: a.article, source: 'bilan', quantite: a.unites_vendues, seuil: null, gain: g, estimee: !!a.estimee };
          (g > 0 ? moteurs : aRevoir).push(e);
        });
      }
    });
    const tri = (x, y) => (y.gain === null ? 0 : y.gain) - (x.gain === null ? 0 : x.gain);
    moteurs.sort(tri);
    aRevoir.sort((x, y) => -tri(x, y));
    return { moteurs, aRevoir };
  }

  // Quelles promotions renouveler : l'état est celui du moteur de mesure, sans autre critère.
  // `a_renouveler` d'abord, les autres ensuite avec leur état réel, dans l'ordre reçu.
  function classerRenouvellements(mesures) {
    const l = (mesures || []).filter(m => m && m.resultat);
    return l.filter(m => m.resultat.etat === 'a_renouveler').concat(l.filter(m => m.resultat.etat !== 'a_renouveler'));
  }

  global.NexusCampagneOutils = { statutPromotion, listerPromotions, classerProduits, classerRenouvellements };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneOutils;
})(typeof window !== 'undefined' ? window : globalThis);
