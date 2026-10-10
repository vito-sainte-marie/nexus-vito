#!/usr/bin/env node
'use strict';
// Boucle autonome (préparée le 10/10/2026, NON armée) — épreuves de
// outils/relancer-claude-ci.js et de son câblage dans tests.yml.
//
//   X1  interrupteur débranché → rien ne part (juge, CLI, workflow, mutation)
//   X2  STOP au palier Frédéric ou BLOCKED → rien ne part, Frédéric à prévenir
//   X3  l'arbitre rend deux fois le même verdict → arrêt
//   X4  plafonds par lot (3) et par jour (10) de garde-boucle-autonome.js → arrêt
//   X5  conditions de la décision antérieure non prouvées → arrêt
//   et : charge utile réduite à cinq identifiants à motif fermé.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const assert = require('assert');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'relancer-claude-ci.js');
const B = require(OUTIL);
const G = require('./outils/garde-boucle-autonome.js');

let total = 0, passes = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log('  OK — ' + nom); } catch (e) { console.log('  ÉCHEC — ' + nom + '\n      ' + e.message); }
}

const ROUTAGE = require('./outils/escalade-humaine.js').chargerRegistre(RACINE).routage;
const CAPS = require('./outils/capacites-canal.js');
const REG_CAPS = CAPS.chargerRegistre(RACINE);
const STOP_FREDERIC = ROUTAGE.frederic[0];
const STOP_ARBITRE = ROUTAGE.arbitre[0];

function contrat(extra) {
  return Object.assign({
    DECISION: 'APPROVED', CLOSES: 'false', LOT: 'LOT-ESSAI-20261010', REQUEST: 'request-2.md',
    CONDITIONS: 'aucune', BLOCKER: 'aucun', STOP_REQUIRED: 'non', CAPACITE_REQUISE: 'DEPOT_ECRITURE_RAIL',
    OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'github-actions-claude', ACTION_NEXT: 'Écrire le correctif sur le rail.',
  }, extra);
}
const LOT = 'LOT-ESSAI-20261010';
const MAINTENANT = '2026-10-10T12:00:00.000Z';
const COMMIT = 'c'.repeat(40);
let suite = 0;
// Un tour antérieur du journal ; par défaut sur ce lot, ce matin, verdict distinct.
function tour(extra) {
  suite++;
  return Object.assign({
    lot: LOT, commit_decision: String(suite).padStart(40, 'b'), verdict_hash: B.empreinte(contrat({ ACTION_NEXT: `geste ${suite}` })),
    horodate: '2026-10-10T08:00:00.000Z', autorise: true, code: 'AUTORISE',
  }, extra);
}
const journal = tours => ({ version: 1, tours });

function entree(extra) {
  return Object.assign({
    interrupteur: 'arme', ci: 'success', contrat: contrat(), routage: ROUTAGE,
    capable: (canal, cap) => CAPS.capable(REG_CAPS, canal, cap),
    journal: journal([tour()]), commitDecision: COMMIT, maintenant: MAINTENANT, anterieure: null,
    ident: { lot: LOT, rail: 'handoff-continuite-20260920', decision: 'decision-2.md', request: 'request-2.md', sha: 'a'.repeat(40) },
  }, extra);
}
const verdict = e => B.decider(e).verdict;

// ── Un seul vocabulaire ─────────────────────────────────────────────────────
t('vocabulaire : les codes communs sont ceux de garde-boucle-autonome.js, sans doublon maison', () => {
  for (const c of Object.values(G.CODES)) assert.ok(B.VERDICTS.includes(c), c);
  for (const ancien of ['NON_ARME', 'CONTRAT_ABSENT', 'CI_NON_VERTE', 'PALIER_FREDERIC', 'PLAFOND_ILLISIBLE', 'PLAFOND_LOT', 'PLAFOND_JOUR', 'RELANCER']) {
    assert.ok(!B.VERDICTS.includes(ancien), ancien);
  }
  const src = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(!/NEXUS_BOUCLE_PLAFOND|PLAFONDS_DEFAUT/.test(src), 'aucun plafond propre au juge');
  assert.ok(src.includes('G.evaluerTour('), 'le juge délègue à la garde commune');
});

// ── Témoin : tout passe ─────────────────────────────────────────────────────
t('témoin : une entrée complète rend AUTORISE et une charge nexus-boucle-claude', () => {
  const v = B.decider(entree());
  assert.strictEqual(v.verdict, 'AUTORISE');
  assert.strictEqual(v.relancer, true);
  assert.strictEqual(v.notifier, false);
  assert.strictEqual(v.payload.event_type, 'nexus-boucle-claude');
});

// ── X1 ──────────────────────────────────────────────────────────────────────
t('X1 : interrupteur absent, vide, « armé », « ARME », « arme » entouré d\'espaces → DESARME, rien ne part', () => {
  for (const i of [undefined, '', 'armé', 'ARME', 'oui', 'true', ' arme']) {
    const v = B.decider(entree({ interrupteur: i }));
    assert.strictEqual(v.verdict, 'DESARME', `interrupteur ${JSON.stringify(i)}`);
    assert.strictEqual(v.relancer, false);
    assert.strictEqual(v.notifier, false);
    assert.ok(!('payload' in v));
  }
});

t('X1 : l\'interrupteur est jugé avant tout le reste (même un rouge rend DESARME)', () => {
  assert.strictEqual(verdict(entree({ interrupteur: '', ci: 'failure', contrat: null })), 'DESARME');
});

// ── Ordre et verdicts communs ───────────────────────────────────────────────
t('contrat absent ou sans DECISION → AUCUNE_NOUVELLE_DEMANDE', () => {
  assert.strictEqual(verdict(entree({ contrat: null })), 'AUCUNE_NOUVELLE_DEMANDE');
  const v = B.decider(entree({ contrat: { CLOSES: 'false' } }));
  assert.strictEqual(v.verdict, 'AUCUNE_NOUVELLE_DEMANDE');
  assert.match(v.motif, /NEXT_ACTION_CONTRACT/);
});

t('CI non verte (failure, cancelled, vide) → CI_ROUGE', () => {
  for (const ci of ['failure', 'cancelled', '', undefined]) assert.strictEqual(verdict(entree({ ci })), 'CI_ROUGE');
});

t('décision déjà au journal pour ce lot → DECISION_DEJA_TRAITEE', () => {
  assert.strictEqual(verdict(entree({ journal: journal([tour({ commit_decision: COMMIT })]) })), 'DECISION_DEJA_TRAITEE');
  assert.strictEqual(verdict(entree({ journal: journal([tour({ commit_decision: COMMIT, lot: 'AUTRE-LOT' })]) })), 'AUTORISE');
});

// ── X2 ──────────────────────────────────────────────────────────────────────
t('X2 : STOP du palier Frédéric → STOP_HUMAIN avec notifier', () => {
  const v = B.decider(entree({ contrat: contrat({ DECISION: 'BLOCKED', STOP_REQUIRED: STOP_FREDERIC, OWNER_NEXT: 'Frédéric' }) }));
  assert.strictEqual(v.verdict, 'STOP_HUMAIN');
  assert.strictEqual(v.notifier, true);
  assert.strictEqual(v.relancer, false);
  assert.ok(v.motif.includes(STOP_FREDERIC));
});

t('X2 : un code Frédéric suffit, même si OWNER_NEXT dit Claude, et domine une CI rouge', () => {
  assert.strictEqual(verdict(entree({ contrat: contrat({ STOP_REQUIRED: STOP_FREDERIC }) })), 'STOP_HUMAIN');
  assert.strictEqual(verdict(entree({ ci: 'failure', contrat: contrat({ STOP_REQUIRED: STOP_FREDERIC }) })), 'STOP_HUMAIN');
});

t('X2 : OWNER_NEXT Frédéric suffit, même sans code', () => {
  const v = B.decider(entree({ contrat: contrat({ OWNER_NEXT: 'Frédéric', STOP_REQUIRED: 'non' }) }));
  assert.strictEqual(v.verdict, 'STOP_HUMAIN');
});

t('BLOCKED sans palier Frédéric → BLOQUE avec notifier', () => {
  const v = B.decider(entree({ contrat: contrat({ DECISION: 'BLOCKED', BLOCKER: 'preuve manquante' }) }));
  assert.strictEqual(v.verdict, 'BLOQUE');
  assert.strictEqual(v.notifier, true);
});

t('STOP de l\'arbitre, STOP inconnu, STOP vide → STOP_ARBITRE', () => {
  assert.strictEqual(verdict(entree({ contrat: contrat({ STOP_REQUIRED: STOP_ARBITRE }) })), 'STOP_ARBITRE');
  assert.strictEqual(verdict(entree({ contrat: contrat({ STOP_REQUIRED: 'CODE_INVENTE' }) })), 'STOP_ARBITRE');
  assert.strictEqual(verdict(entree({ contrat: contrat({ STOP_REQUIRED: '' }) })), 'STOP_ARBITRE', 'un STOP vide ne vaut jamais « non »');
});

t('exécutant autre que github-actions-claude (y compris « CI du rail ») → CANAL_INCAPABLE', () => {
  for (const x of ['CI du rail', 'Claude', 'github-actions-claude-bis', '']) {
    assert.strictEqual(verdict(entree({ contrat: contrat({ EXECUTANT_NEXT: x }) })), 'CANAL_INCAPABLE', x);
  }
});

t('capacité que github-actions-claude ne détient pas → CANAL_INCAPABLE ; « aucune » passe', () => {
  const non = Object.keys(REG_CAPS.capacites).find(k => !CAPS.capable(REG_CAPS, 'github-actions-claude', k));
  assert.ok(non, 'le registre déclare au moins une capacité NON pour github-actions-claude');
  assert.strictEqual(verdict(entree({ contrat: contrat({ CAPACITE_REQUISE: non }) })), 'CANAL_INCAPABLE');
  assert.strictEqual(verdict(entree({ contrat: contrat({ CAPACITE_REQUISE: 'aucune' }) })), 'AUTORISE');
  assert.strictEqual(verdict(entree({ contrat: contrat({ CAPACITE_REQUISE: '' }) })), 'CANAL_INCAPABLE', 'vide n\'est pas « aucune »');
});

t('décision qui clôt le lot → RIEN_A_FAIRE', () => {
  assert.strictEqual(verdict(entree({ contrat: contrat({ CLOSES: 'true' }) })), 'RIEN_A_FAIRE');
});

// ── X4 ──────────────────────────────────────────────────────────────────────
t('X4 : 3 tours déjà au lot → PLAFOND_LOT_ATTEINT ; 2 → passe', () => {
  assert.strictEqual(G.PLAFOND_TOURS_PAR_LOT, 3);
  assert.strictEqual(verdict(entree({ journal: journal([tour(), tour()]) })), 'AUTORISE');
  const v = B.decider(entree({ journal: journal([tour(), tour(), tour()]) }));
  assert.strictEqual(v.verdict, 'PLAFOND_LOT_ATTEINT');
  assert.strictEqual(v.notifier, true);
});

t('X4 : 10 tours aujourd\'hui tous lots confondus → PLAFOND_JOUR_ATTEINT ; 9, ou 10 hier → passe', () => {
  assert.strictEqual(G.PLAFOND_TOURS_PAR_JOUR, 10);
  const autres = (n, horodate = '2026-10-10T08:00:00.000Z') => Array.from({ length: n }, () => tour({ lot: '(autre lot)', horodate }));
  assert.strictEqual(verdict(entree({ journal: journal(autres(9)) })), 'AUTORISE');
  assert.strictEqual(verdict(entree({ journal: journal(autres(10, '2026-10-09T23:59:59.000Z')) })), 'AUTORISE');
  const v = B.decider(entree({ journal: journal(autres(10)) }));
  assert.strictEqual(v.verdict, 'PLAFOND_JOUR_ATTEINT');
  assert.strictEqual(v.notifier, true);
});

// ── X3 ──────────────────────────────────────────────────────────────────────
t('X3 : le dernier tour du lot porte le même verdict (casse, espaces, backticks près) → VERDICT_REPETE', () => {
  const h = B.empreinte(contrat({ ACTION_NEXT: '`Écrire  le correctif sur le RAIL.`', HEAD: 'autre', LEASE: 'autre' }));
  assert.strictEqual(h, B.empreinte(contrat()));
  const v = B.decider(entree({ journal: journal([tour({ verdict_hash: h })]) }));
  assert.strictEqual(v.verdict, 'VERDICT_REPETE');
  assert.strictEqual(v.notifier, true);
});

t('X3 : un verdict qui a avancé, ou une répétition plus ancienne, ou celle d\'un autre lot → passe', () => {
  const h = B.empreinte(contrat());
  assert.strictEqual(verdict(entree({ journal: journal([tour()]) })), 'AUTORISE');
  assert.strictEqual(verdict(entree({ journal: journal([tour({ verdict_hash: h }), tour()]) })), 'AUTORISE');
  assert.strictEqual(verdict(entree({ journal: journal([tour({ verdict_hash: h, lot: 'AUTRE-LOT' })]) })), 'AUTORISE');
});

// ── X5 ──────────────────────────────────────────────────────────────────────
t('X5 : décision antérieure à conditions, preuve absente → CONDITIONS_NON_PROUVEES', () => {
  const v = B.decider(entree({ anterieure: { nom: 'decision-1.md', exige: true, prouvee: false } }));
  assert.strictEqual(v.verdict, 'CONDITIONS_NON_PROUVEES');
  assert.strictEqual(v.notifier, true);
  assert.match(v.motif, /Preuve des conditions de decision-1 /);
});

t('X5 : preuve présente ou rien exigé → passe', () => {
  assert.strictEqual(verdict(entree({ anterieure: { nom: 'decision-1.md', exige: true, prouvee: true } })), 'AUTORISE');
  assert.strictEqual(verdict(entree({ anterieure: { nom: 'decision-1.md', exige: false, prouvee: false } })), 'AUTORISE');
});

// ── Charge utile ────────────────────────────────────────────────────────────
t('charge utile : exactement cinq identifiants, aucun texte de l\'arbitre', () => {
  const v = B.decider(entree());
  assert.deepStrictEqual(Object.keys(v.payload).sort(), ['client_payload', 'event_type']);
  assert.deepStrictEqual(Object.keys(v.payload.client_payload).sort(), ['decision', 'lot', 'rail', 'request', 'sha']);
  assert.ok(!JSON.stringify(v.payload).includes('correctif'), 'ACTION_NEXT ne voyage pas');
});

t('charge utile : injection, main, production, SHA court → IDENTIFIANT_INVALIDE', () => {
  const base = entree().ident;
  const essais = [
    { rail: 'main' }, { rail: 'production' }, { rail: 'handoff-x\n@claude' }, { rail: 'handoff-x; rm -rf /' },
    { lot: 'lot-minuscule' }, { lot: 'LOT\n@claude' }, { decision: 'decision-0.md' }, { decision: '../STATE.json' },
    { request: 'request-2.md\nX' }, { sha: 'abc123' }, { sha: 'A'.repeat(40) }, { sha: undefined },
  ];
  for (const x of essais) {
    // Le journal de la garde est indexé par lot : un lot hors motif ne doit
    // pas y trouver par hasard un plafond qui le refuserait avant.
    const v = B.decider(entree({ ident: Object.assign({}, base, x), journal: journal([]) }));
    assert.strictEqual(v.verdict, 'IDENTIFIANT_INVALIDE', JSON.stringify(x));
    assert.ok(!v.payload);
  }
});

t('chaque verdict déclaré est atteint par au moins une épreuve', () => {
  const h = B.empreinte(contrat());
  const vus = new Set([
    verdict(entree({ interrupteur: '' })), verdict(entree({ contrat: null })), verdict(entree({ ci: 'failure' })),
    verdict(entree({ journal: journal([tour({ commit_decision: COMMIT })]) })),
    verdict(entree({ contrat: contrat({ STOP_REQUIRED: STOP_FREDERIC }) })), verdict(entree({ contrat: contrat({ DECISION: 'BLOCKED' }) })),
    verdict(entree({ contrat: contrat({ STOP_REQUIRED: STOP_ARBITRE }) })), verdict(entree({ contrat: contrat({ EXECUTANT_NEXT: 'x' }) })),
    verdict(entree({ contrat: contrat({ CLOSES: 'true' }) })),
    verdict(entree({ journal: journal([tour(), tour(), tour()]) })),
    verdict(entree({ journal: journal(Array.from({ length: 10 }, () => tour({ lot: '(autre lot)' }))) })),
    verdict(entree({ journal: journal([tour({ verdict_hash: h })]) })),
    verdict(entree({ anterieure: { nom: 'decision-1.md', exige: true, prouvee: false } })),
    verdict(entree({ ident: {}, journal: journal([]) })), verdict(entree()),
  ]);
  assert.deepStrictEqual([...vus].sort(), [...B.VERDICTS].sort());
});

t('notifier : exactement STOP_HUMAIN, VERDICT_REPETE, les deux plafonds, BLOQUE, CONDITIONS_NON_PROUVEES', () => {
  assert.deepStrictEqual([...B.A_NOTIFIER].sort(), ['BLOQUE', 'CONDITIONS_NON_PROUVEES', 'PLAFOND_JOUR_ATTEINT', 'PLAFOND_LOT_ATTEINT', 'STOP_HUMAIN', 'VERDICT_REPETE']);
  for (const c of B.A_NOTIFIER) assert.ok(B.VERDICTS.includes(c), c);
});

// ── Lecture du rail et CLI, sur un dépôt jetable ────────────────────────────
function decisionCI(n, c, extra) {
  const champs = Object.entries(c).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\nprotocol: nexus-handoff/2\nkind: decision\nlot_id: LOT-ESSAI-20261010\nseq: ${n}\nauthor: ChatGPT\nbranch: handoff-continuite-20260920\ndecision: ${c.DECISION}\ncloses: ${c.CLOSES}\nin_reply_to: request-${n}.md\n---\n# Décision\n\n_${extra || 'Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026)._'}\n\nNEXT_ACTION_CONTRACT\n${champs}\n`;
}
function depotJetable(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'boucle-'));
  const g = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q'); g('config', 'user.email', 'e@x'); g('config', 'user.name', 'essai');
  fs.mkdirSync(path.join(d, 'docs', 'handoff', 'lots', 'LOT-ESSAI-20261010'), { recursive: true });
  for (const f of ['ARBITRAGES-ACQUIS.json', 'CAPACITES-CANAL.json']) {
    fs.copyFileSync(path.join(RACINE, 'docs', 'handoff', f), path.join(d, 'docs', 'handoff', f));
  }
  g('add', '-A'); g('commit', '-qm', 'base');
  for (const [nom, texte, msg] of fichiers) {
    fs.writeFileSync(path.join(d, 'docs', 'handoff', 'lots', 'LOT-ESSAI-20261010', nom), texte);
    g('add', '-A'); g('commit', '-qm', msg || `${nom}`);
  }
  return d;
}
const LOT_DIR = d => path.join(d, 'docs', 'handoff', 'lots', 'LOT-ESSAI-20261010');
const shaDe = (d, rel) => execFileSync('git', ['log', '--format=%H', '--', rel], { cwd: d, encoding: 'utf8' }).trim().split('\n').pop();
const REL = nom => `docs/handoff/lots/LOT-ESSAI-20261010/${nom}`;

t('lireHistorique : journal des décisions CI antérieures, commit de la décision, antérieure non prouvée', () => {
  const c1 = contrat({ DECISION: 'APPROVED_WITH_CONDITIONS', CONDITIONS: 'joindre la sortie du banc' });
  const d = depotJetable([
    ['request-1.md', '# demande 1\n'],
    ['decision-1.md', decisionCI(1, c1), 'decision-1 matérialisée par la CI, stade a'],
    ['notes-autre-lot.md', 'x\n', 'decision-3 AUTRE-LOT matérialisée par la CI, stade a'],
    ['request-2.md', '# demande 2\n\nsans section de preuve\n'],
    ['decision-2.md', decisionCI(2, contrat()), 'decision-2 matérialisée par la CI, stade a'],
  ]);
  try {
    const h = B.lireHistorique({ racine: d, lot: LOT, decision: 'decision-2.md', rev: 'HEAD' });
    assert.strictEqual(h.request, 'request-2.md');
    assert.strictEqual(h.commitDecision, shaDe(d, REL('decision-2.md')));
    const duLot = h.journal.tours.filter(x => x.lot === LOT);
    assert.strictEqual(duLot.length, 1, 'decision-1 seule ; la décision courante n\'est pas un tour antérieur');
    assert.strictEqual(duLot[0].commit_decision, shaDe(d, REL('decision-1.md')));
    assert.strictEqual(duLot[0].verdict_hash, B.empreinte(c1));
    assert.match(duLot[0].horodate, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/, 'horodate en UTC');
    assert.strictEqual(h.journal.tours.filter(x => x.lot === '(autre lot)').length, 1, 'le tour d\'un autre lot compte au jour, une seule fois');
    assert.deepStrictEqual(h.anterieure, { nom: 'decision-1.md', exige: true, prouvee: false });
    assert.strictEqual(h.contrat.EXECUTANT_NEXT, 'github-actions-claude');
    // La preuve n'est reconnue que sous le titre exact.
    fs.writeFileSync(path.join(LOT_DIR(d), 'request-2.md'), '# demande 2\n\n## Preuve des conditions de decision-1\n\nsortie jointe\n');
    assert.strictEqual(B.lireHistorique({ racine: d, lot: LOT, decision: 'decision-2.md', rev: 'HEAD' }).anterieure.prouvee, true);
    fs.writeFileSync(path.join(LOT_DIR(d), 'request-2.md'), '# demande 2\n\n## Preuve des conditions de decision-10\n');
    assert.strictEqual(B.lireHistorique({ racine: d, lot: LOT, decision: 'decision-2.md', rev: 'HEAD' }).anterieure.prouvee, false);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

t('lireHistorique : une décision humaine n\'est pas un tour ; un autre jour ne compte pas au jour', () => {
  const humaine = decisionCI(1, contrat(), 'Matérialisée par Claude sur décision de Frédéric.');
  const d = depotJetable([
    ['decision-1.md', humaine, 'decision-1 par Frédéric'],
    ['notes-autre-lot.md', 'x\n', 'decision-3 AUTRE-LOT matérialisée par la CI, stade a'],
    ['request-2.md', '# demande 2\n'],
    ['decision-2.md', decisionCI(2, contrat()), 'decision-2 matérialisée par la CI, stade a'],
  ]);
  try {
    const demain = new Date(Date.now() + 86400000).toISOString();
    assert.deepStrictEqual(B.lireHistorique({ racine: d, lot: LOT, decision: 'decision-2.md', rev: 'HEAD', maintenant: demain }).journal.tours, []);
    const h = B.lireHistorique({ racine: d, lot: LOT, decision: 'decision-2.md', rev: 'HEAD' });
    assert.deepStrictEqual(h.journal.tours.map(x => x.lot), ['(autre lot)']);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

function cli(d, env, decision) {
  const sortie = path.join(d, 'charge.json');
  fs.writeFileSync(sortie, 'résidu d\'un run précédent');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: d, encoding: 'utf8' }).trim();
  const e = Object.assign({}, process.env);
  delete e.NEXUS_BOUCLE_AUTONOME;
  const r = spawnSync(process.execPath, [OUTIL, '--lot', LOT, '--decision', decision || 'decision-1.md', '--rail', 'handoff-continuite-20260920',
    '--sha', sha, '--ci', 'success', '--sortie', sortie, '--racine', d], { env: Object.assign(e, env), encoding: 'utf8' });
  return { r, sortie, json: r.stdout ? JSON.parse(r.stdout) : null, charge: fs.existsSync(sortie) ? fs.readFileSync(sortie, 'utf8') : null };
}
const ARME = { NEXUS_BOUCLE_AUTONOME: 'arme' };
const tourCI = n => [[`request-${n}.md`, `# d${n}\n`], [`decision-${n}.md`, decisionCI(n, contrat({ ACTION_NEXT: `geste ${n}` })), `decision-${n} matérialisée par la CI, stade a`]];

t('X1 (CLI) : variable absente → DESARME, et le fichier de charge est effacé, pas laissé', () => {
  const d = depotJetable(tourCI(1));
  try {
    const { r, json, charge } = cli(d, {});
    assert.strictEqual(r.status, 0, r.stderr);
    assert.strictEqual(json.verdict, 'DESARME');
    assert.strictEqual(charge, null, 'aucun fichier de charge ne subsiste');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

t('CLI armée : écrit la charge contrôlée', () => {
  const d = depotJetable(tourCI(1));
  try {
    const a = cli(d, ARME);
    assert.strictEqual(a.json.verdict, 'AUTORISE', a.r.stdout + a.r.stderr);
    const p = JSON.parse(a.charge);
    assert.strictEqual(p.event_type, 'nexus-boucle-claude');
    assert.strictEqual(p.client_payload.request, 'request-1.md');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

t('X4 (CLI) : trois décisions CI antérieures au lot → la 4e rend PLAFOND_LOT_ATTEINT, la 3e passe', () => {
  const d = depotJetable([...tourCI(1), ...tourCI(2), ...tourCI(3), ...tourCI(4)]);
  try {
    assert.strictEqual(cli(d, ARME, 'decision-3.md').json.verdict, 'AUTORISE');
    const b = cli(d, ARME, 'decision-4.md');
    assert.strictEqual(b.json.verdict, 'PLAFOND_LOT_ATTEINT', b.r.stdout + b.r.stderr);
    assert.strictEqual(b.json.notifier, true);
    assert.strictEqual(b.charge, null);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

t('X3 (CLI) : l\'arbitre redépose le même verdict → VERDICT_REPETE lu dans l\'historique git', () => {
  const d = depotJetable([...tourCI(1),
    ['request-2.md', '# d2\n'], ['decision-2.md', decisionCI(2, contrat({ ACTION_NEXT: 'geste 1' })), 'decision-2 matérialisée par la CI, stade a']]);
  try {
    const b = cli(d, ARME, 'decision-2.md');
    assert.strictEqual(b.json.verdict, 'VERDICT_REPETE', b.r.stdout + b.r.stderr);
    assert.strictEqual(b.charge, null);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// ── X1 par mutation : débrancher l'interrupteur du juge doit se voir ───────
t('X1 (mutation) : si le juge ne transmet plus l\'interrupteur à la garde, il relance désarmé — ce fil est donc ce qui retient', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  const ancre = '    env: { [G.INTERRUPTEUR_VAR]: e.interrupteur },';
  assert.strictEqual(src.split(ancre).length, 2, 'ancre de mutation unique');
  const mutant = path.join(RACINE, 'outils', `.relancer-claude-ci-mutant-${process.pid}.js`);
  try {
    fs.writeFileSync(mutant, src.replace(ancre, "    env: { [G.INTERRUPTEUR_VAR]: 'arme' },"));
    delete require.cache[mutant];
    const M = require(mutant);
    assert.strictEqual(M.decider(entree({ interrupteur: undefined })).verdict, 'AUTORISE', 'le mutant doit relancer');
    assert.strictEqual(B.decider(entree({ interrupteur: undefined })).verdict, 'DESARME', 'l\'original refuse');
  } finally { fs.rmSync(mutant, { force: true }); }
});

// ── Câblage dans tests.yml ──────────────────────────────────────────────────
const WF = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'tests.yml'), 'utf8').split('\n');
const NOM_ETAPE = 'Boucle autonome — relancer Claude (repository_dispatch)';
function etape(nom) {
  const i = WF.findIndex(l => l === `      - name: ${nom}`);
  if (i < 0) return null;
  let j = i + 1;
  while (j < WF.length && !/^ {6}- name:/.test(WF[j]) && !/^ {2}[a-z_-]+:/.test(WF[j])) j++;
  return WF.slice(i, j).filter(l => !/^\s*#/.test(l));
}

t('X1 (workflow) : l\'étape d\'envoi n\'existe que sous vars.NEXUS_BOUCLE_AUTONOME == \'arme\'', () => {
  const e = etape(NOM_ETAPE);
  assert.ok(e, `étape « ${NOM_ETAPE} » absente de tests.yml`);
  const si = e.find(l => /^ {8}if:/.test(l));
  assert.ok(si && si.includes("vars.NEXUS_BOUCLE_AUTONOME == 'arme'"), si);
  assert.ok(si.includes("steps.materialisation.outputs.depose == '1'"), si);
  assert.ok(e.some(l => /NEXUS_BOUCLE_AUTONOME: \$\{\{ vars\.NEXUS_BOUCLE_AUTONOME \}\}/.test(l)), 'second verrou : la variable est transmise à l\'outil');
  assert.ok(!e.some(l => /NEXUS_BOUCLE_PLAFOND/.test(l)), 'les plafonds sont ceux de la garde, pas des variables');
});

t('l\'étape d\'envoi : un seul appel gh, POST /dispatches, charge rendue par l\'outil, aucun secret', () => {
  const corps = etape(NOM_ETAPE).join('\n');
  const appels = corps.match(/\bgh\s+\S+/g) || [];
  assert.deepStrictEqual(appels, ['gh api'], `appels gh : ${appels.join(', ')}`);
  assert.match(corps, /gh api --method POST "repos\/\$GITHUB_REPOSITORY\/dispatches" --input "\$CHARGE"/);
  assert.ok(!/secrets\./.test(corps), 'aucun secret');
  assert.ok(!/OPENAI|JUGEMENT/.test(corps), 'aucun texte de l\'arbitre');
  assert.match(corps, /node outils\/relancer-claude-ci\.js/);
  assert.match(corps, /if \[ "\$relancer" = true \]/);
});

t('stade (a) expose ses sorties sans gagner de jeton', () => {
  const e = etape('Réveil Orchestrateur — matérialisation de la décision (stade a)');
  assert.ok(e.some(l => l === '        id: materialisation'));
  const corps = e.join('\n');
  assert.match(corps, /depose=1/);
  assert.ok(!/GH_TOKEN|secrets\.|\bgh\s/.test(corps));
});

console.log(`\n${passes}/${total} tests passent`);
process.exit(passes === total ? 0 : 1);
