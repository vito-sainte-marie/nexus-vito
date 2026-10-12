// Détection d'opération par nature d'artefact (NEXUS-EXECUTOR-SUPABASE-1, E2).
//   A. Migration ajoutée + cible explicite → MIGRATION_APPLY routée vers la capacité d'écriture du bon env.
//   B. Cible absente/inconnue → refus CIBLE_NON_DESIGNEE (jamais de défaut Production).
//   C. Migration modifiée/supprimée/renommée → MIGRATION_IMMUABLE ; nom invalide → MIGRATION_NOM_INVALIDE ; chemin suspect refusé.
//   D. Fichiers hors supabase/migrations ignorés (la prose et le reste du diff ne déclenchent rien).
//   E. Canal incapable → délégation vers un exécutant ; aucun exécutant → CAPACITE_SANS_EXECUTANT.
//   F. Câblage : geste absent de la table `gestes` → GESTE_INCONNU ; « débrancher l'aide » (le module n'interroge plus la table) fait rougir l'épreuve.
//   G. Tout geste du module existe dans le registre réel.
const assert = require('assert'), fs = require('fs'), path = require('path');
const D = require('./outils/detecter-operation');
const { routerGeste } = require('./outils/capacites-canal');
const reg = JSON.parse(fs.readFileSync('docs/handoff/CAPACITES-CANAL.json', 'utf8'));
const M = 'supabase/migrations/20261012000000_exemple.sql';
const has = (r, code) => assert.ok(r.refus.some((x) => x.code === code), `attendu ${code}, obtenu ${JSON.stringify(r.refus)}`);

// A
let r = D.router(reg, [{ statut: 'A', chemin: M }], 'production', 'frederic', routerGeste);
assert.strictEqual(r.routes.length, 1); assert.strictEqual(r.routes[0].geste, 'SUPABASE_PRODUCTION_MUTATION');
assert.strictEqual(r.routes[0].capacite, 'SUPABASE_PRODUCTION_ECRITURE'); assert.strictEqual(r.bloque, false); assert.strictEqual(r.delegue, false);
r = D.router(reg, [{ statut: 'A', chemin: M }], 'test', 'frederic', routerGeste);
assert.strictEqual(r.routes[0].capacite, 'SUPABASE_TEST_ECRITURE');
assert.strictEqual(r.routes[0].operation, 'MIGRATION_APPLY');
// B
for (const e of [undefined, '', 'staging', 'constructor', '__proto__']) has(D.router(reg, [{ statut: 'A', chemin: M }], e, 'frederic', routerGeste), 'CIBLE_NON_DESIGNEE');
// C
for (const s of ['M', 'D', 'R']) has(D.router(reg, [{ statut: s, chemin: M }], 'test', 'frederic', routerGeste), 'MIGRATION_IMMUABLE');
has(D.router(reg, [{ statut: 'A', chemin: 'supabase/migrations/mauvais.sql' }], 'test', 'frederic', routerGeste), 'MIGRATION_NOM_INVALIDE');
has(D.router(reg, [{ statut: 'A', chemin: 'supabase/migrations/20261012000000_X.sql' }], 'test', 'frederic', routerGeste), 'MIGRATION_NOM_INVALIDE');
has(D.router(reg, [{ statut: 'A', chemin: 'supabase/migrations/../x.sql' }], 'test', 'frederic', routerGeste), 'CHEMIN_SUSPECT');
// D
r = D.router(reg, [{ statut: 'A', chemin: 'docs/x.md' }, { statut: 'M', chemin: 'outils/handoff.js' }], 'production', 'frederic', routerGeste);
assert.deepStrictEqual([r.routes.length, r.refus.length, r.bloque], [0, 0, false]);
// E
r = D.router(reg, [{ statut: 'A', chemin: M }], 'production', 'github-actions-claude', routerGeste);
assert.strictEqual(r.delegue, true); assert.ok(r.routes[0].executant, 'exécutant désigné'); assert.strictEqual(r.routes[0].etat, 'CHANNEL_LIMITATION');
assert.strictEqual(r.bloque, false);
const sansExec = JSON.parse(JSON.stringify(reg));
for (const c of Object.values(sansExec.canaux)) c.capacites.SUPABASE_PRODUCTION_ECRITURE && (c.capacites.SUPABASE_PRODUCTION_ECRITURE = { ...c.capacites.SUPABASE_PRODUCTION_ECRITURE, valeur: 'NON' });
r = D.router(sansExec, [{ statut: 'A', chemin: M }], 'production', 'github-actions-claude', routerGeste);
assert.ok(r.bloque, 'personne ne peut : blocage réel');
// F
const sansGeste = JSON.parse(JSON.stringify(reg)); delete sansGeste.gestes.SUPABASE_TEST_MIGRATION;
has(D.router(sansGeste, [{ statut: 'A', chemin: M }], 'test', 'frederic', routerGeste), 'GESTE_INCONNU');
const src = fs.readFileSync('./outils/detecter-operation.js', 'utf8');
const debranche = src.replace('const r = routerGeste(reg, geste, canal);', "const r = { geste, capacite: 'X', etat: 'OK', executant: 'frederic' };");
assert.notStrictEqual(debranche, src, 'F: la mutation doit s\'appliquer');
const tmp = path.join(__dirname, 'outils', '.mut-detecter.js'); fs.writeFileSync(tmp, debranche);
try {
  const Mu = require(tmp);
  const rm = Mu.router(sansGeste, [{ statut: 'A', chemin: M }], 'test', 'frederic', routerGeste);
  assert.ok(!rm.refus.some((x) => x.code === 'GESTE_INCONNU'), 'F: aide débranchée, la table n\'est plus consultée');
} finally { fs.unlinkSync(tmp); }
// G
for (const t of Object.values(D.GESTES)) for (const g of Object.values(t)) assert.ok(reg.gestes[g], `G: ${g} absent du registre`);
console.log('detecter-operation : propriétés A–G tiennent');
