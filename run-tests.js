#!/usr/bin/env node
// Lanceur de la suite de non-régression NEXUS.
//   node run-tests.js              → toute la suite
//   node run-tests.js carburant    → seulement les tests dont le nom contient "carburant"
// Chaque fichier test_*.js est un script autonome : il réussit s'il sort en code 0.

const { execFileSync } = require('child_process');
const fs = require('fs');

const filtre = process.argv[2] || '';
const fichiers = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .filter(f => f.includes(filtre))
  .sort();

if (!fichiers.length) {
  console.error(`Aucun test ne correspond à « ${filtre} ».`);
  process.exit(1);
}

const echecs = [];
for (const f of fichiers) {
  try {
    execFileSync('node', [f], { cwd: __dirname, timeout: 30000, stdio: 'pipe' });
    process.stdout.write('.');
  } catch (e) {
    const sortie = `${e.stdout || ''}${e.stderr || ''}`;
    const cause = (sortie.match(/(?:[A-Za-z]*Error|Cannot find module)[^\n]{0,90}/) || ['sortie non nulle'])[0];
    echecs.push({ f, cause });
    process.stdout.write('x');
  }
}

const total = fichiers.length;
console.log(`\n\n${total - echecs.length}/${total} tests passent.`);
if (echecs.length) {
  console.log(`\n${echecs.length} en échec :`);
  for (const { f, cause } of echecs) console.log(`  ${f}\n    ${cause}`);
}
process.exit(echecs.length ? 1 : 0);
