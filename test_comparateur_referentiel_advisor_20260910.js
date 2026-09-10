#!/usr/bin/env node
// Le comparateur du référentiel Advisor doit MORDRE, et les deux côtés de la
// mesure doivent normaliser pareil.
//
// LE DÉFAUT QU'ELLE GARDE. La mesure d'impact du seed Advisor se fait en deux
// endroits qui ne se parlent pas : une requête SQL calcule une empreinte md5
// par ligne sur Production, un analyseur JavaScript calcule la même empreinte
// à partir du fichier de migration. Si les deux listes de colonnes divergent —
// une colonne ajoutée d'un côté, un ordre changé de l'autre — TOUTES les
// empreintes divergent, et le comparateur annonce trente-sept écrasements qui
// n'existent pas. Le pire cas est l'inverse : une normalisation qui gomme une
// vraie différence et rend « identique » à tort.
//
// Le 09/09/2026, cette mesure avait été faite à la main, avec un analyseur
// jeté après usage. Elle n'était donc pas rejouable — et un critère de gate
// qu'on ne peut pas rejouer n'est pas un critère, c'est un souvenir.
//
// CE QU'ELLE VÉRIFIE, par témoins et par mutation : que le comparateur rend
// CHANGEE quand une valeur change, CREEE quand une ligne manque, et que la
// liste de colonnes du SQL est exactement celle du JavaScript, dans le même
// ordre.

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
const outil = require(path.join(RACINE, 'outils/comparer-referentiel-advisor.js'));
const CHEMIN_SQL = path.join(RACINE, 'outils/empreintes-referentiel-advisor-production.sql');
const CHEMIN_MIGRATION = path.join(RACINE, 'supabase/migrations/20260905161500_seed_referentiel_advisor.sql');

/** Colonnes nommées dans un bloc md5(concat_ws(...)) du SQL, dans l'ordre. */
function colonnesDuSql(sql, table) {
  const debut = sql.indexOf(`from public.${table}`);
  assert.ok(debut > 0, `bloc absent pour ${table} dans ${path.basename(CHEMIN_SQL)}`);
  const ouverture = sql.lastIndexOf('md5(concat_ws(chr(31)', debut);
  assert.ok(ouverture > 0, `concat_ws absent pour ${table}`);
  const bloc = sql.slice(ouverture, debut);
  const colonnes = [];
  for (const m of bloc.matchAll(/coalesce\(([\s\S]*?),\s*'∅'\)/g)) {
    const expr = m[1];
    const nom = (expr.match(/\b([a-z_]+)\b(?:::[a-z]+)?\s*$/) || [])[1]
      || (expr.match(/from\s+jsonb_array_elements_text\((\w+)\)/) || [])[1]
      || (expr.match(/\b([a-z_]+)\b/) || [])[1];
    colonnes.push(nom);
  }
  return colonnes;
}

// ── Les deux côtés lisent les mêmes colonnes, dans le même ordre ────────────

t('les colonnes du SQL Production sont exactement celles du comparateur', () => {
  const sql = fs.readFileSync(CHEMIN_SQL, 'utf8');
  const attendu = {
    nexus_language_templates: ['code', 'domain', 'message_type', 'tone', 'minimum_confidence',
      'title_template', 'body_template', 'action_label_template', 'variables_schema', 'enabled'],
    advisor_rules: ['code', 'name', 'domain', 'description', 'data_requirements',
      'trigger_expression', 'severity_expression', 'confidence_expression', 'default_priority',
      'message_template_id', 'cooldown_hours', 'action_type', 'escalation_delay_hours', 'enabled'],
  };
  for (const [table, colonnes] of Object.entries(attendu)) {
    assert.deepStrictEqual(colonnesDuSql(sql, table), colonnes,
      `${table} : le SQL ne normalise pas les mêmes colonnes, ou pas dans le même ordre, que le comparateur`);
  }
});

t('la liste attendue est celle que la migration déclare, id exclu', () => {
  // Sans ce contrôle, les deux côtés pourraient s'accorder sur une liste
  // fausse : ils diraient la même chose, et la mesure serait quand même vide.
  const mig = fs.readFileSync(CHEMIN_MIGRATION, 'utf8');
  for (const table of ['nexus_language_templates', 'advisor_rules']) {
    const i = mig.indexOf(`insert into public.${table}`);
    const liste = mig.slice(mig.indexOf('(', i) + 1, mig.indexOf(')', mig.indexOf('(', i)));
    const declarees = liste.split(',').map((c) => c.trim()).filter(Boolean);
    const sansId = declarees.filter((c) => c !== 'id');
    assert.deepStrictEqual(colonnesDuSql(fs.readFileSync(CHEMIN_SQL, 'utf8'), table), sansId,
      `${table} : la liste normalisée diverge de l'INSERT de la migration`);
  }
});

t('le SQL de mesure n\'écrit rien', () => {
  const sql = fs.readFileSync(CHEMIN_SQL, 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const ecritures = sql.match(/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/gi) || [];
  assert.deepStrictEqual(ecritures, [], `le SQL de mesure contient : ${ecritures.join(', ')}`);
});

// ── Le comparateur mord ────────────────────────────────────────────────────

t('la migration lue rend 6 et 31 lignes, comme elle le déclare', () => {
  const { empreintes } = outil.empreintesMigration();
  assert.strictEqual(Object.keys(empreintes.nexus_language_templates).length, 6);
  assert.strictEqual(Object.keys(empreintes.advisor_rules).length, 31);
});

t('témoin positif : contre elle-même, aucune ligne ne change', () => {
  const { empreintes } = outil.empreintesMigration();
  const r = outil.comparer(empreintes, empreintes);
  assert.strictEqual(r.advisor_rules.changees, 0);
  assert.strictEqual(r.advisor_rules.creees, 0);
  assert.strictEqual(r.advisor_rules.identiques, 31);
});

t('MUTATION : un accent retiré à une valeur ressort en CHANGEE', () => {
  // Le témoin qui compte. Un comparateur qui rendrait toujours IDENTIQUE
  // passerait tous les contrôles ci-dessus.
  const mig = fs.readFileSync(CHEMIN_MIGRATION, 'utf8');
  const mute = mig.replace("'Écarts de caisse à justifier'", "'Écarts de caisse a justifier'");
  assert.notStrictEqual(mute, mig, 'la valeur témoin a changé dans la migration — ce contrôle ne prouve plus rien');
  const r = outil.comparer(outil.empreintesMigration(mute).empreintes, outil.empreintesMigration(mig).empreintes);
  assert.strictEqual(r.nexus_language_templates.changees, 1,
    `un accent retiré rend ${r.nexus_language_templates.changees} CHANGEE au lieu de 1`);
  assert.strictEqual(r.nexus_language_templates.lignes.find((l) => l.verdict === 'CHANGEE').code,
    'CAISSE_ECART_NON_JUSTIFIE');
});

t('une ligne absente de Production ressort en CREEE, pas en IDENTIQUE', () => {
  const { empreintes } = outil.empreintesMigration();
  const amputee = JSON.parse(JSON.stringify(empreintes));
  delete amputee.advisor_rules.STOCK_SURSTOCK;
  const r = outil.comparer(empreintes, amputee);
  assert.strictEqual(r.advisor_rules.creees, 1);
  assert.strictEqual(r.advisor_rules.lignes.find((l) => l.verdict === 'CREEE').code, 'STOCK_SURSTOCK');
});

t('un code présent en Production hors migration est signalé, pas ignoré', () => {
  const { empreintes } = outil.empreintesMigration();
  const enrichie = JSON.parse(JSON.stringify(empreintes));
  enrichie.advisor_rules.REGLE_AJOUTEE_A_LA_MAIN = 'aaaaaaaaaaaa';
  const r = outil.comparer(empreintes, enrichie);
  assert.deepStrictEqual(r.advisor_rules.enTropEnProduction, ['REGLE_AJOUTEE_A_LA_MAIN']);
});

// ── Les nuls, qui fabriquent les faux écarts ───────────────────────────────

t('NULL majuscule et null::int sont reconnus comme des nuls', () => {
  assert.strictEqual(outil.litteral('NULL'), null);
  assert.strictEqual(outil.litteral('null::int'), null);
  assert.strictEqual(outil.litteral('null::uuid'), null);
});

t('une valeur nulle ne rend pas la même empreinte qu\'une chaîne vide', () => {
  assert.notStrictEqual(outil.empreinte([null]), outil.empreinte(['']));
  assert.notStrictEqual(outil.empreinte(['a', null, 'b']), outil.empreinte(['a', '', 'b']));
});

t('variables_schema est réduit à ses éléments TRIÉS, comme côté SQL', () => {
  assert.strictEqual(outil.listeJsonTriee('["period", "count"]'), 'count,period');
  assert.strictEqual(outil.listeJsonTriee('["count", "period"]'), 'count,period');
  assert.strictEqual(outil.listeJsonTriee(null), null);
});

t('une apostrophe doublée est rendue simple, pas conservée', () => {
  // La migration en est pleine (« d''honnêteté »). Les garder doublerait le
  // texte par rapport à Production et fabriquerait 37 faux écrasements.
  assert.strictEqual(outil.litteral("'l''écart'"), "l'écart");
});

console.log(`\n${passes}/12 vérifications passées — le comparateur Advisor mord, et les deux côtés normalisent pareil.`);
