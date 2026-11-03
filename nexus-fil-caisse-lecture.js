'use strict';
// Lecture de l'entrée du fil « Ma caisse » (lot INVENTAIRE-CAISSE-RENFORT, L1, incrément 3), pour la page Missions.
// Lectures seules, déjà existantes, filtrées par site / employé : station_config (parametres_inventaire, horaires), inventaire_quart_employes.
// Aucune lecture hors caissière en service ; toute erreur de lecture = aucun lien (refus par défaut).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NexusFilCaisseLecture = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  // ctx : { client, employee, roleDuJour, enService, quartDuJour, fuseau } ; globals : NexusFilCaisse, NexusPilotesInventaire, NexusStation
  async function lienEntree(ctx, g) {
    const G = g || root;
    const C = G.NexusFilCaisse, P = G.NexusPilotesInventaire, S = G.NexusStation;
    const { client, employee, roleDuJour, enService, quartDuJour, fuseau } = ctx;
    if (enService !== true || roleDuJour !== C.ROLE || !employee || !employee.site_id || !fuseau) return null;
    const lecture = await client.from('station_config').select('parametres_inventaire, horaires').eq('site', employee.site_id).maybeSingle();
    if (lecture.error) { console.error('Chargement entrée fil caisse:', lecture.error); return null; }
    const cfg = lecture.data || {};
    const pilote = P.estPiloteCaisse(cfg.parametres_inventaire, employee.id);
    if (pilote !== true) return null;
    const r = await client.from('inventaire_quart_employes').select('responsable_comptage, a_valide_ouverture, inventaire_quarts(date, quart, cloture_le, is_simulation, statut)').eq('employee_id', employee.id);
    if (r.error) { console.error('Chargement inventaire_quart_employes (fil caisse):', r.error); return null; }
    const faits = C.faitsInventaire(r.data, S.dateLocaleStation(fuseau), quartDuJour || null);
    const due = C.fermetureDueEnService({ station: S, horaires: cfg.horaires, quartDuJour, fuseau });
    return C.lienEntree(pilote, roleDuJour, enService, { ...faits, fermetureDue: due });
  }
  return { lienEntree };
});
