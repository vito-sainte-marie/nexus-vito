// Test — v2.268-C1 (28/08/2026) : nexus-ecarts-donnees.js, le chargeur
// consolidé Verify+FDJ de "Analyse des écarts" (cadrage de Frédéric).
// Teste les fonctions PURES de normalisation/filtrage (aucun accès
// réseau) avec de vraies fixtures reproduisant les colonnes réelles de
// audits_caisse / fdj_shifts / fdj_cash_controls (vérifiées par requête
// SQL directe sur le projet Supabase avant d'écrire ce test — Article 5,
// jamais un schéma supposé).

const path = require('path');
const assert = require('assert');

const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-ecarts-donnees.js'));
const D = globalThis.NexusEcartsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

const EMPLOYES = { 'emp-1': 'Angélique', 'emp-2': 'Marc' };

// ------------------------------------------------------------
// 1) normaliserAuditsVerify — 5 situations réelles sur un même audit
// ------------------------------------------------------------
{
  const audits = [
    // Q1 : piste jamais eu d'écart (0/0) -> exclue. Boutique : écart
    // +12,00€ initial, corrigé à 0, validé, cause connue -> RÉGULARISÉ.
    {
      id: 'a1', date: '2026-08-20', quart: '1', employee_id: 'emp-1',
      ecart_piste: 0, ecart_piste_origine: null, ecart_piste_valide: null, valide_le_piste: null, cause_code_piste: null,
      ecart_boutique: 12, ecart_boutique_origine: 12, ecart_boutique_valide: 0, valide_le_boutique: '2026-08-20T18:00:00Z', valide_par_boutique: 'mgr-1', cause_code_boutique: 'erreur_saisie',
    },
    // Q2 : piste écart -9,00€ jamais validé -> À VÉRIFIER. Boutique
    // inexistante sur ce quart (colonne null) -> exclue.
    {
      id: 'a2', date: '2026-08-21', quart: '2', employee_id: 'emp-2',
      ecart_piste: -9, ecart_piste_origine: -9, ecart_piste_valide: null, valide_le_piste: null, cause_code_piste: null,
      ecart_boutique: null, ecart_boutique_origine: null, ecart_boutique_valide: null, valide_le_boutique: null, cause_code_boutique: null,
    },
    // Q1 (jour suivant) : piste écart +6,00€ validé TEL QUEL (persiste),
    // cause auto 'non_explique' -> CLÔTURÉ NON EXPLIQUÉ.
    {
      id: 'a3', date: '2026-08-22', quart: '1', employee_id: 'emp-1',
      ecart_piste: 6, ecart_piste_origine: 6, ecart_piste_valide: 6, valide_le_piste: '2026-08-22T18:00:00Z', valide_par_piste: 'mgr-1', cause_code_piste: 'non_explique',
      ecart_boutique: null,
    },
    // Q2 (jour suivant) : boutique écart -5,00€ validé TEL QUEL mais avec
    // une vraie cause connue -> CLÔTURÉ EXPLIQUÉ.
    {
      id: 'a4', date: '2026-08-22', quart: '2', employee_id: null,
      ecart_piste: null,
      ecart_boutique: -5, ecart_boutique_origine: -5, ecart_boutique_valide: -5, valide_le_boutique: '2026-08-22T20:00:00Z', valide_par_boutique: 'mgr-2', cause_code_boutique: 'erreur_montant_caisse',
    },
  ];

  const lignes = D.normaliserAuditsVerify(audits, EMPLOYES);
  assert.strictEqual(lignes.length, 4, 'exactement 4 lignes (aucun_ecart et composantes inexistantes exclues) : ' + JSON.stringify(lignes.map(l => l.id)));

  const l1 = lignes.find(l => l.id === 'verify-a1-boutique');
  assert.ok(l1, 'ligne boutique a1 attendue');
  assert.strictEqual(l1.statut, 'regularise');
  assert.strictEqual(l1.ecartInitial, 12);
  assert.strictEqual(l1.ecartFinal, 0);
  assert.strictEqual(l1.employeeNom, 'Angélique', 'nom employé résolu via la map employees');
  assert.strictEqual(l1.deepLink, 'NEXUS-Verify-v1.html?ouvrir_date=2026-08-20&ouvrir_quart=1', 'deep-link exact vers ce quart précis');

  const l2 = lignes.find(l => l.id === 'verify-a2-piste');
  assert.ok(l2, 'ligne piste a2 attendue');
  assert.strictEqual(l2.statut, 'a_verifier', 'écart non validé -> toujours À VÉRIFIER, quelle que soit la situation');

  const l3 = lignes.find(l => l.id === 'verify-a3-piste');
  assert.strictEqual(l3.statut, 'cloture_non_explique', 'écart persistant validé avec cause automatique non_explique -> clôturé non expliqué');

  const l4 = lignes.find(l => l.id === 'verify-a4-boutique');
  assert.strictEqual(l4.statut, 'cloture_explique', 'écart persistant validé avec une vraie cause -> clôturé expliqué');
  assert.strictEqual(l4.employeeNom, null, 'pas d\'employé sur cette ligne -> null, jamais un nom fabriqué');

  assert.ok(!lignes.some(l => l.id === 'verify-a1-piste'), 'piste a1 (0/0, aucun écart) correctement exclue');
  assert.ok(!lignes.some(l => l.id === 'verify-a2-boutique'), 'boutique a2 (composante inexistante) correctement exclue');

  ok('normaliserAuditsVerify — 5 situations réelles (aucun écart exclu, à vérifier, régularisé, clôturé expliqué/non expliqué) correctement dérivées depuis les vraies colonnes audits_caisse');
}

// ------------------------------------------------------------
// 2) normaliserControlesFdj — jointure fdj_shifts + fdj_cash_controls,
// jamais de ligne quand fdj_cash_controls est absent (quart pas encore
// compté).
// ------------------------------------------------------------
{
  const shifts = [
    {
      id: 'sh1', date: '2026-08-23', quart: '1', employee_id: 'emp-1',
      fdj_cash_controls: { id: 'c1', ecart: 0, ecart_origine: 15, resultat_controle: 'a_regulariser', motif_ecart: 'erreur_comptage', valide_le: '2026-08-23T20:00:00Z', valide_par: 'mgr-1' },
    },
    { id: 'sh2', date: '2026-08-23', quart: '2', employee_id: 'emp-2', fdj_cash_controls: null }, // pas encore compté
    {
      id: 'sh3', date: '2026-08-24', quart: '1', employee_id: 'emp-2',
      fdj_cash_controls: { id: 'c3', ecart: -20, ecart_origine: -20, resultat_controle: '', motif_ecart: null, valide_le: null, valide_par: null },
    },
  ];
  const lignes = D.normaliserControlesFdj(shifts, EMPLOYES);
  assert.strictEqual(lignes.length, 2, 'sh2 (aucun contrôle) exclue : ' + JSON.stringify(lignes.map(l => l.id)));

  const c1 = lignes.find(l => l.id === 'fdj-c1');
  assert.strictEqual(c1.statut, 'regularise');
  assert.strictEqual(c1.activite, 'fdj');
  assert.strictEqual(c1.deepLink, 'NEXUS-FDJ-Manager-v1.html?date=2026-08-23&quart=1');

  const c3 = lignes.find(l => l.id === 'fdj-c3');
  assert.strictEqual(c3.statut, 'a_verifier', 'resultat_controle vide ("") -> pas clôturé -> à vérifier');

  ok('normaliserControlesFdj — jointure fdj_shifts/fdj_cash_controls correcte, quart sans contrôle exclu, resultat_controle vide traité comme non clôturé');
}

// ------------------------------------------------------------
// 3) appliquerFiltresEcarts — combinaison de filtres (§12 du cadrage)
// ------------------------------------------------------------
{
  const lignes = [
    { id: '1', date: '2026-08-20', quart: '1', employeeId: 'emp-1', activite: 'piste', sourceModule: 'verify', ecartFinal: 12, statut: 'regularise', causeCode: 'erreur_saisie' },
    { id: '2', date: '2026-08-21', quart: '2', employeeId: 'emp-2', activite: 'fdj', sourceModule: 'fdj', ecartFinal: -9, statut: 'a_verifier', causeCode: null },
    { id: '3', date: '2026-08-22', quart: '1', employeeId: 'emp-1', activite: 'boutique', sourceModule: 'verify', ecartFinal: -5, statut: 'cloture_explique', causeCode: 'erreur_montant_caisse' },
  ];

  assert.strictEqual(D.appliquerFiltresEcarts(lignes, {}).length, 3, 'aucun filtre -> tout ressort');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { dateDebut: '2026-08-21' }).length, 2, 'filtre période (dateDebut)');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { employeeId: 'emp-1' }).length, 2, 'filtre employé');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { activite: 'fdj' }).length, 1, 'filtre activité');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { signe: 'negatif' }).length, 2, 'filtre signe (négatif)');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { signe: 'positif' }).length, 1, 'filtre signe (positif)');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { statut: 'a_verifier' }).length, 1, 'filtre statut');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { causeCode: 'erreur_saisie' }).length, 1, 'filtre cause');
  assert.strictEqual(D.appliquerFiltresEcarts(lignes, { employeeId: 'emp-1', signe: 'negatif' }).length, 1, 'filtres combinables (employé + signe)');

  ok('appliquerFiltresEcarts — toutes les dimensions du cadrage (§12) filtrent correctement, seules et combinées');
}

console.log(`\n${n} tests passés.`);
