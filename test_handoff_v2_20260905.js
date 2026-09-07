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
  assert.ok(/déjà marquée consommée/.test(sortie), 'le refus doit nommer sa raison : ' + sortie);
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

function outil(dir, args) {
  try {
    const sortie = execFileSync('node', [OUTIL].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: { ...process.env, NEXUS_HANDOFF_DIR: dir } });
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
  const r = outil(dir, ['decision', LOT, corps, '--decision', 'BLOCKED', '--closes', 'true']);
  assert.strictEqual(r.code, 0, 'la commande doit réussir : ' + r.sortie);
  const ecrit = fs.readFileSync(path.join(dir, 'lots', LOT, 'decision-2.md'), 'utf8');
  assert.ok(/^decision: BLOCKED$/m.test(ecrit), 'verdict posé par l’outil : ' + ecrit);
  assert.ok(/^branch: config-par-environnement$/m.test(ecrit), 'branche posée par l’outil, jamais retapée : ' + ecrit);
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

console.log(`\n${passes} vérifications passées — le protocole ne repose plus sur la discipline de ses acteurs.`);
