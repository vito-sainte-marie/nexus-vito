// Scénarios de ventilation avec estimation (doctrine du 02/09/2026).
//
// Règle posée par Frédéric : un quart manquant est remplacé par une
// estimation ; dès que le quart réel est intégré, il prend la place de
// l'estimation comme vérité. Et une estimation se mémorise comme contexte,
// jamais comme vérité métier.
'use strict';

const { creerContexte } = require('./banc.js');

const ctx = creerContexte(['nexus-carburant-moteur.js']);
const M = ctx.NexusCarburantMoteur;
const FUSEAU = 'America/Martinique';
const HORAIRES = {
  quart1: { normal: '05:45', etendu: '05:45', fin_normal: '12:45', fin_etendu: '13:45' },
  quart2: { normal: '12:40', etendu: '13:40', fin_normal: '20:05', fin_etendu: '22:05' },
};
// Moyennes historiques du créneau, en litres pour un quart complet.
const MOYENNES = { '1': { go: 1200, sp95: 1400, gnr: 0 }, '2': { go: 1500, sp95: 1000, gnr: 0 } };

const Q1 = { date: '2026-09-01', quart: '1', litrage_gazole: 1149.83, litrage_sp95: 1379.69, litrage_gnr: 0 };
const Q2 = { date: '2026-09-01', quart: '2', litrage_gazole: 1465, litrage_sp95: 1018, litrage_gnr: 0 };

// Fenêtre : de la mesure post-livraison (01/09 08:56 locale) au jaugeage du
// lendemain matin (02/09 05:55 locale). Martinique = UTC-4.
const T0 = new Date('2026-09-01T12:56:00Z');
const T1 = new Date('2026-09-02T09:55:00Z');
const DATES = ['2026-09-01', '2026-09-02'];

let echecs = 0;
const n = v => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR'));
function verifier(libelle, ok) { console.log(`     ${ok ? '✔' : '✘'} ${libelle}`); if (!ok) echecs++; }
function afficher(titre, r) {
  console.log(`\n### ${titre}`);
  console.log(`  ventes go  : ${n(r.ventes.go).padStart(7)}  (réel ${n(r.ventesReelles.go)} + estimé ${n(r.ventesEstimees.go)})`);
  console.log(`  ventes sp95: ${n(r.ventes.sp95).padStart(7)}  (réel ${n(r.ventesReelles.sp95)} + estimé ${n(r.ventesEstimees.sp95)})`);
  console.log('  contexte   : ' + (r.contexte.length
    ? r.contexte.map(c => `${c.date.slice(5)} q${c.quart} ${c.nature}${c.nature === 'reel' ? '' : ` ${Math.round(c.fraction * 100)}%`}`).join(' · ')
    : '(vide)'));
}

// E — La situation du 02/09 : quart 1 à cheval sur la livraison, quart 2 absent.
const e = M.ventilerFenetreAvecEstimation([Q1], HORAIRES, T0, T1, FUSEAU, MOYENNES, DATES);
afficher('E · Quart 1 à cheval sur la livraison, quart 2 de la veille absent', e);
verifier('un chiffre de ventes est produit au lieu du silence', e.ventes.go != null && e.ventes.sp95 != null);
verifier('le résultat est marqué comme estimé', e.estime === true);
verifier('le quart 1 saisi mais à cheval est estimé, jamais compté en entier',
  e.contexte.some(c => c.quart === '1' && c.nature === 'estime_chevauchement' && c.fraction < 1));
verifier('le quart 2 absent est estimé',
  e.contexte.some(c => c.date === '2026-09-01' && c.quart === '2' && c.nature === 'estime_absent'));
verifier('aucune part réelle n’est inventée sur un quart estimé', e.ventesReelles.go == null);

// F — Le quart 2 est saisi entre-temps : il prend la place de l'estimation.
const f = M.ventilerFenetreAvecEstimation([Q1, Q2], HORAIRES, T0, T1, FUSEAU, MOYENNES, DATES);
afficher('F · Le quart 2 est intégré — il remplace son estimation', f);
verifier('le quart 2 est désormais compté comme réel, plus jamais estimé',
  f.contexte.some(c => c.quart === '2' && c.nature === 'reel')
  && !f.contexte.some(c => c.quart === '2' && c.nature === 'estime_absent'));
verifier('sa valeur mesurée est reprise telle quelle (1 465 L gazole)',
  Math.round(f.ventesReelles.go) === 1465);
verifier('le quart 1 à cheval reste estimé : saisir plus ne ventile pas un quart agrégé',
  f.contexte.some(c => c.quart === '1' && c.nature === 'estime_chevauchement'));
verifier('le total a bougé en intégrant la vérité', Math.round(f.ventes.go) !== Math.round(e.ventes.go));

// G — Fenêtre totalement couverte par des quarts réels : aucune estimation.
const T0g = new Date('2026-09-01T09:45:00Z'); // 05:45 locale, ouverture
const g = M.ventilerFenetreAvecEstimation([Q1, Q2], HORAIRES, T0g, T1, FUSEAU, MOYENNES, ['2026-09-01']);
afficher('G · Journée entière couverte par deux quarts saisis', g);
verifier('aucune estimation quand tout est mesuré', g.estime === false);
verifier('les ventes sont exactement la somme mesurée (2 614,83 L gazole)',
  Math.abs(g.ventes.go - 2614.83) < 0.01);

// H — Horaires non configurés : ni mesure ni estimation, jamais un chiffre inventé.
const h = M.ventilerFenetreAvecEstimation([Q1], null, T0, T1, FUSEAU, MOYENNES, DATES);
afficher('H · Horaires du site non configurés', h);
verifier('aucun chiffre produit, et la raison est explicite',
  h.ventes.go == null && h.bloque === 'horaires_non_configures');

console.log(`\n${echecs === 0 ? 'Tous les scénarios passent.' : echecs + ' scénario(s) en échec.'}`);
process.exit(echecs ? 1 : 0);
