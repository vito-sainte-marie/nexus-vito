#!/usr/bin/env node
'use strict';
// Un tour de la boucle qui a poussé du travail mais n'a pas consommé la
// décision n'est pas un succès (decision-2 d'OUTILLAGE-REGULARISATION-20261026,
// condition 4). Run 40258106584 : b9e34f97 poussé, lot resté en
// ATTENTE_CONSOMMATION_DECISION, run vert.
//
// Ce juge ne touche à rien : il lit le STATE.json du rail à la tête du tour et
// rend un verdict ; l'étape « garantir la CI du rail » de claude.yml l'appelle
// APRÈS le contrôle du tour vide et sort en erreur sur TOUR_INCOMPLET.
//
// Usage : node outils/juger-tour-claude.js <LOT> <state.json>   (code 1 si TOUR_INCOMPLET)

const fs = require('fs');

const VERDICTS = Object.freeze({ CONSOMME: 'CONSOMME', TOUR_INCOMPLET: 'TOUR_INCOMPLET', LOT_INCONNU: 'LOT_INCONNU' });

function juger(state, lot) {
  const l = state && state.lots && state.lots[lot];
  if (!l) return { verdict: VERDICTS.LOT_INCONNU, ok: false, message: `Lot ${lot} absent de STATE.json : impossible de dire si la décision est consommée.` };
  if (l.statut === 'ATTENTE_CONSOMMATION_DECISION') {
    return { verdict: VERDICTS.TOUR_INCOMPLET, ok: false,
      message: `Boucle : TOUR_INCOMPLET. Du travail a été poussé mais ${lot} est resté en ATTENTE_CONSOMMATION_DECISION `
        + `(${l.derniere_decision || 'décision inconnue'} non consommée). Consommer : node outils/handoff.js consommer ${lot} --preuve-action <sha>.` };
  }
  return { verdict: VERDICTS.CONSOMME, ok: true, message: `${lot} : statut ${l.statut}, la décision n'attend plus de consommation.` };
}

module.exports = { juger, VERDICTS };

if (require.main === module) {
  const [lot, fichier] = process.argv.slice(2);
  if (!lot || !fichier) { console.error('usage : juger-tour-claude.js <LOT> <state.json>'); process.exit(2); }
  const r = juger(JSON.parse(fs.readFileSync(fichier, 'utf8')), lot);
  console.log(`${r.ok ? '' : '::error::'}${r.message}`);
  process.exit(r.ok ? 0 : 1);
}
