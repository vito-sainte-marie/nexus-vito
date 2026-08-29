// NEXUS Écarts — chargeur consolidé Verify + FDJ (28/08/2026, v2.268-C1)
//
// Origine : "Audit_NEXUS_Analyse_des_Ecarts_Verify_FDJ_PAYE.pdf" (cadrage
// de Frédéric) — §13 recommandait une table dédiée "écarts" alimentée en
// double écriture par Verify et FDJ. Décision architecturale prise ici
// (Article 11, "une seule vérité") : PAS de nouvelle table à synchroniser
// — ce fichier lit directement `audits_caisse` (Verify) et
// `fdj_shifts`+`fdj_cash_controls` (FDJ), qui restent les SEULES sources
// réelles de ces écarts, et les normalise à la volée dans la forme prévue
// par le cadrage. Même convention que les autres chargeurs *-donnees.js
// (nexus-carburant-donnees.js, etc.) : `client` (le client Supabase) et
// `siteId` en premiers paramètres, jamais d'accès réseau caché ailleurs.
//
// Ligne consolidée retournée par carburant... pardon, par écart :
//   { id, sourceModule ('verify'|'fdj'), sourceControlId, date, quart,
//     employeeId, employeeNom, activite ('piste'|'boutique'|'fdj'),
//     ecartInitial, ecartFinal, causeCode, statut, resolvedAt, resolvedBy,
//     deepLink }
// — mêmes noms que §13 du cadrage (adaptés camelCase JS), à l'exception de
// `payroll_impact`/`payroll_amount` : explicitement HORS SCOPE de ce lot
// (P0), NEXUS Paye n'existe pas encore (voir Data Dictionary v2.268,
// limite assumée plutôt que fabriquée).
//
// Dépend de nexus-ecarts-moteur.js (deriverStatutEcart) — DOIT être chargé
// avant ce fichier :
//   <script src="nexus-ecarts-moteur.js"></script>
//   <script src="nexus-ecarts-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // ------------------------------------------------------------
  // chargerEcartsConsolides(client, siteId, filtres) — lit les 3 tables
  // réelles, normalise chaque composante en ligne d'écart, ne retient QUE
  // les lignes où deriverStatutEcart a produit un statut réel (jamais les
  // quarts/audits sans aucun écart à consolider), puis applique les
  // filtres demandés (§12 du cadrage).
  // ------------------------------------------------------------
  async function chargerEcartsConsolides(client, siteId, filtres) {
    const [empRes, auditsRes, shiftsRes] = await Promise.all([
      client.from('employees').select('id, nom').eq('site_id', siteId),
      client.from('audits_caisse').select('*').eq('site', siteId),
      client.from('fdj_shifts').select('*, fdj_cash_controls(*)').eq('site', siteId),
    ]);
    if (empRes.error) throw empRes.error;
    if (auditsRes.error) throw auditsRes.error;
    if (shiftsRes.error) throw shiftsRes.error;

    const nomParEmploye = {};
    (empRes.data || []).forEach(e => { nomParEmploye[e.id] = e.nom; });

    const lignes = [
      ...normaliserAuditsVerify(auditsRes.data || [], nomParEmploye),
      ...normaliserControlesFdj(shiftsRes.data || [], nomParEmploye),
    ];

    return appliquerFiltresEcarts(lignes, filtres);
  }

  // ------------------------------------------------------------
  // NORMALISATION VERIFY — un audit peut produire jusqu'à 2 lignes
  // (piste, boutique), chacune sa propre situation. `ecart_{type}_valide`
  // (posé par le manager) prévaut sur `ecart_{type}` (calcul brut) tant
  // que non validé — c'est le même "écart définitif par défaut" que
  // renderFormValidationCaisse affiche à l'écran (Article 11).
  // ------------------------------------------------------------
  function normaliserAuditsVerify(audits, nomParEmploye) {
    if (!global.NexusEcartsMoteur) return [];
    const lignes = [];
    audits.forEach(a => {
      ['piste', 'boutique'].forEach(type => {
        const ecartBrut = a[`ecart_${type}`];
        if (ecartBrut === null || ecartBrut === undefined) return; // composante inexistante sur ce quart
        const ecartFinal = a[`ecart_${type}_valide`] != null ? Number(a[`ecart_${type}_valide`]) : Number(ecartBrut);
        const ecartInitial = a[`ecart_${type}_origine`] != null ? Number(a[`ecart_${type}_origine`]) : null;
        const cloture = !!a[`valide_le_${type}`];
        const causeCode = a[`cause_code_${type}`] || null;
        const causeConnue = !!causeCode && causeCode !== 'non_explique';
        const statut = global.NexusEcartsMoteur.deriverStatutEcart({ ecartInitial, ecartFinal, cloture, causeConnue });
        if (!statut) return;
        lignes.push({
          id: `verify-${a.id}-${type}`,
          sourceModule: 'verify',
          sourceControlId: a.id,
          date: a.date,
          quart: a.quart,
          employeeId: a.employee_id || null,
          employeeNom: a.employee_id ? (nomParEmploye[a.employee_id] || null) : null,
          activite: type,
          ecartInitial, ecartFinal,
          causeCode,
          statut,
          resolvedAt: a[`valide_le_${type}`] || null,
          resolvedBy: a[`valide_par_${type}`] || null,
          deepLink: `NEXUS-Verify-v1.html?ouvrir_date=${a.date}&ouvrir_quart=${a.quart}`,
        });
      });
    });
    return lignes;
  }

  // ------------------------------------------------------------
  // NORMALISATION FDJ — un quart (fdj_shifts + fdj_cash_controls joint)
  // produit au plus 1 ligne (activité 'fdj', pas de piste/boutique).
  // `resultat_controle` non vide = quart clôturé (verdict manager posé,
  // v2.266) ; `motif_ecart` porte le cause_code structuré (v2.267).
  // ------------------------------------------------------------
  function normaliserControlesFdj(shifts, nomParEmploye) {
    if (!global.NexusEcartsMoteur) return [];
    const lignes = [];
    shifts.forEach(s => {
      const cash = s.fdj_cash_controls;
      if (!cash) return;
      const ecartFinal = cash.ecart != null ? Number(cash.ecart) : null;
      if (ecartFinal === null) return;
      const ecartInitial = cash.ecart_origine != null ? Number(cash.ecart_origine) : null;
      const cloture = !!cash.resultat_controle;
      const causeCode = cash.motif_ecart || null;
      const causeConnue = !!causeCode && causeCode !== 'non_explique';
      const statut = global.NexusEcartsMoteur.deriverStatutEcart({ ecartInitial, ecartFinal, cloture, causeConnue });
      if (!statut) return;
      lignes.push({
        id: `fdj-${cash.id}`,
        sourceModule: 'fdj',
        sourceControlId: cash.id,
        date: s.date,
        quart: s.quart,
        employeeId: s.employee_id || null,
        employeeNom: s.employee_id ? (nomParEmploye[s.employee_id] || null) : null,
        activite: 'fdj',
        ecartInitial, ecartFinal,
        causeCode,
        statut,
        resolvedAt: cash.valide_le || null,
        resolvedBy: cash.valide_par || null,
        deepLink: `NEXUS-FDJ-Manager-v1.html?date=${s.date}&quart=${s.quart}`,
      });
    });
    return lignes;
  }

  // ------------------------------------------------------------
  // FILTRES — §12 du cadrage : Période / Quart / Employé / Activité /
  // Signe / Statut / Cause, combinables. "Impact PAYE" explicitement HORS
  // SCOPE (P0) : NEXUS Paye n'existe pas encore, aucune donnée à filtrer.
  // Fonction PURE (aucun accès réseau) — testable indépendamment de
  // chargerEcartsConsolides.
  // ------------------------------------------------------------
  function appliquerFiltresEcarts(lignes, filtres) {
    const f = filtres || {};
    return (lignes || []).filter(l => {
      if (f.dateDebut && l.date < f.dateDebut) return false;
      if (f.dateFin && l.date > f.dateFin) return false;
      if (f.quart && String(l.quart) !== String(f.quart)) return false;
      if (f.employeeId && l.employeeId !== f.employeeId) return false;
      if (f.activite && l.activite !== f.activite) return false;
      if (f.sourceModule && l.sourceModule !== f.sourceModule) return false;
      if (f.signe === 'positif' && !(l.ecartFinal > 0)) return false;
      if (f.signe === 'negatif' && !(l.ecartFinal < 0)) return false;
      if (f.statut && l.statut !== f.statut) return false;
      if (f.causeCode && l.causeCode !== f.causeCode) return false;
      return true;
    });
  }

  global.NexusEcartsDonnees = {
    chargerEcartsConsolides,
    appliquerFiltresEcarts,
    // Exposées séparément pour les tests (fonctions pures, aucun accès
    // réseau) — évite d'avoir à mocker Supabase pour vérifier la
    // normalisation elle-même (Article 11 : une seule implémentation
    // testée directement, pas recopiée dans le test).
    normaliserAuditsVerify,
    normaliserControlesFdj,
  };
})(typeof window !== 'undefined' ? window : globalThis);
