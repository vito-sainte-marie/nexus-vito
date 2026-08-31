// NEXUS Carburants — garde-fou UI P0 temporaire (31/08/2026)
//
// L'ancien écran Pilotage actualise correctement `stockPhysiqueAffiche` avec
// le jaugeage post-réception, mais remplace ensuite le résultat du contrôle
// par `theorique = physique`, `ecart = 0`, `statut = Référence physique`.
// Tant que le HTML métier n'est pas patché directement, ce module protège
// uniquement les valeurs DÉRIVÉES calculées par chargerControleJour().
// Le dernier stock physique reste, lui, modifiable et donc affichable.
(function (global) {
  'use strict';

  var timer = null;
  var installe = false;

  function proteger(obj, cle) {
    if (!obj || !Object.prototype.hasOwnProperty.call(obj, cle)) return;
    var valeur = obj[cle];
    Object.defineProperty(obj, cle, {
      configurable: true,
      enumerable: true,
      get: function () { return valeur; },
      // L'écran historique peut tenter une réécriture de présentation ; elle
      // est ignorée. Toute vraie nouvelle interprétation doit repasser par le
      // moteur/chargeur et produire un nouvel objet de contrôle.
      set: function () { return valeur; },
    });
  }

  function verrouillerControle(controle) {
    if (!controle || !controle.parCarburant) return controle;
    Object.keys(controle.parCarburant).forEach(function (cle) {
      var r = controle.parCarburant[cle];
      if (!r || r.__p0ControleDeriveProtege) return;
      ['theorique', 'ecart', 'ecartRatio', 'statut'].forEach(function (champ) {
        proteger(r, champ);
      });
      Object.defineProperty(r, '__p0ControleDeriveProtege', {
        value: true,
        configurable: true,
        enumerable: false,
      });
    });
    return controle;
  }

  function installer() {
    if (installe) return true;
    var ND = global.NexusCarburantDonnees;
    // Attendre explicitement le patch métier P0 afin d'envelopper sa version
    // de chargerControleJour, pas l'ancienne fonction d'origine.
    if (!ND || !global.NexusCarburantsP0 || !global.NexusCarburantsP0.actif) return false;

    var original = ND.chargerControleJour;
    ND.chargerControleJour = async function () {
      var controle = await original.apply(this, arguments);
      return verrouillerControle(controle);
    };

    global.NexusCarburantsP0UI = {
      actif: true,
      verrouillerControle: verrouillerControle,
      doctrine: 'physique_post_reception_distinct_du_controle',
    };
    installe = true;
    console.info('NEXUS Carburants P0 UI installé — physique post-réception distinct du contrôle.');
    return true;
  }

  if (!installer()) {
    timer = setInterval(function () {
      if (installer() && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 20);
    setTimeout(function () {
      if (timer) {
        clearInterval(timer);
        timer = null;
        console.error('NEXUS Carburants P0 UI non installé après 15 s.');
      }
    }, 15000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
