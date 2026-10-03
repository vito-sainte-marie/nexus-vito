#!/usr/bin/env node
// Le véhicule qui applique 20261003180000 (écriture bornée du rôle CI sur
// station_config, avec la lecture que `excluded.*` exige — elle rejoue et
// complète 20261003170000) sur nexus-test — mis en situation, jamais lu.
//
// CONSTAT (03/10/2026, request-20). L'épreuve request-20 échoue en 42501 sous
// `nexus_ci_recette`. La migration qui lui donne une écriture bornée aux deux
// sites synthétiques est versionnée, mais son application exige une connexion
// `postgres` : c'est un geste de Frédéric, porté par
// `outils/appliquer-migration-ecriture-bornee-station-config-test-a-executer-par-frederic.sh`.
// Un geste humain qu'on ne peut pas répéter doit être juste du premier coup :
// cette épreuve prouve que le véhicule refuse la mauvaise cible, mesure avant
// d'écrire, et ne rend un succès que sur une mesure des bornes — jamais sur le
// code de sortie de psql.
//
// MÊME DISCIPLINE QUE test_vehicule_migration_login_production_20261001.js :
// on juge ce que le véhicule FAIT, pas ce qu'il MENTIONNE ; la source n'est lue
// que pour les assertions où le texte EST la propriété (aucune expansion de
// `$URL_PRODUCTION` ni de `$SUPABASE_TEST_DB_URL_WRITE`) et pour fabriquer les
// mutations.
//
// AUCUNE VRAIE BASE. `security` est un leurre (127, ou un secret canned) ;
// `psql` est un leurre qui reconnaît les cinq requêtes du véhicule — mesure de
// cible, mesure des bornes, colonnes du registre, estampille, application `-f`
// — et journalise chacune. Le seul appel au VRAI psql vise 127.0.0.1:1 via
// `?host=` : l'URL nomme bien l'hôte de nexus-test (le contrôle de cible doit
// passer) mais libpq se connecte à un port mort.
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RACINE = __dirname;
const SCRIPT = path.join(RACINE, 'outils',
  'appliquer-migration-ecriture-bornee-station-config-test-a-executer-par-frederic.sh');
const SRC = fs.readFileSync(SCRIPT, 'utf8');
const REF_TEST = 'udljdqxerrbbbajxubfn';
const REF_PROD = 'uzhjpqpctpvxytxpxoqz';
const HOTE_TEST = `db.${REF_TEST}.supabase.co`;
// Nomme l'hôte direct de Test (le contrôle de cible passe), se connecte à un port mort.
const URL_MORTE_TEST = `postgresql://postgres@${HOTE_TEST}:5432/postgres?host=127.0.0.1&port=1&sslmode=disable&connect_timeout=3`;
const SECRET_TEMOIN = 'MotDePasseTemoin-7f3a9c';

// Les bornes, telles que le véhicule les attend — recopiées ici À LA MAIN
// depuis la migration, pour qu'une dérive des constantes du véhicule rougisse.
const INS = 'fuseau_horaire,horaires,prix_carburants,site,updated_at';
const UPD = 'horaires,prix_carburants,updated_at';
const SEL = 'carburant_commande_config,cuves_carburants,fuseau_horaire,horaires,prix_carburants,site,updated_at';
// Les quatre colonnes lisibles depuis SEC-018 (20260909110000), hors de cette migration.
const SEL_SEC018 = 'carburant_commande_config,cuves_carburants,fuseau_horaire,site';
const bornes = (o = {}) => [
  o.table || 'AUCUN_DROIT_DE_TABLE', o.ins ?? INS, o.upd ?? UPD, o.sel ?? SEL,
  o.pol || '7', o.miennes || '3', o.est || 'ESTAMPILLE_PRESENTE',
].join('|');
const BORNES_AVANT = bornes({ ins: '-', upd: '-',
  sel: 'carburant_commande_config,cuves_carburants,fuseau_horaire,site',
  pol: '4', miennes: '0', est: 'ESTAMPILLE_ABSENTE' });
// L'état RÉEL de nexus-test le 03/10/2026 après 20261003170000 seule : écriture
// posée, lecture `excluded.*` manquante, estampille 20261003180000 absente.
const BORNES_APRES_170000 = bornes({
  sel: 'carburant_commande_config,cuves_carburants,fuseau_horaire,prix_carburants,site',
  est: 'ESTAMPILLE_ABSENTE' });

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

function envPropre(ajouts) {
  const e = { ...process.env };
  for (const v of Object.keys(e)) if (v.startsWith('FAKE_')) delete e[v];
  for (const v of ['NEXUS_TEST_DB_URL_WRITE', 'NEXUS_TEST_DB_USER_WRITE', 'URL_PRODUCTION',
                   'SUPABASE_TEST_DB_URL_WRITE', 'NEXUS_PROD_DB_URL_WRITE', 'PGPASSWORD',
                   'DATABASE_URL']) delete e[v];
  // La locale de Frédéric, pas celle du banc : sous bash 3.2 en UTF-8, `$X…`
  // avale le premier octet de « … » dans le nom de variable (03/10/2026, le
  // véhicule a planté en `IDENTITE\xe2: unbound variable` à son premier usage
  // réel, alors que cette épreuve, jouée en locale C, était verte).
  return { ...e, LANG: 'fr_FR.UTF-8', LC_ALL: 'fr_FR.UTF-8', ...ajouts };
}

// `security` : absent (127) sauf si FAKE_SECURITY_SECRET est fourni.
const LEURRES = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-security-'));
fs.writeFileSync(path.join(LEURRES, 'security'), `#!/bin/sh
if [ -n "\${FAKE_SECURITY_SECRET:-}" ]; then printf '%s\\n' "$FAKE_SECURITY_SECRET"; exit 0; fi
exit 127
`);
fs.chmodSync(path.join(LEURRES, 'security'), 0o755);

// `psql` : reconnaît chaque requête du véhicule par un marqueur de son texte,
// et journalise le mode, l'URL reçue et la présence de PGPASSWORD.
const PSQL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-psql-'));
fs.writeFileSync(path.join(PSQL_DIR, 'psql'), `#!/bin/sh
URLRECUE="$1"
MODE=inconnu; REQ=""; PREC=""
for a in "$@"; do
  [ "$PREC" = "-f" ] && MODE=appliquer
  [ "$PREC" = "-c" ] && REQ="$a"
  PREC="$a"
done
if [ "$MODE" != "appliquer" ]; then
  case "$REQ" in
    *current_database*)            MODE=mesure ;;
    *has_table_privilege*)         MODE=bornes ;;
    *information_schema.columns*)  MODE=registre ;;
    *"insert into supabase_migrations"*) MODE=estampille ;;
  esac
fi
if [ -n "\${FAKE_JOURNAL:-}" ]; then
  printf '%s|%s|%s\\n' "$MODE" "$URLRECUE" "\${PGPASSWORD:+PGPASSWORD_PRESENT}" >> "$FAKE_JOURNAL"
fi
if [ "\${FAKE_ECHEC:-}" = "$MODE" ]; then
  echo "FATAL:  could not connect to postgresql://postgres:${SECRET_TEMOIN}@${HOTE_TEST}/postgres (leurre)" >&2
  exit 2
fi
case "$MODE" in
  mesure)
    if [ -n "\${FAKE_MESURE_BRUTE:-}" ]; then printf '%s\\n' "$FAKE_MESURE_BRUTE"; exit 0; fi
    printf '%s|%s|%s|%s|%s|%s\\n' "\${FAKE_DB:-postgres}" "\${FAKE_USER:-postgres}" \\
      "\${FAKE_LECTURE:-ECRITURE_POSSIBLE}" "\${FAKE_RECUP:-PRIMAIRE}" \\
      "\${FAKE_PROPRIETE:-PROPRIETAIRE_OUI}" "\${FAKE_ROLE:-ROLE_PRESENT}" ;;
  bornes)     printf '%s\\n' "\${FAKE_BORNES:-}" ;;
  registre)   printf '%s\\n' "\${FAKE_REGISTRE:-name,statements,version}" ;;
  estampille) : ;;
  appliquer)  printf '%s\\n' "\${FAKE_TRANSCRIPT:-DO}"; exit "\${FAKE_CODE_APPLIQUER:-0}" ;;
  *)          echo "leurre psql : requete non reconnue" >&2; exit 99 ;;
esac
`);
fs.chmodSync(path.join(PSQL_DIR, 'psql'), 0o755);

const PATH_SECURITY_SEUL = `${LEURRES}:${process.env.PATH}`;
const PATH_PSQL_LEURRE = `${PSQL_DIR}:${LEURRES}:${process.env.PATH}`;
const DOSSIER_VIDE = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-vide-'));
const PATH_SANS_RIEN = DOSSIER_VIDE;
const CWD_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-cwd-'));
const BASH_BIN = fs.existsSync('/bin/bash') ? '/bin/bash'
  : (fs.existsSync('/usr/bin/bash') ? '/usr/bin/bash' : 'bash');

function executer(script, args, env, cwd) {
  const r = spawnSync(BASH_BIN, [script, ...(args || [])], {
    env: envPropre(env || {}), encoding: 'utf8', timeout: 20000, cwd: cwd || RACINE,
  });
  assert.strictEqual(r.error, undefined, `spawn a échoué : ${r.error}`);
  assert.notStrictEqual(r.status, null, `tué par un signal (${r.signal})`);
  return r;
}
const lancer = (args, env, cwd) => executer(SCRIPT, args, env, cwd);

let nJournal = 0;
function journal() {
  return path.join(os.tmpdir(), `nexus-ecb-journal-${process.pid}-${nJournal++}.txt`);
}
const lireJournal = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n') : []);

// Une variante du véhicule, écrite dans un bac, qui doit encore compiler.
function variante(remplacer, par) {
  assert.ok(SRC.includes(remplacer), `ancre de mutation introuvable : ${remplacer.slice(0, 60)}…`);
  assert.strictEqual(SRC.split(remplacer).length, 2,
    'ancre de mutation non unique : la mutation éditerait ailleurs');
  const mute = SRC.replace(remplacer, par);
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-mute-'));
  const f = path.join(bac, 'mute.sh');
  fs.writeFileSync(f, mute);
  const syntaxe = spawnSync(BASH_BIN, ['-n', f], { encoding: 'utf8' });
  assert.strictEqual(syntaxe.status, 0, `la variante ne compile plus : ${syntaxe.stderr}`);
  return { f, bac };
}

const EN_LEURRE = { PATH: PATH_PSQL_LEURRE, NEXUS_TEST_DB_URL_WRITE: URL_MORTE_TEST };

console.log('\nLe véhicule de l\'écriture bornée station_config sur nexus-test\n');

// ── A. Usage ────────────────────────────────────────────────────────────
t('un argument inconnu refuse en USAGE (exit 1)', () => {
  const r = lancer(['--force'], { PATH: PATH_SANS_RIEN });
  assert.strictEqual(r.status, 1, `attendu 1, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/Usage/.test(r.stderr));
});

// ── B. psql introuvable, avec son contre-témoin ───────────────────────────
t('psql introuvable (ni PATH ni repli) → PSQL_INTROUVABLE (exit 2)', () => {
  const REPLI = '/opt/homebrew/opt/libpq/bin/psql';
  const sansRepli = SRC.split(REPLI).join(path.join(DOSSIER_VIDE, 'psql-absent'));
  assert.notStrictEqual(sansRepli, SRC, 'la substitution du repli n\'a rien changé');
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-sans-psql-'));
  const f = path.join(bac, 'sans-psql.sh');
  fs.writeFileSync(f, sansRepli);
  const r = executer(f, [], { PATH: PATH_SANS_RIEN });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.strictEqual(r.status, 2, `attendu 2, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/psql introuvable/.test(r.stderr));
});
t('contre-témoin : le motif 2 suit l\'existence réelle du repli, pas le PATH', () => {
  const r = lancer([], { PATH: PATH_SANS_RIEN });
  if (fs.existsSync('/opt/homebrew/opt/libpq/bin/psql')) assert.notStrictEqual(r.status, 2);
  else assert.strictEqual(r.status, 2);
});

// ── C. Artefact ─────────────────────────────────────────────────────────
t('--appliquer sans l\'artefact → ARTEFACT_INTROUVABLE (exit 4), avant toute connexion', () => {
  const j = journal();
  const r = lancer(['--appliquer'], { ...EN_LEURRE, FAKE_JOURNAL: j }, CWD_TMP);
  assert.strictEqual(r.status, 4, `attendu 4, obtenu ${r.status} : ${r.stderr}`);
  assert.deepStrictEqual(lireJournal(j), [], 'psql a été appelé avant le refus');
});
t('l\'artefact désigné par le véhicule existe dans le dépôt', () => {
  const m = SRC.match(/^ARTEFACT="([^"]+)"/m);
  assert.ok(m && fs.existsSync(path.join(RACINE, m[1])), `artefact absent : ${m && m[1]}`);
});

// ── D. Secret — et les deux variables qui ne doivent JAMAIS être lues ────
t('ni NEXUS_TEST_DB_URL_WRITE ni trousseau → SECRET_ABSENT (exit 3)', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL });
  assert.strictEqual(r.status, 3, `attendu 3, obtenu ${r.status} : ${r.stderr}`);
  assert.ok(/SECRET_ABSENT/.test(r.stderr));
});
for (const v of ['URL_PRODUCTION', 'SUPABASE_TEST_DB_URL_WRITE', 'NEXUS_PROD_DB_URL_WRITE', 'DATABASE_URL']) {
  t(`NON-RÉGRESSION — $${v}, même plausible et visant Test, n'est jamais lu`, () => {
    const j = journal();
    const r = lancer([], { PATH: PATH_PSQL_LEURRE, [v]: URL_MORTE_TEST, FAKE_JOURNAL: j });
    assert.strictEqual(r.status, 3, `$${v} a été consulté : exit ${r.status}. ${r.stdout}${r.stderr}`);
    assert.deepStrictEqual(lireJournal(j), [], 'psql a été appelé');
  });
}
t('la source ne contient aucune expansion de $URL_PRODUCTION ni de $SUPABASE_TEST_DB_URL_WRITE', () => {
  for (const v of ['URL_PRODUCTION', 'SUPABASE_TEST_DB_URL_WRITE']) {
    assert.ok(!new RegExp(`\\$\\{?${v}(?![A-Za-z0-9_])(?!\\})?`).test(SRC.replace(new RegExp(`\\\\\\$${v}`, 'g'), '')),
      `une expansion de $${v} est présente`);
  }
});
t('trousseau en mot de passe nu → URL composée sur l\'hôte direct de Test, PGPASSWORD exporté, secret jamais affiché', () => {
  const j = journal();
  const r = lancer([], { PATH: PATH_PSQL_LEURRE, FAKE_SECURITY_SECRET: SECRET_TEMOIN,
                         FAKE_JOURNAL: j, FAKE_BORNES: BORNES_AVANT });
  assert.strictEqual(r.status, 0, `attendu 0, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  const l = lireJournal(j)[0].split('|');
  assert.strictEqual(l[0], 'mesure');
  assert.ok(l[1].startsWith(`postgresql://postgres@${HOTE_TEST}:5432/postgres?`), `URL composée : ${l[1]}`);
  assert.ok(!l[1].includes('pooler'), 'l\'URL composée vise le pooler');
  assert.strictEqual(l[2], 'PGPASSWORD_PRESENT');
  assert.ok(!(r.stdout + r.stderr).includes(SECRET_TEMOIN), 'le secret apparaît dans la sortie');
});

// ── E. Refus de cible AVANT toute connexion ──────────────────────────────
for (const [cas, url, aiguille] of [
  ['le pooler, même s\'il nomme l\'hôte de Test ailleurs dans l\'URL',
    `postgresql://postgres.${REF_TEST}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?application_name=${HOTE_TEST}`, /pooler/],
  ['la référence Production, même accolée à l\'hôte de Test',
    `postgresql://postgres.${REF_PROD}@${HOTE_TEST}:5432/postgres`, /PRODUCTION/],
  ['un hôte qui n\'est pas db.<ref Test>.supabase.co',
    `postgresql://postgres@127.0.0.1:1/postgres?options=${REF_TEST}`, /ne désigne pas/],
  ['l\'identité nexus_ci_recette',
    `postgresql://nexus_ci_recette@${HOTE_TEST}:5432/postgres`, /nexus_ci_recette/],
]) {
  t(`refus avant connexion : ${cas} → CIBLE_INATTENDUE (exit 5)`, () => {
    const j = journal();
    const r = lancer(['--appliquer'], { PATH: PATH_PSQL_LEURRE, NEXUS_TEST_DB_URL_WRITE: url, FAKE_JOURNAL: j });
    assert.strictEqual(r.status, 5, `attendu 5, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
    assert.ok(/CIBLE_INATTENDUE/.test(r.stderr) && aiguille.test(r.stderr), `motif attendu ${aiguille} : ${r.stderr}`);
    assert.deepStrictEqual(lireJournal(j), [], 'psql a été appelé avant le refus');
  });
}

// ── F. Connexion impossible — VRAI psql, port mort ───────────────────────
t('cible correcte mais injoignable (vrai psql) → CONNEXION_IMPOSSIBLE (exit 6)', () => {
  const r = lancer([], { PATH: PATH_SECURITY_SEUL, NEXUS_TEST_DB_URL_WRITE: URL_MORTE_TEST });
  assert.strictEqual(r.status, 6, `attendu 6, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/CONNEXION_IMPOSSIBLE/.test(r.stderr));
});
t('un échec de connexion qui réimprime l\'URL ne fait jamais sortir le mot de passe', () => {
  const r = lancer([], { ...EN_LEURRE, FAKE_ECHEC: 'mesure' });
  assert.strictEqual(r.status, 6);
  assert.ok(!(r.stdout + r.stderr).includes(SECRET_TEMOIN));
});

// ── G. Préflight mesuré — six causes de refus ────────────────────────────
for (const [cause, env, aiguille] of [
  ['base autre que postgres', { FAKE_DB: 'template1' }, /template1/],
  ['lecture seule', { FAKE_LECTURE: 'LECTURE_SEULE' }, /lecture seule/],
  ['réplica', { FAKE_RECUP: 'REPLICA' }, /réplica/],
  ['table absente', { FAKE_PROPRIETE: 'TABLE_ABSENTE' }, /n'existe pas/],
  ['ni propriétaire ni superutilisateur', { FAKE_PROPRIETE: 'PROPRIETAIRE_NON', FAKE_USER: 'nexus_autre' }, /propriétaire/],
  ['rôle nexus_ci_recette absent', { FAKE_ROLE: 'ROLE_ABSENT' }, /absent/],
]) {
  t(`préflight refuse : ${cause} → PREFLIGHT_REFUS (exit 7), sans rien appliquer`, () => {
    const j = journal();
    const r = lancer(['--appliquer'], { ...EN_LEURRE, FAKE_JOURNAL: j, ...env });
    assert.strictEqual(r.status, 7, `attendu 7, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
    assert.ok(/PREFLIGHT_REFUS/.test(r.stderr) && aiguille.test(r.stderr), r.stderr);
    assert.deepStrictEqual(lireJournal(j).map((l) => l.split('|')[0]), ['mesure']);
  });
}
t('une mesure tronquée (colonnes manquantes) → CONNEXION_IMPOSSIBLE (exit 6), jamais un préflight', () => {
  // Cinq colonnes au lieu de six : la mesure est tronquée.
  const r = lancer([], { ...EN_LEURRE, FAKE_MESURE_BRUTE: 'postgres|postgres|ECRITURE_POSSIBLE|PRIMAIRE|PROPRIETAIRE_OUI' });
  assert.strictEqual(r.status, 6, `attendu 6, obtenu ${r.status} : ${r.stderr}`);
});

// ── H. Mesure seule : zéro écriture, état des bornes rapporté ────────────
t('sans --appliquer → exit 0, ETAT_DES_BORNES rapporté, AUCUN -f ni insert', () => {
  const j = journal();
  const r = lancer([], { ...EN_LEURRE, FAKE_JOURNAL: j, FAKE_BORNES: BORNES_AVANT });
  assert.strictEqual(r.status, 0, `attendu 0, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
  assert.ok(/ETAT_DES_BORNES: ECRITURE_BORNEE_NON_APPLIQUEE/.test(r.stdout), r.stdout);
  assert.ok(/Aucune écriture effectuée/.test(r.stdout));
  assert.deepStrictEqual(lireJournal(j).map((l) => l.split('|')[0]), ['mesure', 'bornes']);
});
t('sans --appliquer, migration déjà en place → le dit, et n\'écrit toujours rien', () => {
  const j = journal();
  const r = lancer([], { ...EN_LEURRE, FAKE_JOURNAL: j, FAKE_BORNES: bornes() });
  assert.strictEqual(r.status, 0);
  assert.ok(/ETAT_DES_BORNES: ECRITURE_BORNEE_APPLIQUEE/.test(r.stdout) && /DÉJÀ appliquée/.test(r.stdout));
  assert.deepStrictEqual(lireJournal(j).map((l) => l.split('|')[0]), ['mesure', 'bornes']);
});
t('sans --appliquer, état de Test après 20261003170000 seule → INCOMPLETE nommant la lecture, sans écriture', () => {
  const j = journal();
  const r = lancer([], { ...EN_LEURRE, FAKE_JOURNAL: j, FAKE_BORNES: BORNES_APRES_170000 });
  assert.strictEqual(r.status, 0);
  assert.ok(/ETAT_DES_BORNES: ECRITURE_BORNEE_INCOMPLETE/.test(r.stdout), r.stdout);
  assert.ok(!/DÉJÀ appliquée/.test(r.stdout), 'un état sans la lecture excluded.* ne doit pas se dire appliqué');
  assert.deepStrictEqual(lireJournal(j).map((l) => l.split('|')[0]), ['mesure', 'bornes']);
});
t('sans --appliquer, bornes illisibles → le dit, mot de passe masqué, toujours exit 0 sans écriture', () => {
  const r = lancer([], { ...EN_LEURRE, FAKE_ECHEC: 'bornes' });
  assert.strictEqual(r.status, 0);
  assert.ok(/ETAT_DES_BORNES: ILLISIBLE/.test(r.stderr));
  assert.ok(!(r.stdout + r.stderr).includes(SECRET_TEMOIN), 'le mot de passe a fui');
});

// ── I. --appliquer : la table des verdicts, psql sortant TOUJOURS en 0 ───
// Le verdict vient de la mesure des bornes après commit. Chaque ligne ci-dessous
// fait sortir l'application en 0 : seul un état mesuré conforme rend 0.
for (const [cas, b, code, verdict] of [
  ['bornes exactes + estampille', bornes(), 0, 'ECRITURE_BORNEE_APPLIQUEE'],
  ['rien accordé', BORNES_AVANT, 30, 'ECRITURE_BORNEE_NON_APPLIQUEE'],
  ['politiques posées mais UPDATE manquant', bornes({ upd: '-' }), 31, 'ECRITURE_BORNEE_INCOMPLETE'],
  ['une politique de recette manquante', bornes({ pol: '6', miennes: '2' }), 31, 'ECRITURE_BORNEE_INCOMPLETE'],
  ['droit de TABLE présent', bornes({ table: 'DROIT_DE_TABLE_PRESENT' }), 32, 'ECRITURE_BORNEE_DEBORDANTE'],
  ['UPDATE sur site (hors bornes)', bornes({ upd: 'horaires,prix_carburants,site,updated_at' }), 32, 'ECRITURE_BORNEE_DEBORDANTE'],
  ['INSERT sur une colonne étrangère', bornes({ ins: `${INS},id` }), 32, 'ECRITURE_BORNEE_DEBORDANTE'],
  ['SELECT sur une colonne étrangère', bornes({ sel: `${SEL},planning_source` }), 32, 'ECRITURE_BORNEE_DEBORDANTE'],
  ['huit politiques', bornes({ pol: '8' }), 32, 'ECRITURE_BORNEE_DEBORDANTE'],
  ['état après 20261003170000 seule (lecture excluded.* absente)', BORNES_APRES_170000, 31, 'ECRITURE_BORNEE_INCOMPLETE'],
  ['bornes exactes, estampille absente', bornes({ est: 'ESTAMPILLE_ABSENTE' }), 34, 'ECRITURE_BORNEE_SANS_ESTAMPILLE'],
  ['bornes exactes, registre absent', bornes({ est: 'REGISTRE_ABSENT' }), 34, 'ECRITURE_BORNEE_SANS_ESTAMPILLE'],
  ['mesure finale vide', '', 33, 'ETAT_FINAL_ABSENT_OU_IMPREVU'],
]) {
  t(`--appliquer, ${cas} (psql en 0) → exit ${code} ${verdict}`, () => {
    const j = journal();
    const r = lancer(['--appliquer'], { ...EN_LEURRE, FAKE_JOURNAL: j, FAKE_BORNES: b });
    assert.strictEqual(r.status, code, `attendu ${code}, obtenu ${r.status} : ${r.stdout}${r.stderr}`);
    assert.ok(new RegExp(`VEHICULE_ETAT_FINAL: ${verdict}`).test(r.stdout + r.stderr), r.stdout + r.stderr);
    assert.deepStrictEqual(lireJournal(j).map((l) => l.split('|')[0]),
      ['mesure', 'appliquer', 'registre', 'estampille', 'bornes'],
      'ordre des appels : mesurer, appliquer, lire le registre, estampiller, re-mesurer');
  });
}
t('--appliquer, psql en échec réel mais bornes mesurées conformes → le verdict suit la mesure (0)', () => {
  // Le code de psql n'est pas le verdict (§4) : il est imprimé, pas décisif.
  const r = lancer(['--appliquer'], { ...EN_LEURRE, FAKE_CODE_APPLIQUER: '3', FAKE_BORNES: bornes() });
  assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.ok(/code de sortie psql : 3/.test(r.stdout));
});
t('--appliquer, psql en échec réel ET rien accordé → 30, jamais 0', () => {
  const r = lancer(['--appliquer'], { ...EN_LEURRE, FAKE_CODE_APPLIQUER: '3', FAKE_BORNES: BORNES_AVANT });
  assert.strictEqual(r.status, 30);
});
t('--appliquer joue l\'artefact avec ON_ERROR_STOP=1', () => {
  assert.ok(/-v ON_ERROR_STOP=1[^\n]*-f "\$ARTEFACT"/.test(SRC));
});
for (const [reg, attendu] of [
  ['name,statements,version', /\(version, name, statements\)/],
  ['name,version', /\(version, name\) values/],
  ['version', /\(version\) values/],
]) {
  t(`estampille composée selon le registre mesuré (${reg})`, () => {
    // Le leurre ne restitue pas le texte de -c : on fait échouer l'estampille
    // pour que le véhicule n'aille pas plus loin, puis on vérifie le texte par
    // un psql témoin qui l'écrit dans le journal.
    const temoin = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ecb-temoin-'));
    const f = path.join(temoin, 'psql');
    fs.writeFileSync(f, fs.readFileSync(path.join(PSQL_DIR, 'psql'), 'utf8')
      .replace('estampille) : ;;', 'estampille) printf "%s\\n" "$REQ" >> "$FAKE_JOURNAL.req" ;;'));
    fs.chmodSync(f, 0o755);
    const j = journal();
    const r = lancer(['--appliquer'], { ...EN_LEURRE, PATH: `${temoin}:${LEURRES}:${process.env.PATH}`,
      FAKE_JOURNAL: j, FAKE_REGISTRE: reg, FAKE_BORNES: bornes() });
    const req = fs.readFileSync(`${j}.req`, 'utf8');
    fs.rmSync(temoin, { recursive: true, force: true });
    fs.rmSync(`${j}.req`, { force: true });
    assert.strictEqual(r.status, 0);
    assert.ok(attendu.test(req) && /'20261003180000'/.test(req) && /on conflict \(version\) do nothing/.test(req), req);
  });
}

// ── I bis. Locale ────────────────────────────────────────────────────────
t('aucune expansion $NOM n\'est collée à un caractère non ASCII (bash 3.2 en UTF-8 l\'avale)', () => {
  const fautifs = SRC.split('\n').map((l, i) => [i + 1, l])
    .filter(([, l]) => /\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7f]/.test(l));
  assert.deepStrictEqual(fautifs, [], `expansions à accolader : ${fautifs.map(([n]) => n).join(', ')}`);
});
// Le contre-témoin n'a de sens que là où le geste a lieu : le bash 3.2 de macOS.
// Sur le runner Linux (bash 5, fr_FR.UTF-8 pas forcément généré), c'est
// l'assertion statique ci-dessus qui porte seule la propriété.
t('contre-témoin (macOS) : la locale du banc reproduit bien le défaut (sinon l\'épreuve ne prouve rien)', () => {
  if (process.platform !== 'darwin') { console.log('    (hors macOS : porté par l\'assertion statique)'); return; }
  const r = spawnSync(BASH_BIN, ['-uc', 'X=a; echo "$X\u2026"'], { env: envPropre({}), encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0, 'en fr_FR.UTF-8, bash n\'avale plus l\'octet : le banc ne reproduit pas la condition réelle');
});

// ── J. La migration et les constantes du véhicule disent la même chose ───
t('les constantes du véhicule recopient les bornes de la migration', () => {
  const m = SRC.match(/^ARTEFACT="([^"]+)"/m);
  const sql = fs.readFileSync(path.join(RACINE, m[1]), 'utf8');
  const cols = (verbe) => {
    // Hors commentaires : l'en-tête cite des `grant` qui ne sont pas exécutés.
    const x = sql.replace(/^\s*--.*$/gm, '').match(new RegExp(`grant ${verbe} \\(([^)]+)\\)`, 'i'));
    assert.ok(x, `grant ${verbe} introuvable dans la migration`);
    return x[1].split(',').map((s) => s.trim()).sort().join(',');
  };
  assert.strictEqual(cols('insert'), INS);
  assert.strictEqual(cols('update'), UPD);
  const lues = [...new Set([...SEL_SEC018.split(','), ...cols('select').split(',')])].sort().join(',');
  assert.strictEqual(lues, SEL, 'grant select de la migration + SEC-018 ≠ SELECT_ATTENDU');
  for (const [c, v] of [['INSERT_ATTENDU', INS], ['UPDATE_ATTENDU', UPD], ['SELECT_ATTENDU', SEL]]) {
    assert.ok(SRC.includes(`${c}="${v}"`), `${c} du véhicule ne vaut pas ${v}`);
  }
  for (const site of ['nexus-test-repro-23502-neuf', 'nexus-test-repro-23502-existant']) {
    assert.ok(sql.includes(`'${site}'`), `site synthétique ${site} absent de la migration`);
  }
  assert.ok(!/nexus-station-test'/.test(sql.replace(/^\s*--.*$/gm, '')),
    'la migration nomme nexus-station-test hors commentaire');
});

// Le défaut du run 37143142272 : `on conflict … do update set col = excluded.col`
// LIT `col`, donc exige SELECT sur `col`. 20261003170000 l'avait oublié pour
// `horaires` et `updated_at`. Toute colonne lue par `excluded.*` dans les deux
// épreuves qui écrivent sous ce rôle doit être dans la borne de lecture.
t('toute colonne lue par excluded.* dans les épreuves est dans SELECT_ATTENDU', () => {
  const lisibles = new Set(SEL.split(','));
  let vues = 0;
  for (const f of ['outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql',
                   'outils/epreuve-bornage-ecriture-recette-station-config-20261003.sql']) {
    const sql = fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/^\s*--.*$/gm, '');
    for (const m of sql.matchAll(/\bexcluded\.([a-z_]+)/g)) {
      vues++;
      assert.ok(lisibles.has(m[1]), `${f} lit excluded.${m[1]}, absent de SELECT_ATTENDU : 42501 assuré`);
    }
  }
  assert.ok(vues >= 6, `seulement ${vues} lecture(s) excluded.* trouvée(s) : le motif ne voit plus les épreuves`);
});
t('MUTATION : retirer updated_at de la borne de lecture → la garde excluded.* mord', () => {
  const sans = SEL.split(',').filter((c) => c !== 'updated_at');
  const sql = fs.readFileSync(path.join(RACINE,
    'outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql'), 'utf8').replace(/^\s*--.*$/gm, '');
  const manquantes = [...sql.matchAll(/\bexcluded\.([a-z_]+)/g)].map((m) => m[1]).filter((c) => !sans.includes(c));
  assert.ok(manquantes.includes('updated_at'), 'la mutation n\'a rien fait rougir');
});

// ── K. MUTATIONS NÉGATIVES — chaque garde doit mordre ────────────────────
t('MUTATION : retirer le refus du pooler laisse passer une URL pooler qui nomme Test → la garde E mord', () => {
  const debut = '# §5 — le pooler d\'abord';
  const i = SRC.indexOf(debut);
  const fin = SRC.indexOf('esac', i) + 'esac'.length;
  const { f, bac } = variante(SRC.slice(i, fin), '# (refus du pooler retiré par mutation)');
  const r = executer(f, [], { ...EN_LEURRE, FAKE_BORNES: BORNES_AVANT, NEXUS_TEST_DB_URL_WRITE:
    `postgresql://postgres.${REF_TEST}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?application_name=${HOTE_TEST}` });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.notStrictEqual(r.status, 5,
    'sans le refus du pooler, l\'URL est encore refusée en 5 : l\'épreuve E ne prouverait pas cette garde');
});
t('MUTATION : retirer le contrôle de propriété fait passer un rôle non propriétaire → la garde G mord', () => {
  const { f, bac } = variante('if [ "$PROPRIETE" != "PROPRIETAIRE_OUI" ]; then',
                              'if false; then');
  const r = executer(f, ['--appliquer'], { ...EN_LEURRE, FAKE_PROPRIETE: 'PROPRIETAIRE_NON', FAKE_BORNES: bornes() });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.notStrictEqual(r.status, 7, 'la mutation reste refusée en 7 : la garde mesurée ne serait pas celle-ci');
});
t('MUTATION : un deborde() muet transforme un débordement en INCOMPLETE → la table I mord', () => {
  const { f, bac } = variante('  [ "$liste" = "-" ] && return 1\n', '  return 1\n');
  const r = executer(f, ['--appliquer'], { ...EN_LEURRE,
    FAKE_BORNES: bornes({ upd: 'horaires,prix_carburants,site,updated_at' }) });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.notStrictEqual(r.status, 32, 'avec deborde() muet, le débordement serait encore vu : la mutation est mal visée');
});
t('MUTATION : refus nexus_ci_recette retiré → l\'identité CI atteint la connexion', () => {
  const { f, bac } = variante('  *nexus_ci_recette*)\n', '  *nexus_ci_recette_mutation_jamais*)\n');
  const j = journal();
  const r = executer(f, [], { PATH: PATH_PSQL_LEURRE, FAKE_JOURNAL: j, FAKE_BORNES: BORNES_AVANT,
    NEXUS_TEST_DB_URL_WRITE: `postgresql://nexus_ci_recette@${HOTE_TEST}:5432/postgres` });
  fs.rmSync(bac, { recursive: true, force: true });
  assert.notStrictEqual(r.status, 5);
  assert.ok(lireJournal(j).length > 0, 'la mutation n\'a pas atteint psql');
});

// ── Ménage ───────────────────────────────────────────────────────────────
for (const d of [LEURRES, PSQL_DIR, DOSSIER_VIDE, CWD_TMP]) fs.rmSync(d, { recursive: true, force: true });
for (let i = 0; i < nJournal; i++) {
  fs.rmSync(path.join(os.tmpdir(), `nexus-ecb-journal-${process.pid}-${i}.txt`), { force: true });
}

if (process.exitCode) {
  console.error(`\nÉCHEC — ${passes} vérification(s) passée(s), mais au moins une a refusé ci-dessus.`);
} else {
  console.log(`\n${passes} vérifications passées — le véhicule refuse la mauvaise cible, mesure avant d'écrire, et ne juge que sur l'état mesuré.`);
}
