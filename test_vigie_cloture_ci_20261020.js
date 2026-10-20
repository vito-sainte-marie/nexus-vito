// R4 — vigie V1. GOV-R4-VIGIE-20261020, decision-1 (APPROVED_WITH_CONDITIONS, 5c882b64), condition 4 :
// « Épreuves rouges avant le code : silence sans clôture ; alerte avec une clôture conforme ; alerte de
// refus si la clôture n'est pas conforme ; aucune écriture. » + condition 1 (contents: read seul, O3 sans
// --appliquer) + condition 2 (échec du run avec annotation nommant le lot ; ni Telegram ni commentaire #28).
//
// Contrat de outils/vigie-cloture-ci.js (n'existe pas encore) : lance O3 en rapport, jamais --appliquer.
//   code 0, aucune ligne ::error  -> rien n'attend (silence)
//   code ≠ 0, ligne ::error nommant le lot -> une clôture attend (CONFORME) ou est refusée (REFUS <CODE>)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const RACINE = __dirname;
const OUTIL = 'outils/vigie-cloture-ci.js';
const RAIL = 'handoff-epreuve-vigie-20261020';
const BOT = ['user.name=github-actions[bot]', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
const HUMAIN = ['user.name=Humain', 'user.email=humain@invalid'];
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const horsCaches = (src) => !path.basename(src).startsWith('.');

// ── Faux GitHub : vrai serveur HTTP, processus séparé ───────────────────────────────────
const tmpApi = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-api-')));
const SERVEUR = `
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[2];
http.createServer((req, res) => {
  const id = (req.url.match(/\\/issues\\/comments\\/(\\d+)/) || [])[1];
  if (fs.existsSync(path.join(dir, 'MODE_500'))) { res.statusCode = 500; return res.end('{}'); }
  if (/\\/actions\\/runs\\/\\d+\\/jobs/.test(req.url)) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ jobs: [{ steps: [{ name: "Relais vers l'arbitre", conclusion: 'success' }] }] })); }
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
// `gh` factice : le garde de handoff.js (provenance.js) interroge l'API par `gh api` ; on l'aiguille
// vers le même faux serveur, sans toucher au réseau ni à handoff.js.
fs.mkdirSync(path.join(tmpApi, 'bin'));
fs.writeFileSync(path.join(tmpApi, 'bin', 'gh'), `#!/usr/bin/env node
const http = require('http');
const url = process.env.NEXUS_GITHUB_API + '/' + process.argv[3];
http.get(url, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { if (r.statusCode !== 200) { console.error('HTTP ' + r.statusCode); process.exit(1); } process.stdout.write(d); }); }).on('error', (e) => { console.error(e.message); process.exit(1); });
`, { mode: 0o755 });
const API_MORTE = 'http://127.0.0.1:1'; // rien n'écoute : connexion refusée

let seqCommentaire = 6300000000;
const nouveauCommentaire = (verdict, auteur = 'github-actions[bot]') => {
  const type = auteur === 'github-actions[bot]' ? 'Bot' : 'User';
  const id = ++seqCommentaire;
  const body = `Réponse de l'arbitre (épreuve)\n\n${verdict}\n\n<!-- nexus-arbitrage: abc123 -->`;
  fs.writeFileSync(path.join(tmpApi, `${id}.json`), JSON.stringify({ body, user: { login: auteur, type } }));
  return id;
};

// ── Fixtures de registre ────────────────────────────────────────────────────────────────
const demande = (lot, seq) => ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${lot}`, `seq: ${seq}`,
  'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD',
  'wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28',
  'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
  '---', '', `Demande ${seq}.`, ''].join('\n');

const verdictDe = (lot, request, { closes = 'true', conditions = 'aucune', stop = 'non', decision = 'APPROVED' } = {}) => [
  '## Décision', '', `**${decision}.** Clôture du lot.`, '', 'Relais : run 39475936778.', '', 'RAIL_LU: ' + 'a'.repeat(40), '',
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
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-')));
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
    try { return { code: 0, sortie: execFileSync('node', [path.join(clone, script), ...args], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: path.join(tmpApi, 'bin') + path.delimiter + process.env.PATH, NEXUS_HANDOFF_DIR: dir, NEXUS_GITHUB_API: API, ...envPlus } }) }; }
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


const ERREUR = (r, lot, motif) => {
  assert.notStrictEqual(r.code, 0, `échec du run attendu :\n${r.sortie}`);
  const l = r.sortie.split('\n').filter(x => x.startsWith('::error'));
  assert.ok(l.length >= 1, `annotation ::error attendue :\n${r.sortie}`);
  assert.ok(l.some(x => x.includes(lot)), `l'annotation doit nommer le lot ${lot} :\n${r.sortie}`);
  if (motif) assert.ok(l.some(x => x.includes(motif)), `l'annotation doit porter « ${motif} » :\n${r.sortie}`);
};
const SILENCE = (r) => {
  assert.strictEqual(r.code, 0, `succès attendu :\n${r.sortie}`);
  assert.ok(!/::error|::warning/.test(r.sortie), `aucune annotation attendue :\n${r.sortie}`);
};

epreuve('V1 — registre vide, ou clôture absente (closes:false) : silence, run vert, aucune écriture', () => {
  const b = banc();
  const avant = instantane(b);
  SILENCE(b.outil([]));
  INCHANGE(b, avant);
  const c = banc();
  ajouterLot(c, 'LOT-V-V1', { closes: 'false' });
  const a2 = instantane(c);
  SILENCE(c.outil([]));
  INCHANGE(c, a2);
});

epreuve('V2 — clôture conforme en attente : run en échec, annotation nommant le lot, rien consommé', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-V-V2');
  const avant = instantane(b);
  const r = b.outil([]);
  ERREUR(r, lot, 'consommation');
  INCHANGE(b, avant);
  assert.strictEqual(b.etat().lots[lot].statut, 'ATTENTE_DECISION', 'la vigie ne consomme pas');
  // Même état, deuxième passage : même alerte (le rappel naturel du run suivant), toujours sans écriture.
  ERREUR(b.outil([]), lot, 'consommation');
  INCHANGE(b, avant);
});

epreuve('V3 — clôture non conforme (non nue, altérée, API muette, deux candidats) : alerte de refus nommant le lot', () => {
  for (const [nom, opts, code] of [
    ['non nue', { conditions: 'Rédiger la suite' }, 'CLOTURE_NON_NUE'],
    ['altérée', { corpsAltere: true }, 'DECISION_ALTEREE'],
    ['commit humain', { commitPar: HUMAIN }, 'NON_ISSUE_DE_LA_CI'],
  ]) {
    const b = banc();
    const { lot } = ajouterLot(b, 'LOT-V-V3', opts);
    const avant = instantane(b);
    const r = b.outil([]);
    ERREUR(r, lot, 'refus');
    assert.ok(r.sortie.includes(code), `${nom} : le code ${code} doit figurer :\n${r.sortie}`);
    INCHANGE(b, avant);
  }
  const m = banc();
  const { lot } = ajouterLot(m, 'LOT-V-V3M');
  const a = instantane(m);
  const r = m.outil([], { NEXUS_GITHUB_API: API_MORTE });
  ERREUR(r, lot, 'refus');
  assert.ok(r.sortie.includes('SOURCE_INJOIGNABLE'), r.sortie);
  INCHANGE(m, a);
  const d = banc();
  ajouterLot(d, 'LOT-V-V3A');
  ajouterLot(d, 'LOT-V-V3B');
  const ad = instantane(d);
  const rd = d.outil([]);
  ERREUR(rd, 'LOT-V-V3A', 'refus');
  assert.ok(rd.sortie.includes('LOT-V-V3B') && rd.sortie.includes('AMBIGUITE'), rd.sortie);
  INCHANGE(d, ad);
});

epreuve('V4 — aucune écriture : ni registre, ni commit, ni push, même option --appliquer passée à la vigie', () => {
  const b = banc();
  const { lot } = ajouterLot(b, 'LOT-V-V4');
  const avant = instantane(b);
  const d0 = execFileSync('git', ['ls-remote', b.distant], { encoding: 'utf8' });
  const r = b.outil(['--appliquer']);
  ERREUR(r, lot, 'consommation');
  assert.ok(!/^CONSOMME\b/m.test(r.sortie), `la vigie ne doit jamais consommer :\n${r.sortie}`);
  INCHANGE(b, avant);
  assert.strictEqual(b.refsDistant().split('\n').filter(Boolean).length, d0.split('\n').filter(Boolean).length, 'le dépôt distant a reçu un push');
  assert.strictEqual(d0, '', 'le distant du banc est vide au départ');
  assert.strictEqual(b.etat().lots[lot].statut, 'ATTENTE_DECISION');
});

const WORKFLOW = path.join(RACINE, '.github', 'workflows', 'vigie-cloture.yml');
epreuve('V5 — workflow : horaire, contents: read seul, sans secret, sans écriture, sans Telegram ni commentaire #28', () => {
  assert.ok(fs.existsSync(WORKFLOW), 'workflow .github/workflows/vigie-cloture.yml absent');
  const y = fs.readFileSync(WORKFLOW, 'utf8');
  const code = y.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  assert.ok(/^on:/m.test(code) && /schedule:/.test(code), 'déclencheur schedule attendu');
  const crons = [...code.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.strictEqual(crons.length, 1, `un seul cron attendu : ${crons}`);
  assert.ok(/^\d{1,2} \* \* \* \*$/.test(crons[0]), `fréquence horaire attendue (« M * * * * ») : ${crons[0]}`);
  const perm = code.match(/^permissions:\s*\n((?:[ \t]+\S.*\n?)+)/m);
  assert.ok(perm, 'bloc permissions: de premier niveau attendu');
  assert.deepStrictEqual(perm[1].split('\n').map(s => s.trim()).filter(Boolean), ['contents: read']);
  assert.ok(!/^\s{2,}permissions:/m.test(code), 'aucune permission par job');
  assert.ok(!/secrets\./i.test(code) && !/GITHUB_TOKEN|GH_TOKEN/.test(code.replace(/GITHUB_[A-Z_]+/g, m => (m === 'GITHUB_TOKEN' ? m : ''))), 'aucun secret ni jeton explicite');
  assert.ok(!/--appliquer/.test(code), 'O3 sans --appliquer');
  assert.ok(!/telegram|issues\/28|gh (issue|pr) |git (push|commit)|workflow_dispatch|pull_request|\bpush:/i.test(code), 'ni Telegram, ni commentaire, ni écriture, ni autre déclencheur');
  assert.ok(/vigie-cloture-ci\.js/.test(code), 'le workflow lance la vigie');
  assert.ok(/actions\/checkout@/.test(code), 'checkout attendu');
  assert.ok(/persist-credentials:\s*false/.test(code), 'le jeton ne doit pas rester dans git');
});

epreuve('V6 — le script de vigie n\'écrit nulle part : pas de --appliquer, pas de git/gh en écriture, pas de fs en écriture', () => {
  const f = path.join(RACINE, OUTIL);
  assert.ok(fs.existsSync(f), `${OUTIL} absent`);
  const s = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/['"]--appliquer['"]/.test(s), 'la vigie ne passe jamais --appliquer à O3');
  assert.ok(!/writeFile|appendFile|mkdir|rmSync|unlink|rename|copyFile|\bcommit\b|\bpush\b|issues\/|api\.telegram/i.test(s), 'aucune écriture');
});

console.log(`\n${total - echecs}/${total} épreuves`);
process.exit(echecs ? 1 : 0);
