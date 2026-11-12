// Lot D1 « Piste en litres par carburant » : hors service, répartition, candidats, jour exceptionnel, lecture seule.
// Valeurs de Guardian (Production, Sainte-Marie) : attendues APRÈS déploiement, jamais lues ici.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = {};
require('./nexus-tempo.js');
const T = window.NexusTempo;
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Tempo-v2.html'), 'utf8');
let echecs = 0;
function t(nom, fn) { try { fn(); console.log('  ok   ' + nom); } catch (e) { echecs++; console.log('  FAIL ' + nom + '\n       ' + e.message); } }

function alea(g) { let s = g; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
function jours(debut, n) { const r = []; const d = new Date(debut + 'T12:00:00Z'); for (let i = 0; i < n; i++) { r.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return r; }
const bornes = { debut: '2026-09-15', fin: '2026-11-09' };
const bRef = { debut: '2026-07-21', fin: '2026-09-14' };
// niveaux : L/jour par carburant ; bruit : amplitude ; surcharge : { date: {sp95: valeur} }
function audits(dates, niv, bruit, graine, surcharge) {
  const a = alea(graine), out = [];
  dates.forEach(d => {
    const v = {};
    ['gazole', 'sp95', 'gnr'].forEach(k => { v[k] = niv[k] === 0 ? 0 : Math.max(1, niv[k] + a() * bruit); });
    if (surcharge && surcharge[d]) Object.assign(v, surcharge[d]);
    [1, 2].forEach(q => out.push({ date: d, quart: String(q), litrage_gazole: v.gazole / 2, litrage_sp95: v.sp95 / 2, litrage_gnr: v.gnr / 2, vente_piste: 1000, vente_boutique: 500 }));
  });
  return out;
}
const dE = jours(bornes.debut, 56), dR = jours(bRef.debut, 56);
const analyse = (nivE, nivR, bruit, sur) => T.analysePiste(audits(dE, nivE, bruit, 3, sur), audits(dR, nivR, bruit, 5), bornes, bRef);

t('hors service : 0 L sur 31 jours complets → exclu des parts, nommé', () => {
  const r = analyse({ gazole: 2600, sp95: 3000, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 200);
  assert.deepStrictEqual(r.horsService, ['GNR']);
  const g = r.carburants.find(c => c.cle === 'gnr');
  assert.ok(g.horsService && g.moyenneE === undefined);
  const p = r.carburants.filter(c => !c.horsService).reduce((s, c) => s + c.partE, 0);
  assert.ok(Math.abs(p - 1) < 1e-9, 'les parts des carburants en service font 100 %');
});

t('hors service : un seul litre sur les 31 derniers jours → de retour', () => {
  const sur = {}; sur[bornes.fin] = { gnr: 40 };
  const r = analyse({ gazole: 2600, sp95: 3000, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 200, sur);
  assert.deepStrictEqual(r.horsService, []);
});

t('hors service : 0 L seulement sur 30 jours → pas encore hors service', () => {
  const sur = {}; sur[jours(bornes.fin, 1)[0]] = {};
  const dates = jours(bornes.debut, 56);
  const aud = audits(dates, { gazole: 2600, sp95: 3000, gnr: 0 }, 200, 3, { [dates[dates.length - 31]]: { gnr: 25 } });
  const r = T.analysePiste(aud, audits(dR, { gazole: 2600, sp95: 3000, gnr: 0 }, 200, 5), bornes, bRef);
  assert.deepStrictEqual(r.horsService, []);
});

t('seuil de répartition : 2,0 points — sous le seuil, pas de candidat répartition', () => {
  assert.strictEqual(T.SEUIL_PART_POINTS, 2.0);
  const r = analyse({ gazole: 2600, sp95: 2940, gnr: 0 }, { gazole: 2600, sp95: 3150, gnr: 0 }, 150);
  assert.ok(!r.candidats.some(c => c.type === 'repartition'), JSON.stringify(r.candidats));
});

t('répartition : changement ≥ 2,0 points → candidat, jamais une cause', () => {
  const r = analyse({ gazole: 3200, sp95: 2400, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 100);
  const c = r.candidats.find(x => x.type === 'repartition');
  assert.ok(c && Math.abs(c.points) >= 2.0);
});

t('variation masquée : un carburant net, total non net → retenue « masquee », ordre a avant c', () => {
  // Gazole stable, SP95 −8 % : le total baisse peu et reste dans la variation habituelle (bruit élevé sur le gazole).
  const r = analyse({ gazole: 2600, sp95: 2760, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 150);
  assert.strictEqual(r.etat, 'ok');
  const sp = r.carburants.find(c => c.cle === 'sp95');
  assert.ok(sp.claire, 'SP95 net');
  const typ = r.candidats.map(c => c.type);
  if (r.total.claire) { assert.ok(typ.includes('variation')); assert.ok(!typ.includes('masquee')); }
  else { assert.strictEqual(r.retenue.type, 'masquee'); assert.strictEqual(r.retenue.carburant, 'sp95'); }
});

t('variation masquée stricte : SP95 −250 L, gazole +250 L → total non net, SP95 retenue', () => {
  const r = analyse({ gazole: 2850, sp95: 2750, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 150);
  assert.ok(!r.total.claire, 'total non net');
  assert.strictEqual(r.retenue.type, 'masquee');
  assert.strictEqual(r.retenue.carburant, 'sp95');
  assert.ok(r.candidats.some(c => c.type === 'repartition'), 'la répartition bouge aussi (≥ 2,0 points)');
  assert.strictEqual(r.candidats[0].type, 'masquee', 'ordre par défaut a, b, c');
});

t('variation simple : tous les carburants baissent → candidat « variation »', () => {
  const r = analyse({ gazole: 2000, sp95: 2400, gnr: 800 }, { gazole: 2600, sp95: 3000, gnr: 1000 }, 100);
  assert.ok(r.candidats.some(c => c.type === 'variation'));
  assert.ok(!r.candidats.some(c => c.type === 'masquee'), 'même sens que le total : pas masquée');
});

t('jour exceptionnel : la clarté est jugée sans lui, les deux valeurs restent visibles', () => {
  const sur = { '2026-09-30': { sp95: 9000 } };
  const r = analyse({ gazole: 2600, sp95: 2800, gnr: 0 }, { gazole: 2600, sp95: 3000, gnr: 0 }, 150, sur);
  const f = r.carburants.find(c => c.cle === 'sp95');
  assert.ok(f.datesExceptionnelles.includes('2026-09-30'), JSON.stringify(f.datesExceptionnelles));
  assert.ok(f.jugeSansJour);
  assert.notStrictEqual(f.cmp.pct, f.cmpAvec.pct, 'valeur nette et valeur avec le jour diffèrent');
});

t('pas assez de jours → insuffisant, rien d\'inventé', () => {
  const r = T.analysePiste(audits(jours(bornes.debut, 2), { gazole: 2600, sp95: 3000, gnr: 0 }, 100, 1), [], bornes, bRef);
  assert.strictEqual(r.etat, 'insuffisant');
  assert.strictEqual(r.retenue, null);
});

t('constantes provisoires : k = 2,0, hors service = 31 jours', () => {
  assert.strictEqual(T.K_DEPASSEMENT, 2.0);
  assert.strictEqual(T.JOURS_HORS_SERVICE, 31);
});

// Sensibilité de k (spécification de Guardian, 6803676665) : règle de dépassement isolée, jeux T1 à T5.
const KS = [1.5, 2.0, 2.5, 3.0];
const JEUX = {
  T1: { M: { I: 209, z: 2.1 }, S: { I: 400, z: 4.5 }, att: ['S', 'S', 'M', 'M'] },
  T2: { M: { I: 300, z: 3.0 }, S: { I: 450, z: 5.0 }, att: ['S', 'M', 'M', 'M'] },
  T3: { M: { I: 300, z: 2.2 }, S: { I: 150, z: 5.0 }, att: ['M', 'M', 'M', 'M'] },
  T4: { M: { I: 200, z: 2.5 }, S: { I: 250, z: null }, att: ['M', 'M', 'M', 'M'] },
  T5: { M: { I: 200, z: 2.0 }, S: { I: 250, z: 4.0 }, att: ['S', 'S', 'M', 'M'] },
};
Object.keys(JEUX).forEach(nom => KS.forEach((k, i) => {
  t('sensibilité ' + nom + ' k = ' + k, () => {
    const j = JEUX[nom], d = T.departagerDepassement(j.M, j.S, k);
    assert.strictEqual(d.passe ? 'S' : 'M', j.att[i]);
    if (nom === 'T4') assert.strictEqual(d.motif, 'dispersion nulle, ordre par défaut');
    if (nom === 'T3') assert.strictEqual(d.motif, 'ordre par défaut', 'l\'importance bloque le dépassement');
    if (d.passe) assert.ok(/^retenue par dépassement, z /.test(d.motif));
  });
}));

t('Sainte-Marie simulé : la masquée SP95 est retenue quel que soit k, k passable à analysePiste', () => {
  KS.forEach(k => {
    const r = T.analysePiste(audits(dE, { gazole: 2850, sp95: 2750, gnr: 0 }, 150, 3), audits(dR, { gazole: 2600, sp95: 3000, gnr: 0 }, 150, 5), bornes, bRef, k);
    assert.strictEqual(r.k, k);
    assert.strictEqual(r.retenue.type, 'masquee');
    assert.strictEqual(r.retenue.carburant, 'sp95');
  });
  assert.strictEqual(T.analysePiste(audits(dE, { gazole: 2850, sp95: 2750, gnr: 0 }, 150, 3), audits(dR, { gazole: 2600, sp95: 3000, gnr: 0 }, 150, 5), bornes, bRef).k, 2.0);
});

t('quarts par carburant : même quarts que « Litres »', () => {
  const q = T.quartsLitresCarburant(audits(dE, { gazole: 2600, sp95: 3000, gnr: 0 }, 100, 3), 'sp95');
  assert.strictEqual(q.length, 112);
  assert.ok(q.every(x => x.valeur > 0));
});

t('page : « Prix et volume » absent, carte Piste par carburant, GNR « 0 L » seul à l\'écran', () => {
  assert.ok(!/Prix et volume/.test(html));
  assert.ok(html.includes('T.analysePiste('));
  assert.ok(!/0 L · hors service|0 L : hors service/.test(html), 'aucune mention de hors service sur les cartes');
  assert.ok(html.includes('exclu des parts et des comparaisons : 0 L sur les '), 'exclusion tracée dans les preuves');
  assert.ok(html.includes('T.quartsLitresCarburant('));
});

t('page : vocabulaire sans cause ni « anomalie »', () => {
  const a = html.indexOf('T.analysePiste(rAud.data');
  const bloc = html.slice(a, a + 4500);
  assert.ok(!/anomalie|parce que|grâce à|à cause/i.test(bloc));
});

t('lecture seule : aucune écriture, aucune lecture ajoutée', () => {
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(html));
  assert.strictEqual((html.match(/\.from\(/g) || []).length, 14);
});

console.log(echecs ? '\n' + echecs + ' échec(s)' : '\nTout est vert');
process.exit(echecs ? 1 : 0);
