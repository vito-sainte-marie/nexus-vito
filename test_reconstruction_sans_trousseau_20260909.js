// Le trousseau macOS reste-t-il OBLIGATOIRE même quand l'appelant a déjà
// une connexion valide ?
//
// Bug réel trouvé le 09/09/2026 en préparant le câblage CI de la répétition
// clean-slate : LES DEUX scripts (`repeter-lot-production-readiness-test.sh`
// et `reconstruire-base-test.sh`, celui-ci appelé par celui-là à l'étape
// [2/4]) exigeaient INCONDITIONNELLEMENT le trousseau macOS AVANT même de
// regarder si `NEXUS_TEST_DB_URL` était déjà fournie. Sur un runner GitHub
// Actions (Linux, sans `security`), les deux auraient donc échoué à coup
// sûr — y compris quand une URL déjà résolue par l'appelant (la CI, ou le
// script parent) suffisait entièrement. Ce n'était pas une capacité
// manquante, c'était un ordre de vérification qui ignorait ce que
// l'appelant savait déjà.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPTS = ['reconstruire-base-test.sh', 'repeter-lot-production-readiness-test.sh']
  .map(f => ({ nom: f, src: fs.readFileSync(path.join(__dirname, 'outils', f), 'utf8') }));

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('une NEXUS_TEST_DB_URL déjà fournie court-circuite le trousseau', () => {
  for (const { nom, src } of SCRIPTS) {
    const iUrl = src.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then');
    const iKeychain = src.indexOf('security find-generic-password');
    assert.ok(iUrl > 0, `${nom} : le script doit vérifier NEXUS_TEST_DB_URL`);
    assert.ok(iKeychain > 0, `${nom} : le script doit garder le repli trousseau pour l’usage local macOS`);
    assert.ok(iUrl < iKeychain,
      `${nom} : NEXUS_TEST_DB_URL doit être vérifiée AVANT toute exigence de trousseau, sinon un appelant qui a déjà résolu une connexion (CI, ou le script de répétition) échoue quand même sur un runner sans trousseau`);
  }
});

t('le trousseau n’est requis QUE dans la branche sans URL fournie', () => {
  for (const { nom, src } of SCRIPTS) {
    const bloc = src.slice(src.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then'), src.indexOf('security find-generic-password') + 1);
    assert.ok(/\belse\b/.test(bloc), `${nom} : la résolution par trousseau doit être dans le bloc "else" de la vérification NEXUS_TEST_DB_URL`);
  }
});

t('NEXUS_TEST_DB_PASSWORD reste un repli portable, pas un nouveau secret', () => {
  for (const { nom, src } of SCRIPTS) {
    assert.ok(/NEXUS_TEST_DB_PASSWORD/.test(src),
      `${nom} : un rail sans trousseau macOS (CI Linux) doit pouvoir fournir le MÊME mot de passe autrement`);
  }
});

t('le message d’échec nomme les TROIS voies désormais possibles', () => {
  for (const { nom, src } of SCRIPTS) {
    const iEchec = src.indexOf('Mot de passe introuvable');
    assert.ok(iEchec > 0, `${nom} : message d’échec introuvable`);
    const ligne = src.slice(iEchec, src.indexOf('\n', iEchec));
    assert.ok(/trousseau/.test(ligne) && /NEXUS_TEST_DB_PASSWORD/.test(ligne),
      `${nom} : le message d’échec doit citer trousseau et NEXUS_TEST_DB_PASSWORD`);
  }
});

t('PRODUCTION reste refusée AVANT toute résolution de connexion', () => {
  for (const { nom, src } of SCRIPTS) {
    const iRefus = src.indexOf('REFUS : ');
    const iUrl = src.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then');
    assert.ok(iRefus > 0 && iRefus < iUrl, `${nom} : le refus Production ne doit dépendre d’aucune résolution de connexion`);
  }
});

t('la syntaxe bash des deux scripts reste valide', () => {
  const { execFileSync } = require('child_process');
  for (const { nom } of SCRIPTS) {
    execFileSync('bash', ['-n', path.join(__dirname, 'outils', nom)], { encoding: 'utf8' });
  }
});

t('MUTATION NÉGATIVE — reproduire le bug réel (trousseau avant l’URL) fait échouer l’épreuve d’ordre', () => {
  // Reproduit textuellement la forme du bug trouvé le 09/09/2026 : la
  // recherche trousseau réinjectée AVANT la vérification de NEXUS_TEST_DB_URL.
  // Si l'assertion d'ordre ne peut PAS échouer sur ce texte, elle ne teste
  // rien — donc on l'exécute ici, à la main, sur une copie mutée en mémoire,
  // pour CHACUN des deux scripts.
  for (const { nom, src } of SCRIPTS) {
    const marqueurAncrage = nom === 'reconstruire-base-test.sh'
      ? 'RACINE="$(cd "$(dirname "$0")/.." && pwd)"\n'
      : 'RACINE="$(cd "$(dirname "$0")/.." && pwd)"\n';
    const boguee = src.replace(
      marqueurAncrage,
      marqueurAncrage +
      'MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"\n' +
      'if [ -z "$MDP" ]; then exit 4; fi\n'
    );
    assert.notStrictEqual(boguee, src, `${nom} : préparation de mutation invalide — le remplacement n’a rien trouvé`);

    const iKeychainMute = boguee.indexOf('security find-generic-password');
    const iUrlMute = boguee.indexOf('if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then');
    assert.ok(iKeychainMute < iUrlMute, `${nom} : la mutation doit reproduire le bug réel (trousseau avant l’URL)`);

    // C'est l'assertion même du premier test de ce fichier, rejouée contre le
    // texte muté : elle DOIT échouer, sinon l'épreuve d'ordre est aveugle au
    // bug qu'elle prétend détecter.
    assert.throws(() => {
      assert.ok(iUrlMute < iKeychainMute, 'NEXUS_TEST_DB_URL doit précéder le trousseau');
    }, `${nom} : l’épreuve d’ordre doit refuser la version buguée — sinon elle ne prouve rien sur la version corrigée`);
  }
});

console.log(`\n${n}/${n} vérifications passées — une URL déjà résolue par l’appelant n’est plus jamais bloquée par un trousseau absent, dans aucun des deux scripts.`);
