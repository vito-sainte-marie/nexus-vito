// Le script autonome 53_exec_test.sql doit contenir, mot pour mot et dans l'ordre,
// les trois migrations du dépôt puis le corps de 53, et finir par le rapport qui défait tout.
const fs = require('fs');
const assert = require('assert');
const D = 'outils/recette/anomalies_verifications/';
const exec = fs.readFileSync(D + '53_exec_test.sql', 'utf8');
const corps = fs.readFileSync(D + '53_annulation_createur.sql', 'utf8');
const migs = ['20261118120000_tarif_anomalies_verifications', '20261120124007_tarif_annulation_heure_serveur', '20261121100000_tarif_annulation_createur'];
let ok = 0;
function ep(nom, f) { f(); ok++; console.log('OK  ' + nom); }

ep('un seul begin et un seul rollback, rollback en dernier', () => {
  assert.strictEqual((exec.match(/^begin;$/gm) || []).length, 1);
  assert.strictEqual((exec.match(/^rollback;$/gm) || []).length, 1);
  assert.ok(/rollback;\s*$/.test(exec));
  assert.ok(!/^commit;/gm.test(exec));
});
ep('les trois migrations sont identiques aux fichiers, dans l\'ordre', () => {
  let pos = 0;
  migs.forEach(n => {
    const t = fs.readFileSync('supabase/migrations/' + n + '.sql', 'utf8');
    const bloc = '-- >>> DEBUT migration ' + n + '.sql\n' + t + '-- <<< FIN migration ' + n + '.sql\n';
    const i = exec.indexOf(bloc, pos);
    assert.ok(i >= 0, 'bloc absent ou hors ordre : ' + n);
    pos = i + bloc.length;
  });
});
ep('le corps de 53 est présent après les migrations', () => {
  const debut = corps.indexOf('\nbegin;\n');
  const reste = corps.slice(debut + '\nbegin;\n'.length);
  const i = exec.indexOf('-- >>> DEBUT corps de 53_annulation_createur.sql\n' + reste);
  assert.ok(i > exec.indexOf('FIN migration ' + migs[2]));
  assert.ok(/raise exception 'RAPPORT_53 %'/.test(exec));
});
ep('la garde du projet Test précède les migrations', () => {
  assert.ok(exec.indexOf('7678069749886157684') < exec.indexOf('DEBUT migration ' + migs[0]));
});
console.log(ok + ' épreuves OK');
