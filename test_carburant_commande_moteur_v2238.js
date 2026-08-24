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
      sp95: { etat: 'moment_ideal', besoinTheoriqueL: 7000, joursAvantBesoin: 0 },
      go: { etat: 'a_anticiper', besoinTheoriqueL: 5000, joursAvantBesoin: 2 },
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
      sp95: { etat: 'moment_ideal', besoinTheoriqueL: 7000, joursAvantBesoin: 0 },
      go: { etat: 'confortable', besoinTheoriqueL: 3000, joursAvantBesoin: 8 },
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
      sp95: { etat: 'confortable', besoinTheoriqueL: 4000, joursAvantBesoin: 10 },
      go: { etat: 'a_anticiper', besoinTheoriqueL: 3000, joursAvantBesoin: 6 },
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

console.log(`\n${n}/${n} tests passés — Moteur Commande Carburant (v2.238).`);
