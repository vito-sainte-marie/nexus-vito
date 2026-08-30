// NEXUS Inventaire V2 — données des missions instanciées.
(function (global) {
  'use strict';

  function normaliserRole(MR, role) {
    return MR && typeof MR.normaliserRoleCode === 'function' ? MR.normaliserRoleCode(role) : role;
  }

  // Mode test terrain manager : le manager/gérant reste identifié comme tel
  // dans employees/shifts/inventaire_quart_employes. Le paramètre URL ne
  // sert qu'à fournir un rôle OPÉRATIONNEL virtuel au moteur de missions.
  // Aucune présence fictive ni affectation de mission de test n'est écrite.
  function roleTestManagerDepuisURL(roleCode, MR) {
    const roleReel = normaliserRole(MR, roleCode);
    if (roleReel !== 'manager' && roleReel !== 'gerant') return null;
    if (!global.location || typeof global.URLSearchParams === 'undefined') return null;
    const brut = new global.URLSearchParams(global.location.search || '').get('test_role');
    if (!brut) return null;
    const demande = normaliserRole(MR, brut);
    return ['caissier', 'pompiste', 'renfort'].includes(demande) ? demande : null;
  }

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
    if (!ctx) { console.error('Dépendances manquantes — génération des missions impossible.'); return []; }
    const produitsDuPlan = produitsDepuisPlan(ctx.plan);
    const missionsCalculees = ctx.M.genererMissionsPourContexte({
      missionRules: ctx.missionRules, rolesPresents: ctx.rolesPresents, quart,
      produitsActifs: produitsDuPlan,
      dernierControleParProduit: ctx.ingredients.dernierControleParProduit,
      seed: `${site}|${dateISO}|${quart}`, dateISO,
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

  // Projection purement temporaire : calcule ce que recevrait le rôle testé
  // si ce rôle était présent, sans modifier inventaire_missions ni
  // inventaire_quart_employes. Ainsi les essais du manager ne peuvent pas
  // créer de fausse obligation opérationnelle pour un futur quart réel.
  async function genererProjectionTestManager(client, site, dateISO, quart, roleTest) {
    const ctx = await chargerContexteGeneration(client, site, dateISO, quart);
    if (!ctx) return [];
    const rolesProjection = Array.from(new Set([...(ctx.rolesPresents || []), roleTest]));
    const produitsDuPlan = produitsDepuisPlan(ctx.plan);
    const calculees = ctx.M.genererMissionsPourContexte({
      missionRules: ctx.missionRules,
      rolesPresents: rolesProjection,
      quart,
      produitsActifs: produitsDuPlan,
      dernierControleParProduit: ctx.ingredients.dernierControleParProduit,
      seed: `${site}|${dateISO}|${quart}|test|${roleTest}`,
      dateISO,
      reglesParProduit: ctx.ingredients.reglesParProduit,
      produitsAvecAnomalieRecente: ctx.ingredients.produitsAvecAnomalieRecente,
      anomaliesDetailParProduit: ctx.ingredients.anomaliesDetailParProduit,
      surprisesRecentesParProduit: ctx.surprisesRecentesParProduit,
    });
    return calculees
      .filter(m => m.statut === 'affectee' && normaliserRole(ctx.MR, m.roleAffecte) === roleTest)
      .map(m => ({
        id: `test:${m.missionRuleId}:${m.momentCode}`,
        site, date: dateISO, quart,
        moment_code: m.momentCode,
        mission_rule_id: m.missionRuleId,
        nom: m.nom,
        role_affecte: m.roleAffecte,
        via_repli: m.viaRepli,
        statut: m.statut,
        strategie_appliquee: 'test_manager_non_persistant',
        produit_ids: m.produitIds || [],
        mode_test_manager: true,
      }));
  }

  async function chargerMissionsPourRole(client, site, dateISO, quart, roleCode) {
    const MR = global.NexusInventaireMissionRulesDonnees;
    const roleTest = roleTestManagerDepuisURL(roleCode, MR);
    if (roleTest) return genererProjectionTestManager(client, site, dateISO, quart, roleTest);
    const toutes = await genererOuChargerMissions(client, site, dateISO, quart);
    const roleCanonique = normaliserRole(MR, roleCode);
    return toutes.filter(m => m.statut === 'affectee' && normaliserRole(MR, m.role_affecte) === roleCanonique);
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

  // ------------------------------------------------------------
  // CONVERGENCE MANAGER V2 — vérité opérationnelle = missions applicables.
  // ------------------------------------------------------------
  // L'écran Manager historique construit sa synthèse à partir du catalogue
  // actif complet. Il reçoit cependant le quart sélectionné dans
  // construireSynthese(..., quart, ...). On prépare donc le périmètre V2
  // au moment où ce quart est chargé, puis on filtre la synthèse de manière
  // synchrone. Aucun HTML monolithique n'est réécrit ici.
  const cachePerimetresManager = new Map();
  const DATE_BASCULE_V2 = '2026-08-29';

  function clePerimetreManager(site, dateISO, quart) {
    return `${site}|${dateISO}|${quart}`;
  }

  function phaseDepuisQuart(quartRow) {
    return (quartRow && (quartRow.statut === 'ouvert' || quartRow.statut === 'cloture')) ? 'fin' : 'debut';
  }

  function idsPourMoment(missions, moment) {
    const ids = new Set();
    (missions || [])
      .filter(m => m.statut === 'affectee' && m.moment_code === moment)
      .forEach(m => (m.produit_ids || []).forEach(id => ids.add(id)));
    return ids;
  }

  async function preparerPerimetreManager(client, site, dateISO, quart) {
    if (!site || !dateISO || !quart) return;
    const cle = clePerimetreManager(site, dateISO, quart);
    // Historique antérieur à la bascule : on ne réinterprète pas les vieux
    // quarts avec des missions qui n'existaient pas encore.
    if (dateISO < DATE_BASCULE_V2) {
      cachePerimetresManager.set(cle, { historique: true, missions: [] });
      return;
    }
    const missions = await chargerMissionsExistantes(client, site, dateISO, quart);
    cachePerimetresManager.set(cle, {
      historique: false,
      missions,
      debut: idsPourMoment(missions, 'debut'),
      pendant: idsPourMoment(missions, 'pendant'),
      fin: idsPourMoment(missions, 'fin'),
    });
  }

  function installerConvergenceManager() {
    if (!global.location || !/NEXUS-Inventaire-Manager-v1\.html$/i.test(global.location.pathname)) return;
    const MD = global.NexusInventaireManagerDonnees;
    if (!MD || typeof MD.chargerQuart !== 'function') return;

    // Précharge les missions AVANT que chargerEtAfficherTout ne construise
    // la synthèse. Le wrapper local chargerQuart(...) de la page continue à
    // fonctionner sans modification : il appelle cette propriété à chaque
    // rafraîchissement date/quart.
    const chargerQuartOriginal = MD.chargerQuart;
    MD.chargerQuart = async function (client, site, dateISO, quart) {
      const ligne = await chargerQuartOriginal(client, site, dateISO, quart);
      try { await preparerPerimetreManager(client, site, dateISO, quart); }
      catch (e) { console.error('Préparation périmètre Missions V2 manager:', e); }
      return ligne;
    };

    const syntheseOriginale = global.construireSynthese;
    if (typeof syntheseOriginale !== 'function') return;

    global.construireSynthese = function (produitsActifs, comptages, jaugeageActif, quartRow, alertesOuvertes) {
      // Sans quart, l'écran historique conserve son comportement neutre.
      if (!quartRow || !quartRow.site || !quartRow.date || !quartRow.quart) {
        return syntheseOriginale(produitsActifs, comptages, jaugeageActif, quartRow, alertesOuvertes);
      }
      const cle = clePerimetreManager(quartRow.site, quartRow.date, quartRow.quart);
      const perimetre = cachePerimetresManager.get(cle);
      if (!perimetre || perimetre.historique) {
        return syntheseOriginale(produitsActifs, comptages, jaugeageActif, quartRow, alertesOuvertes);
      }

      const moment = phaseDepuisQuart(quartRow);
      const ids = perimetre[moment] || new Set();
      // Doctrine V2 : zéro mission applicable ne signifie JAMAIS « tout le
      // catalogue est obligatoire ». On passe une liste vide, ce qui donne
      // une synthèse neutre 0/0 et clotureImpossible=false, au lieu de 0/112.
      const filtres = (produitsActifs || []).filter(p => ids.has(p.id));
      const resultat = syntheseOriginale(filtres, comptages, false, quartRow, alertesOuvertes);
      resultat.sourcePerimetre = 'missions_v2';
      resultat.momentMission = moment;
      resultat.missionsApplicables = (perimetre.missions || []).filter(m => m.statut === 'affectee' && m.moment_code === moment).length;
      resultat.missionsPendant = (perimetre.missions || []).filter(m => m.statut === 'affectee' && m.moment_code === 'pendant').length;
      return resultat;
    };
  }

  global.NexusInventaireMissionsDonnees = {
    chargerMissionsExistantes, reevaluerMissionsNonAffectees,
    genererOuChargerMissions, chargerMissionsPourRole,
    chargerRapprochementsPourMissions,
    roleTestManagerDepuisURL, genererProjectionTestManager,
    preparerPerimetreManager,
  };

  // Les fonctions globales de la page Manager sont déclarées plus tard dans
  // son script inline ; l'installation doit donc attendre le chargement
  // complet du document. Sur les autres pages, cette garde ne fait rien.
  if (global.addEventListener) global.addEventListener('load', installerConvergenceManager, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
