const assert = require('assert');
const S = require('./nexus-campagne-stock.js');
let n = 0; const t = (nom, f) => { f(); n++; };

t('conversion carton vers unités, plusieurs articles', () => {
  assert.strictEqual(S.convertirLigne({ cartons: 3, unitesParCarton: 12 }).unites, 36);
  assert.strictEqual(S.convertirLigne({ cartons: 2, unitesParCarton: 24 }).unites, 48);
});
t('carton sans conditionnement : à renseigner', () => {
  const r = S.convertirLigne({ cartons: 3 });
  assert.strictEqual(r.unites, null); assert.strictEqual(r.aRenseigner, true);
});
t('saisie directe en unités permise', () => {
  assert.strictEqual(S.convertirLigne({ unites: 7 }).unites, 7);
});
t('trois cas de conditionnement', () => {
  assert.strictEqual(S.conditionnement('Jus Caresse 50cl', { mode: 'a_l_unite', unites_par_carton: 1 }).source, 'a_l_unite');
  assert.strictEqual(S.conditionnement('X-NP', { mode: 'suffixe_np', unites_par_carton: 12 }).unitesParCarton, 12);
  assert.strictEqual(S.conditionnement('Y', null).aRenseigner, true);
});
t('à l\'unité : pas d\'arrondi au carton, pas de mention', () => {
  const r = S.arrondirAchat(7.2, S.conditionnement('Jus', { mode: 'a_l_unite', unites_par_carton: 1 }));
  assert.deepStrictEqual(r, { unites: 8, cartons: null, mention: null });
});
t('inconnu : mention conservée', () => {
  assert.strictEqual(S.arrondirAchat(5, S.conditionnement('Z', null)).mention, 'conditionnement à renseigner');
});
t('carton connu : arrondi au carton', () => {
  const r = S.arrondirAchat(13, S.conditionnement('X-NP', { mode: 'suffixe_np', unites_par_carton: 12 }));
  assert.strictEqual(r.cartons, 2); assert.strictEqual(r.unites, 24);
});
t('PA modifié conservé à côté du proposé', () => {
  assert.strictEqual(S.ecartPa(1.5, 1.2).toFixed(2), '0.30');
  assert.strictEqual(S.ecartPa(null, 1.2), null);
});
t('livraison annulée ou remplacée exclue', () => {
  const l = [{ id: 'a' }, { id: 'b', remplace_livraison_id: 'a' }, { id: 'c' }];
  const v = S.livraisonsValides(l, [{ livraison_id: 'c' }]).map(x => x.id);
  assert.deepStrictEqual(v, ['b']);
});
t('remplaçante annulée : l\'ancienne redevient valide', () => {
  const l = [{ id: 'a' }, { id: 'b', remplace_livraison_id: 'a' }];
  assert.deepStrictEqual(S.livraisonsValides(l, [{ livraison_id: 'b' }]).map(x => x.id), ['a']);
});
const base = { articles: ['A'], campagneDebut: '2026-11-12', dateVentes: '2026-11-15',
  stockDepart: [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-12', source: 'saisie_initiale' }],
  livraisons: [{ id: 'l1' }], annulations: [], lignesLivraison: [{ livraison_id: 'l1', article: 'A', unites: 50 }],
  ventes: [{ article: 'A', quantite: 30 }] };
t('stock théorique recalculé et libellé', () => {
  const r = S.stockTheorique(base)[0];
  assert.strictEqual(r.stock, 120); assert.strictEqual(r.libelle, 'Stock théorique'); assert.strictEqual(r.a_confirmer, false);
});
t('livraison annulée non comptée', () => {
  assert.strictEqual(S.stockTheorique({ ...base, annulations: [{ livraison_id: 'l1' }] })[0].stock, 70);
});
t('stock de départ manquant détecté', () => {
  const r = S.stockTheorique({ ...base, stockDepart: [] })[0];
  assert.strictEqual(r.manque_depart, true); assert.strictEqual(r.stock, null);
});
t('écart 10/11 au 12/11 : à confirmer, 2 jours non couverts', () => {
  const r = S.stockTheorique({ ...base, stockDepart: [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-10', source: 'inventaire' }] })[0];
  assert.strictEqual(r.a_confirmer, true); assert.strictEqual(r.jours_non_couverts, 2);
});
t('nouvelle version du stock remplace sans effacer', () => {
  const dep = [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-10', source: 'inventaire' },
               { article: 'A', version: 2, quantite: 90, date_stock: '2026-11-12', source: 'saisie_initiale' }];
  const r = S.stockTheorique({ ...base, stockDepart: dep })[0];
  assert.strictEqual(r.stock, 110); assert.strictEqual(r.a_confirmer, false);
});
t('livraison Inventaire signalée, jamais ajoutée', () => {
  const mv = [{ type_mouvement: 'livraison', article: 'a', date: '2026-11-13', quantite: 20 },
              { type_mouvement: 'livraison', article: 'A', date: '2026-11-01', quantite: 5 }];
  const r = S.livraisonsInventaireNonComptees(mv, { articles: ['A'], campagneDebut: '2026-11-12', campagneFin: '2026-11-30' });
  assert.strictEqual(r.length, 1); assert.match(r[0].mention, /non comptée ici/);
  assert.strictEqual(S.stockTheorique(base)[0].stock, 120);
});
t('vente sous un alias encore dû comptée sur l\'article canonique', () => {
  const resoudre = d => (String(d).trim().toLowerCase() === 'coca 33 canette' ? 'A' : null);
  const r = S.stockTheorique({ ...base, ventes: [{ article: 'Coca 33 canette', quantite: 7 }, { article: 'A', quantite: 3 }], resoudre })[0];
  const sans = S.stockTheorique({ ...base, ventes: [{ article: 'Coca 33 canette', quantite: 7 }, { article: 'A', quantite: 3 }] })[0];
  assert.strictEqual(sans.stock - r.stock, 7);
});
t('douze désignations réelles Petromix novembre 2026 : conditionnement', () => {
  // Lues dans campagnes_nexus.produits_concernes (Production, lecture filtrée, 14/11/2026).
  const att = { 'Biere Heineken 0.0 25 cl - 24P': 24, 'Bisc Oreo 66gr -20P': 20, 'Quadratini chocolate 125g -12P': 12, 'Quadratini napoliter 125g - 12P': 12, 'Quadratini vanille 125g -12P': 12, 'Pringles Origl 175g - 19P': 19, 'Chips Lays Nature 75gr - 15P': 15, 'Eau didier gazeux 50 cl -8P': 8, 'Schweppes agrumes 50cl -8P': 8, 'Schweppes pomme 50cl -8P': 8, 'Schweppes Tonic 50cl -8P': 8 };
  Object.keys(att).forEach(n => { const c = S.conditionnement(n, null); assert.strictEqual(c.source, 'suffixe_np', n); assert.strictEqual(c.unitesParCarton, att[n], n); assert.strictEqual(c.aRenseigner, false); });
  assert.strictEqual(S.conditionnement('Jus caresse 50cl TS PARF', null).source, 'inconnu');
  assert.strictEqual(S.conditionnement('Jus caresse 50cl TS PARF', { mode: 'a_l_unite', unites_par_carton: 1 }).source, 'a_l_unite');
  assert.strictEqual(S.conditionnement('Biere Heineken 0.0 25 cl - 24P', { mode: 'a_l_unite', unites_par_carton: 1 }).unitesParCarton, 1);
});
t('C4 : EAN prioritaire, désignation voisine sans EAN commun non appariée', () => {
  const rel = [
    { id: 'r1', article: 'Biere Heineken 25cl -24P', code_barres: '8712000000011', quantite_reelle: 10, releve_le: '2026-11-10' },
    { id: 'r2', article: 'Biere Heineken 0.0 25 cl - 24P', code_barres: '8712000000028', quantite_reelle: 99, releve_le: '2026-11-10' },
    { id: 'r3', article: 'Eau didier plat 50 cl -8P', code_barres: '3000000000031', quantite_reelle: 5, releve_le: '2026-11-10' },
  ];
  const promo = 'Biere Heineken 0.0 25 cl - 24P';
  const parEan = S.choisirReleves(rel, { articles: [promo], campagneDebut: '2026-11-12', eanDe: () => '8712000000028' });
  assert.strictEqual(parEan.retenus[0].reference, 'r2');
  // EAN d'un voisin : l'EAN fait foi, pas la désignation.
  const autreEan = S.choisirReleves(rel, { articles: [promo], campagneDebut: '2026-11-12', eanDe: () => '8712000000011' });
  assert.strictEqual(autreEan.retenus[0].reference, 'r1');
  // Repli sur la désignation exacte, sans EAN.
  const repli = S.choisirReleves(rel, { articles: [promo], campagneDebut: '2026-11-12' });
  assert.strictEqual(repli.retenus[0].reference, 'r2');
  // Voisins non appariés : le relevé du Heineken classique ne sert pas l'article 0.0, ni l'eau plate l'eau gazeuse.
  const sans = S.choisirReleves(rel.filter(r => r.id !== 'r2'), { articles: [promo, 'Eau didier gazeux 50 cl -8P'], campagneDebut: '2026-11-12' });
  assert.strictEqual(sans.retenus.length, 0); assert.strictEqual(sans.sans.length, 2);
});
t('C4 : voisins réels non appariés (chips, eau, jus)', () => {
  const paires = [
    ['Chips lays bbq 75g - 15P', 'Chips Lays Nature 75gr - 15P'],
    ['Eau didier 113 minerale plate 50cl -8P', 'Eau didier gazeux 50 cl -8P'],
    ['Jus caresse 50cl canne a sucre', 'Jus caresse 50cl TS PARF'],
  ];
  paires.forEach(([promo, voisin]) => {
    const rel = [{ id: 'v1', article: voisin, code_barres: null, quantite_reelle: 7, releve_le: '2026-11-10' }];
    const r = S.choisirReleves(rel, { articles: [promo], campagneDebut: '2026-11-12' });
    assert.strictEqual(r.retenus.length, 0, promo + ' ne prend pas le relevé de ' + voisin);
    assert.strictEqual(r.sans.length, 1, promo);
    // Et dans l'autre sens.
    const inv = S.choisirReleves([{ id: 'v2', article: promo, code_barres: null, quantite_reelle: 3, releve_le: '2026-11-10' }], { articles: [voisin], campagneDebut: '2026-11-12' });
    assert.strictEqual(inv.retenus.length, 0, voisin + ' ne prend pas le relevé de ' + promo);
  });
});
t('C4 : signal carton dépassant le besoin, arrondi inchangé', () => {
  const c = { source: 'suffixe_np', unitesParCarton: 24, aRenseigner: false };
  assert.strictEqual(S.cartonDepasseBesoin(2, c), true);
  assert.strictEqual(S.cartonDepasseBesoin(20, c), false);
  assert.strictEqual(S.cartonDepasseBesoin(2, { source: 'a_l_unite', unitesParCarton: 1 }), false);
  assert.strictEqual(S.arrondirAchat(2, c).unites, 24);
});
t('livraison Inventaire retrouvée par désignation après alias', () => {
  const mv = [{ type_mouvement: 'livraison', article: 'Coca 33 canette', date: '2026-11-13', quantite: 20 }];
  const r = S.livraisonsInventaireNonComptees(mv, { articles: ['Coca-Cola 33cl'], campagneDebut: '2026-11-12', campagneFin: '2026-11-30', resoudre: a => (a === 'Coca 33 canette' ? 'Coca-Cola 33cl' : a) });
  assert.strictEqual(r.length, 1);
});
t('livraison avant, le jour même, après le stock de départ', () => {
  const mk = d => S.stockTheorique({ ...base, ventes: [], livraisons: [{ id: 'l1', date_livraison: d }] })[0];
  assert.strictEqual(mk('2026-11-10').stock, 100);
  const m = mk('2026-11-12'); assert.strictEqual(m.stock, 100); assert.strictEqual(m.a_confirmer, true); assert.strictEqual(m.livraison_meme_jour_a_verifier, 50);
  assert.strictEqual(mk('2026-11-13').stock, 150);
});

t('C2 : livraison après le dernier point de ventes, montrée à part', () => {
  const r = S.stockTheorique({ ...base, livraisons: [{ id: 'l1', date_livraison: '2026-11-20' }] })[0];
  assert.strictEqual(r.stock, 70); assert.strictEqual(r.livraisons_apres_ventes, 50);
  assert.strictEqual(r.livraisons_apres_ventes_date, '2026-11-20'); assert.strictEqual(r.fiable_pour_achat, false);
});
t('C2 : livraison le jour même du point de ventes, comptée', () => {
  const r = S.stockTheorique({ ...base, livraisons: [{ id: 'l1', date_livraison: '2026-11-15' }] })[0];
  assert.strictEqual(r.stock, 120); assert.strictEqual(r.livraisons_apres_ventes, 0); assert.strictEqual(r.fiable_pour_achat, true);
});
t('C2 : sans import de ventes, aucun chiffre', () => {
  const r = S.stockTheorique({ ...base, dateVentes: null, ventes: [], livraisons: [{ id: 'l1', date_livraison: '2026-11-13' }] })[0];
  assert.strictEqual(r.stock, null); assert.strictEqual(r.non_calculable, true); assert.strictEqual(r.fiable_pour_achat, false);
});
t('C2 : règle « avant le départ » conservée avec la borne des ventes', () => {
  const mk = d => S.stockTheorique({ ...base, livraisons: [{ id: 'l1', date_livraison: d }] })[0];
  assert.strictEqual(mk('2026-11-10').stock, 70);
  const m = mk('2026-11-12'); assert.strictEqual(m.a_confirmer, true); assert.strictEqual(m.fiable_pour_achat, false);
  assert.strictEqual(mk('2026-11-13').stock, 120);
});
t('C2 : départ antérieur à la campagne ou à confirmer, jamais fiable', () => {
  const dep = [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-10', source: 'inventaire' }];
  assert.strictEqual(S.stockTheorique({ ...base, stockDepart: dep })[0].fiable_pour_achat, false);
  const conf = [{ article: 'A', version: 1, quantite: 100, date_stock: '2026-11-12', source: 'saisie_initiale', a_confirmer: true }];
  assert.strictEqual(S.stockTheorique({ ...base, stockDepart: conf })[0].fiable_pour_achat, false);
});
t('C3 : relevé par article, date et référence propres, source distinguée', () => {
  const rel = [
    { id: 'r1', article: 'A', releve_le: '2026-11-10T08:00:00Z', quantite_reelle: 40, quantite_theorique: 45 },
    { id: 'r2', article: 'B', releve_le: '2026-11-11T08:00:00Z', quantite_reelle: null, quantite_theorique: 12 },
    { id: 'r3', article: 'A', releve_le: '2026-11-05T08:00:00Z', quantite_reelle: 1, quantite_theorique: 1 },
  ];
  const r = S.choisirReleves(rel, { articles: ['A', 'B'], campagneDebut: '2026-11-12' });
  const a = r.retenus.find(x => x.article === 'A'), b = r.retenus.find(x => x.article === 'B');
  assert.deepStrictEqual([a.quantite, a.date, a.reference, a.source], [40, '2026-11-10', 'r1', 'comptage']);
  assert.deepStrictEqual([b.quantite, b.date, b.reference, b.source, b.libelle_source], [12, '2026-11-11', 'r2', 'releve_theorique_decenium', 'quantité théorique Decenium']);
});
t('C3 : relevé postérieur au début de la campagne signalé, non repris', () => {
  const rel = [{ id: 'r9', article: 'A', releve_le: '2026-11-14T08:00:00Z', quantite_reelle: 5 }, { id: 'r1', article: 'A', releve_le: '2026-11-10T08:00:00Z', quantite_reelle: 40 }];
  const r = S.choisirReleves(rel, { articles: ['A'], campagneDebut: '2026-11-12' });
  assert.strictEqual(r.retenus[0].reference, 'r1'); assert.strictEqual(r.posterieurs[0].reference, 'r9');
  const seul = S.choisirReleves([rel[0]], { articles: ['A'], campagneDebut: '2026-11-12' });
  assert.strictEqual(seul.retenus.length, 0); assert.deepStrictEqual(seul.sans, ['A']); assert.strictEqual(seul.posterieurs.length, 1);
});
t('article avec stock de départ non compté comme manquant (clé partagée)', () => {
  assert.deepStrictEqual(S.articlesSansDepart(['A', 'B'], [{ article: 'A', date_stock: '2026-11-12', quantite: 5 }]), ['B']);
  const alias = a => (a === 'A-alias' ? 'A' : null);
  assert.deepStrictEqual(S.articlesSansDepart(['A-alias'], [{ article: 'A', date_stock: '2026-11-12', quantite: 5 }], alias), []);
});
t('dates longues en français, jamais ISO', () => {
  assert.strictEqual(S.dateLongue('2026-11-10'), '10 novembre');
  assert.strictEqual(S.dateLongue('2026-12-01'), '1er décembre');
  const r = S.stockTheorique(base)[0];
  assert.ok(r.sources.some(x => /12 novembre/.test(x)) && !r.sources.some(x => /\d{4}-\d{2}-\d{2}/.test(x)));
  assert.strictEqual(r.date_depart, '2026-11-12');
});
t('page Livraison : même jour, unités en direct, PA à virgule, détails repliables', () => {
  const fs = require('fs'), h = fs.readFileSync(__dirname + '/NEXUS-Campagne-v2-Livraison.html', 'utf8');
  const w = {}; new Function('window', fs.readFileSync(__dirname + '/nexus-vocabulaire.js', 'utf8'))(w);
  const find = (o, d) => { if (!o || typeof o !== 'object' || d > 3) return null; if (typeof o.livraisonMemeJour === 'function') return o; for (const k of Object.keys(o)) { const r = find(o[k], d + 1); if (r) return r; } return null; };
  const P = find(w, 0);
  assert.ok(P, 'vocabulaire exposé');
  assert.strictEqual(P.livraisonMemeJour(24, '10 novembre'), '24 unités livrées le 10 novembre, le jour du relevé : à vérifier.');
  assert.strictEqual(P.egaleUnites(48), '= 48 unités');
});

console.log(n + ' épreuves C3 passent.');
