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
const decaler = k => { const d = new Date(T.dateStationISO() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return iso(d); };
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
t('normaliserTempo existe, tolère jourCible null et porte le niveau', () => {
  global.window = global;
  require('./nexus-conseiller.js');
  const NC = global.NexusConseiller;
  assert.ok(NC && typeof NC.normaliserTempo === 'function', 'normaliserTempo doit exister');
  const r = NC.normaliserTempo({ jourCible: null, niveau: 'Fait mesuré', decision: 'd', pourquoi: 'p' });
  assert.strictEqual(r.candidate_id, 'TEMPO-constat');
  assert.strictEqual(r.niveau, 'Fait mesuré');
});
t('revue 6786038072 : 21 h Martinique, le jour local est exclu, fenêtre de 56 jours', () => {
  const RealDate = Date;
  const figer = iso => { global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } }; };
  try {
    figer('2026-11-11T01:00:00Z'); // = 10/11/2026 21:00 en Martinique, UTC déjà au 11
    assert.strictEqual(T.dateStationISO(), '2026-11-10');
    const mk = (d, l) => ({ date: d, jourSemaine: new RealDate(d + 'T00:00:00Z').getUTCDay(), litrageDisponible: true, litrageGazole: l, litrageSp95: 0, litrageGnr: 0 });
    const jours = [];
    for (let k = -70; k <= 0; k++) { const d = new RealDate('2026-11-10T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); jours.push(mk(d.toISOString().slice(0, 10), 1000)); }
    const c = T.calculerConstatLitres(jours);
    assert.strictEqual(c.parJour.reduce((s, x) => s + x.occurrences, 0), 56);
    const inclus10 = T.calculerConstatLitres([mk('2026-11-10', 5000)]);
    assert.strictEqual(inclus10.parJour.reduce((s, x) => s + x.occurrences, 0), 0, 'le 10/11 (jour local en cours) est exclu');
  } finally { global.Date = RealDate; }
});
t('revue 6786038072 : constat sans impact attendu, libellé 56 jours, jamais compté en décision', () => {
  const c = T.calculerConstatLitres(serie(-56, -1, () => 1000));
  const cand = T.construireCandidatTempo({ constatLitres: c });
  assert.strictEqual(cand.impactAttendu, null);
  assert.ok(/Fait mesuré/.test(cand.pourquoi) && /8 dernières semaines \(56 jours\)/.test(cand.pourquoi));
  assert.ok(!/semaines complètes/.test(cand.pourquoi));
});
t('arbitrage 10/11 : Tempo hors sélection des décisions (Brief et accueil), plus de rendu conditionnel', () => {
  const b = lire('NEXUS-Brief-v1.html'), a = lire('NEXUS-App-v1.html');
  const fb = b.match(/NexusConseiller\.fusionnerEtSelectionner\(\s*\[([^\]]*)\]/);
  assert.ok(fb, 'fusion du Brief trouvée');
  assert.ok(!/tempo/i.test(fb[1]), 'le Brief ne passe aucun candidat Tempo à la fusion');
  const fa = a.match(/NexusConseiller\.fusionnerEtSelectionner\(\s*\[([^\]]*)\]/);
  assert.ok(fa && !/tempo/i.test(fa[1]), 'l’accueil ne passe aucun candidat Tempo à la fusion');
  assert.ok(!/normaliserTempo/.test(b) && !/normaliserTempo/.test(a), 'ni Brief ni accueil n’appellent normaliserTempo');
  assert.ok(!/p\.niveau === 'Fait mesuré'/.test(b), 'rendu conditionnel retiré du Brief');
  assert.ok(/nbDecisions: candidatsConseiller\.length/.test(a) && !/Fait mesuré'\)\.length/.test(a));
  assert.ok(!/tempo: candidatTempoListe/.test(b), 'Tempo ne se déclare plus contributeur de décisions');
});
t('revue 6786323566 : raccourci Tempo de l’accueil = constat en litres, urgence 0, aucun jourARenforcer', () => {
  const a = lire('NEXUS-App-v1.html');
  const m = a.match(/function descriptionTempoHome\([\s\S]*?\n  }\n/);
  assert.ok(m, 'descriptionTempoHome trouvée');
  const desc = new Function(m[0] + '; return descriptionTempoHome;')();
  const c = T.calculerConstatLitres(serie(-56, -1, d => 1000 + (new Date(d + 'T00:00:00Z').getUTCDay() === 5 ? 500 : 0)));
  const ok = desc(c);
  assert.ok(/le plus fort/.test(ok) && /le plus faible/.test(ok) && /litres, 8 semaines/.test(ok), ok);
  assert.strictEqual(desc(T.calculerConstatLitres([])), 'Historique insuffisant');
  assert.strictEqual(desc(undefined), 'Historique insuffisant');
  assert.ok(!/jourARenforcer/.test(m[0]), 'aucune lecture de jourARenforcer dans la description');
  assert.ok(/NEXUS-Tempo-v1\.html'\) return 0;/.test(a), 'urgence Tempo = 0');
  assert.ok(!/jourARenforcerTempo|totalJoursTempo/.test(a), 'contexte du raccourci sans jourARenforcer');
  assert.ok(/descriptionTempoHome\(ctx\.constatLitresTempo\)/.test(a));
});
console.log(n + ' tests OK');
