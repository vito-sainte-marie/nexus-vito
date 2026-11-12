// Tempo V2 — synthèse « En bref » : seulement ce que les cartes affichent, jamais de consigne.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const trois = (p, b, f) => [{ nom: 'Piste', evol: p }, { nom: 'Boutique', evol: b }, { nom: 'FDJ', evol: f }];
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;
const SUPERLATIF = /\b(meilleur|pire|plus [a-zéèê]+|moins [a-zéèê]+|le mieux|record|maximal|minimal)\b/i;

t('reprend mot pour mot les évolutions des trois cartes', () => {
  const s = T.syntheseEnBref({ activites: trois('+3,2 % · Hausse confirmée', 'Marge stable', '−1,0 % · Variation habituelle'), faible: false, decouverte: '' });
  assert.ok(s.includes('Piste : +3,2 % · Hausse confirmée'));
  assert.ok(s.includes('Boutique : Marge stable'));
  assert.ok(s.includes('FDJ : −1,0 % · Variation habituelle'));
});
t('aucun chiffre qui ne soit pas dans les cartes', () => {
  const entree = { activites: trois('+3,2 % · Hausse confirmée', 'Marge en baisse', 'Tendance non déterminée'), faible: true, decouverte: 'Le gazole recule le mardi' };
  const vus = (JSON.stringify(entree).match(/\d+(?:,\d+)?/g) || []).sort();
  const sortis = (T.syntheseEnBref(entree).match(/\d+(?:,\d+)?/g) || []).sort();
  assert.deepStrictEqual(sortis, vus);
});
t('comparabilité faible : dit que ces évolutions ne sont pas des conclusions, dans la même phrase', () => {
  const s = T.syntheseEnBref({ activites: trois('+3,2 % · Hausse confirmée', 'Marge stable', 'Marge stable'), faible: true, decouverte: '' });
  assert.ok(s.includes('ces évolutions ne sont pas des conclusions'));
  assert.strictEqual(s.split('. ').length, 1, 'une seule phrase : ' + s);
});
t('comparabilité correcte ou inconnue : rien sur les conclusions', () => {
  [false, null].forEach(faible => assert.ok(!/conclusions/.test(T.syntheseEnBref({ activites: trois('+1,0 % · Variation habituelle', 'Marge stable', 'Marge stable'), faible }))));
});
t('activité sans comparaison : nommée comme telle, sans tendance', () => {
  [ 'Tendance non déterminée', '', undefined ].forEach(v => {
    const s = T.syntheseEnBref({ activites: trois('+3,2 % · Hausse confirmée', v, 'Marge stable'), faible: false });
    assert.ok(s.includes('Boutique : pas de comparaison disponible'));
    assert.ok(!/Tendance non déterminée/.test(s));
  });
});
t('ajoute le titre de la première découverte, sans chiffre inventé', () => {
  const s = T.syntheseEnBref({ activites: trois('Marge stable', 'Marge stable', 'Marge stable'), faible: false, decouverte: 'Le gazole recule le mardi.' });
  assert.ok(s.endsWith('Première découverte : Le gazole recule le mardi.'));
});
t('sans découverte : pas de phrase de découverte', () => {
  assert.ok(!/découverte/.test(T.syntheseEnBref({ activites: trois('Marge stable', 'Marge stable', 'Marge stable'), faible: false, decouverte: '' })));
});
t('aucun verbe d\'action, tiret long ou superlatif, tous cas confondus', () => {
  const cas = [[true, 'Le gazole recule le mardi'], [false, ''], [null, 'Un mois inhabituel']];
  cas.forEach(([faible, decouverte]) => ['+3,2 % · Hausse confirmée', 'Tendance non déterminée', 'Marge en baisse'].forEach(v => {
    const s = T.syntheseEnBref({ activites: trois(v, v, v), faible, decouverte });
    assert.ok(!/—|–/.test(s), 'tiret long : ' + s);
    assert.ok(!VERBES.test(s), 'consigne : ' + s);
    assert.ok(!SUPERLATIF.test(s), 'superlatif : ' + s);
  }));
});
t('sans activité : texte vide, pas de plantage', () => {
  assert.strictEqual(T.syntheseEnBref({ activites: [] }), '');
  assert.strictEqual(T.syntheseEnBref(), '');
});
t('la page branche la synthèse sur les trois cartes, la comparabilité et la première découverte', () => {
  assert.ok(/id="enBrefTexte"/.test(html));
  assert.ok(/window\.NexusTempo\.syntheseEnBref\(/.test(html));
  assert.ok(/\['indPiste', 'Piste'\], \['indBoutique', 'Boutique'\], \['indFdj', 'FDJ'\]/.test(html));
  assert.ok(/enBrefEtat\.faible = comp\.faible/.test(html));
  assert.ok(/if \(slot === 0\) \{ enBrefEtat\.decouverte = f\.titre/.test(html));
});
console.log(echecs ? echecs + ' échec(s)' : 'tout est vert');
process.exit(echecs ? 1 : 0);
