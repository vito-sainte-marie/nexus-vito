// Épreuves du scénario Kecy (#160, 04/11/2026) : une valeur corrigée à l'écran après envoi
// doit atteindre le serveur par la RPC tracée, une pompe bloquée ne part jamais, le début de Q2
// affiche le recul, et la règle de Frédéric sur les 2 derniers chiffres est explicite.
const assert = require('assert');
const fs = require('fs');
const R = require('./nexus-releves-piste.js');
const HTML = fs.readFileSync(require('path').join(__dirname, 'NEXUS-Releves-Piste-v1.html'), 'utf8');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }

// Chaque garde source est éprouvée : la mutation (première occurrence du littéral) doit la faire échouer.
function garde(nom, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(HTML), 'la garde doit passer sur la source');
    assert.ok(HTML.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    const mute = HTML.replace(litteral, remplacement);
    assert.ok(!regle(mute), 'la garde doit rougir sur la source mutée');
  });
}

// ---- Logique pure ----
t('ecartsServeur : repère la valeur corrigée à l\'écran, ignore le reste', () => {
  const srv = { '1-GO': { valeur_sept_chiffres: '0001000' }, '1-SP': { valeur_sept_chiffres: '0002000' } };
  assert.deepStrictEqual(R.ecartsServeur({ '1-GO': '0001001', '1-SP': '0002000' }, srv), ['1-GO']);
  assert.deepStrictEqual(R.ecartsServeur({ '1-GO': '12', '1-SP': '0002000' }, srv), []);
});
t('valeursIdentiques : même valeur sur deux pompes, jamais sur la même pompe', () => {
  const d = R.valeursIdentiques({ '1-GO': '0001000', '2-GO': '0001000', '3-SP': '0005000', '4-SP': '0005000', '1-SP': '0000001' });
  assert.deepStrictEqual(d['1-GO'], ['2-GO']);
  assert.deepStrictEqual(d['3-SP'], ['4-SP']);
  assert.strictEqual(d['1-SP'], undefined);
  assert.deepStrictEqual(R.valeursIdentiques({ '1-GO': '0001000', '1-SP': '0001000' }), {});
});
t('scénario Kecy : recul au début de Q2 est bloquant sans motif, débloqué avec motif', () => {
  const pre = { '2-SP': 5000 };
  assert.strictEqual(R.revueAnomalies({ '2-SP': '0004000' }, pre, {}, 'debut_q2').lignes.find(l => l.clef === '2-SP').bloquant, true);
  assert.strictEqual(R.revueAnomalies({ '2-SP': '0004000' }, pre, { '2-SP': 'faute de frappe' }, 'debut_q2').lignes.find(l => l.clef === '2-SP').bloquant, false);
});

// ---- Source de l'écran ----
garde('a) synchroniser réécrit par la RPC tracée les valeurs corrigées après envoi',
  h => /R\.ecartsServeur\(saisies, serveur\.valeurs\)[\s\S]{0,200}corrigerTracee\(k/.test(h),
  'R.ecartsServeur(saisies, serveur.valeurs)', 'R.ecartsServeur({}, serveur.valeurs)');
garde('a) la correction passe par carburant_index_corriger_valeur avec un motif',
  h => /async function corrigerTracee[\s\S]{0,600}carburant_index_corriger_valeur[\s\S]{0,400}p_motif: motif/.test(h),
  "rpc('carburant_index_corriger_valeur', { p_valeur_id: v.id, p_nouvelle_valeur_sept_chiffres: saisies[k]", "rpc('autre_rpc', { p_valeur_id: v.id, p_nouvelle_valeur_sept_chiffres: saisies[k]");
garde('b) valider réécrit toute valeur différente, pas seulement celles avec motif',
  h => /const different = v\.valeur_sept_chiffres !== saisies\[k\];[\s\S]{0,80}if \(different \|\| justifie\)/.test(h),
  'if (different || justifie)', 'if (justifie)');
garde('b) valider refuse de finaliser si une correction échoue',
  h => /!\(await corrigerTracee\(k, motifs\[k\] \|\| MOTIF_CORRECTION_AUTO\)\) && different\) \{ alert/.test(h),
  '&& different) { alert', '&& false) { alert');
garde('c) la pompe suivante part avec la pompe affichée comme limite',
  h => /if \(a === 'suiv'\) \{ await synchroniser\(pompe\);/.test(h),
  "await synchroniser(pompe);", "await synchroniser();");
garde('c) une pompe bloquée par un recul sans motif n\'est jamais envoyée',
  h => /p <= jusqua && R\.ORDRE_PHYSIQUE\[p\]\.every\([^\n]*!reculBloquant\(/.test(h),
  '&& !reculBloquant(`${p}-${pr}`)));', '));');
garde('d) le champ de début en saisie complète affiche le recul et le motif hors début Q1',
  h => /moment !== 'debut_q1' && recul\(k\)\) \{\s*bloc \+= `[^`]*data-motif="\$\{k\}"/.test(h),
  "moment !== 'debut_q1' && recul(k)) {", "moment === 'debut_q1' && recul(k)) {");
garde('e) l\'écran de pompe signale une valeur identique à une autre pompe',
  h => /bloc \+= alerteDoublon\(k, v\);\s*if \(R\.estSeptChiffres\(v\) && moment === 'debut_q1'/.test(h) && /R\.valeursIdentiques\(saisies\)\[k\]/.test(h),
  'R.valeursIdentiques(saisies)[k]', 'R.valeursIdentiques({})[k]');
garde('e) la revue liste les doublons sans les rendre bloquants',
  h => /const dbl = R\.valeursIdentiques\(saisies\);[\s\S]{0,400}class="alerte indic">\$\{noms\(k\)\} : même valeur/.test(h),
  'const dbl = R.valeursIdentiques(saisies);', 'const dbl = {};');
garde('f) 2 derniers chiffres différents : message explicite, saisie à 7 chiffres sur le même écran',
  h => h.indexOf('Les 2 derniers chiffres ne correspondent pas. Tapez les 7 chiffres du compteur.') >= 0 && /deuxDiff\[k\] = true;[^\n]*\n\s*sauverLocal\(\); rendre\(\); if \(deuxDiff\[k\]\) focus\(k\)/.test(h),
  'Les 2 derniers chiffres ne correspondent pas.', 'Les chiffres ne correspondent pas.');
garde('f) le message n\'est levé que par l\'écart des 2 chiffres, pas silencieusement',
  h => /else \{ modeComplet\[k\] = true; deuxDiff\[k\] = true;/.test(h),
  'deuxDiff[k] = true;', '');
garde('règle de Frédéric : la fin de quart reste en 7 chiffres, sans saisie rapide',
  h => /function champ\(p, pr\) \{\s*if \(R\.estDebut\(moment\)\) return champDebut\(p, pr\);/.test(h),
  'if (R.estDebut(moment)) return champDebut(p, pr);', 'return champDebut(p, pr);');
console.log(n + '/' + n + ' réussies');
