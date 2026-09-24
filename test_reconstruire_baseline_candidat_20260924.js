#!/usr/bin/env node
// `outils/reconstruire-baseline-candidat.sh` — épreuves des gardes, en
// DRY_RUN uniquement : aucune de ces épreuves ne crée de worktree, n'ouvre
// de connexion, ni ne touche à un secret. Elles s'exécutent contre le dépôt
// RÉEL de cette session (origin/production, origin/reception-regularisation-
// 20260919 pour #65, origin/fdj-vague1-cycle-caisse-20260916 pour #62), pas
// contre une fixture synthétique : c'est le seul moyen de prouver que le
// mécanisme calcule le delta exact déjà documenté par
// `classement-gates-etat-git-62-65-1.md` (1 migration pour #65, 12 pour
// #62), pas une approximation.
//
// decision-11.md (lot NEXUS-CONTINUITE-TERRAIN-2-20260922).

'use strict';
const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RACINE = __dirname;
const SCRIPT = path.join(RACINE, 'outils', 'reconstruire-baseline-candidat.sh');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.name}: ${e.message}`); process.exitCode = 1; }
}

function lancer(args, env) {
  return spawnSync('bash', [SCRIPT, ...args], {
    cwd: RACINE,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const PROD_REF = 'uzhjpqpctpvxytxpxoqz';
const TEST_HISTORIQUE_REF = 'udljdqxerrbbbajxubfn';
const REF_JETABLE_BIDON = 'zzzz-cible-jetable-inexistante';

t('usage : aucun argument => exit 2', () => {
  const r = lancer([], {});
  assert.strictEqual(r.status, 2);
  assert.ok(/Usage/.test(r.stderr), `stderr devrait rappeler l'usage, obtenu: ${r.stderr}`);
});

t('usage : un seul argument => exit 2', () => {
  const r = lancer(['reception-regularisation-20260919'], {});
  assert.strictEqual(r.status, 2);
});

t('refuse la cible = PRODUCTION (jamais, même en DRY_RUN)', () => {
  const r = lancer(['reception-regularisation-20260919', PROD_REF], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 3);
  assert.ok(/PRODUCTION/.test(r.stderr), `stderr devrait nommer PRODUCTION, obtenu: ${r.stderr}`);
});

t('refuse la cible = Test historique nexus-test (decision-11.md §2)', () => {
  const r = lancer(['reception-regularisation-20260919', TEST_HISTORIQUE_REF], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 3);
  assert.ok(/historique/.test(r.stderr), `stderr devrait nommer le Test historique, obtenu: ${r.stderr}`);
});

t('refuse une branche candidate introuvable', () => {
  const r = lancer(['cette-branche-n-existe-nulle-part-20991231', REF_JETABLE_BIDON], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 4);
  assert.ok(/impossible de résoudre/.test(r.stderr), `stderr: ${r.stderr}`);
});

t('refuse une candidate dont production n\'est PAS un ancêtre (le rail lui-même)', () => {
  const r = lancer(['handoff-continuite-20260920', REF_JETABLE_BIDON], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 5);
  assert.ok(/n'est pas un ancêtre/.test(r.stderr), `stderr: ${r.stderr}`);
});

t('DRY_RUN #65 (reception-regularisation-20260919) : delta = exactement 1 migration, exit 0', () => {
  const r = lancer(['reception-regularisation-20260919', REF_JETABLE_BIDON], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(r.stdout.includes('supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql'),
    `delta #65 attendu absent de la sortie:\n${r.stdout}`);
  const lignesAjout = (r.stdout.match(/^\s*A\tsupabase\/migrations\//gm) || []).length;
  assert.strictEqual(lignesAjout, 1, `#65 doit avoir exactement 1 migration de delta, obtenu ${lignesAjout}`);
  assert.ok(/DRY_RUN=oui/.test(r.stdout));
});

t('DRY_RUN #62 (fdj-vague1-cycle-caisse-20260916) : delta = exactement 12 migrations, exit 0', () => {
  const r = lancer(['fdj-vague1-cycle-caisse-20260916', REF_JETABLE_BIDON], { DRY_RUN: 'oui' });
  assert.strictEqual(r.status, 0, `stderr: ${r.stderr}`);
  const lignesAjout = (r.stdout.match(/^\s*A\tsupabase\/migrations\//gm) || []).length;
  assert.strictEqual(lignesAjout, 12, `#62 doit avoir exactement 12 migrations de delta, obtenu ${lignesAjout}`);
});

t('DRY_RUN : aucun worktree créé (git worktree list inchangé)', () => {
  const avant = spawnSync('git', ['worktree', 'list'], { cwd: RACINE, encoding: 'utf8' }).stdout;
  lancer(['reception-regularisation-20260919', REF_JETABLE_BIDON], { DRY_RUN: 'oui' });
  const apres = spawnSync('git', ['worktree', 'list'], { cwd: RACINE, encoding: 'utf8' }).stdout;
  assert.strictEqual(avant, apres, 'DRY_RUN ne doit créer aucun worktree');
});

t('MUTATION : sans la garde de purete du delta, une modification/suppression passerait — la garde existe et matche bien A|vide', () => {
  const src = require('fs').readFileSync(SCRIPT, 'utf8');
  assert.ok(/grep -qv '\^A\\\|\^\$'/.test(src),
    'la garde de pureté du delta (uniquement des ajouts) doit être présente dans le script');
});

console.log(`\n${passes} vérification(s) passée(s) (DRY_RUN uniquement — aucun worktree, aucune connexion, aucun secret).`);
