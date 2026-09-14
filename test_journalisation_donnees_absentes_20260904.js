// NEXUS — A4 : une absence de données n'est pas une erreur (04/09/2026).
//
// Relevé pendant la recette navigateur : l'écran d'accueil produisait deux
// `console.error` sur une base de recette vide — « Chargement products
// (accueil) : aucune ligne exploitable » et « (marge accueil): null ». La
// cause était bénigne, mais le contrôle « aucune erreur console » de la fiche
// de recette devenait impossible à passer sur un environnement neuf, et un
// contrôle qu'on ne peut jamais passer finit par être ignoré — c'est ainsi
// qu'une vraie erreur se noie.
//
// Décision : ne pas assouplir le contrôle, corriger la journalisation. Un
// commerce dont les ventes ne sont pas encore importées est un ÉTAT MÉTIER
// NORMAL. `console.error` reste réservé aux erreurs techniques — et la
// distinction compte : les deux cas étaient confondus dans la même condition.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const SRC = fs.readFileSync(path.join(__dirname, 'nexus-app-donnees.js'), 'utf8');

verifier('l’absence de lignes produits n’est plus une erreur',
  /console\.info\('Chargement products \(accueil\)/.test(SRC) &&
  !/console\.error\('Chargement products \(accueil\)/.test(SRC));

verifier('une erreur de la base reste une erreur',
  /if \(error\) \{ console\.error\('Chargement products \(marge accueil\):', error\)/.test(SRC));

verifier('l’absence de données côté marge est journalisée en info',
  /console\.info\('Chargement products \(marge accueil\) : aucune ligne pour ce site\.'\)/.test(SRC));

verifier('les deux cas ne sont plus confondus dans la même condition',
  !/if \(error \|\| !data \|\| !data\.length\) \{ console\.error/.test(SRC));

// Le reste du fichier n'est pas concerné : on ne baisse pas le niveau de
// journalisation partout, seulement là où l'absence est un état normal.
const restants = (SRC.match(/console\.error/g) || []).length;
verifier(`les autres console.error sont conservés (${restants} restants)`, restants >= 5);

console.log(`\n${ok} vérifications passées.`);
