'use strict';
// Épreuve de P8/2 : l'enregistrement d'un arrêt est idempotent, append-only,
// qualifié par classerArret (aucun second classeur) et sans effet de bord.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { enregistrer, identifiant } = require('./outils/enregistrer-incident.js');
const { classerArret } = require('./outils/watchdog-stagnation.js');

let passes = 0, total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}
const SHA = 'a'.repeat(40), SHA2 = 'b'.repeat(40);
const LOT = 'NEXUS-REPARATION-HANDOFF-1-20261014';
const base = { code: 'CONDITIONS_NON_PROUVEES', lot: LOT, sha: SHA, branche: 'handoff-continuite-20260920',
  derniereActivite: '2026-10-14T14:00:00Z', maintenant: '2026-10-14T15:10:00Z', run: '38587248558' };
const racine = () => fs.mkdtempSync(path.join(os.tmpdir(), 'incidents-'));
const journal = r => path.join(r, 'docs', 'learning', 'INCIDENTS.jsonl');
const octets = r => fs.readFileSync(journal(r), 'utf8');

console.log('\nP8/2 — enregistrement idempotent des incidents\n');

t('l’arrêt du 14/10 (CONDITIONS_NON_PROUVEES, 70 min) est enregistré, qualifié par classerArret', () => {
  const r = racine();
  const res = enregistrer(base, { racine: r });
  assert.strictEqual(res.etat, 'ENREGISTRE');
  const l = JSON.parse(octets(r));
  const c = classerArret(base);
  assert.strictEqual(l.famille, c.famille);
  assert.strictEqual(l.orpheline, true);
  assert.strictEqual(l.minutes, 70);
  assert.strictEqual(l.statut, 'OUVERT');
  assert.strictEqual(l.id, identifiant(base.code, LOT, SHA));
});

t('le rejeu ne change pas un octet', () => {
  const r = racine();
  const premier = enregistrer(base, { racine: r });
  const res = enregistrer(base, { racine: r });
  assert.strictEqual(res.etat, 'DEJA_ENREGISTRE');
  assert.strictEqual(octets(r), JSON.stringify(premier.ligne) + '\n');
});

t('un autre sha est un autre incident : ajout, sans toucher à la première ligne', () => {
  const r = racine();
  enregistrer(base, { racine: r });
  const premiere = octets(r);
  const res = enregistrer(Object.assign({}, base, { sha: SHA2 }), { racine: r });
  assert.strictEqual(res.etat, 'ENREGISTRE');
  assert.ok(octets(r).startsWith(premiere), 'la première ligne doit rester intacte');
  assert.strictEqual(octets(r).split('\n').filter(Boolean).length, 2);
});

t('un arrêt humain voulu n’est pas un incident', () => {
  const r = racine();
  const res = enregistrer(Object.assign({}, base, { code: 'DECISION_RESERVEE_A_UN_HUMAIN' }), { racine: r });
  assert.strictEqual(res.etat, 'NON_ENREGISTRE');
  assert.ok(!fs.existsSync(journal(r)));
});

t('entrées malformées refusées sans écrire (sha, lot, horloge absente)', () => {
  const r = racine();
  for (const mauvais of [{ sha: 'abc' }, { lot: 'x' }, { maintenant: undefined }, { maintenant: 'hier' }]) {
    assert.strictEqual(enregistrer(Object.assign({}, base, mauvais), { racine: r }).etat, 'REFUSE');
  }
  assert.ok(!fs.existsSync(journal(r)));
});

t('un journal dont la dernière ligne est inachevée est refusé, jamais complété', () => {
  const r = racine();
  fs.mkdirSync(path.dirname(journal(r)), { recursive: true });
  fs.writeFileSync(journal(r), '{"id":"INC-x"');
  assert.throws(() => enregistrer(base, { racine: r }), /non terminée/);
  assert.strictEqual(octets(r), '{"id":"INC-x"');
});

t('ecrire:false mesure sans toucher au disque', () => {
  const r = racine();
  assert.strictEqual(enregistrer(base, { racine: r, ecrire: false }).etat, 'ENREGISTRE');
  assert.ok(!fs.existsSync(journal(r)));
});

t('la source n’a ni shell, ni réseau, ni git, ni réécriture', () => {
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'enregistrer-incident.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const interdit of [/child_process/, /https?:\/\//, /\bfetch\(/, /writeFileSync\(\s*fichier/, /renameSync|unlinkSync|truncateSync/]) {
    assert.ok(!interdit.test(src), `motif interdit présent : ${interdit}`);
  }
  assert.ok(/appendFileSync/.test(src));
});

console.log(`\n${passes}/${total} vérifications passées — ${total - passes} échec(s).`);
process.exit(process.exitCode || 0);
