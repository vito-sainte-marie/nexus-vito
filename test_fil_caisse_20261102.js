// Épreuve — 02/11/2026, lot INVENTAIRE-CAISSE-RENFORT-20261102, L1 (fil « Ma caisse », module pur).
// Exigences (decision-4) : refus par défaut ; pilote caissière seulement ; non-pilote et autre rôle inchangés (aucun fil, aucune adresse) ;
// plan fait des seules étapes restantes ; changement de quart = un comptage de l'entrante. SRC_MUTE : source mutée pour la preuve de mutation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const F = path.resolve(process.env.SRC_MUTE || path.join(__dirname, 'nexus-fil-caisse.js'));
const m = { exports: {} };
new Function('module', 'self', fs.readFileSync(F, 'utf8'))(m, undefined);
const C = m.exports;
let ok = 0;
const cas = (nom, f) => { f(); ok++; console.log('  ✓ ' + nom); };

cas('refus par défaut : ni pilote ni rôle → aucun fil', () => {
  for (const [p, r] of [[undefined, undefined], [false, 'caissiere'], [true, 'pompiste'], [true, undefined], ['true', 'caissiere'], [1, 'caissiere'], [null, null]]) {
    assert.strictEqual(C.autorise(p, r), false);
    assert.strictEqual(C.estActif('?fil=caisse&etape=1', p, r), false);
    assert.strictEqual(C.etapeDe('?fil=caisse&etape=1', p, r), null);
    assert.strictEqual(C.urlEtape(1, [1, 2], p, r), null);
    assert.strictEqual(C.urlApres(1, [1, 2], p, r), null);
    assert.deepStrictEqual(C.planPour({ pilote: p, roleDuJour: r, inscrit: false, comptageFait: false, fermetureDue: true, fermetureFaite: false }), []);
  }
});
cas('pilote caissière : fil actif et étape lue', () => {
  assert.strictEqual(C.estActif('?fil=caisse&etape=2', true, 'caissiere'), true);
  assert.strictEqual(C.etapeDe('?fil=caisse&etape=2', true, 'caissiere'), 2);
  assert.strictEqual(C.etapeDe('?fil=caisse&etape=9', true, 'caissiere'), null);
  assert.strictEqual(C.estActif('?fil=debut-quart&etape=1', true, 'caissiere'), false);
});
cas('plan : seules les étapes restantes', () => {
  const b = { pilote: true, roleDuJour: 'caissiere' };
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: false, comptageFait: false, fermetureDue: true, fermetureFaite: false }), [1, 2, 3]);
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: true, comptageFait: false, fermetureDue: false, fermetureFaite: false }), [2]);
  assert.deepStrictEqual(C.planPour({ ...b, inscrit: true, comptageFait: true, fermetureDue: true, fermetureFaite: true }), []);
});
cas('changement de quart : un comptage de l\'entrante, sinon ouverture', () => {
  assert.strictEqual(C.natureComptage({ quartPrecedentCompte: true }), 'changement');
  assert.strictEqual(C.natureComptage({ quartPrecedentCompte: false }), 'ouverture');
  assert.strictEqual(C.natureComptage({}), 'ouverture');
});
cas('adresses et libellés', () => {
  assert.strictEqual(C.urlEtape(2, [2, 3], true, 'caissiere'), 'NEXUS-Inventaire-v1.html?fil=caisse&etape=2&plan=2.3');
  assert.strictEqual(C.urlApres(3, [2, 3], true, 'caissiere'), 'NEXUS-App-v1.html');
  assert.strictEqual(C.urlEtape(0, [2], true, 'caissiere'), null);
  assert.strictEqual(C.libelleProgression(2, [2, 3]), 'Étape 1 sur 2');
  assert.strictEqual(C.libelleContinuer(3, [2, 3]), 'Terminer ma caisse');
  assert.deepStrictEqual(C.planDe('?plan=3.2'), [1, 2, 3]);
});
cas('aucun accès à pilotesRenfort dans le module', () => assert.ok(!/pilotesRenfort/.test(fs.readFileSync(F, 'utf8').replace(/\/\/.*$/gm, ''))));
console.log(`\n${ok} contrôles OK`);
