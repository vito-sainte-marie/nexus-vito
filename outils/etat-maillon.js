#!/usr/bin/env node
'use strict';
// État de maillon — un refus ne peut plus être muet.
//
// LE DÉFAUT QUE CECI SUPPRIME. Le 30/09/2026, la chaîne Handoff s'est arrêtée
// quatre jours sans qu'un seul run ne rougisse. La cause n'était pas un bug :
// c'était une convention. L'étape de réveil appelait `refus()`, qui écrivait le
// motif dans le journal puis sortait en 0 ; le filtre d'auteur de `claude.yml`
// rendait `skipped` ; et `skipped` n'est pas `failure`. Trois manières
// différentes d'apparaître « vert » en ayant refusé l'action essentielle. Le
// travail s'arrêtait, et le seul signal exploitable était qu'il ne se passait
// plus rien — ce qui ne se surveille pas.
//
// CE QUE CE MODULE GARANTIT. Un maillon ne rend plus « du texte dans un log » :
// il rend un ÉTAT MACHINE pris dans une liste fermée. Et pour les trois états
// qui arrêtent la chaîne, les six champs qui rendent l'arrêt exploitable sont
// exigés À LA CONSTRUCTION : sans eux, `etat()` jette. On ne peut donc pas
// écrire un `BLOCKED` sans dire quelle condition a bloqué, sur quel SHA, quelle
// branche, quel lot, quel maillon, et quel geste vient ensuite. La discipline
// n'est pas demandée aux auteurs : elle leur est rendue inévitable.
//
// POURQUOI `BLOCKED` NE ROUGIT PAS LA CI. Un arrêt légitime n'est pas une panne.
// Transformer chaque `NO_WORK` ou chaque `BLOCKED` en échec rouge apprend à
// l'équipe à ignorer le rouge, et on retombe sur le même aveuglement par l'autre
// bout. Ce qui est exigé, ce n'est pas la couleur : c'est le SIGNAL. Il sort donc
// par quatre canaux à la fois — annotation de run, résumé de job, sortie
// d'étape lisible par les étapes suivantes, et JSON — de sorte qu'aucun d'eux
// ne soit le seul endroit où regarder. Seul `FAILED` rougit : il ne dit pas
// « la chaîne s'arrête proprement », il dit « le maillon lui-même est cassé ».

const fs = require('fs');

// Liste FERMÉE. Un état hors de cette liste est une erreur de programme, pas une
// valeur exotique à tolérer : c'est exactement comme cela qu'un « inconnu »
// finirait par être traité comme un succès.
const ETATS = Object.freeze(['EXECUTE', 'NO_WORK', 'BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED']);

// Les états qui ARRÊTENT la chaîne. Ce sont eux, et eux seuls, qui doivent
// rendre l'arrêt actionnable sans rouvrir le dossier.
const ETATS_QUI_ARRETENT = Object.freeze(['BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED']);

// Les six champs exigés par la procédure. L'ordre est celui de la lecture :
// ce qui a bloqué, où, pour qui, à quel maillon, et quoi faire.
const CHAMPS_EXIGES = Object.freeze(['condition', 'sha', 'branche', 'lot', 'maillon', 'prochaine_action']);

const ANNOTATION = Object.freeze({
  EXECUTE: 'notice', NO_WORK: 'notice',
  BLOCKED: 'warning', HUMAN_DECISION_REQUIRED: 'warning', FAILED: 'error',
});

function vide(v) { return v === undefined || v === null || String(v).trim() === ''; }

// Construit l'état. Jette plutôt que de rendre un objet incomplet : un état
// incomplet voyagerait jusqu'au rapport et y ressemblerait à une information.
function etat(champs) {
  const c = champs || {};
  const e = String(c.etat || '').trim();
  if (!ETATS.includes(e)) {
    throw new Error(`État « ${e || '(vide)'} » hors de la liste fermée (${ETATS.join(', ')}).`);
  }
  // `maillon` est exigé partout : un état qui ne dit pas d'où il vient n'est
  // pas rattachable à la chaîne, donc pas exploitable, même en `EXECUTE`.
  if (vide(c.maillon)) throw new Error('Tout état doit nommer son maillon.');
  if (ETATS_QUI_ARRETENT.includes(e)) {
    const manquants = CHAMPS_EXIGES.filter(k => vide(c[k]));
    if (manquants.length) {
      throw new Error(
        `Un ${e} doit rendre l'arrêt exploitable : champ(s) manquant(s) ${manquants.join(', ')}. `
        + 'Un arrêt qu\'il faut instruire pour comprendre est un arrêt silencieux de plus.');
    }
  }
  return Object.freeze({
    etat: e,
    maillon: String(c.maillon).trim(),
    code: vide(c.code) ? null : String(c.code).trim(),
    motif: vide(c.motif) ? null : String(c.motif).trim(),
    condition: vide(c.condition) ? null : String(c.condition).trim(),
    sha: vide(c.sha) ? null : String(c.sha).trim(),
    branche: vide(c.branche) ? null : String(c.branche).trim(),
    lot: vide(c.lot) ? null : String(c.lot).trim(),
    prochaine_action: vide(c.prochaine_action) ? null : String(c.prochaine_action).trim(),
    details: c.details && typeof c.details === 'object' ? c.details : null,
  });
}

function arrete(r) { return ETATS_QUI_ARRETENT.includes(r.etat); }

// `FAILED` seul rougit. Voir l'en-tête : la couleur n'est pas le signal.
function codeSortie(r) { return r.etat === 'FAILED' ? 1 : 0; }

function ligne(r) {
  return `[${r.etat}] ${r.maillon}${r.code ? ` (${r.code})` : ''} — ${r.motif || r.condition || ''}`.trim();
}

function resume(r) {
  const l = [`### ${r.etat} — ${r.maillon}`, ''];
  if (r.code) l.push(`**Code** : \`${r.code}\``);
  if (r.motif) l.push('', r.motif, '');
  if (arrete(r)) {
    l.push('| Champ | Valeur |', '| --- | --- |');
    for (const k of CHAMPS_EXIGES) l.push(`| ${k} | \`${r[k]}\` |`);
  }
  return l.join('\n') + '\n';
}

function ajouter(variable, texte) {
  const chemin = process.env[variable];
  if (!chemin) return false;
  try { fs.appendFileSync(chemin, texte); return true; } catch (_) { return false; }
}

// Publie l'état par TOUS les canaux disponibles. Aucun n'est le canal unique :
// une étape suivante lit `GITHUB_OUTPUT`, un humain lit le résumé, une alerte
// lit l'annotation, un outil lit le JSON. Un arrêt qui n'existe que dans le
// journal est un arrêt qu'on retrouvera quatre jours plus tard.
function publier(r, sortie = process.stdout) {
  const json = JSON.stringify(r);
  sortie.write(ligne(r) + '\n');
  if (arrete(r)) {
    for (const k of CHAMPS_EXIGES) sortie.write(`  ${k} : ${r[k]}\n`);
  }
  // L'annotation remonte au niveau du RUN, pas de l'étape : c'est le seul canal
  // qu'on voit sans ouvrir le journal.
  sortie.write(`::${ANNOTATION[r.etat]}::${ligne(r)}\n`);
  ajouter('GITHUB_STEP_SUMMARY', resume(r));
  ajouter('GITHUB_OUTPUT', `etat=${r.etat}\netat_code=${r.code || ''}\netat_json=${json}\n`);
  if (process.env.NEXUS_ETAT_FICHIER) {
    try { fs.writeFileSync(process.env.NEXUS_ETAT_FICHIER, json + '\n'); } catch (_) { /* le journal reste */ }
  }
  return r;
}

// ── PORTE D'ENTRÉE EN LIGNE DE COMMANDE ──────────────────────────────────────
// Les maillons qui refusaient en silence sont des étapes `run:` en bash. Elles
// ne peuvent pas `require` ce module ; sans cette porte, elles continueraient à
// faire `echo … ; exit 0`, et §4 resterait une intention.
//
// Cette porte ne décide rien. Elle traduit, et c'est délibéré : si elle
// déduisait l'état des arguments, il existerait deux endroits où l'état se
// détermine, et le second finirait par mentir sur le premier.
//
//   node outils/etat-maillon.js BLOCKED CODE --maillon m --condition c \
//        --sha s --branche b --lot l --prochaine-action p [--motif …] [--json …]
//
// Un mauvais usage rougit franchement. Ce n'est pas un refus de la chaîne à
// signaler proprement, c'est un appel fautif à corriger : le taire sous un
// `NO_WORK` serait remettre exactement le défaut qu'on ferme ici.
function principal(argv) {
  const [e, code] = argv.filter(a => !a.startsWith('--'));
  const champs = { etat: e, code };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const cle = argv[i].slice(2).replace(/-/g, '_');
    const val = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    if (cle === 'details') { try { champs.details = JSON.parse(val); } catch (_) { champs.details = { brut: val }; } }
    else champs[cle] = val;
  }
  const r = etat(champs);
  publier(r);
  return codeSortie(r);
}

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (err) {
    process.stdout.write(`::error::état de maillon inexploitable — ${err.message}\n`);
    process.stderr.write(err.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { ETATS, ETATS_QUI_ARRETENT, CHAMPS_EXIGES, etat, arrete, codeSortie, ligne, resume, publier, principal };
