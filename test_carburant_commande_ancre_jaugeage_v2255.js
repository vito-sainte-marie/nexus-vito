// Test — Ancre de la recommandation Commande Carburant = jaugeage du matin,
// jamais "stock estimé maintenant" (27/08/2026, retour de Frédéric, règles
// 1+2 : "le jaugeage du matin est l'unique point physique de départ de la
// recommandation" / "elle ne doit jamais attendre la clôture du Quart 1").
//
// Bug trouvé par audit sur données réelles (vito-sainte-marie, 27/08/2026,
// voir commentaire dans nexus-carburant-commande-donnees.js /
// chargerStockEtFiabiliteParCarburant) : evaluerCommandeCarburantSite
// utilisait `stock.stockActuelL` ("stock estimé maintenant" = jaugeage −
// ventes déjà captées depuis ce jaugeage) comme ancre de la projection
// multi-jours (evaluerScenarioCommande), dont la fenêtre inclut TOUJOURS
// aujourd'hui comme un jour complet via l'historique (prevoirConsommationJour)
// — double compte de la consommation du jour : une fois via les ventes
// réelles déjà captées, une seconde fois via la moyenne historique d'une
// journée entière pour aujourd'hui. Sur GO le 27/08, ce double compte
// faisait passer stockPrevuLivraisonL de +1 734 L (ancre jaugeage, correct)
// à -740 L (ancre stock maintenant, buggé) — 2 474 L d'écart, vérifié en
// rejouant le vrai moteur sur les vraies ventes.
//
// Correctif : deux nouveaux champs `stockAncreCommandeL`/
// `stockAncreCommandeFiable` (= jaugeage brut du jour en Cas A, décorrélés
// de la réussite du calcul "ventes depuis jaugeage"), utilisés par
// evaluerCommandeCarburantSite pour alimenter M.evaluerCarburant — alors que
// `stockActuelL`/`stockFiable` restent INCHANGÉS et continuent de piloter
// exclusivement l'affichage "stock estimé maintenant" (monitoring temps
// réel), désormais explicitement découplé de l'ancre de recommandation.
//
// Même discipline que test_carburant_commande_stock_maintenant_v2243.js
// (chargerControleJour stubbée directement, jamais réimplémentée — ses
// propres dépendances sont déjà couvertes ailleurs) et que
// test_carburant_commande_donnees_v2238.js (mock Supabase chaînable minimal
// pour evaluerCommandeCarburantSite, aucune réécriture des fonctions
// testées).

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

const HORAIRES = {
  quart1: { normal: '06:00', fin_normal: '14:00' },
  quart2: { normal: '14:00', fin_normal: '22:00' },
};
const FUSEAU = 'UTC';

const CONFIG_COMMANDE = {
  cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
  maximum_camion_litres: 36000, minimum_camion_litres: 10000,
  stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1,
  compartiments_disponibles_litres: [2000, 5000, 7000],
};
const CUVES_VITO = {
  sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
  go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }, { id: 'cuve2', capacite: 10036, limite_remplissage: 9534 }] },
  gnr: { actif: false, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
};

// Historique réaliste (jeudis comparables + jours récents pour la moyenne
// 14 jours) — 2026-08-27 est un jeudi ; 08-20 et 08-13 aussi.
const HISTORIQUE_ROWS = [
  { date: '2026-08-13', litrage_sp95: 6000, litrage_gazole: 3400, litrage_gnr: null },
  { date: '2026-08-20', litrage_sp95: 6200, litrage_gazole: 3600, litrage_gnr: null },
  { date: '2026-08-24', litrage_sp95: 5000, litrage_gazole: 3000, litrage_gnr: null },
  { date: '2026-08-25', litrage_sp95: 5100, litrage_gazole: 3100, litrage_gnr: null },
  { date: '2026-08-26', litrage_sp95: 5300, litrage_gazole: 3200, litrage_gnr: null },
];
// Quart 1 du 27/08, déjà clos au moment de l'évaluation (15:00 UTC) — les
// ventes réellement captées depuis le jaugeage du matin.
const QUART1_AUJOURDHUI_ROWS = [
  { date: '2026-08-27', quart: '1', litrage_sp95: 3200, litrage_gazole: 2900, litrage_gnr: null },
];

function creerClientEvaluation() {
  return {
    from(table) {
      if (table === 'station_config') {
        const data = { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, fuseau_horaire: 'UTC', horaires: HORAIRES };
        const chain = { select() { return chain; }, eq() { return chain; }, async maybeSingle() { return { data, error: null }; } };
        return chain;
      }
      if (table === 'inventaire_calendrier_site') {
        const chain = { select() { return chain; }, eq() { return chain; }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
        return chain;
      }
      if (table === 'carburant_commandes') {
        const chain = { select() { return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
        return chain;
      }
      if (table === 'audits_caisse') {
        // Distingue 3 requêtes : "historique journalier" (chargerHistoriqueVentesParJour,
        // plage gte/lt, sans filtre quart), "historique d'UN quart"
        // (chargerHistoriqueVentesParQuart, plage gte/lt + eq('quart', ...) —
        // volontairement vide ici : ce test porte sur l'ancre jaugeage, pas sur
        // l'estimation du quart en cours déjà couverte par
        // test_carburant_commande_estimation_quart_v2246.js, Article 11) et
        // "quarts du jour" (Cas A de chargerStockEtFiabiliteParCarburant,
        // filtre par date exacte, sans plage).
        let estPlage = false;
        let filtreQuart = false;
        const chain = {
          select() { return chain; },
          eq(k) { if (k === 'quart') filtreQuart = true; return chain; },
          gte() { estPlage = true; return chain; },
          lt() { estPlage = true; return chain; },
          then(resolve) {
            const data = filtreQuart ? [] : (estPlage ? HISTORIQUE_ROWS : QUART1_AUJOURDHUI_ROWS);
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return chain;
      }
      throw new Error('Table non mockée par ce test : ' + table);
    },
  };
}

(async () => {
  const sandbox = { console, window: undefined };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  sandbox.NexusCarburantDonnees = {
    chargerControleJour: async () => ({
      aucunReleve: false,
      releveDuJour: { date: '2026-08-27', mesure_le: '2026-08-27T07:00:00.000Z', origine: 'manager' }, // jaugeage d'ouverture, en plein quart1 (06:00-14:00 UTC) — pas un chevauchement (v2.244)
      dernierReleve: null,
      parCarburant: {
        sp95: { reelDuJour: 24066, dernierReel: 20000, statut: 'Sous contrôle' },
        go: { reelDuJour: 13250, dernierReel: 11000, statut: 'Sous contrôle' },
      },
    }),
  };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees.js');
  const Donnees = sandbox.NexusCarburantCommandeDonnees;
  const M = sandbox.NexusCarburantCommandeMoteur;

  // ------------------------------------------------------------
  // 1) chargerStockEtFiabiliteParCarburant expose bien les deux ancres,
  //    avec des valeurs DIFFÉRENTES dès qu'une vente a eu lieu aujourd'hui.
  // ------------------------------------------------------------
  {
    const client = creerClientEvaluation();
    const maintenant = '2026-08-27T15:00:00.000Z';
    const stockInfo = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-27', HORAIRES, FUSEAU, maintenant);

    assert.strictEqual(stockInfo.parCarburant.go.stockActuelL, 13250 - 2900, '"stock estimé maintenant" go inchangé : jaugeage - ventes du quart clos');
    assert.strictEqual(stockInfo.parCarburant.go.stockAncreCommandeL, 13250, 'ancre de commande go = jaugeage brut, jamais net des ventes du jour');
    assert.strictEqual(stockInfo.parCarburant.go.stockAncreCommandeFiable, true);
    assert.strictEqual(stockInfo.parCarburant.sp95.stockActuelL, 24066 - 3200, '"stock estimé maintenant" sp95 inchangé');
    assert.strictEqual(stockInfo.parCarburant.sp95.stockAncreCommandeL, 24066, 'ancre de commande sp95 = jaugeage brut');
    assert.notStrictEqual(stockInfo.parCarburant.go.stockAncreCommandeL, stockInfo.parCarburant.go.stockActuelL, 'les deux ancres doivent diverger dès qu\'une vente a eu lieu aujourd\'hui — sinon le correctif ne change rien');
    ok('chargerStockEtFiabiliteParCarburant — stockAncreCommandeL (jaugeage brut) distinct de stockActuelL (stock estimé maintenant)');
  }

  // ------------------------------------------------------------
  // 2) evaluerCommandeCarburantSite doit produire la MÊME projection que si
  //    on appelle M.evaluerCarburant directement avec l'ancre jaugeage — et
  //    une projection DIFFÉRENTE (plus pessimiste) de celle obtenue avec
  //    l'ancienne ancre "stock maintenant", ce qui prouve que le double
  //    compte est bien éliminé par le branchement réel (pas seulement par
  //    la fonction isolée testée en 1).
  // ------------------------------------------------------------
  {
    const client = creerClientEvaluation();
    const maintenant = '2026-08-27T15:00:00.000Z';
    const heureHHMM = '09:00'; // avant cutoff 11:00 -> commande possible aujourd'hui même

    const r = await Donnees.evaluerCommandeCarburantSite(client, 'vito-sainte-marie', { dateISO: '2026-08-27', heureHHMM, maintenant });
    assert.strictEqual(r.ok, true);
    const goReel = r.parCarburant.go;
    assert.ok(goReel.scenarioMaintenant, 'scenarioMaintenant doit être calculé pour go');
    const stockPrevuAvecAncreJaugeage = goReel.scenarioMaintenant.stockPrevuLivraisonL;

    // Reproduction manuelle du calcul AVEC L'ANCIENNE ancre bugguée (stock
    // maintenant), à partir des mêmes historiques/config, pour comparaison —
    // jamais une seconde implémentation du moteur, un simple appel à la
    // même fonction pure M.evaluerCarburant avec un autre stockActuelL en
    // entrée.
    const historiqueParJour = await Donnees.chargerHistoriqueVentesParJour(client, 'vito-sainte-marie', '2026-08-27');
    const consommationMoyenneJourGo = M.moyenneRecente(historiqueParJour, 'go', '2026-08-27', 14).moyenne;
    const evalAvecAncreStockMaintenant = M.evaluerCarburant({
      carburant: 'go', maintenantISO: '2026-08-27', heureMaintenantHHMM: heureHHMM, config: CONFIG_COMMANDE, joursFeriesISO: [],
      stockActuelL: 13250 - 2900, // ancienne ancre bugguée : "stock estimé maintenant"
      limiteRemplissageL: 19019 + 9534, consommationMoyenneJour: consommationMoyenneJourGo,
      historiqueParJour, commandeEnCoursVolumeL: 0, stockFiable: true,
    });
    const stockPrevuAvecAncreStockMaintenant = evalAvecAncreStockMaintenant.scenarioMaintenant.stockPrevuLivraisonL;

    assert.strictEqual(stockPrevuAvecAncreJaugeage, stockPrevuAvecAncreStockMaintenant + 2900, 'la projection réelle doit correspondre exactement à l\'ancre jaugeage (2 900 L de plus que l\'ancienne ancre buggée, montant des ventes du quart déjà clos — jamais soustrait deux fois)');
    assert.notStrictEqual(stockPrevuAvecAncreJaugeage, stockPrevuAvecAncreStockMaintenant, 'evaluerCommandeCarburantSite ne doit plus jamais reproduire le double compte de l\'ancienne ancre');

    // Champ d'affichage "stock estimé maintenant" toujours exposé,
    // inchangé, pour le monitoring temps réel (jamais supprimé).
    assert.strictEqual(goReel.stockEstimeMaintenantL, 13250 - 2900, 'stockEstimeMaintenantL (affichage) reste le stock net des ventes du jour, décorrélé de l\'ancre de recommandation');
    ok('evaluerCommandeCarburantSite — la recommandation s\'ancre réellement sur le jaugeage (règles 1+2), plus jamais sur le stock estimé maintenant, tout en gardant cet affichage intact');
  }

  console.log(`\n${n}/${n} tests passés.`);
})();
