// Test — Correction CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
// (lot autorisé par decision-1.md de l'audit CARBURANTS-PERFORMANCE-AUDIT-
// COMMANDE-20260906, APPROVED). Couvre nexus-carburant-commande-moteur.js —
// les trois ajouts de ce lot, STRICTEMENT additifs (aucune fonction
// existante non listée ci-dessous n'est modifiée dans son comportement) :
//
//   E1 — commandabilité du créneau, DISTINCTE de `jours_livraison_iso` :
//        estJourCommandePossible, prochainJourCommandePossible,
//        calculerFenetreLivraison (nouveaux champs commandeDirectementPossible/
//        prochaineDateCommandePossibleISO).
//   E2 — motif structuré de non-complétion camion (jamais un second calcul
//        côté écran) : completerVersCamionPlein (motifNonCompletion),
//        optimiserCommandeMultiCarburant (propagation),
//        construireEvaluationGlobale (fusion + formaterRaisonNonCompletion).
//   E3 — état CTA unique piloté par le moteur : etatCTA
//        ('preparer'/'simuler'/'aucune'), exposé par construireEvaluationGlobale.
//
// Reprend la numérotation de la matrice de recette exigée par audit-1.md
// (## Matrice de recette exigée avant clôture corrective, cas 1 à 14) dans
// les commentaires de chaque bloc, pour traçabilité directe. Les cas 8, 9,
// 10 (qualité des données/livraison en cours) portent sur une logique
// NON touchée par ce lot — déjà couverts par test_carburant_commande_moteur_v2238.js
// et non répétés ici (Article 11, jamais un second test qui recalcule la même
// preuve). Les cas 13 (rendu CTA mobile/desktop, NEXUS-Carburants-Pilotage-v1.html)
// et 14 (suite de non-régression complète) ne sont PAS exécutables depuis ce
// fichier moteur pur ni depuis ce canal (voir request-N.md du lot pour le
// détail de l'obstacle) — seule la logique `ctaEtat` qu'ils affichent est
// couverte ici.

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

const CONFIG_SANS_COMMANDE_ISO = {
  cutoff_heure: '11:00',
  jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 10000,
  maximum_camion_litres: 36000,
  compartiments_disponibles_litres: [2000, 5000, 7000],
  stock_securite_jours: 3,
};

const CONFIG_SAINTE_MARIE_TEST = { ...CONFIG_SANS_COMMANDE_ISO, jours_commande_iso: [1, 2, 3, 4, 5] };

// ------------------------------------------------------------
// 1) Rétrocompatibilité stricte (Article 11) — `jours_commande_iso` absent
//    de la config (tous les sites existants, avant ce lot) : la
//    commandabilité reste TOUJOURS vraie, jamais un `if (samedi)` implicite
//    qui casserait un site sans ce champ. Couvre l'exigence explicite de
//    audit-1.md : "conserver le comportement historique lorsqu'aucune
//    nouvelle règle de commandabilité n'est configurée".
// ------------------------------------------------------------
{
  ['2026-09-05', '2026-09-06', '2026-09-07'].forEach(d => { // sam./dim./lun.
    assert.strictEqual(M.estJourCommandePossible(d, CONFIG_SANS_COMMANDE_ISO), true, `${d} : commandable par défaut sans jours_commande_iso`);
  });
  assert.strictEqual(M.estJourCommandePossible('2026-09-05', null), true, 'config absente : jamais bloquant');
  assert.strictEqual(M.prochainJourCommandePossible('2026-09-05', CONFIG_SANS_COMMANDE_ISO), '2026-09-05', 'sans restriction, la date elle-même est déjà la prochaine commandable');

  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-05', heureCommandeHHMM: '09:00', // samedi 05/09/2026
    config: CONFIG_SANS_COMMANDE_ISO, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.commandeDirectementPossible, true, 'site SANS jours_commande_iso : samedi reste "directement commandable" (comportement historique, aucune régression)');

  ok('rétrocompatibilité E1 — jours_commande_iso absent = comportement historique strictement inchangé pour tous les sites qui ne le renseignent pas');
}

// ------------------------------------------------------------
// 2) Matrice cas 4 — "Samedi, lundi jour de livraison mais non commandable"
//    (écart E1 confirmé par l'audit, cas réel Sainte-Marie/Test) :
//    jours_commande_iso=[1..5] (bureau fournisseur fermé le week-end),
//    jours_livraison_iso=[1..5]. Un samedi doit résoudre livraisonISO=lundi
//    (comportement livraison inchangé) MAIS commandeDirectementPossible=false,
//    avec prochaineDateCommandePossibleISO=lundi (le créneau, PAS lundi comme
//    livraison "prête" — deux notions désormais distinctes).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-05', heureCommandeHHMM: '09:00', // samedi 05/09/2026, avant cutoff
    config: CONFIG_SAINTE_MARIE_TEST, joursFeriesISO: [],
  });
  assert.strictEqual(fenetre.livraisonISO, '2026-09-07', 'livraison inchangée : lundi 07/09 reste le prochain jour de LIVRAISON autorisé');
  assert.strictEqual(fenetre.commandeDirectementPossible, false, 'samedi : non directement commandable (bureau fournisseur fermé le week-end)');
  assert.strictEqual(fenetre.prochaineDateCommandePossibleISO, '2026-09-07', 'prochaine date où l\'on pourra RÉELLEMENT commander : lundi (pas le samedi même)');

  ok('E1, matrice cas 4 — samedi -> lundi livrable mais non commandable directement, distinction désormais explicite (jamais un if(samedi) codé en dur, config jours_commande_iso)');
}

// ------------------------------------------------------------
// 3) Matrice cas 5/6 — "Vendredi avant/après cutoff" : vendredi reste un
//    jour de commande valide dans LES DEUX CAS, même quand le cutoff décale
//    `dateEffective` (calcul de LIVRAISON) sur le samedi — E1 est évalué sur
//    le jour RÉEL de la commande (dateCommandeISO), jamais sur l'artifice
//    `dateEffective`, sans quoi un vendredi soir aurait été signalé à tort
//    comme non commandable.
// ------------------------------------------------------------
{
  const avantCutoff = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-04', heureCommandeHHMM: '09:00', // vendredi 04/09/2026, avant 11h
    config: CONFIG_SAINTE_MARIE_TEST, joursFeriesISO: [],
  });
  assert.strictEqual(avantCutoff.dateEffective, '2026-09-04', 'avant cutoff : la recherche part du vendredi lui-même');
  assert.strictEqual(avantCutoff.commandeDirectementPossible, true, 'cas 5 — vendredi avant cutoff : directement commandable');

  const apresCutoff = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-04', heureCommandeHHMM: '14:00', // vendredi 04/09/2026, après 11h
    config: CONFIG_SAINTE_MARIE_TEST, joursFeriesISO: [],
  });
  assert.strictEqual(apresCutoff.dateEffective, '2026-09-05', 'après cutoff : dateEffective décalée au samedi (calcul de LIVRAISON uniquement)');
  assert.strictEqual(apresCutoff.commandeDirectementPossible, true, 'cas 6 — vendredi après cutoff : reste commandable AUJOURD\'HUI (vendredi), le décalage de dateEffective ne doit jamais être confondu avec un jour de commande fermé');
  assert.strictEqual(apresCutoff.livraisonISO, '2026-09-07', 'créneau suivant calculé normalement (lundi), cutoff géré indépendamment de la commandabilité');

  ok('E1, matrice cas 5/6 — vendredi avant/après cutoff reste commandable ; dateEffective (délai de livraison) et commandabilité du jour réel ne sont jamais confondues');
}

// ------------------------------------------------------------
// 4) Matrice cas 7 — "Jour férié dans la chaîne -> aucun créneau
//    impossible" : régression de calculerFenetreLivraison (restructurée par
//    ce lot) — un jour férié en semaine ne doit toujours JAMAIS produire un
//    livraisonISO null tant qu'un jour valide existe dans les 21 jours de
//    recherche (logique de prochainJourLivraisonPossible, non modifiée par
//    ce lot, seulement ré-vérifiée après le refactor E1 de la fonction qui
//    l'appelle).
// ------------------------------------------------------------
{
  const fenetre = M.calculerFenetreLivraison({
    dateCommandeISO: '2026-09-03', heureCommandeHHMM: '09:00', // jeudi 03/09/2026
    config: CONFIG_SAINTE_MARIE_TEST, joursFeriesISO: ['2026-09-04'], // vendredi férié
  });
  assert.strictEqual(fenetre.livraisonISO, '2026-09-07', 'vendredi férié sauté, lundi retenu — aucun créneau impossible malgré le jour férié dans la chaîne');
  assert.notStrictEqual(fenetre.livraisonISO, null, 'jamais null tant qu\'un jour valide existe dans la fenêtre de recherche');

  ok('matrice cas 7 — jour férié dans la chaîne : livraisonISO reste résolu (aucune régression du refactor E1 sur calculerFenetreLivraison)');
}

// ------------------------------------------------------------
// 5) Matrice cas 2 — "35 000 L maximum sûr à cause capacité SP95" : motif
//    structuré E2, cause 'capacite_disponible'. sp95 seul, urgent, capacité
//    disponible 35 000 L (< 36 000 L visés) — la phase camion complet ne
//    peut pas dépasser cette capacité, quelle que soit la consommation.
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 11000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 35000 },
    viserCamionComplet: true,
  });

  assert.strictEqual(optim.decision, 'commander');
  assert.strictEqual(optim.total, 35000, 'plafonné exactement à la capacité disponible (35 000 L), jamais 36 000 L forcés');
  assert.ok(optim.motifNonCompletion, 'motif structuré présent : la cible camion complet (36 000 L) n\'a pas été atteinte');
  assert.strictEqual(optim.motifNonCompletion.ecartL, 1000, 'écart exact à la cible : 1 000 L');
  assert.deepStrictEqual(optim.motifNonCompletion.causes, [{ carburant: 'sp95', cause: 'capacite_disponible' }], 'cause structurée : capacité disponible insuffisante sur sp95, jamais une prose seule à reparser côté écran');

  ok('E2, matrice cas 2 — 35 000 L bornés par la capacité disponible SP95 : motif structuré {ecartL, causes:[{carburant,cause}]} porté par le moteur');
}

// ------------------------------------------------------------
// 6) Matrice cas 3 — "35 000 L maximum sûr à cause plafond anti-surstock
//    GO" : motif structuré E2, cause 'plafond_autonomie' (garde-fou
//    SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION=20, logique déjà éprouvée par
//    test_carburant_commande_camion_complet_v2245.js, bloc 4 — ici vérifiée
//    au niveau du NOUVEAU champ motifNonCompletion qu'elle alimente).
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      go: { etat: 'securite', besoinMinimumSecuriteL: 5000, joursAvantBesoin: 0, consommationMoyenneJour: 1000, stockPrevuLivraisonL: 0 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { go: 40000 }, // capacité largement suffisante : seule l'autonomie bloque
    viserCamionComplet: true,
  });

  assert.strictEqual(optim.total, 20000, 'plafonné par l\'autonomie (1000 L/j * 20 j), pas par la capacité (40 000 L) ni le maximum camion (36 000 L)');
  assert.ok(optim.motifNonCompletion, 'motif structuré présent');
  assert.strictEqual(optim.motifNonCompletion.ecartL, 16000, 'écart exact à la cible : 36 000 - 20 000 L');
  assert.deepStrictEqual(optim.motifNonCompletion.causes, [{ carburant: 'go', cause: 'plafond_autonomie' }], 'cause structurée distincte de la capacité : plafond anti-surstock atteint sur go');

  ok('E2, matrice cas 3 — 35/36 000 L bornés par le plafond anti-surstock GO : cause structurée "plafond_autonomie", distincte de "capacite_disponible"');
}

// ------------------------------------------------------------
// 7) Matrice cas 11 — non-régression du mode normal (minimum camion, sans
//    viser 36 000 L) : `motifNonCompletion` ne doit JAMAIS apparaître quand
//    `viserCamionComplet` est absent/false, même si le total reste très en
//    dessous du maximum camion — ce n'est PAS une anomalie en mode normal,
//    jamais une fausse alerte sur la quasi-totalité des commandes usuelles
//    (même esprit que le seuil "2 signaux négatifs" de
//    detailQualiteDonneesCommande, déjà établi dans ce fichier).
// ------------------------------------------------------------
{
  const optimSansViser = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0, consommationMoyenneJour: 3200, stockPrevuLivraisonL: 500 },
      go: { etat: 'a_anticiper', besoinMinimumSecuriteL: 5000, joursAvantBesoin: 2, consommationMoyenneJour: 2800, stockPrevuLivraisonL: 8000 },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.strictEqual(optimSansViser.total, 12000, 'total historique inchangé (§14), toujours 12 000 L');
  assert.strictEqual(optimSansViser.motifNonCompletion, null, 'aucune complétion tentée sans viserCamionComplet -> aucun motif de non-complétion (jamais de fausse alerte en mode normal)');

  ok('non-régression, matrice cas 11 — mode normal (sans viserCamionComplet) : jamais de motifNonCompletion, même très sous le maximum camion');
}

// ------------------------------------------------------------
// 8) construireEvaluationGlobale — assemblage complet : matrice cas 1
//    ("camion 36 000 L atteignable -> CTA preparer") vs. cas 2/3 fusionnés
//    ("35 000 L -> arbitrage -> CTA simuler"), et l'effet du créneau (E1)
//    sur ctaEtat même quand le camion EST complet à la cible.
// ------------------------------------------------------------
{
  const evSp95Complet = {
    etat: 'securite', besoinMinimumSecuriteL: 20000, joursAvantBesoin: 0,
    consommationMoyenneJour: 3000, capaciteDisponibleL: 30000,
    scenarioMaintenant: { stockPrevuLivraisonL: 500, margeJours: 1, commandeDirectementPossible: true, prochaineDateCommandePossibleISO: '2026-09-07' },
  };
  const evGoComplet = {
    etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 15,
    consommationMoyenneJour: 2500, capaciteDisponibleL: 30000,
    scenarioMaintenant: { stockPrevuLivraisonL: 8000, margeJours: 3, commandeDirectementPossible: true, prochaineDateCommandePossibleISO: '2026-09-07' },
  };

  // Cas 1 — camion 36 000 L atteignable, créneau directement commandable.
  const globalComplet = M.construireEvaluationGlobale({
    evaluationsParCarburant: { sp95: evSp95Complet, go: evGoComplet },
    config: CONFIG_SAINTE_MARIE_TEST,
    capacitesDisponiblesL: { sp95: 30000, go: 30000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(globalComplet.commandeRecommandee.total, 36000, 'matrice cas 1 : camion complété exactement à 36 000 L');
  assert.strictEqual(globalComplet.commandeRecommandee.motifNonCompletion, undefined, 'aucun motif de non-complétion quand la cible est atteinte');
  assert.strictEqual(globalComplet.commandeDirectementPossible, true, 'créneau directement commandable (lu depuis scenarioMaintenant)');
  assert.strictEqual(globalComplet.ctaEtat, 'preparer', 'matrice cas 1 — CTA "preparer" : recommandation directement commandable, aucun arbitrage ouvert');

  // Cas 2/3 — capacité SP95 limitée à 35 000 L au total : arbitrage ouvert.
  const globalArbitrage = M.construireEvaluationGlobale({
    evaluationsParCarburant: { sp95: evSp95Complet, go: evGoComplet },
    config: CONFIG_SAINTE_MARIE_TEST,
    capacitesDisponiblesL: { sp95: 30000, go: 5000 },
    viserCamionComplet: true,
  });
  assert.ok(globalArbitrage.commandeRecommandee.total < 36000, 'total sous la cible (capacité go limitée)');
  assert.ok(globalArbitrage.commandeRecommandee.motifNonCompletion, 'motif structuré présent, exposé jusqu\'à ctx.commandeRecommandee.motifNonCompletion pour l\'écran');
  assert.strictEqual(typeof globalArbitrage.commandeRecommandee.motifNonCompletion.raison, 'string', 'une prose UNIQUE, déjà formatée par le moteur (formaterRaisonNonCompletion), jamais reconstruite côté écran');
  assert.strictEqual(globalArbitrage.ctaEtat, 'simuler', 'matrice cas 2/3 — CTA "simuler" : arbitrage quantité ouvert (camion non complété à la cible)');

  // Créneau non commandable (E1) alors même que le camion serait complet à
  // la cible (E2 fermé) — l'arbitrage calendrier suffit SEUL à faire
  // basculer le CTA en 'simuler' (E1 et E2 sont deux gardes indépendantes).
  const evSp95NonCommandable = { ...evSp95Complet, scenarioMaintenant: { ...evSp95Complet.scenarioMaintenant, commandeDirectementPossible: false, prochaineDateCommandePossibleISO: '2026-09-07' } };
  const globalCreneauFerme = M.construireEvaluationGlobale({
    evaluationsParCarburant: { sp95: evSp95NonCommandable, go: evGoComplet },
    config: CONFIG_SAINTE_MARIE_TEST,
    capacitesDisponiblesL: { sp95: 30000, go: 30000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(globalCreneauFerme.commandeRecommandee.total, 36000, 'camion complet à la cible malgré le créneau fermé (E1 et E2 restent des calculs indépendants)');
  assert.strictEqual(globalCreneauFerme.commandeDirectementPossible, false, 'créneau non commandable aujourd\'hui');
  assert.strictEqual(globalCreneauFerme.ctaEtat, 'simuler', 'matrice cas 4 combiné à la conclusion 5 de decision-1.md — créneau non commandable => CTA "simuler" même si la quantité, elle, est complète');

  ok('construireEvaluationGlobale — ctaEtat piloté par E1 (créneau) ET E2 (quantité) combinés, reflète l\'état réel plutôt qu\'un CTA "Préparer" trop affirmatif (conclusion 5, decision-1.md)');
}

// ------------------------------------------------------------
// 9) etatCTA — unité, les 3 états et leurs bornes exactes (E3 : un seul
//    état pilote un seul bouton, jamais un second CTA redondant).
// ------------------------------------------------------------
{
  assert.strictEqual(M.etatCTA({ commandeRecommandee: null, commandeDirectementPossible: true }), 'aucune', 'aucune commande recommandée -> aucune CTA');
  assert.strictEqual(M.etatCTA({ commandeRecommandee: { volumes: { sp95: 10000 }, total: 10000 }, commandeDirectementPossible: true }), 'preparer', 'commande directement commandable, aucun arbitrage -> preparer');
  assert.strictEqual(M.etatCTA({ commandeRecommandee: { volumes: { sp95: 10000 }, total: 10000 }, commandeDirectementPossible: false }), 'simuler', 'créneau non commandable seul -> simuler');
  assert.strictEqual(M.etatCTA({
    commandeRecommandee: { volumes: { sp95: 10000 }, total: 10000, motifNonCompletion: { ecartL: 1000, causes: [] } },
    commandeDirectementPossible: true,
  }), 'simuler', 'arbitrage quantité seul -> simuler');

  ok('E3, etatCTA — trois états exacts (aucune/preparer/simuler), chacune des deux gardes (E1, E2) suffit seule à basculer en "simuler"');
}

console.log(`\n${n} bloc(s) de test — test_carburant_commande_creneau_cta_v2308.js OK.`);
