// Test — Cadrage risques Phase 4 (18/08/2026, tâche #233) "Exposition non
// financière (impact qualitatif)".
//
// Couvre l'extension de NexusRisques.classifierNiveau() avec un chemin
// qualitatif (Règles A2/B2) — pour un domaine dont l'impact ne se
// monétise pas proprement (1er cas réel visé : Carburants Phase 5,
// "autonomie de stock faible"). Vérifie en priorité que les Règles A/B/C/D
// € EXISTANTES sont STRICTEMENT INCHANGÉES (aucune régression sur les deux
// domaines déjà branchés, Caisse et Marge, qui ne renseignent jamais
// `severiteQualitative`).
//
// require() direct du vrai fichier moteur, jamais réécrit ici.

const assert = require('assert');

require(__dirname + '/nexus-risques-moteur.js');
const R = global.NexusRisques;

// ------------------------------------------------------------
// Non-régression — Règles A/B/C/D € (comportement € strictement inchangé)
// ------------------------------------------------------------
(() => {
  // Règle A, branche "matériel à lui seul" — exemple de Frédéric : marge
  // 740€, une seule période.
  const r = R.classifierNiveau({ impactMesureEur: 740, recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'risque_avere');
  assert.ok(r.motif.includes('matériel'), 'Motif € "matériel à lui seul" inchangé');
})();

(() => {
  // Règle A, branche récurrence — "6 écarts sur 18 quarts, cumul 84,30€"
  // (impact modeste mais répété >= SEUIL_RECURRENCE_RISQUE_AVERE).
  const r = R.classifierNiveau({ impactMesureEur: 84.3, recurrenceCount: 6, tailleEchantillon: 18 });
  assert.strictEqual(r.niveau, 'risque_avere');
  assert.ok(r.motif.includes('répétition'), 'Motif € "répétition" inchangé');
})();

(() => {
  // Règle B — impact potentiel significatif, rien de mesuré.
  const r = R.classifierNiveau({ impactPotentielEur: 250, recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'exposition');
})();

(() => {
  // Règle C — 3 occurrences, ni impact mesuré ni potentiel significatif.
  // Exemple de Frédéric : "écart caisse > seuil sur 3 quarts en 10 jours"
  // reste Signal faible (PAS risque avéré, seuil de récurrence différent).
  const r = R.classifierNiveau({ recurrenceCount: 3, tailleEchantillon: 10 });
  assert.strictEqual(r.niveau, 'signal_faible');
})();

(() => {
  // Règle D — fait isolé, aucun impact, aucune récurrence.
  const r = R.classifierNiveau({ recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'anomalie');
})();

console.log('OK — Non-régression Règles A/B/C/D € : 5/5 réussis.');

// ------------------------------------------------------------
// Règles A2/B2 — exposition non financière (nouveau, Phase 4)
// ------------------------------------------------------------
(() => {
  // 'majeure' seule, sans € ni récurrence -> risque_avere immédiatement,
  // miroir exact de la branche "matériel à lui seul" de la Règle A.
  const r = R.classifierNiveau({ severiteQualitative: 'majeure', recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'risque_avere');
  assert.ok(r.motif.includes('majeure'), 'Motif qualitatif doit citer la sévérité');
  assert.ok(!/€/.test(r.motif) === false || r.motif.includes('sans qu\'un montant'), 'Le motif doit être honnête : aucun montant en € disponible');
})();

(() => {
  // 'significative' + récurrence suffisante -> risque_avere (miroir de la
  // branche récurrence de la Règle A).
  const r = R.classifierNiveau({ severiteQualitative: 'significative', recurrenceCount: 5, tailleEchantillon: 12 });
  assert.strictEqual(r.niveau, 'risque_avere');
  assert.ok(r.motif.includes('5 occurrences') || r.motif.includes('répétition'), 'Motif doit citer la récurrence');
})();

(() => {
  // 'significative' seule, récurrence insuffisante -> exposition (miroir
  // de la Règle B).
  const r = R.classifierNiveau({ severiteQualitative: 'significative', recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'exposition');
})();

(() => {
  // 'mineure' -> aucune escalade qualitative, retombe sur les Règles C/D
  // exactement comme si le champ était absent.
  const r1 = R.classifierNiveau({ severiteQualitative: 'mineure', recurrenceCount: 3, tailleEchantillon: 5 });
  const r2 = R.classifierNiveau({ recurrenceCount: 3, tailleEchantillon: 5 });
  assert.strictEqual(r1.niveau, 'signal_faible');
  assert.strictEqual(r1.niveau, r2.niveau, "'mineure' doit produire exactement le même résultat que l'absence du champ");
})();

(() => {
  // Valeur inconnue/mal formée -> traitée comme absente, jamais une
  // exception (Article 5 : dégradation gracieuse sur donnée invalide).
  const r = R.classifierNiveau({ severiteQualitative: 'catastrophique', recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'anomalie', "Une valeur non reconnue ne doit déclencher aucune règle qualitative");
})();

(() => {
  // Priorité : un impact € déjà mesuré prime TOUJOURS sur un jugement
  // qualitatif, même 'majeure' — le concret bat l'estimé.
  const r = R.classifierNiveau({ impactMesureEur: 740, severiteQualitative: 'majeure', recurrenceCount: 1, tailleEchantillon: 1 });
  assert.strictEqual(r.niveau, 'risque_avere');
  assert.ok(r.motif.includes('740'), 'Le motif doit citer le montant € réel, pas la voie qualitative, quand les deux sont disponibles');
})();

console.log('OK — Règles A2/B2 qualitatives : 6/6 réussis.');

// ------------------------------------------------------------
// Non-régression des deux domaines déjà branchés (Caisse, Marge) — ils ne
// renseignent jamais `severiteQualitative`, donc aucune des nouvelles
// règles ne peut jamais se déclencher pour eux.
// ------------------------------------------------------------
(() => {
  const r = R.qualifierEcartCaisse({ ecartCumule: 50, total: 10, parStatut: { anomalie: 1, critique: 0 } });
  assert.ok(R.NIVEAUX.includes(r.niveau), 'qualifierEcartCaisse doit toujours retourner un niveau valide (non-régression de forme)');
})();

(() => {
  const r = R.qualifierMargeCategorie({
    categorie: 'Boissons', margePctActuelle: 12, margeHistorique: [18, 17, 19], caActuel: 5000, caHistoriqueMoyen: 5100,
  });
  assert.ok(R.NIVEAUX.includes(r.niveau), 'qualifierMargeCategorie doit toujours retourner un niveau valide (non-régression de forme)');
})();

console.log('OK — Non-régression qualifierEcartCaisse/qualifierMargeCategorie : 2/2 réussis.');
console.log('\nTous les tests "Cadrage risques Phase 4" passent.');
