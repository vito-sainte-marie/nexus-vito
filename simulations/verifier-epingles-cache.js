// Garde-fou : une épingle de cache ne doit jamais être plus ancienne que le
// fichier qu'elle sert.
//
// Pourquoi ce contrôle existe : le 02/09/2026, deux correctifs déployés sur
// GitHub sont restés invisibles dans le navigateur parce que leurs URL
// portaient encore l'horodatage de la veille — le fichier était corrigé en
// ligne, mais Safari resservait la copie épinglée. Une correction qu'on
// croit livrée et qui ne l'est pas coûte plus cher que pas de correction du
// tout : on cherche ailleurs.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');

const fichiers = fs.readdirSync(RACINE).filter(f => f.endsWith('.js') || f.endsWith('.html'));
const motif = /([A-Za-z0-9._-]+\.js)\?v=(\d{8})-(\d{4})/g;

const epingles = new Map(); // fichier servi -> { stamp, depuis }
for (const f of fichiers) {
  const s = fs.readFileSync(path.join(RACINE, f), 'utf8');
  let m;
  motif.lastIndex = 0;
  while ((m = motif.exec(s))) {
    const [, servi, jour, heure] = m;
    const actuel = epingles.get(servi);
    const valeur = `${jour}-${heure}`;
    if (!actuel || valeur < actuel.stamp) epingles.set(servi, { stamp: valeur, depuis: f });
  }
}

let echecs = 0;
console.log(`${epingles.size} fichier(s) servi(s) via une épingle de cache\n`);
for (const [servi, { stamp, depuis }] of [...epingles].sort()) {
  if (!fs.existsSync(path.join(RACINE, servi))) {
    console.log(`  ✘ ${servi} — épinglé depuis ${depuis} mais absent du dépôt`);
    echecs++;
    continue;
  }
  const commit = execFileSync('git', ['log', '-1', '--format=%ad', '--date=format:%Y%m%d-%H%M', '--', servi],
    { cwd: RACINE }).toString().trim();
  // Comparaison au JOUR et non à la minute : bumper un injecteur change sa
  // propre date de commit, ce qui périmerait aussitôt l'épingle qui le sert
  // ailleurs — le contrôle ne convergerait jamais. Le vrai défaut à
  // attraper est « épingle d'hier, fichier corrigé aujourd'hui ».
  const jourEpingle = stamp.slice(0, 8);
  const jourCommit = commit ? commit.slice(0, 8) : '';
  const ok = !jourCommit || jourCommit <= jourEpingle;
  console.log(`  ${ok ? '✔' : '✘'} ${servi.padEnd(46)} épingle ${stamp} · dernier commit ${commit || '(inconnu)'}`);
  if (!ok) {
    console.log(`      → épingle périmée, injectée depuis ${depuis} : le navigateur resservira l'ancienne copie`);
    echecs++;
  }
}

console.log(`\n${echecs === 0 ? 'Toutes les épingles sont à jour.' : echecs + ' épingle(s) périmée(s).'}`);
process.exit(echecs ? 1 : 0);
