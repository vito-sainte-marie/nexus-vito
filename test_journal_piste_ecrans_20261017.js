// Écrans Journal Piste et Pompes et index : libellés fail-closed, validation miroir du serveur, classement de page.
const assert = require('assert'); const fs = require('fs');
const R = require('./nexus-releves-piste.js');
const ok = (n, f) => { f(); console.log('ok -', n); };
ok('libellés des cinq états', () => {
  assert.equal(R.libelleEtat('conforme'), 'Contrôlé conforme');
  assert.equal(R.libelleEtat('tolere'), 'Écart toléré');
  assert.equal(R.libelleEtat('anomalie'), 'Anomalie détectée');
  assert.equal(R.libelleEtat('impossible'), 'Comparaison impossible');
});
ok('état inconnu => jamais conforme', () => { assert.equal(R.libelleEtat('zzz'), 'Non contrôlé — donnée manquante'); assert.equal(R.libelleEtat(undefined), 'Non contrôlé — donnée manquante'); });
ok('config par défaut valide', () => assert.deepEqual(R.validerConfigPiste(R.CONFIG_PISTE_DEFAUT), []));
const bad = (m) => R.validerConfigPiste({ ...JSON.parse(JSON.stringify(R.CONFIG_PISTE_DEFAUT)), ...m });
ok('seuil <= tolérance refusé', () => assert.ok(bad({ seuilL: 9 }).length));
ok('litres par unité <= 0 refusé', () => assert.ok(bad({ litresParUnite: 0 }).length));
ok('tolérance négative refusée', () => assert.ok(bad({ toleranceL: -1 }).length));
ok('délai hors 1..240 refusé', () => { assert.ok(bad({ delaiReleveManquantMin: 0 }).length); assert.ok(bad({ delaiReleveManquantMin: 241 }).length); });
ok('page Journal Piste classée manager', () => {
  const a = fs.readFileSync(__dirname + '/nexus-auth.js', 'utf8');
  assert.ok(a.includes("'NEXUS-Journal-Piste-v1.html'"));
});
ok('page sans total de ventes ni classement par personne', () => {
  const h = fs.readFileSync(__dirname + '/NEXUS-Journal-Piste-v1.html', 'utf8');
  assert.ok(!/total des ventes|classement|score|pompiste_id|filtre/i.test(h));
});
