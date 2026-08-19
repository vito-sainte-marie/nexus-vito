// Test — Sprint 4 "UX Flash" (17/08/2026, cahier Inventaire 2.0 §10/§10.1,
// recette INV2-15 et INV2-16).
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

// ------------------------------------------------------------
// PARTIE 1 — Calculatrice inline étendue (+ − × ÷), INV2-15.
// ------------------------------------------------------------
const srcCalc = [
  extraire('evaluerAdditionChainee'),
  'globalThis.__test = { evaluerAdditionChainee };',
].join('\n\n');

const vm = require('vm');
const ctxCalc = { globalThis: {}, console };
ctxCalc.globalThis = ctxCalc;
vm.runInNewContext(srcCalc, ctxCalc);
const { evaluerAdditionChainee } = ctxCalc.__test;

// Exemple exact du cahier §10.1 / recette INV2-15 : "3 x 24 + 5" -> 77.
assert.strictEqual(evaluerAdditionChainee('3 x 24 + 5'), 77, 'Exemple cahier "3 x 24 + 5" doit produire 77');
assert.strictEqual(evaluerAdditionChainee('3×24+5'), 77, 'Symbole × (sans espaces) doit aussi produire 77');
assert.strictEqual(evaluerAdditionChainee('3X24+5'), 77, 'X majuscule accepté comme opérateur de multiplication');
console.log('OK — "3 x 24 + 5" (et variantes ×/X) produit 77, exactement l\'exemple du cahier §10.1.');

// Priorité des opérations : multiplication avant addition, même avec
// plusieurs termes.
assert.strictEqual(evaluerAdditionChainee('2+3*4'), 14, '2+3*4 doit respecter la priorité (2 + 12 = 14), jamais (2+3)*4');
assert.strictEqual(evaluerAdditionChainee('10-2*3+1'), 5, '10-2*3+1 = 10-6+1 = 5');
console.log('OK — priorité multiplication/division avant addition/soustraction respectée.');

// Division.
assert.strictEqual(evaluerAdditionChainee('10/2+1'), 6, '10/2+1 = 5+1 = 6');
assert.ok(Number.isNaN(evaluerAdditionChainee('10/0')), 'Division par zéro doit renvoyer NaN, jamais Infinity ni planter');
console.log('OK — division fonctionne, division par zéro protégée (NaN, pas de crash).');

// Décimales avec virgule française.
assert.strictEqual(evaluerAdditionChainee('1,5+2,5'), 4, 'Virgule française acceptée comme séparateur décimal');
console.log('OK — décimales avec virgule française acceptées.');

// Symbole ÷ et : comme division.
assert.strictEqual(evaluerAdditionChainee('20÷4'), 5, 'Symbole ÷ accepté');
assert.strictEqual(evaluerAdditionChainee('20:4'), 5, 'Symbole : accepté comme division');
console.log('OK — symboles ÷ et : acceptés pour la division.');

// Cas vides / invalides -> NaN, jamais d'exception (Article 5 — pas de
// précision fabriquée, jamais d'eval()).
assert.ok(Number.isNaN(evaluerAdditionChainee('')), 'Chaîne vide -> NaN');
assert.ok(Number.isNaN(evaluerAdditionChainee(null)), 'null -> NaN');
assert.ok(Number.isNaN(evaluerAdditionChainee('abc')), 'Texte non numérique -> NaN');
assert.ok(Number.isNaN(evaluerAdditionChainee('3+')), 'Opérateur en attente sans opérande -> NaN');
console.log('OK — entrées vides/invalides renvoient NaN sans exception (jamais eval()).');

// Régression : addition/soustraction simple en chaîne (comportement déjà
// existant avant Sprint 4) reste identique.
assert.strictEqual(evaluerAdditionChainee('10+5-2'), 13, 'Addition/soustraction en chaîne inchangée');
assert.strictEqual(evaluerAdditionChainee('-5+10'), 5, 'Nombre négatif en tête de chaîne toujours accepté');
console.log('OK — régression : addition/soustraction en chaîne simple inchangée.');

console.log('\nPartie 1 (calculatrice INV2-15) : tous les tests passent.\n');

// ------------------------------------------------------------
// PARTIE 2 — En-tête "Étape N/M" + parcours auto-chaîné, INV2-15/16.
// ------------------------------------------------------------
const srcParcours = [
  'let produitsZone = [];',
  'let modeJaugeageActif = false;',
  'let quartActuel = "soir";',
  'let comptagesSaisie = {};',
  // Production journalière (18/08/2026, M2) : profilParProduit vide = aucun
  // produit de ce profil dans ce test, comportement historique inchangé —
  // ajouté ici uniquement parce que produitsZoneOuverturePourQuart() (ajoutée
  // par M2) est maintenant appelée depuis groupesParcoursOuverture().
  'let profilParProduit = {};',
  `const CARROUSEL_SEUIL = ${6};`,
  `const JAUGEAGE_NOM = 'Jaugeage Carburant';`,
  extraire('grouperParCategorie'),
  extraire('ordonnerParcoursDepotBoutiqueReste'),
  extraire('produitsZoneOuverturePourQuart'),
  extraire('groupesParcoursOuverture'),
  extraire('produitsRequis'),
  extraire('produitEstCompte'),
  extraire('categorieEstTerminee'),
  extraire('libelleEtapeParcours'),
  `globalThis.__test = {
    setProduitsZone: (v) => { produitsZone = v; },
    setComptagesSaisie: (v) => { comptagesSaisie = v; },
    setModeJaugeage: (actif, quart) => { modeJaugeageActif = actif; quartActuel = quart; },
    groupesParcoursOuverture, libelleEtapeParcours, categorieEstTerminee,
    grouperParCategorie, ordonnerParcoursDepotBoutiqueReste,
  };`,
].join('\n\n');

const ctxParcours = { globalThis: {}, console };
ctxParcours.globalThis = ctxParcours;
vm.runInNewContext(srcParcours, ctxParcours);
const T = ctxParcours.__test;

const catHuiles = { nom: 'Huiles & lave-glace', ordre_affichage: 1, jours_rotation: null };
const catBoissons = { nom: 'Boissons chaudes / Bières', ordre_affichage: 2, jours_rotation: null };
const catCigarettes = { nom: 'Cigarettes', ordre_affichage: 3, jours_rotation: null };

const produits = [
  { id: 'huile1', designation: 'Huile 5W40', ordre_affichage: 1, comptage_deux_lieux: false, inventaire_categories: catHuiles },
  { id: 'biere1', designation: 'Heineken 25cl', ordre_affichage: 10, comptage_deux_lieux: false, inventaire_categories: catBoissons },
  { id: 'biere2', designation: 'Desperados 33cl', ordre_affichage: 11, comptage_deux_lieux: false, inventaire_categories: catBoissons },
  { id: 'cig1', designation: 'Marlboro rouge', ordre_affichage: 20, comptage_deux_lieux: false, inventaire_categories: catCigarettes },
];
T.setProduitsZone(produits);
T.setComptagesSaisie({});

// Format d'en-tête exact demandé par le cahier §10 : "Étape 2/7 - Dépôt
// Bières - 12 produits restants" (structure : Étape N/M — Nom — X restants).
const groupes = T.grouperParCategorie(produits);
const groupeBoissons = groupes.find(g => g.nom === 'Boissons chaudes / Bières');
const libelle1 = T.libelleEtapeParcours(groupeBoissons);
assert.strictEqual(libelle1.titre, 'Étape 2/3 — Boissons chaudes / Bières', 'Étape 2/3 attendue (Huiles=1, Boissons=2, Cigarettes=3)');
assert.strictEqual(libelle1.sousTitre, '2 produits restants', 'Les 2 bières sont comptées comme restantes tant qu\'aucune n\'est saisie');
console.log('OK — en-tête "Étape N/M — Catégorie — X produits restants" conforme au format du cahier §10.');

// Une fois un produit saisi, le compteur de restants diminue sans changer
// le numéro d'étape (Article 11 — une seule source de vérité, jamais
// recalculée différemment ailleurs).
T.setComptagesSaisie({ biere1: { compte: 10, ecartNonNul: false, justification: '' } });
const libelle2 = T.libelleEtapeParcours(groupeBoissons);
assert.strictEqual(libelle2.sousTitre, '1 produit restant', 'Un seul produit restant, singulier correct');
console.log('OK — le compteur de produits restants se met à jour dès qu\'un produit est saisi (singulier/pluriel corrects).');

// INV2-16 — reprise : la même logique de recherche que
// demarrerOuvertureComptage() (groupesPourParcours.find + catégorie non
// terminée) retrouve exactement la bonne catégorie à partir d'une position
// sauvegardée, et rejette une position périmée (catégorie déjà terminée).
T.setComptagesSaisie({});
const { groupesPourParcours: gpp1 } = T.groupesParcoursOuverture();
const positionValide = { categorieNom: 'Boissons chaudes / Bières', carrouselIndex: null };
const groupeRetrouve = gpp1.find(g => g.nom === positionValide.categorieNom);
assert.ok(groupeRetrouve && !T.categorieEstTerminee(groupeRetrouve.items), 'Position valide -> catégorie retrouvée et non terminée, reprise possible');
console.log('OK — INV2-16 : une position de reprise valide retrouve la bonne catégorie, encore à faire.');

// Catégorie déjà entièrement comptée entre-temps (ex. terminée sur un autre
// appareil, ou par une action manager) : la reprise doit se dégrader
// gracieusement vers la grille de catégories plutôt que de rouvrir une
// catégorie déjà finie.
T.setComptagesSaisie({ huile1: { compte: 5, ecartNonNul: false, justification: '' } });
const { groupesPourParcours: gpp2 } = T.groupesParcoursOuverture();
const groupeHuiles = gpp2.find(g => g.nom === 'Huiles & lave-glace');
assert.ok(groupeHuiles && T.categorieEstTerminee(groupeHuiles.items), 'Huiles (1 seul produit, déjà compté) doit être considérée terminée');
console.log('OK — INV2-16 : une position pointant vers une catégorie déjà terminée est correctement détectée (dégradation gracieuse attendue côté appelant).');

// Position pointant vers une catégorie inexistante (plan changé entre deux
// sessions) : recherche renvoie undefined, jamais d'exception.
const groupeInexistant = gpp2.find(g => g.nom === 'Catégorie disparue');
assert.strictEqual(groupeInexistant, undefined, 'Catégorie disparue -> undefined, sans exception');
console.log('OK — INV2-16 : une catégorie qui n\'existe plus dans le parcours ne fait pas planter la recherche de reprise.');

console.log('\nPartie 2 (en-tête + reprise INV2-16) : tous les tests passent.\n');

console.log('Tous les tests "Sprint 4 UX Flash" passent.');
