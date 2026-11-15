// Produits P1-A : classement financier, éligibilité, position du taux, qualification, confirmation, stock théorique.
// Fixtures avec les chiffres réels de la simulation 3 (05/10 au 09/11, 36 jours, 844 références à marge positive).
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let n = 0;
const t = (nom, f) => { f(); n++; console.log('OK ' + nom); };
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const sb = { console };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
['nexus-conseiller.js', 'nexus-marge.js', 'nexus-produits-mesure.js'].forEach(f => vm.runInContext(lire(f), sb, { filename: f }));
const M = sb.NexusProduitsMesure;
const S = sb.NexusConseiller.SEUILS_PRODUITS_MESURE;

t('les seuils sont des constantes nommées et exportées', () => {
  assert.deepStrictEqual(Object.assign({}, S), { partContributionForte: 0.2, partContributionFaible: 0.2, joursParUniteMinimale: 7, minReferencesRayon: 8, ecartMinQuartilesPoints: 3, margeAutourQuartilePoints: 1, joursStockAncien: 30 });
});

const DEBUT = '2026-10-05', FIN = '2026-11-09';
const ligne = (article, categorie, marge, quantite, ca, extra) => Object.assign({ site: 'vito', periode_debut: DEBUT, periode_fin: FIN, categorie, article, code_barres: null, quantite, prix_achat: 1, prix_vente: 2, tva: 20, ca, marge }, extra || {});
const taux = (cat, art, t, marge, qte) => ligne(art, cat, marge, qte, marge / (t / 100));

// Références nommées : (nom, rayon, marge, unités, taux)
function jeu() {
  const rows = [];
  const nommees = [
    ['Gaz bleu 12,5 kg', 'Gaz', 1478.89, 150, 6],
    ['Heineken 50 cl', 'Bières', 1075.98, 900, 49.69],
    ['Heineken 25 cl', 'Bières', 693.24, 900, 50.0],
    ['Jeton Lavazza 1,60 €', 'Machine à café', 514.5, 300, 90],
    ['Glaçons Vito 5 kg', 'Glaçons', 501.48, 200, 60],
    ['Smirnoff Ice 275 ml', 'Bières', 213.2, 104, 54.23],
    ['Transcash 212', 'Transcash', 171.6, 60, 5],
    ['Falcon X JNR', 'Accessoires', 58.12, 4, 60],
    ['Pringles Origl 40g', 'Snacking', 21.5, 25, 40.95],
  ];
  nommees.forEach(([a, c, m, q, tx]) => rows.push(taux(c, a, tx, m, q)));
  // Remplissage pour atteindre les rangs réels : 844 références à marge positive.
  // Bandes entre les références nommées (rang 3, 5 à 7, 10 à 37, 39 à 53, 55 à 168, 170 à 372, 374 à 844).
  const bandes = [[1, 1075.98, 693.24], [3, 693.24, 514.5], [28, 501.48, 213.2], [15, 213.2, 171.6], [114, 171.6, 58.12], [203, 58.12, 21.5], [452, 20.3, 0.5]];
  let k = 0;
  bandes.forEach(([nb, haut, bas]) => {
    for (let i = 1; i <= nb; i++) {
      const m = Math.round((haut - (haut - bas) * i / (nb + 1)) * 100) / 100;
      k++;
      rows.push(taux('Confiserie', 'Remplissage ' + String(k).padStart(3, '0'), 45 + (k % 7), m, 50));
    }
  });
  // Rayon Bières : dix références de plus, taux 46,0 à 51,5 (P25 proche de 47,5, P75 proche de 50,9).
  const taBieres = [46.0, 46.8, 47.4, 47.9, 48.7, 49.3, 50.2, 50.9, 51.3, 51.5];
  taBieres.forEach((tx, i) => rows.push(taux('Bières', 'Bière remplissage ' + (i + 1), tx, 20.6 + i * 0.01, 40)));
  // Rayon Snacking : neuf références de plus autour de 44 à 56 %.
  [44, 46, 47, 48, 50, 51, 52, 54, 56].forEach((tx, i) => rows.push(taux('Snacking', 'Snack remplissage ' + (i + 1), tx, 20.4 + i * 0.01, 30)));
  // Marges négative et nulle, hors classement.
  rows.push(ligne('Marge négative', 'Confiserie', -3, 10, 20));
  rows.push(ligne('Marge nulle', 'Confiserie', 0, 10, 20));
  return rows;
}

const rows = jeu();
const positives = rows.filter(r => r.marge > 0).length;
const res = M.classer(rows, DEBUT, FIN);
const par = nom => res.resultats[rows.findIndex(r => r.article === nom)];

t('36 jours inclus du 05/10 au 09/11, minimum 5 unités', () => {
  assert.strictEqual(M.jours(DEBUT, FIN), 36);
  assert.strictEqual(res.resume.seuilUnites, 5);
});
t('le dénominateur compte les références à marge positive seulement', () => {
  assert.strictEqual(res.resume.referencesMargePositive, positives);
  assert.strictEqual(par('Marge négative').rang, null);
  assert.strictEqual(par('Marge négative').qualification, 'marge_negative');
  assert.strictEqual(par('Marge nulle').qualification, 'sans_qualification');
});
t('forts contributeurs : 20 % supérieurs de la marge, arrondi au rang supérieur', () => {
  assert.strictEqual(res.resume.nbForts, Math.ceil(0.2 * positives));
});
t('rangs de référence : Gaz 1, Heineken 50 cl 2, Heineken 25 cl 4, Lavazza 8, Glaçons 9', () => {
  assert.strictEqual(par('Gaz bleu 12,5 kg').rang, 1);
  assert.strictEqual(par('Heineken 50 cl').rang, 2);
  assert.strictEqual(par('Heineken 25 cl').rang, 4);
  assert.strictEqual(par('Jeton Lavazza 1,60 €').rang, 8);
  assert.strictEqual(par('Glaçons Vito 5 kg').rang, 9);
});
t('rangs de référence : Smirnoff Ice 38, Transcash 54, Falcon 169, Pringles 373', () => {
  assert.strictEqual(par('Smirnoff Ice 275 ml').rang, 38);
  assert.strictEqual(par('Transcash 212').rang, 54);
  assert.strictEqual(par('Falcon X JNR').rang, 169);
  assert.strictEqual(par('Pringles Origl 40g').rang, 373);
});
t('le jeu réel a 844 références à marge positive et 169 forts contributeurs', () => {
  assert.strictEqual(positives, 844);
  assert.strictEqual(res.resume.nbForts, 169);
  assert.strictEqual(res.resume.seuilMargeFort, 58.12);
});
t('Smirnoff Ice : taux 54,23 % haut, produit moteur', () => {
  const r = par('Smirnoff Ice 275 ml');
  assert.strictEqual(r.position, 'haut');
  assert.strictEqual(r.qualification, 'moteur');
  assert.ok(Math.abs(r.taux - 54.23) < 0.01);
});
t('Heineken 50 cl et 25 cl : taux intermédiaire, produits moteurs', () => {
  assert.strictEqual(par('Heineken 50 cl').position, 'intermediaire');
  assert.strictEqual(par('Heineken 50 cl').qualification, 'moteur');
  assert.strictEqual(par('Heineken 25 cl').position, 'intermediaire');
  assert.strictEqual(par('Heineken 25 cl').qualification, 'moteur');
});
t('Gaz bleu et Transcash : prix imposé, fort contributeur au taux non comparable', () => {
  ['Gaz bleu 12,5 kg', 'Transcash 212'].forEach(a => {
    assert.strictEqual(par(a).qualification, 'fort_taux_non_comparable');
    assert.strictEqual(par(a).raison, 'prix_impose');
  });
});
t('Lavazza et Glaçons : moins de 8 références, fort contributeur', () => {
  ['Jeton Lavazza 1,60 €', 'Glaçons Vito 5 kg'].forEach(a => {
    assert.strictEqual(par(a).qualification, 'fort_taux_non_comparable');
    assert.strictEqual(par(a).raison, 'peu_de_references');
  });
});
t('Pringles : taux bas, contribution moyenne, aucune qualification', () => {
  const r = par('Pringles Origl 40g');
  assert.strictEqual(r.position, 'bas');
  assert.strictEqual(r.qualification, 'sans_qualification');
});
t('Falcon X JNR : 4 unités, non éligible, fort contributeur à ventes peu fréquentes, rang conservé', () => {
  const r = par('Falcon X JNR');
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.qualification, 'fort_ventes_peu_frequentes');
  assert.strictEqual(r.rang, 169);
  assert.strictEqual(r.position, null);
});
t('un rayon à taux uniforme n\'est pas comparable', () => {
  const u = [];
  for (let i = 0; i < 10; i++) u.push(taux('Uniforme', 'U' + i, 50 + i * 0.1, 100 - i, 40));
  const r = M.classer(u, DEBUT, FIN);
  assert.strictEqual(r.resultats[0].raison, 'taux_uniforme');
  assert.strictEqual(r.resultats[0].position, null);
});
t('faible contribution : taux bas = à étudier, taux haut = bon taux, faible contribution ; aucune suppression recommandée', () => {
  const r = M.classer(rows, DEBUT, FIN);
  const cles = new Set(r.resultats.map(x => x.qualification));
  ['a_etudier', 'faible_contribution', 'bon_taux_faible'].forEach(c => assert.ok(M.QUALIFICATIONS[c], c));
  Object.keys(M.QUALIFICATIONS).forEach(c => assert.ok(!/supprim|retir|d[ée]r[ée]f/i.test(M.QUALIFICATIONS[c]), c));
  assert.ok(cles.size > 3);
});

// Mesure complète : valeurs, provenance, confirmation, stock.
const releves = [
  { categorie: 'Snacking', article: 'Pringles Origl 40g', code_barres: null, quantite_theorique: 9, quantite_reelle: null, releve_le: '2026-11-10' },
  { categorie: 'Bières', article: 'Smirnoff Ice 275 ml', code_barres: null, quantite_theorique: 28, quantite_reelle: null, releve_le: '2026-11-10' },
  { categorie: 'Glaçons', article: 'Glaçons Vito 5 kg', code_barres: null, quantite_theorique: 0, quantite_reelle: null, releve_le: '2026-11-10' },
];
// Période précédente : Gaz bleu avec un double espace, Smirnoff Ice déjà moteur.
const rowsPrec = jeu().map(r => Object.assign({}, r, { periode_debut: '2026-08-31', periode_fin: '2026-10-04' }));
rowsPrec.find(r => r.article === 'Gaz bleu 12,5 kg').article = 'Gaz bleu  12,5 kg';
const out = M.mesurer({ products: rows, site: 'vito', periodeDebut: DEBUT, periodeFin: FIN, precedent: { rows: rowsPrec, debut: '2026-08-31', fin: '2026-10-04' }, stockReleves: releves, dateReference: '2026-11-10' });
const mes = nom => out.index.get(M.normaliserNom(nom));

t('Pringles : marge unitaire 0,86 €, TTC 2,10 €, rang 373 sur 844, stock 9 u. au 10/11 valorisé 11,16 €', () => {
  const p = ligne('Pringles Origl 40g', 'Snacking', 21.5, 25, 52.5, { prix_achat: 1.24, prix_vente: 2.1, tva: 0 });
  const rr = rows.map(x => x.article === p.article ? p : x);
  const o = M.mesurer({ products: rr, site: 'vito', periodeDebut: DEBUT, periodeFin: FIN, stockReleves: releves, dateReference: '2026-11-10' });
  const m = o.index.get('Pringles Origl 40g');
  assert.ok(Math.abs(m.marge_unitaire.valeur - 0.86) < 1e-9);
  assert.strictEqual(m.pv_ttc.valeur, 2.1);
  assert.strictEqual(m.rang.valeur, 373);
  assert.strictEqual(m.rang.sur, 844);
  assert.strictEqual(m.stock.quantite, 9);
  assert.strictEqual(m.stock.date, '2026-11-10');
  assert.strictEqual(m.stock.valeur_pmp, 11.16);
  assert.ok(Math.abs(m.stock.couverture_jours - 12.96) < 0.05, 'couverture ' + m.stock.couverture_jours);
  assert.strictEqual(m.stock.fiabilite, 'theorique');
});
t('TVA vide : TTC non disponible ; TVA 20 % : HT x 1,2', () => {
  const a = ligne('A', 'X', 10, 10, 20, { prix_vente: 2, tva: null });
  const b = ligne('B', 'X', 10, 10, 20, { prix_vente: 2, tva: 20 });
  const o = M.mesurer({ products: [a, b], site: 'vito', periodeDebut: DEBUT, periodeFin: FIN });
  assert.strictEqual(o.mesures[0].pv_ttc.valeur, null);
  assert.strictEqual(o.mesures[0].pv_ttc.mention, 'TTC non disponible');
  assert.strictEqual(o.mesures[1].pv_ttc.valeur, 2.4);
});
t('chaque valeur porte valeur, source, période, fiabilité et site', () => {
  const m = mes('Smirnoff Ice 275 ml');
  ['pmp', 'pv_ht', 'pv_ttc', 'marge_unitaire', 'marge_totale', 'taux_marque', 'rang', 'part_marge_rayon', 'part_ca_rayon', 'position_taux'].forEach(k => {
    ['valeur', 'source', 'periode_debut', 'periode_fin', 'fiabilite', 'site'].forEach(c => assert.ok(c in m[k], k + '.' + c));
    assert.strictEqual(m[k].site, 'vito');
  });
  assert.ok(/estimée au PMP du 2026-11-09/.test(m.marge_totale.source));
});
t('Smirnoff Ice : qualification confirmée, avec les durées des deux périodes', () => {
  const c = mes('Smirnoff Ice 275 ml').confirmation;
  assert.strictEqual(c.disponible, true);
  assert.strictEqual(c.qualification_confirmee, true);
  assert.strictEqual(c.forte_contribution_confirmee, true);
  assert.strictEqual(c.duree_actuelle_jours, 36);
  assert.strictEqual(c.duree_precedente_jours, 35);
});
t('Gaz bleu : reconnu malgré le double espace, forte contribution confirmée', () => {
  const m = mes('Gaz bleu 12,5 kg');
  assert.strictEqual(m.confirmation.disponible, true);
  assert.strictEqual(m.confirmation.forte_contribution_confirmee, true);
});
t('un nom en collision (deux références, même nom normalisé) ne fusionne rien', () => {
  const a = ligne('Café  noir', 'X', 10, 10, 20), b = ligne('Café noir', 'X', 9, 10, 20);
  const p = [ligne('Café noir', 'X', 10, 10, 20)];
  const o = M.mesurer({ products: [a, b], site: 'vito', periodeDebut: DEBUT, periodeFin: FIN, precedent: { rows: p, debut: '2026-08-31', fin: '2026-10-04' } });
  assert.strictEqual(o.mesures[0].confirmation.disponible, false);
  assert.strictEqual(o.mesures[1].confirmation.disponible, false);
  assert.strictEqual(o.index.size, 0);
});
t('forte contribution confirmée mais profil du taux changé : jamais « moteur confirmé »', () => {
  const prec = jeu().map(r => Object.assign({}, r, { periode_debut: '2026-08-31', periode_fin: '2026-10-04' }));
  const s = prec.find(r => r.article === 'Smirnoff Ice 275 ml');
  s.ca = s.marge / 0.40; // taux 40 % : bas, donc moteur par le volume
  const o = M.mesurer({ products: rows, site: 'vito', periodeDebut: DEBUT, periodeFin: FIN, precedent: { rows: prec, debut: '2026-08-31', fin: '2026-10-04' } });
  const c = o.index.get('Smirnoff Ice 275 ml').confirmation;
  assert.strictEqual(c.forte_contribution_confirmee, true);
  assert.strictEqual(c.qualification_confirmee, false);
});
t('Glaçons Vito : stock théorique 0 daté, jamais une rupture certaine', () => {
  const m = mes('Glaçons Vito 5 kg');
  assert.strictEqual(m.stock.quantite, 0);
  assert.strictEqual(m.stock.date, '2026-11-10');
  const txt = JSON.stringify(m.explication) + M.phrase(m);
  assert.ok(!/rupture/i.test(txt));
});
t('stock de plus de 30 jours : données anciennes', () => {
  const o = M.mesurer({ products: rows, site: 'vito', periodeDebut: DEBUT, periodeFin: FIN, stockReleves: [{ article: 'Heineken 50 cl', quantite_theorique: 5, releve_le: '2026-09-01' }], dateReference: '2026-11-10' });
  assert.strictEqual(o.index.get('Heineken 50 cl').stock.donnees_anciennes, true);
});
t('phrase du Conseiller : courte, factuelle, sans adjectif de rentabilité', () => {
  assert.strictEqual(M.phrase(mes('Gaz bleu 12,5 kg')), 'Fort contributeur de la boutique, taux non comparable (prix imposé).');
  Object.keys(M.QUALIFICATIONS).forEach(c => {
    const p = M.phrase({ qualificationCle: c, position_taux: { valeur: 'haut', raison: null } });
    assert.ok(!/très rentable|rotation rapide|stock maîtrisé|rentable/i.test(p), c);
  });
});
t('l\'explication se termine par la mention du PMP exporté', () => {
  const e = mes('Smirnoff Ice 275 ml').explication;
  assert.strictEqual(e[e.length - 1], 'Marge calculée avec le PMP exporté par Decenium, arrondi à deux décimales.');
  assert.ok(e.some(l => /Rang 38 sur 844/.test(l)));
});
t('le module est pur : aucun réseau ni accès au stockage', () => {
  const src = lire('nexus-produits-mesure.js').replace(/\/\/.*$/gm, '');
  assert.ok(!/fetch\(|XMLHttpRequest|supabase|localStorage|document\./.test(src));
});

console.log('\n' + n + ' tests passent.');
