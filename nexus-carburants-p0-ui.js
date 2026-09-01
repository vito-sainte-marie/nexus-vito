// NEXUS Carburants — garde-fous P0 temporaires (31/08/2026)
//
// Deux protections volontairement indépendantes :
// 1. le pont Réception ne doit jamais écraser le relevé d'ouverture ; cette
//    règle doit fonctionner même sur NEXUS-Carburant-Reception-v1.html, qui
//    ne charge pas le moteur pur de Commande Carburant ;
// 2. sur Pilotage, le dernier stock physique post-réception peut être affiché
//    sans autoriser l'ancien écran à remplacer le contrôle dérivé par
//    `theorique = physique`, `ecart = 0`.
//
// Doctrine verrouillée tant que les ventes ne sont pas horodatées par
// Insite360 : ouverture = ancre métier ; BL = mouvement documentaire ;
// jaugeage final = preuve physique de réception, jamais nouvelle frontière
// temporelle des ventes.
(function (global) {
  'use strict';

  var timer = null;
  var pontReceptionInstalle = false;
  var uiInstallee = false;

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

  // Garde-fou autonome : l'écran Réception charge NexusCarburantDonnees mais
  // pas NexusCarburantCommandeMoteur. Le correctif ne doit donc dépendre que
  // de la couche Carburants elle-même. La réception reste entièrement
  // enregistrée dans ses tables dédiées ; ce pont devient volontairement un
  // no-op côté carburant_releves afin de préserver l'ouverture du jour.
  function installerPontReception() {
    if (pontReceptionInstalle) return true;
    var ND = global.NexusCarburantDonnees;
    if (!ND || !ND.chargerReleveDuJour) return false;

    ND.enregistrerReleveDepuisReceptionLivraison = async function (client, siteId, args) {
      var date = args && args.date;
      var releveOuverture = date ? await ND.chargerReleveDuJour(client, siteId, date) : null;
      return {
        ok: true,
        dejaAJour: true,
        pontNeutralise: true,
        releve: releveOuverture,
        doctrine: 'ouverture_preservee_reception_separee',
        message: "Réception enregistrée comme preuve séparée ; relevé d'ouverture inchangé.",
      };
    };

    pontReceptionInstalle = true;
    console.info("NEXUS Carburants P0 Réception installé — relevé d'ouverture préservé.");
    return true;
  }

  // Protection complémentaire de Pilotage. Elle attend le correctif métier
  // P0 principal afin d'envelopper sa version de chargerControleJour, jamais
  // l'ancienne fonction d'origine.
  function installerUI() {
    if (uiInstallee) return true;
    var ND = global.NexusCarburantDonnees;
    if (!ND || !global.NexusCarburantsP0 || !global.NexusCarburantsP0.actif) return false;

    var original = ND.chargerControleJour;
    ND.chargerControleJour = async function () {
      var controle = await original.apply(this, arguments);
      return verrouillerControle(controle);
    };

    global.NexusCarburantsP0UI = {
      actif: true,
      pontReceptionActif: pontReceptionInstalle,
      verrouillerControle: verrouillerControle,
      doctrine: 'physique_post_reception_distinct_du_controle',
    };
    uiInstallee = true;
    console.info('NEXUS Carburants P0 UI installé — physique post-réception distinct du contrôle.');
    return true;
  }

  function installer() {
    var pontOk = installerPontReception();
    var uiOk = installerUI();
    // Sur l'écran Réception, `uiOk` peut légitimement rester faux car le
    // moteur Commande n'est pas chargé. Le garde-fou critique est le pont.
    return pontOk && (uiOk || !global.NexusCarburantsP0);
  }

  installer();
  if (!pontReceptionInstalle || (!uiInstallee && global.NexusCarburantsP0)) {
    timer = setInterval(function () {
      installer();
      if (pontReceptionInstalle && (uiInstallee || !global.NexusCarburantsP0)) {
        clearInterval(timer);
        timer = null;
      }
    }, 20);
    setTimeout(function () {
      if (timer) {
        clearInterval(timer);
        timer = null;
        if (!pontReceptionInstalle) console.error('NEXUS Carburants P0 Réception non installé après 15 s.');
      }
    }, 15000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
