#!/usr/bin/env node
'use strict';
// Épreuves du compteur append-only des répétitions (item 2, lot
// NEXUS-INCIDENTS-CI-1-20261014, successeur de decision-4 du lot
// NEXUS-REPARATION-HANDOFF-1-20261014). Le total ne se stocke jamais : il se
// compte sur le journal. Append-only, idempotent, sans effet de bord.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compter, total, JOURNAL } = require('./outils/compteur-repetitions.js');
const { enregistrer } = require('./outils/enregistrer-incident.js');

let passes = 0, total_ = 0;
function t(nom, fn) {
  total_++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}

const racine = () => fs.mkdtempSync(path.join(os.tmpdir(), 'repetitions-'));
const journal = r => path.join(r, ...JOURNAL);
const octets = r => fs.existsSync(journal(r)) ? fs.readFileSync(journal(r), 'utf8') : '';

console.log('\nItem 2 — compteur append-only des répétitions\n');

t('première occurrence d’un code : rien n’est écrit', () => {
  const r = racine();
  const res = compter({ id: 'INC-1', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T15:00:00Z' }, { racine: r, dejaVus: [] });
  assert.strictEqual(res.etat, 'PREMIERE_OCCURRENCE');
  assert.ok(!fs.existsSync(journal(r)));
});

t('récurrence du même code (autre id) : une ligne ajoutée, occurrence 2', () => {
  const r = racine();
  const res = compter({ id: 'INC-2', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T16:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] });
  assert.strictEqual(res.etat, 'ENREGISTRE');
  assert.strictEqual(res.occurrence, 2);
  const lignes = octets(r).split('\n').filter(Boolean);
  assert.strictEqual(lignes.length, 1);
  assert.strictEqual(JSON.parse(lignes[0]).id, 'INC-2');
});

t('rejeu du même id : DEJA_COMPTE, octets inchangés, rien réécrit', () => {
  const r = racine();
  compter({ id: 'INC-2', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T16:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] });
  const avant = octets(r);
  const res = compter({ id: 'INC-2', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T16:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] });
  assert.strictEqual(res.etat, 'DEJA_COMPTE');
  assert.ok(octets(r) === avant, 'les octets doivent être inchangés après le rejeu');
});

t('une troisième occurrence s’ajoute sans toucher aux deux premières lignes', () => {
  const r = racine();
  compter({ id: 'INC-2', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T16:00:00Z' }, { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] });
  const avant = octets(r);
  const res = compter({ id: 'INC-3', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T17:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES', 'CONDITIONS_NON_PROUVEES'] });
  assert.strictEqual(res.etat, 'ENREGISTRE');
  assert.strictEqual(res.occurrence, 3);
  assert.ok(octets(r).startsWith(avant), 'les lignes déjà écrites doivent rester intactes');
  assert.strictEqual(total('CONDITIONS_NON_PROUVEES', { racine: r }), 2);
});

t('un code jamais vu n’incrémente rien, même au second appel sur un autre code', () => {
  const r = racine();
  compter({ id: 'INC-4', code: 'CANAL_INCAPABLE', date: '2026-10-14T18:00:00Z' }, { racine: r, dejaVus: [] });
  assert.ok(!fs.existsSync(journal(r)));
});

t('ecrire:false mesure sans toucher au disque', () => {
  const r = racine();
  const res = compter({ id: 'INC-5', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T19:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'], ecrire: false });
  assert.strictEqual(res.etat, 'ENREGISTRE');
  assert.ok(!fs.existsSync(journal(r)));
});

t('entrées malformées refusées sans écrire (id, code, date)', () => {
  const r = racine();
  for (const mauvais of [{ id: '' }, { code: '' }, { date: 'hier' }, { date: undefined }]) {
    const base = { id: 'INC-6', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T20:00:00Z' };
    assert.strictEqual(compter(Object.assign({}, base, mauvais), { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] }).etat, 'REFUSE');
  }
  assert.ok(!fs.existsSync(journal(r)));
});

t('un journal dont la dernière ligne est inachevée est refusé, jamais complété', () => {
  const r = racine();
  fs.mkdirSync(path.dirname(journal(r)), { recursive: true });
  fs.writeFileSync(journal(r), '{"id":"INC-x"');
  assert.throws(() => compter({ id: 'INC-7', code: 'CONDITIONS_NON_PROUVEES', date: '2026-10-14T21:00:00Z' },
    { racine: r, dejaVus: ['CONDITIONS_NON_PROUVEES'] }), /non terminée/);
  assert.strictEqual(octets(r), '{"id":"INC-x"');
});

t('intégration : enregistrer-incident.js appelle le compteur sur une vraie récurrence de code', () => {
  const r = racine();
  const base = { lot: 'NEXUS-INCIDENTS-CI-1-20261014', branche: 'handoff-continuite-20260920',
    derniereActivite: '2026-10-14T10:00:00Z', maintenant: '2026-10-14T10:05:00Z', run: '1' };
  const premier = enregistrer(Object.assign({ code: 'CONDITIONS_NON_PROUVEES', sha: 'a'.repeat(40) }, base), { racine: r });
  assert.strictEqual(premier.repetition.etat, 'PREMIERE_OCCURRENCE');
  const second = enregistrer(Object.assign({ code: 'CONDITIONS_NON_PROUVEES', sha: 'b'.repeat(40) }, base), { racine: r });
  assert.strictEqual(second.repetition.etat, 'ENREGISTRE');
  assert.strictEqual(second.repetition.occurrence, 2);
  assert.strictEqual(total('CONDITIONS_NON_PROUVEES', { racine: r }), 1);
});

t('intégration : un rejeu d’un incident déjà enregistré ne touche pas le journal des répétitions', () => {
  const r = racine();
  const base = { lot: 'NEXUS-INCIDENTS-CI-1-20261014', branche: 'handoff-continuite-20260920',
    derniereActivite: '2026-10-14T10:00:00Z', maintenant: '2026-10-14T10:05:00Z', run: '1', sha: 'c'.repeat(40) };
  enregistrer(Object.assign({ code: 'CONDITIONS_NON_PROUVEES' }, base), { racine: r });
  enregistrer(Object.assign({ code: 'CONDITIONS_NON_PROUVEES', sha: 'd'.repeat(40) }, base), { racine: r });
  const avant = octets(r);
  const rejeu = enregistrer(Object.assign({ code: 'CONDITIONS_NON_PROUVEES', sha: 'd'.repeat(40) }, base), { racine: r });
  assert.strictEqual(rejeu.etat, 'DEJA_ENREGISTRE');
  assert.ok(octets(r) === avant, 'le journal des répétitions ne doit pas bouger sur un rejeu');
});

t('la source n’a ni shell, ni réseau, ni réécriture', () => {
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'compteur-repetitions.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const interdit of [/child_process/, /https?:\/\//, /\bfetch\(/, /renameSync|unlinkSync|truncateSync/]) {
    assert.ok(!interdit.test(src), `motif interdit présent : ${interdit}`);
  }
  assert.ok(/appendFileSync/.test(src));
});

console.log(`\n${passes}/${total_} vérifications passées — ${total_ - passes} échec(s).`);
process.exit(process.exitCode || 0);
