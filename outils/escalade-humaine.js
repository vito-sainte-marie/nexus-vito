#!/usr/bin/env node
'use strict';
// Escalade humaine — qui doit trancher : l'arbitre désigné, ou Frédéric ?
//
// POURQUOI. Le 07/10/2026, Frédéric : l'arbitre (ChatGPT) lui « redemande des
// arbitrages déjà pris ». Mesuré dans le dépôt : le réveil Orchestrateur ne
// disait que « Arbitre cette demande », sans rappeler ni la délégation ni les
// décisions déjà rendues, et la liste STOP du skill renvoyait à Frédéric dix
// motifs dont la moitié ne relève que de l'arbitre (CI rouge, conflit, preuve
// manquante…). Un arbitre sans mémoire, devant une liste trop large, remonte
// tout. `docs/gouvernance/DOCTRINE-FAST-TRACK-SITE-READY.md` § 3 bis fixe
// désormais deux paliers ; ce module les mécanise.
//
// CE QUE CE MODULE FAIT. `escalader` répond à « faut-il réveiller Frédéric ? »
// à partir d'un motif CODÉ et, le cas échéant, de l'acquis cité :
//   - motif du palier `frederic` → ESCALADE_FREDERIC, quoi qu'on cite d'autre :
//     aucun acquis ne délègue la Production, un secret ou la doctrine ;
//   - acquis connu (et applicable au lot) → DEJA_ARBITRE, avec sa réponse et
//     sa source : la question ne se repose pas ;
//   - motif du palier `arbitre` → ARBITRE_TRANCHE ;
//   - pas de motif, ou un motif inconnu → reste chez l'arbitre. Une inquiétude
//     en texte libre n'atteint jamais Frédéric : c'est exactement ce qui
//     produisait les re-demandes.
// `verifierRegistre` refuse un registre dont le routage ne partitionne pas
// MOTIFS_STOP_FERMES, ou dont un acquis cite une ancre introuvable dans sa
// source. `blocMandat` produit le texte que le réveil envoie à l'arbitre.
//
// CE QUE CE MODULE NE FAIT PAS. Il ne réveille personne, n'écrit rien et ne
// décide aucun arbitrage : il ne fait que retrouver ceux qui sont déjà écrits.
// La liste des motifs fermés reste dans `classification-canal.js` ; le
// routage et les acquis restent dans `docs/handoff/ARBITRAGES-ACQUIS.json`.

const fs = require('fs');
const path = require('path');
const { MOTIFS_STOP_FERMES } = require('./classification-canal.js');

const RACINE = path.resolve(__dirname, '..');
const FICHIER_REGISTRE = path.join('docs', 'handoff', 'ARBITRAGES-ACQUIS.json');

const VERDICTS = Object.freeze({
  ESCALADE_FREDERIC: 'ESCALADE_FREDERIC',
  DEJA_ARBITRE: 'DEJA_ARBITRE',
  ARBITRE_TRANCHE: 'ARBITRE_TRANCHE',
  SANS_MOTIF_CODE: 'SANS_MOTIF_CODE',
  MOTIF_INCONNU: 'MOTIF_INCONNU',
  ACQUIS_INCONNU: 'ACQUIS_INCONNU',
});

function chargerRegistre(racine) {
  return JSON.parse(fs.readFileSync(path.join(racine || RACINE, FICHIER_REGISTRE), 'utf8'));
}

function acquisApplicable(a, lot) {
  return a.portee === 'tous lots' || (lot != null && a.portee === lot);
}

/** @param {{motif?: string, acquis?: string, lot?: string}} q */
function escalader(q, registre) {
  const reg = registre || chargerRegistre();
  const { motif, acquis, lot } = q || {};
  const frederic = new Set(reg.routage.frederic);
  const arbitre = new Set(reg.routage.arbitre);
  const vers = (destinataire, verdict, extra) => Object.assign({ destinataire, verdict, motif: motif || null }, extra || {});

  if (motif && frederic.has(motif)) return vers('Frédéric', VERDICTS.ESCALADE_FREDERIC);
  if (acquis) {
    const a = reg.acquis.find(x => x.id === acquis);
    if (!a || !acquisApplicable(a, lot)) return vers('arbitre', VERDICTS.ACQUIS_INCONNU, { acquis });
    return vers('arbitre', VERDICTS.DEJA_ARBITRE, { acquis: a.id, reponse: a.reponse, source: a.source });
  }
  if (!motif) return vers('arbitre', VERDICTS.SANS_MOTIF_CODE);
  if (arbitre.has(motif)) return vers('arbitre', VERDICTS.ARBITRE_TRANCHE);
  return vers('arbitre', VERDICTS.MOTIF_INCONNU);
}

/** Liste les défauts du registre ; vide = conforme. */
function verifierRegistre(registre, racine, motifsFermes) {
  const reg = registre || chargerRegistre(racine);
  const fermes = motifsFermes || MOTIFS_STOP_FERMES;
  const base = racine || RACINE;
  const defauts = [];
  const vus = new Map();
  for (const palier of ['frederic', 'arbitre']) {
    for (const m of reg.routage[palier]) {
      if (vus.has(m)) defauts.push(`motif ${m} routé deux fois (${vus.get(m)} et ${palier})`);
      vus.set(m, palier);
    }
  }
  for (const m of fermes) if (!vus.has(m)) defauts.push(`motif fermé ${m} non routé`);
  for (const m of reg.routage.arbitre) if (!fermes.includes(m)) defauts.push(`motif arbitre ${m} absent de MOTIFS_STOP_FERMES`);
  const ids = new Set();
  const sources = [reg.routage.source].concat(reg.acquis.map(a => a.source));
  for (const a of reg.acquis) {
    if (ids.has(a.id)) defauts.push(`acquis ${a.id} en double`);
    ids.add(a.id);
    for (const champ of ['question', 'reponse', 'portee']) if (!a[champ]) defauts.push(`acquis ${a.id} sans ${champ}`);
  }
  for (const s of sources) {
    const f = path.join(base, s.fichier);
    if (!fs.existsSync(f)) { defauts.push(`source absente : ${s.fichier}`); continue; }
    if (!fs.readFileSync(f, 'utf8').includes(s.ancre)) defauts.push(`ancre introuvable dans ${s.fichier} : « ${s.ancre} »`);
  }
  return defauts;
}

/** Le mandat que le réveil envoie à l'arbitre. Généré, jamais recopié. */
function blocMandat(registre, lot) {
  const reg = registre || chargerRegistre();
  return [
    'Mandat de l\'arbitre (généré depuis `docs/handoff/ARBITRAGES-ACQUIS.json`) :',
    '- Tu es l\'arbitre pré-autorisé de cette demande. Ta décision tient lieu de GO :',
    '  ne demande pas à Frédéric de la confirmer.',
    '- Ne repose aucune question déjà tranchée ci-dessous ; cite l\'acquis et avance.',
    '- Réveille Frédéric UNIQUEMENT pour l\'un de ces motifs, nommé dans ta décision :',
    '  ' + reg.routage.frederic.map(m => '`' + m + '`').join(', ') + '.',
    '- Tout autre obstacle (CI rouge, conflit, preuve manquante, périmètre) se',
    '  tranche ici : refuse, ou demande la preuve, ou approuve avec conditions.',
    '- Une condition ne doit jamais exiger un GO humain hors de ces motifs.',
    '',
    'Arbitrages déjà rendus :',
    ...reg.acquis.filter(a => acquisApplicable(a, lot))
      .map(a => `- \`${a.id}\` — ${a.question} → ${a.reponse} _(source : \`${a.source.fichier}\`)_`),
  ].join('\n');
}

module.exports = { VERDICTS, FICHIER_REGISTRE, chargerRegistre, escalader, verifierRegistre, blocMandat };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv.includes('--verifier')) {
    const d = verifierRegistre();
    for (const x of d) console.log('❌ ' + x);
    console.log(d.length ? `REGISTRE_NON_CONFORME (${d.length})` : 'REGISTRE_CONFORME');
    process.exit(d.length ? 1 : 0);
  } else if (process.argv.includes('--mandat')) {
    console.log(blocMandat(null, arg('--lot')));
  } else {
    console.log(JSON.stringify(escalader({ motif: arg('--motif'), acquis: arg('--acquis'), lot: arg('--lot') }), null, 2));
  }
}
