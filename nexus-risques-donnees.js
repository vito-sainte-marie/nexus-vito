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
// <script src="nexus-verify-moteur.js?v=20260903-1206"></script>   (pour Caisse)
// <script src="nexus-risques-moteur.js?v=20260903-1206"></script>
// <script src="nexus-risques-donnees.js?v=20260903-1206"></script>
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

  // Jours écoulés depuis une date ISO — utilisé UNIQUEMENT pour dériver
  // `ancienneteJours` (NexusRisques.classifierUrgence, 12/08/2026, cadrage
  // §9) à partir de `premiere_detection_le`, déjà en mémoire depuis la
  // toute première version de ce fichier (11/08/2026) — aucune nouvelle
  // colonne, aucune nouvelle lecture Supabase, juste un calcul enfin fait
  // sur une donnée qui existait déjà sans être exploitée.
  function joursDepuisISO(dateISO) {
    if (!dateISO) return 0;
    const diffMs = Date.now() - new Date(dateISO).getTime();
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  }

  // Liste des signaux actifs d'un site, pour alimenter Brief/Rapport/
  // Cockpit/secteurs — triés du plus grave au moins grave, puis par
  // dernière détection la plus récente. Chaque ligne gagne un champ
  // `urgence` dérivé (12/08/2026, cadrage §9) — jamais persisté (calcul pur
  // à la lecture, `premiere_detection_le` suffit), disponible à tous les
  // appelants sans rien changer pour ceux qui l'ignorent encore.
  async function chargerSignauxSite(client, siteId, filtres) {
    const f = filtres || {};
    let requete = client.from('nexus_risk_signals').select('*').eq('site_id', siteId);
    if (f.statut) requete = requete.eq('statut', f.statut);
    if (f.domaine) requete = requete.eq('domaine', f.domaine);
    if (f.niveau) requete = requete.eq('niveau', f.niveau);
    const { data, error } = await requete;
    if (error) { console.error('Chargement signaux de risque du site:', error); return []; }
    const R = global.NexusRisques;
    const avecUrgence = (data || []).map(row => ({
      ...row,
      urgence: R ? R.classifierUrgence({ niveau: row.niveau, ancienneteJours: joursDepuisISO(row.premiere_detection_le) }) : null,
    }));
    const rang = { risque_avere: 3, exposition: 2, signal_faible: 1, anomalie: 0 };
    return avecUrgence.sort((a, b) => {
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

  // ------------------------------------------------------------
  // ÉCRITURE EN LOT (30/08/2026, v2.305 — "ok attaque" de Frédéric, suite du
  // P0 v2.304). `enregistrerObservation` ci-dessus fait 1 lecture + 1
  // écriture PAR signal — correct mais coûteux dès qu'un cycle de
  // qualification porte sur des dizaines de candidats (mesuré en
  // production : jusqu'à 93 produits Inventaire en écart simultané sur
  // vito-sainte-marie, soit jusqu'à ~186 requêtes HTTP pour un seul
  // chargement de Contrôle Inventaire). `qualifierEtEnregistrerRisquesPilote`
  // ci-dessous n'appelle plus `enregistrerObservation` en boucle : elle
  // construit la liste des candidats, puis appelle UNE fois
  // `enregistrerObservationsEnLot` (1 lecture groupée + 1 upsert groupé,
  // au plus 2 requêtes quel que soit le nombre de candidats). Les 3
  // fonctions ci-dessous sont génériques aux 6 domaines pilotes — jamais une
  // variante par domaine (Article 11).
  //
  // `enregistrerObservation` reste exportée et inchangée : aucun appelant
  // externe trouvé (grep projet), mais elle reste un point d'entrée valide
  // pour un futur usage isolé (ex. une action manuelle hors cycle de
  // qualification en lot) — retirer du code qui fonctionne sans certitude
  // qu'il est mort violerait l'Article 5.
  // ------------------------------------------------------------

  // Lecture groupée : tous les signaux déjà connus du site parmi les
  // `cleSignal` candidates, en une seule requête `.in(...)` plutôt qu'un
  // `chargerSignalExistant` par candidat. Retourne une map cle_signal ->
  // ligne existante (absent si jamais vu).
  async function chargerSignauxExistantsParCles(client, siteId, clesSignal) {
    const cles = (clesSignal || []).filter(Boolean);
    if (!cles.length) return {};
    const { data, error } = await client.from('nexus_risk_signals')
      .select('*').eq('site_id', siteId).in('cle_signal', cles);
    if (error) { console.error('Chargement signaux de risque (lot):', error); return {}; }
    const map = {};
    (data || []).forEach(row => { map[row.cle_signal] = row; });
    return map;
  }

  // Fonction PURE (aucun accès réseau) : calcule la ligne complète à
  // upserter pour un candidat, que le signal soit nouveau (`existant` =
  // null, même construction que la branche insert de
  // `enregistrerObservation`) ou déjà connu (`existant` fourni, même
  // construction que sa branche update). Toujours le MÊME jeu de colonnes
  // dans les deux cas — un upsert en lot envoie un seul INSERT SQL pour
  // toutes les lignes ; des lignes aux colonnes hétérogènes casseraient
  // silencieusement les colonnes absentes sur certaines lignes.
  //
  // Deux points vérifiés explicitement contre `enregistrerObservation`
  // avant ce refactor (Article 5 — non-régression comportementale) :
  //   - `premiere_detection_le` n'est JAMAIS réécrit sur un signal existant
  //     (sinon "surveillé depuis N jours" redémarrerait à zéro à chaque
  //     cycle) — repris tel quel de `existant.premiere_detection_le`.
  //   - `secteur`/`domaine`/`type_signal` : l'ancien `.update()` ne les
  //     touchait pas du tout (upsert PARTIEL implicite d'un update ciblé).
  //     Un upsert en lot doit au contraire les envoyer explicitement à
  //     chaque ligne — sans effet observable ici puisque chaque appelant
  //     passe une valeur littérale déterministe par préfixe de `cleSignal`
  //     (ex. toujours 'Opérations' pour `inventaire:produit:*`), donc
  //     réécrire la même valeur est un no-op vérifié, jamais une divergence.
  function construireLigneSignal(siteId, params, existant, maintenant) {
    const { domaine, cleSignal, typeSignal, secteur, classification, actionRecommandee } = params;

    if (!existant) {
      return {
        site_id: siteId, domaine, cle_signal: cleSignal, type_signal: typeSignal,
        niveau: classification.niveau, niveau_confiance: classification.niveauConfiance,
        secteur: secteur || null, preuve: classification.preuve || {},
        impact_mesure_eur: classification.impactMesureEur,
        impact_potentiel_eur: classification.impactPotentielEur,
        action_recommandee: actionRecommandee || null,
        recurrence_count: classification.recurrenceCount || 1,
        premiere_detection_le: maintenant, derniere_detection_le: maintenant,
        historique_transitions: [{ date: maintenant, ancien_niveau: null, nouveau_niveau: classification.niveau, motif: classification.motif }],
        statut: 'surveille', resolu_le: null, resolu_note: null, updated_at: maintenant,
      };
    }

    const transition = global.NexusRisques.determinerTransition(existant.niveau, classification.niveau);
    const historique = transition.type === 'stable'
      ? existant.historique_transitions
      : [...(existant.historique_transitions || []), { date: maintenant, ancien_niveau: existant.niveau, nouveau_niveau: classification.niveau, motif: classification.motif }];

    return {
      site_id: siteId, domaine, cle_signal: cleSignal, type_signal: typeSignal,
      niveau: classification.niveau, niveau_confiance: classification.niveauConfiance,
      secteur: secteur || existant.secteur || null,
      preuve: classification.preuve || {},
      impact_mesure_eur: classification.impactMesureEur,
      impact_potentiel_eur: classification.impactPotentielEur,
      action_recommandee: actionRecommandee || existant.action_recommandee,
      recurrence_count: classification.recurrenceCount || existant.recurrence_count,
      premiere_detection_le: existant.premiere_detection_le,
      derniere_detection_le: maintenant,
      historique_transitions: historique,
      // Un signal déjà résolu qui réapparaît est rouvert — jamais laissé
      // "résolu" alors qu'il est de nouveau observé (même règle que
      // `enregistrerObservation`).
      statut: 'surveille',
      resolu_le: existant.statut === 'resolu' ? null : existant.resolu_le,
      resolu_note: existant.statut === 'resolu' ? null : existant.resolu_note,
      updated_at: maintenant,
    };
  }

  // Orchestration : 1 lecture groupée + 1 upsert groupé pour TOUS les
  // candidats d'un cycle de qualification (les 6 domaines confondus).
  // `candidats` = tableau de { domaine, cleSignal, typeSignal, secteur,
  // classification, actionRecommandee } — mêmes champs que
  // `enregistrerObservation`, un candidat `null`/`undefined` est ignoré
  // (préserve le filtre "pas de donnée exploitable" déjà fait par chaque
  // domaine avant construction du candidat). Court-circuite AVANT tout
  // appel Supabase si la liste est vide (ex. site sans aucun écart ce
  // jour-là) — jamais une requête pour rien.
  //
  // `onConflict: 'site_id,cle_signal'` correspond à la contrainte unique
  // déjà en place sur `nexus_risk_signals` (v2.30x) — `id`/`created_at` sont
  // volontairement ABSENTS de chaque ligne (jamais fixés ici) pour que
  // PostgREST laisse la base gérer ces colonnes par défaut à l'insert, et
  // les préserve telles quelles à la mise à jour.
  async function enregistrerObservationsEnLot(client, siteId, candidats) {
    const liste = (candidats || []).filter(Boolean);
    if (!liste.length) return [];
    const cles = liste.map(c => c.cleSignal);
    const existants = await chargerSignauxExistantsParCles(client, siteId, cles);
    const maintenant = new Date().toISOString();
    const lignes = liste.map(c => construireLigneSignal(siteId, c, existants[c.cleSignal] || null, maintenant));
    const { data, error } = await client.from('nexus_risk_signals')
      .upsert(lignes, { onConflict: 'site_id,cle_signal' }).select();
    if (error) { console.error('Enregistrement signaux de risque (lot):', error); return []; }
    return data || [];
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

  // Variante multi-quarts de chargerAgregationCaisseQuart — UNE seule
  // requête pour tous les quarts du site plutôt qu'une requête par quart
  // (ajouté le 12/08/2026 pour l'intégration Brief NEXUS, où le nombre de
  // quarts actifs n'est pas connu à l'avance et ne doit jamais être codé
  // en dur — voir Paramétrage FDJ, même discipline). Retourne une map
  // quart -> sortie de NexusVerifyMoteur.agregerAudits(), prête pour
  // NexusRisques.qualifierEcartCaisse() par quart.
  async function chargerAgregationCaisseTousQuarts(client, siteId, depuisNJours) {
    const depuis = new Date(Date.now() - (depuisNJours || 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await client.from('audits_caisse')
      .select('date, quart, ecart_piste, ecart_boutique, statut, commentaire')
      .eq('site', siteId).gte('date', depuis).order('date', { ascending: false });
    if (error) { console.error('Chargement audits caisse tous quarts (risque):', error); return {}; }
    if (!global.NexusVerifyMoteur) { console.error('NexusVerifyMoteur non chargé — inclure nexus-verify-moteur.js avant nexus-risques-donnees.js.'); return {}; }
    const parQuart = {};
    (data || []).forEach(r => { (parQuart[r.quart] = parQuart[r.quart] || []).push(r); });
    const resultat = {};
    Object.keys(parQuart).forEach(q => { resultat[q] = global.NexusVerifyMoteur.agregerAudits(parQuart[q]); });
    return resultat;
  }

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE 3 CARBURANTS (autonomie de stock, Cadrage
  // risques Phase 5, tâche #234, 18/08/2026)
  //
  // Même précédent que chargerAgregationCaisseQuart ci-dessus : ce fichier
  // interroge Supabase ET réutilise les fonctions pures d'un AUTRE domaine
  // (ici NexusCarburantDonnees/NexusCarburantMoteur, déjà en production
  // depuis le 13/08/2026 pour Carburants Pilotage) — jamais une 2e règle de
  // seuil ou de calcul d'autonomie écrite ici (Article 11).
  //
  // Retourne une map { go: {...}, sp95: {...}, gnr: {...} }, chaque entrée
  // directement au format attendu par NexusRisques.qualifierAutonomieCarburant()
  // — ou `null` pour un carburant sans aucun relevé récent (jamais un objet
  // à moitié rempli qui laisserait croire à une mesure partielle).
  async function chargerAutonomiesCarburantAvecHistorique(client, siteId, dateDuJour, fenetreJours) {
    const MC = global.NexusCarburantMoteur;
    const DC = global.NexusCarburantDonnees;
    if (!MC || !DC) { console.error('NexusCarburantMoteur/NexusCarburantDonnees non chargés — inclure nexus-carburant-moteur.js et nexus-carburant-donnees.js avant nexus-risques-donnees.js pour qualifier Carburants.'); return {}; }
    const fenetre = fenetreJours || 7;
    const [consoMoyenne, historiqueReleves] = await Promise.all([
      DC.chargerConsommationJournaliereMoyenne(client, siteId, dateDuJour),
      DC.chargerHistoriqueReleves(client, siteId, fenetre, dateDuJour),
    ]);
    // historiqueReleves est trié du plus récent au plus ancien (voir
    // chargerHistoriqueReleves) : le 1er élément est le jour demandé
    // lui-même (s'il a un relevé), les suivants sont l'historique.
    const resultat = {};
    MC.CLES_CARBURANT.forEach(cle => {
      const conso = consoMoyenne[cle];
      const autonomies = historiqueReleves.map(jour => {
        const stockJour = jour.parCarburant[cle] ? jour.parCarburant[cle].reelDuJour : null;
        return MC.calculerAutonomieJours(stockJour, conso);
      });
      if (!autonomies.length) { resultat[cle] = null; return; }
      resultat[cle] = {
        autonomieJours: autonomies[0],
        historiqueAutonomieJours: autonomies.slice(1).filter(v => v != null),
        seuilAlerteJours: MC.SEUIL_AUTONOMIE_ALERTE_JOURS,
        seuilVigilanceJours: MC.SEUIL_AUTONOMIE_VIGILANCE_JOURS,
      };
    });
    return resultat;
  }

  // ------------------------------------------------------------
  // ORCHESTRATION PARTAGÉE — PILOTE Marge + Caisse
  //
  // Point d'entrée unique, appelé à l'identique depuis NEXUS-Brief-v1.html
  // ET NEXUS-Cockpit-v2.html (12/08/2026 — Article 11, jamais une 2e
  // orchestration réécrite ailleurs ; Rapport/secteurs suivront). Qualifie
  // et enregistre les observations du jour, puis retourne les signaux
  // actifs du site. Renommée le 12/08/2026 (elle s'appelait
  // `qualifierEtEnregistrerRisquesBriefPilote`, un nom qui laissait croire
  // à tort qu'elle était propre à Brief) au moment de son 2e appelant réel
  // — pas avant, pour ne pas généraliser un nom sur la base d'une seule
  // utilisation.
  //
  // Domaine Caisse : un signal par quart ayant au moins un audit dans la
  // fenêtre (`agregationCaisseParQuart`, sortie de
  // chargerAgregationCaisseTousQuarts).
  //
  // Domaine Marge : UNIQUEMENT les catégories déjà repérées par Marge+
  // (nexus-marge.js, comparaison à la médiane du groupe économique sur la
  // période en cours) — `categoriesEnEcart`. Sur Brief, cette liste vient
  // de NexusBriefDonnees.chargerMargePlus(). Un appelant qui ne calcule pas
  // Marge+ (ex. Cockpit aujourd'hui, qui ne charge pas nexus-marge.js) peut
  // passer `categoriesEnEcart: []` — le volet Marge est alors simplement
  // ignoré pour cet appelant, jamais un balayage de secours qui
  // redéfinirait la règle "catégories déjà repérées par Marge+" en douce.
  // `rowsBrut`/`periodeAffichage` viennent de ce que l'appelant a déjà
  // chargé (NexusConseillerDonnees.chargerProduitsBrut + NexusPeriodes.
  // analyserPeriodes) — zéro requête Supabase supplémentaire pour ce volet.
  //
  // Chaque candidat est TOUJOURS enregistré (même niveau anomalie), pas
  // seulement les niveaux élevés : c'est ce qui permet une désescalade
  // propre (un signal déjà suivi qui redescend à anomalie doit être tracé,
  // jamais figé à son ancien niveau ni supprimé silencieusement). Le tri
  // "digne d'être affiché" (niveau non-anomalie) est un filtre d'AFFICHAGE
  // fait par l'appelant, jamais une décision de ne pas écrire.
  async function qualifierEtEnregistrerRisquesPilote(client, siteId, params) {
    const {
      rowsBrut, periodeAffichage, categoriesEnEcart, agregationCaisseParQuart, autonomiesCarburant,
      alertesInventaire, agregationCaisseFdjParQuart, ponctualiteCollaborateurs,
    } = params || {};
    if (!global.NexusRisques) { console.error('NexusRisques non chargé — inclure nexus-risques-moteur.js avant nexus-risques-donnees.js.'); return []; }
    const R = global.NexusRisques;

    // 30/08/2026 (v2.305, "ok attaque") : chaque domaine ne fait plus
    // qu'ajouter un CANDIDAT (objet en mémoire, pas de Promise ni d'appel
    // Supabase) au tableau `candidats` — l'écriture réelle se fait une
    // seule fois pour tous les domaines, plus bas, via
    // `enregistrerObservationsEnLot`. Le filtre "pas de donnée exploitable"
    // par domaine (ex. `!agg.total`) est INCHANGÉ : il décide juste de ne
    // pas pousser de candidat plutôt que de retourner `Promise.resolve(null)`.
    const candidats = [];

    Object.keys(agregationCaisseParQuart || {}).forEach(quart => {
      const agg = agregationCaisseParQuart[quart];
      if (!agg || !agg.total) return;
      const classif = R.qualifierEcartCaisse(agg);
      candidats.push({
        domaine: 'caisse', cleSignal: `caisse:quart:${quart}`, typeSignal: 'ecart_caisse_recurrent',
        secteur: 'Opérations', classification: classif,
        actionRecommandee: `Vérifiez les procédures de comptage du quart ${quart} avec l'équipe concernée.`,
      });
    });

    if (periodeAffichage) {
      (categoriesEnEcart || []).forEach(categorie => {
        const rowsCategorie = (rowsBrut || []).filter(r => r.categorie === categorie && r.periode_debut === periodeAffichage.debut);
        const caActuel = rowsCategorie.reduce((s, r) => s + (Number(r.ca) || 0), 0);
        const margeActuelle = rowsCategorie.reduce((s, r) => s + (Number(r.marge) || 0), 0);
        if (!(caActuel > 0)) return;
        const { margeHistorique, caHistoriqueMoyen } = R.assemblerHistoriqueMargeCategorie(rowsBrut, categorie, periodeAffichage.debut, 3);
        const classif = R.qualifierMargeCategorie({
          categorie, margePctActuelle: (margeActuelle / caActuel) * 100,
          margeHistorique, caActuel, caHistoriqueMoyen,
        });
        candidats.push({
          domaine: 'marge', cleSignal: `marge:categorie:${categorie}`, typeSignal: 'ecart_marge_categorie',
          secteur: 'Marge', classification: classif,
          actionRecommandee: `Vérifiez le prix d'achat et les remises sur la catégorie ${categorie}.`,
        });
      });
    }

    // Domaine Carburants (Cadrage risques Phase 5, tâche #234, 18/08/2026) —
    // OPTIONNEL : un appelant qui ne passe pas `autonomiesCarburant` (Brief/
    // Cockpit aujourd'hui, avant d'être branchés eux-mêmes) voit simplement
    // ce volet ignoré, jamais un balayage de secours — même discipline que
    // le volet Marge quand `categoriesEnEcart` est absent. Un carburant
    // sans donnée (`null` dans la map) n'est jamais qualifié à sa place.
    Object.keys(autonomiesCarburant || {}).forEach(carburant => {
      const donnee = (autonomiesCarburant || {})[carburant];
      if (!donnee) return;
      const classif = R.qualifierAutonomieCarburant(donnee);
      const cleSignal = `carburant:autonomie:${carburant}`;
      const nomCarburant = R.sujetSignal({ domaine: 'carburant', cle_signal: cleSignal });
      candidats.push({
        domaine: 'carburant', cleSignal, typeSignal: 'autonomie_stock_carburant',
        secteur: 'Carburants', classification: classif,
        actionRecommandee: `Anticipez le réapprovisionnement ${nomCarburant} — vérifiez le délai de livraison du fournisseur.`,
      });
    });

    // Domaine Inventaire (Cadrage risques Phase 6, tâche #235, 18/08/2026)
    // — OPTIONNEL, même discipline que Marge/Carburants ci-dessus : un
    // appelant qui ne passe pas `alertesInventaire` voit ce volet ignoré.
    //
    // P0 corrigé le 30/08/2026 (v2.304, remontée Frédéric — Safari) : la
    // contrainte CHECK sur `nexus_risk_signals.domaine` n'incluait pas
    // 'inventaire' à son lancement (18/08/2026) — chaque écriture échouait
    // en 400 depuis cette date, silencieusement absorbée par le
    // console.error de l'écriture. RAPPEL pour tout nouveau domaine ajouté
    // ici à l'avenir : la liste des valeurs autorisées vit UNIQUEMENT dans
    // la contrainte SQL `nexus_risk_signals_domaine_check` (Article 11 —
    // jamais dupliquée en constante JS qui pourrait diverger de la même
    // façon) ; toujours élargir cette contrainte AVANT d'introduire un
    // nouveau `domaine:` littéral ici, et vérifier après coup par un insert
    // réel (les tests JS de ce fichier utilisent un client Supabase mocké —
    // ils ne peuvent pas attraper une violation de contrainte SQL, seule
    // une vérification contre la base réelle le peut). C'est ce domaine qui
    // génère le plus gros volume de candidats (jusqu'à 93 produits distincts
    // observés en production le 30/08/2026 sur vito-sainte-marie) — la
    // raison directe du passage à l'écriture en lot ci-dessous.
    Object.keys(alertesInventaire || {}).forEach(produitId => {
      const donnee = (alertesInventaire || {})[produitId];
      if (!donnee) return;
      const classif = R.qualifierAlerteInventaire(donnee);
      candidats.push({
        domaine: 'inventaire', cleSignal: `inventaire:produit:${donnee.designation}`, typeSignal: 'alerte_inventaire_recurrente',
        secteur: 'Opérations', classification: classif,
        actionRecommandee: `Vérifiez la fiche produit et le mode de comptage de ${donnee.designation} — une alerte qui revient signale souvent une cause de fond (fiche dupliquée, emplacement ambigu, mode de comptage inadapté), pas juste un comptage isolé à corriger.`,
      });
    });

    // Domaine FDJ — écart de caisse (Cadrage risques Phase 6, 18/08/2026) :
    // réutilise `qualifierEcartCaisse` tel quel (fonction générique, voir
    // commentaire de `chargerAgregationCaisseFdjTousQuarts`), jamais une 2e
    // classification d'écart de caisse.
    Object.keys(agregationCaisseFdjParQuart || {}).forEach(quart => {
      const agg = agregationCaisseFdjParQuart[quart];
      if (!agg || !agg.total) return;
      const classif = R.qualifierEcartCaisse(agg);
      candidats.push({
        domaine: 'fdj', cleSignal: `fdj:quart:${quart}`, typeSignal: 'ecart_caisse_fdj_recurrent',
        secteur: 'FDJ', classification: classif,
        actionRecommandee: `Vérifiez les procédures de comptage FDJ du quart ${quart} avec l'équipe concernée.`,
      });
    });

    // Domaine Équipe — ponctualité (Cadrage risques Phase 6, 18/08/2026) :
    // un signal par collaborateur AYANT AU MOINS UN RETARD sur la fenêtre —
    // jamais un signal agrégé au niveau site (voir le commentaire de
    // `qualifierPonctualiteCollaborateur` dans nexus-risques-moteur.js).
    Object.keys(ponctualiteCollaborateurs || {}).forEach(employeeId => {
      const donnee = (ponctualiteCollaborateurs || {})[employeeId];
      if (!donnee || !donnee.nbRetards) return;
      const classif = R.qualifierPonctualiteCollaborateur(donnee);
      candidats.push({
        domaine: 'equipe', cleSignal: `equipe:collaborateur:${donnee.nom}`, typeSignal: 'ponctualite_recurrente',
        secteur: 'Équipe', classification: classif,
        actionRecommandee: `Échangez avec ${donnee.nom} sur les retards constatés — un entretien individuel, pas une mesure collective, tant qu'aucun autre collaborateur n'est concerné de façon récurrente.`,
      });
    });

    await enregistrerObservationsEnLot(client, siteId, candidats);
    return chargerSignauxSite(client, siteId, { statut: 'surveille' });
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

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE 4 INVENTAIRE (Cadrage risques Phase 6, tâche
  // #235, 18/08/2026). Réutilise deux chargeurs DÉJÀ écrits et testés dans
  // `nexus-inventaire-manager-donnees.js` — jamais une 2e requête inventée
  // ici pour la même donnée (Article 11) :
  //   - `chargerAlertesOuvertesPeriode` : alertes ouvertes/en_cours du
  //     site, avec `gravite`/`valeur_estimee`/désignation produit déjà
  //     jointe — la SITUATION actuelle.
  //   - `chargerHistoriqueEcartsRecents` : alertes `ecart_ouverture` (tout
  //     statut confondu, y compris déjà résolues) des 14 derniers jours —
  //     la RÉCURRENCE réelle, y compris les écarts qui reviennent après
  //     avoir été traités une première fois (exactement le type de motif
  //     que l'incident Glaçons Crystal du 18/08/2026 aurait dû faire
  //     remonter : un produit dont l'historique de comptage se dérobe de
  //     façon répétée).
  //
  // Retourne une map { [produit_id]: { designation, gravite, nbAlertesRecentes, valeurEstimeeTotal } }
  // — un produit sans aucune alerte ouverte n'apparaît pas dans la map
  // (jamais une entrée à moitié remplie qui laisserait croire à une
  // mesure partielle, même précédent que Carburants Phase 5).
  // `RANG_GRAVITE_ALERTE` : seules deux valeurs existent en base
  // aujourd'hui ('critique'/'attention', voir `inventaire_alertes.gravite`)
  // — un produit avec plusieurs alertes ouvertes de gravités différentes
  // remonte sous la PIRE des deux, jamais une moyenne qui diluerait le cas
  // le plus grave (même principe que `qualifierAlerteInventaire` lui-même,
  // qui ne réévalue pas la gravité, seulement la pire déjà posée).
  const RANG_GRAVITE_ALERTE = { attention: 0, critique: 1 };

  async function chargerAlertesInventaireAQualifier(client, siteId) {
    const D = global.NexusInventaireManagerDonnees;
    if (!D) { console.error('NexusInventaireManagerDonnees non chargé — inclure nexus-inventaire-manager-donnees.js avant nexus-risques-donnees.js pour qualifier Inventaire.'); return {}; }
    const fenetreLarge = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const [alertesOuvertes, historiqueEcarts] = await Promise.all([
      D.chargerAlertesOuvertesPeriode(client, siteId, fenetreLarge, aujourdhui),
      D.chargerHistoriqueEcartsRecents(client, siteId), // fenêtre fixe 14 jours, propre à ce chargeur existant.
    ]);
    const recurrenceParProduit = {};
    (historiqueEcarts || []).forEach(r => { if (r.produit_id) recurrenceParProduit[r.produit_id] = (recurrenceParProduit[r.produit_id] || 0) + 1; });
    const resultat = {};
    (alertesOuvertes || []).forEach(a => {
      if (!a.produit_id) return; // alerte transversale au quart (ex. cloture_en_retard), pas rattachable à un produit précis — hors périmètre de ce domaine.
      const designation = a.inventaire_zone_produit ? a.inventaire_zone_produit.designation : a.produit_id;
      if (!resultat[a.produit_id]) resultat[a.produit_id] = { designation, gravite: a.gravite || null, valeurEstimeeTotal: 0 };
      const entree = resultat[a.produit_id];
      if (RANG_GRAVITE_ALERTE[a.gravite] > RANG_GRAVITE_ALERTE[entree.gravite]) entree.gravite = a.gravite;
      entree.valeurEstimeeTotal += Number(a.valeur_estimee) || 0;
    });
    Object.keys(resultat).forEach(produitId => {
      resultat[produitId].nbAlertesRecentes = recurrenceParProduit[produitId] || 1;
    });
    return resultat;
  }

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE 5 FDJ (écart de caisse, Cadrage risques
  // Phase 6, 18/08/2026). Réutilise `NexusRisques.qualifierEcartCaisse`
  // TEL QUEL (fonction générique malgré son nom — elle ne connaît aucun
  // détail propre à la Caisse boutique/piste, elle attend juste un objet
  // {ecartCumule, total, parStatut}) plutôt que d'écrire une 2e fonction
  // de classification pour un 2e type d'écart de caisse (Article 11) :
  // seule l'agrégation ci-dessous, propre aux colonnes de
  // `fdj_cash_controls`, est nouvelle. Même construction que
  // `chargerAgregationCaisseTousQuarts` (agrégation par quart), sur une
  // table différente.
  async function chargerAgregationCaisseFdjTousQuarts(client, siteId, depuisNJours) {
    const depuis = new Date(Date.now() - (depuisNJours || 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: shifts, error: e1 } = await client.from('fdj_shifts')
      .select('id, quart').eq('site', siteId).gte('date', depuis);
    if (e1) { console.error('Chargement quarts FDJ (risque):', e1); return {}; }
    const quartParShift = {};
    (shifts || []).forEach(s => { quartParShift[s.id] = s.quart; });
    const shiftIds = Object.keys(quartParShift);
    if (!shiftIds.length) return {};
    const { data: controles, error: e2 } = await client.from('fdj_cash_controls')
      .select('shift_id, ecart, statut').in('shift_id', shiftIds);
    if (e2) { console.error('Chargement écarts caisse FDJ (risque):', e2); return {}; }
    const parQuart = {};
    (controles || []).forEach(c => {
      const quart = quartParShift[c.shift_id];
      if (!quart) return;
      if (!parQuart[quart]) parQuart[quart] = { total: 0, ecartCumule: 0, parStatut: { conforme: 0, surveiller: 0, anomalie: 0, critique: 0 } };
      const agg = parQuart[quart];
      agg.total++;
      agg.ecartCumule += Math.abs(Number(c.ecart) || 0);
      if (agg.parStatut[c.statut] != null) agg.parStatut[c.statut]++;
    });
    return parQuart;
  }

  // ------------------------------------------------------------
  // SOURCE — DOMAINE PILOTE 6 ÉQUIPE (ponctualité, Cadrage risques Phase
  // 6, 18/08/2026). Requête DÉLIBÉRÉMENT filtrée par `site` — à la
  // différence de `chargerDomaineEquipe` (nexus-brief-donnees.js), qui ne
  // filtre pas par site depuis sa toute première version (comportement
  // documenté et volontairement inchangé là-bas). Persister un signal de
  // risque sous un `site_id` alors que les pointages viendraient de tous
  // les sites serait une vraie corruption des données (Article 5 : jamais
  // propager un raccourci existant dans une nouvelle table qui, elle,
  // s'appuie structurellement sur le site) — ce n'est donc pas une
  // 2e version divergente d'un même calcul, mais une correction du
  // périmètre, nécessaire pour ce nouvel usage précis.
  //
  // Retourne une map { [employeeId]: { nom, nbRetards, totalPointages } }
  // — un collaborateur sans retard n'apparaît pas dans la map.
  async function chargerPonctualiteCollaborateursAQualifier(client, siteId, depuisNJours) {
    const depuis = new Date(Date.now() - (depuisNJours || 14) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [{ data: retards, error: e1 }, { data: totaux, error: e2 }] = await Promise.all([
      client.from('pointages').select('employee_id, retard_min, employees(nom)').eq('site', siteId).eq('type', 'arrivee').gt('retard_min', 0).gte('date', depuis),
      client.from('pointages').select('employee_id').eq('site', siteId).eq('type', 'arrivee').gte('date', depuis),
    ]);
    if (e1 || e2) { [e1, e2].forEach(e => { if (e) console.error('Chargement ponctualité (risque équipe):', e); }); return {}; }
    const totalParEmploye = {};
    (totaux || []).forEach(p => { if (p.employee_id) totalParEmploye[p.employee_id] = (totalParEmploye[p.employee_id] || 0) + 1; });
    const resultat = {};
    (retards || []).forEach(p => {
      if (!p.employee_id) return;
      if (!resultat[p.employee_id]) resultat[p.employee_id] = { nom: p.employees ? p.employees.nom : p.employee_id, nbRetards: 0, totalPointages: totalParEmploye[p.employee_id] || 0 };
      resultat[p.employee_id].nbRetards++;
    });
    return resultat;
  }

  global.NexusRisquesDonnees = {
    chargerSignalExistant, chargerSignauxSite, enregistrerObservation, resoudreSignal,
    chargerSignauxExistantsParCles, construireLigneSignal, enregistrerObservationsEnLot,
    chargerAgregationCaisseQuart, chargerAgregationCaisseTousQuarts,
    chargerPeriodesAnterieures, chargerMargeCategoriePeriode, chargerHistoriqueMargeCategorie,
    chargerAutonomiesCarburantAvecHistorique,
    chargerAlertesInventaireAQualifier, chargerAgregationCaisseFdjTousQuarts, chargerPonctualiteCollaborateursAQualifier,
    qualifierEtEnregistrerRisquesPilote,
  };
})(typeof window !== 'undefined' ? window : globalThis);
