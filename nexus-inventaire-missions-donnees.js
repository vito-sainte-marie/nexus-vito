// NEXUS Inventaire V2 — données des missions instanciées.
(function (global) {
  'use strict';

  async function chargerMissionsExistantes(client, site, dateISO, quart) {
    const { data, error } = await client.from('inventaire_missions')
      .select('*').eq('site', site).eq('date', dateISO).eq('quart', quart)
      .order('moment_code', { ascending: true }).order('created_at', { ascending: true });
    if (error) { console.error('Chargement missions Inventaire:', error); return []; }
    return data || [];
  }

  function produitsDepuisPlan(plan) {
    return (((plan && plan.items) || [])).map(it => ({
      id: it.produit_id,
      categorie_id: it.inventaire_zone_produit ? it.inventaire_zone_produit.categorie_id : null,
      zone_id: it.inventaire_zone_produit ? it.inventaire_zone_produit.zone_id : null,
    }));
  }

  async function chargerContexteGeneration(client, site, dateISO, quart) {
    const M = global.NexusInventaireMoteur;
    const MR = global.NexusInventaireMissionRulesDonnees;
    const PD = global.NexusInventairePlanDonnees;
    if (!M || !MR || !PD) return null;
    const [missionRules, rolesPresents, plan, ingredients, surprisesRecentesParProduit] = await Promise.all([
      MR.chargerMissionRules(client, site),
      MR.chargerRolesPresentsQuart(client, site, dateISO, quart),
      PD.chargerOuGenererPlan(client, site, dateISO, quart),
      PD.chargerIngredientsSelection(client, site, dateISO),
      typeof PD.chargerSurprisesRecentes === 'function' ? PD.chargerSurprisesRecentes(client, site, dateISO) : Promise.resolve([]),
    ]);
    return { M, MR, missionRules, rolesPresents, plan, ingredients, surprisesRecentesParProduit };
  }

  function contexteSelection(ctx, site, dateISO, quart) {
    return {
      quart, dateISO,
      reglesParProduit: ctx.ingredients.reglesParProduit,
      produitsAvecAnomalieRecente: ctx.ingredients.produitsAvecAnomalieRecente,
      anomaliesDetailParProduit: ctx.ingredients.anomaliesDetailParProduit,
      surprisesRecentesParProduit: ctx.surprisesRecentesParProduit,
    };
  }

  // Une mission non affectée n'est pas figée définitivement : la présence
  // peut être complétée après l'ouverture (prise de poste tardive, synchro
  // planning/Verify, correction manager). Tant qu'elle est non_affectee,
  // NEXUS la réévalue contre les rôles réellement présents. Une mission déjà
  // affectée/commencée n'est jamais redistribuée silencieusement.
  async function reevaluerMissionsNonAffectees(client, site, dateISO, quart, existantes) {
    const aReevaluer = (existantes || []).filter(m => m.statut === 'non_affectee');
    if (!aReevaluer.length) return existantes || [];
    const ctx = await chargerContexteGeneration(client, site, dateISO, quart);
    if (!ctx) return existantes || [];
    const regleParId = {};
    ctx.missionRules.forEach(r => { regleParId[r.id] = r; });
    const produitsDuPlan = produitsDepuisPlan(ctx.plan);
    const selectionCtx = contexteSelection(ctx, site, dateISO, quart);
    let modifie = false;

    for (const mission of aReevaluer) {
      const regle = regleParId[mission.mission_rule_id];
      if (!regle) continue;
      const affectation = ctx.M.resoudreAffectationRegleMission(regle, ctx.rolesPresents);
      if (!affectation || affectation.statut !== 'affectee') continue;
      const produitIds = ctx.M.selectionnerPerimetreMission(
        regle, produitsDuPlan, ctx.ingredients.dernierControleParProduit,
        `${site}|${dateISO}|${quart}|${regle.id}`, selectionCtx
      );
      const { error } = await client.from('inventaire_missions').update({
        role_affecte: affectation.roleAffecte,
        via_repli: !!affectation.viaRepli,
        statut: 'affectee',
        strategie_appliquee: affectation.strategieAppliquee || null,
        produit_ids: produitIds || [],
      }).eq('id', mission.id).eq('statut', 'non_affectee');
      if (error) console.error('Réévaluation mission non affectée:', error);
      else modifie = true;
    }
    return modifie ? chargerMissionsExistantes(client, site, dateISO, quart) : (existantes || []);
  }

  async function genererOuChargerMissions(client, site, dateISO, quart) {
    const existantes = await chargerMissionsExistantes(client, site, dateISO, quart);
    if (existantes.length) return reevaluerMissionsNonAffectees(client, site, dateISO, quart, existantes);

    const ctx = await chargerContexteGeneration(client, site, dateISO, quart);
    if (!ctx) {
      console.error('Dépendances manquantes — génération des missions impossible.');
      return [];
    }
    const produitsDuPlan = produitsDepuisPlan(ctx.plan);
    const missionsCalculees = ctx.M.genererMissionsPourContexte({
      missionRules: ctx.missionRules,
      rolesPresents: ctx.rolesPresents,
      quart,
      produitsActifs: produitsDuPlan,
      dernierControleParProduit: ctx.ingredients.dernierControleParProduit,
      seed: `${site}|${dateISO}|${quart}`,
      dateISO,
      reglesParProduit: ctx.ingredients.reglesParProduit,
      produitsAvecAnomalieRecente: ctx.ingredients.produitsAvecAnomalieRecente,
      anomaliesDetailParProduit: ctx.ingredients.anomaliesDetailParProduit,
      surprisesRecentesParProduit: ctx.surprisesRecentesParProduit,
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
      const relues = await chargerMissionsExistantes(client, site, dateISO, quart);
      if (relues.length) return reevaluerMissionsNonAffectees(client, site, dateISO, quart, relues);
      console.error('Génération missions Inventaire:', errInsert);
      return [];
    }
    return chargerMissionsExistantes(client, site, dateISO, quart);
  }

  async function chargerMissionsPourRole(client, site, dateISO, quart, roleCode) {
    const toutes = await genererOuChargerMissions(client, site, dateISO, quart);
    const MR = global.NexusInventaireMissionRulesDonnees;
    const roleCanonique = MR && typeof MR.normaliserRoleCode === 'function' ? MR.normaliserRoleCode(roleCode) : roleCode;
    return toutes.filter(m => m.statut === 'affectee' && m.role_affecte === roleCanonique);
  }

  async function chargerRapprochementsPourMissions(client, site, dateISO, quart, missions) {
    const M = global.NexusInventaireMoteur;
    const liste = missions || [];
    if (!M || !liste.length) return liste;
    const { data: quartRow, error: e1 } = await client.from('inventaire_quarts')
      .select('id').eq('site', site).eq('date', dateISO).eq('quart', quart).maybeSingle();
    if (e1) { console.error('Chargement quart (rapprochement missions):', e1); return liste; }
    if (!quartRow) return liste;
    const { data: rapprochements, error: e2 } = await client.from('inventaire_rapprochements')
      .select('produit_id, statut_validation, ecart').eq('quart_id', quartRow.id);
    if (e2) { console.error('Chargement rapprochements (missions):', e2); return liste; }
    if (!rapprochements || !rapprochements.length) return liste;
    return liste.map(m => {
      const lignesMission = M.rapprochementsPourPerimetre(m.produit_ids || [], rapprochements);
      if (!lignesMission.length) return m;
      return { ...m, rapprochement: M.syntheseQualiteRapprochements(lignesMission) };
    });
  }

  global.NexusInventaireMissionsDonnees = {
    chargerMissionsExistantes,
    reevaluerMissionsNonAffectees,
    genererOuChargerMissions,
    chargerMissionsPourRole,
    chargerRapprochementsPourMissions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
