// Test — Carburants Sprint C8 "Économique" (17/08/2026, audit "Carburants
// — Réceptions, deltas et effet économique du stock" §6/§7 : "Le moteur
// économique peut ensuite exploiter une chaîne physique fiable [...] Il ne
// doit pas être mélangé à la phase P0", roadmap §16 "Seulement si achats/
// CMP fiables"). Fonctions pures du moteur de valorisation économique
// (nexus-carburant-moteur.js) — jamais réécrites ici, require() direct,
// même convention que tous les autres tests moteur du projet.
//
// Chemin relatif à __dirname (convention établie depuis la sécurisation
// structurelle du 16/08/2026 — exécutable depuis n'importe quel
// emplacement sur le disque).

const assert = require('assert');

require(__dirname + '/nexus-carburant-moteur.js');
const M = global.NexusCarburantMoteur;

// ------------------------------------------------------------
// calculerCmpApresLivraison — formule de référence de l'audit §7 :
// nouveau CMP = (ancien_stock × ancien_CMP + nouvelle_quantité × nouveau_coût) / nouveau_volume_total
// ------------------------------------------------------------
(() => {
  // Première livraison coûtée jamais rencontrée (aucun CMP précédent) —
  // le CMP démarre au coût de cette livraison, jamais une division par un
  // "ancien stock" qui n'existe pas encore.
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: null, stockAvantL: null, quantiteLivreeL: 10000, coutAchatParLitre: 1.5 }),
    1.5,
    'Aucun CMP précédent -> le CMP démarre au coût de cette première livraison coûtée'
  );

  // Stock avant nul/manquant malgré un CMP déjà connu (cuve vide avant
  // livraison, ou jaugeage avant non disponible) -> repli sur le coût de
  // cette livraison plutôt qu'une division par un volume nul.
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: 1.4, stockAvantL: 0, quantiteLivreeL: 10000, coutAchatParLitre: 1.6 }),
    1.6,
    'Stock avant nul -> repli sur le coût de cette livraison, jamais une division par zéro'
  );
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: 1.4, stockAvantL: null, quantiteLivreeL: 10000, coutAchatParLitre: 1.6 }),
    1.6,
    'Stock avant manquant (jaugeage non disponible) -> même repli'
  );

  // Formule pondérée classique : 5000 L à 1.40 €/L déjà en cuve, 5000 L
  // livrés à 1.60 €/L -> CMP = (5000×1.40 + 5000×1.60) / 10000 = 1.50.
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: 1.40, stockAvantL: 5000, quantiteLivreeL: 5000, coutAchatParLitre: 1.60 }),
    1.50,
    'Moyenne pondérée standard : 5000L@1.40 + 5000L@1.60 -> CMP 1.50'
  );

  // Livraison sans coût connu (coutAchatParLitre null) -> le CMP ne
  // bouge pas, jamais une exception ni une valeur fabriquée.
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: 1.45, stockAvantL: 8000, quantiteLivreeL: 5000, coutAchatParLitre: null }),
    1.45,
    'Coût d\'achat non renseigné -> CMP inchangé, jamais une exception'
  );

  // Quantité livrée nulle/négative (donnée aberrante) -> CMP inchangé,
  // jamais une division par un volume total incohérent.
  assert.strictEqual(
    M.calculerCmpApresLivraison({ cmpPrecedent: 1.45, stockAvantL: 8000, quantiteLivreeL: 0, coutAchatParLitre: 1.9 }),
    1.45,
    'Quantité livrée nulle -> CMP inchangé'
  );

  console.log('OK — calculerCmpApresLivraison : formule pondérée de référence (audit §7), jamais de division par zéro ni de valeur fabriquée sans coût connu.');
})();

// ------------------------------------------------------------
// calculerCmpProgressif — rejoue toutes les livraisons coûtées d'un
// carburant, triées chronologiquement, pour obtenir le CMP courant.
// ------------------------------------------------------------
(() => {
  // Aucune livraison coûtée -> non suffisant, aucun CMP fabriqué
  // (Article 5 : un site qui n'a pas commencé à saisir ses coûts doit
  // rester silencieux, pas afficher un CMP à 0).
  assert.deepStrictEqual(
    M.calculerCmpProgressif([]),
    { suffisant: false, cmp: null, coutRemplacementActuel: null, nombreLivraisonsCoutees: 0 },
    'Aucune livraison coûtée -> non suffisant, aucun CMP fabriqué'
  );
  assert.deepStrictEqual(
    M.calculerCmpProgressif(null),
    { suffisant: false, cmp: null, coutRemplacementActuel: null, nombreLivraisonsCoutees: 0 },
    'livraisons=null -> traité comme liste vide, jamais une exception'
  );

  // Une seule livraison coûtée -> suffisant dès la première (le CMP est
  // un fait pondéré, pas une inférence statistique — contrairement à
  // signatureDeltaLivraison (C7), pas de seuil d'échantillon minimal ici).
  const uneLivraison = M.calculerCmpProgressif([{ stockAvantL: null, quantiteLivreeL: 15000, coutAchatParLitre: 1.55 }]);
  assert.deepStrictEqual(uneLivraison, { suffisant: true, cmp: 1.55, coutRemplacementActuel: 1.55, nombreLivraisonsCoutees: 1 }, 'Une seule livraison coûtée -> déjà suffisant, CMP = son coût');

  // Livraisons non coûtées mélangées à des livraisons coûtées -> les non
  // coûtées sont ignorées, jamais comptées dans nombreLivraisonsCoutees.
  const avecTrous = M.calculerCmpProgressif([
    { stockAvantL: null, quantiteLivreeL: 10000, coutAchatParLitre: null }, // pas encore coûtée, ignorée
    { stockAvantL: null, quantiteLivreeL: 10000, coutAchatParLitre: 1.40 },
    { stockAvantL: 10000, quantiteLivreeL: 10000, coutAchatParLitre: 1.60 },
  ]);
  assert.strictEqual(avecTrous.nombreLivraisonsCoutees, 2, 'Seules les livraisons avec un coût connu sont comptées');
  assert.strictEqual(avecTrous.cmp, 1.50, 'CMP recalculé uniquement sur les 2 livraisons coûtées : (10000×1.40+10000×1.60)/20000 = 1.50');
  assert.strictEqual(avecTrous.coutRemplacementActuel, 1.60, 'Coût de remplacement = coût de la DERNIÈRE livraison coûtée (ordre d\'entrée du tableau)');

  console.log('OK — calculerCmpProgressif : rejoue les livraisons coûtées séquentiellement, suffisant dès 1 livraison (fait pondéré, pas une statistique), ignore les livraisons sans coût.');
})();

// ------------------------------------------------------------
// libelleCmp — phrase manager, jamais un montant fabriqué sans base.
// ------------------------------------------------------------
(() => {
  assert.ok(
    M.libelleCmp({ suffisant: false, cmp: null, coutRemplacementActuel: null, nombreLivraisonsCoutees: 0 }).includes('Aucun coût'),
    'Aucune livraison coûtée -> phrase neutre, aucun montant fabriqué'
  );
  const txt = M.libelleCmp({ suffisant: true, cmp: 1.523, coutRemplacementActuel: 1.6, nombreLivraisonsCoutees: 4 });
  assert.ok(txt.includes('1.523') && txt.includes('4') && txt.includes('1.600'), 'CMP suffisant -> phrase cite le CMP, le nombre de livraisons et le dernier coût connu');

  console.log('OK — libelleCmp : phrase neutre sans base de calcul, phrase chiffrée sinon.');
})();

// ------------------------------------------------------------
// calculerEffetPrixStockHerite — audit §6.2/§6.3 : jamais une "perte",
// toujours "pression potentielle sur marge" (défavorable) ou "avantage
// temporaire" (favorable), fonctionnement symétrique.
// ------------------------------------------------------------
(() => {
  // Données insuffisantes (CMP, coût de remplacement ou stock physique
  // manquant) -> non suffisant, aucun effet fabriqué.
  assert.deepStrictEqual(
    M.calculerEffetPrixStockHerite({ cmp: null, coutRemplacementActuel: 1.6, prixVenteDuMois: 1.9, stockPhysiqueActuelL: 20000 }),
    { suffisant: false },
    'CMP manquant -> non suffisant'
  );
  assert.deepStrictEqual(
    M.calculerEffetPrixStockHerite({ cmp: 1.5, coutRemplacementActuel: 1.6, prixVenteDuMois: 1.9, stockPhysiqueActuelL: null }),
    { suffisant: false },
    'Stock physique actuel manquant -> non suffisant'
  );

  // Cas défavorable de l'exemple de l'audit §6.2 : ancien coût 1.60,
  // nouveau coût de remplacement 1.53, stock hérité 20000 L -> effet =
  // (1.53 - 1.60) × 20000 = -1400 €.
  const defavorable = M.calculerEffetPrixStockHerite({ cmp: 1.60, coutRemplacementActuel: 1.53, prixVenteDuMois: null, stockPhysiqueActuelL: 20000 });
  assert.strictEqual(defavorable.suffisant, true);
  assert.ok(Math.abs(defavorable.effetTotal - (-1400)) < 1e-6, 'Exemple audit §6.2 : effet potentiel = -1400 €');
  assert.strictEqual(defavorable.sens, 'defavorable', 'Coût de remplacement inférieur au CMP -> sens défavorable (pression potentielle)');

  // Cas favorable (audit §6.3, symétrique) : coût de remplacement
  // supérieur au CMP -> avantage économique temporaire.
  const favorable = M.calculerEffetPrixStockHerite({ cmp: 1.50, coutRemplacementActuel: 1.65, prixVenteDuMois: null, stockPhysiqueActuelL: 10000 });
  assert.strictEqual(favorable.sens, 'favorable', 'Coût de remplacement supérieur au CMP -> sens favorable (avantage temporaire)');
  assert.ok(favorable.effetTotal > 0, 'Effet total positif dans le cas favorable');

  // Marges réelle/référence calculées uniquement si le prix de vente est
  // disponible — jamais fabriquées sans lui.
  const avecPrix = M.calculerEffetPrixStockHerite({ cmp: 1.50, coutRemplacementActuel: 1.60, prixVenteDuMois: 1.90, stockPhysiqueActuelL: 5000 });
  assert.ok(Math.abs(avecPrix.margeReelleStockHerite - 0.40) < 1e-9, 'Marge réelle du stock hérité = prix de vente - CMP = 1.90 - 1.50 = 0.40');
  assert.ok(Math.abs(avecPrix.margeReference - 0.30) < 1e-9, 'Marge de référence du mois = prix de vente - coût de remplacement = 1.90 - 1.60 = 0.30');
  const sansPrix = M.calculerEffetPrixStockHerite({ cmp: 1.50, coutRemplacementActuel: 1.60, prixVenteDuMois: null, stockPhysiqueActuelL: 5000 });
  assert.strictEqual(sansPrix.margeReelleStockHerite, null, 'Prix de vente non disponible -> marge réelle non fabriquée');
  assert.strictEqual(sansPrix.margeReference, null, 'Prix de vente non disponible -> marge de référence non fabriquée');

  console.log('OK — calculerEffetPrixStockHerite : reproduit l\'exemple chiffré de l\'audit §6.2, fonctionnement symétrique favorable/défavorable (§6.3), marges jamais fabriquées sans prix de vente.');
})();

// ------------------------------------------------------------
// libelleEffetPrixStockHerite — jamais "perte"/"anormal", toujours
// "pression potentielle sur marge" ou "avantage économique temporaire"
// (formulation exacte demandée par l'audit §6.2).
// ------------------------------------------------------------
(() => {
  assert.ok(
    M.libelleEffetPrixStockHerite({ suffisant: false }).includes('Aucun coût'),
    'Non suffisant -> phrase neutre'
  );

  const txtDefavorable = M.libelleEffetPrixStockHerite({ suffisant: true, effetTotal: -1400, sens: 'defavorable' });
  assert.ok(txtDefavorable.includes('Pression potentielle sur marge'), 'Sens défavorable -> "Pression potentielle sur marge", formulation exacte de l\'audit §6.2');
  assert.ok(!txtDefavorable.toLowerCase().startsWith('perte'), 'Jamais présenté comme un constat de perte — la phrase commence par "Pression potentielle", pas par "Perte"');

  const txtFavorable = M.libelleEffetPrixStockHerite({ suffisant: true, effetTotal: 900, sens: 'favorable' });
  assert.ok(txtFavorable.includes('Avantage économique temporaire'), 'Sens favorable -> "Avantage économique temporaire", formulation exacte de l\'audit §6.3');

  const txtNeutre = M.libelleEffetPrixStockHerite({ suffisant: true, effetTotal: 0, sens: 'neutre' });
  assert.ok(txtNeutre.includes('aligné'), 'Sens neutre -> phrase factuelle, ni pression ni avantage');

  console.log('OK — libelleEffetPrixStockHerite : jamais "perte", toujours "pression potentielle sur marge" ou "avantage économique temporaire" (formulation exacte de l\'audit §6.2/§6.3).');
})();

console.log('\nTous les tests "Carburants Sprint C8 — Économique (CMP + effet prix stock hérité)" passent.');
