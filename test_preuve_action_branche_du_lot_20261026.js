// --preuve-action borné à la branche du lot — OUTILLAGE-REGULARISATION-20261026, decision-1
// condition 2 (en réponse à request-1 §2, INC-17adb4e168a9).
//
// Le 26/10, `--preuve-action 72216ec1` a été acceptée pour l'action de decision-2 de
// PRISE-DE-POSTE-UN-ECRAN-20261025 : `72216ec1` est la fiche d'incident INC-74839140d278,
// pas l'action — qui vivait (`246b5765`) sur la branche de travail du lot,
// `prise-de-poste-un-ecran-20261025`. L'ancienne garde (`commitHorsRegistre`) n'exigeait
// qu'une ascendance au rail courant : n'importe quel commit du rail touchant un fichier
// hors registre passait, sans lien avec l'action prescrite.
//
// Correction : une décision peut déclarer sa branche de travail dans son CORPS (jamais
// dans l'enveloppe YAML, qui reste fixée à `branch: <rail>` par `brancheRailValide` —
// ceci n'ajoute aucun champ au protocole `nexus-handoff/2`) :
//
//   BRANCHE_DU_LOT: prise-de-poste-un-ecran-20261025
//
// Absente — comme sur TOUTE décision déposée avant ce correctif — la branche du lot EST
// le rail : rien ne change, cas voisin gardé vert (N1). Présente, le SHA doit être
// ancêtre de `origin/<branche>`, jamais seulement du rail (R1/V1) ; une branche absente
// d'origin refuse explicitement, avant toute écriture (B1). Un SHA inconnu refuse de
// toute façon (I1). Les deux vrais SHA de l'incident servent de fixtures, réels, présents
// dans l'historique partagé par le clone --shared : aucun besoin de les rejouer.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-BRANCHE-DU-LOT-20261026';
const RAIL = 'handoff-epreuve-branche-du-lot-20261026';
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');

// Fixtures réelles (INC-17adb4e168a9-note.md, request-1 de OUTILLAGE-REGULARISATION-20261026).
const RAIL_SEUL = '72216ec1b129d2e407f9e41d1b32e675fc7954a5';      // fiche d'incident : sur le rail, PAS sur la branche du lot
const ACTION_REELLE = '246b5765583202757ba5cf539fc9a9e3332a0577'; // l'action réelle : sur la branche du lot, pas (encore) sur le rail
const BRANCHE_REELLE = 'prise-de-poste-un-ecran-20261025';
const SHA_INCONNU = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

const demande = (seq) => ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD', 'wake_to: ChatGPT',
  'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
  '---', '', `Demande ${seq}.`, ''].join('\n');
const decision = (seq, { closes = false, brancheDuLot } = {}) => ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: ChatGPT', `branch: ${RAIL}`, 'decision: APPROVED_WITH_CONDITIONS', `closes: ${closes}`,
  `in_reply_to: request-${seq}.md`, 'wake_to: Claude', '---', '', 'Décision.', '',
  ...(brancheDuLot ? [`BRANCHE_DU_LOT: ${brancheDuLot}`, ''] : [])].join('\n');

function banc({ closes = false, brancheDuLot } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'branche-du-lot-')));
  const clone = path.join(tmp, 'depot');
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, clone]);
  git(clone, 'checkout', '-q', git(RACINE, 'rev-parse', 'HEAD'));
  for (const [r, s] of refs) git(clone, 'update-ref', `refs/remotes/origin/${r}`, s);
  for (const f of ['outils', 'docs/skills']) {
    fs.cpSync(path.join(RACINE, f), path.join(clone, f), { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
  }
  const dir = path.join(clone, 'registre-epreuve');
  fs.mkdirSync(path.join(dir, 'lots', LOT), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), demande(1));
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), decision(1, { closes, brancheDuLot }));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md', rail: RAIL } },
  }, null, 2) + '\n');
  const valider = (m) => { git(clone, 'add', '-A', '.'); git(clone, '-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-q', '--allow-empty', '-m', m); return git(clone, 'rev-parse', 'HEAD'); };
  valider('registre d\'épreuve');
  const outil = (...a) => {
    try { return { code: 0, sortie: execFileSync('node', [path.join(clone, 'outils', 'handoff.js'), ...a], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) }; }
    catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
  };
  return { clone, dir, tmp, outil, valider, etat: () => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')) };
}
const travail = (b) => { fs.writeFileSync(path.join(b.clone, 'travail-reel.txt'), 'x\n'); return b.valider('travail réel'); };
const pointerBranche = (b, nom, sha) => git(b.clone, 'update-ref', `refs/remotes/origin/${nom}`, sha);

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const OK = (r) => assert.strictEqual(r.code, 0, r.sortie);
const KO = (r, motif) => { assert.notStrictEqual(r.code, 0, `refus attendu :\n${r.sortie}`); if (motif) assert.ok(motif.test(r.sortie), `motif ${motif} attendu :\n${r.sortie}`); };

epreuve('R1 — RED : un commit du rail seul est refusé quand la décision déclare BRANCHE_DU_LOT', () => {
  const b = banc({ brancheDuLot: BRANCHE_REELLE });
  pointerBranche(b, BRANCHE_REELLE, ACTION_REELLE);
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const r = b.outil('consommer', LOT, '--preuve-action', RAIL_SEUL);
  KO(r, /PREUVE_ACTION_HORS_BRANCHE_DU_LOT/);
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION', 'aucune écriture de consommation sur un refus');
});
epreuve('V1 — vert : un commit réellement ancêtre de la branche du lot est accepté', () => {
  const b = banc({ brancheDuLot: BRANCHE_REELLE });
  pointerBranche(b, BRANCHE_REELLE, ACTION_REELLE);
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  OK(b.outil('consommer', LOT, '--preuve-action', ACTION_REELLE));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'DECISION_CONSOMMEE');
  assert.strictEqual(v.preuve_action, ACTION_REELLE);
});
epreuve('I1 — un SHA inconnu est refusé même avec BRANCHE_DU_LOT déclarée', () => {
  const b = banc({ brancheDuLot: BRANCHE_REELLE });
  pointerBranche(b, BRANCHE_REELLE, ACTION_REELLE);
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const r = b.outil('consommer', LOT, '--preuve-action', SHA_INCONNU);
  KO(r, /commit introuvable/);
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
});
epreuve('B1 — une branche du lot déclarée mais absente d\'origin refuse explicitement, avant toute écriture', () => {
  const b = banc({ brancheDuLot: 'branche-qui-n-existe-pas-du-tout-20261026' });
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const avant = fs.readFileSync(path.join(b.dir, 'STATE.json'), 'utf8');
  const r = b.outil('consommer', LOT, '--preuve-action', ACTION_REELLE);
  KO(r, /BRANCHE_DU_LOT_INTROUVABLE/);
  assert.strictEqual(fs.readFileSync(path.join(b.dir, 'STATE.json'), 'utf8'), avant, 'refus = aucune écriture');
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
});
epreuve('N1 — cas voisin vert : sans BRANCHE_DU_LOT, un commit du rail est accepté comme avant (branche du lot = rail)', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = travail(b);
  OK(b.outil('consommer', LOT, '--preuve-action', sha));
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
epreuve('N2 — cas voisin vert : --cloture reste inchangé', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT));
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
epreuve('N3 — cas voisin vert : --prise-en-charge reste idempotente', () => {
  const b = banc({ brancheDuLot: BRANCHE_REELLE });
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const r = b.outil('consommer', LOT, '--prise-en-charge');
  OK(r); assert.ok(/déjà pris en charge/i.test(r.sortie), r.sortie);
});
epreuve('M1 — mutation : neutraliser la vérification d\'ascendance fait mordre R1 (sans la garde, RAIL_SEUL passerait)', () => {
  const { commitHorsRegistre } = require(path.join(RACINE, 'outils', 'handoff.js'));
  // Contrôle pur, outil intact : le vrai historique du dépôt tranche R1/V1 sans clone.
  const rSeul = commitHorsRegistre(RAIL_SEUL, BRANCHE_REELLE);
  assert.strictEqual(rSeul.ok, false, 'RAIL_SEUL doit être refusé quand BRANCHE_DU_LOT est déclarée');
  assert.strictEqual(rSeul.code, 'PREUVE_ACTION_HORS_BRANCHE_DU_LOT');
  const rAction = commitHorsRegistre(ACTION_REELLE, BRANCHE_REELLE);
  assert.strictEqual(rAction.ok, true, `l'action réelle doit être ancêtre de origin/${BRANCHE_REELLE} :\n${JSON.stringify(rAction)}`);
  const rSansMarqueur = commitHorsRegistre(RAIL_SEUL, null);
  assert.strictEqual(rSansMarqueur.ok, true, 'sans BRANCHE_DU_LOT, un commit du rail reste accepté (cas voisin)');

  const SRC = fs.readFileSync(path.join(RACINE, 'outils', 'handoff.js'), 'utf8');
  const ancre = "try { git('merge-base', '--is-ancestor', sha, cible); } catch (e) { return { ok: false, code, motif: `${sha.slice(0, 7)} n'est pas dans l'historique de ${cible}` }; }";
  assert.strictEqual(SRC.split(ancre).length, 2, 'ancre de mutation unique');
  const MUT = path.join(RACINE, 'outils', '.mut-handoff-branche-du-lot.js');
  fs.writeFileSync(MUT, SRC.replace(ancre, "try { } catch (e) { return { ok: false, code, motif: 'inatteignable' }; }"));
  try {
    const mute = require(MUT);
    const r = mute.commitHorsRegistre(RAIL_SEUL, BRANCHE_REELLE);
    assert.strictEqual(r.ok, true, 'sans la garde, RAIL_SEUL est accepté à tort : R1 rougirait');
  } finally { fs.rmSync(MUT, { force: true }); delete require.cache[MUT]; }
});

console.log(`\n${total - echecs}/${total} épreuves`);
process.exit(echecs ? 1 : 0);
