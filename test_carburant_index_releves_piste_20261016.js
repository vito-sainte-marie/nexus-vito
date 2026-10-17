'use strict';

// Épreuve statique de `supabase/migrations/20261016230000_creer_carburant_
// index_releves_piste.sql` — lot Handoff FAST-TRACK-POMPISTE-RELEVES-PISTE-
// 20261016, decision-3.md. Ce canal n'a pas d'accès réseau à Supabase (voir
// l'addendum du 16/10/2026 de MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md) :
// cette épreuve ne remplace donc pas une relecture comportementale sur
// `nexus-test`, elle garde la FORME du fichier déposé, dans l'esprit de
// test_migration_login_production_20261001.js.
//
// Ce qu'elle vérifie, et pourquoi chaque point a été choisi :
//   1. RLS activée sur les quatre tables — une table métier sans RLS est une
//      fuite entre sites, pas un oubli de style.
//   2. Les tables append-only (`carburant_index_valeurs`,
//      `carburant_index_corrections`, `carburant_gnr_statuts`) ne portent
//      AUCUNE policy UPDATE/DELETE pour authenticated — l'absence de policy
//      est la garantie, pas la discipline applicative (SEC-002, même
//      principe que carburant_releve_versions).
//   3. Les deux RPC sont SECURITY DEFINER, fixent search_path, et révoquent
//      explicitement anon/public avec un marqueur nexus-acl-intention pour
//      authenticated — la leçon du lot anon5 (04/10/2026) appliquée dès
//      l'écriture, pas corrigée après coup.
//   4. L'isolation de site sur les tables filles est héritée par trigger
//      (`site` n'est jamais une colonne que l'appelant renseigne), pas
//      recopiée à la main à chaque policy.
//   5. La correction d'un index annule systématiquement `recopiee` (brief
//      §8) et exige un motif non vide.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FICHIER = path.join(__dirname, 'supabase', 'migrations', '20261016230000_creer_carburant_index_releves_piste.sql');
const sql = fs.readFileSync(FICHIER, 'utf8');
const sqlMin = sql.toLowerCase();

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

const TABLES = ['carburant_index_releves', 'carburant_index_valeurs', 'carburant_index_corrections', 'carburant_gnr_statuts'];
const TABLES_APPEND_ONLY = ['carburant_index_valeurs', 'carburant_index_corrections', 'carburant_gnr_statuts'];

testSync('les quatre tables sont créées', () => {
  TABLES.forEach(t => {
    assert.ok(new RegExp(`create table if not exists ${t}\\s*\\(`, 'i').test(sql), `table ${t} absente`);
  });
});

testSync('RLS activée sur les quatre tables', () => {
  TABLES.forEach(t => {
    assert.ok(new RegExp(`alter table ${t} enable row level security`, 'i').test(sql), `RLS absente sur ${t}`);
  });
});

testSync('chaque table append-only ne porte aucune policy UPDATE/DELETE', () => {
  TABLES_APPEND_ONLY.forEach(t => {
    // Une policy porte explicitement "for update"/"for delete" : vérifier
    // qu'aucune de ces deux formes ne cible cette table précise. On isole le
    // bloc de la table en coupant au nom de table suivant pour ne pas
    // laisser une policy d'une autre table contaminer la mesure.
    const debut = sqlMin.indexOf(`create table if not exists ${t} (`);
    assert.ok(debut >= 0, `bloc ${t} introuvable`);
    const indexSuivants = TABLES
      .filter(autre => autre !== t)
      .map(autre => sqlMin.indexOf(`create table if not exists ${autre} (`, debut + 1))
      .filter(i => i > debut);
    const rpcIndex = sqlMin.indexOf('create or replace function public.carburant_index_corriger_valeur', debut + 1);
    const bornes = [...indexSuivants, rpcIndex === -1 ? sqlMin.length : rpcIndex, sqlMin.length].filter(i => i > debut);
    const fin = Math.min(...bornes);
    const bloc = sqlMin.slice(debut, fin);
    assert.ok(!/for update/.test(bloc), `policy UPDATE trouvée dans le bloc ${t}`);
    assert.ok(!/for delete/.test(bloc), `policy DELETE trouvée dans le bloc ${t}`);
  });
});

testSync('carburant_index_releves porte une policy UPDATE bornée (brouillon ou manager), jamais DELETE', () => {
  assert.ok(/create policy modification_pompiste_brouillon_ou_manager on carburant_index_releves\s*\n\s*for update/.test(sqlMin));
  assert.ok(/statut = 'brouillon'/.test(sqlMin), 'la restriction au brouillon doit figurer dans la policy UPDATE');
  const debut = sqlMin.indexOf('create table if not exists carburant_index_releves (');
  const fin = sqlMin.indexOf('create table if not exists carburant_index_valeurs (');
  const bloc = sqlMin.slice(debut, fin);
  assert.ok(!/for delete/.test(bloc), 'aucune policy DELETE attendue sur carburant_index_releves');
});

testSync('site est hérité par trigger sur les deux tables filles qui le portent', () => {
  ['carburant_index_valeurs', 'carburant_index_corrections'].forEach(t => {
    assert.ok(new RegExp(`create trigger ${t}_heriter_site\\s*\\n\\s*before insert on ${t}`, 'i').test(sql), `trigger d'héritage absent sur ${t}`);
  });
});

testSync('les deux RPC sont SECURITY DEFINER avec search_path fixé', () => {
  ['carburant_index_corriger_valeur', 'carburant_index_marquer_recopiee'].forEach(fn => {
    const i = sqlMin.indexOf(`create or replace function public.${fn}(`);
    assert.ok(i >= 0, `fonction ${fn} absente`);
    const bloc = sqlMin.slice(i, i + 800);
    assert.ok(/security definer/.test(bloc), `${fn} doit être security definer`);
    assert.ok(/set search_path to 'public'/.test(bloc), `${fn} doit fixer search_path`);
  });
});

testSync('les deux RPC révoquent public/anon et déclarent authenticated par un marqueur', () => {
  const sigs = [
    'carburant_index_corriger_valeur(uuid, text, text, boolean, text, boolean)',
    'carburant_index_marquer_recopiee(uuid, boolean)',
  ];
  sigs.forEach(sig => {
    const sigEchap = sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.ok(new RegExp(`revoke all on function public\\.${sigEchap} from public, anon`, 'i').test(sql), `revoke manquant pour ${sig}`);
    assert.ok(new RegExp(`grant execute on function public\\.${sigEchap} to authenticated`, 'i').test(sql), `grant authenticated manquant pour ${sig}`);
    assert.ok(new RegExp(`nexus-acl-intention:\\s*public\\.${sigEchap}\\s+garde\\s+authenticated\\s*\\(`, 'i').test(sql), `marqueur nexus-acl-intention manquant pour ${sig}`);
  });
});

testSync('la correction annule systématiquement recopiee et exige un motif', () => {
  const i = sqlMin.indexOf('create or replace function public.carburant_index_corriger_valeur(');
  const fin = sqlMin.indexOf('comment on function public.carburant_index_corriger_valeur', i);
  const corps = sqlMin.slice(i, fin);
  assert.ok(/motif_requis/.test(corps), 'le motif vide doit être refusé (MOTIF_REQUIS)');
  assert.ok(/recopiee = false/.test(corps), 'la correction doit annuler recopiee');
  assert.ok(/recopiee_le = null/.test(corps) && /recopiee_par = null/.test(corps), 'la correction doit vider recopiee_le/recopiee_par');
  assert.ok(/insert into carburant_index_corrections/.test(corps), 'la correction doit tracer dans carburant_index_corrections');
});

testSync('aucune donnée n\'est semée (pas d\'INSERT hors des deux triggers de la migration elle-même)', () => {
  // Les deux seuls "insert into" attendus dans tout le fichier sont celui du
  // corps de carburant_index_corriger_valeur (trace de correction, exécuté
  // au moment d'un appel, jamais au moment de la migration) — aucun INSERT
  // de données de référence (ex. l'index GNR 1191213) ne doit apparaître.
  const sansCommentaires = sql.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
  assert.ok(!/1191213/.test(sansCommentaires), 'la valeur de référence GNR ne doit pas être écrite en dur (hors commentaire) par cette migration');
  const inserts = sql.match(/^\s*insert into/gim) || [];
  assert.strictEqual(inserts.length, 1, `une seule ligne "insert into" attendue (trace de correction), ${inserts.length} trouvée(s)`);
});

testSync('les contraintes de format 7/6 chiffres sont présentes', () => {
  assert.ok(/valeur_sept_chiffres ~ '\^\[0-9\]\{7\}\$'/.test(sql));
  assert.ok(/valeur_decenium ~ '\^\[0-9\]\{6\}\$'/.test(sql));
});

if (process.exitCode) {
  console.error('\nÉchec de test_carburant_index_releves_piste_20261016.js');
} else {
  console.log('\nTout est vert — test_carburant_index_releves_piste_20261016.js');
}
