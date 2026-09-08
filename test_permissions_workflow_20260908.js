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

console.log(`\n${n}/${n} vérifications passées — une permission accordée n’est pas une permission ouverte.`);
