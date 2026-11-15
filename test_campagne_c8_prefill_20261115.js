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
  rows.push(obj(n, 2, /heineken/i.test(n)
    ? { pa_habituel_ht: 1.18, pa_promo_ht: 0.94, pv_habituel_ttc: 2.2, pv_promo_ttc: 1.5, tva_pct: 2.1, periode_ref_debut: '2026-10-05', periode_ref_fin: '2026-11-09' }
    : { pa_habituel_ht: 1.1 + i / 100, pa_promo_ht: 0.95, pv_habituel_ttc: 2.4, pv_promo_ttc: 2.1, tva_pct: 20, periode_ref_debut: '2026-10-05', periode_ref_fin: '2026-11-09' }));
});
// Exemple Heineken : PA promo 0,94 HT, PV promo 1,50 TTC à 2,1 % donne 1,5 / 1,021 = 1,469, soit 1,47 HT.
const hn = noms.find(n => /heineken/i.test(n)) || noms[0];
const r = PF.reprendre(PF.derniereValidee(rows, 'c1', hn), SIM.ttcVersHt);
assert.strictEqual(r.ventePendant, 1.47);
assert.strictEqual(r.venteAvant, 2.15);
assert.strictEqual(r.achatPendant, 0.94);

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
assert.strictEqual(e.ventePendant, '1,47');
assert.strictEqual(a.repris.length, 4);
assert.strictEqual(a.ecarts.length, 0);

// Une valeur déjà saisie n'est pas écrasée : écart signalé.
const e2 = { achatAvant: '1,5', achatPendant: '0,94', venteAvant: '', ventePendant: '' };
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
assert.ok(!/\.(insert|upsert|update|delete)\(/.test(html.slice(html.indexOf('async function mesCharger'), html.indexOf('async function mesEnregistrer'))), 'mesCharger n écrit pas');
const voc = lire('nexus-vocabulaire.js');
assert.ok(/Repris de vos objectifs/.test(voc) && /Différent de vos objectifs/.test(voc));
const vocTxt = voc.slice(voc.indexOf('reprisObjectifs'), voc.indexOf('reprisObjectifs') + 400);
assert.ok(!/—/.test(vocTxt));

// ===== C8 élargi : tout préremplir depuis les sources existantes =====
assert.strictEqual(PF.joursPeriode('2026-10-05', '2026-11-09'), 36);
assert.strictEqual(PF.joursPeriode('2026-10-05', null), null);
assert.strictEqual(PF.avantFin('2026-11-30', '2026-11-15'), true);
assert.strictEqual(PF.avantFin('2026-11-30', '2026-11-30'), false);
assert.strictEqual(PF.avantFin('2026-11-30', '2026-12-01'), false);

const fiab = (ref, dd, pl) => {
  if (!ref) return { statut: 'absent' };
  const dr = String(ref.date_reference).slice(0, 10);
  return (dr > dd || (pl && dr >= pl)) ? { statut: 'a_confirmer' } : { statut: 'fiable' };
};
const deps = { ttcVersHt: SIM.ttcVersHt, fiabiliteReference: fiab };
const camp = { campagneId: 'c1', dateDebut: '2026-11-10', dateFin: '2026-11-30' };
const prodRows = noms.map((n, i) => ({ article: n, periode_debut: '2026-10-05', periode_fin: '2026-11-09', quantite: 100 + i }));
const pmp = noms.map((n) => ({ article: n, version: 1, pmp_ht: 1.18, date_reference: '2026-11-01' }));
const depart = noms.map((n) => ({ article: n, version: 1, quantite: 50, date_stock: '2026-11-10', source: 'comptage', a_confirmer: false }));
const livs = [
  { id: 'L0', date_livraison: '2026-11-08' },
  { id: 'L1', date_livraison: '2026-11-12' },
  { id: 'L2', date_livraison: '2026-11-10' },
];
const lignes = [{ livraison_id: 'L0', article: hn, unites: 7 }, { livraison_id: 'L1', article: hn, unites: 24 }, { livraison_id: 'L2', article: hn, unites: 5 }];
const base = { campagne: camp, article: hn, objectifs: rows, pmp, depart, livraisons: livs, lignesLivraison: lignes, produitsRows: prodRows, stockReleve: null, stockFinReleve: null, pertes: 0 };

noms.forEach((n) => {
  const p = PF.proposer(Object.assign({}, base, { article: n }), deps);
  assert.strictEqual(p.valeurs.joursRef, 36, 'jours de référence');
  assert.strictEqual(p.valeurs.achatAvant, 1.18, 'PMP');
  assert.strictEqual(p.sources.achatAvant.type, 'pmp');
  assert.strictEqual(p.sources.ventes.debut, '2026-10-05');
  assert.strictEqual(p.sources.ventes.fin, '2026-11-09');
  assert.strictEqual(p.valeurs.stockDebut, 50);
  assert.strictEqual(p.sources.stockDebut.type, 'stock_depart');
  assert.strictEqual(p.valeurs.stockFin, null, 'stock de fin à saisir à la fin');
  assert.strictEqual(p.valeurs.pertes, null, 'pertes non renseignées');
});
const ph = PF.proposer(base, deps);
assert.strictEqual(ph.valeurs.venteAvant, 2.15);
assert.strictEqual(ph.valeurs.ventePendant, 1.47);
assert.strictEqual(ph.valeurs.achatPendant, 0.94);
assert.strictEqual(ph.valeurs.ventes, 100 + noms.indexOf(hn));
// Livraisons : celle d'avant le stock de départ est exclue, celle du même jour est signalée et non comptée.
assert.strictEqual(ph.valeurs.livraisons, 24);
assert.strictEqual(ph.sources.livraisons.n, 1);
assert.strictEqual(ph.sources.livraisons.memeJour, 5);
// Sources absentes : champs vides, jamais 0.
const pv = PF.proposer(Object.assign({}, base, { objectifs: [], pmp: [], depart: [], livraisons: [], lignesLivraison: [] }), deps);
['venteAvant', 'achatAvant', 'achatPendant', 'ventePendant', 'ventes', 'joursRef', 'stockDebut', 'livraisons', 'stockFin', 'pertes'].forEach((k) => assert.strictEqual(pv.valeurs[k], null, k));
// Pertes et stock de fin si une source existe.
const pp = PF.proposer(Object.assign({}, base, { pertes: 3, stockFinReleve: { valeur: 12, source: 'comptage' } }), deps);
assert.strictEqual(pp.valeurs.pertes, 3);
assert.strictEqual(pp.valeurs.stockFin, 12);
// Une saisie existante passe avant la source : écart signalé, rien d'écrasé.
const es = { achatAvant: '1,30', stockDebut: '', livraisons: '' };
const ec = PF.appliquerProposition(es, ph);
assert.strictEqual(es.achatAvant, '1,30');
assert.deepStrictEqual(ec.filter(x => x.champ === 'achatAvant').map(x => x.source), [1.18]);
assert.strictEqual(es.stockDebut, '50');
assert.strictEqual(es.livraisons, '24');
assert.strictEqual(es.src_stockDebut.type, 'stock_depart');
// Page : bandeau avant la fin, mentions, aucune écriture hors mesEnregistrer.
assert.ok(/id="mesBandeau"/.test(html) && /mesBandeau\(\)/.test(html));
assert.ok(/bandeauAvantFin/.test(voc) && /Actualiser mes ventes/.test(voc) && /à la fin de la promotion/.test(voc));
['produits de la promotion', 'repris de vos objectifs', 'à saisir à la fin de la promotion', 'non renseignées'].forEach((t) => assert.ok(voc.toLowerCase().includes(t.toLowerCase()), t));
assert.ok(!/—/.test(voc.slice(voc.indexOf('mentions:'), voc.indexOf('mentions:') + 1800)));
console.log('OK c8');
