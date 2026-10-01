'use strict';

// ════════════════════════════════════════════════════════════════════════════
// LE CÂBLAGE DE LA GARDE RPC DANS LA PROCÉDURE DE DÉPLOIEMENT PRODUCTION
//
// POURQUOI CETTE ÉPREUVE EXISTE.
//
// `outils/garde-rpc-front-definie-sur-la-cible.js` a son propre banc, qui
// prouve qu'elle SAIT refuser. Prouver qu'elle sait refuser ne prouve pas
// qu'elle est BRANCHÉE : le 01/10/2026, le déploiement #65 a publié un écran
// de connexion appelant une fonction absente de la base Production, et aucune
// garde n'a parlé — non parce qu'elle était fausse, mais parce qu'elle
// n'existait pas à cet endroit-là du chemin.
//
// Le câblage vit dans `.github/workflows/deploiement-production.yml`, fichier
// qui N'EXISTE QUE SUR LA BRANCHE `production`. Le rail ne peut donc pas le
// modifier : il porte le correctif, `docs/deploiement/cablage-garde-rpc-production.patch`,
// qui sera appliqué au moment du transport. Un correctif posé à côté sans rien
// qui le mesure pourrit en silence — c'est exactement la forme de dette que ce
// dépôt a déjà payée plusieurs fois. Cette épreuve le mesure donc là où il est.
//
// CE QU'ELLE MESURE, et c'est tout ce qu'elle prétend mesurer :
//   1. le correctif est une insertion pure — il ne retire aucune ligne de la
//      procédure existante, donc il ne peut pas désarmer une garde en place ;
//   2. l'étape est assise au bon endroit, ce qui se lit dans les lignes de
//      CONTEXTE du correctif, pas dans mon intention ;
//   3. l'aiguillage de la cible fait bien ce qu'il dit, pour chaque forme
//      d'événement, en EXÉCUTANT le corps de l'étape ;
//   4. chaque refus vient de la clause qu'on croit — mesuré en DÉBRANCHANT
//      cette clause et en constatant que le refus disparaît.
//
// CE QU'ELLE NE MESURE PAS : que GitHub Actions accepte ce YAML. Aucun
// analyseur YAML n'est disponible sur cette machine et je n'en ai pas
// fabriqué un : une mesure ne se construit pas. Ce qui est vérifié ici, ce
// sont des propriétés structurelles du correctif et le comportement réel de
// son corps shell sous `bash`. L'acceptation par Actions se constatera au
// premier run, pas avant.
//
// LES MUTATIONS SONT ISOLÉES. Chaque mutation part du corps d'origine et y
// touche une seule clause. Deux mutations concurrentes dans le même bac ne
// mesurent rien : l'une restaure ce que l'autre casse, et le vert ressemble au
// vrai défaut.
// ════════════════════════════════════════════════════════════════════════════

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CORRECTIF = path.join(__dirname, 'docs', 'deploiement', 'cablage-garde-rpc-production.patch');
const GARDE = path.join('outils', 'garde-rpc-front-definie-sur-la-cible.js');
const SHA_NUL = '0'.repeat(40);

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const bacs = [];
function bac() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-cablage-'));
  bacs.push(d);
  return d;
}

console.log('\nCâblage de la garde RPC dans la procédure de déploiement Production\n');

// ── A. Le correctif lui-même ───────────────────────────────────────────────
console.log('── A. Le correctif : ce qu\'il touche, et ce qu\'il ne touche pas');

assert.ok(fs.existsSync(CORRECTIF),
  `le correctif est absent : ${CORRECTIF}. Le câblage n'est alors nulle part.`);
const brut = fs.readFileSync(CORRECTIF, 'utf8');
const lignes = brut.split('\n');

// A1 — insertion pure. Une ligne retirée, c'est une garde existante
// potentiellement désarmée ; la procédure en porte plusieurs, dont la garde
// anti-obsolescence.
const retirees = lignes.filter((l) => l.startsWith('-') && !l.startsWith('---'));
assert.deepStrictEqual(retirees, [],
  'le correctif retire des lignes de la procédure : ' + JSON.stringify(retirees.slice(0, 3)));
const ajoutees = lignes.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
assert.ok(ajoutees.length > 80,
  `seulement ${ajoutees.length} ligne(s) ajoutée(s) : le correctif a maigri, l'extraction ci-dessous mesurerait du vide`);
ok(`A1 — insertion pure : ${ajoutees.length} ligne(s) ajoutée(s), 0 retirée(s)`);

// A2 — il vise le bon fichier, et lui seul.
const fichiers = lignes.filter((l) => l.startsWith('diff --git')).map((l) => l.split(' b/')[1]);
assert.deepStrictEqual(fichiers, ['.github/workflows/deploiement-production.yml'],
  'le correctif touche autre chose que la procédure de déploiement : ' + JSON.stringify(fichiers));
ok('A2 — un seul fichier visé : .github/workflows/deploiement-production.yml');

// A3 — le siège se lit dans le CONTEXTE, pas dans mon intention. La ligne de
// contexte qui SUIT le bloc ajouté doit être l'étape de construction : c'est
// ce qui prouve que la garde passe avant elle, donc qu'un arbre dont un écran
// appellerait dans le vide n'est jamais construit, ni composé, ni emballé —
// et que le refus arrive AVANT l'approbation humaine de `github-pages`.
const iDernierAjout = lignes.reduce((acc, l, i) => (l.startsWith('+') && !l.startsWith('+++') ? i : acc), -1);
const suite = lignes.slice(iDernierAjout + 1).filter((l) => l.startsWith(' ') && l.trim() !== '');
assert.ok(suite.length > 0, 'le bloc ajouté n\'est suivi d\'aucune ligne de contexte : le siège n\'est pas mesurable');
assert.strictEqual(suite[0].trim(), '- name: Construire (NEXUS_ENV=production)',
  `l'étape suivante est « ${suite[0].trim()} » : la garde n'est plus avant la construction`);
ok('A3 — le contexte aval est « Construire (NEXUS_ENV=production) » : la garde passe avant le build');

// A4 — et le contexte amont doit être la fin de l'étape qui publie
// `sha_construit`, puisque c'est elle qui fournit le candidat. Mesurer l'ordre
// sans mesurer la dépendance laisserait passer une garde assise avant la
// sortie qu'elle consomme.
// On remonte depuis l'étape elle-même, pas depuis la première ligne ajoutée du
// correctif : celle-là appartient à l'autre insertion, l'entrée `ref_cible_rpc`,
// et son contexte amont est `type: string`. Mesurer le mauvais bloc donnait un
// rouge juste pour une raison fausse.
const iEtape = lignes.findIndex((l) => l.startsWith('+') && l.includes('- name: Garde RPC'));
assert.ok(iEtape > 0, 'l\'étape « Garde RPC » n\'est pas une ligne ajoutée du correctif');
let iDebutBloc = iEtape;
while (iDebutBloc > 0 && lignes[iDebutBloc - 1].startsWith('+')) iDebutBloc--;
const amont = lignes.slice(0, iDebutBloc).filter((l) => l.startsWith(' ') && l.trim() !== '');
assert.ok(/sha_construit=/.test(amont[amont.length - 1]),
  `le contexte amont est « ${amont[amont.length - 1]} » : la garde ne suit plus l'étape qui publie sha_construit`);
ok('A4 — le contexte amont publie `sha_construit` : le candidat est disponible quand la garde lit');

// A5 — le correctif n'accorde aucune permission. `permissions: {}` en tête de
// la procédure est une propriété de sécurité ; une garde qui réclamerait un
// droit pour mesurer un arbre déjà récupéré serait mal conçue.
const yamlAjoute = ajoutees.filter((l) => !l.trim().startsWith('#'));
const droits = yamlAjoute.filter((l) => /^\s*(permissions|contents|pages|id-token|pull-requests|issues)\s*:/.test(l));
assert.deepStrictEqual(droits, [], 'le correctif touche aux permissions : ' + JSON.stringify(droits));
ok('A5 — aucune permission accordée : la garde lit l\'arbre déjà récupéré');

// A6 — et il ne transporte aucun secret. Un correctif est un document qui
// voyage ; ce qui y entre en sort.
const sensibles = ajoutees.filter((l) => /(secrets\.|eyJ[A-Za-z0-9_-]{10,}|sb_[a-z]+_[A-Za-z0-9_-]{6,}|postgres:\/\/|supabase\.co|gh[pous]_)/.test(l));
assert.deepStrictEqual(sensibles, [], 'le correctif contient une valeur sensible');
ok('A6 — aucun secret, jeton ni URL de base dans le correctif');

// ── B. L'aiguillage de la cible, en l'exécutant ────────────────────────────
console.log('\n── B. L\'aiguillage : d\'où vient la cible, pour chaque forme d\'événement');

// Extraction du corps de l'étape. Elle doit échouer BRUYAMMENT : un corps vide
// rendrait toute la suite verte sans rien mesurer.
const iNom = ajoutees.findIndex((l) => l.trim().startsWith('- name: Garde RPC'));
assert.ok(iNom >= 0, 'aucune étape « Garde RPC » dans le correctif');
const iRun = ajoutees.findIndex((l, i) => i > iNom && l.trim() === 'run: |');
assert.ok(iRun > iNom, 'l\'étape « Garde RPC » n\'a pas de bloc `run: |`');
const marge = ajoutees[iRun].length - ajoutees[iRun].trimStart().length;
const corps = [];
for (const l of ajoutees.slice(iRun + 1)) {
  if (l.trim() === '') { corps.push(''); continue; }
  if (l.length - l.trimStart().length <= marge) break;
  corps.push(l.slice(marge + 2));
}
assert.ok(corps.length > 20, `corps extrait trop court (${corps.length} lignes) : rien ne serait mesuré`);
assert.ok(corps.some((l) => l.includes(GARDE)), `le corps n'appelle pas ${GARDE}`);
assert.ok(corps[0].includes('set -euo pipefail'), 'le corps ne commence pas par `set -euo pipefail`');
ok(`B0 — corps de l'étape extrait du correctif : ${corps.length} ligne(s), appelant ${GARDE}`);

// Le témoin remplace l'appel à la garde. On ne mesure pas ici ce que la garde
// répond — elle a son banc — mais SI elle est appelée, et avec quelle cible.
// Le témoin est un fichier : s'il n'existe pas, l'étape s'est arrêtée avant.
function harnais(corpsLignes, bacDir) {
  const temoin = path.join(bacDir, 'temoin.txt');
  const out = corpsLignes
    .map((l) => (l.includes(GARDE)
      ? `printf '%s\\n' "candidat=\${CANDIDAT} cible=\${CIBLE}" > ${JSON.stringify(temoin)}`
      : l))
    .filter((l) => !/^\s*--(candidat|cible)\s/.test(l))
    .join('\n');
  const script = path.join(bacDir, 'etape.sh');
  fs.writeFileSync(script, out + '\n');
  return { script, temoin };
}

function jouer(env, corpsLignes = corps) {
  const d = bac();
  const { script, temoin } = harnais(corpsLignes, d);
  // UNE MUTATION MAL VISÉE N'EST PAS UN REFUS. Retirer la seule ligne `if …`
  // d'un bloc laisse un `then … fi` orphelin : le shell sort en erreur, le code
  // est 1, et on lirait « la clause refusait bien » là où il n'y a qu'une
  // syntaxe cassée. Premier jet du banc pris exactement à ce piège. On vérifie
  // donc la syntaxe AVANT d'interpréter le code de sortie.
  const syntaxe = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.strictEqual(syntaxe.status, 0,
    'mutation mal visée : le corps muté n\'est plus un script valide, son code de sortie ne mesure rien.\n' + syntaxe.stderr);
  const r = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: Object.assign({ PATH: process.env.PATH, HOME: d }, env),
  });
  return {
    code: r.status,
    sortie: (r.stdout || '') + (r.stderr || ''),
    appelee: fs.existsSync(temoin),
    cible: fs.existsSync(temoin) ? fs.readFileSync(temoin, 'utf8').trim() : null,
  };
}

const CANDIDAT = 'adee9bbcb6fd7e0af7632730ede185e655d04580';
const AVANT = '2bc7b39dd73a04e0ef3dbea55c6b0e1a7e5c2f81';
const socle = { CANDIDAT, CIBLE_PUSH: '', CIBLE_PR: '', CIBLE_DEMANDEE: '' };

// B1 — push : la cible est l'état d'où `production` sort. C'est la question
// utile : « ce que ce push ajoute, la base le connaît-elle ? »
const b1 = jouer({ ...socle, EVENEMENT: 'push', CIBLE_PUSH: AVANT });
assert.strictEqual(b1.code, 0, b1.sortie);
assert.strictEqual(b1.cible, `candidat=${CANDIDAT} cible=${AVANT}`);
ok('B1 — push : la cible est `github.event.before`, et la garde est appelée');

// B2 — pull_request : la base de la PR. Position la plus utile du dispositif,
// car le refus est lisible AVANT la fusion. Pour #65, le rouge se serait vu
// avant le geste qui a cassé le site.
const b2 = jouer({ ...socle, EVENEMENT: 'pull_request', CIBLE_PR: AVANT });
assert.strictEqual(b2.code, 0, b2.sortie);
assert.strictEqual(b2.cible, `candidat=${CANDIDAT} cible=${AVANT}`);
ok('B2 — pull_request : la cible est `base.sha`, donc le refus précède la fusion');

// B3 — répétition manuelle : la cible est DEMANDÉE. Aucun événement ne la
// porte, et la deviner ferait porter le verdict sur une autre question.
const b3 = jouer({ ...socle, EVENEMENT: 'workflow_dispatch', CIBLE_DEMANDEE: 'origin/production' });
assert.strictEqual(b3.code, 0, b3.sortie);
assert.strictEqual(b3.cible, `candidat=${CANDIDAT} cible=origin/production`);
ok('B3 — workflow_dispatch : la cible est l\'entrée `ref_cible_rpc`, telle que désignée');

// B4 — l'aiguillage ne mélange pas les sources. Une cible posée sur le mauvais
// canal ne doit pas servir : sinon un `push` hériterait d'une entrée manuelle
// oubliée, et la mesure porterait sur un état que personne n'a désigné.
const b4 = jouer({ ...socle, EVENEMENT: 'push', CIBLE_DEMANDEE: 'une-autre-branche' });
assert.strictEqual(b4.code, 1, 'un push sans `before` doit refuser, même si une entrée manuelle traîne');
assert.strictEqual(b4.appelee, false);
ok('B4 — les canaux ne se substituent pas : une entrée manuelle ne sert pas un `push`');

// ── C. Les refus, et la preuve que chacun vient de sa clause ───────────────
console.log('\n── C. Les refus : échec fermé, et la clause qui le produit');

// Débrancher une clause, pas la casser. Si le refus survit à son retrait,
// c'est qu'il venait d'ailleurs — et la clause ne prouve rien.
function sansLeBloc(motif) {
  const i = corps.findIndex((l) => motif.test(l));
  assert.ok(i >= 0, `mutation vide : aucune ligne ne correspond à ${motif}`);
  const marge = corps[i].length - corps[i].trimStart().length;
  let j = i + 1;
  while (j < corps.length && !(corps[j].trim() === 'fi' && corps[j].length - corps[j].trimStart().length === marge)) j++;
  assert.ok(j < corps.length, `le bloc ouvert ligne ${i} n'a pas de \`fi\` à la même marge : mutation impossible à viser`);
  const reste = corps.slice(0, i).concat(corps.slice(j + 1));
  assert.ok(reste.length === corps.length - (j - i + 1));
  return reste;
}

// C1 — manuel sans cible.
const c1 = jouer({ ...socle, EVENEMENT: 'workflow_dispatch' });
assert.strictEqual(c1.code, 1);
assert.strictEqual(c1.appelee, false, 'la garde a été appelée sans cible désignée');
assert.ok(/::error title=Garde RPC::/.test(c1.sortie), c1.sortie);
assert.ok(/ref_cible_rpc/.test(c1.sortie), 'le refus ne dit pas quoi renseigner');
ok('C1 — répétition manuelle sans `ref_cible_rpc` : refus, et le message nomme le champ à remplir');

// C1 muté — on retire le test de vacuité. Le refus doit disparaître : c'est ce
// qui prouve que c'est bien lui qui refusait.
const c1m = jouer({ ...socle, EVENEMENT: 'workflow_dispatch' }, sansLeBloc(/if \[ -z "\$\{CIBLE\}" \]/));
assert.notStrictEqual(c1m.code, 1,
  'le refus survit au retrait de son test de vacuité : il venait d\'ailleurs, la clause ne prouve rien');
ok('C1 muté — le test de vacuité débranché, le refus disparaît : il venait bien de là');

// C2 — push dont l'événement ne porte pas de cible. Même échec fermé, message
// distinct : il ne faut pas envoyer chercher une entrée manuelle là où c'est
// l'événement qui est muet.
const c2 = jouer({ ...socle, EVENEMENT: 'push' });
assert.strictEqual(c2.code, 1);
assert.strictEqual(c2.appelee, false);
assert.ok(/github\.event\.before/.test(c2.sortie), c2.sortie);
ok('C2 — push sans `before` : refus, et le message nomme la source muette');

// C3 — SHA nul : la branche vient d'être créée, il n'existe aucun état
// antérieur. Le dire, plutôt que de laisser la garde répondre « référence
// introuvable », qui enverrait chercher une panne de clone inexistante.
const c3 = jouer({ ...socle, EVENEMENT: 'push', CIBLE_PUSH: SHA_NUL });
assert.strictEqual(c3.code, 1);
assert.strictEqual(c3.appelee, false, 'la garde a été appelée avec le SHA nul comme cible');
assert.ok(/SHA nul/.test(c3.sortie), c3.sortie);
ok('C3 — SHA nul : refus nommé, et la garde n\'est pas appelée sur une cible inexistante');

// C3 muté — sans le test du SHA nul, la garde est appelée avec quarante zéros.
const c3m = jouer({ ...socle, EVENEMENT: 'push', CIBLE_PUSH: SHA_NUL }, sansLeBloc(/if \[ "\$\{CIBLE\}" = "0{40}" \]/));
assert.strictEqual(c3m.appelee, true,
  'le test du SHA nul débranché, la garde devrait être appelée — elle ne l\'est pas, donc le refus venait d\'ailleurs');
assert.strictEqual(c3m.cible, `candidat=${CANDIDAT} cible=${SHA_NUL}`);
ok('C3 muté — le test du SHA nul débranché, la garde est appelée sur quarante zéros : le refus venait bien de là');

// C4 — événement non prévu. Échec fermé plutôt que cible devinée : c'est le
// défaut qui a déjà coûté quatre réparations dans ce dépôt, un repli
// silencieux vers une branche supposée.
const c4 = jouer({ ...socle, EVENEMENT: 'schedule' });
assert.strictEqual(c4.code, 1);
assert.strictEqual(c4.appelee, false);
assert.ok(/non prévu/.test(c4.sortie), c4.sortie);
ok('C4 — événement non prévu : refus, et aucune cible devinée');

// C4 muté — le cas par défaut remplacé par une tolérance. Sans la branche
// `*)`, un événement inconnu laisserait `CIBLE` vide et tomberait sur le test
// de vacuité : le refus subsisterait, mais pour la mauvaise raison, avec un
// message qui désigne une source muette au lieu d'un événement imprévu. Ce
// qu'on mesure ici est donc le MESSAGE, pas le code de sortie.
const c4m = jouer({ ...socle, EVENEMENT: 'schedule' }, corps.map((l) => (/non prévu/.test(l) ? '              echo "ignore"' : l)));
assert.ok(!/non prévu/.test(c4m.sortie),
  'la mutation n\'a pas pris : le message d\'événement imprévu est toujours là');
ok('C4 muté — le message retiré, le refus subsiste mais ne désigne plus l\'événement : la clause porte le diagnostic, pas le refus');

// ── D. Ce que la garde ne peut pas trouver là où elle est posée ────────────
console.log('\n── D. La dépendance que le correctif ne porte pas');

// Le correctif appelle un outil qui N'EXISTE PAS sur `production`. Appliquer
// le YAML seul rendrait un rouge — mais un rouge pour la mauvaise raison :
// « module introuvable », qu'on lirait comme une panne de CI et non comme une
// dépendance oubliée. Les deux doivent voyager ensemble, et cette épreuve
// l'inscrit noir sur blanc plutôt que de le laisser dans une tête.
assert.ok(fs.existsSync(path.join(__dirname, GARDE)),
  `${GARDE} est absent du rail : le correctif y appelle un outil que le dépôt ne porte pas`);
ok(`D1 — ${GARDE} est bien présent sur le rail, d'où il devra voyager avec le correctif`);

const declaration = path.join('docs', 'deploiement', 'rpc-hors-bande-constatees.json');
assert.ok(fs.existsSync(path.join(__dirname, declaration)),
  `${declaration} est absent : les RPC constatées hors-bande redeviendraient des WARN non expliqués`);
ok(`D2 — ${declaration} est présent : il devra voyager aussi, sinon les RPC hors-bande redeviennent muettes`);

for (const d of bacs) fs.rmSync(d, { recursive: true, force: true });
console.log(`\n${n} tests passés.`);
