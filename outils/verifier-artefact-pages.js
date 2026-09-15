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
//   node outils/verifier-artefact-pages.js --mode=construit
//   node outils/verifier-artefact-pages.js --mode=a-l-identique
//   node outils/verifier-artefact-pages.js --mode=… --racine=/chemin/arbre
//
// Options :
//   --mode=construit       l'arbre sort de `bash outils/build.sh`
//   --mode=a-l-identique   l'arbre est publié tel quel (état actuel de
//                          `production`, qui ne possède pas de `build.sh`)
//   --racine=<dir>         arbre à contrôler (défaut : la racine du dépôt)
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
const RACINE = path.resolve(option('racine') || path.join(__dirname, '..'));
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

// ── Périmètre exact de l'artefact ──────────────────────────────────────────
// `actions/upload-pages-artifact` archive le chemin fourni en excluant
// `.git` et `.github`. Le périmètre contrôlé ici est donc EXACTEMENT ce qui
// sera publié : contrôler plus large donnerait de faux refus, contrôler plus
// étroit laisserait passer un fichier réellement servi.
const EXCLUS = new Set(['.git', '.github', 'node_modules']);

// Extensions binaires : illisibles en texte, et aucune clé ne s'y cache sous
// une forme que ces règles sauraient reconnaître. Elles sont écartées
// explicitement plutôt que silencieusement.
const BINAIRES = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz', '.pdf',
  '.zip', '.gz', '.tgz', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.mp3', '.wav', '.mov', '.heic',
]);

function parcourir(dir, relatif = '') {
  const sortie = [];
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    if (relatif === '' && EXCLUS.has(entree.name)) continue;
    if (entree.name === 'node_modules') continue;
    const abs = path.join(dir, entree.name);
    const rel = relatif ? `${relatif}/${entree.name}` : entree.name;
    if (entree.isSymbolicLink()) { avertir(`Lien symbolique ignoré : ${rel}`); continue; }
    if (entree.isDirectory()) sortie.push(...parcourir(abs, rel));
    else if (entree.isFile()) sortie.push(rel);
  }
  return sortie;
}

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
const A_BUILD = fs.existsSync(path.join(RACINE, 'outils', 'build.sh'));
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
console.log(`  mode    : ${MODE}`);
console.log(`  périmètre : ${fichiers.length} fichier(s) — ${fichiersScrutes} scruté(s), ${fichiersBinaires} binaire(s) écarté(s).`);
console.log(`              (\`.git\`, \`.github\` et \`node_modules\` sont hors artefact, comme chez upload-pages-artifact.)`);
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
