// Test — Cadrage risques Phase 3 (18/08/2026, tâche #232) "Ajouter la
// dimension urgence + référence au contrat NexusRisques" dans le Rapport de
// Direction.
//
// Couvre le nouveau tri appliqué par `construireChapitreRisques()`
// (chapitre 12, "Risques & vigilances") sur `signauxQualifies` — urgence
// d'abord, gravité ensuite — même règle que le tri local déjà appliqué par
// Brief NEXUS depuis P1.3 (v2.53), mais fait ici dans le moteur (Article 11)
// plutôt que dans NEXUS-Rapport-v1.html, et SANS écrêter la liste (le
// Rapport reste exhaustif, contrairement au plafond de 3 signaux de Brief).
//
// require() direct des vrais fichiers moteur, jamais réécrits ici.

const assert = require('assert');

require(__dirname + '/nexus-risques-moteur.js'); // fournit RANG_URGENCE/RANG_NIVEAU
require(__dirname + '/nexus-rapport-direction-moteur.js');
const M = global.NexusRapportDirectionMoteur;

function signal(niveau, urgence, extra) {
  return Object.assign({ niveau, urgence, domaine: 'marge', sujet: `S-${niveau}-${urgence}`, phrase: 'x' }, extra || {});
}

// ------------------------------------------------------------
// construireChapitreRisques — tri urgence puis gravité
// ------------------------------------------------------------
(() => {
  // Cas du cadrage §9 lui-même : une exposition immédiate doit passer AVANT
  // un risque avéré de moyen terme (urgence prime sur gravité).
  const signauxQualifies = [
    signal('risque_avere', 'moyenne'),
    signal('exposition', 'immediate'),
  ];
  const chapitre = M.construireChapitreRisques({ operations: {}, chapitreCarburants: null, chapitreMarge: null, chapitreCommerce: null, signauxQualifies });
  assert.deepStrictEqual(
    chapitre.signauxQualifies.map(s => `${s.niveau}/${s.urgence}`),
    ['exposition/immediate', 'risque_avere/moyenne'],
    "Une exposition immédiate doit être listée avant un risque avéré de moyen terme (urgence prime)"
  );
})();

(() => {
  // À urgence égale, tri par gravité (risque_avere > exposition > signal_faible > anomalie).
  const signauxQualifies = [
    signal('signal_faible', 'moyenne'),
    signal('risque_avere', 'moyenne'),
    signal('exposition', 'moyenne'),
  ];
  const chapitre = M.construireChapitreRisques({ operations: {}, chapitreCarburants: null, chapitreMarge: null, chapitreCommerce: null, signauxQualifies });
  assert.deepStrictEqual(
    chapitre.signauxQualifies.map(s => s.niveau),
    ['risque_avere', 'exposition', 'signal_faible'],
    "À urgence égale, tri par gravité décroissante"
  );
})();

(() => {
  // Liste jamais écrêtée (contrairement à Brief, plafonné à 3) — tous les
  // signaux qualifiés doivent survivre au tri, un Rapport de Direction est
  // un document exhaustif.
  const signauxQualifies = [1, 2, 3, 4, 5].map(i => signal('signal_faible', 'faible', { sujet: `Cat${i}` }));
  const chapitre = M.construireChapitreRisques({ operations: {}, chapitreCarburants: null, chapitreMarge: null, chapitreCommerce: null, signauxQualifies });
  assert.strictEqual(chapitre.signauxQualifies.length, 5, 'Le Rapport ne doit jamais écrêter la liste des signaux qualifiés (contrairement à Brief)');
})();

(() => {
  // Robustesse : signaux sans champ urgence (contexte plus ancien / absent)
  // -> aucune exception, tri stable, jamais un crash sur des données
  // partielles (Article 5).
  const signauxQualifies = [signal('risque_avere', undefined), signal('exposition', undefined)];
  const chapitre = M.construireChapitreRisques({ operations: {}, chapitreCarburants: null, chapitreMarge: null, chapitreCommerce: null, signauxQualifies });
  assert.strictEqual(chapitre.signauxQualifies.length, 2, 'Aucune exception même sans urgence connue');
})();

(() => {
  // Le résumé par gravité (resume.risqueAvere/exposition/signalFaible)
  // reste inchangé par le tri — mêmes comptages qu'avant Phase 3.
  const signauxQualifies = [signal('risque_avere', 'immediate'), signal('risque_avere', 'faible'), signal('exposition', 'moyenne')];
  const chapitre = M.construireChapitreRisques({ operations: {}, chapitreCarburants: null, chapitreMarge: null, chapitreCommerce: null, signauxQualifies });
  assert.deepStrictEqual(chapitre.resume, { risqueAvere: 2, exposition: 1, signalFaible: 0 }, 'Le résumé par gravité ne doit pas changer avec le tri par urgence');
})();

console.log('OK — construireChapitreRisques (Phase 3, tri urgence+gravité) : 5/5 scénarios passent.');
console.log('\nTous les tests "Cadrage risques Phase 3" passent.');
