'use strict';

/**
 * ÉPREUVE — LE RUN QUI CONSOMME SA DÉCISION DOIT RETROUVER SON LOT.
 *
 * Mesuré le 07/10/2026, run 37680418292 : claude/issue-28-20261007-2008
 * (cd89ed1) consommait decision-6 de GOUVERNANCE-REFERENCE-CODE-20261005, en
 * avance rapide sur le rail, CI verte — et le rapatriement armé concluait
 * `LOT_NON_RATTACHABLE — Aucun lot déclaré`, parce que le réveil lit le
 * registre de la branche, où le lot venait d'être fermé. Avertissement, étape
 * verte, travail resté sur la branche de run : « elle propose d'ouvrir une
 * PR ». Le même défaut à chaque lot fermé par un run.
 *
 * Ce fichier exige que le lot soit relu dans le registre du RAIL, et que rien
 * d'autre ne soit relâché : un homonyme, un lot clos, deux lots touchés
 * continuent de refuser, sans push. La section M débranche l'aide dans une
 * copie du module : l'épreuve principale doit alors rougir, sinon elle ne
 * prouve pas le câblage.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const SOURCE = path.join(__dirname, 'outils', 'rapatrier-vers-rail.js');

let reussites = 0; const echecs = [];
function verifier(nom, f) {
  try { f(); reussites += 1; console.log(`   ✓ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`   ✗ ${nom}\n     ${e.message}`); }
}

const RAIL = 'handoff-continuite-20260920';
const BRANCHE = 'claude/issue-28-20261007-2008';
const HEAD = 'cd89ed10f82e8dc086ca333f72426ddb3bd72c11';
const RAIL_SHA = '81ac1363c8d3fbcac545e9edb9986c9644d39f67';
const LOT = 'GOUVERNANCE-REFERENCE-CODE-20261005';
const AUTRE = 'NEXUS-AUTRE-LOT-20261001';
const DEMANDE = `docs/handoff/lots/${LOT}/request-6.md`;
const T = Date.UTC(2026, 9, 7, 20, 8, 0);

const declencheur = [{
  date: new Date(T - 30000).toISOString(),
  auteur: 'vito-sainte-marie',
  corps: `@claude NEXUS_BASE_BRANCH=${RAIL}\nConsomme decision-6.`,
}];

const etat = (lots) => JSON.stringify({ protocol: 'nexus-handoff/2', lots });
const ouvert = { statut: 'ATTENTE_DECISION', derniere_demande: 'request-6.md', derniere_decision: 'decision-5.md' };
const consomme = { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-6.md', derniere_decision: 'decision-6.md' };
const clos = { statut: 'DECISION_CONSOMMEE', derniere_demande: 'request-1.md', derniere_decision: 'decision-1.md' };

// Le dépôt factice : la forme exacte de cd89ed1 (STATE.json et DECISION.md),
// rail en avance rapide, demande aux mêmes octets des deux côtés.
function depot(sur = {}) {
  const m = {
    etatRail: etat({ [LOT]: ouvert, [AUTRE]: clos }),
    etatHead: etat({ [LOT]: consomme, [AUTRE]: clos }),
    nameStatus: 'M\tdocs/handoff/DECISION.md\nM\tdocs/handoff/STATE.json',
    numstat: '1\t1\tdocs/handoff/DECISION.md\n4\t4\tdocs/handoff/STATE.json',
    unified: [
      'diff --git a/docs/handoff/STATE.json b/docs/handoff/STATE.json',
      '--- a/docs/handoff/STATE.json', '+++ b/docs/handoff/STATE.json', '@@ -1 +1 @@',
      '-      "statut": "ATTENTE_DECISION",', '+      "statut": "DECISION_CONSOMMEE",',
    ].join('\n'),
    lsTree: `docs/handoff/lots/${LOT}/decision-6.md\n${DEMANDE}\ndocs/handoff/lots/${LOT}/request-5.md`,
    blobRail: 'b10b6000000000000000000000000000000000aa',
    blobHead: 'b10b6000000000000000000000000000000000aa',
    ...sur,
  };
  const appels = [];
  const exec = (cmd, args) => {
    appels.push([cmd, ...args].join(' '));
    if (cmd !== 'git') return { code: 0, sortie: '' };
    const [verbe, a1, a2, a3] = args;
    if (verbe === 'fetch') return { code: 0, sortie: '' };
    if (verbe === 'rev-parse' && a1 === '--verify') {
      const ref = a3 || a2 || '';
      if (ref === `refs/heads/${BRANCHE}`) return { code: 0, sortie: HEAD };
      if (ref === `${RAIL_SHA}:${DEMANDE}`) return m.blobRail ? { code: 0, sortie: m.blobRail } : { code: 1, sortie: '' };
      if (ref === `${HEAD}:${DEMANDE}`) return m.blobHead ? { code: 0, sortie: m.blobHead } : { code: 1, sortie: '' };
      return { code: 1, sortie: '' };
    }
    if (verbe === 'rev-parse' && a1 === `origin/${RAIL}`) return { code: 0, sortie: RAIL_SHA };
    if (verbe === 'rev-parse') return { code: 0, sortie: HEAD };
    if (verbe === 'merge-base' && a1 === '--is-ancestor') return { code: 0, sortie: '' };
    if (verbe === 'merge-base') return { code: 0, sortie: RAIL_SHA };
    if (verbe === 'diff' && a1 === '--name-status') return { code: 0, sortie: m.nameStatus };
    if (verbe === 'diff' && a1 === '--numstat') return { code: 0, sortie: m.numstat };
    if (verbe === 'diff' && a1 === '--unified=0') return { code: 0, sortie: m.unified };
    if (verbe === 'show') {
      if (a1 === `${RAIL_SHA}:docs/handoff/STATE.json`) return m.etatRail === null ? { code: 128, sortie: '' } : { code: 0, sortie: m.etatRail };
      if (a1 === `${HEAD}:docs/handoff/STATE.json`) return { code: 0, sortie: m.etatHead };
      return { code: 0, sortie: '' };
    }
    if (verbe === 'ls-tree') return { code: 0, sortie: m.lsTree };
    if (verbe === 'push') return { code: 0, sortie: '' };
    if (verbe === 'ls-remote') return { code: 0, sortie: `${HEAD}\trefs/heads/${RAIL}` };
    return { code: 0, sortie: '' };
  };
  return { exec, pousses: () => appels.filter((c) => c.startsWith('git push')) };
}

// Le réveil, lu dans l'arbre de la branche de run : le lot y est fermé, il
// n'attend plus rien. C'est l'état exact qui faisait refuser.
const ANALYSE_DE_LA_BRANCHE = { lots: [] };

function lancer(mod, sur, options = {}) {
  const d = depot(sur);
  const r = mod.rapatrier({
    exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: options.analyse || ANALYSE_DE_LA_BRANCHE,
    verifications: [{ nom: 'non-regression', conclusion: 'success', requis: true }],
    fetch: false, transporter: true,
  });
  return { r, d };
}

function charger(source) {
  const m = new Module(SOURCE, module);
  m.filename = SOURCE;
  m.paths = Module._nodeModulePaths(path.dirname(SOURCE));
  m._compile(source, SOURCE);
  return m.exports;
}

const vrai = require(SOURCE);

function epreuvePrincipale(mod) {
  const { r, d } = lancer(mod, {});
  assert.strictEqual(r.code, 'TRANSPORTE',
    `un run qui consomme la décision de son lot doit être transporté, obtenu ${r.etat} ${r.code} — ${r.motif}`);
  assert.strictEqual(r.lot, LOT);
  assert.strictEqual(d.pousses().length, 1, 'exactement un push, en avance rapide');
  assert.ok(!/--force|\+/.test(d.pousses()[0].split(' ').slice(3).join(' ')), 'jamais de force');
}

console.log('\n── A. LE CAS DU 07/10 ───────────────────────────────────────────────');

verifier('le run qui consomme decision-6 est rattaché au lot du rail et transporté', () => epreuvePrincipale(vrai));

verifier('le rattachement nomme sa source (registre du rail) et la demande', () => {
  const d = depot();
  const r = vrai.lotDuRail(d.exec, BRANCHE, RAIL_SHA, HEAD,
    vrai.relever(d.exec, RAIL_SHA, HEAD));
  assert.ok(r && r.lot, 'aucun rattachement rendu');
  assert.strictEqual(r.lot.lot, LOT);
  assert.strictEqual(r.lot.demande, 'request-6.md', 'la DERNIÈRE demande du lot, pas request-5');
  assert.strictEqual(r.lot.source, 'REGISTRE_DU_RAIL');
  assert.ok(r.lot.refs_reelles.memes.includes(BRANCHE));
});

verifier('un run qui ajoute decision-N dans le dossier du lot est rattaché aussi', () => {
  const { r } = lancer(vrai, {
    nameStatus: `A\tdocs/handoff/lots/${LOT}/decision-6.md\nM\tdocs/handoff/STATE.json`,
    numstat: `10\t0\tdocs/handoff/lots/${LOT}/decision-6.md\n4\t4\tdocs/handoff/STATE.json`,
  });
  assert.strictEqual(r.code, 'TRANSPORTE', `${r.code} — ${r.motif}`);
});

console.log('\n── B. RIEN D’AUTRE N’EST RELÂCHÉ ────────────────────────────────────');

verifier('demande aux octets différents : homonyme → LOT_AMBIGU, aucun push', () => {
  const { r, d } = lancer(vrai, { blobHead: 'f00d000000000000000000000000000000000bb' });
  assert.strictEqual(r.code, 'LOT_AMBIGU', `${r.code} — ${r.motif}`);
  assert.strictEqual(d.pousses().length, 0);
});

verifier('lot déjà clos sur le rail : pas une consommation → LOT_NON_RATTACHABLE, aucun push', () => {
  const { r, d } = lancer(vrai, { etatRail: etat({ [LOT]: consomme, [AUTRE]: clos }),
    etatHead: etat({ [LOT]: { ...consomme, note: 'retouche' }, [AUTRE]: clos }) });
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE', `${r.code} — ${r.motif}`);
  assert.strictEqual(d.pousses().length, 0);
});

verifier('deux lots touchés : LOT_AMBIGU, aucun push', () => {
  const { r, d } = lancer(vrai, {
    etatHead: etat({ [LOT]: consomme, [AUTRE]: { ...clos, note: 'retouche' } }) });
  assert.strictEqual(r.code, 'LOT_AMBIGU', `${r.code} — ${r.motif}`);
  assert.strictEqual(d.pousses().length, 0);
});

verifier('registre du rail illisible : refus d’origine inchangé, aucun push', () => {
  const { r, d } = lancer(vrai, { etatRail: null });
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE', `${r.code} — ${r.motif}`);
  assert.strictEqual(d.pousses().length, 0);
});

verifier('la demande n’existe pas sur le rail : pas de rattachement, aucun push', () => {
  const { r, d } = lancer(vrai, { blobRail: '' });
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE', `${r.code} — ${r.motif}`);
  assert.strictEqual(d.pousses().length, 0);
});

verifier('le rattachement du réveil garde la priorité quand il existe', () => {
  const { r } = lancer(vrai, {}, { analyse: { lots: [
    { lot: AUTRE, refs_reelles: { memes: [`origin/${BRANCHE}`], homonymes: [] } }] } });
  assert.strictEqual(r.lot, AUTRE, 'le réveil a parlé : sa réponse ne se remplace pas');
});

console.log('\n── M. DÉBRANCHER L’AIDE ─────────────────────────────────────────────');

verifier('sans l’appel à lotDuRail dans observer, l’épreuve principale rougit', () => {
  const texte = fs.readFileSync(SOURCE, 'utf8');
  const appel = '= lotDuRail(exec, branche, railSha, head, diff)';
  assert.strictEqual(texte.split(appel).length - 1, 1, 'l’appel doit être unique pour être débranché');
  const mutant = charger(texte.replace(appel, '= null'));
  let rouge = false;
  try { epreuvePrincipale(mutant); } catch (_) { rouge = true; }
  assert.ok(rouge, 'l’aide débranchée, l’épreuve passe encore : elle ne prouve pas le câblage');
  const { r } = lancer(mutant, {});
  assert.strictEqual(r.code, 'LOT_NON_RATTACHABLE', `le mutant doit retrouver le défaut du 07/10, obtenu ${r.code}`);
});

console.log(`\n${echecs.length === 0 ? '✅' : '❌'} ${reussites} réussite(s), ${echecs.length} échec(s)\n`);
process.exit(echecs.length === 0 ? 0 : 1);
