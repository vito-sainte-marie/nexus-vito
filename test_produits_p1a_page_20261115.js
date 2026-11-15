// P1-A : câblage de la fiche Produits (mesures, libellés factuels, recherche des anciennes périodes).
const fs = require('fs'), assert = require('assert');
const PAGE = fs.readFileSync(__dirname + '/NEXUS-Produits-v1.html', 'utf8');
const texte = PAGE.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let ok = 0;
function t(n, f) { try { f(); ok++; } catch (e) { console.error('ECHEC ' + n + ' : ' + e.message); process.exitCode = 1; } }
t('scripts inclus', () => { assert(/nexus-marge\.js/.test(PAGE)); assert(/nexus-produits-mesure\.js\?v=[\w-]+/.test(PAGE)); });
t('colonne tva lue', () => assert(/COLONNES_PRODUCTS[^;]*tva/.test(PAGE)));
t('attacherMesures branchée', () => { assert(/async function attacherMesures/.test(PAGE)); assert(/attacherMesures\(await construireProduitsLive\(\)\)/.test(PAGE)); });
t('adjectifs retirés', () => {
  ['Rotation rapide', 'Stock maîtrisé', 'Très rentable'].forEach(x => assert(!texte.includes(x), x));
  ['NexusVocab.rentabilite', 'NexusVocab.rotation', 'NexusVocab.stock', 'niveauRotation', 'niveauStock', 'rentaTxt'].forEach(x => assert(!texte.includes(x), x));
});
t('libellés factuels', () => {
  ['Couverture estimée', 'Stock théorique (valeur)', 'Stock théorique Decenium', 'Mesures de la période'].forEach(x => assert(texte.includes(x), x));
  assert(!texte.includes('Rotation réelle'));
});
t('phrase Conseiller et explication', () => { assert(/NexusProduitsMesure\.phrase\(p\.mesure\)|NexusProduitsMesure\.phrase\(mes\)/.test(texte)); assert(/mes\.explication/.test(texte)); });
t('anciennes périodes : références conservées dans PRODUCTS (recherche nom et code-barres)', () => {
  assert(/source:\s*['"`]période/.test(texte) || /période \$\{/.test(texte));
  assert(/code_barres/.test(texte));
});
console.log(ok + ' tests page P1-A OK');

t('P1-A revue : mentions, tuile et libellés d historique', () => {
  assert(/estimée au PMP Decenium du/.test(PAGE));
  assert(/Classement CA dans le rayon/.test(PAGE));
  assert(/histo-label\{[^}]*width:68px/.test(PAGE));
});
