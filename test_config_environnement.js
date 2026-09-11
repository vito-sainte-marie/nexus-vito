// NEXUS — la configuration Supabase vient de l'environnement, jamais du code
// (04/09/2026).
//
// Avant ce lot, l'URL et la clé étaient écrites en dur dans `nexus-auth.js`
// — chargé par 52 écrans — et REDÉCLARÉES dans `NEXUS-Login-v1.html`. Rien
// n'empêchait donc un écran de viser un projet Supabase différent du reste
// de l'application, ni une recette d'écrire dans la base de production.
//
// Ce test balaie TOUS les fichiers applicatifs, pas seulement ceux qu'on
// avait identifiés : c'est le seul moyen d'empêcher qu'une configuration en
// dur soit réintroduite un jour, dans un écran auquel personne ne pense.
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;

// NEXUS-API-v1.html affiche l'URL de production comme DOCUMENTATION pour les
// consommateurs externes de l'API — explicitement étiquetée « Production »,
// avec une note rappelant que cette adresse est publiable. Ce n'est ni une
// configuration ni un appel : l'écran ne charge même pas nexus-auth.js.
// L'exception est nommée ici plutôt que silencieusement tolérée.
const DOCUMENTATION = new Set(['NEXUS-API-v1.html']);

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// ── 1. Balayage de TOUS les fichiers applicatifs ────────────────────────
const URL_SUPABASE = /https:\/\/[a-z0-9]{15,}\.supabase\.co/;
const CLE_EN_DUR = /\b(sb_publishable_[A-Za-z0-9_-]{10,}|eyJhbGciOiJIUzI1NiI)/;

const applicatifs = fs.readdirSync(RACINE)
  .filter(f => (f.endsWith('.html') || f.endsWith('.js')) && !f.startsWith('test_'))
  .filter(f => f !== 'nexus-config.js');

const fautifs = { url: [], cle: [] };
for (const f of applicatifs) {
  const texte = fs.readFileSync(path.join(RACINE, f), 'utf8');
  const sansCommentaires = texte.replace(/^\s*\/\/[^\n]*$/gm, '');
  if (URL_SUPABASE.test(sansCommentaires) && !DOCUMENTATION.has(f)) fautifs.url.push(f);
  if (CLE_EN_DUR.test(sansCommentaires)) fautifs.cle.push(f);
}

console.log(`  (${applicatifs.length} fichiers applicatifs balayés)`);
verifier(`aucune URL Supabase codée en dur — ${fautifs.url.join(', ') || 'aucune'}`, fautifs.url.length === 0);
verifier(`aucune clé Supabase codée en dur — ${fautifs.cle.join(', ') || 'aucune'}`, fautifs.cle.length === 0);
verifier('nexus-config.js n’est pas versionné',
  !fs.existsSync(path.join(RACINE, 'nexus-config.js'))
  || fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8').includes('nexus-config.js'));

// ── 2. Les consommateurs lisent bien la configuration commune ───────────
const auth = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
verifier('nexus-auth.js lit window.NEXUS_CONFIG', /window\.NEXUS_CONFIG/.test(auth));
verifier('nexus-auth.js échoue si la configuration manque',
  /throw new Error\(message\)/.test(auth) && /ne peut pas démarrer/.test(auth));
verifier('nexus-auth.js ne définit plus d’URL ni de clé en dur',
  /const NEXUS_SUPABASE_URL = NEXUS_CFG\.supabaseUrl/.test(auth));

const login = fs.readFileSync(path.join(RACINE, 'NEXUS-Login-v1.html'), 'utf8');
verifier('l’écran de connexion partage la configuration commune',
  /window\.NEXUS_CONFIG\.supabaseUrl/.test(login));
verifier('… et refuse de démarrer sans elle',
  /nexus-config\.js absent ou incomplet/.test(login));

const adminApi = fs.readFileSync(path.join(RACINE, 'NEXUS-Admin-API-v1.html'), 'utf8');
verifier('l’URL de fonction Edge suit l’environnement',
  /FN_URL = `\$\{NEXUS_SUPABASE_URL\}\/functions\/v1\/admin-api`/.test(adminApi));

// ── 3. Le générateur échoue fermé ───────────────────────────────────────
function genererAvec(env) {
  try {
    execFileSync('node', [path.join(RACINE, 'outils', 'generer-config.js')],
      { env: Object.assign({}, process.env, env), stdio: 'pipe', cwd: RACINE });
    return { ok: true };
  } catch (e) {
    return { ok: false, sortie: `${e.stdout || ''}${e.stderr || ''}` };
  }
}
const VIDE = { NEXUS_ENV: '', NEXUS_SUPABASE_URL: '', NEXUS_SUPABASE_ANON_KEY: '' };
const CLE_FACTICE = 'sb_publishable_' + 'x'.repeat(24);

verifier('sans variable, le build échoue', !genererAvec(VIDE).ok);
verifier('sans URL, le build échoue',
  !genererAvec({ ...VIDE, NEXUS_ENV: 'test', NEXUS_SUPABASE_ANON_KEY: CLE_FACTICE }).ok);
verifier('sans clé, le build échoue',
  !genererAvec({ ...VIDE, NEXUS_ENV: 'test', NEXUS_SUPABASE_URL: 'https://exemple.supabase.co' }).ok);
verifier('un environnement inconnu est refusé',
  !genererAvec({ NEXUS_ENV: 'recette', NEXUS_SUPABASE_URL: 'https://exemple.supabase.co', NEXUS_SUPABASE_ANON_KEY: CLE_FACTICE }).ok);
verifier('une URL mal formée est refusée',
  !genererAvec({ NEXUS_ENV: 'test', NEXUS_SUPABASE_URL: 'https://exemple.supabase.co/', NEXUS_SUPABASE_ANON_KEY: CLE_FACTICE }).ok);

// ── 4. LE garde-fou : un build de test ne peut pas viser la production ──
const PROD = 'https://uzhjpqpctpvxytxpxoqz.supabase.co';
const versProd = genererAvec({ NEXUS_ENV: 'test', NEXUS_SUPABASE_URL: PROD, NEXUS_SUPABASE_ANON_KEY: CLE_FACTICE });
verifier('un build « test » pointant la PRODUCTION est refusé',
  !versProd.ok && /REFUS/.test(versProd.sortie) && /PRODUCTION/.test(versProd.sortie));

const prodVersAutre = genererAvec({ NEXUS_ENV: 'production', NEXUS_SUPABASE_URL: 'https://exemple.supabase.co', NEXUS_SUPABASE_ANON_KEY: CLE_FACTICE });
verifier('un build « production » ne pointant PAS la production est refusé',
  !prodVersAutre.ok && /REFUS/.test(prodVersAutre.sortie));

// ── 5. Aucun fichier n’est laissé derrière par les essais ───────────────
verifier('aucun nexus-config.js résiduel après les échecs',
  !fs.existsSync(path.join(RACINE, 'nexus-config.js')));

console.log(`\nConfiguration par environnement : ${ok}/${ok} vérifications passent.`);
