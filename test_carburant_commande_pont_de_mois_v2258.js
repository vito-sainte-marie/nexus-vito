// Test — "Mode pont de mois" : en fin de mois, quand la livraison franchit
// le mois suivant, NEXUS ne doit PAS sécuriser plusieurs jours de réserve
// par principe — uniquement le strict nécessaire pour "tenir jusqu'à la
// fin de la première journée où une livraison du mois suivant peut
// effectivement être reçue" (27/08/2026, spécification détaillée de
// Frédéric, en suite de v2.257).
//
// Citation exacte de Frédéric, avec son propre exemple chiffré : "si tes
// ventes moyennes prévues sont par exemple GO : 4 000 L/jour [...] alors,
// à l'entrée du mardi matin, NEXUS cherchera idéalement à te laisser
// environ GO : 4 000 L, éventuellement avec une petite marge opérationnelle
// [...] 4 000 L + 1 000 L de marge, et non arbitrairement 8 000 ou
// 10 000 L."
//
// Formule implémentée (mathématiquement équivalente à celle de Frédéric,
// dérivée pour réutiliser les fonctions pures existantes — Article 11,
// jamais un second calcul de projection) :
//   - stockPrevuLivraisonL (en pont de mois) = stock projeté au DÉBUT du
//     jour de livraison MOINS la prévision du jour de livraison lui-même
//     (day-of-week fiable, prevoirConsommationJour) -> stock projeté à la
//     FIN de cette journée, jamais au début (Frédéric : "NEXUS ne doit
//     jamais raisonner comme si le camion arrivait à 8h du matin").
//   - securiteL (en pont de mois) = marge opérationnelle = prévision du
//     jour de livraison × 25 % (valeur provisoire calibrée sur l'exemple
//     de Frédéric lui-même : 1 000 / 4 000 = 25 %), remplace la réserve de
//     plusieurs jours utilisée hors pont de mois.
//   - margeL/margeJours/besoinMinimumSecuriteL : formules INCHANGÉES,
//     alimentées différemment selon le mode (Article 11).
//
// Aucun mock Supabase nécessaire ici (contrairement à
// test_carburant_commande_fin_de_mois_livraison_v2257.js) : ce test porte
// sur le moteur PUR (nexus-carburant-commande-moteur.js) directement, avec
// un historique de ventes fixe day-of-week précis, comme
// test_carburant_commande_moteur_v2238.js.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const PROJET = __dirname;
function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(PROJET, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}
let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const sandbox = { console };
vm.createContext(sandbox);
charger(sandbox, 'nexus-carburant-moteur.js');
charger(sandbox, 'nexus-carburant-commande-moteur.js');
const M = sandbox.NexusCarburantCommandeMoteur;

const CONFIG = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  maximum_camion_litres: 36000, minimum_camion_litres: 10000,
  stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1,
};

// 31 août 2026 = lundi ; 1er septembre 2026 = mardi (premier jour de
// livraison possible du mois suivant, calendrier lun-ven). Historique :
// 3 lundis à 3 000 L de GO, 3 mardis à 4 000 L de GO (valeurs identiques —
// aucun jour atypique à exclure, prévision "fiable" dès 3 points, §5/v2.253).
const HISTORIQUE_GO = [
  { date: '2026-08-10', ventes: { go: 3000 } }, // lundi
  { date: '2026-08-17', ventes: { go: 3000 } }, // lundi
  { date: '2026-08-24', ventes: { go: 3000 } }, // lundi
  { date: '2026-08-11', ventes: { go: 4000 } }, // mardi
  { date: '2026-08-18', ventes: { go: 4000 } }, // mardi
  { date: '2026-08-25', ventes: { go: 4000 } }, // mardi
];

// ------------------------------------------------------------
// 1) Exemple exact de Frédéric — pile assez de stock pour finir le mardi à
//    zéro marge (stockActuel = 3 000 L lundi + 4 000 L mardi + 1 000 L de
//    marge opérationnelle = 8 000 L).
// ------------------------------------------------------------
{
  const sc = M.evaluerScenarioCommande({
    dateCommandeISO: '2026-08-31', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 8000, consommationMoyenneJour: 3500, historiqueParJour: HISTORIQUE_GO, carburant: 'go',
    commandesEnCoursVolumeL: 0,
  });
  assert.strictEqual(sc.livraisonISO, '2026-09-01', 'prémisse : livraison mardi 1er septembre');
  assert.strictEqual(sc.pontDeMois, true, 'la livraison franchit le mois -> mode pont de mois activé');
  assert.strictEqual(sc.ventesPrevuesL, 3000, 'ventes prévues jusqu\'au DÉBUT du jour de livraison = seulement lundi (3 000 L), le mardi est traité à part');
  assert.strictEqual(sc.previsionJourLivraisonL, 4000, 'prévision du jour de livraison (mardi) day-of-week fiable = 4 000 L, exactement l\'exemple de Frédéric');
  assert.strictEqual(sc.margeOperationnelleL, 1000, 'marge opérationnelle = 25 % de la prévision du jour de livraison = 1 000 L, exactement l\'exemple de Frédéric ("4 000 L + 1 000 L de marge")');
  assert.strictEqual(sc.stockPrevuDebutJourLivraisonL, 5000, 'stock projeté au DÉBUT du mardi = 8 000 - 3 000 (lundi)');
  assert.strictEqual(sc.stockPrevuLivraisonL, 1000, 'stock projeté à la FIN du mardi = 5 000 - 4 000 (le camion peut arriver en fin de journée, jamais supposé arriver le matin)');
  assert.strictEqual(sc.securiteL, 1000, 'en pont de mois, la "sécurité" est la marge opérationnelle (1 000 L), jamais 1 ou 2 jours de consommation moyenne');
  assert.strictEqual(sc.margeL, 0, 'marge exactement nulle : le stock actuel couvre pile lundi + mardi + la marge opérationnelle, ni plus ni moins');
  ok('exemple exact de Frédéric (mardi 1er, GO 4 000 L/j) — stock cible identique à sa propre estimation manuelle (4 000 + 1 000 = 5 000 L au début du mardi)');
}

// ------------------------------------------------------------
// 2) Même scénario avec 1 000 L de moins en stock -> marge négative ->
//    l'état bascule en "sécurité" (commande nécessaire) et le besoin de
//    sécurité calculé par evaluerCarburant tombe pile sur 1 000 L, jamais
//    un besoin de plusieurs jours (8 000/10 000 L) que Frédéric refuse
//    explicitement.
// ------------------------------------------------------------
{
  const ev = M.evaluerCarburant({
    carburant: 'go', maintenantISO: '2026-08-31', heureMaintenantHHMM: '09:00', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 7000, limiteRemplissageL: 30000, consommationMoyenneJour: 3500,
    historiqueParJour: HISTORIQUE_GO, commandeEnCoursVolumeL: 0, stockFiable: true,
  });
  assert.strictEqual(ev.scenarioMaintenant.pontDeMois, true);
  assert.strictEqual(ev.scenarioMaintenant.stockPrevuLivraisonL, 0, 'stock projeté à la fin du mardi tombe pile à 0 avec 1 000 L de stock en moins');
  assert.strictEqual(ev.scenarioMaintenant.margeL, -1000, 'marge négative de 1 000 L (exactement la marge opérationnelle manquante)');
  assert.strictEqual(ev.etat, 'securite', 'marge négative en pont de mois -> commande nécessaire, comme pour tout autre scénario (determinerEtatCommande inchangé)');
  assert.strictEqual(ev.besoinMinimumSecuriteL, 1000, 'besoin de sécurité = exactement la marge opérationnelle manquante (1 000 L) — jamais plusieurs jours de réserve (8 000/10 000 L) que Frédéric refuse explicitement pour ce cas');
  ok('pont de mois avec stock insuffisant -> état "sécurité" déclenché correctement, besoin de sécurité = marge opérationnelle exacte (1 000 L), pas un multiple de jours');
}

// ------------------------------------------------------------
// 3) Régression — hors pont de mois (livraison qui reste dans le même
//    mois), le calcul historique (reserveCibleJours, plusieurs jours de
//    réserve) doit rester strictement inchangé.
// ------------------------------------------------------------
{
  // Jeudi 27 août -> prochain créneau lun-ven = vendredi 28 août, toujours
  // en août : pas de franchissement de mois.
  const sc = M.evaluerScenarioCommande({
    dateCommandeISO: '2026-08-27', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 8000, consommationMoyenneJour: 3500, historiqueParJour: HISTORIQUE_GO, carburant: 'go',
    commandesEnCoursVolumeL: 0,
  });
  assert.strictEqual(sc.livraisonISO, '2026-08-28', 'prémisse : livraison vendredi 28 août, toujours dans le même mois');
  assert.strictEqual(sc.pontDeMois, false, 'pas de franchissement de mois -> mode pont de mois désactivé');
  assert.strictEqual(sc.previsionJourLivraisonL, null, 'hors pont de mois, la prévision du jour de livraison n\'est même pas calculée (inutile, jamais un calcul superflu)');
  assert.strictEqual(sc.securiteL, M.stockSecuriteLitres(3500, M.reserveCibleJours('2026-08-27', CONFIG)), 'hors pont de mois, la sécurité reste EXACTEMENT reserveCibleJours × consommation moyenne — formule historique inchangée (v2.245/v2.253)');
  ok('hors pont de mois (livraison qui reste dans le mois courant) — formule historique de réserve (jours × consommation moyenne) strictement inchangée');
}

// ------------------------------------------------------------
// 4) (28/08/2026, §23 — scénario explicite de Frédéric parmi les 10 tests
//    obligatoires de la refonte qualitative) : "1er samedi -> livraison
//    lundi", le pont de mois doit couvrir samedi + dimanche + lundi ENTIER,
//    jamais un calcul qui suppose à tort un seul jour d'écart entre la
//    commande et la livraison. Calendrier réel : le 1er août 2026 tombe un
//    samedi -> une commande passée vendredi 31 juillet (avant cutoff) ne
//    trouve son prochain jour de livraison (lun-ven) que le lundi 3 août,
//    soit DEUX jours non livrables (samedi 1er, dimanche 2) entre la
//    commande et la livraison — jamais un seul, contrairement au scénario
//    §1 ci-dessus (lundi -> mardi, un seul jour d'écart).
// ------------------------------------------------------------
{
  // Historique day-of-week dédié (vendredi/samedi/dimanche/lundi), 3
  // occurrences identiques chacune -> prévision "fiable" sans exclusion
  // (§5/v2.253), valeurs choisies distinctes pour détecter sans ambiguïté
  // tout jour compté deux fois, oublié, ou confondu avec un autre.
  const HISTORIQUE_JUILLET = [
    { date: '2026-07-03', ventes: { go: 3500 } }, // vendredi
    { date: '2026-07-10', ventes: { go: 3500 } }, // vendredi
    { date: '2026-07-17', ventes: { go: 3500 } }, // vendredi
    { date: '2026-07-04', ventes: { go: 5000 } }, // samedi
    { date: '2026-07-11', ventes: { go: 5000 } }, // samedi
    { date: '2026-07-18', ventes: { go: 5000 } }, // samedi
    { date: '2026-07-05', ventes: { go: 4500 } }, // dimanche
    { date: '2026-07-12', ventes: { go: 4500 } }, // dimanche
    { date: '2026-07-19', ventes: { go: 4500 } }, // dimanche
    { date: '2026-07-06', ventes: { go: 3000 } }, // lundi
    { date: '2026-07-13', ventes: { go: 3000 } }, // lundi
    { date: '2026-07-20', ventes: { go: 3000 } }, // lundi
  ];
  const sc = M.evaluerScenarioCommande({
    dateCommandeISO: '2026-07-31', heureCommandeHHMM: '09:00', config: CONFIG, joursFeriesISO: [],
    stockActuelL: 20000, consommationMoyenneJour: 4000, historiqueParJour: HISTORIQUE_JUILLET, carburant: 'go',
    commandesEnCoursVolumeL: 0,
  });
  assert.strictEqual(sc.livraisonISO, '2026-08-03', 'prémisse : vendredi 31/07 avant cutoff -> 1er (samedi) et 2 (dimanche) non livrables -> lundi 3 août');
  assert.strictEqual(sc.pontDeMois, true, 'juillet -> août : franchissement de mois');
  assert.strictEqual(sc.ventesPrevuesL, 3500 + 5000 + 4500, 'ventes prévues jusqu\'au DÉBUT du jour de livraison = vendredi + samedi + dimanche (3 jours), jamais un seul jour compté pour tout le week-end');
  assert.strictEqual(sc.previsionJourLivraisonL, 3000, 'prévision du jour de livraison (lundi) day-of-week fiable, distincte des 3 jours précédents');
  assert.strictEqual(sc.margeOperationnelleL, 750, 'marge opérationnelle = 25 % de la prévision du lundi (3 000 L) = 750 L');
  assert.strictEqual(sc.stockPrevuDebutJourLivraisonL, 20000 - (3500 + 5000 + 4500), 'stock projeté au début du lundi = stock actuel moins EXACTEMENT les 3 jours vendredi/samedi/dimanche');
  assert.strictEqual(sc.stockPrevuLivraisonL, 20000 - (3500 + 5000 + 4500) - 3000, 'stock projeté à la fin du lundi = stock début lundi moins la prévision du lundi lui-même');
  assert.strictEqual(sc.securiteL, 750, 'en pont de mois, la sécurité reste la marge opérationnelle, quelle que soit la durée du pont (1 ou plusieurs jours)');
  ok('1er samedi -> livraison lundi (§23) — le pont de mois couvre vendredi+samedi+dimanche+lundi entier, sans confondre ni sauter un jour du week-end');
}

console.log(`\n${n}/${n} tests passés.`);
