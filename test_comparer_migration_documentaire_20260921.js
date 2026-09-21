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

// ── 1. Preuve reproductible sur le vrai fichier, réaligné par decision-5.md ──
// `decision-5.md` (lot NEXUS-CONTINUITE-TERRAIN-1-20260920) a autorisé le
// remplacement du fichier du rail par le contenu octet pour octet de
// `production` — ces trois épreuves vérifiaient jusqu'ici l'EXISTENCE de la
// divergence documentaire ; elles vérifient désormais sa DISPARITION, sans
// perdre la preuve que le comparateur mesure la réalité et non une
// hypothèse : un git diff vide est une preuve au moins aussi forte qu'un
// diff non vide correctement classé.
t('la migration, réalignée sur production, est désormais classée IDENTIQUE', () => {
  const r = comparerMigrationAvecProduction('20260911180600_pointage_exige_service_et_evenement.sql');
  assert.strictEqual(r.verdict, 'IDENTIQUE');
  assert.strictEqual(r.diffLogique.length, 0);
  assert.strictEqual(r.octetsProduction, r.octetsRail,
    'production et le rail devraient désormais avoir exactement le même nombre d’octets');
});

t('le contenu du rail est un octet pour octet exact de production (SHA256)', () => {
  const crypto = require('crypto');
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const chemin = path.join(__dirname, 'supabase', 'migrations', '20260911180600_pointage_exige_service_et_evenement.sql');
  const contenuRail = fs.readFileSync(chemin, 'utf8');
  const contenuProduction = execFileSync('git', [
    'show', 'origin/production:supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql',
  ], { cwd: __dirname }).toString();
  const empreinte = (s) => crypto.createHash('sha256').update(s).digest('hex');
  assert.strictEqual(empreinte(contenuRail), empreinte(contenuProduction));
});

t('la ligne de comparaison directe git (production → rail) ne montre plus aucun hunk', () => {
  const { execFileSync } = require('child_process');
  const diff = execFileSync('git', [
    'diff', 'origin/production:supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql',
    'supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql',
  ], { cwd: __dirname }).toString();
  assert.strictEqual(diff, '', 'un diff vide est attendu maintenant que le rail est aligné octet pour octet sur production');
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
