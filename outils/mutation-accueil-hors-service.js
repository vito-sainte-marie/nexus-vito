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
  // SECOND LOT DU 18/09 — la seconde porte de `nexusRequireAuth`. Chacune de
  // ces cinq mutations remet l'écran dans l'état exactement mesuré sur Test
  // en S2 et S5 : des tuiles opérationnelles qui rebondissent vers le
  // pointage.
  ['M14 · tuiles : plus de repli « arrivée non pointée » (elles rebondissent)',
   "    if (!ctx.operationnelAtteignable) {\n      return ['pointage', 'progression', 'planning', 'evolution']",
   "    if (false) {\n      return ['pointage', 'progression', 'planning', 'evolution']"],
  ['M15 · phrase du Coach : consigne impossible à suivre',
   "    if (!ctx.operationnelAtteignable) {\n      return 'Pointez votre arrivée",
   "    if (false) {\n      return 'Pointez votre arrivée"],
  // La distinction du 13/09 remise à l'envers : la garde regarde l'arrivée de
  // la JOURNÉE, pas celle du service courant. Confondre les deux renvoie au
  // pointage quelqu'un que la garde laisse passer — un faux blocage.
  ['M16 · arrivée comptée par service au lieu de par journée',
   "const arriveePointeeJour = (pointagesJour || []).some(p => p.type === 'arrivee');",
   'const arriveePointeeJour = arriveeFaite;'],
  ['M17 · titre de section rebasculé sur le seul « en service »',
   "      operationnelAtteignable ? 'Mes outils du quart' : 'Mes écrans');",
   "      enService ? 'Mes outils du quart' : 'Mes écrans');"],
  // `estManager: false` est un fait établi par l'appelant (branche employé de
  // l'accueil), pas une commodité : le supposer vrai rouvre les deux portes.
  ['M18 · l’accueil employé se déclare manager',
   '      estManager: false,',
   '      estManager: true,'],
];

// 18/09/2026 — LA CAMPAGNE COUVRE DÉSORMAIS DEUX FICHIERS.
// La journée métier ne vit plus dans l'écran : elle vient des primitives de
// fuseau de `nexus-auth.js`, chargé par tous les écrans. Muter le seul écran
// laisserait donc ce lot-là sans aucune épreuve de mutation — exactement
// l'angle mort que cet outil existe pour fermer.
//
// Les deux campagnes restent séparées à dessein. `test_fuseau_station_...`
// relance la suite de l'accueil sous deux fuseaux d'appareil : l'ajouter aux
// tests de la campagne d'écran tuerait ses treize mutations par ricochet, et
// un signal qui se déclenche toujours ne mesure plus rien.
// 19/09/2026 — CAMPAGNE REVISÉE APRÈS L'ARBITRAGE DU FUSEAU.
// Trois des quatre mutations d'origine visaient du code qui n'existe plus :
// elles ancraient sur `NEXUS_FUSEAU_DEFAUT` et sur la lecture de
// `station_config.fuseau_horaire`, tous deux supprimés le 19/09. Une mutation
// qui n'a plus d'ancre ne survit pas : elle ne s'applique pas, et la campagne
// se félicite d'une garde qu'elle n'a jamais éprouvée. Elles visent désormais
// les formes que le code livré peut effectivement reprendre — le repli,
// l'horloge de l'appareil, et le retour à l'autorité dépréciée.
const MUTATIONS_FUSEAU = [
  ['F1 · le jour métier retombe sur l\'horloge de l\'appareil',
   '    timeZone: fuseau,',
   '    timeZone: undefined,'],
  ['F2 · un fuseau non résolu est remplacé au lieu d\'être avoué',
   '  if(!fuseau) return null;',
   "  if(!fuseau) fuseau = 'America/Martinique';"],
  ['F3 · les vieux services ne sont plus refermés',
   'if(obsoletes.length) await nexusCloturerServicesObsoletes(employee, obsoletes);',
   'if(false) await nexusCloturerServicesObsoletes(employee, obsoletes);'],
  ['F4 · le fuseau du site n\'est plus lu, il est supposé',
   'return nexusRetenirFuseau(siteId, data.timezone);',
   "return nexusRetenirFuseau(siteId, 'America/Martinique');"],
  ['F5 · le lecteur revient à la colonne dépréciée',
   "      .from('sites').select('timezone').eq('site_id', siteId).maybeSingle();",
   "      .from('station_config').select('fuseau_horaire').eq('site', siteId).maybeSingle()\n      .then(r => ({ data: r.data && { timezone: r.data.fuseau_horaire }, error: r.error }));"],
];

// F2 est la seule dont la garde ne vit pas dans l'accueil : les appelants de
// `nexus-auth.js` refusent déjà un fuseau nul avant d'appeler la primitive, si
// bien qu'un repli glissé DANS la primitive leur serait invisible. C'est le
// chemin Pointage qui l'éprouve — il extrait cette même primitive de
// `nexus-auth.js` et la fait dater sans fuseau. D'où le second test ici : il
// mesure le même fichier, par l'autre porte.
const TESTS_FUSEAU = [
  'test_fuseau_station_20260918.js',
  'test_jour_metier_pointage_20260919.js',
];

// 18/09/2026, SECOND LOT — TROISIÈME CAMPAGNE.
// `nexusEcranOperationnelAtteignable` vit dans `nexus-auth.js`, à côté des
// deux gardes qu'elle résume, mais c'est la suite de l'ACCUEIL qui la mesure
// (elle l'extrait et l'exécute telle quelle). D'où un troisième couple
// fichier/tests : muter la règle dans l'écran serait viser à côté, et la
// laisser hors campagne serait rendre la garde muette — le défaut même que
// cet outil existe pour trouver.
const MUTATIONS_REGLE = [
  ['G1 · la seconde porte n’est plus regardée',
   'return !!e.arriveePointeeJour;',
   'return true;'],
  ['G2 · un site sans pointage exige quand même l’arrivée',
   'if(e.pointageActif === false) return true;',
   'if(false) return true;'],
  ['G3 · défaut inversé : un réseau muet promet l’écran',
   'if(e.pointageActif === false) return true;',
   'if(e.pointageActif !== true) return true;'],
  ['G4 · manager et consultation externe ne sont plus exemptés',
   'if(e.estManager || e.consultationExterne) return true;',
   'if(false) return true;'],
  ['G5 · la première porte s’ouvre sans service',
   'if(!e.enService) return false;',
   'if(false) return false;'],
];

const TESTS_REGLE = ['test_accueil_hors_service_20260918.js'];

// Les fichiers que toute racine mutée doit porter : l'écran et `nexus-auth.js`
// parce qu'ils sont mutés, `nexus-pointage-regles.js` parce que les deux en
// dépendent et qu'une règle absente rougirait pour la mauvaise raison.
const FICHIERS_RACINE = [ECRAN, 'nexus-auth.js', 'nexus-pointage-regles.js'];
const SOURCES = {};
FICHIERS_RACINE.forEach(f => { SOURCES[f] = fs.readFileSync(path.join(RACINE, f), 'utf8'); });

function lancerUn(test, racine) {
  try {
    const sortie = execFileSync('node', [path.join(RACINE, test)], {
      cwd: RACINE, timeout: 180000, encoding: 'utf8',
      // Les tests de l'accueil ne désignent pas l'écran de la même façon :
      // celui du 18/09 prend une racine, celui du 14/09 un chemin de fichier.
      // Passer les deux est ce qui permet à la mutation de les atteindre tous
      // les deux — sans NEXUS_SOURCE_APP, le second lirait le fichier de
      // travail non muté et resterait vert sans rien prouver.
      env: Object.assign({}, process.env, {
        NEXUS_RACINE: racine,
        NEXUS_SOURCE_APP: path.join(racine, ECRAN),
      }),
    });
    return { code: 0, sortie: sortie.trim() };
  } catch (e) {
    return {
      code: e.status === undefined ? 1 : e.status,
      sortie: String(e.stdout || '') + String(e.stderr || ''),
    };
  }
}

// Une mutation est tuée dès qu'un test rougit ; on rapporte lequel, parce que
// « quelque chose a échoué » ne dit pas quelle règle a mordu.
function lancer(racine, tests) {
  const rouges = [];
  for (const test of tests) {
    const r = lancerUn(test, racine);
    if (r.code !== 0) rouges.push(Object.assign({ test }, r));
  }
  return { code: rouges.length ? 1 : 0, rouges };
}

const resume = r => r.rouges.length
  ? r.rouges.map(x => {
      const ligne = x.sortie.split('\n').reverse()
        .find(l => /contrôles verts|rouges|échec/i.test(l));
      return x.test.replace(/^test_|\.js$/g, '') + ' : '
        + (ligne ? ligne.trim() : '(sortie illisible, code ' + x.code + ')');
    }).join(' ; ')
  : 'tests verts';

function racineMutee(fichier, avant, apres) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-accueil-'));
  FICHIERS_RACINE.forEach(f => fs.copyFileSync(path.join(RACINE, f), path.join(tmp, f)));
  fs.writeFileSync(path.join(tmp, fichier), SOURCES[fichier].split(avant).join(apres));
  return tmp;
}

const tuees = [];
const survivantes = [];

function campagne(titre, mutations, fichier, tests) {
  console.log('');
  console.log(titre);

  // Témoin : sans mutation, les tests doivent être verts. Sinon la mesure qui
  // suit ne veut rien dire — un rouge ne prouverait pas que la mutation a mordu.
  const temoin = lancer(RACINE, tests);
  console.log('  TÉMOIN (aucune mutation) : ' + resume(temoin));
  if (temoin.code !== 0) {
    console.log('  Les tests ne sont pas verts sans mutation — mesure inexploitable.');
    temoin.rouges.forEach(x => console.log(x.sortie));
    process.exit(2);
  }

  for (const [nom, avant, apres] of mutations) {
    const occurrences = SOURCES[fichier].split(avant).length - 1;
    if (occurrences !== 1) {
      // Une garde muette est d'abord une mutation mal visée : un motif qui ne
      // s'applique plus se rapporte, il ne se tait pas.
      console.log('  ??          ' + nom + ' — motif introuvable ou ambigu ('
        + occurrences + ' occurrences), mutation NON APPLIQUÉE');
      survivantes.push(nom + ' (motif introuvable dans ' + fichier + ')');
      continue;
    }
    const tmp = racineMutee(fichier, avant, apres);
    try {
      const r = lancer(tmp, tests);
      if (r.code === 0) {
        console.log('  SURVIVANTE  ' + nom + ' — ' + resume(r));
        survivantes.push(nom);
      } else {
        console.log('  tuée        ' + nom + ' — ' + resume(r));
        tuees.push(nom);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

campagne('L\'ÉCRAN — ' + ECRAN, MUTATIONS, ECRAN, TESTS);
campagne('LA JOURNÉE MÉTIER — nexus-auth.js', MUTATIONS_FUSEAU, 'nexus-auth.js', TESTS_FUSEAU);
campagne('LA RÈGLE D\'ATTEIGNABILITÉ — nexus-auth.js', MUTATIONS_REGLE, 'nexus-auth.js', TESTS_REGLE);

console.log('');
console.log(tuees.length + ' mutations tuées, ' + survivantes.length + ' survivantes');
survivantes.forEach(s => console.log('  · survivante : ' + s));
process.exit(survivantes.length ? 1 : 0);
