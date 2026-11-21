'use strict';
// Table rayon Decenium -> famille d'icône (Guardian 7064246243). Rayons fictifs : aucun nom réel.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require(path.join(__dirname, 'nexus-rayons-familles.js'));
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

t('rayon mal encodé remis d\'aplomb avant la recherche', () => {
  assert.strictEqual(T.redresser('Tabac Ã  rouler'.replace('Ã ', 'Ã ')), 'Tabac à rouler');
  assert.strictEqual(T.familleCible('Tabac Ã  rouler'), 'cat-tabac');
  assert.strictEqual(T.familleCible('Tabac à rouler'), 'cat-tabac');
});
t('quatre associations corrigées', () => {
  assert.notStrictEqual(T.familleCible('Biscuiterie - Pains d\'épices'), 'cat-pains');
  assert.strictEqual(T.familleCible('Biscuiterie - Pains d\'épices'), 'cat-biscuits');
  assert.notStrictEqual(T.familleCible('Huiles - Vinaigres - Graisses'), 'cat-huiles');
  assert.strictEqual(T.familleCible('Huiles - Vinaigres - Graisses'), 'cat-epicerie');
  assert.notStrictEqual(T.familleCible('Accesoires - Briquets - Gaz'), 'cat-gaz');
  assert.strictEqual(T.familleCible('Accesoires - Briquets - Gaz'), 'cat-tabac');
  ['Paquet de 20', 'Paquet de 25', 'Paquet de 30'].forEach(r => assert.strictEqual(T.iconeRayon(r), 'cat-cigarettes', r));
});
t('huile moteur reste cat-huiles, gaz seul reste cat-gaz', () => {
  assert.strictEqual(T.familleCible('Huiles moteur'), 'cat-huiles');
  assert.strictEqual(T.familleCible('Gaz'), 'cat-gaz');
});
t('famille sans image : secours puis neutre, jamais d\'identifiant sans fichier', () => {
  assert.strictEqual(T.familleAffichable('Bières'), 'cat-bieres');
  assert.strictEqual(T.iconeRayon('Confiserie'), 'cat-confiserie');
  assert.strictEqual(T.familleAffichable('Confiserie'), 'cat-confiserie');
  assert.strictEqual(T.familleAffichable('Rayon fictif sans règle'), null);
});
t('rayon inconnu : icône neutre, et la liste des inconnus le nomme', () => {
  assert.strictEqual(T.iconeRayon('Rayon fictif sans règle'), T.NEUTRE);
  assert.deepStrictEqual(T.inconnus(['Gaz', 'Rayon fictif sans règle', 'RAYON fictif sans regle', '', null, 'Autre rayon fictif']),
    ['Autre rayon fictif', 'Rayon fictif sans règle']);
});
t('chaque famille prête a ses fichiers, chaque famille à venir est nommée', () => {
  T.PRETES.forEach(id => assert.ok(fs.existsSync(path.join(__dirname, 'assets/icones/v2', id, id + '@1x.webp')), id));
  assert.strictEqual(T.A_VENIR.length, 0);
  assert.strictEqual(T.PRETES.length, 29);
  assert.strictEqual(new Set(T.PRETES).size, 29);
  T.PRETES.slice(11).forEach(id => ['-24.svg', '-24-jour.svg', '-24.png', '-24-jour.png', '-jour@1x.webp', '-jour@2x.webp', '-jour@3x.webp', '@2x.webp', '@3x.webp']
    .forEach(suf => { const f = suf.charAt(0) === '-' && suf.indexOf('@') < 0 ? id + suf : (suf.charAt(0) === '@' ? id + suf : id + suf);
      assert.ok(fs.existsSync(path.join(__dirname, 'assets/icones/v2', id, f)), id + ' ' + f); }));
});
t('chaque règle vise une famille connue', () => {
  const connues = new Set(T.PRETES.concat(T.A_VENIR));
  T.REGLES.forEach(r => { assert.ok(connues.has(r.famille), r.motif); if (r.secours) assert.ok(T.PRETES.includes(r.secours), r.motif); });
});
t('les trois pages chargent la table avant nexus-icones.js', () => {
  ['NEXUS-Produits-v1.html', 'NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'].forEach(f => {
    const h = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const a = h.indexOf('nexus-rayons-familles.js'), b = h.indexOf('nexus-icones.js');
    assert.ok(a > 0 && a < b, f);
  });
});
console.log(n + ' épreuves OK');
