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

// ---- Arbitrage du 10/11/2026 : appariement des deux dernières périodes, continuité, rapport de durées ----
const mk = (d1, f1, d2, f2) => ({ precedente: { debut: d1, fin: f1, duree: P.joursEntre(d1, f1) }, actuelle: { debut: d2, fin: f2, duree: P.joursEntre(d2, f2) } });
const gros = { caT1: 1000, quantiteT1: 100, caT2: 1200, quantiteT2: 120 };
const OPT = { dateDuJour: '2026-11-05' };
const evalPaire = (p, o) => P.tendanceArticle(gros, p, o || OPT);

t('appariement « dernieres » : avant-dernière période contre dernière, sans écart de durée', () => {
  const rows = [
    { periode_debut: '2026-08-01', periode_fin: '2026-08-31', article: 'A', ca: 1 },
    { periode_debut: '2026-09-05', periode_fin: '2026-09-20', article: 'A', ca: 1 },
    { periode_debut: '2026-09-21', periode_fin: '2026-10-26', article: 'A', ca: 1 },
  ];
  const r = P.analyserPeriodes(rows, { appariement: 'dernieres' });
  assert.strictEqual(r.paire.precedente.debut, '2026-09-05');
  assert.strictEqual(r.paire.actuelle.debut, '2026-09-21');
});

t('rapport de durées : exactement 2 non signalé, 2,01 signalé', () => {
  assert.strictEqual(P.RAPPORT_DUREES_MAX, 2);
  const exact = evalPaire(mk('2026-10-01', '2026-10-10', '2026-10-11', '2026-10-30')); // 10 j / 20 j
  assert.strictEqual(exact.rapport_durees, 2);
  assert.strictEqual(exact.fiable, true);
  const au_dessus = P.qualiteComparaison(mk('2026-10-01', '2026-10-10', '2026-10-11', '2026-10-31'), OPT); // 10 j / 21 j
  assert.ok(au_dessus.rapport_durees > 2);
  assert.ok(au_dessus.avertissements.includes('Comparaison à interpréter avec prudence'));
});

t('16 j contre 36 j = 2,25 : évolution affichée, avertissement, aucune recommandation', () => {
  const r = evalPaire(mk('2026-09-05', '2026-09-20', '2026-09-21', '2026-10-26'));
  assert.strictEqual(r.statut, 'qualifiee');
  assert.ok(r.evolutionCA !== null, 'l\'évolution reste disponible');
  assert.strictEqual(r.rapport_durees, 36 / 16);
  assert.strictEqual(r.fiable, false);
  assert.strictEqual(r.recommandable, false);
  assert.ok(r.avertissements.includes('Comparaison à interpréter avec prudence'));
  assert.strictEqual(r.libelle_evolution, 'ventes moyennes par jour');
  assert.strictEqual(r.periodes.t1.duree, 16);
  assert.strictEqual(r.periodes.t2.duree, 36);
  assert.strictEqual(r.periodes.t1.ca, 1000);
});

t('période en cours : comparaison non fiable', () => {
  const r = evalPaire(mk('2026-10-01', '2026-10-14', '2026-10-15', '2026-11-30'), { dateDuJour: '2026-11-30' });
  assert.ok(P.qualiteComparaison(mk('2026-10-01', '2026-10-14', '2026-10-15', '2026-11-30'), { dateDuJour: '2026-11-30' }).partielle);
  assert.strictEqual(r.recommandable, false);
});

t('jours non couverts : listés avec leurs dates, jamais comblés', () => {
  const p = mk('2026-10-01', '2026-10-10', '2026-10-13', '2026-10-22');
  const r = evalPaire(p);
  assert.strictEqual(r.continuite.ok, false);
  assert.deepStrictEqual(r.continuite.jours_non_couverts, ['2026-10-11', '2026-10-12']);
  assert.strictEqual(r.recommandable, false);
  assert.ok(r.avertissements.some(a => a.includes('2026-10-11') && a.includes('2026-10-12')));
  assert.strictEqual(r.periodes.t1.duree, 10); // durées réelles, aucun jour ajouté
});

t('chevauchement : signalé, non fiable', () => {
  const r = evalPaire(mk('2026-10-01', '2026-10-10', '2026-10-09', '2026-10-18'));
  assert.deepStrictEqual(r.continuite.chevauchement, ['2026-10-09', '2026-10-10']);
  assert.strictEqual(r.recommandable, false);
});

t('périodes contiguës de durées proches : recommandable', () => {
  const r = evalPaire(mk('2026-10-01', '2026-10-14', '2026-10-15', '2026-10-28'));
  assert.deepStrictEqual(r.continuite, { ok: true, jours_non_couverts: [], chevauchement: [] });
  assert.strictEqual(r.fiable, true);
  assert.strictEqual(r.recommandable, true);
});

t('plancher et fraîcheur : traitement inchangé, jamais recommandable', () => {
  const ok = mk('2026-10-01', '2026-10-14', '2026-10-15', '2026-10-28');
  const faible = P.tendanceArticle({ caT1: 4, quantiteT1: 4, caT2: 0, quantiteT2: 0 }, ok, OPT);
  assert.strictEqual(faible.statut, 'insuffisante'); assert.strictEqual(faible.recommandable, false);
  const vieux = P.tendanceArticle(gros, ok, { dateDuJour: '2027-02-01' });
  assert.strictEqual(vieux.statut, 'perimee'); assert.strictEqual(vieux.recommandable, false);
});

// ---- Neutralisation module par module (Conseiller) ----
const rowsT1 = [{ categorie: 'X', article: 'Monte', ca: 1000, quantite: 100 }, { categorie: 'X', article: 'Chute', ca: 1000, quantite: 100 }];
const rowsT2 = [{ categorie: 'X', article: 'Monte', ca: 3000, quantite: 300 }, { categorie: 'X', article: 'Chute', ca: 300, quantite: 30 }];
const brut = (pn, d, f) => rowsT1.map(r => ({ ...r, periode_debut: pn.precedente.debut, periode_fin: pn.precedente.fin }))
  .concat(rowsT2.map(r => ({ ...r, periode_debut: pn.actuelle.debut, periode_fin: pn.actuelle.fin })));
const peu = mk('2026-09-05', '2026-09-20', '2026-09-21', '2026-10-26');   // 16 j / 36 j
const bon = mk('2026-09-23', '2026-10-06', '2026-10-07', '2026-10-20');   // 14 j / 14 j
const cartes = (pn) => C.calculerCandidatsProduits(brut(pn), { dateDuJour: '2026-10-25' });
const regles = (r) => (r.candidats || r || []).map(c => c.rule_id);

t('Conseiller : R3-HAUSSE et R2-BAISSE absentes si comparaison non fiable, présentes sinon', () => {
  const off = regles(cartes(peu)), on = regles(cartes(bon));
  assert.ok(!off.includes('R3-HAUSSE') && !off.includes('R2-BAISSE'));
  assert.ok(on.includes('R3-HAUSSE') && on.includes('R2-BAISSE'));
});

t('Conseiller : succès à féliciter et baisses neutralisés si non fiable', () => {
  const off = C.analyserEvolutionsPaire(rowsT2, rowsT1, { paire: peu, dateDuJour: '2026-10-25' });
  assert.ok(!off.meilleurSucces && off.produitsEnBaisse.length === 0);
  const on = C.analyserEvolutionsPaire(rowsT2, rowsT1, { paire: bon, dateDuJour: '2026-10-25' });
  assert.ok(on.meilleurSucces && on.meilleurSucces.article === 'Monte');
  assert.ok(on.produitsEnBaisse.some(p => p.article === 'Chute'));
});

t('Conseiller : listes progression/régression des produits stratégiques neutralisées si non fiable', () => {
  const off = C.analyserProduitsStrategiques(rowsT2, rowsT1, { paire: peu, dateDuJour: '2026-10-25' });
  const flat = (r) => [].concat(...Object.values(r || {}).filter(Array.isArray));
  assert.strictEqual(flat(off).length, 0);
  const on = C.analyserProduitsStrategiques(rowsT2, rowsT1, { paire: bon, dateDuJour: '2026-10-25' });
  assert.ok(on.progressionVolume.some(p => p.article === 'Monte'), 'cas fiable : la progression est bien listée');
});

console.log(n + ' tests OK');

// ---- Fiche Produits : échappement des avertissements, durées et CA totaux (relecture Guardian 6781315761) ----
t('fiche : avertissements échappés, durées et CA total de chaque période affichés', () => {
  const fs = require('fs');
  const page = fs.readFileSync(require('path').join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  assert.ok(page.includes("tend.avertissements.map(esc).join(' · ')"), 'avertissements non échappés');
  assert.ok(!page.includes('tend.avertissements.map(a => a)'), 'insertion brute des avertissements');
  assert.ok(/periodesTendance/.test(page) && /\$\{esc\(t\.duree\)\} j\) : CA \$\{fmtEur\(t\.ca/.test(page), 'durée et CA total de chaque période absents');
});

// ---- Statut « Tendance à confirmer », histogramme en moyennes par jour (recette Guardian 6781594883, arbitrage 6781622583) ----
{
  const fs = require('fs'), path = require('path');
  const page = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
  const m = fs.readFileSync(path.join(__dirname, 'test_produits_refonte_phase1_20261110.js'), 'utf8').match(/function extraire[\s\S]*?\n}\n/);
  eval(m[0].replace('function extraire', 'global.extraire=function'));
  global.esc = s => String(s);
  const statut = new Function('NexusConseiller', 'esc', 'AUJOURDHUI_STATION', extraire(page, 'function calculerStatutSimplifie') + '; return calculerStatutSimplifie;')(C, global.esc, '2026-11-10');
  const base = { article: 'X', categorie: C.LANGAGE_ACTION ? Object.keys({}).concat('Boissons')[0] : 'Boissons', ca_t2: 100, pct_contrib: 0 };
  const tend = (statut, recommandable, evolutionCA) => ({ statut, recommandable, evolutionCA });
  const ATTENDU = "Pas de recommandation tant que la comparaison n'est pas fiable. Les chiffres ci-dessus restent consultables.";
  for (const [nom, td] of [
    ['prudence en baisse', tend('qualifiee', false, -0.778)],
    ['prudence en hausse', tend('qualifiee', false, 0.9)],
    ['ventes insuffisantes', tend('insuffisante', false, null)],
    ['périmée', tend('perimee', false, null)],
    ['indisponible', tend('indisponible', false, null)],
  ]) t('statut : ' + nom + ' → « Tendance à confirmer », neutre, sans réassort', () => {
    const r = statut({ ...base, tendance: td });
    assert.strictEqual(r.label, 'Tendance à confirmer');
    assert.strictEqual(r.cle, 'a-confirmer');
    assert.strictEqual(r.action, ATTENDU);
  });
  t('statut : aucune vente et stratégique ne dépendent pas de la tendance', () => {
    assert.strictEqual(statut({ ...base, ca_t2: 0, tendance: tend('perimee', false, null) }).cle, 'aucune-vente');
    assert.strictEqual(statut({ ...base, pct_contrib: 1, tendance: tend('perimee', false, null) }).cle, 'strategique');
  });
  t('statut : sans période précédente (tendance absente), comportement conservé', () => {
    assert.strictEqual(statut({ ...base, tendance: null }).cle, 'sans-signal'); // « Produit performant » a disparu (lot 2)
  });
  t('statut : tendance recommandable, baisse nette → à surveiller (inchangé)', () => {
    assert.strictEqual(statut({ ...base, tendance: tend('qualifiee', true, -0.5) }).cle, 'surveiller');
  });
  t('fiche : histogramme en unités moyennes par jour, une seule ligne de dates', () => {
    assert.ok(/quantite_moyenne_jour/.test(page) && /u\.\/j \(\$\{esc\(t\.quantite\)\} u\. sur \$\{esc\(t\.duree\)\} j\)/.test(page), 'barres en moyennes par jour absentes');
    assert.ok(!page.includes('p.qte_t1/maxQte') && !page.includes('p.qte_t2_pair/maxQte'), 'barres encore en totaux bruts');
    assert.ok(!page.includes('T1 : ${esc(p.pairDates.debutT1)}'), 'ancienne ligne de dates conservée');
  });
  console.log(n + ' tests OK (avec statut et histogramme)');
}
