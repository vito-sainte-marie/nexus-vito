#!/usr/bin/env node
'use strict';
// Watchdog de stagnation de la chaîne Handoff.
//
// LA QUESTION QU'IL RÉPOND. Le 30/09/2026 à 17 h, zéro workflow tournait sur le
// dépôt. Deux lectures possibles, opposées : « tout est fait, c'est le repos »
// ou « quelque chose attend et personne ne le sait ». Rien dans NEXUS ne savait
// les distinguer. Un réveil publié à 18:29:30Z est resté sans réponse, et ce
// silence ressemblait exactement à du repos. Ce module rend les deux états
// discernables — et c'est tout ce qu'il fait.
//
// CE QU'IL NE FAIT PAS. Il ne réveille personne, n'écrit nulle part, ne relance
// aucun run. Il constate et nomme. Un watchdog qui agit est un watchdog qui
// peut boucler ; celui-ci rend un état, et l'appelant décide.
//
// LA PROGRESSION N'EST PAS L'ACTIVITÉ. Un nouveau run n'est pas une
// progression : la chaîne peut tourner indéfiniment sur place — Claude, CI,
// Claude — en produisant des runs neufs et un état identique. La progression se
// mesure donc sur le triplet (position, SHA, décision), jamais sur l'existence
// d'un run. Deux cycles de même empreinte valent arrêt, quel que soit le nombre
// de runs verts entre les deux.
//
// POURQUOI LES NO_WORK RESTENT VERTS. « Ne transforme pas tous les NO_WORK
// légitimes en erreurs CI. » Le repos est l'état normal de cette chaîne la
// plupart du temps. Un watchdog qui rougit au repos apprend à l'équipe à
// ignorer le rouge, ce qui reproduit l'aveuglement par l'autre bout.
//
// POURQUOI UNE DATE MANQUANTE EST UN REFUS. On ne mesure pas une stagnation
// sans horloge. Ce dépôt a déjà fabriqué des durées faute de borne — jusqu'à
// 2 j 00 h 24 en Production. Ici, pas de date : pas de mesure, et on le dit.

const { etat } = require('./etat-maillon.js');

const MAILLON = 'watchdog-stagnation';

// ── LES POSITIONS DE LA CHAÎNE ───────────────────────────────────────────────
// Une position n'est pas un état de workflow : c'est l'endroit où le travail
// est arrêté dans la chaîne demande → … → continuation.

// Terminales : plus rien n'est attendu de la machine. Le repos y est normal.
const TERMINAUX = Object.freeze({
  AUCUNE_DEMANDE: 'aucune demande en vol',
  LOT_CLOS: 'le lot est clos',
  DECISION_HUMAINE_REQUISE: 'la chaîne attend un geste réservé à Frédéric',
  REPRISES_EPUISEES: 'le nombre de reprises est épuisé',
});

// Continuation attendue, et délai au-delà duquel l'absence de progrès est une
// stagnation. Ces délais bornent un maillon qui prend des secondes ; ils sont
// larges à dessein — on cherche l'arrêt, pas la lenteur.
const CONTINUATION = Object.freeze({
  DEMANDE_DEPOSEE:  { minutes: 45, suite: 'publier le réveil de l’Orchestrateur' },
  REVEIL_PUBLIE:    { minutes: 45, suite: 'un run Claude doit consommer le réveil' },
  RUN_EN_COURS:     { minutes: 60, suite: 'le run Claude doit conclure' },
  BRANCHE_POUSSEE:  { minutes: 30, suite: 'la CI de la branche de run doit conclure' },
  CI_VERTE:         { minutes: 30, suite: 'qualifier puis rapatrier le résultat vers le rail' },
  CI_ROUGE:         { minutes: 45, suite: 'un nouveau run Claude doit corriger' },
  RAPATRIE:         { minutes: 30, suite: 'la CI du rail doit conclure' },
  RAIL_VERT:        { minutes: 45, suite: 'publier le réveil suivant' },
});

const MAX_REPRISES = 3;              // par (lot, demande)
const CYCLES_SANS_PROGRES = 2;       // deux empreintes identiques = sur place
const TOLERANCE_HORLOGE_MS = 2 * 60 * 1000;

const vide = (v) => v === undefined || v === null || String(v).trim() === '';

// L'empreinte de progression. Volontairement AVEUGLE au numéro de run, à
// l'horodatage et à l'auteur : deux cycles qui n'ont fait avancer ni la
// position, ni le SHA, ni la décision ont la même empreinte, et c'est
// exactement ce qu'on veut voir.
function empreinte(e) {
  const c = e || {};
  return [
    String(c.position || '(sans position)').trim(),
    String(c.sha || '(sans sha)').trim(),
    String(c.decision || '(sans décision)').trim(),
  ].join('|');
}

function instant(v) {
  if (vide(v)) return null;
  const t = (typeof v === 'number') ? v : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

function examiner(e) {
  const a = e || {};
  const lot = vide(a.lot) ? '(inconnu)' : String(a.lot).trim();
  const sha = vide(a.sha) ? '(inconnu)' : String(a.sha).trim();
  const branche = vide(a.branche) ? '(inconnue)' : String(a.branche).trim();
  const position = vide(a.position) ? '' : String(a.position).trim();
  const base = { sha, branche, lot, maillon: MAILLON };
  const arret = (etatMachine, code, condition, prochaine_action, details) => etat(Object.assign(
    { etat: etatMachine, code, condition, prochaine_action }, base, details ? { details } : {}));

  // ── A. LA POSITION DOIT ÊTRE DÉCLARÉE ──────────────────────────────────────
  // Une position ne se devine pas du contexte ambiant. « Une désignation ne se
  // recalcule pas » : quatre fois déjà, dériver ce qu'un humain avait désigné
  // ailleurs a produit le même défaut.
  if (!position) {
    return arret('BLOCKED', 'POSITION_NON_DECLAREE',
      'aucune position de chaîne n’est déclarée pour ce lot',
      'déclarer la position du lot parmi ' + [...Object.keys(TERMINAUX), ...Object.keys(CONTINUATION)].join(', '));
  }
  if (!TERMINAUX[position] && !CONTINUATION[position]) {
    return arret('BLOCKED', 'POSITION_INCONNUE',
      `position « ${position} » hors de la liste fermée`,
      'corriger la position ou étendre explicitement la liste du watchdog');
  }

  // ── B. LE REPOS EST UN ÉTAT NORMAL ─────────────────────────────────────────
  if (TERMINAUX[position]) {
    const humaine = position === 'DECISION_HUMAINE_REQUISE' || position === 'REPRISES_EPUISEES';
    if (humaine) {
      return arret('HUMAN_DECISION_REQUIRED', position,
        TERMINAUX[position],
        'Frédéric doit trancher ; la chaîne ne reprendra pas seule');
    }
    return etat(Object.assign({ etat: 'NO_WORK', code: 'REPOS',
      condition: TERMINAUX[position] }, base));
  }

  const attendu = CONTINUATION[position];

  // ── C. LES REPRISES SONT BORNÉES ───────────────────────────────────────────
  // Sans borne, une chaîne autonome qui échoue réessaie pour toujours. La borne
  // est ce qui transforme une boucle en arrêt nommé.
  const reprises = Number(a.reprises || 0);
  const max = Number.isFinite(Number(a.maxReprises)) ? Number(a.maxReprises) : MAX_REPRISES;
  if (reprises >= max) {
    return arret('HUMAN_DECISION_REQUIRED', 'REPRISES_EPUISEES',
      `${reprises} reprise(s) pour ce lot, borne ${max}`,
      'Frédéric doit examiner pourquoi la correction automatique n’aboutit pas',
      { reprises, borne: max });
  }

  // ── D. TOURNER N'EST PAS AVANCER ───────────────────────────────────────────
  const historique = Array.isArray(a.historique) ? a.historique : [];
  const courante = empreinte({ position, sha: a.sha, decision: a.decision });
  const derniers = historique.slice(-(CYCLES_SANS_PROGRES - 1)).map(empreinte);
  if (derniers.length === CYCLES_SANS_PROGRES - 1 && derniers.every(x => x === courante)) {
    return arret('BLOCKED', 'AUCUNE_PROGRESSION',
      `${CYCLES_SANS_PROGRES} cycles de même empreinte « ${courante} » : la chaîne tourne sans avancer`,
      'interrompre la relance automatique et diagnostiquer le maillon qui ne produit rien',
      { empreinte: courante, cycles: CYCLES_SANS_PROGRES });
  }

  // ── E. L'HORLOGE ───────────────────────────────────────────────────────────
  const maintenant = instant(a.maintenant);
  const activite = instant(a.derniereActivite);
  if (maintenant === null || activite === null) {
    return arret('BLOCKED', 'ACTIVITE_NON_DATEE',
      'la dernière activité ou l’instant courant n’est pas une date exploitable',
      'dater la dernière activité du lot ; sans horloge, aucune stagnation ne se mesure');
  }
  if (activite - maintenant > TOLERANCE_HORLOGE_MS) {
    return arret('BLOCKED', 'HORLOGE_INCOHERENTE',
      'la dernière activité est postérieure à l’instant courant',
      'corriger la source d’horodatage avant toute mesure de stagnation');
  }
  const ecoulees = Math.max(0, Math.round((maintenant - activite) / 60000));

  // ── F. LA STAGNATION ───────────────────────────────────────────────────────
  if (ecoulees >= attendu.minutes) {
    // Le cas nommé de la mission : verte et jamais rapatriée.
    const code = position === 'CI_VERTE' ? 'RESULTAT_NON_RAPATRIE' : 'STAGNATION';
    return arret('BLOCKED', code,
      `position ${position} inchangée depuis ${ecoulees} min (délai ${attendu.minutes} min)`,
      attendu.suite,
      { position, minutes_ecoulees: ecoulees, delai_minutes: attendu.minutes });
  }

  // ── G. NE PAS RÉVEILLER DEUX FOIS POUR LA MÊME CHOSE ───────────────────────
  // La déduplication vient APRÈS la stagnation : un réveil déjà publié explique
  // le silence tant que le délai court, il ne l'excuse plus après.
  const signature = [lot, String(a.demande || '(sans demande)').trim(), position, sha].join('|');
  const publies = Array.isArray(a.reveilsPublies) ? a.reveilsPublies.map(String) : [];
  if (publies.includes(signature)) {
    return etat(Object.assign({ etat: 'NO_WORK', code: 'REVEIL_DEJA_PUBLIE',
      condition: `un réveil « ${signature} » est déjà publié ; ${ecoulees} min écoulées sur ${attendu.minutes}`,
    }, base));
  }

  return etat(Object.assign({ etat: 'NO_WORK', code: 'EN_COURS',
    condition: `${position} depuis ${ecoulees} min (délai ${attendu.minutes} min) : ${attendu.suite}`,
  }, base));
}

module.exports = { examiner, empreinte, MAILLON, TERMINAUX, CONTINUATION, MAX_REPRISES, CYCLES_SANS_PROGRES };
