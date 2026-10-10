// Le lot actif ne déplace pas le rail en silence — 10/10/2026.
//
// Le 10/10 à 03:14Z, `enregistrer-lot` sans `--rail` a rendu actif un lot
// lu sur la branche historique. `handoff.js rail` a alors répondu
// config-par-environnement, et chaque push de handoff-continuite-20260920
// s'est cru hors du rail : la matérialisation stade (a) du run 38046356168
// a été sautée en run vert. Chaque épreuve mute une seule chose ; la
// mutation X1 débranche la garde dans une copie de l'outil et exige que
// les refus redeviennent des acceptations.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const RAIL = 'handoff-epreuve-rail-actif';
const ACTIF = 'LOT-ACTIF-SUR-RAIL-20261010';
const NOUVEAU = 'LOT-RAPATRIE-20261010';

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}
function demande(lot, branche) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${lot}`, 'seq: 1',
    'author: Frédéric Bragance', `branch: ${branche}`, 'status: AWAITING_DECISION',
    'token_mode: STANDARD', 'preuves:',
    '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
    '---', '', 'Corps.', ''].join('\n');
}
// Un registre dont le lot actif vit sur RAIL, plus un lot déposé
// directement sur la branche historique, pas encore enregistré.
function registre() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-rail-actif-'));
  for (const [lot, branche] of [[ACTIF, RAIL], [NOUVEAU, 'config-par-environnement']]) {
    fs.mkdirSync(path.join(dir, 'lots', lot), { recursive: true });
    fs.writeFileSync(path.join(dir, 'lots', lot, 'request-1.md'), demande(lot, branche));
  }
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: ACTIF,
    lots: { [ACTIF]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md', rail: RAIL } },
  }, null, 2) + '\n');
  return dir;
}
function executer(args, dir, outil = OUTIL) {
  try {
    const sortie = execFileSync('node', [outil, ...args],
      { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir, NEXUS_BASE_BRANCH: '', NEXUS_CLAUDE_BASE_BRANCH: '' } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}
const etat = dir => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));

let total = 0, passes = 0;
function verifier(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  OK — ${nom}`); }
  catch (e) { console.error(`  ÉCHEC — ${nom}\n    ${e.message}`); }
}

verifier('le témoin : le registre de départ désigne bien le rail', () => {
  const dir = registre();
  const r = executer(['rail'], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(r.sortie.trim(), RAIL);
});

verifier('enregistrer-lot sans --rail refuse de déplacer le rail du lot actif, et n\'écrit rien', () => {
  const dir = registre(), avant = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');
  const r = executer(['enregistrer-lot', NOUVEAU], dir);
  assert.notStrictEqual(r.code, 0, r.sortie);
  assert.ok(/sans que personne l'ait désigné/.test(r.sortie), r.sortie);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), avant, 'le registre ne doit pas bouger');
  assert.strictEqual(executer(['rail'], dir).sortie.trim(), RAIL);
});

verifier('enregistrer-lot avec --rail désigné est accepté, et le rail reste lisible', () => {
  const dir = registre();
  const r = executer(['enregistrer-lot', NOUVEAU, '--rail', RAIL], dir);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(etat(dir).lot_actif, NOUVEAU);
  assert.strictEqual(executer(['rail'], dir).sortie.trim(), RAIL);
});

verifier('rattraper-demande refuse d\'activer un lot inscrit sur un autre rail', () => {
  const dir = registre(), e = etat(dir);
  e.lots[NOUVEAU] = { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-0.md', rail: 'config-par-environnement' };
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n');
  const r = executer(['rattraper-demande', NOUVEAU], dir);
  assert.notStrictEqual(r.code, 0, r.sortie);
  assert.ok(/sans que personne l'ait désigné/.test(r.sortie), r.sortie);
  assert.strictEqual(etat(dir).lot_actif, ACTIF);
});

verifier('demande sans --rail sur un lot neuf refuse avant d\'écrire la moindre enveloppe', () => {
  const dir = registre(), corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, 'Corps.\n');
  const e = etat(dir); e.lots[ACTIF].statut = 'DECISION_CONSOMMEE';
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n');
  const r = executer(['demande', 'LOT-NEUF-20261010', corps], dir);
  assert.notStrictEqual(r.code, 0, r.sortie);
  assert.ok(/sans que personne l'ait désigné/.test(r.sortie), r.sortie);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', 'LOT-NEUF-20261010', 'request-1.md')), 'aucune enveloppe ne doit être déposée');
});

// X1 — débrancher la garde (pas la casser) : les trois refus doivent
// redevenir des acceptations, sinon les épreuves ci-dessus ne mesurent rien.
verifier('X1 : garde débranchée, enregistrer-lot redéplace le rail en silence', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  const appel = 'garderRailActif(etat, lot, rail, railDemande !== undefined);';
  assert.strictEqual(src.split(appel).length, 2, 'ancre de mutation non unique');
  const copie = path.join(RACINE, 'outils', `.handoff-mutant-${process.pid}.js`);
  fs.writeFileSync(copie, src.replace(appel, '/* garde débranchée */'));
  try {
    const dir = registre();
    const r = executer(['enregistrer-lot', NOUVEAU], dir, copie);
    assert.strictEqual(r.code, 0, r.sortie);
    assert.strictEqual(executer(['rail'], dir, copie).sortie.trim(), 'config-par-environnement', 'le mutant doit reproduire le défaut du 10/10');
  } finally { fs.unlinkSync(copie); }
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
