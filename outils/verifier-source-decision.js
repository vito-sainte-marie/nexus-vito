'use strict';
// Vérifie qu'une decision-N.md déposée correspond au commentaire désigné du relais (issue #28).
// GOV-R2-EMPREINTE-DECISION-20261020, decision-2. Outil de mesure : ne consomme rien, ne câble rien.
//
// Principe : la source n'est pas dans le fichier. Le fichier ne porte qu'un pointeur
// (provenance.reference). L'empreinte (sha256 du corps canonique) est recalculée ici à partir
// du commentaire récupéré ; une empreinte écrite dans le fichier n'est jamais lue comme preuve.
//
// Limite assumée : la concordance prouve que la décision égale le commentaire désigné. Elle ne
// prouve ni l'identité de l'émetteur (github-actions[bot] est partagé avec les jobs claude.yml)
// ni l'immutabilité absolue du commentaire (modifiable après coup).
const crypto = require('crypto');
const fs = require('fs');

const AUTEUR_ADMIS = 'github-actions[bot]';
const LIMITE = "La concordance ne prouve ni l'identité de l'émetteur ni l'immutabilité absolue du commentaire.";

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const canon = (s) => String(s).replace(/\r\n/g, '\n').trim();

function enveloppe(texte) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(texte.replace(/\r\n/g, '\n'));
  const champs = {};
  if (!m) return champs;
  for (const l of m[1].split('\n')) {
    const k = /^\s*([a-z_]+):\s*(.*?)\s*$/.exec(l);
    if (k) champs[k[1]] = k[2];
  }
  return champs;
}

function corpsDeLaDecision(texte) {
  const t = texte.replace(/\r\n/g, '\n');
  const i = t.indexOf("## Texte de l'arbitre");
  return i < 0 ? null : canon(t.slice(i + "## Texte de l'arbitre".length));
}

function contrat(corps) {
  const out = {};
  const i = corps.lastIndexOf('NEXT_ACTION_CONTRACT');
  if (i < 0) return out;
  for (const l of corps.slice(i).split('\n')) {
    const k = /^\s*(DECISION|CLOSES|LOT|REQUEST):\s*(.+?)\s*$/.exec(l);
    if (k && !(k[1] in out)) out[k[1]] = k[2];
  }
  return out;
}

const refus = (code, detail) => ({ ok: false, code, detail: `${detail} ${LIMITE}` });

function verifierSource({ decisionPath, fetchComment }) {
  const texte = fs.readFileSync(decisionPath, 'utf8');
  const env = enveloppe(texte);
  const reference = env.reference;
  if (!reference || !/^https?:\/\/\S+#issuecomment-\d+$/.test(reference)) {
    return refus('SOURCE_NON_DESIGNEE', 'aucun pointeur provenance.reference vers un commentaire source.');
  }
  let source;
  try { source = fetchComment(reference); }
  catch (e) { return refus('SOURCE_INJOIGNABLE', `commentaire source injoignable (${e.message}) : rien n'est consommé.`); }
  if (!source || typeof source.corps !== 'string') {
    return refus('SOURCE_INJOIGNABLE', 'commentaire source injoignable (réponse vide) : rien n\'est consommé.');
  }
  if (source.auteur !== AUTEUR_ADMIS) {
    return refus('SOURCE_INADMISSIBLE', `auteur du commentaire « ${source.auteur} » ≠ ${AUTEUR_ADMIS}.`);
  }
  const cs = contrat(canon(source.corps));
  if (cs.LOT !== env.lot_id || cs.REQUEST !== env.in_reply_to) {
    return refus('SOURCE_HORS_LOT', `le commentaire vise ${cs.LOT || '?'} / ${cs.REQUEST || '?'}, la décision ${env.lot_id} / ${env.in_reply_to}.`);
  }
  const corps = corpsDeLaDecision(texte);
  if (corps === null || sha256(corps) !== sha256(canon(source.corps))) {
    return refus('DECISION_ALTEREE', 'le corps de la décision ne correspond pas au commentaire source (empreinte recalculée).');
  }
  if (cs.DECISION !== env.decision || cs.CLOSES !== env.closes) {
    return refus('CONTRAT_DIVERGENT', `contrat du commentaire (${cs.DECISION}, closes ${cs.CLOSES}) ≠ enveloppe (${env.decision}, closes ${env.closes}).`);
  }
  return { ok: true, code: null, detail: `concordance avec ${reference}, sha256 ${sha256(corps)}. ${LIMITE}` };
}

module.exports = { verifierSource, contrat, corpsDeLaDecision };
