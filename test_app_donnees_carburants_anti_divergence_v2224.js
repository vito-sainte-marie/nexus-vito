// Test — Règle anti-divergence Brief / "Votre entreprise aujourd'hui"
// (23/08/2026, v2.224, audit "Anti-dégradation temporelle" §7).
//
// Constat : `chargerStatutCarburantsHome` (nexus-app-donnees.js) affirmait
// depuis l'origine réutiliser "TEL QUEL" le même calcul Carburants que
// Brief — mais appelait `NexusCarburantDonnees.chargerControleJour`
// directement sur AUJOURD'HUI SEUL, sans jamais avoir été mise à jour
// quand Brief a gagné le fallback temporel "dernier état fiable" (v2.214+,
// `NexusBriefDonnees.chargerCarburantsBriefAvecFallback`). Résultat :
// exactement le scénario que l'audit interdit (§7, "règle anti-
// divergence") — Brief et "Votre entreprise aujourd'hui" pouvaient
// afficher un statut Carburants DIFFÉRENT au même instant, uniquement
// parce qu'aujourd'hui n'était pas encore complet.
//
// Ce test prouve que `chargerStatutCarburantsHome` délègue désormais
// entièrement à `NexusBriefDonnees.chargerCarburantsBriefAvecFallback` — en
// stubbant cette dernière (déjà testée ailleurs, notamment
// test_carburant_fallback_dernier_etat_fiable.js) et en piégeant
// `NexusCarburantDonnees.chargerControleJour` avec une valeur "aujourd'hui
// seul" volontairement différente : si `chargerStatutCarburantsHome`
// utilisait encore ce chemin direct, le test le détecterait immédiatement.

const assert = require('assert');
const path = require('path');
const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-carburant-moteur.js'));
require(path.join(PROJET, 'nexus-app-donnees.js'));
const M = global.NexusCarburantMoteur;
const AD = global.NexusAppDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const PAR_CARBURANT_CONFORME = {
  go: { statut: 'Sous contrôle', ecart: 5 },
  sp95: { statut: 'Sous contrôle', ecart: -2 },
  gnr: { statut: 'Sous contrôle', ecart: 1 },
};
const PAR_CARBURANT_ECART = {
  go: { statut: 'À corriger', ecart: 120 },
  sp95: { statut: 'Sous contrôle', ecart: -2 },
  gnr: { statut: 'Sous contrôle', ecart: 1 },
};

async function main() {
  // ------------------------------------------------------------
  // 1) Cycle du jour complet (mode 'jour', non-régression) : le résultat
  // vient toujours de chargerCarburantsBriefAvecFallback, cohérent avec ce
  // que Brief afficherait.
  // ------------------------------------------------------------
  {
    global.NexusCarburantDonnees = {
      chargerControleJour: async () => { throw new Error('ne doit jamais être appelée directement par chargerStatutCarburantsHome'); },
    };
    global.NexusBriefDonnees = {
      chargerCarburantsBriefAvecFallback: async (client, siteId, date) => ({
        controle: { parCarburant: PAR_CARBURANT_CONFORME, aucunReleve: false },
        fraicheur: { mode: 'jour' },
      }),
    };
    const resultat = await AD.chargerStatutCarburantsHome({}, 'vito-sainte-marie');
    assert.strictEqual(resultat.statut, 'Sous contrôle');
    assert.strictEqual(resultat.fraicheur.mode, 'jour');
    ok('chargerStatutCarburantsHome (mode "jour") : statut identique à celui que Brief calculerait, jamais un appel direct à chargerControleJour');
  }

  // ------------------------------------------------------------
  // 2) LE cas régressif corrigé : aujourd'hui incomplet côté Brief (aucun
  // relevé), mais un fallback J-1 fiable et conforme existe — Brief
  // afficherait "Sous contrôle" (score figé sur J-1). Avant ce correctif,
  // chargerStatutCarburantsHome aurait appelé chargerControleJour
  // directement sur aujourd'hui (aucunReleve=true) et affiché "Données
  // insuffisantes" — un statut DIFFÉRENT de Brief au même instant.
  // ------------------------------------------------------------
  {
    global.NexusCarburantDonnees = {
      chargerControleJour: async () => ({ parCarburant: null, aucunReleve: true }), // ce que "aujourd'hui seul" donnerait
    };
    global.NexusBriefDonnees = {
      chargerCarburantsBriefAvecFallback: async () => ({
        controle: { parCarburant: PAR_CARBURANT_CONFORME, aucunReleve: false }, // le controle FIGÉ sur J-1, fiable
        fraicheur: { mode: 'fallback', dateReference: '2026-08-22', joursEcoules: 1 },
      }),
    };
    const resultat = await AD.chargerStatutCarburantsHome({}, 'vito-sainte-marie');
    assert.strictEqual(resultat.statut, 'Sous contrôle', 'doit refléter le fallback J-1 de Brief, jamais "Données insuffisantes" calculé sur aujourd\'hui seul');
    assert.notStrictEqual(resultat.statut, 'Données insuffisantes');
    assert.strictEqual(resultat.fraicheur.mode, 'fallback');
    ok('chargerStatutCarburantsHome (mode "fallback") : reflète le dernier état fiable de Brief — la divergence de l\'audit §7 est éliminée');
  }

  // ------------------------------------------------------------
  // 3) Signal critique confirmé aujourd'hui (Brief bascule en mode 'jour'
  // forcé, écart réel) : "Votre entreprise aujourd'hui" doit voir le MÊME
  // écart immédiatement, jamais un fallback masquant.
  // ------------------------------------------------------------
  {
    global.NexusBriefDonnees = {
      chargerCarburantsBriefAvecFallback: async () => ({
        controle: { parCarburant: PAR_CARBURANT_ECART, aucunReleve: false },
        fraicheur: { mode: 'jour' },
      }),
    };
    const resultat = await AD.chargerStatutCarburantsHome({}, 'vito-sainte-marie');
    assert.strictEqual(resultat.statut, 'À corriger');
    assert.ok(resultat.detail.includes('Go') || resultat.detail.toLowerCase().includes('go'), `detail attendu nommant le carburant en écart, obtenu: "${resultat.detail}"`);
    ok('chargerStatutCarburantsHome : un signal critique confirmé remonte identiquement à Brief, jamais masqué');
  }

  console.log(`\n${n}/${n} tests passés — Règle anti-divergence Carburants Brief / Accueil (v2.224).`);
}

main().catch(e => { console.error(e); process.exit(1); });
