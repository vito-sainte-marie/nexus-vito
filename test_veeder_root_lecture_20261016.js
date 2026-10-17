// Épreuves de la lecture Veeder-Root (texte synthétique, aucune photo réelle versée au dépôt).
const assert = require('assert');
const V = require('./nexus-veeder-root.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

const ECRAN = `RESERVOIR 1: R3 30M3 SP
Volume Produit 20085
Hauteur Produi 1564.4
Hauteur eau 0.0
RESERVOIR 2: R4 10M3 GO
Volume Produit 7577
Hauteur eau 0.0
RESERVOIR 3: R1 20M3 GO
Volume Produit 11875
Hauteur eau 0.0
RESERVOIR 4: R2 30M3 GNR
Volume Produit 4365
Hauteur eau 0.0`;

t('quatre cuves lues, rattachées par produit et capacité', () => {
  const c = V.lireEcranVeederRoot(ECRAN);
  assert.deepStrictEqual(c.map(x => [x.produit, x.capacite_m3, x.volume_l]),
    [['SP', 30, 20085], ['GO', 10, 7577], ['GO', 20, 11875], ['GNR', 30, 4365]]);
  assert.ok(c.every(x => x.alerte === null));
  assert.deepStrictEqual(V.completude(c), { complet: true, manque: [] });
});
t('séparateur de milliers toléré', () => {
  const c = V.lireEcranVeederRoot('RESERVOIR 1: R3 30M3 SP\nVolume Produit 20 085\nHauteur eau 0.0');
  assert.strictEqual(c[0].volume_l, 20085);
});
t('bloc sans volume : valeur absente, jamais inventée', () => {
  const c = V.lireEcranVeederRoot('RESERVOIR 4: R2 30M3 GNR\nHauteur eau 0.0');
  assert.strictEqual(c[0].volume_l, null);
  assert.strictEqual(c[0].alerte, 'valeur_absente');
  assert.deepStrictEqual(V.completude(c).manque, ['SP', 'GO', 'GNR']);
});
t('volume au-delà de la capacité signalé', () => {
  const c = V.lireEcranVeederRoot('RESERVOIR 2: R4 10M3 GO\nVolume Produit 17577');
  assert.strictEqual(c[0].alerte, 'au_dela_de_la_capacite');
});
t('texte vide ou sans cuve : aucune proposition', () => {
  assert.deepStrictEqual(V.lireEcranVeederRoot(''), []);
  assert.deepStrictEqual(V.lireEcranVeederRoot(null), []);
  assert.deepStrictEqual(V.completude([]).manque, ['SP', 'GO', 'GNR']);
});
t('une seule cuve GO lue : incomplet', () => {
  const c = V.lireEcranVeederRoot(ECRAN.replace('RESERVOIR 3: R1 20M3 GO\nVolume Produit 11875', 'RESERVOIR 3: R1 20M3 GO'));
  assert.deepStrictEqual(V.completude(c).manque, ['GO']);
});
t('correction humaine tracée', () => {
  assert.deepStrictEqual(V.ecartCorrection(7577, 7577), { corrige: false, delta: 0 });
  assert.deepStrictEqual(V.ecartCorrection(7577, 7557), { corrige: true, delta: -20 });
  assert.strictEqual(V.ecartCorrection(null, 100).corrige, true);
});
console.log(n + '/' + n);
