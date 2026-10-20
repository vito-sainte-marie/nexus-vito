'use strict';
// Épreuves F1 à F8 — vérification d'une décision déposée contre sa source désignée.
// GOV-R2-EMPREINTE-DECISION-20261020, decision-2 (APPROVED_WITH_CONDITIONS, 1d8ab67f→ac4d1553).
// Écrites AVANT le vérificateur : outils/verifier-source-decision.js n'existe pas encore,
// donc F1 à F8 sont ROUGES. Le vérificateur doit les rendre vertes ; F8 (contrôle) doit
// rester vert. Hors run-tests.js : aucun câblage (decision-2).
//
// Interface attendue :
//   verifierSource({ decisionPath, fetchComment }) -> { ok: boolean, code: string|null, detail: string }
//   fetchComment(reference) -> { auteur, corps } ; peut lever (API injoignable).
// L'empreinte (sha256 du corps canonique) est RECALCULÉE à partir du commentaire récupéré ;
// le fichier ne porte qu'un pointeur (provenance.reference).
// Limite assumée : la concordance ne prouve ni l'identité de l'émetteur ni l'immutabilité du commentaire.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

let verif = null, chargement = null;
try { verif = require('./verifier-source-decision.js'); } catch (e) { chargement = e; }

let passes = 0, total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}

const LOT = 'GOV-R2-EMPREINTE-DECISION-20261020';
const REF = 'https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6296095776';
const VERDICT = [
  '**Verdict : APPROVED_WITH_CONDITIONS.**',
  '',
  'Texte de l’arbitre, reproduit tel quel.',
  '',
  'NEXT_ACTION_CONTRACT',
  'DECISION: APPROVED_WITH_CONDITIONS',
  'CLOSES: false',
  `LOT: ${LOT}`,
  'REQUEST: request-2.md',
].join('\n');

function commentaire(plus) {
  return Object.assign({ auteur: 'github-actions[bot]', corps: VERDICT }, plus || {});
}
function decisionTexte(o) {
  o = Object.assign({ decision: 'APPROVED_WITH_CONDITIONS', closes: 'false', lot: LOT, req: 'request-2.md',
    reference: REF, corps: VERDICT, empreinte: null }, o || {});
  return [
    '---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${o.lot}`, 'seq: 2', 'author: ChatGPT',
    `decision: ${o.decision}`, `closes: ${o.closes}`, `in_reply_to: ${o.req}`,
    'provenance:', '  niveau: 2', '  mode: github_actions_relay',
    o.reference === null ? null : `  reference: ${o.reference}`,
    o.empreinte ? `  empreinte: sha256:${o.empreinte}` : null,
    '---', '# Décision', '', "## Texte de l'arbitre", '', o.corps, '',
  ].filter((l) => l !== null).join('\n');
}
function deposer(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-source-'));
  const f = path.join(dir, 'decision-2.md');
  fs.writeFileSync(f, texte);
  return f;
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function verifier(texte, fetchComment) {
  if (!verif || typeof verif.verifierSource !== 'function') {
    throw new Error('outils/verifier-source-decision.js absent ou sans verifierSource : ' + (chargement ? chargement.code : 'export manquant'));
  }
  return verif.verifierSource({ decisionPath: deposer(texte), fetchComment });
}
const API = (c) => () => c;

console.log('\nR2 — épreuves F1-F8 : décision contre source désignée\n');

t('F1 : un octet modifié dans le corps, empreinte du fichier recalculée -> DECISION_ALTEREE', () => {
  const corps = VERDICT.replace('tel quel', 'tel qUel');
  const r = verifier(decisionTexte({ corps, empreinte: sha(corps) }), API(commentaire()));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'DECISION_ALTEREE');
});

t('F2 : aucun pointeur vers un commentaire source -> SOURCE_NON_DESIGNEE', () => {
  let appels = 0;
  const r = verifier(decisionTexte({ reference: null }), () => { appels++; return commentaire(); });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'SOURCE_NON_DESIGNEE');
  assert.strictEqual(appels, 0, 'aucune lecture sans source désignée');
});

t("F3 : commentaire d'un autre auteur que github-actions[bot] -> SOURCE_INADMISSIBLE", () => {
  const r = verifier(decisionTexte(), API(commentaire({ auteur: 'vito-sainte-marie' })));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'SOURCE_INADMISSIBLE');
});

t("F4 : commentaire valide mais d'un autre lot -> SOURCE_HORS_LOT", () => {
  const autre = VERDICT.replace(`LOT: ${LOT}`, 'LOT: GOV-R1-IDENTITES-PROVENANCE-20261019');
  const r = verifier(decisionTexte({ corps: autre }), API(commentaire({ corps: autre })));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'SOURCE_HORS_LOT');
});

t("F4b : commentaire valide d'une autre request du même lot -> SOURCE_HORS_LOT", () => {
  const autre = VERDICT.replace('REQUEST: request-2.md', 'REQUEST: request-3.md');
  const r = verifier(decisionTexte({ corps: autre }), API(commentaire({ corps: autre })));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'SOURCE_HORS_LOT');
});

t('F5 : closes false -> true dans l\'enveloppe, corps intact -> CONTRAT_DIVERGENT', () => {
  const r = verifier(decisionTexte({ closes: 'true' }), API(commentaire()));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'CONTRAT_DIVERGENT');
});

t('F5b : decision modifiée dans l\'enveloppe, corps intact -> CONTRAT_DIVERGENT', () => {
  const r = verifier(decisionTexte({ decision: 'APPROVED' }), API(commentaire()));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'CONTRAT_DIVERGENT');
});

t('F6 : API injoignable -> SOURCE_INJOIGNABLE explicite, jamais ok', () => {
  const r = verifier(decisionTexte(), () => { throw new Error('connect ETIMEDOUT'); });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'SOURCE_INJOIGNABLE');
  assert.ok(/ETIMEDOUT|injoignable/i.test(r.detail), 'le détail nomme la cause');
});

t('F7 : texte ET empreinte altérés ensemble, pointeur intact -> refusé comme F1', () => {
  const corps = VERDICT.replace('Texte de l’arbitre', 'Texte altéré');
  const r = verifier(decisionTexte({ corps, empreinte: sha(corps) }), API(commentaire()));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'DECISION_ALTEREE');
});

t('F7b : une empreinte fournie dans le fichier n\'est jamais une preuve (même concordante avec le corps du commentaire, corps altéré)', () => {
  const corps = VERDICT + '\nligne ajoutée';
  const r = verifier(decisionTexte({ corps, empreinte: sha(VERDICT) }), API(commentaire()));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'DECISION_ALTEREE');
});

t('F8 (contrôle vert) : décision CI intacte, pointeur et commentaire concordants -> acceptée', () => {
  const r = verifier(decisionTexte(), API(commentaire()));
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.code, null);
  assert.ok(/identité|immutab/i.test(r.detail), 'la limite (ni identité ni immutabilité) reste dite');
});

console.log(`\n${passes}/${total} épreuves vertes`);
