// P2 — cohérence d'une décision, 14/10/2026. Conception soumise à l'arbitre ; NON câblée.
//
// Correction 1 de l'arbitre : « clôture » et « absence d'action » sont deux choses.
// Une clôture peut porter une opération finale déjà autorisée (matérialiser la
// décision, consommer la demande). La sémantique de CLOSES:true ne change donc pas :
// cet outil CLASSE, il ne refuse rien. Le câblage (alerte, refus) est une décision
// distincte.
//
//   CLOTURE_MATERIALISATION  la seule suite est d'écrire la décision/clore le lot : admise
//   CLOTURE_AVEC_ACTION      une opération métier suit : à signaler (INFO), jamais bloquée
//   ARRET_HUMAIN             BLOCKED, Frédéric ou STOP posé : décision humaine, hors boucle
//   CLOTURE_SANS_ACTION      aucune suite : admise
//   NON_CLOTURE              CLOSES ≠ true : hors de cette règle
'use strict';
const net = (v) => String(v == null ? '' : v).replace(/`/g, '').trim();
const AUCUN = /^(aucune?|non|none|néant|n\/a|-)?$/i;
const MATERIALISATION = /\b(mat[ée]rialis|consomm|clore|cl[oô]ture|cl[oô]turer|d[ée]poser\s+(cette\s+)?d[ée]cision|outils\/handoff\.js\s+decision)/i;

function classerCloture(c) {
  if (net(c.CLOSES).toLowerCase() !== 'true') return { classe: 'NON_CLOTURE' };
  if (net(c.DECISION) === 'BLOCKED' || net(c.OWNER_NEXT) === 'Frédéric' || !AUCUN.test(net(c.STOP_REQUIRED)))
    return { classe: 'ARRET_HUMAIN' };
  const action = net(c.ACTION_NEXT);
  if (AUCUN.test(action)) return { classe: 'CLOTURE_SANS_ACTION' };
  // Une action qui matérialise ET fait autre chose reste une action métier : on ne
  // devine pas qu'elle est inoffensive.
  const autre = action.split(/;|\.\s+(?=[A-ZÉÈ])|\.$|,? puis | et /i).map(s => s.trim()).filter(Boolean).some(s => !MATERIALISATION.test(s));
  return { classe: autre ? 'CLOTURE_AVEC_ACTION' : 'CLOTURE_MATERIALISATION', action };
}
module.exports = { classerCloture, MATERIALISATION };
