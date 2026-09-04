// NEXUS — lot de sécurité du 04/09/2026 : isolation des sites et
// environnement de recette reconnaissable.
//
// Ce fichier garde trois corrections dont chacune répare une fuite CONSTATÉE
// PAR APPEL RÉEL sur la recette, avec la seule clé publiable :
//
//   1. `nexus_stock_lire_etat_json({"p_site":"vito-sainte-marie"})` renvoyait
//      119 lignes de stock d'un autre site à un visiteur ANONYME ;
//   2. `GET /rest/v1/employees_public` renvoyait l'annuaire complet des
//      employés, tous sites confondus, également en anonyme ;
//   3. la recette était visuellement identique à la production — rien à
//      l'écran ne disait dans quelle base on saisissait.
//
// Les deux premières se prouvent contre une vraie base : elles sont tenues
// par `outils/verifier-isolation-supabase.mjs`, hors de cette suite, qui
// n'ouvre aucune connexion réseau (garantie posée par le workflow CI). Ici on
// garde ce qui se vérifie sans réseau : que le code corrigé est bien celui
// qui est servi, et que le bandeau ne peut pas apparaître en production.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// ── 1. Le bandeau d'environnement ───────────────────────────────────────
// Test de comportement, pas de présence : on exécute réellement le script
// dans un DOM simulé, pour les deux environnements.
const SOURCE_BANDEAU = fs.readFileSync(path.join(RACINE, 'nexus-bandeau-environnement.js'), 'utf8');

function executerBandeau(environnement) {
  const cree = [];
  const racine = { style: {} };
  const corps = { appendChild(n) { cree.push(n); } };
  const faux = {
    readyState: 'complete',
    documentElement: racine,
    body: corps,
    getElementById: () => null,
    addEventListener: () => {},
    createElement: () => ({
      style: {}, setAttribute() {}, textContent: '', offsetHeight: 28
    })
  };
  const fenetre = {
    NEXUS_CONFIG: environnement ? { environnement } : null,
    getComputedStyle: () => ({ paddingTop: '0px' })
  };
  fenetre.window = fenetre;
  new Function('window', 'document', SOURCE_BANDEAU)(fenetre, faux);
  return { cree, margeHtml: racine.style.marginTop };
}

const enTest = executerBandeau('test');
verifier('bandeau posé en environnement « test »', enTest.cree.length === 1);
verifier('le bandeau annonce le MODE TEST',
  /MODE TEST/.test(enTest.cree[0].textContent));
verifier('la page est décalée sous le bandeau', enTest.margeHtml === '28px');

for (const env of ['production', 'preproduction', 'TEST', '', null]) {
  const r = executerBandeau(env);
  verifier(`aucun bandeau en environnement « ${env === null ? 'absent' : env} »`,
    r.cree.length === 0 && r.margeHtml === undefined);
}

verifier('le bandeau teste une égalité stricte à « test », jamais une négation de « production »',
  /environnement !== 'test'/.test(SOURCE_BANDEAU) && !/production/.test(
    SOURCE_BANDEAU.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')));

// ── 2. La connexion n'expose plus d'annuaire ────────────────────────────
const LOGIN = fs.readFileSync(path.join(RACINE, 'NEXUS-Login-v1.html'), 'utf8');
const LOGIN_CODE = LOGIN.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

verifier('l’écran de connexion n’interroge plus la vue employees_public',
  !/employees_public/.test(LOGIN_CODE));
verifier('l’écran de connexion passe par nexus_identifiant_de_connexion',
  /rpc\("nexus_identifiant_de_connexion", \{ p_prenom: prenom \}\)/.test(LOGIN_CODE));
verifier('l’écran de connexion n’utilise plus ilike (dont % et _ sont des jokers)',
  !/\.ilike\(/.test(LOGIN_CODE));

// Le cadrage exige un message strictement identique pour un prénom inconnu
// et un PIN incorrect : deux messages distincts font de l'écran un oracle
// d'énumération, un prénom à la fois.
const messagesRefus = [...LOGIN_CODE.matchAll(/errBox\.textContent = ([^;]+);/g)]
  .map(m => m[1].trim())
  .filter(m => !/Entrez votre prénom|serveur impossible/.test(m));
verifier('un seul et même message pour prénom inconnu et PIN incorrect',
  messagesRefus.length >= 2 && new Set(messagesRefus).size === 1);

// ── 3. Les migrations disent bien ce qu'elles font ──────────────────────
const migrations = fs.readdirSync(path.join(RACINE, 'supabase', 'migrations'));
function migration(motif) {
  const f = migrations.find(m => m.includes(motif));
  return f ? fs.readFileSync(path.join(RACINE, 'supabase', 'migrations', f), 'utf8') : '';
}

const M_STOCK = migration('verrouiller_rpc_stock_par_site');
verifier('migration présente : verrou des RPC stock', M_STOCK.length > 0);
verifier('la garde refuse l’appel anonyme', /auth\.uid\(\) is null/.test(M_STOCK));
verifier('la garde compare le site demandé à celui du compte',
  /current_employee_site_id\(\)/.test(M_STOCK));
verifier('la garde lève une erreur au lieu de renvoyer un ensemble vide',
  /raise exception/.test(M_STOCK) && /42501/.test(M_STOCK));
for (const fn of ['nexus_stock_lire_etat', 'nexus_stock_lire_etat_json']) {
  verifier(`exécution retirée à anon sur ${fn}`,
    new RegExp(`revoke all on function public\\.${fn}\\(text\\) from anon`).test(M_STOCK));
}
verifier('le corps de calcul n’est plus atteignable directement',
  /revoke all on function public\.nexus_stock_lire_etat_donnees\(text\) from authenticated/.test(M_STOCK));

const M_LOGIN = migration('login_non_enumerable');
verifier('migration présente : connexion non énumérable', M_LOGIN.length > 0);
verifier('la vue employees_public est retirée à anon',
  /revoke select on public\.employees_public from anon/.test(M_LOGIN));
verifier('la vue repasse sous RLS (security_invoker)',
  /security_invoker = true/.test(M_LOGIN));
verifier('la fonction de connexion ne renvoie rien en cas d’homonymes',
  /count\(\*\) = 1/.test(M_LOGIN));
verifier('la fonction de connexion compare en égalité, pas en ilike',
  /lower\(btrim\(e\.nom\)\) = lower\(btrim\(coalesce\(p_prenom/.test(M_LOGIN));
verifier('la migration se déclare PROVISOIRE et renvoie au cadrage',
  /MESURE PROVISOIRE/.test(M_LOGIN) && /CADRAGE-nexus-test\.md/.test(M_LOGIN));
verifier('la migration ne supprime pas employees_public',
  !/drop view/i.test(M_LOGIN));

// ── 4. Cache et indexation, portés par le build ─────────────────────────
const ENTETES = fs.readFileSync(path.join(RACINE, '_headers'), 'utf8');
verifier('_headers impose no-store à nexus-config.js',
  /^\/nexus-config\.js\s*$/m.test(ENTETES) && /Cache-Control:\s*no-store/i.test(ENTETES));

verifier('le robots.txt versionné reste celui de la production',
  /Allow: \//.test(fs.readFileSync(path.join(RACINE, 'robots.txt'), 'utf8')));

// Le générateur est exécuté pour de bon, sur une copie jetable.
const ESSAI = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-build-'));
fs.mkdirSync(path.join(ESSAI, 'outils'));
for (const f of ['NEXUS-Login-v1.html', 'NEXUS-Cockpit-v2.html', 'robots.txt', '_headers']) {
  fs.copyFileSync(path.join(RACINE, f), path.join(ESSAI, f));
}
fs.copyFileSync(path.join(RACINE, 'outils', 'generer-config.js'),
  path.join(ESSAI, 'outils', 'generer-config.js'));

function construire(env, url, attendreEchec) {
  try {
    execFileSync('node', ['outils/generer-config.js'], {
      cwd: ESSAI, stdio: 'pipe',
      env: { ...process.env, NEXUS_ENV: env, NEXUS_SUPABASE_URL: url,
             NEXUS_SUPABASE_ANON_KEY: 'sb_publishable_essai_0000000000' }
    });
    return null;
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

const TEST_URL = 'https://udljdqxerrbbbajxubfn.supabase.co';
const PROD_URL = 'https://uzhjpqpctpvxytxpxoqz.supabase.co';

verifier('build « test » : robots.txt passe en Disallow',
  construire('test', TEST_URL) === null &&
  /Disallow: \//.test(fs.readFileSync(path.join(ESSAI, 'robots.txt'), 'utf8')));

const cockpit = fs.readFileSync(path.join(ESSAI, 'NEXUS-Cockpit-v2.html'), 'utf8');
const iCfg = cockpit.indexOf('<script src="nexus-config.js"></script>');
const iBan = cockpit.indexOf('<script src="nexus-bandeau-environnement.js"></script>');
const iAuth = cockpit.search(/<script src="nexus-auth\.js/);
verifier('le bandeau est posé sur les mêmes écrans que la configuration', iBan > -1);
verifier('ordre des balises : config, bandeau, puis auth',
  iCfg > -1 && iCfg < iBan && iBan < iAuth);
verifier('l’écran de connexion reçoit lui aussi le bandeau',
  fs.readFileSync(path.join(ESSAI, 'NEXUS-Login-v1.html'), 'utf8')
    .includes('<script src="nexus-bandeau-environnement.js"></script>'));

fs.copyFileSync(path.join(RACINE, 'robots.txt'), path.join(ESSAI, 'robots.txt'));
verifier('build « production » : robots.txt est laissé intact',
  construire('production', PROD_URL) === null &&
  /Allow: \//.test(fs.readFileSync(path.join(ESSAI, 'robots.txt'), 'utf8')));

fs.writeFileSync(path.join(ESSAI, '_headers'), '/autre\n  X-Test: 1\n');
const sansNoStore = construire('test', TEST_URL);
verifier('build refusé si _headers perd la règle no-store',
  sansNoStore !== null && /no-store/.test(sansNoStore));

fs.rmSync(ESSAI, { recursive: true, force: true });

console.log(`\n${ok} vérifications passées.`);
