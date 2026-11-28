'use strict';
// A4-1f : carte « Objectifs de marge par famille » (synthèse, filtres, sélection, récapitulatif, états).
// Présentation seulement : les arguments des RPC restent ceux d'A4-1e. Valeurs fictives.
const assert = require('assert'); const fs = require('fs');
const E = require('./nexus-politique-tarifaire-ecran.js');
// A4-1f-bis : la carte est repliée par défaut ; ces épreuves portent sur son corps, donc déplié sauf indication contraire.
const htmlReplie = E.htmlObjectifsFamilles;
E.htmlObjectifsFamilles = (e) => htmlReplie(Object.assign({}, e, { groupe: Object.assign({ ouvert: true }, e && e.groupe) }));
let n = 0;
function t(nom, f) { Promise.resolve().then(f).then(() => { n++; console.log('OK ' + nom); }, e => { console.error('AssertionError: ' + nom + ' : ' + String(e.message).split('\n')[0]); process.exitCode = 1; }); }
const lg = (famille, ca) => ({ famille, ca_ht: ca, article: famille + '1' });
const cib = (f, c, s, m) => ({ niveau: 'famille', cible_niveau: f, cible: c, minimum: m, statut_cible: s || 'indicatif', id: 'o-' + f });
const prop = (f, par) => ({ id: 'p-' + f, niveau: 'famille', cible_niveau: f, cible: 0.3, propose_par: par || 'u1', statut: 'ouverte' });
const base = (o) => Object.assign({ userId: 'u2', analyse: { lignes: [lg('Boissons', 500), lg('Epicerie', 900), lg('Hygiene', 100)] },
  objectifs: [], propositions: [], droitsObjectif: { proposer: true, valider: true }, groupe: {} }, o || {});
const kpi = (h, k) => Number((h.match(new RegExp('data-objf-kpi="' + k + '"[^>]*><span[^>]*>(\\d+)<')) || [])[1]);

t('synthèse : cinq statuts, un indicateur et un point chacun, barre de répartition', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Boissons', 0.25, 'valide'), cib('Epicerie', 0.3, 'hypothese')] }));
  assert.strictEqual(kpi(h, 'valides'), 1); assert.strictEqual(kpi(h, 'hypotheses'), 1); assert.strictEqual(kpi(h, 'sans-cible'), 1); assert.strictEqual(kpi(h, 'indicatives'), 0); assert.strictEqual(kpi(h, 'etude'), 0);
  assert.ok(h.includes('pt-objf-repart'));
});
t('sans cible avec proposition en attente : compté deux fois, sous-ligne dite', () => {
  const h = E.htmlObjectifsFamilles(base({ propositions: [prop('Hygiene')] }));
  assert.strictEqual(kpi(h, 'sans-cible'), 3); assert.ok(h.includes('data-objf-filtre="attente"'));
  assert.ok(h.includes('dont 1 avec une proposition en attente'));
});
t('échelle plancher-cible : 22 % et 68 %', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Epicerie', 0.68, 'indicatif', 0.22)] }));
  assert.ok(h.includes('plancher 22,0 %') && h.includes('cible 68,0 %'));
});
t('tri : CA décroissant, familles sans vente en dernier', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Zeta', 0.3, 'indicatif')] }));
  assert.ok(h.indexOf('Epicerie') < h.indexOf('Boissons') && h.indexOf('Boissons') < h.indexOf('Hygiene') && h.indexOf('Hygiene') < h.indexOf('Zeta'));
  assert.ok(h.includes('sans vente sur la période'));
});
t('boutons rapides : comptes sur toutes les familles', () => {
  const e = base({ objectifs: [cib('Boissons', 0.25, 'indicatif'), cib('Epicerie', 0.3, 'hypothese')] });
  assert.deepStrictEqual(E.selectionRapide(e, 'indicatives'), ['Boissons']);
  assert.deepStrictEqual(E.selectionRapide(e, 'toutes').sort(), ['Boissons', 'Epicerie']);
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('Les indicatives (1)') && h.includes('Toutes les cibles à proposer (2)'));
});
t('barre de sélection absente à zéro, présente avec une sélection', () => {
  const e = base({ objectifs: [cib('Boissons', 0.25, 'indicatif')] });
  assert.ok(!E.htmlObjectifsFamilles(e).includes('data-objf-barre'));
  e.groupe = { selProposer: ['Boissons'] };
  assert.ok(E.htmlObjectifsFamilles(e).includes('data-objf-barre'));
});
t('récapitulatif : « Retirer » par ligne, confirmation obligatoire pour une hypothèse', () => {
  const e = base({ objectifs: [cib('Epicerie', 0.3, 'hypothese')], groupe: { selProposer: ['Epicerie'], confirmer: { mode: 'proposer' } } });
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('data-objf-retirer') && h.includes('data-objf-risque'));
  assert.ok(/data-objf-confirmer[^>]*disabled/.test(h));
  e.groupe.risqueCoche = true;
  assert.ok(!/data-objf-confirmer[^>]*disabled/.test(E.htmlObjectifsFamilles(e)));
});
t('états : squelette, vide, erreur de lecture, réseau, lecture seule', () => {
  assert.ok(E.htmlObjectifsFamilles(base({ objectifsChargement: true })).includes('data-objf-chargement'));
  assert.ok(E.htmlObjectifsFamilles(base({ analyse: { lignes: [] } })).includes('Aucune famille sur la période'));
  assert.ok(E.htmlObjectifsFamilles(base({ objectifsErreur: true })).includes('data-objf-erreur'));
  assert.ok(E.htmlObjectifsFamilles(base({ groupe: { erreurReseau: true } })).includes('data-objf-reseau'));
  const ro = E.htmlObjectifsFamilles(base({ droitsObjectif: {}, objectifs: [cib('Boissons', 0.25, 'indicatif')] }));
  assert.ok(ro.includes('Lecture seule') && !/type="checkbox"/.test(ro));
});
t('préférences : clé site + compte, stockage absent toléré', () => {
  const m = {}; const st = { getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; } };
  assert.strictEqual(E.ecrirePrefsFamilles(st, 'S1', 'u1', { tout: true, repli: false }), true);
  assert.deepStrictEqual(E.lirePrefsFamilles(st, 'S1', 'u1'), { tout: true, repli: false, ouvert: false });
  assert.deepStrictEqual(E.lirePrefsFamilles(st, 'S1', 'u2'), { tout: false, repli: null, ouvert: false });
  assert.deepStrictEqual(E.lirePrefsFamilles(null, 'S1', 'u1'), { tout: false, repli: null, ouvert: false });
  assert.strictEqual(E.ecrirePrefsFamilles(null, 'S1', 'u1', {}), false);
});
t('doublons : proposition plus ouverte ou famille déjà proposée écartée', () => {
  const r = E.filtrerDoublons('proposer', [{ famille: 'A' }, { famille: 'B' }], [{ id: 'x', statut: 'ouverte', niveau: 'famille', cible_niveau: 'A' }]);
  assert.deepStrictEqual(r.gardes.map(x => x.famille), ['B']); assert.strictEqual(r.ecartes.length, 1);
  assert.strictEqual(E.filtrerDoublons('valider', [{ id: 'p1' }], []).ecartes.length, 1);
});
t('arguments des RPC identiques à A4-1e', async () => {
  const appels = [];
  const client = { rpc: async (nom, a) => { appels.push([nom, a]); return { data: 1 }; } };
  await E.envoyerGroupe(client, 'S', 'valider', [{ id: 'p1', libelle: 'A' }]);
  await E.envoyerGroupe(client, 'S', 'proposer', [{ famille: 'Epicerie', cible: 0.3, libelle: 'Epicerie' }]);
  assert.deepStrictEqual(appels[0], ['valider_marge_cible', { p_proposition: 'p1' }]);
  assert.deepStrictEqual(appels[1], ['proposer_marge_cible', { p_site: 'S', p_niveau: 'famille', p_cible_niveau: 'Epicerie', p_cible: 0.3, p_commentaire: null }]);
});
t('surface interdite : pas de nouvelle RPC, calcul inchangé', () => {
  const src = fs.readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  const rpcs = new Set((src.match(/rpc\('([a-z_]+)'/g) || []).map(x => x.slice(5, -1)));
  ['proposer_marge_cible', 'valider_marge_cible'].forEach(r => assert.ok(rpcs.has(r)));
  rpcs.forEach(r => assert.ok(/^(proposer_marge_cible|valider_marge_cible|retirer_marge_cible|objectif_habilite|[a-z_]+)$/.test(r)));
});
t('page : pin du script d\'écran, classes sous .vue-p1c, ancien style intact', () => {
  const h = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
  assert.ok(/nexus-politique-tarifaire-ecran\.js\?v=[0-9a-zA-Z-]+/.test(h));
  const src = fs.readFileSync(__dirname + '/nexus-politique-tarifaire-ecran.js', 'utf8');
  (src.match(/CSS \+= '\.[^']*pt-objf-[^']*'/g) || []).forEach(l => assert.ok(/CSS \+= '(\.vue-p1c |@)/.test(l) || /^CSS \+= '@/.test(l), l.slice(0, 60)));
});
process.on('exit', () => console.log(n + ' tests'));

t('cinq statuts : un badge et une pastille chacun, pas de cadenas hors validée', () => {
  const e = base({ analyse: { lignes: ['A', 'B', 'C', 'D', 'E'].map(f => lg(f, 100)) }, objectifs: [cib('A', 0.2, 'valide'), cib('B', 0.2, 'indicatif'), cib('C', 0.2, 'a_l_etude'), cib('D', 0.2, 'hypothese')] });
  const h = E.htmlObjectifsFamilles(e);
  ['valide', 'indicatif', 'etude', 'hypothese', 'non_defini'].forEach(k => assert.ok(h.includes('pt-objf-badge pt-objf-st-' + k), k));
  assert.strictEqual((h.match(/En vigueur/g) || []).length, 1);
  assert.strictEqual(E.cleStatut({ ligne: null }), 'non_defini');
});
t('compteFiltres : effectif par pastille', () => {
  const c = E.compteFiltres(base({ objectifs: [cib('Boissons', 0.25, 'valide'), cib('Epicerie', 0.3, 'hypothese')], propositions: [prop('Hygiene')] }));
  assert.strictEqual(c.tous, 3); assert.strictEqual(c.valide, 1); assert.strictEqual(c.hypothese, 1); assert.strictEqual(c.sans_cible, 1); assert.strictEqual(c.attente, 1);
});
t('échelle commune : mêmes bornes pour toutes les familles', () => {
  const b = E.bornesEchelle(base({ objectifs: [cib('Epicerie', 0.68, 'indicatif', 0.22), cib('Boissons', 0.3, 'indicatif', 0.1)] }));
  assert.ok(b && b.lo <= 10 && b.hi >= 68);
});
t('barre de sélection : famille hors de la vue comptée', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Boissons', 0.25), cib('Epicerie', 0.3)], groupe: { selProposer: ['Boissons', 'Epicerie'], recherche: 'Boiss' } }));
  assert.ok(h.includes('dont 1 hors de la vue') && h.includes('data-objf-vider'));
});
t('mobile : cartes sans tableau sous 900 px, tableau au-delà', () => {
  const e = base({ objectifs: [cib('Boissons', 0.25)] });
  assert.ok(E.enModeCartes(Object.assign({}, e, { largeur: 375 })));
  const m = E.htmlObjectifsFamilles(Object.assign({}, e, { largeur: 375 })), d = E.htmlObjectifsFamilles(Object.assign({}, e, { largeur: 1280 }));
  assert.ok(!m.includes('<table') && m.includes('data-objf-cartes'));
  assert.ok(d.includes('<table'));
});
t('charte : aucun --t-red dans la feuille', () => {
  assert.ok(!fs.readFileSync('./nexus-politique-tarifaire-ecran.js', 'utf8').includes('--t-red'));
});
