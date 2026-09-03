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

// --- Sans alias : on mesure honnêtement ce qui ne se rapproche pas.
const brut = P.analyserFeuillePlanning(CSV, { periode: '2026-09', employesNexus: EMP });
verifier('les colonnes de la feuille sont lues', brut.colonnes.length === 13);
verifier('les prénoms qui ne correspondent à personne sont signalés, jamais devinés',
  brut.inconnus.includes('LOANNE') && brut.inconnus.includes('FREDERIC') && brut.inconnus.includes('Camille'));

// --- Avec les alias explicites constatés.
const ALIAS = { LOANNE: 'loane', FREDERIC: 'Fred' };
const r = P.analyserFeuillePlanning(CSV, { periode: '2026-09', employesNexus: EMP, alias: ALIAS });
verifier('les alias déclarés rapprochent LOANNE et FREDERIC',
  !r.inconnus.includes('LOANNE') && !r.inconnus.includes('FREDERIC'));
verifier('Camille reste inconnue — elle n’est pas dans NEXUS', r.inconnus.includes('Camille'));
verifier('le 31/08 est exclu : le filtre porte sur la date, pas sur le nom de l’onglet',
  r.shifts.every(s => s.date >= '2026-09-01'));
verifier('les codes de site ne deviennent jamais des heures',
  r.codes.length === 2 && r.codes.every(c => c.valeur === 'SMU') && r.shifts.every(s => s.heures > 0));

// --- Le barème du fichier correspond-il à la règle NEXUS ?
const mardi = r.shifts.filter(s => s.date === '2026-09-01');
verifier('mardi 01/09 : 4 affectations, 7 h pour tout le monde',
  mardi.length === 4 && mardi.every(s => s.heures === 7));
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

console.log(`\n${ok} vérifications passées.`);
