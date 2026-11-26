// A1 (G-7) — l'écart de caisse d'un quart = |piste| + |boutique|, sans compensation.
const assert = require('assert');
const E = require('./nexus-ecarts-moteur.js');
const M = globalThis.NexusEcartsMoteur;
const V = require('./nexus-verify-moteur.js');
const VM = globalThis.NexusVerifyMoteur || V;
let n = 0;
const ok = (nom, fn) => { fn(); n++; console.log('OK  ' + nom); };

ok('+10 / -10 donne 20 (pas de compensation)', () => assert.strictEqual(M.ecartMesureQuart(10, -10), 20));
ok('piste seule', () => assert.strictEqual(M.ecartMesureQuart(-7.5, 0), 7.5));
ok('boutique seule', () => assert.strictEqual(M.ecartMesureQuart(0, 4.25), 4.25));
ok('quart sans écart = 0', () => assert.strictEqual(M.ecartMesureQuart(0, 0), 0));
ok('les deux null : null, pas 0 (Article 5)', () => assert.strictEqual(M.ecartMesureQuart(null, undefined), null));
ok('un côté null : on mesure l\'autre', () => assert.strictEqual(M.ecartMesureQuart(null, -3), 3));
ok('chaîne vide ou non numérique = non mesuré', () => assert.strictEqual(M.ecartMesureQuart('', 'abc'), null));
ok('arrondi au centime', () => assert.strictEqual(M.ecartMesureQuart(0.1, 0.2), 0.3));

ok('agregerAudits : ecartCumule = somme des mesures de quart', () => {
  const r = VM.agregerAudits([
    { ecart_piste: 10, ecart_boutique: -10, statut: 'critique' },
    { ecart_piste: 5, ecart_boutique: null, statut: 'surveiller' },
    { ecart_piste: 0, ecart_boutique: 0, statut: 'conforme' },
  ]);
  assert.strictEqual(r.ecartCumule, 25);
  assert.strictEqual(r.pireEcart.ecartMax, 20);
});
ok('classement dominant inchangé (tri, pas mesure)', () => {
  const r = VM.agregerAudits([{ ecart_piste: 12, ecart_boutique: -3, statut: 'critique' }]);
  assert.strictEqual(r.composantePlusTouchee, 'Piste');
});
console.log(n + ' épreuves OK');
