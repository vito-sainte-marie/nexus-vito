// C9 : fiche de valorisation par produit (composant unique, trois emplacements).
const assert = require('assert');
const fs = require('fs');
const B = require('./nexus-campagne-bilan.js');
const F = require('./nexus-campagne-fiche.js');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sansTags = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function ba(a) { const r = B.bilanArticle(Object.assign({ date_debut: '2026-11-12', date_ventes: '2026-11-13' }, a)); r.article = a.article || 'Heineken'; return r; }
const REF = { pmp_ht: 1.18, date_reference: '2026-11-09' };

// Heineken 14 / 48 / 30.
const hk = ba({ article: 'Heineken', unitesVendues: 30, ca_ht_promo: 40, pmp_avant: REF, pa_promo_negocie: 0.94, pv_habituel_ht: 1.6,
  stockDepart: { unites: 14 }, livraisons: [{ unites: 48, pa_ht_facture: 0.94, date_livraison: '2026-11-12' }] });
const f = F.construire(hk);
assert.strictEqual(f.etat, 'fiche');
assert.strictEqual(f.lignes.length, 2);
assert.strictEqual(f.lignes[0].total, 16.52);
assert.strictEqual(f.lignes[1].unites, 16);
assert.strictEqual(f.lignes[1].total, 15.04);
assert.strictEqual(f.cout_total, 31.56);
assert.strictEqual(Math.round(f.cout_moyen * 1000) / 1000, 1.052);
assert.strictEqual(f.restant.unites, 32);
assert.strictEqual(f.restant.valeur_ht, 30.08);
assert.strictEqual(f.restant.economie, 7.68);
assert.strictEqual(f.estimee, false);
const t = sansTags(F.html(f, esc));
['Stock acheté avant la promotion', '14 × 1,18 = 16,52 €', 'Stock acheté au tarif promotionnel', 'livraison du 12/11/2026', '16 × 0,94 = 15,04 €',
 'Coût total des ventes', '31,56 €', 'Coût moyen des unités vendues', '1,052 €', 'Stock promotionnel restant', '32 unités', '30,08 € HT',
 'Économie d\'achat : 7,68 € par rapport au PMP Decenium d\'avant promotion', 'Méthode Campagne (FIFO analytique)'
].forEach(x => assert.ok(t.includes(x), 'manque : ' + x));
assert.ok(!/tarif habituel/i.test(t), 'jamais « tarif habituel »');
assert.ok(!/estimé/.test(t), 'réel : pas d\'estimé');
assert.ok(!/—/.test(t), 'pas de tiret long');

// Deux livraisons à PA différents : une ligne par livraison.
const d2 = F.construire(ba({ unitesVendues: 25, ca_ht_promo: 40, pmp_avant: REF, stockDepart: { unites: 5 },
  livraisons: [{ unites: 10, pa_ht_facture: 1, date_livraison: '2026-11-12', cree_le: '1' }, { unites: 20, pa_ht_facture: 0.9, date_livraison: '2026-11-13', cree_le: '2' }] }));
assert.deepStrictEqual(d2.lignes.map(l => [l.type, l.unites, l.pa, l.date]), [['avant', 5, 1.18, null], ['promo', 10, 1, '2026-11-12'], ['promo', 10, 0.9, '2026-11-13']]);
assert.strictEqual(d2.cout_total, 5.9 + 10 + 9);
const h2 = sansTags(F.html(d2, esc));
assert.ok(h2.includes('livraison du 12/11/2026') && h2.includes('livraison du 13/11/2026'));

// Livraison reçue après le point de ventes : dans le restant, avec sa mention, jamais consommée.
const ap = F.construire(ba({ unitesVendues: 10, ca_ht_promo: 15, pmp_avant: REF, stockDepart: { unites: 14 }, livraisons: [],
  livraisonsApres: [{ unites: 24, pa_ht_facture: 0.94, date_livraison: '2026-11-14' }] }));
assert.strictEqual(ap.lignes.length, 1);
assert.strictEqual(ap.restant.unites, 28);
assert.strictEqual(ap.restant.apres, 24);
assert.ok(ap.mentions.length === 1);
assert.ok(sansTags(F.html(ap, esc)).includes('reçue après'));

// Trois états honnêtes.
assert.strictEqual(F.construire(hk, { aucunPoint: true }).message, 'Fiche disponible après le premier import de ventes');
assert.ok(F.html(F.construire(null, { aucunPoint: true }), esc).includes('Fiche disponible après le premier import de ventes'));
const est = F.construire(ba({ unitesVendues: 4, ca_ht_promo: null, pmp_avant: null, stockDepart: { unites: 2 },
  livraisons: [{ unites: 10, pa_ht_facture: null, pa_promo_ht: 0.9, date_livraison: '2026-11-12' }] }));
assert.strictEqual(est.estimee, true);
const te = sansTags(F.html(est, esc));
assert.ok(te.includes('estimé'), 'estimé affiché');
assert.ok(/estimé : /.test(te) && est.raisons.length > 0, 'avec sa raison');
const ex = F.construire(ba({ unitesVendues: 20, ca_ht_promo: 30, pmp_avant: REF, stockDepart: { unites: 5 }, livraisons: [] }));
assert.strictEqual(ex.excedent_unites, 15);
assert.strictEqual(ex.cout_total, 5.9);
assert.strictEqual(Math.round(ex.cout_moyen * 1000) / 1000, 1.18);
assert.ok(sansTags(F.html(ex, esc)).includes('15 unités vendues au-delà du stock connu, coût non valorisé'));

// Restant mixte (14, 48, 10 ventes) : titre « Stock restant » et une ligne par origine.
const mx = F.construire(ba({ article: 'Heineken', unitesVendues: 10, ca_ht_promo: 15, pmp_avant: REF, pa_promo_negocie: 0.94, pv_habituel_ht: 1.6,
  stockDepart: { unites: 14 }, livraisons: [{ unites: 48, pa_ht_facture: 0.94, date_livraison: '2026-11-12' }] }));
const tm = sansTags(F.html(mx, esc));
assert.strictEqual(mx.restant.unites, 52);
assert.ok(tm.includes('Stock restant 52 unités'), 'titre Stock restant');
assert.ok(!tm.includes('Stock promotionnel restant'), 'pas de titre promotionnel');
assert.ok(tm.includes('dont avant la promotion 4 × 1,18'), 'ligne avant promotion');
assert.ok(tm.includes('dont au tarif promotionnel 48 × 0,94'), 'ligne tarif promotionnel');
// Restant entièrement d'avant promotion : pas d'économie.
const pr = F.construire(ba({ article: 'Pringles', unitesVendues: 3, ca_ht_promo: 5, pmp_avant: REF, stockDepart: { unites: 9 }, livraisons: [] }));
const tp = sansTags(F.html(pr, esc));
assert.strictEqual(pr.restant.economie, null);
assert.ok(!/Économie d'achat/.test(tp), 'aucune économie sans unité promotionnelle');
assert.ok(tp.includes('Stock restant 6 unités') && !tp.includes('Stock promotionnel restant'));
// Montants insécables.
assert.ok(/\.fv-l b\{[^}]*white-space:nowrap/.test(F.CSS), 'montants insécables');

// Échappement.
assert.ok(!F.html(F.construire(Object.assign({}, hk, { article: '<b>x' })), esc).includes('<b>x'));

// Les trois emplacements montent le même composant (même module, mêmes libellés).
const ventes = fs.readFileSync('NEXUS-Campagne-v2-Ventes.html', 'utf8');
const main = fs.readFileSync('NEXUS-Campagne-v2.html', 'utf8');
assert.ok(/nexus-campagne-fiche\.js/.test(ventes) && /nexus-campagne-fiche\.js/.test(main), 'module chargé dans les deux pages');
assert.ok(/NexusCampagneFiche\.rendre/.test(ventes), 'emplacement 1 : chevron Ventes');
assert.ok((main.match(/NexusCampagneFiche\.rendre/g) || []).length >= 2, 'emplacements 2 et 3 : produits moteurs / bilan');
assert.ok(!/Stock acheté avant la promotion/.test(ventes + main), 'libellés uniquement dans le module');
console.log('OK C9 fiche');
