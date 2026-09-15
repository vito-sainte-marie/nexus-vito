// Test — la garde de l'artefact GitHub Pages mord (15/09/2026).
//
// POURQUOI CE TEST EXISTE. Le 08/09/2026, quatre gardes de ce dépôt étaient
// vertes et inutiles : elles vérifiaient une condition que rien ne pouvait
// violer. La leçon retenue est écrite noir sur blanc dans la doctrine du
// dépôt — **on mute dans le contrat de la garde**, jamais à côté : une garde
// muette est d'abord une mutation mal visée, et la détection statique ne
// remplace pas la mutation.
//
// Ce test fabrique donc, pour chaque règle de
// `outils/verifier-artefact-pages.js`, un arbre qui la viole EXACTEMENT, et
// exige un refus. Il exige aussi l'inverse — que les cas légitimes passent :
// une garde qui refuse tout est débranchée dès qu'elle gêne, et ne protège
// alors plus rien.
//
// AUCUNE VALEUR SUSPECTE N'EST ÉCRITE EN CLAIR DANS CE FICHIER. Les appâts
// sont assemblés par morceaux à l'exécution — sans cela, ce fichier de test
// deviendrait lui-même une fuite au sens de sa propre garde, et refuserait
// l'artefact réel. Le dernier cas ci-dessous le vérifie.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const VERIFICATEUR = path.join(__dirname, 'outils', 'verifier-artefact-pages.js');
assert.ok(fs.existsSync(VERIFICATEUR), 'outils/verifier-artefact-pages.js introuvable');

const BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-artefact-'));
let numeroArbre = 0;

// ── Arbre d'essai ──────────────────────────────────────────────────────────
// Le minimum que la garde doit accepter, plus ce que le cas ajoute ou retire.
function arbre(fichiers) {
  const racine = path.join(BAC, `cas-${++numeroArbre}`);
  fs.mkdirSync(racine, { recursive: true });
  const base = {
    'index.html': '<!doctype html><html><body>NEXUS</body></html>\n',
    'nexus-build.js': 'window.NEXUS_BUILD = { id: "0123456789ab" };\n',
  };
  for (const [nom, contenu] of Object.entries({ ...base, ...fichiers })) {
    if (contenu === null) continue;
    const cible = path.join(racine, nom);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
  }
  return racine;
}

function controler(racine, mode, options = []) {
  const r = spawnSync(process.execPath,
    [VERIFICATEUR, `--mode=${mode}`, `--racine=${racine}`, ...options],
    { encoding: 'utf8' });
  return { code: r.status, sortie: `${r.stdout}${r.stderr}` };
}

let total = 0;
const echecs = [];
function cas(intitule, fn) {
  total++;
  try { fn(); process.stdout.write('.'); }
  catch (e) { echecs.push(`${intitule}\n    ${e.message.split('\n')[0]}`); process.stdout.write('x'); }
}

function exigerRefus(intitule, regle, racine, mode, options = []) {
  cas(intitule, () => {
    const { code, sortie } = controler(racine, mode, options);
    assert.strictEqual(code, 1, `attendu : refus. Obtenu code ${code}.\n${sortie}`);
    assert.ok(sortie.includes(`[${regle}]`), `attendu : règle ${regle} citée.\n${sortie}`);
  });
}

function exigerAcceptation(intitule, racine, mode, options = []) {
  cas(intitule, () => {
    const { code, sortie } = controler(racine, mode, options);
    assert.strictEqual(code, 0, `attendu : acceptation. Obtenu code ${code}.\n${sortie}`);
  });
}

// ── Appâts, assemblés à l'exécution ────────────────────────────────────────
const BUILD_SH = '#!/usr/bin/env bash\nset -euo pipefail\necho faux\n';
const REF_PROD = 'uzhjpqpctpvxytxpxoqz';
const REF_TEST = 'udljdqxerrbbbajxubfn';

const APPAT_SB_SECRET = ['sb', 'secret', 'FAUSSECLEDETESTXXXXXXXX'].join('_');
const APPAT_PG = ['postgresql:', '', 'nexus:MotDePasseDeTest@db.example.co:5432/postgres'].join('/');
const APPAT_PEM = [
  '-----BEGIN ' + 'PRIVATE KEY' + '-----',
  'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQFAUXXEDETESTXX',
  '-----END ' + 'PRIVATE KEY' + '-----',
  '',
].join('\n');
const APPAT_AFFECTATION = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')
  + ' = "valeur-de-test-manifestement-fausse-xx";';
const MOT_SERVICE_ROLE = ['service', 'role'].join('_');

function config(env, ref, longueurCle = 40) {
  const cle = 'CLE-DE-TEST-MANIFESTEMENT-FAUSSE-'.padEnd(longueurCle, 'x').slice(0, longueurCle);
  return `(function (g) { g.NEXUS_CONFIG = Object.freeze({\n`
    + `  environnement: ${JSON.stringify(env)},\n`
    + `  supabaseUrl: ${JSON.stringify(`https://${ref}.supabase.co`)},\n`
    + `  supabaseCle: ${JSON.stringify(cle)},\n`
    + `}); })(globalThis);\n`;
}

function jwt(role) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'test', role, iat: 1 })}.signature-de-test-manifestement-fausse`;
}

// ═══════════════════════════════════════════════════════════════════════════
// A — cohérence du mode
// ═══════════════════════════════════════════════════════════════════════════
exigerAcceptation(
  'A · arbre brut sans build.sh, mode « à l\'identique » — accepté',
  arbre({}), 'a-l-identique');

exigerRefus(
  'A1 · un arbre qui SAIT se construire ne se publie pas brut',
  'A1', arbre({ 'outils/build.sh': BUILD_SH }), 'a-l-identique');

exigerRefus(
  'A1 · mode « construit » alors que build.sh est absent',
  'A1', arbre({}), 'construit');

// ═══════════════════════════════════════════════════════════════════════════
// B — présence des trois fichiers
// ═══════════════════════════════════════════════════════════════════════════
exigerRefus(
  'B1 · index.html absent',
  'B1', arbre({ 'index.html': null }), 'a-l-identique');

exigerRefus(
  'B2 · nexus-build.js absent — génération non identifiable',
  'B2', arbre({ 'nexus-build.js': null }), 'a-l-identique');

exigerRefus(
  'B3 · nexus-config.js absent après construction',
  'B3', arbre({ 'outils/build.sh': BUILD_SH }), 'construit');

exigerRefus(
  'B3 · nexus-config.js committé dans un arbre publié brut',
  'B3', arbre({ 'nexus-config.js': config('production', REF_PROD) }), 'a-l-identique');

exigerAcceptation(
  'B · arbre construit complet — accepté',
  arbre({ 'outils/build.sh': BUILD_SH, 'nexus-config.js': config('production', REF_PROD) }),
  'construit');

// ═══════════════════════════════════════════════════════════════════════════
// C — cohérence de l'environnement
// ═══════════════════════════════════════════════════════════════════════════
exigerRefus(
  'C2 · configuration déclarant « test » dans un artefact de Production',
  'C2', arbre({ 'outils/build.sh': BUILD_SH, 'nexus-config.js': config('test', REF_TEST) }),
  'construit');

exigerRefus(
  'C3 · configuration visant un autre projet Supabase',
  'C3', arbre({ 'outils/build.sh': BUILD_SH, 'nexus-config.js': config('production', REF_TEST) }),
  'construit');

exigerRefus(
  'C4 · clé trop courte pour être valide',
  'C4', arbre({ 'outils/build.sh': BUILD_SH, 'nexus-config.js': config('production', REF_PROD, 12) }),
  'construit');

exigerRefus(
  'C1 · nexus-config.js illisible',
  'C1', arbre({ 'outils/build.sh': BUILD_SH, 'nexus-config.js': '// vidé par erreur\n' }),
  'construit');

// ═══════════════════════════════════════════════════════════════════════════
// S — analyse de secrets
// ═══════════════════════════════════════════════════════════════════════════
exigerRefus(
  'S1 · clé de service Supabase',
  'S1', arbre({ 'fuite.js': `const k = "${APPAT_SB_SECRET}";\n` }), 'a-l-identique');

exigerRefus(
  `S2 · jeton JWT de rôle ${MOT_SERVICE_ROLE}`,
  'S2', arbre({ 'fuite.js': `const k = "${jwt(MOT_SERVICE_ROLE)}";\n` }), 'a-l-identique');

exigerRefus(
  'S2 · jeton JWT de rôle inconnu — refusé faute de savoir le lire',
  'S2', arbre({ 'fuite.js': `const k = "${jwt('postgres')}";\n` }), 'a-l-identique');

exigerAcceptation(
  'S2 · jeton JWT de rôle anon — c\'est sa place, accepté',
  arbre({ 'public.js': `const k = "${jwt('anon')}";\n` }), 'a-l-identique');

exigerRefus(
  'S3 · chaîne de connexion PostgreSQL avec mot de passe',
  'S3', arbre({ 'note.md': `psql ${APPAT_PG}\n` }), 'a-l-identique');

exigerRefus(
  'S4 · clé privée PEM avec corps base64',
  'S4', arbre({ 'fuite.pem': APPAT_PEM }), 'a-l-identique');

exigerAcceptation(
  'S4 · en-tête PEM utilisé comme délimiteur de .replace() — accepté',
  // Trois fichiers réels de ce dépôt font exactement cela (`index.ts` et les
  // deux Edge Functions). Exiger un corps base64 est ce qui distingue la
  // fuite du découpage.
  arbre({ 'index.ts': 'const corps = brut\n  .replace(/' + APPAT_PEM.split('\n')[0] + '/, "");\n' }),
  'a-l-identique');

exigerRefus(
  'S6 · valeur affectée à une variable de clé de service',
  'S6', arbre({ 'conf.js': `const ${APPAT_AFFECTATION}\n` }), 'a-l-identique');

// ── S5 — le mot nu : inventaire par défaut, refus sur demande ──────────────
// C'est ici que se joue l'écart assumé avec la lettre de la consigne
// « refuser l'artefact si `service_role` y apparaît ». La mesure du
// 15/09/2026 sur `origin/production` donne 17 fichiers contenant cette
// chaîne — 12 migrations SQL, 2 notes, un commentaire d'Edge Function qui
// dit « pas de service_role ici, volontairement », un script d'outillage et
// un commentaire d'écran. Aucune n'est une clé. Refuser par défaut rendrait
// la garde permanente, donc débranchée ; l'option existe pour la lettre.
const PROSE = arbre({
  'migration.sql': `grant usage on schema public to anon, authenticated, ${MOT_SERVICE_ROLE};\n`,
});
exigerAcceptation(
  'S5 · le mot nu en prose SQL — inventorié, non bloquant par défaut',
  PROSE, 'a-l-identique');
exigerRefus(
  'S5 · le mot nu en prose SQL — bloquant avec --refuser-mot-service-role',
  'S5', PROSE, 'a-l-identique', ['--refuser-mot-service-role']);

// ═══════════════════════════════════════════════════════════════════════════
// PÉRIMÈTRE — ce qui n'est pas publié n'est pas contrôlé
// ═══════════════════════════════════════════════════════════════════════════
// `actions/upload-pages-artifact` exclut `.git` et `.github`. Un secret qui
// y vivrait serait un autre problème, pas celui de l'artefact : le signaler
// ici apprendrait à ignorer les refus.
exigerAcceptation(
  'Périmètre · un secret sous .github/ ne concerne pas l\'artefact',
  arbre({ '.github/workflows/faux.yml': `cle: "${APPAT_SB_SECRET}"\n` }),
  'a-l-identique');

// ═══════════════════════════════════════════════════════════════════════════
// DISCRÉTION — une garde qui dénonce un secret ne doit pas le recopier
// ═══════════════════════════════════════════════════════════════════════════
// Le journal d'une exécution GitHub Actions est lisible par quiconque a
// accès au dépôt. Une garde qui imprime ce qu'elle a trouvé publie ce
// qu'elle prétend protéger.
cas('Discrétion · la valeur suspecte n\'est jamais imprimée', () => {
  const { code, sortie } = controler(
    arbre({ 'fuite.js': `const k = "${APPAT_SB_SECRET}";\n` }), 'a-l-identique');
  assert.strictEqual(code, 1, 'la fuite aurait dû être refusée');
  assert.ok(sortie.includes('fuite.js:1'), 'le fichier et la ligne doivent être nommés');
  assert.ok(!sortie.includes(APPAT_SB_SECRET), 'la valeur suspecte a été recopiée dans la sortie');
});

// ═══════════════════════════════════════════════════════════════════════════
// L'ARBRE RÉEL — la garde doit accepter ce qui est servi aujourd'hui
// ═══════════════════════════════════════════════════════════════════════════
// Sans ce cas, rien ne dirait que la bascule d'hébergement est possible : une
// garde calibrée sur des arbres fabriqués peut parfaitement refuser le seul
// arbre qui compte. Ce cas vérifie du même coup que ce fichier de test, qui
// manipule des appâts, n'empoisonne pas l'artefact qu'il protège.
cas('Réel · l\'arbre de cette branche est acceptable en mode « à l\'identique »', () => {
  const { code, sortie } = controler(__dirname, 'a-l-identique');
  assert.strictEqual(code, 0, `l'arbre réel a été refusé :\n${sortie}`);
});

// ── Verdict ────────────────────────────────────────────────────────────────
fs.rmSync(BAC, { recursive: true, force: true });
console.log(`\n\n${total - echecs.length}/${total} contrôles passent.`);
if (echecs.length) {
  console.log(`\n${echecs.length} en échec :`);
  for (const e of echecs) console.log(`  ${e}`);
  process.exit(1);
}
