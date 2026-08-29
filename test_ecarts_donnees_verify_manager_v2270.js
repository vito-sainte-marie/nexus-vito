// Test — v2.270 (28/08/2026) : correctif "activité inhabituelle" ne
// s'applique jamais à Verify, un manager qui audite Piste/Boutique fait son
// travail normal (Verify est structurellement réservé aux managers/gérants
// — cf. le contrôle de rôle à l'ouverture de NEXUS-Verify-v1.html). Sans ce
// correctif, en données réelles (100% des 83 audits_caisse de
// vito-sainte-marie rattachés à un employé de rôle 'manager'), chaque audit
// routinier de Frédéric était faussement signalé comme une anomalie à
// qualifier — retour de Frédéric "je n'arrive plus à ouvrir NEXUS".

const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-ecarts-donnees.js'));
const D = globalThis.NexusEcartsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) normaliserAuditsVerify — un manager qui audite Piste/Boutique n'est
// JAMAIS signalé comme activité inhabituelle, quel que soit l'écart.
// ------------------------------------------------------------
{
  const audits = [
    { id: 'a1', date: '2026-08-28', quart: '1', employee_id: 'fred-id',
      ecart_piste: 2148.56, ecart_piste_origine: 2148.56, ecart_piste_valide: 0.87, valide_le_piste: '2026-08-28T19:53:23Z', valide_par_piste: 'fred-id', cause_code_piste: null,
      ecart_boutique: null },
  ];
  const lignes = D.normaliserAuditsVerify(audits, { 'fred-id': 'Fred' }, { 'fred-id': 'manager' });
  assert.strictEqual(lignes.length, 1);
  assert.strictEqual(lignes[0].activiteInhabituelle, false, 'un manager qui audite Verify (son travail normal) n\'est jamais signalé, même avec un gros écart initial : ' + JSON.stringify(lignes[0]));
  assert.strictEqual(lignes[0].employeeRole, 'manager', 'le rôle reste bien transmis — seul le signal "inhabituel" est neutralisé pour Verify');

  ok('normaliserAuditsVerify — manager jamais signalé comme activité inhabituelle (Verify = son travail normal)');
}

// ------------------------------------------------------------
// 2) normaliserControlesFdj — la règle reste inchangée sur FDJ : un manager
// qui apparaît sur un contrôle de caisse FDJ (normalement tenu par un
// non-manager) reste correctement signalé.
// ------------------------------------------------------------
{
  const shifts = [
    { id: 'sh1', date: '2026-08-23', quart: '1', employee_id: 'fred-id',
      fdj_cash_controls: { id: 'c1', ecart: 120.38, ecart_origine: 120.38, resultat_controle: 'a_regulariser', motif_ecart: null, valide_le: null, valide_par: null } },
  ];
  const lignes = D.normaliserControlesFdj(shifts, { 'fred-id': 'Fred' }, { 'fred-id': 'manager' });
  assert.strictEqual(lignes[0].activiteInhabituelle, true, 'sur FDJ, un manager reste correctement signalé (règle inchangée, seul Verify est exempté)');

  ok('normaliserControlesFdj — règle inchangée : un manager sur FDJ reste signalé');
}

console.log(`\n${n} tests passés.`);
