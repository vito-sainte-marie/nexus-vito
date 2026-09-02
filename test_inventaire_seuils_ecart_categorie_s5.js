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
//
// MISE À JOUR 30/08/2026 (chantier convergence Inventaire V2, branchement du
// seuil d'écart) : seuilEcartEffectif est passé d'une signature positionnelle
// (cle, categorieId, seuilsParCategorie, defautSite) à un objet contexte
// unique {categorieId, produitId, seuilsParCategorie, seuilsParProduit,
// defautSite}, avec un niveau produit ajouté (cascade produit -> catégorie ->
// site). Partie 1 réécrite pour la nouvelle signature + le niveau produit.
// Partie 2 mise à jour : chargerSeuilsEcartCategorie délègue désormais à
// NexusInventairePlanDonnees.chargerSeuilsEcart (Article 11, voir ce
// fichier) — le mock Supabase et les assertions changent en conséquence,
// mais le contrat exposé à cette fonction (retourne une map categorie_id ->
// {cle: valeur}) reste identique. Partie 3 (depasseSeuilException) et
// Partie 4 (UI Paramètres) ne changent pas : leur comportement observable
// est resté strictement identique après la migration de signature (voir
// nexus-inventaire-moteur.js et NEXUS-Inventaire-Manager-v1.html).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

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
// 30/08/2026 : chargerSeuilsEcartCategorie (Manager) délègue désormais à
// NexusInventairePlanDonnees.chargerSeuilsEcart — les deux fichiers doivent
// tourner dans le même contexte vm pour que la délégation résolve.
const planDonneesSrc = fs.readFileSync(path.join(PROJET, 'nexus-inventaire-plan-donnees.js'), 'utf8');

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
  assert.ok(typeof M.ecartQuantiteSignificatif === 'function', 'ecartQuantiteSignificatif doit être exportée');
  assert.strictEqual(M.TOLERANCE_ARRONDI_FLOTTANT, 0.001, 'TOLERANCE_ARRONDI_FLOTTANT doit être exportée à 0.001');

  testSync('seuilEcartEffectif : pas de dérogation -> retombe sur le défaut site', () => {
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', seuilsParCategorie: {}, defautSite: 1 }), 1);
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', seuilsParCategorie: { 'cat-cigarettes': { quantite_alerte: 5 } }, defautSite: 1 }), 1);
  });

  testSync('seuilEcartEffectif : dérogation catégorie présente -> prime sur le défaut site', () => {
    const seuilsParCategorie = { 'cat-bieres': { quantite_alerte: 5, valeur_alerte: 20 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', seuilsParCategorie, defautSite: 1 }), 5);
    assert.strictEqual(M.seuilEcartEffectif('valeur_alerte', { categorieId: 'cat-bieres', seuilsParCategorie, defautSite: null }), 20);
  });

  testSync('seuilEcartEffectif : dérogation à 0 est une vraie valeur (pas confondue avec "absente")', () => {
    const seuilsParCategorie = { 'cat-bieres': { quantite_alerte: 0 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', seuilsParCategorie, defautSite: 1 }), 0);
  });

  testSync('seuilEcartEffectif : categorieId absent (produit sans catégorie) -> défaut site', () => {
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: null, seuilsParCategorie: { 'cat-bieres': { quantite_alerte: 5 } }, defautSite: 1 }), 1);
  });

  // 30/08/2026 — niveau produit ajouté à la cascade (migration
  // inventaire_seuils_produit) : produit > catégorie > site.
  testSync('seuilEcartEffectif : dérogation produit présente -> prime sur la catégorie ET le défaut site', () => {
    const seuilsParCategorie = { 'cat-bieres': { quantite_alerte: 5 } };
    const seuilsParProduit = { 'prod-heineken': { quantite_alerte: 0.5 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', produitId: 'prod-heineken', seuilsParCategorie, seuilsParProduit, defautSite: 1 }), 0.5);
  });

  testSync('seuilEcartEffectif : produit réglé mais pas sur cette clé -> retombe sur la catégorie', () => {
    const seuilsParCategorie = { 'cat-bieres': { quantite_alerte: 5, valeur_alerte: 20 } };
    const seuilsParProduit = { 'prod-heineken': { quantite_alerte: 0.5 } };
    assert.strictEqual(M.seuilEcartEffectif('valeur_alerte', { categorieId: 'cat-bieres', produitId: 'prod-heineken', seuilsParCategorie, seuilsParProduit, defautSite: null }), 20);
  });

  testSync('seuilEcartEffectif : produitId absent des dérogations -> retombe sur la catégorie', () => {
    const seuilsParCategorie = { 'cat-bieres': { quantite_alerte: 5 } };
    const seuilsParProduit = { 'prod-autre': { quantite_alerte: 0.5 } };
    assert.strictEqual(M.seuilEcartEffectif('quantite_alerte', { categorieId: 'cat-bieres', produitId: 'prod-heineken', seuilsParCategorie, seuilsParProduit, defautSite: 1 }), 5);
  });

  // ------------------------------------------------------------
  // ecartQuantiteSignificatif — règle explicite demandée par Frédéric :
  // écart brut -> seuil effectif -> dépassé ou pas. La tolérance 0,001 ne
  // sert QUE pour l'imprécision flottante, jamais pour une vraie décision
  // métier.
  // ------------------------------------------------------------
  testSync('ecartQuantiteSignificatif : écart en dessous de la tolérance flottante -> jamais significatif, quel que soit le seuil', () => {
    assert.strictEqual(M.ecartQuantiteSignificatif(0.0005, { defautSite: 0 }), false);
    assert.strictEqual(M.ecartQuantiteSignificatif(-0.0009, { defautSite: 0 }), false);
  });

  testSync('ecartQuantiteSignificatif : écart réel mais sous le seuil effectif -> pas encore significatif', () => {
    assert.strictEqual(M.ecartQuantiteSignificatif(1, { categorieId: 'cat-bieres', seuilsParCategorie: { 'cat-bieres': { quantite_alerte: 2 } } }), false);
  });

  testSync('ecartQuantiteSignificatif : écart au-dessus du seuil effectif -> significatif, entre dans le cycle', () => {
    assert.strictEqual(M.ecartQuantiteSignificatif(3, { categorieId: 'cat-bieres', seuilsParCategorie: { 'cat-bieres': { quantite_alerte: 2 } } }), true);
  });

  testSync('ecartQuantiteSignificatif : négatif traité en valeur absolue', () => {
    assert.strictEqual(M.ecartQuantiteSignificatif(-3, { categorieId: 'cat-bieres', seuilsParCategorie: { 'cat-bieres': { quantite_alerte: 2 } } }), true);
  });

  testSync('ecartQuantiteSignificatif : aucun seuil configuré nulle part -> fail-safe à significatif (jamais un écart avalé silencieusement)', () => {
    assert.strictEqual(M.ecartQuantiteSignificatif(0.5, {}), true);
  });

  testSync('ecartQuantiteSignificatif : dérogation produit plus stricte que la catégorie -> le produit prime, écart désormais significatif', () => {
    const contexte = { categorieId: 'cat-bieres', produitId: 'prod-heineken', seuilsParCategorie: { 'cat-bieres': { quantite_alerte: 5 } }, seuilsParProduit: { 'prod-heineken': { quantite_alerte: 0 } } };
    assert.strictEqual(M.ecartQuantiteSignificatif(0.5, contexte), true);
  });
})();

// ------------------------------------------------------------
// PARTIE 2 — NexusInventaireManagerDonnees.chargerSeuilsEcartCategorie : construction
// de la map { categorie_id: { cle: valeur } } depuis les lignes Supabase.
// ------------------------------------------------------------
(async function partie2() {
  // 30/08/2026 : chargerSeuilsEcartCategorie ne fait plus sa propre requête —
  // elle délègue à NexusInventairePlanDonnees.chargerSeuilsEcart puis
  // n'extrait que .parCategorie (Article 11, un seul loader pour les 3
  // écrans). Les deux fichiers doivent donc tourner dans le même contexte.
  const ctx = { console };
  vm.runInNewContext(planDonneesSrc + '\n' + donneesSrc + '\nglobalThis.__donnees = NexusInventaireManagerDonnees; globalThis.__plandonnees = NexusInventairePlanDonnees;', ctx);
  const D = ctx.__donnees;
  const P = ctx.__plandonnees;
  assert.ok(typeof D.chargerSeuilsEcartCategorie === 'function', 'chargerSeuilsEcartCategorie doit être exportée');
  assert.ok(typeof P.chargerSeuilsEcart === 'function', 'chargerSeuilsEcart (loader partagé) doit être exportée');

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
  await testAsync('chargerSeuilsEcartCategorie : regroupe les lignes par categorie_id puis par cle (via le loader partagé)', async () => {
    const client = mockClient([
      { categorie_id: 'cat-bieres', produit_id: null, cle: 'quantite_alerte', valeur: '5' },
      { categorie_id: 'cat-bieres', produit_id: null, cle: 'valeur_alerte', valeur: '20.5' },
      { categorie_id: 'cat-cigarettes', produit_id: null, cle: 'quantite_alerte', valeur: '2' },
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

  // Le loader partagé lui-même : vérifie qu'il sépare bien parCategorie et
  // parProduit selon la colonne renseignée (exclusive, migration
  // inventaire_seuils_produit) — c'est le contrat que Manager/Paramètres/
  // Employé consomment tous les 3 désormais.
  await testAsync('chargerSeuilsEcart (loader partagé) : sépare parCategorie et parProduit selon la ligne', async () => {
    const client = mockClient([
      { categorie_id: 'cat-bieres', produit_id: null, cle: 'quantite_alerte', valeur: '5' },
      { categorie_id: null, produit_id: 'prod-heineken', cle: 'quantite_alerte', valeur: '0.5' },
    ]);
    const { parCategorie, parProduit } = await P.chargerSeuilsEcart(client, 'site-1');
    assert.strictEqual(JSON.stringify(parCategorie), JSON.stringify({ 'cat-bieres': { quantite_alerte: 5 } }));
    assert.strictEqual(JSON.stringify(parProduit), JSON.stringify({ 'prod-heineken': { quantite_alerte: 0.5 } }));
  });

  await testAsync('chargerSeuilsEcart (loader partagé) : erreur Supabase -> les deux maps vides, pas d\'exception', async () => {
    const client = mockClient(null, { message: 'boom' });
    const errAvant = console.error;
    console.error = () => {};
    const { parCategorie, parProduit } = await P.chargerSeuilsEcart(client, 'site-1');
    console.error = errAvant;
    assert.strictEqual(JSON.stringify(parCategorie), '{}');
    assert.strictEqual(JSON.stringify(parProduit), '{}');
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
