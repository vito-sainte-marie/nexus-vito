// Lot 3 (23/10/2026) — Inventaire : le plan du quart n'est lu qu'une fois à l'ouverture
// directe, les lectures indépendantes partent ensemble, sans RPC ; Missions : « Disponibles »
// se déplie seul uniquement sans mission obligatoire.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const I = lire('NEXUS-Inventaire-v1.html');
const M = lire('NEXUS-Missions-v1.html');
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

epreuves(I, M);

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

if (rouges) { console.log(rouges + ' épreuve(s) rouge(s).'); process.exit(1); }
console.log('Tout est vert.');
