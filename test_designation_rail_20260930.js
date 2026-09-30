'use strict';

/**
 * ÉPREUVE — LA DÉSIGNATION SE RETROUVE, ELLE NE SE DEVINE PAS.
 *
 * Ce que ces épreuves protègent tient en une phrase de la mémoire du dépôt :
 * « une désignation ne se recalcule pas ». Quatre défauts de septembre 2026
 * sont nés du même geste — dériver du contexte ambiant ce qu'un humain avait
 * désigné ailleurs. Le module `designation-rail.js` n'a donc aucun repli, et
 * la plupart des épreuves ci-dessous vérifient une ABSENCE : qu'il refuse là
 * où il serait commode de deviner.
 */

const assert = require('assert');
const { execFileSync } = require('child_process');
const D = require('./outils/designation-rail.js');

let echecs = 0;
let reussites = 0;
function verifier(nom, f) {
  try { f(); reussites += 1; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs += 1; console.log(`  ✗ ${nom}\n      ${e.message}`); }
}

const AUTEUR = 'vito-sainte-marie';
const RAIL = 'handoff-continuite-20260920';
const BRANCHE = 'claude/issue-28-20260930-1349';
// La minute nommée par la branche, en clair.
const T = Date.UTC(2026, 8, 30, 13, 49, 0);
const a = (secondes) => new Date(T + secondes * 1000).toISOString();

const commentaire = (secondes, corps, auteur = AUTEUR) =>
  ({ date: a(secondes), auteur, corps });
const avecRail = (r = RAIL) => `@claude NEXUS_BASE_BRANCH=${r}\nFais le travail.`;

console.log('\nGrammaire — toutes les formes que Frédéric écrit réellement');

verifier('« = », « : », espaces, backticks et guillemets sont tous lus', () => {
  const formes = [
    'NEXUS_BASE_BRANCH=handoff-x',
    'NEXUS_BASE_BRANCH =handoff-x',
    'NEXUS_BASE_BRANCH= handoff-x',
    'NEXUS_BASE_BRANCH = handoff-x',
    'NEXUS_BASE_BRANCH:handoff-x',
    'NEXUS_BASE_BRANCH : handoff-x',
    'NEXUS_BASE_BRANCH=`handoff-x`',
    'NEXUS_BASE_BRANCH="handoff-x"',
    "NEXUS_BASE_BRANCH='handoff-x'",
    '@claude merci de partir de NEXUS_BASE_BRANCH=handoff-x pour ce lot.',
  ];
  for (const f of formes) {
    assert.deepStrictEqual(D.designations(f), ['handoff-x'], `forme non lue : ${f}`);
  }
});

verifier('la même désignation répétée reste une seule désignation', () => {
  assert.deepStrictEqual(
    D.designations('NEXUS_BASE_BRANCH=handoff-x ... et encore NEXUS_BASE_BRANCH: `handoff-x`'),
    ['handoff-x'],
  );
});

verifier('deux désignations différentes sont toutes deux rendues visibles', () => {
  assert.deepStrictEqual(
    D.designations('NEXUS_BASE_BRANCH=handoff-x puis NEXUS_BASE_BRANCH=handoff-y'),
    ['handoff-x', 'handoff-y'],
  );
});

verifier('un texte sans désignation n’en invente pas', () => {
  assert.deepStrictEqual(D.designations('@claude continue sur le rail habituel'), []);
  assert.deepStrictEqual(D.designations(undefined), []);
});

verifier('le RegExp global ne garde pas son lastIndex d’un appel à l’autre', () => {
  // Un `RegExp` avec `g` réutilisé tel quel saute le premier résultat une fois
  // sur deux. Le défaut est silencieux : la désignation « disparaît » selon
  // l'ordre des appels.
  for (let i = 0; i < 3; i += 1) {
    assert.deepStrictEqual(D.designations('NEXUS_BASE_BRANCH=handoff-x'), ['handoff-x'],
      `appel n°${i + 1} : la désignation a disparu`);
  }
});

console.log('\nForme du rail — un rail protégé n’est pas un rail de travail');

verifier('« main » et « production » sont refusées comme rails', () => {
  assert.strictEqual(D.refusDeForme('main'), 'RAIL_INTERDIT');
  assert.strictEqual(D.refusDeForme('production'), 'RAIL_INTERDIT');
});

verifier('les noms malformés sont refusés', () => {
  for (const n of ['handoff-a..b', '/handoff-x', 'handoff-x/', 'feature-x', '']) {
    assert.strictEqual(D.refusDeForme(n), 'RAIL_MALFORME', `« ${n} » aurait dû être refusé`);
  }
});

verifier('les deux formes légitimes passent', () => {
  assert.strictEqual(D.refusDeForme(RAIL), null);
  assert.strictEqual(D.refusDeForme('config-par-environnement'), null);
});

console.log('\nÉpinglage — quel commentaire a déclenché ce run ?');

verifier('le déclencheur est le dernier commentaire avant le démarrage', () => {
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [
      commentaire(-7200, avecRail('handoff-vieux')),
      commentaire(-600, avecRail('handoff-moins-vieux')),
      commentaire(36, avecRail()),
    ],
  });
  assert.ok(!r.code, `refus inattendu : ${r.motif}`);
  assert.strictEqual(r.declencheur.date, a(36));
  assert.strictEqual(r.ecart_secondes, 36);
});

verifier('un commentaire postérieur au run ne peut pas l’avoir déclenché', () => {
  // La tolérance ne joue que vers l'avant, et de 120 s. À 300 s le commentaire
  // est postérieur au démarrage : l'épingler serait attribuer au run une
  // consigne qu'il n'a jamais lue.
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-40, avecRail()), commentaire(300, avecRail('handoff-apres'))],
  });
  assert.ok(!r.code, `refus inattendu : ${r.motif}`);
  assert.strictEqual(r.declencheur.date, a(-40));
});

verifier('un commentaire d’un autre auteur n’est pas un déclencheur', () => {
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [
      commentaire(-40, avecRail()),
      commentaire(10, avecRail('handoff-intrus'), 'github-actions[bot]'),
    ],
  });
  assert.ok(!r.code, `refus inattendu : ${r.motif}`);
  assert.strictEqual(r.declencheur.date, a(-40));
});

verifier('un texte sans « @claude » n’est pas un déclencheur', () => {
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [
      commentaire(-40, avecRail()),
      commentaire(10, `NEXUS_BASE_BRANCH=handoff-bavardage — juste une note.`),
    ],
  });
  assert.ok(!r.code, `refus inattendu : ${r.motif}`);
  assert.strictEqual(r.declencheur.date, a(-40));
});

verifier('une branche qui n’est pas une branche de run se refuse', () => {
  const r = D.epingler({ branche: 'handoff-continuite-20260920', commentaires: [] });
  assert.strictEqual(r.code, 'BRANCHE_NON_EPINGLABLE');
});

verifier('sans aucun déclencheur antérieur, on refuse au lieu de deviner', () => {
  const r = D.epingler({ branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: [] });
  assert.strictEqual(r.code, 'DECLENCHEUR_INTROUVABLE');
});

// ── LA DISTINCTION QUI A COÛTÉ TROIS FAUX REFUS ─────────────────────────────
// Le 30/09/2026, trois branches réelles ont été refusées pour
// DECLENCHEUR_INTROUVABLE alors que leurs déclencheurs existaient : la lecture
// des commentaires avait débordé du tampon d'`execFileSync`, rendu `null`, et
// `null` était devenu `[]` en chemin. Le module affirmait donc une absence
// qu'il n'avait jamais mesurée. Les deux épreuves ci-dessous tiennent les deux
// bords de la distinction : liste vide = mesure, absence de liste = pas de
// mesure. Aucune des deux ne peut passer sans l'autre.
verifier('une liste vide reste une mesure : elle conclut à l’absence', () => {
  const r = D.epingler({ branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: [] });
  assert.strictEqual(r.code, 'DECLENCHEUR_INTROUVABLE');
});

verifier('un corpus non lu ne conclut à rien', () => {
  for (const absent of [null, undefined]) {
    const r = D.epingler({ branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: absent });
    assert.strictEqual(r.code, 'CORPUS_NON_MESURE',
      `${String(absent)} doit refuser faute de mesure, pas conclure à l'absence`);
    assert.ok(!/DECLENCHEUR_INTROUVABLE/.test(r.code));
  }
});

verifier('un corpus non lu remonte tel quel jusqu’à resoudre', () => {
  const r = D.resoudre({ branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: null });
  assert.strictEqual(r.rail, null);
  assert.strictEqual(r.code, 'CORPUS_NON_MESURE');
});

verifier('un rail imposé n’a pas besoin du corpus', () => {
  // L'override est une désignation à lui seul : exiger une mesure de plus
  // bloquerait un transport pourtant explicitement autorisé.
  const r = D.resoudre({ branche: BRANCHE, commentaires: null, override: RAIL });
  assert.strictEqual(r.rail, RAIL);
  assert.strictEqual(r.origine, 'IMPOSE');
});

verifier('un déclencheur trop lointain ne s’épingle pas', () => {
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-3600, avecRail())],
  });
  assert.strictEqual(r.code, 'DECLENCHEUR_INTROUVABLE');
  assert.ok(/3600 s/.test(r.motif), `le refus doit chiffrer l’écart : ${r.motif}`);
});

verifier('deux déclencheurs contradictoires dans la fenêtre : refus', () => {
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-30, avecRail('handoff-a')), commentaire(10, avecRail('handoff-b'))],
  });
  assert.strictEqual(r.code, 'DESIGNATION_AMBIGUE');
});

verifier('deux déclencheurs concordants dans la fenêtre : pas d’ambiguïté', () => {
  // L'ambiguïté ne compte que si elle change la réponse. Refuser ici serait
  // une garde qui mord pour la forme.
  const r = D.epingler({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-30, avecRail()), commentaire(10, avecRail())],
  });
  assert.ok(!r.code, `refus inattendu : ${r.motif}`);
  assert.strictEqual(r.declencheur.date, a(10));
});

console.log('\nRésolution — aucune destination sans désignation');

verifier('cas nominal : le rail vient du déclencheur, et l’origine le dit', () => {
  const r = D.resoudre({
    branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: [commentaire(-36, avecRail())],
  });
  assert.strictEqual(r.rail, RAIL);
  assert.strictEqual(r.origine, 'DECLENCHEUR');
  assert.strictEqual(r.declencheur.date, a(-36));
});

verifier('un déclencheur sans désignation ne produit AUCUN repli', () => {
  const r = D.resoudre({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-36, '@claude continue le travail.')],
  });
  assert.strictEqual(r.rail, null);
  assert.strictEqual(r.code, 'DESIGNATION_ABSENTE');
});

verifier('un rail ambiant offert sur un plateau est ignoré', () => {
  // L'épreuve qui compte. On passe au module, dans la même entrée, tout ce
  // qu'un repli complaisant pourrait attraper : la branche de départ, le rail
  // courant, une valeur par défaut. Le module n'a aucun de ces champs, et
  // c'est précisément ce qu'on mesure — pas un refus poli, une incapacité.
  const r = D.resoudre({
    branche: BRANCHE,
    auteurAutorise: AUTEUR,
    commentaires: [commentaire(-36, '@claude continue.')],
    railCourant: RAIL,
    brancheDeDepart: RAIL,
    defaut: RAIL,
    NEXUS_BASE_BRANCH: RAIL,
  });
  assert.strictEqual(r.rail, null, 'un repli s’est glissé dans la résolution');
  assert.strictEqual(r.code, 'DESIGNATION_ABSENTE');
});

verifier('un déclencheur qui désigne « main » est refusé, pas suivi', () => {
  const r = D.resoudre({
    branche: BRANCHE, auteurAutorise: AUTEUR,
    commentaires: [commentaire(-36, avecRail('main'))],
  });
  assert.strictEqual(r.rail, null);
  assert.strictEqual(r.code, 'RAIL_INTERDIT');
});

verifier('le rail imposé court-circuite la lecture, et se déclare comme tel', () => {
  const r = D.resoudre({
    branche: BRANCHE, auteurAutorise: AUTEUR, commentaires: [],
    override: 'handoff-preuve-continuite',
  });
  assert.strictEqual(r.rail, 'handoff-preuve-continuite');
  assert.strictEqual(r.origine, 'IMPOSE', 'l’origine doit distinguer l’imposé du désigné');
});

verifier('un rail imposé n’est pas une licence : sa forme est contrôlée aussi', () => {
  for (const [nom, code] of [['production', 'RAIL_INTERDIT'], ['n-importe-quoi', 'RAIL_MALFORME']]) {
    const r = D.resoudre({ branche: BRANCHE, commentaires: [], override: nom });
    assert.strictEqual(r.rail, null, `« ${nom} » est passé`);
    assert.strictEqual(r.code, code);
  }
});

console.log('\nParité avec claude.yml — une grammaire, deux lecteurs');

verifier('le module extrait exactement ce qu’extrait l’étape de « claude.yml »', () => {
  // `claude.yml` vit sur `main`, que ce lot n'ouvre pas : sa grammaire est donc
  // dupliquée dans le module, et cette duplication est une dette inscrite au
  // dossier. Ici on ne compare pas deux textes — un ERE POSIX et un RegExp JS
  // ne se comparent pas caractère à caractère — on compare ce que les deux
  // lecteurs RETIENNENT du même corpus. C'est la propriété qui compte : le
  // jour où l'un des deux change d'avis sur une forme, cette épreuve rougit.
  let yml;
  try {
    yml = execFileSync('git', ['show', 'origin/main:.github/workflows/claude.yml'],
      { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    console.log('      ⚠ PARITÉ NON MESURÉE : origin/main:.github/workflows/claude.yml est '
      + 'illisible ici. La grammaire dupliquée n’a pas été confrontée à son original.');
    return;
  }

  // On extrait les deux commandes telles qu'elles sont écrites dans le
  // workflow, et on les exécute. Les recopier serait mesurer ma copie.
  const ligneGrep = yml.split('\n').find((l) => l.includes('| grep -oE'));
  const ligneSed = yml.split('\n').find((l) => l.includes('| sed -E'));
  assert.ok(ligneGrep && ligneSed,
    'l’étape de claude.yml n’extrait plus la désignation par grep puis sed : '
    + 'la parité de grammaire doit être reprise à la main');
  const cmdGrep = ligneGrep.slice(ligneGrep.indexOf('grep -oE'), ligneGrep.lastIndexOf("' || true") + 1);
  const cmdSed = ligneSed.slice(ligneSed.indexOf('sed -E'), ligneSed.indexOf('| sort -u')).trim();

  const lireCommeLeWorkflow = (texte) => execFileSync(
    'bash', ['-c', `{ printf '%s' "$NEXUS_TRIGGER_BODY" | ${cmdGrep} || true; } | ${cmdSed} | sort -u`],
    { encoding: 'utf8', env: { ...process.env, NEXUS_TRIGGER_BODY: texte } },
  ).split('\n').filter(Boolean);

  const corpus = [
    'NEXUS_BASE_BRANCH=handoff-x',
    'NEXUS_BASE_BRANCH =handoff-x',
    'NEXUS_BASE_BRANCH= handoff-x',
    'NEXUS_BASE_BRANCH  =  handoff-x',
    'NEXUS_BASE_BRANCH:handoff-x',
    'NEXUS_BASE_BRANCH : handoff-x',
    'NEXUS_BASE_BRANCH=`handoff-x`',
    'NEXUS_BASE_BRANCH="handoff-x"',
    "NEXUS_BASE_BRANCH='handoff-x'",
    '@claude NEXUS_BASE_BRANCH=handoff-continuite-20260920\nFais le travail.',
    '@claude repars de NEXUS_BASE_BRANCH=config-par-environnement stp',
    'NEXUS_BASE_BRANCH=handoff-x puis NEXUS_BASE_BRANCH=handoff-y',
    'NEXUS_BASE_BRANCH=handoff-x et encore NEXUS_BASE_BRANCH : `handoff-x`',
    'NEXUS_BASE_BRANCH=main',
    'NEXUS_BASE_BRANCH=handoff-a..b',
    '@claude continue sur le rail habituel',
    'nexus_base_branch=handoff-x',
    'NEXUS_BASE_BRANCH',
    'NEXUS_BASE_BRANCH=',
    'préfixe NEXUS_BASE_BRANCH=handoff-x suffixe',
  ];

  for (const texte of corpus) {
    const workflow = lireCommeLeWorkflow(texte).sort();
    const module_ = [...D.designations(texte)].sort();
    assert.deepStrictEqual(module_, workflow,
      `désaccord sur « ${texte.replace(/\n/g, '\\n')} » : `
      + `claude.yml retient [${workflow}], le module retient [${module_}]`);
  }
});

console.log(`\n${reussites} épreuve(s) réussie(s), ${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
