// Test — Notification Commande Carburant dans Cockpit/Brief (24/08/2026,
// v2.239, cahier "NEXUS — Moteur Commande Carburant" §24-25). Couvre :
//   1. NexusCarburantCommandeMoteur.calculerCandidatCommande() — pure,
//      produit au plus 1 candidat selon l'etatGlobal déjà calculé (jamais
//      un second calcul du statut, Article 11).
//   2. NexusConseiller.normaliserCommandeCarburant() — même schéma commun
//      que normaliserFdj/normaliserCoach (moteur non validable).
//   3. NexusBriefDonnees.chargerCandidatCommandeCarburant() — orchestration
//      (mock Supabase), vérifie qu'aucun second calcul n'est fait et que le
//      résultat traverse intact jusqu'au candidat normalisé.

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function charger(sandbox, fichier) {
  const code = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
  vm.runInContext(code, sandbox);
}

const sandbox = { console, window: undefined };
vm.createContext(sandbox);
sandbox.window = sandbox; // les fichiers NEXUS s'attachent à `window` si présent, sinon globalThis
charger(sandbox, 'nexus-carburant-moteur.js');
charger(sandbox, 'nexus-carburant-commande-moteur.js');
charger(sandbox, 'nexus-conseiller.js');

const CM = sandbox.NexusCarburantCommandeMoteur;
const Conseiller = sandbox.NexusConseiller;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ============================================================
// 1. calculerCandidatCommande()
// ============================================================

// 1a. etatGlobal confortable/non_calculable -> aucun candidat.
assert.strictEqual(CM.calculerCandidatCommande({ ok: true, etatGlobal: 'confortable', parCarburant: {} }), null);
assert.strictEqual(CM.calculerCandidatCommande({ ok: true, etatGlobal: 'non_calculable', parCarburant: {} }), null);
assert.strictEqual(CM.calculerCandidatCommande({ ok: false, motif: 'x' }), null);
assert.strictEqual(CM.calculerCandidatCommande(null), null);
ok('confortable/non_calculable/ok:false/null -> aucun candidat');

// 1b. moment_ideal avec commandeRecommandee -> candidat "action", niveau attention, rangInterne 0.
{
  const evaluation = {
    ok: true, dateISO: '2026-08-24', etatGlobal: 'moment_ideal',
    parCarburant: {
      sp95: { carburant: 'sp95', etat: 'moment_ideal', confiance: 'fiable',
        scenarioMaintenant: { margeJours: -0.9 },
        attente: { motif: 'Attendre ferait passer la réserve de sécurité sous le seuil (marge estimée : -1.9 j).' } },
    },
    optimisation: { decision: 'commander', motif: null },
    commandeRecommandee: { volumes: { sp95: 14000 }, total: 14000 },
  };
  const c = CM.calculerCandidatCommande(evaluation);
  assert.ok(c, 'candidat attendu');
  assert.strictEqual(c.niveau, 'attention');
  assert.strictEqual(c.rangInterne, 0);
  assert.ok(c.decision.includes('SP95'), 'nom court carburant dans la décision : ' + c.decision);
  // toLocaleString('fr-FR') insère une espace fine insécable (U+202F), pas
  // une espace normale, entre milliers — comparaison sur le nombre formaté
  // réel plutôt qu'une espace ASCII qui ne correspondrait jamais.
  assert.ok(c.decision.includes((14000).toLocaleString('fr-FR')), 'total dans la décision : ' + c.decision);
  assert.strictEqual(c.constat, evaluation.parCarburant.sp95.attente.motif);
  assert.strictEqual(c.cible, 'NEXUS-Carburants-Pilotage-v1.html');
  assert.strictEqual(c.confiance, 'Élevée');
  ok('moment_ideal + commandeRecommandee -> candidat action complet');
}

// 1c. securite -> niveau critique, rangInterne 0.
{
  const evaluation = {
    ok: true, dateISO: '2026-08-24', etatGlobal: 'securite',
    parCarburant: { go: { carburant: 'go', etat: 'securite', confiance: 'a_confirmer', scenarioMaintenant: {}, attente: { motif: 'x' } } },
    optimisation: { decision: 'commander', motif: null },
    commandeRecommandee: { volumes: { go: 9000 }, total: 9000 },
  };
  const c = CM.calculerCandidatCommande(evaluation);
  assert.strictEqual(c.niveau, 'critique');
  assert.strictEqual(c.rangInterne, 0);
  assert.strictEqual(c.confiance, 'Moyenne');
  ok('securite -> niveau critique, confiance Moyenne (a_confirmer)');
}

// 1d. a_anticiper -> candidat "anticipation", rangInterne 1, jamais de bouton/volume recommandé dans le texte.
{
  const evaluation = {
    ok: true, dateISO: '2026-08-24', etatGlobal: 'a_anticiper',
    parCarburant: {
      sp95: { carburant: 'sp95', etat: 'a_anticiper', joursAvantBesoin: 2, confiance: 'fiable', attente: { motif: 'Attendre reste compatible avec la réserve de sécurité (marge estimée : 4.0 j).' } },
      go: { carburant: 'go', etat: 'confortable', confiance: 'fiable' },
    },
    optimisation: { decision: 'attendre', motif: "Aucun carburant n'est dans sa fenêtre de commande aujourd'hui." },
    commandeRecommandee: null,
  };
  const c = CM.calculerCandidatCommande(evaluation);
  assert.ok(c, 'candidat anticipation attendu');
  assert.strictEqual(c.rangInterne, 1);
  assert.ok(c.decision.includes('Anticipez'), c.decision);
  assert.ok(c.decision.includes('2 j'), c.decision);
  ok('a_anticiper -> candidat anticipation, rangInterne 1, jamais "recommandé" fabriqué');
}

// 1e. insuffisant_meme_optimise (etat securite/moment_ideal mais pas de commandeRecommandee) -> motif honnête, pas de volume inventé.
{
  const evaluation = {
    ok: true, dateISO: '2026-08-24', etatGlobal: 'securite',
    parCarburant: { gnr: { carburant: 'gnr', etat: 'securite', confiance: 'a_confirmer', attente: { motif: 'x' } } },
    optimisation: { decision: 'insuffisant_meme_optimise', motif: 'Même optimisé, le besoin (4 000 L) reste sous le minimum de commande (10 000 L).' },
    commandeRecommandee: null,
  };
  const c = CM.calculerCandidatCommande(evaluation);
  assert.ok(c.decision.includes('minimum camion') || c.decision.toLowerCase().includes('vérifiez'), c.decision);
  assert.strictEqual(c.preuve, evaluation.optimisation.motif);
  ok('insuffisant_meme_optimise -> motif honnête transmis dans preuve, pas de volume inventé');
}

// 1f. Un seul candidat par appel, jamais 2 (§24 "2 notifications max" trivialement respecté).
{
  const evaluation = {
    ok: true, dateISO: '2026-08-24', etatGlobal: 'moment_ideal',
    parCarburant: {
      sp95: { carburant: 'sp95', etat: 'moment_ideal', confiance: 'fiable', scenarioMaintenant: {}, attente: { motif: 'x' } },
      go: { carburant: 'go', etat: 'a_anticiper', joursAvantBesoin: 1, confiance: 'fiable', attente: { motif: 'y' } },
    },
    optimisation: { decision: 'commander', motif: null },
    commandeRecommandee: { volumes: { sp95: 14000 }, total: 14000 },
  };
  const c = CM.calculerCandidatCommande(evaluation);
  assert.strictEqual(typeof c, 'object');
  assert.ok(!Array.isArray(c), 'un seul objet, jamais un tableau de plusieurs candidats');
  ok('etatGlobal mixte (moment_ideal + a_anticiper) -> un seul candidat retourné');
}

// ============================================================
// 2. NexusConseiller.normaliserCommandeCarburant()
// ============================================================
{
  const brut = {
    id: 'COMMANDE-CARBURANT-2026-08-24', niveau: 'critique', rangInterne: 0,
    titre: 'Commande carburant', decision: 'Commandez SP95.', constat: 'x',
    impactAttendu: 'y', preuve: 'z', limites: 'w',
    cible: 'NEXUS-Carburants-Pilotage-v1.html', confiance: 'Élevée',
  };
  const norm = Conseiller.normaliserCommandeCarburant(brut);
  assert.strictEqual(norm.moteur, 'commande_carburant');
  assert.strictEqual(norm.rang, 0);
  assert.strictEqual(norm.etat, '🔴 CRITIQUE');
  assert.strictEqual(norm.validable, false);
  assert.strictEqual(norm.decision, brut.decision);
  assert.strictEqual(norm.pourquoi, brut.constat);
  assert.strictEqual(norm.cible, brut.cible);
  assert.strictEqual(norm.confiance, 'Élevée');
  ok('normaliserCommandeCarburant() — schéma commun respecté (niveau critique)');

  const attention = Conseiller.normaliserCommandeCarburant({ ...brut, niveau: 'attention', rangInterne: 1 });
  assert.strictEqual(attention.etat, '🟡 À VÉRIFIER');
  assert.strictEqual(attention.rang, 1);
  ok('normaliserCommandeCarburant() — niveau attention -> 🟡 À VÉRIFIER, rang 1');
}

// ============================================================
// 3. NexusBriefDonnees.chargerCandidatCommandeCarburant() — orchestration
// ============================================================
(async () => {
  const sandbox2 = { console, window: undefined };
  vm.createContext(sandbox2);
  sandbox2.window = sandbox2;
  charger(sandbox2, 'nexus-carburant-moteur.js');
  charger(sandbox2, 'nexus-carburant-commande-moteur.js');
  charger(sandbox2, 'nexus-conseiller.js');
  charger(sandbox2, 'nexus-brief-donnees.js');

  let evaluerAppels = 0;
  sandbox2.NexusCarburantCommandeDonnees = {
    evaluerCommandeCarburantSite: async (client, siteId) => {
      evaluerAppels++;
      return {
        ok: true, dateISO: '2026-08-24', etatGlobal: 'securite',
        parCarburant: { go: { carburant: 'go', etat: 'securite', confiance: 'fiable', scenarioMaintenant: {}, attente: { motif: 'x' } } },
        optimisation: { decision: 'commander', motif: null },
        commandeRecommandee: { volumes: { go: 9000 }, total: 9000 },
      };
    },
  };

  const resultat = await sandbox2.NexusBriefDonnees.chargerCandidatCommandeCarburant({}, 'vito-sainte-marie');
  assert.strictEqual(evaluerAppels, 1, 'evaluerCommandeCarburantSite appelé exactement une fois (aucun second calcul)');
  assert.strictEqual(resultat.length, 1);
  assert.strictEqual(resultat[0].moteur, 'commande_carburant');
  assert.strictEqual(resultat[0].etat, '🔴 CRITIQUE');
  ok('chargerCandidatCommandeCarburant() — un seul appel evaluer, candidat normalisé retourné');

  // Site confortable -> aucun candidat, tableau vide (jamais null/undefined).
  sandbox2.NexusCarburantCommandeDonnees.evaluerCommandeCarburantSite = async () => ({ ok: true, etatGlobal: 'confortable', parCarburant: {} });
  const vide = await sandbox2.NexusBriefDonnees.chargerCandidatCommandeCarburant({}, 'vito-sainte-marie');
  // Array.from() : tableau créé dans la realm du vm sandbox, deepStrictEqual
  // le rejette sinon malgré un contenu identique (même quirk déjà rencontré
  // et documenté dans test_carburant_commande_moteur_v2238.js).
  assert.deepStrictEqual(Array.from(vide), []);
  ok('chargerCandidatCommandeCarburant() — état confortable -> tableau vide');

  console.log(`\n${n + 2}/${n + 2} tests passés.`);
})();
