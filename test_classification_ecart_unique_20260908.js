// ARCH-003 — une seule échelle de gravité pour un écart de caisse.
//
// Audit Guardian Architecture du 06/09/2026, resté sur une branche isolée
// jusqu'au 08/09 : `NEXUS-Mon-Evolution-v1.html` définissait ses propres seuils
// (2 € puis 20 €) sans charger le moteur. Un écart de 3 € s'y affichait VERT,
// « conforme », alors qu'il est « à surveiller » partout ailleurs dans NEXUS.
//
// Ce n'est pas une question de couleur. C'est une anomalie masquée par un
// affichage rassurant — ce que la Bible interdit — et une seconde source de
// vérité là où la Constitution en exige une seule (article 11).
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Le moteur s'installe sur le global du navigateur ; il n'exporte pas via
// `module.exports`. On le charge comme la page le fait.
global.window = global;
require(path.join(__dirname, 'nexus-verify-moteur.js'));
const moteur = global.NexusVerifyMoteur;
assert.ok(moteur && typeof moteur.classifierEcart === 'function',
  'le moteur doit exposer classifierEcart');
const ECRAN = path.join(__dirname, 'NEXUS-Mon-Evolution-v1.html');
const src = fs.readFileSync(ECRAN, 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('le moteur connaît QUATRE paliers, pas trois', () => {
  // Le palier manquant côté écran était « surveiller » : c'est lui qui
  // disparaissait, et avec lui tout écart entre 2 et 5 euros.
  assert.strictEqual(moteur.classifierEcart(1), 'conforme');
  assert.strictEqual(moteur.classifierEcart(3), 'surveiller');
  assert.strictEqual(moteur.classifierEcart(5), 'surveiller');
  assert.strictEqual(moteur.classifierEcart(12), 'anomalie');
  assert.strictEqual(moteur.classifierEcart(25), 'critique');
});

t('l’écran CHARGE le moteur au lieu de refaire ses seuils', () => {
  assert.ok(/<script src="nexus-verify-moteur\.js"><\/script>/.test(src),
    'sans le moteur, l’écran ne peut que redevenir une seconde source');
  assert.ok(/window\.NexusVerifyMoteur\.classifierEcart\(/.test(src),
    'la gravité doit être DEMANDÉE au moteur');
});

t('aucun seuil d’écart n’est réécrit dans l’écran', () => {
  // On cherche les seuils eux-mêmes, pas le nom de la fonction : c'est leur
  // duplication qui fait diverger, et elle peut revenir sous un autre nom.
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');
  assert.ok(!/montantAbs\s*<=\s*20/.test(code), 'seuil 20 € redéfini dans l’écran');
  assert.ok(!/montantAbs\s*<=\s*2\b/.test(code), 'seuil 2 € redéfini dans l’écran');
});

t('un écart de 3 € n’est PLUS peint en vert', () => {
  // Le défaut exact, rejoué. On extrait la table de correspondance de l'écran
  // et on la compose avec le moteur : c'est la chaîne complète qui est jugée.
  const bloc = src.slice(src.indexOf('const COULEUR_STATUT'), src.indexOf('function classifierEcart'));
  const couleurs = {};
  for (const m of bloc.matchAll(/(\w+):\s*'([^']+)'/g)) couleurs[m[1]] = m[2];
  assert.deepStrictEqual(Object.keys(couleurs).sort(),
    ['anomalie', 'conforme', 'critique', 'surveiller'],
    'les quatre statuts du moteur doivent tous avoir une couleur');

  const peindre = (montant) => couleurs[moteur.classifierEcart(montant)];
  assert.strictEqual(peindre(1), 'var(--green)');
  assert.notStrictEqual(peindre(3), 'var(--green)', 'un écart de 3 € ne doit plus paraître conforme');
  assert.strictEqual(peindre(3), 'var(--amber)');
  assert.strictEqual(peindre(25), 'var(--rouge)');
});

t('sans le moteur, l’écran ne DEVINE pas une couleur', () => {
  // Se rabattre sur du vert reproduirait le défaut au premier échec de
  // chargement, et personne ne verrait la différence.
  const bloc = src.slice(src.indexOf('function classifierEcart'));
  assert.ok(/if \(!window\.NexusVerifyMoteur\) return 'var\(--text-dim\)';/.test(bloc),
    'l’absence de moteur doit donner une couleur neutre, jamais un verdict');
});

console.log(`\n${n}/${n} vérifications passées — une gravité d’écart, un seul propriétaire.`);
