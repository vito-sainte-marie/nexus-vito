// Test — la Phase C peut-elle seulement s'exécuter ? (17/09/2026)
//
// POURQUOI CE FICHIER EXISTE
//
// `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` est le
// script qui referme les politiques RLS du cycle de caisse. Il ne vit PAS sous
// `supabase/migrations/` — c'est délibéré, il s'applique à la main après une
// bascule de front — et c'est précisément ce qui le rendait invisible : aucun
// outil du dépôt ne le regardait, aucune étape de CI ne le touchait. Un
// script inexécutable pouvait être relu, approuvé et fusionné sans que rien ne
// le dise, et l'erreur n'apparaissait qu'au moment de l'appliquer, en
// production, à la main, sur une base réelle.
//
// La relecture de la Vague 1 a d'ailleurs cru y voir un `end if;` surnuméraire
// vers la ligne 500. Le fichier a été REJOUÉ en entier sur `nexus-test` dans
// une transaction annulée (recette `supabase/phase-c/recette-test.sh`) : il
// s'exécute intégralement et ses huit contrôles internes passent. La syntaxe
// n'était pas en cause. Ce qui manquait, c'était le moyen de le savoir sans
// base de données — ce fichier-ci.
//
// CE QU'IL VÉRIFIE, ET COMMENT
//
// La CI n'a pas de base : elle ne référence aucun secret et aucun test n'ouvre
// de connexion réseau (`tests.yml` l'énonce, c'est une propriété à préserver).
// On ne peut donc pas EXÉCUTER le script ici. On peut en revanche l'ANALYSER
// pour de bon : `outils/analyser-sql-plpgsql.js` retire commentaires et
// littéraux, isole les corps `$$ … $$` et vérifie l'appariement des blocs avec
// une pile typée — un `end if` doit fermer un `if`, pas un `begin`.
//
// Et comme une garde verte ne prouve rien tant qu'on n'a pas vu ce qui la fait
// rougir (leçon des quatre gardes vertes et inutiles du 08/09), la partie C
// rejoue l'analyse sur SIX versions mutées du fichier, dont exactement celle
// que la relecture croyait lire.

const fs = require('fs');
const assert = require('assert');
const A = require(__dirname + '/outils/analyser-sql-plpgsql.js');

const PHASE_C = __dirname + '/supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql';
const sqlPhaseC = fs.readFileSync(PHASE_C, 'utf8');

// ─────────────────────────────────────────────────────────────────────────
// A. Le script de la Phase C, et tout ce qui vit à côté de lui, s'analysent.
// ─────────────────────────────────────────────────────────────────────────

const dossierPhaseC = __dirname + '/supabase/phase-c/';
const fichiersPhaseC = fs.readdirSync(dossierPhaseC).filter(f => f.endsWith('.sql')).sort();
assert.ok(fichiersPhaseC.includes('20260916230000_fdj_rls_definitives_phase_c.sql'),
  'Le script de la Phase C doit être là où cette garde le cherche.');

for (const f of fichiersPhaseC) {
  const sql = fs.readFileSync(dossierPhaseC + f, 'utf8');
  let resultat;
  assert.doesNotThrow(() => { resultat = A.analyserFichier(sql); },
    `supabase/phase-c/${f} n'est pas analysable — il ne s'exécutera pas.`);
  assert.ok(resultat.blocs > 0,
    `supabase/phase-c/${f} ne contient aucun bloc : l'analyse n'a rien regardé.`);
}
console.log(`OK — les ${fichiersPhaseC.length} fichiers de supabase/phase-c/ s'analysent.`);

// Les douze migrations de la Vague 1 sont les prérequis du script (condition C1
// de son en-tête) : elles doivent passer sur le même pied.
const dossierMigrations = __dirname + '/supabase/migrations/';
const vague1 = fs.readdirSync(dossierMigrations)
  .filter(f => /^202609162208?\d\d_fdj_/.test(f) || /^2026091622\d{4}_fdj_/.test(f)).sort();
assert.ok(vague1.length >= 12,
  `Les douze migrations de la Vague 1 doivent être trouvées (trouvées : ${vague1.length}).`);
for (const f of vague1) {
  assert.doesNotThrow(() => A.analyserFichier(fs.readFileSync(dossierMigrations + f, 'utf8')),
    `supabase/migrations/${f} n'est pas analysable.`);
}
console.log(`OK — les ${vague1.length} migrations de la Vague 1 s'analysent.`);

// ─────────────────────────────────────────────────────────────────────────
// B. L'ancrage transactionnel — ce qui rend l'exécution sur Test réversible.
// ─────────────────────────────────────────────────────────────────────────
//
// La recette joue le fichier EXACT du dépôt sur `nexus-test`, en substituant
// deux lignes et deux seulement : `begin;` (la transaction est déjà ouverte
// par la recette) et `commit;` (la recette termine par `rollback`). Le diff
// à deux lignes est la preuve que le fichier exécuté est bien celui-ci.
//
// Cette substitution n'est possible que si ces deux instructions sont seules
// sur leur ligne et uniques. Si quelqu'un écrivait `commit; -- fini`, ou
// ajoutait un second `commit;`, la recette cesserait silencieusement d'être
// réversible : elle appliquerait pour de bon la Phase C sur la base visée.
// Cette partie interdit cette dérive.

const ancrage = A.ancrageTransaction(sqlPhaseC);
assert.strictEqual(ancrage.begin.length, 1,
  `Le script doit porter exactement un « begin; » seul sur sa ligne (trouvés : ${ancrage.begin.length}).`);
assert.strictEqual(ancrage.commit.length, 1,
  `Le script doit porter exactement un « commit; » seul sur sa ligne (trouvés : ${ancrage.commit.length}).`);
assert.strictEqual(ancrage.rollback.length, 0,
  'Le script ne doit contenir aucun « rollback; » : la recette de Test est seule à décider d\'annuler.');
assert.ok(ancrage.commit[0] > ancrage.begin[0],
  'Le « commit; » doit suivre le « begin; ».');

// Rien d'exécutable après le commit — sinon la substitution laisserait du SQL
// hors transaction, qui s'appliquerait pour de bon.
const apresCommit = sqlPhaseC.split('\n').slice(ancrage.commit[0])
  .filter(l => l.trim() !== '' && !l.trim().startsWith('--'));
assert.strictEqual(apresCommit.length, 0,
  'Après le « commit; » le fichier ne doit plus contenir que des commentaires — '
  + `sinon ces ${apresCommit.length} ligne(s) s'exécuteraient hors transaction.`);
console.log(`OK — ancrage transactionnel : begin; ligne ${ancrage.begin[0]}, commit; ligne ${ancrage.commit[0]}, rien après.`);

// ─────────────────────────────────────────────────────────────────────────
// C. Les mutations — sans elles, tout ce qui précède ne prouve rien.
// ─────────────────────────────────────────────────────────────────────────

const lignes = sqlPhaseC.split('\n');
const ligneDe = (motif, depuis) => {
  const i = lignes.findIndex((l, n) => n >= (depuis || 0) && motif.test(l));
  assert.notStrictEqual(i, -1, `Mutation impossible à viser : ${motif} introuvable.`);
  return i;
};

// Le bloc de contrôles internes (§7) est celui que la relecture accusait.
const debutControles = ligneDe(/^do \$\$/, ligneDe(/§7/));
const unEndIf = ligneDe(/^\s*end if;\s*$/, debutControles);

const mutations = [
  ['un « end if; » surnuméraire dans le bloc de contrôles — l\'anomalie que la relecture croyait lire',
    () => { const m = lignes.slice(); m.splice(unEndIf + 1, 0, '    end if;'); return m; }],
  ['un « end if; » retiré',
    () => { const m = lignes.slice(); m[unEndIf] = '    -- end if;'; return m; }],
  ['« end loop; » là où la grammaire attend « end if; »',
    () => { const m = lignes.slice(); m[unEndIf] = '    end loop;'; return m; }],
  ['un « begin » de bloc jamais refermé',
    () => { const m = lignes.slice(); m.splice(debutControles + 3, 0, '  begin'); return m; }],
  ['le « begin » du bloc de contrôles retiré',
    () => { const m = lignes.slice(); m[ligneDe(/^\s*begin\s*$/, debutControles)] = '  -- begin'; return m; }],
  // Attention en écrivant cette dernière : COMMENTER la marque de fin ne la
  // retire pas. À l'intérieur d'un corps dollar-quoté, PostgreSQL n'interprète
  // plus les commentaires — le `$$` d'un `-- $$;` referme donc le corps pour de
  // bon, et l'analyseur fait pareil, fidèlement. Il faut supprimer la ligne.
  ['la marque de fin du corps $$ supprimée',
    () => { const m = lignes.slice(); m.splice(ligneDe(/^\$\$;\s*$/, debutControles), 1); return m; }],
];

for (const [nom, muter] of mutations) {
  const mute = muter().join('\n');
  assert.notStrictEqual(mute, sqlPhaseC, `La mutation « ${nom} » n'a rien changé : elle vise à côté.`);
  assert.throws(() => A.analyserFichier(mute), A.ErreurSql,
    `MUTATION NON DÉTECTÉE — « ${nom} » passerait l'analyse. La garde ne mord pas.`);
}
console.log(`OK — les ${mutations.length} mutations du script sont détectées.`);

// La substitution de la recette, elle, doit rester VERTE : c'est le fichier
// exact, moins son contrôle de transaction.
const commeLaRecette = lignes.slice();
commeLaRecette[ancrage.begin[0] - 1] = '-- [RECETTE] begin;';
commeLaRecette[ancrage.commit[0] - 1] = '-- [RECETTE] commit;';
assert.doesNotThrow(() => A.analyserFichier(commeLaRecette.join('\n')),
  'Le corps joué par la recette de Test doit s\'analyser — sinon la recette ne prouve rien.');
console.log('OK — contre-mutation : le corps joué par la recette de Test reste analysable.');

// ─────────────────────────────────────────────────────────────────────────
// D. L'analyseur ne doit pas crier au loup.
// ─────────────────────────────────────────────────────────────────────────
//
// Une garde qui rougit sur du SQL valide finit désactivée, et elle emporte
// avec elle la détection qu'elle était censée apporter. Elle est donc passée
// sur TOUT `supabase/migrations/` — des centaines de fichiers écrits sans
// jamais penser à elle, avec leurs `case … end` d'expression, leurs
// `drop policy if exists` et leurs corps imbriqués.

const toutes = fs.readdirSync(dossierMigrations).filter(f => f.endsWith('.sql'));
const faussesAlertes = [];
for (const f of toutes) {
  try { A.analyserFichier(fs.readFileSync(dossierMigrations + f, 'utf8')); }
  catch (e) { faussesAlertes.push(`${f} : ${e.message}`); }
}
assert.strictEqual(faussesAlertes.length, 0,
  'L\'analyseur rougit sur des migrations déjà appliquées — donc il se trompe :\n  '
  + faussesAlertes.join('\n  '));
console.log(`OK — aucune fausse alerte sur les ${toutes.length} migrations du dépôt.`);

console.log('La Phase C est analysable, son ancrage transactionnel tient, et la garde mord.');
