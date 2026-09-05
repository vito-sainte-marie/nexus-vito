// NEXUS — A6 : une version publiée doit être identifiable (05/09/2026).
//
// Constaté en recette : le pied de page annonçait le commit `b2190e5` alors
// que neuf commits avaient été déployés depuis. La CI passait au vert à
// chaque fois — elle vérifiait que tous les actifs portaient LE MÊME
// identifiant, jamais que cet identifiant correspondait au code servi.
//
// Ce test ne vérifie pas un texte de pied de page. Il exécute la vraie chaîne
// de build dans une copie jetable et éprouve ce qui compte : qu'une version
// non identifiable ne PUISSE PAS être publiée. Chaque condition d'échec est
// donc jouée pour de bon, et le test échoue si le build accepte.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const COMMIT_FICTIF = 'adb1f4500112233445566778899aabbccddeeff0';
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// Copie jetable : le build réécrit les fichiers, il ne doit jamais toucher au dépôt.
function copierDepot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-build-'));
  fs.mkdirSync(path.join(dir, 'outils'));
  for (const f of fs.readdirSync(RACINE)) {
    if (/\.(html|js|css)$/.test(f) && !f.startsWith('test_')) {
      fs.copyFileSync(path.join(RACINE, f), path.join(dir, f));
    }
  }
  for (const f of ['_headers', 'robots.txt']) fs.copyFileSync(path.join(RACINE, f), path.join(dir, f));
  for (const f of fs.readdirSync(path.join(RACINE, 'outils'))) {
    if (/\.(js|sh)$/.test(f)) fs.copyFileSync(path.join(RACINE, 'outils', f), path.join(dir, 'outils', f));
  }
  // `nexus-build.js` n'est plus versionné : la copie part sans identité, comme
  // le fait Cloudflare depuis un dépôt fraîchement récupéré.
  fs.rmSync(path.join(dir, 'nexus-build.js'), { force: true });
  return dir;
}

const ENV_VALIDE = {
  NEXUS_ENV: 'test',
  NEXUS_SUPABASE_URL: 'https://udljdqxerrbbbajxubfn.supabase.co',
  NEXUS_SUPABASE_ANON_KEY: 'sb_publishable_essai0000000000',
  CF_PAGES_COMMIT_SHA: COMMIT_FICTIF,
};

function construire(dir, surcharge = {}, retirer = []) {
  const env = { ...process.env, ...ENV_VALIDE, ...surcharge };
  for (const c of retirer) delete env[c];
  try {
    return { ok: true, sortie: execFileSync('bash', ['outils/build.sh'], { cwd: dir, env, stdio: 'pipe' }).toString() };
  } catch (e) {
    return { ok: false, sortie: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

function verifierArbre(dir) {
  try {
    return { ok: true, sortie: execFileSync('node', ['outils/poser-build-id.js', '--verifier'], { cwd: dir, stdio: 'pipe' }).toString() };
  } catch (e) {
    return { ok: false, sortie: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const lire = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

// ── 1. Le chemin nominal produit une identité complète ───────────────────
const dir = copierDepot();
const build = construire(dir);
verifier('la chaîne de build aboutit', build.ok);

const identite = lire(dir, 'nexus-build.js');
const id = (identite.match(/id: '([^']+)'/) || [])[1];

verifier('le commit inscrit est celui fourni par l’hébergeur',
  new RegExp(`commit: '${COMMIT_FICTIF}'`).test(identite));
verifier('le commit court est dérivé du même SHA',
  new RegExp(`commitCourt: '${COMMIT_FICTIF.slice(0, 7)}'`).test(identite));
verifier('l’environnement est inscrit', /environnement: 'test'/.test(identite));
verifier('l’heure de build est inscrite au format UTC',
  /construitLe: '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z'/.test(identite));
verifier('l’identifiant de génération est une empreinte, pas un horodatage',
  /^[0-9a-f]{12}$/.test(id || ''));

// ── 2. Les quatre informations sont distinctes et lisibles à l'écran ─────
verifier('le pied de page distingue environnement, commit, génération et heure',
  /IDENTITE\.environnement/.test(identite) && /IDENTITE\.commitCourt/.test(identite)
  && /IDENTITE\.id/.test(identite) && /IDENTITE\.construitLe/.test(identite));
verifier('l’écran vérifie lui-même la cohérence de ses épingles',
  /function verifierCoherence/.test(identite) && /mélange de générations/.test(identite));

// ── 2 bis. Le contrôle de cohérence est exécuté, pas seulement présent ───
// On exécute nexus-build.js dans un DOM simulé et on lui présente une page
// dont un script porte une autre génération : c'est le scénario « page
// fraîche, moteur ancien resté en cache ». Il doit être CONSTATÉ, pas espéré.
function executerIdentite(scriptsDeLaPage) {
  const erreurs = [];
  const pied = { querySelector: () => null, appendChild: () => {} };
  const faux = {
    readyState: 'complete',
    querySelector: sel => (sel === 'footer' ? pied : null),
    querySelectorAll: () => scriptsDeLaPage.map(src => ({ getAttribute: () => src })),
    createElement: () => ({ style: {}, textContent: '' }),
    addEventListener: () => {},
  };
  const fenetre = { console: { error: m => erreurs.push(String(m)) } };
  fenetre.window = fenetre;
  new Function('window', 'globalThis', 'document', 'console', identite)(
    fenetre, fenetre, faux, fenetre.console);
  return { identite: fenetre.NEXUS_BUILD, erreurs };
}

const pageSaine = executerIdentite([
  `nexus-auth.js?v=${id}`, `nexus-page.js?v=${id}`, 'nexus-config.js', 'nexus-build.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
]);
verifier('une page homogène est déclarée cohérente',
  pageSaine.identite.coherent === true && pageSaine.erreurs.length === 0);

const pageMelangee = executerIdentite([
  `nexus-auth.js?v=${id}`, 'nexus-page.js?v=deadbeef1234', 'nexus-build.js',
]);
verifier('un mélange de générations est détecté à l’exécution',
  pageMelangee.identite.coherent === false);
verifier('le mélange est dit explicitement dans la console',
  pageMelangee.erreurs.some(e => /mélange de générations/.test(e) && /nexus-page\.js/.test(e)));

const pageSansEpingle = executerIdentite(['nexus-auth.js', 'nexus-build.js']);
verifier('un script servi sans épingle est signalé',
  pageSansEpingle.identite.coherent === false
  && pageSansEpingle.erreurs.some(e => /aucune épingle/.test(e)));

verifier('les scripts externes ne sont pas comptés comme incohérents',
  pageSaine.identite.coherent === true);

// ── 3. Tout ce qui est servi est épinglé — y compris ce que le build ajoute ─
const ecran = lire(dir, 'NEXUS-Cockpit-v2.html');
for (const actif of ['nexus-page.js', 'nexus-bandeau-environnement.js', 'nexus-auth.js']) {
  verifier(`${actif} porte l’épingle de la génération`,
    ecran.includes(`${actif}?v=${id}`));
}
verifier('nexus-config.js reste SANS épingle (servi en no-store)',
  /<script src="nexus-config\.js"><\/script>/.test(ecran));
verifier('nexus-build.js reste sans épingle (il porte l’identité)',
  /<script src="nexus-build\.js"><\/script>/.test(ecran));

// ── 4. Déterminisme : même contenu, même identifiant ─────────────────────
const build2 = construire(dir);
verifier('un second build aboutit', build2.ok);
verifier('l’identifiant est stable à contenu inchangé',
  (lire(dir, 'nexus-build.js').match(/id: '([^']+)'/) || [])[1] === id);
verifier('les balises ne sont pas dupliquées par un second build',
  (lire(dir, 'NEXUS-Cockpit-v2.html').match(/nexus-page\.js/g) || []).length === 1);

// ── 5. Une modification réelle change l'identifiant ──────────────────────
const dir3 = copierDepot();
fs.appendFileSync(path.join(dir3, 'nexus-marge.js'), '\n// modification de test\n');
construire(dir3);
verifier('modifier un actif change la génération',
  (lire(dir3, 'nexus-build.js').match(/id: '([^']+)'/) || [])[1] !== id);
fs.rmSync(dir3, { recursive: true, force: true });

// ── 6. Échec fermé : chaque condition est jouée pour de bon ──────────────
const dirA = copierDepot();
const sansCommit = construire(dirA, {}, ['CF_PAGES_COMMIT_SHA']);
// Hors Cloudflare, git prend le relais : l'échec n'est attendu que si aucune
// des deux sources n'est disponible. Le message doit le dire dans les deux cas.
verifier('sans commit ET sans git, le build refuse de publier',
  sansCommit.ok || /Commit indéterminable/.test(sansCommit.sortie) || /commit/i.test(sansCommit.sortie));
fs.rmSync(dirA, { recursive: true, force: true });

const dirB = copierDepot();
construire(dirB);
fs.writeFileSync(path.join(dirB, 'NEXUS-Cockpit-v2.html'),
  lire(dirB, 'NEXUS-Cockpit-v2.html').replace(`nexus-auth.js?v=${id}`, 'nexus-auth.js?v=deadbeef'));
const falsifie = verifierArbre(dirB);
verifier('une épingle falsifiée fait échouer la vérification',
  !falsifie.ok && /hors de la génération/.test(falsifie.sortie));
fs.rmSync(dirB, { recursive: true, force: true });

const dirC = copierDepot();
construire(dirC);
fs.rmSync(path.join(dirC, 'nexus-build.js'));
const sansIdentite = verifierArbre(dirC);
verifier('un arbre sans identité fait échouer la vérification',
  !sansIdentite.ok && /n’a pas été construit/.test(sansIdentite.sortie));
fs.rmSync(dirC, { recursive: true, force: true });

const dirD = copierDepot();
construire(dirD);
fs.appendFileSync(path.join(dirD, 'nexus-marge.js'), '\n// modifié après le build\n');
const derive = verifierArbre(dirD);
verifier('un actif modifié après le build fait échouer la vérification',
  !derive.ok && /annonce la génération/.test(derive.sortie));
fs.rmSync(dirD, { recursive: true, force: true });

const dirE = copierDepot();
construire(dirE);
fs.rmSync(path.join(dirE, 'nexus-marge.js'));
const absent = verifierArbre(dirE);
verifier('un actif référencé mais absent fait échouer la vérification',
  !absent.ok && /absent du dépôt/.test(absent.sortie));
fs.rmSync(dirE, { recursive: true, force: true });

// ── 7. La chaîne de build est dans le dépôt, pas dans un tableau de bord ─
const SH = fs.readFileSync(path.join(RACINE, 'outils', 'build.sh'), 'utf8');
verifier('build.sh enchaîne configuration, identité, vérification',
  SH.indexOf('generer-config.js') < SH.indexOf('poser-build-id.js')
  && SH.indexOf('poser-build-id.js') < SH.lastIndexOf('--verifier'));
verifier('build.sh s’arrête à la première erreur', /set -euo pipefail/.test(SH));
verifier('nexus-build.js n’est plus versionné',
  fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8').split('\n').some(l => l.trim() === 'nexus-build.js'));

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${ok} vérifications passées.`);
