// Test — Scission des catégories mixtes "comptage en deux lieux"
// (16/08/2026, demande de Frédéric : "je souhaiterais qu'il commence par
// huiles & lave-glace [...] les produits [bières] dans la catégorie
// boissons chaudes/bières au dépôt [...] ensuite [...] et enfin le reste
// des produits dans la catégorie boissons chaudes/bières").
//
// Extrait les fonctions réelles de NEXUS-Inventaire-v1.html via regex
// (jamais réécrites à la main), comme tous les tests de ce module.

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('/sessions/dazzling-compassionate-ride/mnt/image nexus project/NEXUS-Inventaire-v1.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = script.indexOf(`function ${nomFonction}(`);
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

const src = [
  extraire('grouperParCategorie'),
  extraire('ordonnerParcoursDepotBoutiqueReste'),
  'globalThis.__test = { grouperParCategorie, ordonnerParcoursDepotBoutiqueReste };',
].join('\n\n');

const vm = require('vm');
const ctx = { globalThis: {}, console };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const { grouperParCategorie, ordonnerParcoursDepotBoutiqueReste } = ctx.__test;

// ------------------------------------------------------------
// Jeu de données — reproduit le cas exact de Frédéric.
// ------------------------------------------------------------
const catHuiles = { nom: 'Huiles & lave-glace', ordre_affichage: 1, jours_rotation: null };
const catBoissons = { nom: 'Boissons chaudes / Bières', ordre_affichage: 2, jours_rotation: null };
const catCigarettes = { nom: 'Cigarettes', ordre_affichage: 3, jours_rotation: null };

const produits = [
  // Huiles & lave-glace : 100% comptage_deux_lieux — catégorie homogène,
  // ne doit JAMAIS être scindée.
  { id: 'huile1', designation: 'Huile 5W40', ordre_affichage: 1, comptage_deux_lieux: true, inventaire_categories: catHuiles },
  { id: 'huile2', designation: 'Lave-glace', ordre_affichage: 2, comptage_deux_lieux: true, inventaire_categories: catHuiles },
  // Boissons chaudes / Bières : MIXTE — bières en deux lieux, café/chocolat
  // en un seul lieu (boutique).
  { id: 'biere1', designation: 'Heineken 25cl', ordre_affichage: 10, comptage_deux_lieux: true, inventaire_categories: catBoissons },
  { id: 'biere2', designation: 'Desperados 33cl', ordre_affichage: 11, comptage_deux_lieux: true, inventaire_categories: catBoissons },
  { id: 'cafe1', designation: 'Café dosette', ordre_affichage: 12, comptage_deux_lieux: false, inventaire_categories: catBoissons },
  { id: 'choco1', designation: 'Chocolat chaud', ordre_affichage: 13, comptage_deux_lieux: false, inventaire_categories: catBoissons },
  // Cigarettes : 100% normale — catégorie homogène, jamais scindée.
  { id: 'cig1', designation: 'Marlboro rouge', ordre_affichage: 20, comptage_deux_lieux: false, inventaire_categories: catCigarettes },
];

const groupes = grouperParCategorie(produits);

// 1) Huiles & lave-glace reste un seul groupe (catégorie homogène).
const groupesHuiles = groupes.filter(g => g.nom.startsWith('Huiles'));
assert.strictEqual(groupesHuiles.length, 1, 'Huiles & lave-glace (100% deux-lieux) ne doit jamais être scindée');
assert.strictEqual(groupesHuiles[0].items.length, 2);
console.log('OK — catégorie homogène "deux lieux" (Huiles) : un seul groupe, comportement inchangé.');

// 2) Cigarettes reste un seul groupe (catégorie homogène normale).
const groupesCig = groupes.filter(g => g.nom.startsWith('Cigarettes'));
assert.strictEqual(groupesCig.length, 1, 'Cigarettes (0% deux-lieux) ne doit jamais être scindée');
console.log('OK — catégorie homogène normale (Cigarettes) : un seul groupe, comportement inchangé.');

// 3) Boissons chaudes / Bières est scindée en exactement 2 groupes.
const groupesBoissons = groupes.filter(g => g.nom.startsWith('Boissons'));
assert.strictEqual(groupesBoissons.length, 2, 'Catégorie mixte doit produire exactement 2 groupes');
const groupeDepotBoissons = groupesBoissons.find(g => g.nom === 'Boissons chaudes / Bières');
const groupeResteBoissons = groupesBoissons.find(g => g.nom === 'Boissons chaudes / Bières — reste');
assert.ok(groupeDepotBoissons, 'Le sous-groupe "dépôt" garde le nom de catégorie tel quel');
assert.ok(groupeResteBoissons, 'Le sous-groupe "reste" est suffixé "— reste"');
// (comparaison par chaîne jointe plutôt que deepStrictEqual sur les
// tableaux : ces tableaux proviennent d'un contexte vm.runInNewContext
// distinct, donc un Array littéral du contexte principal n'est jamais
// reference-equal malgré un contenu strictement identique — faux négatif
// connu de assert.deepStrictEqual en mode "strict" à travers deux realms.)
assert.strictEqual(groupeDepotBoissons.items.map(p => p.id).join(','), 'biere1,biere2', 'Le sous-groupe dépôt ne contient QUE les produits comptage_deux_lieux');
assert.strictEqual(groupeResteBoissons.items.map(p => p.id).join(','), 'cafe1,choco1', 'Le sous-groupe reste ne contient QUE les produits normaux (jamais le café mélangé aux bières)');
console.log('OK — catégorie mixte (Boissons chaudes/Bières) scindée en 2 : dépôt (bières seules) + reste (café/chocolat), jamais mélangés.');

// 4) Le sous-groupe reste se classe TOUJOURS juste après son sous-groupe
//    dépôt (ordre +0.5), jamais avant, quel que soit l'ordre_affichage des
//    produits eux-mêmes.
assert.ok(groupeResteBoissons.ordre > groupeDepotBoissons.ordre, 'Le sous-groupe reste doit toujours suivre son sous-groupe dépôt');
assert.strictEqual(groupeResteBoissons.ordre, groupeDepotBoissons.ordre + 0.5);
console.log('OK — le sous-groupe "reste" est toujours ordonné juste après son sous-groupe "dépôt".');

// ------------------------------------------------------------
// 5) Parcours complet : Huiles (dépôt) → Bières (dépôt) → [rattrapage
//    boutique, géré ailleurs] → Boissons — reste → Cigarettes.
//    ordonnerParcoursDepotBoutiqueReste doit produire exactement cet ordre.
// ------------------------------------------------------------
const parcours = ordonnerParcoursDepotBoutiqueReste(groupes);
const noms = parcours.map(g => g.nom).join(' | ');
assert.strictEqual(noms, [
  'Huiles & lave-glace',
  'Boissons chaudes / Bières',
  'Boissons chaudes / Bières — reste',
  'Cigarettes',
].join(' | '), 'Ordre exact attendu : Huiles (dépôt) → Bières (dépôt) → reste Boissons (après rattrapage boutique) → Cigarettes');
console.log('OK — parcours complet dans l\'ordre exact demandé par Frédéric : Huiles dépôt → Bières dépôt → reste Boissons → suite du parcours.');

// 6) Régression : sans aucune catégorie mixte, le comportement est
//    identique à l'ancien grouperParCategorie (un groupe par catégorie).
const produitsSimples = [
  { id: 'a', designation: 'A', ordre_affichage: 1, comptage_deux_lieux: false, inventaire_categories: { nom: 'Épicerie', ordre_affichage: 5, jours_rotation: null } },
  { id: 'b', designation: 'B', ordre_affichage: 2, comptage_deux_lieux: false, inventaire_categories: { nom: 'Épicerie', ordre_affichage: 5, jours_rotation: null } },
];
const groupesSimples = grouperParCategorie(produitsSimples);
assert.strictEqual(groupesSimples.length, 1);
assert.strictEqual(groupesSimples[0].items.length, 2);
console.log('OK — régression : aucune catégorie mixte -> comportement strictement identique à avant (un groupe par catégorie).');

console.log('\nTous les tests "catégorie mixte deux lieux" passent.');
