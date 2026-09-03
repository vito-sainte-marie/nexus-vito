// NEXUS PAYE — accès aux sources canoniques et persistance des seuls arbitrages.
(function (global) {
  async function chargerRapport(client, siteId, periode) {
    const M = global.NexusPayeMoteur;
    if (!M) throw new Error('Moteur PAYE indisponible');
    const debut = M.moisISO(periode);
    const fin = M.finMoisISO(periode);
    const [emp, settings, planning, pointages, indispos, audits, items, periodeRes, configRes, ecarts] = await Promise.all([
      client.from('employees').select('id, username, nom, role, actif, site_id').eq('site_id', siteId).eq('actif', true).order('nom'),
      client.from('nexus_paye_employee_settings').select('*').eq('site_id', siteId),
      client.from('planning_shifts').select('id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache').eq('site_id', siteId).gte('date', debut).lt('date', fin),
      client.from('pointages').select('id, employee_id, date, type, heure, quart, retard_min, anomalie_signalee').eq('site', siteId).gte('date', debut).lt('date', fin),
      client.from('employee_indisponibilites').select('id, employee_id, date_debut, date_fin, type, commentaire, motif, confirme_le, fin_indeterminee, date_reprise').eq('site_id', siteId).lte('date_debut', fin).gte('date_fin', debut),
      client.from('audits_caisse').select('id, date, quart, statut, employes_piste, employes_boutique').eq('site', siteId).gte('date', debut).lt('date', fin),
      client.from('nexus_paye_items').select('*').eq('site_id', siteId).eq('periode', debut),
      client.from('nexus_paye_periodes').select('*').eq('site_id', siteId).eq('periode', debut).maybeSingle(),
      client.from('station_config').select('paye_config,planning_source,planning_google_sheet_url,planning_google_sheet_id').eq('site', siteId).maybeSingle(),
      global.NexusEcartsDonnees.chargerEcartsConsolides(client, siteId, { dateDebut: debut, dateFin: fin }),
    ]);
    [emp, settings, planning, pointages, indispos, audits, items, periodeRes, configRes].forEach(r => { if (r.error) throw r.error; });
    const rapport = M.construireRapport({
      periode: debut, employees: emp.data || [], settings: settings.data || [], planning: planning.data || [],
      pointages: pointages.data || [], indisponibilites: indispos.data || [], audits: audits.data || [],
      items: items.data || [], config: (configRes.data && configRes.data.paye_config) || {}, ecarts: ecarts || [],
    });
    rapport.periodeEnregistree = periodeRes.data || null;
    rapport.config = (configRes.data && configRes.data.paye_config) || {};
    rapport.planningOfficiel = {
      source: (configRes.data && configRes.data.planning_source) || 'nexus',
      url: (configRes.data && configRes.data.planning_google_sheet_url) || null,
    };
    return rapport;
  }

  async function enregistrerReglageEmploye(client, payload) {
    const ligne = {
      employee_id: payload.employeeId, site_id: payload.siteId,
      inclus_paye: !!payload.inclusPaye, mode_presence: payload.modePresence,
      commentaire: payload.commentaire || null, updated_at: new Date().toISOString(), updated_by: payload.actorId,
    };
    const { error } = await client.from('nexus_paye_employee_settings').upsert(ligne, { onConflict: 'employee_id' });
    if (error) throw error;
  }

  async function enregistrerDecision(client, payload) {
    const ligne = {
      site_id: payload.siteId, employee_id: payload.employeeId, periode: payload.periode,
      date_evenement: payload.item.date || null, type_item: payload.item.typeItem,
      origine: payload.item.origine || 'manuel', source_cle: payload.item.sourceCle,
      libelle: payload.item.libelle, quantite_minutes: payload.quantiteMinutes == null ? (payload.item.quantiteMinutes ?? null) : payload.quantiteMinutes,
      montant_centimes: payload.montantCentimes == null ? null : payload.montantCentimes,
      statut: payload.statut, impact_paye: !!payload.impactPaye, note: payload.note || null,
      cree_par: payload.actorId, modifie_par: payload.actorId, modifie_le: new Date().toISOString(),
    };
    const { error } = await client.from('nexus_paye_items').upsert(ligne, { onConflict: 'site_id,periode,employee_id,source_cle' });
    if (error) throw error;
  }

  async function ajouterItemManuel(client, payload) {
    return ajouterItemsManuels(client, Object.assign({}, payload, { dates: [payload.date] }));
  }

  function datesInclusives(dateDebut, dateFin) {
    const debut = String(dateDebut || '');
    const fin = String(dateFin || dateDebut || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) throw new Error('Période invalide');
    const courant = new Date(`${debut}T00:00:00Z`);
    const dernier = new Date(`${fin}T00:00:00Z`);
    if (Number.isNaN(courant.getTime()) || Number.isNaN(dernier.getTime()) || courant.toISOString().slice(0, 10) !== debut || dernier.toISOString().slice(0, 10) !== fin) throw new Error('Période invalide');
    if (dernier < courant) throw new Error('La date de fin précède la date de début');
    const dates = [];
    while (courant <= dernier) {
      dates.push(courant.toISOString().slice(0, 10));
      courant.setUTCDate(courant.getUTCDate() + 1);
      if (dates.length > 62) throw new Error('Période trop longue');
    }
    return dates;
  }

  // Garde-fou de modèle de données (03/09/2026). Une absence longue, un
  // congé, une maternité, une paternité, une formation ou un arrêt maladie
  // est UN événement porté par `employee_indisponibilites` — pas N lignes
  // `nexus_paye_items`. Ce refus est ici, dans la couche de données, et pas
  // seulement dans l'écran : aucun chemin de code ne peut plus recréer le
  // dépliage par journée que le moteur vient précisément d'abolir.
  function refuserEvenementRHParJournee(typeItem) {
    const interdits = (global.NexusPayeMoteur && global.NexusPayeMoteur.TYPES_ITEM_EVENEMENT_RH) || [];
    if (interdits.includes(typeItem)) {
      throw new Error('Un congé, une maladie, une maternité, une paternité, une formation ou une absence longue se déclare comme un événement RH unique (date de début et de fin), jamais journée par journée. Utilisez « Déclarer un événement RH ».');
    }
  }

  async function ajouterItemsManuels(client, payload) {
    refuserEvenementRHParJournee(payload.typeItem);
    const dates = Array.isArray(payload.dates) ? payload.dates : datesInclusives(payload.dateDebut, payload.dateFin);
    if (!dates.length) throw new Error('Aucune date à enregistrer');
    const groupe = global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const maintenant = new Date().toISOString();
    const lignes = dates.map(date => ({
      site_id: payload.siteId, employee_id: payload.employeeId, periode: payload.periode,
      date_evenement: date, type_item: payload.typeItem, origine: 'manuel',
      source_cle: `manuel:${groupe}:${date}`, libelle: payload.libelle,
      quantite_minutes: payload.quantiteMinutes == null ? null : payload.quantiteMinutes,
      montant_centimes: payload.montantCentimes == null ? null : payload.montantCentimes,
      statut: 'valide', impact_paye: !!payload.impactPaye, note: payload.note || null,
      cree_par: payload.actorId, modifie_par: payload.actorId, modifie_le: maintenant,
    }));
    const { error } = await client.from('nexus_paye_items').upsert(lignes, { onConflict: 'site_id,periode,employee_id,source_cle' });
    if (error) throw error;
  }

  // Qualification d'un événement RH (03/09/2026). Écrit sur l'événement
  // lui-même, jamais sur un item de période : c'est ce qui fait qu'octobre
  // n'aura pas à redemander ce que le manager a tranché en septembre.
  //
  // `finIndeterminee` couvre le retour dont la date n'est pas connue :
  // date_fin reste alors un horizon provisoire, et NEXUS maintient
  // l'indisponibilité sans réafficher le salarié chaque mois.
  async function qualifierIndisponibilite(client, { id, motif, dateFin, finIndeterminee, commentaire, actorId }) {
    const patch = {
      motif: motif || null,
      confirme_le: motif ? new Date().toISOString() : null,
      confirme_par: motif ? (actorId || null) : null,
    };
    if (finIndeterminee != null) patch.fin_indeterminee = !!finIndeterminee;
    if (dateFin) patch.date_fin = dateFin;
    if (commentaire !== undefined) patch.commentaire = commentaire || null;
    const { error } = await client.from('employee_indisponibilites').update(patch).eq('id', id);
    if (error) throw error;
  }

  // Transforme une série d'absences DÉTECTÉE en événement RH déclaré
  // (03/09/2026). C'est le chaînon qui rend le mécanisme général : sans lui,
  // seules les absences saisies à l'avance dans le Planning bénéficiaient du
  // regroupement et de la mémoire. Désormais, une absence constatée après
  // coup suit exactement le même chemin — déclarée une fois, plus jamais
  // redemandée.
  async function declarerIndisponibilite(client, { siteId, employeeId, dateDebut, dateFin, motif, finIndeterminee, commentaire, actorId }) {
    if (!employeeId || !dateDebut) throw new Error('Employé et date de début requis.');
    if (!motif) throw new Error('Un motif est requis : NEXUS ne qualifie jamais une absence à votre place.');
    const motifsConnus = (global.NexusPayeMoteur && global.NexusPayeMoteur.MOTIFS_INDISPO) || null;
    if (motifsConnus && !motifsConnus[motif]) throw new Error(`Motif inconnu : « ${motif} ».`);
    if (dateFin && dateFin < dateDebut) throw new Error('La date de fin précède la date de début.');
    const ligne = {
      site_id: siteId, employee_id: employeeId,
      date_debut: dateDebut, date_fin: dateFin || dateDebut,
      type: motif === 'conge' ? 'conge' : 'indisponible',
      motif, fin_indeterminee: !!finIndeterminee,
      commentaire: commentaire || null,
      confirme_le: new Date().toISOString(), confirme_par: actorId || null,
      cree_par: actorId || null,
    };
    const { data, error } = await client.from('employee_indisponibilites').insert(ligne).select().maybeSingle();
    if (error) throw error;
    return data;
  }

  // Clôture : le salarié a repris. La date de reprise prime sur date_fin et
  // referme la période — on ne réécrit jamais l'événement d'origine, on le
  // borne (même discipline que partout ailleurs dans NEXUS).
  async function cloturerIndisponibilite(client, { id, dateReprise }) {
    if (!dateReprise) throw new Error('Date de reprise requise pour clôturer une indisponibilité.');
    const veille = new Date(`${dateReprise}T12:00:00`);
    veille.setDate(veille.getDate() - 1);
    const finISO = veille.toISOString().slice(0, 10);
    const { error } = await client.from('employee_indisponibilites')
      .update({ date_reprise: dateReprise, date_fin: finISO, fin_indeterminee: false }).eq('id', id);
    if (error) throw error;
  }

  async function enregistrerPeriode(client, { siteId, periode, statut, snapshot, actorId }) {
    const maintenant = new Date().toISOString();
    const ligne = { site_id: siteId, periode, statut, snapshot: snapshot || null, updated_at: maintenant };
    if (statut === 'verifie') { ligne.verifie_par = actorId; ligne.verifie_le = maintenant; }
    if (statut === 'transmis') { ligne.transmis_par = actorId; ligne.transmis_le = maintenant; }
    if (statut === 'brouillon') { ligne.snapshot = null; ligne.verifie_par = null; ligne.verifie_le = null; ligne.transmis_par = null; ligne.transmis_le = null; }
    const { error } = await client.from('nexus_paye_periodes').upsert(ligne, { onConflict: 'site_id,periode' });
    if (error) throw error;
  }

  global.NexusPayeDonnees = { declarerIndisponibilite, qualifierIndisponibilite, cloturerIndisponibilite, chargerRapport, enregistrerReglageEmploye, enregistrerDecision, ajouterItemManuel, ajouterItemsManuels, datesInclusives, enregistrerPeriode, refuserEvenementRHParJournee };
})(typeof window !== 'undefined' ? window : globalThis);
