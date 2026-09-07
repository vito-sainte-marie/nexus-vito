// NEXUS Handoff v2 — commande `decision`.
//
// NEXUS-ORCHESTRATION-REPAIR-1-20260907/decision-2.md a porté `decision:
// REJECTED` jusque sur le disque : `verifier` l'a détecté, mais seulement
// après coup, et il a fallu une dérogation humaine ciblée pour débloquer le
// rail. `handoff.js decision` traite la cause : elle valide l'enveloppe
// canonique AVANT toute écriture, pour qu'un vocabulaire hors norme n'ait
// plus jamais l'occasion d'atteindre le registre. Ce test vérifie que le
// refus a bien lieu avant l'écriture — pas seulement que `verifier` s'en
// plaindrait ensuite.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'LOT-EPREUVE-DECISION-20260907';

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

// Un lot déjà ouvert (une demande, aucune décision) : le point de départ
// normal avant qu'une décision soit rendue.
function registreOuvert() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-decision-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'),
    ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, 'seq: 1',
     'author: Claude', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
     'token_mode: STANDARD', 'preuves:',
     '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
     '---', '', 'Corps de la demande.', ''].join('\n'));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' } },
  }, null, 2) + '\n');
  return dir;
}

function fichiersDecision(dir) {
  return fs.readdirSync(path.join(dir, 'lots', LOT)).filter(f => f.startsWith('decision-'));
}

function deposerDecision(dir, args) {
  const corps = path.join(dir, 'corps-decision.md');
  fs.writeFileSync(corps, '\n# Corps de la décision.\n');
  try {
    const sortie = execFileSync('node', [OUTIL, 'decision', LOT, corps, ...args],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('une décision canonique est acceptée et écrite avec l’enveloppe attendue', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED_WITH_CONDITIONS', '--closes', 'true', '--in-reply-to', 'request-1.md', '--author', 'ChatGPT']);
  assert.strictEqual(r.code, 0, 'une décision canonique doit être acceptée : ' + r.sortie);
  const contenu = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), 'utf8');
  assert.ok(/decision: APPROVED_WITH_CONDITIONS/.test(contenu), contenu);
  assert.ok(/closes: true/.test(contenu), contenu);
  assert.ok(/in_reply_to: request-1\.md/.test(contenu), contenu);
  assert.ok(/branch: config-par-environnement/.test(contenu), contenu);
  assert.ok(/seq: 1/.test(contenu), contenu);
  assert.ok(/Corps de la décision\./.test(contenu), 'le corps fourni doit être repris tel quel : ' + contenu);
});

verifier('une valeur hors vocabulaire est refusée AVANT toute écriture', () => {
  // Rejoue exactement le défaut réel : REJECTED n'appartient pas au
  // vocabulaire canonique (APPROVED|APPROVED_WITH_CONDITIONS|BLOCKED|NEEDS_EVIDENCE).
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'REJECTED', '--closes', 'true', '--in-reply-to', 'request-1.md']);
  assert.notStrictEqual(r.code, 0, 'REJECTED doit être refusé');
  assert.ok(/hors vocabulaire/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), [], 'aucun fichier decision-N.md ne doit avoir été écrit : ' + fichiersDecision(dir));
});

verifier('APPROVED_CLOSED (valeur legacy) est refusé AVANT toute écriture', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED_CLOSED', '--closes', 'true', '--in-reply-to', 'request-1.md']);
  assert.notStrictEqual(r.code, 0, 'APPROVED_CLOSED doit être refusé dans le registre v2');
  assert.ok(/legacy/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), []);
});

verifier('closes hors vocabulaire (ni true ni false) est refusé AVANT toute écriture', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'peut-etre', '--in-reply-to', 'request-1.md']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/closes doit valoir true ou false/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), []);
});

verifier('une branche protégée déclarée est refusée AVANT toute écriture', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md', '--branch', 'production']);
  assert.notStrictEqual(r.code, 0, 'une branche protégée doit être refusée');
  assert.ok(/ref protégée/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), []);
});

verifier('une branche inattendue (ni protégée ni autorisée) est refusée AVANT toute écriture', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md', '--branch', 'une-branche-quelconque']);
  assert.notStrictEqual(r.code, 0, 'une branche différente de config-par-environnement doit être refusée');
  assert.ok(/branch doit valoir config-par-environnement/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), []);
});

verifier('un in_reply_to vers une demande inexistante est refusé AVANT toute écriture', () => {
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-9.md']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/ne désigne aucune demande/.test(r.sortie), r.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), []);
});

verifier('un lot inexistant est refusé AVANT toute écriture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-decision-vide-'));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({ protocol: 'nexus-handoff/2', lots: {} }, null, 2) + '\n');
  const corps = path.join(dir, 'corps-decision.md');
  fs.writeFileSync(corps, '\n# Corps.\n');
  let code = 0, sortie = '';
  try {
    execFileSync('node', [OUTIL, 'decision', 'LOT-INEXISTANT-20260907', corps, '--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md'],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0, 'un lot introuvable doit être refusé');
  assert.ok(/lot introuvable/.test(sortie), sortie);
});

verifier('append-only et numérotation : deux décisions successives obtiennent seq 1 puis 2, sans écrasement', () => {
  const dir = registreOuvert();
  const r1 = deposerDecision(dir, ['--decision', 'NEEDS_EVIDENCE', '--closes', 'false', '--in-reply-to', 'request-1.md']);
  assert.strictEqual(r1.code, 0, r1.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), ['decision-1.md']);
  // Une seconde demande doit exister pour qu'une seconde décision réponde à
  // une cible réelle — sinon in_reply_to serait à bon droit refusé.
  fs.writeFileSync(path.join(dir, 'lots', LOT, 'request-2.md'),
    ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, 'seq: 2',
     'author: Claude', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
     'token_mode: STANDARD', 'preuves:',
     '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
     '---', '', 'Corps de la seconde demande.', ''].join('\n'));
  const r2 = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-2.md']);
  assert.strictEqual(r2.code, 0, r2.sortie);
  assert.deepStrictEqual(fichiersDecision(dir).sort(), ['decision-1.md', 'decision-2.md']);
  const premiere = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), 'utf8');
  assert.ok(/decision: NEEDS_EVIDENCE/.test(premiere), 'la première décision ne doit pas avoir été écrasée par la seconde : ' + premiere);
  const seconde = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-2.md'), 'utf8');
  assert.ok(/seq: 2/.test(seconde), seconde);
});

verifier('répondre deux fois à la même demande sans supersession explicite est refusé AVANT écriture', () => {
  const dir = registreOuvert();
  const r1 = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md']);
  assert.strictEqual(r1.code, 0, r1.sortie);
  const original = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), 'utf8');
  const r2 = deposerDecision(dir, ['--decision', 'BLOCKED', '--closes', 'false', '--in-reply-to', 'request-1.md']);
  assert.notStrictEqual(r2.code, 0, 'un second avis sur la même demande, sans --supersedes, doit être refusé');
  assert.ok(/déjà arbitrée par decision-1\.md/.test(r2.sortie), r2.sortie);
  assert.deepStrictEqual(fichiersDecision(dir), ['decision-1.md'], 'aucun second fichier ne doit avoir été écrit');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-1.md'), 'utf8'), original,
    'le fichier déjà déposé ne doit pas avoir changé');
});

verifier('répondre deux fois à la même demande AVEC --supersedes explicite est accepté', () => {
  const dir = registreOuvert();
  const r1 = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md']);
  assert.strictEqual(r1.code, 0, r1.sortie);
  const r2 = deposerDecision(dir, ['--decision', 'BLOCKED', '--closes', 'false', '--in-reply-to', 'request-1.md', '--supersedes', 'supersedes_correction_of', 'decision-1.md']);
  assert.strictEqual(r2.code, 0, 'une supersession explicite et correctement nommée doit être acceptée : ' + r2.sortie);
  assert.deepStrictEqual(fichiersDecision(dir).sort(), ['decision-1.md', 'decision-2.md']);
  const seconde = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-2.md'), 'utf8');
  assert.ok(/supersedes_correction_of: decision-1\.md/.test(seconde), seconde);
});

verifier('le résultat produit par la commande passe `verifier` sans erreur', () => {
  // La commande ne remplace pas `verifier` (voir le commentaire d'origine dans
  // outils/handoff.js) : ce test confirme seulement qu'elle ne produit rien
  // que `verifier` rejetterait ensuite pour une raison qu'elle aurait dû
  // empêcher elle-même.
  const dir = registreOuvert();
  const r = deposerDecision(dir, ['--decision', 'APPROVED', '--closes', 'true', '--in-reply-to', 'request-1.md']);
  assert.strictEqual(r.code, 0, r.sortie);
  // Le lot n'est pas encore consommé : STATE.json.lots[LOT].statut reste
  // ATTENTE_DECISION, ce que `verifier` accepte tel quel.
  const v = execFileSync('node', [OUTIL, 'verifier'],
    { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  assert.ok(/conformes/.test(v), v);
});

console.log(`\n${passes} vérifications passées — REJECTED (et tout autre hors-vocabulaire) n'atteint plus le disque.`);
