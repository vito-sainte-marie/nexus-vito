// Régression — cigarettes : employé = caisse uniquement, manager = bureau.
require(__dirname + '/nexus-inventaire-moteur.js');
const assert = require('assert');
const M = globalThis.NexusInventaireMoteur;

assert.strictEqual(M.modeComptageLieuEmploye({
  comptage_deux_lieux: true,
  inventaire_categories: { nom: 'Cigarettes' },
}), 'caisse_uniquement', 'Les cigarettes ne doivent jamais être présentées deux fois à la caissière');

assert.strictEqual(M.modeComptageLieuEmploye({
  comptage_deux_lieux: true,
  inventaire_categories: { nom: 'Huiles' },
}), 'deux_lieux', 'Les autres produits réellement multi-lieux gardent le parcours dépôt + boutique');

assert.strictEqual(M.modeComptageLieuEmploye({
  comptage_deux_lieux: false,
  inventaire_categories: { nom: 'Journaux' },
}), 'un_lieu');

console.log('OK — cigarettes comptées une seule fois en caisse par l’employé ; bureau réservé au manager.');
