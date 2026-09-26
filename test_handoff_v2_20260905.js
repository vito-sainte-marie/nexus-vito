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

function valider(dir, envPlus) {
  try {
    const sortie = execFileSync('node', [OUTIL, 'verifier'],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir, ...(envPlus || {}) } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

// Une suite qui meurt sur le premier rouge cache tous les suivants. Le
// 21/09/2026 une seule épreuve fragile a masqué l'état réel de neuf épreuves
// posées après elle, et il a fallu la réparer pour apprendre qu'elles
// passaient. Chaque épreuve est donc isolée : le rouge se dit, la suite
// continue, et le bilan final rassemble les échecs. Le code de sortie ne
// s'adoucit pas pour autant — un seul rouge fait échouer la suite.
let passes = 0;
const echecs = [];
function verifier(nom, fn) {
  try { fn(); passes++; console.log('OK — ' + nom); }
  catch (e) {
    echecs.push({ nom, message: (e && e.message) || String(e) });
    console.log('ROUGE — ' + nom);
  }
}

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

verifier('un lot au statut ATTENTE_CONSOMMATION_DECISION est accepté', () => {
  // Le statut intermédiaire entre une décision rendue et sa consommation via
  // `consommer` n'existait pas au vocabulaire de STATE.json : un registre par
  // ailleurs sain était rejeté comme « hors vocabulaire ».
  const dir = registreSain();
  ecrireEtat(dir, e => { e.lots[LOT].statut = 'ATTENTE_CONSOMMATION_DECISION'; delete e.lots[LOT].consomme_le; });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'ATTENTE_CONSOMMATION_DECISION doit appartenir au vocabulaire des statuts : ' + r.sortie);
});

verifier('ATTENTE_CONSOMMATION_DECISION compte comme lot actif pour la règle « un seul lot actif »', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => {
    e.lots[LOT].statut = 'ATTENTE_CONSOMMATION_DECISION';
    delete e.lots[LOT].consomme_le;
    e.lots['AUTRE-LOT-20260905'] = { statut: 'ATTENTE_DECISION' };
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'un lot ATTENTE_CONSOMMATION_DECISION et un lot ATTENTE_DECISION doivent compter comme deux lots actifs');
  assert.ok(/un seul lot actif/.test(r.sortie), r.sortie);
});

verifier('ouvrir un lot est refusé si un autre lot attend la consommation de sa décision', () => {
  // Symétrique de l'épreuve ATTENTE_DECISION plus bas : le même garde doit
  // s'appliquer que le lot précédent attende une décision ou sa consommation.
  const dir = registreSain();
  ecrireEtat(dir, e => { e.lots[LOT].statut = 'ATTENTE_CONSOMMATION_DECISION'; delete e.lots[LOT].consomme_le; });
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '\n# Corps\n');
  let code = 0, sortie = '';
  try {
    execFileSync('node', [OUTIL, 'demande', 'AUTRE-LOT-20260905', corps, '--token-mode', 'LEAN'],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0, 'ouvrir un second lot doit être refusé');
  assert.ok(/n’est pas consommée|n'est pas consommée/.test(sortie), sortie);
});

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
  // existent vraiment. On choisit délibérément un lot déjà DECISION_CONSOMMEE
  // avec un commit_decision vérifiable — jamais lot_actif, dont la décision
  // la plus récente peut être légitimement fraîche et donc réellement
  // consommable (c'est précisément ce que la correction structurelle du
  // 2026-09-06 restaure pour decision-3.md du lot Carburants : la tester ici
  // la consommerait pour de vrai au lieu de prouver un refus). Le fichier réel
  // est sauvegardé puis restauré dans le `finally`, quel que soit le résultat.
  const cheminEtat = path.join(RACINE, 'docs/handoff/STATE.json');
  const avant = fs.readFileSync(cheminEtat, 'utf8');
  const etat = JSON.parse(avant);
  const dejaConsomme = Object.entries(etat.lots).find(([, v]) => v.statut === 'DECISION_CONSOMMEE' && v.consomme_le && v.commit_decision);
  if (!dejaConsomme) { console.log('   (aucun lot déjà consommé au registre — épreuve sans objet)'); return; }
  const [lot] = dejaConsomme;
  let code = 0, sortie = '';
  try { execFileSync('node', [OUTIL, 'consommer', lot], { cwd: RACINE, encoding: 'utf8' }); }
  catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  finally { fs.writeFileSync(cheminEtat, avant); }
  assert.notStrictEqual(code, 0, 'le rejeu d’une décision déjà consommée doit être refusé (fichier réel restauré) : ' + sortie);
  // Deux refus légitimes, dans cet ordre de précédence : `consommer` valide
  // d'abord tout le registre, et ne regarde la consommation qu'ensuite. Quand
  // un dépôt tiers non conforme traîne quelque part (21/09/2026 :
  // decision-12.md, déposée hors vocabulaire par le Créateur), c'est le
  // premier qui parle. La santé du registre réel n'est pas le sujet de cette
  // épreuve — le refus l'est — mais elle exige quand même une raison NOMMÉE :
  // un `consommer` qui réussirait en silence la ferait rougir.
  const raisons = [/déjà marquée consommée/, /le registre ne valide pas/];
  const laquelle = raisons.findIndex(r => r.test(sortie));
  assert.ok(laquelle >= 0, 'le refus doit nommer sa raison : ' + sortie);
  if (laquelle === 1) console.log('   (refus au stade validation — le registre réel porte des violations ; la précédence est éprouvée, pas la consommation)');
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
    // Depuis la correction structurelle du 2026-09-06, le mauvais numéro ne
    // produit plus qu'UN symptôme — la séquence trouée. Répondre à request-1
    // depuis un fichier numéroté 2 n'est plus, à lui seul, une violation
    // distincte : la validité de in_reply_to ne dépend plus du rang.
    e.derogations = [
      { fichier: `${LOT}/decision-2.md`, regle: 'SEQUENCE_NON_CONTIGUE', motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' },
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
    e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'SEQUENCE_NON_CONTIGUE',
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
    e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'BRANCHE_ABSENTE',
      motif: 'éprouvette', autorise_par: 'test', le: '2026-09-05' }];
  });
  const r = valider(absente);
  assert.strictEqual(r.code, 0, 'une omission de forme doit pouvoir être dérogée : ' + r.sortie);
});

// Ajoute une demande conforme au registre jetable, pour les épreuves qui ont
// besoin d'une demande ENCORE À ARBITRER — le registre sain n'en a pas.
function deposerDemande(dir, seq) {
  fs.writeFileSync(path.join(dir, 'lots', LOT, `request-${seq}.md`),
    ['---', 'protocol: nexus-handoff/2', 'kind: request', `lot_id: ${LOT}`, `seq: ${seq}`,
     'author: Claude', 'branch: config-par-environnement', 'status: AWAITING_DECISION',
     'token_mode: STANDARD', 'preuves:',
     '  - id: refs-protegees', '    classe: VERIFIED', `    valeur: ${refsReelles()}`,
     '---', '', 'Corps de la demande.', ''].join('\n'));
}

function outil(dir, args, envPlus) {
  try {
    const sortie = execFileSync('node', [OUTIL].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir, ...(envPlus || {}) } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

verifier('handoff.js decision produit une enveloppe conforme par construction', () => {
  // Quatre écarts d'enveloppe consécutifs, tous dérogés. La cause n'était pas
  // l'inattention mais l'absence d'outil côté décision : `demande` existait,
  // rien pour les décisions. On vérifie donc que l'outil existe ET que ce
  // qu'il écrit passe le validateur SANS dérogation.
  const dir = registreSain();
  // Le registre sain a déjà décidé de request-1 : décider une seconde fois de
  // la même demande serait une supersession, légitimement refusée. On dépose
  // donc une demande à arbitrer, comme dans la vraie vie.
  deposerDemande(dir, 2);
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '# Verdict\n\nCorps de la décision.\n');
  // Le rail n'est pas une constante du code, mais ce n'est plus non plus une
  // variable d'environnement : il est déclaré au registre, dans
  // STATE.json.lots[LOT].rail. Cette épreuve le déclare là et vérifie que
  // c'est LUI que l'outil estampille — sans poser aucune variable, et donc
  // sans que l'environnement du runner ait voix au chapitre.
  //
  // Elle a déjà porté deux formes fausses. D'abord `config-par-environnement`
  // en dur : le test passait au vert tant que le rail ne marchait pas. Puis
  // NEXUS_BASE_BRANCH/NEXUS_CLAUDE_BASE_BRANCH : elle exigeait alors que
  // l'environnement fasse loi, c'est-à-dire exactement l'anomalie réparée le
  // 21/09/2026. Une épreuve peut encoder le défaut qu'elle est censée
  // interdire ; celle-ci l'a fait deux fois.
  const RAIL_EPREUVE = 'handoff-epreuve-20260905';
  ecrireEtat(dir, e => { e.lots[LOT].rail = RAIL_EPREUVE; });
  const r = outil(dir, ['decision', LOT, corps, '--decision', 'BLOCKED', '--closes', 'true']);
  assert.strictEqual(r.code, 0, 'la commande doit réussir : ' + r.sortie);
  const ecrit = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-2.md'), 'utf8');
  assert.ok(/^decision: BLOCKED$/m.test(ecrit), 'verdict posé par l’outil : ' + ecrit);
  assert.ok(new RegExp('^branch: ' + RAIL_EPREUVE + '$', 'm').test(ecrit),
    'la branche posée par l’outil doit être le rail déclaré au registre, ni une constante ni une variable d’environnement : ' + ecrit);
  assert.ok(/^in_reply_to: request-2\.md$/m.test(ecrit), 'in_reply_to résolu seul sur la demande active : ' + ecrit);
  ecrireEtat(dir, e => { e.lots[LOT].derniere_demande = 'request-2.md'; e.lots[LOT].derniere_decision = 'decision-2.md'; });
  const v = valider(dir);
  assert.strictEqual(v.code, 0, 'ce que l’outil écrit doit passer le validateur sans dérogation : ' + v.sortie);
});

verifier('handoff.js decision refuse un verdict hors vocabulaire AVANT d’écrire', () => {
  // Le cas réel du 07/09 : `decision: REJECTED`. L'outil doit refuser à la
  // source et ne rien laisser derrière lui — un fichier à demi déposé dans un
  // registre append-only ne se rattrape pas.
  const dir = registreSain();
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '# Verdict\n');
  const r = outil(dir, ['decision', LOT, corps, '--decision', 'REJECTED', '--closes', 'true']);
  assert.notStrictEqual(r.code, 0, 'REJECTED doit être refusé');
  assert.ok(/hors vocabulaire/.test(r.sortie), r.sortie);
  assert.ok(/BLOCKED/.test(r.sortie), 'et proposer le terme canonique : ' + r.sortie);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT, 'decision-2.md')),
    'aucun fichier ne doit avoir été déposé');
});

verifier('handoff.js decision refuse un in_reply_to qui ne désigne aucune demande du lot', () => {
  const dir = registreSain();
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '# Verdict\n');
  const r = outil(dir, ['decision', LOT, corps, '--decision', 'APPROVED', '--closes', 'false',
    '--en-reponse-a', 'request-9.md']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/ne désigne aucune demande/.test(r.sortie), r.sortie);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT, 'decision-2.md')));
});

verifier('une enveloppe de DEMANDE incomplète se déroge, comme celle d’une décision', () => {
  // 07/09/2026 — CARBURANTS-.../request-3.md a été déposée par un run Claude
  // raciné sur main : sans STATE.json ni outils/handoff.js dans son arbre, il
  // ne pouvait pas passer par `handoff.js demande`, et l'enveloppe est sortie
  // sans status ni token_mode. Ces deux défauts ne portaient aucun code : le
  // registre n'offrait donc que « réécrire le fichier », c'est-à-dire lui
  // fabriquer après coup une enveloppe qu'il n'a jamais eue.
  for (const [champ, code] of [['status: AWAITING_DECISION', 'STATUT_HORS_VOCABULAIRE'], ['token_mode: STANDARD', 'TOKEN_MODE_HORS_VOCABULAIRE']]) {
    const dir = registreSain();
    remplacer(dir, 'request-1.md', champ + '\n', '');
    assert.notStrictEqual(valider(dir).code, 0, `sans ${champ}, la demande doit rester en violation`);
    ecrireEtat(dir, e => {
      e.derogations = [{ fichier: `${LOT}/request-1.md`, regle: code,
        motif: 'éprouvette', autorise_par: 'test', le: '2026-09-07' }];
    });
    const r = valider(dir);
    assert.strictEqual(r.code, 0, `${code} doit pouvoir être dérogé : ` + r.sortie);
    assert.ok(new RegExp('DÉROGATION ' + code).test(r.sortie),
      'la dérogation doit rester bruyante à chaque exécution, pas silencieuse');
  }
});

verifier('une dérogation d’enveloppe de demande ne fuit pas sur les homonymes d’un autre lot', () => {
  // La faiblesse des dérogations historiques : elles nommaient un basename,
  // si bien qu'une exception accordée sur le decision-1.md d'un lot couvrait
  // le decision-1.md de tous les autres. Depuis le 07/09/2026 tous les codes
  // dérogeables sont qualifiés par le LOT ; un nom nu ne doit donc plus rien
  // couvrir. Le `fichier` ci-dessous reste volontairement NU : c'est l'objet
  // même de l'épreuve, et le qualifier la viderait de son sens.
  const dir = registreSain();
  remplacer(dir, 'request-1.md', 'token_mode: STANDARD\n', '');
  ecrireEtat(dir, e => {
    e.derogations = [{ fichier: 'request-1.md', regle: 'TOKEN_MODE_HORS_VOCABULAIRE',
      motif: 'éprouvette — nom nu, volontairement non qualifié', autorise_par: 'test', le: '2026-09-07' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'un nom nu ne doit couvrir le fichier d’aucun lot');
  assert.ok(/token_mode undefined hors vocabulaire/.test(r.sortie), r.sortie);
});

verifier('aucune dérogation n’est recevable sur un invariant de sécurité', () => {
  const dir = registreSain();
  remplacer(dir, 'request-1.md', 'branch: config-par-environnement', 'branch: production');
  ecrireEtat(dir, e => {
    e.derogations = [{ fichier: `${LOT}/request-1.md`, regle: 'BRANCHE_PROTEGEE',
      motif: 'tentative de contournement', autorise_par: 'test', le: '2026-09-05' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une ref protégée ne se déroge pas');
  assert.ok(/invariant de sécurité/.test(r.sortie), r.sortie);
});

verifier('une dérogation incomplète est refusée', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'SEQUENCE_NON_CONTIGUE' }]; });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une exception sans motif ni auteur n’est pas auditable');
  assert.ok(/dérogation incomplète/.test(r.sortie));
});

verifier('ouvrir un lot est refusé si une décision attend d’être consommée', () => {
  // La cause de l'impasse du 05/09/2026 : une demande avait été ouverte alors
  // que la décision du lot précédent n'était pas consommée. Le registre
  // devenait alors invalide, et `consommer` — qui valide d'abord — refusait
  // la seule opération qui l'aurait rendu valide.
  const dir = registreSain();
  ecrireEtat(dir, e => { e.lots[LOT].statut = 'ATTENTE_DECISION'; });
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '\n# Corps\n');
  let code = 0, sortie = '';
  try {
    execFileSync('node', [OUTIL, 'demande', 'AUTRE-LOT-20260905', corps, '--token-mode', 'LEAN'],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { code = e.status; sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.notStrictEqual(code, 0, 'ouvrir un second lot doit être refusé');
  assert.ok(/n’est pas consommée|n'est pas consommée/.test(sortie), sortie);
});

verifier('consommer n’est pas bloqué par la règle qu’il va lui-même résoudre', () => {
  // Symétrique de l'épreuve précédente : une fois l'impasse créée, la
  // consommation doit rester possible, sinon le registre est mort.
  const dir = registreSain();
  const lot2 = path.join(dir, 'lots', 'AUTRE-LOT-20260905');
  fs.mkdirSync(lot2, { recursive: true });
  fs.writeFileSync(path.join(lot2, 'request-1.md'),
    fs.readFileSync(path.join(dir, 'lots', LOT, 'request-1.md'), 'utf8')
      .replace(new RegExp(LOT, 'g'), 'AUTRE-LOT-20260905'));
  ecrireEtat(dir, e => {
    e.lots[LOT].statut = 'ATTENTE_DECISION';
    e.lots['AUTRE-LOT-20260905'] = { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' };
  });
  assert.notStrictEqual(valider(dir).code, 0, 'deux lots actifs restent invalides pour la CI');
  let sortie = '';
  try {
    sortie = execFileSync('node', [OUTIL, 'consommer', LOT],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  } catch (e) { sortie = (e.stdout || '') + (e.stderr || ''); }
  assert.ok(!/aucune décision ne peut être consommée/.test(sortie),
    'la consommation ne doit pas être bloquée par PLUSIEURS_LOTS_ACTIFS : ' + sortie);
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

verifier('une décision peut répondre à une demande de rang inférieur au sien, sans que ce soit à lui seul un motif de refus', () => {
  // Correction structurelle du 2026-09-06 : la validité d'une décision dépend
  // de la demande qu'elle référence (via in_reply_to) et de sa relation
  // éventuelle de supersession avec une décision précédente — jamais d'une
  // comparaison numérique entre le rang de la décision et celui de la
  // demande visée. decision-2 répondant à request-1 (rang 1 < 2) est ici la
  // toute première décision du lot : aucun doublon, donc aucun refus.
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.renameSync(path.join(lot, 'decision-1.md'), path.join(lot, 'decision-2.md'));
  remplacer(dir, 'decision-2.md', 'seq: 1', 'seq: 2');
  ecrireEtat(dir, e => { e.lots[LOT].derniere_decision = 'decision-2.md'; });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'la séquence des décisions reste trouée (decision-1.md manquant) : ' + r.sortie);
  assert.ok(/non contiguë/.test(r.sortie), r.sortie);
  assert.ok(!/IN_REPLY_TO_ANTERIEUR|antérieur au rang de la décision/.test(r.sortie),
    'ce code n’existe plus : le rang de la décision ne conditionne plus la validité de in_reply_to : ' + r.sortie);
});

verifier('request-2 -> decision-3 est valide sans dérogation, même après une supersession sur request-1', () => {
  // Reproduit la forme exacte du lot réel
  // CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906 : decision-1 et
  // decision-2 répondent toutes deux à request-1 (supersession structurée),
  // puis request-2 arrive et decision-3 y répond. Le rang de decision-3 (3)
  // dépasse celui de request-2 (2) : ce n'est plus, depuis la correction
  // structurelle, un motif de refus.
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'decision-1.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8').replace('closes: true', 'closes: false'));
  fs.writeFileSync(path.join(lot, 'decision-2.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8')
      .replace('seq: 1', 'seq: 2')
      .replace('in_reply_to: request-1.md', 'in_reply_to: request-1.md\nsupersedes_regle_of: decision-1.md'));
  fs.writeFileSync(path.join(lot, 'request-2.md'),
    fs.readFileSync(path.join(lot, 'request-1.md'), 'utf8').replace('seq: 1', 'seq: 2'));
  fs.writeFileSync(path.join(lot, 'decision-3.md'),
    fs.readFileSync(path.join(lot, 'decision-2.md'), 'utf8')
      .replace('seq: 2', 'seq: 3')
      .replace('in_reply_to: request-1.md\nsupersedes_regle_of: decision-1.md', 'in_reply_to: request-2.md')
      .replace('closes: false', 'closes: true'));
  ecrireEtat(dir, e => {
    e.lots[LOT].derniere_demande = 'request-2.md';
    e.lots[LOT].derniere_decision = 'decision-3.md';
  });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'decision-3 répondant à request-2 doit être valide sans dérogation : ' + r.sortie);
});

verifier('un in_reply_to désignant un autre lot est refusé', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md', 'in_reply_to: AUTRE-LOT-20260905/request-1.md');
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une décision ne doit jamais pouvoir référencer la demande d’un autre lot');
  assert.ok(/désigne le lot AUTRE-LOT-20260905, incohérent avec/.test(r.sortie), r.sortie);
});

verifier('un in_reply_to vers une demande future ou inexistante échoue de la même façon, sans comparaison de rang', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md', 'in_reply_to: request-99.md');
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/ne désigne aucune demande de ce lot/.test(r.sortie), r.sortie);
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

verifier('une décision peut superséder la précédente sur la même demande via supersedes_..._of', () => {
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'decision-1.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8').replace('closes: true', 'closes: false'));
  fs.writeFileSync(path.join(lot, 'decision-2.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8')
      .replace('seq: 1', 'seq: 2')
      .replace('in_reply_to: request-1.md', 'in_reply_to: request-1.md\nsupersedes_regle_of: decision-1.md'));
  ecrireEtat(dir, e => {
    e.lots[LOT].derniere_decision = 'decision-2.md'; e.lots[LOT].statut = 'ATTENTE_CONSOMMATION_DECISION'; delete e.lots[LOT].consomme_le;
  });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'une supersession structurée doit être acceptée sans dérogation, y compris quand decision-2 répond à un rang inférieur (request-1) : ' + r.sortie);
  assert.ok(/supersède decision-1\.md via supersedes_regle_of/.test(r.sortie), r.sortie);
});

verifier('un champ supersedes_..._of qui ne désigne pas la décision précédente ne supprime pas le doublon', () => {
  const dir = registreSain();
  const lot = path.join(dir, 'lots', LOT);
  fs.writeFileSync(path.join(lot, 'decision-1.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8').replace('closes: true', 'closes: false'));
  fs.writeFileSync(path.join(lot, 'decision-2.md'),
    fs.readFileSync(path.join(lot, 'decision-1.md'), 'utf8')
      .replace('seq: 1', 'seq: 2')
      .replace('in_reply_to: request-1.md', 'in_reply_to: request-1.md\nsupersedes_regle_of: decision-9.md'));
  ecrireEtat(dir, e => { e.lots[LOT].derniere_decision = 'decision-2.md'; });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'un champ de supersession qui désigne une décision inexistante ou étrangère ne doit rien exempter');
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

function creerRepertoireHorsRegistre(dir, lotId, corps) {
  const rep = path.join(dir, 'lots', lotId);
  fs.mkdirSync(rep, { recursive: true });
  fs.writeFileSync(path.join(rep, 'request-1.md'), corps || '# Dossier de conception, sans enveloppe v2\n');
  return rep;
}

verifier('un répertoire sans enveloppe déclaré dans artefacts_hors_registre est toléré', () => {
  const dir = registreSain();
  creerRepertoireHorsRegistre(dir, 'ARTEFACT-HISTORIQUE-20260906');
  ecrireEtat(dir, e => {
    e.artefacts_hors_registre = [{ lot_id: 'ARTEFACT-HISTORIQUE-20260906', motif: 'éprouvette', autorise_par: 'test', le: '2026-09-06' }];
  });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, 'un artefact déclaré, complet et sans conflit doit passer : ' + r.sortie);
  assert.ok(/artefact historique hors registre, toléré/.test(r.sortie), r.sortie);
});

verifier('un répertoire hors registre non déclaré reste bloquant', () => {
  const dir = registreSain();
  creerRepertoireHorsRegistre(dir, 'ARTEFACT-NON-DECLARE-20260906');
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'un répertoire ni enregistré ni déclaré hors registre doit rester fail-closed');
  assert.ok(/absent de STATE\.json\.lots et non déclaré/.test(r.sortie), r.sortie);
});

verifier('une entrée artefacts_hors_registre incomplète est refusée', () => {
  const dir = registreSain();
  creerRepertoireHorsRegistre(dir, 'ARTEFACT-INCOMPLET-20260906');
  ecrireEtat(dir, e => {
    e.artefacts_hors_registre = [{ lot_id: 'ARTEFACT-INCOMPLET-20260906', motif: 'éprouvette' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'une entrée sans autorise_par/le n’est pas auditable');
  assert.ok(/artefacts_hors_registre incomplet/.test(r.sortie), r.sortie);
  assert.ok(/absent de STATE\.json\.lots et non déclaré/.test(r.sortie),
    'une entrée invalide ne doit exempter aucun répertoire : ' + r.sortie);
});

verifier('un lot_id à la fois enregistré et déclaré hors registre est refusé', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => {
    e.artefacts_hors_registre = [{ lot_id: LOT, motif: 'éprouvette', autorise_par: 'test', le: '2026-09-06' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'un lot ne peut pas être à la fois canonique et hors registre');
  assert.ok(/est aussi un lot enregistré/.test(r.sortie), r.sortie);
});

verifier('un artefact hors registre qui pointe vers un répertoire absent est refusé', () => {
  const dir = registreSain();
  ecrireEtat(dir, e => {
    e.artefacts_hors_registre = [{ lot_id: 'ARTEFACT-FANTOME-20260906', motif: 'éprouvette', autorise_par: 'test', le: '2026-09-06' }];
  });
  const r = valider(dir);
  assert.notStrictEqual(r.code, 0, 'déclarer un lot_id sans répertoire réel ne doit rien exempter');
  assert.ok(/ne correspond à aucun répertoire/.test(r.sortie), r.sortie);
});

verifier('APPROVED_CLOSED reste lisible comme valeur legacy', () => {
  const mod = fs.readFileSync(OUTIL, 'utf8');
  assert.ok(/APPROVED_CLOSED/.test(mod), 'la valeur legacy doit rester connue du validateur');
  assert.ok(/decision: 'APPROVED', closes: true, legacy: true/.test(mod),
    'elle doit se normaliser en mémoire, sans réécrire les fichiers historiques');
  assert.ok(!/DECISIONS_CANONIQUES = \[[^\]]*APPROVED_CLOSED/.test(mod),
    'elle ne doit jamais devenir canonique');
});

// ——— Le rail est un fait du registre (21/09/2026) ————————————————————————
//
// Anomalie réparée ce jour : `handoff.js` lisait le rail actif dans
// l'environnement (NEXUS_CLAUDE_BASE_BRANCH, puis NEXUS_BASE_BRANCH, puis
// repli silencieux sur config-par-environnement). Les mêmes octets de
// registre recevaient donc deux verdicts opposés selon l'endroit où le
// validateur tournait, et l'échec produit (BRANCHE_INATTENDUE) est non
// dérogeable : rien ne pouvait l'absorber. Les épreuves qui suivent visent
// le contrat, pas l'implémentation — chacune a été essayée contre le code
// d'avant la réparation, et chacune y rougit.

function railDeclare(dir, rail) {
  const lotDir = path.join(dir, 'lots', LOT);
  for (const f of fs.readdirSync(lotDir).filter(n => /\.md$/.test(n))) {
    const q = path.join(lotDir, f);
    fs.writeFileSync(q, fs.readFileSync(q, 'utf8').replace(/^branch: .*$/m, `branch: ${rail}`));
  }
  if (rail !== undefined) ecrireEtat(dir, e => { e.lots[LOT].rail = rail; });
}

verifier('le verdict d’un registre ne dépend plus de l’environnement', () => {
  // L'épreuve décisive. Un registre dont le lot déclare son rail et dont les
  // enveloppes vivent sur ce rail doit rendre le MÊME verdict partout : dans
  // un run qui tourne sur le rail, dans un run qui tourne ailleurs, dans un
  // worktree sans variables, et jusque sous un environnement hostile qui
  // annonce une ref protégée. Avant la réparation, seul le premier cas
  // passait : les trois autres rendaient des violations BRANCHE_INATTENDUE.
  const RAIL = 'handoff-epreuve-rail-20260921';
  const dir = registreSain();
  railDeclare(dir, RAIL);
  const environnements = [
    ['aucune variable (worktree, local, run hors rail)', {}],
    ['la variable dit le même rail', { NEXUS_BASE_BRANCH: RAIL }],
    ['la variable dit le rail historique', { NEXUS_BASE_BRANCH: 'config-par-environnement' }],
    ['la variable dit une ref protégée', { NEXUS_CLAUDE_BASE_BRANCH: 'production' }],
    ['la variable dit n’importe quoi', { NEXUS_BASE_BRANCH: 'refs/pull/42/merge' }],
  ];
  for (const [nom, env] of environnements) {
    const v = valider(dir, env);
    assert.strictEqual(v.code, 0, `le registre doit valider quand ${nom} : ` + v.sortie);
  }
  // Et la variable qui se contredit doit le dire — à voix haute, sans rien
  // changer au verdict. La faire échouer rendrait le verdict à nouveau
  // dépendant de l'environnement, c'est-à-dire réintroduirait le défaut.
  const divergent = valider(dir, { NEXUS_BASE_BRANCH: 'handoff-autre-chose' });
  assert.strictEqual(divergent.code, 0, 'une variable divergente ne fait pas échouer : ' + divergent.sortie);
  assert.ok(/contredit le rail déclaré au registre/.test(divergent.sortie),
    'une variable divergente doit être signalée : ' + divergent.sortie);
  assert.ok(/le registre fait foi/.test(divergent.sortie),
    'le signalement doit dire qui l’emporte : ' + divergent.sortie);
});

verifier('aucune variable d’environnement ne peut poser un rail', () => {
  // La mutation qui prouve que le garde mord. Les enveloppes vivent sur un
  // rail que le registre NE déclare pas, et l'environnement le proclame des
  // deux manières historiques. Sous l'ancien code, cela suffisait à rendre le
  // registre valide. Il doit désormais échouer : un rail non inscrit n'existe
  // pas.
  const RAIL = 'handoff-epreuve-rail-20260921';
  const dir = registreSain();
  railDeclare(dir, RAIL);
  ecrireEtat(dir, e => { delete e.lots[LOT].rail; });
  const v = valider(dir, { NEXUS_BASE_BRANCH: RAIL, NEXUS_CLAUDE_BASE_BRANCH: RAIL });
  assert.notStrictEqual(v.code, 0, 'un rail seulement proclamé par l’environnement ne vaut rien : ' + v.sortie);
  assert.ok(/branch doit appartenir au rail du lot tel que le registre le déclare/.test(v.sortie),
    'le refus doit renvoyer au registre : ' + v.sortie);
  // Et le message doit être lisible. « config-par-environnement ou
  // config-par-environnement » était le seul indice, en Production, que
  // personne n'avait déclaré de rail : un message qui se répète ne dit rien.
  // Ici aucun rail n'est déclaré, donc le refus doit le dire, et ne jamais
  // énumérer deux fois la même valeur.
  const m = v.sortie.match(/rail du lot tel que le registre le déclare \(([^)]+)\)/);
  assert.ok(m, 'le refus doit énoncer le rail attendu : ' + v.sortie);
  const valeurs = m[1].split(' ou ');
  assert.strictEqual(new Set(valeurs).size, valeurs.length,
    'le message ne doit pas répéter la même valeur : ' + m[1]);
  assert.ok(/ne déclare aucun rail/.test(m[1]),
    'quand aucun rail n’est déclaré, le refus doit le dire au lieu de le laisser deviner : ' + m[1]);
});

verifier('quand un rail est déclaré, le refus énumère les deux branches recevables', () => {
  // Contre-témoin du message précédent : un lot qui déclare son rail accepte
  // deux branches — la branche historique dont tout le registre descend, et
  // son rail — et le refus doit les nommer toutes les deux.
  const RAIL = 'handoff-epreuve-rail-20260921';
  const dir = registreSain();
  ecrireEtat(dir, e => { e.lots[LOT].rail = RAIL; });
  remplacer(dir, 'request-1.md',
    'branch: config-par-environnement', 'branch: handoff-une-autre-20260921');
  const v = valider(dir);
  assert.notStrictEqual(v.code, 0, 'une branche hors rail doit être refusée : ' + v.sortie);
  const m = v.sortie.match(/rail du lot tel que le registre le déclare \(([^)]+)\)/);
  assert.ok(m, 'le refus doit énoncer les rails attendus : ' + v.sortie);
  assert.deepStrictEqual(m[1].split(' ou '), ['config-par-environnement', RAIL],
    'les deux branches recevables doivent être nommées : ' + m[1]);
});

verifier('un rail interdit au registre est refusé, et ne se déroge pas', () => {
  // L'ancien garde vivait au chargement du module et tuait le processus — y
  // compris celui d'un simple `require('outils/handoff.js')`, ce que fait
  // outils/reveil-handoff.js. La protection est la même, la forme est une
  // violation nommée.
  for (const interdit of ['production', 'main']) {
    const dir = registreSain();
    ecrireEtat(dir, e => { e.lots[LOT].rail = interdit; });
    const v = valider(dir);
    assert.notStrictEqual(v.code, 0, `un rail ${interdit} doit être refusé : ` + v.sortie);
    assert.ok(new RegExp(`rail ${JSON.stringify(interdit)} n.est pas un rail autoris`).test(v.sortie),
      'le refus doit nommer le rail fautif : ' + v.sortie);
    // Et aucune dérogation ne le rattrape : c'est un invariant de sécurité.
    ecrireEtat(dir, e => {
      e.derogations = [{ fichier: 'STATE.json', regle: 'RAIL_NON_AUTORISE',
        motif: 'tentative de dérogation sur un invariant', autorise_par: 'test', le: '2026-09-21' }];
    });
    const w = valider(dir);
    assert.notStrictEqual(w.code, 0, `une dérogation ne doit pas ouvrir le rail ${interdit} : ` + w.sortie);
    assert.ok(/invariant de sécurité/.test(w.sortie), 'le refus de la dérogation doit se dire : ' + w.sortie);
  }
});

verifier('un rail malformé est refusé', () => {
  // Le rail est soit la branche historique, soit de la forme handoff-*. Une
  // branche de travail ordinaire, une branche de run `claude/issue-*` ou une
  // chaîne vide ne sont pas des rails : les accepter ferait du registre le
  // miroir de n'importe quelle branche passagère.
  for (const mauvais of ['feature/quelque-chose', 'claude/issue-42-20260921', '', 'handoff', 'Handoff-majuscule']) {
    const dir = registreSain();
    ecrireEtat(dir, e => { e.lots[LOT].rail = mauvais; });
    const v = valider(dir);
    assert.notStrictEqual(v.code, 0, `rail ${JSON.stringify(mauvais)} doit être refusé : ` + v.sortie);
    assert.ok(/n.est pas un rail autoris/.test(v.sortie), 'le refus doit se nommer : ' + v.sortie);
  }
});

verifier('un lot qui ne déclare aucun rail reste lu sur la branche historique', () => {
  // Rétrocompatibilité : tout le registre antérieur au 21/09/2026 ne déclare
  // pas de rail. Il doit rester vert sans qu'un seul fichier soit réécrit —
  // sinon la réparation exigerait de toucher un registre append-only.
  const dir = registreSain();
  const e = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(e.lots[LOT].rail, undefined, 'le registre d’épreuve ne déclare aucun rail');
  const v = valider(dir);
  assert.strictEqual(v.code, 0, 'un registre sans rail déclaré doit valider : ' + v.sortie);
});

verifier('declarer-rail inscrit le rail, et rien d’autre', () => {
  // Le geste qui remplace la variable d'environnement. Cas réel du
  // 21/09/2026 en miniature : les enveloppes d'un lot vivent sur un rail que
  // le registre ne déclare pas encore, le validateur refuse, et la
  // déclaration — pas une variable, pas un colmatage de CI — le rend vert.
  const RAIL = 'handoff-epreuve-rail-20260921';
  const dir = registreSain();
  railDeclare(dir, RAIL);
  ecrireEtat(dir, e => { delete e.lots[LOT].rail; });
  assert.notStrictEqual(valider(dir).code, 0, 'départ : le registre ne valide pas');
  const r = outil(dir, ['declarer-rail', LOT, RAIL]);
  assert.strictEqual(r.code, 0, 'la déclaration doit réussir : ' + r.sortie);
  assert.ok(/violation\(s\) résolue\(s\), 0 introduite/.test(r.sortie),
    'la déclaration doit rendre compte de ce qu’elle résout : ' + r.sortie);
  assert.strictEqual(valider(dir).code, 0, 'arrivée : le registre valide');
  const apres = JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
  assert.strictEqual(apres.lots[LOT].rail, RAIL, 'le rail est inscrit au registre');
  assert.strictEqual(apres.lots[LOT].statut, 'DECISION_CONSOMMEE', 'declarer-rail ne touche pas au statut');
  assert.strictEqual(apres.lots[LOT].consomme_le, '2026-09-05T00:00:00.000Z', 'declarer-rail ne touche pas à la consommation');
});

verifier('declarer-rail refuse un rail interdit, un rail qui casse, et un rail inutile', () => {
  const RAIL = 'handoff-epreuve-rail-20260921';
  const dir = registreSain();
  railDeclare(dir, RAIL);
  const etatInitial = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');

  for (const interdit of ['production', 'main', 'feature/x']) {
    const r = outil(dir, ['declarer-rail', LOT, interdit]);
    assert.notStrictEqual(r.code, 0, `declarer-rail ${interdit} doit être refusé : ` + r.sortie);
    assert.ok(/rail non autoris/.test(r.sortie), 'le refus doit se nommer : ' + r.sortie);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), etatInitial,
      'un refus n’écrit rien');
  }
  // Un rail qui déplacerait le lot loin de ses propres enveloppes introduit
  // des violations : la déclaration se refuse au lieu de casser le registre.
  const casse = outil(dir, ['declarer-rail', LOT, 'handoff-ailleurs-20260921']);
  assert.notStrictEqual(casse.code, 0, 'un rail qui introduit des violations doit être refusé : ' + casse.sortie);
  assert.ok(/introduirait \d+ violation/.test(casse.sortie), 'le refus doit dire ce qu’il évite : ' + casse.sortie);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), etatInitial, 'un refus n’écrit rien');
  // Et redéclarer le rail déjà inscrit ne se fait pas : un registre ne
  // s’écrit pas pour ne rien changer.
  const inutile = outil(dir, ['declarer-rail', LOT, RAIL]);
  assert.notStrictEqual(inutile.code, 0, 'redéclarer le même rail doit être refusé : ' + inutile.sortie);
  assert.ok(/déclare déjà/.test(inutile.sortie), 'le refus doit dire pourquoi : ' + inutile.sortie);
});

verifier('le rail ne se lit plus dans l’environnement', () => {
  // Épreuve de source, en complément des épreuves de comportement : elle
  // interdit le retour de la lecture ambiante, y compris en repli. Le nom des
  // variables reste présent dans le fichier — elles sont lues pour signaler
  // leur propre divergence — mais plus jamais comme source du rail.
  const source = fs.readFileSync(OUTIL, 'utf8');
  const vivantes = source.split('\n').filter(l => !/^\s*\/\//.test(l));
  for (const l of vivantes) {
    assert.ok(!/(NEXUS_CLAUDE_BASE_BRANCH|NEXUS_BASE_BRANCH)\]?\s*\|\|/.test(l),
      'aucune ligne vivante ne doit faire du rail un repli d’environnement : ' + l.trim());
  }
  assert.ok(/STATE\.json\.lots\[LOT\]\.rail|etat\.lots\[lot\]\.rail|v\.rail/.test(source),
    'le rail doit se lire dans le registre');
});


// ---------------------------------------------------------------------------
// 21/09/2026 — deux défauts d'infrastructure du registre, réparés à la base.
//
// D1. `bloquant(m)` sans code recevait 'AUTRE' et un fichier null : AUCUNE
//     dérogation ne pouvait viser la règle. Il existait donc trois catégories
//     et non deux — dérogeable, non dérogeable par décision assumée
//     (CODES_NON_DEROGEABLES), et non dérogeable par accident, silencieuse.
//     C'est cette troisième qui a bloqué decision-12 : « closes doit valoir
//     true ou false » n'était arbitrable par personne.
// D2. Une dérogation savait dire « toléré », jamais « voici la valeur
//     retenue ». `in_reply_to` n'est pas qu'une forme : trois outils lisaient
//     la demande visée en la recalculant chacun de leur côté.
// ---------------------------------------------------------------------------

verifier('CLOSES_INVALIDE mord encore, et devient dérogeable', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'closes: true', 'closes: peut-etre');
  const avant = valider(dir);
  assert.strictEqual(avant.code, 1, 'un closes non booléen doit rester bloquant');
  assert.ok(/closes doit valoir true ou false/.test(avant.sortie), avant.sortie);
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'CLOSES_INVALIDE',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21' }]; });
  const apres = valider(dir);
  assert.strictEqual(apres.code, 0, apres.sortie);
  assert.ok(/DÉROGATION CLOSES_INVALIDE/.test(apres.sortie), 'la dérogation doit être réimprimée');
});

verifier('une dérogation sur un basename ne couvre pas un défaut qualifié par le lot', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'closes: true', 'closes: peut-etre');
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: 'decision-1.md', regle: 'CLOSES_INVALIDE',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21' }]; });
  const r = valider(dir);
  assert.strictEqual(r.code, 1, 'un basename nu couvrirait les homonymes de tous les lots');
});

verifier('aucun défaut ancré sur un fichier tiers ne reste sans code', () => {
  // Le rouge d'aujourd'hui se voit ; le retour silencieux d'un bloquant sans
  // code ne se verrait pas. Cette épreuve lit la source : tout appel dont le
  // message commence par `${ou}` — donc ancré sur un fichier déposé par un
  // tiers, qu'on ne réécrit jamais — doit porter un code ET le fichier
  // qualifié. Les règles de STATE.json restent volontairement sans code :
  // ce fichier est le nôtre, il se corrige, il ne se dérroge pas.
  const source = fs.readFileSync(path.join(RACINE, 'outils', 'handoff.js'), 'utf8');
  const nus = [];
  let i = 0;
  while ((i = source.indexOf('bloquant(', i)) !== -1) {
    let k = i + 'bloquant('.length, profondeur = 1, args = [], cur = '', q = null;
    while (k < source.length) {
      const c = source[k];
      if (q) { if (c === '\\') { cur += source.substr(k, 2); k += 2; continue; } if (c === q) q = null; cur += c; k++; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; cur += c; k++; continue; }
      if ('([{'.includes(c)) profondeur++;
      else if (')]}'.includes(c)) { profondeur--; if (profondeur === 0) { args.push(cur); break; } }
      if (c === ',' && profondeur === 1) { args.push(cur); cur = ''; k++; continue; }
      cur += c; k++;
    }
    const a = args.map((x) => x.trim());
    if (a.length && a[0].startsWith('`${ou}')) {
      const ligne = source.slice(0, i).split('\n').length;
      if (a.length < 3 || a[a.length - 1] !== 'ou') nus.push(`${ligne} : ${a[0].slice(0, 70)}`);
    }
    i += 'bloquant('.length;
  }
  assert.strictEqual(nus.length, 0, `bloquant(s) sans code ni fichier :\n  ${nus.join('\n  ')}`);
});

verifier('une dérogation sans valeur retenue tolère, mais ne désigne rien', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md\n', '');
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'IN_REPLY_TO_MANQUANT',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21' }]; });
  assert.strictEqual(valider(dir).code, 0, 'la tolérance seule doit suffire à verdir la vérification');
  const r = outil(dir, ['consommer', LOT]);
  assert.strictEqual(r.code, 1, 'sans désignation, la consommation ne peut pas savoir à quoi la décision répond');
  assert.ok(/répond à null/.test(r.sortie), r.sortie);
});

verifier('une valeur retenue fournit la désignation que l\'enveloppe ne porte pas', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md\n', '');
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'IN_REPLY_TO_MANQUANT',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21', valeur_retenue: { in_reply_to: 'request-1.md' } }]; });
  const r = valider(dir);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(/valeur retenue : request-1\.md/.test(r.sortie), 'la valeur retenue doit être annoncée à voix haute');
  assert.strictEqual(demandeViseeDansDir(dir), 'request-1.md');
});

verifier('une valeur retenue ne peut pas inventer une demande', () => {
  const dir = registreSain();
  remplacer(dir, 'decision-1.md', 'in_reply_to: request-1.md\n', '');
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'IN_REPLY_TO_MANQUANT',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21', valeur_retenue: { in_reply_to: 'request-9.md' } }]; });
  const r = valider(dir);
  assert.strictEqual(r.code, 1, 'une valeur retenue reste soumise aux contrôles de cohérence');
  assert.ok(/ne désigne aucune demande de ce lot/.test(r.sortie), r.sortie);
});

verifier('une valeur retenue ne recouvre pas une valeur déclarée', () => {
  const dir = registreSain();
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'IN_REPLY_TO_MANQUANT',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21', valeur_retenue: { in_reply_to: 'request-7.md' } }]; });
  assert.strictEqual(valider(dir).code, 0);
  assert.strictEqual(demandeViseeDansDir(dir), 'request-1.md',
    'une dérogation comble une absence, elle ne réécrit pas ce qu\'un auteur a écrit');
});

verifier('une valeur retenue sur une règle non substituable est bloquante', () => {
  const dir = registreSain();
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'SEQUENCE_NON_CONTIGUE',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21', valeur_retenue: { in_reply_to: 'request-1.md' } }]; });
  const r = valider(dir);
  assert.strictEqual(r.code, 1, 'le domaine des substitutions est fermé, pas ouvert');
  assert.ok(/aucune valeur retenue n'est admise pour cette règle/.test(r.sortie), r.sortie);
});

verifier('une valeur retenue pour un champ non admis est bloquante', () => {
  const dir = registreSain();
  ecrireEtat(dir, (e) => { e.derogations = [{ fichier: `${LOT}/decision-1.md`, regle: 'IN_REPLY_TO_MANQUANT',
    motif: 'Épreuve.', autorise_par: 'Épreuve', le: '2026-09-21', valeur_retenue: { closes: true } }]; });
  const r = valider(dir);
  assert.strictEqual(r.code, 1);
  assert.ok(/valeur retenue interdite pour closes/.test(r.sortie), r.sortie);
});

verifier('la demande visée se résout en un seul endroit', () => {
  // Trois outils recalculaient `basename(in_reply_to)`. Deux d'entre eux
  // n'avaient alors aucun moyen de voir l'arbitrage humain, et le réveil de
  // l'Orchestrateur réveillait Claude sur une demande déjà tranchée.
  const outilHandoff = fs.readFileSync(path.join(RACINE, 'outils', 'handoff.js'), 'utf8');
  assert.strictEqual((outilHandoff.match(/function demandeVisee\(/g) || []).length, 1,
    'le résolveur doit être défini une seule fois');
  assert.ok(/module\.exports = \{[^}]*demandeVisee/.test(outilHandoff), 'le résolveur doit être exporté');
  for (const f of ['reveil-handoff.js', 'reveil-orchestrateur.js']) {
    const src = fs.readFileSync(path.join(RACINE, 'outils', f), 'utf8');
    assert.ok(/handoff\.demandeVisee\(/.test(src), `${f} doit demander la désignation au registre`);
    assert.ok(!/in_reply_to\s*\n?\s*\?|basename\(String\([^)]*in_reply_to/.test(src),
      `${f} ne doit pas recalculer la désignation`);
  }
});

// LIRE LE RAIL EST UN GESTE — ET CE QUI LE LIT NE DOIT PLUS LE DEVINER.
//
// 22/09/2026. Le rail est un fait du registre depuis le 21/09, mais rien ne
// permettait de le LIRE : `declarer-rail` l'écrivait, `verifier` le consommait
// en silence. Un appelant extérieur — l'étape d'un workflow qui doit savoir si
// elle tourne sur le rail — n'avait donc d'autre choix que de le redécouvrir,
// c'est-à-dire de le deviner. Cinq étapes de tests.yml en sont mortes : gelées
// sur `refs/heads/config-par-environnement`, elles ont cessé de s'exécuter le
// jour où le travail a changé de rail, sans rougir — `skipped` n'est pas
// `failure`, et un run dont les cinq preuves les plus profondes sont sautées
// se termine vert. Les trois épreuves qui suivent tiennent les deux bouts : la
// commande qui dit le rail, et l'interdiction faite à la CI de le réinventer.

verifier('`rail` imprime la désignation portée par le registre, et rien d’autre', () => {
  const RAIL = 'handoff-epreuve-lecture-20260922';
  const dir = registreSain();

  // Sans déclaration, le lot vit sur la branche historique : c'est la
  // tolérance d'héritage, elle doit se lire comme telle et non échouer.
  const parDefaut = outil(dir, ['rail']);
  assert.strictEqual(parDefaut.code, 0, 'lire un rail non déclaré ne doit pas échouer : ' + parDefaut.sortie);
  assert.strictEqual(parDefaut.sortie.trim(), 'config-par-environnement',
    'un lot sans déclaration doit se lire sur la branche historique : ' + parDefaut.sortie);

  // Le contre-témoin : on déplace la désignation, la sortie doit suivre. Une
  // commande qui imprimerait une constante renommée passerait le cas ci-dessus
  // et rougirait ici.
  railDeclare(dir, RAIL);
  const declare = outil(dir, ['rail']);
  assert.strictEqual(declare.code, 0, 'lire le rail déclaré ne doit pas échouer : ' + declare.sortie);
  assert.strictEqual(declare.sortie.trim(), RAIL,
    'la sortie doit suivre la désignation du registre : ' + declare.sortie);

  // Nommer le lot donne le même résultat que s'en remettre à `lot_actif`.
  assert.strictEqual(outil(dir, ['rail', LOT]).sortie.trim(), RAIL,
    'nommer le lot doit rendre la même désignation');

  // Un lot inconnu ne se répare pas par un repli : il se refuse. Sinon
  // l'appelant bâtit sa condition sur une valeur inventée.
  const inconnu = outil(dir, ['rail', 'LOT-QUI-N-EXISTE-PAS']);
  assert.notStrictEqual(inconnu.code, 0, 'un lot inconnu doit être refusé : ' + inconnu.sortie);
  assert.ok(/REFUS/.test(inconnu.sortie), 'le refus doit se dire : ' + inconnu.sortie);

  // Un rail interdit — une ref protégée glissée au registre — se refuse aussi,
  // plutôt que de laisser un workflow s'autoriser à tourner sur `production`.
  ecrireEtat(dir, e => { e.lots[LOT].rail = 'production'; });
  const interdit = outil(dir, ['rail']);
  assert.notStrictEqual(interdit.code, 0, 'un rail interdit doit être refusé : ' + interdit.sortie);
});

verifier('aucune étape de la CI ne se conditionne à un nom de rail écrit en dur', () => {
  // Une condition peut nommer `main` ou `production` : ce sont des refs
  // protégées, des faits du dépôt que personne ne déplace. Tout autre nom de
  // branche dans un `if:` est une désignation de rail — et une désignation se
  // lit au registre, elle ne se recopie pas dans un fichier qui ne saura pas
  // qu'elle a changé.
  const PROTEGEES = ['main', 'production'];
  const dirWf = path.join(RACINE, '.github', 'workflows');
  const fichiers = fs.readdirSync(dirWf).filter(n => /\.ya?ml$/.test(n));
  assert.ok(fichiers.length > 0, 'aucun workflow trouvé — l’épreuve ne mesurerait rien');
  const fautes = [];
  for (const f of fichiers) {
    const lignes = fs.readFileSync(path.join(dirWf, f), 'utf8').split('\n');
    lignes.forEach((ligne, i) => {
      if (!/^\s*if:/.test(ligne)) return;
      for (const m of ligne.matchAll(/refs\/heads\/([A-Za-z0-9._\/-]+)/g)) {
        if (!PROTEGEES.includes(m[1])) fautes.push(`${f}:${i + 1} — ${m[1]}`);
      }
    });
  }
  assert.deepStrictEqual(fautes, [],
    'ces conditions nomment un rail au lieu de le lire au registre :\n  ' + fautes.join('\n  '));

  // Et le positif : la CI demande bien la désignation à l'outil.
  const tests = fs.readFileSync(path.join(dirWf, 'tests.yml'), 'utf8');
  assert.ok(/outils\/handoff\.js rail/.test(tests),
    'tests.yml ne demande plus le rail au registre — les étapes qui lui sont réservées ne sauraient plus quand s’exécuter');
});

verifier('le drapeau de rail exporté par la CI est un booléen, jamais un nom de branche', () => {
  // `NEXUS_REF_EST_LE_RAIL` répond « ce run est-il sur le rail ». S'il portait
  // un nom de branche, il redeviendrait une désignation — recopiable,
  // dérivable, et fausse le jour où le rail bouge. Il ne vaut que 0 ou 1.
  const chemin = path.join(RACINE, '.github', 'workflows', 'tests.yml');
  const lignes = fs.readFileSync(chemin, 'utf8').split('\n');
  const affectations = [];
  lignes.forEach((ligne, i) => {
    const m = ligne.match(/NEXUS_REF_EST_LE_RAIL=(.*)$/);
    if (m) affectations.push({ n: i + 1, valeur: m[1].split('"')[0].trim() });
  });
  assert.ok(affectations.length >= 2,
    'le drapeau doit être posé dans les deux sens — sinon un seul chemin est couvert');
  for (const a of affectations) {
    assert.ok(/^[01]$/.test(a.valeur),
      `tests.yml:${a.n} — le drapeau doit valoir 0 ou 1, pas ${JSON.stringify(a.valeur)}`);
  }
});

// `demandeVisee` se lit dans un processus séparé : le registre est repointé par
// NEXUS_HANDOFF_DIR, qui est lu au chargement du module.
function demandeViseeDansDir(dir) {
  const sortie = execFileSync('node',
    ['-e', `const h=require(${JSON.stringify(OUTIL)});process.stdout.write(String(h.demandeVisee(${JSON.stringify(LOT)},'decision-1.md')))`],
    { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  return sortie.trim();
}


// ── `wake_to` : l'adresse de réveil ────────────────────────────────────────
// 25/09/2026. Le réveil de l'Orchestrateur refusait de nommer un destinataire
// pour le seul lot qui en attendait un. La cause n'était pas l'inattention :
// `wake_to` n'avait AUCUN écrivain. Il se lisait dans un outil et ne s'écrivait
// nulle part — `demande` et `decision`, les deux seules façons de produire une
// enveloppe conforme, ne savaient pas l'émettre. PROTOCOL.md demandait à Claude
// de poser une adresse dans un champ qu'aucun outil ne pouvait produire, et sur
// deux lots consécutifs la règle a été honorée zéro fois. Une règle que rien ne
// mesure n'est pas une règle : ces épreuves la mesurent dans les deux sens.

// Un registre jetable dont le lot ATTEND un arbitrage — l'état, et le seul,
// où l'absence d'adresse a une conséquence : le réveil n'a personne à joindre.
function registreEnAttente() {
  const dir = registreSain();
  fs.unlinkSync(path.join(dir, 'lots', LOT, 'decision-1.md'));
  ecrireEtat(dir, e => { e.lots[LOT] = { statut: 'ATTENTE_DECISION', derniere_demande: 'request-1.md' }; });
  return dir;
}

function deposer(dir, args) {
  const corps = path.join(dir, 'corps.md');
  fs.writeFileSync(corps, '\n# Corps\n');
  try {
    return { code: 0, sortie: execFileSync('node', [OUTIL, 'demande', LOT, corps].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }) };
  } catch (e) { return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') }; }
}

const SIGNAL = /aucun de ses échanges ne déclare/;

verifier('un lot qui attend un arbitrage sans adresse de réveil est signalé — et déclarer l’adresse l’éteint', () => {
  const dir = registreEnAttente();

  const avant = valider(dir);
  assert.strictEqual(avant.code, 0, 'le lot est CONFORME : c’est sa joignabilité qui manque, pas sa forme\n' + avant.sortie);
  assert.ok(SIGNAL.test(avant.sortie), 'le lot sans `wake_to` doit être signalé :\n' + avant.sortie);

  // Le contre-témoin, sans lequel le vert ne prouverait rien : la même mesure,
  // après avoir posé l'adresse PAR L'OUTIL — donc par le chemin que la prose
  // demandait et que le code ne savait pas offrir.
  const depot = deposer(dir, ['--token-mode', 'LEAN', '--wake-to', 'https://github.com/vito-sainte-marie/nexus-vito/issues/28']);
  assert.strictEqual(depot.code, 0, 'déposer une demande adressée doit aboutir :\n' + depot.sortie);

  const apres = valider(dir);
  assert.strictEqual(apres.code, 0, apres.sortie);
  assert.ok(!SIGNAL.test(apres.sortie),
    'l’adresse déclarée doit éteindre le signal — sinon il est décoratif :\n' + apres.sortie);
});

verifier('l’adresse déclarée est celle que le réveil compose, et elle cite sa source', () => {
  // La preuve de bout en bout. Prouver que l'écrivain écrit ne prouve pas que
  // le lecteur lit : les deux outils doivent lire la MÊME déclaration.
  const dir = registreEnAttente();
  assert.strictEqual(deposer(dir, ['--token-mode', 'LEAN', '--wake-to', 'https://github.com/vito-sainte-marie/nexus-vito/issues/28']).code, 0);
  const r = JSON.parse(execFileSync('node', [path.join(RACINE, 'outils', 'reveil-orchestrateur.js'), '--json'],
    { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }));
  assert.strictEqual(r.reveil, true, 'une demande non arbitrée doit réveiller');
  assert.strictEqual(r.lots[0].adresse, 'https://github.com/vito-sainte-marie/nexus-vito/issues/28');
  assert.strictEqual(r.lots[0].adresse_source, 'request-2.md',
    'le réveil doit dire QUI a déclaré l’adresse — une adresse sans source n’est pas vérifiable');
  const corps = execFileSync('node', [path.join(RACINE, 'outils', 'reveil-orchestrateur.js'), '--message'],
    { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
  assert.ok(corps.includes('Adressé à: https://github.com/vito-sainte-marie/nexus-vito/issues/28'),
    'une URL contient des « / » : la chercher par regex littérale casse la source.\n' + corps);
  assert.ok(!/non déclaré/.test(corps), corps);
});

verifier('la déclaration la plus récente du lot fait foi', () => {
  // PROTOCOL.md : l'adresse est donnée par l'ordre, et une décision peut la
  // reposer. Sans cette règle, changer de canal exigerait de réécrire le passé
  // — or le registre est en ajout seul.
  const dir = registreEnAttente();
  assert.strictEqual(deposer(dir, ['--token-mode', 'LEAN', '--wake-to', 'ancienne-adresse']).code, 0);
  assert.strictEqual(deposer(dir, ['--token-mode', 'LEAN', '--wake-to', 'nouvelle-adresse']).code, 0);
  const r = JSON.parse(execFileSync('node', [path.join(RACINE, 'outils', 'reveil-orchestrateur.js'), '--json'],
    { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } }));
  assert.strictEqual(r.lots[0].adresse, 'nouvelle-adresse');
  assert.strictEqual(r.lots[0].adresse_source, 'request-3.md');
});

verifier('un lot déjà arbitré n’est pas signalé, même sans adresse', () => {
  // La proportion, mesurée : vingt-huit lots clos dorment au registre réel.
  // Un signal qui les réveillerait tous serait du bruit, et le bruit finit
  // toujours par être ignoré — y compris le jour où il a raison.
  const r = valider(registreSain());
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!SIGNAL.test(r.sortie),
    'un lot clos n’attend plus personne : le signaler serait du bruit\n' + r.sortie);
});

verifier('une adresse vide ou multiligne est refusée à l’écriture', () => {
  // Une enveloppe se lit ligne à ligne : un retour à la ligne y fabriquerait
  // un champ fantôme. Et une adresse vide ne réveille personne tout en
  // éteignant le signal — la pire des deux.
  const dir = registreEnAttente();
  const vide = deposer(dir, ['--token-mode', 'LEAN', '--wake-to', '   ']);
  assert.notStrictEqual(vide.code, 0, 'une adresse vide doit être refusée');
  assert.ok(/ne réveille personne/.test(vide.sortie), vide.sortie);

  const coupee = deposer(dir, ['--token-mode', 'LEAN', '--wake-to', 'ChatGPT\nstatus: APPROVED']);
  assert.notStrictEqual(coupee.code, 0, 'une adresse multiligne doit être refusée');
  assert.ok(/une seule ligne/.test(coupee.sortie), coupee.sortie);

  assert.ok(SIGNAL.test(valider(dir).sortie), 'aucun refus ne doit avoir laissé de trace dans le registre');
});

verifier('aucun outil ne code de destinataire en dur', () => {
  // PROTOCOL.md : « aucun outil ne code de destinataire en dur ; changer de
  // canal doit rester un fait écrit dans le rail, jamais une modification de
  // code. » NEXUS_HANDOFF_WAKE_TO existe comme secours d'exploitation ; posée
  // dans un workflow, elle deviendrait exactement la désignation recopiée hors
  // du registre que ce dépôt a déjà payée cinq fois.
  const dirWf = path.join(RACINE, '.github', 'workflows');
  const fautes = [];
  for (const f of fs.readdirSync(dirWf).filter(n => /\.ya?ml$/.test(n))) {
    fs.readFileSync(path.join(dirWf, f), 'utf8').split('\n').forEach((ligne, i) => {
      if (/^\s*#/.test(ligne)) return;
      if (/NEXUS_HANDOFF_WAKE_TO/.test(ligne)) fautes.push(`${f}:${i + 1} — ${ligne.trim()}`);
    });
  }
  assert.deepStrictEqual(fautes, [],
    'ces lignes fixent le destinataire dans du code :\n  ' + fautes.join('\n  '));
});


// ---------------------------------------------------------------------------
// L'ADRESSE DE RÉVEIL DOIT SE LIRE D'UNE SEULE FAÇON
//
// `issue #28` est l'adresse qu'on a spontanément envie d'écrire. En YAML, un
// « # » précédé d'une espace ouvre un commentaire : le lecteur maison prend
// toute la ligne et lit « issue #28 », un vrai parseur lit « issue ». L'adresse
// vaudrait deux choses selon qui la relit, et le jour où le réveil partirait à
// côté, la ligne aurait l'air juste. On refuse à l'écriture, pas à la lecture.
function cli(dir, args) {
  try {
    const sortie = execFileSync('node', [OUTIL, ...args],
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status, sortie: (e.stdout || '') + (e.stderr || '') };
  }
}

function corpsJetable(dir) {
  const f = path.join(dir, 'corps.md');
  fs.writeFileSync(f, 'Corps de demande jetable.\n');
  return f;
}

verifier('une adresse de réveil ambiguë en YAML est REFUSÉE', () => {
  const dir = registreSain();
  const avant = fs.readdirSync(path.join(dir, 'lots', LOT)).length;
  const r = cli(dir, ['demande', LOT, corpsJetable(dir), '--wake-to', 'issue #28']);
  assert.notStrictEqual(r.code, 0,
    '`issue #28` a été acceptée : elle se lira « issue » chez un parseur YAML');
  assert.ok(/commentaire/.test(r.sortie),
    'le refus doit DIRE pourquoi — sinon on le contourne en changeant d’outil :\n  ' + r.sortie);
  assert.strictEqual(fs.readdirSync(path.join(dir, 'lots', LOT)).length, avant,
    'un refus qui écrit quand même l’enveloppe n’est pas un refus');
});

// Contre-témoin : sans lui, un validateur qui refuse TOUTE adresse passerait
// l'épreuve ci-dessus sans rien garder de vivant.
verifier('une adresse de réveil sans ambiguïté est ACCEPTÉE', () => {
  const dir = registreSain();
  const r = cli(dir, ['demande', LOT, corpsJetable(dir),
    '--wake-to', 'https://github.com/vito-sainte-marie/nexus-vito/issues/28']);
  assert.strictEqual(r.code, 0, 'une URL doit passer : ' + r.sortie);
});

// ---------------------------------------------------------------------------
// UN NOM DE FICHIER N'EST PAS UNE IDENTITÉ
//
// Mesuré le 25/09/2026 : sept documents du lot 2 existaient en quatre à cinq
// versions incompatibles selon la ref — dont une décision, et `request-18.md`
// en cinq exemplaires distincts. Les runs d'agent branchent, déposent, poussent
// leur branche, et personne ne les rapatrie. Le réveil annonçait alors ces
// branches comme « où la lire » : il envoyait l'arbitre lire un AUTRE document
// que celui qu'il lui annonçait, sans que rien n'ait l'air faux.
const { corpsReveil } = require('./outils/reveil-orchestrateur.js');

function reveilJetable(refs, extra) {
  return corpsReveil({ reveil: true, lots: [Object.assign({
    lot: LOT, demande: 'request-18.md', branche: 'handoff-continuite-20260920',
    adresse: 'https://example.invalid/issues/28', adresse_source: 'request-18.md',
    refs_reelles: refs, motif: 'DEMANDE_NON_ARBITREE', token_mode: 'DEEP',
    branche_declaree_trompeuse: false,
    non_publiee: refs ? refs.memes.length === 0 : null,
  }, extra || {})] });
}

verifier('un homonyme n’est JAMAIS offert comme endroit où lire', () => {
  const corps = reveilJetable({ memes: [], homonymes: ['origin/claude/issue-28-x'], identifiable: true });
  const ligne = corps.split('\n').find(l => l.startsWith('Branche où la lire:'));
  assert.ok(ligne, 'le réveil doit toujours dire où lire, même pour dire « nulle part »');
  assert.ok(!/claude\/issue-28-x/.test(ligne),
    'une ref au même nom mais au contenu différent a été proposée à la lecture :\n  ' + ligne);
  assert.ok(/MÊME NOM/.test(corps) && /claude\/issue-28-x/.test(corps),
    'et elle doit être NOMMÉE comme homonyme, pas passée sous silence : la taire\n' +
    '  laisse l’arbitre tomber dessus par ses propres moyens, sans avertissement');
});

verifier('« pas encore poussée » ne se dit pas « cherche ailleurs »', () => {
  const corps = reveilJetable({ memes: [], homonymes: [], identifiable: true });
  assert.ok(/n'est sur aucune ref/.test(corps),
    'une demande absente de toute ref doit être annoncée comme non poussée :\n  ' + corps);
});

verifier('une ref qui porte VRAIMENT le document reste proposée', () => {
  const corps = reveilJetable({ memes: ['origin/handoff-continuite-20260920'], homonymes: [], identifiable: true });
  const ligne = corps.split('\n').find(l => l.startsWith('Branche où la lire:'));
  assert.ok(/origin\/handoff-continuite-20260920/.test(ligne),
    'le contre-témoin échoue : plus aucune branche n’est proposée, même la bonne :\n  ' + ligne);
  assert.ok(!/n'est sur aucune ref/.test(corps),
    'et le document étant lisible, il ne faut pas le dire non poussé');
});


// Le défaut rejoué sur un dépôt FABRIQUÉ pour le porter : deux branches, un
// seul nom de fichier, deux contenus. Une résolution par nom les confond ; une
// résolution par empreinte les sépare. Sans ce dépôt jetable, les épreuves de
// rendu ci-dessus passeraient encore avec une plomberie revenue au nom.
const { blobsParRef, classerRefs } = require('./outils/reveil-orchestrateur.js');

function depotJetableAvecHomonyme() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homonyme-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 'e', GIT_AUTHOR_EMAIL: 'e@e',
           GIT_COMMITTER_NAME: 'e', GIT_COMMITTER_EMAIL: 'e@e' } });
  g('init', '-q', '-b', 'rail');
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  const f = path.join(dir, 'lots', 'request-18.md');
  fs.writeFileSync(f, 'LE document.\n');
  g('add', '-A'); g('commit', '-qm', 'rail');
  g('checkout', '-q', '-b', 'run-agent');
  fs.writeFileSync(f, 'UN AUTRE document, même nom.\n');
  g('add', '-A'); g('commit', '-qm', 'run');
  g('checkout', '-q', 'rail');
  return { dir, chemin: 'lots/request-18.md',
           empreinte: g('hash-object', '--', f).trim() };
}

verifier('deux refs au même nom sont séparées par leur CONTENU', () => {
  const d = depotJetableAvecHomonyme();
  const blobs = blobsParRef(d.dir, d.chemin, null);
  assert.strictEqual(blobs.size, 2, 'les deux branches portent bien le chemin');
  assert.notStrictEqual(blobs.get('rail'), blobs.get('run-agent'),
    'la plomberie doit rapporter les OBJETS, pas une simple présence :\n' +
    '  si elle rendait la même valeur pour les deux, aucun classement ne pourrait trancher');

  const r = classerRefs(d.empreinte, blobs);
  assert.deepStrictEqual(r.memes, ['rail'],
    'seule la ref portant les mêmes octets est un endroit où lire');
  assert.deepStrictEqual(r.homonymes, ['run-agent'],
    'la ref au même nom et au contenu différent est un homonyme, pas une adresse');
});

// Contre-témoin : sans lui, un classement qui déclarerait TOUT homonyme
// passerait l'épreuve ci-dessus.
verifier('une empreinte inconnue n’accuse personne', () => {
  const d = depotJetableAvecHomonyme();
  const r = classerRefs(null, blobsParRef(d.dir, d.chemin, null));
  assert.deepStrictEqual(r.homonymes, [],
    'ne pas savoir identifier le document n’autorise pas à traiter les refs en homonymes');
  assert.strictEqual(r.identifiable, false,
    'et il faut le DIRE, sinon le réveil affirme une certitude qu’il n’a pas');
});


if (echecs.length) {
  console.error(`\n${echecs.length} épreuve(s) en échec sur ${passes + echecs.length} :`);
  for (const e of echecs) console.error(`\n— ${e.nom}\n  ${String(e.message).split('\n').join('\n  ')}`);
  process.exit(1);
}

console.log(`\n${passes} vérifications passées — le protocole ne repose plus sur la discipline de ses acteurs.`);
