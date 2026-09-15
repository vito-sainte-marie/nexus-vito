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
//   node .github/deploiement/empreinte-artefact.js --racine=_site
//   node .github/deploiement/empreinte-artefact.js --racine=. --arbre-source=. --journal=/tmp/e.txt
//   node .github/deploiement/empreinte-artefact.js --racine=_site --attendu=<sha256>
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
//
// LE PÉRIMÈTRE EST UN SEUL DOSSIER, SANS RÉCURSION : `supabase/migrations/`.
// C'est la seule définition qui tienne : c'est ce dossier, et lui seul, que
// la CLI Supabase applique et dont elle tient le registre. Tout le reste est
// du SQL qui se trouve être du SQL.
//
// La version précédente ratissait `supabase/` en entier plus tout dossier de
// premier niveau nommé `migrations*`, plus — par un défaut de garde, la ligne
// de collecte n'étant pas soumise au test de pertinence — les `.sql` épars de
// la racine. Elle annonçait 256 « migrations » là où il y en a 240 :
//   240  supabase/migrations/*.sql        les migrations canoniques
//  + 11  *.sql à la racine                requêtes et correctifs de travail
//  +  2  supabase/repairs/, supabase/retours/
//  +  3  migrations_*/ de premier niveau
//  −  2  comptés deux fois
//  = 256
// Le plus gênant n'était pas l'écart : c'était `migrations_appliquees.sql`,
// un EXPORT de l'état appliqué, compté comme une migration. Un inventaire qui
// confond la photographie avec le geste ne peut pas servir de provenance.
//
// Un correctif de rattrapage, un export ou un retour arrière ne devient pas
// canonique parce qu'il est écrit en SQL. Le rapprochement Git ↔ Production ↔
// Test de ces fichiers-là est un lot séparé, en lecture seule, hors de ce
// rail.
const MIGRATIONS_DOSSIER = 'supabase/migrations';

//
// CETTE PROVENANCE ÉCHOUE FERMÉE. C'est le point le plus important de la
// fonction, et ce n'était pas le cas jusqu'ici. Une provenance qui, dans le
// doute, annonce « aucune » n'est pas une provenance : c'est un silence qui
// a la forme d'une mesure, et il se propage jusqu'au journal de release avec
// l'autorité d'un chiffre. Trois situations laissaient passer le rail sans
// rien mesurer :
//   · le dossier absent ou illisible — un `--arbre-source=` visant l'artefact
//     plutôt que le dépôt suffisait à produire « 0 / aucune » sans un mot ;
//   · zéro migration canonique — indiscernable, dans le journal, d'un dépôt
//     dont les migrations auraient été effacées ;
//   · une entrée d'un type inattendu — le commentaire affirmait qu'un
//     sous-dossier serait « signalé », alors qu'il était absorbé en silence.
// Les trois s'arrêtent désormais, par `echouer()`, avant toute publication.

function typeEntree(e) {
  if (e.isDirectory()) return 'sous-dossier';
  if (e.isSymbolicLink()) return 'lien symbolique';
  if (e.isFIFO()) return 'tube nommé';
  if (e.isSocket()) return 'socket';
  if (e.isBlockDevice() || e.isCharacterDevice()) return 'périphérique';
  return 'type inconnu';
}

function migrationsSource() {
  const dossier = path.join(SOURCE, MIGRATIONS_DOSSIER);
  let entrees;
  try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); }
  catch (e) {
    echouer([
      `Dossier des migrations canoniques absent ou illisible : « ${dossier} ».`,
      `Cause système : ${e.code || e.message}.`,
      `La provenance d'une release énumère « ${MIGRATIONS_DOSSIER}/*.sql ». Sans ce`,
      `dossier il n'y a rien à annoncer, et « aucune » serait un mensonge poli.`,
      `Vérifiez --arbre-source= : il doit désigner la racine du dépôt, pas l'artefact.`,
    ]);
  }

  const trouvees = [];
  const inattendues = [];
  for (const e of entrees) {
    if (estCache(e.name)) continue;
    // Pas de récursion : une migration est un FICHIER de ce dossier. Un
    // sous-dossier, un lien, tout autre type est signalé — et signalé veut
    // dire arrêté, pas ignoré.
    if (!e.isFile()) { inattendues.push(`${e.name} — ${typeEntree(e)}`); continue; }
    if (!e.name.toLowerCase().endsWith('.sql')) continue;
    trouvees.push(`${MIGRATIONS_DOSSIER}/${e.name}`);
  }

  if (inattendues.length) {
    echouer([
      `Entrée(s) d'un type inattendu dans « ${MIGRATIONS_DOSSIER}/ » :`,
      ...inattendues.map(x => `  ${x}`),
      `Ce dossier ne contient que des fichiers de migration. Un sous-dossier y`,
      `cache des migrations que cet inventaire ne compterait pas : la provenance`,
      `annoncée serait alors incomplète sans le dire. Rien n'est deviné ici.`,
    ]);
  }

  if (!trouvees.length) {
    echouer([
      `Aucune migration canonique trouvée dans « ${dossier} ».`,
      `${entrees.length} entrée(s) lue(s), zéro fichier « *.sql » non caché.`,
      `Un dépôt NEXUS en a 240 au 15/09/2026. Zéro n'est pas un inventaire vide,`,
      `c'est un inventaire qui a échoué : le rail s'arrête plutôt que d'attacher`,
      `« migrations_source_nombre: 0 » à une release.`,
    ]);
  }

  trouvees.sort(ordreOctets);

  let texte = '';
  for (const rel of trouvees) texte += `${sha256(fs.readFileSync(path.join(SOURCE, rel)))}  ${rel}\n`;
  return { liste: trouvees, empreinte: sha256(texte), texte };
}

const MIGRATIONS = migrationsSource();
const PROVENANCE = {
  sha_source: shaSource(),
  empreinte_artefact: mesure.empreinte,
  environnement: ENVIRONNEMENT,
  identifiant_build: identifiantBuild(),
  migrations_source_nombre: MIGRATIONS.liste.length,
  migrations_source_empreinte: MIGRATIONS.empreinte,
  migrations_source_liste: `${MIGRATIONS_DOSSIER}/*.sql — énumérées une à une en fin de manifeste`,
  fichiers: mesure.fichiers.length,
  octets: mesure.octets,
  procede: '.github/deploiement/composer-artefact-public.js → .github/deploiement/verifier-artefact-pages.js → .github/deploiement/empreinte-artefact.js',
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
  console.log(`  ${cle.padEnd(27)}: ${valeur}`);
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
    + `\n# Migrations canoniques de la source — \`${MIGRATIONS_DOSSIER}/*.sql\`, jamais dans\n`
    + `# l'artefact. Ni les SQL épars de la racine, ni \`supabase/repairs/\`, ni\n`
    + `# \`supabase/retours/\`, ni aucun export d'état appliqué n'y figurent : ce ne\n`
    + `# sont pas des migrations, et les compter comme telles fausserait la\n`
    + `# provenance de la release.\n`
    // Pas de repli « (aucune) » : zéro migration n'atteint jamais cette ligne,
    // `migrationsSource()` s'étant arrêtée avant.
    + MIGRATIONS.texte);
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
    + `\n\nEmpreinte reproductible à la main : voir l'en-tête de \`.github/deploiement/empreinte-artefact.js\`.\n\n`);
}

if (ATTENDU && ATTENDU !== mesure.empreinte) {
  console.error('\n  ÉCHEC — l\'artefact n\'est pas celui qui était attendu.');
  console.error(`    attendu : ${ATTENDU}`);
  console.error(`    mesuré  : ${mesure.empreinte}`);
  console.error('  Un artefact reconstruit n\'est pas l\'artefact éprouvé. Promouvoir celui qui a été testé.\n');
  process.exit(1);
}

if (ATTENDU) console.log(`  Conforme à --attendu.\n`);
