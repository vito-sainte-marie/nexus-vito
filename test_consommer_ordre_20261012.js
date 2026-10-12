// E4 — consommation d'un ordre. Chaque garde est prouvée par sa mutation : l'écrivain ne doit JAMAIS être appelé
// sur un refus ni en essai à blanc, et une interruption ne doit jamais redevenir rejouable.
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const O = require('./outils/ordre-execution');
const C = require('./outils/consommer-ordre');
const BLOB = 'a'.repeat(40), COMMIT = 'b'.repeat(40), MAINT = new Date('2026-10-12T12:00:00Z');
const HAB = { production: ['vito-sainte-marie'], test: ['arbitre-chatgpt', 'vito-sainte-marie'] };
const mk = (env) => O.construire({ operation: 'MIGRATION_APPLY', lot: 'LOT-X', request: 'request-3', cible: { env, project_ref: O.ENVS[env] },
  artefact: { chemin: 'supabase/migrations/20261012000000_exemple.sql', blob: BLOB, commit: COMMIT },
  preconditions: { registre_taille: 310 }, postconditions: { registre_taille: 311 }, retour_arriere: 'aucun, justifié : additive',
  cree_le: '2026-10-12T10:00:00Z', expire_le: '2026-10-13T10:00:00Z' });
const go = (o) => ({ operation_hash: o.operation_hash, env: o.cible.env, acteur: 'vito-sainte-marie' });
const etat0 = () => ({ consommes: [], verrou: null, incertains: [] });
// Base simulée : l'écrivain fait passer registre_taille 310 → 311 (ou échoue / ne fait rien selon le scénario).
function monde(o, { taille = 310, projet, blob = BLOB, ecrit = 'ok' } = {}) {
  const s = { taille, appels: 0 };
  return { s,
    lecteur: { projet: () => projet || o.cible.project_ref, blob: () => blob, mesures: (n) => Object.fromEntries(n.map((k) => [k, s.taille])) },
    ecrivain: () => { s.appels++; if (ecrit === 'ok') s.taille = 311; else if (ecrit === 'throw') throw new Error('connexion perdue'); } };
}
const run = (o, m, extra = {}) => C.consommer({ ordre: o, go: go(o), lecteur: m.lecteur, ecrivain: m.ecrivain, etat: etat0(), habilites: HAB, maintenant: MAINT, executant: 'session-claude-habilitee', ...extra });
let n = 0; const ok = (t) => { n++; console.log(`  ✅ ${t}`); };

// Essai à blanc : APTE, zéro écriture, même avec un écrivain fourni.
let o = mk('test'), m = monde(o);
let r = run(o, m, { mode: 'blanc' });
assert.strictEqual(r.verdict, 'APTE'); assert.strictEqual(r.ecritures, 0); assert.strictEqual(m.s.appels, 0); assert.strictEqual(m.s.taille, 310);
ok('essai à blanc : APTE, écrivain jamais appelé, base intacte');
// Même essai sur Production : n'écrit rien non plus (E4 n'arme aucune Production).
o = mk('production'); m = monde(o); r = run(o, m, { mode: 'blanc' });
assert.strictEqual(r.verdict, 'APTE'); assert.strictEqual(m.s.appels, 0);
ok('essai à blanc Production : APTE sans aucune écriture');

// Refus : chaque écart nomme son code et n'écrit rien (mode réel, écrivain armé).
const refus = (msg, code, o2, m2, extra) => { const x = run(o2, m2, { mode: 'reel', ...extra }); assert.strictEqual(x.verdict, 'REFUS', msg); assert.ok(x.execution.codes.includes(code), `${msg}: attendu ${code}, obtenu ${x.execution.codes}`); assert.strictEqual(m2.s.appels, 0, `${msg}: écrivain appelé`); assert.strictEqual(x.ecritures, 0); };
o = mk('production');
refus('sans GO', 'GO_ABSENT', o, monde(o), { go: null });
refus('GO autre hash', 'GO_HASH_DIFFERENT', o, monde(o), { go: { ...go(o), operation_hash: mk('test').operation_hash } });
refus('arbitre ne donne pas un GO Production', 'GO_ACTEUR_NON_HABILITE', o, monde(o), { go: { ...go(o), acteur: 'arbitre-chatgpt' } });
refus('projet réel différent', 'PROJET_REEL_DIFFERENT', o, monde(o, { projet: O.ENVS.test }));
refus('blob différent', 'BLOB_REEL_DIFFERENT', o, monde(o, { blob: 'd'.repeat(40) }));
refus('précondition fausse', 'PRECONDITION_FAUSSE', o, monde(o, { taille: 311 }));
refus('rejeu', 'DEJA_CONSOMME', o, monde(o), { etat: { ...etat0(), consommes: [o.operation_hash] } });
refus('concurrence', 'EXECUTION_CONCURRENTE', o, monde(o), { etat: { ...etat0(), verrou: { project_ref: o.cible.project_ref } } });
refus('incertaine non réconciliée', 'EXECUTION_INCERTAINE_NON_RECONCILIEE', o, monde(o), { etat: { ...etat0(), incertains: [o.operation_hash] } });
refus('ordre expiré', 'EXPIRE', o, monde(o), { maintenant: new Date('2026-10-14T00:00:00Z') });
refus('ordre altéré', 'HASH_ORDRE_INVALIDE', Object.assign(JSON.parse(JSON.stringify(o)), { lot: 'AUTRE' }), monde(o));
refus('mode réel sans écrivain', 'ORDRE_MALFORME', o, monde(o), { ecrivain: undefined });
const mil = monde(o); mil.lecteur.mesures = () => { throw new Error('réseau'); };
refus('lecture impossible = refus, pas supposition', 'PRECONDITION_FAUSSE', o, mil);
ok('onze refus codés + lecture impossible : aucune écriture dans aucun cas');

// Réel heureux : EXECUTE, retour recevable, relecture mesurée.
o = mk('test'); m = monde(o); r = run(o, m, { mode: 'reel' });
assert.strictEqual(r.verdict, 'EXECUTE'); assert.strictEqual(m.s.appels, 1); assert.deepStrictEqual(O.validerExecution(r.execution, o), []);
assert.deepStrictEqual(r.execution.mesures_avant, { registre_taille: 310 }); assert.deepStrictEqual(r.execution.mesures_apres, { registre_taille: 311 });
ok('réel : EXECUTE, un seul appel, mesures avant/après, retour recevable');

// Interruption : INCERTAINE, jamais rejouable aveuglément.
o = mk('test'); m = monde(o, { ecrit: 'throw' }); r = run(o, m, { mode: 'reel' });
assert.strictEqual(r.verdict, 'INCERTAIN'); assert.strictEqual(r.execution.etat, 'EXECUTION_INCERTAINE');
// Écriture « réussie » mais postcondition non constatée : INCERTAINE aussi (on ne devine pas).
m = monde(o, { ecrit: 'rien' }); r = run(o, m, { mode: 'reel' }); assert.strictEqual(r.execution.etat, 'EXECUTION_INCERTAINE');
// Dépôt + relecture du lot : le rejeu est refusé.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e4-'));
C.deposerExecution(dir, 3, 1, r.execution, o);
assert.throws(() => C.deposerExecution(dir, 3, 1, r.execution, o), /ne s'écrase pas/);
const et = C.etatDepuisLot(dir); assert.deepStrictEqual(et.incertains, [o.operation_hash]);
m = monde(o); const x = run(o, m, { mode: 'reel', etat: et }); assert.ok(x.execution.codes.includes('EXECUTION_INCERTAINE_NON_RECONCILIEE')); assert.strictEqual(m.s.appels, 0);
ok('interruption/ambiguïté : EXECUTION_INCERTAINE déposée, rejeu refusé sans écriture, retour jamais écrasé');
// EXECUTE déposé → consommé.
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'e4-')); o = mk('test'); r = run(o, monde(o), { mode: 'reel' });
C.deposerExecution(dir2, 1, 1, r.execution, o); assert.deepStrictEqual(C.etatDepuisLot(dir2).consommes, [o.operation_hash]);
ok('un retour EXECUTE déposé rend l\'ordre consommé (usage unique)');

// Mutation de câblage : si les gardes sont court-circuitées, l'écrivain est appelé sur un refus → l'épreuve le verrait.
const src = fs.readFileSync(path.join(__dirname, 'outils', 'consommer-ordre.js'), 'utf8');
const cible = 'if (codes.length) return refus(codes, undefined, avant);';
assert.strictEqual(src.split(cible).length, 2, 'ancre unique');
const tmp = path.join(__dirname, 'outils', '.mut-consommer.js');
fs.writeFileSync(tmp, src.replace(cible, ''));
try {
  const M = require(tmp); o = mk('production'); m = monde(o, { taille: 999 });
  const y = M.consommer({ ordre: o, go: null, lecteur: m.lecteur, ecrivain: m.ecrivain, etat: etat0(), habilites: HAB, mode: 'reel', maintenant: MAINT });
  assert.ok(m.s.appels >= 1, 'mutation : sans les gardes l\'écrivain est appelé (donc les refus ci-dessus prouvent la garde)');
} finally { fs.rmSync(tmp, { force: true }); }
ok('mutation « retirer les gardes » : l\'écrivain est alors appelé sans GO — les refus ci-dessus mesurent bien la garde');
console.log(`\nconsommer-ordre : ${n} groupes d'épreuves passés.`);
