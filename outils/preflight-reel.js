// NEXUS-EXECUTOR-PREFLIGHT-REEL-1 — ce qu'un exécutant doit PROUVER avant d'écrire, au lieu de le déclarer.
//
// IDENTITÉ. Le projet n'est plus annoncé par le lecteur (`lecteur.projet()`) : deux témoins de sources distinctes
// le mesurent — `connexion` (la référence du projet portée par la connexion ouverte) et `sentinelle` (une valeur lue
// DANS la base). Tous deux doivent rendre `cible.project_ref`, qui doit valoir `ENVS[cible.env]`. Un témoin absent,
// illisible ou sans valeur → IDENTITE_NON_PROUVEE ; un témoin qui désigne un autre projet → PROJET_REEL_DIFFERENT.
//
// PROVENANCE. Pour une migration : le commit de l'ordre doit être atteignable depuis une ref désignée de
// l'environnement (`REFS_PROVENANCE`), le blob à `commit:chemin` doit être celui de l'ordre, et le contenu SQL lu doit
// se hacher (blob git : sha1("blob <taille>\0" + contenu)) en ce blob. L'écrivain reçoit CE contenu, jamais un SQL libre.
//
// VERROU. Un fichier par projet, créé atomiquement (`wx`) : il survit au processus. Il n'est libéré que sur EXECUTE,
// sur une réconciliation qui conclut, ou par un humain habilité qui nomme l'opération. Un verrou illisible est tenu.
//
// Aucun accès base, aucun réseau : les témoins, le lecteur git et le répertoire des verrous sont injectés.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const O = require('./ordre-execution');

const SOURCES_IDENTITE = Object.freeze(['connexion', 'sentinelle']);
const RE_PROJECT_REF = /^[a-z]{20}$/;
// Une migration appliquée sur un environnement doit être publiée sur une ref que cet environnement sert.
const REFS_PROVENANCE = Object.freeze({ production: Object.freeze(['origin/production']), test: Object.freeze(['origin/main', 'origin/production']) });
const MOTIFS_LIBERATION = Object.freeze(['EXECUTE', 'NON_APPLIQUEE', 'HUMAIN']);

const court = (e) => String(e && e.message || e).slice(0, 200);
const blobGit = (contenu) => {
  const b = Buffer.isBuffer(contenu) ? contenu : Buffer.from(String(contenu), 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
};

function prouverIdentite(ordre, temoins) {
  const attendu = ordre.cible.project_ref, vus = {};
  for (const s of SOURCES_IDENTITE) {
    if (!temoins || typeof temoins[s] !== 'function') return { codes: ['IDENTITE_NON_PROUVEE'], detail: `témoin « ${s} » absent : deux sources indépendantes sont exigées` };
    let v; try { v = temoins[s](ordre.cible.env); } catch (e) { return { codes: ['IDENTITE_NON_PROUVEE'], detail: `témoin « ${s} » illisible : ${court(e)}` }; }
    if (typeof v !== 'string' || !RE_PROJECT_REF.test(v)) return { codes: ['IDENTITE_NON_PROUVEE'], detail: `témoin « ${s} » sans référence de projet exploitable` };
    vus[s] = v;
  }
  const ecarts = SOURCES_IDENTITE.filter((s) => vus[s] !== attendu || vus[s] !== O.ENVS[ordre.cible.env]);
  if (ecarts.length) return { codes: ['PROJET_REEL_DIFFERENT'], detail: `témoin(s) ${ecarts.join(', ')} désignent ${ecarts.map((s) => vus[s]).join(', ')} au lieu de ${attendu}` };
  return { project_ref: attendu, temoins: vus };
}

function prouverProvenance(ordre, git, refs = REFS_PROVENANCE) {
  if (ordre.operation !== 'MIGRATION_APPLY') return { blob: null, sql: null, ref: null };
  const a = ordre.artefact, designees = refs[ordre.cible.env] || [];
  if (!git) return { codes: ['COMMIT_NON_ATTEIGNABLE'], detail: 'aucun lecteur git : provenance non mesurable' };
  let porteuse;
  try { porteuse = designees.find((r) => git.estAncetre(a.commit, r) === true); } catch (e) { return { codes: ['COMMIT_NON_ATTEIGNABLE'], detail: `atteignabilité non mesurable : ${court(e)}` }; }
  if (!porteuse) return { codes: ['COMMIT_NON_ATTEIGNABLE'], detail: `commit ${a.commit} non atteignable depuis ${designees.join(' ou ') || '(aucune ref désignée)'}` };
  let b; try { b = git.blobA(a.commit, a.chemin); } catch (e) { b = null; }
  if (b !== a.blob) return { codes: ['BLOB_COMMIT_DIFFERENT'], detail: `${a.chemin} au commit ${a.commit.slice(0, 12)} est ${b || 'absent'}, l'ordre désigne ${a.blob}` };
  let c; try { c = git.contenu(a.blob); } catch (e) { c = null; }
  if (c === null || c === undefined || blobGit(c) !== a.blob) return { codes: ['SQL_NON_LIE_AU_BLOB'], detail: `le contenu lu ne se hache pas en ${a.blob} : il ne sera pas transmis à l'écrivain` };
  return { blob: a.blob, sql: Buffer.isBuffer(c) ? c.toString('utf8') : String(c), ref: porteuse };
}

// Preflight complet. Rend { codes, detail } ou { preuve } ; la preuve est la seule source du projet, du blob et du SQL.
function preflight({ ordre, temoins, git, refs = REFS_PROVENANCE }) {
  const id = prouverIdentite(ordre, temoins);
  if (id.codes) return id;
  const pv = prouverProvenance(ordre, git, refs);
  if (pv.codes) return pv;
  const preuve = Object.freeze({ operation_hash: ordre.operation_hash, project_ref: id.project_ref, temoins: Object.freeze({ ...id.temoins }), blob: pv.blob, sql: pv.sql, ref_provenance: pv.ref });
  PREUVES.add(preuve);
  return { preuve };
}

// Seule une preuve émise par `preflight` dans ce processus est authentique : un objet recopié ou construit à la main,
// même identique champ pour champ, ne l'est pas.
const PREUVES = new WeakSet();
const preuveAuthentique = (preuve, ordre) => !!preuve && typeof preuve === 'object' && PREUVES.has(preuve) && !!ordre && preuve.operation_hash === ordre.operation_hash && preuve.project_ref === ordre.cible.project_ref;

// Lecteur git réel (lecture seule) ; les épreuves injectent un double.
function gitDepot(racine) {
  const g = (args) => execFileSync('git', ['-C', racine, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    estAncetre: (commit, ref) => { try { g(['merge-base', '--is-ancestor', commit, ref]); return true; } catch (e) { if (e.status === 1) return false; throw e; } },
    blobA: (commit, chemin) => { try { return g(['rev-parse', '--verify', '--quiet', `${commit}:${chemin}`]).toString().trim(); } catch (e) { return null; } },
    contenu: (blob) => g(['cat-file', 'blob', blob]),
  };
}

// ---- Verrou persistant, un par projet ----
const fichierVerrou = (dir, ref) => path.join(dir, `verrou-${ref}.json`);
const fichierIssue = (dir, ref, hash) => path.join(dir, `issue-${ref}-${hash}.json`);
const horodatage = () => new Date().toISOString().replace(/[:.]/g, '-');

// null = libre. Tout fichier présent mais inexploitable (vide, tronqué, sans hash) est un verrou TENU.
function lireVerrou(dir, ref) {
  let txt;
  try { txt = fs.readFileSync(fichierVerrou(dir, ref), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; return { project_ref: ref, illisible: true, detail: e.code }; }
  try { const v = JSON.parse(txt); if (v && typeof v === 'object' && typeof v.operation_hash === 'string' && v.operation_hash) return v; } catch (e) { /* tenu */ }
  return { project_ref: ref, illisible: true };
}

function prendreVerrou(dir, { project_ref, operation_hash, executant }) {
  fs.mkdirSync(dir, { recursive: true });
  const f = fichierVerrou(dir, project_ref);
  let fd;
  try { fd = fs.openSync(f, 'wx'); } catch (e) {
    if (e.code === 'EEXIST') return { codes: ['EXECUTION_CONCURRENTE'], tenu: lireVerrou(dir, project_ref) };
    throw e;
  }
  try { fs.writeSync(fd, JSON.stringify({ operation_hash, project_ref, executant: executant || null, pris_le: new Date().toISOString(), pid: process.pid }, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { fichier: f };
}

// Issue de l'écrivain, consignée tant que le verrou est tenu. Écrite une fois : une issue ne se réécrit pas.
function noterIssue(dir, ref, hash, issue) {
  try { fs.writeFileSync(fichierIssue(dir, ref, hash), JSON.stringify({ operation_hash: hash, project_ref: ref, ...issue }, null, 2) + '\n', { flag: 'wx' }); return true; } catch (e) { if (e.code === 'EEXIST') return false; throw e; }
}
function lireIssue(dir, ref, hash) {
  try { return JSON.parse(fs.readFileSync(fichierIssue(dir, ref, hash), 'utf8')); } catch (e) { return null; }
}

const envDuProjet = (ref) => Object.keys(O.ENVS).find((k) => O.ENVS[k] === ref);

// Libération : archivée (le fichier de verrou devient une trace), jamais un simple effacement. Un humain doit être
// habilité pour l'environnement et nommer l'opération qu'il libère (ou `illisible` pour un verrou inexploitable).
function libererVerrou(dir, ref, { operation_hash, motif, par }) {
  if (!MOTIFS_LIBERATION.includes(motif)) throw new Error(`motif de libération inconnu : ${motif}`);
  const v = lireVerrou(dir, ref);
  if (!v) throw new Error(`aucun verrou à libérer pour ${ref}`);
  const nomme = v.illisible ? 'illisible' : v.operation_hash;
  if (operation_hash !== nomme) throw new Error(`le verrou de ${ref} porte ${nomme}, pas ${operation_hash} : libération refusée`);
  if (motif === 'HUMAIN' && !((O.HABILITES[envDuProjet(ref)] || []).includes(par))) throw new Error(`libération humaine refusée : « ${par} » n'est pas habilité pour ${ref}`);
  if (motif !== 'HUMAIN' && v.illisible) throw new Error(`verrou illisible de ${ref} : seule une libération humaine le lève`);
  const s = horodatage();
  fs.writeFileSync(path.join(dir, `verrou-${ref}.libere-${s}.json`), JSON.stringify({ ...v, libere_le: new Date().toISOString(), motif, par: par || null }, null, 2) + '\n', { flag: 'wx' });
  if (!v.illisible && fs.existsSync(fichierIssue(dir, ref, v.operation_hash))) fs.renameSync(fichierIssue(dir, ref, v.operation_hash), path.join(dir, `issue-${ref}-${v.operation_hash}.libere-${s}.json`));
  fs.unlinkSync(fichierVerrou(dir, ref));
}

module.exports = { SOURCES_IDENTITE, REFS_PROVENANCE, MOTIFS_LIBERATION, blobGit, prouverIdentite, prouverProvenance, preflight, preuveAuthentique, gitDepot,
  lireVerrou, prendreVerrou, libererVerrou, noterIssue, lireIssue };
