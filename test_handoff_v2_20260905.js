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

  // Retirée le 05/09/2026 : cette épreuve exigeait qu'une décision devienne
  // invalide dès qu'une demande plus récente arrive, ce qui réécrivait
  // rétroactivement le statut d'un arbitrage légitime. La fenêtre du commit
  // 67ecdce est désormais gardée là où elle compte — à la consommation —
  // et trois épreuves plus bas la couvrent.

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
  // Deux refus sont légitimes selon l'état du registre : la décision est déjà
  // consommée, ou elle ne répond plus à la demande active. Exiger l'un des
  // deux seulement rendrait le test dépendant du moment où on le lance.
  assert.ok(/déjà marquée consommée|mais la demande active est/.test(sortie),
    'le refus doit nommer sa raison : ' + sortie);
  assert.strictEqual(fs.readFileSync(path.join(RACINE, 'docs/handoff/STATE.json'), 'utf8'), avant,
    'un refus ne doit rien écrire');
});

function ecrireEtat(dir, muter) {
  const p = path.join(dir, 'STATE.json');
  const e = JSON.parse(fs.readFileSync(p, 'utf8'));
  muter(e);
  fs.writeFileSync(p, JSON.stringify(e, null, 2) + '\n');
}

verifier('un in_reply_to donné en chemin complet est normalisé', () => {
  // La forme attendue est le nom nu. Un chemin qui désigne le même fichier
  // relève de la manipulation de chemin, pas du vocabulaire : le refuser
  // serait de la pédanterie, l'accepter n'ouvre aucune ambiguïté.
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md',
    `in_reply_to: docs/handoff/lots/${LOT}/request-1.md`);
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'le chemin doit être accepté : ' + r.sortie);
});

verifier('une dérogation nommée transforme la violation visée en avertissement', () => {
  const dir = registreSain();
  fs.renameSync(path.join(dir, 'lots', LOT, 'decision-1.md'), path.join(dir, 'lots', LOT, 'decision-2.md'));
  remplacer(dir, 'decision-2.md', 'seq: 1', 'seq: 2');
  ecrireEtat(dir, e => { e.lots[LOT].derniere_decision = 'decision-2.md'; });
  assert.notStrictEqual(valider(dir).code, 0, 'sans dérogation, la violation doit bloquer');
  ecrireEtat(dir, e => {
    // Le mauvais numéro produit DEUX symptômes — séquence trouée et décision
    // répondant à une demande de rang inférieur. Une cause, deux contrôles :
    // la dérogation doit nommer chacun, elle ne couvre pas « tout ce qui vient
    // de cette déviation ».
    e.derogations = [
      { fichier: 'decision-2.md', regle: 'SEQUENCE_NON_CONTIGUE', motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' },
      { fichier: 'decision-2.md', regle: 'IN_REPLY_TO_ANTERIEUR', motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' },
    ];
  });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'avec dérogation, elle doit passer en avertissement : ' + r.sortie);
  assert.ok(/DÉROGATION SEQUENCE_NON_CONTIGUE/.test(r.sortie),
    'la dérogation doit rester bruyante à chaque exécution, pas silencieuse');
});

verifier('une dérogation ne couvre que la règle et le fichier qu’elle nomme', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => {
    e.derogations = [{ fichier: 'decision-1.md', regle: 'SEQUENCE_NON_CONTIGUE',
      motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' }];
  });
  remplacer(dir, 'decision-1.md', 'decision: APPROVED', 'decision: VALIDE');
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une autre violation du même fichier doit rester bloquante');
  assert.ok(/hors vocabulaire/.test(r.sortie));
});

verifier('une branche ABSENTE se déroge, une ref protégée jamais', () => {
  // Le garde confondait les deux : il traitait une omission comme une
  // revendication de travailler sur main ou production, et la rendait donc
  // indérogeable. Déclarer une ref protégée reste absolument bloqué.
  const absente = registreSain();
  remplacer(absente, 'decision-1.md', 'branch: config-par-environnement\n', '');
  assert.notStrictEqual(valider(absente).code, 0, 'une branche absente reste une violation');
  ecrireEtat(absente, e => {
    e.derogations = [{ fichier: 'decision-1.md', regle: 'BRANCHE_ABSENTE',
      motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' }];
  });
  const r = valider(absente);
  assert.strictEqual(r.code, 0, 'une omission de forme doit pouvoir être dérogée : ' + r.sortie);
});

verifier('aucune dérogation n’est recevable sur un invariant de sécurité', () => {
  const dir = registreSain();
  remplacer(dir, 'request-1.md', 'branch: config-par-environnement', 'branch: production');
  ecrireEtat(dir, e => {
    e.derogations = [{ fichier: 'request-1.md', regle: 'BRANCHE_PROTEGEE',
      motif: 'tentative de contournement', autorise_par: 'test', le: '2026-09-05' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une ref protégée ne se déroge pas');
  assert.ok(/invariant de sécurité/.test(r.sortie), r.sortie);
});

verifier('une dérogation incomplète est refusée', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => { e.derogations = [{ fichier: 'decision-1.md', regle: 'SEQUENCE_NON_CONTIGUE' }]; });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une exception sans motif ni auteur n’est pas auditable');
  assert.ok(/dérogation incomplète/.test(r.sortie));
});

verifier('consommer refuse un registre qui ne valide pas', () => {
  // Le trou de la v2 initiale : `consommer` n'appelait pas le validateur, donc
  // une décision refusée par le protocole pouvait être enregistrée comme
  // consommée — le silence exact que ce protocole existe pour supprimer.
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'decision: APPROVED', 'decision: VALIDE');
  let code = 0, sortie = '';
  try {
    execFileSync('node', [OUTIL, 'consommer', LOT],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0);
  assert.ok(/aucune décision ne peut être consommée dans cet état/.test(sortie), sortie);
});

verifier('une décision reste valide quand une demande plus récente arrive', () => {
  // Régression corrigée le 05/09/2026 : la règle exigeait que TOUTE décision
  // vise la demande la plus récente, ce qui rendait fausse rétroactivement une
  // décision légitimement rendue. Déposer request-2 ne périme pas decision-1.
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'request-2.md'),
    fs.readFileSync(path.join(lot, 'request-1.md'), 'utf8').replace('seq: 1', 'seq: 2'));
  ecrireEtat(dir, e => { e.lots[LOT].derniere_demande = 'request-2.md'; });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'l’historique ne doit pas devenir invalide après coup : ' + r.sortie);
});

verifier('une décision ne peut pas répondre à une demande antérieure à son rang', () => {
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.renameSync(path.join(lot, 'decision-1.md'), path.join(lot, 'decision-2.md'));
  remplacer(dir, 'decision-2.md', 'seq: 1', 'seq: 2');
  ecrireEtat(dir, e => { e.lots[LOT].derniere_decision = 'decision-2.md'; });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/antérieur au rang de la décision/.test(r.sortie), r.sortie);
});

verifier('deux décisions ne peuvent pas arbitrer la même demande', () => {
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'request-2.md'),
    fs.readFileSync(path.join(lot, 'request-1.md'), 'utf8').replace('seq: 1', 'seq: 2'));
  fs.writeFileSync(path.join(lot, 'decision-2.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8').replace('seq: 1', 'seq: 2'));
  ecrireEtat(dir, e => {
    e.lots[LOT].derniere_demande = 'request-2.md';
    e.lots[LOT].derniere_decision = 'decision-2.md';
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'decision-2 vise encore request-1');
  assert.ok(/déjà arbitrée par/.test(r.sortie), r.sortie);
});

verifier('consommer refuse une décision qui ne répond pas à la demande active', () => {
  // La fraîcheur ne se contrôle plus en permanence, mais au moment qui
  // compte : c'est la fenêtre exacte du commit 67ecdce, où une décision
  // consommée voisinait avec une demande ouverte.
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'request-2.md'),
    fs.readFileSync(path.join(lot, 'request-1.md'), 'utf8').replace('seq: 1', 'seq: 2'));
  ecrireEtat(dir, e => { e.lots[LOT].derniere_demande = 'request-2.md'; });
  let code = 0, sortie = '';
  try {
    execFileSync('node', [OUTIL, 'consommer', LOT],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0);
  assert.ok(/mais la demande active est request-2\.md/.test(sortie), sortie);
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
