// ============================================================
// NEXUS Conseiller — colle Supabase partagée (11/08/2026)
//
// Refactoring des pages monolithiques (audit "philosophie/architecture"),
// 2e page traitée après NEXUS-Brief-v1.html : NEXUS-Cockpit-v2.html. La
// cartographie de Brief avait déjà signalé (v2.40) que 5 chargeurs
// existaient en copies identiques dans les deux pages ; plutôt que de les
// dupliquer une deuxième fois dans un futur `nexus-cockpit-donnees.js`,
// ils sortent ici dans un fichier réellement partagé, sur le modèle de
// nexus-carburant-donnees.js / nexus-coach-fdj-donnees.js.
//
// Les 3 candidats normalisés (Caisse/Stock/Rappels) alimentent le même
// classement fusionné NexusConseiller.fusionnerEtSelectionner() sur
// NEXUS-Cockpit-v2.html (Le Conseiller) et NEXUS-Brief-v1.html (Décisions
// de direction) — Article 11 : une seule vérité, que le manager la lise
// depuis l'un ou l'autre écran. AUCUN calcul ici (comme toujours pour un
// fichier `-donnees.js`) : chaque fonction charge des lignes brutes et
// délègue au moteur partagé (NexusStock, NexusConseiller) pour l'analyse.
//
// chargerJournalDecisions() retourne { journal, validees } plutôt que de
// modifier un état de page par effet de bord — c'est à l'appelant
// (Brief, Cockpit, ou toute future page) d'assigner le résultat à ses
// propres variables.
//
// Inclure après nexus-stock.js et nexus-conseiller.js, et AVANT tout
// fichier `-donnees.js` de page qui en dépend (nexus-brief-donnees.js) :
// <script src="nexus-conseiller-donnees.js"></script>
// ------------------------------------------------------------

(function (global) {
  // Pagination générique par lots de 1000 lignes — Supabase plafonne
  // chaque requête à 1000 lignes par défaut, sans erreur ; au-delà, le
  // reste est silencieusement absent (trouvé le 15/07/2026 sur un import
  // T2 qui dépassait 1000 lignes de `products`).
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

  async function chargerProduitsAppel(client, siteId) {
    const { data, error } = await client.from('produits_appel').select('article').eq('site', siteId);
    if (error) { console.error('Chargement produits d’appel:', error); return new Set(); }
    return new Set((data || []).map(r => r.article));
  }

  // Lignes `products` brutes de la période, MOINS les produits d'appel
  // (exclus des recommandations — voir nexus-marge.js/NexusMarge pour la
  // logique de familleMarge ailleurs dans NEXUS). Utilisé tel quel par
  // Brief (nexus-brief-donnees.js::chargerProducts) et par Cockpit
  // (construirePlansAction), qui faisaient jusqu'ici chacun leur propre
  // copie de ce même Promise.all + filtre.
  async function chargerProduitsBrut(client, siteId) {
    const [{ data, error }, produitsAppel] = await Promise.all([
      fetchAllRows(() => client.from('products')
        .select('categorie, article, ca, marge, quantite, periode_debut, periode_fin')
        .eq('site', siteId).order('periode_debut', { ascending: false }).order('article', { ascending: true })),
      chargerProduitsAppel(client, siteId),
    ]);
    if (error || !data) { console.error('Chargement products:', error); return []; }
    return data.filter(r => !produitsAppel.has(r.article));
  }

  // Journal des décisions — retourne { journal, validees } plutôt que de
  // modifier un état de page par effet de bord (voir note en tête de
  // fichier).
  async function chargerJournalDecisions(client, siteId) {
    const { data, error } = await fetchAllRows(() => client
      .from('journal_decisions').select('*').eq('site', siteId).order('created_at', { ascending: false }));
    if (error) { console.error('Chargement journal_decisions:', error); return { journal: [], validees: new Set() }; }
    const journal = data || [];
    return { journal, validees: new Set(journal.map(d => d.candidate_id)) };
  }

  // Candidats Caisse — source : v_caisse_ecart_a_traiter (anomalie/
  // critique, 14 derniers jours), normalisée par
  // NexusConseiller.normaliserCaissePersonne (nomme l'employé quand le
  // quart n'a qu'une seule personne identifiée). Retourne { raw, normalises } :
  // Brief a besoin des deux (raw pour compter les critiques dans le secteur
  // Opérations, sans reformuler la même requête — Article 11), Cockpit ne
  // consomme que normalises.
  async function chargerCandidatsCaisse(client, siteId) {
    const { data, error } = await fetchAllRows(() => client.from('v_caisse_ecart_a_traiter').select('*').eq('site', siteId));
    if (error) { console.error('Chargement v_caisse_ecart_a_traiter:', error); return { raw: [], normalises: [] }; }
    return { raw: data || [], normalises: (data || []).map(global.NexusConseiller.normaliserCaissePersonne) };
  }

  // Candidats Stock — même calcul par référence que
  // NEXUS-Scanner-Stock-v1.html (nexus-stock.js, source unique), agrégé
  // par rayon puis normalisé par NexusConseiller.normaliserStockRayon.
  async function chargerCandidatsStock(client, siteId) {
    const { data: releves, error: err1 } = await fetchAllRows(() => client
      .from('stock_releves').select('article, categorie, quantite_theorique, releve_le').eq('site', siteId)
      .order('releve_le', { ascending: true }).order('article', { ascending: true }));
    if (err1 || !releves || !releves.length) { if (err1) console.error('Chargement stock_releves:', err1); return []; }
    const { data: ventes } = await fetchAllRows(() => client.from('products')
      .select('article, quantite, prix_vente, periode_debut, periode_fin').eq('site', siteId).order('article', { ascending: true }));
    const { data: controles } = await fetchAllRows(() => client.from('controles_stock')
      .select('article, ecart, controle_le').eq('site', siteId).order('controle_le', { ascending: false }).order('article', { ascending: true }));
    const analyse = global.NexusStock.calculerAnalyseStock(releves, ventes, controles);
    const parRayon = global.NexusStock.calculerRisqueParRayon(analyse);
    return parRayon.map(global.NexusConseiller.normaliserStockRayon);
  }

  // Candidats Rappels — ne remonte que les rappels non faits du site (voir
  // normaliserRappel() pour le rang, retard ou non).
  async function chargerCandidatsRappels(client, siteId) {
    const { data, error } = await fetchAllRows(() => client.from('rappels').select('*').eq('site', siteId).eq('fait', false)
      .order('date_echeance', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }));
    if (error) { console.error('Chargement rappels:', error); return []; }
    return (data || []).map(global.NexusConseiller.normaliserRappel);
  }

  global.NexusConseillerDonnees = {
    fetchAllRows,
    chargerProduitsAppel, chargerProduitsBrut,
    chargerJournalDecisions,
    chargerCandidatsCaisse, chargerCandidatsStock, chargerCandidatsRappels,
  };
})(typeof window !== 'undefined' ? window : globalThis);
