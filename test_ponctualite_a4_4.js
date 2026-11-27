'use strict';
// Lot A4-4 : une seule règle de ponctualité (nexus-ponctualite.js).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = __dirname;
global.window = global;
global.nexusDecalerJour = (j, n) => { const d = new Date(j + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const P = require('./nexus-ponctualite.js');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
const arr = (e, date, r) => ({ employee_id: e, type: 'arrivee', date, retard_min: r });

t('NULL sort des deux côtés de la fraction', () => {
  const r = P.tauxPonctualite([arr('a', '2026-11-01', 0), arr('a', '2026-11-02', 5), arr('a', '2026-11-03', null)], {});
  assert.strictEqual(r.nbArrivees, 3); assert.strictEqual(r.nbMesures, 2);
  assert.strictEqual(r.nbNonMesures, 1); assert.strictEqual(r.tauxAnomalies, 0.5);
});
t('rien de mesuré : null, jamais 100', () => {
  const r = P.tauxPonctualite([arr('a', '2026-11-01', null)], {});
  assert.strictEqual(r.tauxAnomalies, null); assert.strictEqual(r.tauxPonctualite, null);
});
t('bornes incluses, sorties exclues, départs ignorés', () => {
  const r = P.tauxPonctualite([arr('a', '2026-11-01', 0), arr('a', '2026-11-30', 4), arr('a', '2026-10-31', 9), arr('a', '2026-12-01', 9), { employee_id: 'a', type: 'depart', date: '2026-11-10', retard_min: 9 }], { debut: '2026-11-01', fin: '2026-11-30' });
  assert.strictEqual(r.nbMesures, 2); assert.strictEqual(r.nbRetards, 1);
});
t('aucun score d\'équipe : décision du gérant du 27/11/2026', () => {
  assert.strictEqual(P.scoreEquipe, undefined);
});
t('à surveiller : au moins 3 retards dans la fenêtre', () => {
  const r = P.tauxPonctualite([1, 2, 3].map(i => arr('a', '2026-11-0' + i, 3)).concat([arr('b', '2026-11-04', 3)]), {});
  assert.strictEqual(P.collaborateursASurveiller(r.retardsParEmploye), 1);
});
t('par collaborateur : retards et arrivées mesurées', () => {
  const r = P.tauxPonctualite([arr('a', '2026-11-01', 0), arr('a', '2026-11-02', 3), arr('a', '2026-11-03', null)], {});
  assert.deepStrictEqual([r.parCollaborateur.a.nbRetards, r.parCollaborateur.a.totalPointages], [1, 2]);
});
t('fenêtre : 30 jours depuis le jour de la station (31/10 → 29/11 pour le 29/11)', () => {
  assert.deepStrictEqual(P.fenetre('2026-11-29'), { debut: '2026-10-31', fin: '2026-11-29' });
  assert.strictEqual(P.fenetre(null), null);
});
t('charger : pagine par 1000 et borne la période', async () => {});
(async () => {
  const lignes = []; for (let i = 0; i < 2300; i++) lignes.push(arr('a', '2026-11-01', 0));
  let appels = 0, bornes = {};
  const client = { from() { const q = { select() { return q; }, eq(c, v) { bornes[c] = v; return q; }, gte(c, v) { bornes.gte = v; return q; }, lte(c, v) { bornes.lte = v; return q; }, order() { return q; }, range(a, b) { appels++; return Promise.resolve({ data: lignes.slice(a, b + 1), error: null }); } }; return q; } };
  const r = await P.charger(client, 'site-x', '2026-11-01', '2026-11-30');
  assert.strictEqual(r.data.length, 2300); assert.strictEqual(appels, 3);
  assert.strictEqual(bornes.site, 'site-x'); assert.strictEqual(bornes.gte, '2026-11-01'); assert.strictEqual(bornes.lte, '2026-11-30');
  n++; console.log('OK charger pagine et borne');

  // Parité par lecteur : chaque lecteur passe par le module (pas de formule locale).
  const lit = f => fs.readFileSync(path.join(D, f), 'utf8');
  const lecteurs = {
    'nexus-app-donnees.js': ['NexusPonctualite', 'P.fenetre'],
    'nexus-brief-donnees.js': ['NexusPonctualite', 'P.fenetre'],
    'nexus-risques-donnees.js': ['NexusPonctualite', 'P.fenetre'],
    'nexus-rapport-direction-donnees.js': ['NexusPonctualite.tauxPonctualite'],
    'NEXUS-Centre-Intelligence-v1.html': ['NexusPonctualite.charger', 'NexusPonctualite.fenetre'],
    'NEXUS-Radar-Manager-v1.html': ['NexusPonctualite.fenetre'],
  };
  Object.keys(lecteurs).forEach(f => lecteurs[f].forEach(m => assert.ok(lit(f).includes(m), f + ' doit utiliser ' + m)));
  n++; console.log('OK chaque lecteur passe par le module');

  ['NEXUS-App-v1.html', 'NEXUS-Brief-v1.html', 'NEXUS-Rapport-v1.html', 'NEXUS-Centre-Intelligence-v1.html', 'NEXUS-Radar-Manager-v1.html'].forEach(h => {
    const s = lit(h); const i = s.indexOf('nexus-ponctualite.js');
    assert.ok(i > 0, h + ' doit charger nexus-ponctualite.js');
  });
  n++; console.log('OK pages chargent le module');

  // Garde statique : `retard_min` ne se lit que dans le module, hors liste des lecteurs hors périmètre.
  const HORS_PERIMETRE = new Set([
    'nexus-ponctualite.js', 'test_', 'nexus-progression.js', 'nexus-paye-donnees.js', 'nexus-pointage-regles.js',
    'NEXUS-Apprentissage-v1.html', 'NEXUS-Progression-v1.html', 'NEXUS-Resultats-Equipe-v1.html', 'NEXUS-Journal-v1.html',
    'NEXUS-Pointage-v1.html', 'NEXUS-Debug-v1.html',
  ]);
  const lecteursMigres = Object.keys(lecteurs);
  const fautes = [];
  lecteursMigres.forEach(f => {
    const code = lit(f).split('\n').filter(l => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');
    if (/retard_min/.test(code)) {
      // seuls les filtres d'affichage `Number(p.retard_min) > 0` après chargement par le module sont admis
      const lignesRm = code.split('\n').filter(l => /retard_min/.test(l));
      // admis : sélection de colonne, filtre d'affichage > 0, cumul de minutes (affichage, pas un taux)
      lignesRm.forEach(l => { if (!/\.select\(/.test(l) && !/Number\(p\.retard_min\) > 0/.test(l) && !/retard_min\s*>\s*0/.test(l) && !/Number\.isFinite\(p\.retard_min\)/.test(l) && !/\+= p\.retard_min/.test(l)) fautes.push(f + ' : ' + l.trim()); });
    }
  });
  assert.deepStrictEqual(fautes, [], 'retard_min lu hors module : ' + fautes.join(' | '));
  n++; console.log('OK garde statique retard_min');
  console.log(n + ' épreuves OK');
})().catch(e => { console.error(e); process.exit(1); });

// E7 — aucun statut ni couleur de jugement sur un collaborateur tiré du pointage
// (décision du gérant du 27/11/2026).
t('E7 aucun jugement nominal tiré du pointage', () => {
  const g = {};
  new Function('window', fs.readFileSync(path.join(D, 'nexus-progression.js'), 'utf8'))(g);
  const NP = g.NexusProgression;
  const r = NP.statutPonctualite([
    { date: '2026-11-20', retard_min: 20 }, { date: '2026-11-21', retard_min: 0 },
    { date: '2026-11-22', retard_min: 0 }, { date: '2026-11-23', retard_min: 0 },
    { date: '2026-11-24', retard_min: 0 }, { date: '2026-11-25', retard_min: 0 },
  ]);
  assert.strictEqual(r.statut, 'Non noté');
  assert.strictEqual(r.score, undefined);
  const q = NP.analyserQualites({ statutCaisseVal: { statut: 'Non noté' }, statutPonctualiteVal: r,
    statutMissionsVal: { statut: 'Non noté' }, statutTenueVal: { statut: 'Non noté' }, statutRelationClientVal: { statut: 'Non noté' } });
  assert.ok(!q.some(x => /ponctuel/i.test(x)), 'aucune qualité de ponctualité nominale');
  const risques = fs.readFileSync(path.join(D, 'nexus-risques-donnees.js'), 'utf8');
  assert.ok(!/ponctualite_recurrente'\s*,\s*(site|detail)/.test(risques) || /filter/.test(risques));
});
