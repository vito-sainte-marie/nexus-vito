'use strict';
// Une référence exclue des indicateurs (règle ou déclaration) : statut neutre, Conseiller neutre,
// part du rayon et classement « sans objet ».
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Produits-v1.html'), 'utf8');

function extraire(nom) {
  const i = html.indexOf('function ' + nom + '(');
  assert(i >= 0, nom + ' introuvable');
  let d = html.indexOf('{', i), n = 0, j = d;
  for (; j < html.length; j++) { if (html[j] === '{') n++; else if (html[j] === '}') { n--; if (!n) break; } }
  return html.slice(i, j + 1);
}
const code = extraire('horsIndicateurs') + '\n' + extraire('calculerStatutSimplifie') + '\nreturn { horsIndicateurs, calculerStatutSimplifie };';
const appels = [];
const NexusConseiller = { statutProduit: () => { appels.push(1); return { cle: 'strategique', label: 'Produit stratégique', niveau: 'info', action: 'x' }; } };
const mod = new Function('NexusConseiller', 'AUJOURDHUI_STATION', 'esc', code)(NexusConseiller, null, x => x);

(function test_statut_neutre_operation_caisse() {
  const st = mod.calculerStatutSimplifie({ mesure: { exclue_indicateurs: true } });
  assert.strictEqual(st.label, 'Opération de caisse');
  assert.strictEqual(st.action, null);
  assert.strictEqual(appels.length, 0, 'le statut commercial ne doit pas être calculé');
})();
(function test_produit_ordinaire_inchange() {
  assert.strictEqual(mod.calculerStatutSimplifie({ mesure: { exclue_indicateurs: false } }).label, 'Produit stratégique');
  assert.strictEqual(mod.calculerStatutSimplifie({}).label, 'Produit stratégique');
})();
(function test_fiche_sans_objet() {
  assert((html.match(/horsInd \? 'sans objet'/g) || []).length === 2, 'part du rayon et classement');
  assert(html.includes('Hors indicateurs commerciaux : aucune recommandation.'));
  assert(/horsIndicateurs\(p\)\) return \{ cle: 'operation-caisse'/.test(html), 'vues');
})();
console.log('OK test_produits_hors_indicateurs_20261116');
