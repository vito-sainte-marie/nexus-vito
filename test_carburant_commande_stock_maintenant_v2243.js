// Test — "Stock estimé maintenant" (25/08/2026, retour de Frédéric : "le
// jaugeage saisi le matin ne doit jamais être considéré comme le stock
// disponible maintenant"). Couvre NexusCarburantCommandeDonnees.
// chargerStockEtFiabiliteParCarburant() — le P0 de ce lot : avant
// correctif, cette fonction renvoyait le jaugeage brut du jour tel quel
// comme `stockActuelL`, sans jamais déduire les ventes déjà captées depuis
// ce jaugeage.
//
// NexusCarburantDonnees.chargerControleJour() est STUBBÉE directement
// (jamais réimplémentée) plutôt que remontée jusqu'à un mock Supabase
// complet : ses propres dépendances (carburant_releves, point zéro,
// station_config) sont déjà couvertes par la suite "chaîne temporelle
// carburant" existante — ce test isole uniquement la logique NOUVELLE
// ajoutée par ce lot (cas A/B, honnêteté en cas de chevauchement de quart),
// même discipline que test_carburant_commande_notification_v2239.js qui
// stubbe evaluerCommandeCarburantSite plutôt que de remonter jusqu'à
// Supabase.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

const HORAIRES = {
  quart1: { normal: '06:00', fin_normal: '14:00' },
  quart2: { normal: '14:00', fin_normal: '22:00' },
};
const FUSEAU = 'UTC'; // fuseau neutre pour un test déterministe, jamais lié au fuseau réel du site pilote.

function creerClientAuditsCaisse(lignes) {
  return {
    from(table) {
      assert.strictEqual(table, 'audits_caisse', 'seule audits_caisse doit être requêtée par cette fonction (Cas A)');
      return {
        select() { return this; },
        eq() { return this; },
        // gte/lt (25/08/2026, v2.246) : chargerHistoriqueVentesParQuart
        // (estimation historique d'un quart pas encore clôturé) requête
        // aussi audits_caisse avec un filtre de plage de dates — même mock
        // générique réutilisé, jamais un second mock dupliqué (Article 11).
        // Renvoie volontairement les mêmes lignes que le jour courant : leur
        // date n'étant jamais strictement antérieure à `dateISO`, elles sont
        // filtrées par moyenneRecente() elle-même (aucune estimation
        // fabriquée en l'absence de vrai historique antérieur).
        gte() { return this; },
        lt() { return this; },
        then(resolve) { return Promise.resolve({ data: lignes, error: null }).then(resolve); },
      };
    },
  };
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

(async () => {
  // ------------------------------------------------------------
  // 1) Cas A — jaugeage saisi aujourd'hui, un quart clos depuis : stock
  //    estimé maintenant = jaugeage − ventes du quart clos, JAMAIS le
  //    jaugeage brut.
  // ------------------------------------------------------------
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    charger(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: { date: '2026-08-25', mesure_le: '2026-08-25T05:30:00.000Z', origine: 'manager' }, // jaugeage d'ouverture, pris avant le quart1 (06:00 UTC)
        dernierReleve: null,
        parCarburant: {
          sp95: { reelDuJour: 12000, dernierReel: 11000, statut: 'Sous contrôle' },
          go: { reelDuJour: 8000, dernierReel: 7500, statut: 'Sous contrôle' },
        },
      }),
    };
    charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;

    const client = creerClientAuditsCaisse([
      { date: '2026-08-25', quart: '1', litrage_sp95: 800, litrage_gazole: 500, litrage_gnr: null },
    ]);
    const maintenant = '2026-08-25T15:00:00.000Z'; // après la fin du quart1 (14:00), avant la fin du quart2 (pas encore clos, aucune ligne)
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-25', HORAIRES, FUSEAU, maintenant);

    assert.strictEqual(r.parCarburant.sp95.jaugeageOuvertureL, 12000, 'jaugeage d\'ouverture affiché tel quel');
    assert.strictEqual(r.parCarburant.sp95.ventesDepuisJaugeageL, 800, 'ventes du quart clos depuis le jaugeage');
    assert.strictEqual(r.parCarburant.sp95.stockActuelL, 11200, 'stock estimé maintenant = 12000 - 800, jamais 12000');
    assert.notStrictEqual(r.parCarburant.sp95.stockActuelL, r.parCarburant.sp95.jaugeageOuvertureL, 'stock maintenant ≠ jaugeage brut dès qu\'une vente a eu lieu');
    assert.strictEqual(r.parCarburant.go.stockActuelL, 7500, 'go : 8000 - 500');
    assert.strictEqual(r.parCarburant.sp95.stockFiable, true);
    ok('Cas A (jaugeage aujourd\'hui) — stock estimé maintenant déduit des ventes captées depuis le jaugeage, jamais le jaugeage brut');
  }

  // ------------------------------------------------------------
  // 2) Cas A, honnêteté — un jaugeage LIÉ À UNE LIVRAISON (`origine:
  //    'reception_livraison'`) pris en cours de quart reste chevauchant :
  //    jamais un stock "maintenant" fabriqué sur une ventilation impossible
  //    à isoler (Article 5). C'est le SEUL cas qui garde ce comportement
  //    depuis le correctif du 25/08/2026 (retour de Frédéric) — un jaugeage
  //    d'ouverture normal (origine 'manager'/'terrain_pompiste', voir test
  //    2b ci-dessous) ne chevauche plus jamais, quelle que soit l'heure à
  //    laquelle il a été SAISI dans NEXUS.
  // ------------------------------------------------------------
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    charger(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: { date: '2026-08-25', mesure_le: '2026-08-25T07:00:00.000Z', origine: 'reception_livraison' }, // jaugeage post-livraison, EN PLEIN quart1 (06:00-14:00)
        dernierReleve: null,
        parCarburant: { sp95: { reelDuJour: 12000, dernierReel: 11000, statut: 'Sous contrôle' } },
      }),
    };
    charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;

    const client = creerClientAuditsCaisse([
      { date: '2026-08-25', quart: '1', litrage_sp95: 800, litrage_gazole: 500, litrage_gnr: null },
    ]);
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-25', HORAIRES, FUSEAU, '2026-08-25T15:00:00.000Z');

    assert.strictEqual(r.parCarburant.sp95.stockActuelL, null, 'jamais un stock "maintenant" fabriqué sur un quart chevauchant l\'instant réel d\'un jaugeage post-livraison');
    assert.strictEqual(r.parCarburant.sp95.stockFiable, false, 'non fiable plutôt qu\'un repli silencieux sur le jaugeage brut');
    ok('Cas A, honnêteté (relevé post-livraison) — quart chevauchant l\'instant réel de mesure -> stock maintenant non calculable, jamais un chiffre fabriqué');
  }

  // ------------------------------------------------------------
  // 2b) Cas A (25/08/2026, retour de Frédéric : "le jaugeage que je mets le
  //    matin est TOUJOURS celui de l'ouverture, même lorsqu'un employé
  //    oublie de le saisir dans NEXUS au bon moment") — un jaugeage
  //    D'OUVERTURE normal (origine 'manager', PAS lié à une livraison) saisi
  //    en pleine fenêtre du quart 1 (exactement le cas réel de
  //    vito-sainte-marie le 24/08/2026, mesure_le pris à 8h09 alors que le
  //    quart 1 court jusqu'à 12h45/13h45) ne doit PLUS être traité comme un
  //    chevauchement -- le quart 1, une fois clos, est normalement soustrait.
  // ------------------------------------------------------------
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    charger(sandbox, 'nexus-carburant-moteur.js');
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: { date: '2026-08-25', mesure_le: '2026-08-25T07:00:00.000Z', origine: 'manager' }, // saisi EN PLEIN quart1 (06:00-14:00), mais c'est un jaugeage d'ouverture normal
        dernierReleve: null,
        parCarburant: { sp95: { reelDuJour: 12000, dernierReel: 11000, statut: 'Sous contrôle' } },
      }),
    };
    charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;

    const client = creerClientAuditsCaisse([
      { date: '2026-08-25', quart: '1', litrage_sp95: 800, litrage_gazole: 500, litrage_gnr: null },
    ]);
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-25', HORAIRES, FUSEAU, '2026-08-25T15:00:00.000Z');

    assert.strictEqual(r.parCarburant.sp95.stockActuelL, 11200, 'jaugeage d\'ouverture saisi en cours de quart 1 -> le quart clos (800 L) est quand même normalement soustrait, jamais "non calculable" à tort');
    assert.strictEqual(r.parCarburant.sp95.stockFiable, true);
    ok('Cas A (jaugeage d\'ouverture saisi en cours de quart 1, cas réel 24/08) — plus jamais un faux chevauchement, le quart clos est normalement soustrait');
  }

  // ------------------------------------------------------------
  // 3) Cas B — aucun jaugeage aujourd'hui : réutilise directement
  //    `ventesDepuis` déjà calculée par chargerControleJour (qui étend elle-
  //    même sa fenêtre jusqu'à "maintenant" dans ce cas), aucun second calcul.
  // ------------------------------------------------------------
  {
    const sandbox = { console, window: undefined };
    vm.createContext(sandbox);
    sandbox.window = sandbox;
    charger(sandbox, 'nexus-carburant-moteur.js');
    let appelsAuditsCaisse = 0;
    sandbox.NexusCarburantDonnees = {
      chargerControleJour: async () => ({
        aucunReleve: false,
        releveDuJour: null, // pas de jaugeage aujourd'hui
        dernierReleve: { mesure_le: '2026-08-24T06:00:00.000Z' },
        parCarburant: {
          sp95: { reelDuJour: null, dernierReel: 15000, ventesDepuis: 2300, statut: 'Sous contrôle' },
        },
      }),
    };
    charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
    const Donnees = sandbox.NexusCarburantCommandeDonnees;

    const client = { from() { appelsAuditsCaisse++; throw new Error('Cas B ne doit jamais requêter audits_caisse — ventesDepuis déjà calculée par chargerControleJour'); } };
    const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', '2026-08-25', HORAIRES, FUSEAU, '2026-08-25T15:00:00.000Z');

    assert.strictEqual(appelsAuditsCaisse, 0, 'aucune requête supplémentaire en Cas B (Article 11, réutilisation de ventesDepuis)');
    assert.strictEqual(r.parCarburant.sp95.stockActuelL, 15000 - 2300, 'stock estimé maintenant = dernier jaugeage fiable - ventesDepuis (déjà étendu à "maintenant" par chargerControleJour)');
    ok('Cas B (pas de jaugeage aujourd\'hui) — réutilise ventesDepuis sans second calcul ni requête supplémentaire');
  }

  console.log(`\n${n}/${n} tests passés.`);
})();
