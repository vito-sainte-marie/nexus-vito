// Référence de début de quart ancienne (#160, 07/11/2026) : quand le dernier relevé validé date d'avant
// la veille (début Q1) ou d'avant le jour (début Q2), les compteurs ont tourné : saisie complète d'emblée,
// bandeau daté, alerte d'écart « depuis le … ». Référence de la veille : parcours rapide inchangé.
const assert = require('assert');
const fs = require('fs');
const R = require('./nexus-releves-piste.js');
const HTML = fs.readFileSync(require('path').join(__dirname, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(HTML), 'la garde doit passer sur la source');
    assert.ok(HTML.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(HTML.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}

// ---- Logique pure ----
t('veilleDe : veille, passage de mois et d\'année, entrée invalide', () => {
  assert.strictEqual(R.veilleDe('2026-11-07'), '2026-11-06');
  assert.strictEqual(R.veilleDe('2026-11-01'), '2026-10-31');
  assert.strictEqual(R.veilleDe('2026-01-01'), '2025-12-31');
  assert.strictEqual(R.veilleDe('n\'importe quoi'), null);
});
t('début Q1 : référence de la veille = pas ancienne ; plus ancienne = ancienne', () => {
  assert.strictEqual(R.referenceAncienne('2026-11-06', '2026-11-07', 'debut_q1'), false);
  assert.strictEqual(R.referenceAncienne('2026-11-07', '2026-11-07', 'debut_q1'), false);
  assert.strictEqual(R.referenceAncienne('2026-11-05', '2026-11-07', 'debut_q1'), true);
  assert.strictEqual(R.referenceAncienne('2026-10-01', '2026-11-07', 'debut_q1'), true);
});
t('début Q2 : référence du jour = pas ancienne ; antérieure = ancienne', () => {
  assert.strictEqual(R.referenceAncienne('2026-11-07', '2026-11-07', 'debut_q2'), false);
  assert.strictEqual(R.referenceAncienne('2026-11-06', '2026-11-07', 'debut_q2'), true);
});
t('aucune référence ou moment de fin : jamais ancienne', () => {
  assert.strictEqual(R.referenceAncienne(null, '2026-11-07', 'debut_q1'), false);
  assert.strictEqual(R.referenceAncienne('2026-11-01', '2026-11-07', 'fin_q1'), false);
});
t('libelleReference : jour, soir/matin et jj/mm', () => {
  assert.strictEqual(R.libelleReference('2026-11-05', 'fin_q2'), 'jeudi soir (05/11)');
  assert.strictEqual(R.libelleReference('2026-11-03', 'fin_q1'), 'mardi matin (03/11)');
  assert.strictEqual(R.libelleReference('', 'fin_q2'), '');
});
t('le classement des écarts de nuit est inchangé', () => {
  assert.strictEqual(R.classerEcartNuit(0).code, 'conforme');
  assert.strictEqual(R.classerEcartNuit(1).code, 'toleree');
  assert.strictEqual(R.classerEcartNuit(5).code, 'a_justifier');
  assert.strictEqual(R.classerEcartNuit(10).code, 'alerte_prioritaire');
  assert.strictEqual(R.classerEcartNuit(-1).code, 'diminution');
});

// ---- Source de l'écran ----
garde('chargerPrecedents garde la date et le moment de la référence ancienne',
  h => /select\('id, date, moment, cree_le[\s\S]{0,900}R\.referenceAncienne\(data\[0\]\.date, date, moment\)\) refAncienne = \{ date: data\[0\]\.date, moment: data\[0\]\.moment \}/.test(h),
  'R.referenceAncienne(data[0].date, date, moment)', 'false');
garde('le champ 2 derniers chiffres exige une référence non ancienne',
  h => /const rapide = ref && !modeComplet\[k\] && !refAncienne;/.test(h),
  '&& !refAncienne;', ';');
garde('le bandeau n\'apparaît qu\'une fois, sur la première pompe, avec la date',
  h => /const bandeauRefAncienne = \(refAncienne && pompe === 1\) \? `[^`]*Dernier relevé validé : \$\{esc\(R\.libelleReference[^`]*saisissez les 7 chiffres de chaque compteur/.test(h),
  '(refAncienne && pompe === 1)', '(refAncienne)');
garde('le bandeau est placé avant le premier champ',
  h => /\$\{bandeauRefAncienne\}\$\{R\.ORDRE_PHYSIQUE\[pompe\]\.map/.test(h),
  '${bandeauRefAncienne}${R.ORDRE_PHYSIQUE', '${R.ORDRE_PHYSIQUE');
garde('l\'alerte d\'écart dit « depuis le … » sur plusieurs jours',
  h => /Écart depuis le \$\{esc\(R\.libelleReference\(refAncienne\.date, refAncienne\.moment\)\)\}, sur plusieurs jours/.test(h),
  'Écart depuis le', 'Écart de nuit depuis le');
garde('la saisie complète est posée après la restauration du brouillon',
  h => { const a = h.indexOf('modeComplet = loc.modeComplet'); const b = h.indexOf('if (refAncienne) Object.keys(precedents).forEach(k => { modeComplet[k] = true'); return a > 0 && b > a; },
  'if (refAncienne) Object.keys(precedents).forEach(k => { modeComplet[k] = true', 'if (false) Object.keys(precedents).forEach(k => { modeComplet[k] = true');
garde('la revue nomme l\'écart depuis la référence ancienne',
  h => /if \(refAncienne\) Object\.keys\(txt\)[\s\S]{0,200}écart depuis le/.test(h),
  "if (refAncienne) Object.keys(txt)", "if (false) Object.keys(txt)");

console.log(n + ' épreuves OK');
