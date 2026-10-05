// Test causal — candidat FDJ reconstruit contre le code RÉEL de production
// (FDJ-CARNETS-LEDGER-AUDIT-1-20261004, GO request-7/decision-7, 2026-10-05).
//
// Vérifie que le routage du mouvement 'correction' dans
// .scratch-fdj/candidate-moteur.js (= nexus-fdj-moteur.js de production +
// le correctif minimal, 3 hunks, identique à celui déjà qualifié par
// request-1.md/7e41b3b) annule bien 'actives' au lieu de router vers
// confies/bureau par emplacement de destination.
//
// Preuve négative réelle : le MÊME test, pointé sur .scratch-fdj/prod-moteur.js
// (production telle quelle, sans le correctif), doit échouer — confirmant
// que le bug est réellement présent en production aujourd'hui, pas une
// hypothèse.

const path = require('path');
const assert = require('assert');

function chargerModule(cheminRelatif) {
  const cheminAbsolu = path.join(__dirname, cheminRelatif);
  delete require.cache[require.resolve(cheminAbsolu)];
  const sandbox = {};
  global.window = sandbox;
  require(cheminAbsolu);
  const moteur = sandbox.NexusFdjMoteur;
  delete global.window;
  return moteur;
}

const LOC = { caisse: 'caisse-1', bureau: 'bureau-1', bloque: 'bloque-1' };
const GAME = 'jeu-1';

function mouvement(partial) {
  return Object.assign({ game_id: GAME, location_source_id: null, location_destination_id: null }, partial);
}

function executerMatrice(M, label, attendreBugCorrige) {
  let passed = 0, failed = 0;
  function assertEqual(actual, expected, msg) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { passed++; } else { failed++; console.error(`  ÉCHEC [${label}] ${msg} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); }
  }

  // Cas terrain réel : 22 carnets reçus, 10 transférés en caisse, 2 activés,
  // puis le manager annule à tort 1 des 2 activations via une 'correction'
  // négative (creerActivationReconstitueeCorrectionManager). Le carnet
  // annulé n'a JAMAIS physiquement quitté la caisse : seul 'actives' doit
  // bouger.
  const mvts = [
    mouvement({ type_mouvement: 'reception', quantite: 22, location_destination_id: LOC.bureau, created_at: '2026-01-01T08:00:00Z' }),
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_source_id: LOC.bureau, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 2, created_at: '2026-01-01T10:00:00Z' }),
    // creerActivationReconstitueeCorrectionManager écrit TOUJOURS
    // location_source_id = location_destination_id = caisse (voir
    // request-1.md §4 et le code réel de production).
    mouvement({ type_mouvement: 'correction', quantite: -1, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, created_at: '2026-01-01T11:00:00Z' }),
  ];
  const soldesRef = M.soldesCarnetsAvecReference(mvts, LOC, null)[GAME];

  if (attendreBugCorrige) {
    // Correctif : 'correction' annule exactement ce qu'une 'activation' du
    // même montant aurait compté. confiés reste à 10 (rien n'a physiquement
    // bougé), actives repasse à 1.
    assertEqual(soldesRef, { bureau: 12, confies: 10, actives: 1, bloques: 0, nonActives: 9 },
      'soldesCarnetsAvecReference : correction(-1, caisse->caisse) doit annuler 1 activation, jamais toucher confiés/bureau');
  } else {
    // Comportement BUGUÉ (production non corrigée) : la correction route
    // vers confies par emplacement de destination (caisse) — confiés
    // décrémenté comme si un carnet avait physiquement quitté la caisse
    // (ce qui n'est jamais le cas sur ce chemin), et 'actives' JAMAIS
    // touché : l'activation fautive reste comptée pour toujours. C'est
    // exactement l'anomalie terrain diagnostiquée par request-1.md §4.
    assertEqual(soldesRef, { bureau: 12, confies: 9, actives: 2, bloques: 0, nonActives: 7 },
      'bug reproduit : confiés faussé par le routage destination, actives jamais annulé');
  }

  // soldesCarnetsParJeu (V1, sans point zéro) doit suivre la même règle,
  // par cohérence (Article 11 — jamais deux comptages divergents du même
  // fait).
  const mvtsV1 = [
    mouvement({ type_mouvement: 'transfert', quantite: 10, location_destination_id: LOC.caisse, created_at: '2026-01-01T09:00:00Z' }),
    mouvement({ type_mouvement: 'activation', quantite: 2, created_at: '2026-01-01T10:00:00Z' }),
    mouvement({ type_mouvement: 'correction', quantite: -1, location_source_id: LOC.caisse, location_destination_id: LOC.caisse, created_at: '2026-01-01T11:00:00Z' }),
  ];
  const soldesV1 = M.soldesCarnetsParJeu(mvtsV1, LOC.caisse)[GAME];
  if (attendreBugCorrige) {
    assertEqual(soldesV1, { confies: 10, actives: 1, nonActives: 9 }, 'soldesCarnetsParJeu : même règle que soldesCarnetsAvecReference après correctif');
  } else {
    // soldesCarnetsParJeu (production non corrigée) n'a AUCUNE branche pour
    // 'correction' — le mouvement est silencieusement ignoré, ce qui est un
    // défaut distinct (moins grave : au moins il ne fausse rien), mais
    // confirme que seule soldesCarnetsAvecReference porte le vrai bug.
    assertEqual(soldesV1, { confies: 10, actives: 2, nonActives: 8 }, 'bug V1 : correction totalement ignorée (pas de branche), actives jamais annulé');
  }

  return { passed, failed };
}

(() => {
  console.log('=== Candidat (production + correctif) — doit être VERT ===');
  const Mfixe = chargerModule('candidate-moteur.js');
  const rFixe = executerMatrice(Mfixe, 'candidat-corrige', true);
  assert.strictEqual(rFixe.failed, 0, `${rFixe.failed} échec(s) sur le candidat corrigé — ne devrait jamais arriver`);
  console.log(`OK — ${rFixe.passed}/${rFixe.passed} sur le candidat (nexus-fdj-moteur.js de production + correctif routage 'correction').`);

  console.log("\n=== Preuve négative réelle — production TELLE QUELLE (sans correctif) ===");
  const Mbug = chargerModule('prod-moteur.js');
  const rBug = executerMatrice(Mbug, 'production-non-corrigee', true); // on exige le comportement CORRIGÉ...
  // ... et on vérifie que ça échoue bien (le bug est réel, pas supposé) :
  if (rBug.failed === 0) {
    console.error('ÉCHEC DE LA PREUVE NÉGATIVE : production non corrigée a satisfait les mêmes assertions que le candidat — le bug ne serait pas réel, ou le test ne le détecte pas.');
    process.exit(1);
  }
  console.log(`OK — ${rBug.failed} échec(s) réel(s) confirmé(s) sur production non corrigée : le bug 'correction' est bien présent aujourd'hui, le correctif est nécessaire.`);

  console.log('\nTous les tests "candidat ledger correction FDJ (contre code réel production)" passent.');
})();
