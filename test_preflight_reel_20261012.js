// NEXUS-EXECUTOR-PREFLIGHT-REEL-1 — identité prouvée par deux témoins, provenance commit + SQL, verrou persistant,
// cycle de vie asynchrone. Doubles seulement (témoins, écrivain, base simulée) et un dépôt git jetable : aucun accès
// base, aucun réseau. Chaque garde est prouvée par sa mutation : retirée, elle laisse passer ce qu'elle refuse.
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync, spawn } = require('child_process');
const O = require('./outils/ordre-execution');
const C = require('./outils/consommer-ordre');
const P = require('./outils/preflight-reel');

const MAINT = new Date('2026-10-12T12:00:00Z');
const HAB = { production: ['vito-sainte-marie'], test: ['arbitre-chatgpt', 'vito-sainte-marie'] };
const CHEMIN = 'supabase/migrations/20261012000000_exemple.sql';
const SQL = '-- exemple\nselect 1;\n', BLOB = P.blobGit(SQL);
const tmpd = (p = 'pf-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
let n = 0; const ok = (t) => { n++; console.log(`  ✅ ${t}`); };

// ---- Dépôt git jetable : main porte la migration, production ne porte qu'un commit antérieur ----
const depot = tmpd('pf-git-');
const g = (...a) => execFileSync('git', ['-C', depot, '-c', 'user.name=epreuve', '-c', 'user.email=epreuve@exemple.invalid', '-c', 'commit.gpgsign=false', ...a], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
g('init', '-q');
fs.writeFileSync(path.join(depot, 'LISEZMOI'), 'base\n'); g('add', '-A'); g('commit', '-q', '-m', 'base');
const C_BASE = g('rev-parse', 'HEAD');
fs.mkdirSync(path.dirname(path.join(depot, CHEMIN)), { recursive: true });
fs.writeFileSync(path.join(depot, CHEMIN), SQL); g('add', '-A'); g('commit', '-q', '-m', 'migration');
const C_MIG = g('rev-parse', 'HEAD');
g('update-ref', 'refs/remotes/origin/main', C_MIG);
g('update-ref', 'refs/remotes/origin/production', C_BASE);
// Un commit orphelin (jamais publié) qui porte le même fichier.
const C_ORPHELIN = g('commit-tree', `${C_MIG}^{tree}`, '-m', 'orphelin');
assert.strictEqual(g('rev-parse', `${C_MIG}:${CHEMIN}`), BLOB, 'le blob git du dépôt jetable est celui calculé par blobGit');
const GIT = P.gitDepot(depot);

const mk = (env, { commit = C_MIG, blob = BLOB, chemin = CHEMIN, ref } = {}) => O.construire({ operation: 'MIGRATION_APPLY', lot: 'LOT-PF', request: 'request-1',
  cible: { env, project_ref: ref || O.ENVS[env] }, artefact: { chemin, blob, commit },
  preconditions: { registre_taille: 310, registre_derniere_version: '20261011000000' }, postconditions: { registre_taille: 311, registre_derniere_version: '20261012000000' },
  retour_arriere: 'aucun, justifié : additive', cree_le: '2026-10-12T10:00:00Z', expire_le: '2026-10-13T10:00:00Z' });
const temoins = (a, b) => ({ connexion: () => a, sentinelle: () => b });
const bons = (o) => temoins(o.cible.project_ref, o.cible.project_ref);
const go = (o) => ({ operation_hash: o.operation_hash, env: o.cible.env, acteur: 'vito-sainte-marie' });
const etat0 = () => ({ consommes: [], verrou: null, incertains: [] });
function monde() {
  const s = { taille: 310, appels: 0, sql: null };
  return { s, lecteur: { mesures: (noms) => Object.fromEntries(noms.map((k) => [k, k === 'registre_derniere_version' ? (s.taille >= 311 ? '20261012000000' : '20261011000000') : s.taille])) } };
}
const gitDouble = (o) => ({ estAncetre: () => true, blobA: () => o.artefact.blob, contenu: () => SQL });

// Mutation d'un module de outils/ : ancre unique exigée, copie retirée quoi qu'il arrive.
const muter = (module, ancre, remplacement, nom, epreuve) => {
  const src = fs.readFileSync(path.join(__dirname, 'outils', `${module}.js`), 'utf8');
  assert.strictEqual(src.split(ancre).length, 2, `ancre unique — ${nom}`);
  const t = path.join(__dirname, 'outils', `.mut-${module}-${nom}.js`);
  fs.writeFileSync(t, src.replace(ancre, remplacement));
  try { return epreuve(require(t)); } finally { fs.rmSync(t, { force: true }); }
};
const muterAsync = async (module, ancre, remplacement, nom, epreuve) => {
  const src = fs.readFileSync(path.join(__dirname, 'outils', `${module}.js`), 'utf8');
  assert.strictEqual(src.split(ancre).length, 2, `ancre unique — ${nom}`);
  const t = path.join(__dirname, 'outils', `.mut-${module}-${nom}.js`);
  fs.writeFileSync(t, src.replace(ancre, remplacement));
  try { return await epreuve(require(t)); } finally { fs.rmSync(t, { force: true }); }
};

(async () => {
  // ================= 1. Identité réelle : deux témoins =================
  {
    const o = mk('test');
    assert.deepStrictEqual(P.prouverIdentite(o, bons(o)), { project_ref: O.ENVS.test, temoins: { connexion: O.ENVS.test, sentinelle: O.ENVS.test } });
    const code = (t) => (P.prouverIdentite(o, t).codes || [])[0];
    assert.strictEqual(code(undefined), 'IDENTITE_NON_PROUVEE');
    assert.strictEqual(code({ connexion: () => O.ENVS.test }), 'IDENTITE_NON_PROUVEE', 'un seul témoin ne suffit pas');
    assert.strictEqual(code({ connexion: () => O.ENVS.test, sentinelle: () => { throw new Error('requête refusée'); } }), 'IDENTITE_NON_PROUVEE');
    assert.strictEqual(code(temoins(O.ENVS.test, '')), 'IDENTITE_NON_PROUVEE');
    assert.strictEqual(code(temoins(O.ENVS.test, 'UZHJPQPCTPVXYTXPXOQZ')), 'IDENTITE_NON_PROUVEE');
    assert.strictEqual(code(temoins(O.ENVS.test, O.ENVS.production)), 'PROJET_REEL_DIFFERENT', 'la sentinelle contredit la connexion');
    assert.strictEqual(code(temoins(O.ENVS.production, O.ENVS.test)), 'PROJET_REEL_DIFFERENT', 'la connexion contredit la sentinelle');
    // Un ordre dont la cible ne correspond pas à ENVS[env] : même deux témoins d'accord ne le prouvent pas.
    const faux = { ...o, cible: { env: 'test', project_ref: O.ENVS.production } };
    assert.strictEqual((P.prouverIdentite(faux, temoins(O.ENVS.production, O.ENVS.production)).codes || [])[0], 'PROJET_REEL_DIFFERENT');
    // Le témoin reçoit l'environnement, pas le project_ref attendu : il ne peut pas le recopier.
    let recu; P.prouverIdentite(o, { connexion: (x) => { recu = x; return O.ENVS.test; }, sentinelle: () => O.ENVS.test });
    assert.strictEqual(recu, 'test');
    ok('identité : deux témoins exigés ; absent, illisible, vide ou contradictoire → refus codé');

    muter('preflight-reel', "const SOURCES_IDENTITE = Object.freeze(['connexion', 'sentinelle']);", "const SOURCES_IDENTITE = Object.freeze(['connexion']);", 'un-temoin', (M) => {
      assert.ok(!M.prouverIdentite(o, temoins(O.ENVS.test, O.ENVS.production)).codes, 'mutation : la sentinelle contradictoire passe inaperçue');
    });
    muter('preflight-reel', 'const ecarts = SOURCES_IDENTITE.filter((s) => vus[s] !== attendu || vus[s] !== O.ENVS[ordre.cible.env]);', 'const ecarts = [];', 'sans-comparaison', (M) => {
      assert.ok(!M.prouverIdentite(o, temoins(O.ENVS.production, O.ENVS.production)).codes, 'mutation : deux témoins Production prouvent une cible Test');
    });
    muter('preflight-reel', 'const ecarts = SOURCES_IDENTITE.filter((s) => vus[s] !== attendu || vus[s] !== O.ENVS[ordre.cible.env]);', 'const ecarts = SOURCES_IDENTITE.filter((s) => vus[s] !== attendu);', 'sans-envs', (M) => {
      assert.ok(!M.prouverIdentite(faux, temoins(O.ENVS.production, O.ENVS.production)).codes, 'mutation : une cible Test pointée sur Production est acceptée');
    });
    ok('mutations identité (un seul témoin, comparaison retirée, ENVS ignoré) : les refus disparaissent');
  }

  // ================= 2. Provenance : commit, blob, SQL =================
  {
    const ot = mk('test'), op = mk('production');
    const pt = P.prouverProvenance(ot, GIT);
    assert.deepStrictEqual(pt, { blob: BLOB, sql: SQL, ref: 'origin/main' }, 'Test : commit porté par origin/main, SQL lu depuis git');
    const pp = P.prouverProvenance(op, GIT);
    assert.strictEqual(pp.codes[0], 'COMMIT_NON_ATTEIGNABLE', 'Production : seule origin/production est désignée, elle ne porte pas le commit');
    assert.strictEqual(P.prouverProvenance(mk('test', { commit: C_ORPHELIN }), GIT).codes[0], 'COMMIT_NON_ATTEIGNABLE', 'un commit jamais publié');
    assert.strictEqual(P.prouverProvenance(mk('test', { commit: 'c'.repeat(40) }), GIT).codes[0], 'COMMIT_NON_ATTEIGNABLE', 'un commit inexistant');
    assert.strictEqual(P.prouverProvenance(mk('test', { blob: 'd'.repeat(40) }), GIT).codes[0], 'BLOB_COMMIT_DIFFERENT');
    assert.strictEqual(P.prouverProvenance(mk('test', { chemin: 'supabase/migrations/20261012000000_autre.sql' }), GIT).codes[0], 'BLOB_COMMIT_DIFFERENT');
    assert.strictEqual(P.prouverProvenance(ot, { ...GIT, contenu: () => SQL + 'drop table x;\n' }).codes[0], 'SQL_NON_LIE_AU_BLOB', 'un SQL substitué ne passe pas');
    assert.strictEqual(P.prouverProvenance(ot, { ...GIT, contenu: () => null }).codes[0], 'SQL_NON_LIE_AU_BLOB');
    assert.strictEqual(P.prouverProvenance(ot, null).codes[0], 'COMMIT_NON_ATTEIGNABLE');
    assert.strictEqual(P.prouverProvenance(ot, { ...GIT, estAncetre: () => { throw new Error('git absent'); } }).codes[0], 'COMMIT_NON_ATTEIGNABLE');
    // Production publiée : le même commit devient atteignable depuis origin/production.
    g('update-ref', 'refs/remotes/origin/production', C_MIG);
    assert.strictEqual(P.prouverProvenance(op, GIT).ref, 'origin/production');
    g('update-ref', 'refs/remotes/origin/production', C_BASE);
    ok('provenance (dépôt git réel) : commit non publié, blob ou chemin différent, SQL substitué → refus codé');

    muter('preflight-reel', "  if (!porteuse) return { codes: ['COMMIT_NON_ATTEIGNABLE']", "  if (false) return { codes: ['COMMIT_NON_ATTEIGNABLE']", 'sans-ancetre', (M) => {
      assert.ok(!M.prouverProvenance(mk('test', { commit: C_ORPHELIN }), M.gitDepot(depot)).codes, 'mutation : un commit orphelin est accepté');
    });
    muter('preflight-reel', "  if (b !== a.blob) return { codes: ['BLOB_COMMIT_DIFFERENT']", "  if (false) return { codes: ['BLOB_COMMIT_DIFFERENT']", 'sans-blob', (M) => {
      const r = M.prouverProvenance(mk('test', { chemin: 'supabase/migrations/20261012000000_autre.sql' }), M.gitDepot(depot));
      assert.ok(!r.codes, 'mutation : un chemin absent du commit est accepté');
    });
    muter('preflight-reel', 'if (c === null || c === undefined || blobGit(c) !== a.blob) return', 'if (c === null || c === undefined) return', 'sans-hash-sql', (M) => {
      const r = M.prouverProvenance(ot, { ...GIT, contenu: () => 'drop table x;\n' });
      assert.strictEqual(r.sql, 'drop table x;\n', 'mutation : un SQL substitué serait transmis à l\'écrivain');
    });
    ok('mutations provenance (ancêtre, blob, hash du SQL) : les refus disparaissent');
  }

  // ================= 3. Preuve : émise par preflight, liée à l'ordre =================
  {
    const o = mk('test');
    const { preuve } = P.preflight({ ordre: o, temoins: bons(o), git: GIT });
    assert.ok(Object.isFrozen(preuve) && preuve.sql === SQL && preuve.ref_provenance === 'origin/main');
    assert.ok(P.preuveAuthentique(preuve, o));
    assert.ok(!P.preuveAuthentique({ ...preuve }, o), 'une copie champ pour champ n\'est pas une preuve');
    assert.ok(!P.preuveAuthentique(preuve, mk('test', { blob: 'e'.repeat(40) })), 'la preuve d\'un ordre ne vaut pas pour un autre');
    assert.deepStrictEqual(P.preflight({ ordre: mk('production'), temoins: bons(mk('production')), git: GIT }).codes, ['COMMIT_NON_ATTEIGNABLE']);
    assert.deepStrictEqual(P.preflight({ ordre: o, temoins: temoins(O.ENVS.test, O.ENVS.production), git: GIT }).codes, ['PROJET_REEL_DIFFERENT']);
    // L'écrivain reçoit le SQL de la preuve.
    const m = monde(); let sqlRecu;
    const r = C.consommer({ ordre: o, go: go(o), lecteur: m.lecteur, ecrivain: (_, sql) => { sqlRecu = sql; m.s.taille = 311; }, etat: etat0(), habilites: HAB, maintenant: MAINT,
      executant: 'session-claude-habilitee', mode: 'reel', preuve, dirVerrous: tmpd() });
    assert.strictEqual(r.verdict, 'EXECUTE'); assert.strictEqual(sqlRecu, SQL);
    assert.deepStrictEqual(r.execution.preflight, { temoins: { connexion: O.ENVS.test, sentinelle: O.ENVS.test }, blob: BLOB, ref_provenance: 'origin/main' });
    ok('preuve : gelée, liée au hash, non falsifiable par copie ; l\'écrivain reçoit le SQL prouvé ; le retour cite les témoins');

    muter('preflight-reel', ' && PREUVES.has(preuve) && ', ' && ', 'sans-weakset', (M) => {
      assert.ok(M.preuveAuthentique({ ...preuve }, o), 'mutation : un objet construit à la main tient lieu de preuve');
    });
    ok('mutation preuve (registre des preuves émises retiré) : une preuve fabriquée passe');
  }

  // ================= 4. Verrou persistant =================
  {
    const ref = O.ENVS.test, h1 = '1'.repeat(64), h2 = '2'.repeat(64);
    let dv = tmpd();
    assert.ok(P.prendreVerrou(dv, { project_ref: ref, operation_hash: h1, executant: 'a' }).fichier);
    const second = P.prendreVerrou(dv, { project_ref: ref, operation_hash: h2, executant: 'b' });
    assert.deepStrictEqual(second.codes, ['EXECUTION_CONCURRENTE']); assert.strictEqual(second.tenu.operation_hash, h1);
    assert.ok(!P.prendreVerrou(dv, { project_ref: O.ENVS.production, operation_hash: h2 }).codes, 'un verrou par projet');
    // Le verrou survit au processus : un autre processus le voit tenu.
    const vu = execFileSync(process.execPath, ['-e', `const P=require(${JSON.stringify(path.join(__dirname, 'outils', 'preflight-reel'))});process.stdout.write(JSON.stringify(P.prendreVerrou(${JSON.stringify(dv)},{project_ref:${JSON.stringify(ref)},operation_hash:${JSON.stringify(h2)}})))`]).toString();
    assert.deepStrictEqual(JSON.parse(vu).codes, ['EXECUTION_CONCURRENTE']);
    // Libération : motif connu, hash nommé, archivée.
    assert.throws(() => P.libererVerrou(dv, ref, { operation_hash: h1, motif: 'PARCE_QUE' }), /motif de libération inconnu/);
    assert.throws(() => P.libererVerrou(dv, ref, { operation_hash: h2, motif: 'EXECUTE' }), /libération refusée/);
    assert.throws(() => P.libererVerrou(dv, ref, { operation_hash: h1, motif: 'HUMAIN', par: 'session-claude-habilitee' }), /n'est pas habilité/);
    assert.throws(() => P.libererVerrou(dv, O.ENVS.production, { operation_hash: h2, motif: 'HUMAIN', par: 'arbitre-chatgpt' }), /n'est pas habilité/, 'Production : seul vito-sainte-marie');
    P.libererVerrou(dv, ref, { operation_hash: h1, motif: 'HUMAIN', par: 'arbitre-chatgpt' });
    assert.strictEqual(P.lireVerrou(dv, ref), null);
    const archives = fs.readdirSync(dv).filter((f) => f.startsWith(`verrou-${ref}.libere-`));
    assert.strictEqual(archives.length, 1); assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dv, archives[0]), 'utf8')).par, 'arbitre-chatgpt');
    assert.throws(() => P.libererVerrou(dv, ref, { operation_hash: h1, motif: 'EXECUTE' }), /aucun verrou/);
    // Illisible = tenu ; seul un humain habilité qui nomme « illisible » le lève.
    dv = tmpd(); fs.writeFileSync(path.join(dv, `verrou-${ref}.json`), '{ tronq');
    assert.ok(P.lireVerrou(dv, ref).illisible);
    assert.deepStrictEqual(P.prendreVerrou(dv, { project_ref: ref, operation_hash: h1 }).codes, ['EXECUTION_CONCURRENTE']);
    fs.writeFileSync(path.join(dv, `verrou-${ref}.json`), JSON.stringify({ project_ref: ref }));
    assert.ok(P.lireVerrou(dv, ref).illisible, 'sans hash = illisible');
    assert.throws(() => P.libererVerrou(dv, ref, { operation_hash: 'illisible', motif: 'EXECUTE' }), /seule une libération humaine/);
    P.libererVerrou(dv, ref, { operation_hash: 'illisible', motif: 'HUMAIN', par: 'vito-sainte-marie' });
    assert.strictEqual(P.lireVerrou(dv, ref), null);
    ok('verrou : atomique, un par projet, vu d\'un autre processus, illisible = tenu, libération motivée, nommée, habilitée, archivée');

    // Course réelle : six processus prennent le verrou en même temps, un seul gagne.
    dv = tmpd();
    const code = `const P=require(${JSON.stringify(path.join(__dirname, 'outils', 'preflight-reel'))});const r=P.prendreVerrou(${JSON.stringify(dv)},{project_ref:${JSON.stringify(ref)},operation_hash:String(process.argv[1]).repeat(64)});process.stdout.write(r.codes?'perdu':'gagne')`;
    const course = (P2) => Promise.all([1, 2, 3, 4, 5, 6].map((i) => new Promise((res, rej) => {
      const c = spawn(process.execPath, ['-e', code.replace(path.join(__dirname, 'outils', 'preflight-reel'), P2), String(i)]); let out = '';
      c.stdout.on('data', (d) => { out += d; }); c.on('error', rej); c.on('close', () => res(out));
    })));
    const issues = await course(path.join(__dirname, 'outils', 'preflight-reel'));
    assert.strictEqual(issues.filter((x) => x === 'gagne').length, 1, `un seul gagnant : ${issues.join(',')}`);
    ok('concurrence entre processus : six prises simultanées, un seul verrou accordé');

    muter('preflight-reel', "try { fd = fs.openSync(f, 'wx'); }", "try { fd = fs.openSync(f, 'w'); }", 'sans-wx', (M) => {
      const d = tmpd(); M.prendreVerrou(d, { project_ref: ref, operation_hash: h1 });
      assert.ok(!M.prendreVerrou(d, { project_ref: ref, operation_hash: h2 }).codes, 'mutation : la seconde prise écrase la première');
    });
    muter('preflight-reel', '  return { project_ref: ref, illisible: true };\n}', '  return null;\n}', 'illisible-libre', (M) => {
      const d = tmpd(); fs.writeFileSync(path.join(d, `verrou-${ref}.json`), '{ tronq');
      assert.strictEqual(M.lireVerrou(d, ref), null, 'mutation : un verrou tronqué est lu libre');
    });
    muter('preflight-reel', "  if (motif === 'HUMAIN' && !(", "  if (false && !(", 'humain-non-habilite', (M) => {
      const d = tmpd(); M.prendreVerrou(d, { project_ref: ref, operation_hash: h1 });
      assert.doesNotThrow(() => M.libererVerrou(d, ref, { operation_hash: h1, motif: 'HUMAIN', par: 'session-claude-habilitee' }), 'mutation : un acteur non habilité libère');
    });
    ok('mutations verrou (sans wx, illisible lu libre, humain non habilité) : les refus disparaissent');
  }

  // ================= 5. Verrou dans consommer : tenu sur toute issue non conclue =================
  {
    const o = mk('test'), ref = o.cible.project_ref;
    const appel = (M, ecrivain, dv, m) => M.consommer({ ordre: o, go: go(o), lecteur: m.lecteur, ecrivain, etat: etat0(), habilites: HAB, maintenant: MAINT,
      executant: 'session-claude-habilitee', mode: 'reel', preuve: P.preflight({ ordre: o, temoins: bons(o), git: gitDouble(o) }).preuve, dirVerrous: dv });
    // Un premier ordre interrompu garde le verrou : un second appel est refusé AVANT l'écrivain.
    let dv = tmpd(), m = monde();
    let r = appel(C, () => { m.s.appels++; m.s.taille = 311; throw new Error('connexion perdue'); }, dv, m);
    assert.strictEqual(r.verdict, 'INCERTAIN'); assert.strictEqual(r.execution.verrou, 'tenu');
    assert.strictEqual(P.lireVerrou(dv, ref).operation_hash, o.operation_hash);
    assert.strictEqual(P.lireIssue(dv, ref, o.operation_hash).issue, 'exception');
    const m2 = monde(); r = appel(C, () => { m2.s.appels++; }, dv, m2);
    assert.strictEqual(r.execution.refus, 'EXECUTION_CONCURRENTE'); assert.strictEqual(m2.s.appels, 0);
    assert.match(r.execution.detail, /verrou persistant tenu sur/);
    // Réconciliation : issue acquise + postconditions constatées → EXECUTE, verrou levé et archivé.
    let c = C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv });
    assert.strictEqual(c.verdict, 'EXECUTE'); assert.strictEqual(P.lireVerrou(dv, ref), null);
    assert.ok(fs.readdirSync(dv).some((f) => f.startsWith(`issue-${ref}-${o.operation_hash}.libere-`)), 'l\'issue est archivée avec le verrou');
    // Interruption sans effet → NON_APPLIQUEE, verrou levé.
    dv = tmpd(); m = monde();
    appel(C, () => { throw new Error('refusé avant écriture'); }, dv, m);
    c = C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv });
    assert.strictEqual(c.verdict, 'NON_APPLIQUEE'); assert.strictEqual(P.lireVerrou(dv, ref), null);
    // État intermédiaire → INDETERMINE, verrou tenu.
    dv = tmpd(); m = monde(); let ecrit = false;
    m.lecteur.mesures = (noms) => Object.fromEntries(noms.map((k) => [k, k === 'registre_taille' ? (ecrit ? 311 : 310) : '20261011000000']));
    appel(C, () => { ecrit = true; throw new Error('coupure'); }, dv, m);
    c = C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv });
    assert.strictEqual(c.verdict, 'INDETERMINE'); assert.ok(P.lireVerrou(dv, ref));
    // Verrou d'un autre ordre : jamais réconcilié par celui-ci.
    dv = tmpd(); P.prendreVerrou(dv, { project_ref: ref, operation_hash: '9'.repeat(64) });
    assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: monde().lecteur, dirVerrous: dv }).verdict, 'VERROU_ETRANGER');
    assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: monde().lecteur, dirVerrous: tmpd() }).verdict, 'SANS_VERROU');
    // EXECUTE libère.
    dv = tmpd(); m = monde(); r = appel(C, () => { m.s.taille = 311; }, dv, m);
    assert.strictEqual(r.verdict, 'EXECUTE'); assert.strictEqual(P.lireVerrou(dv, ref), null);
    ok('consommer : verrou tenu après INCERTAIN, rejeu refusé avant l\'écrivain ; réconciliation EXECUTE / NON_APPLIQUEE lève, INDETERMINE et étranger gardent');

    muter('consommer-ordre', "  if (etatFinal === 'EXECUTE') P.libererVerrou(", "  if (etatFinal) P.libererVerrou(", 'libere-sur-incertain', (M) => {
      const d = tmpd(), mm = monde();
      const x = appel(M, () => { throw new Error('connexion perdue'); }, d, mm);
      assert.strictEqual(x.verdict, 'INCERTAIN'); assert.strictEqual(P.lireVerrou(d, ref), null, 'mutation : le verrou est levé sur une issue inconnue');
    });
    muter('consommer-ordre', "  if (mode === 'reel' && !dirVerrous) return refus(", "  if (false) return refus(", 'sans-repertoire', (M) => {
      // Sans la garde, le chemin du verrou est inconstructible, lu « illisible » donc tenu : l'écrivain reste à l'écart
      // (repli fermé), mais le refus accuse un verrou fantôme au lieu de nommer l'ordre malformé.
      let appele = 0; const x = appel(M, () => { appele++; }, undefined, monde());
      assert.strictEqual(appele, 0); assert.strictEqual(x.execution.refus, 'EXECUTION_CONCURRENTE', 'mutation : le diagnostic désigne un verrou qui n\'existe pas');
    });
    { let appele = 0; const x = appel(C, () => { appele++; }, undefined, monde()); assert.strictEqual(appele, 0); assert.strictEqual(x.execution.refus, 'ORDRE_MALFORME'); }
    ok('mutations consommer (verrou levé sur INCERTAIN ; sans répertoire, le refus perd sa cause) : les gardes se taisent');
  }

  // ================= 6. Cycle de vie asynchrone =================
  {
    const o = mk('test'), ref = o.cible.project_ref;
    const args = (M, ecrivain, dv, m, delaiMs = 40) => ({ ordre: o, go: go(o), lecteur: m.lecteur, ecrivain, etat: etat0(), habilites: HAB, maintenant: MAINT,
      executant: 'session-claude-habilitee', preuve: P.preflight({ ordre: o, temoins: bons(o), git: gitDouble(o) }).preuve, dirVerrous: dv, delaiMs });
    const differe = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
    const borne = (p, ms, nom) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`aucune issue en ${ms} ms — ${nom}`)), ms))]);

    await assert.rejects(C.consommerAsync({ ...args(C, () => {}, tmpd(), monde()), delaiMs: undefined }), /exige un délai/);
    // Écrivain qui résout avant le délai : constat normal.
    let dv = tmpd(), m = monde();
    let r = await C.consommerAsync(args(C, async () => { m.s.taille = 311; }, dv, m));
    assert.strictEqual(r.verdict, 'EXECUTE'); assert.strictEqual(P.lireVerrou(dv, ref), null);
    // Écrivain qui rejette : INCERTAIN, issue consignée, verrou tenu.
    dv = tmpd(); m = monde();
    r = await C.consommerAsync(args(C, async () => { m.s.taille = 311; throw new Error('commit refusé'); }, dv, m));
    assert.strictEqual(r.verdict, 'INCERTAIN'); assert.match(r.execution.detail, /écriture rejetée : commit refusé/);
    assert.strictEqual(P.lireIssue(dv, ref, o.operation_hash).issue, 'rejete'); assert.ok(P.lireVerrou(dv, ref));
    // Écrivain plus lent que le délai : INCERTAIN au délai, AUCUNE relecture ; l'issue tardive est consignée à son arrivée.
    dv = tmpd(); m = monde(); let d = differe(); let lu = 0;
    const lecteurCompte = { mesures: (noms) => { lu++; return m.lecteur.mesures(noms); } };
    r = await C.consommerAsync({ ...args(C, () => { m.s.taille = 311; return d.p; }, dv, m), lecteur: lecteurCompte });
    assert.strictEqual(r.verdict, 'INCERTAIN'); assert.match(r.execution.detail, /écrivain sans issue après 40 ms/);
    assert.strictEqual(lu, 1, 'une seule lecture (avant), jamais de relecture d\'un état intermédiaire');
    assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv }).verdict, 'ISSUE_NON_ACQUISE', 'base déjà à 311 mais issue inconnue : refuse de conclure');
    d.res(); await r.issueTardive;
    const it = P.lireIssue(dv, ref, o.operation_hash); assert.strictEqual(it.issue, 'resolu'); assert.strictEqual(it.tardive, true);
    assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv }).verdict, 'EXECUTE');
    // Issue tardive rejetée : consignée, rejet capté (pas d'unhandledRejection).
    dv = tmpd(); m = monde(); d = differe();
    let nonCapte = false; const sur = () => { nonCapte = true; }; process.on('unhandledRejection', sur);
    r = await C.consommerAsync(args(C, () => d.p, dv, m));
    d.rej(new Error('annulé')); await r.issueTardive; await new Promise((x) => setImmediate(x));
    process.off('unhandledRejection', sur);
    assert.strictEqual(nonCapte, false); assert.strictEqual(P.lireIssue(dv, ref, o.operation_hash).issue, 'rejete');
    assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: m.lecteur, dirVerrous: dv }).verdict, 'NON_APPLIQUEE');
    // Refus avant écriture : l'écrivain asynchrone n'est jamais appelé.
    let appele = 0;
    r = await C.consommerAsync({ ...args(C, async () => { appele++; }, tmpd(), monde()), go: null });
    assert.strictEqual(r.verdict, 'REFUS'); assert.strictEqual(appele, 0);
    ok('async : délai obligatoire ; rejet → INCERTAIN ; au délai → INCERTAIN sans relecture ; issue tardive consignée ; réconciliation seulement après issue');

    await muterAsync('consommer-ordre', '  const gagnant = await Promise.race([issue, new Promise((r) => { minuteur = setTimeout(() => r(DELAI), delaiMs); })]);', '  const gagnant = await issue;', 'sans-delai', async (M) => {
      const dd = differe();
      await assert.rejects(borne(M.consommerAsync(args(M, () => dd.p, tmpd(), monde())), 400, 'sans-delai'), /aucune issue en 400 ms/, 'mutation : sans délai, l\'exécutant attend sans fin');
    });
    await muterAsync('consommer-ordre', 'const noter = (issue) => { try { return P.noterIssue(ctx.dirVerrous, ctx.ref, ctx.hash, { ...issue, le: new Date().toISOString(), tardive: true }); } catch (e) { return false; } };',
      'const noter = () => false;', 'sans-issue-tardive', async (M) => {
        const dd = differe(), d2 = tmpd(), mm = monde();
        const x = await M.consommerAsync(args(M, () => { mm.s.taille = 311; return dd.p; }, d2, mm));
        dd.res(); await x.issueTardive;
        assert.strictEqual(C.reconcilierVerrou({ ordre: o, lecteur: mm.lecteur, dirVerrous: d2 }).verdict, 'ISSUE_NON_ACQUISE', 'mutation : l\'issue tardive n\'est jamais consignée, le verrou ne se lève plus');
      });
    await muterAsync('consommer-ordre', "  if (!issue) return { verdict: 'ISSUE_NON_ACQUISE'", "  if (false) return { verdict: 'ISSUE_NON_ACQUISE'", 'reconcilie-sans-issue', async (M) => {
      const dd = differe(), d2 = tmpd(), mm = monde();
      await M.consommerAsync(args(M, () => { mm.s.taille = 311; return dd.p; }, d2, mm));
      assert.strictEqual(M.reconcilierVerrou({ ordre: o, lecteur: mm.lecteur, dirVerrous: d2 }).verdict, 'EXECUTE', 'mutation : un état intermédiaire est déclaré EXECUTE avant que l\'écrivain ait rendu');
      dd.res();
    });
    await muterAsync('consommer-ordre', '  if (gagnant.err) return incertain(', '  if (false) return incertain(', 'rejet-ignore', async (M) => {
      const mm = monde();
      const x = await M.consommerAsync(args(M, async () => { mm.s.taille = 311; throw new Error('commit refusé'); }, tmpd(), mm));
      assert.strictEqual(x.verdict, 'EXECUTE', 'mutation : une écriture rejetée est déclarée EXECUTE');
    });
    ok('mutations async (délai retiré, issue tardive non consignée, réconciliation sans issue, rejet ignoré) : les gardes se taisent');
  }

  assert.deepStrictEqual(fs.readdirSync(path.join(__dirname, 'outils')).filter((f) => f.startsWith('.mut-')), [], 'aucune copie mutée ne reste');
  console.log(`\npreflight-reel : ${n} groupes d'épreuves passés.`);
})().catch((e) => { console.error(e); process.exit(1); });
