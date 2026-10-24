// Tour vide et consommation avant action — INC-20261015-001, lot 1 (15/10/2026).
//
// Le 15/10, decision-1 et decision-2 de NEXUS-FDJ-STOCK-Q1-ABSENT-20261015 ont
// été « consommées » par une session qui n'a rien exécuté : DECISION_CONSOMMEE
// ne signifiait plus « exécutée », et la garde de tour vide (« le rail a-t-il
// bougé ? ») était aveuglée par le commit de consommation lui-même.
//
// Chaque épreuve tourne dans un clone jetable (`git clone --shared`) : le
// registre réel n'est jamais touché. L'outil éprouvé est celui de l'arbre de
// travail. Les scénarios portent le numéro de la mission (0..16) ; ceux qui
// dépendent des lots 2 (OPERATIONS) ou 3 (branches lot/<id>) ne sont PAS ici.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const LOT = 'LOT-EPREUVE-TOURVIDE-20261015';
const RAIL = 'handoff-epreuve-tourvide-20261015';
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const refs = ['main', 'production'].map(r => [r, git(RACINE, 'rev-parse', `origin/${r}`)]);
const refsCourtes = refs.map(([r, s]) => `${r}=${s.slice(0, 7)}`).join(' ');

const demande = (seq) => ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: Claude', `branch: ${RAIL}`, 'status: AWAITING_DECISION', 'token_mode: STANDARD', 'wake_to: ChatGPT',
  'preuves:', '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsCourtes}`,
  '---', '', `Demande ${seq}.`, ''].join('\n');
const decision = (seq, closes) => ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, `seq: ${seq}`,
  'author: ChatGPT', `branch: ${RAIL}`, 'decision: APPROVED_WITH_CONDITIONS', `closes: ${closes}`,
  `in_reply_to: request-${seq}.md`, 'wake_to: Claude', '---', '', 'Décision.', ''].join('\n');

function banc({ closes = false } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tourvide-')));
  const clone = path.join(tmp, 'depot');
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', RACINE, clone]);
  git(clone, 'checkout', '-q', git(RACINE, 'rev-parse', 'HEAD'));
  for (const [r, s] of refs) git(clone, 'update-ref', `refs/remotes/origin/${r}`, s);
  for (const f of ['outils', 'docs/skills']) { /* l'arbre de travail prime sur le commit */
    /* hors fichiers cachés : les épreuves de mutation écrivent brièvement `.mut-*.js` dans outils/ ; un `cp -R` concurrent échouait en ENOENT (run 39474481132) */
    fs.cpSync(path.join(RACINE, f), path.join(clone, f), { recursive: true, filter: (src) => !path.basename(src).startsWith('.') });
  }
  const dir = path.join(clone, 'registre-epreuve');
  fs.mkdirSync(path.join(dir, 'lots', LOT), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), demande(1));
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), decision(1, closes));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md', rail: RAIL } },
  }, null, 2) + '\n');
  const valider = (m, identite) => { git(clone, 'add', '-A', '.'); const id = identite || ['user.name=epreuve', 'user.email=epreuve@invalid']; git(clone, '-c', id[0], '-c', id[1], 'commit', '-q', '--allow-empty', '-m', m); return git(clone, 'rev-parse', 'HEAD'); };
  // P5 (GOV-R1-IDENTITES-PROVENANCE-20261019) : `consommer` vérifie désormais
  // qu'une décision `author: ChatGPT` est committée par github-actions[bot]
  // (à défaut d'une provenance API) — exactement l'identité que la CI pose
  // réellement à la matérialisation (tests.yml:678-679). Le dépôt initial
  // porte cette identité pour que ces épreuves, qui ne portent pas sur la
  // provenance, continuent de mesurer ce qu'elles mesurent déjà.
  valider('registre d\'épreuve', ['user.name=github-actions[bot]', 'user.email=41898282+github-actions[bot]@users.noreply.github.com']);
  const outil = (...a) => {
    const envPlus = (a.length && typeof a[a.length - 1] === 'object' && a[a.length - 1] !== null) ? a.pop() : {};
    try { return { code: 0, sortie: execFileSync('node', [path.join(clone, 'outils', 'handoff.js'), ...a], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXUS_HANDOFF_DIR: dir, ...envPlus } }) }; }
    catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
  };
  return { clone, dir, tmp, outil, valider, etat: () => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8')) };
}
// Un commit de travail réel (hors registre), comme PROPRETE decision-1 (2a2f792e).
const travail = (b) => { fs.writeFileSync(path.join(b.clone, 'travail-reel.txt'), 'x\n'); return b.valider('travail réel'); };
// Un commit qui ne touche que le registre : celui de la consommation du 15/10 (ff3e7720).
const registreSeul = (b) => { const e = b.etat(); e.vu = Date.now(); fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); return b.valider('registre seul'); };

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
const OK = (r) => assert.strictEqual(r.code, 0, r.sortie);
const KO = (r, motif) => { assert.notStrictEqual(r.code, 0, `refus attendu :\n${r.sortie}`); if (motif) assert.ok(motif.test(r.sortie), `motif ${motif} attendu :\n${r.sortie}`); };

// ── Anomalies ──────────────────────────────────────────────────────────────
epreuve('S0 — la consommation nue d\'une décision qui prescrit une action n\'est plus DECISION_CONSOMMEE', () => {
  const b = banc();
  const r = b.outil('consommer', LOT);
  assert.notStrictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE', `consommée sans preuve d'action :\n${r.sortie}`);
});
epreuve('S8 — la prise en charge pose ATTENTE_CONSOMMATION_DECISION, sans consomme_le', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'ATTENTE_CONSOMMATION_DECISION');
  assert.ok(!v.consomme_le, 'une prise en charge ne consomme pas');
  assert.strictEqual(v.derniere_decision, 'decision-1.md');
  assert.strictEqual(b.etat().lot_actif, LOT);
  OK(b.outil('verifier'));
});
epreuve('S9 — une preuve d\'action qui n\'est qu\'un commit de registre est refusée', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = registreSeul(b);
  KO(b.outil('consommer', LOT, '--preuve-action', sha), /PREUVE_ACTION|registre/i);
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
});
epreuve('S10 — une preuve d\'action réelle consomme et se consigne', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = travail(b);
  OK(b.outil('consommer', LOT, '--preuve-action', sha));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'DECISION_CONSOMMEE');
  assert.strictEqual(v.preuve_action, sha);
  assert.ok(v.consomme_le);
  OK(b.outil('verifier'));
});
epreuve('S12 — un arrêt matérialisé (nouvelle demande) consomme ; sans arrêt, la décision reste prise en charge', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  KO(b.outil('consommer', LOT, '--arret', 'request-2.md'));                  // l'option n'existe plus : un nom de fichier ne prouve rien
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
  const corps = path.join(b.tmp, 'corps.md'); fs.writeFileSync(corps, 'Blocage : capacité absente.\n\n## Preuve des conditions de decision-1\n\nAucune condition exécutée : capacité absente, rien n\'a été fait.\n');
  OK(b.outil('demande', LOT, corps, '--rail', RAIL, '--wake-to', 'ChatGPT'));
  const v = b.etat().lots[LOT];
  assert.strictEqual(v.statut, 'ATTENTE_DECISION');
  assert.strictEqual(v.arret, 'request-2.md');
  assert.ok(v.consomme_le && !v.pris_en_charge_le);
  OK(b.outil('verifier'));
});
epreuve('S14 — action réussie mais consommation échouée : on reprend à la vérification, sans réexécuter', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge'));
  const sha = travail(b);
  KO(b.outil('consommer', LOT, '--preuve-action', 'deadbeef'));            // la consommation échoue
  assert.strictEqual(b.etat().lots[LOT].statut, 'ATTENTE_CONSOMMATION_DECISION');
  const r = b.outil('consommer', LOT, '--prise-en-charge');                 // relance de la session : idempotente
  OK(r); assert.ok(/déjà pris en charge/i.test(r.sortie), r.sortie);
  OK(b.outil('consommer', LOT, '--preuve-action', sha));                    // reprise
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
const handoffVu = (b) => require(path.join(b.clone, 'outils', 'handoff.js')).echanges(LOT, 'decision').length === 1;
epreuve('S15a — le réveil ne relance pas un lot pris en charge comme une décision à consommer', () => {
  const b = banc();
  const e0 = b.etat(); Object.assign(e0.lots[LOT], { statut: 'ATTENTE_CONSOMMATION_DECISION', derniere_decision: 'decision-1.md' });
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e0, null, 2) + '\n');
  process.env.NEXUS_HANDOFF_DIR = b.dir; // handoff.js lit son répertoire au chargement
  const { examiner } = require(path.join(b.clone, 'outils', 'reveil-handoff.js'));
  const lots = examiner(b.etat());
  assert.ok(handoffVu(b), 'garde-fou : le registre d\'épreuve doit être celui que lit examiner');
  assert.ok(!lots.some(l => l.lot === LOT && l.motif === 'DECISION_NON_CONSOMMEE'), JSON.stringify(lots));
  assert.ok(lots.some(l => l.lot === LOT && l.motif === 'PRISE_EN_CHARGE'), 'le lot doit être nommé PRISE_EN_CHARGE : '+JSON.stringify(lots));
});
epreuve('S15b — un tour vide (seul le registre a bougé) est reconnu, jamais un tour avec travail', () => {
  const G = require(path.join(RACINE, 'outils', 'garde-boucle-autonome.js'));
  assert.strictEqual(typeof G.evaluerTourVide, 'function', 'evaluerTourVide absente');
  const registre = { commits: [{ sha: 'ff3e7720', fichiers: ['docs/handoff/STATE.json'] }], nouvellesDemandes: [] };
  const r1 = G.evaluerTourVide(registre);
  assert.strictEqual(r1.vide, true); assert.strictEqual(r1.code, 'TOUR_VIDE'); assert.strictEqual(r1.consommer, false);
  const travailReel = { commits: [{ sha: '2a2f792e', fichiers: ['outils/x.js', 'docs/handoff/STATE.json'] }], nouvellesDemandes: [] };
  assert.strictEqual(G.evaluerTourVide(travailReel).vide, false);
  const arret = { commits: [{ sha: 'a', fichiers: ['docs/handoff/STATE.json'] }], nouvellesDemandes: ['request-2.md'] };
  assert.strictEqual(G.evaluerTourVide(arret).vide, false, 'une demande de blocage est une sortie vérifiée');
});
epreuve('S15c — un tour vide identique ne se relance pas', () => {
  const G = require(path.join(RACINE, 'outils', 'garde-boucle-autonome.js'));
  assert.strictEqual(typeof G.cleActionStable, 'function', 'cleActionStable absente');
  const base = { lot: LOT, decision: 'decision-1.md', rail: 'abc' };
  // Valeur figée : comparer k({}) à k({}) ne pouvait pas échouer (Guardian QA,
  // attendu_calcule_par_le_meme_appel). Le littéral vient d'une exécution
  // vérifiée à la main ; le changer exige de le décider.
  const FIGEE = '6b3fbecbbe8587fa';
  // Le même contrôle rejoue la vraie fonction et des mutants : il doit passer
  // sur la première et échouer sur chacun des autres.
  const controle = (f) => {
    const k = (o) => f({ ...base, ...o });
    assert.strictEqual(k({}), FIGEE, 'la clé n\'est plus la valeur figée');
    assert.notStrictEqual(k({}), k({ rail: 'def' }));
    assert.notStrictEqual(k({}), k({ decision: 'decision-2.md' }));
    assert.strictEqual(k({ operations: ['b', 'a'] }), k({ operations: ['a', 'b'] }), 'l\'ordre des opérations compte');
    assert.notStrictEqual(k({ operations: ['a'] }), k({ operations: ['b'] }));
  };
  controle(G.cleActionStable);
  const mutants = {
    'ignore le rail': (a) => G.cleActionStable({ ...a, rail: 'abc' }),
    'ignore la décision': (a) => G.cleActionStable({ ...a, decision: 'decision-1.md' }),
    'ignore les opérations': (a) => G.cleActionStable({ ...a, operations: [] }),
    'sensible à l\'ordre des opérations': (a) => require('crypto').createHash('sha256')
      .update([a.lot, a.decision, a.rail, (a.operations || []).join(',')].join('\n')).digest('hex').slice(0, 16),
    'non déterministe': (a) => G.cleActionStable(a) + String(Math.random()),
    'constante': () => FIGEE,
  };
  for (const [nom, f] of Object.entries(mutants)) {
    assert.throws(() => controle(f), `le mutant « ${nom} » n'est pas détecté`);
  }
});
epreuve('S15d — le watchdog connaît la prise en charge et nomme le tour vide (sans le relancer)', () => {
  const W = require(path.join(RACINE, 'outils', 'watchdog-stagnation.js'));
  assert.ok(W.CONTINUATION.PRISE_EN_CHARGE, 'position PRISE_EN_CHARGE absente');
  assert.strictEqual(W.famille('TOUR_VIDE'), 'TOUR_VIDE');
  const r = W.examiner({ lot: LOT, sha: 'abc', branche: RAIL, position: 'PRISE_EN_CHARGE' });
  assert.notStrictEqual(r.code, 'POSITION_INCONNUE', JSON.stringify(r));
  assert.strictEqual(W.classerArret({ code: 'TOUR_VIDE' }).relance_permise, true, 'nommé, pas humain');
});

// ── Non-régression : doivent passer avant ET après ─────────────────────────
epreuve('S1 — décision de clôture (closes: true) : consommation directe, sans action', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT));
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
});
epreuve('S3 — une décision déjà consommée ne se rejoue pas', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT));
  KO(b.outil('consommer', LOT), /déjà marquée consommée/);
});
epreuve('S13 — une décision périmée ne se consomme pas', () => {
  const b = banc();
  fs.writeFileSync(path.join(b.dir, 'lots', LOT, 'request-2.md'), demande(2));
  const e = b.etat(); e.lots[LOT].derniere_demande = 'request-2.md';
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); b.valider('demande 2');
  KO(b.outil('consommer', LOT, '--prise-en-charge'), /périmée|demande active/);
});
epreuve('S16 — un registre invalide refuse toute prise en charge', () => {
  const b = banc();
  const e = b.etat(); e.lots[LOT].statut = 'N_IMPORTE_QUOI';
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); b.valider('registre cassé');
  KO(b.outil('consommer', LOT, '--prise-en-charge'));
});

// ── OUTILLAGE-PRISE-EN-CHARGE-20261022 : identité de prise en charge ──────
// Le 22/10, decision-1 de JAUGEAGE-SAISIE-DIRECTE a été exécutée deux fois
// (c3eda0c2, session interactive ; 6c20b192, réveil autonome) : rien ne
// comparait qui avait déjà pris la décision en charge. `--prise-en-charge`
// compare désormais l'identité de CANAL (jamais l'auteur Git).
const CANAL = (nexusCanal, githubActions) => ({ NEXUS_CANAL: nexusCanal || '', GITHUB_ACTIONS: githubActions || '' });
const SESSION_LOCALE = CANAL('', '');
const RUNNER = CANAL('', 'true');

epreuve('S17 — RED : un exécutant différent se voit refuser la prise en charge, avec identité, date et commit', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge', SESSION_LOCALE));
  const avant = b.etat().lots[LOT];
  assert.strictEqual(avant.pris_en_charge_par, 'session-locale');
  const fichierAvant = fs.readFileSync(path.join(b.dir, 'STATE.json'), 'utf8');
  const r = b.outil('consommer', LOT, '--prise-en-charge', RUNNER);
  KO(r, /DECISION_DEJA_PRISE_EN_CHARGE/);
  assert.ok(r.sortie.includes('session-locale'), `identité initiale attendue :\n${r.sortie}`);
  assert.ok(r.sortie.includes(avant.pris_en_charge_le), `date attendue :\n${r.sortie}`);
  assert.ok(r.sortie.includes(avant.commit_decision.slice(0, 7)), `commit attendu :\n${r.sortie}`);
  assert.ok(r.sortie.includes('github-actions-claude'), `exécutant courant attendu :\n${r.sortie}`);
  // Rien ne bouge : le refus est bien un refus, pas une consommation déguisée.
  assert.strictEqual(fs.readFileSync(path.join(b.dir, 'STATE.json'), 'utf8'), fichierAvant, 'STATE.json modifié par un refus');
  assert.strictEqual(b.etat().lots[LOT].pris_en_charge_par, 'session-locale', 'l\'exécutant initial a été écrasé');
});
epreuve('S18 — cas voisin vert : le même exécutant qui reprend reste idempotent', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge', RUNNER));
  const r = b.outil('consommer', LOT, '--prise-en-charge', RUNNER);
  OK(r); assert.ok(/déjà pris en charge/i.test(r.sortie), r.sortie);
  assert.strictEqual(b.etat().lots[LOT].pris_en_charge_par, 'github-actions-claude');
});
epreuve('S19 — cas voisin vert : lot sans exécutant désigné (pris en charge avant ce correctif) reste permissif', () => {
  const b = banc();
  OK(b.outil('consommer', LOT, '--prise-en-charge', SESSION_LOCALE));
  const e = b.etat(); delete e.lots[LOT].pris_en_charge_par; // simule une prise en charge antérieure au champ
  fs.writeFileSync(path.join(b.dir, 'STATE.json'), JSON.stringify(e, null, 2) + '\n'); b.valider('registre sans exécutant désigné');
  const r = b.outil('consommer', LOT, '--prise-en-charge', RUNNER);
  OK(r); assert.ok(/déjà pris en charge/i.test(r.sortie), r.sortie);
});
epreuve('S20 — cas voisin vert : une décision closes:true n\'est jamais soumise à la comparaison d\'exécutant', () => {
  const b = banc({ closes: true });
  OK(b.outil('consommer', LOT, SESSION_LOCALE));
  assert.strictEqual(b.etat().lots[LOT].statut, 'DECISION_CONSOMMEE');
  OK(b.outil('verifier'));
});
epreuve('S21 — mutation : neutraliser la comparaison d\'exécutant doit faire rougir l\'épreuve', () => {
  const { executantConflit } = require(path.join(RACINE, 'outils', 'handoff.js'));
  // La fonction réelle : un désaccord d'identité est un conflit, une absence
  // d'identité précédente ou une identité identique ne l'est jamais.
  assert.strictEqual(executantConflit('session-locale', 'github-actions-claude'), true);
  assert.strictEqual(executantConflit('github-actions-claude', 'github-actions-claude'), false);
  assert.strictEqual(executantConflit(undefined, 'github-actions-claude'), false);
  assert.strictEqual(executantConflit('', 'github-actions-claude'), false);
  const controle = (f) => {
    assert.strictEqual(f('session-locale', 'github-actions-claude'), true, 'un vrai désaccord doit mordre');
    assert.strictEqual(f('github-actions-claude', 'github-actions-claude'), false, 'la reprise par le même exécutant ne mord pas');
    assert.strictEqual(f(undefined, 'github-actions-claude'), false, 'l\'absence d\'exécutant désigné ne mord pas');
  };
  controle(executantConflit);
  const mutants = {
    'toujours vrai': () => true,
    'toujours faux (neutralise le refus)': () => false,
    'ignore le précédent': (_p, c) => executantConflit(c, c),
    'compare par égalité au lieu de différence': (p, c) => p === c,
  };
  for (const [nom, f] of Object.entries(mutants)) {
    assert.throws(() => controle(f), `le mutant « ${nom} » n'est pas détecté`);
  }
});

console.log(`\n${total - echecs}/${total} scénarios`);
process.exit(echecs ? 1 : 0);
