// NEXUS PAYE — les heures supplémentaires sont visibles dans le cockpit (12/10/2026).
//
// Décision Q1 du 10/10/2026 : jeudi→samedi = 7 h + 1 h supplémentaire (8ᵉ heure, comprise dans la
// présence) ; dimanche→mercredi = 7 h ; renfort Q1 = 7 h sans supplémentaire. Cette épreuve exécute
// le VRAI écran contre le VRAI moteur et lit ce que le manager voit : l'indicateur « N h · dont M h sup. »,
// le tableau Date / Poste / Présence / Normales / Supplémentaires, et l'absence de double comptage.
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

// Septembre 2026 : lundi 7, jeudi 10, vendredi 11, samedi 12.
const SITE = 'vito-sainte-marie';
const emp = (id, nom, role) => ({ id, nom, role, actif: true, site_id: SITE });
const reglage = id => ({ employee_id: id, site_id: SITE, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' });
const shift = (employee_id, date, tache) => ({ employee_id, date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache });
const audit = (id, date, champs) => Object.assign({ id, date, quart: '1', statut: 'cloture', employes_piste: [], employes_boutique: [], employes_renfort: [] }, champs);
ctx.__d = {
  periode: '2026-09-01',
  employees: [emp('c', 'Camille', 'caissier'), emp('p', 'Bruno', 'pompiste'), emp('r', 'Angélique', 'renfort')],
  settings: ['c', 'p', 'r'].map(reglage),
  planning: [shift('c', '2026-09-07', 'boutique'), shift('c', '2026-09-10', 'boutique'), shift('c', '2026-09-11', 'boutique'),
    shift('p', '2026-09-12', 'piste')],
  pointages: [], indisponibilites: [], ecarts: [], items: [], config: { jours_feries: [] },
  horaires: { renfort: { debut: '09:00', fin: '17:30', pause_debut: '12:00', pause_fin: '12:30' } },
  // Jeudi 10 : Angélique est en renfort ET en caisse sur la même plage → une seule présence.
  audits: [
    audit('a1', '2026-09-07', { employes_boutique: ['c'] }),
    audit('a2', '2026-09-10', { employes_boutique: ['c', 'r'], employes_renfort: ['r'] }),
    audit('a3', '2026-09-11', { employes_boutique: ['c'] }),
    audit('a4', '2026-09-12', { employes_piste: ['p'] }),
  ],
};
vm.runInContext(`MOIS='2026-09-01'; SITE='${SITE}'; EMPLOYEE={id:'m',role:'manager'};
  RAPPORT=NexusPayeMoteur.construireRapport(__d); RAPPORT.periodeEnregistree=null;
  RAPPORT.planningOfficiel={source:'nexus',url:null}; render();`, ctx);
const ecran = rendu.app || '';

let n = 0;
function verifier(l, c) { console.log(`${c ? 'OK  ' : 'ÉCHEC'} — ${l}`); assert.ok(c, l); n++; }
const lignesDe = id => vm.runInContext(`NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='${id}'))`, ctx);
const vc = lignesDe('c'), vp = lignesDe('p'), vr = lignesDe('r');

verifier('l’écran se rend', ecran.length > 2000);
// Camille : lundi 7 + jeudi 7+1 + vendredi 7+1 = 23 h, dont 2 h sup.
verifier('Camille : 23 h de présence', vc.presence.heures === 23);
verifier('Camille : 2 h supplémentaires (jeudi et vendredi)', vc.heuresSupplementaires.heures === 2);
verifier('Camille : 21 h normales', vc.presence.heuresNormales === 21);
verifier('Camille : normales + supplémentaires = présence (jamais ajoutées)',
  vc.presence.heuresNormales + vc.heuresSupplementaires.heures === vc.presence.heures);
verifier('l’indicateur « 23 h · dont 2 h sup. » est affiché', ecran.includes('23 h · dont 2 h sup.'));
verifier('Bruno (pompiste, samedi) : 8 h dont 1 h sup.', vp.presence.heures === 8 && vp.heuresSupplementaires.heures === 1);
verifier('l’indicateur « 8 h · dont 1 h sup. » est affiché', ecran.includes('8 h · dont 1 h sup.'));

// Renfort + caisse le même jour : une seule présence, pas 14 h.
verifier('Angélique (renfort + caisse jeudi) : une seule présence, pas de cumul', vr.presence.heures <= 8);
verifier('Angélique : aucune heure supplémentaire cumulée sur un renfort', vr.heuresSupplementaires.heures <= 1);

// Détail par date, immédiatement visible.
verifier('le tableau de détail est rendu', ecran.includes('class="heures-detail"'));
['Date', 'Poste', 'Présence', 'Normales', 'Supplémentaires'].forEach(c => verifier(`colonne « ${c} »`, ecran.includes(`<th>${c}</th>`)));
verifier('le détail de Camille compte 3 jours', vc.presence.detailJours.length === 3);
verifier('le jeudi de Camille : 8 h = 7 h normales + 1 h sup.',
  vc.presence.detailJours.some(j => j.date === '2026-09-10' && j.presence === 8 && j.normales === 7 && j.supplementaires === 1));
verifier('le lundi de Camille : 7 h, aucune supplémentaire',
  vc.presence.detailJours.some(j => j.date === '2026-09-07' && j.presence === 7 && j.normales === 7 && j.supplementaires === 0));
verifier('aucun montant ni taux de majoration n’est inventé', !/majoration\s*:?\s*\d|\+\s*25\s*%|\+\s*50\s*%/.test(ecran));
console.log(`\n${n} vérifications.`);

// ── Export comptable : colonnes nominatives distinctes ───────────────────
const lignes = vm.runInContext('NexusPayeMoteur.lignesExport(RAPPORT)', ctx);
const deCamille = t => lignes.filter(l => l.employe === 'Camille' && l.type === t);
verifier('export : Camille — 1 ligne de présence de 23 h', deCamille('presence_confirmee').length === 1 && deCamille('presence_confirmee')[0].quantite_minutes === 1380);
verifier('export : Camille — heures normales distinctes (21 h)', deCamille('heures_normales')[0].quantite_minutes === 1260);
verifier('export : Camille — heures supplémentaires distinctes (2 h)', deCamille('heures_supplementaires_bareme')[0].quantite_minutes === 120);
verifier('export : normales + supplémentaires = présence (jamais ajoutées)', deCamille('heures_normales')[0].quantite_minutes + deCamille('heures_supplementaires_bareme')[0].quantite_minutes === deCamille('presence_confirmee')[0].quantite_minutes);
verifier('export : une ligne de détail par date (3), triées', deCamille('detail_jour').map(l => l.date).join() === '2026-09-07,2026-09-10,2026-09-11');
verifier('export : le détail du jeudi nomme 7 h normales et 1 h sup.', /7 h normales · 1 h sup\./.test(deCamille('detail_jour')[1].commentaire));
verifier('export : aucun montant sur les lignes d’heures', lignes.filter(l => /^heures_|detail_jour/.test(l.type)).every(l => l.montant_euros === ''));
console.log(`\n${n} vérifications au total.`);
