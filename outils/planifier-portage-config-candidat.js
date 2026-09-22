#!/usr/bin/env node
'use strict';
// Plan de portage de la chaîne de build/config vers un candidat web (22/09/2026).
//
// POURQUOI CE FICHIER EXISTE. #62 et #65 ne peuvent pas être testés en Test
// isolé aujourd'hui : ni la chaîne de build (outils/build.sh,
// outils/generer-config.js, outils/poser-build-id.js, nexus-page.js,
// nexus-bandeau-environnement.js), ni `nexus-auth.js` refondu (qui lit
// `window.NEXUS_CONFIG` au lieu de coder Production en dur), ni `_headers`
// (la règle `no-store` Cloudflare pour `nexus-config.js`), n'existent sur ces
// branches — mesuré dans `etude-isolation-test-candidats-web-1.md` du lot
// NEXUS-CONTINUITE-TERRAIN-2-20260922, puis confronté une seconde fois ici :
// `outils/poser-build-id.js` s'y trouve déjà, mais figé sur une génération
// antérieure au 05/09/2026 (identité par horodatage, pas par empreinte de
// contenu) — un septième écart que l'étude n'avait pas nommé.
//
// `decision-2.md` du même lot est explicite : ce portage reste DIFFÉRÉ tant
// qu'un accès Cloudflare humain n'a pas observé ce qui est réellement
// construit et servi aujourd'hui sur les branches candidates. Ce script ne
// PORTE donc rien : il calcule, lit et imprime — jamais un `git checkout`
// d'une branche candidate, jamais un `git commit`, jamais un `git push`. La
// preuve : `test_planifier_portage_config_candidat_20260922.js` grep ce
// fichier lui-même pour s'en assurer.
//
// Ce qu'il produit, pour une branche candidate nommée EXPLICITEMENT par
// l'appelant (jamais codée en dur ici) : l'état exact de chacun des sept
// fichiers de la chaîne (absent / différent du rail / déjà identique),
// l'adresse Test qu'elle prendrait une fois portée (réutilise
// `urlTestDeBranche`, déjà écrit et éprouvé — aucune seconde implémentation
// d'alias), et la séquence de commandes qu'un humain avec accès Cloudflare ET
// droit de push exécuterait — imprimée, jamais lancée par ce script.
//
//   node outils/planifier-portage-config-candidat.js <nom-de-branche>
//
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const { urlTestDeBranche } = require('./recette-navigateur-test.js');
const { REFS_PROTEGEES } = require('./handoff.js');

const RACINE = path.join(__dirname, '..');

// Chaîne exacte mesurée le 22/09/2026 par confrontation directe (`git show
// <branche>:<chemin>`) sur les deux candidats connus — pas une liste devinée.
const CHAINE = [
  'outils/build.sh',
  'outils/generer-config.js',
  'outils/poser-build-id.js',
  'nexus-page.js',
  'nexus-bandeau-environnement.js',
  'nexus-auth.js',
  '_headers',
];

function contenuSur(ref, chemin) {
  try {
    return execFileSync('git', ['show', `${ref}:${chemin}`],
      { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return null; // absent de cette ref — un fait, pas une erreur à remonter
  }
}

function empreinte(texte) {
  return crypto.createHash('sha256').update(texte, 'utf8').digest('hex');
}

function refResolvable(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`],
      { cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch (e) {
    return false;
  }
}

// Le NOM de branche (utilisé pour l'alias Cloudflare, `git checkout` et
// `git push`) et la REF utilisée pour lire son contenu (`git show`) ne sont
// pas toujours la même chaîne : ce checkout ne porte souvent que la
// ref de suivi distante (`origin/<nom>`), jamais la branche locale nue.
// L'appelant fournit toujours le NOM (jamais préfixé) ; la lecture de
// contenu essaie `origin/<nom>` puis `<nom>`, sans jamais dériver l'alias
// Cloudflare d'autre chose que du nom nu — un alias calculé sur
// `origin/<nom>` ne correspondrait à aucune page réellement servie.
function refDeLecture(nom) {
  if (refResolvable(`origin/${nom}`)) return `origin/${nom}`;
  if (refResolvable(nom)) return nom;
  return null;
}

function planifier(nomDeBranche, railRef = 'HEAD') {
  const nom = String(nomDeBranche || '').trim();
  if (!nom) throw new Error('planifier-portage-config-candidat : nom de branche vide ou absent.');
  if (nom.startsWith('origin/') || nom.startsWith('refs/')) {
    throw new Error(`REFUS — ${nom} : fournir le NOM de branche nu (ex. « fdj-vague1-cycle-caisse-20260916 »), `
      + 'pas une ref préfixée — l\'alias Cloudflare et `git push` s\'appuient sur le nom nu, la lecture de '
      + 'contenu résout elle-même `origin/<nom>`.');
  }
  if (REFS_PROTEGEES.includes(nom)) {
    throw new Error(`REFUS — ${nom} est une ref protégée (${REFS_PROTEGEES.join('/')}) : ce script ne `
      + 'planifie un portage QUE vers une branche candidate distincte.');
  }
  const refLecture = refDeLecture(nom);
  if (!refLecture) {
    throw new Error(`REFUS — ni origin/${nom} ni ${nom} ne sont des références git résolvables depuis ce checkout.`);
  }

  const etapes = CHAINE.map((chemin) => {
    const cible = contenuSur(refLecture, chemin);
    const rail = contenuSur(railRef, chemin);
    if (rail === null) {
      throw new Error(`Incohérence : ${chemin} est censé exister sur le rail (${railRef}) et n'y est pas `
        + '— corriger CHAINE avant de continuer, ne pas ignorer.');
    }
    let etat;
    if (cible === null) etat = 'ABSENT';
    else if (empreinte(cible) === empreinte(rail)) etat = 'DEJA_IDENTIQUE';
    else etat = 'DIFFERENT';
    return { chemin, etat };
  });

  const aPorter = etapes.filter(e => e.etat !== 'DEJA_IDENTIQUE');
  const { url } = urlTestDeBranche(nom);

  return { branche: nom, railRef, etapes, aPorter, urlTestPrevue: url };
}

function imprimer(plan) {
  console.log(`── Plan de portage (préparation seule, rien n'est exécuté) — ${plan.branche} ──`);
  console.log('');
  for (const e of plan.etapes) {
    const marque = e.etat === 'DEJA_IDENTIQUE' ? '=' : e.etat === 'ABSENT' ? '+' : '~';
    console.log(`  ${marque} ${e.chemin} (${e.etat})`);
  }
  console.log('');
  if (!plan.aPorter.length) {
    console.log(`  Rien à porter : les ${plan.etapes.length} fichiers sont déjà identiques au rail.`);
  } else {
    console.log(`  ${plan.aPorter.length}/${plan.etapes.length} fichier(s) à porter. Séquence pour qui a`);
    console.log('  l\'accès Cloudflare ET le droit de push — NON exécutée par ce script :');
    console.log('');
    console.log(`    git checkout ${plan.branche}`);
    for (const e of plan.aPorter) {
      console.log(`    git checkout ${plan.railRef} -- ${e.chemin}`);
    }
    console.log('    # observer Cloudflare (tableau de bord) AVANT tout commit — decision-2.md l\'exige');
    console.log('    git commit -m "porter la chaîne de build/config isolée Test '
      + '(observation Cloudflare : <à documenter ici>)"');
    console.log(`    git push origin ${plan.branche}`);
  }
  console.log('');
  console.log(`  Adresse Test prévue une fois porté : ${plan.urlTestPrevue}`);
  console.log('  (dérivée par urlTestDeBranche — aucune seconde implémentation d\'alias)');
}

module.exports = { CHAINE, planifier };

if (require.main === module) {
  try {
    const plan = planifier(process.argv[2]);
    imprimer(plan);
    process.exit(0);
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  }
}
