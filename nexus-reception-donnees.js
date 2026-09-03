// ============================================================
// NEXUS Carburants — Réceptions — colle Supabase (v2, 15/08/2026)
//
// Réécriture complète pour le modèle "visite camion" (voir en-tête de
// nexus-reception-moteur.js pour le contexte). Même discipline que
// nexus-carburant-donnees.js (Article 11) : ce fichier ne fait AUCUN calcul,
// il charge/écrit les lignes brutes et délègue tout calcul à
// NexusReceptionMoteur.
//
// Tables (migration "carburant_receptions_visite_v2", 15/08/2026) :
//   carburant_reception_visites (1 ligne par visite camion)
//   carburant_reception_visite_lignes (1 ligne par carburant livré)
//   carburant_reception_compartiments (1 ligne par compartiment)
//   carburant_reception_mesures (1 ligne par cuve concernée)
//   carburant_reception_anomalies (audit des anomalies + dérogations)
//
// Consommé par :
//   - NEXUS-Carburant-Reception-v1.html (parcours employé, 5 étapes)
//   - NEXUS-Carburants-Pilotage-v1.html (sous-bloc "Qualité des réceptions")
//
// Inclure après nexus-reception-moteur.js :
// <script src="nexus-reception-donnees.js?v=20260903-1143"></script>
// ------------------------------------------------------------

(function (global) {
  // Configuration complète du moteur de réception pour un site — UNE seule
  // requête station_config, jamais une config partielle codée en dur dans
  // l'écran (demande de Frédéric, point 9 : "ne rien coder spécifiquement
  // pour Sainte-Marie"). Repose sur des valeurs par défaut EXPLICITES du
  // moteur (NexusReceptionMoteur.SEUIL_*) si la colonne
  // reception_carburant_config n'a pas encore été personnalisée pour ce
  // site — jamais un silence si la colonne est absente/vide.
  async function chargerConfigReception(client, siteId) {
    const { data, error } = await client.from('station_config')
      .select('cuves_carburants, reception_carburant_config, consignes_securite_reception, contact_manager_reception')
      .eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement config réception carburant:', error); return null; }
    const M = global.NexusReceptionMoteur;
    const rc = (data && data.reception_carburant_config) || {};
    const cuvesCarburants = (data && data.cuves_carburants) || {};
    return {
      cuvesOrdonnees: M.construireListeCuvesOrdonnee(cuvesCarburants, rc.ordre_cuves),
      cuvesCarburants,
      nombreCompartimentsDefaut: rc.nombre_compartiments_defaut != null ? rc.nombre_compartiments_defaut : 6,
      seuilEcartCompartimentsPct: rc.seuil_ecart_compartiments_pct != null ? rc.seuil_ecart_compartiments_pct : M.SEUIL_ECART_COMPARTIMENTS_PCT_DEFAUT,
      seuilEcartMesurePct: rc.seuil_ecart_mesure_pct != null ? rc.seuil_ecart_mesure_pct : M.SEUIL_ECART_MESURE_PCT_DEFAUT,
      consignesSecurite: Array.isArray(data && data.consignes_securite_reception) ? data.consignes_securite_reception : [],
      contactManager: (data && data.contact_manager_reception) || {},
    };
  }

  // Écarts de réception (ratio mesuré/BL) des N dernières réceptions d'un
  // carburant sur ce site, pour alimenter
  // NexusReceptionMoteur.comparerHistorique() côté écran. Ne renvoie que
  // les lignes où le rapprochement a bien été calculé (statut != a_completer)
  // — une réception encore incomplète ne doit jamais polluer la moyenne
  // historique. `limite` par défaut 15 (large marge au-dessus du seuil
  // minimal d'échantillon du moteur).
  async function chargerHistoriqueEcartsRatio(client, siteId, carburant, limite) {
    const { data, error } = await client.from('carburant_reception_visite_lignes')
      .select('delta_ratio, statut')
      .eq('site', siteId).eq('carburant', carburant)
      .not('statut', 'eq', 'a_completer')
      .order('created_at', { ascending: false })
      .limit(limite || 15);
    if (error) { console.error('Chargement historique écarts réception carburant:', error); return []; }
    return (data || []).map(l => l.delta_ratio).filter(v => v != null);
  }

  // Soumission complète d'une visite (audit : "L'employé saisit les faits"
  // en UNE fois — même principe que le modèle v1). `visite` = les colonnes
  // de carburant_reception_visites (son `statut` porte la cible FINALE —
  // 'terminee' ou 'terminee_avec_derogation' — jamais posée directement,
  // voir ci-dessous), DOIT porter `idempotency_key` (généré une seule fois
  // par visite côté écran, Sprint C4). `lignes` = tableau de
  // carburant_reception_visite_lignes SANS visite_id. `compartiments` =
  // tableau de carburant_reception_compartiments SANS visite_id. `mesures`
  // = tableau de carburant_reception_mesures SANS visite_id. `anomalies` =
  // tableau de carburant_reception_anomalies SANS visite_id (peut être
  // vide — uniquement les anomalies réellement rencontrées, y compris déjà
  // levées par dérogation manager).
  //
  // Atomicité (Sprint C5 "Robustesse", audit §12) : pas de vraie
  // transaction multi-tables côté client Supabase, donc écriture en DEUX
  // PHASES plutôt qu'un nettoyage best-effort après coup — même discipline
  // que carburant_releves.controle_statut et fdj_shifts.releve_cloture_statut
  // (pending/error/retry) :
  //   1. L'en-tête est TOUJOURS insérée avec statut='en_cours' d'abord,
  //      quel que soit le statut final visé par l'appelant.
  //   2. Les lignes/compartiments/mesures/anomalies sont insérées.
  //   3. Le statut final n'est posé qu'APRÈS le succès complet de l'étape 2.
  // Tant que le statut reste 'en_cours', la visite est une preuve durable
  // qu'une tentative a eu lieu (jamais supprimée : carburant_reception_
  // visites n'a d'ailleurs aucune politique RLS DELETE — un nettoyage par
  // suppression aurait de toute façon toujours silencieusement échoué) mais
  // n'est jamais lue comme une réception réelle (chargerDerniereVisite /
  // chargerHistoriqueVisites l'excluent) ; en cas de coupure avant l'étape
  // 3, un retry avec la même idempotency_key complète simplement le travail
  // restant, y compris la pose tardive du statut final si elle seule avait
  // échoué.
  //
  // Idempotence (Sprint C4, audit §4 "Idempotence livraison" + scénario de
  // test C04 "Double clic validation livraison → Une seule réception
  // comptabilisée") : un conflit 23505 sur idempotency_key signifie que
  // cette même soumission a déjà été tentée (double clic, retry réseau) —
  // jamais une erreur bloquante. On retrouve la visite existante et : si
  // ses lignes existent déjà, la soumission précédente est allée à son
  // terme (on s'assure juste que le statut final est bien posé, au cas où
  // seule cette dernière étape avait échoué) — succès idempotent immédiat,
  // aucune ligne réinsérée ; sinon, la tentative précédente s'est arrêtée
  // en cours de route (coupure réseau avant réponse) et on complète la
  // même visite plutôt que d'en créer une seconde — même discipline que le
  // traitement du 23505 sur carburant_releve_versions (Sprint C1) et
  // fdj_releves_cloture.
  async function soumettreVisiteComplete(client, visite, lignes, compartiments, mesures, anomalies) {
    const statutFinal = visite.statut;
    let v;
    const { data: vInsert, error: eVisite } = await client.from('carburant_reception_visites')
      .insert({ ...visite, statut: 'en_cours' }).select().single();
    if (eVisite) {
      if (eVisite.code !== '23505' || !visite.idempotency_key) {
        console.error('Création visite réception carburant:', eVisite);
        return { error: eVisite };
      }
      const { data: existante, error: eFetch } = await client.from('carburant_reception_visites')
        .select().eq('idempotency_key', visite.idempotency_key).maybeSingle();
      if (eFetch || !existante) {
        console.error('Réception carburant — conflit idempotent mais visite existante introuvable:', eFetch);
        return { error: eVisite };
      }
      const { count, error: eCount } = await client.from('carburant_reception_visite_lignes')
        .select('id', { count: 'exact', head: true }).eq('visite_id', existante.id);
      if (eCount) { console.error('Réception carburant — vérification complétude visite existante:', eCount); return { error: eCount }; }
      if ((count || 0) > 0) {
        if (existante.statut === 'en_cours') {
          const { error: eMajTardif } = await client.from('carburant_reception_visites').update({ statut: statutFinal }).eq('id', existante.id);
          if (eMajTardif) console.error('Réception carburant — pose tardive du statut final (retry idempotent):', eMajTardif);
          else existante.statut = statutFinal;
        }
        return { data: existante, idempotent: true };
      }
      v = existante; // en-tête déjà créée par une tentative précédente interrompue avant la suite — on la complète, on n'en recrée pas une seconde.
    } else {
      v = vInsert;
    }

    const lignesAvecId = (lignes || []).map(l => ({ ...l, visite_id: v.id, site: visite.site }));
    const { error: eLignes } = await client.from('carburant_reception_visite_lignes').insert(lignesAvecId);
    if (eLignes) { console.error('Création lignes réception carburant:', eLignes); return { error: eLignes }; }

    const compartimentsAvecId = (compartiments || []).map(c => ({ ...c, visite_id: v.id, site: visite.site }));
    const { error: eCompartiments } = await client.from('carburant_reception_compartiments').insert(compartimentsAvecId);
    if (eCompartiments) { console.error('Création compartiments réception carburant:', eCompartiments); return { error: eCompartiments }; }

    const mesuresAvecId = (mesures || []).map(m => ({ ...m, visite_id: v.id, site: visite.site }));
    const { error: eMesures } = await client.from('carburant_reception_mesures').insert(mesuresAvecId);
    if (eMesures) { console.error('Création mesures réception carburant:', eMesures); return { error: eMesures }; }

    if (anomalies && anomalies.length) {
      const anomaliesAvecId = anomalies.map(a => ({ ...a, visite_id: v.id, site: visite.site }));
      const { error: eAnomalies } = await client.from('carburant_reception_anomalies').insert(anomaliesAvecId);
      if (eAnomalies) { console.error('Création anomalies réception carburant:', eAnomalies); return { error: eAnomalies }; }
    }

    const { error: eMajFinal } = await client.from('carburant_reception_visites').update({ statut: statutFinal }).eq('id', v.id);
    if (eMajFinal) { console.error('Pose du statut final réception carburant:', eMajFinal); return { error: eMajFinal }; }

    return { data: { ...v, statut: statutFinal } };
  }

  // Dernière visite d'un site, avec ses lignes/compartiments/mesures —
  // alimente le sous-bloc "Qualité des réceptions" de Carburants Pilotage.
  // Retourne null si aucune visite n'a jamais été saisie. Exclut
  // statut='en_cours' (Sprint C5) : une en-tête posée en preuve durable
  // d'une tentative interrompue n'est jamais une réception réelle tant que
  // son statut final n'a pas été confirmé.
  async function chargerDerniereVisite(client, siteId) {
    const { data: visite, error: e1 } = await client.from('carburant_reception_visites')
      .select('*').eq('site', siteId).neq('statut', 'en_cours').neq('statut', 'annulee_doublon')
      .order('date_visite', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (e1) { console.error('Chargement dernière visite réception carburant:', e1); return null; }
    if (!visite) return null;
    const [{ data: lignes, error: e2 }, { data: compartiments, error: e3 }, { data: mesures, error: e4 }] = await Promise.all([
      client.from('carburant_reception_visite_lignes').select('*').eq('visite_id', visite.id),
      client.from('carburant_reception_compartiments').select('*').eq('visite_id', visite.id).order('numero', { ascending: true }),
      client.from('carburant_reception_mesures').select('*').eq('visite_id', visite.id),
    ]);
    if (e2 || e3 || e4) console.error('Chargement détail dernière visite réception carburant:', e2 || e3 || e4);
    return { ...visite, lignes: lignes || [], compartiments: compartiments || [], mesures: mesures || [] };
  }

  // Historique des visites sur une période — même esprit que
  // chargerHistoriqueReceptions v1 (liste chronologique simple, aucun
  // filtre silencieux). `limite` par défaut 10. Exclut statut='en_cours'
  // (Sprint C5), même raison que chargerDerniereVisite ci-dessus.
  async function chargerHistoriqueVisites(client, siteId, limite) {
    const { data, error } = await client.from('carburant_reception_visites')
      .select('*').eq('site', siteId).neq('statut', 'en_cours').neq('statut', 'annulee_doublon')
      .order('date_visite', { ascending: false }).order('created_at', { ascending: false })
      .limit(limite || 10);
    if (error) { console.error('Chargement historique visites réception carburant:', error); return []; }
    return data || [];
  }

  // Détail complet d'une visite par id — alimente la modale "Relevé de
  // réception" (Sprint C6, audit §10) quand elle est ouverte depuis
  // Historique plutôt que depuis "Qualité des réceptions" (qui a déjà la
  // visite entièrement chargée en mémoire et n'a donc pas besoin de cette
  // fonction). Même structure de retour que chargerDerniereVisite.
  async function chargerVisiteDetail(client, visiteId) {
    const { data: visite, error: e1 } = await client.from('carburant_reception_visites')
      .select('*').eq('id', visiteId).maybeSingle();
    if (e1 || !visite) { console.error('Chargement détail visite réception carburant:', e1); return null; }
    const [{ data: lignes, error: e2 }, { data: compartiments, error: e3 }, { data: mesures, error: e4 }] = await Promise.all([
      client.from('carburant_reception_visite_lignes').select('*').eq('visite_id', visite.id),
      client.from('carburant_reception_compartiments').select('*').eq('visite_id', visite.id).order('numero', { ascending: true }),
      client.from('carburant_reception_mesures').select('*').eq('visite_id', visite.id),
    ]);
    if (e2 || e3 || e4) console.error('Chargement détail visite réception carburant:', e2 || e3 || e4);
    return { ...visite, lignes: lignes || [], compartiments: compartiments || [], mesures: mesures || [] };
  }

  global.NexusReceptionDonnees = {
    chargerConfigReception,
    chargerHistoriqueEcartsRatio,
    soumettreVisiteComplete,
    chargerDerniereVisite,
    chargerHistoriqueVisites,
    chargerVisiteDetail,
  };
})(typeof window !== 'undefined' ? window : globalThis);
