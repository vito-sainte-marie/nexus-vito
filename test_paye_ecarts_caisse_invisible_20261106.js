// NEXUS PAYE — écarts de caisse à qualifier : liste cliquable et libellé neutre (05/11/2026, retour de Production).
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
    ecarts: [
      { id: 'k1', employeeId: 'e5', date: '2026-08-05', activite: 'piste', quart: 'quart1', sourceModule: 'verify',
        montantRetenu: 0, ecartInitial: -2038.38, ecartFinal: -4.61, statut: 'a_verifier', deepLink: 'NEXUS-Verify-v1.html#k1' },
      { id: 'k2', employeeId: 'e5', date: '2026-08-11', activite: 'boutique', quart: 'quart1', sourceModule: 'verify',
        montantRetenu: -20, ecartInitial: -20, ecartFinal: -20, statut: 'a_verifier', deepLink: 'NEXUS-Verify-v1.html#k2' },
      { id: 'k3', employeeId: 'e5', date: '2026-08-12', activite: 'boutique', quart: 'quart1', sourceModule: 'verify',
        montantRetenu: 3, ecartInitial: 3, ecartFinal: 3, statut: 'valide', deepLink: 'NEXUS-Verify-v1.html#k3' },
      { id: 'k4', employeeId: null, date: '2026-08-06', activite: 'fdj', quart: 'quart2', sourceModule: 'fdj',
        montantRetenu: 0, ecartInitial: -7, ecartFinal: null, statut: 'a_verifier', deepLink: 'NEXUS-FDJ-v1.html#k4' },
    ],
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


const items = ev("RAPPORT.items.filter(i=>i.typeItem==='ecart_caisse')");
verifier('écart piste « à vérifier » (montantRetenu 0, final -4,61) : item créé', items.some(i => i.sourceCle === 'ecart:k1' && i.ecartFinalCentimes === -461));
verifier('écart non attribué sans final : item créé sur le montant initial', items.some(i => i.sourceCle === 'ecart:k4'));
const cumul = ev("NexusPayeMoteur.cumulEcartsCaisseMois(trouverFiche('e5').ecartsCaisseMois ? [] : [])") && ev("trouverFiche('e5').ecartsCaisseMois");
verifier('cumul : piste -4,61 + boutique -20 = -24,61 (le +3 n’est pas retenu)', cumul && cumul.pisteCentimes === -461 && cumul.boutiqueCentimes === -2000 && cumul.totalCentimes === -2461);
const groupes = ev("groupesEcartsCaisse(RAPPORT.items)");
verifier('deux groupes : « Non attribués » en premier, puis le salarié', groupes.length === 2 && groupes[0].nom === 'Non attribués' && groupes[0].items.length === 1);
verifier('le groupe du salarié porte 3 écarts et exactement le cumul transmis', groupes[1].items.length === 3 && groupes[1].cumulCentimes === cumul.totalCentimes);
const rendu = ev("groupesEcartsCaisse(RAPPORT.items).map(renderGroupeEcarts).join('')").replace(/\u00a0/g, ' ');
verifier('une seule ligne résumé par groupe', (rendu.match(/<summary/g) || []).length === 2);
verifier('un seul groupe ouvert à la fois (attribut name commun)', (rendu.match(/<details class="groupe-ecarts" name="groupe-ecarts"/g) || []).length === 2);
verifier('résumé : « 3 écarts » et cumul -24,61', /3 écarts/.test(rendu) && /-24[.,]61/.test(rendu));
verifier('l’écart positif Boutique est grisé « non retenu »', /ecart-non-retenu[^>]*>.*?non retenu/.test(rendu));
verifier('l’écart -4,61 est visible dans la liste', /-4[.,]61/.test(rendu) && !/-2038/.test(rendu));
console.log(`\n${ok} contrôles OK.`);
