// Test — Journal horodaté des recommandations de commande (27/08/2026,
// refonte qualitative demandée par Frédéric, point 20) :
//
// "Ajouter un journal minimal :
//   27/08 10:10 — recommandation : 11 000 L GO
//   27/08 14:40 — recommandation recalculée : 9 000 L GO
//   Motif : ventes inférieures aux prévisions.
// Lorsqu'une recommandation change, conserver : ancienne recommandation,
// nouvelle recommandation, timestamp, raison principale du recalcul."
//
// Deux volets, même discipline que test_carburant_commande_pont_de_mois_v2258.js
// (fonction pure, sans mock) + test_carburant_commande_fin_de_mois_livraison_v2257.js
// (intégration avec mock Supabase minimal) :
//   A) NexusCarburantCommandeMoteur.resoudreEntreeJournalRecommandation() —
//      fonction PURE (Article 11, même famille que resoudreEntreeJournalFraicheur,
//      nexus-carburant-moteur.js v2.222) : décide si une ligne d'historique
//      doit être ajoutée et formule le motif à partir de signaux connus.
//   B) NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite() écrit
//      effectivement dans carburant_recommandation_journal (une ligne par
//      carburant évalué, jamais pour un carburant `non_calculable` —
//      Article 5/point 16, pas de "0 L" fictif journalisé).

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

const sandboxA = { console };
vm.createContext(sandboxA);
charger(sandboxA, 'nexus-carburant-moteur.js');
charger(sandboxA, 'nexus-carburant-commande-moteur.js');
const M = sandboxA.NexusCarburantCommandeMoteur;

// ------------------------------------------------------------
// A1) Première recommandation jamais journalisée (existant = null) —
//     ligne créée, motif encore null (rien à comparer).
// ------------------------------------------------------------
{
  const r = M.resoudreEntreeJournalRecommandation({
    existant: null, recommandationL: 11000, etat: 'securite',
    ventesPrevuesL: 6448, stockAncreCommandeL: 13250,
  });
  assert.strictEqual(r.estNouveau, true);
  assert.strictEqual(r.inchange, false);
  assert.strictEqual(r.snapshot.recommandation_l, 11000);
  assert.strictEqual(r.snapshot.motif, null, 'première ligne du journal : rien à expliquer, pas de motif inventé');
  ok('première recommandation (existant=null) — ligne créée, motif null (exemple de Frédéric : "27/08 10:10 — recommandation : 11 000 L GO")');
}

// ------------------------------------------------------------
// A2) Même recommandation, même état -> aucune nouvelle ligne (jamais un
//     journal qui grossit à chaque appel identique, seulement les vraies
//     transitions).
// ------------------------------------------------------------
{
  const existant = { historique: [{ date: '2026-08-27T10:10:00.000Z', recommandation_l: 11000, etat: 'securite', ventes_prevues_l: 6448, stock_ancre_l: 13250, motif: null }] };
  const r = M.resoudreEntreeJournalRecommandation({
    existant, recommandationL: 11000, etat: 'securite',
    ventesPrevuesL: 6448, stockAncreCommandeL: 13250,
  });
  assert.strictEqual(r.inchange, true);
  assert.strictEqual(r.snapshot, null);
  ok('recommandation strictement inchangée — aucune nouvelle ligne de journal (pas de bruit)');
}

// ------------------------------------------------------------
// A3) Recommandation revue à la baisse, ventes prévues plus faibles que la
//     dernière fois -> motif = "ventes prévues révisées à la baisse",
//     exactement l'exemple de Frédéric ("Motif : ventes inférieures aux
//     prévisions").
// ------------------------------------------------------------
{
  const existant = { historique: [{ date: '2026-08-27T10:10:00.000Z', recommandation_l: 11000, etat: 'securite', ventes_prevues_l: 6448, stock_ancre_l: 13250, motif: null }] };
  const r = M.resoudreEntreeJournalRecommandation({
    existant, recommandationL: 9000, etat: 'securite',
    ventesPrevuesL: 5000, stockAncreCommandeL: 13250,
  });
  assert.strictEqual(r.estNouveau, false);
  assert.strictEqual(r.inchange, false);
  assert.strictEqual(r.snapshot.recommandation_l, 9000);
  const attendu = `Ventes prévues révisées à la baisse (${Math.round(6448).toLocaleString('fr-FR')} L → ${Math.round(5000).toLocaleString('fr-FR')} L).`;
  assert.strictEqual(r.snapshot.motif, attendu, 'motif = signal observable (ventes prévues), jamais une cause inventée — exemple exact de Frédéric (11 000 L -> 9 000 L, "ventes inférieures aux prévisions")');
  ok('recommandation recalculée à la baisse — motif "ventes prévues révisées à la baisse" avec les 2 chiffres exacts (exemple de Frédéric : 27/08 14:40 — recommandation recalculée : 9 000 L GO)');
}

// ------------------------------------------------------------
// A3bis) (28/08/2026, §23 — scénario explicite de Frédéric parmi les 10
//        tests obligatoires) : "ventes > prévisions -> recalcul". Miroir
//        exact de A3 (ventes inférieures), mais à la HAUSSE : les ventes
//        réelles dépassent la prévision précédente -> la recommandation
//        est révisée à la hausse, motif "ventes prévues révisées à la
//        hausse" (branche symétrique de resoudreEntreeJournalRecommandation,
//        jamais testée jusqu'ici alors que le code la prévoyait déjà).
// ------------------------------------------------------------
{
  const existant = { historique: [{ date: '2026-08-27T10:10:00.000Z', recommandation_l: 9000, etat: 'a_anticiper', ventes_prevues_l: 5000, stock_ancre_l: 13250, motif: null }] };
  const r = M.resoudreEntreeJournalRecommandation({
    existant, recommandationL: 12000, etat: 'securite',
    ventesPrevuesL: 7500, stockAncreCommandeL: 13250,
  });
  assert.strictEqual(r.estNouveau, false);
  assert.strictEqual(r.inchange, false);
  assert.strictEqual(r.snapshot.recommandation_l, 12000);
  const attenduHausse = `Ventes prévues révisées à la hausse (${Math.round(5000).toLocaleString('fr-FR')} L → ${Math.round(7500).toLocaleString('fr-FR')} L).`;
  assert.strictEqual(r.snapshot.motif, attenduHausse, 'ventes réelles/prévues supérieures à la dernière évaluation -> motif "à la hausse", jamais réutilisé le libellé "à la baisse" par erreur de signe');
  ok('ventes > prévisions -> recalcul à la hausse (§23) — motif "ventes prévues révisées à la hausse" avec les 2 chiffres exacts, miroir symétrique de A3');
}

// ------------------------------------------------------------
// A4) Recommandation différente, ventes prévues inchangées mais stock de
//     référence (jaugeage) mis à jour -> motif = "stock de référence mis
//     à jour", jamais confondu avec le motif "ventes prévues".
// ------------------------------------------------------------
{
  const existant = { historique: [{ date: '2026-08-27T10:10:00.000Z', recommandation_l: 11000, etat: 'securite', ventes_prevues_l: 6448, stock_ancre_l: 13250, motif: null }] };
  const r = M.resoudreEntreeJournalRecommandation({
    existant, recommandationL: 10000, etat: 'securite',
    ventesPrevuesL: 6448, stockAncreCommandeL: 14000,
  });
  const attendu = `Stock de référence mis à jour (${Math.round(13250).toLocaleString('fr-FR')} L → ${Math.round(14000).toLocaleString('fr-FR')} L).`;
  assert.strictEqual(r.snapshot.motif, attendu);
  ok('recommandation recalculée avec ventes prévues inchangées mais stock ancre différent — motif "stock de référence mis à jour"');
}

// ------------------------------------------------------------
// A5) Recommandation différente sans signal observable connu (aucune
//     donnée de comparaison) -> motif générique honnête, jamais une
//     explication fabriquée.
// ------------------------------------------------------------
{
  const existant = { historique: [{ date: '2026-08-27T10:10:00.000Z', recommandation_l: 11000, etat: 'securite', ventes_prevues_l: null, stock_ancre_l: null, motif: null }] };
  const r = M.resoudreEntreeJournalRecommandation({
    existant, recommandationL: 9000, etat: 'securite',
    ventesPrevuesL: null, stockAncreCommandeL: null,
  });
  assert.strictEqual(r.snapshot.motif, 'Recalcul automatique (nouvelle évaluation du jour).', 'aucun signal comparable disponible -> motif générique, jamais une cause inventée (Article 5)');
  ok('recommandation différente sans signal observable comparable — motif générique honnête');
}

// ------------------------------------------------------------
// B) Intégration : evaluerCommandeCarburantSite() écrit réellement dans
//    carburant_recommandation_journal — une ligne par carburant évalué,
//    AUCUNE pour un carburant non_calculable (GNR, ici sans historique
//    suffisant), même discipline que test_carburant_commande_fin_de_mois_livraison_v2257.js.
// ------------------------------------------------------------
(async () => {
  const sandboxB = { console, window: undefined };
  vm.createContext(sandboxB);
  sandboxB.window = sandboxB;
  charger(sandboxB, 'nexus-carburant-moteur.js');

  const CONFIG_COMMANDE = {
    cutoff_heure: '11:00', jours_livraison_iso: [1, 2, 3, 4, 5],
    maximum_camion_litres: 36000, minimum_camion_litres: 10000,
    stock_securite_jours_normal: 2, stock_securite_jours_fin_mois: 1,
    compartiments_disponibles_litres: [2000, 5000, 7000],
  };
  const CUVES_VITO = {
    sp95: { actif: true, label: 'SP95', cuves: [{ id: 'unique', capacite: 30276, limite_remplissage: 28761 }] },
    go: { actif: true, label: 'GO', cuves: [{ id: 'cuve1', capacite: 20020, limite_remplissage: 19019 }, { id: 'cuve2', capacite: 10036, limite_remplissage: 9534 }] },
    gnr: { actif: true, label: 'GNR', cuves: [{ id: 'unique', capacite: 30000, limite_remplissage: 28500 }] },
  };
  const HORAIRES = { quart1: { normal: '06:00', fin_normal: '14:00' }, quart2: { normal: '14:00', fin_normal: '22:00' } };
  const FUSEAU = 'UTC';

  // GO : historique suffisant (14 jours à 3 500 L/j) -> évaluation fiable,
  // état probable "securite" avec ce stock volontairement bas. GNR : aucun
  // historique -> non_calculable, ne doit jamais générer de ligne de
  // journal.
  const HISTORIQUE_ROWS = [];
  for (let i = 1; i <= 14; i++) {
    HISTORIQUE_ROWS.push({ date: `2026-08-${String(i).padStart(2, '0')}`, litrage_sp95: 6000, litrage_gazole: 3500, litrage_gnr: null });
  }

  sandboxB.NexusCarburantDonnees = {
    chargerControleJour: async () => ({
      aucunReleve: false,
      parCarburant: {
        go: { dernierReel: 8000, ventesDepuis: 0, statut: 'Sous contrôle' },
        sp95: { dernierReel: 25000, ventesDepuis: 0, statut: 'Sous contrôle' },
        gnr: { dernierReel: null, ventesDepuis: null, statut: 'Données insuffisantes' },
      },
      dernierReleve: { mesure_le: '2026-08-27T06:00:00.000Z' },
    }),
  };
  charger(sandboxB, 'nexus-carburant-commande-moteur.js');
  charger(sandboxB, 'nexus-carburant-commande-donnees-core.js');
  const Donnees = sandboxB.NexusCarburantCommandeDonnees;

  const journalStore = {};
  function chainSelectUnique(cle) {
    return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: journalStore[cle] || null, error: null }; } };
  }

  function creerClient() {
    return {
      from(table) {
        if (table === 'station_config') {
          const data = { carburant_commande_config: CONFIG_COMMANDE, cuves_carburants: CUVES_VITO, fuseau_horaire: FUSEAU, horaires: HORAIRES };
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
          let estPlage = false;
          const chain = {
            select() { return chain; }, eq() { return chain; },
            gte() { estPlage = true; return chain; }, lt() { estPlage = true; return chain; },
            then(resolve) { return Promise.resolve({ data: estPlage ? HISTORIQUE_ROWS : [], error: null }).then(resolve); },
          };
          return chain;
        }
        if (table === 'carburant_recommandation_journal') {
          let cle = null, mode = null, payload = null;
          const chain = {
            select() {
              if (mode === null) mode = 'select';
              return chain;
            },
            eq(col, val) {
              if (mode === 'select' || mode === null) {
                cle = cle || {};
                cle[col] = val;
              }
              return chain;
            },
            async maybeSingle() {
              if (mode === 'insert') {
                const k = `${payload.site_id}|${payload.carburant}`;
                journalStore[k] = { ...payload, id: `id-${k}` };
                return { data: journalStore[k], error: null };
              }
              if (mode === 'update') {
                const k = this._updateKey;
                journalStore[k] = { ...journalStore[k], ...payload };
                return { data: journalStore[k], error: null };
              }
              const k = `${cle.site_id}|${cle.carburant}`;
              return { data: journalStore[k] || null, error: null };
            },
            insert(ligne) { mode = 'insert'; payload = ligne; return chain; },
            update(patch) { mode = 'update'; payload = patch; return chain; },
          };
          // eq() après update() sert à retrouver quelle ligne patcher (par id) —
          // le mock résout directement via le store existant (une seule ligne
          // possible par site+carburant dans ce test).
          const origEq = chain.eq;
          chain.eq = function (col, val) {
            if (mode === 'update' && col === 'id') {
              const k = Object.keys(journalStore).find(key => journalStore[key].id === val);
              chain._updateKey = k;
              return chain;
            }
            return origEq(col, val);
          };
          return chain;
        }
        throw new Error('Table non mockée par ce test : ' + table);
      },
    };
  }

  // --- Premier appel : crée la ligne de journal pour GO et SP95, aucune pour GNR ---
  const client1 = creerClient();
  const r1 = await Donnees.evaluerCommandeCarburantSite(client1, 'vito-sainte-marie', { dateISO: '2026-08-27', heureHHMM: '09:00' });
  assert.strictEqual(r1.ok, true);
  // Laisse les écritures best-effort (non attendues par evaluerCommandeCarburantSite
  // lui-même) se terminer avant de vérifier le store.
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(journalStore['vito-sainte-marie|go'], 'une ligne de journal doit exister pour GO après la première évaluation');
  assert.ok(journalStore['vito-sainte-marie|sp95'], 'une ligne de journal doit exister pour SP95 après la première évaluation');
  assert.strictEqual(journalStore['vito-sainte-marie|gnr'], undefined, 'AUCUNE ligne de journal pour GNR (non_calculable, historique absent) — jamais une recommandation de "0 L" journalisée pour un carburant que NEXUS ne sait pas évaluer (point 16)');
  ok('première évaluation réelle — ligne de journal créée pour GO et SP95, aucune pour GNR (non_calculable)');

  const recoGoInitiale = journalStore['vito-sainte-marie|go'].recommandation_l;
  const historiqueGoInitial = journalStore['vito-sainte-marie|go'].historique.length;
  assert.strictEqual(historiqueGoInitial, 1);

  // --- Deuxième appel, mêmes données -> aucune nouvelle ligne d'historique (pas de bruit) ---
  const client2 = creerClient();
  await Donnees.evaluerCommandeCarburantSite(client2, 'vito-sainte-marie', { dateISO: '2026-08-27', heureHHMM: '09:05' });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(journalStore['vito-sainte-marie|go'].historique.length, 1, 'mêmes données -> aucune nouvelle ligne (le journal ne grossit pas à chaque rafraîchissement identique)');
  ok('second appel avec des données strictement identiques — le journal ne grossit pas (pas de bruit)');

  console.log(`\n${n}/${n} tests passés.`);
})();
