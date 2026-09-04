#!/usr/bin/env node
// NEXUS — génération de la configuration d'environnement (04/09/2026).
//
// Écrit `nexus-config.js` à la racine publiée, à partir des variables
// d'environnement, et insère sa balise dans chaque écran AVANT
// `nexus-auth.js`. Le fichier généré n'est jamais versionné : c'est
// l'environnement de build qui décide vers quel projet Supabase l'écran
// parle, jamais le code source.
//
// Pourquoi ce détour plutôt que des constantes dans nexus-auth.js : ce
// fichier est chargé par 52 écrans, et NEXUS-Login-v1.html redéclarait sa
// propre URL et sa propre clé. Rien n'empêchait un écran de viser un autre
// projet que le reste de l'application — ni de laisser une recette écrire
// dans la base de production.
//
// ÉCHEC FERMÉ, à trois niveaux :
//   1. ici, si une variable manque, est vide ou mal formée — le build
//      s'arrête et rien n'est publié ;
//   2. ici encore, si l'environnement déclaré ne correspond pas au projet
//      Supabase visé — une recette ne peut donc pas pointer la production
//      par simple étourderie de configuration ;
//   3. à l'exécution, si `nexus-config.js` est absent ou incomplet,
//      nexus-auth.js refuse de démarrer avec un message explicite plutôt
//      que de retomber sur une valeur par défaut.
//
// Usage (dans le build Cloudflare) :
//   NEXUS_ENV=test NEXUS_SUPABASE_URL=… NEXUS_SUPABASE_ANON_KEY=… \
//     node outils/generer-config.js
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const CIBLE = path.join(RACINE, 'nexus-config.js');

// Le projet de production, nommé ici une seule fois et pour une seule
// raison : refuser qu'un build de test le vise. Cette référence est déjà
// publique — elle figure dans le code servi au navigateur.
const REF_PRODUCTION = 'uzhjpqpctpvxytxpxoqz';

function echouer(message) {
  console.error('\n  ÉCHEC — génération de la configuration NEXUS\n');
  console.error('  ' + message + '\n');
  console.error('  Variables attendues : NEXUS_ENV, NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY\n');
  process.exit(1);
}

const env = (process.env.NEXUS_ENV || '').trim();
const url = (process.env.NEXUS_SUPABASE_URL || '').trim();
const cle = (process.env.NEXUS_SUPABASE_ANON_KEY || '').trim();

// 1. Présence
if (!env) echouer('NEXUS_ENV est absent ou vide.');
if (!url) echouer('NEXUS_SUPABASE_URL est absent ou vide.');
if (!cle) echouer('NEXUS_SUPABASE_ANON_KEY est absent ou vide.');

// 2. Forme
if (!['test', 'production'].includes(env)) {
  echouer(`NEXUS_ENV vaut « ${env} » : seules les valeurs « test » et « production » sont acceptées.`);
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  echouer('NEXUS_SUPABASE_URL n’a pas la forme attendue https://<ref>.supabase.co (sans barre finale).');
}
if (cle.length < 20) {
  echouer('NEXUS_SUPABASE_ANON_KEY est trop courte pour être une clé valide.');
}

// 3. Cohérence environnement ↔ projet. C'est le garde-fou qui compte : il
// rend impossible qu'un build de test parle à la base de production, même
// si quelqu'un colle la mauvaise valeur dans les variables Cloudflare.
const vise_production = url.includes(REF_PRODUCTION);
if (env === 'test' && vise_production) {
  echouer('REFUS : NEXUS_ENV vaut « test » mais NEXUS_SUPABASE_URL désigne le projet de PRODUCTION.');
}
if (env === 'production' && !vise_production) {
  echouer('REFUS : NEXUS_ENV vaut « production » mais NEXUS_SUPABASE_URL ne désigne pas le projet de production.');
}

// 4. Écriture du fichier de configuration.
const contenu = `// Généré par outils/generer-config.js au moment du build.
// NE PAS VERSIONNER, NE PAS ÉDITER À LA MAIN, NE PAS METTRE EN CACHE.
// Environnement : ${env}
(function (global) {
  'use strict';
  global.NEXUS_CONFIG = Object.freeze({
    environnement: ${JSON.stringify(env)},
    supabaseUrl: ${JSON.stringify(url)},
    supabaseCle: ${JSON.stringify(cle)},
  });
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(CIBLE, contenu);

// 5. Insertion de la balise dans chaque écran qui charge nexus-auth.js,
// juste AVANT lui : la configuration doit exister quand nexus-auth.js
// s'exécute. La balise ne porte pas d'épingle `?v=` — ce fichier ne doit
// jamais être mis en cache, puisqu'il distingue les environnements.
const BALISE = '<script src="nexus-config.js"></script>';
let poses = 0, deja = 0;
for (const f of fs.readdirSync(RACINE).filter(x => x.endsWith('.html'))) {
  const chemin = path.join(RACINE, f);
  const avant = fs.readFileSync(chemin, 'utf8');
  if (!/<script src="nexus-auth\.js/.test(avant)) continue;
  if (avant.includes(BALISE)) { deja++; continue; }
  const apres = avant.replace(/(<script src="nexus-auth\.js)/, `${BALISE}\n$1`);
  fs.writeFileSync(chemin, apres);
  poses++;
}

// L'écran de connexion n'inclut pas nexus-auth.js — il a pourtant besoin de
// la configuration. Il est traité explicitement plutôt qu'oublié.
const LOGIN = path.join(RACINE, 'NEXUS-Login-v1.html');
if (fs.existsSync(LOGIN)) {
  const avant = fs.readFileSync(LOGIN, 'utf8');
  if (!avant.includes(BALISE)) {
    const apres = avant.replace(/(<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>)/,
      `$1\n${BALISE}`);
    if (apres === avant) echouer('Impossible d’insérer la configuration dans NEXUS-Login-v1.html.');
    fs.writeFileSync(LOGIN, apres);
    poses++;
  } else deja++;
}

console.log(`Configuration NEXUS générée — environnement « ${env} ».`);
console.log(`  nexus-config.js écrit à la racine publiée.`);
console.log(`  balise posée sur ${poses} écran(s), déjà présente sur ${deja}.`);
