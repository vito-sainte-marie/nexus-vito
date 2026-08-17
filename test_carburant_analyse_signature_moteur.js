// Test — Carburants Sprint C7 "Analyse" (17/08/2026, NEXUS_Audit_Carburants_
// Chaine_Preuve_Developpeur.pdf, §4 "Analyse statistique des deltas — pas de
// signature de réception propre au site" + roadmap "Signature delta
// livraison / statistiques", critère de sortie "Historique suffisant et
// fiable"). Fonctions pures des deux moteurs concernés : signature de
// réception (nexus-reception-moteur.js) et fiabilité de la chaîne de
// contrôle (nexus-carburant-moteur.js) — jamais réécrites ici, require()
// direct comme tous les autres tests moteur du projet.
//
// Chemin relatif à __dirname (convention établie depuis la sécurisation
// structurelle du 16/08/2026 — exécutable depuis n'importe quel emplacement
// sur le disque).

const assert = require('assert');

require(__dirname + '/nexus-reception-moteur.js');
require(__dirname + '/nexus-carburant-moteur.js');
const R = global.NexusReceptionMoteur;
const C = global.NexusCarburantMoteur;

// ------------------------------------------------------------
// signatureDeltaLivraison — médiane + MAD, robuste à un delta exceptionnel
// dans un échantillon encore petit. Jamais de médiane/dispersion fabriquée
// sous le seuil d'échantillon minimal (Article 5).
// ------------------------------------------------------------
(() => {
  // Historique vide -> jamais suffisant, jamais d'exception.
  assert.deepStrictEqual(
    R.signatureDeltaLivraison([]),
    { suffisant: false, tailleEchantillon: 0, mediane: null, dispersion: null },
    'Aucun historique -> signature non suffisante, aucune valeur fabriquée'
  );

  // Sous le seuil (ECHANTILLON_MIN_HISTORIQUE = 3) -> non suffisant même
  // avec des valeurs présentes.
  assert.deepStrictEqual(
    R.signatureDeltaLivraison([0.01, -0.02]),
    { suffisant: false, tailleEchantillon: 2, mediane: null, dispersion: null },
    '2 valeurs seulement (< 3) -> non suffisant, jamais de médiane calculée sur un échantillon trop court'
  );

  // Valeurs null/undefined dans l'historique -> filtrées avant de compter
  // l'échantillon (mesures non calculables ne doivent pas gonfler ni
  // fausser la taille de l'échantillon).
  assert.deepStrictEqual(
    R.signatureDeltaLivraison([0.01, null, -0.02, undefined]),
    { suffisant: false, tailleEchantillon: 2, mediane: null, dispersion: null },
    'null/undefined filtrés avant de compter l\'échantillon -> reste 2 valeurs exploitables (< seuil 3), non suffisant'
  );

  // Échantillon impair -> médiane = valeur du milieu une fois trié.
  const sig1 = R.signatureDeltaLivraison([0.05, -0.01, 0.0]);
  assert.strictEqual(sig1.suffisant, true, 'Échantillon de taille 3 -> suffisant (seuil atteint)');
  assert.strictEqual(sig1.tailleEchantillon, 3);
  assert.strictEqual(sig1.mediane, 0.0, 'Trié : [-0.01, 0.0, 0.05] -> médiane = valeur du milieu = 0.0');

  // Échantillon pair -> médiane = moyenne des deux valeurs centrales.
  const sig2 = R.signatureDeltaLivraison([0.02, -0.02, 0.04, 0.0]);
  // Trié : [-0.02, 0.0, 0.02, 0.04] -> médiane = (0.0 + 0.02) / 2 = 0.01
  assert.strictEqual(sig2.mediane, 0.01, 'Échantillon pair -> médiane = moyenne des deux valeurs centrales');

  // Robustesse à un delta exceptionnel : un seul outlier extrême ne doit
  // pas déplacer la médiane autant qu'il déplacerait une moyenne classique.
  const sansOutlier = R.signatureDeltaLivraison([0.01, 0.0, -0.01, 0.02, -0.02]);
  const avecOutlier = R.signatureDeltaLivraison([0.01, 0.0, -0.01, 0.02, -0.02, 5.0]);
  assert.strictEqual(sansOutlier.mediane, 0.0, 'Échantillon symétrique sans outlier -> médiane 0.0');
  // Trié avec outlier : [-0.02,-0.01,0,0.01,0.02,5.0] (n=6) -> médiane = (0+0.01)/2 = 0.005,
  // très proche de la médiane sans outlier -> preuve de robustesse (une moyenne aurait explosé).
  assert.ok(Math.abs(avecOutlier.mediane - 0.005) < 1e-9, 'Un outlier extrême ne déplace quasiment pas la médiane (robustesse Article 5)');

  console.log('OK — signatureDeltaLivraison : médiane+MAD, jamais de signature fabriquée sous le seuil minimal, robuste à un delta exceptionnel.');
})();

// ------------------------------------------------------------
// situerFaceSignature — situe un delta ponctuel face à la signature déjà
// calculée, toujours en langage factuel ("dans la normale" / "au-delà de
// l'habituel"), jamais "anormal"/"perte".
// ------------------------------------------------------------
(() => {
  // Pas de signature suffisante -> indéterminé, jamais une conclusion.
  const indetermine = R.situerFaceSignature(0.05, { suffisant: false, tailleEchantillon: 2, mediane: null, dispersion: null });
  assert.strictEqual(indetermine.position, 'indetermine', 'Signature non suffisante -> position indéterminée, jamais une conclusion');
  assert.ok(indetermine.texte.includes('insuffisant'), 'Texte doit expliciter l\'historique insuffisant');

  // ecartRatio null -> indéterminé également (mesure du jour non calculable).
  const signatureOk = { suffisant: true, tailleEchantillon: 12, mediane: 0.0, dispersion: 0.01 };
  assert.strictEqual(R.situerFaceSignature(null, signatureOk).position, 'indetermine', 'Écart du jour non calculable -> indéterminé');

  // Écart proche de la médiane -> normal.
  const normal = R.situerFaceSignature(0.005, signatureOk);
  assert.strictEqual(normal.position, 'normal', 'Écart proche de la médiane du site -> position normale');
  assert.ok(normal.texte.includes('cohérent'), 'Texte doit dire "cohérent" avec le profil habituel');

  // Écart largement au-delà du seuil (dispersion x FACTEUR_DISPERSION_INHABITUEL) -> inhabituel.
  const inhabituel = R.situerFaceSignature(0.5, signatureOk);
  assert.strictEqual(inhabituel.position, 'inhabituel', 'Écart très supérieur au seuil de dispersion -> position inhabituelle');
  assert.ok(inhabituel.texte.includes('au-delà') && inhabituel.texte.includes('manager'), 'Texte doit signaler le dépassement et recommander une vérification manager');
  assert.ok(!inhabituel.texte.toLowerCase().includes('perte') && !inhabituel.texte.toLowerCase().includes('anormal'), 'Jamais "perte"/"anormal" — toujours factuel (Article 5)');

  // Plancher de dispersion : site parfaitement stable (dispersion mesurée à
  // 0) -> le seuil ne doit jamais être nul (PLANCHER_DISPERSION_RATIO).
  const signatureStable = { suffisant: true, tailleEchantillon: 10, mediane: 0.0, dispersion: 0.0 };
  const dansLePlancher = R.situerFaceSignature(0.005, signatureStable); // 0.5% < plancher 1%
  assert.strictEqual(dansLePlancher.position, 'normal', 'Écart sous le plancher de 1 point -> normal même si dispersion mesurée nulle');
  const horsPlancher = R.situerFaceSignature(0.05, signatureStable); // 5% > plancher 1%
  assert.strictEqual(horsPlancher.position, 'inhabituel', 'Écart au-delà du plancher malgré dispersion nulle -> inhabituel, seuil jamais nul');

  console.log('OK — situerFaceSignature : langage toujours factuel, jamais "anormal"/"perte", plancher de dispersion jamais nul.');
})();

// ------------------------------------------------------------
// statistiquesFiabiliteChaine — agrège la qualité des N derniers contrôles
// DÉJÀ posés en pourcentages fiable/provisoire/non_comparable, jamais
// recalculé (Article 11), jamais suffisant sous le seuil (Article 5).
// ------------------------------------------------------------
(() => {
  // Aucun contrôle -> pas de pourcentages fabriqués.
  assert.deepStrictEqual(
    C.statistiquesFiabiliteChaine([]),
    { total: 0, pctFiable: null, pctProvisoire: null, pctNonComparable: null, suffisant: false },
    'Aucun contrôle -> aucun pourcentage fabriqué'
  );
  assert.deepStrictEqual(
    C.statistiquesFiabiliteChaine(null),
    { total: 0, pctFiable: null, pctProvisoire: null, pctNonComparable: null, suffisant: false },
    'controles=null -> traité comme liste vide, jamais une exception'
  );

  // Sous le seuil (SEUIL_HISTORIQUE_CHAINE_SUFFISANT = 10) -> pourcentages
  // calculés mais suffisant=false (le manager ne doit pas en tirer une
  // tendance ferme).
  const courts = Array.from({ length: 5 }, () => ({ qualite: 'fiable' }));
  const statsCourts = C.statistiquesFiabiliteChaine(courts);
  assert.strictEqual(statsCourts.suffisant, false, '5 contrôles (< 10) -> suffisant=false même si tous fiables');
  assert.strictEqual(statsCourts.pctFiable, 1, 'Pourcentage quand même calculé (5/5=1), seul le drapeau "suffisant" change');

  // Au seuil ou au-delà -> suffisant=true, répartition exacte.
  const melange = [
    ...Array.from({ length: 6 }, () => ({ qualite: 'fiable' })),
    ...Array.from({ length: 3 }, () => ({ qualite: 'provisoire' })),
    { qualite: 'non_comparable' },
  ]; // total 10
  const statsMelange = C.statistiquesFiabiliteChaine(melange);
  assert.strictEqual(statsMelange.total, 10);
  assert.strictEqual(statsMelange.suffisant, true, '10 contrôles (== seuil) -> suffisant=true');
  assert.strictEqual(statsMelange.pctFiable, 0.6, '6/10 fiables -> 0.6');
  assert.strictEqual(statsMelange.pctProvisoire, 0.3, '3/10 provisoires -> 0.3');
  assert.strictEqual(statsMelange.pctNonComparable, 0.1, '1/10 non comparable -> 0.1');

  // Entrées null/qualité inconnue dans la liste -> ignorées du comptage
  // (jamais une exception, jamais un déséquilibre silencieux du total).
  const avecTrous = [
    { qualite: 'fiable' }, null, { qualite: 'qualite_inconnue_future' }, { qualite: 'fiable' },
  ];
  const statsAvecTrous = C.statistiquesFiabiliteChaine(avecTrous);
  assert.strictEqual(statsAvecTrous.total, 4, 'Le total reste le nombre de contrôles fournis (dédup par date déjà faite par l\'appelant)');
  assert.strictEqual(statsAvecTrous.pctFiable, 0.5, 'Seules les entrées de qualité reconnue sont comptées au numérateur (2/4 fiables)');

  console.log('OK — statistiquesFiabiliteChaine : pourcentages fiable/provisoire/non_comparable, jamais "suffisant" sous le seuil de 10 (Article 5).');
})();

// ------------------------------------------------------------
// libelleFiabiliteChaine — phrase de lecture manager, jamais une conclusion
// ferme sur un historique encore court, jamais un jugement de performance
// sur le taux de non_comparable (mesure de PREUVE disponible, pas
// d'exploitation du site).
// ------------------------------------------------------------
(() => {
  assert.ok(
    C.libelleFiabiliteChaine({ total: 0, pctFiable: null, pctProvisoire: null, pctNonComparable: null, suffisant: false }).includes('Aucun contrôle'),
    'Aucun contrôle -> phrase neutre, aucune tendance affirmée'
  );

  const courtTxt = C.libelleFiabiliteChaine({ total: 5, pctFiable: 1, pctProvisoire: 0, pctNonComparable: 0, suffisant: false });
  assert.ok(courtTxt.includes('encore court') && courtTxt.includes('5') && courtTxt.includes('10'), 'Historique court -> phrase doit citer le compte actuel et le seuil requis, jamais de tendance affirmée');

  const solideTxt = C.libelleFiabiliteChaine({ total: 12, pctFiable: 1, pctProvisoire: 0, pctNonComparable: 0, suffisant: true });
  assert.ok(solideTxt.includes('100') && solideTxt.includes('solide'), 'Historique suffisant et 100% fiable -> phrase positive avec le pourcentage exact');

  const degradeTxt = C.libelleFiabiliteChaine({ total: 10, pctFiable: 0.6, pctProvisoire: 0.3, pctNonComparable: 0.1, suffisant: true });
  assert.ok(degradeTxt.includes('60') && degradeTxt.includes('40'), 'Historique suffisant mais dégradé -> phrase cite le % fiable et le % provisoire+non comparable cumulé, jamais un jugement de performance');

  console.log('OK — libelleFiabiliteChaine : phrase manager honnête, jamais de tendance affirmée sous le seuil, jamais un jugement de performance sur la preuve disponible.');
})();

console.log('\nTous les tests "Carburants Sprint C7 — Analyse (signature + fiabilité chaîne)" passent.');
