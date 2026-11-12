// Tempo V2 — garde des rythmes hebdomadaires (carte « Jours forts et faibles » seulement).
// Si au moins la moitié des occurrences exploitables d'un jour de semaine sont hors norme dans le même sens,
// ces journées restent dans l'analyse. Cas limites sur 8 occurrences, avant/après gardés dans les preuves.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-vocabulaire.js');
require('./nexus-tempo.js');
const T = window.NexusTempo;
const moteur = fs.readFileSync(path.join(__dirname, 'nexus-tempo.js'), 'utf8');
const vocab = fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2-Jours.html'), 'utf8');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('  ok   ' + nom); }
  catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); }
}
const BORNES = { debut: '2026-08-17', fin: '2026-10-11' }; // huit semaines lundi → dimanche, sans férié
const iso = d => d.toISOString().slice(0, 10);
// Base plate à 1000 avec un petit bruit ; `special(js, semaine)` remplace la valeur d'un jour.
function serie(special, nb) {
  const out = [];
  for (let i = 0; i < (nb || 56); i++) {
    const d = new Date(Date.UTC(2026, 7, 17 + i));
    const js = d.getUTCDay(), sem = Math.floor(i / 7);
    const v = special ? special(js, sem) : null;
    out.push({ date: iso(d), valeur: v != null ? v : 1000 + ((i * 7) % 5) - 2 });
  }
  return out;
}
// Le mercredi (3) est hors norme pour les semaines données, du côté `delta`.
const mercredi = (semaines, delta) => serie((js, sem) => js === 3 && semaines.indexOf(sem) > -1 ? 1000 + delta : null);
const rythmeMercredi = r => r.rythmes.filter(x => x.jourSemaine === 3);
const exceptionnelsMercredi = r => r.ecartes.filter(e => e.motif === 'exceptionnel' && new Date(e.date + 'T00:00:00Z').getUTCDay() === 3).length;

t('3 occurrences sur 8 : la garde est inactive, les journées restent écartées', () => {
  const r = T.joursFortsFaibles(mercredi([0, 2, 5], 400), BORNES, []);
  assert.strictEqual(r.rythmes.length, 0);
  assert.strictEqual(exceptionnelsMercredi(r), 3);
});
t('4 occurrences sur 8 : la garde est active, les journées restent dans l’analyse', () => {
  const r = T.joursFortsFaibles(mercredi([0, 2, 5, 6], 400), BORNES, []);
  assert.deepStrictEqual(rythmeMercredi(r), [{ jourSemaine: 3, sens: 'au-dessus', nb: 4, occurrences: 8 }]);
  assert.strictEqual(exceptionnelsMercredi(r), 0);
  assert.strictEqual(r.parJour.find(p => p.jourSemaine === 3).effectif, 8);
});
t('5 occurrences sur 8 : la garde est active', () => {
  const r = T.joursFortsFaibles(mercredi([0, 1, 2, 5, 6], 400), BORNES, []);
  assert.strictEqual(rythmeMercredi(r).length, 1);
  assert.strictEqual(rythmeMercredi(r)[0].nb, 5);
});
t('une récurrence vers le bas est repérée de la même façon', () => {
  const r = T.joursFortsFaibles(mercredi([0, 2, 5, 6], -400), BORNES, []);
  assert.strictEqual(rythmeMercredi(r)[0].sens, 'en-dessous');
});
t('écarts de sens opposés : la garde est inactive, jamais un rythme', () => {
  const s = serie((js, sem) => js === 3 && sem < 4 ? 1400 : (js === 3 ? 600 : null));
  const r = T.joursFortsFaibles(s, BORNES, []);
  assert.strictEqual(r.rythmes.length, 0);
  assert.strictEqual(exceptionnelsMercredi(r), 8);
});
t('moins de 4 occurrences : la garde est inactive, le jour suit la règle actuelle', () => {
  // trois semaines : trois mercredis seulement, tous hors norme
  const s = serie((js, sem) => js === 3 ? 1400 : null, 21);
  const r = T.joursFortsFaibles(s, { debut: '2026-08-17', fin: '2026-09-06' }, []);
  assert.strictEqual(r.rythmes.length, 0);
  assert.deepStrictEqual(r.changementsGarde, []);
});
t('cas de la recette 6835510494 : vendredi toujours à +30 %, dimanche toujours à −25 %, ni grisés ni écartés', () => {
  const s = serie((js, sem) => js === 5 ? 1300 + (sem % 2) : (js === 0 ? 750 + (sem % 2) : null));
  const r = T.joursFortsFaibles(s, BORNES, []);
  assert.strictEqual(r.etat, 'designe');
  assert.deepStrictEqual(r.rythmes.map(x => [x.jourSemaine, x.sens, x.nb, x.occurrences]).sort((a, b) => b[0] - a[0] ? 1 : -1).sort((a, b) => a[0] - b[0]),
    [[0, 'en-dessous', 8, 8], [5, 'au-dessus', 8, 8]]);
  assert.strictEqual(r.parJour.find(p => p.jourSemaine === 5).verdict, 'au-dessus');
  assert.strictEqual(r.parJour.find(p => p.jourSemaine === 0).verdict, 'en-dessous');
  assert.ok(r.parJour.every(p => p.suffisant));
  assert.strictEqual(r.ecartes.filter(e => e.motif === 'exceptionnel').length, 0);
});
t('avant et après la garde sont gardés dans les preuves, en plus de « avec et sans »', () => {
  const s = serie((js, sem) => js === 5 ? 1300 + (sem % 2) : (js === 0 ? 750 + (sem % 2) : null));
  const r = T.joursFortsFaibles(s, BORNES, []);
  assert.ok(r.avantGarde && r.avec && r.rythmes);
  assert.strictEqual(r.avantGarde.parJour.find(p => p.jourSemaine === 5).effectif, 0);
  assert.strictEqual(r.avantGarde.etat, 'insuffisant');
  assert.strictEqual(r.avec.etat, 'designe');
  assert.deepStrictEqual(r.changementsGarde.slice().sort(), [0, 1, 2, 3, 4, 5, 6].filter(js => r.avantGarde.parJour.find(p => p.jourSemaine === js).verdict !== r.parJour.find(p => p.jourSemaine === js).verdict).sort());
});
t('sans rythme, le résultat est identique à celui d’avant la garde', () => {
  const r = T.joursFortsFaibles(mercredi([0, 2, 5], 400), BORNES, []);
  assert.deepStrictEqual(r.parJour, r.avantGarde.parJour);
  assert.deepStrictEqual(r.changementsGarde, []);
});
t('la méthode commune n’est pas modifiée : joursExceptionnels reste identique', () => {
  const s = mercredi([0, 2, 5, 6], 400);
  assert.strictEqual(T.joursExceptionnels ? T.joursExceptionnels(s).length : 4, 4);
  const corps = moteur.slice(moteur.indexOf('function joursExceptionnels'), moteur.indexOf('function minParJourSemaine'));
  assert.ok(!/RYTHME|rythme/.test(corps), 'la garde ne doit pas entrer dans la méthode commune');
});
t('le seuil est une constante nommée, et la garde ne sert qu’à cette carte', () => {
  assert.ok(/const SEUIL_RYTHME_RECURRENT = 0\.5;/.test(moteur));
  const hors = moteur.replace(/function joursFortsFaibles[\s\S]*?\n  \}\n\n  \/\/ Une série par mesure/, '');
  assert.ok(!/SEUIL_RYTHME_RECURRENT/.test(hors.replace(/const SEUIL_RYTHME_RECURRENT[^\n]*/, '').replace(/seuilRythme[^\n]*/g, '')), 'constante utilisée hors de la carte');
});
t('textes passés par le lexique, langage prudent, aucune consigne ni saisonnalité établie', () => {
  const s = mercredi([0, 2, 5, 6], 400);
  const l = T.lignesJours(T.joursFortsFaibles(s, BORNES, []), 'piste');
  assert.ok(l.rythmes && /^Rythme potentiel : Mercredi \(4 jours complets sur 8 nettement au-dessus de la médiane\)/.test(l.rythmes.texte));
  assert.ok(!/saisonnal|devez|faut|conseil|recommand|—/i.test(l.rythmes.texte + l.rythmes.avantApres));
  assert.ok(!/Rythme potentiel|nettement au-dessus de la médiane/.test(moteur.slice(moteur.indexOf('function joursFortsFaibles'), moteur.indexOf('function lignesJours'))), 'mot d’affichage dans le moteur');
  assert.ok(/rythmes: \{/.test(vocab));
});
t('la page affiche le bloc du rythme', () => {
  assert.ok(html.includes('J.rythmes.titre') && html.includes('l.rythmes.texte'));
});

console.log(echecs ? echecs + ' échec(s)' : 'tous ok');
process.exit(echecs ? 1 : 0);
