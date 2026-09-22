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

// Un échec ne doit pas emporter les épreuves suivantes : la première épreuve
// de ce fichier lit le VRAI dépôt, et quand elle tombait — le 21/09/2026, sur
// une référence de production mal résolue — les onze suivantes ne s'exécutaient
// même pas. On ne savait donc pas ce qui était cassé, seulement que quelque
// chose l'était. Chaque épreuve est désormais isolée, le bilan est nommé, et le
// code de sortie reste 1 dès qu'il reste un rouge.
let n = 0;
const echecs = [];
function t(nom, fn) {
  try { fn(); n++; console.log('OK — ' + nom); }
  catch (e) { echecs.push({ nom, message: (e && e.message) || String(e) }); console.log('ROUGE — ' + nom); }
}

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

// ── 4. LA RÉFÉRENCE DE PRODUCTION — preuve par mutation de l'ORDRE ────
// Ce comparateur essayait la branche locale `production` EN PREMIER. Le
// 21/09/2026 elle valait 501c0c7 quand `origin/production` valait 2bc7b39 :
// il annonçait « exists on disk, but not in 'production' » sur une migration
// bel et bien publiée, et `test_migrations_immuables_20260905.js`, qui portait
// une COPIE du même résolveur, contrôlait 240 migrations au lieu de 276 en
// restant vert. Un ordre de résolution ne se vérifie pas à la lecture : ces
// épreuves injectent un git qui NOTE ce qu'on lui demande, pour que
// réintroduire la copie locale en premier devienne rouge.
const { refProduction } = require('./outils/comparer-migration-documentaire.js');

// Un git de laboratoire : `existantes` dit quelles refs se vérifient, `vues`
// garde l'ordre exact des interrogations.
function gitDeLabo(existantes) {
  const vues = [];
  const g = (...args) => {
    assert.strictEqual(args[0], 'rev-parse', 'ce résolveur ne doit interroger que rev-parse');
    const ref = args[args.length - 1].replace(/\^\{commit\}$/, '');
    vues.push(ref);
    if (!existantes.includes(ref)) throw new Error(`fatal: ref inconnue: ${ref}`);
    return 'deadbeef\n';
  };
  g.vues = vues;
  return g;
}

t('la ref distante est préférée alors même que la copie locale existe', () => {
  const g = gitDeLabo(['refs/remotes/origin/production', 'origin/production', 'production']);
  const avertissements = [];
  const ref = refProduction({ git: g, avertir: m => avertissements.push(m) });
  assert.strictEqual(ref, 'refs/remotes/origin/production',
    'la ref distante fait foi : c\'est l\'état publié, pas une copie locale qui peut être en retard');
  assert.deepStrictEqual(g.vues, ['refs/remotes/origin/production'],
    'la branche locale `production` ne doit pas même être interrogée quand la ref distante existe');
  assert.deepStrictEqual(avertissements, [], 'rien à signaler quand la ref distante répond');
});

t('MUTATION — la copie locale n\'est jamais interrogée avant la ref distante', () => {
  // La mutation visée est exactement l'ancien code : ['production',
  // 'origin/production', …]. Elle se voit à la PREMIÈRE interrogation, la
  // seule mesure qui distingue « a préféré le distant » de « a trouvé le
  // distant parce que le local manquait ».
  const g = gitDeLabo(['refs/remotes/origin/production', 'production']);
  refProduction({ git: g, avertir: () => {} });
  assert.strictEqual(g.vues[0], 'refs/remotes/origin/production',
    'la première ref interrogée doit être la ref distante, trouvé ' + JSON.stringify(g.vues[0]));
  assert.ok(!g.vues.slice(0, g.vues.indexOf('refs/remotes/origin/production') + 1).includes('production'),
    'aucune interrogation de la branche locale avant la ref distante');
});

t('sans ref distante, la copie locale sert de dernier recours — mais jamais en silence', () => {
  const g = gitDeLabo(['production']);
  const avertissements = [];
  const ref = refProduction({ git: g, avertir: m => avertissements.push(m) });
  assert.strictEqual(ref, 'production', 'un clone sans remote doit pouvoir comparer quand même');
  assert.strictEqual(avertissements.length, 1, 'le repli sur la copie locale doit être dit à voix haute');
  assert.match(avertissements[0], /en retard/, 'l\'avertissement doit nommer le risque : ' + avertissements[0]);
  assert.match(avertissements[0], /git fetch origin production/, 'et le geste qui le lève');
});

t('aucune référence de production du tout → null, et une erreur qui nomme le geste', () => {
  const g = gitDeLabo([]);
  assert.strictEqual(refProduction({ git: g, avertir: () => {} }), null);
  assert.throws(
    () => comparerMigrationAvecProduction('peu-importe.sql', { ref: null, git: g }),
    /introuvable/,
    'sans référence, le comparateur doit refuser de conclure au lieu de comparer dans le vide');
});

t('sur le vrai dépôt, la référence retenue est la ref distante', () => {
  const { execFileSync } = require('child_process');
  const existe = (ref) => {
    try { execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: __dirname, stdio: 'ignore' }); return true; }
    catch (e) { return false; }
  };
  if (!existe('refs/remotes/origin/production')) {
    // En clone superficiel sans remote-tracking, il n'y a rien à préférer :
    // l'épreuve le DIT au lieu de passer en silence.
    console.log('   (aucune ref distante dans ce dépôt — préférence non mesurable ici)');
    return;
  }
  const ref = refProduction({ avertir: () => {} });
  assert.match(ref, /^refs\/remotes\/origin\/production$|^origin\/production$/,
    'la référence retenue doit être distante, trouvé ' + JSON.stringify(ref));
});

t('le résolveur n\'existe qu\'en un seul exemplaire dans le dépôt', () => {
  // Le défaut avait deux maisons : la seconde copie, dans
  // `test_migrations_immuables_20260905.js`, gardait l'ordre inversé et
  // laissait 36 migrations publiées hors de la règle d'immuabilité. Une règle
  // en deux exemplaires finit par ne plus dire la même chose des deux côtés.
  const { execFileSync } = require('child_process');
  // Le motif est assemblé à l'exécution : écrit d'un seul tenant, il se
  // trouvait lui-même et cette épreuve accusait sa propre source.
  const motif = 'function refProduct' + 'ion';
  const fichiers = execFileSync('git', ['grep', '-l', '-e', motif, '--', '*.js'], { cwd: __dirname })
    .toString().split('\n').filter(Boolean);
  assert.deepStrictEqual(fichiers, ['outils/comparer-migration-documentaire.js'],
    'un seul fichier doit définir refProduction ; trouvé : ' + fichiers.join(', '));
});

t('MUTATION — la source ne réintroduit pas la copie locale en tête de liste', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, 'outils', 'comparer-migration-documentaire.js'), 'utf8');
  const lignes = source.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
  const suspectes = lignes.filter(l => /\[\s*'production'/.test(l) || /for\s*\(const ref of \[\s*'production'/.test(l));
  assert.deepStrictEqual(suspectes, [],
    'une liste de résolution ne doit plus commencer par la branche locale : ' + suspectes.join(' | '));
});

const total = n + echecs.length;
if (echecs.length) {
  console.log(`\n${n}/${total} vérifications passées — ${echecs.length} ROUGE :`);
  echecs.forEach(e => console.log(`  ✘ ${e.nom}\n    ${e.message}`));
  process.exit(1);
}
console.log(`\n${n}/${total} vérifications passées — comparateur migration/documentaire éprouvé, y compris par mutation.`);
