// NEXUS PAYE — paramétrages à traiter visibles (07/11/2026).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

function charger(html) {
  const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
  assert.ok(script, 'script inline introuvable');
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
    // `URL` est fourni par le navigateur : sans lui, le garde-fou du lien
    // planning refuserait TOUT lien et le test passerait pour de mauvaises
    // raisons.
    URL,
    nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-moteur.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-donnees.js'), 'utf8'), ctx);
  if (!ctx.URLSearchParams) ctx.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-banniere-station.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-validation.js'), 'utf8'), ctx);
  
  vm.runInContext(script[1], ctx);
  const JOURS_E1 = ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'];
  const JOURS_E5 = ['2026-08-10', '2026-08-11', '2026-08-12'];
  
  ctx.__donnees = {
    periode: '2026-08-01',
    employees: [
      { id: 'e1', nom: 'Camille', role: 'pompiste', actif: true },
      { id: 'e2', nom: 'Vanessa Ribe', role: 'caissier', actif: true },
      { id: 'e3', nom: 'Angélique', role: 'renfort', actif: true },
      { id: 'e4', nom: 'Mathieu', role: 'caissier', actif: true },
      { id: 'e5', nom: 'Sofiane', role: 'pompiste', actif: true },
    ],
    settings: [
      { employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' },
      { employee_id: 'e2', inclus_paye: true, mode_presence: 'automatique' },
      { employee_id: 'e4', inclus_paye: false, mode_presence: 'exclu' },
      { employee_id: 'e5', inclus_paye: true, mode_presence: 'automatique' },
      // e3 (Angélique) : rattachement paie jamais confirmé.
    ],
    planning: [
      ...JOURS_E1.map(date => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
      ...JOURS_E5.map(date => ({ employee_id: 'e5', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'boutique' })),
    ],
    pointages: [
      ...JOURS_E1.map(date => ({ employee_id: 'e1', date, type: 'arrivee', retard_min: date === '2026-08-04' ? 12 : 0 })),
      // Camille a aussi travaillé un jour qui n'était pas à son planning.
      { employee_id: 'e1', date: '2026-08-17', type: 'arrivee', retard_min: 0 },
      // Sofiane manque au 12 : une absence non déclarée s'ajoute à son écart.
      { employee_id: 'e5', date: '2026-08-10', type: 'arrivee', retard_min: 0 },
      { employee_id: 'e5', date: '2026-08-11', type: 'arrivee', retard_min: 0 },
    ],
    indisponibilites: [{
      id: 'i1', employee_id: 'e2', date_debut: '2026-07-21', date_fin: '2027-01-03',
      type: 'indisponible', motif: 'conge_maternite', confirme_le: '2026-07-21T09:00:00Z',
    }],
    // Écart constaté −50 €, validé −20 € : les +30 € sont une CORRECTION À LA
    // VALIDATION, pas un versement. Jusqu'au 09/10 l'écran les présentait comme
    // « Régularisations encaissées » alors qu'aucun versement n'existait
    // (0 en Production) : le défaut est corrigé et ce test l'interdit désormais.
    ecarts: [{
      id: 'ec1', employeeId: 'e5', date: '2026-08-11', activite: 'boutique', quart: 'quart1',
      sourceModule: 'verify', montantRetenu: -20, ecartInitial: -50, ecartFinal: -20,
      statut: 'valide', causeCode: 'erreur_rendu', deepLink: 'NEXUS-Verify-v1.html#ec1',
    }],
    audits: [], items: [], config: { jours_feries: ['2026-08-15'] },
  };
  
  
  vm.runInContext(`
    MOIS = '2026-08-01'; SITE = 'vito-sainte-marie';
    EMPLOYEE = { id: 'manager-1', role: 'manager' };
    RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
    RAPPORT.periodeEnregistree = null;
    RAPPORT.planningOfficiel = { source: 'google_sheets', url: 'https://docs.google.com/spreadsheets/d/aout2026/edit' };
    render();
  `, ctx);
  return { ctx, rendu, html };
}


const apres = charger(fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8'));
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const ev = code => vm.runInContext(code, apres.ctx);
const ecran = () => apres.rendu.app || '';
const V = require('./nexus-paye-validation.js');

// ── Règles pures
// Un paramétrage à compléter est un « à traiter » : compteur, pastille, infobulle, accès direct.
verifier('règle pure : le titre du bouton nomme le paramétrage',
  V.etat({ statut: 'brouillon', bloqueurs: [{}], parametrages: ['Inès'], salariesInclus: 8, salariesPrets: 8 }).validerTitre === '1 paramétrage à compléter : Inès avant de valider');
verifier('règle pure : paramétrage et décisions mêlés',
  /2 paramétrages à compléter : Inès, Paul · 1 autre à traiter/.test(V.etat({ statut: 'brouillon', bloqueurs: [{}, {}, {}], parametrages: ['Inès', 'Paul'], salariesInclus: 8, salariesPrets: 8 }).validerTitre));
ev("RAPPORT.bloqueurs=[{categorie:'configuration',type:'configuration_employe',employeeId:'e3',libelle:'Angélique : rattachement paie à confirmer'}]; RAPPORT.synthese.salariesPrets=RAPPORT.synthese.salariesInclus; render();");
const a = ecran();
verifier('« À traiter » compte le paramétrage (1, pas 0)', /data-kpi="decisions"><span>À traiter<b>1<\/b>/.test(a));
verifier('le bouton Décisions porte la pastille 1', /data-onglet="decisions">Décisions<span class="n">1<\/span>/.test(a));
verifier('l’infobulle de Valider nomme la cause', /id="validerMois"[^>]*title="1 paramétrage à compléter : Angélique avant de valider"/.test(a));
verifier('« Configurer » mène directement au salarié', /class="btn configure" data-id="e3"[^>]*>Configurer/.test(a));
verifier('avec un paramétrage, la tuile « À traiter » n’affiche aucun pourcentage et l’anneau est plein', /data-kpi="decisions">.*?stroke-dasharray="157\.1 157\.1".*?<small class="sr">à traiter<\/small>/.test(a.replace(/\n/g, ' ')));
console.log(`${ok} contrôles passent.`);
