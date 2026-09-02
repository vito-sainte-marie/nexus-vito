// Test — Production journalière, M8 "Analyse : conseillé vs préparé vs
// écoulé (fondations)" (19/08/2026). Couvre :
//   1. nexus-inventaire-moteur.js — les 4 nouvelles fonctions pures
//      (analyserPreparationVsConseil, analyserEcoulementVsPreparation,
//      analyserJourneeProduction, syntheseAnalysePeriode), require direct.
//   2. nexus-inventaire-production-donnees.js::chargerAnalyseConseillePrepareEcoule
//      — assemblage sur une période, mock Supabase chaînable, aucune
//      réécriture des fonctions testées.

const assert = require('assert');
const path = require('path');

const PROJET = __dirname;

global.window = global;
require(path.join(PROJET, 'nexus-inventaire-moteur.js'));
const M = global.NexusInventaireMoteur;
assert.ok(M, 'NexusInventaireMoteur non chargé');
['analyserPreparationVsConseil', 'analyserEcoulementVsPreparation', 'analyserJourneeProduction', 'syntheseAnalysePeriode']
  .forEach(fn => assert.strictEqual(typeof M[fn], 'function', `${fn} doit être exportée`));

function testSync(nom, fn) {
  try { fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}
async function testAsync(nom, fn) {
  try { await fn(); console.log(`OK — ${nom}`); }
  catch (e) { console.error(`FAIL — ${nom}\n  ${e.stack}`); process.exitCode = 1; }
}

// ------------------------------------------------------------
// PARTIE 1 — moteur pur
// ------------------------------------------------------------

testSync('analyserPreparationVsConseil : aucune recommandation -> sans_recommandation, jamais un écart inventé', () => {
  const r = M.analyserPreparationVsConseil({ conseille: null, prepare: 20 });
  assert.deepStrictEqual(r, { ecart: null, ecartRatio: null, statut: 'sans_recommandation' });
});

testSync('analyserPreparationVsConseil : préparation inconnue -> preparation_inconnue', () => {
  const r = M.analyserPreparationVsConseil({ conseille: 20, prepare: null });
  assert.deepStrictEqual(r, { ecart: null, ecartRatio: null, statut: 'preparation_inconnue' });
});

testSync('analyserPreparationVsConseil : écart dans la tolérance (±15% ou ±1) -> conforme', () => {
  // 20 conseillé, tolérance = max(1, 3) = 3 -> 22 préparé (écart 2) reste conforme.
  const r = M.analyserPreparationVsConseil({ conseille: 20, prepare: 22 });
  assert.strictEqual(r.statut, 'conforme');
  assert.strictEqual(r.ecart, 2);
  // Petit conseillé (2) -> tolérance plancher = 1 unité, pas 15% (0.3).
  const r2 = M.analyserPreparationVsConseil({ conseille: 2, prepare: 3 });
  assert.strictEqual(r2.statut, 'conforme', 'Tolérance plancher de ±1 unité même sur un petit conseillé');
});

testSync('analyserPreparationVsConseil : au-delà de la tolérance -> sur_preparation / sous_preparation', () => {
  const sur = M.analyserPreparationVsConseil({ conseille: 20, prepare: 30 });
  assert.strictEqual(sur.statut, 'sur_preparation');
  assert.strictEqual(sur.ecart, 10);
  assert.strictEqual(sur.ecartRatio, 0.5);
  const sous = M.analyserPreparationVsConseil({ conseille: 20, prepare: 10 });
  assert.strictEqual(sous.statut, 'sous_preparation');
  assert.strictEqual(sous.ecart, -10);
});

testSync('analyserPreparationVsConseil : conseillé nul (0) -> ratio null si écart non nul, jamais une division par zéro qui plante', () => {
  const r = M.analyserPreparationVsConseil({ conseille: 0, prepare: 5 });
  assert.strictEqual(r.ecartRatio, null);
  assert.strictEqual(r.statut, 'sur_preparation');
  const r2 = M.analyserPreparationVsConseil({ conseille: 0, prepare: 0 });
  assert.strictEqual(r2.ecartRatio, 0);
  assert.strictEqual(r2.statut, 'conforme');
});

testSync('analyserEcoulementVsPreparation : préparé ou écoulé inconnu -> statuts dédiés, jamais un reste inventé', () => {
  assert.deepStrictEqual(M.analyserEcoulementVsPreparation({ prepare: null, ecoule: 5 }), { reste: null, resteRatio: null, statut: 'sans_donnee' });
  assert.deepStrictEqual(M.analyserEcoulementVsPreparation({ prepare: 20, ecoule: null }), { reste: null, resteRatio: null, statut: 'ecoulement_inconnu' });
});

testSync('analyserEcoulementVsPreparation : reste sous le seuil (20%) -> ecoule, au-delà -> reste_notable', () => {
  const ok = M.analyserEcoulementVsPreparation({ prepare: 20, ecoule: 17 }); // reste 3 = 15%
  assert.strictEqual(ok.statut, 'ecoule');
  const notable = M.analyserEcoulementVsPreparation({ prepare: 20, ecoule: 10 }); // reste 10 = 50%
  assert.strictEqual(notable.statut, 'reste_notable');
  assert.strictEqual(notable.reste, 10);
  assert.strictEqual(notable.resteRatio, 0.5);
});

testSync('analyserEcoulementVsPreparation : jamais qualifié de "perte" — le reste peut être transmis (Article 5)', () => {
  const r = M.analyserEcoulementVsPreparation({ prepare: 20, ecoule: 5 });
  assert.ok(!Object.values(r).some(v => typeof v === 'string' && v.includes('perte')), 'Aucune valeur ne doit mentionner "perte" — non prouvé sans donnée de transmission');
});

testSync('analyserJourneeProduction : assemble les deux comparaisons sans double calcul', () => {
  const r = M.analyserJourneeProduction({ conseille: 20, prepare: 22, ecoule: 18 });
  assert.strictEqual(r.preparation.statut, 'conforme');
  assert.strictEqual(r.ecoulement.statut, 'ecoule');
});

testSync('syntheseAnalysePeriode : compte les jours comparables uniquement, exclut sans_recommandation/preparation_inconnue de la moyenne', () => {
  const lignes = [
    { preparation: { statut: 'conforme', ecart: 1 }, ecoulement: { statut: 'ecoule' } },
    { preparation: { statut: 'sur_preparation', ecart: 8 }, ecoulement: { statut: 'reste_notable' } },
    { preparation: { statut: 'sous_preparation', ecart: -5 }, ecoulement: { statut: 'ecoule' } },
    { preparation: { statut: 'sans_recommandation', ecart: null }, ecoulement: { statut: 'sans_donnee' } },
    { preparation: { statut: 'preparation_inconnue', ecart: null }, ecoulement: { statut: 'ecoulement_inconnu' } },
  ];
  const s = M.syntheseAnalysePeriode(lignes);
  assert.strictEqual(s.nbJours, 5);
  assert.strictEqual(s.nbJoursComparables, 3, 'Seuls les 3 jours avec une comparaison valide comptent');
  assert.strictEqual(s.nbConforme, 1);
  assert.strictEqual(s.nbSurPreparation, 1);
  assert.strictEqual(s.nbSousPreparation, 1);
  assert.strictEqual(s.nbResteNotable, 1);
  assert.strictEqual(s.ecartMoyen, (1 + 8 + 5) / 3, 'Moyenne des écarts en valeur absolue, uniquement sur les jours comparables');
});

testSync('syntheseAnalysePeriode : liste vide -> zéros et écart moyen null, jamais une exception', () => {
  const s = M.syntheseAnalysePeriode([]);
  assert.strictEqual(s.nbJours, 0);
  assert.strictEqual(s.nbJoursComparables, 0);
  assert.strictEqual(s.ecartMoyen, null);
});

console.log('\n--- PARTIE 1 (nexus-inventaire-moteur.js) terminée ---\n');

// ------------------------------------------------------------
// PARTIE 2 — nexus-inventaire-production-donnees.js::chargerAnalyseConseillePrepareEcoule
// ------------------------------------------------------------
require(path.join(PROJET, 'nexus-inventaire-production-donnees.js'));
const D = global.NexusInventaireProductionDonnees;
assert.ok(D, 'NexusInventaireProductionDonnees non chargé');
assert.strictEqual(typeof D.chargerAnalyseConseillePrepareEcoule, 'function', 'chargerAnalyseConseillePrepareEcoule doit être exportée');

// Mock chaînable générique : les quart_id sont préfixés par leur date
// ("2026-08-18-matin") pour que le mock puisse retrouver de quel jour il
// s'agit à partir du filtre .in('quart_id', [...]) sans logique dupliquée.
function creerClientAnalyse({ donneesParDate, recommandations }) {
  function dateDepuisQuartIds(ids) {
    return ids && ids.length ? ids[0].slice(0, 10) : null;
  }
  return {
    from(table) {
      const appel = { eq: {} };
      const chain = {
        select() { return chain; },
        eq(k, v) { appel.eq[k] = v; return chain; },
        in(k, v) { appel.in = v; return chain; },
        gte(k, v) { appel.gte = v; return chain; },
        lte(k, v) { appel.lte = v; return chain; },
        order() { return chain; },
        then(resolve, reject) {
          let data = [];
          if (table === 'inventaire_production_recommendations') {
            data = recommandations.filter(r => r.date >= appel.gte && r.date <= appel.lte);
          } else if (table === 'inventaire_quarts') {
            data = (donneesParDate[appel.eq.date] || {}).quarts || [];
          } else if (table === 'inventaire_mouvements') {
            const date = dateDepuisQuartIds(appel.in);
            data = (donneesParDate[date] || {}).mouvements || [];
          } else if (table === 'inventaire_comptages') {
            const date = dateDepuisQuartIds(appel.in);
            data = (donneesParDate[date] || {}).comptages || [];
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

(async function main() {
  await testAsync('chargerAnalyseConseillePrepareEcoule : période de 3 jours, un jour sans inventaire, un jour sans recommandation', async () => {
    const donneesParDate = {
      '2026-08-18': {
        quarts: [{ id: '2026-08-18-matin', quart: 'matin' }, { id: '2026-08-18-soir', quart: 'soir' }],
        mouvements: [{ quart_id: '2026-08-18-matin', type_mouvement: 'production_initiale', quantite: 20, cree_le: '2026-08-18T06:00:00Z' }],
        comptages: [{ quart_id: '2026-08-18-soir', type_comptage: 'cloture', statut: 'valide', quantite: 3, compte_le: '2026-08-18T20:00:00Z' }],
      },
      '2026-08-19': { quarts: [] }, // jour sans inventaire du tout (jour de fermeture)
      '2026-08-20': {
        quarts: [{ id: '2026-08-20-matin', quart: 'matin' }, { id: '2026-08-20-soir', quart: 'soir' }],
        mouvements: [{ quart_id: '2026-08-20-matin', type_mouvement: 'production_initiale', quantite: 15, cree_le: '2026-08-20T06:00:00Z' }],
        comptages: [{ quart_id: '2026-08-20-soir', type_comptage: 'cloture', statut: 'valide', quantite: 2, compte_le: '2026-08-20T20:00:00Z' }],
      },
    };
    // 18/08 : conseillé 18 -> préparé 20 (écart 2, tolérance max(1, 2.7)=2.7 -> conforme).
    // 20/08 : PAS de recommandation ce jour-là -> sans_recommandation.
    const recommandations = [{ date: '2026-08-18', quantite_conseillee: 18 }];
    const client = creerClientAnalyse({ donneesParDate, recommandations });

    const r = await D.chargerAnalyseConseillePrepareEcoule(client, 'vito', 'prodX', '2026-08-18', '2026-08-20');
    assert.strictEqual(r.lignes.length, 3, 'Une ligne par jour de la période, y compris le jour sans inventaire');

    const j18 = r.lignes.find(l => l.date === '2026-08-18');
    assert.strictEqual(j18.conseille, 18);
    assert.strictEqual(j18.prepare, 20);
    assert.strictEqual(j18.preparation.statut, 'conforme');

    const j19 = r.lignes.find(l => l.date === '2026-08-19');
    assert.strictEqual(j19.conseille, null);
    assert.strictEqual(j19.prepare, null, 'Aucun quart ce jour-là -> synthese null -> prepare null, jamais 0 inventé');
    assert.strictEqual(j19.preparation.statut, 'sans_recommandation');

    const j20 = r.lignes.find(l => l.date === '2026-08-20');
    assert.strictEqual(j20.conseille, null, 'Aucune recommandation ce jour précis -> null, même si le produit en a une autre date');
    assert.strictEqual(j20.preparation.statut, 'sans_recommandation');
    assert.strictEqual(j20.prepare, 15, 'Le préparé reste connu même sans recommandation ce jour-là');

    assert.strictEqual(r.synthese.nbJours, 3);
    assert.strictEqual(r.synthese.nbJoursComparables, 1, 'Seul le 18/08 a à la fois un conseillé et un préparé');
    console.log('OK — chargerAnalyseConseillePrepareEcoule assemble conseillé (recommandations) et préparé/écoulé (chargerHistoriqueProductionProduit) jour par jour, sans recalcul (Article 11).');
  });

  await testAsync('chargerAnalyseConseillePrepareEcoule : moteur non chargé -> null proprement, jamais une exception', async () => {
    const sauvegardeMoteur = global.NexusInventaireMoteur;
    delete global.NexusInventaireMoteur;
    try {
      const client = creerClientAnalyse({ donneesParDate: {}, recommandations: [] });
      const r = await D.chargerAnalyseConseillePrepareEcoule(client, 'vito', 'prodX', '2026-08-18', '2026-08-18');
      assert.strictEqual(r, null);
    } finally {
      global.NexusInventaireMoteur = sauvegardeMoteur;
    }
  });

  console.log('\nTous les tests "Production journalière — M8 analyse conseillé/préparé/écoulé" passent.');
})();
