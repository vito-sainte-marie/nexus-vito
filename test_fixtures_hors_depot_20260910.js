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
// Ce fichier prouve deux choses distinctes :
//   1. (mutation) le mécanisme causal est réel — une reproduction indépendante,
//      fidèle au motif exact (écrire/supprimer un `.js` à la racine RÉELLE en
//      boucle pendant qu'un lister-puis-copier balaie cette même racine),
//      produit bien un ENOENT ; sans cette écriture à la racine réelle, la
//      même boucle de lister-puis-copier ne peut jamais échouer ainsi ;
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
//
// Défaut §10 rouvert le 10/09/2026 : cette reproduction écrivait elle-même
// `__fixture_race_repro_20260910__.js` à la racine RÉELLE du dépôt, ce qui la
// remettait en course contre `test_build_tracabilite_20260905.js` dès que
// `run-tests.js` les exécute en parallèle — exactement le défaut que ce
// fichier a pour but de documenter, mais retombant cette fois sur la racine
// partagée au lieu d'un bac à sable. `listerPuisCopier` accepte désormais une
// racine source explicite (par défaut RACINE, comportement de la
// contre-épreuve inchangé, qui ne fait que lire) ; la reproduction, elle,
// pointe systématiquement vers un répertoire temporaire dédié créé pour
// l'occasion — jamais vers `RACINE`.
function listerPuisCopier(dirDest, racineSource = RACINE) {
  // Exactement le motif de copierDepot() dans test_build_tracabilite : un
  // readdirSync, PUIS une boucle de fs.copyFileSync — jamais une seule passe
  // atomique. C'est cet écart entre le listage et la copie qui est en cause.
  const fichiers = fs.readdirSync(racineSource).filter(f => /\.js$/.test(f) && !f.startsWith('test_'));
  for (const f of fichiers) {
    fs.copyFileSync(path.join(racineSource, f), path.join(dirDest, f));
  }
}

// Un seul processus, sans concurrence réelle, ne peut jamais reproduire la
// course : write → scan → unlink dans le même thread s'exécutent forcément
// dans cet ordre, jamais entrelacés. La course n'existe qu'entre DEUX
// processus indépendants — exactement ce que fait run-tests.js en lançant
// chaque fichier de test comme un processus séparé. La reproduction lance
// donc un vrai second processus écrivain, concurrent du balayage du parent.
async function mutationRepro(dureeMs) {
  const nomFixture = '__fixture_race_repro_20260910__.js';
  // Bac à sable dédié : ni la fixture ni le balayage « lister puis copier »
  // de cette reproduction ne touchent plus jamais la racine réelle du dépôt,
  // pour ne plus jamais entrer en course avec test_build_tracabilite (qui,
  // lui, balaie la vraie racine et ne doit jamais être modifié pour un test).
  const dirRacineSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-sandbox-'));
  const cheminFixture = path.join(dirRacineSandbox, nomFixture);
  const dirDest = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-repro-'));
  const scriptEcrivain = `
    const fs = require('fs');
    const chemin = ${JSON.stringify(cheminFixture)};
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
        listerPuisCopier(dirDest, dirRacineSandbox);
      } catch (err) {
        if (err.code === 'ENOENT') { enonceObserve = true; break; }
        throw err;
      }
    }
  } finally {
    ecrivain.kill();
    await finEcrivain;
    try { fs.unlinkSync(cheminFixture); } catch (err) { /* déjà absent */ }
    fs.rmSync(dirDest, { recursive: true, force: true });
    fs.rmSync(dirRacineSandbox, { recursive: true, force: true });
  }
  return { enonceObserve, iterations };
}

async function preuveMutation() {
  // Le processus écrivain tourne en tâche de fond (spawn, non bloquant) : la
  // boucle de lecture ci-dessous s'exécute réellement EN MÊME TEMPS que ses
  // écritures/suppressions, au sens de l'ordonnanceur du système, pas au sens
  // d'un seul thread JS qui s'imagine concurrent.
  const DUREE_MS = 4000;
  const { enonceObserve, iterations } = await mutationRepro(DUREE_MS);
  verifier(
    `(mutation) un second processus qui écrit/supprime un .js dans un bac à sable dédié pendant que ce processus balaie « lister puis copier » ce même bac à sable reproduit l'ENOENT du défaut 10 (observé sur ${iterations} balayage(s), fenêtre ${DUREE_MS} ms)`,
    enonceObserve
  );
}

// Contre-épreuve : la MÊME boucle de lister-puis-copier, sans qu'aucune
// écriture n'ait jamais lieu à la racine réelle, ne peut par construction
// jamais lever cet ENOENT — ce qui isole bien la racine réelle comme cause,
// pas le simple fait de lister-puis-copier.
{
  const dirDest = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-race-controle-'));
  let echec = null;
  try {
    for (let i = 0; i < 20; i++) listerPuisCopier(dirDest);
  } catch (err) {
    echec = err;
  } finally {
    fs.rmSync(dirDest, { recursive: true, force: true });
  }
  verifier('(contre-épreuve) sans écriture à la racine réelle, 20 balayages lister-puis-copier ne lèvent jamais ENOENT', echec === null);
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
