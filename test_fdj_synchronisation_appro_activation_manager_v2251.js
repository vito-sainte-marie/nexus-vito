// Tests unitaires — nexus-fdj-moteur.js :: decisionSynchronisationApproActivation
// (27/08/2026, v2.251)
//
// Origine : Frédéric a demandé, après sa question sur le fonctionnement réel
// d'Appro/Activation ("confirme moi que si je fais la caisse d'un employé en
// FDJ et que je mets dans Appro c'est comme si l'employé activait un
// carnet..."), une "synchronisation métier contrôlée" côté correction
// manager d'un quart passé (NEXUS-FDJ-Manager-v1.html, enregistrerEdition) :
// si l'Appro corrigé correspond exactement à N carnets complets non
// retrouvés en activation, NEXUS doit PROPOSER de créer l'activation
// manquante (jamais automatique) ; si une correction ultérieure remet en
// cause une activation ainsi RECONSTITUÉE, NEXUS doit proposer de
// l'annuler — jamais silencieusement, jamais pour une activation
// directement observée par un employé.
//
// Réutilise TEL QUEL NexusFdjMoteur.reconciliationApproActivation (Article
// 11, v2.222/20-08-2026) — ce fichier couvre uniquement la nouvelle fonction
// de décision, aucune dépendance DOM/Supabase (pure logique).

global.window = global;
const BASE = __dirname + '/';
require(BASE + 'nexus-fdj-moteur.js');

const M = global.NexusFdjMoteur;

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error('ÉCHEC:', label); }
}
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; }
  else { failed++; console.error('ÉCHEC:', label, '— attendu', JSON.stringify(expected), 'obtenu', JSON.stringify(actual)); }
}

// ------------------------------------------------------------
// 1) Cas central de Frédéric : manager corrige l'Appro d'un quart passé à
//    une valeur qui correspond exactement à 1 carnet complet non retrouvé en
//    activation -> proposer de synchroniser.
// ------------------------------------------------------------
{
  const reconciliation = M.reconciliationApproActivation(60, 0, 60); // 60 tickets, 0 activés, carnet de 60
  assertEqual(reconciliation.etat, 'appro_non_couvert', 'reconciliation : 60 tickets sans aucune activation -> appro_non_couvert');
  const decision = M.decisionSynchronisationApproActivation(reconciliation, []);
  assertEqual(decision, { action: 'proposer_synchronisation', carnets: 1 }, 'decisionSynchronisationApproActivation : 1 carnet manquant -> propose la synchronisation');
}

// ------------------------------------------------------------
// 2) Plusieurs carnets manquants à la fois (appro correspond à 2 carnets, 0
//    activés) -> propose la synchronisation pour les 2 carnets.
// ------------------------------------------------------------
{
  const reconciliation = M.reconciliationApproActivation(120, 0, 60);
  const decision = M.decisionSynchronisationApproActivation(reconciliation, []);
  assertEqual(decision, { action: 'proposer_synchronisation', carnets: 2 }, 'decisionSynchronisationApproActivation : 2 carnets manquants -> propose la synchronisation pour les 2');
}

// ------------------------------------------------------------
// 3) Correction ultérieure qui remet en cause une activation RECONSTITUÉE
//    (methode_identification='reconstituee_correction_manager') -> propose
//    l'annulation, jamais une suppression silencieuse.
// ------------------------------------------------------------
{
  // Appro recorrigé à 0 (plus aucun ticket), mais 1 carnet reste activé —
  // et cette activation est celle-là même reconstituée précédemment par une
  // correction manager (cas exact décrit par Frédéric : "si tu corriges plus
  // tard l'Appro à la baisse...").
  const reconciliation = M.reconciliationApproActivation(0, 1, 60);
  // appro=0 -> reconciliationApproActivation traite ce cas comme
  // 'aucun_ecart' par construction (appro<=0 systématiquement neutre, voir
  // sa propre documentation) : le scénario réel de Frédéric correspond donc
  // plutôt à un appro corrigé à une valeur NON NULLE mais inférieure au
  // nombre de carnets déjà activés (ex. 0 carnet justifié par l'appro, 1
  // carnet reste activé) — reproduit ci-dessous avec un appro non nul très
  // inférieur au conditionnement d'un carnet complet ne s'applique pas non
  // plus (appro_non_multiple). Le cas représentatif est : appro corrigé à
  // une valeur couvrant 0 carnet PARMI un conditionnement connu, avec des
  // carnets déjà activés au-delà de ce que l'appro justifie désormais.
  assertEqual(reconciliation.etat, 'aucun_ecart', 'appro=0 -> aucun_ecart par construction (comportement existant, non modifié)');

  // Cas représentatif réel : appro corrigé de 120 (2 carnets) à 60 (1
  // carnet), alors que 2 carnets sont actuellement activés pour ce quart —
  // 1 de trop, et ce carnet en trop est celui reconstitué par une
  // correction manager précédente.
  const reconciliation2 = M.reconciliationApproActivation(60, 2, 60);
  assertEqual(reconciliation2.etat, 'appro_en_exces', 'appro recorrigé en dessous des carnets déjà activés -> appro_en_exces');
  const mouvementsQuart = [
    { methode_identification: 'quantite', quantite: 1 }, // 1 carnet activé en direct par l'employé, jamais remis en cause
    { methode_identification: 'reconstituee_correction_manager', quantite: 1 }, // 1 carnet reconstitué par une correction manager précédente
  ];
  const decision = M.decisionSynchronisationApproActivation(reconciliation2, mouvementsQuart);
  assertEqual(decision, { action: 'proposer_annulation', carnetsReconstitues: 1 }, 'decisionSynchronisationApproActivation : excédent couvert par une activation reconstituée -> propose son annulation, plafonnée à l\'écart réel');
}

// ------------------------------------------------------------
// 4) Excédent entièrement porté par une activation DIRECTEMENT OBSERVÉE par
//    un employé (aucune activation reconstituée en jeu) -> jamais de
//    proposition d'annulation automatique, seulement un signalement passif
//    (même comportement que l'existant côté employé, verifierReconciliation
//    ApproActivation).
// ------------------------------------------------------------
{
  const reconciliation = M.reconciliationApproActivation(60, 2, 60); // appro=1 carnet, 2 carnets réellement activés
  const mouvementsQuart = [
    { methode_identification: 'quantite', quantite: 1 },
    { methode_identification: 'implicite_appro', quantite: 1 }, // déduit à la clôture du même quart par l'employé, jamais par une correction manager
  ];
  const decision = M.decisionSynchronisationApproActivation(reconciliation, mouvementsQuart);
  assertEqual(decision, { action: 'signaler_ecart_direct' }, 'excédent entièrement porté par des activations directement observées -> jamais remis en cause automatiquement, seulement signalé');
}

// ------------------------------------------------------------
// 5) Plafonnement : l'annulation proposée ne dépasse jamais l'écart réel,
//    même si la quantité reconstituée disponible est supérieure.
// ------------------------------------------------------------
{
  const reconciliation = M.reconciliationApproActivation(60, 3, 60); // appro=1 carnet, 3 activés -> écart de 2
  const mouvementsQuart = [
    { methode_identification: 'reconstituee_correction_manager', quantite: 5 }, // reconstitution historique plus grande que l'écart actuel
  ];
  const decision = M.decisionSynchronisationApproActivation(reconciliation, mouvementsQuart);
  assertEqual(decision, { action: 'proposer_annulation', carnetsReconstitues: 2 }, 'l\'annulation proposée est plafonnée à l\'écart réel (2), jamais à la reconstitution historique totale (5)');
}

// ------------------------------------------------------------
// 6) Aucun écart, ou conditionnement inconnu -> aucune action (jamais une
//    activation devinée ni un signalement fabriqué, Article 5).
// ------------------------------------------------------------
{
  const aucunEcart = M.reconciliationApproActivation(60, 1, 60);
  assertEqual(M.decisionSynchronisationApproActivation(aucunEcart, []), { action: 'aucune' }, 'aucun écart -> aucune action');

  const conditionnementInconnu = M.reconciliationApproActivation(60, 0, null);
  assertEqual(M.decisionSynchronisationApproActivation(conditionnementInconnu, []), { action: 'aucune' }, 'conditionnement inconnu -> aucune action, jamais une activation devinée');

  assertEqual(M.decisionSynchronisationApproActivation(null, []), { action: 'aucune' }, 'reconciliation absente -> aucune action, jamais un plantage');
}

console.log(`\n${passed}/${passed + failed} tests passés — decisionSynchronisationApproActivation (v2.251).`);
if (failed) process.exit(1);
