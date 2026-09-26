// La surface du jeton de CI reste-t-elle celle qui a été autorisée ?
//
// Le 08/09/2026, Frédéric a autorisé `actions: read` sur le workflow. Une
// permission accordée une fois a tendance à s'élargir ensuite : on ajoute un
// `write` pour débloquer une étape, on hisse un jeton au niveau du job « pour
// simplifier », et personne ne relit un fichier YAML pour vérifier une ligne
// qui n'a pas bougé depuis des semaines.
//
// Ces épreuves ne jugent pas si la permission est bonne — c'est une décision
// humaine, elle est prise. Elles vérifient qu'elle est restée CELLE-LÀ.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const WORKFLOW = path.join(__dirname, '.github', 'workflows', 'tests.yml');
const yml = fs.readFileSync(WORKFLOW, 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

// Vocabulaire FERMÉ : ce que le jeton a le droit d'être. Une permission
// nouvelle est un geste humain, pas un ajustement d'outillage.
const PERMISSIONS_AUTORISEES = { contents: 'read', actions: 'read' };

function permissionsDeclarees() {
  const i = yml.indexOf('\npermissions:');
  assert.ok(i > 0, 'le workflow doit déclarer ses permissions explicitement');
  const bloc = yml.slice(i + 1, yml.indexOf('\non:', i));
  const trouve = {};
  for (const l of bloc.split('\n').slice(1)) {
    const m = /^\s{2}([a-z-]+):\s*([a-z-]+)\s*$/.exec(l);
    if (m) trouve[m[1]] = m[2];
  }
  return trouve;
}

t('le workflow ne s’accorde QUE les permissions autorisées', () => {
  assert.deepStrictEqual(permissionsDeclarees(), PERMISSIONS_AUTORISEES);
});

t('aucune permission en ÉCRITURE, nulle part dans le workflow', () => {
  // `contents: write` suffirait à pousser sur une branche protégée depuis la
  // CI. C'est la ligne qu'on ajoute un soir pour débloquer une étape.
  const ecritures = yml.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /^\s*[a-z-]+:\s*(write|admin)\s*$/.test(l));
  assert.deepStrictEqual(ecritures, [],
    'permission en écriture trouvée : ' + JSON.stringify(ecritures));
});

t('l’autorisation humaine est INSCRITE à côté de la permission', () => {
  // Une permission sans trace de qui l'a accordée ne se distingue pas d'une
  // permission que quelqu'un s'est donnée.
  const avant = yml.slice(0, yml.indexOf('\npermissions:'));
  assert.ok(/actions: read.*AUTORISÉ PAR FRÉDÉRIC BRAGANCE/s.test(avant),
    'le commentaire doit nommer l’autorité humaine et la date');
  assert.ok(/Aucune écriture, aucun accès à un secret/.test(avant),
    'et dire exactement ce que la permission ouvre');
});

t('le jeton n’est donné qu’à l’étape qui en a besoin', () => {
  // Le poser au niveau du job l'exposerait à toutes les étapes, dont celles qui
  // exécutent du code d'épreuve. Une permission sert ce qui en a besoin.
  const occurrences = [...yml.matchAll(/GH_TOKEN:/g)];
  assert.strictEqual(occurrences.length, 1,
    `GH_TOKEN apparaît ${occurrences.length} fois : il doit rester dans une seule étape`);

  const i = yml.indexOf('GH_TOKEN:');
  const etape = yml.lastIndexOf('- name:', i);
  const nom = yml.slice(etape, yml.indexOf('\n', etape));
  assert.ok(/Publier le journal NEXUS Live/.test(nom),
    'seule la publication du journal exécute le producteur, vu : ' + nom);
});

t('le producteur ne demande à GitHub que des métadonnées', () => {
  // Le droit de lire ne dispense pas de ne lire que le nécessaire. Aucun log,
  // aucun contenu de run : quatre champs, et le contrat le dit.
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'producteur-evenements-live.js'), 'utf8');

  // Le producteur fait DEUX appels à `gh`. Ma première épreuve attrapait le
  // premier venu et jugeait donc l'autre : elle aurait laissé passer tout
  // élargissement de celui-ci. Chaque appel est vérifié à sa place.
  const champs = [...src.matchAll(/'--json', '([^']+)'/g)].map(m => m[1].split(','));
  assert.strictEqual(champs.length, 2, 'deux appels attendus, vu : ' + champs.length);

  // Runs de la CI elle-même (droit préexistant).
  assert.deepStrictEqual(champs[0], ['databaseId', 'status', 'conclusion', 'headSha']);
  // Runs de l'agent Claude : ce que `actions: read` a ouvert.
  assert.deepStrictEqual(champs[1], ['databaseId', 'status', 'event', 'headBranch']);

  assert.ok(!/run view|--log|download/.test(src),
    'aucune lecture de log ni d’artefact : ce n’est pas ce qui a été autorisé');
});

// ---------------------------------------------------------------------------
// Le transport du réveil Orchestrateur : présent, et sans coût de permission.
//
// Le sens Claude → Orchestrateur est resté muet longtemps : l'outil composait
// le message, et rien ne le portait. La voie retenue est le résumé de job —
// une ÉCRITURE DE FICHIER, qui ne demande AUCUNE permission au jeton. Poser
// `issues: write` aurait été plus commode : c'eût été élargir la surface de
// sécurité, donc un geste humain (CLAUDE.md), pas un ajustement d'outillage.
//
// Deux choses peuvent se perdre ici, et aucune ne se voit en relisant un YAML :
// l'étape DISPARAÎT dans un remaniement, et le sens redevient muet sans que
// rien ne rougisse ; ou elle SURVIT en passant par l'API, réclame un jeton, et
// le transport gratuit se retrouve échangé contre une permission que personne
// n'a décidé d'ouvrir. Ces trois épreuves tiennent les deux bouts.

function etapeDuReveil() {
  const i = yml.indexOf('      - name: Réveil Orchestrateur');
  assert.ok(i > 0,
    'l’étape de réveil a disparu du workflow : le sens Claude → Orchestrateur ' +
    'n’a plus rien qui transporte son message. L’outil continuerait de le ' +
    'composer sans que personne ne le voie — exactement l’état d’avant.');
  const suite = yml.slice(i + 1);
  const fin = suite.indexOf('\n      - name:');
  return suite.slice(0, fin === -1 ? undefined : fin);
}

t('le réveil Orchestrateur a une étape qui le TRANSPORTE', () => {
  const etape = etapeDuReveil();
  assert.ok(/\$GITHUB_STEP_SUMMARY/.test(etape),
    'le corps doit aboutir au résumé de job, sinon il n’aboutit nulle part');
  assert.ok(/node outils\/reveil-orchestrateur\.js --message/.test(etape),
    'et c’est le producteur du rail qui le compose, pas un texte recopié dans le YAML');
});

t('le réveil part AUSSI quand les épreuves échouent', () => {
  // C'est précisément quand quelque chose ne va pas que l'Orchestrateur doit
  // être réveillé. Sans `if: always()`, le seul cas où le message compte est
  // le seul où il ne serait pas écrit.
  const etape = etapeDuReveil();
  assert.ok(/if: always\(\)/.test(etape),
    'sans `if: always()`, un premier rouge emporte le réveil avec lui');
});

t('ce transport ne coûte AUCUNE permission', () => {
  const etape = etapeDuReveil();
  const dette = [];
  if (/GH_TOKEN|GITHUB_TOKEN/.test(etape)) dette.push('un jeton est donné à l’étape');
  if (/secrets\./.test(etape)) dette.push('un secret est lu par l’étape');
  if (/\bgh\s+\w/.test(etape)) dette.push('l’étape appelle `gh` : ce n’est plus une écriture de fichier');
  if (/api\.github\.com|curl|wget/.test(etape)) dette.push('l’étape appelle l’API GitHub directement');
  assert.deepStrictEqual(dette, [],
    'Le résumé de job a été choisi parce qu’il ne demande RIEN. Si cette étape ' +
    'se met à publier, elle réclamera une permission, et cette permission est ' +
    'un geste humain — elle ne s’obtient pas en modifiant ce fichier.\n  ' +
    dette.join('\n  '));

  // Et le producteur lui-même ne publie pas : il ne parle qu'à `git`.
  // « NEXUS prépare le message, le facteur le transmet » est une affirmation
  // du YAML ; ici elle devient une mesure.
  const src = fs.readFileSync(path.join(__dirname, 'outils', 'reveil-orchestrateur.js'), 'utf8');
  assert.ok(!/execFileSync\(\s*'gh'|require\('https?'\)|fetch\(/.test(src),
    'reveil-orchestrateur.js doit COMPOSER le réveil, jamais le publier');
});

console.log(`\n${n}/${n} vérifications passées — une permission accordée n’est pas une permission ouverte.`);
