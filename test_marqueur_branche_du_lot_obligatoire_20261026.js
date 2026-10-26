// BRANCHE_DU_LOT obligatoire et déposé par la CI — OUTILLAGE-REGULARISATION-20261026,
// decision-2 condition 1 et consigne de Frédéric (« montrez comment le marqueur arrivera
// dans les décisions futures »).
//
// Deux moitiés, car une garde que rien n'alimente bloque la boucle :
//  - la GARDE (`handoff.js controlerMarqueurBranche`) : absent, multiple ou invalide =
//    refus ; valide = accepté ; les décisions antérieures à l'ancre (decision-1 et
//    decision-2, SHA réels du registre) restent régularisées ;
//  - la LIVRAISON (`materialiser-decision-ci.js`) : la CI dépose `BRANCHE_DU_LOT: <rail>`
//    quand l'arbitre n'en nomme pas, respecte un marqueur valide et unique, refuse un
//    marqueur multiple ou invalide. De bout en bout : un corps matérialisé passe la garde.
// Mutations vérifiées sur des copies de l'outil : garde neutralisée, injection supprimée.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const OUTILS = path.join(RACINE, 'outils');
const DECISION_1 = '3b9cfe4f', DECISION_2 = '286edb06';
const POSTERIEUR = execGit('rev-parse', 'HEAD');
const RAIL = 'handoff-continuite-20260920';
const LOT = 'OUTILLAGE-REGULARISATION-20261026';
const SHA = 'c41867f1d2b3a49e8f05c6d7e8a9b0c1d2e3f405';

function execGit(...a) { return require('child_process').execFileSync('git', a, { cwd: RACINE, encoding: 'utf8' }).trim(); }
let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
function charger(f) { delete require.cache[require.resolve(f)]; return require(f); }
// Copie mutée d'un outil, dans outils/ (le module garde son __dirname, donc sa RACINE).
function muter(nom, avant, apres) {
  const src = fs.readFileSync(path.join(OUTILS, nom), 'utf8');
  assert.ok(src.includes(avant), `ancre de mutation introuvable dans ${nom} : ${avant.slice(0, 60)}`);
  assert.strictEqual(src.split(avant).length, 2, `ancre non unique dans ${nom}`);
  const tmp = path.join(OUTILS, `.mut-${process.pid}-${nom}`);
  fs.writeFileSync(tmp, src.replace(avant, apres));
  try { return charger(tmp); } finally { fs.unlinkSync(tmp); }
}

const h = charger(path.join(OUTILS, 'handoff.js'));
const m = charger(path.join(OUTILS, 'materialiser-decision-ci.js'));

epreuve('G1 — marqueur absent sur une décision postérieure à l\'ancre : BRANCHE_DU_LOT_ABSENT', () => {
  const r = h.controlerMarqueurBranche('# Décision\nrien\n', POSTERIEUR);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'BRANCHE_DU_LOT_ABSENT');
});
epreuve('G2 — marqueur multiple : BRANCHE_DU_LOT_MULTIPLE, même si les deux sont valides', () => {
  const r = h.controlerMarqueurBranche('BRANCHE_DU_LOT: a\nBRANCHE_DU_LOT: b\n', POSTERIEUR);
  assert.strictEqual(r.code, 'BRANCHE_DU_LOT_MULTIPLE');
});
epreuve('G3 — marqueur invalide (main, production, « .. », chemin absolu) : BRANCHE_DU_LOT_INVALIDE', () => {
  for (const b of ['main', 'production', 'a/../b', '/abs', 'fin/'])
    assert.strictEqual(h.controlerMarqueurBranche(`BRANCHE_DU_LOT: ${b}\n`, POSTERIEUR).code, 'BRANCHE_DU_LOT_INVALIDE', b);
});
epreuve('G4 — marqueur valide et unique : accepté, branche rendue', () => {
  const r = h.controlerMarqueurBranche(`texte\nBRANCHE_DU_LOT: ${RAIL}\n`, POSTERIEUR);
  assert.deepStrictEqual([r.ok, r.branche], [true, RAIL]);
});
epreuve('G5 — decision-1 et decision-2 (SHA réels), sans marqueur : régularisées', () => {
  for (const c of [DECISION_1, DECISION_2]) {
    const r = h.controlerMarqueurBranche('sans marqueur\n', c);
    assert.deepStrictEqual([r.ok, r.regularise], [true, true], c);
  }
});
epreuve('G6 — une décision postérieure à l\'ancre ne profite pas de la dispense (le commit courant)', () => {
  assert.notStrictEqual(execGit('merge-base', POSTERIEUR, h.ANCRE_MARQUEUR_FACULTATIF), POSTERIEUR);
});

// --- livraison ---
const O = { shaDuRun: SHA, shaDuRail: SHA, railDuRun: RAIL };
function contrat(extra = '') {
  return `Analyse.\n\n${extra}RAIL_LU: ${SHA}\n\nNEXT_ACTION_CONTRACT\nDECISION: APPROVED\nCLOSES: true\nLOT: ${LOT}\nREQUEST: request-3.md\nHEAD: ${SHA.slice(0, 7)}\nLEASE: aucun\nGATE_STATE: GREEN\nPROOF_STATE: PROOF_VALID\nCONDITIONS: aucune\nBLOCKER: aucun\nSTOP_REQUIRED: aucun\nCAPACITE_REQUISE: aucune\nOWNER_NEXT: Claude\nEXECUTANT_NEXT: github-actions-claude\nACTION_NEXT: matérialiser la décision\n`;
}
const etat = { lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-3.md', rail: RAIL } } };
const materialise = (mod, texte) => { const j = mod.juger(texte, etat, O); assert.strictEqual(j.code, 0, JSON.stringify(j.refus)); return mod.corps(texte, j, {}); };

epreuve('L1 — l\'arbitre n\'a pas nommé de branche : la CI dépose BRANCHE_DU_LOT: <rail>, une seule fois', () => {
  const c = materialise(m, contrat());
  assert.strictEqual(require(path.join(OUTILS, 'marqueur-branche-du-lot.js')).analyser(c).n, 1);
  assert.ok(new RegExp(`^BRANCHE_DU_LOT: ${RAIL}$`, 'm').test(c));
});
epreuve('L2 — un marqueur valide de l\'arbitre est respecté, la CI n\'en ajoute pas un second', () => {
  const c = materialise(m, contrat('BRANCHE_DU_LOT: ma-branche-de-travail\n'));
  const a = require(path.join(OUTILS, 'marqueur-branche-du-lot.js')).analyser(c);
  assert.deepStrictEqual([a.n, a.branche], [1, 'ma-branche-de-travail']);
});
epreuve('L3 — un marqueur multiple ou invalide dans la réponse de l\'arbitre : refus (2)', () => {
  assert.strictEqual(m.juger(contrat('BRANCHE_DU_LOT: a\nBRANCHE_DU_LOT: b\n'), etat, O).code, 2);
  assert.strictEqual(m.juger(contrat('BRANCHE_DU_LOT: main\n'), etat, O).code, 2);
});
epreuve('L4 — de bout en bout : un corps matérialisé sans marqueur de l\'arbitre passe la garde', () => {
  const r = h.controlerMarqueurBranche(materialise(m, contrat()), POSTERIEUR);
  assert.deepStrictEqual([r.ok, r.branche], [true, RAIL]);
});
epreuve('L5 — la consigne de l\'arbitre décrit le marqueur (sinon personne ne sait le rendre)', () => {
  const t = fs.readFileSync(path.join(RACINE, 'docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md'), 'utf8');
  assert.ok(/BRANCHE_DU_LOT: <branche>/.test(t) && /jamais `?main`? ni `?production/.test(t));
});

// --- mutations ---
epreuve('MU1 — garde neutralisée (absent accepté) : G1 doit rougir', () => {
  const mut = muter('handoff.js', "return { ok: false, code: 'BRANCHE_DU_LOT_ABSENT'", "return { ok: true, code: 'BRANCHE_DU_LOT_ABSENT'");
  assert.strictEqual(mut.controlerMarqueurBranche('x\n', POSTERIEUR).ok, true, 'la mutation n\'a pas pris');
});
epreuve('MU2 — dispense d\'ancre retirée : G5 doit rougir', () => {
  const mut = muter('handoff.js', "return { ok: true, branche: null, regularise: true }", "throw new Error('mut')");
  assert.strictEqual(mut.controlerMarqueurBranche('x\n', DECISION_1).ok, false, 'la mutation n\'a pas pris');
});
epreuve('MU3 — injection CI supprimée : L1/L4 doivent rougir', () => {
  const mut = muter('materialiser-decision-ci.js', 'marqueur.analyser(texte).n === 0 ?', 'false ?');
  assert.strictEqual(h.controlerMarqueurBranche(materialise(mut, contrat()), POSTERIEUR).ok, false, 'la mutation n\'a pas pris');
});
epreuve('MU4 — refus du multiple retiré côté CI : L3 doit rougir', () => {
  const mut = muter('materialiser-decision-ci.js', 'if (mq.n > 1)', 'if (false)');
  assert.notStrictEqual(mut.juger(contrat('BRANCHE_DU_LOT: a\nBRANCHE_DU_LOT: b\n'), etat, O).code, 2, 'la mutation n\'a pas pris');
});

console.log(`\n${total - echecs}/${total}`);
process.exit(echecs ? 1 : 0);
