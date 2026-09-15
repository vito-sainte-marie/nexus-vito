#!/usr/bin/env node
// NEXUS — composition de l'artefact public GitHub Pages (15/09/2026).
//
// POURQUOI CE FICHIER EXISTE. La première version du workflow de déploiement
// emballait `path: .` — **la racine entière du dépôt**. En mode « construit »
// cela aurait publié, sur un site accessible sans authentification : les 176
// fichiers de test, les 11 migrations SQL à la racine et les trois dossiers
// `migrations*`, l'intégralité de `supabase/` (247 fichiers : politiques RLS,
// fonctions Edge, schéma), `outils/` (la chaîne de build), `docs/` (les plans
// internes), `CLAUDE.md` et les vingt notes de travail à la racine.
//
// Aucun de ces fichiers n'est un secret au sens de la garde — c'est
// précisément le piège : `outils/verifier-artefact-pages.js` les aurait tous
// acceptés, parce qu'ils ne contiennent aucune clé. Ils décrivent en revanche
// la structure de la base, le nom des tables, la forme des politiques et les
// intentions du projet. Publier la carte n'est pas publier la clé, mais ce
// n'est pas non plus rien.
//
// Ce script compose donc un arbre **dédié** : ce qui sert les écrans, et rien
// d'autre.
//
// LA LISTE EST UNE LISTE D'EXCLUSION, PAS UNE LISTE D'INCLUSION. Ce choix est
// délibéré et va dans le sens le moins dangereux des deux : une liste
// d'inclusion oubliée casse un écran en Production sans prévenir ; une liste
// d'exclusion oubliée publie un fichier de trop, ce qui se corrige. Le filet
// qui rattrape l'oubli est ailleurs — `outils/verifier-artefact-pages.js`
// résout, après composition, **toutes** les références `src`/`href` de tous
// les écrans de l'artefact et refuse si l'une d'elles ne pointe plus sur
// rien. C'est ce contrôle-là, et non cette liste, qui prouve que rien de
// nécessaire n'a été retiré.
//
// IL NE DÉPLOIE RIEN ET NE MODIFIE PAS L'ARBRE SOURCE. Il lit la source et
// écrit une destination neuve, jamais l'inverse.
//
// Usage :
//   node outils/composer-artefact-public.js
//   node outils/composer-artefact-public.js --source=. --destination=_site
//   node outils/composer-artefact-public.js --vider      (voir plus bas)
//
// Options :
//   --source=<dir>        arbre à composer (défaut : la racine du dépôt)
//   --destination=<dir>   arbre à produire (défaut : `_site` sous la source)
//   --vider               vide une destination déjà composée avant de
//                         recomposer. Ne vide **que** si le marqueur
//                         `.artefact-public` s'y trouve : ce script ne doit
//                         jamais pouvoir effacer un dossier qu'il n'a pas
//                         lui-même fabriqué.
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function option(nom) {
  const t = args.find(a => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : null;
}

const SOURCE = path.resolve(option('source') || path.join(__dirname, '..'));
const DESTINATION = path.resolve(option('destination') || path.join(SOURCE, '_site'));
const VIDER = args.includes('--vider');
const MARQUEUR = '.artefact-public';

// ═══════════════════════════════════════════════════════════════════════════
// LA LISTE D'EXCLUSION
// ═══════════════════════════════════════════════════════════════════════════
// Chaque entrée porte son motif. Une exclusion dont personne ne sait plus
// pourquoi elle est là finit par être levée « au cas où », et ramène avec
// elle ce qu'elle écartait.

// Dossiers de premier niveau. L'exclusion porte sur le dossier entier.
const DOSSIERS_EXCLUS = new Map([
  ['.git', 'historique et objets Git'],
  ['.github', 'workflows et configuration du dépôt'],
  ['node_modules', 'dépendances d\'outillage, jamais servies'],
  ['docs', 'plans et notes internes de conduite du projet'],
  ['supabase', 'schéma, politiques RLS et fonctions Edge — le côté serveur'],
  ['outils', 'chaîne de build et scripts d\'exploitation'],
  ['simulations', 'scénarios de non-régression'],
  ['nexus-ocr-worker', 'agent local, exécuté hors du site'],
]);

// Tout dossier de premier niveau dont le nom commence par `migrations` :
// `migrations/`, `migrations_carburant_chaine_preuve/`,
// `migrations_fdj_releve_cloture/`, et ceux qui viendront.
const DOSSIERS_EXCLUS_PREFIXE = [
  ['migrations', 'migrations SQL — elles décrivent la base, pas les écrans'],
];

// Fichiers, à n'importe quelle profondeur. `teste` reçoit le nom de base.
const FICHIERS_EXCLUS = [
  [n => /^test_.*\.js$/.test(n), 'fichier de test'],
  [n => n === 'run-tests.js', 'lanceur de la suite de tests'],
  [n => n.toLowerCase().endsWith('.md'), 'document interne (dont `CLAUDE.md`)'],
  [n => n.toLowerCase().endsWith('.sql'), 'migration ou requête SQL'],
  [n => n.toLowerCase().endsWith('.ts'), 'source de fonction Edge (côté serveur)'],
  [n => n.toLowerCase().endsWith('.py'), 'script Python d\'outillage'],
  [n => n.toLowerCase().endsWith('.sh'), 'script shell d\'outillage'],
  [n => n === 'package.json' || n === 'package-lock.json', 'métadonnées npm — ne servent qu\'à lancer les tests'],
  // `manifest.json` est le catalogue de génération des icônes (racine et
  // `assets/icons/`). Le manifeste PWA réellement référencé par les écrans
  // est `site.webmanifest`, qui n'est pas concerné.
  [n => n === 'manifest.json', 'catalogue de génération d\'icônes, référencé par aucun écran'],
];

// Les fichiers et dossiers cachés, à n'importe quelle profondeur.
// Ce n'est pas un choix : `actions/upload-pages-artifact` les écarte
// lui-même depuis la v4.0.0 (« hidden files will not be included »). Les
// écarter ici rend l'arbre composé **égal** à l'arbre publié, ce qui est la
// condition pour que la garde contrôle exactement ce qui sera servi.
// Seule exception : le marqueur, écrit après coup et hors inventaire.
function estCache(nom) { return nom.startsWith('.'); }

// ═══════════════════════════════════════════════════════════════════════════

function motifExclusionDossier(nom, profondeur) {
  if (profondeur === 0 && DOSSIERS_EXCLUS.has(nom)) return DOSSIERS_EXCLUS.get(nom);
  if (estCache(nom)) return 'fichier ou dossier caché — écarté par upload-pages-artifact v4+';
  if (profondeur > 0) return null;
  for (const [prefixe, motif] of DOSSIERS_EXCLUS_PREFIXE) {
    if (nom.startsWith(prefixe)) return motif;
  }
  return null;
}

function motifExclusionFichier(nom) {
  if (estCache(nom)) return 'fichier ou dossier caché — écarté par upload-pages-artifact v4+';
  for (const [teste, motif] of FICHIERS_EXCLUS) if (teste(nom)) return motif;
  return null;
}

// ── Vérifications préalables ───────────────────────────────────────────────
if (!fs.existsSync(SOURCE) || !fs.statSync(SOURCE).isDirectory()) {
  console.error(`\n  ÉCHEC — la source « ${SOURCE} » n'existe pas.\n`);
  process.exit(1);
}
if (DESTINATION === SOURCE) {
  console.error(`\n  ÉCHEC — la destination ne peut pas être la source.\n`);
  process.exit(1);
}

if (fs.existsSync(DESTINATION)) {
  const contenu = fs.readdirSync(DESTINATION);
  if (contenu.length) {
    const compose = fs.existsSync(path.join(DESTINATION, MARQUEUR));
    if (!VIDER) {
      console.error(`\n  ÉCHEC — la destination « ${DESTINATION} » existe et n'est pas vide.`);
      console.error(`  ${compose ? 'Elle porte le marqueur : relancer avec --vider.' : 'Elle ne porte PAS le marqueur `.artefact-public` : ce script refuse de l\'effacer.'}\n`);
      process.exit(1);
    }
    if (!compose) {
      console.error(`\n  ÉCHEC — --vider a été demandé, mais « ${DESTINATION} » ne porte pas le marqueur`);
      console.error(`  \`${MARQUEUR}\`. Ce script n'efface que ce qu'il a lui-même composé.\n`);
      process.exit(1);
    }
    fs.rmSync(DESTINATION, { recursive: true, force: true });
  }
}

// Une destination placée sous la source ne doit jamais se recopier elle-même.
const DESTINATION_INTERNE = DESTINATION.startsWith(SOURCE + path.sep);

// ── Composition ────────────────────────────────────────────────────────────
const retenus = [];
const ecartes = new Map();   // motif → nombre
const arret = [];
const premierNiveau = [];

function compter(motif) { ecartes.set(motif, (ecartes.get(motif) || 0) + 1); }

function composer(relatif, profondeur) {
  const absSource = path.join(SOURCE, relatif);
  for (const entree of fs.readdirSync(absSource, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = relatif ? `${relatif}/${entree.name}` : entree.name;
    const abs = path.join(SOURCE, rel);

    if (DESTINATION_INTERNE && abs === DESTINATION) continue;

    // Échec fermé : un lien symbolique publié pointe hors de l'artefact ou
    // duplique un fichier sans que l'inventaire le dise. On ne devine pas.
    if (entree.isSymbolicLink()) {
      arret.push(`Lien symbolique : ${rel}. L'artefact public n'en accepte pas.`);
      continue;
    }

    if (entree.isDirectory()) {
      const motif = motifExclusionDossier(entree.name, profondeur);
      if (profondeur === 0) premierNiveau.push({ nom: entree.name + '/', motif });
      if (motif) { compter(motif); continue; }
      composer(rel, profondeur + 1);
      continue;
    }

    if (!entree.isFile()) { arret.push(`Entrée d'un type inattendu : ${rel}.`); continue; }

    const motif = motifExclusionFichier(entree.name);
    if (profondeur === 0) premierNiveau.push({ nom: entree.name, motif });
    if (motif) { compter(motif); continue; }

    const cible = path.join(DESTINATION, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(abs, cible);
    retenus.push(rel);
  }
}

fs.mkdirSync(DESTINATION, { recursive: true });
composer('', 0);

if (arret.length) {
  console.error('\n  ÉCHEC — composition interrompue :');
  for (const a of arret) console.error(`    · ${a}`);
  console.error('');
  process.exit(1);
}

fs.writeFileSync(path.join(DESTINATION, MARQUEUR),
  'Marqueur de outils/composer-artefact-public.js.\n'
  + 'Sa seule fonction est d\'autoriser --vider sur ce dossier.\n'
  + 'Fichier caché : upload-pages-artifact v4+ ne l\'emballe pas.\n');

// ── Inventaire ─────────────────────────────────────────────────────────────
// L'inventaire est imprimé en entier, et c'est voulu : le journal du workflow
// est la seule trace lisible de ce qui a été publié un jour donné.
const totalEcartes = [...ecartes.values()].reduce((a, b) => a + b, 0);

console.log('\n── Composition de l\'artefact public ───────────────────────────');
console.log(`  source      : ${SOURCE}`);
console.log(`  destination : ${DESTINATION}`);
console.log('');
console.log('  Premier niveau :');
for (const e of premierNiveau) {
  console.log(`    ${e.motif ? '✗' : '✓'} ${e.nom.padEnd(38)}${e.motif ? '— ' + e.motif : ''}`);
}
console.log('');
console.log('  Écarté, par motif :');
for (const [motif, n] of [...ecartes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(5)}  ${motif}`);
}
console.log('');

const parExtension = new Map();
for (const rel of retenus) {
  const ext = path.extname(rel).toLowerCase() || '(sans extension)';
  parExtension.set(ext, (parExtension.get(ext) || 0) + 1);
}
console.log('  Retenu, par extension :');
for (const [ext, n] of [...parExtension.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(5)}  ${ext}`);
}
console.log('');
console.log(`  ${retenus.length} fichier(s) composé(s), ${totalEcartes} écarté(s) (dossiers exclus comptés pour un).`);
console.log('── Artefact public composé ─────────────────────────────────────\n');
