// GOUVERNANCE-REFERENCE-CODE-20261005, decision-5 (GO humain de Frédéric,
// 07/10/2026) : condition 1 (D1) et condition 3 (D3).
//
// request-1.md (05/10/2026) pose la règle de séparation des autorités :
// origin/production référence le code applicatif, le rail référence le
// protocole Handoff. Son §3 demandait, « à construire dans un lot
// d'outillage séparé », un calcul outillé du merge-base et du diff
// applicatif entre le rail et origin/production, pour remplacer la
// vérification manuelle refaite à la main à chaque dépôt de request-N.md
// (constatée quatre fois de suite dans ce lot : request-1 à request-5).
//
// D3 : `nouvelleDemande` refusait d'ouvrir un second lot actif avec un
// message affirmant qu'une décision « n'est pas consommée », alors que le
// test ne regarde que l'existence d'une décision dans l'historique du lot
// actif visé — y compris une décision déjà consommée dont le lot est
// retombé en ATTENTE_DECISION après une nouvelle demande. Le message est
// corrigé pour décrire ce qu'il mesure réellement ; le comportement
// (refus) est inchangé et déjà couvert par test_handoff_v2_20260905.js.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'LOT-REFERENCE-PRODUCTION-20261007';

function git(...args) { return execFileSync('git', args, { cwd: RACINE, encoding: 'utf8' }).trim(); }

function refsReelles() {
  return ['main', 'production'].map(r => `${r}=${git('rev-parse', '--short', `origin/${r}`)}`).join(' ');
}

function registreVide() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-ref-prod-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ lots: {} }, null, 2) + '\n');
  return dir;
}

function corpsJetable(dir) {
  const f = path.join(dir, 'corps.md');
  fs.writeFileSync(f, 'Corps de demande jetable.\n');
  return f;
}

function deposer(dir, args) {
  try {
    return { code: 0, sortie: execFileSync('node', [OUTIL, 'demande', LOT, corpsJetable(dir), '--token-mode', 'LEAN'].concat(args || []),
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) };
  } catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}

let passes = 0, echecs = [];
function verifier(nom, fn) {
  try { fn(); passes++; console.log('OK — ' + nom); }
  catch (e) { echecs.push({ nom, erreur: e }); console.log('ÉCHEC — ' + nom + '\n  ' + e.message); }
}

// ── Référence indépendante, calculée hors de l'outil ────────────────────────
// Le test ne doit pas recopier la logique de l'outil : il recalcule par un
// chemin différent (git brut) pour que les deux puissent diverger si l'un
// des deux se trompe.
const MERGE_BASE_REEL = git('merge-base', 'HEAD', 'origin/production');
const FICHIERS_DIFF_REELS = (() => {
  const diff = execFileSync('git', ['diff', '--name-only', 'HEAD', 'origin/production'], { cwd: RACINE, encoding: 'utf8' }).trim();
  return diff ? diff.split('\n') : [];
})();
const NB_APPLICATIFS_REEL = FICHIERS_DIFF_REELS.filter(f =>
  f.startsWith('supabase/migrations/') || /^NEXUS-.*\.html$/.test(path.basename(f)) || /^nexus-.*\.js$/.test(path.basename(f))
).length;

verifier('handoff.js demande déclare automatiquement le merge-base avec origin/production', () => {
  const dir = registreVide();
  const r = deposer(dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const requete = fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8');
  assert.ok(requete.includes('id: merge-base-production'), 'la preuve merge-base-production doit être déclarée :\n' + requete);
  assert.ok(requete.includes(`valeur: ${MERGE_BASE_REEL}`),
    `la valeur déclarée doit être le vrai merge-base (${MERGE_BASE_REEL}), pas recalculée par le test autrement qu'en git brut :\n` + requete);
});

verifier('handoff.js demande déclare automatiquement le compte de fichiers applicatifs divergents', () => {
  const dir = registreVide();
  const r = deposer(dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const requete = fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8');
  assert.ok(requete.includes('id: diff-applicatif-production'), 'la preuve diff-applicatif-production doit être déclarée :\n' + requete);
  assert.ok(requete.includes(`valeur: ${NB_APPLICATIFS_REEL}-fichiers`),
    `le compte déclaré doit correspondre au diff réel (${NB_APPLICATIFS_REEL}) :\n` + requete);
});

verifier('les deux preuves automatiques sont classées VERIFIED quand origin/production se résout', () => {
  const dir = registreVide();
  const r = deposer(dir);
  assert.strictEqual(r.code, 0, r.sortie);
  const requete = fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8');
  const bloc = requete.split('---')[1];
  assert.ok(/id: merge-base-production\s*\n\s*classe: VERIFIED/.test(bloc), bloc);
  assert.ok(/id: diff-applicatif-production\s*\n\s*classe: VERIFIED/.test(bloc), bloc);
});

// ── Dégradation — le ref peut manquer sans faire planter l'outil ───────────
// Vécu plusieurs fois dans ce même fil : des sessions où `origin/production`
// n'était pas résolvable. Un calcul qui ferait planter TOUT dépôt de
// request-N.md dès que ce ref manque serait une régression bien pire que
// l'absence du calcul lui-même.
verifier('calculerReferenceProduction se dégrade proprement si origin/production est illisible', () => {
  // `git()` dans l'outil utilise toujours RACINE (le dépôt réel, dérivé de
  // __dirname de handoff.js), jamais le cwd de l'appelant : exécuter l'outil
  // depuis un autre répertoire ne suffit donc pas à simuler l'absence de
  // origin/production. On passe par une copie temporaire de l'outil dans son
  // propre dossier `outils/`, pointée vers un dépôt git jetable sans remote
  // via une variable d'environnement dédiée au test — sans toucher au vrai
  // origin/production du dépôt réel.
  const outilsDir = path.join(RACINE, 'outils');
  const copie = path.join(outilsDir, '.handoff-mutant-test-reference-production-20261007.js');
  try {
    const source = fs.readFileSync(OUTIL, 'utf8');
    // Rend RACINE pointable vers un dépôt jetable sans remote, uniquement
    // pour cette copie : seule la définition de RACINE est substituée.
    const patch = source.replace(
      "const RACINE = path.resolve(__dirname, '..');",
      "const RACINE = process.env.NEXUS_HANDOFF_TEST_RACINE || path.resolve(__dirname, '..');"
    );
    assert.notStrictEqual(patch, source, 'le patch de RACINE doit avoir trouvé sa cible dans le source réel');
    fs.writeFileSync(copie, patch);
    const depotVide = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-ref-prod-git-vide-'));
    execFileSync('git', ['init', '-q'], { cwd: depotVide });
    const sortie = execFileSync('node',
      ['-e', `const h=require(${JSON.stringify(copie)});process.stdout.write(JSON.stringify(h.calculerReferenceProduction()))`],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_TEST_RACINE: depotVide } });
    const r = JSON.parse(sortie);
    assert.strictEqual(r.disponible, false, 'sans origin/production, le calcul doit se déclarer indisponible, pas planter : ' + sortie);
  } finally {
    if (fs.existsSync(copie)) fs.unlinkSync(copie);
  }
});

// ── Mutation négative réelle — pas une lecture de source ────────────────────
// `estFichierApplicatif` est la seule décision métier du calcul : quels
// fichiers comptent comme « applicatifs ». On l'exécute avec un motif cassé
// (une regex qui ne reconnaît plus NEXUS-*.html) et on vérifie que l'épreuve
// positive plus haut aurait rougi — en la rejouant réellement, pas en la
// relisant.
verifier('mutation négative : une regex NEXUS-*.html cassée fait tomber le compte applicatif', () => {
  // Même contrainte que l'épreuve de dégradation ci-dessus : la copie mutante
  // doit vivre dans outils/ pour que RACINE (dérivé de __dirname dans
  // l'outil) continue de pointer sur le vrai dépôt, faute de quoi le calcul
  // échouerait pour une tout autre raison que la mutation testée.
  const outilsDir = path.join(RACINE, 'outils');
  const copie = path.join(outilsDir, '.handoff-mutant-test-reference-production-20261007.js');
  try {
    const source = fs.readFileSync(OUTIL, 'utf8');
    const CASSE = source.replace('/^NEXUS-.*\\.html$/', '/^NE_JAMAIS_CORRESPONDRE_XYZZY$/');
    assert.notStrictEqual(CASSE, source, 'le remplacement doit avoir trouvé le motif à casser — sinon la mutation ne mute rien');
    fs.writeFileSync(copie, CASSE);
    const sortie = execFileSync('node',
      ['-e', `const h=require(${JSON.stringify(copie)});process.stdout.write(JSON.stringify(h.calculerReferenceProduction()))`],
      { cwd: RACINE, encoding: 'utf8' });
    const r = JSON.parse(sortie);
    assert.strictEqual(r.disponible, true, 'le calcul doit rester disponible : seule la reconnaissance des .html est mutée : ' + sortie);
    const nbReelHtml = FICHIERS_DIFF_REELS.filter(f => /^NEXUS-.*\.html$/.test(path.basename(f))).length;
    // Si le dépôt réel n'a, au moment du run, aucun .html divergent entre le
    // rail et production, la mutation est sans effet observable sur CE diff
    // précis — mais le remplacement de source a déjà été prouvé réel par le
    // `notStrictEqual(CASSE, source)` plus haut, et le motif lui-même est
    // couvert isolément par l'épreuve sur estFichierApplicatif plus bas. Rien
    // à affirmer de plus ici dans ce cas : une assertion qui ne peut jamais
    // échouer ne prouverait rien.
    if (nbReelHtml > 0) {
      assert.notStrictEqual(r.nbApplicatifs, NB_APPLICATIFS_REEL,
        'la mutation doit faire diverger le compte du compte réel — sinon l’épreuve positive ne prouve rien : ' + sortie);
    }
  } finally {
    if (fs.existsSync(copie)) fs.unlinkSync(copie);
  }
});

verifier('estFichierApplicatif reconnaît les trois familles et rien d’autre', () => {
  const { estFichierApplicatif } = require(OUTIL);
  assert.strictEqual(estFichierApplicatif('NEXUS-Carburants-Pilotage-v1.html'), true);
  assert.strictEqual(estFichierApplicatif('nexus-carburant-commande-moteur.js'), true);
  assert.strictEqual(estFichierApplicatif('supabase/migrations/20261005180000_x.sql'), true);
  assert.strictEqual(estFichierApplicatif('docs/handoff/STATE.json'), false);
  assert.strictEqual(estFichierApplicatif('outils/handoff.js'), false, 'un outil Handoff n’est pas applicatif métier');
  assert.strictEqual(estFichierApplicatif('test_carburant_commande_moteur_v2238.js'), false, 'un fichier de test n’est pas un moteur');
});

if (echecs.length) {
  console.log(`\n${echecs.length} épreuve(s) en échec sur ${passes + echecs.length} :`);
  for (const e of echecs) console.log(`\n— ${e.nom}\n  ${e.erreur.message}`);
  process.exit(1);
}
console.log(`\n${passes} vérifications passées — le merge-base et le diff applicatif se calculent, ils ne se déclarent plus à la main.`);
