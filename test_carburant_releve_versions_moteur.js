// Test — Carburants Sprint C1 "Preuve" (17/08/2026, NEXUS_Audit_Carburants_
// Chaine_Preuve_Developpeur.pdf, cadrage développeur transmis par Frédéric
// le 16/08/2026) : fonctions pures du moteur pour la chaîne de preuve du
// relevé carburant (carburant_releves = vue courante, carburant_releve_
// versions = preuve append-only — même discipline que la Trace de contrôle
// FDJ, fdj_releves_cloture v2.116-v2.119).
//
// Consomme le vrai nexus-carburant-moteur.js (require() direct, aucune
// réécriture des fonctions testées). Chemin relatif à __dirname (même
// convention que les tests FDJ depuis la sécurisation structurelle du
// 16/08/2026 — exécutable depuis n'importe quel emplacement sur le disque).

const assert = require('assert');

require(__dirname + '/nexus-carburant-moteur.js');
const M = global.NexusCarburantMoteur;

// ------------------------------------------------------------
// prochaineVersionReleveCarburant — jamais déduit d'un compteur local,
// toujours du relevé courant déjà en base (ou son absence).
// ------------------------------------------------------------
(() => {
  const premiere = M.prochaineVersionReleveCarburant(null);
  assert.deepStrictEqual(premiere, { versionNum: 1, typeVersion: 'saisie_initiale' }, 'Aucun relevé existant -> version 1, saisie_initiale');

  const correction = M.prochaineVersionReleveCarburant({ version_num: 1 });
  assert.deepStrictEqual(correction, { versionNum: 2, typeVersion: 'correction_manager' }, 'Relevé existant version 1 -> version 2, correction_manager');

  const correctionSuivante = M.prochaineVersionReleveCarburant({ version_num: 4 });
  assert.deepStrictEqual(correctionSuivante, { versionNum: 5, typeVersion: 'correction_manager' }, 'Relevé existant version 4 -> version 5, correction_manager');

  // version_num absent/invalide sur un relevé pourtant existant (donnée
  // historique antérieure à la migration) -> traité comme version 1,
  // jamais une exception qui bloquerait la correction.
  const versionManquante = M.prochaineVersionReleveCarburant({});
  assert.deepStrictEqual(versionManquante, { versionNum: 2, typeVersion: 'correction_manager' }, 'version_num absent sur un relevé existant -> traité comme 1, prochaine = 2');

  console.log('OK — prochaineVersionReleveCarburant : version_num et type_version dépendent uniquement du relevé courant déjà en base.');
})();

// ------------------------------------------------------------
// diffReleveCarburant — reproduit le principe de diffClotureFdj (nexus-fdj-
// moteur.js) : diff minimal, jamais bruyant, jamais de diff vide trompeur.
// ------------------------------------------------------------
(() => {
  // Pas de précédent (première saisie) -> jamais de diff (baseline).
  assert.strictEqual(M.diffReleveCarburant(null, { stock_reel_go_cuve1: 12000 }), null, 'Aucun relevé précédent -> pas de diff (baseline)');

  // Rien n'a changé -> pas de diff (plan de tests audit, scénario C09 :
  // "Correction sans changement de valeur -> Pas de nouvelle version inutile").
  const identique = {
    stock_reel_go_cuve1: 12000, stock_reel_go_cuve2: 6000, stock_reel_sp95: 8000, stock_reel_gnr: 4000,
    livraison_go: 0, livraison_sp95: 0, livraison_gnr: 0,
    mouvement_go: 0, mouvement_sp95: 0, mouvement_gnr: 0,
    motif_mouvement: null, commentaire: null,
  };
  assert.strictEqual(M.diffReleveCarburant(identique, { ...identique }), null, 'Snapshots identiques -> aucun diff');

  // Correction d'un jaugeage historique (audit, scénario C08) : original
  // conservé (c'est le rôle de precedent, jamais réécrit par cette
  // fonction), diff minimal et ciblé sur le seul champ modifié.
  const avant = { ...identique, stock_reel_go_cuve1: 12000 };
  const apres = { ...identique, stock_reel_go_cuve1: 11500 };
  const diff = M.diffReleveCarburant(avant, apres);
  assert.deepStrictEqual(diff, { stock_reel_go_cuve1: { avant: 12000, apres: 11500 } }, 'Un seul champ modifié -> diff limité à ce champ, aucun bruit');

  // Plusieurs champs modifiés à la fois (jaugeage + livraison ajoutée).
  const avant2 = { ...identique };
  const apres2 = { ...identique, stock_reel_sp95: 7800, livraison_go: 15000, commentaire: 'Livraison arrivée après le jaugeage initial' };
  const diff2 = M.diffReleveCarburant(avant2, apres2);
  assert.deepStrictEqual(diff2, {
    stock_reel_sp95: { avant: 8000, apres: 7800 },
    livraison_go: { avant: 0, apres: 15000 },
    commentaire: { avant: null, apres: 'Livraison arrivée après le jaugeage initial' },
  }, 'Plusieurs champs modifiés -> diff couvre exactement ces champs, rien d\'autre');

  console.log('OK — diffReleveCarburant : diff minimal et ciblé, null si rien n\'a changé (scénario C09), jamais de bruit sur les champs inchangés.');
})();

// ------------------------------------------------------------
// qualiteChaineCarburant — Sprint C2 "Contrôle" (audit §6, "NEXUS ne doit
// jamais afficher une perte ou un gain comme réel tant que la
// comparabilité de la chaine n'est pas démontrée"). Chaque cas du plan de
// tests métier de l'audit qui est honnêtement détectable avec la
// granularité actuelle (dates, pas d'horodatage précis).
// ------------------------------------------------------------
(() => {
  // C01 — Point zéro à ouverture -> toujours fiable, écart 0 par construction.
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: true, reelDuJour: 12000, ventes: 0, mouvement: 0, commentaire: null }),
    { qualite: 'fiable', cause: null },
    'C01 — Référence certifiée ce jour -> toujours fiable'
  );

  // Aucun relevé antérieur (première mesure) -> non_comparable, cause explicite.
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: false, dernierReel: null, referenceCertifieeCeJour: false, reelDuJour: 12000, ventes: 500, mouvement: 0, commentaire: null }),
    { qualite: 'non_comparable', cause: 'reference_absente' },
    'Aucune référence antérieure -> non_comparable/reference_absente'
  );

  // Référence existe mais incomplète pour ce carburant (ex. une cuve GO non
  // jaugée) -> non_comparable, jamais un théorique bricolé sur une donnée
  // partielle.
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: null, referenceCertifieeCeJour: false, reelDuJour: 12000, ventes: 500, mouvement: 0, commentaire: null }),
    { qualite: 'non_comparable', cause: 'reference_incomplete' },
    'Référence incomplète -> non_comparable/reference_incomplete'
  );

  // Mesure du jour manquante -> non_comparable (donnée critique absente,
  // audit §6.1).
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: false, reelDuJour: null, ventes: 500, mouvement: 0, commentaire: null }),
    { qualite: 'non_comparable', cause: 'mesure_finale_absente' },
    'Mesure finale absente -> non_comparable/mesure_finale_absente'
  );

  // C02 — ventes après point zéro, pas de livraison -> théorique baisse,
  // qualité fiable dès que toutes les données sont là (pas de mouvement).
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: false, reelDuJour: 11500, ventes: 480, mouvement: 0, commentaire: null }),
    { qualite: 'fiable', cause: null },
    'C02 — toutes les données présentes, aucun mouvement -> fiable'
  );

  // Ventes non disponibles -> non_comparable (théorique non calculable,
  // jamais un écart affiché comme réel).
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: false, reelDuJour: 11500, ventes: null, mouvement: 0, commentaire: null }),
    { qualite: 'non_comparable', cause: 'ventes_indisponibles' },
    'Ventes indisponibles -> non_comparable/ventes_indisponibles'
  );

  // Mouvement exceptionnel saisi SANS motif documenté (commentaire vide) —
  // audit §6.1 "Mouvement exceptionnel non documenté" -> provisoire,
  // jamais non_comparable (le théorique reste calculable) ni fiable
  // (silencieux sur un mouvement non expliqué).
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: false, reelDuJour: 26500, ventes: 480, mouvement: 15000, commentaire: null }),
    { qualite: 'provisoire', cause: 'mouvement_exceptionnel_sans_motif' },
    'Mouvement exceptionnel sans commentaire -> provisoire/mouvement_exceptionnel_sans_motif'
  );

  // Même mouvement, mais documenté (commentaire renseigné) -> fiable.
  assert.deepStrictEqual(
    M.qualiteChaineCarburant({ referenceExiste: true, dernierReel: 12000, referenceCertifieeCeJour: false, reelDuJour: 26500, ventes: 480, mouvement: 15000, commentaire: 'Livraison de 15000L reçue le matin même, avant jaugeage' }),
    { qualite: 'fiable', cause: null },
    'Mouvement exceptionnel documenté (commentaire renseigné) -> fiable'
  );

  console.log('OK — qualiteChaineCarburant : fiable/provisoire/non_comparable avec cause explicite, jamais un écart affiché comme réel sur une chaîne non comparable (règle absolue, audit §2).');
})();

// ------------------------------------------------------------
// libelleCauseQualiteChaine — une phrase par cause, jamais un code brut
// affiché au manager, jamais d'exception sur une cause inconnue.
// ------------------------------------------------------------
(() => {
  assert.strictEqual(typeof M.libelleCauseQualiteChaine('reference_absente'), 'string', 'reference_absente a un libellé');
  assert.strictEqual(typeof M.libelleCauseQualiteChaine('mouvement_exceptionnel_sans_motif'), 'string', 'mouvement_exceptionnel_sans_motif a un libellé');
  assert.strictEqual(M.libelleCauseQualiteChaine('cause_inconnue_future'), null, 'Cause inconnue -> null, jamais une exception');
  assert.strictEqual(M.libelleCauseQualiteChaine(null), null, 'Aucune cause (qualité fiable) -> null');
  console.log('OK — libelleCauseQualiteChaine : une phrase par cause connue, null sinon, jamais une exception.');
})();

// ------------------------------------------------------------
// resoudreAncreCarburant — Sprint C3 "Recalcul en cascade" (17/08/2026) :
// extraite de l'écran (initialisation + reconstruireControlesSuivants)
// pour n'avoir qu'une seule vérité de résolution d'ancre, désormais
// testable indépendamment du DOM/Supabase.
// ------------------------------------------------------------
(() => {
  // Aucun relevé, aucun point zéro -> pas d'ancre du tout.
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: null, pointZero: null, date: '2026-08-17' }),
    { historiqueNonFiable: false, ancreEstPointZero: false, dateAncre: null, referenceCertifieeCeJour: false },
    'Aucune référence -> pas d\'ancre, jamais un historique déclaré non fiable à tort'
  );

  // Dernier relevé seul (pas de point zéro) -> ancre = ce relevé.
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: { date: '2026-08-15' }, pointZero: null, date: '2026-08-16' }),
    { historiqueNonFiable: false, ancreEstPointZero: false, dateAncre: '2026-08-15', referenceCertifieeCeJour: false },
    'Dernier relevé sans point zéro -> ancre = dernier relevé'
  );

  // Point zéro plus récent que le dernier relevé -> devient l'ancre (plancher).
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: { date: '2026-08-10' }, pointZero: { date: '2026-08-14' }, date: '2026-08-16' }),
    { historiqueNonFiable: false, ancreEstPointZero: true, dateAncre: '2026-08-14', referenceCertifieeCeJour: false },
    'Point zéro plus récent que le dernier relevé -> devient l\'ancre'
  );

  // Relevé réel POSTÉRIEUR au point zéro -> redevient l'ancre normale (le
  // point zéro n'est qu'un plancher, jamais une ancre permanente).
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: { date: '2026-08-15' }, pointZero: { date: '2026-08-14' }, date: '2026-08-16' }),
    { historiqueNonFiable: false, ancreEstPointZero: false, dateAncre: '2026-08-15', referenceCertifieeCeJour: false },
    'Relevé réel postérieur au point zéro -> redevient l\'ancre, le point zéro n\'est qu\'un plancher'
  );

  // Date antérieure au point zéro -> historique non fiable, aucun théorique
  // qualifié sur cette période (Article 5).
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: { date: '2026-08-10' }, pointZero: { date: '2026-08-14' }, date: '2026-08-12' }),
    { historiqueNonFiable: true, ancreEstPointZero: false, dateAncre: null, referenceCertifieeCeJour: false },
    'Date antérieure au point zéro -> historique non fiable'
  );

  // Le jour EXACT de la certification -> référence certifiée ce jour (pas
  // un historique non fiable, jamais un panneau vide).
  assert.deepStrictEqual(
    NexusCarburantMoteur.resoudreAncreCarburant({ dernierReleve: { date: '2026-08-10' }, pointZero: { date: '2026-08-14' }, date: '2026-08-14' }),
    { historiqueNonFiable: false, ancreEstPointZero: true, dateAncre: '2026-08-14', referenceCertifieeCeJour: true },
    'Jour exact de la certification -> référence certifiée ce jour'
  );

  console.log('OK — resoudreAncreCarburant : même résolution d\'ancre en initialisation d\'écran et en recalcul en cascade, jamais deux logiques divergentes (Article 11).');
})();

console.log('\nTous les tests "Carburants — chaîne de preuve (Sprints C1-C3)" passent.');
