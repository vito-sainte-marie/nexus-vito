'use strict';

// ════════════════════════════════════════════════════════════════════════════
// L'ARTEFACT DE REMISE EN SERVICE DE LA CONNEXION PRODUCTION
//
// POURQUOI CETTE ÉPREUVE EXISTE.
//
// `outils/migration-login-production-a-executer-par-frederic.sql` a été joué
// sept fois sur un banc jetable `supabase/postgres:17.6.1.175` le 01/10/2026,
// et ce banc a prouvé qu'il REFUSE : rejouer sur un état déjà migré, un état
// mi-chemin, une colonne absente, un `revoke select` retiré, un `alter view`
// retiré. Le banc est parti avec le conteneur. Cette épreuve garde ce que le
// banc a appris, là où le dépôt peut le remesurer à chaque exécution : dans
// la FORME du fichier.
//
// Elle ne refait pas le banc. Elle mesure les six propriétés sans lesquelles
// les résultats du banc ne valent plus rien :
//
//   1. la transaction enveloppe bien tout ce qui écrit — c'est la seule garde
//      qui ne dépende pas du client, puisque `psql` sort avec 0 même sur un
//      refus (mesuré, 01/10) ;
//   2. la relecture terminale est HORS de la transaction, sinon elle ne parle
//      pas quand la transaction est annulée — or c'est précisément le cas où
//      on a besoin de la lire ;
//   3. le corps appliqué est celui du dépôt, octet pour octet. Rien n'est
//      recréé de mémoire : si la migration canonique bouge, cette épreuve
//      rougit ;
//   4. le verdict interroge `has_function_privilege` et non le TEXTE de
//      l'ACL. C'est la leçon la plus coûteuse du banc : les default
//      privileges de Supabase posent déjà `anon=X` et `authenticated=X` sur
//      une fonction créée dans `public`, AVANT tout `grant`. Une garde qui
//      cherche `anon=X` dans `proacl` est verte même si les deux
//      `grant execute` ont disparu ;
//   5. le contrôle 4c exige le code `insufficient_privilege` et traite une
//      lecture réussie à 0 ligne comme un ÉCHEC. Un 0 n'est pas un refus ;
//   6. la procédure que la garde d'ordre exigera est sur disque, et la fiche
//      de qualification est PRÉPARÉE sans être INSÉRÉE — l'insérer sans
//      mesure datée de Production serait la faute même que cette garde
//      existe pour empêcher.
//
// CE QU'ELLE NE MESURE PAS : que PostgreSQL accepte ce SQL, ni qu'il se
// comporte comme attendu. Ça s'est mesuré sur le banc, le 01/10, et c'est
// écrit dans `docs/deploiement/procedure-migration-login-production.md`.
// Une mesure ne se construit pas : cette épreuve n'invente pas une base.
//
// POURQUOI CHAQUE CONTRÔLE EST UN COUPLE. Une garde verte ne prouve rien :
// elle peut être verte parce que la propriété tient, ou parce que le contrôle
// ne regarde pas où il croit. Chaque cas est donc écrit deux fois — la forme
// correcte, qui doit passer, et la MUTATION MINIMALE de cette même forme, qui
// doit être refusée avec son code exact.
//
// LES MUTATIONS SONT ISOLÉES. Chacune repart du texte d'origine et touche une
// seule clause. Deux mutations concurrentes dans le même bac ne mesurent
// rien : l'une restaure ce que l'autre casse, et le vert ressemble au vrai
// défaut.
// ════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ARTEFACT = path.join('outils', 'migration-login-production-a-executer-par-frederic.sql');
const CANONIQUE = path.join('supabase', 'migrations', '20260904175747_login_non_enumerable.sql');
const PROCEDURE = path.join('docs', 'deploiement', 'procedure-migration-login-production.md');
const QUALIFICATION = path.join('docs', 'deploiement', 'qualification-ordre-migration-code.json');
const ESTAMPILLE = '20260904175747';

// Les deux bornes du corps repris du dépôt. Des bornes de TEXTE et non des
// numéros de ligne : un numéro de ligne se décale au premier commentaire ajouté
// dans la migration canonique, et l'épreuve rougirait pour la mauvaise raison.
const CORPS_DEBUT = '-- 1. La seule question que la connexion a le droit de poser.';
const CORPS_FIN = 'alter view public.employees_public set (security_invoker = true);';

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

function lire(p) { return fs.readFileSync(path.join(__dirname, p), 'utf8'); }

// Extrait un bloc borné, bornes incluses. Rend null si une borne manque : c'est
// une absence, pas un bloc vide, et les deux ne se confondent pas.
function bloc(texte, debut, fin) {
  const lignes = texte.split('\n');
  const i = lignes.indexOf(debut);
  const j = lignes.indexOf(fin);
  if (i === -1 || j === -1 || j < i) return null;
  return lignes.slice(i, j + 1).join('\n');
}

// Le découpage en sections, lu dans les en-têtes numérotés du fichier lui-même.
function section(texte, numero) {
  const lignes = texte.split('\n');
  const debut = lignes.findIndex((l) => l.startsWith('-- ' + numero + '. '));
  if (debut === -1) return null;
  let fin = lignes.length;
  for (let k = debut + 1; k < lignes.length; k++) {
    if (/^-- \d+\. /.test(lignes[k])) { fin = k; break; }
  }
  return lignes.slice(debut, fin).join('\n');
}

// Et le grain plus fin : les sous-contrôles 4a..4d, bornés par leurs propres
// commentaires. Ce grain n'est pas un luxe : `when insufficient_privilege then`
// apparaît DEUX fois dans la section 4, une fois en 4c où il constate le refus
// attendu, une fois en 4d où il constate la panne. Un contrôle qui lirait la
// section entière resterait vert après qu'on ait cassé l'un des deux — mesuré,
// c'est ce qui est arrivé à la première version de cette épreuve.
function sousControle(sectionTexte, lettre) {
  if (sectionTexte === null) return null;
  const lignes = sectionTexte.split('\n');
  const debut = lignes.findIndex((l) => new RegExp('^\\s*-- ' + lettre + '\\. ').test(l));
  if (debut === -1) return null;
  let fin = lignes.length;
  for (let k = debut + 1; k < lignes.length; k++) {
    if (/^\s*-- [a-z]\. /.test(lignes[k])) { fin = k; break; }
  }
  return lignes.slice(debut, fin).join('\n');
}

// ── LE CONTRÔLE ────────────────────────────────────────────────────────────
// Rend la liste des codes de refus. Liste vide = conforme. Le contrôle ne
// connaît que du texte : il reçoit l'artefact et le corps canonique, pour que
// les mutations puissent porter sur l'un sans toucher le dépôt.
function controler(artefact, corpsCanonique, racine) {
  const refus = [];
  const lignes = artefact.split('\n');

  // 1. La transaction enveloppe. Sans elle, un refus laisse la base à
  //    mi-chemin — et `psql` l'annonce quand même avec un code de sortie 0.
  const iBegin = lignes.indexOf('begin;');
  const iCommit = lignes.indexOf('commit;');
  if (iBegin === -1 || iCommit === -1 || iCommit < iBegin) {
    refus.push('TRANSACTION_ABSENTE');
  } else {
    // Tout ce qui écrit doit être DANS la transaction.
    const ecritures = [/^create or replace function /, /^revoke /, /^grant /, /^alter view /, /^comment on function /];
    for (let k = 0; k < lignes.length; k++) {
      if ((k < iBegin || k > iCommit) && ecritures.some((r) => r.test(lignes[k]))) {
        refus.push('ECRITURE_HORS_TRANSACTION');
        break;
      }
    }
    // 2. La relecture terminale est APRÈS le commit, sinon elle se taira
    //    exactement quand on a besoin d'elle.
    const iEtat = lignes.findIndex((l) => l.includes('ETAT_FINAL MIGRATION_LOGIN_APPLIQUEE'));
    if (iEtat === -1) refus.push('RELECTURE_TERMINALE_ABSENTE');
    else if (iEtat < iCommit) refus.push('RELECTURE_TERMINALE_DANS_LA_TRANSACTION');
  }

  // 3. Le corps est celui du dépôt, octet pour octet.
  const corpsArtefact = bloc(artefact, CORPS_DEBUT, CORPS_FIN);
  if (corpsArtefact === null) refus.push('CORPS_INTROUVABLE');
  else if (corpsArtefact !== corpsCanonique) refus.push('CORPS_DIVERGENT');

  // 4 et 5. Le verdict et le contrôle de non-régression.
  const s4 = section(artefact, 4);
  const s5 = section(artefact, 5);
  if (s5 === null) refus.push('VERDICT_ABSENT');
  else {
    const signature = "'public.nexus_identifiant_de_connexion(text)', 'EXECUTE'";
    for (const role of ['anon', 'authenticated']) {
      if (!s5.includes("has_function_privilege('" + role + "', " + signature)) {
        refus.push('EXECUTE_NON_INTERROGE_' + role.toUpperCase());
      }
    }
    // La leçon du banc : chercher `anon=X` dans le texte de l'ACL est une
    // garde verte pour la mauvaise raison. Hors des commentaires, qui ont le
    // droit d'EXPLIQUER pourquoi on ne le fait pas.
    const codeS5 = s5.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    if (/=X%?'/.test(codeS5) || /like\s*'%\w+=X/.test(codeS5)) {
      refus.push('VERDICT_PAR_TEXTE_D_ACL');
    }
  }
  if (s4 === null) refus.push('NON_REGRESSION_ABSENTE');
  else {
    // 4c constate le refus attendu ; 4d constate la panne. Les deux exigent le
    // code exact, et chacun repond de lui-meme.
    for (const lettre of ['c', 'd']) {
      const sc = sousControle(s4, lettre);
      if (sc === null) refus.push('SOUS_CONTROLE_4' + lettre.toUpperCase() + '_ABSENT');
      else if (!sc.includes('when insufficient_privilege then')) {
        refus.push('REFUS_42501_NON_EXIGE_4' + lettre.toUpperCase());
      }
    }
    const c = sousControle(s4, 'c');
    if (c !== null && !c.includes("Un 0 n''est pas un refus")) {
      refus.push('ZERO_PRIS_POUR_UN_REFUS');
    }
  }

  // 6. La procédure que la garde d'ordre exigera est sur disque, et la fiche
  //    est préparée sans être insérée.
  if (!fs.existsSync(path.join(racine, PROCEDURE))) refus.push('PROCEDURE_INTROUVABLE');
  else {
    const proc = fs.readFileSync(path.join(racine, PROCEDURE), 'utf8');
    if (!proc.includes('"etat": "exige_code_d_abord"')) refus.push('FICHE_NON_PREPAREE');
    if (!proc.includes('"procedure": "' + PROCEDURE + '"')) refus.push('FICHE_SANS_PROCEDURE');
  }
  const q = JSON.parse(fs.readFileSync(path.join(racine, QUALIFICATION), 'utf8'));
  if (Object.prototype.hasOwnProperty.call(q.migrations || {}, ESTAMPILLE)) {
    refus.push('FICHE_INSEREE_SANS_MESURE');
  }

  return refus;
}

const RACINE = __dirname;
const ARTEFACT_TEXTE = lire(ARTEFACT);
const CORPS_CANONIQUE = bloc(lire(CANONIQUE), CORPS_DEBUT, CORPS_FIN);

console.log('\nL\'artefact de remise en service de la connexion Production\n');

// ── A. La forme correcte ───────────────────────────────────────────────────
console.log('── A. Le témoin : l\'artefact du dépôt, tel qu\'il est');

assert.ok(CORPS_CANONIQUE !== null,
  'le corps canonique est introuvable dans ' + CANONIQUE + ' : les bornes de texte ont bougé');
ok('le corps canonique se borne dans ' + path.basename(CANONIQUE) + ' (' + CORPS_CANONIQUE.split('\n').length + ' lignes)');

const refusReel = controler(ARTEFACT_TEXTE, CORPS_CANONIQUE, RACINE);
assert.deepStrictEqual(refusReel, [],
  'l\'artefact du dépôt est refusé : ' + refusReel.join(', '));
ok('l\'artefact est conforme aux six propriétés — aucun refus');

// Dire ce qui a été comparé, pas seulement que c'était égal.
const corpsArtefact = bloc(ARTEFACT_TEXTE, CORPS_DEBUT, CORPS_FIN);
assert.strictEqual(corpsArtefact, CORPS_CANONIQUE);
ok('le corps appliqué est celui du dépôt, octet pour octet (' + Buffer.byteLength(CORPS_CANONIQUE) + ' octets)');

// ── B. Casser une clause, une seule, et relire le refus ────────────────────
console.log('\n── B. Les mutations : chacune part du texte d\'origine');

// `interdits` nomme les codes que la mutation ne doit PAS declencher. C'est ce
// qui prouve qu'elle est isolee : une mutation qui refuse tout ne mesure rien
// de plus qu'une mutation qui refuse n'importe quoi.
function mute(quoi, muter, codeAttendu, interdits) {
  const mutee = muter(ARTEFACT_TEXTE);
  assert.notStrictEqual(mutee, ARTEFACT_TEXTE,
    'la mutation « ' + quoi + ' » n\'a RIEN changé : elle ne mesure donc rien');
  const r = controler(mutee, CORPS_CANONIQUE, RACINE);
  assert.ok(r.includes(codeAttendu),
    'la mutation « ' + quoi + ' » aurait dû être refusée par ' + codeAttendu +
    ', refus obtenus : ' + (r.length ? r.join(', ') : '(aucun — la garde ne mord pas)'));
  for (const i of (interdits || [])) {
    assert.ok(!r.includes(i),
      'la mutation « ' + quoi + ' » a AUSSI déclenché ' + i +
      ' : elle n\'est donc pas isolée, et le refus obtenu ne prouve pas ce qu\'il prétend');
  }
  ok(quoi + ' → ' + codeAttendu + ((interdits || []).length ? ', et rien d\'autre' : ''));
}

// Débrancher la transaction. Le fichier s'appliquerait encore, mais un refus
// en milieu de course laisserait la base à mi-chemin.
mute('le `commit;` retiré', (t) => t.replace(/^commit;$/m, '-- commit;'), 'TRANSACTION_ABSENTE');

// La relecture terminale remontée AVANT le commit : elle ne parlerait plus
// quand la transaction est annulée, c'est-à-dire quand on la lit.
mute('la section 6 déplacée dans la transaction', (t) => {
  const lignes = t.split('\n');
  const iCommit = lignes.indexOf('commit;');
  const iS6 = lignes.findIndex((l, k) => k > iCommit && /^-- 6\. /.test(l));
  assert.ok(iS6 > iCommit, 'la section 6 n\'est pas là où cette mutation la cherche');
  const queue = lignes.slice(iS6);
  return lignes.slice(0, iCommit).concat(queue, ['', 'commit;', '']).join('\n');
}, 'RELECTURE_TERMINALE_DANS_LA_TRANSACTION');

// Une écriture qui sort de la transaction.
mute('un `grant execute` sorti de la transaction', (t) => {
  const lignes = t.split('\n');
  const i = lignes.findIndex((l) => l.startsWith('grant execute on function'));
  const sortie = lignes.slice();
  sortie.splice(i, 1);
  sortie.push(lignes[i]);
  return sortie.join('\n');
}, 'ECRITURE_HORS_TRANSACTION');

// Le corps retouché. `stable` → `immutable` est le plus petit écart possible,
// et c'est un écart qui a un sens : une fonction qui lit une table n'est pas
// immuable.
mute('`stable` devenu `immutable` dans le corps',
  (t) => t.replace(/^stable$/m, 'immutable'), 'CORPS_DIVERGENT',
  ['CORPS_INTROUVABLE', 'TRANSACTION_ABSENTE']);

// Le verdict qui lit le texte de l'ACL. C'est le défaut que le banc a trouvé
// dans ma propre première version.
mute('le verdict `anon` repassé sur le texte de l\'ACL', (t) => t.replace(
  "if not has_function_privilege('anon', 'public.nexus_identifiant_de_connexion(text)', 'EXECUTE') then",
  "if v_acl not like '%anon=X%' then"), 'VERDICT_PAR_TEXTE_D_ACL',
  ['EXECUTE_NON_INTERROGE_AUTHENTICATED', 'VERDICT_ABSENT']);

// Débrancher l'aide, pas la casser : le bloc entier disparaît.
mute('le contrôle `authenticated` du verdict débranché', (t) => {
  const lignes = t.split('\n');
  const i = lignes.findIndex((l) => l.includes("has_function_privilege('authenticated'"));
  assert.ok(i !== -1, 'le contrôle `authenticated` est introuvable');
  // if … / raise … / end if;
  assert.ok(/^\s*end if;/.test(lignes[i + 2]), 'le bloc n\'a pas la forme attendue');
  return lignes.slice(0, i).concat(lignes.slice(i + 3)).join('\n');
}, 'EXECUTE_NON_INTERROGE_AUTHENTICATED');

// Le contrôle 4c sans son code d'erreur : il ne saurait plus distinguer un
// refus d'une panne.
// `.replace` sans `g` ne touche que la PREMIÈRE occurrence, celle de 4c. C'est
// voulu : la mutation doit refuser 4c sans refuser 4d, sinon elle ne distingue
// pas les deux et le vert d'origine pouvait venir de n'importe lequel.
mute('le `when insufficient_privilege` du contrôle 4c retiré',
  (t) => t.replace('when insufficient_privilege then', 'when others then'),
  'REFUS_42501_NON_EXIGE_4C', ['REFUS_42501_NON_EXIGE_4D']);

// Et la symétrique : viser la seconde occurrence, celle de 4d.
mute('le `when insufficient_privilege` du contrôle 4d retiré', (t) => {
  const i = t.indexOf('when insufficient_privilege then');
  const j = t.indexOf('when insufficient_privilege then', i + 1);
  assert.ok(j !== -1, 'le contrôle 4d n\'a pas de clause `insufficient_privilege` à muter');
  return t.slice(0, j) + 'when others then' + t.slice(j + 'when insufficient_privilege then'.length);
}, 'REFUS_42501_NON_EXIGE_4D', ['REFUS_42501_NON_EXIGE_4C']);

// Et sans son arrêt sur lecture réussie : un 0 passerait pour un refus.
mute('l\'arrêt sur « un 0 n\'est pas un refus » retiré',
  (t) => t.replace(/Un 0 n''est pas un refus\. /, ''), 'ZERO_PRIS_POUR_UN_REFUS',
  ['REFUS_42501_NON_EXIGE_4C', 'REFUS_42501_NON_EXIGE_4D']);

// ── C. Ce qui vit à côté du fichier ────────────────────────────────────────
console.log('\n── C. La procédure sur disque, et la fiche qui n\'est pas encore posée');

// La garde d'ordre exige la procédure SUR DISQUE quand l'état est
// `exige_code_d_abord` : sans elle, elle refuse par PROCEDURE_INTROUVABLE.
// Mutation : une racine où la procédure n'est pas.
const bacSansProcedure = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexus-login-'));
fs.mkdirSync(path.join(bacSansProcedure, path.dirname(QUALIFICATION)), { recursive: true });
fs.copyFileSync(path.join(RACINE, QUALIFICATION), path.join(bacSansProcedure, QUALIFICATION));
const rSansProc = controler(ARTEFACT_TEXTE, CORPS_CANONIQUE, bacSansProcedure);
assert.ok(rSansProc.includes('PROCEDURE_INTROUVABLE'),
  'une racine sans la procédure aurait dû être refusée, refus obtenus : ' + rSansProc.join(', '));
ok('la procédure absente du disque → PROCEDURE_INTROUVABLE');

// Le `_lecture` de la qualification l'interdit en toutes lettres : déclarer une
// migration sans mesure datée de la cible « serait la faute meme que cette
// garde existe pour empecher ».
const bacFicheInseree = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexus-login-'));
fs.mkdirSync(path.join(bacFicheInseree, path.dirname(QUALIFICATION)), { recursive: true });
fs.copyFileSync(path.join(RACINE, PROCEDURE), (() => {
  fs.mkdirSync(path.join(bacFicheInseree, path.dirname(PROCEDURE)), { recursive: true });
  return path.join(bacFicheInseree, PROCEDURE);
})());
const qMutee = JSON.parse(fs.readFileSync(path.join(RACINE, QUALIFICATION), 'utf8'));
qMutee.migrations[ESTAMPILLE] = { etat: 'exige_code_d_abord' };
fs.writeFileSync(path.join(bacFicheInseree, QUALIFICATION), JSON.stringify(qMutee, null, 4));
const rFiche = controler(ARTEFACT_TEXTE, CORPS_CANONIQUE, bacFicheInseree);
assert.ok(rFiche.includes('FICHE_INSEREE_SANS_MESURE'),
  'la fiche insérée sans mesure aurait dû être refusée, refus obtenus : ' + rFiche.join(', '));
ok('la fiche insérée dans la qualification sans mesure datée → FICHE_INSEREE_SANS_MESURE');

for (const d of [bacSansProcedure, bacFicheInseree]) fs.rmSync(d, { recursive: true, force: true });

// ── D. Ce que la procédure doit dire, parce que personne ne le redécouvrira ─
console.log('\n── D. Les deux leçons du banc, gardées dans la procédure');

const PROC = lire(PROCEDURE);
const leconsAttendues = [
  ['les default privileges rendent une garde d\'ACL verte à tort', 'has_function_privilege'],
  ['`psql` sort 0 sur un refus', 'ON_ERROR_STOP'],
  ['un 0 n\'est pas un refus', 'Un 0 n\'est pas un refus'],
  ['l\'estampille n\'est pas posée, délibérément', 'divergence'],
  ['la recette réelle se fait sur l\'hôte mesuré', 'app.nexusconseil.net'],
  ['le discriminateur sans compte ni PIN', 'Connexion au serveur impossible'],
  ['jamais en éditant 20260919103000', '20260919103000'],
];
for (const [quoi, aiguille] of leconsAttendues) {
  assert.ok(PROC.includes(aiguille),
    'la procédure ne porte plus : ' + quoi + ' (cherché : « ' + aiguille + ' »)');
  ok('la procédure porte ' + quoi);
}

// Et elle ne doit pas porter de PIN ni de valeur saisie. Le contrôle est
// grossier à dessein : il cherche la FORME d'un PIN, pas un PIN connu.
assert.ok(!/\bPIN\s*[:=]\s*\d{4,}/.test(PROC) && !/\b\d{6,}\b/.test(PROC.replace(/202\d{5,}/g, '')),
  'la procédure contient ce qui ressemble à une valeur saisie : un PIN ne sort jamais d\'ici');
ok('la procédure ne contient aucune valeur ressemblant à un PIN');

console.log(`\n${n} tests passés.`);
