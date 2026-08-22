// Test — API publique de nexus-periodes.js (22/08/2026, correctif v2.217).
//
// Origine : Brief NEXUS restait bloqué sur son écran de chargement pour
// tout site avec un jour Carburants incomplet, à cause d'un
// `TypeError: global.NexusPeriodes.ajouterJours is not a function`.
// `ajouterJours` existait bien dans nexus-periodes.js, utilisée en interne
// depuis toujours, mais n'avait jamais été ajoutée à l'objet exporté
// `global.NexusPeriodes` — jusqu'à ce que `chargerCarburantsBriefAvecFallback`
// (nexus-brief-donnees.js, v2.215) l'appelle depuis l'extérieur du module.
//
// Ce test couvre deux niveaux :
//  1. Le cas précis qui a cassé Brief (ajouterJours exportée + comportement).
//  2. Un balayage GÉNÉRIQUE de tout le projet : chaque appel
//     `NexusPeriodes.xxx(` trouvé dans un fichier .js/.html doit
//     correspondre à une fonction RÉELLEMENT exportée — empêche la même
//     classe de bug (fonction interne appelée depuis l'extérieur sans être
//     publiée) de se reproduire silencieusement, pour n'importe quelle
//     fonction de ce module, dans n'importe quel fichier futur.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-periodes.js'));
const P = global.NexusPeriodes;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Le cas précis du bug du 22/08/2026.
// ------------------------------------------------------------
assert.strictEqual(typeof P.ajouterJours, 'function', 'ajouterJours doit être exportée — sans quoi tout Brief NEXUS se bloque dès qu\'un fallback Carburants est nécessaire (v2.215/v2.217)');
ok('NexusPeriodes.ajouterJours est bien exportée publiquement');

assert.strictEqual(P.ajouterJours('2026-08-22', -1), '2026-08-21');
assert.strictEqual(P.ajouterJours('2026-01-01', -1), '2025-12-31', 'Franchissement d\'année correct');
assert.strictEqual(P.ajouterJours('2026-03-01', -1), '2026-02-28', 'Franchissement de mois correct (2026 non bissextile)');
assert.strictEqual(P.ajouterJours('2026-08-20', 2), '2026-08-22');
ok('ajouterJours calcule correctement J-1/J+n, y compris les franchissements de mois/année');

// ------------------------------------------------------------
// 2) Balayage générique de tout le projet — empêche la même classe de bug
//    de se reproduire pour n'importe quelle fonction de ce module.
// ------------------------------------------------------------
const fichiers = fs.readdirSync(PROJET).filter(f => (f.endsWith('.js') || f.endsWith('.html')) && f !== 'nexus-periodes.js' && f !== path.basename(__filename));
const appelsTrouves = new Map(); // nom -> [fichiers l'appelant]
const regex = /NexusPeriodes\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
fichiers.forEach(f => {
  const contenu = fs.readFileSync(path.join(PROJET, f), 'utf8');
  let m;
  while ((m = regex.exec(contenu))) {
    const nom = m[1];
    if (!appelsTrouves.has(nom)) appelsTrouves.set(nom, []);
    if (!appelsTrouves.get(nom).includes(f)) appelsTrouves.get(nom).push(f);
  }
});
assert.ok(appelsTrouves.size > 0, 'Le balayage doit trouver au moins un appel réel à NexusPeriodes dans le projet (sinon ce test ne teste rien)');
appelsTrouves.forEach((fichiersAppelants, nom) => {
  assert.strictEqual(typeof P[nom], 'function', `NexusPeriodes.${nom} est appelée dans ${fichiersAppelants.join(', ')} mais n'est pas exportée par nexus-periodes.js`);
});
ok(`Balayage complet du projet : ${appelsTrouves.size} fonction(s) NexusPeriodes appelée(s) depuis l'extérieur, toutes réellement exportées (${[...appelsTrouves.keys()].join(', ')})`);

console.log(`\n${n}/${n} tests passés — API publique NexusPeriodes.`);
