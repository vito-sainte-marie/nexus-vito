#!/usr/bin/env node
// NEXUS — banc de mutation de `test_accueil_hors_service_20260918.js` (18/09/2026).
//
// POURQUOI CET OUTIL EXISTE
// -------------------------
// Une suite verte du premier coup ne prouve rien tant qu'on ne l'a pas vue
// rougir. Le dépôt a déjà payé cette leçon : quatre gardes vertes et inutiles
// le 08/09, qu'aucune relecture n'avait vues, et que seule la mutation a
// révélées.
//
// On remet donc ici, un par un, les douze défauts que le lot « accueil hors
// service » corrige, et on exige que le test passe au ROUGE à chaque fois.
// Une mutation qui survit est rapportée comme telle, jamais dissimulée : elle
// dit qu'un comportement n'est gardé par aucune mesure.
//
// SÛRETÉ. Aucune mutation ne touche le fichier de travail : chacune est
// écrite dans un dossier temporaire, avec une copie de `nexus-pointage-regles.js`,
// et le test y est lancé via `NEXUS_RACINE`. `git status` doit être identique
// avant et après cet outil.
//
//   node outils/mutation-accueil-hors-service.js
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const ECRAN = 'NEXUS-App-v1.html';
const TESTS = [
  'test_accueil_hors_service_20260918.js',
  'test_pointage_accueil_journee_terminee_20260914.js',
];

// Chaque mutation réintroduit un défaut réel, tel qu'il existait avant ce lot.
const MUTATIONS = [
  ['M1 · inventaire prescrit sans service',
   "const inventaireApplicable = enService && roleDuJour !== 'renfort';",
   "const inventaireApplicable = roleDuJour !== 'renfort';"],
  ['M2 · contrôle FDJ prescrit sans service',
   'const fdjApplicable = enService && roleADroitModule(',
   'const fdjApplicable = roleADroitModule('],
  ['M3 · prochaine action : plus de branche « hors service »',
   '    if (!ctx.enService) {\n      if (ctx.consultationExterne) {',
   '    if (false) {\n      if (ctx.consultationExterne) {'],
  ['M4 · phrase du Coach : plus de branche « hors service »',
   '    if (!ctx.enService) {\n      return ctx.consultationExterne',
   '    if (false) {\n      return ctx.consultationExterne'],
  ['M5 · tuiles : plus de repli hors service (elles rebondissent)',
   "    if (!ctx.enService) {\n      const candidats = ctx.consultationExterne ? [] : ['prisedeposte'];",
   "    if (false) {\n      const candidats = ctx.consultationExterne ? [] : ['prisedeposte'];"],
  ['M6 · ligne de statut : « service en cours » sans service',
   "        : !enService\n          ? (consultationExterne ? 'Consultation externe' : 'Aucun poste en cours')",
   "        : false\n          ? (consultationExterne ? 'Consultation externe' : 'Aucun poste en cours')"],
  ['M7 · barre de progression affichée alors qu’il n’y a rien eu aujourd’hui',
   'const rienAujourdhui = !ctx.enService && !ctx.journeeTerminee;',
   'const rienAujourdhui = false;'],
  // La garde a deux bords, et les deux doivent mordre : celui du 18/09 (rien
  // aujourd'hui ⇒ barre masquée) et celui du 14/09 (journée terminée ⇒ journée
  // cochée). Muter le second seul montre que l'acquis n'a pas été écrasé.
  ['M13 · journée terminée effacée de la barre (acquis du 14/09)',
   'const rienAujourdhui = !ctx.enService && !ctx.journeeTerminee;',
   'const rienAujourdhui = !ctx.enService;'],
  ['M8 · pointage non neutralisé hors service',
   'const prochainPointageEffectif = (journeeTerminee || !enService) ? null : prochainPointage;',
   'const prochainPointageEffectif = journeeTerminee ? null : prochainPointage;'],
  ['M9 · rappel de service sans moyen de reprendre son poste',
   '\'<a class="chemins-rappel-lien" href="NEXUS-Prise-De-Poste-v1.html">\'\n        + \'Changer de rôle / refaire ma prise de poste</a>\'',
   "''"],
  ['M10 · rôle du jour qui disparaît quand il est inconnu',
   'const libelleRole = LIBELLE_ROLE_JOUR[roleDuJour] || roleDuJour || null;',
   'const libelleRole = LIBELLE_ROLE_JOUR[roleDuJour] || null;'],
  ['M11 · réception carburant prescrite sans service',
   'const receptionApplicable = enService && roleADroitModule(',
   'const receptionApplicable = roleADroitModule('],
  ['M12 · jaugeage prescrit sans service',
   'const jaugeageApplicable = enService && jaugeagePertinentRole',
   'const jaugeageApplicable = jaugeagePertinentRole'],
];

const SRC = fs.readFileSync(path.join(RACINE, ECRAN), 'utf8');

function lancerUn(test, racine) {
  try {
    const sortie = execFileSync('node', [path.join(RACINE, test)], {
      cwd: RACINE, timeout: 30000, encoding: 'utf8',
      // Les deux tests de l'accueil ne désignent pas l'écran de la même façon :
      // celui du 18/09 prend une racine, celui du 14/09 un chemin de fichier.
      // Passer les deux est ce qui permet à la mutation de les atteindre tous
      // les deux — sans NEXUS_SOURCE_APP, le second lirait le fichier de
      // travail non muté et resterait vert sans rien prouver.
      env: {
        ...process.env,
        NEXUS_RACINE: racine,
        NEXUS_SOURCE_APP: path.join(racine, ECRAN),
      },
    });
    return { code: 0, sortie: sortie.trim() };
  } catch (e) {
    return { code: e.status === undefined ? 1 : e.status, sortie: `${e.stdout || ''}${e.stderr || ''}`.trim() };
  }
}

// Une mutation est tuée dès qu'un test rougit ; on rapporte lequel, parce que
// « quelque chose a échoué » ne dit pas quelle règle a mordu.
function lancer(racine) {
  const rouges = [];
  for (const test of TESTS) {
    const r = lancerUn(test, racine);
    if (r.code !== 0) rouges.push({ test, ...r });
  }
  return { code: rouges.length ? 1 : 0, rouges };
}
const resume = r => r.rouges.length
  ? r.rouges.map(x => `${x.test.replace(/^test_|\.js$/g, '')} : ${
      (x.sortie.split('\n').find(l => /contrôles verts|échec\(s\)/.test(l)) || '(sortie illisible)').trim()}`).join(' ; ')
  : 'les deux tests restent verts';

// Témoin : sans mutation, le test doit être vert. Sinon la mesure qui suit ne
// veut rien dire — un rouge ne prouverait pas que la mutation a mordu.
const temoin = lancer(RACINE);
console.log('TÉMOIN (aucune mutation) : ' + resume(temoin));
if (temoin.code !== 0) {
  console.log('Les tests ne sont pas verts sans mutation — mesure inexploitable.');
  temoin.rouges.forEach(x => console.log(x.sortie));
  process.exit(2);
}

const tuees = [];
const survivantes = [];
for (const [nom, avant, apres] of MUTATIONS) {
  const occurrences = SRC.split(avant).length - 1;
  if (occurrences !== 1) {
    // Une garde muette est d'abord une mutation mal visée : un motif qui ne
    // s'applique pas se rapporte, il ne se tait pas.
    console.log(`  ??          ${nom} — motif introuvable ou ambigu (${occurrences} occurrences), mutation NON APPLIQUÉE`);
    survivantes.push(`${nom} (motif introuvable)`);
    continue;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-accueil-'));
  try {
    fs.copyFileSync(path.join(RACINE, 'nexus-pointage-regles.js'), path.join(tmp, 'nexus-pointage-regles.js'));
    fs.writeFileSync(path.join(tmp, ECRAN), SRC.split(avant).join(apres));
    const r = lancer(tmp);
    if (r.code === 0) {
      console.log(`  SURVIVANTE  ${nom} — ${resume(r)}`);
      survivantes.push(nom);
    } else {
      console.log(`  tuée        ${nom} — ${resume(r)}`);
      tuees.push(nom);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('');
console.log(`${tuees.length} mutations tuées, ${survivantes.length} survivantes`);
survivantes.forEach(s => console.log('  · survivante : ' + s));
process.exit(survivantes.length ? 1 : 0);
