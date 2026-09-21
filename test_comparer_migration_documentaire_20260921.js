// Preuve + contre-preuve pour la garde 1 démasquée par
// `test_migrations_immuables_20260905.js` sur
// `20260911180600_pointage_exige_service_et_evenement.sql` (decision-4.md,
// lot NEXUS-CONTINUITE-TERRAIN-1-20260920).
//
// Ce fichier ne modifie ni la migration divergente ni Production : il éprouve
// `outils/comparer-migration-documentaire.js` en lecture seule (git show +
// fs.readFileSync) sur le vrai fichier, puis sur des contenus synthétiques
// en mémoire pour la contre-preuve par mutation — jamais d'écriture disque.
'use strict';

const assert = require('assert');
const {
  estLigneCommentairePleine,
  separerCommentaires,
  comparerContenus,
  comparerMigrationAvecProduction,
} = require('./outils/comparer-migration-documentaire.js');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// ── 1. Preuve reproductible sur le vrai fichier divergent ────────────────
t('la migration réellement divergente est classée DIVERGENCE_DOCUMENTAIRE', () => {
  const r = comparerMigrationAvecProduction('20260911180600_pointage_exige_service_et_evenement.sql');
  assert.strictEqual(r.verdict, 'DIVERGENCE_DOCUMENTAIRE');
  assert.strictEqual(r.seulementCommentaires, true);
  assert.strictEqual(r.diffLogique.length, 0);
});

t('la direction réelle de la divergence est production → rail, pas l’inverse', () => {
  // `request-4.md` (lot NEXUS-CONTINUITE-TERRAIN-1-20260920) affirmait le
  // bloc « présent sur le rail et absent de la version réellement appliquée
  // en Production ». Mesuré ici : c'est l'inverse. `production` (commit
  // 41538aa, "Rapatrier le trigger ... derrière son code", 16/09/2026) porte
  // le bloc ; le rail (commit f682ed6, 11/09/2026, jamais modifié depuis) ne
  // l'a jamais eu. Cette épreuve fixe le fait pour qu'il ne se réinverse pas
  // en silence.
  const r = comparerMigrationAvecProduction('20260911180600_pointage_exige_service_et_evenement.sql');
  assert.ok(r.commentairesUniquementDansA.length > 0,
    'des lignes de commentaire devraient exister UNIQUEMENT en production (côté A)');
  assert.strictEqual(r.commentairesUniquementDansB.length, 0,
    'aucune ligne de commentaire ne devrait exister uniquement sur le rail (côté B)');
  assert.ok(r.octetsProduction > r.octetsRail,
    'production devrait être le côté le plus long (il porte le bloc en plus)');
});

t('la ligne de comparaison directe git (production → rail) confirme le même sens', () => {
  const { execFileSync } = require('child_process');
  const diff = execFileSync('git', [
    'diff', 'origin/production:supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql',
    'supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql',
  ], { cwd: __dirname }).toString();
  // Ne classer les lignes qu'APRÈS le premier `@@` : avant lui, `--- a/...`
  // et `+++ b/...` sont des en-têtes de fichier, pas du contenu — et le
  // contenu réel commence lui-même par `--` (commentaire SQL), si bien
  // qu'un filtre sur `l.startsWith('---')` appliqué à tout le texte les
  // aurait classées à tort comme en-têtes plutôt que comme du contenu retiré.
  const corps = diff.split('\n');
  const iPremierHunk = corps.findIndex(l => l.startsWith('@@'));
  assert.ok(iPremierHunk >= 0, 'la diff devrait contenir au moins un hunk `@@`');
  const lignesContenu = corps.slice(iPremierHunk + 1);
  const retirees = lignesContenu.filter(l => l.startsWith('-'));
  const ajoutees = lignesContenu.filter(l => l.startsWith('+'));
  assert.ok(retirees.length > 0, 'des lignes devraient être retirées (présentes en production, absentes du rail)');
  assert.strictEqual(ajoutees.length, 0, 'aucune ligne ne devrait être ajoutée par le rail');
});

// ── 2. Reproductibilité sur contenu synthétique (aucun fichier écrit) ────
t('deux contenus identiques sauf un bloc de commentaire → DIVERGENCE_DOCUMENTAIRE', () => {
  const a = 'create or replace function f() returns int as $$\n'
    + '-- commentaire A\nselect 1;\n$$ language sql;\n';
  const b = 'create or replace function f() returns int as $$\n'
    + '-- commentaire B, different, plus long\n-- deuxieme ligne de commentaire\nselect 1;\n$$ language sql;\n';
  const r = comparerContenus(a, b, 'a', 'b');
  assert.strictEqual(r.verdict, 'DIVERGENCE_DOCUMENTAIRE');
  assert.strictEqual(r.seulementCommentaires, true);
});

t('contenus strictement identiques → IDENTIQUE', () => {
  const a = 'select 1;\n-- x\n';
  const r = comparerContenus(a, a, 'a', 'b');
  assert.strictEqual(r.verdict, 'IDENTIQUE');
});

// ── 3. CONTRE-PREUVE PAR MUTATION — le point exigé par decision-4.md §3 ──
// Un vert obtenu seulement en relâchant la garde est interdit : cette épreuve
// vérifie que le contrôle échoue bien à certifier « documentaire seulement »
// dès qu'une vraie divergence de logique SQL est mêlée à une divergence de
// commentaire — la mutation ne doit PAS pouvoir se cacher derrière `--`.
t('CONTRE-PREUVE — une divergence de LOGIQUE mêlée à des commentaires n’est jamais certifiée documentaire', () => {
  const a = 'create or replace function f() returns int as $$\n'
    + '-- commentaire A\nselect 1;\n$$ language sql;\n';
  // Mutation : le commentaire change ET la valeur de retour SQL change aussi
  // (1 → 2). Un contrôle « relâché » qui ignorerait tout ce qui ressemble à
  // un commentaire, ou qui ne comparerait pas ligne à ligne le code restant,
  // laisserait passer cette mutation comme documentaire. Celui-ci ne doit pas.
  const bMute = 'create or replace function f() returns int as $$\n'
    + '-- commentaire B, different\nselect 2;\n$$ language sql;\n';
  const r = comparerContenus(a, bMute, 'a', 'b');
  assert.strictEqual(r.verdict, 'DIVERGENCE_LOGIQUE',
    'la mutation aurait dû être détectée comme une divergence de logique, pas classée documentaire');
  assert.strictEqual(r.seulementCommentaires, false);
  assert.ok(r.diffLogique.some(d => d.a.includes('select 1') && d.b.includes('select 2')),
    'la ligne de code réellement divergente doit être nommée dans le rapport');
});

t('CONTRE-PREUVE — une ligne de commentaire EN FIN de ligne de code n’efface jamais cette ligne', () => {
  // Une ligne de code suivie d'un commentaire inline n'est PAS une ligne de
  // commentaire pleine ligne : `estLigneCommentairePleine` doit la refuser,
  // sinon un changement de logique déguisé en « fin de ligne commentée »
  // échapperait à la comparaison du code.
  assert.strictEqual(estLigneCommentairePleine('select 1; -- inline'), false);
  assert.strictEqual(estLigneCommentairePleine('  -- pleine ligne, indentee'), true);
  assert.strictEqual(estLigneCommentairePleine('select 1;'), false);
});

t('CONTRE-PREUVE — retirer un `--` isolé ne fusionne jamais deux lignes de code', () => {
  const { lignesCode, lignesCommentaire } = separerCommentaires('select 1;\n--\nselect 2;\n');
  assert.deepStrictEqual(lignesCode, ['select 1;', 'select 2;', '']);
  assert.deepStrictEqual(lignesCommentaire, ['--']);
});

console.log(`\n${n}/${n} vérifications passées — comparateur migration/documentaire éprouvé, y compris par mutation.`);
