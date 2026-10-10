'use strict';
// Épreuve du refus de doublon de preuve dans `outils/handoff.js demande`.
//
// Le 09/10/2026, request-2.md du lot NEXUS-HEURES-VERIFY-PAYE-1-20261009 est
// partie avec `refs-protegees` deux fois : la preuve que l'outil injecte
// lui-même, et celle que j'avais passée en `--preuve`. Le validateur n'a rien
// dit — il lit la PREMIÈRE occurrence d'un identifiant et ignore les suivantes
// en silence. Une preuve qui ne juge rien est pire qu'absente : elle se lit
// comme un jugement.
//
// Cette épreuve tient trois choses à la fois : le refus mord, il mord AVANT
// toute écriture (un appel refusé ne laisse ni répertoire ni fichier ni état
// modifié), et un appel légitime continue de passer avec exactement une preuve
// `refs-protegees`.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');
const LOT = 'EPREUVE-DOUBLON-PREUVE-20261009';

let passes = 0;
let total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}

/** Un bac à sable complet : STATE.json vide, aucun lot, aucun miroir. */
function bac() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-doublon-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'),
    JSON.stringify({ protocol: 'nexus-handoff/2', lot_actif: null, lots: {} }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'corps.md'), '# Corps d\'épreuve\n\nUn corps minimal.\n');
  return dir;
}

/** Lance `handoff.js demande` dans le bac, et rend code de sortie + sorties. */
function demande(dir, args) {
  try {
    const sortie = execFileSync('node', [OUTIL, 'demande', LOT, path.join(dir, 'corps.md')].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: Object.assign({}, process.env, { NEXUS_HANDOFF_DIR: dir }) });
    return { code: 0, sortie, erreur: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, sortie: String(e.stdout || ''), erreur: String(e.stderr || '') };
  }
}

const etat = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));
const idsPreuves = (fichier) => fs.readFileSync(fichier, 'utf8')
  .split('\n---')[0].split('\n').map(l => (l.match(/^  - id: (.+)$/) || [])[1]).filter(Boolean);

console.log('\nRefus de doublon de preuve — handoff.js demande\n');

t('un appel legitime passe, et porte exactement les trois preuves auto', () => {
  const dir = bac();
  const r = demande(dir, ['--token-mode', 'LEAN', '--preuve', 'suite:VERIFIED:268/277']);
  assert.strictEqual(r.code, 0, `sortie inattendue : ${r.erreur || r.sortie}`);
  const cible = path.join(dir, 'lots', LOT, 'request-1.md');
  assert.ok(fs.existsSync(cible), 'request-1.md aurait du etre ecrit');
  const ids = idsPreuves(cible);
  assert.deepStrictEqual(ids, ['refs-protegees', 'merge-base-production', 'diff-applicatif-production', 'suite'], `preuves trouvees : ${ids.join(', ')}`);
  assert.strictEqual(etat(dir).lots[LOT].statut, 'ATTENTE_DECISION');
});

t('passer sa propre preuve refs-protegees est refuse', () => {
  const dir = bac();
  const r = demande(dir, ['--preuve', 'refs-protegees:VERIFIED:main=abc production=def']);
  assert.strictEqual(r.code, 1, 'le doublon aurait du etre refuse');
  assert.ok(/REFUS/.test(r.erreur), `le motif du refus doit etre dit : ${r.erreur}`);
  assert.ok(/refs-protegees/.test(r.erreur), 'le refus doit nommer la preuve en cause');
});

t('un refus ne laisse aucune trace : ni fichier, ni repertoire, ni etat modifie', () => {
  const dir = bac();
  const avant = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');
  const r = demande(dir, ['--preuve', 'refs-protegees:VERIFIED:x']);
  assert.strictEqual(r.code, 1);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT)),
    'le repertoire du lot a ete cree alors que la demande etait refusee');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), avant,
    'STATE.json a bouge alors que la demande etait refusee');
  assert.ok(!fs.existsSync(path.join(dir, 'CURRENT.md')),
    'les miroirs ont ete regeneres alors que la demande etait refusee');
});

t('deux preuves de l\'appelant portant le meme identifiant sont refusees', () => {
  const dir = bac();
  const r = demande(dir, ['--preuve', 'suite:VERIFIED:268/277', '--preuve', 'suite:DECLARED:a-mesurer']);
  assert.strictEqual(r.code, 1, 'deux `suite` auraient du etre refusees');
  assert.ok(/REFUS.*suite/.test(r.erreur), `le refus doit nommer la preuve suite : ${r.erreur}`);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT)), 'rien ne doit avoir ete ecrit');
});

t('des identifiants distincts passent tous, dans l\'ordre donne', () => {
  const dir = bac();
  const r = demande(dir, [
    '--preuve', 'suite:VERIFIED:268/277',
    '--preuve', 'lang-003:VERIFIED:1480',
    '--preuve', 'mutations:VERIFIED:7/7',
  ]);
  assert.strictEqual(r.code, 0, `sortie inattendue : ${r.erreur}`);
  const ids = idsPreuves(path.join(dir, 'lots', LOT, 'request-1.md'));
  assert.deepStrictEqual(ids, ['refs-protegees', 'merge-base-production', 'diff-applicatif-production', 'suite', 'lang-003', 'mutations']);
});

t('le registre reel porte le doublon qui a motive ce garde-fou', () => {
  // On ne reecrit pas un fichier publie : la doctrine l'interdit, et l'ecart
  // doit rester lisible. Cette verification ne juge donc pas le passe — elle
  // documente par la mesure pourquoi le refus existe. Elle tolere les deux
  // etats, parce qu'une reconciliation future peut legitimement republier.
  const publie = path.join(RACINE, 'docs', 'handoff', 'lots',
    'NEXUS-HEURES-VERIFY-PAYE-1-20261009', 'request-2.md');
  if (!fs.existsSync(publie)) { console.log('      request-2.md absent de cette copie — rien a mesurer'); return; }
  const ids = idsPreuves(publie);
  const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
  console.log(doublons.length
    ? `      ${doublons.length} doublon(s) dans request-2.md : ${doublons.join(', ')} — laisse en place, visible`
    : '      request-2.md ne porte plus de doublon');
  assert.ok(ids.length >= 1, 'request-2.md doit porter au moins une preuve');
});


// Cette version de l'outil injecte DEUX preuves de plus que la version
// historique : merge-base-production et diff-applicatif-production. Le risque
// de doublon y est triple, et chacune doit etre refusee pour sa propre raison,
// sans quoi la garde ne couvrirait qu'un tiers de la surface qu'elle pretend
// couvrir — et c'est precisement ce qu'un decompte en dur aurait cache.
for (const auto of ['merge-base-production', 'diff-applicatif-production']) {
  t(`passer sa propre preuve ${auto} est refuse, sans laisser de trace`, () => {
    const dir = bac();
    const avantEtat = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');
    const r = demande(dir, ['--preuve', auto + ':VERIFIED:valeur-posee-a-la-main']);
    assert.strictEqual(r.code, 1, `le doublon ${auto} aurait du etre refuse`);
    assert.ok(new RegExp('REFUS[^]*' + auto).test(r.erreur), `le refus doit nommer ${auto} : ${r.erreur}`);
    assert.ok(!fs.existsSync(path.join(dir, 'lots', LOT)), 'un refus ne doit creer aucun repertoire');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), avantEtat,
      'un refus ne doit pas toucher STATE.json');
  });
}

console.log(`\n${passes}/${total} verifications passees — un identifiant de preuve ne peut plus etre double.`);
