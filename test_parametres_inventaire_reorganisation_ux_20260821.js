// Test — Réorganisation UX de l'écran Paramètres Inventaire (21/08/2026,
// cahier développeur de Frédéric "NEXUS_Parametres_Inventaire_Reorganisation_
// UX_Developpeur.pdf") : nouvelle taxonomie de navigation (accueil, Fréquence
// séparée de Parcours, Réglages avancés pliable, "Tester ma configuration"),
// verdict de cohérence réel, et repli par défaut des blocs peu manipulés.
// Même discipline que les sprints précédents : extraction par regex/comptage
// d'accolades des vraies fonctions du fichier, jamais réécrites à la main.
// Les fonctions à effet de bord (wire(), appliquerNiveauSurveillance qui
// écrit en base) restent hors périmètre — seuls le rendu et le moteur pur
// sont testés directement.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

function extraireFonction(script, nomFonction) {
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
function extraireConst(script, nomConst) {
  const debut = script.indexOf(`const ${nomConst} =`);
  assert.ok(debut !== -1, `Constante ${nomConst} introuvable`);
  const finLigne = script.indexOf(';\n', debut);
  // ONGLETS est un tableau multi-lignes : on cherche le ']' qui ferme, pas le premier ';'
  let k = script.indexOf('[', debut);
  let prof = 1, l = k + 1;
  while (prof > 0) {
    if (script[l] === '[') prof++;
    else if (script[l] === ']') prof--;
    l++;
  }
  return script.slice(debut, l);
}

const moteurSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-moteur.js'), 'utf8');
const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Parametres-Inventaire-v1.html'), 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(script.includes('renderOngletAccueil'), 'Réorganisation UX non présente (renderOngletAccueil introuvable)');

// ------------------------------------------------------------
// PARTIE 1 — NexusInventaireMoteur.evaluerConfigurationInventaire (pur)
// ------------------------------------------------------------
(function partie1() {
  const ctx = {};
  vm.runInNewContext(moteurSrc + '\nglobalThis.__moteur = NexusInventaireMoteur;', ctx);
  const M = ctx.__moteur;
  assert.ok(typeof M.evaluerConfigurationInventaire === 'function');

  testSync('evaluerConfigurationInventaire : configuration propre -> verdict exploitable, aucun problème', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [{ id: 'p1', actif: true, categorie_id: 'c1', zone_id: 'z1' }],
      categories: [{ id: 'c1' }],
      produitsProduction: [],
      reglesProductionMap: {},
    });
    assert.strictEqual(r.verdict, 'exploitable');
    assert.strictEqual(r.problemes.length, 0);
  });

  testSync('evaluerConfigurationInventaire : produit actif sans catégorie -> problème "a_corriger"', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [{ id: 'p1', actif: true, categorie_id: null, zone_id: 'z1' }],
      categories: [],
      produitsProduction: [],
      reglesProductionMap: {},
    });
    assert.strictEqual(r.verdict, 'a_corriger');
    assert.ok(r.problemes.some(p => p.code === 'produits_sans_categorie'));
  });

  testSync('evaluerConfigurationInventaire : produit inactif sans catégorie -> ignoré (seuls les actifs comptent)', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [{ id: 'p1', actif: false, categorie_id: null, zone_id: null }],
      categories: [],
      produitsProduction: [],
      reglesProductionMap: {},
    });
    assert.strictEqual(r.verdict, 'exploitable');
  });

  testSync('evaluerConfigurationInventaire : produit actif sans emplacement -> problème "a_corriger"', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [{ id: 'p1', actif: true, categorie_id: 'c1', zone_id: null }],
      categories: [{ id: 'c1' }],
      produitsProduction: [],
      reglesProductionMap: {},
    });
    assert.ok(r.problemes.some(p => p.code === 'produits_sans_emplacement'));
    assert.strictEqual(r.verdict, 'a_corriger');
  });

  testSync('evaluerConfigurationInventaire : catégorie sans aucun produit actif -> problème "info" seulement (n\'invalide pas le verdict)', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [{ id: 'p1', actif: true, categorie_id: 'c1', zone_id: 'z1' }],
      categories: [{ id: 'c1' }, { id: 'c2' }],
      produitsProduction: [],
      reglesProductionMap: {},
    });
    const info = r.problemes.find(p => p.code === 'categories_orphelines');
    assert.ok(info && info.gravite === 'info');
    assert.strictEqual(r.verdict, 'exploitable', 'un problème "info" seul ne doit jamais faire basculer en "a_corriger"');
  });

  testSync('evaluerConfigurationInventaire : produit en production journalière sans aucune quantité renseignée -> "a_corriger"', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [],
      categories: [],
      produitsProduction: [{ id: 'p1' }],
      reglesProductionMap: { p1: { valeur_semaine: null, valeur_samedi: null, valeur_dimanche: null, valeur_vacances: null } },
    });
    assert.ok(r.problemes.some(p => p.code === 'production_sans_quantites'));
    assert.strictEqual(r.verdict, 'a_corriger');
  });

  testSync('evaluerConfigurationInventaire : produit en production journalière avec au moins une quantité -> pas de problème', () => {
    const r = M.evaluerConfigurationInventaire({
      produits: [], categories: [],
      produitsProduction: [{ id: 'p1' }],
      reglesProductionMap: { p1: { valeur_semaine: 40, valeur_samedi: null, valeur_dimanche: null, valeur_vacances: null } },
    });
    assert.ok(!r.problemes.some(p => p.code === 'production_sans_quantites'));
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — Taxonomie de navigation (ONGLETS) : accueil en premier,
// Fréquence distincte de Parcours, Réglages avancés en dernier.
// ------------------------------------------------------------
(function partie2() {
  const ongletsSrc = extraireConst(script, 'ONGLETS');
  const ctx = {};
  vm.runInNewContext(`${ongletsSrc}\nglobalThis.__onglets = ONGLETS;`, ctx);
  const ONGLETS = ctx.__onglets;

  testSync('ONGLETS : accueil est le premier onglet (point d\'entrée, INV-UX-01/02)', () => {
    assert.strictEqual(ONGLETS[0].value, 'accueil');
  });
  testSync('ONGLETS : Fréquence existe comme onglet distinct de Parcours (INV-UX-04)', () => {
    const valeurs = ONGLETS.map(o => o.value);
    assert.ok(valeurs.includes('frequence'));
    assert.ok(valeurs.includes('parcours'));
  });
  testSync('ONGLETS : Réglages avancés regroupe Alertes/Traçabilité (plus d\'onglets séparés "alertes"/"tracabilite")', () => {
    const valeurs = ONGLETS.map(o => o.value);
    assert.ok(valeurs.includes('avance'));
    assert.ok(!valeurs.includes('alertes'), 'Alertes ne doit plus être un onglet de premier niveau (INV-UX-17)');
    assert.ok(!valeurs.includes('tracabilite'), 'Traçabilité ne doit plus être un onglet de premier niveau (INV-UX-17)');
  });
  testSync('ONGLETS : "Tester ma configuration" a remplacé le libellé "Simulation" (INV-UX-18)', () => {
    const simulation = ONGLETS.find(o => o.value === 'simulation');
    assert.ok(simulation);
    assert.ok(simulation.label.toLowerCase().includes('config'));
    assert.ok(!simulation.label.toLowerCase().includes('simulation'));
  });
})();

// ------------------------------------------------------------
// PARTIE 3 — renderOngletFrequence / renderOngletParcours : le plan
// tournant et les jours de rotation ont bien migré de Parcours vers
// Fréquence (INV-UX-04), Parcours ne garde que le terrain (INV-UX-09).
// ------------------------------------------------------------
(function partie3() {
  const src = [
    'let parametresInventaire = { sensComptage: "piste_boutique", planSocleCible: null, planSurprisesCible: null };',
    'let zonesSite = [];',
    'let categoriesSite = [];',
    'const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];',
    extraireFonction(script, 'renderOngletParcours'),
    extraireFonction(script, 'renderOngletFrequence'),
    `globalThis.__test = {
      setEnv: (env) => { zonesSite = env.zonesSite || []; categoriesSite = env.categoriesSite || []; },
      renderOngletParcours, renderOngletFrequence,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;
  T.setEnv({ zonesSite: [{ id: 'z1', nom: 'Piste', code: 'piste', ordre_affichage: 1 }], categoriesSite: [{ id: 'c1', nom: 'Bières', jours_rotation: [1, 2, 3] }] });

  testSync('renderOngletParcours : ne contient plus le plan tournant ni les jours de rotation', () => {
    const html = T.renderOngletParcours();
    assert.ok(!html.includes('Plan de comptage tournant'), 'déplacé vers Fréquence');
    assert.ok(!html.includes('inputPlanSocleCible'), 'champ déplacé vers Fréquence');
    assert.ok(!html.includes('data-jour-rotation'), 'jours de rotation déplacés vers Fréquence');
    assert.ok(html.includes('Sens de comptage'));
    assert.ok(html.includes('Ordre des zones'));
  });
  testSync('renderOngletFrequence : contient le plan tournant relabellisé + les jours de rotation', () => {
    const html = T.renderOngletFrequence();
    assert.ok(html.includes('Nombre cible de produits par quart'), 'PDF 5.1 : "Socle" renommé');
    assert.ok(html.includes('Contrôles surprise supplémentaires'), 'PDF 5.1 : "Surprises tirées au sort" renommé');
    assert.ok(html.includes('inputPlanSocleCible') && html.includes('inputPlanSurprisesCible'));
    assert.ok(html.includes('data-jour-rotation="c1"'));
    assert.ok(!html.includes('Sens de comptage'), 'le sens de comptage reste dans Parcours');
  });
})();

// ------------------------------------------------------------
// PARTIE 4 — renderOngletAccueil : stats réelles + cartes de navigation.
// ------------------------------------------------------------
(function partie4() {
  const src = [
    moteurSrc,
    'let produitsInventaire = [];',
    'let categoriesSite = [];',
    'let reglesProduitMap = {};',
    'let produitsProduction = [];',
    'let reglesProductionMap = {};',
    extraireConst(script, 'CARTES_ACCUEIL'),
    extraireFonction(script, 'renderOngletAccueil'),
    `globalThis.__test = {
      setEnv: (env) => {
        produitsInventaire = env.produitsInventaire || [];
        categoriesSite = env.categoriesSite || [];
        reglesProduitMap = env.reglesProduitMap || {};
        produitsProduction = env.produitsProduction || [];
        reglesProductionMap = env.reglesProductionMap || {};
      },
      renderOngletAccueil,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderOngletAccueil : compte les produits actifs, catégories à règle active et exceptions réellement chargés', () => {
    T.setEnv({
      produitsInventaire: [
        { id: 'p1', actif: true, categorie_id: 'c1' },
        { id: 'p2', actif: true, categorie_id: 'c1' },
        { id: 'p3', actif: false, categorie_id: 'c1' },
      ],
      categoriesSite: [{ id: 'c1', regle_active: true }, { id: 'c2', regle_active: false }],
      reglesProduitMap: { p2: { profil: 'presse' } },
    });
    const html = T.renderOngletAccueil();
    assert.ok(html.includes('>2<'), 'produits suivis = actifs uniquement (2, pas 3)');
    assert.ok(html.includes('Exceptions produit'));
  });

  testSync('renderOngletAccueil : verdict "Exploitable" si aucun problème "a_corriger"', () => {
    T.setEnv({
      produitsInventaire: [{ id: 'p1', actif: true, categorie_id: 'c1', zone_id: 'z1' }],
      categoriesSite: [{ id: 'c1', regle_active: false }],
      reglesProduitMap: {},
    });
    const html = T.renderOngletAccueil();
    assert.ok(html.includes('Exploitable'));
  });

  testSync('renderOngletAccueil : verdict "à corriger" si des produits actifs manquent de catégorie/emplacement', () => {
    T.setEnv({
      produitsInventaire: [{ id: 'p1', actif: true, categorie_id: null, zone_id: null }],
      categoriesSite: [],
      reglesProduitMap: {},
    });
    const html = T.renderOngletAccueil();
    assert.ok(html.includes('à corriger'));
  });

  testSync('renderOngletAccueil : expose une carte de navigation par question métier (Produits/Fréquence/Parcours/Règles/Production/Avancé)', () => {
    T.setEnv({ produitsInventaire: [], categoriesSite: [], reglesProduitMap: {} });
    const html = T.renderOngletAccueil();
    ['produits', 'frequence', 'parcours', 'regles', 'production', 'avance'].forEach(v => {
      assert.ok(html.includes(`data-carte-accueil="${v}"`), `carte manquante pour ${v}`);
    });
    assert.ok(html.includes('Tester ma configuration'));
  });
})();

// ------------------------------------------------------------
// PARTIE 5 — renderOngletAvance : Alertes/Traçabilité pliées par défaut.
// ------------------------------------------------------------
(function partie5() {
  const src = [
    'let avanceSectionOuverte = null;',
    'let parametresInventaire = { niveauSurveillance: "standard", quantityAlertThreshold: 1, valueAlertThreshold: null, closureDelayMinutes: 30, reviewFrequency: "daily", immediateAlertCategoryIds: [] };',
    'let categoriesSite = [];',
    'let employesSite = [];',
    'let modesAveugleActifs = [];',
    'let jaugeageActif = false;',
    'const LABELS_FREQUENCE = { daily: "Tous les jours" };',
    'const PALIERS_DELAI_CLOTURE = [15, 30, 45, 60, 90, 120];',
    'const PRESET_RENFORCE = { quantityAlertThreshold: 0.5, valueAlertThreshold: 10, closureDelayMinutes: 15 };',
    extraireFonction(script, 'renderEmployeToggle'),
    extraireFonction(script, 'renderToggleJaugeage'),
    extraireFonction(script, 'renderOngletAlertes'),
    extraireFonction(script, 'renderOngletTracabilite'),
    extraireFonction(script, 'renderOngletAvance'),
    `globalThis.__test = {
      setEnv: (env) => { avanceSectionOuverte = env.avanceSectionOuverte !== undefined ? env.avanceSectionOuverte : null; },
      renderOngletAvance,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderOngletAvance : aucune section ouverte par défaut -> ni le détail Alertes ni Traçabilité ne fuient', () => {
    T.setEnv({ avanceSectionOuverte: null });
    const html = T.renderOngletAvance();
    assert.ok(html.includes('🚨 Alertes') && html.includes('🔄 Traçabilité'), 'les 2 en-têtes doivent être visibles');
    assert.ok(!html.includes('Seuils d\'alerte'), 'contenu détaillé Alertes non affiché tant que replié');
    assert.ok(!html.includes('NEXUS Traçabilité'), 'contenu Traçabilité non affiché tant que replié');
  });
  testSync('renderOngletAvance : section "alertes" ouverte -> affiche le contenu de renderOngletAlertes', () => {
    T.setEnv({ avanceSectionOuverte: 'alertes' });
    const html = T.renderOngletAvance();
    assert.ok(html.includes('Niveau de surveillance'));
  });
  testSync('renderOngletAvance : section "tracabilite" ouverte -> affiche le raccourci NEXUS Traçabilité', () => {
    T.setEnv({ avanceSectionOuverte: 'tracabilite' });
    const html = T.renderOngletAvance();
    assert.ok(html.includes('NEXUS Traçabilité'));
  });
})();

// ------------------------------------------------------------
// PARTIE 6 — renderOngletAlertes : "Niveau de surveillance" masque les
// seuils techniques par défaut, ne les révèle qu'en "Personnalisé".
// ------------------------------------------------------------
(function partie6() {
  const src = [
    'let categoriesSite = [];',
    'let employesSite = [];',
    'let modesAveugleActifs = [];',
    'let jaugeageActif = false;',
    'const LABELS_FREQUENCE = { daily: "Tous les jours" };',
    'const PALIERS_DELAI_CLOTURE = [15, 30, 45, 60, 90, 120];',
    'const PRESET_RENFORCE = { quantityAlertThreshold: 0.5, valueAlertThreshold: 10, closureDelayMinutes: 15 };',
    extraireFonction(script, 'renderEmployeToggle'),
    extraireFonction(script, 'renderToggleJaugeage'),
    extraireFonction(script, 'renderOngletAlertes'),
    `globalThis.__test = {
      setEnv: (env) => { parametresInventaire = env.parametresInventaire; },
      renderOngletAlertes,
    };`,
  ];
  // parametresInventaire doit être déclarée AVANT renderOngletAlertes pour que
  // la fonction extraite (qui la lit en variable libre) la voit — mais après
  // les autres 'let' ci-dessus pour rester lisible.
  src.splice(4, 0, 'let parametresInventaire = {};');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src.join('\n\n'), ctx);
  const T = ctx.__test;

  testSync('renderOngletAlertes : niveau "standard" -> seuils détaillés masqués, résumé affiché', () => {
    T.setEnv({ parametresInventaire: { niveauSurveillance: 'standard', quantityAlertThreshold: 1, valueAlertThreshold: null, closureDelayMinutes: 30, reviewFrequency: 'daily', immediateAlertCategoryIds: [] } });
    const html = T.renderOngletAlertes();
    assert.ok(!html.includes('paramSeuilQte'), 'champ détaillé absent en mode standard');
    assert.ok(html.includes('Standard NEXUS'));
  });
  testSync('renderOngletAlertes : niveau "renforce" -> seuils détaillés toujours masqués, résumé reflète le préréglage', () => {
    T.setEnv({ parametresInventaire: { niveauSurveillance: 'renforce', quantityAlertThreshold: 0.5, valueAlertThreshold: 10, closureDelayMinutes: 15, reviewFrequency: 'daily', immediateAlertCategoryIds: [] } });
    const html = T.renderOngletAlertes();
    assert.ok(!html.includes('paramSeuilQte'));
    assert.ok(html.includes('0.5') && html.includes('15 min'));
  });
  testSync('renderOngletAlertes : niveau "personnalise" -> tous les champs détaillés réapparaissent (comportement historique)', () => {
    T.setEnv({ parametresInventaire: { niveauSurveillance: 'personnalise', quantityAlertThreshold: 3, valueAlertThreshold: 50, closureDelayMinutes: 60, reviewFrequency: 'daily', immediateAlertCategoryIds: [] } });
    const html = T.renderOngletAlertes();
    assert.ok(html.includes('paramSeuilQte') && html.includes('paramSeuilValeur') && html.includes('paramDelaiCloture'));
  });
})();
