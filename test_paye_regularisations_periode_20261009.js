// Épreuve — 09/10/2026, G3 (complément métier de Frédéric) : une période
// d'analyse distingue trois lectures qui ne se confondent jamais.
//   - écarts constatés sur la période (date de l'écart) ;
//   - régularisations encaissées sur la période (date réelle de l'opération,
//     y compris pour un écart antérieur) ;
//   - solde restant à régulariser à une date de référence explicite, calculé
//     sans aucune opération postérieure à cette date.
// Scénario de référence : écart −50 € le lundi, versement +30 € le jeudi.
//   lundi seul   : −50 / 0 / solde −50 au lundi (le jeudi n'existe pas encore)
//   jeudi seul   : aucun écart artificiel, +30, solde −20
//   semaine      : −50 / +30 / −20
// Puis : versement après la période, annulation postérieure, versement
// partiel, restitution, non-compensation, écart en attente, collectif,
// et égalité employé / manager (même fonction, même rendu).
//
// Le vrai nexus-paye-regularisations.js est exécuté sur des fixtures
// fictives, puis muté : chaque mutation doit rougir une vérification.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const SRC = fs.readFileSync(path.join(DIR, 'nexus-paye-regularisations.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function charger(source) {
  const sandbox = { console, Intl, Date, Math, Number, String, Object, Array, Promise, Error };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.NexusPayeRegularisations;
}

const FUSEAU = 'America/Martinique';
// Lundi 05/10/2026 … dimanche 11/10/2026.
const LUNDI = '2026-10-05', JEUDI = '2026-10-08', DIMANCHE = '2026-10-11';

// Scénario de référence (fictif).
const GAMMA = [
  { id: 'verify-m1-piste', sourceModule: 'verify', date: LUNDI, quart: '1', activite: 'piste',
    employeeId: 'e-gamma', employeeNom: 'Gamma Fictif', ecartInitial: -50, ecartFinal: -50,
    causeCode: 'a_etablir', statut: 'cloture_non_explique' },
];
const V_JEUDI = { id: 'vg1', module_origine: 'verify', audit_id: 'm1', caisse_origine: 'piste', employee_id: 'e-gamma',
  montant: 30, mode_encaissement: 'especes', destination: 'tiroir_verify_piste',
  encaisse_le: '2026-10-08T15:00:00Z', auteur_id: 'mgr-1' };
// Versement après la semaine : n'entre ni dans les encaissements ni dans le solde de la semaine.
const V_APRES = { id: 'vg2', module_origine: 'verify', audit_id: 'm1', caisse_origine: 'piste', employee_id: 'e-gamma',
  montant: 10, mode_encaissement: 'carte_bancaire', destination: 'tiroir_verify_piste',
  encaisse_le: '2026-10-13T15:00:00Z', auteur_id: 'mgr-1' };

// Cas difficiles (fictifs).
const DELTA = [
  { id: 'fdj-c1', sourceModule: 'fdj', date: LUNDI, quart: '2', activite: 'fdj',
    employeeId: 'e-delta', employeeNom: 'Delta Fictif', ecartInitial: -40, ecartFinal: -40, causeCode: null, statut: 'regularise' },
  { id: 'verify-d2-boutique', sourceModule: 'verify', date: '2026-10-06', quart: '2', activite: 'boutique',
    employeeId: 'e-delta', employeeNom: 'Delta Fictif', ecartInitial: 15, ecartFinal: 15, causeCode: null, statut: 'cloture_explique' },
  { id: 'verify-d3-piste', sourceModule: 'verify', date: '2026-10-07', quart: '3', activite: 'piste',
    employeeId: 'e-delta', employeeNom: 'Delta Fictif', ecartInitial: -8, ecartFinal: -8, causeCode: null, statut: 'a_verifier' },
  { id: 'verify-d4-piste', sourceModule: 'verify', date: '2026-10-06', quart: '1', activite: 'piste',
    employeeId: null, employeeNom: 'Delta Fictif + Gamma Fictif', ecartInitial: -12, ecartFinal: -12, causeCode: null, statut: 'cloture_non_explique' },
];
const OPS_DELTA = {
  versements: [
    { id: 'w1', module_origine: 'fdj', fdj_cash_control_id: 'c1', employee_id: 'e-delta', montant: 10,
      mode_encaissement: 'especes', destination: 'tiroir_fdj', encaisse_le: '2026-10-06T13:00:00Z', auteur_id: 'mgr-1' },
    // Encaissé dans la semaine, annulé la semaine suivante : il comptait à la fin de la semaine.
    { id: 'w2', module_origine: 'fdj', fdj_cash_control_id: 'c1', employee_id: 'e-delta', montant: 5,
      mode_encaissement: 'cheque', destination: 'coffre', encaisse_le: '2026-10-07T13:00:00Z', auteur_id: 'mgr-1',
      annule_le: '2026-10-13T13:00:00Z', annule_par: 'mgr-2', motif_annulation: 'chèque rejeté' },
    // 20 € pour un collectif de 12 : trop-perçu de 8, qui ne rembourse pas le FDJ.
    { id: 'w3', module_origine: 'verify', audit_id: 'd4', caisse_origine: 'piste', employee_id: 'e-delta', montant: 20,
      mode_encaissement: 'especes', destination: 'tiroir_verify_piste', encaisse_le: '2026-10-08T13:00:00Z', auteur_id: 'mgr-1' },
  ],
  restitutions: [
    { id: 'q1', module_origine: 'verify', audit_id: 'd4', caisse_origine: 'piste', employee_id: 'e-delta', montant: 8,
      mode_restitution: 'especes', source: 'tiroir_verify_piste', justification: 'trop-perçu', restitue_le: '2026-10-14T13:00:00Z', valide_par: 'mgr-2' },
  ],
};

function mesure(html, nom) {
  const m = new RegExp(`data-mesure="${nom}"><div class="edg-label">[^<]*</div><div class="edg-valeur[^"]*">([^<]*)</div>`).exec(html);
  return m ? m[1] : null;
}

function verifier(R, journal) {
  const etape = label => { if (journal) ok(label); };
  const OPS = { versements: [V_JEUDI], restitutions: [] };
  const syn = (ecarts, ops, du, au, aujourdhui) =>
    R.syntheseRegularisationsPeriode(ecarts, ops, { fuseau: FUSEAU, dateDebut: du, dateFin: au, aujourdhui });

  // 1. Lundi seul : −50 constaté, rien d'encaissé, solde −50 au lundi.
  {
    const s = syn(GAMMA, OPS, LUNDI, LUNDI, '2026-10-09');
    assert.strictEqual(s.constates.manquesCentimes, -5000);
    assert.strictEqual(s.encaissements.netCentimes, 0);
    assert.strictEqual(s.soldeFinPeriode.resteDuCentimes, 5000, 'le versement du jeudi n’existe pas au lundi');
    assert.strictEqual(s.soldeActuel.resteDuCentimes, 2000, 'solde actuel distinct du solde de fin de période');
    const h = R.renderSynthese(s);
    assert.strictEqual(mesure(h, 'ecarts-manques'), '−50,00 €');
    assert.strictEqual(mesure(h, 'regularisations'), '0,00 €');
    assert.strictEqual(mesure(h, 'solde-fin'), '−50,00 €');
    assert.ok(/data-mesure="solde-actuel">Solde actuel au 09\/10\/2026 : −20,00 €/.test(h), 'solde actuel affiché à part');
    etape('lundi seul : −50 / 0 / −50 au 05/10, solde actuel −20 au 09/10 affiché à part');
  }

  // 2. Jeudi seul : pas d'écart artificiel, +30 encaissés sur un écart antérieur.
  {
    const s = syn(GAMMA, OPS, JEUDI, JEUDI, '2026-10-09');
    assert.strictEqual(s.constates.manquesCentimes, 0, 'aucun écart artificiel le jeudi');
    assert.strictEqual(s.constates.nbManques, 0);
    assert.strictEqual(s.encaissements.netCentimes, 3000);
    assert.strictEqual(s.encaissements.detail.length, 1);
    const d = s.encaissements.detail[0];
    assert.strictEqual(d.ecartAnterieur, true);
    assert.strictEqual(d.ecartDate, LUNDI);
    assert.strictEqual(d.ecartQuart, '1');
    assert.strictEqual(d.ecartInitialCentimes, -5000, 'le versement ne modifie pas l’écart initial');
    assert.strictEqual(d.mode, 'especes');
    assert.strictEqual(s.soldeFinPeriode.resteDuCentimes, 2000);
    const h = R.renderSynthese(s);
    assert.strictEqual(mesure(h, 'ecarts-manques'), '0,00 €');
    assert.strictEqual(mesure(h, 'regularisations'), '+30,00 €');
    assert.strictEqual(mesure(h, 'solde-fin'), '−20,00 €');
    assert.ok(h.includes('antérieur à la période') && h.includes('écart du 05/10/2026 · Q1 · piste (−50,00 €)'));
    etape('jeudi seul : 0 constaté, +30 sur l’écart du lundi (antérieur), solde −20 au 08/10');
  }

  // 3. Semaine : −50 / +30 / −20 ; le versement de la semaine suivante n'y entre pas.
  {
    const s = syn(GAMMA, { versements: [V_JEUDI, V_APRES], restitutions: [] }, LUNDI, DIMANCHE, '2026-10-14');
    assert.strictEqual(s.constates.manquesCentimes, -5000);
    assert.strictEqual(s.encaissements.netCentimes, 3000, 'le versement du 13/10 n’est pas de la semaine');
    assert.strictEqual(s.soldeFinPeriode.resteDuCentimes, 2000, 'aucun solde historique bâti sur un versement futur');
    assert.strictEqual(s.soldeActuel.resteDuCentimes, 1000);
    const h = R.renderSynthese(s);
    assert.strictEqual(mesure(h, 'ecarts-manques'), '−50,00 €');
    assert.strictEqual(mesure(h, 'regularisations'), '+30,00 €');
    assert.strictEqual(mesure(h, 'solde-fin'), '−20,00 €');
    assert.ok(/Solde actuel au 14\/10\/2026 : −10,00 €/.test(h));
    // L'écart initial reste −50 dans le relevé, quel que soit le versement.
    const l = R.construireReleve(GAMMA, { versements: [V_JEUDI], restitutions: [] }, { fuseau: FUSEAU }).lignes[0];
    assert.strictEqual(l.ecartInitialCentimes, -5000);
    assert.strictEqual(l.ecartCorrigeCentimes, -5000);
    assert.strictEqual(l.soldeCentimes, 2000);
    etape('semaine : −50 / +30 / −20 ; versement du 13/10 hors semaine ; écart initial intact');
  }

  // 4. Cas difficiles, semaine du 05/10 vue le 15/10.
  {
    const s = syn(DELTA, OPS_DELTA, LUNDI, DIMANCHE, '2026-10-15');
    assert.strictEqual(s.constates.manquesCentimes, -5200);
    assert.strictEqual(s.constates.nbManques, 2);
    assert.strictEqual(s.constates.excedentsCentimes, 1500, 'excédent séparé, jamais compensé');
    assert.strictEqual(s.constates.enAttente.nb, 1);
    assert.strictEqual(s.constates.enAttente.manquesCentimes, -800);
    assert.strictEqual(s.constates.dontNonImputeCentimes, -1200);
    assert.strictEqual(s.encaissements.versementsCentimes, 3500);
    assert.strictEqual(s.encaissements.annulationsVersementsCentimes, 0, 'annulation postérieure à la période');
    assert.strictEqual(s.encaissements.netCentimes, 3500);
    // Au 11/10 : FDJ 40 − 15 = 25 restant ; collectif 12 − 20 = trop-perçu 8, sans compensation.
    assert.strictEqual(s.soldeFinPeriode.resteDuCentimes, 2500, 'trop-perçu non compensé ; annulation du 13/10 inexistante au 11/10');
    assert.strictEqual(s.soldeFinPeriode.tropPercuCentimes, 800);
    assert.strictEqual(s.soldeFinPeriode.nbOuverts, 1);
    // Au 15/10 : annulation (FDJ 30 restant), restitution (collectif soldé) ; l'écart en attente reste hors solde.
    assert.strictEqual(s.soldeActuel.resteDuCentimes, 3000);
    assert.strictEqual(s.soldeActuel.tropPercuCentimes, 0);
    const h = R.renderSynthese(s);
    assert.strictEqual(mesure(h, 'ecarts-manques'), '−52,00 €');
    assert.strictEqual(mesure(h, 'ecarts-excedents'), '+15,00 €');
    assert.strictEqual(mesure(h, 'solde-fin'), '−25,00 €');
    assert.ok(h.includes('data-mesure="trop-percu">Trop-perçu à restituer au 11/10/2026 : +8,00 €'));
    assert.ok(h.includes('data-mesure="en-attente">1 écart(s)'));
    etape('semaine Delta : manques −52 / excédents +15 séparés ; en attente hors solde ; solde −25 et trop-perçu 8 non compensés');

    // Lundi seul : ni le collectif du mardi ni le versement du mardi n'existent encore.
    const s0 = syn(DELTA, OPS_DELTA, LUNDI, LUNDI, '2026-10-15');
    assert.strictEqual(s0.soldeFinPeriode.resteDuCentimes, 4000, 'aucun écart postérieur à la référence');
    assert.strictEqual(s0.soldeFinPeriode.nbOuverts, 1);
    etape('lundi Delta : solde −40 au 05/10, écart du 06/10 absent');

    // Semaine suivante : la contre-écriture et la restitution datées à leur jour.
    const s2 = syn(DELTA, OPS_DELTA, '2026-10-12', '2026-10-18', '2026-10-15');
    assert.strictEqual(s2.constates.manquesCentimes, 0);
    assert.strictEqual(s2.encaissements.annulationsVersementsCentimes, -500);
    assert.strictEqual(s2.encaissements.restitutionsCentimes, 800);
    assert.strictEqual(s2.encaissements.netCentimes, -1300);
    assert.ok(s2.encaissements.detail.every(d => d.ecartAnterieur));
    const h2 = R.renderSynthese(s2);
    assert.ok(h2.includes('Annulation de versement') && h2.includes('chèque rejeté'));
    etape('semaine suivante : annulation −5 et restitution 8 datées à leur jour, écarts antérieurs');

    // Vue hebdomadaire : le versement annulé a eu lieu dans sa semaine.
    const hebdo = R.vueHebdomadaire(R.construireReleve(DELTA, OPS_DELTA, { fuseau: FUSEAU }));
    const fdjS1 = hebdo.find(g => g.employeeId === 'e-delta' && g.periode === LUNDI);
    const fdjS2 = hebdo.find(g => g.employeeId === 'e-delta' && g.periode === '2026-10-12');
    assert.strictEqual(fdjS1.verseCentimes, 1500, 'l’histoire de la semaine 1 n’est pas réécrite');
    assert.strictEqual(fdjS2.verseCentimes, -500);
    etape('vue hebdomadaire : versement annulé compté dans sa semaine, contre-écriture dans la suivante');
  }

  // 5. Même vérité employé / manager : même fonction, même rendu des montants.
  {
    const tous = GAMMA.concat(DELTA);
    const opsTous = { versements: [V_JEUDI].concat(OPS_DELTA.versements), restitutions: OPS_DELTA.restitutions };
    // Le manager filtre sur l'employé ; l'employé ne reçoit que ses écarts et leurs opérations.
    const manager = syn(tous.filter(e => e.employeeId === 'e-gamma'), opsTous, LUNDI, DIMANCHE, '2026-10-09');
    const employe = syn(GAMMA, { versements: [V_JEUDI], restitutions: [] }, LUNDI, DIMANCHE, '2026-10-09');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(employe.constates)), JSON.parse(JSON.stringify(manager.constates)));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(employe.encaissements)), JSON.parse(JSON.stringify(manager.encaissements)));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(employe.soldeFinPeriode)), JSON.parse(JSON.stringify(manager.soldeFinPeriode)));
    const hm = R.renderSynthese(manager), he = R.renderSynthese(employe);
    for (const k of ['ecarts-manques', 'ecarts-excedents', 'regularisations', 'solde-fin'])
      assert.strictEqual(mesure(he, k), mesure(hm, k), `mesure ${k} identique`);
    assert.strictEqual(mesure(he, 'solde-fin'), '−20,00 €');
    etape('employé et manager : mêmes constats, encaissements et solde (−50 / +30 / −20)');
  }

  // 6. Garde-fous : pas de période inversée, pas de fuseau implicite, aucune déduction.
  {
    assert.throws(() => syn(GAMMA, OPS, DIMANCHE, LUNDI, '2026-10-09'), /Période inversée/);
    assert.throws(() => R.syntheseRegularisationsPeriode(GAMMA, OPS, { dateFin: LUNDI }), /Fuseau/);
    const h = R.renderSynthese(syn(GAMMA, OPS, LUNDI, DIMANCHE, '2026-10-09'));
    assert.ok(!/déduction|retenue|déduire/i.test(h.replace(/jamais déduit/g, '')), 'aucune déduction proposée');
    etape('garde-fous : période inversée et fuseau absent refusés ; aucune déduction');
  }
}

verifier(charger(SRC), true);

const MUTATIONS = [
  ['versements futurs dans le solde historique', "filter(op => garder(op, 'encaisse_le'))", 'filter(op => true)'],
  ['annulation postérieure antidatée', 'jourStation(op.annule_le, fuseau) > reference', "jourStation(op.annule_le, fuseau) > '9999'"],
  ['écart en attente dans le solde', "function estCloture(e) { return e.statut !== 'a_verifier'; }", 'function estCloture(e) { return true; }'],
  ['écarts futurs dans le solde', 'filter(e => e.date <= reference && estCloture(e))', 'filter(e => estCloture(e))'],
  ['trop-perçu compensé', 'if (l.soldeCentimes < 0) r.tropPercuCentimes += -l.soldeCentimes;', 'if (l.soldeCentimes < 0) r.resteDuCentimes += l.soldeCentimes;'],
  ['encaissements hors période', 'if (!dans(h.jour)) return;', 'if (false) return;'],
  ['écarts hors période', 'univers.filter(e => dans(e.date)).forEach', 'univers.forEach'],
  ['solde actuel confondu', 'au >= aujourdhui ? soldeFinPeriode', 'true ? soldeFinPeriode'],
  ['annulation ignorée dans le net', 'encaissements.versementsCentimes + encaissements.annulationsVersementsCentimes', 'encaissements.versementsCentimes + 0'],
  ['hebdo : versement annulé effacé', "if (h.nature === 'versement' || h.nature === 'annulation_versement') gOp.verseCentimes", "if (h.nature === 'versement' && !h.annule) gOp.verseCentimes"],
  ['solde affiché positif', 'const solde = r => (r.resteDuCentimes ? fmt(-r.resteDuCentimes)', 'const solde = r => (r.resteDuCentimes ? fmt(r.resteDuCentimes)'],
  ['solde actuel masqué', 'const actuelDiffere = a.reference !== f.reference', 'const actuelDiffere = false && a.reference !== f.reference'],
];
for (const [nom, de, vers] of MUTATIONS) {
  const i = SRC.indexOf(de);
  assert.ok(i !== -1 && SRC.indexOf(de, i + 1) === -1, `ancre de mutation non unique : ${nom}`);
  let rouge = false;
  const mute = charger(SRC.replace(de, vers));
  try { verifier(mute, false); } catch (e) { rouge = true; }
  assert.ok(rouge, `contre-témoin muet : ${nom}`);
}
ok(`${MUTATIONS.length} contre-témoins rougissent tous`);

// 7. Câblage dans l'écran manager (Analyse des écarts) : le vrai bloc
// « Régularisations » de la page est exécuté avec le vrai filtre de
// nexus-ecarts-donnees.js. Prouver la fonction ne prouve pas le câblage :
// c'est l'écran qui doit montrer −50 / +30 / −20.
const HTML = fs.readFileSync(path.join(DIR, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');
const SRC_DONNEES = fs.readFileSync(path.join(DIR, 'nexus-ecarts-donnees.js'), 'utf8');
const DEBUT_BLOC = '// --- Régularisations — relevé paie (B6, mandat consolidé §8) ---';
const FIN_BLOC = '// --- Fin régularisations ---';

// Le manager charge toutes les opérations du site, pas seulement celles de
// l'employé filtré : c'est la situation réelle de la page.
const OPS_SITE = { versements: [V_JEUDI].concat(OPS_DELTA.versements), restitutions: OPS_DELTA.restitutions };
const DEBUT_TITRE = '<div class="regul-releve-titre">';

function ecran(html, du, au) {
  const i = html.indexOf(DEBUT_BLOC), j = html.indexOf(FIN_BLOC);
  assert.ok(i !== -1 && j > i, 'bloc Régularisations introuvable dans la page');
  const zone = { innerHTML: '' };
  const sandbox = { console, Intl, Date, Math, Number, String, Object, Array, Promise, Error };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  vm.runInContext(SRC_DONNEES, sandbox);
  Object.assign(sandbox, {
    document: { getElementById: () => zone, querySelectorAll: () => [] },
    TOUTES_LES_LIGNES: GAMMA.concat(DELTA),
    litFiltresDepuisFormulaire: () => ({ dateDebut: du, dateFin: au, quart: '', activite: '', employeeId: 'e-gamma', signe: '', statut: '' }),
    NexusStation: {}, nexusClient: null, SITE_ACTUEL: 'site-fictif',
  });
  vm.runInContext(html.slice(i, j) + `
    FUSEAU_STATION = ${JSON.stringify(FUSEAU)};
    OPERATIONS_REGUL = ${JSON.stringify(OPS_SITE)};
    renderRegularisations(NexusEcartsDonnees.appliquerFiltresEcarts(TOUTES_LES_LIGNES, litFiltresDepuisFormulaire()));`, sandbox);
  return zone.innerHTML;
}

function verifierEcran(html, journal) {
  const lundi = ecran(html, LUNDI, LUNDI), jeudi = ecran(html, JEUDI, JEUDI), semaine = ecran(html, LUNDI, DIMANCHE);
  assert.deepStrictEqual([mesure(lundi, 'ecarts-manques'), mesure(lundi, 'regularisations'), mesure(lundi, 'solde-fin')],
    ['−50,00 €', '0,00 €', '−50,00 €'], 'écran, lundi seul');
  assert.deepStrictEqual([mesure(jeudi, 'ecarts-manques'), mesure(jeudi, 'regularisations'), mesure(jeudi, 'solde-fin')],
    ['0,00 €', '+30,00 €', '−20,00 €'], 'écran, jeudi seul : aucun écart artificiel');
  assert.ok(/antérieur à la période/.test(jeudi), 'écran, jeudi : le versement désigne son écart du lundi');
  assert.deepStrictEqual([mesure(semaine, 'ecarts-manques'), mesure(semaine, 'regularisations'), mesure(semaine, 'solde-fin')],
    ['−50,00 €', '+30,00 €', '−20,00 €'], 'écran, semaine');
  assert.ok(semaine.indexOf('regul-synthese') < semaine.indexOf('État actuel par écart'), 'la synthèse précède le relevé par écart');
  // Même vérité : la synthèse de l'écran manager filtré sur Gamma est, au
  // caractère près, celle que l'employé obtient avec ses seuls écarts et
  // leurs seules opérations. Aucun bandeau ne doit naître des opérations
  // des autres employés du site.
  for (const [du, au, h] of [[LUNDI, LUNDI, lundi], [JEUDI, JEUDI, jeudi], [LUNDI, DIMANCHE, semaine]]) {
    const R = vm.runInContext('NexusPayeRegularisations', (() => { const c = { console, Intl, Date, Math, Number, String, Object, Array, Error }; c.window = c; vm.createContext(c); vm.runInContext(SRC, c); return c; })());
    const employe = R.renderSynthese(R.syntheseRegularisationsPeriode(GAMMA,
      { versements: [V_JEUDI], restitutions: [] }, { fuseau: FUSEAU, dateDebut: du, dateFin: au }),
      { nomEmploye: id => (id === 'e-gamma' ? 'Gamma Fictif' : null) });
    const k = h.indexOf(DEBUT_TITRE);
    assert.ok(k > 0, 'titre du relevé introuvable');
    assert.strictEqual(h.slice(0, k), employe, `écran manager filtré ≠ vue employé (${du} → ${au})`);
    assert.ok(!/hors de la sélection/.test(h.slice(0, k)), 'bandeau parasite dans la synthèse');
  }
  // Lecture seule : aucune écriture dans le bloc de la page.
  const bloc = html.slice(html.indexOf(DEBUT_BLOC), html.indexOf(FIN_BLOC));
  assert.ok(!/\.(insert|update|upsert|delete)\(|\.rpc\(/.test(bloc), 'aucune écriture dans la section Régularisations');
  if (journal) ok('écran manager exécuté : lundi −50/0/−50, jeudi 0/+30/−20, semaine −50/+30/−20, identique à la vue employé, sans écriture');
}
verifierEcran(HTML, true);

const MUTATIONS_ECRAN = [
  ['univers filtré par les dates', "Object.assign({}, f, { dateDebut: '', dateFin: '' })", 'f'],
  ['synthèse non affichée', 'zone.innerHTML = synthese + titre + html;', 'zone.innerHTML = titre + html;'],
  ['opérations du site non restreintes à la sélection', 'NexusPayeRegularisations.operationsDeLUnivers(univers, OPERATIONS_REGUL)', 'OPERATIONS_REGUL'],
  ['fin de période ignorée', 'dateDebut: f.dateDebut, dateFin: f.dateFin }', 'dateDebut: f.dateDebut }'],
];
for (const [nom, de, vers] of MUTATIONS_ECRAN) {
  const i = HTML.indexOf(de);
  assert.ok(i !== -1 && HTML.indexOf(de, i + 1) === -1, `ancre de mutation non unique : ${nom}`);
  let rouge = false;
  try { verifierEcran(HTML.replace(de, vers), false); } catch (e) { rouge = true; }
  assert.ok(rouge, `contre-témoin muet (écran) : ${nom}`);
}
ok(`${MUTATIONS_ECRAN.length} contre-témoins de câblage rougissent tous`);

console.log(`\n${n} vérifications — synthèse de période des régularisations conforme.`);
