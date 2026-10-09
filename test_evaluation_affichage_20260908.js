// Épreuves de l'affichage d'une évaluation (nexus-evaluation-affichage.js).
//
// EVAL-001. `NEXUS-Evaluation-Employe-v1.html` affichait `(ev.total || 0)` :
// un salarié dont l'évaluation existait sans être chiffrée lisait « 0.0 / 5 »
// sur l'écran qu'il consulte lui-même. Un reproche fabriqué à partir d'un trou
// de donnée.
//
// Ces épreuves défendent UNE distinction, dans les deux sens :
//   · une absence ne doit jamais devenir un chiffre ;
//   · un zéro réellement attribué ne doit jamais devenir une absence.
// La seconde compte autant que la première : effacer une évaluation réelle
// serait aussi malhonnête que d'en inventer une.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'nexus-evaluation-affichage.js');
const A = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

t('une évaluation NON chiffrée n’affiche aucun chiffre', () => {
  // Le défaut du 07/09, dans ses trois formes.
  for (const ev of [
    { kind: 'Évaluation Renfort', total: null },
    { kind: 'Évaluation Renfort', total: undefined },
    { kind: 'Évaluation prime', prime_pct: null },
    { kind: 'Contrôle tenue', points: null },
  ]) {
    const s = A.libelleScore(ev);
    assert.strictEqual(s, A.NON_EVALUE, JSON.stringify(ev) + ' -> ' + s);
    assert.ok(!/\d/.test(s), 'aucun chiffre ne doit apparaître : ' + s);
  }
});

t('un ZÉRO réellement attribué reste affiché comme un zéro', () => {
  // La moitié qui donne son sens à la précédente. Sans elle, on aurait
  // simplement cessé d'afficher les mauvaises notes — ce qui serait mentir
  // dans l'autre sens.
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation Renfort', total: 0 }), '0.0 / 5');
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation prime', prime_pct: 0 }), '0%');
  assert.strictEqual(A.libelleScore({ kind: 'Contrôle tenue', points: 0 }), '0 pts');
});

t('les notes réelles sont rendues telles quelles', () => {
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation Renfort', total: 4.25 }), '4.3 / 5');
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation Renfort', total: 5 }), '5.0 / 5');
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation prime', prime_pct: 80 }), '80%');
  assert.strictEqual(A.libelleScore({ kind: 'Contrôle tenue', points: 7 }), '7 pts');
});

t('une valeur illisible vaut ABSENCE, jamais zéro', () => {
  // Ne pas savoir lire une donnée n'autorise pas à en inventer une.
  for (const v of ['', '   ', 'n/a', NaN, {}, []]) {
    assert.strictEqual(A.libelleScore({ kind: 'Évaluation Renfort', total: v }), A.NON_EVALUE,
      'total=' + JSON.stringify(v));
  }
  // Une chaîne numérique reste une mesure — elle vient d'une base, pas d'une
  // supposition.
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation Renfort', total: '3.5' }), '3.5 / 5');
  assert.strictEqual(A.libelleScore({ kind: 'Évaluation prime', prime_pct: '0' }), '0%');
});

t('un type d’évaluation inconnu ne fabrique pas de note', () => {
  assert.strictEqual(A.libelleScore({ kind: 'Type futur', total: 4 }), A.NON_EVALUE,
    'un type qu’on ne sait pas lire ne doit pas être chiffré au hasard');
  assert.strictEqual(A.libelleScore(null), A.NON_EVALUE);
  assert.strictEqual(A.libelleScore(undefined), A.NON_EVALUE);
  assert.strictEqual(A.libelleScore({}), A.NON_EVALUE);
});

t('l’écran peut distinguer l’état neutre pour ne pas le styler en note', () => {
  assert.strictEqual(A.estNonEvalue({ kind: 'Évaluation Renfort', total: null }), true);
  assert.strictEqual(A.estNonEvalue({ kind: 'Évaluation Renfort', total: 0 }), false,
    'un zéro est une note, il doit rester stylé comme une note');
});

t('CONTRAT — l’écran ne recalcule pas ce libellé de son côté', () => {
  // Une règle métier n'a qu'un propriétaire logique (Bible, « Architecture de
  // vérité »). Le jour où l'écran refait `|| 0` dans son coin, le défaut
  // revient sans que ce fichier bronche.
  const brut = fs.readFileSync(path.join(__dirname, 'NEXUS-Evaluation-Employe-v1.html'), 'utf8');
  assert.ok(/NexusEvaluationAffichage\.libelleScore/.test(brut),
    'l’écran doit consommer le module, pas reconstruire le libellé');
  // Commentaires ôtés AVANT de chercher le motif fautif : l'écran cite
  // l'ancien code pour expliquer le défaut, et un contrat qui juge la prose
  // interdirait de documenter ce qu'on vient de corriger. Il doit juger le
  // code exécuté, rien d'autre.
  const code = brut
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const motif of [/\(ev\.total\s*\|\|\s*0\)/, /ev\.prime_pct\s*\|\|\s*0/, /ev\.points\s*\|\|\s*0/]) {
    assert.ok(!motif.test(code), 'le `|| 0` fautif ne doit plus exister dans le code : ' + motif);
  }
});

console.log(`\n${passes}/${passes} vérifications passées — une absence n’est pas un zéro, et un zéro n’est pas une absence.`);
