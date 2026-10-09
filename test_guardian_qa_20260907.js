// Épreuves du Guardian QA / Regression — outils/guardian-qa.js
//
// Trois niveaux, parce qu'ils ne prouvent pas la même chose :
//
//   1. LES TROIS DÉFAUTS DU 07/09/2026, reconstitués à l'identique. Ce sont
//      eux qui justifient l'existence de la garde ; s'ils passaient, tout le
//      reste serait décoratif.
//   2. LES SILENCES. La moitié de la valeur d'un détecteur est dans ce qu'il
//      refuse de dire : un silence non éprouvé n'est pas un silence, c'est un
//      hasard. Chaque filtre de calibration a ici son épreuve de silence.
//   3. LES MUTATIONS DE LA GARDE ELLE-MÊME. Chaque filtre est éteint un par
//      un dans une COPIE du code ; l'épreuve exige que le comportement change.
//      Un filtre dont la suppression ne change rien ne filtre rien : il
//      décore. Chaque mutation vérifie D'ABORD qu'elle s'est réellement
//      appliquée au texte — un `replace` qui ne matche plus rend un faux
//      « la garde survit », c'est-à-dire exactement le genre d'épreuve
//      incapable d'échouer que cette garde est censée traquer.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CHEMIN_GARDE = path.join(__dirname, 'outils', 'guardian-qa.js');
const garde = require(CHEMIN_GARDE);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log(`  ok — ${nom}`); }

// Les sources d'épreuve sont écrites en tableaux de lignes plutôt qu'en
// gabarits : le numéro de ligne attendu par les assertions reste lisible, et
// aucun `${}` ne peut s'interpoler par accident dans un faux fichier de test.
function src(...lignes) { return lignes.join('\n') + '\n'; }

let compteur = 0;
function dossierJouet(fichiers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `garde-qa-${compteur++}-`));
  for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(dir, nom), contenu);
  return dir;
}

function codes(findings) { return findings.map(f => f.code).sort(); }

// ───────────────────────────────────────────────────────────────────────
// 1. LES TROIS DÉFAUTS RÉELS DU 07/09/2026
// ───────────────────────────────────────────────────────────────────────

// Défaut n°1 — `/2/` matchait « issue-28 » dans la sortie. L'assertion passait
// quel que soit le comportement de la garde ENV-001 sous épreuve.
t('défaut n°1 : un motif d\'un seul chiffre contre une sortie de processus', () => {
  const f = garde.analyser(src(
    "const r = lancer(t.dir);",
    "assert.ok(/2/.test(r.sortie), r.sortie);"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(f), ['motif_trop_permissif']);
  assert.strictEqual(f[0].ligne, 2, 'la ligne fautive doit être désignée, pas le fichier en bloc');
  assert.ok(/\/2\//.test(f[0].message), 'le message doit citer le motif incriminé : ' + f[0].message);
});

// Défaut n°2 — l'aide ne capturait que stdout ; le refus partait sur stderr.
// La garde ne le conclut pas par ressemblance : elle va LIRE le programme
// lancé pour établir sur quel flux il écrit ses refus.
const OUTIL_QUI_REFUSE_SUR_STDERR = src(
  "console.error('ENV-001 : ÉCHEC — la branche ne part pas du HEAD canonique.');",
  "process.exit(1);"
);
const EPREUVE_STDOUT_SEUL = src(
  "const path = require('path');",
  "const { spawnSync } = require('child_process');",
  "const OUTIL = path.join(__dirname, 'outil.js');",
  "function lancer() {",
  "  const r = spawnSync('node', [OUTIL], { encoding: 'utf8' });",
  "  return { code: r.status, sortie: r.stdout };",
  "}",
  "const r = lancer();",
  "assert.strictEqual(r.code, 1);",
  "assert.ok(/ne part pas du HEAD canonique/.test(r.sortie), r.sortie);"
);

t('défaut n°2 : n\'affirmer un échec qu\'à partir de stdout, alors que l\'outil refuse sur stderr', () => {
  const dir = dossierJouet({ 'outil.js': OUTIL_QUI_REFUSE_SUR_STDERR });
  const f = garde.analyser(EPREUVE_STDOUT_SEUL, 'test_faux.js', dir);
  assert.deepStrictEqual(codes(f), ['capture_flux_partielle']);
  assert.ok(/outil\.js/.test(f[0].message), 'le message doit nommer le programme dont le refus part sur stderr : ' + f[0].message);
});

// Défaut n°3 — les tautologies.
t('défaut n°3 : assertions tautologiques', () => {
  const f = garde.analyser(src(
    "assert(true);",
    "assert.ok(1);",
    "assert.strictEqual(compteur, compteur);"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(f), ['assertion_tautologique', 'assertion_tautologique', 'assertion_tautologique']);
  assert.deepStrictEqual(f.map(x => x.ligne), [1, 2, 3], 'les trois lignes doivent être désignées séparément');
});

// ───────────────────────────────────────────────────────────────────────
// 1 bis. LES AUTRES FAMILLES DEMANDÉES
// ───────────────────────────────────────────────────────────────────────

t('un test_*.js sans aucune assertion ne peut rien signaler', () => {
  const f = garde.analyser(src(
    "const M = require('./nexus-moteur.js');",
    "const resultat = M.calculer(3);",
    "console.log('resultat', resultat);"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(f), ['epreuve_sans_assertion']);
});

t('une assertion dans un try dont le catch avale l\'erreur', () => {
  const f = garde.analyser(src(
    "try {",
    "  assert.strictEqual(M.calculer(3), 9);",
    "} catch (e) { console.error('FAIL', e.message); }"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(f), ['assertion_avalee_par_catch']);
  assert.ok(/AssertionError/.test(f[0].message), f[0].message);
});

t('des assertions dans le catch, sans rien dans le try pour signaler l\'absence d\'exception', () => {
  const f = garde.analyser(src(
    "try {",
    "  M.calculerAvecEntreeInvalide('x');",
    "} catch (e) {",
    "  assert.ok(/entrée invalide/.test(e.message));",
    "}"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(f), ['assertion_avalee_par_catch']);
  assert.ok(/assert\.fail/.test(f[0].message), 'le message doit dire quoi faire : ' + f[0].message);
});

t('un attendu recalculé par l\'appel même qu\'on observe', () => {
  const direct = garde.analyser(src(
    "assert.strictEqual(M.repartir(cuves, 3000), M.repartir(cuves, 3000));"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(direct), ['attendu_calcule_par_le_meme_appel']);

  // La forme indirecte, plus insidieuse : l'attendu passe par une variable.
  const indirect = garde.analyser(src(
    "const attendu = M.repartir(cuves, 3000);",
    "assert.deepStrictEqual(M.repartir(cuves, 3000), attendu);"
  ), 'test_faux.js');
  assert.deepStrictEqual(codes(indirect), ['attendu_calcule_par_le_meme_appel']);
});

// ───────────────────────────────────────────────────────────────────────
// 2. LES SILENCES — chaque filtre de calibration, éprouvé
// ───────────────────────────────────────────────────────────────────────

t('silence : un motif ancré, même court, est un choix explicite', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "assert.ok(/^OK$/m.test(r.sortie), r.sortie);"
  ), 'test_vrai.js'), []);
});

t('silence : un motif court appliqué à un champ typé, pas à une sortie libre', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "assert.ok(/2/.test(config.reserveCibleJours));"
  ), 'test_vrai.js'), []);
});

t('silence : une phrase citée reste une assertion défendable', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "assert.ok(/DÉFAUT DE RAIL/.test(r.sortie), r.sortie);"
  ), 'test_vrai.js'), []);
});

// Le faux positif qui a réellement fait dérailler la première calibration :
// `test_guardian_regles_metier` ne lit que stdout, et il a RAISON — la garde
// qu'il éprouve imprime ses findings sur stdout.
t('silence : ne lire que stdout est juste quand le programme lancé écrit sur stdout', () => {
  const dir = dossierJouet({ 'outil.js': src("console.log('0 finding');", "process.exit(0);") });
  assert.deepStrictEqual(garde.analyser(EPREUVE_STDOUT_SEUL, 'test_vrai.js', dir), []);
});

t('silence : le programme lancé n\'est pas résolvable — la garde ne conclut pas', () => {
  // Aucun `outil.js` sur le disque : la garde ne peut pas établir le flux de
  // refus, donc elle se tait plutôt que de supposer.
  const dir = dossierJouet({});
  assert.deepStrictEqual(garde.analyser(EPREUVE_STDOUT_SEUL, 'test_vrai.js', dir), []);
});

t('silence : capturer les deux flux referme le défaut n°2', () => {
  const dir = dossierJouet({ 'outil.js': OUTIL_QUI_REFUSE_SUR_STDERR });
  const corrige = EPREUVE_STDOUT_SEUL.replace(
    'return { code: r.status, sortie: r.stdout };',
    "return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };");
  assert.notStrictEqual(corrige, EPREUVE_STDOUT_SEUL, 'la correction doit s\'appliquer à la source d\'épreuve');
  assert.deepStrictEqual(garde.analyser(corrige, 'test_vrai.js', dir), []);
});

t('silence : un catch qui pose process.exitCode porte bien l\'échec', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "try {",
    "  assert.strictEqual(M.calculer(3), 9);",
    "} catch (e) { console.error(`FAIL — ${e.stack}`); process.exitCode = 1; }"
  ), 'test_vrai.js'), []);
});

t('silence : un try terminé par assert.fail rend le catch atteignable pour de bon', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "try {",
    "  M.calculerAvecEntreeInvalide('x');",
    "  assert.fail('aurait dû jeter');",
    "} catch (e) {",
    "  assert.ok(/entrée invalide/.test(e.message));",
    "}"
  ), 'test_vrai.js'), []);
});

// Le cœur arithmétique de la règle 1, éprouvé à part : c'est lui qui décide
// si un motif est « une phrase citée » ou « deux caractères au hasard ».
t('la longueur littérale est bien le MAXIMUM des suites, pas la dernière', () => {
  assert.strictEqual(garde.pluslongueSuiteLitterale('DÉFAUT'), 6);
  assert.strictEqual(garde.pluslongueSuiteLitterale('2'), 1);
  assert.strictEqual(garde.pluslongueSuiteLitterale('OK'), 2, 'sous le seuil : deux caractères');
  // Une longue suite suivie d'autre chose ne doit pas être oubliée au profit
  // de la dernière : c'est bien un MAXIMUM, pas la valeur courante finale.
  assert.strictEqual(garde.pluslongueSuiteLitterale('propre\\d+ok'), 6,
    'une suite courte en fin de motif ne doit pas effacer la longue qui précède');
  assert.strictEqual(garde.pluslongueSuiteLitterale('a?bc'), 2,
    'un quantificateur rend le caractère précédent facultatif : il ne compte pas');
  assert.strictEqual(garde.pluslongueSuiteLitterale('\\/2\\/'), 3,
    'une suite qui se termine par un caractère échappé doit être comptée jusqu\'au bout');
  assert.strictEqual(garde.pluslongueSuiteLitterale('[0-9]'), 0,
    'une classe de caractères ne cite rien : `[0-9]` est aussi permissif que `/2/`');
});

t('silence : une épreuve qui signale par un code de sortie non nul', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "const M = require('./nexus-moteur.js');",
    "if (M.calculer(3) !== 9) { console.error('régression'); process.exit(1); }",
    "console.log('OK');"
  ), 'test_vrai.js'), []);
});

// La distinction que la règle 2 doit tenir : affirmer un SUCCÈS en ne lisant
// que stdout est parfaitement légitime — c'est en affirmant un ÉCHEC qu'on lit
// une chaîne vide. `test_reveil_handoff` est dans ce cas.
t('silence : n\'affirmer qu\'un succès depuis stdout ne pose aucun problème', () => {
  const dir = dossierJouet({ 'outil.js': OUTIL_QUI_REFUSE_SUR_STDERR });
  const succes = EPREUVE_STDOUT_SEUL.replace('assert.strictEqual(r.code, 1);', 'assert.strictEqual(r.code, 0);');
  assert.notStrictEqual(succes, EPREUVE_STDOUT_SEUL, 'la variante « succès » doit s\'appliquer à la source d\'épreuve');
  assert.deepStrictEqual(garde.analyser(succes, 'test_vrai.js', dir), []);
});

t('silence : une redirection 2>&1 capture bien le second flux', () => {
  const dir = dossierJouet({ 'outil.js': OUTIL_QUI_REFUSE_SUR_STDERR });
  const redirige = EPREUVE_STDOUT_SEUL.replace("[OUTIL], { encoding: 'utf8' }", "[OUTIL, '2>&1'], { encoding: 'utf8' }");
  assert.notStrictEqual(redirige, EPREUVE_STDOUT_SEUL, 'la variante « 2>&1 » doit s\'appliquer à la source d\'épreuve');
  assert.deepStrictEqual(garde.analyser(redirige, 'test_vrai.js', dir), []);
});

t('silence : une épreuve qui échoue par throw n\'a pas besoin d\'assert', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "const M = require('./nexus-moteur.js');",
    "if (M.calculer(3) !== 9) throw new Error('régression sur calculer');",
    "console.log('OK');"
  ), 'test_vrai.js'), []);
});

// Le piège dans lequel un grep naïf tombe immédiatement dans CE dépôt : les
// épreuves commentent abondamment les défauts qu'elles corrigent.
t('silence : prose et chaînes de caractères ne sont pas du code', () => {
  assert.deepStrictEqual(garde.analyser(src(
    "// Ne jamais écrire assert(true) ni assert.strictEqual(x, x) : voir ADR.",
    "const libelle = \"assert.ok(1) est une tautologie\";",
    "assert.strictEqual(M.libelle(), libelle);"
  ), 'test_vrai.js'), []);
});

// La régression qui a fait accuser un fichier de 29 assertions d'être « sans
// assertion » : le lexeur découpait par point de code, `src[i]` compte en
// unités UTF-16, et les 🟢🟡🟠🔴 du vocabulaire carburant décalaient tout.
t('silence : les emoji du vocabulaire d\'alertes ne désynchronisent pas le lexeur', () => {
  const source = src(
    "// Vocabulaire d'alertes 🟢/🟡/🟠/🔴 — voir v2.253.",
    "assert.strictEqual(M.niveau(3), 'VERT');",
    "assert.strictEqual(M.niveau(9), 'ROUGE');"
  );
  assert.deepStrictEqual(garde.analyser(source, 'test_vrai.js'), []);
  const vue = garde.vueCode(source);
  assert.strictEqual(vue.length, source.length, 'la vue doit rester alignée sur la source');
  assert.strictEqual((vue.match(/assert\./g) || []).length, 2, 'les deux assertions doivent survivre au lexeur');
});

t('le dépôt réel reste sous le seuil de bruit qui a servi à calibrer la garde', () => {
  const { fichiers, findings } = garde.executer({});
  assert.ok(fichiers.length > 150, `la garde doit voir tout le corpus, pas trois fichiers (${fichiers.length})`);
  // Calibrée, la garde rend une poignée de findings sur ~210 épreuves. Ce
  // plafond n'est pas cosmétique : au-delà, un humain arrête de lire, et une
  // garde qu'on n'ouvre plus ne protège plus rien.
  assert.ok(findings.length <= 5,
    `bruit excessif sur le dépôt réel (${findings.length}) :\n` + findings.map(f => `  ${f.code} ${f.fichier}:${f.ligne}`).join('\n'));
});

// ───────────────────────────────────────────────────────────────────────
// 3. CLI
// ───────────────────────────────────────────────────────────────────────

// On concatène stdout ET stderr — ce test serait sinon le quatrième cas du
// 07/09/2026, dans l'épreuve de la garde censée le détecter.
function lancerCli(...args) {
  const r = spawnSync(process.execPath, [CHEMIN_GARDE, ...args], { encoding: 'utf8' });
  return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') };
}

t('CLI : sortie 1 et finding listé sur une épreuve fautive', () => {
  const dir = dossierJouet({ 'test_sale.js': src("assert.ok(true);") });
  const r = lancerCli(path.join(dir, 'test_sale.js'));
  assert.strictEqual(r.code, 1, r.sortie);
  assert.ok(/assertion_tautologique/.test(r.sortie), r.sortie);
  assert.ok(/test_sale\.js:1/.test(r.sortie), 'le CLI doit situer le finding : ' + r.sortie);
});

t('CLI : sortie 0 et silence sur une épreuve saine', () => {
  const dir = dossierJouet({ 'test_propre.js': src(
    "const M = require('./nexus-moteur.js');",
    "assert.strictEqual(M.calculer(3), 9, 'calculer(3) doit valoir 9');"
  ) });
  const r = lancerCli(path.join(dir, 'test_propre.js'));
  assert.strictEqual(r.code, 0, r.sortie);
  assert.ok(/0 finding/.test(r.sortie), r.sortie);
});

// ───────────────────────────────────────────────────────────────────────
// 4. MUTATIONS DE LA GARDE ELLE-MÊME
// ───────────────────────────────────────────────────────────────────────
const SOURCE = fs.readFileSync(CHEMIN_GARDE, 'utf8');
let mutations = 0;

function muter(nom, remplacer, verifier) {
  const mutee = remplacer(SOURCE);
  // Le garde-fou qui rend ces épreuves honnêtes. Sans lui, un renommage ou un
  // espace en plus suffirait à ce que la mutation ne s'applique pas, et
  // l'épreuve conclurait « détectée » sans avoir rien muté du tout.
  assert.notStrictEqual(mutee, SOURCE,
    `mutation « ${nom} » NON APPLIQUÉE — le motif visé n'existe plus dans outils/guardian-qa.js`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-qa-mut-'));
  const chemin = path.join(dir, 'guardian-qa-mutee.js');
  fs.writeFileSync(chemin, mutee);
  delete require.cache[require.resolve(chemin)];
  verifier(require(chemin));
  mutations++;
  console.log(`  ok — mutation détectée : ${nom}`);
}

// M1 — le lexeur ne neutralise plus rien : prose et chaînes redeviennent du code.
muter('vueCode devient l\'identité',
  s => s.replace('function vueCode(src) {', 'function vueCode(src) {\n  return src;'),
  g => {
    const source = src(
      "// Ne jamais écrire assert(true) : voir ADR.",
      "assert.strictEqual(M.calculer(3), 9);"
    );
    assert.ok(g.analyser(source, 'test_x.js').length > 0,
      'sans neutralisation, le commentaire qui interdit la tautologie devient une tautologie');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), [], 'la garde saine, elle, se tait');
  });

// M2 — le découpage par point de code revient : la régression emoji ressuscite.
muter('le lexeur redécoupe par point de code (Array.from)',
  s => s.replace("const out = src.split('');", 'const out = Array.from(src);'),
  g => {
    const source = src(
      "// Vocabulaire d'alertes 🟢/🟡/🟠/🔴.",
      "assert.strictEqual(M.niveau(3), 'VERT');",
      "assert.strictEqual(M.niveau(9), 'ROUGE');"
    );
    assert.notStrictEqual(g.vueCode(source).length, source.length,
      'la vue mutée doit se désaligner de la source — sinon la mutation ne mute rien');
    assert.strictEqual(garde.vueCode(source).length, source.length);
  });

// M3 — le seuil de littéralité tombe à zéro : plus aucun motif n'est trop court.
muter('seuil de littéralité mis à zéro',
  s => s.replace('const SEUIL_LITTERAL = 3;', 'const SEUIL_LITTERAL = 0;'),
  g => {
    const source = src("assert.ok(/2/.test(r.sortie), r.sortie);");
    assert.deepStrictEqual(g.analyser(source, 'test_x.js'), [],
      'sans seuil, le défaut n°1 redevient invisible');
    assert.deepStrictEqual(codes(garde.analyser(source, 'test_x.js')), ['motif_trop_permissif']);
  });

// M4 — le filtre « sortie de processus » saute : le bruit revient sur les
// champs typés, exactement ce qui rendait la première version inutilisable.
muter('le filtre « texte libre » ne filtre plus',
  s => s.replace("    if (!RE_TEXTE_LIBRE.test(cible || '')) continue;\n", ''),
  g => {
    const source = src("assert.ok(/2/.test(config.reserveCibleJours));");
    assert.ok(g.analyser(source, 'test_x.js').length > 0,
      'sans ce filtre, un champ typé est accusé comme une sortie de processus');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), []);
  });

// M5 — l'ancrage n'exonère plus.
muter('le filtre d\'ancrage ne filtre plus',
  s => s.replace('    if (motifAncre(motif)) continue;\n', ''),
  g => {
    const source = src("assert.ok(/^OK$/m.test(r.sortie), r.sortie);");
    assert.ok(g.analyser(source, 'test_x.js').length > 0,
      'sans ce filtre, un motif ancré est accusé au même titre qu\'un motif flottant');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), []);
  });

// M6 — la règle « capture partielle » redevient une ressemblance au lieu d'une
// preuve : elle n'ouvre plus le programme lancé pour voir où il écrit.
muter('la preuve par le flux du programme lancé est retirée',
  s => s.replace(
    '  if (!/console\\s*\\.\\s*error\\s*\\(|process\\s*\\.\\s*stderr\\s*\\.\\s*write\\s*\\(/.test(codeProgramme)) return findings;',
    '  if (false) return findings;'),
  g => {
    const dir = dossierJouet({ 'outil.js': src("console.log('0 finding');", "process.exit(0);") });
    assert.ok(g.analyser(EPREUVE_STDOUT_SEUL, 'test_x.js', dir).length > 0,
      'sans la preuve, la garde accuse un test qui a raison de ne lire que stdout');
    assert.deepStrictEqual(garde.analyser(EPREUVE_STDOUT_SEUL, 'test_x.js', dir), []);
  });

// M7 — un catch n'est plus reconnu comme porteur d'échec que s'il relance.
muter('les signaux d\'échec d\'un catch sont ignorés',
  s => s.replace('const catchRelance = SIGNAUX_ECHEC.some(r => r.test(corpsCatch));',
    'const catchRelance = false;'),
  g => {
    const source = src(
      "try {",
      "  assert.strictEqual(M.calculer(3), 9);",
      "} catch (e) { console.error(`FAIL — ${e.stack}`); process.exitCode = 1; }"
    );
    assert.deepStrictEqual(codes(g.analyser(source, 'test_x.js')), ['assertion_avalee_par_catch'],
      'sans SIGNAUX_ECHEC, le faux positif carburant du 07/09 revient');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), []);
  });

// M8 — l'exemption « échoue par throw » saute : les harnais du dépôt qui
// signalent sans `assert` redeviennent du bruit.
muter('l\'exemption « échoue par throw » est retirée',
  s => s.replace("  if (/\\bthrow\\b/.test(code)) return [];\n", ''),
  g => {
    const source = src(
      "const M = require('./nexus-moteur.js');",
      "if (M.calculer(3) !== 9) throw new Error('régression sur calculer');"
    );
    assert.deepStrictEqual(codes(g.analyser(source, 'test_x.js')), ['epreuve_sans_assertion'],
      'sans cette exemption, une épreuve qui échoue par throw est accusée de ne rien contrôler');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), []);
  });

// M9 — le `try` n'est plus examiné : un « ça doit jeter » correctement écrit
// (terminé par `assert.fail`) redevient suspect.
muter('le témoin levé dans le catch n\'est plus observé',
  s => s.replace('      if (!tryEchoue && !temoinObserve) {', '      if (!tryEchoue) {'),
  g => {
    const source = src(
      "let aJete = false;",
      "try {",
      "  M.calculerAvecEntreeInvalide('x');",
      "} catch (e) {",
      "  aJete = true;",
      "  assert.ok(/entrée invalide/.test(e.message));",
      "}",
      "assert.ok(aJete, 'calculerAvecEntreeInvalide doit jeter');"
    );
    assert.deepStrictEqual(codes(g.analyser(source, 'test_x.js')), ['assertion_avalee_par_catch'],
      'sans cette observation, la forme « témoin levé dans le catch » est accusée à tort');
    assert.deepStrictEqual(garde.analyser(source, 'test_x.js'), []);
  });

console.log(`\n${passes} épreuve(s) passée(s), ${mutations} mutation(s) détectée(s).`);
