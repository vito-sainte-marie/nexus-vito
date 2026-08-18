// Test — Task #480 "Brancher Brief/Rapport sur les indicateurs économiques
// carburant validés" (18/08/2026). Couvre les deux briques pures ajoutées :
//
// 1. NexusCarburantMoteur.resumerEffetPrixCarburants (nexus-carburant-moteur.js)
//    — réduit un map {cle: effetPrixStockHerite} à UN SEUL carburant à
//    mettre en avant (Brief/Rapport n'ont la place que pour une ligne,
//    contrairement au détail complet de Carburants Pilotage).
//
// 2. NexusRapportDirectionMoteur.construireChapitreCarburants (nexus-rapport-
//    direction-moteur.js) — economieDisponible bascule sur du réel au lieu
//    d'être toujours false.
//
// Chemin relatif à __dirname (convention établie), require() direct des
// vrais fichiers moteur, jamais réécrits ici.

const assert = require('assert');

require(__dirname + '/nexus-carburant-moteur.js');
const M = global.NexusCarburantMoteur;
require(__dirname + '/nexus-rapport-direction-moteur.js');
const R = global.NexusRapportDirectionMoteur;

function effet(sens, effetTotal, suffisant = true) {
  return { suffisant, sens, effetTotal, effetParLitre: null, margeReelleStockHerite: null, margeReference: null };
}

// ------------------------------------------------------------
// resumerEffetPrixCarburants
// ------------------------------------------------------------
(() => {
  assert.strictEqual(M.resumerEffetPrixCarburants({}), null, 'Map vide -> null');
  assert.strictEqual(M.resumerEffetPrixCarburants(null), null, 'null en entrée -> null, jamais une exception');
  assert.strictEqual(M.resumerEffetPrixCarburants(undefined), null, 'undefined en entrée -> null');
})();

(() => {
  // Aucun carburant suffisant (aucun coût d'achat saisi nulle part) -> null.
  const r = M.resumerEffetPrixCarburants({ go: effet('neutre', 0, false), sp95: effet('favorable', 100, false) });
  assert.strictEqual(r, null, 'Aucun carburant avec suffisant=true -> null');
})();

(() => {
  // Un défavorable et un favorable en même temps -> le défavorable gagne
  // toujours (le risque à signaler prime), jamais une moyenne/somme qui les
  // ferait s'annuler silencieusement (Article 5).
  const effets = { go: effet('favorable', 500), sp95: effet('defavorable', 200) };
  const r = M.resumerEffetPrixCarburants(effets);
  assert.strictEqual(r.cle, 'sp95', 'Le défavorable doit toujours primer sur un favorable, même de montant inférieur');
})();

(() => {
  // Deux défavorables -> le plus significatif en valeur absolue gagne.
  const effets = { go: effet('defavorable', -150), sp95: effet('defavorable', -600), gnr: effet('defavorable', -80) };
  const r = M.resumerEffetPrixCarburants(effets);
  assert.strictEqual(r.cle, 'sp95', 'Parmi plusieurs défavorables, le plus significatif (valeur absolue) doit être retenu');
})();

(() => {
  // Uniquement des favorables -> le plus significatif gagne (pas de risque
  // à signaler, mais toujours le chiffre le plus parlant).
  const effets = { go: effet('favorable', 90), gnr: effet('favorable', 340) };
  const r = M.resumerEffetPrixCarburants(effets);
  assert.strictEqual(r.cle, 'gnr', 'Parmi plusieurs favorables, le plus significatif doit être retenu');
})();

(() => {
  // Tous neutres (coût moyen aligné avec le dernier coût d'achat) -> repli
  // sur le premier carburant disponible, jamais null (il y a bien une
  // donnée, juste rien de notable).
  const effets = { go: effet('neutre', 0), sp95: effet('neutre', 0) };
  const r = M.resumerEffetPrixCarburants(effets);
  assert.ok(r && (r.cle === 'go' || r.cle === 'sp95'), 'Tous neutres mais suffisants -> un carburant est quand même retenu, jamais null');
})();

console.log('OK — resumerEffetPrixCarburants : 6/6 scénarios passent.');

// ------------------------------------------------------------
// construireChapitreCarburants — economieDisponible
// ------------------------------------------------------------
(() => {
  const chapitre = R.construireChapitreCarburants({
    disponible: true, mix: { go: { litres: 1000, pct: 1 }, total: 1000 }, evolution: 0.05,
    produitMoteur: null, moteurEvolution: null, couvertureIncertaine: false,
    effetPrixResume: null,
  });
  assert.strictEqual(chapitre.economieDisponible, false, 'Aucun effetPrixResume -> economieDisponible false');
  assert.ok(chapitre.economieNote, 'Une note explicative doit être présente quand indisponible');
  assert.strictEqual(chapitre.economieCle, null);
  assert.strictEqual(chapitre.economieEffet, null);
})();

(() => {
  const effetGo = effet('defavorable', -420);
  const chapitre = R.construireChapitreCarburants({
    disponible: true, mix: { go: { litres: 1000, pct: 1 }, total: 1000 }, evolution: 0.05,
    produitMoteur: null, moteurEvolution: null, couvertureIncertaine: false,
    effetPrixResume: { cle: 'go', effet: effetGo },
  });
  assert.strictEqual(chapitre.economieDisponible, true, 'effetPrixResume présent -> economieDisponible true');
  assert.strictEqual(chapitre.economieCle, 'go');
  assert.strictEqual(chapitre.economieEffet, effetGo);
  assert.strictEqual(chapitre.economieNote, null, 'Pas de note "insuffisant" quand une vraie donnée existe');
  // Le reste du chapitre (mix/évolution/stockNote) doit rester inchangé —
  // cette tâche ne touche jamais à la partie déjà construite (Article 11).
  assert.strictEqual(chapitre.stockDisponible, false);
  assert.ok(chapitre.stockNote.includes('Phase 2'));
})();

(() => {
  // Chapitre non disponible (aucune vente carburant sur la période) ->
  // court-circuit avant même d'atteindre economieDisponible, comportement
  // inchangé.
  const chapitre = R.construireChapitreCarburants({ disponible: false, raison: 'Aucune vente carburant ne couvre la période.' });
  assert.strictEqual(chapitre.disponible, false);
  assert.strictEqual(chapitre.economieDisponible, undefined, 'Chapitre indisponible -> pas de champ économie du tout, comportement inchangé');
})();

console.log('OK — construireChapitreCarburants : economieDisponible reflète bien effetPrixResume, reste inchangé sinon.');
console.log('\nTous les tests "Task #480 — Brief/Rapport indicateurs économiques carburant" passent.');
