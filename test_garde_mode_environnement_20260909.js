// Le dépôt et la base disent-ils le même état d'environnement ?
//
// `nexus-test` porte deux états logiques (arbitrage du 09/09/2026) :
// `TEST_NORMAL` et `PREPROD_REHEARSAL`. L'état est déclaré à DEUX endroits —
// la base et le registre du dépôt — et c'est leur DÉSACCORD qui est
// l'information. Chacune prise seule peut mentir sans qu'on le voie.
//
// La conséquence est concrète : une recette exécutée pendant une répétition
// juge des données structurées pour reproduire des cas Production, pas le jeu
// de recette normal. Ses verdicts porteraient sur autre chose que ce qu'on
// croit — en restant verts.
'use strict';
const path = require('path');
const assert = require('assert');
const G = require(path.join(__dirname, 'outils', 'garde-mode-environnement.js'));

const ouvert = (release = 'R1') => ({ projet_ref: 'nexus-test', release, cree_le: '2026-09-09T10:00:00Z', detruit_le: null });
const ferme = (release = 'R0') => ({ projet_ref: 'nexus-test', release, cree_le: '2026-09-01T10:00:00Z', detruit_le: '2026-09-01T18:00:00Z' });

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('recette normale, aucun cycle ouvert : accord', () => {
  const r = G.controler({ modeEnBase: 'TEST_NORMAL', cycles: [ferme()] });
  assert.strictEqual(r.code, 'ACCORD');
  assert.strictEqual(r.mode, 'TEST_NORMAL');
});

t('répétition en cours et cycle ouvert : accord, et la release est dite', () => {
  const r = G.controler({ modeEnBase: 'PREPROD_REHEARSAL', cycles: [ferme(), ouvert('2026.09.1')] });
  assert.strictEqual(r.code, 'ACCORD');
  assert.strictEqual(r.release, '2026.09.1');
});

t('base en RÉPÉTITION, registre vide : personne ne suit, personne ne nettoiera', () => {
  const r = G.controler({ modeEnBase: 'PREPROD_REHEARSAL', cycles: [ferme()] });
  assert.strictEqual(r.code, 'REPETITION_NON_SUIVIE');
});

t('base NORMALE, cycle resté ouvert : on croit une répétition en cours', () => {
  const r = G.controler({ modeEnBase: 'TEST_NORMAL', cycles: [ouvert('2026.09.1')] });
  assert.strictEqual(r.code, 'CYCLE_ORPHELIN');
  assert.deepStrictEqual(r.ouverts, ['nexus-test'], 'le cycle en cause doit être nommé');
});

t('deux cycles ouverts pour une seule base : contradiction', () => {
  const r = G.controler({ modeEnBase: 'PREPROD_REHEARSAL', cycles: [ouvert('A'), ouvert('B')] });
  assert.strictEqual(r.code, 'CYCLES_MULTIPLES');
  assert.deepStrictEqual(r.ouverts, ['A', 'B']);
});

t('mode NON LU : ce n’est pas « le mode normal »', () => {
  // Le piège serait de traiter l'absence comme la valeur par défaut. Une base
  // injoignable, une colonne renommée, un droit retiré : dans les trois cas on
  // ne sait pas, et « on ne sait pas » ne doit jamais devenir « tout va bien ».
  for (const v of [undefined, null, '', '   ']) {
    assert.strictEqual(G.controler({ modeEnBase: v, cycles: [] }).code, 'MODE_NON_LU');
  }
});

t('un mode hors vocabulaire est refusé, pas interprété', () => {
  const r = G.controler({ modeEnBase: 'PRESQUE_PROD', cycles: [] });
  assert.strictEqual(r.code, 'MODE_INCONNU');
  assert.strictEqual(r.mode, 'PRESQUE_PROD', 'la valeur fautive doit être rendue');
});

t('registre illisible : aucune conclusion', () => {
  assert.strictEqual(G.controler({ modeEnBase: 'TEST_NORMAL', cycles: null }).code, 'REGISTRE_ILLISIBLE');
  assert.strictEqual(G.controler({ modeEnBase: 'TEST_NORMAL', cycles: 'des cycles' }).code, 'REGISTRE_ILLISIBLE');
});

t('le vocabulaire est FERMÉ à deux valeurs', () => {
  assert.deepStrictEqual(G.MODES, ['TEST_NORMAL', 'PREPROD_REHEARSAL']);
});

t('le registre réel du dépôt est d’accord avec un Test normal', () => {
  const r = G.controler({ modeEnBase: 'TEST_NORMAL', cycles: G.lireCycles() });
  assert.strictEqual(r.code, 'ACCORD', 'aucun cycle ne doit traîner ouvert aujourd’hui');
});

console.log(`\n${n}/${n} vérifications passées — deux sources, une seule vérité, et leur désaccord est l’information.`);
