// Test — v2.285 (29/08/2026) : P0 signalé par Frédéric — "Composition —
// Audrey" affichait un écart Piste de -36,65 € qui appartient en réalité à
// Ruddy (pompiste). Cause réelle, confirmée par requête SQL directe sur le
// projet Supabase (Article 5, jamais une fausse précision) : l'audit
// 17/08/2026 Quart 2 de vito-sainte-marie a employee_id = Audrey (l'auteur
// du contrôle, un manager), mais employes_piste = [Ruddy], employes_boutique
// = [loane] — les VRAIS employés de caisse. nexus-ecarts-donnees.js
// attribuait par erreur employee_id aux DEUX lignes (piste ET boutique),
// quel que soit le type — jamais les bons tableaux par activité.
//
// Correctif : resoudreEmployeCaisseVerify (nexus-ecarts-moteur.js) résout
// l'employé à partir de employes_{piste|boutique}, jamais de employee_id.
// 0 employé -> null (rien à attribuer). 1 -> attribution directe. 2+ ->
// jamais une attribution unique arbitraire (nom affiché à titre informatif
// seulement, employeeId reste null) — mieux vaut une ligne non rattachée à
// un employé (exclue proprement de "Par employé") qu'une fausse précision
// sur qui est responsable.

const path = require('path');
const assert = require('assert');
const DIR = __dirname;
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-ecarts-donnees.js'));
const M = globalThis.NexusEcartsMoteur;
const D = globalThis.NexusEcartsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) resoudreEmployeCaisseVerify — les 3 cas isolés (fonction pure).
// ------------------------------------------------------------
{
  const noms = { ruddy: 'Ruddy', loane: 'loane', audrey: 'Audrey' };
  const roles = { ruddy: 'pompiste', loane: 'caissier', audrey: 'manager' };

  const un = M.resoudreEmployeCaisseVerify(['ruddy'], noms, roles);
  assert.deepStrictEqual(un, { employeeId: 'ruddy', employeeNom: 'Ruddy', employeeRole: 'pompiste' }, 'un seul employé -> attribution directe');

  const zero = M.resoudreEmployeCaisseVerify([], noms, roles);
  assert.deepStrictEqual(zero, { employeeId: null, employeeNom: null, employeeRole: null }, 'aucun employé -> rien à attribuer, jamais un nom fabriqué');

  const zeroUndef = M.resoudreEmployeCaisseVerify(undefined, noms, roles);
  assert.deepStrictEqual(zeroUndef, { employeeId: null, employeeNom: null, employeeRole: null }, 'colonne absente (undefined) -> traité comme aucun employé, jamais une exception');

  const deux = M.resoudreEmployeCaisseVerify(['ruddy', 'loane'], noms, roles);
  assert.strictEqual(deux.employeeId, null, 'plusieurs employés sur la même caisse -> jamais une attribution unique arbitraire');
  assert.strictEqual(deux.employeeNom, 'Ruddy, loane', 'les deux noms restent affichés à titre informatif');
  assert.strictEqual(deux.employeeRole, null, 'pas de rôle unique non plus quand l\'attribution est ambiguë');

  ok('resoudreEmployeCaisseVerify — 0/1/2+ employés correctement distingués, jamais de fausse précision');
}

// ------------------------------------------------------------
// 2) Scénario réel — 17/08/2026 Quart 2, vito-sainte-marie (données
// confirmées par requête SQL directe avant d'écrire ce test).
// ------------------------------------------------------------
{
  const audits = [
    {
      id: '2e9d25ae-9242-446f-8a31-862d21cd8f2b', date: '2026-08-17', quart: '2',
      employee_id: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed', // Audrey — l'AUTEUR du contrôle, PAS un employé de caisse
      employes_piste: ['f98c64f6-9585-4437-a4a1-36265406207b'], // Ruddy
      employes_boutique: ['d0656292-f1a2-4dd6-9518-00231b37c6e2'], // loane
      ecart_piste: -36.649999999999636, ecart_piste_origine: -36.649999999999636, ecart_piste_valide: -36.649999999999636,
      valide_le_piste: '2026-08-17T09:29:00Z', valide_par_piste: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed', cause_code_piste: null,
      ecart_boutique: 0.3799999999996544, ecart_boutique_origine: 0.3799999999996544, ecart_boutique_valide: 0.3799999999996544,
      valide_le_boutique: '2026-08-17T09:29:00Z', valide_par_boutique: '21fb5e59-5a10-4831-a2ff-b5a4549e0bed', cause_code_boutique: null,
    },
  ];
  const nomParEmploye = {
    'f98c64f6-9585-4437-a4a1-36265406207b': 'Ruddy',
    'd0656292-f1a2-4dd6-9518-00231b37c6e2': 'loane',
    '21fb5e59-5a10-4831-a2ff-b5a4549e0bed': 'Audrey',
  };
  const roleParEmploye = {
    'f98c64f6-9585-4437-a4a1-36265406207b': 'pompiste',
    'd0656292-f1a2-4dd6-9518-00231b37c6e2': 'caissier',
    '21fb5e59-5a10-4831-a2ff-b5a4549e0bed': 'manager',
  };

  const lignes = D.normaliserAuditsVerify(audits, nomParEmploye, roleParEmploye);
  assert.strictEqual(lignes.length, 2);

  const piste = lignes.find(l => l.activite === 'piste');
  assert.strictEqual(piste.employeeNom, 'Ruddy', 'l\'écart Piste de -36,65 € appartient à Ruddy, pas à Audrey');
  assert.strictEqual(piste.employeeRole, 'pompiste');
  assert.notStrictEqual(piste.employeeNom, 'Audrey', 'ne doit plus jamais atterrir sur "Composition — Audrey"');

  const boutique = lignes.find(l => l.activite === 'boutique');
  assert.strictEqual(boutique.employeeNom, 'loane', 'l\'écart Boutique de +0,38 € appartient à loane, pas à Audrey');
  assert.notStrictEqual(boutique.employeeNom, 'Audrey');

  // "Par employé" : Audrey ne doit plus jamais absorber ces deux écarts.
  const agg = M.agregerEcartsParEmploye(lignes);
  assert.ok(!agg.some(a => a.employeeNom === 'Audrey'), 'Audrey n\'apparaît plus du tout dans "Par employé" pour ce quart (elle n\'a aucun écart en propre ici)');
  const aggRuddy = agg.find(a => a.employeeNom === 'Ruddy');
  assert.ok(aggRuddy, 'Ruddy apparaît bien dans "Par employé"');
  assert.strictEqual(aggRuddy.manquesConstates, -36.65, 'le manque de Ruddy est correctement isolé (arrondi centimes)');

  ok('normaliserAuditsVerify — reproduction exacte du cas réel 17/08 Q2 : Ruddy/loane correctement attribués, Audrey (auteur) jamais confondue avec un employé de caisse');
}

console.log(`\n${n} tests passés.`);
