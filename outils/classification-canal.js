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
//     du skill Fast Track (`docs/skills/nexus-handoff-fast-track/SKILL.md`) ;
//   - depuis le 09/10/2026, si le canal visé est RÉELLEMENT CAPABLE du geste
//     demandé (`docs/handoff/CAPACITES-CANAL.json`, lu par l'appelant).
//
// CE QUE CE MODULE NE FAIT PAS. Il ne réveille personne, n'écrit rien, ne lit
// aucun registre : purement une fonction de décision, appelable depuis un
// outil qui, lui, sait where to look. Le séparer ainsi est ce qui le rend
// testable par mutation sans dépôt jetable.
//
// LA QUATRIÈME QUESTION, ET POURQUOI ELLE MANQUAIT. Les trois premières
// répondent à « qui est le destinataire, et sait-on où le joindre ». Aucune ne
// répond à « ce destinataire peut-il faire le geste ». Le 09/10/2026, le GO
// Production de Frédéric sur le lot G1 a été relayé dans le canal qui avait
// posé la question — le commentaire d'issue, donc GitHub Actions, dont
// l'enveloppe Supabase est « Test, lecture seule ». Le destinataire était le
// bon rôle, le canal était résolu et postable, aucun STOP ne restait ouvert :
// les trois questions répondaient OUI, et le geste était pourtant impossible.
// Claude s'est arrêté sans écrire, ce qui était juste, après avoir brûlé un
// run pour l'apprendre. Une AUTORISATION n'est pas une CAPACITÉ, et c'est
// cette confusion que la quatrième question ferme.
//
// Conséquence de classification, et elle n'est pas intuitive : un canal
// incapable alors qu'un autre canal est capable rend `CHANNEL_LIMITATION`, pas
// `BLOCKED_TECHNIQUE`. L'acquis `LIMITATION_CANAL_NON_STOP` le dit déjà — une
// limitation de canal ne réveille pas Frédéric pour un arbitrage. Ce qu'il faut
// ici n'est pas une décision, c'est un EXÉCUTANT ; `detail` le nomme. Ce n'est
// un vrai blocage que si personne, dans tout le dispositif, n'en est capable.
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
 * @param {string} [c.capaciteRequise] — la capacité que le geste suivant exige
 *   réellement, nommée dans `CAPACITES-CANAL.json`. L'appelant la dérive d'un
 *   motif arbitré par `capacites-canal.capaciteDuGeste`, ou la porte depuis le
 *   `CAPACITE_REQUISE` du NEXT_ACTION_CONTRACT.
 * @param {string} [c.canalCible] — l'identifiant du canal qui recevrait le
 *   geste (`github-actions-claude`, `session-claude-habilitee`, …), tel que
 *   `capacites-canal.canalCourant` ou le routage de l'appelant le désigne.
 * @param {object} [c.registreCapacites] — `CAPACITES-CANAL.json` DÉJÀ CHARGÉ.
 *   Ce module ne lit aucun fichier : le passer ici est ce qui garde la fonction
 *   pure, et donc mutable en épreuve sans dépôt jetable.
 * @returns {{etat:'CHANNEL_LIMITATION'|'BLOCKED_TECHNIQUE', motif:string, detail:*}}
 */
function classifier(c) {
  const ctx = c || {};
  if (!vide(ctx.motifStop) && MOTIFS_STOP_FERMES.includes(String(ctx.motifStop).trim())) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'STOP_FERME', detail: ctx.motifStop };
  }
  // La capacité se vérifie APRÈS le STOP et AVANT le destinataire : tant que
  // l'autorisation manque, nommer un exécutant serait mandater un geste non
  // autorisé ; dès qu'elle est acquise, c'est la capacité qui décide où le
  // geste part, et le rôle déclaré ne suffit plus.
  if (!vide(ctx.capaciteRequise)) {
    const verdict = classifierCapacite(ctx);
    if (verdict) return verdict;
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

// Rend un verdict si la capacité tranche, `null` si elle laisse passer. Ne lit
// rien : tout vient de `ctx.registreCapacites`.
function classifierCapacite(ctx) {
  const cap = String(ctx.capaciteRequise).trim();
  const reg = ctx.registreCapacites;
  // Un invariant invérifiable est un échec, pas une tolérance : sans registre,
  // ou avec une capacité qui n'y figure pas, on ne laisse surtout pas passer.
  if (!reg || !reg.capacites || !reg.canaux) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CAPACITES_INVERIFIABLES', detail: cap };
  }
  if (!Object.keys(reg.capacites).includes(cap)) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CAPACITE_INCONNUE', detail: cap };
  }
  if (vide(ctx.canalCible)) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CANAL_CIBLE_NON_DESIGNE', detail: cap };
  }
  const cible = String(ctx.canalCible).trim();
  const declare = reg.canaux[cible] && reg.canaux[cible].capacites;
  if (!declare) {
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CANAL_CIBLE_HORS_REGISTRE', detail: cible };
  }
  if (declare[cap] === 'OUI') return null; // le canal visé peut : rien à trancher ici
  const capables = Object.keys(reg.canaux).filter(k => reg.canaux[k].capacites
    && reg.canaux[k].capacites[cap] === 'OUI' && k !== cible);
  if (!capables.length) {
    // Personne n'en est capable. Ce n'est plus un problème de transport : le
    // dispositif ne sait pas faire ce geste, et le dire est la seule issue.
    return { etat: 'BLOCKED_TECHNIQUE', motif: 'CAPACITE_SANS_EXECUTANT', detail: cap };
  }
  return {
    etat: 'CHANNEL_LIMITATION',
    motif: 'CAPACITE_CANAL_INSUFFISANTE',
    detail: { capacite: cap, canal_incapable: cible, executants: capables },
  };
}

module.exports = { ETATS, MOTIFS_STOP_FERMES, classifier, classifierCapacite };

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
