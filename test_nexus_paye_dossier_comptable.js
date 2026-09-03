// NEXUS PAYE — recette du dossier comptable sur AOÛT 2026 (03/09/2026).
//
// Mois de référence demandé par Frédéric : NEXUS doit retrouver, salarié
// par salarié, les variables réellement communiquées à la comptable —
// présence, absences, congés, maladie/maternité, retards, heures
// supplémentaires, jours fériés, éléments financiers — et rien d'autre.
//
// Ce test verrouille trois choses :
//   1. un événement RH reste UN événement (une ligne, ses jours couverts),
//      quelle que soit sa durée et même s'il déborde du mois ;
//   2. les variables agrégées de la carte salarié et celles du dossier
//      comptable PDF sont le MÊME calcul (Article 11) ;
//   3. le statut d'un salarié — Prêt / À vérifier / Donnée manquante —
//      et, par conséquent, celui du mois.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
const M = ctx.NexusPayeMoteur;

const PERIODE = '2026-08-01';
const SITE = 'vito-sainte-marie';

const CAMILLE = { id: 'e-camille', nom: 'Camille', role: 'pompiste', actif: true };
const VANESSA = { id: 'e-vanessa', nom: 'Vanessa Ribe', role: 'caissier', actif: true };
const RUDDY = { id: 'e-ruddy', nom: 'Ruddy', role: 'pompiste', actif: true };
const ANGELIQUE = { id: 'e-angelique', nom: 'Angélique', role: 'renfort', actif: true };

// Camille : cinq jours travaillés du lundi 03 au vendredi 07 août, plus le
// samedi 15 août (férié). Un retard de 12 min le mardi 04.
const JOURS_CAMILLE = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-15'];

const PLANNING = JOURS_CAMILLE.map(date => ({
  employee_id: CAMILLE.id, date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste',
}));

const POINTAGES = JOURS_CAMILLE.map(date => ({
  employee_id: CAMILLE.id, date, type: 'arrivee', retard_min: date === '2026-08-04' ? 12 : 0,
}));

// Vanessa : congé maternité déclaré une seule fois, du 21/07/2026 au
// 03/01/2027, qualifié et confirmé par le manager en juillet.
const MATERNITE = {
  id: 'ind-vanessa', employee_id: VANESSA.id, site_id: SITE,
  date_debut: '2026-07-21', date_fin: '2027-01-03', type: 'indisponible',
  motif: 'conge_maternite', confirme_le: '2026-07-21T09:00:00Z',
};

// Ruddy : cinq jours de congés payés déclarés et qualifiés en août.
const CONGES_RUDDY = {
  id: 'ind-ruddy', employee_id: RUDDY.id, site_id: SITE,
  date_debut: '2026-08-10', date_fin: '2026-08-14', type: 'conge',
  motif: 'conge', confirme_le: '2026-08-01T09:00:00Z',
};

// Arbitrages déjà rendus par le manager sur le mois de Camille.
const ARBITRAGES = [
  { id: 'a1', employee_id: CAMILLE.id, periode: PERIODE, origine: 'pointage', source_cle: `retard:${CAMILLE.id}:2026-08-04`, type_item: 'retard', statut: 'valide', impact_paye: true, quantite_minutes: 12 },
  { id: 'a2', employee_id: CAMILLE.id, periode: PERIODE, origine: 'planning', source_cle: `heure-supp:${CAMILLE.id}:2026-08-06`, type_item: 'heure_supplementaire', statut: 'valide', impact_paye: true, quantite_minutes: 60 },
  { id: 'a3', employee_id: CAMILLE.id, periode: PERIODE, origine: 'planning', source_cle: `heure-supp:${CAMILLE.id}:2026-08-07`, type_item: 'heure_supplementaire', statut: 'valide', impact_paye: true, quantite_minutes: 60 },
  { id: 'a4', employee_id: CAMILLE.id, periode: PERIODE, origine: 'planning', source_cle: `heure-supp:${CAMILLE.id}:2026-08-15`, type_item: 'heure_supplementaire', statut: 'valide', impact_paye: true, quantite_minutes: 60 },
  { id: 'a5', employee_id: CAMILLE.id, periode: PERIODE, origine: 'verify', source_cle: `jour-ferie:${CAMILLE.id}:2026-08-15`, type_item: 'jour_ferie', statut: 'valide', impact_paye: true },
  // Acompte de 50 € saisi à la main : c'est bien une variable du mois,
  // datée, et non un événement RH.
  { id: 'a6', employee_id: CAMILLE.id, periode: PERIODE, origine: 'manuel', source_cle: 'manuel:g1:2026-08-20', type_item: 'acompte', date_evenement: '2026-08-20', libelle: 'Acompte de 50 €', statut: 'valide', impact_paye: true, montant_centimes: 5000 },
];

const REGLAGES = [
  { employee_id: CAMILLE.id, inclus_paye: true, mode_presence: 'automatique' },
  { employee_id: VANESSA.id, inclus_paye: true, mode_presence: 'automatique' },
  { employee_id: RUDDY.id, inclus_paye: true, mode_presence: 'automatique' },
  // Angélique : rattachement jamais confirmé — c'est une donnée manquante,
  // pas un salarié prêt.
];

function rapport(extra) {
  return M.construireRapport(Object.assign({
    periode: PERIODE,
    employees: [CAMILLE, VANESSA, RUDDY, ANGELIQUE],
    settings: REGLAGES,
    planning: PLANNING,
    pointages: POINTAGES,
    indisponibilites: [MATERNITE, CONGES_RUDDY],
    audits: [], ecarts: [],
    items: ARBITRAGES,
    config: { jours_feries: ['2026-08-15'] },
  }, extra || {}));
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const R = rapport();
const D = M.dossierComptable(R, { genereLe: '2026-09-03T08:00:00Z' });
const parNom = nom => D.salaries.find(s => s.nom === nom);

// ── 1. Un événement RH reste un événement ────────────────────────────────
const itemsVanessa = R.items.filter(i => i.employeeId === VANESSA.id);
verifier('le congé maternité de Vanessa produit UNE seule ligne en août',
  itemsVanessa.filter(i => i.evenementRH).length === 1);
verifier('cette ligne couvre les 31 jours d’août, pas 31 lignes',
  itemsVanessa[0].joursMois === 31);
verifier('elle est bornée au mois affiché (01/08 → 31/08)',
  itemsVanessa[0].date === '2026-08-01' && itemsVanessa[0].dateFin === '2026-08-31');
verifier('elle porte son motif seul, pour un affichage en trois lignes',
  itemsVanessa[0].motifLibelle === 'Congé maternité');
verifier('elle garde la période réelle de l’événement, qui déborde du mois',
  itemsVanessa[0].evenementDebut === '2026-07-21' && itemsVanessa[0].evenementFin === '2027-01-03');
verifier('qualifiée, elle est une information — plus jamais un arbitrage',
  itemsVanessa[0].statut === 'information');

// ── 2. Les variables comptables d’août, salarié par salarié ──────────────
const camille = parNom('Camille');
verifier('Camille : 6 jours de présence confirmés',
  camille.variables.presence.jours === 6);
verifier('Camille : 42 h confirmées (6 × 7 h au planning)',
  camille.variables.presence.heures === 42);
verifier('Camille : 12 minutes de retard, sur une seule journée',
  camille.variables.retards.minutes === 12 && camille.variables.retards.occurrences === 1);
verifier('Camille : 3 h supplémentaires (jeudi, vendredi, samedi)',
  camille.variables.heuresSupplementaires.heures === 3);
verifier('Camille : 1 jour férié travaillé',
  camille.variables.joursFeries.jours === 1);
verifier('Camille : acompte de 50 € porté en éléments financiers',
  camille.variables.financier.acompteCentimes === 5000);
verifier('Camille : aucune absence ni congé',
  camille.variables.absence.jours === 0 && camille.variables.congesPayes.jours === 0);

const vanessa = parNom('Vanessa Ribe');
verifier('Vanessa : 31 jours de maladie/maternité, en un seul événement',
  vanessa.variables.maladieMaternite.jours === 31 && vanessa.variables.maladieMaternite.evenements === 1);
verifier('Vanessa : ces jours ne sont pas comptés comme des congés payés',
  vanessa.variables.congesPayes.jours === 0);

const ruddy = parNom('Ruddy');
verifier('Ruddy : 5 jours de congés payés',
  ruddy.variables.congesPayes.jours === 5);
verifier('Ruddy : ses congés ne sont pas comptés en maladie',
  ruddy.variables.maladieMaternite.jours === 0);

// ── 3. Statuts salarié et statut du mois ─────────────────────────────────
verifier('Camille est prête : tout est arbitré', camille.statut === 'pret');
verifier('Vanessa est prête : son événement est qualifié', vanessa.statut === 'pret');
verifier('Ruddy est prêt : ses congés sont qualifiés', ruddy.statut === 'pret');
verifier('Angélique, jamais rattachée, est une donnée manquante',
  R.employes.find(f => f.employee.id === ANGELIQUE.id).statut === 'donnee_manquante');
verifier('le mois n’est pas prêt tant qu’un salarié ne l’est pas',
  R.synthese.statutMois === 'donnee_manquante');

const avecRetardNonArbitre = M.dossierComptable(rapport({ items: ARBITRAGES.filter(a => a.id !== 'a1') }));
verifier('un retard non arbitré fait passer le salarié « à vérifier »',
  avecRetardNonArbitre.salaries.find(s => s.nom === 'Camille').statut === 'a_verifier');
verifier('et ce retard n’est PAS compté dans les variables transmises',
  avecRetardNonArbitre.salaries.find(s => s.nom === 'Camille').variables.retards.minutes === 0
  && avecRetardNonArbitre.salaries.find(s => s.nom === 'Camille').variables.retards.enAttente === 1);

// ── 4. La synthèse mensuelle est la somme exacte des fiches ──────────────
// Angélique est « renfort » : NEXUS la PROPOSE d'office en paie, mais tant
// que personne n'a confirmé son rattachement elle figure au dossier avec
// le statut « donnée manquante » — la comptable doit la voir, pas la
// découvrir absente.
verifier('synthèse : 4 salariés au dossier, dont un rattachement à confirmer',
  D.synthese.salaries === 4 && D.synthese.donneeManquante === 1);
verifier('Angélique apparaît bien au dossier, en donnée manquante',
  parNom('Angélique') && parNom('Angélique').statut === 'donnee_manquante');
verifier('synthèse : 3 salariés prêts', D.synthese.prets === 3);
verifier('synthèse : 42 h confirmées sur le mois', D.synthese.heuresConfirmees === 42);
verifier('synthèse : 5 jours de congés payés', D.synthese.joursCongesPayes === 5);
verifier('synthèse : 31 jours de maladie/maternité', D.synthese.joursMaladieMaternite === 31);
verifier('synthèse : 12 minutes de retard cumulées', D.synthese.retardsMinutes === 12);
verifier('synthèse : 3 h supplémentaires', D.synthese.heuresSupplementaires === 3);
verifier('synthèse : 50 € d’acompte', D.synthese.acompteCentimes === 5000);
verifier('synthèse : une fiche par salarié, triée par nom',
  D.salaries.length === 4
  && D.salaries.findIndex(s => s.nom === 'Camille') < D.salaries.findIndex(s => s.nom === 'Ruddy')
  && D.salaries.findIndex(s => s.nom === 'Ruddy') < D.salaries.findIndex(s => s.nom === 'Vanessa Ribe'));

// ── 5. Aucun jour férié ni congé ne devient une retenue automatique ──────
verifier('aucun montant n’est produit sans décision explicite',
  D.synthese.retenueEcartCentimes === 0 && D.synthese.detteCentimes === 0);

console.log(`\nNEXUS PAYE — dossier comptable août 2026 : ${ok}/${ok} vérifications passent.`);
