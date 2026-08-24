// Test — Fallback temporel "dernier état fiable", extension à FDJ (22/08/2026,
// v2.219). Frédéric : "j'ai appliqué ça à Carburants, applique la même règle
// à FDJ" — le mécanisme v2.214/v2.215 était déjà annoncé générique
// ("Carburants, FDJ, Inventaire ou Verify").
//
// Différence assumée avec Carburants (voir le commentaire détaillé dans
// nexus-fdj-moteur.js) : la Maîtrise FDJ (`nbEcarts`) est déjà une SOMME sur
// une fenêtre de 7 jours, pas une valeur ponctuelle du jour — le fallback ne
// fige donc pas "la valeur d'un jour" mais DÉCALE la fenêtre pour qu'elle ne
// se termine jamais sur un jour non clôturé. La Performance
// (caGrattage/evolutionCa) reste toujours celle d'aujourd'hui.

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-boussole-moteur.js'));
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-fdj-moteur.js'));
require(path.join(PROJET, 'nexus-secteurs-moteur.js'));
const F = global.NexusFdjMoteur;
const C = global.NexusCarburantMoteur;
const S = global.NexusSecteursMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function entree(id, label) { return { id, label, icone: '•', cible: null }; }
function ligne(date, nbQuartsControles, nbEcarts) { return { date, nb_quarts_controles: nbQuartsControles, nb_ecarts_non_nuls: nbEcarts, ca_grattage: 100 }; }

// ------------------------------------------------------------
// 1) trouverDernierJourFdjFiable — reconstruit un historique de lignes
//    view_fdj_daily_summary, cherche le dernier jour clôturé AVANT
//    aujourd'hui (jamais aujourd'hui lui-même).
// ------------------------------------------------------------
{
  // J-1 clôturé (2 quarts) -> trouvé directement, 1 jour d'écart.
  const historique1 = [ligne('2026-08-21', 2, 0), ligne('2026-08-20', 2, 1), ligne('2026-08-19', 1, 0)];
  const r1 = F.trouverDernierJourFdjFiable(historique1, '2026-08-22');
  assert.deepStrictEqual(r1, { trouve: true, date: '2026-08-21', joursEcoules: 1 });
  ok('trouverDernierJourFdjFiable : J-1 clôturé -> trouvé directement, joursEcoules=1');

  // J-1 non clôturé (1 seul quart) -> remonte à J-2.
  const historique2 = [ligne('2026-08-21', 1, 0), ligne('2026-08-20', 2, 2), ligne('2026-08-19', 2, 0)];
  const r2 = F.trouverDernierJourFdjFiable(historique2, '2026-08-22');
  assert.deepStrictEqual(r2, { trouve: true, date: '2026-08-20', joursEcoules: 2 });
  ok('trouverDernierJourFdjFiable : J-1 non clôturé -> remonte à J-2');

  // Aucun jour clôturé dans l'historique -> honnête, jamais un repli fabriqué.
  const historique3 = [ligne('2026-08-21', 1, 0), ligne('2026-08-20', 0, 0)];
  const r3 = F.trouverDernierJourFdjFiable(historique3, '2026-08-22');
  assert.deepStrictEqual(r3, { trouve: false });
  ok('trouverDernierJourFdjFiable : aucun jour clôturé -> {trouve:false}, jamais un repli inventé');

  // Ne considère jamais AUJOURD'HUI lui-même, même s'il apparaît clôturé
  // dans les lignes passées par erreur (garde défensive).
  const historique4 = [ligne('2026-08-22', 2, 0), ligne('2026-08-21', 2, 3)];
  const r4 = F.trouverDernierJourFdjFiable(historique4, '2026-08-22');
  assert.strictEqual(r4.date, '2026-08-21', 'Ne doit jamais retenir la date d\'aujourd\'hui elle-même');
  ok('trouverDernierJourFdjFiable : exclut toujours la date d\'aujourd\'hui de la recherche');
}

// ------------------------------------------------------------
// 2) sommerEcartsFenetreFdj — ré-agrège nb_ecarts_non_nuls sur 7 jours
//    calendaires se terminant à dateFin, à partir des lignes déjà chargées.
// ------------------------------------------------------------
{
  const dailyRows = [
    ligne('2026-08-15', 2, 1), ligne('2026-08-16', 2, 0), ligne('2026-08-17', 2, 2),
    ligne('2026-08-18', 2, 0), ligne('2026-08-19', 2, 0), ligne('2026-08-20', 2, 1),
    ligne('2026-08-21', 2, 0), // fenêtre 15-21 = 7 jours, somme écarts = 1+0+2+0+0+1+0 = 4
    ligne('2026-08-22', 1, 5), // aujourd'hui, partiel — ne doit JAMAIS entrer dans la somme gelée
  ];
  const somme = F.sommerEcartsFenetreFdj(dailyRows, '2026-08-21');
  assert.strictEqual(somme, 4, `Somme attendue 4 sur la fenêtre 15-21/08, obtenu ${somme}`);
  ok('sommerEcartsFenetreFdj : ré-agrège correctement sur 7 jours se terminant à dateFin, exclut le jour courant');
}

// ------------------------------------------------------------
// 3) construireBlocEnCoursFdj — jamais fondu dans le score figé.
// ------------------------------------------------------------
{
  assert.deepStrictEqual(F.construireBlocEnCoursFdj({ nbQuartsControlesJour: 0, nbEcartsJour: 0 }), ["Aucun quart FDJ clôturé pour l'instant aujourd'hui."]);
  assert.deepStrictEqual(F.construireBlocEnCoursFdj({ nbQuartsControlesJour: 1, nbEcartsJour: 0 }), [
    '1/2 quarts FDJ clôturés aujourd\'hui.', "Aucun écart de caisse constaté pour l'instant aujourd'hui.",
  ]);
  assert.deepStrictEqual(F.construireBlocEnCoursFdj({ nbQuartsControlesJour: 1, nbEcartsJour: 2 }), [
    '1/2 quarts FDJ clôturés aujourd\'hui.', '2 écarts de caisse déjà constatés aujourd\'hui.',
  ]);
  ok('construireBlocEnCoursFdj : décrit honnêtement ce qui est déjà connu du jour en construction');
}

// ------------------------------------------------------------
// 4) Intégration — construireSecteurFdj avec les 3 modes, via l'API
//    publique NexusSecteursMoteur.construireSecteurs() (jamais un appel
//    direct à une fonction privée).
// ------------------------------------------------------------
{
  const e = entree('fdj', 'FDJ');

  // Mode 'jour' implicite (pas de fraicheur transmise) — non-régression
  // totale pour tout appelant qui n'aurait pas encore ce champ.
  const sansFraicheur = S.construireSecteurs([e], {
    fdjResume: { nbQuartsControles: 10, caGrattage: 4000, evolutionCa: 0.02, jeuMoteur: null, nbEcarts: 0 },
  })[0];
  assert.strictEqual(sansFraicheur.fraicheur.mode, 'jour');
  assert.strictEqual(sansFraicheur.enCours, null);
  ok('construireSecteurFdj : rétrocompatible, mode "jour" par défaut sans régression');

  // Mode 'fallback' : nbEcarts vient de la fenêtre gelée (2, un problème
  // confirmé), mais evolutionCa reste positif et vivant (aujourd'hui) —
  // Performance jamais gelée par une Maîtrise en cours de construction.
  const fallback = S.construireSecteurs([e], {
    fdjResume: {
      nbQuartsControles: 10, caGrattage: 4000, evolutionCa: 0.12, jeuMoteur: null, nbEcarts: 3,
      fraicheur: { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 },
      enCours: ["1/2 quarts FDJ clôturés aujourd'hui.", "Aucun écart de caisse constaté pour l'instant aujourd'hui."],
    },
  })[0];
  assert.strictEqual(fallback.confiance, 'RÉEL');
  assert.strictEqual(fallback.statut, 'À corriger', 'Écarts confirmés (3) sur la fenêtre gelée -> "À corriger", même avec un CA vivant en hausse');
  assert.ok(fallback.activite > 50, 'Performance doit rester vivante (evolutionCa=0.12, positif), jamais gelée');
  assert.deepStrictEqual(fallback.fraicheur, { mode: 'fallback', dateReference: '2026-08-21', joursEcoules: 1 });
  assert.strictEqual(fallback.enCours.length, 2);
  ok('construireSecteurFdj : mode fallback -> Maîtrise gelée sur la fenêtre fiable, Performance vivante (aujourd\'hui)');

  // Mode 'perime' : aucun score courant présenté, secteur exclu de l'Indice.
  const perime = S.construireSecteurs([e], {
    fdjResume: {
      nbQuartsControles: 10, caGrattage: 4000, evolutionCa: 0.02, jeuMoteur: null, nbEcarts: 0,
      fraicheur: { mode: 'perime', dateReference: '2026-08-10', joursEcoules: 12 },
      enCours: ["Aucun quart FDJ clôturé pour l'instant aujourd'hui."],
    },
  })[0];
  assert.strictEqual(perime.statut, 'À actualiser');
  assert.strictEqual(perime.valeur, null);
  assert.strictEqual(perime.confiance, 'INSUFFISANT', 'Exclu de l\'Indice Boussole, même invariant que secteurVide/Carburants périmé');
  ok('construireSecteurFdj : mode périmé -> "À actualiser", valeur null, exclu de l\'Indice');
}

// ------------------------------------------------------------
// 5) fraicheurCarburant (nexus-carburant-moteur.js) est bien réutilisée
//    telle quelle pour FDJ, sans duplication — vérifié en rejouant sa
//    décision avec un `fallback` FDJ.
// ------------------------------------------------------------
{
  const fallbackFdj = F.trouverDernierJourFdjFiable([ligne('2026-08-21', 2, 0)], '2026-08-22');
  const fraicheur = C.fraicheurCarburant({ completAujourdhui: false, fallback: fallbackFdj });
  assert.strictEqual(fraicheur.mode, 'fallback');
  assert.strictEqual(C.libelleBadgeFraicheur(fraicheur), 'Dernier état fiable J-1');
  ok('fraicheurCarburant/libelleBadgeFraicheur (déjà génériques) fonctionnent tels quels avec un fallback FDJ, sans duplication');
}

console.log(`\n${n}/${n} tests passés — fallback FDJ (v2.219).`);
