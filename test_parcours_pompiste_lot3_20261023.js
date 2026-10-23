// Lot 3 (23/10/2026) — Inventaire : le plan du quart n'est lu qu'une fois à l'ouverture
// directe, les lectures indépendantes partent ensemble, sans RPC ; Missions : « Disponibles »
// se déplie seul uniquement sans mission obligatoire.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const I = lire('NEXUS-Inventaire-v1.html');
const M = lire('NEXUS-Missions-v1.html');
const PD = lire('nexus-inventaire-plan-donnees.js');
const vm = require('vm');
let rouges = 0;
function eprouve(nom, fn) { try { fn(); console.log('OK — ' + nom); } catch (e) { rouges++; console.log('ROUGE — ' + nom + ' : ' + e.message); } }
function bloc(src, debut, fin) { const a = src.indexOf(debut); assert.ok(a !== -1, 'introuvable : ' + debut); const b = src.indexOf(fin, a + 1); return src.slice(a, b === -1 ? a + 4000 : b); }

function epreuves(I, M) {
  eprouve('L1 le plan et les réglages sont lus dans une seule fonction, mémoïsée par site|date|quart', () => {
    assert.strictEqual((I.match(/P\.chargerOuGenererPlan\(/g) || []).length, 1, 'le plan doit n\'avoir qu\'un seul point de lecture');
    const f = bloc(I, 'async function chargerEtAppliquerPlanQuart', 'async function ');
    assert.ok(/memoPlanInit/.test(f) && /\$\{site\}\|\$\{dateISO\(\)\}\|\$\{quartActuel\}/.test(f), 'mémo absent ou clé sans quart');
    assert.ok(/memo\.get\(cle\)/.test(f) && /memo\.set\(cle, chargement\)/.test(f), 'le mémo n\'est ni lu ni alimenté');
    assert.ok(/lirePlanEtReglagesDuQuart\(P, site, quartActuel\)/.test(f), 'lecture non déléguée');
  });
  eprouve('L2 l\'init arme le mémo avant la première lecture et le désarme juste après le démarrage', () => {
    const init = I.slice(I.indexOf('const roleEnCours'));
    const arme = init.indexOf('memoPlanInit = new Map()'), lit = init.indexOf('chargerEtAppliquerPlanQuart()'), demarre = init.indexOf('demarrerOuvertureComptage()'), desarme = init.indexOf('memoPlanInit = null;', demarre);
    assert.ok(arme !== -1 && arme < lit && lit < demarre && demarre < desarme, 'ordre armer < lire < démarrer < désarmer non respecté');
  });
  eprouve('L3 zones, chaîne quart→quart-employé→missions et plan partent ensemble ; rôle du jour lu pendant le fuseau', () => {
    assert.ok(/Promise\.all\(\[lectureZones, lectureQuart, chargerEtAppliquerPlanQuart\(\)\]\)/.test(I), 'init non parallélisée');
    assert.ok(/const roleEnCours = employee\.mode_test_inventaire \? null : chargerRoleDuJour\(\);[\s\S]*?await NexusStation\.fuseauDeLaStation/.test(I), 'rôle du jour non lancé avant le fuseau');
    const chaine = bloc(I, 'const lectureQuart = (async () => {', '})();');
    assert.ok(chaine.indexOf('obtenirOuCreerQuart()') < chaine.indexOf('obtenirOuCreerQuartEmploye()') && chaine.indexOf('obtenirOuCreerQuartEmploye()') < chaine.indexOf('chargerMissionsDuJour()'), 'ordre de la chaîne dépendante rompu');
  });
  eprouve('L4 le démarrage lit produits, modes et jaugeage ensemble, derniers stocks après (dépend des ids)', () => {
    const d = bloc(I, 'async function demarrerOuvertureComptage', 'chargerDerniersStocks(ids)');
    assert.ok(/Promise\.all\(\[\s*chargerEtAppliquerPlanQuart\(\),\s*chargerProduitsZone\(zoneActive\),\s*chargerModesAveugle\(\),\s*chargerModeJaugeageActif\(\),\s*\]\)/.test(d), 'lectures indépendantes non groupées');
    assert.ok(/produitsZone = restreindreAuPlanQuart\(produitsBruts\)/.test(d), 'produits non restreints au plan : identité des produits attendus changée');
  });
  eprouve('L5 aucun appel RPC ajouté dans ces chemins', () => {
    const f = bloc(I, 'let memoPlanInit', 'async function chargerEtAppliquerPlanQuart') + bloc(I, 'const roleEnCours', 'En test Renfort');
    assert.ok(!/\.rpc\(/.test(f), 'RPC interdit par la décision');
  });
  eprouve('M1 Missions : « Disponibles » se déplie seul seulement sans obligatoire, une seule fois', () => {
    assert.ok(/if \(obligatoires\.length === 0 && disponiblesListe\.length > 0 && !disponiblesDeplieSeul\) \{\s*disponiblesDeplieSeul = true;\s*blocsListeOuverts\.disponibles = true;/.test(M), 'dépliage conditionnel absent');
    assert.ok(/let blocsListeOuverts = \{ obligatoires: true, disponibles: false,/.test(M), 'état initial replié modifié : comportement existant à conserver avec des obligatoires');
    assert.strictEqual((M.match(/blocsListeOuverts\.disponibles = true/g) || []).length, 1, 'un seul endroit déplie d\'office');
  });
}


// Chemin précis demandé par la mesure « première ouverture » : plan absent, puis généré,
// puis un seul chargement — que le second demandeur soit la page ou la voie missions.
async function epreuvePlanAbsentGenere(srcPD) {
  const lectures = { plans: 0, items: 0, inserts: 0 };
  let planRow = null; let itemsRows = [];
  const constructeur = (table) => {
    let mode = 'select';
    const q = {
      select() { return q; }, eq() { return q; }, gte() { return q; }, lt() { return q; }, in() { return q; },
      order() { return q; }, limit() { return q; },
      insert(v) { mode = 'insert'; q._v = v; return q; },
      maybeSingle() { return Promise.resolve(q._resultat(true)); },
      then(ok, ko) { return Promise.resolve(q._resultat(false)).then(ok, ko); },
      _resultat(unique) {
        if (table === 'inventaire_plans_comptage') {
          if (mode === 'insert') { if (planRow) return { data: null, error: { code: '23505' } }; lectures.inserts++; planRow = { id: 'plan-1', ...q._v }; return { data: planRow, error: null }; }
          lectures.plans++; return { data: planRow, error: null };
        }
        if (table === 'inventaire_plan_items') {
          if (mode === 'insert') { itemsRows = q._v.map((v, i) => ({ id: 'it' + i, ...v })); return { data: null, error: null }; }
          lectures.items++; return { data: itemsRows, error: null };
        }
        return { data: unique ? null : [], error: null };
      },
    };
    return q;
  };
  const client = { from: constructeur };
  const sandbox = { console, Promise, Date, Array, Object, Set, Map, Number, String, JSON };
  sandbox.window = sandbox; sandbox.global = sandbox;
  sandbox.NexusInventaireMoteur = {
    construireReglesEffectivesParProduit: () => ({}), appliquerCutoverControles: x => x, agregerAnomaliesParProduit: () => ({}),
    construirePlanComptage: () => ({ items: [{ produit_id: 'p1', raison_selection: 'socle', obligatoire: true, ordre: 0 }] }),
  };
  vm.createContext(sandbox);
  vm.runInContext(srcPD, sandbox);
  const P = sandbox.NexusInventairePlanDonnees;
  P.ouvrirMemoPlan();
  const page = P.chargerOuGenererPlan(client, 'site', '2026-10-23', 'matin', { socleCible: 6 });
  await Promise.resolve();
  const missions = P.chargerOuGenererPlan(client, 'site', '2026-10-23', 'matin');
  const [a, b] = await Promise.all([page, missions]);
  const tardif = await P.chargerOuGenererPlan(client, 'site', '2026-10-23', 'matin'); // missions arrivant après la fin de la page
  P.fermerMemoPlan();
  assert.strictEqual(lectures.inserts, 1, 'le plan doit être généré une seule fois');
  assert.strictEqual(lectures.items, 1, 'les items du plan doivent être chargés une seule fois (lus : ' + lectures.items + ')');
  // 3 = recherche + plans récents (surprises) + relecture après insertion, pour UN chargement ;
  // sans mémo les deux demandeurs font 3 chacun, soit les 6 lectures mesurées avant correctif.
  assert.strictEqual(lectures.plans, 3, 'un seul jeu de 3 lectures de plans attendu (lus : ' + lectures.plans + ')');
  assert.ok(a === b && a === tardif && a.items.length === 1 && a.items[0].produit_id === 'p1', 'tous les demandeurs doivent recevoir le même plan généré');
  await P.chargerOuGenererPlan(client, 'site', '2026-10-23', 'matin');
  assert.strictEqual(lectures.items, 2, 'hors fenêtre, un plan existant doit être relu (aucun cache durable)');
}

epreuves(I, M);
eprouve('L6 la page ouvre la fenêtre de mémo avant la première lecture et la ferme (aussi en sortie anticipée)', () => {
  const init = I.slice(I.indexOf('const roleEnCours'));
  const ouvre = init.indexOf('NexusInventairePlanDonnees.ouvrirMemoPlan()'), lit = init.indexOf('chargerEtAppliquerPlanQuart()');
  assert.ok(ouvre !== -1 && ouvre < lit, 'fenêtre non ouverte avant la lecture');
  assert.ok((I.match(/fermerMemoPlanInit\(\);/g) || []).length === 2, 'fermeture attendue en sortie normale et anticipée');
});

// Mutations : l'épreuve doit rougir si on retire le correctif.
function mutant(nom, src, re, rempl, cible) {
  const avant = rouges; const garde = rouges;
  const sortie = console.log; const lignes = [];
  console.log = l => lignes.push(l);
  const Im = cible === 'I' ? src.replace(re, rempl) : I, Mm = cible === 'M' ? src.replace(re, rempl) : M;
  assert.ok((cible === 'I' ? Im !== I : Mm !== M), 'mutation sans effet : ' + nom);
  epreuves(Im, Mm);
  console.log = sortie;
  const rougi = lignes.some(l => l.startsWith('ROUGE'));
  rouges = garde;
  console.log((rougi ? 'OK' : 'ROUGE') + ' — mutation « ' + nom + ' » fait rougir une épreuve');
  if (!rougi) rouges++;
}
mutant('plan relu sans mémo', I, /if \(memo\) memo\.set\(cle, chargement\);/, '', 'I');
mutant('init séquentielle', I, /Promise\.all\(\[lectureZones, lectureQuart, chargerEtAppliquerPlanQuart\(\)\]\)/, 'Promise.all([lectureZones, lectureQuart])', 'I');
mutant('RPC ajouté', I, /async function lirePlanEtReglagesDuQuart\(P, site, quart\) \{/, 'async function lirePlanEtReglagesDuQuart(P, site, quart) { nexusClient.rpc("x");', 'I');
mutant('Disponibles déplié même avec obligatoires', M, /obligatoires\.length === 0 && /, '', 'M');

(async () => {
  try { await epreuvePlanAbsentGenere(PD); console.log('OK — P1 plan absent → généré → un seul chargement, partagé page + missions'); }
  catch (e) { rouges++; console.log('ROUGE — P1 plan absent → généré → un seul chargement : ' + e.message); }
  try { await epreuvePlanAbsentGenere(PD.replace('if (!memoPlans) return', 'if (true) return')); rouges++; console.log('ROUGE — mutation « sans mémo partagé » ne fait rien rougir'); }
  catch (e) { console.log('OK — mutation « sans mémo partagé » fait rougir P1 (' + e.message.slice(0, 60) + ')'); }
  mutantL6();
  if (rouges) { console.log(rouges + ' épreuve(s) rouge(s).'); process.exit(1); }
  console.log('Tout est vert.');
})();
function mutantL6() {
  const sortie = console.log; const lignes = []; console.log = l => lignes.push(l);
  const Im = I.replace('NexusInventairePlanDonnees.ouvrirMemoPlan()', 'void 0');
  const g = rouges;
  eprouve('L6 (mutant)', () => { const init = Im.slice(Im.indexOf('const roleEnCours')); assert.ok(init.indexOf('NexusInventairePlanDonnees.ouvrirMemoPlan()') !== -1, 'absent'); });
  console.log = sortie; const rougi = lignes.some(l => l.startsWith('ROUGE')); rouges = g;
  console.log((rougi ? 'OK' : 'ROUGE') + ' — mutation « fenêtre jamais ouverte » fait rougir L6'); if (!rougi) rouges++;
}
