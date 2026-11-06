const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('NEXUS-Paye-v1.html', 'utf8');

assert.ok(html.includes('id="reviewSection"') && html.includes('id="employeesSection"') && html.includes('id="accountantSection"'));
// Finition du 09/10 (§4 du mandat) : l'action principale nomme ce qu'elle fait.
assert.ok(html.includes('Traiter les'));
assert.ok(html.includes('Informations sans impact paie'));
assert.ok(html.includes('Transmettre à la comptabilité') && html.includes('Sans impact paie'));
assert.ok(html.includes('Écart de caisse') && html.includes('ne devient jamais automatiquement une dette'));
// Affichage court du 05/11/2026 : l'écart n'a plus de cases Initial / Final validé / Impact paie dans Paye.
assert.ok(!html.includes('<span>Final validé</span>'));
assert.ok(html.includes('infoModal') && html.includes('data-info='));
assert.ok(html.includes("Corriger l’attribution dans"));
assert.ok(html.includes("['employe','type','date','source','ecart_initial','ecart_final','statut'"));

console.log('Interface guidée NEXUS PAYE : parcours, pédagogie et traçabilité validés.');
