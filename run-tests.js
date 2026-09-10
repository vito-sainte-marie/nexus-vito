#!/usr/bin/env node
// Lanceur de la suite de non-régression NEXUS.
//   node run-tests.js              → toute la suite
//   node run-tests.js carburant    → seulement les tests dont le nom contient "carburant"
// Chaque fichier test_*.js est un script autonome : il réussit s'il sort en code 0.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Le verdict, en fonction PURE ─────────────────────────────────────
//
// Séparé de l'exécution pour une raison éprouvée le 08/09/2026 : mes premières
// épreuves de ce verdict LISAIENT le code source au lieu de l'exécuter. Trois
// mutations sur quatre survivaient — supprimer la détection d'une épreuve
// guérie laissait le message en place, donc l'épreuve verte. Une fonction pure
// se rejoue en microsecondes, sur les quatre cas, et ses mutations mordent.
//
// QUATRE SORTS, pas deux. Un échec hors liste est une régression. Une entrée
// dont le fichier passe doit être retirée, sinon la liste autorise en silence
// un retour en arrière. Une entrée dont le fichier n'existe plus ne protège
// plus rien et le croit encore. Et une référence illisible ne conclut RIEN.
function verdictNonRegression({ fichiers, echecs, connus }) {
  if (!Array.isArray(connus)) {
    return { code: 'REFERENCE_ILLISIBLE', fichiers: [] };
  }
  const actuels = (echecs || []).slice().sort();
  const tous = (fichiers || []).slice();
  const nouveaux = actuels.filter(f => !connus.includes(f));
  if (nouveaux.length) return { code: 'REGRESSION', fichiers: nouveaux };
  const inconnus = connus.filter(f => !tous.includes(f));
  if (inconnus.length) return { code: 'ENTREE_SANS_FICHIER', fichiers: inconnus };
  const repares = connus.filter(f => tous.includes(f) && !actuels.includes(f));
  if (repares.length) return { code: 'LISTE_TROP_LARGE', fichiers: repares };
  return { code: 'CONFORME', fichiers: [] };
}

// ── Les épreuves qui écrivent dans le dépôt ne peuvent pas se croiser ────
//
// LE DÉFAUT, démontré le 10/09/2026 (blocages-ouverts-1.md §9). Six épreuves
// sauvegardent `docs/handoff/PREPROD-CYCLE.json`, le remplacent, lancent un
// script qui y inscrit un cycle PREPROD, puis le restaurent. Lancées en
// parallèle, la seconde sauvegarde l'état DÉJÀ modifié par la première : la
// dernière restauration gagne, et ce n'est pas l'originale. Un cycle bidon
// (`zzzzrefdetestinexistante`) survivait alors dans un fichier suivi par git,
// et faisait échouer l'étape de semis PLUS TARD DANS LE MÊME JOB CI.
//
// LA RÉPARATION EST UNE VOIE DÉDIÉE, pas un verrou et pas une variable
// d'environnement : ces épreuves sont drainées une par une par un seul
// exécutant, le reste de la suite garde son parallélisme. Aucune garde n'est
// modifiée, aucun chemin n'est redirigeable — le registre canonique reste le
// seul, à sa place.
//
// LA LISTE N'EST PAS ÉCRITE À LA MAIN. Une liste se périme dès qu'une épreuve
// future touche le registre sans y être inscrite. Elle est DÉDUITE du contenu
// des fichiers : toute épreuve qui nomme le registre est exclusive.
const REGISTRE_PARTAGE = 'PREPROD-CYCLE';

/** Vrai si le SOURCE d'une épreuve nomme le registre partagé. */
function toucheAuRegistre(source) {
  return typeof source === 'string' && source.includes(REGISTRE_PARTAGE);
}

/**
 * Répartit les épreuves en deux files : celles qui touchent au registre
 * (drainées par UN seul exécutant, donc jamais simultanées) et les autres
 * (partagées entre les exécutants restants).
 *
 * Fonction pure, pour que l'invariant soit éprouvable sans lancer la suite :
 * toute épreuve exclusive est dans `exclusives`, et `exclusives` n'est drainée
 * que par une voie.
 */
function planifier({ fichiers, largeur, exclusifs }) {
  const tous = (fichiers || []).slice();
  const ex = new Set(exclusifs || []);
  if (!(largeur > 1)) return { exclusives: [], paralleles: tous, voies: 1 };
  const exclusives = tous.filter((f) => ex.has(f));
  const paralleles = tous.filter((f) => !ex.has(f));
  // Pas d'épreuve exclusive : rien à sérialiser, toute la largeur au reste.
  if (!exclusives.length) return { exclusives: [], paralleles, voies: largeur };
  return { exclusives, paralleles, voies: largeur };
}

if (require.main !== module) {
  module.exports = { verdictNonRegression, toucheAuRegistre, planifier, REGISTRE_PARTAGE };
  return;
}

// Un drapeau n'est pas un filtre. `--sequentiel` était pris pour le motif de
// sélection : la suite ne lançait AUCUNE épreuve et s'annonçait terminée. Une
// commande qui ne fait rien mais sort proprement est plus dangereuse qu'une
// commande qui échoue.
const filtre = process.argv.slice(2).find(a => !a.startsWith('--')) || '';
const fichiers = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .filter(f => f.includes(filtre))
  .sort();

if (!fichiers.length) {
  console.error(`Aucun test ne correspond à « ${filtre} ».`);
  process.exit(1);
}

// ── Exécution ────────────────────────────────────────────────────────
//
// EN PARALLÈLE par défaut. Les épreuves sont des processus indépendants ; les
// lancer une par une laissait la moitié des cœurs inoccupés (74 % de CPU sur
// 59 s le 08/09/2026). `--sequentiel` reste disponible, et sert à PROUVER que
// les deux modes rendent le même verdict : si une épreuve dépendait d'une
// autre, la comparaison le dirait au lieu de le laisser deviner.
//
// L'ordre d'AFFICHAGE reste celui des fichiers, jamais celui d'arrivée : un
// rapport dont les lignes changent de place à chaque exécution ne se compare
// plus d'un run à l'autre.
const sequentiel = process.argv.includes('--sequentiel');
const PARALLELE = Math.max(1, Math.min(8, require('os').cpus().length));

function lancer(f) {
  return new Promise((resolve) => {
    execFile('node', [f], { cwd: __dirname, timeout: 90000 }, (err, stdout, stderr) => {
      if (!err) return resolve({ f, ok: true });
      const sortie = `${stdout || ''}${stderr || ''}`;
      // « sortie non nulle » ne dit rien à personne. Le 09/09/2026, deux
      // épreuves ont cassé sur le runner Linux en passant sur macOS, et le log
      // CI n'offrait que ces trois mots : diagnostiquer depuis GitHub était
      // impossible, il a fallu deviner. Une exception porte « Error » et se
      // laisse attraper ; les épreuves qui rapportent elles-mêmes leurs échecs
      // — la moitié de cette suite — n'écrivent jamais ce mot. On lit donc
      // aussi leur ligne de refus, et à défaut la dernière ligne écrite.
      const cause =
        (sortie.match(/(?:[A-Za-z]*Error|Cannot find module)[^\n]{0,90}/) || [])[0] ||
        (sortie.match(/^\s*✗[^\n]{0,110}/m) || [])[0]?.trim() ||
        sortie.split('\n').filter(l => l.trim()).pop()?.slice(0, 110) ||
        'aucune sortie';
      resolve({ f, ok: false, cause });
    });
  });
}

async function executer() {
  const resultats = new Map();
  const largeur = sequentiel ? 1 : PARALLELE;
  const exclusifs = fichiers.filter((f) => {
    try { return toucheAuRegistre(fs.readFileSync(path.join(__dirname, f), 'utf8')); }
    catch (e) { return true; }   // illisible : on sérialise plutôt que de risquer la course
  });
  const plan = planifier({ fichiers, largeur, exclusifs });
  // Le mode est DÉCLARÉ, pas deviné. Sans cette ligne, rien ne distinguait un
  // `--sequentiel` réellement séquentiel d'un `--sequentiel` ignoré : la
  // comparaison entre les deux modes comparait alors deux fois le même, et la
  // mutation qui supprimait le mode séquentiel survivait.
  const detail = plan.exclusives.length
    ? `, dont ${plan.exclusives.length} sérialisée(s) sur le registre partagé`
    : '';
  console.log(`${fichiers.length} épreuve(s), ${largeur === 1 ? 'en séquentiel' : largeur + ' en parallèle'}${detail}.`);

  const drainer = async (file) => {
    for (;;) {
      const f = file.shift();
      if (!f) return;
      const r = await lancer(f);
      resultats.set(f, r);
      process.stdout.write(r.ok ? '.' : 'x');
    }
  };

  if (!plan.exclusives.length) {
    const file = plan.paralleles.slice();
    await Promise.all(Array.from({ length: Math.max(1, largeur) }, () => drainer(file)));
  } else {
    // UNE voie pour les exclusives — c'est ce qui garantit qu'aucune paire
    // d'entre elles ne se chevauche. Les autres voies se partagent le reste,
    // et gardent le vol de travail : le parallélisme n'est pas sacrifié.
    const fileExclusive = plan.exclusives.slice();
    const fileParallele = plan.paralleles.slice();
    await Promise.all([
      drainer(fileExclusive),
      ...Array.from({ length: Math.max(1, largeur - 1) }, () => drainer(fileParallele)),
    ]);
  }
  // Rendu dans l'ordre des FICHIERS, pas dans celui des retours.
  return fichiers.filter(f => !resultats.get(f).ok)
    .map(f => ({ f, cause: resultats.get(f).cause }));
}

executer().then((echecs) => {

const total = fichiers.length;
console.log(`\n\n${total - echecs.length}/${total} tests passent.`);
if (echecs.length) {
  console.log(`\n${echecs.length} en échec :`);
  for (const { f, cause } of echecs) console.log(`  ${f}\n    ${cause}`);
}

// ── Le verdict, rendu ICI ────────────────────────────────────────────
//
// « Le contrôle qui compte n'est pas le compte, c'est la liste » (QA-006).
// Cette comparaison existait, mais en DEUX exemplaires : figée dans
// `.github/workflows/tests.yml`, et refaite à la main hors du dépôt à chaque
// session. Deux copies d'une même vérité, dont une invisible en local — c'est
// toujours celle qu'on oublie qui se met à mentir. Et il fallait relancer la
// suite entière une seconde fois pour obtenir la liste après en avoir lu le
// compte : une minute de calcul par vérification, pour rien.
const REFERENCE = path.join(__dirname, 'docs', 'qa', 'ECHECS-CONNUS.json');

if (filtre) {
  // Une exécution FILTRÉE ne peut rien conclure : tous les échecs connus hors
  // du filtre paraîtraient guéris. On le dit plutôt que de rendre un verdict
  // dont on sait qu'il est faux.
  console.log(`\nExécution filtrée sur « ${filtre} » : aucun verdict de non-régression.`);
  process.exit(echecs.length ? 1 : 0);
}

let connus = null;
try {
  connus = JSON.parse(fs.readFileSync(REFERENCE, 'utf8')).echecs.map(e => e.fichier).sort();
} catch (e) {
  console.error(`\nÉchecs connus ILLISIBLES (${REFERENCE}) : ${e.message}`);
}

const v = verdictNonRegression({ fichiers, echecs: echecs.map(e => e.f), connus });
switch (v.code) {
  case 'REFERENCE_ILLISIBLE':
    // Fail-closed : sans référence, on ne sait pas si ces échecs sont connus.
    // Conclure « aucune régression » serait la seule chose pire que l'échec.
    console.error('Aucun verdict de non-régression possible.');
    process.exit(1);
  case 'REGRESSION':
    console.error(`\nRÉGRESSION — ${v.fichiers.length} test(s) en échec hors de la liste connue :`);
    for (const f of v.fichiers) console.error(`  ${f}`);
    process.exit(1);
  case 'ENTREE_SANS_FICHIER':
    console.error(`\n${v.fichiers.length} entrée(s) de la liste ne correspondent à AUCUN fichier de la suite :`);
    for (const f of v.fichiers) console.error(`  ${f}`);
    console.error('\nSupprimée, renommée, ou mal orthographiée — dans les trois cas la liste ne');
    console.error('protège plus rien pour cette entrée, et le croit encore.');
    process.exit(1);
  case 'LISTE_TROP_LARGE':
    console.error(`\n${v.fichiers.length} test(s) de la liste connue passent désormais :`);
    for (const f of v.fichiers) console.error(`  ${f}`);
    console.error(`\nRetirez-les de ${path.relative(__dirname, REFERENCE)}.`);
    console.error('Une liste laissée trop large autorise en silence un retour en arrière.');
    process.exit(1);
  default:
    console.log(`\nAucune régression : seuls les ${connus.length} échecs connus subsistent.`);
    process.exit(0);
}
});
