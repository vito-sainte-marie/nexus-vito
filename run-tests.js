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
    // 30 s suffisaient tant qu'aucune épreuve ne lisait le vrai dépôt. Le
    // 08/09/2026, `test_producteur_evenements_live` est monté à 25 s : cinq
    // appels à `produire()` et deux lancements du CLI, chacun parcourant l'état
    // git de 22 branches et 250 commits. Une épreuve à 25 s d'une limite de 30
    // n'échoue pas : elle échoue UN JOUR, au hasard de la charge, et on la
    // croit instable plutôt que mal calibrée. La limite reste franche — elle
    // arrête toujours une épreuve qui boucle.
    execFileSync('node', [f], { cwd: __dirname, timeout: 90000, stdio: 'pipe' });
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
