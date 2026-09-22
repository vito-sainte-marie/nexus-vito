// Épreuve de outils/planifier-portage-config-candidat.js.
//
// Ce script prépare (jamais n'exécute) le portage de la chaîne de build/config
// vers une branche candidate (#62, #65) — decision-2.md du lot
// NEXUS-CONTINUITE-TERRAIN-2-20260922 diffère ce portage tant qu'un accès
// Cloudflare humain n'a pas observé ce qui est réellement construit et servi.
// L'épreuve centrale n'est donc pas seulement « le plan est correct » mais
// « le script ne peut structurellement pas écrire sur une branche candidate » :
// une analyse statique du code source, pas une confiance dans son intention.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'outils', 'planifier-portage-config-candidat.js');
const { CHAINE, planifier } = require(OUTIL);

let passes = 0;
function epreuve(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── Garde d'architecture : extraire tous les sous-commandes git réellement
// exécutables par ce fichier, et prouver qu'aucun n'écrit jamais nulle part.
// Les chaînes "git checkout"/"git commit"/"git push" APPARAISSENT dans le
// fichier — mais uniquement à l'intérieur de console.log(), jamais passées à
// execFileSync. C'est cette distinction que le détecteur vérifie.
function sousCommandesGitExecutees(sourceJs) {
  const sous = [];
  const re = /execFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]([a-z-]+)['"]/g;
  let m;
  while ((m = re.exec(sourceJs))) sous.push(m[1]);
  return sous;
}

epreuve('le script ne PEUT exécuter que git show / git rev-parse — jamais checkout/commit/push', () => {
  const source = fs.readFileSync(OUTIL, 'utf8');
  const sous = sousCommandesGitExecutees(source);
  assert.ok(sous.length >= 2, 'au moins un appel show et un rev-parse attendus');
  for (const s of sous) {
    assert.ok(['show', 'rev-parse'].includes(s),
      `sous-commande git inattendue exécutable par le fichier : ${s}`);
  }
});

epreuve('mutation négative — le détecteur lève bien un appel checkout/commit/push injecté', () => {
  const source = fs.readFileSync(OUTIL, 'utf8');
  const injecte = source + `\nexecFileSync('git', ['push', 'origin', nom]);\n`;
  const sous = sousCommandesGitExecutees(injecte);
  assert.ok(sous.includes('push'), 'le détecteur doit voir le push injecté');
  assert.throws(() => {
    for (const s of sous) if (!['show', 'rev-parse'].includes(s)) throw new Error('détecté: ' + s);
  }, /push/);
});

epreuve('#62 (fdj-vague1-cycle-caisse-20260916) : 5 fichiers absents, 2 différents, rien identique', () => {
  const plan = planifier('fdj-vague1-cycle-caisse-20260916');
  assert.strictEqual(plan.branche, 'fdj-vague1-cycle-caisse-20260916');
  const etats = Object.fromEntries(plan.etapes.map(e => [e.chemin, e.etat]));
  assert.strictEqual(etats['outils/build.sh'], 'ABSENT');
  assert.strictEqual(etats['outils/generer-config.js'], 'ABSENT');
  assert.strictEqual(etats['nexus-page.js'], 'ABSENT');
  assert.strictEqual(etats['nexus-bandeau-environnement.js'], 'ABSENT');
  assert.strictEqual(etats['_headers'], 'ABSENT');
  // Les deux seuls présents-mais-périmés, mesurés directement le 22/09/2026 :
  // poser-build-id.js (identité par horodatage, pré-05/09) et nexus-auth.js
  // (932 lignes, Production en dur).
  assert.strictEqual(etats['outils/poser-build-id.js'], 'DIFFERENT');
  assert.strictEqual(etats['nexus-auth.js'], 'DIFFERENT');
  assert.strictEqual(plan.aPorter.length, CHAINE.length, 'les 7 fichiers doivent être à porter, aucun déjà identique');
  assert.strictEqual(plan.urlTestPrevue, 'https://fdj-vague1-cycle-caisse-2026.nexus-test-ddf.pages.dev/');
});

epreuve('#65 (reception-regularisation-20260919) : même schéma que #62', () => {
  const plan = planifier('reception-regularisation-20260919');
  const etats = Object.fromEntries(plan.etapes.map(e => [e.chemin, e.etat]));
  assert.strictEqual(etats['outils/build.sh'], 'ABSENT');
  assert.strictEqual(etats['outils/poser-build-id.js'], 'DIFFERENT');
  assert.strictEqual(etats['nexus-auth.js'], 'DIFFERENT');
  assert.strictEqual(plan.aPorter.length, CHAINE.length);
});

epreuve('une branche déjà alignée sur le rail : rien à porter (pas de faux positif)', () => {
  // Le rail comparé à lui-même : les 7 fichiers doivent ressortir identiques,
  // preuve que le détecteur ne signale pas un portage là où il n'y en a pas.
  const plan = planifier('handoff-continuite-20260920');
  assert.strictEqual(plan.aPorter.length, 0);
  assert.ok(plan.etapes.every(e => e.etat === 'DEJA_IDENTIQUE'));
});

epreuve('refus — branche protégée main', () => {
  assert.throws(() => planifier('main'), /REFUS.*ref protégée/);
});

epreuve('refus — branche protégée production', () => {
  assert.throws(() => planifier('production'), /REFUS.*ref protégée/);
});

epreuve('refus — ref préfixée origin/ rejetée (le nom nu est exigé)', () => {
  assert.throws(() => planifier('origin/fdj-vague1-cycle-caisse-20260916'), /REFUS.*NOM de branche nu/);
});

epreuve('refus — nom de branche vide ou absent', () => {
  assert.throws(() => planifier(''), /nom de branche vide ou absent/);
  assert.throws(() => planifier(undefined), /nom de branche vide ou absent/);
});

epreuve('refus — branche inexistante, ni en local ni sur origin', () => {
  assert.throws(() => planifier('branche-qui-nexiste-pas-du-tout-20260922'), /REFUS.*résolvables/);
});

console.log(`\n${passes}/${passes} épreuves passées.`);
