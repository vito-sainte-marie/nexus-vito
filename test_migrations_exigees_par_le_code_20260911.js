#!/usr/bin/env node
// Une colonne que le code EXIGE doit voyager avec sa migration.
//
// LE DÉFAUT QUE CETTE GARDE INTERDIT. Le 11/09/2026, le code de pointage a
// commencé à écrire `service_id` et `client_event_id`, et la base à les
// refuser s'ils manquent. Les sept migrations qui créent ces colonnes étaient
// classées EXCLUES de la release qui déploie ce code : partir ainsi aurait
// rendu TOUT pointage impossible dès la première minute en Production.
//
// Le manifeste et le code vieillissaient chacun de leur côté. Cette garde les
// rattache : si le code écrit une colonne, la migration qui la crée doit être
// citée INCLUSE au manifeste de promotion.

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
const LOT = path.join(RACINE, 'docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908');
const MANIFESTE = fs.readFileSync(path.join(LOT, 'manifeste-migrations-production-1.md'), 'utf8');
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');
const VERSION_PRODUCTION = '20260904175722';

/** Colonnes que le code applicatif écrit réellement dans une table donnée. */
function colonnesEcritesParLeCode(table) {
  const ecrans = fs.readdirSync(RACINE).filter(f => /\.html$/.test(f) && !f.startsWith('test_'));
  const trouvees = new Set();
  for (const f of ecrans) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    if (!src.includes(`from('${table}')`)) continue;
    // Les champs d'un objet inséré : `nom_colonne: …` en début de ligne.
    for (const m of src.matchAll(/^\s{4,}([a-z_]+):\s/gm)) trouvees.add(m[1]);
  }
  return trouvees;
}

/** Migrations de la promotion qui créent une colonne donnée. */
function migrationsQuiCreent(table, colonne) {
  return fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql') && f.split('_')[0] > VERSION_PRODUCTION)
    .filter(f => {
      const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8').toLowerCase();
      return new RegExp(`alter table (public\\.)?${table}[\\s\\S]{0,200}add column[\\s\\S]{0,80}\\b${colonne}\\b`)
        .test(sql);
    });
}

/** Vrai si le manifeste cite ce fichier dans une section INCLUSES. */
function citeeCommeIncluse(fichier) {
  const sections = MANIFESTE.split(/^## /m);
  return sections.some(s => /^INCLUSES/i.test(s) && s.includes(fichier));
}

const COLONNES_EXIGEES = ['service_id', 'client_event_id'];

t('le code écrit bien les colonnes que cette garde surveille', () => {
  // Sans ce contrôle, la garde deviendrait muette le jour où le code cesserait
  // d'écrire ces colonnes — et personne ne saurait qu'elle ne juge plus rien.
  const ecrites = colonnesEcritesParLeCode('pointages');
  for (const c of COLONNES_EXIGEES) {
    assert.ok(ecrites.has(c), `le code n'écrit plus ${c} : cette garde ne surveille plus rien`);
  }
});

t('chaque colonne exigée a sa migration, et elle est INCLUSE', () => {
  for (const colonne of COLONNES_EXIGEES) {
    const migrations = migrationsQuiCreent('pointages', colonne);
    assert.ok(migrations.length >= 1,
      `aucune migration de la promotion ne crée pointages.${colonne}`);
    for (const m of migrations) {
      assert.ok(citeeCommeIncluse(m),
        `${m} crée ${colonne}, que le code exige, mais n'est pas citée INCLUSE au manifeste. ` +
        'Déployer ce code sans elle rendrait tout pointage impossible.');
    }
  }
});

t('les sept migrations du lot correctif sont toutes INCLUSES', () => {
  const sept = fs.readdirSync(MIGRATIONS).filter(f => /^20260911/.test(f));
  assert.strictEqual(sept.length, 7, `${sept.length} migrations du 11/09 trouvées, 7 attendues`);
  const exclues = sept.filter(m => !citeeCommeIncluse(m));
  assert.deepStrictEqual(exclues, [], `non citées INCLUSES : ${exclues.join(', ')}`);
});

t('leur ordre et leurs dépendances sont écrits, pas supposés', () => {
  // Le manifeste porte PLUSIEURS sections INCLUSES : celle de la release
  // d'origine et celle du lot correctif. On juge celle qui cite les sept.
  const sections = MANIFESTE.split(/^## /m).filter(s => /^INCLUSES/i.test(s));
  const section = sections.find(s => /20260911180000/.test(s)) || '';
  assert.ok(section, 'aucune section INCLUSES ne cite les migrations du 11/09');
  assert.ok(/dépend de/i.test(section), 'aucune dépendance déclarée');
  // L'ordre du tableau doit suivre l'ordre des noms de fichiers, qui est
  // l'ordre d'application réel.
  const cites = [...section.matchAll(/`(20260911\d+_[a-z_]+\.sql)`/g)].map(m => m[1]);
  assert.deepStrictEqual(cites, [...cites].sort(),
    `l'ordre du manifeste ne suit pas l'ordre d'application : ${cites.join(' → ')}`);
});

t('MUTATION : une migration déclassée est bien détectée', () => {
  // Sans ce témoin, une garde qui rendrait toujours vrai passerait.
  const faux = MANIFESTE.replace('20260911180000_pointages_service_id.sql', 'autre-chose.sql');
  const sections = faux.split(/^## /m);
  const trouvee = sections.some(s => /^INCLUSES/i.test(s) && s.includes('20260911180000_pointages_service_id.sql'));
  assert.strictEqual(trouvee, false, 'la mutation ne change rien : le témoin ne prouve rien');
});

console.log(`\n${passes}/5 vérifications passées — une colonne que le code exige ne peut plus partir sans sa migration.`);
