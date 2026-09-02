// Test — Inventaire V2 Sprint 4 "Répartition par rôles" (29/08/2026,
// Frédéric a confirmé "sprint 4"). Dernier maillon de l'ordre de
// développement qu'il avait lui-même fixé : "Paramètres → Génération des
// missions → Expérience employé → Deux jauges → Répartition par rôles."
//
// Gap corrigé dans ce sprint : une Mission est définie par la doctrine
// comme site+rôle+EMPLOYÉ+quart+moment+périmètre+sélection, mais rien
// jusqu'ici ne distinguait deux employés partageant un même rôle sur un
// même quart — les deux auraient vu le périmètre ENTIER de la mission.
//
// PARTIE 1 — nexus-inventaire-moteur.js::repartirPerimetreParEmploye
//   (require direct, fonction pure).
// PARTIE 2 — nexus-inventaire-mission-rules-donnees.js::
//   chargerEmployesPresentsParRole (nouvelle) + chargerRolesPresentsQuart
//   (inchangée en surface, désormais dérivée de la première — Article 11).
// PARTIE 3 — NEXUS-Inventaire-v1.html : renderBlocCouvertureQuart (jauge
//   collective, deuxième jauge de la doctrine) + chargerMissionsDuJour
//   (vérifie que la répartition est bien appliquée en mémoire avant
//   affichage), extraites par regex (même méthode que
//   test_pont_jaugeage_carburant_inventaire.js et
//   test_inventaire_mission_experience_sprint3.js — jamais réécrites à la
//   main).

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const PROJET = __dirname;

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — nexus-inventaire-moteur.js::repartirPerimetreParEmploye
// ------------------------------------------------------------
global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;
assert.strictEqual(typeof M.repartirPerimetreParEmploye, 'function', 'repartirPerimetreParEmploye doit être exportée');

testSync('repartirPerimetreParEmploye — un seul employé sur le rôle -> périmètre INCHANGÉ (rétro-compatibilité stricte, réalité actuelle de Sainte-Marie)', () => {
  const perimetre = ['p1', 'p2', 'p3'];
  const resultat = M.repartirPerimetreParEmploye(perimetre, ['solo'], 'solo', 'seed-x');
  assert.deepStrictEqual(resultat, perimetre);
});

testSync('repartirPerimetreParEmploye — 3 employés -> split déterministe, aucune perte, aucun chevauchement', () => {
  const perimetre = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  const employes = ['empA', 'empB', 'empC'];
  const seed = 'site|2026-08-29|matin|rule1|debut';
  const partA = M.repartirPerimetreParEmploye(perimetre, employes, 'empA', seed);
  const partB = M.repartirPerimetreParEmploye(perimetre, employes, 'empB', seed);
  const partC = M.repartirPerimetreParEmploye(perimetre, employes, 'empC', seed);
  const union = new Set([...partA, ...partB, ...partC]);
  assert.strictEqual(union.size, perimetre.length, 'chaque produit doit être attribué à exactement un employé');
  assert.strictEqual(partA.length + partB.length + partC.length, perimetre.length, 'aucun produit dupliqué entre employés');
  assert.ok(partA.every(id => !partB.includes(id) && !partC.includes(id)), 'aucun chevauchement entre les parts');
});

testSync('repartirPerimetreParEmploye — déterministe : même seed + même liste -> toujours la même part, quel que soit l\'ordre d\'arrivée des employés', () => {
  const perimetre = ['p1', 'p2', 'p3', 'p4'];
  const seed = 'seed-stable';
  const part1 = M.repartirPerimetreParEmploye(perimetre, ['x', 'y'], 'x', seed);
  const part2 = M.repartirPerimetreParEmploye(perimetre, ['y', 'x'], 'x', seed);
  assert.deepStrictEqual(part1, part2, 'l\'ordre de présence des collègues ne doit jamais changer la répartition (INV2-04 : un rechargement ne doit jamais changer le résultat)');
});

testSync('repartirPerimetreParEmploye — employé courant absent de la liste (incohérence de présence) -> périmètre COMPLET restitué, jamais un trou invisible', () => {
  const perimetre = ['p1', 'p2'];
  const resultat = M.repartirPerimetreParEmploye(perimetre, ['autre1', 'autre2'], 'moi', 'seed-y');
  assert.deepStrictEqual(resultat, perimetre);
});

testSync('repartirPerimetreParEmploye — liste d\'employés vide ou absente -> périmètre COMPLET restitué', () => {
  const perimetre = ['p1', 'p2'];
  assert.deepStrictEqual(M.repartirPerimetreParEmploye(perimetre, [], 'moi', 'seed-z'), perimetre);
  assert.deepStrictEqual(M.repartirPerimetreParEmploye(perimetre, null, 'moi', 'seed-z'), perimetre);
});

// ------------------------------------------------------------
// PARTIE 2 — nexus-inventaire-mission-rules-donnees.js
// ------------------------------------------------------------
require(path.join(PROJET, 'nexus-inventaire-mission-rules-donnees.js'));
const D = global.NexusInventaireMissionRulesDonnees;
assert.strictEqual(typeof D.chargerEmployesPresentsParRole, 'function', 'chargerEmployesPresentsParRole doit être exportée');

function mockClientPresence(quartExiste, presences) {
  return {
    from(table) {
      if (table === 'inventaire_quarts') {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: quartExiste ? { id: 'q1' } : null, error: null }) }) }) }) }) };
      }
      if (table === 'inventaire_quart_employes') {
        return { select: () => ({ eq: () => Promise.resolve({ data: presences, error: null }) }) };
      }
      throw new Error('table inattendue: ' + table);
    },
  };
}

(async () => {
  await testAsync('chargerEmployesPresentsParRole — quart pas encore ouvert -> {}, jamais une erreur', async () => {
    const res = await D.chargerEmployesPresentsParRole(mockClientPresence(false, []), 'vito-sainte-marie', '2026-08-29', 'matin');
    assert.deepStrictEqual(res, {});
  });

  await testAsync('chargerEmployesPresentsParRole — regroupe par rôle, déduplique les employee_id', async () => {
    const presences = [
      { role: 'caissier', employee_id: 'e1' },
      { role: 'caissier', employee_id: 'e2' },
      { role: 'caissier', employee_id: 'e1' }, // doublon (ex. deux lignes de présence)
      { role: 'pompiste', employee_id: 'e3' },
    ];
    const res = await D.chargerEmployesPresentsParRole(mockClientPresence(true, presences), 'vito-sainte-marie', '2026-08-29', 'matin');
    assert.deepStrictEqual(res.caissier.sort(), ['e1', 'e2']);
    assert.deepStrictEqual(res.pompiste, ['e3']);
  });

  await testAsync('chargerEmployesPresentsParRole — un rôle présent sans employee_id renseigné reste compté (comportement historique préservé)', async () => {
    const presences = [{ role: 'renfort' }];
    const res = await D.chargerEmployesPresentsParRole(mockClientPresence(true, presences), 'vito-sainte-marie', '2026-08-29', 'matin');
    assert.deepStrictEqual(res.renfort, [], 'le rôle existe comme clé même sans employee_id exploitable pour la répartition');
  });

  await testAsync('chargerRolesPresentsQuart — signature et comportement INCHANGÉS (dérivée de chargerEmployesPresentsParRole, Article 11)', async () => {
    const presences = [{ role: 'caissier', employee_id: 'e1' }, { role: 'caissier', employee_id: 'e2' }, { role: 'pompiste', employee_id: 'e3' }];
    const roles = await D.chargerRolesPresentsQuart(mockClientPresence(true, presences), 'vito-sainte-marie', '2026-08-29', 'matin');
    assert.deepStrictEqual(roles.sort(), ['caissier', 'pompiste']);

    const rolesAbsent = await D.chargerRolesPresentsQuart(mockClientPresence(false, []), 'vito-sainte-marie', '2026-08-29', 'matin');
    assert.deepStrictEqual(rolesAbsent, []);
  });

  // ------------------------------------------------------------
  // PARTIE 3 — NEXUS-Inventaire-v1.html
  // ------------------------------------------------------------
  {
    const html = fs.readFileSync(path.join(PROJET, 'NEXUS-Inventaire-v1.html'), 'utf8');
    const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const script = scriptMatches.reduce((a, b) => (b.length > a.length ? b : a), '');
    assert.ok(script.includes('renderBlocCouvertureQuart'), 'Bloc script applicatif introuvable');

    function extraireFonction(nomFonction) {
      let debut = script.indexOf(`function ${nomFonction}(`);
      assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
      const prefixe = 'async ';
      if (script.slice(debut - prefixe.length, debut) === prefixe) debut -= prefixe.length;
      let i = script.indexOf('{', debut);
      let profondeur = 1, j = i + 1;
      while (profondeur > 0) {
        if (script[j] === '{') profondeur++;
        else if (script[j] === '}') profondeur--;
        j++;
      }
      return script.slice(debut, j);
    }

    // --- 3.1 — renderBlocCouvertureQuart (jauge collective) ---
    {
      const srcParts = [
        'let planQuartActif = null;',
        'let produitsPlanIds = new Set();',
        'const NexusInventaireMoteur = globalThis.__moteur;',
        extraireFonction('comptesFaitsDuPlan'),
        extraireFonction('renderBlocCouvertureQuart'),
        `globalThis.__test = {
          setEnv: (env) => { planQuartActif = env.planQuartActif; produitsPlanIds = env.produitsPlanIds; },
          renderBlocCouvertureQuart,
        };`,
      ].join('\n\n');
      const ctx = { globalThis: {}, console, __moteur: M };
      ctx.globalThis = ctx;
      vm.runInNewContext(srcParts, ctx);
      const T = ctx.__test;

      testSync('renderBlocCouvertureQuart — plan vide (produitsPlanIds vide) -> chaîne vide, jamais un faux "100% terminé"', () => {
        T.setEnv({ planQuartActif: null, produitsPlanIds: new Set() });
        assert.strictEqual(T.renderBlocCouvertureQuart(), '');
      });

      testSync('renderBlocCouvertureQuart — reflète la jauge réelle du quart entier (tous rôles confondus)', () => {
        T.setEnv({
          planQuartActif: { items: [
            { produit_id: 'gaz1', statut: 'fait' },
            { produit_id: 'tabac1', statut: 'fait' },
            { produit_id: 'tabac2', statut: 'a_faire' },
            { produit_id: 'presse1', statut: 'a_faire' },
          ] },
          produitsPlanIds: new Set(['gaz1', 'tabac1', 'tabac2', 'presse1']),
        });
        const rendu = T.renderBlocCouvertureQuart();
        assert.ok(rendu.includes('Couverture du quart'), 'le libellé collectif doit être présent');
        assert.ok(rendu.includes('2 sur 4'), '2 produits faits sur 4 au total, tous rôles confondus');
        assert.ok(rendu.includes('width:50%'), 'la barre doit refléter 50%');
      });
    }

    // --- 3.2 — chargerMissionsDuJour applique bien la répartition ---
    {
      const srcParts = [
        'let missionsDuJour = [];',
        'let roleDuJour = null;',
        'let quartActuel = null;',
        'const nexusClient = {};',
        'const employeeCourant = globalThis.__employeeCourant;',
        'const NexusInventaireMissionsDonnees = globalThis.__missionsDonnees;',
        'const NexusInventaireMissionRulesDonnees = globalThis.__missionRulesDonnees;',
        'const NexusInventaireMoteur = globalThis.__moteur;',
        'function dateISO() { return "2026-08-29"; }',
        extraireFonction('chargerMissionsDuJour'),
        `globalThis.__test = {
          setEnv: (env) => { roleDuJour = env.roleDuJour; quartActuel = env.quartActuel; },
          chargerMissionsDuJour,
          getMissionsDuJour: () => missionsDuJour,
        };`,
      ].join('\n\n');

      function construireCtx({ missionsBrutes, employesParRole, echouerRepartition }) {
        const ctx = {
          globalThis: {},
          console,
          __moteur: M,
          __employeeCourant: { id: 'empA', site_id: 'vito-sainte-marie' },
          __missionsDonnees: {
            chargerMissionsPourRole: async () => missionsBrutes.map(m => ({ ...m })),
          },
          __missionRulesDonnees: {
            chargerEmployesPresentsParRole: async () => {
              if (echouerRepartition) throw new Error('panne réseau simulée');
              return employesParRole;
            },
          },
        };
        ctx.globalThis = ctx;
        return ctx;
      }

      await testAsync('chargerMissionsDuJour — un seul employé sur le rôle -> périmètre de mission INCHANGÉ (zéro régression)', async () => {
        const ctx = construireCtx({
          missionsBrutes: [{ mission_rule_id: 'r1', moment_code: 'debut', produit_ids: ['p1', 'p2', 'p3'] }],
          employesParRole: { caissier: ['empA'] },
        });
        vm.runInNewContext(srcParts, ctx);
        ctx.__test.setEnv({ roleDuJour: 'caissier', quartActuel: 'matin' });
        await ctx.__test.chargerMissionsDuJour();
        const missions = ctx.__test.getMissionsDuJour();
        assert.deepStrictEqual(missions[0].produit_ids, ['p1', 'p2', 'p3']);
      });

      await testAsync('chargerMissionsDuJour — deux employés sur le rôle -> périmètre RÉDUIT à la part de empA, jamais le périmètre entier', async () => {
        const ctx = construireCtx({
          missionsBrutes: [{ mission_rule_id: 'r1', moment_code: 'debut', produit_ids: ['p1', 'p2', 'p3', 'p4'] }],
          employesParRole: { caissier: ['empA', 'empB'] },
        });
        vm.runInNewContext(srcParts, ctx);
        ctx.__test.setEnv({ roleDuJour: 'caissier', quartActuel: 'matin' });
        await ctx.__test.chargerMissionsDuJour();
        const missions = ctx.__test.getMissionsDuJour();
        assert.ok(missions[0].produit_ids.length < 4, 'empA ne doit voir qu\'une partie du périmètre, pas les 4 produits');
        assert.ok(missions[0].produit_ids.length > 0, 'empA doit tout de même avoir une part non vide');
      });

      await testAsync('chargerMissionsDuJour — échec réseau de la répartition -> périmètre COMPLET conservé, jamais une mission vide par accident technique', async () => {
        const ctx = construireCtx({
          missionsBrutes: [{ mission_rule_id: 'r1', moment_code: 'debut', produit_ids: ['p1', 'p2'] }],
          employesParRole: {},
          echouerRepartition: true,
        });
        vm.runInNewContext(srcParts, ctx);
        ctx.__test.setEnv({ roleDuJour: 'caissier', quartActuel: 'matin' });
        await ctx.__test.chargerMissionsDuJour();
        const missions = ctx.__test.getMissionsDuJour();
        assert.deepStrictEqual(missions[0].produit_ids, ['p1', 'p2']);
      });
    }
  }

  if (process.exitCode) { console.log('\nDes tests ont échoué.'); }
  else { console.log('\nTous les tests sont passés.'); }
})();
