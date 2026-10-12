// NEXUS — ENOENT intermittent sur `test_continuite_bout_en_bout_20260930.js` (CI run
// 38312073618, 317/327, 1 échec non classé), diagnostiqué et corrigé le 12/10/2026.
//
// MÊME CLASSE DE DÉFAUT que §10 du 10/09/2026 (commit 51f0ac0), mais côté LECTEUR
// cette fois. Là-bas, des fixtures écrites à la racine réelle cassaient un
// `readdir`-puis-copie ailleurs ; corrigé en sortant les fixtures du dépôt.
// Ici, quatre épreuves écrivent un module mutant ÉPHÉMÈRE directement dans le
// vrai `outils/` — elles DOIVENT y rester, car le module muté `require()` ses
// voisins par chemin relatif (`./capacites-canal.js`, etc.), donc le sortir du
// dépôt casserait la mutation elle-même :
//   - test_boucle_autonome_20261010.js     → outils/.relancer-claude-ci-mutant-<pid>.js
//   - test_execution_recue_20261012.js     → outils/.mut-handoff-e5.js
//   - test_handoff_rail_actif_20261010.js  → outils/.handoff-mutant-<pid>.js
//   - test_ordre_depuis_demande_20261012.js→ outils/.mut-handoff.js, outils/.mut-preparer.js
//
// Six épreuves, en revanche, copient RÉCURSIVEMENT tout `outils/` vers un bac à
// sable pour y faire tourner les outils réels dans un dépôt jetable :
//   test_continuite_bout_en_bout_20260930.js, test_ordre_depuis_demande_20261012.js,
//   test_escalade_humaine_20261007.js, test_reveil_autosuffisant_20261007.js,
//   test_mutations_rapatriement_20260930.js, test_relais_arbitre_openai_20261007.js
//
// `run-tests.js` lance les fichiers de test EN PARALLÈLE (jusqu'à 8 voies) : un
// `fs.cpSync(outils, dst, {recursive:true})` qui croise l'apparition/disparition
// d'un de ces mutants lève un ENOENT intermittent — exactement le défaut observé.
//
// LE CORRECTIF (12/10/2026) : chacun des six `cpSync` ci-dessus porte désormais
// `filter: (f) => !path.basename(f).startsWith('.')`. Aucun fichier RÉEL de
// `outils/` ne commence par un point (vérifié ci-dessous, pas supposé) ; seuls
// les mutants éphémères le font. Exclure les fichiers « point » retire donc la
// fenêtre de course sans jamais omettre un outil réel.
//
// Ce fichier prouve trois choses distinctes :
//   1. (mutation, bac à sable hors dépôt) le mécanisme causal est réel — un
//      second PROCESSUS qui écrit/supprime un `.js` « point » dans le
//      répertoire copié, PENDANT qu'un `cpSync` récursif SANS le filtre le
//      traite, reproduit l'ENOENT ; avec le filtre, la même course ne le
//      reproduit jamais ; sans aucune écriture concurrente, le même `cpSync`
//      ne peut par construction jamais échouer ainsi (contre-épreuve) ;
//   2. (câblage) les six sites de copie du dépôt portent réellement ce
//      filtre, et aucun fichier réel de `outils/` ne commence par un point —
//      sinon le filtre écarterait un outil réel en silence ;
//   3. (comportemental, conditions réelles) plusieurs rounds, en parallèle,
//      des six épreuves copieuses ET des quatre épreuves qui écrivent un
//      mutant dans le vrai `outils/` — exactement la condition de course du
//      défaut — ne produisent ni échec, ni ENOENT, ni mutant orphelin, ni
//      salissure de l'arbre Git.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');

const RACINE = __dirname;
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const SITES_COPIEURS = [
  'test_continuite_bout_en_bout_20260930.js',
  'test_ordre_depuis_demande_20261012.js',
  'test_escalade_humaine_20261007.js',
  'test_reveil_autosuffisant_20261007.js',
  'test_mutations_rapatriement_20260930.js',
  'test_relais_arbitre_openai_20261007.js',
];
const SITES_ECRIVAINS_MUTANTS = [
  'test_boucle_autonome_20261010.js',
  'test_execution_recue_20261012.js',
  'test_handoff_rail_actif_20261010.js',
  // test_ordre_depuis_demande_20261012.js écrit AUSSI des mutants dans le vrai
  // outils/ ; il figure déjà dans SITES_COPIEURS, pas dupliqué ici.
];

// ── 1. Le mécanisme causal, reproduit HORS du dépôt réel ────────────────────

/** Une copie fidèle des .js réels de outils/, dans un répertoire temporaire. */
function bacASable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cpsync-bac-'));
  const src = path.join(dir, 'outils');
  fs.mkdirSync(src);
  for (const f of fs.readdirSync(path.join(RACINE, 'outils'))) {
    const chemin = path.join(RACINE, 'outils', f);
    if (fs.statSync(chemin).isFile()) fs.copyFileSync(chemin, path.join(src, f));
  }
  return { dir, src };
}

/**
 * Un vrai second PROCESSUS qui écrit/supprime un `.js` « point » dans `src`
 * en boucle serrée, pendant `dureeMs`. Un seul thread JS ne peut jamais
 * entrelacer write/scan/copy/unlink dans cet ordre — la course n'existe
 * qu'entre deux processus indépendants, exactement ce que fait run-tests.js.
 */
function lancerEcrivain(src, dureeMs) {
  const cheminMutant = path.join(src, '.ghost-mutant-repro-20261012.js');
  const script = `
    const fs = require('fs');
    const chemin = ${JSON.stringify(cheminMutant)};
    const fin = Date.now() + ${dureeMs};
    while (Date.now() < fin) {
      try { fs.writeFileSync(chemin, '// mutant ephemere de reproduction\\n'); } catch (e) {}
      try { fs.unlinkSync(chemin); } catch (e) {}
    }
  `;
  const p = spawn(process.execPath, ['-e', script], { stdio: 'ignore' });
  return { p, fin: new Promise((resolve) => p.once('exit', resolve)), cheminMutant };
}

/** `dureeMs` de copies répétées. Rend { enoent, iterations }. */
async function copiesRepetees(src, dureeMs, avecFiltre) {
  const dstBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cpsync-dst-'));
  const opts = avecFiltre
    ? { recursive: true, filter: (f) => !path.basename(f).startsWith('.') }
    : { recursive: true };
  let enoent = false;
  let iterations = 0;
  const debut = Date.now();
  try {
    while (Date.now() - debut < dureeMs) {
      iterations++;
      const dst = path.join(dstBase, `r${iterations}`);
      try {
        fs.cpSync(src, dst, opts);
      } catch (err) {
        if (err.code === 'ENOENT') { enoent = true; break; }
        throw err;
      } finally {
        fs.rmSync(dst, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(dstBase, { recursive: true, force: true });
  }
  return { enoent, iterations };
}

async function preuveMutation() {
  const DUREE_MS = 3000;

  // (a) SANS le filtre : la course doit reproduire l'ENOENT.
  {
    const { dir, src } = bacASable();
    const ecrivain = lancerEcrivain(src, DUREE_MS);
    let resultat;
    try {
      resultat = await copiesRepetees(src, DUREE_MS, false);
    } finally {
      ecrivain.p.kill();
      await ecrivain.fin;
      try { fs.unlinkSync(ecrivain.cheminMutant); } catch (_) { /* déjà absent */ }
      fs.rmSync(dir, { recursive: true, force: true });
    }
    verifier(
      `(mutation) sans le filtre, un second processus qui écrit/supprime un mutant « point » dans le répertoire copié pendant un cpSync récursif reproduit l'ENOENT (${resultat.iterations} copie(s) tentée(s))`,
      resultat.enoent
    );
  }

  // (b) AVEC le filtre : la MÊME course ne doit jamais reproduire l'ENOENT.
  {
    const { dir, src } = bacASable();
    const ecrivain = lancerEcrivain(src, DUREE_MS);
    let resultat;
    try {
      resultat = await copiesRepetees(src, DUREE_MS, true);
    } finally {
      ecrivain.p.kill();
      await ecrivain.fin;
      try { fs.unlinkSync(ecrivain.cheminMutant); } catch (_) { /* déjà absent */ }
      fs.rmSync(dir, { recursive: true, force: true });
    }
    verifier(
      `(correctif) avec le filtre « point », la même course ne lève jamais ENOENT (${resultat.iterations} copie(s) complétée(s))`,
      !resultat.enoent && resultat.iterations > 0
    );
  }

  // (c) Contre-épreuve : sans aucune écriture concurrente, 20 copies ne
  // peuvent par construction jamais échouer — isole l'écriture concurrente
  // comme cause, pas le simple fait de copier récursivement.
  {
    const { dir, src } = bacASable();
    let echec = null;
    const dstBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cpsync-ctrl-'));
    try {
      for (let i = 0; i < 20; i++) {
        const dst = path.join(dstBase, `c${i}`);
        fs.cpSync(src, dst, { recursive: true });
        fs.rmSync(dst, { recursive: true, force: true });
      }
    } catch (err) {
      echec = err;
    } finally {
      fs.rmSync(dstBase, { recursive: true, force: true });
      fs.rmSync(dir, { recursive: true, force: true });
    }
    verifier('(contre-épreuve) sans écriture concurrente, 20 copies récursives ne lèvent jamais ENOENT', echec === null);
  }
}

// ── 2. Câblage réel : les six sites, et l'hypothèse « aucun outil réel ──────
//      ne commence par un point » ─────────────────────────────────────────

function preuveCablage() {
  for (const fichier of SITES_COPIEURS) {
    const src = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    const motif = /cpSync\([\s\S]*?outils[\s\S]*?\}\);/;
    const appel = motif.exec(src);
    verifier(`${fichier} — le cpSync qui copie outils/ est trouvé`, !!appel);
    if (appel) {
      verifier(
        `${fichier} — ce cpSync porte bien le filtre « point »`,
        /filter:\s*\(f\)\s*=>\s*!path\.basename\(f\)\.startsWith\(['"]\.['"]\)/.test(appel[0])
      );
    }
  }

  const reelsAvecPoint = fs.readdirSync(path.join(RACINE, 'outils'))
    .filter((f) => f.startsWith('.'));
  verifier(
    `aucun fichier RÉEL de outils/ ne commence par un point (le filtre n'écarte donc jamais un outil réel) — trouvé : ${reelsAvecPoint.join(', ') || 'aucun'}`,
    reelsAvecPoint.length === 0
  );
}

// ── 3. Preuve comportementale : les copieurs ET les écrivains de mutants, ──
//      en parallèle, plusieurs rounds, en conditions réelles ───────────────

function lancer(fichier) {
  return new Promise((resolve) => {
    execFile('node', [fichier], { cwd: RACINE, timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ fichier, code: err ? (err.code || 1) : 0, stdout, stderr });
    });
  });
}

async function executionsParalleles() {
  const ROUNDS = 3;
  const resultats = [];
  const fichiers = [...SITES_COPIEURS, ...SITES_ECRIVAINS_MUTANTS];
  for (let r = 0; r < ROUNDS; r++) {
    const lot = await Promise.all(fichiers.map(lancer));
    resultats.push(...lot);
  }
  return resultats;
}

(async () => {
  await preuveMutation();
  preuveCablage();

  const avant = execFileSync('git', ['status', '--short', '--', 'outils/'], { cwd: RACINE, encoding: 'utf8' });

  const resultats = await executionsParalleles();

  const echecs = resultats.filter((r) => r.code !== 0);
  verifier(`${resultats.length} exécutions parallèles complètes (6 copieurs × 3 rounds + 3 écrivains × 3 rounds), toutes en succès (0 échec)`, echecs.length === 0);
  if (echecs.length) {
    for (const e of echecs) console.log(`  ÉCHEC — ${e.fichier} : code ${e.code}\n${e.stderr}`);
  }

  const avecEnoent = resultats.filter((r) => /ENOENT/.test(r.stdout) || /ENOENT/.test(r.stderr));
  verifier('zéro ENOENT sur l\'ensemble des exécutions parallèles', avecEnoent.length === 0);

  const orphelins = fs.readdirSync(path.join(RACINE, 'outils')).filter((f) => f.startsWith('.'));
  verifier(`zéro mutant « point » orphelin dans outils/ après coup (${orphelins.join(', ') || 'aucun'})`, orphelins.length === 0);

  const apres = execFileSync('git', ['status', '--short', '--', 'outils/'], { cwd: RACINE, encoding: 'utf8' });
  verifier('aucune salissure de outils/ dans l\'arbre Git après les exécutions parallèles', apres === avant);

  console.log(`\n${ok} vérifications passées.`);
})();
