#!/usr/bin/env node
// Le véhicule qui joue la migration du login Production — mis en situation,
// jamais lu.
//
// CONSTAT (réveil du 01/10/2026, issue #28). La procédure prescrivait un
// geste à la main :
//
//   psql "$URL_PRODUCTION" -v ON_ERROR_STOP=1 -f outils/migration-login-production-a-executer-par-frederic.sql
//
// `$URL_PRODUCTION` n'a jamais été défini nulle part dans ce dépôt. `psql` a
// reçu une chaîne vide — ce qui ne lève AUCUNE erreur de variable manquante,
// puisque `"${URL_PRODUCTION}"` se développe simplement en rien — et s'est
// rabattu sur ses paramètres de connexion par défaut, rendant un message qui
// ne nommait ni la variable en cause ni la cible visée. L'artefact SQL
// lui-même n'était pour rien dans cet échec : le défaut vivait dans la
// documentation, pas dans le fichier joué.
//
// CETTE ÉPREUVE MET LE VÉHICULE EN SITUATION, elle ne lit pas sa source —
// sauf pour la seule assertion où le texte EST la propriété recherchée
// (absence de toute expansion de `$URL_PRODUCTION`). Juger un script sur ce
// qu'il MENTIONNE plutôt que sur ce qu'il FAIT est l'erreur déjà commise
// plusieurs fois sur ce chantier (cf. test_credential_seulement_si_necessaire_20260909.js) ;
// on ne la refait pas ici.
//
// DEUX LEURRES, AUCUNE VRAIE BASE. `security` est remplacé par un exécutable
// qui sort en 127 — exactement ce que produit un binaire absent — pour que
// l'absence de trousseau soit déterministe, y compris sur une machine qui en
// a un vrai. `psql` est remplacé, pour les scénarios qui dépendent d'une
// réponse de serveur (rôle en lecture seule, réplica, verdict final), par un
// exécutable qui rend une mesure ou une transcription CANNED selon des
// variables d'environnement — jamais une vraie connexion réseau. Pour les
// scénarios qui ne dépendent QUE de la barrière credential/cible (avant toute
// requête), le VRAI `psql` est gardé, pointé sur une connexion morte
// (127.0.0.1:1) : le véhicule ne doit jamais prétendre avoir mesuré quoi que
// ce soit dans ces cas-là.
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RACINE = __dirname;
const SCRIPT = path.join(RACINE, 'outils', 'appliquer-migration-login-production-a-executer-par-frederic.sh');
const SRC = fs.readFileSync(SCRIPT, 'utf8');
const REF = 'uzhjpqpctpvxytxpxoqz';
const URL_MORTE_AVEC_REF = `postgresql://postgres.${REF}@127.0.0.1:1/postgres?sslmode=disable`;

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

// L'environnement de la répétition ne doit pas fuir dans ses épreuves — même
// discipline que test_credential_seulement_si_necessaire_20260909.js.
function envPropre(ajouts) {
  const e = { ...process.env };
  for (const v of ['NEXUS_PROD_DB_URL_WRITE', 'NEXUS_PROD_DB_USER_WRITE', 'URL_PRODUCTION',
                   'PGPASSWORD', 'FAKE_PSQL_CONNECT_FAIL', 'FAKE_PSQL_TRANSCRIPT',
                   'FAKE_PSQL_EXIT_CODE', 'FAKE_DB', 'FAKE_USER', 'FAKE_LECTURE',
                   'FAKE_RECUP', 'FAKE_CREATE']) delete e[v];
  return { ...e, ...ajouts };
}

// Un leurre qui se comporte comme un `security` absent — jamais de vrai
// trousseau consulté par cette épreuve.
const LEURRES = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-vehicule-'));
fs.writeFileSync(path.join(LEURRES, 'security'), '#!/bin/sh\nexit 127\n');
fs.chmodSync(path.join(LEURRES, 'security'), 0o755);

// Un leurre `psql` CONTRÔLÉ PAR L'ENVIRONNEMENT : il ne sait faire que deux
// choses, exactement les deux que le véhicule lui demande — une mesure (`-c`)
// ou jouer l'artefact (`-f`) — et c'est voulu : un leurre qui en saurait plus
// mesurerait moins précisément ce que le véhicule lui demande réellement.
const PSQL_LEURRE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-psql-'));
fs.writeFileSync(path.join(PSQL_LEURRE_DIR, 'psql'), `#!/bin/sh
if [ "\${FAKE_PSQL_CONNECT_FAIL:-0}" = "1" ]; then
  echo "FATAL:  connection to server failed (leurre deterministe)" >&2
  exit 1
fi
MODE=mesure
for a in "$@"; do
  if [ "$a" = "-f" ]; then MODE=appliquer; fi
done
if [ "$MODE" = "appliquer" ]; then
  printf '%s\\n' "\${FAKE_PSQL_TRANSCRIPT:-}"
  exit "\${FAKE_PSQL_EXIT_CODE:-0}"
else
  printf '%s|%s|%s|%s|%s\\n' "\${FAKE_DB:-postgres}" "\${FAKE_USER:-postgres}" \\
    "\${FAKE_LECTURE:-ECRITURE_POSSIBLE}" "\${FAKE_RECUP:-PRIMAIRE}" "\${FAKE_CREATE:-CREATE_OUI}"
fi
`);
fs.chmodSync(path.join(PSQL_LEURRE_DIR, 'psql'), 0o755);

// Trois dossiers PATH distincts, pour ne jamais mélanger deux intentions :
// - AVEC_SECURITY_LEURRE_SEUL : vrai psql, faux security — pour la barrière
//   credential/cible, avant toute requête réelle.
// - AVEC_PSQL_LEURRE : faux psql ET faux security — pour tout ce qui dépend
//   d'une réponse de serveur.
// - SANS_RIEN : ni psql ni security — pour PSQL_INTROUVABLE.
const PATH_SECURITY_SEUL = `${LEURRES}:${process.env.PATH}`;
const PATH_PSQL_LEURRE = `${PSQL_LEURRE_DIR}:${LEURRES}:${process.env.PATH}`;
const DOSSIER_VIDE = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-vide-'));
const PATH_SANS_RIEN = DOSSIER_VIDE;

const CWD_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-cwd-')); // sans outils/, donc sans l'artefact

// RÉSOLU UNE FOIS, EN CHEMIN ABSOLU. Le scénario PSQL_INTROUVABLE fournit un
// PATH vide au script — exactement ce qu'il doit mesurer. Si `bash` lui-même
// était lancé par son seul nom, Node le chercherait dans CE MÊME PATH vide et
// ne trouverait rien (status `null`, pas un exit code) : on mesurerait alors
// l'absence de `bash`, pas celle de `psql`. Un chemin absolu retire `bash` de
// cette recherche, sans changer ce que le script voit comme `$PATH`.
const BASH_BIN = fs.existsSync('/bin/bash') ? '/bin/bash'
  : (fs.existsSync('/usr/bin/bash') ? '/usr/bin/bash' : 'bash');

function lancer(args, env, cwd) {
  const r = spawnSync(BASH_BIN, [SCRIPT, ...(args || [])], {
    env: envPropre(env || {}),
    encoding: 'utf8', timeout: 20000, cwd: cwd || RACINE,
  });
  assert.strictEqual(r.error, undefined,
    `spawn a échoué avant même de lancer le script : ${r.error}`);
  assert.notStrictEqual(r.status, null,
    `le script a été tué par un signal (${r.signal}) au lieu de sortir normalement`);
  return r;
}

console.log('\nLe véhicule de remise en service du login Production\n');

// ── A. Usage ────────────────────────────────────────────────────────────
t('un argument inconnu refuse en USAGE (exit 1), sans toucher au réseau', () => {
  const r = lancer(['--n-importe-quoi'], { PATH: PATH_SANS_RIEN });
  assert.strictEqual(r.status, 1, `attendu 1, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/Usage/.test(r.stderr));
});

// ── B. psql introuvable ─────────────────────────────────────────────────
// CE CONTRÔLE NE PEUT PAS ÊTRE UN SIMPLE `PATH` VIDE. Le véhicule porte un
// repli ABSOLU codé en dur (/opt/homebrew/opt/libpq/bin/psql). Sur un poste où
// libpq est installé — celui de Frédéric — vider `PATH` ne rend donc PAS psql
// introuvable : le repli existe, le véhicule le trouve, et il a raison de le
// trouver. La première écriture de ce contrôle postulait le contraire et
// rougissait ici en obtenant 3 (SECRET_ABSENT) : elle mesurait la machine, pas
// la garde. Pour mesurer « psql introuvable » il faut rendre le repli absent,
// dans un bac, comme le fait la mutation de la section L.
t('psql introuvable (ni PATH ni repli) → PSQL_INTROUVABLE (exit 2)', () => {
  const REPLI = '/opt/homebrew/opt/libpq/bin/psql';
  assert.ok(SRC.includes(REPLI),
    `le repli ${REPLI} n'est plus dans la source : ce contrôle ne désigne plus rien`);
  const sansRepli = SRC.split(REPLI).join(path.join(DOSSIER_VIDE, 'psql-absent-de-ce-poste'));
  assert.notStrictEqual(sansRepli, SRC,
    'la substitution du repli n\'a rien changé : elle ne prouve rien');

  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-sans-psql-'));
  const script = path.join(bac, 'sans-psql.sh');
  fs.writeFileSync(script, sansRepli);
  fs.chmodSync(script, 0o755);
  const syntaxe = spawnSync(BASH_BIN, ['-n', script], { encoding: 'utf8' });
  assert.strictEqual(syntaxe.status, 0,
    `le script sans repli ne compile plus : on mesurerait une faute de frappe. ${syntaxe.stderr}`);

  const r = spawnSync(BASH_BIN, [script], {
    env: envPropre({ PATH: PATH_SANS_RIEN }), encoding: 'utf8', timeout: 20000, cwd: RACINE,
  });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.strictEqual(r.status, 2, `attendu 2, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/psql introuvable/.test(r.stderr));
});
// LE CONTRE-TÉMOIN. Sans lui, le rouge ci-dessus pourrait venir d'autre chose
// que de la substitution. Le motif 2 doit suivre l'existence RÉELLE du repli
// sur ce poste, jamais le seul contenu de `PATH`.
t('contre-témoin : le motif 2 suit l\'existence réelle du repli, pas le PATH', () => {
  const replExiste = fs.existsSync('/opt/homebrew/opt/libpq/bin/psql');
  const r = lancer([], { PATH: PATH_SANS_RIEN });
  if (replExiste) {
    assert.notStrictEqual(r.status, 2,
      'le repli existe sur ce poste : refuser en 2 signifierait que le véhicule ne le voit pas');
  } else {
    assert.strictEqual(r.status, 2,
      `aucun psql sur ce poste, ni dans PATH ni au repli : le refus attendu est 2, obtenu ${r.status}`);
  }
});

// ── C. Artefact absent (seulement pertinent avec --appliquer) ──────────
t('--appliquer sans l\'artefact sur disque → ARTEFACT_INTROUVABLE (exit 4), avant toute connexion', () => {
  const r = lancer(['--appliquer'], { PATH: PATH_SECURITY_SEUL }, CWD_TMP);
  assert.strictEqual(r.status, 4, `attendu 4, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/ARTEFACT_INTROUVABLE/.test(r.stderr));
});
t('sans --appliquer, l\'artefact absent n\'est PAS un motif de refus (mode mesure seule)', () => {
  // Le préflight ne dépend pas de l'artefact : seule l'application en a besoin.
  const r = lancer([], { PATH: PATH_SECURITY_SEUL }, CWD_TMP);
  assert.notStrictEqual(r.status, 4,
    `exit 4 en mode mesure seule : l'artefact ne devrait être exigé qu'avec --appliquer. Sortie : ${r.stderr}`);
});

// ── D. Secret absent — ET la non-régression $URL_PRODUCTION ────────────
t('ni NEXUS_PROD_DB_URL_WRITE ni trousseau → SECRET_ABSENT (exit 3)', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL });
  assert.strictEqual(r.status, 3, `attendu 3, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/SECRET_ABSENT/.test(r.stderr));
});
t('NON-RÉGRESSION — $URL_PRODUCTION vide N\'EST JAMAIS lu : même refus SECRET_ABSENT', () => {
  // C'est exactement le piège du 01/10/2026 : une variable exportée vide.
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, URL_PRODUCTION: '' });
  assert.strictEqual(r.status, 3, `attendu 3 (SECRET_ABSENT, inchangé), obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/URL_PRODUCTION/.test(r.stderr),
    'le refus doit nommer explicitement $URL_PRODUCTION pour couper court à la confusion du 01/10');
});
t('NON-RÉGRESSION — $URL_PRODUCTION NON VIDE n\'est pas davantage consulté', () => {
  // Pas seulement le cas vide : une valeur plausible ne doit pas être reprise
  // en douce si NEXUS_PROD_DB_URL_WRITE est absent.
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, URL_PRODUCTION: URL_MORTE_AVEC_REF });
  assert.strictEqual(r.status, 3,
    `URL_PRODUCTION non vide a été consulté : obtenu ${r.status} au lieu de 3 (SECRET_ABSENT). Sortie : ${r.stdout}${r.stderr}`);
});
t('la source ne contient aucune expansion ${URL_PRODUCTION', () => {
  assert.ok(!SRC.includes('${URL_PRODUCTION'),
    'une expansion ${URL_PRODUCTION est présente : la variable qui a piégé le 01/10 est de retour');
});

// ── E. Mauvaise cible ───────────────────────────────────────────────────
t('une URL qui ne nomme pas le projet Production attendu → CIBLE_INATTENDUE (exit 5)', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, NEXUS_PROD_DB_URL_WRITE:
    'postgresql://postgres@127.0.0.1:1/postgres?sslmode=disable' }); // ne nomme pas REF
  assert.strictEqual(r.status, 5, `attendu 5, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/CIBLE_INATTENDUE/.test(r.stderr));
});
t('une identité de lecture seule nommée dans l\'URL est refusée AVANT connexion → CIBLE_INATTENDUE (exit 5)', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, NEXUS_PROD_DB_URL_WRITE:
    `postgresql://nexus_prod_readonly_login@127.0.0.1:1/postgres?options=${REF}` });
  assert.strictEqual(r.status, 5, `attendu 5, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/CIBLE_INATTENDUE/.test(r.stderr) && /lecture seule/.test(r.stderr));
});

// ── F. Connexion impossible (vrai psql, port mort) ─────────────────────
t('cible correcte mais injoignable → CONNEXION_IMPOSSIBLE (exit 6), jamais un faux préflight', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF });
  assert.strictEqual(r.status, 6, `attendu 6, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/CONNEXION_IMPOSSIBLE/.test(r.stderr));
});

// ── G. Préflight mesuré — trois causes de refus, une par une ───────────
for (const [cause, env, aiguille] of [
  ['rôle en lecture seule (transaction_read_only=on)', { FAKE_LECTURE: 'LECTURE_SEULE' }, /lecture seule/],
  ['réplica (pg_is_in_recovery()=true)', { FAKE_RECUP: 'REPLICA' }, /réplica/],
  ['pas de CREATE sur public', { FAKE_CREATE: 'CREATE_NON' }, /CREATE/],
]) {
  t(`préflight mesuré refuse : ${cause} → PREFLIGHT_REFUS (exit 7)`, () => {
    const r = lancer([], { PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF, ...env });
    assert.strictEqual(r.status, 7, `attendu 7, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
    assert.ok(/PREFLIGHT_REFUS/.test(r.stderr));
    assert.ok(aiguille.test(r.stderr), `le motif exact devrait apparaître : ${r.stderr}`);
  });
}

// ── H. Préflight conforme, SANS --appliquer : mesure seule, zéro écriture ─
t('préflight conforme sans --appliquer → exit 0, AUCUNE tentative d\'application', () => {
  const r = lancer([], { PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF });
  assert.strictEqual(r.status, 0, `attendu 0, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/PREFLIGHT_CONFORME/.test(r.stdout));
  assert.ok(/Aucune écriture effectuée/.test(r.stdout));
});

// ── I. --appliquer, nominal simulé ─────────────────────────────────────
t('--appliquer, verdict APPLIQUEE → exit 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: 'ETAT_FINAL MIGRATION_LOGIN_APPLIQUEE — la connexion a son chemin.',
    FAKE_PSQL_EXIT_CODE: '0',
  });
  assert.strictEqual(r.status, 0, `attendu 0, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/VEHICULE_ETAT_FINAL: MIGRATION_LOGIN_APPLIQUEE/.test(r.stdout));
});

// ── J. --appliquer, refus/rollback — LE CAS QUI COMPTE LE PLUS ─────────
// psql sort 0 (c'est exactement ce que la procédure a mesuré le 01/10 sans
// ON_ERROR_STOP) alors que la transcription dit NON_APPLIQUEE. Le véhicule ne
// doit JAMAIS annoncer un succès ici.
t('--appliquer, verdict NON_APPLIQUEE MALGRÉ un psql sorti en 0 → exit 30, jamais 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: 'ETAT_FINAL MIGRATION_LOGIN_NON_APPLIQUEE — un ARRET a annulé la transaction.',
    FAKE_PSQL_EXIT_CODE: '0',
  });
  assert.strictEqual(r.status, 30, `attendu 30, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.notStrictEqual(r.status, 0, 'JAMAIS un succès après un refus — même si psql est sorti en 0');
  assert.ok(/VEHICULE_ETAT_FINAL: MIGRATION_LOGIN_NON_APPLIQUEE/.test(r.stderr));
});
t('--appliquer, verdict INCOMPLETE → exit 31, jamais 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: 'ETAT_FINAL MIGRATION_LOGIN_INCOMPLETE — SELECT anonyme encore ouvert.',
    FAKE_PSQL_EXIT_CODE: '0',
  });
  assert.strictEqual(r.status, 31, `attendu 31, obtenu ${r.status}`);
});
t('--appliquer, verdict INCOHERENTE → exit 32, jamais 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: 'ETAT_FINAL MIGRATION_LOGIN_INCOHERENTE — la vue a disparu.',
    FAKE_PSQL_EXIT_CODE: '0',
  });
  assert.strictEqual(r.status, 32, `attendu 32, obtenu ${r.status}`);
});

// ── K. --appliquer, aucune ligne ETAT_FINAL reconnue — jamais un succès ─
t('--appliquer, transcription sans ETAT_FINAL reconnaissable (psql sorti en 0) → exit 33, jamais 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: 'NOTICE:  une connexion a été coupée avant la fin du script.',
    FAKE_PSQL_EXIT_CODE: '0',
  });
  assert.strictEqual(r.status, 33, `attendu 33, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/ABSENT_OU_IMPREVU/.test(r.stderr));
});
t('--appliquer, psql sorti en échec réel sans transcription → exit 33, jamais 0', () => {
  const r = lancer(['--appliquer'], {
    PATH: PATH_PSQL_LEURRE, NEXUS_PROD_DB_URL_WRITE: URL_MORTE_AVEC_REF,
    FAKE_PSQL_TRANSCRIPT: '', FAKE_PSQL_EXIT_CODE: '2',
  });
  assert.notStrictEqual(r.status, 0, `jamais un succès : obtenu ${r.status}`);
  assert.strictEqual(r.status, 33, `attendu 33, obtenu ${r.status}`);
});

// ── L. MUTATION NÉGATIVE — réintroduire le défaut du 01/10 ─────────────
// Sans cette épreuve, rien ci-dessus ne prouve que le test D détecterait
// réellement un retour du défaut : il prouve seulement que le fichier actuel
// ne l'a pas. On le vérifie en le réintroduisant.
t('MUTATION : réintroduire ${URL_PRODUCTION} comme source primaire fait échouer la non-régression', () => {
  const mute = SRC.replace(
    'URL="${NEXUS_PROD_DB_URL_WRITE:-}"',
    'URL="${URL_PRODUCTION:-}"');
  assert.notStrictEqual(mute, SRC, 'la mutation n\'a rien changé : elle ne prouve rien');

  const dossierMute = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-login-mute-'));
  const fichierMute = path.join(dossierMute, 'mute.sh');
  fs.writeFileSync(fichierMute, mute);
  fs.chmodSync(fichierMute, 0o755);

  // Avec la mutation, une valeur plausible dans $URL_PRODUCTION DOIT être
  // reprise : le script progresse au-delà de SECRET_ABSENT (jusqu'à une
  // tentative de connexion, ici morte — exit 6, jamais 3).
  const r = spawnSync(BASH_BIN, [fichierMute], {
    env: envPropre({ PATH: PATH_SECURITY_SEUL, URL_PRODUCTION: URL_MORTE_AVEC_REF }),
    encoding: 'utf8', timeout: 20000, cwd: RACINE,
  });
  assert.notStrictEqual(r.status, 3,
    'la mutation aurait dû faire consulter $URL_PRODUCTION (donc dépasser SECRET_ABSENT) ; ' +
    `elle est restée en exit ${r.status} — l'épreuve ne détecterait donc pas un vrai retour du défaut`);

  fs.rmSync(dossierMute, { recursive: true, force: true });
});

// ── Ménage ───────────────────────────────────────────────────────────────
for (const d of [LEURRES, PSQL_LEURRE_DIR, DOSSIER_VIDE, CWD_TMP]) {
  fs.rmSync(d, { recursive: true, force: true });
}

if (process.exitCode) {
  console.error(`\nÉCHEC — ${passes} vérification(s) passée(s), mais au moins une a refusé ci-dessus.`);
} else {
  console.log(`\n${passes} vérifications passées — le véhicule mesure avant d'écrire, et ne ment jamais sur ce qu'il a fait.`);
}
