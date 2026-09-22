// Convergence planning Google Sheets (onglet SMU09) ↔ NEXUS ↔ Verify.
// Données réelles lues le 03/09/2026 dans « Planning Energy 2026 ».
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-planning-sheets-moteur.js'), 'utf8'), ctx);
const P = ctx.NexusPlanningSheets;

// Extrait réel de l'onglet SMU09.
const CSV = [
'"","","","SAMANTHA","MADELEINE","LOANNE","ANGELIQUE","NADINE","DYLAN","KECY","RUDDY","ALEX","Camille","FREDERIC","LYDIE","AUDREY",""',
'"LUNDI","31/8/2026","QUART A","7","","","","","7","","","","","","","",""',
'"","","QUART B","","","7","","","","7","","","","","","",""',
'"MARDI","1/9/2026","QUART A","","","","7","7","","","","","","","","",""',
'"","","QUART B","","","7","","","","7","","","","","","",""',
'"MERCREDI","2/9/2026","QUART A","7","","","7","","","","","","","","","SMU",""',
'"","","QUART B","","","","","7","","7","","","","","","",""',
'"JEUDI","3/9/2026","QUART A","","","8","8","","7","","","","","","","SMU",""',
'"","","QUART B","","","","","8","","8","","","","","","",""',
].join('\n');

// Employés NEXUS réels du site.
const EMP = [
  ['e-samantha','samantha','caissier'],['e-madeleine','Madeleine','caissier'],
  ['e-loane','loane','caissier'],['e-angelique','angelique','renfort'],
  ['e-nadine','nadine','caissier'],['e-dylan','Dylan','pompiste'],
  ['e-kecy','Kecy','pompiste'],['e-ruddy','Ruddy','pompiste'],
  ['e-alex','Alex','vacataire'],['e-fred','Fred','manager'],
  ['e-lydie','lydie','manager'],['e-audrey','Audrey','manager'],
].map(([id,nom,role]) => ({ id, nom, role }));

let ok = 0;
const verifier = (l, c) => { console.log(`${c ? 'OK  ' : 'ÉCHEC'} — ${l}`); assert.ok(c, l); ok++; };

// Mappage EXPLICITE des codes de site (mandat du 19/09/2026). Il n'y a plus
// de liste devinee dans le moteur : ce dictionnaire vient de
// station_config.planning_codes_sites, et ce qui n'y figure pas est une
// anomalie, jamais 7 h supposees.
const CODES_SITES = { SMU: 'vito-sainte-marie' };
const ONGLET = 'SMU09';
const SITE = 'vito-sainte-marie';

// --- Sans alias : on mesure honnêtement ce qui ne se rapproche pas.
const brut = P.analyserFeuillePlanning(CSV, { periode: '2026-09', employesNexus: EMP, codesSite: CODES_SITES });
verifier('les colonnes de la feuille sont lues', brut.colonnes.length === 13);
verifier('les prénoms qui ne correspondent à personne sont signalés, jamais devinés',
  brut.inconnus.includes('LOANNE') && brut.inconnus.includes('FREDERIC') && brut.inconnus.includes('Camille'));

// --- Avec les alias explicites constatés.
const ALIAS = { LOANNE: 'loane', FREDERIC: 'Fred' };
const r = P.analyserFeuillePlanning(CSV, {
  periode: '2026-09', employesNexus: EMP, alias: ALIAS,
  codesSite: CODES_SITES, onglet: ONGLET, siteId: SITE,
});
verifier('les alias déclarés rapprochent LOANNE et FREDERIC',
  !r.inconnus.includes('LOANNE') && !r.inconnus.includes('FREDERIC'));
verifier('Camille reste inconnue — elle n’est pas dans NEXUS', r.inconnus.includes('Camille'));
verifier('le 31/08 est exclu : le filtre porte sur la date, pas sur le nom de l’onglet',
  r.shifts.every(s => s.date >= '2026-09-01'));
const parCode = r.shifts.filter(s => s.heuresDeduites);
verifier('un code de site vaut 7 h travaillées, pas une absence',
  parCode.length === 2 && parCode.every(s => s.heures === 7 && s.siteTravail === SITE));
verifier('le code SMU dans l’onglet SMU09 designe le site lui-meme : ce n’est pas un transfert',
  parCode.every(s => s.horsSite === false && s.statut === 'travail_normal'));
verifier('les heures venues d’un code sont marquees comme deduites, jamais confondues avec un nombre lu',
  parCode.every(s => s.heuresDeduites === true && s.valeur === 'SMU')
  && r.shifts.filter(s => !s.heuresDeduites).every(s => s.heuresDeduites === undefined));
verifier('aucune valeur non interprétable ne reste en suspens ici', r.codes.length === 0);
verifier('chaque ligne cite la case d’origine, onglet compris',
  r.shifts.every(s => /^SMU09!\d{4}-\d{2}-\d{2}\|QUART [AB]\|/.test(s.sourceRef))
  && r.shifts.some(s => s.sourceRef === 'SMU09!2026-09-03|QUART A|AUDREY'));
verifier('le quart porte deja son nom NEXUS, pour que l’ecriture n’ait rien a retraduire',
  r.shifts.every(s => s.quartNexus === (s.quart === '1' ? 'quart1' : 'quart2')));

// --- Ce que le moteur REFUSE de deviner (mandat du 19/09/2026).
const sansMappage = P.analyserFeuillePlanning(CSV, {
  periode: '2026-09', employesNexus: EMP, alias: ALIAS, onglet: ONGLET, siteId: SITE,
});
verifier('sans mappage declare, un code de site ne produit AUCUNE heure',
  sansMappage.shifts.every(s => s.valeur !== 'SMU'));
verifier('il produit une anomalie nommee, qui dit quoi faire',
  sansMappage.anomalies.filter(x => x.type === 'code_site_non_mappe').length === 2
  && /Parametres Station/.test(String(sansMappage.anomalies.find(x => x.type === 'code_site_non_mappe'))));
verifier('un code mappe sur un AUTRE site est un transfert, et le site NEXUS est nomme',
  P.analyserFeuillePlanning(CSV, {
    periode: '2026-09', employesNexus: EMP, alias: ALIAS, onglet: ONGLET, siteId: SITE,
    codesSite: { SMU: 'station-trinite' },
  }).shifts.filter(s => s.horsSite)
   .every(s => s.statut === 'transfert_site' && s.siteTravail === 'station-trinite'));
verifier('une colonne remplie que personne ne reclame est une anomalie, pas une perte silencieuse',
  brut.anomalies.some(x => x.type === 'colonne_inconnue' && x.nomFeuille === 'LOANNE'));
verifier('une colonne inconnue mais VIDE ne bloque pas l’import — elle reste seulement signalee',
  brut.inconnus.includes('Camille')
  && !brut.anomalies.some(x => x.type === 'colonne_inconnue' && x.nomFeuille === 'Camille'));
verifier('la feuille conforme ne porte aucune anomalie : rien a lever avant publication',
  r.anomalies.length === 0);

// --- Le barème du fichier correspond-il à la règle NEXUS ?
const mardi = r.shifts.filter(s => s.date === '2026-09-01');
verifier('mardi 01/09 : 4 affectations, 7 h pour tout le monde',
  mardi.length === 4 && mardi.every(s => s.heures === 7));
verifier('un code de site vaut 7 h même un jeudi, jour à 8 h',
  r.shifts.some(s => s.date === '2026-09-03' && s.heuresDeduites && s.heures === 7));
const jeudi = r.shifts.filter(s => s.date === '2026-09-03');
verifier('jeudi 03/09 : 8 h pour piste et boutique (4 affectations)',
  jeudi.filter(s => s.heures === 8).length === 4);
verifier('jeudi 03/09 : 7 h pour Dylan — un poste de renfort ce jour-là',
  jeudi.some(s => s.employeeId === 'e-dylan' && s.heures === 7));

// --- Rapprochement avec Verify (données réelles).
const AUDITS = [
  { date: '2026-09-01', quart: '1', employes_piste: ['e-nadine'], employes_boutique: ['e-angelique'] },
  { date: '2026-09-02', quart: '1', employes_piste: [], employes_boutique: ['e-kecy'] },
];
const rap = P.rapprocherAvecVerify(r.shifts, AUDITS, EMP);
verifier('01/09 quart 1 : Verify et le planning convergent entièrement',
  rap[0].converge.sort().join(',') === 'angelique,nadine'
  && rap[0].prevusAbsents.length === 0 && rap[0].presentsNonPrevus.length === 0);
verifier('02/09 : une présence non prévue est nommée, pas noyée',
  rap[1].presentsNonPrevus.includes('Kecy'));
verifier('et les prévus absents le sont aussi',
  rap[1].prevusAbsents.includes('samantha') && rap[1].prevusAbsents.includes('angelique'));

// --- Vue par employé : ce que l'employé lit sur son téléphone.
const vue = P.resumerParEmploye(r, { employesNexus: EMP, periode: '2026-09' });
const parNom = n => vue.employes.find(e => e.nom === n);

verifier('seules les journées réellement planifiées sont retenues',
  vue.joursPlanifies.join(',') === '2026-09-01,2026-09-02,2026-09-03');

const ang = parNom('angelique');
verifier('angelique : 3 jours travaillés en septembre', ang.joursTravailles === 3);
verifier('ses heures prévues sont la somme du fichier (7+7+8)', ang.heuresPrevues === 22);
verifier('son binôme du 01/09 quart 1 est nommé',
  ang.journees.find(j => j.date === '2026-09-01').binome.includes('nadine'));
verifier('son quart est annoncé', ang.quartsDominants.includes('Quart 1'));

const dylan = parNom('Dylan');
verifier('Dylan est signalé hors barème le jeudi, sans que NEXUS tranche',
  dylan.journees.some(j => j.date === '2026-09-03' && j.renfortProbable === true
    && /renfort ou autre site/.test(j.note)));

const audrey = parNom('Audrey');
verifier('Audrey est planifiee par un code les 02 et 03 — 7 h chacun, comptées',
  audrey.heuresPrevues === 14 && audrey.joursTravailles === 2);
verifier('une journee dite par un code n’est pas un repos',
  !audrey.repos.includes('2026-09-02') && !audrey.repos.includes('2026-09-03'));

const samantha = parNom('samantha');
verifier('samantha est au repos le 01 et le 03 — journées planifiées où elle n’apparaît pas',
  samantha.repos.join(',') === '2026-09-01,2026-09-03');
verifier('aucun repos n’est annoncé sur une journée non planifiée',
  vue.employes.every(e => e.repos.every(d => vue.joursPlanifies.includes(d))));

const madeleine = parNom('Madeleine');
verifier('une personne jamais planifiée n’a ni heures ni faux repos inventés',
  madeleine.joursTravailles === 0 && madeleine.repos.length === 3);

console.log(`\n${ok} vérifications passées.`);
