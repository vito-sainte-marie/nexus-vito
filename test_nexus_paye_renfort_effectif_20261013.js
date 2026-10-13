'use strict';
// NEXUS PAYE : le renfort n'est effectif qu'à partir du 01/10/2026 (décision du
// 13/10/2026). Avant, la colonne D du classeur est POMPISTE : un renfort daté
// d'avant octobre n'ouvre aucune journée. Seul le renfort est visé ; la piste
// et la boutique restent calculées à toute date. Surchargeable par site.
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
const S = 'vito-sainte-marie';
const reg = id => ({ employee_id: id, site_id: S, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' });
const emp = (id, role) => ({ id, nom: id, role, actif: true, site_id: S });
const audit = (date, c) => Object.assign({ id: 'a' + date, date, quart: '1', statut: 'cloture', employes_piste: [], employes_boutique: [], employes_renfort: [] }, c);
const rapport = (periode, role, a, config) => M.construireRapport({ periode, employees: [emp('x', role)], settings: [reg('x')], planning: [], pointages: [],
  indisponibilites: [], audits: [a], items: [], ecarts: [], config: Object.assign({ jours_feries: [] }, config || {}),
  horaires: { renfort: { debut: '09:00', fin: '17:00', pause_debut: '12:00', pause_fin: '13:00' } } }).employes[0];

verifier('renfort du 30/09/2026 : ignoré', rapport('2026-09-01', 'renfort', audit('2026-09-30', { employes_renfort: ['x'] })).heuresConfirmees === 0);
verifier('renfort du 01/10/2026 : 7 h (effectif dès le premier jour)', rapport('2026-10-01', 'renfort', audit('2026-10-01', { employes_renfort: ['x'] })).heuresConfirmees === 7);
verifier('renfort d’août 2026 : ignoré', rapport('2026-08-01', 'renfort', audit('2026-08-12', { employes_renfort: ['x'] })).heuresConfirmees === 0);
verifier('pompiste du 30/09/2026 : toujours calculé (la garde ne vise que le renfort)', rapport('2026-09-01', 'pompiste', audit('2026-09-30', { employes_piste: ['x'] })).heuresConfirmees > 0);
verifier('caissier du 30/09/2026 : toujours calculé', rapport('2026-09-01', 'caissier', audit('2026-09-30', { employes_boutique: ['x'] })).heuresConfirmees > 0);
verifier('réglage par site : renfort_effectif_depuis surchargé à 2026-09-01', rapport('2026-09-01', 'renfort', audit('2026-09-30', { employes_renfort: ['x'] }), { renfort_effectif_depuis: '2026-09-01' }).heuresConfirmees === 7);
verifier('réglage par site : valeur vide = pas de date d’effet', rapport('2026-09-01', 'renfort', audit('2026-09-30', { employes_renfort: ['x'] }), { renfort_effectif_depuis: '' }).heuresConfirmees === 7);
console.log(`\n${ok} vérifications`);
