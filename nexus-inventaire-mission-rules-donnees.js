// NEXUS Inventaire V2 — Sprint 1 "Configuration multi-site" (29/08/2026).
// Colle Supabase pour la table inventaire_mission_rules — la configuration
// durable "qui compte quoi, quand, avec quel repli" (doctrine complète
// transmise par Frédéric, "NEXUS Inventaire V2"). Toute la logique de
// RÉSOLUTION (une règle s'applique-t-elle à ce contexte ? quel rôle est
// effectivement affecté ?) reste dans nexus-inventaire-moteur.js (Article
// 11) — ce fichier ne fait que charger/écrire les règles et, pour
// l'installation d'un nouveau site, résoudre les noms de catégories du
// moteur en identifiants réels.
//
// Portée explicite de ce sprint (doctrine §46, verbatim) : "sortir
// définitivement les règles métier du code [...] Aucune évolution
// complexe du rapprochement à ce stade." Ce fichier NE construit PAS de
// missions instanciées (site+date+quart+employé) — c'est le générateur de
// missions du Sprint 2 qui consommera ces règles avec
// nexus-inventaire-moteur.js::resoudreMissionRulesApplicables. Ici, on ne
// fait que gérer la configuration elle-même (CRUD) et l'installation du
// modèle par défaut NEXUS pour un site qui n'en a pas encore.

(function (global) {
  'use strict';

  // Toutes les règles de mission d'un site, triées comme l'écran Paramètres
  // les affichera (ordre_affichage) — jamais un tri différent recalculé
  // ailleurs.
  async function chargerMissionRules(client, site) {
    const { data, error } = await client.from('inventaire_mission_rules')
      .select('*').eq('site', site).order('ordre_affichage', { ascending: true });
    if (error) { console.error('Chargement mission_rules:', error); return []; }
    return data || [];
  }

  async function creerMissionRule(client, site, payload) {
    const { data, error } = await client.from('inventaire_mission_rules')
      .insert({ ...payload, site }).select().maybeSingle();
    if (error) { console.error('Création mission_rule:', error); return null; }
    return data;
  }

  async function modifierMissionRule(client, id, patch) {
    const { data, error } = await client.from('inventaire_mission_rules')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    if (error) { console.error('Modification mission_rule:', error); return null; }
    return data;
  }

  // Jamais une suppression (Article 5 — une mission désactivée garde son
  // historique, exactement comme inventaire_categories.actif) : on pose
  // actif=false, la règle reste consultable/réactivable depuis Paramètres.
  async function desactiverMissionRule(client, id) {
    return modifierMissionRule(client, id, { actif: false });
  }
  async function reactiverMissionRule(client, id) {
    return modifierMissionRule(client, id, { actif: true });
  }

  // Rôles RÉELLEMENT présents pour un (site, date, quart) — lu depuis
  // inventaire_quart_employes, la table de présence qui existe déjà
  // (Article 11 : jamais une nouvelle table de présence pour Inventaire).
  // inventaire_quart_employes ne porte pas directement site/date/quart : on
  // passe par inventaire_quarts.id (quart_id) comme le fait déjà le reste
  // du produit pour cette relation.
  async function chargerRolesPresentsQuart(client, site, dateISO, quart) {
    const { data: quartRow, error: e1 } = await client.from('inventaire_quarts')
      .select('id').eq('site', site).eq('date', dateISO).eq('quart', quart).maybeSingle();
    if (e1) { console.error('Chargement quart (présence):', e1); return []; }
    if (!quartRow) return []; // quart pas encore ouvert -> aucun rôle présent, pas une erreur (Article 5)
    const { data: presences, error: e2 } = await client.from('inventaire_quart_employes')
      .select('role, employee_id').eq('quart_id', quartRow.id);
    if (e2) { console.error('Chargement présences (rôles):', e2); return []; }
    return Array.from(new Set((presences || []).map(p => p.role).filter(Boolean)));
  }

  // ------------------------------------------------------------
  // Configuration par défaut NEXUS (doctrine §2/§39) — installateur
  // idempotent pour un site qui n'a pas encore de configuration Inventaire.
  // Aucune référence Sainte-Marie ici : le template vient de
  // NexusInventaireMoteur.CATEGORIES_DEFAUT_NEXUS /
  // MISSION_RULES_DEFAUT_NEXUS (fonctions pures, aucun accès réseau) — ce
  // chargeur se contente de les poser en base pour le site demandé.
  //
  // Idempotence : une catégorie ou une mission_rule déjà présente (même
  // `nom`, même site) n'est jamais recréée en double — sûr à rappeler
  // plusieurs fois (ex. bouton "Réinstaller la configuration par défaut"
  // dans un futur écran d'administration multi-site).
  //
  // Limitation assumée (Article 5, aucune fausse précision) : il n'existe
  // aujourd'hui AUCUN flux de création de site dans NEXUS (vérifié par
  // recherche exhaustive dans le code, 29/08/2026) — NEXUS reste mono-site
  // (vito-sainte-marie) en pratique malgré un schéma prêt pour le
  // multi-site. Cette fonction est donc un gabarit réutilisable, PAS un
  // écran "créer un site" : à appeler manuellement (console/migration) le
  // jour où un second site sera réellement provisionné.
  async function installerConfigurationDefautNexus(client, site) {
    const M = global.NexusInventaireMoteur;
    if (!M) { console.error('NexusInventaireMoteur non chargé — installation impossible.'); return { categoriesCreees: 0, missionsCreees: 0, erreurs: ['moteur non chargé'] }; }

    const erreurs = [];

    // 1) Catégories par défaut — on ne crée que celles absentes (par nom).
    const { data: categoriesExistantes, error: eCat } = await client.from('inventaire_categories')
      .select('id, nom').eq('site', site);
    if (eCat) erreurs.push('lecture catégories existantes: ' + eCat.message);
    const nomsExistants = new Set((categoriesExistantes || []).map(c => c.nom));
    const categoriesAInserer = M.CATEGORIES_DEFAUT_NEXUS.filter(c => !nomsExistants.has(c.nom));
    let categoriesCreees = 0;
    if (categoriesAInserer.length) {
      const { data: inserees, error: eInsCat } = await client.from('inventaire_categories')
        .insert(categoriesAInserer.map(c => ({ site, nom: c.nom, ordre_affichage: c.ordre_affichage })))
        .select();
      if (eInsCat) erreurs.push('insertion catégories: ' + eInsCat.message);
      else categoriesCreees = (inserees || []).length;
    }

    // 2) Carte nom -> id complète (existantes + nouvellement créées), pour
    // résoudre les categorie_noms du template en categorie_ids réels.
    const { data: toutesCategories, error: eCat2 } = await client.from('inventaire_categories')
      .select('id, nom').eq('site', site);
    if (eCat2) erreurs.push('relecture catégories: ' + eCat2.message);
    const idParNom = {};
    (toutesCategories || []).forEach(c => { idParNom[c.nom] = c.id; });

    // 3) Mission_rules par défaut — on ne crée que celles absentes (par nom).
    const { data: missionsExistantes, error: eMiss } = await client.from('inventaire_mission_rules')
      .select('nom').eq('site', site);
    if (eMiss) erreurs.push('lecture mission_rules existantes: ' + eMiss.message);
    const nomsMissionsExistantes = new Set((missionsExistantes || []).map(m => m.nom));

    let missionsCreees = 0;
    for (const rule of M.MISSION_RULES_DEFAUT_NEXUS) {
      if (nomsMissionsExistantes.has(rule.nom)) continue;
      const categorieIds = (rule.categorie_noms || [])
        .map(nom => idParNom[nom])
        .filter(Boolean);
      if (categorieIds.length !== (rule.categorie_noms || []).length) {
        erreurs.push(`mission "${rule.nom}": une ou plusieurs catégories du template introuvables après installation — installée quand même avec les catégories résolues.`);
      }
      const { error: eInsMiss } = await client.from('inventaire_mission_rules').insert({
        site, nom: rule.nom, actif: true,
        role_code: rule.role_code, role_repli: rule.role_repli || null,
        quart: rule.quart != null ? rule.quart : null,
        moment_code: rule.moment_code,
        categorie_ids: categorieIds,
        zone_ids: rule.zone_ids || null,
        mode_selection: rule.mode_selection || 'complet',
        nombre_references: rule.nombre_references || null,
        strategie_repli: rule.strategie_repli || null,
        priorite: rule.priorite || 'normale',
        ordre_affichage: rule.ordre_affichage || 0,
      });
      if (eInsMiss) erreurs.push(`insertion mission "${rule.nom}": ` + eInsMiss.message);
      else missionsCreees++;
    }

    return { categoriesCreees, missionsCreees, erreurs };
  }

  global.NexusInventaireMissionRulesDonnees = {
    chargerMissionRules, creerMissionRule, modifierMissionRule,
    desactiverMissionRule, reactiverMissionRule,
    chargerRolesPresentsQuart, installerConfigurationDefautNexus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
