'use strict';

/**
 * ÉPREUVE DU RAPATRIEMENT — CE QUI EST MESURÉ ICI, C'EST LE GESTE, PAS L'INTENTION.
 *
 * Un outil de transport se juge d'abord sur ce qu'il NE fait pas. La moitié de
 * ces épreuves vérifient donc qu'aucun `git push` n'a été émis : un refus qui
 * publie un beau motif tout en poussant quand même serait pire que pas de
 * refus du tout. Le dépôt est factice — pas de réseau, pas d'origin — parce
 * qu'une épreuve qui pousse vraiment quelque part finit par pousser ailleurs.
 */

const assert = require('assert');
const { rapatrier, observer, relever, verificationsDuHead, requisDeclares,
  REQUIS_A_DEFAUT_20260930, executeurReel } = require('./outils/rapatrier-vers-rail.js');
const { codeSortie, ETATS } = require('./outils/etat-maillon.js');

let reussites = 0; const echecs = [];
function verifier(nom, f) {
  try { f(); reussites += 1; console.log(`   ✓ ${nom}`); }
  catch (e) { echecs.push({ nom, e }); console.log(`   ✗ ${nom}\n     ${e.message}`); }
}

const RAIL = 'handoff-continuite-20260920';
const BRANCHE = 'claude/issue-28-20260930-1349';
const HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const RAIL_SHA = '00112233445566778899aabbccddeeff00112233';
const LOT = 'NEXUS-CONTINUITE-TERRAIN-2-20260922';
const T = Date.UTC(2026, 8, 30, 13, 49, 0);

const declencheur = [{
  date: new Date(T - 30000).toISOString(),
  auteur: 'vito-sainte-marie',
  corps: `@claude NEXUS_BASE_BRANCH=${RAIL}\nFais le travail.`,
}];

const ANALYSE = {
  lots: [{ lot: LOT, refs_reelles: { memes: [`origin/${BRANCHE}`], homonymes: [] } }],
};

const DIFF_SIMPLE = [
  'diff --git a/outils/x.js b/outils/x.js',
  '--- a/outils/x.js',
  '+++ b/outils/x.js',
  '@@ -0,0 +1,2 @@',
  "+const a = 1;",
  '+module.exports = { a };',
].join('\n');

// Le dépôt factice. Il répond aux questions que l'outil pose réellement, et
// RETIENT tout ce qu'on lui demande : c'est ce registre d'appels qui permet
// d'affirmer qu'aucun push n'a eu lieu.
function depot(sur = {}) {
  const m = {
    head: HEAD, railSha: RAIL_SHA, base: RAIL_SHA,
    railEstAncetre: 0, baseEstAncetreDuRail: 0,
    nameStatus: 'M\toutils/x.js',
    numstat: '2\t0\toutils/x.js',
    unified: DIFF_SIMPLE,
    contenus: {},
    pushCode: 0, relu: undefined,
    ...sur,
  };
  const appels = [];
  const exec = (cmd, args) => {
    appels.push([cmd, ...args].join(' '));
    const a = args.join(' ');
    if (cmd !== 'git') return { code: 0, sortie: '' };
    if (a === '--abbrev-ref HEAD' || a === 'rev-parse --abbrev-ref HEAD') return { code: 0, sortie: BRANCHE };
    if (args[0] === 'fetch') return { code: 0, sortie: '' };
    // Le banc modélise le cas de la CI : la branche de run est EXTRAITE, donc
    // sa ref locale existe et la ref distante peut être absente. Les surcharges
    // `refLocale`/`refDistante` permettent de jouer l'autre bord (poste de
    // travail) et la divergence des deux.
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      const ref = args[3] || '';
      if (ref === `refs/heads/${BRANCHE}`) {
        return m.refLocale === null ? { code: 1, sortie: '' } : { code: 0, sortie: m.refLocale || m.head };
      }
      if (ref === `refs/remotes/origin/${BRANCHE}`) {
        return m.refDistante ? { code: 0, sortie: m.refDistante } : { code: 1, sortie: '' };
      }
      return { code: 1, sortie: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === BRANCHE) return { code: 0, sortie: m.head };
    if (args[0] === 'rev-parse') return { code: 0, sortie: m.railSha };
    if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
      return { code: args[2].startsWith('origin/') ? m.railEstAncetre : m.baseEstAncetreDuRail, sortie: '' };
    }
    if (args[0] === 'merge-base') return { code: 0, sortie: m.base };
    if (args[0] === 'diff' && args[1] === '--name-status') return { code: 0, sortie: m.nameStatus };
    if (args[0] === 'diff' && args[1] === '--numstat') return { code: 0, sortie: m.numstat };
    if (args[0] === 'diff' && args[1] === '--unified=0') return { code: 0, sortie: m.unified };
    if (args[0] === 'show') {
      const chemin = String(args[1]).split(':').slice(1).join(':');
      return { code: 0, sortie: m.contenus[chemin] || '' };
    }
    if (args[0] === 'push') return { code: m.pushCode, sortie: '', erreur: m.pushCode ? 'non-fast-forward' : '' };
    if (args[0] === 'ls-remote') {
      const sha = m.relu === undefined ? m.head : m.relu;
      return { code: 0, sortie: sha ? `${sha}\trefs/heads/${RAIL}` : '' };
    }
    return { code: 0, sortie: '' };
  };
  return { exec, appels, pousses: () => appels.filter((c) => c.startsWith('git push')) };
}

function lancer(sur = {}, options = {}) {
  const d = depot(sur);
  const r = rapatrier({
    exec: d.exec, branche: BRANCHE,
    commentaires: options.commentaires !== undefined ? options.commentaires : declencheur,
    analyse: options.analyse || ANALYSE,
    verifications: options.verifications !== undefined
      ? options.verifications
      : [{ nom: 'Tests', conclusion: 'success' }],
    fetch: false,
    rail: options.rail,
    baseBranch: options.baseBranch,
    autorites: options.autorites,
    transporter: options.transporter === true,
  });
  return { r, d };
}

console.log('\n── A. CE QUE L’OUTIL OBSERVE ───────────────────────────────────────');

verifier('l’observation compose les champs que la qualification exige', () => {
  const d = depot();
  const e = observer({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [{ nom: 'Tests', conclusion: 'success' }], fetch: false });
  assert.strictEqual(e.rail, RAIL);
  assert.strictEqual(e.head, HEAD);
  assert.strictEqual(e.railSha, RAIL_SHA);
  assert.strictEqual(e.baseSha, RAIL_SHA);
  assert.strictEqual(e.baseBranch, RAIL);
  assert.strictEqual(e.railEstAncetre, true);
  assert.strictEqual(e.lot, LOT);
  assert.deepStrictEqual(e.diff.map((f) => f.chemin), ['outils/x.js']);
  assert.strictEqual(typeof e.contenus, 'function');
});

verifier('« je ne sais pas » ne devient pas « non » sur une question d’ascendance', () => {
  const d = depot({ railEstAncetre: 128 });
  const e = observer({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(e.railEstAncetre, null,
    'un code 128 est une question qui n’a pas pu être posée, pas une réponse négative');
  const d1 = depot({ railEstAncetre: 1 });
  const e1 = observer({ exec: d1.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(e1.railEstAncetre, false);
});

verifier('le run courant est écarté de ses propres vérifications', () => {
  const exec = () => ({ code: 0, sortie: [
    JSON.stringify({ nom: 'Tests', conclusion: 'success', url: 'https://x/runs/111/job/1' }),
    JSON.stringify({ nom: 'Rapatriement', conclusion: null, url: 'https://x/runs/222/job/9' }),
  ].join('\n') });
  const v = verificationsDuHead(exec, 'o/r', HEAD, '222');
  assert.deepStrictEqual(v, [{ nom: 'Tests', conclusion: 'success' }],
    'compter son propre check en cours donnerait CI_NON_VERTE à tous les coups');
});

verifier('GitHub muet rend « non mesuré », jamais un vert par défaut', () => {
  assert.strictEqual(verificationsDuHead(() => ({ code: 1, sortie: '' }), 'o/r', HEAD, null), null);
});

// ── QUI EXIGE QUOI — la réparation du 30/09/2026 ─────────────────────────────
//
// Mesuré ce jour-là : `verificationsDuHead` rendait tous les check-runs du
// commit sans jamais marquer `requis`, et `qualifier` traite l'absence de
// `requis` comme « requis » — défaut sûr, et qui reste. Tout ce que GitHub
// accrochait au commit devenait donc obligatoire, dont `Supabase Preview` :
// structurellement `skipped`, braqué sur le projet Supabase de PRODUCTION, exigé
// par aucun ruleset. Chaque transport vers le rail en mourait, et la
// `prochaine_action` publiée désignait un travail que personne ne pouvait faire.
//
// Une désignation ne se recalcule pas : elle se déclare. Ces épreuves tiennent
// les deux bouts — la désignation est LUE sur la destination, et à défaut elle
// retombe sur une constante qui SERRE.

// Un faux `gh` : il distingue la question posée au ruleset de celle posée aux
// check-runs, parce que l'outil réel pose les deux et qu'un simulateur qui les
// confond ne mesurerait rien.
function fauxGh(opts) {
  return (cmd, args) => {
    const t = (args || []).join(' ');
    if (t.includes('/rules/branches/')) {
      return opts.regles === undefined
        ? { code: 1, sortie: '' }
        : { code: 0, sortie: `${JSON.stringify(opts.regles)}\n` };
    }
    return { code: 0, sortie: (opts.checks || []).map((c) => JSON.stringify(c)).join('\n') };
  };
}

verifier('l’autorité requise est LUE sur la branche de destination', () => {
  const l = requisDeclares(fauxGh({ regles: ['non-regression', 'Construire'] }), 'o/r', 'rail');
  assert.deepStrictEqual(l, ['non-regression', 'Construire']);
});

verifier('une destination qui n’exige rien rend une liste vide, pas « non mesuré »', () => {
  assert.deepStrictEqual(requisDeclares(fauxGh({ regles: [] }), 'o/r', 'rail'), [],
    '« GitHub n’exige rien ici » est une mesure ; la confondre avec une absence de mesure efface un fait');
});

verifier('une autorité injoignable rend « non mesuré », jamais une liste vide', () => {
  assert.strictEqual(requisDeclares(fauxGh({}), 'o/r', 'rail'), null);
  assert.strictEqual(requisDeclares(fauxGh({ regles: ['x'] }), 'o/r', ''), null,
    'sans destination nommée il n’y a personne à interroger : ne rien inventer');
});

verifier('un check tiers que la destination n’exige pas voyage requis: false', () => {
  const exec = fauxGh({ regles: ['non-regression'], checks: [
    { nom: 'non-regression', conclusion: 'success', url: 'https://x/runs/1/job/1' },
    { nom: 'Supabase Preview', conclusion: 'skipped',
      url: 'https://supabase.com/dashboard/project/zzz/branches' },
  ] });
  const v = verificationsDuHead(exec, 'o/r', HEAD, null, { destination: 'rail' });
  assert.deepStrictEqual(v, [
    { nom: 'non-regression', conclusion: 'success', requis: true, autorite: 'RULESET:rail' },
    { nom: 'Supabase Preview', conclusion: 'skipped', requis: false, autorite: 'RULESET:rail' },
  ], 'c’est exactement le relevé qui bloquait tout transport le 30/09/2026');
});

verifier('ce qui n’est pas requis est démoti, jamais effacé', () => {
  const v = verificationsDuHead(fauxGh({ regles: ['non-regression'], checks: [
    { nom: 'Cloudflare Pages', conclusion: 'failure', url: 'https://x/1' },
  ] }), 'o/r', HEAD, null, { destination: 'rail' });
  assert.strictEqual(v.length, 1, 'un check non requis qui rougit doit se VOIR sans BLOQUER');
  assert.strictEqual(v[0].requis, false);
  assert.strictEqual(v[0].conclusion, 'failure', 'sa conclusion réelle est conservée telle quelle');
});

verifier('l’autorité non mesurée retombe sur une déclaration datée, et elle SERRE', () => {
  assert.ok(REQUIS_A_DEFAUT_20260930.length > 0,
    'à défaut de mesure on exige PLUS, pas moins : une constante vide rendrait zéro contrôle obligatoire');
  const v = verificationsDuHead(fauxGh({ checks: [
    { nom: REQUIS_A_DEFAUT_20260930[0], conclusion: 'success', url: 'https://x/1' },
    { nom: 'Aperçu tiers', conclusion: 'skipped', url: 'https://x/2' },
  ] }), 'o/r', HEAD, null, { destination: 'rail' });
  assert.strictEqual(v[0].requis, true);
  assert.strictEqual(v[0].autorite, 'DEFAUT_DECLARE_20260930_AUTORITE_NON_MESUREE',
    'le dossier doit dire que l’autorité n’a pas répondu, pas prétendre l’avoir lue');
  assert.strictEqual(v[1].requis, false);
});

verifier('une destination qui n’exige rien retombe aussi sur la déclaration datée', () => {
  const v = verificationsDuHead(fauxGh({ regles: [], checks: [
    { nom: 'Aperçu tiers', conclusion: 'skipped', url: 'https://x/2' },
  ] }), 'o/r', HEAD, null, { destination: 'rail' });
  assert.strictEqual(v[0].autorite, 'DEFAUT_DECLARE_20260930',
    'zéro exigence déclarée ne doit pas devenir zéro contrôle obligatoire');
  assert.strictEqual(v[0].requis, false);
});

verifier('le verdict du run courant revient SOUS LE NOM QUE GITHUB DONNE au check', () => {
  // Un run ne peut pas conclure sur lui-même avant de finir : son propre check
  // est `in_progress` ici, donc écarté. L'écarter sans rien à la place laisse
  // zéro vérification requise — le refus changerait de nom, pas de nature. Le
  // workflow mesure le verdict ailleurs (`job.status`) et le passe ici.
  const exec = fauxGh({ regles: ['non-regression'], checks: [
    { nom: 'non-regression', conclusion: null, url: 'https://x/runs/777/job/5' },
  ] });
  const v = verificationsDuHead(exec, 'o/r', HEAD, '777',
    { destination: 'rail', etatDuJob: 'Success' });
  assert.deepStrictEqual(v, [{ nom: 'non-regression', conclusion: 'success', requis: true,
    autorite: 'RULESET:rail', provenance: 'ETAT_DU_JOB' }],
    'le nom doit venir de GitHub et la provenance être dite : le dossier ne doit jamais '
    + 'prétendre que l’API des check-runs a conclu ce que le job a conclu');
});

verifier('sans verdict mesuré, le check du run courant reste écarté', () => {
  const exec = fauxGh({ regles: ['non-regression'], checks: [
    { nom: 'non-regression', conclusion: null, url: 'https://x/runs/777/job/5' },
  ] });
  const v = verificationsDuHead(exec, 'o/r', HEAD, '777', { destination: 'rail' });
  assert.deepStrictEqual(v, [], 'une absence de mesure ne s’invente pas — l’appelant dira CI_NON_MESUREE');
});

verifier('appelée sans options, la fonction se comporte comme avant le 30/09/2026', () => {
  const v = verificationsDuHead(fauxGh({ checks: [
    { nom: 'Tests', conclusion: 'success', url: 'https://x/1' },
  ] }), 'o/r', HEAD, null);
  assert.deepStrictEqual(v, [{ nom: 'Tests', conclusion: 'success' }],
    'les appels d’avant ne doivent pas changer de réponse : la compatibilité est un contrat');
});

verifier('une ligne SQL « -- » n’est pas prise pour un en-tête de diff', () => {
  const unified = [
    'diff --git a/m.sql b/m.sql',
    '--- a/m.sql',
    '+++ b/m.sql',
    '@@ -1,2 +1,2 @@',
    '--- ancien commentaire',
    '+-- nouveau commentaire',
  ].join('\n');
  const exec = (c, args) => ({ code: 0, sortie:
    args[1] === '--unified=0' ? unified
      : args[1] === '--name-status' ? 'M\tm.sql'
        : args[1] === '--numstat' ? '1\t1\tm.sql' : '' });
  const d = relever(exec, RAIL_SHA, HEAD);
  assert.strictEqual(d.length, 1, 'un faux en-tête ne doit pas inventer un second fichier');
  assert.deepStrictEqual(d[0].lignes_supprimees, ['-- ancien commentaire']);
  assert.deepStrictEqual(d[0].lignes_ajoutees, ['-- nouveau commentaire']);
});

verifier('un binaire est relevé comme opaque et refusé', () => {
  const { r, d } = lancer({ numstat: '-\t-\toutils/logo.png', nameStatus: 'A\toutils/logo.png',
    unified: 'diff --git a/outils/logo.png b/outils/logo.png\nBinary files differ' }, { transporter: true });
  assert.strictEqual(r.code, 'DIFF_NON_INSPECTABLE');
  assert.strictEqual(d.pousses().length, 0);
});

console.log('\n── B. L’AUTORITÉ NE SE DÉDUIT PAS DE LA CAPACITÉ ───────────────────');

verifier('le rail désigné par l’humain est l’autorité de la mission', () => {
  const d = depot();
  const e = observer({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(e._origine, 'DECLENCHEUR');
  assert.deepStrictEqual(e.mission.autorites, [RAIL]);
});

verifier('un rail IMPOSÉ sans autorité déclarée ne se transporte pas', () => {
  const { r, d } = lancer({}, { rail: RAIL, commentaires: [], baseBranch: RAIL, transporter: true });
  assert.strictEqual(r.code, 'MISSION_SANS_AUTORITE',
    'imposer une destination dans un appel ne s’autorise pas à y écrire');
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(d.pousses().length, 0);
});

verifier('un rail imposé sans base déclarée est refusé plus tôt encore', () => {
  const { r, d } = lancer({}, { rail: RAIL, commentaires: [], transporter: true });
  assert.strictEqual(r.code, 'BASE_BRANCH_ABSENTE',
    'la mission nomme sa branche de base, ou la chaîne s’arrête avant de parler d’autorité');
  assert.strictEqual(d.pousses().length, 0);
});

verifier('un rail IMPOSÉ avec autorité déclarée reste qualifiable', () => {
  const { r } = lancer({}, { rail: RAIL, commentaires: [], autorites: [RAIL], transporter: true });
  assert.notStrictEqual(r.code, 'MISSION_SANS_AUTORITE');
});

console.log('\n── C. TOUT REFUS EST UN REFUS D’ÉCRIRE ─────────────────────────────');

const refus = [
  ['désignation absente', {}, { commentaires: [{ date: new Date(T - 30000).toISOString(),
    auteur: 'vito-sainte-marie', corps: '@claude fais le travail' }] }, 'DESIGNATION_ABSENTE'],
  ['CI rouge', {}, { verifications: [{ nom: 'Tests', conclusion: 'failure' }] }, 'CI_NON_VERTE'],
  ['CI non mesurée', {}, { verifications: null }, 'CI_NON_MESUREE'],
  ['un `skipped` n’est pas un `success`', {}, { verifications: [{ nom: 'Tests', conclusion: 'skipped' }] }, 'CI_NON_VERTE'],
  ['le rail et la branche ont divergé', { railEstAncetre: 1, baseEstAncetreDuRail: 1 }, {}, 'DIVERGENCE'],
  ['le rail a avancé depuis le départ du run', { railEstAncetre: 1, baseEstAncetreDuRail: 0 }, {}, 'SHA_BASE_PERIME'],
  ['une ascendance non mesurée ne vaut pas une divergence', { railEstAncetre: 128 }, {}, 'ASCENDANCE_NON_MESUREE'],
  ['une base dont l’ascendance est muette ne conclut pas', { railEstAncetre: 1, baseEstAncetreDuRail: 128 }, {}, 'ASCENDANCE_NON_MESUREE'],
  ['lot non rattachable', {}, { analyse: { lots: [{ lot: LOT, refs_reelles: { memes: [], homonymes: [] } }] } }, 'LOT_NON_RATTACHABLE'],
  ['un homonyme parlerait pour le lot', {}, { analyse: { lots: [{ lot: LOT, refs_reelles: { memes: [], homonymes: [`origin/${BRANCHE}`] } }] } }, 'LOT_AMBIGU'],
  ['sentinelle Production', { nameStatus: 'M\t.github/workflows/deploiement-production.yml',
    numstat: '1\t0\t.github/workflows/deploiement-production.yml',
    unified: 'diff --git a/.github/workflows/deploiement-production.yml b/.github/workflows/deploiement-production.yml\n--- a/.github/workflows/deploiement-production.yml\n+++ b/.github/workflows/deploiement-production.yml\n@@ -1 +1 @@\n+  on: push' }, {}, 'CHANGEMENT_PRODUCTION'],
  ['cible Production introduite', { unified: DIFF_SIMPLE.replace('+const a = 1;', '+const url = "https://app.nexusconseil.net/";'),
    contenus: { 'outils/x.js': 'const url = "https://app.nexusconseil.net/";' } }, {}, 'CHANGEMENT_PRODUCTION'],
  ['garde affaiblie par une ligne ajoutée', { unified: DIFF_SIMPLE.replace('+const a = 1;', '+node outils/garde-x.js || true') },
    {}, 'GARDE_AFFAIBLIE'],
  ['garde supprimée', { nameStatus: 'D\toutils/garde-branches-en-rade.js',
    numstat: '0\t10\toutils/garde-branches-en-rade.js',
    unified: 'diff --git a/outils/garde-branches-en-rade.js b/outils/garde-branches-en-rade.js\n--- a/outils/garde-branches-en-rade.js\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-const x = 1;' },
    {}, 'GARDE_AFFAIBLIE'],
];
for (const [nom, sur, options, code] of refus) {
  verifier(`${nom} → ${code}, et rien n’est poussé`, () => {
    const { r, d } = lancer(sur, { ...options, transporter: true });
    assert.strictEqual(r.code, code, `état rendu : ${r.etat}/${r.code} — ${r.motif}`);
    assert.strictEqual(d.pousses().length, 0, 'un refus qui pousse quand même n’est pas un refus');
  });
}

verifier('un secret est dénoncé sans être reproduit', () => {
  const valeur = 'ghp_' + 'z'.repeat(36);
  const { r, d } = lancer({ unified: DIFF_SIMPLE.replace('+const a = 1;', `+const jeton = "${valeur}";`) },
    { transporter: true });
  assert.strictEqual(r.code, 'SECRET_DETECTE');
  assert.ok(!JSON.stringify(r).includes(valeur),
    'un détecteur qui cite ce qu’il a trouvé publie le secret qu’il dénonce');
  assert.strictEqual(d.pousses().length, 0);
});

verifier('un rail interdit est refusé avant toute observation', () => {
  const { r, d } = lancer({}, { rail: 'production', commentaires: [], autorites: ['production'], transporter: true });
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'RAIL_INTERDIT');
  assert.strictEqual(d.appels.filter((c) => c.startsWith('git ')).length, 0,
    'on ne va pas interroger git pour une destination qu’on refuse par principe');
});

verifier('deux lots rattachés à la même branche → LOT_AMBIGU, rien n’est poussé', () => {
  const { r, d } = lancer({}, { transporter: true, analyse: { lots: [
    { lot: 'LOT-A', refs_reelles: { memes: [`origin/${BRANCHE}`], homonymes: [] } },
    { lot: 'LOT-B', refs_reelles: { memes: [`origin/${BRANCHE}`], homonymes: [] } },
  ] } });
  assert.strictEqual(r.code, 'LOT_AMBIGU');
  assert.strictEqual(d.pousses().length, 0);
});

verifier('une branche identique au rail se repose, elle n’échoue pas', () => {
  const { r, d } = lancer({ head: RAIL_SHA }, { transporter: true });
  assert.strictEqual(r.etat, 'NO_WORK');
  assert.strictEqual(r.code, 'RIEN_A_RAPATRIER');
  assert.strictEqual(codeSortie(r), 0, 'un repos légitime ne rougit pas la CI');
  assert.strictEqual(d.pousses().length, 0);
});

console.log('\n── D. LE GESTE, ET SA RELECTURE ────────────────────────────────────');

verifier('sans --transporter, la qualification ne touche à rien', () => {
  const { r, d } = lancer({}, {});
  assert.strictEqual(r.etat, 'EXECUTE');
  assert.strictEqual(r.code, 'QUALIFIE_NON_TRANSPORTE');
  assert.strictEqual(d.pousses().length, 0, 'un outil qui écrit par défaut écrit un jour là où personne ne l’a lu');
});

verifier('le transport est une avance rapide nommée, jamais un --force', () => {
  const { r, d } = lancer({}, { transporter: true });
  assert.strictEqual(r.etat, 'EXECUTE');
  assert.strictEqual(r.code, 'TRANSPORTE');
  assert.deepStrictEqual(d.pousses(), [`git push origin ${HEAD}:refs/heads/${RAIL}`]);
  assert.ok(!d.pousses()[0].includes('--force') && !d.pousses()[0].includes('-f '),
    'aucune reprise en force ne doit pouvoir s’écrire ici');
});

verifier('la destination est RELUE après le geste', () => {
  const { d } = lancer({}, { transporter: true });
  const rang = (motif) => d.appels.findIndex((c) => c.startsWith(motif));
  assert.ok(rang('git ls-remote') > rang('git push'),
    'un push qui rend 0 dit que la commande s’est bien passée, pas que la branche porte ce SHA');
});

// ── LA PHRASE QUI MENTAIT — la réparation du 02/10/2026 ──────────────────────
//
// Mesuré ce jour-là : `prochaine_action` affirmait « la CI du rail reprend la
// chaîne » après un transport réussi. Faux à chaque transport, pas seulement
// parfois — ce push est authentifié par `github.token` (remote posé par
// `actions/checkout`, aucun jeton personnel ni PAT en jeu), et GitHub
// n'enchaîne pas de nouveau run sur un push authentifié ainsi, sans exception.
// La recette navigateur connectée (gardée par `NEXUS_REF_EST_LE_RAIL`) ne
// pouvait donc jamais juger un commit rapatrié par ce seul geste — et rien ne
// le disait : un succès affiché à la place d'un silence.
verifier('un transport réussi ne prétend plus que la CI du rail va reprendre seule', () => {
  const { r } = lancer({}, { transporter: true });
  assert.strictEqual(r.code, 'TRANSPORTE');
  assert.ok(!/\breprend la chaîne\b/i.test(r.prochaine_action),
    'cette affirmation est fausse : github.token n’enchaîne aucun nouveau run sur ce push');
  assert.ok(/github\.token/.test(r.prochaine_action) && /N'ENCHAÎNE PAS|n'enchaîne pas/i.test(r.prochaine_action),
    'la vraie contrainte de plateforme doit être nommée, pas seulement retirée');
  assert.ok(/workflow_dispatch|workflow run/i.test(r.prochaine_action),
    'le geste humain qui débloque réellement la recette connectée doit être nommé');
  assert.strictEqual(r.details.continuation_automatique, false,
    'un lecteur programmatique doit pouvoir le vérifier sans relire la prose');
});

verifier('origin qui refuse l’avance rapide rougit franchement', () => {
  const { r } = lancer({ pushCode: 1 }, { transporter: true });
  assert.strictEqual(r.etat, 'FAILED');
  assert.strictEqual(r.code, 'TRANSPORT_REFUSE_PAR_ORIGIN');
  assert.strictEqual(codeSortie(r), 1);
});

verifier('une destination qui dit autre chose que le geste a raison', () => {
  const { r } = lancer({ relu: 'cccccccccccccccccccccccccccccccccccccccc' }, { transporter: true });
  assert.strictEqual(r.etat, 'FAILED');
  assert.strictEqual(r.code, 'DESTINATION_NON_VERIFIEE');
  assert.strictEqual(r.details.sha_attendu, HEAD);
  assert.strictEqual(r.details.sha_relu, 'cccccccccccccccccccccccccccccccccccccccc');
});

verifier('une destination vide après transport est un échec, pas un succès', () => {
  const { r } = lancer({ relu: '' }, { transporter: true });
  assert.strictEqual(r.code, 'DESTINATION_NON_VERIFIEE');
});

console.log('\n── E. AUCUN REFUS SILENCIEUX ───────────────────────────────────────');

verifier('tout état rendu appartient au vocabulaire fermé', () => {
  const cas = [
    lancer({}, { transporter: true }).r,
    lancer({}, {}).r,
    lancer({ head: RAIL_SHA }, {}).r,
    lancer({ pushCode: 1 }, { transporter: true }).r,
    lancer({}, { verifications: [{ nom: 'T', conclusion: 'failure' }] }).r,
    lancer({}, { commentaires: [] }).r,
  ];
  for (const r of cas) {
    assert.ok(ETATS.includes(r.etat), `état hors vocabulaire : ${r.etat}`);
    assert.strictEqual(typeof r.code, 'string');
    assert.ok(r.code.length > 0);
  }
});

verifier('un état qui arrête la chaîne nomme condition, SHA, branche, lot et suite', () => {
  const arrets = [
    lancer({}, { verifications: [{ nom: 'T', conclusion: 'failure' }], transporter: true }).r,
    lancer({}, { commentaires: [], transporter: true }).r,
    lancer({ pushCode: 1 }, { transporter: true }).r,
    lancer({ relu: 'c'.repeat(40) }, { transporter: true }).r,
  ];
  for (const r of arrets) {
    for (const champ of ['condition', 'sha', 'branche', 'lot', 'maillon', 'prochaine_action']) {
      assert.ok(r[champ] && String(r[champ]).trim().length > 0,
        `${r.etat}/${r.code} ne dit pas « ${champ} »`);
    }
  }
});

verifier('seul FAILED rougit la CI ; BLOCKED se voit sans casser le run', () => {
  assert.strictEqual(codeSortie(lancer({ pushCode: 1 }, { transporter: true }).r), 1);
  assert.strictEqual(codeSortie(lancer({}, { commentaires: [] }).r), 0);
  assert.strictEqual(codeSortie(lancer({}, {}).r), 0);
});


// ── L'EXÉCUTEUR RÉEL, ET LE MUR QUI SE TAISAIT ──────────────────────────────
// Toutes les épreuves ci-dessus injectent un faux exécuteur : c'est ce qui les
// rend hermétiques, et c'est aussi ce qui les a rendues aveugles. Le 30/09/2026
// les 37 épreuves étaient vertes pendant que le mécanisme, lancé pour de vrai,
// refusait trois branches sur trois pour un motif faux — `execFileSync`
// s'arrêtait à 1 Mio, et cette panne prenait la forme d'un simple « non ».
// Les deux épreuves qui suivent exécutent donc l'exécuteur RÉEL. Elles
// n'appellent ni `gh` ni le réseau : un `node -e` suffit à produire un flot
// plus gros que l'ancien tampon, ce qui les rend déterministes partout.
// ── QUEL COMMIT, ET D’OÙ ────────────────────────────────────────────────────
// Le 30/09/2026, les trois branches réelles ont franchi le refus de désignation
// puis buté sur HEAD_INCONNU : lancé depuis un poste, « claude/issue-… » n'existe
// que sous `origin/`, et `rev-parse` échouait. Le mécanisme déclarait donc
// inconnu un HEAD parfaitement connu. Les trois épreuves ci-dessous tiennent les
// trois cas, y compris celui où le nom désigne deux commits.
console.log('\n── A-bis. QUEL COMMIT, ET D’OÙ ─────────────────────────────────────');

verifier('en CI la ref locale est retenue, et elle est nommée', () => {
  const d = depot();
  const e = observer({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(e.head, HEAD);
  assert.strictEqual(e.refHead, `refs/heads/${BRANCHE}`,
    'le dossier doit dire d’où vient le commit transporté, pas seulement lequel');
});

verifier('hors CI, la ref distante sert de repli — sans être devinée', () => {
  const d = depot({ refLocale: null, refDistante: HEAD });
  const e = observer({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(e.head, HEAD, 'une branche absente en local reste transportable');
  assert.strictEqual(e.refHead, `refs/remotes/origin/${BRANCHE}`);
});

verifier('un nom qui désigne deux commits est refusé, jamais arbitré', () => {
  const autre = 'c'.repeat(40);
  const d = depot({ refLocale: HEAD, refDistante: autre });
  const r = rapatrier({ exec: d.exec, branche: BRANCHE, commentaires: declencheur,
    analyse: ANALYSE, verifications: [], fetch: false });
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'HEAD_AMBIGU');
  assert.ok(!d.appels.some((a) => a.startsWith('git push')),
    'aucun des deux commits ne doit partir');
});

console.log('\nL’exécuteur réel — ce qu’un faux exécuteur ne peut pas mesurer');

verifier('un flot plus gros que l’ancien tampon d’1 Mio est lu en entier', () => {
  const exec = executeurReel();
  const octets = 3 * 1024 * 1024;
  const r = exec(process.execPath, ['-e', `process.stdout.write('x'.repeat(${octets}))`]);
  assert.strictEqual(r.code, 0,
    `la lecture a échoué (${r.erreur || 'sans message'}) : le tampon est trop petit`);
  assert.strictEqual(r.sortie.length, octets);
  assert.ok(!r.tronque, 'une lecture complète ne doit pas se déclarer tronquée');
});

verifier('un débordement se nomme, au lieu de ressembler à un échec ordinaire', () => {
  // Avec un tampon volontairement minuscule, on force le mur. Ce qui compte
  // n'est pas que ça échoue — c'est que l'échec SE DISE, sans quoi l'appelant
  // le confondrait avec un `gh` ayant répondu « non ».
  const exec = executeurReel();
  const r = exec(process.execPath, ['-e', "process.stdout.write('x'.repeat(4096))"], { maxBuffer: 16 });
  assert.notStrictEqual(r.code, 0);
  assert.strictEqual(r.tronque, true,
    'un débordement muet redeviendrait indiscernable d’une réponse négative');
});

verifier('un corpus illisible ne fait pas conclure la qualification', () => {
  // Le bout en bout du défaut : lecture impossible → `null` → refus pour
  // absence de MESURE, et non pour absence de déclencheur.
  const r = rapatrier({
    branche: BRANCHE, depot: 'vito-sainte-marie/nexus-vito',
    exec: (commande, args) => (commande === 'gh'
      ? { code: 1, sortie: '', erreur: 'spawnSync gh ENOBUFS', tronque: true }
      : { code: 0, sortie: '' }),
  });
  assert.strictEqual(r.etat, 'BLOCKED');
  assert.strictEqual(r.code, 'CORPUS_NON_MESURE',
    `refuser en ${r.code} affirmerait une absence jamais mesurée`);
  assert.ok(!/introuvable/i.test(String(r.motif)),
    'le motif ne doit pas dire « introuvable » : rien n’a été cherché');
});

console.log(`\n${echecs.length === 0 ? '✅' : '❌'} ${reussites} réussite(s), ${echecs.length} échec(s)\n`);
process.exit(echecs.length === 0 ? 0 : 1);
