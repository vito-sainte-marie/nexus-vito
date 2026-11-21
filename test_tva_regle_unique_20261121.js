// Une seule source pour les décisions de TVA du pilote par rayon (18/11/2026) : accueil Produits, Mes produits et Scanner.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
['nexus-conseiller.js', 'nexus-marge.js', 'nexus-tva-regles-pilote.js', 'nexus-produits-mesure.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sb, { filename: f }));
const M = sb.NexusProduitsMesure;
const R = require('./nexus-tva-regles-pilote.js');
const P = require('./nexus-politique-tarifaire.js');
const E = require('./nexus-politique-tarifaire-ecran.js');
let n = 0;
function ok(c, m) { assert.ok(c, m); n++; }
const D = '2026-11-01', F = '2026-11-30', PILOTE = 'vito-sainte-marie';

// Une référence par rayon décidé le 18/11, plus un pair taxé dans le rayon (sinon le contrôle de rayon ne se déclenche pas).
const CAS = [
  ['Cartes prépayées', 'Carte Haïti 5', 0],
  ['Cigarettes', 'Marlboro rouge', 0],
  ['Cigares', 'Cigare Corona', 0],
  ['Tabac à rouler - 30g', 'Drum 30g', 0],
  ['Gaz', 'Gaz bleu 12,5 kg', 0],
  ['Cartes prépayées', 'Recharge Orange 10', 8.5],
  ['Cartes prépayées', 'Recharge Digicel Jamaïque', 8.5]
];
const ligne = (cat, art, tva, extra) => Object.assign({ site: PILOTE, periode_debut: D, periode_fin: F, categorie: cat, article: art, code_barres: null, quantite: 5, prix_achat: 6, prix_vente: 10, tva, ca: 50, marge: 20 }, extra || {});
const pairs = [...new Set(CAS.map(c => c[0]))].map(c => ligne(c, 'Pair taxé ' + c, 20));
const lot = CAS.map(c => ligne(c[0], c[1], c[2])).concat(pairs);

const mesure = (rows, site, conf) => M.mesurer({ products: rows.map(r => Object.assign({}, r, { site })), site, periodeDebut: D, periodeFin: F, tvaConfirmations: conf || [], dateReference: '2026-11-20' });
const etatM = (o, art) => o.index.get(M.normaliserNom(art)).tva;
const scanner = (rows, site, conf) => {
  const ctx = E.construireContexteTarif({ site, periode: { debut: D, fin: F }, declarations: { produits_tva_confirmations: conf || [] } });
  return P.analyser(rows.map(r => Object.assign({}, r, { site })), [], ctx);
};
const etatS = (a, art) => a.lignes.find(l => l.article === art).tva;

// 1. Les règles sont une donnée unique, datée et sourcée
ok(R.SITE_PILOTE === PILOTE, 'site pilote');
ok(R.TVA_CONFIRMATIONS_PILOTE.length === 7, 'sept règles');
ok(R.TVA_CONFIRMATIONS_PILOTE.every(r => r.source === 'pilote, 18/11/2026' && r.confirme_le === '2026-11-18'), 'source et date sur chaque règle');
ok(E.construireContexteTarif({ site: PILOTE, periode: { debut: D, fin: F } }).tva.confirmations.length === 7, 'le Scanner lit les mêmes règles');

// 2. Cinq rayons : confirmée dans la mesure ET dans le Scanner
const om = mesure(lot, PILOTE), as = scanner(lot, PILOTE);
CAS.forEach(([cat, art, t]) => {
  const m = etatM(om, art), s = etatS(as, art);
  ok(m.etat === 'confirmee' && m.taux_retenu === t, 'mesure confirmée : ' + art + ' (' + m.etat + ')');
  ok(s.etat !== 'a_verifier', 'Scanner non à vérifier : ' + art + ' (' + s.etat + ')');
  ok(m.confirmation.source === 'pilote, 18/11/2026', 'source portée : ' + art);
  ok(/le 18\/11\/2026/.test(m.raison) && !/le\s*$/.test(m.raison), 'libellé daté : ' + m.raison);
});

// 3. Autre site : aucune règle héritée (la mesure et le Scanner sortent du même rayon, sans confirmation)
const autre = mesure(lot, 'autre-site'), autreS = scanner(lot, 'autre-site');
ok(etatM(autre, 'Marlboro rouge').etat === 'incoherente', 'autre site : à vérifier dans la mesure');
ok(etatS(autreS, 'Marlboro rouge').etat === 'a_verifier', 'autre site : à vérifier dans le Scanner');
ok((((E.construireContexteTarif({ site: 'autre-site', periode: { debut: D, fin: F } }).tva || {}).confirmations) || []).length === 0, 'autre site : aucune règle dans le contexte');

// 4. Le registre passe avant la règle de rayon : Rizla confirmé à 8,5 sous Tabac à rouler reste à 8,5
const rizla = ligne('Tabac à rouler - 30g', 'Rizla regular', 8.5);
const reg = [{ id: 'r1', site: PILOTE, article: 'Rizla regular', code_barres: '', taux_confirme: 8.5, confirme_le: '2026-11-21T10:00:00Z', confirme_par: 'x', annule_le: null, remplace_id: null }];
const lotR = lot.concat([rizla]);
const mr = etatM(mesure(lotR, PILOTE, reg), 'Rizla regular');
ok(mr.etat === 'confirmee' && mr.taux_retenu === 8.5 && mr.confirmation.taux === 8.5, 'registre gagne dans la mesure');
const sr = etatS(scanner(lotR, PILOTE, reg), 'Rizla regular');
ok(sr.etat !== 'a_verifier' && sr.taux === 8.5, 'registre gagne dans le Scanner');
// Sans registre, la règle de rayon (0 %) contredit l'export à 8,5 % : la référence reste à vérifier des deux côtés
ok(etatM(mesure(lotR, PILOTE), 'Rizla regular').etat === 'incoherente', 'sans registre : à vérifier dans la mesure');
ok(etatS(scanner(lotR, PILOTE), 'Rizla regular').etat === 'a_verifier', 'sans registre : à vérifier dans le Scanner');

// 5. Parité : même nombre de « TVA à vérifier » sur un lot mêlant confirmées, contredites et hors rayons
const hors = [ligne('Snacking', 'Chips sel', 0), ligne('Snacking', 'Chips taxé', 20)];
const lotP = lotR.concat(hors);
[PILOTE, 'autre-site'].forEach(site => {
  const a = lotP.filter(() => true), nm = mesure(a, site), ns = scanner(a, site);
  const cm = nm.mesures.filter(x => x.tva && x.tva.etat === 'incoherente').map(x => x.article).sort();
  const cs = ns.lignes.filter(l => l.tva && l.tva.etat === 'a_verifier').map(l => l.article).sort();
  assert.deepStrictEqual(cm, cs, 'parité ' + site); n++;
  ok(site !== PILOTE || cm.filter(x => !/^Pair taxé /.test(x)).join('|') === ['Chips sel', 'Rizla regular'].join('|'), 'pilote : hors pairs taxés (qui contredisent la règle), restent Chips sel (hors rayons) et Rizla (contredit) : ' + cm);
});

console.log('test_tva_regle_unique_20261121 : ' + n + ' vérifications OK');
