#!/usr/bin/env node
'use strict';
// Épreuves de P3 (decision-2, lot NEXUS-REPARATION-HANDOFF-1) : classer un
// arrêt, signaler l'orpheline, sans jamais bloquer ni relancer.
const assert = require('assert');
const fs = require('fs');
const W = require('./outils/watchdog-stagnation.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };

const T = Date.parse('2026-10-14T16:00:00Z');
const ilYA = (min) => new Date(T - min * 60000).toISOString();
const arret = (sur) => Object.assign({
  code: 'CONDITIONS_NON_PROUVEES', maintenant: new Date(T).toISOString(), derniereActivite: ilYA(48),
  lot: 'NEXUS-REPARATION-HANDOFF-1-20261014', sha: 'a'.repeat(40), branche: 'handoff-continuite-20260920',
}, sur || {});

ep('cas réel du 14/10 : CONDITIONS_NON_PROUVEES à 48 min = oubli de format, orpheline', () => {
  const c = W.classerArret(arret());
  assert.strictEqual(c.famille, 'OUBLI_DE_FORMAT');
  assert.strictEqual(c.orpheline, true);
  assert.strictEqual(c.justifie, false);
});

ep('seuil provisoire de 30 min : 29 non, 30 oui', () => {
  assert.strictEqual(W.SEUIL_ORPHELINE_MINUTES, 30);
  assert.strictEqual(W.classerArret(arret({ derniereActivite: ilYA(29) })).orpheline, false);
  assert.strictEqual(W.classerArret(arret({ derniereActivite: ilYA(30) })).orpheline, true);
});

ep('une décision humaine n\'est jamais orpheline, même après des jours', () => {
  for (const code of W.FAMILLES.DECISION_HUMAINE) {
    const c = W.classerArret(arret({ code, derniereActivite: ilYA(60 * 24 * 5) }));
    assert.strictEqual(c.humain, true, code);
    assert.strictEqual(c.orpheline, false, code);
    assert.strictEqual(c.relance_permise, false, code);
  }
});

ep('code inconnu ou absent : famille INCONNU, jamais classé humain', () => {
  assert.strictEqual(W.classerArret(arret({ code: 'XYZ' })).famille, 'INCONNU');
  const c = W.classerArret(arret({ code: '' }));
  assert.strictEqual(c.famille, 'INCONNU');
  assert.strictEqual(c.humain, false);
});

ep('horloge ou activité illisible : on ne conclut pas à l\'orpheline', () => {
  assert.strictEqual(W.classerArret(arret({ derniereActivite: 'pas une date' })).orpheline, false);
  assert.strictEqual(W.classerArret(arret({ maintenant: undefined })).minutes, null);
});

ep('aucune relance sur une action sensible', () => {
  for (const capacite of ['PRODUCTION_WRITE', 'SECRET_ACCESS', 'MIGRATION_APPLY', 'DEPLOIEMENT', 'FUSION_MAIN']) {
    assert.strictEqual(W.classerArret(arret({ capacite })).relance_permise, false, capacite);
  }
  assert.strictEqual(W.classerArret(arret({ capacite: 'READ_ONLY_REPO' })).relance_permise, true);
});

ep('chaque code listé appartient à une seule famille', () => {
  const vus = new Map();
  for (const [f, codes] of Object.entries(W.FAMILLES)) for (const c of codes) {
    assert.ok(!vus.has(c), `${c} dans ${vus.get(c)} et ${f}`); vus.set(c, f);
  }
});

ep('P6 : le signalement est un état vert (NO_WORK), jamais un arrêt', () => {
  const { ETATS_QUI_ARRETENT } = require('./outils/etat-maillon.js');
  for (const code of ['CONDITIONS_NON_PROUVEES', 'CANAL_INCAPABLE', 'DECISION_RESERVEE_A_UN_HUMAIN', 'XYZ']) {
    const r = W.signaler(arret({ code }));
    assert.ok(!ETATS_QUI_ARRETENT.includes(r.etat), `${code} → ${r.etat}`);
  }
  assert.strictEqual(W.signaler(arret()).code, 'ORPHELINE_SIGNALEE');
  assert.strictEqual(W.signaler(arret({ derniereActivite: ilYA(5) })).code, 'ARRET_RECENT');
  assert.strictEqual(W.signaler(arret({ code: 'STOP_ARBITRE' })).code, 'ARRET_HUMAIN_ATTENDU');
});

ep('le signalement laisse une trace lisible dans la condition', () => {
  const r = W.signaler(arret());
  assert.ok(/famille=OUBLI_DE_FORMAT/.test(r.condition) && /orpheline=true/.test(r.condition) && /minutes=48/.test(r.condition));
});

ep('la source reste sans effet de bord (pas de shell, pas de réseau, pas d\'écriture)', () => {
  const src = fs.readFileSync(require.resolve('./outils/watchdog-stagnation.js'), 'utf8');
  for (const m of [/child_process/, /execSync|spawnSync|execFileSync/, /\bgh (api|issue|run)/, /writeFileSync|appendFileSync/, /fetch\(|https?\.request/]) {
    assert.ok(!m.test(src), `motif interdit : ${m}`);
  }
});

console.log(`\nWatchdog P3 (orphelines) — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
