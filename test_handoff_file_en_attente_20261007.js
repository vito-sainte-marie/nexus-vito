// La file `docs/handoff/en-attente/` a un consommateur — 07/10/2026.
//
// FAST-TRACK-ANTI-PAUSE-1-20261007 attendait dans la file « jusqu'à la
// fermeture de GOUVERNANCE-REFERENCE-CODE-20261005 ». GOUVERNANCE s'est fermée
// (decision-6, closes: true) et rien n'a publié le corps : aucun outil ne
// lisait la file, aucune garde ne voyait que la condition était remplie.
//
// `consommer` exige un vrai commit de la décision : chaque épreuve tourne donc
// dans un clone jetable (`git clone --shared`), avec un registre minimal
// commité sous NEXUS_HANDOFF_DIR, à l'intérieur du clone. Le registre réel
// n'est jamais touché.
//
// Les mutations débranchent l'aide plutôt que de la casser : on retire l'appel
// dans `consommer`, puis l'appel dans `verifier`, et l'épreuve principale
// correspondante doit rougir.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const PRECEDENT = 'LOT-PRECEDENT-20261007';
const SUIVANT = 'LOT-SUIVANT-20261007';
const RAIL = 'handoff-epreuve-file-20261007';
const APPEL_CONSOMMER = '  const publication = publierEnAttente(); if (publication) process.exit(publication);\n';
const APPEL_VERIFIER = '  signalerFileEnAttente(etat);\n';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');

function demande(lot, seq) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${lot}`, `seq: ${seq}`,
    'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD', 'wake_to: ChatGPT',
    'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
    '---', '', `Demande ${seq} de ${lot}.`, ''].join('\n');
}
function decision(lot, seq, closes) {
  return ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${lot}`, `seq: ${seq}`,
    'author: ChatGPT', `branch: ${RAIL}`, 'decision: APPROVED', `closes: ${closes}`,
    `in_reply_to: request-${seq}.md`, 'wake_to: Claude', '---', '', 'Décision.', ''].join('\n');
}

// Un clone jetable portant un registre où PRECEDENT attend la consommation de
// sa décision, et où SUIVANT attend dans la file.
function banc({ closes = true, consomme = false, marque = true, nomFile = `${SUIVANT}-request-1.md`, mutation } = {}) {
  // realpath : sous macOS /var est un lien vers /private/var, et git refuse un
  // chemin relatif calculé depuis le lien (« outside repository »).
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-file-')));
  const clone = path.join(tmp, 'depot');
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, clone]);
  git(clone, 'checkout', '-q', git(RACINE, 'rev-parse', 'HEAD'));
  for (const [r, s] of refs) git(clone, 'update-ref', `refs/remotes/origin/${r}`, s);
  // L'outil sous épreuve est celui de l'arbre de travail, pas celui du commit.
  let source = fs.readFileSync(path.join(RACINE, 'outils', 'handoff.js'), 'utf8');
  if (mutation) { assert.strictEqual(source.split(mutation).length, 2, `ancre de mutation non unique : ${JSON.stringify(mutation)}`); source = source.replace(mutation, ''); }
  fs.writeFileSync(path.join(clone, 'outils', 'handoff.js'), source);
  const dir = path.join(clone, 'registre-epreuve');
  fs.mkdirSync(path.join(dir, 'lots', PRECEDENT), { recursive: true });
  fs.mkdirSync(path.join(dir, 'en-attente'));
  fs.writeFileSync(path.join(dir, 'lots', PRECEDENT, 'request-1.md'), demande(PRECEDENT, 1));
  fs.writeFileSync(path.join(dir, 'lots', PRECEDENT, 'decision-1.md'), decision(PRECEDENT, 1, closes));
  fs.writeFileSync(path.join(dir, 'en-attente', nomFile), (marque ? '<!-- en-attente wake_to: ChatGPT -->\n' : '') + '# Corps en attente\n\nTravail prouvé.\n');
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: PRECEDENT,
    lots: { [PRECEDENT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md', rail: RAIL } },
  }, null, 2) + '\n');
  git(clone, 'add', '-A', 'registre-epreuve');
  git(clone, '-c', 'user.name=epreuve', '-c', 'user.email=epreuve@invalid', 'commit', '-q', '-m', 'registre d\'épreuve');
  const b = { clone, dir, tmp, outil: (...a) => executer(clone, dir, a) };
  if (consomme) { const r = b.outil('consommer', PRECEDENT); b.consommation = r; }
  return b;
}
function executer(clone, dir, args) {
  try { return { code: 0, sortie: execFileSync('node', [path.join(clone, 'outils', 'handoff.js'), ...args], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) }; }
  catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}
const lire = (b, ...p) => fs.readFileSync(path.join(b.dir, ...p), 'utf8');
const existe = (b, ...p) => fs.existsSync(path.join(b.dir, ...p));
const etat = b => JSON.parse(lire(b, 'STATE.json'));

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

// ── A. Le cas du 07/10 ────────────────────────────────────────────────────
function preuvePrincipale(b) {
  const r = b.outil('consommer', PRECEDENT);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(existe(b, 'lots', SUIVANT, 'request-1.md'), `la décision closes: true doit publier la file :\n${r.sortie}`);
  const publie = lire(b, 'lots', SUIVANT, 'request-1.md');
  assert.ok(/^wake_to: ChatGPT$/m.test(publie), 'wake_to porté par la marque');
  assert.ok(new RegExp(`^branch: ${RAIL}$`, 'm').test(publie), 'rail hérité du lot qui a libéré le registre');
  assert.ok(!/en-attente wake_to/.test(publie), 'la marque de file ne doit pas être publiée');
  assert.ok(/Travail prouvé\./.test(publie), 'le corps est publié tel quel');
  assert.ok(!existe(b, 'en-attente', `${SUIVANT}-request-1.md`), 'l\'entrée publiée quitte la file');
  const e = etat(b);
  assert.strictEqual(e.lot_actif, SUIVANT);
  assert.strictEqual(e.lots[SUIVANT].statut, 'ATTENTE_DECISION');
  assert.strictEqual(e.lots[SUIVANT].rail, RAIL);
  assert.strictEqual(e.lots[PRECEDENT].statut, 'DECISION_CONSOMMEE');
  const v = b.outil('verifier');
  assert.strictEqual(v.code, 0, v.sortie);
}
epreuve('A1 — consommer une décision closes: true publie la file par `demande` et la vide', () => preuvePrincipale(banc()));

// ── B. Ce que la file ne doit pas faire, et ce que la garde doit voir ──────
epreuve('B1 — closes: false rend la main au lot : la file attend, verifier reste vert', () => {
  const b = banc({ closes: false });
  const r = b.outil('consommer', PRECEDENT);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!existe(b, 'lots', SUIVANT), 'la suite d\'un lot non fermé lui revient');
  assert.ok(/reste en attente/.test(r.sortie), r.sortie);
  const v = b.outil('verifier');
  assert.strictEqual(v.code, 0, v.sortie);
});
function preuveGarde(b) {
  // État du rail au 07/10 : lot fermé et consommé, file non vidée.
  const e = etat(b); e.lots[PRECEDENT] = { ...e.lots[PRECEDENT], statut: 'DECISION_CONSOMMEE', derniere_decision: 'decision-1.md' };
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n');
  const v = b.outil('verifier');
  assert.notStrictEqual(v.code, 0, `une file qui attend une condition remplie doit rougir :\n${v.sortie}`);
  assert.ok(/attend alors que plus aucun lot n'occupe le registre/.test(v.sortie), v.sortie);
  return b;
}
epreuve('B2 — file oubliée après fermeture : verifier rougit, publier-en-attente répare', () => {
  const b = preuveGarde(banc());
  const p = b.outil('publier-en-attente');
  assert.strictEqual(p.code, 0, p.sortie);
  assert.ok(existe(b, 'lots', SUIVANT, 'request-1.md'));
  const v = b.outil('verifier');
  assert.strictEqual(v.code, 0, v.sortie);
});
epreuve('B3 — une entrée sans marque wake_to est malformée, jamais publiée', () => {
  const b = banc({ marque: false });
  const v = b.outil('verifier');
  assert.notStrictEqual(v.code, 0, v.sortie);
  assert.ok(/en-attente wake_to/.test(v.sortie), v.sortie);
  const p = b.outil('publier-en-attente');
  assert.notStrictEqual(p.code, 0, p.sortie);
  assert.ok(!existe(b, 'lots', SUIVANT));
});
epreuve('B4 — un numéro de demande faux est refusé, l\'entrée reste dans la file', () => {
  const b = preuveGarde(banc({ nomFile: `${SUIVANT}-request-2.md` }));
  const p = b.outil('publier-en-attente');
  assert.notStrictEqual(p.code, 0, p.sortie);
  assert.ok(/attend request-1/.test(p.sortie), p.sortie);
  assert.ok(existe(b, 'en-attente', `${SUIVANT}-request-2.md`));
  assert.ok(!existe(b, 'lots', SUIVANT));
});
epreuve('B5 — un lot encore actif garde la file fermée, sans rougir', () => {
  const b = banc();
  const p = b.outil('publier-en-attente');
  assert.strictEqual(p.code, 0, p.sortie);
  assert.ok(/est actif/.test(p.sortie), p.sortie);
  assert.ok(!existe(b, 'lots', SUIVANT));
  const v = b.outil('verifier');
  assert.strictEqual(v.code, 0, v.sortie);
});

// ── M. Débrancher l'aide ──────────────────────────────────────────────────
function doitRougir(nom, fn) {
  epreuve(nom, () => {
    let rouge = false;
    try { fn(); } catch (e) { rouge = true; }
    assert.ok(rouge, 'la mutation est restée verte : l\'épreuve ne mesure pas le câblage');
  });
}
doitRougir('M1 — sans l\'appel dans `consommer`, A1 rougit', () => preuvePrincipale(banc({ mutation: APPEL_CONSOMMER })));
doitRougir('M2 — sans l\'appel dans `verifier`, la garde de B2 rougit', () => preuveGarde(banc({ mutation: APPEL_VERIFIER })));

console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
