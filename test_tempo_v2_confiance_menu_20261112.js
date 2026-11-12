// Tempo V2 — lot « confiance par activité et bascule du menu ».
const assert = require('assert');
const fs = require('fs');
global.window = global;
require('./nexus-tempo.js');
const T = window.NexusTempo;
const lire = f => fs.readFileSync(__dirname + '/' + f, 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const jourISO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const jours = (n, depart) => Array.from({ length: n }, (_, i) => ({ date: jourISO(depart - i), valeur: 1000 + i }));

t('Piste : même chiffre que la page V1 sur les mêmes jours', () => {
  const js = jours(70, 80);
  const v1 = js.map(j => ({ date: j.date, jourSemaine: T.dateLocale(j.date).getDay(), ventePiste: j.valeur, venteBoutique: 0 }))
    .sort((a, b) => a.date < b.date ? -1 : 1);
  const classement = T.calculerClassement(T.regrouperParJourSemaine(v1));
  const c = T.confianceActivite(js);
  assert.strictEqual(c.pct, T.calculerConfianceGlobale(v1, classement));
  assert.strictEqual(c.niveau, T.calculerMaturite(v1).niveau);
  assert.strictEqual(c.composantes.reduce((s, k) => s + k.points, 0) >= c.pct - 2, true);
});

t('FDJ : calculée sur ses propres jours, indépendante de la piste', () => {
  const fdj = Array.from({ length: 20 }, (_, i) => ({ date: jourISO(25 - i), nb_quarts_controles: 2, ca_grattage: 100, caisse_tirages: 50 }));
  const cf = T.confianceActivite(T.joursCaFdjComplets(fdj));
  const cp = T.confianceActivite(jours(70, 80));
  assert.notStrictEqual(cf.pct, cp.pct);
  assert.strictEqual(cf.composantes.find(k => k.nom === 'Volume').detail, '20 jours complets');
});

t('aucun jour : niveau 1, 0 %', () => {
  const c = T.confianceActivite([]);
  assert.strictEqual(c.niveau, 1);
  assert.strictEqual(c.pct, 0);
});

t('page V2 : Boutique « non calculable », aucun emoji, aucun code G, pas de lecture en plus', () => {
  const h = lire('NEXUS-Tempo-v2.html');
  assert.ok(h.includes('Niveau non calculable : la boutique n\\u2019a pas de données par jour'));
  assert.ok(h.includes('id="confiances"'));
  assert.ok(h.includes('T.confianceActivite(T.joursLitresCompletsPiste(rAudMois.data))'));
  assert.ok(h.includes('T.confianceActivite(T.joursCaFdjComplets(rFdjMois.data))'));
  const bloc = h.slice(h.indexOf('Niveau de confiance par activité :'), h.indexOf('Niveau de confiance par activité :') + 2500);
  assert.ok(!/\p{Extended_Pictographic}/u.test(bloc), 'emoji dans le rendu');
  assert.ok(!/\(G\d\)/.test(bloc));
  assert.strictEqual((h.match(/\.from\(/g) || []).length, 16);
});

t('rendu : les libellés de confiance ne passent pas par l\'emoji du moteur', () => {
  const h = lire('NEXUS-Tempo-v2.html');
  assert.ok(!/\.emoji/.test(h));
});

t('menu : aucun lien Tempo V1 hors page V1, nexus-auth.js, forfait et redirection', () => {
  const permis = ['NEXUS-Tempo-v1.html', 'nexus-auth.js', 'nexus-forfait.js', 'NEXUS-App-v1.html', 'nexus-tempo.js'];
  const fichiers = fs.readdirSync(__dirname).filter(f => /\.(html|js)$/.test(f) && !f.startsWith('test_'));
  const trouves = fichiers.filter(f => lire(f).includes('NEXUS-Tempo-v1.html') && !permis.includes(f));
  assert.deepStrictEqual(trouves, []);
  for (const f of ['nexus-raccourcis-catalogue.js', 'nexus-desktop.js', 'nexus-recherche.js', 'nexus-conseiller.js']) {
    assert.ok(!lire(f).includes('NEXUS-Tempo-v1.html'), f);
  }
});

t('forfait : V2 et V2-Quarts comme V1', () => {
  const f = lire('nexus-forfait.js');
  ['NEXUS-Tempo-v1.html', 'NEXUS-Tempo-v2.html', 'NEXUS-Tempo-v2-Quarts.html'].forEach(p => assert.ok(f.includes("'" + p + "'"), p));
});

t('raccourci V1 enregistré : redirigé vers V2 à la lecture, sans écriture', () => {
  const a = lire('NEXUS-App-v1.html');
  const i = a.indexOf('async function chargerRaccourcisHome');
  const corps = a.slice(i, a.indexOf('\n  }\n', i));
  assert.ok(corps.includes("h === 'NEXUS-Tempo-v1.html' ? 'NEXUS-Tempo-v2.html' : h"));
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(corps));
});

t('page V1 : bandeau sobre vers la nouvelle version, bouton mission conservé', () => {
  const v1 = lire('NEXUS-Tempo-v1.html');
  assert.ok(v1.includes('Ancienne version. La nouvelle version de Tempo est dans le menu.'));
  assert.ok(v1.includes('href="NEXUS-Tempo-v2.html"'));
  assert.ok(v1.includes('Créer une mission terrain'));
});

t('commentaire JOURS_SEMAINE_MIN : arbitrage du 12/11/2026', () => {
  assert.ok(/JOURS_SEMAINE_MIN = 6;[^\n]*arbitrage du 12\/11\/2026/.test(lire('nexus-tempo.js')));
});

console.log(echecs ? echecs + ' échec(s)' : 'tout est ok');
process.exit(echecs ? 1 : 0);
