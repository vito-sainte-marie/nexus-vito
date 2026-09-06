// NEXUS Handoff v2 — le protocole se garde lui-même.
//
// v1 tenait par la discipline de ses acteurs, et l'a montré : une décision
// S-4 déjà consommée est restée face à une demande S-5 ouverte, et
// `APPROVED_CLOSED` a fermé deux lots sans figurer nulle part au protocole.
// Ce test corrompt le registre d'une façon différente à chaque fois et exige
// que le validateur le voie. Un validateur qu'on ne met jamais en défaut ne
// prouve rien — c'est la leçon des vérifications anti-cosmétiques de C2-4.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'LOT-EPREUVE-20260905';

function refsReelles() {
  return ['main', 'production']
    .map(r => `${r}=${execFileSync('git', ['rev-parse', '--short', `origin/${r}`], { cwd: RACINE, encoding: 'utf8' }).trim()}`)
    .join(' ');
}

// Un registre jetable, complet et VALIDE. Chaque épreuve en repart et n'y
// change qu'une seule chose : sans cette base saine, on ne saurait pas si
// l'échec vient de la corruption visée ou d'un reste de la précédente.
function registreSain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'));
  const lot = path.join(dir, 'lots', LOT);
  fs.mkdirSync(lot, { recursive: true });
  fs.writeFileSync(path.join(lot, 'request-1.md'),
    ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, 'seq: 1',
     'author: Claude', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
     'token_mode: STANDARD', 'preuves:',
     '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
     '---', '', 'Corps de la demande.', ''].join('\n'));
  fs.writeFileSync(path.join(lot, 'decision-1.md'),
    ['---', 'protocol: nexus-handoff/2', 'kind: decision', `lot_id: ${LOT}`, 'seq: 1',
     'author: ChatGPT', 'branch: config-par-environnement', 'decision: APPROVED',
     'closes: true', 'in_reply_to: request-1.md', '---', '', 'Corps de la décision.', ''].join('\n'));
  fs.writeFileSync(path.join(dir, 'STATE.json'), JSON.stringify({
    protocol: 'nexus-handoff/2', lot_actif: LOT,
    lots: { [LOT]: { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-1.md',
      derniere_decision: 'decision-1.md', source_decision: 'registre',
      commit_decision: 'ffffffffffffffffffffffffffffffffffffffff',
      consomme_le: '2026-09-05T00:00:00.000Z' } },
  }, null, 2) + '\n');
  return dir;
}

function valider(dir) {
  try {
    const sortie = execFileSync('node', [OUTIL, 'verifier'],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// Sans cette première épreuve, toutes les suivantes pourraient passer avec un
// validateur qui refuse simplement tout.
verifier('un registre sain est accepté', () => {
  const dir = registreSain();
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'le registre sain doit passer : ' + r.sortie);
});

const epreuves = [
  ['un lot_id incohérent avec son répertoire échoue',
   d => remplacer(d, 'request-1.md', `lot_id: ${LOT}`, 'lot_id: AUTRE-LOT-20260905'), /lot_id/],

  ['un statut de demande hors vocabulaire échoue',
   d => remplacer(d, 'request-1.md', 'status: AWAITING_DECISION', 'status: EN_ATTENTE'), /status.*hors vocabulaire/],

  ['une décision hors vocabulaire échoue',
   d => remplacer(d, 'decision-1.md', 'decision: APPROVED', 'decision: VALIDE'), /hors vocabulaire/],

  ['APPROVED_CLOSED est refusé dans un fichier v2',
   d => remplacer(d, 'decision-1.md', 'decision: APPROVED', 'decision: APPROVED_CLOSED'), /legacy.*interdite dans le registre v2/],

  ['une décision sans in_reply_to échoue',
   d => remplacer(d, 'decision-1.md', 'in_reply_to: request-1.md\n', ''), /in_reply_to manquant/],

  ['un in_reply_to vers une demande inexistante échoue',
   d => remplacer(d, 'decision-1.md', 'in_reply_to: request-1.md', 'in_reply_to: request-9.md'), /ne désigne aucune demande/],

  ['une décision répondant à une demande périmée échoue',
   d => {
     // C'est exactement la fenêtre observée au commit 67ecdce : une décision
     // encore en place alors qu'une nouvelle demande a été déposée.
     const lot = path.join(d, 'lots', LOT);
     const nouvelle = fs.readFileSync(path.join(lot, 'request-1.md'), 'utf8').replace('seq: 1', 'seq: 2');
     fs.writeFileSync(path.join(lot, 'request-2.md'), nouvelle);
     remplacer(d, 'STATE.json', '"derniere_demande": "request-1.md"', '"derniere_demande": "request-2.md"');
   }, /n'est plus la demande active/],

  ['un token_mode inconnu échoue',
   d => remplacer(d, 'request-1.md', 'token_mode: STANDARD', 'token_mode: RAPIDE'), /token_mode.*hors vocabulaire/],

  ['une classe de preuve inconnue échoue',
   d => remplacer(d, 'request-1.md', 'classe: VERIFIED', 'classe: PROUVE'), /classe.*hors vocabulaire/],

  ['des refs protégées déclarées fausses échouent',
   d => remplacer(d, 'request-1.md', refsReelles(), 'main=0000000 production=0000000'),
   /refs protégées déclarées/],

  ['une branche protégée déclarée échoue',
   d => remplacer(d, 'request-1.md', 'branch: config-par-environnement', 'branch: production'),
   /ref protégée — refus/],

  ['une ligne d’enveloppe non reconnue échoue au lieu d’être ignorée',
   d => remplacer(d, 'request-1.md', 'token_mode: STANDARD', 'token_mode: STANDARD\nCECI N EST PAS UNE CLEF'),
   /non reconnue/],

  ['une séquence trouée échoue',
   d => fs.renameSync(path.join(d, 'lots', LOT, 'request-1.md'), path.join(d, 'lots', LOT, 'request-2.md')),
   /non contiguë|in_reply_to/],

  ['un STATE.json illisible échoue',
   d => fs.writeFileSync(path.join(d, 'STATE.json'), '{ pas du json'), /STATE.json illisible/],

  ['un STATE.json en désaccord avec le registre échoue',
   d => remplacer(d, 'STATE.json', '"derniere_demande": "request-1.md"', '"derniere_demande": "request-7.md"'),
   /absente du registre/],

  ['deux lots actifs simultanés échouent',
   d => remplacer(d, 'STATE.json', '"statut": "DECISION_CONSOMMEE"',
     '"statut": "ATTENTE_DECISION"\n    }, "AUTRE-LOT-20260905": {\n      "statut": "ATTENTE_DECISION"'),
   /un seul lot actif/],

  ['une consommation sans commit échoue',
   d => remplacer(d, 'STATE.json', '"commit_decision": "ffffffffffffffffffffffffffffffffffffffff"', '"commit_decision": null'),
   /consommé sans commit_decision/],
];

function remplacer(dir, fichier, ancien, nouveau) {
  const p = fichier === 'STATE.json' ? path.join(dir, 'STATE.json') : path.join(dir, 'lots', LOT, fichier);
  const s = fs.readFileSync(p, 'utf8');
  assert.ok(s.includes(ancien), `motif introuvable dans ${fichier} : ${ancien}`);
  fs.writeFileSync(p, s.replace(ancien, nouveau));
}

for (const [nom, corrompre, motif] of epreuves) {
  verifier(nom, () => {
    const dir = registreSain();
    corrompre(dir);
    const r = valider(dir);
    assert.notStrictEqual(r.code, 0, 'la corruption doit être détectée, or la validation a réussi');
    assert.ok(motif.test(r.sortie), `message attendu ${motif}, obtenu :\n${r.sortie}`);
  });
}

verifier('les miroirs v1 restent produits et signalés comme non canoniques', () => {
  const dir = registreSain();
  execFileSync('node', [OUTIL, 'miroirs'], { cwd: RACINE, env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  const current = fs.readFileSync(path.join(dir, 'CURRENT.md'), 'utf8');
  const decision = fs.readFileSync(path.join(dir, 'DECISION.md'), 'utf8');
  assert.ok(/MIROIR v1 — NE PAS ÉDITER/.test(current), 'CURRENT.md doit se déclarer miroir');
  assert.ok(/MIROIR v1 — NE PAS ÉDITER/.test(decision), 'DECISION.md doit se déclarer miroir');
  assert.ok(/Corps de la demande/.test(current), 'le miroir doit rester lisible tel quel par un lecteur v1');
  assert.ok(/Corps de la décision/.test(decision));
});

verifier('DECISION.md v1 n’est pas écrasé tant qu’aucune décision v2 n’existe', () => {
  // Sinon la régénération ferait disparaître sans trace l'arbitrage encore en
  // vigueur — le contraire de ce que le registre est censé garantir.
  const dir = registreSain();
  fs.unlinkSync(path.join(dir, 'lots', LOT, 'decision-1.md'));
  fs.writeFileSync(path.join(dir, 'DECISION.md'), 'ARBITRAGE V1 ENCORE EN VIGUEUR');
  execFileSync('node', [OUTIL, 'miroirs'], { cwd: RACINE, env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'DECISION.md'), 'utf8'), 'ARBITRAGE V1 ENCORE EN VIGUEUR');
});

verifier('une consommation dont le commit est introuvable est refusée', () => {
  const dir = registreSain();
  let code = 0;
  try {
    execFileSync('node', [OUTIL, 'consommer', LOT],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; }
  assert.notStrictEqual(code, 0, 'inscrire une trace invérifiable serait pire que ne rien inscrire');
});

verifier('une décision déjà consommée ne se rejoue pas', () => {
  // Éprouvé sur le registre RÉEL : c'est le seul endroit où les commits
  // existent vraiment. `consommer` refuse avant toute écriture, donc ce test
  // ne modifie rien — et il prouve la garde qui manquait à v1, où une
  // décision consommée restait en place, d'apparence autoritaire.
  const etat = JSON.parse(fs.readFileSync(path.join(RACINE, 'docs/handoff/STATE.json'), 'utf8'));
  const lot = etat.lot_actif;
  const v = etat.lots[lot];
  if (!v || !v.consomme_le) { console.log('   (aucune décision consommée au registre — épreuve sans objet)'); return; }
  const avant = fs.readFileSync(path.join(RACINE, 'docs/handoff/STATE.json'), 'utf8');
  let code = 0, sortie = '';
  try { execFileSync('node', [OUTIL, 'consommer', lot], { cwd: RACINE, encoding: 'utf8' }); }
  catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0, 'le rejeu d’une décision consommée doit être refusé');
  assert.ok(/déjà marquée consommée/.test(sortie), 'le refus doit nommer sa raison : ' + sortie);
  assert.strictEqual(fs.readFileSync(path.join(RACINE, 'docs/handoff/STATE.json'), 'utf8'), avant,
    'un refus ne doit rien écrire');
});

verifier('APPROVED_CLOSED reste lisible comme valeur legacy', () => {
  const mod = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(/APPROVED_CLOSED/.test(mod), 'la valeur legacy doit rester connue du validateur');
  assert.ok(/decision: 'APPROVED', closes: true, legacy: true/.test(mod),
    'elle doit se normaliser en mémoire, sans réécrire les fichiers historiques');
  assert.ok(!/DECISIONS_CANONIQUES = \[[^\]]*APPROVED_CLOSED/.test(mod),
    'elle ne doit jamais devenir canonique');
});

console.log(`\n${passes} vérifications passées — le protocole ne repose plus sur la discipline de ses acteurs.`);
