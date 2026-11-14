// ============================================================
// Campagne V2, lot C2 : moteur pur du suivi des ventes pendant la promotion.
// Aucune écriture, aucun accès réseau : des fonctions de calcul sur des lignes déjà lues.
// Le point qui fait foi est le dernier import valide, jamais une somme de deux imports.
// Le chiffre d'affaires est HT, comme la colonne « Prix de vente HT » du fichier importé.
// Inclure : <script src="nexus-campagne-ventes.js?v=20261114-1900"></script>
// ============================================================
(function (global) {
  'use strict';

  const JOUR_MS = 86400000;
  const SEUIL_MOTEUR = 0.8;

  function aDate(d) {
    if (d instanceof Date) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  function jourIso(d) { return aDate(d).toISOString().slice(0, 10); }
  function ecartJours(a, b) { return Math.round((aDate(b) - aDate(a)) / JOUR_MS); }

  // Import valide : ni annulé (table d'annulations), ni remplacé par un import publié.
  // Un import de remplacement abandonné ou en échec ne rend pas l'ancien invalide.
  function importsValides(points, annulations) {
    const annules = new Set((annulations || []).map(a => a.batch_id));
    const parBatch = new Map();
    (points || []).forEach(p => {
      if (annules.has(p.batch_id)) return;
      if (!parBatch.has(p.batch_id)) parBatch.set(p.batch_id, []);
      parBatch.get(p.batch_id).push(p);
    });
    return parBatch;
  }

  // Point courant : lignes du dernier import valide (date de fin la plus tardive, puis le plus récent).
  function pointCourant(points, annulations) {
    const valides = importsValides(points, annulations);
    let meilleur = null;
    valides.forEach((lignes, batch) => {
      const t = lignes[0];
      const cle = [t.date_fin, t.importe_le || ''];
      if (!meilleur || cle[0] > meilleur.cle[0] || (cle[0] === meilleur.cle[0] && cle[1] > meilleur.cle[1])) {
        meilleur = { batch, cle, lignes };
      }
    });
    return meilleur ? { batch_id: meilleur.batch, date_fin: meilleur.cle[0], lignes: meilleur.lignes } : null;
  }

  // Historique : tous les imports, valides ou non, avec leur état. Rien n'est jamais masqué.
  function historique(points, annulations) {
    const annul = new Map((annulations || []).map(a => [a.batch_id, a]));
    const parBatch = new Map();
    (points || []).forEach(p => { if (!parBatch.has(p.batch_id)) parBatch.set(p.batch_id, p); });
    return Array.from(parBatch.values())
      .map(p => ({ batch_id: p.batch_id, date_fin: p.date_fin, importe_le: p.importe_le, annule: annul.has(p.batch_id), motif: annul.has(p.batch_id) ? annul.get(p.batch_id).motif : null }))
      .sort((a, b) => String(b.importe_le).localeCompare(String(a.importe_le)));
  }

  // Contrôle de la date de fin des ventes. Retourne null si valide, sinon le motif du refus.
  function verifierDateFin(dateFin, { aujourdhui, campagneDebut, campagneFin, dernierImportFin } = {}) {
    const f = aDate(dateFin);
    if (!f) return 'Date de fin des ventes manquante.';
    const veille = aDate(aujourdhui); veille.setUTCDate(veille.getUTCDate() - 1);
    if (f > veille) return 'La date de fin ne peut pas dépasser la veille.';
    if (campagneFin && f > aDate(campagneFin)) return 'La date de fin ne peut pas dépasser la fin de la promotion.';
    if (campagneDebut && f < aDate(campagneDebut)) return 'La date de fin précède le début de la promotion.';
    if (dernierImportFin && f < aDate(dernierImportFin)) return 'La date de fin précède le dernier import valide. Annulez-le d\'abord avec un motif.';
    return null;
  }

  // Jours restants à partir du lendemain de la date de fin des ventes, jusqu'à la fin de la promotion incluse.
  function joursRestants(dateFinVentes, campagneFin) {
    return Math.max(0, ecartJours(dateFinVentes, campagneFin));
  }

  // Effort restant par jour = plafond((seuil - vendu) / jours restants). Jamais négatif.
  // Retourne { etat, parJour } : 'atteint' (seuil couvert), 'termine' (plus aucun jour), 'en_cours'.
  function effortRestant(seuil, vendu, jours) {
    const reste = Math.max(0, Number(seuil || 0) - Number(vendu || 0));
    if (reste === 0) return { etat: 'atteint', parJour: 0, reste: 0 };
    if (!(jours > 0)) return { etat: 'termine', parJour: null, reste };
    return { etat: 'en_cours', parJour: Math.ceil(reste / jours), reste };
  }

  function avancement(seuil, vendu) {
    const s = Number(seuil || 0);
    if (!(s > 0)) return null;
    return Math.min(1, Number(vendu || 0) / s);
  }

  // Moteur ou à revoir : règle des 80 % de l'objectif cumulé attendu à la date de fin des ventes.
  function classer(vendu, objectifJour, joursEcoules) {
    const attendu = Number(objectifJour || 0) * Math.max(0, joursEcoules);
    if (!(attendu > 0)) return 'non_mesurable';
    return Number(vendu || 0) >= SEUIL_MOTEUR * attendu ? 'moteur' : 'a_revoir';
  }

  // Marge mesurable HT : CA HT - quantité x PA promo HT. Absente si le PA promo est inconnu.
  function margeHt(ligne, paPromoHt) {
    if (paPromoHt == null || !Number.isFinite(Number(paPromoHt))) return null;
    return Number(ligne.ca_ht || 0) - Number(ligne.quantite || 0) * Number(paPromoHt);
  }

  // Suivi par article à partir du point courant et des objectifs validés (jamais modifiés ici).
  function suivre({ point, objectifs, campagneDebut, campagneFin }) {
    if (!point) return { vide: true, lignes: [] };
    const jours = ecartJours(campagneDebut, point.date_fin) + 1;
    const restants = joursRestants(point.date_fin, campagneFin);
    const obj = new Map((objectifs || []).map(o => [o.article, o]));
    const lignes = point.lignes.map(l => {
      const o = obj.get(l.article) || {};
      return {
        article: l.article,
        vendu: Number(l.quantite || 0),
        ca_ht: Number(l.ca_ht || 0),
        absent_du_fichier: !!l.absent_du_fichier,
        seuil: o.seuil_unites == null ? null : o.seuil_unites,
        avancement: avancement(o.seuil_unites, l.quantite),
        effort: o.seuil_unites == null ? null : effortRestant(o.seuil_unites, l.quantite, restants),
        statut: classer(l.quantite, o.objectif_valide_jour, jours),
        marge_ht: margeHt(l, o.pa_promo_ht),
      };
    });
    return { vide: false, date_fin: point.date_fin, jours_ecoules: jours, jours_restants: restants, lignes };
  }

  global.NexusCampagneVentes = {
    SEUIL_MOTEUR, importsValides, pointCourant, historique, verifierDateFin, joursRestants,
    effortRestant, avancement, classer, margeHt, suivre, jourIso, ecartJours,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusCampagneVentes;
})(typeof window !== 'undefined' ? window : globalThis);
