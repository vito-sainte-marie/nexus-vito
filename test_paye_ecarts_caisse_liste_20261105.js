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
      { id: 'ec1', employeeId: 'e5', date: '2026-08-11', activite: 'boutique', quart: 'quart1', sourceModule: 'verify',
        montantRetenu: -20, ecartInitial: -20, ecartFinal: -20, statut: 'a_verifier', deepLink: 'NEXUS-Verify-v1.html#ec1' },
      { id: 'ec2', employeeId: null, date: '2026-08-05', activite: 'fdj', quart: 'quart2', sourceModule: 'fdj',
        montantRetenu: -7, ecartInitial: -7, ecartFinal: -7, statut: 'a_verifier', deepLink: 'NEXUS-FDJ-v1.html#ec2' },
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

const aQ = ev("RAPPORT.items.filter(i=>i.typeItem==='ecart_caisse')");
verifier('le jeu contient deux écarts de caisse', aQ.length === 2);
const liste = ev("RAPPORT.items.filter(ecartAQualifier).map(ligneEcartAQualifier).join('')");
verifier('la liste montre les deux écarts, une ligne chacun', (liste.match(/class="ligne-ecart"/g) || []).length === 2);
verifier('écart attribué : bouton vers la fiche du salarié, avec la clé de l’écart', /<button type="button" class="ligne-ecart" data-voir-ecart="e5" data-cle="ecart:ec1">/.test(liste));
verifier('la ligne montre date, origine (Boutique) et montant final, sans quart ni statut', /11\/08\/2026<\/span><span>Boutique<\/span><span>[^<]*<\/span><b>-20[.,]00/.test(liste.replace(/\u00a0/g, ' ')) && !/quart1|Verify/.test(liste));
verifier('écart non attribué : lien vers la source FDJ, mention « non attribué »', /<a class="ligne-ecart" href="NEXUS-FDJ-v1\.html#ec2">.*?<span>FDJ<\/span><span>non attribué<\/span>/.test(liste));

// Variables € : libellé neutre et cliquable
const tuiles = ev("tuilesFiche(NexusPayeMoteur.variablesComptables(trouverFiche('e5')),trouverFiche('e5')).financier[0]");
verifier('Variables € : « 1 écart de caisse à qualifier · sans incidence paie »', tuiles.sous === '1 écart de caisse à qualifier · sans incidence paie');
verifier('Variables € : plus de « en attente d’arbitrage » pour cet écart', !/arbitrage/.test(tuiles.sous));
verifier('Variables € : tuile neutre (pas ambre) et cliquable vers e5', tuiles.attente === false && tuiles.versEcart === 'e5');
const html = ev("tuile(...(t=>[t.label,t.valeur,t.sous,t])(tuilesFiche(NexusPayeMoteur.variablesComptables(trouverFiche('e5')),trouverFiche('e5')).financier[0]))");
verifier('la tuile est un bouton data-voir-ecart', /<button type="button" class="var var-ecart"[^>]*data-voir-ecart="e5"/.test(html));

// Clic : onglet Événements, écart en surbrillance
ev("voirEcart('e5','ecart:ec1')");
verifier('voirEcart ouvre l’onglet Événements de la fiche', ev("FICHE_ONGLET==='evenements' && SELECTION==='e5' && FICHE_OUVERTE===true"));
const fiche = ev("renderFiche(trouverFiche('e5'))");
verifier('l’écart visé porte la surbrillance', /class="item [^"]*surligne"[^>]*data-ecart-cle="ecart:ec1"/.test(fiche));

// Règle inchangée : ces écarts ne bloquent pas la validation
const bloq = ev("RAPPORT.bloqueurs.filter(b=>b.type==='ecart_caisse'&&b.employeeId==='e5').length");
verifier('un écart rattaché et non contesté ne bloque toujours pas', bloq === 0);
console.log(`${ok} contrôles passent.`);

// Cumul mensuel transmis au comptable (décision du 05/11/2026).
const cumul = lignes => ev('NexusPayeMoteur').cumulEcartsCaisseMois(lignes);
const L = (activite, montant) => ({ activite, ecartInitial: montant, ecartFinal: montant, statut: 'valide' });
verifier('FDJ +3 € et -1 € : total positif transmis à 0', cumul([L('fdj', 3), L('fdj', -1)]).fdjCentimes === 0);
verifier('FDJ -5 € et +2 € : -3 €', cumul([L('fdj', -5), L('fdj', 2)]).fdjCentimes === -300);
verifier('Boutique -4 € et +10 € : -4 € (pas de compensation)', cumul([L('boutique', -4), L('boutique', 10)]).boutiqueCentimes === -400);
verifier('Piste +2 € seul : 0', cumul([L('piste', 2)]).totalCentimes === 0);
const mixte = cumul([L('boutique', -5.53), L('piste', 4), L('fdj', -1)]);
verifier('total = Boutique + Piste + FDJ avec le détail par origine', mixte.totalCentimes === -653 && mixte.boutiqueCentimes === -553 && mixte.pisteCentimes === 0 && mixte.fdjCentimes === -100);
verifier('un écart à vérifier compte sur son montant du moment', cumul([{ activite: 'boutique', ecartInitial: -8, ecartFinal: -8, statut: 'a_verifier' }]).boutiqueCentimes === -800);
verifier('le montant ajusté remplace le montant initial après vérification', cumul([{ activite: 'boutique', ecartInitial: -8, ecartFinal: -3, statut: 'valide' }]).boutiqueCentimes === -300);
const fiche5 = ev("RAPPORT.employes.find(f=>f.employee.id==='e5')");
verifier('la fiche porte le cumul du mois : Boutique -20 €', ev("NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='e5'))").financier.ecartsCaisseMois.totalCentimes === -2000);
const bloc = ev("renderPourComptable(NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='e5')),RAPPORT.employes.find(f=>f.employee.id==='e5'))");
verifier('« Pour le comptable » montre « Écarts de caisse du mois » avec le détail par origine', /Écarts de caisse du mois/.test(bloc) && /Boutique -20\.00 € · Piste 0\.00 € · FDJ 0\.00 €/.test(bloc.replace(/\u00a0/g, ' ')));
console.log(`\n${ok} contrôles passent.`);

// Un montant qui change après la vérification : caduque (vérifié) ou « élément arrivé après la transmission » (transmis).
const V = ev('NexusPayeValidation');
const snap = t => ({ dossier: { salaries: [{ employeeId: 'e5', variables: { financier: { ecartsCaisseMois: { totalCentimes: t } } } }] } });
const sal = t => [{ employeeId: 'e5', variables: { financier: { ecartsCaisseMois: { totalCentimes: t } } } }];
verifier('cumul inchangé : la vérification tient', V.ecartsCaisseModifies(snap(-2000), sal(-2000)) === false);
verifier('cumul changé : la vérification devient caduque', V.verificationCaduque('verifie', 0, V.ecartsCaisseModifies(snap(-2000), sal(-500))) === true);
verifier('mois transmis et cumul changé : « élément arrivé après la transmission »', V.etat({ statut: 'transmis', bloqueurs: 0, salariesInclus: 1, salariesPrets: 1, ecartsModifies: true }).elementApresTransmission === true);
console.log('\nCaducité sur écart : contrôlée.');
