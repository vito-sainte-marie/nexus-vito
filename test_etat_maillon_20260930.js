#!/usr/bin/env node
'use strict';
// Épreuves de l'état de maillon — « aucun refus silencieux » (§4).
//
// LE DÉFAUT MESURÉ. Le 30/09/2026, la chaîne Handoff s'est arrêtée quatre jours
// sans qu'un seul run ne rougisse, par trois chemins différents : `refus()` qui
// écrit dans le journal et sort en 0 ; un `|| true` qui avale le code 1 d'une
// garde ; un filtre d'auteur qui rend `skipped`, et `skipped` n'est pas
// `failure`. Ce module n'ajoute pas de la couleur : il rend l'arrêt EXPLOITABLE.
//
// CE QUE CES ÉPREUVES VÉRIFIENT DONC. Non pas qu'un état « se construit », mais
// qu'un état INCOMPLET est IMPOSSIBLE à construire. La discipline demandée aux
// auteurs se contourne ; celle que le constructeur impose, non.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('./outils/etat-maillon.js');

let passees = 0; const echecs = [];
const ep = (titre, f) => { try { f(); passees++; } catch (e) { echecs.push(`${titre} — ${e.message}`); } };

const complet = (sur) => Object.assign({
  etat: 'BLOCKED', maillon: 'rapatriement-claude-vers-rail', code: 'DIVERGENCE',
  condition: 'absence de divergence incompatible', sha: 'a'.repeat(40),
  branche: 'claude/issue-28-20260930-1349', lot: 'NEXUS-CONTINUITE-TERRAIN-2-20260922',
  prochaine_action: 'Arbitrer la divergence au registre.',
}, sur || {});

// ── LA LISTE EST FERMÉE ──────────────────────────────────────────────────────
ep('les cinq états de la procédure, et rien d’autre', () => {
  assert.deepStrictEqual(M.ETATS, ['EXECUTE', 'NO_WORK', 'BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED']);
});
ep('un état hors de la liste est une erreur de programme, pas une valeur exotique', () => {
  // C'est exactement ainsi qu'un « inconnu » finirait traité comme un succès.
  for (const faux of ['SUCCESS', 'ok', 'WARN', '', 'blocked']) {
    assert.throws(() => M.etat(complet({ etat: faux })), /hors de la liste fermée/,
      `« ${faux} » aurait dû être refusé`);
  }
});

// ── UN ARRÊT INCOMPLET EST IMPOSSIBLE ────────────────────────────────────────
ep('un arrêt qui omet l’un des six champs ne se construit pas', () => {
  for (const champ of M.CHAMPS_EXIGES) {
    for (const e of M.ETATS_QUI_ARRETENT) {
      assert.throws(() => M.etat(complet({ etat: e, [champ]: '' })),
        new RegExp(champ), `${e} sans « ${champ} » aurait dû être refusé`);
    }
  }
});
ep('un champ rempli d’espaces ne remplit rien', () => {
  assert.throws(() => M.etat(complet({ prochaine_action: '   ' })), /prochaine_action/);
});
ep('tout état, même EXECUTE, doit nommer son maillon', () => {
  assert.throws(() => M.etat({ etat: 'EXECUTE' }), /nommer son maillon/);
  assert.throws(() => M.etat({ etat: 'NO_WORK' }), /nommer son maillon/);
});
ep('un repos légitime n’a pas à porter la charge d’un arrêt', () => {
  const r = M.etat({ etat: 'NO_WORK', maillon: 'reveil', motif: 'Aucune décision fraîche.' });
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.sha, null, 'les champs absents valent null, jamais undefined ni ""');
});

// ── LA COULEUR N’EST PAS LE SIGNAL ───────────────────────────────────────────
ep('seul FAILED rougit la CI', () => {
  const codes = {};
  for (const e of M.ETATS) codes[e] = M.codeSortie(M.etat(complet({ etat: e })));
  assert.deepStrictEqual(codes, { EXECUTE: 0, NO_WORK: 0, BLOCKED: 0, HUMAN_DECISION_REQUIRED: 0, FAILED: 1 },
    'transformer chaque NO_WORK en rouge apprend à l’équipe à ignorer le rouge');
});
ep('les trois états qui arrêtent la chaîne sont nommés', () => {
  assert.deepStrictEqual(M.ETATS_QUI_ARRETENT, ['BLOCKED', 'HUMAN_DECISION_REQUIRED', 'FAILED']);
  for (const e of M.ETATS_QUI_ARRETENT) assert.strictEqual(M.arrete(M.etat(complet({ etat: e }))), true);
  for (const e of ['EXECUTE', 'NO_WORK']) assert.strictEqual(M.arrete(M.etat(complet({ etat: e }))), false);
});

// ── QUATRE CANAUX, AUCUN CANAL UNIQUE ────────────────────────────────────────
function publierDansUnBac(champs) {
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-etat-'));
  const resume = path.join(bac, 'resume.md');
  const sortie = path.join(bac, 'sortie.txt');
  const json = path.join(bac, 'etat.json');
  const anciens = { s: process.env.GITHUB_STEP_SUMMARY, o: process.env.GITHUB_OUTPUT, f: process.env.NEXUS_ETAT_FICHIER };
  process.env.GITHUB_STEP_SUMMARY = resume;
  process.env.GITHUB_OUTPUT = sortie;
  process.env.NEXUS_ETAT_FICHIER = json;
  let journal = '';
  try {
    M.publier(M.etat(champs), { write: (t) => { journal += t; } });
  } finally {
    for (const [k, v] of [['GITHUB_STEP_SUMMARY', anciens.s], ['GITHUB_OUTPUT', anciens.o], ['NEXUS_ETAT_FICHIER', anciens.f]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  const lu = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  return { journal, resume: lu(resume), sortie: lu(sortie), json: lu(json) };
}

ep('un arrêt sort par QUATRE canaux indépendants', () => {
  const p = publierDansUnBac(complet());
  assert.ok(p.journal.includes('[BLOCKED]'), 'journal');
  assert.ok(p.journal.includes('::warning::'), 'annotation de niveau run');
  assert.ok(p.resume.includes('BLOCKED'), 'résumé de job');
  assert.ok(/(^|\n)etat=BLOCKED(\n|$)/.test(p.sortie), 'sortie d’étape lisible par l’étape suivante');
  assert.ok(JSON.parse(p.json).etat === 'BLOCKED', 'JSON');
});
ep('MUTATION — supprimer un canal ne rend pas l’arrêt invisible', () => {
  // Le point de la redondance : aucun canal n'est l'endroit où il faut savoir
  // regarder. Un arrêt qui n'existe que dans le journal se retrouve quatre
  // jours plus tard.
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-etat-'));
  const anciens = { s: process.env.GITHUB_STEP_SUMMARY, o: process.env.GITHUB_OUTPUT };
  delete process.env.GITHUB_STEP_SUMMARY;          // canal « résumé » débranché
  process.env.GITHUB_OUTPUT = path.join(bac, 'o.txt');
  let journal = '';
  try { M.publier(M.etat(complet()), { write: (t) => { journal += t; } }); }
  finally {
    if (anciens.s === undefined) delete process.env.GITHUB_STEP_SUMMARY; else process.env.GITHUB_STEP_SUMMARY = anciens.s;
    if (anciens.o === undefined) delete process.env.GITHUB_OUTPUT; else process.env.GITHUB_OUTPUT = anciens.o;
  }
  assert.ok(journal.includes('::warning::') && journal.includes('DIVERGENCE'),
    'canal manquant : l’arrêt doit rester lisible par les autres');
  assert.ok(fs.readFileSync(path.join(bac, 'o.txt'), 'utf8').includes('etat=BLOCKED'));
});
ep('MUTATION — un faux `success` ne peut pas cacher un refus', () => {
  // §9 : « faux `success` après refus ». Le code de sortie d'un BLOCKED est 0
  // À DESSEIN — mais alors l'étape suivante DOIT pouvoir le voir. Si `etat=` ne
  // sortait pas, un `success` de job serait indiscernable d'un travail fait.
  const p = publierDansUnBac(complet());
  assert.ok(/(^|\n)etat=BLOCKED(\n|$)/.test(p.sortie),
    'sans état machine en sortie, un refus et un succès se ressemblent — c’est le défaut du 30/09');
  assert.ok(/etat_code=DIVERGENCE/.test(p.sortie), 'le code doit voyager avec l’état');
});
ep('les six champs figurent dans le résumé d’un arrêt, sans avoir à instruire le dossier', () => {
  const p = publierDansUnBac(complet());
  for (const champ of M.CHAMPS_EXIGES) assert.ok(p.resume.includes(champ), `« ${champ} » absent du résumé`);
  assert.ok(p.resume.includes('claude/issue-28-20260930-1349'));
});
ep('un EXECUTE reste discret : notice, et pas de tableau d’arrêt', () => {
  const p = publierDansUnBac(complet({ etat: 'EXECUTE', code: 'FAST_FORWARD' }));
  assert.ok(p.journal.includes('::notice::'));
  assert.ok(!p.resume.includes('| condition |'), 'le tableau d’arrêt n’a pas lieu d’être sur un succès');
});
ep('un FAILED s’annonce en erreur', () => {
  const p = publierDansUnBac(complet({ etat: 'FAILED' }));
  assert.ok(p.journal.includes('::error::'));
});
ep('publier sans aucune variable GitHub ne jette pas', () => {
  const anciens = [process.env.GITHUB_STEP_SUMMARY, process.env.GITHUB_OUTPUT, process.env.NEXUS_ETAT_FICHIER];
  delete process.env.GITHUB_STEP_SUMMARY; delete process.env.GITHUB_OUTPUT; delete process.env.NEXUS_ETAT_FICHIER;
  try {
    let j = ''; M.publier(M.etat(complet()), { write: (t) => { j += t; } });
    assert.ok(j.includes('[BLOCKED]'), 'hors CI, le journal reste');
  } finally {
    const noms = ['GITHUB_STEP_SUMMARY', 'GITHUB_OUTPUT', 'NEXUS_ETAT_FICHIER'];
    noms.forEach((n, i) => { if (anciens[i] !== undefined) process.env[n] = anciens[i]; });
  }
});

// ── UN ÉTAT NE SE RETOUCHE PAS ───────────────────────────────────────────────
ep('un état publié est gelé', () => {
  const r = M.etat(complet());
  assert.throws(() => { 'use strict'; r.etat = 'EXECUTE'; }, TypeError,
    'un état qu’on peut réécrire après coup n’est pas une preuve');
});

// `process.exit(` est interdit, `process.exitCode` ne l'est pas, et la nuance
// n'est pas cosmétique : `exit()` tronque ce qui est encore en cours d'écriture
// — annotation, résumé de run, GITHUB_OUTPUT. Un module qui se tue au milieu de
// sa propre publication est exactement le refus silencieux qu'on ferme ici.
ep('le module signale et n’agit pas', () => {
  const src = fs.readFileSync('./outils/etat-maillon.js', 'utf8');
  for (const interdit of ['execSync', 'spawnSync', 'child_process', 'git push', 'gh api', 'process.exit(']) {
    assert.ok(!src.includes(interdit), `ce module publie un état : « ${interdit} » n’a rien à y faire`);
  }
});


// ── LA PORTE EN LIGNE DE COMMANDE ───────────────────────────────────────────
// Les maillons qui refusaient en silence sont du bash. Si la porte ne tient
// pas, §4 ne s'applique nulle part où le défaut a réellement eu lieu.
const { spawnSync } = require('child_process');
const porte = (args, env) => {
  const bac = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-porte-'));
  const sortie = path.join(bac, 'output');
  const resume = path.join(bac, 'summary');
  fs.writeFileSync(sortie, ''); fs.writeFileSync(resume, '');
  const r = spawnSync(process.execPath, ['./outils/etat-maillon.js', ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { GITHUB_OUTPUT: sortie, GITHUB_STEP_SUMMARY: resume }, env || {}),
  });
  const lu = { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '',
    output: fs.readFileSync(sortie, 'utf8'), resume: fs.readFileSync(resume, 'utf8') };
  fs.rmSync(bac, { recursive: true, force: true });
  return lu;
};

const SIX = ['--condition', 'c', '--sha', 'd'.repeat(40), '--branche', 'b',
  '--lot', 'L', '--maillon', 'm', '--prochaine-action', 'p'];

ep('la porte publie un NO_WORK sans rougir', () => {
  const r = porte(['NO_WORK', 'RIEN_A_REVEILLER', '--maillon', 'reveil', '--motif', 'aucune demande']);
  assert.strictEqual(r.code, 0, 'un NO_WORK légitime ne doit pas rougir la CI');
  assert.ok(r.stdout.includes('[NO_WORK]'), 'l’état doit être lisible au journal');
  assert.ok(r.output.includes('etat=NO_WORK'), 'un outil en aval doit pouvoir le lire');
});

ep('la porte publie un BLOCKED exploitable sans rougir', () => {
  const r = porte(['BLOCKED', 'LOT_SANS_BRANCHE', ...SIX]);
  assert.strictEqual(r.code, 0, 'un arrêt signalé n’est pas une panne de CI');
  assert.ok(r.stdout.includes('::warning::'), 'l’arrêt doit se voir sans ouvrir le journal');
  for (const champ of M.CHAMPS_EXIGES) {
    assert.ok(r.stdout.includes(champ + ' :'), `l’arrêt doit rendre « ${champ} » visible`);
  }
  assert.ok(r.resume.includes('LOT_SANS_BRANCHE'), 'le résumé de run doit porter le code');
});

ep('la porte rougit sur FAILED, et sur FAILED seulement', () => {
  assert.strictEqual(porte(['FAILED', 'X', ...SIX]).code, 1);
  for (const e of ['EXECUTE', 'NO_WORK']) {
    assert.strictEqual(porte([e, 'X', '--maillon', 'm']).code, 0, `${e} ne doit pas rougir`);
  }
  assert.strictEqual(porte(['HUMAN_DECISION_REQUIRED', 'X', ...SIX]).code, 0,
    'une décision attendue de Frédéric n’est pas un échec technique');
});

ep('la porte refuse bruyamment un arrêt incomplet', () => {
  const r = porte(['BLOCKED', 'X', '--maillon', 'm']);
  assert.strictEqual(r.code, 1, 'un appel fautif doit rougir : le taire remettrait le défaut qu’on ferme');
  assert.ok(r.stdout.includes('::error::'), 'le refus de la porte doit être annoté');
  assert.ok(/prochaine_action/.test(r.stdout), 'le refus doit nommer ce qui manque');
});

ep('la porte n’invente pas d’état hors de la liste fermée', () => {
  const r = porte(['SUCCESS', 'X', '--maillon', 'm']);
  assert.strictEqual(r.code, 1, '« SUCCESS » n’est pas un état de la chaîne');
  assert.ok(r.stdout.includes('::error::'));
});

// La porte TRADUIT. Si elle déduisait l'état, il y aurait deux endroits où
// l'état se détermine, et le second finirait par mentir sur le premier.
ep('la porte ne déduit rien de ses arguments', () => {
  const r = porte(['NO_WORK', 'ECHEC_TOTAL', '--maillon', 'm', '--motif', 'tout a échoué']);
  assert.strictEqual(r.code, 0, 'ni le code ni le motif ne doivent requalifier l’état demandé');
  assert.ok(r.output.includes('etat=NO_WORK'));
});

ep('la porte transporte les six champs jusqu’au JSON', () => {
  const r = porte(['HUMAN_DECISION_REQUIRED', 'GATE_HUMAINE', ...SIX]);
  const j = JSON.parse(/etat_json=(.*)/.exec(r.output)[1]);
  for (const champ of M.CHAMPS_EXIGES) {
    assert.ok(j[champ], `« ${champ} » doit survivre au passage par la ligne de commande`);
  }
  assert.strictEqual(j.sha, 'd'.repeat(40));
});

console.log(`\nÉtat de maillon — ${passees} épreuve(s) passée(s), ${echecs.length} échec(s).`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
