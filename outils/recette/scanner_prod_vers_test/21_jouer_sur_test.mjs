#!/usr/bin/env node
// Joue l'import du lot Scanner sur Supabase TEST depuis le poste du pilote. NE S'EXÉCUTE PAS SANS LE GO ÉCRIT DE GUARDIAN ET DU PILOTE.
// Usage : node 21_jouer_sur_test.mjs <dossier-export-09> [--schema] [--pooler]
//   --pooler : passe par le pooler Supabase en mode session (si l'hôte direct, IPv6 seul, est injoignable). Hôte lu dans le trousseau
//              (service nexus-test-pooler, compte nexus), accepté seulement s'il finit par .pooler.supabase.com ; port 5432 ;
//              utilisateur imposé postgres.<ref Test>. La garde décisive reste l'identifiant système vérifié après connexion.
//   --schema : applique d'abord 10_migration_recette_scanner_BROUILLON.sql, dans la MÊME transaction que l'import.
// Prérequis : Node, le paquet « pg » (npm i pg), le mot de passe Test dans le trousseau macOS (service nexus-test-db, compte nexus) ; avec --pooler, l'hôte du pooler (service nexus-test-pooler, compte nexus).
// Le mot de passe et l'URL ne sont ni écrits dans un fichier ni affichés. Sortie : le lot créé et les comptes, rien d'autre.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF_TEST = 'udljdqxerrbbbajxubfn';
const ID_TEST = '7678069749886157684';
const ICI = dirname(fileURLToPath(import.meta.url));
const [dir, ...opts] = process.argv.slice(2);
if (!dir) { console.error('Usage : node 21_jouer_sur_test.mjs <dossier-export-09> [--schema] [--pooler]'); process.exit(2); }
const avecSchema = opts.includes('--schema');
const avecPooler = opts.includes('--pooler');
const inconnues = opts.filter(o => o !== '--schema' && o !== '--pooler');
if (inconnues.length) { console.error('Option inconnue : ' + inconnues.join(' ')); process.exit(2); }

let pg;
try { pg = (await import('pg')).default; } catch { console.error('Paquet « pg » absent : npm i pg'); process.exit(2); }

// Mot de passe lu dans le trousseau, jamais affiché.
let mdp;
try { mdp = execFileSync('security', ['find-generic-password', '-a', 'nexus', '-s', 'nexus-test-db', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch { console.error('Mot de passe Test introuvable dans le trousseau (service nexus-test-db, compte nexus).'); process.exit(2); }
if (!mdp) { console.error('Mot de passe Test vide.'); process.exit(2); }

// Hôte : direct par défaut ; pooler (session, port 5432) avec --pooler. L'utilisateur du pooler est imposé, jamais lu.
let hote, utilisateur;
if (avecPooler) {
  try { hote = execFileSync('security', ['find-generic-password', '-a', 'nexus', '-s', 'nexus-test-pooler', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { console.error('Hôte du pooler introuvable dans le trousseau (service nexus-test-pooler, compte nexus).'); process.exit(2); }
  if (!/^[a-z0-9.-]+\.pooler\.supabase\.com$/i.test(hote)) { console.error('Hôte du pooler refusé : il doit se terminer par .pooler.supabase.com. Rien n\'est envoyé.'); process.exit(2); }
  utilisateur = `postgres.${REF_TEST}`;
} else {
  hote = `db.${REF_TEST}.supabase.co`;
  utilisateur = 'postgres';
}
const url = `postgresql://${utilisateur}:${encodeURIComponent(mdp)}@${hote}:5432/postgres?sslmode=require`;
if (!avecPooler && !url.includes(REF_TEST)) { console.error('URL refusée : ce n\'est pas le projet Test.'); process.exit(2); }

// Génération et vérification (SHA-256, md5 des jeux) par 20_import_lot.mjs ; arrêt sans SQL au moindre écart.
const tmp = mkdtempSync(join(tmpdir(), 'scanner_test_'));
let sqlImport, sqlSchema = '';
try {
  execFileSync('node', [join(ICI, '20_import_lot.mjs'), dir, join(tmp, 'imp.sql')], { stdio: ['ignore', 'ignore', 'inherit'] });
  sqlImport = readFileSync(join(tmp, 'imp.sql'), 'utf8');
  if (avecSchema) sqlSchema = readFileSync(join(ICI, '10_migration_recette_scanner_BROUILLON.sql'), 'utf8');
} catch (e) { console.error('Vérification de l\'export en échec : rien n\'est envoyé.'); rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
rmSync(tmp, { recursive: true, force: true });

const c = new pg.Client({ connectionString: url });
let connecte = false;
try {
  try { await c.connect(); connecte = true; }
  catch (e) {
    const m = String(e.message || e).replace(/postgres(ql)?:\/\/[^@\s]*@/g, 'postgres://***@');
    throw new Error(`connexion impossible (${m})` + (avecPooler ? '' : ' : l\'hôte direct n\'est joignable qu\'en IPv6 ; réessayez avec --pooler'));
  }
  const id = (await c.query('select system_identifier::text as v from pg_control_system()')).rows[0].v;
  if (id !== ID_TEST) throw new Error(`identifiant système ${id} : ce n'est pas le projet Test. Rien n'est écrit.`);
  await c.query('begin');
  if (sqlSchema) await c.query(sqlSchema);
  await c.query(sqlImport);
  const lot = (await c.query('select lot_id from _lot')).rows[0].lot_id;
  const n = async (t) => (await c.query(`select count(*)::int as n from recette_scanner.${t} where lot_id = $1`, [lot])).rows[0].n;
  const comptes = { ventes: await n('ventes'), stock_brut: await n('stock_brut'), declarations: await n('declarations'), jeux: await n('jeux') };
  await c.query('commit');
  console.log(JSON.stringify({ lot_id: lot, schema_applique: !!sqlSchema, comptes }, null, 2));
} catch (e) {
  try { await c.query('rollback'); } catch {}
  console.error('ARRÊT, transaction annulée :', String(e.message || e).replace(/postgres(ql)?:\/\/[^@\s]*@/g, 'postgres://***@'));
  process.exitCode = 1;
} finally { try { await c.end(); } catch {} }
