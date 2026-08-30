// NEXUS Inventaire V2 — Sprint 2 "Génération des missions" (29/08/2026,
// suite de la doctrine "NEXUS Inventaire V2" — Frédéric a confirmé
// "ok sprint 2"). Colle Supabase pour la table `inventaire_missions` —
// l'instance FIGÉE d'une mission_rule (Sprint 1) pour un (site, date,
// quart, moment) donné, avec son rôle affecté et son périmètre produit.
//
// Toute la logique de RÉSOLUTION (quelle règle s'applique, quel rôle est
// affecté, quel périmètre produit) reste dans nexus-inventaire-moteur.js
// (Article 11) — ce fichier ne fait que réunir les ingrédients déjà
// chargés ailleurs et persister le résultat UNE fois, jamais recalculé au
// rechargement (même philosophie que nexus-inventaire-plan-donnees.js
// ::chargerOuGenererPlan).
//
// Portée explicite de ce sprint (Frédéric, ordre de développement) :
// "Paramètres → Génération des missions → Expérience employé → Deux
// jauges → Répartition par rôles."
//
// 29/08/2026, Sprint 3 "Expérience employé" — correction déterminante avant
// de brancher NEXUS-Inventaire-v1.html : genererOuChargerMissions source
// désormais son périmètre depuis le PLAN déjà généré
// (NexusInventairePlanDonnees.chargerOuGenererPlan), jamais depuis le
// catalogue actif brut (voir commentaire détaillé sur la fonction). C'est
// ce fichier que consomme désormais l'écran employé, via
// chargerMissionsPourRole (rôle du jour + quart courant).

(function (global) {
  'use strict';

  // Missions déjà générées pour ce (site, date, quart), triées par moment
  // du quart puis par ordre de création — jamais un ordre différent d'un
  // rechargement à l'autre.
  async function chargerMissionsExistantes(client, site, dateISO, quart) {
    const { data, error } = await client.from('inventaire_missions')
      .select('*').eq('site', site).eq('date', dateISO).eq('quart', quart)
      .order('moment_code', { ascending: true }).order('created_at', { ascending: true });
    if (error) { console.error('Chargement missions Inventaire:', error); return []; }
    return data || [];
  }

  // Génère (si absent) puis retourne les missions du (site, date, quart).
  // Un seul appelant gagne la course grâce à la contrainte unique
  // (site,date,quart,mission_rule_id,moment_code) : si un autre employé a
  // généré les missions entre-temps, l'insertion échoue et on relit
  // simplement ce qui existe plutôt que d'échouer (même comportement que
  // chargerOuGenererPlan pour inventaire_plans_comptage).
  async function genererOuChargerMissions(client, site, dateISO, quart) {
    const existantes = await chargerMissionsExistantes(client, site, dateISO, quart);
    if (existantes.length) return existantes;

    const M = global.NexusInventaireMoteur;
    const MR = global.NexusInventaireMissionRulesDonnees;
    const PD = global.NexusInventairePlanDonnees;
    if (!M || !MR || !PD) {
      console.error('Dépendances manquantes (NexusInventaireMoteur/NexusInventaireMissionRulesDonnees/NexusInventairePlanDonnees) — génération des missions impossible.');
      return [];
    }

    const [missionRules, rolesPresents, plan, ingredients, surprisesRecentesParProduit] = await Promise.all([
      MR.chargerMissionRules(client, site),
      MR.chargerRolesPresentsQuart(client, site, dateISO, quart),
      PD.chargerOuGenererPlan(client, site, dateISO, quart),
      PD.chargerIngredientsSelection(client, site, dateISO),
      // 30/08/2026 (Rotation intelligente, Étape 2 "données") : seul le mode
      // 'intelligent' consomme ces ingrédients (via le contexte transmis à
      // genererMissionsPourContexte ci-dessous) — 'complet'/'tournant' les
      // ignorent, exactement comme le moteur pur le prévoit déjà (contexte
      // optionnel). `chargerSurprisesRecentes` est la MÊME fonction déjà
      // utilisée par chargerOuGenererPlan pour le plan tournant (Article 11 :
      // une seule notion de "surprise récente", partagée entre le plan
      // journalier et les missions — jamais un second compteur parallèle).
      // Filet de sécurité (typeof) si un appelant/mock plus ancien fournit un
      // NexusInventairePlanDonnees sans cette fonction : traité comme "aucune
      // surprise récente connue", jamais une exception qui casserait toute la
      // génération des missions pour une info secondaire (Article 5).
      typeof PD.chargerSurprisesRecentes === 'function'
        ? PD.chargerSurprisesRecentes(client, site, dateISO)
        : Promise.resolve([]),
    ]);

    // Correction déterminante (29/08/2026, avant Sprint 3) : le périmètre
    // d'une mission doit TOUJOURS être un sous-ensemble du besoin déjà
    // décidé par NEXUS pour ce quart — le plan de comptage
    // (construirePlanComptage, socle+surprises, fréquence/anomalies déjà
    // arbitrées) — jamais un recalcul indépendant sur tout le catalogue
    // actif d'une catégorie. C'est exactement l'articulation de la
    // doctrine de Frédéric : "CONTRÔLES NEXUS" (le plan) décide le besoin,
    // "RÉPARTITION" (les missions) ne fait que le découper par rôle.
    // Sprint 2 (v2.289) filtrait à tort sur `chargerIngredientsSelection`
    // (tout le catalogue actif) — deux missions auraient pu réclamer des
    // produits que le plan n'avait même pas sélectionnés aujourd'hui.
    // `inventaire_zone_produit` est déjà joint sur chaque item du plan
    // (nexus-inventaire-plan-donnees.js::chargerPlanExistant) — jamais une
    // deuxième lecture du catalogue ici (Article 11).
    const itemsPlan = (plan && plan.items) || [];
    const produitsDuPlan = itemsPlan.map(it => ({
      id: it.produit_id,
      categorie_id: it.inventaire_zone_produit ? it.inventaire_zone_produit.categorie_id : null,
      zone_id: it.inventaire_zone_produit ? it.inventaire_zone_produit.zone_id : null,
    }));

    const missionsCalculees = M.genererMissionsPourContexte({
      missionRules, rolesPresents, quart,
      produitsActifs: produitsDuPlan,
      dernierControleParProduit: ingredients.dernierControleParProduit,
      seed: `${site}|${dateISO}|${quart}`,
      // Ingrédients supplémentaires (30/08/2026, mode 'intelligent') — tous
      // déjà chargés ci-dessus pour le plan tournant, jamais une deuxième
      // lecture parallèle (Article 11). Sans effet sur les mission_rules en
      // mode 'complet'/'tournant' (le moteur pur les ignore silencieusement).
      dateISO,
      reglesParProduit: ingredients.reglesParProduit,
      produitsAvecAnomalieRecente: ingredients.produitsAvecAnomalieRecente,
      anomaliesDetailParProduit: ingredients.anomaliesDetailParProduit,
      surprisesRecentesParProduit,
    });

    if (!missionsCalculees.length) return [];

    const { error: errInsert } = await client.from('inventaire_missions').insert(
      missionsCalculees.map(m => ({
        site, date: dateISO, quart, moment_code: m.momentCode,
        mission_rule_id: m.missionRuleId, nom: m.nom, role_affecte: m.roleAffecte,
        via_repli: m.viaRepli, statut: m.statut,
        strategie_appliquee: m.strategieAppliquee, produit_ids: m.produitIds,
      }))
    );

    if (errInsert) {
      // Course entre deux employés (contrainte unique violée) ou autre —
      // on relit ce qui existe plutôt que de fabriquer un doublon ou
      // planter (même filet de sécurité que chargerOuGenererPlan).
      const relues = await chargerMissionsExistantes(client, site, dateISO, quart);
      if (relues.length) return relues;
      console.error('Génération missions Inventaire:', errInsert);
      return [];
    }

    return chargerMissionsExistantes(client, site, dateISO, quart);
  }

  // Missions AFFECTÉES à un rôle donné pour ce (site, date, quart) — le
  // point d'entrée que consommera l'écran employé du Sprint 3 ("mes
  // missions aujourd'hui"). Ne génère jamais elle-même : appelle
  // genererOuChargerMissions en amont si les missions n'existent pas
  // encore pour ce quart (même geste que l'écran Inventaire actuel qui
  // appelle chargerOuGenererPlan avant de lire son plan).
  async function chargerMissionsPourRole(client, site, dateISO, quart, roleCode) {
    const toutes = await genererOuChargerMissions(client, site, dateISO, quart);
    return toutes.filter(m => m.statut === 'affectee' && m.role_affecte === roleCode);
  }

  // ------------------------------------------------------------
  // Sprint 5 "Rapprochement Decenium ↔ Missions" (29/08/2026, Frédéric a
  // confirmé "continue" après le Scénario de référence Sainte-Marie).
  // `inventaire_rapprochements` est déjà calculée par quart_id+produit_id à
  // l'import Decenium (NEXUS-Inventaire-Manager-v1.html) — jamais un second
  // calcul ici (Article 11), uniquement une lecture + un découpage par
  // périmètre de mission (NexusInventaireMoteur.rapprochementsPourPerimetre
  // + syntheseQualiteRapprochements, déjà existante avant ce sprint).
  // Usage manager exclusivement : la doctrine interdit à l'employé de voir
  // toute notion de fiabilité/qualité de rapprochement (jamais confondue
  // avec la Couverture qu'il voit, lui, dans "Mes missions").
  // ------------------------------------------------------------
  async function chargerRapprochementsPourMissions(client, site, dateISO, quart, missions) {
    const M = global.NexusInventaireMoteur;
    const liste = missions || [];
    if (!M || !liste.length) return liste;

    const { data: quartRow, error: e1 } = await client.from('inventaire_quarts')
      .select('id').eq('site', site).eq('date', dateISO).eq('quart', quart).maybeSingle();
    if (e1) { console.error('Chargement quart (rapprochement missions):', e1); return liste; }
    if (!quartRow) return liste; // quart pas encore ouvert -> aucun rapprochement possible, pas une erreur (Article 5)

    const { data: rapprochements, error: e2 } = await client.from('inventaire_rapprochements')
      .select('produit_id, statut_validation, ecart').eq('quart_id', quartRow.id);
    if (e2) { console.error('Chargement rapprochements (missions):', e2); return liste; }

    // Aucun rapprochement importé pour ce quart -> missions rendues telles
    // quelles, SANS champ `rapprochement` (jamais un faux "0 fiable, 0
    // provisoire" qui laisserait croire à un calcul déjà fait, Article 5).
    if (!rapprochements || !rapprochements.length) return liste;

    return liste.map(m => {
      const lignesMission = M.rapprochementsPourPerimetre(m.produit_ids || [], rapprochements);
      if (!lignesMission.length) return m; // rien d'importé sur CE périmètre précis -> pas de champ ajouté
      return { ...m, rapprochement: M.syntheseQualiteRapprochements(lignesMission) };
    });
  }

  global.NexusInventaireMissionsDonnees = {
    chargerMissionsExistantes, genererOuChargerMissions, chargerMissionsPourRole,
    chargerRapprochementsPourMissions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
