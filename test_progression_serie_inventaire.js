// Test — "Mes séries" volet Inventaire (20/08/2026, suite du cadrage
// NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf, discutée
// avec Frédéric le 19-20/08/2026).
//
// Portée : qualifierQuartsInventaireEmploye (délai de grâce, corrections
// imputables vs techniques, simulations exclues, attribution
// responsable_comptage) + calculerSerieDepuisEvenements (générique,
// réutilisable) + le catalogue PALIERS_SERIE_INVENTAIRE via les fonctions
// génériques paliersFranchis/prochainPalier (déjà testées côté Caisse — on
// vérifie ici seulement qu'elles fonctionnent aussi avec ce catalogue).
//
// nexus-progression.js est un IIFE écrit pour le navigateur — on stub
// `window` avant de le requérir, comme documenté dans le fichier lui-même.

global.window = global;
require(__dirname + '/nexus-progression.js');
const assert = require('assert');
const N = global.NexusProgression;

const MAINTENANT = '2026-08-20T12:00:00Z'; // date de référence fixe pour tous les scénarios

function quartEmploye({ id = 'qe1', date, quart, clotureLe, aValideCloture = true, responsable = true, simulation = false }) {
  return {
    quart_id: id, employee_id: 'emp1', responsable_comptage: responsable, a_valide_cloture: aValideCloture,
    inventaire_quarts: { id, date, quart, cloture_le: clotureLe, is_simulation: simulation },
  };
}

// ------------------------------------------------------------
// 1) Quart clôturé il y a 10 jours, aucune correction -> SUCCESS (délai de
//    grâce de 7 jours largement dépassé).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-10', quart: 'matin', clotureLe: '2026-08-10T09:00:00Z' })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].outcome, 'SUCCESS');
}

// ------------------------------------------------------------
// 2) Quart clôturé il y a 2 jours (dans le délai de grâce) -> PENDING, pas
//    encore assez sûr pour compter (PROG-01 esprit : rien de définitif
//    trop tôt).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-18', quart: 'soir', clotureLe: '2026-08-18T21:00:00Z' })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT);
  assert.strictEqual(res[0].outcome, 'PENDING');
}

// ------------------------------------------------------------
// 3) Quart pas encore clôturé côté employé (a_valide_cloture=false) ->
//    PENDING, même si inventaire_quarts.cloture_le existe déjà par ailleurs
//    (ne doit jamais arriver en pratique, mais la fonction reste prudente).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-01', quart: 'matin', clotureLe: '2026-08-01T09:00:00Z', aValideCloture: false })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT);
  assert.strictEqual(res[0].outcome, 'PENDING');
}

// ------------------------------------------------------------
// 4) Correction "erreur_saisie" sur le même (date|quart) -> FAIL_CONFIRMED,
//    même si le quart est déjà largement hors délai de grâce.
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z' })];
  const corrections = [{ operational_date: '2026-08-05', quart: 'matin', correction_type: 'erreur_saisie' }];
  const res = N.qualifierQuartsInventaireEmploye(rows, corrections, MAINTENANT);
  assert.strictEqual(res[0].outcome, 'FAIL_CONFIRMED');
}

// ------------------------------------------------------------
// 5) Correction "mouvement_oublie" -> FAIL_CONFIRMED également (cadrage
//    §4 : les deux types imputables cassent la série).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'soir', clotureLe: '2026-08-05T21:00:00Z' })];
  const corrections = [{ operational_date: '2026-08-05', quart: 'soir', correction_type: 'mouvement_oublie' }];
  const res = N.qualifierQuartsInventaireEmploye(rows, corrections, MAINTENANT);
  assert.strictEqual(res[0].outcome, 'FAIL_CONFIRMED');
}

// ------------------------------------------------------------
// 6) Correction "stock_retenu" -> NE casse PAS la série (technique/
//    ambiguë, cadrage : "Correction technique -> Ne casse pas la série").
//    Le quart reste SUCCESS puisque hors délai de grâce.
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z' })];
  const corrections = [{ operational_date: '2026-08-05', quart: 'matin', correction_type: 'stock_retenu' }];
  const res = N.qualifierQuartsInventaireEmploye(rows, corrections, MAINTENANT);
  assert.strictEqual(res[0].outcome, 'SUCCESS');
}

// ------------------------------------------------------------
// 7) Correction "corriger_preparation_q1" (Production journalière, hors
//    périmètre comptage) -> ne casse pas non plus la série.
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z' })];
  const corrections = [{ operational_date: '2026-08-05', quart: 'matin', correction_type: 'corriger_preparation_q1' }];
  const res = N.qualifierQuartsInventaireEmploye(rows, corrections, MAINTENANT);
  assert.strictEqual(res[0].outcome, 'SUCCESS');
}

// ------------------------------------------------------------
// 8) Quart de simulation (is_simulation=true) -> totalement exclu du
//    résultat (Sprint 8 : les simulations ne doivent jamais alimenter une
//    statistique réelle d'employé).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z', simulation: true })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT);
  assert.strictEqual(res.length, 0);
}

// ------------------------------------------------------------
// 9) Quart où l'employé n'était PAS responsable du comptage
//    (responsable_comptage=false) -> exclu, même règle d'attribution solo
//    que la Caisse (section 1 du moteur).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z', responsable: false })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT);
  assert.strictEqual(res.length, 0);
}

// ------------------------------------------------------------
// 10) Délai de grâce configurable — avec delaiGraceJours=0, un quart
//     clôturé il y a 2 jours devient immédiatement SUCCESS (vérifie que le
//     paramètre est bien pris en compte, pas seulement la constante par
//     défaut).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-18', quart: 'soir', clotureLe: '2026-08-18T21:00:00Z' })];
  const res = N.qualifierQuartsInventaireEmploye(rows, [], MAINTENANT, 0);
  assert.strictEqual(res[0].outcome, 'SUCCESS');
}

// ------------------------------------------------------------
// 11) calculerSerieDepuisEvenements — mélange SUCCESS/FAIL_CONFIRMED/
//     PENDING : PENDING ignoré (ni compté, ni interrupteur), FAIL_CONFIRMED
//     remet à 0, series calculées en ordre chronologique (date puis quart).
// ------------------------------------------------------------
{
  const evenements = [
    { date: '2026-08-01', quart: 'matin', outcome: 'SUCCESS' },
    { date: '2026-08-01', quart: 'soir', outcome: 'SUCCESS' },
    { date: '2026-08-02', quart: 'matin', outcome: 'PENDING' }, // ignoré
    { date: '2026-08-03', quart: 'matin', outcome: 'SUCCESS' },
    { date: '2026-08-04', quart: 'matin', outcome: 'FAIL_CONFIRMED' },
    { date: '2026-08-05', quart: 'matin', outcome: 'SUCCESS' },
  ];
  const serie = N.calculerSerieDepuisEvenements(evenements);
  assert.strictEqual(serie.record, 3); // 01-matin, 01-soir, 03-matin
  assert.strictEqual(serie.enCours, 1); // seul 05-matin après le FAIL du 04
  assert.strictEqual(serie.total, 5); // 6 événements moins le PENDING ignoré
}

// ------------------------------------------------------------
// 12) calculerSerieDepuisEvenements — liste vide -> jamais une erreur,
//     jamais un chiffre inventé (Article 5).
// ------------------------------------------------------------
{
  const serie = N.calculerSerieDepuisEvenements([]);
  assert.deepStrictEqual(serie, { enCours: 0, record: 0, total: 0 });
}

// ------------------------------------------------------------
// 13) Catalogue PALIERS_SERIE_INVENTAIRE + fonctions génériques
//     paliersFranchis/prochainPalier réutilisées avec ce catalogue.
// ------------------------------------------------------------
{
  assert.deepStrictEqual(N.PALIERS_SERIE_INVENTAIRE.map(p => p.code), ['inventaire_x5', 'inventaire_x10', 'inventaire_x20']);
  const nouveaux = N.paliersFranchis(N.PALIERS_SERIE_INVENTAIRE, 5, []);
  assert.strictEqual(nouveaux.length, 1);
  assert.strictEqual(nouveaux[0].code, 'inventaire_x5');
  const suivant = N.prochainPalier(N.PALIERS_SERIE_INVENTAIRE, 5, ['inventaire_x5']);
  assert.strictEqual(suivant.code, 'inventaire_x10');
  assert.strictEqual(suivant.manque, 5);
}

// ------------------------------------------------------------
// 14) Correction imputable sur un quart d'un AUTRE employé (même date/
//     quart mais quart_employe non fourni ici — la fonction ne connaît que
//     ce qu'on lui donne) : deux employés responsables de comptage
//     différents un même jour ne doivent normalement jamais partager
//     (date|quart) puisqu'un seul est responsable — vérifie simplement que
//     la clé de correspondance reste (date|quart), pas (produit_id), donc
//     UNE correction sur N'IMPORTE QUEL produit du quart disqualifie tout
//     le quart (cadrage : la série porte sur la session, pas le produit).
// ------------------------------------------------------------
{
  const rows = [quartEmploye({ date: '2026-08-05', quart: 'matin', clotureLe: '2026-08-05T09:00:00Z' })];
  const corrections = [{ operational_date: '2026-08-05', quart: 'matin', correction_type: 'erreur_saisie', produit_id: 'produit-quelconque-non-lie' }];
  const res = N.qualifierQuartsInventaireEmploye(rows, corrections, MAINTENANT);
  assert.strictEqual(res[0].outcome, 'FAIL_CONFIRMED');
}

console.log('test_progression_serie_inventaire.js : OK (14 assertions)');
