'use strict';
// A4-1f-bis : carte « Objectifs de marge par famille » repliable (details/summary), repliée par défaut.
// Présentation seulement. Valeurs fictives.
const assert = require('assert'); const fs = require('fs');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function t(nom, f) { Promise.resolve().then(f).then(() => { n++; console.log('OK ' + nom); }, e => { console.error('AssertionError: ' + nom + ' : ' + String(e.message).split('\n')[0]); process.exitCode = 1; }); }
const lg = (famille, ca) => ({ famille, ca_ht: ca, article: famille + '1' });
const cib = (f, c, s) => ({ niveau: 'famille', cible_niveau: f, cible: c, statut_cible: s || 'indicatif', id: 'o-' + f });
const base = (o) => Object.assign({ userId: 'u2', analyse: { lignes: [lg('Boissons', 500), lg('Epicerie', 900), lg('Hygiene', 100)] },
  objectifs: [cib('Boissons', 0.25, 'valide'), cib('Epicerie', 0.3, 'hypothese')], propositions: [], droitsObjectif: { proposer: true, valider: true }, groupe: {} }, o || {});

t('repliée par défaut : details sans open, summary, chevron 44 px', () => {
  const h = E.htmlObjectifsFamilles(base());
  assert.ok(/^<details class="sc-carte[^>]*data-objectifs-familles="1"/.test(h));
  assert.ok(!/^<details[^>]*\sopen[\s>]/.test(h));
  assert.ok(h.includes('<summary class="pt-objf-resume">') && h.includes('class="sc-chev"'));
  assert.ok(!h.includes('data-objf-kpi') && !h.includes('<table'));
  const src = fs.readFileSync('./nexus-politique-tarifaire-ecran.js', 'utf8');
  assert.ok(/pt-obj-familles>summary\{[^']*min-height:44px/.test(src));
});
t('préférence relue : ouvert persisté, replié si stockage absent ou illisible', () => {
  const m = {}; const st = { getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; } };
  assert.strictEqual(E.lirePrefsFamilles(st, 'S1', 'u1').ouvert, false);
  E.ecrirePrefsFamilles(st, 'S1', 'u1', { tout: false, repli: null, ouvert: true });
  assert.strictEqual(E.lirePrefsFamilles(st, 'S1', 'u1').ouvert, true);
  assert.strictEqual(E.lirePrefsFamilles(st, 'S1', 'u2').ouvert, false);
  assert.strictEqual(E.lirePrefsFamilles(null, 'S1', 'u1').ouvert, false);
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.strictEqual(E.lirePrefsFamilles(casse, 'S1', 'u1').ouvert, false);
  assert.strictEqual(E.ecrirePrefsFamilles(casse, 'S1', 'u1', { ouvert: true }), false);
  const h = E.htmlObjectifsFamilles(base({ groupe: { ouvert: true } }));
  assert.ok(/^<details[^>]*\sopen[\s>]/.test(h));
});
t('libellé du résumé : validées, à proposer, en attente de validation, sélectionnées, dans cet ordre', () => {
  const sans = E.resumeFamilles({ total: 15, valides: 2, aProposer: 10, attente: 0 }, 0);
  assert.strictEqual(sans, '15 familles · 2 validées · 10 à proposer');
  assert.ok(!/en attente/.test(sans) && !/à valider/.test(sans));
  const av = E.resumeFamilles({ total: 15, valides: 2, aProposer: 10, attente: 3 }, 2);
  assert.strictEqual(av, '15 familles · 2 validées · 10 à proposer · 3 en attente de validation · 2 sélectionnées');
  assert.ok(!/à valider/.test(av));
  assert.strictEqual(E.resumeFamilles({ total: 1, valides: 1, aProposer: 0, attente: 0 }, 1), '1 famille · 1 validée · 0 à proposer · 1 sélectionnée');
});
t('résumé replié = indicateursFamilles, sans calcul neuf ni couverture', () => {
  const e = base({ propositions: [{ id: 'p-H', niveau: 'famille', cible_niveau: 'Hygiene', cible: 0.3, propose_par: 'u1', statut: 'ouverte' }] });
  const ind = E.indicateursFamilles(e);
  const h = E.htmlObjectifsFamilles(e);
  const r = (h.match(/data-objf-resume="1">([^<]*)</) || [])[1];
  assert.strictEqual(r, E.resumeFamilles(ind, 0));
  assert.ok(r.startsWith(ind.total + ' familles') && r.includes(ind.aProposer + ' à proposer') && r.includes(ind.valides + ' validée'));
  assert.ok(!/couverture/i.test(r) && !/sélectionnée/.test(r));
  assert.strictEqual(E.resumeFamilles(ind, 2).slice(-'2 sélectionnées'.length), '2 sélectionnées');
  assert.ok(E.resumeFamilles(ind, 1).endsWith('1 sélectionnée'));
  const hs = E.htmlObjectifsFamilles(base({ groupe: { selProposer: ['Epicerie'] } }));
  assert.ok(hs.includes('1 sélectionnée'));
});
t('repliée : ni barre collante, ni confirmation, ni transmission', () => {
  const g = { selProposer: ['Epicerie'], confirmer: { mode: 'proposer' } };
  const h = E.htmlObjectifsFamilles(base({ groupe: g }));
  assert.ok(!h.includes('pt-objf-barre') && !h.includes('pt-objf-confirm') && !/data-objf-(transmettre|confirmer|envoyer)/.test(h));
  assert.ok(!/<button/.test(h));
  const ho = E.htmlObjectifsFamilles(base({ groupe: Object.assign({ ouvert: true }, g) }));
  assert.ok(ho.includes('pt-objf-confirm'));
});
t('sélection gardée au repli et rendue à l\'ouverture', () => {
  const g = { selProposer: ['Epicerie'] };
  const ferme = E.htmlObjectifsFamilles(base({ groupe: g }));
  const ouvert = E.htmlObjectifsFamilles(base({ groupe: Object.assign({ ouvert: true }, g) }));
  assert.ok(ferme.includes('1 sélectionnée'));
  assert.ok(ouvert.includes('pt-objf-barre') && /checked/.test(ouvert));
  assert.deepStrictEqual(g.selProposer, ['Epicerie']);
  const page = fs.readFileSync('./NEXUS-Produits-v1.html', 'utf8');
  const bloc = page.slice(page.indexOf("details[data-objectifs-familles]"), page.indexOf("details[data-objectifs-familles]") + 260);
  assert.ok(/addEventListener\('toggle'/.test(bloc) && !/selProposer|selValider/.test(bloc));
});
t('surface interdite : aucune nouvelle RPC ni migration', () => {
  const src = fs.readFileSync('./nexus-politique-tarifaire-ecran.js', 'utf8');
  assert.ok(!/\.rpc\(/.test(src.slice(src.indexOf('function resumeFamilles'), src.indexOf('function resumeFamilles') + 600)));
});
setTimeout(() => console.log(n + ' tests'), 50);
