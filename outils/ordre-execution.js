#!/usr/bin/env node
'use strict';
// Ordre d'exécution Supabase — NEXUS-EXECUTOR-SUPABASE-1, étape E1.
//
// CE QUE C'EST. Un `order-N.json` décrit UNE opération sur UNE cible. Ce n'est
// jamais une autorisation : il dit ce qu'on demande, pas que c'est permis. Le GO
// (humain pour Production) cite le SHA-256 exact de l'ordre ; l'exécutant
// recalcule ce hash et refuse au moindre écart. Un GO ne couvre donc jamais une
// autre opération que celle qu'il désigne.
//
// CE QUE ÇA NE FAIT PAS. Aucun accès base, aucun réseau, aucun secret, aucune
// écriture : des fonctions pures sur des données passées en argument. Les
// mesures « réelles » (projet, blob, préconditions) sont fournies par
// l'exécutant ; ce module décide seulement si elles correspondent.
//
// PAS DE SQL LIBRE. Les types d'opération sont une liste fermée. Une migration
// est désignée par son chemin et son blob git (immuable), une lecture par un
// identifiant de contrôle d'un catalogue, une mesure par un nom d'une grammaire
// fermée. Tout champ inconnu est refusé : c'est ainsi qu'un champ `sql` ne peut
// pas entrer par la porte de service.
//
// INTERRUPTION. Un ordre en cours dont on ne connaît pas l'issue n'est jamais
// rejoué : il passe `EXECUTION_INCERTAINE`, et seule une réconciliation en
// lecture seule (postconditions → APPLIQUEE, préconditions → NON_APPLIQUEE,
// sinon INDETERMINE) le sort de là.

const crypto = require('crypto');

const TYPES = Object.freeze(['MIGRATION_APPLY', 'LECTURE_CONTROLE', 'SYNC_REGISTRE']);
const ENVS = Object.freeze({
  test: 'udljdqxerrbbbajxubfn',
  production: 'uzhjpqpctpvxytxpxoqz',
});
// Contrôles de lecture connus. Ajouter un contrôle est une édition de ce
// catalogue, relue, jamais un champ libre d'un ordre.
const CONTROLES_LECTURE = Object.freeze(['REGISTRE_MIGRATIONS', 'MD5_FONCTIONS', 'ACL_FONCTIONS', 'RLS_TABLES']);

const CHAMPS_ORDRE = Object.freeze([
  'schema', 'operation', 'lot', 'request', 'cible', 'artefact', 'controle', 'versions',
  'preconditions', 'postconditions', 'retour_arriere', 'cree_le', 'expire_le', 'usage_unique', 'operation_hash',
]);
const RE_MESURE = /^(registre_taille|registre_derniere_version|fonction_md5\.[a-z_0-9]{1,63}|objet_absent\.[a-z_0-9]{1,63}\.[a-z_0-9]{1,63})$/;
// Une valeur vide, ou un « undefined »/« null » sorti d'un String() sur une mesure absente, ne désigne rien.
const RE_VALEUR = /^[A-Za-z0-9_.:\-]{1,128}$/;
const VALEURS_VIDES = Object.freeze(['undefined', 'null', 'NaN']);
const RE_CHEMIN = /^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/;
const RE_SHA1 = /^[0-9a-f]{40}$/;
const RE_VERSION = /^[0-9]{14}$/;
const RE_HASH = /^[0-9a-f]{64}$/;

const CODES_REFUS = Object.freeze([
  'ORDRE_MALFORME', 'CHAMP_INCONNU', 'TYPE_INCONNU', 'SQL_LIBRE', 'CIBLE_INCONNUE', 'PROJET_INCOHERENT',
  'HASH_ABSENT', 'HASH_ORDRE_INVALIDE', 'EXPIRE', 'USAGE_UNIQUE_REQUIS', 'ARTEFACT_INVALIDE',
  'GO_ABSENT', 'GO_HASH_DIFFERENT', 'GO_ACTEUR_NON_HABILITE', 'GO_ENV_DIFFERENT',
  'PROJET_REEL_DIFFERENT', 'BLOB_REEL_DIFFERENT', 'PRECONDITION_FAUSSE',
  'DEJA_CONSOMME', 'EXECUTION_CONCURRENTE', 'EXECUTION_INCERTAINE_NON_RECONCILIEE', 'POSTCONDITION_INSUFFISANTE',
]);

function canonique(v) {
  if (Array.isArray(v)) return '[' + v.map(canonique).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonique(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
function hashOrdre(ordre) {
  const { operation_hash: _ignore, ...reste } = ordre;
  return crypto.createHash('sha256').update(canonique(reste)).digest('hex');
}

function mesuresValides(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
  const cles = Object.keys(m);
  if (cles.length === 0) return false;
  return cles.every((k) => RE_MESURE.test(k) && ['string', 'number'].includes(typeof m[k]) && RE_VALEUR.test(String(m[k])) && !VALEURS_VIDES.includes(String(m[k])));
}
// Une mesure présente vaut sa valeur attendue ; une mesure absente n'est jamais égale à rien.
const mesureEgale = (mesures, k, v) => !!mesures && Object.prototype.hasOwnProperty.call(mesures, k) && mesures[k] !== undefined && mesures[k] !== null && String(mesures[k]) === String(v);

// Une écriture doit laisser une trace que l'état de départ ne peut pas avoir : au moins une mesure commune aux
// pré- et postconditions change de valeur. Sinon `reconcilier` dirait APPLIQUEE avant toute écriture. Une migration
// doit en outre nommer sa propre version comme dernière version du registre.
function postconditionsSuffisantes(ordre) {
  const pre = ordre.preconditions, post = ordre.postconditions;
  if (!Object.keys(post).some((k) => Object.prototype.hasOwnProperty.call(pre, k) && String(pre[k]) !== String(post[k]))) return false;
  if (ordre.operation === 'MIGRATION_APPLY') {
    const version = ((ordre.artefact && ordre.artefact.chemin) || '').replace(/^supabase\/migrations\//, '').slice(0, 14);
    if (String(post.registre_derniere_version) !== version) return false;
  }
  return true;
}

// Validation structurelle. Rend la liste des codes de refus ; vide = recevable.
function valider(ordre, { maintenant = new Date() } = {}) {
  const r = [];
  if (!ordre || typeof ordre !== 'object' || Array.isArray(ordre)) return ['ORDRE_MALFORME'];
  for (const k of Object.keys(ordre)) {
    if (/^(sql|query|statement|script|commande|requete)$/i.test(k)) r.push('SQL_LIBRE');
    else if (!CHAMPS_ORDRE.includes(k)) r.push('CHAMP_INCONNU');
  }
  if (!TYPES.includes(ordre.operation)) r.push('TYPE_INCONNU');
  if (!ordre.lot || !ordre.request) r.push('ORDRE_MALFORME');
  const c = ordre.cible;
  if (!c || !Object.prototype.hasOwnProperty.call(ENVS, c.env)) r.push('CIBLE_INCONNUE');
  else if (ENVS[c.env] !== c.project_ref) r.push('PROJET_INCOHERENT');
  if (ordre.operation === 'MIGRATION_APPLY') {
    const a = ordre.artefact;
    if (!a || !RE_CHEMIN.test(a.chemin || '') || !RE_SHA1.test(a.blob || '') || !RE_SHA1.test(a.commit || '')) r.push('ARTEFACT_INVALIDE');
  } else if (ordre.artefact !== undefined) r.push('ARTEFACT_INVALIDE');
  if (ordre.operation === 'LECTURE_CONTROLE' && !CONTROLES_LECTURE.includes(ordre.controle)) r.push('TYPE_INCONNU');
  if (ordre.operation === 'SYNC_REGISTRE' && !(Array.isArray(ordre.versions) && ordre.versions.length > 0 && ordre.versions.every((v) => RE_VERSION.test(v)))) r.push('ORDRE_MALFORME');
  if (!mesuresValides(ordre.preconditions) || !mesuresValides(ordre.postconditions)) r.push('ORDRE_MALFORME');
  else if (ordre.operation !== 'LECTURE_CONTROLE' && !postconditionsSuffisantes(ordre)) r.push('POSTCONDITION_INSUFFISANTE');
  if (typeof ordre.retour_arriere !== 'string' || !ordre.retour_arriere) r.push('ORDRE_MALFORME');
  if (ordre.usage_unique !== true) r.push('USAGE_UNIQUE_REQUIS');
  const exp = Date.parse(ordre.expire_le), cree = Date.parse(ordre.cree_le);
  if (Number.isNaN(exp) || Number.isNaN(cree) || exp <= cree) r.push('ORDRE_MALFORME');
  else if (exp <= maintenant.getTime()) r.push('EXPIRE');
  if (!ordre.operation_hash) r.push('HASH_ABSENT');
  else if (!RE_HASH.test(ordre.operation_hash) || ordre.operation_hash !== hashOrdre(ordre)) r.push('HASH_ORDRE_INVALIDE');
  return [...new Set(r)];
}

function construire(spec) {
  const ordre = { schema: 'nexus-ordre-execution/1', usage_unique: true, ...spec };
  ordre.operation_hash = hashOrdre(ordre);
  return ordre;
}

// Un GO n'est valable que pour le hash qu'il cite, dans l'environnement qu'il
// vise, donné par un acteur habilité pour cet environnement.
function autoriser(ordre, go, { habilites, maintenant = new Date() }) {
  const r = valider(ordre, { maintenant });
  if (r.length) return r;
  if (!go || typeof go !== 'object') return ['GO_ABSENT'];
  if (go.operation_hash !== ordre.operation_hash) return ['GO_HASH_DIFFERENT'];
  if (go.env !== ordre.cible.env) return ['GO_ENV_DIFFERENT'];
  const liste = (habilites && habilites[ordre.cible.env]) || [];
  if (!liste.includes(go.acteur)) return ['GO_ACTEUR_NON_HABILITE'];
  return [];
}

// Dernier rempart avant toute écriture, rejoué par l'exécutant sur du réel.
// `etat` = { consommes:[hash], verrou:{operation_hash,project_ref}|null, incertains:[hash] }.
function peutExecuter(ordre, go, reel, etat, { habilites, maintenant = new Date() }) {
  const a = autoriser(ordre, go, { habilites, maintenant });
  if (a.length) return a;
  const e = valider(ordre, { maintenant });
  if (e.length) return e;
  if (etat.consommes.includes(ordre.operation_hash)) return ['DEJA_CONSOMME'];
  if ((etat.incertains || []).includes(ordre.operation_hash)) return ['EXECUTION_INCERTAINE_NON_RECONCILIEE'];
  if (etat.verrou && etat.verrou.project_ref === ordre.cible.project_ref) return ['EXECUTION_CONCURRENTE'];
  if (!reel || reel.project_ref !== ordre.cible.project_ref) return ['PROJET_REEL_DIFFERENT'];
  if (ordre.operation === 'MIGRATION_APPLY' && reel.blob !== ordre.artefact.blob) return ['BLOB_REEL_DIFFERENT'];
  const m = reel.mesures || {};
  for (const [k, v] of Object.entries(ordre.preconditions)) if (!mesureEgale(m, k, v)) return ['PRECONDITION_FAUSSE'];
  return [];
}

// États d'exécution et transitions : liste fermée.
const TRANSITIONS = Object.freeze({
  ORDRE_CREE: { autorise: 'AUTORISE', refuse: 'REFUSE' },
  AUTORISE: { demarre: 'EXECUTION_EN_COURS', refuse: 'REFUSE' },
  EXECUTION_EN_COURS: { termine: 'EXECUTE', echoue: 'REFUSE', interrompu: 'EXECUTION_INCERTAINE' },
  EXECUTION_INCERTAINE: { reconcilie_appliquee: 'EXECUTE', reconcilie_non_appliquee: 'AUTORISE', reconcilie_indetermine: 'EXECUTION_INCERTAINE' },
  EXECUTE: {},
  REFUSE: {},
});
function transition(etat, evenement) {
  const t = TRANSITIONS[etat];
  if (!t || !Object.prototype.hasOwnProperty.call(t, evenement)) throw new Error(`transition interdite : ${etat} --${evenement}-->`);
  return t[evenement];
}

// Lecture seule. N'écrit rien, ne relance rien : classe l'état réel.
function reconcilier(ordre, mesures) {
  const egal = (cond) => Object.entries(cond).every(([k, v]) => mesureEgale(mesures, k, v));
  if (egal(ordre.postconditions)) return 'APPLIQUEE';
  if (egal(ordre.preconditions)) return 'NON_APPLIQUEE';
  return 'INDETERMINE';
}

// Qui peut donner un GO, par environnement. Source unique : le CLI de consommer-ordre.js la relit ici.
const HABILITES = Object.freeze({ production: ['vito-sainte-marie'], test: ['arbitre-chatgpt', 'vito-sainte-marie'] });

// Retour `execution-N` : doit être vérifiable et permettre la reprise.
// Le GO qu'il porte n'est pas cru sur parole : même environnement que l'ordre, acteur habilité, et pour
// Production une décision approuvée du lot qui cite le hash exact (`hashesApprouves`, calculé par l'appelant).
function validerExecution(exec, ordre, { habilites = HABILITES, hashesApprouves } = {}) {
  const r = [];
  if (!exec || typeof exec !== 'object') return ['ORDRE_MALFORME'];
  if (exec.operation_hash !== ordre.operation_hash) r.push('GO_HASH_DIFFERENT');
  if (!Object.keys(TRANSITIONS).includes(exec.etat)) r.push('ORDRE_MALFORME');
  if (!exec.executant || !exec.go || !exec.go.acteur || exec.go.operation_hash !== ordre.operation_hash) r.push('GO_ABSENT');
  if (exec.go && exec.go.acteur && exec.go.operation_hash === ordre.operation_hash) {
    if (exec.go.env !== ordre.cible.env) r.push('GO_ENV_DIFFERENT');
    if (!((habilites || {})[ordre.cible.env] || []).includes(exec.go.acteur)) r.push('GO_ACTEUR_NON_HABILITE');
  }
  if (ordre.cible.env === 'production' && !(hashesApprouves || []).includes(ordre.operation_hash)) r.push('GO_SANS_DECISION');
  if (!exec.mesures_avant || !exec.mesures_apres) r.push('ORDRE_MALFORME');
  const d = Date.parse(exec.debut), f = Date.parse(exec.fin);
  if (Number.isNaN(d) || Number.isNaN(f) || f < d) r.push('ORDRE_MALFORME');
  if (exec.etat === 'EXECUTE') {
    for (const [k, v] of Object.entries(ordre.postconditions)) if (!mesureEgale(exec.mesures_apres, k, v)) r.push('PRECONDITION_FAUSSE');
  }
  if (exec.etat === 'REFUSE' && !CODES_REFUS.includes(exec.refus)) r.push('ORDRE_MALFORME');
  if (!exec.reprise || !exec.reprise.prochaine_action) r.push('ORDRE_MALFORME');
  return [...new Set(r)];
}

module.exports = {
  TYPES, ENVS, CONTROLES_LECTURE, CODES_REFUS, TRANSITIONS, HABILITES,
  canonique, hashOrdre, construire, valider, autoriser, peutExecuter, transition, reconcilier, validerExecution,
};
