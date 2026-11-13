// Tempo V2 — « Quand la piste tourne, la boutique suit-elle ? » : concordance jour par jour, règles du commentaire 6839654482 de #160.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');
const lexique = fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}

const AUJ = '2026-11-12'; // fenêtre : du 10/11/2025 au 08/11/2026
function alea(graine) { let s = graine; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
function jours(debut, nb) { const l = []; for (let i = 0; i < nb; i++) l.push(T.dateLocale ? null : null); return l; }
function dates(debut, nb) { const l = []; let d = debut; for (let i = 0; i < nb; i++) { l.push(d); d = decaler(d, 1); } return l; }
const decaler = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// Deux séries qui montent de la même façon ; le bruit de chaque jour est celui qu'on lui donne.
function series(debut, nb, bruitP, bruitB) {
  const ds = dates(debut, nb);
  return {
    piste: ds.map((date, i) => ({ date, valeur: 5000 + i * 3 + bruitP(i) * 600 })),
    boutique: ds.map((date, i) => ({ date, valeur: 900 + i * 0.6 + bruitB(i) * 120 })),
  };
}
const DEBUT = '2025-10-01', NB = 400;
const tirage = (graine, nb) => { const r = alea(graine); const v = []; for (let i = 0; i < nb; i++) v.push(r()); return i => v[i]; };

t('deux séries qui montent, bruits indépendants : pas de lien net', () => {
  const s = series(DEBUT, NB, tirage(1, NB), tirage(2, NB));
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.ok(r.nbCompares >= 300, 'n = ' + r.nbCompares);
  assert.strictEqual(r.avec.verdict, 'pas-de-lien');
});
t('bruit commun : la boutique suit la piste', () => {
  const b = tirage(3, NB);
  const s = series(DEBUT, NB, b, b);
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.strictEqual(r.avec.verdict, 'suit');
  assert.strictEqual(r.avec.k, r.avec.n);
});
t('bruit inversé : sens opposés', () => {
  const b = tirage(4, NB);
  const s = series(DEBUT, NB, b, i => -b(i));
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.strictEqual(r.avec.verdict, 'oppose');
  assert.ok(r.avec.k / r.avec.n < 0.05, 'p = ' + r.avec.k / r.avec.n);
});
t('19 jours comparés : carte grisée ; 20 : un verdict', () => {
  assert.strictEqual(T.verdictConcordance(19, 19).etat, 'grise');
  assert.strictEqual(T.verdictConcordance(19, 19).verdict, null);
  assert.strictEqual(T.verdictConcordance(20, 20).etat, 'lisible');
  assert.strictEqual(T.verdictConcordance(20, 20).verdict, 'suit');
  assert.strictEqual(T.verdictConcordance(20, 0).verdict, 'oppose');
});
t('peu de données : le moteur grise la carte', () => {
  const b = tirage(5, 30);
  const s = series('2026-10-01', 30, b, b);
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.ok(r.nbCompares < 20, 'n = ' + r.nbCompares);
  assert.strictEqual(r.avec.etat, 'grise');
});
t('seuil exact : p − 0,5 = 2·√(0,25/n) ne suffit pas', () => {
  assert.strictEqual(T.verdictConcordance(100, 60).verdict, 'pas-de-lien');
  assert.strictEqual(T.verdictConcordance(100, 61).verdict, 'suit');
  assert.strictEqual(T.verdictConcordance(100, 40).verdict, 'pas-de-lien');
  assert.strictEqual(T.verdictConcordance(100, 39).verdict, 'oppose');
  assert.strictEqual(T.verdictConcordance(25, 17).verdict, 'pas-de-lien');
  assert.strictEqual(T.verdictConcordance(25, 18).verdict, 'suit');
});
t('un jour qui n’a que 2 voisins d’habitude est écarté et compté', () => {
  const b = tirage(6, NB);
  const s = series(DEBUT, NB, b, b);
  const ref = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  // On retire 2 voisins d’un jour (le 15/04/2026) dans la boutique seulement : il reste 2 valeurs.
  const j = '2026-04-15';
  const sup = new Set([decaler(j, -14), decaler(j, 7)]);
  const bout = s.boutique.filter(x => !sup.has(x.date));
  const r = T.concordancePisteBoutique(s.piste, bout, [], AUJ);
  assert.ok(r.exclus.sansHabitude > ref.exclus.sansHabitude);
  assert.ok(r.nbCompares < ref.nbCompares);
});
t('un jour exactement égal à son habitude est écarté et compté', () => {
  const ds = dates(DEBUT, NB);
  const plat = ds.map(date => ({ date, valeur: 1000 }));
  const r = T.concordancePisteBoutique(plat, plat, [], AUJ);
  assert.strictEqual(r.nbCompares, 0);
  assert.ok(r.exclus.egaux > 300);
  assert.strictEqual(r.avec.etat, 'grise');
});
t('un jour férié sort des deux séries et se compte', () => {
  const b = tirage(7, NB);
  const s = series(DEBUT, NB, b, b);
  const cal = [{ date: '2026-03-18', type: 'ferie', libelle: 'Jour férié propre au site' }];
  const r0 = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  const r = T.concordancePisteBoutique(s.piste, s.boutique, cal, AUJ);
  assert.ok(r.exclus.feries >= 1);
  assert.ok(r.nbCompares < r0.nbCompares);
  assert.ok(r.exclus.feries > r0.exclus.feries);
});
t('un jour incomplet d’un seul côté est écarté et compté', () => {
  const b = tirage(8, NB);
  const s = series(DEBUT, NB, b, b);
  const bout = s.boutique.filter(x => x.date !== '2026-03-10');
  const r = T.concordancePisteBoutique(s.piste, bout, [], AUJ);
  assert.ok(r.exclus.incomplets >= 1);
});
t('jours hors norme : résultat avec et sans eux', () => {
  const b = tirage(9, NB);
  const s = series(DEBUT, NB, b, tirage(10, NB));
  s.piste[250].valeur += 90000; s.boutique[250].valeur += 90000;
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.ok(r.aDesExceptionnels);
  assert.ok(r.avec.n > r.sans.n);
});
t('la fenêtre suit la règle de Vacances : 52 semaines closes, jour en cours exclu', () => {
  const b = tirage(11, NB);
  const s = series(DEBUT, NB, b, b);
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.strictEqual(r.fenetre.fin, '2026-11-08');
  assert.strictEqual(r.fenetre.debut, T.fenetreVacances(s.piste, AUJ).debut);
  assert.strictEqual(r.semaines, 52);
});
t('le tableau par jour de semaine donne les effectifs, sans verdict', () => {
  const b = tirage(12, NB);
  const s = series(DEBUT, NB, b, b);
  const r = T.concordancePisteBoutique(s.piste, s.boutique, [], AUJ);
  assert.strictEqual(r.parJour.length, 7);
  assert.strictEqual(r.parJour.reduce((a, x) => a + x.n, 0), r.avec.n);
  r.parJour.forEach(p => assert.ok(!('verdict' in p)));
});
t('le lexique porte les mots, le moteur aucun, et « marge » n’apparaît nulle part dans la carte', () => {
  const V = window.NexusVocab.pisteBoutique;
  assert.strictEqual(V.titre, 'Quand la piste tourne, la boutique suit-elle ?');
  assert.strictEqual(V.verdicts.suit, 'La boutique suit la piste');
  assert.strictEqual(V.verdicts.oppose, 'Sens opposés');
  assert.strictEqual(V.verdicts['pas-de-lien'], 'Pas de lien net');
  assert.strictEqual(V.resultat(14, 20), '14 jours sur 20 dans le même sens');
  assert.strictEqual(V.resultat(1, 20), '1 jour sur 20 dans le même sens');
  assert.ok(!/marge/i.test(JSON.stringify(V) + V.exclus({ feries: 1, ponts: 1, incomplets: 1, sansHabitude: 1, egaux: 1 }) + V.fenetre(52, '2025-11-10', '2026-11-08', true)));
  const corps = moteur.slice(moteur.indexOf('function verdictConcordance'), moteur.indexOf('function vacancesParJourSemaine') > moteur.indexOf('function verdictConcordance') ? moteur.indexOf('window.NexusTempo = {') : moteur.indexOf('window.NexusTempo = {'));
  const bloc = corps.slice(0, corps.indexOf('function vacancesParJourSemaine') > 0 ? corps.length : corps.length);
  assert.ok(!/La boutique suit|Sens opposés|Pas de lien|marge/i.test(moteur.slice(moteur.indexOf('function verdictConcordance'), moteur.indexOf('function verdictConcordance') + 4200).replace(/\/\/.*$/gm, '')), 'mot d’affichage dans le moteur');
  void bloc; void lexique;
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
