#!/usr/bin/env node
'use strict';
// Classification d'un arrêt — CHANNEL_LIMITATION vs BLOCKED_TECHNIQUE.
//
// POURQUOI. `etat-maillon.js` sait déjà dire qu'un maillon est `BLOCKED` et
// rendre l'arrêt exploitable (condition, sha, branche, lot, maillon,
// prochaine_action). Il ne dit pas, en revanche, SI quelqu'un d'autre peut
// faire ce geste. Le 07/10/2026, `GOUVERNANCE-REFERENCE-CODE-20261005
// /request-6.md` est resté sans décision parce que la preuve CI réelle
// nécessitait `gh`, indisponible depuis le canal `issue_comment` de Claude —
// mais parfaitement disponible pour ChatGPT via son propre accès GitHub. Ce
// n'était PAS un blocage : c'était une limitation de CANAL, et la bonne
// réponse était un relais immédiat, pas une attente de Frédéric. Rien ne
// distinguait mécaniquement les deux cas ; un `BLOCKED` ressemblait à l'autre.
//
// CE QUE CE MODULE FAIT. Une seule fonction pure, `classifier`, qui répond à
// « qui peut faire le prochain geste ? » à partir de trois faits, jamais
// davantage :
//   - le destinataire déclaré du relais (`wake_to`, tel que le rail le porte) ;
//   - si ce destinataire dispose d'un canal RÉSOLU et postable (voir
//     `outils/reveil-orchestrateur.js::resoudreCanal`) ;
//   - si la condition qui bloque appartient à la liste FERMÉE des STOP humains
//     du skill Fast Track (`docs/skills/nexus-handoff-fast-track/SKILL.md`).
//
// CE QUE CE MODULE NE FAIT PAS. Il ne réveille personne, n'écrit rien, ne lit
// aucun registre : purement une fonction de décision, appelable depuis un
// outil qui, lui, sait where to look. Le séparer ainsi est ce qui le rend
// testable par mutation sans dépôt jetable.
//
// LA RÈGLE QUI NE SE CONTOURNE JAMAIS. Un STOP de la liste fermée gagne contre
// n'importe quel canal résolu. Un canal qui marche ne transforme jamais une
// fusion Production, une écriture Supabase Production, ou une décision métier
// non arbitrée en un geste délégable — exactement ce que §8 du skill Fast
// Track et la Frontière absolue de CLAUDE.md répètent déjà. Mécaniser cette
// règle ici, c'est l'empêcher d'être oubliée dans un appelant pressé.

const ETATS = Object.freeze(['CHANNEL_LIMITATION', 'BLOCKED_TECHNIQUE']);

// Reprise littérale de la liste STOP du skill Fast Track. Une liste fermée
// vit ici UNE fois ; la dupliquer ailleurs serait exactement la dérive que
// RULES.json désigne par « deux sources de vérité qui vieillissent seules ».
const MOTIFS_STOP_FERMES = Object.freeze([
  'PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION',
  'SUPABASE_PRODUCTION_MUTATION',
  'DECISION_METIER_NON_ARBITREE',
  'EXTENSION_PERIMETRE_SUBSTANTIELLE',
  'CHANGEMENT_NON_ATTRIBUE',
  'REGRESSION_CI_NOUVELLE_INEXPLIQUEE',
  'CONFLIT_LEASE_NON_RESOLUBLE',
  'SECURITE_RLS_SITE_ID',
  'PREUVE_OBLIGATOIRE_IMPOSSIBLE',
  'MODIFICATION_APPLICATIVE_HORS_PERIMETRE',
]);

function vide(v) { return v === undefined || v === null || String(v).trim() === ''; }

/**
 * @param {object} c
 * @param {string} [c.acteurCourant] — qui appelle (« Claude », « ChatGPT »).
 * @param {string} [c.wakeTo] — le destinataire déclaré par le rail (`wake_to`).
 * @param {string|null} [c.canalResolu] — l'adresse postable si `wakeTo` s'est
 *   résolue (voir `resoudreCanal`), sinon `null`/absent.
 * @param {string} [c.motifStop] — le code de la condition qui bloque, s'il en
 *   existe un ; comparé à la liste fermée, jamais deviné depuis du texte libre.
 * @returns {{etat:'CHANNEL_LIMITATION'|'BLOCKED_TECHNIQUE', motif:string, detail:*}}
 */
function classifier(c) {
  const ctx = c || {};
  if (!vide(ctx.motifStop) && MOTIFS_STOP_FERMES.includes(String(ctx.motifStop).trim())) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'STOP_FERME', detail: ctx.motifStop };
  }
  if (vide(ctx.wakeTo)) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'AUCUN_DESTINATAIRE', detail: null };
  }
  // Séparation des rôles (SKILL.md §2) : un acteur ne s'auto-réveille jamais.
  // Si le destinataire déclaré EST l'acteur qui appelle, il n'y a par
  // définition personne d'autre à relayer — c'est un vrai blocage.
  if (!vide(ctx.acteurCourant) && String(ctx.wakeTo).trim() === String(ctx.acteurCourant).trim()) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'DESTINATAIRE_EST_ACTEUR_COURANT', detail: ctx.wakeTo };
  }
  if (vide(ctx.canalResolu)) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CANAL_NON_RESOLU', detail: ctx.wakeTo };
  }
  return { etat: 'CHANNEL_LIMITATION', motif: 'RELAIS_POSSIBLE', detail: ctx.canalResolu };
}

module.exports = { ETATS, MOTIFS_STOP_FERMES, classifier };

if (require.main === module) {
  // Porte CLI minimale, cohérente avec `etat-maillon.js` — utile pour un
  // appel `run:` bash futur, sans l'imposer : aucun workflow n'est câblé ici.
  const argv = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    o[argv[i].slice(2).replace(/-/g, '_').replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = argv[i + 1];
  }
  const r = classifier(o);
  console.log(JSON.stringify(r));
  process.exit(0);
}
