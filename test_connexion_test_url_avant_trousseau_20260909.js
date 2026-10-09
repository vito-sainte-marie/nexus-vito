// Le défaut exact nommé par decision-5.md (lot
// NEXUS-PRODUCTION-READINESS-1-20260908, 09/09/2026) : une URL
// `NEXUS_TEST_DB_URL` déjà fournie ne doit JAMAIS être précédée d'une
// dépendance obligatoire au trousseau macOS. Avant correction, les deux
// scripts appelaient `security find-generic-password` — et `exit 4` si le
// trousseau était vide — AVANT même de regarder si `NEXUS_TEST_DB_URL`
// suffisait déjà. Sur un runner CI Linux (aucun `security`, aucun
// trousseau), même un secret Test déjà câblé via `NEXUS_TEST_DB_URL`
// n'aurait jamais été atteint.
//
// Ce test lit le SOURCE des deux scripts (aucune connexion réelle, aucun
// secret) et exige que le bloc `NEXUS_TEST_DB_URL` apparaisse AVANT toute
// résolution de mot de passe (trousseau ou repli portable). La mutation
// négative rejoue le texte du bug d'origine et exige qu'elle échoue.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const SCRIPTS = ['reconstruire-base-test.sh', 'repeter-lot-production-readiness-test.sh'];

function source(nom) { return fs.readFileSync(path.join(RACINE, 'outils', nom), 'utf8'); }

function verifierOrdre(src) {
  const iUrl = src.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then');
  const iTrousseau = src.indexOf('security find-generic-password');
  assert.ok(iUrl >= 0, 'le bloc NEXUS_TEST_DB_URL doit exister');
  assert.ok(iTrousseau >= 0, 'la résolution trousseau doit exister');
  assert.ok(iUrl < iTrousseau, 'NEXUS_TEST_DB_URL doit être vérifiée AVANT toute résolution de mot de passe');
}

let n = 0, total = 0;
function t(nom, fn) { total++; try { fn(); n++; console.log('OK — ' + nom); } catch (e) { console.error('ÉCHEC — ' + nom + '\n    ' + e.message); } }

t('reconstruire-base-test.sh vérifie NEXUS_TEST_DB_URL avant le trousseau', () => {
  verifierOrdre(source('reconstruire-base-test.sh'));
});

t('repeter-lot-production-readiness-test.sh vérifie NEXUS_TEST_DB_URL avant le trousseau', () => {
  verifierOrdre(source('repeter-lot-production-readiness-test.sh'));
});

t('la résolution du mot de passe reste dans la branche "sinon" (jamais appelée si URL fournie)', () => {
  for (const nom of SCRIPTS) {
    const src = source(nom);
    const debutSinon = src.indexOf('else', src.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then'));
    const iTrousseau = src.indexOf('security find-generic-password');
    assert.ok(debutSinon > 0 && debutSinon < iTrousseau,
      `${nom} : la résolution trousseau doit être dans le bloc else, pas exécutée inconditionnellement`);
  }
});

t('aucun secret ni valeur de mot de passe n’apparaît en clair dans les scripts', () => {
  for (const nom of SCRIPTS) {
    const src = source(nom);
    assert.ok(!/PGPASSWORD="[^$]/.test(src.replace(/PGPASSWORD="\$MDP"/g, '')),
      `${nom} : PGPASSWORD ne doit provenir que d'une variable résolue, jamais d'un littéral`);
  }
});

t('les deux scripts restent syntaxiquement valides après le déplacement du bloc', () => {
  for (const nom of SCRIPTS) {
    assert.doesNotThrow(() => execFileSync('bash', ['-n', path.join(RACINE, 'outils', nom)], { stdio: 'pipe' }),
      `${nom} : erreur de syntaxe bash`);
  }
});

// Mutation négative réelle : rejouer le texte EXACT du bug d'origine (extrait
// du commit précédant ce correctif) contre l'épreuve d'ordre — elle doit
// échouer, sinon l'épreuve ne détecte rien.
t('mutation négative — le texte du bug d’origine (trousseau inconditionnel) est bien rejeté par l’épreuve d’ordre', () => {
  const bugOriginal = [
    'MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"',
    'if [ -z "$MDP" ]; then',
    '  echo "Mot de passe introuvable dans le trousseau (compte « nexus », service « nexus-test-db »)." >&2',
    '  exit 4',
    'fi',
    '',
    'export PGPASSWORD="$MDP"; unset MDP',
    'if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then',
    '  URL="$NEXUS_TEST_DB_URL"',
    'fi',
  ].join('\n');
  assert.throws(() => verifierOrdre(bugOriginal),
    /AVANT toute résolution de mot de passe/,
    'le texte du bug d’origine doit être détecté comme non conforme par cette même épreuve');
});

console.log(`\n${n}/${total} vérifications passées.`);
process.exit(n === total ? 0 : 1);
