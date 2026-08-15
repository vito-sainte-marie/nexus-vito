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
// <script src="nexus-reception-donnees.js"></script>
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
      nombreCompartimentsDefaut: rc.nombre_compartiments_defaut != null ? rc.nombre_compartiments_defaut : 4,
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

  // Soumission atomique complète d'une visite (audit : "L'employé saisit
  // les faits" en UNE fois — même principe que le modèle v1). `visite` =
  // les colonnes de carburant_reception_visites. `lignes` = tableau de
  // carburant_reception_visite_lignes SANS visite_id. `compartiments` =
  // tableau de carburant_reception_compartiments SANS visite_id. `mesures`
  // = tableau de carburant_reception_mesures SANS visite_id. `anomalies` =
  // tableau de carburant_reception_anomalies SANS visite_id (peut être
  // vide — uniquement les anomalies réellement rencontrées, y compris déjà
  // levées par dérogation manager). Si un insert intermédiaire échoue après
  // la création de l'en-tête, l'en-tête orpheline est supprimée (pas de
  // vraie transaction multi-tables côté client Supabase) — même stratégie
  // de nettoyage explicite que le modèle v1.
  async function soumettreVisiteComplete(client, visite, lignes, compartiments, mesures, anomalies) {
    const { data: v, error: eVisite } = await client.from('carburant_reception_visites').insert(visite).select().single();
    if (eVisite) { console.error('Création visite réception carburant:', eVisite); return { error: eVisite }; }

    const nettoyer = async () => { await client.from('carburant_reception_visites').delete().eq('id', v.id); };

    const lignesAvecId = (lignes || []).map(l => ({ ...l, visite_id: v.id, site: visite.site }));
    const { error: eLignes } = await client.from('carburant_reception_visite_lignes').insert(lignesAvecId);
    if (eLignes) { console.error('Création lignes réception carburant:', eLignes); await nettoyer(); return { error: eLignes }; }

    const compartimentsAvecId = (compartiments || []).map(c => ({ ...c, visite_id: v.id, site: visite.site }));
    const { error: eCompartiments } = await client.from('carburant_reception_compartiments').insert(compartimentsAvecId);
    if (eCompartiments) { console.error('Création compartiments réception carburant:', eCompartiments); await nettoyer(); return { error: eCompartiments }; }

    const mesuresAvecId = (mesures || []).map(m => ({ ...m, visite_id: v.id, site: visite.site }));
    const { error: eMesures } = await client.from('carburant_reception_mesures').insert(mesuresAvecId);
    if (eMesures) { console.error('Création mesures réception carburant:', eMesures); await nettoyer(); return { error: eMesures }; }

    if (anomalies && anomalies.length) {
      const anomaliesAvecId = anomalies.map(a => ({ ...a, visite_id: v.id, site: visite.site }));
      const { error: eAnomalies } = await client.from('carburant_reception_anomalies').insert(anomaliesAvecId);
      if (eAnomalies) { console.error('Création anomalies réception carburant:', eAnomalies); await nettoyer(); return { error: eAnomalies }; }
    }

    return { data: v };
  }

  // Dernière visite d'un site, avec ses lignes/compartiments/mesures —
  // alimente le sous-bloc "Qualité des réceptions" de Carburants Pilotage.
  // Retourne null si aucune visite n'a jamais été saisie.
  async function chargerDerniereVisite(client, siteId) {
    const { data: visite, error: e1 } = await client.from('carburant_reception_visites')
      .select('*').eq('site', siteId)
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
  // filtre silencieux). `limite` par défaut 10.
  async function chargerHistoriqueVisites(client, siteId, limite) {
    const { data, error } = await client.from('carburant_reception_visites')
      .select('*').eq('site', siteId)
      .order('date_visite', { ascending: false }).order('created_at', { ascending: false })
      .limit(limite || 10);
    if (error) { console.error('Chargement historique visites réception carburant:', error); return []; }
    return data || [];
  }

  global.NexusReceptionDonnees = {
    chargerConfigReception,
    chargerHistoriqueEcartsRatio,
    soumettreVisiteComplete,
    chargerDerniereVisite,
    chargerHistoriqueVisites,
  };
})(typeof window !== 'undefined' ? window : globalThis);
