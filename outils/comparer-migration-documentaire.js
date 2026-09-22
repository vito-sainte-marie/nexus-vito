#!/usr/bin/env node
// Comparateur read-only : une migration déjà appliquée diverge-t-elle du
// rail seulement dans ses COMMENTAIRES, ou aussi dans sa LOGIQUE SQL ?
//
// `test_migrations_immuables_20260905.js` traite toute divergence de contenu
// comme suspecte — à raison : une migration appliquée est immuable. Mais
// « divergent » ne dit pas SI la divergence touche ce qui s'exécute. Ce
// module répond à cette question précise, sans jamais modifier ni la
// migration ni Production : il lit, normalise virtuellement (en mémoire),
// compare, et rapporte. Rien n'est écrit sur disque.
//
// RÈGLE DE NORMALISATION : seules les lignes dont le contenu, une fois
// dépouillé des espaces de tête, commence par `--` (commentaire SQL pleine
// ligne) sont retirées. Un commentaire EN FIN de ligne de code n'est jamais
// une ligne pleine ligne de commentaire : il reste comparé tel quel, pour ne
// jamais laisser une vraie divergence de logique se cacher derrière `--`.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function estLigneCommentairePleine(ligne) {
  return /^\s*--/.test(ligne);
}

// Sépare un texte SQL en { lignesCommentaire, lignesCode }, dans l'ordre
// d'origine, sans jamais réordonner ni fusionner.
function separerCommentaires(texte) {
  const lignes = texte.split('\n');
  const lignesCode = [];
  const lignesCommentaire = [];
  for (const l of lignes) {
    if (estLigneCommentairePleine(l)) lignesCommentaire.push(l);
    else lignesCode.push(l);
  }
  return { lignesCode, lignesCommentaire };
}

// Compare deux contenus SQL. Ne modifie ni n'écrit rien : purement en
// mémoire. `nomA`/`nomB` ne servent qu'au rapport lisible.
function comparerContenus(contenuA, contenuB, nomA = 'A', nomB = 'B') {
  if (contenuA === contenuB) {
    return { verdict: 'IDENTIQUE', seulementCommentaires: false, diffLogique: [] };
  }
  const a = separerCommentaires(contenuA);
  const b = separerCommentaires(contenuB);
  const codeA = a.lignesCode.join('\n');
  const codeB = b.lignesCode.join('\n');

  if (codeA === codeB) {
    // Le SQL exécutable est identique octet pour octet une fois les lignes de
    // commentaire pleine ligne retirées des deux côtés : la divergence ne
    // porte que sur des commentaires.
    return {
      verdict: 'DIVERGENCE_DOCUMENTAIRE',
      seulementCommentaires: true,
      diffLogique: [],
      commentairesUniquementDansA: a.lignesCommentaire.filter(l => !b.lignesCommentaire.includes(l)),
      commentairesUniquementDansB: b.lignesCommentaire.filter(l => !a.lignesCommentaire.includes(l)),
      lignesCodeA: a.lignesCode.length,
      lignesCodeB: b.lignesCode.length,
    };
  }

  // Le code exécutable diverge aussi : jamais certifié « documentaire
  // seulement », quel que soit l'état des commentaires par ailleurs.
  const lignesA = a.lignesCode;
  const lignesB = b.lignesCode;
  const max = Math.max(lignesA.length, lignesB.length);
  const diffLogique = [];
  for (let i = 0; i < max; i++) {
    if (lignesA[i] !== lignesB[i]) {
      diffLogique.push({ index: i, [nomA]: lignesA[i] ?? '∅', [nomB]: lignesB[i] ?? '∅' });
    }
  }
  return { verdict: 'DIVERGENCE_LOGIQUE', seulementCommentaires: false, diffLogique };
}

function git(...args) {
  return execFileSync('git', args, { cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

// LA RÉFÉRENCE DE PRODUCTION EST LA REF DISTANTE, JAMAIS LA COPIE LOCALE.
// `origin/production` est l'état publié, celui que GitHub Pages sert ; une
// branche locale `production` n'est qu'une intention, et elle peut être en
// retard de semaines sans que rien ne le dise. Le 21/09/2026 elle valait
// 501c0c7 quand `origin/production` valait 2bc7b39 : ce comparateur, qui
// essayait `production` EN PREMIER, répondait « exists on disk, but not in
// 'production' » sur une migration bel et bien publiée. L'ordre n'est pas un
// confort d'écriture, il décide de ce qui est mesuré — et une garde qui mesure
// une copie en retard ne mord sur rien. `outils/garde-env-001.js` énonce déjà
// la règle ; ici elle était inversée. Une ref locale n'est donc acceptée qu'en
// dernier recours, et jamais en silence.
//
// `git` et `avertir` sont injectables : un dépôt sans ref distante ne se
// fabrique pas depuis le dépôt réel, et sans pouvoir le provoquer on n'aurait
// pas vérifié l'ordre lui-même.
function refProduction(options = {}) {
  const g = options.git || git;
  const avertir = options.avertir || (m => console.error(m));
  for (const ref of ['refs/remotes/origin/production', 'origin/production']) {
    try { g('rev-parse', '--verify', `${ref}^{commit}`); return ref; } catch (e) { /* suivant */ }
  }
  try {
    g('rev-parse', '--verify', 'production^{commit}');
    avertir('AVERTISSEMENT — aucune ref distante `origin/production` : comparaison contre la copie '
      + 'locale `production`, qui peut être en retard sans le dire. Récupérer l\'état publié avant '
      + 'de conclure : git fetch origin production');
    return 'production';
  } catch (e) { /* aucune des trois */ }
  return null;
}

// Compare le fichier du rail à sa version sur la branche `production`.
// Lecture pure (fs.readFileSync + git show) : n'écrit et n'exécute aucun SQL.
// `git` et `avertir` traversent jusqu'au résolveur : sans cela, le cas « aucune
// référence de production » ne se provoque pas, et le refus de conclure reste
// non vérifié — c'est-à-dire non acquis.
function comparerMigrationAvecProduction(cheminRelatifMigration, { ref, git: gitInjecte, avertir } = {}) {
  const g = gitInjecte || git;
  const racine = path.resolve(__dirname, '..');
  const cheminAbs = path.join(racine, 'supabase', 'migrations', cheminRelatifMigration);
  const REF = ref || refProduction({ git: g, avertir });
  if (!REF) throw new Error('référence de production introuvable (ni `origin/production` ni `production`) : impossible de comparer sans elle — `git fetch origin production`');
  const contenuRail = fs.readFileSync(cheminAbs, 'utf8');
  const contenuProduction = g('show', `${REF}:supabase/migrations/${cheminRelatifMigration}`);
  const resultat = comparerContenus(contenuProduction, contenuRail, 'production', 'rail');
  return { ...resultat, ref: REF, chemin: cheminRelatifMigration, octetsProduction: contenuProduction.length, octetsRail: contenuRail.length };
}

if (require.main === module) {
  const chemin = process.argv[2];
  if (!chemin) {
    console.error('Usage: node outils/comparer-migration-documentaire.js <fichier.sql sous supabase/migrations/>');
    process.exit(2);
  }
  try {
    const r = comparerMigrationAvecProduction(chemin);
    console.log(`Référence de production : ${r.ref}`);
    console.log(`Verdict : ${r.verdict}`);
    console.log(`Octets — production: ${r.octetsProduction}, rail: ${r.octetsRail}`);
    if (r.verdict === 'DIVERGENCE_DOCUMENTAIRE') {
      console.log(`Lignes de commentaire présentes SEULEMENT en production (${r.commentairesUniquementDansA.length}) :`);
      r.commentairesUniquementDansA.forEach(l => console.log(`  ${l}`));
      console.log(`Lignes de commentaire présentes SEULEMENT sur le rail (${r.commentairesUniquementDansB.length}) :`);
      r.commentairesUniquementDansB.forEach(l => console.log(`  ${l}`));
      console.log('\nAucune divergence de logique SQL — le SQL exécutable est identique octet pour octet après retrait des lignes de commentaire pleine ligne.');
      process.exit(0);
    }
    if (r.verdict === 'DIVERGENCE_LOGIQUE') {
      console.error('\nDivergence de LOGIQUE détectée — jamais certifiable « documentaire seulement » :');
      r.diffLogique.forEach(d => console.error(`  ligne ${d.index}: production=${JSON.stringify(d.production)} rail=${JSON.stringify(d.rail)}`));
      process.exit(1);
    }
    console.log('Contenus identiques, aucune divergence.');
    process.exit(0);
  } catch (e) {
    console.error(`ERREUR — ${e.message}`);
    process.exit(3);
  }
}

module.exports = { estLigneCommentairePleine, separerCommentaires, comparerContenus, comparerMigrationAvecProduction, refProduction };
