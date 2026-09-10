#!/usr/bin/env node
// `security find-generic-password` ne doit JAMAIS être invoqué lorsque
// `NEXUS_TEST_DB_URL` est déjà fournie — pas seulement « ne doit pas faire
// échouer le script ». request-6/decision-6 (09/09/2026) distinguent les deux :
// avec `set -e` et `security ... || true`, un binaire absent était déjà
// silencieusement toléré (le script ne plantait pas), mais l'appel avait bien
// lieu — sur un vrai Mac au trousseau verrouillé, `security` peut demander une
// confirmation interactive et bloquer un script qui n'en avait pourtant pas
// besoin, puisqu'une URL valide était déjà là.
//
// CETTE ÉPREUVE MET LES SCRIPTS EN SITUATION et observe si le leurre `security`
// a été EXÉCUTÉ (marqueur écrit sur disque), pas seulement le code de sortie.

'use strict';
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
const SCRIPTS = [
  'outils/reconstruire-base-test.sh',
  'outils/repetition-release-complete.sh',
  'outils/repeter-lot-production-readiness-test.sh',
];

const CYCLE = path.join(RACINE, 'docs', 'handoff', 'PREPROD-CYCLE.json');
const URL_MORTE = 'postgresql://personne@127.0.0.1:1/postgres?sslmode=disable';
const REF_BIDON = 'zzzzrefdetestinexistante';

function lancerAvecLeurre(script, env, marqueur) {
  const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-marqueur-security-'));
  fs.writeFileSync(path.join(leurre, 'security'), `#!/bin/sh\necho appele >> "${marqueur}"\nexit 127\n`);
  fs.chmodSync(path.join(leurre, 'security'), 0o755);
  const sauvegarde = fs.existsSync(CYCLE) ? fs.readFileSync(CYCLE, 'utf8') : null;
  try {
    if (sauvegarde !== null) {
      const vide = JSON.parse(sauvegarde);
      vide.cycles = [];
      fs.writeFileSync(CYCLE, JSON.stringify(vide, null, 2) + '\n');
    }
    return spawnSync('bash', [path.join(RACINE, script), REF_BIDON, '2026.09.0'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`, NEXUS_TEST_DB_PASSWORD: '', ...env }),
      encoding: 'utf8', timeout: 60000, cwd: RACINE,
    });
  } finally {
    if (sauvegarde !== null) fs.writeFileSync(CYCLE, sauvegarde);
    fs.rmSync(leurre, { recursive: true, force: true });
  }
}

for (const s of SCRIPTS) {
  t(`${path.basename(s)} : avec NEXUS_TEST_DB_URL fournie, security n'est JAMAIS invoqué`, () => {
    const marqueur = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-marq-')), 'appels.txt');
    lancerAvecLeurre(s, { NEXUS_TEST_DB_URL: URL_MORTE }, marqueur);
    assert.ok(!fs.existsSync(marqueur),
      `security a été invoqué alors qu'une URL était déjà fournie (marqueur: ${marqueur})`);
  });

  t(`${path.basename(s)} : sans URL, security est bien tenté (le leurre est atteint)`, () => {
    const marqueur = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-marq-')), 'appels.txt');
    const r = lancerAvecLeurre(s, { NEXUS_TEST_DB_URL: '' }, marqueur);
    assert.ok(fs.existsSync(marqueur),
      `security n'a jamais été tenté alors qu'aucune URL n'était fournie : ${(r.stderr || '').slice(0, 200)}`);
    assert.strictEqual(r.status, 4, `attendu exit 4 (aucun moyen de se connecter), obtenu ${r.status}`);
  });
}

// MUTATION NÉGATIVE : reconstituer le défaut d'origine (appel inconditionnel
// de `security`, avant toute vérification de NEXUS_TEST_DB_URL) et prouver
// que cette épreuve le détecte — sans quoi elle ne prouve rien.
t("MUTATION : l'appel security inconditionnel (défaut d'origine) est bien détecté", () => {
  const src = fs.readFileSync(path.join(RACINE, SCRIPTS[0]), 'utf8');
  // ANCRE RENDUE INDÉPENDANTE DE LA FORME, 10/09/2026. La mutation épinglait
  // le bloc exact de la branche d'origine :
  //     if [ -z "${NEXUS_TEST_DB_URL:-}" ]; then  security…  else  MDP=""  fi
  // Le HEAD canonique porte la condition INVERSÉE :
  //     if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then  MDP=""  else  security…  fi
  // Même sens, texte différent — la mutation ne trouvait plus rien et se
  // déclarait elle-même sans valeur. Une mutation qui dépend de la mise en
  // forme du code qu'elle éprouve finit toujours par mourir de sa réécriture.
  //
  // On cible désormais ce qui DÉFINIT le défaut : la garde conditionnelle
  // autour de l'appel, quelle que soit la façon dont elle est écrite. Le bloc
  // est remplacé par l'appel inconditionnel d'origine.
  const BLOC_GARDE = /if \[ -[zn] "\$\{NEXUS_TEST_DB_URL:-\}" \]; then[\s\S]*?\nfi\n/;
  assert.ok(BLOC_GARDE.test(src),
    'la garde conditionnelle autour de security est introuvable : la mutation ne peut rien reproduire');
  const mute = src.replace(
    BLOC_GARDE,
    'MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"\n'
    + 'if [ -z "$MDP" ]; then\n  MDP="${NEXUS_TEST_DB_PASSWORD:-}"\nfi\n');
  assert.notStrictEqual(mute, src, 'la mutation n’a rien changé : elle ne prouve rien');

  const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mut-'));
  const marqueur = path.join(leurre, 'appels.txt');
  fs.writeFileSync(path.join(leurre, 'security'), `#!/bin/sh\necho appele >> "${marqueur}"\nexit 127\n`);
  fs.chmodSync(path.join(leurre, 'security'), 0o755);
  const tmp = path.join(leurre, 'mute.sh');
  fs.writeFileSync(tmp, mute); fs.chmodSync(tmp, 0o755);

  const sauvegarde = fs.existsSync(CYCLE) ? fs.readFileSync(CYCLE, 'utf8') : null;
  try {
    spawnSync('bash', [tmp, REF_BIDON, '2026.09.0'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE }),
      encoding: 'utf8', timeout: 60000, cwd: RACINE,
    });
  } finally {
    if (sauvegarde !== null) fs.writeFileSync(CYCLE, sauvegarde);
  }
  assert.ok(fs.existsSync(marqueur),
    'le fichier muté (défaut d’origine réintroduit) aurait dû invoquer security malgré l’URL fournie ; ' +
    'l’épreuve ne détecte donc pas le défaut qu’elle prétend couvrir.');
});

console.log(`\n${passes}/7 vérifications passées — security n'est jamais invoqué quand NEXUS_TEST_DB_URL suffit déjà.`);
