// Lot G8 (Guardian 6785879134) : carte Tempo = constat en litres, fenêtre glissante, seuil d'occurrences.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = global;
require('./nexus-tempo.js');
const T = window.NexusTempo;
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const iso = d => d.toISOString().slice(0, 10);
const decaler = k => { const d = new Date(); d.setUTCDate(d.getUTCDate() + k); return iso(d); };
const jour = (k, litres) => {
  const date = decaler(k);
  return { date, jourSemaine: new Date(date + 'T00:00:00Z').getUTCDay(), litrageDisponible: true, litrageGazole: litres, litrageSp95: 0, litrageGnr: 0 };
};
const serie = (de, a, f) => { const r = []; for (let k = de; k <= a; k++) r.push(jour(k, f(k))); return r; };

t('fenêtre : 8 semaines, constante unique', () => {
  assert.strictEqual(T.FENETRE_SEMAINES, 8);
  assert.strictEqual((lire('nexus-tempo.js').match(/const FENETRE_SEMAINES\s*=/g) || []).length, 1);
  assert.ok(/provisoire, arbitrage G9 en attente/.test(lire('nexus-tempo.js')));
});
t('fenêtre : 56 jours finissant hier, journée en cours exclue', () => {
  const c = T.calculerConstatLitres(serie(-70, 0, () => 1000));
  const total = c.parJour.reduce((s, x) => s + x.occurrences, 0);
  assert.strictEqual(total, 56);
  assert.ok(c.parJour.every(x => x.occurrences === 8));
});
t('fenêtre : un jour hors fenêtre ne compte pas', () => {
  const c = T.calculerConstatLitres([jour(-57, 99999), jour(0, 99999)]);
  assert.strictEqual(c.parJour.reduce((s, x) => s + x.occurrences, 0), 0);
});
t('litres : plus fort et plus faible, GO + SP95 + GNR', () => {
  const js = serie(-56, -1, k => 1000).map(j => Object.assign(j, j.jourSemaine === 5 ? { litrageSp95: 500, litrageGnr: 100 } : j.jourSemaine === 2 ? { litrageGazole: 400 } : {}));
  const c = T.calculerConstatLitres(js);
  assert.strictEqual(c.suffisant, true);
  assert.strictEqual(c.plusFort.jourSemaine, 5);
  assert.strictEqual(c.plusFort.moyenneLitres, 1600);
  assert.strictEqual(c.plusFaible.jourSemaine, 2);
  assert.strictEqual(c.plusFort.occurrences, 8);
});
t('seuil : moins de 4 occurrences pour un jour = Historique insuffisant, aucun jour désigné', () => {
  assert.strictEqual(T.OCCURRENCES_MIN_JOUR, 4);
  assert.ok(/arbitrage G5 en attente/.test(lire('nexus-tempo.js')));
  const js = serie(-56, -1, () => 1000).filter(j => !(j.jourSemaine === 3 && j.date < decaler(-14)));
  const c = T.calculerConstatLitres(js);
  assert.strictEqual(c.parJour[3].occurrences, 2);
  assert.strictEqual(c.suffisant, false);
  assert.strictEqual(c.plusFort, null);
  const cand = T.construireCandidatTempo({ constatLitres: c });
  assert.ok(/Historique insuffisant/.test(cand.decision));
  assert.strictEqual(cand.jourCible, null);
});
t('seuil : exactement 4 occurrences suffit', () => {
  const js = serie(-56, -1, () => 1000).filter(j => !(j.jourSemaine === 3 && j.date < decaler(-28)));
  assert.strictEqual(T.calculerConstatLitres(js).suffisant, true);
});
t('journées sans litrage disponible ignorées', () => {
  const js = serie(-56, -1, () => 1000).map(j => Object.assign(j, { litrageDisponible: false }));
  assert.strictEqual(T.calculerConstatLitres(js).suffisant, false);
});
t('candidat : constat, niveau Fait mesuré, occurrences affichées, étiquettes retirées', () => {
  const c = T.calculerConstatLitres(serie(-56, -1, k => 1000 + (new Date(decaler(k)).getUTCDay() === 6 ? 700 : 0)));
  const cand = T.construireCandidatTempo({ constatLitres: c });
  const texte = JSON.stringify(cand);
  assert.strictEqual(cand.niveau, 'Fait mesuré');
  assert.ok(/samedi/.test(cand.decision));
  assert.ok(/8 journées/.test(texte));
  assert.ok(!/plus rentable|estimation de valeur|produits d.appel|Concentrez vos prochaines/i.test(texte));
  assert.strictEqual(T.construireCandidatTempo({}), null);
});
t('Brief : la force « journée la plus rentable » est retirée', () => {
  const b = lire('NEXUS-Brief-v1.html');
  assert.ok(!/votre journée la plus rentable/.test(b));
  assert.ok(!/produits d'appel exclus/.test(b));
});
t('normaliserTempo tolère jourCible null et porte le niveau', () => {
  global.window = global;
  const C = require('./nexus-conseiller.js');
  const NC = C.normaliserTempo ? C : (global.NexusConseiller || {});
  if (NC.normaliserTempo) {
    const r = NC.normaliserTempo({ jourCible: null, niveau: 'Fait mesuré', decision: 'd', pourquoi: 'p' });
    assert.strictEqual(r.candidate_id, 'TEMPO-constat');
    assert.strictEqual(r.niveau, 'Fait mesuré');
  }
});
console.log(n + ' tests OK');
