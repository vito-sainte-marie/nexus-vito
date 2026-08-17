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

console.log('\nTous les tests "Carburants — chaîne de preuve (Sprint C1)" passent.');
