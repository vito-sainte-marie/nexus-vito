// NEXUS Inventaire — colle Supabase pour le plan de comptage tournant
// (cahier "Inventaire 2.0", 17/08/2026, Sprint 2 ; complété 18/08/2026,
// Sprint 5, par chargerCouverturePhysique). Partagé par l'écran employé
// (NEXUS-Inventaire-v1.html, consomme le plan) et l'écran manager
// (NEXUS-Inventaire-Manager-v1.html, lit la couverture physique 7/14/30
// jours, cahier §11/INV2-18). Toute la logique de SÉLECTION/CALCUL reste
// dans nexus-inventaire-moteur.js (Article 11) ; ce fichier ne fait que
// charger ce qu'il faut au moteur puis persister son résultat une seule
// fois pour le plan (jamais recalculé au rechargement — critère de recette
// INV2-04) — la couverture, elle, est un calcul de lecture pure, recalculée
// à chaque affichage manager comme les autres synthèses de cet écran.

(function (global) {
  'use strict';

  const FENETRE_ANOMALIE_RECENTE_JOURS = 7;
  const FENETRE_SURPRISE_RECENTE_JOURS = 7;
  const SOCLE_PAR_DEFAUT = 20;
  const SURPRISES_PAR_DEFAUT = 4;

  function isoMoinsJours(dateISO, jours) {
    const d = new Date(dateISO + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - jours);
    return d.toISOString().slice(0, 10);
  }

  // Plan déjà généré pour ce (site, date, quart), avec ses items enrichis du
  // détail produit nécessaire à l'affichage (désignation, catégorie, zone,
  // comptage_deux_lieux) — jamais une deuxième requête séparée pour chaque
  // produit du plan.
  async function chargerPlanExistant(client, site, date, quart) {
    const { data: plan, error } = await client.from('inventaire_plans_comptage')
      .select('*').eq('site', site).eq('date', date).eq('quart', quart).maybeSingle();
    if (error) { console.error('Chargement plan comptage:', error); return null; }
    if (!plan) return null;
    const { data: items, error: errItems } = await client.from('inventaire_plan_items')
      .select('*, inventaire_zone_produit(id, designation, code_barres, categorie_id, zone_id, comptage_deux_lieux, sensible, unite, ordre_affichage, actif)')
      .eq('plan_id', plan.id).order('ordre', { ascending: true });
    if (errItems) { console.error('Chargement items plan comptage:', errItems); return { plan, items: [] }; }
    return { plan, items: items || [] };
  }

  // Ingrédients nécessaires au moteur de sélection (nexus-inventaire-moteur.js
  // ::construirePlanComptage) — chaque requête lit une source déjà existante,
  // jamais une nouvelle vérité parallèle (Article 11).
  //
  // 20/08/2026 (Sprint "Catégorie porte les règles") : reglesParProduit
  // n'est plus la lecture brute de inventaire_regles_produit — c'est
  // désormais la règle EFFECTIVE de chaque produit (sa propre ligne si elle
  // existe, sinon celle de sa catégorie si `regle_active`, voir
  // NexusInventaireMoteur.construireReglesEffectivesParProduit). Le moteur
  // de sélection (construirePlanComptage) ne change pas : il continue de
  // recevoir un simple objet par produit, sans savoir d'où il vient.
  // Dernier point de référence Inventaire (21/08/2026, cutover production —
  // demande de Frédéric) : simple lecture de inventaire_points_reference,
  // le plus récent du type demandé pour ce site. `null` si aucun cutover
  // n'a encore eu lieu sur ce site (comportement historique intégral dans
  // ce cas — rien ne filtre les données, exactement comme avant ce lot).
  async function chargerDernierPointReference(client, site, type) {
    const { data, error } = await client.from('inventaire_points_reference')
      .select('id, site, type, date_heure, motif')
      .eq('site', site).eq('type', type || 'PRODUCTION_START')
      .order('date_heure', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Chargement point de référence Inventaire:', error); return null; }
    return data;
  }

  async function chargerIngredientsSelection(client, site, dateISO) {
    const cutover = await chargerDernierPointReference(client, site, 'PRODUCTION_START');
    // Anomalies récentes (21/08/2026, cutover) : deux garde-fous indépendants
    // contre la remontée d'anciennes données de test — (1) seules les
    // alertes encore ACTIVES comptent (le filtre statut manquait jusqu'ici,
    // bug réel trouvé en creusant le cutover : une alerte résolue continuait
    // de forcer un recomptage jusqu'à 7 jours après sa résolution) ; (2) si
    // un cutover existe, on ignore aussi tout ce qui est antérieur, même
    // actif — défense en profondeur explicitement demandée par Frédéric
    // contre un futur changement de code qui referait remonter l'historique
    // de test par erreur. Les deux bornes (fenêtre 7 jours, cutover) sont
    // combinées en un seul seuil (le plus récent des deux), jamais deux
    // filtres empilés sur la même colonne.
    const seuilFenetre = isoMoinsJours(dateISO, FENETRE_ANOMALIE_RECENTE_JOURS);
    const seuilAnomalie = (cutover && cutover.date_heure && cutover.date_heure > seuilFenetre)
      ? cutover.date_heure : seuilFenetre;
    const [{ data: produits, error: e1 }, { data: regles, error: e2 }, { data: derniers, error: e3 }, { data: alertes, error: e4 }, { data: reglesCategorie, error: e5 }] = await Promise.all([
      // zone_id ajouté le 29/08/2026 (Inventaire V2 Sprint 2, générateur de
      // missions) — additif, purement lu en plus par les nouveaux
      // consommateurs (nexus-inventaire-missions-donnees.js) qui filtrent le
      // périmètre d'une mission par zone en plus de la catégorie ; les
      // consommateurs existants (sélection socle/surprises) l'ignorent
      // simplement (Article 11 : une seule requête produits pour toute la
      // sélection Inventaire, jamais une deuxième lecture parallèle).
      client.from('inventaire_zone_produit').select('id, actif, categorie_id, zone_id').eq('site', site).eq('actif', true),
      client.from('inventaire_regles_produit').select('produit_id, frequence_controle, delai_max_jours_sans_controle, quarts_comptage').eq('site', site),
      client.from('view_inventaire_dernier_controle_produit').select('produit_id, dernier_controle_le').eq('site', site),
      // 'sous_observation'/'controle_manager_requis' ajoutés le 30/08/2026
      // (cycle "NEXUS observe avant de conclure") — SANS cet ajout, une
      // alerte fraîchement créée en Sous observation ne redéclencherait
      // jamais le contrôle aveugle du quart suivant qui doit la confirmer
      // ou l'infirmer : le cycle entier resterait bloqué à sa première
      // étape en silence (Article 5, catch fait avant livraison — jamais
      // après un signalement).
      client.from('inventaire_alertes').select('produit_id, gravite, cree_le')
        .eq('site', site).in('statut', ['ouverte', 'en_cours', 'sous_observation', 'controle_manager_requis']).gte('cree_le', seuilAnomalie),
      client.from('inventaire_categories').select('id, regle_active, frequence_controle, delai_max_jours_sans_controle, quarts_comptage').eq('site', site),
    ]);
    if (e1) console.error('Chargement produits (sélection plan):', e1);
    if (e2) console.error('Chargement règles produit (sélection plan):', e2);
    if (e3) console.error('Chargement derniers contrôles (sélection plan):', e3);
    if (e4) console.error('Chargement alertes récentes (sélection plan):', e4);
    if (e5) console.error('Chargement règles catégorie (sélection plan):', e5);

    const reglesParProduitId = {};
    (regles || []).forEach(r => { reglesParProduitId[r.produit_id] = r; });
    const reglesParCategorieId = {};
    (reglesCategorie || []).forEach(r => { reglesParCategorieId[r.id] = r; });
    const M = global.NexusInventaireMoteur;
    const reglesParProduit = M
      ? M.construireReglesEffectivesParProduit(produits || [], reglesParProduitId, reglesParCategorieId)
      : reglesParProduitId; // filet de sécurité si le moteur n'est pas chargé — comportement historique (règle produit brute uniquement)
    const dernierControleBrut = {};
    (derniers || []).forEach(d => { dernierControleBrut[d.produit_id] = d.dernier_controle_le; });
    const dernierControleParProduit = M && cutover
      ? M.appliquerCutoverControles(dernierControleBrut, cutover.date_heure)
      : dernierControleBrut;
    const produitsAvecAnomalieRecente = Array.from(new Set((alertes || []).map(a => a.produit_id).filter(Boolean)));
    const anomaliesDetailParProduit = M ? M.agregerAnomaliesParProduit(alertes || []) : {};

    return {
      produits: produits || [], reglesParProduit, dernierControleParProduit,
      produitsAvecAnomalieRecente, anomaliesDetailParProduit, cutover,
    };
  }

  // Produits déjà tirés en surprise récemment (cahier §5.2 étape 6 : éviter
  // qu'une même surprise revienne trop souvent) — lu via les plans déjà
  // persistés des derniers jours, jamais un compteur séparé à maintenir.
  async function chargerSurprisesRecentes(client, site, dateISO) {
    const { data: plansRecents, error: e1 } = await client.from('inventaire_plans_comptage')
      .select('id').eq('site', site).gte('date', isoMoinsJours(dateISO, FENETRE_SURPRISE_RECENTE_JOURS)).lt('date', dateISO);
    if (e1) { console.error('Chargement plans récents (surprises):', e1); return []; }
    const planIds = (plansRecents || []).map(p => p.id);
    if (!planIds.length) return [];
    const { data: items, error: e2 } = await client.from('inventaire_plan_items')
      .select('produit_id').in('plan_id', planIds).eq('raison_selection', 'surprise');
    if (e2) { console.error('Chargement items surprise récents:', e2); return []; }
    return Array.from(new Set((items || []).map(i => i.produit_id)));
  }

  // Génère (si absent) puis retourne le plan du (site, date, quart). Un seul
  // appelant gagne la course grâce à la contrainte unique (site,date,quart) :
  // si un autre employé a généré le plan entre-temps, l'insert échoue et on
  // relit simplement le plan existant plutôt que d'échouer (comportement
  // déjà établi ailleurs dans NEXUS pour obtenirOuCreerQuart).
  async function chargerOuGenererPlan(client, site, dateISO, quart, options) {
    const existant = await chargerPlanExistant(client, site, dateISO, quart);
    if (existant && existant.plan) return existant;

    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — impossible de générer le plan.'); return null; }

    const socleCible = (options && options.socleCible) || SOCLE_PAR_DEFAUT;
    const surprisesCible = (options && options.surprisesCible) != null ? options.surprisesCible : SURPRISES_PAR_DEFAUT;

    const [ingredients, surprisesRecentesParProduit] = await Promise.all([
      chargerIngredientsSelection(client, site, dateISO),
      chargerSurprisesRecentes(client, site, dateISO),
    ]);

    const resultat = M.construirePlanComptage({
      produits: ingredients.produits,
      reglesParProduit: ingredients.reglesParProduit,
      dernierControleParProduit: ingredients.dernierControleParProduit,
      produitsAvecAnomalieRecente: ingredients.produitsAvecAnomalieRecente,
      anomaliesDetailParProduit: ingredients.anomaliesDetailParProduit,
      quart, dateISO, socleCible, surprisesCible,
      seed: `${site}|${dateISO}|${quart}`,
      surprisesRecentesParProduit,
    });

    const { data: planCree, error: errPlan } = await client.from('inventaire_plans_comptage')
      .insert({ site, date: dateISO, quart, socle_cible: socleCible, surprises_cible: surprisesCible })
      .select().maybeSingle();

    if (errPlan || !planCree) {
      // Contrainte unique violée (course entre deux employés) ou autre — on
      // relit ce qui existe plutôt que de fabriquer un doublon ou planter.
      const relu = await chargerPlanExistant(client, site, dateISO, quart);
      if (relu && relu.plan) return relu;
      console.error('Génération plan comptage:', errPlan);
      return null;
    }

    if (resultat.items.length) {
      // Sprint 4 (20/08/2026) : regle_snapshot fige la règle EFFECTIVE de
      // chaque produit (ingredients.reglesParProduit, déjà résolue via la
      // cascade Site → Catégorie → Produit du Sprint 1) au moment précis de
      // la génération — jamais recalculée après coup, même si la catégorie
      // change en cours de quart. null = comportement par défaut (aucune
      // règle applicable à cet instant), une valeur réelle et significative,
      // pas une absence de donnée.
      const { error: errItems } = await client.from('inventaire_plan_items').insert(
        resultat.items.map(it => ({
          plan_id: planCree.id, site, produit_id: it.produit_id, raison_selection: it.raison_selection, obligatoire: it.obligatoire, ordre: it.ordre,
          regle_snapshot: ingredients.reglesParProduit[it.produit_id] || null,
        }))
      );
      if (errItems) console.error('Insertion items plan comptage:', errItems);
    }

    return chargerPlanExistant(client, site, dateISO, quart);
  }

  // Rappelée après chaque comptage validé (ouverture/clôture) pour que le
  // plan reflète la progression réelle — jamais un second calcul de ce qui
  // a été compté, uniquement un pointeur vers la ligne inventaire_comptages
  // déjà écrite.
  async function marquerItemPlanCompte(client, planItemId, comptageId) {
    const { error } = await client.from('inventaire_plan_items')
      .update({ statut: 'fait', comptage_id: comptageId, compte_le: new Date().toISOString() })
      .eq('id', planItemId);
    if (error) { console.error('Marquage item plan compté:', error); return false; }
    return true;
  }

  // Couverture physique 7/14/30 jours (cahier §11 "Couverture physique",
  // Sprint 7 anticipé ici puisque la donnée nécessaire —
  // view_inventaire_dernier_controle_produit — est déjà exploitée pour le
  // plan tournant (Sprint 2) : même source, jamais un second calcul du
  // dernier contrôle par produit (Article 11). Le calcul lui-même reste
  // dans nexus-inventaire-moteur.js::couverturePhysique — ce chargeur ne
  // fait que réunir les ingrédients.
  // 21/08/2026 (cutover production) : applique le même garde-fou que
  // chargerIngredientsSelection — un contrôle antérieur au dernier
  // PRODUCTION_START du site ne compte plus comme une couverture réelle,
  // sinon la couverture resterait artificiellement "à 100%" grâce à des
  // comptages de test qui n'ont plus vocation à représenter le terrain.
  async function chargerCouverturePhysique(client, site, dateISO, fenetreJours) {
    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — impossible de calculer la couverture.'); return null; }
    const [{ data: produitsActifs, error: e1 }, { data: derniers, error: e2 }, cutover] = await Promise.all([
      client.from('inventaire_zone_produit').select('id').eq('site', site).eq('actif', true),
      client.from('view_inventaire_dernier_controle_produit').select('produit_id, dernier_controle_le').eq('site', site),
      chargerDernierPointReference(client, site, 'PRODUCTION_START'),
    ]);
    if (e1) console.error('Chargement produits actifs (couverture):', e1);
    if (e2) console.error('Chargement derniers contrôles (couverture):', e2);
    const dernierControleBrut = {};
    (derniers || []).forEach(d => { dernierControleBrut[d.produit_id] = d.dernier_controle_le; });
    const dernierControleParProduit = cutover
      ? M.appliquerCutoverControles(dernierControleBrut, cutover.date_heure)
      : dernierControleBrut;
    return M.couverturePhysique({
      produitsActifs: produitsActifs || [], dernierControleParProduit, dateISO, fenetreJours,
    });
  }

  global.NexusInventairePlanDonnees = {
    SOCLE_PAR_DEFAUT, SURPRISES_PAR_DEFAUT,
    chargerPlanExistant, chargerOuGenererPlan, marquerItemPlanCompte,
    chargerCouverturePhysique, chargerDernierPointReference,
    // Exportées le 21/08/2026 pour l'aperçu "Prochain inventaire estimé" de
    // l'écran Paramètres (Accueil) — mêmes requêtes que la génération réelle
    // d'un plan (Article 11 : jamais une deuxième version de cette
    // sélection), simplement appelées en LECTURE SEULE pour prévisualiser
    // sans jamais persister de plan ni consommer une surprise.
    chargerIngredientsSelection, chargerSurprisesRecentes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
