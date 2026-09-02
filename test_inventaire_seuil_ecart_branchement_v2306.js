// Test — Branchement du seuil d'écart dans le cycle d'observation
// (30/08/2026, demande explicite de Frédéric : "Attaque le branchement du
// seuil d'écart. [...] écart brut calculé -> seuil effectif catégorie/
// produit/site -> si seuil dépassé : entrée dans le cycle d'observation ->
// sinon : aucun événement métier. La tolérance technique 0,001 doit
// uniquement servir à gérer les imprécisions numériques, jamais à décider
// si un écart métier mérite d'être suivi.")
//
// Avant ce lot, `saisie.ecartNonNul` (tolérance flottante 0,001, aucun
// seuil configurable) était le SEUL filtre décidant si un écart entrait
// dans qualifierObservationEcart — le seuil configurable
// (NexusInventaireMoteur.seuilEcartEffectif) n'était branché QUE dans
// depasseSeuilException, un filtre d'AFFICHAGE côté manager (vue par
// exception), jamais à la création de l'écart. Ce fichier couvre :
//   1. Moteur pur : ecartQuantiteSignificatif (déjà couvert en détail dans
//      test_inventaire_seuils_ecart_categorie_s5.js — ici seulement les cas
//      qui correspondent au comportement RÉEL attendu à ce point d'appel).
//   2. Câblage réel dans NEXUS-Inventaire-v1.html : chargement des seuils au
//      bootstrap, extension de chargerReglagesPlanComptage, et surtout le
//      point d'appel dans la boucle de validation d'ouverture — vérifie que
//      `ecartPourCycle` (donc l'entrée dans qualifierObservationEcart)
//      dépend bien de ecartQuantiteSignificatif, et que ecartNonNul garde
//      son rôle d'affichage inchangé (justification/motif à la saisie).
//   3. Non-régression : depasseSeuilException (Manager) et les 2 loaders
//      délégués restent couverts par test_inventaire_seuils_ecart_categorie_s5.js
//      — pas dupliqué ici.
// Discipline habituelle : assertions sur le texte source réel, jamais une
// réécriture à la main de la logique (Article 5 — si le code change sans
// que ce test soit mis à jour, il doit échouer, pas mentir).

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = __dirname;

global.window = global;
require(path.join(ROOT, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

function lireSource(fichier) { return fs.readFileSync(path.join(ROOT, fichier), 'utf8'); }

// ------------------------------------------------------------
// MOTEUR — comportement attendu au point d'appel réel (contexte
// {categorieId, produitId, seuilsParCategorie, seuilsParProduit, defautSite})
// ------------------------------------------------------------

testSync('ecartQuantiteSignificatif — écart de 0,0005 (bruit flottant) sur un produit sans aucun seuil réglé -> jamais significatif', () => {
  const r = M.ecartQuantiteSignificatif(0.0005, { categorieId: null, produitId: 'p1', seuilsParCategorie: {}, seuilsParProduit: {}, defautSite: 1 });
  assert.strictEqual(r, false);
});

testSync('ecartQuantiteSignificatif — écart réel de 0,3 sous le défaut site (seuil 1) -> pas encore significatif (avant ce lot, ecartNonNul seul aurait dit "oui")', () => {
  const r = M.ecartQuantiteSignificatif(0.3, { categorieId: 'cat-cig', produitId: 'p1', seuilsParCategorie: {}, seuilsParProduit: {}, defautSite: 1 });
  assert.strictEqual(r, false, 'un écart de 0,3 avec un seuil site de 1 ne doit plus déclencher le cycle');
});

testSync('ecartQuantiteSignificatif — catégorie sensible réglée à seuil 0 (ex. Cigarettes) -> le moindre écart réel devient significatif', () => {
  const r = M.ecartQuantiteSignificatif(0.3, { categorieId: 'cat-cig', produitId: 'p1', seuilsParCategorie: { 'cat-cig': { quantite_alerte: 0 } }, seuilsParProduit: {}, defautSite: 1 });
  assert.strictEqual(r, true);
});

testSync('ecartQuantiteSignificatif — site sans aucun seuil réglé (defautSite null) -> fail-safe à significatif dès que ce n\'est pas du bruit flottant (Article 5, jamais un écart avalé silencieusement)', () => {
  const r = M.ecartQuantiteSignificatif(0.3, { categorieId: null, produitId: 'p1', seuilsParCategorie: {}, seuilsParProduit: {}, defautSite: null });
  assert.strictEqual(r, true);
});

// ------------------------------------------------------------
// CÂBLAGE RÉEL — NEXUS-Inventaire-v1.html
// ------------------------------------------------------------

const srcEmploye = lireSource('NEXUS-Inventaire-v1.html');

testSync('NEXUS-Inventaire-v1.html — état seuilsEcart + seuilsSiteDefaut déclarés (bootstrap)', () => {
  assert.ok(srcEmploye.includes('let seuilsEcart = { parCategorie: {}, parProduit: {} };'), 'état seuilsEcart introuvable');
  assert.ok(srcEmploye.includes('let seuilsSiteDefaut = { quantite_alerte: 1, valeur_alerte: null };'), 'état seuilsSiteDefaut introuvable');
});

testSync('NEXUS-Inventaire-v1.html — chargerReglagesPlanComptage extrait bien quantityAlertThreshold/valueAlertThreshold (une seule requête station_config, Article 11)', () => {
  const debut = srcEmploye.indexOf('async function chargerReglagesPlanComptage');
  const bloc = srcEmploye.slice(debut, debut + 900);
  assert.ok(bloc.includes("Number.isFinite(p.quantityAlertThreshold) ? p.quantityAlertThreshold : 1"), 'extraction quantityAlertThreshold introuvable ou changée');
  assert.ok(bloc.includes("Number.isFinite(p.valueAlertThreshold) ? p.valueAlertThreshold : null"), 'extraction valueAlertThreshold introuvable ou changée');
  assert.ok(bloc.includes('return { socleCible, surprisesCible, quantityAlertThreshold, valueAlertThreshold };'), 'retour de chargerReglagesPlanComptage incomplet');
});

testSync('NEXUS-Inventaire-v1.html — chargerEtAppliquerPlanQuart charge seuilsEcart via le loader partagé (P.chargerSeuilsEcart)', () => {
  const debut = srcEmploye.indexOf('async function chargerEtAppliquerPlanQuart');
  const fin = srcEmploye.indexOf('async function chargerMissionsPourRole', debut);
  const bloc = srcEmploye.slice(debut, fin === -1 ? debut + 3000 : fin);
  assert.ok(bloc.includes('seuilsEcart = await P.chargerSeuilsEcart(nexusClient, site);'), 'appel au loader partagé introuvable dans chargerEtAppliquerPlanQuart');
  assert.ok(bloc.includes('seuilsSiteDefaut = { quantite_alerte: options.quantityAlertThreshold, valeur_alerte: options.valueAlertThreshold };'), 'seuilsSiteDefaut non alimenté depuis options');
});

testSync('NEXUS-Inventaire-v1.html — le point de création d\'écart (boucle de validation d\'ouverture) conditionne ecartPourCycle sur ecartQuantiteSignificatif', () => {
  const debut = srcEmploye.indexOf("if (saisie.ecartNonNul) {");
  const fin = srcEmploye.indexOf('const decision = NexusInventaireMoteur.qualifierObservationEcart', debut);
  assert.ok(debut !== -1 && fin !== -1, 'bloc de création écart introuvable');
  const bloc = srcEmploye.slice(debut, fin);
  assert.ok(bloc.includes('NexusInventaireMoteur.ecartQuantiteSignificatif(ecartVal, contexteSeuil)'), 'appel au gate ecartQuantiteSignificatif introuvable dans le bloc de création écart');
  assert.ok(/if \(NexusInventaireMoteur\.ecartQuantiteSignificatif\(ecartVal, contexteSeuil\)\) \{\s*ecartPourCycle = /.test(bloc), 'ecartPourCycle doit être affecté seulement à l\'intérieur du if (jamais inconditionnellement)');
  assert.ok(bloc.includes('produitId: p.id') && bloc.includes('categorieId: p.categorie_id'), 'contexteSeuil doit être construit avec categorieId ET produitId (cascade 3 niveaux)');
});

testSync('NEXUS-Inventaire-v1.html — ecartNonNul garde son rôle d\'affichage (justification/motif), indépendant du nouveau gate', () => {
  // Les 4 occurrences historiques de la bascule d'affichage (carrousel,
  // catégorie, plan/photo, saisie manuelle) doivent rester sur la
  // tolérance flottante brute — jamais requalifiées avec le seuil
  // configurable (ce serait masquer le champ justification pour un écart
  // réel mais sous le seuil, ce qui n'a jamais été demandé).
  const occurrences = srcEmploye.match(/const ecartNonNul = Math\.abs\(ecart\) > 0\.001;/g) || [];
  assert.ok(occurrences.length >= 3, `au moins 3 occurrences attendues de la tolérance d'affichage brute, trouvé ${occurrences.length}`);
});

if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
else { console.log('\nTous les tests sont passés.'); }
