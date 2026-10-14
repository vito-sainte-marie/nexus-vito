#!/usr/bin/env node
'use strict';
// Compteur append-only des répétitions — item 2 de la demande successeur de
// decision-4 (lot NEXUS-REPARATION-HANDOFF-1-20261014), implémenté dans le
// lot NEXUS-INCIDENTS-CI-1-20261014.
//
// Ce que ce module fait : constater qu'un `code` d'incident déjà vu au
// journal (docs/learning/INCIDENTS.jsonl) revient sous un incident NOUVEAU
// (autre id, donc autre lot ou autre sha), et en ajouter la trace dans
// docs/learning/REPETITIONS.jsonl. Ce qu'il ne fait pas : maintenir un champ
// numérique mutable. Le compte n'est jamais stocké : il se LIT en comptant
// les lignes du journal qui portent ce `code`, pour la même raison que
// INCIDENTS.jsonl ne porte pas de champ `statut` recalculé — un total
// qu'on écrit se corrompt d'un rejeu mal rejoué ; un total qu'on compte ne
// peut pas diverger de ses propres lignes.
//
// Append-only : une entrée déjà présente pour un `id` donné n'est jamais
// réécrite ni dupliquée. Idempotent : rejouer le même incident ne change pas
// un octet. Sans effet de bord hors ce fichier : aucun shell, aucun réseau.
const fs = require('fs');
const path = require('path');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const JOURNAL = ['docs', 'learning', 'REPETITIONS.jsonl'];

function lire(fichier) {
  if (!fs.existsSync(fichier)) return [];
  const brut = fs.readFileSync(fichier, 'utf8');
  if (brut && !brut.endsWith('\n')) throw new Error('journal des répétitions : dernière ligne non terminée, refus de la compléter');
  return brut.split('\n').filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`journal des répétitions : ligne ${i + 1} illisible`); }
  });
}

// e : { id, code, date } — l'id et le code d'un incident déjà qualifié par
// enregistrer-incident.js (NON requalifié ici : aucun second classeur).
// o : { racine, ecrire, dejaVus } — `dejaVus` est la liste des codes déjà
// présents dans INCIDENTS.jsonl AVANT cet incident (fournie par l'appelant,
// qui l'a déjà lue) : ce module ne lit jamais INCIDENTS.jsonl lui-même, pour
// qu'un seul endroit décide de ce qu'est « déjà vu ».
function compter(e, o) {
  const opts = o || {};
  const racine = opts.racine || RACINE;
  const a = e || {};
  if (!a.id || typeof a.id !== 'string') return { etat: 'REFUSE', raison: 'id : identifiant d\'incident exigé' };
  if (!a.code || typeof a.code !== 'string') return { etat: 'REFUSE', raison: 'code : requis' };
  if (!a.date || !Number.isFinite(Date.parse(a.date))) return { etat: 'REFUSE', raison: 'date : horodatage ISO exigé' };

  const fichier = path.join(racine, ...JOURNAL);
  const existants = lire(fichier);
  if (existants.some(x => x && x.id === a.id)) {
    return { etat: 'DEJA_COMPTE', occurrence: existants.filter(x => x.code === a.code).length };
  }

  const dejaVus = Array.isArray(opts.dejaVus) ? opts.dejaVus : [];
  if (!dejaVus.includes(a.code)) return { etat: 'PREMIERE_OCCURRENCE' };

  const occurrence = existants.filter(x => x.code === a.code).length + 2;
  const ligne = { id: a.id, code: a.code, date: new Date(Date.parse(a.date)).toISOString(), occurrence };
  if (opts.ecrire !== false) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.appendFileSync(fichier, JSON.stringify(ligne) + '\n');
  }
  return { etat: 'ENREGISTRE', ligne, occurrence };
}

// Lecture seule : le total de répétitions pour un code, tel qu'il se compte
// sur le journal, jamais tel qu'il se stocke.
function total(code, o) {
  const opts = o || {};
  const racine = opts.racine || RACINE;
  return lire(path.join(racine, ...JOURNAL)).filter(x => x.code === code).length;
}

module.exports = { compter, total, lire, JOURNAL };
