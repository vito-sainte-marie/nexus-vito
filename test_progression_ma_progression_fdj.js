// Test — "Ma Progression" multi-activité Boutique/Piste/FDJ (16/08/2026,
// demande de Frédéric : intégrer les écarts et l'historique FDJ dans "Ma
// Progression", avec 3 niveaux de lecture : mini-cartes par activité, KPI
// mensuels combinés, historique unifié filtrable — une ligne d'historique
// = une activité = un statut = un montant, jamais deux activités mélangées).
//
// nexus-progression.js est un IIFE écrit pour le navigateur
// (`(function (global) {...})(window)`) — on stub `window` avant de le
// requérir, comme documenté dans le fichier lui-même.

global.window = global;
require('/sessions/dazzling-compassionate-ride/mnt/image nexus project/nexus-progression.js');
const assert = require('assert');
const N = global.NexusProgression;

// ------------------------------------------------------------
// 1) construireServicesCaisseFdj — reconstruction depuis fdj_shifts +
//    fdj_cash_controls(*) (forme PostgREST identique à
//    NEXUS-FDJ-Manager-v1.html::chargerShiftsAvecCaisse).
// ------------------------------------------------------------
const rowsFdj = [
  // Quart transmis, caisse validée conforme par le manager.
  { id: 's1', date: '2026-08-04', quart: '1', statut: 'valide',
    fdj_cash_controls: { statut: 'conforme', caisse_attendue: 320, caisse_reelle: 320, caisse_reelle_origine: 320, ecart: 0, ecart_origine: 0, motif_ecart: null, valide_le: '2026-08-05T10:00:00Z' } },
  // Quart transmis, écart validé "valide_avec_ecart", régularisé par le
  // manager (caisse_reelle_origine différent de caisse_reelle courant).
  { id: 's2', date: '2026-08-11', quart: '1', statut: 'valide',
    fdj_cash_controls: { statut: 'valide_avec_ecart', caisse_attendue: 300, caisse_reelle: 301, caisse_reelle_origine: 300, ecart: 1, ecart_origine: 0, motif_ecart: 'erreur_comptage', valide_le: '2026-08-12T09:00:00Z' } },
  // Quart transmis, caisse encore provisoire (pas de statut manager posé).
  { id: 's3', date: '2026-08-13', quart: '2', statut: 'valide',
    fdj_cash_controls: { statut: 'provisoire', caisse_attendue: 250, caisse_reelle: 248, caisse_reelle_origine: 248, ecart: -2, ecart_origine: -2, motif_ecart: null, valide_le: null } },
  // Quart transmis mais SANS caisse enregistrée du tout — ne doit produire
  // AUCUN service (rien à montrer tant que rien n'a été transmis).
  { id: 's4', date: '2026-08-14', quart: '1', statut: 'valide', fdj_cash_controls: null },
  // Forme "tableau" (PostgREST peut renvoyer un tableau selon le contexte)
  // — doit être gérée avec la même robustesse que côté Manager.
  { id: 's5', date: '2026-08-01', quart: '2', statut: 'valide',
    fdj_cash_controls: [{ statut: 'conforme', caisse_attendue: 200, caisse_reelle: 200, caisse_reelle_origine: 200, ecart: 0, ecart_origine: 0, motif_ecart: null, valide_le: '2026-08-02T08:00:00Z' }] },
  // 20/08/2026, cahier "FDJ - Audit de consolidation", FDJ-26 : un quart
  // "Laissé en brouillon" (NEXUS-FDJ-v1.html) peut désormais porter une
  // vraie ligne fdj_cash_controls (statut 'provisoire', identique à une
  // caisse transmise et pas encore contrôlée) SANS que le quart lui-même
  // soit transmis (fdj_shifts.statut reste 'brouillon'). Ce quart ne doit
  // produire AUCUN service — ni dans Ma Progression, ni dans ses cumuls —
  // tant qu'il n'est pas réellement validé par l'employé.
  { id: 's6', date: '2026-08-15', quart: '1', statut: 'brouillon',
    fdj_cash_controls: { statut: 'provisoire', caisse_attendue: 180, caisse_reelle: 175, caisse_reelle_origine: 175, ecart: -5, ecart_origine: -5, motif_ecart: null, valide_le: null } },
];
const servicesFdj = N.construireServicesCaisseFdj(rowsFdj);
assert.strictEqual(servicesFdj.length, 4, 'Le quart sans caisse (s4) et le brouillon avec caisse (s6) ne doivent produire aucun service FDJ');
assert.ok(servicesFdj.every(s => s.id !== 's4'), 's4 absent des services FDJ');
assert.ok(servicesFdj.every(s => s.id !== 's6'), 's6 (brouillon avec caisse réelle enregistrée) absent des services FDJ — FDJ-26');
console.log('OK — construireServicesCaisseFdj ignore les quarts sans caisse et gère objet/tableau PostgREST.');
console.log('OK — construireServicesCaisseFdj exclut un brouillon même quand sa caisse a déjà été enregistrée (FDJ-26).');

// ------------------------------------------------------------
// 2) statutCaisseJourFdj — vocabulaire à 3 niveaux, identique à Boutique/Piste.
// ------------------------------------------------------------
assert.strictEqual(N.statutCaisseJourFdj({ statutCash: null }), 'provisoire');
assert.strictEqual(N.statutCaisseJourFdj({ statutCash: 'provisoire' }), 'provisoire');
assert.strictEqual(N.statutCaisseJourFdj({ statutCash: 'conforme' }), 'validee_conforme');
['a_controler', 'en_attente', 'expliquee', 'regularise', 'valide_avec_ecart'].forEach(s => {
  assert.strictEqual(N.statutCaisseJourFdj({ statutCash: s }), 'validee_ecart', `${s} doit être classé validee_ecart`);
});
console.log('OK — statutCaisseJourFdj ramène les 7 statuts manager FDJ au même vocabulaire à 3 niveaux que Verify.');

// ------------------------------------------------------------
// 3) construireHistoriqueUnifie — une ligne par activité réellement tenue,
//    jamais deux activités mélangées dans une même ligne. Un même service
//    Verify où l'employé tient piste ET boutique produit 2 lignes.
// ------------------------------------------------------------
const rowsAudits = [
  // Poste piste ET boutique tenus en solo le même quart : 2 lignes attendues.
  { id: 'a1', date: '2026-08-04', quart: '1', ecart_piste: 0.5, ecart_boutique: -3,
    employes_piste: ['emp1'], employes_boutique: ['emp1'],
    valide_le: '2026-08-05T10:00:00Z', ecart_piste_valide: 0.5, ecart_boutique_valide: -3, commentaire_validation: null },
  // Poste boutique partagé (2 employés) : pas de montant attribuable, mais
  // la ligne doit quand même apparaître (transparence).
  { id: 'a2', date: '2026-08-06', quart: '2', ecart_piste: null, ecart_boutique: -10,
    employes_piste: [], employes_boutique: ['emp1', 'emp2'],
    valide_le: '2026-08-07T10:00:00Z', ecart_piste_valide: null, ecart_boutique_valide: null, commentaire_validation: null },
];
const services = N.construireServicesCaisse(rowsAudits, 'emp1');
const lignes = N.construireHistoriqueUnifie(services, servicesFdj);

const lignesA1 = lignes.filter(l => l.date === '2026-08-04' && l.activite !== 'fdj');
assert.strictEqual(lignesA1.length, 2, 'a1 doit produire 2 lignes (piste + boutique), jamais une ligne combinée');
const lignePisteA1 = lignesA1.find(l => l.activite === 'piste');
const ligneBoutiqueA1 = lignesA1.find(l => l.activite === 'boutique');
assert.strictEqual(lignePisteA1.statut, 'validee_conforme', 'écart piste 0,50€ solo -> conforme (seuil 2€)');
assert.strictEqual(lignePisteA1.montant, 0.5);
assert.strictEqual(ligneBoutiqueA1.statut, 'validee_ecart', 'écart boutique -3€ solo -> validee_ecart');
assert.strictEqual(ligneBoutiqueA1.montant, -3);
console.log('OK — un même quart Verify avec piste ET boutique produit 2 lignes indépendantes, chacune avec son propre statut/montant.');

const ligneA2 = lignes.find(l => l.date === '2026-08-06');
assert.strictEqual(ligneA2.activite, 'boutique');
assert.strictEqual(ligneA2.attribuable, false, 'poste partagé -> non attribuable');
assert.strictEqual(ligneA2.montant, null, 'aucun montant individuel sur un poste partagé');
assert.strictEqual(ligneA2.statut, 'validee_conforme', 'poste partagé jamais qualifié "écart" pour un individu précis');
console.log('OK — poste partagé : ligne visible (transparence), sans montant individuel, jamais qualifiée "écart".');

const lignesFdjUnifiees = lignes.filter(l => l.activite === 'fdj');
assert.strictEqual(lignesFdjUnifiees.length, 4, 'les 4 services FDJ construits doivent apparaître comme lignes fdj');
const ligneFdjProvisoire = lignesFdjUnifiees.find(l => l.date === '2026-08-13');
assert.strictEqual(ligneFdjProvisoire.statut, 'provisoire');
assert.strictEqual(ligneFdjProvisoire.montant, -2, 'ligne FDJ provisoire affiche le montant constaté à la clôture (ecart_origine)');
const ligneFdjRegularisee = lignesFdjUnifiees.find(l => l.date === '2026-08-11');
assert.strictEqual(ligneFdjRegularisee.statut, 'validee_ecart');
assert.strictEqual(ligneFdjRegularisee.montant, 1, 'ligne FDJ validée affiche le montant courant (ecart), pas ecart_origine');
console.log('OK — lignes FDJ : montant provisoire = constat de clôture, montant validé = valeur courante (post-régularisation éventuelle).');

// Tri chronologique décroissant, toutes activités mélangées.
for (let i = 1; i < lignes.length; i++) {
  assert.ok(lignes[i - 1].date >= lignes[i].date, 'Historique unifié trié du plus récent au plus ancien');
}
console.log('OK — historique unifié trié du plus récent au plus ancien, toutes activités confondues.');

// ------------------------------------------------------------
// 4) syntheseActivite — mini-cartes Niveau 1 (règle non négociable :
//    seuls les montants VALIDÉS entrent dans le cumul).
// ------------------------------------------------------------
const lignesFdjAout = lignes.filter(l => l.activite === 'fdj' && l.date.slice(0, 7) === '2026-08');
const synthFdj = N.syntheseActivite(lignesFdjAout, '2026-08');
assert.strictEqual(synthFdj.nbControles, 4);
assert.strictEqual(synthFdj.conformes, 2, 's1 et s5 conformes');
assert.strictEqual(synthFdj.aRegulariser, 1, 's2 validée avec écart');
// Cumul validé = 0 (s1) + 1 (s2) + 0 (s5) = 1 ; s3 (provisoire) exclu.
assert.strictEqual(Math.round(synthFdj.cumulValide * 100) / 100, 1, 'le cumul ne doit jamais inclure le montant provisoire de s3');
console.log('OK — syntheseActivite (FDJ) : cumul validé exclut strictement les montants encore provisoires.');

// ------------------------------------------------------------
// 5) syntheseCombinee + tendanceMoisCaisse — Niveau 2, forme de sortie
//    compatible avec agregerMoisCaisse pour réutiliser tendanceMoisCaisse
//    sans dupliquer le calcul de tendance.
// ------------------------------------------------------------
const combActuel = N.syntheseCombinee(lignes, '2026-08');
const combPrecedent = N.syntheseCombinee(lignes, '2026-07');
assert.strictEqual(combPrecedent.caissesControlees, 0, 'aucune donnée en juillet dans ce jeu de test');
const tendance = N.tendanceMoisCaisse(combActuel, combPrecedent);
assert.strictEqual(tendance, null, 'tendanceMoisCaisse renvoie null si le mois précédent est vide (jamais une comparaison contre zéro)');
console.log('OK — syntheseCombinee produit une forme réutilisable telle quelle par tendanceMoisCaisse (aucun second calcul de tendance).');

// ------------------------------------------------------------
// 6) serieValideeConformeUnifiee — validations conformes consécutives,
//    toutes activités confondues, ignore les lignes encore provisoires.
// ------------------------------------------------------------
const lignesSimples = [
  { date: '2026-08-01', quart: '1', statut: 'validee_conforme' },
  { date: '2026-08-02', quart: '1', statut: 'validee_conforme' },
  { date: '2026-08-03', quart: '1', statut: 'provisoire' }, // ignorée, ni comptée ni interruptrice
  { date: '2026-08-04', quart: '1', statut: 'validee_conforme' },
];
const serie = N.serieValideeConformeUnifiee(lignesSimples);
assert.strictEqual(serie.enCours, 3, 'les 3 lignes validées conformes comptent, la provisoire est ignorée');
const lignesAvecEcart = [
  { date: '2026-08-01', quart: '1', statut: 'validee_conforme' },
  { date: '2026-08-02', quart: '1', statut: 'validee_ecart' },
  { date: '2026-08-03', quart: '1', statut: 'validee_conforme' },
];
const serie2 = N.serieValideeConformeUnifiee(lignesAvecEcart);
assert.strictEqual(serie2.enCours, 1, 'un écart validé interrompt la série en cours');
assert.strictEqual(serie2.record, 1);
console.log('OK — serieValideeConformeUnifiee : série interrompue par un écart validé, jamais par une ligne provisoire.');

console.log('\nTous les tests "Ma Progression" multi-activité Boutique/Piste/FDJ passent.');
