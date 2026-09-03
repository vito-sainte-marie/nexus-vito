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

  function jjmmaaaa(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
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
        presencesMesurees: 0, presencesReconstituees: 0, items: [],
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
          fiche.heuresConfirmees += shiftsTravail.reduce((s, p) => s + Number(p.duree_heures || 0), 0);
          if (preuve.type === 'verify+pointage') fiche.presencesMesurees += 1;
          else fiche.presencesReconstituees += 1;
        } else if (shiftsTravail.length && !preuve && !indispo) {
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
          fiche.items.push({
            sourceCle: `presence-exceptionnelle:${employee.id}:${date}`, typeItem: 'presence_exceptionnelle', origine: preuve.type.includes('verify') ? 'verify' : 'pointage',
            date, libelle: 'Présence constatée hors planning de travail', statut: 'a_verifier', impactPaye: false,
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
          libelle: multi
            ? `Absence non déclarée du ${jjmmaaaa(serie.debut)} au ${jjmmaaaa(serie.fin)}`
            : 'Présence prévue sans preuve Verify/Pointage',
          detail: multi
            ? `${serie.jours.length} jours planifiés sans aucune preuve de présence · à déclarer comme événement RH pour ne plus la revoir chaque mois`
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
        const contradiction = joursAvecPreuve.length > 0;
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
          // Qualifié et sans contradiction : information, plus jamais une
          // décision à reprendre. Le manager ne revalide que ce qui change.
          statut: (qualifie && !contradiction) ? 'information' : 'a_verifier',
          impactPaye: false,
        });
      });

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
      f.items.filter(i => i.statut === 'a_verifier' || i.contestationOuverte).forEach(i => bloqueurs.push({ categorie: 'element', type: i.typeItem, employeeId: f.employee.id, sourceCle: i.sourceCle, libelle: `${f.employee.nom} : ${i.libelle}` }));
    });
    ecartsNonAttribues.filter(i => i.statut === 'a_verifier').forEach(i => bloqueurs.push({ categorie: 'element', type: 'ecart_non_attribue', employeeId: null, sourceCle: i.sourceCle, libelle: `${i.libelle} : attribution à corriger dans Verify` }));

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
        // On compte des DÉCISIONS, pas des lignes techniques : le manager
        // doit voir le nombre de choses qu'il a réellement à trancher.
        aVerifier: bloqueurs.filter(b => b.categorie === 'element').length,
        configurationRequise: bloqueurs.filter(b => b.categorie === 'configuration').length,
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
