// NEXUS Carburants — garde-fous P0 temporaires (31/08/2026)
//
// Protections indépendantes :
// 1. la réception ne doit jamais écraser le relevé d'ouverture ;
// 2. le stock physique post-réception peut être affiché sans remplacer le
//    contrôle dérivé par `theorique = physique`, `ecart = 0` ;
// 3. l'évaluation P0 ne doit jamais laisser l'ancienne recommandation
//    intermédiaire polluer le journal avant l'écriture du résultat corrigé ;
// 4. l'interface ne doit jamais dire que l'ÉCART est calculé depuis le
//    jaugeage post-livraison : seul le stock physique affiché vient de lui.
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
  var journalCommandeInstalle = false;
  var observateurLibelle = null;

  function proteger(obj, cle) {
    if (!obj || !Object.prototype.hasOwnProperty.call(obj, cle)) return;
    var valeur = obj[cle];
    Object.defineProperty(obj, cle, {
      configurable: true,
      enumerable: true,
      get: function () { return valeur; },
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

  function clientSansJournalRecommandation(client) {
    var proxy = Object.create(client);
    proxy.from = function (table) {
      if (table !== 'carburant_recommandation_journal') return client.from(table);

      var chain = {};
      ['select', 'eq', 'insert', 'update', 'order', 'limit'].forEach(function (methode) {
        chain[methode] = function () { return chain; };
      });
      chain.maybeSingle = async function () { return { data: null, error: null }; };
      chain.single = async function () { return { data: null, error: null }; };
      return chain;
    };
    return proxy;
  }

  function installerJournalCommande() {
    if (journalCommandeInstalle) return true;
    var CMD = global.NexusCarburantCommandeDonnees;
    if (!CMD || !global.NexusCarburantsP0 || !global.NexusCarburantsP0.actif ||
        !CMD.evaluerCommandeCarburantSite || !CMD.enregistrerRecommandationCarburant) return false;

    var evaluationP0 = CMD.evaluerCommandeCarburantSite;
    CMD.evaluerCommandeCarburantSite = async function (client, siteId, options) {
      var resultat = await evaluationP0.call(this, clientSansJournalRecommandation(client), siteId, options);
      if (!resultat || resultat.ok === false || !resultat.parCarburant) return resultat;

      try {
        var ecritures = [];
        Object.keys(resultat.parCarburant).forEach(function (cle) {
          var ev = resultat.parCarburant[cle];
          if (!ev || ev.etat === 'non_calculable') return;
          var recommandationL = resultat.commandeRecommandee && resultat.commandeRecommandee.volumes &&
            resultat.commandeRecommandee.volumes[cle] != null
            ? resultat.commandeRecommandee.volumes[cle] : 0;
          ecritures.push(CMD.enregistrerRecommandationCarburant(client, siteId, cle, {
            recommandationL: recommandationL,
            etat: ev.etat,
            ventesPrevuesL: ev.scenarioMaintenant ? ev.scenarioMaintenant.ventesPrevuesL : null,
            stockAncreCommandeL: ev.stockAncreCommandeL,
          }));
        });
        await Promise.all(ecritures);
      } catch (e) {
        console.error('NEXUS Carburants P0 — journal final non écrit:', e);
      }
      return resultat;
    };

    journalCommandeInstalle = true;
    console.info('NEXUS Carburants P0 Journal installé — un seul snapshot final par évaluation.');
    return true;
  }

  // L'ancien HTML construit encore une phrase héritée de la tentative
  // d'ancrage intrajournalier : « Écart calculé depuis le jaugeage
  // post-livraison... ». Les valeurs sont déjà protégées ci-dessus ; ce
  // correctif ne touche qu'au texte pour distinguer clairement mesure
  // physique récente et ancre du contrôle.
  function corrigerLibelleReference() {
    if (!global.document) return;
    var elements = document.querySelectorAll('.section-note');
    elements.forEach(function (el) {
      var texte = el.textContent || '';
      if (texte.indexOf('Écart calculé depuis le jaugeage post-livraison') === -1) return;
      el.textContent = texte.replace(
        /Écart calculé depuis le jaugeage post-livraison du [^.]+\./,
        "Stock physique actualisé après réception. Le contrôle reste ancré sur le relevé d'ouverture."
      );
    });
  }

  function installerLibelleReference() {
    if (!global.document || observateurLibelle) return true;
    corrigerLibelleReference();
    observateurLibelle = new MutationObserver(function () { corrigerLibelleReference(); });
    observateurLibelle.observe(document.body, { childList: true, subtree: true });
    return true;
  }

  function installerUI() {
    if (uiInstallee) return true;
    var ND = global.NexusCarburantDonnees;
    if (!ND || !global.NexusCarburantsP0 || !global.NexusCarburantsP0.actif) return false;

    var original = ND.chargerControleJour;
    ND.chargerControleJour = async function () {
      var controle = await original.apply(this, arguments);
      return verrouillerControle(controle);
    };

    installerLibelleReference();
    global.NexusCarburantsP0UI = {
      actif: true,
      pontReceptionActif: pontReceptionInstalle,
      journalCommandeActif: journalCommandeInstalle,
      verrouillerControle: verrouillerControle,
      doctrine: 'physique_post_reception_distinct_du_controle',
    };
    uiInstallee = true;
    console.info('NEXUS Carburants P0 UI installé — physique post-réception distinct du contrôle.');
    return true;
  }

  function installer() {
    installerPontReception();
    installerJournalCommande();
    installerUI();
    return pontReceptionInstalle;
  }

  installer();
  if (!pontReceptionInstalle || !journalCommandeInstalle || !uiInstallee) {
    timer = setInterval(function () {
      installer();
      var p0CompletAttendu = !!global.NexusCarburantsP0;
      if (pontReceptionInstalle && (!p0CompletAttendu || (journalCommandeInstalle && uiInstallee))) {
        clearInterval(timer);
        timer = null;
      }
    }, 20);
    setTimeout(function () {
      if (timer) {
        clearInterval(timer);
        timer = null;
        if (!pontReceptionInstalle) console.error('NEXUS Carburants P0 Réception non installé après 15 s.');
        if (global.NexusCarburantsP0 && !journalCommandeInstalle) console.error('NEXUS Carburants P0 Journal non installé après 15 s.');
      }
    }, 15000);
  }
})(typeof window !== 'undefined' ? window : globalThis);
