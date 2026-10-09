// Stade (a) de l'arbitrage autonome — 09/10/2026, AUTORISÉ PAR FRÉDÉRIC
// BRAGANCE (« autorise le stade (a) »).
//
// `outils/materialiser-decision-ci.js` lit la réponse de l'arbitre et compose
// le corps de `decision-N`. Il ne doit matérialiser QUE la demande que le
// registre attend, sur un rail Handoff, et jamais depuis un code qui tient un
// jeton. Aucune épreuve ne touche le réseau ni git.
//
// Mutation : on débranche l'appel à `valider` dans une copie de l'outil ; un
// contrat non conforme doit alors passer, et l'épreuve qui le refuse rougir.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'materialiser-decision-ci.js');
const LOT = 'LOT-EPREUVE-MATERIALISATION-20261009';
const REQ = 'request-2.md';
const RAIL = 'handoff-continuite-20260920';
const APPEL_VALIDER = '  const v = valider(texte, { lot, request });\n';

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

function contrat(champs) {
  const c = { DECISION: 'APPROVED', CLOSES: 'true', LOT, REQUEST: REQ, HEAD: 'c41867f', LEASE: 'aucun',
    GATE_STATE: 'GREEN', PROOF_STATE: 'PROOF_VALID', CONDITIONS: 'aucune', BLOCKER: 'aucun',
    STOP_REQUIRED: 'aucun', CAPACITE_REQUISE: 'aucune',
    OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'github-actions-claude',
    ACTION_NEXT: 'matérialiser la décision', ...champs };
  return 'Analyse de l\'arbitre.\n\nNEXT_ACTION_CONTRACT\n' +
    Object.entries(c).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
}
function etat(fiche) {
  return { lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: REQ, rail: RAIL, ...fiche } } };
}

function charger(fichier) {
  delete require.cache[require.resolve(fichier)];
  return require(fichier);
}
let m = charger(OUTIL);

epreuve('M1 — la demande attendue, sur le rail du run : matérialisable', () => {
  const j = m.juger(contrat({}), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 0, JSON.stringify(j.refus));
  assert.deepStrictEqual([j.lot, j.request, j.decision, j.closes, j.rail], [LOT, REQ, 'APPROVED', 'true', RAIL]);
});

epreuve('M2 — un contrat non conforme est refusé (2) avant tout regard au registre', () => {
  const j = m.juger(contrat({ DECISION: 'GO' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2);
  assert.ok(j.refus.some(x => /hors vocabulaire/.test(x)), j.refus.join(' / '));
  assert.strictEqual(m.juger('pas de contrat', etat({}), {}).code, 2);
});

epreuve('M3 — la mention qui relance Claude est refusée', () => {
  const j = m.juger(contrat({ ACTION_NEXT: '@claude matérialise' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2, JSON.stringify(j));
});

epreuve('M4 — une autre demande que celle du registre : refus (2) si attendue, rien à faire (3) sinon', () => {
  const j = m.juger(contrat({ REQUEST: 'request-1.md' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2, JSON.stringify(j));
  assert.ok(j.refus.some(x => /attend une décision sur request-2\.md/.test(x)), j.refus.join(' / '));
  const k = m.juger(contrat({ REQUEST: 'request-1.md' }), etat({ statut: 'DECISION_CONSOMMEE' }), { railDuRun: RAIL });
  assert.strictEqual(k.code, 3, JSON.stringify(k));
});

epreuve('M5 — un lot déjà consommé ou déjà répondu : rien à faire (3)', () => {
  assert.strictEqual(m.juger(contrat({}), etat({ statut: 'DECISION_CONSOMMEE' }), { railDuRun: RAIL }).code, 3);
  const j = m.juger(contrat({}), etat({}), { railDuRun: RAIL, repondues: l => (l === LOT ? [REQ] : []) });
  assert.strictEqual(j.code, 3, JSON.stringify(j));
});

epreuve('M6 — un lot inconnu du registre : refus (2)', () => {
  assert.strictEqual(m.juger(contrat({}), { lots: {} }, { railDuRun: RAIL }).code, 2);
});

epreuve('M7 — la CI n\'écrit que sur un rail handoff-*, jamais main ni production', () => {
  for (const rail of ['main', 'production', 'config-par-environnement', 'claude/run-1', '', undefined]) {
    const j = m.juger(contrat({}), etat({ rail }), { railDuRun: rail });
    assert.strictEqual(j.code, 2, `rail ${JSON.stringify(rail)} accepté`);
  }
});

epreuve('M8 — le run doit porter le rail du lot', () => {
  const j = m.juger(contrat({}), etat({}), { railDuRun: 'handoff-autre-20261009' });
  assert.strictEqual(j.code, 2);
  assert.ok(j.refus.some(x => /le lot vit sur/.test(x)), j.refus.join(' / '));
});

epreuve('M9 — le corps reproduit le verdict tel quel et dit ce qui n\'a PAS été contrôlé', () => {
  const texte = contrat({ CONDITIONS: 'recette Test verte avant tout déploiement' });
  const j = m.juger(texte, etat({}), { railDuRun: RAIL });
  const c = m.corps(texte, j, { run: '123', commentaire: 'https://example.invalid/c/1' });
  assert.ok(c.startsWith(`# Décision sur ${REQ} — APPROVED, lot clos\n`), c.split('\n')[0]);
  assert.ok(c.includes(texte.trimEnd()), 'le texte de l\'arbitre doit être reproduit intégralement');
  assert.ok(/## Ce que la CI n'a PAS contrôlé/.test(c), 'section des limites absente');
  assert.ok(c.includes('recette Test verte avant tout déploiement'), 'les conditions doivent être citées comme non contrôlées');
  assert.ok(/ne relance ni la CI ni Claude/.test(c), 'la limite du jeton du workflow doit être dite');
  assert.ok(c.includes('run 123'), 'provenance du run absente');
});

epreuve('M10 — l\'outil n\'a aucune voie vers GitHub ni vers git', () => {
  const src = fs.readFileSync(OUTIL, 'utf8').split('\n').filter(x => !/^\s*\/\//.test(x)).join('\n');
  assert.ok(!/child_process|GH_TOKEN|GITHUB_TOKEN|\bgh\b|fetch\(|https?:/.test(src),
    'l\'outil qui lit le texte de l\'arbitre ne doit disposer d\'aucune voie réseau');
});

epreuve('M11 — en CLI, sur le registre réel, un lot clos ne se rematérialise pas (3, rien écrit)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialiser-'));
  const rep = path.join(dir, 'reponse.txt'), sortie = path.join(dir, 'corps.md');
  fs.writeFileSync(rep, contrat({ LOT: 'FAST-TRACK-ROUTAGE-CAPACITES-1-20261009', REQUEST: 'request-1.md' }));
  const r = spawnSync(process.execPath, [OUTIL, '--reponse', rep, '--sortie', sortie, '--rail-du-run', RAIL], { encoding: 'utf8' });
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(sortie), 'un refus ne doit rien écrire');
  assert.ok(JSON.parse(r.stdout).refus.length > 0);
});

// ── Mutation : débrancher `valider` ─────────────────────────────────────
epreuve('X1 — sans l\'appel à `valider`, un contrat non conforme passerait (l\'épreuve M2 mord)', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  assert.strictEqual(src.split(APPEL_VALIDER).length, 2, 'ancre de mutation non unique ou absente');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialiser-mutant-'));
  const mutant = path.join(dir, 'materialiser-decision-ci.js');
  fs.writeFileSync(mutant, src
    .replace(APPEL_VALIDER, '  const v = { ok: true };\n')
    .replace("require('./relais-arbitre-openai')",
      `require(${JSON.stringify(path.join(RACINE, 'outils', 'relais-arbitre-openai.js'))})`));
  const mm = charger(mutant);
  assert.strictEqual(mm.juger(contrat({ DECISION: 'GO' }), etat({}), { railDuRun: RAIL }).code, 0,
    'la mutation ne change rien : M2 ne mesurerait pas l\'appel à valider');
});

console.log(`\n${total - echecs}/${total} épreuves passées`);
process.exit(echecs ? 1 : 0);
