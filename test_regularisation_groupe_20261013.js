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
// Bouton du coffre : plafonné au versement reçu, motif obligatoire.
const gr = { id: 'g1', employee_id: 'e1', domaine: 'fdj', montant: 10, destination: 'tiroir_fdj', affecte: 8, surplus: 2, nb_affectations: 2, annule_le: null };
const tr = { id: 't1', groupe_id: gr.id, montant: 6, motif: 'Mise en sécurité', annule_le: null };
ok(/rg-annuler-transfert/.test(G.renderGroupes([{ ...gr, transferts: [tr] }], () => 'A')), 'un transfert actif porte son bouton « Annuler le transfert »');
ok(!/rg-annuler-transfert/.test(G.renderGroupes([{ ...gr, transferts: [{ ...tr, annule_le: '2026-10-13', motif_annulation: 'erreur' }] }], () => 'A')), 'un transfert annulé n\'a plus de bouton');
ok(/rg-coffre/.test(G.renderGroupes([gr], () => 'A')), 'bouton « Transférer au coffre » présent sur un tiroir');
ok(!/rg-coffre/.test(G.renderGroupes([{ ...gr, destination: 'coffre' }], () => 'A')), 'absent si le versement est déjà au coffre');
ok(!/rg-coffre/.test(G.renderGroupes([{ ...gr, annule_le: '2026-10-13' }], () => 'A')), 'absent si le versement est annulé');
ok(G.controlerTransfertGroupe({ montant: '10,01', motif: 'remise coffre' }, gr).problemes.some(p => /dépasse/.test(p)), 'transfert supérieur au versement refusé');
ok(G.controlerTransfertGroupe({ montant: '10', motif: 'abc' }, gr).problemes.some(p => /motif/.test(p)), 'motif trop court refusé');
ok(G.controlerTransfertGroupe({ montant: '10', motif: 'remise coffre' }, gr).problemes.length === 0, 'transfert valide');
// --- Affectation du surplus d'un versement déjà enregistré ---
{
  const g = { id: 'g1', employee_id: 'e1', domaine: 'fdj', montant: 10, surplus: 2 };
  let r = G.controlerSurplus(g, ecarts, {});
  ok(r.affectations.length === 0 && r.problemes.length > 0, 'surplus : rien coché par défaut, refus');
  r = G.controlerSurplus(g, ecarts, { f1: { coche: true, montant: '2' } });
  ok(r.problemes.length === 0 && r.affecte === 2 && r.reste === 0, 'surplus : 2 € affectés, reste 0');
  r = G.controlerSurplus(g, ecarts, { f1: { coche: true, montant: '2' }, f2: { coche: true, montant: '1' } });
  ok(r.problemes.some(p => /dépasse le surplus/.test(p)), 'surplus : total supérieur au surplus refusé');
  r = G.controlerSurplus(g, ecarts, { f1: { coche: true, montant: '' } });
  ok(r.problemes.some(p => /invalide/.test(p)), 'surplus : montant vide refusé, jamais le solde par défaut');
  r = G.controlerSurplus(g, ecarts, { f1: { coche: true, montant: '1' } });
  const prm = G.parametresSurplus(g, r, 'cle-1');
  ok(prm.p_groupe_id === 'g1' && prm.p_idempotency_key === 'cle-1' && prm.p_affectations[0].fdj_cash_control_id === 'f1' && r.reste === 1, 'surplus : paramètres du RPC, reste suivi à part');
  ok(/Affecter le surplus/.test(G.renderSurplus(g)) && /2,00 €/.test(G.renderSurplus(g)), 'surplus : formulaire rendu');
}
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

// Statuts, justification et compteurs séparés (Paye, lecture seule).
{
  const R = globalThis.NexusPayeRegularisations;
  const st = (i, s) => R.statutQualification(i, s).statut;
  ok(st({ statut: 'a_verifier' }, null) === 'À examiner', 'statut À examiner');
  ok(st({ statut: 'justifie' }, null) === 'Justifié' && R.statutQualification({ statut: 'justifie' }, null).nonRegularise, 'Justifié ≠ régularisé');
  ok(st({ statut: 'a_verifier' }, { versementsCentimes: 400, resteDuCentimes: 400 }) === 'Partiellement régularisé', 'partiel');
  ok(st({ statut: 'a_verifier' }, { versementsCentimes: 800, resteDuCentimes: 0 }) === 'Régularisé', 'régularisé');
  ok(st({ statut: 'valide' }, null) === 'Transmis à la comptabilité', 'transmis');
  ok(R.statutQualification({ statut: 'valide' }, { versementsCentimes: 400, resteDuCentimes: 400 }).nonRegularise, 'transmis non régularisé marqué');
  ok(st({ statut: 'corrige' }, null) === 'Annulé / corrigé', 'annulé / corrigé');
  ok(!R.justificationRequise('sans_impact', '  ') && !R.justificationRequise('transmettre', 'abc') && R.justificationRequise('transmettre', 'accord gérant'), 'justification obligatoire');
  const items = [{ typeItem: 'ecart_caisse', statut: 'a_verifier' }, { typeItem: 'ecart_caisse', statut: 'valide' }, { typeItem: 'retard', statut: 'a_verifier' }, { typeItem: 'retard', contestationOuverte: true, statut: 'valide' }];
  const c = R.compteursQualification(items, 2);
  ok(c.decisionsPaie === 4 && c.ecartsAQualifier === 1, 'deux compteurs séparés');
  {
    const univers = [{ id: 'fdj-f1', date: '2026-10-01', quart: '1', sourceModule: 'fdj', employeeId: 'e1', ecartInitial: -4, ecartFinal: -4 }];
    const op = { versements: [{ id: 'v1', module_origine: 'fdj', fdj_cash_control_id: 'f1', montant: 1, encaisse_le: '2026-10-13T10:00:00Z', mode_encaissement: 'especes', destination: 'tiroir_fdj' }], restitutions: [] };
    const sit = R.situationsParEcart(univers, op, { fuseau: 'Europe/Paris' });
    ok(sit['ecart:fdj-f1'].versementsCentimes === 100 && sit['ecart:fdj-f1'].resteDuCentimes === 300, 'situation réelle : 1 € versé, 3 € restent dus');
    ok(R.statutQualification({ statut: 'a_verifier' }, sit['ecart:fdj-f1']).statut === 'Partiellement régularisé', 'la situation réelle pilote le statut');
    ok(sit['ecart:autre'] === undefined, 'écart inconnu : pas de situation inventée');
  }
  console.log(`${n} épreuves vertes`);
}
