// ============================================================
// NEXUS Stock — moteur unique d'analyse de la santé du stock.
//
// Origine (28/07/2026, demande de Frédéric) : "le Cockpit doit distribuer
// du travail, pas seulement parler produits" — pour proposer une priorité
// comme "le rayon X concentre le plus d'écarts de stock non expliqués",
// le Cockpit a besoin exactement du même calcul par référence que
// NEXUS-Scanner-Stock-v1.html (état/écart/risqueEur), pas d'une deuxième
// version. Ce fichier extrait donc le calcul par référence, jusque-là
// codé uniquement dans Scanner Stock, en source unique — même risque de
// divergence que celui déjà corrigé pour les périodes (nexus-periodes.js),
// l'Indice (nexus-indice.js), la marge (nexus-marge.js) et le Conseiller
// (nexus-conseiller.js). Scanner Stock doit être mis à jour pour appeler
// NexusStock.calculerAnalyseStock() au lieu de sa propre copie.
//
// Ne fait AUCUNE requête réseau : l'appelant fournit releves/ventes/
// controles déjà chargés (fetchAllRows), pour rester compatible avec le
// pattern propre à chaque écran.
// ============================================================

(function (global) {
  // Produits digitaux, jamais mis en rayon (pas de comptage physique
  // possible) : cartes prépayées, transcash/pcs, acomptes. Exclus de
  // l'analyse — reprise à l'identique de Scanner Stock (20/07/2026).
  function estProduitNonRayon(article, categorie) {
    const a = (article || '').toLowerCase();
    const c = (categorie || '').toLowerCase();
    if (a.includes('acompte')) return true;
    if (c.includes('carte') && (c.includes('prépayé') || c.includes('prepaye'))) return true;
    if (c.includes('transcash') || c.includes('pcs')) return true;
    return false;
  }

  // Causes réelles d'un stock négatif, d'après Frédéric (15/07/2026) :
  // erreur de saisie de facture, facture oubliée, mauvais comptage à
  // l'inventaire — ou, pour certaines catégories, un décalage NORMAL
  // entre vente et facturation. Pas systématiquement une erreur.
  function causeProbableStockNegatif(categorie) {
    const c = (categorie || '').toLowerCase();
    const decalageNormal = c.includes('presse') || c.includes('carte') || c.includes('prépayé') || c.includes('prepaye') || c.includes('transcash') || c.includes('pcs');
    if (decalageNormal) {
      return "Cause probable pour cette catégorie : vente enregistrée avant la facturation fournisseur (presse quotidienne, recharges téléphoniques digitalisées...) — souvent un décalage normal, pas une erreur.";
    }
    return "Causes possibles : erreur de saisie de facture, facture fournisseur oubliée, mauvais comptage à l'inventaire, ou décalage entre vente et facturation.";
  }

  // Calcule, pour chaque article ayant au moins deux relevés, l'écart entre
  // le stock théorique constaté et ce que les ventes connues expliquent —
  // reprise à l'identique de Scanner Stock (chargerAnalyse), jamais
  // recalculée différemment ailleurs. `risqueEur` n'est déclenché que sur
  // etat === 'verifier' (écart négatif important, non expliqué par les
  // ventes) — un signal "à vérifier", jamais une démarque confirmée :
  // NEXUS n'a aujourd'hui aucun comptage réel (quantite_reelle) pour
  // affirmer une perte constatée (article 5).
  function calculerAnalyseStock(releves, ventes, controles) {
    const relevesRayon = (releves || []).filter(r => !estProduitNonRayon(r.article, r.categorie));
    if (relevesRayon.length === 0) return [];

    const parArticle = {};
    relevesRayon.forEach(r => {
      if (!parArticle[r.article]) parArticle[r.article] = [];
      parArticle[r.article].push(r);
    });

    const maintenant = new Date();

    return Object.entries(parArticle).map(([article, snapsBrut]) => {
      const snaps = [...snapsBrut].sort((a, b) => (a.releve_le || '').localeCompare(b.releve_le || ''));
      const dernier = snaps[snaps.length - 1];
      const avantDernier = snaps.length >= 2 ? snaps[snaps.length - 2] : null;
      const categorie = dernier.categorie;

      const dernierControle = (controles || []).find(c => c.article === article);
      const joursDepuisControle = dernierControle
        ? Math.round((maintenant - new Date(dernierControle.controle_le)) / 86400000)
        : null;

      const prixVenteInfo = (ventes || []).find(v => v.article === article && v.prix_vente);
      const prixVente = prixVenteInfo ? prixVenteInfo.prix_vente : null;

      const quantiteVendueTotale = (ventes || [])
        .filter(v => v.article === article)
        .reduce((s, v) => s + (v.quantite || 0), 0);

      let etat = 'inconnu', ecart = null, ecartPct = null, confiance = 30, note = "Un seul relevé disponible pour l'instant — je ne peux rien comparer.";
      if (dernier.quantite_theorique < 0) {
        etat = 'impossible'; confiance = 15;
        note = `Stock théorique négatif (${dernier.quantite_theorique}) dès le premier relevé — valeur conservée telle quelle, signalée ici. ${causeProbableStockNegatif(categorie)}`;
      }

      if (avantDernier) {
        const ventesEntreDeux = (ventes || []).filter(v =>
          v.article === article &&
          v.periode_debut && new Date(v.periode_debut) >= new Date(avantDernier.releve_le) &&
          v.periode_fin && new Date(v.periode_fin) <= new Date(dernier.releve_le)
        ).reduce((s, v) => s + (v.quantite || 0), 0);

        const aDesVentes = (ventes || []).some(v => v.article === article);
        const attendu = avantDernier.quantite_theorique - ventesEntreDeux;
        ecart = dernier.quantite_theorique - attendu;
        const base = Math.max(avantDernier.quantite_theorique, 1);
        ecartPct = ecart / base;

        confiance = 50;
        if (aDesVentes) confiance += 20; else confiance -= 10;
        confiance -= Math.min(40, Math.abs(ecartPct) * 100);
        if (dernierControle) {
          confiance += Math.max(-15, Math.min(15, 15 - Math.abs(dernierControle.ecart)));
        }
        confiance = Math.max(5, Math.min(99, Math.round(confiance)));

        if (Math.abs(ecartPct) < 0.10 || Math.abs(ecart) < 2) {
          etat = 'stable'; note = "Le mouvement de stock correspond à ce que les ventes expliquent.";
        } else if (Math.abs(ecartPct) < 0.25) {
          etat = 'surveiller'; note = ecart < 0
            ? "Écart modéré non expliqué par les ventes connues — à garder à l'œil."
            : "Plus de stock que prévu — probablement une livraison non suivie par NEXUS.";
        } else {
          etat = ecart < 0 ? 'verifier' : 'surveiller';
          note = ecart < 0
            ? "Écart important et non expliqué par les ventes — je recommande un comptage réel avant toute conclusion."
            : "Écart important au-dessus de l'attendu — probablement une livraison, mais à vérifier.";
        }

        if (!aDesVentes) {
          etat = 'inconnu'; confiance = Math.min(confiance, 35);
          note = "Aucune donnée de vente sur la période pour recouper ce mouvement — je ne peux pas conclure honnêtement.";
        }

        if (dernier.quantite_theorique < 0) {
          etat = 'impossible';
          note = `Stock théorique négatif (${dernier.quantite_theorique}) — valeur conservée telle quelle, signalée ici. ${causeProbableStockNegatif(categorie)}`;
          confiance = Math.min(confiance, 20);
        }
      }

      return {
        article, categorie, etat, ecart, ecartPct, confiance, note,
        quantiteActuelle: dernier.quantite_theorique, nbReleves: snaps.length,
        prixVente, quantiteVendueTotale, joursDepuisControle,
        risqueEur: (etat === 'verifier' && ecart < 0 && prixVente) ? Math.abs(ecart) * prixVente : 0,
      };
    });
  }

  function calculerSensibilite(p) {
    let pts = 0;
    if (p.quantiteVendueTotale > 50) pts++;
    if (p.prixVente && p.prixVente > 3) pts++;
    if (p.etat === 'verifier') pts++;
    if (p.joursDepuisControle === null || p.joursDepuisControle > 30) pts++;
    if (Math.abs(p.ecartPct || 0) > 0.15) pts++;
    return pts;
  }

  // Agrégation par rayon (28/07/2026, demande de Frédéric — "le Cockpit
  // doit distribuer du travail") : reprend l'analyse par référence
  // ci-dessus, déjà validée et affichée dans Scanner Stock, et la regroupe
  // par catégorie pour identifier le rayon qui concentre le plus de risque
  // "à vérifier". N'invente aucune démarque : c'est un écart de mouvement
  // de stock non expliqué par les ventes connues, jamais une perte
  // confirmée (NEXUS n'a aujourd'hui aucun comptage réel en base pour
  // l'affirmer — voir quantite_reelle, vide à 100 % au 28/07/2026).
  function calculerRisqueParRayon(analyse) {
    const parRayon = {};
    (analyse || []).forEach(p => {
      if (!p.categorie) return;
      if (!parRayon[p.categorie]) parRayon[p.categorie] = { categorie: p.categorie, risqueEur: 0, nbAVerifier: 0, nbASurveiller: 0, nbReferences: 0 };
      const r = parRayon[p.categorie];
      r.nbReferences += 1;
      r.risqueEur += p.risqueEur || 0;
      if (p.etat === 'verifier') r.nbAVerifier += 1;
      if (p.etat === 'surveiller') r.nbASurveiller += 1;
    });
    return Object.values(parRayon)
      .filter(r => r.nbAVerifier > 0)
      .sort((a, b) => b.risqueEur - a.risqueEur);
  }

  global.NexusStock = {
    estProduitNonRayon, causeProbableStockNegatif,
    calculerAnalyseStock, calculerSensibilite, calculerRisqueParRayon,
  };
})(window);
