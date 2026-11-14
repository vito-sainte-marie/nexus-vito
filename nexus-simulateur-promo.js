// Simulateur de promotion (Campagne V2). Moteur pur : aucun accès réseau, aucune écriture,
// aucune lecture de base. La page lui passe les lignes de `products` déjà chargées.
(function (root) {
  'use strict';

  var JOURS_MOIS = 30;
  var SEUIL_PRIX_REDUIT = 0.03;            // période à prix réduit : prix moyen au moins 3 % sous la référence
  var MARGE_RENOUVELER = 1.10;             // « à renouveler » : 110 % de la compensation
  var HAUSSES = [0.25, 0.5, 1];            // hypothèses de volume : +25 %, +50 %, +100 %
  var DELAI_RECUPERATION_LANCEMENT_MOIS = 3;
  var MOIS_REFERENCE = 12;
  var EPS = 1e-9;
  var MOTEUR_VERSION = 'objectifs-1';
  var HAUSSE_OBJECTIF = 0.10;             // objectif : retrouver la marge de référence + 10 %
  // D1 (Frédéric, 14/11/2026) : `products.prix_vente` est un HT. Le PV habituel TTC proposé = prix HT × (1 + TVA/100).
  // Seule constante à basculer : true = prix_vente importé est un TTC, false = c'est un HT (converti en TTC avec la TVA du produit).
  var PRIX_VENTE_IMPORTE_EST_TTC = false;

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // Prix net d'achat HT : catalogue × (1 − remise habituelle). Pas d'octroi de mer. Pourcentage en points (10 = 10 %).
  function prixNet(catalogue, remisePct) {
    return num(catalogue) * (1 - num(remisePct) / 100);
  }

  function margeUnitaire(vente, achat) { return num(vente) - num(achat); }

  // Entier supérieur, avec tolérance contre les erreurs de flottant (67,0000000001 ne devient pas 68).
  function plafond(x) { return Math.ceil(x - EPS); }

  function tvaValide(t) { return t !== null && t !== undefined && t !== '' && isFinite(Number(t)) && Number(t) >= 0; }
  // PV HT = PV TTC / (1 + TVA/100). Retourne null si la TVA manque (calcul suspendu).
  function ttcVersHt(ttc, tva) {
    if (ttc === null || ttc === undefined || ttc === '' || !isFinite(Number(ttc)) || !tvaValide(tva)) return null;
    return Number(ttc) / (1 + Number(tva) / 100);
  }
  function htVersTtc(ht, tva) {
    if (ht === null || ht === undefined || ht === '' || !isFinite(Number(ht)) || !tvaValide(tva)) return null;
    return Number(ht) * (1 + Number(tva) / 100);
  }

  function ligneHypothese(cle, volume, margePendant, volumeHabituel, margeAvant) {
    var marge = volume * margePendant;
    return { cle: cle, volume: volume, margeTotale: marge, ecart: marge - volumeHabituel * margeAvant };
  }

  // Compensation d'une remise : combien de ventes faut-il pour retrouver la marge habituelle.
  function calculerCompensation(p) {
    var jours = num(p.jours) > 0 ? num(p.jours) : JOURS_MOIS;
    var ventesMois = Math.max(0, num(p.ventesMoisPrecedent));
    var margeAvant = margeUnitaire(p.venteAvant, p.achatAvant);
    var margePendant = margeUnitaire(p.ventePendant, p.achatPendant);
    var ventesJour = p.ventesJour !== undefined && p.ventesJour !== null ? Math.max(0, num(p.ventesJour)) : ventesMois / JOURS_MOIS;
    var habituel = ventesJour * jours;
    var r = {
      jours: jours, volumeHabituel: habituel, margeAvant: margeAvant, margePendant: margePendant,
      ventesJour: ventesJour, impossible: margePendant <= EPS || margeAvant <= EPS,
      ratio: null, ventesEquilibre: null, ventesRenouveler: null, hausseEquilibrePct: null, hausseRenouvelerPct: null,
      hypotheses: []
    };
    r.hypotheses.push(ligneHypothese('habituel', habituel, margePendant, habituel, margeAvant));
    HAUSSES.forEach(function (h) {
      r.hypotheses.push(ligneHypothese('hausse-' + Math.round(h * 100), habituel * (1 + h), margePendant, habituel, margeAvant));
    });
    if (!r.impossible) {
      r.ratio = margeAvant / margePendant;
      r.ventesEquilibre = habituel * r.ratio;
      r.ventesRenouveler = r.ventesEquilibre * MARGE_RENOUVELER;
      r.hausseEquilibrePct = (r.ratio - 1) * 100;
      r.hausseRenouvelerPct = (r.ratio * MARGE_RENOUVELER - 1) * 100;
      r.seuilEquilibre = plafond(r.ventesEquilibre);
      r.seuilRenouveler = plafond(r.ventesRenouveler);
      r.aucuneHausse = r.ratio <= 1 + EPS;
      r.hypotheses.push(ligneHypothese('equilibre', r.ventesEquilibre, margePendant, habituel, margeAvant));
      r.hypotheses.push(ligneHypothese('renouveler', r.ventesRenouveler, margePendant, habituel, margeAvant));
    }
    return r;
  }

  // Analyse d'objectif d'un produit (moteur partagé : simulateur indépendant et préparation de campagne).
  // p : paHabituelHt, paPromoHt, pvHabituelTtc, pvPromoTtc, tva (%), ventesJour (référence), jours (durée de la promotion),
  //     meilleurRythmeObserve (ventes/jour, promotions passées ; null si aucune période comparable).
  // Retourne un `statut` (code) ; le libellé affiché relève du vocabulaire, pas du moteur.
  function analyserObjectif(p) {
    var r = { statut: 'ok', moteurVersion: MOTEUR_VERSION, tva: null, pvHabituelHt: null, pvPromoHt: null,
      margeHabituelle: null, margePromo: null, margeReference: null, margeCible: null,
      seuil: null, seuilPlus10: null, rythmeMin: null, rythmePlus10: null, objectifPropose: null,
      faisabilite: null, jours: num(p.jours), ventesJour: null };
    function manque(v) { return v === null || v === undefined || v === '' || !isFinite(Number(v)); }
    if (manque(p.paHabituelHt) || manque(p.paPromoHt) || manque(p.pvHabituelTtc) || manque(p.pvPromoTtc) || !(num(p.jours) > 0)) { r.statut = 'prix-manquant'; return r; }
    if (!tvaValide(p.tva)) { r.statut = 'tva-manquante'; return r; }
    r.tva = Number(p.tva);
    r.pvHabituelHt = ttcVersHt(p.pvHabituelTtc, r.tva);
    r.pvPromoHt = ttcVersHt(p.pvPromoTtc, r.tva);
    r.margeHabituelle = r.pvHabituelHt - Number(p.paHabituelHt);
    r.margePromo = r.pvPromoHt - Number(p.paPromoHt);
    if (r.margeHabituelle <= EPS) { r.statut = 'marge-habituelle-nulle'; return r; }
    if (r.margePromo <= EPS) { r.statut = 'marge-promo-nulle'; return r; }
    if (manque(p.ventesJour) || !(Number(p.ventesJour) > 0)) { r.statut = 'sans-reference'; return r; }
    r.ventesJour = Number(p.ventesJour);
    r.margeReference = r.ventesJour * r.jours * r.margeHabituelle;
    r.margeCible = r.margeReference * (1 + HAUSSE_OBJECTIF);
    if (r.margePromo >= r.margeHabituelle - EPS) { r.statut = 'aucune-hausse'; return r; }
    r.seuil = plafond(r.margeReference / r.margePromo);
    r.seuilPlus10 = plafond(r.margeCible / r.margePromo);
    r.rythmeMin = r.seuil / r.jours;
    r.rythmePlus10 = r.seuilPlus10 / r.jours;
    r.objectifPropose = plafond(r.rythmeMin);
    var meilleur = p.meilleurRythmeObserve;
    if (manque(meilleur) || !(Number(meilleur) > 0)) r.faisabilite = 'a-confirmer';
    else r.faisabilite = r.rythmeMin > Number(meilleur) + EPS ? 'depasse-observe' : 'dans-observe';
    r.meilleurRythmeObserve = manque(meilleur) ? null : Number(meilleur);
    return r;
  }

  // Somme de plusieurs produits : toujours en euros, jamais en pourcentages.
  function sommer(resultats) {
    var liste = (resultats || []).filter(Boolean);
    var s = { nbProduits: liste.length, impossibles: liste.filter(function (x) { return x.impossible; }).length,
      margeHabituelle: 0, hypotheses: [] };
    var cles = ['habituel', 'hausse-25', 'hausse-50', 'hausse-100'];
    liste.forEach(function (x) { s.margeHabituelle += x.volumeHabituel * x.margeAvant; });
    cles.forEach(function (c) {
      var m = 0, e = 0;
      liste.forEach(function (x) {
        var h = x.hypotheses.filter(function (y) { return y.cle === c; })[0];
        if (h) { m += h.margeTotale; e += h.ecart; }
      });
      s.hypotheses.push({ cle: c, margeTotale: m, ecart: e });
    });
    return s;
  }

  // Lancement : produit absent ou sans vente le mois précédent. Pas de volume habituel.
  function calculerLancement(p, volumes) {
    var achat = num(p.achat), normal = num(p.venteNormale), promo = num(p.ventePromo);
    var margeNormale = normal - achat, margePromo = promo - achat;
    var remise = normal - promo;
    var r = { margeNormale: margeNormale, margePromo: margePromo, remiseUnitaire: remise,
      irrecuperable: margeNormale <= 0, venteAPerte: margePromo < 0, lignes: [] };
    (volumes && volumes.length ? volumes : []).forEach(function (v) {
      var cout = remise * v, ligne = { volume: v, cout: cout, margePromo: margePromo * v, mensuel: [] };
      for (var m = 1; m <= DELAI_RECUPERATION_LANCEMENT_MOIS; m++) {
        ligne.mensuel.push({ mois: m, ventes: r.irrecuperable ? null : cout / (margeNormale * m) });
      }
      r.lignes.push(ligne);
    });
    return r;
  }

  // ---- Périodes de `products` ----
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function nbJours(debut, fin) { return Math.round((parseDate(fin) - parseDate(debut)) / 86400000) + 1; }

  // Regroupe les lignes d'un article par période et calcule prix moyen HT, ventes par jour, coût moyen.
  function periodesArticle(rows, article) {
    var map = {};
    (rows || []).forEach(function (r) {
      if (r.article !== article) return;
      var k = r.periode_debut + '|' + r.periode_fin;
      var p = map[k] || (map[k] = { debut: r.periode_debut, fin: r.periode_fin, quantite: 0, ca: 0, marge: 0 });
      p.quantite += num(r.quantite); p.ca += num(r.ca); p.marge += num(r.marge);
      if (r.tva !== null && r.tva !== undefined && r.tva !== '' && isFinite(Number(r.tva))) p.tva = Number(r.tva);
    });
    return Object.keys(map).map(function (k) {
      var p = map[k];
      p.jours = nbJours(p.debut, p.fin);
      p.prixMoyen = p.quantite > 0 ? p.ca / p.quantite : null;
      p.coutMoyen = p.quantite > 0 ? (p.ca - p.marge) / p.quantite : null;
      p.parJour = p.quantite > 0 && p.jours > 0 ? p.quantite / p.jours : null;
      return p;
    }).filter(function (p) { return p.prixMoyen !== null && p.jours > 0; })
      .sort(function (a, b) { return parseDate(b.fin) - parseDate(a.fin); });
  }

  // Prix normal : le plus haut prix moyen HT observé sur les périodes des 12 derniers mois (pas la médiane).
  function analyserPeriodes(rows, article, aujourdhui) {
    var ref = aujourdhui instanceof Date ? aujourdhui.getTime() : parseDate(aujourdhui);
    var limite = ref - MOIS_REFERENCE * 30.4375 * 86400000;
    var periodes = periodesArticle(rows, article).filter(function (p) { return parseDate(p.fin) >= limite; });
    if (!periodes.length) return { periodes: [], prixReference: null, reduites: [], periodeReference: null, prixBasRecent: false };
    var prixReference = Math.max.apply(null, periodes.map(function (p) { return p.prixMoyen; }));
    periodes.forEach(function (p) { p.reduite = (prixReference - p.prixMoyen) / prixReference >= SEUIL_PRIX_REDUIT - EPS; });
    var retenues = periodes.filter(function (p) { return !p.reduite; });
    return {
      periodes: periodes,
      prixReference: prixReference,
      reduites: periodes.filter(function (p) { return p.reduite; }),
      periodeReference: retenues[0] || null,
      prixBasRecent: periodes[0].reduite
    };
  }

  // Suggestions de préremplissage, modifiables à la main, avec leur source.
  function suggestions(rows, article, aujourdhui) {
    var a = analyserPeriodes(rows, article, aujourdhui);
    var p = a.periodeReference;
    if (!p) return null;
    var rythmes = a.reduites.map(function (x) { return x.parJour; }).filter(function (x) { return x > 0; });
    return {
      ventesJour: p.quantite / p.jours,
      joursReference: p.jours,
      meilleurRythmeObserve: rythmes.length ? Math.max.apply(null, rythmes) : null,
      ventesMoisPrecedent: p.quantite / p.jours * JOURS_MOIS,
      venteAvant: p.prixMoyen,
      tva: p.tva === undefined ? null : p.tva,
      pvHabituelTtc: p.tva === undefined ? null : (PRIX_VENTE_IMPORTE_EST_TTC ? p.prixMoyen : htVersTtc(p.prixMoyen, p.tva)),
      achatAvant: p.coutMoyen,
      prixReference: a.prixReference,
      source: { debut: p.debut, fin: p.fin },
      prixBasRecent: a.prixBasRecent,
      periodeRecente: a.periodes[0] ? { debut: a.periodes[0].debut, fin: a.periodes[0].fin } : null,
      reduites: a.reduites
    };
  }

  var API = {
    SEUIL_PRIX_REDUIT: SEUIL_PRIX_REDUIT, DELAI_RECUPERATION_LANCEMENT_MOIS: DELAI_RECUPERATION_LANCEMENT_MOIS,
    JOURS_MOIS: JOURS_MOIS, MARGE_RENOUVELER: MARGE_RENOUVELER,
    prixNet: prixNet, margeUnitaire: margeUnitaire, calculerCompensation: calculerCompensation, sommer: sommer,
    calculerLancement: calculerLancement, periodesArticle: periodesArticle, analyserPeriodes: analyserPeriodes,
    suggestions: suggestions, analyserObjectif: analyserObjectif, plafond: plafond, ttcVersHt: ttcVersHt, htVersTtc: htVersTtc, tvaValide: tvaValide,
    MOTEUR_VERSION: MOTEUR_VERSION, HAUSSE_OBJECTIF: HAUSSE_OBJECTIF, PRIX_VENTE_IMPORTE_EST_TTC: PRIX_VENTE_IMPORTE_EST_TTC
  };
  root.NexusSimulateurPromo = API;
})(typeof window !== 'undefined' ? window : globalThis);
