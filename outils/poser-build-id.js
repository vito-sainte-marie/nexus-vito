#!/usr/bin/env node
// Pose un identifiant de build unique sur toutes les ressources fonctionnelles.
//
// Problème résolu (02/09/2026) : les `?v=` étaient saisis à la main, fichier
// par fichier. Deux correctifs livrés le même jour sont restés invisibles en
// production parce que leur épingle portait encore la date de la veille. Pire,
// des épingles différentes ouvrent la porte au scénario dangereux — nouvel
// écran HTML + ancien moteur en cache + nouveau fichier de données — qui
// produit un fonctionnement hybride impossible à reproduire en test.
//
// Règle posée : une seule génération pour tout le déploiement. Chaque écran
// référence exactement un build, donc même servi depuis le cache il charge un
// ensemble COHÉRENT. Le mélange de générations devient structurellement
// impossible, indépendamment de la fraîcheur du HTML.
//
// Usage :
//   node outils/poser-build-id.js            pose un nouvel identifiant
//   node outils/poser-build-id.js --verifier  échoue si quelque chose diverge
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const VERIFIER = process.argv.includes('--verifier');

// Fichiers servis SANS version, volontairement : ce sont des points d'entrée
// que le navigateur doit pouvoir revalider seul, ou des ressources hors
// application.
const SANS_VERSION = new Set(['nexus-build.js']);

function horodatageUTC() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

function commitCourt() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RACINE }).toString().trim(); }
  catch (e) { return 'inconnu'; }
}

function buildIdExistant() {
  const f = path.join(RACINE, 'nexus-build.js');
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(/id:\s*'([^']+)'/);
  return m ? m[1] : null;
}

const BUILD = VERIFIER ? buildIdExistant() : horodatageUTC();
if (VERIFIER && !BUILD) { console.error('Aucun nexus-build.js — lancer d\'abord `npm run build-id`.'); process.exit(1); }

// (src|href)="chemin-local.js|css" avec ou sans ?v=… — jamais une URL externe.
const BALISE = /\b(src|href)="(?!https?:|\/\/)([A-Za-z0-9._/-]+\.(?:js|css))(\?[^"]*)?"/g;
// Injections dynamiques : document.write('<script src="x.js?v=…"') et el.src = 'x.js?v=…'
const INJECTION = /(['"])((?:[A-Za-z0-9._/-]+)\.(?:js|css))(\?v=[0-9A-Za-z_-]+)?\1/g;

const fichiers = fs.readdirSync(RACINE).filter(f => /\.(html|js)$/.test(f) && !f.startsWith('test_'));
let poses = 0, divergents = [], manquants = [];

for (const f of fichiers) {
  const chemin = path.join(RACINE, f);
  const avant = fs.readFileSync(chemin, 'utf8');
  let apres = avant;

  apres = apres.replace(BALISE, (tout, attr, cible, q) => {
    if (SANS_VERSION.has(cible)) return `${attr}="${cible}"`;
    if (!fs.existsSync(path.join(RACINE, cible))) { manquants.push(`${f} → ${cible}`); return tout; }
    const actuel = q && /\?v=([0-9A-Za-z_-]+)/.exec(q);
    if (VERIFIER && (!actuel || actuel[1] !== BUILD)) divergents.push(`${f} → ${cible} (${actuel ? actuel[1] : 'aucune version'})`);
    poses++;
    return `${attr}="${cible}?v=${BUILD}"`;
  });

  // Les injections dynamiques ne sont réécrites que si elles portaient DÉJÀ
  // une version : on ne devine jamais qu'une chaîne quelconque est une URL.
  apres = apres.replace(INJECTION, (tout, guillemet, cible, v) => {
    if (!v || SANS_VERSION.has(cible)) return tout;
    const actuel = /\?v=([0-9A-Za-z_-]+)/.exec(v);
    if (VERIFIER && actuel[1] !== BUILD) divergents.push(`${f} → ${cible} (${actuel[1]}, injection dynamique)`);
    poses++;
    return `${guillemet}${cible}?v=${BUILD}${guillemet}`;
  });

  if (!VERIFIER && apres !== avant) fs.writeFileSync(chemin, apres);
}

if (manquants.length) {
  console.error(`\n${manquants.length} référence(s) vers un fichier absent du dépôt :`);
  manquants.forEach(m => console.error('  ✘ ' + m));
}

if (VERIFIER) {
  if (divergents.length) {
    console.error(`\nBuild attendu : ${BUILD}`);
    console.error(`${divergents.length} ressource(s) hors génération :`);
    divergents.slice(0, 20).forEach(d => console.error('  ✘ ' + d));
    if (divergents.length > 20) console.error(`  … et ${divergents.length - 20} autre(s)`);
    console.error('\nLancer `npm run build-id` avant de déployer.');
    process.exit(1);
  }
  console.log(`Build ${BUILD} — ${poses} ressource(s), toutes sur la même génération.`);
  process.exit(manquants.length ? 1 : 0);
}

const commit = commitCourt();
fs.writeFileSync(path.join(RACINE, 'nexus-build.js'), `// Généré par outils/poser-build-id.js — ne pas éditer à la main.
// Identifiant unique de la génération déployée. Toutes les ressources
// fonctionnelles de ce déploiement portent ?v=<id> : un écran servi depuis le
// cache charge donc forcément un ensemble cohérent, jamais un mélange de
// générations.
(function (global) {
  'use strict';
  global.NEXUS_BUILD = { id: '${BUILD}', commit: '${commit}' };
  // Estampille discrète en pied de page, pour savoir d'un coup d'œil si le
  // téléphone, le Mac et le serveur exécutent la même version.
  function estampiller() {
    var pied = document.querySelector('footer');
    if (!pied || pied.querySelector('.nexus-build-estampille')) return;
    var s = document.createElement('span');
    s.className = 'nexus-build-estampille';
    s.style.cssText = 'display:block; margin-top:4px; font-size:10px; opacity:.55;';
    s.textContent = 'NEXUS build ${BUILD} · commit ${commit}';
    pied.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', estampiller, { once: true });
  else estampiller();
})(typeof window !== 'undefined' ? window : globalThis);
`);

console.log(`Build ${BUILD} (commit ${commit}) posé sur ${poses} ressource(s).`);
if (manquants.length) process.exit(1);
