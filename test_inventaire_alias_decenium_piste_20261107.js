// Alias Decenium des 3 produits piste (Guardian 6716354668, 07/11/2026) : Gaz 39KG, Glaçons Vito (1),
// Glace Ecaille 8kg Crystal sont rapprochés par le mécanisme officiel (alias de l'import), pas par SQL.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Inventaire-Manager-v1.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].sort((a, b) => b[1].length - a[1].length)[0][1];
function bloc(src, mot) {
  const d = src.indexOf(mot); let i = d + mot.length - 1, p = 0;
  for (; i < src.length; i++) { if (src[i] === '{') p++; else if (src[i] === '}') { p--; if (p === 0) { i++; break; } } }
  return src.slice(d, i) + ';';
}
const sb = { console }; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-inventaire-decenium-lecture.js'), 'utf8'), sb);
vm.runInContext(`var parametresInventaire = {}; var DEFAULTS_PARAMETRES_INVENTAIRE = { stockNegatifCategoriesExclues: null };
${bloc(script, 'const ALIAS_VENTES_SANS_CODE_BARRES = {')}
${bloc(script, 'function normaliserCodeBarresVentes(')}
${bloc(script, 'function normaliserTexteVentes(')}
${bloc(script, 'function rapprocherLignesStock(')}
this.rapprocherLignesStock = rapprocherLignesStock;`, sb);
const CAT = [
  { id: 'gaz', designation: 'Gaz 39KG', code_barres: null },
  { id: 'glacons', designation: 'Glaçons Vito (1)', code_barres: null },
  { id: 'ecaille', designation: 'Glace Ecaille 8kg Crystal', code_barres: null },
];
const LIGNES = [['GAZ BLEU 39 K', 'gaz'], ['Glacons Vito 5 kg', 'glacons'], ['Glace Ecailles / Paillettes 8kg Crystal', 'ecaille']];
LIGNES.forEach(([lib, id]) => t('l\'export Stock « ' + lib + ' » est rapproché du produit ' + id, () => {
  const l = sb.rapprocherLignesStock([{ 'Lib Article': lib, 'Code Barres': null, 'Stock': 3 }], CAT)[0];
  assert.strictEqual(l.produit_id, id); assert.strictEqual(l.quantite_stock, 3);
}));
t('un libellé voisin non listé reste inconnu (pas de rapprochement flou)', () => {
  const l = sb.rapprocherLignesStock([{ 'Lib Article': 'GAZ BLEU 12 K', 'Code Barres': null, 'Stock': 1 }], CAT)[0];
  assert.ok(!l.produit_id);
});
garde('alias Gaz 39KG', html, c => c.includes("'gaz bleu 39 k': 'Gaz 39KG'"), "'gaz bleu 39 k': 'Gaz 39KG'", "'gaz bleu 39 k': 'Gaz 39'");
garde('alias Glaçons Vito', html, c => c.includes("'glacons vito 5 kg': 'Glaçons Vito (1)'"), "'glacons vito 5 kg': 'Glaçons Vito (1)'", "'glacons vito 5 kg': 'Glaçons Vito'");
garde('alias Glace Ecaille', html, c => c.includes("'glace ecailles / paillettes 8kg crystal': 'Glace Ecaille 8kg Crystal'"), "'glace ecailles / paillettes 8kg crystal'", "'glace ecailles 8kg crystal'");
console.log(n + ' épreuves OK');
