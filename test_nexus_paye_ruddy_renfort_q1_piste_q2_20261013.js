// NEXUS PAYE — Ruddy, renfort au quart 1 ET pompiste au quart 2 le vendredi 02/10/2026 (classeur réel).
// Décision de Frédéric (13/10/2026) : Ruddy est calculé en piste, pas en renfort, sans additionner :
// 8 h dont 1 h supplémentaire (vendredi), jamais 7 h de renfort + 8 h de piste.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
assert.ok(script, 'script inline de l’écran PAYE introuvable');

const rendu = {};
function element(id) {
  return { id, hidden: true, textContent: '', value: '', checked: false, disabled: false, dataset: {}, style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    set innerHTML(v) { rendu[id] = v; this._h = v; }, get innerHTML() { return this._h || ''; },
    querySelector: () => element('sous'), querySelectorAll: () => [], appendChild() {}, focus() {}, scrollIntoView() {},
    addEventListener() {}, removeEventListener() {} };
}
const ctx = { console, document: { getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
    createElement: () => element('cree'), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
  navigator: {}, nexusClient: {}, nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }) };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-moteur.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-donnees.js'), 'utf8'), ctx);
if (!ctx.URLSearchParams) ctx.URLSearchParams = URLSearchParams;
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(script[1], ctx);

const SITE = 'vito-sainte-marie';
const emp = (id, nom, role) => ({ id, nom, role, actif: true, site_id: SITE });
const reglage = id => ({ employee_id: id, site_id: SITE, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' });
const audit = (id, date, quart, champs) => Object.assign({ id, date, quart, statut: 'cloture', employes_piste: [], employes_boutique: [], employes_renfort: [] }, champs);
ctx.__d = {
  periode: '2026-10-01',
  employees: [emp('u', 'Ruddy', 'pompiste')],
  settings: [reglage('u')],
  planning: [], pointages: [], indisponibilites: [], ecarts: [], items: [], config: { jours_feries: [] },
  horaires: { renfort: { debut: '09:00', fin: '17:30', pause_debut: '12:00', pause_fin: '12:30' } },
  audits: [
    audit('q1', '2026-10-02', '1', { employes_renfort: ['u'] }),
    audit('q2', '2026-10-02', '2', { employes_piste: ['u'] }),
  ],
};
vm.runInContext(`MOIS='2026-10-01'; SITE='${SITE}'; EMPLOYEE={id:'m',role:'manager'};
  RAPPORT=NexusPayeMoteur.construireRapport(__d); RAPPORT.periodeEnregistree=null;
  RAPPORT.planningOfficiel={source:'nexus',url:null}; render();`, ctx);
let n = 0;
function verifier(l, c) { console.log(`${c ? 'OK  ' : 'ÉCHEC'} — ${l}`); assert.ok(c, l); n++; }
const v = vm.runInContext(`NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='u'))`, ctx);
const j = v.presence.detailJours.filter(d => d.date === '2026-10-02');
verifier('une seule journée retenue pour le 02/10', j.length === 1);
verifier('le poste est la piste, pas le renfort', j[0].poste === 'pompiste');
verifier('Ruddy : 8 h au total, pas 15 h ni 7 h', v.presence.heures === 8);
verifier('7 h normales + 1 h supplémentaire', v.presence.heuresNormales === 7 && v.heuresSupplementaires.heuresBareme === 1);
verifier('aucune heure de renfort additionnée', v.presence.heuresAutres === 0 || v.presence.heuresAutres === undefined);
console.log(`\n${n} vérifications passées.`);
