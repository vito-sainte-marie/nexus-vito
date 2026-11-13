// Mesure de la compensation (Campagne V2). Moteur pur : aucun accès réseau, aucune écriture, aucune lecture de base.
// Doctrine : cahier Guardian 6865021911. Pourcentages en fractions (0,9 = 90 %), sommes toujours en euros.
(function (root) {
  'use strict';

  var SEUIL_INSUFFISANTE = 0.90;
  var SEUIL_EQUILIBRE = 1.00;
  var SEUIL_RENOUVELER = 1.10;
  var GAIN_MIN_RENOUVELER = 100;
  var PART_MIN_MESURABLE = 0.80;
  var JOURS_REFERENCE_DEFAUT = 30;
  var SEUIL_PRIX_SOUS_NORMAL = 0.03;
  var EPS = 1e-9;

  function present(v) { return v !== null && v !== undefined && v !== '' && isFinite(Number(v)); }
  function num(v) { return present(v) ? Number(v) : 0; }
  function arr(x) { return Math.round(x * 1e9) / 1e9; }

  // Stock : comptage NEXUS à la date, sinon relevé Decenium à la date exacte, sinon saisie. La source est toujours rendue.
  function choisirStock(s) {
    s = s || {};
    if (present(s.comptage)) return { valeur: Number(s.comptage), source: 'comptage' };
    if (present(s.decenium)) return { valeur: Number(s.decenium), source: 'decenium' };
    if (present(s.saisie)) return { valeur: Number(s.saisie), source: 'saisie' };
    return { valeur: null, source: null };
  }

  // État à partir du taux de compensation et du gain après coûts d'opération.
  function etat(taux, gainApresCouts) {
    if (taux === null || taux === undefined || !isFinite(taux)) return 'non_mesurable';
    var t = arr(taux);
    if (t < SEUIL_INSUFFISANTE) return 'insuffisante';
    if (t < SEUIL_EQUILIBRE) return 'a_ameliorer';
    if (t < SEUIL_RENOUVELER) return 'encourageante';
    return arr(gainApresCouts) >= GAIN_MIN_RENOUVELER ? 'a_renouveler' : 'encourageante';
  }

  // Un produit. Les pertes comptent comme des ventes (elles sortent du stock) : elles sont seulement affichées.
  function mesurerProduit(p) {
    p = p || {};
    var manquants = [];
    var duree = num(p.jours);
    if (!(duree > 0)) manquants.push('jours');
    if (!present(p.stockDebut)) manquants.push('stockDebut');
    if (!present(p.stockFin)) manquants.push('stockFin');
    if (!present(p.achatPendant)) manquants.push('achatPendant');
    if (!present(p.ventePendant)) manquants.push('ventePendant');
    var lancement = !!p.nouveauProduit;
    if (!lancement) {
      if (!present(p.ventesMoisPrecedent)) manquants.push('ventesMoisPrecedent');
      if (!present(p.achatAvant)) manquants.push('achatAvant');
      if (!present(p.venteAvant)) manquants.push('venteAvant');
    }
    var r = { article: p.article || null, lancement: lancement, manquants: manquants, mesurable: manquants.length === 0,
      jours: duree, pertes: present(p.pertes) ? num(p.pertes) : null,
      ventesJourAvant: null, ventesPendant: null, ventesJourPendant: null,
      margeUniteAvant: null, margeUnitePendant: null, margeJourAvant: null, margeJourPendant: null,
      seuil: null, impossible: false, taux: null, gain: null, margePendantTotale: null,
      prixSousNormal: false, etat: 'non_mesurable' };
    // La marge avant sert au poids du produit même si la mesure du pendant échoue.
    if (!lancement && present(p.ventesMoisPrecedent) && present(p.achatAvant) && present(p.venteAvant)) {
      var jr = num(p.joursReference) > 0 ? num(p.joursReference) : JOURS_REFERENCE_DEFAUT;
      r.ventesJourAvant = Math.max(0, num(p.ventesMoisPrecedent)) / jr;
      r.margeUniteAvant = num(p.venteAvant) - num(p.achatAvant);
      r.margeJourAvant = r.ventesJourAvant * r.margeUniteAvant;
    }
    if (!r.mesurable) return r;
    r.ventesPendant = num(p.stockDebut) + num(p.livraisons) - num(p.stockFin);
    r.ventesJourPendant = r.ventesPendant / duree;
    r.margeUnitePendant = num(p.ventePendant) - num(p.achatPendant);
    r.margeJourPendant = r.ventesJourPendant * r.margeUnitePendant;
    r.margePendantTotale = r.ventesPendant * r.margeUnitePendant;
    if (present(p.prixNormal) && num(p.prixNormal) > 0 && !p.promotionDeclaree) {
      r.prixSousNormal = (num(p.prixNormal) - num(p.ventePendant)) / num(p.prixNormal) >= SEUIL_PRIX_SOUS_NORMAL - EPS;
    }
    if (lancement) { r.etat = 'lancement'; return r; }
    if (r.margeUnitePendant <= EPS) r.impossible = true; else r.seuil = r.margeJourAvant / r.margeUnitePendant;
    r.taux = r.margeJourAvant > EPS ? r.margeJourPendant / r.margeJourAvant : null;
    r.gain = (r.margeJourPendant - r.margeJourAvant) * duree;
    r.etat = etat(r.taux, r.gain);
    return r;
  }

  // La campagne : somme en euros entre produits, jamais de moyenne de pourcentages.
  function mesurerCampagne(produits, couts) {
    var lignes = (produits || []).map(mesurerProduit);
    var totalCouts = (couts || []).reduce(function (s, c) { return s + Math.max(0, num(c && c.montant_ht !== undefined ? c.montant_ht : c)); }, 0);
    var hors = lignes.filter(function (l) { return !l.lancement; });
    var poidsTotal = 0, poidsMesure = 0, avant = 0, pendant = 0, gain = 0;
    hors.forEach(function (l) {
      var w = l.margeJourAvant === null ? 0 : Math.max(0, l.margeJourAvant);
      poidsTotal += w;
      if (l.mesurable) {
        poidsMesure += w; avant += l.margeJourAvant; pendant += l.margeJourPendant; gain += l.gain;
      }
    });
    var lancements = lignes.filter(function (l) { return l.lancement; });
    var partMesurable = poidsTotal > EPS ? poidsMesure / poidsTotal : (hors.length ? 0 : null);
    var mesurable = hors.length > 0 && partMesurable !== null && arr(partMesurable) >= PART_MIN_MESURABLE;
    var taux = mesurable && avant > EPS ? pendant / avant : null;
    var gainApresCouts = gain - totalCouts;
    return {
      lignes: lignes, nbProduits: lignes.length, nbLancements: lancements.length,
      margeJourAvant: avant, margeJourPendant: pendant, taux: taux, gain: gain, couts: totalCouts, gainApresCouts: gainApresCouts,
      partMesurable: partMesurable, mesurable: mesurable,
      margeLancement: lancements.reduce(function (s, l) { return s + (l.margePendantTotale || 0); }, 0),
      etat: mesurable ? etat(taux, gainApresCouts) : 'non_mesurable'
    };
  }

  root.NexusMesureCompensation = {
    SEUIL_INSUFFISANTE: SEUIL_INSUFFISANTE, SEUIL_EQUILIBRE: SEUIL_EQUILIBRE, SEUIL_RENOUVELER: SEUIL_RENOUVELER,
    GAIN_MIN_RENOUVELER: GAIN_MIN_RENOUVELER, PART_MIN_MESURABLE: PART_MIN_MESURABLE,
    choisirStock: choisirStock, etat: etat, mesurerProduit: mesurerProduit, mesurerCampagne: mesurerCampagne
  };
})(typeof window !== 'undefined' ? window : globalThis);
