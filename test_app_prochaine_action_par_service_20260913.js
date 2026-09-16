/*
 * La « prochaine action » de l'accueil se compte par SERVICE, et suit la
 * disponibilité réelle.
 * ============================================================================
 * LE DÉFAUT, relevé par Frédéric Bragance le 13/09/2026 au soir, sur une
 * capture de son propre écran. Employé Test B, deux services le même jour :
 *
 *     service du midi : arrivee 12:27:58 · depart 12:32:05   (clos)
 *     service du soir : arrivee 19:50:13 · pause_debut 19:50:27 (ouvert)
 *
 * NEXUS-App-v1.html annonçait « Prochaine étape de votre journée : la fin de
 * pause » et cochait « Clôture » en vert sur un service ouvert. Deux erreurs
 * dans la même fonction :
 *
 *   1. LA PORTÉE — les pointages étaient lus par (employé, site, DATE), sans
 *      service_id. Le départ du service du midi comptait pour celui du soir.
 *   2. LA RÈGLE — `ORDRE.find(t => !fait[t])` : « premier type manquant »
 *      n'est pas « prochaine étape possible ». Sur une journée portant
 *      arrivée et départ, ce calcul annonce « début de pause », étape que
 *      l'écran Pointage refuse.
 *
 * Septième endroit de la série du 13/09. Les six premiers vivaient dans
 * NEXUS-Pointage-v1.html ; celui-ci vivait dans une autre page, qui
 * réécrivait la règle faute de pouvoir la consommer. C'est la raison d'être
 * de nexus-pointage-regles.js.
 *
 * CETTE ÉPREUVE VERROUILLE AUSSI L'ÉQUIVALENCE (§4). Tant que la règle
 * existera à deux endroits — le module et la fonction interne de l'écran
 * Pointage, que ce lot ne touche pas —, elles doivent rendre le MÊME verdict
 * sur les seize états possibles. Si l'une bouge sans l'autre, la CI casse.
 * Une duplication qui ne peut plus diverger en silence n'est plus un piège.
 *
 * TÉMOIN DE MUTATION : NEXUS_SOURCE_APP=<fichier> node ce-test.js
 * Sur le fichier d'avant correction, les §1 et §2 doivent échouer.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const Regles = require('./nexus-pointage-regles.js');

const CHEMIN_APP = process.env.NEXUS_SOURCE_APP
  ? path.resolve(process.env.NEXUS_SOURCE_APP)
  : path.join(__dirname, 'NEXUS-App-v1.html');
const APP = fs.readFileSync(CHEMIN_APP, 'utf8');
const POINTAGE = fs.readFileSync(path.join(__dirname, 'NEXUS-Pointage-v1.html'), 'utf8');

let reussites = 0, echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { reussites++; console.log(`  ✓ ${nom}`); }
  else { echecs++; console.log(`  ✗ ${nom}${detail ? '\n      ' + detail : ''}`); }
}

// La fonction réelle de l'accueil, extraite et jouée — pas décrite.
const blocApp = APP.match(/function calculerProchainPointage\(([\s\S]*?)\n  \}/);
console.log('\n── 0 · La fonction de l’accueil est extractible ──');
verifier('calculerProchainPointage est extractible de NEXUS-App-v1.html', !!blocApp);
if (!blocApp) { console.log('\n✗ fonction introuvable : épreuve interrompue\n'); process.exit(1); }
const calculerProchainPointage = new Function('NexusPointageRegles', 'POINTAGE_MINI_ORDRE',
  `${blocApp[0]}; return calculerProchainPointage;`)(Regles, Regles.ORDRE_TYPES);

const SERVICE_MIDI = 'service-du-midi';
const SERVICE_SOIR = 'service-du-soir';

console.log('\n── 1 · La capture du 13/09 : deux services, un départ au midi ──');
const journee = [
  { type: 'arrivee', service_id: SERVICE_MIDI },
  { type: 'depart', service_id: SERVICE_MIDI },
  { type: 'arrivee', service_id: SERVICE_SOIR },
  { type: 'pause_debut', service_id: SERVICE_SOIR },
];
verifier('la prochaine étape du service du SOIR est la fin de pause',
  calculerProchainPointage(journee, SERVICE_SOIR) === 'pause_fin',
  'obtenu : ' + calculerProchainPointage(journee, SERVICE_SOIR));
verifier('le service du MIDI, lui, n’a plus rien à pointer',
  calculerProchainPointage(journee, SERVICE_MIDI) === null,
  'obtenu : ' + calculerProchainPointage(journee, SERVICE_MIDI));
// Le cas qui a produit la capture : après le départ du soir, la journée
// porte DEUX départs et deux arrivées. L'ancien calcul y voyait « début de
// pause » comme premier type manquant.
const journeeClose = journee.concat([
  { type: 'pause_fin', service_id: SERVICE_SOIR },
  { type: 'depart', service_id: SERVICE_SOIR },
]);
verifier('service du soir terminé : plus aucune étape annoncée',
  calculerProchainPointage(journeeClose, SERVICE_SOIR) === null,
  'obtenu : ' + calculerProchainPointage(journeeClose, SERVICE_SOIR));

console.log('\n── 2 · « Premier type manquant » n’est pas « prochaine étape » ──');
// Un service sans pause, clos : l'ancien calcul annonçait 'pause_debut'.
const sansPause = [
  { type: 'arrivee', service_id: SERVICE_SOIR },
  { type: 'depart', service_id: SERVICE_SOIR },
];
verifier('journée bouclée sans pause : plus rien à pointer',
  calculerProchainPointage(sansPause, SERVICE_SOIR) === null,
  'obtenu : ' + calculerProchainPointage(sansPause, SERVICE_SOIR)
  + ' — l’ancien calcul annonçait « début de pause » après un départ');
verifier('l’ancien calcul aurait bien annoncé « début de pause »',
  ['arrivee', 'pause_debut', 'pause_fin', 'depart']
    .find(t => !sansPause.some(p => p.type === t)) === 'pause_debut');
verifier('toute étape annoncée est réellement disponible',
  [[], journee, journeeClose, sansPause].every(etat => {
    const p = calculerProchainPointage(etat, SERVICE_SOIR);
    return p === null || Regles.estDisponible(p, Regles.dejaFaitDuService(etat, SERVICE_SOIR));
  }));

console.log('\n── 3 · Un service inconnu ne rend pas la journée d’un autre ──');
verifier('sans service courant, l’état est vide et l’arrivée est annoncée',
  calculerProchainPointage(journee, null) === 'arrivee');
verifier('un pointage sans service ne compte pour aucun service',
  Object.keys(Regles.dejaFaitDuService([{ type: 'arrivee', service_id: null }], SERVICE_SOIR)).length === 0);

console.log('\n── 4 · Une seule règle : le module et l’écran Pointage s’accordent ──');
// La règle vit encore dans NEXUS-Pointage-v1.html (fonction interne
// pointageDisponible), que ce lot ne modifie pas — le parcours navigateur
// vient d'y être prouvé. Les deux doivent donc rendre le même verdict, sur
// TOUS les états possibles, sans exception.
const blocPointage = POINTAGE.match(/function pointageDisponible\(type, dejaFait\) \{[\s\S]*?\n  \}/);
verifier('pointageDisponible est extractible de l’écran Pointage', !!blocPointage);
if (blocPointage) {
  const pointageDisponible = new Function(`${blocPointage[0]}; return pointageDisponible;`)();
  const TYPES = Regles.ORDRE_TYPES;
  let divergences = [];
  // Les seize combinaisons de « déjà fait », y compris celles qu'aucun
  // parcours ne produit : une règle ne se vérifie pas sur les seuls chemins
  // qu'on a en tête.
  for (let masque = 0; masque < 16; masque++) {
    const dejaFait = {};
    TYPES.forEach((t, i) => { if (masque & (1 << i)) dejaFait[t] = { heure: '00:00:00' }; });
    TYPES.forEach(t => {
      const a = pointageDisponible(t, dejaFait);
      const b = Regles.estDisponible(t, dejaFait);
      if (a !== b) divergences.push(`${t} sur {${Object.keys(dejaFait).join(',')}} : écran ${a}, module ${b}`);
    });
  }
  verifier('les deux définitions s’accordent sur les 64 verdicts', divergences.length === 0,
    divergences.slice(0, 5).join(' · '));
  verifier('l’ordre des types est identique des deux côtés',
    /const ORDRE_TYPES = \['arrivee', 'pause_debut', 'pause_fin', 'depart'\]/.test(POINTAGE)
    && Regles.ORDRE_TYPES.join(',') === 'arrivee,pause_debut,pause_fin,depart');
}

console.log('\n── 5 · L’accueil consomme la règle au lieu de la réécrire ──');
verifier('la lecture des pointages charge service_id',
  /select\('type, service_id'\)/.test(APP),
  'sans lui, l’accueil ne peut pas distinguer deux services du même jour');
verifier('« déjà fait » est calculé par le module, sur le service courant',
  /NexusPointageRegles\.dejaFaitDuService\(pointagesJour, serviceCourantId\)/.test(APP));
verifier('la prochaine étape vient du module',
  /NexusPointageRegles\.prochaineEtape\(dejaFait\)/.test(APP));
verifier('le service courant est borné au jour station',
  /NexusPointageRegles\.serviceDuJourSeulement\(/.test(APP));
verifier('arriveeFaite et departFait portent sur le service, plus sur la journée',
  /const arriveeFaite = !!dejaFaitService\.arrivee;/.test(APP)
  && /const departFait = !!dejaFaitService\.depart;/.test(APP),
  'c’est ce qui cochait « Clôture » sur un service ouvert');
verifier('l’ancien calcul séquentiel a disparu du code vivant',
  !/^\s*return POINTAGE_MINI_ORDRE\.find\(t => !fait\[t\]\) \|\| null;/m.test(APP),
  'il n’en reste qu’une trace en commentaire, qui documente le défaut');
verifier('l’ancienne lecture par journée seule a disparu',
  !/select\('type'\)\.eq\('employee_id'/.test(APP));
verifier('l’écran ne garde plus sa copie de l’ordre des types',
  !/^\s*const POINTAGE_MINI_ORDRE = \[/m.test(APP),
  'une copie invite à s’en servir pour décider');
verifier('le module est chargé par la page',
  /<script src="nexus-pointage-regles\.js/.test(APP));

console.log('\n── 6 · Le module ne lit rien, n’écrit rien, ne touche pas au DOM ──');
const SRC_MODULE = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
verifier('aucun accès Supabase', !/from\('|nexusClient/.test(SRC_MODULE));
verifier('aucun accès au DOM', !/document\.|window\./.test(SRC_MODULE));
verifier('aucune horloge : la date est fournie par l’appelant',
  !/new Date\(\)/.test(SRC_MODULE) && /jourDeService/.test(SRC_MODULE));

console.log(`\n${echecs === 0 ? '✓' : '✗'} ${reussites} réussite(s), ${echecs} échec(s)`);
console.log(`   accueil joué : ${path.basename(CHEMIN_APP)}\n`);
// Sortie d'échec explicite, jamais un ternaire.
if (echecs > 0) process.exit(1);
