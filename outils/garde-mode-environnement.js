#!/usr/bin/env node
// NEXUS — le dépôt et la base disent-ils le MÊME état d'environnement ?
//
// ARBITRAGE DE FRÉDÉRIC BRAGANCE, 09/09/2026 : `nexus-test` porte deux états
// logiques, `TEST_NORMAL` et `PREPROD_REHEARSAL`, et « il faut que NEXUS sache
// explicitement dans quel mode il est ».
//
// L'état est déclaré à DEUX endroits, et c'est volontaire : la base le porte
// (`public.nexus_environnement_mode`, une seule ligne par contrainte), et le
// dépôt le porte (`docs/handoff/PREPROD-CYCLE.json`, cycle ouvert ou non).
// Deux sources, une seule vérité : leur DÉSACCORD est l'information.
//
// POURQUOI C'EST LE CONTRÔLE QUI COMPTE. Chacune prise seule peut mentir sans
// qu'on le voie. La base en `PREPROD_REHEARSAL` alors que le registre est vide,
// c'est une répétition que personne ne suit et que personne ne nettoiera. Le
// registre ouvert alors que la base est revenue en `TEST_NORMAL`, c'est un
// cycle qu'on croit en cours et qui ne l'est plus. Les deux cas sont muets si
// l'on ne regarde qu'un côté.
//
// ET LA CONSÉQUENCE EST CONCRÈTE : une recette exécutée pendant une répétition
// juge des données structurées pour reproduire des cas Production, pas le jeu
// de recette normal. Ses verdicts porteraient sur autre chose que ce qu'on
// croit, en restant verts.

'use strict';
const fs = require('fs');
const path = require('path');

const MODES = ['TEST_NORMAL', 'PREPROD_REHEARSAL'];
const CYCLE = path.join(__dirname, '..', 'docs', 'handoff', 'PREPROD-CYCLE.json');

function lireCycles(chemin) {
  try {
    const d = JSON.parse(fs.readFileSync(chemin || CYCLE, 'utf8'));
    return Array.isArray(d.cycles) ? d.cycles : null;
  } catch (e) {
    return null;
  }
}

// Fonction PURE. `modeEnBase` vient d'une lecture SQL, `cycles` du dépôt.
function controler({ modeEnBase, cycles }) {
  if (!Array.isArray(cycles)) {
    return { code: 'REGISTRE_ILLISIBLE' };
  }
  const mode = typeof modeEnBase === 'string' ? modeEnBase.trim() : '';
  if (!mode) {
    // Ne pas savoir dans quel environnement on est n'est pas « le mode normal ».
    return { code: 'MODE_NON_LU' };
  }
  if (!MODES.includes(mode)) {
    return { code: 'MODE_INCONNU', mode };
  }

  const ouverts = cycles.filter(c => c && !c.detruit_le);

  if (mode === 'PREPROD_REHEARSAL' && ouverts.length === 0) {
    return { code: 'REPETITION_NON_SUIVIE', mode };
  }
  if (mode === 'TEST_NORMAL' && ouverts.length > 0) {
    return { code: 'CYCLE_ORPHELIN', mode, ouverts: ouverts.map(c => c.projet_ref || c.release || '(sans nom)') };
  }
  if (mode === 'PREPROD_REHEARSAL' && ouverts.length > 1) {
    return { code: 'CYCLES_MULTIPLES', mode, ouverts: ouverts.map(c => c.release || '(sans release)') };
  }
  return { code: 'ACCORD', mode, release: ouverts.length ? (ouverts[0].release || null) : null };
}

module.exports = { controler, lireCycles, MODES };

if (require.main === module) {
  const r = controler({ modeEnBase: process.argv[2], cycles: lireCycles() });
  switch (r.code) {
    case 'REGISTRE_ILLISIBLE':
      console.error('Registre PREPROD illisible : aucune conclusion sur le mode d’environnement.');
      process.exit(1);
    case 'MODE_NON_LU':
      console.error('Mode d’environnement NON LU en base.');
      console.error('Ne pas savoir dans quel environnement on est n’est pas « le mode normal ».');
      process.exit(1);
    case 'MODE_INCONNU':
      console.error(`Mode d’environnement hors vocabulaire : « ${r.mode} ».`);
      console.error(`Attendu : ${MODES.join(' ou ')}.`);
      process.exit(1);
    case 'REPETITION_NON_SUIVIE':
      console.error('La base est en PREPROD_REHEARSAL, mais AUCUN cycle n’est ouvert au registre.');
      console.error('Une répétition que personne ne suit est une répétition que personne ne nettoiera.');
      process.exit(1);
    case 'CYCLE_ORPHELIN': {
      console.error(`La base est en TEST_NORMAL, mais ${r.ouverts.length} cycle(s) restent ouverts : ${r.ouverts.join(', ')}.`);
      console.error('On croit une répétition en cours ; elle ne l’est plus. Fermer le cycle par `detruit_le`.');
      // INSTRUMENTATION (10/09/2026), distincte de toute correction.
      //
      // Le 10/09, ce refus a arrêté la CI sur un cycle ouvert au nom de
      // `zzzzrefdetestinexistante`, une référence de FIXTURE employée par trois
      // épreuves qui lancent les scripts de répétition. Le registre versionné
      // est pourtant propre, et la pollution n'a pas pu être reproduite en
      // local : ni la suite complète deux fois, ni les cinq épreuves
      // concernées en parallèle huit fois, ni la suite à largeur 4 comme le
      // runner. CAUSE NON ISOLEE.
      //
      // Le message ne disait que le `projet_ref`. Il dit désormais l'entrée
      // entière et la date de dernière écriture du fichier : de quoi savoir,
      // à la prochaine occurrence, si le registre a été écrit PENDANT le job
      // et par quoi. Sans cela, chaque occurrence recommence l'enquête.
      try {
        const detail = (lireCycles() || []).filter(c => c && !c.detruit_le);
        for (const c of detail) console.error(`  cycle ouvert : ${JSON.stringify(c)}`);
        console.error(`  registre modifie le : ${fs.statSync(CYCLE).mtime.toISOString()}`);
      } catch (e) { console.error('  detail du registre illisible.'); }
      process.exit(1);
    }
    case 'CYCLES_MULTIPLES':
      console.error(`Plusieurs cycles ouverts pour une seule base : ${r.ouverts.join(', ')}.`);
      process.exit(1);
    default:
      console.log(`Mode d’environnement : ${r.mode}${r.release ? ` (release ${r.release})` : ''} — dépôt et base d’accord.`);
      process.exit(0);
  }
}
