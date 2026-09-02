// Test — Synchronisation "Ordre de jaugeage" avec les noms de réservoirs
// (16/08/2026, demande de Frédéric : "l'ordre de jaugeage doit reprendre
// les noms des réservoirs donnés pour être sûr de ne pas avoir de
// confusion" — jusqu'ici la liste "Ordre de jaugeage (Veeder-Root)" dans
// Paramètres Station restait figée sur les noms chargés au démarrage de la
// page et ne se mettait jamais à jour après un renommage/enregistrement
// des réservoirs dans "Cuves & capacités carburants", sans recharger toute
// la page).
//
// Extrait la fonction réelle synchroniserOrdreCuvesAvecConfig de
// NEXUS-Parametres-Station-v1.html via regex (jamais réécrite à la main),
// comme tous les tests de ce module. Consomme le vrai
// NexusReceptionMoteur.construireListeCuvesOrdonnee (require() direct,
// aucun mock) pour vérifier le comportement bout en bout.

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

require(__dirname + '/nexus-reception-moteur.js');
const NexusReceptionMoteur = global.NexusReceptionMoteur;

const html = fs.readFileSync(__dirname + '/NEXUS-Parametres-Station-v1.html', 'utf8');
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

function nouveauContexte() {
  // renderReceptionOrdreCuves() manipule le DOM réel (document.getElementById)
  // — hors de propos pour ce test, qui vérifie uniquement le RECALCUL de la
  // liste. On la remplace par un stub qui compte ses appels, exactement
  // comme la fonction réelle le ferait (aucune logique de test dans le
  // fichier réel n'est contournée, seul le rendu DOM est stubé).
  const ctx = {
    globalThis: {},
    console,
    NexusReceptionMoteur,
    RECEPTION_ORDRE_CUVES_ACTUEL: [],
    renderReceptionOrdreCuves: () => { ctx.__renderAppele = (ctx.__renderAppele || 0) + 1; },
  };
  ctx.globalThis = ctx;
  const src = [
    extraire('synchroniserOrdreCuvesAvecConfig'),
    'globalThis.__test = synchroniserOrdreCuvesAvecConfig;',
  ].join('\n\n');
  vm.runInNewContext(src, ctx);
  return ctx;
}

// ------------------------------------------------------------
// 1) Renommer un réservoir déjà présent dans l'ordre choisi doit se
//    refléter immédiatement, SANS changer l'ordre déjà choisi par le
//    manager.
// ------------------------------------------------------------
(() => {
  const ctx = nouveauContexte();
  ctx.RECEPTION_ORDRE_CUVES_ACTUEL = [
    { id: 'unique', label: 'Réservoir 1', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Réservoir 3', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Réservoir 2', capacite: 10000, carburant: 'go' },
    { id: 'unique', label: 'Réservoir 4', capacite: 30000, carburant: 'gnr' },
  ];
  const configRenomme = {
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Rés. 1', capacite: 30000 }] },
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Rés. 3', capacite: 20000 }, { id: 'cuve2', label: 'Rés. 2', capacite: 10000 }] },
    gnr: { actif: true, label: 'Gasoil non routier (GNR)', cuves: [{ id: 'unique', label: 'Rés. 4', capacite: 30000 }] },
  };
  ctx.__test(configRenomme);
  const noms = ctx.RECEPTION_ORDRE_CUVES_ACTUEL.map(cu => cu.label).join(' | ');
  assert.strictEqual(noms, 'Rés. 1 | Rés. 3 | Rés. 2 | Rés. 4', 'Les nouveaux noms doivent apparaître, dans le MÊME ordre déjà choisi (SP95, GO cuve1, GO cuve2, GNR)');
  assert.strictEqual(ctx.__renderAppele, 1, 'La liste doit être re-rendue après synchronisation');
  console.log('OK — renommer un réservoir met à jour "Ordre de jaugeage" en conservant l\'ordre déjà choisi.');
})();

// ------------------------------------------------------------
// 2) Désactiver un carburant retire aussitôt ses réservoirs de la liste.
// ------------------------------------------------------------
(() => {
  const ctx = nouveauContexte();
  ctx.RECEPTION_ORDRE_CUVES_ACTUEL = [
    { id: 'unique', label: 'Rés. 1', capacite: 30000, carburant: 'sp95' },
    { id: 'cuve1', label: 'Rés. 3', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Rés. 2', capacite: 10000, carburant: 'go' },
    { id: 'unique', label: 'Rés. 4', capacite: 30000, carburant: 'gnr' },
  ];
  const configGnrDesactive = {
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Rés. 1', capacite: 30000 }] },
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Rés. 3', capacite: 20000 }, { id: 'cuve2', label: 'Rés. 2', capacite: 10000 }] },
    gnr: { actif: false, label: 'Gasoil non routier (GNR)', cuves: [{ id: 'unique', label: 'Rés. 4', capacite: 30000 }] },
  };
  ctx.__test(configGnrDesactive);
  const carburants = ctx.RECEPTION_ORDRE_CUVES_ACTUEL.map(cu => cu.carburant);
  assert.ok(!carburants.includes('gnr'), 'Un carburant désactivé ne doit plus apparaître dans "Ordre de jaugeage"');
  assert.strictEqual(ctx.RECEPTION_ORDRE_CUVES_ACTUEL.length, 3);
  console.log('OK — désactiver un carburant le retire aussitôt de "Ordre de jaugeage".');
})();

// ------------------------------------------------------------
// 3) Réactiver un carburant l'ajoute en FIN de liste, sans perturber
//    l'ordre déjà choisi pour les autres.
// ------------------------------------------------------------
(() => {
  const ctx = nouveauContexte();
  ctx.RECEPTION_ORDRE_CUVES_ACTUEL = [
    { id: 'cuve1', label: 'Rés. 3', capacite: 20000, carburant: 'go' },
    { id: 'cuve2', label: 'Rés. 2', capacite: 10000, carburant: 'go' },
    { id: 'unique', label: 'Rés. 1', capacite: 30000, carburant: 'sp95' },
  ]; // GNR n'était pas encore dans l'ordre (désactivé jusqu'ici)
  const configGnrReactive = {
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Rés. 1', capacite: 30000 }] },
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Rés. 3', capacite: 20000 }, { id: 'cuve2', label: 'Rés. 2', capacite: 10000 }] },
    gnr: { actif: true, label: 'Rés. 4', cuves: [{ id: 'unique', label: 'Rés. 4', capacite: 30000 }] },
  };
  ctx.__test(configGnrReactive);
  const noms = ctx.RECEPTION_ORDRE_CUVES_ACTUEL.map(cu => cu.label).join(' | ');
  assert.strictEqual(noms, 'Rés. 3 | Rés. 2 | Rés. 1 | Rés. 4', 'Le carburant réactivé doit être ajouté en fin de liste, sans réordonner les autres');
  console.log('OK — réactiver un carburant l\'ajoute en fin de liste sans perturber l\'ordre déjà choisi.');
})();

// ------------------------------------------------------------
// 4) Régression : appelée sur un ordre déjà vide (première visite de la
//    page, avant tout chargement), ne plante jamais — reconstruit l'ordre
//    par défaut à partir de la config.
// ------------------------------------------------------------
(() => {
  const ctx = nouveauContexte();
  ctx.RECEPTION_ORDRE_CUVES_ACTUEL = [];
  const config = {
    sp95: { actif: true, label: 'Sans plomb (SP95)', cuves: [{ id: 'unique', label: 'Rés. 1', capacite: 30000 }] },
    go: { actif: true, label: 'Gasoil (GO)', cuves: [{ id: 'cuve1', label: 'Rés. 3', capacite: 20000 }, { id: 'cuve2', label: 'Rés. 2', capacite: 10000 }] },
    gnr: { actif: true, label: 'Rés. 4', cuves: [{ id: 'unique', label: 'Rés. 4', capacite: 30000 }] },
  };
  assert.doesNotThrow(() => ctx.__test(config));
  assert.strictEqual(ctx.RECEPTION_ORDRE_CUVES_ACTUEL.length, 4);
  console.log('OK — régression : appel sur un ordre vide ne plante jamais, reconstruit à partir de la config.');
})();

console.log('\nTous les tests "synchronisation Ordre de jaugeage" passent.');
