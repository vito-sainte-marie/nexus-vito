// NEXUS COACH x FDJ PILOTAGE — moteur de règles (09/08/2026)
//
// Étape 1 de l'audit "NEXUS Coach x FDJ Pilotage" (§27 : schéma + règles
// V1) — le catalogue de règles vit dans public.coach_rules (voir migration
// coach_fdj_schema_v1), la DÉTECTION vit ici, comme le prescrit l'audit
// §2 : "La détection ne doit pas vivre dans Coach. Elle doit vivre dans le
// moteur FDJ Pilotage, afin de préserver une seule vérité." Ce fichier est
// donc le pendant "coaching" de nexus-fdj-moteur.js : mêmes principes
// (Article 11 de la Constitution NEXUS — fonctions pures, aucune donnée
// Supabase lue ici, tout est fourni par l'appelant), mais il choisit un
// GESTE plutôt qu'un ensemble de signaux (Brief/FDJ-Analyse en montrent
// plusieurs, Coach n'en retient qu'un seul par employé et par jour —
// §2/§26 de l'audit).
//
// Architecture V1 sans IA générative (audit §18) : moteur de règles ->
// clé de conseil (rule_id) -> bibliothèque de formulations validées
// (FORMULATIONS ci-dessous) -> conseil affiché. Le branchement aux
// données réelles (fdj_shifts, fdj_shift_counts, fdj_stock_movements,
// vues Phase B...) et les écrans (employé/manager/Brief) sont les étapes
// suivantes de l'audit (§27, items 10 à 14), pas celle-ci.
//
// Aucune dépendance DOM/Supabase — pures fonctions de calcul.
// Inclure : <script src="nexus-coach-fdj-moteur.js?v=20260904-0104"></script>
// ------------------------------------------------------------

(function (global) {
  // ------------------------------------------------------------
  // BIBLIOTHÈQUE DE FORMULATIONS — audit §19 : plusieurs variantes par
  // règle pour éviter la monotonie, même sens métier. `pourquoi` peut être
  // un texte fixe ou une fonction (evidenceCount, evidence) => texte,
  // pour rester factuelle sur CE cas précis plutôt qu'un texte générique.
  // Ton imposé par l'audit §8 : « Votre axe du jour… », « Pour sécuriser
  // votre quart… », « Votre prochain levier… », « Une opportunité
  // aujourd'hui… », « NEXUS vous recommande de vérifier… » — jamais un
  // jugement sur la personne (§23/§29).
  // ------------------------------------------------------------
  const FORMULATIONS = {
    fdj_activation_chain: {
      variantes: [
        "Avant d’activer, vérifiez que le carnet est bien enregistré en caisse.",
        "Sécurisez votre activation : le carnet doit d’abord être présent dans le stock caisse.",
      ],
      pourquoi: (n) => `NEXUS a relevé ${n > 1 ? `${n} activations sans transfert enregistré` : 'une activation sans transfert enregistré'} sur un quart récent.`,
    },
    fdj_report_missing: {
      variantes: [
        "Avant votre départ, vérifiez qu’un rapport FDJ récent reste bien à finaliser.",
        "Pour sécuriser votre quart : un rapport FDJ récent n’a pas encore été clôturé.",
      ],
      pourquoi: () => "Un quart récent reste en brouillon, sans clôture enregistrée.",
    },
    fdj_report_late: {
      variantes: [
        "Avant votre départ, vérifiez que le rapport FDJ est bien enregistré à l’heure.",
        "Clôturez votre quart avec un rapport FDJ complet avant de quitter le poste.",
      ],
      pourquoi: (n, ev) => `Sur vos ${ev && ev.mesures} derniers quarts mesurés, ${ev && ev.enRetard} rapport${ev && ev.enRetard > 1 ? 's' : ''} FDJ ${ev && ev.enRetard > 1 ? 'ont' : 'a'} été enregistré${ev && ev.enRetard > 1 ? 's' : ''} en retard.`,
    },
    fdj_correction_recurrente: {
      variantes: [
        "Aujourd’hui, prenez un instant de plus pour vérifier vos comptages avant de les valider.",
        "Votre axe du jour : fiabiliser le comptage avant validation, pour limiter les corrections.",
      ],
      pourquoi: (n, ev) => `Une correction de comptage a été nécessaire sur ${ev && ev.quartsAvecCorrection} de vos ${ev && ev.nbShifts} derniers quarts.`,
    },
    fdj_stock_rupture_risk: {
      variantes: [
        "Demandez un réapprovisionnement au manager avant la rupture sur ce jeu.",
        "NEXUS vous recommande de vérifier le stock caisse de ce jeu dès le début du quart.",
      ],
      pourquoi: (n, ev) => `${ev && ev.jeu} : plus de carnet disponible en caisse${ev && ev.bureauAussi ? ', ni au bureau' : ''}.`,
    },
    fdj_stock_reserve_faible: {
      variantes: [
        "Anticipez sans surcharger : le stock de ce jeu commence à baisser, à surveiller aujourd’hui.",
        "Votre prochain levier : garder un œil sur ce jeu avant qu’il ne soit épuisé.",
      ],
      pourquoi: (n, ev) => `${ev && ev.jeu} : il ne reste plus qu’un carnet non activé, et peu de réserve au bureau.`,
    },
    fdj_regularite_levier: {
      variantes: [
        "Votre rigueur est solide ; concentrez-vous aujourd’hui sur la proposition commerciale.",
        "Votre prochain levier : passer d’une rigueur déjà acquise à la proposition active en caisse.",
      ],
      pourquoi: (n, ev) => `Vos contrôles sont conformes sur ${ev && Math.round((ev.taux || 0) * 100)} % de vos ${ev && ev.nbQuarts} derniers quarts mesurés.`,
    },
    fdj_palier_sous_represente: {
      variantes: [
        "Aujourd’hui, pensez à proposer ce palier aux clients qui hésitent sur le montant.",
        "Une opportunité aujourd’hui : ce palier est moins présent chez vous que sur le reste du site.",
      ],
      pourquoi: (n, ev) => `Le palier ${ev && ev.prix} € représente ${ev && Math.round((ev.partEmploye || 0) * 100)} % de vos ventes, contre ${ev && Math.round((ev.partSite || 0) * 100)} % pour le site.`,
    },
    fdj_jour_faible: {
      variantes: [
        "Aujourd’hui est historiquement un jour plus calme pour vous : une micro-action commerciale peut aider.",
        "Votre axe du jour : ce jour est habituellement en retrait pour vous, une proposition simple peut faire la différence.",
      ],
      pourquoi: (n, ev) => `Sur vos ${ev && ev.nbOcc} dernières occurrences de ce jour, votre CA moyen est inférieur à votre moyenne habituelle.`,
    },
    fdj_jour_fort: {
      variantes: [
        "Aujourd’hui est historiquement un jour fort pour vous : préparez votre stock avant l’affluence.",
        "Votre axe du jour : ce jour est habituellement porteur, assurez-vous d’avoir tout le nécessaire à portée.",
      ],
      pourquoi: (n, ev) => `Sur vos ${ev && ev.nbOcc} dernières occurrences de ce jour, votre CA moyen dépasse votre moyenne habituelle.`,
    },
    fdj_relation_client_opportunite: {
      variantes: [
        "Une opportunité aujourd’hui : jour habituellement actif, pensez à proposer un jeu à petit montant aux clients hésitants.",
        "NEXUS vous recommande de vérifier vos petits montants disponibles avant l’affluence attendue aujourd’hui.",
      ],
      pourquoi: () => "Jour historiquement actif sur le site, et le stock du plus petit palier est disponible.",
    },
    fdj_conseil_general: {
      variantes: [
        "Rappel du jour : vérifiez qu’un carnet est bien transféré en caisse avant toute activation.",
        "Rappel du jour : un rapport FDJ complet à la clôture évite les écarts à expliquer plus tard.",
      ],
      pourquoi: () => "Aucune priorité personnalisée suffisamment fiable aujourd’hui — conseil de procédure générale.",
    },
  };

  // Familles de règles — audit §4/§12 : la synthèse manager ("Priorités
  // sécurité vs vente vs rigueur") regroupe les 12 règles en quelques
  // familles lisibles plutôt que d'énumérer des rule_id. Donnée pure,
  // partagée entre l'onglet Conseiller de NEXUS-FDJ-Analyse-v1.html (seul
  // consommateur aujourd'hui) et tout futur écran qui en aurait besoin
  // (Brief notamment) — une seule classification, jamais redéfinie.
  const FAMILLE_PAR_REGLE = {
    fdj_activation_chain: 'securite',
    fdj_report_missing: 'rigueur',
    fdj_report_late: 'rigueur',
    fdj_correction_recurrente: 'rigueur',
    fdj_stock_rupture_risk: 'stock',
    fdj_stock_reserve_faible: 'stock',
    fdj_regularite_levier: 'progression',
    fdj_palier_sous_represente: 'vente',
    fdj_jour_faible: 'vente',
    fdj_jour_fort: 'vente',
    fdj_relation_client_opportunite: 'vente',
    fdj_conseil_general: 'general',
  };
  const FAMILLE_LABEL = {
    securite: 'Sécurité / conformité', rigueur: 'Rigueur de saisie', stock: 'Stock',
    progression: 'Progression', vente: 'Vente', general: 'Général',
  };
  // Libellés courts par règle — présentation uniquement (jamais une
  // formule), partagés entre l'onglet Conseiller de NEXUS-FDJ-Analyse-v1
  // (section Coaching équipe) et calculerCandidatsCoachEquipe ci-dessous,
  // pour ne jamais avoir deux intitulés différents pour la même règle.
  const LABEL_REGLE_COACH = {
    fdj_activation_chain: 'Chaîne d’activation à sécuriser', fdj_report_missing: 'Rapports FDJ manquants',
    fdj_report_late: 'Rapports FDJ tardifs', fdj_correction_recurrente: 'Corrections de comptage récurrentes',
    fdj_stock_rupture_risk: 'Risque de rupture de stock', fdj_stock_reserve_faible: 'Réserve de stock faible',
    fdj_regularite_levier: 'Rigueur acquise → levier commercial', fdj_palier_sous_represente: 'Palier sous-représenté',
    fdj_jour_faible: 'Jour habituellement faible', fdj_jour_fort: 'Jour habituellement fort',
    fdj_relation_client_opportunite: 'Opportunité de proposition simple', fdj_conseil_general: 'Conseil général de procédure',
  };

  // Hachage simple et stable (pas de dépendance à Math.random) — sert
  // uniquement à choisir une variante de formulation de façon
  // déterministe par employé/jour/règle : stable pendant la journée
  // (§3 de l'audit : "le conseil reste stable pendant la journée"), mais
  // change d'un jour à l'autre.
  function hacherTexte(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  // Construit le message final + la raison pour un candidat retenu.
  // `seedKey` : clé stable pour la journée (ex. `${employeeId}|${date}`).
  function construireMessageCoach(candidat, seedKey) {
    const lib = FORMULATIONS[candidat.rule_id];
    if (!lib) return null;
    const variantes = lib.variantes || [];
    if (!variantes.length) return null;
    const idx = hacherTexte(`${seedKey}|${candidat.rule_id}`) % variantes.length;
    const message = variantes[idx];
    const reason = typeof lib.pourquoi === 'function' ? lib.pourquoi(candidat.evidenceCount, candidat.evidence) : (lib.pourquoi || null);
    return { message, reason };
  }

  // ------------------------------------------------------------
  // DÉTECTEURS — 11 règles personnalisées (+ le conseil général en
  // fallback, géré à part dans selectionnerRecommandationCoach). Chacune
  // retourne soit null (la condition n'est pas réunie ou l'échantillon est
  // insuffisant — §7 : "vérité avant certitude", jamais une conclusion
  // sur un échantillon trop court), soit un candidat
  // { rule_id, priority, confidence, evidence, evidenceCount }.
  // `regle` = ligne correspondante de coach_rules (priority, minimum_sample,
  // cooldown_days...).
  // ------------------------------------------------------------

  // Tier 1 — Risque de contrôle ou incohérence active.
  function detecterActivationChain(faits, regle) {
    const alertes = (faits.alertesActivationRecentes || []);
    if (!alertes.length) return null;
    return {
      rule_id: 'fdj_activation_chain', priority: regle.priority, confidence: 'Élevée',
      evidence: { nb: alertes.length, dates: alertes.map(a => a.created_at) }, evidenceCount: alertes.length,
    };
  }

  // Tier 2 — Action obligatoire / procédure sensible : clôture manquante.
  function detecterRapportManquant(faits, regle) {
    const incomplets = (faits.shiftsIncomplets || []);
    if (!incomplets.length) return null;
    return {
      rule_id: 'fdj_report_missing', priority: regle.priority, confidence: 'Élevée',
      evidence: { nb: incomplets.length }, evidenceCount: incomplets.length,
    };
  }

  // Tier 2 — Rapport souvent saisi tardivement (nécessite un historique
  // suffisant de quarts avec une mesure de retard de clôture exploitable).
  function detecterRapportTardif(faits, regle) {
    const mesures = (faits.shiftsRecents || []).filter(s => s.clotureRetardMin != null);
    if (!regle.minimum_sample || mesures.length < regle.minimum_sample) return null;
    const enRetard = mesures.filter(s => s.clotureRetardMin > 0).length;
    if (enRetard / mesures.length < 0.5) return null;
    return {
      rule_id: 'fdj_report_late', priority: regle.priority, confidence: 'Moyenne',
      evidence: { mesures: mesures.length, enRetard }, evidenceCount: enRetard,
    };
  }

  // Tier 2 — Corrections de comptage récurrentes (échantillon suffisant).
  function detecterCorrectionsRecurrentes(faits, regle) {
    const nbShifts = faits.nbShiftsHistorique || 0;
    if (!regle.minimum_sample || nbShifts < regle.minimum_sample) return null;
    const shiftsAvecCorrection = new Set((faits.correctionsRecentes || []).map(c => c.shift_id));
    if (nbShifts === 0 || shiftsAvecCorrection.size / nbShifts < 0.4) return null;
    return {
      rule_id: 'fdj_correction_recurrente', priority: regle.priority, confidence: 'Moyenne',
      evidence: { nbShifts, quartsAvecCorrection: shiftsAvecCorrection.size }, evidenceCount: shiftsAvecCorrection.size,
    };
  }

  // Tier 3 — Stock/activation susceptible de bloquer la vente (rupture).
  // Fait partagé au niveau du site (pas propre à l'employé) — pertinent
  // pour quiconque est en poste aujourd'hui, comme le prévoit la
  // hiérarchie de sélection §5.
  function detecterStockRuptureRisk(faits, regle) {
    const soldes = faits.soldes || {};
    const jeux = faits.jeux || [];
    const enRisque = jeux.find(j => { const s = soldes[j.id]; return s && s.nonActives <= 0; });
    if (!enRisque) return null;
    const s = soldes[enRisque.id];
    return {
      rule_id: 'fdj_stock_rupture_risk', priority: regle.priority, confidence: 'Élevée',
      evidence: { jeu: enRisque.nom, bureauAussi: s.bureau <= 0 }, evidenceCount: 1,
    };
  }

  // Tier 3 — Réserve non activée faible (anticiper avant la rupture,
  // distinct de la rupture déjà constatée ci-dessus).
  function detecterStockReserveFaible(faits, regle) {
    const soldes = faits.soldes || {};
    const jeux = faits.jeux || [];
    const presqueVide = jeux.find(j => { const s = soldes[j.id]; return s && s.nonActives > 0 && s.nonActives <= 1 && s.bureau <= 1; });
    if (!presqueVide) return null;
    return {
      rule_id: 'fdj_stock_reserve_faible', priority: regle.priority, confidence: 'Élevée',
      evidence: { jeu: presqueVide.nom }, evidenceCount: 1,
    };
  }

  // Tier 4 — Axe de progression individuel suffisamment documenté :
  // rigueur déjà acquise, passage vers un levier commercial.
  function detecterRegulariteLevier(faits, regle) {
    const nbQuarts = faits.nbQuartsControles || 0;
    if (!regle.minimum_sample || nbQuarts < regle.minimum_sample) return null;
    const taux = faits.tauxConformiteEmploye;
    if (taux == null || taux < 0.95) return null;
    return {
      rule_id: 'fdj_regularite_levier', priority: regle.priority, confidence: 'Moyenne',
      evidence: { taux, nbQuarts }, evidenceCount: nbQuarts,
    };
  }

  // Tier 5 — Opportunité commerciale : palier sous-représenté vs le site,
  // sur un échantillon suffisant.
  function detecterPalierSousRepresente(faits, regle) {
    const nbVentes = faits.nbVentesEmploye || 0;
    if (!regle.minimum_sample || nbVentes < regle.minimum_sample) return null;
    const partEmp = faits.partPalierEmploye || {};
    const partSite = faits.partPalierSite || {};
    let pire = null;
    Object.keys(partSite).forEach(prix => {
      const site = partSite[prix];
      const emp = partEmp[prix] || 0;
      if (site > 0 && emp / site < 0.6) {
        const ecart = site - emp;
        if (!pire || ecart > pire.ecart) pire = { prix, partEmploye: emp, partSite: site, ecart };
      }
    });
    if (!pire) return null;
    return {
      rule_id: 'fdj_palier_sous_represente', priority: regle.priority, confidence: 'Moyenne',
      evidence: pire, evidenceCount: nbVentes,
    };
  }

  // Seuils "jour faible"/"jour fort" — factorisés en une seule fonction
  // pure car réutilisés à deux niveaux : par employé (detecterJourFaible/
  // detecterJourFort ci-dessous) ET au niveau du site (jourFortSite,
  // calculé par le futur chargeur de données pour alimenter
  // detecterOpportuniteRelationClient) — une seule définition de "jour
  // fort", jamais deux seuils qui pourraient diverger (Article 11).
  // Retourne { suffisant, ratio, faible, fort }.
  function evaluerJour(perf, moyenneGenerale, minimumSample) {
    if (!perf || !minimumSample || perf.nbOcc < minimumSample) return { suffisant: false, ratio: null, faible: false, fort: false };
    if (moyenneGenerale == null || moyenneGenerale <= 0) return { suffisant: false, ratio: null, faible: false, fort: false };
    const ratio = perf.moyenneCa / moyenneGenerale;
    return { suffisant: true, ratio, faible: ratio <= 0.8, fort: ratio >= 1.2 };
  }

  // Tier 5 — Jour historiquement faible pour cet employé.
  function detecterJourFaible(faits, regle) {
    const perf = (faits.performanceJourEmploye || {})[faits.jourSemaineActuel];
    const ev = evaluerJour(perf, faits.moyenneGeneraleEmploye, regle.minimum_sample);
    if (!ev.suffisant || !ev.faible) return null;
    return {
      rule_id: 'fdj_jour_faible', priority: regle.priority, confidence: 'Moyenne',
      evidence: { nbOcc: perf.nbOcc, ratio: ev.ratio }, evidenceCount: perf.nbOcc,
    };
  }

  // Tier 5 — Jour historiquement fort pour cet employé.
  function detecterJourFort(faits, regle) {
    const perf = (faits.performanceJourEmploye || {})[faits.jourSemaineActuel];
    const ev = evaluerJour(perf, faits.moyenneGeneraleEmploye, regle.minimum_sample);
    if (!ev.suffisant || !ev.fort) return null;
    return {
      rule_id: 'fdj_jour_fort', priority: regle.priority, confidence: 'Moyenne',
      evidence: { nbOcc: perf.nbOcc, ratio: ev.ratio }, evidenceCount: perf.nbOcc,
    };
  }

  // Tier 5 — Relation client : proposition simple selon activité.
  // Volontairement restreinte à deux faits mesurés (jamais une intuition,
  // audit §29 : "inventer un motif à partir d'une corrélation" est
  // explicitement interdit) : le jour est historiquement actif AU NIVEAU
  // DU SITE (échantillon plus large, donc plus fiable qu'à l'échelle d'un
  // seul employé) ET le stock du plus petit palier est sain — proposer
  // n'a de sens que si NEXUS sait que le stock suit.
  function detecterOpportuniteRelationClient(faits, regle) {
    if (faits.jourFortSite !== true || faits.palierBasSain !== true) return null;
    return {
      rule_id: 'fdj_relation_client_opportunite', priority: regle.priority, confidence: 'Moyenne',
      evidence: {}, evidenceCount: null,
    };
  }

  // Chaque détecteur porte son rule_id en propriété statique — permet de
  // retrouver la config coach_rules AVANT de l'appeler (indispensable :
  // plusieurs détecteurs ont besoin de minimum_sample pour statuer, on ne
  // peut donc pas "sonder" le rule_id avec une config vide au préalable).
  detecterActivationChain.ruleId = 'fdj_activation_chain';
  detecterRapportManquant.ruleId = 'fdj_report_missing';
  detecterRapportTardif.ruleId = 'fdj_report_late';
  detecterCorrectionsRecurrentes.ruleId = 'fdj_correction_recurrente';
  detecterStockRuptureRisk.ruleId = 'fdj_stock_rupture_risk';
  detecterStockReserveFaible.ruleId = 'fdj_stock_reserve_faible';
  detecterRegulariteLevier.ruleId = 'fdj_regularite_levier';
  detecterPalierSousRepresente.ruleId = 'fdj_palier_sous_represente';
  detecterJourFaible.ruleId = 'fdj_jour_faible';
  detecterJourFort.ruleId = 'fdj_jour_fort';
  detecterOpportuniteRelationClient.ruleId = 'fdj_relation_client_opportunite';

  const DETECTEURS = [
    detecterActivationChain, detecterRapportManquant, detecterRapportTardif, detecterCorrectionsRecurrentes,
    detecterStockRuptureRisk, detecterStockReserveFaible, detecterRegulariteLevier,
    detecterPalierSousRepresente, detecterJourFaible, detecterJourFort, detecterOpportuniteRelationClient,
  ];

  // Exécute les 11 détecteurs personnalisés contre les faits fournis,
  // filtrés aux seules règles actives (coach_rules.active) transmises
  // dans `reglesParId` ({ [rule_id]: ligne coach_rules }).
  function evaluerReglesCoach(faits, reglesParId) {
    const candidats = [];
    DETECTEURS.forEach(detecteur => {
      const regle = reglesParId[detecteur.ruleId];
      if (!regle || regle.active === false) return;
      const candidat = detecteur(faits, regle);
      if (candidat) candidats.push(candidat);
    });
    return candidats;
  }

  // ------------------------------------------------------------
  // SÉLECTION — hiérarchie stricte §5 de l'audit : une seule
  // recommandation retenue, jamais un mélange (contrairement à
  // fusionnerEtSelectionner de nexus-conseiller.js qui, lui, sélectionne
  // plusieurs signaux pour Brief/FDJ-Analyse — Coach n'a droit qu'à un
  // seul geste par jour, §2/§26). Une règle de tier 1-2 (critique /
  // obligatoire) peut réapparaître dès le lendemain si la condition
  // persiste ; les autres respectent leur cooldown_days (anti-répétition
  // §9). `rotationRecente` = [{ rule_id, date }] des derniers jours pour
  // cet employé (le plus simple étant les lignes coach_daily_recommendations
  // déjà enregistrées).
  function estEnCooldown(candidat, regle, rotationRecente, aujourdHui) {
    if (regle.priority <= 2) return false; // critique/obligatoire : jamais bloqué si la condition persiste
    const seuil = new Date(aujourdHui + 'T00:00:00').getTime() - (regle.cooldown_days || 0) * 86400000;
    return (rotationRecente || []).some(r => r.rule_id === candidat.rule_id && new Date(r.date + 'T00:00:00').getTime() > seuil);
  }

  function selectionnerRecommandationCoach(candidats, reglesParId, options) {
    const opts = options || {};
    const aujourdHui = opts.aujourdHui || new Date().toISOString().slice(0, 10);
    const rotationRecente = opts.rotationRecente || [];
    const retenus = (candidats || []).filter(c => {
      const regle = reglesParId[c.rule_id];
      return regle && !estEnCooldown(c, regle, rotationRecente, aujourdHui);
    });
    retenus.sort((a, b) => a.priority - b.priority);
    if (retenus.length) return retenus[0];
    // Fallback — conseil général de procédure (§2, §6 dernière ligne de
    // la hiérarchie), toujours disponible, jamais bloqué par le cooldown.
    const regleGenerale = reglesParId.fdj_conseil_general;
    return { rule_id: 'fdj_conseil_general', priority: regleGenerale ? regleGenerale.priority : 6, confidence: null, evidence: {}, evidenceCount: null, general: true };
  }

  // Construit l'objet recommandation final (candidat retenu + message +
  // raison), prêt à être enregistré dans coach_daily_recommendations.
  function construireRecommandation(candidat, employeeId, aujourdHui) {
    const seedKey = `${employeeId}|${aujourdHui}`;
    const resolu = construireMessageCoach(candidat, seedKey);
    return {
      rule_id: candidat.rule_id, priority: candidat.priority, confidence: candidat.confidence || null,
      message: resolu ? resolu.message : null, reason: resolu ? resolu.reason : null,
      evidence_json: candidat.evidence || {}, general: !!candidat.general,
    };
  }

  // ------------------------------------------------------------
  // CANDIDATS COACH ÉQUIPE — étape "remontée Brief" (audit §27 item 13 /
  // §13) : "Brief ne doit pas devenir un duplicata de Coach. Il reçoit
  // uniquement les synthèses qui méritent une décision manager ou
  // dirigeant [...] Brief doit être alimenté par le même moteur de règles
  // de FDJ Pilotage, pas par une logique recodée dans Brief." D'où cette
  // fonction ICI (pas dans NEXUS-Brief-v1.html) : Brief se contente
  // d'appeler calculerCandidatsCoachEquipe() puis de normaliser son
  // résultat, exactement comme il le fait déjà pour calculerCandidatsFdj
  // (Phase D).
  //
  // Reprend le tableau situation → restitution de l'audit §13, à partir
  // des lignes déjà écrites dans coach_daily_recommendations (aucune règle
  // recalculée, uniquement un comptage/regroupement de décisions déjà
  // prises — même discipline que la section "Coaching équipe" de
  // NEXUS-FDJ-Analyse-v1.html) :
  //   - Tout est conforme                              -> aucune carte.
  //   - Risque de contrôle récurrent (sécurité/rigueur) -> carte rouge.
  //   - Même thème pour plusieurs employés              -> carte orange.
  //   - Amélioration nette (sécurité/rigueur en baisse)  -> carte verte.
  //
  // `donnees` = {
  //   actuel: [{employee_id, rule_id}] — coach_daily_recommendations de
  //     la période,
  //   comp: [{rule_id}] — coach_daily_recommendations de la période de
  //     comparaison (employee_id non nécessaire ici),
  //   labelPeriode / labelComp, periodeCle (voir calculerCandidatsFdj).
  // }
  // Seuils déclencheurs (10/08/2026, audit "Paramétrage autonome & multi-
  // site" §17 : "Seuils déclencheurs" doit être un paramètre de site, pas
  // une constante identique pour tous). Comme le reste de ce moteur
  // (Article 11 — aucune donnée Supabase lue ici), ces seuils sont
  // désormais un paramètre fourni par l'appelant plutôt que des constantes
  // figées : les valeurs ci-dessous ne servent plus que de repli si
  // l'appelant ne fournit rien (donc aucun changement de comportement pour
  // un site qui ne configure rien dans fdj_site_settings).
  const SEUILS_COACH_EQUIPE_DEFAUT = {
    risqueRecurrent: 3, // occurrences d'une même règle sécurité/rigueur sur la période
    axeEquipe: 3, // collaborateurs distincts concernés par la même règle
    progresBase: 3, // occurrences minimum en période de comparaison pour parler de progrès
    progresBaisse: 0.5, // baisse d'au moins 50 % pour parler d'amélioration nette
  };
  function calculerCandidatsCoachEquipe(donnees, seuils) {
    const d = donnees || {};
    const actuel = d.actuel || [];
    const comp = d.comp || [];
    const labelPeriode = d.labelPeriode || 'cette période';
    const labelComp = d.labelComp || 'la période précédente';
    const cle = d.periodeCle || 'periode';
    const s = Object.assign({}, SEUILS_COACH_EQUIPE_DEFAUT, seuils || {});
    const SEUIL_RISQUE_RECURRENT = s.risqueRecurrent;
    const SEUIL_AXE_EQUIPE = s.axeEquipe;
    const SEUIL_PROGRES_BASE = s.progresBase;
    const SEUIL_PROGRES_BAISSE = s.progresBaisse;
    const candidats = [];
    if (!actuel.length) return candidats; // "tout est conforme" (ou aucune donnée) -> aucune carte

    const parRegle = {}, employesParRegle = {};
    actuel.forEach(r => {
      parRegle[r.rule_id] = (parRegle[r.rule_id] || 0) + 1;
      (employesParRegle[r.rule_id] = employesParRegle[r.rule_id] || new Set()).add(r.employee_id);
    });
    const parFamilleActuel = {};
    actuel.forEach(r => { const f = FAMILLE_PAR_REGLE[r.rule_id] || 'general'; parFamilleActuel[f] = (parFamilleActuel[f] || 0) + 1; });
    const parFamilleComp = {};
    comp.forEach(r => { const f = FAMILLE_PAR_REGLE[r.rule_id] || 'general'; parFamilleComp[f] = (parFamilleComp[f] || 0) + 1; });

    // A) Risque de contrôle récurrent — carte rouge.
    let pireRisque = null;
    Object.entries(parRegle).forEach(([ruleId, n]) => {
      const famille = FAMILLE_PAR_REGLE[ruleId];
      if ((famille === 'securite' || famille === 'rigueur') && n >= SEUIL_RISQUE_RECURRENT) {
        if (!pireRisque || n > pireRisque.n) pireRisque = { ruleId, n };
      }
    });
    if (pireRisque) {
      const label = LABEL_REGLE_COACH[pireRisque.ruleId] || pireRisque.ruleId;
      candidats.push({
        id: `FDJ-COACH-RISQUE-${pireRisque.ruleId}-${cle}`,
        type: 'FDJ-COACH-RISQUE-RECURRENT', niveau: 'critique',
        titre: 'Risque de contrôle récurrent (Coach FDJ)',
        constat: `« ${label} » a été signalé ${pireRisque.n} fois par Coach FDJ sur ${labelPeriode} — un signal qui revient, pas un cas isolé.`,
        preuve: `Recommandations Coach FDJ générées automatiquement à partir des faits FDJ réels (mouvements de stock, rapports de quart).`,
        decision: `Vérifiez avec l'équipe pourquoi ce point revient aussi souvent.`,
        impactAttendu: "Cause structurelle identifiée avant qu'elle ne s'installe.",
        limites: "Un conseil Coach répété ne désigne pas automatiquement une seule personne en cause — plusieurs employés peuvent être concernés.",
        confiance: 'Élevée',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    }

    // B) Même thème pour plusieurs employés — carte orange (audit §13,
    // même exemple qu'en §12 : "4 collaborateurs concernés"). Écarte la
    // règle déjà retenue en A pour ne jamais publier deux cartes sur le
    // même fait.
    let theme = null;
    Object.entries(employesParRegle).forEach(([ruleId, set]) => {
      if (pireRisque && ruleId === pireRisque.ruleId) return;
      if (set.size >= SEUIL_AXE_EQUIPE && (!theme || set.size > theme.n)) theme = { ruleId, n: set.size };
    });
    if (theme) {
      const label = LABEL_REGLE_COACH[theme.ruleId] || theme.ruleId;
      const famille = FAMILLE_PAR_REGLE[theme.ruleId] || 'general';
      candidats.push({
        id: `FDJ-COACH-AXE-${theme.ruleId}-${cle}`,
        type: 'FDJ-COACH-AXE-EQUIPE', niveau: 'attention',
        titre: 'Axe équipe à travailler (Coach FDJ)',
        constat: `« ${label} » concerne ${theme.n} collaborateurs sur ${labelPeriode}.`,
        preuve: `Recommandations Coach FDJ générées automatiquement à partir des faits FDJ réels.`,
        decision: `Abordez ce point en équipe plutôt qu'individuellement — plusieurs collaborateurs sont concernés en même temps.`,
        impactAttendu: famille === 'vente' ? "Vente additionnelle mieux répartie sur l'équipe." : "Pratique harmonisée sur l'équipe.",
        limites: null, confiance: 'Élevée',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    }

    // C) Amélioration nette — carte verte. Scopée aux familles à risque
    // (sécurité/rigueur) : une baisse de leurs signaux est un progrès
    // mesurable, contrairement à une simple variation commerciale qui
    // mérite déjà sa propre lecture dans le Conseiller FDJ (Phase D).
    let progres = null;
    ['securite', 'rigueur'].forEach(famille => {
      const nComp = parFamilleComp[famille] || 0;
      const nActuel = parFamilleActuel[famille] || 0;
      if (nComp >= SEUIL_PROGRES_BASE && nActuel <= nComp * (1 - SEUIL_PROGRES_BAISSE)) {
        if (!progres || (nComp - nActuel) > (progres.nComp - progres.nActuel)) progres = { famille, nComp, nActuel };
      }
    });
    if (progres) {
      candidats.push({
        id: `FDJ-COACH-PROGRES-${progres.famille}-${cle}`,
        type: 'FDJ-COACH-PROGRES-EQUIPE', niveau: 'positif',
        titre: 'Progrès équipe (Coach FDJ)',
        constat: `Les signaux « ${FAMILLE_LABEL[progres.famille]} » sont passés de ${progres.nComp} à ${progres.nActuel} sur ${labelPeriode}, vs ${labelComp}.`,
        preuve: `Recommandations Coach FDJ générées automatiquement à partir des faits FDJ réels.`,
        decision: `Ce n'est pas nécessaire d'agir — c'est le moment de le reconnaître auprès de l'équipe.`,
        impactAttendu: "Dynamique positive maintenue si elle reste reconnue.",
        limites: "Comparaison sur une seule période — à confirmer si la baisse se maintient dans la durée.",
        confiance: 'Moyenne',
        cible: 'NEXUS-FDJ-Analyse-v1.html', impactEur: 0,
      });
    }

    return candidats;
  }

  global.NexusCoachFdj = {
    FORMULATIONS, FAMILLE_PAR_REGLE, FAMILLE_LABEL, LABEL_REGLE_COACH, hacherTexte, construireMessageCoach, evaluerJour,
    evaluerReglesCoach, selectionnerRecommandationCoach, construireRecommandation, estEnCooldown,
    calculerCandidatsCoachEquipe, SEUILS_COACH_EQUIPE_DEFAUT,
    // Exposés individuellement pour les tests unitaires.
    DETECTEURS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
