// NEXUS — relevé des écarts et des versements de régularisation pour la
// paie (08/10/2026, mandat consolidé §8, B6).
//
// Pour chaque écart consolidé (nexus-ecarts-donnees.js) : écart initial,
// écart corrigé, motif, versé, restitué, solde, statut et historique des
// opérations. Deux vues : hebdomadaire (lundi → dimanche, au fuseau de la
// station) et mensuelle, chacune avec excédents et manques SÉPARÉS — jamais
// compensés entre eux.
//
// Ce module ne calcule AUCUNE déduction ni retenue sur salaire : il décrit.
// Un écart sans responsable unique (caisse tenue à plusieurs, ou personne)
// est « collectif, non imputé » : il apparaît dans sa propre rubrique et
// n'entre dans le total d'aucun employé.
//
// Séparé de nexus-paye-moteur.js à dessein : la branche
// paye-regles-smu-20261008 modifie ce moteur, l'écran Paye et son PDF, et
// attend l'arbitrage de Frédéric. Ce module n'en dépend pas ; Paye pourra
// le charger tel quel.
//
// Sources : ecarts_versements_regularisation,
// ecarts_restitutions_trop_percu (20261008120000, 20261008130000). Lecture
// seule, sous la RLS « manager ou gérant du même site ». Une opération
// annulée l'est par contre-écriture (annule_le) : elle reste dans
// l'historique et ne compte plus.
// ------------------------------------------------------------

(function (global) {
  const STATUTS = {
    OUVERT: 'Ouvert',
    PARTIELLEMENT_REGULARISE: 'Partiellement régularisé',
    SOLDE: 'Soldé',
    SANS_DEFICIT: 'Sans manque à régulariser',
  };
  const ANNULE_PAR_CONTRE_ECRITURE = 'Annulé par contre-écriture';
  const LIBELLE_VERSEMENT = "Versement volontaire de régularisation d'un écart antérieur";
  const MODES = { especes: 'Espèces', carte_bancaire: 'Carte bancaire', cheque: 'Chèque', virement: 'Virement', autre: 'Autre' };

  function centimes(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Montant illisible : ${v}`);
    return Math.round(n * 100);
  }

  // Jour civil (AAAA-MM-JJ) d'un horodatage, au fuseau de la station.
  function jourStation(iso, fuseau) {
    if (!fuseau) throw new Error('Fuseau de la station inconnu : aucun jour ne peut être calculé.');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`Horodatage illisible : ${iso}`);
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const v = t => p.find(x => x.type === t).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  }

  // Lundi de la semaine d'un jour civil (calcul sur le calendrier, sans heure).
  function lundiDe(jour) {
    const [a, m, j] = jour.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1, j));
    const decalage = (d.getUTCDay() + 6) % 7; // lundi = 0
    d.setUTCDate(d.getUTCDate() - decalage);
    return d.toISOString().slice(0, 10);
  }
  function dimancheDe(lundi) {
    const [a, m, j] = lundi.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, j + 6)).toISOString().slice(0, 10);
  }

  function cleOrigine(op) {
    return op.module_origine === 'fdj' ? `fdj-${op.fdj_cash_control_id}` : `verify-${op.audit_id}-${op.caisse_origine}`;
  }

  // ------------------------------------------------------------
  // construireReleve(ecarts, operations, { fuseau })
  //   ecarts     : lignes de chargerEcartsConsolides
  //   operations : { versements, restitutions } (lignes brutes des tables)
  // ------------------------------------------------------------
  function construireReleve(ecarts, operations, options) {
    const fuseau = options && options.fuseau;
    if (!fuseau) throw new Error('Fuseau de la station inconnu : le relevé ne peut pas être daté.');
    const versements = (operations && operations.versements) || [];
    const restitutions = (operations && operations.restitutions) || [];

    const parCle = {};
    (ecarts || []).forEach(e => { parCle[e.id] = { ecart: e, historique: [] }; });
    const sansEcart = [];

    function rattacher(op, nature) {
      const cible = parCle[cleOrigine(op)];
      const horodatage = nature === 'versement' ? op.encaisse_le : op.restitue_le;
      const entree = {
        nature,
        id: op.id,
        horodatage,
        jour: jourStation(horodatage, fuseau),
        montantCentimes: centimes(op.montant),
        mode: nature === 'versement' ? op.mode_encaissement : op.mode_restitution,
        auteurId: nature === 'versement' ? op.auteur_id : op.valide_par,
        employeeId: op.employee_id,
        destination: nature === 'versement' ? op.destination : op.source,
        motif: nature === 'versement' ? LIBELLE_VERSEMENT : op.justification,
        statut: op.annule_le ? ANNULE_PAR_CONTRE_ECRITURE : 'Actif',
        annule: !!op.annule_le,
      };
      if (!cible) { sansEcart.push(entree); return; }
      cible.historique.push(entree);
      if (op.annule_le) {
        cible.historique.push({
          nature: `annulation_${nature}`, id: op.id, horodatage: op.annule_le,
          jour: jourStation(op.annule_le, fuseau), montantCentimes: -centimes(op.montant),
          auteurId: op.annule_par, motif: op.motif_annulation, statut: ANNULE_PAR_CONTRE_ECRITURE, annule: true,
        });
      }
    }
    versements.forEach(v => rattacher(v, 'versement'));
    restitutions.forEach(r => rattacher(r, 'restitution'));

    const lignes = Object.values(parCle).map(({ ecart: e, historique }) => {
      historique.sort((a, b) => String(a.horodatage).localeCompare(String(b.horodatage)));
      const corrige = centimes(e.ecartFinal);
      const verse = historique.filter(h => h.nature === 'versement' && !h.annule).reduce((s, h) => s + h.montantCentimes, 0);
      const restitue = historique.filter(h => h.nature === 'restitution' && !h.annule).reduce((s, h) => s + h.montantCentimes, 0);
      const manque = corrige < 0 ? -corrige : 0;
      const net = verse - restitue;
      const solde = manque - net; // > 0 reste dû, < 0 trop-perçu
      let statut;
      if (manque === 0) statut = 'SANS_DEFICIT';
      else if (solde <= 0) statut = 'SOLDE';
      else if (net > 0) statut = 'PARTIELLEMENT_REGULARISE';
      else statut = 'OUVERT';
      return {
        cle: e.id,
        date: e.date, quart: e.quart, activite: e.activite, sourceModule: e.sourceModule,
        employeeId: e.employeeId || null,
        employeeNom: e.employeeNom || null,
        nonImpute: !e.employeeId,
        ecartInitialCentimes: centimes(e.ecartInitial),
        ecartCorrigeCentimes: corrige,
        motif: e.causeCode || null,
        verseCentimes: verse,
        restitueCentimes: restitue,
        soldeCentimes: solde,
        tropPercuCentimes: solde < 0 ? -solde : 0,
        statut,
        libelleStatut: STATUTS[statut],
        historique,
      };
    }).sort((a, b) => (a.date + a.quart + a.cle).localeCompare(b.date + b.quart + b.cle));

    return { fuseau, lignes, operationsSansEcart: sansEcart };
  }

  // ------------------------------------------------------------
  // Agrégation par période. Les écarts sont rangés au jour de leur quart
  // (déjà un jour de la station) ; versements et restitutions au jour de
  // la station où ils ont eu lieu. Excédents et manques ne se compensent
  // jamais. Les collectifs forment une rubrique à part.
  // ------------------------------------------------------------
  function agreger(releve, clePeriode, bornesPeriode) {
    const groupes = {};
    function groupe(periode, ligne) {
      const cleEmp = ligne.nonImpute ? '__collectif__' : ligne.employeeId;
      const k = `${periode}|${cleEmp}`;
      if (!groupes[k]) {
        groupes[k] = Object.assign({ periode, employeeId: ligne.nonImpute ? null : ligne.employeeId,
          employeeNom: ligne.nonImpute ? null : ligne.employeeNom, nonImpute: ligne.nonImpute,
          excedentsCentimes: 0, manquesCentimes: 0, nbExcedents: 0, nbManques: 0,
          verseCentimes: 0, restitueCentimes: 0, ecarts: [] }, bornesPeriode(periode));
      }
      return groupes[k];
    }
    releve.lignes.forEach(l => {
      const g = groupe(clePeriode(l.date), l);
      if (l.ecartCorrigeCentimes > 0) { g.excedentsCentimes += l.ecartCorrigeCentimes; g.nbExcedents++; }
      if (l.ecartCorrigeCentimes < 0) { g.manquesCentimes += l.ecartCorrigeCentimes; g.nbManques++; }
      g.ecarts.push(l.cle);
      // 09/10 (G3) : une opération annulée a bien eu lieu à son jour ; sa
      // contre-écriture (montant négatif) compte au jour de l'annulation.
      // Effacer les deux réécrivait la période d'origine après coup.
      l.historique.forEach(h => {
        const gOp = groupe(clePeriode(h.jour), l);
        if (h.nature === 'versement' || h.nature === 'annulation_versement') gOp.verseCentimes += h.montantCentimes;
        if (h.nature === 'restitution' || h.nature === 'annulation_restitution') gOp.restitueCentimes += h.montantCentimes;
      });
    });
    return Object.values(groupes).sort((a, b) =>
      a.periode.localeCompare(b.periode) || (a.nonImpute - b.nonImpute) || String(a.employeeNom || '').localeCompare(String(b.employeeNom || '')));
  }

  function vueHebdomadaire(releve) {
    return agreger(releve, lundiDe, lundi => ({ du: lundi, au: dimancheDe(lundi) }));
  }
  function vueMensuelle(releve) {
    return agreger(releve, jour => jour.slice(0, 7), mois => ({ du: `${mois}-01`, au: null }));
  }

  // ------------------------------------------------------------
  // Synthèse d'une période (09/10/2026, G3 — vérité comptable commune
  // employé / manager). Trois lectures distinctes, jamais confondues :
  //   - écarts constatés : écarts dont le quart tombe dans [du, au] ;
  //     manques et excédents séparés, écarts non clôturés à part ;
  //   - régularisations encaissées : opérations dont le jour de la station
  //     tombe dans [du, au], quel que soit l'âge de l'écart régularisé ;
  //     une annulation compte au jour de l'annulation ;
  //   - solde restant à régulariser, à une date de référence explicite :
  //     écarts clôturés datés au plus tard ce jour-là, opérations et
  //     annulations survenues au plus tard ce jour-là. Un versement futur
  //     ne modifie jamais un solde historique.
  // Le solde restant n'est donc pas « écarts de la période − versements de
  // la période ». Il est calculé par construireReleve, sans seconde formule.
  //
  // ecarts : l'univers de l'écran (filtres appliqués SAUF les dates) — tout
  //   le site pour un manager, ses propres écarts pour un employé.
  // ------------------------------------------------------------
  function operationsAuJour(operations, fuseau, reference) {
    const garder = (op, champ) => jourStation(op[champ], fuseau) <= reference;
    // Une annulation postérieure à la référence n'existait pas encore.
    const figer = op => (op.annule_le && jourStation(op.annule_le, fuseau) > reference)
      ? Object.assign({}, op, { annule_le: null, annule_par: null, motif_annulation: null }) : op;
    return {
      versements: ((operations && operations.versements) || []).filter(op => garder(op, 'encaisse_le')).map(figer),
      restitutions: ((operations && operations.restitutions) || []).filter(op => garder(op, 'restitue_le')).map(figer),
    };
  }

  function estCloture(e) { return e.statut !== 'a_verifier'; }

  function soldeAuJour(ecarts, operations, fuseau, reference) {
    const univers = (ecarts || []).filter(e => e.date <= reference && estCloture(e));
    const releve = construireReleve(univers, operationsAuJour(operations, fuseau, reference), { fuseau });
    const r = { reference, resteDuCentimes: 0, tropPercuCentimes: 0, nbOuverts: 0, dontNonImputeCentimes: 0 };
    releve.lignes.forEach(l => {
      // Par écart : un trop-perçu ici ne rembourse jamais un reste dû ailleurs.
      if (l.soldeCentimes > 0) {
        r.resteDuCentimes += l.soldeCentimes; r.nbOuverts++;
        if (l.nonImpute) r.dontNonImputeCentimes += l.soldeCentimes;
      }
      if (l.soldeCentimes < 0) r.tropPercuCentimes += -l.soldeCentimes;
    });
    return r;
  }

  // Restreint les opérations à celles qui portent sur un écart de l'univers.
  // Le manager charge tout le site, l'employé seulement ses propres écarts :
  // passer par ici rend les deux entrées identiques pour une même sélection,
  // donc les mêmes montants et les mêmes bandeaux (complément G3, 09/10).
  function operationsDeLUnivers(ecarts, operations) {
    const cles = new Set((ecarts || []).map(e => e.id));
    const garde = op => cles.has(cleOrigine(op));
    return {
      versements: ((operations && operations.versements) || []).filter(garde),
      restitutions: ((operations && operations.restitutions) || []).filter(garde),
    };
  }

  // Écarts de l'employé à partir de `mes_regularisations()` (complément G3,
  // 09/10). Aucun calcul propre : les lignes sources passent par les MÊMES
  // normalisations que l'écran manager (NexusEcartsDonnees), puis l'appelant
  // les donne à syntheseRegularisationsPeriode comme le manager.
  //   projection : { audits, fdj, versements, restitutions }
  //   employe    : { id, nom }
  function ecartsDeLaProjection(projection, employe) {
    const D = global.NexusEcartsDonnees;
    if (!D) throw new Error('NexusEcartsDonnees absent : la synthèse employé ne peut pas être calculée.');
    // Sans moteur, les normaliseurs rendent [] en silence : l'employé lirait
    // 0 € là où son manager lit -50 €. Un zéro muet est pire qu'un refus.
    if (!global.NexusEcartsMoteur) throw new Error('NexusEcartsMoteur absent : la synthèse employé ne peut pas être calculée.');
    const p = projection || {};
    const noms = { [employe.id]: employe.nom };
    return [
      ...D.normaliserAuditsVerify(p.audits || [], noms, {}),
      ...D.normaliserControlesFdj(p.fdj || [], noms, {}),
    ];
  }

  function syntheseRegularisationsPeriode(ecarts, operations, options) {
    const o = options || {};
    const fuseau = o.fuseau;
    if (!fuseau) throw new Error('Fuseau de la station inconnu : la synthèse ne peut pas être datée.');
    const aujourdhui = o.aujourdhui || jourStation(new Date().toISOString(), fuseau);
    const du = o.dateDebut || '';
    const au = o.dateFin || aujourdhui;
    if (du && du > au) throw new Error(`Période inversée : ${du} > ${au}.`);
    const dans = j => (!du || j >= du) && j <= au;
    const univers = ecarts || [];

    const constates = { manquesCentimes: 0, nbManques: 0, excedentsCentimes: 0, nbExcedents: 0,
      enAttente: { nb: 0, manquesCentimes: 0, excedentsCentimes: 0 }, dontNonImputeCentimes: 0 };
    univers.filter(e => dans(e.date)).forEach(e => {
      const c = centimes(e.ecartFinal) || 0;
      if (!estCloture(e)) {
        constates.enAttente.nb++;
        if (c < 0) constates.enAttente.manquesCentimes += c;
        if (c > 0) constates.enAttente.excedentsCentimes += c;
        return;
      }
      if (c < 0) { constates.manquesCentimes += c; constates.nbManques++; if (!e.employeeId) constates.dontNonImputeCentimes += c; }
      if (c > 0) { constates.excedentsCentimes += c; constates.nbExcedents++; }
    });

    // Toutes les opérations rattachées à l'univers ; seules celles de la
    // période comptent, au jour où elles ont eu lieu.
    const complet = construireReleve(univers, operations, { fuseau });
    const encaissements = { versementsCentimes: 0, annulationsVersementsCentimes: 0,
      restitutionsCentimes: 0, annulationsRestitutionsCentimes: 0, netCentimes: 0, detail: [] };
    complet.lignes.forEach(l => l.historique.forEach(h => {
      if (!dans(h.jour)) return;
      if (h.nature === 'versement') encaissements.versementsCentimes += h.montantCentimes;
      if (h.nature === 'annulation_versement') encaissements.annulationsVersementsCentimes += h.montantCentimes;
      if (h.nature === 'restitution') encaissements.restitutionsCentimes += h.montantCentimes;
      if (h.nature === 'annulation_restitution') encaissements.annulationsRestitutionsCentimes += h.montantCentimes;
      encaissements.detail.push(Object.assign({}, h, {
        ecartCle: l.cle, ecartDate: l.date, ecartQuart: l.quart, ecartActivite: l.activite,
        ecartEmployeeId: l.employeeId, ecartEmployeeNom: l.employeeNom, ecartNonImpute: l.nonImpute,
        ecartInitialCentimes: l.ecartInitialCentimes, ecartCorrigeCentimes: l.ecartCorrigeCentimes,
        ecartAnterieur: !!du && l.date < du,
      }));
    }));
    encaissements.netCentimes = encaissements.versementsCentimes + encaissements.annulationsVersementsCentimes
      - encaissements.restitutionsCentimes - encaissements.annulationsRestitutionsCentimes;
    encaissements.detail.sort((a, b) => String(a.horodatage).localeCompare(String(b.horodatage)));

    const soldeFinPeriode = soldeAuJour(univers, operations, fuseau, au);
    const soldeActuel = au >= aujourdhui ? soldeFinPeriode : soldeAuJour(univers, operations, fuseau, aujourdhui);
    return {
      fuseau, du, au, aujourdhui, constates, encaissements, soldeFinPeriode, soldeActuel,
      operationsHorsUnivers: complet.operationsSansEcart.filter(h => dans(h.jour)).length,
    };
  }

  // ------------------------------------------------------------
  // Export CSV (séparateur ;, décimales à la virgule, montants en euros).
  // ------------------------------------------------------------
  function euros(c) { return c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','); }
  function champ(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function exporterCsv(releve) {
    const entete = ['date', 'quart', 'activite', 'employe', 'imputation', 'ecart_initial', 'ecart_corrige', 'motif',
      'verse', 'restitue', 'solde', 'statut', 'historique'];
    const lignes = releve.lignes.map(l => [
      l.date, l.quart, l.activite, l.employeeNom || '', l.nonImpute ? 'collectif non imputé' : 'employé',
      euros(l.ecartInitialCentimes), euros(l.ecartCorrigeCentimes), l.motif || '',
      euros(l.verseCentimes), euros(l.restitueCentimes), euros(l.soldeCentimes), l.libelleStatut,
      l.historique.map(h => `${h.jour} ${h.nature} ${euros(h.montantCentimes)} (${h.statut})`).join(' | '),
    ].map(champ).join(';'));
    return [entete.join(';'), ...lignes, '', champ('Aucune déduction ni retenue sur salaire n’est calculée par ce relevé.')].join('\n');
  }

  // ------------------------------------------------------------
  // Rendu HTML (texte échappé ; aucune donnée n'est injectée brute).
  // ------------------------------------------------------------
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
  function fmt(c) {
    if (c === null || c === undefined) return '—';
    const signe = c > 0 ? '+' : c < 0 ? '−' : '';
    return `${signe}${(Math.abs(c) / 100).toFixed(2).replace('.', ',')} €`;
  }
  function fmtJour(j) { return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}/${j.slice(0, 4)}` : ''; }

  function renderVue(groupes, titrePeriode) {
    if (!groupes.length) return '<div class="card"><div class="liste-vide">Aucun écart sur la période.</div></div>';
    return groupes.map(g => `
      <div class="emp-card regul-periode">
        <div class="emp-head"><span class="emp-nom">${esc(g.nonImpute ? 'Collectif — non imputé' : (g.employeeNom || 'Employé inconnu'))}</span><span class="emp-role">${esc(titrePeriode(g))}</span></div>
        ${g.nonImpute ? '<div class="emp-bandeau-inhabituel">Caisse tenue à plusieurs ou sans responsable : ces écarts ne sont attribués à personne.</div>' : ''}
        <div class="emp-detail-grid">
          <div><div class="edg-label">Excédents (${g.nbExcedents})</div><div class="edg-valeur pos">${fmt(g.excedentsCentimes)}</div></div>
          <div><div class="edg-label">Manques (${g.nbManques})</div><div class="edg-valeur neg">${fmt(g.manquesCentimes)}</div></div>
          <div><div class="edg-label">Versé</div><div class="edg-valeur">${fmt(g.verseCentimes)}</div></div>
          <div><div class="edg-label">Restitué</div><div class="edg-valeur">${fmt(g.restitueCentimes)}</div></div>
        </div>
      </div>`).join('');
  }

  function renderLignes(releve) {
    if (!releve.lignes.length) return '<div class="card"><div class="liste-vide">Aucun écart.</div></div>';
    return releve.lignes.map(l => `
      <div class="emp-card regul-ligne">
        <div class="emp-head"><span class="emp-nom">${esc(fmtJour(l.date))} · Q${esc(l.quart)} · ${esc(l.activite)}</span><span class="emp-role">${esc(l.libelleStatut)}</span></div>
        <div class="regul-employe">${esc(l.nonImpute ? `Collectif — non imputé${l.employeeNom ? ` (${l.employeeNom})` : ''}` : (l.employeeNom || ''))}</div>
        <div class="emp-detail-grid">
          <div><div class="edg-label">Écart initial constaté</div><div class="edg-valeur">${fmt(l.ecartInitialCentimes)}</div></div>
          <div><div class="edg-label">Écart corrigé</div><div class="edg-valeur">${fmt(l.ecartCorrigeCentimes)}</div></div>
          <div><div class="edg-label">Régularisations validées</div><div class="edg-valeur">${fmt(l.verseCentimes)}</div></div>
          <div><div class="edg-label">Restitué</div><div class="edg-valeur">${fmt(l.restitueCentimes)}</div></div>
          <div><div class="edg-label">Solde restant à régulariser</div><div class="edg-valeur">${l.soldeCentimes > 0 ? fmt(-l.soldeCentimes) : l.soldeCentimes < 0 ? `${fmt(-l.soldeCentimes)} trop-perçu` : '0,00 €'}</div></div>
          <div><div class="edg-label">Motif</div><div class="edg-valeur">${esc(l.motif || '—')}</div></div>
        </div>
        ${l.historique.length ? `<ul class="regul-historique">${l.historique.map(h => `<li>${esc(fmtJour(h.jour))} — ${esc(h.nature.replace('_', ' '))} ${esc(fmt(h.montantCentimes))}${h.mode ? ` · ${esc(MODES[h.mode] || h.mode)}` : ''} · ${esc(h.statut)}${h.motif ? ` · ${esc(h.motif)}` : ''}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
  }

  // Rendu de la synthèse — le même pour l'écran manager et l'écran
  // employé : une seule présentation des trois lectures.
  //   options.nomEmploye(id) : nom à afficher pour un identifiant (facultatif)
  const NATURES = {
    versement: 'Versement', annulation_versement: 'Annulation de versement',
    restitution: 'Restitution', annulation_restitution: 'Annulation de restitution',
  };
  function renderSynthese(s, options) {
    const nom = (options && options.nomEmploye) || (() => null);
    const c = s.constates, e = s.encaissements, f = s.soldeFinPeriode, a = s.soldeActuel;
    const periode = s.du ? `du ${fmtJour(s.du)} au ${fmtJour(s.au)}` : `jusqu'au ${fmtJour(s.au)}`;
    const solde = r => (r.resteDuCentimes ? fmt(-r.resteDuCentimes) : '0,00 €');
    const actuelDiffere = a.reference !== f.reference
      && (a.resteDuCentimes !== f.resteDuCentimes || a.tropPercuCentimes !== f.tropPercuCentimes);
    const detail = e.detail.map(h => {
      const verseur = h.employeeId && h.employeeId !== h.ecartEmployeeId ? ` · versé par ${esc(nom(h.employeeId) || 'un tiers')}` : '';
      return `<li class="regul-op" data-nature="${esc(h.nature)}">
        <span class="regul-op-jour">${esc(fmtJour(h.jour))}</span>
        <span class="regul-op-nature">${esc(NATURES[h.nature] || h.nature)}</span>
        <span class="regul-op-montant">${esc(fmt(h.montantCentimes))}</span>
        ${h.mode ? `<span>${esc(MODES[h.mode] || h.mode)}</span>` : ''}
        <span>${esc(h.ecartNonImpute ? 'Collectif — non imputé' : (h.ecartEmployeeNom || ''))}${verseur}</span>
        <span>écart du ${esc(fmtJour(h.ecartDate))} · Q${esc(h.ecartQuart)} · ${esc(h.ecartActivite)} (${esc(fmt(h.ecartInitialCentimes))})${h.ecartAnterieur ? ' · antérieur à la période' : ''}</span>
        <span>${esc(h.statut)}${h.auteurId ? ` · saisi par ${esc(nom(h.auteurId) || 'manager')}` : ''}${h.motif && h.nature.startsWith('annulation') ? ` · ${esc(h.motif)}` : ''}</span>
      </li>`;
    }).join('');
    return `
      <div class="card regul-synthese" data-du="${esc(s.du)}" data-au="${esc(s.au)}">
        <div class="regul-synthese-periode">Période ${esc(periode)} — jours de la station</div>
        <div class="emp-detail-grid">
          <div data-mesure="ecarts-manques"><div class="edg-label">Écarts constatés — manques (${c.nbManques})</div><div class="edg-valeur neg">${fmt(c.manquesCentimes)}</div></div>
          <div data-mesure="ecarts-excedents"><div class="edg-label">Écarts constatés — excédents (${c.nbExcedents})</div><div class="edg-valeur pos">${fmt(c.excedentsCentimes)}</div></div>
          <div data-mesure="regularisations"><div class="edg-label">Régularisations encaissées</div><div class="edg-valeur">${fmt(e.netCentimes)}</div></div>
          <div data-mesure="solde-fin"><div class="edg-label">Solde restant à régulariser au ${esc(fmtJour(f.reference))}</div><div class="edg-valeur neg">${solde(f)}</div></div>
        </div>
        ${c.enAttente.nb ? `<div class="regul-note" data-mesure="en-attente">${c.enAttente.nb} écart(s) de la période non clôturé(s) (${fmt(c.enAttente.manquesCentimes)} / ${fmt(c.enAttente.excedentsCentimes)}) : hors solde tant qu'ils ne sont pas validés.</div>` : ''}
        ${e.annulationsVersementsCentimes || e.restitutionsCentimes || e.annulationsRestitutionsCentimes ? `<div class="regul-note">Dont versements ${fmt(e.versementsCentimes)}, annulations ${fmt(e.annulationsVersementsCentimes)}, restitutions ${fmt(-e.restitutionsCentimes)}${e.annulationsRestitutionsCentimes ? `, annulations de restitution ${fmt(-e.annulationsRestitutionsCentimes)}` : ''}.</div>` : ''}
        ${f.tropPercuCentimes ? `<div class="regul-note" data-mesure="trop-percu">Trop-perçu à restituer au ${esc(fmtJour(f.reference))} : ${fmt(f.tropPercuCentimes)} (jamais déduit d'un autre écart).</div>` : ''}
        ${f.dontNonImputeCentimes ? `<div class="regul-note">Dont ${fmt(-f.dontNonImputeCentimes)} sur des écarts collectifs, imputés à personne.</div>` : ''}
        ${actuelDiffere ? `<div class="regul-note" data-mesure="solde-actuel">Solde actuel au ${esc(fmtJour(a.reference))} : ${solde(a)}${a.tropPercuCentimes ? ` · trop-perçu ${fmt(a.tropPercuCentimes)}` : ''}.</div>` : ''}
        ${s.operationsHorsUnivers ? `<div class="emp-bandeau-inhabituel">${s.operationsHorsUnivers} opération(s) de la période portent sur des écarts hors de la sélection : non comptées ici.</div>` : ''}
        <div class="regul-note">Le solde restant n'est pas « écarts de la période − régularisations de la période » : il porte sur tous les écarts validés jusqu'à sa date, et ignore toute opération postérieure.</div>
        ${detail ? `<ul class="regul-historique regul-encaissements">${detail}</ul>` : '<div class="liste-vide">Aucune régularisation encaissée sur la période.</div>'}
      </div>`;
  }

  async function chargerOperations(client, siteId) {
    const [v, r] = await Promise.all([
      client.from('ecarts_versements_regularisation').select('*').eq('site', siteId),
      client.from('ecarts_restitutions_trop_percu').select('*').eq('site', siteId),
    ]);
    if (v.error) throw v.error;
    if (r.error) throw r.error;
    return { versements: v.data || [], restitutions: r.data || [] };
  }

  global.NexusPayeRegularisations = {
    STATUTS, ANNULE_PAR_CONTRE_ECRITURE, LIBELLE_VERSEMENT,
    jourStation, lundiDe, construireReleve, vueHebdomadaire, vueMensuelle,
    syntheseRegularisationsPeriode, renderSynthese, operationsDeLUnivers, ecartsDeLaProjection,
    exporterCsv, renderVue, renderLignes, chargerOperations,
  };
})(typeof window !== 'undefined' ? window : globalThis);
