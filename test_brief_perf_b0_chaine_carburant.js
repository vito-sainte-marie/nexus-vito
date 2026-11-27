// B0-perf-2 : la chaîne carburant parallélisée donne EXACTEMENT les valeurs de
// la version séquentielle, et le tri des « principales concentrations » est
// indépendant de l'ordre d'arrivée des lignes.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let ok = 0;
function t(nom, f) { return Promise.resolve().then(f).then(() => { ok++; }, e => { console.error('ECHEC', nom, e.message); process.exitCode = 1; }); }
function charger(fichiers, extra) {
  const g = Object.assign({ console }, extra || {}); g.window = g; g.self = g;
  vm.createContext(g);
  fichiers.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), g, { filename: f }));
  return g;
}

(async () => {
  const M = charger(['nexus-carburant-moteur.js']).NexusCarburantMoteur;
  const LIV = {
    go:   [{ litres: 1000, cout: 1.10 }, { litres: 2000, cout: 1.20 }],
    sp95: [{ litres: 500, cout: 1.40 }],
    gnr:  [{ litres: 800, cout: 0.95 }],
  };
  const journal = [];
  const D = {
    chargerControleJour: async () => ({ parCarburant: { go: { stockPhysiqueAffiche: 5000 }, sp95: { stockPhysiqueAffiche: 3000 }, gnr: { stockPhysiqueAffiche: 1000 } } }),
    chargerVentesPeriode: async () => ({ ventes: { go: 100, sp95: 50, gnr: 10 } }),
    chargerCuvesConfig: async () => ({ config: { gnr: { actif: false } } }),
    chargerPrixCarburantsCourant: async () => ({ go: 1.8, sp95: 1.95, gnr: 1.2 }),
    chargerLivraisonsCouteesCarburant: async (c, s, cle, lim) => { journal.push([cle, lim]); return LIV[cle]; },
  };
  // Version de référence : l'enchaînement séquentiel d'origine, recopié.
  async function sequentiel() {
    const controle = await D.chargerControleJour();
    const cuvesConfig = await D.chargerCuvesConfig();
    const clesActives = M.CLES_CARBURANT.filter(cle => !cuvesConfig.config || !cuvesConfig.config[cle] || cuvesConfig.config[cle].actif);
    const prixVente = await D.chargerPrixCarburantsCourant();
    const effets = {};
    await Promise.all(clesActives.map(async cle => {
      const livraisons = await D.chargerLivraisonsCouteesCarburant(null, 's', cle, 60);
      const cmp = M.calculerCmpProgressif(livraisons);
      effets[cle] = M.calculerEffetPrixStockHerite({ cmp: cmp.cmp, coutRemplacementActuel: cmp.coutRemplacementActuel, prixVenteDuMois: prixVente ? prixVente[cle] : null, stockPhysiqueActuelL: controle.parCarburant[cle].stockPhysiqueAffiche });
    }));
    return M.resumerEffetPrixCarburants(effets);
  }
  const g = charger(['nexus-brief-donnees.js'], {
    NexusCarburantMoteur: M, NexusCarburantDonnees: D,
    nexusDecalerJour: (j) => j, nexusAujourdhui: () => '2026-11-26',
  });
  const B = g.NexusBriefDonnees;
  await t('chargerCarburantsBrief : effetPrixResume identique au séquentiel', async () => {
    journal.length = 0;
    const attendu = await sequentiel();
    journal.length = 0;
    const r = await B.chargerCarburantsBrief(null, 's', '2026-11-26', 'Europe/Paris');
    assert.strictEqual(JSON.stringify(r.effetPrixResume), JSON.stringify(attendu));
    assert.deepStrictEqual(journal.map(x => x[0]).sort(), ['go', 'sp95']);   // gnr inactif : pas de requête
    assert.ok(journal.every(x => x[1] === 60));
  });

  // Tri déterministe des concentrations de marge.
  const S = charger(['nexus-risques-moteur.js', 'nexus-secteurs-moteur.js']).NexusSecteursMoteur;
  if (S && S.construireSyntheseFreinMarge) {
    await t('top 3 identique quel que soit l\'ordre d\'arrivée', async () => {
      const mk = (c, n) => ({ categorie: c, niveau: n });
      const base = [mk('Boissons', 'exposition'), mk('Alimentaire', 'exposition'), mk('Tabac', 'exposition'), mk('Confiserie', 'exposition'), mk('Epicerie', 'risque_avere')];
      const lire = (arr) => JSON.stringify(S.construireSyntheseFreinMarge(3, arr));
      const a = lire(base), b = lire(base.slice().reverse()), c = lire([base[2], base[0], base[4], base[3], base[1]]);
      assert.ok(/Epicerie/.test(a), 'le signal de rang supérieur est cité : ' + a);
      assert.ok(/Alimentaire/.test(a) && /Boissons/.test(a) && !/Tabac/.test(a), 'égalités départagées par le nom : ' + a);
      assert.strictEqual(a, b); assert.strictEqual(a, c);
    });
  }
  console.log(ok + ' ok');
})();
