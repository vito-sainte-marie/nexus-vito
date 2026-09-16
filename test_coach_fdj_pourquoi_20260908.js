// Épreuves des justifications du Coach FDJ (nexus-coach-fdj-moteur.js).
//
// COACH-001. Les textes « pourquoi » chiffraient `mesure || 0`. Un employé
// dont le taux n'avait PAS été mesuré lisait :
//
//   « Vos contrôles sont conformes sur 0 % de vos 8 derniers quarts mesurés. »
//
// Un reproche fabriqué à partir d'une absence de donnée, adressé à une
// personne, sur l'écran de son propre accompagnement. C'est le contraire de
// la Bible : « L'employé doit recevoir un accompagnement utile, positif,
// concret et NON PUNITIF. »
//
// Troisième occurrence du même défaut en une journée (EVAL-001, DEBUG-001,
// COACH-001) : un seul bug recopié. D'où un propriétaire logique unique,
// `nexus-mesure.js`, et un contrat qui l'impose ici aussi.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'nexus-coach-fdj-moteur.js');
require(OUTIL);
const C = globalThis.NexusCoachFdj;
const F = C.FORMULATIONS;

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

t('un taux NON mesuré ne produit aucun pourcentage', () => {
  for (const ev of [{ nbQuarts: 8 }, { taux: null, nbQuarts: 8 }, { taux: undefined, nbQuarts: 8 },
    { taux: '', nbQuarts: 8 }, { taux: 'n/a', nbQuarts: 8 }]) {
    const texte = F.fdj_regularite_levier.pourquoi(0, ev);
    assert.ok(!/\d+\s*%/.test(texte), 'aucun pourcentage ne doit apparaître : ' + texte);
    assert.ok(/pas encore été mesuré/.test(texte), texte);
  }
});

t('un taux RÉELLEMENT mesuré est dit, y compris s’il vaut zéro', () => {
  // La moitié qui donne son sens à la précédente : un zéro mesuré est un
  // fait, et le taire priverait l'employé et son manager d'une information
  // vraie. On ne cesse pas de mesurer, on cesse d'inventer.
  assert.strictEqual(F.fdj_regularite_levier.pourquoi(0, { taux: 0.92, nbQuarts: 8 }),
    'Vos contrôles sont conformes sur 92 % de vos 8 derniers quarts mesurés.');
  assert.strictEqual(F.fdj_regularite_levier.pourquoi(0, { taux: 0, nbQuarts: 8 }),
    'Vos contrôles sont conformes sur 0 % de vos 8 derniers quarts mesurés.');
});

t('une part de palier non comparable ne chiffre RIEN', () => {
  // Ici deux mesures sont nécessaires : la part de l'employé ET celle du
  // site. Il suffit que l'une manque pour que la comparaison n'ait pas de
  // sens — en chiffrer une seule laisserait croire à un écart mesuré.
  for (const ev of [{ prix: 5 }, { prix: 5, partEmploye: 0.08 }, { prix: 5, partSite: 0.21 },
    { prix: 5, partEmploye: 0.08, partSite: null }]) {
    const texte = F.fdj_palier_sous_represente.pourquoi(0, ev);
    assert.ok(!/\d+\s*%/.test(texte), 'aucun pourcentage : ' + texte);
    assert.ok(/pas encore été mesurée/.test(texte), texte);
  }
});

t('deux parts mesurées sont comparées normalement', () => {
  assert.strictEqual(F.fdj_palier_sous_represente.pourquoi(0, { prix: 5, partEmploye: 0.08, partSite: 0.21 }),
    'Le palier 5 € représente 8 % de vos ventes, contre 21 % pour le site.');
  // Zéro mesuré des deux côtés : dit, pas caché.
  assert.strictEqual(F.fdj_palier_sous_represente.pourquoi(0, { prix: 5, partEmploye: 0, partSite: 0 }),
    'Le palier 5 € représente 0 % de vos ventes, contre 0 % pour le site.');
});

t('le convertisseur rend null plutôt qu’un zéro inventé', () => {
  assert.strictEqual(C.pourcentageMesure(null), null);
  assert.strictEqual(C.pourcentageMesure([]), null, '`Number([])` vaut 0 : la porte dérobée reste fermée');
  assert.strictEqual(C.pourcentageMesure(0), 0);
  assert.strictEqual(C.pourcentageMesure(0.925), 93);
});

t('CONTRAT — le moteur Coach ne redéfinit pas la notion d’absence', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(/NexusMesure|nexus-mesure\.js/.test(src), 'il doit consommer nexus-mesure.js');
  assert.ok(!/function estAbsente?\s*\(/.test(src), 'et ne pas en garder une copie');
  // Les textes adressés à une personne ne doivent plus chiffrer un `|| 0`.
  const code = src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const motif of [/ev\.taux\s*\|\|\s*0/, /ev\.partEmploye\s*\|\|\s*0/, /ev\.partSite\s*\|\|\s*0/]) {
    assert.ok(!motif.test(code), 'le `|| 0` fautif ne doit plus exister : ' + motif);
  }
});

// ─── LE CHEMIN NAVIGATEUR ─────────────────────────────────────────────
// Les six épreuves ci-dessus étaient VERTES pendant que les trois écrans qui
// chargent ce moteur étaient EN PANNE. Elles chargent le module par `require`,
// donc la branche `require('./nexus-mesure.js')` ; un navigateur prend l'autre
// branche, `global.NexusMesure`, et aucun des trois écrans ne chargeait
// `nexus-mesure.js`. Résultat réel au premier « pourquoi » affiché :
//
//   TypeError: Cannot read properties of undefined (reading 'valeurMesuree')
//
// Une garde qui ne s'exécute que sur le chemin favorable ne garde rien. Les
// deux épreuves suivantes prennent l'autre chemin — la première en exécutant
// vraiment le module sans `require`, la seconde en lisant les écrans.

t('NAVIGATEUR — le module fonctionne sans `require`, comme dans un écran', () => {
  const vm = require('vm');
  // Ni `require`, ni `module` : exactement ce que voit une page servie.
  const bac = { console };
  bac.window = bac; bac.globalThis = bac;
  vm.createContext(bac);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-mesure.js'), 'utf8'), bac);
  vm.runInContext(fs.readFileSync(OUTIL, 'utf8'), bac);
  assert.strictEqual(bac.NexusCoachFdj.pourcentageMesure(0.83), 83);
  assert.strictEqual(bac.NexusCoachFdj.pourcentageMesure(null), null);
  assert.strictEqual(bac.NexusCoachFdj.FORMULATIONS.fdj_regularite_levier.pourquoi(0, { nbQuarts: 8 }),
    'Votre taux de conformité n’a pas encore été mesuré sur assez de quarts.');
});

t('CONTRAT — tout écran qui charge le moteur charge d’abord `nexus-mesure.js`', () => {
  const ecrans = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => fs.readFileSync(path.join(__dirname, f), 'utf8').includes('nexus-coach-fdj-moteur.js'));
  assert.ok(ecrans.length >= 3, 'les écrans du Coach FDJ doivent être trouvés : ' + ecrans.join(', '));
  for (const f of ecrans) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const iMesure = src.indexOf('nexus-mesure.js');
    const iMoteur = src.indexOf('nexus-coach-fdj-moteur.js');
    assert.notStrictEqual(iMesure, -1, f + ' charge le moteur mais pas `nexus-mesure.js`');
    assert.ok(iMesure < iMoteur, f + ' charge `nexus-mesure.js` APRÈS le moteur');
  }
});

console.log(`\n${passes}/${passes} vérifications passées — aucun reproche ne se fabrique à partir d’un trou de donnée.`);
