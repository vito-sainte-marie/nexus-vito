// Épreuve de la garde ENV-001 (outils/garde-env-001.js).
//
// La garde est censée reconnaître le défaut du 07/09/2026 : une branche Claude
// racinée sur la branche par défaut au lieu de la branche canonique. Ce test
// ne se contente donc pas de vérifier qu'elle échoue — il vérifie qu'elle
// échoue POUR LA BONNE RAISON, avec le bon code. Un garde qui refuse tout
// serait vert sur la moitié de ces cas sans rien détecter.
//
// Chaque scénario reconstruit un vrai dépôt Git jetable et rejoue la
// topologie réelle plutôt que de simuler des réponses de `git`.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const GARDE = path.join(__dirname, 'outils', 'garde-env-001.js');
let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

function depotJetable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env001-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'epreuve@nexus.test');
  g('config', 'user.name', 'Epreuve');
  const commit = (message, fichier, contenu) => {
    fs.writeFileSync(path.join(dir, fichier), contenu);
    g('add', fichier); g('commit', '-q', '-m', message);
    return g('rev-parse', 'HEAD');
  };
  return { dir, g, commit };
}

// Topologie commune : une baseline partagée, puis main et
// config-par-environnement qui divergent — exactement le dépôt réel, où le
// seul ancêtre commun était la baseline gelée 501c0c7.
function topologie() {
  const d = depotJetable();
  const baseline = d.commit('baseline gelee', 'socle.txt', 'socle');
  d.g('branch', 'config-par-environnement');
  d.commit('main avance de son cote', 'workflow.yml', 'ci');
  const mainSha = d.g('rev-parse', 'HEAD');
  d.g('checkout', '-q', 'config-par-environnement');
  d.commit('travail canonique 1', 'moteur.js', 'v1');
  const canonique = d.commit('travail canonique 2', 'moteur.js', 'v2');
  return { ...d, baseline, mainSha, canonique };
}

// spawnSync et non execFileSync : ce dernier ne rend que stdout quand le code
// de sortie est 0, or la garde écrit ses refus sur stderr — et `--tolerer-retard`
// produit précisément le cas « sortie 0, message sur stderr ». Le premier
// jet de ce test lisait donc une chaîne vide et aurait pu faire croire à un
// silence de la garde.
function lancer(dir, ref, options) {
  const env = { ...process.env, NEXUS_DEPOT: dir };
  const args = [GARDE, ref || 'HEAD'].concat(options || []);
  const r = spawnSync('node', args, { encoding: 'utf8', env });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

verifier('une branche coupée depuis le HEAD canonique est conforme', () => {
  const t = topologie();
  t.g('checkout', '-q', '-b', 'claude/issue-28-conforme', t.canonique);
  t.commit('travail de Claude', 'correctif.js', 'delta');
  const r = lancer(t.dir);
  assert.strictEqual(r.code, 0, 'doit passer : ' + r.sortie);
  assert.ok(/OK/.test(r.sortie), r.sortie);
  assert.ok(/1 commit\(s\) propre\(s\)/.test(r.sortie), 'doit compter le travail réel : ' + r.sortie);
});

verifier('la branche canonique elle-même est conforme', () => {
  const t = topologie();
  const r = lancer(t.dir, 'config-par-environnement');
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(/exactement/.test(r.sortie), 'sans commit propre, le message doit le dire : ' + r.sortie);
});

verifier('une branche racinée sur la branche par défaut est refusée, et nommée comme telle', () => {
  // Le cas réel du 07/09 : claude/issue-28-20260907-1232 coupée depuis main.
  const t = topologie();
  t.g('checkout', '-q', '-b', 'claude/issue-28-defaut', t.mainSha);
  t.commit('travail prouve mais intransportable', 'correctif.js', 'delta');
  const r = lancer(t.dir);
  assert.notStrictEqual(r.code, 0, 'doit échouer');
  assert.ok(/DÉFAUT DE RAIL/.test(r.sortie), 'le diagnostic doit nommer le défaut de rail : ' + r.sortie);
  assert.ok(/base_branch/.test(r.sortie), 'et rappeler l\'entrée qui le corrige : ' + r.sortie);
  // Assertion sur la LIGNE, pas sur le chiffre nu : `/2/` matcherait aussi
  // « issue-28 » ou un SHA, et laisserait passer un compteur toujours à zéro.
  assert.ok(/commits canoniques manquants : 2$/m.test(r.sortie),
    'et chiffrer exactement les commits canoniques manquants : ' + r.sortie);
});

verifier('une branche partie d’un canonique périmé est refusée SANS crier au défaut de rail', () => {
  // Distinction essentielle : être en retard n'est pas être raciné sur main.
  // Un garde qui confondrait les deux enverrait rééditer un workflow sain.
  const t = topologie();
  t.g('checkout', '-q', '-b', 'claude/issue-28-retard', t.canonique);
  t.commit('travail de Claude', 'correctif.js', 'delta');
  t.g('checkout', '-q', 'config-par-environnement');
  t.commit('le canon avance pendant ce temps', 'autre.js', 'x');
  const r = lancer(t.dir, 'claude/issue-28-retard');
  assert.notStrictEqual(r.code, 0, 'doit échouer : le HEAD canonique n\'est plus ancêtre');
  assert.ok(/en retard/.test(r.sortie), r.sortie);
  assert.ok(/commits canoniques manquants : 1$/m.test(r.sortie),
    'un seul commit canonique manque ici, et le compteur doit le dire : ' + r.sortie);
  assert.ok(!/DÉFAUT DE RAIL/.test(r.sortie),
    'un simple retard ne doit PAS être annoncé comme le défaut de rail : ' + r.sortie);
});

verifier('--tolerer-retard laisse passer un retard, mais JAMAIS une racine sur main', () => {
  // La distinction porte la garde entière : si les deux cas bloquaient de la
  // même façon, la CI serait rouge pour rien et quelqu'un finirait par
  // retirer l'étape — et une garde retirée protège moins que pas de garde,
  // parce qu'on croit encore l'avoir.
  const retard = topologie();
  retard.g('checkout', '-q', '-b', 'travail-en-retard', retard.canonique);
  retard.commit('delta', 'correctif.js', 'd');
  retard.g('checkout', '-q', 'config-par-environnement');
  retard.commit('le canon avance', 'autre.js', 'x');
  const rRetard = lancer(retard.dir, 'travail-en-retard', ['--tolerer-retard']);
  assert.strictEqual(rRetard.code, 0, 'un retard toléré doit sortir 0 : ' + rRetard.sortie);
  assert.ok(/ÉCHEC/.test(rRetard.sortie), 'mais rester imprimé, pas silencieux : ' + rRetard.sortie);
  assert.ok(/non bloquant/.test(rRetard.sortie), rRetard.sortie);

  const surMain = topologie();
  surMain.g('checkout', '-q', '-b', 'travail-sur-main', surMain.mainSha);
  surMain.commit('delta', 'correctif.js', 'd');
  const rMain = lancer(surMain.dir, 'travail-sur-main', ['--tolerer-retard']);
  assert.notStrictEqual(rMain.code, 0,
    'la racine sur la branche par défaut doit bloquer MÊME avec --tolerer-retard : ' + rMain.sortie);
  assert.ok(/DÉFAUT DE RAIL/.test(rMain.sortie), rMain.sortie);
});

verifier('un canonique introuvable échoue au lieu de conclure « conforme »', () => {
  // Un contrôle qui ne trouve pas sa référence et sort 0 est pire que pas de
  // contrôle : il rassure. Fail-closed, comme le reste de NEXUS.
  const t = topologie();
  t.g('checkout', '-q', 'main');
  t.g('branch', '-D', 'config-par-environnement');
  const r = lancer(t.dir);
  assert.notStrictEqual(r.code, 0, 'doit échouer');
  assert.ok(/introuvable/.test(r.sortie), r.sortie);
  assert.ok(/ne conclut pas/.test(r.sortie), 'et dire pourquoi il ne conclut pas : ' + r.sortie);
});

verifier('origin/ prime sur la copie locale de la branche canonique', () => {
  // Une copie locale en retard ne doit pas faire passer un travail pour
  // conforme : c'est l'état publié qui fait foi.
  const t = topologie();
  const publie = t.g('rev-parse', 'config-par-environnement');
  t.g('update-ref', 'refs/remotes/origin/config-par-environnement', publie);
  t.g('checkout', '-q', '-b', 'travail', publie);
  t.commit('delta', 'correctif.js', 'd');
  // La branche LOCALE recule d'un commit ; origin/ reste à jour.
  t.g('branch', '-f', 'config-par-environnement', publie + '~1');
  const r = lancer(t.dir, 'travail');
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(/origin\/config-par-environnement/.test(r.sortie),
    'la garde doit avoir lu origin/, pas la locale : ' + r.sortie);
});

verifier('une référence inexistante est refusée', () => {
  const t = topologie();
  const r = lancer(t.dir, 'branche-qui-nexiste-pas');
  assert.notStrictEqual(r.code, 0);
  assert.ok(/introuvable/.test(r.sortie), r.sortie);
});

console.log(`\n${passes}/${passes} vérifications passées — ENV-001 se contrôle, au lieu de se raconter.`);
