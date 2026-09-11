#!/usr/bin/env node
// La répétition doit pouvoir reprendre là où elle s'est arrêtée.
//
// POURQUOI. L'étape 2 rejoue 241 migrations et prend une dizaine de minutes. Le
// 09/09/2026, quatre tentatives se sont arrêtées APRÈS elle, sur des défauts
// situés ailleurs — un point de suspension collé à une variable, puis une
// colonne que la release apporte justement. Chacune a fait repayer la
// reconstruction pour rien.
//
// CE QUI EST ÉPROUVÉ ICI est le SAUT, pas la reconstruction : le script est mis
// en situation avec une connexion volontairement morte, et l'on observe ce
// qu'il imprime avant de mourir dessus. Aucune base n'est touchée.
//
// LE REGISTRE RÉEL EST SAUVEGARDÉ ET RESTAURÉ — l'étape 1 y écrit un cycle.

'use strict';
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// L'ENVIRONNEMENT DE LA RÉPÉTITION NE DOIT PAS FUIR DANS SES ÉPREUVES.
//
// Le 09/09/2026, l'étape 7 de la répétition — qui lance cette suite — tournait
// avec `DEPUIS_ETAPE=3` exporté. Le cas « sans DEPUIS_ETAPE » de cette épreuve
// passait un environnement vide, donc HÉRITÉ : il recevait 3, et vérifiait
// l'inverse de ce qu'il annonçait. L'épreuve héritait de l'environnement de la
// chose qu'elle testait.
//
// Même famille que les gardes qui exigent un état du monde : ce qui est
// implicite finit par mentir. Les variables de la répétition sont donc
// explicitement retirées.
function envPropre(ajouts) {
  const e = { ...process.env };
  for (const v of ['DEPUIS_ETAPE', 'NEXUS_REPETITION_FIGEE', 'NEXUS_RAPPORT',
                   'NEXUS_TEST_DB_URL', 'NEXUS_TEST_DB_PASSWORD']) delete e[v];
  return { ...e, ...ajouts };
}

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const SCRIPT = path.join(RACINE, 'outils', 'repetition-release-complete.sh');
const CYCLE = path.join(RACINE, 'docs', 'handoff', 'PREPROD-CYCLE.json');
const URL_MORTE = 'postgresql://personne@127.0.0.1:1/postgres?sslmode=disable';

const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-reprise-'));
fs.writeFileSync(path.join(leurre, 'security'), '#!/bin/sh\nexit 127\n');
fs.chmodSync(path.join(leurre, 'security'), 0o755);

function lancer(depuis) {
  const sauvegarde = fs.readFileSync(CYCLE, 'utf8');
  try {
    const r = spawnSync('bash', [SCRIPT, 'zzzzrefdetest', '2026.09.1'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE,
             ...(depuis === null ? {} : { DEPUIS_ETAPE: String(depuis) }) }),
      encoding: 'utf8', timeout: 90000, cwd: RACINE,
    });
    return { ...r, tout: (r.stdout || '') + (r.stderr || '') };
  } finally { fs.writeFileSync(CYCLE, sauvegarde); }
}

t('DEPUIS_ETAPE=3 saute les étapes 1 et 2 et atteint le semis', () => {
  const r = lancer(3);
  assert.ok(/\[1\/8\] sauté/.test(r.tout), 'l’étape 1 devait être sautée');
  assert.ok(/\[2\/8\] sauté/.test(r.tout), 'l’étape 2 devait être sautée');
  assert.ok(/\[3\/8\] Semis/.test(r.tout), 'l’étape 3 devait être atteinte');
  assert.ok(!/unbound variable|command not found|syntax error/.test(r.tout),
    `plantage bash au lieu d’un saut propre : ${r.tout.slice(0, 300)}`);
});

t('la reconstruction N’EST PAS relancée quand on reprend à 3', () => {
  const r = lancer(3);
  assert.ok(!/Reconstruction bornée/.test(r.tout),
    'l’étape 2 s’est exécutée malgré la reprise : le saut ne sert à rien');
});

t('sans DEPUIS_ETAPE, la séquence part bien de l’étape 1', () => {
  const r = lancer(null);
  assert.ok(/\[1\/8\] Ouverture du cycle/.test(r.tout),
    'par défaut la séquence doit commencer au début, jamais reprendre en silence');
  assert.ok(!/sauté \(reprise\)/.test(r.tout), 'aucune étape ne doit être sautée par défaut');
});

t('une reprise au-delà de la MESURE AVANT est REFUSÉE', () => {
  // Reprendre à 5 sauterait le semis ET la mesure avant : le rapport d'impact
  // comparerait alors deux états sans rapport, en restant vert.
  const r = lancer(5);
  assert.strictEqual(r.status, 5, `attendu exit 5, obtenu ${r.status} : ${r.tout.slice(0, 200)}`);
  assert.ok(/rapport d'impact ne voudrait rien dire/.test(r.tout),
    'le refus doit nommer sa raison');
});

t('une valeur d’étape absurde est refusée, pas ignorée', () => {
  const r = lancer('zero');
  assert.strictEqual(r.status, 5, `une valeur non numérique doit être refusée, obtenu ${r.status}`);
});

t('DEPUIS_ETAPE=8 démonte la répétition sans rien mesurer', () => {
  // Le RETOUR SEUL. Quand la séquence casse entre 3 et 7, Test reste en
  // PREPROD_REHEARSAL — voulu, pour examiner l'état fautif — et il faut un
  // chemin pour l'en sortir sans tout rejouer. Sauter 5 à 7 reste interdit
  // pour une répétition ; 8 n'est pas une reprise, c'est son démontage.
  const r = lancer(8);
  assert.ok(/\[3\/8\] sauté \(retour seul\)/.test(r.tout), 'le semis devait être sauté');
  assert.ok(/\[4-7\/8\] sautées/.test(r.tout), 'aucune mesure ne doit être prise');
  assert.ok(!/MESURE AVANT|MESURE APRÈS/.test(r.tout),
    'un retour seul ne produit AUCUN rapport : un rapport sans mesure avant serait un faux');
});

t('un arrêt AVANT toute répétition ne promet pas un état où l’on n’est jamais entré', () => {
  // Le message de secours annonce « Test reste en PREPROD_REHEARSAL ». Sur une
  // simple erreur d'usage, la base n'y est jamais passée : l'afficher
  // décrirait un monde faux, et lirait des variables non définies.
  const r = spawnSync('bash', [SCRIPT], {
    env: envPropre({ PATH: `${leurre}:${process.env.PATH}` }),
    encoding: 'utf8', timeout: 60000, cwd: RACINE });
  const tout = (r.stdout || '') + (r.stderr || '');
  assert.ok(/Usage :/.test(tout), 'une invocation sans argument doit rappeler l’usage');
  assert.ok(!/TEST RESTE EN PREPROD_REHEARSAL/.test(tout),
    'le message de secours s’affiche alors que la répétition n’a jamais commencé');
});

// MUTATION : sans la garde `faire`, la reprise ne sauterait rien. On retire la
// condition et l'on vérifie que la première épreuve tomberait.
t('MUTATION : sans la garde, l’étape 2 se rejouerait malgré la reprise', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const mute = src.replace(/^faire\(\) \{ .* \}$/m, 'faire() { true; }');
  assert.notStrictEqual(mute, src, 'la mutation n’a rien changé : elle ne prouve rien');
  const tmp = path.join(leurre, 'mute.sh');
  fs.writeFileSync(tmp, mute);
  const sauvegarde = fs.readFileSync(CYCLE, 'utf8');
  let tout;
  try {
    const r = spawnSync('bash', [tmp, 'zzzzrefdetest', '2026.09.1'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE, DEPUIS_ETAPE: '3' }),
      encoding: 'utf8', timeout: 90000, cwd: RACINE });
    tout = (r.stdout || '') + (r.stderr || '');
  } finally { fs.writeFileSync(CYCLE, sauvegarde); }
  assert.ok(!/\[1\/8\] sauté/.test(tout),
    'le script muté saute encore : l’épreuve ne détecte pas le défaut qu’elle couvre');
});

fs.rmSync(leurre, { recursive: true, force: true });
t('aucun lancement n’hérite de l’environnement de la répétition', () => {
  // Vérifier le comportement ne suffit pas ici : une fuite ne se voit que si la
  // variable fuyante est justement posée au moment où l'on regarde. On exige
  // donc la propriété structurelle — tout lancement passe par `envPropre`.
  const src = fs.readFileSync(__filename, 'utf8');
  const lancements = [...src.matchAll(/env:\s*\{\s*\.\.\.process\.env/g)];
  assert.strictEqual(lancements.length, 0,
    `${lancements.length} lancement(s) héritent encore de l’environnement complet`);
  assert.ok(/delete e\[v\]/.test(src), 'envPropre doit réellement retirer les variables');
});

console.log(`\n${passes}/9 vérifications passées — la répétition reprend sans repayer la reconstruction.`);
