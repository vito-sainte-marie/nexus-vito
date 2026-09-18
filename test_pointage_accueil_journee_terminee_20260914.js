/*
 * L'accueil confondait « journée pas commencée » et « journée terminée ».
 * ============================================================================
 * LE DÉFAUT, relevé par Frédéric Bragance le 14/09/2026 sur le parcours
 * d'Employé Test B, après une déconnexion complète puis reconnexion :
 *
 *     Supabase confirmait le dernier service clos par `pointage_depart`,
 *     arrivée et départ présents, zéro service ouvert.
 *
 *     L'accueil (NEXUS-App-v1.html) affichait pourtant encore :
 *       « Votre service est en cours », progression 0 %,
 *       « Votre arrivée n'a pas encore été pointée », bouton « Pointer
 *       l'arrivée ».
 *
 * CAUSE (lecture seule, sans toucher à aucun service) : sans service ouvert,
 * `serviceCourantJour` vaut `null`. `dejaFaitDuService(pointagesJour, null)`
 * rend alors un état vide `{}` — QUEL QUE SOIT le contenu réel de
 * `pointagesJour` — parce que `dejaFaitDuService` refuse tout pointage sans
 * `serviceId` (voir nexus-pointage-regles.js). `prochaineEtape({})` renvoie
 * donc 'arrivee', et l'accueil rouvre l'étape que l'écran Pointage refuse
 * déjà pour ce même cas (NEXUS-Pointage-v1.html porte sa propre garde
 * `journeeTerminee`, jamais consommée par l'accueil).
 *
 * Le commit 894e306 (13/09/2026 au soir) avait corrigé DEUX défauts dans
 * cette même fonction (portée par service_id, séquence stricte) mais pas
 * CELUI-CI : il ne distinguait pas « rien commencé » de « déjà terminé »
 * quand `serviceCourant` est null dans les deux cas.
 *
 * TÉMOIN DE MUTATION : NEXUS_SOURCE_APP=<fichier> node ce-test.js
 * Sur NEXUS-App-v1.html au commit 894e306 (avant ce correctif), les
 * sections 1, 2 et 3 doivent échouer :
 *   git show 894e306:NEXUS-App-v1.html > /tmp/app-894e306.html
 *   NEXUS_SOURCE_APP=/tmp/app-894e306.html node test_pointage_accueil_journee_terminee_20260914.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const Regles = require('./nexus-pointage-regles.js');

const CHEMIN_APP = process.env.NEXUS_SOURCE_APP
  ? path.resolve(process.env.NEXUS_SOURCE_APP)
  : path.join(__dirname, 'NEXUS-App-v1.html');
const APP = fs.readFileSync(CHEMIN_APP, 'utf8');

let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

console.log('\n── 0 · La nouvelle règle existe et est exportée ──');
verifier('NexusPointageRegles.journeeTermineeSansService existe',
  typeof Regles.journeeTermineeSansService === 'function');
if (typeof Regles.journeeTermineeSansService !== 'function') {
  console.log('\n✗ fonction introuvable dans nexus-pointage-regles.js : épreuve interrompue\n');
  process.exit(1);
}

// Deux services terminés le même jour, zéro service ouvert — exactement la
// capture Supabase de Frédéric du 14/09/2026.
const SERVICE_MATIN = 'service-matin';
const SERVICE_MIDI = 'service-midi';
const journeeDeuxServicesClos = [
  { type: 'arrivee', service_id: SERVICE_MATIN },
  { type: 'depart', service_id: SERVICE_MATIN },
  { type: 'arrivee', service_id: SERVICE_MIDI },
  { type: 'depart', service_id: SERVICE_MIDI },
];

console.log('\n── 1 · La règle pure distingue « rien commencé » de « déjà terminé » ──');
verifier('aucun service, aucun pointage : PAS une journée terminée (rien n’a commencé)',
  Regles.journeeTermineeSansService(null, []) === false);
verifier('aucun service ouvert, mais deux services clos aujourd’hui : journée terminée',
  Regles.journeeTermineeSansService(null, journeeDeuxServicesClos) === true);
verifier('un service ouvert aujourd’hui : jamais « terminée », quels que soient les pointages',
  Regles.journeeTermineeSansService({ id: SERVICE_MIDI }, journeeDeuxServicesClos) === false);

console.log('\n── 2 · Le calcul historique de l’accueil retombait sur « arrivée » ──');
const blocProchain = APP.match(/function calculerProchainPointage\(([\s\S]*?)\n  \}/);
verifier('calculerProchainPointage est extractible de NEXUS-App-v1.html', !!blocProchain);
if (blocProchain) {
  const calculerProchainPointage = new Function('NexusPointageRegles',
    `${blocProchain[0]}; return calculerProchainPointage;`)(Regles);
  verifier('sans service courant, le calcul brut annonce bien « arrivee » (c’est le piège, pas encore le correctif)',
    calculerProchainPointage(journeeDeuxServicesClos, null) === 'arrivee',
    'obtenu : ' + calculerProchainPointage(journeeDeuxServicesClos, null));
}

console.log('\n── 3 · L’accueil neutralise ce piège pour une journée réellement terminée ──');
// La garde vit inline dans initAccueilEmploye (pas une fonction autonome,
// car construite à partir de plusieurs lectures Supabase) : on rejoue ici
// EXACTEMENT le calcul qu'il applique, avec les fonctions réellement
// extraites de la page — pas une réécriture indépendante de la règle.
verifier('la garde `journeeTerminee` est bien câblée dans initAccueilEmploye',
  /const journeeTerminee = pointageActifSite\s*\n\s*&& NexusPointageRegles\.journeeTermineeSansService\(serviceCourantJour, pointagesJour\);/.test(APP));
// Élargi le 18/09/2026 : la neutralisation couvre désormais aussi « aucun
// service ouvert aujourd'hui » (lot accueil hors service). L'acquis du 14/09
// est intact — journée terminée ⇒ aucun pointage — mais il n'est plus la
// seule condition, et le motif d'origine ne décrivait plus le code.
verifier('`prochainPointage` est neutralisé à null quand la journée est terminée',
  /const prochainPointageEffectif = \(journeeTerminee \|\| !enService\) \? null : prochainPointage;/.test(APP));
verifier('le ctx transmis aux rendus porte `journeeTerminee` et le pointage neutralisé',
  /prochainPointage: prochainPointageEffectif/.test(APP) && /journeeTerminee,/.test(APP));
verifier('`nbActions` compte sur le pointage neutralisé, pas sur le brut',
  /const nbActions = \(prochainPointageEffectif \? 1 : 0\)/.test(APP));
verifier('la phrase de statut ne dit jamais « en cours » sur une journée terminée',
  /const phraseService = journeeTerminee\s*\n\s*\? 'Votre journée est terminée'/.test(APP));

if (blocProchain) {
  const calculerProchainPointage = new Function('NexusPointageRegles',
    `${blocProchain[0]}; return calculerProchainPointage;`)(Regles);
  const prochainPointageBrut = calculerProchainPointage(journeeDeuxServicesClos, null);
  const journeeTerminee = Regles.journeeTermineeSansService(null, journeeDeuxServicesClos);
  const prochainPointageEffectif = journeeTerminee ? null : prochainPointageBrut;
  verifier('résultat final rejoué : aucune étape de pointage n’est proposée',
    prochainPointageEffectif === null,
    'obtenu : ' + prochainPointageEffectif);
}

console.log('\n── 4 · « Prochaine action » : aucun pointage, un message de journée terminée ──');
const blocAction = APP.match(/function determinerProchaineActionEmploye\(ctx\) \{[\s\S]*?\n  \}/);
verifier('determinerProchaineActionEmploye est extractible de NEXUS-App-v1.html', !!blocAction);
if (blocAction) {
  const determinerProchaineActionEmploye = new Function(
    'POINTAGE_MINI_COULEURS', 'POINTAGE_MINI_TEXTES', 'POINTAGE_MINI_LIBELLES',
    `${blocAction[0]}; return determinerProchaineActionEmploye;`
  )(
    { arrivee: 'arrivee', pause_debut: 'pause', pause_fin: 'pause', depart: 'depart' },
    { arrivee: 'Votre arrivée n’a pas encore été pointée.' },
    { arrivee: 'Pointer l’arrivée →' }
  );

  const ctxJourneeTerminee = {
    pointageActif: true, prochainPointage: null, journeeTerminee: true,
    jaugeageApplicable: false, jaugeageFait: false,
    inventaireApplicable: false, inventaireFait: false,
    fdjApplicable: false, fdjFait: false,
    missionsInfo: { total: 0, faites: 0 },
  };
  const action = determinerProchaineActionEmploye(ctxJourneeTerminee);
  verifier('aucun lien de pointage n’est proposé (journée terminée)', action.lien === null,
    'obtenu : ' + JSON.stringify(action));
  verifier('le titre annonce une journée terminée, jamais « Pointer l’arrivée »',
    /journée/i.test(action.titre) && !/pointer/i.test(action.titre),
    'obtenu : ' + action.titre);
  verifier('le titre ne prétend jamais qu’un service est « en cours »',
    !/en cours/i.test(action.titre), 'obtenu : ' + action.titre);

  console.log('\n── 5 · Journée terminée avec des missions restantes : toujours aucun pointage ──');
  const ctxJourneeTermineeAvecMissions = Object.assign({}, ctxJourneeTerminee, {
    missionsInfo: { total: 3, faites: 1 },
  });
  const actionAvecMissions = determinerProchaineActionEmploye(ctxJourneeTermineeAvecMissions);
  verifier('la journée terminée prime sur les missions restantes : toujours aucun pointage proposé',
    actionAvecMissions.lien === null, 'obtenu : ' + JSON.stringify(actionAvecMissions));
}

console.log('\n── 6 · Progression : « Ouverture » et « Clôture » cochées, jamais « à venir » ──');
const blocEtapes = APP.match(/function calculerEtapesProgressionService\(ctx\) \{[\s\S]*?\n  \}/);
verifier('calculerEtapesProgressionService est extractible de NEXUS-App-v1.html', !!blocEtapes);
if (blocEtapes) {
  const calculerEtapesProgressionService = new Function(
    `${blocEtapes[0]}; return calculerEtapesProgressionService;`
  )();
  const etapes = calculerEtapesProgressionService({
    pointageActif: true, arriveeFaite: true, departFait: true, journeeTerminee: true,
    missionsInfo: { total: 0 }, controlesInfo: { applicable: false },
  });
  const parCode = Object.fromEntries(etapes.map(e => [e.code, e.etat.statut]));
  verifier('« Ouverture » est cochée « fait » (l’arrivée a bien eu lieu ce jour-là)',
    parCode.ouverture === 'fait', 'obtenu : ' + parCode.ouverture);
  verifier('« Clôture » est cochée « fait » (le départ a bien eu lieu ce jour-là)',
    parCode.cloture === 'fait', 'obtenu : ' + parCode.cloture);
}

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)`);
console.log(`   accueil joué : ${path.basename(CHEMIN_APP)}\n`);
// Sortie d'échec explicite, jamais un ternaire.
if (echecs > 0) process.exit(1);
