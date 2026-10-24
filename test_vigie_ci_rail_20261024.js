// VIGIE-CI-RAIL-20261024 — la vigie alerte quand la CI du rail est rouge depuis plus d'une heure.
// Faux `gh` (processus séparé, journal d'appels) : rouge à 61 minutes -> alerte nommant le commit et la
// première ligne rouge ; rouge à 59 minutes -> silence ; série rouge mesurée depuis son premier run (pas le dernier), limite de 20 runs dite ; vert, panne de gh, lecture seule.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'vigie-ci-rail.js');
const MAINT = '2026-10-24T12:00:00Z';
const il_y_a = (min) => new Date(new Date(MAINT) - min * 60000).toISOString();
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const LOG = [
  'non-regression\tGuardian QA\t﻿2026-10-24T10:12:20.4323389Z ##[group]Run node outils/guardian-qa.js',
  'non-regression\tGuardian QA\t2026-10-24T10:12:20.7230920Z Guardian QA: 1 finding(s) sur 354 épreuve(s).',
  'non-regression\tGuardian QA\t2026-10-24T10:12:20.7234149Z   [attendu_calcule_par_le_meme_appel] test_boucle_tour_vide_20261015.js:249 — comparaison circulaire',
  'non-regression\tGuardian QA\t2026-10-24T10:12:20.7297638Z ##[error]Process completed with exit code 1.',
].join('\n');

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vigie-ci-')));
fs.writeFileSync(path.join(tmp, 'gh'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const d = process.env.FAUX_GH_DIR, a = process.argv.slice(2);
fs.appendFileSync(path.join(d, 'appels.log'), a.join(' ') + '\\n');
if (fs.existsSync(path.join(d, 'PANNE'))) { console.error('HTTP 401: Bad credentials'); process.exit(1); }
if (a[0] === 'run' && a[1] === 'list') return process.stdout.write(fs.readFileSync(path.join(d, 'runs.json'), 'utf8'));
if (a[0] === 'run' && a[1] === 'view') return process.stdout.write(fs.readFileSync(path.join(d, 'log.txt'), 'utf8'));
console.error('commande inattendue: ' + a.join(' ')); process.exit(2);
`, { mode: 0o755 });

let total = 0, echecs = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); } catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}
function vigie(runs, { panne = false, outil = OUTIL } = {}) {
  const d = fs.mkdtempSync(path.join(tmp, 'cas-'));
  fs.writeFileSync(path.join(d, 'runs.json'), JSON.stringify(runs));
  fs.writeFileSync(path.join(d, 'log.txt'), LOG);
  if (panne) fs.writeFileSync(path.join(d, 'PANNE'), '');
  const r = spawnSync(process.execPath, [outil], { encoding: 'utf8', env: { ...process.env, NEXUS_GH: path.join(tmp, 'gh'), FAUX_GH_DIR: d, NEXUS_MAINTENANT: MAINT } });
  const appels = fs.existsSync(path.join(d, 'appels.log')) ? fs.readFileSync(path.join(d, 'appels.log'), 'utf8').trim().split('\n') : [];
  return { code: r.status, sortie: r.stdout + r.stderr, appels };
}
const run = (conclusion, minutes, extra = {}) => ({ databaseId: 111, status: 'completed', conclusion, headSha: SHA, createdAt: il_y_a(minutes), updatedAt: il_y_a(minutes), ...extra });

epreuve('rouge depuis 61 minutes : le run échoue, l\'annotation nomme le commit et la première ligne rouge', () => {
  const r = vigie([run('failure', 61)]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(/^::error title=CI du rail rouge::/m.test(r.sortie), r.sortie);
  assert.ok(r.sortie.includes('abcdef01'), `commit attendu :\n${r.sortie}`);
  assert.ok(r.sortie.includes('test_boucle_tour_vide_20261015.js:249'), `première ligne rouge attendue :\n${r.sortie}`);
  assert.ok(r.sortie.includes('étape « non-regression / Guardian QA »'), `étape attendue :\n${r.sortie}`);
});
epreuve('rouge depuis 59 minutes : silence, code 0, aucune annotation', () => {
  const r = vigie([run('failure', 59)]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!/::error/.test(r.sortie), r.sortie);
});
epreuve('rouge depuis exactement 60 minutes : silence (le seuil est « plus de 60 »)', () => {
  const r = vigie([run('failure', 60)]);
  assert.strictEqual(r.code, 0, r.sortie);
});
epreuve('un run vert plus récent éteint l\'alerte, même si le rouge précédent a plus d\'une heure', () => {
  const r = vigie([run('success', 10, { databaseId: 222 }), run('failure', 300)]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!/::error/.test(r.sortie), r.sortie);
});
epreuve('un run en cours ne lève pas l\'alerte : le dernier verdict connu reste rouge', () => {
  const r = vigie([{ databaseId: 333, status: 'in_progress', conclusion: '', headSha: 'f'.repeat(40), updatedAt: il_y_a(1) }, run('failure', 90)]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(r.sortie.includes('abcdef01'), r.sortie);
});
epreuve('un run annulé n\'est pas un verdict : on lit le run terminé qui le précède', () => {
  assert.strictEqual(vigie([run('cancelled', 5, { databaseId: 444 }), run('success', 200)]).code, 0);
  assert.strictEqual(vigie([run('cancelled', 5, { databaseId: 444 }), run('failure', 200)]).code, 1);
});
epreuve('rouge depuis 3 h et un run rouge il y a 10 min : alerte (le compteur ne repart pas à chaque push)', () => {
  const r = vigie([run('failure', 10, { databaseId: 901, headSha: 'b'.repeat(40) }), run('failure', 60, { databaseId: 902 }), run('failure', 180, { databaseId: 903 }), run('success', 400, { databaseId: 904 })]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(/rouge depuis 180 min/.test(r.sortie), r.sortie);
  assert.ok(r.sortie.includes('abcdef01') && r.sortie.includes('bbbbbbbb'), `premier et dernier commits attendus :\n${r.sortie}`);
  assert.ok(/3 run\(s\) rouge\(s\)/.test(r.sortie), r.sortie);
});
epreuve('vert il y a 5 min après des rouges anciens : silence', () => {
  const r = vigie([run('success', 5, { databaseId: 911 }), run('failure', 120, { databaseId: 912 }), run('failure', 240, { databaseId: 913 })]);
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(!/::error/.test(r.sortie), r.sortie);
});
epreuve('série de rouges de plus de 20 runs : alerte qui mentionne la limite et mesure depuis le plus ancien lu', () => {
  const runs = Array.from({ length: 20 }, (_, i) => run('failure', 10 + i * 30, { databaseId: 1000 + i }));
  const r = vigie(runs);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(/plus longue que les 20 runs lus/.test(r.sortie), r.sortie);
  assert.ok(/au moins 580 min/.test(r.sortie), r.sortie);
  assert.ok(r.sortie.includes('run 1019'), `le plus ancien lu doit être nommé :\n${r.sortie}`);
});
epreuve('une série complète (vert atteint) ne parle pas de limite', () => {
  const r = vigie([run('failure', 61, { databaseId: 921 }), run('success', 300, { databaseId: 922 })]);
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(!/plus longue/.test(r.sortie), r.sortie);
});
epreuve('vert seul, ou aucun run : silence', () => {
  assert.strictEqual(vigie([run('success', 500)]).code, 0);
  assert.strictEqual(vigie([]).code, 0);
});
epreuve('gh en panne : la vigie ne se tait pas, elle alerte qu\'elle est aveugle', () => {
  const r = vigie([run('success', 5)], { panne: true });
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(/::error title=Vigie CI du rail aveugle::/.test(r.sortie), r.sortie);
});
epreuve('lecture seule : seuls `gh run list` et `gh run view` sont appelés', () => {
  const r = vigie([run('failure', 61)]);
  assert.ok(r.appels.length >= 2, `appels : ${r.appels}`);
  for (const a of r.appels) assert.ok(/^run (list|view) /.test(a), `appel non lecture seule : ${a}`);
  assert.ok(r.appels.some(a => a.startsWith('run list ') && a.includes('--branch handoff-continuite-20260920')), `rail non ciblé : ${r.appels}`);
});
epreuve('le workflow ne reçoit que contents: read et actions: read, et lance la vigie du rail', () => {
  const y = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'vigie-cloture.yml'), 'utf8');
  const bloc = /^permissions:\n((?:  .+\n)+)/m.exec(y);
  assert.ok(bloc, 'bloc permissions absent');
  assert.deepStrictEqual(bloc[1].trim().split('\n').map(l => l.trim()).sort(), ['actions: read', 'contents: read']);
  assert.ok(!/:\s*write\b/.test(y), 'aucune permission write');
  assert.ok(/node outils\/vigie-ci-rail\.js/.test(y), 'la vigie CI du rail n\'est pas lancée');
});

// Mutants : le seuil et la lecture du dernier verdict doivent être mordus par les épreuves ci-dessus.
epreuve('mutation : seuil décalé, verdict inversé ou rouge ignoré font rougir les épreuves', () => {
  const src = fs.readFileSync(OUTIL, 'utf8');
  const mutants = {
    'seuil >= au lieu de >': ['if (!(minutes > SEUIL_MIN))', 'if (!(minutes >= SEUIL_MIN))'],
    'seuil à 59 minutes': ["|| 60);", "|| 59);"],
    'seuil à 62 minutes': ["|| 60);", "|| 62);"],
    'un rouge ancien alerte même après un vert': ["if (r.conclusion === 'success') { vert = r; break; }", "if (false) { vert = r; break; }"],
    'retour au « dernier run » : le compteur repart à chaque push': ["new Date(premier.createdAt)", "new Date(dernier.createdAt)"],
    'la limite des 20 runs n\'est plus dite': ["const tronquee = !vert && runs.length >= LIMITE;", "const tronquee = false;"],
    'le rouge ne nomme plus le commit': ["premier.headSha.slice(0, 8)} (run", "'?'} (run"],
  };
  for (const [nom, [de, vers]] of Object.entries(mutants)) {
    assert.strictEqual(src.split(de).length - 1, 1, `ancre du mutant « ${nom} » absente ou non unique`);
    const f = path.join(tmp, `mut-${Object.keys(mutants).indexOf(nom)}.js`);
    fs.writeFileSync(f, src.replace(de, () => vers));
    const cas = [
      () => { const r = vigie([run('failure', 61)], { outil: f }); assert.strictEqual(r.code, 1); assert.ok(r.sortie.includes('premier rouge sur abcdef01')); },
      () => assert.strictEqual(vigie([run('failure', 59)], { outil: f }).code, 0),
      () => assert.strictEqual(vigie([run('failure', 60)], { outil: f }).code, 0),
      () => assert.strictEqual(vigie([run('success', 10, { databaseId: 222 }), run('failure', 300)], { outil: f }).code, 0),
      () => assert.strictEqual(vigie([run('failure', 10), run('failure', 180)], { outil: f }).code, 1),
      () => assert.ok(/plus longue que les 20 runs lus/.test(vigie(Array.from({ length: 20 }, (_, i) => run('failure', 10 + i * 30)), { outil: f }).sortie)),
    ];
    const mordu = cas.some(c => { try { c(); return false; } catch (e) { return true; } });
    assert.ok(mordu, `le mutant « ${nom} » n'est pas détecté`);
  }
});

console.log(`\n${total - echecs}/${total} scénarios`);
process.exit(echecs ? 1 : 0);
