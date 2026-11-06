// NEXUS PAYE — validation du mois et finitions (06/11/2026).
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
const base0 = { statut: 'brouillon', bloqueurs: [], salariesInclus: 3, salariesPrets: 3 };
verifier('rien à traiter + brouillon : « Valider les 3 salariés prêts » actif, Transmettre inactif',
  V.etat(base0).validerActif && V.etat(base0).validerLibelle === 'Valider les 3 salariés prêts' && !V.etat(base0).transmettreActif);
verifier('reste à traiter : Valider inactif avec sa raison',
  !V.etat({ ...base0, salariesPrets: 2 }).validerActif && /1 à traiter/.test(V.etat({ ...base0, salariesPrets: 2 }).validerTitre));
verifier('un bloqueur ouvert empêche aussi la validation',
  !V.etat({ ...base0, bloqueurs: [{}] }).validerActif);
verifier('transmission impossible avant vérification',
  !V.etat(base0).transmettreActif && !V.etat({ ...base0, salariesPrets: 1 }).transmettreActif);
verifier('vérifié : Valider disparaît, Transmettre devient actif, capsule « Validés 3/3 »',
  !V.etat({ ...base0, statut: 'verifie' }).validerVisible && V.etat({ ...base0, statut: 'verifie' }).transmettreActif && V.etat(base0).capsule === 'Validés 3/3');
verifier('transmis : plus rien à actionner',
  !V.etat({ ...base0, statut: 'transmis' }).transmettreActif && !V.etat({ ...base0, statut: 'transmis' }).validerVisible);
verifier('la vérification devient caduque si un élément à traiter apparaît, jamais sur un mois transmis',
  V.verificationCaduque('verifie', 1) && !V.verificationCaduque('verifie', 0) && !V.verificationCaduque('transmis', 2) && !V.verificationCaduque('brouillon', 2));
verifier('aucun salarié prêt : pas de validation à vide', !V.etat({ ...base0, salariesInclus: 0, salariesPrets: 0 }).validerActif);

// ── Écran
ev("FILTRE='inclus'; render();");
const btn = id => (ecran().match(new RegExp(`<button[^>]*id="${id}"[^>]*>`)) || [''])[0];
verifier('écran avec éléments à traiter : Valider et Transmettre désactivés', /disabled/.test(btn('validerMois')) && /disabled/.test(btn('transmettreMois')));
verifier('la fiche ne porte plus « Valider le salarié »', !/valider-salarie/.test(ecran() + apres.html.replace(/\/\/.*$/gm, '').slice(0, 0)) && !/✓ Valider le salarié/.test(apres.html));

ev("RAPPORT.bloqueurs=[]; RAPPORT.synthese.salariesPrets=RAPPORT.synthese.salariesInclus; render();");
verifier('écran prêt : « Valider les n salariés prêts » actif et capsule Validés n/n',
  btn('validerMois') !== '' && !/disabled/.test(btn('validerMois')) && /Valider les \d+ salariés prêts|Valider le salarié prêt/.test(ecran()) && /Validés (\d+)\/\1/.test(ecran()));
verifier('écran prêt mais non vérifié : Transmettre reste désactivé', /disabled/.test(btn('transmettreMois')));

ev("RAPPORT.periodeEnregistree={statut:'verifie',snapshot:{},verifie_par:'e3',verifie_le:'2026-11-06T09:00:00Z'}; render();");
verifier('vérifié : badge « Vérifié par … le … », Transmettre actif, plus de Valider',
  /Vérifié par Angélique le 06\/11\/2026/.test(ecran()) && btn('validerMois') === '' && /primary transmettre/.test(btn('transmettreMois')) && !/disabled/.test(btn('transmettreMois')));

// ── Caducité : un nouvel élément à traiter après vérification remet le mois en préparation
ev("globalThis.__ecritures=[]; NexusPayeDonnees={enregistrerPeriode:async(c,a)=>{__ecritures.push(a)}};");
ev("RAPPORT.synthese.salariesPrets=RAPPORT.synthese.salariesInclus-1; RAPPORT.bloqueurs=[{}];");
(async () => {
  await ev("verificationCaducite()");
  const w = ev("__ecritures");
  verifier('vérification caduque : une écriture « brouillon » est enregistrée par le chemin existant', w.length === 1 && w[0].statut === 'brouillon' && w[0].snapshot === null);
  verifier('la mention est visible à l’écran', (ev("render(); MENTION_VALIDATION"), /vérification est annulée/.test(ecran())));

  ev("__ecritures.length=0; RAPPORT.periodeEnregistree={statut:'transmis',snapshot:{}}; await0=0;");
  await ev("verificationCaducite()");
  verifier('un mois transmis n’est jamais rouvert en silence', ev("__ecritures.length") === 0 && ev("etatPeriode()") === 'transmis');

  // ── Aucune écriture ni calcul modifiés par le rendu
  const synth = JSON.stringify(ev("RAPPORT.employes.map(f=>[f.employee.id,f.heuresCaisse,f.heuresPiste,f.heuresRenfort])"));
  ev("render();");
  verifier('le rendu ne modifie aucun calcul d’heures', synth === JSON.stringify(ev("RAPPORT.employes.map(f=>[f.employee.id,f.heuresCaisse,f.heuresPiste,f.heuresRenfort])")));

  // ── Fiche compacte et légende
  const src = apres.html;
  verifier('Heures retenues : valeur et nombre de journées sur une ligne',
    /class="ligne-heures"><span class="gros">/.test(src) && /\.ligne-heures\{display:flex;align-items:baseline/.test(src));
  verifier('légende sous la répartition : Caisse / Piste / Renfort, couleurs propres à la Paye',
    /class="legende-repart"/.test(src) && /\.legende-repart \.pt\.c1\{background:#0E9F8E\}/.test(src) && !/var\(--cyan\)/.test((src.match(/\.repart i\.c1[^\n]*/) || [''])[0]));
  verifier('une activité à 0 h n’apparaît pas dans la légende', /filter\(x=>x\[2\]>0\)/.test(src));
  console.log(`${ok} contrôles passent.`);
})().catch(e => { console.error(e); process.exit(1); });
