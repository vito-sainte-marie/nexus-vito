#!/usr/bin/env node
// NEXUS — contrôle de l'artefact GitHub Pages avant publication (15/09/2026).
//
// POURQUOI CE FICHIER EXISTE. Le 15/09/2026 il a été établi que
// `app.nexusconseil.net` est servi par GitHub Pages **à partir de la branche
// `production`, octet pour octet, sans aucune étape de build** : preuve par
// l'en-tête `server: GitHub.com`, par le `CNAME` de la branche, et par
// l'empreinte `sha256` d'un actif servi identique à celle du fichier de
// branche. La chaîne `outils/build.sh` n'est exécutée que par la recette
// Cloudflare. Autrement dit : ce qui est publié en Production n'est vérifié
// par personne entre `git push` et le navigateur de l'employé.
//
// Ce script est la marche manquante. Il relit l'arbre **tel qu'il sera
// publié** et refuse de laisser partir ce qu'il ne sait pas identifier ou ce
// qui contient de quoi écrire dans la base.
//
// ÉCHEC FERMÉ. Tout doute est un refus. Le script sort en code 1 et
// l'artefact n'est pas téléversé.
//
// IL NE DÉPLOIE RIEN, N'ÉCRIT RIEN, NE CONTACTE RIEN. Lecture seule.
//
// Usage :
//   node .github/deploiement/verifier-artefact-pages.js --mode=construit
//   node .github/deploiement/verifier-artefact-pages.js --mode=a-l-identique
//   node .github/deploiement/verifier-artefact-pages.js --mode=… --racine=/chemin/arbre
//
// Options :
//   --mode=construit       l'arbre sort de `bash outils/build.sh`
//   --mode=a-l-identique   l'arbre est publié tel quel (état actuel de
//                          `production`, qui ne possède pas de `build.sh`)
//   --racine=<dir>         arbre à contrôler (défaut : la racine du dépôt).
//                          En mode « construit » c'est l'artefact composé
//                          (`_site`), pas le dépôt.
//   --arbre-source=<dir>   arbre d'origine, utilisé par la SEULE règle A1
//                          (défaut : --racine). Il faut les deux parce que
//                          `outils/` ne fait pas partie de l'artefact public :
//                          « cet arbre sait-il se construire ? » se demande à
//                          la source, « qu'est-ce qui part ? » à l'artefact.
//   --refuser-mot-service-role   voir la règle S5 ci-dessous
'use strict';

const fs = require('fs');
const path = require('path');

// ── Référence du projet Supabase de Production ─────────────────────────────
// Déjà publique : elle figure dans le code servi au navigateur, et
// `outils/generer-config.js` la nomme pour la même raison — refuser qu'un
// build de test vise la Production. Elle est répétée ici et non importée :
// ce script doit pouvoir contrôler un arbre qui ne contient PAS `outils/`.
const REF_PRODUCTION = 'uzhjpqpctpvxytxpxoqz';

// ── Sortie ─────────────────────────────────────────────────────────────────
// Aucune valeur suspecte n'est jamais imprimée : on nomme le fichier, la
// ligne et la règle, jamais le contenu. Un journal d'Actions est lisible par
// quiconque a accès au dépôt — y déverser une clé la publierait.
const refus = [];
const avertissements = [];
const constats = [];

function refuser(regle, message) { refus.push({ regle, message }); }
function avertir(message) { avertissements.push(message); }
function constater(message) { constats.push(message); }

// ── Arguments ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function option(nom) {
  const t = args.find(a => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : null;
}
const MODE = option('mode');
// `.github/deploiement/` → la racine du dépôt est deux niveaux au-dessus.
const RACINE = path.resolve(option('racine') || path.join(__dirname, '..', '..'));
const ARBRE_SOURCE = path.resolve(option('arbre-source') || RACINE);
const REFUSER_MOT = args.includes('--refuser-mot-service-role');

const MODES = ['construit', 'a-l-identique'];
if (!MODES.includes(MODE)) {
  console.error(`\n  ÉCHEC — --mode est absent ou invalide.`);
  console.error(`  Valeurs acceptées : ${MODES.join(', ')}\n`);
  process.exit(1);
}
if (!fs.existsSync(RACINE) || !fs.statSync(RACINE).isDirectory()) {
  console.error(`\n  ÉCHEC — la racine « ${RACINE} » n'existe pas.\n`);
  process.exit(1);
}
if (!fs.existsSync(ARBRE_SOURCE) || !fs.statSync(ARBRE_SOURCE).isDirectory()) {
  console.error(`\n  ÉCHEC — l'arbre source « ${ARBRE_SOURCE} » n'existe pas.\n`);
  process.exit(1);
}

// ── Périmètre exact de l'artefact ──────────────────────────────────────────
// Le périmètre contrôlé ici est EXACTEMENT ce qui sera publié : contrôler
// plus large donnerait de faux refus, contrôler plus étroit laisserait passer
// un fichier réellement servi.
//
// `actions/upload-pages-artifact` écarte lui-même, **depuis la v4.0.0**, tout
// chemin dont un segment commence par un point — `.git`, `.github`,
// `.gitignore`, `supabase/.gitkeep`. C'est la raison pour laquelle ce lot est
// épinglé sur la v5 et non sur la v3 : avec la v3, `.gitignore` et
// `supabase/.gitkeep` auraient été exposés par Actions alors que le mode
// branche les masquait (Jekyll). L'écart de contenu mesuré entre les deux
// hébergements disparaît donc de lui-même.
const EXCLUS = new Set(['node_modules']);
function estCache(nom) { return nom.startsWith('.'); }

// Extensions binaires : illisibles en texte, et aucune clé ne s'y cache sous
// une forme que ces règles sauraient reconnaître. Elles sont écartées
// explicitement plutôt que silencieusement.
const BINAIRES = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz', '.pdf',
  '.zip', '.gz', '.tgz', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.mp3', '.wav', '.mov', '.heic',
]);

let horsPerimetre = 0;

function parcourir(dir, relatif = '') {
  const sortie = [];
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUS.has(entree.name) || estCache(entree.name)) { horsPerimetre++; continue; }
    const abs = path.join(dir, entree.name);
    const rel = relatif ? `${relatif}/${entree.name}` : entree.name;
    if (entree.isSymbolicLink()) { avertir(`Lien symbolique ignoré : ${rel}`); continue; }
    if (entree.isDirectory()) { dossiers.add(rel); sortie.push(...parcourir(abs, rel)); }
    else if (entree.isFile()) sortie.push(rel);
  }
  return sortie;
}

// Ensembles exacts — comparaison **sensible à la casse**. Le disque de
// développement ne l'est pas, GitHub Pages si : `href="Accueil.png"` pour un
// fichier `accueil.png` fonctionne ici et renvoie 404 en Production. Résoudre
// contre ces ensembles plutôt que contre le disque attrape cette classe
// d'erreur, que `fs.existsSync` laisserait passer.
const dossiers = new Set();

function estTexte(abs, rel) {
  if (BINAIRES.has(path.extname(rel).toLowerCase())) return false;
  const fd = fs.openSync(abs, 'r');
  const tampon = Buffer.alloc(8000);
  const lus = fs.readSync(fd, tampon, 0, 8000, 0);
  fs.closeSync(fd);
  return !tampon.subarray(0, lus).includes(0);
}

const fichiers = parcourir(RACINE);

// ═══════════════════════════════════════════════════════════════════════════
// A. COHÉRENCE DU MODE
// ═══════════════════════════════════════════════════════════════════════════
// La règle qui compte, et la seule qui ne souffre aucune exception :
// **on ne publie jamais brut un arbre qui SAIT se construire.** C'est
// exactement la panne qui menaçait le 15/09 — fusionner dans `production`
// un arbre dont les écrans exigent `nexus-config.js`, vers un hébergeur qui
// ne le fabrique pas. Le mode « à l'identique » n'existe que pour l'arbre
// d'aujourd'hui, qui n'a pas de chaîne de build ; il s'éteint de lui-même le
// jour où `outils/build.sh` arrive dans la branche.
// Évaluée sur l'ARBRE SOURCE, pas sur l'artefact : `outils/` ne fait pas
// partie de l'artefact public, et chercher `build.sh` dans `_site` conclurait
// toujours « cet arbre ne sait pas se construire » — la garde s'éteindrait
// exactement dans le cas qu'elle existe pour couvrir.
const A_BUILD = fs.existsSync(path.join(ARBRE_SOURCE, 'outils', 'build.sh'));
if (MODE === 'a-l-identique' && A_BUILD) {
  refuser('A1', 'Le mode « à l\'identique » a été demandé alors que `outils/build.sh` existe : cet arbre doit être construit, pas publié brut.');
}
if (MODE === 'construit' && !A_BUILD) {
  refuser('A1', 'Le mode « construit » a été demandé alors que `outils/build.sh` est absent : rien n\'a pu être construit.');
}
constater(`Mode « ${MODE} » — \`outils/build.sh\` ${A_BUILD ? 'présent' : 'absent'}.`);

// ═══════════════════════════════════════════════════════════════════════════
// B. PRÉSENCE DES TROIS FICHIERS
// ═══════════════════════════════════════════════════════════════════════════
// `index.html` — la page d'entrée : un artefact sans elle est un site vide.
// `nexus-build.js` — l'identité de la génération : sans elle, plus personne
//   ne sait quelle version est servie, et `--verifier` de `poser-build-id`
//   n'a plus de référence.
// `nexus-config.js` — l'URL et la clé publiable Supabase. C'est le fichier
//   dont l'absence afficherait « Configuration absente » sur tous les écrans
//   du candidat.
//
// Le statut de `nexus-config.js` DÉPEND DU MODE, et cette asymétrie est
// volontaire :
//   · en mode « construit », il est **exigé** — le build vient de l'écrire ;
//   · en mode « à l'identique », il est **interdit** — l'arbre publié brut
//     est celui d'aujourd'hui, où ce fichier n'existe pas et ne doit pas
//     exister. L'y trouver signifierait qu'une configuration a été
//     committée, c'est-à-dire précisément le défaut que tout ce lot
//     supprime : une configuration versionnée peut être périmée, et rien ne
//     le dirait.
function present(nom) { return fs.existsSync(path.join(RACINE, nom)); }

if (!present('index.html')) refuser('B1', '`index.html` est absent de l\'artefact.');
else constater('`index.html` présent.');

if (!present('nexus-build.js')) refuser('B2', '`nexus-build.js` est absent : la génération publiée serait non identifiable.');
else constater('`nexus-build.js` présent.');

if (MODE === 'construit') {
  if (!present('nexus-config.js')) {
    refuser('B3', '`nexus-config.js` est absent après construction : les écrans afficheraient « Configuration absente ».');
  } else {
    constater('`nexus-config.js` présent (produit par le build).');
  }
} else if (present('nexus-config.js')) {
  refuser('B3', '`nexus-config.js` est présent dans un arbre publié brut : une configuration versionnée peut être périmée sans que rien ne le signale.');
} else {
  constater('`nexus-config.js` absent — attendu en mode « à l\'identique » : l\'arbre servi aujourd\'hui n\'en a pas.');
}

// ═══════════════════════════════════════════════════════════════════════════
// C. COHÉRENCE DE L'ENVIRONNEMENT (mode « construit » uniquement)
// ═══════════════════════════════════════════════════════════════════════════
// `outils/generer-config.js` refuse déjà un couple environnement / projet
// incohérent. Ce contrôle-ci est le second témoin : il relit le fichier
// RÉELLEMENT écrit, sur l'arbre RÉELLEMENT publié. Une garde qui se contente
// de faire confiance à l'étape précédente ne mord pas.
//
// La clé n'est jamais lue autrement que par sa longueur, ni jamais imprimée.
if (MODE === 'construit' && present('nexus-config.js')) {
  const config = fs.readFileSync(path.join(RACINE, 'nexus-config.js'), 'utf8');
  const env = /environnement:\s*"([^"]*)"/.exec(config);
  const url = /supabaseUrl:\s*"([^"]*)"/.exec(config);
  const cle = /supabaseCle:\s*"([^"]*)"/.exec(config);

  if (!env || !url || !cle) {
    refuser('C1', '`nexus-config.js` est illisible ou incomplet : les trois champs attendus n\'y figurent pas tous.');
  } else {
    if (env[1] !== 'production') {
      refuser('C2', `\`nexus-config.js\` déclare l'environnement « ${env[1]} » : un artefact destiné à la Production ne peut pas en porter un autre.`);
    }
    if (!url[1].includes(REF_PRODUCTION)) {
      refuser('C3', '`nexus-config.js` ne vise pas le projet Supabase de Production : les écrans parleraient à une autre base.');
    }
    if (cle[1].length < 20) {
      refuser('C4', '`nexus-config.js` porte une clé trop courte pour être valide.');
    }
    if (refus.every(r => !r.regle.startsWith('C'))) {
      constater(`\`nexus-config.js\` cohérent : environnement « production », projet de Production, clé de ${cle[1].length} caractères (valeur jamais lue ni journalisée).`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// D. `_headers` — AVERTISSEMENT, PAS REFUS
// ═══════════════════════════════════════════════════════════════════════════
// `_headers` est une fonctionnalité **Cloudflare Pages**. GitHub Pages ne la
// lit pas. La règle `Cache-Control: no-store` sur `/nexus-config.js`, que
// `generer-config.js` exige en échec fermé, n'est donc PAS appliquée ici :
// le fichier qui distingue la recette de la Production sera servi avec la
// politique de cache par défaut de GitHub Pages.
//
// Ce n'est pas un refus — l'artefact reste correct, et le risque réel est
// borné : il n'y a qu'un seul environnement servi par cet hébergeur. C'est
// un écart connu, nommé ici pour qu'il ne soit pas découvert comme un
// incident.
if (present('_headers')) {
  avertir('`_headers` est présent, mais GitHub Pages l\'ignore : `no-store` sur `/nexus-config.js` ne sera PAS appliqué. Écart connu, hérité de l\'hébergement Cloudflare de la recette.');
}

// ═══════════════════════════════════════════════════════════════════════════
// P. PÉRIMÈTRE PUBLIC (mode « construit » uniquement)
// ═══════════════════════════════════════════════════════════════════════════
// Second témoin de `.github/deploiement/composer-artefact-public.js`. Le composeur décide
// ce qui part ; cette règle vérifie, sur l'arbre réellement emballé, que la
// décision a bien été appliquée. Sans elle, remettre `path: .` dans le
// workflow — une ligne — republierait la racine entière sans que rien ne le
// signale : aucun de ces fichiers ne contient de clé, donc les règles S les
// acceptent toutes.
//
// La liste reprend la lettre de la consigne du 15/09 : `.git`, `.github`,
// `docs`, `supabase`, `outils`, les tests, `CLAUDE.md` et les documents
// internes. Elle est volontairement plus courte que celle du composeur : ce
// qu'elle énumère est ce qui ne doit JAMAIS être public, pas tout ce qu'il
// est inutile de publier.
//
// Elle ne s'applique pas en mode « à l'identique » : ce mode publie l'arbre
// de `production` tel qu'il est servi aujourd'hui, documents internes
// compris. C'est un état de fait, transitoire, et la refuser reviendrait à
// interdire la bascule sans interruption — voir l'en-tête du workflow.
const PERIMETRE_PUBLIC = [
  [rel => rel === 'CLAUDE.md', 'consignes internes du dépôt'],
  [rel => /(^|\/)test_[^/]*\.js$/.test(rel), 'fichier de test'],
  [rel => rel === 'run-tests.js', 'lanceur de la suite de tests'],
  [rel => rel.toLowerCase().endsWith('.md'), 'document interne'],
  [rel => rel.toLowerCase().endsWith('.sql'), 'migration ou requête SQL'],
  [rel => /^(docs|supabase|outils|simulations|nexus-ocr-worker)\//.test(rel), 'dossier interne'],
  [rel => /^migrations[^/]*\//.test(rel), 'dossier de migrations SQL'],
];

if (MODE === 'construit') {
  const fautifs = new Map();
  for (const rel of fichiers) {
    for (const [teste, motif] of PERIMETRE_PUBLIC) {
      if (teste(rel)) {
        if (!fautifs.has(motif)) fautifs.set(motif, []);
        fautifs.get(motif).push(rel);
        break;
      }
    }
  }
  if (fautifs.size) {
    for (const [motif, liste] of fautifs) {
      const extrait = liste.slice(0, 5).join(', ') + (liste.length > 5 ? `, … (+${liste.length - 5})` : '');
      refuser('P1', `${liste.length} fichier(s) hors périmètre public — ${motif} : ${extrait}. L'artefact n'a pas été composé par \`.github/deploiement/composer-artefact-public.js\`, ou le workflow emballe encore la racine du dépôt.`);
    }
  } else {
    constater('Périmètre public respecté : ni tests, ni SQL, ni documents internes, ni dossier serveur dans l\'artefact.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R. CLÔTURE DES RÉFÉRENCES — la preuve de complétude
// ═══════════════════════════════════════════════════════════════════════════
// C'est la règle qui répond à « prouve que tous les écrans, scripts et
// ressources nécessaires à NEXUS restent présents ».
//
// La preuve ne peut pas être une liste : une liste de ce qu'il faut garder
// est écrite par la même main que la liste de ce qu'il faut exclure, et se
// trompe des deux côtés en même temps. La preuve est une **clôture** : on
// relit chaque écran et chaque script de l'artefact, on en extrait chaque
// référence locale — `src`, `href`, `url()` CSS, `import`, `fetch`,
// `new Worker`, `new URL` — et on exige que la cible existe **dans
// l'artefact**. Un écran retiré par erreur n'est pas détecté par son absence,
// il est détecté par le lien qui ne mène plus nulle part.
//
// La résolution se fait contre l'inventaire de l'artefact, **pas contre le
// disque** : elle est donc sensible à la casse, comme GitHub Pages, et ne
// peut pas valider un fichier qui existe hors artefact.
//
// Non résolu volontairement : ce qui est construit à l'exécution (`${…}`,
// `{{…}}`) et ce qui est distant. Les deux sont comptés et affichés — une
// ligne d'inventaire qui gonfle est le signal qu'un chargement dynamique
// local est apparu et que cette règle ne le couvre plus.
const fichiersSet = new Set(fichiers);

const PROTOCOLES_IGNORES = /^(?:https?:|ftp:|\/\/|data:|blob:|mailto:|tel:|sms:|javascript:|about:|#)/i;

// `url(…)` est une notation **CSS**. Dans un écran, le CSS ne vit que dans les
// blocs `<style>` et les attributs `style="…"` ; partout ailleurs, `…url(` est
// du JavaScript. Restreindre la lecture à ces zones n'est pas un raffinement :
// sans elle, l'extracteur mord sur tout identifiant qui se termine par `url`.
// Le premier passage sur l'arbre réel l'a prouvé — `URL.revokeObjectURL(a.href)`,
// `createObjectURL(blob)`, `ouvrirDepuisParametresUrl(date, quart)` — douze
// refus, douze faux positifs, zéro vrai. Une garde qui refuse à tort se fait
// débrancher aussi sûrement qu'une garde muette ; c'est le même échec.
function zonesCss(contenu) {
  const zones = [];
  for (const m of contenu.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) zones.push(m[1]);
  for (const m of contenu.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)) zones.push(m[1]);
  for (const m of contenu.matchAll(/\bstyle\s*=\s*'([^']*)'/gi)) zones.push(m[1]);
  return zones.join('\n');
}

// Second cran, à l'intérieur même du CSS : `url(` doit ouvrir un mot, jamais le
// terminer. `(?<![\w-])` écarte `…Url(`, `…URL(` et `--ma-var-url(`.
const MOTIF_URL_CSS = /(?<![\w-])url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

const EXTRACTEURS = [
  // HTML — attributs statiques, valeur entre guillemets.
  { exts: ['.html', '.htm'], motif: /\b(?:src|href)\s*=\s*"([^"]*)"/gi },
  { exts: ['.html', '.htm'], motif: /\b(?:src|href)\s*=\s*'([^']*)'/gi },
  // CSS : le fichier entier ; écran : ses seules zones CSS.
  { exts: ['.css'], motif: MOTIF_URL_CSS },
  { exts: ['.html', '.htm'], motif: MOTIF_URL_CSS, portee: zonesCss },
  // JS — chargements de modules et de ressources.
  { exts: ['.js', '.mjs'], motif: /\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g },
  { exts: ['.js', '.mjs'], motif: /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g },
  { exts: ['.js', '.mjs'], motif: /\bnew\s+Worker\(\s*['"]([^'"]+)['"]/g },
  { exts: ['.js', '.mjs'], motif: /\bfetch\(\s*['"]([^'"]+)['"]/g },
  { exts: ['.js', '.mjs'], motif: /\bnew\s+URL\(\s*['"]([^'"]+)['"]/g },
];

function resoudre(depuis, reference) {
  const base = path.posix.dirname('/' + depuis);
  const cible = reference.startsWith('/')
    ? path.posix.normalize(reference)
    : path.posix.normalize(path.posix.join(base, reference));
  return cible.replace(/^\/+/, '');
}

let referencesResolues = 0, referencesDistantes = 0, referencesDynamiques = 0;
const manquantes = [];
const vues = new Set();

for (const rel of fichiers) {
  const ext = path.extname(rel).toLowerCase();
  const extracteurs = EXTRACTEURS.filter(e => e.exts.includes(ext));
  if (!extracteurs.length) continue;
  const contenu = fs.readFileSync(path.join(RACINE, rel), 'utf8');

  for (const { motif, portee } of extracteurs) {
    const texte = portee ? portee(contenu) : contenu;
    motif.lastIndex = 0;
    let m;
    while ((m = motif.exec(texte)) !== null) {
      const brute = m[1].trim();
      if (!brute) continue;
      if (PROTOCOLES_IGNORES.test(brute)) {
        if (/^(?:https?:|ftp:|\/\/)/i.test(brute)) referencesDistantes++;
        continue;
      }
      // Construite à l'exécution : il n'y a pas de cible à vérifier.
      if (brute.includes('${') || brute.includes('{{') || brute.includes('<%') || brute.includes('+')) {
        referencesDynamiques++;
        continue;
      }
      let chemin = brute.split('#')[0].split('?')[0];
      if (!chemin) continue;
      try { chemin = decodeURIComponent(chemin); } catch { /* laissé tel quel */ }

      const cible = resoudre(rel, chemin);
      if (cible === '' || cible.startsWith('..')) {
        const cle = `${rel}→${brute}`;
        if (!vues.has(cle)) { vues.add(cle); manquantes.push({ depuis: rel, reference: brute, cause: 'sort de l\'artefact' }); }
        continue;
      }
      if (fichiersSet.has(cible)) { referencesResolues++; continue; }
      if (dossiers.has(cible) && fichiersSet.has(`${cible}/index.html`)) { referencesResolues++; continue; }
      if (chemin === '/' && fichiersSet.has('index.html')) { referencesResolues++; continue; }

      const cle = `${rel}→${brute}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      manquantes.push({ depuis: rel, reference: brute, cause: 'cible absente de l\'artefact' });
    }
  }
}

if (manquantes.length) {
  for (const m of manquantes.slice(0, 25)) {
    refuser('R1', `${m.depuis} référence « ${m.reference} » — ${m.cause}. L'écran serait servi avec une ressource manquante.`);
  }
  if (manquantes.length > 25) {
    refuser('R1', `… et ${manquantes.length - 25} autre(s) référence(s) non résolue(s), non listées.`);
  }
} else {
  constater(`Clôture des références vérifiée : ${referencesResolues} référence(s) locale(s) résolue(s) dans l'artefact, zéro manquante (${referencesDistantes} distante(s), ${referencesDynamiques} construite(s) à l'exécution, non résolues).`);
}

// ═══════════════════════════════════════════════════════════════════════════
// S. ANALYSE DE SECRETS
// ═══════════════════════════════════════════════════════════════════════════
// Ce que l'on cherche : de quoi ÉCRIRE dans la base de Production. Une clé
// publiable dans un artefact public est normale — c'est son métier. Une clé
// de service, un mot de passe de connexion ou une clé privée, non.
//
// POURQUOI DES FORMES ET NON DES MOTS. La consigne parle de refuser
// « `service_role` ». Appliquée à la lettre, elle refuserait l'artefact
// d'aujourd'hui : mesure du 15/09/2026 sur `origin/production`, **17
// fichiers** contiennent la chaîne `service_role` — 12 migrations SQL (des
// `grant … to anon, authenticated, service_role`), 2 notes, un commentaire
// d'Edge Function qui dit précisément « pas de service_role ici,
// volontairement », un script d'outillage, et un commentaire dans
// `NEXUS-Boite-Reception-v1.html`. Aucun n'est une clé. Une garde qui refuse
// toujours n'est pas une garde : elle est débranchée le jour où elle gêne.
//
// Les règles ci-dessous visent donc la **forme des identifiants**, ce qu'une
// prose ne peut pas produire par accident. Elles ont été calibrées sur
// l'arbre réel : zéro occurrence des formes S1/S2/S3/S4 sur `production`
// comme sur le candidat, et les trois `-----BEGIN PRIVATE KEY-----` de
// `index.ts` / `supabase/functions/*/index.ts` sont des délimiteurs de
// `.replace()`, sans corps base64 — ils ne déclenchent donc rien.
//
// Le mot nu reste compté et affiché (règle S5) ; `--refuser-mot-service-role`
// le rend bloquant pour qui veut la lettre de la consigne.

// Toutes ces règles sont appliquées au **contenu entier**, pas ligne par
// ligne. Ce n'est pas un détail de mise en œuvre : une clé privée PEM porte
// toujours son corps base64 sur la ligne SUIVANTE de son en-tête. Examinée
// ligne par ligne, la règle S4 ne pouvait structurellement jamais mordre —
// elle était verte et inutile, exactement le défaut du 08/09. C'est le cas
// de mutation `S4 · clé privée PEM avec corps base64` qui l'a révélé ; la
// lecture du code ne l'avait pas vu.
const REGLES = [
  {
    code: 'S1',
    nom: 'clé de service Supabase (`sb_secret_…`)',
    motif: /sb_secret_[A-Za-z0-9_-]{8,}/g,
  },
  {
    code: 'S3',
    nom: 'chaîne de connexion PostgreSQL avec mot de passe',
    motif: /postgres(?:ql)?:\/\/[A-Za-z0-9._%+-]+:[^@\s"']{4,}@/g,
  },
  {
    code: 'S4',
    nom: 'clé privée PEM avec corps base64',
    // Le corps est exigé : sans lui, l'en-tête n'est qu'un délimiteur de
    // découpage, usage réel et légitime dans trois fichiers de ce dépôt.
    motif: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s"'\\rn]{0,20}[A-Za-z0-9+/=]{40,}/g,
  },
  {
    code: 'S6',
    nom: 'valeur affectée à une variable de clé de service',
    motif: /(?:SERVICE_ROLE|SERVICE_KEY|SECRET_KEY)[A-Z_]*\s*[:=]\s*["'][^"'\s]{20,}["']/g,
  },
];

// Numéro de ligne d'une position dans le contenu — pour nommer l'endroit
// sans jamais recopier ce qui s'y trouve.
function ligneDe(contenu, index) {
  return contenu.slice(0, index).split('\n').length;
}

// S2 — jeton JWT. Traité à part : la forme seule ne dit rien, c'est la
// charge utile qui tranche. Un JWT `role: anon` est la clé publiable, elle a
// sa place dans l'artefact ; `role: service_role` est une clé d'écriture
// complète et ne l'a pas. Un rôle inconnu ou indécodable est refusé — on ne
// laisse pas passer ce que l'on n'a pas su lire.
const MOTIF_JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function roleDuJwt(chargeB64) {
  try {
    const json = Buffer.from(chargeB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const charge = JSON.parse(json);
    return typeof charge.role === 'string' ? charge.role : null;
  } catch { return null; }
}

const MOTIF_MOT = /service_role/g;
let fichiersScrutes = 0, fichiersBinaires = 0;
let motServiceRole = 0, fichiersMotServiceRole = 0, jwtAnon = 0, clesPubliables = 0;

for (const rel of fichiers) {
  const abs = path.join(RACINE, rel);
  if (!estTexte(abs, rel)) { fichiersBinaires++; continue; }
  fichiersScrutes++;
  const contenu = fs.readFileSync(abs, 'utf8');

  for (const regle of REGLES) {
    regle.motif.lastIndex = 0;
    let trouve;
    while ((trouve = regle.motif.exec(contenu)) !== null) {
      const ligne = ligneDe(contenu, trouve.index);
      refuser(regle.code, `${rel}:${ligne} — ${regle.nom}. (Valeur volontairement non reproduite.)`);
      if (trouve.index === regle.motif.lastIndex) regle.motif.lastIndex++;
    }
  }

  // S2 — JWT. La charge utile tranche, pas la forme.
  MOTIF_JWT.lastIndex = 0;
  let m;
  while ((m = MOTIF_JWT.exec(contenu)) !== null) {
    const ligne = ligneDe(contenu, m.index);
    const role = roleDuJwt(m[1]);
    if (role === 'anon') { jwtAnon++; continue; }
    if (role === 'service_role') {
      refuser('S2', `${rel}:${ligne} — jeton JWT de rôle \`service_role\` : clé d'écriture complète sur la base. (Valeur volontairement non reproduite.)`);
    } else {
      refuser('S2', `${rel}:${ligne} — jeton JWT de rôle ${role === null ? 'indécodable' : `« ${role} »`} : non reconnu comme publiable, donc refusé.`);
    }
  }

  if (/sb_publishable_[A-Za-z0-9_-]{8,}/.test(contenu)) clesPubliables++;

  MOTIF_MOT.lastIndex = 0;
  const occurrences = (contenu.match(MOTIF_MOT) || []).length;
  if (occurrences) { motServiceRole += occurrences; fichiersMotServiceRole++; }
}

// S5 — le mot nu. Inventaire par défaut, refus sur demande explicite.
if (motServiceRole) {
  const phrase = `${motServiceRole} occurrence(s) de la chaîne \`service_role\` dans ${fichiersMotServiceRole} fichier(s) — prose, SQL et commentaires, aucune n'est une clé (les formes de clés sont couvertes par S1, S2 et S6).`;
  if (REFUSER_MOT) refuser('S5', phrase);
  else avertir('S5 — ' + phrase);
}

// ═══════════════════════════════════════════════════════════════════════════
// RAPPORT
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Contrôle de l\'artefact GitHub Pages ─────────────────────────');
console.log(`  racine  : ${RACINE}`);
if (ARBRE_SOURCE !== RACINE) console.log(`  source  : ${ARBRE_SOURCE} (règle A1 seulement)`);
console.log(`  mode    : ${MODE}`);
console.log(`  périmètre : ${fichiers.length} fichier(s) — ${fichiersScrutes} scruté(s), ${fichiersBinaires} binaire(s) écarté(s).`);
console.log(`              ${horsPerimetre} entrée(s) hors artefact : \`node_modules\` et tout chemin caché, que upload-pages-artifact v4+ n'emballe pas.`);
console.log('');
for (const c of constats) console.log(`  · ${c}`);
console.log('');
console.log(`  clés publiables reconnues : ${clesPubliables} fichier(s) \`sb_publishable_…\`, ${jwtAnon} jeton(s) JWT de rôle « anon » — tolérés, c'est leur place.`);

if (avertissements.length) {
  console.log('\n  AVERTISSEMENTS (n\'empêchent pas la publication) :');
  for (const a of avertissements) console.log(`    ! ${a}`);
}

if (refus.length) {
  console.log('\n  REFUS — l\'artefact ne doit pas être publié :');
  for (const r of refus) console.log(`    [${r.regle}] ${r.message}`);
  console.log('\n── Artefact REFUSÉ ─────────────────────────────────────────────\n');
  process.exit(1);
}

console.log('\n── Artefact accepté ────────────────────────────────────────────\n');
