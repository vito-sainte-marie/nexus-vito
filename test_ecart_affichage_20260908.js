// Épreuves de « une mesure absente n'est pas une mesure nulle »
// (nexus-mesure.js) et de l'affichage d'un écart de caisse
// (nexus-ecart-affichage.js).
//
// DEBUG-001. `NEXUS-Debug-v1.html` calculait couleur ET texte sur
// `a.ecart_total || 0` : un écart JAMAIS MESURÉ s'affichait « +0 € » et se
// peignait en VERT — la couleur de la conformité parfaite. Trois signaux
// mentaient ensemble, et l'absence de contrôle se présentait comme un contrôle
// réussi. C'est l'exact contraire du principe de la Bible : « une anomalie ne
// doit jamais être masquée par un affichage rassurant ».
//
// Le même défaut a été trouvé le même jour dans EVAL-001 et COACH-001. Ce
// n'est pas trois bugs, c'est un seul, recopié — d'où un propriétaire logique
// unique et ces épreuves qui le tiennent.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const M = require(path.join(__dirname, 'nexus-mesure.js'));
const E = require(path.join(__dirname, 'nexus-ecart-affichage.js'));

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

t('une absence est reconnue, un ZÉRO ne l’est pas', () => {
  for (const v of [null, undefined, '', '   ', 'abc', NaN, [], {}, true, false]) {
    assert.strictEqual(M.estAbsente(v), true, 'devrait être absent : ' + JSON.stringify(v));
    assert.strictEqual(M.valeurMesuree(v), null);
  }
  for (const v of [0, '0', -0, 3.5, '3.5', -12]) {
    assert.strictEqual(M.estAbsente(v), false, 'devrait être une mesure : ' + JSON.stringify(v));
  }
  assert.strictEqual(M.valeurMesuree(0), 0, 'zéro est une mesure, pas une absence');
  assert.strictEqual(M.valeurMesuree('0'), 0);
});

t('`Number([])` vaut 0 — un tableau vide ne doit PAS devenir une mesure nulle', () => {
  // La porte dérobée du défaut : accepter tout ce que JavaScript sait
  // convertir ferait rentrer l'absence sous forme de zéro.
  assert.strictEqual(M.estAbsente([]), true);
  assert.strictEqual(M.valeurMesuree([]), null);
});

t('un écart NON MESURÉ n’affiche ni chiffre, ni vert, ni rouge', () => {
  // Le défaut exact du 07/09.
  for (const v of [null, undefined, '']) {
    assert.strictEqual(E.libelleEcart(v), E.NON_MESURE, JSON.stringify(v));
    assert.ok(!/\d/.test(E.libelleEcart(v)), 'aucun chiffre : ' + E.libelleEcart(v));
    assert.strictEqual(E.classeEcart(v), 'neutre',
      'ni la couleur de la conformité, ni celle de l’anomalie');
  }
});

t('un écart de ZÉRO réellement mesuré reste conforme et vert', () => {
  // La moitié qui donne son sens à la précédente : effacer un contrôle réussi
  // priverait le manager d'une bonne nouvelle vérifiée.
  assert.strictEqual(E.libelleEcart(0), '0 €');
  assert.strictEqual(E.classeEcart(0), 'conforme');
  assert.strictEqual(E.classeEcart('0'), 'conforme');
});

t('un écart réel est affiché avec son signe et sa couleur d’anomalie', () => {
  assert.strictEqual(E.libelleEcart(12), '+12 €');
  assert.strictEqual(E.libelleEcart(-8), '-8 €');
  assert.strictEqual(E.classeEcart(12), 'anomalie');
  assert.strictEqual(E.classeEcart(-8), 'anomalie');
});

t('un écart qui s’arrondit à zéro n’est pas effacé', () => {
  // Défaut de l'original qu'on aurait pu recopier sans le voir : 0,40 €
  // s'affichait « +0 € » tout en étant peint en rouge — le texte niait ce que
  // la couleur signalait. Arrondir à zéro un écart non nul l'efface ; le
  // colorer en vert l'effacerait deux fois.
  assert.strictEqual(E.libelleEcart(0.4), '≈ 0 €');
  assert.strictEqual(E.libelleEcart(-0.4), '≈ 0 €');
  assert.strictEqual(E.classeEcart(0.4), 'anomalie', 'un écart reste un écart, même court');
  assert.strictEqual(E.classeEcart(-0.4), 'anomalie');
});

t('la ligne de détail traite piste et boutique de la même façon', () => {
  assert.strictEqual(E.libelleDetail(null, 0), 'Piste Non mesuré · Boutique 0 €');
  assert.strictEqual(E.libelleDetail(5, null), 'Piste +5 € · Boutique Non mesuré');
});

t('CONTRAT — l’écran Debug ne recalcule pas ces règles de son côté', () => {
  const brut = fs.readFileSync(path.join(__dirname, 'NEXUS-Debug-v1.html'), 'utf8');
  assert.ok(/NexusEcartAffichage\.libelleEcart/.test(brut) && /NexusEcartAffichage\.classeEcart/.test(brut),
    'l’écran doit consommer le module');
  // Commentaires ôtés : l'écran cite l'ancien code pour expliquer le défaut,
  // et un contrat qui juge la prose interdirait de documenter ce qu'on vient
  // de corriger.
  const code = brut
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  for (const motif of [/ecart_total\s*\|\|\s*0/, /ecart_piste\s*\|\|\s*0/, /ecart_boutique\s*\|\|\s*0/]) {
    assert.ok(!motif.test(code), 'le `|| 0` fautif ne doit plus exister dans le code : ' + motif);
  }
});

t('CONTRAT — la notion d’absence n’a qu’un propriétaire logique', () => {
  // Trouvée trois fois en une journée, elle serait recopiée une quatrième si
  // rien ne l'en empêchait — et les copies divergeraient.
  for (const fichier of ['nexus-ecart-affichage.js', 'nexus-evaluation-affichage.js']) {
    const src = fs.readFileSync(path.join(__dirname, fichier), 'utf8');
    assert.ok(/NexusMesure|nexus-mesure\.js/.test(src),
      `${fichier} doit consommer nexus-mesure.js`);
    assert.ok(!/function estAbsente?\s*\(/.test(src),
      `${fichier} ne doit pas redéfinir la notion d’absence`);
  }
});

console.log(`\n${passes}/${passes} vérifications passées — une absence de mesure ne se peint pas en vert.`);
