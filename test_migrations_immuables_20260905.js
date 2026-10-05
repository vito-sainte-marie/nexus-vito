// NEXUS — une migration appliquée en production est immuable (05/09/2026).
//
// A12. Le 04/09, le fichier `…_fermer_lecture_anonyme_sites.sql` a été
// renommé de `20260904130807` en `20260904140000` pour aligner le dépôt sur
// la base de RECETTE. Il suivait la PRODUCTION, qui l'a enregistré sous
// `130807` — et le commit 501c0c7 avait justement pris cet arbitrage. Le
// renommage l'a annulé sans que personne le voie.
//
// CE QUE ÇA COÛTE À LA PROMOTION. Le CLI compare les versions locales à
// `schema_migrations` : il aurait vu `20260904140000` comme NOUVELLE et
// l'aurait appliquée sur une base où son effet est déjà en place. Et il aurait
// trouvé `20260904130807` côté distant sans fichier local — un historique
// incohérent, à réparer à la main le jour de la promotion, c'est-à-dire au
// pire moment.
//
// LA RÈGLE : une migration appliquée en production devient immuable dans son
// identité. Son nom ne se « nettoie » plus a posteriori ; toute évolution
// passe par une NOUVELLE migration.
//
// Ce contrôle ne dépend d'aucun secret ni d'aucun accès base : il compare la
// branche `production` à la branche courante. Il aurait arrêté 95cc92a.
//
// SÉPARATION D'AUTORITÉ (GO request-1, lot `GOUVERNANCE-REFERENCE-CODE-
// 20261005`, arbitrage de Frédéric du 05/10/2026). `origin/production` est
// désormais l'autorité du code applicatif et des migrations ; le rail
// (`handoff-continuite-20260920`) est l'autorité du seul protocole Handoff —
// il ne prétend plus porter une copie complète des migrations Production.
// CI `37356858235` l'a rendu rouge : Production comptait 292 migrations, le
// rail n'en portait pas 2 (`20261005090000_fdj_reconciliation_canonique_
// caisse.sql`, `20261005180000_fdj_ouverture_quart_caissiere_seule.sql`),
// ajoutées en Production APRÈS la divergence du rail, jamais transportées —
// jamais supprimées. L'ancienne comparaison (production au tip COURANT contre
// le système de fichiers local) confondait les deux : sous l'ancien modèle,
// où chaque branche était censée mirer l'intégralité de l'applicatif, une
// absence locale ne pouvait signifier qu'une suppression. Ce n'est plus vrai
// pour une branche qui a sciemment divergé de `production` en autorité.
//
// LA RÉFÉRENCE CORRIGÉE : production AU POINT OÙ CETTE BRANCHE A DIVERGÉ
// (`git merge-base production HEAD`), pas au tip courant. Une branche reste
// strictement responsable de ne rien perdre de ce qui existait en production
// au moment où elle s'en est détachée — c'est l'invariant réel, et celui que
// 95cc92a aurait toujours violé (la migration renommée existait déjà en
// production avant la divergence). Une migration ajoutée à `production`
// APRÈS cette divergence n'est simplement pas encore connue de la branche :
// son absence n'est pas une suppression, et ce contrôle ne la voit plus
// comme telle. Pour une branche applicative qui descend de la production
// courante (merge-base = tip), rien ne change : la comparaison reste
// intégrale.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const DOSSIER = 'supabase/migrations';
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

function git(...args) {
  return execFileSync('git', args, { cwd: RACINE, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

// LA RÉFÉRENCE DE PRODUCTION NE SE REDÉFINIT PAS ICI. Ce fichier portait sa
// propre copie du résolveur, et cette copie essayait la branche locale
// `production` EN PREMIER. Le 21/09/2026 elle valait 501c0c7 quand
// `origin/production` valait 2bc7b39 : ce contrôle annonçait « 240 migrations
// de production contrôlées » et passait au vert, alors que l'état publié en
// portait 276. Trente-six migrations publiées échappaient à la règle
// d'immuabilité — vert, et sans rien mordre. Une règle qui vit en deux
// exemplaires finit par ne plus dire la même chose des deux côtés : le
// résolveur est désormais unique, dans `outils/comparer-migration-documentaire.js`,
// et il préfère TOUJOURS la ref distante. `git` lui est passé pour qu'il lise
// le même dépôt que le reste de ce fichier.
const { refProduction } = require('./outils/comparer-migration-documentaire.js');

const REF = refProduction({ git });
assert.ok(REF, 'La référence de production est introuvable. En CI, récupérer la branche '
  + '(`git fetch origin production` ou `fetch-depth: 0`) : sans elle, ce '
  + 'contrôle ne peut pas savoir quelles migrations sont déjà appliquées en production.');

// La référence d'immuabilité n'est pas le tip courant de production, mais
// production AU POINT DE DIVERGENCE de cette branche — voir le commentaire
// d'en-tête (séparation d'autorité, GO request-1 du 05/10/2026). Si HEAD
// descend de production (branche applicative à jour), le merge-base EST le
// tip : rien ne change. Si HEAD a divergé (rail Handoff, ou tout ce qui en
// descend), le merge-base fige l'état de production à cette date-là, et les
// migrations ajoutées depuis ne sont simplement pas évaluées par ce contrôle.
let REF_BASE;
try {
  REF_BASE = git('merge-base', REF, 'HEAD').trim();
} catch (e) {
  throw new Error(`Point de divergence introuvable entre ${REF} et HEAD : ${e.message}. `
    + 'En CI, vérifier que `fetch-depth` est suffisant pour atteindre un ancêtre commun — '
    + 'sans lui, ce contrôle ne peut pas savoir quelle production cette branche doit honorer.');
}
console.log(`Référence de production (tip) : ${REF}`);
console.log(`Référence d'immuabilité (point de divergence, merge-base) : ${REF_BASE}\n`);

// ── Inventaire des deux côtés ────────────────────────────────────────────
const enProductionTip = git('ls-tree', '--name-only', REF, `${DOSSIER}/`)
  .split('\n').filter(l => l.endsWith('.sql')).map(l => path.basename(l));
const enProduction = git('ls-tree', '--name-only', REF_BASE, `${DOSSIER}/`)
  .split('\n').filter(l => l.endsWith('.sql')).map(l => path.basename(l));
const enLocal = fs.readdirSync(path.join(RACINE, DOSSIER)).filter(f => f.endsWith('.sql'));

verifier(`la branche production porte des migrations (${enProductionTip.length} au tip, ${enProduction.length} au point de divergence)`,
  enProductionTip.length > 0 && enProduction.length > 0);

const ajouteesDepuisLaDivergence = enProductionTip.filter(f => !enProduction.includes(f));
if (ajouteesDepuisLaDivergence.length) {
  console.log(`Migrations ajoutées à production depuis la divergence de cette branche `
    + `(non évaluées par ce contrôle, ${ajouteesDepuisLaDivergence.length}) :`);
  ajouteesDepuisLaDivergence.forEach(f => console.log(`  · ${f}`));
  console.log('');
}

const empreinte = contenu => crypto.createHash('sha256').update(contenu).digest('hex');
const contenuProduction = new Map();
for (const f of enProduction) {
  contenuProduction.set(f, empreinte(git('show', `${REF_BASE}:${DOSSIER}/${f}`)));
}
const contenuLocal = new Map();
for (const f of enLocal) {
  contenuLocal.set(f, empreinte(fs.readFileSync(path.join(RACINE, DOSSIER, f), 'utf8')));
}

const MESSAGE = nom => `\n  ✘ ${nom}\n`
  + '    Cette migration est déjà enregistrée en production sous ce nom. La renommer\n'
  + '    ou la dupliquer sous un nouveau numéro peut provoquer une réapplication ou\n'
  + '    un historique incohérent.';

// ── 1. Aucun nom présent en production ne peut disparaître ───────────────
const disparues = enProduction.filter(f => !enLocal.includes(f));
if (disparues.length) {
  console.error('\nMigrations de production absentes de cette branche :');
  disparues.forEach(f => console.error(MESSAGE(f)));
}
verifier(`aucune migration de production n’a disparu (${disparues.length})`, disparues.length === 0);

// ── 2. Ni réapparaître sous un autre numéro ──────────────────────────────
// Le renommage exact est le cas principal ; le copier-coller sous un nouveau
// timestamp le contournerait si l'on ne comparait que les noms.
const duplications = [];
for (const [nomProd, hash] of contenuProduction) {
  for (const [nomLocal, hashLocal] of contenuLocal) {
    if (nomLocal !== nomProd && hashLocal === hash) {
      duplications.push({ nomProd, nomLocal });
    }
  }
}
if (duplications.length) {
  console.error('\nContenus de migrations de production réapparus sous un autre nom :');
  duplications.forEach(d => console.error(MESSAGE(d.nomProd) + `\n    → réapparue sous « ${d.nomLocal} »`));
}
verifier(`aucun contenu de production ne réapparaît sous un autre nom (${duplications.length})`,
  duplications.length === 0);

// ── 3. Et leur contenu ne change pas non plus ────────────────────────────
// Une migration appliquée est immuable dans son identité ET dans ce qu'elle
// a fait : retoucher son SQL après coup rendrait le dépôt menteur sur l'état
// réel de la base.
const contenuModifie = enProduction
  .filter(f => enLocal.includes(f) && contenuLocal.get(f) !== contenuProduction.get(f));
if (contenuModifie.length) {
  console.error('\nMigrations de production dont le contenu a été modifié :');
  contenuModifie.forEach(f => console.error(MESSAGE(f)));
}
verifier(`le contenu des migrations de production est inchangé (${contenuModifie.length})`,
  contenuModifie.length === 0);

// ── 4. Le cas précis d'A12, nommé, pour qu'il ne revienne pas ────────────
verifier('la migration `fermer_lecture_anonyme_sites` porte le numéro de production',
  enLocal.includes('20260904130807_fermer_lecture_anonyme_sites.sql')
  && !enLocal.includes('20260904140000_fermer_lecture_anonyme_sites.sql'));

console.log(`\n${ok} vérifications passées — ${enProduction.length} migrations de production contrôlées `
  + `(point de divergence), ${ajouteesDepuisLaDivergence.length} ajoutées depuis et non évaluées, `
  + `${enProductionTip.length} au tip courant de production.`);
