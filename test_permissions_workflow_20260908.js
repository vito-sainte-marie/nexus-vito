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
const PERMISSIONS_AUTORISEES = { contents: 'read', actions: 'read', issues: 'write' };

// `issues: write` accordé par Frédéric Bragance le 26/09/2026. Le vocabulaire
// s'élargit d'une entrée, il ne s'ouvre pas : ce qui suit reste un ensemble
// FERMÉ, et les épreuves qui gardaient l'écriture n'ont pas été retirées —
// elles ont été rendues plus précises. Une permission d'écriture de plus se
// verra exactement comme avant.
const ECRITURES_AUTORISEES = Object.entries(PERMISSIONS_AUTORISEES)
  .filter(([, v]) => v === 'write' || v === 'admin');

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

t('aucune permission en ÉCRITURE hors de celles accordées', () => {
  // `contents: write` suffirait à pousser sur une branche protégée depuis la
  // CI. C'est la ligne qu'on ajoute un soir pour débloquer une étape. Une
  // écriture accordée n'autorise pas les suivantes : chacune se nomme.
  const trouvees = yml.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /^\s*[a-z-]+:\s*(write|admin)\s*$/.test(l))
    .map(([i, l]) => [i, ...l.trim().replace(':', '').split(/\s+/)]);
  const intruses = trouvees.filter(([, cle, val]) =>
    !ECRITURES_AUTORISEES.some(([c, v]) => c === cle && v === val));
  assert.deepStrictEqual(intruses, [],
    'permission en écriture NON accordée : ' + JSON.stringify(intruses));
  // Et le sens inverse : une écriture accordée qui disparaît du fichier est
  // une panne silencieuse du transport, pas un durcissement.
  assert.strictEqual(trouvees.length, ECRITURES_AUTORISEES.length,
    'le fichier ne porte plus les écritures accordées : ' + JSON.stringify(trouvees));
});

t('l’autorisation humaine est INSCRITE à côté de la permission', () => {
  // Une permission sans trace de qui l'a accordée ne se distingue pas d'une
  // permission que quelqu'un s'est donnée.
  const avant = yml.slice(0, yml.indexOf('\npermissions:'));
  for (const cle of Object.keys(PERMISSIONS_AUTORISEES)) {
    if (cle === 'contents') continue; // `contents: read` est le défaut de tout workflow.
    const val = PERMISSIONS_AUTORISEES[cle];
    assert.ok(new RegExp('`?' + cle + ': ' + val + '`?[^]*?AUTORISÉ PAR FRÉDÉRIC BRAGANCE LE \\d\\d/\\d\\d/\\d{4}').test(avant),
      `\`${cle}: ${val}\` doit être accompagné du nom de l’autorité humaine et de sa date`);
  }
  assert.ok(/Aucune écriture, aucun accès à un secret/.test(avant),
    'et dire exactement ce que `actions: read` ouvre');
  assert.ok(/ÉCRIRE un commentaire sur une issue[^]*?Aucune écriture dans le dépôt/.test(avant),
    'et exactement ce que `issues: write` ouvre — et ce qu’elle N’ouvre PAS');
});

// Vocabulaire FERMÉ, comme les permissions : les étapes — et elles seules —
// qui reçoivent le jeton. Le 26/09/2026 il y en a deux, là où il y en avait
// une. C'est le seul changement : l'épreuve mesurait « une seule occurrence »,
// ce qui confondait DEUX propriétés distinctes — que le jeton ne soit pas au
// niveau du job, et qu'il n'aille qu'à des étapes désignées. Seule la seconde
// était l'intention ; la première se mesure maintenant pour elle-même, et une
// troisième étape qui se servirait rougira comme la deuxième l'aurait fait.
const ETAPES_AVEC_JETON = [
  'Publier le journal NEXUS Live',
  'Réveil Orchestrateur — publication au destinataire déclaré',
];

t('le jeton n’est donné qu’aux étapes désignées, jamais au job', () => {
  // Le poser au niveau du job l'exposerait à toutes les étapes, dont celles qui
  // exécutent du code d'épreuve. Une permission sert ce qui en a besoin.
  const lignes = yml.split('\n');
  const porteuses = [];
  lignes.forEach((l, i) => {
    if (!/GH_TOKEN:/.test(l)) return;
    // Un `env:` de job s'indente à 6 colonnes sous `jobs: <nom>:` ; une étape
    // à 10. La profondeur est donc la mesure, pas la position dans le fichier.
    assert.ok(/^ {10}GH_TOKEN:/.test(l),
      `ligne ${i + 1} : le jeton n’est pas au niveau d’une étape — « ${l} »`);
    const avant = lignes.slice(0, i);
    const j = avant.map(x => /^ {6}- name:/.test(x)).lastIndexOf(true);
    assert.ok(j >= 0, `ligne ${i + 1} : jeton hors de toute étape`);
    porteuses.push(lignes[j].replace(/^ {6}- name:\s*/, '').trim());
  });
  assert.deepStrictEqual(porteuses.slice().sort(), ETAPES_AVEC_JETON.slice().sort(),
    'étapes portant le jeton : ' + JSON.stringify(porteuses));
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

// ---------------------------------------------------------------------------
// LA PUBLICATION du réveil — ce que `issues: write` a ouvert le 26/09/2026.
//
// Le résumé de job PRÉPARE le réveil, il ne le porte pas : il faut que
// quelqu'un aille l'y lire. C'est l'asymétrie que la permission supprime, et
// c'est tout ce qu'elle supprime. L'étape de résumé, elle, ne change pas — et
// les épreuves ci-dessus continuent de mesurer qu'elle ne coûte rien.
//
// Une permission d'écriture sans conditions est une permission qui écrit
// n'importe quand : ce workflow tourne sur TOUTES les branches. Les refus et la
// garde de boucle ne sont donc pas des précautions de style, ce sont eux qui
// font la différence entre un réveil et du bruit — ou, pour la boucle, entre un
// réveil et un emballement sans fin. Ils doivent être non retirables en silence.

function etapeDePublication() {
  const i = yml.indexOf('      - name: Réveil Orchestrateur — publication');
  assert.ok(i > 0,
    'l’étape de PUBLICATION a disparu : le réveil retourne au résumé de job, ' +
    'que personne ne va lire. Le sens Claude → Orchestrateur redevient ' +
    'suspendu à un geste humain — l’état exact d’avant le 26/09/2026.');
  const suite = yml.slice(i + 1);
  const fin = suite.indexOf('\n      - name:');
  return suite.slice(0, fin === -1 ? undefined : fin);
}

t('le réveil est PUBLIÉ à l’adresse que le rail déclare, pas à une adresse écrite ici', () => {
  const etape = etapeDePublication();
  assert.ok(/gh issue comment/.test(etape), 'l’étape doit poster un commentaire');
  assert.ok(/if: always\(\)/.test(etape),
    'sans `if: always()`, le réveil ne part pas quand il compte le plus');
  assert.ok(/lots\[0\]\.adresse/.test(etape),
    'le destinataire se lit dans le rail (`adresse`), il ne se devine pas');

  // `wake_to` se déclare dans le rail, jamais dans du code (PROTOCOL.md). Une
  // adresse en dur survivrait à la disparition du rail qui la justifiait, et
  // continuerait de poster — au bon endroit par coïncidence, jusqu'au jour où
  // ce n'est plus le bon endroit.
  const endur = [];
  if (/issues\/[0-9]+/.test(etape)) endur.push('un numéro d’issue est écrit dans le YAML');
  if (/vito-sainte-marie/.test(etape)) endur.push('un dépôt est écrit dans le YAML');
  assert.deepStrictEqual(endur, [], endur.join(' ; '));
});

t('les quatre refus sont là, et ils se TAISENT au lieu d’échouer', () => {
  const etape = etapeDePublication();

  // Se taire, pas rougir : aucune de ces situations n'est une panne. Une étape
  // qui échouerait parce qu'il n'y a rien à réveiller rendrait toute la CI
  // rouge sur chaque branche, et on la débrancherait dans la semaine.
  assert.ok(/refus\(\)\s*\{[^}]*exit 0/.test(etape),
    'un refus doit sortir en 0 : ne rien avoir à publier n’est pas une panne');

  const attendus = {
    'rien à réveiller': /\.reveil.*\|\| refus/s,
    'la branche courante n’est pas le rail déclaré': /GITHUB_REF_NAME" = "\$RAIL"/,
    'aucune adresse déclarée par le rail': /ADRESSE" \]\s*\|\| refus/,
    'l’adresse sort de ce dépôt': /GITHUB_SERVER_URL\/\$GITHUB_REPOSITORY\/issues\//,
    'ce réveil est déjà publié': /DEJA" = "0" \]\s*\|\| refus/,
  };
  const manquants = Object.keys(attendus).filter(k => !attendus[k].test(etape));
  assert.deepStrictEqual(manquants, [],
    'refus perdus — l’étape publierait dans ce cas : ' + manquants.join(' ; '));
});

t('la garde de BOUCLE fait ÉCHOUER l’étape, et mesure le corps réellement publié', () => {
  const etape = etapeDePublication();

  // Ici se taire serait le pire choix : un corps qui porte la mention et qu'on
  // publierait quand même relance Claude → push → CI → réveil → sans fin.
  // Seule une propriété de plateforme l'empêche aujourd'hui (GitHub n'enchaîne
  // pas les workflows déclenchés par `github.token`) : invisible, et qui tombe
  // le jour où quelqu'un pose un PAT. La garde ne s'y adosse pas.
  const i = etape.search(/grep -q '@claude'/);
  assert.ok(i > 0, 'aucune garde ne vérifie que le corps ne porte pas la mention');
  assert.ok(/exit 1/.test(etape.slice(i, i + 300)),
    'la garde de boucle doit ÉCHOUER, pas se taire : un emballement n’est pas ' +
    'une absence de réveil');

  // Et elle doit juger CE QUI PART. Une garde qui recomposerait le corps pour
  // le tester mesurerait un autre texte que celui qui est publié : elle serait
  // verte pendant que la mention passe. C'est le contrat, pas un détail.
  assert.ok(/printf '%s' "\$CORPS" \| grep -q '@claude'/.test(etape),
    'la garde doit tester `$CORPS`, la variable même qui est publiée');
  assert.ok(/--sans-mention/.test(etape),
    'et le corps publié est celui composé SANS la mention');
  const pub = etape.slice(etape.indexOf('gh issue comment') - 200);
  assert.ok(/"\$CORPS"/.test(pub), 'et c’est bien `$CORPS` qui est posté');
});

t('la déduplication cherche l’empreinte sur TOUTES les pages', () => {
  const etape = etapeDePublication();

  // La marque est l'empreinte du CORPS, pas la simple présence d'un réveil :
  // un réveil qui a changé doit repartir, un réveil identique ne doit pas être
  // reposté à chaque push.
  assert.ok(/sha256sum/.test(etape) && /nexus-reveil:/.test(etape),
    'la marque doit être une empreinte du corps, pas un drapeau de présence');

  // `gh api` sans `--paginate` rend SILENCIEUSEMENT la première page seule. Sur
  // une issue longue — et #28 l'est — la recherche ne verrait plus la marque,
  // et l'étape reposterait le même réveil à chaque exécution en croyant
  // dédupliquer. Le défaut ne se voit pas : il ressemble à un réveil qui part.
  assert.ok(/gh api --paginate/.test(etape),
    'sans `--paginate` la déduplication ne voit que la première page de commentaires');
});

console.log(`\n${n}/${n} vérifications passées — une permission accordée n’est pas une permission ouverte.`);
