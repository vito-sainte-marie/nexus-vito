// P1-C : trois vues (Mes produits, Mes meilleures ventes, Mes marges) alimentées par NexusProduitsMesure.mesurer.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let n = 0;
const t = (nom, f) => { f(); n++; console.log('OK ' + nom); };
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const sb = { console }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
['nexus-conseiller.js', 'nexus-marge.js', 'nexus-produits-mesure.js', 'nexus-produits-vues.js'].forEach(f => vm.runInContext(lire(f), sb, { filename: f }));
const M = sb.NexusProduitsMesure, V = sb.NexusProduitsVues, NM = sb.NexusMarge;
const D = '2026-10-05', F = '2026-11-09';
const L = (article, cat, marge, qte, ca, x) => Object.assign({ site: 'vito', periode_debut: D, periode_fin: F, categorie: cat, article, code_barres: null, quantite: qte, prix_achat: 1, prix_vente: ca / qte, tva: 20, ca, marge }, x || {});
const rows = () => [
  L('Gaz bleu 12,5 kg', 'Gaz', 1478.89, 300, 15023.01),
  L('Heineken 50 cl', 'Bières', 1075.98, 900, 4000),
  L('Coca-Cola 50 cl', 'Softs', 892.71, 800, 3000),
  L('Pringles', 'Snacking', 21.5, 25, 52.5),
  L('HARIBO', 'Confiserie', -20.02, 40, 80),
  L('ACOMPTE', 'Divers', 470, 1, 470),
];
const natures = [{ id: 'n', article: 'ACOMPTE', nature: 'operation_caisse', declare_le: '2026-11-15T10:00:00Z' }];
const prep = (extra) => {
  const r = rows();
  const res = M.mesurer(Object.assign({ products: r, site: 'vito', periodeDebut: D, periodeFin: F }, extra || {}));
  return { res, entries: V.preparer(res.mesures.map((m, k) => ({ m, row: r[k] })), NM.familleMarge) };
};

t('Mes produits : tri par CA, somme des CA = CA analytique, caisse exclue et signalée', () => {
  const { res, entries } = prep({ natures });
  const v = V.produits(entries, {});
  assert.strictEqual(v.lignes[0].article, 'Gaz bleu 12,5 kg');
  assert.ok(!v.lignes.some(e => e.article === 'ACOMPTE'));
  assert.strictEqual(v.caisses.length, 1);
  assert.strictEqual(v.caisses[0].ca, 470);
  assert.ok(Math.abs(v.ca - res.resume.synthese.ca_analytique) < 0.005 || res.resume.synthese === undefined, 'CA vue = CA analytique');
});
t('Sans déclaration, ACOMPTE est exclu par la règle NEXUS', () => {
  const { entries } = prep();
  assert.ok(!V.produits(entries, {}).lignes.some(e => e.article === 'ACOMPTE'));
});
t('Mes produits : recherche sans accents et filtres rayon, nature', () => {
  const { entries } = prep({ natures });
  assert.strictEqual(V.produits(entries, { recherche: 'biere' }).lignes.length, 0);
  assert.deepStrictEqual(V.produits(entries, { recherche: 'heineken' }).lignes.map(e => e.article), ['Heineken 50 cl']);
  assert.deepStrictEqual(V.produits(entries, { rayon: 'Softs' }).lignes.map(e => e.article), ['Coca-Cola 50 cl']);
  assert.ok(V.produits(entries, { nature: 'a_identifier' }).lignes.every(e => e.nature === 'a_identifier'));
});
t('Meilleures ventes : rang par CA ; filtre marge libre retire le gaz sans changer les chiffres', () => {
  const { entries } = prep({ natures });
  const tout = V.meilleuresVentes(entries, {});
  assert.strictEqual(tout.lignes[0].article, 'Gaz bleu 12,5 kg');
  assert.ok(Math.abs(tout.lignes.reduce((s, e) => s + e.part, 0) - 1) < 1e-9);
  const libre = V.meilleuresVentes(entries, { libreSeulement: true });
  assert.ok(!libre.lignes.some(e => e.article.startsWith('Gaz bleu')), 'gaz retiré');
  libre.lignes.forEach(e => { const o = tout.lignes.find(x => x.article === e.article); assert.strictEqual(e.ca, o.ca); assert.strictEqual(e.part, o.part); });
  assert.strictEqual(libre.total, tout.total);
});
t('Mes marges : rang de la fiche, négatives à part, résumé de la boutique', () => {
  const { res, entries } = prep({ natures });
  const v = V.marges(entries, res.resume);
  assert.strictEqual(v.lignes[0].article, 'Gaz bleu 12,5 kg');
  assert.ok(!v.lignes.some(e => e.article === 'HARIBO'));
  assert.deepStrictEqual(v.negatives.map(e => e.article), ['HARIBO']);
  assert.strictEqual(v.margeBoutique, res.resume.margeBoutique);
  assert.strictEqual(v.caisses.length, 1);
});

const html = lire('NEXUS-Produits-v1.html');
const sans = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
t('Page : script inclus, cartes, retour, filtres, pagination', () => {
  assert.ok(html.includes('nexus-produits-vues.js?v='));
  ['Mes produits', 'Mes meilleures ventes', 'Mes marges', '‹ Produits', 'Produits à marge libre seulement', 'Marges négatives', 'Justifier', 'Afficher plus', 'opération', 'Quantité possiblement exprimée en euros', 'À identifier'].forEach(s => assert.ok(html.includes(s), s));
  assert.ok(html.includes('campagne-produits-moteurs') && html.includes('campagne-ca-boutique') && html.includes('campagne-marge-commerciale'));
  ['produits', 'ventes', 'marges'].forEach(k => assert.ok(html.includes("'" + k + "'")));
  assert.ok(html.includes('tabular-nums') && html.includes('.tuile.disponible'));
  assert.ok(html.includes('vuesDisponibles()'), 'carte seulement si la vue fonctionne');
  assert.ok(!/—/.test(html.split('P1-C : cartes')[1].split('.synthese-accueil{')[0]), 'pas de tiret cadratin dans le CSS P1-C');
  assert.ok(!/(rentable|non rentable|à supprimer|déréférenc)/i.test(sans.slice(sans.indexOf('function ouvrirVue'), sans.indexOf('function afficherSyntheseAccueil'))), 'aucun adjectif de rentabilité');
});
t('Icônes officielles présentes', () => {
  ['campagne-produits-moteurs', 'campagne-ca-boutique', 'campagne-marge-commerciale'].forEach(i => [48, 96, 144].forEach(s => assert.ok(fs.existsSync(path.join(__dirname, 'assets/icones/campagne/premium/' + i + '-' + s + '.webp')), i + s)));
});
t('Taux déjà en pourcentage : jamais multipliés par 100', () => {
  const V = require('./nexus-produits-vues.js');
  const nb = x => x.replace('\u00a0', ' ');
  assert.strictEqual(nb(V.pourcent(40.95)), '40,95 %', 'Pringles');
  assert.strictEqual(nb(V.pourcent(9.84)), '9,84 %', 'Gaz bleu');
  assert.strictEqual(nb(V.pourcent(71.17)), '71,17 %', 'résumé des forts contributeurs');
  assert.strictEqual(V.pourcent(null), 'n.d.');
  const vues = html.slice(html.indexOf('function ouvrirVue'), html.indexOf('function afficherSyntheseAccueil'));
  assert.ok(vues.includes('pourcent(e.taux)') && vues.includes('pourcent(v.partForts)'), 'les vues utilisent pourcent pour les taux');
  assert.ok(!/fmtPct\((e\.taux|v\.partForts)\)/.test(vues), 'fmtPct (ratio) interdit sur un taux déjà en pourcentage');
});
console.log(n + ' tests P1-C OK');
