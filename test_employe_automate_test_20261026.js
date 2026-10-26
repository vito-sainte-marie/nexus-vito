#!/usr/bin/env node
// Decision-2, proposition A étape 1 : l'employé de recette automatisée existe
// dans un jeu versionné, idempotent, Test seul, sans secret ni compte Auth, et
// ne touche ni « Employé Test A » ni « Employé Test B ».
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}
const FICHIER = path.join(__dirname, 'outils/semer-employe-automate-test.sql');
const SQL = fs.readFileSync(FICHIER, 'utf8');
// Le code seul : les commentaires expliquent l'interdit, ils ne le violent pas.
const code = s => s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

// Chaque règle est une fonction du texte, pour que la mutation la fasse mordre.
const REGLES = {
  'idempotent (on conflict)': s => /on conflict \(id\) do update/i.test(code(s)),
  'garde Test (site de recette exigé)': s => /raise exception/i.test(code(s)) && /nexus-station-test/.test(code(s)),
  'arrêt sur erreur (ON_ERROR_STOP)': s => /\\set ON_ERROR_STOP on/.test(code(s)),
  'aucun secret': s => !/\b(pin|password|mot_de_passe|encrypted_password|token|secret|jwt)\b/i.test(code(s)),
  'aucun compte Auth': s => !/\bauth\./i.test(code(s)),
  'aucune suppression ni mise à jour des autres lignes': s => !/\b(delete|truncate|drop)\b/i.test(code(s)) && !/\bupdate\s+public/i.test(code(s)),
  'ne nomme ni Employé Test A ni B': s => !/Employé Test [AB]\b/.test(code(s)) && !/employe-test-[ab]\b/.test(code(s)),
  'site de recette seul': s => (code(s).match(/'nexus-station-test'/g) || []).length >= 2 && !/vito-sainte-marie/.test(code(s)),
};
const ligne = () => {
  const m = code(SQL).match(/values \(([^;]*?)\)\s*on conflict/is);
  assert.ok(m, 'ligne employees introuvable');
  return m[1];
};

for (const [nom, regle] of Object.entries(REGLES)) t(`règle : ${nom}`, () => assert.ok(regle(SQL), nom));

t('identifiant constant (pas de tirage) et unique des comptes existants', () => {
  assert.ok(/'00000000-0000-4000-8000-0000a070ca7e'/.test(ligne()));
  assert.ok(!/gen_random_uuid|uuid_generate|random\(/i.test(code(SQL)));
});
t('compte_test vrai : la ligne est marquée comme compte de recette', () => {
  assert.ok(/'nexus-station-test',\s*true,\s*false,\s*true/.test(ligne()));
});
t('une seule ligne insérée', () => {
  assert.strictEqual((code(SQL).match(/insert into/gi) || []).length, 1);
});

// Mutations : retirer chaque propriété doit rougir la règle correspondante.
const MUTANTS = {
  'idempotent (on conflict)': s => s.replace(/on conflict \(id\) do update/gi, 'on conflict (id) do nothing -- '),
  'garde Test (site de recette exigé)': s => s.replace(/raise exception/i, 'raise notice'),
  'arrêt sur erreur (ON_ERROR_STOP)': s => s.replace('\\set ON_ERROR_STOP on', ''),
  'aucun secret': s => s + '\nupdate public.employees set pin = \'0000\';\n',
  'aucun compte Auth': s => s + '\ninsert into auth.users (id) values (\'x\');\n',
  'aucune suppression ni mise à jour des autres lignes': s => s + '\ndelete from public.employees where nom = \'x\';\n',
  'ne nomme ni Employé Test A ni B': s => s + '\nselect 1 from public.employees where nom = \'Employé Test A\';\n',
  'site de recette seul': s => s.replace(/'nexus-station-test'/g, '\'vito-sainte-marie\''),
};
for (const [nom, mut] of Object.entries(MUTANTS)) {
  t(`mutation : sans « ${nom} » la règle rougit`, () => {
    const m = mut(SQL);
    assert.notStrictEqual(m, SQL, 'mutation sans effet');
    assert.ok(!REGLES[nom](m), 'la règle laisse passer le mutant');
  });
}
console.log(`\n${passes} épreuves réussies`);
