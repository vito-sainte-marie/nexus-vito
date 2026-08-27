// Tests unitaires — nexus-carburant-commande-moteur.js — nouvelle règle
// métier de Frédéric (27/08/2026, v2.253) : "Nouvelle règle NEXUS que je
// recommande" — remplace la réserve fixe de 3 jours par une cible
// dynamique (2 j en cours de mois / 1 j en fin de mois), remplace le
// SP95 codé en dur par un carburant prioritaire calculé dynamiquement
// selon la consommation journalière prévisionnelle, remplace la
// répartition au prorata de la complétion camion par une construction
// séquentielle (Étape A carburant prioritaire, Étape B complément), et
// remplace la moyenne pondérée symétrique par une prévision "prudente"
// (moyenne des 2 meilleures valeurs parmi les jours comparables, après
// exclusion des atypiques).
//
// Décisions de portée actées avec Frédéric avant tout code
// (AskUserQuestion, 27/08/2026) :
//   - Méthode de prévision retenue : moyenne des 2 valeurs les plus hautes
//     parmi les jours comparables (pas un percentile fixe, pas une simple
//     majoration de la moyenne pondérée existante).
//   - Vocabulaire d'alertes 🟢/🟡/🟠/🔴 : périmètre limité à la carte
//     "Prochaine commande carburant" pour ce lot (le contrôle physique/
//     autonomie carburant et le Brief gardent leur vocabulaire actuel,
//     testés ailleurs — hors périmètre de ce fichier).
//
// Ne retouche PAS les tests déjà existants qui restent valides tels quels
// (calendrier, stock prévisionnel, 4 états, minimum camion...) — voir
// test_carburant_commande_moteur_v2238.js (mis à jour séparément pour la
// suppression du blend 65/35) et test_carburant_commande_camion_complet_v2245.js
// (mis à jour séparément pour la construction séquentielle, remplaçant le
// prorata qu'il testait jusqu'ici).

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

// ------------------------------------------------------------
// 1) reserveCibleJours — 2 jours en cours de mois, 1 jour en fin de mois
//    (réutilise estFinDeMois, Article 11 — jamais un second calcul de "fin
//    de mois"). Constantes exportées inchangées par défaut.
// ------------------------------------------------------------
{
  assert.strictEqual(M.RESERVE_CIBLE_JOURS_NORMAL, 2, 'constante provisoire : 2 jours en cours de mois');
  assert.strictEqual(M.RESERVE_CIBLE_JOURS_FIN_MOIS, 1, 'constante provisoire : 1 jour en fin de mois');

  // Août 2026 : fin de mois à partir du 27 (voir estFinDeMois, JOURS_FIN_MOIS=5).
  assert.strictEqual(M.reserveCibleJours('2026-08-15', null), 2, '15 août (cours de mois) -> réserve cible 2 jours');
  assert.strictEqual(M.reserveCibleJours('2026-08-26', null), 2, '26 août (encore cours de mois) -> réserve cible 2 jours');
  assert.strictEqual(M.reserveCibleJours('2026-08-27', null), 1, '27 août (fin de mois) -> réserve cible 1 jour');
  assert.strictEqual(M.reserveCibleJours('2026-08-31', null), 1, '31 août (dernier jour) -> réserve cible 1 jour');

  // Config explicite par site (même pattern que minimum/maximum_camion_litres) —
  // surcharge les constantes par défaut sans toucher au code.
  const configPersonnalisee = { stock_securite_jours_normal: 3, stock_securite_jours_fin_mois: 1.5 };
  assert.strictEqual(M.reserveCibleJours('2026-08-15', configPersonnalisee), 3, 'config personnalisée respectée en cours de mois');
  assert.strictEqual(M.reserveCibleJours('2026-08-27', configPersonnalisee), 1.5, 'config personnalisée respectée en fin de mois');

  ok('reserveCibleJours — 2 j en cours de mois / 1 j en fin de mois par défaut, configurable par site sans toucher au code');
}

// ------------------------------------------------------------
// 2) reserveCibleJours branchée dans evaluerScenarioCommande — la marge de
//    sécurité (margeJours) change bien selon la date de commande simulée
//    (cours de mois vs fin de mois), pour un même stock/consommation.
// ------------------------------------------------------------
{
  const config = { cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5], minimum_camion_litres: 10000 };
  const historique = [];
  {
    let cursor = '2026-06-01';
    while (cursor < '2026-08-27') { historique.push({ date: cursor, ventes: { sp95: 1000 } }); cursor = M.ajouterJoursISO(cursor, 1); }
  }
  // 20 août (mercredi, cours de mois) -> livraison jeudi 21 août, réserve 2 j.
  const scenarioNormal = M.evaluerScenarioCommande({
    dateCommandeISO: '2026-08-20', heureCommandeHHMM: '09:00', config, joursFeriesISO: [],
    stockActuelL: 5000, consommationMoyenneJour: 1000, historiqueParJour: historique, carburant: 'sp95',
  });
  // 27 août (jeudi, fin de mois) -> livraison vendredi 28 août, réserve 1 j.
  const scenarioFinMois = M.evaluerScenarioCommande({
    dateCommandeISO: '2026-08-27', heureCommandeHHMM: '09:00', config, joursFeriesISO: [],
    stockActuelL: 5000, consommationMoyenneJour: 1000, historiqueParJour: historique, carburant: 'sp95',
  });
  assert.strictEqual(scenarioNormal.securiteL, 2000, 'réserve de sécurité = 2 jours * 1000 L/j en cours de mois');
  assert.strictEqual(scenarioFinMois.securiteL, 1000, 'réserve de sécurité = 1 jour * 1000 L/j en fin de mois');
  assert.ok(scenarioFinMois.margeL > scenarioNormal.margeL, 'la marge disponible est plus généreuse en fin de mois (réserve cible plus basse), à stock et consommation égaux');

  ok('evaluerScenarioCommande — la réserve de sécurité appliquée dépend bien de la date de commande simulée (cours de mois vs fin de mois)');
}

// ------------------------------------------------------------
// 3) ordrePrioriteCarburants — jamais SP95 codé en dur : classe par
//    consommation journalière prévisionnelle décroissante, s'inverse si le
//    GO dépasse durablement le SP (exemple explicite de Frédéric).
// ------------------------------------------------------------
{
  // Array.from(...) avant comparaison — le tableau retourné vient du
  // contexte `vm` (autre realm que ce test), même précaution déjà en place
  // ailleurs dans ce projet (ex. Array.from(optim.carburantsCompletes) dans
  // test_carburant_commande_camion_complet_v2245.js) : assert.deepStrictEqual
  // distingue les Array de deux realms différents même à valeurs égales.
  const spPrioritaire = Array.from(M.ordrePrioriteCarburants({
    sp95: { consommationMoyenneJour: 3200 },
    go: { consommationMoyenneJour: 2800 },
  }));
  assert.deepStrictEqual(spPrioritaire, ['sp95', 'go'], 'sp95 plus consommé -> prioritaire en premier');

  const goPrioritaire = Array.from(M.ordrePrioriteCarburants({
    sp95: { consommationMoyenneJour: 2000 },
    go: { consommationMoyenneJour: 4500 },
  }));
  assert.deepStrictEqual(goPrioritaire, ['go', 'sp95'], 'le GO dépasse durablement le SP -> la priorité s\'inverse automatiquement, jamais un ordre figé');

  // Consommation inconnue (null) -> classé en dernier, jamais une priorité inventée.
  const inconnuEnDernier = Array.from(M.ordrePrioriteCarburants({
    sp95: { consommationMoyenneJour: 1500 },
    gnr: { consommationMoyenneJour: null },
  }));
  assert.deepStrictEqual(inconnuEnDernier, ['sp95', 'gnr'], 'un carburant sans consommation connue est classé en dernier, jamais prioritaire par défaut');

  ok('ordrePrioriteCarburants — jamais codé en dur, s\'inverse automatiquement selon la consommation journalière prévisionnelle réelle');
}

// ------------------------------------------------------------
// 4) exclureJoursAtypiques + moyenneHauteDeuxMeilleures — méthode de
//    prévision "prudente" retenue avec Frédéric (moyenne des 2 valeurs les
//    plus hautes), avec l'exemple EXACT donné dans son message : mardis SP
//    2850/3100/3250/3300/3450 -> (3300+3450)/2 = 3375.
// ------------------------------------------------------------
{
  const mardisSp = [2850, 3100, 3250, 3300, 3450];
  assert.deepStrictEqual(Array.from(M.exclureJoursAtypiques(mardisSp)), mardisSp, 'aucune valeur atypique dans l\'exemple de Frédéric -> rien exclu');
  assert.strictEqual(M.moyenneHauteDeuxMeilleures(mardisSp), 3375, 'exemple exact de Frédéric : moyenne des 2 plus hautes (3300+3450)/2 = 3375, jamais la moyenne plate (~3190)');

  // Exclusion d'une journée manifestement atypique (ex. une panne de pompe
  // ayant fait chuter les ventes un jour donné à 200 L, alors que les autres
  // jours comparables tournent autour de 3000 L) — jamais laissée dominer le
  // calcul par simple absence de filtre, ni jamais retenue dans le "top 2".
  const avecAtypique = [2900, 3000, 3100, 200, 3200];
  const filtrees = Array.from(M.exclureJoursAtypiques(avecAtypique));
  assert.ok(!filtrees.includes(200), 'la journée à 200 L (panne, <40% de la médiane ~3000) est exclue comme atypique');
  assert.strictEqual(M.moyenneHauteDeuxMeilleures(filtrees), (3200 + 3100) / 2, 'moyenne des 2 meilleures parmi les jours retenus après exclusion');

  // Moins de 3 points -> jamais d'exclusion arbitraire (Article 5).
  const troisPointsSeulement = [3000, 100];
  assert.deepStrictEqual(Array.from(M.exclureJoursAtypiques(troisPointsSeulement)), troisPointsSeulement, 'sous 3 points, aucune exclusion — pas assez de recul pour juger ce qui est atypique');

  // Cas limites.
  assert.strictEqual(M.moyenneHauteDeuxMeilleures([]), null, 'aucune valeur -> null, jamais un chiffre inventé');
  assert.strictEqual(M.moyenneHauteDeuxMeilleures([1500]), 1500, 'un seul point retenu -> ce point sert directement de prévision');

  ok('exclureJoursAtypiques + moyenneHauteDeuxMeilleures — reproduit l\'exemple exact de Frédéric (3375 L), exclut une vraie panne, jamais une exclusion arbitraire sous 3 points');
}

// ------------------------------------------------------------
// 5) prevoirConsommationJour — n'utilise plus JAMAIS une moyenne globale
//    tous-jours-confondus quand un historique du même jour de semaine
//    existe (citation de Frédéric : "NEXUS ne prend pas la moyenne globale
//    de tous les jours. Il regarde les mardis comparables.") — la tendance
//    récente générale ne sert plus que de dernier repli.
// ------------------------------------------------------------
{
  // Historique : le mardi vaut toujours 3000 L, mais les 6 jours précédant
  // la cible cible (tous jours confondus, hors mardi) valent 500 L — un
  // ancien blend 65/35 aurait tiré la prévision vers le bas (~2125 L),
  // la nouvelle règle doit rester à 3000 L (jour comparable seul).
  const historique = [];
  {
    let cursor = '2026-06-02'; // un mardi
    while (cursor < '2026-08-25') {
      const dow = M.jourSemaineIso(cursor);
      historique.push({ date: cursor, ventes: { sp95: dow === 2 ? 3000 : 500 } });
      cursor = M.ajouterJoursISO(cursor, 1);
    }
  }
  const prevision = M.prevoirConsommationJour({ historiqueParJour: historique, carburant: 'sp95', dateCibleISO: '2026-08-25' }); // mardi
  assert.strictEqual(prevision.prevision, 3000, 'jour de semaine comparable utilisé SEUL — jamais dilué par la tendance générale des autres jours (500 L)');
  assert.strictEqual(prevision.methode, 'meme_jour_semaine_prudent');
  assert.strictEqual(prevision.confiance, 'fiable', 'assez de mardis comparables (>= 3) pour une confiance fiable');

  // Aucun historique du même jour de semaine du tout (site jeune, un seul
  // jour de vente connu, un dimanche) -> repli sur la tendance récente
  // générale, jamais un blocage.
  const historiqueJeune = [{ date: '2026-08-23', ventes: { sp95: 1800 } }]; // un dimanche
  const previsionRepli = M.prevoirConsommationJour({ historiqueParJour: historiqueJeune, carburant: 'sp95', dateCibleISO: '2026-08-25' }); // un mardi, aucun mardi connu
  assert.strictEqual(previsionRepli.prevision, 1800, 'aucun mardi connu -> repli sur la tendance récente générale (dernier recours)');
  assert.strictEqual(previsionRepli.methode, 'moyenne_recente_seule');
  assert.strictEqual(previsionRepli.confiance, 'a_confirmer', 'un repli n\'est jamais présenté comme une prévision fiable');

  ok('prevoirConsommationJour — le jour de semaine comparable domine SEUL dès qu\'il existe, la tendance générale n\'est plus qu\'un dernier repli (remplace le blend 65/35)');
}

console.log(`\n${n}/${n} tests passés — Nouvelle règle NEXUS commande carburant (v2.253, 27/08/2026).`);
