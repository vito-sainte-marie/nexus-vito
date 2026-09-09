#!/usr/bin/env node
// Le trousseau n'est exigé que s'il est le SEUL recours.
//
// CONSTAT (request-5, 09/09/2026) : `reconstruire-base-test.sh` réclamait le
// trousseau macOS AVANT de regarder si `NEXUS_TEST_DB_URL` était fournie. Sur
// un runner Linux, où ce trousseau n'existe pas, la reconstruction mourait en
// `exit 4` avec une URL Test valide sous la main. Le script refusait de
// travailler faute d'un moyen dont il n'avait pas besoin.
//
// CETTE ÉPREUVE MET LES SCRIPTS EN SITUATION, elle ne lit pas leur source.
// Juger un script sur ce qu'il MENTIONNE plutôt que sur ce qu'il FAIT est
// l'erreur que cette suite a commise six fois le 09/09 ; on ne la refait pas.
// `security` est donc masqué par un leurre qui sort en 127 — exactement ce que
// produit un binaire absent — et l'on observe le code de sortie réel.
//
// LA CONNEXION VISÉE EST VOLONTAIREMENT MORTE (127.0.0.1:1). Aucun de ces
// scripts ne doit toucher une vraie base pendant une épreuve : ce qu'on mesure,
// c'est le franchissement de la barrière de credential, et rien au-delà.

'use strict';
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

// Un leurre qui se comporte comme un `security` absent.
const leurre = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sans-trousseau-'));
fs.writeFileSync(path.join(leurre, 'security'), '#!/bin/sh\nexit 127\n');
fs.chmodSync(path.join(leurre, 'security'), 0o755);

const URL_MORTE = 'postgresql://personne@127.0.0.1:1/postgres?sslmode=disable';
const REF_BIDON = 'zzzzrefdetestinexistante';

// LE REGISTRE RÉEL EST SAUVEGARDÉ PUIS RESTAURÉ.
//
// `repetition-release-complete.sh` ouvre un cycle dans
// `docs/handoff/PREPROD-CYCLE.json` — un vrai fichier versionné. Sans
// précaution, cette épreuve y écrirait, ou bien échouerait parce qu'un cycle
// réel est ouvert pour une autre release. Elle exigerait alors un ÉTAT DU
// MONDE, et se mettrait à mentir dès que le monde change : c'est exactement le
// défaut corrigé ce matin sur `test_garde_mode_environnement`. On applique donc
// l'idiome déjà en usage dans `test_handoff_v2` — snapshot, exécution,
// restauration inconditionnelle.
const CYCLE = path.join(RACINE, 'docs', 'handoff', 'PREPROD-CYCLE.json');

function lancer(script, env, args) {
  const sauvegarde = fs.existsSync(CYCLE) ? fs.readFileSync(CYCLE, 'utf8') : null;
  try {
    if (sauvegarde !== null) {
      // Registre vierge : aucun cycle ouvert, donc l'étape 1 ne refuse pas et
      // le script avance jusqu'à la connexion, seule chose qu'on mesure ici.
      const vide = JSON.parse(sauvegarde);
      vide.cycles = [];
      fs.writeFileSync(CYCLE, JSON.stringify(vide, null, 2) + '\n');
    }
    return spawnSync('bash', [path.join(RACINE, script), ...(args || [REF_BIDON, '2026.09.0'])], {
      env: { ...process.env, PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', ...env },
      encoding: 'utf8', timeout: 60000, cwd: RACINE,
    });
  } finally {
    if (sauvegarde !== null) fs.writeFileSync(CYCLE, sauvegarde);
  }
}

for (const s of SCRIPTS) {
  t(`${path.basename(s)} : sans trousseau ET sans URL, il REFUSE (exit 4)`, () => {
    const r = lancer(s, { NEXUS_TEST_DB_URL: '' });
    assert.strictEqual(r.status, 4,
      `attendu exit 4, obtenu ${r.status}. Sortie : ${(r.stderr || '').slice(0, 300)}`);
  });

  t(`${path.basename(s)} : sans trousseau MAIS avec URL, il PASSE la barrière`, () => {
    const r = lancer(s, { NEXUS_TEST_DB_URL: URL_MORTE });
    assert.notStrictEqual(r.status, 4,
      'exit 4 alors qu’une URL est fournie : le trousseau est encore exigé à tort');
    const tout = (r.stdout || '') + (r.stderr || '');
    assert.ok(!/Mot de passe introuvable|Aucun moyen de se connecter/.test(tout),
      `refus de credential alors qu’une URL est fournie : ${tout.slice(0, 300)}`);

    // ET IL DOIT AVOIR AVANCÉ, pas seulement évité l'exit 4.
    //
    // La première version de cette épreuve s'arrêtait aux deux lignes ci-dessus,
    // et elle est PASSÉE sur un script qui plantait en « MDP: unbound variable »
    // — un exit 1 satisfaisait « pas 4 » et ne contenait aucun message de refus.
    // Elle mesurait l'absence d'un symptôme au lieu de la présence du
    // comportement. C'est le septième cas du genre en deux jours ; on le corrige
    // ici en exigeant une preuve POSITIVE de franchissement.
    assert.ok(!/unbound variable|command not found|syntax error|: line \d+:/.test(tout),
      `le script a planté au niveau bash au lieu d’avancer : ${tout.slice(0, 300)}`);
    assert.ok(/NEXUS_TEST_DB_URL|[Cc]onnexion|connection|could not connect|psql/.test(tout),
      `aucune trace d’une tentative de connexion : le script s’est arrêté avant. ${tout.slice(0, 300)}`);
  });

  t(`${path.basename(s)} : la référence PRODUCTION reste refusée AVANT tout`, () => {
    const r = lancer(s, { NEXUS_TEST_DB_URL: URL_MORTE },
      ['uzhjpqpctpvxytxpxoqz', '2026.09.0']);
    assert.strictEqual(r.status, 3,
      `Production doit être refusée en exit 3, obtenu ${r.status}`);
  });
}

// MUTATION NÉGATIVE, sur le fichier réel d'avant correctif. Sans elle,
// l'épreuve ci-dessus passerait aussi bien sur un script qui n'a jamais eu le
// défaut — et ne prouverait donc pas que le correctif est ce qui la fait
// passer.
t('MUTATION : le fichier d’AVANT correctif échoue bien à cette épreuve', () => {
  const avant = path.join(os.tmpdir(),
    '..', 'claude-501', '-Users-fredericbragance-Library-Mobile-Documents-com-apple-CloudDocs-nexus-ocr-worker',
    '5ec37f8c-1b4a-4d86-85b3-b2936b08ca83', 'scratchpad', 'avant-correctif-reconstruire.sh');
  if (!fs.existsSync(avant)) {
    // Reconstitution du défaut à l'identique : refus dès que le trousseau est
    // vide, sans jamais regarder l'URL.
    const src = fs.readFileSync(path.join(RACINE, SCRIPTS[0]), 'utf8');
    const mute = src.replace(
      /if \[ -z "\$MDP" \] && \[ -z "\$\{NEXUS_TEST_DB_URL:-\}" \]; then/,
      'if [ -z "$MDP" ]; then');
    assert.notStrictEqual(mute, src, 'la mutation n’a rien changé : elle ne prouve rien');
    const tmp = path.join(leurre, 'mute.sh');
    fs.writeFileSync(tmp, mute); fs.chmodSync(tmp, 0o755);
    const r = spawnSync('bash', [tmp, REF_BIDON], {
      env: { ...process.env, PATH: `${leurre}:${process.env.PATH}`,
             NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE },
      encoding: 'utf8', timeout: 60000, cwd: RACINE });
    assert.strictEqual(r.status, 4,
      `le script muté aurait dû mourir en exit 4 ; il a rendu ${r.status}. ` +
      'L’épreuve ne détecte donc pas le défaut qu’elle prétend couvrir.');
    return;
  }
  const r = spawnSync('bash', [avant, REF_BIDON], {
    env: { ...process.env, PATH: `${leurre}:${process.env.PATH}`,
           NEXUS_TEST_DB_PASSWORD: '', NEXUS_TEST_DB_URL: URL_MORTE },
    encoding: 'utf8', timeout: 60000, cwd: RACINE });
  assert.strictEqual(r.status, 4,
    `le fichier d’avant correctif aurait dû mourir en exit 4 ; il a rendu ${r.status}`);
});

fs.rmSync(leurre, { recursive: true, force: true });
console.log(`\n${passes}/10 vérifications passées — le credential n’est exigé que s’il est le seul recours.`);
