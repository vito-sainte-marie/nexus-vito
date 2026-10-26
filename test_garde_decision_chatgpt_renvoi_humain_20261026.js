// Renvoi humain d'une décision ChatGPT — OUTILLAGE-REGULARISATION-20261026.
//
// Le 26/10/2026, decision-4 (BLOCKED, OWNER_NEXT: Frédéric) a été déposée à la
// main (89c29900) : l'outil l'a acceptée. Cette épreuve rend l'écart impossible :
//  - la GARDE pure (`controlerRenvoiHumainChatGPT`) refuse BLOCKED et
//    OWNER_NEXT: Frédéric, accepte un contrat qui avance ;
//  - la CLI `decision --auteur ChatGPT` refuse AVANT d'écrire (registre inchangé) ;
//  - le VALIDATEUR nomme tout renvoi humain ChatGPT déposé dans un lot postérieur
//    à la règle, sans toucher aux lots antérieurs ; decision-4 n'est tolérée que
//    par sa dérogation, que `verifier` imprime à chaque exécution ;
//  - la fiche INCIDENTS existe.
// Mutations sur des copies de l'outil : garde neutralisée, règle de validation retirée.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTILS = path.join(RACINE, 'outils');
const LOT = 'OUTILLAGE-REGULARISATION-20261026';
const DOSSIER = path.join(RACINE, 'docs', 'handoff', 'lots', LOT);

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
function charger(f) { delete require.cache[require.resolve(f)]; return require(f); }
function muter(nom, avant, apres) {
  const src = fs.readFileSync(path.join(OUTILS, nom), 'utf8');
  assert.ok(src.includes(avant), `ancre de mutation introuvable dans ${nom} : ${avant.slice(0, 60)}`);
  assert.strictEqual(src.split(avant).length, 2, `ancre non unique dans ${nom}`);
  const tmp = path.join(OUTILS, `.mut-${process.pid}-${nom}`);
  fs.writeFileSync(tmp, src.replace(avant, apres));
  try { return charger(tmp); } finally { fs.unlinkSync(tmp); }
}
const verifier = () => spawnSync('node', [path.join(OUTILS, 'handoff.js'), 'verifier'], { cwd: RACINE, encoding: 'utf8' });
const contrat = (decision, owner) => `Analyse.\n\nNEXT_ACTION_CONTRACT\nDECISION: ${decision}\nCLOSES: false\nLOT: ${LOT}\nOWNER_NEXT: ${owner}\n`;

const h = charger(path.join(OUTILS, 'handoff.js'));

epreuve('G1 — contrat DECISION: BLOCKED : refus DECISION_CHATGPT_RENVOI_HUMAIN', () => {
  const r = h.controlerRenvoiHumainChatGPT('APPROVED', contrat('BLOCKED', 'github-actions-claude'));
  assert.deepStrictEqual([r.ok, r.code], [false, 'DECISION_CHATGPT_RENVOI_HUMAIN']);
});
epreuve('G2 — OWNER_NEXT: Frédéric (avec ou sans accents) : refus', () => {
  for (const o of ['Frédéric', 'Frederic', 'frédéric'])
    assert.strictEqual(h.controlerRenvoiHumainChatGPT('APPROVED', contrat('APPROVED', o)).ok, false, o);
});
epreuve('G3 — --decision BLOCKED seul, contrat propre : refus', () => {
  assert.strictEqual(h.controlerRenvoiHumainChatGPT('BLOCKED', contrat('APPROVED', 'github-actions-claude')).ok, false);
});
epreuve('G4 — contrat qui avance (APPROVED, runner) : accepté', () => {
  assert.strictEqual(h.controlerRenvoiHumainChatGPT('APPROVED_WITH_CONDITIONS', contrat('APPROVED_WITH_CONDITIONS', 'github-actions-claude')).ok, true);
});
epreuve('G5 — la prose qui cite « Frédéric » ou BLOCKED hors contrat n\'est pas un renvoi', () => {
  assert.strictEqual(h.controlerRenvoiHumainChatGPT('APPROVED', 'Frédéric a décidé. Un BLOCKED antérieur est levé.\nOWNER_NEXT: github-actions-claude\n').ok, true);
});

epreuve('C1 — CLI `decision --auteur ChatGPT` sur un contrat BLOCKED : exit 1, rien d\'écrit', () => {
  const corps = path.join(require('os').tmpdir(), `renvoi-${process.pid}.md`);
  fs.writeFileSync(corps, contrat('BLOCKED', 'Frédéric'));
  const avant = fs.readdirSync(DOSSIER).sort();
  try {
    const r = spawnSync('node', [path.join(OUTILS, 'handoff.js'), 'decision', LOT, corps, '--decision', 'BLOCKED', '--closes', 'false', '--auteur', 'ChatGPT'], { cwd: RACINE, encoding: 'utf8' });
    assert.strictEqual(r.status, 1, r.stdout + r.stderr);
    assert.ok(/REFUS DECISION_CHATGPT_RENVOI_HUMAIN/.test(r.stderr), r.stderr);
    assert.deepStrictEqual(fs.readdirSync(DOSSIER).sort(), avant, 'le registre a changé');
  } finally { fs.unlinkSync(corps); }
});

epreuve('V1 — verifier : decision-4 (renvoi humain) est tolérée par sa dérogation, imprimée', () => {
  const r = verifier();
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(new RegExp(`DÉROGATION DECISION_CHATGPT_RENVOI_HUMAIN sur ${LOT}/decision-4\\.md`).test(r.stdout + r.stderr));
});
epreuve('V2 — la règle est datée : aucun lot antérieur à 20261026 ne la déclenche', () => {
  const r = verifier();
  const lignes = (r.stdout + r.stderr).split('\n').filter(l => /^(AVERTISSEMENT|ÉCHEC)\b.*DECISION_CHATGPT_RENVOI_HUMAIN/.test(l));
  assert.ok(lignes.length >= 1 && lignes.every(l => l.includes(LOT)), lignes.join('\n'));
});
epreuve('V3 — la fiche INCIDENTS existe, ouverte, sur 89c29900', () => {
  const f = fs.readFileSync(path.join(RACINE, 'docs', 'learning', 'INCIDENTS.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter(x => x.code === 'DECISION_CHATGPT_RENVOI_HUMAIN' && x.lot === LOT);
  assert.strictEqual(f.length, 1);
  assert.ok(f[0].sha.startsWith('89c29900') && f[0].statut === 'OUVERT');
});

epreuve('MU1 — garde neutralisée : G1/G2/G3 doivent rougir', () => {
  const mut = muter('handoff.js', "if (!motifs.length) return { ok: true };", "return { ok: true };");
  assert.strictEqual(mut.controlerRenvoiHumainChatGPT('BLOCKED', contrat('BLOCKED', 'Frédéric')).ok, true, 'la mutation n\'a pas pris');
});
epreuve('S1 — appel de la garde câblé dans nouvelleDecision avant toute écriture (C1 le prouve par effet)', () => {
  const src = fs.readFileSync(path.join(OUTILS, 'handoff.js'), 'utf8');
  assert.ok(/if \(auteur === 'ChatGPT'\) \{ const g = controlerRenvoiHumainChatGPT\(verdict/.test(src), 'appel absent de nouvelleDecision');
});
epreuve('MU3 — règle de validation retirée : decision-4 n\'est plus nommée, sa dérogation ne s\'imprime plus', () => {
  const src = fs.readFileSync(path.join(OUTILS, 'handoff.js'), 'utf8');
  const ancre = "if (env.author === 'ChatGPT' && lot.slice(-8) >= REGLE_RENVOI_HUMAIN_DEPUIS)";
  assert.strictEqual(src.split(ancre).length, 2, 'ancre de la règle absente ou multiple');
  const tmp = path.join(OUTILS, `.mut-${process.pid}-handoff.js`);
  fs.writeFileSync(tmp, src.replace(ancre, "if (false && env.author === 'ChatGPT' && lot.slice(-8) >= REGLE_RENVOI_HUMAIN_DEPUIS)"));
  try {
    const r = spawnSync('node', [tmp, 'verifier'], { cwd: RACINE, encoding: 'utf8' });
    assert.ok(!/DÉROGATION DECISION_CHATGPT_RENVOI_HUMAIN/.test(r.stdout + r.stderr), 'la mutation n\'a pas pris');
  } finally { fs.unlinkSync(tmp); }
});

console.log(`\n${total - echecs}/${total}`);
process.exit(echecs ? 1 : 0);
