// Test — decision-4.md (CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906) :
// `maximum_camion_litres` est une CIBLE d'optimisation, jamais un volume
// obligatoire. Couvre les 4 cas de preuve obligatoires portant sur le
// moteur (`nexus-carburant-commande-moteur.js`, `completerVersCamionPlein`
// via `optimiserCommandeMultiCarburant`) + le CTA structuré associé (cas 5).
// Les cas 6/7/8 (régression calendrier/cutoff/fériés, GNR, double
// intégration de livraison) ne sont pas rejoués ici : ce lot ne touche à
// aucune de ces chaînes, et ils restent couverts par la suite existante
// (test_carburant_commande_correction_decision2_20260906.js,
// test_carburant_commande_moteur_v2238.js,
// test_carburant_commande_ancre_jaugeage_v2255.js) — Article 11, jamais un
// second test qui dupliquerait une preuve déjà acquise ailleurs.

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
// Cas de référence commun à 1/2/3/4 : 21 000 L SP95 + 14 000 L GO = 35 000 L
// déjà retenus par le besoin de sécurité (tous deux `etat: 'securite'`, donc
// urgents dès la phase minimum — la phase "camion complet" ne fait
// qu'essayer un complément marginal sur la capacité résiduelle).
// ------------------------------------------------------------
function casReference({ goCapaciteDisponibleL, goConsommationMoyenneJour, goStockPrevuLivraisonL, seuilAutonomieMaxJoursCompletion }) {
  return M.optimiserCommandeMultiCarburant({
    parCarburant: {
      sp95: { etat: 'securite', besoinMinimumSecuriteL: 21000, joursAvantBesoin: 0, consommationMoyenneJour: 3000, stockPrevuLivraisonL: 2000 },
      go: { etat: 'securite', besoinMinimumSecuriteL: 14000, joursAvantBesoin: 0, consommationMoyenneJour: goConsommationMoyenneJour, stockPrevuLivraisonL: goStockPrevuLivraisonL },
    },
    minimumCamionL: 10000,
    maximumCamionL: 36000,
    // sp95 est déjà à sa capacité physique (21 000 L pile) dans les 4 cas :
    // aucune place résiduelle sur ce carburant, le complément ne peut porter
    // que sur le GO — isole la variable testée dans chaque cas.
    capacitesDisponiblesL: { sp95: 21000, go: goCapaciteDisponibleL },
    viserCamionComplet: true,
    seuilAutonomieMaxJoursCompletion,
  });
}

// ------------------------------------------------------------
// 1) +1 000 L GO physiquement sûr ET absorbable par la rotation
//    prévisionnelle (1 000 L/j * 20 j = 20 000 L d'autonomie max ; stock
//    projeté 4 000 L + besoin 14 000 L = 18 000 L, marge encore 2 000 L)
//    -> 21 000 + 15 000 = 36 000 L.
// ------------------------------------------------------------
{
  const optim = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: 1000, goStockPrevuLivraisonL: 4000 });
  assert.strictEqual(optim.decision, 'commander');
  assert.strictEqual(optim.volumesRetenus.go, 15000, `go attendu 15 000 L, obtenu ${optim.volumesRetenus.go}`);
  assert.strictEqual(optim.total, 36000, `total attendu 36 000 L, obtenu ${optim.total}`);
  assert.deepStrictEqual(Array.from(optim.carburantsCompletes), ['go']);
  assert.deepStrictEqual({ ...optim.motifsNonCompletion }, {}, 'aucun motif de non-complétion : la cible est atteinte');

  ok('cas 1 — complément +1 000 L GO sûr et absorbable => 21 000 SP95 + 15 000 GO = 36 000 L');
}

// ------------------------------------------------------------
// 2) +1 000 L GO physiquement IMPOSSIBLE (capacité disponible GO = besoin
//    déjà retenu, aucune place résiduelle, comme SP95) -> reste 35 000 L,
//    motif exact par carburant.
// ------------------------------------------------------------
{
  const optim = casReference({ goCapaciteDisponibleL: 14000, goConsommationMoyenneJour: 1000, goStockPrevuLivraisonL: 4000 });
  assert.strictEqual(optim.total, 35000, `total attendu 35 000 L (capacité), obtenu ${optim.total}`);
  assert.deepStrictEqual(Array.from(optim.carburantsCompletes || []), []);
  assert.strictEqual(optim.motifsNonCompletion.go, 'capacite_insuffisante', 'motif GO : capacité physique insuffisante');
  assert.strictEqual(optim.motifsNonCompletion.sp95, 'capacite_insuffisante', 'motif SP95 : déjà à sa capacité physique');

  ok('cas 2 — complément physiquement impossible => reste 35 000 L, motif capacite_insuffisante');
}

// ------------------------------------------------------------
// 3) +1 000 L GO physiquement POSSIBLE (1 000 L de capacité résiduelle)
//    mais NON absorbable par la rotation prévisionnelle (consommation
//    moyenne très faible : 40 L/j * 20 j = 800 L d'autonomie max, déjà
//    dépassée par le stock projeté + besoin retenu) -> reste 35 000 L,
//    motif anti-surstock explicite, jamais confondu avec la capacité.
// ------------------------------------------------------------
{
  const optim = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: 40, goStockPrevuLivraisonL: 18000 });
  assert.strictEqual(optim.total, 35000, `total attendu 35 000 L (anti-surstock), obtenu ${optim.total}`);
  assert.strictEqual(optim.motifsNonCompletion.go, 'plafond_anti_surstock', 'motif GO : rotation insuffisante pour absorber le complément (garde anti-surstock), pas une question de capacité');

  ok('cas 3 — complément physiquement possible mais non absorbable par la rotation => reste 35 000 L, motif plafond_anti_surstock');
}

// ------------------------------------------------------------
// 4) Données de rotation insuffisantes (consommation moyenne ET/OU stock
//    projeté inconnus pour GO, alors qu'une place physique existe) -> le
//    moteur N'INVENTE PAS d'absorption : reste 35 000 L, motif structuré
//    et explicite distinguant ce cas des deux précédents. Avant ce lot,
//    l'absence de donnée retournait la capacité physique comme plafond
//    (comportement inverse, hérité de la phase minimum où Article 5
//    interdit de bloquer sur une donnée manquante) — ce test verrouille le
//    changement : Article 5 continue de s'appliquer au besoin MINIMUM
//    (cas non retesté ici, cf. bloc 2 de test_carburant_commande_camion_complet_v2245.js),
//    jamais à ce complément OPTIONNEL.
// ------------------------------------------------------------
{
  const sansConsommation = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: undefined, goStockPrevuLivraisonL: 4000 });
  assert.strictEqual(sansConsommation.total, 35000, `sans consommation moyenne connue : total attendu 35 000 L, obtenu ${sansConsommation.total}`);
  assert.strictEqual(sansConsommation.motifsNonCompletion.go, 'donnees_rotation_insuffisantes');

  const sansStockProjete = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: 1000, goStockPrevuLivraisonL: null });
  assert.strictEqual(sansStockProjete.total, 35000, `sans stock projeté connu : total attendu 35 000 L, obtenu ${sansStockProjete.total}`);
  assert.strictEqual(sansStockProjete.motifsNonCompletion.go, 'donnees_rotation_insuffisantes');

  ok('cas 4 — données de rotation insuffisantes => aucune absorption inventée, reste 35 000 L, motif donnees_rotation_insuffisantes explicite');
}

// ------------------------------------------------------------
// 4bis) Garde anti-surstock rendue CONFIGURABLE par site (jamais un
//    plafond arbitraire à 35 000 L, jamais Sainte-Marie codé en dur) — le
//    même scénario que le cas 3 (rotation trop lente pour le seuil par
//    défaut de 20 j) devient absorbable si le site configure un horizon de
//    rotation réellement plus long (45 j -> 40 L/j * 45 j = 1 800 L
//    d'autonomie max, largement au-dessus des 18 000 L déjà engagés + 1 000
//    L de complément = 19 000 L... non : recalcul avec une consommation
//    plus réaliste pour rendre le complément absorbable).
// ------------------------------------------------------------
{
  // 500 L/j : à 20 j (défaut), stock max autorisé = 10 000 L, déjà dépassé
  // par les 14 000 L de besoin déjà retenus (indépendamment du stock projeté
  // actuel) -> non absorbable (comme le cas 3). À 50 j (config explicite du
  // site, cadence de livraison réellement plus longue), stock max autorisé
  // = 25 000 L : 2 000 L déjà en cuve + 14 000 L retenus + 1 000 L de
  // complément = 17 000 L, largement sous le plafond -> absorbable.
  const parDefaut = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: 500, goStockPrevuLivraisonL: 2000 });
  assert.strictEqual(parDefaut.total, 35000, 'seuil par défaut (20 j) : rotation encore jugée insuffisante, reste 35 000 L');
  assert.strictEqual(parDefaut.motifsNonCompletion.go, 'plafond_anti_surstock');

  const configureLarge = casReference({ goCapaciteDisponibleL: 15000, goConsommationMoyenneJour: 500, goStockPrevuLivraisonL: 2000, seuilAutonomieMaxJoursCompletion: 50 });
  assert.strictEqual(configureLarge.total, 36000, `seuil configuré à 50 j pour ce site : complément absorbable, total attendu 36 000 L, obtenu ${configureLarge.total}`);
  assert.deepStrictEqual({ ...configureLarge.motifsNonCompletion }, {});

  ok('cas 4bis — garde anti-surstock configurable par site (seuil_autonomie_max_jours_completion), jamais un plafond arbitraire ni un site codé en dur');
}

// ------------------------------------------------------------
// 5) CTA cohérent — 36 000 L réellement atteignable + créneau commandable
//    + aucun arbitrage restant => `preparer` ; dès qu'un arbitrage de
//    quantité subsiste (cas 3) => `simuler`, motif `arbitrage_quantite`
//    (reprend `construireEvaluationGlobale`/`determinerCtaCommande` déjà
//    éprouvés par decision-2.md — aucun second calcul ici, Article 11).
// ------------------------------------------------------------
{
  const CONFIG = { minimum_camion_litres: 10000, maximum_camion_litres: 36000 };
  const evaluationsParCarburant = (goConsommationMoyenneJour, goStockPrevuLivraisonL, commandableMaintenant) => ({
    sp95: { etat: 'securite', besoinMinimumSecuriteL: 21000, joursAvantBesoin: 0, consommationMoyenneJour: 3000, scenarioMaintenant: { stockPrevuLivraisonL: 2000, commandableMaintenant, motifNonCommandable: commandableMaintenant ? null : 'jour_non_commandable' } },
    go: { etat: 'securite', besoinMinimumSecuriteL: 14000, joursAvantBesoin: 0, consommationMoyenneJour: goConsommationMoyenneJour, scenarioMaintenant: { stockPrevuLivraisonL: goStockPrevuLivraisonL, commandableMaintenant, motifNonCommandable: null } },
  });

  const prete = M.construireEvaluationGlobale({
    evaluationsParCarburant: evaluationsParCarburant(1000, 4000, true),
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 21000, go: 15000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(prete.commandeRecommandee.total, 36000, `commande recommandée attendue 36 000 L, obtenue ${prete.commandeRecommandee.total}`);
  assert.deepStrictEqual({ ...prete.cta }, { action: 'preparer', motif: null }, '36 000 L atteignable + commandable + aucun arbitrage => préparer');

  const arbitrage = M.construireEvaluationGlobale({
    evaluationsParCarburant: evaluationsParCarburant(40, 18000, true),
    config: CONFIG,
    capacitesDisponiblesL: { sp95: 21000, go: 15000 },
    viserCamionComplet: true,
  });
  assert.strictEqual(arbitrage.commandeRecommandee.total, 35000, `commande recommandée attendue 35 000 L (arbitrage), obtenue ${arbitrage.commandeRecommandee.total}`);
  assert.deepStrictEqual({ ...arbitrage.cta }, { action: 'simuler', motif: 'arbitrage_quantite' }, 'arbitrage quantité (rotation insuffisante) => simuler, jamais préparer');

  ok('cas 5 — CTA structuré cohérent : préparer seulement si 36 000 L réellement atteignable et sans arbitrage, sinon simuler');
}

console.log(`\n${n}/${n} tests passés.`);
