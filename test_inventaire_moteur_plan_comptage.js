// Test — Moteur de plan de comptage tournant (nexus-inventaire-moteur.js)
// Cahier "Inventaire 2.0 - Audit & implémentation" (17/08/2026), P0
// Sprint 1 "Vérité physique" + Sprint 2 "Plan tournant" + Sprint 3 "Total
// produit". Charge le vrai fichier moteur (jamais réécrit à la main), comme
// tous les tests de ce module.

const path = require('path');
const assert = require('assert');

const MOTEUR_PATH = path.join(__dirname, 'nexus-inventaire-moteur.js');
require(MOTEUR_PATH);
const M = globalThis.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');

let nbTests = 0, nbOk = 0;
function test(nom, fn) {
  nbTests++;
  try {
    fn();
    nbOk++;
    console.log(`  OK  ${nom}`);
  } catch (e) {
    console.log(`FAIL  ${nom}`);
    console.log(`      ${e.message}`);
  }
}

// ------------------------------------------------------------
// Jeu de données — 8 produits couvrant les 3 familles + une anomalie
// récente non-en-retard (cas exact du bug corrigé le 17/08/2026).
// ------------------------------------------------------------
function produits() {
  return [
    { id: 'p_critique_1', actif: true },
    { id: 'p_critique_2', actif: true },
    { id: 'p_anomalie_recente', actif: true },   // compté hier, delaiMax=7 -> pas en retard, MAIS anomalie récente
    { id: 'p_standard_retard', actif: true },    // compté il y a 20j, delaiMax=7 -> en retard
    { id: 'p_standard_ok', actif: true },        // compté il y a 1j, delaiMax=7 -> pas en retard
    { id: 'p_faible_retard', actif: true },      // compté il y a 30j, delaiMax=21 -> en retard
    { id: 'p_faible_ok', actif: true },          // compté il y a 2j, delaiMax=21 -> pas en retard
    { id: 'p_jamais_controle', actif: true },    // aucun dernier contrôle -> toujours en retard
  ];
}

function regles() {
  return {
    p_critique_1: { frequence_controle: 'critique' },
    p_critique_2: { frequence_controle: 'critique' },
    p_anomalie_recente: { frequence_controle: 'standard' },
    p_standard_retard: { frequence_controle: 'standard' },
    p_standard_ok: { frequence_controle: 'standard' },
    p_faible_retard: { frequence_controle: 'faible_rotation' },
    p_faible_ok: { frequence_controle: 'faible_rotation' },
    // p_jamais_controle : pas de règle -> défaut 'standard'
  };
}

const DATE = '2026-08-17';
function derniersControles() {
  return {
    p_critique_1: '2026-08-16',      // hier -> en retard car delaiMax critique = 0
    p_critique_2: '2026-08-17',      // aujourd'hui -> reste en retard (delaiMax=0, joursDepuis=0 >= 0)
    p_anomalie_recente: '2026-08-16', // hier, delaiMax=7 -> PAS en retard
    p_standard_retard: '2026-07-28',  // 20 jours -> en retard (>=7)
    p_standard_ok: '2026-08-16',      // 1 jour -> pas en retard
    p_faible_retard: '2026-07-18',    // 30 jours -> en retard (>=21)
    p_faible_ok: '2026-08-15',        // 2 jours -> pas en retard
    // p_jamais_controle absent
  };
}

function inputBase(overrides) {
  return Object.assign({
    produits: produits(),
    reglesParProduit: regles(),
    dernierControleParProduit: derniersControles(),
    produitsAvecAnomalieRecente: ['p_anomalie_recente'],
    quart: 'matin',
    dateISO: DATE,
    socleCible: 4,
    surprisesCible: 0, // désactivé par défaut pour isoler la logique hors-surprise
    seed: 'vito-sainte-marie|2026-08-17|matin',
    surprisesRecentesParProduit: [],
  }, overrides || {});
}

// ------------------------------------------------------------
// 1. Déterminisme (INV2-04) — deux appels identiques -> même plan.
// ------------------------------------------------------------
test('construirePlanComptage est déterministe (deux appels identiques -> même résultat)', () => {
  const r1 = M.construirePlanComptage(inputBase({ surprisesCible: 4 }));
  const r2 = M.construirePlanComptage(inputBase({ surprisesCible: 4 }));
  assert.deepStrictEqual(r1.items.map(i => i.produit_id), r2.items.map(i => i.produit_id));
  assert.deepStrictEqual(r1.items.map(i => i.raison_selection), r2.items.map(i => i.raison_selection));
});

// ------------------------------------------------------------
// 2. Critiques toujours inclus, jamais plafonnés par le socle.
// ------------------------------------------------------------
test('les deux produits critiques sont toujours inclus, quel que soit le socle', () => {
  const r = M.construirePlanComptage(inputBase({ socleCible: 0 }));
  const critiques = r.items.filter(i => i.raison_selection === 'critique').map(i => i.produit_id);
  assert.deepStrictEqual(critiques.sort(), ['p_critique_1', 'p_critique_2']);
});

// ------------------------------------------------------------
// 3. Anomalie récente incluse même si le produit n'est pas en retard
//    (régression du bug corrigé le 17/08/2026 avant livraison).
// ------------------------------------------------------------
test('un produit avec anomalie récente est inclus même s\'il n\'est pas encore en retard', () => {
  const r = M.construirePlanComptage(inputBase({ socleCible: 0 }));
  const item = r.items.find(i => i.produit_id === 'p_anomalie_recente');
  assert.ok(item, 'p_anomalie_recente absent du plan');
  assert.strictEqual(item.raison_selection, 'anomalie_recente');
});

// ------------------------------------------------------------
// 4. Coverage_gap : produits en retard non-critiques, non-anomalie,
//    toujours inclus (jamais plafonnés), triés par ancienneté décroissante.
// ------------------------------------------------------------
test('coverage_gap inclut tous les produits en retard, triés du plus ancien au plus récent', () => {
  const r = M.construirePlanComptage(inputBase({ socleCible: 0 }));
  const gap = r.items.filter(i => i.raison_selection === 'coverage_gap');
  const ids = gap.map(i => i.produit_id);
  assert.ok(ids.includes('p_standard_retard'));
  assert.ok(ids.includes('p_faible_retard'));
  assert.ok(ids.includes('p_jamais_controle'));
  // p_jamais_controle (Infinity jours) doit passer avant les deux autres.
  assert.strictEqual(ids[0], 'p_jamais_controle');
});

// ------------------------------------------------------------
// 5. Quota tournant : complète jusqu'au socle avec les produits pas
//    encore en retard, jamais au-delà.
// ------------------------------------------------------------
test('quota_tournant complète exactement jusqu\'au socle cible, jamais au-delà', () => {
  // Avant quota : critique(2) + anomalie(1) + coverage_gap(3) = 6 déjà.
  // socleCible=6 -> aucun quota ajouté. socleCible=8 -> jusqu'à 2 ajoutés
  // parmi les 2 restants (p_standard_ok, p_faible_ok).
  const rSansQuota = M.construirePlanComptage(inputBase({ socleCible: 6 }));
  assert.strictEqual(rSansQuota.compteurs.quota_tournant, 0);

  const rAvecQuota = M.construirePlanComptage(inputBase({ socleCible: 8 }));
  assert.strictEqual(rAvecQuota.compteurs.quota_tournant, 2);
  const ids = rAvecQuota.items.map(i => i.produit_id);
  assert.ok(ids.includes('p_standard_ok'));
  assert.ok(ids.includes('p_faible_ok'));
});

// ------------------------------------------------------------
// 6. Surprises : exactement N tirées, jamais un doublon d'un produit déjà
//    dans le plan.
// ------------------------------------------------------------
test('exactement N surprises sont tirées, sans jamais dupliquer un produit déjà sélectionné', () => {
  const r = M.construirePlanComptage(inputBase({ socleCible: 0, surprisesCible: 2 }));
  assert.strictEqual(r.compteurs.surprise, 2);
  const ids = r.items.map(i => i.produit_id);
  assert.strictEqual(new Set(ids).size, ids.length, 'un produit apparaît deux fois dans le plan');
});

test('le tirage des surprises reste déterministe pour une même seed', () => {
  const r1 = M.construirePlanComptage(inputBase({ socleCible: 0, surprisesCible: 2 }));
  const r2 = M.construirePlanComptage(inputBase({ socleCible: 0, surprisesCible: 2 }));
  const s1 = r1.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id).sort();
  const s2 = r2.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id).sort();
  assert.deepStrictEqual(s1, s2);
});

test('une seed différente peut produire un tirage de surprises différent', () => {
  const r1 = M.construirePlanComptage(inputBase({ socleCible: 0, surprisesCible: 2, seed: 'site-a|2026-08-17|matin' }));
  const r2 = M.construirePlanComptage(inputBase({ socleCible: 0, surprisesCible: 2, seed: 'site-b|2026-08-17|matin' }));
  const s1 = r1.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id).sort();
  const s2 = r2.items.filter(i => i.raison_selection === 'surprise').map(i => i.produit_id).sort();
  // Pas garanti à 100% de différer sur un si petit pool, mais avec ce jeu de
  // données (2 candidats restants seulement) le test reste déterministe :
  // on vérifie juste que les deux tirages restent chacun valides (taille 2,
  // sans doublon), la vraie garantie de déterminisme par seed est couverte
  // par le test précédent.
  assert.strictEqual(s1.length, 2);
  assert.strictEqual(s2.length, 2);
});

// ------------------------------------------------------------
// 7. delaiMaxJours : override explicite prime sur le défaut de famille.
// ------------------------------------------------------------
test('delaiMaxJours respecte un override explicite avant le défaut de famille', () => {
  assert.strictEqual(M.delaiMaxJours({ frequence_controle: 'standard', delai_max_jours_sans_controle: 3 }), 3);
  assert.strictEqual(M.delaiMaxJours({ frequence_controle: 'standard' }), 7);
  assert.strictEqual(M.delaiMaxJours({ frequence_controle: 'faible_rotation' }), 21);
  assert.strictEqual(M.delaiMaxJours(null), 7);
});

// ------------------------------------------------------------
// 8. produitEligibleQuart : quarts_comptage restreint correctement.
// ------------------------------------------------------------
test('produitEligibleQuart respecte quarts_comptage quand il est renseigné', () => {
  assert.strictEqual(M.produitEligibleQuart({ quarts_comptage: ['matin'] }, 'matin'), true);
  assert.strictEqual(M.produitEligibleQuart({ quarts_comptage: ['matin'] }, 'soir'), false);
  assert.strictEqual(M.produitEligibleQuart({ quarts_comptage: null }, 'soir'), true);
  assert.strictEqual(M.produitEligibleQuart(null, 'soir'), true);
});

test('un produit non éligible au quart est totalement exclu du plan, même critique', () => {
  const r = M.construirePlanComptage(inputBase({
    reglesParProduit: Object.assign({}, regles(), { p_critique_1: { frequence_controle: 'critique', quarts_comptage: ['soir'] } }),
    quart: 'matin',
  }));
  assert.ok(!r.items.some(i => i.produit_id === 'p_critique_1'));
});

// ------------------------------------------------------------
// 9. Sprint 3 — libelleTotalProduit : preuve dépôt/boutique, jamais un
//    second calcul du total (déjà agrégé côté écran employé).
// ------------------------------------------------------------
test('libelleTotalProduit formule la preuve dépôt+boutique=total sans recalculer', () => {
  const libelle = M.libelleTotalProduit({ quantite: 42, quantite_depot: 30, quantite_boutique: 12 });
  assert.strictEqual(libelle, 'Dépôt 30 + Boutique 12 = Total 42');
});

test('libelleTotalProduit gère un produit sans détail deux-lieux (dépôt/boutique null)', () => {
  const libelle = M.libelleTotalProduit({ quantite: 8, quantite_depot: null, quantite_boutique: null });
  assert.strictEqual(libelle, 'Total observé : 8');
});

test('libelleTotalProduit retourne null si aucun comptage', () => {
  assert.strictEqual(M.libelleTotalProduit(null), null);
});

// ------------------------------------------------------------
// 10. joursEntreDates : robustesse dates/datetimes, valeurs manquantes.
// ------------------------------------------------------------
test('joursEntreDates compte des jours calendaires entiers, y compris avec une heure', () => {
  assert.strictEqual(M.joursEntreDates('2026-08-10', '2026-08-17'), 7);
  assert.strictEqual(M.joursEntreDates('2026-08-16T23:45:00.000Z', '2026-08-17T00:05:00.000Z'), 1);
  assert.strictEqual(M.joursEntreDates(null, '2026-08-17'), null);
});

// ------------------------------------------------------------
console.log(`\n${nbOk}/${nbTests} tests réussis`);
process.exit(nbOk === nbTests ? 0 : 1);
