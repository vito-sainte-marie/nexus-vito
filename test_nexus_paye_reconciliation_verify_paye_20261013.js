'use strict';
// NEXUS PAYE : les règles de réconciliation Verify / Paye du 10/10/2026 que
// les épreuves du 09/10 ne jouaient pas : renfort Q2 compté comme Q1, sources
// contradictoires nommées, journée de plus de 12 h signalée sans plafond.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { console: { log() {}, warn() {}, error() {} } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
const M = ctx.NexusPayeMoteur;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const S = 'vito-sainte-marie', P = '2026-10-01', JEUDI = '2026-10-01', VENDREDI = '2026-10-02';
const reg = id => ({ employee_id: id, site_id: S, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' });
const emp = (id, role) => ({ id, nom: id, role, actif: true, site_id: S });
const audit = (id, date, c) => Object.assign({ id, date, quart: '1', statut: 'cloture', employes_piste: [], employes_boutique: [], employes_renfort: [] }, c);
const rapport = e => M.construireRapport(Object.assign({ periode: P, employees: [], settings: [], planning: [], pointages: [],
  indisponibilites: [], audits: [], items: [], ecarts: [], config: { jours_feries: [] },
  horaires: { renfort: { debut: '09:00', fin: '17:00', pause_debut: '12:00', pause_fin: '13:00' } } }, e));
const natures = f => f.items.map(i => i.nature);

{ // renfort Q1 / Q2
  const q1 = rapport({ employees: [emp('x', 'renfort')], settings: [reg('x')], audits: [audit('a', VENDREDI, { employes_renfort: ['x'] })] }).employes[0];
  const q2 = rapport({ employees: [emp('x', 'renfort')], settings: [reg('x')], audits: [audit('a', VENDREDI, { quart: '2', employes_renfort: ['x'] })] }).employes[0];
  verifier('renfort au quart 1 : 7 h', q1.heuresConfirmees === 7);
  verifier('renfort déclaré au quart 2 seul (décision du 13/10) : 7 h, une journée', q2.heuresConfirmees === 7 && q2.joursConfirmes.size === 1);
  const mixte = rapport({ employees: [emp('x', 'renfort')], settings: [reg('x')], audits: [
    audit('a', VENDREDI, { employes_renfort: ['x'] }), audit('b', VENDREDI, { quart: '2', employes_renfort: ['x'] })] }).employes[0];
  verifier('renfort aux deux quarts : une seule journée de 7 h, jamais 14 h', mixte.heuresConfirmees === 7);
  const piste2 = rapport({ employees: [emp('x', 'pompiste')], settings: [reg('x')], audits: [
    audit('a', JEUDI, { employes_renfort: ['x'] }), audit('b', JEUDI, { quart: '2', employes_piste: ['x'] })] }).employes[0];
  verifier('renfort Q1 + pompiste Q2 le jeudi : calculé en piste, 8 h', piste2.heuresConfirmees === 8 && piste2.heuresRenfort === 0);
}
{ // sources contradictoires
  const f = rapport({ employees: [emp('x', 'caissier')], settings: [reg('x')], audits: [audit('a', JEUDI, { employes_boutique: ['x'], employes_piste: ['x'] })] });
  const e = f.employes[0];
  verifier('caisse ET piste le même jour : une seule journée, calculée en piste, 8 h le jeudi', e.heuresConfirmees === 8 && e.heuresPiste === 8 && e.heuresCaisse === 0);
  const it = e.items.find(i => i.nature === 'sources_contradictoires');
  verifier('et la contradiction est nommée au manager', !!it && /à arbitrer/.test(it.detail));
  verifier('sans retenir ni bloquer aucune heure', it.impactPaye === false && f.bloqueurs.length === 0);
  const seul = rapport({ employees: [emp('x', 'caissier')], settings: [reg('x')], audits: [audit('a', JEUDI, { employes_boutique: ['x'] })] }).employes[0];
  verifier('un poste unique ne produit aucune contradiction', !natures(seul).includes('sources_contradictoires'));
}
{ // plus de 12 h
  const exc = h => ({ employee_id: 'x', periode: P, date_evenement: VENDREDI, origine: 'manuel', type_item: 'horaire_exceptionnel', statut: 'valide',
    source_cle: 'h:x', libelle: 'h', quantite_minutes: h * 60, impact_paye: false, detail: { debut: '06:00', fin: `${6 + h + 1}:00`, pause_minutes: 60, motif: 'inventaire', auteur: 'm' } });
  const long = rapport({ employees: [emp('x', 'renfort')], settings: [reg('x')], audits: [audit('a', VENDREDI, { employes_renfort: ['x'] })], items: [exc(13)] }).employes[0];
  verifier('13 h saisies : toutes retenues, aucun plafonnement', long.heuresConfirmees === 13);
  verifier('et la durée de plus de 12 h est signalée', natures(long).includes('duree_superieure_12h'));
  const douze = rapport({ employees: [emp('x', 'renfort')], settings: [reg('x')], audits: [audit('a', VENDREDI, { employes_renfort: ['x'] })], items: [exc(12)] }).employes[0];
  verifier('exactement 12 h : pas de signalement', douze.heuresConfirmees === 12 && !natures(douze).includes('duree_superieure_12h'));
}
console.log(`\n${ok} vérifications passées.`);
