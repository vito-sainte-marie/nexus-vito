// Test — "Seuils d'écart par catégorie" (Sprint 5, 20/08/2026, tâche #32 :
// "Activer inventaire_seuils (déjà en base, jamais lue) dans le moteur de
// calcul d'écart"). Couvre les 3 couches du Sprint :
//   1. Moteur pur : NexusInventaireMoteur.seuilEcartEffectif (cascade
//      catégorie -> défaut site, PAS de niveau produit ici contrairement à
//      S1 : inventaire_seuils n'a qu'une ligne par (site, categorie_id, cle)).
//   2. Chargement : NexusInventaireManagerDonnees.chargerSeuilsEcartCategorie
//      (construction de la map depuis les lignes Supabase, mock client).
//   3. Consommateur réel : NEXUS-Inventaire-Manager-v1.html::depasseSeuilException
//      (le seul endroit qui lisait déjà les seuils avant S5 — vérifie que la
//      dérogation catégorie prime bien sur le défaut site).
//   4. UI de réglage : NEXUS-Parametres-Inventaire-v1.html —
//      renderFormulaireRegleCategorie (champs pré-remplis) et
//      renderCarteCategorieRegle (indicateur "Seuil d'écart dérogé").
// Même discipline que les sprints précédents : extraction par regex/comptage
// d'accolades des vraies fonctions, jamais réécrites à la main. Les
// fonctions à effet de bord (ouvrirEditionRegleCategorie, enregistrerRegleCategorie,
// chargerSeuilsEcartCategorie côté écran Paramètres qui interroge Supabase
// directement) restent hors périmètre — même frontière que S2/S3.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
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

const moteurSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-moteur.js'), 'utf8');
const donneesSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-manager-donnees.js'), 'utf8');

const htmlManager = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
const scriptManager = [...htmlManager.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(scriptManager.includes('depasseSeuilException'), 'depasseSeuilException introuvable dans NEXUS-Inventaire-Manager-v1.html');

const htmlParametres = fs.readFileSync(path.join(PROJET, 'NEXUS-Parametres-Inventaire-v1.html'), 'utf8');
const scriptParametres = [...htmlParametres.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).reduce((a, b) => (b.length > a.length ? b : a), '');
assert.ok(scriptParametres.includes('seuil_ecart_quantite'), 'Champs de seuil Sprint 5 introuvables dans NEXUS-Parametres-Inventaire-v1.html');

// ------------------------------------------------------------
// PARTIE 1 — NexusInventaireMoteur.seuilEcartEffectif : cascade catégorie -> site
// ------------------------------------------------------------
(function partie1() {
  const ctx = {};
  vm.runInNewContext(moteurSrc + '\nglobalThis.__moteur = NexusInventaireMoteur;', ctx);
  const M = ctx.__moteur;
  assert.ok(typeof M.seuilEcartEffectif === 'function', 'seuilEcartEffectif doit être exportée');

  testSync('seuilEcartEffectif : pas de dérogation catégorie -> retombe sur le défaut site', () => {
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', 'cat-bieres', {}, 1), 1);
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', 'cat-bieres', { 'cat-cigarettes': { quantite_alerte: 5 } }, 1), 1);
  });

  testSync('seuilEcartEffectif : dérogation catégorie présente -> prime sur le défaut site', () => {
    const seuils = { 'cat-bieres': { quantite_alerte: 5, valeur_alerte: 20 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', 'cat-bieres', seuils, 1), 5);
    assert.strictEqual(M.seuilEcartEffectif('valeur_alerte', 'cat-bieres', seuils, null), 20);
  });

  testSync('seuilEcartEffectif : dérogation à 0 est une vraie valeur (pas confondue avec "absente")', () => {
    const seuils = { 'cat-bieres': { quantite_alerte: 0 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', 'cat-bieres', seuils, 1), 0);
  });

  testSync('seuilEcartEffectif : categorieId absent (produit sans catégorie) -> défaut site', () => {
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', null, { 'cat-bieres': { quantite_alerte: 5 } }, 1), 1);
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — NexusInventaireManagerDonnees.chargerSeuilsEcartCategorie : construction
// de la map { categorie_id: { cle: valeur } } depuis les lignes Supabase.
// ------------------------------------------------------------
(async function partie2() {
  const ctx = { console };
  vm.runInNewContext(donneesSrc + '\nglobalThis.__donnees = NexusInventaireManagerDonnees;', ctx);
  const D = ctx.__donnees;
  assert.ok(typeof D.chargerSeuilsEcartCategorie === 'function', 'chargerSeuilsEcartCategorie doit être exportée');

  function mockClient(rows, err) {
    const chain = {
      select() { return chain; },
      eq() { return chain; },
      not() { return chain; },
      then(resolve) { return Promise.resolve({ data: rows, error: err || null }).then(resolve); },
    };
    return { from() { return chain; } };
  }

  // Appels séquentiels (await) : le test 3 stub console.error temporairement
  // et le restaure — s'ils tournaient en parallèle (sans await), le stub
  // pourrait avaler le message d'erreur d'un AUTRE test en échec pendant
  // que console.error est remplacé, masquant un FAIL réel.
  await testAsync('chargerSeuilsEcartCategorie : regroupe les lignes par categorie_id puis par cle', async () => {
    const client = mockClient([
      { categorie_id: 'cat-bieres', cle: 'quantite_alerte', valeur: '5' },
      { categorie_id: 'cat-bieres', cle: 'valeur_alerte', valeur: '20.5' },
      { categorie_id: 'cat-cigarettes', cle: 'quantite_alerte', valeur: '2' },
    ]);
    const map = await D.chargerSeuilsEcartCategorie(client, 'site-1');
    // Objets construits dans le contexte vm : deepStrictEqual les rejette à
    // cause du prototype cross-réalité même à structure identique — on
    // compare donc la sérialisation, seule chose qui compte ici.
    assert.strictEqual(JSON.stringify(map), JSON.stringify({
      'cat-bieres': { quantite_alerte: 5, valeur_alerte: 20.5 },
      'cat-cigarettes': { quantite_alerte: 2 },
    }));
  });

  await testAsync('chargerSeuilsEcartCategorie : aucune ligne -> map vide, pas d\'exception', async () => {
    const client = mockClient([]);
    const map = await D.chargerSeuilsEcartCategorie(client, 'site-1');
    assert.strictEqual(JSON.stringify(map), '{}');
  });

  await testAsync('chargerSeuilsEcartCategorie : erreur Supabase -> map vide (dégradation silencieuse, jamais une exception qui casse le bootstrap)', async () => {
    const client = mockClient(null, { message: 'boom' });
    const errAvant = console.error;
    console.error = () => {};
    const map = await D.chargerSeuilsEcartCategorie(client, 'site-1');
    console.error = errAvant;
    assert.strictEqual(JSON.stringify(map), '{}');
  });
})();

// ------------------------------------------------------------
// PARTIE 3 — depasseSeuilException (NEXUS-Inventaire-Manager-v1.html) : le
// consommateur réel de la cascade, vérifie qu'une dérogation catégorie change
// bien le verdict par rapport au défaut site.
// ------------------------------------------------------------
(function partie3() {
  const src = [
    moteurSrc,
    'let parametresInventaire = { quantityAlertThreshold: 1, valueAlertThreshold: null, immediateAlertCategoryIds: [] };',
    'let seuilsEcartParCategorie = {};',
    extraireFonction(scriptManager, 'depasseSeuilException'),
    `globalThis.__test = {
      // Toujours réinitialisée au défaut (jamais "conservée telle quelle") :
      // un test qui ne précise pas parametresInventaire doit repartir du
      // défaut standard, pas hériter de la valeur laissée par le test
      // précédent — a mordu une première fois ici (faux positif masqué par
      // un bug d'interleaving async ailleurs dans ce fichier).
      setEnv: (env) => {
        parametresInventaire = env.parametresInventaire || { quantityAlertThreshold: 1, valueAlertThreshold: null, immediateAlertCategoryIds: [] };
        seuilsEcartParCategorie = env.seuilsEcartParCategorie || {};
      },
      depasseSeuilException,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('depasseSeuilException : écart 2 sous le défaut site (seuil 1) -> dépasse', () => {
    T.setEnv({});
    const a = { valeur_constatee: 8, valeur_attendue: 6, inventaire_zone_produit: { categorie_id: 'cat-bieres' } };
    assert.strictEqual(T.depasseSeuilException(a), true);
  });

  testSync('depasseSeuilException : dérogation catégorie relève le seuil -> même écart ne dépasse plus', () => {
    T.setEnv({ seuilsEcartParCategorie: { 'cat-bieres': { quantite_alerte: 5 } } });
    const a = { valeur_constatee: 8, valeur_attendue: 6, inventaire_zone_produit: { categorie_id: 'cat-bieres' } };
    assert.strictEqual(T.depasseSeuilException(a), false);
  });

  testSync('depasseSeuilException : dérogation catégorie abaisse le seuil -> un petit écart dépasse maintenant', () => {
    T.setEnv({ parametresInventaire: { quantityAlertThreshold: 5, valueAlertThreshold: null, immediateAlertCategoryIds: [] }, seuilsEcartParCategorie: { 'cat-bieres': { quantite_alerte: 0.5 } } });
    const a = { valeur_constatee: 6, valeur_attendue: 6.6, inventaire_zone_produit: { categorie_id: 'cat-bieres' } };
    assert.strictEqual(T.depasseSeuilException(a), true);
  });

  testSync('depasseSeuilException : autre catégorie non dérogée -> retombe sur le défaut site', () => {
    T.setEnv({ seuilsEcartParCategorie: { 'cat-bieres': { quantite_alerte: 5 } } });
    const a = { valeur_constatee: 8, valeur_attendue: 6, inventaire_zone_produit: { categorie_id: 'cat-cigarettes' } };
    assert.strictEqual(T.depasseSeuilException(a), true);
  });

  testSync('depasseSeuilException : gravité critique déclenche toujours, indépendamment des seuils', () => {
    T.setEnv({ seuilsEcartParCategorie: { 'cat-bieres': { quantite_alerte: 999 } } });
    const a = { valeur_constatee: 6, valeur_attendue: 6, inventaire_zone_produit: { categorie_id: 'cat-bieres' }, gravite: 'critique' };
    assert.strictEqual(T.depasseSeuilException(a), true);
  });
})();

// ------------------------------------------------------------
// PARTIE 4 — UI de réglage (NEXUS-Parametres-Inventaire-v1.html) :
// renderFormulaireRegleCategorie affiche les seuils pré-remplis, et
// renderCarteCategorieRegle affiche l'indicateur de dérogation.
// ------------------------------------------------------------
(function partie4() {
  const src = [
    'let produitsInventaire = [];',
    'let reglesProduitMap = {};',
    'let categoriesSite = [];',
    'let categorieReglesOuverte = null;',
    'let categorieRegleEnEdition = null;',
    'let seuilsEcartParCategorie = {};',
    'let parametresInventaire = { quantityAlertThreshold: 1, valueAlertThreshold: null };',
    extraireFonction(scriptParametres, 'produitsCategorie'),
    extraireFonction(scriptParametres, 'compterExceptionsCategorie'),
    extraireFonction(scriptParametres, 'libelleReglesProduit'),
    extraireFonction(scriptParametres, 'libelleReglesCategorie'),
    extraireFonction(scriptParametres, 'calculerProfilDepuisReglage'),
    extraireFonction(scriptParametres, 'renderFormulaireRegleCategorie'),
    extraireFonction(scriptParametres, 'renderCarteCategorieRegle'),
    `globalThis.__test = {
      setEnv: (env) => {
        produitsInventaire = env.produitsInventaire || [];
        reglesProduitMap = env.reglesProduitMap || {};
        categoriesSite = env.categoriesSite || [];
        categorieReglesOuverte = env.categorieReglesOuverte || null;
        categorieRegleEnEdition = env.categorieRegleEnEdition || null;
        seuilsEcartParCategorie = env.seuilsEcartParCategorie || {};
        parametresInventaire = env.parametresInventaire || { quantityAlertThreshold: 1, valueAlertThreshold: null };
      },
      renderFormulaireRegleCategorie, renderCarteCategorieRegle,
    };`,
  ].join('\n\n');
  const ctx = { globalThis: {}, console };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  const T = ctx.__test;

  testSync('renderFormulaireRegleCategorie : aucune dérogation -> champs vides, placeholder = défaut site', () => {
    T.setEnv({
      categorieRegleEnEdition: { categorie_id: 'cat-bieres', regle_active: true, seuil_ecart_quantite: null, seuil_ecart_valeur: null, quarts_comptage: null },
      parametresInventaire: { quantityAlertThreshold: 1, valueAlertThreshold: null },
    });
    const html = T.renderFormulaireRegleCategorie();
    assert.ok(html.includes('id="catRegleSeuilEcartQte"'));
    assert.ok(html.includes('placeholder="Défaut site (1)"'));
    assert.ok(html.includes('id="catRegleSeuilEcartValeur"'));
    assert.ok(html.includes('value=""'), 'les champs de seuil ne doivent afficher aucune valeur pré-remplie');
  });

  testSync('renderFormulaireRegleCategorie : dérogation existante -> valeur pré-remplie dans le champ', () => {
    T.setEnv({
      categorieRegleEnEdition: { categorie_id: 'cat-bieres', regle_active: true, seuil_ecart_quantite: 5, seuil_ecart_valeur: 20.5, quarts_comptage: null },
      parametresInventaire: { quantityAlertThreshold: 1, valueAlertThreshold: null },
    });
    const html = T.renderFormulaireRegleCategorie();
    assert.ok(html.includes('id="catRegleSeuilEcartQte"') && html.includes('value="5"'));
    assert.ok(html.includes('value="20.5"'));
  });

  testSync('renderCarteCategorieRegle : dérogation réglée -> indicateur "Seuil d\'écart dérogé" visible', () => {
    T.setEnv({
      produitsInventaire: [{ id: 'p1', actif: true, categorie_id: 'cat-bieres' }],
      seuilsEcartParCategorie: { 'cat-bieres': { quantite_alerte: 5, valeur_alerte: null } },
    });
    const html = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: false });
    assert.ok(html.includes('Seuil d\'écart dérogé'));
    assert.ok(html.includes('5 qté'));
    assert.ok(!html.includes('€)'), 'valeur_alerte non réglée -> pas de fragment "€" affiché');
  });

  testSync('renderCarteCategorieRegle : aucune dérogation -> pas d\'indicateur', () => {
    T.setEnv({
      produitsInventaire: [{ id: 'p1', actif: true, categorie_id: 'cat-bieres' }],
      seuilsEcartParCategorie: {},
    });
    const html = T.renderCarteCategorieRegle({ id: 'cat-bieres', nom: 'Bières', regle_active: false });
    assert.ok(!html.includes('Seuil d\'écart dérogé'));
  });
})();
