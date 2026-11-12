// Nettoyage des doublons de products (site vito-sainte-marie) : le script de
// réparation reste prudent. Il ne s'exécute jamais seul et ne sort pas de son cadre.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const racine = __dirname;
const REL = 'supabase/repairs/20261112_nettoyage_doublons_products.sql';
const sql = fs.readFileSync(path.join(racine, REL), 'utf8');
// Code seul : on retire les commentaires de ligne pour ne pas confondre prose et instructions.
const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

t('le script est une réparation manuelle, pas une migration appliquée seule', () => {
  assert.ok(REL.startsWith('supabase/repairs/'));
  const migs = fs.readdirSync(path.join(racine, 'supabase/migrations'));
  assert.ok(!migs.some(f => /nettoyage_doublons_products/.test(f)));
});
t('une seule transaction, ouverte puis validée', () => {
  assert.strictEqual((code.match(/^begin;/gm) || []).length, 1);
  assert.strictEqual((code.match(/^commit;/gm) || []).length, 1);
});
t('les quatre blocs retirés portent leur nombre exact de lignes', () => {
  for (const b of ["'2026-06-01', '2026-06-30', 828", "'2026-07-01', '2026-07-23', 759",
                   "'2026-07-24', '2026-08-06', 709", "'2026-08-07', '2026-08-23', 730"]) {
    assert.ok(code.includes(b), b);
  }
  assert.ok(code.includes('<> 3026'));
});
t('le bloc 01/04 au 30/06 est conservé et vérifié à 1008 lignes', () => {
  assert.ok(/periode_debut = date '2026-04-01' and periode_fin = date '2026-06-30'/.test(code));
  assert.ok(code.includes('<> 1008'));
  assert.ok(!/'2026-04-01',\s*'2026-06-30',\s*\d+\)/.test(code), 'le bloc conservé ne doit pas être une cible');
});
t('chaque lecture et suppression est filtrée par le site', () => {
  assert.ok(code.includes("v_site constant text := 'vito-sainte-marie'"));
  const del = code.slice(code.indexOf('delete from public.products'));
  assert.ok(/p\.site = v_site/.test(del.slice(0, 250)));
});
t('la sauvegarde est faite en base avant la suppression, et fermée aux rôles applicatifs', () => {
  const iSauv = code.indexOf('create table public.products_sauvegarde_20261112');
  const iSupp = code.indexOf('delete from public.products');
  assert.ok(iSauv > 0 && iSupp > iSauv);
  assert.ok(/enable row level security/.test(code));
  assert.ok(/revoke all on public\.products_sauvegarde_20261112 from public, anon, authenticated/.test(code));
});
t('le nombre de lignes sauvegardées est lu juste après la création', () => {
  const i = code.indexOf('create table public.products_sauvegarde_20261112');
  const j = code.indexOf('get diagnostics', i);
  const k = code.indexOf('alter table', i);
  assert.ok(j > 0 && j < k, 'row_count lu après alter/revoke vaudrait 0');
});
t('les tables liées par clé étrangère sont contrôlées avant toute suppression', () => {
  const iFk = code.indexOf("k.contype = 'f'");
  assert.ok(iFk > 0 && iFk < code.indexOf('delete from public.products'));
  assert.ok(/Refus : % référence % ligne/.test(code));
});
t('aucun autre objet n’est modifié ni supprimé', () => {
  assert.ok(!/\b(import_batches|import_rows_raw|import_row_results|campagnes_nexus_imports)\b/.test(code));
  assert.strictEqual((code.match(/\bdelete from\b/g) || []).length, 1);
  assert.ok(!/\b(truncate|update\s+public|drop\s+table\s+public)/i.test(code));
});
t('le contrôle final refuse tout recouvrement de périodes', () => {
  assert.ok(/se recouvrent encore/.test(code));
});

if (echecs) { console.log(echecs + ' échec(s)'); process.exit(1); }
console.log('tout est vert');
