function numeroSemaineISO(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date - premierJeudi) / 86400000 - 3 + (premierJeudi.getUTCDay() + 6) % 7) / 7);
}
function classifierTypePeriode(type, debut, fin) {
  if (type === 'annee' || type === 'annee_precedente') return 'annuel';
  if (type === 'mois' || type === 'mois_precedent') return 'mensuel';
  if (type === 'personnalise' && debut && fin) {
    const jours = Math.round((fin - debut) / 86400000) + 1;
    if (jours > 64) return 'annuel';
    if (jours > 10) return 'mensuel';
  }
  return 'hebdomadaire';
}
function regrouperParSemaine(lignes) {
  const parSemaine = {};
  lignes.forEach(l => {
    if (l.ca_grattage === null) return;
    const d = new Date(l.date + 'T00:00:00');
    const sem = numeroSemaineISO(d);
    const cle = `${d.getFullYear()}-S${String(sem).padStart(2, '0')}`;
    if (!parSemaine[cle]) parSemaine[cle] = { cle, label: `Semaine ${sem}`, ca: 0, premiereDate: l.date };
    parSemaine[cle].ca += Number(l.ca_grattage);
  });
  return Object.values(parSemaine).sort((a, b) => a.premiereDate.localeCompare(b.premiereDate));
}
function regrouperParMois(lignes) {
  const parMois = {};
  lignes.forEach(l => {
    if (l.ca_grattage === null) return;
    const cle = l.date.slice(0, 7);
    if (!parMois[cle]) parMois[cle] = { cle, label: new Date(cle + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), ca: 0 };
    parMois[cle].ca += Number(l.ca_grattage);
  });
  return Object.values(parMois).sort((a, b) => a.cle.localeCompare(b.cle));
}

// Test 1: classification
console.log('classif mois:', classifierTypePeriode('mois'));
console.log('classif annee_precedente:', classifierTypePeriode('annee_precedente'));
console.log('classif semaine:', classifierTypePeriode('semaine'));
console.log('classif personnalise 90j:', classifierTypePeriode('personnalise', new Date('2026-01-01'), new Date('2026-04-01')));
console.log('classif personnalise 20j:', classifierTypePeriode('personnalise', new Date('2026-01-01'), new Date('2026-01-20')));
console.log('classif personnalise 5j:', classifierTypePeriode('personnalise', new Date('2026-01-01'), new Date('2026-01-05')));
if (classifierTypePeriode('mois') !== 'mensuel') throw new Error('FAIL mois');
if (classifierTypePeriode('annee_precedente') !== 'annuel') throw new Error('FAIL annee');
if (classifierTypePeriode('semaine') !== 'hebdomadaire') throw new Error('FAIL semaine');

// Test 2: regroupement sur une année complète (365 jours) -> doit donner 12 mois
const lignesAnnee = [];
let d = new Date('2026-01-01T00:00:00');
for (let i = 0; i < 365; i++) {
  lignesAnnee.push({ date: d.toISOString().slice(0,10), ca_grattage: 100 + (i % 30) });
  d.setDate(d.getDate() + 1);
}
const mois = regrouperParMois(lignesAnnee);
console.log('nb mois regroupés (attendu 12):', mois.length);
console.log('premier mois:', mois[0].label, mois[0].ca.toFixed(2));
if (mois.length !== 12) throw new Error('FAIL regroupement mensuel');

// Test 3: regroupement sur un mois (30 jours) -> doit donner ~5 semaines ISO
const lignesMois = [];
d = new Date('2026-08-01T00:00:00');
for (let i = 0; i < 31; i++) {
  lignesMois.push({ date: d.toISOString().slice(0,10), ca_grattage: 50 + i });
  d.setDate(d.getDate() + 1);
}
const semaines = regrouperParSemaine(lignesMois);
console.log('nb semaines regroupées (attendu 5 ou 6):', semaines.length, semaines.map(s=>s.label));
if (semaines.length < 4 || semaines.length > 6) throw new Error('FAIL regroupement hebdo');

console.log('TOUS LES TESTS PASSENT (granularité FDJ)');
