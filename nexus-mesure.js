// NEXUS — « une mesure absente n'est pas une mesure nulle » (08/09/2026).
//
// POURQUOI CE FICHIER EXISTE. Le même défaut a été trouvé à trois endroits
// différents en une journée, toujours écrit `valeur || 0` :
//
//   · EVAL-001  — un salarié sans évaluation chiffrée lisait « 0.0 / 5 » ;
//   · DEBUG-001 — un écart de caisse jamais mesuré s'affichait « +0 € », en
//                 VERT, c'est-à-dire comme une conformité parfaite ;
//   · COACH-001 — « conformes sur 0 % de vos quarts », reproche fabriqué à
//                 partir d'une absence de donnée.
//
// Ce n'est pas trois bugs, c'est un seul, recopié. Le `||` de JavaScript
// traite 0 comme une absence, et l'écriture est si naturelle qu'elle se
// reproduit toute seule. La notion mérite donc un propriétaire logique unique
// (Bible, « Architecture de vérité ») plutôt qu'une troisième copie.
//
// LA DISTINCTION VA DANS LES DEUX SENS, et la seconde moitié compte autant :
// une absence ne doit jamais devenir un chiffre, et un ZÉRO RÉELLEMENT MESURÉ
// ne doit jamais devenir une absence. Effacer un écart de caisse nul, ou une
// note de zéro, serait mentir dans l'autre sens.

(function (global) {
  'use strict';

  // Absente : `null`, `undefined`, chaîne vide ou non numérique, NaN, et tout
  // type qu'on ne sait pas lire.
  //
  // On n'écrit PAS `Number(v)` sur n'importe quoi : `Number([])` vaut 0, donc
  // un tableau vide deviendrait une mesure nulle — le défaut qu'on corrige,
  // rentré par une autre porte. Seuls un nombre fini, ou une chaîne qui en est
  // un, sont des mesures. Ne pas savoir lire n'autorise pas à inventer.
  function estAbsente(v) {
    if (typeof v === 'number') return !Number.isFinite(v);
    if (typeof v === 'string') {
      const s = v.trim();
      return s === '' || !Number.isFinite(Number(s));
    }
    return true;
  }

  // La valeur numérique quand elle existe, `null` sinon — jamais 0 par défaut.
  function valeurMesuree(v) {
    return estAbsente(v) ? null : Number(v);
  }

  const api = { estAbsente, valeurMesuree };
  global.NexusMesure = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
