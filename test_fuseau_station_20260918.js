// NEXUS — la journée métier suit le fuseau du SITE, jamais l'horloge de
// l'appareil (18/09/2026).
//
// LE DÉFAUT MESURÉ, ET POURQUOI IL N'ÉTAIT PAS QU'UN DÉFAUT D'AFFICHAGE
// --------------------------------------------------------------------
// Le 18/09, sur nexus-test, au même instant absolu (2026-09-15T02:00:00Z),
// même base, même employé, même site :
//
//     appareil America/Martinique -> jour 2026-09-14 -> service EN COURS
//     appareil Europe/Paris       -> jour 2026-09-15 -> « aucun poste »,
//                                    et UNE CLÔTURE ÉCRITE EN BASE
//
// Un employé qui ouvrait NEXUS depuis la métropole ne se contentait donc pas
// de mal lire son écran : il REFERMAIT le service encore actif d'un collègue
// resté à la station. Le commentaire de `nexusServiceCourant` nommait cette
// condition de chute depuis le 11/09 — « un appareil hors du fuseau de sa
// station ». Elle est arrivée.
//
// CE QUE CE TEST EXIGE
// --------------------
//   1. À instant identique, deux appareils quelconques prennent la MÊME
//      décision pour le MÊME site — jour métier, service retenu, clôtures.
//   2. La décision suit `station_config.fuseau_horaire` du SITE : changer le
//      fuseau du site change la décision, changer celui de l'appareil ne la
//      change jamais. Un test qui ne vérifierait que le premier point serait
//      vert sur un code qui aurait simplement figé la Martinique en dur.
//   3. La clôture des services RÉELLEMENT anciens est conservée, motif
//      `jour_precedent` : corriger le fuseau ne devait pas désarmer le ménage.
//
// COMMENT IL LE MESURE — DEUX PRÉCAUTIONS QUI FONT TOUTE LA VALEUR
// ---------------------------------------------------------------
// · L'HORLOGE DE L'APPAREIL EST CELLE DU PROCESSUS. `process.env.TZ` modifié
//   en cours d'exécution ne déplace pas toujours l'horloge déjà résolue par
//   Node : ce fichier se RELANCE donc en sous-processus, une fois par fuseau
//   d'appareil éprouvé. C'est un vrai appareil à Paris et un vrai appareil en
//   Martinique, pas une simulation de leur différence.
// · LE CODE EXÉCUTÉ EST CELUI QUI EST LIVRÉ. Les primitives de fuseau et
//   `nexusServiceCourant` sont EXTRAITES de `nexus-auth.js`, jamais recopiées.
//   Seule `nexusCloturerServicesObsoletes` est remplacée par un témoin : ce
//   qu'on éprouve ici est la DÉCISION de refermer (quels services, quel
//   motif), pas la mécanique d'écriture, inchangée et gardée ailleurs. Le
//   faux client lève à la moindre écriture directe.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = process.env.NEXUS_RACINE || __dirname;
const SRC_AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
const NexusPointageRegles = require(path.join(RACINE, 'nexus-pointage-regles.js'));

// L'instant du constat, à la seconde près. Il n'est pas choisi au hasard :
// c'est celui qui, en Martinique, tombe la veille de ce qu'il est à Paris.
const INSTANT = '2026-09-15T02:00:00Z';

// Les appareils éprouvés. Paris et Martinique sont exigés par l'arbitrage ;
// Auckland est là parce qu'« à instant identique, deux appareils QUELCONQUES »
// est la règle, et qu'un fuseau au-delà de la ligne de changement de date est
// le pire cas possible.
const APPAREILS = ['America/Martinique', 'Europe/Paris', 'Pacific/Auckland'];

const SERVICE_DU_JOUR_STATION = {
  id: 'svc-du-jour', role: 'caissiere', quart: 'matin',
  heure_debut: '2026-09-14T13:46:43Z', site_id: 'site-1', statut: 'en_cours',
};
const SERVICE_REELLEMENT_ANCIEN = {
  id: 'svc-ancien', role: 'pompiste', quart: 'matin',
  heure_debut: '2026-09-11T13:00:00Z', site_id: 'site-1', statut: 'en_cours',
};
// Un service daté du LENDEMAIN du jour station. Il n'est pas une curiosité de
// test : une horloge d'appareil déréglée au moment de la prise de poste, une
// saisie d'avance, ou simplement un site dont le fuseau est corrigé après coup
// suffisent à en produire un. Vu de Martinique à l'INSTANT du test, son jour
// métier est le 15 alors que la station est encore au 14.
const SERVICE_DU_LENDEMAIN_STATION = {
  id: 'svc-demain', role: 'caissiere', quart: 'matin',
  heure_debut: '2026-09-15T13:00:00Z', site_id: 'site-1', statut: 'en_cours',
};

const SCENARIOS = [
  {
    cle: 'S1', quoi: 'site en Martinique, service ouvert le jour même (heure station)',
    fuseauSite: 'America/Martinique', shifts: [SERVICE_DU_JOUR_STATION],
    attendu: { jourStation: '2026-09-14', service: 'svc-du-jour', clotures: [] },
  },
  {
    cle: 'S2', quoi: 'site en Martinique, service réellement ancien (3 jours)',
    fuseauSite: 'America/Martinique', shifts: [SERVICE_REELLEMENT_ANCIEN],
    attendu: { jourStation: '2026-09-14', service: null, clotures: [['svc-ancien', 'jour_precedent']] },
  },
  {
    cle: 'S3', quoi: 'site en Martinique, aucun service ouvert',
    fuseauSite: 'America/Martinique', shifts: [],
    attendu: { jourStation: '2026-09-14', service: null, clotures: [] },
  },
  {
    // Le contre-épreuve du point 2 : MÊME instant, MÊMES lignes qu'en S1, mais
    // un site déclaré en métropole. La décision doit changer — sinon le fuseau
    // de la station n'est pas lu, il est supposé.
    cle: 'S4', quoi: 'site déclaré à Paris, mêmes lignes que S1',
    fuseauSite: 'Europe/Paris', shifts: [SERVICE_DU_JOUR_STATION],
    attendu: { jourStation: '2026-09-15', service: null, clotures: [['svc-du-jour', 'jour_precedent']] },
  },
  {
    cle: 'S5', quoi: 'site sans fuseau configuré — repli ultramarin',
    fuseauSite: null, shifts: [SERVICE_DU_JOUR_STATION],
    attendu: { jourStation: '2026-09-14', service: 'svc-du-jour', clotures: [] },
  },
  {
    cle: 'S6', quoi: 'fuseau configuré illisible — repli ultramarin, jamais l’appareil',
    fuseauSite: 'Mars/Olympus_Mons', shifts: [SERVICE_DU_JOUR_STATION],
    attendu: { jourStation: '2026-09-14', service: 'svc-du-jour', clotures: [] },
  },
  {
    // LE SYMÉTRIQUE DE S2, ET C'EST TOUT L'ENJEU. `jour différent` n'est pas
    // `jour antérieur` : le service du 15 n'est pas le service du jour de la
    // station, donc il n'est pas RETENU — mais il ne doit pas être REFERMÉ
    // pour autant. La clôture écrit en base, sans geste humain, au simple
    // retour dans l'application.
    cle: 'S7', quoi: 'site en Martinique, service daté du LENDEMAIN du jour station',
    fuseauSite: 'America/Martinique', shifts: [SERVICE_DU_LENDEMAIN_STATION],
    attendu: { jourStation: '2026-09-14', service: null, clotures: [] },
  },
  {
    // La même ligne, vue d'un site déclaré à Paris : elle devient le service
    // du jour. La frontière se déplace donc dans les DEUX sens avec le fuseau
    // du site — S4 le montrait vers le passé, S8 le montre vers l'avenir.
    cle: 'S8', quoi: 'site déclaré à Paris, mêmes lignes que S7',
    fuseauSite: 'Europe/Paris', shifts: [SERVICE_DU_LENDEMAIN_STATION],
    attendu: { jourStation: '2026-09-15', service: 'svc-demain', clotures: [] },
  },
  {
    // LE CAS QUI FAIT VRAIMENT PEUR. Le ménage n'est déclenché que s'il existe
    // au moins un service ouvert hors du jour ; ici le vieux service l'ouvre,
    // et la liste à refermer est alors calculée sur TOUS les services ouverts.
    // Le service du futur doit traverser ce ménage sans une écriture.
    cle: 'S9', quoi: 'site en Martinique, un vrai ancien ET un service du lendemain',
    fuseauSite: 'America/Martinique',
    shifts: [SERVICE_REELLEMENT_ANCIEN, SERVICE_DU_LENDEMAIN_STATION],
    attendu: { jourStation: '2026-09-14', service: null, clotures: [['svc-ancien', 'jour_precedent']] },
  },
];

// ---------------------------------------------------------------------------
// OUTILLAGE
// ---------------------------------------------------------------------------

// Extraction par comptage d'accolades : le test exécute le code livré, jamais
// une doublure qui le rendrait vert sur un écran cassé.
function extraireFonction(entete, source) {
  const i = source.indexOf(entete);
  assert.ok(i !== -1, `« ${entete} » introuvable dans nexus-auth.js`);
  let prof = 0;
  for (let k = source.indexOf('{', i); k < source.length; k++) {
    if (source[k] === '{') prof++;
    else if (source[k] === '}' && --prof === 0) return source.slice(i, k + 1);
  }
  throw new Error(`« ${entete} » n'est pas refermée`);
}

// L'instant est figé, l'horloge de l'appareil ne l'est pas : `new Date(...)`
// avec un argument reste la vraie construction, et `instanceof Date` continue
// de répondre vrai — `nexusJourDansFuseau` en dépend.
function horlogeFigee(iso) {
  const Reel = Date;
  const t = Reel.parse(iso);
  function Fige(...a) {
    if (!new.target) return Reel(...a);
    return a.length ? new Reel(...a) : new Reel(t);
  }
  Fige.prototype = Reel.prototype;
  Fige.now = () => t;
  Fige.parse = Reel.parse;
  Fige.UTC = Reel.UTC;
  return Fige;
}

function faireClient(fuseauSite, shifts) {
  const refuser = (table, methode) => () => {
    throw new Error(`ÉCRITURE INTERDITE pendant la lecture du service : ${table}.${methode}`);
  };
  return {
    from(table) {
      const rep = () => Promise.resolve(
        table === 'shifts' ? { data: shifts, error: null } : { data: [], error: null });
      const chaine = {
        select: () => chaine, eq: () => chaine, order: () => chaine, limit: () => chaine,
        maybeSingle: () => Promise.resolve(
          table === 'station_config'
            ? { data: { fuseau_horaire: fuseauSite }, error: null }
            : { data: null, error: null }),
        then: (res, rej) => rep().then(res, rej),
      };
      ['insert', 'update', 'upsert', 'delete'].forEach(m => { chaine[m] = refuser(table, m); });
      return chaine;
    },
    rpc: refuser('*', 'rpc'),
  };
}

// `nexus-auth.js` n'est pas un module : on en monte la portée à la main, avec
// exactement les fonctions dont `nexusServiceCourant` a besoin.
function monterAuth(client, cloturer) {
  const defaut = (SRC_AUTH.match(/const NEXUS_FUSEAU_DEFAUT = '([^']+)'/) || [])[1] || '';
  assert.ok(defaut, 'NEXUS_FUSEAU_DEFAUT introuvable dans nexus-auth.js');
  return new Function(
    'Date', 'console', 'nexusClient', 'NexusPointageRegles', 'nexusCloturerServicesObsoletes',
    [
      `const NEXUS_FUSEAU_DEFAUT = ${JSON.stringify(defaut)};`,
      'const nexusFuseauxSite = new Map();',
      extraireFonction('function nexusFuseauValide(', SRC_AUTH),
      extraireFonction('function nexusRetenirFuseau(', SRC_AUTH),
      extraireFonction('function nexusJourDansFuseau(', SRC_AUTH),
      extraireFonction('async function nexusFuseauSite(', SRC_AUTH),
      extraireFonction('async function nexusServiceCourant(', SRC_AUTH),
      'return { NEXUS_FUSEAU_DEFAUT, nexusJourDansFuseau, nexusFuseauSite, nexusServiceCourant };',
    ].join('\n'),
  )(horlogeFigee(INSTANT), { error() {}, info() {} }, client, NexusPointageRegles, cloturer);
}

// ---------------------------------------------------------------------------
// L'OBSERVATION — ce que cet appareil-ci décide, pour chaque scénario
// ---------------------------------------------------------------------------
async function observer() {
  const releve = {};
  for (const sc of SCENARIOS) {
    const clotures = [];
    const auth = monterAuth(
      faireClient(sc.fuseauSite, sc.shifts),
      async (employee, services) => {
        // Le témoin enregistre la DÉCISION, dans l'ordre où elle est prise.
        services.forEach(o => clotures.push([o.service.id, o.motif]));
        return { closes: services.length, tentees: services.length, refuses: [] };
      });
    const employee = { id: 'emp-1', site_id: 'site-1' };
    const r = await auth.nexusServiceCourant(employee);
    releve[sc.cle] = {
      jourStation: auth.nexusJourDansFuseau(new Date(INSTANT), await auth.nexusFuseauSite('site-1')),
      service: r && r.service ? r.service.id : null,
      erreur: !!(r && r.erreur),
      clotures,
    };
  }
  return releve;
}

// ---------------------------------------------------------------------------
// SOUS-PROCESSUS : un appareil = un processus, avec SA variable TZ
// ---------------------------------------------------------------------------
if (process.env.NEXUS_APPAREIL_TZ) {
  observer().then(
    releve => { process.stdout.write('RELEVE ' + JSON.stringify(releve) + '\n'); },
    e => { console.error(e && e.stack || e); process.exit(2); });
  return;
}

let ok = 0;
const echecs = [];
function verifier(quoi, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) { ok++; return; }
  echecs.push(`${quoi}\n      attendu : ${JSON.stringify(attendu)}\n      obtenu  : ${JSON.stringify(obtenu)}`);
}
function verifierQue(quoi, condition, detail) {
  if (condition) { ok++; return; }
  echecs.push(`${quoi}${detail ? `\n      ${detail}` : ''}`);
}

function releverSous(tz) {
  const sortie = execFileSync(process.execPath, [__filename], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { TZ: tz, NEXUS_APPAREIL_TZ: tz }),
  });
  const ligne = sortie.split('\n').find(l => l.startsWith('RELEVE '));
  assert.ok(ligne, `aucun relevé rendu par l'appareil ${tz}`);
  return JSON.parse(ligne.slice('RELEVE '.length));
}

console.log('— NEXUS · le jour métier suit le fuseau du site (18/09/2026) —');
console.log(`  instant unique : ${INSTANT}`);

const releves = {};
for (const tz of APPAREILS) releves[tz] = releverSous(tz);

// 1. L'ÉGALITÉ DE DÉCISION — l'exigence littérale de l'arbitrage.
const reference = APPAREILS[0];
for (const tz of APPAREILS.slice(1)) {
  verifier(
    `Décision identique à instant identique : ${tz} doit décider comme ${reference}`,
    releves[tz], releves[reference]);
}

// 2. LE CONTENU DE CETTE DÉCISION — sans quoi « identique » pourrait être
//    identiquement faux sur les trois appareils.
for (const sc of SCENARIOS) {
  for (const tz of APPAREILS) {
    const r = releves[tz][sc.cle];
    verifier(`${sc.cle} (${tz}) · jour métier — ${sc.quoi}`, r.jourStation, sc.attendu.jourStation);
    verifier(`${sc.cle} (${tz}) · service retenu`, r.service, sc.attendu.service);
    verifier(`${sc.cle} (${tz}) · clôtures décidées`, r.clotures, sc.attendu.clotures);
    verifierQue(`${sc.cle} (${tz}) · aucune erreur de lecture`, r.erreur === false);
  }
}

// 3. LA CLÔTURE DES SERVICES RÉELLEMENT ANCIENS EST CONSERVÉE.
verifierQue('Un service de trois jours est toujours refermé, motif `jour_precedent`',
  APPAREILS.every(tz => releves[tz].S2.clotures.length === 1
    && releves[tz].S2.clotures[0][1] === 'jour_precedent'),
  'la correction de fuseau ne doit pas désarmer le ménage des vieux services');

// 4. LE SERVICE DU JOUR DE LA STATION N'EST JAMAIS REFERMÉ, DEPUIS AUCUN
//    APPAREIL. C'est l'écriture indue constatée le 18/09.
verifierQue('Aucun appareil ne referme le service ouvert le jour même de la station',
  APPAREILS.every(tz => releves[tz].S1.clotures.length === 0),
  'un appareil hors du fuseau de sa station déclenchait cette écriture');

// 4 bis. UN SERVICE DU FUTUR RESTE INTACT, DEPUIS AUCUN APPAREIL ET DANS
//    AUCUNE CONFIGURATION. Le critère s'écrivait « jour DIFFÉRENT du jour
//    station » : il attrapait donc aussi l'avenir, sous le motif
//    `jour_precedent` — un motif faux, et une écriture (`statut`,
//    `cloture_source`, `cloture_motif`, `cloture_par`) sur un service qui
//    n'avait pas commencé.
verifierQue('Aucun appareil ne referme un service daté du futur',
  APPAREILS.every(tz => releves[tz].S7.clotures.length === 0),
  'la clôture ne doit mordre que sur le jour PASSÉ, jamais sur un jour à venir');
verifierQue('Un service du futur n’est pas non plus RETENU comme service du jour',
  APPAREILS.every(tz => releves[tz].S7.service === null),
  'ne pas le refermer ne veut pas dire le prendre pour le quart en cours');
verifierQue('Le ménage déclenché par un vrai ancien n’emporte pas le service du futur',
  APPAREILS.every(tz => releves[tz].S9.clotures.length === 1
    && releves[tz].S9.clotures[0][0] === 'svc-ancien'),
  'S9 : le vieux service ouvre le ménage, celui du lendemain doit le traverser intact');
verifierQue('Le fuseau du site déplace la frontière vers l’avenir aussi (S7 / S8)',
  APPAREILS.every(tz => releves[tz].S7.service === null && releves[tz].S8.service === 'svc-demain'),
  'mêmes lignes, deux sites : le jour métier n’est pas une propriété de la ligne');

// 5. LE FUSEAU LU EST CELUI DU SITE, PAS UNE CONSTANTE.
verifierQue('Changer le fuseau du site change la décision (S1 en Martinique / S4 à Paris)',
  APPAREILS.every(tz => releves[tz].S1.jourStation !== releves[tz].S4.jourStation),
  'sans cette différence, le fuseau du site ne serait pas lu mais supposé');

// 6. LE REPLI RESTE ULTRAMARIN. Se tromper vers l'Europe AVANCE la journée,
//    donc referme des services encore ouverts : c'est le défaut corrigé.
verifierQue('Le repli de `nexus-auth.js` est une station ultramarine',
  /const NEXUS_FUSEAU_DEFAUT = 'America\/Martinique'/.test(SRC_AUTH));
verifierQue('`nexusDateLocaleISO` ne survit pas en alias',
  !/function nexusDateLocaleISO/.test(SRC_AUTH),
  'un motif faux survit à sa propre péremption : la fonction est supprimée, pas conservée');

// 7. L'ÉCRAN LUI-MÊME. La suite de l'accueil, complète, doit être verte quel
//    que soit le fuseau de l'appareil qui l'exécute.
const SUITE = path.join(RACINE, 'test_accueil_hors_service_20260918.js');
if (fs.existsSync(SUITE)) {
  for (const tz of ['Europe/Paris', 'America/Martinique']) {
    let sortie = '';
    let code = 0;
    try {
      sortie = execFileSync(process.execPath, [SUITE], {
        encoding: 'utf8', env: Object.assign({}, process.env, { TZ: tz }),
      });
    } catch (e) { sortie = (e.stdout || '') + (e.stderr || ''); code = e.status || 1; }
    const bilan = (sortie.split('\n').find(l => l.includes('contrôles verts')) || '').trim();
    verifierQue(`L'accueil employé est vert sur un appareil ${tz} — ${bilan || 'aucun bilan'}`,
      code === 0 && /0 rouges/.test(sortie));
  }
}

console.log('');
if (echecs.length) {
  echecs.forEach(e => console.log(`  ✗ ${e}`));
  console.log(`\n${ok} contrôles verts, ${echecs.length} rouges`);
  process.exit(1);
}
console.log(`${ok} contrôles verts, 0 rouges`);
