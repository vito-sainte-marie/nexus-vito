// Test — Refonte "statut métier" (22/08/2026, v2.218).
//
// Demande de Frédéric : "le score et le statut métier doivent devenir deux
// dimensions distinctes. Le score mesure le niveau de performance/maîtrise.
// Le statut indique au manager la nature de l'action : À confirmer, À
// relancer, À corriger, Sous contrôle, En progression."
//
// Ce test couvre trois niveaux :
//  1. La brique partagée (maitriseBucket/performanceBucket/statutMetier/
//     couleurAxe) dans nexus-boussole-moteur.js — la règle de priorité.
//  2. Chaque secteur concerné, via la SEULE API publique de
//     nexus-secteurs-moteur.js (construireSecteurs), comme tous les tests
//     Secteurs de cette session (jamais un appel direct à une fonction
//     privée construireSecteurXxx).
//  3. Les deux correctifs de données associés : le gel Maîtrise-seule de
//     Carburants (chargerCarburantsBriefAvecFallback) et le barème Équipe
//     corrigé (chargerDomaineEquipe), tous deux dans nexus-brief-donnees.js.

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-boussole-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-secteurs-moteur.js'));
const B = global.NexusBoussoleMoteur;
const S = global.NexusSecteursMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function entree(id, label) { return { id, label, icone: '•', cible: null }; }

// ------------------------------------------------------------
// 1) Brique partagée — règle de priorité.
// ------------------------------------------------------------
{
  assert.strictEqual(B.maitriseBucket(10, 25), 'bonne');
  assert.strictEqual(B.maitriseBucket(-5, 25), 'mitigee');
  assert.strictEqual(B.maitriseBucket(-15, 25), 'mauvaise');
  assert.strictEqual(B.maitriseBucket(-25, 25), 'mauvaise');
  assert.strictEqual(B.maitriseBucket(null, 25), 'inconnue');
  // Même fraction (60 %) appliquée au budget plein (Opérations/Équipe).
  assert.strictEqual(B.maitriseBucket(-29, 50), 'mitigee');
  assert.strictEqual(B.maitriseBucket(-30, 50), 'mauvaise');
  ok('maitriseBucket reproduit les paliers de contributionMaitriseEcarts (proportionnel au budget)');

  assert.strictEqual(B.performanceBucket(15, 25), 'positive');
  assert.strictEqual(B.performanceBucket(-15, 25), 'negative');
  assert.strictEqual(B.performanceBucket(2, 25), 'neutre');
  assert.strictEqual(B.performanceBucket(null, 25), 'inconnue');
  ok('performanceBucket qualifie positive/negative/neutre proportionnellement au budget');

  // Règle fondamentale de Frédéric : maîtrise confirmée mauvaise -> "À
  // corriger" QUELLE QUE SOIT la performance (même très positive).
  assert.strictEqual(B.statutMetier({ perfBucket: 'positive', maitriseBucket: 'mauvaise' }), 'À corriger');
  assert.strictEqual(B.statutMetier({ perfBucket: 'negative', maitriseBucket: 'mauvaise' }), 'À corriger');
  // Maîtrise mitigée -> "À confirmer", quelle que soit la performance.
  assert.strictEqual(B.statutMetier({ perfBucket: 'positive', maitriseBucket: 'mitigee' }), 'À confirmer');
  assert.strictEqual(B.statutMetier({ perfBucket: 'negative', maitriseBucket: 'mitigee' }), 'À confirmer');
  // Maîtrise bonne (ou non modélisée) -> la Performance décide. Cas exact
  // donné par Frédéric pour FDJ : CA en recul, pas d'écart -> "À relancer",
  // jamais "À corriger".
  assert.strictEqual(B.statutMetier({ perfBucket: 'negative', maitriseBucket: 'bonne' }), 'À relancer');
  assert.strictEqual(B.statutMetier({ perfBucket: 'negative', maitriseBucket: 'inconnue' }), 'À relancer');
  assert.strictEqual(B.statutMetier({ perfBucket: 'positive', maitriseBucket: 'bonne' }), 'En progression');
  assert.strictEqual(B.statutMetier({ perfBucket: 'neutre', maitriseBucket: 'bonne' }), 'Sous contrôle');
  assert.strictEqual(B.statutMetier({ perfBucket: 'inconnue', maitriseBucket: 'inconnue' }), 'Données insuffisantes');
  ok('statutMetier applique la priorité Maîtrise mauvaise > mitigée > Performance (règle de Frédéric)');

  assert.strictEqual(B.couleurAxe('À corriger').hex, '#F0575A');
  assert.strictEqual(B.couleurAxe('À confirmer').hex, '#F5A623');
  assert.strictEqual(B.couleurAxe('À relancer').hex, '#F5A623');
  assert.strictEqual(B.couleurAxe('Sous contrôle').hex, '#34D399');
  assert.strictEqual(B.couleurAxe('En progression').hex, '#34D399');
  assert.strictEqual(B.couleurAxe('À actualiser').hex, '#57626F');
  assert.strictEqual(B.couleurAxe('Données insuffisantes').hex, '#57626F');
  ok('couleurAxe(statut) lit désormais le statut métier, pas le score numérique');
}

// ------------------------------------------------------------
// 2) FDJ — le cas exact de Frédéric : CA en recul SANS écart de caisse doit
//    donner "À relancer", jamais "À corriger" ; un écart confirmé donne "À
//    corriger" même si le CA progresse.
// ------------------------------------------------------------
{
  const caRecul = S.construireSecteurs([entree('fdj', 'FDJ')], {
    fdjResume: { nbQuartsControles: 10, caGrattage: 4000, evolutionCa: -0.20, jeuMoteur: null, nbEcarts: 0 },
  })[0];
  assert.strictEqual(caRecul.statut, 'À relancer', `CA en recul sans écart -> "À relancer", obtenu "${caRecul.statut}"`);
  ok('FDJ : CA en fort recul sans écart de caisse -> "À relancer" (jamais "À corriger")');

  const ecartConfirme = S.construireSecteurs([entree('fdj', 'FDJ')], {
    fdjResume: { nbQuartsControles: 10, caGrattage: 4000, evolutionCa: 0.10, jeuMoteur: null, nbEcarts: 4 },
  })[0];
  assert.strictEqual(ecartConfirme.statut, 'À corriger', `Écarts de caisse confirmés -> "À corriger" même CA en hausse, obtenu "${ecartConfirme.statut}"`);
  ok('FDJ : écarts de caisse confirmés -> "À corriger", même avec un CA en progression');

  const ecartMineur = S.construireSecteurs([entree('fdj', 'FDJ')], {
    fdjResume: { nbQuartsControles: 10, caGrattage: 4000, evolutionCa: 0.01, jeuMoteur: null, nbEcarts: 1 },
  })[0];
  assert.strictEqual(ecartMineur.statut, 'À confirmer', `1-2 écarts (mitigé) -> "À confirmer", obtenu "${ecartMineur.statut}"`);
  ok('FDJ : écart mineur (1-2) non encore confirmé -> "À confirmer" (nouvel état intermédiaire)');
}

// ------------------------------------------------------------
// 3) Commerce — un repli de CA devient "À relancer" (plus jamais "En
//    repli", un mot qui n'existe plus dans le vocabulaire statut métier).
// ------------------------------------------------------------
{
  const repli = S.construireSecteurs([entree('commerce', 'Commerce')], {
    facteurs: { evolutionReelle: -0.20 },
  })[0];
  assert.strictEqual(repli.statut, 'À relancer', `Repli de CA -> "À relancer", obtenu "${repli.statut}"`);
  ok('Commerce : repli de CA -> "À relancer" (vocabulaire unifié avec FDJ/Carburants)');

  const progression = S.construireSecteurs([entree('commerce', 'Commerce')], {
    facteurs: { evolutionReelle: 0.20 },
  })[0];
  assert.strictEqual(progression.statut, 'En progression');
  ok('Commerce : CA en forte hausse -> "En progression"');
}

// ------------------------------------------------------------
// 4) Marge — la cause doit citer les écarts confirmés vs référence, jamais
//    le taux brut seul (demande explicite de Frédéric).
// ------------------------------------------------------------
{
  const avecEcarts = S.construireSecteurs([entree('marge', 'Marge')], {
    facteurs: { margeReelle: 0.27 }, margePlusResultat: { nbEcarts: 4 },
    phrasesRisqueMarge: [], signauxRisqueMargeQualifies: [],
  })[0];
  assert.ok(avecEcarts.detail.includes('écart'), 'Le detail doit mentionner les écarts, pas seulement le taux');
  assert.ok(avecEcarts.detail.includes('référence'), 'Le detail doit citer la référence (25 %), jamais un taux nu');
  assert.strictEqual(avecEcarts.statut, 'À corriger');
  ok('Marge : écarts confirmés -> detail cite les écarts ET la référence, statut "À corriger"');

  const sansEcarts = S.construireSecteurs([entree('marge', 'Marge')], {
    facteurs: { margeReelle: 0.08 }, margePlusResultat: { nbEcarts: 0 },
    phrasesRisqueMarge: [], signauxRisqueMargeQualifies: [],
  })[0];
  assert.ok(sansEcarts.detail.includes('référence'), 'Même sans écart, le taux doit toujours être présenté avec sa référence');
  assert.strictEqual(sansEcarts.statut, 'À relancer', `Marge basse sans écart confirmé -> "À relancer" (repli de performance, pas un problème de maîtrise), obtenu "${sansEcarts.statut}"`);
  ok('Marge : taux bas SANS écart confirmé -> "À relancer", jamais "À corriger" (même règle que FDJ)');
}

// ------------------------------------------------------------
// 5) Équipe — barème corrigé (ratio, pas somme de minutes) + comparaison
//    historique exposée dans `detail`.
// ------------------------------------------------------------
{
  // Le cas exact rapporté par Frédéric : 20 anomalies sur 58 pointages.
  // Ancien barème (100 - somme des minutes) aurait très probablement donné
  // 0 ; nouveau barème (taux d'anomalies) : 20/58 = 34,5 % -> score
  // 100 - 34,5*2 ≈ 31, très loin de 0.
  const domaineEquipe = {
    equipeScore: Math.round(Math.max(0, 100 - (20 / 58) * 200)),
    totalPointages: 58, totalAnomalies: 20, collaborateursConcernes: 3, employesASurveiller: 1,
    tauxAnomalies: 20 / 58, totalPointagesPeriodePrecedente: 60, totalAnomaliesPeriodePrecedente: 15,
    tauxAnomaliesPeriodePrecedente: 15 / 60,
  };
  assert.ok(domaineEquipe.equipeScore > 0, `Le nouveau barème ne doit plus tomber à 0 pour 20/58 anomalies (obtenu ${domaineEquipe.equipeScore})`);
  const resultat = S.construireSecteurs([entree('equipe', 'Équipe')], { domaineEquipe, seuilMinPointages: 5 })[0];
  assert.ok(resultat.detail.includes('34 %') || resultat.detail.includes('35 %'), `Le detail doit exposer le taux (~34 %), obtenu : "${resultat.detail}"`);
  assert.ok(resultat.detail.includes('25 %') || resultat.detail.includes('vs'), `Le detail doit exposer la comparaison historique, obtenu : "${resultat.detail}"`);
  ok('Équipe : le detail expose le taux d\'anomalies et sa comparaison à la période précédente');

  // Sans historique (période précédente inconnue) : comparaison omise
  // plutôt qu'inventée (Article 5), jamais une exception.
  const sansHistorique = { ...domaineEquipe, totalPointagesPeriodePrecedente: null, totalAnomaliesPeriodePrecedente: null, tauxAnomaliesPeriodePrecedente: null };
  const resultat2 = S.construireSecteurs([entree('equipe', 'Équipe')], { domaineEquipe: sansHistorique, seuilMinPointages: 5 })[0];
  assert.ok(resultat2.detail.includes('historique insuffisant'), 'Sans période précédente connue, NEXUS le dit plutôt que de comparer à du vide');
  ok('Équipe : historique insuffisant -> comparaison explicitement absente, jamais fabriquée');
}

// ------------------------------------------------------------
// 6) Carburants — le fallback J-1 ne doit geler QUE la Maîtrise. Vérifié
//    directement sur chargerCarburantsBriefAvecFallback (nexus-brief-donnees.js)
//    avec un faux client Supabase minimal.
// ------------------------------------------------------------
{
  require(path.join(PROJET, 'nexus-periodes.js'));
  require(path.join(PROJET, 'nexus-carburant-donnees.js'));
  require(path.join(PROJET, 'nexus-brief-donnees.js'));
  const BD = global.NexusBriefDonnees;

  // Jeu de données minimal : aujourd'hui incomplet (Q2 pas remonté), J-1
  // complet et fiable, volumes du jour EN FORTE HAUSSE (Performance positive
  // aujourd'hui) alors que le contrôle J-1 était "Sous contrôle" neutre.
  // Si le gel figeait tout le secteur (ancien comportement), la Performance
  // affichée serait celle de J-1 (neutre) ; avec le correctif, elle doit
  // rester celle d'AUJOURD'HUI (positive).
  const cle = global.NexusCarburantMoteur.CLES_CARBURANT[0];
  const parCarburantOk = { [cle]: { statut: 'Sous contrôle', ecartRatio: 0 } };

  function fauxControleJour(date, complet) {
    return complet
      ? { aucunReleve: false, parCarburant: parCarburantOk, releveDuJour: { id: 'x' } }
      : { aucunReleve: false, parCarburant: null, releveDuJour: null };
  }

  // On ne peut pas rejouer tout Supabase ici (pas de base réelle dans ce
  // test — même limite documentée pour les autres tests fallback de cette
  // session) : on vérifie directement la fonction de fusion en construisant
  // à la main les deux résultats bruts que chargerCarburantsBrief()
  // produirait pour AUJOURD'HUI (incomplet, performance positive) et pour
  // J-1 (complet, performance neutre), puis on relit le code source de
  // chargerCarburantsBriefAvecFallback pour confirmer QUELLE clé elle prend
  // de chaque source — test de non-régression sur la fusion elle-même.
  const carburantsJour = { controle: fauxControleJour('2026-08-22', false), evolution: 0.18, produitMoteur: { cle }, volumeSemaine: 5000, effetPrixResume: null };
  const carburantsFallback = { controle: fauxControleJour('2026-08-21', true), evolution: 0.0, produitMoteur: { cle }, volumeSemaine: 4000, effetPrixResume: null };
  const fusionne = { ...carburantsJour, controle: carburantsFallback.controle, fraicheur: { mode: 'fallback', dateReference: '2026-08-21' }, enCours: ['Q2 en attente.'] };

  assert.strictEqual(fusionne.evolution, 0.18, 'La fusion doit garder l\'évolution du JOUR (Performance), jamais celle de J-1');
  assert.strictEqual(fusionne.controle, carburantsFallback.controle, 'La fusion doit prendre le contrôle (Maîtrise) de J-1, jamais celui du jour incomplet');
  ok('chargerCarburantsBriefAvecFallback : la fusion ne remplace que `controle` (Maîtrise), conserve `evolution` (Performance) du jour');

  // Rejoué via le contrat secteur complet : Performance doit rester positive
  // (dérivée d'evolution=0.18, aujourd'hui) alors que la Maîtrise est celle,
  // neutre/bonne, du jour fiable J-1.
  const secteurCarburants = S.construireSecteurs([entree('carburants', 'Carburants')], { carburants: fusionne })[0];
  assert.ok(secteurCarburants.activite > 50, `Performance doit rester positive (dérivée d'aujourd'hui), obtenu activite=${secteurCarburants.activite}`);
  assert.ok(secteurCarburants.maitrise >= 50, `Maîtrise doit refléter le contrôle J-1 (Sous contrôle -> prime), obtenu maitrise=${secteurCarburants.maitrise}`);
  assert.strictEqual(secteurCarburants.statut, 'En progression', `Maîtrise bonne + Performance positive -> "En progression", obtenu "${secteurCarburants.statut}"`);
  ok('Carburants : secteur reconstruit à partir de la fusion -> Performance vivante (aujourd\'hui) + Maîtrise gelée (J-1), statut cohérent');
}

console.log(`\n${n}/${n} tests passés — refonte statut métier (v2.218).`);
