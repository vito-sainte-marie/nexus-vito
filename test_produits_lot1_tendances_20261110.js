// Lot 1 Produits, PR B — règle commune des tendances (NexusPeriodes).
// R1 ventes moyennes par jour ; R2 fraîcheur 21 jours (fuseau station) ; R3 plancher de volume.
const assert = require('assert');
global.window = global;
require(__dirname + '/nexus-periodes.js');
require(__dirname + '/nexus-conseiller.js');
const P = global.NexusPeriodes, C = global.NexusConseiller;
let n = 0; const t = (nom, f) => { f(); n++; console.log('✓ ' + nom); };

const paire = { precedente: { debut: '2026-09-23', fin: '2026-10-06', duree: 14 }, actuelle: { debut: '2026-10-07', fin: '2026-10-23', duree: 17 } };
const paire20 = { precedente: paire.precedente, actuelle: { debut: '2026-10-07', fin: '2026-10-20', duree: 14 } };

t('R1 : brut +21 % (14 j vs 17 j) mais moyenne par jour ≈ 0 %', () => {
  // même rythme : 1400 € sur 14 j = 100/j ; 1700 € sur 17 j = 100/j
  assert.ok(Math.abs(P.evolutionVentesMoyennes(1700, 17, 1400, 14)) < 1e-9);
  assert.ok(Math.abs((1700 - 1400) / 1400 - 0.2143) < 1e-3); // l'ancienne formule inventait +21 %
  assert.ok(Math.abs(P.evolutionVentesMoyennes(1190, 17, 1400, 14) - (-0.3)) < 1e-9); // baisse masquée par l'ancienne formule
  assert.strictEqual(P.evolutionVentesMoyennes(10, 14, 0, 14), null);
  assert.strictEqual(P.evolutionVentesMoyennes(10, 0, 5, 14), null);
});

t('R2 : J+21 admis, J+22 refusé', () => {
  assert.strictEqual(P.agePaireJours(paire20, '2026-11-10'), 21);
  assert.strictEqual(P.paireFraiche(paire20, { dateDuJour: '2026-11-10' }), true);
  assert.strictEqual(P.paireFraiche(paire20, { dateDuJour: '2026-11-11' }), false);
  assert.strictEqual(P.FRAICHEUR_MAX_JOURS, 21);
});

t('R2 : minuit Martinique (déjà demain en UTC)', () => {
  const instant = new Date('2026-11-11T02:00:00Z'); // 22 h le 10/11 à Martinique, 11/11 en UTC
  assert.strictEqual(P.dateDuJourStation(instant, 'America/Martinique'), '2026-11-10');
  assert.strictEqual(P.dateDuJourStation(instant, 'UTC'), '2026-11-11');
  assert.strictEqual(P.paireFraiche(paire20, { instant, fuseau: 'America/Martinique' }), true);
  assert.strictEqual(P.paireFraiche(paire20, { instant, fuseau: 'UTC' }), false);
});

const opt = { dateDuJour: '2026-10-25' };
const art = (caT1, qT1, caT2, qT2) => P.tendanceArticle({ caT1, quantiteT1: qT1, caT2, quantiteT2: qT2 }, paire, opt);

t('R3 : 0,50 € × 12 = 6 € qualifié par les unités', () => { assert.strictEqual(art(6, 12, 3, 6).statut, 'qualifiee'); });
t('R3 : 30 € × 2 = 60 € qualifié par le CA', () => { assert.strictEqual(art(60, 2, 30, 1).statut, 'qualifiee'); });
t('R3 : 1 € × 4 non qualifié, message neutre, jamais une baisse', () => {
  const r = art(4, 4, 0, 0);
  assert.strictEqual(r.statut, 'insuffisante');
  assert.strictEqual(r.evolutionCA, null);
  assert.strictEqual(r.message, 'Ventes insuffisantes pour établir une tendance fiable');
});
t('R3 : plancher ramené à la durée réelle de T1', () => {
  assert.strictEqual(P.volumeSuffisant(25, 4, 7), true);   // 25 ≥ 50×7/14
  assert.strictEqual(P.volumeSuffisant(24, 4, 7), false);
});
t('paire périmée : aucune tendance', () => {
  const r = P.tendanceArticle({ caT1: 100, quantiteT1: 20, caT2: 10, quantiteT2: 2 }, paire, { dateDuJour: '2026-12-31' });
  assert.strictEqual(r.statut, 'perimee');
  assert.strictEqual(r.evolutionCA, null);
});

t('Conseiller : article en baisse brute masquée / hausse artificielle', () => {
  const rowsPrec = [{ categorie: 'X', article: 'Hausse artificielle', ca: 1400, quantite: 100 }, { categorie: 'X', article: 'Baisse masquée', ca: 1400, quantite: 100 }];
  const rowsAct = [{ categorie: 'X', article: 'Hausse artificielle', ca: 1700, quantite: 120 }, { categorie: 'X', article: 'Baisse masquée', ca: 1190, quantite: 85 }];
  const r = C.analyserEvolutionsPaire(rowsAct, rowsPrec, { paire, dateDuJour: '2026-10-25' });
  assert.ok(!r.meilleurSucces, 'la hausse brute de +21 % n\'est plus une réussite (≈ 0 %/jour)');
  assert.ok(r.produitsEnBaisse.some(p => p.article === 'Baisse masquée'), 'la baisse à -30 %/jour est révélée');
  const perimee = C.analyserEvolutionsPaire(rowsAct, rowsPrec, { paire, dateDuJour: '2026-12-31' });
  assert.ok(!perimee.meilleurSucces && perimee.produitsEnBaisse.length === 0);
  const sansPaire = C.analyserEvolutionsPaire(rowsAct, rowsPrec, {});
  assert.ok(!sansPaire.meilleurSucces && sansPaire.produitsEnBaisse.length === 0);
});

t('seuils et messages du Conseiller inchangés', () => {
  assert.strictEqual(C.SEUIL_HAUSSE, 0.20);
  assert.strictEqual(C.SEUIL_BAISSE, -0.30);
  assert.strictEqual(C.SEUIL_VOLUME_CA_EUR, 50);
});

console.log(n + ' tests OK');
