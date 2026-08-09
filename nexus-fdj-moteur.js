// NEXUS FDJ — moteur de calcul partagé (09/08/2026)
//
// Même principe que nexus-conseiller.js (Article 11 de la Constitution
// NEXUS, "une seule vérité") : les formules de rapprochement FDJ (ventes
// par jeu, caisse grattage, caisse attendue, écart) ne vivent qu'ICI —
// NEXUS-FDJ-v1.html (comptage employé) et NEXUS-FDJ-Manager-v1.html
// (correction manager, pouvoir total comme NEXUS Verify) les consomment
// toutes les deux, jamais une copie locale. C'est la même erreur qui avait
// été trouvée et corrigée trois fois cette session (Centre d'Intelligence,
// Produits) — inutile de la refaire ici dès la première version de FDJ.
//
// Formules validées le 09/08/2026 contre le relevé réel du 07/08/2026
// (quart 1, feuille CONTROLE CAISSE) : ventes grattage 576 €, lots payés
// 385 € → caisse grattage 191 €, + caisse tirages 85,70 € → caisse
// attendue 276,70 €, caisse réelle comptée 276,80 € → écart +0,10 €.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-fdj-moteur.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Ventes d'un jeu = stock_initial + appro - stock_final — jamais saisi.
  // `compte` : { stock_initial, appro, stock_final } | undefined.
  // Tant que stock_initial ou stock_final manque, NEXUS ne calcule rien
  // ("vérité avant certitude") : { qte:null, valeur:null }.
  function calculerVentesJeu(compte, prix) {
    if (!compte || compte.stock_initial === null || compte.stock_initial === undefined ||
        compte.stock_final === null || compte.stock_final === undefined) {
      return { qte: null, valeur: null };
    }
    const appro = compte.appro || 0;
    const qte = Number(compte.stock_initial) + Number(appro) - Number(compte.stock_final);
    return { qte, valeur: qte * Number(prix) };
  }

  // `jeux` : [{id, prix}], `countsParJeu` : { [game_id]: {stock_initial, appro, stock_final} }
  function ventesGrattageTotal(jeux, countsParJeu) {
    let total = 0;
    for (const jeu of jeux) {
      const v = calculerVentesJeu((countsParJeu || {})[jeu.id], jeu.prix);
      if (v.valeur !== null) total += v.valeur;
    }
    return total;
  }

  function caisseGrattage(ventesTotal, lotsPayes) {
    if (lotsPayes === null || lotsPayes === undefined || lotsPayes === '') return null;
    return ventesTotal - Number(lotsPayes);
  }

  function caisseAttendue(grattage, caisseTirages, regularisations) {
    if (grattage === null || caisseTirages === null || caisseTirages === undefined || caisseTirages === '') return null;
    return grattage + Number(caisseTirages) + Number(regularisations || 0);
  }

  function ecartCaisse(caisseReelle, attendue) {
    if (attendue === null || caisseReelle === null || caisseReelle === undefined || caisseReelle === '') return null;
    return Math.round((Number(caisseReelle) - attendue) * 100) / 100;
  }

  // ------------------------------------------------------------
  // SOLDES DE CARNETS — 09/08/2026, précision terrain de Frédéric : un
  // transfert Bureau → Caisse n'est PAS une activation. Un carnet confié à
  // la caisse reste "non activé" (aucun impact sur l'appro, aucun
  // engagement financier) jusqu'à ce que la caissière l'active
  // explicitement. NEXUS doit donc distinguer :
  //   - OÙ est le carnet (Bureau / Caisse) — emplacement.
  //   - DANS QUEL ÉTAT il est (non activé / activé) — engagement.
  // Calculé ici à partir des fdj_stock_movements bruts (jamais stocké en
  // dur), pour ne jamais dupliquer cette règle entre l'écran manager
  // ("Réapprovisionner la caisse", type_mouvement='transfert') et l'écran
  // employé ("Activer un carnet", type_mouvement='activation').
  //
  // `mouvements` : lignes brutes fdj_stock_movements (type_mouvement,
  // quantite, game_id, location_source_id, location_destination_id).
  // `locationCaisseId` : id de l'emplacement de type 'caisse' du site.
  // Retourne { [game_id]: { confies, actives, nonActives } } — confies =
  // total de carnets transférés vers la caisse (moins les retours vers le
  // bureau), actives = total de carnets activés, nonActives = confies −
  // actives (jamais négatif dans l'affichage, mais peut apparaître
  // négatif ici si une activation n'a pas été précédée d'un transfert
  // enregistré — NEXUS le signale plutôt que de le masquer).
  function soldesCarnetsParJeu(mouvements, locationCaisseId) {
    const soldes = {};
    const assurer = (id) => {
      if (!soldes[id]) soldes[id] = { confies: 0, actives: 0, nonActives: 0 };
      return soldes[id];
    };
    (mouvements || []).forEach(m => {
      const qte = Number(m.quantite) || 0;
      if (m.type_mouvement === 'transfert' && m.location_destination_id === locationCaisseId) {
        assurer(m.game_id).confies += qte;
      } else if (m.type_mouvement === 'activation') {
        assurer(m.game_id).actives += qte;
      } else if (m.type_mouvement === 'retour' && m.location_source_id === locationCaisseId) {
        assurer(m.game_id).confies -= qte;
      }
    });
    Object.values(soldes).forEach(s => { s.nonActives = s.confies - s.actives; });
    return soldes;
  }
  function soldeCarnetsJeu(mouvements, locationCaisseId, gameId) {
    const soldes = soldesCarnetsParJeu(mouvements, locationCaisseId);
    return soldes[gameId] || { confies: 0, actives: 0, nonActives: 0 };
  }

  global.NexusFdjMoteur = { calculerVentesJeu, ventesGrattageTotal, caisseGrattage, caisseAttendue, ecartCaisse, soldesCarnetsParJeu, soldeCarnetsJeu };
})(typeof window !== 'undefined' ? window : globalThis);
