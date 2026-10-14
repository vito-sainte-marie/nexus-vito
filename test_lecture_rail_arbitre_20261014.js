// Lecture du rail par l'arbitre — outil `lire_fichier` (option 3, GO de Frédéric
// du 14/10/2026). L'API OpenAI ne lit pas le dépôt : la CI lit pour elle, dans la
// base d'objets git au SHA du run, et refuse un verdict dont le `RAIL_LU` ne
// repose pas sur une lecture effective.
//
// Aucune épreuve ne touche le réseau : le `fetch` est substitué (préchargé par
// `node -r`) et JOUE une conversation d'outil. Chaque épreuve tourne dans un
// dépôt git jetable qui contient une copie des outils. Les mutations
// débranchent chaque garde dans cette copie : chacune doit rougir son épreuve.
'use strict';
// Des épreuves de mutation écrivent brièvement .mut-*.js dans le vrai outils/ : une copie
// concurrente les voit disparaître (ENOENT). Aucun fichier suivi ne commence par un point.
const horsMutants = (src) => !require('path').basename(src).startsWith('.');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync, execFileSync } = require('child_process');

const SRC = __dirname;
const LOT = 'LOT-EPREUVE-RAIL-20261014';
const REQ = 'request-1.md';
const CHEMINS = ['docs/handoff/STATE.json', `docs/handoff/lots/${LOT}/${REQ}`, 'docs/handoff/ARBITRAGES-ACQUIS.json'];
const CORPS = `Réveil.\n\nLOT_ID: \`${LOT}\`\nDemande en attente: \`${REQ}\`\n`;

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

// Un dépôt jetable : outils copiés, trois pièces du rail, un fichier hors de
// docs/handoff, un lien symbolique, un seul commit.
function depot(mutation) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rail-arbitre-')));
  fs.cpSync(path.join(SRC, 'outils'), path.join(d, 'outils'), { recursive: true, filter: horsMutants });
  const ecrire = (f, t) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); };
  fs.mkdirSync(path.join(d, 'docs/skills/nexus-handoff-fast-track'), { recursive: true });
  ecrire('docs/handoff/ARBITRAGES-ACQUIS.json', '{"arbitrages":[]}\n');
  ecrire('docs/handoff/STATE.json', '{"rail":"handoff-epreuve","marque":"STATE-COMMITE"}\n');
  ecrire(`docs/handoff/lots/${LOT}/${REQ}`, '# demande de l\'épreuve\n');
  ecrire('docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md', 'Tu es l\'arbitre indépendant.\n');
  ecrire('secret.txt', 'HORS-PERIMETRE\n');
  fs.symlinkSync('/etc/hosts', path.join(d, 'docs/handoff/lien'));
  git(d, 'init', '-q'); git(d, 'add', '-A'); git(d, 'commit', '-qm', 'epreuve');
  if (mutation) {
    const cible = path.join(d, 'outils', mutation.fichier);
    const s = fs.readFileSync(cible, 'utf8');
    assert.strictEqual(s.split(mutation.ancre).length, 2, `ancre de mutation non unique : ${JSON.stringify(mutation.ancre)}`);
    fs.writeFileSync(cible, s.replace(mutation.ancre, mutation.remplace));
  }
  return d;
}

const CONTRAT = (sha, champs) => {
  const c = { DECISION: 'APPROVED', CLOSES: 'false', LOT, REQUEST: REQ, HEAD: sha, LEASE: 'aucun', GATE_STATE: 'GREEN',
    PROOF_STATE: 'PROOF_VALID', CONDITIONS: 'aucune', BLOCKER: 'aucun', STOP_REQUIRED: 'aucun', CAPACITE_REQUISE: 'aucune',
    OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'Claude', ACTION_NEXT: 'matérialiser', ...champs };
  return `RAIL_LU: ${sha}\nNEXT_ACTION_CONTRACT\n` + Object.entries(c).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
};

// Joue : tour 1 = les lectures demandées ; tour 2 = la réponse finale.
// `reponse` reçoit le SHA réel du dépôt. La trace garde ce que la CI a rendu.
function relais(d, { lectures, reponse, env }) {
  const sha = git(d, 'rev-parse', 'HEAD');
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rail-fetch-')));
  const trace = path.join(tmp, 'sorties.json');
  const faux = path.join(tmp, 'faux-fetch.js');
  fs.writeFileSync(faux, `let tour = 0;
    global.fetch = async (url, o) => {
      const b = JSON.parse(o.body);
      if (tour++ === 0) return { ok: true, status: 200, json: async () => ({ output: JSON.parse(process.env.FAUX_LECTURES).map((c, i) => (
        { type: 'function_call', call_id: 'c' + i, name: 'lire_fichier', arguments: JSON.stringify({ chemin: c }) })) }) };
      require('fs').writeFileSync(${JSON.stringify(trace)}, JSON.stringify(b.input.filter(x => x.type === 'function_call_output').map(x => JSON.parse(x.output))));
      return { ok: true, status: 200, json: async () => ({ output_text: process.env.FAUX_TEXTE }) };
    };\n`);
  const propre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(OPENAI_API_KEY|NEXUS_RELAIS_|GITHUB_SHA)/.test(k)));
  const p = spawnSync('node', ['-r', faux, path.join(d, 'outils', 'relais-arbitre-openai.js')], {
    cwd: d, input: CORPS, encoding: 'utf8',
    env: { ...propre, NEXUS_RELAIS_OPENAI: 'arme', OPENAI_API_KEY: 'cle-factice', FAUX_LECTURES: JSON.stringify(lectures), FAUX_TEXTE: reponse(sha), ...env },
  });
  return { code: p.status, stdout: p.stdout, stderr: p.stderr, sha, sorties: fs.existsSync(trace) ? JSON.parse(fs.readFileSync(trace, 'utf8')) : null };
}

// ── L. Une lecture conforme ───────────────────────────────────────────────
epreuve('L1 — trois pièces lues, RAIL_LU = SHA du run : code 0, contenu réel rendu à l\'arbitre', () => {
  const d = depot();
  const p = relais(d, { lectures: CHEMINS, reponse: sha => CONTRAT(sha) });
  assert.strictEqual(p.code, 0, p.stderr);
  assert.ok(p.stdout.startsWith(`RAIL_LU: ${p.sha}`), p.stdout);
  assert.strictEqual(p.sorties.length, 3);
  assert.ok(p.sorties.every(s => s.sha === p.sha), 'chaque lecture doit porter le SHA réel');
  assert.ok(p.sorties[0].contenu.includes('STATE-COMMITE'), 'le contenu doit être celui du fichier');
});

// ── A. Un fichier absent ──────────────────────────────────────────────────
epreuve('A1 — pièce absente + verdict APPROVED : refusé (2), la lecture en défaut est nommée', () => {
  const d = depot();
  const p = relais(d, { lectures: [CHEMINS[0], CHEMINS[1], 'docs/handoff/ARBITRAGES-ACQUIS-ABSENT.json'], reponse: sha => CONTRAT(sha) });
  assert.strictEqual(p.code, 2, p.stderr);
  assert.ok(/fichier absent du rail/.test(p.stderr) && /ARBITRAGES-ACQUIS\.json n'a pas été lu/.test(p.stderr), p.stderr);
});
epreuve('A2 — pièce absente + NEEDS_EVIDENCE : l\'arrêt est admis (0)', () => {
  const d = depot();
  const p = relais(d, { lectures: ['docs/handoff/ABSENT.json'], reponse: () => 'RAIL_LU: INACCESSIBLE\n' + CONTRAT('x', { DECISION: 'NEEDS_EVIDENCE' }).split('\n').slice(1).join('\n') });
  assert.strictEqual(p.code, 0, p.stderr);
  assert.ok(/NEEDS_EVIDENCE/.test(p.stdout));
});

// ── I. Les chemins interdits ──────────────────────────────────────────────
const INTERDITS = ['secret.txt', '../etc/passwd', 'docs/handoff/../../secret.txt', '/etc/passwd', 'docs/handoffX/STATE.json',
  'docs/handoff//STATE.json', '.git/config', 'docs/handoff/lien', 'docs\\handoff\\STATE.json', 'docs/handoff/STATE.json\0.txt', '', 'docs/handoff'];
epreuve('I1 — chemins interdits : aucun contenu n\'est rendu', () => {
  const d = depot();
  const rail = require(path.join(d, 'outils', 'lecture-rail-arbitre.js'));
  const s = rail.creer(d, git(d, 'rev-parse', 'HEAD'));
  for (const c of INTERDITS) {
    const r = s.lire(c);
    assert.ok(r.erreur && !('contenu' in r), `${JSON.stringify(c)} aurait dû être refusé : ${JSON.stringify(r).slice(0, 80)}`);
  }
  assert.strictEqual(s.lus.size, 0);
});
epreuve('I2 — l\'outil n\'est pas un shell : un chemin à métacaractères reste un chemin', () => {
  const d = depot();
  const rail = require(path.join(d, 'outils', 'lecture-rail-arbitre.js'));
  const s = rail.creer(d, git(d, 'rev-parse', 'HEAD'));
  assert.ok(s.lire('docs/handoff/$(touch pwned).json').erreur);
  assert.ok(!fs.existsSync(path.join(d, 'pwned')));
});

// ── S. SHA divergent ──────────────────────────────────────────────────────
epreuve('S1 — GITHUB_SHA ≠ tête du checkout : rien n\'est envoyé, panne (1)', () => {
  const d = depot();
  const p = relais(d, { lectures: CHEMINS, reponse: sha => CONTRAT(sha), env: { GITHUB_SHA: 'a'.repeat(40) } });
  assert.strictEqual(p.code, 1, p.stderr);
  assert.ok(/diverge|≠ tête du checkout/.test(p.stderr), p.stderr);
  assert.strictEqual(p.sorties, null, 'une requête est partie malgré la divergence');
});
epreuve('S2 — RAIL_LU annoncé ≠ SHA lu : refusé (2)', () => {
  const d = depot();
  const p = relais(d, { lectures: CHEMINS, reponse: () => CONTRAT('b'.repeat(40)) });
  assert.strictEqual(p.code, 2, p.stderr);
  assert.ok(/RAIL_LU .* ≠ SHA du run/.test(p.stderr), p.stderr);
});
epreuve('S3 — APPROVED avec RAIL_LU: INACCESSIBLE alors que l\'outil existe : refusé (2)', () => {
  const d = depot();
  const p = relais(d, { lectures: CHEMINS, reponse: sha => CONTRAT(sha).replace(`RAIL_LU: ${sha}`, 'RAIL_LU: INACCESSIBLE') });
  assert.strictEqual(p.code, 2, p.stderr);
  assert.ok(/exige le SHA complet/.test(p.stderr), p.stderr);
});
epreuve('S4 — la CI de matérialisation refuse un RAIL_LU qui n\'est pas le SHA du run', () => {
  const m = require('./outils/materialiser-decision-ci.js');
  const refus = m.lectureDuRail(CONTRAT('c'.repeat(40)), { HEAD: 'c'.repeat(40) }, { shaDuRun: 'd'.repeat(40), shaDuRail: 'd'.repeat(40) });
  assert.ok(refus.length >= 1 && refus.some(r => /≠ SHA du run/.test(r)), JSON.stringify(refus));
  assert.deepStrictEqual(m.lectureDuRail(CONTRAT('d'.repeat(40)), { HEAD: 'd'.repeat(40) }, { shaDuRun: 'd'.repeat(40), shaDuRail: 'd'.repeat(40) }), []);
});

// ── W. Le worktree bouge pendant l'épreuve ────────────────────────────────
epreuve('W1 — fichier modifié (non commité) : l\'arbitre reçoit la version du SHA, pas celle du disque', () => {
  const d = depot();
  fs.writeFileSync(path.join(d, CHEMINS[0]), '{"marque":"DISQUE-MODIFIE"}\n');
  const p = relais(d, { lectures: CHEMINS, reponse: sha => CONTRAT(sha) });
  assert.strictEqual(p.code, 0, p.stderr);
  assert.ok(p.sorties[0].contenu.includes('STATE-COMMITE') && !p.sorties[0].contenu.includes('DISQUE-MODIFIE'), JSON.stringify(p.sorties[0]));
});
epreuve('W2 — la tête avance après la lecture : le verdict est refusé', () => {
  const d = depot();
  const rail = require(path.join(d, 'outils', 'lecture-rail-arbitre.js'));
  const sha = git(d, 'rev-parse', 'HEAD');
  const s = rail.creer(d, sha);
  for (const c of CHEMINS) s.lire(c);
  const c = { DECISION: 'APPROVED' };
  assert.deepStrictEqual(rail.controlerLecture(c, sha, s, CHEMINS), []);
  fs.writeFileSync(path.join(d, 'docs/handoff/STATE.json'), '{}\n'); git(d, 'commit', '-qam', 'bouge');
  assert.ok(rail.controlerLecture(c, sha, s, CHEMINS).some(r => /tête du checkout a changé/.test(r)));
  assert.ok(s.lire(CHEMINS[0]).erreur, 'une lecture après divergence doit échouer');
});

// ── M. Mutations : chaque garde débranchée doit rougir son épreuve ────────
function rougit(nom, mutation, preuve) {
  epreuve(`M — ${nom}`, () => {
    const d = depot(mutation); // une ancre introuvable lève ici, hors du try : pas de faux rouge
    let rougi = false;
    try { preuve(d); } catch (e) { rougi = true; }
    assert.ok(rougi, 'la mutation n\'a rougi aucune épreuve : la garde ne garde rien');
  });
}
rougit('sans le filtre de chemin, I1 rougit',
  { fichier: 'lecture-rail-arbitre.js', ancre: '    const refus = cheminValide(chemin);\n    if (refus) return echec(chemin, refus);\n', remplace: '' },
  d => { const s = require(path.join(d, 'outils', 'lecture-rail-arbitre.js')).creer(d, git(d, 'rev-parse', 'HEAD'));
    for (const c of INTERDITS) { const r = s.lire(c); if (!r.erreur) throw new Error('lu'); } });
rougit('en lisant le disque au lieu de l\'objet git, W1 rougit',
  { fichier: 'lecture-rail-arbitre.js', ancre: "const contenu = git(['cat-file', 'blob', `${sha}:${chemin}`]);", remplace: "const contenu = require('fs').readFileSync(require('path').join(racine, chemin));" },
  d => { fs.writeFileSync(path.join(d, CHEMINS[0]), 'DISQUE-MODIFIE\n');
    const r = require(path.join(d, 'outils', 'lecture-rail-arbitre.js')).creer(d, git(d, 'rev-parse', 'HEAD')).lire(CHEMINS[0]);
    if (r.contenu.includes('DISQUE-MODIFIE')) throw new Error('disque servi'); });
rougit('sans le contrôle de lecture dans le relais, A1 rougit',
  { fichier: 'relais-arbitre-openai.js', ancre: '  if (v.ok) v.refus.push(...rail.controlerLecture(', remplace: '  if (false) v.refus.push(...rail.controlerLecture(' },
  d => { const p = relais(d, { lectures: [CHEMINS[0]], reponse: sha => CONTRAT(sha) }); if (p.code !== 2) throw new Error('accepté'); });
rougit('sans la comparaison GITHUB_SHA / tête, S1 rougit',
  { fichier: 'relais-arbitre-openai.js', ancre: '  if (sha !== tete) throw', remplace: '  if (false) throw' },
  d => { const p = relais(d, { lectures: CHEMINS, reponse: sha => CONTRAT(sha), env: { GITHUB_SHA: 'a'.repeat(40) } }); if (p.code !== 1) throw new Error('envoyé'); });

console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
