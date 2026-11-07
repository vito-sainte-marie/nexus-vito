// Contrôle inventaire — Manager : pastille d'état du quart lisible sur iPhone (07/11/2026).
// Présentation seulement : libellé court en vue mobile, libellé complet en vue bureau et dans title.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/NEXUS-Inventaire-Manager-v1.html', 'utf8');
let n = 0;
function t(nom, f) { f(); n++; console.log('  ok - ' + nom); }

const fn = html.match(/function texteCourtEtat\(texte\) \{[\s\S]*?\n  \}/);
assert(fn, 'texteCourtEtat introuvable');
const texteCourtEtat = new Function(fn[0] + '; return texteCourtEtat;')();

t('libellé court en vue mobile : clôturé incomplet / complet, mêmes nombres', () => {
  assert.strictEqual(texteCourtEtat('Quart clôturé · comptage de clôture incomplet (4 manquants)'), 'Clôturé · incomplet (4 manquants)');
  assert.strictEqual(texteCourtEtat('Quart clôturé · comptage de clôture incomplet (1 manquant)'), 'Clôturé · incomplet (1 manquant)');
  assert.strictEqual(texteCourtEtat('Quart clôturé · comptage de clôture complet'), 'Clôturé · complet');
});
t('les autres libellés ne sont pas modifiés', () => {
  ['Pas encore démarré', 'Quart en cours', "Quart clôturé — le comptage de clôture n'a pas encore commencé."].forEach(x =>
    assert.strictEqual(texteCourtEtat(x), x));
});
t('majEntete pose le libellé complet en title et les deux libellés dans la pastille', () => {
  const m = html.match(/function majEntete\([^)]*\) \{[\s\S]*?\n  \}/);
  assert(m);
  assert(/pastille\.title = texte/.test(m[0]));
  assert(/st-long/.test(m[0]) && /st-court/.test(m[0]) && /texteCourtEtat\(texte\)/.test(m[0]));
  assert(/\.textContent = texte/.test(m[0]), 'libellé injecté en textContent, jamais en HTML');
});
t('CSS : badge limité à l\'en-tête, libellé court seulement hors vue bureau', () => {
  assert(/\.entete-etat \.st\{[^}]*display:inline-block[^}]*max-width:100%[^}]*white-space:normal[^}]*line-height:1\.35[^}]*padding:5px 12px[^}]*border-radius:12px[^}]*text-align:left/.test(html));
  assert(/\.entete-etat \.st-court\{display:none\}/.test(html));
  assert(/body:not\(\.nexus-desktop\) \.entete-etat \.st-court\{display:inline\}/.test(html));
  assert(/body:not\(\.nexus-desktop\) \.entete-etat \.st-long\{display:none\}/.test(html));
  // la règle .st du composant n'est pas touchée
  const pil = fs.readFileSync(__dirname + '/nexus-composants-pilotage.js', 'utf8');
  assert(pil.includes('.st{display:inline-flex;align-items:center;height:30px;padding:0 14px;border-radius:15px'));
});
console.log(n + ' vérifications passées');
