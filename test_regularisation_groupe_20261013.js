// Épreuve du front « versement de régularisation groupé » (13/10/2026).
const assert = require('assert');
global.window = undefined;
require('./nexus-regularisation-saisie.js');
require('./nexus-regularisation-groupe.js');
const G = globalThis.NexusRegularisationGroupe;
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('OK ' + m); };

const ecarts = [
  { module_origine: 'fdj', fdj_cash_control_id: 'f1', audit_id: null, caisse_origine: null, date_ecart: '2026-10-01', quart_ecart: '1', ecart_initial: -4, corrections: 0, versements_affectes: 0, solde: 4 },
  { module_origine: 'fdj', fdj_cash_control_id: 'f2', audit_id: null, caisse_origine: null, date_ecart: '2026-10-02', quart_ecart: '1', ecart_initial: -4, corrections: 0, versements_affectes: 0, solde: 4 },
];
const base = { montant: '10', mode: 'especes', emplacement: 'tiroir_fdj', date: '2026-10-13', quart: '1', saisies: {} };
const ctx = { aujourdhui: '2026-10-13' };

let c = G.controlerGroupe(base, ecarts, ctx);
ok(c.affectations.length === 0 && c.problemes.length > 0, 'rien n\'est coché par défaut : refus, jamais d\'affectation automatique');

const s2 = { ...base, saisies: { f1: { coche: true, montant: '4' }, f2: { coche: true, montant: '4' } } };
c = G.controlerGroupe(s2, ecarts, ctx);
ok(c.affecte === 8 && c.surplus === 2, 'Angélique : 8 € affectés, 2 € de surplus');
ok(c.problemes.some(p => /confirmez/.test(p)), 'surplus non confirmé : refus local');
c = G.controlerGroupe({ ...s2, surplusConfirme: true }, ecarts, ctx);
ok(c.problemes.length === 0, 'surplus confirmé : aucun problème');
const p = G.parametresGroupe('e1', 'fdj', { ...s2, surplusConfirme: true }, c, 'cle');
ok(p.p_affectations.length === 2 && p.p_affectations[0].fdj_cash_control_id === 'f1' && p.p_surplus_confirme === true, 'paramètres du RPC');

c = G.controlerGroupe({ ...base, montant: '5', saisies: s2.saisies }, ecarts, ctx);
ok(c.problemes.some(p => /dépasse/.test(p)), 'affecté supérieur au versement refusé');
c = G.controlerGroupe({ ...base, saisies: { f1: { coche: true, montant: '5' } } }, ecarts, ctx);
ok(c.problemes.some(p => /ne doit plus/.test(p)), 'affecté supérieur au solde refusé');
c = G.controlerGroupe({ ...base, date: '2026-10-14', saisies: s2.saisies, surplusConfirme: true }, ecarts, ctx);
ok(c.problemes.some(p => /futur/.test(p)), 'quart futur refusé');
c = G.controlerGroupe({ ...base, mode: 'autre', saisies: s2.saisies, surplusConfirme: true }, ecarts, ctx);
ok(c.problemes.some(p => /justification/.test(p)), 'mode autre sans justification refusé');
ok(G.lireErreur({ message: 'x [SURPLUS_NON_CONFIRME]' }).conseil, 'conseil pour un code du groupe');
ok(/<form/.test(G.renderFormulaire({ employes: [], aujourdhui: '2026-10-13', cle: 'c' })), 'formulaire rendu');
console.log(`${n} épreuves vertes`);

// Synthèse Paye par domaine : deux univers disjoints, surplus absent.
require('./nexus-paye-regularisations.js');
const P = globalThis.NexusPayeRegularisations;
const ec = [
  { id: 'fdj-f1', date: '2026-10-01', quart: '1', activite: 'fdj', ecartInitial: -4, ecartFinal: -4, statut: 'valide', employeeId: 'e1', employeeNom: 'A' },
  { id: 'verify-a1-piste', date: '2026-10-02', quart: '1', activite: 'piste', ecartInitial: -6, ecartFinal: -6, statut: 'valide', employeeId: 'e1', employeeNom: 'A' },
];
const d = P.syntheseParDomaine(ec, { versements: [], restitutions: [] }, { fuseau: 'Europe/Paris', dateDebut: '2026-10-01', dateFin: '2026-10-31', aujourdhui: '2026-10-13' });
assert.strictEqual(d.fdj.constates.manquesCentimes, -400); assert.strictEqual(d.verify.constates.manquesCentimes, -600);
console.log('OK synthèse Paye séparée Verify / FDJ');
