#!/usr/bin/env node
// La recette automatisée et les parcours humains n'ont pas le droit au même compte.
//
// LE DÉFAUT, démontré le 11/09/2026. La recette navigateur CI et un parcours
// manuel ont tourné EN MÊME TEMPS sur `Employé Test A`. Résultat en base : un
// service créé à 12:22:44.023762 et clôturé à 12:22:43 — une fin antérieure à
// sa propre création, parce que deux acteurs écrivaient la même journée du
// même employé à la seconde près.
//
// Une séparation qui repose sur la discipline de celui qui lance n'est pas une
// séparation. Celle-ci refuse au démarrage, avant la moindre écriture.

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const recette = require(path.join(RACINE, 'outils/recette-navigateur-test.js'));
const SOURCE = fs.readFileSync(path.join(RACINE, 'outils/recette-navigateur-test.js'), 'utf8');

t('la recette REFUSE l\'identité réservée aux parcours humains', () => {
  const refus = recette.refusIdentitePartagee('Employé Test B');
  assert.ok(refus, 'la recette accepte le compte humain');
  assert.ok(/parcours humains/.test(refus), 'le refus ne dit pas pourquoi');
});

t('elle accepte son propre compte', () => {
  assert.strictEqual(recette.refusIdentitePartagee('Employé Test A'), null);
});

t('le refus ne se contourne ni par la casse ni par les accents', () => {
  for (const variante of ['employé test b', 'EMPLOYE TEST B', 'Employe  Test  B ']) {
    assert.ok(recette.refusIdentitePartagee(variante), `« ${variante} » passe encore`);
  }
});

t('une identité absente ne bloque pas le démarrage', () => {
  // Le secret manquant a déjà son propre refus, explicite. Cette garde-ci ne
  // doit pas le doubler d'un message qui parlerait d'autre chose.
  assert.strictEqual(recette.refusIdentitePartagee(undefined), null);
  assert.strictEqual(recette.refusIdentitePartagee(''), null);
});

t('le refus s\'applique AVANT toute connexion', () => {
  const iRefus = SOURCE.indexOf('const refus = refusIdentitePartagee(process.env.NEXUS_TEST_EMPLOYEE_A_NOM)');
  const iConnexion = SOURCE.indexOf('async function connecter(');
  assert.ok(iRefus > -1, 'le refus n\'est jamais appliqué');
  assert.ok(iRefus < iConnexion, 'le refus arrive après la première connexion');
  assert.ok(/process\.exit\(1\)/.test(SOURCE.slice(iRefus, iRefus + 400)),
    'le refus n\'arrête pas la recette');
});

t('MUTATION : sans la comparaison, le compte humain repasserait', () => {
  // Sans ce témoin, une garde qui rendrait toujours null passerait tout.
  const sansGarde = () => null;
  assert.strictEqual(sansGarde('Employé Test B'), null);
  assert.notStrictEqual(recette.refusIdentitePartagee('Employé Test B'), sansGarde('Employé Test B'),
    'la garde se comporte comme son absence');
});

t('l\'identité humaine est nommée une seule fois, et documentée', () => {
  assert.strictEqual(recette.IDENTITE_HUMAINE_RESERVEE, 'Employé Test B');
  // Hors commentaires : le commentaire a le droit de nommer ce qu'il explique,
  // le CODE n'a le droit de le connaître qu'à un seul endroit.
  const code = SOURCE.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const occurrences = (code.match(/Employé Test B/g) || []).length;
  assert.strictEqual(occurrences, 1,
    `le nom réservé apparaît ${occurrences} fois dans le code : une seule source de vérité est attendue`);
});

console.log(`\n${passes}/7 vérifications passées — la recette automatisée ne peut plus emprunter l'identité des parcours humains.`);
