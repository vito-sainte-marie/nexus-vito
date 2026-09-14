// Épreuve de cohérence de la navigation (NEXUS-App-v1.html).
//
// NEXUS-App déclare chaque écran DEUX FOIS : un bloc `<a class="nav-item">`
// pour le menu, et une entrée du catalogue JS pour la recherche. Rien ne les
// tenait en phase.
//
// Le 08/09/2026, NEXUS Live existait depuis un jour sans figurer dans aucune
// des deux : il n'était atteignable qu'en tapant son URL. Frédéric l'a
// constaté lui-même — « c'est normal que je ne vois pas nexus live ? ». Un
// écran qu'on ne peut pas atteindre n'existe pas pour celui à qui il est
// destiné.
//
// L'incohérence inverse est plus sournoise : un écran présent au menu mais
// absent du catalogue reste introuvable à la recherche, et personne ne s'en
// aperçoit — la recherche ne renvoie rien, ce qui ressemble à « ça n'existe
// pas » plutôt qu'à un défaut.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const APP = path.join(__dirname, 'NEXUS-App-v1.html');
const source = fs.readFileSync(APP, 'utf8');

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Menu : <a class="nav-item" data-role="X" href="Y.html">
function entreesMenu() {
  const m = new Map();
  const re = /<a\s+class="nav-item"\s+data-role="([a-z]+)"\s+href="([^"]+\.html)"/g;
  let x;
  while ((x = re.exec(source)) !== null) m.set(x[2], x[1]);
  return m;
}

// Catalogue : { label: '…', …, href: 'Y.html', role: 'X' }
function entreesCatalogue() {
  const m = new Map();
  const re = /\{\s*label:[^}]*?href:\s*'([^']+\.html)'[^}]*?role:\s*'([a-z]+)'[^}]*?\}/g;
  let x;
  while ((x = re.exec(source)) !== null) m.set(x[1], x[2]);
  return m;
}

t('le menu et le catalogue déclarent les mêmes écrans Créateur', () => {
  const menu = entreesMenu();
  const cat = entreesCatalogue();
  assert.ok(menu.size > 0 && cat.size > 0, 'les deux déclarations doivent être lisibles');

  const menuCreateur = [...menu].filter(([, r]) => r === 'createur').map(([h]) => h).sort();
  const catCreateur = [...cat].filter(([, r]) => r === 'createur').map(([h]) => h).sort();
  assert.deepStrictEqual(menuCreateur, catCreateur,
    'un écran présent dans une seule des deux déclarations est soit invisible au menu, '
    + 'soit introuvable à la recherche :\n  menu      : ' + menuCreateur.join(', ')
    + '\n  catalogue : ' + catCreateur.join(', '));
});

// Divergences VOULUES entre le menu et le catalogue. Chacune est nommée, avec
// son motif — sur le modèle des dérogations du Handoff. Une divergence non
// inscrite ici fait échouer l'épreuve : c'est la différence entre un choix et
// un oubli, et seule la déclaration permet de les distinguer.
const DIVERGENCES_DECLAREES = {
  'NEXUS-Carburant-Reception-v1.html':
    'Motif inscrit dans NEXUS-App-v1.html (audit « Réceptions, deltas et effet économique du stock », '
    + '14/08/2026) : c’est un outil du quotidien pour l’employé qui réceptionne une livraison, pas '
    + 'seulement pour le manager. Rangé chez le manager au menu, offert à tous à la recherche.',
  'NEXUS-Inventaire-v1.html':
    'Motif inscrit dans NEXUS-App-v1.html (02/08/2026, demande de Frédéric) : visible par recherche '
    + 'pour l’employé, en plus de la mini carte d’accueil.',
  'NEXUS-Documentation-v1.html':
    'Motif inscrit dans NEXUS-App-v1.html au-dessus de l’entrée du catalogue : « Comprendre NEXUS » '
    + 'concerne directement les employés, pas seulement les managers — contrairement au reste du tiroir '
    + '« Explorer NEXUS ». Le menu la range donc chez le manager, la recherche l’offre à tous.',
};

t('les divergences déclarées le sont RÉELLEMENT dans le code', () => {
  // Une dérogation qui ne vit que dans son test est une excuse, pas une
  // décision. Le motif doit être lisible là où quelqu'un modifiera le code.
  for (const href of Object.keys(DIVERGENCES_DECLAREES)) {
    // Viser l'entrée du CATALOGUE, pas la première occurrence du fichier : le
    // même href apparaît plus haut dans les tuiles d'accueil, et chercher
    // avant celle-là examinait un tout autre endroit du code.
    const re = new RegExp(`\\{\\s*label:[^}]*?href:\\s*'${href.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}'[^}]*?role:`);
    const m = re.exec(source);
    assert.ok(m, `${href} : entrée de catalogue introuvable`);
    const avant = source.slice(Math.max(0, m.index - 600), m.index);
    assert.ok(/\/\/[^\n]*(employé|employe)/i.test(avant),
      `${href} : la divergence doit être motivée dans NEXUS-App-v1.html, pas seulement ici`);
  }
});

t('un écran déclaré au menu porte le MÊME rôle dans le catalogue', () => {
  // Un écran Créateur listé « manager » dans le catalogue apparaîtrait dans la
  // recherche d'un manager. Le masquage n'est pas la protection — la RLS
  // l'est — mais proposer une porte qui se referme au nez est une mauvaise
  // expérience, et un signal trompeur sur ce que la personne peut faire.
  const menu = entreesMenu();
  const cat = entreesCatalogue();
  const desaccords = [];
  for (const [href, role] of menu) {
    if (cat.has(href) && cat.get(href) !== role && !DIVERGENCES_DECLAREES[href]) {
      desaccords.push(`${href} : menu=${role} catalogue=${cat.get(href)}`);
    }
  }
  assert.deepStrictEqual(desaccords, [], desaccords.join(' | '));
});

t('NEXUS Live est atteignable par le Créateur', () => {
  // Le cas qui a motivé cette épreuve.
  const menu = entreesMenu();
  const cat = entreesCatalogue();
  assert.strictEqual(menu.get('NEXUS-Live-Developpement-v1.html'), 'createur',
    'NEXUS Live doit figurer au menu Créateur');
  assert.strictEqual(cat.get('NEXUS-Live-Developpement-v1.html'), 'createur',
    'NEXUS Live doit figurer au catalogue de recherche');
});

t('le fichier visé par chaque entrée existe réellement', () => {
  // Une entrée de menu vers un fichier absent rend une 404 — une porte peinte
  // sur un mur.
  const manquants = [];
  for (const href of new Set([...entreesMenu().keys(), ...entreesCatalogue().keys()])) {
    if (!fs.existsSync(path.join(__dirname, href))) manquants.push(href);
  }
  assert.deepStrictEqual(manquants, [], 'écrans déclarés mais absents du dépôt : ' + manquants.join(', '));
});

console.log(`\n${passes}/${passes} vérifications passées — ce qui est déclaré au menu est trouvable, et existe.`);
