const assert = require('assert');
require('./nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;

const employees = [
  { id: 'e1', nom: 'Salarié', role: 'pompiste', actif: true },
  { id: 'e2', nom: 'Manager', role: 'manager', actif: true },
];
const settings = [
  { employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' },
  { employee_id: 'e2', inclus_paye: false, mode_presence: 'exclu' },
];

function rapport(overrides = {}) {
  return M.construireRapport(Object.assign({
    periode: '2026-08-01', employees, settings, planning: [], pointages: [],
    indisponibilites: [], audits: [], items: [], ecarts: [],
    config: { retard_max_coherent_min: 180, jours_feries: [] },
  }, overrides));
}

assert.deepStrictEqual(M.extraireEmployeeIds(['e1', { employee_id: 'e2' }, { id: 'e1' }]), ['e1', 'e2']);
assert.strictEqual(M.finMoisISO('2026-02-01'), '2026-03-01');

// Planning seul = absence à vérifier, jamais absence automatique.
let r = rapport({ planning: [{ employee_id: 'e1', date: '2026-08-03', quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' }] });
assert.strictEqual(r.employes[0].heuresConfirmees, 0);
assert.strictEqual(r.items[0].typeItem, 'absence_a_verifier');

// Pointage + planning = présence confirmée.
r = rapport({
  planning: [{ employee_id: 'e1', date: '2026-08-03', quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' }],
  pointages: [{ employee_id: 'e1', date: '2026-08-03', type: 'arrivee', retard_min: 0 }],
});
assert.strictEqual(r.employes[0].heuresConfirmees, 7);
assert.strictEqual(r.items.length, 0);

// Vendredi piste = 8 h de durée de référence, et aucune heure qualifiée
// supplémentaire. Le moteur rend des heures de travail ; leur qualification en
// heures normales, complémentaires ou supplémentaires relève d'un calcul
// distinct, fondé sur les règles légales et contractuelles (09/10/2026).
// Elle était jusque-là proposée deux fois : dans le barème et dans un item.
r = rapport({
  planning: [{ employee_id: 'e1', date: '2026-08-07', quart: 'quart1', statut: 'travail_normal', duree_heures: 8, tache: 'piste' }],
  pointages: [{ employee_id: 'e1', date: '2026-08-07', type: 'arrivee', retard_min: 0 }],
});
assert.strictEqual(r.employes[0].heuresConfirmees, 8);
assert.ok(!r.items.some(i => i.typeItem === 'heure_supplementaire'));
r = rapport({
  planning: [{ employee_id: 'e1', date: '2026-08-07', quart: 'renfort', statut: 'renfort', duree_heures: 7 }],
  pointages: [{ employee_id: 'e1', date: '2026-08-07', type: 'arrivee', retard_min: 0 }],
});
assert.ok(!r.items.some(i => i.typeItem === 'heure_supplementaire'));

// Aucun retard ne se déduit d'un pointage. Par défaut le retard est de zéro
// minute, et seul le manager peut en enregistrer un retenu pour la paie
// (09/10/2026). Un retard_min aberrant en base ne produit donc plus ni item,
// ni verrou : la journée reste constatée, ses heures restent calculées.
r = rapport({ pointages: [{ employee_id: 'e1', date: '2026-08-10', type: 'arrivee', retard_min: 5754 }] });
assert.ok(!r.items.some(i => i.typeItem === 'retard_incoherent' || i.typeItem === 'retard'));
assert.strictEqual(r.employes[0].heuresConfirmees, 7);
assert.strictEqual(r.bloqueurs.length, 0);

// Écart : montant de référence uniquement, zéro impact paie par défaut.
r = rapport({ ecarts: [{ id: 'verify-a-piste', employeeId: 'e1', date: '2026-08-12', activite: 'piste', sourceModule: 'verify', montantRetenu: -36.65, statut: 'cloture_non_explique' }] });
const ecart = r.items.find(i => i.typeItem === 'ecart_caisse');
assert.strictEqual(ecart.montantReferenceCentimes, 3665);
assert.strictEqual(ecart.montantCentimes, null);
assert.strictEqual(ecart.impactPaye, false);

// Une contestation ouverte maintient un verrou même si un arbitrage existe.
r = rapport({
  ecarts: [{ id: 'verify-a-piste', employeeId: 'e1', date: '2026-08-12', activite: 'piste', sourceModule: 'verify', montantRetenu: -36.65, contestation: { statut_contestation: 'ouverte' } }],
  items: [{ id: 'i1', employee_id: 'e1', periode: '2026-08-01', origine: 'verify', source_cle: 'ecart:verify-a-piste', statut: 'valide', impact_paye: true, montant_centimes: 3665 }],
});
assert.ok(r.items[0].contestationOuverte && r.items[0].bloquantTechnique);
assert.ok(r.bloqueurs.some(b => b.type === 'ecart_caisse'));

// Tout rattachement non confirmé bloque, y compris une exclusion proposée.
r = M.construireRapport({ periode: '2026-08-01', employees: [{ id: 'm1', nom: 'Manager', role: 'manager', actif: true }], settings: [], planning: [], pointages: [], audits: [], indisponibilites: [], items: [], ecarts: [] });
assert.ok(r.bloqueurs.some(b => b.type === 'configuration_employe'));

// Un suivi manuel exige une saisie mensuelle chiffrée.
r = M.construireRapport({ periode: '2026-08-01', employees: [{ id: 'm1', nom: 'Manager', role: 'manager', actif: true }], settings: [{ employee_id: 'm1', inclus_paye: true, mode_presence: 'manuel' }], planning: [], pointages: [], audits: [], indisponibilites: [], items: [], ecarts: [] });
assert.ok(r.bloqueurs.some(b => b.type === 'heures_manuelles'));

console.log('NEXUS PAYE moteur : scénarios validés.');
