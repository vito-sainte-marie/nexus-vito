// Ordre d'exécution Supabase (NEXUS-EXECUTOR-SUPABASE-1, E1) — un ordre n'est jamais une autorisation.
//
// PROPRIÉTÉS MESURÉES (chacune par une mutation qui doit être refusée, pas seulement par un cas heureux) :
//   A. Un ordre intact et un GO lié à son hash exact passent.
//   B. Hash altéré / champ modifié après calcul du hash → refus.
//   C. Aucun SQL libre : un champ sql/query/script, ou tout champ inconnu → refus.
//   D. Projet croisé (env test avec le ref Production, et inversement) → refus.
//   E. Ordre expiré → refus ; usage_unique absent → refus.
//   F. GO : absent, hash d'un autre ordre, autre environnement, acteur non habilité → refus.
//   G. Réel : projet mesuré différent, blob différent, précondition fausse → refus.
//   H. Rejeu (déjà consommé), exécution concurrente, incertaine non réconciliée → refus.
//   I. Interruption : EXECUTION_EN_COURS --interrompu--> EXECUTION_INCERTAINE, jamais de retour direct à AUTORISE ;
//      la réconciliation en lecture seule distingue APPLIQUEE / NON_APPLIQUEE / INDETERMINE.
//   J. Le retour execution-N est refusé s'il ne cite pas le hash, le GO et les mesures.
//   K. Le hash ne dépend pas de l'ordre des clés.
//   M. Une postcondition doit être fausse au départ (et nommer la version migrée) ; une mesure absente ne vaut rien.
const assert = require('assert');
const O = require('./outils/ordre-execution');

const BLOB = 'a'.repeat(40), COMMIT = 'b'.repeat(40);
const HAB = { production: ['vito-sainte-marie'], test: ['arbitre-chatgpt', 'vito-sainte-marie'] };
const MAINT = new Date('2026-10-12T12:00:00Z');
const base = (env = 'production') => O.construire({
  operation: 'MIGRATION_APPLY', lot: 'LOT-X', request: 'request-3',
  cible: { env, project_ref: O.ENVS[env] },
  artefact: { chemin: 'supabase/migrations/20261012000000_exemple.sql', blob: BLOB, commit: COMMIT },
  preconditions: { registre_taille: 310, registre_derniere_version: '20261011000000', 'fonction_md5.fdj_exemple': 'abc' },
  postconditions: { registre_taille: 311, registre_derniere_version: '20261012000000' },
  retour_arriere: 'aucun, justifié : migration additive',
  cree_le: '2026-10-12T10:00:00Z', expire_le: '2026-10-13T10:00:00Z',
});
const reel = (o) => ({ project_ref: o.cible.project_ref, blob: BLOB, mesures: { ...o.preconditions } });
const etat0 = () => ({ consommes: [], verrou: null, incertains: [] });
const go = (o, extra = {}) => ({ operation_hash: o.operation_hash, env: o.cible.env, acteur: 'vito-sainte-marie', ...extra });
const refuse = (codes, code, msg) => assert.ok(codes.includes(code), `${msg} : attendu ${code}, obtenu [${codes}]`);
const mut = (o, f) => { const c = JSON.parse(JSON.stringify(o)); f(c); return c; };
const recalc = (o) => { o.operation_hash = O.hashOrdre(o); return o; };
const opts = { habilites: HAB, maintenant: MAINT };

// A
let o = base();
assert.deepStrictEqual(O.valider(o, { maintenant: MAINT }), [], 'A: ordre intact recevable');
assert.deepStrictEqual(O.peutExecuter(o, go(o), reel(o), etat0(), opts), [], 'A: exécution permise avec GO lié');
// B
refuse(O.valider(mut(o, (c) => { c.operation_hash = '0'.repeat(64); }), { maintenant: MAINT }), 'HASH_ORDRE_INVALIDE', 'B hash altéré');
refuse(O.valider(mut(o, (c) => { c.artefact.blob = 'c'.repeat(40); }), { maintenant: MAINT }), 'HASH_ORDRE_INVALIDE', 'B blob modifié sans recalcul');
refuse(O.valider(mut(o, (c) => { delete c.operation_hash; }), { maintenant: MAINT }), 'HASH_ABSENT', 'B hash absent');
// C
refuse(O.valider(recalc(mut(o, (c) => { c.sql = 'drop table x'; })), { maintenant: MAINT }), 'SQL_LIBRE', 'C sql libre');
refuse(O.valider(recalc(mut(o, (c) => { c.query = 'select 1'; })), { maintenant: MAINT }), 'SQL_LIBRE', 'C query');
refuse(O.valider(recalc(mut(o, (c) => { c.autre = 1; })), { maintenant: MAINT }), 'CHAMP_INCONNU', 'C champ inconnu');
refuse(O.valider(recalc(mut(o, (c) => { c.operation = 'EXECUTE_SQL'; })), { maintenant: MAINT }), 'TYPE_INCONNU', 'C type hors liste');
refuse(O.valider(recalc(mut(o, (c) => { c.preconditions = { 'select 1; drop table x': 1 }; })), { maintenant: MAINT }), 'ORDRE_MALFORME', 'C mesure hors grammaire');
refuse(O.valider(recalc(mut(o, (c) => { c.artefact.chemin = '../../etc/passwd'; })), { maintenant: MAINT }), 'ARTEFACT_INVALIDE', 'C chemin hors migrations');
// D
refuse(O.valider(recalc(mut(o, (c) => { c.cible.env = 'test'; })), { maintenant: MAINT }), 'PROJET_INCOHERENT', 'D env test + ref Production');
refuse(O.valider(recalc(mut(base('test'), (c) => { c.cible.env = 'production'; })), { maintenant: MAINT }), 'PROJET_INCOHERENT', 'D env production + ref Test');
refuse(O.valider(recalc(mut(o, (c) => { c.cible.env = 'staging'; })), { maintenant: MAINT }), 'CIBLE_INCONNUE', 'D env inconnu');
// E
refuse(O.valider(o, { maintenant: new Date('2026-10-14T00:00:00Z') }), 'EXPIRE', 'E expiré');
refuse(O.valider(recalc(mut(o, (c) => { c.usage_unique = false; })), { maintenant: MAINT }), 'USAGE_UNIQUE_REQUIS', 'E usage unique');
// F
refuse(O.autoriser(o, null, opts), 'GO_ABSENT', 'F go absent');
refuse(O.autoriser(o, go(o, { operation_hash: base('test').operation_hash }), opts), 'GO_HASH_DIFFERENT', 'F go d\'un autre ordre');
refuse(O.autoriser(o, go(o, { env: 'test' }), opts), 'GO_ENV_DIFFERENT', 'F go autre env');
refuse(O.autoriser(o, go(o, { acteur: 'arbitre-chatgpt' }), opts), 'GO_ACTEUR_NON_HABILITE', 'F arbitre ne donne pas un GO Production');
refuse(O.autoriser(mut(o, (c) => { c.lot = 'AUTRE'; }), go(o), opts), 'HASH_ORDRE_INVALIDE', 'F ordre modifié après le GO');
// G
refuse(O.peutExecuter(o, go(o), { ...reel(o), project_ref: O.ENVS.test }, etat0(), opts), 'PROJET_REEL_DIFFERENT', 'G projet réel');
refuse(O.peutExecuter(o, go(o), { ...reel(o), blob: 'd'.repeat(40) }, etat0(), opts), 'BLOB_REEL_DIFFERENT', 'G blob réel');
refuse(O.peutExecuter(o, go(o), { ...reel(o), mesures: { ...o.preconditions, registre_taille: 311 } }, etat0(), opts), 'PRECONDITION_FAUSSE', 'G précondition');
refuse(O.peutExecuter(o, go(o), { ...reel(o), mesures: {} }, etat0(), opts), 'PRECONDITION_FAUSSE', 'G mesure absente');
// H
refuse(O.peutExecuter(o, go(o), reel(o), { ...etat0(), consommes: [o.operation_hash] }, opts), 'DEJA_CONSOMME', 'H rejeu');
refuse(O.peutExecuter(o, go(o), reel(o), { ...etat0(), verrou: { operation_hash: 'x', project_ref: o.cible.project_ref } }, opts), 'EXECUTION_CONCURRENTE', 'H concurrence');
refuse(O.peutExecuter(o, go(o), reel(o), { ...etat0(), incertains: [o.operation_hash] }, opts), 'EXECUTION_INCERTAINE_NON_RECONCILIEE', 'H incertaine');
// I
assert.strictEqual(O.transition('EXECUTION_EN_COURS', 'interrompu'), 'EXECUTION_INCERTAINE');
assert.throws(() => O.transition('EXECUTION_INCERTAINE', 'demarre'), /interdite/, 'I: pas de redémarrage aveugle');
assert.throws(() => O.transition('EXECUTE', 'demarre'), /interdite/, 'I: ordre exécuté non rejouable');
assert.throws(() => O.transition('EXECUTION_EN_COURS', 'reconcilie_non_appliquee'), /interdite/);
assert.strictEqual(O.transition('EXECUTION_INCERTAINE', 'reconcilie_non_appliquee'), 'AUTORISE');
assert.strictEqual(O.reconcilier(o, o.postconditions), 'APPLIQUEE');
assert.strictEqual(O.reconcilier(o, o.preconditions), 'NON_APPLIQUEE');
assert.strictEqual(O.reconcilier(o, { registre_taille: 312 }), 'INDETERMINE', 'I: état ambigu jamais deviné');
// J
const exec = { operation_hash: o.operation_hash, etat: 'EXECUTE', executant: 'session-claude-habilitee', go: go(o),
  mesures_avant: o.preconditions, mesures_apres: o.postconditions, debut: '2026-10-12T11:00:00Z', fin: '2026-10-12T11:00:05Z',
  reprise: { prochaine_action: 'constat passif' } };
const dec = { hashesApprouves: [o.operation_hash] };
assert.deepStrictEqual(O.validerExecution(exec, o, dec), [], 'J: retour complet recevable');
refuse(O.validerExecution({ ...exec, operation_hash: 'f'.repeat(64) }, o, dec), 'GO_HASH_DIFFERENT', 'J hash');
refuse(O.validerExecution({ ...exec, go: undefined }, o, dec), 'GO_ABSENT', 'J go');
refuse(O.validerExecution({ ...exec, mesures_apres: { ...o.postconditions, registre_taille: 310 } }, o, dec), 'PRECONDITION_FAUSSE', 'J postcondition non tenue');
refuse(O.validerExecution({ ...exec, reprise: undefined }, o, dec), 'ORDRE_MALFORME', 'J reprise');
refuse(O.validerExecution({ ...exec, etat: 'REFUSE', refus: 'inventé' }, o, dec), 'ORDRE_MALFORME', 'J refus sans code connu');
// J2 — le GO d'un retour est contrôlé comme celui de l'exécutant : environnement, habilitation, décision (Production).
refuse(O.validerExecution({ ...exec, go: go(o, { env: 'test' }) }, o, dec), 'GO_ENV_DIFFERENT', 'J2 GO d\'un autre environnement');
refuse(O.validerExecution({ ...exec, go: go(o, { acteur: 'inconnu-quelconque' }) }, o, dec), 'GO_ACTEUR_NON_HABILITE', 'J2 acteur non habilité pour Production');
refuse(O.validerExecution({ ...exec, go: go(o, { acteur: 'arbitre-chatgpt' }) }, o, dec), 'GO_ACTEUR_NON_HABILITE', 'J2 habilité Test mais pas Production');
refuse(O.validerExecution(exec, o), 'GO_SANS_DECISION', 'J2 Production sans décision citant le hash');
refuse(O.validerExecution(exec, o, { hashesApprouves: ['a'.repeat(64)] }), 'GO_SANS_DECISION', 'J2 décision citant un autre hash');
// K
const rev = (v) => (Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, rev(v[k])])) : v);
const permute = rev(o);
assert.notDeepStrictEqual(Object.keys(permute), Object.keys(o), 'K: la permutation change bien l\'ordre');
assert.strictEqual(O.hashOrdre(permute), o.operation_hash, 'K: hash indépendant de l\'ordre des clés');
// Les autres types sont recevables sous la même discipline
const lec = O.construire({ operation: 'LECTURE_CONTROLE', lot: 'L', request: 'request-1', controle: 'MD5_FONCTIONS',
  cible: { env: 'production', project_ref: O.ENVS.production }, preconditions: { registre_taille: 1 }, postconditions: { registre_taille: 1 },
  retour_arriere: 'sans objet : lecture seule', cree_le: '2026-10-12T10:00:00Z', expire_le: '2026-10-13T10:00:00Z' });
assert.deepStrictEqual(O.valider(lec, { maintenant: MAINT }), []);
refuse(O.valider(recalc(mut(lec, (c) => { c.controle = 'N_IMPORTE_QUOI'; })), { maintenant: MAINT }), 'TYPE_INCONNU', 'contrôle hors catalogue');

// L. `maintenant` est la SEULE horloge : ni autoriser ni peutExecuter ne lisent l'horloge réelle (audit 12/10, point 1).
//    Régression : l'horloge réelle est simulée bien après toutes les expirations de ce fichier (2027-03-01) ; un ordre
//    encore valide à `maintenant` doit rester autorisé, et un ordre réellement expiré à `maintenant` doit rester refusé.
{
  const RD = Date, APRES = RD.parse('2027-03-01T00:00:00Z');
  global.Date = class extends RD { constructor(...a) { super(...(a.length ? a : [APRES])); } static now() { return APRES; } };
  try {
    assert.ok(new Date().getTime() > Date.parse(o.expire_le), 'L: horloge réelle simulée après l\'expiration');
    assert.deepStrictEqual(O.autoriser(o, go(o), opts), [], 'L: autoriser ne lit pas l\'horloge réelle');
    assert.deepStrictEqual(O.peutExecuter(o, go(o), reel(o), etat0(), opts), [], 'L: peutExecuter ne lit pas l\'horloge réelle');
    const APRES_EXP = new RD(RD.parse(o.expire_le) + 1000), PILE = new RD(o.expire_le);
    refuse(O.autoriser(o, go(o), { habilites: HAB, maintenant: APRES_EXP }), 'EXPIRE', 'L autoriser : ordre expiré refusé');
    refuse(O.peutExecuter(o, go(o), reel(o), etat0(), { habilites: HAB, maintenant: APRES_EXP }), 'EXPIRE', 'L peutExecuter : ordre expiré refusé');
    refuse(O.peutExecuter(o, go(o), reel(o), etat0(), { habilites: HAB, maintenant: PILE }), 'EXPIRE', 'L peutExecuter : expiré à l\'instant exact');
    // Sans `maintenant` explicite, l'horloge réelle reste le défaut — et un ordre expiré est refusé.
    refuse(O.autoriser(o, go(o), { habilites: HAB }), 'EXPIRE', 'L défaut = horloge réelle : ordre expiré refusé');
  } finally { global.Date = RD; }
}

// M. Postconditions probantes (audit 12/10, point 6). Une postcondition que l'état de départ satisfait déjà ferait
//    dire APPLIQUEE à `reconcilier` avant toute écriture, et une mesure absente ne doit jamais valoir une valeur.
//    Chaque garde est prouvée par sa mutation : retirée, le cas refusé ci-dessous redevient recevable.
{
  const fs = require('fs'), path = require('path');
  const val = (x, mod = O) => mod.valider(x, { maintenant: MAINT });
  const V = (f) => recalc(mut(o, f));
  const egalPre = V((c) => { c.postconditions = { ...c.preconditions }; });
  const disjointes = V((c) => { c.preconditions = { registre_taille: 310 }; c.postconditions = { registre_derniere_version: '20261012000000' }; });
  const sansVersion = V((c) => { c.postconditions = { registre_taille: 311 }; });
  const autreVersion = V((c) => { c.postconditions = { registre_taille: 311, registre_derniere_version: '20261013000000' }; });
  const vide = V((c) => { c.preconditions.registre_taille = ''; });
  const textes = ['undefined', 'null', 'NaN'].map((t) => V((c) => { c.postconditions['fonction_md5.fdj_exemple'] = t; c.preconditions['fonction_md5.fdj_exemple'] = 'abc'; }));
  // Ordre forgé (hash recalculé, jamais validé) : `reconcilier` ne valide pas, il doit tenir seul.
  const forge = V((c) => { c.preconditions = { registre_taille: 'x' }; c.postconditions = { registre_taille: 'undefined' }; });

  refuse(val(egalPre), 'POSTCONDITION_INSUFFISANTE', 'M postconditions = préconditions');
  refuse(val(disjointes), 'POSTCONDITION_INSUFFISANTE', 'M aucune mesure commune ne change');
  refuse(val(sansVersion), 'POSTCONDITION_INSUFFISANTE', 'M migration sans registre_derniere_version');
  refuse(val(autreVersion), 'POSTCONDITION_INSUFFISANTE', 'M registre_derniere_version ≠ version du fichier');
  refuse(val(vide), 'ORDRE_MALFORME', 'M valeur vide');
  for (const t of textes) refuse(val(t), 'ORDRE_MALFORME', `M valeur « ${t.postconditions['fonction_md5.fdj_exemple']} »`);
  assert.strictEqual(O.reconcilier(forge, {}), 'INDETERMINE', 'M: une mesure absente ne vaut jamais « undefined »');
  refuse(O.peutExecuter(o, go(o), { ...reel(o), mesures: { registre_taille: 310 } }, etat0(), opts), 'PRECONDITION_FAUSSE', 'M précondition non mesurée');
  assert.strictEqual(O.validerExecution({ operation_hash: o.operation_hash, etat: 'EXECUTE', executant: 'x', go: go(o), mesures_avant: o.preconditions, mesures_apres: { registre_taille: 311 }, debut: 'a', fin: 'b' }, o, { habilites: HAB, hashesApprouves: [o.operation_hash] }).includes('PRECONDITION_FAUSSE'), true, 'M: postcondition non mesurée = non tenue');

  const SRC = fs.readFileSync(path.join(__dirname, 'outils', 'ordre-execution.js'), 'utf8');
  let k = 0;
  const muter = (ancre, remplacement, epreuve) => {
    assert.strictEqual(SRC.split(ancre).length, 2, `M: ancre de mutation unique — ${ancre}`);
    const tmp = path.join(__dirname, 'outils', `.mut-ordre-${process.pid}-${++k}.js`);
    fs.writeFileSync(tmp, SRC.replace(ancre, remplacement));
    try { epreuve(require(tmp)); } finally { fs.rmSync(tmp, { force: true }); }
  };
  muter("  else if (ordre.operation !== 'LECTURE_CONTROLE' && !postconditionsSuffisantes(ordre)) r.push('POSTCONDITION_INSUFFISANTE');\n", '', (Mu) => {
    assert.deepStrictEqual(val(egalPre, Mu), [], 'mutation : sans la garde, post = pre redevient recevable');
    assert.strictEqual(Mu.reconcilier(egalPre, egalPre.preconditions), 'APPLIQUEE', 'mutation : …et la base intacte se réconcilie APPLIQUEE');
  });
  muter('    if (String(post.registre_derniere_version) !== version) return false;\n', '', (Mu) => {
    assert.deepStrictEqual(val(sansVersion, Mu), [], 'mutation : sans contrôle de version, une migration sans version passe');
    assert.deepStrictEqual(val(autreVersion, Mu), [], 'mutation : …et une version étrangère au fichier aussi');
  });
  muter('const RE_VALEUR = /^[A-Za-z0-9_.:\\-]{1,128}$/;', 'const RE_VALEUR = /^[A-Za-z0-9_.:\\-]{0,128}$/;', (Mu) => {
    assert.ok(!val(vide, Mu).includes('ORDRE_MALFORME'), 'mutation : longueur 0 admise, la valeur vide passe');
  });
  muter(" && !VALEURS_VIDES.includes(String(m[k]))", '', (Mu) => {
    for (const t of textes) assert.ok(!val(t, Mu).includes('ORDRE_MALFORME'), 'mutation : « undefined »/« null »/« NaN » redeviennent des valeurs');
  });
  muter('const mesureEgale = (mesures, k, v) => !!mesures && Object.prototype.hasOwnProperty.call(mesures, k) && mesures[k] !== undefined && mesures[k] !== null && String(mesures[k]) === String(v);',
    'const mesureEgale = (mesures, k, v) => String((mesures || {})[k]) === String(v);', (Mu) => {
    assert.strictEqual(Mu.reconcilier(forge, {}), 'APPLIQUEE', 'mutation : sans contrôle de présence, rien mesuré = APPLIQUEE');
  });
  console.log('  ✅ M — postconditions probantes : cinq gardes, cinq mutations qui les rendent muettes');
}

console.log('ordre-execution : toutes les propriétés A–M tiennent');
