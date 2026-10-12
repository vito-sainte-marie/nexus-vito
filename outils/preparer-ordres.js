'use strict';
// E3 de NEXUS-EXECUTOR-SUPABASE-1 : de la demande à l'ordre typé.
//
// Appelé par `handoff.js demande` quand `--depuis <ref>` est donné. Le diff
// `<ref>..HEAD` (statut + chemin) est la SEULE source de l'opération : la prose
// du corps n'est jamais lue. Rien n'est deviné : ni la ref (pas de défaut), ni la
// cible (`--cible-env`), ni les mesures (`--precondition k=v`, `--postcondition
// k=v`, relevées en lecture seule par l'exécutant habilité), ni le retour arrière.
// Un ordre n'est pas une autorisation : ce module ne produit que l'ordre et la
// désignation de l'exécutant. Le GO viendra ensuite, lié au hash.
const { detecter, GESTES } = require('./detecter-operation');
const O = require('./ordre-execution');
const { routerGeste } = require('./capacites-canal');

function mesures(liste, nom) {
  const m = {};
  for (const kv of liste || []) {
    const i = String(kv).indexOf('=');
    if (i < 1) return { erreur: `${nom} « ${kv} » : attendu cle=valeur` };
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (Object.prototype.hasOwnProperty.call(m, k)) return { erreur: `${nom} « ${k} » en double` };
    m[k] = /^-?[0-9]+$/.test(v) ? Number(v) : v;
  }
  return { m };
}

// io = { changements(depuis) -> [{statut,chemin}], blob(chemin) -> sha1, commit() -> sha1 }
function preparer({ reg, io, opts, lot, seq, canal, maintenant = new Date() }) {
  if (opts.depuis === undefined) {
    if (opts.cibleEnv !== undefined) return { erreurs: ['--cible-env sans --depuis : le diff de référence n\'est pas désigné'] };
    return { ordres: [], erreurs: [] };
  }
  const changements = io.changements(opts.depuis);
  const { operations, refus } = detecter(changements, opts.cibleEnv);
  if (refus.length) return { erreurs: refus.map((r) => `${r.code}${r.chemin ? ` (${r.chemin})` : ''}`) };
  if (!operations.length) return { ordres: [], erreurs: [] };
  // Pré- et postconditions sont données une fois pour la demande : elles ne décrivent qu'UNE opération. Avec deux,
  // l'ordre 2 attendrait l'état d'avant l'ordre 1 et rendrait PRECONDITION_FAUSSE. Une migration par demande.
  if (operations.length > 1) return { erreurs: [`DEMANDE_MULTI_OPERATIONS (${operations.length} : ${operations.map((op) => op.chemin).join(', ')}) — une seule migration par demande`] };
  const pre = mesures(opts.preconditions, 'precondition'), post = mesures(opts.postconditions, 'postcondition');
  if (pre.erreur || post.erreur) return { erreurs: [pre.erreur || post.erreur].filter(Boolean) };
  if (!opts.retourArriere) return { erreurs: ['--retour-arriere manquant (référence, ou « aucun, justifié : … »)'] };
  const heures = opts.expireHeures === undefined ? 24 : Number(opts.expireHeures);
  if (!(heures > 0 && heures <= 168)) return { erreurs: ['--expire-heures hors de ]0 ; 168]'] };
  const commit = io.commit();
  const ordres = [], erreurs = [];
  operations.forEach((op, i) => {
    const geste = GESTES[op.operation][op.env];
    const route = routerGeste(reg, geste, canal);
    if (route.defaut) { erreurs.push(`GESTE_INCONNU (${geste})`); return; }
    if (!route.executant) { erreurs.push(`CAPACITE_SANS_EXECUTANT (${route.capacite})`); return; }
    const ordre = O.construire({
      operation: op.operation, lot, request: `request-${seq}`,
      cible: { env: op.env, project_ref: op.project_ref },
      artefact: { chemin: op.chemin, blob: io.blob(op.chemin), commit },
      preconditions: pre.m, postconditions: post.m, retour_arriere: opts.retourArriere,
      cree_le: maintenant.toISOString(), expire_le: new Date(maintenant.getTime() + heures * 3600e3).toISOString(),
    });
    const inv = O.valider(ordre, { maintenant });
    if (inv.length) { erreurs.push(`ORDRE_INVALIDE [${inv.join(',')}] (${op.chemin})`); return; }
    ordres.push({ fichier: `order-${seq}-${i + 1}.json`, ordre, route: { geste, capacite: route.capacite, etat: route.etat, executant: route.executant, owner: route.owner || null } });
  });
  return { ordres, erreurs };
}

module.exports = { preparer, mesures };
