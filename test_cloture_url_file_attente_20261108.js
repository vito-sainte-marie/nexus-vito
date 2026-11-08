// A3 (Guardian 6721931366, 08/11/2026) : le quart est porté dans l'URL du fil de fin de quart ; les comptages de clôture
// passent par la file idempotente, reprise automatique au retour du réseau, brouillon conservé jusqu'à l'écriture.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const FIL = require('./nexus-fil-fin-quart.js');
const INV = lire('NEXUS-Inventaire-v1.html');
const APP = lire('NEXUS-App-v1.html');
const PISTE = lire('NEXUS-Releves-Piste-v1.html');
const FILSRC = lire('nexus-fil-fin-quart.js');
const corps = (src, entete) => {
  const i = src.indexOf(entete); if (i < 0) return '';
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(j, k + 1); } }
  return '';
};
const CLOT = corps(INV, 'async function validerCloture()');

// ---- URL du fil ----
t('cibleDe lit quart et jour d\'une URL de fil', () => {
  const c = FIL.cibleDe('?fil=fin-quart&etape=2&moment=cloture&quart=soir&jour=2026-11-07');
  assert.deepStrictEqual(c, { quart: 'soir', jour: '2026-11-07' });
});
t('cibleDe refuse un quart inconnu, un jour mal formé et une URL hors fil', () => {
  assert.strictEqual(FIL.cibleDe('?fil=fin-quart&quart=nuit&jour=2026-11-07'), null);
  assert.strictEqual(FIL.cibleDe('?fil=fin-quart&quart=soir&jour=hier'), null);
  assert.strictEqual(FIL.cibleDe('?quart=soir&jour=2026-11-07'), null);
});
t('urlEtape et urlApres propagent la cible ; sans cible, l\'URL ne change pas', () => {
  const cible = { quart: 'matin', jour: '2026-11-06' };
  assert.ok(FIL.urlEtape(1, 'cloture', null, cible).includes('quart=matin&jour=2026-11-06'));
  assert.ok(!FIL.urlEtape(1, 'cloture', null).includes('quart='));
  assert.ok(!FIL.urlEtape(1, 'cloture', null, { quart: 'x', jour: 'y' }).includes('quart='));
});
t('App, Relevés Piste et Inventaire portent la cible de bout en bout', () => {
  assert.ok(/cibleFermeture\s*=\s*\{\s*quart:\s*quartDuJour,\s*jour:\s*todayISO\s*\}/.test(APP));
  assert.ok(/FIL\.cibleDe\(location\.search\)/.test(PISTE));
  assert.ok(/cibleDe\(location\.search\)/.test(INV) && /jourQuartFil = cibleFil\.jour/.test(INV));
  assert.ok(/function dateDuQuart\(\) \{ return jourQuartFil \|\| dateISO\(\); \}/.test(INV));
});
garde('cibleDe vérifie le format du jour', FILSRC, c => /\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(c), '\\d{4}-\\d{2}-\\d{2}', '.*');
garde('Inventaire : la cible l\'emporte sur le quart du shift', INV, c => /quartActuel = cibleFil\.quart/.test(c), 'quartActuel = cibleFil.quart', 'quartActuel = quartActuel');
garde('Relevés Piste : la cible est transmise à l\'étape suivante', PISTE, c => /FIL\.cibleDe\(location\.search\)/.test(c), 'FIL.cibleDe(location.search)', 'null');
garde('App : la cible de fermeture est passée à l\'URL de reprise', APP, c => /faitsFermeture, cibleFermeture\)/.test(c), 'faitsFermeture, cibleFermeture)', 'faitsFermeture)');

// ---- File d'attente de la clôture ----
t('les comptages de clôture passent par un upsert idempotent, plus par un insert nu', () => {
  assert.ok(/ecrireComptageCloture\(payload\)/.test(CLOT));
  assert.ok(!/from\('inventaire_comptages'\)\.insert\(/.test(CLOT));
  assert.ok(/onConflict: 'idempotency_key', ignoreDuplicates: true/.test(corps(INV, 'async function ecrireComptageCloture')));
});
t('hors ligne : le comptage va dans la file locale et le brouillon reste', () => {
  assert.ok(/ajouterFileSync\(\{ idempotencyKey, payload/.test(corps(INV, 'async function ecrireComptageCloture')));
  assert.ok(/if \(enAttente\.length\) \{\s*[^}]*sauvegarderDraft\('cloture'\)/.test(CLOT));
});
t('le brouillon n\'est effacé qu\'une fois la validation écrite, dans terminerCloture', () => {
  const T = corps(CLOT, 'const terminerCloture = async () =>');
  assert.ok(/effacerDraft\('cloture'\)/.test(T));
  assert.ok(T.indexOf('a_valide_cloture: true') < T.indexOf("effacerDraft('cloture')"));
  assert.ok(CLOT.indexOf("effacerDraft('cloture')") > CLOT.indexOf('const terminerCloture'));
});
t('reprise automatique : événement online, minuterie de secours, message clair', () => {
  assert.ok(/window\.addEventListener\('online', reprendreCloture\)/.test(INV));
  assert.ok(/setInterval\(reprendreCloture, 15000\)/.test(INV));
  assert.ok(/Pas de réseau : /.test(INV) && /l'envoi reprendra tout seul/.test(INV));
});
t('la reprise vide la file puis termine, sans rejouer deux fois', () => {
  const R = corps(INV, 'async function reprendreCloture()');
  assert.ok(/clotureRepriseEnCours/.test(R) && /tenterSynchronisationFileAttente\(\)/.test(R) && /r\.terminer\(\)/.test(R));
  assert.ok(R.indexOf('tenterSynchronisationFileAttente') < R.indexOf('r.terminer()'));
});
garde('upsert idempotent de la clôture', INV, c => /onConflict: 'idempotency_key', ignoreDuplicates: true/.test(corps(c, 'async function ecrireComptageCloture')), "onConflict: 'idempotency_key', ignoreDuplicates: true });\n      if (error) throw error;\n      retirerFileSync(idempotencyKey);\n      return true;", "});\n      if (error) throw error;\n      retirerFileSync(idempotencyKey);\n      return true;");
garde('échec réseau : mise en file', INV, c => /ajouterFileSync\(\{ idempotencyKey, payload/.test(corps(c, 'async function ecrireComptageCloture')), "ajouterFileSync({ idempotencyKey, payload, ajouteLe: new Date().toISOString() });\n      return false;", "return false;");
garde('brouillon sauvegardé quand des comptages attendent', INV, c => /if \(enAttente\.length\) \{[\s\S]{0,200}sauvegarderDraft\('cloture'\)/.test(c), "// Le brouillon reste la source tant que l'écriture n'a pas abouti ; la file locale porte les lignes à renvoyer.\n      sauvegarderDraft('cloture');", "// vide");
garde('reprise au retour du réseau', INV, c => /addEventListener\('online', reprendreCloture\)/.test(c), "addEventListener('online', reprendreCloture)", "addEventListener('online', function(){})");
garde('minuterie de secours', INV, c => /setInterval\(reprendreCloture, 15000\)/.test(c), 'setInterval(reprendreCloture, 15000)', 'setInterval(function(){}, 15000)');
garde('la reprise attend la file vidée avant de terminer', INV, c => /if \(!tout\) return;/.test(c), 'if (!tout) return;', '');
garde('un échec ne passe plus pour un succès', INV, c => /if \(ok\) clotureEnregistres\.add\(p\.id\); else enAttente\.push\(p\);/.test(c), 'if (ok) clotureEnregistres.add(p.id); else enAttente.push(p);', 'clotureEnregistres.add(p.id);');

console.log(n + ' épreuves OK');
