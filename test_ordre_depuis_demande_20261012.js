// E3 de NEXUS-EXECUTOR-SUPABASE-1 — `handoff.js demande` génère l'ordre typé et désigne l'exécutant.
//
// PROPRIÉTÉS (preuve de CÂBLAGE : on lance le vrai CLI, puis on le débranche) :
//   A. Pur : une migration ajoutée + cible désignée → un ordre valide, exécutant désigné, rien d'autre.
//   B. Refus sans écriture : cible non désignée, migration modifiée, nom invalide, chemin suspect,
//      mesure mal formée, retour arrière absent, expiration hors bornes, geste sans exécutant.
//   C. Rétro-compatible : sans --depuis aucune détection ; --cible-env seul est refusé.
//   D. CLI réel : migrations réelles du dépôt (2dfc1bc) → order-N-k.json, preuves de l'enveloppe, hash concordant.
//   E. Un ordre n'est pas une autorisation (autoriser sans GO refuse) ; `verifier` reste vert avec des order-*.json.
//   F. Mutation « débrancher le câblage » : le CLI sans l'appel n'écrit aucun ordre → l'épreuve D rougit.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { execFileSync } = require('child_process');
const { preparer } = require('./outils/preparer-ordres');
const { chargerRegistre, routerGeste } = require('./outils/capacites-canal');
const O = require('./outils/ordre-execution');

const RACINE = __dirname, OUTIL = path.join(RACINE, 'outils', 'handoff.js'), MUT = path.join(RACINE, 'outils', '.mut-handoff.js');
const reg = chargerRegistre(RACINE), MAINT = new Date('2026-10-12T12:00:00Z');
const BLOB = 'a'.repeat(40), COMMIT = 'b'.repeat(40);
const CH = 'supabase/migrations/20261012000000_exemple.sql';
const io = (chg) => ({ changements: () => chg, blob: () => BLOB, commit: () => COMMIT });
const base = { depuis: 'ref', cibleEnv: 'test', preconditions: ['registre_taille=310'], postconditions: ['registre_taille=311'], retourArriere: 'aucun, justifié : additive' };
const prep = (chg, opts = {}, canal = 'github-actions-claude') => preparer({ reg, io: io(chg), opts: { ...base, ...opts }, lot: 'LOT-X', seq: 3, canal, maintenant: MAINT });
let n = 0; const ok = (m) => { n++; console.log(`  ✅ ${m}`); };

// A
let r = prep([{ statut: 'A', chemin: CH }]);
assert.deepStrictEqual(r.erreurs, []); assert.strictEqual(r.ordres.length, 1);
assert.strictEqual(r.ordres[0].fichier, 'order-3-1.json');
assert.deepStrictEqual(O.valider(r.ordres[0].ordre, { maintenant: MAINT }), []);
assert.strictEqual(r.ordres[0].ordre.artefact.blob, BLOB);
assert.strictEqual(r.ordres[0].route.geste, 'SUPABASE_TEST_MIGRATION');
assert.strictEqual(r.ordres[0].route.capacite, 'SUPABASE_TEST_ECRITURE');
assert.strictEqual(r.ordres[0].route.executant, 'session-claude-habilitee', 'A: le canal incapable désigne l\'exécutant habilité');
ok('A — migration ajoutée → ordre valide + exécutant habilité désigné (canal CI incapable)');
r = prep([{ statut: 'A', chemin: CH }, { statut: 'A', chemin: 'supabase/migrations/20261012000100_autre.sql' }, { statut: 'M', chemin: 'index.html' }]);
assert.strictEqual(r.ordres.length, 2, 'A: un ordre par migration, les autres fichiers ignorés');
assert.notStrictEqual(r.ordres[0].ordre.operation_hash, r.ordres[1].ordre.operation_hash);
ok('A — un ordre par migration, hashs distincts, fichiers hors migrations ignorés');
r = prep([{ statut: 'A', chemin: CH }], { cibleEnv: 'production' });
assert.strictEqual(r.ordres[0].ordre.cible.project_ref, O.ENVS.production);
assert.strictEqual(r.ordres[0].route.capacite, 'SUPABASE_PRODUCTION_ECRITURE');
assert.strictEqual(O.autoriser(r.ordres[0].ordre, null, { habilites: { production: ['vito-sainte-marie'] }, maintenant: MAINT })[0], 'GO_ABSENT', 'E: un ordre n\'est pas une autorisation');
ok('A/E — Production : ordre produit, mais sans GO lié au hash rien ne s\'autorise');

// B
const refus = (chg, opts, motif, msg, canal) => { const x = prep(chg, opts, canal); assert.ok(x.erreurs.some((e) => e.includes(motif)), `${msg} : attendu ${motif}, obtenu ${JSON.stringify(x.erreurs)}`); assert.ok(!x.ordres || !x.ordres.length, `${msg}: aucun ordre`); };
refus([{ statut: 'A', chemin: CH }], { cibleEnv: undefined }, 'CIBLE_NON_DESIGNEE', 'B cible');
refus([{ statut: 'M', chemin: CH }], {}, 'MIGRATION_IMMUABLE', 'B modifiée');
refus([{ statut: 'D', chemin: CH }], {}, 'MIGRATION_IMMUABLE', 'B supprimée');
refus([{ statut: 'A', chemin: 'supabase/migrations/Mauvais-Nom.sql' }], {}, 'MIGRATION_NOM_INVALIDE', 'B nom');
refus([{ statut: 'A', chemin: 'supabase/migrations/../x.sql' }], {}, 'CHEMIN_SUSPECT', 'B chemin');
refus([{ statut: 'A', chemin: CH }], { preconditions: ['select 1; drop table x=1'] }, 'ORDRE_INVALIDE', 'B mesure hors grammaire');
refus([{ statut: 'A', chemin: CH }], { preconditions: ['sansegal'] }, 'cle=valeur', 'B mesure mal formée');
refus([{ statut: 'A', chemin: CH }], { preconditions: ['registre_taille=1', 'registre_taille=2'] }, 'en double', 'B mesure en double');
refus([{ statut: 'A', chemin: CH }], { retourArriere: undefined }, '--retour-arriere', 'B retour arrière');
refus([{ statut: 'A', chemin: CH }], { expireHeures: '0' }, '--expire-heures', 'B expiration nulle');
refus([{ statut: 'A', chemin: CH }], { expireHeures: '9999' }, '--expire-heures', 'B expiration démesurée');
const regSans = JSON.parse(JSON.stringify(reg));
for (const c of Object.values(regSans.canaux || {})) if (c.capacites) c.capacites.SUPABASE_TEST_ECRITURE = 'NON';
const sansExec = preparer({ reg: regSans, io: io([{ statut: 'A', chemin: CH }]), opts: base, lot: 'L', seq: 1, canal: 'github-actions-claude', maintenant: MAINT });
assert.ok(sansExec.erreurs.some((e) => e.includes('CAPACITE_SANS_EXECUTANT')), 'B: personne n\'est capable → seul vrai blocage');
ok('B — treize refus codés, aucun ordre produit dans chaque cas');

// C
assert.deepStrictEqual(preparer({ reg, io: io([{ statut: 'A', chemin: CH }]), opts: {}, lot: 'L', seq: 1, canal: 'x' }), { ordres: [], erreurs: [] });
assert.ok(preparer({ reg, io: io([]), opts: { cibleEnv: 'test' }, lot: 'L', seq: 1, canal: 'x' }).erreurs.length, 'C: --cible-env sans --depuis refusé');
assert.deepStrictEqual(prep([{ statut: 'M', chemin: 'index.html' }]), { ordres: [], erreurs: [] }, 'C: aucune migration → aucun ordre');
ok('C — sans --depuis rien n\'est détecté ; cible seule refusée ; diff sans migration → rien');

// D (CLI réel)
const REF = execFileSync('git', ['rev-parse', '2dfc1bc~1'], { cwd: RACINE, encoding: 'utf8' }).trim();
const LOT = 'LOT-E3-EPREUVE-20261012';
function registre() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-e3-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lots: { [LOT]: { statut: 'DECISION_CONSOMMEE', rail: 'handoff-continuite-20260920' } } }, null, 2) + '\n');
  return dir;
}
function cli(outil, dir, args) {
  const corps = path.join(dir, '.corps.md'); fs.writeFileSync(corps, 'Demande d\'épreuve E3.\n');
  try { return { code: 0, sortie: execFileSync('node', [outil, 'demande', LOT, corps, '--rail', 'handoff-continuite-20260920', ...args], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir, NEXUS_CANAL: 'github-actions-claude' } }) }; }
  catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}
const ARGS = ['--depuis', REF, '--cible-env', 'test', '--precondition', 'registre_taille=310', '--postcondition', 'registre_taille=312', '--retour-arriere', 'aucun, justifié : additive'];
const ordres = (dir) => fs.existsSync(path.join(dir, 'lots', LOT)) ? fs.readdirSync(path.join(dir, 'lots', LOT)).filter((f) => /^order-.*\.json$/.test(f)).sort() : [];
let dir = registre(); let x = cli(OUTIL, dir, ARGS);
assert.strictEqual(x.code, 0, `D: le CLI doit réussir\n${x.sortie}`);
const fich = ordres(dir); assert.ok(fich.length >= 2, `D: au moins les deux migrations de 2dfc1bc (obtenu ${fich})`);
const env = fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8');
for (const [i, f] of fich.entries()) {
  const ordre = JSON.parse(fs.readFileSync(path.join(dir, 'lots', LOT, f), 'utf8'));
  assert.deepStrictEqual(O.valider(ordre, { maintenant: new Date(ordre.cree_le) }), [], `D: ${f} valide`);
  assert.strictEqual(ordre.artefact.blob, execFileSync('git', ['rev-parse', `HEAD:${ordre.artefact.chemin}`], { cwd: RACINE, encoding: 'utf8' }).trim(), 'D: blob = HEAD:chemin');
  assert.ok(env.includes(`id: ordre-1-${i + 1}`) && env.includes(ordre.operation_hash), `D: l'enveloppe cite le hash de ${f}`);
  assert.ok(env.includes(`id: executant-1-${i + 1}`) && env.includes('session-claude-habilitee-pour-SUPABASE_TEST_ECRITURE'), 'D: exécutant désigné dans l\'enveloppe');
}
assert.ok(/CAPACITE_REQUISE SUPABASE_TEST_ECRITURE, EXECUTANT_NEXT session-claude-habilitee/.test(x.sortie), 'D: désignation affichée');
const v = execFileSync('node', [OUTIL, 'verifier'], { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
ok(`D — CLI réel : ${fich.length} ordres écrits, enveloppe concordante, exécutant désigné ; verifier reste vert avec des order-*.json`);
// Refus CLI : rien n'est écrit
dir = registre(); x = cli(OUTIL, dir, ARGS.filter((_, i) => i !== 2 && i !== 3));
assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /CIBLE_NON_DESIGNEE/); assert.strictEqual(ordres(dir).length, 0);
assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT, 'request-1.md')), 'D: refus → pas de request');
dir = registre(); x = cli(OUTIL, dir, ['--depuis', 'refinexistante', '--cible-env', 'test']);
assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /n'est pas une ref résolvable/);
dir = registre(); x = cli(OUTIL, dir, []);
assert.strictEqual(x.code, 0); assert.strictEqual(ordres(dir).length, 0, 'C: CLI sans --depuis = comportement historique');
ok('D — refus CLI sans écriture (cible non désignée, ref inconnue) ; sans --depuis comportement historique');

// F : débrancher le câblage
const src = fs.readFileSync(OUTIL, 'utf8');
const cible = '  const ordresPrepares = preparerOrdresDeLaDemande(lot, seq, options);';
assert.strictEqual(src.split(cible).length, 2, 'F: ancre de mutation unique');
fs.writeFileSync(MUT, src.replace(cible, '  const ordresPrepares = [];'));
try {
  dir = registre(); x = cli(MUT, dir, ARGS);
  assert.strictEqual(ordres(dir).length, 0, 'F: câblage débranché → aucun ordre : l\'épreuve D rougirait');
  ok('F — mutation « débrancher le câblage » : plus aucun ordre, l\'épreuve D le verrait');
} finally { fs.rmSync(MUT, { force: true }); }

console.log(`\nordre depuis demande : ${n} groupes d'épreuves passés.`);
