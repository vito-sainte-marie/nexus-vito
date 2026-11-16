// Lot « Classification du tabac » : prix réglementé par rayons nommés, accessoires et vapotage restent à marge libre.
const assert = require('assert'); const fs = require('fs'); const vm = require('vm'); const path = require('path');
let n = 0; const t = (nom, f) => { f(); n++; console.log('OK ' + nom); };
const sb = { console }; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-marge.js'), 'utf8'), sb);
const F = sb.NexusMarge.familleMarge;
const exclue = (c, a) => F(c, a).exclue;
t('rayons de tabac manufacturé : prix réglementé', () => {
  [['Pot Tabac', 'Camel MYO pot 30g'], ['Pot Tabac', 'Kingston pot'], ['Cigares', 'Principes'], ['Cigares', 'Club Master'],
   ['Cigares', 'La Paz cigarillo'], ['Cigarettes', 'Marlboro'], ['Tabac à rouler 30 g', 'Drum 30g'], ['Tabac Ã  rouler 30 g', 'Samson 30g'],
   ['Paquet de 20', 'Marlboro'], ['Paquet de 25', 'X'], ['Paquet de 30', 'Y']].forEach(([c, a]) => assert.strictEqual(exclue(c, a), true, c + ' / ' + a));
});
t('accessoires du rayon tabac : marge libre', () => {
  [['Tabac à rouler 30 g', 'Papier Rizla'], ['Tabac Ã  rouler 30 g', 'Gizeh slim'], ['Tabac à rouler', 'Feuille OCB'], ['Tabac à rouler', 'Filtres 6mm'], ['Tabac à rouler', 'Tubes']]
    .forEach(([c, a]) => assert.strictEqual(exclue(c, a), false, c + ' / ' + a));
});
t('défauts de recette 6904184510 : mots entiers, cigares sans test d’accessoire', () => {
  assert.strictEqual(exclue('Cigares', 'Signature Piccolini Beige Filtre - P 10'), true);
  assert.strictEqual(exclue('Cigares', 'Signature Piccolini Green filter'), true);
  assert.strictEqual(exclue('Tabac à rouler 30 g', 'Tabac Kingston à tuber 30g -10P'), true);
  assert.strictEqual(exclue('Tabac à rouler 30 g', 'Tubes OCB'), false);
  assert.strictEqual(exclue('Pot Tabac', 'Clipper'), false);
});
t('vapotage et CBD restent à marge libre', () => {
  [['E-liquides', 'Fruits rouges'], ['PUFFS', 'Puff 600'], ['Kits WPUFF', 'kit'], ['CBD', 'Fleur CBD']].forEach(([c, a]) => assert.strictEqual(exclue(c, a), false, c));
});
t('gaz et cartes prépayées inchangés (prix imposé), briquets libres', () => {
  assert.strictEqual(exclue('Gaz', 'Gaz bleu'), true);
  assert.strictEqual(exclue('Cartes prépayées', 'Transcash'), true);
  assert.strictEqual(exclue('Accesoires - Briquets - Gaz', 'Briquet'), false);
});
t('rayon de tabac inconnu : « à classer », jamais classé d’office', () => {
  const f = F('Tabac à chiquer', 'Boite'); assert.strictEqual(f.exclue, false); assert.strictEqual(f.aClasser, true);
  assert.strictEqual(F('Chicha', 'Tuyau').aClasser, true);
  assert.ok(!F('Cigares', 'X').aClasser && !F('Pot Tabac', 'X').aClasser && !F('Snacking', 'X').aClasser && !F('E-liquides', 'X').aClasser);
});
t('exclusion manuelle toujours prioritaire', () => { assert.strictEqual(F('Snacking', 'Chips', new Set(['Chips'])).id, 'exclusion-manuelle'); });
console.log(n + ' tests OK');
