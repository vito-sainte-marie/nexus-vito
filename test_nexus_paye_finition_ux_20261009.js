// NEXUS PAYE — finition UX et fiabilisation métier (09/10/2026, Fast Track).
//
// Trois défauts diagnostiqués avant ce lot, que ce test interdit désormais :
//   1. « Régularisations encaissées » était fabriqué par final − initial :
//      une correction à la validation passait pour un versement (0 versement
//      en Production). Les encaissements viennent maintenant de
//      NexusPayeRegularisations, sur leur date réelle, et le solde aussi.
//   2. Une lecture impossible des régularisations rendait des zéros. Elle
//      rend désormais « — » et sa raison.
//   3. Les heures proposées par le barème pour une présence hors planning,
//      encore non décidée, s'affichaient parmi les heures confirmées. Le
//      moteur les compte toujours (règle inchangée, soumise à arbitrage) ;
//      l'écran les sépare.
//
// La recette couvre la §9 du mandat : un salarié sans anomalie, un salarié à
// plusieurs anomalies dont une présence hors planning, un hors paie, une
// absence qualifiée, une régularisation partielle et une autre sur un écart
// d'une période antérieure. Aucune donnée métier n'est modifiée.
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
// Toute écriture vers la base ferait échouer le test : l'écran ne doit
// que lire pour afficher.
const ecritures = [];
const nexusClient = new Proxy({}, { get: (_, k) => () => { ecritures.push(String(k)); throw new Error(`appel base inattendu : ${String(k)}`); } });
// Les échecs simulés journalisent : on les garde pour les compter, pas pour bruiter.
const journal = [];
const ctx = {
  console: Object.assign({}, console, { error: (...a) => journal.push(a) }), URL, Intl, Date, Math, Number, String, Object, Array, Promise, Error,
  document: {
    getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
    createElement: () => element('cree'), body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  },
  navigator: {}, nexusClient,
  nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-regularisations.js'), 'utf8'), ctx);
vm.runInContext(script[1], ctx);

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const ecran = () => rendu.app || '';
const dans = (t, s) => t.includes(s);
const compter = (t, re) => (t.match(re) || []).length;

// ── Recette fictive : août 2026 ──────────────────────────────────────────
const JOURS = ['2026-08-03', '2026-08-04', '2026-08-05'];
ctx.__donnees = {
  periode: '2026-08-01',
  employees: [
    { id: 'a1', nom: 'Alpha Sansanomalie', role: 'pompiste', actif: true },
    { id: 'b2', nom: 'Bravo Plusieurs', role: 'caissier', actif: true },
    { id: 'c3', nom: 'Charlie Horspaie', role: 'renfort', actif: true },
    { id: 'd4', nom: 'Delta Conge', role: 'caissier', actif: true },
  ],
  settings: [
    { employee_id: 'a1', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'b2', inclus_paye: true, mode_presence: 'automatique' },
    { employee_id: 'c3', inclus_paye: false, mode_presence: 'exclu' },
    { employee_id: 'd4', inclus_paye: true, mode_presence: 'automatique' },
  ],
  planning: [
    ...JOURS.map(date => ({ employee_id: 'a1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
    ...JOURS.map(date => ({ employee_id: 'b2', date, quart: 'quart2', statut: 'travail_normal', duree_heures: 7, tache: 'boutique' })),
  ],
  pointages: [
    ...JOURS.map(date => ({ employee_id: 'a1', date, type: 'arrivee', retard_min: 0 })),
    ...JOURS.map(date => ({ employee_id: 'b2', date, type: 'arrivee', retard_min: date === '2026-08-04' ? 15 : 0 })),
    // Bravo travaille aussi un jour absent de son planning.
    { employee_id: 'b2', date: '2026-08-08', type: 'arrivee', retard_min: 0 },
  ],
  indisponibilites: [{
    id: 'i1', employee_id: 'd4', date_debut: '2026-08-01', date_fin: '2026-08-31',
    type: 'indisponible', motif: 'conge_maternite', confirme_le: '2026-07-20T09:00:00Z',
  }],
  ecarts: [{
    id: 'ec-b2', employeeId: 'b2', date: '2026-08-05', activite: 'boutique', quart: 'quart2',
    sourceModule: 'verify', montantRetenu: -50, ecartInitial: -50, ecartFinal: -50,
    statut: 'valide', causeCode: 'erreur_rendu', deepLink: 'NEXUS-Verify-v1.html#ec-b2',
  }],
  audits: [], items: [], config: { jours_feries: ['2026-08-15'] },
};
const avant = JSON.stringify(ctx.__donnees);

// Univers des régularisations (forme NexusEcartsDonnees) : un écart d'août
// partiellement régularisé, un écart de juillet régularisé en août, un écart
// d'août encore en attente de validation.
const FUSEAU = 'America/Martinique';
ctx.__univers = [
  { id: 'verify-b2-boutique', sourceModule: 'verify', date: '2026-08-05', quart: '2', activite: 'boutique',
    employeeId: 'b2', employeeNom: 'Bravo Plusieurs', ecartInitial: -50, ecartFinal: -50, causeCode: null, statut: 'cloture_non_explique' },
  { id: 'verify-a1-piste', sourceModule: 'verify', date: '2026-07-28', quart: '1', activite: 'piste',
    employeeId: 'a1', employeeNom: 'Alpha Sansanomalie', ecartInitial: -40, ecartFinal: -40, causeCode: null, statut: 'cloture_non_explique' },
  { id: 'verify-x9-piste', sourceModule: 'verify', date: '2026-08-20', quart: '3', activite: 'piste',
    employeeId: 'b2', employeeNom: 'Bravo Plusieurs', ecartInitial: -8, ecartFinal: -8, causeCode: null, statut: 'a_verifier' },
];
ctx.__ops = {
  versements: [
    { id: 'v1', module_origine: 'verify', audit_id: 'b2', caisse_origine: 'boutique', employee_id: 'b2', montant: 20,
      mode_encaissement: 'especes', destination: 'tiroir_verify_boutique', encaisse_le: '2026-08-12T15:00:00Z', auteur_id: 'mgr-1' },
    { id: 'v2', module_origine: 'verify', audit_id: 'a1', caisse_origine: 'piste', employee_id: 'a1', montant: 15,
      mode_encaissement: 'especes', destination: 'tiroir_verify_piste', encaisse_le: '2026-08-03T15:00:00Z', auteur_id: 'mgr-1' },
    // Encaissé en septembre : hors de la période, ni encaissé ni soldé en août.
    { id: 'v3', module_origine: 'verify', audit_id: 'b2', caisse_origine: 'boutique', employee_id: 'b2', montant: 10,
      mode_encaissement: 'especes', destination: 'tiroir_verify_boutique', encaisse_le: '2026-09-02T15:00:00Z', auteur_id: 'mgr-1' },
  ],
  restitutions: [],
};

vm.runInContext(`
  MOIS = '2026-08-01';
  SITE = 'site-fictif-a';
  EMPLOYEE = { id: 'manager-1', role: 'manager' };
  RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
  RAPPORT.periodeEnregistree = null;
  RAPPORT.planningOfficiel = null;
`, ctx);

// ── 1. Chargement des régularisations : la station, et jamais un zéro ────
async function chargement(fuseau, echec) {
  const appels = [];
  ctx.NexusStation = { fuseauDeLaStation: async s => { appels.push(['fuseau', s]); return fuseau; } };
  ctx.NexusEcartsDonnees = { chargerEcartsConsolides: async (_c, s) => { appels.push(['ecarts', s]); if (echec) throw new Error('réseau'); return ctx.__univers; } };
  ctx.NexusPayeRegularisations.chargerOperations = async (_c, s) => { appels.push(['ops', s]); return ctx.__ops; };
  const r = await vm.runInContext('chargerRegularisationsPaye()', ctx);
  return { r, appels };
}

(async () => {
  const sans = await chargement({ indetermine: 'configuration' });
  verifier('sans fuseau configuré, l’état est « sans_fuseau » et rien n’est lu', sans.r.etat === 'sans_fuseau' && sans.appels.length === 1);
  const reseau = await chargement({ indetermine: 'reseau' });
  verifier('un fuseau illisible par le réseau rend « erreur »', reseau.r.etat === 'erreur');
  const panne = await chargement({ timezone: FUSEAU }, true);
  verifier('une lecture qui échoue rend « erreur » sans lever, et la journalise', panne.r.etat === 'erreur' && journal.length === 1);

  ctx.__r = panne.r;
  vm.runInContext('REGUL = __r; SELECTION = null; ONGLET = "fiche"; render();', ctx);
  const kpiEcarts = (ecran().match(/data-kpi="ecarts">([\s\S]*?)<\/button>/) || [])[1] || '';
  verifier('en erreur, l’indicateur d’écarts affiche « — » et sa raison, jamais 0',
    dans(kpiEcarts, '<b>—</b>') && dans(kpiEcarts, 'Régularisations indisponibles') && !/0\.00 €/.test(kpiEcarts));
  verifier('… et le volet décisions ne fabrique aucune ligne de solde',
    !dans(ecran(), 'Solde restant au') && !dans(ecran(), 'Régularisations réellement encaissées'));
  ctx.__r = sans.r;
  vm.runInContext('REGUL = __r; render();', ctx);
  verifier('sans fuseau, la raison est nommée', dans(ecran(), 'Fuseau horaire de la station non configuré'));

  const bon = await chargement({ timezone: FUSEAU });
  verifier('le chargement ne lit que la station courante',
    bon.r.etat === 'ok' && bon.appels.every(([, s]) => s === 'site-fictif-a') && bon.appels.length === 3);
  const sy = bon.r.synthese;
  verifier('les écarts validés d’août : un manque de −50 €, l’écart en attente à part',
    sy.constates.manquesCentimes === -5000 && sy.constates.nbManques === 1 && sy.constates.enAttente.nb === 1);
  verifier('encaissé en août : 20 € partiels + 15 € sur l’écart de juillet, pas les 10 € de septembre',
    sy.encaissements.netCentimes === 3500);
  verifier('le solde fin août : 30 € restent sur août, 25 € sur juillet',
    sy.soldeFinPeriode.resteDuCentimes === 5500);

  ctx.__r = bon.r;
  vm.runInContext('REGUL = __r; SELECTION = null; render();', ctx);
  const kpi = (ecran().match(/data-kpi="ecarts">([\s\S]*?)<\/button>/) || [])[1] || '';
  verifier('l’indicateur porte le solde réel et l’encaissé du mois',
    dans(kpi, '<b>-55.00 €</b>') && dans(kpi, 'encaissé +35.00 €'));
  verifier('les quatre lectures sont distinctes à l’écran',
    dans(ecran(), 'Écarts initiaux de la période (avant validation)')
    && dans(ecran(), 'Écarts validés de la période')
    && dans(ecran(), 'Régularisations réellement encaissées ce mois (dont 1 sur un écart antérieur)')
    && dans(ecran(), 'Solde restant au 31/08/2026'));
  verifier('l’écart en attente de validation est nommé, pas compté', dans(ecran(), '1 écart en attente de validation'));
  verifier('ce que le manager transmet reste séparé et sans incidence automatique',
    dans(ecran(), 'Transmis à la comptable, saisi par le manager — sans incidence automatique'));

  // ── 2. Aucun versement fabriqué par la correction à la validation ───────
  verifier('aucune case « Régularisations encaissées » ne survit dans l’écran',
    !dans(html, '<span>Régularisations encaissées</span>'));
  vm.runInContext('SELECTION = "b2"; ONGLET = "fiche"; render();', ctx);
  verifier('un écart non corrigé n’affiche aucune correction à la validation',
    dans(ecran(), '<span>Correction à la validation</span><b>—</b>'));
  verifier('aucune retenue sur salaire n’est générée',
    vm.runInContext("NexusPayeMoteur.variablesComptables(RAPPORT.employes.find(f=>f.employee.id==='b2')).financier.retenueEcartCentimes", ctx) === 0);

  // ── 3. Le tableau : « N à traiter » et les dossiers prioritaires ────────
  vm.runInContext('SELECTION = null; render();', ctx);
  const ligne = id => (ecran().match(new RegExp(`<tr data-employee="${id}"[\\s\\S]*?</tr>`)) || [''])[0];
  const nB2 = vm.runInContext("itemsEnAttente(RAPPORT.employes.find(f=>f.employee.id==='b2')).length", ctx);
  verifier('le salarié à plusieurs anomalies en a bien plusieurs', nB2 >= 2);
  verifier('sa ligne annonce le nombre d’éléments à traiter', dans(ligne('b2'), `<span class="flag compte">${nB2} à traiter</span>`));
  verifier('… et ressort comme prioritaire', /<tr data-employee="b2"[^>]*class="[^"]*prioritaire/.test(ecran()));
  verifier('le salarié sans anomalie : « Rien à vérifier », pas prioritaire',
    dans(ligne('a1'), 'Rien à vérifier') && !/<tr data-employee="a1"[^>]*prioritaire/.test(ecran()));
  verifier('le hors paie reste visible, jamais prioritaire',
    /<tr data-employee="c3"[^>]*class="[^"]*horspaie/.test(ecran()) && !/<tr data-employee="c3"[^>]*prioritaire/.test(ecran()));
  verifier('l’absence qualifiée se lit dans le tableau', dans(ligne('d4'), 'Maladie/maternité'));

  // ── 4. Heures hors planning : proposées, jamais confirmées en silence ───
  const fB2 = 'RAPPORT.employes.find(f=>f.employee.id==="b2")';
  const att = vm.runInContext(`heuresEnAttente(${fB2})`, ctx);
  const presence = vm.runInContext(`NexusPayeMoteur.variablesComptables(${fB2}).presence.heures`, ctx);
  verifier('la présence hors planning propose des heures en attente', att > 0);
  verifier('la ligne les signale à côté du total', dans(ligne('b2'), `dont ${att.toFixed(2)} h en attente`));
  const kpiH = (ecran().match(/data-kpi="heures">([\s\S]*?)<\/button>/) || [])[1] || '';
  const total = vm.runInContext('RAPPORT.synthese.heuresConfirmees', ctx);
  verifier('l’indicateur « Heures confirmées » les retire et les nomme',
    dans(kpiH, `<b>${(total - att).toFixed(2)} h <em`) && dans(kpiH, `+ ${att.toFixed(2)} h à arbitrer</em>`));
  vm.runInContext('SELECTION = "b2"; ONGLET = "fiche"; render();', ctx);
  verifier('la fiche sépare heures confirmées et heures en attente',
    dans(ecran(), `<span>Heures confirmées</span><b>${(presence - att).toFixed(2)} h</b>`)
    && dans(ecran(), `<span>En attente d’arbitrage</span><b>${att.toFixed(2)} h</b>`));
  verifier('la proposition du barème appelle une décision explicite',
    dans(ecran(), 'Proposition (barème, non décidée)') && dans(ecran(), 'confirmez, corrigez'));
  // Le bouton de la fiche et la ligne du tableau comptent la même chose :
  // l'écart de caisse à valider en fait partie (le banc navigateur affichait 2 contre 3).
  verifier('l’action principale nomme le même nombre que la ligne du tableau',
    dans(ecran(), `<button class="btn primary jump-first" style="margin:0 0 8px">Traiter les ${nB2} éléments</button>`));

  vm.runInContext('SELECTION = null; ONGLET = "decisions"; render();', ctx);
  const nBloq = vm.runInContext('RAPPORT.bloqueurs.length', ctx);
  verifier('le volet décisions annonce un seul nombre, écart de caisse compris',
    dans(ecran(), `${nBloq} points à traiter avant de valider le mois.`)
    && dans(ecran(), `Traiter les ${nBloq} éléments</button>`) && !dans(ecran(), `Traiter les ${nBloq - 1} éléments`));
  vm.runInContext('SELECTION = "b2"; ONGLET = "fiche"; render();', ctx);

  // ── 5. La fiche en trois sections, les zéros sur une ligne ──────────────
  verifier('trois sections nommées',
    compter(ecran(), /<div class="sous-titre">/g) === 3
    && dans(ecran(), '>Temps de travail<') && dans(ecran(), '>Absences<') && dans(ecran(), '>Éléments financiers et décisions<'));
  verifier('les variables nulles tiennent sur une ligne compacte, sans tuile',
    dans(ecran(), '<div class="zeros">') && dans(ecran(), 'Congés payés 0') && !dans(ecran(), '<span>Congés payés</span>'));
  verifier('la lecture des heures garde son infobulle', dans(ecran(), 'data-info="heures"'));
  vm.runInContext('SELECTION = "a1"; render();', ctx);
  verifier('sans anomalie, aucun bouton « Traiter »',
    !/Traiter les \d/.test((ecran().split('id="ficheSection"')[1] || '').split('id="reviewSection"')[0]));

  // ── 6. Données métier identiques avant et après ─────────────────────────
  verifier('la recette n’a pas été modifiée par l’écran', JSON.stringify(ctx.__donnees) === avant);
  verifier('aucun appel à la base pendant le rendu', ecritures.length === 0);

  console.log(`NEXUS PAYE — finition UX : ${ok}/${ok} vérifications passent.`);
})().catch(e => { console.error(e); process.exit(1); });
