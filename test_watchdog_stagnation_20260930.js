#!/usr/bin/env node
'use strict';
// Épreuves du watchdog de stagnation.
//
// CE QUI EST MESURÉ ICI. Trois choses que la chaîne ne savait pas faire :
// distinguer le repos de l'arrêt, refuser de réveiller deux fois pour la même
// chose, et voir qu'elle tourne sur place. Les trois sont dans la liste des
// mutations obligatoires ; les épreuves ci-dessous sont ce que ces mutations
// doivent rendre rouge.

const assert = require('assert');
const W = require('./outils/watchdog-stagnation.js');
const { CHAMPS_EXIGES, ETATS_QUI_ARRETENT } = require('./outils/etat-maillon.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };

const LOT = 'NEXUS-CONTINUITE-TERRAIN-2-20260922';
const RAIL = 'handoff-continuite-20260920';
const SHA = '61562d88' + '0'.repeat(32);
const T = Date.parse('2026-09-30T18:00:00Z');
const ilYA = (min) => new Date(T - min * 60000).toISOString();

function ctx(sur) {
  return Object.assign({
    lot: LOT, branche: RAIL, sha: SHA, demande: 'request-18.md',
    position: 'CI_VERTE', decision: 'qualifie',
    maintenant: new Date(T).toISOString(), derniereActivite: ilYA(5),
    reprises: 0, historique: [], reveilsPublies: [],
  }, sur || {});
}

// ── LE REPOS ET L'ARRÊT NE SE RESSEMBLENT PLUS ───────────────────────────────

ep('aucune demande en vol : repos, et pas une erreur CI', () => {
  const r = W.examiner(ctx({ position: 'AUCUNE_DEMANDE' }));
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.code, 'REPOS');
});

ep('un lot clos est au repos', () => {
  assert.strictEqual(W.examiner(ctx({ position: 'LOT_CLOS' })).etat, 'NO_WORK');
});

ep('travail en attente et délai non écoulé : en cours, vert', () => {
  const r = W.examiner(ctx({ position: 'REVEIL_PUBLIE', derniereActivite: ilYA(10) }));
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.code, 'EN_COURS');
});

ep('MUTATION — délai dépassé : la chaîne est arrêtée, et le dit', () => {
  const r = W.examiner(ctx({ position: 'REVEIL_PUBLIE', derniereActivite: ilYA(200) }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'STAGNATION');
  assert.match(r.condition, /200 min/);
});

ep('MUTATION — branche Claude verte mais jamais rapatriée', () => {
  const r = W.examiner(ctx({ position: 'CI_VERTE', derniereActivite: ilYA(120) }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'RESULTAT_NON_RAPATRIE');
  assert.match(r.prochaine_action, /rapatrier/);
});

ep('le cas nommé porte un code distinct de la stagnation générique', () => {
  const vert = W.examiner(ctx({ position: 'CI_VERTE', derniereActivite: ilYA(120) }));
  const rouge = W.examiner(ctx({ position: 'CI_ROUGE', derniereActivite: ilYA(120) }));
  assert.notStrictEqual(vert.code, rouge.code);
});

// ── LA DÉDUPLICATION DES RÉVEILS ─────────────────────────────────────────────

ep('MUTATION — réveil dupliqué : on ne réveille pas deux fois', () => {
  const c = ctx({ position: 'REVEIL_PUBLIE', derniereActivite: ilYA(5) });
  const signature = [c.lot, c.demande, c.position, c.sha].join('|');
  const r = W.examiner(Object.assign({}, c, { reveilsPublies: [signature] }));
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.code, 'REVEIL_DEJA_PUBLIE');
});

ep('un réveil pour un autre SHA n’est pas un doublon', () => {
  const c = ctx({ position: 'REVEIL_PUBLIE', derniereActivite: ilYA(5) });
  const autre = [c.lot, c.demande, c.position, 'a'.repeat(40)].join('|');
  assert.strictEqual(W.examiner(Object.assign({}, c, { reveilsPublies: [autre] })).code, 'EN_COURS');
});

ep('un réveil déjà publié n’excuse plus le silence une fois le délai passé', () => {
  const c = ctx({ position: 'REVEIL_PUBLIE', derniereActivite: ilYA(300) });
  const signature = [c.lot, c.demande, c.position, c.sha].join('|');
  const r = W.examiner(Object.assign({}, c, { reveilsPublies: [signature] }));
  assert.strictEqual(r.etat, 'BLOCKED');
});

// ── TOURNER N'EST PAS AVANCER ────────────────────────────────────────────────

ep('MUTATION — absence de progression : deux cycles de même empreinte', () => {
  const c = ctx({ position: 'CI_ROUGE', decision: 'reprise', derniereActivite: ilYA(1) });
  const r = W.examiner(Object.assign({}, c, {
    historique: [{ position: 'CI_ROUGE', sha: SHA, decision: 'reprise' }],
  }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'AUCUNE_PROGRESSION');
});

ep('un SHA qui bouge est une progression, même au même poste', () => {
  const c = ctx({ position: 'CI_ROUGE', decision: 'reprise', derniereActivite: ilYA(1) });
  const r = W.examiner(Object.assign({}, c, {
    historique: [{ position: 'CI_ROUGE', sha: 'b'.repeat(40), decision: 'reprise' }],
  }));
  assert.strictEqual(r.etat, 'NO_WORK');
});

ep('une décision qui change est une progression, à SHA constant', () => {
  const c = ctx({ position: 'CI_ROUGE', decision: 'corrige', derniereActivite: ilYA(1) });
  const r = W.examiner(Object.assign({}, c, {
    historique: [{ position: 'CI_ROUGE', sha: SHA, decision: 'reprise' }],
  }));
  assert.strictEqual(r.etat, 'NO_WORK');
});

ep('L’EMPREINTE EST AVEUGLE AU NUMÉRO DE RUN', () => {
  // Le cœur du §6 : un run neuf ne vaut pas progression.
  const a = W.empreinte({ position: 'CI_ROUGE', sha: SHA, decision: 'reprise', run: 36757764844 });
  const b = W.empreinte({ position: 'CI_ROUGE', sha: SHA, decision: 'reprise', run: 99999999999, date: 'demain' });
  assert.strictEqual(a, b);
});

// ── LA BORNE DE REPRISES ─────────────────────────────────────────────────────

ep('les reprises sont bornées, et la borne rend la main à Frédéric', () => {
  const r = W.examiner(ctx({ position: 'CI_ROUGE', reprises: W.MAX_REPRISES }));
  assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED');
  assert.strictEqual(r.code, 'REPRISES_EPUISEES');
});

ep('sous la borne, la reprise reste possible', () => {
  const r = W.examiner(ctx({ position: 'CI_ROUGE', reprises: W.MAX_REPRISES - 1, derniereActivite: ilYA(1) }));
  assert.strictEqual(r.etat, 'NO_WORK');
});

ep('la borne est bien une borne : aucune position ne la contourne', () => {
  for (const p of Object.keys(W.CONTINUATION)) {
    const r = W.examiner(ctx({ position: p, reprises: 99 }));
    assert.strictEqual(r.etat, 'HUMAN_DECISION_REQUIRED', `position ${p}`);
  }
});

// ── L'HORLOGE ────────────────────────────────────────────────────────────────

ep('sans date d’activité, on refuse de mesurer plutôt que d’inventer', () => {
  const r = W.examiner(ctx({ derniereActivite: null }));
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'ACTIVITE_NON_DATEE');
});

ep('une date illisible n’est pas traitée comme zéro', () => {
  assert.strictEqual(W.examiner(ctx({ derniereActivite: 'hier soir' })).code, 'ACTIVITE_NON_DATEE');
});

ep('une activité dans le futur est une horloge incohérente, pas une stagnation', () => {
  const r = W.examiner(ctx({ derniereActivite: new Date(T + 3600000).toISOString() }));
  assert.strictEqual(r.code, 'HORLOGE_INCOHERENTE');
});

ep('une dérive d’horloge de quelques secondes ne déclenche rien', () => {
  const r = W.examiner(ctx({ position: 'REVEIL_PUBLIE', derniereActivite: new Date(T + 30000).toISOString() }));
  assert.strictEqual(r.etat, 'NO_WORK');
});

// ── LA POSITION SE DÉCLARE ───────────────────────────────────────────────────

ep('une position absente est refusée, pas devinée', () => {
  assert.strictEqual(W.examiner(ctx({ position: null })).code, 'POSITION_NON_DECLAREE');
});

ep('une position hors liste fermée est refusée', () => {
  assert.strictEqual(W.examiner(ctx({ position: 'PRESQUE_FINI' })).code, 'POSITION_INCONNUE');
});

// ── LE WATCHDOG NE BOUCLE PAS ────────────────────────────────────────────────

ep('LE WATCHDOG NE RÉVEILLE RIEN LUI-MÊME', () => {
  // Un watchdog qui agit est un watchdog qui peut boucler.
  const src = require('fs').readFileSync('outils/watchdog-stagnation.js', 'utf8');
  for (const interdit of ['child_process', 'execSync', 'spawnSync', 'gh api', 'gh issue',
                          'git push', 'setInterval', 'setTimeout', 'process.exit']) {
    assert.ok(!src.includes(interdit), `le watchdog ne doit pas contenir « ${interdit} »`);
  }
});

ep('aucun arrêt ne peut être muet', () => {
  const scenarios = [
    ctx({ position: null }), ctx({ position: 'PRESQUE_FINI' }),
    ctx({ position: 'CI_VERTE', derniereActivite: ilYA(120) }),
    ctx({ position: 'CI_ROUGE', reprises: 99 }),
    ctx({ derniereActivite: null }),
    Object.assign(ctx({ position: 'CI_ROUGE', decision: 'reprise', derniereActivite: ilYA(1) }),
      { historique: [{ position: 'CI_ROUGE', sha: SHA, decision: 'reprise' }] }),
  ];
  for (const s of scenarios) {
    const r = W.examiner(s);
    assert.ok(ETATS_QUI_ARRETENT.includes(r.etat), `attendu un arrêt, obtenu ${r.etat}`);
    for (const champ of CHAMPS_EXIGES) {
      assert.ok(r[champ] && String(r[champ]).trim(), `${r.code} : champ ${champ} vide`);
    }
  }
});

ep('chaque position de continuation nomme la suite attendue', () => {
  for (const [p, d] of Object.entries(W.CONTINUATION)) {
    assert.ok(d.suite && d.suite.trim(), `${p} sans suite déclarée`);
    assert.ok(Number.isFinite(d.minutes) && d.minutes > 0, `${p} sans délai`);
  }
});

ep('terminaux et continuations ne se recouvrent pas', () => {
  const chevauche = Object.keys(W.TERMINAUX).filter(k => k in W.CONTINUATION);
  assert.deepStrictEqual(chevauche, []);
});

console.log(`\nWatchdog de stagnation — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
