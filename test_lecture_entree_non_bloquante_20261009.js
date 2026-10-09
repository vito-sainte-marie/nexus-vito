// Lecture de l'entrée standard sur un tube non bloquant — le réveil ne meurt
// plus sur EAGAIN.
//
// LE DÉFAUT QUE CECI MESURE. Run 37927790518 (09/10/2026, étape « Réveil
// Orchestrateur ») : `printf "$HISTORIQUE" | node outils/empreinte-progression.js
// --marques -` a levé `EAGAIN: resource temporarily unavailable, read` dans
// `fs.readFileSync(0)`, puis `printf` a reçu Broken pipe. Le tube hérité était
// en O_NONBLOCK et vide à l'instant de la lecture : Node lève au lieu
// d'attendre. Reproduit en local le 09/10 avec un tube O_NONBLOCK et un
// écrivain qui tarde de 0,5 s — rouge à chaque essai, pas un aléa.
//
// Propriétés tenues, chacune par une mutation qui mord :
//   A. EAGAIN répété puis données : tout est lu, rien n'est perdu ;
//   B. un silence au-delà du délai lève une erreur NOMMÉE — jamais une
//      chaîne vide, qui ferait conclure « aucune marque antérieure » ;
//   C. une autre erreur de lecture n'est pas avalée ;
//   D. bout en bout : l'outil d'empreinte, sur un vrai tube O_NONBLOCK dont
//      l'écrivain tarde, compte la marque antérieure et rend STALL ;
//   E. câblage : plus aucun `readFileSync(0` dans `outils/` — les deux
//      lecteurs de l'entrée standard (empreinte, relais) passent par l'aide.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const { lireEntreeStandard } = require('./outils/lire-entree.js');

let reussites = 0;
const echecs = [];
function epreuve(nom, f) {
  try { f(); reussites += 1; console.log(`  ✅ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`  ❌ ${nom}\n     ${e && e.stack || e}`); }
}

// Remplace fs.readSync le temps d'un appel par un scénario scripté.
function avecLecture(scenario, f) {
  const origine = fs.readSync;
  let i = 0;
  fs.readSync = (fd, tampon) => {
    const pas = scenario[Math.min(i++, scenario.length - 1)];
    if (pas instanceof Error) throw pas;
    const b = Buffer.from(pas, 'utf8');
    b.copy(tampon);
    return b.length;
  };
  try { return f(); } finally { fs.readSync = origine; }
}
const errno = code => Object.assign(new Error(code), { code });

epreuve('A — EAGAIN répété puis données : tout est lu', () => {
  const lu = avecLecture([errno('EAGAIN'), errno('EAGAIN'), 'abc', errno('EAGAIN'), 'def', ''],
    () => lireEntreeStandard({ delaiMs: 1000, pasMs: 1 }));
  assert.strictEqual(lu, 'abcdef');
});

epreuve('B — un silence prolongé lève une erreur nommée, pas une chaîne vide', () => {
  assert.throws(() => avecLecture([errno('EAGAIN')], () => lireEntreeStandard({ delaiMs: 30, pasMs: 5 })),
    /entrée standard muette depuis 30 ms/);
});

epreuve('C — une autre erreur de lecture remonte telle quelle', () => {
  assert.throws(() => avecLecture([errno('EIO')], () => lireEntreeStandard({ delaiMs: 30, pasMs: 5 })),
    e => e.code === 'EIO');
});

epreuve('D — bout en bout : tube O_NONBLOCK, écrivain en retard, STALL rendu', () => {
  const marque = require('./outils/empreinte-progression.js').marque;
  const champs = ['--lot', 'LOT-EPREUVE', '--request', 'request-1.md', '--head', 'abc', '--gate-state', 'g',
    '--blocker', 'b', '--action-next', 'x -> y'];
  const emp = require('./outils/empreinte-progression.js').empreinte({
    lot: 'LOT-EPREUVE', request: 'request-1.md', head: 'abc', gate_state: 'g', blocker: 'b', action_next: 'x -> y' });
  const historique = `commentaire antérieur\n${marque(emp)}\n`;
  // Python ouvre le tube, le met en O_NONBLOCK côté lecteur, lance l'outil,
  // puis n'écrit qu'après 0,4 s : exactement la course du run 37927790518.
  const py = `
import os, fcntl, subprocess, sys, time
r, w = os.pipe()
fcntl.fcntl(r, fcntl.F_SETFL, fcntl.fcntl(r, fcntl.F_GETFL) | os.O_NONBLOCK)
p = subprocess.Popen([sys.argv[1], sys.argv[2]] + sys.argv[4:], stdin=r, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
os.close(r)
time.sleep(0.4)
os.write(w, sys.argv[3].encode()); os.close(w)
out = p.communicate()[0]
sys.stdout.write(out.decode()); sys.exit(p.returncode)
`;
  const r = spawnSync('python3', ['-c', py, process.execPath, path.join(RACINE, 'outils/empreinte-progression.js'),
    historique, '--json', ...champs, '--marques', '-'], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } });
  assert.ifError(r.error);
  assert.strictEqual(r.status, 0, `sortie ${r.status} :\n${r.stdout}${r.stderr}`);
  const j = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.strictEqual(j.anterieures, 1, 'la marque antérieure doit être comptée — une lecture vide la perdrait');
  assert.strictEqual(j.etat, 'FAST_TRACK_STALL');
});

epreuve('E — câblage : aucun lecteur de l’entrée standard ne contourne l’aide', () => {
  const dir = path.join(RACINE, 'outils');
  const fautifs = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'lire-entree.js')
    .filter(f => /readFileSync\(\s*(0|'\/dev\/stdin'|"\/dev\/stdin")/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepStrictEqual(fautifs, []);
  for (const f of ['empreinte-progression.js', 'relais-arbitre-openai.js']) {
    assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /lireEntreeStandard\(\)/, `${f} doit lire par l'aide`);
  }
});

console.log(`\nLecture d'entrée non bloquante — ${reussites} épreuve(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
