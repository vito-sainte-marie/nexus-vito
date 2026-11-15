// C8 : reprise des objectifs validés dans la mesure de compensation. Lecture seule, aucune écriture.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const PF = require('./nexus-campagne-prefill.js');
require('./nexus-simulateur-promo.js'); const SIM = globalThis.NexusSimulateurPromo;

const src5 = lire('test_campagne_c5_bilan_20261115.js');
const noms = eval(src5.match(/const nomsA = (\[.*\]);/)[1]);
assert.strictEqual(noms.length, 12);

const obj = (article, version, o) => Object.assign({ campagne_id: 'c1', article, version, objectif_valide_jour: 10 }, o);
const rows = [];
noms.forEach((n, i) => {
  rows.push(obj(n, 1, { pa_habituel_ht: 1, pa_promo_ht: 0.9, pv_habituel_ttc: 2, pv_promo_ttc: 1.8, tva_pct: 20, objectif_valide_jour: 8 }));
  rows.push(obj(n, 2, { pa_habituel_ht: 1.1 + i / 100, pa_promo_ht: 0.95, pv_habituel_ttc: 2.4, pv_promo_ttc: 2.1, tva_pct: 20 }));
});
// Exemple Heineken : 2,10 TTC à 20 % donne 1,75 HT.
const hn = noms.find(n => /heineken/i.test(n)) || noms[0];
const r = PF.reprendre(PF.derniereValidee(rows, 'c1', hn), SIM.ttcVersHt);
assert.strictEqual(r.ventePendant, 1.75);
assert.strictEqual(r.venteAvant, 2);
assert.strictEqual(r.achatPendant, 0.95);

// Dernière version validée seulement ; version non validée ignorée.
noms.forEach((n) => assert.strictEqual(PF.derniereValidee(rows, 'c1', n).version, 2));
rows.push(obj(noms[0], 3, { objectif_valide_jour: null, pa_promo_ht: 9 }));
assert.strictEqual(PF.derniereValidee(rows, 'c1', noms[0]).version, 2);
assert.strictEqual(PF.derniereValidee(rows, 'autre', noms[0]), null);

// Article sans objectif : champs vides, jamais 0.
const vide = PF.reprendre(PF.derniereValidee(rows, 'c1', 'Inconnu'), SIM.ttcVersHt);
assert.deepStrictEqual(vide, { achatAvant: null, achatPendant: null, venteAvant: null, ventePendant: null });
const saisieVide = { achatAvant: '', achatPendant: '', venteAvant: '', ventePendant: '' };
assert.deepStrictEqual(PF.appliquer(saisieVide, vide), { repris: [], ecarts: [] });
assert.strictEqual(saisieVide.achatAvant, '');
// TVA absente : PV non converti.
assert.strictEqual(PF.reprendre({ pv_promo_ttc: 2, pa_promo_ht: 1 }, SIM.ttcVersHt).ventePendant, null);

// Reprise dans les champs vides, format décimal à virgule.
const e = { achatAvant: '', achatPendant: '', venteAvant: '', ventePendant: '' };
const a = PF.appliquer(e, r);
assert.strictEqual(e.ventePendant, '1,75');
assert.strictEqual(a.repris.length, 4);
assert.strictEqual(a.ecarts.length, 0);

// Une valeur déjà saisie n'est pas écrasée : écart signalé.
const e2 = { achatAvant: '1,5', achatPendant: '0,95', venteAvant: '', ventePendant: '' };
const a2 = PF.appliquer(e2, r);
assert.strictEqual(e2.achatAvant, '1,5');
assert.deepStrictEqual(a2.ecarts.map(x => x.champ), ['achatAvant']);
assert.deepStrictEqual(PF.ecarts(e2, r).map(x => x.champ), ['achatAvant']);

// La page : lecture seule, aucune écriture sur les objectifs, pas d'écriture sans action du manager.
const html = lire('NEXUS-Campagne-v2.html');
assert.ok(/nexus-campagne-prefill\.js/.test(html));
assert.ok(!/campagne_objectifs_produits'\)\s*\.(insert|upsert|update|delete)/.test(html));
assert.ok(!/campagne_objectifs_produits/.test(lire('nexus-campagne-prefill.js')));
const pre = html.slice(html.indexOf('async function mesPreremplir'), html.indexOf('function mesSource'));
assert.ok(!/\.(insert|upsert|update|delete)\(/.test(pre), 'mesPreremplir n écrit pas');
assert.ok(/mesPreremplir/.test(html));
const voc = lire('nexus-vocabulaire.js');
assert.ok(/Repris de vos objectifs/.test(voc) && /Différent de vos objectifs/.test(voc));
const vocTxt = voc.slice(voc.indexOf('reprisObjectifs'), voc.indexOf('reprisObjectifs') + 400);
assert.ok(!/—/.test(vocTxt));
console.log('OK c8');
