// Test — Repli des icônes cassées du menu bureau (nexus-desktop.js)
// (24/08/2026, v2.236, retour direct de Frédéric sur une capture d'écran :
// "les icones ont disparus à gauche de l'ecran" — constat en creusant :
// 15 icônes référencées par NEXUS_SIDEBAR_GROUPES n'existent tout
// simplement pas dans assets/icons/ (icon-home.png, icon-journal-nexus.png,
// icon-capital.png, icon-scanner.png, icon-radar.png, icon-produits.png,
// icon-scanner-stock.png, icon-nexus-verify.png, icon-missions.png,
// icon-assignations.png, icon-planner.png, icon-evaluation.png,
// icon-resultats-equipe.png, icon-import.png, icon-rappels.png) —
// vérifié avec `Read` (force le téléchargement iCloud) qui répond
// "File does not exist" pour icon-journal-nexus.png. Gap préexistant du
// pack d'icônes, pas causé par le renommage v2.235 : ce lot ne fabrique
// PAS une icône de remplacement dans le pack visuel NEXUS (Article 5),
// il se contente d'empêcher le glyphe "image cassée" du navigateur en
// repliant sur une puce neutre "•" quand une icône ne charge pas.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, 'nexus-desktop.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Les 15 icônes constatées manquantes sont bien référencées par
//    NEXUS_SIDEBAR_GROUPES (sinon ce test serait creux) — et TOUJOURS
//    référencées par leur chemin normal (on ne les a pas retirées du
//    menu : le repli visuel, pas une suppression de fonctionnalité).
// ------------------------------------------------------------
{
  const sandbox = { document: { addEventListener: () => {} }, localStorage: { getItem: () => null, setItem: () => {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__groups = NEXUS_SIDEBAR_GROUPES;', sandbox);
  const flat = sandbox.__groups.flatMap(g => g.items);
  const iconesConstatteesManquantes = [
    'assets/icons/icon-home.png', 'assets/icons/icon-journal-nexus.png', 'assets/icons/icon-capital.png',
    'assets/icons/icon-scanner.png', 'assets/icons/icon-radar.png', 'assets/icons/icon-produits.png',
    'assets/icons/icon-scanner-stock.png', 'assets/icons/icon-nexus-verify.png', 'assets/icons/icon-missions.png',
    'assets/icons/icon-assignations.png', 'assets/icons/icon-planner.png', 'assets/icons/icon-evaluation.png',
    'assets/icons/icon-resultats-equipe.png', 'assets/icons/icon-import.png', 'assets/icons/icon-rappels.png',
  ];
  iconesConstatteesManquantes.forEach(chemin => {
    assert.ok(flat.some(i => i.icon === chemin), `${chemin} devrait toujours être référencée par un item du menu (repli visuel seulement, pas une suppression)`);
  });
  ok('les 15 icônes manquantes restent référencées normalement — le correctif ne supprime aucune fonctionnalité, juste l\'affichage cassé');
}

// ------------------------------------------------------------
// 2) nexusInstallerReplisIconesSidebar existe, cible bien
//    ".nexus-sidebar-link img", et remplace l'image par une puce neutre
//    au premier événement 'error' — jamais un texte fabriqué, jamais un
//    deuxième essai de chargement en boucle ({ once: true }).
// ------------------------------------------------------------
{
  const listeners = {};
  function creerFauxImg() {
    return {
      addEventListener(type, cb, opts) { listeners[type] = { cb, opts }; },
      replaceWith(node) { this.__remplacePar = node; },
    };
  }
  const fauxImg = creerFauxImg();
  const sandbox = {
    document: {
      addEventListener: () => {},
      querySelectorAll: (sel) => (sel === '.nexus-sidebar-link img' ? [fauxImg] : []),
      createElement: () => ({ style: {}, textContent: '' }),
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__run = () => nexusInstallerReplisIconesSidebar();', sandbox);
  sandbox.__run();

  assert.ok(listeners.error, 'un écouteur "error" doit être posé sur chaque <img> du menu');
  assert.strictEqual(listeners.error.opts.once, true, 'l\'écouteur doit être { once: true } — jamais reposé en boucle si la puce elle-même déclenchait un event (elle ne le peut pas, mais la discipline reste la bonne)');
  assert.strictEqual(fauxImg.__remplacePar, undefined, 'rien ne doit être remplacé avant que l\'image échoue réellement');

  // Simule l'échec de chargement réel de l'image (déclenche le callback
  // posé par addEventListener('error', ...)).
  listeners.error.cb();
  assert.ok(fauxImg.__remplacePar, 'l\'image cassée doit être remplacée dès l\'événement error');
  assert.strictEqual(fauxImg.__remplacePar.textContent, '•', 'le repli est une puce neutre "•", jamais un texte ou une icône fabriquée');
  ok('nexusInstallerReplisIconesSidebar — remplace une image cassée par une puce neutre au premier échec, sans fabriquer d\'icône');
}

// ------------------------------------------------------------
// 3) Ne plante jamais si le menu ne contient aucune <img> (garde-fou,
//    même discipline que nexusInstallerTooltipsSidebar).
// ------------------------------------------------------------
{
  const sandbox = {
    document: { addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({ style: {}, textContent: '' }) },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__run = () => nexusInstallerReplisIconesSidebar();', sandbox);
  assert.doesNotThrow(() => sandbox.__run());
  ok('nexusInstallerReplisIconesSidebar — ne plante jamais quand le menu ne contient aucune image');
}

// ------------------------------------------------------------
// 4) nexusInitVueBureau appelle bien le nouvel installateur (branché,
//    pas seulement défini) — vérifié par recherche textuelle dans le
//    fichier réel plutôt qu'en rejouant tout nexusInitVueBureau (qui
//    dépend de tout le DOM), pour rester un test ciblé et rapide.
// ------------------------------------------------------------
{
  assert.ok(/nexusInstallerReplisIconesSidebar\(\);/.test(code), 'nexusInstallerReplisIconesSidebar() doit être appelée dans nexusInitVueBureau');
  const posAppel = code.indexOf('nexusInstallerReplisIconesSidebar();');
  const posInit = code.indexOf('function nexusInitVueBureau');
  assert.ok(posAppel > posInit, 'l\'appel doit se trouver après la définition de nexusInitVueBureau (donc dedans, pas ailleurs par coïncidence textuelle)');
  ok('nexusInstallerReplisIconesSidebar() est bien branchée dans nexusInitVueBureau (vue bureau uniquement)');
}

console.log(`\n${n}/${n} tests passés — Repli icônes cassées du menu bureau (v2.236).`);
