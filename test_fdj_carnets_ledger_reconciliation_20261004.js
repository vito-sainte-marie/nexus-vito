// Tests unitaires — nexus-fdj-moteur.js :: NexusFdjMoteur.soldesCarnetsAvecReference
// et NexusFdjMoteur.ecartsReferenceLignes (04/10/2026)
//
// Origine : issue #28, réveil Orchestrateur « PRIORITÉ FDJ — ANOMALIE
// POTENTIELLE INVENTAIRE / MOUVEMENTS DES CARNETS ». Constat terrain :
// l'inventaire et les mouvements des carnets FDJ paraissent incohérents.
//
// soldesCarnetsAvecReference est la seule source de vérité du stock de
// carnets confiés/activés/non-activés — consommée par l'écran employé
// (NEXUS-FDJ-v1.html), l'écran manager (NEXUS-FDJ-Manager-v1.html, État du
// stock), l'Analyse (NEXUS-FDJ-Analyse-v1.html), le Brief
// (nexus-brief-donnees.js) et le Coach FDJ (nexus-coach-fdj-donnees.js).
// Avant ce fichier, elle n'avait AUCUNE couverture de test : c'est ce qui a
// laissé vivre, depuis le 27/08/2026 (ajout de
// creerActivationReconstitueeCorrectionManager), un vrai bug sur le type de
// mouvement 'correction' (voir cas 6 ci-dessous).
//
// Couvre la matrice minimale demandée par le réveil : réception→stock,
// affectation(transfert)→mouvement, transfert→aucune duplication,
// retour→réintégration, retrait(blocage)→sortie, correction→contre-écriture,
// réconciliation saine→écart 0, anomalie volontaire→divergence détectée.
// (La répétition→idempotence relève du serveur — unique index Postgres sur
// idempotency_key, hors de ce qu'une fonction pure peut exercer ; voir le
// retour canonique du lot pour le constat précis sur les 6 écritures
// manager qui n'envoient aujourd'hui aucune clé.)

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

const LOC = { caisse: 'caisse-1', bureau: 'bureau-1', bloque: 'bloque-1' };
const GAME = 'jeu-1';

function mouvement(partial) {
  return Object.assign({ game_id: GAME, location_source_id: null, location_destination_id: null }, partial);
}

// ------------------------------------------------------------
// 1) RÉCEPTION → STOCK. Transporteur → Bureau : le bureau augmente,
//    aucun autre compteur ne bouge (Article 5 : une réception n'active
//    rien, ne confie rien à la caisse).
// ------------------------------------------------------------
{
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];
  assertEqual(soldes, { bureau: 20, confies: 0, actives: 0, bloques: 0, nonActives: 0 }, 'réception → bureau seul augmente');
}

// ------------------------------------------------------------
// 2) AFFECTATION (transfert Bureau → Caisse) → MOUVEMENT. Le bureau
//    diminue exactement de ce que la caisse (confiés) reçoit — jamais un
//    carnet créé ou perdu dans le déplacement.
// ------------------------------------------------------------
{
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'transfert', quantite: 8, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];
  assertEqual(soldes, { bureau: 12, confies: 8, actives: 0, bloques: 0, nonActives: 8 }, 'transfert bureau→caisse : bureau -8, confiés +8');
}

// ------------------------------------------------------------
// 3) TRANSFERT → AUCUNE DUPLICATION. Le total (bureau + confiés + bloqués)
//    reste constant à travers un transfert, quel que soit son sens — un
//    déplacement ne crée ni ne détruit de carnet. Invariant de
//    conservation, vérifié indépendamment du calcul détaillé du cas 2.
// ------------------------------------------------------------
{
  const avant = [
    mouvement({ type_mouvement: 'reception', quantite: 30, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
  ];
  const totalAvant = (s => s.bureau + s.confies + s.bloques)(M.soldesCarnetsAvecReference(avant, LOC, null)[GAME]);
  const apres = avant.concat([
    mouvement({ type_mouvement: 'transfert', quantite: 11, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
  ]);
  const totalApres = (s => s.bureau + s.confies + s.bloques)(M.soldesCarnetsAvecReference(apres, LOC, null)[GAME]);
  assertEqual(totalApres, totalAvant, 'transfert : bureau+confiés+bloqués invariant, aucun carnet dupliqué ni perdu');
}

// ------------------------------------------------------------
// 4) RETOUR → RÉINTÉGRATION. Deux variantes réelles (Caisse → Bureau et
//    Zone bloquée → Bureau ou Caisse) — chacune réintègre exactement sa
//    quantité à destination, jamais une activation.
// ------------------------------------------------------------
{
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'retour', quantite: 3, location_source_id: LOC.caisse, location_destination_id: LOC.bureau, created_at: '2026-01-01T10:00:00Z' }),
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];
  assertEqual(soldes, { bureau: 13, confies: 7, actives: 0, bloques: 0, nonActives: 7 }, 'retrait caisse→bureau : confiés -3, bureau +3, aucune activation touchée');
}
{
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'blocage', quantite: 5, location_source_id: LOC.bureau, location_destination_id: LOC.bloque, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'retour', quantite: 5, location_source_id: LOC.bloque, location_destination_id: LOC.bureau, created_at: '2026-01-01T10:00:00Z' }),
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];
  assertEqual(soldes, { bureau: 20, confies: 0, actives: 0, bloques: 0, nonActives: 0 }, 'retour bloqué→bureau : bloqués revient à 0, bureau revient à son niveau initial');
}

// ------------------------------------------------------------
// 5) RETRAIT (blocage) → SORTIE. Un blocage retire le stock disponible
//    (bureau ou caisse) sans jamais l'activer — "NEXUS ne modifie jamais
//    un stock sans un fait déclaré", mais ce fait ne doit jamais se
//    traduire par une vente.
// ------------------------------------------------------------
{
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'blocage', quantite: 4, location_source_id: LOC.caisse, location_destination_id: LOC.bloque, created_at: '2026-01-01T10:00:00Z' }),
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];
  assertEqual(soldes, { bureau: 10, confies: 6, actives: 0, bloques: 4, nonActives: 6 }, 'blocage caisse→bloqué : confiés -4, bloqués +4, actives inchangé (jamais une vente)');
}

// ------------------------------------------------------------
// 6) CORRECTION → CONTRE-ÉCRITURE, JAMAIS UNE RÉÉCRITURE DE L'HISTOIRE.
//    Reproduit exactement le bug trouvé le 04/10/2026 : un manager
//    reconstitue à tort l'activation de 2 carnets sur un quart passé
//    (creerActivationReconstitueeCorrectionManager, quantite positive),
//    puis l'annule (même fonction, quantite négative). AVANT correctif,
//    l'annulation ne touchait jamais `actives` (l'activation fautive
//    restait comptée pour toujours) et décrémentait `confies` à tort
//    (comme si des carnets avaient physiquement quitté la caisse, alors
//    qu'aucun déplacement n'a lieu — source = destination = caisse dans
//    les deux écritures). Les deux mouvements originaux restent dans le
//    ledger (append-only, jamais supprimés) : le test les garde tous les
//    deux et vérifie que leur SOMME retombe exactement sur l'état d'avant
//    la reconstitution erronée — une contre-écriture, pas un effacement.
// ------------------------------------------------------------
{
  const avantErreur = [
    mouvement({ type_mouvement: 'reception', quantite: 20, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 3, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, created_at: '2026-01-01T10:00:00Z' }),
  ];
  const etatAttendu = { bureau: 10, confies: 10, actives: 3, bloques: 0, nonActives: 7 };
  assertEqual(M.soldesCarnetsAvecReference(avantErreur, LOC, null)[GAME], etatAttendu, 'état de référence avant toute reconstitution erronée');

  const reconstitutionErronee = avantErreur.concat([
    mouvement({ type_mouvement: 'activation', quantite: 2, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, methode_identification: 'reconstituee_correction_manager', created_at: '2026-01-05T00:00:00Z' }),
  ]);
  assertEqual(
    M.soldesCarnetsAvecReference(reconstitutionErronee, LOC, null)[GAME],
    { bureau: 10, confies: 10, actives: 5, bloques: 0, nonActives: 5 },
    'reconstitution erronée (+2) : actives augmente, confiés inchangé — aucun carnet n\'a physiquement bougé'
  );

  const apresAnnulation = reconstitutionErronee.concat([
    mouvement({ type_mouvement: 'correction', quantite: -2, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, methode_identification: 'reconstituee_correction_manager', created_at: '2026-01-05T00:05:00Z' }),
  ]);
  assertEqual(
    M.soldesCarnetsAvecReference(apresAnnulation, LOC, null)[GAME],
    etatAttendu,
    'LE BUG : correction (-2) doit annuler exactement l\'activation fautive — retombe sur l\'état de référence, pas sur confiés décrémenté à tort'
  );
  assert(apresAnnulation.length === 5, 'contre-écriture : les 5 mouvements (dont les 2 erronés) restent tous dans le ledger, rien n\'est supprimé');
}

// Même garantie sur soldesCarnetsParJeu — la fonction V1, non appelée par
// aucun écran aujourd'hui (vérifié par recherche dans tout le dépôt), mais
// toujours exportée : la laisser diverger de soldesCarnetsAvecReference sur
// le même type de mouvement reproduirait le bug si elle était un jour
// réutilisée (Article 11 : une seule vérité, jamais deux implémentations
// qui répondent différemment à la même question).
{
  const mvts = [
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 3, created_at: '2026-01-01T10:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 2, created_at: '2026-01-05T00:00:00Z' }),
    mouvement({ type_mouvement: 'correction', quantite: -2, created_at: '2026-01-05T00:05:00Z' }),
  ];
  assertEqual(M.soldeCarnetsJeu(mvts, LOC.caisse, GAME), { confies: 10, actives: 3, nonActives: 7 }, 'soldesCarnetsParJeu (V1) : même correctif, même résultat que soldesCarnetsAvecReference');
}

// ------------------------------------------------------------
// 7) RÉCONCILIATION SAINE → ÉCART 0. Un contrôle physique qui confirme
//    exactement le stock théorique ne doit jamais signaler un écart, ni
//    exiger de motif.
// ------------------------------------------------------------
{
  const lignes = [
    { game_id: GAME, stock_theorique_bureau_avant: 12, stock_theorique_caisse_avant: 8, bureau_reel: 12, caisse_reel: 8 },
  ];
  const { parJeu, aUnEcart } = M.ecartsReferenceLignes(lignes);
  assert(aUnEcart === false, 'réconciliation saine : aucun écart détecté');
  assertEqual(parJeu[GAME], { ecartBureau: 0, ecartCaisse: 0, theoBureau: 12, theoCaisse: 8, bureauReel: 12, caisseReel: 8 }, 'réconciliation saine : écarts à 0 pour chaque composant');
}

// ------------------------------------------------------------
// 8) ANOMALIE VOLONTAIRE → DIVERGENCE DÉTECTÉE. Un écart réel (carnet
//    manquant ou en trop) doit être rapporté avec son signe et sa valeur
//    exacte — jamais masqué, jamais arrondi à 0.
// ------------------------------------------------------------
{
  const lignes = [
    { game_id: GAME, stock_theorique_bureau_avant: 12, stock_theorique_caisse_avant: 8, bureau_reel: 12, caisse_reel: 5 }, // 3 carnets manquants en caisse
    { game_id: 'jeu-2', stock_theorique_bureau_avant: 0, stock_theorique_caisse_avant: 4, bureau_reel: 0, caisse_reel: 6 }, // 2 carnets en trop
  ];
  const { parJeu, aUnEcart } = M.ecartsReferenceLignes(lignes);
  assert(aUnEcart === true, 'anomalie volontaire : écart détecté, jamais masqué');
  assertEqual(parJeu[GAME].ecartCaisse, -3, 'anomalie volontaire : 3 carnets manquants en caisse, signe négatif exact');
  assertEqual(parJeu['jeu-2'].ecartCaisse, 2, 'anomalie volontaire : 2 carnets en trop, signe positif exact');
}

// ------------------------------------------------------------
// 9) POINT ZÉRO — un mouvement antérieur au dernier inventaire de
//    référence certifié n'est jamais recompté : déjà absorbé dans la
//    référence (sinon tout contrôle physique serait rendu caduc par son
//    propre historique).
// ------------------------------------------------------------
{
  const reference = { creeLe: '2026-01-10T00:00:00Z', lignes: { [GAME]: { bureau: 5, caisse: 2 } } };
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 999, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }), // avant le point zéro : ignoré
    mouvement({ type_mouvement: 'reception', quantite: 4, location_destination_id: LOC.bureau, created_at: '2026-01-11T08:00:00Z' }), // après : compté
  ];
  const soldes = M.soldesCarnetsAvecReference(mvts, LOC, reference)[GAME];
  assertEqual(soldes, { bureau: 9, confies: 2, actives: 0, bloques: 0, nonActives: 2 }, 'point zéro : le mouvement de 999 antérieur à la référence est ignoré, seul le mouvement postérieur (+4) compte');
}

// ------------------------------------------------------------
// 10) INTÉGRATION BOUT-EN-BOUT : le cycle complet appro↔activation↔ledger
//     reste cohérent après une synchronisation PUIS son annulation —
//     relie decisionSynchronisationApproActivation (déjà testée isolément
//     dans test_fdj_synchronisation_appro_activation_manager_v2251.js) au
//     ledger qu'elle alimente, pour prouver que le cycle complet ne laisse
//     plus de trace fausse une fois refermé.
// ------------------------------------------------------------
{
  const ticketsParCarnet = 100;
  // Quart : appro saisi = 500 tickets = 5 carnets. Une seule activation de
  // 3 réellement tracée pendant le quart -> 2 carnets manquants.
  const reconciliation = M.reconciliationApproActivation(500, 3, ticketsParCarnet);
  assertEqual(reconciliation.etat, 'appro_non_couvert', 'intégration : appro de 5 carnets, 3 activés -> non couvert');
  const decision = M.decisionSynchronisationApproActivation(reconciliation, []);
  assertEqual(decision, { action: 'proposer_synchronisation', carnets: 2 }, 'intégration : NEXUS propose de créer les 2 activations manquantes');

  // Le manager confirme : NEXUS écrit 2 activations reconstituées.
  const avecSynchronisation = [
    mouvement({ type_mouvement: 'activation', quantite: 3, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, created_at: '2026-02-01T10:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 2, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, methode_identification: 'reconstituee_correction_manager', created_at: '2026-02-02T00:00:00Z' }),
  ];
  const soldesApresSync = M.soldesCarnetsAvecReference(avecSynchronisation, LOC, null)[GAME];
  assertEqual(soldesApresSync.actives, 5, 'intégration : après synchronisation, 5 carnets activés au total, plus aucun écart');

  // Une semaine plus tard, le manager se rend compte que la synchronisation
  // était en fait erronée (le quart avait déjà été compté ailleurs) et
  // l'annule intégralement.
  const avecAnnulation = avecSynchronisation.concat([
    mouvement({ type_mouvement: 'correction', quantite: -2, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, methode_identification: 'reconstituee_correction_manager', created_at: '2026-02-09T00:00:00Z' }),
  ]);
  const soldesApresAnnulation = M.soldesCarnetsAvecReference(avecAnnulation, LOC, null)[GAME];
  assertEqual(soldesApresAnnulation.actives, 3, 'intégration : après annulation complète, retour exact aux 3 activations réellement observées — aucune trace fausse ne subsiste');
}

console.log(`\n${passed}/${passed + failed} tests passés — ledger/réconciliation carnets FDJ (soldesCarnetsAvecReference, 04/10/2026).`);
if (failed) process.exit(1);
