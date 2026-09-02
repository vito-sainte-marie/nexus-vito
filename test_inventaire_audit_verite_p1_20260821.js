// Test — Audit "NEXUS Inventaire Produit — Chaîne de données" (cahier
// développeur reçu de Frédéric le 21/08/2026), Phase 1 uniquement (accord
// explicite : "vérité d'affichage", aucun schéma DB, aucun Decenium — juste
// le moteur + l'écran Contrôle Inventaire existants).
//
// Vérifié en amont sur Supabase (site vito-sainte-marie) avant d'écrire une
// seule ligne de correctif (Article 5) : `inventaire_rapprochements` a
// TOUJOURS 0 ligne (aucun rapprochement Decenium n'a jamais été persisté,
// malgré 33 lignes dans inventaire_ventes_import) et `inventaire_quarts` n'a
// qu'1 seul quart réellement clôturé. La "Couverture physique" 7/14/30
// jours, elle, s'est révélée déjà honnête (vue view_inventaire_dernier_
// controle_produit = MAX(compte_le) réel sur inventaire_comptages, Sprint 5)
// — aucun correctif nécessaire sur ce point précis malgré l'exemple donné
// par l'audit, donc non retesté ici (déjà couvert par
// test_inventaire_sprint7_manager.js / le moteur couverturePhysique).
//
// PARTIE 1 — NexusInventaireMoteur.evaluerMaturiteInventaire (pur) : les 5
//   niveaux de maturité (§8.1 de l'audit), jamais un badge de confiance
//   fabriqué.
// PARTIE 2 — renderEtatConfiance : rendu du badge, un par niveau.
// PARTIE 3 — renderEtatPeriodeCard : gardes "non calculable" / "non
//   estimable" (I01/I02/I03 de l'audit).
// PARTIE 4 — renderCategoriesPeriode : "analyse indisponible" au lieu de
//   "aucune catégorie instable" quand rien n'est calculable.
//
// Même discipline que les tests précédents de ce module : extraction par
// regex/comptage d'accolades des vraies fonctions du fichier, jamais
// réécrites à la main.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

const moteurSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-moteur.js'), 'utf8');
const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(script.includes('renderEtatConfiance'), 'renderEtatConfiance introuvable — bloc "État de confiance" absent');
assert.ok(script.includes('renderEtatPeriodeCard'), 'renderEtatPeriodeCard introuvable');

function extraireFonction(nomFonction) {
  let debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  const prefixe = 'async ';
  if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
  let i = script.indexOf('(', debut);
  let profParen = 1, k = i + 1;
  while (profParen > 0) {
    if (script[k] === '(') profParen++;
    else if (script[k] === ')') profParen--;
    k++;
  }
  let j = script.indexOf('{', k);
  let profondeur = 1, l = j + 1;
  while (profondeur > 0) {
    if (script[l] === '{') profondeur++;
    else if (script[l] === '}') profondeur--;
    l++;
  }
  return script.slice(debut, l);
}
function extraireObjetConst(nomConst) {
  const debut = script.indexOf(`const ${nomConst} =`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  let k = script.indexOf('{', debut);
  let prof = 1, l = k + 1;
  while (prof > 0) {
    if (script[l] === '{') prof++;
    else if (script[l] === '}') prof--;
    l++;
  }
  return script.slice(debut, l);
}

// ------------------------------------------------------------
// PARTIE 1 — NexusInventaireMoteur.evaluerMaturiteInventaire (pur)
// ------------------------------------------------------------
(function partie1() {
  const ctx = {};
  vm.runInNewContext(moteurSrc + '\nglobalThis.__moteur = NexusInventaireMoteur;', ctx);
  const M = ctx.__moteur;
  assert.ok(typeof M.evaluerMaturiteInventaire === 'function');

  testSync('evaluerMaturiteInventaire : catalogue non configuré -> initialisation', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: false, couverturePourcentage: null, deceniumImporte: false, rapprochementFiable: false });
    assert.strictEqual(r.niveau, 'initialisation');
  });

  testSync('evaluerMaturiteInventaire : catalogue configuré mais couverture 0% -> initialisation (jamais "observation" sur 0 réel)', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 0, deceniumImporte: false, rapprochementFiable: false });
    assert.strictEqual(r.niveau, 'initialisation');
  });

  testSync('evaluerMaturiteInventaire : couverture faible (< seuil) -> observation_terrain', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 35, deceniumImporte: false, rapprochementFiable: false });
    assert.strictEqual(r.niveau, 'observation_terrain');
  });

  testSync('evaluerMaturiteInventaire : couverture suffisante mais Decenium jamais importé -> base_physique_en_construction', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 100, deceniumImporte: false, rapprochementFiable: false });
    assert.strictEqual(r.niveau, 'base_physique_en_construction');
  });

  testSync('evaluerMaturiteInventaire : Decenium importé mais aucun rapprochement fiable -> rapprochement_provisoire', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 100, deceniumImporte: true, rapprochementFiable: false });
    assert.strictEqual(r.niveau, 'rapprochement_provisoire');
  });

  testSync('evaluerMaturiteInventaire : chaîne complète -> controle_fiable', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 100, deceniumImporte: true, rapprochementFiable: true });
    assert.strictEqual(r.niveau, 'controle_fiable');
  });

  testSync('evaluerMaturiteInventaire : ctx absent/vide -> initialisation, jamais une exception', () => {
    assert.strictEqual(M.evaluerMaturiteInventaire(undefined).niveau, 'initialisation');
    assert.strictEqual(M.evaluerMaturiteInventaire({}).niveau, 'initialisation');
  });

  testSync('evaluerMaturiteInventaire : libellé FR fourni pour chaque niveau', () => {
    const r = M.evaluerMaturiteInventaire({ catalogueConfigure: true, couverturePourcentage: 100, deceniumImporte: true, rapprochementFiable: true });
    assert.strictEqual(r.libelle, 'Contrôle fiable');
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — renderEtatConfiance (rendu du badge)
// ------------------------------------------------------------
(function partie2() {
  const src = [
    extraireObjetConst('CLASSE_MATURITE'),
    extraireObjetConst('TEXTE_MATURITE'),
    extraireFonction('renderEtatConfiance'),
    `globalThis.__test = { renderEtatConfiance };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderEtatConfiance : maturité absente -> aucun rendu (jamais un badge par défaut)', () => {
    assert.strictEqual(T.renderEtatConfiance(null), '');
  });

  testSync('renderEtatConfiance : niveau initialisation -> libellé et texte explicite affichés', () => {
    const html2 = T.renderEtatConfiance({ niveau: 'initialisation', libelle: 'Initialisation' });
    assert.ok(html2.includes('Initialisation'));
    assert.ok(html2.includes('aucun comptage terrain exploitable'));
  });

  testSync('renderEtatConfiance : niveau controle_fiable -> classe verte sur la valeur', () => {
    const html2 = T.renderEtatConfiance({ niveau: 'controle_fiable', libelle: 'Contrôle fiable' });
    assert.ok(html2.includes('synthese-valeur green'));
    assert.ok(html2.includes('Contrôle fiable'));
  });
})();

// ------------------------------------------------------------
// PARTIE 3 — renderEtatPeriodeCard : I01/I02/I03 de l'audit
// ------------------------------------------------------------
(function partie3() {
  const src = [
    extraireFonction('fmtNum'),
    extraireFonction('fmtEuros'),
    extraireFonction('renderEtatPeriodeCard'),
    `globalThis.__test = { renderEtatPeriodeCard };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  const bornes = { debut: '2026-08-21', fin: '2026-08-21' };

  testSync('renderEtatPeriodeCard : aucun comptage sur la période -> écarts non calculables, jamais un 0 (I02)', () => {
    const review = { totalCounts: 0, completedCategories: 0, missingCounts: 0, totalDiscrepancies: 0, openDiscrepancies: 0, resolvedDiscrepancies: 0, estimatedValue: 0 };
    const html2 = T.renderEtatPeriodeCard(review, bornes, { niveau: 'initialisation', libelle: 'Initialisation' });
    assert.ok(html2.includes('Non calculables — aucun inventaire exploitable'), 'Doit expliciter la non-calculabilité');
    assert.ok(!html2.includes('Écarts détectés'), 'Ne doit plus afficher la ligne "Écarts détectés" chiffrée quand rien n\'est calculable');
  });

  testSync('renderEtatPeriodeCard : comptages réels présents -> écarts détectés/ouverts affichés normalement', () => {
    const review = { totalCounts: 24, completedCategories: 3, missingCounts: 0, totalDiscrepancies: 2, openDiscrepancies: 1, resolvedDiscrepancies: 1, estimatedValue: 0 };
    const html2 = T.renderEtatPeriodeCard(review, bornes, { niveau: 'controle_fiable', libelle: 'Contrôle fiable' });
    assert.ok(html2.includes('Écarts détectés'));
    assert.ok(html2.includes('Écarts encore ouverts'));
    assert.ok(!html2.includes('Non calculables'));
  });

  testSync('renderEtatPeriodeCard : Decenium jamais rapproché "fiable" -> démarque non estimable, même avec un review.estimatedValue non nul (I03)', () => {
    const review = { totalCounts: 24, completedCategories: 3, missingCounts: 0, totalDiscrepancies: 2, openDiscrepancies: 1, resolvedDiscrepancies: 1, estimatedValue: 145.5 };
    const html2 = T.renderEtatPeriodeCard(review, bornes, { niveau: 'base_physique_en_construction', libelle: 'Base physique en construction' });
    assert.ok(html2.includes('Non estimable — Decenium non rapproché'));
    assert.ok(!html2.includes('145,5') && !html2.includes('145.5'), 'Ne doit jamais afficher un montant tant que le rapprochement n\'est pas fiable');
  });

  testSync('renderEtatPeriodeCard : rapprochement fiable établi -> démarque potentielle réellement affichée', () => {
    const review = { totalCounts: 24, completedCategories: 3, missingCounts: 0, totalDiscrepancies: 2, openDiscrepancies: 1, resolvedDiscrepancies: 1, estimatedValue: 145.5 };
    const html2 = T.renderEtatPeriodeCard(review, bornes, { niveau: 'controle_fiable', libelle: 'Contrôle fiable' });
    assert.ok(!html2.includes('Non estimable'));
  });

  testSync('renderEtatPeriodeCard : maturité absente (non chargée) -> démarque non estimable par prudence, jamais une exception', () => {
    const review = { totalCounts: 24, completedCategories: 3, missingCounts: 0, totalDiscrepancies: 0, openDiscrepancies: 0, resolvedDiscrepancies: 0, estimatedValue: 0 };
    const html2 = T.renderEtatPeriodeCard(review, bornes, null);
    assert.ok(html2.includes('Non estimable — Decenium non rapproché'));
  });
})();

// ------------------------------------------------------------
// PARTIE 4 — renderCategoriesPeriode : "l'absence de données n'est pas une
// preuve de stabilité" (§8 de l'audit)
// ------------------------------------------------------------
(function partie4() {
  const src = [
    extraireFonction('renderCategoriesPeriode'),
    `globalThis.__test = { renderCategoriesPeriode };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderCategoriesPeriode : aucun comptage exploitable -> "analyse indisponible", jamais "aucune catégorie instable"', () => {
    const html2 = T.renderCategoriesPeriode([], true);
    assert.ok(html2.includes('Analyse de stabilité indisponible'));
    assert.ok(!html2.includes('Aucune catégorie instable'));
  });

  testSync('renderCategoriesPeriode : comptages exploitables et aucune catégorie concernée -> "aucune catégorie instable" (conclusion réellement gagnée)', () => {
    const html2 = T.renderCategoriesPeriode([{ categoryId: 'c1', categoryName: 'Boissons', discrepancies: 0, openAlerts: 0 }], false);
    assert.ok(html2.includes('Aucune catégorie instable sur cette période.'));
  });

  testSync('renderCategoriesPeriode : catégorie avec écarts -> listée normalement, comportement historique inchangé', () => {
    const html2 = T.renderCategoriesPeriode([{ categoryId: 'c1', categoryName: 'Cigarettes', discrepancies: 3, openAlerts: 1 }], false);
    assert.ok(html2.includes('Cigarettes'));
    assert.ok(html2.includes('3 écart'));
  });
})();

const total = (process.exitCode === 1) ? 'AVEC ÉCHECS' : 'OK';
console.log(`\nRésultat global : ${total}`);
