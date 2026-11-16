'use strict';
// Articles de caisse hors catalogue (ACOMPTE) : règle NEXUS, déclaration prioritaire.
const assert = require('assert');
const PM = require('./nexus-produits-mesure.js');
const ok = ['28-04-2026 ACOMPTE', '12-02-2026 ACOMPTE - DEMARREUR CLIO', '22-08-2026 ACOMPTE', '22-09-2026 ACOMPTE', '30-10-2026 ACOMPTE'];
ok.forEach(l => assert.ok(PM.articleCaisseHorsCatalogue(l), 'reconnu : ' + l));
['PACOMPTE', 'Bonbon acompte', 'COCA COLA', '', null, 'ACOMPTES'].forEach(l => assert.ok(!PM.articleCaisseHorsCatalogue(l), 'non reconnu : ' + l));
assert.deepStrictEqual(PM.ARTICLES_CAISSE_HORS_CATALOGUE, ['ACOMPTE']);
const row = { article: '30-10-2026 ACOMPTE' };
const n = PM.natureDe([], row, true);
assert.strictEqual(n.nature, 'operation_caisse');
assert.strictEqual(n.regle, true);
const d = PM.natureDe([{ article: '30-10-2026 ACOMPTE', nature: 'produit_commercial', actif: true, date_debut: '2000-01-01' }], row, true);
assert.strictEqual(d.nature, 'produit_commercial', 'déclaration prioritaire sur la règle');
assert.ok(!d.regle);
console.log('OK  articles de caisse hors catalogue');
