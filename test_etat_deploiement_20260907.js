// Épreuves de l'état de déploiement (outils/etat-deploiement.js).
//
// Deux enjeux, et le second est le plus important.
//
// D'abord la justesse des trois compteurs : ils seront lus en cinq secondes,
// et un chiffre faux dans un tableau de bord ne se discute pas — il se croit.
//
// Ensuite l'impuissance. Cet outil alimentera un écran portant un bouton
// « Autoriser la mise en Production ». Il doit être incapable, par
// construction, de déployer, de fusionner ou d'autoriser quoi que ce soit.
// L'épreuve de contrat de source ci-dessous existe pour que quiconque
// voudrait lui faire franchir cette ligne doive d'abord la faire sauter.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const OUTIL = path.join(__dirname, 'outils', 'etat-deploiement.js');
const { analyser, classer, fermePar } = require(OUTIL);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

function depot({ lots = {}, decisions = {}, stateBrut } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploiement-'));
  fs.mkdirSync(path.join(dir, 'docs', 'handoff', 'lots'), { recursive: true });
  for (const [lot, fichiers] of Object.entries(decisions)) {
    fs.mkdirSync(path.join(dir, 'docs', 'handoff', 'lots', lot), { recursive: true });
    for (const [nom, contenu] of Object.entries(fichiers)) {
      fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'lots', lot, nom), contenu);
    }
  }
  if (stateBrut !== undefined) {
    if (stateBrut !== null) fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'STATE.json'), stateBrut);
  } else {
    fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'STATE.json'),
      JSON.stringify({ protocol: 'nexus-handoff/2', lots }, null, 2));
  }
  return dir;
}

function lancer(dir, args) {
  const r = spawnSync('node', [OUTIL].concat(args || []), {
    encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir },
  });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

t('une décision DÉPOSÉE mais non consommée n’attend pas Frédéric', () => {
  // La distinction qui fait la valeur du compteur. Ce lot attend CLAUDE, pas
  // un arbitrage. Les confondre ferait clignoter « en attente de toi » pour du
  // travail qui n'a besoin de personne — et un compteur qui crie à tort finit
  // par ne plus être regardé du tout.
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: null }, ['decision-1.md']),
    'en_developpement');
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: 'decision-1.md' }, ['decision-1.md']),
    'attente_arbitrage');
  assert.strictEqual(
    classer({ statut: 'ATTENTE_DECISION', derniere_decision: null }, []),
    'attente_arbitrage', 'aucune décision déposée : celui-là attend bien un arbitrage');
});

t('les trois compteurs comptent ce qu’ils annoncent', () => {
  const dir = depot({
    lots: {
      'LOT-A': { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' },
      'LOT-B': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' },
      'LOT-C': { statut: 'ATTENTE_CONSOMMATION_DECISION' },
    },
  });
  const e = spawnSync('node', [OUTIL, '--json'], { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir } });
  const r = JSON.parse(e.stdout);
  assert.strictEqual(r.compteurs.attente_arbitrage, 1);
  assert.strictEqual(r.compteurs.en_developpement, 1);
  assert.strictEqual(r.compteurs.clos, 1);
});

t('« ferme le lot » se lit dans la décision, pas dans le statut', () => {
  const dir = depot({
    lots: { 'LOT-A': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' } },
    decisions: { 'LOT-A': { 'decision-1.md': '---\ncloses: true\n---\n' } },
  });
  const e = JSON.parse(spawnSync('node', [OUTIL, '--json'],
    { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir } }).stdout);
  assert.strictEqual(e.lots[0].ferme, true);

  const dir2 = depot({
    lots: { 'LOT-A': { statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' } },
    decisions: { 'LOT-A': { 'decision-1.md': '---\ncloses: false\n---\n' } },
  });
  const e2 = JSON.parse(spawnSync('node', [OUTIL, '--json'],
    { encoding: 'utf8', env: { ...process.env, NEXUS_DEPOT: dir2 } }).stdout);
  assert.strictEqual(e2.lots[0].ferme, false, 'closes:false ne ferme pas un lot');
});

t('un STATE.json absent échoue au lieu d’afficher « rien en cours »', () => {
  // Le mode de panne d'un tableau de bord : afficher zéro partout et laisser
  // conclure que tout est calme.
  const r = lancer(depot({ stateBrut: null }));
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
  assert.ok(/Ne rien conclure de cette absence/.test(r.sortie), r.sortie);
});

t('un STATE.json illisible échoue de la même façon', () => {
  const r = lancer(depot({ stateBrut: '{ pas du json' }));
  assert.notStrictEqual(r.code, 0);
  assert.ok(/INDISPONIBLE/.test(r.sortie), r.sortie);
});

t('CONTRAT — l’outil est incapable d’écrire, de fusionner ou de déployer', () => {
  // Il alimentera un écran portant un bouton « Autoriser la mise en
  // Production ». Son impuissance doit être structurelle, pas promise.
  const source = fs.readFileSync(OUTIL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const interdits = [
    /['"]push['"]/, /['"]merge['"]/, /['"]-X['"]/, /['"]workflow['"]/,
    /['"]commit['"]/, /['"]checkout['"]/, /writeFileSync/, /appendFileSync/, /rmSync/, /unlinkSync/,
  ];
  const trouves = interdits.filter(re => re.test(source)).map(re => re.source);
  assert.deepStrictEqual(trouves, [],
    'aucun verbe d’écriture ne doit exister dans cet outil : ' + trouves.join(', '));
});

t('sur le dépôt RÉEL, l’absence de barrière est dite, pas tue', () => {
  // Au 07/09/2026 `production` n'a ni protection de branche ni environnement
  // d'approbation. Un état de déploiement qui tairait cela transformerait un
  // tableau de bord en fausse assurance.
  const r = spawnSync('node', [OUTIL], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/Barrières techniques devant Production/.test(r.stdout), r.stdout);
  assert.ok(/branche `production` protégée/.test(r.stdout), r.stdout);
  assert.ok(/PROPOSITION/.test(r.stdout),
    '« prêt pour Production » ne doit jamais se lire comme une autorisation');
  if (/protégée : NON/.test(r.stdout)) {
    assert.ok(/un simple `git push` atteint Production/.test(r.stdout),
      'quand la barrière manque, il faut le dire en clair : ' + r.stdout);
  }
});

console.log(`\n${passes}/${passes} vérifications passées — l’état se calcule, il ne s’autorise pas.`);
