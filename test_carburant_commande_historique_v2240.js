// Test — Contexte historique de plausibilité + backtest structurel
// (25/08/2026, retour de Frédéric, cahier "NEXUS Carburants / moteur de
// recommandation" — "historique de commandes réel comme référence de
// plausibilité" + "backtest demandé avant activation"). Couvre :
//   1. NexusCarburantCommandeMoteur.construireContextePlausibilite() — pure,
//      vérifiée sur les 18 commandes RÉELLES mai-août fournies par Frédéric
//      (NEXUS_Historique_Commandes_Carburant_Site_Pilote.xlsx), les
//      résultats doivent correspondre EXACTEMENT aux chiffres qu'il a
//      lui-même calculés (moyenne 32 222,22 L, médiane 36 000 L, intervalle
//      moyen 5,76 j) — jamais une approximation.
//   2. NexusCarburantCommandeDonnees.chargerContextePlausibiliteCarburant()
//      — orchestration (mock Supabase), délègue au moteur sans recalcul.
//   3. NexusCarburantCommandeBacktest.executerBacktestStructurel() — sur les
//      mêmes 18 commandes réelles, vérifie que les 3 cas notoires du cahier
//      (n°1008 cut-off réel, n°1007/n°1016 écarts de livraison) sont
//      détectés, et qu'aucune des 18 commandes réelles n'est signalée non
//      conforme aux règles structurelles (elles ont toutes été livrées).

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

const sandbox = { console, window: undefined };
vm.createContext(sandbox);
sandbox.window = sandbox;
charger(sandbox, 'nexus-carburant-commande-moteur.js');
charger(sandbox, 'nexus-carburant-commande-backtest.js');

const M = sandbox.NexusCarburantCommandeMoteur;
const B = sandbox.NexusCarburantCommandeBacktest;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ============================================================
// Fixture — les 18 commandes RÉELLES mai-août 2026, telles qu'importées en
// base (source='import_historique', v2.240) et telles que fournies par
// Frédéric dans NEXUS_Historique_Commandes_Carburant_Site_Pilote.xlsx.
// Numéros 1003/1018 sciemment absents (non capturés — ne jamais supposer
// qu'ils n'existent pas, cf. feuille "Qualité source" du fichier).
// ============================================================
const HISTORIQUE_REEL = [
  { numero: 1001, proposee_le: '2026-05-13T09:25:00', volume_total_l: 31000, carburants: { sp95: { volumeL: 16000 }, go: { volumeL: 15000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-05-15', livraisonEffectiveISO: '2026-05-15' },
  { numero: 1002, proposee_le: '2026-05-19T10:03:00', volume_total_l: 32000, carburants: { sp95: { volumeL: 16000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-05-20', livraisonEffectiveISO: '2026-05-20' },
  { numero: 1004, proposee_le: '2026-05-27T08:45:00', volume_total_l: 32000, carburants: { sp95: { volumeL: 18000 }, go: { volumeL: 14000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-05-28', livraisonEffectiveISO: '2026-05-28' },
  { numero: 1005, proposee_le: '2026-06-02T08:37:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 20000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-06-03', livraisonEffectiveISO: '2026-06-03' },
  { numero: 1006, proposee_le: '2026-06-09T06:01:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 20000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-06-10', livraisonEffectiveISO: '2026-06-10' },
  { numero: 1007, proposee_le: '2026-06-12T07:13:00', volume_total_l: 22000, carburants: { sp95: { volumeL: 8000 }, go: { volumeL: 14000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-06-13', livraisonEffectiveISO: '2026-06-12' },
  { numero: 1008, proposee_le: '2026-06-18T11:07:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 20000 }, go: { volumeL: 16000 } }, avantCutoff: false, livraisonSouhaiteeISO: '2026-06-19', livraisonEffectiveISO: '2026-06-19' },
  { numero: 1009, proposee_le: '2026-06-24T07:15:00', volume_total_l: 32000, carburants: { sp95: { volumeL: 16000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-06-25', livraisonEffectiveISO: '2026-06-25' },
  { numero: 1010, proposee_le: '2026-06-30T10:48:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 18000 }, go: { volumeL: 18000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-01', livraisonEffectiveISO: '2026-07-01' },
  { numero: 1011, proposee_le: '2026-07-06T10:01:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 20000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-07', livraisonEffectiveISO: '2026-07-07' },
  { numero: 1012, proposee_le: '2026-07-09T10:36:00', volume_total_l: 20000, carburants: { sp95: { volumeL: 10000 }, go: { volumeL: 10000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-10', livraisonEffectiveISO: '2026-07-10' },
  { numero: 1013, proposee_le: '2026-07-16T08:51:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 19000 }, go: { volumeL: 17000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-17', livraisonEffectiveISO: '2026-07-17' },
  { numero: 1014, proposee_le: '2026-07-22T09:15:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 19000 }, go: { volumeL: 17000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-23', livraisonEffectiveISO: '2026-07-23' },
  { numero: 1015, proposee_le: '2026-07-28T09:49:00', volume_total_l: 19000, carburants: { sp95: { volumeL: 12000 }, go: { volumeL: 7000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-07-29', livraisonEffectiveISO: '2026-07-29' },
  { numero: 1016, proposee_le: '2026-07-31T10:46:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 18000 }, go: { volumeL: 18000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-08-02', livraisonEffectiveISO: '2026-08-03' },
  { numero: 1017, proposee_le: '2026-08-06T10:47:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 20000 }, go: { volumeL: 16000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-08-07', livraisonEffectiveISO: '2026-08-07' },
  { numero: 1019, proposee_le: '2026-08-12T09:37:00', volume_total_l: 32000, carburants: { sp95: { volumeL: 17000 }, go: { volumeL: 15000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-08-13', livraisonEffectiveISO: '2026-08-13' },
  { numero: 1020, proposee_le: '2026-08-19T07:43:00', volume_total_l: 36000, carburants: { sp95: { volumeL: 21000 }, go: { volumeL: 15000 } }, avantCutoff: true, livraisonSouhaiteeISO: '2026-08-20', livraisonEffectiveISO: '2026-08-20' },
];

// ============================================================
// 1. construireContextePlausibilite()
// ============================================================

// 1a. Historique vide -> tout null, jamais une division par zéro.
{
  const c = M.construireContextePlausibilite([], 15000);
  assert.strictEqual(c.nombreCommandes, 0);
  assert.strictEqual(c.volumeMoyenL, null);
  assert.strictEqual(c.volumeMedianL, null);
  assert.strictEqual(c.ecartAuPattern, null);
  ok('historique vide -> contexte entièrement null, aucune erreur');
}

// 1b. Les 18 commandes réelles -> chiffres EXACTS de la synthèse de
// Frédéric (moyenne 32 222,22 L, médiane 36 000 L, intervalle moyen 5,76 j,
// total SP 308 000 L / GO 272 000 L via les typiques * n).
{
  const c = M.construireContextePlausibilite(HISTORIQUE_REEL, null, '2026-08-24T00:00:00Z');
  assert.strictEqual(c.nombreCommandes, 18);
  assert.ok(Math.abs(c.volumeMoyenL - 32222.222222222223) < 1e-6, 'moyenne : ' + c.volumeMoyenL);
  assert.strictEqual(c.volumeMedianL, 36000);
  assert.ok(Math.abs(c.intervalleMoyenJours - 5.760539215686275) < 1e-6, 'intervalle moyen : ' + c.intervalleMoyenJours);
  const totalSp = c.volumeSpTypiqueL * 18, totalGo = c.volumeGoTypiqueL * 18;
  assert.ok(Math.abs(totalSp - 308000) < 1e-6, 'total SP reconstitué : ' + totalSp);
  assert.ok(Math.abs(totalGo - 272000) < 1e-6, 'total GO reconstitué : ' + totalGo);
  ok('18 commandes réelles -> moyenne/médiane/intervalle/split SP-GO identiques à la synthèse de Frédéric');
}

// 1c. Écart au pattern — dans la norme / à surveiller / inhabituel, jamais
// une interdiction (juste un niveau de signal).
{
  const base = HISTORIQUE_REEL;
  const dansLaNorme = M.construireContextePlausibilite(base, 35000, '2026-08-24T00:00:00Z');
  assert.strictEqual(dansLaNorme.ecartAuPattern.niveau, 'dans_la_norme');
  const inhabituel = M.construireContextePlausibilite(base, 60000, '2026-08-24T00:00:00Z');
  assert.strictEqual(inhabituel.ecartAuPattern.niveau, 'inhabituel');
  ok('ecartAuPattern : dans_la_norme proche de la médiane, inhabituel loin de la médiane');
}

// ============================================================
// 2. NexusCarburantCommandeDonnees.chargerContextePlausibiliteCarburant()
// ============================================================
(async () => {
  const sandbox2 = { console, window: undefined };
  vm.createContext(sandbox2);
  sandbox2.window = sandbox2;
  charger(sandbox2, 'nexus-carburant-commande-moteur.js');
  charger(sandbox2, 'nexus-carburant-commande-donnees.js');

  let appels = 0;
  const client = {
    from(table) {
      assert.strictEqual(table, 'carburant_commandes');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() {
          appels++;
          return Promise.resolve({ data: HISTORIQUE_REEL.map(c => ({ ...c, site: 'vito-sainte-marie' })), error: null });
        },
      };
    },
  };
  const contexte = await sandbox2.NexusCarburantCommandeDonnees.chargerContextePlausibiliteCarburant(client, 'vito-sainte-marie', 24000);
  assert.strictEqual(appels, 1, 'une seule lecture Supabase (réutilise chargerHistoriqueCommandes, aucun second calcul)');
  assert.strictEqual(contexte.nombreCommandes, 18);
  assert.strictEqual(contexte.volumeMedianL, 36000);
  console.log('OK — chargerContextePlausibiliteCarburant() : une lecture, délègue entièrement au moteur pur');
})();

// ============================================================
// 3. NexusCarburantCommandeBacktest.executerBacktestStructurel()
// ============================================================
{
  const rapport = B.executerBacktestStructurel(HISTORIQUE_REEL, {});
  assert.strictEqual(rapport.nombreCommandes, 18);
  assert.strictEqual(rapport.nombreConformes, 18, 'les 18 commandes réelles doivent être structurellement conformes (elles ont toutes été livrées)');
  assert.strictEqual(rapport.nombreNonConformes, 0);
  ok('18/18 commandes réelles conformes aux règles structurelles (capacité/minimum camion/arrondi)');

  // Cas n°1008 (cahier "Qualité source") : commandée après cut-off (11:07)
  // mais livrée dès le lendemain quand même — écart réel/règle détecté.
  const c1008 = rapport.resultats.find(r => r.numero === 1008);
  assert.ok(c1008, 'commande 1008 présente');
  assert.strictEqual(c1008.avantCutoffCalcule, false);
  assert.ok(c1008.observationCutoff && c1008.observationCutoff.includes('pas toujours'), c1008.observationCutoff);
  ok('n°1008 : écart cut-off réel/règle détecté (après 11h, livrée quand même le lendemain)');

  // Cas n°1007 (livrée 1 jour EN AVANCE) et n°1016 (décalage week-end +1 j).
  const c1007 = rapport.resultats.find(r => r.numero === 1007);
  const c1016 = rapport.resultats.find(r => r.numero === 1016);
  assert.strictEqual(c1007.ecartLivraisonJours, -1);
  assert.strictEqual(c1016.ecartLivraisonJours, 1);
  ok('n°1007 (-1 j) et n°1016 (+1 j, week-end) : écarts de livraison détectés sans être signalés comme anomalie moteur');

  assert.strictEqual(rapport.nombreEcartsCutoffReel, 1);
  assert.strictEqual(rapport.nombreLivraisonsDecalees, 2);
  ok('synthèse backtest : 1 écart cut-off réel, 2 livraisons décalées, cohérent avec la feuille "Qualité source" de Frédéric');
}

console.log(`\n${n + 2}/${n + 2} tests passés.`);
