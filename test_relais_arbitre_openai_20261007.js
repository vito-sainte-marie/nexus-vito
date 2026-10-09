// Relais du réveil vers l'arbitre ChatGPT (API OpenAI) — 07/10/2026.
//
// FAST-TRACK-ANTI-PAUSE-1-20261007 : le réveil était posté sur #28, mais rien
// ne le portait jusqu'à ChatGPT, qui ne lit pas GitHub. Le relais est une étape
// de tests.yml, câblée sur GO de Frédéric (« GO câblage »), NON ARMÉE : le
// secret OPENAI_API_KEY et la variable NEXUS_RELAIS_OPENAI=arme restent ses
// gestes.
//
// Aucune épreuve ne touche le réseau : la voie armée tourne contre un `fetch`
// substitué (préchargé par `node -r`). Les mutations débranchent l'aide :
// on retire l'appel à `valider` dans la voie armée, puis l'appel au relais dans
// l'étape CI. Chacune doit rougir son épreuve.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-RELAIS-20261007';
const REQ = 'request-1.md';
const APPEL_VALIDER = '  const v = valider(texte, attendu);\n';
const APPEL_CI = '| env -u GH_TOKEN node outils/relais-arbitre-openai.js > reponse.txt';

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

const r = require('./outils/relais-arbitre-openai.js');
const ATTENDU = { lot: LOT, request: REQ };
function contrat(champs) {
  const c = { DECISION: 'APPROVED', CLOSES: 'false', LOT, REQUEST: REQ, HEAD: 'fe30802', LEASE: 'aucun',
    GATE_STATE: 'GREEN', PROOF_STATE: 'PROOF_VALID', CONDITIONS: 'aucune', BLOCKER: 'aucun',
    STOP_REQUIRED: 'aucun', CAPACITE_REQUISE: 'aucune',
    OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'github-actions-claude',
    ACTION_NEXT: 'matérialiser la décision', ...champs };
  return 'Analyse.\n\nNEXT_ACTION_CONTRACT\n' + Object.entries(c).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
}
const refuse = (texte, motif) => {
  const v = r.valider(texte, ATTENDU);
  assert.strictEqual(v.ok, false, `accepté à tort :\n${texte}`);
  assert.ok(v.refus.some(x => motif.test(x)), `motif ${motif} absent : ${v.refus.join(' / ')}`);
};

// ── V. Validation du contrat ─────────────────────────────────────────────
epreuve('V1 — un contrat complet, APPROVED, Claude : conforme', () => {
  const v = r.valider(contrat({}), ATTENDU);
  assert.ok(v.ok, v.refus.join(' / '));
});
epreuve('V2 — un verdict hors vocabulaire ou un champ manquant : refusé', () => {
  refuse(contrat({ DECISION: 'GO' }), /hors vocabulaire/);
  refuse(contrat({ LEASE: null }), /champ LEASE absent/);
  refuse(contrat({ CLOSES: 'peut-être' }), /CLOSES/);
});
epreuve('V3 — le vocabulaire est exactement celui que `handoff.js decision` accepte', () => {
  const { DECISIONS_CANONIQUES } = require('./outils/handoff.js');
  for (const d of DECISIONS_CANONIQUES) assert.ok(r.valider(contrat({ DECISION: d }), ATTENDU).ok, d);
  refuse(contrat({ DECISION: 'HOLD' }), /hors vocabulaire/);
  refuse(contrat({ DECISION: 'STOP_REQUIRED' }), /hors vocabulaire/);
});
epreuve('V4 — Frédéric n\'est réveillé que par BLOCKED et un code du palier', () => {
  refuse(contrat({ OWNER_NEXT: 'Frédéric', DECISION: 'APPROVED' }), /exige DECISION BLOCKED/);
  refuse(contrat({ OWNER_NEXT: 'Frédéric', DECISION: 'BLOCKED', STOP_REQUIRED: 'INQUIETUDE_VAGUE' }), /pas un motif du palier/);
  refuse(contrat({ OWNER_NEXT: 'Quelqu\'un' }), /OWNER_NEXT/);
  const code = require('./outils/escalade-humaine.js').chargerRegistre(RACINE).routage.frederic[0];
  assert.ok(r.valider(contrat({ OWNER_NEXT: 'Frédéric', DECISION: 'BLOCKED', STOP_REQUIRED: code }), ATTENDU).ok, code);
});
epreuve('V5 — LOT ou REQUEST différents du réveil : refusé', () => {
  refuse(contrat({ LOT: 'AUTRE-LOT' }), /LOT .* ≠ réveil/);
  refuse(contrat({ REQUEST: 'request-2.md' }), /REQUEST .* ≠ réveil/);
  assert.ok(r.valider(contrat({ LOT: `\`${LOT}\`` }), ATTENDU).ok, 'les backticks autour du lot sont tolérés');
});
epreuve('V6 — une mention de Claude : refusée (boucle)', () => {
  refuse(contrat({}) + '\n@Claude matérialise.\n', /mention de Claude/);
});
epreuve('V7 — le cas du 07/10 (« une demande attend ») : aucun contrat, refusé', () => {
  refuse('Une demande attend sur #28.\n', /aucun NEXT_ACTION_CONTRACT/);
});
epreuve('V8 — seul le DERNIER bloc fait foi : le gabarit cité plus haut ne vaut pas verdict', () => {
  const t = 'Gabarit :\nNEXT_ACTION_CONTRACT\nDECISION: <APPROVED|BLOCKED>\n\n' + contrat({ DECISION: 'NEEDS_EVIDENCE' });
  const v = r.valider(t, ATTENDU);
  assert.ok(v.ok, v.refus.join(' / '));
  assert.strictEqual(v.contrat.DECISION, 'NEEDS_EVIDENCE');
});

// ── A. Le relais lit le réveil que l'orchestrateur écrit ──────────────────
epreuve('A1 — LOT et demande se relisent dans le corps réel de `corpsReveil`', () => {
  const lots = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'relais-')));
  fs.mkdirSync(path.join(lots, LOT));
  fs.writeFileSync(path.join(lots, LOT, REQ), '---\nkind: request\n---\n\nDemande.\n');
  const corps = require('./outils/reveil-orchestrateur.js').corpsReveil({ reveil: true, lots: [{
    lot: LOT, demande: REQ, branche: 'handoff-epreuve', adresse: 'https://example.invalid/issues/28',
    adresse_source: REQ, refs_reelles: null, motif: 'DEMANDE_NON_ARBITREE', token_mode: 'STANDARD' }] },
  { lots, mention: false, integral: true });
  assert.deepStrictEqual(r.attenduDuReveil(corps), ATTENDU, 'le gabarit du réveil a changé sans le relais');
});

// ── N. Les verrous humains ────────────────────────────────────────────────
function relais(env, entree, mutation) {
  let racine = RACINE;
  if (mutation) {
    racine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'relais-mut-')));
    fs.cpSync(path.join(RACINE, 'outils'), path.join(racine, 'outils'), { recursive: true });
    for (const f of ['docs/handoff/ARBITRAGES-ACQUIS.json', 'docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md']) {
      fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
      fs.copyFileSync(path.join(RACINE, f), path.join(racine, f));
    }
    const cible = path.join(racine, 'outils', 'relais-arbitre-openai.js');
    const s = fs.readFileSync(cible, 'utf8');
    assert.strictEqual(s.split(mutation[0]).length, 2, `ancre de mutation non unique : ${JSON.stringify(mutation[0])}`);
    fs.writeFileSync(cible, s.replace(mutation[0], mutation[1]));
  }
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'relais-fetch-')));
  const trace = path.join(tmp, 'requete.json');
  const faux = path.join(tmp, 'faux-fetch.js');
  fs.writeFileSync(faux, `global.fetch = async (url, o) => {
    require('fs').writeFileSync(${JSON.stringify(trace)}, JSON.stringify({ url, headers: o.headers, body: JSON.parse(o.body) }));
    return { ok: true, status: 200, json: async () => ({ output_text: process.env.FAUX_TEXTE }) };
  };\n`);
  const propre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(OPENAI_API_KEY|NEXUS_RELAIS_)/.test(k)));
  const p = spawnSync('node', ['-r', faux, path.join(racine, 'outils', 'relais-arbitre-openai.js')],
    { input: entree, encoding: 'utf8', env: { ...propre, ...env } });
  return { code: p.status, stdout: p.stdout, stderr: p.stderr, requete: fs.existsSync(trace) ? JSON.parse(fs.readFileSync(trace, 'utf8')) : null };
}
const CORPS = `Réveil.\n\nLOT_ID: \`${LOT}\`\nDemande en attente: \`${REQ}\`\n`;
const CLE = 'cle-factice-epreuve';

epreuve('N1 — variable absente : rien envoyé, sortie vide, code 0', () => {
  const p = relais({ OPENAI_API_KEY: CLE, FAUX_TEXTE: contrat({}) }, CORPS);
  assert.strictEqual(p.code, 0, p.stderr);
  assert.strictEqual(p.stdout, '');
  assert.strictEqual(p.requete, null, 'une requête est partie sans la variable');
  assert.ok(/non armé/.test(p.stderr), p.stderr);
});
epreuve('N2 — variable posée mais secret absent : rien envoyé, code 0', () => {
  const p = relais({ NEXUS_RELAIS_OPENAI: 'arme', FAUX_TEXTE: contrat({}) }, CORPS);
  assert.strictEqual(p.code, 0, p.stderr);
  assert.strictEqual(p.requete, null, 'une requête est partie sans le secret');
});
epreuve('N3 — une autre valeur que `arme` ne vaut pas armement', () => {
  const p = relais({ NEXUS_RELAIS_OPENAI: 'oui', OPENAI_API_KEY: CLE, FAUX_TEXTE: contrat({}) }, CORPS);
  assert.strictEqual(p.requete, null);
});

// ── R. La voie armée, contre un fetch substitué ───────────────────────────
const ARME = { NEXUS_RELAIS_OPENAI: 'arme', OPENAI_API_KEY: CLE };
epreuve('R1 — armé, réponse conforme : la requête porte le mandat, store false, code 0', () => {
  const p = relais({ ...ARME, FAUX_TEXTE: contrat({}) }, CORPS);
  assert.strictEqual(p.code, 0, p.stderr);
  assert.strictEqual(p.stdout, contrat({}));
  assert.strictEqual(p.requete.url, 'https://api.openai.com/v1/responses');
  assert.strictEqual(p.requete.body.store, false);
  assert.strictEqual(p.requete.body.input, CORPS);
  assert.ok(p.requete.body.instructions.includes('Tu es l\'arbitre indépendant'), 'ARBITRE-CHATGPT.md doit être les instructions');
});
function preuveNonConforme(mutation) {
  const p = relais({ ...ARME, FAUX_TEXTE: 'Une demande attend sur #28.\n' }, CORPS, mutation);
  assert.strictEqual(p.code, 2, `une réponse sans contrat doit sortir en 2 (reçu ${p.code})`);
  assert.ok(/aucun NEXT_ACTION_CONTRACT/.test(p.stderr), p.stderr);
}
epreuve('R2 — armé, réponse sans contrat : code 2, le motif est dit', () => preuveNonConforme());
epreuve('R3 — armé, corps de réveil illisible : panne (1), rien envoyé', () => {
  const p = relais({ ...ARME, FAUX_TEXTE: contrat({}) }, 'pas un réveil\n');
  assert.strictEqual(p.code, 1);
  assert.strictEqual(p.requete, null);
});

// ── C. Le câblage dans tests.yml ──────────────────────────────────────────
const YML = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'tests.yml'), 'utf8');
function etape(yml, nom) {
  const i = yml.indexOf(`- name: ${nom}`);
  assert.ok(i >= 0, `étape « ${nom} » absente`);
  const j = yml.indexOf('\n      - name: ', i + 1);
  return yml.slice(i, j < 0 ? undefined : j);
}
function preuveCablage(yml) {
  const pub = etape(yml, 'Réveil Orchestrateur — publication au destinataire déclaré');
  const rel = etape(yml, 'Réveil Orchestrateur — relais vers l\'arbitre (API OpenAI)');
  assert.ok(yml.indexOf(pub) < yml.indexOf(rel), 'le relais doit suivre la publication');
  assert.ok(/\n\s+id: publication_reveil\n/.test(pub), 'la publication doit porter son id');
  // `numero` n'est écrit que quand le réveil est sur l'issue : jamais avant le
  // contrôle de doublon, et toujours après le post.
  const ecritures = pub.split('echo "numero=$NUM" >> "$GITHUB_OUTPUT"').length - 1;
  assert.strictEqual(ecritures, 2, `numero écrit ${ecritures} fois`);
  assert.ok(pub.indexOf('echo "numero=') > pub.indexOf('DEJA=$('), 'numero écrit avant le contrôle de doublon');
  assert.ok(pub.lastIndexOf('echo "numero=') > pub.indexOf('gh issue comment'), 'numero écrit avant le post');
  const si = (rel.match(/\n\s+if: (.*)\n/) || [])[1] || '';
  assert.ok(si.includes('vars.NEXUS_RELAIS_OPENAI == \'arme\''), `verrou de variable absent : ${si}`);
  assert.ok(si.includes('steps.publication_reveil.outputs.numero != \'\''), `relais possible sans réveil publié : ${si}`);
  assert.ok(/OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/.test(rel), 'le secret doit venir des secrets du dépôt');
  assert.ok(/timeout-minutes: \d+/.test(rel), 'le relais doit être borné');
  assert.ok(rel.includes(APPEL_CI), 'l\'étape doit appeler le relais');
  assert.ok(rel.includes('nexus-arbitrage:'), 'une consultation par corps de réveil');
  assert.ok(/grep -qi '@claude' reponse\.txt/.test(rel), 'garde anti-boucle avant le post');
  assert.ok(!/handoff\.js decision/.test(rel), 'stade (a) : la CI ne dépose aucune décision sans GO distinct');
}
epreuve('C1 — tests.yml : le relais suit la publication, derrière les deux verrous', () => preuveCablage(YML));
epreuve('C2 — ARBITRE-CHATGPT.md §7 ne demande plus à ChatGPT de poster une mention de Claude', () => {
  const t = fs.readFileSync(path.join(RACINE, 'docs', 'skills', 'nexus-handoff-fast-track', 'ARBITRE-CHATGPT.md'), 'utf8');
  assert.ok(!/@claude/i.test(t), 'une consigne qui porte la mention serait refusée par le relais');
  assert.ok(t.includes('outils/relais-arbitre-openai.js'), '§7 doit nommer le relais');
  assert.ok(t.includes('tu ne postes rien'), t);
});

// ── M. Débrancher l'aide ──────────────────────────────────────────────────
epreuve('M1 — sans l\'appel à `valider` dans la voie armée, R2 rougit', () => {
  let rouge = false;
  try { preuveNonConforme([APPEL_VALIDER, '  const v = { ok: true, refus: [] };\n']); }
  catch (e) { rouge = /doit sortir en 2/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte : l\'épreuve ne mesure pas le câblage');
});
epreuve('M2 — sans l\'appel au relais dans l\'étape CI, C1 rougit', () => {
  assert.strictEqual(YML.split(APPEL_CI).length, 2, 'ancre de mutation non unique');
  let rouge = false;
  try { preuveCablage(YML.replace(APPEL_CI, '> reponse.txt')); }
  catch (e) { rouge = /doit appeler le relais/.test(e.message); if (!rouge) throw e; }
  assert.ok(rouge, 'la mutation est restée verte');
});

console.log(`\n${total - echecs}/${total} épreuves passent`);
process.exit(echecs ? 1 : 0);
