// Test — Estimation historique d'un quart en cours (25/08/2026, v2.246,
// retour de Frédéric : "nexus doit faire une estimation des ventes en
// fonction de son historique" plutôt que de bloquer le "stock estimé
// maintenant" tant qu'un quart n'est pas clôturé). Couvre :
//   - M.quartsAEstimerDansFenetre (nexus-carburant-moteur.js) — fonction
//     pure identifiant les quarts encore ouverts pertinents à estimer.
//   - NexusCarburantCommandeDonnees.chargerStockEtFiabiliteParCarburant —
//     intégration bout en bout : estimation prorata-temps injectée dans le
//     stock estimé maintenant, marquée honnêtement `stockEstimeParHistorique`.
//
// Distinct du chevauchement réel (v2.205, test_chaine_temporelle_carburant_
// 20260821.js) : ici, aucune ligne audits_caisse n'existe encore pour le
// quart (pas clôturé), jamais une ligne existante à la ventilation ambiguë.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const HORAIRES = {
  quart1: { etendu: '06:00', fin_etendu: '14:00' },
  quart2: { etendu: '14:00', fin_etendu: '22:00' },
};
const FUSEAU = 'UTC';
const DATE = '2026-08-25';

// ------------------------------------------------------------
// 1) M.quartsAEstimerDansFenetre — fonction pure, cas isolés.
// ------------------------------------------------------------
{
  const sandbox = { console };
  vm.createContext(sandbox);
  charger(sandbox, 'nexus-carburant-moteur.js');
  const M = sandbox.NexusCarburantMoteur;

  // 1a) Quart1 en cours (3h écoulées sur 8h), aucune ligne aujourd'hui ->
  //     quart1 seul, fraction 0.375 ; quart2 pas encore commencé -> exclu.
  {
    const t0 = new Date(`${DATE}T00:00:00.000Z`);
    const t1 = new Date(`${DATE}T09:00:00.000Z`);
    const r = M.quartsAEstimerDansFenetre([], HORAIRES, DATE, t0, t1, FUSEAU);
    assert.strictEqual(r.length, 1, 'seul quart1 est pertinent, quart2 n\'a pas commencé');
    assert.strictEqual(r[0].quartCle, 'quart1');
    assert.ok(Math.abs(r[0].fraction - 0.375) < 0.001, `fraction attendue 0.375, obtenue ${r[0].fraction}`);
  }

  // 1b) Quart1 déjà clôturé (une ligne existe) -> jamais recouvert par
  //     l'estimation, même si sa fenêtre touche [t0,t1].
  {
    const t0 = new Date(`${DATE}T00:00:00.000Z`);
    const t1 = new Date(`${DATE}T09:00:00.000Z`);
    const lignes = [{ date: DATE, quart: '1', litrage_sp95: 800 }];
    const r = M.quartsAEstimerDansFenetre(lignes, HORAIRES, DATE, t0, t1, FUSEAU);
    assert.deepStrictEqual(Array.from(r), [], 'quart1 déjà clôturé -> jamais réestimé par-dessus une ligne existante');
  }

  // 1c) Fenêtre qui dépasse largement quart1 (entré en quart2) -> quart1
  //     fraction 1 (entièrement écoulé mais toujours pas clôturé), quart2
  //     fraction partielle.
  {
    const t0 = new Date(`${DATE}T00:00:00.000Z`);
    const t1 = new Date(`${DATE}T15:00:00.000Z`);
    const r = M.quartsAEstimerDansFenetre([], HORAIRES, DATE, t0, t1, FUSEAU);
    assert.strictEqual(r.length, 2, 'quart1 (entièrement écoulé, pas clôturé) ET quart2 (en cours) sont tous deux pertinents');
    const q1 = r.find(q => q.quartCle === 'quart1');
    const q2 = r.find(q => q.quartCle === 'quart2');
    assert.strictEqual(q1.fraction, 1, 'quart1 entièrement écoulé -> fraction 1 (moyenne complète)');
    assert.ok(Math.abs(q2.fraction - 0.125) < 0.001, `quart2 : 1h/8h écoulée, fraction attendue 0.125, obtenue ${q2.fraction}`);
  }

  // 1d) Horaires non configurés pour un quart -> jamais une estimation
  //     fabriquée sur un horaire par défaut inventé (Article 5).
  {
    const horairesPartiels = { quart1: HORAIRES.quart1 }; // quart2 absent
    const t0 = new Date(`${DATE}T00:00:00.000Z`);
    const t1 = new Date(`${DATE}T15:00:00.000Z`);
    const r = M.quartsAEstimerDansFenetre([], horairesPartiels, DATE, t0, t1, FUSEAU);
    assert.ok(!r.find(q => q.quartCle === 'quart2'), 'quart2 sans horaires configurés -> jamais estimé');
  }

  // 1e) Fenêtre avant l'ouverture de quart1 -> aucun quart pertinent.
  {
    const t0 = new Date(`${DATE}T00:00:00.000Z`);
    const t1 = new Date(`${DATE}T02:00:00.000Z`);
    const r = M.quartsAEstimerDansFenetre([], HORAIRES, DATE, t0, t1, FUSEAU);
    assert.deepStrictEqual(Array.from(r), [], 'avant l\'ouverture de quart1 -> rien à estimer');
  }

  ok('quartsAEstimerDansFenetre — identifie les quarts ouverts/non clôturés pertinents, jamais ceux déjà clôturés ou hors fenêtre');
}

(async () => {

// ------------------------------------------------------------
// 2) Intégration bout en bout — chargerStockEtFiabiliteParCarburant utilise
//    l'estimation pour ne plus bloquer le stock maintenant quand un quart
//    est en cours, cas entièrement calculé à la main.
// ------------------------------------------------------------
{
  function creerClientMock(reponses) {
    const compteurs = {};
    function prochaine(table) {
      const liste = reponses[table] || [];
      const i = compteurs[table] || 0;
      compteurs[table] = i + 1;
      return liste[i] || { data: null, error: null };
    }
    return {
      from(table) {
        const chain = {
          select() { return chain; },
          eq() { return chain; },
          gte() { return chain; },
          lt() { return chain; },
          then(resolve, reject) { return Promise.resolve(prochaine(table)).then(resolve, reject); },
        };
        return chain;
      },
    };
  }

  const sandbox = { console, window: undefined };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  sandbox.NexusCarburantDonnees = {
    chargerControleJour: async () => ({
      aucunReleve: false,
      releveDuJour: { date: DATE, mesure_le: `${DATE}T06:52:00.000Z`, origine: 'manager' }, // jaugeage d'ouverture, cas réel 25/08 vito-sainte-marie
      dernierReleve: null,
      parCarburant: { sp95: { reelDuJour: 12000, dernierReel: 11000, statut: 'Sous contrôle' } },
    }),
  };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
  const Donnees = sandbox.NexusCarburantCommandeDonnees;

  // Historique quart1 SP95 : 4 jours antérieurs, moyenne simple 750 L
  // ((800+900+700+600)/4). Toutes les dates < DATE -> retenues par
  // moyenneRecente (jamais le jour courant lui-même, Article 5).
  const historiqueQuart1 = [
    { date: '2026-08-21', litrage_gazole: 500, litrage_sp95: 800, litrage_gnr: null },
    { date: '2026-08-22', litrage_gazole: 500, litrage_sp95: 900, litrage_gnr: null },
    { date: '2026-08-23', litrage_gazole: 500, litrage_sp95: 700, litrage_gnr: null },
    { date: '2026-08-24', litrage_gazole: 500, litrage_sp95: 600, litrage_gnr: null },
  ];
  const client = creerClientMock({
    audits_caisse: [
      { data: [], error: null }, // aucune ligne aujourd'hui -> quart1 pas clôturé
      { data: historiqueQuart1, error: null }, // historique de quart1 pour l'estimation
    ],
  });

  // t1 = 10h -> quart1 (06h-14h) écoulé à 50% (4h/8h).
  const maintenant = `${DATE}T10:00:00.000Z`;
  const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'vito-sainte-marie', DATE, HORAIRES, FUSEAU, maintenant);

  const attendu = 12000 - (750 * 0.5); // 11 625
  assert.ok(Math.abs(r.parCarburant.sp95.stockActuelL - attendu) < 0.5,
    `stock estimé maintenant attendu ~${attendu} L (12000 - 750*0.5), obtenu ${r.parCarburant.sp95.stockActuelL}`);
  assert.strictEqual(r.parCarburant.sp95.stockFiable, true, 'un quart en cours estimé reste utilisable, jamais bloqué (retour de Frédéric)');
  assert.strictEqual(r.parCarburant.sp95.stockEstimeParHistorique, true, 'marqué honnêtement comme estimé, jamais présenté comme une mesure certaine');
  assert.ok(Math.abs(r.parCarburant.sp95.ventesEstimeesInclusesL - 375) < 0.5, `part estimée attendue ~375 L, obtenue ${r.parCarburant.sp95.ventesEstimeesInclusesL}`);

  ok('chargerStockEtFiabiliteParCarburant — quart en cours estimé via l\'historique récent (prorata du temps écoulé), jamais un blocage total');
}

// ------------------------------------------------------------
// 3) Aucun historique disponible (site jeune) -> jamais un chiffre fabriqué,
//    reste honnêtement non calculable (Article 5, même discipline que le
//    reste du moteur commande).
// ------------------------------------------------------------
{
  function creerClientMockVide() {
    return {
      from() {
        const chain = {
          select() { return chain; },
          eq() { return chain; },
          gte() { return chain; },
          lt() { return chain; },
          then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
        };
        return chain;
      },
    };
  }
  const sandbox = { console, window: undefined };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  charger(sandbox, 'nexus-carburant-moteur.js');
  sandbox.NexusCarburantDonnees = {
    chargerControleJour: async () => ({
      aucunReleve: false,
      releveDuJour: { date: DATE, mesure_le: `${DATE}T06:52:00.000Z`, origine: 'manager' },
      dernierReleve: null,
      parCarburant: { sp95: { reelDuJour: 12000, dernierReel: 11000, statut: 'Sous contrôle' } },
    }),
  };
  charger(sandbox, 'nexus-carburant-commande-moteur.js');
  charger(sandbox, 'nexus-carburant-commande-donnees-core.js');
  const Donnees = sandbox.NexusCarburantCommandeDonnees;

  const client = creerClientMockVide();
  const r = await Donnees.chargerStockEtFiabiliteParCarburant(client, 'site-jeune', DATE, HORAIRES, FUSEAU, `${DATE}T10:00:00.000Z`);
  assert.strictEqual(r.parCarburant.sp95.stockActuelL, null, 'aucun historique disponible -> jamais un chiffre fabriqué');
  assert.strictEqual(r.parCarburant.sp95.stockFiable, false);
  ok('chargerStockEtFiabiliteParCarburant — aucun historique disponible (site jeune) -> reste honnêtement non calculable, jamais un zéro fabriqué');
}

console.log(`\n${n}/${n} tests passés.`);
})();
