// NEXUS PAYE — un hors-paie non confirmé doit pouvoir être configuré (03/10/2026).
//
// Le moteur bloque le dossier tant qu'un rattachement n'est pas confirmé,
// y compris pour un vacataire classé « hors paie » d'office d'après son rôle.
// L'écran, lui, ne proposait « Configurer le rattachement » qu'aux salariés
// inclus : Terry (vacataire, Production, octobre 2026) bloquait le dossier
// sans qu'aucun bouton permette de lever le blocage.
//
// Ce test rend réellement l'écran et refuse qu'une fiche hors paie perde
// son bouton de configuration.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
assert.ok(script, 'script inline de l’écran PAYE introuvable');

const rendu = {};
function element(id) {
  return {
    id, hidden: true, textContent: '', value: '', checked: false, disabled: false,
    dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} },
    set innerHTML(v) { rendu[id] = v; this._h = v; },
    get innerHTML() { return this._h || ''; },
    querySelector: () => element('sous'), querySelectorAll: () => [],
    appendChild() {}, focus() {}, scrollIntoView() {},
    addEventListener() {}, removeEventListener() {},
  };
}
const ctx = {
  console,
  document: {
    getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
    createElement: () => element('cree'), body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  },
  navigator: {}, nexusClient: {},
  nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(script[1], ctx);

ctx.__donnees = {
  periode: '2026-10-01',
  employees: [
    { id: 'p1', nom: 'Camille', role: 'pompiste', actif: true },
    { id: 'v1', nom: 'Terry', role: 'vacataire', actif: true },
    { id: 'v2', nom: 'Alex', role: 'vacataire', actif: true },
  ],
  settings: [
    { employee_id: 'p1', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'v2', inclus_paye: false, mode_presence: 'exclu' },
    // v1 (Terry) : aucun réglage — hors paie d'office, non confirmé.
  ],
  planning: [], pointages: [], indisponibilites: [],
  audits: [], items: [], ecarts: [], config: { jours_feries: [] },
};
vm.runInContext(`
  MOIS = '2026-10-01';
  SITE = 'vito-sainte-marie';
  EMPLOYEE = { id: 'manager-1', role: 'manager' };
  RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
  RAPPORT.periodeEnregistree = null;
  RAPPORT.planningOfficiel = { source: 'nexus', url: null };
  render();
`, ctx);

const ecran = rendu.app;
assert.ok(ecran && ecran.length > 1000, 'l’écran ne s’est pas rendu');
function fiche(id) {
  const m = ecran.match(new RegExp(`<article class="employee" data-employee="${id}">[\\s\\S]*?</article>`));
  assert.ok(m, 'fiche introuvable : ' + id);
  return m[0];
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const terry = fiche('v1'), alex = fiche('v2');
const bloqueursTerry = vm.runInContext('RAPPORT.bloqueurs', ctx).filter(b => /Terry/.test(b.libelle || b));

verifier('le moteur bloque bien sur le rattachement non confirmé de Terry', bloqueursTerry.length === 1);
verifier('la fiche de Terry offre « Configurer le rattachement »',
  terry.includes('class="btn configure" data-id="v1"'));
verifier('… et dit pourquoi il faut confirmer', terry.includes('jamais confirmé'));
verifier('un hors-paie confirmé (Alex) garde le bouton pour être réinclus',
  alex.includes('class="btn configure" data-id="v2"'));
verifier('… sans alerte de confirmation', !alex.includes('jamais confirmé'));
verifier('le rendu ne contient ni « undefined » ni « NaN »',
  !ecran.includes('undefined') && !ecran.includes('NaN'));

console.log(`\nNEXUS PAYE — configurer un hors-paie : ${ok}/${ok} vérifications passent.`);
