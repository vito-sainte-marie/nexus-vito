// La résolution de connexion Test refuse-t-elle vraiment ce qu'elle prétend
// refuser, et seulement ça ?
//
// outils/resoudre-connexion-test.sh est la source UNIQUE utilisée par
// outils/reconstruire-base-test.sh et
// outils/repeter-lot-production-readiness-test.sh (09/09/2026) : avant lui,
// chacun construisait sa propre URL vers l'hôte direct
// `db.<ref>.supabase.co`, qui ne publie plus qu'une adresse IPv6 depuis le
// 08/09/2026 — injoignable depuis un runner GitHub Actions. Le mode
// --url-env consomme à la place le secret Test EXISTANT
// (SUPABASE_TEST_DB_URL_WRITE, via un pooler IPv4), jamais un nouveau
// secret. Ces épreuves n'exécutent jamais de vraie connexion réseau :
// chaque cas est conçu pour être tranché AVANT tout appel psql.
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'outils', 'resoudre-connexion-test.sh');
const PROD_REF = 'uzhjpqpctpvxytxpxoqz';
const TEST_REF = 'udljdqxerrbbbajxubfn';

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// Exécute la fonction dans un sous-shell jetable, sans jamais laisser une
// vraie valeur de mot de passe transiter par du texte imprimé dans ce test
// (les URLs ci-dessous sont des identifiants fabriqués, pas des secrets).
function resoudre({ ref, mode, urlEnvName, env = {} }) {
  const wrapper = `
    set -euo pipefail
    RACINE="${__dirname.replace(/"/g, '\\"')}"
    source "$RACINE/outils/resoudre-connexion-test.sh"
    nexus_resoudre_connexion_test "\${1:-}" "\${2:-}" "\${3:-}"
    echo "PGHOST=$PGHOST"
    echo "PGPORT=$PGPORT"
    echo "PGDATABASE=$PGDATABASE"
    echo "PGUSER=$PGUSER"
    echo "PGPASSWORD=$PGPASSWORD"
  `;
  const args = ['-c', wrapper, '--', ref || '', mode || '', urlEnvName || ''];
  try {
    const stdout = execFileSync('bash', args, {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ? e.stdout.toString() : '', stderr: e.stderr ? e.stderr.toString() : '' };
  }
}

t('sans référence de projet, refus avant tout — code 2', () => {
  const r = resoudre({ ref: '' });
  if (r.code !== 2) throw new Error(`code attendu 2, obtenu ${r.code}`);
});

t('la référence de PRODUCTION est refusée, mode historique — code 3', () => {
  const r = resoudre({ ref: PROD_REF });
  if (r.code !== 3) throw new Error(`code attendu 3, obtenu ${r.code}`);
  if (!/PRODUCTION/.test(r.stderr)) throw new Error('le refus doit nommer explicitement la Production');
});

t('option inconnue autre que --url-env — refus, code 2', () => {
  const r = resoudre({ ref: TEST_REF, mode: '--autre-chose', urlEnvName: 'X' });
  if (r.code !== 2) throw new Error(`code attendu 2, obtenu ${r.code}`);
});

t('--url-env sans nom de variable — refus, code 2', () => {
  const r = resoudre({ ref: TEST_REF, mode: '--url-env', urlEnvName: '' });
  if (r.code !== 2) throw new Error(`code attendu 2, obtenu ${r.code}`);
});

t('--url-env avec variable absente/vide — refus, code 6, aucun secret fabriqué', () => {
  const r = resoudre({ ref: TEST_REF, mode: '--url-env', urlEnvName: 'NEXUS_TEST_VAR_INEXISTANTE_20260909' });
  if (r.code !== 6) throw new Error(`code attendu 6, obtenu ${r.code}`);
});

t('--url-env avec URL de schéma invalide — refus, code 8', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: 'mysql://postgres:pw@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres' },
  });
  if (r.code !== 8) throw new Error(`code attendu 8, obtenu ${r.code}`);
});

t('--url-env avec URL incomplète (sans mot de passe) — refus, code 8', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres@db.${TEST_REF}.supabase.co:5432/postgres` },
  });
  if (r.code !== 8) throw new Error(`code attendu 8, obtenu ${r.code}`);
});

t('--url-env : la référence de PRODUCTION dans l’hôte est refusée même en mode URL — code 3', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres:motdepasse@db.${PROD_REF}.supabase.co:5432/postgres` },
  });
  if (r.code !== 3) throw new Error(`code attendu 3, obtenu ${r.code} — stderr: ${r.stderr}`);
  if (!/PRODUCTION/.test(r.stderr)) throw new Error('le refus doit nommer explicitement la Production');
});

t('--url-env : la référence de PRODUCTION dans l’utilisateur (pooler) est refusée — code 3', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres.${PROD_REF}:motdepasse@aws-0-region.pooler.supabase.com:6543/postgres` },
  });
  if (r.code !== 3) throw new Error(`code attendu 3, obtenu ${r.code}`);
});

t('--url-env : une URL qui ne mentionne NULLE PART la référence attendue est ambiguë — refus, code 7', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: 'postgresql://postgres:motdepasse@aws-0-region.pooler.supabase.com:6543/postgres' },
  });
  if (r.code !== 7) throw new Error(`code attendu 7, obtenu ${r.code}`);
});

t('--url-env : référence présente dans l’utilisateur (pooler IPv4) — accepté, PG* corrects', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres.${TEST_REF}:mot-de-passe-fictif@aws-0-us-east-1.pooler.supabase.com:6543/postgres` },
  });
  if (r.code !== 0) throw new Error(`succès attendu, obtenu code ${r.code} — stderr: ${r.stderr}`);
  if (!r.stdout.includes('PGHOST=aws-0-us-east-1.pooler.supabase.com')) throw new Error('PGHOST incorrect: ' + r.stdout);
  if (!r.stdout.includes('PGPORT=6543')) throw new Error('PGPORT incorrect: ' + r.stdout);
  if (!r.stdout.includes('PGDATABASE=postgres')) throw new Error('PGDATABASE incorrect: ' + r.stdout);
  if (!r.stdout.includes(`PGUSER=postgres.${TEST_REF}`)) throw new Error('PGUSER incorrect: ' + r.stdout);
  if (!r.stdout.includes('PGPASSWORD=mot-de-passe-fictif')) throw new Error('PGPASSWORD incorrect: ' + r.stdout);
});

t('--url-env : référence présente dans l’hôte (direct) — accepté aussi', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres:mot-de-passe-fictif@db.${TEST_REF}.supabase.co:5432/postgres` },
  });
  if (r.code !== 0) throw new Error(`succès attendu, obtenu code ${r.code} — stderr: ${r.stderr}`);
  if (!r.stdout.includes(`PGHOST=db.${TEST_REF}.supabase.co`)) throw new Error('PGHOST incorrect: ' + r.stdout);
});

t('sous GITHUB_ACTIONS=true, le mot de passe dérivé est explicitement masqué', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: {
      URL_FACTICE: `postgresql://postgres.${TEST_REF}:mot-de-passe-fictif@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      GITHUB_ACTIONS: 'true',
    },
  });
  if (r.code !== 0) throw new Error(`succès attendu, obtenu code ${r.code}`);
  if (!r.stdout.includes('::add-mask::mot-de-passe-fictif')) throw new Error('le masquage GitHub Actions doit être émis : ' + r.stdout);
});

t('sans GITHUB_ACTIONS, aucune ligne de masquage n’est émise (elle afficherait le mot de passe en clair localement)', () => {
  const r = resoudre({
    ref: TEST_REF, mode: '--url-env', urlEnvName: 'URL_FACTICE',
    env: { URL_FACTICE: `postgresql://postgres.${TEST_REF}:mot-de-passe-fictif@aws-0-us-east-1.pooler.supabase.com:6543/postgres` },
  });
  if (r.code !== 0) throw new Error(`succès attendu, obtenu code ${r.code}`);
  if (r.stdout.includes('::add-mask::')) throw new Error('aucun ::add-mask:: ne doit apparaître hors GitHub Actions : ' + r.stdout);
});

t('mode historique (sans --url-env) : sans trousseau/mot de passe portable, refus explicite — code 4', () => {
  // Ce runner Linux n'a pas `security` (macOS) : le mode historique doit se
  // refuser proprement, jamais deviner un mot de passe.
  const r = resoudre({ ref: TEST_REF });
  if (r.code !== 4) throw new Error(`code attendu 4, obtenu ${r.code} — stdout: ${r.stdout} stderr: ${r.stderr}`);
});

console.log(`\n${n}/${n} vérifications passées — la résolution de connexion Test refuse fail-closed, jamais par accident.`);
