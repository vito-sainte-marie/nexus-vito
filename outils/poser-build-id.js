#!/usr/bin/env node
// NEXUS — identité de la génération déployée (05/09/2026).
//
// CE QUE CET OUTIL GARANTIT : qu'un écran servi permette de dire, sans
// ambiguïté, quel commit l'a produit, quelle génération d'actifs il exécute,
// dans quel environnement, et à quelle heure il a été construit. Et qu'une
// version incapable de répondre à ces questions ne puisse pas être publiée.
//
// HISTOIRE. L'outil posait déjà une épingle `?v=` unique sur tous les actifs,
// pour interdire le mélange de générations — nouvel écran, ancien moteur en
// cache. Cette partie tenait. Ce qui ne tenait pas, c'était l'IDENTITÉ :
//
//   * l'identifiant était un HORODATAGE calculé au lancement, sans rapport
//     avec le contenu ni avec le commit ;
//   * l'outil se lançait À LA MAIN avant de committer, donc le commit inscrit
//     était celui d'AVANT le commit qu'il servait à produire ;
//   * `nexus-build.js` était versionné : si personne ne relançait l'outil,
//     l'identité restait figée pendant que le code avançait.
//
// Constaté en recette le 04/09/2026 : le pied de page annonçait le commit
// `b2190e5` alors que neuf commits avaient été déployés depuis. La CI passait
// au vert à chaque fois — elle vérifiait que tous les actifs portaient LE MÊME
// identifiant, jamais que cet identifiant correspondait au code servi.
//
// CE QUI CHANGE :
//
//   1. L'identifiant est une EMPREINTE DE CONTENU, déterministe : même code,
//      même identifiant, quel que soit l'hébergeur et l'heure. Un horodatage
//      changeait à chaque build même sans modification, invalidant tous les
//      caches pour rien ; une empreinte ne change que si un actif change.
//   2. Le commit vient de l'environnement de build — `CF_PAGES_COMMIT_SHA`
//      chez Cloudflare — ou de git. S'il est indéterminable, LE BUILD ÉCHOUE.
//   3. `nexus-build.js` n'est plus versionné : on ne peut plus committer une
//      identité périmée, puisqu'on ne peut plus la committer du tout.
//   4. L'écran vérifie lui-même, à l'exécution, que ses scripts portent bien
//      l'épingle de la génération annoncée.
//
// Usage :
//   node outils/poser-build-id.js             pose l'identité (appelé par build.sh)
//   node outils/poser-build-id.js --verifier   échoue si l'arbre n'est pas cohérent
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const VERIFIER = process.argv.includes('--verifier');

// Servis SANS épingle, chacun pour une raison distincte :
//   nexus-build.js  — il PORTE l'identité ; l'épingler avec elle serait
//                     circulaire, et il doit rester revalidable seul.
//   nexus-config.js — il distingue les environnements et est servi en
//                     `no-store` ; une épingle lui donnerait une durée de vie.
const SANS_EPINGLE = new Set(['nexus-build.js', 'nexus-config.js']);

function echouer(message, detail) {
  console.error('\n  ÉCHEC — identité de génération NEXUS\n');
  console.error('  ' + message);
  if (detail) console.error('\n' + detail);
  console.error('');
  process.exit(1);
}

// ── Le commit : une seule source de vérité, jamais devinée ───────────────
function commitDeploye() {
  // Cloudflare Pages expose le SHA du commit RÉELLEMENT déployé. C'est la
  // seule valeur qui ne peut pas mentir : ni l'heure du lancement, ni l'état
  // du poste de développement n'entrent en jeu.
  const cf = (process.env.CF_PAGES_COMMIT_SHA || '').trim();
  if (/^[0-9a-f]{7,40}$/.test(cf)) return cf;
  try {
    const g = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (/^[0-9a-f]{40}$/.test(g)) return g;
  } catch (e) { /* pas de git : traité ci-dessous */ }
  return null;
}

// ── L'empreinte : dérivée du contenu, donc reproductible ─────────────────
// Chaque actif épinglé contribue son nom ET son contenu. Le nom compte :
// renommer un fichier change la génération, ce qui est correct — les écrans
// ne référencent plus les mêmes ressources.
//
// LES ÉPINGLES SONT RETIRÉES AVANT DE HACHER, et c'est indispensable :
// certains actifs — nexus-auth.js le premier — injectent eux-mêmes des scripts
// épinglés. Hacher leur contenu épinglé rendrait l'empreinte dépendante d'une
// valeur qu'elle sert à produire : le calcul ne convergerait jamais, et le
// contrôle final échouerait à chaque build. On hache donc la forme CANONIQUE,
// sans épingle. Une vraie modification du fichier change toujours l'empreinte ;
// le seul fait de le réépingler, non.
function canoniser(contenu) {
  return contenu.replace(/\?v=[0-9A-Za-z_-]+/g, '');
}

function empreinte(actifs) {
  const h = crypto.createHash('sha256');
  for (const nom of [...actifs].sort()) {
    h.update(nom, 'utf8');
    h.update('\0');
    const contenu = canoniser(fs.readFileSync(path.join(RACINE, nom), 'utf8'));
    h.update(crypto.createHash('sha256').update(contenu, 'utf8').digest('hex'));
    h.update('\n');
  }
  return h.digest('hex').slice(0, 12);
}

// (src|href)="chemin-local.js|css" avec ou sans ?v=… — jamais une URL externe.
const BALISE = /\b(src|href)="(?!https?:|\/\/)([A-Za-z0-9._/-]+\.(?:js|css))(\?[^"]*)?"/g;
// Injections dynamiques : el.src = 'x.js?v=…'
const INJECTION = /(['"])((?:[A-Za-z0-9._/-]+)\.(?:js|css))(\?v=[0-9A-Za-z_-]+)?\1/g;

const fichiers = fs.readdirSync(RACINE).filter(f => /\.(html|js)$/.test(f) && !f.startsWith('test_'));

// ── 1. Recenser ce qui est référencé, avant de décider de quoi que ce soit ─
const references = new Set();
const manquants = [];
for (const f of fichiers) {
  const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
  let m;
  BALISE.lastIndex = 0;
  while ((m = BALISE.exec(src))) {
    const cible = m[2];
    if (SANS_EPINGLE.has(cible)) continue;
    if (!fs.existsSync(path.join(RACINE, cible))) { manquants.push(`${f} → ${cible}`); continue; }
    references.add(cible);
  }
  INJECTION.lastIndex = 0;
  while ((m = INJECTION.exec(src))) {
    const cible = m[2];
    if (!m[3] || SANS_EPINGLE.has(cible)) continue;
    if (!fs.existsSync(path.join(RACINE, cible))) { manquants.push(`${f} → ${cible} (injection)`); continue; }
    references.add(cible);
  }
}
if (manquants.length) {
  echouer(`${manquants.length} référence(s) vers un fichier absent du dépôt.`,
    manquants.map(m => '    ✘ ' + m).join('\n'));
}
if (!references.size) {
  echouer('Aucun actif à épingler : l’arbre ne ressemble pas à un déploiement NEXUS.');
}

const ID = empreinte(references);

// ── 2. Poser ou vérifier l'épingle sur chaque référence ──────────────────
let poses = 0;
const divergents = [];

for (const f of fichiers) {
  const chemin = path.join(RACINE, f);
  const avant = fs.readFileSync(chemin, 'utf8');
  let apres = avant;

  apres = apres.replace(BALISE, (tout, attr, cible, q) => {
    if (SANS_EPINGLE.has(cible)) return `${attr}="${cible}"`;
    if (!references.has(cible)) return tout;
    const actuel = q && /\?v=([0-9A-Za-z_-]+)/.exec(q);
    if (VERIFIER && (!actuel || actuel[1] !== ID)) {
      divergents.push(`${f} → ${cible} (${actuel ? actuel[1] : 'aucune épingle'})`);
    }
    poses++;
    return `${attr}="${cible}?v=${ID}"`;
  });

  // Les injections dynamiques ne sont réécrites que si elles portaient DÉJÀ
  // une épingle : on ne devine jamais qu'une chaîne quelconque est une URL.
  apres = apres.replace(INJECTION, (tout, guillemet, cible, v) => {
    if (!v || SANS_EPINGLE.has(cible) || !references.has(cible)) return tout;
    const actuel = /\?v=([0-9A-Za-z_-]+)/.exec(v);
    if (VERIFIER && actuel[1] !== ID) divergents.push(`${f} → ${cible} (${actuel[1]}, injection)`);
    poses++;
    return `${guillemet}${cible}?v=${ID}${guillemet}`;
  });

  if (!VERIFIER && apres !== avant) fs.writeFileSync(chemin, apres);
}

// ── 3. Vérification : l'arbre est-il un déploiement identifiable ? ───────
if (VERIFIER) {
  const f = path.join(RACINE, 'nexus-build.js');
  if (!fs.existsSync(f)) {
    echouer('`nexus-build.js` est absent : cet arbre n’a pas été construit.\n'
      + '  Lancer `outils/build.sh` — il n’est plus versionné, et c’est voulu :\n'
      + '  une identité committée peut être périmée, une identité générée non.');
  }
  const declare = (fs.readFileSync(f, 'utf8').match(/id:\s*'([^']+)'/) || [])[1];
  if (declare !== ID) {
    echouer(`\`nexus-build.js\` annonce la génération « ${declare} », le contenu servi vaut « ${ID} ».`,
      '    Un actif a changé après la construction, ou le fichier a été édité à la main.');
  }
  if (divergents.length) {
    echouer(`${divergents.length} ressource(s) hors de la génération ${ID}.`,
      divergents.slice(0, 20).map(d => '    ✘ ' + d).join('\n')
      + (divergents.length > 20 ? `\n    … et ${divergents.length - 20} autre(s)` : ''));
  }
  console.log(`Génération ${ID} — ${poses} référence(s) épinglée(s), toutes cohérentes.`);
  process.exit(0);
}

// ── 4. Chaque écran qui charge des scripts charge aussi nexus-build.js ───
{
  let ajoutes = 0;
  for (const f of fichiers.filter(x => x.endsWith('.html'))) {
    const chemin = path.join(RACINE, f);
    const s = fs.readFileSync(chemin, 'utf8');
    if (s.includes('nexus-build.js')) continue;
    const m = /<script src="(?!https?:)[A-Za-z0-9._/-]+\.js\?v=/.exec(s);
    if (!m) continue;
    fs.writeFileSync(chemin, s.slice(0, m.index) + '<script src="nexus-build.js"></script>\n' + s.slice(m.index));
    ajoutes++;
  }
  if (ajoutes) console.log(`  nexus-build.js ajouté dans ${ajoutes} écran(s).`);
}

// ── 5. Écrire l'identité — et échouer plutôt que d'en inventer une ───────
const commit = commitDeploye();
if (!commit) {
  echouer('Commit indéterminable : ni CF_PAGES_COMMIT_SHA, ni dépôt git exploitable.',
    '    Publier ici produirait une version que personne ne saurait rattacher\n'
    + '    à un état du code. C’est exactement ce qu’A6 interdit.');
}
const env = (process.env.NEXUS_ENV || '').trim() || 'inconnu';
const construitLe = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

fs.writeFileSync(path.join(RACINE, 'nexus-build.js'), `// Généré par outils/poser-build-id.js — NON VERSIONNÉ, ne pas éditer.
//
// Identité de cette génération. Quatre informations distinctes, parce que
// quatre questions distinctes se posent devant un écran qui se comporte mal :
//   commit          — quel état du code a produit ce déploiement ;
//   id              — quelle génération d'actifs l'écran exécute réellement ;
//   environnement   — à quelle base il parle ;
//   construitLe     — quand cette génération a été fabriquée.
//
// L'identifiant est une empreinte du CONTENU des actifs épinglés : même code,
// même identifiant, quel que soit l'hébergeur ou l'heure.
(function (global) {
  'use strict';

  var IDENTITE = {
    commit: '${commit}',
    commitCourt: '${commit.slice(0, 7)}',
    id: '${ID}',
    environnement: '${env}',
    construitLe: '${construitLe}',
    coherent: true,
  };

  // LA primitive d'épinglage. Tout module qui charge un script à l'exécution
  // passe par ici — il n'existe aucune autre façon de construire une épingle.
  //
  // Pourquoi cette centralisation : nexus-auth.js entretenait sa PROPRE
  // constante de génération, \`STOCK_BUILD = '20260831-1408'\`, qui gouvernait
  // dix-huit scripts. Le Cockpit chargeait donc cinq fichiers d'une génération
  // vieille de cinq jours pendant que le reste de l'écran était à jour :
  // exactement le mélange que l'épinglage sert à rendre impossible. Il a
  // survécu à tous les contrôles parce qu'aucun littéral \`….js?v=…\` n'apparaît
  // dans le fichier — l'URL était construite par interpolation.
  //
  // ÉCHEC FERMÉ, sans repli d'aucune sorte. Pas de constante de substitution,
  // pas d'horodatage, pas de valeur par défaut : une valeur de repli serait une
  // seconde génération, c'est-à-dire le défaut qu'on vient de retirer.
  function versionner(src) {
    if (!IDENTITE.id) {
      throw new Error('NEXUS ne peut pas charger « ' + src + ' » : identité de '
        + 'génération absente. Charger nexus-build.js avant tout module qui '
        + 'épingle une ressource — il n’existe aucune valeur de repli, et c’est '
        + 'voulu : une seconde génération est précisément le défaut à éviter.');
    }
    return src + '?v=' + IDENTITE.id;
  }

  // Contrôle à l'exécution : les scripts de CETTE page portent-ils bien
  // l'épingle de la génération annoncée ? Sans ce contrôle, un mélange de
  // générations — page fraîche, moteur ancien resté en cache — resterait
  // silencieux. C'est le scénario que l'épinglage sert à rendre impossible ;
  // encore faut-il le constater plutôt que l'espérer.
  function verifierCoherence() {
    var hors = [];
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      if (/^https?:|^\\/\\//.test(src)) continue;
      var nom = src.split('?')[0];
      if (nom === 'nexus-build.js' || nom === 'nexus-config.js') continue;
      var m = /[?&]v=([0-9A-Za-z_-]+)/.exec(src);
      if (!m || m[1] !== IDENTITE.id) hors.push(nom + ' → ' + (m ? m[1] : 'aucune épingle'));
    }
    if (!hors.length) return;
    IDENTITE.coherent = false;
    console.error('NEXUS — mélange de générations détecté (attendu ' + IDENTITE.id + ') : ' + hors.join(', '));
  }

  function estampiller() {
    var pied = document.querySelector('footer');
    if (!pied || pied.querySelector('.nexus-build-estampille')) return;
    var s = document.createElement('span');
    s.className = 'nexus-build-estampille';
    s.style.cssText = 'display:block; margin-top:4px; font-size:10px; opacity:.55;';
    s.textContent = 'NEXUS ' + IDENTITE.environnement + ' · commit ' + IDENTITE.commitCourt
      + ' · génération ' + IDENTITE.id + ' · construit le ' + IDENTITE.construitLe
      + (IDENTITE.coherent ? '' : ' · ⚠ GÉNÉRATIONS MÉLANGÉES');
    pied.appendChild(s);
  }

  function demarrer() { verifierCoherence(); estampiller(); }

  IDENTITE.versionner = versionner;
  global.NEXUS_BUILD = IDENTITE;
  // NexusBuild est le nom par lequel les modules appellent la primitive ;
  // NEXUS_BUILD reste le nom historique de l'identité. Même objet.
  global.NexusBuild = IDENTITE;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer, { once: true });
  else demarrer();
})(typeof window !== 'undefined' ? window : globalThis);
`);

console.log(`  Génération ${ID} — commit ${commit.slice(0, 7)} — environnement « ${env} ».`);
console.log(`  ${poses} référence(s) épinglée(s).`);
