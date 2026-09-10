// NEXUS — défaut §10 du 10/09/2026 : une seconde intermittence, cause démontrée.
//
// `test_guardians_router_20260907.js` écrivait des fixtures `.js` directement
// à la racine réelle du dépôt (`__fixture_identite_a__.js`, `__fixture_identite_b__.js`,
// `__fixture_secret_tmp__.js`, `__fixture_app_dep__.js`) le temps d'une assertion,
// puis les supprimait. `test_build_tracabilite_20260905.js` liste les `.js` de
// la racine qui ne commencent pas par `test_`, PUIS les copie un par un. Un
// fichier listé puis supprimé entre les deux donne un `ENOENT` — et
// `run-tests.js` exécute les fichiers de test EN PARALLÈLE (jusqu'à 8 en
// local, 4 en CI), donc les deux épreuves peuvent réellement se chevaucher.
//
// Corrigé le 10/09/2026 : `guardianSecurity`, `guardianArchitectureCollisions`
// et `guardianArchitectureDependances` acceptent désormais un paramètre
// `racine` optionnel (défaut inchangé : RACINE du dépôt, comportement de
// production identique). Les fixtures du routeur Guardians vivent maintenant
// dans un répertoire temporaire HORS du dépôt (`os.tmpdir()`), jamais sous
// `__dirname`.
//
// LA REPRODUCTION A DÉMÉNAGÉ, le 10/09/2026 au soir, et c'est le point le plus
// instructif de ce fichier. Sa première version déclenchait la course sur la
// racine RÉELLE du dépôt : un processus y écrivait et effaçait
// `__fixture_race_repro_20260910__.js` en boucle serrée pendant quatre
// secondes. Elle a donc fait tomber `test_build_tracabilite_20260905.js` en CI
// — exactement le défaut qu'elle démontre, infligé aux autres épreuves pour le
// prouver. Le run `push` 34522377670 le nomme sans ambiguïté :
//
//     copyfile '.../__fixture_race_repro_20260910__.js'
//
// Ce qui rend le mécanisme vrai, c'est l'écart entre `readdir` et `copyFile`
// face à un `write`/`unlink` concurrent DANS LE RÉPERTOIRE BALAYÉ. Que ce
// répertoire soit la racine du dépôt ou une copie fidèle ne change rien à la
// démonstration — cela change seulement qui en souffre. La reproduction opère
// donc désormais sur un bac à sable peuplé des mêmes fichiers, avec leurs
// tailles réelles, pour que la fenêtre de course reste comparable.
//
// Ce fichier prouve deux choses distinctes :
//   1. (mutation) le mécanisme causal est réel — une reproduction indépendante,
//      fidèle au motif exact (écrire/supprimer un `.js` dans le répertoire
//      balayé pendant qu'un lister-puis-copier le traite) produit bien un
//      ENOENT ; sans cette écriture, la même boucle ne peut jamais échouer
//      ainsi ;
//   2. (comportemental, en conditions réelles) plusieurs exécutions parallèles
//      complètes des deux vrais fichiers de test ne produisent ni ENOENT, ni
//      fichier orphelin, ni arbre Git sali.
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

// ── 1. Reproduction indépendante du mécanisme causal (mutation) ─────────
//
// Fidèle au motif réel : un `.js` non préfixé `test_` apparaît et disparaît à
// la racine pendant qu'un balayage « lister puis copier » traite cette racine.
// N'utilise ni test_guardians_router_20260907.js ni test_build_tracabilite_20260905.js
// eux-mêmes (le premier est déjà corrigé ; le second ne doit jamais être
// modifié pour un test) — reproduit la même mécanique de façon autonome.
function listerPuisCopier(dirDest, racineBalayee) {
  // Exactement le motif de copierDepot() dans test_build_tracabilite : un
  // readdirSync, PUIS une boucle de fs.copyFileSync — jamais une seule passe
  // atomique. C'est cet écart entre le listage et la copie qui est en cause.
  const fichiers = fs.readdirSync(racineBalayee).filter(f => /\.js$/.test(f) && !f.startsWith('test_'));
  for (const f of fichiers) {
    fs.copyFileSync(path.join(racineBalayee, f), path.join(dirDest, f));
  }
}

/**
 * Bac à sable : une copie des `.js` que `copierDepot()` balaierait vraiment,
 * avec leurs tailles réelles. La taille compte — c'est la durée des
 * `copyFileSync` qui ouvre la fenêtre de course. Un répertoire peuplé de
 * fichiers vides rétrécirait cette fenêtre et rendrait la reproduction
 * capricieuse, ce qui ferait de cette épreuve exactement ce qu'elle dénonce.
 *
 * La racine réelle n'est ici que LUE. Rien n'y est écrit, à aucun moment.
 */
function bacASable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-racine-'));
  for (const f of fs.readdirSync(RACINE)) {
    if (/\.js$/.test(f) && !f.startsWith('test_')) {
      try { fs.copyFileSync(path.join(RACINE, f), path.join(dir, f)); } catch (e) { /* volatil : sans effet ici */ }
    }
  }
  return dir;
}

// Un seul processus, sans concurrence réelle, ne peut jamais reproduire la
// course : write → scan → unlink dans le même thread s'exécutent forcément
// dans cet ordre, jamais entrelacés. La course n'existe qu'entre DEUX
// processus indépendants — exactement ce que fait run-tests.js en lançant
// chaque fichier de test comme un processus séparé. La reproduction lance
// donc un vrai second processus écrivain, concurrent du balayage du parent.
async function mutationRepro(dureeMs) {
  const nomFixture = '__fixture_race_repro_20260910__.js';
  const racineBalayee = bacASable();
  const cheminRacine = path.join(racineBalayee, nomFixture);
  const dirDest = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-repro-'));
  const scriptEcrivain = `
    const fs = require('fs');
    const chemin = ${JSON.stringify(cheminRacine)};
    const fin = Date.now() + ${dureeMs};
    while (Date.now() < fin) {
      try { fs.writeFileSync(chemin, '// fixture éphémère de reproduction\\n'); } catch (e) {}
      try { fs.unlinkSync(chemin); } catch (e) {}
    }
  `;
  const ecrivain = spawn(process.execPath, ['-e', scriptEcrivain], { stdio: 'ignore' });
  // `kill()` ne garantit pas un arrêt immédiat : entre l'envoi du signal et
  // sa prise en compte réelle par le processus écrivain, une dernière
  // itération de sa boucle peut encore écrire le fichier — orphelin
  // constaté le 10/09/2026 (une exécution sur neuf) si le nettoyage
  // ci-dessous s'exécute avant que le processus ne soit réellement mort.
  // On ATTEND la sortie effective avant de nettoyer, plutôt que de nettoyer
  // en croyant le processus déjà arrêté.
  const finEcrivain = new Promise((resolve) => ecrivain.once('exit', resolve));
  let enonceObserve = false;
  let iterations = 0;
  const debut = Date.now();
  try {
    while (Date.now() - debut < dureeMs) {
      iterations++;
      try {
        listerPuisCopier(dirDest, racineBalayee);
      } catch (err) {
        if (err.code === 'ENOENT') { enonceObserve = true; break; }
        throw err;
      }
    }
  } finally {
    ecrivain.kill();
    await finEcrivain;
    try { fs.unlinkSync(cheminRacine); } catch (err) { /* déjà absent */ }
    fs.rmSync(dirDest, { recursive: true, force: true });
    fs.rmSync(racineBalayee, { recursive: true, force: true });
  }
  return { enonceObserve, iterations, racineBalayee };
}

async function preuveMutation() {
  // Le processus écrivain tourne en tâche de fond (spawn, non bloquant) : la
  // boucle de lecture ci-dessous s'exécute réellement EN MÊME TEMPS que ses
  // écritures/suppressions, au sens de l'ordonnanceur du système, pas au sens
  // d'un seul thread JS qui s'imagine concurrent.
  const DUREE_MS = 4000;
  const { enonceObserve, iterations, racineBalayee } = await mutationRepro(DUREE_MS);
  verifier(
    `(mutation) un second processus qui écrit/supprime un .js dans le répertoire balayé pendant que ce processus le traite « lister puis copier » reproduit l'ENOENT du défaut 10 (observé sur ${iterations} balayage(s), fenêtre ${DUREE_MS} ms)`,
    enonceObserve
  );
  // Le contrôle qui empêche cette épreuve de redevenir le défaut qu'elle
  // démontre : la course n'a pas eu lieu dans le dépôt. Sans lui, un retour à
  // la racine réelle repasserait inaperçu tant que l'ordonnancement le cache.
  verifier(
    `(non-nuisance) la course a été déclenchée HORS du dépôt (${racineBalayee})`,
    !path.resolve(racineBalayee).startsWith(path.resolve(RACINE) + path.sep)
  );
  verifier(
    'la fixture de reproduction n\'a jamais existé à la racine du dépôt',
    !fs.existsSync(path.join(RACINE, '__fixture_race_repro_20260910__.js'))
  );
}

// Contre-épreuve : la MÊME boucle de lister-puis-copier, sans qu'aucune
// écriture concurrente n'ait lieu dans le répertoire balayé, ne peut par
// construction jamais lever cet ENOENT — ce qui isole bien l'écriture
// concurrente comme cause, pas le simple fait de lister-puis-copier.
{
  const racineBalayee = bacASable();
  const dirDest = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-controle-'));
  let echec = null;
  try {
    for (let i = 0; i < 20; i++) listerPuisCopier(dirDest, racineBalayee);
  } catch (err) {
    echec = err;
  } finally {
    fs.rmSync(dirDest, { recursive: true, force: true });
    fs.rmSync(racineBalayee, { recursive: true, force: true });
  }
  verifier('(contre-épreuve) sans écriture concurrente, 20 balayages lister-puis-copier ne lèvent jamais ENOENT', echec === null);
}

// ── 2. Preuve comportementale réelle : exécutions parallèles complètes ──
//
// Lance N fois, en parallèle, les DEUX vrais fichiers de test ensemble —
// exactement la condition de course du défaut 10 — et exige zéro ENOENT,
// zéro fichier orphelin, arbre Git rendu exactement propre après coup.
function lancer(fichier) {
  return new Promise((resolve) => {
    execFile('node', [fichier], { cwd: RACINE, timeout: 60000 }, (err, stdout, stderr) => {
      resolve({ fichier, code: err ? (err.code || 1) : 0, stdout, stderr });
    });
  });
}

async function executionsParalleles() {
  const ROUNDS = 5;
  const resultats = [];
  for (let r = 0; r < ROUNDS; r++) {
    // Chaque round lance les deux fichiers en parallèle l'un de l'autre, ET
    // en parallèle d'un second exemplaire de chacun — pour maximiser la
    // fenêtre de chevauchement, plutôt que se fier à l'ordonnancement de
    // run-tests.js qui pourrait, par chance, ne jamais les faire coïncider.
    const lot = await Promise.all([
      lancer('test_guardians_router_20260907.js'),
      lancer('test_build_tracabilite_20260905.js'),
      lancer('test_guardians_router_20260907.js'),
      lancer('test_build_tracabilite_20260905.js'),
    ]);
    resultats.push(...lot);
  }
  return resultats;
}

(async () => {
  await preuveMutation();

  // Snapshot AVANT, pas une exigence de propreté : ce fichier peut tourner
  // dans une copie de travail qui porte déjà des changements sans rapport.
  // Ce qui compte est démontré APRÈS : le snapshot ne doit pas avoir bougé.
  const avant = execFileSync('git', ['status', '--short'], { cwd: RACINE, encoding: 'utf8' });

  const resultats = await executionsParalleles();

  const echecs = resultats.filter(r => r.code !== 0);
  verifier(`${resultats.length} exécutions parallèles complètes, toutes en succès (0 échec)`, echecs.length === 0);
  if (echecs.length) {
    for (const e of echecs) console.log(`  ÉCHEC — ${e.fichier} : code ${e.code}\n${e.stderr}`);
  }

  const avecEnoent = resultats.filter(r => /ENOENT/.test(r.stdout) || /ENOENT/.test(r.stderr));
  verifier('zéro ENOENT sur l\'ensemble des exécutions parallèles', avecEnoent.length === 0);

  const orphelins = fs.readdirSync(RACINE).filter(f => f.startsWith('__fixture_'));
  verifier(`zéro fichier fixture orphelin à la racine après coup (${orphelins.join(', ') || 'aucun'})`, orphelins.length === 0);

  const apres = execFileSync('git', ['status', '--short'], { cwd: RACINE, encoding: 'utf8' });
  verifier('arbre Git rendu exactement dans le même état après les exécutions parallèles (aucun artefact laissé)', apres === avant);

  console.log(`\n${ok} vérifications passées.`);
})();
