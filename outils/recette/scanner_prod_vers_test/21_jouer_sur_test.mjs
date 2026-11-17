#!/usr/bin/env node
// Joue l'import du lot Scanner sur Supabase TEST depuis le poste du pilote. NE S'EXÉCUTE PAS SANS LE GO ÉCRIT DE GUARDIAN ET DU PILOTE.
// Usage : node 21_jouer_sur_test.mjs <dossier-export-09> [--schema]
//   --schema : applique d'abord 10_migration_recette_scanner_BROUILLON.sql, dans la MÊME transaction que l'import.
// Prérequis : Node, le paquet « pg » (npm i pg), le mot de passe Test dans le trousseau macOS (service nexus-test-db, compte nexus).
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
if (!dir) { console.error('Usage : node 21_jouer_sur_test.mjs <dossier-export-09> [--schema]'); process.exit(2); }
const avecSchema = opts.includes('--schema');

let pg;
try { pg = (await import('pg')).default; } catch { console.error('Paquet « pg » absent : npm i pg'); process.exit(2); }

// Mot de passe lu dans le trousseau, jamais affiché.
let mdp;
try { mdp = execFileSync('security', ['find-generic-password', '-a', 'nexus', '-s', 'nexus-test-db', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch { console.error('Mot de passe Test introuvable dans le trousseau (service nexus-test-db, compte nexus).'); process.exit(2); }
if (!mdp) { console.error('Mot de passe Test vide.'); process.exit(2); }

// URL directe construite à partir de la référence Test constante ; tout autre projet est refusé avant la connexion.
const hote = `db.${REF_TEST}.supabase.co`;
const url = `postgresql://postgres:${encodeURIComponent(mdp)}@${hote}:5432/postgres?sslmode=require`;
if (!url.includes(REF_TEST)) { console.error('URL refusée : ce n\'est pas le projet Test.'); process.exit(2); }

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
try {
  await c.connect();
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
