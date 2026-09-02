// Test — Cycle "NEXUS observe avant de conclure" (30/08/2026, Frédéric —
// "ok passe au cycle", point 14 de son audit du 30/08/2026).
// Couvre : moteur pur (qualifierObservationEcart / certifierAlerte /
// regulariserAlerte), le branchement des filtres statut côté données
// (plan de comptage + manager + Cockpit), et le rendu manager
// (renderBlocCycleObservation extrait de NEXUS-Inventaire-Manager-v1.html).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = __dirname;

global.window = global;
require(path.join(ROOT, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// MOTEUR — qualifierObservationEcart
// ------------------------------------------------------------

testSync('qualifierObservationEcart — ni écart ni alerte -> aucune_action', () => {
  const r = M.qualifierObservationEcart({ alerteExistante: null, ecart: null });
  assert.strictEqual(r.action, 'aucune_action');
});

testSync('qualifierObservationEcart — premier écart, aucune alerte -> creer, Sous observation', () => {
  const r = M.qualifierObservationEcart({ alerteExistante: null, ecart: { valeur_attendue: 10, valeur_constatee: 8, gravite: 'attention' } });
  assert.strictEqual(r.action, 'creer');
  assert.strictEqual(r.statut, 'sous_observation');
  assert.strictEqual(r.observations_consecutives, 1);
  assert.strictEqual(r.valeur_constatee, 8);
});

testSync('qualifierObservationEcart — écart reconfirmé une 2e fois -> escalade en controle_manager_requis', () => {
  const alerteExistante = { id: 'a1', statut: 'sous_observation', observations_consecutives: 1 };
  const r = M.qualifierObservationEcart({ alerteExistante, ecart: { valeur_attendue: 10, valeur_constatee: 7, gravite: 'critique' } });
  assert.strictEqual(r.action, 'mettre_a_jour');
  assert.strictEqual(r.statut, 'controle_manager_requis');
  assert.strictEqual(r.observations_consecutives, 2);
});

testSync('qualifierObservationEcart — SEUIL_OBSERVATIONS_AVANT_CONTROLE_MANAGER = 2 (constante exportée)', () => {
  assert.strictEqual(M.SEUIL_OBSERVATIONS_AVANT_CONTROLE_MANAGER, 2);
});

testSync('qualifierObservationEcart — déjà en controle_manager_requis, toujours confirmé -> reste controle_manager_requis (jamais de désescalade automatique)', () => {
  const alerteExistante = { id: 'a1', statut: 'controle_manager_requis', observations_consecutives: 2 };
  const r = M.qualifierObservationEcart({ alerteExistante, ecart: { valeur_attendue: 10, valeur_constatee: 7, gravite: 'critique' } });
  assert.strictEqual(r.action, 'mettre_a_jour');
  assert.strictEqual(r.statut, 'controle_manager_requis');
  assert.strictEqual(r.observations_consecutives, 3);
});

testSync('qualifierObservationEcart — écart disparu, alerte Sous observation existante -> résolution automatique, erreur_comptage', () => {
  const alerteExistante = { id: 'a1', statut: 'sous_observation', observations_consecutives: 1 };
  const r = M.qualifierObservationEcart({ alerteExistante, ecart: null });
  assert.strictEqual(r.action, 'resoudre_imprecision');
  assert.strictEqual(r.statut, 'resolue');
  assert.strictEqual(r.nature_confirmee, 'erreur_comptage');
  assert.ok(r.resolution.includes('imprécision'));
});

testSync('qualifierObservationEcart — écart disparu même après escalade (controle_manager_requis) -> toujours résolu comme imprécision (Article 5, jamais un faux écart maintenu)', () => {
  const alerteExistante = { id: 'a1', statut: 'controle_manager_requis', observations_consecutives: 3 };
  const r = M.qualifierObservationEcart({ alerteExistante, ecart: null });
  assert.strictEqual(r.action, 'resoudre_imprecision');
  assert.strictEqual(r.nature_confirmee, 'erreur_comptage');
});

// ------------------------------------------------------------
// MOTEUR — certifierAlerte / regulariserAlerte
// ------------------------------------------------------------

testSync('certifierAlerte — nature invalide -> null (jamais un écrit incohérent)', () => {
  assert.strictEqual(M.certifierAlerte('autre_chose'), null);
  assert.strictEqual(M.certifierAlerte(undefined), null);
});

testSync('certifierAlerte — erreur_comptage -> pas de régularisation requise, se referme directement', () => {
  const r = M.certifierAlerte('erreur_comptage');
  assert.strictEqual(r.nature_confirmee, 'erreur_comptage');
  assert.strictEqual(r.regularisation_requise, false);
  assert.strictEqual(r.statutApresCertification, 'resolue');
});

testSync('certifierAlerte — ecart_stock_reel -> régularisation requise, reste ouverte (controle_manager_requis)', () => {
  const r = M.certifierAlerte('ecart_stock_reel');
  assert.strictEqual(r.nature_confirmee, 'ecart_stock_reel');
  assert.strictEqual(r.regularisation_requise, true);
  assert.strictEqual(r.statutApresCertification, 'controle_manager_requis');
});

testSync('regulariserAlerte — pose le pointeur de vérification et referme l\'alerte', () => {
  const r = M.regulariserAlerte('2026-08-30T10:00:00.000Z');
  assert.strictEqual(r.regularisation_verifiee_le, '2026-08-30T10:00:00.000Z');
  assert.strictEqual(r.statut, 'resolue');
});

// ------------------------------------------------------------
// DONNÉES — les filtres statut doivent inclure les 2 nouveaux statuts
// partout où une alerte 'ouverte' l'était déjà (Article 5 : sans ce
// branchement, le cycle se bloque silencieusement à sa 1re étape).
// ------------------------------------------------------------

function lireSource(fichier) { return fs.readFileSync(path.join(ROOT, fichier), 'utf8'); }

testSync('nexus-inventaire-plan-donnees.js — la sélection du plan de comptage inclut sous_observation/controle_manager_requis (sinon le recomptage automatique ne se déclenche jamais)', () => {
  const src = lireSource('nexus-inventaire-plan-donnees.js');
  const m = src.match(/inventaire_alertes'\)\.select\('produit_id, gravite, cree_le'\)\s*\.eq\('site', site\)\.in\('statut', (\[[^\]]*\])\)/);
  assert.ok(m, 'requête alertes du plan introuvable ou reformulée');
  const statuts = eval(m[1]);
  assert.ok(statuts.includes('sous_observation'), 'sous_observation manquant du filtre plan');
  assert.ok(statuts.includes('controle_manager_requis'), 'controle_manager_requis manquant du filtre plan');
  assert.ok(statuts.includes('ouverte') && statuts.includes('en_cours'), 'comportement historique non préservé');
});

testSync('nexus-inventaire-manager-donnees.js — chargerAlertesOuvertesQuart inclut les 2 nouveaux statuts', () => {
  const src = lireSource('nexus-inventaire-manager-donnees.js');
  const bloc = src.slice(src.indexOf('async function chargerAlertesOuvertesQuart'), src.indexOf('async function chargerAlertesOuvertesQuart') + 400);
  assert.ok(bloc.includes("in('statut', ['ouverte', 'sous_observation', 'controle_manager_requis'])"), 'filtre non mis à jour: ' + bloc);
});

testSync('nexus-inventaire-manager-donnees.js — chargerAlertesOuvertesPeriode inclut les 2 nouveaux statuts', () => {
  const src = lireSource('nexus-inventaire-manager-donnees.js');
  const bloc = src.slice(src.indexOf('async function chargerAlertesOuvertesPeriode'), src.indexOf('async function chargerAlertesOuvertesPeriode') + 400);
  assert.ok(bloc.includes("in('statut', ['ouverte', 'en_cours', 'sous_observation', 'controle_manager_requis'])"), 'filtre non mis à jour: ' + bloc);
});

testSync('nexus-brief-donnees.js — le compteur Cockpit inclut controle_manager_requis mais EXCLUT sous_observation (doctrine : pas encore une alerte à traiter)', () => {
  const src = lireSource('nexus-brief-donnees.js');
  const bloc = src.slice(src.indexOf('async function chargerAlertesInventaireOuvertes'), src.indexOf('async function chargerAlertesInventaireOuvertes') + 400);
  assert.ok(bloc.includes("in('statut', ['ouverte', 'controle_manager_requis'])"), 'filtre Cockpit non mis à jour: ' + bloc);
  assert.ok(!bloc.includes('sous_observation'), 'sous_observation ne doit JAMAIS compter comme alerte ouverte au Cockpit');
});

testSync('NEXUS-Inventaire-v1.html — validerOuverture appelle bien qualifierObservationEcart (branchement présent)', () => {
  const src = lireSource('NEXUS-Inventaire-v1.html');
  assert.ok(src.includes('NexusInventaireMoteur.qualifierObservationEcart({ alerteExistante, ecart: ecartPourCycle })'), 'appel moteur introuvable côté employé');
  assert.ok(src.includes("in('statut', ['sous_observation', 'controle_manager_requis']).in('produit_id', idsZone)"), 'chargement des alertes cycle existantes introuvable ou modifié');
});

// ------------------------------------------------------------
// ÉCRAN MANAGER — renderBlocCycleObservation (extraction depuis
// NEXUS-Inventaire-Manager-v1.html, même convention que les autres tests
// de ce dépôt : extraction du script inline + sandbox minimal).
// ------------------------------------------------------------

function extraireFonction(src, nom) {
  const debut = src.indexOf(`function ${nom}(`);
  if (debut === -1) throw new Error(`Fonction ${nom} introuvable`);
  let i = src.indexOf('{', debut);
  let profondeur = 1; i++;
  const debutCorps = i;
  while (profondeur > 0) {
    if (src[i] === '{') profondeur++;
    else if (src[i] === '}') profondeur--;
    i++;
  }
  return src.slice(debut, i);
}

testSync('renderBlocCycleObservation — Sous observation : purement informatif, aucune action proposée', () => {
  const srcHtml = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const scriptMatch = [...srcHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
  const fnSrc = extraireFonction(scriptMatch, 'renderBlocCycleObservation');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnSrc}\nthis.renderBlocCycleObservation = renderBlocCycleObservation;`, sandbox);
  const html = sandbox.renderBlocCycleObservation({ type_alerte: 'ecart_ouverture', statut: 'sous_observation' });
  assert.ok(html.includes('Sous observation'));
  assert.ok(!html.includes('data-certifier'), 'aucune action ne doit être proposée en Sous observation');
  assert.ok(!html.includes('data-regulariser'));
});

testSync('renderBlocCycleObservation — Contrôle manager requis sans certification : propose les 2 boutons de certification', () => {
  const srcHtml = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const scriptMatch = [...srcHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
  const fnSrc = extraireFonction(scriptMatch, 'renderBlocCycleObservation');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnSrc}\nthis.renderBlocCycleObservation = renderBlocCycleObservation;`, sandbox);
  const html = sandbox.renderBlocCycleObservation({ id: 'a1', type_alerte: 'ecart_ouverture', statut: 'controle_manager_requis', observations_consecutives: 2, nature_confirmee: null });
  assert.ok(html.includes('data-certifier="erreur_comptage"'));
  assert.ok(html.includes('data-certifier="ecart_stock_reel"'));
});

testSync('renderBlocCycleObservation — écart de stock réel certifié, régularisation non vérifiée : propose la confirmation de régularisation', () => {
  const srcHtml = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const scriptMatch = [...srcHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
  const fnSrc = extraireFonction(scriptMatch, 'renderBlocCycleObservation');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnSrc}\nthis.renderBlocCycleObservation = renderBlocCycleObservation;`, sandbox);
  const html = sandbox.renderBlocCycleObservation({ id: 'a1', type_alerte: 'ecart_ouverture', statut: 'controle_manager_requis', nature_confirmee: 'ecart_stock_reel', regularisation_verifiee_le: null });
  assert.ok(html.includes('data-regulariser="1"'));
  assert.ok(!html.includes('data-certifier'), 'déjà certifié — ne doit plus proposer la certification');
});

testSync('renderBlocCycleObservation — alerte "ouverte" classique (hors cycle) ou autre type -> aucun bloc (comportement historique préservé)', () => {
  const srcHtml = lireSource('NEXUS-Inventaire-Manager-v1.html');
  const scriptMatch = [...srcHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
  const fnSrc = extraireFonction(scriptMatch, 'renderBlocCycleObservation');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnSrc}\nthis.renderBlocCycleObservation = renderBlocCycleObservation;`, sandbox);
  assert.strictEqual(sandbox.renderBlocCycleObservation({ type_alerte: 'ecart_ouverture', statut: 'ouverte' }), null);
  assert.strictEqual(sandbox.renderBlocCycleObservation({ type_alerte: 'demarque_ventes', statut: 'sous_observation' }), null);
});

if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
else { console.log('\nTous les tests sont passés.'); }
