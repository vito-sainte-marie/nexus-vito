'use strict';
// GOV-WAKE-TO-OBLIGATOIRE-20261020 — W1 à W6.
//
// GOV-R3 request-1 (3fa64c9d) a été déposée sans `wake_to` : le réveil de
// l'Orchestrateur n'a pas pu composer de destinataire (RAIL_SANS_ADRESSE, run
// 39474481132), la demande est restée muette jusqu'au redépôt. Deuxième fois
// en deux jours que PROTOCOL.md (« Claude la pose en ouvrant le lot ») n'est
// pas honoré, alors que `handoff.js verifier` ne fait qu'avertir — et après
// coup. Une règle que rien ne bloque n'est pas une règle.
//
// Cette épreuve tient : le refus précède toute écriture (W1, W4, W5),
// l'adresse explicite continue de passer (W2), l'adresse déjà posée sur un
// échange antérieur du lot est héritée sans valeur par défaut écrite (W3), et
// le registre réel des 78 lots existants n'est pas rétroactivement refusé
// (W6 — seul `verifier` continue d'avertir, jamais de bloquer, pour l'historique).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const RAIL = 'handoff-continuite-20260920';

let passes = 0;
let total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}

/** Un bac à sable complet : STATE.json vide, aucun lot, aucun miroir. */
function bac() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-wake-to-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'),
    JSON.stringify({ protocol: 'nexus-handoff/2', lot_actif: null, lots: {} }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'corps.md'), '# Corps d\'épreuve\n\nUn corps minimal.\n');
  return dir;
}

/** Lance `handoff.js demande` dans le bac, et rend code de sortie + sorties. */
function demande(dir, lot, args) {
  try {
    const sortie = execFileSync('node', [OUTIL, 'demande', lot, path.join(dir, 'corps.md'), '--rail', RAIL].concat(args || []),
      { cwd: RACINE, encoding: 'utf8', env: Object.assign({}, process.env, { NEXUS_HANDOFF_DIR: dir }) });
    return { code: 0, sortie, erreur: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, sortie: String(e.stdout || ''), erreur: String(e.stderr || '') };
  }
}

function decision(dir, lot, args) {
  try {
    const sortie = execFileSync('node', [OUTIL, 'decision', lot, path.join(dir, 'corps.md')].concat(args || []),
      { cwd: RACINE, encoding: 'utf8', env: Object.assign({}, process.env, { NEXUS_HANDOFF_DIR: dir }) });
    return { code: 0, sortie, erreur: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, sortie: String(e.stdout || ''), erreur: String(e.stderr || '') };
  }
}

const etat = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
let n = 0;
const lotNeuf = () => `EPREUVE-WAKE-TO-${(n++).toString().padStart(3, '0')}-20261020`;

console.log('\nGOV-WAKE-TO-OBLIGATOIRE-20261020 — wake_to obligatoire sur une demande\n');

t('W1 — demande sur un lot neuf sans --wake-to : refus, aucun fichier ecrit, STATE.json inchange', () => {
  const dir = bac(), lot = lotNeuf();
  const avant = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');
  const r = demande(dir, lot, []);
  assert.strictEqual(r.code, 1, `la demande sans wake_to aurait du etre refusee : ${r.sortie}`);
  assert.ok(/REFUS/.test(r.erreur), `le refus doit etre dit : ${r.erreur}`);
  assert.ok(/wake_to|wake-to/.test(r.erreur), `le refus doit nommer wake_to : ${r.erreur}`);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot)), 'aucun repertoire de lot ne doit avoir ete cree');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), avant, 'STATE.json ne doit pas avoir bouge');
});

t('W2 — demande avec --wake-to <adresse valide> : acceptee, wake_to dans l\'enveloppe', () => {
  const dir = bac(), lot = lotNeuf();
  const r = demande(dir, lot, ['--wake-to', 'https://github.com/vito-sainte-marie/nexus-vito/issues/28']);
  assert.strictEqual(r.code, 0, `sortie inattendue : ${r.erreur || r.sortie}`);
  const cible = path.join(dir, 'lots', lot, 'request-1.md');
  assert.ok(fs.existsSync(cible), 'request-1.md aurait du etre ecrit');
  const env = fs.readFileSync(cible, 'utf8');
  assert.ok(/^wake_to: https:\/\/github\.com\/vito-sainte-marie\/nexus-vito\/issues\/28$/m.test(env), `wake_to absent de l'enveloppe :\n${env}`);
  assert.strictEqual(etat(dir).lots[lot].statut, 'ATTENTE_DECISION');
});

t('W3 — un echange anterieur du lot declare wake_to : nouvelle demande sans option, heritee, aucune valeur ecrite par defaut', () => {
  const dir = bac(), lot = lotNeuf();
  const r1 = demande(dir, lot, ['--wake-to', 'ChatGPT']);
  assert.strictEqual(r1.code, 0, `premiere demande refusee : ${r1.erreur}`);
  const d = decision(dir, lot, ['--decision', 'APPROVED', '--closes', 'false', '--en-reponse-a', 'request-1.md', '--auteur', 'ChatGPT']);
  assert.strictEqual(d.code, 0, `decision refusee : ${d.erreur}`);
  const r2 = demande(dir, lot, []);
  assert.strictEqual(r2.code, 0, `la seconde demande aurait du heriter l'adresse : ${r2.erreur || r2.sortie}`);
  const cible = path.join(dir, 'lots', lot, 'request-2.md');
  assert.ok(fs.existsSync(cible), 'request-2.md aurait du etre ecrit');
  const env = fs.readFileSync(cible, 'utf8');
  assert.ok(!/^wake_to:/m.test(env), `aucune valeur ne doit etre ecrite par defaut sur l'echange herite :\n${env}`);
});

t('W4 — --wake-to vide ou ressemblant a une option : refus inchange', () => {
  const dir = bac(), lot = lotNeuf();
  const vide = demande(dir, lot, ['--wake-to', '']);
  assert.notStrictEqual(vide.code, 0, 'une adresse vide aurait du etre refusee');
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot, 'request-1.md')), 'aucune enveloppe ne doit avoir ete ecrite (adresse vide)');
  const ressembleOption = demande(dir, lot, ['--wake-to', '--rail']);
  assert.notStrictEqual(ressembleOption.code, 0, 'une adresse ressemblant a une option aurait du etre refusee');
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot, 'request-1.md')), 'aucune enveloppe ne doit avoir ete ecrite (adresse en forme d\'option)');
});

t('W5 — le refus precede toute ecriture : aucun repertoire de lot cree', () => {
  const dir = bac(), lot = lotNeuf();
  const r = demande(dir, lot, []);
  assert.strictEqual(r.code, 1);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot)), 'le repertoire du lot ne doit pas exister apres un refus');
  assert.ok(!fs.existsSync(path.join(dir, 'CURRENT.md')), 'les miroirs ne doivent pas avoir ete regeneres apres un refus');
});

t('W6 — non-regression : verifier reste vert sur le registre reel, sans refus retroactif', () => {
  const sortie = execFileSync('node', [OUTIL, 'verifier'], { cwd: RACINE, encoding: 'utf8' });
  assert.ok(/Handoff v2 : registre, enveloppes et STATE\.json conformes/.test(sortie), `verifier aurait du rester vert :\n${sortie}`);
});

console.log(`\n${passes}/${total} verifications passees — une demande sans destinataire ne s'ecrit plus.`);
