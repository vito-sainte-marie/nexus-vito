// Le lanceur rend-il le même verdict en parallèle qu'en séquentiel ?
//
// Les épreuves sont des processus indépendants, mais rien ne le PROUVAIT : si
// l'une écrivait un fichier que l'autre lit, l'ordre d'exécution changerait le
// résultat, et on ne s'en apercevrait qu'un jour de charge inhabituelle. La
// suite complète est passée de 60 s à 25 s le 08/09/2026 ; le gain ne vaut que
// si les deux modes disent la même chose.
//
// Ces épreuves travaillent sur un SOUS-ENSEMBLE rapide. Rejouer la suite
// entière deux fois coûterait deux minutes à chaque exécution de la CI : une
// garde trop chère finit par être retirée, et emporte ce qu'elle protégeait.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const LANCEUR = path.join(__dirname, 'run-tests.js');
const FILTRE = 'affichage'; // deux épreuves, moins d'une seconde

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

function lancer(args) {
  try {
    return execFileSync('node', [LANCEUR, ...args], { cwd: __dirname, encoding: 'utf8' });
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

t('un DRAPEAU n’est pas un filtre', () => {
  // `--sequentiel` était pris pour le motif de sélection : la suite ne lançait
  // AUCUNE épreuve et sortait proprement. Une commande qui ne fait rien tout en
  // s'annonçant terminée est plus dangereuse qu'une commande qui échoue.
  const sortie = lancer(['--sequentiel', FILTRE]);
  assert.ok(!/Aucun test ne correspond/.test(sortie),
    'le drapeau ne doit pas être confondu avec le filtre : ' + sortie.slice(0, 200));
  assert.ok(/2\/2 tests passent/.test(sortie), sortie.slice(0, 200));
});

t('le lanceur DÉCLARE son mode — sinon on ne compare rien', () => {
  // Sans déclaration, un `--sequentiel` ignoré comparait deux exécutions
  // parallèles et concluait « identiques ». La mutation qui supprimait le mode
  // séquentiel survivait donc à l'épreuve censée le protéger.
  assert.ok(/en séquentiel\./.test(lancer(['--sequentiel', FILTRE])),
    'le mode séquentiel doit se déclarer');
  assert.ok(/\d+ en parallèle\./.test(lancer([FILTRE])),
    'le mode parallèle doit déclarer sa largeur');
});

t('les deux modes rendent le MÊME résultat', () => {
  const sq = lancer(['--sequentiel', FILTRE]);
  const pa = lancer([FILTRE]);
  const compte = (s) => (s.match(/(\d+)\/(\d+) tests passent/) || []).slice(1).join('/');
  assert.strictEqual(compte(sq), compte(pa), `séquentiel ${compte(sq)} vs parallèle ${compte(pa)}`);

  const echecs = (s) => (s.match(/test_[a-z0-9_]+\.js/g) || []).sort().join(',');
  assert.strictEqual(echecs(sq), echecs(pa), 'la LISTE doit être identique, pas seulement le compte');
});

t('l’ordre du rapport est celui des FICHIERS, pas celui des retours', () => {
  // Sans cela, deux exécutions successives produiraient des rapports qui ne se
  // comparent plus — et la discipline « la liste, pas le compte » s'effondre.
  const src = fs.readFileSync(LANCEUR, 'utf8');
  assert.ok(/fichiers\.filter\(f => !resultats\.get\(f\)\.ok\)/.test(src),
    'les échecs doivent être rendus dans l’ordre de `fichiers`');
});

t('le parallélisme est BORNÉ', () => {
  // 234 processus Node simultanés ne vont pas plus vite : ils se disputent la
  // machine, et les épreuves les plus lentes frôlent alors leur délai.
  const src = fs.readFileSync(LANCEUR, 'utf8');
  const m = /Math\.max\(1, Math\.min\((\d+), require\('os'\)\.cpus\(\)\.length\)\)/.exec(src);
  assert.ok(m, 'le nombre de travailleurs doit être plafonné');
  assert.ok(Number(m[1]) <= 8, 'plafond trop haut : ' + m[1]);
});

t('le délai par épreuve est conservé', () => {
  // Le passage en parallèle ne doit pas faire disparaître la limite : c'est
  // elle qui arrête une épreuve qui boucle.
  const src = fs.readFileSync(LANCEUR, 'utf8');
  assert.ok(/timeout: 90000/.test(src), 'la limite de 90 s doit rester');
});

console.log(`\n${n}/${n} vérifications passées — le gain de vitesse ne coûte pas la fiabilité du verdict.`);
