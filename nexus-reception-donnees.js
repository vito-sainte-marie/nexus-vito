// ============================================================
// NEXUS Carburants — Réceptions — colle Supabase (14/08/2026)
//
// Même discipline que nexus-carburant-donnees.js (Article 11) : ce fichier
// ne fait AUCUN calcul, il charge/écrit les lignes brutes et délègue tout
// calcul à nexus-reception-moteur.js. Consommé par :
//   - NEXUS-Carburant-Reception-v1.html (parcours employé, 6 étapes)
//   - NEXUS-Carburants-Pilotage-v1.html (sous-bloc "Qualité des réceptions")
//
// Tables (migration "carburant_receptions_p1", 14/08/2026) :
//   carburant_receptions (1 ligne par carburant livré)
//   carburant_reception_mesures (1 ligne par cuve de destination)
//
// Inclure après nexus-reception-moteur.js :
// <script src="nexus-reception-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Cuves de destination possibles pour un carburant donné, lues depuis
  // station_config.cuves_carburants (même source que Carburants Pilotage —
  // jamais une deuxième liste de cuves codée en dur). Retourne [] si le
  // carburant n'est pas configuré actif sur ce site.
  async function chargerCuvesCarburant(client, siteId, carburant) {
    const { data, error } = await client.from('station_config').select('cuves_carburants').eq('site', siteId).maybeSingle();
    if (error) { console.error('Chargement cuves carburant (réception):', error); return []; }
    const cfg = data && data.cuves_carburants && data.cuves_carburants[carburant];
    if (!cfg || !cfg.actif || !Array.isArray(cfg.cuves)) return [];
    return cfg.cuves;
  }

  // Soumission atomique complète d'une réception (audit : "L'employé saisit
  // les faits" en UNE fois — jamais un enregistrement partiel qui
  // nécessiterait ensuite un droit de modification employé). `entete` = les
  // colonnes de carburant_receptions (site, carburant, date_livraison,
  // heure_debut, heure_fin, transporteur, chauffeur, immatriculation,
  // quantite_bl_l, bon_livraison_reference, employe_id, statut). `mesures` =
  // tableau de lignes carburant_reception_mesures SANS reception_id (ajouté
  // ici après la création de l'en-tête). Si l'insertion des mesures échoue
  // après la création de l'en-tête, l'en-tête orpheline est supprimée
  // plutôt que laissée dans un état à moitié écrit (pas de vraie
  // transaction multi-tables côté client Supabase, donc on nettoie
  // explicitement en cas d'échec partiel).
  async function insererReceptionComplete(client, entete, mesures) {
    const { data: recu, error: eEntete } = await client.from('carburant_receptions').insert(entete).select().single();
    if (eEntete) { console.error('Création réception carburant:', eEntete); return { error: eEntete }; }

    const lignesMesures = (mesures || []).map(m => ({ ...m, reception_id: recu.id, site: entete.site }));
    const { error: eMesures } = await client.from('carburant_reception_mesures').insert(lignesMesures);
    if (eMesures) {
      console.error('Création mesures réception carburant:', eMesures);
      await client.from('carburant_receptions').delete().eq('id', recu.id);
      return { error: eMesures };
    }
    return { data: recu };
  }

  // Dernière réception d'un site (tous carburants confondus), avec ses
  // mesures — alimente le sous-bloc "Qualité des réceptions" de Carburants
  // Pilotage. Retourne null si aucune réception n'a jamais été saisie.
  async function chargerDerniereReception(client, siteId) {
    const { data: reception, error: e1 } = await client.from('carburant_receptions')
      .select('*').eq('site', siteId)
      .order('date_livraison', { ascending: false }).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (e1) { console.error('Chargement dernière réception carburant:', e1); return null; }
    if (!reception) return null;
    const { data: mesures, error: e2 } = await client.from('carburant_reception_mesures')
      .select('*').eq('reception_id', reception.id).order('cuve_id', { ascending: true });
    if (e2) { console.error('Chargement mesures dernière réception carburant:', e2); return { ...reception, mesures: [] }; }
    return { ...reception, mesures: mesures || [] };
  }

  // Historique des réceptions sur une période — même esprit que
  // chargerHistoriquePointsZero de Carburants Pilotage (liste chronologique
  // simple, aucun filtre silencieux). `limite` par défaut 10.
  async function chargerHistoriqueReceptions(client, siteId, limite) {
    const { data, error } = await client.from('carburant_receptions')
      .select('*').eq('site', siteId)
      .order('date_livraison', { ascending: false }).order('created_at', { ascending: false })
      .limit(limite || 10);
    if (error) { console.error('Chargement historique réceptions carburant:', error); return []; }
    return data || [];
  }

  global.NexusReceptionDonnees = {
    chargerCuvesCarburant,
    insererReceptionComplete,
    chargerDerniereReception,
    chargerHistoriqueReceptions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
