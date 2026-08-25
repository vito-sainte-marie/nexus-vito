// Test — Philosophie de volume à deux modes (25/08/2026, v2.245, retour de
// Frédéric : "hors fin de mois, essayer autant que possible de construire un
// camion complet jusqu'à 36 000 L [...] en fin de mois, privilégier le stock
// résiduel minimal"). Couvre nexus-carburant-commande-moteur.js —
// estFinDeMois (fenêtre calendaire), completerVersCamionPlein (via
// optimiserCommandeMultiCarburant, paramètre `viserCamionComplet`), le
// garde-fou SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION, et la rétrocompatibilité
// stricte de tous les appels existants qui ne passent pas ce paramètre
// (Article 11 — même précédent que `fenetreIsolable` de qualiteChaineCarburant,
// v2.205 : paramètre absent = comportement historique inchangé).
//
// L'exclusion volontaire de la phase "camion complet" du chemin
// 'insuffisant_meme_optimise' (portée non traitée, décision actée lors de
// l'implémentation pour ne pas modifier le comportement déjà validé du bloc
// 13/global3 de test_carburant_commande_moteur_v2238.js) est testée
// explicitement au bloc 5 ci-dessous.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-carburant-commande-moteur.js'), 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const M = sandbox.NexusCarburantCommandeMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }
function prochePied(a, b, tol) { return Math.abs(a - b) < (tol || 0.5); }

// ------------------------------------------------------------
// 1) estFinDeMois — fenêtre par défaut JOURS_FIN_MOIS=5, sur des mois de
//    longueurs différentes (31/30/28/29 j), y compris février bissextile.
// ------------------------------------------------------------
{
  // Août 2026 (31 j) — bascule le 27 (31-5=26 -> jourDuMois > 26).
  assert.strictEqual(M.estFinDeMois('2026-08-26'), false, '26 août : encore le mode normal (26 n\'est pas > 26)');
  assert.strictEqual(M.estFinDeMois('2026-08-27'), true, '27 août : bascule en fin de mois');
  assert.strictEqual(M.estFinDeMois('2026-08-31'), true, '31 août : dernier jour du mois, fin de mois');
  assert.strictEqual(M.estFinDeMois('2026-08-01'), false, '1er août : très loin de la fin de mois');

  // Avril 2026 (30 j) — bascule le 26 (30-5=25).
  assert.strictEqual(M.estFinDeMois('2026-04-25'), false, '25 avril (mois de 30 j) : encore le mode normal');
  assert.strictEqual(M.estFinDeMois('2026-04-26'), true, '26 avril (mois de 30 j) : fin de mois');

  // Février 2026 (28 j, NON bissextile — 2026 non divisible par 4) —
  // bascule le 24 (28-5=23).
  assert.strictEqual(M.estFinDeMois('2026-02-23'), false, '23 février 2026 (28 j) : encore le mode normal');
  assert.strictEqual(M.estFinDeMois('2026-02-24'), true, '24 février 2026 (28 j) : fin de mois');
  assert.strictEqual(M.estFinDeMois('2026-02-28'), true, '28 février 2026 : dernier jour, fin de mois');

  // Février 2028 (29 j, bissextile — divisible par 4, pas par 100) —
  // bascule le 25 (29-5=24) : la fenêtre suit bien la vraie longueur du
  // mois, jamais un 28 codé en dur.
  assert.strictEqual(M.estFinDeMois('2028-02-24'), false, '24 février 2028 (année bissextile, 29 j) : encore le mode normal');
  assert.strictEqual(M.estFinDeMois('2028-02-25'), true, '25 février 2028 (année bissextile, 29 j) : fin de mois');
  assert.strictEqual(M.estFinDeMois('2028-02-29'), true, '29 février 2028 : dernier jour bissextile, fin de mois');

  // Décembre (31 j, changement d'année à proximité) — même règle, aucune
  // confusion sur le passage au mois/année suivante.
  assert.strictEqual(M.estFinDeMois('2026-12-26'), false, '26 décembre : encore le mode normal');
  assert.strictEqual(M.estFinDeMois('2026-12-27'), true, '27 décembre : fin de mois');

  // Paramètre `joursFinMois` explicite (surcharge du provisoire
  // JOURS_FIN_MOIS=5) et cas limites (Article 5 : jamais une exception).
  assert.strictEqual(M.estFinDeMois('2026-08-20', 10), false, 'fenêtre élargie à 10 j : 20 août encore hors fenêtre (31-10=21)');
  assert.strictEqual(M.estFinDeMois('2026-08-22', 10), true, 'fenêtre élargie à 10 j : 22 août dans la fenêtre');
  assert.strictEqual(M.estFinDeMois(null), false, 'date absente -> jamais fin de mois par défaut (pas d\'exception)');
  assert.strictEqual(M.estFinDeMois(undefined), false, 'date undefined -> jamais fin de mois par défaut');
  assert.strictEqual(M.JOURS_FIN_MOIS, 5, 'constante provisoire exportée telle quelle');

  ok('estFinDeMois — fenêtre des 5 derniers jours calendaires, correcte sur mois de 28/29/30/31 j (dont février bissextile), jamais codée en dur');
}

// ------------------------------------------------------------
// 2) Rétrocompatibilité stricte — `viserCamionComplet` absent ou `false`
//    reproduit exactement le comportement historique déjà validé par le
//    cahier (§14/§15, mêmes exemples que test_carburant_commande_moteur_v2238.js),
//    aucune complétion camion n'est jamais tentée.
// ------------------------------------------------------------
{
  const args = {
    parCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
      go: { etat: 'a_anticiper', besoinMinimumSecuriteL: 5000, joursAvantBesoin: 2, consommationMoyenneJour: 2800, stockPrevuLivraisonL: 8000 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  };

  const sansParametre = M.optimiserCommandeMultiCarburant(args);
  const avecFalse = M.optimiserCommandeMultiCarburant({ ...args, viserCamionComplet: false });
  const avecUndefined = M.optimiserCommandeMultiCarburant({ ...args, viserCamionComplet: undefined });

  [sansParametre, avecFalse, avecUndefined].forEach((optim, i) => {
    assert.strictEqual(optim.decision, 'commander', `variante ${i} : décision inchangée`);
    assert.strictEqual(optim.total, 12000, `variante ${i} : total exactement 12 000 L (§14), jamais poussé vers 36 000 L`);
    assert.deepStrictEqual(Array.from(optim.carburantsAnticipes), ['go'], `variante ${i} : go retenu par anticipation, comme avant ce lot`);
    assert.deepStrictEqual(Array.from(optim.carburantsCompletes || []), [], `variante ${i} : aucune complétion camion, jamais déclenchée sans opt-in explicite`);
  });

  ok('rétrocompatibilité — viserCamionComplet absent/false/undefined reproduit exactement le total 12 000 L du §14 (jamais 36 000 L par surprise)');
}

// ------------------------------------------------------------
// 3) completerVersCamionPlein (via viserCamionComplet:true) — cas
//    entièrement calculé à la main : un seul carburant urgent (sp95, 11 000 L),
//    complété par les deux carburants au prorata de leur consommation
//    jusqu'au plafond de 36 000 L, aucun des deux plafonds individuels
//    (capacité 28 761/28 553 L, autonomie 20 j) n'étant contraignant ici.
//    Ratio de consommation sp95:go = 3200:2800 = 8:7, restant à répartir
//    25 000 L -> sp95 +13 333,33 L / go +11 666,67 L, total exactement
//    36 000 L (l'exemple même donné par Frédéric : "SP95 18 000 + GO 18 000
//    = 36 000 L").
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
      go: { etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 15, consommationMoyenneJour: 2800, stockPrevuLivraisonL: 8000 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
    viserCamionComplet: true,
  });

  assert.strictEqual(optim.decision, 'commander');
  assert.ok(prochePied(optim.total, 36000, 0.5), `total attendu ~36 000 L (proche du maximum camion), obtenu ${optim.total}`);
  assert.deepStrictEqual(Array.from(optim.carburantsCompletes).sort(), ['go', 'sp95'], 'les DEUX carburants sont complétés, pas seulement le carburant urgent');
  assert.ok(prochePied(optim.volumesRetenus.sp95, 24333.33, 1), `sp95 attendu ~24 333,3 L, obtenu ${optim.volumesRetenus.sp95}`);
  assert.ok(prochePied(optim.volumesRetenus.go, 11666.67, 1), `go attendu ~11 666,7 L, obtenu ${optim.volumesRetenus.go}`);
  // Répartition au prorata de la consommation (8:7), jamais un partage égal.
  const ratioObtenu = (optim.volumesRetenus.sp95 - 11000) / (optim.volumesRetenus.go - 0);
  assert.ok(prochePied(ratioObtenu, 3200 / 2800, 0.01), `répartition du complément proportionnelle à la consommation (8:7), ratio obtenu ${ratioObtenu}`);
  assert.ok(/Camion complété/.test(optim.motif), 'motif explicite de la complétion camion : ' + optim.motif);
  assert.strictEqual(optim.optimise, true);

  ok('completerVersCamionPlein — complète les DEUX carburants au prorata de leur consommation jusqu\'à ~36 000 L (exemple exact donné par Frédéric)');
}

// ------------------------------------------------------------
// 4) Garde-fou SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION=20 — la complétion ne
//    doit JAMAIS pousser un carburant au-delà de 20 jours de sa propre
//    consommation, même si la capacité physique et le plafond camion
//    laisseraient largement la place. Cas calculé à la main : sp95 seul,
//    consommation 1000 L/j -> plafond d'autonomie strictement 20 000 L
//    (1000*20), alors que la capacité disponible (40 000 L) et le maximum
//    camion (36 000 L) permettraient bien plus.
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 5000, joursAvantBesoin: 0, consommationMoyenneJour: 1000, stockPrevuLivraisonL: 0 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 40000 },
    viserCamionComplet: true,
  });

  assert.strictEqual(optim.decision, 'commander');
  assert.strictEqual(optim.volumesRetenus.sp95, 20000, 'plafonné exactement à 20 j d\'autonomie (1000 L/j * 20), jamais au-delà malgré la capacité/le plafond camion qui permettraient plus');
  assert.strictEqual(optim.total, 20000, 'total plafonné par l\'autonomie, pas par la capacité (40 000 L) ni le maximum camion (36 000 L)');
  assert.ok(optim.total < 36000, 'le garde-fou d\'autonomie prime sur l\'objectif camion complet — jamais un surstock disproportionné (25/08/2026, retour de Frédéric)');

  ok('garde-fou SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION=20 — jamais plus de 20 j d\'autonomie ajoutée par carburant, même si capacité/plafond camion le permettraient');
}

// ------------------------------------------------------------
// 5) Portée volontairement exclue — le chemin 'insuffisant_meme_optimise'
//    (capacités disponibles insuffisantes même après le filet de sécurité
//    sur le seul carburant urgent) N'EST PAS secouru par la phase camion
//    complet, même avec viserCamionComplet:true — décision actée à
//    l'implémentation pour ne pas changer le comportement déjà validé
//    (bloc 13/global3 de test_carburant_commande_moteur_v2238.js).
// ------------------------------------------------------------
{
  const args = {
    parCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 9500 }, // capacité < minimum camion, même après filet de sécurité (ajout max 2500 -> total 9500 < 10000)
  };
  const sansCamionComplet = M.optimiserCommandeMultiCarburant(args);
  const avecCamionComplet = M.optimiserCommandeMultiCarburant({ ...args, viserCamionComplet: true });

  assert.strictEqual(sansCamionComplet.decision, 'insuffisant_meme_optimise');
  assert.strictEqual(avecCamionComplet.decision, 'insuffisant_meme_optimise', 'viserCamionComplet:true ne doit jamais transformer un "insuffisant_meme_optimise" en commande complétée — portée non traitée, exclue volontairement');
  assert.strictEqual(avecCamionComplet.total, sansCamionComplet.total, 'total strictement identique avec ou sans viserCamionComplet dans ce cas');
  assert.ok(!avecCamionComplet.carburantsCompletes, 'aucun champ carburantsCompletes sur ce chemin — la phase de complétion n\'est jamais atteinte');

  ok('portée exclue — "insuffisant_meme_optimise" n\'est jamais secouru par la complétion camion, même avec viserCamionComplet:true (comportement du bloc 13/global3 v2238 préservé)');
}

// ------------------------------------------------------------
// 6) construireEvaluationGlobale — le paramètre `viserCamionComplet` se
//    propage bien jusqu'à l'optimisation ET jusqu'au champ de retour exposé
//    à l'écran (donnees -> écran, jamais recalculé côté HTML, Article 11).
// ------------------------------------------------------------
{
  const CONFIG = {
    cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
    minimum_camion_litres: 10000, maximum_camion_litres: 36000,
  };
  const global_ = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, scenarioMaintenant: { stockPrevuLivraisonL: 500, margeJours: -1 } },
      go: { etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 15, consommationMoyenneJour: 2800, scenarioMaintenant: { stockPrevuLivraisonL: 8000, margeJours: 6 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
    viserCamionComplet: true,
  });

  assert.strictEqual(global_.viserCamionComplet, true, 'viserCamionComplet exposé tel quel sur le retour, pour l\'écran (jamais recalculé côté HTML)');
  assert.ok(global_.optimisation.total > 11000, 'la complétion camion s\'est bien déclenchée à travers construireEvaluationGlobale (go complété)');
  assert.deepStrictEqual(Array.from(global_.optimisation.carburantsCompletes || []).sort(), ['go', 'sp95']);

  const globalSansParam = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, scenarioMaintenant: { stockPrevuLivraisonL: 500, margeJours: -1 } },
      go: { etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 15, consommationMoyenneJour: 2800, scenarioMaintenant: { stockPrevuLivraisonL: 8000, margeJours: 6 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.strictEqual(globalSansParam.viserCamionComplet, false, 'viserCamionComplet absent -> false explicite sur le retour, jamais undefined ambigu');
  assert.deepStrictEqual(Array.from(globalSansParam.optimisation.carburantsCompletes || []), [], 'sans le paramètre, aucune complétion — comportement historique');

  ok('construireEvaluationGlobale — viserCamionComplet se propage jusqu\'à l\'optimisation et jusqu\'au champ de retour exposé à l\'écran');
}

console.log(`\n${n}/${n} tests passés.`);
