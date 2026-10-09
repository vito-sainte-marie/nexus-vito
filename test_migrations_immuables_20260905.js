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

// La branche de production, sous l'un des noms possibles selon le contexte.
function refProduction() {
  for (const ref of ['production', 'origin/production', 'refs/remotes/origin/production']) {
    try { git('rev-parse', '--verify', ref); return ref; } catch (e) { /* suivant */ }
  }
  return null;
}

const REF = refProduction();
assert.ok(REF, 'La branche `production` est introuvable. En CI, récupérer la branche '
  + '(`git fetch origin production:production` ou `fetch-depth: 0`) : sans elle, ce '
  + 'contrôle ne peut pas savoir quelles migrations sont déjà appliquées en production.');
console.log(`Référence de production : ${REF}\n`);

// ── Inventaire des deux côtés ────────────────────────────────────────────
const enProduction = git('ls-tree', '--name-only', REF, `${DOSSIER}/`)
  .split('\n').filter(l => l.endsWith('.sql')).map(l => path.basename(l));
const enLocal = fs.readdirSync(path.join(RACINE, DOSSIER)).filter(f => f.endsWith('.sql'));

verifier(`la branche production porte des migrations (${enProduction.length})`, enProduction.length > 0);

const empreinte = contenu => crypto.createHash('sha256').update(contenu).digest('hex');
const contenuProduction = new Map();
for (const f of enProduction) {
  contenuProduction.set(f, empreinte(git('show', `${REF}:${DOSSIER}/${f}`)));
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

console.log(`\n${ok} vérifications passées — ${enProduction.length} migrations de production contrôlées.`);
