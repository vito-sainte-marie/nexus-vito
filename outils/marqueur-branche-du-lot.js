// Marqueur `BRANCHE_DU_LOT: <branche>` du corps d'une décision — OUTILLAGE-REGULARISATION-20261026,
// decision-2 condition 1. Module pur (aucun git, aucune écriture), partagé par :
//   - `handoff.js consommer --preuve-action`, qui l'EXIGE (refus avant écriture) ;
//   - `materialiser-decision-ci.js`, qui le DÉPOSE dans toute décision que la CI matérialise,
//     pour que la consommation suivante ne soit pas refusée faute de marqueur.
'use strict';
const MARQUEUR = /^BRANCHE_DU_LOT:\s*(\S+)\s*$/m;
const BRANCHE_ADMISE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const INTERDITES = ['main', 'production'];

function brancheValide(b) {
  return typeof b === 'string' && BRANCHE_ADMISE.test(b) && !b.includes('..') && !b.endsWith('/') && !INTERDITES.includes(b);
}

// { n, branche } : n marqueurs en début de ligne, branche = le premier.
function analyser(corps) {
  const trouves = typeof corps === 'string' ? (corps.match(new RegExp(MARQUEUR.source, 'gm')) || []) : [];
  const m = typeof corps === 'string' ? corps.match(MARQUEUR) : null;
  return { n: trouves.length, branche: m ? m[1] : null };
}

module.exports = { MARQUEUR, brancheValide, analyser };
