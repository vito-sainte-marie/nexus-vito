#!/usr/bin/env node
'use strict';
// Épreuves — la capacité n'est pas l'autorisation.
const assert = require('assert');
const { decider, DESTINATIONS_A_GATE_HUMAINE } = require('./outils/transport-autorise.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };

const MISSION = { autorites: ['handoff-continuite-20260920'] };

ep('une destination nommément désignée par la mission est autorisée', () => {
  const d = decider({ destination: 'handoff-continuite-20260920', mission: MISSION });
  assert.strictEqual(d.transport, true, 'une destination déclarée doit passer');
  assert.strictEqual(d.code, 'AUTORISE');
});

ep('une destination absente de l’autorité de la mission est refusée', () => {
  const d = decider({ destination: 'rebuild/carburants-65-20260922', mission: MISSION });
  assert.strictEqual(d.transport, false);
  assert.strictEqual(d.code, 'DESTINATION_NON_AUTORISEE');
  assert.ok(/ne figure pas dans l’autorité/.test(d.motif), 'le refus doit dire POURQUOI');
});

ep('LA CAPACITÉ N’EST PAS L’AUTORISATION — contents:write ne change rien', () => {
  const sans = decider({ destination: 'rebuild/carburants-65-20260922', mission: MISSION });
  const avec = decider({ destination: 'rebuild/carburants-65-20260922', mission: MISSION,
    capacites: { contents: 'write', 'pull-requests': 'write' } });
  assert.deepStrictEqual(avec, sans,
    'prouver qu’on PEUT écrire ne doit pas modifier la décision de savoir si on en a le DROIT');
  assert.strictEqual(avec.transport, false);
});

ep('une mission qui ne désigne aucune destination n’en autorise AUCUNE', () => {
  for (const m of [undefined, {}, { autorites: [] }, { autorites: null }]) {
    const d = decider({ destination: 'handoff-continuite-20260920', mission: m });
    assert.strictEqual(d.transport, false, 'l’absence de désignation ne vaut pas « toutes »');
    assert.strictEqual(d.code, 'MISSION_SANS_AUTORITE');
  }
});

ep('`main` et `production` restent des gates humaines, MÊME déclarées', () => {
  for (const dest of DESTINATIONS_A_GATE_HUMAINE) {
    const d = decider({ destination: dest, mission: { autorites: [dest, 'autre'] } });
    assert.strictEqual(d.transport, false, `${dest} ne doit jamais s’ouvrir automatiquement`);
    assert.strictEqual(d.code, 'GATE_HUMAINE');
  }
});

ep('la désignation est EXACTE, jamais par préfixe', () => {
  const d = decider({ destination: 'handoff-continuite-20260920-bis', mission: MISSION });
  assert.strictEqual(d.transport, false,
    'une branche dont le nom commence pareil est une AUTRE branche');
});

ep('une destination vide ne se devine pas', () => {
  for (const dest of [undefined, '', '   ']) {
    const d = decider({ destination: dest, mission: MISSION });
    assert.strictEqual(d.code, 'DESTINATION_ABSENTE');
  }
});

ep('l’outil rend une décision et n’ouvre RIEN', () => {
  const src = require('fs').readFileSync('./outils/transport-autorise.js', 'utf8');
  for (const interdit of ['gh pr create', 'pulls', 'git push', 'execSync', 'spawnSync']) {
    assert.ok(!src.includes(interdit),
      `cet outil décide, il n’agit pas : « ${interdit} » n’a rien à y faire`);
  }
});

console.log(echecs.length
  ? `ROUGE — ${echecs.length} échec(s) sur ${passees + echecs.length}\n  · ${echecs.join('\n  · ')}`
  : `VERT — ${passees}/${passees} : pouvoir écrire n’est pas être autorisé à transporter.`);
process.exit(echecs.length ? 1 : 0);
