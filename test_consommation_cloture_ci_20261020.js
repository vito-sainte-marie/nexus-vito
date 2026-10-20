// O3 — consommation d'une clôture déposée par la CI. GOV-R3-CONSOMMATION-CLOTURE-20261020,
// decision-1 (APPROVED_WITH_CONDITIONS, 1c020c21) : « G1–G10 sont écrites et constatées rouges
// avant l'implémentation ».
//
// Contrat de l'outil que ces épreuves fixent (il n'existe pas encore : outils/consommer-clotures-ci.js) :
//   node outils/consommer-clotures-ci.js [--appliquer]      (cwd = racine du dépôt, NEXUS_HANDOFF_DIR honoré)
//   NEXUS_GITHUB_API = base de l'API (défaut https://api.github.com) ; le commentaire se lit en
//   GET <base>/repos/<o>/<r>/issues/comments/<id> -> { body, user: { login } }.
//   Sortie : une ligne par constat, un code stable en tête de ligne :
//     CANDIDAT <lot> | CONFORME <lot> | CONSOMME <lot> | RIEN_A_CONSOMMER | AMBIGUITE
//     | REFUS <CODE> <lot> | VERIFIER_AVANT OK | VERIFIER_APRES OK
//   Code de sortie 0 : rapport, consommation faite, ou rien à faire. Non nul : refus ou arrêt.
//   Sans --appliquer : AUCUNE écriture. Avec : prise en charge puis --cloture (handoff.js), commits locaux
//   limités à docs/handoff/, jamais de push.
//
// Chaque épreuve tourne dans un clone jetable ; l'API est un vrai serveur HTTP local (processus
// séparé), pas un doublon injecté dans l'outil. Chaque refus est asserté PAR SON CODE : un outil absent
// ou muet ne peut donc pas passer pour un refus correct.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const RACINE = __dirname;
const OUTIL = 'outils/consommer-clotures-ci.js';
const RAIL = 'handoff-epreuve-o3-20261020';
const BOT = ['user.name=github-actions[bot]', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
const HUMAIN = ['user.name=Humain', 'user.email=humain@invalid'];
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const horsCaches = (src) => !path.basename(src).startsWith('.');

// ── Faux GitHub : vrai serveur HTTP, processus séparé ───────────────────────────────────
const tmpApi = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'o3-api-')));
const SERVEUR = `
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[2];
http.createServer((req, res) => {
  const id = (req.url.match(/\\/issues\\/comments\\/(\\d+)/) || [])[1];
  if (fs.existsSync(path.join(dir, 'MODE_500'))) { res.statusCode = 500; return res.end('{}'); }
  const f = id && path.join(dir, id + '.json');
  if (!f || !fs.existsSync(f)) { res.statusCode = 404; return res.end('{}'); }
  res.setHeader('content-type', 'application/json'); res.end(fs.readFileSync(f));
}).listen(0, '127.0.0.1', function () { fs.writeFileSync(path.join(dir, 'PORT'), String(this.address().port)); });
`;
fs.writeFileSync(path.join(tmpApi, 'serveur.js'), SERVEUR);
const serveur = spawn('node', [path.join(tmpApi, 'serveur.js'), tmpApi], { stdio: 'ignore' });
process.on('exit', () => { try { serveur.kill(); } catch (_) { /* déjà arrêté */ } });
for (let i = 0; i < 100 && !fs.existsSync(path.join(tmpApi, 'PORT')); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
const PORT = fs.readFileSync(path.join(tmpApi, 'PORT'), 'utf8');
const API = `http://127.0.0.1:${PORT}`;
const API_MORTE = 'http://127.0.0.1:1'; // rien n'écoute : connexion refusée

let seqCommentaire = 6300000000;
const nouveauCommentaire = (verdict, auteur = 'github-actions[bot]') => {
  const id = ++seqCommentaire;
  const body = `Réponse de l'arbitre (épreuve)\n\n${verdict}\n\n<!-- nexus-arbitrage: abc123 -->`;
  fs.writeFileSync(path.join(tmpApi, `${id}.json`), JSON.stringify({ body, user: { login: auteur } }));
  return id;
};

// ── Fixtures de registre ────────────────────────────────────────────────────────────────
const demande = (lot, seq) => ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${lot}`, `seq: ${seq}`,
  'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD',
  'wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28',
  'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
  '---', '', `Demande ${seq}.`, ''].join('\n');

const verdictDe = (lot, request, { closes = 'true', conditions = 'aucune', stop = 'non', decision = 'APPROVED' } = {}) => [
  '## Décision', '', `**${decision}.** Clôture du lot.`, '', 'RAIL_LU: ' + 'a'.repeat(40), '',
  'NEXT_ACTION_CONTRACT', `DECISION: ${decision}`, `CLOSES: ${closes}`, `LOT: ${lot}`, `REQUEST: ${request}`,
  `HEAD: ${'a'.repeat(40)}`, 'LEASE: aucun', 'GATE_STATE: G1', 'PROOF_STATE: PROOF_VALID', `CONDITIONS: ${conditions}`,
  'BLOCKER: aucun', `STOP_REQUIRED: ${stop}`, 'CAPACITE_REQUISE: aucune', 'OWNER_NEXT: Claude',
  'EXECUTANT_NEXT: aucun', 'ACTION_NEXT: Matérialiser la clôture.'].join('\n');

const decisionFichier = (lot, { reponse = 'request-1.md', closes = 'true', verdict, commentaireId, auteur = 'ChatGPT', mode = 'github_actions_relay', decision = 'APPROVED', corpsAltere = false }) => {
  const corps = corpsAltere ? verdict.replace('Clôture du lot.', 'Clôture du lot (modifiée).') : verdict;
  return ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${lot}`, 'seq: 1', `author: ${auteur}`,
    `branch: ${RAIL}`, `decision: ${decision}`, `closes: ${closes}`, `in_reply_to: ${reponse}`,
    'provenance:', '  niveau: 2', `  mode: ${mode}`,
    `  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-${commentaireId}`,
    '---', '', '# Décision', '', "## Texte de l'arbitre", '', corps, ''].join('\n');
};

// Un lot « candidat » : demande, décision de clôture issue de la CI, commentaire source concordant.
function ajouterLot(b, lot, opts = {}) {
  const { commitPar = BOT, requetes = 1, reponse = 'request-1.md', closes = 'true', conditions, stop, corpsAltere, auteur, mode, auteurCommentaire } = opts;
  const verdict = verdictDe(lot, reponse, { closes, conditions, stop });
  const id = nouveauCommentaire(verdict, auteurCommentaire);
  const dossier = path.join(b.dir, 'lots', lot);
  fs.mkdirSync(dossier, { recursive: true });
  for (let n = 1; n <= requetes; n++) fs.writeFileSync(path.join(dossier, `request-${n}.md`), demande(lot, n));
  fs.writeFileSync(path.join(dossier, 'decision-1.md'), decisionFichier(lot, { reponse, closes, verdict, commentaireId: id, corpsAltere, auteur, mode }));
  const etat = JSON.parse(fs.readFileSync(path.join(b.dir, 'STATE.json'), 'utf8'));
  etat.lots[lot] = { statut: 'ATTENTE_DECISION', derniere_demande: `request-${requetes}.md`, rail: RAIL };
  etat.lot_actif = lot;
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(etat, null, 2) + '\n');
  b.valider(`lot ${lot}`, commitPar);
  return { lot, id, verdict };
}

function banc() {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'o3-')));
  const clone = path.join(tmp, 'depot');
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, clone]);
  git(clone, 'checkout', '-q', git(RACINE, 'rev-parse', 'HEAD'));
  for (const [r, s] of refs) git(clone, 'update-ref', `refs/remotes/origin/${r}`, s);
  fs.cpSync(path.join(RACINE, 'outils'), path.join(clone, 'outils'), { recursive: true, filter: horsCaches });
  fs.cpSync(path.join(RACINE, 'docs', 'skills'), path.join(clone, 'docs', 'skills'), { recursive: true, filter: horsCaches });
  // Le push, s'il avait lieu, irait dans ce dépôt nu : on le surveille.
  const distant = path.join(tmp, 'distant.git');
  execFileSync('git', ['init', '-q', '--bare', distant]);
  git(clone, 'remote', 'set-url', '--push', 'origin', distant);
  const dir = path.join(clone, 'registre-epreuve');
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lot_actif: null, lots: {} }, null, 2) + '\n');
  const valider = (m, identite = BOT) => { git(clone, 'add', '-A', '.'); git(clone, '-c', identite[0], '-c', identite[1], 'commit', '-q', '--allow-empty', '-m', m); return git(clone, 'rev-parse', 'HEAD'); };
  const lancer = (script, args, envPlus = {}) => {
    try { return { code: 0, sortie: execFileSync('node', [path.join(clone, script), ...args], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir, NEXUS_GITHUB_API: API, ...envPlus } }) }; }
    catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
  };
  const b = { clone, dir, tmp, distant, valider,
    outil: (args = [], envPlus) => lancer(OUTIL, args, envPlus),
    handoff: (...a) => lancer('outils/handoff.js', a),
    etat: () => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')),
    octetsEtat: () => fs.readFileSync(path.join(dir, 'STATE.json')),
    head: () => git(clone, 'rev-parse', 'HEAD'),
    propre: () => git(clone, 'status', '--porcelain'),
    refsDistant: () => execFileSync('git', ['--git-dir', distant, 'for-each-ref'], { encoding: 'utf8' }) };
  valider('amorce', BOT);
  return b;
}

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const CODE = (r, code, lot) => {
  assert.notStrictEqual(r.code, 0, `arrêt attendu (code ≠ 0) :\n${r.sortie}`);
  assert.ok(new RegExp(`^REFUS ${code}\\b${lot ? ' ' + lot : ''}`, 'm').test(r.sortie), `ligne « REFUS ${code}${lot ? ' ' + lot : ''} » attendue :\n${r.sortie}`);
};
const INCHANGE = (b, avant) => {
  assert.strictEqual(b.head(), avant.head, 'un commit a été fait');
  assert.ok(avant.etat.equals(b.octetsEtat()), 'STATE.json a changé');
  assert.strictEqual(b.propre(), '', 'l\'arbre de travail a changé');
};
const instantane = (b) => ({ head: b.head(), etat: b.octetsEtat() });

// ── G1 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G1 — clôture CI conforme, source concordante : consommée, DECISION_CONSOMMEE, verifier vert', () => {
  const b = banc();
  const { lot, id } = ajouterLot(b, 'LOT-O3-G1');
  assert.strictEqual(b.handoff('verifier').code, 0, 'le banc doit être un registre valide avant l\'appel');
  const avant = b.head();
  const r = b.outil(['--appliquer']);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(new RegExp(`^CONSOMME ${lot}\\b`, 'm').test(r.sortie), r.sortie);
  assert.ok(/^VERIFIER_AVANT OK/m.test(r.sortie) && /^VERIFIER_APRES OK/m.test(r.sortie), `verifier avant/après attendu :\n${r.sortie}`);
  const v = b.etat().lots[lot];
  assert.strictEqual(v.statut, 'DECISION_CONSOMMEE');
  assert.strictEqual(v.derniere_decision, 'decision-1.md');
  assert.strictEqual(b.handoff('verifier').code, 0, 'verifier doit rester vert après');
  // Traçabilité : le commit nomme la décision, l'empreinte vérifiée et le commentaire source.
  const messages = git(b.clone, 'log', '--format=%B', `${avant}..HEAD`);
  assert.ok(/decision-1\.md/.test(messages), `le commit nomme la décision :\n${messages}`);
  assert.ok(new RegExp(`issuecomment-${id}`).test(messages), `le commit nomme le commentaire source :\n${messages}`);
  assert.ok(/sha256[: ]+[0-9a-f]{64}/i.test(messages), `le commit porte l'empreinte :\n${messages}`);
});

// ── G2 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G2 — décision altérée après dépôt (empreinte divergente) : refus, aucun changement', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-O3-G2', { corpsAltere: true });
  const avant = instantane(b);
  CODE(b.outil(['--appliquer']), 'DECISION_ALTEREE', lot);
  INCHANGE(b, avant);
  assert.strictEqual(b.etat().lots[lot].statut, 'ATTENTE_DECISION');
});

// ── G3 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G3 — API injoignable ou en erreur : arrêt explicite, aucun changement', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-O3-G3');
  const avant = instantane(b);
  CODE(b.outil(['--appliquer'], { NEXUS_GITHUB_API: API_MORTE }), 'SOURCE_INJOIGNABLE', lot);
  INCHANGE(b, avant);
  fs.writeFileSync(path.join(tmpApi, 'MODE_500'), '1');
  try { CODE(b.outil(['--appliquer']), 'SOURCE_INJOIGNABLE', lot); } finally { fs.unlinkSync(path.join(tmpApi, 'MODE_500')); }
  INCHANGE(b, avant);
});

// ── G4 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G4 — décision non issue de la CI (commit humain, provenance humaine, commentaire d\'un autre auteur) : jamais consommée', () => {
  for (const [nom, opts] of [
    ['commit humain', { commitPar: HUMAIN }],
    ['provenance humaine', { mode: 'recopie_humaine' }],
    ['commentaire d\'un autre auteur', { auteurCommentaire: 'un-humain' }],
  ]) {
    const b = banc();
    const { lot } = ajouterLot(b, 'LOT-O3-G4', opts);
    const avant = instantane(b);
    const r = b.outil(['--appliquer']);
    assert.notStrictEqual(r.code, 0, `${nom} : arrêt attendu\n${r.sortie}`);
    assert.ok(new RegExp(`^REFUS (NON_ISSUE_DE_LA_CI|SOURCE_INADMISSIBLE) ${lot}\\b`, 'm').test(r.sortie), `${nom} : refus coté attendu\n${r.sortie}`);
    INCHANGE(b, avant);
  }
});

// ── G5 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G5 — closes:false : sans effet ; condition ou palier Frédéric dans le contrat : refus, jamais consommée', () => {
  const faux = banc();
  const l1 = ajouterLot(faux, 'LOT-O3-G5A', { closes: 'false' });
  const avant1 = instantane(faux);
  const r1 = faux.outil(['--appliquer']);
  assert.strictEqual(r1.code, 0, r1.sortie);
  assert.ok(/^RIEN_A_CONSOMMER/m.test(r1.sortie), `RIEN_A_CONSOMMER attendu :\n${r1.sortie}`);
  INCHANGE(faux, avant1);
  assert.strictEqual(faux.etat().lots[l1.lot].statut, 'ATTENTE_DECISION');

  for (const [nom, opts] of [
    ['condition', { conditions: 'Rédiger la suite avant la clôture' }],
    ['palier Frédéric', { stop: 'PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION' }],
  ]) {
    const b = banc();
    const { lot } = ajouterLot(b, 'LOT-O3-G5B', opts);
    const avant = instantane(b);
    CODE(b.outil(['--appliquer']), 'CLOTURE_NON_NUE', lot);
    INCHANGE(b, avant);
    assert.ok(nom, nom);
  }
});

// ── G6 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G6 — décision qui ne répond pas à la demande active : refus', () => {
  const b = banc();
  // La demande active est request-2 ; la décision (et son commentaire) répondent à request-1.
  const { lot } = ajouterLot(b, 'LOT-O3-G6', { requetes: 2, reponse: 'request-1.md' });
  const avant = instantane(b);
  CODE(b.outil(['--appliquer']), 'HORS_DEMANDE_ACTIVE', lot);
  INCHANGE(b, avant);
});

// ── G7 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G7 — deuxième appel : sans effet (idempotence)', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-O3-G7');
  const un = b.outil(['--appliquer']);
  assert.strictEqual(un.code, 0, un.sortie);
  assert.strictEqual(b.etat().lots[lot].statut, 'DECISION_CONSOMMEE', 'le premier appel doit consommer');
  const avant = instantane(b);
  const deux = b.outil(['--appliquer']);
  assert.strictEqual(deux.code, 0, deux.sortie);
  assert.ok(/^RIEN_A_CONSOMMER/m.test(deux.sortie), `RIEN_A_CONSOMMER attendu :\n${deux.sortie}`);
  INCHANGE(b, avant);
});

// ── G8 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G8 — deux lots candidats : arrêt sans modification', () => {
  const b = banc();
  ajouterLot(b, 'LOT-O3-G8A');
  ajouterLot(b, 'LOT-O3-G8B');
  const avant = instantane(b);
  const r = b.outil(['--appliquer']);
  assert.notStrictEqual(r.code, 0, r.sortie);
  assert.ok(/^AMBIGUITE\b/m.test(r.sortie), `AMBIGUITE attendu :\n${r.sortie}`);
  INCHANGE(b, avant);
  for (const l of ['LOT-O3-G8A', 'LOT-O3-G8B']) assert.strictEqual(b.etat().lots[l].statut, 'ATTENTE_DECISION');
});

// ── G9 ───────────────────────────────────────────────────────────────────────────────────
epreuve('G9 — rapport par défaut : aucune écriture', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-O3-G9');
  const avant = instantane(b);
  const r = b.outil([]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(new RegExp(`^CANDIDAT ${lot}\\b`, 'm').test(r.sortie) && new RegExp(`^CONFORME ${lot}\\b`, 'm').test(r.sortie), `CANDIDAT + CONFORME attendus :\n${r.sortie}`);
  assert.ok(!/^CONSOMME\b/m.test(r.sortie), 'le rapport ne consomme pas');
  INCHANGE(b, avant);
});

// ── G10 ──────────────────────────────────────────────────────────────────────────────────
epreuve('G10 — jamais de push ; seuls des fichiers de docs/handoff/ (dont STATE.json) sont touchés', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-O3-G10');
  const avant = b.head();
  const distantAvant = b.refsDistant();
  const r = b.outil(['--appliquer']);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.strictEqual(b.etat().lots[lot].statut, 'DECISION_CONSOMMEE', 'sans consommation, la garde de périmètre ne prouve rien');
  const touches = git(b.clone, 'diff', '--name-only', `${avant}..HEAD`).split('\n').filter(Boolean);
  assert.ok(touches.length > 0, 'aucun fichier touché');
  for (const f of touches) assert.ok(f.startsWith('registre-epreuve/') || f.startsWith('docs/handoff/'), `fichier hors registre touché : ${f}`);
  assert.ok(touches.some(f => f.endsWith('STATE.json')), `STATE.json attendu parmi : ${touches}`);
  assert.strictEqual(b.refsDistant(), distantAvant, 'le dépôt distant a reçu un push');
  assert.strictEqual(b.propre(), '', 'l\'outil laisse des fichiers non commités');
});

console.log(`\n${total - echecs}/${total} épreuves`);
process.exit(echecs ? 1 : 0);
