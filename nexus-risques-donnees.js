// ============================================================
// NEXUS Risques — colle Supabase (11/08/2026)
//
// Compagnon de nexus-risques-moteur.js (aucun calcul de qualification
// ici, uniquement lecture/écriture). Deux familles de fonctions :
//
// 1. Mémoire du signal (table nexus_risk_signals) — lecture ET écriture
//    ici, par exception à la convention stricte "un -donnees.js ne fait
//    que lire" établie pendant le refactoring des pages monolithiques
//    (v2.40-v2.44) : l'écriture d'une observation de risque n'est PAS une
//    action utilisateur avec effets de bord UI (toast, confirm, DOM) comme
//    « sauvegarderParametresInventaire » — c'est une orchestration pure
//    (lire l'état existant, calculer la transition via
//    NexusRisques.determinerTransition, upsert), destinée à être appelée
//    identiquement depuis Brief, Rapport, Cockpit ou un futur job
//    planifié. La séparer entre plusieurs pages dupliquerait cette
//    logique de transition — exactement ce qu'Article 11 interdit. Même
//    précédent que `obtenirRecommandationDuJour()` dans
//    nexus-coach-fdj-donnees.js (lecture + insertion idempotente dans un
//    seul service partagé).
//
// 2. Sources de données pour les 2 domaines pilotes (Caisse, Marge) — pures
//    lectures, alimentent nexus-risques-moteur.js.
//
// Dépendances de script (ordre requis) :
// <script src="nexus-verify-moteur.js"></script>   (pour Caisse)
// <script src="nexus-risques-moteur.js"></script>
// <script src="nexus-risques-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // ------------------------------------------------------------
  // MÉMOIRE DU SIGNAL
  // ------------------------------------------------------------

  async function chargerSignalExistant(client, siteId, cleSignal) {
    const { data, error } = await client.from('nexus_risk_signals')
      .select('*').eq('site_id', siteId).eq('cle_signal', cleSignal).maybeSingle();
    if (error) { console.error('Chargement signal de risque:', error); return null; }
    return data;
  }

  // Liste des signaux actifs d'un site, pour alimenter Brief/Rapport/
  // Cockpit/secteurs — triés du plus grave au moins grave, puis par
  // dernière détection la plus récente.
  async function chargerSignauxSite(client, siteId, filtres) {
    const f = filtres || {};
    let requete = client.from('nexus_risk_signals').select('*').eq('site_id', siteId);
    if (f.statut) requete = requete.eq('statut', f.statut);
    if (f.domaine) requete = requete.eq('domaine', f.domaine);
    if (f.niveau) requete = requete.eq('niveau', f.niveau);
    const { data, error } = await requete;
    if (error) { console.error('Chargement signaux de risque du site:', error); return []; }
    const rang = { risque_avere: 3, exposition: 2, signal_faible: 1, anomalie: 0 };
    return (data || []).sort((a, b) => {
      const diff = (rang[b.niveau] || 0) - (rang[a.niveau] || 0);
      if (diff !== 0) return diff;
      return new Date(b.derniere_detection_le) - new Date(a.derniere_detection_le);
    });
  }

  // Orchestration idempotente et cumulative : lit l'état existant (s'il y
  // en a un), calcule la transition via NexusRisques.determinerTransition,
  // puis upsert la ligne à jour. Ne réinitialise jamais
  // `premiere_detection_le` d'un signal déjà connu — c'est ce qui permet
  // à NEXUS de dire « ce signal est surveillé depuis 18 jours ».
  //
  // `classification` = sortie de NexusRisques.qualifierEcartCaisse(...)
  // ou NexusRisques.qualifierMargeCategorie(...) (niveau, niveauConfiance,
  // motif, impactMesureEur, impactPotentielEur, recurrenceCount,
  // tailleEchantillon, preuve).
  async function enregistrerObservation(client, siteId, params) {
    const { domaine, cleSignal, typeSignal, secteur, classification, actionRecommandee } = params;
    const existant = await chargerSignalExistant(client, siteId, cleSignal);
    const maintenant = new Date().toISOString();

    if (!existant) {
      const ligne = {
        site_id: siteId, domaine, cle_signal: cleSignal, type_signal: typeSignal,
        niveau: classification.niveau, niveau_confiance: classification.niveauConfiance,
        secteur: secteur || null, preuve: classification.preuve || {},
        impact_mesure_eur: classification.impactMesureEur,
        impact_potentiel_eur: classification.impactPotentielEur,
        action_recommandee: actionRecommandee || null,
        recurrence_count: classification.recurrenceCount || 1,
        premiere_detection_le: maintenant, derniere_detection_le: maintenant,
        historique_transitions: [{ date: maintenant, ancien_niveau: null, nouveau_niveau: classification.niveau, motif: classification.motif }],
        statut: 'surveille',
      };
      const { data, error } = await client.from('nexus_risk_signals').insert(ligne).select().maybeSingle();
      if (error) {
        // Conflit probable (unique site_id/cle_signal) : un autre appel
        // concurrent vient de créer la ligne — relire plutôt qu'échouer,
        // même précédent que Coach FDJ.
        const relu = await chargerSignalExistant(client, siteId, cleSignal);
        if (!relu) { console.error('Enregistrement signal de risque (insert):', error); return null; }
        return relu;
      }
      return data;
    }

    const transition = global.NexusRisques.determinerTransition(existant.niveau, classification.niveau);
    const historique = transition.type === 'stable'
      ? existant.historique_transitions
      : [...(existant.historique_transitions || []), { date: maintenant, ancien_niveau: existant.niveau, nouveau_niveau: classification.niveau, motif: classification.motif }];

    const patch = {
      niveau: classification.niveau, niveau_confiance: classification.niveauConfiance,
      preuve: classification.preuve || {},
      impact_mesure_eur: classification.impactMesureEur,
      impact_potentiel_eur: classification.impactPotentielEur,
      action_recommandee: actionRecommandee || existant.action_recommandee,
      recurrence_count: classification.recurrenceCount || existant.recurrence_count,
      derniere_detection_le: maintenant,
      historique_transitions: historique,
      // Un signal déjà résolu qui réapparaît est rouvert — jamais laissé
      // "résolu" alors qu'il est de nouveau observé.
      statut: 'surveille',
      resolu_le: existant.statut === 'resolu' ? null : existant.resolu_le,
      resolu_note: existant.statut === 'resolu' ? null : existant.resolu_note,
      updated_at: maintenant,
    };
    const { data, error } = await client.from('nexus_risk_signals').update(patch).eq('id', existant.id).select().maybeSingle();
    if (error) { console.error('Enregistrement signal de risque (update):', error); return existant; }
    return data;
  }

  // Résolution manuelle (manager) d'un signal — jamais une disparition
  // silencieuse. `note` explique l'action prise ou pourquoi le signal
  // n'est plus jugé pertinent.
  async function resoudreSignal(client, siteId, cleSignal, note) {
    const existant = await chargerSignalExistant(client, siteId, cleSignal);
    if (!existant) return null;
    const maintenant = new Date().toISOString();
    const historique = [...(existant.historique_transitions || []), { date: maintenant, ancien_niveau: existant.niveau, nouveau_niveau: 'resolu', motif: note || 'Résolu manuellement.' }];
    const { data, error } = await client.from('nexus_risk_signals').update({
      statut: 'resolu', resolu_le: maintenant, resolu_note: note || null,
      historique_transitions: historique, updated_at: maintenant,
    }).eq('id', existant.id).select().maybeSingle();
    if (error) { console.error('Résolution signal de risque:', error); return null; }
    return data;
  }

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE CAISSE
  // ------------------------------------------------------------

  // Les `depuisNJours` derniers audits du site pour un quart donné (même
  // référence propre que le Conseiller NEXUS Verify : comparer un quart à
  // ses propres pairs, jamais à un autre quart). Retourne directement la
  // sortie de NexusVerifyMoteur.agregerAudits(), prête pour
  // NexusRisques.qualifierEcartCaisse().
  async function chargerAgregationCaisseQuart(client, siteId, quart, depuisNJours) {
    const depuis = new Date(Date.now() - (depuisNJours || 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await client.from('audits_caisse')
      .select('date, quart, ecart_piste, ecart_boutique, statut, commentaire')
      .eq('site', siteId).eq('quart', quart).gte('date', depuis).order('date', { ascending: false });
    if (error) { console.error('Chargement audits caisse (risque):', error); return null; }
    if (!global.NexusVerifyMoteur) { console.error('NexusVerifyMoteur non chargé — inclure nexus-verify-moteur.js avant nexus-risques-donnees.js.'); return null; }
    return global.NexusVerifyMoteur.agregerAudits(data || []);
  }

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE MARGE
  // ------------------------------------------------------------

  // Périodes d'import disponibles pour le site, hors période en cours,
  // triées de la plus récente à la plus ancienne — la "propre référence
  // historique" de qualifierMargeCategorie() vient de ces périodes.
  async function chargerPeriodesAnterieures(client, siteId, periodeActuelleDebut, limite) {
    const { data, error } = await client.from('products')
      .select('periode_debut, periode_fin').eq('site', siteId).neq('periode_debut', periodeActuelleDebut)
      .order('periode_debut', { ascending: false });
    if (error) { console.error('Chargement périodes antérieures (risque marge):', error); return []; }
    const vues = new Set();
    const periodes = [];
    (data || []).forEach(r => {
      const cle = `${r.periode_debut}|${r.periode_fin}`;
      if (!vues.has(cle)) { vues.add(cle); periodes.push({ debut: r.periode_debut, fin: r.periode_fin }); }
    });
    return periodes.slice(0, limite || 3);
  }

  // marge% et CA d'une catégorie sur une période donnée — agrégation
  // faite ici en JS à partir des lignes brutes (même discipline que
  // nexus-marge.js, jamais une agrégation SQL opaque qui masquerait
  // comment le pourcentage est obtenu).
  async function chargerMargeCategoriePeriode(client, siteId, categorie, periodeDebut) {
    const { data, error } = await client.from('products')
      .select('ca, marge').eq('site', siteId).eq('categorie', categorie).eq('periode_debut', periodeDebut);
    if (error) { console.error('Chargement marge catégorie/période (risque):', error); return null; }
    const rows = data || [];
    const ca = rows.reduce((s, r) => s + (Number(r.ca) || 0), 0);
    const marge = rows.reduce((s, r) => s + (Number(r.marge) || 0), 0);
    if (!(ca > 0)) return null;
    return { ca, margePct: (marge / ca) * 100 };
  }

  // Orchestration : assemble l'historique complet (margeHistorique,
  // caHistoriqueMoyen) attendu par NexusRisques.qualifierMargeCategorie().
  async function chargerHistoriqueMargeCategorie(client, siteId, categorie, periodeActuelleDebut, nbPeriodes) {
    const periodes = await chargerPeriodesAnterieures(client, siteId, periodeActuelleDebut, nbPeriodes);
    const resultats = await Promise.all(periodes.map(p => chargerMargeCategoriePeriode(client, siteId, categorie, p.debut)));
    const valides = resultats.filter(Boolean);
    if (!valides.length) return { margeHistorique: [], caHistoriqueMoyen: null };
    return {
      margeHistorique: valides.map(v => v.margePct),
      caHistoriqueMoyen: valides.reduce((s, v) => s + v.ca, 0) / valides.length,
    };
  }

  global.NexusRisquesDonnees = {
    chargerSignalExistant, chargerSignauxSite, enregistrerObservation, resoudreSignal,
    chargerAgregationCaisseQuart,
    chargerPeriodesAnterieures, chargerMargeCategoriePeriode, chargerHistoriqueMargeCategorie,
  };
})(typeof window !== 'undefined' ? window : globalThis);
