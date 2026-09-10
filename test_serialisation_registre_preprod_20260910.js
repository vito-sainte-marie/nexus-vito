#!/usr/bin/env node
// Deux épreuves ne peuvent plus toucher PREPROD-CYCLE.json en même temps.
//
// LE DÉFAUT, démontré le 10/09/2026 et resté ouvert plusieurs jours sous le
// nom `zzzzrefdetestinexistante` (blocages-ouverts-1.md §9). Six épreuves
// sauvegardent `docs/handoff/PREPROD-CYCLE.json`, le remplacent, lancent un
// script de répétition qui y INSCRIT un cycle PREPROD, puis le restaurent.
// Lancées en parallèle, la seconde sauvegarde l'état déjà modifié par la
// première : la dernière restauration gagne, et ce n'est pas l'originale. Le
// cycle bidon survivait dans un fichier suivi par git et faisait échouer
// l'étape de semis PLUS TARD DANS LE MÊME JOB CI — d'où l'intermittence.
//
// CE QU'ELLE VÉRIFIE, en deux temps :
//   1. LE PLAN — les six sont dans la voie sérialisée, et une mutation montre
//      que c'est bien le prédicat qui les y met ;
//   2. LE COMPORTEMENT — chaque épreuve rend le fichier OCTET POUR OCTET tel
//      qu'elle l'a trouvé, y compris quand elle ÉCHOUE, et la référence bidon
//      ne subsiste nulle part.
//
// Le point 2 est le seul qui prouve quelque chose sur le monde : un plan
// correct exécuté par un lanceur fautif laisserait le fichier sale quand même.

'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let passes = 0;
function t(nom, fn) {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { console.error(`  ✗ ${nom}\n    ${e.message}`); process.exitCode = 1; }
}

const RACINE = __dirname;
const { toucheAuRegistre, outilsDuRegistre, planifier, REGISTRE_PARTAGE } = require(path.join(RACINE, 'run-tests.js'));
const CYCLE = path.join(RACINE, 'docs', 'handoff', 'PREPROD-CYCLE.json');
const REF_BIDON = 'zzzzrefdetestinexistante';

const empreinte = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** Les outils dont le contenu nomme le registre. */
function outilsSensibles() {
  const dir = path.join(RACINE, 'outils');
  const sources = {};
  for (const f of fs.readdirSync(dir)) {
    if (/\.(js|sh)$/.test(f)) sources[f] = fs.readFileSync(path.join(dir, f), 'utf8');
  }
  return outilsDuRegistre(sources);
}

/** Les épreuves qui touchent au registre — déduites, jamais recopiées. */
function epreuvesDuRegistre() {
  const outils = outilsSensibles();
  return fs.readdirSync(RACINE)
    .filter((f) => f.startsWith('test_') && f.endsWith('.js'))
    .filter((f) => toucheAuRegistre(fs.readFileSync(path.join(RACINE, f), 'utf8'), outils))
    .sort();
}

// ── 1. LE PLAN ─────────────────────────────────────────────────────────────

t('les épreuves du registre sont détectées par leur contenu, pas par une liste', () => {
  const detectees = epreuvesDuRegistre();
  const outils = outilsSensibles();
  assert.ok(detectees.length >= 6,
    `${detectees.length} épreuve(s) détectée(s), au moins 6 attendues : ${detectees.join(', ')}`);
  // Chacune touche réellement au registre — la détection ne ratisse pas large.
  for (const f of detectees) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.ok(src.includes(REGISTRE_PARTAGE) || outils.some((o) => src.includes(o)),
      `${f} est classée exclusive sans toucher au registre, ni directement ni par un outil`);
  }
});

t('une épreuve qui n\'atteint le registre QUE par un outil est prise aussi', () => {
  // Le trou que la CI a démenti dans l'heure. `test_garde_mode_environnement`
  // ne nomme jamais le registre : il lance `outils/garde-mode-environnement.js`,
  // qui le LIT. Laissé en parallèle, il tombait sur un fichier à demi réécrit
  // (« le registre doit être lisible »). Un outil qui nomme le registre
  // contamine l'épreuve qui l'invoque.
  const outils = outilsSensibles();
  assert.ok(outils.includes('garde-mode-environnement'),
    `outils du registre déduits : ${outils.join(', ')} — le garde de mode en est absent`);
  const cible = 'test_garde_mode_environnement_20260909.js';
  const src = fs.readFileSync(path.join(RACINE, cible), 'utf8');
  assert.ok(!src.includes(REGISTRE_PARTAGE),
    `${cible} nomme désormais le registre : ce témoin ne prouve plus la déduction indirecte`);
  assert.ok(toucheAuRegistre(src, outils), `${cible} n'est pas reconnue comme exclusive`);
  // MUTATION : sans la déduction par outil, elle repasse en parallèle.
  assert.ok(!toucheAuRegistre(src, []),
    'la déduction par outil ne change rien : le témoin ne prouve rien');
});

t('un outil qui ne nomme pas le registre ne contamine personne', () => {
  const sources = { 'garde-mode-environnement.js': 'lit PREPROD-CYCLE.json', 'nexus-marge.js': 'rien' };
  assert.deepStrictEqual(outilsDuRegistre(sources), ['garde-mode-environnement']);
  assert.deepStrictEqual(outilsDuRegistre({}), []);
  assert.deepStrictEqual(outilsDuRegistre(null), []);
});

t('toutes partent dans la MÊME voie — c\'est ce qui les empêche de se croiser', () => {
  const exclusifs = epreuvesDuRegistre();
  const fichiers = fs.readdirSync(RACINE).filter((f) => f.startsWith('test_') && f.endsWith('.js')).sort();
  const plan = planifier({ fichiers, largeur: 8, exclusifs });
  assert.deepStrictEqual(plan.exclusives.slice().sort(), exclusifs.slice().sort(),
    'une épreuve du registre n\'est pas dans la voie sérialisée');
  for (const f of exclusifs) {
    assert.ok(!plan.paralleles.includes(f),
      `${f} se trouve AUSSI dans la file partagée : elle pourrait se croiser avec une autre`);
  }
});

t('le parallélisme est conservé pour tout le reste', () => {
  const exclusifs = epreuvesDuRegistre();
  const fichiers = fs.readdirSync(RACINE).filter((f) => f.startsWith('test_') && f.endsWith('.js')).sort();
  const plan = planifier({ fichiers, largeur: 8, exclusifs });
  assert.strictEqual(plan.exclusives.length + plan.paralleles.length, fichiers.length,
    'des épreuves ont été perdues par la répartition');
  assert.ok(plan.paralleles.length > fichiers.length - 20,
    `seules ${plan.paralleles.length} épreuves restent parallèles : la sérialisation déborde de son périmètre`);
  assert.strictEqual(plan.voies, 8, 'la largeur de parallélisme a été réduite');
});

t('MUTATION : sans le prédicat, les six retombent dans la file partagée', () => {
  // Le témoin qui compte. Sans lui, un planificateur qui ne sérialiserait
  // RIEN passerait les contrôles ci-dessus dès que la liste est vide.
  const fichiers = epreuvesDuRegistre();
  const plan = planifier({ fichiers, largeur: 8, exclusifs: [] });
  assert.strictEqual(plan.exclusives.length, 0);
  assert.deepStrictEqual(plan.paralleles.slice().sort(), fichiers.slice().sort(),
    'la mutation ne remet pas les épreuves en parallèle : elle ne prouve rien');
});

t('en séquentiel, il n\'y a rien à sérialiser — et rien n\'est perdu', () => {
  const fichiers = epreuvesDuRegistre();
  const plan = planifier({ fichiers, largeur: 1, exclusifs: fichiers });
  assert.strictEqual(plan.exclusives.length, 0);
  assert.deepStrictEqual(plan.paralleles, fichiers);
});

t('une épreuve illisible est sérialisée par défaut, jamais laissée en parallèle', () => {
  // Fail-closed : ne pas savoir si un fichier touche au registre n'autorise
  // pas à parier qu'il n'y touche pas.
  assert.strictEqual(toucheAuRegistre(null), false);
  const source = fs.readFileSync(path.join(RACINE, 'run-tests.js'), 'utf8');
  assert.ok(/catch \(e\) \{ return true; \}/.test(source),
    'le lanceur ne sérialise plus une épreuve dont la source est illisible');
});

// ── 2. LE COMPORTEMENT ─────────────────────────────────────────────────────

t('chaque épreuve du registre rend le fichier OCTET POUR OCTET tel qu\'elle l\'a trouvé', () => {
  const avant = empreinte(CYCLE);
  const fautives = [];
  for (const f of epreuvesDuRegistre()) {
    if (f === path.basename(__filename)) continue;   // ne pas se relancer soi-même
    spawnSync('node', [f], { cwd: RACINE, encoding: 'utf8', timeout: 120000 });
    if (empreinte(CYCLE) !== avant) {
      fautives.push(f);
      fs.writeFileSync(CYCLE, fs.readFileSync(CYCLE));  // ne pas contaminer la suivante
      break;
    }
  }
  assert.deepStrictEqual(fautives, [],
    `ces épreuves laissent ${path.basename(CYCLE)} modifié : ${fautives.join(', ')}`);
});

t('la restauration tient même quand l\'épreuve ÉCHOUE', () => {
  // Un `finally` non exécuté ne se voit pas quand tout passe. Et un échec
  // APRÈS la restauration ne prouverait rien non plus : le fichier serait déjà
  // revenu. L'échec est donc forcé À L'INTÉRIEUR du `try`, entre le moment où
  // le registre est vidé et celui où il devrait être rendu — le seul instant
  // où un `finally` absent se verrait.
  const source = fs.readFileSync(path.join(RACINE, 'test_security_jamais_invoque_si_url_20260910.js'), 'utf8');
  const mute = source
    .replace('    return spawnSync(\'bash\',',
             '    throw new Error(\'échec forcé pendant la répétition\');\n    return spawnSync(\'bash\',')
    // La copie vit HORS du dépôt, donc `__dirname` ne désigne plus la racine :
    // on la lui rend explicitement, sinon elle sauvegarderait un registre
    // inexistant et le témoin ne prouverait rien.
    //
    // Elle a d'abord été écrite DANS la racine, et c'était le même défaut que
    // celui qu'on répare ici : `test_build_tracabilite` liste les `.js` de la
    // racine puis les copie, et échouait en ENOENT quand ce fichier
    // disparaissait entre les deux (2 fois sur 6 exécutions). Une épreuve qui
    // écrit dans l'arbre de travail fait tomber une autre épreuve.
    .replace('const RACINE = __dirname;', `const RACINE = ${JSON.stringify(RACINE)};`);
  assert.notStrictEqual(mute, source, 'la mutation n\'a rien changé : elle ne prouve rien');
  assert.ok(mute.includes('échec forcé pendant la répétition'),
    'l\'échec n\'a pas été injecté dans le `try` : le témoin ne prouve rien');
  assert.ok(mute.includes(`const RACINE = ${JSON.stringify(RACINE)}`),
    'la copie ne sait pas où est la racine : elle ne toucherait pas au vrai registre');
  const copie = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexus-restauration-')),
                          'verification-restauration-apres-echec.js');
  const avant = empreinte(CYCLE);
  try {
    fs.writeFileSync(copie, mute);
    const r = spawnSync('node', [copie], { cwd: RACINE, encoding: 'utf8', timeout: 120000 });
    assert.notStrictEqual(r.status, 0, 'l\'épreuve mutée devait échouer : le témoin ne prouve rien');
    assert.strictEqual(empreinte(CYCLE), avant,
      'une épreuve qui échoue laisse le registre modifié — le `finally` ne tient pas');
  } finally {
    fs.rmSync(path.dirname(copie), { recursive: true, force: true });
  }
});

t(`ni ${REF_BIDON} ni aucun cycle ouvert ne subsiste dans le registre`, () => {
  const brut = fs.readFileSync(CYCLE, 'utf8');
  assert.ok(!brut.includes(REF_BIDON),
    `la référence bidon subsiste dans ${path.basename(CYCLE)} : une épreuve l'y a laissée`);
  const cycles = JSON.parse(brut).cycles || [];
  const ouverts = cycles.filter((c) => !c.detruit_le);
  assert.deepStrictEqual(ouverts, [],
    `${ouverts.length} cycle(s) ouvert(s) laissé(s) par la suite : ${JSON.stringify(ouverts)}`);
});

console.log(`\n${passes}/11 vérifications passées — les épreuves du registre ne se croisent plus, et le rendent intact.`);
