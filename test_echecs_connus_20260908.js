// La liste des échecs tolérés a-t-elle un seul propriétaire, et sait-elle dire non ?
//
// Elle vivait en DEUX exemplaires : figée dans `.github/workflows/tests.yml`, et
// reconstruite à la main dans un fichier temporaire à chaque session locale.
// Deux copies d'une même vérité, dont une invisible depuis le poste de travail.
// Et pour obtenir la liste après en avoir lu le compte, il fallait relancer la
// suite entière une seconde fois : une minute de calcul par vérification.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REFERENCE = path.join(__dirname, 'docs', 'qa', 'ECHECS-CONNUS.json');
const LANCEUR = path.join(__dirname, 'run-tests.js');
const WORKFLOW = path.join(__dirname, '.github', 'workflows', 'tests.yml');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('la référence existe et chaque entrée porte sa cause observée', () => {
  const d = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
  assert.ok(Array.isArray(d.echecs) && d.echecs.length, 'la liste doit exister');
  for (const e of d.echecs) {
    assert.ok(e.fichier && /^test_.*\.js$/.test(e.fichier), 'entrée sans fichier : ' + JSON.stringify(e));
    assert.ok(e.cause_observee, `cause observée absente pour ${e.fichier}`);
    assert.ok(e.motif, `motif absent pour ${e.fichier} — « non documenté » est une réponse, le vide n’en est pas une`);
  }
});

t('chaque fichier de la liste EXISTE réellement dans la suite', () => {
  // Une entrée qui ne correspond à aucun fichier ne protège plus rien, et le
  // croit encore. Supprimée, renommée ou mal orthographiée : même effet.
  const d = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
  for (const e of d.echecs) {
    assert.ok(fs.existsSync(path.join(__dirname, e.fichier)),
      `la liste cite un fichier absent de la suite : ${e.fichier}`);
  }
});

t('le lanceur est le SEUL lecteur de cette liste', () => {
  // La copie figée dans le workflow est ce qui a permis aux deux versions de
  // diverger sans que personne ne le voie.
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  const d = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
  for (const e of d.echecs) {
    assert.ok(!yml.includes(e.fichier),
      `le workflow reporte en dur un échec connu (${e.fichier}) : deuxième propriétaire`);
  }
  assert.ok(fs.readFileSync(LANCEUR, 'utf8').includes("'ECHECS-CONNUS.json'"),
    'le lanceur doit lire la référence');
});

t('la suite n’est lancée QU’UNE FOIS par la CI', () => {
  // Le compte et la liste sortent de la même exécution. Deux invocations
  // coûtaient une minute de calcul pour rien, à chaque vérification.
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  const invocations = (yml.match(/node run-tests\.js/g) || []).length;
  assert.strictEqual(invocations, 1, `run-tests.js est invoqué ${invocations} fois dans la CI`);
});

// ── Le comportement, pas la prose ────────────────────────────────────
// Mes premières épreuves de ce verdict LISAIENT le code source. Trois mutations
// sur quatre survivaient : supprimer la détection d'une épreuve guérie laissait
// le message en place, donc l'épreuve verte. Le verdict est maintenant une
// fonction pure, et c'est elle qu'on interroge.
const { verdictNonRegression: verdict } = require(LANCEUR);

t('rien d’anormal : CONFORME', () => {
  assert.strictEqual(verdict({ fichiers: ['a.js', 'b.js'], echecs: ['a.js'], connus: ['a.js'] }).code, 'CONFORME');
});

t('un échec hors de la liste est une RÉGRESSION, et il est nommé', () => {
  const v = verdict({ fichiers: ['a.js', 'b.js'], echecs: ['a.js', 'b.js'], connus: ['a.js'] });
  assert.strictEqual(v.code, 'REGRESSION');
  assert.deepStrictEqual(v.fichiers, ['b.js']);
});

t('une épreuve guérie oblige à RÉDUIRE la liste', () => {
  // Sans quoi la liste autorise en silence un retour en arrière : le test
  // pourrait recasser demain sans que rien ne le signale.
  const v = verdict({ fichiers: ['a.js', 'b.js'], echecs: [], connus: ['a.js'] });
  assert.strictEqual(v.code, 'LISTE_TROP_LARGE');
  assert.deepStrictEqual(v.fichiers, ['a.js']);
});

t('une entrée sans fichier n’est PAS une guérison', () => {
  // Supprimée ou renommée : la liste ne protège plus rien pour cette entrée,
  // et le croit encore. Annoncer « passe désormais » serait un progrès inventé.
  const v = verdict({ fichiers: ['a.js'], echecs: [], connus: ['disparu.js'] });
  assert.strictEqual(v.code, 'ENTREE_SANS_FICHIER');
  assert.deepStrictEqual(v.fichiers, ['disparu.js']);
});

t('la RÉGRESSION prime sur tout le reste', () => {
  // Un nouvel échec ne doit pas être noyé par une entrée périmée de la liste.
  const v = verdict({ fichiers: ['a.js', 'b.js'], echecs: ['b.js'], connus: ['a.js', 'disparu.js'] });
  assert.strictEqual(v.code, 'REGRESSION');
  assert.deepStrictEqual(v.fichiers, ['b.js']);
});

t('sans référence, AUCUN verdict — jamais « conforme »', () => {
  assert.strictEqual(verdict({ fichiers: ['a.js'], echecs: [], connus: null }).code, 'REFERENCE_ILLISIBLE');
  assert.strictEqual(verdict({ fichiers: ['a.js'], echecs: ['a.js'], connus: undefined }).code, 'REFERENCE_ILLISIBLE');
});

t('une liste VIDE reste un verdict, pas une absence', () => {
  // Zéro échec toléré est une information ; ne pas savoir n'en est pas une.
  assert.strictEqual(verdict({ fichiers: ['a.js'], echecs: [], connus: [] }).code, 'CONFORME');
  assert.strictEqual(verdict({ fichiers: ['a.js'], echecs: ['a.js'], connus: [] }).code, 'REGRESSION');
});

t('le lanceur REFUSE de conclure sans référence lisible', () => {
  const src = fs.readFileSync(LANCEUR, 'utf8');
  assert.ok(/Aucun verdict de non-régression possible/.test(src), 'message attendu');
});

t('une exécution FILTRÉE ne rend aucun verdict', () => {
  // Sinon tous les échecs connus hors du filtre paraîtraient guéris.
  const src = fs.readFileSync(LANCEUR, 'utf8');
  assert.ok(/aucun verdict de non-régression/i.test(src));
  // La position à comparer est celle de la LECTURE, pas celle de la constante :
  // `REFERENCE` est déclarée en tête, bien avant le court-circuit.
  assert.ok(src.indexOf('if (filtre)') < src.indexOf('readFileSync(REFERENCE'),
    'le filtre doit court-circuiter AVANT la lecture de la référence');
});

console.log(`\n${n}/${n} vérifications passées — une liste d’échecs tolérés, un seul propriétaire.`);
