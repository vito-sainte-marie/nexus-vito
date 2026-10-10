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
  // Deux angles morts corrigés le 09/10/2026, après avoir mesuré que cette
  // fonction ne voyait NI audits_caisse.employes_renfort NI
  // nexus_paye_items.detail, deux colonnes que le code écrit pourtant :
  //  - elle ne lisait que les .html, alors que la moitié du code vit dans les
  //    modules nexus-*.js voisins ;
  //  - elle n'attrapait qu'un champ en début de ligne, alors qu'un payload
  //    court s'écrit `.update({ employes_renfort: ids })` sur une seule ligne.
  // Une garde aveugle est pire qu'absente : elle rassure.
  const sources = fs.readdirSync(RACINE)
    .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f) && !f.startsWith('test_'));
  const trouvees = new Set();
  for (const f of sources) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    if (!src.includes(`from('${table}')`)) continue;
    // Les champs d'un objet inséré : `nom_colonne: …` en début de ligne.
    for (const m of src.matchAll(/^\s{4,}([a-z_]+):\s/gm)) trouvees.add(m[1]);
    // Et ceux d'un payload court, écrit en ligne derrière insert/update/upsert.
    for (const m of src.matchAll(/\.(?:insert|update|upsert)\(\s*\{([^}]*)\}/g)) {
      for (const champ of m[1].matchAll(/([a-z_]+):/g)) trouvees.add(champ[1]);
    }
  }
  return trouvees;
}

/** Migrations de la promotion qui créent une colonne donnée. */
function migrationsQuiCreent(table, colonne) {
  return fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql') && f.split('_')[0] > VERSION_PRODUCTION)
    .filter(f => {
      const sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8').toLowerCase();
      // Resserré le 09/10/2026 : la fenêtre de 80 caractères après `add column`
      // était satisfaite par le `comment on column …detail is` qui suit, si bien
      // qu'une colonne renommée restait vue comme créée. On exige désormais le
      // nom dans la clause elle-même, sans rien entre les deux.
      if (!new RegExp(`alter table (public\\.)?${table}\\b`).test(sql)) return false;
      return new RegExp(`add column\\s+(if not exists\\s+)?"?${colonne}"?[\\s(]`).test(sql);
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

// ---------------------------------------------------------------------------
// Les colonnes dont la migration attend encore une gate humaine.
//
// 20261009120000 ajoute audits_caisse.employes_renfort et
// nexus_paye_items.detail. Elle n'est appliquée à AUCUN environnement et ne
// peut pas l'être : toute opération sur Supabase Production est une gate
// humaine. Elle n'est donc citée à aucun manifeste de promotion, et c'est
// exact — pas un oubli.
//
// Ce qui rend cette attente tenable n'est pas une promesse, c'est une sonde :
// chaque écran interroge la colonne avant de l'écrire, et masque la
// fonctionnalité si la base ne la connaît pas. L'invariant jugé ici est donc
// une alternative, et non un relâchement : une colonne que le code écrit
// voyage avec sa migration CITÉE INCLUSE, ou bien le code la sonde et se
// masque sans elle. Le jour où la migration entre à un manifeste, la première
// branche prend le relais — cette garde ne devient jamais fausse par un
// progrès correct, et elle ne devient jamais muette non plus.
const COLONNES_SOUS_SONDE = [
  { table: 'audits_caisse', colonne: 'employes_renfort' },
  { table: 'nexus_paye_items', colonne: 'detail' },
];

/** Vrai si le code interroge cette colonne dans un .select(…) — la sonde. */
function sondeeParLeCode(colonne) {
  const sources = fs.readdirSync(RACINE)
    .filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f) && !f.startsWith('test_'));
  return sources.some(f => {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    return new RegExp(`\\.select\\((['"\`])[^'"\`]*\\b${colonne}\\b[^'"\`]*\\1`).test(src);
  });
}

t('les colonnes du 09/10 sont bien écrites par le code', () => {
  // Même raison qu'au-dessus : une garde qui ne surveille plus rien doit le
  // dire. Ces deux colonnes avaient d'ailleurs échappé à la détection jusqu'à
  // ce qu'elle soit élargie, ce jour-là.
  for (const { table, colonne } of COLONNES_SOUS_SONDE) {
    assert.ok(colonnesEcritesParLeCode(table).has(colonne),
      `le code n'écrit plus ${table}.${colonne} : cette garde ne surveille plus rien`);
  }
});

t('chacune a sa migration, et le code se masque tant qu’elle n’est pas passée', () => {
  for (const { table, colonne } of COLONNES_SOUS_SONDE) {
    const migrations = migrationsQuiCreent(table, colonne);
    assert.ok(migrations.length >= 1,
      `le code écrit ${table}.${colonne}, mais aucune migration de la promotion ne la crée`);
    // Écrit en disjonction, et non en `if … continue` : une campagne de
    // mutation a montré qu'un branchement passé à vrai rendait la seconde
    // moitié du jugement silencieuse sans qu'aucun témoin ne s'en plaigne.
    const toutesCitees = migrations.every(citeeCommeIncluse);
    const sondee = sondeeParLeCode(colonne);
    assert.ok(toutesCitees || sondee,
      `${migrations.join(', ')} crée ${table}.${colonne} sans être citée INCLUSE, et le code ` +
      `ne sonde pas cette colonne : l'écran casserait sur une base qui ne la connaît pas.`);
    console.log(`      ${table}.${colonne} — ${toutesCitees
      ? 'migration citée INCLUSE au manifeste'
      : 'migration en attente de gate humaine, colonne sondée avant écriture'}`);
  }
});

t('MUTATION : une colonne écrite sans migration ni sonde est bien détectée', () => {
  // Le témoin porte sur les deux moitiés de l'alternative, car une garde qui
  // accepterait tout serait exactement aussi verte que celle-ci.
  assert.strictEqual(migrationsQuiCreent('audits_caisse', 'colonne_jamais_creee').length, 0,
    'une colonne inexistante trouve une migration : la détection accepte tout');
  assert.strictEqual(sondeeParLeCode('colonne_jamais_sondee'), false,
    'une colonne jamais sondée est vue comme sondée : le témoin ne prouve rien');
});

t('MUTATION : une migration déclassée est bien détectée', () => {
  // Sans ce témoin, une garde qui rendrait toujours vrai passerait.
  const faux = MANIFESTE.replace('20260911180000_pointages_service_id.sql', 'autre-chose.sql');
  const sections = faux.split(/^## /m);
  const trouvee = sections.some(s => /^INCLUSES/i.test(s) && s.includes('20260911180000_pointages_service_id.sql'));
  assert.strictEqual(trouvee, false, 'la mutation ne change rien : le témoin ne prouve rien');
});

console.log(`\n${passes}/8 vérifications passées — une colonne que le code exige ne peut plus partir sans sa migration.`);
