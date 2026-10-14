// NEXUS Paye et Analyse des écarts disent le même montant (15/10/2026).
// Le KPI « Solde des écarts de caisse » de Paye (−431,56 €) était le reste à régulariser
// CUMULÉ depuis l'origine, arrêté au dernier jour du mois : un stock, pas le mois.
// Désormais Paye lit les mêmes fonctions qu'Analyse (indicateursPeriode =
// appliquerFiltresEcarts + calculerKpisEcarts) sur le mois civil de la station.
const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
const D = __dirname;
let n = 0; const ok = (c, m) => { assert.ok(c, 'ÉCHEC : ' + m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, 'ÉCHEC : ' + m + ` (obtenu ${a}, attendu ${b})`); n++; };

const sb = { console, Intl, Date, Math, Number, String, Object, Array, Promise, Error, Set, Map, JSON };
sb.window = sb; vm.createContext(sb);
for (const f of ['nexus-ecarts-moteur.js', 'nexus-ecarts-donnees.js', 'nexus-paye-regularisations.js'])
  vm.runInContext(fs.readFileSync(path.join(D, f), 'utf8'), sb, { filename: f });
const E = sb.NexusEcartsDonnees, R = sb.NexusPayeRegularisations, M = sb.NexusEcartsMoteur;
const FUSEAU = 'America/Martinique';

const L = (id, date, ecart, statut, emp = 'e1') => ({ id, sourceModule: 'verify', date, quart: '1', activite: 'piste',
  employeeId: emp, employeeNom: 'Fictif ' + emp, ecartInitial: ecart, ecartFinal: ecart, causeCode: 'a_etablir', statut });
const UNIVERS = [
  L('verify-sep-30', '2026-09-30', -300, 'cloture_non_explique'),       // veille du mois
  L('verify-oct-01', '2026-10-01', -100, 'cloture_non_explique'),       // 1er octobre
  L('verify-oct-20', '2026-10-20', -44.13, 'cloture_non_explique', 'e2'),
  L('fdj-oct-22', '2026-10-22', -0.80, 'a_verifier', 'e2'),             // non validé
  L('verify-oct-31', '2026-10-31', 69.12, 'cloture_non_explique'),      // excédent, dernier jour
  L('verify-nov-01', '2026-11-01', -7, 'cloture_non_explique'),         // lendemain
  L('verify-dec-31', '2026-12-31', -10, 'cloture_non_explique'),        // changement d'année
  L('verify-jan-01', '2027-01-01', -20, 'cloture_non_explique'),
];
// Versement de 50 € le 2 novembre sur l'écart du 1er octobre.
const OPS = { versements: [{ id: 'v1', module_origine: 'verify', audit_id: 'oct-01', caisse_origine: 'piste', employee_id: 'e1',
  montant: 50, mode_encaissement: 'especes', destination: 'tiroir_verify_piste', encaisse_le: '2026-11-02T15:00:00Z', auteur_id: 'm' }], restitutions: [] };
UNIVERS[1].id = 'verify-oct-01-piste'; OPS.versements[0].audit_id = 'oct-01';

// 1. Bornes civiles, indépendantes de l'appareil.
const b = m => E.bornesDuMois(m);
eq(b('2026-10-01').dateFin, '2026-10-31', 'octobre'); eq(b('2026-09-15').dateDebut, '2026-09-01', 'mois pris au 1er');
eq(b('2026-09-01').dateFin, '2026-09-30', 'septembre'); eq(b('2026-12-01').dateFin, '2026-12-31', 'décembre');
eq(b('2028-02-01').dateFin, '2028-02-29', 'février bissextile'); eq(b('2027-02-01').dateFin, '2027-02-28', 'février');
assert.throws(() => E.bornesDuMois(''), /AAAA-MM/); n++;
eq(E.jourDeLaStation('2026-11-01T02:00:00Z', FUSEAU), '2026-10-31', '02:00Z le 1er novembre = encore le 31 octobre à la Martinique');

// 2. Octobre : manques validés, solde, non validés — et les mêmes que la voie d'Analyse.
const oct = E.indicateursPeriode(UNIVERS, b('2026-10-01'));
eq(oct.manquesValides, -144.13, 'octobre : manques validés');
eq(oct.soldeOperationnel, -75.81, 'octobre : solde opérationnel');
eq(oct.nonValides.montant, -0.80, 'octobre : non validés'); eq(oct.nonValides.nb, 1, 'octobre : 1 écart non validé');
const voieAnalyse = M.calculerKpisEcarts(E.appliquerFiltresEcarts(UNIVERS, { dateDebut: '2026-10-01', dateFin: '2026-10-31' }));
eq(oct.manquesValides, voieAnalyse.montantRetenu, 'Paye = Analyse (manques validés)');
eq(oct.soldeOperationnel, voieAnalyse.soldeOperationnel, 'Paye = Analyse (solde opérationnel)');
eq(E.manquesNonValides(E.appliquerFiltresEcarts(UNIVERS, b('2026-10-01'))).montant, oct.nonValides.montant, 'non validés : fonction unique');

// 3. Septembre, novembre, changement d'année : chaque mois ne voit que lui.
eq(E.indicateursPeriode(UNIVERS, b('2026-09-01')).manquesValides, -300, 'septembre');
eq(E.indicateursPeriode(UNIVERS, b('2026-11-01')).manquesValides, -7, 'novembre');
eq(E.indicateursPeriode(UNIVERS, b('2026-12-01')).manquesValides, -10, 'décembre 2026');
eq(E.indicateursPeriode(UNIVERS, b('2027-01-01')).manquesValides, -20, 'janvier 2027 (changement d\'année)');

// 4. Le cumul n'est PAS le mois : l'ancien KPI de Paye additionnait tout l'historique jusqu'au 31/10.
const opt = { fuseau: FUSEAU, dateDebut: '2026-10-01', dateFin: '2026-10-31' };
const syn = R.syntheseRegularisationsPeriode(UNIVERS, R.operationsDeLUnivers(UNIVERS, OPS), opt);
eq(syn.soldeFinPeriode.resteDuCentimes, 30000 + 10000 + 4413 - 0, 'reste à fin octobre = septembre + octobre validés (cumul)');
ok(-syn.soldeFinPeriode.resteDuCentimes / 100 !== oct.manquesValides, 'le cumul n\'est pas la valeur du mois');

// 5. Une régularisation entre deux mois ne change jamais les manques validés du mois constaté.
eq(syn.encaissements.netCentimes, 0, 'octobre : rien encaissé (versement du 2 novembre)');
const synNov = R.syntheseRegularisationsPeriode(UNIVERS, R.operationsDeLUnivers(UNIVERS, OPS), { fuseau: FUSEAU, dateDebut: '2026-11-01', dateFin: '2026-11-30' });
eq(synNov.encaissements.netCentimes, 5000, 'novembre : 50 € encaissés, au jour de l\'encaissement');
eq(synNov.soldeFinPeriode.resteDuCentimes, syn.soldeFinPeriode.resteDuCentimes + 700 - 5000, 'reste fin novembre = octobre + manque de novembre − versement');
eq(E.indicateursPeriode(UNIVERS, b('2026-10-01')).manquesValides, -144.13, 'octobre inchangé après le versement de novembre');

// 6. Câblage statique : Paye et Analyse lisent la même fonction, plus de reste cumulé en KPI.
const paye = fs.readFileSync(path.join(D, 'NEXUS-Paye-v1.html'), 'utf8');
const analyse = fs.readFileSync(path.join(D, 'NEXUS-Analyse-Ecarts-v1.html'), 'utf8');
ok(/NexusEcartsDonnees\.indicateursPeriode\(univers,\{dateDebut:opt\.dateDebut,dateFin:opt\.dateFin\}\)/.test(paye), 'Paye appelle indicateursPeriode sur le mois');
ok(/NexusEcartsDonnees\.manquesNonValides\(lignes\)/.test(analyse), 'Analyse appelle la même fonction pour les non validés');
const kpi = paye.slice(paye.indexOf('data-kpi="ecarts"'), paye.indexOf('data-kpi="ecarts"') + 700);
ok(/Manques validés du mois/.test(kpi) && /REGUL\.indic\.manquesValides/.test(kpi), 'KPI Paye = manques validés du mois');
ok(!/soldeFinPeriode/.test(kpi) && !/Solde des écarts de caisse/.test(paye), 'plus de reste cumulé en KPI ni de libellé ambigu');
ok(/Solde opérationnel du mois/.test(paye) && /Reste à régulariser au/.test(paye) && /Régularisations réellement encaissées ce mois/.test(paye), 'trois lectures distinctes');
ok(/id="lienAnalyseEcarts"/.test(paye) && /periode:'perso',date_debut:MOIS,date_fin:dernierJourMois\(\)/.test(paye) && /p\.set\('employe',SELECTION\)/.test(paye), 'lien de détail : mois et salarié conservés');
ok(/indicateursEcarts:\['Manques validés et solde opérationnel'/.test(paye) && /info-btn" data-info="\$\{cle\}"/.test(paye) && /infoBtn\('indicateursEcarts'/.test(paye), 'bulle (i) explicative');
ok(!/toISOString\(\)\.slice\(0,10\)\}\s*\nfunction etatPeriode/.test(paye) && /function dernierJourMois\(\)\{return NexusEcartsDonnees\.bornesDuMois\(MOIS\)\.dateFin\}/.test(paye), 'fin de mois sans Date locale');
ok(/MOIS = NexusEcartsDonnees\.bornesDuMois\(NexusEcartsDonnees\.jourDeLaStation\(new Date\(\)\)\)\.dateDebut/.test(paye), 'mois courant = jour de la station');
console.log(n + ' vérifications OK');
