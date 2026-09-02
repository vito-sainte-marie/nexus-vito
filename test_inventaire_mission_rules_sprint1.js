// Test — Inventaire V2 Sprint 1 "Configuration multi-site" (29/08/2026,
// doctrine "NEXUS Inventaire V2" transmise par Frédéric). Portée du sprint,
// verbatim : "sortir définitivement les règles métier du code [...] Aucune
// évolution complexe du rapprochement à ce stade."
//
// Ce fichier teste :
//   1. nexus-inventaire-moteur.js — regleApplicableContexte (filtre
//      actif/moment/quart), resoudreAffectationRegleMission (rôle direct /
//      repli / non affectée), resoudreMissionRulesApplicables (filtre+tri+
//      résolution combinés), libelleMoment/libelleStrategieRepli, et la
//      forme du template CATEGORIES_DEFAUT_NEXUS/MISSION_RULES_DEFAUT_NEXUS
//      (générique, aucune référence Sainte-Marie/Vito).
//   2. nexus-inventaire-mission-rules-donnees.js — forme exacte des requêtes
//      (chargerMissionRules/creerMissionRule/dés-réactivation), présence
//      réelle par quart (chargerRolesPresentsQuart, y compris quart absent),
//      et l'installateur de configuration par défaut (idempotence sur
//      catégories ET missions déjà existantes, résolution nom->id).

global.window = global;
const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-inventaire-moteur.js'));
require(path.join(DIR, 'nexus-inventaire-mission-rules-donnees.js'));
const M = global.NexusInventaireMoteur;
const D = global.NexusInventaireMissionRulesDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

(async () => {

// ------------------------------------------------------------
// 1) regleApplicableContexte
// ------------------------------------------------------------
{
  const regleGenerique = { actif: true, moment_code: 'debut', quart: null };
  assert.strictEqual(M.regleApplicableContexte(regleGenerique, 'matin', 'debut'), true, 'quart=null -> applicable aux deux quarts');
  assert.strictEqual(M.regleApplicableContexte(regleGenerique, 'soir', 'debut'), true, 'quart=null -> applicable aux deux quarts (soir aussi)');
  assert.strictEqual(M.regleApplicableContexte(regleGenerique, 'matin', 'fin'), false, 'moment différent -> non applicable');

  const regleQuartSpecifique = { actif: true, moment_code: 'pendant', quart: 'soir' };
  assert.strictEqual(M.regleApplicableContexte(regleQuartSpecifique, 'soir', 'pendant'), true);
  assert.strictEqual(M.regleApplicableContexte(regleQuartSpecifique, 'matin', 'pendant'), false, 'quart spécifique -> jamais appliqué à l\'autre quart');

  const regleInactive = { actif: false, moment_code: 'debut', quart: null };
  assert.strictEqual(M.regleApplicableContexte(regleInactive, 'matin', 'debut'), false, 'une règle désactivée n\'est jamais applicable, quel que soit le contexte');
  assert.strictEqual(M.regleApplicableContexte(null, 'matin', 'debut'), false, 'jamais une exception sur une règle absente');

  ok('regleApplicableContexte — filtre actif/moment/quart correct, quart=null couvre les deux quarts');
}

// ------------------------------------------------------------
// 2) resoudreAffectationRegleMission — rôle direct / repli / non affectée.
// ------------------------------------------------------------
{
  const regle = { role_code: 'caissier', role_repli: 'renfort', strategie_repli: 'reporter_quart_suivant' };

  const direct = M.resoudreAffectationRegleMission(regle, new Set(['caissier', 'pompiste']));
  assert.strictEqual(direct.statut, 'affectee');
  assert.strictEqual(direct.roleAffecte, 'caissier');
  assert.strictEqual(direct.viaRepli, false);

  const viaRepli = M.resoudreAffectationRegleMission(regle, new Set(['renfort']));
  assert.strictEqual(viaRepli.statut, 'affectee');
  assert.strictEqual(viaRepli.roleAffecte, 'renfort');
  assert.strictEqual(viaRepli.viaRepli, true, 'affectation via repli doit être signalée explicitement, jamais silencieuse');

  const nonAffectee = M.resoudreAffectationRegleMission(regle, new Set(['pompiste']));
  assert.strictEqual(nonAffectee.statut, 'non_affectee');
  assert.strictEqual(nonAffectee.roleAffecte, null);
  assert.strictEqual(nonAffectee.strategieAppliquee, 'reporter_quart_suivant', 'la stratégie configurée est restituée, jamais exécutée par ce sprint (hors scope)');

  const sansRepliConfigure = M.resoudreAffectationRegleMission({ role_code: 'pompiste', role_repli: null, strategie_repli: null }, new Set(['caissier']));
  assert.strictEqual(sansRepliConfigure.statut, 'non_affectee');
  assert.strictEqual(sansRepliConfigure.strategieAppliquee, 'aucune', 'aucune stratégie configurée -> "aucune", jamais null/undefined qui casserait un affichage');

  assert.strictEqual(M.resoudreAffectationRegleMission(null, new Set(['caissier'])), null, 'jamais une exception sur une règle absente');

  ok('resoudreAffectationRegleMission — rôle direct, repli signalé (viaRepli), non affectée avec stratégie restituée telle quelle');
}

// ------------------------------------------------------------
// 3) resoudreMissionRulesApplicables — filtre + tri + résolution combinés,
//    exactement le contrat que consommera le générateur de missions (Sprint
//    2, hors scope ici).
// ------------------------------------------------------------
{
  const missionRules = [
    { id: 'r3', actif: true, moment_code: 'debut', quart: null, role_code: 'caissier', role_repli: null, ordre_affichage: 30 },
    { id: 'r1', actif: true, moment_code: 'debut', quart: null, role_code: 'pompiste', role_repli: null, ordre_affichage: 10 },
    { id: 'r2', actif: true, moment_code: 'fin', quart: null, role_code: 'caissier', role_repli: null, ordre_affichage: 20 },
    { id: 'r4', actif: false, moment_code: 'debut', quart: null, role_code: 'renfort', role_repli: null, ordre_affichage: 5 },
    { id: 'r5', actif: true, moment_code: 'debut', quart: 'soir', role_code: 'caissier', role_repli: null, ordre_affichage: 15 },
  ];
  const resolues = M.resoudreMissionRulesApplicables({ missionRules, quart: 'matin', moment: 'debut', rolesPresents: ['pompiste'] });
  // Attendu : r1 (pompiste, debut, ordre 10) et r3 (caissier, debut, ordre 30) —
  // jamais r2 (moment différent), jamais r4 (inactive), jamais r5 (quart soir
  // uniquement, on est en matin).
  assert.strictEqual(resolues.length, 2, 'seules r1 et r3 sont applicables au contexte (matin, debut)');
  assert.deepStrictEqual(resolues.map(r => r.regle.id), ['r1', 'r3'], 'tri par ordre_affichage, jamais l\'ordre d\'insertion brut');
  assert.strictEqual(resolues[0].statut, 'affectee', 'r1 (pompiste) est affectée : pompiste est présent');
  assert.strictEqual(resolues[1].statut, 'non_affectee', 'r3 (caissier) est non affectée : aucun caissier présent, pas de repli configuré');

  ok('resoudreMissionRulesApplicables — filtre actif/moment/quart, tri par ordre_affichage, résolution par règle');
}

// ------------------------------------------------------------
// 4) libelleMoment / libelleStrategieRepli — jamais un libellé vide sur une
//    valeur inconnue (Article 5 : mieux vaut afficher la valeur brute
//    qu'une chaîne vide qui masquerait un problème de configuration).
// ------------------------------------------------------------
{
  assert.strictEqual(M.libelleMoment('debut'), 'Début de quart');
  assert.strictEqual(M.libelleMoment('pendant'), 'Pendant le quart');
  assert.strictEqual(M.libelleMoment('fin'), 'Fin de quart (transmission)');
  assert.strictEqual(M.libelleMoment('inconnu'), 'inconnu', 'valeur inconnue -> restituée telle quelle, jamais une chaîne vide');

  assert.strictEqual(M.libelleStrategieRepli('reporter_quart_suivant'), 'Reporter au quart suivant');
  assert.strictEqual(M.libelleStrategieRepli('aucune'), 'Aucune (mission simplement non affectée)');
  assert.strictEqual(M.libelleStrategieRepli(null), 'Aucune stratégie configurée');

  ok('libelleMoment/libelleStrategieRepli — libellés corrects, jamais une chaîne vide sur une valeur absente/inconnue');
}

// ------------------------------------------------------------
// 5) Configuration par défaut NEXUS — générique, aucune référence
//    Sainte-Marie/Vito (doctrine §2/§39 : "aucune règle métier de
//    Sainte-Marie ne doit être codée directement dans le JavaScript").
// ------------------------------------------------------------
{
  const texteTemplate = JSON.stringify(M.CATEGORIES_DEFAUT_NEXUS) + JSON.stringify(M.MISSION_RULES_DEFAUT_NEXUS) + JSON.stringify(M.ROLES_DEFAUT_NEXUS);
  assert.ok(!/vito|sainte.?marie/i.test(texteTemplate), 'le template par défaut NEXUS ne doit contenir aucune référence à un site particulier');
  assert.ok(M.CATEGORIES_DEFAUT_NEXUS.length > 0);
  assert.ok(M.MISSION_RULES_DEFAUT_NEXUS.every(r => Array.isArray(r.categorie_noms) && r.categorie_noms.length > 0), 'chaque mission par défaut référence ses catégories par NOM (résolu à l\'installation), jamais un uuid en dur');
  const nomsCategories = new Set(M.CATEGORIES_DEFAUT_NEXUS.map(c => c.nom));
  M.MISSION_RULES_DEFAUT_NEXUS.forEach(r => r.categorie_noms.forEach(nom => {
    assert.ok(nomsCategories.has(nom), `la mission "${r.nom}" référence une catégorie "${nom}" absente de CATEGORIES_DEFAUT_NEXUS`);
  }));

  ok('CATEGORIES_DEFAUT_NEXUS/MISSION_RULES_DEFAUT_NEXUS — générique (aucune référence Sainte-Marie/Vito), catégories référencées par nom et toutes résolues dans le même template');
}

// ------------------------------------------------------------
// 6) nexus-inventaire-mission-rules-donnees.js — chargerMissionRules /
//    creerMissionRule / dés-réactivation : forme exacte des requêtes.
// ------------------------------------------------------------
{
  let capture = null;
  const client = {
    from(table) {
      capture = { table, calls: [] };
      const chain = {
        select(...a) { capture.calls.push(['select', a]); return chain; },
        eq(...a) { capture.calls.push(['eq', a]); return chain; },
        order(...a) { capture.calls.push(['order', a]); return Promise.resolve({ data: [{ id: 'm1' }], error: null }); },
        insert(payload) { capture.insertPayload = payload; return chain; },
        update(patch) { capture.updatePayload = patch; return chain; },
        maybeSingle() { return Promise.resolve({ data: { id: 'm1', ...capture.insertPayload, ...capture.updatePayload }, error: null }); },
      };
      return chain;
    },
  };

  const rules = await D.chargerMissionRules(client, 'vito-sainte-marie');
  assert.strictEqual(capture.table, 'inventaire_mission_rules');
  assert.deepStrictEqual(rules, [{ id: 'm1' }]);

  const cree = await D.creerMissionRule(client, 'vito-sainte-marie', { nom: 'Test' });
  assert.strictEqual(capture.insertPayload.site, 'vito-sainte-marie', 'le site est toujours injecté par le chargeur, jamais laissé à l\'appelant');
  assert.strictEqual(cree.nom, 'Test');

  await D.desactiverMissionRule(client, 'm1');
  assert.strictEqual(capture.updatePayload.actif, false);
  assert.ok(capture.updatePayload.updated_at, 'updated_at est toujours posé à la modification');

  await D.reactiverMissionRule(client, 'm1');
  assert.strictEqual(capture.updatePayload.actif, true);

  ok('chargerMissionRules/creerMissionRule/dés-réactivation — site toujours injecté côté serveur, jamais une suppression (actif=false/true uniquement)');
}

// ------------------------------------------------------------
// 7) chargerRolesPresentsQuart — quart absent -> [] (pas une erreur),
//    quart présent -> rôles réels dédupliqués.
// ------------------------------------------------------------
{
  function mockClientPresence(quartExiste) {
    return {
      from(table) {
        if (table === 'inventaire_quarts') {
          return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: quartExiste ? { id: 'q1' } : null, error: null }) }) }) }) }) };
        }
        if (table === 'inventaire_quart_employes') {
          return { select: () => ({ eq: () => Promise.resolve({ data: [{ role: 'caissier' }, { role: 'caissier' }, { role: 'pompiste' }], error: null }) }) };
        }
        throw new Error('table inattendue: ' + table);
      },
    };
  }
  const rolesAbsent = await D.chargerRolesPresentsQuart(mockClientPresence(false), 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.deepStrictEqual(rolesAbsent, [], 'quart pas encore ouvert -> aucun rôle présent, jamais une erreur (Article 5)');

  const rolesPresent = await D.chargerRolesPresentsQuart(mockClientPresence(true), 'vito-sainte-marie', '2026-08-29', 'matin');
  assert.deepStrictEqual(rolesPresent.sort(), ['caissier', 'pompiste'], 'rôles dédupliqués');

  ok('chargerRolesPresentsQuart — [] si le quart n\'existe pas encore, rôles réels dédupliqués sinon');
}

// ------------------------------------------------------------
// 8) installerConfigurationDefautNexus — idempotence sur catégories ET
//    missions déjà existantes (par nom), résolution nom->id correcte.
// ------------------------------------------------------------
{
  function mockClientInstall({ categoriesExistantes, missionsExistantes }) {
    const inserts = { categories: [], missions: [] };
    let prochainIdCat = 100;
    return {
      _inserts: inserts,
      from(table) {
        if (table === 'inventaire_categories') {
          return {
            select: () => ({ eq: () => Promise.resolve({
              data: categoriesExistantes.concat(inserts.categories.map(c => ({ id: c.id, nom: c.nom }))),
              error: null,
            }) }),
            insert(rows) {
              const created = rows.map(r => ({ id: 'cat-' + (prochainIdCat++), nom: r.nom }));
              inserts.categories.push(...created);
              return { select: () => Promise.resolve({ data: created, error: null }) };
            },
          };
        }
        if (table === 'inventaire_mission_rules') {
          return {
            select: () => ({ eq: () => Promise.resolve({ data: missionsExistantes.map(nom => ({ nom })), error: null }) }),
            insert(row) { inserts.missions.push(row); return Promise.resolve({ error: null }); },
          };
        }
        throw new Error('table inattendue: ' + table);
      },
    };
  }

  // Cas 1 : rien n'existe encore -> tout est créé, catégories résolues.
  const client1 = mockClientInstall({ categoriesExistantes: [], missionsExistantes: [] });
  const r1 = await D.installerConfigurationDefautNexus(client1, 'nouveau-site');
  assert.strictEqual(r1.categoriesCreees, M.CATEGORIES_DEFAUT_NEXUS.length, 'toutes les catégories par défaut sont créées sur un site vierge');
  assert.strictEqual(r1.missionsCreees, M.MISSION_RULES_DEFAUT_NEXUS.length, 'toutes les missions par défaut sont créées sur un site vierge');
  assert.strictEqual(r1.erreurs.length, 0, 'aucune erreur attendue sur une installation propre : ' + JSON.stringify(r1.erreurs));
  client1._inserts.missions.forEach(m => {
    assert.ok(Array.isArray(m.categorie_ids) && m.categorie_ids.length > 0, `mission "${m.nom}" doit avoir ses categorie_ids résolus (jamais vides pour une règle qui référence des catégories)`);
    assert.ok(m.categorie_ids.every(id => id.startsWith('cat-')), 'les categorie_ids doivent être les vrais id créés, jamais les noms bruts');
  });

  // Cas 2 : tout existe déjà (même nom) -> idempotent, rien recréé en double.
  const nomsCategoriesDefaut = M.CATEGORIES_DEFAUT_NEXUS.map((c, i) => ({ id: 'existant-cat-' + i, nom: c.nom }));
  const nomsMissionsDefaut = M.MISSION_RULES_DEFAUT_NEXUS.map(m => m.nom);
  const client2 = mockClientInstall({ categoriesExistantes: nomsCategoriesDefaut, missionsExistantes: nomsMissionsDefaut });
  const r2 = await D.installerConfigurationDefautNexus(client2, 'site-deja-configure');
  assert.strictEqual(r2.categoriesCreees, 0, 'rappeler l\'installateur sur un site déjà configuré ne doit recréer aucune catégorie');
  assert.strictEqual(r2.missionsCreees, 0, 'rappeler l\'installateur sur un site déjà configuré ne doit recréer aucune mission');

  // Cas 3 : catégories partiellement présentes -> seules les manquantes sont créées.
  const unePartie = [{ id: 'cat-existante-0', nom: M.CATEGORIES_DEFAUT_NEXUS[0].nom }];
  const client3 = mockClientInstall({ categoriesExistantes: unePartie, missionsExistantes: [] });
  const r3 = await D.installerConfigurationDefautNexus(client3, 'site-partiel');
  assert.strictEqual(r3.categoriesCreees, M.CATEGORIES_DEFAUT_NEXUS.length - 1, 'seules les catégories manquantes sont créées, jamais un doublon de celle déjà présente');

  ok('installerConfigurationDefautNexus — idempotent sur catégories ET missions (par nom), categorie_ids toujours résolus en vrais id, jamais un doublon au second appel');
}

console.log(`\n${n} tests passés.`);

})();
