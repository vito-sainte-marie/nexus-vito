'use strict';
// Lot A3 — « aujourd'hui de la station » : bascule UTC / Martinique (UTC−4, sans heure d'été).
// De 20 h à minuit locales, la date UTC est déjà celle du lendemain : aucun écran ne doit la lire.
global.window = global;
const assert = require('assert');
const { installerAvecFuseau } = require('./outils/fuseau-metier-pour-tests.js');
installerAvecFuseau('America/Martinique');
require('./nexus-tempo.js');
const T = global.NexusTempo;
const F = 'America/Martinique';

let n = 0;
function t(label, fn) { fn(); n++; console.log('OK —', label); }
const utc = s => new Date(s);

// [instant UTC, jour de la station attendu, jour UTC naïf (l'ancien défaut)]
const CAS = [
  ['2026-11-27T00:30:00Z', '2026-11-26', '2026-11-27'], // 20 h 30 locales
  ['2027-01-01T00:30:00Z', '2026-12-31', '2027-01-01'], // soir du 31 décembre
  ['2026-12-01T01:00:00Z', '2026-11-30', '2026-12-01'], // dernier jour d'un mois
  ['2028-03-01T02:00:00Z', '2028-02-29', '2028-03-01'], // 29 février
  ['2026-11-26T03:59:59Z', '2026-11-25', '2026-11-26'], // 23 h 59 59 locales
  ['2026-11-26T04:00:00Z', '2026-11-26', '2026-11-26'], // minuit local pile
];

t('nexusJourDansFuseau : le jour de la station, pas le jour UTC', () => {
  for (const [i, attendu, naif] of CAS) {
    assert.strictEqual(nexusJourDansFuseau(utc(i), F), attendu, i);
    assert.strictEqual(utc(i).toISOString().slice(0, 10), naif, 'témoin : le jour UTC naïf diffère bien');
  }
});
t('nexusDecalerJour : mois, année et 29 février', () => {
  assert.strictEqual(nexusDecalerJour('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(nexusDecalerJour('2026-12-01', -1), '2026-11-30');
  assert.strictEqual(nexusDecalerJour('2028-02-28', 1), '2028-02-29');
});
t('un fuseau absent ou invalide ne donne aucune date (Article 5)', () => {
  assert.strictEqual(T.dateStationISO(null, utc(CAS[0][0])), null);
  assert.strictEqual(T.dateStationISO('Pas/UnFuseau', utc(CAS[0][0])), null);
  assert.strictEqual(T.bornesPeriodeIndicateurs(null, utc(CAS[0][0])).indetermine, true);
});
t('Tempo : à 20 h 30 locales, le jour de la station n\'est pas encore clos', () => {
  const rows = [{ date: '2026-11-25' }, { date: '2026-11-26' }, { date: '2026-11-27' }];
  const clos = T.filtrerJoursClos(rows, F, utc('2026-11-27T00:30:00Z')).map(j => j.date);
  assert.deepStrictEqual(clos, ['2026-11-25']);
  assert.deepStrictEqual(T.filtrerJoursClos(rows, null, utc('2026-11-27T00:30:00Z')), []);
});
t('Tempo : fenêtre d\'indicateurs bornée au jour de la station', () => {
  for (const [i, attendu] of CAS) {
    const b = T.bornesPeriodeIndicateurs(F, utc(i));
    assert.strictEqual(b.exclu, attendu, 'exclu = jour de la station, ' + i);
    assert.strictEqual(b.fin, nexusDecalerJour(attendu, -1));
  }
});
t('Conseiller : un rappel du jour n\'est pas « en retard » à 20 h 30 locales', () => {
  require('./nexus-conseiller.js');
  const C = global.NexusConseiller;
  const r = { id: 1, titre: 'x', date_echeance: '2026-11-26' };
  const jour = nexusJourDansFuseau(utc('2026-11-27T00:30:00Z'), F);
  assert.ok(!/EN RETARD/.test(C.normaliserRappel(r, jour).etat));
  assert.ok(/EN RETARD/.test(C.normaliserRappel(r, '2026-11-27').etat), 'témoin : avec le jour UTC il basculait en retard');
});
console.log('\n' + n + '/' + n + ' tests passés — fuseau de la station, bascule UTC.');
