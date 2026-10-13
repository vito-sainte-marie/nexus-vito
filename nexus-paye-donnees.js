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
      // LA VUE, PAS LA TABLE — et `publie` demande explicitement.
      // `v_planning_officiel` n'expose que la provenance qui faisait foi a
      // chaque date : lire `planning_shifts` compterait deux fois une journee
      // ou l'import Google Sheets et la generation NEXUS coexistent.
      // `publie` est exige ici parce que l'ecran Paye s'ouvre au manager, a
      // qui la RLS montre aussi les brouillons : sans ce filtre, un planning
      // en cours de redaction entrerait dans un rapport de paye.
      client.from('v_planning_officiel').select('id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache').eq('site_id', siteId).eq('publie', true).gte('date', debut).lt('date', fin),
      client.from('pointages').select('id, employee_id, date, type, heure, quart, retard_min, anomalie_signalee').eq('site', siteId).gte('date', debut).lt('date', fin),
      client.from('employee_indisponibilites').select('id, employee_id, date_debut, date_fin, type, commentaire, motif, confirme_le, fin_indeterminee, date_reprise').eq('site_id', siteId).lte('date_debut', fin).gte('date_fin', debut),
      client.from('audits_caisse').select('id, date, quart, statut, employes_piste, employes_boutique').eq('site', siteId).gte('date', debut).lt('date', fin),
      client.from('nexus_paye_items').select('*').eq('site_id', siteId).eq('periode', debut),
      client.from('nexus_paye_periodes').select('*').eq('site_id', siteId).eq('periode', debut).maybeSingle(),
      client.from('station_config').select('paye_config,horaires,planning_source,planning_google_sheet_url,planning_google_sheet_id,pointage_actif').eq('site', siteId).maybeSingle(),
      global.NexusEcartsDonnees.chargerEcartsConsolides(client, siteId, { dateDebut: debut, dateFin: fin }),
    ]);
    [emp, settings, planning, pointages, indispos, audits, items, periodeRes, configRes].forEach(r => { if (r.error) throw r.error; });

    // Les renforts déclarés à la clôture Verify se lisent À PART, et leur
    // absence ne casse rien.
    //
    // `audits_caisse.employes_renfort` est créée par la migration du
    // 09/10/2026, qui n'est appliquée nulle part : elle attend sa gate
    // humaine. Demandée dans le select principal, une colonne inexistante
    // fait échouer TOUTE la requête (PostgREST 42703) — et Paye ne
    // s'ouvrirait plus du tout, faute d'une colonne qui ne sert qu'à une
    // rubrique. Le mois entier deviendrait illisible pour un renfort.
    //
    // D'où cette seconde lecture, isolée : avant la migration elle échoue
    // seule, le rapport le DIT, et le reste du mois se calcule. Après, les
    // renforts arrivent sans rien changer d'autre. C'est ce que le cahier
    // des charges appelle une évolution compatible avec les enregistrements
    // existants.
    let renforts = null;
    try {
      const r = await client.from('audits_caisse')
        .select('id, date, quart, employes_renfort')
        .eq('site', siteId).gte('date', debut).lt('date', fin);
      if (!r.error) renforts = r.data || [];
    } catch (e) { renforts = null; }

    const parCle = new Map();
    (renforts || []).forEach(l => parCle.set(`${l.date}|${l.quart}`, l.employes_renfort));
    const auditsEnrichis = (audits.data || []).map(a => (parCle.has(`${a.date}|${a.quart}`)
      ? Object.assign({}, a, { employes_renfort: parCle.get(`${a.date}|${a.quart}`) })
      : a));
    const rapport = M.construireRapport({
      periode: debut, employees: emp.data || [], settings: settings.data || [], planning: planning.data || [],
      pointages: pointages.data || [], indisponibilites: indispos.data || [], audits: auditsEnrichis,
      items: items.data || [], config: (configRes.data && configRes.data.paye_config) || {}, ecarts: ecarts || [],
      pointageActif: !(configRes.data && configRes.data.pointage_actif === false),
      horaires: (configRes.data && configRes.data.horaires) || null,
    });
    // Le manager doit savoir qu'il lit un mois sans renforts PARCE QUE la
    // colonne manque, et non parce qu'il n'y en a pas eu.
    rapport.renfortsLisibles = renforts !== null;
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
    // Le moteur porte la liste de référence. S'il n'est pas chargé, on
    // ÉCHOUE — on ne laisse jamais passer « par défaut ». Une première
    // version repliait sur une liste vide : le garde-fou s'ouvrait alors en
    // grand au lieu de se fermer, exactement le contraire de son rôle, et
    // sans le moindre signal. Un refus silencieusement désactivé coûte plus
    // cher qu'une erreur franche (même discipline que chargerRapport).
    const M = global.NexusPayeMoteur;
    if (!M || !Array.isArray(M.TYPES_ITEM_EVENEMENT_RH)) {
      throw new Error('Moteur PAYE indisponible : impossible de vérifier le type d’élément avant écriture.');
    }
    if (M.TYPES_ITEM_EVENEMENT_RH.includes(typeItem)) {
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


  // Sonde de la migration du 09/10/2026 (§5.4 et §9).
  //
  // Les deux saisies que cette migration rend possibles, l'horaire
  // exceptionnel et le marquage d'une anomalie, ont besoin l'une de la
  // colonne `detail`, l'autre des trois statuts de traitement. Les deux
  // arrivent par le MÊME fichier de migration : une seule sonde suffit donc
  // à savoir si l'une ou l'autre est offrable.
  //
  // On sonde la colonne plutôt que la contrainte, parce qu'une contrainte
  // CHECK ne se teste qu'en écrivant, et qu'on n'écrit pas pour voir.
  //
  // Avant la migration, la fonction répond false et l'écran n'offre pas ces
  // saisies : mieux vaut ne rien proposer que proposer un bouton qui perdra
  // ce que le manager vient de taper.
  async function sonderSaisiesManager(client) {
    try {
      const { error } = await client.from('nexus_paye_items').select('detail').limit(1);
      if (error) { console.warn('PAYE : colonne detail absente, saisies manager masquées.', error.message); return false; }
      return true;
    } catch (e) {
      console.warn('PAYE : sonde des saisies manager impossible.', e && e.message);
      return false;
    }
  }

  // Horaire exceptionnel saisi par le manager (§5.4).
  //
  // Le moteur RECALCULE la durée nette à partir de debut, fin et pause : on
  // n'enregistre donc pas d'heures ici, seulement ce qui a été saisi. Et
  // `heures_initiales` garde la valeur d'avant correction, pour que
  // l'historique du changement soit lisible sans journal séparé.
  //
  // impact_paye reste faux : ces heures entrent dans le calcul par la durée
  // du jour, pas comme une variable qui s'additionne. Le mettre à vrai
  // paierait la même journée deux fois.
  async function enregistrerHoraireExceptionnel(client, payload) {
    const { siteId, employeeId, periode, date, debut, fin, pauseMinutes, motif, justification, heuresInitiales, actorId } = payload;
    if (!siteId || !employeeId || !periode || !date) throw new Error('Salarié et date sont obligatoires');
    if (!/^\d{2}:\d{2}$/.test(String(debut || '')) || !/^\d{2}:\d{2}$/.test(String(fin || ''))) throw new Error('Heures de début et de fin attendues au format HH:MM');
    if (!motif) throw new Error('Un horaire exceptionnel doit porter son motif');
    if (!justification) throw new Error('Un horaire exceptionnel doit porter sa justification');
    const pause = pauseMinutes == null || pauseMinutes === '' ? 0 : Number(pauseMinutes);
    if (!Number.isFinite(pause) || pause < 0) throw new Error('Pause invalide');
    const M = global.NexusPayeMoteur;
    const nette = M && M.dureeNetteHeures ? M.dureeNetteHeures(debut, fin, pause) : null;
    if (nette == null) throw new Error('La fin doit suivre le début, pause déduite');
    const maintenant = new Date().toISOString();
    const sourceCle = `horaire-exceptionnel:${employeeId}:${date}`;
    // Historique (arbitrage B, 13/10/2026) : une nouvelle saisie du même jour
    // ne perd jamais la précédente, elle est empilée dans `historique`.
    let historique = [];
    try {
      const { data: avant } = await client.from('nexus_paye_items').select('detail')
        .eq('site_id', siteId).eq('periode', periode).eq('employee_id', employeeId).eq('source_cle', sourceCle).maybeSingle();
      const d = avant && avant.detail;
      if (d) {
        historique = Array.isArray(d.historique) ? d.historique.slice() : [];
        historique.push({ debut: d.debut, fin: d.fin, pause_minutes: d.pause_minutes, motif: d.motif, justification: d.justification || null, auteur: d.auteur || null, saisi_le: d.saisi_le || null });
      }
    } catch (e) { /* lecture de l'historique impossible : la saisie reste enregistrée */ }
    const ligne = {
      site_id: siteId, employee_id: employeeId, periode, date_evenement: date,
      type_item: 'horaire_exceptionnel', origine: 'manuel',
      source_cle: sourceCle,
      libelle: `Horaire exceptionnel ${debut} à ${fin}`,
      quantite_minutes: Math.round(nette * 60),
      statut: 'valide', impact_paye: false, note: motif,
      detail: {
        debut, fin, pause_minutes: pause, motif, justification,
        provenance: 'manuelle', historique,
        auteur: actorId || null, saisi_le: maintenant,
        heures_initiales: heuresInitiales == null || heuresInitiales === '' ? null : Number(heuresInitiales),
      },
      cree_par: actorId, modifie_par: actorId, modifie_le: maintenant,
    };
    const { error } = await client.from('nexus_paye_items').upsert(ligne, { onConflict: 'site_id,periode,employee_id,source_cle' });
    if (error) throw error;
    return nette;
  }

  // Marquage du traitement d'une anomalie de concordance (§9).
  //
  // « Le traitement d'une anomalie ne doit pas modifier silencieusement les
  // heures. » C'est exactement pourquoi cette fonction écrit un statut de
  // traitement et une justification, et RIEN d'autre : ni quantité, ni
  // montant, ni impact_paye. L'écart reste l'écart ; seule sa lecture par le
  // manager change.
  //
  // `exclu` restait auparavant le seul moyen de solder une ligne, et exclure
  // retire des heures. Les trois statuts existent pour cette raison.
  const STATUTS_TRAITEMENT = ['examine', 'corrige', 'justifie'];

  async function marquerTraitementAnomalie(client, payload) {
    const { siteId, employeeId, periode, item, statut, justification, actorId } = payload;
    if (!STATUTS_TRAITEMENT.includes(statut)) throw new Error('Statut de traitement inconnu');
    if (!item || !item.sourceCle) throw new Error('Anomalie sans clé de source');
    const maintenant = new Date().toISOString();
    const ligne = {
      site_id: siteId, employee_id: employeeId, periode,
      date_evenement: item.date || null, type_item: item.typeItem, origine: item.origine || 'verify',
      source_cle: item.sourceCle, libelle: item.libelle,
      quantite_minutes: item.quantiteMinutes == null ? null : item.quantiteMinutes,
      statut, impact_paye: false, note: justification || null,
      modifie_par: actorId, modifie_le: maintenant,
    };
    const { error } = await client.from('nexus_paye_items').upsert(ligne, { onConflict: 'site_id,periode,employee_id,source_cle' });
    if (error) throw error;
  }

  global.NexusPayeDonnees = { declarerIndisponibilite, qualifierIndisponibilite, cloturerIndisponibilite, chargerRapport, enregistrerReglageEmploye, enregistrerDecision, ajouterItemManuel, ajouterItemsManuels, datesInclusives, enregistrerPeriode, refuserEvenementRHParJournee, sonderSaisiesManager, enregistrerHoraireExceptionnel, marquerTraitementAnomalie, STATUTS_TRAITEMENT };
})(typeof window !== 'undefined' ? window : globalThis);
