'use strict';
// ════════════════════════════════════════════════════════════════════════════
// LE CÂBLAGE CI DE L'ENREGISTREMENT DES INCIDENTS (lot NEXUS-INCIDENTS-CI-1, item 1)
//
// `enregistrer-incident.js` a son banc : il prouve que l'outil SAIT enregistrer.
// Il ne prouve pas que le job qui l'appelle respecte les conditions de
// decision-1 : lease, concurrence dédiée, idempotence, absence de récursion,
// aucune permission nouvelle, arrêts de sécurité préservés.
//
// Ce banc mesure ces six conditions de deux façons :
//   - structure du job, lue dans tests.yml, avec des mutations ISOLÉES (une
//     clause à la fois) qui doivent chacune faire rougir la lecture ;
//   - exécution RÉELLE du corps du job sous bash, sur un dépôt git jetable
//     (origin nu + clones, hors de ce dépôt) : enregistrement, rejeu à zéro
//     octet, lease violée par une course.
// ════════════════════════════════════════════════════════════════════════════
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RACINE = __dirname;
const WF = fs.readFileSync(path.join(RACINE, '.github/workflows/tests.yml'), 'utf8');
const SHA = 'a'.repeat(40);
let ok = 0;
const t = (nom, f) => { try { f(); ok++; } catch (e) { console.error('  ÉCHEC — ' + nom + '\n    ' + e.message); process.exitCode = 1; } };

// Le texte du job, de son en-tête de deux espaces jusqu'à la fin du fichier.
const job = (txt) => { const i = txt.indexOf('\n  enregistrement-incident:\n'); return i < 0 ? '' : txt.slice(i); };
// Le corps `run: |` de son étape, dédenté.
function corps(txt) {
  const j = job(txt); const i = j.indexOf('        run: |\n'); if (i < 0) return '';
  return j.slice(i + '        run: |\n'.length).split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
}
// Toutes les conditions de decision-1, lues sur le texte. Rend les défauts.
function defauts(txt) {
  const d = [], j = job(txt), c = corps(txt);
  if (!j) return ['job absent'];
  if (!/^ {4}needs: non-regression$/m.test(j)) d.push('needs');
  if (!/startsWith\(needs\.non-regression\.outputs\.incident_rail, 'handoff-'\)/.test(j)) d.push('rail handoff-* seulement');
  if (!/group: nexus-incidents-enregistrement-\$\{\{ github\.ref \}\}/.test(j)) d.push('groupe de concurrence dédié');
  if (!/cancel-in-progress: false/.test(j)) d.push('cancel-in-progress false');
  if (!/^ {6}- uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n {8}with:\n {10}ref: \$\{\{ needs\.non-regression\.outputs\.incident_rail \}\}/m.test(j)) d.push('lease : checkout de la tête du rail');
  if (/^ {4}permissions:/m.test(j)) d.push('permissions de job');
  if (/--force|--force-with-lease|\s-f\s|\+HEAD/.test(c)) d.push('push forcé');
  if (!/git push origin "HEAD:refs\/heads\/\$RAIL"/.test(c)) d.push('push du rail');
  if (/\bgh\b|GH_TOKEN|repository_dispatch|workflow_dispatch|dispatches/.test(j.replace(/^ *#.*$/gm, ''))) d.push('récursion/relance');
  if (!/\$ETAT" = "ENREGISTRE"/.test(c)) d.push('commit seulement sur ENREGISTRE');
  if (/while |until |for .* in .*; do/.test(c)) d.push('nouvelle tentative');
  return d;
}

t('le job respecte les six conditions de decision-1', () => assert.deepStrictEqual(defauts(WF), []));

t('le bloc permissions du workflow n\'a pas bougé', () => {
  const m = WF.match(/^permissions:\n((?:  .*\n)+)/m);
  assert.strictEqual(m[1], '  contents: write\n  actions: read\n  issues: write\n');
});

t('l\'étape boucle_autonome publie les sorties lues par le job, sur la seule branche « notifier »', () => {
  const i = WF.indexOf('elif [ "$notifier" = true ]; then');
  const bloc = WF.slice(i, WF.indexOf('else', i));
  for (const k of ['incident_a_enregistrer=1', 'lot=$LOT', 'rail=$RAIL', 'sha=$SHA_RAIL', 'motif=$verdict']) assert.ok(bloc.includes(k), k);
  assert.strictEqual((WF.match(/incident_a_enregistrer=1/g) || []).length, 1);
});

// Chaque mutation touche UNE clause ; la lecture doit la voir.
const MUTATIONS = [
  ['push forcé', t0 => t0.replace('git push origin "HEAD', 'git push --force origin "HEAD')],
  ['permissions de job', t0 => t0.replace('    timeout-minutes: 5\n    concurrency:', '    timeout-minutes: 5\n    permissions:\n      contents: write\n    concurrency:')],
  ['cancel-in-progress false', t0 => t0.replace('cancel-in-progress: false\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4\n        with:\n          ref: ${{ needs.non-regression.outputs.incident_rail', 'cancel-in-progress: true\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4\n        with:\n          ref: ${{ needs.non-regression.outputs.incident_rail')],
  ['récursion/relance', t0 => t0.replace('          git config user.name "nexus-incidents"', '          gh api -X POST repos/x/dispatches\n          git config user.name "nexus-incidents"')],
  ['lease : checkout de la tête du rail', t0 => t0.replace('ref: ${{ needs.non-regression.outputs.incident_rail }}\n      - name: Enregistrer', 'ref: ${{ github.sha }}\n      - name: Enregistrer')],
  ['rail handoff-* seulement', t0 => t0.replace("startsWith(needs.non-regression.outputs.incident_rail, 'handoff-') }}", "true }}")],
  ['commit seulement sur ENREGISTRE', t0 => t0.replace('[ "$ETAT" = "ENREGISTRE" ]', '[ -n "$ETAT" ]')],
];
for (const [attendu, mut] of MUTATIONS) t('mutation isolée « ' + attendu + ' » → la lecture rougit', () => {
  const m = mut(WF); assert.notStrictEqual(m, WF, 'mutation sans effet');
  assert.ok(defauts(m).includes(attendu), JSON.stringify(defauts(m)));
});

// ── Exécution réelle du corps du job sur un dépôt jetable ──────────────────
const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function monde() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'inc-ci-'));
  const origin = path.join(base, 'origin.git'), graine = path.join(base, 'graine');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'handoff-x', origin]);
  fs.mkdirSync(graine);
  sh(graine, 'init', '-q', '-b', 'handoff-x');
  sh(graine, 'config', 'user.name', 't'); sh(graine, 'config', 'user.email', 't@t');
  fs.cpSync(path.join(RACINE, 'outils'), path.join(graine, 'outils'), { recursive: true, filter: s => !/\.mut-/.test(s) });
  fs.mkdirSync(path.join(graine, 'docs/learning'), { recursive: true });
  fs.writeFileSync(path.join(graine, 'docs/learning/INCIDENTS.jsonl'), '');
  sh(graine, 'add', '-A'); sh(graine, 'commit', '-q', '-m', 'graine'); sh(graine, 'remote', 'add', 'origin', origin); sh(graine, 'push', '-q', 'origin', 'handoff-x');
  const clone = (n) => { const d = path.join(base, n); sh(base, 'clone', '-q', '-b', 'handoff-x', origin, n); return d; };
  return { base, origin, clone };
}
function jouer(dir, code) {
  const f = path.join(dir, '.corps.sh'); fs.writeFileSync(f, corps(WF));
  return spawnSync('bash', ['-e', f], { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env,
    { CODE: code, LOT: 'LOT-TEST-1', RAIL: 'handoff-x', SHA_RAIL: SHA, GITHUB_RUN_ID: '42' }) });
}
const jq = spawnSync('jq', ['--version']).status === 0;

if (jq) {
  t('exécution réelle : un arrêt non humain est enregistré et poussé sans force ; le rejeu ne change pas un octet', () => {
    const w = monde(), c1 = w.clone('c1'); sh(c1, 'config', 'user.name', 't');
    let r = jouer(c1, 'CI_ROUGE'); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    const tete = sh(w.origin, 'rev-parse', 'handoff-x');
    assert.ok(/"code":"CI_ROUGE"/.test(sh(w.origin, 'show', 'handoff-x:docs/learning/INCIDENTS.jsonl')));
    const c2 = w.clone('c2'); r = jouer(c2, 'CI_ROUGE'); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.ok(r.stdout.includes('DEJA_ENREGISTRE'));
    assert.strictEqual(sh(w.origin, 'rev-parse', 'handoff-x'), tete, 'le rejeu a poussé');
  });
  t('exécution réelle : un arrêt humain voulu (STOP_HUMAIN, plafond) n\'est jamais enregistré', () => {
    const w = monde();
    for (const code of ['STOP_HUMAIN', 'VERDICT_REPETE', 'PLAFOND_LOT_ATTEINT', 'PLAFOND_JOUR_ATTEINT', 'BLOQUE', 'CANAL_NON_DECLENCHABLE']) {
      const c = w.clone('c-' + code), avant = sh(w.origin, 'rev-parse', 'handoff-x');
      const r = jouer(c, code); assert.strictEqual(r.status, 0, code + r.stdout + r.stderr);
      assert.ok(r.stdout.includes('NON_ENREGISTRE'), code + ' : ' + r.stdout);
      assert.strictEqual(sh(w.origin, 'rev-parse', 'handoff-x'), avant, code + ' a poussé');
    }
  });
  t('exécution réelle : lease violée (le rail a avancé) → push refusé, échec franc, rien forcé', () => {
    const w = monde(), c1 = w.clone('c1'), c2 = w.clone('c2');
    // c1 prépare, mais c2 avance le rail avant le push de c1 : on simule en poussant d'abord depuis c2.
    sh(c2, 'config', 'user.name', 't'); sh(c2, 'config', 'user.email', 't@t');
    fs.writeFileSync(path.join(c2, 'autre.txt'), 'x'); sh(c2, 'add', '-A'); sh(c2, 'commit', '-q', '-m', 'avance'); sh(c2, 'push', '-q', 'origin', 'handoff-x');
    const avance = sh(w.origin, 'rev-parse', 'handoff-x');
    const r = jouer(c1, 'CI_ROUGE'); assert.notStrictEqual(r.status, 0, 'devait échouer');
    assert.strictEqual(sh(w.origin, 'rev-parse', 'handoff-x'), avance, 'le rail avancé a été écrasé');
  });
} else console.log('  (jq absent : les épreuves d\'exécution sont sautées)');

console.log(`\nCâblage des incidents CI — ${ok} épreuve(s) passée(s), ${process.exitCode ? 'au moins un échec' : '0 échec(s)'}.`);
