#!/usr/bin/env node
// NEXUS — empreinte et provenance de l'artefact Pages (15/09/2026).
//
// POURQUOI CE FICHIER EXISTE. La procédure Production v2 pose un principe non
// négociable : « construire une fois, tester l'artefact construit, puis
// promouvoir exactement le même artefact ». « Exactement le même » n'est pas
// une intention, c'est une mesure — sinon personne ne peut dire, après coup,
// si ce qui a été servi est ce qui a été éprouvé.
//
// Ce script calcule cette mesure : une empreinte sha256 de l'arbre entier,
// stable, reproductible, indépendante de l'ordre de lecture du système de
// fichiers, des dates de modification et de la machine qui la calcule.
//
// ─── L'EMPREINTE NE VIT PAS DANS L'ARTEFACT ────────────────────────────────
// Elle est écrite dehors : journal du run, résumé de job, sortie d'étape.
// Un fichier ne peut pas nommer sa propre empreinte — l'y écrire la déplace,
// et il faudrait alors une seconde empreinte pour dire laquelle est vraie.
// Ce script n'écrit JAMAIS dans l'arbre qu'il mesure ; il ne fait que lire.
//
// ─── LE PÉRIMÈTRE DE L'EMPREINTE = LE PÉRIMÈTRE DE CE QUI EST SERVI ────────
// `actions/upload-pages-artifact` écarte depuis la v4.0.0 tout chemin dont un
// segment commence par un point. Une empreinte qui compterait ces fichiers
// mesurerait autre chose que ce que Pages sert : elle changerait sans que le
// site change, et ne pourrait jamais être confrontée à l'URL réelle. Ce
// script applique donc la même exclusion, et seulement celle-là — le tri du
// contenu, lui, est le travail de `composer-artefact-public.js`.
//
// ─── REPRODUCTIBLE À LA MAIN ───────────────────────────────────────────────
// L'empreinte est le sha256 d'un manifeste texte, une ligne par fichier,
// « <sha256>  <chemin relatif> », trié en ordre d'octets. Soit, dans un
// terminal, à la racine de l'artefact :
//
//   find . -type f -not -path '*/.*' | sed 's|^\./||' | LC_ALL=C sort \
//     | while read -r f; do printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"; done \
//     | shasum -a 256
//
// Cette recette n'est pas décorative : une empreinte qu'on ne peut pas
// recalculer sans l'outil qui l'a produite ne prouve rien contre cet outil.
//
// Usage :
//   node outils/empreinte-artefact.js --racine=_site
//   node outils/empreinte-artefact.js --racine=. --arbre-source=. --journal=/tmp/e.txt
//   node outils/empreinte-artefact.js --racine=_site --attendu=<sha256>
//
// Options :
//   --racine=<dir>         arbre à mesurer (ce qui partira vers le site)
//   --arbre-source=<dir>   arbre d'où il vient, pour la provenance (défaut : .)
//   --environnement=<nom>  environnement ciblé (défaut : $NEXUS_ENV ou `inconnu`)
//   --journal=<fichier>    y écrit le manifeste complet et la provenance
//   --sortie=<fichier>     y ajoute `empreinte=…` (pour $GITHUB_OUTPUT)
//   --resume=<fichier>     y ajoute un résumé Markdown (pour $GITHUB_STEP_SUMMARY)
//   --attendu=<sha256>     échoue si l'empreinte mesurée diffère
//
// Codes de sortie : 0 mesurée (et conforme à `--attendu` s'il est donné),
//                   1 impossible à mesurer, ou différente de `--attendu`.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
// LE CŒUR, EN FONCTIONS PURES
// ═══════════════════════════════════════════════════════════════════════════
// Tout ce qui décide est ici, sans processus ni sortie standard : une
// mutation coûte alors des microsecondes, et l'épreuve porte sur le verdict
// lui-même plutôt que sur un texte de journal.

function estCache(nom) { return nom.startsWith('.'); }

function sha256(octets) { return crypto.createHash('sha256').update(octets).digest('hex'); }

// Ordre d'octets, jamais `localeCompare` : la collation dépend de la machine
// et de sa locale. Deux runs du même arbre sur deux runners doivent produire
// le même manifeste, donc le même ordre, donc la même empreinte.
function ordreOctets(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// Parcourt l'arbre et rend la liste des fichiers retenus, triée.
// Rend aussi ce qui a été écarté et ce qui force l'arrêt : une mesure qui
// tait ce qu'elle n'a pas pu lire n'est pas une mesure.
function inventorier(racine) {
  const fichiers = [];
  const caches = [];
  const arret = [];

  function parcourir(relatif) {
    let entrees;
    try {
      entrees = fs.readdirSync(path.join(racine, relatif), { withFileTypes: true });
    } catch (e) {
      arret.push(`Dossier illisible : ${relatif || '.'} (${e.code || e.message}).`);
      return;
    }
    for (const entree of entrees) {
      const rel = relatif ? `${relatif}/${entree.name}` : entree.name;

      if (estCache(entree.name)) { caches.push(rel); continue; }

      // Un chemin qui contient un saut de ligne casserait le manifeste — deux
      // arbres différents pourraient alors produire la même empreinte. On ne
      // devine pas : on refuse.
      if (/[\n\r]/.test(entree.name)) {
        arret.push(`Nom de fichier contenant un saut de ligne : ${JSON.stringify(rel)}.`);
        continue;
      }

      // Un lien symbolique n'est pas emballé tel quel ; le suivre ferait
      // dépendre l'empreinte de ce qui est HORS de l'artefact.
      if (entree.isSymbolicLink()) {
        arret.push(`Lien symbolique : ${rel}. L'artefact n'en accepte pas.`);
        continue;
      }

      if (entree.isDirectory()) { parcourir(rel); continue; }
      if (!entree.isFile()) { arret.push(`Entrée d'un type inattendu : ${rel}.`); continue; }

      fichiers.push(rel);
    }
  }

  parcourir('');
  fichiers.sort(ordreOctets);
  return { fichiers, caches, arret };
}

// Le manifeste : une ligne par fichier, « <sha256>  <chemin> », fin de ligne
// LF quelle que soit la plateforme.
function manifeste(racine, fichiers) {
  let texte = '';
  let octets = 0;
  for (const rel of fichiers) {
    const contenu = fs.readFileSync(path.join(racine, rel));
    octets += contenu.length;
    texte += `${sha256(contenu)}  ${rel}\n`;
  }
  return { texte, octets };
}

// L'empreinte de l'arbre = sha256 du manifeste.
function empreinte(racine) {
  const { fichiers, caches, arret } = inventorier(racine);
  if (arret.length) return { ok: false, arret, fichiers: [], caches };
  if (!fichiers.length) return { ok: false, arret: ['Arbre vide : rien à mesurer.'], fichiers: [], caches };
  const { texte, octets } = manifeste(racine, fichiers);
  return { ok: true, arret: [], empreinte: sha256(texte), manifeste: texte, fichiers, caches, octets };
}

module.exports = { empreinte, inventorier, manifeste, sha256, ordreOctets, estCache };

// ═══════════════════════════════════════════════════════════════════════════
// LIGNE DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════
if (require.main !== module) return;

const args = process.argv.slice(2);
function option(nom, defaut = null) {
  const t = args.find(a => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : defaut;
}

const RACINE = path.resolve(option('racine') || '.');
const SOURCE = path.resolve(option('arbre-source') || '.');
const ENVIRONNEMENT = option('environnement') || process.env.NEXUS_ENV || 'inconnu';
const JOURNAL = option('journal');
const SORTIE = option('sortie');
const RESUME = option('resume');
const ATTENDU = option('attendu');

function echouer(lignes) {
  console.error('\n  ÉCHEC — empreinte non mesurée :');
  for (const l of lignes) console.error(`    · ${l}`);
  console.error('');
  process.exit(1);
}

if (!fs.existsSync(RACINE) || !fs.statSync(RACINE).isDirectory()) {
  echouer([`La racine « ${RACINE} » n'existe pas ou n'est pas un dossier.`]);
}

const mesure = empreinte(RACINE);
if (!mesure.ok) echouer(mesure.arret);

// ── Provenance ─────────────────────────────────────────────────────────────
// Les six champs que la procédure v2 exige de l'artefact. Ils sont produits
// ici et écrits DEHORS, jamais dans l'arbre mesuré.

function shaSource() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SOURCE, encoding: 'utf8' }).trim(); }
  catch (e) { return process.env.GITHUB_SHA || 'inconnu'; }
}

function identifiantBuild() {
  const f = path.join(RACINE, 'nexus-build.js');
  if (!fs.existsSync(f)) return 'absent (arbre non construit)';
  const m = fs.readFileSync(f, 'utf8').match(/id:\s*'([^']+)'/);
  return m ? m[1] : 'illisible';
}

// Les migrations sont une propriété de la SOURCE, pas de l'artefact : elles
// n'y sont jamais (c'est le but). Les inventorier ici relie quand même la
// release à l'état de base qu'elle suppose.
function migrations() {
  const trouvees = [];
  function chercher(relatif, profondeur) {
    let entrees;
    try { entrees = fs.readdirSync(path.join(SOURCE, relatif || '.'), { withFileTypes: true }); }
    catch (e) { return; }
    for (const e of entrees) {
      const rel = relatif ? `${relatif}/${e.name}` : e.name;
      if (estCache(e.name) || e.name === 'node_modules') continue;
      if (e.isDirectory()) {
        const pertinent = profondeur === 0
          ? (e.name.startsWith('migrations') || e.name === 'supabase')
          : true;
        if (pertinent && profondeur < 3) chercher(rel, profondeur + 1);
        continue;
      }
      if (e.isFile() && e.name.toLowerCase().endsWith('.sql')) trouvees.push(rel);
    }
  }
  chercher('', 0);
  trouvees.sort(ordreOctets);
  let texte = '';
  for (const rel of trouvees) texte += `${sha256(fs.readFileSync(path.join(SOURCE, rel)))}  ${rel}\n`;
  return { liste: trouvees, empreinte: trouvees.length ? sha256(texte) : 'aucune', texte };
}

const MIGRATIONS = migrations();
const PROVENANCE = {
  sha_source: shaSource(),
  empreinte_artefact: mesure.empreinte,
  environnement: ENVIRONNEMENT,
  identifiant_build: identifiantBuild(),
  migrations_nombre: MIGRATIONS.liste.length,
  migrations_empreinte: MIGRATIONS.empreinte,
  fichiers: mesure.fichiers.length,
  octets: mesure.octets,
  procede: 'outils/composer-artefact-public.js → outils/verifier-artefact-pages.js → outils/empreinte-artefact.js',
  atelier: process.env.GITHUB_WORKFLOW_REF || 'hors GitHub Actions',
  run: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT || '1'}` : 'hors GitHub Actions',
};

// ── Restitution ────────────────────────────────────────────────────────────
console.log('\n── Empreinte de l\'artefact ────────────────────────────────────');
console.log(`  racine      : ${RACINE}`);
console.log(`  fichiers    : ${mesure.fichiers.length} (${mesure.caches.length} chemin(s) caché(s) hors périmètre, comme à l'emballage)`);
console.log(`  octets      : ${mesure.octets}`);
console.log('');
for (const [cle, valeur] of Object.entries(PROVENANCE)) {
  console.log(`  ${cle.padEnd(20)}: ${valeur}`);
}
console.log('── ────────────────────────────────────────────────────────────\n');

if (JOURNAL) {
  const entete = Object.entries(PROVENANCE).map(([c, v]) => `# ${c}: ${v}`).join('\n');
  fs.writeFileSync(JOURNAL,
    `# Empreinte de l'artefact NEXUS — écrite HORS de l'artefact, par construction.\n`
    + `${entete}\n#\n`
    + `# Manifeste : une ligne par fichier servi, « <sha256>  <chemin> », ordre d'octets.\n`
    + `# L'empreinte ci-dessus est le sha256 de tout ce qui suit cette ligne.\n`
    + mesure.manifeste
    + (MIGRATIONS.liste.length ? `\n# Migrations de la source (jamais dans l'artefact) :\n${MIGRATIONS.texte}` : ''));
  console.log(`  Manifeste écrit : ${JOURNAL}`);
}

if (SORTIE) {
  fs.appendFileSync(SORTIE,
    `empreinte=${mesure.empreinte}\n`
    + `fichiers=${mesure.fichiers.length}\n`
    + `octets=${mesure.octets}\n`
    + `identifiant_build=${PROVENANCE.identifiant_build}\n`);
}

if (RESUME) {
  fs.appendFileSync(RESUME,
    `### Empreinte de l'artefact\n\n`
    + `| Champ | Valeur |\n|---|---|\n`
    + Object.entries(PROVENANCE).map(([c, v]) => `| \`${c}\` | \`${v}\` |`).join('\n')
    + `\n\nEmpreinte reproductible à la main : voir l'en-tête de \`outils/empreinte-artefact.js\`.\n\n`);
}

if (ATTENDU && ATTENDU !== mesure.empreinte) {
  console.error('\n  ÉCHEC — l\'artefact n\'est pas celui qui était attendu.');
  console.error(`    attendu : ${ATTENDU}`);
  console.error(`    mesuré  : ${mesure.empreinte}`);
  console.error('  Un artefact reconstruit n\'est pas l\'artefact éprouvé. Promouvoir celui qui a été testé.\n');
  process.exit(1);
}

if (ATTENDU) console.log(`  Conforme à --attendu.\n`);
