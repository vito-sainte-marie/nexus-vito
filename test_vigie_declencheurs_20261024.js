// VIGIE-DECLENCHEURS-20261024 — la vigie se déclenche par exactement trois événements : le cron (filet),
// le lancement manuel et la fin du workflow « Tests » sur le rail ; permissions inchangées.
// Chaque mutation du workflow (en mémoire) doit être refusée par le contrôle.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const WORKFLOW = path.join(__dirname, '.github', 'workflows', 'vigie-cloture.yml');
const RAIL = 'handoff-continuite-20260920';

// Lit le texte du workflow ; lève sur tout écart au contrat.
function controler(texte) {
  const code = texte.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  const on = code.match(/^on:\s*\n((?:[ \t]+\S.*\n|\s*\n)+)/m);
  assert.ok(on, 'bloc on: de premier niveau attendu');
  const cles = [...on[1].matchAll(/^ {2}([A-Za-z_]+):/gm)].map(m => m[1]).sort();
  assert.deepStrictEqual(cles, ['schedule', 'workflow_dispatch', 'workflow_run'], `exactement trois déclencheurs : ${cles}`);
  const crons = [...on[1].matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.deepStrictEqual(crons.length, 1, 'le cron reste, unique, comme filet');
  const wr = on[1].match(/^ {2}workflow_run:\s*\n((?:[ \t]{4,}\S.*\n?)+)/m);
  assert.ok(wr, 'bloc workflow_run attendu');
  assert.ok(/workflows:\s*\[\s*['"]Tests['"]\s*\]/.test(wr[1]), 'workflow_run vise « Tests » et lui seul');
  assert.ok(/types:\s*\[\s*completed\s*\]/.test(wr[1]), 'workflow_run sur la fin (completed)');
  assert.ok(new RegExp(`branches:\\s*\\[\\s*${RAIL}\\s*\\]`).test(wr[1]), `workflow_run limité à la branche ${RAIL}`);
  const perm = code.match(/^permissions:\s*\n((?:[ \t]+\S.*\n?)+)/m);
  assert.ok(perm, 'bloc permissions: de premier niveau attendu');
  assert.deepStrictEqual(perm[1].split('\n').map(s => s.trim()).filter(Boolean).sort(), ['actions: read', 'contents: read'], 'permissions exactes');
  assert.ok(!/^\s{2,}permissions:/m.test(code), 'aucune permission par job');
}

let total = 0, echecs = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`  ok  ${nom}`); } catch (e) { echecs++; console.log(`  KO  ${nom}\n      ${e.message}`); }
}

const original = fs.readFileSync(WORKFLOW, 'utf8');

epreuve('D1 — le workflow déclare exactement schedule, workflow_dispatch, workflow_run (« Tests », completed, branche du rail) et les permissions contents: read + actions: read', () => controler(original));

const mutations = [
  ['M1 — un déclencheur de plus (push)', t => t.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  push:\n    branches: [main]\n")],
  ['M2 — le cron est retiré', t => t.replace(/  schedule:\n    - cron: '17 \* \* \* \*'\n/, '')],
  ['M3 — permission élargie (contents: write)', t => t.replace('contents: read', 'contents: write')],
  ['M4 — permission élargie (issues: write en plus)', t => t.replace('actions: read\n', 'actions: read\n  issues: write\n')],
  ['M5 — permission actions retirée', t => t.replace(/^  actions: read\n/m, '')],
  ['M6 — branche du workflow_run omise', t => t.replace(/    branches: \[[^\]]+\]\n/, '')],
  ['M7 — workflow_run vise un autre workflow', t => t.replace("['Tests']", "['Deploy']")],
  ['M8 — workflow_dispatch retiré', t => t.replace('  workflow_dispatch:\n', '')],
  ['M9 — workflow_run sur requested au lieu de completed', t => t.replace('[completed]', '[requested]')],
  ['M10 — workflow_run sur la branche main', t => t.replace(RAIL + ']', 'main]')],
];
for (const [nom, mute] of mutations) {
  epreuve(`${nom} → refusée`, () => {
    const m = mute(original);
    assert.notStrictEqual(m, original, 'la mutation doit changer le texte (sinon elle ne prouve rien)');
    assert.throws(() => controler(m), 'le contrôle doit refuser cette mutation');
  });
}

console.log(`\n${total - echecs}/${total} épreuves`);
process.exit(echecs ? 1 : 0);
