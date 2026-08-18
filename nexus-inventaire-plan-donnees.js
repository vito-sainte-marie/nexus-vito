// NEXUS Inventaire — colle Supabase pour le plan de comptage tournant
// (cahier "Inventaire 2.0", 17/08/2026, Sprint 2). Partagé par l'écran
// employé (NEXUS-Inventaire-v1.html, consomme le plan) et l'écran manager
// (NEXUS-Inventaire-Manager-v1.html, pourra le lire pour la couverture —
// P1/Sprint 7, hors périmètre de ce lot). Toute la logique de SÉLECTION
// reste dans nexus-inventaire-moteur.js (Article 11) ; ce fichier ne fait
// que charger ce qu'il faut au moteur puis persister son résultat une seule
// fois (jamais recalculé au rechargement — critère de recette INV2-04).

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
  async function chargerIngredientsSelection(client, site, dateISO) {
    const [{ data: produits, error: e1 }, { data: regles, error: e2 }, { data: derniers, error: e3 }, { data: alertes, error: e4 }] = await Promise.all([
      client.from('inventaire_zone_produit').select('id, actif').eq('site', site).eq('actif', true),
      client.from('inventaire_regles_produit').select('produit_id, frequence_controle, delai_max_jours_sans_controle, quarts_comptage').eq('site', site),
      client.from('view_inventaire_dernier_controle_produit').select('produit_id, dernier_controle_le').eq('site', site),
      client.from('inventaire_alertes').select('produit_id').eq('site', site).gte('cree_le', isoMoinsJours(dateISO, FENETRE_ANOMALIE_RECENTE_JOURS)),
    ]);
    if (e1) console.error('Chargement produits (sélection plan):', e1);
    if (e2) console.error('Chargement règles produit (sélection plan):', e2);
    if (e3) console.error('Chargement derniers contrôles (sélection plan):', e3);
    if (e4) console.error('Chargement alertes récentes (sélection plan):', e4);

    const reglesParProduit = {};
    (regles || []).forEach(r => { reglesParProduit[r.produit_id] = r; });
    const dernierControleParProduit = {};
    (derniers || []).forEach(d => { dernierControleParProduit[d.produit_id] = d.dernier_controle_le; });
    const produitsAvecAnomalieRecente = Array.from(new Set((alertes || []).map(a => a.produit_id).filter(Boolean)));

    return { produits: produits || [], reglesParProduit, dernierControleParProduit, produitsAvecAnomalieRecente };
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
      const { error: errItems } = await client.from('inventaire_plan_items').insert(
        resultat.items.map(it => ({ plan_id: planCree.id, site, produit_id: it.produit_id, raison_selection: it.raison_selection, obligatoire: it.obligatoire, ordre: it.ordre }))
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

  global.NexusInventairePlanDonnees = {
    SOCLE_PAR_DEFAUT, SURPRISES_PAR_DEFAUT,
    chargerPlanExistant, chargerOuGenererPlan, marquerItemPlanCompte,
  };
})(typeof window !== 'undefined' ? window : globalThis);
