// Scanner tarifaire S2 : écarts de marge R5 en lecture seule, fonction partagée, 4 consommateurs, normaliseur Conseiller.
const assert = require('assert'), fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require('./nexus-conseiller.js'); const C = globalThis.NexusConseiller; require('./nexus-marge.js'); const M = globalThis.NexusMarge;
require('./nexus-produits-mesure.js'); const S = require('./nexus-scanner-tarifaire.js');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const periode = { debut: '2026-10-05', fin: '2026-11-09' };
const R = (article, ca, marge, categorie) => ({ article, categorie: categorie || 'Épicerie', ca, marge });
// Groupe de 6 : cinq à 50 %, un à 30 % (écart de 20 points, médiane 50 %)
const base = [R('A', 100, 50), R('B', 100, 50), R('C', 100, 50), R('D', 100, 50), R('E', 100, 50), R('BAS', 100, 30)];

// Fonction partagée
let e = M.ecartsMargeDeLaPeriode(base, { periode });
assert.strictEqual(e.length, 1); assert.strictEqual(e[0].article, 'BAS');
assert.strictEqual(e[0].candidate_id, 'LIVE-R5-Épicerie|BAS', 'candidate_id au format actuel');
assert.strictEqual(e[0].validee, false); assert.strictEqual(e[0].tailleGroupe, 6);
assert.strictEqual(M.idCandidatMarge('Épicerie', 'BAS'), e[0].candidate_id);
// Produits d'appel exclus
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, produitsAppel: new Set(['BAS']) }).length, 0, 'produit d\'appel exclu');
// Lignes propres : CA nul, marge négative, marge > CA écartées (ne forment pas le groupe)
const sales = base.concat([R('ZERO', 0, 0), R('NEG', 100, -5), R('TROP', 100, 120)]);
e = M.ecartsMargeDeLaPeriode(sales, { periode });
assert.deepStrictEqual(e.map(x => x.article), ['BAS']); assert.strictEqual(e[0].tailleGroupe, 6, 'lignes impropres hors groupe');
// Exclusion manuelle
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, exclusionsManuelles: new Set(['BAS']) }).length, 0, 'exclusion manuelle respectée');
// Validation : dans la période, hors période, autre règle
const dec = (o) => Object.assign({ rule_id: 'R5-MARGE-ECART', candidate_id: 'LIVE-R5-Épicerie|BAS', periode_reference_debut: periode.debut, periode_reference_fin: periode.fin }, o || {});
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec()] })[0].validee, true, 'validée pour la période');
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec({ periode_reference_debut: '2026-07-01', periode_reference_fin: '2026-07-31' })] })[0].validee, false, 'validation de juillet : ne vaut plus');
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec({ periode_reference_fin: '2026-11-08' })] })[0].validee, false, 'fin différente');
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec({ rule_id: 'S1-HAUSSE-PA' })] })[0].validee, false, 'autre règle');
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec({ candidate_id: 'LIVE-R5-Épicerie|A' })] })[0].validee, false, 'autre article');
assert.doesNotThrow(() => M.ecartsMargeDeLaPeriode([], {})); assert.doesNotThrow(() => M.ecartsMargeDeLaPeriode(null));
// Tolérance : Set, tableau d'articles, tableau de lignes { article }
for (const [nom, v] of [['Set', new Set(['BAS'])], ['tableau d\'articles', ['BAS']], ['tableau de lignes', [{ article: 'BAS' }]]]) {
  assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, produitsAppel: v }).length, 0, 'produitsAppel ' + nom);
  assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, exclusionsManuelles: v }).length, 0, 'exclusionsManuelles ' + nom);
}
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, produitsAppel: [{ article: 'AUTRE' }] }).length, 1, 'autre article : écart conservé');
// Format de période : AAAA-MM-JJ comparé des deux côtés
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode: { debut: '2026-10-05T00:00:00Z', fin: '2026-11-09T00:00:00Z' }, decisions: [dec()] })[0].validee, true, 'période ISO complète contre date simple');
assert.strictEqual(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec({ periode_reference_debut: '2026-10-05T00:00:00+00:00', periode_reference_fin: '2026-11-09T00:00:00+00:00' })] })[0].validee, true, 'décision en horodatage');
console.log('OK  fonction partagée');

// Rendu du bloc R5
const lignesS1 = [{ article: 'BAS', hausse: { impact: 10 } }, { article: 'X' }];
let A = S.affichageMarge(M.ecartsMargeDeLaPeriode(base, { periode }), lignesS1);
assert.strictEqual(A.total, 1); assert.strictEqual(A.premiers.length, 1); assert.strictEqual(A.premiers[0].aussi_hausse_pa, true);
assert.strictEqual(A.aussi_hausse_pa, 1); assert.strictEqual(A.valides.nb, 0); assert.strictEqual(A.reste.nb, 0);
A = S.affichageMarge(M.ecartsMargeDeLaPeriode(base, { periode, decisions: [dec()] }), lignesS1);
assert.strictEqual(A.total, 0); assert.strictEqual(A.valides.nb, 1, 'validé : sous-bloc replié');
// Top 10 + reste
const gros = []; for (let i = 0; i < 13; i++) { const c = 'Cat' + i; for (let k = 0; k < 5; k++) gros.push(R('p' + i + k, 100, 50, c)); gros.push(R('bas' + i, 100, 30 - i, c)); }
A = S.affichageMarge(M.ecartsMargeDeLaPeriode(gros, { periode }), []);
assert.strictEqual(A.total, 13); assert.strictEqual(A.premiers.length, 10); assert.strictEqual(A.reste.nb, 3);
assert.ok(A.premiers[0].gainPotentiel >= A.premiers[9].gainPotentiel, 'tri décroissant');
assert.strictEqual(A.ecart, Math.round((A.premiers.concat(A.reste.lignes).reduce((t, x) => t + x.gainPotentiel, 0)) * 100) / 100);
const ft = S.texteFicheMarge(e[0]);
assert.ok(/^Taux 30,0 %, médiane du groupe 50,0 % sur 6 références comparables : écart à vérifier\.$/.test(ft), ft);
assert.strictEqual(S.texteFicheMarge(null), null);
assert.ok(!/—/.test(JSON.stringify(S.TEXTES.marge)), 'pas de tiret cadratin');
assert.ok(/hypothèse à vérifier/.test(S.TEXTES.marge.ecart) && /Scanner NEXUS/.test(S.TEXTES.marge.lien));
console.log('OK  rendu du bloc R5');

// Normaliseur Conseiller
const n = x => C.normaliserScannerTarifaire(x);
assert.strictEqual(n({ article: 'A', perte: { impact: 3 } }).ruleId, 'S1-VENTE-PERTE');
assert.strictEqual(n({ article: 'A', cout_a_verifier: true }).ruleId, 'S1-COUT-SUSPECT');
assert.strictEqual(n({ article: 'A', hausse: { impact: 4 } }).ruleId, 'S1-HAUSSE-PA');
assert.strictEqual(n({ article: 'A' }), null);
const nv = n({ article: 'A', categorie: 'Épicerie', perte: { impact: 3 } });
assert.strictEqual(nv.cible, 'NEXUS-Produits-v1.html'); assert.strictEqual(nv.validable, false);
assert.strictEqual(n({ article: 'A', perte: {}, hausse: {} }).ruleId, 'S1-VENTE-PERTE', 'priorité à la vente à perte');
console.log('OK  normaliseur Conseiller');

// Non-régression des quatre consommateurs : tous appellent la fonction partagée, aucun ne refait son filtre
for (const f of ['NEXUS-Scanner-v1.html', 'nexus-app-donnees.js', 'nexus-brief-donnees.js', 'NEXUS-Capital-v1.html']) {
  const t = lire(f);
  assert.ok(/ecartsMargeDeLaPeriode\(/.test(t), f + ' appelle la fonction partagée');
}
// Aucune écriture dans Produits côté prix / R5 (lecture seule)
const prod = lire('NEXUS-Produits-v1.html');
assert.ok(/scannerNormalise\(/.test(prod) && /normaliserScannerTarifaire/.test(prod), 'Produits utilise le normaliseur');
// Changement attendu (fiche v2, actions autorisées) : le lien vers NEXUS-Scanner-v1.html est retiré de la vue ; la page Scanner reste identique à Production (épreuve dédiée).
assert.ok(!/href="NEXUS-Scanner-v1\.html"/.test(prod), 'plus de lien d\'écran vers l\'ancien Scanner');
assert.ok(!/journal_decisions[^;\n]*\.(insert|upsert|update|delete)\(/.test(prod), 'Produits n\'écrit pas dans journal_decisions');
assert.ok(!/\.from\(['"](produits_appel|marge_exceptions|journal_decisions)['"]\)\s*\.(insert|upsert|update|delete)/.test(prod));
console.log('OK  consommateurs et lecture seule');
