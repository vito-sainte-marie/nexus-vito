#!/usr/bin/env node
'use strict';
// Détection d'une opération Supabase par la NATURE de l'artefact — E2 de
// NEXUS-EXECUTOR-SUPABASE-1.
//
// Ce n'est pas la prose d'une demande qui dit qu'une migration est nécessaire,
// c'est le diff : un fichier `supabase/migrations/<14 chiffres>_<nom>.sql`
// ajouté. Ce module lit une liste de changements déjà extraite (statut +
// chemin), jamais le dépôt ni la base, et la traduit en opérations typées
// (`ordre-execution.js`) puis en route : quelle capacité, quel canal, quel
// exécutant, via `capacites-canal.routerGeste` et la table `gestes` du registre.
//
// Refus plutôt que silence. La cible est toujours explicite (jamais de défaut :
// une cible Production se mesure, elle ne se devine pas). Une migration existante
// est immuable : modifiée, supprimée ou renommée, elle est refusée, car le blob
// désigné par un GO ne doit jamais bouger. Un fichier dans `supabase/migrations/`
// qui n'a pas la forme d'une migration est refusé, pas ignoré.

const { ENVS } = require('./ordre-execution');

const RE_MIGRATION = /^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/;
const DOSSIER = 'supabase/migrations/';
const GESTES = Object.freeze({
  MIGRATION_APPLY: { test: 'SUPABASE_TEST_MIGRATION', production: 'SUPABASE_PRODUCTION_MUTATION' },
  SYNC_REGISTRE: { test: 'SUPABASE_TEST_MIGRATION', production: 'SUPABASE_PRODUCTION_MUTATION' },
  LECTURE_CONTROLE: { test: 'SUPABASE_TEST_CONTROLE', production: 'SUPABASE_PRODUCTION_CONTROLE' },
});

function detecter(changements, env) {
  const refus = [];
  const operations = [];
  if (!env || !Object.prototype.hasOwnProperty.call(ENVS, env)) {
    return { operations, refus: [{ code: 'CIBLE_NON_DESIGNEE', chemin: null }] };
  }
  for (const c of Array.isArray(changements) ? changements : []) {
    const chemin = String((c && c.chemin) || '');
    if (chemin.includes('..')) { refus.push({ code: 'CHEMIN_SUSPECT', chemin }); continue; }
    if (!chemin.startsWith(DOSSIER)) continue;
    if (!RE_MIGRATION.test(chemin)) { refus.push({ code: 'MIGRATION_NOM_INVALIDE', chemin }); continue; }
    if (c.statut !== 'A') { refus.push({ code: 'MIGRATION_IMMUABLE', chemin }); continue; }
    operations.push({ operation: 'MIGRATION_APPLY', chemin, env, project_ref: ENVS[env] });
  }
  operations.sort((a, b) => (a.chemin < b.chemin ? -1 : 1));
  return { operations, refus };
}

// `reg` = CAPACITES-CANAL.json déjà chargé ; `canal` = canal qui vient d'être
// saisi de la demande. Une opération dont le geste manque à la table est un
// défaut (jamais un passage) ; une opération sans exécutant est un blocage
// réel (CAPACITE_SANS_EXECUTANT), pas un oubli de transport.
function router(reg, changements, env, canal, routerGeste) {
  const { operations, refus } = detecter(changements, env);
  const routes = operations.map((op) => {
    const geste = GESTES[op.operation][env];
    const r = routerGeste(reg, geste, canal);
    return { ...op, geste, ...r };
  });
  const defauts = routes.filter((r) => r.defaut).map((r) => ({ code: 'GESTE_INCONNU', chemin: r.chemin, geste: r.geste }));
  const sansExecutant = routes.filter((r) => !r.defaut && !r.executant).map((r) => ({ code: 'CAPACITE_SANS_EXECUTANT', chemin: r.chemin }));
  const bloquants = [...refus, ...defauts, ...sansExecutant];
  const delegue = routes.filter((r) => !r.defaut && r.executant && r.etat !== 'OK');
  return { routes, refus: bloquants, bloque: bloquants.length > 0, delegue: delegue.length > 0 };
}

module.exports = { RE_MIGRATION, GESTES, detecter, router };
