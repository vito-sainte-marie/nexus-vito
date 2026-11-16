// P1-D : vues « à revoir » et « stocks et couverture » (module pur, aucune mesure nouvelle).
const assert = require('assert'), fs = require('fs'), path = require('path');
const V = require('./nexus-produits-vues.js');
const st = (q, cj, extra = {}) => ({ disponible: true, quantite: q, date: '2026-11-10', valeur_pmp: q * 1.24, ventes_par_jour: cj ? q / cj : null, couverture_jours: cj, donnees_anciennes: false, ...extra });
const mk = (article, o = {}) => ({ m: { categorie: 'R', marge_totale: { valeur: o.marge === undefined ? 5 : o.marge }, stock: o.stock || { disponible: false }, qualificationCle: o.qual, marge_negative: o.neg, nature: { cle: o.nature || 'produit_commercial' }, exclue_indicateurs: o.caisse, quantite_possiblement_en_euros: o.euros, tva: { etat: o.tva || 'importee' } }, row: { article, ca: o.ca || 10, marge: 5, quantite: 1 } });
const entries = V.preparer([
  mk('Pringles', { stock: st(9, 13) }), mk('Smirnoff Ice', { stock: st(28, 9.7) }),
  mk('Glaçons Vito', { stock: st(-3, null) }), mk('PCS Creacard', { stock: st(5, null), caisse: true }),
  mk('Sans relevé'), mk('Marge neg', { neg: true, marge: -4 }), mk('Étudier', { qual: 'a_etudier' }),
  mk('Ancien', { stock: st(2, 4, { donnees_anciennes: true }) }), mk('Ident', { nature: 'a_identifier', tva: 'incoherente' }),
]);
const s = V.stocks(entries, e => e.article === 'Pringles' ? null : null);
assert.deepStrictEqual(s.lignes.map(e => e.article).slice(0, 3), ['Ancien', 'Smirnoff Ice', 'Pringles'], 'tri par couverture croissante');
assert.strictEqual(s.lignes[s.lignes.length - 1].article, 'PCS Creacard');
assert.ok(s.lignes.find(e => e.article === 'PCS Creacard').sansObjet, 'Creacard : couverture sans objet');
assert.deepStrictEqual(s.nuls.map(e => e.article), ['Glaçons Vito']);
assert.ok(!s.lignes.some(e => e.stock.quantite <= 0), 'aucun stock ≤ 0 dans la liste');
assert.strictEqual(s.sansReleve, 4);
assert.strictEqual(s.nbAvecReleve, 5);
assert.strictEqual(s.date, '2026-11-10');
const c = V.stocks(entries, e => e.article === 'Pringles' ? { quantite: 7, compte_le: '2026-11-01' } : null);
assert.strictEqual(c.lignes.find(e => e.article === 'Pringles').comptage.quantite, 7);
assert.strictEqual(s.lignes.find(e => e.article === 'Pringles').comptage, null);
const r = V.aRevoir(entries, e => e.article === 'Smirnoff Ice' ? { cle: 'surveiller', niveau: 'a-verifier', label: 'À surveiller' } : null);
assert.deepStrictEqual(r.negatives.map(e => e.article), ['Marge neg']);
assert.deepStrictEqual(r.statuts.map(e => e.article), ['Smirnoff Ice']);
assert.deepStrictEqual(r.aEtudier.map(e => e.article), ['Étudier']);
assert.strictEqual(r.nbAIdentifier, 1); assert.strictEqual(r.nbTvaAVerifier, 1);
// Aucun mot interdit dans la vue Stocks de la page.
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');
const bloc = html.slice(html.indexOf("cle === 'stocks'"), html.indexOf("} else {\n      const v = window.NexusProduitsVues.marges"));
assert.ok(bloc.length > 500 && !/rupture|rapide|maîtris/i.test(bloc), 'mot interdit dans la vue stocks');
assert.ok(/stock théorique Decenium/.test(bloc) && /pas de comptage physique/.test(bloc) && /non interprété/i.test(bloc));
// Recette Guardian : Glaçons à 0, PCS négatif, Monster 1 u. à 3,08 u./jour, quantité en euros, à identifier.
const g = V.preparer([
  mk('Glaçons Vito', { stock: st(0, null) }),
  mk('PCS Creacard 20 à 199', { stock: st(-2340, -12), euros: true }),
  mk('Monster Viking Berry', { stock: st(1, 0.3) }),
  mk('Jeton Lavazza', { stock: st(40, 10), euros: true }),
  mk('Inconnu', { nature: 'a_identifier', stock: st(30, 6) }),
]);
const gs = V.stocks(g, null);
assert.deepStrictEqual(gs.nuls.map(e => e.article).sort(), ['Glaçons Vito', 'PCS Creacard 20 à 199']);
assert.ok(gs.lignes.find(e => e.article === 'Jeton Lavazza').sansObjet, 'quantité en euros : sans objet même à stock positif');
assert.ok(gs.lignes.find(e => e.article === 'Inconnu').sansObjet, 'à identifier : sans objet');
assert.ok(!gs.lignes.find(e => e.article === 'Monster Viking Berry').sansObjet);
assert.strictEqual(V.couvertureLibelle(0.3), "couverture : moins d'1 j");
assert.strictEqual(V.couvertureLibelle(0), "couverture : moins d'1 j");
assert.strictEqual(V.couvertureLibelle(13), 'couverture ≈ 13 j');
assert.ok(!/≈ 0 j/.test(V.couvertureLibelle(0.3)));
// Le bloc nul/négatif n'affiche ni valeur PMP ni couverture.
const ln = html.slice(html.indexOf('const ligneNul'), html.indexOf('corps.innerHTML', html.indexOf('const ligneNul')));
assert.ok(ln.length > 100 && !/PMP|couverture|valeur_pmp|couverture_jours/.test(ln), 'ligneNul : ni PMP ni couverture');
console.log('OK  P1-D vues pures et libellés');
