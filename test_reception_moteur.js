// Tests rapides du moteur Réceptions (14/08/2026) — Node pur, sans jsdom.
const assert = require('assert');
global.window = undefined;
const M = require('./nexus-reception-moteur.js').NexusReceptionMoteur || (() => {
  // Le fichier attache à `window` si présent, sinon à globalThis.
  require('./nexus-reception-moteur.js');
  return global.NexusReceptionMoteur;
})();
const Mod = global.NexusReceptionMoteur;

// 1) Delta mesure — null si un jaugeage manque.
assert.strictEqual(Mod.calculerDeltaMesure(null, 12000), null);
assert.strictEqual(Mod.calculerDeltaMesure(2000, null), null);
assert.strictEqual(Mod.calculerDeltaMesure(2000, 12000), 10000);

// 2) Réception corrigée — null tant que ventes pendant livraison inconnues (P1).
assert.strictEqual(Mod.calculerReceptionCorrigee(10000, null), null);
assert.strictEqual(Mod.calculerReceptionCorrigee(10000, 50), 10050);

// 3) Écart terrain/BL — utilise reception corrigée si dispo, sinon delta brut.
assert.strictEqual(Mod.calculerEcartTerrainBl(10000, 10000, null), 0);
assert.strictEqual(Mod.calculerEcartTerrainBl(10000, 10000, 10050), 50);
assert.strictEqual(Mod.calculerEcartTerrainBl(null, 10000, null), null);

// 4) Ratio — pas de division par zéro / BL manquant.
assert.strictEqual(Mod.calculerEcartRatio(50, 10000), 0.005);
assert.strictEqual(Mod.calculerEcartRatio(50, 0), null);
assert.strictEqual(Mod.calculerEcartRatio(50, null), null);

// 5) Statut initial — jamais 'anomalie_confirmee', jamais fabriqué sans données.
assert.strictEqual(Mod.statutInitialReception({ jaugeageApresL: null, quantiteBlL: 10000 }), 'a_completer');
assert.strictEqual(Mod.statutInitialReception({ jaugeageApresL: 12000, quantiteBlL: null }), 'a_completer');
assert.strictEqual(Mod.statutInitialReception({ jaugeageApresL: 12000, quantiteBlL: 10000, ecartRatioTerrainBl: 0.01 }), 'coherente');
assert.strictEqual(Mod.statutInitialReception({ jaugeageApresL: 12000, quantiteBlL: 10000, ecartRatioTerrainBl: 0.05 }), 'a_rapprocher');
assert.strictEqual(Mod.statutInitialReception({ jaugeageApresL: 12000, quantiteBlL: 10000, ecartRatioTerrainBl: -0.05 }), 'a_rapprocher');

// 6) calculerReception — assemblage complet, cas nominal cohérent.
const r1 = Mod.calculerReception({ jaugeageAvantL: 2000, jaugeageApresL: 12050, quantiteBlL: 10000, quantiteSystemeL: null, ventesPendantLivraisonL: null });
assert.strictEqual(r1.deltaMesureL, 10050);
assert.strictEqual(r1.receptionCorrigeeL, null); // ventes pendant livraison non calculées en P1
assert.strictEqual(r1.ecartTerrainBl, 50);
assert.strictEqual(r1.statut, 'coherente');
assert.strictEqual(r1.ecartSystemeBl, null);

// 7) calculerReception — écart significatif → a_rapprocher, jamais anomalie_confirmee.
const r2 = Mod.calculerReception({ jaugeageAvantL: 2000, jaugeageApresL: 11000, quantiteBlL: 10000, quantiteSystemeL: null, ventesPendantLivraisonL: null });
assert.strictEqual(r2.ecartTerrainBl, -1000);
assert.strictEqual(r2.ecartRatioTerrainBl, -0.1);
assert.strictEqual(r2.statut, 'a_rapprocher');
assert.notStrictEqual(r2.statut, 'anomalie_confirmee');

// 8) Écart système/BL — cohérent une fois renseigné.
const r3 = Mod.calculerReception({ jaugeageAvantL: 2000, jaugeageApresL: 12000, quantiteBlL: 10000, quantiteSystemeL: 9980, ventesPendantLivraisonL: null });
assert.strictEqual(r3.ecartSystemeBl, -20);
assert.ok(Math.abs(r3.ecartRatioSystemeBl - (-0.002)) < 1e-9);

// 9) Chronologie.
const c1 = Mod.chronologieValide({ heureDebut: '2026-08-14T08:00:00Z', heureFin: '2026-08-14T08:30:00Z', jaugeageAvantLe: '2026-08-14T08:02:00Z', jaugeageApresLe: '2026-08-14T08:35:00Z' });
assert.strictEqual(c1.valide, true);
const c2 = Mod.chronologieValide({ heureDebut: '2026-08-14T08:00:00Z', heureFin: '2026-08-14T08:30:00Z', jaugeageAvantLe: '2026-08-14T09:00:00Z', jaugeageApresLe: '2026-08-14T08:35:00Z' });
assert.strictEqual(c2.valide, false);
assert.ok(c2.erreurs.length >= 1);

// 10) Libellés / texte écart.
assert.strictEqual(Mod.libelleStatutReception('coherente').niveau, 'ok');
assert.strictEqual(Mod.libelleStatutReception('a_rapprocher').niveau, 'attention');
assert.strictEqual(Mod.libelleStatutReception('anomalie_confirmee').niveau, 'alerte');
assert.strictEqual(Mod.libelleStatutReception('a_completer').niveau, 'attente');
assert.strictEqual(Mod.texteEcart(null, null), 'non calculable');
assert.strictEqual(Mod.texteEcart(50, 0.005), '+50 L (0.5 % du BL)');

console.log('TOUS LES TESTS PASSENT —', Object.keys(Mod).length, 'exports vérifiés.');
