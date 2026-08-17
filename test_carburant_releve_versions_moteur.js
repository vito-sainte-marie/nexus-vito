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

// ------------------------------------------------------------
// controleInchange — Sprint C5 "Robustesse" (audit §12, scénario de test
// C16 : "Recalcul relancé deux fois -> Aucun doublon"). Empêche
// enregistrerControleDate de poser une nouvelle version carburant_controles
// à chaque relance d'un recalcul en cascade qui ne change rien au contenu.
// ------------------------------------------------------------
(() => {
  const base = {
    reference_date: '2026-08-14', reference_type: 'point_zero',
    theorique: 11500, physique: 11480, ecart: -20, ventes: 480, livraison: 0, mouvement: 0,
    qualite: 'fiable', cause: null,
  };

  // Aucun contrôle existant -> jamais "inchangé" (il faut bien poser la
  // toute première version), même si le nouveau contenu ressemble à un
  // objet "vide".
  assert.strictEqual(M.controleInchange(null, base), false, 'Aucun contrôle antérieur -> jamais inchangé, la première version doit toujours être posée');

  // Contenu strictement identique -> inchangé, pas de nouvelle version.
  assert.strictEqual(M.controleInchange({ ...base }, { ...base }), true, 'Contenu identique -> inchangé (scénario C16 : relance sans effet -> aucun doublon)');

  // Un seul champ numérique diffère (nouvel écart recalculé) -> changé.
  assert.strictEqual(M.controleInchange({ ...base }, { ...base, ecart: -25 }), false, 'Écart différent -> changé, nouvelle version légitime');

  // Écart flottant négligeable (arrondi/precision) sous l'epsilon -> traité
  // comme inchangé, jamais un doublon "silencieux" causé par une imprécision
  // de calcul flottant.
  assert.strictEqual(M.controleInchange({ ...base, theorique: 11500.0000001 }, { ...base, theorique: 11500.0000002 }), true, 'Écart infinitésimal (bruit flottant) -> toujours considéré comme inchangé');

  // qualite ou cause différente (ex. redevenu comparable) -> changé.
  assert.strictEqual(M.controleInchange({ ...base, qualite: 'non_comparable', cause: 'ventes_indisponibles' }, base), false, 'Qualité de chaîne différente -> changé');

  // reference_date/reference_type différents (nouvelle ancre) -> changé.
  assert.strictEqual(M.controleInchange({ ...base }, { ...base, reference_date: '2026-08-16', reference_type: 'releve' }), false, 'Référence (date/type) différente -> changé');

  console.log('OK — controleInchange : relance d\'un recalcul en cascade sans changement de contenu -> aucune nouvelle version (scénario C16, audit §12).');
})();

// ------------------------------------------------------------
// libelleQualiteControle — Sprint C6 "Pilotage" (17/08/2026, audit §10) :
// badge de qualité par carburant, consommé directement depuis
// carburant_controles (jamais recalculé à l'écran, Article 11). non_
// comparable -> niveau 'attente' (neutre), jamais 'alerte' (Article 5 :
// absence de preuve ≠ problème opérationnel).
// ------------------------------------------------------------
(() => {
  assert.deepStrictEqual(M.libelleQualiteControle('fiable'), { texte: 'Fiable', niveau: 'ok' }, 'fiable -> niveau ok');
  assert.deepStrictEqual(M.libelleQualiteControle('provisoire'), { texte: 'Provisoire', niveau: 'attention' }, 'provisoire -> niveau attention');
  assert.deepStrictEqual(M.libelleQualiteControle('non_comparable'), { texte: 'Non comparable', niveau: 'attente' }, 'non_comparable -> niveau attente (neutre), jamais alerte (Article 5)');
  assert.deepStrictEqual(M.libelleQualiteControle(null), { texte: 'Non calculé', niveau: 'attente' }, 'Aucun contrôle -> "Non calculé", jamais une exception');
  assert.deepStrictEqual(M.libelleQualiteControle('valeur_inconnue'), { texte: 'Non calculé', niveau: 'attente' }, 'Valeur inconnue -> repli neutre, jamais une exception');
  console.log('OK — libelleQualiteControle : badge par carburant fidèle à carburant_controles.qualite, jamais recalculé (Article 11), non_comparable toujours neutre (Article 5).');
})();

// ------------------------------------------------------------
// construireMessagesPilotage — extension Sprint C6 (audit §10, "Ce que
// NEXUS vous dit" doit inclure les contrôles non fiables et les événements
// de réception, plafonné à 3 messages).
// ------------------------------------------------------------
(() => {
  // Un contrôle non_comparable sur un seul carburant -> message dédié,
  // texte de cause inclus, jamais un doublon de la ligne "écart" (qui reste
  // silencieuse ici puisque parCarburant n'est pas fourni dans ce cas).
  const msgsNonComparable = M.construireMessagesPilotage({
    parCarburant: null,
    derniersControles: { go: { qualite: 'non_comparable', cause: 'reference_absente' }, sp95: { qualite: 'fiable', cause: null }, gnr: null },
  });
  assert.strictEqual(msgsNonComparable.length, 1, 'Un seul carburant non fiable (les 2 autres fiable/absent) -> un seul message qualité');
  assert.ok(msgsNonComparable[0].texte.includes('GO') && msgsNonComparable[0].texte.includes('non comparable'), 'Message qualité GO doit nommer le carburant et "non comparable"');
  assert.strictEqual(msgsNonComparable[0].type, 'attention', 'Contrôle non fiable -> type attention (jamais alerte, Article 5)');

  // Tous les contrôles fiables -> aucun message qualité (pas de bruit).
  const msgsToutFiable = M.construireMessagesPilotage({
    parCarburant: null,
    derniersControles: { go: { qualite: 'fiable', cause: null }, sp95: { qualite: 'fiable', cause: null }, gnr: { qualite: 'fiable', cause: null } },
  });
  assert.deepStrictEqual(msgsToutFiable, [{ type: 'positif', texte: 'Situation carburants sous contrôle aujourd\'hui.' }], 'Tous les contrôles fiables, aucun autre signal -> message neutre positif par défaut, aucun bruit qualité');

  // Visite conclue avec dérogation manager -> message dédié mentionnant la
  // date et renvoyant vers le relevé de réception.
  const msgsDerogation = M.construireMessagesPilotage({
    parCarburant: null,
    derniereVisite: { statut: 'terminee_avec_derogation', date_visite: '2026-08-16' },
  });
  assert.strictEqual(msgsDerogation.length, 1, 'Dérogation manager seule -> un seul message');
  assert.ok(msgsDerogation[0].texte.includes('16/08/2026') && msgsDerogation[0].texte.includes('dérogation'), 'Message dérogation doit citer la date et le mot "dérogation"');

  // Visite terminée normalement (sans dérogation) -> aucun message ajouté.
  const msgsSansDerogation = M.construireMessagesPilotage({
    parCarburant: null,
    derniereVisite: { statut: 'terminee', date_visite: '2026-08-16' },
  });
  assert.deepStrictEqual(msgsSansDerogation, [{ type: 'positif', texte: 'Situation carburants sous contrôle aujourd\'hui.' }], 'Visite terminée sans dérogation -> aucun message dérogation, aucun bruit');

  // Plafond de 3 messages (audit §10, "max 3 messages") même quand qualité
  // + réception + écarts + autonomie cumulent plus de signaux.
  const msgsPlafond = M.construireMessagesPilotage({
    derniersControles: { go: { qualite: 'non_comparable', cause: 'reference_absente' }, sp95: { qualite: 'provisoire', cause: 'mouvement_exceptionnel_sans_motif' }, gnr: { qualite: 'fiable', cause: null } },
    derniereVisite: { statut: 'terminee_avec_derogation', date_visite: '2026-08-16' },
    parCarburant: {
      go: { statut: 'À corriger', ecart: -1200, ecartRatio: -0.08 },
      sp95: { statut: 'À surveiller', ecart: 400, ecartRatio: 0.03 },
      gnr: { statut: 'OK', ecart: 10, ecartRatio: 0.001 },
    },
  });
  assert.strictEqual(msgsPlafond.length, 3, 'Cumul de signaux qualité + réception + écarts -> toujours plafonné à 3 messages (jamais un manager submergé)');

  console.log('OK — construireMessagesPilotage (C6) : contrôles non fiables et dérogation réception remontent en messages "Ce que NEXUS vous dit", toujours plafonné à 3 (audit §10).');
})();

console.log('\nTous les tests "Carburants — chaîne de preuve (Sprints C1-C6)" passent.');
