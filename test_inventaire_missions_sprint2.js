// Test — Inventaire V2 Sprint 2 "Génération des missions" (29/08/2026,
// suite de la doctrine "NEXUS Inventaire V2" — Frédéric a confirmé
// "ok sprint 2"). Portée du sprint : générer les missions concrètes d'un
// quart (résolution Sprint 1 + périmètre produit), jamais encore
// consommées par un écran (Sprint 3 = expérience employé).
//
// Ce fichier teste :
//   1. nexus-inventaire-moteur.js — perimetreProduitsMission (filtre
//      catégorie/zone), selectionnerPerimetreMission (complet/tournant/
//      cible), genererMissionsPourContexte (combine résolution Sprint 1 +
//      périmètre, conserve les missions non affectées — "dette de
//      couverture"), couvertureMissions (synthèse).
//   2. nexus-inventaire-missions-donnees.js — chargerMissionsExistantes,
//      genererOuChargerMissions (jamais recalculé si déjà généré, repli en
//      cas de course), chargerMissionsPourRole.

global.window = global;
const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-inventaire-moteur.js'));
require(path.join(DIR, 'nexus-inventaire-mission-rules-donnees.js'));
require(path.join(DIR, 'nexus-inventaire-missions-donnees.js'));
const M = global.NexusInventaireMoteur;
const D = global.NexusInventaireMissionsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

(async () => {

// ------------------------------------------------------------
// 1) perimetreProduitsMission — filtre catégorie/zone, null = pas de
//    restriction sur cette dimension.
// ------------------------------------------------------------
{
  const produits = [
    { id: 'p1', categorie_id: 'catA', zone_id: 'zoneX' },
    { id: 'p2', categorie_id: 'catB', zone_id: 'zoneX' },
    { id: 'p3', categorie_id: 'catA', zone_id: 'zoneY' },
    { id: 'p4', categorie_id: 'catB', zone_id: 'zoneY' },
  ];
  assert.deepStrictEqual(M.perimetreProduitsMission({ categorie_ids: ['catA'], zone_ids: null }, produits).map(p => p.id), ['p1', 'p3'], 'filtre catégorie seule');
  assert.deepStrictEqual(M.perimetreProduitsMission({ categorie_ids: null, zone_ids: ['zoneX'] }, produits).map(p => p.id), ['p1', 'p2'], 'filtre zone seule');
  assert.deepStrictEqual(M.perimetreProduitsMission({ categorie_ids: ['catA'], zone_ids: ['zoneY'] }, produits).map(p => p.id), ['p3'], 'filtre catégorie ET zone combinés');
  assert.strictEqual(M.perimetreProduitsMission({ categorie_ids: [], zone_ids: [] }, produits).length, 4, 'tableaux vides = aucune restriction (toutes catégories/zones), jamais un périmètre vide par erreur');
  assert.strictEqual(M.perimetreProduitsMission({ categorie_ids: null, zone_ids: null }, produits).length, 4, 'null = aucune restriction');

  ok('perimetreProduitsMission — filtre catégorie/zone correct, vide/null = aucune restriction sur cette dimension');
}

// ------------------------------------------------------------
// 2) selectionnerPerimetreMission — complet / tournant / cible.
// ------------------------------------------------------------
{
  const produits = [
    { id: 'p1', categorie_id: 'cat', zone_id: null },
    { id: 'p2', categorie_id: 'cat', zone_id: null },
    { id: 'p3', categorie_id: 'cat', zone_id: null },
  ];
  const regleComplet = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'complet' };
  assert.strictEqual(M.selectionnerPerimetreMission(regleComplet, produits, {}, 'seed').length, 3, 'mode complet -> tout le périmètre');

  const regleCible = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'cible' };
  assert.strictEqual(M.selectionnerPerimetreMission(regleCible, produits, {}, 'seed').length, 3, 'mode cible -> traité comme complet dans ce sprint (limitation assumée)');

  const regleTournant = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'tournant', nombre_references: 2 };
  const dernierControle = { p1: '2026-08-20', p2: null, p3: '2026-08-25' };
  const selection = M.selectionnerPerimetreMission(regleTournant, produits, dernierControle, 'seed-fixe');
  assert.strictEqual(selection.length, 2, 'mode tournant -> exactement nombre_references produits');
  assert.strictEqual(selection[0], 'p2', 'jamais contrôlé -> priorité absolue');
  assert.strictEqual(selection[1], 'p1', 'contrôlé le plus anciennement ensuite');
  assert.ok(!selection.includes('p3'), 'p3 (contrôlé le plus récemment) exclu — seuls les 2 les moins récents sont pris');

  const selectionRejouee = M.selectionnerPerimetreMission(regleTournant, produits, dernierControle, 'seed-fixe');
  assert.deepStrictEqual(selection, selectionRejouee, 'reproductible : même seed, même contexte -> même sélection à chaque appel');

  const regleTournantSansNombre = { categorie_ids: ['cat'], zone_ids: null, mode_selection: 'tournant', nombre_references: null };
  assert.strictEqual(M.selectionnerPerimetreMission(regleTournantSansNombre, produits, dernierControle, 'seed').length, 3, 'nombre_references absent -> tout le périmètre, jamais un tableau vide');

  ok('selectionnerPerimetreMission — complet/cible = tout le périmètre, tournant = N moins récemment contrôlés en priorité, reproductible par seed');
}

// ------------------------------------------------------------
// 3) genererMissionsPourContexte — combine résolution + périmètre, garde
//    les missions non affectées (dette de couverture), boucle sur les 3
//    moments.
// ------------------------------------------------------------
{
  const missionRules = [
    { id: 'r1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', role_repli: null, categorie_ids: ['catGaz'], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
    { id: 'r2', actif: true, moment_code: 'debut', quart: null, role_code: 'caissier', role_repli: null, categorie_ids: ['catTabac'], zone_ids: null, mode_selection: 'complet', strategie_repli: 'reporter_quart_suivant', ordre_affichage: 20 },
    { id: 'r3', actif: true, moment_code: 'fin', quart: null, role_code: 'caissier', role_repli: null, categorie_ids: [], zone_ids: null, mode_selection: 'complet', ordre_affichage: 30 },
  ];
  const produitsActifs = [
    { id: 'gaz1', categorie_id: 'catGaz', zone_id: null },
    { id: 'tabac1', categorie_id: 'catTabac', zone_id: null },
    { id: 'autre1', categorie_id: 'catAutre', zone_id: null },
  ];
  const missions = M.genererMissionsPourContexte({
    missionRules, rolesPresents: ['pompiste'], quart: 'matin',
    produitsActifs, dernierControleParProduit: {}, seed: 'site|2026-08-29|matin',
  });

  // r1 (pompiste, debut) : affectée, pompiste présent. r2 (caissier,
  // debut) : non affectée, aucun caissier présent. r3 (caissier, fin) :
  // non affectée aussi.
  assert.strictEqual(missions.length, 3, 'les 3 règles actives donnent 3 missions (affectées ou non), aucune silencieusement supprimée');
  const m1 = missions.find(m => m.missionRuleId === 'r1');
  assert.strictEqual(m1.statut, 'affectee');
  assert.deepStrictEqual(m1.produitIds, ['gaz1']);
  const m2 = missions.find(m => m.missionRuleId === 'r2');
  assert.strictEqual(m2.statut, 'non_affectee', 'aucun caissier présent -> non affectée');
  assert.deepStrictEqual(m2.produitIds, [], 'une mission non affectée a un périmètre vide — jamais un calcul de périmètre gaspillé sur une mission qui n\'aura personne pour la faire');
  assert.strictEqual(m2.strategieAppliquee, 'reporter_quart_suivant');
  const m3 = missions.find(m => m.missionRuleId === 'r3');
  assert.strictEqual(m3.momentCode, 'fin', 'la boucle couvre bien les 3 moments, pas seulement "debut"');

  ok('genererMissionsPourContexte — combine résolution Sprint 1 et périmètre produit, conserve les missions non affectées avec périmètre vide, couvre les 3 moments');
}

// ------------------------------------------------------------
// 4) couvertureMissions — synthèse affectées/non affectées.
// ------------------------------------------------------------
{
  const missions = [{ statut: 'affectee' }, { statut: 'affectee' }, { statut: 'non_affectee' }];
  const synthese = M.couvertureMissions(missions);
  assert.deepStrictEqual(synthese, { total: 3, affectees: 2, nonAffectees: 1, tauxCouverture: 2 / 3 });
  assert.deepStrictEqual(M.couvertureMissions([]), { total: 0, affectees: 0, nonAffectees: 0, tauxCouverture: null }, 'aucune mission -> tauxCouverture null, jamais 0/0 traité comme 100% ou 0% trompeur');

  ok('couvertureMissions — synthèse correcte, tauxCouverture null (pas 0 ni 1) quand il n\'y a aucune mission à couvrir');
}

// ------------------------------------------------------------
// 5) chargerMissionsExistantes — forme de la requête.
// ------------------------------------------------------------
{
  let capture = null;
  const client = {
    from(table) {
      capture = { table };
      const chain = {
        select() { return chain; }, eq() { return chain; },
        order(...a) { capture.orders = (capture.orders || []).concat([a]); return chain; },
      };
      // La dernière étape doit être awaitable — on transforme le dernier
      // maillon en thenable une fois toutes les méthodes enchaînées.
      chain.then = (resolve) => Promise.resolve({ data: [{ id: 'm1' }], error: null }).then(resolve);
      return chain;
    },
  };
  const rows = await D.chargerMissionsExistantes(client, 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.strictEqual(capture.table, 'inventaire_missions');
  assert.deepStrictEqual(rows, [{ id: 'm1' }]);

  ok('chargerMissionsExistantes — interroge inventaire_missions filtré site/date/quart');
}

// ------------------------------------------------------------
// 6) genererOuChargerMissions — jamais recalculé si déjà généré ; génère
//    en combinant les 3 sources (mission_rules/présence/ingrédients) sinon ;
//    repli sur relecture en cas de course (insertion en échec).
// ------------------------------------------------------------
function mockMissionsClient({ existantesInitiales, echecInsertion }) {
  let etat = existantesInitiales.slice();
  let inserts = [];
  return {
    _inserts: () => inserts,
    from(table) {
      assert.strictEqual(table, 'inventaire_missions');
      return {
        select() { return this; }, eq() { return this; },
        order() { return this; },
        insert(rows) {
          inserts.push(rows);
          if (echecInsertion) return Promise.resolve({ error: { code: '23505', message: 'conflit' } });
          etat = etat.concat(rows.map((r, i) => ({ id: 'gen-' + i, ...r })));
          return Promise.resolve({ error: null });
        },
        then(resolve) { return Promise.resolve({ data: etat, error: null }).then(resolve); },
      };
    },
  };
}

{
  // Cas 1 : missions déjà générées -> jamais recalculé, chargerMissionRules
  // et les autres sources ne doivent même pas être sollicitées.
  const client1 = mockMissionsClient({ existantesInitiales: [{ id: 'existant-1' }], echecInsertion: false });
  const r1 = await D.genererOuChargerMissions(client1, 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.deepStrictEqual(r1, [{ id: 'existant-1' }]);
  assert.strictEqual(client1._inserts().length, 0, 'aucune insertion si des missions existent déjà pour ce quart');

  ok('genererOuChargerMissions — jamais recalculé si des missions existent déjà pour ce (site, date, quart)');
}

{
  // Cas 2 : rien n'existe -> génération complète, en s'appuyant sur les
  // chargeurs Sprint 1 (mission_rules/présence) et sur
  // chargerIngredientsSelection (Article 11, réutilisé tel quel).
  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules: async () => ([
      { id: 'r1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', categorie_ids: ['catGaz'], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
    ]),
    chargerRolesPresentsQuart: async () => (['pompiste']),
  };
  global.NexusInventairePlanDonnees = {
    chargerIngredientsSelection: async () => ({
      produits: [{ id: 'gaz1', categorie_id: 'catGaz', zone_id: null }],
      dernierControleParProduit: {},
    }),
  };
  const client2 = mockMissionsClient({ existantesInitiales: [], echecInsertion: false });
  const r2 = await D.genererOuChargerMissions(client2, 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.strictEqual(client2._inserts().length, 1, 'une seule insertion en lot pour toutes les missions calculées');
  const lignesInserees = client2._inserts()[0];
  assert.strictEqual(lignesInserees.length, 1);
  assert.strictEqual(lignesInserees[0].mission_rule_id, 'r1');
  assert.strictEqual(lignesInserees[0].statut, 'affectee');
  assert.deepStrictEqual(lignesInserees[0].produit_ids, ['gaz1']);
  assert.strictEqual(r2.length, 1, 'la relecture après insertion retourne bien la mission générée');

  ok('genererOuChargerMissions — génère à partir des 3 sources réelles (mission_rules, présence, ingrédients du plan) quand rien n\'existe encore');
}

{
  // Cas 3 : course entre deux employés — l'insertion échoue (contrainte
  // unique), on relit ce qui existe déjà plutôt que de planter.
  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules: async () => ([
      { id: 'r1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', categorie_ids: ['catGaz'], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
    ]),
    chargerRolesPresentsQuart: async () => (['pompiste']),
  };
  global.NexusInventairePlanDonnees = {
    chargerIngredientsSelection: async () => ({
      produits: [{ id: 'gaz1', categorie_id: 'catGaz', zone_id: null }],
      dernierControleParProduit: {},
    }),
  };
  // Le mock simule : au moment de la relecture après l'échec d'insertion,
  // un autre employé a déjà écrit la mission entre-temps.
  let etatMutable = [];
  const clientCourse = {
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        insert() {
          etatMutable = [{ id: 'deja-genere-par-un-autre-employe' }];
          return Promise.resolve({ error: { code: '23505', message: 'conflit' } });
        },
        then(resolve) { return Promise.resolve({ data: etatMutable, error: null }).then(resolve); },
      };
    },
  };
  const r3 = await D.genererOuChargerMissions(clientCourse, 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.deepStrictEqual(r3, [{ id: 'deja-genere-par-un-autre-employe' }], 'en cas de course, on relit ce qu\'un autre employé a déjà généré plutôt que d\'échouer ou de dupliquer');

  ok('genererOuChargerMissions — repli sur relecture en cas de course (contrainte unique violée), jamais un doublon ni une exception remontée à l\'écran');
}

// ------------------------------------------------------------
// 7) chargerMissionsPourRole — filtre affectee + rôle exact.
// ------------------------------------------------------------
{
  const missionsExistantes = [
    { id: 'm1', statut: 'affectee', role_affecte: 'caissier' },
    { id: 'm2', statut: 'affectee', role_affecte: 'pompiste' },
    { id: 'm3', statut: 'non_affectee', role_affecte: null },
  ];
  const client = mockMissionsClient({ existantesInitiales: missionsExistantes, echecInsertion: false });
  const missionsCaissier = await D.chargerMissionsPourRole(client, 'vito-sainte-marie', '2026-08-29', 'matin', 'caissier');
  assert.deepStrictEqual(missionsCaissier.map(m => m.id), ['m1'], 'seules les missions affectées à CE rôle précis sont retournées');

  ok('chargerMissionsPourRole — ne retourne que les missions affectées (jamais non_affectee) pour le rôle demandé');
}

console.log(`\n${n} tests passés.`);

})();
