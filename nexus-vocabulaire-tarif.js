// Lexique du Scanner tarifaire (#331) : textes fixes de la marge estimée et des anomalies S1–S7.
// Fichier à part : nexus-vocabulaire.js est parcouru en entier par les tests Tempo, qui interdisent conseil et cause.
// Chargé par la page Produits seulement ; les moteurs le lisent ici (repli require en Node).
(function (global) {
  'use strict';
  const NexusVocabTarif = {};
  // Marge estimée du Scanner (lot A, #331). Textes fixes : le moteur les lit ici, il ne les porte pas.
  NexusVocabTarif.margeEstimee = {
    etats: { estimation: 'Estimation', a_verifier: 'À vérifier', non_calculable: 'Non calculable' },
    sources: {
      export: 'Coût de revient Decenium (export des ventes)',
      releve: d => 'PA net HT du relevé de stock' + (d ? ' du ' + d : ''),
    },
    methode: 'coût de revient Decenium : moyenne pondérée sur PU HT bruts, remises non déduites (formule exacte non confirmée par l’éditeur)',
    limites: {
      remises: 'Coût de revient calculé par Decenium sur les prix bruts : les remises fournisseurs n’y sont pas déduites.',
      ttc: 'Le total TTC des factures est vérifié ; le coût unitaire peut rester inexact.',
      decision: 'Estimation : n’autorise aucune décision de prix.',
      administre: 'prix administré : aucune recommandation',
      sansReleve: 'coût non contrôlé : relevé non fourni',
    },
    raisons: {
      coutAbsent: 'coût absent ou nul',
      pvAbsent: 'prix de vente absent ou nul',
      horsVentes: n => 'hors ventes commerciales (' + n + ')',
      ecartReleve: p => 'coût écarté de ' + p + ' % du PA net HT du relevé de stock',
      variationCout: p => 'coût en variation de ' + p + ' % sur la période précédente',
      margeNonPositive: 'marge négative ou nulle',
      tva: 'TVA à vérifier',
    },
  };

  // Anomalies tarifaires S1–S7 (lot C, #331). Le moteur détecte ; les libellés et le contrôle conseillé vivent ici.
  NexusVocabTarif.anomaliesTarifaires = {
    niveaux: { demontree: 'Démontrée', a_verifier: 'À vérifier' },
    cycles: { nouvelle: 'Nouvelle', verifiee: 'Vérifiée', resolue: 'Résolue', persistante: 'Persistante', aggravee: 'Aggravée' },
    masque: 'Peut expliquer aussi :',
    codes: {
      S1: { court: 'Marge négative ou nulle', titre: 'Marge négative ou nulle', controle: 'Vérifier le coût de revient et le prix de vente dans Decenium.' },
      S2: { court: 'Coût écarté du relevé', titre: 'Coût écarté du relevé de stock', controle: 'Comparer à la dernière facture fournisseur (prix brut, remise).' },
      S3: { court: 'Coût en variation', titre: 'Coût en variation', controle: 'Vérifier la dernière réception : prix, remise, quantité ; une remise mal prise en compte est une cause possible, jamais une conclusion.' },
      S4: { court: 'Conditionnement suspect', titre: 'Conditionnement suspect', controle: 'Vérifier l’unité d’achat et le colisage de la fiche.' },
      S5: { court: 'Correspondance incertaine', titre: 'Correspondance incertaine', controle: 'Vérifier la référence et ses doublons.' },
      S6: { court: 'Prix modifié sans décision', titre: 'Prix de vente modifié sans décision', controle: 'Confirmer le prix en caisse.' },
      S7: { court: 'TVA à vérifier', titre: 'TVA à vérifier', controle: 'Vérifier le taux de TVA de l’article.' },
    },
  };

  global.NexusVocabTarif = NexusVocabTarif;
  if (typeof module !== 'undefined' && module.exports) module.exports = NexusVocabTarif;
})(typeof window !== 'undefined' ? window : globalThis);
