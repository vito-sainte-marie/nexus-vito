// Tour vide et consommation avant action — INC-20261015-001, lot 1 (15/10/2026).
//
// Le 15/10, decision-1 et decision-2 de NEXUS-FDJ-STOCK-Q1-ABSENT-20261015 ont
// été « consommées » par une session qui n'a rien exécuté : DECISION_CONSOMMEE
// ne signifiait plus « exécutée », et la garde de tour vide (« le rail a-t-il
// bougé ? ») était aveuglée par le commit de consommation lui-même.
//
// Chaque épreuve tourne dans un clone jetable (`git clone --shared`) : le
// registre réel n'est jamais touché. L'outil éprouvé est celui de l'arbre de
// travail. Les scénarios portent le numéro de la mission (0..16) ; ceux qui
// dépendent des lots 2 (OPERATIONS) ou 3 (branches lot/<id>) ne sont PAS ici.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-TOURVIDE-20261015';
const RAIL = 'handoff-epreuve-tourvide-20261015';
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');

const demande = (seq) => ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD', 'wake_to: ChatGPT',
  'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
  '---', '', `Demande ${seq}.`, ''].join('\n');
const decision = (seq, closes) => ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: ChatGPT', `branch: ${RAIL}`, 'decision: APPROVED_WITH_CONDITIONS', `closes: ${closes}`,
  `in_reply_to: request-${seq}.md`, 'wake_to: Claude', '---', '', 'Décision.', ''].join('\n');

function banc({ closes = false } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tourvide-')));
  const clone = path.join(tmp, 'depot');
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, clone]);
  git(clone, 'checkout', '-q', git(RACINE, 'rev-parse', 'HEAD'));
  for (const [r, s] of refs) git(clone, 'update-ref', `refs/remotes/origin/${r}`, s);
  for (const f of ['outils', 'docs/skills']) { /* l'arbre de travail prime sur le commit */
    execFileSync('cp', ['-R', path.join(RACINE, f) + '/.', path.join(clone, f)]);
  }
  const dir = path.join(clone, 'registre-epreuve');
  fs.mkdirSync(path.join(dir, 'lots', LOT), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), demande(1));
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), decision(1, closes));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md', rail: RAIL } },
  }, null, 2) + '\n');
  const valider = (m) => { git(clone, 'add', '-A', '.'); git(clone, '-c', 'user.name=epreuve', '-c', 'user.email=epreuve@invalid', 'commit', '-q', '--allow-empty', '-m', m); return git(clone, 'rev-parse', 'HEAD'); };
  valider('registre d\'épreuve');
  const outil = (...a) => {
    try { return { code: 0, sortie: execFileSync('node', [path.join(clone, 'outils', 'handoff.js'), ...a], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) }; }
    catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
  };
  return { clone, dir, tmp, outil, valider, etat: () => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')) };
}
// Un commit de travail réel (hors registre), comme PROPRETE decision-1 (2a2f792e).
const travail = (b) => { fs.writeFileSync(path.join(b.clone, 'travail-reel.txt'), 'x\n'); return b.valider('travail réel'); };
// Un commit qui ne touche que le registre : celui de la consommation du 15/10 (ff3e7720).
const registreSeul = (b) => { const e = b.etat(); e.vu = Date.now(); fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); return b.valider('registre seul'); };

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const OK = (r) => assert.strictEqual(r.code, 0, r.sortie);
const KO = (r, motif) => { assert.notStrictEqual(r.code, 0, `refus attendu :\n${r.sortie}`); if (motif) assert.ok(motif.test(r.sortie), `motif ${motif} attendu :\n${r.sortie}`); };

// ── Anomalies ──────────────────────────────────────────────────────────────
epreuve('S0 — la consommation nue d\'une décision qui prescrit une action n\'est plus DECISION_CONSOMMEE', () => {
  const b = banc();
  const r = b.outil('consommer', LOT);
  assert.notStrictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE', `consommée sans preuve d'action :\n${r.sortie}`);
});
epreuve('S8 — la prise en charge pose ATTENTE_CONSOMMATION_DECISION, sans consomme_le', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'ATTENTE_CONSOMMATION_DECISION');
  assert.ok(!v.consomme_le, 'une prise en charge ne consomme pas');
  assert.strictEqual(v.derniere_decision, 'decision-1.md');
  assert.strictEqual(b.etat().lot_actif, LOT);
  OK(b.outil('verifier'));
});
epreuve('S9 — une preuve d\'action qui n\'est qu\'un commit de registre est refusée', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = registreSeul(b);
  KO(b.outil('consommer', LOT, '--preuve-action', sha), /PREUVE_ACTION|registre/i);
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
});
epreuve('S10 — une preuve d\'action réelle consomme et se consigne', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = travail(b);
  OK(b.outil('consommer', LOT, '--preuve-action', sha));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'DECISION_CONSOMMEE');
  assert.strictEqual(v.preuve_action, sha);
  assert.ok(v.consomme_le);
  OK(b.outil('verifier'));
});
epreuve('S12 — un arrêt matérialisé (nouvelle demande) consomme ; sans arrêt, la décision reste prise en charge', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  KO(b.outil('consommer', LOT, '--arret', 'request-2.md'));                  // l'option n'existe plus : un nom de fichier ne prouve rien
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
  const corps = path.join(b.tmp, 'corps.md'); fs.writeFileSync(corps, 'Blocage : capacité absente.\n\n## Preuve des conditions de decision-1\n\nAucune condition exécutée : capacité absente, rien n\'a été fait.\n');
  OK(b.outil('demande', LOT, corps, '--rail', RAIL, '--wake-to', 'ChatGPT'));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'ATTENTE_DECISION');
  assert.strictEqual(v.arret, 'request-2.md');
  assert.ok(v.consomme_le && !v.pris_en_charge_le);
  OK(b.outil('verifier'));
});
epreuve('S14 — action réussie mais consommation échouée : on reprend à la vérification, sans réexécuter', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = travail(b);
  KO(b.outil('consommer', LOT, '--preuve-action', 'deadbeef'));            // la consommation échoue
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
  const r = b.outil('consommer', LOT, '--prise-en-charge');                 // relance de la session : idempotente
  OK(r); assert.ok(/déjà pris en charge/i.test(r.sortie), r.sortie);
  OK(b.outil('consommer', LOT, '--preuve-action', sha));                    // reprise
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
const handoffVu = (b) => require(path.join(b.clone, 'outils', 'handoff.js')).echanges(LOT, 'decision').length === 1;
epreuve('S15a — le réveil ne relance pas un lot pris en charge comme une décision à consommer', () => {
  const b = banc();
  const e0 = b.etat(); Object.assign(e0.lots[LOT], { statut: 'ATTENTE_CONSOMMATION_DECISION', derniere_decision: 'decision-1.md' });
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e0, null, 2) + '\n');
  process.env.NEXUS_HANDOFF_DIR = b.dir; // handoff.js lit son répertoire au chargement
  const { examiner } = require(path.join(b.clone, 'outils', 'reveil-handoff.js'));
  const lots = examiner(b.etat());
  assert.ok(handoffVu(b), 'garde-fou : le registre d\'épreuve doit être celui que lit examiner');
  assert.ok(!lots.some(l => l.lot === LOT && l.motif === 'DECISION_NON_CONSOMMEE'), JSON.stringify(lots));
  assert.ok(lots.some(l => l.lot === LOT && l.motif === 'PRISE_EN_CHARGE'), 'le lot doit être nommé PRISE_EN_CHARGE : '+JSON.stringify(lots));
});
epreuve('S15b — un tour vide (seul le registre a bougé) est reconnu, jamais un tour avec travail', () => {
  const G = require(path.join(RACINE, 'outils', 'garde-boucle-autonome.js'));
  assert.strictEqual(typeof G.evaluerTourVide, 'function', 'evaluerTourVide absente');
  const registre = { commits: [{ sha: 'ff3e7720', fichiers: ['docs/handoff/STATE.json'] }], nouvellesDemandes: [] };
  const r1 = G.evaluerTourVide(registre);
  assert.strictEqual(r1.vide, true); assert.strictEqual(r1.code, 'TOUR_VIDE'); assert.strictEqual(r1.consommer, false);
  const travailReel = { commits: [{ sha: '2a2f792e', fichiers: ['outils/x.js', 'docs/handoff/STATE.json'] }], nouvellesDemandes: [] };
  assert.strictEqual(G.evaluerTourVide(travailReel).vide, false);
  const arret = { commits: [{ sha: 'a', fichiers: ['docs/handoff/STATE.json'] }], nouvellesDemandes: ['request-2.md'] };
  assert.strictEqual(G.evaluerTourVide(arret).vide, false, 'une demande de blocage est une sortie vérifiée');
});
epreuve('S15c — un tour vide identique ne se relance pas', () => {
  const G = require(path.join(RACINE, 'outils', 'garde-boucle-autonome.js'));
  assert.strictEqual(typeof G.cleActionStable, 'function', 'cleActionStable absente');
  const k = (o) => G.cleActionStable({ lot: LOT, decision: 'decision-1.md', rail: 'abc', ...o });
  assert.strictEqual(k({}), k({}));
  assert.notStrictEqual(k({}), k({ rail: 'def' }));
  assert.notStrictEqual(k({}), k({ decision: 'decision-2.md' }));
});
epreuve('S15d — le watchdog connaît la prise en charge et nomme le tour vide (sans le relancer)', () => {
  const W = require(path.join(RACINE, 'outils', 'watchdog-stagnation.js'));
  assert.ok(W.CONTINUATION.PRISE_EN_CHARGE, 'position PRISE_EN_CHARGE absente');
  assert.strictEqual(W.famille('TOUR_VIDE'), 'TOUR_VIDE');
  const r = W.examiner({ lot: LOT, sha: 'abc', branche: RAIL, position: 'PRISE_EN_CHARGE' });
  assert.notStrictEqual(r.code, 'POSITION_INCONNUE', JSON.stringify(r));
  assert.strictEqual(W.classerArret({ code: 'TOUR_VIDE' }).relance_permise, true, 'nommé, pas humain');
});

// ── Non-régression : doivent passer avant ET après ─────────────────────────
epreuve('S1 — décision de clôture (closes: true) : consommation directe, sans action', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT));
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
epreuve('S3 — une décision déjà consommée ne se rejoue pas', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT));
  KO(b.outil('consommer', LOT), /déjà marquée consommée/);
});
epreuve('S13 — une décision périmée ne se consomme pas', () => {
  const b = banc();
  fs.writeFileSync(path.join(b.dir, 'lots', LOT, 'request-2.md'), demande(2));
  const e = b.etat(); e.lots[LOT].derniere_demande = 'request-2.md';
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); b.valider('demande 2');
  KO(b.outil('consommer', LOT, '--prise-en-charge'), /périmée|demande active/);
});
epreuve('S16 — un registre invalide refuse toute prise en charge', () => {
  const b = banc();
  const e = b.etat(); e.lots[LOT].statut = 'N_IMPORTE_QUOI';
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); b.valider('registre cassé');
  KO(b.outil('consommer', LOT, '--prise-en-charge'));
});

console.log(`\n${total - echecs}/${total} scénarios`);
process.exit(echecs ? 1 : 0);
