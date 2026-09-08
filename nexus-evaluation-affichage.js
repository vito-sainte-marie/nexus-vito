// NEXUS — Affichage d'une évaluation employé (08/09/2026, lot EVAL-001).
//
// CE QUE CE FICHIER EMPÊCHE. `NEXUS-Evaluation-Employe-v1.html` affichait
// `${(ev.total || 0).toFixed(1)} / 5` et `${ev.prime_pct || 0}%`. Le `||`
// confond une note de ZÉRO avec une note ABSENTE : un salarié dont
// l'évaluation existe mais n'a pas encore été chiffrée lisait « 0.0 / 5 » et
// « 0 % ». Une sanction fabriquée à partir d'un trou de donnée, sur l'écran
// que la personne concernée consulte elle-même.
//
// Trouvé par le Guardian Business Rules le 07/09/2026 ; arbitré par
// `decision-1.md` du lot NEXUS-ORCHESTRATION-GUARDIANS-1-20260907 (Q74) :
// « Absence d'évaluation affiche un état neutre explicite, jamais une
// note/pourcentage chiffré. »
//
// LA DISTINCTION EST LE TOUT. Un zéro réellement attribué doit s'afficher
// « 0.0 / 5 » — c'est une évaluation, elle a eu lieu, elle se discute. Une
// absence doit s'afficher « Non évalué » — il n'y a rien à discuter, il n'y a
// rien. Les confondre invente un reproche ; les confondre dans l'autre sens
// effacerait une évaluation réelle.
//
// Bible NEXUS, Philosophie : « L'employé doit recevoir un accompagnement
// utile, positif, concret et non punitif » et « une anomalie ne doit jamais
// être masquée par un affichage rassurant » — dont le symétrique : une absence
// ne doit jamais être maquillée en mesure.

(function (global) {
  'use strict';

  const NON_EVALUE = 'Non évalué';

  // « Une mesure absente n'est pas une mesure nulle » a UN propriétaire
  // logique : `nexus-mesure.js`. Le même défaut ayant été trouvé à trois
  // endroits en une journée (EVAL-001, DEBUG-001, COACH-001), en garder une
  // copie ici aurait garanti qu'elles divergent un jour.
  const mesure = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./nexus-mesure.js')
    : global.NexusMesure;
  const estAbsent = (v) => mesure.estAbsente(v);

  // `evenement` : { kind, total, prime_pct, points }
  // Rend TOUJOURS une chaîne : soit une mesure réelle, soit l'état neutre.
  function libelleScore(evenement) {
    const ev = evenement || {};
    if (ev.kind === 'Contrôle tenue') {
      return estAbsent(ev.points) ? NON_EVALUE : `${Number(ev.points)} pts`;
    }
    if (ev.kind === 'Évaluation Renfort') {
      return estAbsent(ev.total) ? NON_EVALUE : `${Number(ev.total).toFixed(1)} / 5`;
    }
    // Évaluation prime, et tout type non reconnu : on ne fabrique pas un
    // chiffre pour un type qu'on ne sait pas lire.
    return estAbsent(ev.prime_pct) ? NON_EVALUE : `${Number(ev.prime_pct)}%`;
  }

  // Vrai quand l'affichage est l'état neutre — l'écran peut alors le styler
  // autrement qu'une note, pour qu'aucune lecture rapide ne le prenne pour
  // une mesure.
  function estNonEvalue(evenement) {
    return libelleScore(evenement) === NON_EVALUE;
  }

  const api = { libelleScore, estNonEvalue, estAbsent, NON_EVALUE };
  global.NexusEvaluationAffichage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
