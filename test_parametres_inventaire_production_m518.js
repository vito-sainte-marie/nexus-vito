// Test — Paramètres Inventaire, onglet "Production" (tâche #518, 19/08/2026,
// "Paramètres manager : recommandations sans développeur"). Jusqu'ici,
// inventaire_production_regles/inventaire_calendrier_site/
// inventaire_production_valeurs_speciales (M2) ne pouvaient être renseignées
// que par SQL direct — ce lot ajoute l'écran manager qui les écrit, sans
// toucher au moteur de calcul (nexus-inventaire-moteur.js, déjà testé
// ailleurs). Toutes les fonctions ci-dessous sont extraites du vrai fichier
// NEXUS-Parametres-Inventaire-v1.html par regex (jamais réécrites à la
// main), même discipline que les autres tests de ce module.
//
// PARTIE 1 — calculerProfilDepuisReglage / libelleReglesProduit : la
//   bascule "production_journaliere" est prioritaire et mutuellement
//   exclusive avec cycle_journalier/lot_glissant/consommable.
// PARTIE 2 — libelleRegleProduction / renderLigneRegleProduction /
//   renderFormulaireRegleProduction : affichage des quantités conseillées.
// PARTIE 3 — renderBlocCalendrier / renderBlocValeursSpeciales /
//   renderOngletProduction : listes + formulaires d'ajout, états vides.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Parametres-Inventaire-v1.html'), 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(script.includes('renderOngletProduction'), 'Bloc script applicatif introuvable');

// extraireFonction corrigée (destructuration) — même correctif que
// test_inventaire_production_journaliere_m7_chronologie.js, repris ici par
// précaution même si aucune des fonctions visées ne déstructure son
// paramètre à ce jour.
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

// ------------------------------------------------------------
// PARTIE 1 — calculerProfilDepuisReglage / libelleReglesProduit
// ------------------------------------------------------------
(function partie1() {
  const src = [
    extraireFonction('calculerProfilDepuisReglage'),
    extraireFonction('libelleReglesProduit'),
    `globalThis.__test = { calculerProfilDepuisReglage, libelleReglesProduit };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('calculerProfilDepuisReglage : production_journaliere prioritaire sur tous les autres réglages', () => {
    assert.strictEqual(T.calculerProfilDepuisReglage({ production_journaliere: true, remise_a_zero_matin: true, duree_max_vente_jours: 3, seuil_minimal: 5 }), 'production_journaliere');
  });
  testSync('calculerProfilDepuisReglage : sans production_journaliere, comportement historique inchangé', () => {
    assert.strictEqual(T.calculerProfilDepuisReglage({ remise_a_zero_matin: true }), 'cycle_journalier');
    assert.strictEqual(T.calculerProfilDepuisReglage({ duree_max_vente_jours: 3 }), 'lot_glissant');
    assert.strictEqual(T.calculerProfilDepuisReglage({ seuil_minimal: 5 }), 'consommable');
    assert.strictEqual(T.calculerProfilDepuisReglage({}), 'continu');
  });
  testSync('libelleReglesProduit : profil production_journaliere -> libellé dédié pointant vers l\'onglet Production', () => {
    const l = T.libelleReglesProduit({ profil: 'production_journaliere' });
    assert.ok(l.includes('Production'), 'Doit orienter le manager vers le bon onglet');
  });
  testSync('libelleReglesProduit : comportement historique inchangé pour les autres profils', () => {
    assert.strictEqual(T.libelleReglesProduit(null), 'Stock continu (par défaut)');
    assert.strictEqual(T.libelleReglesProduit({ profil: 'cycle_journalier' }), 'Remis à zéro le matin');
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — libelleRegleProduction / renderLigneRegleProduction /
//   renderFormulaireRegleProduction
// ------------------------------------------------------------
(function partie2() {
  const src = [
    'let productionRegleOuverte = null;',
    'let productionRegleEnEdition = null;',
    'let reglesProductionMap = {};',
    extraireFonction('libelleRegleProduction'),
    extraireFonction('renderFormulaireRegleProduction'),
    extraireFonction('renderLigneRegleProduction'),
    `globalThis.__test = {
      setEnv: (env) => { productionRegleOuverte = env.productionRegleOuverte; productionRegleEnEdition = env.productionRegleEnEdition; reglesProductionMap = env.reglesProductionMap || {}; },
      libelleRegleProduction, renderLigneRegleProduction, renderFormulaireRegleProduction,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('libelleRegleProduction : aucune règle -> "Aucune quantité configurée"', () => {
    assert.strictEqual(T.libelleRegleProduction(null), 'Aucune quantité configurée');
  });
  testSync('libelleRegleProduction : assemble uniquement les valeurs réellement renseignées (Article 5, jamais un zéro fabriqué)', () => {
    const l = T.libelleRegleProduction({ valeur_semaine: 40, valeur_samedi: 60, valeur_dimanche: null, valeur_vacances: null });
    assert.strictEqual(l, 'Semaine 40 · Sam. 60');
  });
  testSync('renderLigneRegleProduction : produit sans règle -> badge "à faire", formulaire fermé', () => {
    T.setEnv({ productionRegleOuverte: null, productionRegleEnEdition: null, reglesProductionMap: {} });
    const html = T.renderLigneRegleProduction({ id: 'p1', designation: 'Baguette' });
    assert.ok(html.includes('Baguette'));
    assert.ok(html.includes('Aucune quantité configurée'));
    assert.ok(html.includes('a-faire'));
    assert.ok(!html.includes('prodValeurSemaine'), 'Formulaire ne doit pas apparaître tant que la ligne n\'est pas ouverte');
  });
  testSync('renderLigneRegleProduction : ligne ouverte -> formulaire affiché avec les 4 quantités + fournée + seuil', () => {
    T.setEnv({
      productionRegleOuverte: 'p1',
      productionRegleEnEdition: { produit_id: 'p1', valeur_semaine: 40, valeur_samedi: 60, valeur_dimanche: 20, valeur_vacances: 15, autoriser_nouvelle_fournee: true, seuil_reste_surveiller: 5 },
      reglesProductionMap: { p1: { valeur_semaine: 40 } },
    });
    const html = T.renderLigneRegleProduction({ id: 'p1', designation: 'Baguette' });
    assert.ok(html.includes('prodValeurSemaine') && html.includes('value="40"'));
    assert.ok(html.includes('prodValeurSamedi') && html.includes('value="60"'));
    assert.ok(html.includes('prodValeurDimanche') && html.includes('value="20"'));
    assert.ok(html.includes('prodValeurVacances') && html.includes('value="15"'));
    assert.ok(html.includes('prodAutoriserFournee') && html.includes('checked'));
    assert.ok(html.includes('prodSeuilReste') && html.includes('value="5"'));
    assert.ok(html.includes('en-cours'), 'Une règle configurée doit afficher le badge "en cours", pas "à faire"');
  });
})();

// ------------------------------------------------------------
// PARTIE 3 — renderBlocCalendrier / renderBlocValeursSpeciales /
//   renderOngletProduction
// ------------------------------------------------------------
(function partie3() {
  const src = [
    'let calendrierForm = { date: "", type: "vacances", libelle: "" };',
    'let valeurSpecialeForm = { produitId: "", date: "", valeur: "", libelle: "" };',
    'let calendrierSite = [];',
    'let valeursSpecialesProduction = [];',
    'let produitsProduction = [];',
    'let reglesProductionMap = {};',
    'let productionRegleOuverte = null;',
    'let productionRegleEnEdition = null;',
    extraireFonction('libelleTypeCalendrier'),
    extraireFonction('renderBlocCalendrier'),
    extraireFonction('renderBlocValeursSpeciales'),
    extraireFonction('libelleRegleProduction'),
    extraireFonction('renderFormulaireRegleProduction'),
    extraireFonction('renderLigneRegleProduction'),
    extraireFonction('renderOngletProduction'),
    `globalThis.__test = {
      setEnv: (env) => {
        calendrierForm = env.calendrierForm || calendrierForm;
        valeurSpecialeForm = env.valeurSpecialeForm || valeurSpecialeForm;
        calendrierSite = env.calendrierSite || [];
        valeursSpecialesProduction = env.valeursSpecialesProduction || [];
        produitsProduction = env.produitsProduction || [];
        reglesProductionMap = env.reglesProductionMap || {};
      },
      renderBlocCalendrier, renderBlocValeursSpeciales, renderOngletProduction,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderBlocCalendrier : liste vide -> message explicite, jamais une liste fantôme', () => {
    T.setEnv({ calendrierSite: [] });
    const html = T.renderBlocCalendrier();
    assert.ok(html.includes('Aucune date configurée'));
  });
  testSync('renderBlocCalendrier : entrées existantes -> date, type en clair, libellé, action de suppression exposée', () => {
    T.setEnv({ calendrierSite: [
      { id: 'c1', date: '2026-12-24', type: 'ferie', libelle: 'Réveillon' },
      { id: 'c2', date: '2026-08-01', type: 'vacances', libelle: null },
    ] });
    const html = T.renderBlocCalendrier();
    assert.ok(html.includes('2026-12-24') && html.includes('Férié') && html.includes('Réveillon'));
    assert.ok(html.includes('2026-08-01') && html.includes('Vacances'));
    assert.ok(html.includes('data-supprimer-calendrier="c1"'));
    assert.ok(html.includes('data-supprimer-calendrier="c2"'));
  });

  testSync('renderBlocValeursSpeciales : aucun produit en suivi -> formulaire d\'ajout masqué avec message explicite', () => {
    T.setEnv({ produitsProduction: [], valeursSpecialesProduction: [] });
    const html = T.renderBlocValeursSpeciales();
    assert.ok(html.includes('Aucun produit en suivi de production journalière'));
    assert.ok(!html.includes('btnAjouterValeurSpeciale'), 'Le formulaire d\'ajout ne doit pas apparaître sans produit à choisir');
  });
  testSync('renderBlocValeursSpeciales : produits disponibles -> formulaire affiché avec les options produits', () => {
    T.setEnv({ produitsProduction: [{ id: 'p1', designation: 'Baguette' }, { id: 'p2', designation: 'Croissant' }], valeursSpecialesProduction: [] });
    const html = T.renderBlocValeursSpeciales();
    assert.ok(html.includes('btnAjouterValeurSpeciale'));
    assert.ok(html.includes('Baguette') && html.includes('Croissant'));
  });
  testSync('renderBlocValeursSpeciales : entrée existante -> date, produit, valeur, libellé, suppression', () => {
    T.setEnv({
      produitsProduction: [{ id: 'p1', designation: 'Baguette' }],
      valeursSpecialesProduction: [{ id: 'v1', date: '2026-12-24', valeur: 14, libelle: 'Réveillon', inventaire_zone_produit: { designation: 'Baguette' } }],
    });
    const html = T.renderBlocValeursSpeciales();
    assert.ok(html.includes('2026-12-24') && html.includes('Baguette') && html.includes('14') && html.includes('Réveillon'));
    assert.ok(html.includes('data-supprimer-valeur-speciale="v1"'));
  });

  testSync('renderOngletProduction : aucun produit en suivi -> message explicite orientant vers l\'onglet Règles', () => {
    T.setEnv({ produitsProduction: [], calendrierSite: [], valeursSpecialesProduction: [] });
    const html = T.renderOngletProduction();
    assert.ok(html.includes('Aucun produit en suivi de production journalière'));
    assert.ok(html.includes('Règles'), 'Doit orienter le manager vers l\'onglet où activer le suivi');
  });
  testSync('renderOngletProduction : produits présents -> liste des quantités + calendrier + valeurs spéciales, tous rendus', () => {
    T.setEnv({
      produitsProduction: [{ id: 'p1', designation: 'Baguette' }],
      reglesProductionMap: { p1: { valeur_semaine: 40 } },
      calendrierSite: [{ id: 'c1', date: '2026-12-24', type: 'ferie', libelle: null }],
      valeursSpecialesProduction: [],
    });
    const html = T.renderOngletProduction();
    assert.ok(html.includes('Baguette') && html.includes('Semaine 40'));
    assert.ok(html.includes('Calendrier vacances'));
    assert.ok(html.includes('Valeurs spéciales'));
    assert.ok(html.includes('2026-12-24'));
  });

  console.log('\nTous les tests "Paramètres Inventaire — onglet Production (#518)" passent.');
})();
