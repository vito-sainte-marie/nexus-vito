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

  // Projection manager strictement en lecture seule. Le mode test ne doit
  // jamais appeler chargerOuGenererPlan : cette fonction persiste un plan et
  // ses items lorsqu'aucun plan officiel n'existe encore. Pour une
  // simulation, le catalogue actif chargé par chargerIngredientsSelection
  // suffit au même moteur de missions ; les règles de catégorie/zone restent
  // donc entièrement configurables par site, sans écrire de vérité métier.
  async function chargerContexteProjectionTest(client, site, dateISO, quart) {
    const M = global.NexusInventaireMoteur;
    const MR = global.NexusInventaireMissionRulesDonnees;
    const PD = global.NexusInventairePlanDonnees;
    if (!M || !MR || !PD) return null;
    const [missionRules, rolesPresents, ingredients, surprisesRecentesParProduit] = await Promise.all([
      MR.chargerMissionRules(client, site),
      MR.chargerRolesPresentsQuart(client, site, dateISO, quart),
      PD.chargerIngredientsSelection(client, site, dateISO),
      typeof PD.chargerSurprisesRecentes === 'function' ? PD.chargerSurprisesRecentes(client, site, dateISO) : Promise.resolve([]),
    ]);
    return { M, MR, missionRules, rolesPresents, ingredients, surprisesRecentesParProduit };
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
    const ctx = await chargerContexteProjectionTest(client, site, dateISO, quart);
    if (!ctx) return [];
    const rolesProjection = Array.from(new Set([...(ctx.rolesPresents || []), roleTest]));
    const produitsDuPlan = ctx.ingredients.produits || [];
    const regleParId = {};
    (ctx.missionRules || []).forEach(r => { regleParId[r.id] = r; });
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
      .map(m => {
        const regle = regleParId[m.missionRuleId] || {};
        return ({
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
        zone_ids: regle.zone_ids || [],
        mode_selection: regle.mode_selection || 'complet',
        mode_test_manager: true,
        });
      });
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
      const missionsApplicables = (perimetre.missions || []).filter(m => m.statut === 'affectee' && m.moment_code === moment).length;
      const filtres = (produitsActifs || []).filter(p => ids.has(p.id));
      const resultat = syntheseOriginale(filtres, comptages, false, quartRow, alertesOuvertes);
      resultat.sourcePerimetre = 'missions_v2';
      resultat.momentMission = moment;
      resultat.missionsApplicables = missionsApplicables;
      resultat.missionsPendant = (perimetre.missions || []).filter(m => m.statut === 'affectee' && m.moment_code === 'pendant').length;
      resultat.produitIdsApplicables = Array.from(ids);
      // 0 mission / 0 produit n'est PAS un 100 % métier. C'est un état neutre
      // « en attente de mission / d'affectation ». On le transporte dans la
      // synthèse pour que tous les consommateurs UI partagent la même vérité.
      resultat.perimetreVide = missionsApplicables === 0 || ids.size === 0;
      if (resultat.perimetreVide) resultat.pourcentage = null;
      return resultat;
    };

    // Progression : neutralise le faux « 100 % / clôture possible » lorsque
    // le périmètre V2 est vide.
    if (typeof global.renderSyntheseQuart === 'function') {
      const renderSyntheseOriginal = global.renderSyntheseQuart;
      global.renderSyntheseQuart = function (s, etat) {
        if (!s || s.sourcePerimetre !== 'missions_v2' || !s.perimetreVide) return renderSyntheseOriginal(s, etat);
        const moment = s.momentMission === 'fin' ? 'fin de quart' : 'début de quart';
        return `
          <div class="synthese-card">
            <div class="synthese-titre">Progression</div>
            <div class="synthese-ligne"><span>Périmètre opérationnel</span><span class="synthese-valeur">En attente</span></div>
            <div style="font-size:12px;color:var(--text-mid);line-height:1.55;margin:8px 0 4px;">
              Aucune mission de ${moment} n'est actuellement applicable ou affectée. NEXUS ne considère pas ce quart comme terminé et ne remplace pas ce périmètre vide par le catalogue complet.
            </div>
            <div class="synthese-cloture attente">En attente d'une mission applicable</div>
          </div>`;
      };
    }

    // Brief : même neutralité. Évite notamment 0/0 vert et « aucune anomalie
    // à traiter » qui seraient interprétés comme un quart entièrement fait.
    if (typeof global.renderBriefInventaire === 'function') {
      const renderBriefOriginal = global.renderBriefInventaire;
      global.renderBriefInventaire = function (s, alertes, decisions, importDeceniumFait) {
        if (!s || s.sourcePerimetre !== 'missions_v2' || !s.perimetreVide) return renderBriefOriginal(s, alertes, decisions, importDeceniumFait);
        return `
          <div class="section-titre">Brief Inventaire</div>
          <div class="synthese-card">
            <div class="synthese-ligne"><span>Missions applicables</span><span class="synthese-valeur">0</span></div>
            <div class="synthese-ligne"><span>État du contrôle</span><span class="synthese-valeur">En attente</span></div>
            <div style="font-size:11.5px;color:var(--text-mid);line-height:1.5;margin:8px 0;">Aucune conclusion de conformité ou de complétude n'est tirée tant qu'aucune mission n'est applicable.</div>
          </div>`;
      };
    }

    // Empêche « produits sensibles manquants » et autres vues dérivées de
    // réintroduire des références hors mission. Puis remplace le message
    // « Tous les comptages requis ont été effectués » par un état neutre si
    // le périmètre V2 est vide.
    if (typeof global.renderTout === 'function') {
      const renderToutOriginal = global.renderTout;
      global.renderTout = function (ctx) {
        if (ctx && ctx.synthese && ctx.synthese.sourcePerimetre === 'missions_v2') {
          const ids = new Set(ctx.synthese.produitIdsApplicables || []);
          ctx = { ...ctx };
          ctx.sensiblesNonComptesDetail = (ctx.sensiblesNonComptesDetail || []).filter(x => x && x.produit && ids.has(x.produit.id));
        }
        const resultat = renderToutOriginal(ctx);
        if (ctx && ctx.synthese && ctx.synthese.sourcePerimetre === 'missions_v2' && ctx.synthese.perimetreVide) {
          const section = global.document && global.document.getElementById('sectionATerminer');
          const suivant = section && section.nextElementSibling;
          if (suivant && (suivant.classList.contains('empty') || suivant.classList.contains('card'))) {
            const neutre = global.document.createElement('div');
            neutre.className = 'empty';
            neutre.textContent = 'Aucune mission applicable pour cette phase — rien n’est déclaré terminé et aucun produit hors mission n’est ajouté.';
            suivant.replaceWith(neutre);
          }
        }
        return resultat;
      };
    }

    // Conseiller : en périmètre non vide, filtre les alertes produit et les
    // sensibles au scope des missions. En périmètre vide, n'invente aucune
    // priorité produit et affiche seulement l'état d'attente opérationnel.
    if (typeof global.genererRemarquesConseiller === 'function') {
      const conseillerOriginal = global.genererRemarquesConseiller;
      global.genererRemarquesConseiller = async function (alertes, sensibles, modes, s) {
        if (!s || s.sourcePerimetre !== 'missions_v2') return conseillerOriginal(alertes, sensibles, modes, s);
        const ids = new Set(s.produitIdsApplicables || []);
        const alertesFiltrees = (alertes || []).filter(a => !a.produit_id || ids.has(a.produit_id));
        const sensiblesFiltres = (sensibles || []).filter(x => x && x.produit && ids.has(x.produit.id));
        if (!s.perimetreVide) return conseillerOriginal(alertesFiltrees, sensiblesFiltres, modes, s);
        const corps = global.document && global.document.getElementById('conseillerCorps');
        if (!corps) return;
        const moment = s.momentMission === 'fin' ? 'fin de quart' : 'début de quart';
        const alertesQuart = alertesFiltrees.filter(a => !a.produit_id);
        corps.innerHTML = `
          <div class="conseiller-remarque">Aucune mission de <b>${moment}</b> n'est actuellement applicable ou affectée. NEXUS reste en attente et ne transforme pas l'absence de mission en validation du quart.</div>
          ${alertesQuart.length ? `<div class="conseiller-remarque"><b>${alertesQuart.length} événement(s) de quart</b> restent néanmoins à traiter.</div>` : ''}`;
      };
    }
  }

  global.NexusInventaireMissionsDonnees = {
    chargerMissionsExistantes, reevaluerMissionsNonAffectees,
    genererOuChargerMissions, chargerMissionsPourRole,
    chargerRapprochementsPourMissions,
    roleTestManagerDepuisURL, genererProjectionTestManager,
    preparerPerimetreManager,
  };

  if (global.addEventListener) global.addEventListener('load', installerConvergenceManager, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
