// ============================================================
// NEXUS Rapport de Direction — chargeurs Supabase complémentaires
// (11/08/2026, refonte demandée par Frédéric : le PDF de Rapport NEXUS
// devient un vrai rapport de direction 8-20 pages, plus un export 1 page
// de la Santé de l'entreprise).
//
// Ce fichier ne fait QUE de la colle Supabase pour les données qui
// manquaient encore à NEXUS-Rapport-v1.html/nexus-rapport-donnees.js :
// catégories Commerce, Opérations (Verify + Inventaire), Équipe,
// Trajectoire mensuelle. Chaque fonction réutilise un moteur pur déjà
// existant pour le calcul (Article 11) — jamais une deuxième formule.
//
// Comme nexus-rapport-donnees.js : disponible:false plutôt qu'un chiffre
// fabriqué dès qu'une source n'a rien pour la période demandée.
//
// Dépendances (à charger avant) : nexus-periodes.js, nexus-rayon-moteur.js,
// nexus-verify-moteur.js.
// ------------------------------------------------------------

(function (global) {
  async function fetchAllRows(builderFactory, pageSize = 1000) {
    let toutes = [];
    let from = 0;
    while (true) {
      const { data, error } = await builderFactory().range(from, from + pageSize - 1);
      if (error) return { data: null, error };
      toutes = toutes.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return { data: toutes, error: null };
  }

  /**
   * Catégories Commerce — charge TOUTES les lignes `products` du site (pas
   * de filtre de période : NexusRayonMoteur/analyserPeriodes trouve
   * lui-même la période affichée la plus récente et sa paire comparable,
   * exactement comme NEXUS-Rayon-v1.html). Le chapitre Commerce du Rapport
   * affiche donc la même "période affichage" que l'écran Rayon — pas
   * forcément identique à la période choisie par le manager pour le
   * Rapport, ce que le chapitre doit indiquer explicitement (même
   * limitation documentée que chargerCaPeriode/chargerMargePeriode dans
   * nexus-rapport-donnees.js pour `products`).
   */
  async function chargerCommerceCategories(client, site) {
    const { data, error } = await fetchAllRows(() => client
      .from('products')
      .select('categorie, article, ca, marge, periode_debut, periode_fin')
      .eq('site', site)
      .order('periode_debut', { ascending: false })
      .order('article', { ascending: true }));
    if (error || !data || !data.length) return { disponible: false, raison: 'Aucune ligne products pour ce site.' };
    const { rayons, magasin } = global.NexusRayonMoteur.construireRayonsDepuisLignes(data);
    if (!magasin) return { disponible: false, raison: 'Aucune période exploitable dans products.' };
    return { disponible: true, rayons, magasin };
  }

  /**
   * Opérations — agrège deux sources déjà existantes ailleurs dans NEXUS,
   * jamais une troisième formule :
   *  - Verify (`audits_caisse`) : classification d'écart de
   *    nexus-verify-moteur.js (identique à NEXUS-Verify-v1.html).
   *  - Inventaire : RPC `generate_inventory_review` déjà utilisé par
   *    NEXUS-Inventaire-Manager-v1.html pour ses vues semaine/mois — ce
   *    fichier ne fait qu'appeler le même RPC, aucun recalcul côté client.
   *    Le type de synthèse demandé au RPC dépend du type de période du
   *    Rapport (mapping documenté : semaine→'weekly', mois→'monthly',
   *    trimestre/année/libre→'monthly', faute d'un type dédié côté RPC —
   *    limite connue, à corriger si un type 'custom' est ajouté au RPC).
   */
  async function chargerOperationsPeriode(client, site, periode) {
    const { data: audits, error: eVerify } = await client
      .from('audits_caisse')
      .select('date, quart, ecart_piste, ecart_boutique, statut, commentaire')
      .eq('site', site).gte('date', periode.debut).lte('date', periode.fin);
    const verify = (!eVerify && audits) ? { disponible: true, ...global.NexusVerifyMoteur.agregerAudits(audits) } : { disponible: false, raison: 'Aucun contrôle Verify sur cette période.' };

    const typeRevue = periode.type === 'semaine' ? 'weekly' : 'monthly';
    let inventaire = { disponible: false, raison: 'Synthèse inventaire indisponible pour cette période.' };
    try {
      const { data: review, error: eInv } = await client.rpc('generate_inventory_review', {
        p_site: site, p_period_start: periode.debut, p_period_end: periode.fin, p_review_type: typeRevue,
      });
      if (!eInv && review) inventaire = { disponible: true, ...review };
    } catch (e) {
      console.error('Rapport de Direction — chargement Inventaire (RPC):', e);
    }

    return { verify, inventaire };
  }

  /**
   * Équipe — agrégat collectif (pas par employé, à la différence de
   * nexus-progression.js qui est conçu pour un profil individuel) :
   * ponctualité (part des arrivées sans retard), missions (assignées vs
   * terminées), collaborateurs actifs (distincts vus dans les pointages de
   * la période) — tout filtré par date, ce qu'aucun chargeur existant ne
   * fait aujourd'hui (nexus-progression.js/chargerDomaineEquipe chargent
   * tout l'historique, jamais une période, voir cartographie du
   * 11/08/2026). Incidents = contrôles Verify critiques de la période,
   * réutilisés depuis chargerOperationsPeriode par l'appelant plutôt que
   * recalculés ici.
   */
  async function chargerEquipePeriode(client, site, periode) {
    const { data: pointages, error: eP } = await client
      .from('pointages')
      .select('employee_id, type, retard_min, date')
      .eq('site', site).eq('type', 'arrivee')
      .gte('date', periode.debut).lte('date', periode.fin);
    const { data: missions, error: eM } = await client
      .from('mission_assignments')
      .select('assigned_to_employee_id, status, due_at, updated_at')
      .eq('site', site)
      .gte('due_at', periode.debut).lte('due_at', periode.fin);

    if (eP && eM) return { disponible: false, raison: 'Aucune donnée équipe accessible sur cette période.' };

    const pts = pointages || [];
    const nbPointages = pts.length;
    const nbRetards = pts.filter(p => (p.retard_min || 0) > 0).length;
    const tauxPonctualite = nbPointages > 0 ? 1 - (nbRetards / nbPointages) : null;
    const collaborateursActifs = new Set(pts.map(p => p.employee_id)).size;

    const mis = missions || [];
    const nbMissions = mis.length;
    const nbMissionsTerminees = mis.filter(m => m.status === 'completed' || m.status === 'termine' || m.status === 'terminee').length;
    const tauxMissions = nbMissions > 0 ? nbMissionsTerminees / nbMissions : null;

    const disponible = nbPointages > 0 || nbMissions > 0;
    return {
      disponible,
      raison: disponible ? null : 'Aucun pointage ni mission enregistrés sur cette période.',
      nbPointages, nbRetards, tauxPonctualite, collaborateursActifs,
      nbMissions, nbMissionsTerminees, tauxMissions,
    };
  }

  /**
   * Trajectoire mensuelle — charge TOUTES les lignes `products` du site et
   * les regroupe par mois calendaire (nexus-periodes.js/
   * regrouperParMoisCalendaire, méthode "affectation au mois du début de
   * bloc", documentée dans ce fichier). Ne couvre que la profondeur
   * réellement présente dans `products` (aujourd'hui : janvier→août 2026,
   * par blocs irréguliers) — jamais 12 mois pleins tant que l'historique
   * n'existe pas, jamais de comparaison N-1 tant qu'aucune donnée
   * n'existe avant 2026 pour ce site.
   */
  async function chargerTrajectoire(client, site) {
    const { data, error } = await fetchAllRows(() => client
      .from('products')
      .select('ca, marge, periode_debut, periode_fin')
      .eq('site', site)
      .order('periode_debut', { ascending: true }));
    if (error || !data || !data.length) return { disponible: false, raison: 'Aucune ligne products pour ce site.' };
    const regroupement = global.NexusPeriodes.regrouperParMoisCalendaire(data);
    if (!regroupement.mois.length) return { disponible: false, raison: 'Aucun mois exploitable dans products.' };
    return { disponible: true, ...regroupement };
  }

  global.NexusRapportDirectionDonnees = {
    chargerCommerceCategories,
    chargerOperationsPeriode,
    chargerEquipePeriode,
    chargerTrajectoire,
  };
})(window);
