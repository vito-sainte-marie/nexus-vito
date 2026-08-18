// Test — Cadrage risques Phase 2 (18/08/2026, tâche #231) "Reclasser les
// anciens constats" dans le Rapport de Direction.
//
// Couvre le changement de source des volets Marge de :
//   - construireAmeliorer()          (chapitres 13-14, "Ce qui doit progresser")
//   - construireSyntheseExecutive()  (chapitre 2, callout "Rentabilité sous pression")
//
// qui passent d'une comparaison de pairs instantanée
// (`chapitreMarge.classement.destructeurs`, sans mémoire dans le temps) à
// une lecture des signaux déjà QUALIFIÉS par NexusRisques
// (`signauxQualifies`, comparaison à la référence historique PROPRE de
// chaque catégorie, récurrence confirmée) — même discipline que la Phase 1
// (v2.51) avait déjà appliquée au chapitre 12.
//
// require() direct du vrai fichier moteur, jamais réécrit ici.

const assert = require('assert');

require(__dirname + '/nexus-rapport-direction-moteur.js');
const M = global.NexusRapportDirectionMoteur;

function signalMarge(sujet, niveau, extra) {
  return Object.assign({
    niveau, domaine: 'marge', sujet,
    phrase: `Marge ${sujet} — ${niveau}`,
    actionRecommandee: `Vérifiez le prix d'achat et les remises sur la catégorie ${sujet}.`,
    niveauConfiance: 'B', depuisLe: '2026-07-01',
  }, extra || {});
}

function chapitre2Vide() { return { axes: [] }; }

// ------------------------------------------------------------
// construireAmeliorer — volet Marge
// ------------------------------------------------------------
(() => {
  // Peer-comparison seule (destructeurs), AUCUN signal qualifié -> plus
  // aucun item Marge dans "Ce qui doit progresser" (Article 5 : une
  // catégorie sous la moyenne du magasin, sans récurrence propre confirmée,
  // n'est plus présentée comme un point à corriger).
  const chapitreMarge = {
    disponible: true,
    classement: { destructeurs: [{ nom: 'Boissons', ecartPts: -3.2 }], moteurs: [] },
  };
  const items = M.construireAmeliorer({
    chapitre2: chapitre2Vide(), chapitreMarge, operations: {}, chapitreCommerce: null,
    signauxQualifies: [],
  });
  assert.ok(!items.some(i => i.constat.startsWith('Marge')), 'Sans signal qualifié, aucun item "Marge ..." ne doit apparaître même si des destructeurs existent');
})();

(() => {
  // Un signal marge qualifié -> un item "Marge <sujet>" construit à partir
  // du signal (phrase/actionRecommandee), pas du classement de pairs.
  const chapitreMarge = { disponible: true, classement: { destructeurs: [], moteurs: [] } };
  const items = M.construireAmeliorer({
    chapitre2: chapitre2Vide(), chapitreMarge, operations: {}, chapitreCommerce: null,
    signauxQualifies: [signalMarge('Épicerie', 'exposition')],
  });
  const item = items.find(i => i.constat === 'Marge Épicerie');
  assert.ok(item, 'Un item "Marge Épicerie" doit être construit à partir du signal qualifié');
  assert.strictEqual(item.impact, 'Marge Épicerie — exposition');
  assert.ok(item.causeProbable.includes('référence historique propre'), 'La cause doit citer la référence historique propre, pas "à confirmer"');
  assert.strictEqual(item.actionProposee, "Vérifiez le prix d'achat et les remises sur la catégorie Épicerie.");
})();

(() => {
  // Plusieurs signaux marge -> triés du plus grave au moins grave
  // (risque_avere > exposition > signal_faible), jamais un ordre arbitraire.
  const chapitreMarge = { disponible: true, classement: { destructeurs: [], moteurs: [] } };
  const items = M.construireAmeliorer({
    chapitre2: chapitre2Vide(), chapitreMarge, operations: {}, chapitreCommerce: null,
    signauxQualifies: [
      signalMarge('Boissons', 'signal_faible'),
      signalMarge('Épicerie', 'risque_avere'),
      signalMarge('Snacking', 'exposition'),
    ],
  });
  const margeItems = items.filter(i => i.constat.startsWith('Marge'));
  assert.deepStrictEqual(margeItems.map(i => i.constat), ['Marge Épicerie', 'Marge Snacking', 'Marge Boissons'], 'Tri attendu : risque_avere, puis exposition, puis signal_faible');
})();

(() => {
  // Signaux d'un autre domaine (caisse) -> jamais mélangés dans le volet Marge.
  const chapitreMarge = { disponible: true, classement: { destructeurs: [], moteurs: [] } };
  const items = M.construireAmeliorer({
    chapitre2: chapitre2Vide(), chapitreMarge, operations: {}, chapitreCommerce: null,
    signauxQualifies: [{ niveau: 'exposition', domaine: 'caisse', sujet: 'Quart 1', phrase: 'Caisse...', actionRecommandee: null }],
  });
  assert.ok(!items.some(i => i.constat.startsWith('Marge')), 'Un signal domaine=caisse ne doit jamais produire un item "Marge ..."');
})();

(() => {
  // Les volets non-Marge (Commerce via chapitre2.axes, Opérations) restent
  // inchangés — hors périmètre de la Phase 2 (Phase 6, domaines non
  // encore branchés sur NexusRisques).
  const items = M.construireAmeliorer({
    chapitre2: { axes: [{ nom: 'Boissons', statut: 'En baisse', detail: '-8 % sur la période.' }] },
    chapitreMarge: { disponible: false },
    operations: { verify: { disponible: true, parStatut: { anomalie: 1, critique: 1 }, total: 5, composantePlusTouchee: 'Piste' } },
    chapitreCommerce: null,
    signauxQualifies: [],
  });
  assert.ok(items.some(i => i.constat === 'Boissons en baisse'), 'Le volet Commerce (chapitre2.axes) doit rester inchangé');
  assert.ok(items.some(i => i.constat === 'Écarts de caisse récurrents'), 'Le volet Opérations doit rester inchangé');
})();

console.log('OK — construireAmeliorer (Phase 2) : 5/5 scénarios passent.');

// ------------------------------------------------------------
// construireSyntheseExecutive — callout "Rentabilité sous pression"
// ------------------------------------------------------------
(() => {
  const base = {
    chapitre1: { syntheseTexte: 'CA en hausse.', nbDecisions: 0 },
    chapitre2: chapitre2Vide(),
    decisionsStrategiques: [],
  };
  // Sans signal qualifié mais avec des moteurs positifs -> repli sur le
  // libellé positif existant, jamais "Rentabilité sous pression" sans preuve.
  const r1 = M.construireSyntheseExecutive(Object.assign({}, base, {
    chapitreMarge: { disponible: true, classement: { moteurs: [{ nom: 'Épicerie' }], destructeurs: [{ nom: 'Boissons', ecartPts: -1 }] } },
    signauxQualifies: [],
  }));
  assert.ok(r1.troisChoses.some(t => t.titre === 'Marge tenue par quelques catégories moteurs'), 'Sans signal qualifié, le repli positif doit être utilisé');
  assert.ok(!r1.troisChoses.some(t => t.titre === 'Rentabilité sous pression'), '"Rentabilité sous pression" ne doit jamais apparaître sans signal qualifié');

  // Avec un signal marge qualifié -> "Rentabilité sous pression" construit
  // à partir du signal, citant le nom de la catégorie.
  const r2 = M.construireSyntheseExecutive(Object.assign({}, base, {
    chapitreMarge: { disponible: true, classement: { moteurs: [{ nom: 'Épicerie' }], destructeurs: [] } },
    signauxQualifies: [signalMarge('Boissons', 'risque_avere')],
  }));
  const pression = r2.troisChoses.find(t => t.titre === 'Rentabilité sous pression');
  assert.ok(pression, '"Rentabilité sous pression" doit apparaître quand un signal marge est qualifié');
  assert.ok(pression.detail.includes('Boissons'), 'Le détail doit citer la catégorie concernée');
  assert.ok(pression.detail.includes('référence historique'), 'Le détail doit préciser la nature de la preuve (référence historique propre)');
})();

console.log('OK — construireSyntheseExecutive (Phase 2) : 1/1 scénario passe (2 sous-cas).');
console.log('\nTous les tests "Cadrage risques Phase 2" passent.');
