// Tempo V2 : jours fériés et ponts. Chaque jour spécial travaillé est comparé à un jour habituel,
// l'effet n'est donné qu'à partir de 4 observations, les phrases vivent dans le lexique, jamais de consigne.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const LF = window.NexusVocab.feries;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const VERBES = /\b(devez|devriez|faut|faites|faire|essayez|pensez|prévoyez|augmentez|baissez|réduisez|recommand|conseil|agissez|à surveiller|à corriger)\w*/i;

// Jeu : mercredis habituels autour de l'Armistice 2026 (mercredi 11/11), tous à 1 000 ou 1 060 L.
function jeu(nbMercredis, valeurFerie) {
  const jours = [];
  for (let i = 1; i <= nbMercredis; i++) {
    const d = new Date(Date.UTC(2026, 10, 11 - 7 * i)).toISOString().slice(0, 10);
    jours.push({ date: d, valeur: i % 2 ? 1000 : 1060 });
  }
  if (valeurFerie !== null) jours.push({ date: '2026-11-11', valeur: valeurFerie });
  return jours;
}
const BORNES = { debut: '2026-08-01', fin: '2026-11-11' };

t('un férié travaillé est comparé à la moyenne du même jour de la semaine', () => {
  const a = T.analyseFeries(jeu(8, 1500), [], BORNES);
  const j = a.jours.find(x => x.date === '2026-11-11');
  assert.ok(j, 'jour absent');
  assert.strictEqual(j.type, 'ferie');
  assert.strictEqual(j.etat, 'comparable');
  assert.strictEqual(j.reference.n, 8);
  assert.ok(Math.abs(j.ecartPct - 45.6) < 0.2, 'écart ' + j.ecartPct);
});
t('moins de 4 jours de référence : non comparable, jamais un chiffre', () => {
  const j = T.analyseFeries(jeu(2, 1500), [], BORNES).jours.find(x => x.date === '2026-11-11');
  assert.strictEqual(j.etat, 'non_comparable');
  assert.strictEqual(j.raison, 'reference_insuffisante');
  assert.strictEqual(j.ecartPct, undefined);
});
t('un férié absent des jours complets est dit incomplet', () => {
  const j = T.analyseFeries(jeu(8, null), [], BORNES).jours.find(x => x.date === '2026-11-11');
  assert.strictEqual(j.etat, 'non_comparable');
  assert.strictEqual(j.raison, 'jour_incomplet');
});
t('l’effet moyen reste muet sous 4 observations et compte les observées', () => {
  const e = T.analyseFeries(jeu(8, 1500), [], BORNES).effets;
  assert.strictEqual(e.ferie.etat, 'insuffisant');
  assert.strictEqual(e.ferie.n, 1);
  assert.strictEqual(e.ferie.ecartPct, null);
  assert.ok(T.FERIES_OBSERVES_MIN === 4);
});
t('le lexique rend la phrase du jour travaillé, sans tiret cadratin', () => {
  const a = T.analyseFeries(jeu(8, 1500), [], BORNES);
  const l = LF.ligneJour(a.jours.find(x => x.date === '2026-11-11'), 'L');
  assert.ok(/^Mercredi 11\/11 \(.+\) : 1\s500 L, soit \+4\d,\d\s% par rapport à un mercredi habituel$/.test(l), l);
  assert.ok(!/—/.test(l));
});
t('le compteur « n sur 4 » s’affiche sous le minimum', () => {
  const txt = LF.effet({ type: 'ferie', n: 2, min: 4, etat: 'insuffisant' });
  assert.ok(/2 sur 4/.test(txt) && !/%/.test(txt));
});
t('les prochains ponts et la phrase Boutique : aucun tiret cadratin, aucune consigne', () => {
  const txt = [LF.prochains(T.prochainsPonts('2026-11-12', 6)), LF.boutique, LF.aucun,
    LF.effet({ type: 'pont', n: 5, min: 4, etat: 'ok', ecartPct: -12.3 })].join(' ');
  assert.ok(!/—/.test(txt), 'tiret cadratin');
  assert.ok(!VERBES.test(txt), 'consigne');
  assert.ok(/Prochains ponts : /.test(LF.prochains(T.prochainsPonts('2026-11-12', 6))));
});
t('une journée exceptionnelle est écartée de la référence et nommée sur la ligne', () => {
  const js = jeu(8, 1500).map(j => j.date === '2026-09-30' ? { date: j.date, valeur: 3000 } : j);
  const j = T.analyseFeries(js, [], BORNES).jours.find(x => x.date === '2026-11-11');
  assert.strictEqual(j.reference.n, 7);
  assert.deepStrictEqual(j.reference.exclus, ['2026-09-30']);
  assert.ok(Math.abs(j.ecartPct - 45.6) < 3, 'écart ' + j.ecartPct);
  assert.ok(/, hors journée exceptionnelle du 30\/09$/.test(LF.ligneJour(j, 'L')), LF.ligneJour(j, 'L'));
});
t('un férié connu seulement du calendrier du site porte son libellé', () => {
  const js = jeu(8, null);
  js.push({ date: '2026-10-14', valeur: 1700 });
  const a = T.analyseFeries(js, [{ date: '2026-10-14', type: 'ferie', libelle: 'Fête locale' }], BORNES);
  const j = a.jours.find(x => x.date === '2026-10-14');
  assert.strictEqual(j.nom, 'Fête locale');
  assert.ok(/\(Fête locale\)/.test(LF.ligneJour(j, 'L')), LF.ligneJour(j, 'L'));
  assert.ok(!/\(férié\)/.test(LF.ligneJour(j, 'L')));
});
t('le moteur ne porte pas de phrase d’affichage pour les fériés', () => {
  const corps = moteur.slice(moteur.indexOf('function qualifierJourSpecial'), moteur.indexOf('function evaluerComparabilite'));
  assert.ok(corps.length > 200);
  assert.ok(!/habituel|Prochains|pas assez|incomplète|non comparable /.test(corps), 'mot d’affichage dans le moteur');
});
t('la page branche les trois activités depuis le lexique, sans nouvelle lecture', () => {
  ['T.analyseFeries(', 'LF.ligneJour(', 'LF.effet(', 'LF.prochains(', 'LF.boutique'].forEach(s => assert.ok(html.includes(s), 'manque : ' + s));
  assert.ok(html.indexOf('nexus-vocabulaire.js') < html.indexOf('nexus-tempo.js'));
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
