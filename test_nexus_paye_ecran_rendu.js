// NEXUS PAYE — l'écran se rend vraiment (03/09/2026).
//
// Les tests existants vérifiaient que certaines CHAÎNES figurent dans le
// fichier HTML. C'est utile mais insuffisant : un gabarit de 900 lignes
// peut contenir tous les bons mots et lever une exception à l'exécution
// (variable renommée, fonction déplacée après son appel, champ absent du
// moteur). Le manager voit alors un écran vide, sans le moindre message.
//
// Ce test exécute réellement le script de l'écran sur un DOM minimal,
// avec le mois de référence de la recette — AOÛT 2026 — et vérifie que
// le rendu contient ce que Frédéric a demandé de voir : l'événement RH
// en trois lignes, les variables comptables agrégées, les trois statuts
// de salarié et les libellés P2.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
assert.ok(script, 'script inline de l’écran PAYE introuvable');

// DOM minimal : on ne simule pas un navigateur, seulement ce que l'écran
// touche réellement. Toute écriture dans innerHTML est capturée.
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

// ── Recette : août 2026 ──────────────────────────────────────────────────
const EMPLOYES = [
  { id: 'e1', nom: 'Camille', role: 'pompiste', actif: true },
  { id: 'e2', nom: 'Vanessa Ribe', role: 'caissier', actif: true },
  { id: 'e3', nom: 'Angélique', role: 'renfort', actif: true },
];
const JOURS = ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'];

// `MOIS`, `SITE`, `EMPLOYEE` et `RAPPORT` sont déclarés en `let` par le
// script de l'écran : ce sont des liaisons lexicales du contexte, pas des
// propriétés du bac à sable. On les alimente donc DEPUIS le contexte, en y
// exécutant un second script — sinon on écrirait à côté.
ctx.__donnees = {
  periode: '2026-08-01', employees: EMPLOYES,
  settings: [
    { employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'e2', inclus_paye: true, mode_presence: 'automatique' },
    // e3 (Angélique) : rattachement jamais confirmé.
  ],
  planning: JOURS.map(date => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
  pointages: JOURS.map(date => ({ employee_id: 'e1', date, type: 'arrivee', retard_min: date === '2026-08-04' ? 12 : 0 })),
  indisponibilites: [{
    id: 'i1', employee_id: 'e2', date_debut: '2026-07-21', date_fin: '2027-01-03',
    type: 'indisponible', motif: 'conge_maternite', confirme_le: '2026-07-21T09:00:00Z',
  }],
  audits: [], items: [], ecarts: [], config: { jours_feries: ['2026-08-15'] },
};

vm.runInContext(`
  MOIS = '2026-08-01';
  SITE = 'vito-sainte-marie';
  EMPLOYEE = { id: 'manager-1', role: 'manager' };
  RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
  RAPPORT.periodeEnregistree = null;
  RAPPORT.planningOfficiel = { source: 'nexus', url: null };
  render();
`, ctx);

const ecran = rendu.app;
assert.ok(ecran && ecran.length > 2000, 'l’écran ne s’est pas rendu');

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const contient = t => ecran.includes(t);

// P0 — l'événement RH s'affiche en une ligne, comme demandé.
verifier('l’événement RH porte le nom du salarié', contient('Vanessa Ribe'));
verifier('… son motif seul, sans phrase datée', contient('Congé maternité'));
verifier('… sa période couverte dans le mois', contient('01/08/2026 → 31/08/2026'));
verifier('… et son nombre de jours couverts', contient('31 jours couverts'));
verifier('… en rappelant qu’il a commencé avant le mois', contient('commencé le 21/07/2026'));
// L'événement apparaît deux fois — dans la liste du mois et dans la fiche
// du salarié — et deux fois seulement. Avant ce lot, les 31 jours d'août
// produisaient 31 blocs.
verifier('aucune carte n’est produite par journée d’absence',
  (ecran.match(/class="rh-bloc"/g) || []).length === 2);

// P0 — la sortie principale est le dossier comptable, le CSV passe second.
verifier('le bouton principal génère le dossier comptable', contient('Générer le dossier comptable'));
verifier('le CSV est explicitement présenté comme technique', contient('Export CSV (technique)'));

// P1 — variables comptables agrégées sur la carte salarié.
['Présence', 'Absence non déclarée', 'Congés payés', 'Maladie / maternité', 'Retards',
  'Heures supplémentaires', 'Jours fériés', 'Éléments financiers'].forEach(v => {
  verifier(`la carte salarié affiche « ${v} »`, contient(v));
});
verifier('les sources et événements journaliers passent derrière « Voir le détail »',
  contient('Voir le détail des sources et événements'));

// P1 — trois statuts de salarié, et le statut du mois qui en découle.
verifier('un salarié sans rien à décider est « Prêt »', contient('>Prêt<'));
verifier('un salarié avec un arbitrage en attente est « À vérifier »', contient('>À vérifier<'));
verifier('un rattachement non confirmé est une « Donnée manquante »', contient('>Donnée manquante<'));
verifier('le mois affiche combien de salariés sont prêts', /Salariés · \d+\/\d+ prêts/.test(ecran));

// P1 — plus aucune boîte de dialogue native dans tout l'écran.
verifier('aucun prompt(), alert() ou confirm() ne subsiste',
  !/\b(prompt|alert|confirm)\s*\(/.test(html));
verifier('les saisies passent par une modale NEXUS', html.includes('id="nexusDialogue"') || html.includes("d.id='nexusDialogue'"));

// P2 — vocabulaire.
verifier('« Marquer prêt » est devenu « Valider le mois »',
  contient('Valider le mois') && !contient('Marquer prêt'));
verifier('« Exporter le dossier » est devenu « Générer le dossier comptable »',
  !contient('Exporter le dossier'));
verifier('« vérifié » s’affiche « prêt pour comptabilité »',
  html.includes("verifie:'prêt pour comptabilité'"));

// Garde-fou général : aucun trou dans le gabarit.
verifier('le rendu ne contient ni « undefined » ni « NaN »',
  !ecran.includes('undefined') && !ecran.includes('NaN'));

console.log(`\nNEXUS PAYE — écran rendu sur août 2026 : ${ok}/${ok} vérifications passent.`);
