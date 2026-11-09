// Alias Decenium des 25 produits boutique de confiance haute (Guardian 6743685949, GO de Frédéric, 09/11/2026) :
// rapprochés par le mécanisme officiel (alias de l'import), jamais par UPDATE en base.
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
const PAIRES = [["Bière Heineken 65cl", "Biere Heineken 65cl - 12P"], ["Fruitybon Canne 50CL", "Jus FRUITYBON Canne 50cl"], ["CBD Buyaka Gelato 5G", "CBD2 BUYAKA Gelato 5G"], ["CBD Gelato 2G", "CBD6 Gelato 2G"], ["CBD Purple Haze 2G", "CBD9 Purple Haze 2g"], ["Brooklyn Bleue 20", "Cigarettes Brooklyn bleue 20 -10P"], ["Camel Filtre 20", "Cigarettes Camel filtre 20"], ["Dunhill KS", "Cigarettes Dunhill ks 20 -10P"], ["Maryland Bleue 25", "Cigarettes Maryland bleue 25 -8P"], ["Advance 4T Ultra 10W40 1 L", "Advance 4T Ultra 10W40 1 L - 12P"], ["Helix 10w40 5l", "helix 10w40 5L - 3P"], ["Helix 15w40 5L", "helix 15w40 5L - 3P"], ["Helix Ultra 5W40 1L", "helix ultra 5w40 1L -12P"], ["Helix ultra 5w40 5L", "Helix Ultra 5W40 5 L - 3P"], ["Spirax S2 80w-90 1L", "spirax s2 A 80w-90 1L - 12P"], ["PCS Black", "PCS Carte Black"], ["Transcash Duo", "Carte TRANSCASH duo"], ["Transcash Solo", "Carte TRANSCASH solo"], ["Week End By FA 2€", "WEEK END ANTILLES BY FA - 2€"], ["AD BLUE 10L", "AD Blue 10L"], ["Lave Glace Bleu 2L", "Lave glace Bleu Vito 2l -8P"], ["Lave Glace Bleu 5L", "Lave glace Bleu Vito 5l -4P"], ["Lave Glace Floral 2L", "Lave glace floral vito 2l - 8P"], ["Lave Glace Floral 5L", "Lave glace floral Vito 5l -4P"], ["Quiche Lorraine", "Quiche Lorraine 150g - 48P"]];
const CAT = PAIRES.map(([nx], i) => ({ id: 'p' + i, designation: nx, code_barres: null }));
t('25 correspondances, désignations NEXUS toutes distinctes', () => { assert.strictEqual(PAIRES.length, 25); assert.strictEqual(new Set(PAIRES.map(x => x[0])).size, 25); });
PAIRES.forEach(([nx, dc], i) => t('l\'export Stock « ' + dc + ' » est rapproché de « ' + nx + ' »', () => {
  const l = sb.rapprocherLignesStock([{ 'Lib Article': dc, 'Code Barres': null, 'Stock': 3 }], CAT)[0];
  assert.strictEqual(l.produit_id, 'p' + i); assert.strictEqual(l.quantite_stock, 3);
}));
t('aucun alias ne lie une ligne voisine (Helix 5W40 1L ≠ 5L, lave-glace 2L ≠ 5L)', () => {
  const l = sb.rapprocherLignesStock([{ 'Lib Article': 'Helix Ultra 5W40 5 L - 3P', 'Code Barres': null, 'Stock': 1 }], CAT)[0];
  assert.strictEqual(l.produit_id, 'p' + PAIRES.findIndex(x => x[0] === 'Helix ultra 5w40 5L'));
});
const regleAlias = (cle, nom) => s => s.includes("'" + cle + "': '" + nom + "'");
[['quiche lorraine 150g', 'Quiche Lorraine'], ['carte transcash duo', 'Transcash Duo'], ['lave glace floral vito 5l', 'Lave Glace Floral 5L']]
  .forEach(([cle, nom]) => garde('garde alias « ' + cle + ' » : la source mutée rougit', script, regleAlias(cle, nom), "'" + cle + "': '" + nom + "'", "'" + cle + " x': '" + nom + "'"));
console.log(n + ' épreuves OK');
