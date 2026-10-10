// Stade (a) de l'arbitrage autonome — 09/10/2026, AUTORISÉ PAR FRÉDÉRIC
// BRAGANCE (« autorise le stade (a) »).
//
// `outils/materialiser-decision-ci.js` lit la réponse de l'arbitre et compose
// le corps de `decision-N`. Il ne doit matérialiser QUE la demande que le
// registre attend, sur un rail Handoff, et jamais depuis un code qui tient un
// jeton. Aucune épreuve ne touche le réseau ni git.
//
// Depuis le 10/10/2026, il doit aussi refuser ce que `request-1.md` du lot
// ARMEMENT-ARBITRAGE-AUTONOME-1-20261008 annonçait sans que personne ne le
// code : un `RAIL_LU` qui ne prouve pas la lecture du rail, et un verdict qui
// revient à un humain. La forme réelle de `RAIL_LU` — hors du contrat, juste
// avant lui — est mesurée sur les deux décisions authentiques du dépôt (M17) :
// une garde calibrée sur un contrat imaginaire aurait tout refusé.
//
// Mutation : on débranche tour à tour `valider`, `lectureDuRail` et
// `relaieUnHumain` dans une copie de l'outil ; ce que la garde refusait doit
// alors passer, et l'épreuve qui le refuse rougir.
//
// Et parce qu'une garde non APPELÉE ne garde rien, M19 et M20 jugent le
// câblage du workflow lui-même — par mutation du câblage, et en exécutant
// pour de vrai le chemin du code 4.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const RACINE = __dirname;
const OUTIL = path.join(RACINE, 'outils', 'materialiser-decision-ci.js');
const LOT = 'LOT-EPREUVE-MATERIALISATION-20261009';
const REQ = 'request-2.md';
const RAIL = 'handoff-continuite-20260920';
const APPEL_VALIDER = '  const v = valider(texte, { lot, request });\n';

// Les deux SHA que la CI passe : par défaut l'arbitre a lu le rail, et le rail
// n'a pas bougé pendant le run. Chaque épreuve ne défait que ce qu'elle mesure.
const SHA = 'c41867f1d2b3a49e8f05c6d7e8a9b0c1d2e3f405';
const SHA_COURT = SHA.slice(0, 7);
const AUTRE_SHA = '7506f635d35fc19d825bdac1a8b55019a7a270c9';
const O = (o = {}) => ({ shaDuRun: SHA, shaDuRail: SHA, ...o });

// Les épreuves antérieures au 10/10/2026 n'avaient pas à connaître les SHA :
// le wrapper les fournit comme la CI, et chacune peut encore les défaire.
const jg = (t, e, o) => m.juger(t, e, O(o));

let echecs = 0, total = 0;
function epreuve(nom, fn) {
  total++;
  try { fn(); console.log(`ok   ${nom}`); }
  catch (e) { echecs++; console.log(`FAIL ${nom}\n     ${String(e.message).split('\n').join('\n     ')}`); }
}

// `railLu` est écrit AVANT la ligne `NEXT_ACTION_CONTRACT`, là où le réveil le
// demande et où les décisions réelles le portent. `null` : pas de ligne du tout.
function contrat(champs, railLu = SHA) {
  const c = { DECISION: 'APPROVED', CLOSES: 'true', LOT, REQUEST: REQ, HEAD: SHA_COURT, LEASE: 'aucun',
    GATE_STATE: 'GREEN', PROOF_STATE: 'PROOF_VALID', CONDITIONS: 'aucune', BLOCKER: 'aucun',
    STOP_REQUIRED: 'aucun', CAPACITE_REQUISE: 'aucune',
    OWNER_NEXT: 'Claude', EXECUTANT_NEXT: 'github-actions-claude',
    ACTION_NEXT: 'matérialiser la décision', ...champs };
  return 'Analyse de l\'arbitre.\n\n' + (railLu === null ? '' : `RAIL_LU: ${railLu}\n\n`) + 'NEXT_ACTION_CONTRACT\n' +
    Object.entries(c).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
}
function etat(fiche) {
  return { lots: { [LOT]: { statut: 'ATTENTE_DECISION', derniere_demande: REQ, rail: RAIL, ...fiche } } };
}

function charger(fichier) {
  delete require.cache[require.resolve(fichier)];
  return require(fichier);
}
let m = charger(OUTIL);

epreuve('M1 — la demande attendue, sur le rail du run : matérialisable', () => {
  const j = jg(contrat({}), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 0, JSON.stringify(j.refus));
  assert.deepStrictEqual([j.lot, j.request, j.decision, j.closes, j.rail], [LOT, REQ, 'APPROVED', 'true', RAIL]);
});

epreuve('M2 — un contrat non conforme est refusé (2) avant tout regard au registre', () => {
  const j = jg(contrat({ DECISION: 'GO' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2);
  assert.ok(j.refus.some(x => /hors vocabulaire/.test(x)), j.refus.join(' / '));
  assert.strictEqual(jg('pas de contrat', etat({}), {}).code, 2);
});

epreuve('M3 — la mention qui relance Claude est refusée', () => {
  const j = jg(contrat({ ACTION_NEXT: '@claude matérialise' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2, JSON.stringify(j));
});

epreuve('M4 — une autre demande que celle du registre : refus (2) si attendue, rien à faire (3) sinon', () => {
  const j = jg(contrat({ REQUEST: 'request-1.md' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2, JSON.stringify(j));
  assert.ok(j.refus.some(x => /attend une décision sur request-2\.md/.test(x)), j.refus.join(' / '));
  const k = jg(contrat({ REQUEST: 'request-1.md' }), etat({ statut: 'DECISION_CONSOMMEE' }), { railDuRun: RAIL });
  assert.strictEqual(k.code, 3, JSON.stringify(k));
});

epreuve('M5 — un lot déjà consommé ou déjà répondu : rien à faire (3)', () => {
  assert.strictEqual(jg(contrat({}), etat({ statut: 'DECISION_CONSOMMEE' }), { railDuRun: RAIL }).code, 3);
  const j = jg(contrat({}), etat({}), { railDuRun: RAIL, repondues: l => (l === LOT ? [REQ] : []) });
  assert.strictEqual(j.code, 3, JSON.stringify(j));
});

epreuve('M6 — un lot inconnu du registre : refus (2)', () => {
  assert.strictEqual(jg(contrat({}), { lots: {} }, { railDuRun: RAIL }).code, 2);
});

epreuve('M7 — la CI n\'écrit que sur un rail handoff-*, jamais main ni production', () => {
  for (const rail of ['main', 'production', 'config-par-environnement', 'claude/run-1', '', undefined]) {
    const j = jg(contrat({}), etat({ rail }), { railDuRun: rail });
    assert.strictEqual(j.code, 2, `rail ${JSON.stringify(rail)} accepté`);
  }
});

epreuve('M8 — le run doit porter le rail du lot', () => {
  const j = jg(contrat({}), etat({}), { railDuRun: 'handoff-autre-20261009' });
  assert.strictEqual(j.code, 2);
  assert.ok(j.refus.some(x => /le lot vit sur/.test(x)), j.refus.join(' / '));
});

epreuve('M9 — le corps reproduit le verdict tel quel et dit ce qui n\'a PAS été contrôlé', () => {
  const texte = contrat({ CONDITIONS: 'recette Test verte avant tout déploiement' });
  const j = jg(texte, etat({}), { railDuRun: RAIL });
  const c = m.corps(texte, j, { run: '123', commentaire: 'https://example.invalid/c/1' });
  assert.ok(c.startsWith(`# Décision sur ${REQ} — APPROVED, lot clos\n`), c.split('\n')[0]);
  assert.ok(c.includes(texte.trimEnd()), 'le texte de l\'arbitre doit être reproduit intégralement');
  assert.ok(/## Ce que la CI n'a PAS contrôlé/.test(c), 'section des limites absente');
  assert.ok(c.includes('recette Test verte avant tout déploiement'), 'les conditions doivent être citées comme non contrôlées');
  assert.ok(/ne relance ni la CI ni Claude/.test(c), 'la limite du jeton du workflow doit être dite');
  assert.ok(c.includes('run 123'), 'provenance du run absente');
  assert.ok(c.includes(`\`RAIL_LU\` = \`${SHA}\``), 'le corps doit dire quelle lecture du rail a été contrôlée');
  assert.ok(/Aucun palier humain/.test(c), 'le corps doit dire qu\'aucun palier humain n\'a été franchi');
});

epreuve('M10 — l\'outil n\'a aucune voie vers GitHub ni vers git', () => {
  const src = fs.readFileSync(OUTIL, 'utf8').split('\n').filter(x => !/^\s*\/\//.test(x)).join('\n');
  assert.ok(!/child_process|GH_TOKEN|GITHUB_TOKEN|\bgh\b|fetch\(|https?:/.test(src),
    'l\'outil qui lit le texte de l\'arbitre ne doit disposer d\'aucune voie réseau');
});

epreuve('M11 — en CLI, sur le registre réel, un lot clos ne se rematérialise pas (3, rien écrit)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialiser-'));
  const rep = path.join(dir, 'reponse.txt'), sortie = path.join(dir, 'corps.md');
  fs.writeFileSync(rep, contrat({ LOT: 'FAST-TRACK-ROUTAGE-CAPACITES-1-20261009', REQUEST: 'request-1.md' }));
  const r = spawnSync(process.execPath, [OUTIL, '--reponse', rep, '--sortie', sortie, '--rail-du-run', RAIL], { encoding: 'utf8' });
  assert.strictEqual(r.status, 3, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(sortie), 'un refus ne doit rien écrire');
  assert.ok(JSON.parse(r.stdout).refus.length > 0);
});

// ── La lecture du rail doit être prouvée ────────────────────────────────

epreuve('M12 — sans `RAIL_LU`, rien ne se matérialise : la lecture du rail n\'est pas prouvée', () => {
  const j = jg(contrat({}, null), etat({}), { railDuRun: RAIL });
  assert.strictEqual(j.code, 2, JSON.stringify(j.refus));
  assert.ok(/RAIL_LU absent/.test(j.refus.join(' ')), JSON.stringify(j.refus));
});

epreuve('M13 — un `RAIL_LU` ou un `HEAD` qui n\'est pas le SHA du run : refus (2)', () => {
  const a = jg(contrat({}, AUTRE_SHA), etat({}), { railDuRun: RAIL });
  assert.strictEqual(a.code, 2, JSON.stringify(a.refus));
  assert.ok(/RAIL_LU/.test(a.refus.join(' ')) && /n'a pas lu le corps arbitré/.test(a.refus.join(' ')), JSON.stringify(a.refus));
  const b = jg(contrat({ HEAD: AUTRE_SHA }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(b.code, 2, JSON.stringify(b.refus));
  assert.ok(/^HEAD /.test(b.refus.join(' ')), JSON.stringify(b.refus));
  const c = jg(contrat({ HEAD: 'pas-un-sha' }), etat({}), { railDuRun: RAIL });
  assert.strictEqual(c.code, 2, JSON.stringify(c.refus));
  assert.ok(/ni un SHA ni INACCESSIBLE/.test(c.refus.join(' ')), JSON.stringify(c.refus));
});

epreuve('M14 — `INACCESSIBLE` n\'est admis que si le run EST la tête du rail', () => {
  const t = contrat({ HEAD: 'INACCESSIBLE' }, 'INACCESSIBLE');
  assert.strictEqual(jg(t, etat({}), { railDuRun: RAIL }).code, 0,
    'relais intégral, rail immobile : le substitut de decision-2.md tient');
  const bouge = jg(t, etat({}), { railDuRun: RAIL, shaDuRail: AUTRE_SHA });
  assert.strictEqual(bouge.code, 2, JSON.stringify(bouge.refus));
  assert.ok(/le substitut ne tient pas/.test(bouge.refus.join(' ')), JSON.stringify(bouge.refus));
});

epreuve('M15 — sans SHA fournis, la garde se ferme : une garde qui s\'efface ne garde rien', () => {
  for (const t of [contrat({}), contrat({ HEAD: 'INACCESSIBLE' }, 'INACCESSIBLE')]) {
    const j = m.juger(t, etat({}), { railDuRun: RAIL });
    assert.strictEqual(j.code, 2, JSON.stringify(j.refus));
  }
  const partiel = m.juger(contrat({ HEAD: 'INACCESSIBLE' }, 'INACCESSIBLE'), etat({}),
    { railDuRun: RAIL, shaDuRun: SHA });
  assert.strictEqual(partiel.code, 2, 'la tête du rail manque : le substitut est incontrôlable');
});

epreuve('M16 — un SHA abrégé qui préfixe celui du run est admis', () => {
  assert.strictEqual(jg(contrat({ HEAD: SHA_COURT }, SHA), etat({}), { railDuRun: RAIL }).code, 0);
  assert.strictEqual(jg(contrat({ HEAD: SHA }, SHA_COURT), etat({}), { railDuRun: RAIL }).code, 0);
  assert.ok(!m.memeSha('', ''), 'deux vides ne sont pas le même commit');
  assert.ok(!m.memeSha(SHA_COURT, AUTRE_SHA.slice(0, 7)));
});

epreuve('M17 — la forme RÉELLE de `RAIL_LU` est lue : hors du contrat, et jamais la prose qui le cite', () => {
  const lots = path.join(RACINE, 'docs', 'handoff', 'lots', 'ARMEMENT-ARBITRAGE-AUTONOME-1-20261008');
  const attendu = { 'decision-1.md': '58369b99d196e956871166487cdfdd699e1597a8', 'decision-2.md': 'INACCESSIBLE' };
  for (const [f, v] of Object.entries(attendu)) {
    const chemin = path.join(lots, f);
    if (!fs.existsSync(chemin)) throw new Error(`${f} absent : la calibration ne peut pas être mesurée`);
    const texte = fs.readFileSync(chemin, 'utf8');
    assert.ok(texte.indexOf('RAIL_LU:') < texte.lastIndexOf('NEXT_ACTION_CONTRACT'),
      `${f} : RAIL_LU doit être AVANT le contrat, sinon l'épreuve ne mesure plus la forme réelle`);
    assert.strictEqual(m.lireRailLu(texte), v, f);
  }
  assert.strictEqual(m.lireRailLu('- `RAIL_LU: INACCESSIBLE` était attendu, puisque le corps…'), null,
    'une phrase qui cite le champ n\'est pas une valeur');
});

// ── Un verdict qui demande un humain reste à un humain ──────────────────

epreuve('M18 — BLOCKED, `OWNER_NEXT: Frédéric` ou un `STOP_REQUIRED` : code 4, rien n\'est déposé', () => {
  const cas = [
    ['DECISION BLOCKED', contrat({ DECISION: 'BLOCKED', CLOSES: 'false' })],
    ['OWNER_NEXT Frédéric', contrat({ DECISION: 'BLOCKED', CLOSES: 'false', OWNER_NEXT: 'Frédéric',
      STOP_REQUIRED: 'SECRET_PERMISSION_SURFACE_SECURITE', EXECUTANT_NEXT: 'Frédéric' })],
    ['STOP_REQUIRED renseigné', contrat({ STOP_REQUIRED: 'PREUVE_OBLIGATOIRE_IMPOSSIBLE' })],
  ];
  for (const [nom, t] of cas) {
    const j = jg(t, etat({}), { railDuRun: RAIL });
    assert.strictEqual(j.code, 4, `${nom} : ${JSON.stringify(j.refus)}`);
    assert.ok(/reste à un humain/.test(j.refus.join(' ')), `${nom} : ${JSON.stringify(j.refus)}`);
    assert.strictEqual(j.contrat, undefined, `${nom} : aucun corps ne doit être composable`);
    // `etat-maillon.js` exige `--lot` pour tout état qui arrête la chaîne : un
    // palier humain qui ne nomme pas son lot n'est pas actionnable.
    assert.strictEqual(j.lot, LOT, `${nom} : le palier humain doit nommer son lot`);
    assert.strictEqual(j.request, REQ, `${nom} : et la demande arbitrée`);
  }
  assert.strictEqual(jg(contrat({ STOP_REQUIRED: 'non' }), etat({}), { railDuRun: RAIL }).code, 0,
    '« non » et « aucun » ne sont pas des motifs d\'arrêt');
});


// ── Le câblage : une garde non appelée ne garde rien ─────────────────────
// `test_cablage_maillons_20260930.js` vérifie qu'un arrêt publié porte ses six
// champs — il l'a prouvé sur le `palier` ajouté ici. Il ne sait rien, en
// revanche, des DEUX SHA que la garde compare : sans eux la garde se ferme
// (M15), la boucle s'arrête, et la cause serait cherchée dans l'outil.
//
// Le câblage est jugé par une fonction, pas par des `includes` dispersés :
// c'est ce qui permet de le MUTER, donc de savoir ce que cette épreuve
// attraperait.
const ETAPE_STADE_A = 'Réveil Orchestrateur — matérialisation de la décision (stade a)';

function etapeDuWorkflow(nom) {
  const l = fs.readFileSync(path.join(RACINE, '.github', 'workflows', 'tests.yml'), 'utf8').split('\n');
  const debuts = l.reduce((a, x, i) => (/^\s{6}- name:/.test(x) ? a.concat(i) : a), []);
  for (let d = 0; d < debuts.length; d++) {
    if (!l[debuts[d]].includes(nom)) continue;
    return l.slice(debuts[d], d + 1 < debuts.length ? debuts[d + 1] : l.length).join('\n');
  }
  return null;
}

function cablageDuStadeA(etape) {
  const refus = [];
  const recolle = String(etape || '').replace(/\\\n\s*/g, ' ');
  const appel = recolle.split('\n').find(x => x.includes('node outils/materialiser-decision-ci.js')) || '';
  if (!/--sha-du-run "\$\{GITHUB_SHA:-\}"/.test(appel)) {
    refus.push('le SHA du run n\'est pas passé : la garde ne peut pas comparer, elle se fermera');
  }
  if (!/--sha-du-rail "\$TETE_RAIL"/.test(appel)) refus.push('la tête du rail n\'est pas passée');
  // La tête du rail se lit DANS le worktree du rail, après `cd "$WT"` : lue
  // avant, ce serait le SHA du run sous un autre nom, et le substitut
  // d'`INACCESSIBLE` se vérifierait contre lui-même.
  const cd = recolle.indexOf('cd "$WT"');
  const lecture = recolle.indexOf('TETE_RAIL=$(git rev-parse HEAD)');
  if (lecture < 0) refus.push('`TETE_RAIL` ne vient pas de `git rev-parse HEAD`');
  else if (cd < 0 || lecture < cd) refus.push('la tête du rail est lue hors du worktree du rail : ce serait le SHA du run');
  // Le code 4 doit être routé AVANT le `echec` qui attrape tout le reste,
  // sinon un verdict correct rougirait la CI — et on apprendrait à ignorer
  // le rouge, exactement le défaut qu'`etat-maillon.js` supprime.
  const quatre = recolle.indexOf('[ "$CODE" = "4" ]');
  const attrapeTout = recolle.indexOf('echec CONTRAT_NON_MATERIALISABLE');
  if (quatre < 0) refus.push('le code 4 n\'est pas routé : un verdict réservé à un humain serait déposé ou rougirait');
  else if (attrapeTout >= 0 && quatre > attrapeTout) refus.push('le code 4 est routé après le refus attrape-tout : trop tard');
  const branche = quatre < 0 ? '' : recolle.slice(quatre, attrapeTout < 0 ? recolle.length : attrapeTout);
  if (branche && !/palier DECISION_RESERVEE_A_UN_HUMAIN/.test(branche)) {
    refus.push('le code 4 ne publie pas de palier humain');
  }
  if (branche && /echec /.test(branche)) refus.push('le code 4 rougit la CI : le verdict est juste, ce n\'est pas une panne');
  // `decision-1.md:54` retient « aucune consommation automatique » comme
  // condition de son avis favorable, et `request-1.md:124` l'écrit. Une
  // condition retenue n'est un contrôle que si du code la tient (GOV-007) :
  // c'est ici, et nulle part ailleurs, qu'on la tient.
  if (/handoff\.js consommer/.test(recolle)) {
    refus.push('la CI consomme la décision : `decision-1.md:54` retient « aucune consommation automatique »');
  }
  return refus;
}

epreuve('M19 — la CI passe les deux SHA et route le code 4 : une garde non appelée ne garde rien', () => {
  const etape = etapeDuWorkflow(ETAPE_STADE_A);
  assert.ok(etape, `l'étape « ${ETAPE_STADE_A} » n'existe plus dans le workflow`);
  assert.deepStrictEqual(cablageDuStadeA(etape), [], 'le câblage du stade (a) est incomplet');
  // Mutations du CÂBLAGE, pas de l'outil : ce que cette épreuve attraperait.
  const mutations = [
    ['le SHA du rail retiré', e => e.replace('--sha-du-rail "$TETE_RAIL" ', '')],
    ['le SHA du run retiré', e => e.replace('--sha-du-run "${GITHUB_SHA:-}" ', '')],
    ['la tête du rail lue avant le worktree', e => e.replace('TETE_RAIL=$(git rev-parse HEAD)', 'TETE_RAIL=$GITHUB_SHA')],
    ['le code 4 non routé', e => e.replace('if [ "$CODE" = "4" ]; then', 'if false; then')],
    ['la consommation automatique remise', e => e.replace('if [ "$CLOSES" = "true" ]; then',
      'if [ "$CLOSES" = "true" ]; then\n            node outils/handoff.js consommer "$LOT"')],
  ];
  for (const [nom, muter] of mutations) {
    const mute = muter(etape);
    assert.notStrictEqual(mute, etape, `la mutation « ${nom} » n'a pas mordu : l'épreuve ne mesure rien`);
    assert.ok(cablageDuStadeA(mute).length > 0, `la mutation « ${nom} » passe : M19 ne la verrait pas`);
  }
});

epreuve('M20 — le chemin du code 4 s\'exécute : l\'outil, `jq`, puis un palier qui ne rougit pas', () => {
  // Bout en bout, sur une racine jetable : c'est le SEUL chemin du code 4 —
  // il sort avant git, avant le dépôt et avant le push.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialiser-cablage-'));
  fs.mkdirSync(path.join(dir, 'outils'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'handoff'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'outils', 'materialiser-decision-ci.js'),
    fs.readFileSync(OUTIL, 'utf8').replace("require('./relais-arbitre-openai')",
      `require(${JSON.stringify(path.join(RACINE, 'outils', 'relais-arbitre-openai.js'))})`));
  fs.writeFileSync(path.join(dir, 'docs', 'handoff', 'STATE.json'), JSON.stringify(etat({})));
  const rep = path.join(dir, 'reponse.txt'), sortie = path.join(dir, 'corps.md');
  fs.writeFileSync(rep, contrat({ DECISION: 'BLOCKED', CLOSES: 'false', OWNER_NEXT: 'Frédéric',
    STOP_REQUIRED: 'SECRET_PERMISSION_SURFACE_SECURITE', EXECUTANT_NEXT: 'Frédéric' }));
  const r = spawnSync(process.execPath, [path.join(dir, 'outils', 'materialiser-decision-ci.js'),
    '--reponse', rep, '--sortie', sortie, '--rail-du-run', RAIL,
    '--sha-du-run', SHA, '--sha-du-rail', SHA], { encoding: 'utf8' });
  assert.strictEqual(r.status, 4, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(sortie), 'un verdict réservé à un humain ne compose aucun corps');

  // `jq` est ce que le workflow exécute : mesurer un équivalent en JS
  // mesurerait autre chose. Le workflow en dépend déjà partout.
  const jq = spawnSync('jq', ['-r', '.lot // "(lot non lisible)"'], { input: r.stdout, encoding: 'utf8' });
  assert.ok(!jq.error, 'jq est absent alors que le workflow en dépend : le câblage ne peut pas être mesuré');
  assert.strictEqual(jq.stdout.trim(), LOT, 'le palier doit pouvoir nommer son lot : `jq` ne le lit pas');

  const pal = spawnSync(process.execPath, [path.join(RACINE, 'outils', 'etat-maillon.js'),
    'HUMAN_DECISION_REQUIRED', 'DECISION_RESERVEE_A_UN_HUMAIN', '--maillon', 'materialisation-decision',
    '--motif', r.stdout.trim(), '--condition', 'la décision de l\'arbitre ne franchit aucun palier humain',
    '--prochaine-action', 'Frédéric tranche', '--sha', SHA, '--branche', RAIL, '--lot', LOT],
    { encoding: 'utf8' });
  assert.strictEqual(pal.status, 0, `un verdict juste ne doit pas rougir la CI : ${pal.stdout}${pal.stderr}`);
  assert.ok(/HUMAN_DECISION_REQUIRED/.test(pal.stdout), 'l\'arrêt doit être publié, pas tu');
  assert.ok(/reste à un humain/.test(pal.stdout), 'et dire pourquoi : le motif porte le refus de l\'outil');
});

// ── Mutations : débrancher chaque garde, une par une ────────────────────
// Un `replace` muet rend un faux « la garde est utile » : l'ancre est comptée
// avant d'être remplacée, et l'épreuve meurt si elle n'a pas mordu.
function mutantDeLOutil(nom, ancre, remplacement) {
  const src = fs.readFileSync(OUTIL, 'utf8');
  assert.strictEqual(src.split(ancre).length, 2, `ancre de mutation non unique ou absente : ${nom}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `materialiser-mutant-${nom}-`));
  const cible = path.join(dir, 'materialiser-decision-ci.js');
  fs.writeFileSync(cible, src.replace(ancre, remplacement)
    .replace("require('./relais-arbitre-openai')",
      `require(${JSON.stringify(path.join(RACINE, 'outils', 'relais-arbitre-openai.js'))})`));
  return charger(cible);
}

epreuve('X1 — sans l\'appel à `valider`, un contrat non conforme passerait (l\'épreuve M2 mord)', () => {
  const mm = mutantDeLOutil('valider', APPEL_VALIDER, '  const v = { ok: true };\n');
  assert.strictEqual(mm.juger(contrat({ DECISION: 'GO' }), etat({}), O({ railDuRun: RAIL })).code, 0,
    'la mutation ne change rien : M2 ne mesurerait pas l\'appel à valider');
});

epreuve('X2 — sans `lectureDuRail`, un verdict rendu sur un autre rail passerait (M13 mord)', () => {
  const mm = mutantDeLOutil('lecture-du-rail',
    '  const sansPreuve = lectureDuRail(texte, c, opts);\n', '  const sansPreuve = [];\n');
  const t = contrat({ HEAD: AUTRE_SHA }, AUTRE_SHA);
  assert.strictEqual(jg(t, etat({}), O({ railDuRun: RAIL })).code, 2, 'témoin : la garde doit refuser');
  assert.strictEqual(mm.juger(t, etat({}), O({ railDuRun: RAIL })).code, 0,
    'la mutation ne change rien : M13 ne mesurerait pas la comparaison des SHA');
});

epreuve('X3 — sans `relaieUnHumain`, un BLOCKED se déposerait tout seul (M18 mord)', () => {
  const mm = mutantDeLOutil('palier-humain',
    '  const humain = relaieUnHumain(c);\n', '  const humain = [];\n');
  const t = contrat({ DECISION: 'BLOCKED', CLOSES: 'false' });
  assert.strictEqual(jg(t, etat({}), O({ railDuRun: RAIL })).code, 4, 'témoin : la garde doit rendre 4');
  assert.strictEqual(mm.juger(t, etat({}), O({ railDuRun: RAIL })).code, 0,
    'la mutation ne change rien : M18 ne mesurerait pas le palier humain');
});

console.log(`\n${total - echecs}/${total} épreuves passées`);
process.exit(echecs ? 1 : 0);
