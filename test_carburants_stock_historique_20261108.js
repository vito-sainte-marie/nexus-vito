// Petite PR (Guardian 6726845037 et 6726891710, 08/11/2026) : tableau « Stock & autonomie » -> fiches selon le conteneur ; Historique fermé par défaut.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const H = fs.readFileSync(path.join(__dirname, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');
const bascule = c => /@container \(max-width:599px\)\{\s*#stockZone \.stock-table-wrap\{display:none;\}\s*#stockZone \.stock-mobile-wrap\{display:block;\}/.test(c);
const histoFerme = c => /ACCORDIONS = \{[\s\S]*?\bhistorique: false,/.test(c) && !/\bhistorique: true,/.test(c.slice(c.indexOf('ACCORDIONS = {'), c.indexOf('function majChevronId')));

t('tableau Stock : fiches sous 600 px de conteneur, plus de fenêtre', () => {
  assert.ok(bascule(H));
  assert.ok(!/@media \(max-width:600px\)\{\s*#stockZone/.test(H));
  assert.ok(H.indexOf('<div class="analyse-conteneur">') < H.indexOf('id="stockZone"'), 'stockZone est dans le conteneur');
});
t('Historique : fermé à l\'état initial', () => { assert.ok(histoFerme(H)); });
t('Historique : ouvert par ouvrirHistoriqueEtCentrer, chargement initial inchangé', () => {
  assert.ok(/function ouvrirHistoriqueEtCentrer\(dateISO\) \{\s*ACCORDIONS\.historique = true;\s*appliquerEtatAccordion\('historique'\)/.test(H));
  assert.ok(/ouvrirHistoriqueEtCentrer\(el\.dataset\.ouvrirHistorique \|\| null\)/.test(H));
});
garde('bascule tableau/fiches par conteneur', H, bascule, '@container (max-width:599px){\n    #stockZone', '@media (max-width:600px){\n    #stockZone');
garde('Historique fermé par défaut', H, histoFerme, 'historique: false,', 'historique: true,');
garde('ouvrirHistoriqueEtCentrer ouvre le volet', H, c => /ACCORDIONS\.historique = true;\s*appliquerEtatAccordion\('historique'\)/.test(c), "ACCORDIONS.historique = true;\n    appliquerEtatAccordion('historique');", "ACCORDIONS.historique = false;\n    appliquerEtatAccordion('historique');");
console.log(n + ' épreuves OK');
