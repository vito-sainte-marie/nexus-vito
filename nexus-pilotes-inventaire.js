// NEXUS — Pilotes de l'inventaire caisse (lot INVENTAIRE-CAISSE-RENFORT, étapes 3 et 4).
// Clés additives de station_config.parametres_inventaire : pilotesCaisse et pilotesRenfort,
// listes d'employee_id, vides par défaut. Aucune migration.
// Refus par défaut : on n'est pilote que si l'id figure explicitement dans une liste bien formée
// du site de l'employé. Clé absente, valeur malformée, liste vide, id absent → fil courant inchangé.
// pilotesRenfort n'a AUCUN lecteur avant L3 : ce module ne l'expose qu'à l'écriture (normalisation, bascule).
// Ce contrôle est un mécanisme de déploiement côté page, pas une frontière d'autorisation.
(function (root) {
  'use strict';

  function normaliserListe(v) {
    if (!Array.isArray(v)) return [];
    const vus = new Set();
    for (const x of v) {
      if (typeof x === 'string' && x.trim() !== '') vus.add(x.trim());
    }
    return Array.from(vus);
  }

  // Liste « bien formée » : tableau dont tous les éléments sont des chaînes non vides.
  // Une liste partiellement corrompue est refusée en bloc plutôt que lue à moitié.
  function listeBienFormee(v) {
    return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '');
  }

  function estPiloteCaisse(parametres, employeeId) {
    if (typeof employeeId !== 'string' || employeeId.trim() === '') return false;
    if (!parametres || typeof parametres !== 'object') return false;
    const liste = parametres.pilotesCaisse;
    if (!listeBienFormee(liste) || liste.length === 0) return false;
    return liste.some((x) => x.trim() === employeeId.trim());
  }

  // Écriture : ajoute ou retire un id, renvoie la liste normalisée à enregistrer.
  function baserPilote(liste, employeeId, actif) {
    const base = normaliserListe(liste).filter((x) => x !== employeeId);
    if (actif && typeof employeeId === 'string' && employeeId.trim() !== '') base.push(employeeId.trim());
    return base;
  }

  const API = { normaliserListe, estPiloteCaisse, baserPilote };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.NexusPilotesInventaire = API;
})(typeof self !== 'undefined' ? self : this);
