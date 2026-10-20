'use strict';
// Vigie R4 (V1) — GOV-R4-VIGIE-20261020, decision-1 (APPROVED_WITH_CONDITIONS).
// Lance O3 en RAPPORT (jamais --appliquer) et traduit son constat en code de sortie + annotation GitHub.
//   rien à consommer            -> silence, code 0
//   clôture conforme en attente -> ::error nommant le lot, code 1 (le run échoue, c'est l'alerte)
//   refus / ambiguïté / panne   -> ::error de refus nommant le lot, code 1
// Aucune écriture, aucun secret, aucun appel réseau propre : seul O3 lit la source de la clôture.
const path = require('path');
const { execFileSync } = require('child_process');

const O3 = path.join(__dirname, 'consommer-clotures-ci.js');
let code = 0, sortie;
try { sortie = execFileSync(process.execPath, [O3], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }); }
catch (e) { code = e.status || 1; sortie = `${e.stdout || ''}${e.stderr || ''}`; }

const lignes = sortie.split('\n').filter(Boolean);
const ligne = (re) => lignes.filter(l => re.test(l));
const une = (l) => l.replace(/[\r\n%]/g, ' ');
const alerte = (titre, msg) => { console.log(`::error title=${titre}::${une(msg)}`); };

if (code === 0 && ligne(/^RIEN_A_CONSOMMER/).length) { console.log('Vigie : aucune clôture n\'attend sa consommation.'); process.exit(0); }
console.log(sortie.trimEnd());
if (code === 0 && ligne(/^CONFORME /).length) {
  const lot = /^CONFORME (\S+)/.exec(ligne(/^CONFORME /)[0])[1];
  alerte('Clôture en attente de consommation', `${lot} : une clôture conforme attend sa consommation (node outils/consommer-clotures-ci.js --appliquer, en session).`);
  process.exit(1);
}
const refus = ligne(/^(REFUS|AMBIGUITE) /);
const detail = refus.length ? refus.join(' | ') : `O3 a rendu le code ${code} sans verdict lisible : ${lignes.slice(-2).join(' | ')}`;
const lots = ligne(/^CANDIDAT /).map(l => l.split(' ')[1]).join(' ');
alerte('Clôture refusée', `${lots ? lots + ' : ' : ''}refus de consommer — ${detail}`);
process.exit(1);
