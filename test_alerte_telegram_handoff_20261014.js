#!/usr/bin/env node
'use strict';
// Épreuves de l'étape « Alerte Telegram — arrêt Handoff » (tests.yml).
// Elle exécute le VRAI script de l'étape avec un faux `curl`, et vérifie :
//   - un message par cas d'arrêt (relais, matérialisation, palier humain, boucle) ;
//   - aucun secret dans le message ;
//   - aucun envoi quand les secrets manquent ;
//   - la condition `if:` nomme les cinq sources d'arrêt, et le palier de
//     matérialisation publie bien sa sortie `alerte_humaine`.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC = fs.readFileSync(path.join(__dirname, '.github/workflows/tests.yml'), 'utf8');
let passees = 0; const echecs = [];
const ep = (t, f) => { try { f(); passees++; } catch (e) { echecs.push(`${t} — ${e.message}`); } };

const i = SRC.indexOf('- name: Alerte Telegram — arrêt Handoff');
assert(i > 0, 'étape Alerte Telegram introuvable');
const bloc = SRC.slice(i, SRC.indexOf('\n      # ADR-0001', i));
const script = bloc.split('        run: |\n')[1].split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
const SI = (bloc.match(/if: \$\{\{ (.*) \}\}/) || [])[1] || '';

function lancer(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
  try {
    fs.mkdirSync(path.join(dir, 'bin'));
    const trace = path.join(dir, 'trace');
    fs.writeFileSync(path.join(dir, 'bin', 'curl'), `#!/bin/bash\nprintf '%s\\n' "$@" >> ${trace}\n`, { mode: 0o755 });
    const r = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: Object.assign({ PATH: `${dir}/bin:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '42',
        TELEGRAM_BOT_TOKEN: 'SECRET-TOKEN', TELEGRAM_CHAT_ID: 'SECRET-CHAT', RELAIS: 'success', MATERIALISATION: 'success', BOUCLE: 'success', PALIER: '', MOTIF: '', LOT: 'LOT-X' }, env),
    });
    return { code: r.status, out: fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8') : '' };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const msg = r => { const l = r.out.split('\n'); const a = l.findIndex(x => x.startsWith('text=')); const b = l.findIndex(x => x.startsWith('https://')); return a < 0 ? '' : l.slice(a, b < 0 ? undefined : b).join('\n'); };

ep('relais en échec -> alerte « relais »', () => {
  const r = lancer({ RELAIS: 'failure' }); assert.strictEqual(r.code, 0); assert(/relais vers l'arbitre/.test(msg(r)), msg(r));
});
ep('matérialisation en échec -> alerte « matérialisation »', () => {
  assert(/matérialisation/.test(msg(lancer({ MATERIALISATION: 'failure' }))));
});
ep('palier humain à la matérialisation -> alerte « réservée à un humain »', () => {
  const m = msg(lancer({ PALIER: '1' })); assert(/réservée à un humain/.test(m), m); assert(/LOT-X/.test(m));
});
ep('boucle en échec -> alerte « boucle »', () => {
  assert(/boucle autonome/.test(msg(lancer({ BOUCLE: 'failure' }))));
});
ep('arrêt humain de la boucle -> alerte avec le motif', () => {
  assert(/BLOQUE/.test(msg(lancer({ MOTIF: 'BLOQUE' }))));
});
ep('une seule requête par exécution', () => {
  const r = lancer({ RELAIS: 'failure', MATERIALISATION: 'failure', PALIER: '1' });
  assert.strictEqual(r.out.split('\n').filter(l => l.startsWith('https://api.telegram.org')).length, 1);
});
ep('aucun secret dans le message', () => {
  const m = msg(lancer({ RELAIS: 'failure' })); assert(!/SECRET/.test(m), m);
});
ep('secrets absents -> aucun envoi, sortie 0', () => {
  const r = lancer({ TELEGRAM_BOT_TOKEN: '', RELAIS: 'failure' }); assert.strictEqual(r.code, 0); assert.strictEqual(r.out, '');
});
ep('la condition nomme les cinq sources d\'arrêt', () => {
  for (const k of ['relais_arbitre.outcome', 'materialisation.outcome', 'materialisation.outputs.alerte_humaine', 'boucle_autonome.outcome', 'boucle_autonome.outputs.alerte_humaine'])
    assert(SI.includes(k), `condition sans ${k}`);
});
ep('le palier de matérialisation publie alerte_humaine', () => {
  const p = SRC.slice(SRC.indexOf('palier() {'), SRC.indexOf('A_LA_MAIN="matérialiser'));
  assert(/alerte_humaine=1/.test(p) && /GITHUB_OUTPUT/.test(p), 'palier() ne publie pas la sortie');
});
ep('l\'aperçu de lien est désactivé', () => {
  const r = lancer({ RELAIS: 'failure' });
  assert(/disable_web_page_preview=true/.test(r.out), 'requête sans disable_web_page_preview=true');
});

console.log(`${passees} vérifications passées.`);
if (echecs.length) { for (const e of echecs) console.log(`FAIL — ${e}`); process.exit(1); }
