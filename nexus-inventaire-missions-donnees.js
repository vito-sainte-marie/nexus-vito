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
// jauges → Répartition par rôles." Ce fichier couvre UNIQUEMENT la
// génération — aucun écran ne l'appelle encore (Sprint 3 = expérience
// employé, qui consommera chargerMissionsPourRole).

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

    const [missionRules, rolesPresents, ingredients] = await Promise.all([
      MR.chargerMissionRules(client, site),
      MR.chargerRolesPresentsQuart(client, site, dateISO, quart),
      PD.chargerIngredientsSelection(client, site, dateISO),
    ]);

    const missionsCalculees = M.genererMissionsPourContexte({
      missionRules, rolesPresents, quart,
      produitsActifs: ingredients.produits,
      dernierControleParProduit: ingredients.dernierControleParProduit,
      seed: `${site}|${dateISO}|${quart}`,
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

  global.NexusInventaireMissionsDonnees = {
    chargerMissionsExistantes, genererOuChargerMissions, chargerMissionsPourRole,
  };
})(typeof window !== 'undefined' ? window : globalThis);
