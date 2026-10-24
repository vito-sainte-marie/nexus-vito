// Test — INVENTAIRE-RELECTURES-20261024, épreuve demandée par la décision
// de l'arbitre (decision-1.md, ACTION_NEXT) : « le test compteur démontrant
// une seule lecture des ingrédients pour une génération suivie d'une
// réévaluation ».
//
// Scénario mesuré : un premier appel à genererOuChargerMissions (aucune
// mission existante -> génération, un rôle requis absent -> une mission
// reste non_affectee) suivi d'un second appel, pour le même (site, date,
// quart), qui trouve cette mission non_affectee et rappelle
// chargerContexteGeneration (réévaluation) — c'est exactement la duplication
// décrite par request-1.md : chargerIngredientsSelection relue jusqu'à trois
// fois pour la même clé (site, date).
//
// Le compteur porte sur 'inventaire_zone_produit', lu une seule fois par
// chargerIngredientsSelectionSansMemo — jamais ailleurs dans ce parcours —
// donc son compte EST le nombre de lectures réelles des ingrédients.
//
// Preuve avant/après dans le même fichier : SANS fenêtre ouverte
// (ouvrirMemoIngredients jamais appelé), le même scénario lit plusieurs
// fois ; AVEC la fenêtre ouverte, une seule fois. Aucun mock de
// NexusInventairePlanDonnees ni NexusInventaireMissionRulesDonnees ici — ce
// test appelle le vrai code des trois fichiers de données, pas une
// substitution qui masquerait la duplication.

global.window = global;
const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-inventaire-moteur.js'));
require(path.join(DIR, 'nexus-inventaire-mission-rules-donnees.js'));
require(path.join(DIR, 'nexus-inventaire-plan-donnees.js'));
require(path.join(DIR, 'nexus-inventaire-missions-donnees.js'));
const PD = global.NexusInventairePlanDonnees;
const D = global.NexusInventaireMissionsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// Faux client Supabase générique : chaque table est un tableau en mémoire,
// chaque appel .from(table) incrémente son compteur. Les filtres (.eq/.in/
// .gte/.limit) réduisent réellement le jeu de lignes, pour que
// chargerPlanExistant / chargerMissionsExistantes / chargerEmployesPresents-
// ParRole se comportent comme sur la vraie base plutôt que de recevoir tout
// sans distinction.
// ------------------------------------------------------------
function fabriquerClient(tables, compteurs) {
  function enregistrer(table) { compteurs[table] = (compteurs[table] || 0) + 1; }
  return {
    from(table) {
      enregistrer(table);
      let lignes = (tables[table] || []).slice();
      const builder = {
        select() { return builder; },
        eq(col, val) { lignes = lignes.filter(r => r[col] === val); return builder; },
        in(col, vals) { lignes = lignes.filter(r => vals.includes(r[col])); return builder; },
        gte(col, val) { lignes = lignes.filter(r => r[col] >= val); return builder; },
        lt(col, val) { lignes = lignes.filter(r => r[col] < val); return builder; },
        order() { return builder; },
        limit(nb) { lignes = lignes.slice(0, nb); return builder; },
        maybeSingle() { return Promise.resolve({ data: lignes[0] || null, error: null }); },
        insert(rows) {
          const arr = Array.isArray(rows) ? rows : [rows];
          const inserees = arr.map((r, i) => ({ id: `${table}-gen-${(tables[table] || []).length + i}`, ...r }));
          tables[table] = (tables[table] || []).concat(inserees);
          const chain = {
            select() { return chain; },
            maybeSingle() { return Promise.resolve({ data: inserees[0] || null, error: null }); },
            then(resolve, reject) { return Promise.resolve({ data: inserees, error: null }).then(resolve, reject); },
          };
          return chain;
        },
        update(patch) {
          let cible = lignes;
          const chain = {
            eq(col, val) { cible = cible.filter(r => r[col] === val); return chain; },
            then(resolve, reject) {
              cible.forEach(r => Object.assign(r, patch));
              return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        then(resolve, reject) { return Promise.resolve({ data: lignes, error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

function jeuDeDonnees() {
  return {
    // Un seul rôle requis (caissier), jamais présent sur ce quart : la
    // mission générée reste non_affectee, condition nécessaire pour qu'une
    // réévaluation ultérieure ait quelque chose à réévaluer.
    inventaire_mission_rules: [
      { id: 'regle-caissier', site: 'vito-sainte-marie', actif: true, moment_code: 'debut', quart: null, role_code: 'caissier', role_repli: null, categorie_ids: [], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 },
    ],
    inventaire_quarts: [{ id: 'quart-1', site: 'vito-sainte-marie', date: '2026-10-24', quart: 'matin' }],
    inventaire_quart_employes: [{ quart_id: 'quart-1', role: 'pompiste', employee_id: 'emp-1' }],
    inventaire_zone_produit: [],
    inventaire_regles_produit: [],
    view_inventaire_dernier_controle_produit: [],
    inventaire_alertes: [],
    inventaire_categories: [],
    inventaire_points_reference: [],
    inventaire_plans_comptage: [],
    inventaire_plan_items: [],
    inventaire_missions: [],
  };
}

async function jouerGenerationPuisReevaluation(client) {
  const SITE = 'vito-sainte-marie', DATE = '2026-10-24', QUART = 'matin';
  const r1 = await D.genererOuChargerMissions(client, SITE, DATE, QUART);
  assert.strictEqual(r1.length, 1, 'génération : une mission (non affectée, caissier absent)');
  assert.strictEqual(r1[0].statut, 'non_affectee');
  // Second appel, même (site, date, quart) : la mission existe déjà et reste
  // non_affectee -> genererOuChargerMissions va directement à
  // reevaluerMissionsNonAffectees, qui rappelle chargerContexteGeneration.
  const r2 = await D.genererOuChargerMissions(client, SITE, DATE, QUART);
  assert.strictEqual(r2.length, 1, 'réévaluation : toujours une mission, encore non affectée (caissier toujours absent)');
  return { r1, r2 };
}

(async () => {

// ------------------------------------------------------------
// 1) SANS fenêtre ouverte — comportement actuel, aucun cache : la
//    duplication décrite par request-1.md doit être mesurable.
// ------------------------------------------------------------
{
  const compteurs = {};
  const client = fabriquerClient(jeuDeDonnees(), compteurs);
  await jouerGenerationPuisReevaluation(client);
  assert.ok(compteurs.inventaire_zone_produit > 1,
    `sans mémo, chargerIngredientsSelection doit être relue plusieurs fois (mesuré : ${compteurs.inventaire_zone_produit})`);
  ok(`sans fenêtre ouverte — ${compteurs.inventaire_zone_produit} lectures d'ingrédients pour une génération suivie d'une réévaluation (duplication confirmée, pas corrigée hors fenêtre)`);
}

// ------------------------------------------------------------
// 2) AVEC la fenêtre ouverte (ouvrirMemoIngredients) — une seule lecture
//    réelle doit couvrir la génération ET la réévaluation qui suit, pour la
//    même clé (site, date).
// ------------------------------------------------------------
{
  const compteurs = {};
  const client = fabriquerClient(jeuDeDonnees(), compteurs);
  PD.ouvrirMemoIngredients();
  try {
    await jouerGenerationPuisReevaluation(client);
  } finally {
    PD.fermerMemoIngredients();
  }
  assert.strictEqual(compteurs.inventaire_zone_produit, 1,
    `avec la fenêtre ouverte, une seule lecture d'ingrédients doit couvrir génération + réévaluation (mesuré : ${compteurs.inventaire_zone_produit})`);
  ok('avec fenêtre ouverte (ouvrirMemoIngredients/fermerMemoIngredients) — une seule lecture des ingrédients pour une génération suivie d\'une réévaluation');
}

// ------------------------------------------------------------
// 3) Cloisonnement par (site, date) — un autre site ou une autre date ne
//    doit jamais partager le cache ni être privé de sa propre lecture.
// ------------------------------------------------------------
{
  const compteurs = {};
  const tables = jeuDeDonnees();
  // Même règle, même présence, mais déclarées pour un second site —
  // getEmployesPresentsParRole/chargerMissionRules filtrent déjà par site
  // réel ; on ajoute ici simplement une seconde ligne de quart/présence pour
  // que le second site ait, lui aussi, son quart.
  tables.inventaire_quarts.push({ id: 'quart-2', site: 'autre-site', date: '2026-10-24', quart: 'matin' });
  tables.inventaire_quart_employes.push({ quart_id: 'quart-2', role: 'pompiste', employee_id: 'emp-2' });
  tables.inventaire_mission_rules.push({ id: 'regle-caissier-autre', site: 'autre-site', actif: true, moment_code: 'debut', quart: null, role_code: 'caissier', role_repli: null, categorie_ids: [], zone_ids: null, mode_selection: 'complet', ordre_affichage: 10 });
  const client = fabriquerClient(tables, compteurs);
  PD.ouvrirMemoIngredients();
  try {
    await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-10-24', 'matin');
    await D.genererOuChargerMissions(client, 'autre-site', '2026-10-24', 'matin');
  } finally {
    PD.fermerMemoIngredients();
  }
  assert.strictEqual(compteurs.inventaire_zone_produit, 2,
    `deux sites distincts -> deux lectures distinctes, jamais partagées par erreur (mesuré : ${compteurs.inventaire_zone_produit})`);
  ok('cloisonnement (site, date) — deux sites différents ne partagent jamais la même lecture mémoïsée');
}

// ------------------------------------------------------------
// 4) Hors fenêtre après fermeture — fermerMemoIngredients retire bien le
//    cache ; un appel ultérieur relit réellement (pas de fuite de la fenêtre
//    précédente).
// ------------------------------------------------------------
{
  const compteurs = {};
  const client = fabriquerClient(jeuDeDonnees(), compteurs);
  PD.ouvrirMemoIngredients();
  await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-10-24', 'matin');
  PD.fermerMemoIngredients();
  await D.genererOuChargerMissions(client, 'vito-sainte-marie', '2026-10-24', 'matin');
  assert.strictEqual(compteurs.inventaire_zone_produit, 2,
    `fenêtre fermée -> plus de cache du tout, chaque appel relit (mesuré : ${compteurs.inventaire_zone_produit})`);
  ok('fermerMemoIngredients — ferme réellement le cache, aucune fuite vers les appels suivants');
}

console.log(`\n${n} tests passés.`);

})();
