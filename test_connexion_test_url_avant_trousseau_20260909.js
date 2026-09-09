// `security` (trousseau macOS) ne doit JAMAIS être invoqué quand
// `NEXUS_TEST_DB_URL` est déjà fournie — pas seulement « son résultat
// ignoré ensuite ».
//
// Constat du 09/09/2026, RECONFIRMÉ le même jour : un premier correctif
// (request-5) avait ajouté le repli sur NEXUS_TEST_DB_URL/
// NEXUS_TEST_DB_PASSWORD, mais laissait `security find-generic-password`
// s'exécuter quand même en premier, inconditionnellement — le commentaire du
// script promettait un ordre que le code ne tenait pas. Ce test exécute
// RÉELLEMENT les deux scripts (pas une simple lecture de source) avec un
// faux `security` qui trahit son invocation, et prouve par mutation négative
// que l'ancien code aurait été détecté.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
// `repetition-release-complete.sh` n'est délibérément PAS rejoué ici : il
// écrit dans le vrai `docs/handoff/PREPROD-CYCLE.json` dès sa première étape
// et s'auto-recopie dans un fichier temporaire avant de s'y relancer. Le
// couvrir en exécution réelle exige la même précaution de sauvegarde/
// restauration que `test_credential_seulement_si_necessaire_20260909.js` lui
// applique déjà — dupliquer ce filet ici ajouterait un second endroit où il
// pourrait se rompre sans le renforcer. Ce fichier prouve l'ordre sur les deux
// scripts les plus simples à mettre en situation sans risque ; l'autre test
// couvre les trois, par comportement, avec cette précaution en place.
const SCRIPTS = ['reconstruire-base-test.sh', 'repeter-lot-production-readiness-test.sh'];

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

function fabriquerBacASable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-connexion-test-'));
  const marqueur = path.join(dir, 'security-invoquee.marqueur');

  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);

  // Faux `security` : trahit son invocation puis échoue, comme un trousseau absent.
  fs.writeFileSync(path.join(bin, 'security'), `#!/usr/bin/env bash\necho invoquee >> "${marqueur}"\nexit 1\n`);
  fs.chmodSync(path.join(bin, 'security'), 0o755);

  // Faux `psql` : n'importe quel appel avec -f échoue (arrête vite le script
  // AVANT la lourde étape [4/4] de repeter-lot-production-readiness-test.sh) ;
  // tout le reste réussit avec une sortie factice inoffensive.
  fs.writeFileSync(path.join(bin, 'psql'), [
    '#!/usr/bin/env bash',
    'for a in "$@"; do if [ "$a" = "-f" ]; then exit 42; fi; done',
    'echo "  tables : 0"',
    'exit 0',
  ].join('\n') + '\n');
  fs.chmodSync(path.join(bin, 'psql'), 0o755);

  return { dir, bin, marqueur };
}

function executer(script, { bin, marqueur }) {
  const env = Object.assign({}, process.env, {
    PATH: bin + ':' + process.env.PATH,
    NEXUS_TEST_DB_URL: 'postgresql://postgres@exemple-inoffensif.invalid:5432/postgres',
    REINITIALISER: 'non',
    JUSQUA: '00000000000000', // avant la première migration réelle : arrêt immédiat, aucun psql -f
  });
  try {
    execFileSync('bash', [path.join(RACINE, 'outils', script), 'un-projet-non-production'], {
      env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    });
    return { code: 0 };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') };
  }
}

for (const script of SCRIPTS) {
  t(`${script} : NEXUS_TEST_DB_URL fournie => security n'est JAMAIS invoqué (exécution réelle)`, () => {
    const sable = fabriquerBacASable();
    const res = executer(script, sable);
    assert.ok(!fs.existsSync(sable.marqueur),
      `${script} : security a été invoqué alors que NEXUS_TEST_DB_URL était déjà fournie (code sortie ${res.code})`);
    fs.rmSync(sable.dir, { recursive: true, force: true });
  });
}

t('mutation négative : l’ANCIEN ordre (security avant NEXUS_TEST_DB_URL) est bien détecté', () => {
  // Rejoue l'exécution réelle avec l'ordre fautif d'origine, pour prouver que
  // l'épreuve ci-dessus l'aurait attrapé — pas une coïncidence de fixture.
  const sable = fabriquerBacASable();
  const dirMute = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mutation-'));
  const original = fs.readFileSync(path.join(RACINE, 'outils', 'reconstruire-base-test.sh'), 'utf8');

  const ORDRE_FAUTIF = [
    'MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"',
    'if [ -z "$MDP" ]; then',
    '  MDP="${NEXUS_TEST_DB_PASSWORD:-}"',
    'fi',
    'if [ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]; then',
    '  echo "Aucun moyen de se connecter : ni NEXUS_TEST_DB_URL, ni mot de passe." >&2',
    '  echo "Fournir l\'URL, ou déposer le mot de passe avec :" >&2',
    '  echo "  security add-generic-password -a nexus -s nexus-test-db -w" >&2',
    '  exit 4',
    'fi',
    'if [ -n "$MDP" ]; then',
    '  export PGPASSWORD="$MDP"',
    'fi',
    'unset MDP',
  ].join('\n');

  const debut = original.indexOf('MDP=""');
  const fin = original.indexOf('unset MDP') + 'unset MDP'.length;
  assert.ok(debut > 0 && fin > debut, 'bloc credential introuvable dans le fichier réel — le test ne teste plus rien');
  const mute = original.slice(0, debut) + ORDRE_FAUTIF + original.slice(fin);
  assert.notStrictEqual(mute, original, 'la mutation doit produire un contenu différent du réel');

  const fichierMute = path.join(dirMute, 'reconstruire-base-test.sh');
  fs.writeFileSync(fichierMute, mute);
  fs.chmodSync(fichierMute, 0o755);

  const env = Object.assign({}, process.env, {
    PATH: sable.bin + ':' + process.env.PATH,
    NEXUS_TEST_DB_URL: 'postgresql://postgres@exemple-inoffensif.invalid:5432/postgres',
    REINITIALISER: 'non',
    JUSQUA: '00000000000000',
  });
  try {
    execFileSync('bash', [fichierMute, 'un-projet-non-production'], { env, cwd: RACINE, stdio: 'ignore', timeout: 30000 });
  } catch (_) { /* peu importe le code de sortie ici */ }

  assert.ok(fs.existsSync(sable.marqueur),
    'MUTATION NON DÉTECTÉE : l’ancien ordre fautif aurait dû invoquer security — le test ne protège rien');

  fs.rmSync(sable.dir, { recursive: true, force: true });
  fs.rmSync(dirMute, { recursive: true, force: true });
});

console.log(`\n${n}/${n} vérifications passées — security n'est jamais invoqué quand NEXUS_TEST_DB_URL suffit, prouvé par exécution réelle et par mutation négative.`);
