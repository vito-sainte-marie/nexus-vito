// Test — Moteur Commande Carburant (nexus-carburant-commande-moteur.js)
// (24/08/2026, v2.238, cahier fonctionnel/technique complet transmis par
// Frédéric : "NEXUS — Moteur Commande Carburant". Couvre le cœur du
// moteur — calendrier de livraison, prévision pondérée, stock prévisionnel,
// 4 états, optimisation multi-carburant, qualité des données — en
// reproduisant autant que possible les exemples chiffrés du cahier
// lui-même (§6, §13, §14, §15), plutôt que des valeurs inventées sans
// rapport avec la demande réelle.
//
// §17-19 (optimisation tarifaire) est explicitement HORS PÉRIMÈTRE de ce
// lot (décision actée avec Frédéric) — aucun test ici ne porte dessus, le
// moteur lui-même n'a aucune fonction de comparaison de prix.

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

const CONFIG = {
  cutoff_heure: '11:00',
  jours_livraison_iso: [1, 2, 3, 4, 5],
  minimum_camion_litres: 10000,
  maximum_camion_litres: 36000,
  compartiments_disponibles_litres: [2000, 5000, 7000],
  stock_securite_jours: 3,
};

// Construit un historique synthétique constant (utile pour isoler la
// logique calendrier/stock des aléas de la prévision elle-même).
function historiqueConstant(carburant, valeurParJour, debutISO, finISOExclu) {
  const lignes = [];
  let cursor = debutISO;
  while (cursor < finISOExclu) {
    lignes.push({ date: cursor, ventes: { [carburant]: valeurParJour } });
    cursor = M.ajouterJoursISO(cursor, 1);
  }
  return lignes;
}

// ------------------------------------------------------------
// 1) Calendrier — cutoff 11h, livraison lun-ven, jours fériés (§4).
// ------------------------------------------------------------
{
  // Lundi (2026-08-24) avant cutoff -> prochain jour de livraison = mardi.
  assert.strictEqual(M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-24', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] }).livraisonISO, '2026-08-25');
  // Vendredi avant cutoff -> lundi (jamais samedi/dimanche) — l'exemple exact du cahier §13.
  assert.strictEqual(M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-21', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [] }).livraisonISO, '2026-08-24');
  // Vendredi APRÈS cutoff -> traité comme commandé samedi -> toujours lundi (le week-end n'ajoute rien de plus après un vendredi déjà raté avant 11h... ici on vérifie juste que le calcul ne casse pas et reste cohérent).
  const apresCutoff = M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-21', heureCommandeHHMM: '14:00', config: CONFIG, joursFeriesISO: [] });
  assert.strictEqual(apresCutoff.avantCutoff, false);
  assert.strictEqual(apresCutoff.livraisonISO, '2026-08-24');
  // Jour férié un mardi -> livraison reportée au mercredi.
  const avecFerie = M.calculerFenetreLivraison({ dateCommandeISO: '2026-08-24', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: ['2026-08-25'] });
  assert.strictEqual(avecFerie.livraisonISO, '2026-08-26');
  ok('calendrier — cutoff 11h, week-end et jours fériés exclus de la livraison (§4)');
}

// ------------------------------------------------------------
// 2) Prévision pondérée — même jour de semaine prioritaire (§8).
// ------------------------------------------------------------
{
  // Historique : tous les samedis à 2500L, tous les autres jours à 1500L.
  const historique = [];
  let cursor = '2026-06-01';
  while (cursor < '2026-08-21') {
    const estSamedi = M.jourSemaineIso(cursor) === 6;
    historique.push({ date: cursor, ventes: { sp95: estSamedi ? 2500 : 1500 } });
    cursor = M.ajouterJoursISO(cursor, 1);
  }
  // Prévoir un samedi (2026-08-22) doit se rapprocher de 2500, pas de 1500
  // (cahier §8 : "il vaut mieux regarder les derniers samedis comparables
  // que la moyenne lundi->dimanche").
  const prevSamedi = M.prevoirConsommationJour({ historiqueParJour: historique, carburant: 'sp95', dateCibleISO: '2026-08-22' });
  assert.ok(prevSamedi.prevision > 2000, `prévision samedi devrait être proche de 2500 (obtenu ${prevSamedi.prevision})`);
  const prevLundi = M.prevoirConsommationJour({ historiqueParJour: historique, carburant: 'sp95', dateCibleISO: '2026-08-24' });
  assert.ok(prevLundi.prevision < 2000, `prévision lundi devrait être proche de 1500 (obtenu ${prevLundi.prevision})`);
  // Aucune donnée du tout -> non_calculable, jamais un chiffre inventé.
  const vide = M.prevoirConsommationJour({ historiqueParJour: [], carburant: 'sp95', dateCibleISO: '2026-08-22' });
  assert.strictEqual(vide.prevision, null);
  assert.strictEqual(vide.confiance, 'non_calculable');
  ok('prévision pondérée — le jour de semaine comparable domine, jamais une simple moyenne plate (§8)');
}

// ------------------------------------------------------------
// 3) Prévision sur fenêtre — honnêteté stricte (un seul jour manquant rend
//    toute la fenêtre non calculable, jamais une somme partielle). Un jour
//    cible loin dans le futur retrouve quand même un même-jour-de-semaine
//    historique (comportement voulu — la recherche remonte aussi loin que
//    nécessaire) : pour tester un vrai "trou", on utilise un carburant
//    totalement absent de l'historique plutôt qu'une date lointaine.
// ------------------------------------------------------------
{
  const historique = historiqueConstant('sp95', 1000, '2026-06-01', '2026-08-01');
  const fenetreOk = M.prevoirConsommationFenetre({ historiqueParJour: historique, carburant: 'sp95', datesCiblesISO: ['2026-07-30', '2026-07-31'], joursFeriesISO: [] });
  assert.strictEqual(fenetreOk.total, 2000);
  const fenetreTrouee = M.prevoirConsommationFenetre({ historiqueParJour: historique, carburant: 'gnr', datesCiblesISO: ['2026-07-30', '2026-07-31'], joursFeriesISO: [] });
  assert.strictEqual(fenetreTrouee.total, null, 'un carburant sans aucune donnée historique doit rendre la fenêtre entière non calculable');
  assert.strictEqual(fenetreTrouee.confiance, 'non_calculable');
  // Une date loin dans le futur retrouve bien un même-jour-de-semaine
  // historique (comportement voulu, pas un bug) — confirmé explicitement.
  const fenetreLointaine = M.prevoirConsommationFenetre({ historiqueParJour: historique, carburant: 'sp95', datesCiblesISO: ['2026-12-25'], joursFeriesISO: [] });
  assert.ok(fenetreLointaine.total != null, 'une date lointaine doit quand même retrouver un même-jour-de-semaine dans l\'historique disponible');
  ok('prévision sur fenêtre — jamais une somme partielle présentée comme complète ; une date lointaine retrouve bien l\'historique du même jour de semaine');
}

// ------------------------------------------------------------
// 4) Stock prévisionnel à la livraison + intégration commande en cours (§9-10, exemple exact du cahier).
// ------------------------------------------------------------
{
  assert.strictEqual(M.stockPrevuLivraison({ dernierStockFiable: 20000, livraisonsIntermediaires: 0, ventesPrevuesJusquaLivraison: 3000 }), 17000);
  assert.strictEqual(M.stockPrevuLivraison({ dernierStockFiable: null, livraisonsIntermediaires: 0, ventesPrevuesJusquaLivraison: 3000 }), null);
  assert.strictEqual(M.capaciteDisponibleLivraison(28761, 17000), 11761);
  assert.strictEqual(M.capaciteDisponibleLivraison(28761, 30000), 0, 'jamais une capacité négative');

  // Exemple exact §10 : SP95 physique 12 600 L, commande déjà passée 15 000 L,
  // livraison prévue demain -> stock avant réception 10 900 L, après réception 25 900 L.
  const integ = M.integrerCommandeEnCours({ stockActuelL: 12600, commandeEnCours: { volumeL: 15000, livraisonPrevueLe: '2026-08-25' }, ventesPrevuesJusquaReception: 1700 });
  assert.strictEqual(integ.stockAvantReception, 10900);
  assert.strictEqual(integ.stockApresReception, 25900);
  ok('stock prévisionnel à la livraison + intégration d\'une commande déjà en cours — reproduit l\'exemple exact du cahier §10');
}

// ------------------------------------------------------------
// 5) Les 4 états + coût de l'attente — exemple vendredi §13 (attendre doit
//    TOUJOURS être au moins aussi défavorable que commander maintenant,
//    jamais l'inverse — c'était un vrai bug corrigé pendant ce lot).
// ------------------------------------------------------------
{
  const historique = historiqueConstant('sp95', 1700, '2026-06-01', '2026-08-21');
  const argsBase = {
    carburant: 'sp95', maintenantISO: '2026-08-21', heureMaintenantHHMM: '09:30',
    config: CONFIG, joursFeriesISO: [], limiteRemplissageL: 28761,
    consommationMoyenneJour: 1700, historiqueParJour: historique,
    commandeEnCoursVolumeL: 0, stockFiable: true,
  };
  const evalVendredi = M.evaluerCarburant({ ...argsBase, stockActuelL: 1700 * 5.1 });
  assert.ok(evalVendredi.scenarioAttente.margeJours <= evalVendredi.scenarioMaintenant.margeJours,
    `attendre ne doit jamais donner une meilleure marge que commander maintenant (maintenant=${evalVendredi.scenarioMaintenant.margeJours}, attendre=${evalVendredi.scenarioAttente.margeJours})`);
  assert.ok(evalVendredi.scenarioAttente.livraisonISO > evalVendredi.scenarioMaintenant.livraisonISO, 'attendre doit repousser la date de livraison, jamais l\'avancer ni la laisser identique après un vendredi');

  // Stock très confortable -> 'confortable', jamais 'securite'/'moment_ideal'.
  const evalConfortable = M.evaluerCarburant({ ...argsBase, stockActuelL: 1700 * 15 });
  assert.strictEqual(evalConfortable.etat, 'confortable');

  // evaluerAttenteCommande — recommandation cohérente avec l'état.
  const attenteVendredi = M.evaluerAttenteCommande({ scenarioMaintenant: evalVendredi.scenarioMaintenant, scenarioAttente: evalVendredi.scenarioAttente });
  if (evalVendredi.scenarioAttente.margeJours < 0) assert.strictEqual(attenteVendredi.recommandation, 'commander_maintenant');
  ok('4 états + evaluerAttenteCommande — attendre est toujours au moins aussi défavorable que commander maintenant (§7, §11-13, §21)');
}

// ------------------------------------------------------------
// 6) Arrondi au millier + minimum camion — exemple exact §6.
// ------------------------------------------------------------
{
  assert.strictEqual(M.arrondirVolumeCommande(13200, { margeSecuriteOk: true }), 13000);
  assert.strictEqual(M.arrondirVolumeCommande(13200, { margeSecuriteOk: false }), 14000);
  assert.strictEqual(M.arrondirVolumeCommande(null, {}), null);
  const min1 = M.verifierMinimumCamion(6000, 10000);
  assert.strictEqual(min1.valide, false);
  assert.strictEqual(min1.manqueL, 4000);
  const min2 = M.verifierMinimumCamion(12000, 10000);
  assert.strictEqual(min2.valide, true);
  ok('arrondi au millier (inférieur par défaut, supérieur si sécurité compromise) + vérification du minimum camion (§6)');
}

// ------------------------------------------------------------
// 7) Optimisation multi-carburant — exemple exact §14 (SP95 7000L urgent +
//    GO 5000L à anticiper sous 2j -> commande combinée 12 000 L).
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0 },
      go: { etat: 'a_anticiper', besoinMinimumSecuriteL: 5000, joursAvantBesoin: 2 },
    },
    minimumCamionL: 10000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.strictEqual(optim.decision, 'commander');
  assert.strictEqual(optim.total, 12000);
  // Array.from() : les objets créés dans la sandbox vm appartiennent à un
  // autre "realm" JS — deepStrictEqual peut les juger non reference-egaux
  // même à contenu identique ; on compare via des tableaux natifs de CE
  // realm (test), jamais un problème du moteur lui-même.
  assert.deepStrictEqual(Array.from(optim.carburantsAnticipes), ['go']);
  ok('optimisation multi-carburant — combine SP95 urgent + GO proche pour atteindre le minimum camion (§14)');
}

// ------------------------------------------------------------
// 8) Exemple exact §15 — un carburant confortable pendant encore 8 jours ne
//    doit JAMAIS être avancé juste pour remplir le camion.
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0 },
      go: { etat: 'confortable', besoinMinimumSecuriteL: 3000, joursAvantBesoin: 8 },
    },
    minimumCamionL: 10000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.ok(!optim.volumesRetenus.go, 'GO (confortable, 8 jours) ne doit jamais être inclus dans la commande');
  assert.strictEqual(optim.decision, 'commander', 'SP95 seul reste urgent -- la commande doit tout de même avoir lieu, complétée sur SP95 lui-même (§16/§20)');
  assert.ok(optim.total >= 10000);
  ok('optimisation multi-carburant — un carburant confortable à 8 jours n\'est jamais avancé juste pour remplir le camion (§15)');
}

// ------------------------------------------------------------
// 9) Aucun carburant urgent -> attendre, jamais une commande forcée.
// ------------------------------------------------------------
{
  const optim = M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'confortable', besoinMinimumSecuriteL: 4000, joursAvantBesoin: 10 },
      go: { etat: 'a_anticiper', besoinMinimumSecuriteL: 3000, joursAvantBesoin: 6 },
    },
    minimumCamionL: 10000,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.strictEqual(optim.decision, 'attendre');
  ok('optimisation multi-carburant — aucun carburant urgent -> NEXUS recommande d\'attendre, ne force jamais un camion');
}

// ------------------------------------------------------------
// 10) Qualité des données (§28-29) — jamais une fausse précision.
// ------------------------------------------------------------
{
  assert.strictEqual(M.qualiteDonneesCommande({ stockFiable: false, previsionConfiance: 'fiable' }), 'non_calculable');
  assert.strictEqual(M.qualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'non_calculable' }), 'non_calculable');
  assert.strictEqual(M.qualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'a_confirmer' }), 'a_confirmer');
  assert.strictEqual(M.qualiteDonneesCommande({ stockFiable: true, previsionConfiance: 'fiable' }), 'fiable');
  ok('qualité des données — 3 niveaux honnêtes, jamais une précision affichée sans base suffisante (§28-29)');
}

// ------------------------------------------------------------
// 11) Cas limites — jamais une exception (Article 5 : robustesse avant tout).
// ------------------------------------------------------------
{
  assert.doesNotThrow(() => M.evaluerScenarioCommande({ dateCommandeISO: '2026-08-21', heureCommandeHHMM: '09:00', config: null, joursFeriesISO: [], stockActuelL: null, consommationMoyenneJour: null, historiqueParJour: [], carburant: 'sp95' }));
  assert.strictEqual(M.evaluerScenarioCommande({ dateCommandeISO: '2026-08-21', heureCommandeHHMM: '09:00', config: null, joursFeriesISO: [], stockActuelL: null, consommationMoyenneJour: null, historiqueParJour: [], carburant: 'sp95' }), null);
  assert.strictEqual(M.determinerEtatCommande({ scenarioMaintenant: null }).etat, 'non_calculable');
  assert.strictEqual(M.optimiserCommandeMultiCarburant({ parCarburant: {}, minimumCamionL: 10000 }).decision, 'attendre');
  assert.doesNotThrow(() => M.construireEvaluationGlobale({ evaluationsParCarburant: {}, config: CONFIG, capacitesDisponiblesL: {} }));
  ok('cas limites — config/stock/historique absents : jamais une exception, toujours un état honnête (non_calculable/attendre)');
}

// ------------------------------------------------------------
// 12) construireEvaluationGlobale — objet complet §27, état global = pire état.
// ------------------------------------------------------------
{
  const historiqueSp95 = historiqueConstant('sp95', 1700, '2026-06-01', '2026-08-21');
  const historiqueGo = historiqueConstant('go', 1400, '2026-06-01', '2026-08-21');
  const historique = historiqueSp95.map((l, i) => ({ date: l.date, ventes: { sp95: l.ventes.sp95, go: historiqueGo[i].ventes.go } }));

  const evalSp95 = M.evaluerCarburant({
    carburant: 'sp95', maintenantISO: '2026-08-21', heureMaintenantHHMM: '09:30', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 1700 * 2, limiteRemplissageL: 28761, consommationMoyenneJour: 1700, historiqueParJour: historique,
    commandeEnCoursVolumeL: 0, stockFiable: true,
  });
  const evalGo = M.evaluerCarburant({
    carburant: 'go', maintenantISO: '2026-08-21', heureMaintenantHHMM: '09:30', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 1400 * 15, limiteRemplissageL: 28553, consommationMoyenneJour: 1400, historiqueParJour: historique,
    commandeEnCoursVolumeL: 0, stockFiable: true,
  });
  const global = M.construireEvaluationGlobale({
    evaluationsParCarburant: { sp95: evalSp95, go: evalGo }, config: CONFIG,
    capacitesDisponiblesL: { sp95: 28761, go: 28553 },
  });
  assert.strictEqual(global.etatGlobal, evalSp95.etat === 'confortable' ? evalGo.etat : evalSp95.etat, 'l\'état global doit être le pire des deux, jamais une moyenne');
  if (global.optimisation.decision === 'commander') {
    assert.ok(global.commandeRecommandee.total >= CONFIG.minimum_camion_litres, 'une commande recommandée doit toujours respecter le minimum camion');
  }
  ok('construireEvaluationGlobale — assemble l\'objet complet §27, état global = pire état (jamais une moyenne)');
}

// ------------------------------------------------------------
// 13) P0 (25/08/2026, retour de Frédéric) — l'arrondi "sécurité" ne doit
//    JAMAIS dépasser la capacité physique disponible à la livraison. Cas
//    réel reproduit tel quel (vito-sainte-marie, SP95) : besoin théorique
//    23 170 L, arrondi supérieur naturel 24 000 L (margeSecuriteOk=false),
//    mais la capacité disponible n'est QUE de 23 170 L -- la commande
//    recommandée ne doit jamais dépasser ce plafond physique, même au prix
//    de rester sous l'arrondi "sécurité" (priorité du cahier : "sécurité >
//    capacité physique > réserve 3 jours [...]").
// ------------------------------------------------------------
{
  const global1 = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 23170, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: -1.3 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 23170 },
  });
  assert.strictEqual(global1.optimisation.decision, 'commander');
  assert.ok(global1.commandeRecommandee.volumes.sp95 <= 23170,
    `le volume recommandé (${global1.commandeRecommandee.volumes.sp95} L) ne doit jamais dépasser la capacité disponible (23170 L)`);
  assert.strictEqual(global1.commandeRecommandee.volumes.sp95, 23170, 'plafonné exactement à la capacité disponible, pas arrondi au-delà');

  // Filet de sécurité (complément pour atteindre le minimum camion) : ne
  // doit pas non plus pousser un carburant au-delà de sa propre capacité.
  // Besoins bruts sp95=7500/go=2900 (total brut 10400, >= minimum -> optim
  // décide "commander"), mais l'ARRONDI (toujours au millier inférieur ici)
  // fait retomber le total à 9000 (sp95 7000 + go 2000), sous le minimum
  // camion. sp95 est déjà à son plafond de capacité (7000) -- le complément
  // doit aller sur go (qui a encore de la marge jusqu'à 6000), jamais
  // dépasser 7000 sur sp95.
  const global2 = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7500, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: 0.5 } },
      go: { etat: 'a_anticiper', besoinMinimumSecuriteL: 2900, joursAvantBesoin: 1, scenarioMaintenant: { margeJours: 4 } },
    },
    config: CONFIG, // minimum_camion_litres: 10000
    capacitesDisponiblesL: { sp95: 7000, go: 6000 },
  });
  assert.strictEqual(global2.optimisation.decision, 'commander');
  assert.strictEqual(global2.commandeRecommandee.volumes.sp95, 7000, 'sp95 (saturé) ne doit jamais être bumpé au-delà de sa capacité disponible');
  assert.strictEqual(global2.commandeRecommandee.volumes.go, 3000, 'le complément du filet de sécurité doit aller sur go, qui a encore de la marge');
  assert.strictEqual(global2.commandeRecommandee.total, 10000, 'le filet de sécurité doit atteindre le minimum camion en utilisant la marge disponible sur go');

  // Cas extrême : le besoin brut (10 500 L) atteint le minimum camion et
  // l'optimisation décide "commander", mais l'arrondi/plafonnement à la
  // capacité disponible (9 500 L, plus petite que le besoin brut) fait
  // retomber le total sous le minimum camion, SANS aucune marge restante
  // pour un filet de sécurité -- la commande reste honnêtement sous le
  // minimum plutôt que de fabriquer un volume physiquement impossible
  // (Article 5).
  const global3 = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 10500, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: 0.5 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 9500 },
  });
  assert.strictEqual(global3.optimisation.decision, 'commander');
  assert.strictEqual(global3.commandeRecommandee.volumes.sp95, 9500, 'jamais au-delà de la capacité disponible, même si le total reste sous le minimum camion');
  assert.ok(global3.commandeRecommandee.total < CONFIG.minimum_camion_litres, 'reste honnêtement sous le minimum camion plutôt que de dépasser la capacité physique');
  ok('P0 — arrondi et filet de sécurité minimum camion jamais au-delà de la capacité physique disponible à la livraison');
}

// ------------------------------------------------------------
// 14) Audit développeur (25/08/2026, "NEXUS — Règles du moteur de commande
//    carburant", cahier transmis par Frédéric) — tests explicites du §15
//    "Tests de non-régression indispensables" et du §16 "Critères GO/NO-GO".
//    §15/§16 "Données du jour partielles", "Commande déjà passée" et
//    "Camion recommandé 8 000 L" sont déjà couverts respectivement par les
//    tests §28-29 (qualité des données, bloc 10), l'intégration
//    commandeEnCoursVolumeL (bloc 4) et le cas insuffisant_meme_optimise
//    (global3 du bloc 13, 9500 L < minimum 10000 L) — non dupliqués ici.
// ------------------------------------------------------------
{
  // a) "Capacité SP disponible 23 170 L — Le volume conseillé ne peut pas
  //    dépasser cette capacité et n'est pas automatiquement égal à
  //    23 170 L." Root cause corrigée ce même jour : evaluerCarburant()
  //    confondait besoinTheoriqueL et capaciteDisponibleLivraison(...),
  //    violant la "Règle absolue" du cahier (page 2). Reproduit le cas réel
  //    vito-sainte-marie avec des chiffres réels (conso. moyenne SP95
  //    observée mi-août ~3100 L/j, réserve 3 j ~9300 L, stock prévu à la
  //    livraison 5591 L -> besoin minimum de sécurité réel 3709 L, PAS
  //    23170 L).
  const besoinMinimumSecuriteL = Math.max(0, 9300 - 5591); // 3709 L
  const auditA = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: -1.3 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 23170 },
  });
  assert.strictEqual(auditA.optimisation.decision, 'commander');
  const volumeConseilleA = auditA.commandeRecommandee.volumes.sp95;
  assert.ok(volumeConseilleA <= 23170, `jamais au-delà de la capacité disponible : ${volumeConseilleA} L`);
  assert.notStrictEqual(volumeConseilleA, 23170, "le volume conseillé n'est pas automatiquement égal à la capacité disponible (23170 L)");
  assert.ok(volumeConseilleA < 15000, `le volume conseillé doit rester proche du besoin réel de sécurité, pas de la capacité : ${volumeConseilleA} L`);
  ok('audit §11/§16 — capacité SP disponible 23 170 L : le volume conseillé (' + volumeConseilleA + ' L) reste distinct de la capacité, jamais automatiquement égal');

  // b) "Besoin SP 13 200 L — Le moteur compare 13 000 et 14 000 L selon
  //    sécurité et cycle suivant."
  assert.strictEqual(M.arrondirVolumeCommande(13200, { margeSecuriteOk: true }), 13000, 'arrondi inférieur quand la sécurité est déjà assurée');
  assert.strictEqual(M.arrondirVolumeCommande(13200, { margeSecuriteOk: false }), 14000, 'arrondi supérieur quand la sécurité ne serait pas assurée sinon');
  ok('audit §15 — besoin SP 13 200 L : comparaison 13 000 L / 14 000 L selon la marge de sécurité');

  // c) "Camion recommandé 38 000 L — Refus : maximum 36 000 L.
  //    Recomposition obligatoire." Deux carburants urgents dont la somme
  //    des besoins arrondis (21000 + 17000 = 38000 L) dépasse le plafond
  //    camion — le moteur ne doit ni refuser silencieusement ni dépasser
  //    36 000 L : il recompose en réduisant le plus gros volume par pas de
  //    1000 L.
  const auditC = M.construireEvaluationGlobale({
    evaluationsParCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 21000, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: -1 } },
      go: { etat: 'securite', besoinMinimumSecuriteL: 17000, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: -1 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 25000, go: 25000 },
  });
  assert.strictEqual(auditC.optimisation.decision, 'commander');
  assert.ok(auditC.commandeRecommandee.total <= 36000, `jamais au-delà du plafond camion : ${auditC.commandeRecommandee.total} L`);
  assert.strictEqual(auditC.commandeRecommandee.total, 36000, 'recomposition jusqu\'au plafond exact, pas un simple refus');
  assert.ok(auditC.commandeRecommandee.volumes.sp95 < 21000, 'le volume initialement le plus élevé (sp95) est celui réduit par la recomposition');
  ok('audit §3/§15/§16 — camion recommandé 38 000 L -> recomposé à 36 000 L, jamais refusé silencieusement ni dépassé');

  // d) "Calcul rejoué deux fois — Même résultat, aucun doublon de commande
  //    ou d'alerte." Le moteur est pur (Article 11) : deux appels avec un
  //    input identique (mais des objets distincts, jamais la même
  //    référence) doivent produire un résultat strictement identique.
  const inputRejoue = {
    evaluationsParCarburant: {
      sp95: { etat: 'moment_ideal', besoinMinimumSecuriteL: 7000, joursAvantBesoin: 0, scenarioMaintenant: { margeJours: 0.5 } },
      go: { etat: 'confortable', besoinMinimumSecuriteL: 0, joursAvantBesoin: 8, scenarioMaintenant: { margeJours: 6 } },
    },
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 15000, go: 15000 },
  };
  const rejoue1 = M.construireEvaluationGlobale(JSON.parse(JSON.stringify(inputRejoue)));
  const rejoue2 = M.construireEvaluationGlobale(JSON.parse(JSON.stringify(inputRejoue)));
  assert.deepStrictEqual(rejoue1, rejoue2, 'un calcul rejoué à l\'identique doit produire exactement le même résultat');
  assert.strictEqual(rejoue1.commandeRecommandee.total, rejoue2.commandeRecommandee.total);
  ok("audit §15 — calcul rejoué deux fois : même résultat, aucune dérive");
}

console.log(`\n${n}/${n} tests passés — Moteur Commande Carburant (v2.238).`);
