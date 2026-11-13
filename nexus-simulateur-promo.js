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

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // Prix net d'achat HT : catalogue × (1 − remise) × (1 + octroi de mer). Pourcentages en points (10 = 10 %).
  function prixNet(catalogue, remisePct, octroiPct) {
    return num(catalogue) * (1 - num(remisePct) / 100) * (1 + num(octroiPct) / 100);
  }

  function margeUnitaire(vente, achat) { return num(vente) - num(achat); }

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
    var habituel = ventesMois / JOURS_MOIS * jours;
    var r = {
      jours: jours, volumeHabituel: habituel, margeAvant: margeAvant, margePendant: margePendant,
      impossible: margePendant <= EPS || margeAvant <= EPS,
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
      r.hypotheses.push(ligneHypothese('equilibre', r.ventesEquilibre, margePendant, habituel, margeAvant));
      r.hypotheses.push(ligneHypothese('renouveler', r.ventesRenouveler, margePendant, habituel, margeAvant));
    }
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
    return {
      ventesMoisPrecedent: p.quantite / p.jours * JOURS_MOIS,
      venteAvant: p.prixMoyen,
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
    suggestions: suggestions
  };
  root.NexusSimulateurPromo = API;
})(typeof window !== 'undefined' ? window : globalThis);
