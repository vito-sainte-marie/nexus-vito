// NEXUS Inventaire V2 — Sprint 1 "Configuration multi-site" (29/08/2026).
// Colle Supabase pour la table inventaire_mission_rules.
(function (global) {
  'use strict';

  // Code métier canonique des rôles Inventaire. Les libellés affichés peuvent
  // rester genrés, mais le moteur de missions ne doit jamais dépendre de
  // variantes lexicales issues des présences historiques.
  function normaliserRoleCode(role) {
    if (role == null) return null;
    const brut = String(role).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const alias = {
      caissiere: 'caissier',
      caisse: 'caissier',
      cashier: 'caissier',
      pompiste: 'pompiste',
      piste: 'pompiste',
      renfort: 'renfort',
      manager: 'manager',
      gerant: 'gerant',
      gerante: 'gerant',
      vacataire: 'vacataire',
    };
    return alias[brut] || brut;
  }

  async function chargerMissionRules(client, site) {
    const { data, error } = await client.from('inventaire_mission_rules')
      .select('*').eq('site', site).order('ordre_affichage', { ascending: true });
    if (error) { console.error('Chargement mission_rules:', error); return []; }
    return (data || []).map(r => ({
      ...r,
      role_code: normaliserRoleCode(r.role_code),
      role_repli: normaliserRoleCode(r.role_repli),
    }));
  }

  async function creerMissionRule(client, site, payload) {
    const propre = {
      ...payload,
      role_code: normaliserRoleCode(payload.role_code),
      role_repli: normaliserRoleCode(payload.role_repli),
      site,
    };
    const { data, error } = await client.from('inventaire_mission_rules')
      .insert(propre).select().maybeSingle();
    if (error) { console.error('Création mission_rule:', error); return null; }
    return data;
  }

  async function modifierMissionRule(client, id, patch) {
    const propre = { ...patch, updated_at: new Date().toISOString() };
    if (Object.prototype.hasOwnProperty.call(propre, 'role_code')) propre.role_code = normaliserRoleCode(propre.role_code);
    if (Object.prototype.hasOwnProperty.call(propre, 'role_repli')) propre.role_repli = normaliserRoleCode(propre.role_repli);
    const { data, error } = await client.from('inventaire_mission_rules')
      .update(propre).eq('id', id).select().maybeSingle();
    if (error) { console.error('Modification mission_rule:', error); return null; }
    return data;
  }

  async function desactiverMissionRule(client, id) {
    return modifierMissionRule(client, id, { actif: false });
  }
  async function reactiverMissionRule(client, id) {
    return modifierMissionRule(client, id, { actif: true });
  }

  // Présences du quart regroupées par rôle CANONIQUE. C'est ici, au bord de
  // la donnée, que les anciennes valeurs (ex. "caissiere") sont normalisées.
  // Le moteur pur ne connaît ainsi qu'un référentiel stable.
  async function chargerEmployesPresentsParRole(client, site, dateISO, quart) {
    const { data: quartRow, error: e1 } = await client.from('inventaire_quarts')
      .select('id').eq('site', site).eq('date', dateISO).eq('quart', quart).maybeSingle();
    if (e1) { console.error('Chargement quart (présence):', e1); return {}; }
    if (!quartRow) return {};
    const { data: presences, error: e2 } = await client.from('inventaire_quart_employes')
      .select('role, employee_id').eq('quart_id', quartRow.id);
    if (e2) { console.error('Chargement présences (employés par rôle):', e2); return {}; }
    const parRole = {};
    (presences || []).forEach(p => {
      const role = normaliserRoleCode(p && p.role);
      if (!role) return;
      if (!parRole[role]) parRole[role] = [];
      if (p.employee_id && !parRole[role].includes(p.employee_id)) parRole[role].push(p.employee_id);
    });
    return parRole;
  }

  async function chargerRolesPresentsQuart(client, site, dateISO, quart) {
    const parRole = await chargerEmployesPresentsParRole(client, site, dateISO, quart);
    return Object.keys(parRole);
  }

  async function installerConfigurationDefautNexus(client, site) {
    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — installation impossible.'); return { categoriesCreees: 0, missionsCreees: 0, erreurs: ['moteur non chargé'] }; }
    const erreurs = [];
    const { data: categoriesExistantes, error: eCat } = await client.from('inventaire_categories')
      .select('id, nom').eq('site', site);
    if (eCat) erreurs.push('lecture catégories existantes: ' + eCat.message);
    const nomsExistants = new Set((categoriesExistantes || []).map(c => c.nom));
    const categoriesAInserer = M.CATEGORIES_DEFAUT_NEXUS.filter(c => !nomsExistants.has(c.nom));
    let categoriesCreees = 0;
    if (categoriesAInserer.length) {
      const { data: inserees, error: eInsCat } = await client.from('inventaire_categories')
        .insert(categoriesAInserer.map(c => ({ site, nom: c.nom, ordre_affichage: c.ordre_affichage }))).select();
      if (eInsCat) erreurs.push('insertion catégories: ' + eInsCat.message);
      else categoriesCreees = (inserees || []).length;
    }
    const { data: toutesCategories, error: eCat2 } = await client.from('inventaire_categories')
      .select('id, nom').eq('site', site);
    if (eCat2) erreurs.push('relecture catégories: ' + eCat2.message);
    const idParNom = {};
    (toutesCategories || []).forEach(c => { idParNom[c.nom] = c.id; });
    const { data: missionsExistantes, error: eMiss } = await client.from('inventaire_mission_rules')
      .select('nom').eq('site', site);
    if (eMiss) erreurs.push('lecture mission_rules existantes: ' + eMiss.message);
    const nomsMissionsExistantes = new Set((missionsExistantes || []).map(m => m.nom));
    let missionsCreees = 0;
    for (const rule of M.MISSION_RULES_DEFAUT_NEXUS) {
      if (nomsMissionsExistantes.has(rule.nom)) continue;
      const categorieIds = (rule.categorie_noms || []).map(nom => idParNom[nom]).filter(Boolean);
      if (categorieIds.length !== (rule.categorie_noms || []).length) erreurs.push(`mission "${rule.nom}": une ou plusieurs catégories introuvables.`);
      const { error: eInsMiss } = await client.from('inventaire_mission_rules').insert({
        site, nom: rule.nom, actif: true,
        role_code: normaliserRoleCode(rule.role_code), role_repli: normaliserRoleCode(rule.role_repli),
        quart: rule.quart != null ? rule.quart : null,
        moment_code: rule.moment_code, categorie_ids: categorieIds,
        zone_ids: rule.zone_ids || null, mode_selection: rule.mode_selection || 'complet',
        nombre_references: rule.nombre_references || null,
        strategie_repli: rule.strategie_repli || null,
        priorite: rule.priorite || 'normale', ordre_affichage: rule.ordre_affichage || 0,
      });
      if (eInsMiss) erreurs.push(`insertion mission "${rule.nom}": ` + eInsMiss.message);
      else missionsCreees++;
    }
    return { categoriesCreees, missionsCreees, erreurs };
  }

  global.NexusInventaireMissionRulesDonnees = {
    normaliserRoleCode,
    chargerMissionRules, creerMissionRule, modifierMissionRule,
    desactiverMissionRule, reactiverMissionRule,
    chargerRolesPresentsQuart, chargerEmployesPresentsParRole,
    installerConfigurationDefautNexus,
  };
})(typeof window !== 'undefined' ? window : globalThis);

// Sprint Fluidité Inventaire (31/08/2026) — charge uniquement l'assistance
// de saisie employé sur la page Inventaire. Le fichier de données reste
// inchangé sur les écrans Manager/Paramètres et le moteur métier n'est pas
// modifié : l'assistance ne fait qu'écrire une expression dans le champ que
// le parcours existant sait déjà évaluer (+, -, ×, ÷) puis enregistrer.
if (typeof document !== 'undefined' && /NEXUS-Inventaire-v1\.html$/i.test(location.pathname)) {
  const fluidite = document.createElement('script');
  fluidite.src = NexusBuild.versionner('nexus-inventaire-fluidite.js');
  fluidite.defer = true;
  document.head.appendChild(fluidite);
}
