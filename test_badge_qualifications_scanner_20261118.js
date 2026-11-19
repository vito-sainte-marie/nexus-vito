// Lot Scanner tarifaire, écran #332 (Guardian 6984645857, point 1) :
// trois qualifications ajoutées au composant NexusBadgeEtat. Présentation seulement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const B = require('./nexus-badge-etat.js');
const src = fs.readFileSync(path.join(__dirname, 'nexus-badge-etat.js'), 'utf8');

const LIB = { estimation: 'Estimation', demontre: 'Démontré', 'non-calculable': 'Non calculable' };
Object.keys(LIB).forEach(k => {
  t('qualification « ' + k + ' » : étiquette grise cerclée, libellé exact, sans pictogramme ni couleur', () => {
    const h = B.qualification(k);
    assert.strictEqual(h, '<span class="nbe-qualif" data-axe="qualification" data-etat="' + k + '">' + LIB[k] + '</span>');
    assert.ok(!/<svg|style=|&#|[←-⯿\u{1F300}-\u{1FAFF}]/u.test(h));
  });
});
t('qualification : même rendu que « Opportunité » et « Recommandation » (même classe, même axe)', () => {
  const forme = h => h.replace(/data-etat="[^"]*"/, '').replace(/>[^<]*</, '><');
  assert.strictEqual(forme(B.qualification('estimation')), forme(B.qualification('opportunite')));
  assert.strictEqual(forme(B.qualification('demontre')), forme(B.qualification('recommandation')));
});
t('qualification : valeur inconnue → repli neutre échappé, pas d\'étiquette inventée', () => {
  const h = B.qualification('<img src=x onerror=1>');
  assert.ok(!/<img/.test(h));
  assert.ok(/data-axe="neutre"/.test(h));
  assert.ok(!/data-axe="qualification"/.test(h));
});
t('qualification : un libellé de l\'Object.prototype n\'est pas une qualification', () => {
  ['constructor', 'toString', '__proto__', 'hasOwnProperty'].forEach(k => assert.ok(!/data-axe="qualification"/.test(B.qualification(k)), k));
});
t('« À vérifier » reste une gravité, pas une qualification', () => {
  assert.ok(/data-axe="gravite"/.test(B.gravite('a-verifier')));
  assert.ok(!/a-verifier/.test(src.match(/LIB_QUALIF\s*=\s*\{[^}]*\}/)[0]));
});
t('aucun effet sur les badges existants : opportunité, recommandation, gravités, traitements', () => {
  assert.ok(/>Opportunité</.test(B.qualification('opportunite')));
  assert.ok(/>Recommandation</.test(B.qualification('recommandation')));
  ['critique', 'a-verifier', 'information', 'conforme'].forEach(k => assert.ok(/data-axe="gravite"/.test(B.gravite(k)), k));
  assert.ok(/data-axe="traitement"/.test(B.traitement('exclu')));
  assert.ok(/data-axe="action"/.test(B.action('agir')));
});
t('aucun effet sur la couleur : la classe nbe-qualif ne porte qu\'un style, commun aux cinq', () => {
  Object.keys(LIB).forEach(k => assert.ok(!B._CSS.includes('data-etat="' + k + '"'), 'pas de style propre à ' + k));
});
console.log('test_badge_qualifications_scanner : ' + n + ' épreuves OK');
