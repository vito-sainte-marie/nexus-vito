// Épreuve de outils/juger-tour-claude.js — condition 4 de la decision-2
// d'OUTILLAGE-REGULARISATION-20261026 : un tour qui a poussé mais n'a pas
// consommé la décision doit échouer, avec un message explicite.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'juger-tour-claude.js');
const { juger } = require(OUTIL);
const LOT = 'LOT-EPREUVE-20261026';
const etat = (statut) => ({ lots: { [LOT]: { statut, derniere_decision: 'decision-2.md' } } });
let n = 0;
const ok = (nom, fn) => { fn(); n++; console.log('OK — ' + nom); };
const lancer = (chemin, statut) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'juger-tour-')), 'STATE.json');
  fs.writeFileSync(f, JSON.stringify(etat(statut)));
  return spawnSync('node', [chemin, LOT, f], { encoding: 'utf8' });
};

ok('J1 — ATTENTE_CONSOMMATION_DECISION après du travail poussé : TOUR_INCOMPLET', () => {
  const r = juger(etat('ATTENTE_CONSOMMATION_DECISION'), LOT);
  assert.strictEqual(r.verdict, 'TOUR_INCOMPLET'); assert.strictEqual(r.ok, false);
  assert.ok(/ATTENTE_CONSOMMATION_DECISION/.test(r.message) && /decision-2\.md/.test(r.message), r.message);
});
ok('J2 — décision consommée : le tour passe', () => {
  assert.strictEqual(juger(etat('DECISION_CONSOMMEE'), LOT).ok, true);
});
ok('J3 — lot absent : refus, jamais un succès par défaut', () => {
  const r = juger({ lots: {} }, LOT); assert.strictEqual(r.ok, false); assert.strictEqual(r.verdict, 'LOT_INCONNU');
});
ok('J4 — en ligne de commande : code 1 + ::error:: sur le tour incomplet, code 0 sinon', () => {
  const r = lancer(OUTIL, 'ATTENTE_CONSOMMATION_DECISION');
  assert.strictEqual(r.status, 1, r.stdout + r.stderr); assert.ok(r.stdout.startsWith('::error::'), r.stdout);
  assert.strictEqual(lancer(OUTIL, 'DECISION_CONSOMMEE').status, 0);
});
ok('MU1 — un juge qui laisse passer le tour incomplet rougit J4', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  const ancre = "if (l.statut === 'ATTENTE_CONSOMMATION_DECISION') {";
  assert.strictEqual(src.split(ancre).length, 2);
  const mut = path.join(path.dirname(OUTIL), `.mut-${process.pid}-juger.js`);
  fs.writeFileSync(mut, src.replace(ancre, "if (false) {"));
  try {
    const r = lancer(mut, 'ATTENTE_CONSOMMATION_DECISION');
    assert.strictEqual(r.status, 0, 'la mutation aurait dû laisser passer le tour incomplet');
  } finally { fs.unlinkSync(mut); }
});
console.log(`\n${n}/${n} épreuves passées`);
