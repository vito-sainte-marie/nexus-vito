// Garde-fou : tout type_item produit par le moteur doit être acceptable par
// la contrainte de nexus_paye_items.
//
// Le 03/09/2026, le regroupement des événements RH a introduit
// `absence_a_qualifier` et `absence_qualifiee` sans étendre la contrainte SQL.
// Résultat : cliquer « Confirmer la période » échouait à l'écriture, et comme
// enregistrerDecision() ne remontait pas l'erreur, le bouton paraissait
// simplement inerte. Un bouton muet coûte plus cher qu'un message d'erreur.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Source de vérité : la migration la plus récente portant la contrainte.
const migrations = fs.readdirSync(path.join(__dirname, 'supabase', 'migrations'))
  .filter(f => /nexus_paye_items_type|creer_nexus_paye_v1/.test(f)).sort();
const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', migrations[migrations.length - 1]), 'utf8');
const bloc = sql.slice(sql.lastIndexOf('type_item = any'));
const autorises = new Set([...bloc.matchAll(/'([a-z_]+)'/g)].map(m => m[1]));

// Types que le moteur peut produire, lus dans le source plutôt que recopiés.
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8');
const produits = new Set([...moteur.matchAll(/typeItem:\s*'([a-z_]+)'/g)].map(m => m[1]));
[...moteur.matchAll(/typeItem:[^,\n]*\?\s*'([a-z_]+)'\s*\n?\s*:\s*\(?[^']*'([a-z_]+)'\s*:\s*'([a-z_]+)'/g)]
  .forEach(m => { produits.add(m[1]); produits.add(m[2]); produits.add(m[3]); });
[...moteur.matchAll(/'(absence_a_qualifier|absence_qualifiee|conge_paye|ecart_caisse|retard_incoherent|retard|presence_exceptionnelle|heure_supplementaire|jour_ferie|absence_a_verifier)'/g)]
  .forEach(m => produits.add(m[1]));

const manquants = [...produits].filter(t => !autorises.has(t)).sort();
console.log(`types autorisés en base : ${autorises.size}`);
console.log(`types produits par le moteur : ${produits.size}`);
if (manquants.length) console.log('  manquants :', manquants.join(', '));
assert.deepStrictEqual(manquants, [],
  'un type_item produit par le moteur n’est pas persistable : la décision manager échouerait en silence');
console.log('OK — tout type produit par le moteur est persistable.');
