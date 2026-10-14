'use strict';
// Épreuve de P8, condition 1 (decision-3, lot NEXUS-REPARATION-HANDOFF-1-20261014) :
// refuser AU DÉPÔT, avant tout appel à l'arbitre, une demande qui suit une
// décision APPROVED_WITH_CONDITIONS non fermée sans sa section de preuve.
//
// Le 14/10/2026, request-2.md du lot NEXUS-REPARATION-HANDOFF-1-20261014 est
// parti sans « ## Preuve des conditions de decision-1 » : l'oubli de format a
// été traité comme un arrêt (CONDITIONS_NON_PROUVEES), relayé plus d'une heure
// avant correction. Cette épreuve tient trois choses à la fois : le refus
// mord, il mord AVANT toute écriture, et un dépôt légitime (section présente,
// décision sans conditions, ou lot déjà fermé) continue de passer.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'handoff.js');

let passes = 0;
let total = 0;
function t(nom, fn) {
  total++;
  try { fn(); passes++; console.log(`  ok  ${nom}`); }
  catch (e) { console.error(`  ECHEC  ${nom}\n        ${e.message}`); process.exitCode = 1; }
}

function bac() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-garde-conditions-'));
  fs.mkdirSync(path.join(dir, 'lots'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.json'),
    JSON.stringify({ protocol: 'nexus-handoff/2', lot_actif: null, lots: {} }, null, 2) + '\n');
  return dir;
}
function corps(dir, nom, texte) {
  const f = path.join(dir, nom);
  fs.writeFileSync(f, texte);
  return f;
}
function lancer(dir, args) {
  try {
    const sortie = execFileSync('node', [OUTIL].concat(args),
      { cwd: RACINE, encoding: 'utf8', env: Object.assign({}, process.env, { NEXUS_HANDOFF_DIR: dir }) });
    return { code: 0, sortie, erreur: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, sortie: String(e.stdout || ''), erreur: String(e.stderr || '') };
  }
}
const demande = (dir, lot, fichierCorps, args) => lancer(dir, ['demande', lot, fichierCorps].concat(args || []));
const decision = (dir, lot, fichierCorps, args) => lancer(dir, ['decision', lot, fichierCorps].concat(args || []));
const etat = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'));

console.log('\nGarde P8/1 — refus au dépôt d’une demande sans preuve des conditions\n');

t('une décision APPROVED_WITH_CONDITIONS non fermée bloque la demande suivante sans la section', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-1';
  const r1 = demande(dir, lot, corps(dir, 'c1.md', '# Demande initiale\n'));
  assert.strictEqual(r1.code, 0, `demande initiale refusée : ${r1.erreur}`);
  const rd = decision(dir, lot, corps(dir, 'd1.md', '# Décision\nAPPROVED_WITH_CONDITIONS, deux conditions.\n'),
    ['--decision', 'APPROVED_WITH_CONDITIONS', '--closes', 'false', '--auteur', 'ChatGPT']);
  assert.strictEqual(rd.code, 0, `décision refusée : ${rd.erreur}`);

  const avantEtat = fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8');
  const r2 = demande(dir, lot, corps(dir, 'c2.md', '# Suite\nAucune section de preuve ici.\n'));
  assert.strictEqual(r2.code, 1, 'la demande sans section de preuve aurait dû être refusée');
  assert.ok(/REFUS/.test(r2.erreur), `le motif doit être dit : ${r2.erreur}`);
  assert.ok(/Preuve des conditions de decision-1/.test(r2.erreur), `le refus doit nommer la section attendue : ${r2.erreur}`);
  assert.ok(!fs.existsSync(path.join(dir, 'lots', lot, 'request-2.md')), 'request-2.md ne doit pas exister');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'STATE.json'), 'utf8'), avantEtat, 'STATE.json ne doit pas bouger sur un refus');
});

t('la même suite passe dès que la section de preuve est présente', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-2';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande initiale\n'));
  decision(dir, lot, corps(dir, 'd1.md', '# Décision\nAPPROVED_WITH_CONDITIONS.\n'),
    ['--decision', 'APPROVED_WITH_CONDITIONS', '--closes', 'false', '--auteur', 'ChatGPT']);
  const r2 = demande(dir, lot, corps(dir, 'c2.md',
    '# Suite\n\n## Preuve des conditions de decision-1\n\nLes deux conditions sont prouvées ici.\n'));
  assert.strictEqual(r2.code, 0, `la demande aurait dû passer : ${r2.erreur}`);
  assert.ok(fs.existsSync(path.join(dir, 'lots', lot, 'request-2.md')), 'request-2.md aurait dû être écrit');
  assert.strictEqual(etat(dir).lots[lot].statut, 'ATTENTE_DECISION');
});

t('une décision APPROVED (sans conditions) ne déclenche aucune exigence', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-3';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande initiale\n'));
  decision(dir, lot, corps(dir, 'd1.md', '# Décision\nAPPROVED, rien à prouver.\n'),
    ['--decision', 'APPROVED', '--closes', 'false', '--auteur', 'ChatGPT']);
  const r2 = demande(dir, lot, corps(dir, 'c2.md', '# Suite sans aucune section particulière\n'));
  assert.strictEqual(r2.code, 0, `une décision APPROVED simple ne doit rien exiger : ${r2.erreur}`);
});

t('une décision APPROVED_WITH_CONDITIONS déjà fermée (closes: true) ne bloque pas une demande ultérieure', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-4';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande initiale\n'));
  decision(dir, lot, corps(dir, 'd1.md', '# Décision\nAPPROVED_WITH_CONDITIONS, lot fermé.\n'),
    ['--decision', 'APPROVED_WITH_CONDITIONS', '--closes', 'true', '--auteur', 'ChatGPT']);
  const r2 = demande(dir, lot, corps(dir, 'c2.md', '# Nouvelle demande, lot déjà fermé\n'));
  assert.strictEqual(r2.code, 0, `un lot fermé ne doit plus exiger la preuve de ses anciennes conditions : ${r2.erreur}`);
});

t('la première demande d’un lot (aucune décision encore déposée) passe toujours', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-5';
  const r1 = demande(dir, lot, corps(dir, 'c1.md', '# Toute première demande\n'));
  assert.strictEqual(r1.code, 0, `la première demande d'un lot ne doit jamais être bloquée : ${r1.erreur}`);
});

t('la section est reconnue même suivie d’autres titres, et insensible à une casse de titre voisine mal formée', () => {
  const dir = bac();
  const lot = 'EPREUVE-GARDE-CONDITIONS-6';
  demande(dir, lot, corps(dir, 'c1.md', '# Demande initiale\n'));
  decision(dir, lot, corps(dir, 'd1.md', '# Décision\nAPPROVED_WITH_CONDITIONS.\n'),
    ['--decision', 'APPROVED_WITH_CONDITIONS', '--closes', 'false', '--auteur', 'ChatGPT']);
  const r2 = demande(dir, lot, corps(dir, 'c2.md',
    '# Suite\n\n## Preuve des conditions de decision-1\nTexte.\n\n## 1. Objet\nLe reste de la demande.\n'));
  assert.strictEqual(r2.code, 0, `la section suivie d'autres titres doit être reconnue : ${r2.erreur}`);
});

console.log(`\n${passes}/${total} vérifications passées — ${total - passes} échec(s).`);
process.exit(process.exitCode || 0);
