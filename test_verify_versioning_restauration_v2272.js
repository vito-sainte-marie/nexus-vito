// Test — v2.272 (29/08/2026) : nexus-verify-moteur.js — versioning /
// restauration des audits de caisse (retour de Frédéric "CORRECTIF VERIFY —
// Sécurisation Date/Quart et restauration", points 5/6/7/10). Fonctions
// pures uniquement — aucun accès Supabase ici (couvert séparément par
// vérification manuelle de la migration + relecture du code de branchement,
// documenté dans le Data Dictionary).

const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-verify-moteur.js'));
const M = globalThis.NexusVerifyMoteur;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) libelleActionVersion — les 4 actions réelles, jamais un libellé
// technique brut affiché tel quel pour une action connue.
// ------------------------------------------------------------
{
  assert.strictEqual(M.libelleActionVersion('modification'), 'Modification');
  assert.strictEqual(M.libelleActionVersion('validation_piste'), 'Validation Piste');
  assert.strictEqual(M.libelleActionVersion('validation_boutique'), 'Validation Boutique');
  assert.strictEqual(M.libelleActionVersion('restauration'), 'Restauration');
  assert.strictEqual(M.libelleActionVersion('inconnu'), 'inconnu', 'une action inconnue est affichée telle quelle, jamais masquée');
  assert.strictEqual(M.libelleActionVersion(null), '—');
  ok('libelleActionVersion — 4 actions réelles + repli honnête sur inconnu/absent');
}

// ------------------------------------------------------------
// 2) construireLigneVersion — auteur résolu via la map fournie, jamais une
// deuxième requête Supabase cachée dans une fonction "pure".
// ------------------------------------------------------------
{
  const version = {
    id: 'v1', created_at: '2026-08-28T19:53:23.447Z', action: 'validation_piste',
    acteur_id: 'fred-id', motif: null, version_precedente_id: null,
    valeurs: { ecart_piste: 2148.56 },
  };
  const ctx = { employesParId: { 'fred-id': { nom: 'Fred' } } };
  const ligne = M.construireLigneVersion(version, ctx);
  assert.strictEqual(ligne.auteurNom, 'Fred');
  assert.strictEqual(ligne.libelleAction, 'Validation Piste');
  assert.strictEqual(ligne.motif, null);
  assert.deepStrictEqual(ligne.valeurs, { ecart_piste: 2148.56 }, 'le snapshot complet est transmis tel quel, jamais recopié partiellement');

  const ligneSansCtx = M.construireLigneVersion({ ...version, acteur_id: null }, { employesParId: {} });
  assert.strictEqual(ligneSansCtx.auteurNom, '—', 'acteur absent -> "—", jamais une exception');

  ok('construireLigneVersion — auteur résolu via la map fournie, jamais une requête cachée');
}

// ------------------------------------------------------------
// 3) construireTimelineVersions — triée du plus récent au plus ancien,
// jamais l'inverse (même convention que la timeline FDJ existante).
// ------------------------------------------------------------
{
  const ctx = { employesParId: {} };
  const versions = [
    { id: 'v1', created_at: '2026-08-28T10:00:00Z', action: 'modification', valeurs: {} },
    { id: 'v3', created_at: '2026-08-28T20:00:00Z', action: 'validation_piste', valeurs: {} },
    { id: 'v2', created_at: '2026-08-28T15:00:00Z', action: 'validation_boutique', valeurs: {} },
  ];
  const timeline = M.construireTimelineVersions(versions, ctx);
  assert.deepStrictEqual(timeline.map(l => l.id), ['v3', 'v2', 'v1'], 'plus récent en premier');
  ok('construireTimelineVersions — triée du plus récent au plus ancien');
}

// ------------------------------------------------------------
// 4) construirePatchRestauration — jamais les champs d'identité (id, site,
// date, quart, created_at), tout le reste restauré tel quel (§7 : une
// restauration ne doit jamais déplacer la ligne).
// ------------------------------------------------------------
{
  const snapshot = {
    id: 'audit-1', site: 'vito-sainte-marie', date: '2026-08-28', quart: '1', created_at: '2026-08-28T19:22:30Z',
    ecart_piste: 2148.56, ecart_piste_valide: null, statut: 'critique', commentaire: null,
  };
  const patch = M.construirePatchRestauration(snapshot);
  assert.strictEqual(patch.id, undefined, 'id jamais restauré');
  assert.strictEqual(patch.site, undefined, 'site jamais restauré');
  assert.strictEqual(patch.date, undefined, 'date jamais restaurée');
  assert.strictEqual(patch.quart, undefined, 'quart jamais restauré');
  assert.strictEqual(patch.created_at, undefined, 'created_at jamais restauré');
  assert.strictEqual(patch.ecart_piste, 2148.56, 'les champs métier sont bien restaurés');
  assert.strictEqual(patch.statut, 'critique');

  const patchVide = M.construirePatchRestauration(null);
  assert.deepStrictEqual(patchVide, {}, 'snapshot absent -> patch vide, jamais une exception');

  ok('construirePatchRestauration — jamais les champs d\'identité, tout le reste restauré, jamais une exception sur un snapshot absent');
}

console.log(`\n${n} tests passés.`);
