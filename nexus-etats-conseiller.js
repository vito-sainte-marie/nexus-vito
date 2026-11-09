// nexus-etats-conseiller.js — clé stable des états du Conseiller (lot 2 des emojis, Guardian 6747170262).
//
// Les producteurs écrivent toujours la même chaîne (emoji compris) dans `etat` et dans journal_decisions :
// RIEN ne change côté écriture. Les LECTEURS ne comparent plus la chaîne : ils passent par ce module,
// qui la traduit en clé stable (agir, opportunite, …). Retirer un jour l'emoji d'un libellé ne touchera
// donc plus aucun lecteur.
//
// Aucun changement de comportement : chaque lecteur garde exactement ses anciens résultats.
//  - Les variantes « 📦 À SURVEILLER » / « 📦 À VÉRIFIER » (stock) partagent la clé de leur homologue
//    mais n'étaient reconnues par AUCUN lecteur historique (pas de classe, pas de compteur, pas de filtre) :
//    elles sont marquées `stock` et restent neutres.
//  - Chaque lecteur garde sa propre table de classes CSS (Centre 3 états, Missions 5, Brief et Cockpit plus).
//  - Valeur inconnue : classe vide, rang 2, hors gain (donc comptée dans le risque du Brief), hors
//    filtres et compteurs, avec un simple console.warn (une fois par valeur).
(function (global) {
  'use strict';

  // chaîne produite -> { cle, stock }
  var ENTREES = {
    '🔥 À AGIR': { cle: 'agir' },
    '📈 OPPORTUNITÉ': { cle: 'opportunite' },
    '💡 RECOMMANDATION': { cle: 'recommandation' },
    '🟡 À SURVEILLER': { cle: 'surveiller' },
    '📦 À SURVEILLER': { cle: 'surveiller', stock: true },
    '🟡 À VÉRIFIER': { cle: 'verifier' },
    '📦 À VÉRIFIER': { cle: 'verifier', stock: true },
    '🔴 CRITIQUE': { cle: 'critique' },
    '🔴 À DÉCIDER': { cle: 'decider' },
    '🚫 EXCLU': { cle: 'exclu' },
    '🗓️ TEMPO': { cle: 'tempo' },
    '📦 RUPTURE OBSERVÉE': { cle: 'rupture_observee', stock: true },
    '📦 COUVERTURE CRITIQUE': { cle: 'couverture_critique', stock: true },
    '📦 DONNÉE À ACTUALISER': { cle: 'donnee_a_actualiser', stock: true },
    '📦 À COMPTER': { cle: 'compter' },
    '⚠️ RAPPEL EN RETARD': { cle: 'rappel_en_retard' },
    '📌 RAPPEL': { cle: 'rappel' },
    '📋 SIGNAL': { cle: 'signal' }
  };

  // Classes CSS par lecteur, par clé : reprises à l'identique des anciennes tables de chaque page.
  var CLASSES = {
    centre: { agir: 'etat-agir', opportunite: 'etat-opportunite', surveiller: 'etat-surveiller' },
    brief: {
      agir: 'etat-agir', opportunite: 'etat-opportunite', surveiller: 'etat-surveiller',
      recommandation: 'etat-recommandation', critique: 'etat-agir', verifier: 'etat-surveiller',
      compter: 'etat-surveiller', rappel_en_retard: 'etat-agir', rappel: 'etat-recommandation',
      tempo: 'etat-recommandation', signal: 'etat-recommandation'
    },
    cockpit: {
      agir: 'etat-agir', opportunite: 'etat-opportunite', surveiller: 'etat-surveiller',
      decider: 'etat-decider', recommandation: 'etat-recommandation', critique: 'etat-agir',
      verifier: 'etat-surveiller', compter: 'etat-surveiller', rappel_en_retard: 'etat-agir',
      rappel: 'etat-recommandation'
    },
    missions: {
      agir: 'etat-agir', opportunite: 'etat-opportunite', surveiller: 'etat-surveiller',
      decider: 'etat-decider', recommandation: 'etat-recommandation'
    }
  };

  var GAIN = { agir: 1, opportunite: 1, recommandation: 1 };
  var URGENTS = { agir: 1, critique: 1 };
  var deja = {};

  function entree(etat) {
    if (typeof etat !== 'string') return null;
    return Object.prototype.hasOwnProperty.call(ENTREES, etat) ? ENTREES[etat] : null;
  }

  // Clé stable, ou null si la valeur est inconnue (avertit une fois, sans rien casser).
  function cle(etat) {
    var e = entree(etat);
    if (e) return e.cle;
    if (etat != null && etat !== '' && !deja[etat]) {
      deja[etat] = true;
      if (global.console && global.console.warn) global.console.warn('[etats-conseiller] état inconnu : ' + etat);
    }
    return null;
  }

  // Vrai si l'état porte cette clé ET était reconnu par les lecteurs historiques (hors variantes stock).
  function est(etat, k) {
    var e = entree(etat);
    return !!e && !e.stock && e.cle === k;
  }

  // Classe CSS pour un lecteur ('centre' | 'brief' | 'cockpit' | 'missions') ; '' si non couvert.
  function classe(etat, lecteur) {
    var e = entree(etat);
    if (!e || e.stock) return '';
    var t = CLASSES[lecteur];
    return (t && Object.prototype.hasOwnProperty.call(t, e.cle)) ? t[e.cle] : '';
  }

  function gain(etat) {
    var e = entree(etat);
    return !!e && !e.stock && !!GAIN[e.cle];
  }

  function urgent(etat) {
    var e = entree(etat);
    return !!e && !e.stock && !!URGENTS[e.cle];
  }

  // Rang d'un produit dans le Conseiller : 0 pour « à agir », 2 pour tout le reste (inconnu compris).
  function rang(etat) {
    return est(etat, 'agir') ? 0 : 2;
  }

  // Filtre du Centre : `libelleFiltre` est le libellé de l'onglet (une chaîne produite connue).
  function filtre(etat, libelleFiltre) {
    var f = entree(libelleFiltre);
    return !!f && est(etat, f.cle);
  }

  global.NexusEtatsConseiller = {
    cle: cle, est: est, classe: classe, gain: gain, urgent: urgent, rang: rang, filtre: filtre,
    _ENTREES: ENTREES, _CLASSES: CLASSES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusEtatsConseiller;
})(typeof window !== 'undefined' ? window : globalThis);
