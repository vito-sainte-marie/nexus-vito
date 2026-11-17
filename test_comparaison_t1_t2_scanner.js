// Comparaison T1 -> T2 sur un jeu commun FICTIF : contrôle T1 (NexusScannerTarifaire.controler) face à l'alerte T2
// (NexusPolitiqueTarifaire.analyser), nombre et montant avant / après. Modules purs, aucune base, aucun réseau.
// Chaque écart est soit un « changement attendu » (ligne de la matrice T1 -> T2), soit une « régression » : toute régression fait échouer l'épreuve.
const assert = require('assert');
globalThis.window = globalThis;
require('./nexus-conseiller.js'); require('./nexus-marge.js'); require('./nexus-produits-mesure.js');
const T1 = require('./nexus-scanner-tarifaire.js');
const T2 = require('./nexus-politique-tarifaire.js');

const periode = { debut: '2030-03-01', fin: '2030-03-30' };
const L = (article, o = {}) => Object.assign({ article, categorie: 'Rayon Alpha', code_barres: 'cb-' + article.replace(/ /g, ''), prix_achat: 1, prix_vente: 2, quantite: 10, tva: 20 }, o);
// Jeu commun : un cas par ligne de la matrice.
const prec = [
  L('Perte justifiee', { prix_achat: 1.2, prix_vente: 1.5 }), L('Perte nue', { prix_achat: 1.2, prix_vente: 1.5 }), L('Marge nulle', { prix_achat: 1, prix_vente: 1.2 }),
  L('Hausse trente', { prix_achat: 1, prix_vente: 2 }), L('Hausse soixante', { prix_achat: 1, prix_vente: 3 }), L('Cout zero', { prix_achat: 1, prix_vente: 2 }),
  L('Hausse repercutee', { prix_achat: 1, prix_vente: 2 }), L('Famille exclue', { categorie: 'Tabac', prix_achat: 5, prix_vente: 6 }),
  L('Contractuel', { prix_achat: 1, prix_vente: 2 }), L('Identite', { code_barres: 'cb-ID', prix_achat: 1, prix_vente: 2 }), L('Ecart mediane', { prix_achat: 1, prix_vente: 1.3 }),
];
const cour = [
  L('Perte justifiee', { prix_achat: 1.2, prix_vente: 1 }), L('Perte nue', { prix_achat: 1.2, prix_vente: 1 }), L('Marge nulle', { prix_achat: 1, prix_vente: 1 }),
  L('Hausse trente', { prix_achat: 1.3, prix_vente: 2 }), L('Hausse soixante', { prix_achat: 1.6, prix_vente: 3 }), L('Cout zero', { prix_achat: 0, prix_vente: 2 }),
  L('Hausse repercutee', { prix_achat: 1.3, prix_vente: 2.6 }), L('Famille exclue', { categorie: 'Tabac', prix_achat: 5.5, prix_vente: 6 }),
  L('Contractuel', { prix_achat: 1.5, prix_vente: 2 }), L('Identite renommee', { code_barres: 'cb-ID', prix_achat: 1.02, prix_vente: 2 }), L('Ecart mediane', { prix_achat: 1, prix_vente: 1.3 }),
];
const justif = [{ article: 'Perte justifiee', motif: 'promotion fictive', valide_le: '2030-03-10', periode_debut: periode.debut, periode_fin: periode.fin }];
const contractuels = new Set(['cb-Contractuel']);
const regimeDe = row => (row.categorie === 'Tabac' ? 'reglemente' : contractuels.has('cb-' + row.article) ? 'contractuel' : null);
const seuilValide = { Alpha: { minimum: 0.4, cible: 0.5, statutMinimum: 'valide', statutCible: 'valide' } };
const ctxT2 = { periode, familles: { parRayon: { 'Rayon Alpha': 'Alpha' }, parReference: [], parMotif: [] }, seuils: seuilValide, regimeDe,
  justifications: [{ article: 'Perte justifiee', motif: 'promotion fictive' }],
  stock: cour.map(r => ({ article: r.article, pa_net_ht: r.prix_achat })) };

const r1 = T1.controler(cour, prec, { periode, natures: [], justifications: justif, contractuels });
const r2 = T2.analyser(cour, prec, ctxT2);

const eur = v => Math.round((v || 0) * 100) / 100;
const noms1 = f => r1.lignes.filter(f).map(l => l.article).sort();
const noms2 = code => r2.lignes.filter(l => (l.alertes || []).some(a => a.code === code)).map(l => l.article).sort();
const mnt2 = code => eur(r2.lignes.reduce((s, l) => s + ((((l.alertes || []).find(a => a.code === code) || {}).consequence || {}).montant || 0), 0));
const lignesT1 = [
  { cle: 'Ventes à perte', t1: noms1(l => l.perte), m1: eur(r1.lignes.reduce((s, l) => s + (l.perte ? l.perte.montant : 0), 0)), t2: noms2('A3'), m2: mnt2('A3') },
  { cle: 'Coût suspect / variation anormale', t1: noms1(l => l.suspect), m1: null, t2: noms2('A4'), m2: mnt2('A4') },
  { cle: 'Hausse de coût non répercutée', t1: noms1(l => l.hausse && l.prix_type === 'libre'), m1: eur(r1.lignes.reduce((s, l) => s + (l.hausse && l.prix_type === 'libre' ? l.hausse.impact : 0), 0)), t2: noms2('A1'), m2: mnt2('A1') },
  { cle: 'Références à vérifier (identité, PA = PV)', t1: noms1(l => l.a_verifier), m1: null, t2: noms2('A5'), m2: null },
  { cle: 'Prix réglementés', t1: noms1(l => l.prix_type === 'reglemente'), m1: eur(r1.lignes.reduce((s, l) => s + (l.prix_type === 'reglemente' && l.hausse ? l.hausse.impact : 0), 0)), t2: noms2('A8'), m2: mnt2('A8') },
];
const fmt = a => (a.length ? a.join(', ') : '—');
const tableau = ['| Contrôle T1 | T1 nb | T1 montant | Alerte T2 nb | T2 montant | Références T1 | Références T2 |', '|---|---:|---:|---:|---:|---|---|']
  .concat(lignesT1.map(x => `| ${x.cle} | ${x.t1.length} | ${x.m1 === null ? 'n.d.' : x.m1} | ${x.t2.length} | ${x.m2 === null ? 'n.d.' : x.m2} | ${fmt(x.t1)} | ${fmt(x.t2)} |`));
console.log(tableau.join('\n'));

// ---- Classement des écarts : chaque (contrôle, référence, sens) doit figurer ici avec sa ligne de matrice, sinon c'est une régression. ----
const ATTENDU = {
  'Ventes à perte|+Marge nulle': 'marge nulle comptée à part dans A3, montant 0 (ligne « vente à marge négative ou nulle »)',
  'Coût suspect / variation anormale|-Hausse trente': 'variation de 30 % : plus d\'alerte A4, fiabilité « à confirmer » et A1/A2 conservées (A4 réservée aux variations anormales)',
  'Coût suspect / variation anormale|-Hausse repercutee': 'hausse répercutée de 30 % : plus d\'alerte A4, fiabilité « à confirmer » (aucun montant en jeu)',
  'Hausse de coût non répercutée|+Contractuel': 'contractuel : A1 conservée en information, le régime est porté par le badge « Régime à vérifier »',
  'Hausse de coût non répercutée|+Famille exclue': 'famille exclue : A1 conservée en information, le régime est porté par le badge « Régime à vérifier »',
  'Références à vérifier (identité, PA = PV)|-Marge nulle': 'PA = PV : devient A3 (marge nulle), plus un « à vérifier » distinct',
  'Prix réglementés|-Famille exclue': 'prix réglementé : suivi par le régime et A1, A8 réservée aux contrôles réglementaires ouverts',
};
const regressions = [], attendus = [];
const diffs = [];
lignesT1.forEach(x => {
  x.t1.filter(n => !x.t2.includes(n)).forEach(n => diffs.push([x.cle, '-' + n]));
  x.t2.filter(n => !x.t1.includes(n)).forEach(n => diffs.push([x.cle, '+' + n]));
});
// Les références renommées (identité) sont rapprochées par code-barres : T1 les nomme « Identite renommee », idem T2.
diffs.forEach(([cle, ref]) => { const k = cle + '|' + ref; (ATTENDU[k] ? attendus : regressions).push(ATTENDU[k] ? `${cle} / ${ref} : changement attendu — ${ATTENDU[k]}` : `${cle} / ${ref} : RÉGRESSION`); });
console.log('\nÉcarts :'); attendus.concat(regressions).forEach(l => console.log(' -', l));
// Montants : les pertes de T1 et de T2 doivent être identiques (le moteur ne change pas la mesure).
assert.strictEqual(lignesT1[0].m1, lignesT1[0].m2, 'montant des ventes à perte T1 = T2');
// T2 ne perd aucune perte de T1, et ne compte aucun gain dans A3.
assert.ok(lignesT1[0].t1.every(n => lignesT1[0].t2.includes(n)), 'toute vente à perte T1 reste une alerte A3');
assert.deepStrictEqual(regressions, [], 'aucune régression : ' + regressions.join(' ; '));
console.log('OK : ' + attendus.length + ' changements attendus, 0 régression.');
