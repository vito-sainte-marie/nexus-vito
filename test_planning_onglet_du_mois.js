// Règle « mois → onglet » du classeur de planning (03/09/2026).
//
// Le classeur « Planning Energy 2026 » porte un onglet par site et par mois :
// SMU09 en septembre, SMU10 en octobre. Le préfixe est DÉCLARÉ dans
// station_config.planning_onglet_prefixe — jamais déduit du nom du site
// (article 5). Cette règle doit être écrite une seule fois (article 11) :
// l'écran de paramétrage l'emprunte au moteur, il ne la recopie pas.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-planning-sheets-moteur.js'), 'utf8'), ctx);
const { ongletDuMois, normaliserPrefixeOnglet } = ctx.NexusPlanningSheets;

// --- Le mois est toujours sur deux chiffres ---
assert.strictEqual(ongletDuMois('SMU', new Date(2026, 8, 3)), 'SMU09', 'septembre → SMU09');
assert.strictEqual(ongletDuMois('SMU', new Date(2026, 9, 1)), 'SMU10', 'octobre → SMU10');
assert.strictEqual(ongletDuMois('SMU', new Date(2026, 0, 31)), 'SMU01', 'janvier → SMU01');
assert.strictEqual(ongletDuMois('SMU', new Date(2026, 11, 31)), 'SMU12', 'décembre → SMU12');

// --- Le préfixe est une convention de classeur, pas une donnée devinée ---
assert.strictEqual(ongletDuMois('', new Date(2026, 8, 3)), '', 'sans préfixe déclaré, aucun onglet');
assert.strictEqual(ongletDuMois(null, new Date(2026, 8, 3)), '', 'null ne devient pas un onglet');
assert.strictEqual(ongletDuMois('SMU', new Date('pas une date')), '', 'une date invalide ne produit pas un onglet');

// --- Le préfixe est réduit à ce qu'un nom d'onglet peut contenir ---
assert.strictEqual(normaliserPrefixeOnglet(' smu '), 'SMU', 'espaces et casse normalisés');
assert.strictEqual(normaliserPrefixeOnglet('SM-U_1'), 'SM-U_1', 'tiret et souligné conservés');
assert.strictEqual(normaliserPrefixeOnglet('<b>SMU</b>'), 'BSMUB', 'aucun caractère HTML ne survit');
assert.strictEqual(normaliserPrefixeOnglet('A'.repeat(40)).length, 12, 'préfixe borné à 12 caractères');

// --- L'écran de paramétrage emprunte la règle, il ne la recopie pas ---
const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Parametres-Station-v1.html'), 'utf8');
assert.ok(
  /nexus-planning-sheets-moteur\.js/.test(ecran),
  "NEXUS-Parametres-Station-v1.html doit charger nexus-planning-sheets-moteur.js",
);
assert.ok(
  /const ongletDuMois = window\.NexusPlanningSheets\.ongletDuMois/.test(ecran),
  "l'écran doit emprunter ongletDuMois au moteur",
);
assert.ok(
  !/function ongletDuMois\s*\(/.test(ecran),
  "l'écran ne doit pas redéfinir sa propre règle mois → onglet (article 11)",
);

console.log('ok — règle mois → onglet unique et bornée');
