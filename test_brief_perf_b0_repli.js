// B0-perf : le repli carburant rejoué en parallèle retient le MÊME jour que
// l'ancienne boucle série (premier candidat complet DANS L'ORDRE de la liste,
// jamais le premier à répondre), et fait moins d'attente.
const assert = require('assert');
const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-boussole-moteur.js'));
require(path.join(__dirname, 'nexus-carburant-moteur.js'));
require(path.join(__dirname, 'nexus-periodes.js'));
require('./outils/fuseau-metier-pour-tests.js').installerAvecFuseau('America/Martinique');
require(path.join(__dirname, 'nexus-brief-donnees.js'));
const M = global.NexusCarburantMoteur, BD = global.NexusBriefDonnees, P = global.NexusPeriodes;

const OK3 = { go: { statut: 'Sous contrôle' }, sp95: { statut: 'Sous contrôle' }, gnr: { statut: 'Sous contrôle' } };
const KO3 = { go: { statut: 'Données insuffisantes' }, sp95: { statut: 'Données insuffisantes' }, gnr: { statut: 'Données insuffisantes' } };
const CLIENT = { from() { const c = { select: () => c, eq: () => c, insert: () => c, maybeSingle: async () => ({ data: null, error: null }) }; return c; } };
const AUJ = '2026-08-27';
const jour = n => P.ajouterJours(AUJ, -n);

// complets: ensemble de décalages (en jours avant AUJ) réellement complets au rejeu.
function installer(complets, delaiParDecalage) {
  const appeles = [];
  const historique = [];
  for (let n = 1; n <= 12; n++) historique.push({ date: jour(n), parCarburant: OK3 });   // l'historique approximatif juge tout complet
  global.NexusCarburantDonnees = {
    chargerControleJour: async (c, s, date) => {
      if (date === AUJ) return { aucunReleve: true, parCarburant: null };
      const n = [...Array(13).keys()].find(k => jour(k) === date);
      appeles.push(n);
      await new Promise(r => setTimeout(r, (delaiParDecalage && delaiParDecalage[n]) || 1));
      return complets.includes(n) ? { aucunReleve: false, parCarburant: OK3 } : { aucunReleve: false, parCarburant: KO3 };
    },
    chargerVentesPeriode: async () => ({ ventes: { go: 1, sp95: 1, gnr: 1 }, nbQuartsAvecLitrage: 2, nbQuartsTotal: 2 }),
    chargerCuvesConfig: async () => ({ config: null }),
    chargerPrixCarburantsCourant: async () => null,
    chargerLivraisonsCouteesCarburant: async () => [],
    chargerHistoriqueReleves: async () => historique,
  };
  return { appeles, historique };
}

// Référence : l'ancienne boucle série, rejouée sur les mêmes entrées.
async function referenceSerie(complets, historique) {
  const exclues = [];
  let fb = M.trouverJourFiableAnterieur(historique, AUJ);
  let fr = M.fraicheurCarburant({ completAujourdhui: false, fallback: fb });
  while (fr.mode === 'fallback') {
    const n = [...Array(13).keys()].find(k => jour(k) === fr.dateReference);
    if (complets.includes(n)) return fr;
    exclues.push(fr.dateReference);
    fb = M.trouverJourFiableAnterieur(historique, AUJ, exclues);
    fr = M.fraicheurCarburant({ completAujourdhui: false, fallback: fb });
  }
  return fr;
}

(async () => {
  let n = 0;
  const cas = [
    { nom: 'premier candidat complet', complets: [1] },
    { nom: 'quatrième candidat complet', complets: [4] },
    { nom: 'deux complets (3 et 5) : le plus proche gagne même si 5 répond avant', complets: [3, 5], delais: { 3: 40, 5: 1 } },
    { nom: 'sixième, au-delà du premier lot', complets: [7] },
    { nom: 'aucun complet', complets: [] },
  ];
  for (const c of cas) {
    const { appeles, historique } = installer(c.complets, c.delais);
    const attendu = await referenceSerie(c.complets, historique);
    const r = await BD.chargerCarburantsBriefAvecFallback(CLIENT, 's', AUJ);
    assert.strictEqual(r.fraicheur.mode, attendu.mode, c.nom + ' : mode');
    assert.strictEqual(r.fraicheur.dateReference, attendu.dateReference, c.nom + ' : date');
    assert.strictEqual(JSON.stringify(r.fraicheur), JSON.stringify(attendu), c.nom + ' : fraîcheur identique');
    assert.strictEqual(appeles[0], 1, c.nom + ' : le premier rejeu est le candidat le plus proche, seul');
    n++;
  }
  console.log(n + ' ok');
})().catch(e => { console.error(e); process.exit(1); });
