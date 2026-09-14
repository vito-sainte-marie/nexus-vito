#!/usr/bin/env node
// `security` n'est invoqué que s'il est le seul recours — pas seulement toléré.
//
// CONSTAT (decision-6.md, lot NEXUS-PRODUCTION-READINESS-1-20260908, 10/09/2026) :
// `test_credential_seulement_si_necessaire_20260909.js` prouve déjà que les
// scripts AVANCENT quand `NEXUS_TEST_DB_URL` est fournie, même si `security`
// échoue (127, absent sur Linux). Mais un `security` qui échoue en silence
// n'est pas la même chose qu'un `security` qui n'a jamais été appelé — le
// premier reste un appel inutile à un binaire absent, masqué par `|| true`.
// decision-6.md demande explicitement que l'appel N'AIT PAS LIEU quand une
// URL est déjà fournie, dans les trois scripts nommés.
//
// CETTE ÉPREUVE MESURE L'INVOCATION ELLE-MÊME : le leurre `security` écrit un
// marqueur à chaque exécution. On vérifie son ABSENCE quand une URL est
// fournie, et sa PRÉSENCE quand elle ne l'est pas (sinon l'épreuve ne
// prouverait rien — un leurre jamais atteint passerait n'importe quel test).

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
  // `e.name` d'abord : sans lui, un SyntaxError (JSON.parse) et un
  // AssertionError (assert.ok) impriment tous deux un message SANS le mot
  // « Error » — indiscernables l'un de l'autre dans un log CI qui ne garde
  // que cette ligne. Défaut §7 du 10/09/2026 (blocages-ouverts-1.md) :
  // reproduit en corrompant PREPROD-CYCLE.json, la sortie était identique à
  // un vrai refus « security a été invoqué ». Ceci n'est pas un correctif du
  // contrôle lui-même — il reste inchangé — seul son récit l'est.
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.name}: ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const SCRIPTS = [
  'outils/reconstruire-base-test.sh',
  'outils/repetition-release-complete.sh',
  'outils/repeter-lot-production-readiness-test.sh',
];

const URL_MORTE = 'postgresql://personne@127.0.0.1:1/postgres?sslmode=disable';
const REF_BIDON = 'zzzzrefdetestinexistante';

const CYCLE = path.join(RACINE, 'docs', 'handoff', 'PREPROD-CYCLE.json');

function lancer(script, env, marqueur) {
  const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-marqueur-security-'));
  fs.writeFileSync(path.join(leurre, 'security'),
    `#!/bin/sh\necho invoque >> "${marqueur}"\nexit 127\n`);
  fs.chmodSync(path.join(leurre, 'security'), 0o755);

  const sauvegarde = fs.existsSync(CYCLE) ? fs.readFileSync(CYCLE, 'utf8') : null;
  try {
    if (sauvegarde !== null) {
      const vide = JSON.parse(sauvegarde);
      vide.cycles = [];
      fs.writeFileSync(CYCLE, JSON.stringify(vide, null, 2) + '\n');
    }
    return spawnSync('bash', [path.join(RACINE, script), REF_BIDON, '2026.09.0'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', ...env }),
      encoding: 'utf8', timeout: 60000, cwd: RACINE,
    });
  } finally {
    if (sauvegarde !== null) fs.writeFileSync(CYCLE, sauvegarde);
    fs.rmSync(leurre, { recursive: true, force: true });
  }
}

for (const s of SCRIPTS) {
  t(`${path.basename(s)} : URL fournie => security JAMAIS invoqué`, () => {
    const marqueur = path.join(os.tmpdir(), `marqueur-${Date.now()}-${Math.random()}`);
    const r = lancer(s, { NEXUS_TEST_DB_URL: URL_MORTE }, marqueur);
    // INSTRUMENTATION (10/09/2026) — ce contrôle a échoué UNE fois, sur le run
    // 34485839396 (push, Linux), alors qu'il passait sur le run pull_request du
    // MÊME SHA et qu'il passe sur macOS. Cause non isolée : rien dans le
    // message d'échec ne disait POURQUOI `security` avait été atteint. Un
    // échec qui ne se reproduit pas et qui n'imprime rien ne s'explique jamais.
    // Ceci n'est pas un correctif : le contrôle est inchangé, seul son récit
    // l'est. Si l'échec revient, le prochain message porte l'état réel.
    assert.ok(!fs.existsSync(marqueur),
      'security a été invoqué alors que NEXUS_TEST_DB_URL était fournie.\n' +
      `      marqueur   : ${marqueur}\n` +
      `      appels     : ${fs.existsSync(marqueur) ? JSON.stringify(fs.readFileSync(marqueur, 'utf8')) : '(aucun)'}\n` +
      `      code sortie: ${r.status} · signal ${r.signal || '—'}\n` +
      `      URL vue    : ${JSON.stringify(URL_MORTE)}\n` +
      `      stdout     : ${JSON.stringify((r.stdout || '').slice(0, 400))}\n` +
      `      stderr     : ${JSON.stringify((r.stderr || '').slice(0, 400))}`);
  });

  t(`${path.basename(s)} : URL absente => security est bien invoqué (l'épreuve n'est pas un leurre mort)`, () => {
    const marqueur = path.join(os.tmpdir(), `marqueur-${Date.now()}-${Math.random()}`);
    lancer(s, { NEXUS_TEST_DB_URL: '' }, marqueur);
    assert.ok(fs.existsSync(marqueur),
      `security n'a jamais été invoqué même sans URL : le marqueur ne mesure rien`);
  });
}

// MUTATION NÉGATIVE : reconstitution du défaut (appel inconditionnel), pour
// prouver que cette épreuve le détecterait si le correctif disparaissait.
t('MUTATION : un appel inconditionnel à security est bien détecté', () => {
  const src = fs.readFileSync(path.join(RACINE, SCRIPTS[0]), 'utf8');
  const mute = src.replace(
    /if \[ -n "\$\{NEXUS_TEST_DB_URL:-\}" \]; then\n  MDP=""\nelse\n  MDP="\$\(security find-generic-password -a nexus -s nexus-test-db -w 2>\/dev\/null \|\| true\)"\n  if \[ -z "\$MDP" \]; then\n    MDP="\$\{NEXUS_TEST_DB_PASSWORD:-\}"\n  fi\nfi/,
    'MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"\nif [ -z "$MDP" ]; then\n  MDP="${NEXUS_TEST_DB_PASSWORD:-}"\nfi');
  assert.notStrictEqual(mute, src, 'la mutation n’a rien changé : elle ne prouve rien');

  const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-marqueur-mutation-'));
  const marqueur = path.join(os.tmpdir(), `marqueur-mutation-${Date.now()}`);
  fs.writeFileSync(path.join(leurre, 'security'),
    `#!/bin/sh\necho invoque >> "${marqueur}"\nexit 127\n`);
  fs.chmodSync(path.join(leurre, 'security'), 0o755);
  const tmp = path.join(leurre, 'mute.sh');
  fs.writeFileSync(tmp, mute);
  fs.chmodSync(tmp, 0o755);
  try {
    spawnSync('bash', [tmp, REF_BIDON, '2026.09.0'], {
      env: envPropre({ PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE }),
      encoding: 'utf8', timeout: 60000, cwd: RACINE,
    });
    assert.ok(fs.existsSync(marqueur),
      'le script muté (défaut réintroduit) aurait dû invoquer security malgré l’URL fournie ; ' +
      'l’épreuve ne détecte donc pas le défaut qu’elle prétend couvrir.');
  } finally {
    fs.rmSync(leurre, { recursive: true, force: true });
  }
});

console.log(`\n${passes}/${SCRIPTS.length * 2 + 1} vérifications passées — ` +
  'security n\'est invoqué que s\'il est le seul recours, jamais quand une URL est déjà fournie.');
