#!/usr/bin/env node
'use strict';
// Boucle autonome — faut-il relancer Claude après une décision matérialisée ?
//
// PRÉPARÉ LE 10/10/2026, NON ARMÉ. Le stade (a) dépose sur le rail la décision
// de l'arbitre ; ce qui manquait pour que le réveil soit autonome, c'est que
// l'exécutant désigné reparte sans qu'un humain écrive `@claude`. Cet outil
// ne relance rien lui-même : il JUGE, et rend au workflow soit un refus
// motivé, soit une charge utile `repository_dispatch` dont tous les champs
// sont contrôlés. L'envoi est le seul geste de l'étape qui l'appelle.
//
// Deux verrous, posés par Frédéric seul :
//   - l'étape de tests.yml n'existe que si `vars.NEXUS_BOUCLE_AUTONOME == 'arme'` ;
//   - cet outil relit la même variable dans son environnement et refuse sans
//     elle. Un `if:` effacé par mégarde ne suffit donc pas à faire partir
//     Claude : l'épreuve X1 le mesure.
//
// Un seul vocabulaire avec la garde du lot BOUCLE-AUTONOME-FAST-TRACK-
// PREPARATION-1 : les gardes communes (interrupteur, STOP du palier
// Frédéric, rien de nouveau, décision déjà traitée, verdict répété, CI,
// plafonds 3/lot et 10/jour) sont jugées par `evaluerTour` de
// garde-boucle-autonome.js, et nulle part ailleurs. Son journal n'est pas le
// fichier BOUCLE-AUTONOME-JOURNAL.json, éphémère en CI : il est relu dans
// l'historique git du rail, une entrée par décision déposée par le stade (a).
// Ce juge n'ajoute que ce que la garde ne sait pas voir : BLOCKED, STOP de
// l'arbitre, canal capable, lot clos, conditions antérieures prouvées,
// identifiants à motif fermé. Seul ce qui passe tout est AUTORISE.
//
// Aucun texte venu d'OpenAI ne voyage dans la charge utile : cinq
// identifiants, chacun validé par motif fermé. Claude relit la décision sur
// le rail, pas dans l'événement.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const G = require('./garde-boucle-autonome.js');

const RACINE = path.join(__dirname, '..');
const TYPE_EVENEMENT = 'nexus-boucle-claude';
const EXECUTANT_BOUCLE = 'github-actions-claude';
const MARQUE_CI = 'Matérialisé par la CI (stade (a)';
const GREP_JOUR = 'matérialisée par la CI, stade a';

// Mêmes formes que le reste de la chaîne : le rail est celui que le stade (a)
// admet (materialiser-decision-ci.js), jamais `main` ni `production`.
const MOTIFS = Object.freeze({
  lot: /^[A-Z0-9][A-Z0-9-]{2,80}$/,
  rail: /^handoff-[a-z0-9][a-z0-9-]*$/,
  decision: /^decision-[1-9][0-9]{0,3}\.md$/,
  request: /^request-[1-9][0-9]{0,3}\.md$/,
  sha: /^[0-9a-f]{40}$/,
});

// Codes de la garde commune, puis ceux que seul ce juge rend.
const CODES_PROPRES = Object.freeze([
  'BLOQUE', 'STOP_ARBITRE', 'CANAL_INCAPABLE', 'RIEN_A_FAIRE', 'CONDITIONS_NON_PROUVEES', 'IDENTIFIANT_INVALIDE',
]);
const VERDICTS = Object.freeze([...Object.values(G.CODES), ...CODES_PROPRES]);

// Arrêts qui demandent Frédéric. Les autres refus laissent la boucle au repos.
const A_NOTIFIER = Object.freeze([
  G.CODES.STOP_HUMAIN, G.CODES.VERDICT_REPETE, G.CODES.PLAFOND_LOT_ATTEINT, G.CODES.PLAFOND_JOUR_ATTEINT,
  'BLOQUE', 'CONDITIONS_NON_PROUVEES',
]);

// Le journal git ne connaît que les décisions déposées, jamais les
// évaluations refusées que la garde consignerait dans son fichier : un seul
// prédécesseur identique suffit à dire que l'arbitre se répète.
const SEUIL_VERDICT_REPETE = 1;

// Les champs qui font un verdict. HEAD, LEASE, GATE_STATE et PROOF_STATE
// changent d'un tour à l'autre sans que rien n'ait avancé : les inclure
// rendrait la répétition indétectable.
const CHAMPS_EMPREINTE = Object.freeze([
  'DECISION', 'CLOSES', 'CONDITIONS', 'BLOCKER', 'STOP_REQUIRED', 'ACTION_NEXT', 'EXECUTANT_NEXT',
]);

const net = v => String(v == null ? '' : v).normalize('NFC').replace(/`/g, '').trim();
// Vide n'est pas « aucune » : un champ absent ne vaut jamais feu vert.
const aucune = v => /^(aucune?s?|aucun|non|none|néant)$/i.test(net(v));

function empreinte(contrat) {
  const c = contrat || {};
  const norme = CHAMPS_EMPREINTE.map(k => [k, net(c[k]).replace(/\s+/g, ' ').toLowerCase()]);
  return crypto.createHash('sha256').update(JSON.stringify(norme)).digest('hex');
}

// Juge pur : aucune lecture de fichier, d'environnement ni de git. Tout ce
// qu'il sait lui est passé, pour que chaque borne s'éprouve isolément.
//
// e = {
//   interrupteur, ci,                     // 'arme' ; 'success'
//   contrat,                              // NEXT_ACTION_CONTRACT de la décision déposée
//   routage: { frederic: [], arbitre: [] },
//   capable: (canal, cap) => bool,
//   journal: { version: 1, tours: [] },   // décisions CI antérieures (lireHistorique)
//   commitDecision, maintenant,           // commit qui a déposé la décision ; ISO
//   anterieure: { nom, exige, prouvee },  // décision à laquelle répond la demande, ou null
//   ident: { lot, rail, decision, request, sha },
// }
function decider(e) {
  const r = (verdict, motif) => ({ relancer: false, verdict, motif, notifier: A_NOTIFIER.includes(verdict) });
  const c = e.contrat && typeof e.contrat === 'object' && net(e.contrat.DECISION) ? e.contrat : null;
  const stop = c ? net(c.STOP_REQUIRED) : '';
  const frederic = (e.routage && e.routage.frederic) || [];
  const arbitre = (e.routage && e.routage.arbitre) || [];
  const stops = c && (net(c.OWNER_NEXT) === 'Frédéric' || frederic.includes(stop)) ? [stop || 'OWNER_NEXT Frédéric'] : [];

  const g = G.evaluerTour({
    env: { [G.INTERRUPTEUR_VAR]: e.interrupteur },
    lot: e.ident && e.ident.lot,
    commitDecision: e.commitDecision,
    verdictHash: c ? empreinte(c) : undefined,
    motifsStopPresents: stops,
    ciConclusion: e.ci,
    nouvelleDecisionDisponible: !!c,
    journal: e.journal || { version: 1, tours: [] },
    maintenant: e.maintenant,
    seuilVerdictRepete: SEUIL_VERDICT_REPETE,
  });
  if (!g.autorise) {
    if (g.code === G.CODES.AUCUNE_NOUVELLE_DEMANDE) return r(g.code, 'aucun NEXT_ACTION_CONTRACT lisible dans la décision déposée');
    return r(g.code, g.motif);
  }

  if (net(c.DECISION) === 'BLOCKED') return r('BLOQUE', `DECISION BLOCKED (${net(c.BLOCKER) || 'sans bloqueur nommé'}) : rien ne part`);
  if (!aucune(stop)) {
    return r('STOP_ARBITRE', arbitre.includes(stop)
      ? `STOP ${stop} relève de l'arbitre : il tranche avant toute reprise`
      : `STOP ${stop || '(vide)'} hors routage : code inconnu, rien ne part`);
  }

  const executant = net(c.EXECUTANT_NEXT);
  const cap = net(c.CAPACITE_REQUISE);
  if (executant !== EXECUTANT_BOUCLE) return r('CANAL_INCAPABLE', `EXECUTANT_NEXT « ${executant} » n'est pas ${EXECUTANT_BOUCLE}`);
  if (!aucune(cap) && !(e.capable && e.capable(EXECUTANT_BOUCLE, cap))) {
    return r('CANAL_INCAPABLE', `${EXECUTANT_BOUCLE} ne détient pas ${cap} au registre des capacités`);
  }
  if (net(c.CLOSES) === 'true') return r('RIEN_A_FAIRE', 'la décision clôt le lot');

  const a = e.anterieure;
  if (a && a.exige && !a.prouvee) {
    return r('CONDITIONS_NON_PROUVEES', `la demande ne porte pas de section « ## Preuve des conditions de ${String(a.nom).replace(/\.md$/, '')} »`);
  }

  const ident = e.ident || {};
  for (const [k, m] of Object.entries(MOTIFS)) {
    if (!m.test(String(ident[k] || ''))) return r('IDENTIFIANT_INVALIDE', `${k} « ${String(ident[k] || '')} » hors motif`);
  }
  const client_payload = {};
  for (const k of Object.keys(MOTIFS)) client_payload[k] = ident[k];
  return { relancer: true, verdict: G.CODES.AUTORISE, motif: `${ident.lot} : ${ident.decision} → Claude`, notifier: false, payload: { event_type: TYPE_EVENEMENT, client_payload } };
}

// ── Lecture du rail ──────────────────────────────────────────────────────────

function frontmatter(texte) {
  const m = texte.match(/^---\n([\s\S]*?)\n---/);
  const f = {};
  if (m) for (const l of m[1].split('\n')) { const x = l.match(/^([a-z_]+):\s*(.*)$/); if (x) f[x[1]] = x[2].trim(); }
  return f;
}

const seq = nom => Number((nom.match(/-(\d+)\.md$/) || [])[1]);

// Ce qu'exige une décision de la demande suivante. Une décision sans contrat
// (matérialisée par un humain) exige une preuve si son verdict en pose.
function exigePreuve(texte, lireContrat) {
  const c = lireContrat(texte);
  if (c && net(c.DECISION)) return !aucune(c.CONDITIONS);
  return ['APPROVED_WITH_CONDITIONS', 'NEEDS_EVIDENCE'].includes(frontmatter(texte).decision);
}

// `%ct` plutôt que `%cI` : l'ISO de git porte le fuseau du committeur, et la
// garde compte les jours en UTC.
const isoDe = ct => new Date(Number(ct) * 1000).toISOString();

// Commit qui a ajouté le fichier : le plus ancien, au cas où il aurait été
// réécrit depuis.
function commitAjout(racine, rev, relatif) {
  const out = execFileSync('git', ['log', rev, '--diff-filter=A', '--format=%H %ct', '--', relatif], { cwd: racine, encoding: 'utf8' });
  const l = out.split('\n').filter(Boolean).pop();
  if (!l) return null;
  const [sha, ct] = l.split(' ');
  return { sha, horodate: isoDe(ct) };
}

// Le journal de la garde, reconstruit depuis git : un tour par décision que le
// stade (a) a déposée. Rien n'est écrit — la CI n'a pas de disque durable, le
// rail en est un.
function lireHistorique({ racine, lot, decision, rev, maintenant }) {
  const { lireContrat } = require('./relais-arbitre-openai.js');
  const relDossier = path.posix.join('docs', 'handoff', 'lots', lot);
  const dossier = path.join(racine, relDossier);
  const lire = nom => fs.readFileSync(path.join(dossier, nom), 'utf8');
  const texte = lire(decision);
  const n = seq(decision);
  const decisions = fs.readdirSync(dossier).filter(f => MOTIFS.decision.test(f)).sort((x, y) => seq(x) - seq(y));
  const request = frontmatter(texte).in_reply_to || '';

  // La décision qui précède la demande à laquelle celle-ci répond.
  let anterieure = null;
  const prec = decisions.filter(f => seq(f) < n).pop();
  if (prec && MOTIFS.request.test(request) && fs.existsSync(path.join(dossier, request))) {
    const nom = prec.replace(/\.md$/, '');
    const titre = new RegExp(`^## Preuve des conditions de ${nom}\\s*$`, 'm');
    anterieure = { nom: prec, exige: exigePreuve(lire(prec), lireContrat), prouvee: titre.test(lire(request)) };
  }

  const courant = commitAjout(racine, rev, path.posix.join(relDossier, decision));
  const commitDecision = courant ? courant.sha : null;

  const tours = [];
  for (const f of decisions.filter(x => seq(x) < n)) {
    const t = lire(f);
    if (!t.includes(MARQUE_CI)) continue;
    const c = commitAjout(racine, rev, path.posix.join(relDossier, f));
    if (!c) continue;
    const contrat = lireContrat(t);
    tours.push({ lot, commit_decision: c.sha, verdict_hash: contrat ? empreinte(contrat) : null, horodate: c.horodate, autorise: true, code: G.CODES.AUTORISE });
  }

  // Les autres tours du jour, tous lots confondus : seul leur nombre compte
  // pour le plafond quotidien.
  const jour = (maintenant ? new Date(maintenant) : new Date()).toISOString().slice(0, 10) + 'T00:00:00Z';
  const out = execFileSync('git', ['log', rev, `--since=${jour}`, `--grep=${GREP_JOUR}`, '--format=%H %ct'], { cwd: racine, encoding: 'utf8' });
  const connus = new Set(tours.map(t => t.commit_decision));
  for (const l of out.split('\n').filter(Boolean)) {
    const [sha, ct] = l.split(' ');
    if (sha === commitDecision || connus.has(sha)) continue;
    connus.add(sha);
    tours.push({ lot: '(autre lot)', commit_decision: sha, verdict_hash: null, horodate: isoDe(ct), autorise: true, code: G.CODES.AUTORISE });
  }

  return { contrat: lireContrat(texte), request, commitDecision, journal: { version: 1, tours }, anterieure };
}

function principal(argv) {
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const lot = opt('--lot'), decision = opt('--decision'), sortie = opt('--sortie');
  if (!lot || !decision || !sortie) {
    process.stderr.write('usage : relancer-claude-ci.js --lot L --decision decision-N.md --rail B --sha S --ci STATUT --sortie charge.json\n');
    return 1;
  }
  const racine = opt('--racine') || RACINE;
  const reg = require('./capacites-canal.js');
  const routage = require('./escalade-humaine.js').chargerRegistre(racine).routage;
  const caps = reg.chargerRegistre(racine);
  const maintenant = new Date().toISOString();
  const h = lireHistorique({ racine, lot, decision, rev: opt('--rev') || 'HEAD', maintenant });
  const v = decider({
    interrupteur: process.env[G.INTERRUPTEUR_VAR],
    ci: opt('--ci'),
    contrat: h.contrat,
    routage,
    capable: (canal, cap) => reg.capable(caps, canal, cap),
    journal: h.journal,
    commitDecision: h.commitDecision,
    maintenant,
    anterieure: h.anterieure,
    ident: { lot, rail: opt('--rail'), decision, request: h.request, sha: opt('--sha') },
  });
  try { fs.unlinkSync(sortie); } catch (_) { /* absente */ }
  if (v.relancer) fs.writeFileSync(sortie, JSON.stringify(v.payload) + '\n');
  process.stdout.write(JSON.stringify({ relancer: v.relancer, verdict: v.verdict, motif: v.motif, notifier: !!v.notifier }) + '\n');
  return 0;
}

if (require.main === module) {
  try { process.exitCode = principal(process.argv.slice(2)); } catch (err) {
    process.stderr.write(`relancer-claude-ci : ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { TYPE_EVENEMENT, EXECUTANT_BOUCLE, MOTIFS, VERDICTS, A_NOTIFIER, SEUIL_VERDICT_REPETE, CHAMPS_EMPREINTE, empreinte, decider, lireHistorique, principal };
