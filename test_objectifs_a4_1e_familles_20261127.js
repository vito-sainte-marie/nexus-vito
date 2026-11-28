'use strict';
// A4-1e : carte « Objectifs de marge par famille », validation et proposition groupées.
const assert = require('assert');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function t(nom, f) { const r = f(); const fin = () => { n++; console.log('OK ' + nom); }; return r && r.then ? r.then(fin) : fin(); }
const lg = (famille, ca) => ({ famille, ca_ht: ca, article: famille + '1' });
const base = (o) => Object.assign({ userId: 'u2', analyse: { lignes: [lg('Boissons', 500), lg('Epicerie', 900), lg('Hygiene', 100)] },
  objectifs: [], propositions: [], droitsObjectif: { proposer: true, valider: true }, groupe: {} }, o || {});
const cib = (f, c, s) => ({ niveau: 'famille', cible_niveau: f, cible: c, statut_cible: s || 'indicatif', id: 'o-' + f });
const prop = (f, par) => ({ id: 'p-' + f, niveau: 'famille', cible_niveau: f, cible: 0.3, propose_par: par || 'u1', statut: 'ouverte' });

t('tri par CA de la période, statut et cible affichés', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Boissons', 0.25, 'valide'), cib('Epicerie', 0.3, 'hypothese')] }));
  assert.ok(h.indexOf('Epicerie') < h.indexOf('Boissons') && h.indexOf('Boissons') < h.indexOf('Hygiene'));
  assert.ok(h.includes('hypothèse') && h.includes('validée') && h.includes('non définie'));
});
t('plus de 10 familles : recherche et 10 lignes', () => {
  const lignes = []; for (let i = 0; i < 12; i++) lignes.push(lg('F' + String(i).padStart(2, '0'), 100 - i));
  const h = E.htmlObjectifsFamilles(base({ analyse: { lignes } }));
  assert.strictEqual((h.match(/data-objf-famille=/g) || []).length, 10);
  assert.ok(h.includes('data-objf-recherche'));
  const h2 = E.htmlObjectifsFamilles(base({ analyse: { lignes }, groupe: { recherche: 'f11' } }));
  assert.strictEqual((h2.match(/data-objf-famille=/g) || []).length, 1);
});
t('propositions : case par proposition, pas pour les siennes', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Boissons', 0.25)], propositions: [prop('Boissons', 'u1'), prop('Epicerie', 'u2')] }));
  assert.ok(h.includes('data-objf-valider="p-Boissons"'));
  assert.ok(!h.includes('data-objf-valider="p-Epicerie"'));
  assert.ok(h.includes('Un autre compte doit valider'));
  assert.ok(h.includes('Valider la sélection (0)') && h.includes('Tout sélectionner'));
});
t('compteur du bouton selon la sélection', () => {
  const h = E.htmlObjectifsFamilles(base({ propositions: [prop('Boissons'), prop('Epicerie')], groupe: { selValider: ['p-Boissons', 'p-Epicerie'] } }));
  assert.ok(h.includes('Valider la sélection (2)'));
});
t('compte non habilité : aucune case, lecture seule', () => {
  const h = E.htmlObjectifsFamilles(base({ droitsObjectif: {}, objectifs: [cib('Boissons', 0.25)], propositions: [prop('Epicerie')] }));
  assert.ok(!h.includes('type="checkbox"') && !h.includes('data-objf-envoyer'));
  assert.ok(h.includes('Lecture seule'));
});
t('proposition groupée : familles non validées sans proposition ouverte, jamais defaut', () => {
  const h = E.htmlObjectifsFamilles(base({ objectifs: [cib('Boissons', 0.25, 'valide'), cib('Epicerie', 0.3, 'a_l_etude'), cib('Hygiene', 0.2, 'indicatif'), { niveau: 'defaut', cible_niveau: 'defaut', cible: 0.28, statut_cible: 'indicatif' }], propositions: [prop('Hygiene')] }));
  assert.ok(h.includes('data-objf-proposer="Epicerie"'));
  assert.ok(!h.includes('data-objf-proposer="Boissons"') && !h.includes('data-objf-proposer="Hygiene"') && !h.includes('data-objf-proposer="defaut"'));
  assert.ok(!h.includes('data-objf-famille="defaut"'));
  assert.ok(h.includes('Proposer ces cibles telles quelles (0)'));
});
t('confirmation dans la page, avec la liste', () => {
  const h = E.htmlObjectifsFamilles(base({ propositions: [prop('Boissons'), prop('Epicerie')], groupe: { selValider: ['p-Boissons', 'p-Epicerie'], confirmer: { mode: 'valider' } } }));
  assert.ok(h.includes('Valider 2 objectifs ?') && h.includes('data-objf-confirmer'));
});
t('envoi partiel : un échec n\'arrête pas les autres, bilan', async () => {
  const appels = [];
  const client = { rpc: async (nom, a) => { appels.push([nom, a]); return a.p_proposition === 'b' ? { error: { message: 'objectif_auto_validation_interdite' } } : { data: 1 }; } };
  const r = await E.envoyerGroupe(client, 'S', 'valider', [{ id: 'a', libelle: 'A' }, { id: 'b', libelle: 'B' }, { id: 'c', libelle: 'C' }]);
  assert.strictEqual(appels.length, 3);
  assert.deepStrictEqual(r.resultats.map(x => x.ok), [true, false, true]);
  assert.ok(/^2 validés, 1 refusé : B \(/.test(r.bilan));
});
t('proposition groupée : un appel par famille, niveau famille, cible reprise', async () => {
  const appels = [];
  const client = { rpc: async (nom, a) => { appels.push([nom, a]); return { data: 1 }; } };
  const r = await E.envoyerGroupe(client, 'S', 'proposer', [{ famille: 'Epicerie', cible: 0.3, libelle: 'Epicerie' }]);
  assert.strictEqual(appels[0][0], 'proposer_marge_cible');
  assert.strictEqual(appels[0][1].p_niveau, 'famille'); assert.strictEqual(appels[0][1].p_cible_niveau, 'Epicerie'); assert.strictEqual(appels[0][1].p_cible, 0.3);
  assert.strictEqual(r.bilan, '1 proposé.');
});
const LIBS = { chips_et_petits_sales: 'Chips et petits salés', eaux_non_aromatisees: 'Eaux non aromatisées' };
t('libellé de tarif_familles affiché, code en repli, recherche par libellé', () => {
  const e = base({ analyse: { lignes: [lg('chips_et_petits_sales', 900), lg('eaux_non_aromatisees', 500), lg('sans_libelle', 100)] }, libellesFamilles: LIBS, propositions: [prop('chips_et_petits_sales')], groupe: { selValider: ['p-chips_et_petits_sales'], confirmer: { mode: 'valider' } } });
  const h = E.htmlObjectifsFamilles(e);
  assert.ok(h.includes('Chips et petits salés') && h.includes('Eaux non aromatisées'));
  assert.ok(!h.includes('>chips_et_petits_sales<') && !h.includes('>eaux_non_aromatisees<'));
  assert.ok(h.includes('>sans_libelle<'), 'repli sur le code');
  assert.ok(/Chips et petits salés : /.test(h), 'confirmation avec le libellé');
  assert.strictEqual(E.libelleFamille(e, 'chips_et_petits_sales'), 'Chips et petits salés');
  assert.strictEqual(E.libelleFamille(e, 'inconnu'), 'inconnu');
  const r = E.htmlObjectifsFamilles(Object.assign({}, e, { groupe: { recherche: 'petits salés' } }));
  assert.strictEqual((r.match(/data-objf-famille=/g) || []).length, 1);
});
t('Tout sélectionner : toutes les lignes éligibles, au-delà de 10, et seulement la recherche', () => {
  const lignes = []; const props = [];
  for (let i = 0; i < 14; i++) { const f = 'f' + String(i).padStart(2, '0'); lignes.push(lg(f, 100 - i)); props.push(prop(f)); }
  const e = base({ analyse: { lignes }, propositions: props, libellesFamilles: { f13: 'Zeta spécial', f12: 'Zeta autre' } });
  assert.strictEqual(E.eligiblesGroupe(e, 'valider').length, 14);
  const rech = Object.assign({}, e, { groupe: { recherche: 'zeta' } });
  assert.deepStrictEqual(E.eligiblesGroupe(rech, 'valider').sort(), ['p-f12', 'p-f13']);
  const h = E.htmlObjectifsFamilles(Object.assign({}, e, { groupe: { selValider: E.eligiblesGroupe(e, 'valider') } }));
  assert.ok(h.includes('Valider la sélection (14)'));
  const e2 = base({ analyse: { lignes }, objectifs: lignes.map(l => cib(l.famille, 0.2, 'indicatif')) });
  assert.strictEqual(E.eligiblesGroupe(e2, 'proposer').length, 14);
});
t('l\'ancienne carte station a disparu', () => assert.strictEqual(E.htmlObjectifStation, undefined));
Promise.resolve().then(() => new Promise(r => setTimeout(r, 50))).then(() => console.log(n + ' tests'));
