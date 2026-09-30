// Qui a le droit de publier le réveil Claude → Orchestrateur ?
//
// Le 30/09/2026, Frédéric constate zéro workflow en vol : ni Claude, ni CI, ni
// recette, ni handoff. Ce n'est pas une panne de runner. La boucle s'arrêtait à
// son dernier maillon.
//
// L'étape « Réveil Orchestrateur — publication au destinataire déclaré » de
// `tests.yml` exigeait que `GITHUB_REF_NAME` SOIT le rail déclaré. Or les runs
// de `claude.yml` poussent `claude/issue-28-<date>-<heure>` et personne ne les
// rapatrie : la condition n'était jamais vraie sur un run d'agent. Journal du
// run 36726151526, mot pour mot : « Pas de publication : exécution sur
// 'claude/issue-28-20260930-1349', rail déclaré 'handoff-continuite-20260920'. »
// Les quatre réveils jamais publiés autrement que derrière une poussée du rail
// faite à la main le confirment : le sens Claude → Orchestrateur était
// automatique en apparence, et humain en fait.
//
// Le refus n'est pas retiré, il change de question : la ref doit PORTER les
// octets de la demande (`refs_reelles.memes`, comparaison de blobs), pas
// s'appeler comme le rail.
//
// Ces épreuves EXÉCUTENT le script de l'étape, elles ne le lisent pas. Une
// expression régulière sur du YAML dirait que le texte a changé ; elle ne dirait
// pas qui publie. Le témoin est le cas 2 : rétablir l'ancienne condition le rend
// rouge. Les contre-témoins sont les cas 3 et 4 : une branche étrangère et un
// homonyme doivent rester muets, sans quoi « réparer » voudrait dire « ouvrir ».
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const WORKFLOW = path.join(RACINE, '.github', 'workflows', 'tests.yml');
const yml = fs.readFileSync(WORKFLOW, 'utf8');

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Le script tel qu'il partira au runner : extrait du YAML, désindenté, jamais
// recopié ici. Une copie divergerait le jour où le YAML change, et cette
// épreuve resterait verte sur un texte que plus personne n'exécute.
function scriptDeLEtape() {
  const i = yml.indexOf('      - name: Réveil Orchestrateur — publication');
  assert.ok(i > 0, 'l’étape de publication a disparu du workflow');
  const lignes = yml.slice(i).split('\n');
  const j = lignes.findIndex(l => /^        run: \|\s*$/.test(l));
  assert.ok(j > 0, 'l’étape n’a plus de bloc `run: |`');
  const corps = [];
  for (const l of lignes.slice(j + 1)) {
    if (l.trim() === '') { corps.push(''); continue; }
    if (!l.startsWith('          ')) break;
    corps.push(l.slice(10));
  }
  assert.ok(corps.join('\n').includes('gh issue comment'),
    'le script extrait ne publie rien — l’extraction a manqué sa cible');
  return corps.join('\n');
}

const SCRIPT = scriptDeLEtape();
const RAIL = 'handoff-continuite-20260920';
const RUN = 'claude/issue-28-20260930-1349';
const DEPOT = 'un-depot/un-projet';
const ADRESSE = `https://github.com/${DEPOT}/issues/28`;

const CORPS = [
  'NEXUS Orchestrator — réveil Handoff (sens Claude → Orchestrateur).',
  '',
  'Demande en attente: `request-18.md`',
].join('\n');

function marque(corps) {
  return '<!-- nexus-reveil: ' +
    crypto.createHash('sha256').update(corps).digest('hex').slice(0, 16) + ' -->';
}

function jsonDuLot(muter) {
  const j = {
    reveil: true,
    lots: [{
      branche: RAIL,
      adresse: ADRESSE,
      refs_reelles: {
        memes: [RAIL, `origin/${RAIL}`, `origin/${RUN}`, 'origin/claude/issue-28-20260928-0105'],
        homonymes: ['origin/claude/issue-28-20260924-2119'],
        identifiable: true,
      },
    }],
  };
  if (muter) muter(j);
  return j;
}

// Un bac à sable : `node` et `gh` sont remplacés, `jq` reste le vrai — c'est lui
// qu'on mesure. `sha256sum` est doublé parce qu'il vit sur le runner et pas
// partout ; l'épreuve juge la condition de publication, pas la trousse à outils
// de la machine qui la lance.
function lancer(options) {
  const o = options || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reveil-pub-'));
  const stubs = path.join(dir, 'stubs');
  fs.mkdirSync(stubs);
  const trace = path.join(dir, 'publie.txt');
  const json = JSON.stringify(o.json || jsonDuLot());
  const corps = o.corps === undefined ? CORPS : o.corps;

  const ecrire = (nom, contenu) => {
    const p = path.join(stubs, nom);
    fs.writeFileSync(p, contenu);
    fs.chmodSync(p, 0o755);
  };
  ecrire('node', [
    '#!/bin/sh',
    'for a in "$@"; do',
    '  [ "$a" = "--json" ] && { cat "$NEXUS_FAUX_JSON"; exit 0; }',
    '  [ "$a" = "--message" ] && { cat "$NEXUS_FAUX_CORPS"; exit 0; }',
    'done',
    'echo "node appelé sans --json ni --message : $*" >&2; exit 1',
  ].join('\n') + '\n');
  ecrire('gh', [
    '#!/bin/sh',
    'if [ "$1" = "api" ]; then cat "$NEXUS_FAUX_COMMENTAIRES"; exit 0; fi',
    'if [ "$1" = "issue" ] && [ "$2" = "comment" ]; then',
    '  { echo "--- issue $3 ---"; cat; } >> "$NEXUS_TRACE"; echo "commentaire posté"; exit 0;',
    'fi',
    'echo "gh inattendu : $*" >&2; exit 1',
  ].join('\n') + '\n');
  ecrire('sha256sum', '#!/bin/sh\nexec shasum -a 256 "$@"\n');

  const fJson = path.join(dir, 'reveil.json');
  const fCorps = path.join(dir, 'corps.txt');
  const fComm = path.join(dir, 'commentaires.txt');
  fs.writeFileSync(fJson, json);
  fs.writeFileSync(fCorps, corps);
  fs.writeFileSync(fComm, o.commentaires || '');
  fs.writeFileSync(trace, '');

  const r = spawnSync('bash', ['-c', SCRIPT], {
    encoding: 'utf8',
    cwd: dir,
    env: {
      PATH: `${stubs}:${process.env.PATH}`,
      GITHUB_REF_NAME: o.ref === undefined ? RAIL : o.ref,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: DEPOT,
      GH_TOKEN: 'jeton-factice',
      NEXUS_FAUX_JSON: fJson,
      NEXUS_FAUX_CORPS: fCorps,
      NEXUS_FAUX_COMMENTAIRES: fComm,
      NEXUS_TRACE: trace,
    },
  });
  return {
    code: r.status,
    sortie: (r.stdout || '') + (r.stderr || ''),
    publie: fs.readFileSync(trace, 'utf8'),
  };
}

verifier('un push du rail publie le réveil — le cas qui marchait déjà', () => {
  const r = lancer({ ref: RAIL });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(r.publie.includes('réveil Handoff'),
    'le rail ne publie plus rien : ' + r.sortie);
});

// LE TÉMOIN. Rétablir `[ "$GITHUB_REF_NAME" = "$RAIL" ]` rend ce cas rouge, et
// lui seul montre le défaut du 26 au 30/09 : la CI de Claude ne pousse jamais
// le rail, donc elle ne réveillait jamais l'Orchestrateur.
verifier('une branche de run qui PORTE la demande publie aussi', () => {
  const r = lancer({ ref: RUN });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(r.publie.includes('réveil Handoff'),
    'la branche de run ne réveille personne — la boucle reste suspendue à un ' +
    'geste humain, exactement comme le 30/09 : ' + r.sortie);
  assert.ok(r.publie.includes('--- issue 28 ---'),
    'publié ailleurs qu’à l’adresse déclarée par le rail : ' + r.publie);
});

// CONTRE-TÉMOIN 1 : « réparer » ne veut pas dire « ouvrir ». `tests.yml` tourne
// sur `branches: ['**']` ; sans ce refus, chaque push de chaque branche
// posterait un commentaire.
verifier('une branche étrangère au lot reste muette', () => {
  const r = lancer({ ref: 'rebuild/carburants-65-20260922' });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.publie, '',
    'une branche qui ne porte pas la demande a publié : ' + r.sortie);
  assert.ok(/ne porte pas la demande du lot/.test(r.sortie), r.sortie);
});

// CONTRE-TÉMOIN 2 : une ref classée `homonymes` — donc absente de `memes`.
// Cette configuration n'arrive pas sur un vrai checkout : l'empreinte est prise
// sur la copie du checkout, la ref courante se compare à elle-même et ne peut
// pas être son propre homonyme. Ce qui est gardé ici, c'est le CHEMIN DE CODE :
// figurer dans le JSON du lot ne suffit pas, il faut figurer dans `memes`.
// Quelqu'un qui élargirait la sélection à `homonymes` — « elle est dans le
// lot, non ? » — ferait annoncer par une ref une demande qu'elle ne porte pas.
verifier('une ref rangée dans `homonymes` reste muette', () => {
  const r = lancer({ ref: 'claude/issue-28-20260924-2119' });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.publie, '', 'un homonyme a parlé pour le lot : ' + r.sortie);
});

verifier('une demande non identifiable fait taire tout le monde', () => {
  // Empreinte incalculable : `memes` ne distingue plus rien, tout ce qui porte
  // le NOM y entre. Publier là-dessus, c'est publier au hasard.
  const r = lancer({ ref: RAIL, json: jsonDuLot(j => {
    j.lots[0].refs_reelles.identifiable = false;
  }) });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.publie, '', r.sortie);
  assert.ok(/pas identifiable/.test(r.sortie), r.sortie);
});

verifier('git muet ne plante pas l’étape, il la fait taire', () => {
  // `refs_reelles` vaut `null` quand l'outil n'a pas de git sous la main. Une
  // étape qui planterait là rendrait la CI rouge sur chaque branche, et on la
  // débrancherait dans la semaine.
  const r = lancer({ ref: RAIL, json: jsonDuLot(j => { j.lots[0].refs_reelles = null; }) });
  assert.strictEqual(r.code, 0, 'l’étape a échoué au lieu de se taire : ' + r.sortie);
  assert.strictEqual(r.publie, '', r.sortie);
});

verifier('rien à réveiller : aucune publication', () => {
  const r = lancer({ ref: RAIL, json: jsonDuLot(j => { j.reveil = false; }) });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.publie, '', r.sortie);
  assert.ok(/rien à réveiller/.test(r.sortie), r.sortie);
});

verifier('le même réveil déjà publié ne repart pas', () => {
  const r = lancer({ ref: RUN, commentaires: 'un vieux commentaire\n' + marque(CORPS) + '\n' });
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.publie, '', 'réveil republié à l’identique : ' + r.sortie);
  assert.ok(/déjà publié/.test(r.sortie), r.sortie);
});

// La garde de BOUCLE, mesurée depuis la branche de run : c'est justement le cas
// que le refus 2 interdisait d'atteindre. L'ouvrir sans vérifier qu'elle tient
// encore reviendrait à retirer un verrou sans regarder le second.
verifier('un corps portant la mention fait ÉCHOUER l’étape, depuis un run aussi', () => {
  const r = lancer({ ref: RUN, corps: CORPS + '\n\n@claude reprends le travail' });
  assert.strictEqual(r.code, 1,
    'la garde de boucle doit faire échouer l’étape, pas se taire : ' + r.sortie);
  assert.strictEqual(r.publie, '', 'un corps qui relance Claude a été publié : ' + r.publie);
});

verifier('ce qui est publié, c’est le corps composé plus sa marque', () => {
  const r = lancer({ ref: RUN });
  assert.ok(r.publie.includes(CORPS), 'le corps publié n’est pas celui qui a été composé');
  assert.ok(r.publie.includes(marque(CORPS)),
    'la marque de déduplication ne part pas avec le corps : le prochain push republierait');
});

console.log(`\n${passes}/${passes} vérifications passées — le réveil part de ce qui PORTE la demande, et de rien d’autre.`);
