#!/usr/bin/env node
// Relais automatique du réveil vers l'arbitre ChatGPT, par l'API OpenAI —
// câblé le 07/10/2026 sur GO de Frédéric (« GO câblage »), NON ARMÉ.
//
// Appelé par l'étape « Réveil Orchestrateur — relais vers l'arbitre » de
// tests.yml, juste après la publication du réveil sur #28. Un commentaire
// posté avec GITHUB_TOKEN ne déclenche aucun workflow : le relais ne peut donc
// pas être un workflow `issue_comment`, il vit dans le même job.
//
// Deux verrous humains distincts, qu'aucun commit ne pose :
//   1. le secret `OPENAI_API_KEY` (SECRET_PERMISSION_SURFACE_SECURITE) ;
//   2. la variable de dépôt `NEXUS_RELAIS_OPENAI=arme`
//      (ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC).
// Sans les deux, le script se tait (code 0, « non armé ») : un relais absent
// n'est pas une panne, la voie manuelle (coller dans ChatGPT) reste ouverte.
//
// Ce qu'il fait, et rien d'autre :
//   - envoie à l'API le corps du réveil (stdin) avec, en instructions, le
//     texte de ARBITRE-CHATGPT.md ;
//   - exige dans la réponse un NEXT_ACTION_CONTRACT complet et valide (verdict
//     canonique, LOT et REQUEST = ceux du réveil, code du palier Frédéric si
//     BLOCKED + Frédéric) ;
//   - écrit la réponse sur stdout. L'étape CI la poste sur #28, SANS mention de
//     Claude. Il ne dépose AUCUNE décision : la matérialisation reste à Claude.
//
// Codes : 0 conforme (ou non armé), 2 réponse non conforme, 1 panne technique.
//
// Essai hors réseau :  node outils/relais-arbitre-openai.js --essai <reponse.txt> --lot L --request request-N.md
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const esc = require('./escalade-humaine.js');
// Le vocabulaire est celui que `handoff.js decision` acceptera : une réponse
// validée ici ne peut pas être refusée à la matérialisation.
const DECISIONS = require('./handoff.js').DECISIONS_CANONIQUES;
const MODELE = process.env.NEXUS_RELAIS_MODELE || 'gpt-5';
const DELAI_MS = 180000;

// Aucun repli : un contrat ou un registre illisible est une panne, jamais un
// gabarit deviné qui validerait à côté.
const champsContrat = () => esc.CHAMPS_CONTRAT.map(([k]) => k);
const motifsFrederic = () => esc.chargerRegistre(RACINE).routage.frederic;

// Le DERNIER bloc NEXT_ACTION_CONTRACT de la réponse : l'arbitre peut citer le
// gabarit plus haut ; seul le dernier est son verdict.
function lireContrat(texte) {
  const i = texte.lastIndexOf('NEXT_ACTION_CONTRACT');
  if (i < 0) return null;
  const c = {};
  for (const ligne of texte.slice(i).split('\n').slice(1)) {
    const m = ligne.replace(/^[\s>*`-]+/, '').match(/^([A-Z_]+)\s*:\s*(.*?)[\s`*]*$/);
    if (m && !(m[1] in c)) c[m[1]] = m[2].replace(/^<|>$/g, '').trim();
  }
  return c;
}

function valider(texte, attendu) {
  const refus = [];
  const c = lireContrat(texte);
  if (!c) return { ok: false, refus: ['aucun NEXT_ACTION_CONTRACT dans la réponse'] };
  for (const k of champsContrat()) if (!c[k]) refus.push(`champ ${k} absent ou vide`);
  if (c.DECISION && !DECISIONS.includes(c.DECISION)) refus.push(`DECISION ${JSON.stringify(c.DECISION)} hors vocabulaire (${DECISIONS.join('|')})`);
  if (c.CLOSES && !['true', 'false'].includes(c.CLOSES)) refus.push('CLOSES doit valoir true ou false');
  if (attendu.lot && c.LOT && c.LOT.replace(/`/g, '') !== attendu.lot) refus.push(`LOT ${c.LOT} ≠ réveil ${attendu.lot}`);
  if (attendu.request && c.REQUEST && c.REQUEST.replace(/`/g, '') !== attendu.request) refus.push(`REQUEST ${c.REQUEST} ≠ réveil ${attendu.request}`);
  if (c.OWNER_NEXT && !['Claude', 'Frédéric'].includes(c.OWNER_NEXT)) refus.push(`OWNER_NEXT ${JSON.stringify(c.OWNER_NEXT)} ∉ Claude|Frédéric`);
  if (c.OWNER_NEXT === 'Frédéric') {
    if (c.DECISION !== 'BLOCKED') refus.push('OWNER_NEXT Frédéric exige DECISION BLOCKED');
    if (!motifsFrederic().includes(c.STOP_REQUIRED)) refus.push(`STOP_REQUIRED ${JSON.stringify(c.STOP_REQUIRED)} n'est pas un motif du palier Frédéric`);
  }
  // Un corps qui relancerait Claude ne se publie pas (même garde que le réveil).
  if (/@claude/i.test(texte)) refus.push('la réponse porte une mention de Claude : publication interdite (boucle)');
  return { ok: refus.length === 0, refus, contrat: c };
}

function attenduDuReveil(corps) {
  const lot = (corps.match(/^LOT_ID: `([^`]+)`/m) || [])[1];
  const request = (corps.match(/^Demande en attente: `([^`]+)`/m) || [])[1];
  return { lot, request };
}

async function appeler(corps) {
  const instructions = fs.readFileSync(path.join(RACINE, 'docs', 'skills', 'nexus-handoff-fast-track', 'ARBITRE-CHATGPT.md'), 'utf8');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DELAI_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODELE, instructions, input: corps, max_output_tokens: 6000, store: false }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`API ${r.status} : ${(j.error && j.error.message) || 'réponse illisible'}`);
    const texte = j.output_text || (j.output || []).flatMap(o => o.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
    if (!texte) throw new Error('réponse sans texte');
    return texte;
  } finally { clearTimeout(t); }
}

async function principal() {
  const a = process.argv.slice(2);
  const opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  if (a.includes('--essai')) {
    const v = valider(fs.readFileSync(opt('--essai'), 'utf8'), { lot: opt('--lot'), request: opt('--request') });
    console.log(v.ok ? 'CONFORME' : 'NON CONFORME :\n- ' + v.refus.join('\n- '));
    return v.ok ? 0 : 2;
  }
  if (process.env.NEXUS_RELAIS_OPENAI !== 'arme' || !process.env.OPENAI_API_KEY) {
    console.error('Relais OpenAI non armé (variable NEXUS_RELAIS_OPENAI ou secret OPENAI_API_KEY absent) : rien envoyé.');
    return 0;
  }
  const corps = require('./lire-entree').lireEntreeStandard();
  const attendu = attenduDuReveil(corps);
  if (!attendu.lot || !attendu.request) { console.error('Corps de réveil illisible : LOT_ID ou demande introuvable.'); return 1; }
  let texte;
  try { texte = await appeler(corps); } catch (e) { console.error(`Panne du relais : ${e.message}`); return 1; }
  const v = valider(texte, attendu);
  if (!v.ok) { console.error('Réponse non conforme :\n- ' + v.refus.join('\n- ')); process.stdout.write(texte); return 2; }
  process.stdout.write(texte);
  return 0;
}

module.exports = { lireContrat, valider, attenduDuReveil };
if (require.main === module) principal().then(c => process.exit(c), e => { console.error(e.message); process.exit(1); });
