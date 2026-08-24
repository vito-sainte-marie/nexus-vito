// NEXUS — Backtest structurel du moteur Commande Carburant (25/08/2026,
// retour de Frédéric, cahier "NEXUS Carburants / moteur de recommandation"
// — "Ne pas mettre immédiatement la recommandation en production
// automatique... backtest demandé avant activation sur l'historique réel
// mai-août").
//
// Fichier séparé du moteur de recommandation vivant
// (nexus-carburant-commande-moteur.js) : le backtest est un outil de
// diagnostic/reporting, jamais une dépendance de la recommandation en
// production (Article 11 — ne pas mélanger deux responsabilités). Réutilise
// uniquement des fonctions pures déjà existantes du moteur
// (construireContextePlausibilite) plutôt que de dupliquer un calcul.
//
// Portée honnête (Article 5, "jamais une fausse précision") : ce backtest
// est STRUCTUREL, pas un rejeu complet de la décision NEXUS jour par jour.
// Un rejeu complet demanderait de reconstruire le stock réel et les ventes
// exactes à la date de chaque commande de mai à août — cette série
// temporelle n'existe pas dans NEXUS avant la mise en place de la chaîne
// temporelle carburant (v2.205+, horodatage fiable à partir d'août 2026).
// Reconstruire un stock antérieur inventé serait exactement la "fausse
// précision" que l'Article 5 interdit. Ce que ce backtest vérifie à la
// place, sur les 18 commandes réelles fournies par Frédéric : les règles
// structurelles du moteur (capacité physique, minimum camion, arrondi au
// millier, respect du cut-off) et l'écart de chaque commande réelle au
// pattern historique des 17 autres (leave-one-out, jamais la commande
// testée comptée dans sa propre référence). Un rejeu complet jour par jour
// reste possible dès que l'historique de stock/ventes correspondant existe
// (à partir de la période couverte par la chaîne temporelle horodatée).

(function (global) {
  'use strict';

  const M = (typeof window !== 'undefined' && window.NexusCarburantCommandeMoteur)
    || (typeof global !== 'undefined' && global.NexusCarburantCommandeMoteur);

  function estMultipleDeMille(v) {
    return v != null && Math.round(v) % 1000 === 0;
  }

  // Une commande "brute" attendue ici a la même forme que les lignes réelles
  // de carburant_commandes (proposee_le, carburants: {sp95:{volumeL}, ...},
  // volume_total_l), plus les champs historiques additionnels utiles au
  // backtest (numero, livraisonSouhaiteeISO, livraisonEffectiveISO,
  // avantCutoff) portés par l'import (v2.240).
  function executerBacktestStructurel(historique, config) {
    const cfg = Object.assign({
      limiteRemplissageSpL: 28761,
      limiteRemplissageGoL: 28553,
      minimumCamionLitres: 10000,
      cutoffHeure: '11:00',
    }, config || {});

    const commandes = (historique || [])
      .slice()
      .sort((a, b) => new Date(a.proposee_le) - new Date(b.proposee_le));

    const resultats = commandes.map((cmd, i) => {
      const sp = cmd.carburants && cmd.carburants.sp95 ? Number(cmd.carburants.sp95.volumeL) : 0;
      const go = cmd.carburants && cmd.carburants.go ? Number(cmd.carburants.go.volumeL) : 0;
      const total = Number(cmd.volume_total_l);

      const constats = [];

      const capaciteOk = sp <= cfg.limiteRemplissageSpL && go <= cfg.limiteRemplissageGoL;
      if (!capaciteOk) constats.push('dépassement de la capacité de remplissage (vérification structurelle, sans le stock réel au moment précis)');

      const minimumOk = total >= cfg.minimumCamionLitres;
      if (!minimumOk) constats.push(`sous le minimum camion (${cfg.minimumCamionLitres} L)`);

      const arrondiOk = estMultipleDeMille(sp || null) !== false && estMultipleDeMille(go || null) !== false
        && (sp === 0 || estMultipleDeMille(sp)) && (go === 0 || estMultipleDeMille(go));
      if (!arrondiOk) constats.push("volume non arrondi au millier (convention 'arrondi au millier pertinent')");

      const heureCommande = new Date(cmd.proposee_le);
      const minutesDepuisMinuit = heureCommande.getHours() * 60 + heureCommande.getMinutes();
      const [cutH, cutM] = cfg.cutoffHeure.split(':').map(Number);
      const avantCutoffCalcule = minutesDepuisMinuit <= (cutH * 60 + cutM);
      if (cmd.avantCutoff != null && cmd.avantCutoff !== avantCutoffCalcule) {
        constats.push(`incohérence cut-off : capture indique ${cmd.avantCutoff ? 'avant' : 'après'} 11h, recalcul indique ${avantCutoffCalcule ? 'avant' : 'après'}`);
      }
      // Cas notable explicitement signalé par Frédéric (n°1008, cahier
      // "Qualité source") : commande passée après le cut-off (11:07) mais
      // tout de même livrée le lendemain, sans jour de retard supplémentaire
      // — la règle de cut-off n'est donc pas strictement appliquée par le
      // fournisseur dans les faits. Ne jamais masquer cet écart réel/règle.
      let observationCutoff = null;
      if (!avantCutoffCalcule && cmd.livraisonSouhaiteeISO && cmd.proposee_le) {
        const delaiJours = Math.round((new Date(cmd.livraisonSouhaiteeISO) - new Date(new Date(cmd.proposee_le).toDateString())) / 86400000);
        observationCutoff = delaiJours <= 1
          ? "commande après cut-off mais livrée dès le lendemain dans les faits (le fournisseur n'applique pas toujours le cut-off strictement)"
          : `commande après cut-off, livraison décalée de ${delaiJours} j — cohérent avec la règle de cut-off`;
      }

      // Écart livraison souhaitée / effective (week-end, aléas fournisseur)
      // — jamais une anomalie du moteur, une observation de fiabilité
      // fournisseur (§ cahier "mesurer la fiabilité réelle du fournisseur").
      let ecartLivraisonJours = null;
      if (cmd.livraisonSouhaiteeISO && cmd.livraisonEffectiveISO) {
        ecartLivraisonJours = Math.round((new Date(cmd.livraisonEffectiveISO) - new Date(cmd.livraisonSouhaiteeISO)) / 86400000);
      }

      // Écart au pattern historique en leave-one-out : le contexte est
      // calculé sur les 17 AUTRES commandes réelles, jamais en incluant la
      // commande elle-même (sinon la comparaison est triviale/biaisée).
      const autresCommandes = commandes.filter((_, j) => j !== i);
      const contexte = M ? M.construireContextePlausibilite(autresCommandes, total, cmd.proposee_le) : null;

      return {
        numero: cmd.numero || null,
        dateCommande: cmd.proposee_le,
        spL: sp, goL: go, totalL: total,
        capaciteOk, minimumOk, arrondiOk,
        avantCutoffCapture: cmd.avantCutoff != null ? cmd.avantCutoff : null,
        avantCutoffCalcule,
        observationCutoff,
        ecartLivraisonJours,
        ecartAuPatternHistorique: contexte ? contexte.ecartAuPattern : null,
        conforme: constats.length === 0,
        constats,
      };
    });

    const nbConformes = resultats.filter(r => r.conforme).length;
    const nbEcartsCutoffReel = resultats.filter(r => r.observationCutoff && r.observationCutoff.includes('pas toujours')).length;
    const nbLivraisonsDecalees = resultats.filter(r => r.ecartLivraisonJours != null && r.ecartLivraisonJours !== 0).length;

    return {
      nombreCommandes: resultats.length,
      nombreConformes: nbConformes,
      nombreNonConformes: resultats.length - nbConformes,
      nombreEcartsCutoffReel: nbEcartsCutoffReel,
      nombreLivraisonsDecalees: nbLivraisonsDecalees,
      resultats,
    };
  }

  const exportsObj = { executerBacktestStructurel };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
  const g = (typeof window !== 'undefined') ? window : global;
  g.NexusCarburantCommandeBacktest = exportsObj;
})(typeof window !== 'undefined' ? window : globalThis);
