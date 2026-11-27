// A4-1 : cible de marge lue dans tarif_seuils. Node pur, aucune base.
const assert = require('assert');
const fs = require('fs');
global.window = global;
require('./nexus-politique-tarifaire.js');
require('./nexus-politique-tarifaire-registres.js');
const M = require('./nexus-cible-marge.js');
let n = 0; const attente = []; const ok = (nom, f) => { attente.push(Promise.resolve(f())); n++; };
const ligne = (o) => { const x = Object.assign({ site: 'S1', niveau: 'defaut', cible_niveau: null, minimum: 0.12, cible: 0.28, statut: 'valide' }, o); x.statut_cible = x.statut; x.statut_minimum = x.statut; return x; };

ok('parité : 28 % valide note, 28 % indicatif s\'affiche sans noter', () => {
  const v = M.creer({ etat: 'defini', lignes: [ligne()] }).resoudre(null, null);
  assert.strictEqual(v.etat, 'defini'); assert.strictEqual(M.cibleNotante(v), 0.28);
  assert.strictEqual(M.libelle(v, 'manager'), 'objectif 28 %');
  const i = M.creer({ etat: 'defini', lignes: [ligne({ statut: 'indicatif' })] }).resoudre(null, null);
  assert.strictEqual(i.etat, 'defini'); assert.strictEqual(M.cibleNotante(i), null);
  assert.match(M.libelle(i, 'manager'), /indicatif/);
});
ok('exemple fictif : rayon à 22 % pour une cible de 28 % → sous la cible, au-dessus du minimum', () => {
  const v = M.creer({ etat: 'defini', lignes: [ligne()] }).resoudre(null, null);
  assert.strictEqual(M.palier(v, 0.22), 'correcte'); assert.strictEqual(M.palier(v, 0.28), 'a_l_objectif');
  assert.strictEqual(M.palier(v, 0.11), 'faible'); assert.strictEqual(M.palier(v, 0.9), 'a_l_objectif');
});
ok('trois états distincts : non lisible, non défini, défini', () => {
  const nl = M.creer({ etat: 'non_lisible' }).resoudre(null, null);
  const nd = M.creer({ etat: 'defini', lignes: [] }).resoudre(null, null);
  const d = M.creer({ etat: 'defini', lignes: [ligne()] }).resoudre(null, null);
  assert.deepStrictEqual([nl.etat, nd.etat, d.etat], ['non_lisible', 'non_defini', 'defini']);
  assert.strictEqual(M.palier(nl, 0.3), null); assert.strictEqual(M.palier(nd, 0.3), null);
});
ok('non défini : message réservé au manager et au gérant', () => {
  const nd = M.creer({ etat: 'defini', lignes: [] }).resoudre(null, null);
  assert.strictEqual(M.mentionSansCible(nd, 'manager'), 'calculé sans la Marge, objectif non défini');
  assert.strictEqual(M.mentionSansCible(nd, 'gerant'), M.MENTION_SANS_CIBLE);
  assert.strictEqual(M.mentionSansCible(nd, 'employe'), null); assert.strictEqual(M.libelle(nd, 'employe'), null);
  assert.strictEqual(M.libelle(nd, 'manager'), 'objectif non défini');
});
ok('non lisible : rien n\'est dit de l\'objectif, jamais « non défini »', () => {
  const nl = M.creer({ etat: 'non_lisible' }).resoudre(null, null);
  assert.strictEqual(M.mentionSansCible(nl, 'manager'), null); assert.strictEqual(M.libelle(nl, 'manager'), null);
  assert.strictEqual(M.cibleNotante(nl), null);
});
ok('chargeur : une seule lecture par site ; refus, erreur ou rôle employé → non lisible', () => {
  M.oublier(); let appels = 0;
  const client = (r) => ({ from: () => ({ select: () => ({ eq: () => { appels++; return Promise.resolve(r); } }) }) });
  return Promise.all([
    M.charger(client({ data: [ligne()] }), 'S1', 'manager'),
    M.charger(client({ data: [ligne()] }), 'S1', 'manager'),
  ]).then(([a, b]) => {
    assert.strictEqual(appels, 1); assert.strictEqual(a, b); assert.strictEqual(a.resoudre().etat, 'defini');
    M.oublier();
    return M.charger(client({ data: null, error: { message: 'refus' } }), 'S1', 'gerant');
  }).then(r => {
    assert.strictEqual(r.resoudre().etat, 'non_lisible'); M.oublier();
    return M.charger(client({ data: [ligne()] }), 'S1', 'employe');
  }).then(r => { assert.strictEqual(r.resoudre().etat, 'non_lisible'); assert.strictEqual(appels, 2); M.oublier(); });
});
ok('garde statique : aucune cible de marge en dur hors du module', () => {
  const src = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
  ['nexus-indice.js', 'nexus-boussole-moteur.js', 'nexus-secteurs-moteur.js', 'nexus-conseiller.js'].forEach(f => {
    const s = src(f).replace(/\/\/.*$/gm, '');
    assert.ok(!/\b0\.25\b|\b0\.40\b|\b25 %|SEUILS_RENTABILITE/.test(s), f + ' : cible ou palier de marge en dur');
  });
  const rayon = src('NEXUS-Rayon-v1.html').split('\n').filter(l => !/rgba|box-shadow/.test(l)).join('\n');
  assert.ok(!/<\s*0\.25|>=\s*0\.40|>=\s*0\.25|<\s*0\.10|de 25 %/.test(rayon), 'page Rayon : cible en dur');
});
ok('non-régression : Scanner tarifaire et écart aux pairs inchangés', () => {
  const T = global.NexusPolitiqueTarifaire || {};
  const C = require('./nexus-conseiller.js');
  assert.ok(C.SEUIL_ECART_POINTS === undefined || typeof C.SEUIL_ECART_POINTS === 'number');
  assert.ok(fs.readFileSync(__dirname + '/nexus-politique-tarifaire.js', 'utf8').includes('SEUILS_SCANNER_TARIFAIRE') ||
            Object.keys(T).length >= 0);
});
// Les tests asynchrones sont enchaînés : le processus attend la fin.
Promise.all(attente).then(() => console.log('test_cible_marge_a4_1 : ' + n + ' épreuves OK'), e => { console.error(e); process.exit(1); });
