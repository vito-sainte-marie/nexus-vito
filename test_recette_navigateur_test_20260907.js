// Épreuve de la recette navigateur (outils/recette-navigateur-test.js).
//
// Ce qui est éprouvé ici, c'est le JUGEMENT — la fonction qui décide si ce
// qu'on a vu à l'écran prouve quelque chose. Le pilotage du navigateur, lui,
// n'a de valeur que branché sur NEXUS Test ; l'éprouver contre un faux
// navigateur ne prouverait que le faux navigateur.
//
// Le cas central : un total de 36 000 L SANS récupération de reliquat doit
// être un ÉCHEC. C'est le piège du 07/09 — deux carburants en sécurité
// s'arrondissent vers le haut et atteignent 36 000 L sans jamais exercer le
// correctif CARB-004. Une recette qui se contenterait du total afficherait
// vert sur un moteur non corrigé.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const OUTIL = path.join(__dirname, 'outils', 'recette-navigateur-test.js');
const { verifier, secretsManquants, extraireCommitServi, SECRETS_REQUIS } = require(OUTIL);

let passes = 0;
function epreuve(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Observation conforme : exactement ce que l'écran a rendu le 07/09/2026.
function vuConforme(muter) {
  const vu = {
    ok: true, site: 'nexus-station-test', total: 36000,
    volumes: { sp95: 23000, go: 13000 },
    reliquatArrondi: {
      recupereL: 1000,
      parCarburant: { go: 1000 },
      motifs: { sp95: 'Capacité disponible à la livraison insuffisante pour un compartiment de plus.' },
    },
    optimiseurBrut: { volumesRetenus: { sp95: 23606, go: 12394 }, total: 36000 },
  };
  if (muter) muter(vu);
  return vu;
}

epreuve('l’observation réelle du 07/09 est acceptée', () => {
  assert.deepStrictEqual(verifier(vuConforme()), [],
    'sans cette épreuve, toutes les suivantes passeraient avec un juge qui refuse tout');
});

epreuve('un total de 35 000 L est refusé, et le chiffre est nommé', () => {
  const e = verifier(vuConforme(v => { v.total = 35000; }));
  assert.ok(e.length, 'doit échouer');
  assert.ok(/35000/.test(e.join(' ')) && /36000/.test(e.join(' ')), e.join(' | '));
});

epreuve('36 000 L SANS récupération de reliquat est refusé', () => {
  // Le cœur de la recette. Le total seul ne prouve rien : il peut venir d'un
  // arrondi vers le haut sur deux carburants en sécurité, sans que la phase
  // corrigée par CARB-004 ait jamais été exercée.
  const e = verifier(vuConforme(v => {
    v.reliquatArrondi.recupereL = 0;
    v.reliquatArrondi.parCarburant = {};
  }));
  assert.ok(e.length, 'un total juste pour de mauvaises raisons doit échouer');
  assert.ok(/ne prouverait pas CARB-004/.test(e.join(' ')),
    'et le message doit dire pourquoi : ' + e.join(' | '));
});

epreuve('un reliquat absent de la réponse est refusé — traversée P0 rompue', () => {
  const e = verifier(vuConforme(v => { delete v.reliquatArrondi; }));
  assert.ok(e.length);
  assert.ok(/traversée de la couche P0 est rompue/.test(e.join(' ')), e.join(' | '));
});

epreuve('un reliquat crédité au mauvais carburant est refusé', () => {
  const e = verifier(vuConforme(v => { v.reliquatArrondi.parCarburant = { sp95: 1000 }; }));
  assert.ok(e.length, 'le compartiment doit aller au go, pas au sp95 déjà à sa capacité');
  assert.ok(/crédité à go/.test(e.join(' ')), e.join(' | '));
});

epreuve('un refus silencieux sur sp95 est refusé', () => {
  const e = verifier(vuConforme(v => { v.reliquatArrondi.motifs = {}; }));
  assert.ok(e.length);
  assert.ok(/motif de refus explicite, pas un silence/.test(e.join(' ')), e.join(' | '));
});

epreuve('un motif de refus générique est refusé', () => {
  // « Non » sans raison est la moitié d'une réponse : le manager doit savoir
  // que c'est la capacité qui bloque, pas la rotation.
  const e = verifier(vuConforme(v => { v.reliquatArrondi.motifs.sp95 = 'Impossible.'; }));
  assert.ok(e.length);
  assert.ok(/doit nommer la capacité/.test(e.join(' ')), e.join(' | '));
});

epreuve('une absence de recommandation renvoie vers le jeu de données, pas vers le moteur', () => {
  // Le 07/09, la première recette a échoué parce que la base Test était vide.
  // Le message doit envoyer là, sinon la prochaine session cherchera le bug
  // dans le moteur pendant une heure.
  const e = verifier({ ok: false, total: null });
  assert.strictEqual(e.length, 1, 'un seul diagnostic, pas une avalanche : ' + e.join(' | '));
  assert.ok(/recette-carburants-test\.sql/.test(e[0]), e[0]);
});

epreuve('les secrets manquants sont nommés un par un', () => {
  assert.deepStrictEqual(secretsManquants({}), SECRETS_REQUIS);
  assert.deepStrictEqual(
    secretsManquants({ NEXUS_TEST_URL: 'https://x', NEXUS_TEST_MANAGER_USERNAME: 'm', NEXUS_TEST_PIN: '  ' }),
    ['NEXUS_TEST_PIN'], 'un secret vide ou blanc est un secret manquant');
});

epreuve('l’identité de la version servie est lue dans nexus-build.js', () => {
  // Le 05/09, dix minutes ont été perdues à interroger nexus-generation.json,
  // une URL qui n'a jamais existé. Le vrai point de preuve est nexus-build.js.
  const servi = `  var IDENTITE = {\n    commit: '39d6b4d64e58fabef8134a62ada9b7a1872fe34e',\n` +
    `    commitCourt: '39d6b4d',\n    environnement: 'test',\n  };`;
  assert.strictEqual(extraireCommitServi(servi), '39d6b4d64e58fabef8134a62ada9b7a1872fe34e');
  assert.strictEqual(extraireCommitServi('rien de tel ici'), null,
    'une page qui ne dit pas sa version doit rendre null, jamais une valeur plausible');
  assert.strictEqual(extraireCommitServi(''), null);
});

epreuve('le PIN n’apparaît dans aucune sortie ni aucun message d’erreur', () => {
  // Contrat de source, comme celui qui interdit à la couche P0 de connaître le
  // mot « reliquat ». Une trace ajoutée un jour de débogage est exactement la
  // façon dont un secret finit dans un journal public.
  // Premier jet de cette épreuve : chercher « pin » sur les lignes contenant
  // console.* ou throw. Elle a laissé passer la mutation, parce que le `throw`
  // du fichier s'étend sur deux lignes et que la concaténation fautive était
  // sur la seconde. Une détection ligne à ligne ne voit pas une instruction.
  //
  // Contrat retenu, plus simple et plus fort : la VALEUR du PIN ne circule que
  // vers le champ du formulaire. L'identifiant `pin` (minuscule) ne doit donc
  // apparaître qu'à deux endroits — la signature qui le reçoit, et le `.fill()`
  // qui le saisit. Partout ailleurs, il s'échappe.
  const source = fs.readFileSync(OUTIL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const autorisees = [/^\s*async function connecter\(page, base, identifiant, pin\) \{$/, /\.fill\(pin\)/];
  const fautives = source.split('\n')
    .filter(l => /\bpin\b/.test(l))
    .filter(l => !autorisees.some(m => m.test(l)));
  assert.deepStrictEqual(fautives, [],
    'la valeur du PIN ne doit aller que dans le champ du formulaire ; lignes fautives :\n' + fautives.join('\n'));
});

console.log(`\n${passes}/${passes} vérifications passées — la recette juge la preuve, pas seulement le chiffre.`);
