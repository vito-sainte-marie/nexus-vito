#!/usr/bin/env node
// Lanceur de la suite de non-régression NEXUS.
//   node run-tests.js              → toute la suite
//   node run-tests.js carburant    → seulement les tests dont le nom contient "carburant"
// Chaque fichier test_*.js est un script autonome : il réussit s'il sort en code 0.

const { execFileSync } = require('child_process');
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

if (require.main !== module) { module.exports = { verdictNonRegression }; return; }

const filtre = process.argv[2] || '';
const fichiers = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .filter(f => f.includes(filtre))
  .sort();

if (!fichiers.length) {
  console.error(`Aucun test ne correspond à « ${filtre} ».`);
  process.exit(1);
}

const echecs = [];
for (const f of fichiers) {
  try {
    // 30 s suffisaient tant qu'aucune épreuve ne lisait le vrai dépôt. Le
    // 08/09/2026, `test_producteur_evenements_live` est monté à 25 s : cinq
    // appels à `produire()` et deux lancements du CLI, chacun parcourant l'état
    // git de 22 branches et 250 commits. Une épreuve à 25 s d'une limite de 30
    // n'échoue pas : elle échoue UN JOUR, au hasard de la charge, et on la
    // croit instable plutôt que mal calibrée. La limite reste franche — elle
    // arrête toujours une épreuve qui boucle.
    execFileSync('node', [f], { cwd: __dirname, timeout: 90000, stdio: 'pipe' });
    process.stdout.write('.');
  } catch (e) {
    const sortie = `${e.stdout || ''}${e.stderr || ''}`;
    const cause = (sortie.match(/(?:[A-Za-z]*Error|Cannot find module)[^\n]{0,90}/) || ['sortie non nulle'])[0];
    echecs.push({ f, cause });
    process.stdout.write('x');
  }
}

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
