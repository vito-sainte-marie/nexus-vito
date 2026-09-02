const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('NEXUS-Paye-v1.html', 'utf8');

assert.ok(html.includes('id="reviewSection"') && html.includes('id="employeesSection"') && html.includes('id="accountantSection"'));
assert.ok(html.includes('Examiner les points à vérifier'));
assert.ok(html.includes('Informations sans impact paie'));
assert.ok(html.includes('Transmettre à la comptable') && html.includes('Sans impact paie'));
assert.ok(html.includes('Écart de caisse') && html.includes('ne devient jamais automatiquement une dette'));
assert.ok(html.includes('Initial') && html.includes('Final validé') && html.includes('Impact paie'));
assert.ok(html.includes('infoModal') && html.includes('data-info='));
assert.ok(html.includes("Corriger l’attribution dans"));
assert.ok(html.includes("['employe','type','date','source','ecart_initial','ecart_final','statut'"));

console.log('Interface guidée NEXUS PAYE : parcours, pédagogie et traçabilité validés.');
