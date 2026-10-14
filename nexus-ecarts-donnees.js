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
//     employeeId, employeeNom, employeeRole, activite ('piste'|'boutique'|'fdj'),
//     ecartInitial, ecartFinal, causeCode, statut, montantRetenu, impactPaye,
//     activiteInhabituelle, qualification, resolvedAt, resolvedBy, deepLink }
// — mêmes noms que §13 du cadrage (adaptés camelCase JS).
//
// v2.269 (28/08/2026, retour de Frédéric après test réel du P0) : §8 du
// retour demande de "prévoir" (pas construire) 3 niveaux distincts dans la
// donnée — écart initial (constaté), écart final/montantRetenu (traitement
// retenu), impact PAYE (qualification future explicite). `impactPaye` est
// donc posé ici en toutes lettres à `null` (jamais déduit du signe/montant
// d'un écart — règle absolue du cadrage, "Écart de caisse ≠ dette employé
// ≠ retenue sur paie") : c'est une place réservée pour NEXUS Paye (P2),
// aucun code ne le calcule ni ne l'affiche dans ce lot.
//
// Dépend de nexus-ecarts-moteur.js (deriverStatutEcart, arrondiCentimes,
// calculerMontantRetenuLigne, roleCaisseInhabituelle) — DOIT être chargé
// avant ce fichier :
//   <script src="nexus-ecarts-moteur.js?v=20260904-0104"></script>
//   <script src="nexus-ecarts-donnees.js?v=20260904-0104"></script>
// ------------------------------------------------------------

(function (global) {
  // ------------------------------------------------------------
  // chargerEcartsConsolides(client, siteId, filtres) — lit les tables
  // réelles, normalise chaque composante en ligne d'écart, ne retient QUE
  // les lignes où deriverStatutEcart a produit un statut réel (jamais les
  // quarts/audits sans aucun écart à consolider), rattache les
  // qualifications manuelles déjà posées (v2.269), puis applique les
  // filtres demandés (§12 du cadrage).
  // ------------------------------------------------------------
  async function chargerEcartsConsolides(client, siteId, filtres) {
    const [empRes, auditsRes, shiftsRes, qualifsRes] = await Promise.all([
      client.from('employees').select('id, nom, role').eq('site_id', siteId),
      client.from('audits_caisse').select('*').eq('site', siteId),
      client.from('fdj_shifts').select('*, fdj_cash_controls(*)').eq('site', siteId),
      client.from('nexus_ecarts_qualifications').select('*').eq('site', siteId),
    ]);
    if (empRes.error) throw empRes.error;
    if (auditsRes.error) throw auditsRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (qualifsRes.error) throw qualifsRes.error;

    const nomParEmploye = {};
    const roleParEmploye = {};
    (empRes.data || []).forEach(e => { nomParEmploye[e.id] = e.nom; roleParEmploye[e.id] = e.role || null; });

    const qualifParCle = {};
    (qualifsRes.data || []).forEach(q => {
      qualifParCle[`${q.source_module}-${q.source_control_id}-${q.activite}-${q.type_qualification}`] = q;
    });

    const lignes = [
      ...normaliserAuditsVerify(auditsRes.data || [], nomParEmploye, roleParEmploye),
      ...normaliserControlesFdj(shiftsRes.data || [], nomParEmploye, roleParEmploye),
    ];
    lignes.forEach(l => {
      l.qualification = qualifParCle[`${l.sourceModule}-${l.sourceControlId}-${l.activite}-activite_inhabituelle`] || null;
      // PAYE lit cette qualification sans recalculer ni recopier l'écart.
      // Une contestation ouverte ou en réexamen bloque toujours la transmission.
      l.contestation = qualifParCle[`${l.sourceModule}-${l.sourceControlId}-${l.activite}-contestation`] || null;
    });

    return appliquerFiltresEcarts(lignes, filtres);
  }

  // Ajoute les champs dérivés communs à toute ligne DÉJÀ normalisée (écarts
  // arrondis, statut posé) — évite de dupliquer 3 fois (activité
  // inhabituelle, montant retenu, place réservée PAYE) entre Verify et FDJ
  // (Article 11).
  //
  // v2.270 — CORRECTIF (données réelles, 28/08/2026) : "activité
  // inhabituelle" (§5/§6 du retour de Frédéric) ne s'applique QU'à FDJ, pas
  // à Verify. NEXUS Verify est structurellement réservé aux managers/gérants
  // (cf. le contrôle de rôle explicite à l'ouverture de NEXUS-Verify-v1.html
  // : "réservé aux managers et gérants") — un manager qui réalise un audit
  // de caisse Piste/Boutique y fait donc son travail normal, jamais une
  // activité inhabituelle. En production, 100% des 83 audits_caisse de
  // vito-sainte-marie sont rattachés à un employé de rôle 'manager' : sans
  // ce correctif, le "Contrôle de cohérence" (§12) et la vue "Par employé"
  // signalaient FAUSSEMENT chaque audit routinier de Frédéric comme une
  // anomalie à qualifier — un faux signal permanent, potentiellement la
  // cause de la confusion "je n'arrive plus à ouvrir NEXUS" si l'écran
  // semblait noyé sous des alertes. Sur FDJ en revanche (caisse normalement
  // tenue par des non-managers), un manager/gérant qui apparaît reste
  // effectivement un signal légitime (aucun manager/gérant présent dans les
  // fdj_shifts réels de vito-sainte-marie à ce jour — règle non encore
  // observée en production, mais correcte par construction).
  function finaliserLigne(ligne) {
    const M = global.NexusEcartsMoteur;
    ligne.impactPaye = null;
    ligne.montantRetenu = M.calculerMontantRetenuLigne(ligne);
    ligne.activiteInhabituelle = ligne.sourceModule === 'fdj' && M.roleCaisseInhabituelle(ligne.employeeRole);
    return ligne;
  }

  // ------------------------------------------------------------
  // NORMALISATION VERIFY — un audit peut produire jusqu'à 2 lignes
  // (piste, boutique), chacune sa propre situation. `ecart_{type}_valide`
  // (posé par le manager) prévaut sur `ecart_{type}` (calcul brut) tant
  // que non validé — c'est le même "écart définitif par défaut" que
  // renderFormValidationCaisse affiche à l'écran (Article 11).
  // ------------------------------------------------------------
  function normaliserAuditsVerify(audits, nomParEmploye, roleParEmploye) {
    const M = global.NexusEcartsMoteur;
    if (!M) return [];
    const lignes = [];
    audits.forEach(a => {
      ['piste', 'boutique'].forEach(type => {
        const ecartBrut = a[`ecart_${type}`];
        if (ecartBrut === null || ecartBrut === undefined) return; // composante inexistante sur ce quart
        // v2.269 — arrondi aux centimes DÈS la normalisation (jamais un
        // flottant du type 0.0000000001 qui échapperait au test `=== 0`
        // de situationVerificationEcart, cause réelle d'un "+0,00 €"
        // observé à tort dans "À vérifier").
        const ecartFinal = M.arrondiCentimes(a[`ecart_${type}_valide`] != null ? Number(a[`ecart_${type}_valide`]) : Number(ecartBrut));
        const ecartInitial = a[`ecart_${type}_origine`] != null ? M.arrondiCentimes(Number(a[`ecart_${type}_origine`])) : null;
        const cloture = !!a[`valide_le_${type}`];
        const causeCode = a[`cause_code_${type}`] || null;
        const causeConnue = !!causeCode && causeCode !== 'non_explique';
        const statut = M.deriverStatutEcart({ ecartInitial, ecartFinal, cloture, causeConnue });
        if (!statut) return;
        // v2.285 (P0) — l'employé attribué à CETTE ligne est celui de LA
        // CAISSE concernée (employes_piste/employes_boutique), jamais
        // a.employee_id (l'auteur/manager de l'audit — voir le commentaire
        // détaillé de resoudreEmployeCaisseVerify dans nexus-ecarts-moteur.js).
        const attribCaisse = M.resoudreEmployeCaisseVerify(a[`employes_${type}`], nomParEmploye, roleParEmploye);
        lignes.push(finaliserLigne({
          id: `verify-${a.id}-${type}`,
          sourceModule: 'verify',
          sourceControlId: a.id,
          date: a.date,
          quart: a.quart,
          employeeId: attribCaisse.employeeId,
          employeeNom: attribCaisse.employeeNom,
          employeeRole: attribCaisse.employeeRole,
          activite: type,
          ecartInitial, ecartFinal,
          causeCode,
          statut,
          resolvedAt: a[`valide_le_${type}`] || null,
          resolvedBy: a[`valide_par_${type}`] || null,
          deepLink: `NEXUS-Verify-v1.html?ouvrir_date=${a.date}&ouvrir_quart=${a.quart}`,
        }));
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
  function normaliserControlesFdj(shifts, nomParEmploye, roleParEmploye) {
    const M = global.NexusEcartsMoteur;
    if (!M) return [];
    const lignes = [];
    shifts.forEach(s => {
      const cash = s.fdj_cash_controls;
      if (!cash) return;
      const ecartFinal = cash.ecart != null ? M.arrondiCentimes(Number(cash.ecart)) : null;
      if (ecartFinal === null) return;
      const ecartInitial = cash.ecart_origine != null ? M.arrondiCentimes(Number(cash.ecart_origine)) : null;
      const cloture = !!cash.resultat_controle;
      const causeCode = cash.motif_ecart || null;
      const causeConnue = !!causeCode && causeCode !== 'non_explique';
      const statut = M.deriverStatutEcart({ ecartInitial, ecartFinal, cloture, causeConnue });
      if (!statut) return;
      lignes.push(finaliserLigne({
        id: `fdj-${cash.id}`,
        sourceModule: 'fdj',
        sourceControlId: cash.id,
        date: s.date,
        quart: s.quart,
        employeeId: s.employee_id || null,
        employeeNom: s.employee_id ? (nomParEmploye[s.employee_id] || null) : null,
        employeeRole: s.employee_id ? ((roleParEmploye || {})[s.employee_id] || null) : null,
        activite: 'fdj',
        ecartInitial, ecartFinal,
        causeCode,
        statut,
        resolvedAt: cash.valide_le || null,
        resolvedBy: cash.valide_par || null,
        deepLink: `NEXUS-FDJ-Manager-v1.html?date=${s.date}&quart=${s.quart}`,
      }));
    });
    return lignes;
  }

  // ------------------------------------------------------------
  // QUALIFICATIONS — v2.269 (28/08/2026, §6 du retour de Frédéric).
  // `nexus_ecarts_qualifications` : table générique, un seul type écrit
  // aujourd'hui ('activite_inhabituelle'), pensée pour que d'autres
  // contrôles de cohérence futurs (§12) puissent la réutiliser sans
  // nouvelle migration. `enregistrerQualification` upsert sur la clé
  // unique (source_module, source_control_id, activite, type) — qualifier
  // à nouveau une même situation REMPLACE la qualification précédente,
  // jamais un doublon.
  // ------------------------------------------------------------
  async function enregistrerQualificationActiviteInhabituelle(client, { site, sourceModule, sourceControlId, activite, motif, note, qualifiePar }) {
    const { error } = await client.from('nexus_ecarts_qualifications').upsert({
      site, source_module: sourceModule, source_control_id: sourceControlId, activite,
      type_qualification: 'activite_inhabituelle',
      motif, note: note || null, qualifie_par: qualifiePar || null, qualifie_le: new Date().toISOString(),
    }, { onConflict: 'source_module,source_control_id,activite,type_qualification' });
    if (error) throw error;
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

  // ------------------------------------------------------------
  // PÉRIODE D'ANALYSE (14/10/2026) — par défaut le mois civil courant,
  // du 1er au jour d'aujourd'hui, au fuseau de la station (jamais celui de
  // l'appareil). L'historique complet n'est servi que sur choix explicite.
  // Fonctions pures : le jour courant est TOUJOURS passé par l'appelant.
  // ------------------------------------------------------------
  const FUSEAU_PAR_DEFAUT = 'America/Martinique';
  const MODES_PERIODE = ['mois', 'precedent', 'perso', 'tout'];

  function jourDeLaStation(instant, fuseau) {
    const d = instant instanceof Date ? instant : new Date(instant);
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau || FUSEAU_PAR_DEFAUT, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
    return `${p.year}-${p.month}-${p.day}`;
  }
  function dernierJourDuMois(annee, mois) {
    return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  }
  const deuxChiffres = n => String(n).padStart(2, '0');

  // aujourdhui : 'AAAA-MM-JJ' (jour de la station). Retourne { mode, dateDebut, dateFin }.
  function bornesDePeriode(mode, aujourdhui, perso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(aujourdhui || '')) throw new TypeError('bornesDePeriode : jour de la station obligatoire (AAAA-MM-JJ).');
    const annee = Number(aujourdhui.slice(0, 4)), mois = Number(aujourdhui.slice(5, 7));
    if (mode === 'tout') return { mode, dateDebut: '', dateFin: '' };
    if (mode === 'perso') {
      const p = perso || {};
      return { mode, dateDebut: p.dateDebut || '', dateFin: p.dateFin || '' };
    }
    if (mode === 'precedent') {
      const a = mois === 1 ? annee - 1 : annee, m = mois === 1 ? 12 : mois - 1;
      return { mode, dateDebut: `${a}-${deuxChiffres(m)}-01`, dateFin: `${a}-${deuxChiffres(m)}-${deuxChiffres(dernierJourDuMois(a, m))}` };
    }
    return { mode: 'mois', dateDebut: `${annee}-${deuxChiffres(mois)}-01`, dateFin: aujourdhui };
  }

  // Détermine la période d'ouverture. Priorité : `periode` de l'URL, puis des
  // dates explicites d'une URL ancienne (période personnalisée), puis le choix
  // mémorisé de la session, puis le mois courant. Jamais l'historique par défaut.
  function resoudrePeriode(params, aujourdhui, memorise) {
    const p = params || {};
    const mode = MODES_PERIODE.indexOf(p.periode) !== -1 ? p.periode : '';
    if (mode === 'perso' || (!mode && (p.dateDebut || p.dateFin))) {
      return bornesDePeriode('perso', aujourdhui, { dateDebut: p.dateDebut, dateFin: p.dateFin });
    }
    if (mode) return bornesDePeriode(mode, aujourdhui);
    const m = memorise || {};
    if (MODES_PERIODE.indexOf(m.mode) !== -1) {
      return bornesDePeriode(m.mode, aujourdhui, m);
    }
    return bornesDePeriode('mois', aujourdhui);
  }

  const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function jourFr(iso) { return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`; }
  function libellePeriode(per) {
    if (per.mode === 'tout' || (!per.dateDebut && !per.dateFin)) return 'Tout l\u2019historique — depuis l\u2019origine des modules';
    if (per.dateDebut && per.dateFin) {
      const nom = per.mode === 'mois' || per.mode === 'precedent'
        ? `${MOIS_FR[Number(per.dateDebut.slice(5, 7)) - 1]} ${per.dateDebut.slice(0, 4)} · ` : '';
      return `${nom}du ${jourFr(per.dateDebut)} au ${jourFr(per.dateFin)}`;
    }
    if (per.dateDebut) return `depuis le ${jourFr(per.dateDebut)}`;
    return `jusqu\u2019au ${jourFr(per.dateFin)}`;
  }

  // Bornes civiles d'un mois 'AAAA-MM-01' (ou 'AAAA-MM'), en chaînes pures :
  // aucun Date local, donc indépendant du fuseau de l'appareil (15/10/2026).
  function bornesDuMois(mois) {
    const m = /^(\d{4})-(\d{2})/.exec(String(mois || ''));
    if (!m) throw new TypeError('bornesDuMois : mois attendu au format AAAA-MM.');
    const a = Number(m[1]), n = Number(m[2]);
    return { dateDebut: `${m[1]}-${m[2]}-01`, dateFin: `${m[1]}-${m[2]}-${deuxChiffres(dernierJourDuMois(a, n))}` };
  }

  // Manques constatés mais pas encore validés (statut « à vérifier », écart
  // final négatif) : somme directe en centimes, jamais une différence entre
  // deux agrégats. Source unique pour Analyse des écarts et NEXUS Paye.
  function manquesNonValides(lignes) {
    let c = 0, nb = 0;
    (lignes || []).forEach(l => {
      if (l.statut === 'a_verifier' && l.ecartFinal != null && l.ecartFinal < 0) { c += Math.round(l.ecartFinal * 100); nb++; }
    });
    return { montant: c / 100, nb };
  }

  // Indicateurs d'une période : MÊME filtre (appliquerFiltresEcarts) et MÊMES
  // agrégats (calculerKpisEcarts) que la page Analyse des écarts. Paye l'appelle
  // avec les bornes du mois choisi ; aucune seconde définition comptable.
  function indicateursPeriode(lignes, filtres) {
    const M = global.NexusEcartsMoteur;
    if (!M) throw new Error('NexusEcartsMoteur absent : les indicateurs de période ne peuvent pas être calculés.');
    const retenues = appliquerFiltresEcarts(lignes, filtres);
    const k = M.calculerKpisEcarts(retenues);
    return { lignes: retenues, kpis: k, manquesValides: k.montantRetenu, soldeOperationnel: k.soldeOperationnel,
      nonValides: manquesNonValides(retenues) };
  }

  global.NexusEcartsDonnees = {
    bornesDuMois,
    manquesNonValides,
    indicateursPeriode,
    jourDeLaStation,
    bornesDePeriode,
    resoudrePeriode,
    libellePeriode,
    MODES_PERIODE,
    FUSEAU_PAR_DEFAUT,
    chargerEcartsConsolides,
    appliquerFiltresEcarts,
    enregistrerQualificationActiviteInhabituelle,
    // Exposées séparément pour les tests (fonctions pures, aucun accès
    // réseau) — évite d'avoir à mocker Supabase pour vérifier la
    // normalisation elle-même (Article 11 : une seule implémentation
    // testée directement, pas recopiée dans le test).
    normaliserAuditsVerify,
    normaliserControlesFdj,
  };
})(typeof window !== 'undefined' ? window : globalThis);
