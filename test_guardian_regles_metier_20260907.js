// Épreuves du Guardian Business Rules — outils/guardian-regles-metier.js
//
// Deux niveaux, parce qu'ils ne prouvent pas la même chose :
//
//   1. ÉPREUVES DE COMPORTEMENT — sur des dépôts-jouets écrits ici, où la
//      vérité est connue d'avance. Elles disent ce que la garde voit ET ce
//      qu'elle refuse de voir : la moitié de la valeur d'un détecteur est
//      dans ses silences, et un silence non testé n'est pas un silence, c'est
//      un hasard.
//   2. MUTATIONS DE LA GARDE ELLE-MÊME — chaque filtre de calibration est
//      désactivé un par un dans une COPIE du code, et l'épreuve exige que le
//      bruit revienne. Un filtre dont la suppression ne change rien ne filtre
//      rien : il décore. Chaque mutation vérifie D'ABORD qu'elle s'est
//      réellement appliquée au texte source — une mutation qui rate produit
//      un test vert qui ne prouve rien, ce qui est pire qu'un test rouge.
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHEMIN_GARDE = path.join(__dirname, 'outils', 'guardian-regles-metier.js');
const garde = require(CHEMIN_GARDE);

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log(`  ok — ${nom}`); }

// ── Dépôts-jouets ──────────────────────────────────────────────────────
let compteur = 0;
function depot(fichiers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `garde-metier-${compteur++}-`));
  for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(dir, nom), contenu);
  return dir;
}
function codes(res) { return res.findings.map((f) => `${f.code}@${f.fichier}:${f.ligne}`).sort(); }

// Le cas canonique du dépôt réel, réduit à l'os : le moteur possède la
// capacité du camion, l'écran s'en refait une copie.
const CAS_CANONIQUE = {
  'nexus-camion-moteur.js': '(function(g){\n  const MAXIMUM_CAMION_LITRES = 36000;\n  g.M = { MAXIMUM_CAMION_LITRES };\n})(window);\n',
  'NEXUS-Ecran-v1.html': '<html><body>\n<script>\n  const CAMION_CAPACITE = 36000;\n</script>\n</body></html>\n',
};

// ── 1. Comportement ────────────────────────────────────────────────────

t('signale une constante métier redéclarée dans un écran', () => {
  const r = garde.analyser({ racine: depot(CAS_CANONIQUE) });
  assert.strictEqual(r.findings.length, 1);
  const f = r.findings[0];
  assert.strictEqual(f.code, 'constante_metier_dupliquee');
  assert.strictEqual(f.fichier, 'NEXUS-Ecran-v1.html');
  assert.strictEqual(f.rival, 'CAMION_CAPACITE');
  assert.strictEqual(f.constante, 'MAXIMUM_CAMION_LITRES');
  assert.strictEqual(f.proprietaire, 'nexus-camion-moteur.js:2',
    'le finding doit donner les DEUX adresses : sans le propriétaire, le lecteur ne sait pas quoi consommer');
});

t('signale une valeur de repli `|| v` qui recopie le défaut du moteur', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': '(function(g){\n  const MAXIMUM_CAMION_LITRES = 36000;\n})(window);\n',
    'nexus-enrobage.js': 'const max = Number(cfg.maximum_camion_litres) || 36000;\n',
  }) });
  assert.deepStrictEqual(codes(r), ['defaut_metier_duplique@nexus-enrobage.js:1']);
});

t('les numéros de ligne désignent la ligne réelle du fichier', () => {
  // Les commentaires sont blanchis, pas supprimés : sinon le finding
  // enverrait le lecteur quelques lignes plus haut, et une garde qu'on ne
  // sait pas suivre jusqu'au défaut cesse d'être crue.
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': '// entête\n/* bloc\n   sur\n   trois lignes */\nconst MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': '// un\n// deux\n/* trois\n   quatre */\nconst CAMION_MAX = 36000;\n',
  }) });
  assert.strictEqual(r.findings[0].ligne, 5);
  assert.strictEqual(r.findings[0].proprietaire, 'nexus-camion-moteur.js:5');
});

t('SILENCE — la valeur n\'apparaît que dans un commentaire', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': '// rappel : const CAMION_MAX = 36000; est la capacité du camion\n/* const AUTRE = 36000; */\n',
  }) });
  assert.deepStrictEqual(r.findings, [], 'de la prose n\'est pas une déclaration');
});

t('SILENCE — la valeur n\'apparaît que dans une chaîne', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': 'const libelle = "const CAMION_MAX = 36000;";\n',
  }) });
  assert.deepStrictEqual(r.findings, []);
});

t('SILENCE — la valeur est hors des `<script>` d\'un écran', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'NEXUS-Ecran-v1.html': '<style>\n/* const LARGEUR = 36000; */\n.x{width:36000px}\n</style>\n<div data-max="36000">const RIEN = 36000;</div>\n',
  }) });
  assert.deepStrictEqual(r.findings, [], 'du CSS et du balisage ne portent pas de règle métier');
});

t('SILENCE — valeur revendiquée par deux constantes moteur : inattribuable', () => {
  // C'est le cas réel `0.15` (SEUIL_CONTRIBUTION_STRATEGIQUE, SEUIL_FDJ_
  // EVOLUTION, TOLERANCE_ECART_PREPARATION_RATIO). Désigner un propriétaire
  // au hasard, c'est se tromper deux fois sur trois.
  const r = garde.analyser({ racine: depot({
    'nexus-a-moteur.js': 'const SEUIL_A_LITRES = 36000;\n',
    'nexus-b-moteur.js': 'const SEUIL_B_LITRES = 36000;\n',
    'nexus-enrobage.js': 'const COPIE = 36000;\n',
  }) });
  assert.deepStrictEqual(r.findings, []);
  assert.strictEqual(garde.analyser({ racine: depot({
    'nexus-a-moteur.js': 'const SEUIL_A_LITRES = 36000;\n',
    'nexus-b-moteur.js': 'const SEUIL_B_LITRES = 36000;\n',
  }) }).constantesExaminees, 0, 'la valeur ambiguë doit sortir de l\'inventaire, pas seulement des findings');
});

t('SILENCE — un fichier de test qui écrit la valeur en dur', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'test_camion.js': 'const ATTENDU_LITRES = 36000;\n',
  }) });
  assert.deepStrictEqual(r.findings, [],
    'le métier d\'une preuve est justement d\'écrire la valeur attendue en dur');
});

t('SILENCE — un autre moteur n\'est pas un porteur', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-autre-moteur.js': 'const REPRISE_LITRES = 36000;\n',
  }) });
  assert.deepStrictEqual(r.findings, [], 'la garde vise la copie hors du moteur, pas un dialogue entre moteurs');
});

// ── Banalité de la valeur, et rattrapage par le nom ────────────────────

t('SILENCE — valeur banale sans corroboration de nom', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-plan-moteur.js': 'const SEUIL_RETARDS_JOURS = 7;\n',
    'nexus-enrobage.js': 'const TOTAL_BARRES = 7;\nconst x = n || 7;\n',
  }) });
  assert.deepStrictEqual(r.findings, [],
    'un petit entier rond se recroise par hasard : c\'était 100 % des faux positifs mesurés');
});

t('SILENCE — un nom qui parle du même sujet ne rattrape PAS une valeur banale', () => {
  // Piste essayée puis rejetée sur le dépôt réel : son unique finding,
  // `DEPUIS_JOURS_ROTATION = 30` accusé de recopier `FDJ_ROTATION_FENETRE_
  // JOURS_DEFAUT = 30`, était un homonyme — rotation des recommandations du
  // coach d'un côté, rotation des carnets de jeu de l'autre. Un mot commun
  // n'est pas un sujet commun, et une accusation fausse coûte plus cher que
  // le défaut qu'on n'a pas vu.
  const r = garde.analyser({ racine: depot({
    'nexus-plan-moteur.js': 'const SEUIL_RETARDS_JOURS = 7;\n',
    'nexus-enrobage.js': 'const RETARDS_TOLERES = 7;\n',
  }) });
  assert.deepStrictEqual(r.findings, []);
});

t('un jeton distinctif partagé fait monter la confiance, pas l\'admission', () => {
  const fort = garde.analyser({ racine: depot(CAS_CANONIQUE) }).findings[0];
  assert.strictEqual(fort.confiance, 'forte');
  assert.deepStrictEqual(fort.motifs, ['valeur_signature', 'jetons_partages:CAMION']);
  const faible = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': 'const PLAFOND_LIVRAISON = 36000;\n',
  }) }).findings[0];
  assert.strictEqual(faible.confiance, 'a_verifier',
    'sans corroboration de nom, le finding reste une piste à ouvrir, pas un verdict');
});

t('un jeton générique ou une unité partagée ne corrobore rien', () => {
  // SEUIL, JOURS, LITRES : la grammaire commune du dépôt. Deux constantes ne
  // parlent pas du même sujet parce qu'elles comptent toutes deux des litres.
  const r = garde.analyser({ racine: depot({
    'nexus-plan-moteur.js': 'const SEUIL_LIVRAISON_LITRES = 36000;\n',
    'nexus-enrobage.js': 'const SEUIL_REMPLISSAGE_LITRES = 36000;\n',
  }) });
  assert.strictEqual(r.findings[0].confiance, 'a_verifier');
  assert.deepStrictEqual(garde.jetonsDistinctifs('SEUIL_LIVRAISON_LITRES'), ['LIVRAISON']);
});

t('SILENCE — un repli banal `|| 7` n\'est jamais retenu', () => {
  // `.limit(limite || 15)` était le faux positif type du dépôt réel.
  const r = garde.analyser({ racine: depot({
    'nexus-plan-moteur.js': 'const SEUIL_RETARDS_JOURS = 7;\n',
    'nexus-donnees.js': 'q.limit(limite || 7);\n',
  }) });
  assert.deepStrictEqual(r.findings, []);
});

t('valeurSignature sépare l\'intentionnel du banal', () => {
  for (const v of ['36000', '15000', '2000', '1000', '28500', '0.006', '0.125'])
    assert.ok(garde.valeurSignature(v), `${v} doit être une signature`);
  for (const v of ['0', '1', '2', '7', '10', '25', '30', '80', '500', '0.5', '0.15', '1.5'])
    assert.ok(!garde.valeurSignature(v), `${v} ne doit pas être une signature`);
});

t('SILENCE — une mention qui n\'est pas une redéclaration', () => {
  const r = garde.analyser({ racine: depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': 'if (total > 36000) alerter(36000);\nconst plein = Math.min(volume, 36000);\n',
  }) });
  assert.deepStrictEqual(r.findings, [],
    'comparer à une valeur n\'en fait pas le propriétaire ; la garde vise la REDÉCLARATION');
});

// ── Portée diff (contrat attendu par outils/guardians-router.js) ────────

t('executer restreint l\'analyse aux fichiers du lot', () => {
  const dir = depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'NEXUS-Ecran-v1.html': '<script>const CAMION_CAPACITE = 36000;</script>\n',
    'nexus-enrobage.js': 'const CAMION_MAX = 36000;\n',
  });
  assert.strictEqual(garde.executer({ racine: dir }).findings.length, 2, 'sans portée : tout le dépôt');
  const cible = garde.executer({ racine: dir, fichiers: ['nexus-enrobage.js'] });
  assert.strictEqual(cible.findings.length, 1);
  assert.strictEqual(cible.findings[0].fichier, 'nexus-enrobage.js');
  assert.strictEqual(garde.executer({ racine: dir, fichiers: ['docs/quelque-chose.md'] }).findings.length, 0);
});

t('l\'interface publique annoncée existe', () => {
  assert.strictEqual(typeof garde.analyser, 'function');
  assert.strictEqual(typeof garde.executer, 'function');
  const r = garde.executer({ racine: depot(CAS_CANONIQUE) });
  for (const cle of ['guardian', 'code', 'fichier', 'ligne', 'message', 'proprietaire', 'confiance'])
    assert.ok(cle in r.findings[0], `un finding doit porter \`${cle}\``);
  assert.strictEqual(r.findings[0].guardian, 'Business Rules');
});

// ── CLI ────────────────────────────────────────────────────────────────

t('le CLI sort 1 avec finding, 0 sans', () => {
  const { spawnSync } = require('child_process');
  const lancer = (racine) => spawnSync(process.execPath, [CHEMIN_GARDE],
    { env: { ...process.env, NEXUS_DEPOT: racine }, encoding: 'utf8' });
  const sale = lancer(depot(CAS_CANONIQUE));
  assert.strictEqual(sale.status, 1);
  assert.match(sale.stdout, /CAMION_CAPACITE/);
  const propre = lancer(depot({ 'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n' }));
  assert.strictEqual(propre.status, 0);
  assert.match(propre.stdout, /0 finding/);
});

// ── 2. Mutations de la garde elle-même ─────────────────────────────────
// Chaque mutation éteint UN filtre de calibration. L'épreuve exige que le
// bruit correspondant réapparaisse : sans cela, le filtre ne filtrait rien.
const SOURCE = fs.readFileSync(CHEMIN_GARDE, 'utf8');
let mutations = 0;

function muter(nom, remplacer, verifier) {
  const mutee = remplacer(SOURCE);
  // Le garde-fou qui rend ces épreuves honnêtes : si le texte n'a pas bougé
  // (refactor, renommage, espace de plus), la mutation n'a PAS eu lieu et le
  // test qui suit passerait pour de mauvaises raisons. On échoue ici, fort.
  assert.notStrictEqual(mutee, SOURCE, `mutation « ${nom} » NON APPLIQUÉE — le motif visé n'existe plus dans la source`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-metier-mut-'));
  const chemin = path.join(dir, 'garde-mutee.js');
  fs.writeFileSync(chemin, mutee);
  delete require.cache[require.resolve(chemin)];
  verifier(require(chemin));
  mutations++;
  console.log(`  ok — mutation détectée : ${nom}`);
}

// M1 — la banalité de la valeur ne filtre plus rien.
muter('valeurSignature toujours vraie', (s) =>
  s.replace('  return n >= 1000 || chiffresSignificatifs(valeur) >= 3 || decimales(valeur) >= 3;',
    '  return true;'),
(g) => {
  const dir = depot({
    'nexus-plan-moteur.js': 'const SEUIL_RETARDS_JOURS = 7;\n',
    'nexus-enrobage.js': 'const TOTAL_BARRES = 7;\nconst x = n || 7;\n',
  });
  assert.strictEqual(g.analyser({ racine: dir }).findings.length, 2,
    'sans filtre de banalité, le graphe et le repli redeviennent du bruit');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, [], 'la garde saine, elle, se tait');
});

// M1bis — la corroboration par le nom redevient une porte d'entrée. C'est
// exactement la version essayée puis rejetée : elle doit produire l'homonyme.
muter('jeton partagé admet à nouveau une valeur banale', (s) =>
  s.replace('    const signature = valeurSignature(c.valeur);\n    if (!signature) continue;', '    const signature = valeurSignature(c.valeur);'),
(g) => {
  const dir = depot({
    'nexus-fdj-moteur.js': 'const FDJ_ROTATION_FENETRE_JOURS_DEFAUT = 30;\n',
    'nexus-coach-donnees.js': 'const DEPUIS_JOURS_ROTATION = 30;\n',
  });
  assert.strictEqual(g.analyser({ racine: dir }).findings.length, 1,
    'la version rejetée doit bien reproduire son faux positif — sinon ce n\'est pas elle qu\'on a rejetée');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// M1ter — la corroboration elle-même est-elle vivante ? Si `jetonsDistinctifs`
// ne rend plus rien, la confiance doit retomber : sans quoi `confiance:
// 'forte'` serait une étiquette décorative.
muter('jetonsDistinctifs ne rend plus rien', (s) =>
  s.replace('  return nom.split(\'_\').filter((t) => t.length >= 4 && !JETONS_GENERIQUES.has(t));', '  return [];'),
(g) => {
  const dir = depot(CAS_CANONIQUE);
  assert.strictEqual(g.analyser({ racine: dir }).findings[0].confiance, 'a_verifier');
  assert.strictEqual(garde.analyser({ racine: dir }).findings[0].confiance, 'forte');
});

// M2 — l'ambiguïté de propriétaire n'écarte plus rien.
muter('propriétaire ambigu accepté', (s) =>
  s.replace('if (new Set(groupe.map((c) => c.nom)).size !== 1) continue;', '/* filtre retiré */'),
(g) => {
  const dir = depot({
    'nexus-a-moteur.js': 'const SEUIL_A_LITRES = 36000;\n',
    'nexus-b-moteur.js': 'const SEUIL_B_LITRES = 36000;\n',
    'nexus-enrobage.js': 'const COPIE = 36000;\n',
  });
  assert.ok(g.analyser({ racine: dir }).findings.length > 0,
    'sans ce filtre, la garde accuse en désignant un propriétaire au hasard');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// M3 — commentaires et chaînes redeviennent du code.
muter('neutraliser devient l\'identité', (s) =>
  s.replace('function neutraliser(source) {', 'function neutraliser(source) {\n  return source;'),
(g) => {
  const dir = depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': '// const CAMION_MAX = 36000;\nconst libelle = "const AUTRE_MAX = 36000;";\n',
  });
  assert.strictEqual(g.analyser({ racine: dir }).findings.length, 2,
    'sans neutralisation, la prose et les libellés deviennent des déclarations');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// M4 — les écrans sont lus en entier, CSS compris.
muter('scriptsSeuls devient l\'identité', (s) =>
  s.replace('function scriptsSeuls(html) {', 'function scriptsSeuls(html) {\n  return html;'),
(g) => {
  const dir = depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'NEXUS-Ecran-v1.html': '<style>\n</style>\n<div>const LARGEUR_MAX = 36000;</div>\n',
  });
  assert.strictEqual(g.analyser({ racine: dir }).findings.length, 1,
    'sans restriction aux <script>, le balisage d\'un écran produit des findings');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// M5 — les preuves redeviennent des suspects.
muter('exclusion des fichiers test_ retirée', (s) =>
  s.replace('.filter((f) => !RE_MOTEUR.test(f) && !RE_TEST.test(f));', '.filter((f) => !RE_MOTEUR.test(f));'),
(g) => {
  const dir = depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'test_camion.js': 'const ATTENDU_LITRES = 36000;\n',
  });
  assert.strictEqual(g.analyser({ racine: dir }).findings.length, 1,
    'sans cette exclusion, chaque épreuve du dépôt devient un finding');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// M6 — toute mention vaut redéclaration.
muter('reRivale accepte n\'importe quelle occurrence', (s) =>
  s.replace("return new RegExp('(?:const|let|var)\\\\s+([A-Z][A-Z0-9_]{2,})\\\\s*=\\\\s*' + echapper(valeur) + '(?![\\\\w.\\\\d])', 'g');",
    "return new RegExp('()' + echapper(valeur) + '(?![\\\\w.\\\\d])', 'g');"),
(g) => {
  const dir = depot({
    'nexus-camion-moteur.js': 'const MAXIMUM_CAMION_LITRES = 36000;\n',
    'nexus-enrobage.js': 'if (total > 36000) alerter();\nconst plein = Math.min(v, 36000);\n',
  });
  assert.ok(g.analyser({ racine: dir }).findings.length >= 2,
    'sans l\'exigence de redéclaration, toute comparaison devient une accusation');
  assert.deepStrictEqual(garde.analyser({ racine: dir }).findings, []);
});

// ── 3. Le vrai dépôt ───────────────────────────────────────────────────
// Une garde calibrée sur le dépôt doit rester vérifiable CONTRE lui : c'est
// le seul endroit où « 3 findings » veut dire quelque chose.

t('sur le dépôt réel : la capacité camion n’est plus recopiée nulle part', () => {
  // CETTE ÉPREUVE A ÉTÉ RETOURNÉE le 08/09/2026, et le retournement mérite
  // d'être expliqué.
  //
  // Elle exigeait auparavant que le défaut EXISTE : « la capacité camion
  // recopiée hors du moteur doit rester visible », avec au moins une copie
  // dans un écran. C'était utile tant que le défaut était là — cela prouvait
  // que la garde le voyait. Mais une épreuve qui exige la présence d'un bug
  // le VERROUILLE : le jour où on le corrige, c'est elle qui casse, et la CI
  // désigne le correctif comme une régression. C'est exactement ce qui s'est
  // produit en fermant CARB-007.
  //
  // La capacité de DÉTECTION reste prouvée, mais par des cas synthétiques
  // (plus haut dans ce fichier) : c'est leur rôle. Le dépôt réel, lui, sert à
  // vérifier que le défaut ne revient pas.
  const camion = garde.analyser({ racine: __dirname }).findings
    .filter((f) => f.constante === 'MAXIMUM_CAMION_LITRES');
  assert.deepStrictEqual(camion.map((f) => `${f.fichier}:${f.ligne}`), [],
    'la capacité camion doit rester la propriété du moteur — aucune copie, ni dans un écran, ni ailleurs');
});

t('sur le dépôt réel : le volume de findings reste lisible', () => {
  // Seuil de calibration, pas seuil de qualité : il ne dit pas que le dépôt
  // est sain, il dit que la garde n'a pas recommencé à hurler. Si un lot
  // légitime le fait franchir, c'est la calibration qu'il faut rouvrir —
  // avec la même méthode : lire les findings un par un.
  const r = garde.analyser({ racine: __dirname });
  // Le plancher a disparu volontairement : le dépôt est à zéro finding depuis
  // le 08/09/2026, et exiger un minimum reviendrait à exiger qu'un défaut
  // subsiste. Seul le plafond reste : il dit que la garde n'a pas recommencé
  // à hurler, pas que le dépôt est sain.
  assert.ok(r.findings.length <= 8,
    `${r.findings.length} findings : au-delà de ~8 la garde redevient du bruit, il faut la recalibrer.\n`
    + r.findings.map((f) => `  ${f.fichier}:${f.ligne} ${f.constante}`).join('\n'));
  assert.ok(r.constantesExaminees > 10, 'inventaire vide = garde qui se tait pour de mauvaises raisons');
});

t('sur le dépôt réel : chaque finding est vérifiable à la main', () => {
  // Un finding sans adresse exacte est une accusation sans preuve : le
  // lecteur doit pouvoir ouvrir les deux fichiers et trancher lui-même.
  for (const f of garde.analyser({ racine: __dirname }).findings) {
    const lignes = fs.readFileSync(path.join(__dirname, f.fichier), 'utf8').split('\n');
    assert.ok(lignes[f.ligne - 1].includes(String(f.valeur)),
      `${f.fichier}:${f.ligne} ne contient pas ${f.valeur}`);
    const [fp, lp] = f.proprietaire.split(':');
    const lignesP = fs.readFileSync(path.join(__dirname, fp), 'utf8').split('\n');
    assert.ok(lignesP[Number(lp) - 1].includes(f.constante),
      `${f.proprietaire} ne déclare pas ${f.constante}`);
  }
});

console.log(`\n${passes} épreuve(s) + ${mutations} mutation(s) détectée(s) — outils/guardian-regles-metier.js`);
