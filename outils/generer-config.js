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
const BALISE_CONFIG = '<script src="nexus-config.js"></script>';

// Le bandeau d'environnement suit immédiatement la configuration : il la lit,
// et il doit être posé sur EXACTEMENT les mêmes écrans — sinon il resterait
// des pages de recette impossibles à distinguer de la production. Une seule
// implémentation, `nexus-bandeau-environnement.js`, plutôt qu'un extrait
// recopié écran par écran : c'est la duplication de la configuration entre
// nexus-auth.js et l'écran de connexion qui avait ouvert le défaut d'origine.
const BALISE_BANDEAU = '<script src="nexus-bandeau-environnement.js"></script>';

// `nexus-page.js` identifie la page courante indépendamment de l'hébergeur.
// Il doit précéder nexus-auth.js, qui l'utilise pour ses gardes de séquence
// obligatoire, ET les scripts que nexus-auth.js injecte ensuite. Sans lui,
// Cloudflare retirant l'extension `.html` des URL, l'écran de prise de poste
// ne se reconnaissait plus lui-même et bouclait indéfiniment.
const BALISE_PAGE = '<script src="nexus-page.js"></script>';

// Les balises sont posées dans cet ordre, chacune une seule fois : la
// configuration d'abord (les deux autres la lisent ou en dépendent), puis
// l'identification de page, puis le bandeau.
const BALISES_ORDONNEES = [BALISE_CONFIG, BALISE_PAGE, BALISE_BANDEAU];

// Une balise peut déjà porter une épingle `?v=…` posée par un build
// précédent : on la reconnaît par son nom de fichier, jamais par la chaîne
// exacte. Sans cela, relancer le build dupliquerait les balises.
function dejaPresente(contenu, balise) {
  const fichier = /src="([^"?]+)/.exec(balise)[1].replace(/[.]/g, '\\.');
  return new RegExp(`<script src="${fichier}(\\?[^"]*)?"></script>`).test(contenu);
}

function poserBalises(contenu, ancre) {
  let sortie = contenu;
  if (!dejaPresente(sortie, BALISE_CONFIG)) {
    const remplace = sortie.replace(ancre, `${BALISE_CONFIG}\n$&`);
    if (remplace === sortie) return null;
    sortie = remplace;
  }
  let precedente = BALISE_CONFIG;
  for (const balise of BALISES_ORDONNEES.slice(1)) {
    if (!dejaPresente(sortie, balise)) {
      const apres = sortie.replace(
        new RegExp(`<script src="${/src="([^"?]+)/.exec(precedente)[1].replace(/[.]/g, '\\.')}(\\?[^"]*)?"></script>`),
        m => `${m}\n${balise}`);
      sortie = apres;
    }
    precedente = balise;
  }
  return sortie;
}

let poses = 0, deja = 0;
for (const f of fs.readdirSync(RACINE).filter(x => x.endsWith('.html'))) {
  const chemin = path.join(RACINE, f);
  const avant = fs.readFileSync(chemin, 'utf8');
  if (!/<script src="nexus-auth\.js/.test(avant)) continue;
  const apres = poserBalises(avant, /<script src="nexus-auth\.js/);
  if (apres === null) echouer(`Impossible d’insérer la configuration dans ${f}.`);
  if (apres === avant) { deja++; continue; }
  fs.writeFileSync(chemin, apres);
  poses++;
}

// L'écran de connexion n'inclut pas nexus-auth.js — il a pourtant besoin de
// la configuration, et c'est l'écran où savoir à quelle base on parle compte
// le plus. Il est traité explicitement plutôt qu'oublié.
const LOGIN = path.join(RACINE, 'NEXUS-Login-v1.html');
if (fs.existsSync(LOGIN)) {
  const avant = fs.readFileSync(LOGIN, 'utf8');
  const apres = poserBalises(avant, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/);
  if (apres === null) echouer('Impossible d’insérer la configuration dans NEXUS-Login-v1.html.');
  if (apres === avant) deja++; else { fs.writeFileSync(LOGIN, apres); poses++; }
}

// 6. `robots.txt` — l'environnement de test ne doit pas être indexable.
//
// Le fichier versionné est celui de la PRODUCTION (`Allow: /`). Le laisser
// tel quel sur la recette revenait à publier, ouvert aux moteurs, une copie
// des données métier de la station sous une URL devinable. Il est donc
// réécrit au build pour le test, et laissé intact pour la production —
// exactement la même logique que nexus-config.js : c'est le build, jamais le
// dépôt, qui décide de ce qui distingue les deux environnements.
const ROBOTS = path.join(RACINE, 'robots.txt');
if (env === 'test') {
  fs.writeFileSync(ROBOTS, [
    '# Environnement de RECETTE — écrit au build par outils/generer-config.js.',
    '# Ne pas indexer : cette copie ne fait autorité sur rien.',
    'User-agent: *',
    'Disallow: /',
    ''
  ].join('\n'));
}

// 7. `_headers` — Cloudflare Pages. `nexus-config.js` désigne l'environnement :
// un exemplaire gardé en cache, c'est un écran de recette qui parle à la
// production ou l'inverse. `no-store` est la seule directive qui interdise
// la conservation ; `max-age=0, must-revalidate` autorise encore un stockage
// suivi d'une revalidation, donc une fenêtre de service depuis le cache.
// Vérifié ici, en échec fermé : un build ne doit pas pouvoir publier sans.
const ENTETES = path.join(RACINE, '_headers');
if (!fs.existsSync(ENTETES)) {
  echouer('Le fichier `_headers` est absent : `nexus-config.js` serait servi sans `no-store`.');
}
const entetes = fs.readFileSync(ENTETES, 'utf8');
if (!/^\/nexus-config\.js\s*$/m.test(entetes) || !/Cache-Control:\s*no-store/i.test(entetes)) {
  echouer('`_headers` ne porte pas la règle `Cache-Control: no-store` pour /nexus-config.js.');
}

console.log(`Configuration NEXUS générée — environnement « ${env} ».`);
console.log(`  nexus-config.js écrit à la racine publiée.`);
console.log(`  balises posées sur ${poses} écran(s), déjà présentes sur ${deja}.`);
console.log(`  robots.txt : ${env === 'test' ? 'réécrit en Disallow (recette)' : 'laissé tel quel (production)'}.`);
console.log(`  _headers : règle no-store vérifiée pour nexus-config.js.`);
