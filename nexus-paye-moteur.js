// NEXUS PAYE — moteur métier pur.
// Le planning est une prévision. Verify et Pointage sont des preuves de présence.
// Aucun écart de caisse ne devient une retenue sans décision explicite du manager.
(function (global) {
  const ROLES_SALARIES_PROPOSES = ['caissier', 'pompiste', 'renfort'];
  const STATUTS_TRAVAIL = ['travail_normal', 'manager', 'renfort', 'transfert_site'];

  function moisISO(valeur) {
    const d = valeur instanceof Date ? valeur : new Date(`${String(valeur).slice(0, 7)}-01T12:00:00`);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function finMoisISO(periode) {
    const d = new Date(`${moisISO(periode)}T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  function dateDansMois(date, periode) {
    return !!date && date >= moisISO(periode) && date < finMoisISO(periode);
  }

  function extraireEmployeeIds(valeur) {
    if (!valeur) return [];
    const liste = Array.isArray(valeur) ? valeur : [valeur];
    return [...new Set(liste.map(v => {
      if (typeof v === 'string') return v;
      if (!v || typeof v !== 'object') return null;
      return v.id || v.employee_id || v.employeeId || null;
    }).filter(Boolean))];
  }

  function reglageEmploye(employee, explicite) {
    if (explicite) return {
      employeeId: employee.id,
      inclus: !!explicite.inclus_paye,
      modePresence: explicite.mode_presence || 'automatique',
      confirme: true,
      commentaire: explicite.commentaire || null,
    };
    const role = String(employee.role || '').toLowerCase();
    return {
      employeeId: employee.id,
      inclus: ROLES_SALARIES_PROPOSES.includes(role),
      modePresence: ROLES_SALARIES_PROPOSES.includes(role) ? 'automatique' : 'exclu',
      confirme: false,
      commentaire: null,
    };
  }

  // Motifs qualifiés reconnus. Un événement dont le motif est ici n'est
  // plus une décision à prendre : c'est une information à reporter.
  const MOTIFS_INDISPO = { conge: 'Congé', conge_maternite: 'Congé maternité',
    arret_maladie: 'Arrêt maladie', conge_paternite: 'Congé paternité',
    formation: 'Formation', autre: 'Absence qualifiée' };

  // Types d'item qui NE DOIVENT PLUS être créés journée par journée
  // (03/09/2026). Une absence longue, un congé, une maternité, une
  // paternité, une formation ou un arrêt maladie est UN événement porté par
  // `employee_indisponibilites` — avec date_debut, date_fin, éventuellement
  // fin_indeterminee et date_reprise — jamais N lignes `nexus_paye_items`.
  // La couche de données s'appuie sur cette liste pour refuser la saisie
  // manuelle par journée : le garde-fou est dans le code, pas seulement
  // dans la discipline de l'écran.
  const TYPES_ITEM_EVENEMENT_RH = ['conge_paye', 'arret_maladie', 'conge_maternite',
    'conge_paternite', 'formation', 'absence_a_verifier', 'absence_a_qualifier', 'absence_qualifiee'];

  // Durées de référence de la journée travaillée, indexées par jour de la
  // semaine au sens de getDay() : dimanche 0 … samedi 6. Cahier des charges
  // du 09/10/2026 : lundi, mardi, mercredi et dimanche 7 h ; jeudi, vendredi
  // et samedi 8 h.
  //
  // Trois principes, et le troisième est neuf.
  //
  //   1. C'est le POSTE RÉELLEMENT TENU qui compte, pas le rôle général
  //      inscrit dans NEXUS. Angélique est « renfort » dans la fiche, mais si
  //      Verify la place en boutique un mardi, elle est payée comme une
  //      caissière ce jour-là. Le rôle NEXUS n'est qu'un repli quand aucune
  //      preuve ne dit où la personne a travaillé.
  //   2. C'est la journée constatée dans Verify qui ouvre le droit, jamais la
  //      durée inscrite au planning. Le planning sert à confronter la
  //      prévision au réel ; il ne plafonne pas les heures justifiées.
  //   3. Ces durées sont des HEURES DE TRAVAIL DE RÉFÉRENCE, rien de plus.
  //      Leur qualification en heures normales, complémentaires ou
  //      supplémentaires relève d'un calcul légal et contractuel distinct,
  //      que ce moteur ne fait pas. La huitième heure du jeudi n'est donc
  //      plus annoncée comme supplémentaire : elle est la durée du jeudi.
  const DUREES_REFERENCE_DEFAUT = [7, 7, 7, 7, 8, 8, 8]; // dim, lun, mar, mer, jeu, ven, sam
  const HEURES_RENFORT_DEFAUT = 7;
  // Le renfort n'existe dans le classeur qu'à partir d'octobre 2026 (13/10/2026) : avant, la colonne D
  // est POMPISTE. Défaut d'un réglage de config (renfort_effectif_depuis), donc surchargeable par site.
  const RENFORT_EFFECTIF_DEPUIS_DEFAUT = '2026-10-01';
  const HEURES_BASE_JOUR = 7; // heures normales d'une journée ; au-delà, heures supplémentaires (Q1, 10/10/2026)

  // « 09:00 » → 540. Rend null sur tout ce qui n'est pas un horaire lisible,
  // afin qu'une donnée abîmée devienne une anomalie et non un zéro silencieux.
  function minutesHoraire(valeur) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(valeur == null ? '' : valeur).trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!(h >= 0 && h <= 24) || !(min >= 0 && min < 60)) return null;
    return h * 60 + min;
  }

  function pauseMinutes(horaire) {
    if (!horaire) return 0;
    if (horaire.pause_minutes != null) return Math.max(0, Number(horaire.pause_minutes) || 0);
    const pd = minutesHoraire(horaire.pause_debut);
    const pf = minutesHoraire(horaire.pause_fin);
    if (pd !== null && pf !== null && pf > pd) return pf - pd;
    return 0;
  }

  // Durée nette en heures, pause déduite. Un service à cheval sur minuit est
  // accepté ; une durée nulle ou négative est refusée plutôt que corrigée.
  function dureeNetteHeures(debut, fin, minutesDePause) {
    const d = minutesHoraire(debut);
    const f = minutesHoraire(fin);
    if (d === null || f === null) return null;
    let brut = f - d;
    if (brut < 0) brut += 24 * 60;
    const net = brut - Math.max(0, Number(minutesDePause || 0));
    if (!(net > 0)) return null;
    return Math.round((net / 60) * 100) / 100;
  }

  // Les règles d'heures viennent des Paramètres Station, pas du code. Le code
  // ne garde que le repli, pour qu'une station non paramétrée calcule quand
  // même — et que le repli soit, au mot près, la table du cahier des charges.
  function reglesHeures(config, horaires) {
    const brutes = (config && config.durees_reference) || null;
    const durees = DUREES_REFERENCE_DEFAUT.map((defaut, jour) => {
      const v = Array.isArray(brutes) ? brutes[jour] : (brutes ? brutes[String(jour)] : undefined);
      const n = Number(v);
      return n > 0 && n <= 24 ? n : defaut;
    });
    let heuresRenfort = Number((config && config.heures_renfort) || 0);
    const renfort = horaires && horaires.renfort;
    if (!(heuresRenfort > 0) && renfort) {
      const nette = dureeNetteHeures(renfort.debut, renfort.fin, pauseMinutes(renfort));
      if (nette > 0) heuresRenfort = nette;
    }
    if (!(heuresRenfort > 0)) heuresRenfort = HEURES_RENFORT_DEFAUT;
    return { durees, heuresRenfort };
  }

  function heuresParDefautJour(poste, dateISO, regles) {
    if (!poste || !dateISO) return null;
    const r = regles || reglesHeures(null, null);
    if (poste === 'renfort') return { heures: r.heuresRenfort, heuresNormales: r.heuresRenfort, heuresSupplementaires: 0, poste };
    if (poste !== 'pompiste' && poste !== 'caissier') return null;
    const jour = new Date(`${dateISO}T12:00:00`).getDay();
    // Décision du 10/10/2026 (Q1) : sur un jour à 8 h, la 8e heure EST une heure
    // supplémentaire — 7 h de base + 1 h supplémentaire, jamais 8 h + 1 h.
    // Le taux et la majoration restent hors de ce moteur.
    const d = r.durees[jour], base = Math.min(d, HEURES_BASE_JOUR);
    return { heures: d, heuresNormales: base, heuresSupplementaires: Math.round((d - base) * 100) / 100, poste };
  }

  // Un même salarié ne peut tenir qu'un poste par journée pour le calcul :
  // sans quoi une caissière déclarée aussi en renfort serait payée deux fois.
  // Priorité du cahier des charges §6 : caisse ou piste constatée par Verify
  // l'emporte sur un renfort prévu ou déclaré.
  const PRIORITE_POSTE = ['pompiste', 'caissier', 'renfort'];

  // Poste réellement tenu ce jour-là, dans l'ordre de fiabilité : ce que
  // Verify a constaté sur l'ensemble de la journée, puis ce que le planning
  // prévoyait, puis le rôle général. On ne devine jamais au-delà (Article 5).
  function posteDuJour(employeeId, preuve, shifts, employee, postesVerify) {
    if (postesVerify && postesVerify.size) {
      for (let i = 0; i < PRIORITE_POSTE.length; i++) {
        if (postesVerify.has(PRIORITE_POSTE[i])) return PRIORITE_POSTE[i];
      }
    }
    const ligne = preuve && preuve.ligne;
    if (ligne) {
      if (extraireEmployeeIds(ligne.employes_piste).includes(employeeId)) return 'pompiste';
      if (extraireEmployeeIds(ligne.employes_boutique).includes(employeeId)) return 'caissier';
      if (extraireEmployeeIds(ligne.employes_renfort).includes(employeeId)) return 'renfort';
    }
    const shiftRenfort = (shifts || []).find(sh => sh.statut === 'renfort');
    if (shiftRenfort) return 'renfort';
    const role = String((employee && employee.role) || '').toLowerCase();
    if (role === 'pompiste') return 'pompiste';
    if (role === 'caissier' || role === 'caissiere') return 'caissier';
    if (role === 'renfort') return 'renfort';
    return null;
  }

  const LIBELLE_POSTE = { pompiste: 'piste', caissier: 'boutique', renfort: 'renfort' };
  const NOM_JOUR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // Ventilation des heures retenues par poste tenu. Le total ne change pas :
  // on le rend lisible, c'est tout.
  // Ventilation d'une journée retenue : la présence est UNIQUE (déjà consolidée
  // par posteDuJour) ; elle se découpe en normales + supplémentaires sans jamais
  // les additionner à elle-même. Un horaire exceptionnel saisi par le manager n'est
  // ni normal ni supplémentaire d'office : il reste sur son propre axe.
  const suppDuJour = (source, bareme) => (source === 'duree_reference' && bareme ? bareme.heuresSupplementaires : 0);

  function enregistrerJour(fiche, date, poste, presence, source, bareme) {
    let normales = 0, supp = 0, autres = 0;
    if (source === 'duree_reference' && bareme) { normales = bareme.heuresNormales; supp = bareme.heuresSupplementaires; }
    else if (source === 'horaire_exceptionnel') autres = presence;
    else normales = presence;
    fiche.heuresNormales += normales; fiche.heuresSuppBareme += supp;
    fiche.detailJours.push({ date, poste: poste || null, presence, normales, supplementaires: supp, autres, source });
  }

  function ventiler(fiche, poste, heures) {
    if (!(heures > 0)) return;
    if (poste === 'caissier') fiche.heuresCaisse += heures;
    else if (poste === 'pompiste') fiche.heuresPiste += heures;
    else if (poste === 'renfort') fiche.heuresRenfort += heures;
  }

  const RUBRIQUE_ECART = 'ecart_verify_planning';

  // Rubrique « Écarts Verify / Planning » (§4 et §9). Trois principes, qui
  // sont la raison d'être de cette fonction :
  //
  //   - elle ne touche JAMAIS aux heures. Elle décrit un écart déjà calculé.
  //   - elle produit une information, pas une décision à prendre : le statut
  //     est « information », et la construction des bloqueurs écarte cette
  //     rubrique. Une journée confirmée par Verify ne devient pas « non
  //     validée » parce qu'elle manque au planning.
  //   - elle nomme les deux sources en regard, afin que le manager voie
  //     d'où vient chaque chiffre avant de régulariser.
  //
  // Le cas « constaté hors planning » garde volontairement son ancienne clé
  // de source et son ancien type : les décisions déjà enregistrées par le
  // manager continuent de se rattacher à leur journée.
  // Condition 1 de la decision-7 (13/10/2026) : sans planning du mois, une
  // présence Verify ne produit pas un message par jour mais une seule
  // synthèse non bloquante par salarié et par période. Le détail des jours
  // reste consultable (`jours`). Les heures ne bougent pas (la synthèse ne
  // porte aucune quantité) et les conflits explicites ne sont pas touchés.
  function regrouperPlanningNonRenseigne(fiche, employee, periode) {
    const jours = fiche.items.filter(i => i.nature === 'planning_non_renseigne');
    if (!jours.length) return;
    fiche.items = fiche.items.filter(i => i.nature !== 'planning_non_renseigne');
    const dates = jours.map(i => i.date).sort();
    const n = dates.length;
    const base = jours[0];
    fiche.items.push(Object.assign({}, base, {
      sourceCle: `planning-non-renseigne:${employee.id}:${periode}`,
      date: dates[0], nature: 'planning_non_renseigne',
      libelle: `${n} présence${n > 1 ? 's' : ''} confirmée${n > 1 ? 's' : ''}, planning non renseigné`,
      detail: `Présence confirmée par Verify, planning non renseigné · information non bloquante, aucune absence ni retenue · ${dates.join(', ')}`,
      jours: jours.map(i => ({ date: i.date, heuresRetenues: i.heuresRetenues, poste: i.poste, detail: i.detail })),
      quantiteMinutes: null, heuresAttribuees: 0, heuresRetenues: 0, heuresSupplementaires: 0,
      statut: 'information', impactPaye: false,
    }));
  }

  function itemEcart(fiche, employee, date, ctx) {
    const jourNom = NOM_JOUR[new Date(`${date}T12:00:00`).getDay()];
    const posteLu = LIBELLE_POSTE[ctx.fonctionConstatee] || ctx.fonctionConstatee || null;
    const postePrevu = LIBELLE_POSTE[ctx.fonctionPrevue] || ctx.fonctionPrevue || null;
    const ecartHeures = Math.round((Number(ctx.heuresRetenues || 0) - Number(ctx.heuresPlanning || 0)) * 100) / 100;

    const commun = {
      rubrique: RUBRIQUE_ECART, origine: ctx.origine, date,
      poste: ctx.fonctionConstatee || null,
      fonctionPrevue: ctx.fonctionPrevue || null,
      fonctionConstatee: ctx.fonctionConstatee || null,
      sourceFonctionPrevue: ctx.planningConnu ? 'planning' : null,
      sourceFonctionConstatee: ctx.origine,
      heuresPlanning: Number(ctx.heuresPlanning || 0),
      heuresRetenues: Number(ctx.heuresRetenues || 0),
      heuresAttribuees: Number(ctx.heuresRetenues || 0),
      sourceHeuresRetenues: ctx.sourceHeures,
      quantiteMinutes: ctx.heuresRetenues > 0 ? Math.round(Number(ctx.heuresRetenues) * 60) : null,
      heuresSupplementaires: Number(ctx.heuresSupplementaires || 0),
      statut: 'information', impactPaye: false,
    };

    // Deux signalements de réconciliation, informatifs : ils ne retirent ni
    // ne bloquent aucune heure, et ne plafonnent rien.
    // - caisse ET piste constatées le même jour : la piste l'emporte
    //   (priorité des postes), mais deux sources se contredisent, le
    //   manager arbitre.
    // - une journée de plus de 12 h est signalée telle quelle.
    if (ctx.postesVerify && ctx.postesVerify.has('pompiste') && ctx.postesVerify.has('caissier')) {
      fiche.items.push(Object.assign({}, commun, {
        sourceCle: `anomalie-sources:${employee.id}:${date}`,
        typeItem: 'ecart_verify_planning', nature: 'sources_contradictoires',
        libelle: 'Caisse et piste constatées le même jour',
        detail: `Verify place cette personne en caisse et en piste le ${jourNom} · calculé en piste, sans cumul · à arbitrer par le manager`,
      }));
    }
    if (Number(ctx.heuresRetenues) > 12) {
      fiche.items.push(Object.assign({}, commun, {
        sourceCle: `anomalie-duree:${employee.id}:${date}`,
        typeItem: 'ecart_verify_planning', nature: 'duree_superieure_12h',
        libelle: `Journée de ${ctx.heuresRetenues} h, au-delà de 12 h`,
        detail: `${ctx.heuresRetenues} h retenues le ${jourNom} · aucune heure n'est plafonnée · à vérifier par le manager`,
      }));
    }

    // 1. Journée constatée, absente du planning de travail.
    if (!ctx.planningConnu) {
      // Un simple pointage n'établit pas les heures (règles SMU, 08/10/2026) :
      // le jour reste « à vérifier » et le manager le confirme, le corrige ou
      // ne le retient pas. Seul Verify fait foi sans arbitrage.
      if (ctx.origine !== 'verify') {
        fiche.items.push({
          sourceCle: `presence-exceptionnelle:${employee.id}:${date}`, typeItem: 'presence_exceptionnelle', origine: ctx.origine,
          date, libelle: 'Présence constatée hors planning de travail',
          poste: ctx.fonctionConstatee || null,
          heuresAttribuees: ctx.heuresRetenues > 0 ? ctx.heuresRetenues : null,
          quantiteMinutes: ctx.heuresRetenues > 0 ? Math.round(Number(ctx.heuresRetenues) * 60) : null,
          heuresSupplementaires: Number(ctx.heuresSupplementaires || 0),
          detail: ctx.heuresRetenues > 0
            ? `${ctx.heuresRetenues} h attribuées — ${posteLu || 'poste inconnu'} le ${jourNom}`
              + (ctx.heuresSupplementaires ? ` (7 h + ${ctx.heuresSupplementaires} h supplémentaire)` : '')
            : 'Aucun barème applicable : poste du jour inconnu, heures à saisir manuellement',
          statut: 'a_verifier', impactPaye: false,
        });
        return;
      }
      // Arbitrage Q4, option C (13/10/2026) : une case vide au planning
      // signifie « non renseigné », jamais « repos ». Verify confirme la
      // présence : elle est conservée telle quelle, avec une information non
      // bloquante. Une case vide ne génère ni absence, ni retenue, ni heure
      // de renfort, et n'est pas comptée comme « hors planning ». Seul un
      // repos ou une absence EXPLICITES contredits par Verify sont une
      // anomalie à arbitrer (branche suivante).
      if (!ctx.statutsPlanifies) {
        fiche.items.push(Object.assign({}, commun, {
          sourceCle: `planning-non-renseigne:${employee.id}:${date}`,
          typeItem: 'ecart_verify_planning', nature: 'planning_non_renseigne',
          libelle: 'Présence confirmée sans planning renseigné',
          detail: `${ctx.heuresRetenues > 0 ? `${ctx.heuresRetenues} h retenues` : 'Heures à saisir'} — ${posteLu || 'poste inconnu'} le ${jourNom}, présence confirmée par Verify · information non bloquante, aucune absence ni retenue`,
        }));
        if (!(ctx.heuresRetenues > 0)) ajouterAnomalieDonnee(fiche, employee, date, commun, 'Poste du jour introuvable dans Verify');
        return;
      }
      fiche.items.push(Object.assign({}, commun, {
        sourceCle: `presence-exceptionnelle:${employee.id}:${date}`,
        typeItem: 'presence_exceptionnelle', nature: 'hors_planning',
        libelle: `Conflit planning / Verify : ${ctx.statutsPlanifies} planifié, présence constatée par Verify`,
        // Un shift non travaillé (repos, congé) que Verify contredit est un
        // conflit signalé, non bloquant (08/10/2026, règles SMU §3).
        ...(ctx.statutsPlanifies ? { signale: true, anomalie: 'conflit_planning_verify' } : {}),
        detail: (ctx.heuresRetenues > 0
          ? `${ctx.heuresRetenues} h retenues — ${posteLu || 'poste inconnu'} le ${jourNom}, durée de référence du jour`
          : `Poste du jour inconnu : aucune durée de référence applicable, heures à saisir par le manager`)
          + (posteLu && ctx.fonctionConstatee !== String(employee.role || '').toLowerCase()
            ? ` · poste constaté dans Verify, différent du rôle « ${employee.role || '—'} »` : ''),
      }));
      if (!(ctx.heuresRetenues > 0)) ajouterAnomalieDonnee(fiche, employee, date, commun, 'Poste du jour introuvable dans Verify');
      return;
    }

    // 2. Fonction prévue au planning différente de la fonction constatée.
    if (ctx.fonctionPrevue === 'renfort' && (ctx.fonctionConstatee === 'pompiste' || ctx.fonctionConstatee === 'caissier')) {
      // Conflit d'affectation (règles SMU §3, 08/10/2026) : un renfort planifié
      // le jour où Verify le place en caisse ou en piste. Verify fait foi pour
      // la fonction ; les heures du jour sont comptées UNE fois, jamais renfort
      // plus caisse. Signalé pour régularisation du planning, sans bloquer.
      // Type `autre` : la contrainte type_item ne porte pas d'autre valeur
      // pour cette anomalie, et l'élément n'entre dans aucune variable.
      fiche.items.push({
        sourceCle: `conflit-affectation:${employee.id}:${date}`, typeItem: 'autre', origine: 'verify',
        date, libelle: `Conflit d'affectation : renfort planifié, ${ctx.fonctionConstatee === 'caissier' ? 'caisse' : 'piste'} constatée par Verify`,
        detail: 'Verify retenu pour la fonction · heures du jour comptées une seule fois · régularisez le planning ou justifiez l\'écart',
        statut: 'information', impactPaye: false, signale: true, anomalie: 'conflit_affectation',
      });
    } else if (ctx.fonctionPrevue && ctx.fonctionConstatee && ctx.fonctionPrevue !== ctx.fonctionConstatee) {
      fiche.items.push(Object.assign({}, commun, {
        sourceCle: `ecart-verify-planning:fonction:${employee.id}:${date}`,
        typeItem: 'ecart_verify_planning', nature: 'fonction_divergente',
        libelle: `Fonction prévue ${postePrevu}, fonction constatée ${posteLu}`,
        detail: `Planning : ${postePrevu} · Verify : ${posteLu} le ${jourNom} · ${ctx.heuresRetenues} h retenues sur la durée de référence`,
      }));
    }

    // 3. Durée inscrite au planning différente de la durée retenue. On la
    //    signale dans les deux sens : le planning sous-estimait, ou il
    //    annonçait davantage que la journée constatée ne justifie.
    if (ctx.heuresPlanning > 0 && Math.abs(ecartHeures) > 0.01) {
      fiche.items.push(Object.assign({}, commun, {
        sourceCle: `ecart-verify-planning:duree:${employee.id}:${date}`,
        typeItem: 'ecart_verify_planning', nature: 'duree_divergente',
        libelle: `Planning ${ctx.heuresPlanning} h, heures retenues ${ctx.heuresRetenues} h`,
        detail: `Écart de ${ecartHeures > 0 ? '+' : ''}${ecartHeures} h le ${jourNom} · planning : ${ctx.heuresPlanning} h · retenu : ${ctx.heuresRetenues} h (${ctx.sourceHeures === 'horaire_exceptionnel' ? 'horaire exceptionnel saisi par le manager' : 'durée de référence du jour'})`,
        ecartHeures,
      }));
    }

    // 4. Journée confirmée dont aucune source ne permet de tirer une durée.
    if (!(ctx.heuresRetenues > 0)) ajouterAnomalieDonnee(fiche, employee, date, commun, 'Ni poste constaté ni durée au planning');
  }

  // Une anomalie de données n'est pas un écart de concordance : l'information
  // est absente, invalide ou contradictoire, et il faut la corriger à la
  // source. Elle reste informative — elle ne bloque pas le mois, mais elle ne
  // se confond pas avec un écart Verify / planning (§4).
  function ajouterAnomalieDonnee(fiche, employee, date, commun, cause) {
    fiche.items.push(Object.assign({}, commun, {
      sourceCle: `anomalie-donnee:${employee.id}:${date}`,
      typeItem: 'ecart_verify_planning', nature: 'donnee_absente',
      libelle: 'Heures incalculables pour cette journée',
      detail: `${cause} · la journée est confirmée, ses heures restent à saisir par le manager`,
      quantiteMinutes: null, heuresRetenues: 0, heuresAttribuees: null,
    }));
  }

  function jjmmaaaa(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
  }

  function cleJour(employeeId, date) { return `${employeeId}|${date}`; }

  // Fonction prévue au planning pour la journée, quand le planning en dit
  // quelque chose. Elle ne décide d'aucune heure : elle sert uniquement à
  // nommer l'écart entre la prévision et ce que Verify a constaté.
  function fonctionPrevue(shiftsTravail) {
    for (let i = 0; i < (shiftsTravail || []).length; i++) {
      const s = shiftsTravail[i];
      if (s.tache === 'piste') return 'pompiste';
      if (s.tache === 'caisse') return 'caissier';
      if (s.statut === 'renfort' || s.quart === 'renfort') return 'renfort';
    }
    return null;
  }

  function indexerArbitrages(items) {
    const resultat = new Map();
    (items || []).filter(i => i.origine !== 'manuel').forEach(i => resultat.set(i.source_cle, i));
    return resultat;
  }

  function appliquerArbitrage(item, arbitrages) {
    const a = arbitrages.get(item.sourceCle);
    if (!a) return item;
    return Object.assign({}, item, {
      id: a.id,
      statut: a.statut,
      impactPaye: !!a.impact_paye,
      quantiteMinutes: a.quantite_minutes != null ? a.quantite_minutes : item.quantiteMinutes,
      montantCentimes: a.montant_centimes != null ? a.montant_centimes : item.montantCentimes,
      note: a.note || null,
    });
  }

  function construireRapport(entree) {
    const periode = moisISO(entree.periode);
    const config = Object.assign({
      retard_max_coherent_min: 180, jours_feries: [],
      durees_reference: null, heures_renfort: 0,
      renfort_effectif_depuis: RENFORT_EFFECTIF_DEPUIS_DEFAUT,
    }, entree.config || {});
    // Les durées de référence et l'horaire standard du renfort viennent des
    // Paramètres Station. Une seule lecture, un seul jeu de règles, partagé
    // par tout le calcul : c'est la condition pour que Verify et Paye ne
    // divergent pas (cahier des charges du 09/10/2026, §2).
    const regles = reglesHeures(config, entree.horaires);
    const settings = new Map((entree.settings || []).map(s => [s.employee_id, s]));
    const arbitrages = indexerArbitrages(entree.items || []);
    const audits = (entree.audits || []).filter(a => dateDansMois(a.date, periode));
    const preuveJour = new Map();
    // Un shift de renfort se reconnaît à son statut ou à son quart dédié.
    const estShiftRenfort = s => s.statut === 'renfort' || (!!config.quart_exclu_heure_supp && s.quart === config.quart_exclu_heure_supp);

    // Un pointage inactif ne prouve rien (08/10/2026, décision de Frédéric) :
    // quand `station_config.pointage_actif` vaut false, les lignes qui
    // subsistent dans `pointages` ne confirment aucune présence. Seul Verify
    // fait alors foi pour la caisse et la piste.
    const pointageActif = entree.pointageActif !== false;
    (pointageActif ? (entree.pointages || []) : []).filter(p => dateDansMois(p.date, periode)).forEach(p => {
      if (p.type === 'arrivee') {
        preuveJour.set(cleJour(p.employee_id, p.date), { type: 'pointage', ligne: p });
      }
    });
    // Postes constatés par Verify sur la journée entière, toutes clôtures
    // confondues. Un Set, et non une somme : une renfort déclarée deux fois
    // le même jour par deux clôtures ne vaut qu'une journée de renfort, et
    // une caissière aussi déclarée en renfort ne tient qu'un poste (§6).
    const postesVerifyParJour = new Map();
    const COLONNES_POSTE = { piste: 'pompiste', boutique: 'caissier', renfort: 'renfort' };
    audits.forEach(a => {
      Object.keys(COLONNES_POSTE).forEach(activite => extraireEmployeeIds(a[`employes_${activite}`]).forEach(employeeId => {
        // Décision du 13/10/2026 (remplace celle du 10/10) : un renfort déclaré au
        // quart 2 vaut comme celui du quart 1 (cas rare : pas de renfort au
        // quart 1). Le Set par salarié et par jour ci-dessous garantit qu'un
        // renfort déclaré aux deux quarts ne vaut qu'une journée, jamais 14 h.
        // Le renfort n'est effectif qu'à partir de renfort_effectif_depuis (13/10/2026) : une date antérieure est ignorée.
        if (activite === 'renfort' && config.renfort_effectif_depuis && String(a.date).slice(0, 10) < config.renfort_effectif_depuis) return;
        const cle = cleJour(employeeId, a.date);
        if (!postesVerifyParJour.has(cle)) postesVerifyParJour.set(cle, new Set());
        postesVerifyParJour.get(cle).add(COLONNES_POSTE[activite]);
        const precedent = preuveJour.get(cle);
        const avaitPointage = !!precedent && String(precedent.type).indexOf('pointage') !== -1;
        preuveJour.set(cle, { type: avaitPointage ? 'verify+pointage' : 'verify', ligne: a });
      }));
    });

    // Horaires exceptionnels saisis par le manager (§5.4). Indexés AVANT la
    // boucle des journées, parce que les items manuels ne sont rattachés à la
    // fiche qu'après : sans cet index, la durée nette corrigée arriverait
    // trop tard pour remplacer la durée de référence du jour.
    const horairesExceptionnels = new Map();
    (entree.items || []).filter(i => i.origine === 'manuel' && i.type_item === 'horaire_exceptionnel'
        && i.periode === periode && i.statut !== 'exclu' && i.date_evenement).forEach(i => {
      const d = i.detail || {};
      const nette = dureeNetteHeures(d.debut, d.fin, d.pause_minutes != null ? d.pause_minutes : pauseMinutes(d));
      const heures = nette != null ? nette
        : (Number(i.quantite_minutes) > 0 ? Math.round((Number(i.quantite_minutes) / 60) * 100) / 100 : null);
      if (heures != null) horairesExceptionnels.set(cleJour(i.employee_id, i.date_evenement), { heures, item: i, detail: d });
    });

    const planning = (entree.planning || []).filter(p => dateDansMois(p.date, periode));
    const planningParEmployeJour = new Map();
    planning.forEach(p => {
      const cle = cleJour(p.employee_id, p.date);
      if (!planningParEmployeJour.has(cle)) planningParEmployeJour.set(cle, []);
      planningParEmployeJour.get(cle).push(p);
    });

    // Jours où le planning est renseigné pour quelqu'un. Verify fait foi ;
    // le planning ne sert qu'à rapprocher et signaler. Tant qu'aucun planning
    // n'existe pour un jour, une présence confirmée par Verify n'est pas
    // « hors planning » : il n'y a rien auquel la comparer.
    // Une personne déjà présente au planning d'autres jours du mois est
    // rapprochée : son jour manquant reste un écart réel.
    const joursPlanningRenseigne = new Set(planning.map(p => p.date));
    const employesAvecPlanning = new Set(planning.map(p => p.employee_id));

    const indispoParJour = new Map();
    // Un événement RH est une PÉRIODE, jamais une collection de journées
    // (03/09/2026, retour de Frédéric sur le congé maternité de Vanessa :
    // une seule ligne du 21/07/2026 au 03/01/2027 produisait 30 cartes en
    // septembre, 31 en octobre, et ainsi de suite — soit 167 arbitrages pour
    // une information déjà connue en une fois). On garde donc l'index par
    // jour, nécessaire pour neutraliser les alertes de présence, ET
    // l'événement lui-même avec les jours qu'il couvre dans le mois.
    const evenementsIndispo = new Map(); // employeeId -> Map(indispoId -> { indispo, jours:Set })
    (entree.indisponibilites || []).forEach(i => {
      let d = new Date(`${i.date_debut}T12:00:00`);
      // Fin effective de l'événement :
      //   - une date de reprise borne la période à la veille du retour ;
      //   - une fin indéterminée court au moins jusqu'à la fin du mois
      //     calculé, sinon l'absence disparaîtrait silencieusement dès que
      //     l'horizon provisoire est dépassé (Article 5) ;
      //   - sinon, la date de fin déclarée.
      let finISO = i.date_fin;
      if (i.date_reprise) {
        const veille = new Date(`${i.date_reprise}T12:00:00`);
        veille.setDate(veille.getDate() - 1);
        finISO = veille.toISOString().slice(0, 10);
      } else if (i.fin_indeterminee) {
        const finMois = finMoisISO(periode);
        if (finMois > finISO) finISO = finMois;
      }
      const fin = new Date(`${finISO}T12:00:00`);
      while (d <= fin) {
        const iso = d.toISOString().slice(0, 10);
        if (dateDansMois(iso, periode)) {
          indispoParJour.set(cleJour(i.employee_id, iso), i);
          if (!evenementsIndispo.has(i.employee_id)) evenementsIndispo.set(i.employee_id, new Map());
          const parEmploye = evenementsIndispo.get(i.employee_id);
          if (!parEmploye.has(i.id)) parEmploye.set(i.id, { indispo: i, jours: new Set() });
          parEmploye.get(i.id).jours.add(iso);
        }
        d.setDate(d.getDate() + 1);
      }
    });

    const employes = [];
    const itemsGlobaux = [];
    (entree.employees || []).filter(e => e.actif !== false).forEach(employee => {
      const reglage = reglageEmploye(employee, settings.get(employee.id));
      const fiche = {
        employee, reglage, heuresConfirmees: 0, joursConfirmes: new Set(),
        presencesMesurees: 0, presencesReconstituees: 0, presencesPlanifiees: 0, items: [],
        // Ventilation demandée par le cockpit manager (§9) : on veut lire
        // d'où viennent les heures retenues, pas seulement leur total.
        heuresCaisse: 0, heuresPiste: 0, heuresRenfort: 0, heuresExceptionnelles: 0,
        heuresSupplementairesParDefaut: 0, heuresNormales: 0, heuresSuppBareme: 0, detailJours: [],
      };
      if (!reglage.inclus || reglage.modePresence === 'exclu') {
        employes.push(fiche);
        return;
      }

      const absencesSansPreuve = [];
      const cles = new Set();
      planning.forEach(p => { if (p.employee_id === employee.id) cles.add(cleJour(employee.id, p.date)); });
      preuveJour.forEach((_, cle) => { if (cle.startsWith(`${employee.id}|`)) cles.add(cle); });
      indispoParJour.forEach((_, cle) => { if (cle.startsWith(`${employee.id}|`)) cles.add(cle); });

      [...cles].sort().forEach(cle => {
        const date = cle.split('|')[1];
        const shifts = planningParEmployeJour.get(cle) || [];
        const shiftsTravail = shifts.filter(s => STATUTS_TRAVAIL.includes(s.statut));
        const preuve = preuveJour.get(cle);
        const indispo = indispoParJour.get(cle);

        if (shiftsTravail.length && preuve) {
          fiche.joursConfirmes.add(date);
          // Renversement du 09/10/2026. C'est la journée constatée par Verify
          // qui ouvre le droit, et la durée de référence du jour qui la
          // chiffre. La durée inscrite au planning ne plafonne plus rien :
          // elle devient un terme de comparaison, et l'écart est nommé.
          const heuresPlanning = shiftsTravail.reduce((s, p) => s + Number(p.duree_heures || 0), 0);
          const poste = posteDuJour(employee.id, preuve, shifts, employee, postesVerifyParJour.get(cle));
          const bareme = heuresParDefautJour(poste, date, regles);
          const exceptionnel = horairesExceptionnels.get(cle);
          let heuresJour = 0;
          let sourceHeures = null;
          if (exceptionnel) {
            heuresJour = exceptionnel.heures;
            sourceHeures = 'horaire_exceptionnel';
            fiche.heuresExceptionnelles += exceptionnel.heures;
          } else if (bareme) {
            heuresJour = bareme.heures;
            sourceHeures = 'duree_reference';
            fiche.heuresParDefaut = (fiche.heuresParDefaut || 0) + bareme.heures;
          } else if (heuresPlanning > 0) {
            // Verify confirme la journée mais ne dit pas quel poste était
            // tenu : plutôt que de rendre zéro, on retient ce que le planning
            // prévoyait, et l'on dit d'où vient le chiffre.
            heuresJour = heuresPlanning;
            sourceHeures = 'planning';
          }
          fiche.heuresConfirmees += heuresJour;
          ventiler(fiche, poste, heuresJour);
          enregistrerJour(fiche, date, poste, heuresJour, sourceHeures, bareme);
          if (preuve.type === 'verify+pointage') fiche.presencesMesurees += 1;
          else fiche.presencesReconstituees += 1;
          itemEcart(fiche, employee, date, {
            fonctionPrevue: fonctionPrevue(shiftsTravail), fonctionConstatee: poste,
            heuresPlanning, heuresRetenues: heuresJour, sourceHeures, heuresSupplementaires: suppDuJour(sourceHeures, bareme),
            origine: preuve.type.indexOf('verify') !== -1 ? 'verify' : 'pointage',
            planningConnu: true, exceptionnel: exceptionnel || null, postesVerify: postesVerifyParJour.get(cle),
          });
        } else if (shiftsTravail.length && !preuve && !indispo) {
          // Renfort (08/10/2026, règles SMU §2) : le planning officiel fait
          // foi pour les heures prévues, sans Verify ni pointage. Un renfort
          // planifié est donc compté, jamais signalé comme absent.
          //
          // Cette règle ne vaut plus qu'AVANT `renfort_effectif_depuis`
          // (01/10/2026) : l'historique de septembre se recalcule comme il a
          // été payé. Depuis cette date, le renfort naît de la colonne
          // RENFORT de Verify (Q1), et un renfort planifié sans Verify est une
          // présence à vérifier comme une caisse ou une piste (13/10/2026,
          // « Verify fait foi, le planning détecte les écarts »).
          const avantRenfortVerify = !!config.renfort_effectif_depuis && date < config.renfort_effectif_depuis;
          const renforts = avantRenfortVerify ? shiftsTravail.filter(estShiftRenfort) : [];
          const autres = shiftsTravail.filter(s => renforts.indexOf(s) === -1);
          if (renforts.length) {
            fiche.joursConfirmes.add(date);
            fiche.presencesPlanifiees += 1;
            let heuresRenfort = renforts.reduce((s, p) => s + Number(p.duree_heures || 0), 0);
            // Barème renfort seulement si la journée n'est QUE du renfort :
            // un barème journalier ne se découpe pas entre deux fonctions.
            if (!(heuresRenfort > 0) && !autres.length) {
              const bareme = heuresParDefautJour('renfort', date, regles);
              heuresRenfort = bareme.heures;
              fiche.heuresParDefaut = (fiche.heuresParDefaut || 0) + bareme.heures;
            }
            fiche.heuresConfirmees += heuresRenfort;
          }
          if (!autres.length) return;
          // `!indispo` : une absence déjà expliquée par un événement RH
          // déclaré n'est pas une anomalie. NEXUS neutralise l'alerte plutôt
          // que de demander au manager d'arbitrer une journée dont la cause
          // est connue et couverte par la période.
          //
          // Collecté ici, groupé après la boucle : une absence non déclarée
          // qui dure est un seul fait — « untel n'est pas venu du X au Y » —
          // pas une anomalie par jour (03/09/2026, généralisation demandée
          // par Frédéric : le mécanisme de Vanessa doit valoir pour tout le
          // monde, y compris quand rien n'a été déclaré à l'avance).
          absencesSansPreuve.push(date);
        } else if (!shiftsTravail.length && preuve) {
          fiche.joursConfirmes.add(date);
          fiche.presencesReconstituees += 1;
          // Journée confirmée par Verify, absente du planning. Elle est
          // CONSTATÉE : ses heures entrent dans le décompte, et l'écart avec
          // le planning est signalé au manager sans rien bloquer (§4). Le
          // poste réellement tenu, lu dans Verify, décide de la durée ; le
          // rôle général de la fiche n'est qu'un repli.
          const poste = posteDuJour(employee.id, preuve, shifts, employee, postesVerifyParJour.get(cle));
          const bareme = heuresParDefautJour(poste, date, regles);
          const exceptionnel = horairesExceptionnels.get(cle);
          let heuresJour = 0;
          let sourceHeures = null;
          if (exceptionnel) {
            heuresJour = exceptionnel.heures;
            sourceHeures = 'horaire_exceptionnel';
            fiche.heuresExceptionnelles += exceptionnel.heures;
          } else if (bareme) {
            heuresJour = bareme.heures;
            sourceHeures = 'duree_reference';
            fiche.heuresParDefaut = (fiche.heuresParDefaut || 0) + bareme.heures;
          }
          fiche.heuresConfirmees += heuresJour;
          ventiler(fiche, poste, heuresJour);
          enregistrerJour(fiche, date, poste, heuresJour, sourceHeures, bareme);
          itemEcart(fiche, employee, date, {
            fonctionPrevue: null, fonctionConstatee: poste,
            heuresPlanning: 0, heuresRetenues: heuresJour, sourceHeures, heuresSupplementaires: suppDuJour(sourceHeures, bareme),
            origine: preuve.type.indexOf('verify') !== -1 ? 'verify' : 'pointage',
            planningConnu: false, planningRenseigne: joursPlanningRenseigne.has(date) || employesAvecPlanning.has(employee.id),
            exceptionnel: exceptionnel || null, postesVerify: postesVerifyParJour.get(cle),
            statutsPlanifies: [...new Set(shifts.map(s => s.statut).filter(Boolean))].join(', '),
          });
        }

        // Plus aucun retard n'est déduit d'un pointage, ni d'un écart entre
        // Verify et le planning : par défaut le retard est de 0 minute, et
        // seul le manager peut en enregistrer un (§7). Les retards déjà
        // enregistrés restent visibles — ils arrivent par la voie des items
        // manuels, comme toute décision du manager.

        // Un férié travaillé reste un élément de paie à arbitrer, et il l'est
        // désormais même sans planning : c'est Verify qui atteste la journée.
        if (preuve && (config.jours_feries || []).includes(date)) {
          fiche.items.push({
            sourceCle: `jour-ferie:${employee.id}:${date}`, typeItem: 'jour_ferie', origine: preuve.type.indexOf('verify') !== -1 ? 'verify' : 'pointage',
            date, libelle: 'Jour férié travaillé', statut: 'a_verifier', impactPaye: false,
          });
        }
      });

      (entree.ecarts || []).filter(e => e.employeeId === employee.id && dateDansMois(e.date, periode) && Number.isFinite(Number(e.montantRetenu)) && Number(e.montantRetenu) !== 0).forEach(e => {
        const montantRetenu = Number(e.montantRetenu);
        const negatif = montantRetenu < 0;
        const contestationOuverte = e.contestation && ['ouverte', 'en_reexamen'].includes(e.contestation.statut_contestation);
        fiche.items.push({
          sourceCle: `ecart:${e.id}`, typeItem: 'ecart_caisse', origine: e.sourceModule,
          date: e.date, quart: e.quart || null, activite: e.activite || null,
          libelle: `Écart ${e.activite} ${montantRetenu > 0 ? 'positif' : 'négatif'} — ${montantRetenu > 0 ? '+' : ''}${montantRetenu.toFixed(2)} €`,
          ecartInitialCentimes: e.ecartInitial == null ? null : Math.round(Number(e.ecartInitial) * 100),
          ecartFinalCentimes: e.ecartFinal == null ? Math.round(montantRetenu * 100) : Math.round(Number(e.ecartFinal) * 100),
          ecartSigneCentimes: Math.round(montantRetenu * 100),
          montantReferenceCentimes: Math.round(Math.abs(montantRetenu) * 100), montantCentimes: null,
          statutEcart: e.statut || null, causeCode: e.causeCode || null, deepLink: e.deepLink || null,
          statut: negatif ? 'a_verifier' : 'information', impactPaye: false, contestationOuverte: !!contestationOuverte,
          bloquantTechnique: !!contestationOuverte,
        });
      });

      const rattaches = new Set(fiche.items.map(i => i.sourceCle));
      fiche.items = fiche.items.map(i => appliquerArbitrage(i, arbitrages));

      // Une décision rendue par le manager ne s'évapore pas parce que le
      // moteur ne propose plus la carte qui l'a fait naître. Les règles de
      // calcul ont changé le 09/10/2026 : la 8e heure n'est plus proposée en
      // heure supplémentaire, le retard ne se déduit plus d'un pointage. Les
      // arbitrages déjà enregistrés sur ces cartes restent dus, et visibles.
      // Les laisser tomber retirerait au salarié des heures ou des minutes
      // qu'un humain avait validées, sans que personne ne l'ait demandé.
      (entree.items || []).filter(a => a.origine !== 'manuel'
          && a.employee_id === employee.id && moisISO(a.periode) === periode
          && !rattaches.has(a.source_cle)).forEach(a => {
        const dateLue = a.date_evenement || (/(\d{4}-\d{2}-\d{2})/.exec(a.source_cle || '') || [])[1] || null;
        const dejaIncluse = a.type_item === 'heure_supplementaire' && a.statut === 'valide'
          && Number(a.quantite_minutes) > 0 && dateLue != null && fiche.joursConfirmes.has(dateLue);
        fiche.items.push({
          id: a.id, sourceCle: a.source_cle, typeItem: a.type_item, origine: a.origine,
          date: dateLue, libelle: a.libelle || 'Décision antérieure du manager',
          quantiteMinutes: a.quantite_minutes != null ? a.quantite_minutes : null,
          montantCentimes: a.montant_centimes != null ? a.montant_centimes : null,
          statut: a.statut, impactPaye: !!a.impact_paye, note: a.note || null,
          decisionAnterieure: true,
          dejaIncluseDansHeures: dejaIncluse,
          detail: 'Décision enregistrée sous une règle de calcul antérieure. '
            + 'Elle reste retenue telle qu’elle a été validée, et n’est plus recalculée.'
            + (dejaIncluse ? ' Ces minutes sont déjà comprises dans la durée de référence du jour : '
              + 'les additionner paierait deux fois la même heure.' : ''),
        });
        // Le 09/10/2026, la 8e heure du jeudi, du vendredi et du samedi est
        // devenue une heure de travail de référence, retenue dans les heures
        // confirmées. Une heure supplémentaire validée sous l'ancienne règle
        // sur l'un de ces jours décrit donc la MÊME heure. Elle reste
        // affichée, parce qu'un humain l'a validée, mais elle est signalée
        // comme déjà comprise : c'est le mécanisme qui existait déjà pour le
        // barème, et il sert exactement à ne pas payer deux fois.
        if (dejaIncluse) {
          fiche.heuresSupplementairesParDefaut += Math.round((Number(a.quantite_minutes) / 60) * 100) / 100;
        }
      });
      // Séries d'absences non déclarées. Une journée avec preuve de présence
      // rompt la série : « absent du X au Y sans aucune présence constatée
      // entre les deux » est un fait vérifiable, contrairement à une fusion
      // qui enjamberait un jour où l'employé était là (Article 5).
      const seriesAbsence = [];
      absencesSansPreuve.sort().forEach(date => {
        const serie = seriesAbsence[seriesAbsence.length - 1];
        if (serie) {
          let rompue = false;
          const curseur = new Date(`${serie.fin}T12:00:00`);
          const cible = new Date(`${date}T12:00:00`);
          curseur.setDate(curseur.getDate() + 1);
          while (curseur < cible) {
            if (preuveJour.has(cleJour(employee.id, curseur.toISOString().slice(0, 10)))) { rompue = true; break; }
            curseur.setDate(curseur.getDate() + 1);
          }
          if (!rompue) { serie.fin = date; serie.jours.push(date); return; }
        }
        seriesAbsence.push({ debut: date, fin: date, jours: [date] });
      });
      seriesAbsence.forEach(serie => {
        const multi = serie.jours.length > 1;
        fiche.items.push({
          sourceCle: `absence:${employee.id}:${serie.debut}${multi ? `:${serie.fin}` : ''}`,
          typeItem: 'absence_a_verifier', origine: 'planning',
          date: serie.debut, dateFin: multi ? serie.fin : null,
          joursMois: serie.jours.length, joursPlanifiesMois: serie.jours.length,
          serieAbsence: true, jours: serie.jours,
          // « Présence à vérifier », jamais « absence » (08/10/2026, règles
          // SMU) : un jour de caisse ou de piste sans Verify est une question
          // posée au manager, pas une absence que NEXUS déclarerait seul.
          libelle: multi
            ? `Présence à vérifier du ${jjmmaaaa(serie.debut)} au ${jjmmaaaa(serie.fin)}`
            : 'Présence à vérifier : caisse ou piste prévue sans Verify',
          detail: multi
            ? `${serie.jours.length} jours de caisse ou de piste planifiés sans audit Verify · si c'est une absence, déclarez un événement RH pour ne plus la revoir chaque mois`
            : null,
          statut: 'a_verifier', impactPaye: false,
        });
      });

      // Un événement RH = une décision, qu'il couvre 1, 30 ou 167 jours.
      // Émis APRÈS la boucle des jours, une seule fois par événement.
      (evenementsIndispo.get(employee.id) || new Map()).forEach(({ indispo, jours }) => {
        const joursTries = [...jours].sort();
        const joursPlanifies = joursTries.filter(d => {
          const shifts = planningParEmployeJour.get(cleJour(employee.id, d)) || [];
          return shifts.some(sh => STATUTS_TRAVAIL.includes(sh.statut));
        }).length;
        const joursAvecPreuve = joursTries.filter(d => preuveJour.has(cleJour(employee.id, d)));
        // Qualifier n'est pas déclarer. Un `type` posé depuis le Planning
        // (« conge ») dit ce qui a été saisi ; il ne dit pas qu'un manager a
        // arbitré cette période pour la paie. La qualification exige donc un
        // motif ET une confirmation explicite — c'est elle, et elle seule,
        // qui fait passer l'événement du statut « décision à prendre » à
        // « information à reporter », y compris les mois suivants.
        const motif = indispo.motif || null;
        const qualifie = !!(motif && MOTIFS_INDISPO[motif] && indispo.confirme_le);
        const libelleMotif = motif && MOTIFS_INDISPO[motif] ? MOTIFS_INDISPO[motif]
          : (indispo.type === 'conge' ? 'Congé déclaré' : 'Indisponibilité déclarée');
        // Une présence constatée PENDANT une absence déclarée est la seule
        // vraie contradiction : celle-là doit être signalée (Article 5).
        // Elle suit la règle des conflits planning / Verify (08/10/2026,
        // décision de Frédéric) : Verify fait foi, le jour est déjà compté
        // par la boucle des jours, et la contradiction est SIGNALÉE sans
        // bloquer. Elle ne rouvre donc plus la décision sur l'événement :
        // son statut ne dépend que de sa qualification.
        //
        // Un élément signalé par jour, et non un drapeau sur l'événement : la
        // clé `indispo:<id>` vaut pour toute la période, si bien que marquer
        // l'événement « vérifié » éteindrait aussi les contradictions des
        // mois suivants, que personne n'aurait vues.
        const contradiction = joursAvecPreuve.length > 0;
        joursAvecPreuve.forEach(d => {
          fiche.items.push({
            sourceCle: `conflit-rh:${indispo.id}:${d}`, typeItem: 'autre', origine: 'verify',
            date: d, evenementId: indispo.id,
            libelle: `Conflit RH / Verify : ${libelleMotif.toLowerCase()}, présence constatée`,
            detail: 'Verify retenu · jour compté comme travaillé · corrigez l\'événement RH ou justifiez l\'écart',
            statut: 'information', impactPaye: false, signale: true, anomalie: 'conflit_rh_verify',
          });
        });
        fiche.items.push({
          // La clé ne porte plus la date : un arbitrage posé une fois vaut
          // pour toute la période, et le mois suivant retrouve le même
          // événement au lieu d'en découvrir trente nouveaux.
          sourceCle: `indispo:${indispo.id}`,
          // `conge_paye` conservé pour ne pas rompre les consommateurs
          // existants (export, simulations) : seule la granularité change.
          typeItem: qualifie ? 'absence_qualifiee'
            : (indispo.type === 'conge' ? 'conge_paye' : 'absence_a_qualifier'),
          origine: 'indisponibilite',
          date: joursTries[0] || null,
          dateFin: joursTries[joursTries.length - 1] || null,
          evenementId: indispo.id,
          evenementDebut: indispo.date_debut,
          evenementFin: indispo.date_fin,
          motif: motif || null,
          // Le motif seul, sans les dates : l'écran affiche l'événement en
          // trois lignes (nom, motif, période couverte) plutôt qu'en une
          // phrase, et n'a pas à découper le libellé pour y arriver.
          motifLibelle: libelleMotif,
          evenementRH: true,
          joursMois: joursTries.length,
          joursPlanifiesMois: joursPlanifies,
          joursAvecPreuve,
          finIndeterminee: !!indispo.fin_indeterminee,
          dateReprise: indispo.date_reprise || null,
          libelle: `${libelleMotif} du ${jjmmaaaa(indispo.date_debut)} `
            + (indispo.date_reprise ? `au ${jjmmaaaa(indispo.date_reprise)} (reprise)`
              : (indispo.fin_indeterminee ? '— retour non daté' : `au ${jjmmaaaa(indispo.date_fin)}`)),
          detail: `${joursTries.length} jour${joursTries.length > 1 ? 's' : ''} sur la période de paie`
            + (joursPlanifies ? ` · ${joursPlanifies} normalement travaillé${joursPlanifies > 1 ? 's' : ''}` : '')
            + (contradiction ? ` · ${joursAvecPreuve.length} jour(s) avec présence constatée` : ''),
          contradiction,
          // Qualifié : information, plus jamais une décision à reprendre. Une
          // contradiction est portée par ses propres éléments signalés.
          statut: qualifie ? 'information' : 'a_verifier',
          impactPaye: false,
        });
      });

      const manuels = (entree.items || []).filter(i => i.origine === 'manuel' && i.employee_id === employee.id && i.periode === periode).map(i => {
        const d = i.detail || null;
        const item = {
          id: i.id, sourceCle: i.source_cle, typeItem: i.type_item, origine: 'manuel', date: i.date_evenement,
          libelle: i.libelle, quantiteMinutes: i.quantite_minutes, montantCentimes: i.montant_centimes,
          statut: i.statut, impactPaye: !!i.impact_paye, note: i.note || null,
          detailSaisie: d,
          // Auteur et date de la saisie (08/10/2026, règles SMU §4).
          auteurId: i.cree_par || null, creeLe: i.cree_le || null,
        };
        // Horaire exceptionnel (§5.4) : le moteur RECALCULE la durée nette à
        // partir du début, de la fin et de la pause saisis, plutôt que de
        // faire confiance à une quantité enregistrée. La valeur initiale
        // reste lisible à côté de la valeur corrigée : l'historique du
        // changement fait partie de l'information, pas de ses coulisses.
        if (i.type_item === 'horaire_exceptionnel' && d) {
          const nette = dureeNetteHeures(d.debut, d.fin, d.pause_minutes != null ? d.pause_minutes : pauseMinutes(d));
          item.heuresRecalculees = nette;
          item.heuresInitiales = d.heures_initiales != null ? Number(d.heures_initiales) : null;
          item.motif = d.motif || null;
          item.justification = d.justification || null;
          item.provenance = d.provenance || 'manuelle';
          item.historique = Array.isArray(d.historique) ? d.historique : [];
          item.auteur = d.auteur || null;
          item.detail = `${d.debut || 'début absent'} → ${d.fin || 'fin absente'}, pause ${d.pause_minutes != null ? d.pause_minutes : pauseMinutes(d)} min`
            + (nette != null ? ` · ${nette} h nettes retenues` : ' · durée illisible, rien n\'a été retenu')
            + (item.heuresInitiales != null ? ` · valeur initiale ${item.heuresInitiales} h` : '')
            + (d.motif ? ` · motif : ${d.motif}` : '')
            + (d.justification ? ` · justification : ${d.justification}` : '')
            + (item.historique.length ? ` · ${item.historique.length} saisie(s) précédente(s) conservée(s)` : '');
        }
        return item;
      });
      fiche.items.push(...manuels);
      regrouperPlanningNonRenseigne(fiche, employee, periode);
      fiche.items.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.typeItem.localeCompare(b.typeItem));
      itemsGlobaux.push(...fiche.items.map(i => Object.assign({ employeeId: employee.id, employeeNom: employee.nom }, i)));
      employes.push(fiche);
    });

    const ecartsNonAttribues = (entree.ecarts || []).filter(e => !e.employeeId && dateDansMois(e.date, periode) && Number.isFinite(Number(e.montantRetenu)) && Number(e.montantRetenu) !== 0).map(e => {
      const montantRetenu = Number(e.montantRetenu);
      return {
        sourceCle: `ecart:${e.id}`, typeItem: 'ecart_caisse', origine: e.sourceModule,
        employeeId: null, employeeNom: 'Employé à identifier', date: e.date, quart: e.quart || null,
        activite: e.activite || null, libelle: `Écart ${e.activite} non attribué — ${montantRetenu > 0 ? '+' : ''}${montantRetenu.toFixed(2)} €`,
        ecartInitialCentimes: e.ecartInitial == null ? null : Math.round(Number(e.ecartInitial) * 100),
        ecartFinalCentimes: e.ecartFinal == null ? Math.round(montantRetenu * 100) : Math.round(Number(e.ecartFinal) * 100),
        ecartSigneCentimes: Math.round(montantRetenu * 100), montantReferenceCentimes: Math.round(Math.abs(montantRetenu) * 100),
        montantCentimes: null, statutEcart: e.statut || null, causeCode: e.causeCode || null, deepLink: e.deepLink || null,
        statut: montantRetenu < 0 ? 'a_verifier' : 'information', impactPaye: false, attributionRequise: true,
      };
    });
    itemsGlobaux.push(...ecartsNonAttribues);

    // Deux natures de blocage, jamais mélangées à l'écran : un paramétrage
    // permanent à compléter n'est pas un arbitrage du mois (03/09/2026,
    // retour de Frédéric). `categorie` permet à l'écran de les séparer sans
    // avoir à deviner à partir de l'absence de sourceCle.
    const bloqueurs = [];
    employes.forEach(f => {
      if (!f.reglage.confirme) bloqueurs.push({ categorie: 'configuration', type: 'configuration_employe', employeeId: f.employee.id, libelle: `${f.employee.nom} : rattachement paie à confirmer` });
      if (f.reglage.inclus && f.reglage.modePresence === 'manuel' && !f.items.some(i => i.origine === 'manuel' && i.statut === 'valide' && i.quantiteMinutes > 0)) {
        bloqueurs.push({ categorie: 'configuration', type: 'heures_manuelles', employeeId: f.employee.id, libelle: `${f.employee.nom} : heures mensuelles à confirmer manuellement` });
      }
      // La rubrique « Écarts Verify / Planning » est consultable, filtrable
      // et documentée, mais elle ne bloque pas la préparation de la paie
      // (§4). Et cela vaut même si une décision ancienne, enregistrée du
      // temps où ces journées étaient « à valider », porte encore ce statut.
      f.items.filter(i => i.rubrique !== RUBRIQUE_ECART && !i.decisionAnterieure
          && (i.statut === 'a_verifier' || i.contestationOuverte))
        .forEach(i => bloqueurs.push({ categorie: 'element', type: i.typeItem, employeeId: f.employee.id, sourceCle: i.sourceCle, libelle: `${f.employee.nom} : ${i.libelle}` }));
    });
    ecartsNonAttribues.filter(i => i.statut === 'a_verifier').forEach(i => bloqueurs.push({ categorie: 'element', type: 'ecart_non_attribue', employeeId: null, sourceCle: i.sourceCle, libelle: `${i.libelle} : attribution à corriger dans Verify` }));

    // Statut par salarié, puis statut du mois (03/09/2026). Le mois n'est
    // « prêt » que si chaque salarié l'est : le manager voit d'où vient le
    // blocage sans avoir à ouvrir les fiches une par une.
    employes.forEach(f => { f.statut = statutSalarie(f); });
    const statutsInclus = employes.filter(f => f.reglage.inclus).map(f => f.statut);

    const ecartsVerifyPlanning = itemsGlobaux.filter(i => i.rubrique === RUBRIQUE_ECART);

    return {
      periode,
      employes,
      items: itemsGlobaux,
      bloqueurs,
      // Les règles d'heures effectivement appliquées, pour que l'écran
      // affiche le rappel de l'horaire standard sans le redéclarer.
      regles,
      ecartsVerifyPlanning,
      synthese: {
        salariesInclus: employes.filter(f => f.reglage.inclus).length,
        statutMois: statutGlobal(statutsInclus),
        salariesPrets: statutsInclus.filter(s => s === 'pret').length,
        salariesAVerifier: statutsInclus.filter(s => s === 'a_verifier').length,
        salariesDonneeManquante: statutsInclus.filter(s => s === 'donnee_manquante').length,
        heuresConfirmees: Math.round(employes.reduce((s, f) => s + f.heuresConfirmees, 0) * 100) / 100,
        variablesValidees: itemsGlobaux.filter(i => i.statut === 'valide').length,
        informations: itemsGlobaux.filter(i => i.statut === 'information').length,
        // Conflits que Verify a tranchés seul : comptés, non bloquants, mais
        // présentés au manager tant qu'il ne les a pas marqués vérifiés.
        signalements: itemsGlobaux.filter(i => i.signale && i.statut === 'information').length,
        // On compte des DÉCISIONS, pas des lignes techniques : le manager
        // doit voir le nombre de choses qu'il a réellement à trancher.
        aVerifier: bloqueurs.filter(b => b.categorie === 'element').length,
        configurationRequise: bloqueurs.filter(b => b.categorie === 'configuration').length,
        // Les écarts se comptent, mais ils ne comptent pas comme des
        // décisions à prendre : ils ne gonflent pas `aVerifier`.
        ecartsVerifyPlanning: ecartsVerifyPlanning.length,
        anomaliesDonnees: ecartsVerifyPlanning.filter(i => i.nature === 'donnee_absente').length,
        heuresCaisse: Math.round(employes.reduce((s, f) => s + Number(f.heuresCaisse || 0), 0) * 100) / 100,
        heuresPiste: Math.round(employes.reduce((s, f) => s + Number(f.heuresPiste || 0), 0) * 100) / 100,
        heuresRenfort: Math.round(employes.reduce((s, f) => s + Number(f.heuresRenfort || 0), 0) * 100) / 100,
      },
      ecartsNonAttribues,
    };
  }

  function lignesExport(rapport) {
    const lignes = [];
    rapport.employes.filter(f => f.reglage.inclus).forEach(f => {
      const valides = f.items.filter(i => i.statut === 'valide' || i.statut === 'information');
      lignes.push({
        employe: f.employee.nom, type: 'presence_confirmee', date: '',
        quantite_minutes: Math.round(f.heuresConfirmees * 60), montant_euros: '',
        impact_paye: 'information', commentaire: `${f.joursConfirmes.size} jour(s) confirmé(s)`,
      });
      // Q1 (10/10/2026) : normales et supplémentaires en lignes nominatives distinctes. La supplémentaire est une
      // PART de la présence : ces deux lignes se somment en `presence_confirmee`, elles ne s'y ajoutent pas.
      const norm = Math.round(Number(f.heuresNormales || 0) * 60), supp = Math.round(Number(f.heuresSuppBareme || 0) * 60);
      lignes.push({
        employe: f.employee.nom, type: 'heures_normales', date: '', quantite_minutes: norm, montant_euros: '',
        impact_paye: 'information', commentaire: 'part de la présence confirmée, hors 8e heure',
      });
      lignes.push({
        employe: f.employee.nom, type: 'heures_supplementaires_bareme', date: '', quantite_minutes: supp, montant_euros: '',
        impact_paye: 'information', commentaire: '8e heure du jeudi au samedi, comprise dans la présence ; aucune majoration appliquée',
      });
      (f.detailJours || []).slice().sort((x, y) => String(x.date).localeCompare(String(y.date))).forEach(j => lignes.push({
        employe: f.employee.nom, type: 'detail_jour', date: j.date, source: j.source || '',
        quantite_minutes: Math.round(j.presence * 60), montant_euros: '', impact_paye: 'information',
        commentaire: `${j.poste || 'sans poste'} · ${j.normales} h normales · ${j.supplementaires} h sup.${j.autres ? ` · ${j.autres} h exceptionnelles` : ''}`,
      }));
      valides.forEach(i => lignes.push({
        employe: f.employee.nom, type: i.typeItem, date: i.date || '', source: i.origine || '',
        ecart_initial: i.ecartInitialCentimes == null ? '' : (i.ecartInitialCentimes / 100).toFixed(2),
        ecart_final: i.ecartFinalCentimes == null ? '' : (i.ecartFinalCentimes / 100).toFixed(2), statut: i.statut,
        quantite_minutes: i.quantiteMinutes == null ? '' : i.quantiteMinutes,
        montant_euros: i.montantCentimes == null ? '' : (i.montantCentimes / 100).toFixed(2),
        impact_paye: i.impactPaye ? 'oui' : 'information', commentaire: i.note || i.libelle,
        auteur: i.auteurId || '', saisi_le: i.creeLe || '',
      }));
    });
    return lignes;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Variables comptables agrégées (03/09/2026, « dernier kilomètre »
  // demandé par Frédéric). La comptabilité ne lit pas des événements
  // journaliers : elle lit, salarié par salarié, un petit nombre de
  // variables. Ce bloc en est la SEULE source — la carte salarié à
  // l'écran et le dossier comptable PDF consomment le même calcul, jamais
  // deux agrégations parallèles qui finiraient par diverger (Article 11).
  //
  // Ne sont agrégés que les éléments arbitrés : `valide` (le manager a
  // tranché) et `information` (fait établi, sans impact paie). Ce qui
  // reste `a_verifier` est compté À PART, jamais fondu dans le total :
  // NEXUS ne transmet pas une variable que personne n'a regardée.
  const MOTIFS_MALADIE = ['arret_maladie', 'conge_maternite', 'conge_paternite'];
  const STATUTS_RETENUS = ['valide', 'information'];

  function enHeures(minutes) { return Math.round((Number(minutes || 0) / 60) * 100) / 100; }
  function sommeMinutes(liste) { return liste.reduce((s, i) => s + Number(i.quantiteMinutes || 0), 0); }
  function sommeCentimes(liste) { return liste.reduce((s, i) => s + Number(i.montantCentimes || 0), 0); }

  function variablesComptables(fiche) {
    const items = fiche.items || [];
    const retenus = items.filter(i => STATUTS_RETENUS.includes(i.statut));
    const attente = items.filter(i => i.statut === 'a_verifier' || i.contestationOuverte);
    const enAttente = type => attente.filter(i => i.typeItem === type).length;

    // Un événement RH compte ses JOURS COUVERTS DANS LE MOIS, pas son
    // nombre de lignes : c'est ce que la comptabilité reporte.
    const groupeEvenements = filtre => {
      const evts = retenus.filter(i => i.evenementRH && filtre(i));
      return {
        jours: evts.reduce((s, i) => s + Number(i.joursMois || 0), 0),
        evenements: evts.length,
        detail: evts.map(i => ({
          motif: i.motif || null, libelle: i.motifLibelle || i.libelle,
          debut: i.date, fin: i.dateFin, jours: Number(i.joursMois || 0),
          evenementDebut: i.evenementDebut || null, evenementFin: i.evenementFin || null,
          finIndeterminee: !!i.finIndeterminee, dateReprise: i.dateReprise || null,
        })),
      };
    };

    const retards = retenus.filter(i => i.typeItem === 'retard');
    const supp = retenus.filter(i => i.typeItem === 'heure_supplementaire');
    const feries = retenus.filter(i => i.typeItem === 'jour_ferie');
    const absencesNonDeclarees = retenus.filter(i => i.typeItem === 'absence_a_verifier');
    const acomptes = retenus.filter(i => i.typeItem === 'acompte');
    const dettes = retenus.filter(i => i.typeItem === 'dette');
    const ecartsRetenus = retenus.filter(i => i.typeItem === 'ecart_caisse' && i.impactPaye && i.montantCentimes != null);
    const ecartsInformatifs = retenus.filter(i => i.typeItem === 'ecart_caisse' && !i.impactPaye);

    return {
      presence: {
        jours: fiche.joursConfirmes ? fiche.joursConfirmes.size : 0,
        heures: Math.round(Number(fiche.heuresConfirmees || 0) * 100) / 100,
        joursMesures: fiche.presencesMesurees || 0,
        joursReconstitues: fiche.presencesReconstituees || 0,
        joursPlanifies: fiche.presencesPlanifiees || 0,
        heuresParDefaut: Math.round(Number(fiche.heuresParDefaut || 0) * 100) / 100,
        heuresNormales: Math.round(Number(fiche.heuresNormales || 0) * 100) / 100,
        heuresSupplementairesBareme: Math.round(Number(fiche.heuresSuppBareme || 0) * 100) / 100,
        heuresAutres: Math.round(Number(fiche.heuresExceptionnelles || 0) * 100) / 100,
        detailJours: (fiche.detailJours || []).slice().sort((a, b) => a.date < b.date ? -1 : 1),
      },
      absence: {
        jours: absencesNonDeclarees.reduce((s, i) => s + Number(i.joursMois || 1), 0),
        occurrences: absencesNonDeclarees.length,
        enAttente: enAttente('absence_a_verifier'),
      },
      congesPayes: groupeEvenements(i => i.motif === 'conge'),
      maladieMaternite: groupeEvenements(i => MOTIFS_MALADIE.includes(i.motif)),
      autresAbsences: groupeEvenements(i => i.motif && i.motif !== 'conge' && !MOTIFS_MALADIE.includes(i.motif)),
      retards: { minutes: sommeMinutes(retards), occurrences: retards.length, enAttente: enAttente('retard') + enAttente('retard_incoherent') },
      heuresSupplementaires: {
        // Total = 8e heure du barème (Q1) + heures validées par le manager qui ne sont
        // PAS déjà dans la présence. Une décision antérieure « déjà incluse » décrit la
        // même heure que le barème : elle reste visible mais n'est jamais ajoutée.
        heures: Math.round((Number(fiche.heuresSuppBareme || 0) + enHeures(sommeMinutes(supp.filter(i => !i.dejaIncluseDansHeures)))) * 100) / 100,
        heuresBareme: Math.round(Number(fiche.heuresSuppBareme || 0) * 100) / 100,
        minutes: sommeMinutes(supp), occurrences: supp.length,
        // Les heures supplémentaires du barème par défaut sont DÉJÀ dans
        // les heures confirmées : les afficher à part évite de les compter
        // deux fois tout en gardant l'information visible.
        heuresDejaIncluses: Math.round(Number(fiche.heuresSupplementairesParDefaut || 0) * 100) / 100,
        enAttente: enAttente('heure_supplementaire'),
      },
      joursFeries: { jours: feries.length, enAttente: enAttente('jour_ferie') },
      financier: {
        acompteCentimes: sommeCentimes(acomptes),
        detteCentimes: sommeCentimes(dettes),
        retenueEcartCentimes: sommeCentimes(ecartsRetenus),
        ecartsInformatifs: ecartsInformatifs.length,
        enAttente: enAttente('acompte') + enAttente('dette') + attente.filter(i => i.typeItem === 'ecart_caisse').length,
        lignes: [...acomptes, ...dettes, ...ecartsRetenus].map(i => ({
          type: i.typeItem, date: i.date || null, libelle: i.libelle,
          montantCentimes: i.montantCentimes == null ? null : Number(i.montantCentimes),
        })),
      },
      elementsEnAttente: attente.length,
    };
  }

  // Statut par salarié (03/09/2026). Trois états seulement, dans un ordre
  // de gravité strict — le statut du mois est celui du salarié le plus
  // en retard, jamais une moyenne :
  //   donnee_manquante : il manque un paramétrage ou toute donnée du mois ;
  //   a_verifier       : les données sont là, un arbitrage reste à rendre ;
  //   pret             : rien à décider, le salarié peut partir en paie.
  function statutSalarie(fiche) {
    if (!fiche.reglage.inclus) return 'hors_paie';
    if (!fiche.reglage.confirme) return 'donnee_manquante';
    const heuresManuelles = (fiche.items || []).some(i => i.origine === 'manuel' && i.statut === 'valide' && Number(i.quantiteMinutes || 0) > 0);
    if (fiche.reglage.modePresence === 'manuel' && !heuresManuelles) return 'donnee_manquante';
    const aDesElements = (fiche.items || []).length > 0;
    if (!Number(fiche.heuresConfirmees || 0) && !(fiche.joursConfirmes && fiche.joursConfirmes.size) && !aDesElements) return 'donnee_manquante';
    // Un écart de concordance n'empêche pas un salarié d'être prêt : il est
    // signalé au manager, qui intervient sur les exceptions et non pour
    // reconfirmer des heures déjà justifiées (§4, §14).
    if ((fiche.items || []).some(i => i.rubrique !== 'ecart_verify_planning' && !i.decisionAnterieure
        && (i.statut === 'a_verifier' || i.contestationOuverte))) return 'a_verifier';
    return 'pret';
  }

  const ORDRE_STATUT = ['donnee_manquante', 'a_verifier', 'pret'];
  function statutGlobal(statuts) {
    const retenus = statuts.filter(s => s !== 'hors_paie');
    if (!retenus.length) return 'donnee_manquante';
    return ORDRE_STATUT.find(s => retenus.includes(s)) || 'pret';
  }

  const LIBELLE_STATUT_SALARIE = { pret: 'Prêt', a_verifier: 'À vérifier', donnee_manquante: 'Donnée manquante', hors_paie: 'Hors paie' };

  /**
   * Dossier comptable : la sortie PRINCIPALE de NEXUS PAYE (03/09/2026).
   * Une synthèse mensuelle + une fiche par salarié, composées des seules
   * variables agrégées. Le CSV existant reste disponible comme export
   * technique, mais ce n'est plus lui le résultat du module.
   */
  function dossierComptable(rapport, options) {
    const opts = options || {};
    const salaries = rapport.employes
      .filter(f => f.reglage.inclus)
      .map(f => ({
        employeeId: f.employee.id,
        nom: f.employee.nom || '',
        role: f.employee.role || '',
        statut: statutSalarie(f),
        statutLibelle: LIBELLE_STATUT_SALARIE[statutSalarie(f)],
        variables: variablesComptables(f),
      }))
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));

    const total = extraire => salaries.reduce((s, x) => s + Number(extraire(x.variables) || 0), 0);
    return {
      periode: rapport.periode,
      genereLe: opts.genereLe || new Date().toISOString(),
      statutPeriode: (rapport.periodeEnregistree && rapport.periodeEnregistree.statut) || 'brouillon',
      statutGlobal: statutGlobal(salaries.map(s => s.statut)),
      salaries,
      synthese: {
        salaries: salaries.length,
        prets: salaries.filter(s => s.statut === 'pret').length,
        aVerifier: salaries.filter(s => s.statut === 'a_verifier').length,
        donneeManquante: salaries.filter(s => s.statut === 'donnee_manquante').length,
        joursTravailles: total(v => v.presence.jours),
        heuresConfirmees: Math.round(total(v => v.presence.heures) * 100) / 100,
        joursCongesPayes: total(v => v.congesPayes.jours),
        joursMaladieMaternite: total(v => v.maladieMaternite.jours),
        joursAutresAbsences: total(v => v.autresAbsences.jours),
        joursAbsenceNonDeclaree: total(v => v.absence.jours),
        retardsMinutes: total(v => v.retards.minutes),
        heuresSupplementaires: Math.round(total(v => v.heuresSupplementaires.heures) * 100) / 100,
        joursFeries: total(v => v.joursFeries.jours),
        acompteCentimes: total(v => v.financier.acompteCentimes),
        detteCentimes: total(v => v.financier.detteCentimes),
        retenueEcartCentimes: total(v => v.financier.retenueEcartCentimes),
        elementsEnAttente: total(v => v.elementsEnAttente),
      },
      ecartsNonAttribues: (rapport.ecartsNonAttribues || []).length,
    };
  }

  global.NexusPayeMoteur = { heuresParDefautJour, posteDuJour, reglesHeures, dureeNetteHeures, minutesHoraire, DUREES_REFERENCE_DEFAUT, HEURES_RENFORT_DEFAUT, moisISO, finMoisISO, dateDansMois, extraireEmployeeIds, reglageEmploye, construireRapport, lignesExport,
    MOTIFS_INDISPO, TYPES_ITEM_EVENEMENT_RH, LIBELLE_STATUT_SALARIE, LIBELLE_POSTE, RUBRIQUE_ECART, variablesComptables, statutSalarie, statutGlobal, dossierComptable };
})(typeof window !== 'undefined' ? window : globalThis);
