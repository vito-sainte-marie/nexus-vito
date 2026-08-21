// Test — Paramètres Inventaire, "Règles par catégorie" (Sprint 2, 20/08/2026,
// demande de Frédéric : "règle de catégorie par défaut + exceptions
// produit"). Même discipline que test_parametres_inventaire_production_m518.js :
// chaque fonction est extraite du vrai fichier NEXUS-Parametres-Inventaire-v1.html
// par regex/comptage d'accolades, jamais réécrite à la main, puis exécutée
// dans un contexte vm minimal. Les fonctions qui écrivent en base ou
// appellent render()/confirm() (ouvrirEditionRegleCategorie,
// enregistrerRegleCategorie) restent hors du périmètre de ce harnais léger
// — même frontière que le fichier de référence, qui ne teste pas non plus
// ouvrirEditionProfil/enregistrerProfilProduit.

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
assert.ok(script.includes('renderBlocReglesCategories'), 'Bloc script applicatif introuvable (Sprint 2 non présent ?)');

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

const MOTEUR_PATH = path.join(PROJET, 'nexus-inventaire-moteur.js');
const moteurSrc = fs.readFileSync(MOTEUR_PATH, 'utf8');

// ------------------------------------------------------------
// PARTIE 1 — produitsCategorie / compterExceptionsCategorie / libelleReglesCategorie
// ------------------------------------------------------------
(function partie1() {
  const src = [
    moteurSrc, // fournit NexusInventaireMoteur (utilisé par libelleReglesProduit via delegation indirecte le cas échéant)
    'let produitsInventaire = [];',
    'let reglesProduitMap = {};',
    extraireFonction('produitsCategorie'),
    extraireFonction('compterExceptionsCategorie'),
    extraireFonction('libelleReglesProduit'),
    extraireFonction('libelleReglesCategorie'),
    `globalThis.__test = {
      setEnv: (env) => { produitsInventaire = env.produitsInventaire || []; reglesProduitMap = env.reglesProduitMap || {}; },
      produitsCategorie, compterExceptionsCategorie, libelleReglesCategorie,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  const produits = [
    { id: 'p1', actif: true, categorie_id: 'cat-bieres' },
    { id: 'p2', actif: true, categorie_id: 'cat-bieres' },
    { id: 'p3', actif: true, categorie_id: 'cat-bieres' },
    { id: 'p4', actif: false, categorie_id: 'cat-bieres' }, // inactif, ne doit pas compter
    { id: 'p5', actif: true, categorie_id: 'cat-cigarettes' },
  ];
  const reglesProduitMap = { p2: { profil: 'presse' } }; // p2 a sa propre exception

  testSync('produitsCategorie : ne compte que les produits ACTIFS de la catégorie visée', () => {
    T.setEnv({ produitsInventaire: produits, reglesProduitMap });
    const liste = T.produitsCategorie('cat-bieres');
    assert.strictEqual(liste.length, 3, 'p1, p2, p3 (pas p4 inactif, pas p5 autre catégorie)');
    assert.ok(liste.every(p => p.categorie_id === 'cat-bieres'));
  });

  testSync('compterExceptionsCategorie : compte uniquement les produits avec leur propre ligne inventaire_regles_produit', () => {
    T.setEnv({ produitsInventaire: produits, reglesProduitMap });
    assert.strictEqual(T.compterExceptionsCategorie('cat-bieres'), 1, 'seul p2 a une exception');
    assert.strictEqual(T.compterExceptionsCategorie('cat-cigarettes'), 0);
  });

  testSync('libelleReglesCategorie : catégorie sans regle_active -> message explicite "chaque produit reste indépendant"', () => {
    assert.strictEqual(T.libelleReglesCategorie(null), 'Pas de règle commune — chaque produit reste indépendant');
    assert.strictEqual(T.libelleReglesCategorie({ regle_active: false, profil: 'cycle_journalier' }), 'Pas de règle commune — chaque produit reste indépendant');
  });
  testSync('libelleReglesCategorie : catégorie active -> délègue à libelleReglesProduit (même vocabulaire que les produits, Article 11)', () => {
    assert.strictEqual(T.libelleReglesCategorie({ regle_active: true, profil: 'cycle_journalier' }), 'Remis à zéro le matin');
    assert.strictEqual(T.libelleReglesCategorie({ regle_active: true, profil: 'production_journaliere' }).includes('Production'), true);
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — renderCarteCategorieRegle / renderFormulaireRegleCategorie /
//   renderBlocReglesCategories (affichage)
// ------------------------------------------------------------
(function partie2() {
  const src = [
    moteurSrc,
    'let produitsInventaire = [];',
    'let reglesProduitMap = {};',
    'let categoriesSite = [];',
    'let categorieReglesOuverte = null;',
    'let categorieRegleEnEdition = null;',
    extraireFonction('produitsCategorie'),
    extraireFonction('compterExceptionsCategorie'),
    extraireFonction('libelleReglesProduit'),
    extraireFonction('libelleReglesCategorie'),
    extraireFonction('renderCarteCategorieRegle'),
    extraireFonction('renderFormulaireRegleCategorie'),
    extraireFonction('renderBlocReglesCategories'),
    `globalThis.__test = {
      setEnv: (env) => {
        produitsInventaire = env.produitsInventaire || [];
        reglesProduitMap = env.reglesProduitMap || {};
        categoriesSite = env.categoriesSite || [];
        categorieReglesOuverte = env.categorieReglesOuverte || null;
        categorieRegleEnEdition = env.categorieRegleEnEdition || null;
      },
      renderCarteCategorieRegle, renderBlocReglesCategories,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  const produitsBieres = [
    { id: 'p1', actif: true, categorie_id: 'cat-bieres' },
    { id: 'p2', actif: true, categorie_id: 'cat-bieres' },
  ];

  testSync('renderCarteCategorieRegle : catégorie sans produit actif -> rendu vide (rien à régler)', () => {
    T.setEnv({ produitsInventaire: [], categoriesSite: [] });
    const html = T.renderCarteCategorieRegle({ id: 'cat-vide', nom: 'Vide', regle_active: false });
    assert.strictEqual(html, '');
  });

  testSync('renderCarteCategorieRegle : catégorie active affiche "☑ Règle commune activée" et le nombre de produits', () => {
    T.setEnv({ produitsInventaire: produitsBieres, reglesProduitMap: {} });
    const html = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: true, profil: 'cycle_journalier' });
    assert.ok(html.includes('Bières'));
    assert.ok(html.includes('2 produits'));
    assert.ok(html.includes('☑ Règle commune activée'));
  });

  testSync('renderCarteCategorieRegle : catégorie inactive affiche "☐ Règle commune désactivée"', () => {
    T.setEnv({ produitsInventaire: produitsBieres, reglesProduitMap: {} });
    const html = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: false });
    assert.ok(html.includes('☐ Règle commune désactivée'));
  });

  testSync('renderCarteCategorieRegle : affiche le nombre de produits en exception seulement s\'il y en a', () => {
    T.setEnv({ produitsInventaire: produitsBieres, reglesProduitMap: { p1: { profil: 'presse' } } });
    const html = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: true });
    assert.ok(html.includes('1 produit en exception'));

    T.setEnv({ produitsInventaire: produitsBieres, reglesProduitMap: {} });
    const htmlSansException = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: true });
    assert.ok(!htmlSansException.includes('en exception'));
  });

  testSync('renderBlocReglesCategories : n\'affiche que les catégories ayant au moins un produit actif', () => {
    T.setEnv({
      produitsInventaire: produitsBieres,
      reglesProduitMap: {},
      categoriesSite: [
        { id: 'cat-bieres', nom: 'Bières', regle_active: true },
        { id: 'cat-vide', nom: 'Catégorie sans produit', regle_active: false },
      ],
    });
    const html = T.renderBlocReglesCategories();
    assert.ok(html.includes('Bières'));
    assert.ok(!html.includes('Catégorie sans produit'));
  });

  testSync('renderBlocReglesCategories : aucune catégorie avec produits -> rendu vide (pas de titre orphelin)', () => {
    T.setEnv({ produitsInventaire: [], reglesProduitMap: {}, categoriesSite: [{ id: 'c1', nom: 'X', regle_active: false }] });
    assert.strictEqual(T.renderBlocReglesCategories(), '');
  });
})();
