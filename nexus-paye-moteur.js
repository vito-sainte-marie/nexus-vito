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

  function cleJour(employeeId, date) { return `${employeeId}|${date}`; }
  function cleQuart(employeeId, date, quart) { return `${employeeId}|${date}|${quart || ''}`; }

  function activitesAudit(audits) {
    const parQuart = new Map();
    (audits || []).forEach(a => {
      ['piste', 'boutique'].forEach(activite => {
        extraireEmployeeIds(a[`employes_${activite}`]).forEach(employeeId => {
          const cle = cleQuart(employeeId, a.date, a.quart);
          if (!parQuart.has(cle)) parQuart.set(cle, new Set());
          parQuart.get(cle).add(activite);
        });
      });
    });
    return parQuart;
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
      jours_heure_supp: [4, 5, 6], minutes_heure_supp: 60,
      activites_heure_supp: ['piste', 'boutique'], quart_exclu_heure_supp: 'renfort',
      retard_max_coherent_min: 180, jours_feries: [],
    }, entree.config || {});
    const settings = new Map((entree.settings || []).map(s => [s.employee_id, s]));
    const arbitrages = indexerArbitrages(entree.items || []);
    const audits = (entree.audits || []).filter(a => dateDansMois(a.date, periode));
    const activiteParQuart = activitesAudit(audits);
    const preuveJour = new Map();
    const retardParJour = new Map();

    (entree.pointages || []).filter(p => dateDansMois(p.date, periode)).forEach(p => {
      if (p.type === 'arrivee') {
        const cle = cleJour(p.employee_id, p.date);
        preuveJour.set(cle, { type: 'pointage', ligne: p });
        const retard = Number(p.retard_min || 0);
        if (retard > 0) retardParJour.set(cle, Math.max(retardParJour.get(cle) || 0, retard));
      }
    });
    audits.forEach(a => {
      ['piste', 'boutique'].forEach(activite => extraireEmployeeIds(a[`employes_${activite}`]).forEach(employeeId => {
        const cle = cleJour(employeeId, a.date);
        const precedent = preuveJour.get(cle);
        preuveJour.set(cle, { type: precedent ? 'verify+pointage' : 'verify', ligne: a });
      }));
    });

    const planning = (entree.planning || []).filter(p => dateDansMois(p.date, periode));
    const planningParEmployeJour = new Map();
    planning.forEach(p => {
      const cle = cleJour(p.employee_id, p.date);
      if (!planningParEmployeJour.has(cle)) planningParEmployeJour.set(cle, []);
      planningParEmployeJour.get(cle).push(p);
    });

    const indispoParJour = new Map();
    (entree.indisponibilites || []).forEach(i => {
      let d = new Date(`${i.date_debut}T12:00:00`);
      const fin = new Date(`${i.date_fin}T12:00:00`);
      while (d <= fin) {
        const iso = d.toISOString().slice(0, 10);
        if (dateDansMois(iso, periode)) indispoParJour.set(cleJour(i.employee_id, iso), i);
        d.setDate(d.getDate() + 1);
      }
    });

    const employes = [];
    const itemsGlobaux = [];
    (entree.employees || []).filter(e => e.actif !== false).forEach(employee => {
      const reglage = reglageEmploye(employee, settings.get(employee.id));
      const fiche = {
        employee, reglage, heuresConfirmees: 0, joursConfirmes: new Set(),
        presencesMesurees: 0, presencesReconstituees: 0, items: [],
      };
      if (!reglage.inclus || reglage.modePresence === 'exclu') {
        employes.push(fiche);
        return;
      }

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
          fiche.heuresConfirmees += shiftsTravail.reduce((s, p) => s + Number(p.duree_heures || 0), 0);
          if (preuve.type === 'verify+pointage') fiche.presencesMesurees += 1;
          else fiche.presencesReconstituees += 1;
        } else if (shiftsTravail.length && !preuve) {
          fiche.items.push({
            sourceCle: `absence:${employee.id}:${date}`, typeItem: 'absence_a_verifier', origine: 'planning',
            date, libelle: 'Présence prévue sans preuve Verify/Pointage', statut: 'a_verifier', impactPaye: false,
          });
        } else if (!shiftsTravail.length && preuve) {
          fiche.joursConfirmes.add(date);
          fiche.presencesReconstituees += 1;
          fiche.items.push({
            sourceCle: `presence-exceptionnelle:${employee.id}:${date}`, typeItem: 'presence_exceptionnelle', origine: preuve.type.includes('verify') ? 'verify' : 'pointage',
            date, libelle: 'Présence constatée hors planning de travail', statut: 'a_verifier', impactPaye: false,
          });
        }

        if (indispo && !preuve) {
          const typeItem = indispo.type === 'conge' ? 'conge_paye' : 'absence_a_verifier';
          fiche.items.push({
            sourceCle: `indispo:${indispo.id}:${date}`, typeItem, origine: 'indisponibilite', date,
            libelle: indispo.type === 'conge' ? 'Congé déclaré' : 'Indisponibilité déclarée',
            statut: 'a_verifier', impactPaye: false,
          });
        }

        const retard = retardParJour.get(cle);
        if (retard) {
          const incoherent = retard > Number(config.retard_max_coherent_min || 180);
          fiche.items.push({
            sourceCle: `retard:${employee.id}:${date}`, typeItem: incoherent ? 'retard_incoherent' : 'retard', origine: 'pointage',
            date, libelle: incoherent ? `Retard incohérent détecté (${retard} min)` : `Retard détecté (${retard} min)`,
            quantiteMinutes: retard, statut: 'a_verifier', impactPaye: false, bloquantTechnique: incoherent,
          });
        }

        if (preuve && shiftsTravail.length) {
          const jour = new Date(`${date}T12:00:00`).getDay();
          const eligibleJour = (config.jours_heure_supp || []).map(Number).includes(jour);
          const activites = new Set();
          let activiteMesureeParVerify = false;
          shiftsTravail.forEach(s => {
            const auditActs = activiteParQuart.get(cleQuart(employee.id, date, s.quart));
            if (auditActs) { activiteMesureeParVerify = true; auditActs.forEach(a => activites.add(a)); }
            else if (s.tache === 'piste') activites.add('piste');
            else if (s.tache === 'caisse') activites.add('boutique');
          });
          const estRenfort = shiftsTravail.every(s => s.quart === config.quart_exclu_heure_supp || s.statut === 'renfort');
          const activiteEligible = [...activites].some(a => (config.activites_heure_supp || []).includes(a));
          if (eligibleJour && activiteEligible && !estRenfort) {
            fiche.items.push({
              sourceCle: `heure-supp:${employee.id}:${date}`, typeItem: 'heure_supplementaire', origine: activiteMesureeParVerify ? 'verify' : 'planning',
              date, libelle: 'Heure supplémentaire jeudi/vendredi/samedi',
              quantiteMinutes: Number(config.minutes_heure_supp || 60), statut: 'a_verifier', impactPaye: false,
            });
          }
          if ((config.jours_feries || []).includes(date)) {
            fiche.items.push({
              sourceCle: `jour-ferie:${employee.id}:${date}`, typeItem: 'jour_ferie', origine: preuve.type.includes('verify') ? 'verify' : 'pointage',
              date, libelle: 'Jour férié travaillé', statut: 'a_verifier', impactPaye: false,
            });
          }
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

      fiche.items = fiche.items.map(i => appliquerArbitrage(i, arbitrages));
      const manuels = (entree.items || []).filter(i => i.origine === 'manuel' && i.employee_id === employee.id && i.periode === periode).map(i => ({
        id: i.id, sourceCle: i.source_cle, typeItem: i.type_item, origine: 'manuel', date: i.date_evenement,
        libelle: i.libelle, quantiteMinutes: i.quantite_minutes, montantCentimes: i.montant_centimes,
        statut: i.statut, impactPaye: !!i.impact_paye, note: i.note || null,
      }));
      fiche.items.push(...manuels);
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

    const bloqueurs = [];
    employes.forEach(f => {
      if (!f.reglage.confirme) bloqueurs.push({ type: 'configuration_employe', employeeId: f.employee.id, libelle: `${f.employee.nom} : rattachement paie à confirmer` });
      if (f.reglage.inclus && f.reglage.modePresence === 'manuel' && !f.items.some(i => i.origine === 'manuel' && i.statut === 'valide' && i.quantiteMinutes > 0)) {
        bloqueurs.push({ type: 'heures_manuelles', employeeId: f.employee.id, libelle: `${f.employee.nom} : heures mensuelles à confirmer manuellement` });
      }
      f.items.filter(i => i.statut === 'a_verifier' || i.contestationOuverte).forEach(i => bloqueurs.push({ type: i.typeItem, employeeId: f.employee.id, sourceCle: i.sourceCle, libelle: `${f.employee.nom} : ${i.libelle}` }));
    });
    ecartsNonAttribues.filter(i => i.statut === 'a_verifier').forEach(i => bloqueurs.push({ type: 'ecart_non_attribue', employeeId: null, sourceCle: i.sourceCle, libelle: `${i.libelle} : attribution à corriger dans Verify` }));

    return {
      periode,
      employes,
      items: itemsGlobaux,
      bloqueurs,
      synthese: {
        salariesInclus: employes.filter(f => f.reglage.inclus).length,
        heuresConfirmees: Math.round(employes.reduce((s, f) => s + f.heuresConfirmees, 0) * 100) / 100,
        variablesValidees: itemsGlobaux.filter(i => i.statut === 'valide').length,
        informations: itemsGlobaux.filter(i => i.statut === 'information').length,
        aVerifier: bloqueurs.length,
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
      valides.forEach(i => lignes.push({
        employe: f.employee.nom, type: i.typeItem, date: i.date || '', source: i.origine || '',
        ecart_initial: i.ecartInitialCentimes == null ? '' : (i.ecartInitialCentimes / 100).toFixed(2),
        ecart_final: i.ecartFinalCentimes == null ? '' : (i.ecartFinalCentimes / 100).toFixed(2), statut: i.statut,
        quantite_minutes: i.quantiteMinutes == null ? '' : i.quantiteMinutes,
        montant_euros: i.montantCentimes == null ? '' : (i.montantCentimes / 100).toFixed(2),
        impact_paye: i.impactPaye ? 'oui' : 'information', commentaire: i.note || i.libelle,
      }));
    });
    return lignes;
  }

  global.NexusPayeMoteur = { moisISO, finMoisISO, dateDansMois, extraireEmployeeIds, reglageEmploye, construireRapport, lignesExport };
})(typeof window !== 'undefined' ? window : globalThis);
