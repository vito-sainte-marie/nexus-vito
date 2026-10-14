// E3 de NEXUS-EXECUTOR-SUPABASE-1 — `handoff.js demande` génère l'ordre typé et désigne l'exécutant.
//
// PROPRIÉTÉS (preuve de CÂBLAGE : on lance le vrai CLI, puis on le débranche) :
//   A. Pur : une migration ajoutée + cible désignée → un ordre valide, exécutant désigné, rien d'autre.
//   B. Refus sans écriture : cible non désignée, migration modifiée, nom invalide, chemin suspect,
//      mesure mal formée, retour arrière absent, expiration hors bornes, geste sans exécutant.
//   C. Rétro-compatible : sans --depuis aucune détection ; --cible-env seul est refusé.
//   D. CLI réel, dans un clone jetable (code de travail + un commit d'une migration) → order-N-1.json, preuves de
//      l'enveloppe, hash concordant ; sur le dépôt réel, 2dfc1bc (deux migrations) est refusé sans rien écrire.
//   E. Un ordre n'est pas une autorisation (autoriser sans GO refuse) ; `verifier` reste vert avec des order-*.json.
//   F. Mutation « débrancher le câblage » : le CLI sans l'appel n'écrit aucun ordre → l'épreuve D rougit.
'use strict';
// Des épreuves de mutation écrivent brièvement .mut-*.js dans le vrai outils/ : une copie
// concurrente les voit disparaître (ENOENT). Aucun fichier suivi ne commence par un point.
const horsMutants = (src) => !require('path').basename(src).startsWith('.');
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
const base = { depuis: 'ref', cibleEnv: 'test', preconditions: ['registre_taille=310', 'registre_derniere_version=20261011000000'], postconditions: ['registre_taille=311', 'registre_derniere_version=20261012000000'], retourArriere: 'aucun, justifié : additive' };
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
r = prep([{ statut: 'A', chemin: CH }, { statut: 'M', chemin: 'index.html' }]);
assert.deepStrictEqual(r.erreurs, []); assert.strictEqual(r.ordres.length, 1, 'A: les fichiers hors migrations sont ignorés');
// Point 5 de l'audit : pré/postconditions décrivent UNE opération. Deux migrations dans une demande = refus, sinon
// l'ordre 2 attendrait l'état d'avant l'ordre 1 et ne pourrait jamais s'exécuter.
const DEUX = [{ statut: 'A', chemin: CH }, { statut: 'A', chemin: 'supabase/migrations/20261012000100_autre.sql' }];
r = prep(DEUX);
assert.ok(!r.ordres || !r.ordres.length, 'A: deux migrations → aucun ordre');
assert.ok(r.erreurs.some((e) => e.includes('DEMANDE_MULTI_OPERATIONS (2 : ') && e.includes('une seule migration par demande')), `A: refus codé, obtenu ${JSON.stringify(r.erreurs)}`);
{
  const SRCP = fs.readFileSync(path.join(RACINE, 'outils', 'preparer-ordres.js'), 'utf8');
  const ancre = "  if (operations.length > 1) return { erreurs: [";
  assert.strictEqual(SRCP.split(ancre).length, 2, 'A: ancre de mutation unique');
  const t = path.join(RACINE, 'outils', '.mut-preparer.js');
  fs.writeFileSync(t, SRCP.replace(ancre, '  if (false) return { erreurs: ['));
  try {
    const x = require(t).preparer({ reg, io: io(DEUX), opts: base, lot: 'LOT-X', seq: 3, canal: 'github-actions-claude', maintenant: MAINT });
    // Sans la garde : l'ordre 1 sort, l'ordre 2 tombe sur la version du registre (point 6) — demande partielle, sans le code.
    assert.strictEqual(x.ordres.length, 1, 'mutation : sans la garde, un ordre sort d\'une demande à deux migrations');
    assert.ok(x.erreurs.some((e) => e.startsWith('ORDRE_INVALIDE [POSTCONDITION_INSUFFISANTE]')), `mutation : ordre 2 refusé par la version, obtenu ${JSON.stringify(x.erreurs)}`);
    assert.ok(!x.erreurs.some((e) => e.includes('DEMANDE_MULTI_OPERATIONS')), 'mutation : le code disparaît avec la garde');
  } finally { fs.rmSync(t, { force: true }); }
}
ok('A — une migration par demande : deux → DEMANDE_MULTI_OPERATIONS, aucun ordre ; mutation « retirer la garde » → demande partielle (1 ordre, ordre 2 refusé par la version)');
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

// D (CLI réel). Aucune ref du dépôt n'ajoute UNE seule migration jusqu'à HEAD (2dfc1bc en ajoute deux) : on rejoue
// le vrai CLI dans un clone jetable qui porte le code en cours d'épreuve et un commit d'une migration.
const CLONE = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-e3-clone-'));
process.on('exit', () => fs.rmSync(CLONE, { recursive: true, force: true }));
const gitC = (...a) => execFileSync('git', ['-c', 'user.name=epreuve-e3', '-c', 'user.email=epreuve-e3@invalid', '-c', 'commit.gpgsign=false', '-C', CLONE, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, CLONE], { stdio: 'ignore' });
gitC('checkout', '-q', '--detach', execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8' }).trim());
fs.cpSync(path.join(RACINE, 'outils'), path.join(CLONE, 'outils'), { recursive: true, filter: horsMutants });
// Le clone a RACINE pour origin : ses origin/* sont les branches LOCALES de RACINE, absentes en CI (seules les
// refs distantes y existent). handoff.js lit origin/main et origin/production : on les recopie depuis RACINE.
for (const b of ['main', 'production']) {
  const sha = execFileSync('git', ['rev-parse', `refs/remotes/origin/${b}`], { cwd: RACINE, encoding: 'utf8' }).trim();
  gitC('update-ref', `refs/remotes/origin/${b}`, sha);
}
const REF = gitC('rev-parse', 'HEAD');
const CH_CLONE = 'supabase/migrations/20261012000000_epreuve_e3.sql';
fs.writeFileSync(path.join(CLONE, CH_CLONE), '-- épreuve E3 : jamais appliquée\nselect 1;\n');
gitC('add', CH_CLONE); gitC('commit', '-q', '-m', 'épreuve E3 : une migration');
const OUTIL_CLONE = path.join(CLONE, 'outils', 'handoff.js'), MUT_CLONE = path.join(CLONE, 'outils', '.mut-handoff.js');
const LOT = 'LOT-E3-EPREUVE-20261012';
function registre() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-e3-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lots: { [LOT]: { statut: 'DECISION_CONSOMMEE', rail: 'handoff-continuite-20260920' } } }, null, 2) + '\n');
  return dir;
}
function cli(outil, dir, args) {
  const corps = path.join(dir, '.corps.md'); fs.writeFileSync(corps, 'Demande d\'épreuve E3.\n');
  try { return { code: 0, sortie: execFileSync('node', [outil, 'demande', LOT, corps, '--rail', 'handoff-continuite-20260920', ...args], { cwd: path.resolve(path.dirname(outil), '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir, NEXUS_CANAL: 'github-actions-claude' } }) }; }
  catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}
const ARGS = ['--depuis', REF, '--cible-env', 'test', '--precondition', 'registre_taille=310', '--postcondition', 'registre_taille=311', '--postcondition', 'registre_derniere_version=20261012000000', '--retour-arriere', 'aucun, justifié : additive'];
const ordres = (dir) => fs.existsSync(path.join(dir, 'lots', LOT)) ? fs.readdirSync(path.join(dir, 'lots', LOT)).filter((f) => /^order-.*\.json$/.test(f)).sort() : [];
let dir = registre(); let x = cli(OUTIL_CLONE, dir, ARGS);
assert.strictEqual(x.code, 0, `D: le CLI doit réussir\n${x.sortie}`);
const fich = ordres(dir); assert.deepStrictEqual(fich, ['order-1-1.json'], `D: exactement un ordre pour la migration du clone (obtenu ${fich})`);
const env = fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8');
for (const [i, f] of fich.entries()) {
  const ordre = JSON.parse(fs.readFileSync(path.join(dir, 'lots', LOT, f), 'utf8'));
  assert.deepStrictEqual(O.valider(ordre, { maintenant: new Date(ordre.cree_le) }), [], `D: ${f} valide`);
  assert.strictEqual(ordre.artefact.chemin, CH_CLONE); assert.strictEqual(ordre.artefact.blob, gitC('rev-parse', `HEAD:${ordre.artefact.chemin}`), 'D: blob = HEAD:chemin');
  assert.ok(env.includes(`id: ordre-1-${i + 1}`) && env.includes(ordre.operation_hash), `D: l'enveloppe cite le hash de ${f}`);
  assert.ok(env.includes(`id: executant-1-${i + 1}`) && env.includes('session-claude-habilitee-pour-SUPABASE_TEST_ECRITURE'), 'D: exécutant désigné dans l\'enveloppe');
}
assert.ok(/CAPACITE_REQUISE SUPABASE_TEST_ECRITURE, EXECUTANT_NEXT session-claude-habilitee/.test(x.sortie), 'D: désignation affichée');
const v = execFileSync('node', [OUTIL, 'verifier'], { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
ok(`D — CLI réel (clone jetable) : ${fich.length} ordre écrit, enveloppe concordante, exécutant désigné ; verifier reste vert avec des order-*.json`);
// Sur le dépôt réel : 2dfc1bc ajoute deux migrations → refus codé, ni ordre ni request.
dir = registre(); x = cli(OUTIL, dir, ['--depuis', execFileSync('git', ['rev-parse', '2dfc1bc~1'], { cwd: RACINE, encoding: 'utf8' }).trim(), ...ARGS.slice(2)]);
assert.notStrictEqual(x.code, 0, `D: deux migrations doivent être refusées\n${x.sortie}`); assert.match(x.sortie, /une seule migration par demande/);
assert.strictEqual(ordres(dir).length, 0); assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT, 'request-1.md')), 'D: refus multi → pas de request');
ok('D — CLI réel sur 2dfc1bc (deux migrations) : refusé, aucun ordre, aucune request');
// Refus CLI : rien n'est écrit
dir = registre(); x = cli(OUTIL_CLONE, dir, ARGS.filter((_, i) => i !== 2 && i !== 3));
assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /CIBLE_NON_DESIGNEE/); assert.strictEqual(ordres(dir).length, 0);
assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT, 'request-1.md')), 'D: refus → pas de request');
dir = registre(); x = cli(OUTIL, dir, ['--depuis', 'refinexistante', '--cible-env', 'test']);
assert.notStrictEqual(x.code, 0); assert.match(x.sortie, /n'est pas une ref résolvable/);
dir = registre(); x = cli(OUTIL, dir, []);
assert.strictEqual(x.code, 0); assert.strictEqual(ordres(dir).length, 0, 'C: CLI sans --depuis = comportement historique');
ok('D — refus CLI sans écriture (cible non désignée, ref inconnue) ; sans --depuis comportement historique');

// F : débrancher le câblage
const src = fs.readFileSync(OUTIL_CLONE, 'utf8');
const cible = '  const ordresPrepares = preparerOrdresDeLaDemande(lot, seq, options);';
assert.strictEqual(src.split(cible).length, 2, 'F: ancre de mutation unique');
fs.writeFileSync(MUT_CLONE, src.replace(cible, '  const ordresPrepares = [];'));
try {
  dir = registre(); x = cli(MUT_CLONE, dir, ARGS);
  assert.strictEqual(ordres(dir).length, 0, 'F: câblage débranché → aucun ordre : l\'épreuve D rougirait');
  ok('F — mutation « débrancher le câblage » : plus aucun ordre, l\'épreuve D le verrait');
} finally { fs.rmSync(MUT_CLONE, { force: true }); fs.rmSync(CLONE, { recursive: true, force: true }); }

console.log(`\nordre depuis demande : ${n} groupes d'épreuves passés.`);
