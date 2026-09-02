// Test — Sprint 4 "Snapshot complet du plan" (20/08/2026, demande de
// Frédéric : "le périmètre d'un quart d'inventaire doit être figé dès
// l'ouverture [...] même si le manager modifie ensuite les paramètres de
// catégorie [...] le quart déjà commencé ne change pas").
//
// PARTIE 1 — nexus-inventaire-plan-donnees.js::chargerOuGenererPlan écrit
//   bien regle_snapshot (règle effective au moment de la génération) sur
//   chaque inventaire_plan_items, via un mock Supabase minimal.
// PARTIE 2 — NEXUS-Inventaire-v1.html::chargerProduitsZone (extraite du
//   vrai fichier, jamais réécrite à la main) : un produit déjà dans
//   produitsPlanIds n'est plus jamais exclu par jours_rotation ni par
//   quarts_comptage, même si la règle live a changé depuis — il garde le
//   profil figé dans regleSnapshotParProduit.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — écriture de regle_snapshot à la génération du plan
// ------------------------------------------------------------
async function partie1() {
  // Mock Supabase minimal : capture les inserts, répond aux selects utilisés
  // par chargerIngredientsSelection/chargerSurprisesRecentes/chargerPlanExistant.
  const inserted = { plans_comptage: [], plan_items: [] };
  function chainSelect(rows) {
    const obj = {
      eq() { return obj; }, gte() { return obj; }, lt() { return obj; }, in() { return obj; },
      order() { return obj; }, limit() { return obj; },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      single() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return obj;
  }
  const client = {
    from(table) {
      return {
        select(cols) {
          if (table === 'inventaire_plans_comptage') return chainSelect([]); // aucun plan existant -> génération
          if (table === 'inventaire_zone_produit') return chainSelect([{ id: 'p1', actif: true, categorie_id: 'cat1' }]);
          if (table === 'inventaire_regles_produit') return chainSelect([]); // p1 n'a pas de ligne propre
          if (table === 'view_inventaire_dernier_controle_produit') return chainSelect([]);
          if (table === 'inventaire_alertes') return chainSelect([]);
          if (table === 'inventaire_categories') return chainSelect([{ id: 'cat1', regle_active: true, frequence_controle: 'critique', quarts_comptage: null, delai_max_jours_sans_controle: null }]);
          if (table === 'inventaire_plan_items') return chainSelect([{ id: 'item1', plan_id: 'plan1', produit_id: 'p1', regle_snapshot: { origineRegle: 'categorie', frequence_controle: 'critique' } }]);
          return chainSelect([]);
        },
        insert(payload) {
          if (table === 'inventaire_plans_comptage') {
            inserted.plans_comptage.push(payload);
            return { select() { return { maybeSingle() { return Promise.resolve({ data: { id: 'plan1' }, error: null }); } }; } };
          }
          if (table === 'inventaire_plan_items') {
            inserted.plan_items.push(...(Array.isArray(payload) ? payload : [payload]));
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const MOTEUR_PATH = path.join(PROJET, 'nexus-inventaire-moteur.js');
  const PLAN_DONNEES_PATH = path.join(PROJET, 'nexus-inventaire-plan-donnees.js');
  delete require.cache[require.resolve(MOTEUR_PATH)];
  delete require.cache[require.resolve(PLAN_DONNEES_PATH)];
  require(MOTEUR_PATH);
  require(PLAN_DONNEES_PATH);
  const PD = globalThis.NexusInventairePlanDonnees;
  assert.ok(PD, 'NexusInventairePlanDonnees non chargé');

  await testAsync('chargerOuGenererPlan écrit regle_snapshot = règle effective (catégorie active, produit sans ligne propre)', async () => {
    await PD.chargerOuGenererPlan(client, 'site-test', '2026-08-20', '1', {});
    assert.strictEqual(inserted.plan_items.length, 1, 'un seul produit dans le catalogue de test');
    const item = inserted.plan_items[0];
    assert.strictEqual(item.produit_id, 'p1');
    assert.ok(item.regle_snapshot, 'regle_snapshot doit être renseigné (catégorie active)');
    assert.strictEqual(item.regle_snapshot.origineRegle, 'categorie');
    assert.strictEqual(item.regle_snapshot.frequence_controle, 'critique');
  });
}

// ------------------------------------------------------------
// PARTIE 2 — chargerProduitsZone : exemption des produits déjà figés
// ------------------------------------------------------------
async function partie2() {
  const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-v1.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.strictEqual(scripts.length, 1, 'Attendu 1 <script> inline');
  const script = scripts[0];

  function extraireFonction(nomFonction) {
    let debut = script.indexOf(`function ${nomFonction}(`);
    assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
    const prefixe = 'async ';
    if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
    let i = script.indexOf('(', debut);
    let profParen = 1, k = i + 1;
    while (profParen > 0) { if (script[k] === '(') profParen++; else if (script[k] === ')') profParen--; k++; }
    let j = script.indexOf('{', k);
    let profondeur = 1, l = j + 1;
    while (profondeur > 0) { if (script[l] === '{') profondeur++; else if (script[l] === '}') profondeur--; l++; }
    return script.slice(debut, l);
  }

  const moteurSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-moteur.js'), 'utf8');

  function faireMock(produitsZone, reglesProduit) {
    const chain = (rows) => ({
      select() { return chain(rows); },
      eq() { return chain(rows); }, in() { return chain(rows); }, order() { return chain(rows); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    });
    return {
      from(table) {
        if (table === 'inventaire_zone_produit') return chain(produitsZone);
        if (table === 'inventaire_regles_produit') return chain(reglesProduit);
        return chain([]);
      },
    };
  }

  const src = [
    moteurSrc,
    extraireFonction('chargerProduitsZone'),
    `globalThis.__test = {
      run: async (env) => {
        nexusClient = env.nexusClient;
        employeeCourant = env.employeeCourant;
        quartActuel = env.quartActuel;
        produitsPlanIds = env.produitsPlanIds;
        regleSnapshotParProduit = env.regleSnapshotParProduit;
        profilParProduit = env.profilParProduit;
        const liste = await chargerProduitsZone(env.zone);
        return { liste, profilParProduit };
      },
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  const produitCatalogue = (over) => Object.assign({
    id: 'p1', actif: true, comptage_deux_lieux: false,
    inventaire_categories: { nom: 'Viennoiserie', jours_rotation: [1, 2, 3, 4, 5], regle_active: true, quarts_comptage: null, profil: 'production_journaliere' },
    inventaire_zones: { code: 'boutique' },
  }, over || {});

  await testAsync('produit déjà dans le plan figé : jamais exclu par jours_rotation, même si la catégorie a changé de jour', async () => {
    const nexusClient = faireMock([produitCatalogue({ inventaire_categories: { nom: 'Viennoiserie', jours_rotation: [99], regle_active: true } })], []);
    const { liste } = await T.run({
      nexusClient, employeeCourant: { site_id: 'site-test' }, quartActuel: 'matin',
      produitsPlanIds: new Set(['p1']), regleSnapshotParProduit: { p1: { profil: 'production_journaliere' } }, profilParProduit: {}, zone: 'boutique',
    });
    assert.strictEqual(liste.length, 1, 'p1 doit rester visible malgré jours_rotation=[99] (jour impossible aujourd\'hui)');
  });

  await testAsync('produit HORS plan figé : jours_rotation continue de s\'appliquer normalement (comportement historique)', async () => {
    const nexusClient = faireMock([produitCatalogue({ inventaire_categories: { nom: 'Viennoiserie', jours_rotation: [99], regle_active: true } })], []);
    const { liste } = await T.run({
      nexusClient, employeeCourant: { site_id: 'site-test' }, quartActuel: 'matin',
      produitsPlanIds: new Set(), regleSnapshotParProduit: {}, profilParProduit: {}, zone: 'boutique',
    });
    assert.strictEqual(liste.length, 0, 'sans être dans le plan, un produit reste soumis au filtre jours_rotation habituel');
  });

  await testAsync('produit déjà dans le plan figé : garde le profil figé (regleSnapshotParProduit), même si la règle live a changé', async () => {
    const nexusClient = faireMock(
      [produitCatalogue({ inventaire_categories: { nom: 'Bières', jours_rotation: null, regle_active: true, profil: 'continu' } })], // règle LIVE = continu
      []
    );
    const { liste, profilParProduit } = await T.run({
      nexusClient, employeeCourant: { site_id: 'site-test' }, quartActuel: 'soir',
      produitsPlanIds: new Set(['p1']),
      regleSnapshotParProduit: { p1: { profil: 'production_journaliere', quarts_comptage: ['matin'] } }, // règle FIGÉE au moment du plan = production_journaliere, matin seulement
      profilParProduit: {}, zone: 'boutique',
    });
    assert.strictEqual(liste.length, 1, 'reste visible même si la règle figée (matin seulement) exclurait normalement le quart "soir"');
    assert.strictEqual(profilParProduit.p1, 'production_journaliere', 'le profil affiché est celui FIGÉ à la génération, pas le profil live (continu)');
  });

  await testAsync('produit HORS plan figé : le profil vient bien de la règle live (comportement historique)', async () => {
    const nexusClient = faireMock(
      [produitCatalogue({ inventaire_categories: { nom: 'Bières', jours_rotation: null, regle_active: true, profil: 'cycle_journalier' } })],
      []
    );
    const { profilParProduit } = await T.run({
      nexusClient, employeeCourant: { site_id: 'site-test' }, quartActuel: 'matin',
      produitsPlanIds: new Set(), regleSnapshotParProduit: {}, profilParProduit: {}, zone: 'boutique',
    });
    assert.strictEqual(profilParProduit.p1, 'cycle_journalier');
  });
}

(async () => {
  await partie1();
  await partie2();
})();
