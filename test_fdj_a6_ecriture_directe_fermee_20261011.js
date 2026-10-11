// A6 — relevés de clôture, rapports et journal d'audit FDJ fermés à
// l'écriture directe (migration 20261011090000).
//
// Défaut constaté en recette le 10/10/2026 : `anon` et `authenticated`
// détenaient INSERT, UPDATE, DELETE, TRUNCATE et MAINTAIN sur
// fdj_releves_cloture, fdj_reports et fdj_audit_log ; un caissier pouvait
// écrire une fausse ligne d'audit au nom de son manager, et n'importe quel
// client (même anon) vider le journal par TRUNCATE, que la RLS n'arrête pas.
//
// Ce que ce test garde, sans base de données :
//   - la migration retire toute écriture (y compris TRUNCATE et MAINTAIN) à
//     public, anon et authenticated sur les trois tables, et la lecture à anon ;
//   - les quatre commandes qui remplacent les écritures sont SECURITY DEFINER,
//     search_path vide, fermées à public et anon ;
//   - aucun écran (HTML), script ni fonction Edge n'écrit plus en direct dans
//     les trois tables ;
//   - les écrans appellent les commandes avec EXACTEMENT les arguments de leur
//     signature (PostgREST résout par nom : un argument manquant ou en trop
//     rend PGRST202) ;
//   - toute action d'audit littérale passée à fdj_manager_journaliser figure
//     dans la liste fermée de la commande.
//
// La preuve en base (refus 42501 par rôle réel, flux légitimes) est
// outils/epreuve-fdj-a6-ecriture-directe-20261011/ ; elle se rejoue sur Test
// dans une transaction annulée.
//
// Preuve que chaque garde mord : chaque contrôle est rejoué sur une copie
// mutée en mémoire (ancre exigée unique) et doit alors échouer.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const MIGRATION = 'supabase/migrations/20261011090000_fdj_a6_ecriture_directe_releves_reports_audit_fermee.sql';
const TABLES = ['fdj_releves_cloture', 'fdj_reports', 'fdj_audit_log'];
const COMMANDES = {
  fdj_manager_journaliser: 'public.fdj_manager_journaliser(uuid, text, uuid, text, text, jsonb, jsonb)',
  fdj_journaliser_ouverture_validee: 'public.fdj_journaliser_ouverture_validee(uuid, jsonb)',
  fdj_manager_poser_releve_cloture: 'public.fdj_manager_poser_releve_cloture(uuid, jsonb)',
  fdj_manager_enregistrer_rapports: 'public.fdj_manager_enregistrer_rapports(uuid, numeric, numeric)',
};
const APPELANTS = {
  fdj_manager_journaliser: 'manager',
  fdj_journaliser_ouverture_validee: 'employe',
  fdj_manager_poser_releve_cloture: 'manager',
  fdj_manager_enregistrer_rapports: 'manager',
};

// Sources applicatives : tous les HTML et JS de la racine (hors tests), et
// les fonctions Edge. Les écrans FDJ ont leur propre clé pour les mutations.
function sourcesApplicatives() {
  const out = {};
  for (const f of fs.readdirSync(RACINE)) {
    if ((f.endsWith('.html') || f.endsWith('.js')) && !f.startsWith('test_')) out[f] = fs.readFileSync(path.join(RACINE, f), 'utf8');
  }
  const edge = path.join(RACINE, 'supabase', 'functions');
  (function marche(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) marche(p);
      else if (/\.(ts|js)$/.test(e.name)) out[path.relative(RACINE, p)] = fs.readFileSync(p, 'utf8');
    }
  })(edge);
  return out;
}

const SOURCES = {
  migration: fs.readFileSync(path.join(RACINE, MIGRATION), 'utf8'),
  manager: fs.readFileSync(path.join(RACINE, 'NEXUS-FDJ-Manager-v1.html'), 'utf8'),
  employe: fs.readFileSync(path.join(RACINE, 'NEXUS-FDJ-v1.html'), 'utf8'),
  autres: sourcesApplicatives(),
};
delete SOURCES.autres['NEXUS-FDJ-Manager-v1.html'];
delete SOURCES.autres['NEXUS-FDJ-v1.html'];

function sansCommentairesSql(t) { return t.split('\n').map(l => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l; }).join('\n'); }
function normaliser(t) { return t.replace(/\s+/g, ' ').toLowerCase(); }

// Paramètres d'une fonction : de `create or replace function public.nom(` à `) returns`.
function parametres(sql, nom) {
  const entete = `create or replace function public.${nom}(`;
  const d = sql.indexOf(entete);
  assert.ok(d >= 0, `commande ${nom} absente de la migration`);
  assert.strictEqual(sql.indexOf(entete, d + 1), -1, `${nom} créée deux fois`);
  const f = sql.indexOf(') returns', d);
  return { debut: d, params: sql.slice(d + entete.length, f).split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean) };
}

// Objet littéral `{ … }` qui commence à `i` : texte et clés de profondeur 1.
function objetLitteral(src, i) {
  assert.strictEqual(src[i], '{');
  let prof = 0, q = null, j = i, cles = [], tampon = '';
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') { prof++; if (prof === 1) tampon = ''; continue; }
    if (c === '}') { prof--; if (prof === 0) break; continue; }
    if (prof === 1) {
      tampon += c;
      const m = /(?:^|[,{\s])(p_[a-z_]+)\s*:$/.exec(tampon);
      if (m) { cles.push(m[1]); tampon = ''; }
    }
  }
  return { texte: src.slice(i, j + 1), cles };
}

function appels(src, nom) {
  const out = [];
  const motif = `rpc('${nom}', `;
  let i = src.indexOf(motif);
  while (i >= 0) {
    const o = src.indexOf('{', i + motif.length);
    assert.strictEqual(o, i + motif.length, `appel ${nom} sans objet d'arguments littéral`);
    out.push(objetLitteral(src, o));
    i = src.indexOf(motif, i + 1);
  }
  return out;
}

// Écritures directes : `.from('table')` suivi, dans la même chaîne d'appel,
// de insert/update/upsert/delete.
function ecrituresDirectes(src) {
  const trouve = [];
  for (const t of TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`, 'g');
    let m;
    while ((m = re.exec(src))) {
      const suite = src.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const fin = suite.search(/;|\.from\(/);
      const chaine = fin >= 0 ? suite.slice(0, fin) : suite;
      if (/^\s*\.(insert|update|upsert|delete)\s*\(/.test(chaine)) trouve.push(t);
    }
  }
  return trouve;
}

const CONTROLES = {
  ecriture_retiree_aux_trois_tables: S => {
    const sql = normaliser(sansCommentairesSql(S.migration));
    for (const t of TABLES) {
      assert.ok(sql.includes(`revoke insert, update, delete, truncate, references, trigger, maintain on public.${t} from public, anon, authenticated;`),
        `${t} : écriture (TRUNCATE et MAINTAIN compris) non retirée à public, anon, authenticated`);
      assert.ok(sql.includes(`revoke select on public.${t} from public, anon;`), `${t} : lecture non retirée à anon`);
    }
    assert.ok(!/\bgrant\b[^;]*\bon (table )?public\.fdj_(releves_cloture|reports|audit_log)\b/.test(sql),
      'la migration ne doit rendre aucun droit de table');
  },
  commandes_definer_search_path_vide: S => {
    const sql = sansCommentairesSql(S.migration);
    for (const nom of Object.keys(COMMANDES)) {
      const { debut } = parametres(sql, nom);
      const entete = normaliser(sql.slice(debut, sql.indexOf('$$', debut)));
      assert.ok(entete.includes('security definer'), `${nom} doit être SECURITY DEFINER`);
      assert.ok(entete.includes("set search_path = ''"), `${nom} doit fixer search_path vide`);
    }
  },
  commandes_fermees_a_anon: S => {
    const sql = sansCommentairesSql(S.migration);
    const d = sql.indexOf('foreach v_sig in array array[');
    assert.ok(d >= 0, 'bloc des droits d\'exécution introuvable');
    const bloc = sql.slice(d, sql.indexOf('end loop;', d));
    for (const sig of [...Object.values(COMMANDES), 'public.fdj_synchroniser_releves_courants(text)']) {
      assert.ok(bloc.includes(`'${sig}'`), `${sig} absente du bloc des droits`);
    }
    for (const geste of ["' from public'", "' from anon'", "' to authenticated'"]) {
      assert.ok(bloc.includes(geste), `bloc des droits : geste ${geste} absent`);
    }
  },
  aucune_ecriture_directe: S => {
    const fautes = [];
    for (const [f, src] of Object.entries({ 'NEXUS-FDJ-Manager-v1.html': S.manager, 'NEXUS-FDJ-v1.html': S.employe, ...S.autres })) {
      for (const t of ecrituresDirectes(src)) fautes.push(`${f} → ${t}`);
    }
    assert.deepStrictEqual(fautes, [], 'écritures directes restantes : ' + fautes.join(', '));
  },
  ecrans_appellent_les_commandes: S => {
    for (const [nom, cle] of Object.entries(APPELANTS)) {
      assert.ok(appels(S[cle], nom).length > 0, `${cle} n'appelle pas ${nom}`);
    }
  },
  arguments_conformes_aux_signatures: S => {
    const sql = sansCommentairesSql(S.migration);
    for (const nom of Object.keys(COMMANDES)) {
      const attendus = parametres(sql, nom).params.slice().sort();
      for (const cle of ['manager', 'employe']) {
        for (const a of appels(S[cle], nom)) {
          assert.deepStrictEqual(a.cles.slice().sort(), attendus, `${cle} : ${nom} appelée avec ${a.cles.join(', ')}`);
        }
      }
    }
  },
  actions_dans_la_liste_fermee: S => {
    const sql = sansCommentairesSql(S.migration);
    let litterales = 0;
    for (const a of appels(S.manager, 'fdj_manager_journaliser')) {
      const m = /p_action:\s*'([^']+)'/.exec(a.texte);
      if (!m) continue;
      litterales++;
      assert.ok(sql.includes(`when '${m[1]}'`) || sql.includes(`'${m[1]}',`) || sql.includes(`'${m[1]}')`),
        `action ${m[1]} hors de la liste fermée de fdj_manager_journaliser`);
    }
    assert.ok(litterales > 0, 'aucune action littérale trouvée : le contrôle ne mesure rien');
  },
};

const MUTATIONS = [
  ['ecriture_retiree_aux_trois_tables', 'migration',
    'revoke insert, update, delete, truncate, references, trigger, maintain\n  on public.fdj_audit_log from public, anon, authenticated;',
    'revoke insert, update, delete, references, trigger, maintain\n  on public.fdj_audit_log from public, anon, authenticated;'],
  ['ecriture_retiree_aux_trois_tables', 'migration',
    'revoke select on public.fdj_reports from public, anon;',
    'revoke select on public.fdj_reports from public;'],
  ['ecriture_retiree_aux_trois_tables', 'migration',
    'revoke select on public.fdj_audit_log from public, anon;',
    'revoke select on public.fdj_audit_log from public, anon;\ngrant insert on public.fdj_audit_log to authenticated;'],
  ['commandes_definer_search_path_vide', 'migration',
    ') returns void\nlanguage plpgsql\nsecurity definer',
    ') returns void\nlanguage plpgsql\nsecurity invoker'],
  ['commandes_fermees_a_anon', 'migration',
    "    execute 'revoke all on function ' || v_sig || ' from anon';\n",
    ''],
  ['commandes_fermees_a_anon', 'migration',
    "    'public.fdj_journaliser_ouverture_validee(uuid, jsonb)',\n",
    ''],
  ['aucune_ecriture_directe', 'manager',
    "    // 3) Rapports.\n",
    "    // 3) Rapports.\n    await nexusClient.from('fdj_reports').upsert([]);\n"],
  ['aucune_ecriture_directe', 'employe',
    "    effacerDraft();\n    renderConfirmationOuverture(jeuxModifies);",
    "    await nexusClient\n      .from('fdj_audit_log')\n      .insert({});\n    effacerDraft();\n    renderConfirmationOuverture(jeuxModifies);"],
  ['ecrans_appellent_les_commandes', 'employe',
    "rpc('fdj_journaliser_ouverture_validee', {",
    "rpc('fdj_journaliser_ouverture', {"],
  ['arguments_conformes_aux_signatures', 'manager',
    'p_shift_id: shift.id, p_lots_payes_grattage: edition.lotsPayes, p_caisse_tirages: edition.caisseTirages,',
    'p_shift_id: shift.id, p_lots_payes_grattage: edition.lotsPayes,'],
  ['arguments_conformes_aux_signatures', 'employe',
    'p_shift_id: shiftRow.id, p_jeux_modifies: jeuxModifies.map(j => j.id),',
    'p_shift_id: shiftRow.id, p_jeux: jeuxModifies.map(j => j.id),'],
  ['actions_dans_la_liste_fermee', 'manager',
    "      p_action: 'exception_ecart_recalcule_revalide',\n      p_motif: \"Écart recalculé",
    "      p_action: 'exception_ecart_revalidee_a6',\n      p_motif: \"Écart recalculé"],
];

let reussis = 0;
const echecs = [];

console.log('=== Contrôles sur les sources réelles ===');
for (const [nom, controle] of Object.entries(CONTROLES)) {
  try { controle(SOURCES); reussis++; console.log(`  ok   ${nom}`); }
  catch (e) { echecs.push(`${nom} : ${e.message}`); console.log(`  ÉCHEC ${nom} : ${e.message}`); }
}

console.log('\n=== Mutations — chaque contrôle visé doit rougir ===');
const vises = new Set();
for (const [nom, cle, ancre, remplacement] of MUTATIONS) {
  const n = SOURCES[cle].split(ancre).length - 1;
  if (n !== 1) { echecs.push(`mutation ${nom}/${cle} : ancre trouvée ${n} fois (1 exigée)`); console.log(`  ÉCHEC ancre ${nom}/${cle} ×${n}`); continue; }
  const mutees = Object.assign({}, SOURCES, { [cle]: SOURCES[cle].replace(ancre, () => remplacement) });
  let rouge = false;
  try { CONTROLES[nom](mutees); } catch (_) { rouge = true; }
  if (rouge) { reussis++; vises.add(nom); console.log(`  ok   ${nom} rougit (${cle})`); }
  else { echecs.push(`${nom} reste vert sous mutation de ${cle}`); console.log(`  ÉCHEC ${nom} reste vert sous mutation (${cle})`); }
}
for (const nom of Object.keys(CONTROLES)) {
  if (!vises.has(nom)) echecs.push(`${nom} : aucune mutation ne le fait rougir`);
}

console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  echecs.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('Tous les tests "A6 écriture directe fermée" passent.');
