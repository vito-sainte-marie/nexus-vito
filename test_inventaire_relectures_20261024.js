// Test — INVENTAIRE-RELECTURES-20261024 : les mêmes ingrédients de la
// sélection ne sont lus qu'une fois par (site, date) pendant une fenêtre
// d'ouverture, jamais partagés entre deux sites ni deux jours, jamais
// conservés hors fenêtre ; « Disponibles » se déplie quand les obligatoires
// du jour sont soldées. Mutations en fin de fichier.
global.window = global;
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const DIR = __dirname;
const lire = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const SRC = { PD: lire('nexus-inventaire-plan-donnees.js'), MD: lire('nexus-inventaire-missions-donnees.js'), ROT: lire('nexus-inventaire-rotation-intelligente.js'), MISSIONS: lire('NEXUS-Missions-v1.html') };
let rouges = 0;
const TABLES_INGREDIENTS = ['inventaire_zone_produit', 'inventaire_regles_produit', 'view_inventaire_dernier_controle_produit', 'inventaire_alertes', 'inventaire_categories', 'inventaire_points_reference'];

function monde(srcPD, srcMD, srcROT, course) {
  const lectures = {}; let missions = []; let serie = 0;
  const compte = (t, site) => { lectures[t] = (lectures[t] || 0) + 1; (lectures['@' + t + '@' + site] = (lectures['@' + t + '@' + site] || 0) + 1); };
  const client = { from(table) {
    let mode = 'select', site = null, valeur = null;
    const q = {
      select() { return q; }, eq(c, v) { if (c === 'site') site = v; return q; }, gte() { return q; }, lt() { return q; },
      in() { return q; }, order() { return q; }, limit() { return q; }, update() { mode = 'update'; return q; },
      insert(v) { mode = 'insert'; valeur = v; return q; },
      maybeSingle() { return Promise.resolve(q._r(true)); },
      then(ok, ko) { return Promise.resolve(q._r(false)).then(ok, ko); },
      _r(unique) {
        if (table === 'inventaire_missions') {
          if (mode === 'insert') {
            if (course) { missions = valeur.map(v => ({ id: 'm' + (++serie), ...v })); return { data: null, error: { message: 'doublon (course)' } }; }
            missions = valeur.map(v => ({ id: 'm' + (++serie), ...v })); return { data: null, error: null };
          }
          if (mode === 'update') { missions = missions.map(m => ({ ...m, statut: 'affectee' })); return { data: null, error: null }; }
          return { data: missions, error: null };
        }
        if (table === 'inventaire_zone_produit') { compte(table, site); return { data: [{ id: 'p-' + site, actif: true, categorie_id: 'c', zone_id: 'z' }], error: null }; }
        if (TABLES_INGREDIENTS.includes(table)) { compte(table, site); return { data: unique ? null : [], error: null }; }
        return { data: unique ? null : [], error: null };
      },
    };
    return q;
  } };
  const sandbox = { console, Promise, Date, Array, Object, Set, Map, Number, String, JSON };
  sandbox.window = sandbox; sandbox.global = sandbox;
  sandbox.NexusInventaireMoteur = {
    construireReglesEffectivesParProduit: () => ({}), appliquerCutoverControles: x => x, agregerAnomaliesParProduit: () => ({}),
    genererMissionsPourContexte: () => [{ momentCode: 'm', missionRuleId: 'r1', nom: 'n', roleAffecte: null, viaRepli: false, statut: 'non_affectee', strategieAppliquee: null, produitIds: [] }],
    resoudreAffectationRegleMission: () => ({ statut: 'affectee', roleAffecte: 'pompiste' }),
    selectionnerPerimetreMission: () => [],
  };
  sandbox.NexusInventaireMissionRulesDonnees = { chargerMissionRules: async () => [{ id: 'r1' }], chargerRolesPresentsQuart: async () => ['pompiste'] };
  vm.createContext(sandbox);
  vm.runInContext(srcPD, sandbox);
  sandbox.NexusInventairePlanDonnees.chargerOuGenererPlan = async () => ({ plan: { id: 'plan' }, items: [] });
  vm.runInContext(srcMD, sandbox);
  if (srcROT) vm.runInContext(srcROT, sandbox);
  return { client, lectures, sandbox, PD: sandbox.NexusInventairePlanDonnees, MD: sandbox.NexusInventaireMissionsDonnees };
}
const lus = (w, t, site) => w.lectures['@' + t + '@' + site] || 0;

async function epreuves(srcPD, srcMD, srcROT, etiquette) {
  const res = [];
  const essai = async (nom, f) => { try { await f(); res.push(['OK', nom]); } catch (e) { res.push(['ROUGE', nom + ' : ' + e.message]); } };

  await essai('T1 compteur : une génération puis une réévaluation lisent UNE fois les ingrédients (fenêtre de la page)', async () => {
    const w = monde(srcPD, srcMD, srcROT);
    w.PD.ouvrirMemoPlan();
    const premiere = await w.MD.genererOuChargerMissions(w.client, 'site-a', '2026-10-24', 'soir');
    assert.strictEqual(premiere[0].statut, 'non_affectee', 'la première génération devait laisser une mission non affectée');
    const seconde = await w.MD.genererOuChargerMissions(w.client, 'site-a', '2026-10-24', 'soir');
    w.PD.fermerMemoPlan();
    assert.strictEqual(seconde[0].statut, 'affectee', 'la réévaluation n\'a pas eu lieu');
    // inventaire_categories : deux requêtes distinctes (colonnes du plan + rotation), chacune une seule fois.
    for (const t of TABLES_INGREDIENTS) { const attendu = t === 'inventaire_categories' ? 2 : 1; assert.strictEqual(lus(w, t, 'site-a'), attendu, t + ' lu ' + lus(w, t, 'site-a') + ' fois, attendu ' + attendu); }
  });
  await essai('T2 course : insertion refusée puis réévaluation DANS le même appel, sans fenêtre de la page : une seule lecture', async () => {
    const w = monde(srcPD, srcMD, srcROT, true);
    const r = await w.MD.genererOuChargerMissions(w.client, 'site-a', '2026-10-24', 'soir');
    assert.strictEqual(r[0].statut, 'affectee', 'la réévaluation n\'a pas eu lieu');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 1, 'ingrédients lus ' + lus(w, 'inventaire_zone_produit', 'site-a') + ' fois dans un seul appel');
    await w.MD.genererOuChargerMissions(w.client, 'site-a', '2026-10-24', 'soir');
    assert.ok(lus(w, 'inventaire_zone_produit', 'site-a') <= 1, 'un appel sans reste non affecté ne relit rien');
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 2, 'la fenêtre de l\'appel doit être refermée (rien servi périmé)');
  });
  await essai('T3 cloisonnement : un autre site ou un autre jour relit', async () => {
    const w = monde(srcPD, srcMD, srcROT);
    w.PD.ouvrirMemoPlan();
    const a = await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    const b = await w.PD.chargerIngredientsSelection(w.client, 'site-b', '2026-10-24');
    const c = await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-25');
    const a2 = await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    w.PD.fermerMemoPlan();
    assert.strictEqual(a.produits[0].id, 'p-site-a'); assert.strictEqual(b.produits[0].id, 'p-site-b', 'contamination entre sites');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 2, 'site-a : 2 lectures (deux dates) attendues');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-b'), 1);
    assert.ok(a === a2 && a !== c, 'partage attendu pour le même (site, date) seulement');
  });
  await essai('T4 hors fenêtre : aucune conservation', async () => {
    const w = monde(srcPD, srcMD, srcROT);
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 2, 'hors fenêtre, chaque appel relit');
    w.PD.ouvrirMemoPlan(); await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24'); w.PD.fermerMemoPlan();
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 4, 'après fermeture, rien n\'est servi périmé');
  });
  await essai('T5 invalidation après une mutation : la lecture suivante est fraîche', async () => {
    const w = monde(srcPD, srcMD, srcROT);
    w.PD.ouvrirMemoPlan();
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    w.PD.invaliderMemoIngredients();
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    w.PD.fermerMemoPlan();
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 2, 'invalidation sans effet');
  });
  await essai('T6 la page qui a ouvert la fenêtre la garde : l\'appel missions ne la ferme pas', async () => {
    const w = monde(srcPD, srcMD, srcROT);
    w.PD.ouvrirMemoPlan();
    await w.MD.genererOuChargerMissions(w.client, 'site-a', '2026-10-24', 'soir');
    await w.PD.chargerIngredientsSelection(w.client, 'site-a', '2026-10-24');
    w.PD.fermerMemoPlan();
    assert.strictEqual(lus(w, 'inventaire_zone_produit', 'site-a'), 1, 'la fenêtre de la page a été fermée par les missions');
  });
  await essai('M1 Missions : « Disponibles » se déplie quand les obligatoires sont soldées, pas s\'il en reste une', async () => {
    const f = srcPD; void f;
    assert.ok(/obligatoiresSoldees\s*=\s*potentielDuJour\.missionsObligatoiresTotal > 0\s*&&\s*potentielDuJour\.missionsObligatoiresFaites >= potentielDuJour\.missionsObligatoiresTotal/.test(SRC.MISSIONS), 'calcul « soldées » absent ou assoupli');
    assert.ok(/\(obligatoires\.length === 0 \|\| obligatoiresSoldees\) && disponiblesListe\.length > 0 && !disponiblesDeplieSeul/.test(SRC.MISSIONS), 'condition de dépliage absente');
    assert.strictEqual((SRC.MISSIONS.match(/blocsListeOuverts\.disponibles = true/g) || []).length, 1, 'un seul endroit déplie d\'office : le repli manuel reste intact');
  });
  return res;
}

function rapporter(res) { res.forEach(([s, m]) => { console.log(s + ' — ' + m); if (s === 'ROUGE') rouges++; }); }

(async () => {
  rapporter(await epreuves(SRC.PD, SRC.MD, SRC.ROT));
  // Mutations : chacune doit faire rougir au moins une épreuve.
  const mutants = [
    ['ingrédients sans mémo', () => [SRC.PD.replace('if (!memoIngredients) return fabrique();', 'return fabrique();'), SRC.MD, SRC.ROT]],
    ['clé sans le site', () => [SRC.PD.replace('`ingredients|${site}|${dateISO}`', '`ingredients|${dateISO}`'), SRC.MD, SRC.ROT]],
    ['clé sans la date', () => [SRC.PD.replace('`ingredients|${site}|${dateISO}`', '`ingredients|${site}`'), SRC.MD, SRC.ROT]],
    ['fenêtre jamais refermée', () => [SRC.PD.replace('function fermerMemoPlan() { memoPlans = null; memoIngredients = null; }', 'function fermerMemoPlan() { memoPlans = null; }'), SRC.MD, SRC.ROT]],
    ['invalidation sans effet', () => [SRC.PD.replace('if (memoIngredients) memoIngredients.clear();', ''), SRC.MD, SRC.ROT]],
    ['missions sans fenêtre propre', () => [SRC.PD, SRC.MD.replace('PD.ouvrirMemoPlanSiAbsent()', 'false'), SRC.ROT]],
    ['missions ferme la fenêtre de la page', () => [SRC.PD, SRC.MD.replace('if (ouverte) PD.fermerMemoPlan();', 'if (PD) PD.fermerMemoPlan();'), SRC.ROT]],
    ['rotation relit les catégories', () => [SRC.PD, SRC.MD, SRC.ROT.replace("typeof PD.partagerDansFenetre === 'function' ? PD.partagerDansFenetre : (c, f) => f()", '(c, f) => f()')]],
  ];
  for (const [nom, fab] of mutants) {
    const [pd, md, rot] = fab();
    assert.ok(pd !== SRC.PD || md !== SRC.MD || rot !== SRC.ROT, 'mutation sans effet : ' + nom);
    const rouge = (await epreuves(pd, md, rot)).some(([s]) => s === 'ROUGE');
    console.log((rouge ? 'OK' : 'ROUGE') + ' — mutation « ' + nom + ' » fait rougir une épreuve');
    if (!rouge) rouges++;
  }
  const mm = SRC.MISSIONS.replace('obligatoiresSoldees = potentielDuJour.missionsObligatoiresTotal > 0', 'obligatoiresSoldees = true || potentielDuJour.missionsObligatoiresTotal > 0');
  const src0 = SRC.MISSIONS; SRC.MISSIONS = mm;
  const rougeM = (await epreuves(SRC.PD, SRC.MD, SRC.ROT)).some(([s]) => s === 'ROUGE');
  SRC.MISSIONS = src0;
  console.log((rougeM ? 'OK' : 'ROUGE') + ' — mutation « soldées toujours vrai » fait rougir une épreuve'); if (!rougeM) rouges++;
  if (rouges) { console.log(rouges + ' rouge(s)'); process.exit(1); }
  console.log('Tout est vert.');
})();
