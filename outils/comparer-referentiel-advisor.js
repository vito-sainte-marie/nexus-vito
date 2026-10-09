#!/usr/bin/env node
'use strict';
/**
 * Comparateur du référentiel Advisor — migration contre Production.
 *
 * Répond à une seule question : si la migration
 * `20260905161500_seed_referentiel_advisor.sql` était appliquée à Production,
 * quelles lignes seraient CREEES, lesquelles verraient une valeur CHANGER,
 * lesquelles seraient réécrites à l'identique ?
 *
 * Le `on conflict (code) do update` s'exécute même quand rien ne diverge :
 * « réécrite » n'est donc pas « modifiée ». C'est la distinction que ce
 * comparateur rend, et que le nombre de lignes touchées ne rend pas.
 *
 * Il ne se connecte à rien. Il lit le fichier de migration, calcule une
 * empreinte par ligne, et la compare aux empreintes mesurées séparément sur
 * Production par `outils/empreintes-referentiel-advisor-production.sql`.
 * La normalisation doit rester identique des deux côtés — le fichier SQL
 * porte la même liste de règles en commentaire.
 *
 *   node outils/comparer-referentiel-advisor.js <empreintes-production.json>
 *   node outils/comparer-referentiel-advisor.js --auto-controle
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.resolve(__dirname, '..');
const MIGRATION = path.join(RACINE, 'supabase/migrations/20260905161500_seed_referentiel_advisor.sql');
const MARQUE_NULLE = '∅';
const SEPARATEUR = String.fromCharCode(31);

/** Ce que la migration déclare — vérifié, jamais supposé. */
const TABLES = {
  nexus_language_templates: {
    colonnes: ['id', 'code', 'domain', 'message_type', 'tone', 'minimum_confidence',
      'title_template', 'body_template', 'action_label_template', 'variables_schema', 'enabled'],
    lignesAttendues: 6,
    jsonTriees: ['variables_schema'],
  },
  advisor_rules: {
    colonnes: ['id', 'code', 'name', 'domain', 'description', 'data_requirements',
      'trigger_expression', 'severity_expression', 'confidence_expression', 'default_priority',
      'message_template_id', 'cooldown_hours', 'action_type', 'escalation_delay_hours', 'enabled'],
    lignesAttendues: 31,
    jsonTriees: [],
  },
};

// ── Lecture du SQL ──────────────────────────────────────────────────────────

/** Isole le bloc VALUES d'un `insert into public.<table>`, sans le `on conflict`. */
function blocValues(sql, table) {
  const debut = sql.indexOf(`insert into public.${table}`);
  if (debut < 0) throw new Error(`insert introuvable pour ${table}`);
  const apresValues = sql.indexOf('\nvalues', debut);
  if (apresValues < 0) throw new Error(`bloc values introuvable pour ${table}`);
  const fin = sql.indexOf('on conflict', apresValues);
  if (fin < 0) throw new Error(`on conflict introuvable pour ${table}`);
  return sql.slice(apresValues + '\nvalues'.length, fin);
}

/**
 * Découpe un bloc VALUES en tuples. Ne peut pas se faire au split(',') :
 * les textes métier contiennent des virgules, des parenthèses et des
 * apostrophes doublées.
 */
function decouperTuples(bloc) {
  const tuples = [];
  let profondeur = 0, dansTexte = false, courant = '';
  for (let i = 0; i < bloc.length; i++) {
    const c = bloc[i];
    if (dansTexte) {
      if (c === "'") {
        if (bloc[i + 1] === "'") { courant += "''"; i++; continue; }
        dansTexte = false;
      }
      courant += c;
      continue;
    }
    if (c === "'") { dansTexte = true; courant += c; continue; }
    if (c === '(') { profondeur++; if (profondeur === 1) { courant = ''; continue; } }
    if (c === ')') { profondeur--; if (profondeur === 0) { tuples.push(courant); continue; } }
    if (profondeur > 0) courant += c;
  }
  if (dansTexte) throw new Error('texte SQL non refermé — découpage abandonné');
  if (profondeur !== 0) throw new Error('parenthèses déséquilibrées — découpage abandonné');
  return tuples;
}

/** Découpe un tuple en valeurs, aux virgules de premier niveau seulement. */
function decouperValeurs(tuple) {
  const valeurs = [];
  let profondeur = 0, dansTexte = false, courant = '';
  for (let i = 0; i < tuple.length; i++) {
    const c = tuple[i];
    if (dansTexte) {
      if (c === "'") {
        if (tuple[i + 1] === "'") { courant += "''"; i++; continue; }
        dansTexte = false;
      }
      courant += c;
      continue;
    }
    if (c === "'") { dansTexte = true; courant += c; continue; }
    if (c === '(' || c === '[') profondeur++;
    if (c === ')' || c === ']') profondeur--;
    if (c === ',' && profondeur === 0) { valeurs.push(courant); courant = ''; continue; }
    courant += c;
  }
  valeurs.push(courant);
  return valeurs.map((v) => v.trim());
}

/**
 * Rend la valeur telle que Postgres la stockerait, ou null.
 * Le `NULL` majuscule DOIT être reconnu : la migration l'écrit ainsi, et le
 * prendre pour un texte fabriquerait de faux écrasements.
 */
function litteral(brut) {
  let v = brut.trim();
  while (/::\s*[a-z_]+(\[\])?$/i.test(v)) v = v.replace(/::\s*[a-z_]+(\[\])?$/i, '').trim();
  if (/^null$/i.test(v)) return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase();
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** Même réduction que `jsonb_array_elements_text` + tri, côté SQL. */
function listeJsonTriee(valeur) {
  if (valeur === null) return null;
  const elements = JSON.parse(valeur);
  if (!Array.isArray(elements)) throw new Error('variables_schema n\'est pas un tableau');
  return elements.map(String).sort().join(',');
}

function empreinte(champs) {
  const texte = champs.map((v) => (v === null ? MARQUE_NULLE : String(v))).join(SEPARATEUR);
  return crypto.createHash('md5').update(texte, 'utf8').digest('hex').slice(0, 12);
}

/** Lit la migration et rend { table: { code: empreinte } }, en se contrôlant. */
function empreintesMigration(sqlBrut) {
  const sql = sqlBrut !== undefined ? sqlBrut : fs.readFileSync(MIGRATION, 'utf8');
  const resultat = {};
  const controles = [];
  for (const [table, def] of Object.entries(TABLES)) {
    const tuples = decouperTuples(blocValues(sql, table));
    if (tuples.length !== def.lignesAttendues) {
      throw new Error(`${table} : ${tuples.length} lignes lues, ${def.lignesAttendues} déclarées par la migration`);
    }
    const empreintes = {};
    for (const tuple of tuples) {
      const brutes = decouperValeurs(tuple);
      if (brutes.length !== def.colonnes.length) {
        throw new Error(`${table} : ${brutes.length} valeurs lues, ${def.colonnes.length} colonnes attendues`);
      }
      const champs = [];
      let code = null;
      def.colonnes.forEach((colonne, i) => {
        if (colonne === 'id') return;                       // jamais écrite par le do update
        let v = litteral(brutes[i]);
        if (def.jsonTriees.includes(colonne)) v = listeJsonTriee(v);
        if (colonne === 'code') code = v;
        champs.push(v);
      });
      if (code === null) throw new Error(`${table} : une ligne sans code`);
      empreintes[code] = empreinte(champs);
    }
    resultat[table] = empreintes;
    controles.push(`${table} : ${tuples.length} lignes × ${def.colonnes.length} colonnes`);
  }
  return { empreintes: resultat, controles };
}

// ── Comparaison ─────────────────────────────────────────────────────────────

/** Verdict par code : CREEE, CHANGEE ou IDENTIQUE. Fonction pure. */
function comparer(migration, production) {
  const parTable = {};
  for (const table of Object.keys(migration)) {
    const cotesProd = production[table] || {};
    const lignes = [];
    for (const [code, e] of Object.entries(migration[table])) {
      const prod = cotesProd[code];
      lignes.push({
        code,
        verdict: prod === undefined ? 'CREEE' : (prod === e ? 'IDENTIQUE' : 'CHANGEE'),
      });
    }
    const enTropEnProduction = Object.keys(cotesProd).filter((c) => !(c in migration[table]));
    parTable[table] = {
      lignes,
      creees: lignes.filter((l) => l.verdict === 'CREEE').length,
      changees: lignes.filter((l) => l.verdict === 'CHANGEE').length,
      identiques: lignes.filter((l) => l.verdict === 'IDENTIQUE').length,
      total: lignes.length,
      enTropEnProduction,
    };
  }
  return parTable;
}

// ── Auto-contrôle : le comparateur se prouve avant d'être cru ───────────────

function autoControle() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const { empreintes, controles } = empreintesMigration(sql);
  const echecs = [];
  controles.forEach((c) => console.log(`  lu : ${c}`));

  // Témoin positif — la migration comparée à elle-même ne change rien.
  const memeChose = comparer(empreintes, empreintes);
  for (const [table, r] of Object.entries(memeChose)) {
    if (r.changees !== 0 || r.creees !== 0) {
      echecs.push(`${table} : la migration comparée à elle-même rend ${r.creees} CREEE / ${r.changees} CHANGEE`);
    }
  }
  console.log('  témoin positif : migration contre elle-même → 0 CREEE, 0 CHANGEE');

  // Témoin négatif — une valeur modifiée DOIT ressortir en CHANGEE.
  // Sans ce témoin, un comparateur qui rendrait toujours IDENTIQUE passerait.
  const mute = sql.replace("'Écarts de caisse à justifier'", "'Écarts de caisse a justifier'");
  if (mute === sql) {
    echecs.push('mutation impossible : la valeur témoin a changé dans la migration, ce contrôle ne prouve plus rien');
  } else {
    const apres = comparer(empreintesMigration(mute).empreintes, empreintes);
    const t = apres.nexus_language_templates;
    if (t.changees !== 1) {
      echecs.push(`témoin négatif : un accent retiré rend ${t.changees} CHANGEE au lieu de 1`);
    } else {
      console.log('  témoin négatif : un accent retiré → 1 CHANGEE (le comparateur mord)');
    }
  }

  // Témoin négatif — un NULL pris pour du texte fabriquerait de faux écarts.
  if (litteral('NULL') !== null) echecs.push('litteral("NULL") ne rend pas null — les nuls majuscules seraient pris pour du texte');
  if (litteral('null::int') !== null) echecs.push('litteral("null::int") ne rend pas null');
  if (empreinte([null]) === empreinte([''])) echecs.push('une valeur nulle et une chaîne vide rendent la même empreinte');
  console.log('  témoin négatif : NULL, null::int et ∅ ≠ chaîne vide → reconnus');

  if (echecs.length) {
    echecs.forEach((e) => console.error(`  ✗ ${e}`));
    return 1;
  }
  console.log('\n  auto-contrôle : OK');
  return 0;
}

// ── Entrée ──────────────────────────────────────────────────────────────────

function principal(argv) {
  if (argv.includes('--auto-controle')) return autoControle();
  const fichier = argv.find((a) => !a.startsWith('--'));
  if (!fichier) {
    console.error('usage : node outils/comparer-referentiel-advisor.js <empreintes-production.json>');
    console.error('        node outils/comparer-referentiel-advisor.js --auto-controle');
    return 2;
  }
  const production = JSON.parse(fs.readFileSync(path.resolve(fichier), 'utf8'));
  const { empreintes, controles } = empreintesMigration();
  controles.forEach((c) => console.log(`  migration lue : ${c}`));
  console.log(`  empreintes Production mesurées le : ${production.mesure_le || 'non daté'}`);

  const resultat = comparer(empreintes, production);
  let changeesTotal = 0;
  console.log('');
  for (const [table, r] of Object.entries(resultat)) {
    console.log(`  ${table}`);
    console.log(`    créées ${r.creees} · changées ${r.changees} · identiques ${r.identiques} · total ${r.total}`);
    r.lignes.filter((l) => l.verdict !== 'IDENTIQUE')
      .forEach((l) => console.log(`    ${l.verdict} : ${l.code}`));
    if (r.enTropEnProduction.length) {
      console.log(`    présents en Production hors migration (non touchés) : ${r.enTropEnProduction.join(', ')}`);
    }
    changeesTotal += r.changees;
  }
  console.log('');
  console.log(changeesTotal === 0
    ? '  Aucune valeur ne changerait. Les lignes seraient réécrites à l\'identique.'
    : `  ${changeesTotal} ligne(s) verraient une valeur changer — à examiner champ par champ avant d'appliquer.`);
  return changeesTotal === 0 ? 0 : 1;
}

if (require.main === module) process.exit(principal(process.argv.slice(2)));
module.exports = { empreintesMigration, comparer, litteral, listeJsonTriee, empreinte, decouperTuples, decouperValeurs };
