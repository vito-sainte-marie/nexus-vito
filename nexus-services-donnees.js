// NEXUS — clôture des services : accès aux données (04/09/2026).
//
// Aucune règle métier ici : tout passe par NexusServicesMoteur, qui décide
// si une clôture est possible et sous quelle forme. Ce fichier ne fait que
// lire et écrire (Article 11).
(function (global) {
  'use strict';

  const CHAMPS = 'id, employee_id, site_id, site, role, role_prevu, quart, statut, heure_debut, heure_fin, cloture_par, cloture_le, cloture_source, cloture_motif';

  // Le service ouvert d'un employé. Un seul peut l'être : la lecture
  // remonte aussi les éventuels doublons plutôt que d'en choisir un en
  // silence (voir NexusServicesMoteur.serviceOuvert).
  async function chargerServiceOuvert(client, employeeId) {
    const { data, error } = await client
      .from('shifts').select(CHAMPS)
      .eq('employee_id', employeeId).eq('statut', 'en_cours')
      .order('heure_debut', { ascending: false });
    if (error) throw error;
    return global.NexusServicesMoteur.serviceOuvert(data || [], employeeId);
  }

  // Tous les services d'un site sur une fenêtre — vue manager.
  async function chargerServicesSite(client, siteId, { depuis, jusqua } = {}) {
    let requete = client.from('shifts').select(CHAMPS).eq('site_id', siteId);
    if (depuis) requete = requete.gte('heure_debut', depuis);
    if (jusqua) requete = requete.lt('heure_debut', jusqua);
    const { data, error } = await requete.order('heure_debut', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Clôture un service. Le moteur valide d'abord : si la clôture est
   * refusée, rien n'est envoyé à la base et la raison est remontée telle
   * quelle à l'écran — jamais un échec muet.
   *
   * `.eq('statut', 'en_cours')` sur l'écriture : si le service a été
   * clôturé entre-temps par quelqu'un d'autre (le manager pendant que
   * l'employé termine), l'écriture ne touche aucune ligne et on le dit,
   * plutôt que d'écraser la décision de l'autre.
   */
  async function cloturerService(client, shift, options) {
    const decision = global.NexusServicesMoteur.preparerCloture(shift, options);
    if (!decision.ok) return { ok: false, erreur: decision.erreur };

    const { data, error } = await client
      .from('shifts').update(decision.patch)
      .eq('id', shift.id).eq('statut', 'en_cours')
      .select('id');
    if (error) return { ok: false, erreur: error.message };
    if (!data || !data.length) {
      return { ok: false, erreur: 'Ce service vient d’être clôturé ailleurs — rechargez la page pour voir son état réel.' };
    }
    return { ok: true, patch: decision.patch };
  }

  /**
   * Ouvre un service, en clôturant d'abord celui qui serait resté ouvert.
   * Ouvrir un nouveau service EST la preuve que le précédent est fini —
   * mais pas de quand : il est donc clos sans heure de fin, jamais avec
   * une heure inventée.
   *
   * La clôture précède l'ouverture : si elle échoue, on n'ouvre pas, et
   * l'employé ne se retrouve pas avec deux services ouverts.
   */
  async function ouvrirService(client, { employeeId, siteId, role, rolePrevu, quart, horsPlanning }) {
    const precedent = await chargerServiceOuvert(client, employeeId);
    const aFermer = [precedent.service, ...precedent.enTrop].filter(Boolean);
    for (const s of aFermer) {
      const r = await cloturerService(client, s, {
        source: 'prise_de_poste_suivante', actorId: employeeId,
        motif: 'Clos par l’ouverture d’un nouveau service : heure de fin réelle inconnue.',
      });
      if (!r.ok) return { ok: false, erreur: `Le service précédent n’a pas pu être clôturé : ${r.erreur}` };
    }

    const ligne = {
      employee_id: employeeId, site_id: siteId, site: siteId,
      role, role_prevu: rolePrevu || null, quart: quart || null,
      confirmed_by: 'employe', statut: 'en_cours',
    };
    const { data, error } = await client.from('shifts').insert(ligne).select(CHAMPS).maybeSingle();
    if (error) return { ok: false, erreur: error.message };
    return { ok: true, service: data, precedentsClos: aFermer.length, horsPlanning: !!horsPlanning };
  }

  global.NexusServicesDonnees = { chargerServiceOuvert, chargerServicesSite, cloturerService, ouvrirService, CHAMPS };
})(typeof window !== 'undefined' ? window : globalThis);
