#!/usr/bin/env node
'use strict';
// Enregistrement d'un arrêt de la chaîne dans docs/learning/INCIDENTS.jsonl —
// P8/2, conditions 2 et 3 de decision-3 (lot NEXUS-REPARATION-HANDOFF-1-20261014).
//
// Ce que l'outil fait : qualifier l'arrêt avec `classerArret` (P3, aucun second
// classeur) et, s'il n'est pas un arrêt humain voulu, ajouter UNE ligne au
// journal. Ce qu'il ne fait pas : committer, pousser, relancer, appeler le
// réseau ou un shell. Le câblage CI (commit sur le rail sous lease) est un
// autre geste, soumis à l'arbitrage.
//
// Append-only et idempotent : l'identifiant est dérivé de (code, lot, sha) ;
// rejouer le même arrêt ne change pas un octet ; une ligne existante n'est
// jamais réécrite, et un journal dont la dernière ligne n'est pas terminée est
// refusé plutôt que complété. Un incident s'ouvre ici ; il ne se clôt pas ici
// (EXPERIENCE.jsonl + promoted_rule + RULES.json + test GOV-002, étape suivante).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classerArret } = require('./watchdog-stagnation.js');
const { compter: compterRepetition } = require('./compteur-repetitions.js');

const RACINE = process.env.NEXUS_DEPOT ? path.resolve(process.env.NEXUS_DEPOT) : path.resolve(__dirname, '..');
const JOURNAL = ['docs', 'learning', 'INCIDENTS.jsonl'];
const SHA = /^[0-9a-f]{40}$/;
const LOT = /^[A-Z0-9][A-Z0-9-]{2,80}$/;

const identifiant = (code, lot, sha) =>
  'INC-' + crypto.createHash('sha256').update([code, lot, sha].join('\n')).digest('hex').slice(0, 12);

function lire(fichier) {
  if (!fs.existsSync(fichier)) return [];
  const brut = fs.readFileSync(fichier, 'utf8');
  if (brut && !brut.endsWith('\n')) throw new Error('journal : dernière ligne non terminée, refus de la compléter');
  return brut.split('\n').filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`journal : ligne ${i + 1} illisible`); }
  });
}

// e : { code, lot, sha, branche, capacite, derniereActivite, maintenant, run }
// o : { racine, ecrire } — `ecrire: false` mesure sans toucher au disque.
function enregistrer(e, o) {
  const opts = o || {};
  const racine = opts.racine || RACINE;
  const a = e || {};
  if (!SHA.test(String(a.sha || ''))) return { etat: 'REFUSE', raison: 'sha : 40 caractères hexadécimaux exigés' };
  if (!LOT.test(String(a.lot || ''))) return { etat: 'REFUSE', raison: 'lot : identifiant malformé' };
  const maintenant = Date.parse(a.maintenant);
  if (!Number.isFinite(maintenant)) return { etat: 'REFUSE', raison: 'maintenant : horodatage ISO exigé (aucune horloge implicite)' };

  const c = classerArret(a);
  if (c.humain) return { etat: 'NON_ENREGISTRE', raison: 'arrêt humain voulu : ce n’est pas un incident', classement: c };

  const id = identifiant(c.code, a.lot, a.sha);
  const fichier = path.join(racine, ...JOURNAL);
  const existants = lire(fichier);
  if (existants.some(x => x && x.id === id)) return { etat: 'DEJA_ENREGISTRE', id, classement: c };

  const ligne = {
    id, date: new Date(maintenant).toISOString(), type: 'workflow_stop', component: 'handoff',
    code: c.code, famille: c.famille, orpheline: c.orpheline, minutes: c.minutes, sensible: c.sensible,
    lot: a.lot, sha: a.sha, branche: a.branche ? String(a.branche) : null, run: a.run ? String(a.run) : null,
    statut: 'OUVERT',
  };
  if (opts.ecrire !== false) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.appendFileSync(fichier, JSON.stringify(ligne) + '\n');
  }
  // Compteur append-only des répétitions (item 2, lot NEXUS-INCIDENTS-CI-1).
  // `dejaVus` vient de la lecture déjà faite ci-dessus : un seul classeur, un
  // seul lecteur du journal des incidents.
  const repetition = compterRepetition(
    { id, code: c.code, date: ligne.date },
    { racine, ecrire: opts.ecrire, dejaVus: existants.map(x => x.code) },
  );
  return { etat: 'ENREGISTRE', id, ligne, classement: c, repetition };
}

module.exports = { enregistrer, identifiant, lire, JOURNAL };

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
  const r = enregistrer({
    code: arg('code'), lot: arg('lot'), sha: arg('sha'), branche: arg('branche'), capacite: arg('capacite'),
    derniereActivite: arg('derniere-activite'), maintenant: arg('maintenant'), run: arg('run'),
  }, { ecrire: process.argv.includes('--ecrire') });
  console.log(JSON.stringify(r));
  process.exit(r.etat === 'REFUSE' ? 1 : 0);
}
