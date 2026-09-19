// NEXUS — l'accueil employé hors service (18/09/2026).
//
// CE QUE CE TEST GARDE, ET POURQUOI IL EXISTE
// -------------------------------------------
// Depuis le 16/09/2026, l'accueil (`NEXUS-App-v1.html`) est en catégorie
// `consultation` : on peut l'ouvrir SANS avoir pris son poste. L'écran, lui,
// était resté écrit pour quelqu'un en service. Il annonçait donc, à un
// employé qui n'avait encore rien ouvert :
//   · « Votre service est en cours · 3 actions à terminer » ;
//   · une prochaine action « Pointer l'arrivée », alors que le premier geste
//     est de prendre son poste ;
//   · un inventaire, un contrôle FDJ, une réception carburant — des contrôles
//     de quart sans quart ;
//   · des tuiles Missions / Inventaire / FDJ qui REBONDISSENT, puisque
//     nexus-auth.js renvoie toute page `operationnel` vers la prise de poste.
//
// LA NOTION ARBITRÉE — `enService` : le service ouvert AUJOURD'HUI, et lui
// seul. Un quart laissé ouvert la veille n'est pas le service du jour (même
// règle que l'écran Pointage, arbitrage du 11/09/2026). Tout le reste en
// découle : les quatre applicabilités, le pointage, la barre de progression,
// la prochaine action, la phrase du Coach, les tuiles et la ligne de statut.
//
// CE QUE CE TEST NE FAIT PAS. Il ne recopie aucune règle : il EXTRAIT de
// l'écran `initAccueilEmploye`, `renderDeuxChemins` et toute la tranche de
// calcul, puis les EXÉCUTE avec un faux DOM et un client Supabase de lecture
// seule — qui LÈVE si l'écran tente le moindre insert. L'accueil ne doit
// jamais écrire : « l'authentification n'est jamais une preuve de présence »,
// et le seul `insert` sur `shifts` du dépôt reste le bouton « Confirmer » de
// la prise de poste.
//
// Éprouvé par mutation : `node outils/mutation-accueil-hors-service.js`
// remet un à un les douze défauts corrigés et exige que ce test rougisse.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Racine surchargeable : l'outil de mutation exécute une COPIE mutée, jamais
// le fichier de travail.
const RACINE = process.env.NEXUS_RACINE || __dirname;
const ECRAN = 'NEXUS-App-v1.html';
const SRC = fs.readFileSync(path.join(RACINE, ECRAN), 'utf8');
const NexusPointageRegles = require(path.join(RACINE, 'nexus-pointage-regles.js'));

let ok = 0;
const echecs = [];
function verifier(cas, quoi, obtenu, attendu) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (bon) ok++;
  else echecs.push(`${cas} · ${quoi}\n      attendu : ${JSON.stringify(attendu)}\n      obtenu  : ${JSON.stringify(obtenu)}`);
}
function verifierQue(cas, quoi, condition, detail) {
  if (condition) ok++;
  else echecs.push(`${cas} · ${quoi}${detail ? '\n      ' + detail : ''}`);
}

// ---------------------------------------------------------------------------
// EXTRACTION — on exécute le code de l'écran, pas une copie
// ---------------------------------------------------------------------------
const lignes = SRC.split('\n');
function ligneDe(motif) {
  const i = lignes.findIndex(l => l.includes(motif));
  assert.ok(i !== -1, `« ${motif} » introuvable dans ${ECRAN}`);
  return i;
}

// La tranche de CALCUL : de la première constante de pointage jusqu'à la
// frontière que l'écran pose lui-même (« Rendu (DOM uniquement …) »).
const tranchePure = lignes
  .slice(ligneDe('const POINTAGE_MINI_LIBELLES'), ligneDe('// ---- Rendu (DOM uniquement'))
  .join('\n');

const EXPORTS_PURS = [
  'POINTAGE_MINI_LIBELLES', 'POINTAGE_MINI_TEXTES', 'POINTAGE_MINI_COULEURS',
  'CAPACITES_ROLE_DEFAUT', 'LIBELLE_ROLE_JOUR', 'TUILES_OUTILS_CATALOGUE',
  'roleADroitModule', 'calculerProchainPointage', 'calculerMissionsObligatoiresJour',
  'calculerControlesQuartJour', 'calculerEtapesProgressionService',
  'calculerPourcentageProgressionService', 'determinerProchaineActionEmploye',
  'determinerPhraseCoach', 'choisirTuilesOutilsQuart',
];
const purs = new Function(`${tranchePure}\nreturn {${EXPORTS_PURS.join(',')}};`)();

// Extraction par équilibrage d'accolades : une expression régulière se ferait
// piéger par la première accolade fermante venue.
function extraireFonction(entete, source, ou) {
  const src = source || SRC;
  const i = src.indexOf(entete);
  assert.ok(i !== -1, `« ${entete} » introuvable dans ${ou || ECRAN}`);
  let prof = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}' && --prof === 0) return src.slice(i, k + 1);
  }
  throw new Error(`« ${entete} » n'est pas refermée`);
}
const SRC_INIT = extraireFonction('async function initAccueilEmploye(');
const SRC_CHEMINS = extraireFonction('function renderDeuxChemins(');

// LE FUSEAU DE LA STATION (18/09/2026) — l'accueil n'en définit rien : il
// dépend des primitives de `nexus-auth.js`, chargé par tous les écrans. On
// exécute donc CES fonctions-là, jamais une doublure qui rendrait le test
// vert sur un écran cassé. C'est la même doctrine que `tranchePure` : le test
// éprouve le code livré.
const SRC_AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');
const fuseaux = new Function('nexusClient', [
  'const NEXUS_FUSEAU_DEFAUT = ' + JSON.stringify(
    (SRC_AUTH.match(/const NEXUS_FUSEAU_DEFAUT = '([^']+)'/) || [])[1] || '') + ';',
  'const nexusFuseauxSite = new Map();',
  'const console = { error() {} };',
  extraireFonction('function nexusFuseauValide(', SRC_AUTH, 'nexus-auth.js'),
  extraireFonction('function nexusRetenirFuseau(', SRC_AUTH, 'nexus-auth.js'),
  extraireFonction('function nexusJourDansFuseau(', SRC_AUTH, 'nexus-auth.js'),
  extraireFonction('async function nexusFuseauSite(', SRC_AUTH, 'nexus-auth.js'),
  'return { NEXUS_FUSEAU_DEFAUT, nexusJourDansFuseau, nexusFuseauSite, nexusFuseauxSite };',
].join('\n'));
assert.ok(/America\/Martinique/.test(SRC_AUTH),
  'le repli de fuseau de nexus-auth.js doit rester une station ultramarine');

// LA RÈGLE D'ATTEIGNABILITÉ (18/09/2026, second lot) — même doctrine encore :
// `nexusEcranOperationnelAtteignable` est extraite de nexus-auth.js et
// exécutée telle quelle. Une doublure locale rendrait ce test vert alors que
// l'accueil promettrait toujours des écrans que les deux gardes referment.
const nexusEcranOperationnelAtteignable = new Function([
  extraireFonction('function nexusEcranOperationnelAtteignable(', SRC_AUTH, 'nexus-auth.js'),
  'return nexusEcranOperationnelAtteignable;',
].join('\n'))();

// ---------------------------------------------------------------------------
// DOUBLURES — un DOM qui enregistre, un client qui refuse d'écrire
// ---------------------------------------------------------------------------
function faireDom() {
  const elements = new Map();
  const journal = { textes: {}, styles: {} };
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          style: new Proxy({}, { set(o, k, v) { o[k] = v; journal.styles[`${id}.${k}`] = v; return true; } }),
          set textContent(v) { journal.textes[id] = v; },
          get textContent() { return journal.textes[id]; },
          innerHTML: '', href: '', className: '',
          classList: { add() {}, remove() {}, toggle() {} },
          addEventListener() {},
        });
      }
      return elements.get(id);
    },
  };
  return { document, journal };
}

function faireClient(reponses) {
  const refuser = (table, methode) => () => {
    throw new Error(`ÉCRITURE INTERDITE depuis l'accueil : ${table}.${methode}`);
  };
  return {
    from(table) {
      const rep = () => Promise.resolve(reponses[table] || { data: [], error: null });
      const chaine = {
        select: () => chaine, eq: () => chaine, order: () => chaine, limit: () => chaine,
        maybeSingle: () => Promise.resolve(reponses[table] || { data: null, error: null }),
        then: (res, rej) => rep().then(res, rej),
      };
      ['insert', 'update', 'upsert', 'delete', 'rpc'].forEach(m => { chaine[m] = refuser(table, m); });
      return chaine;
    },
    rpc: refuser('*', 'rpc'),
  };
}

async function executerAccueil({
  employee, roleDuJour, pointageActifSite, quartDuJour, serviceCourant,
  reponses = {}, forfait = 'professional', receptionRole = 'aucun',
  jaugeageActif = false, statutJaugeage = null,
}) {
  const { document, journal } = faireDom();
  const rendus = {};
  // Le fuseau est relu pour CHAQUE cas : le cache de `nexus-auth.js` est
  // volontairement reconstruit ici, sinon un cas contaminerait le suivant.
  const auth = fuseaux(faireClient(reponses));
  const noms = [
    'document', 'console', 'nexusClient', 'nexusFuseauSite', 'nexusJourDansFuseau',
    'NexusForfait', 'NexusPointageRegles',
    'NexusCarburantDonnees', 'chargerReceptionCarburantRole', 'chargerJaugeageCarburantActifSite',
    'renderProgressionService', 'renderProchaineAction', 'renderOutilsQuart',
    'nexusEcranOperationnelAtteignable',
    ...EXPORTS_PURS,
  ];
  const valeurs = [
    document, { error() {} }, faireClient(reponses),
    auth.nexusFuseauSite, auth.nexusJourDansFuseau,
    { chargerForfait: async () => forfait, estProfessional: f => f === 'professional' },
    NexusPointageRegles,
    { chargerStatutJaugeageJour: async () => statutJaugeage },
    async () => receptionRole,
    async () => jaugeageActif,
    etapes => { rendus.etapes = etapes; rendus.pct = purs.calculerPourcentageProgressionService(etapes); },
    action => { rendus.action = action; },
    (codes, libelleRole, titreSection) => { Object.assign(rendus, { tuiles: codes, libelleRole, titreSection }); },
    nexusEcranOperationnelAtteignable,
    ...EXPORTS_PURS.map(n => purs[n]),
  ];
  // Le `ctx` réellement construit par l'orchestrateur est capté au passage.
  // Sans lui, les gardes `enService` des quatre applicabilités et du pointage
  // ne sont observables par aucun rendu — elles sont couvertes en aval par
  // d'autres gardes — et une garde qu'aucune mesure ne voit tomber n'est pas
  // testée, elle est seulement supposée. La mutation le montrait : quatre
  // survivantes avant cette ligne.
  const iTuiles = noms.indexOf('choisirTuilesOutilsQuart');
  const vraiChoisir = valeurs[iTuiles];
  valeurs[iTuiles] = ctx => { rendus.ctx = ctx; return vraiChoisir(ctx); };

  const init = new Function(...noms, `return ${SRC_INIT};`)(...valeurs);
  await init(employee, roleDuJour, pointageActifSite, quartDuJour, serviceCourant);
  return { rendus, journal };
}

function executerDeuxChemins(employee, serviceCourant, estNiveauManager) {
  const { document } = faireDom();
  new Function('document', 'LIBELLE_ROLE_JOUR', `return ${SRC_CHEMINS};`)(document, purs.LIBELLE_ROLE_JOUR)(
    employee, serviceCourant, estNiveauManager);
  return document.getElementById('deuxChemins').innerHTML;
}

// ---------------------------------------------------------------------------
// JEUX D'ESSAI
// ---------------------------------------------------------------------------
const AUJOURDHUI = new Date();
const service = (role, quart = 'matin', joursEnArriere = 0) => ({
  id: `svc-${role}`, role, quart,
  heure_debut: new Date(AUJOURDHUI.getTime() - joursEnArriere * 86400000).toISOString(),
  site_id: 'site-1', statut: 'en_cours',
});
const employe = (extra = {}) => ({ id: 'emp-1', site_id: 'site-1', ...extra });
const catalogue = role => [
  { mission_id: 'm1', role_required: [role], disponibilite: 'obligatoire', time_window: null },
  { mission_id: 'm2', role_required: [role], disponibilite: 'obligatoire', time_window: null },
  { mission_id: 'm3', role_required: [role], disponibilite: 'libre', time_window: null },
];

async function cas(nom, entree, controles) {
  let resultat;
  try {
    resultat = await executerAccueil(entree);
  } catch (e) {
    echecs.push(`${nom} · EXCEPTION\n      ${e.message}`);
    return;
  }
  controles({
    ...resultat,
    verifier: (q, o, a) => verifier(nom, q, o, a),
    verifierQue: (q, c, d) => verifierQue(nom, q, c, d),
  });
}

(async () => {

  // =========================================================================
  // A. HORS SERVICE — ce que voit Angélique en ouvrant NEXUS le matin
  // =========================================================================

  // Le site est réglé au plus large — réception carburant côté employé ET
  // jaugeage actif — pour que « hors service » soit la SEULE raison possible
  // de ne rien prescrire : avec un site restrictif, la mesure passerait au
  // vert sans rien prouver.
  await cas('A1 · aucun poste ouvert (pompiste, site au plus large)', {
    employee: employe(), roleDuJour: 'pompiste', pointageActifSite: true,
    quartDuJour: 'matin', serviceCourant: null,
    receptionRole: 'employe', jaugeageActif: true,
    reponses: { mission_catalog: { data: catalogue('pompiste'), error: null } },
  }, ({ rendus, journal, verifier, verifierQue }) => {
    verifier('barre de progression masquée', rendus.pct, null);
    verifier('prochaine action',
      rendus.action.titre, 'Aucun poste n’est ouvert. Prenez votre poste pour démarrer votre service.');
    verifier('lien de la prochaine action', rendus.action.lien, 'NEXUS-Prise-De-Poste-v1.html');
    verifier('libellé du bouton', rendus.action.lienTexte, 'Prendre mon poste →');
    verifier('tuiles réellement atteignables', rendus.tuiles, ['prisedeposte', 'planning', 'evolution', 'progression']);
    verifier('titre de section', rendus.titreSection, 'Mes écrans');
    verifier('phrase du Coach', journal.textes.conseillerEmployeTexte,
      'Commencez par prendre votre poste : votre rôle du jour, vos missions et vos contrôles en découlent.');
    verifierQue('ligne de statut : aucun poste en cours',
      journal.textes.conseillerEmployeStatut.includes('Aucun poste en cours'),
      journal.textes.conseillerEmployeStatut);
    verifierQue('aucune action fantôme décomptée',
      !/action/.test(journal.textes.conseillerEmployeStatut),
      journal.textes.conseillerEmployeStatut);
    // Les quatre applicabilités et le pointage, mesurés sur le ctx lui-même :
    // hors service, un contrôle de quart ne doit pas seulement être masqué,
    // il ne doit pas EXISTER.
    verifier('inventaire non applicable', rendus.ctx.inventaireApplicable, false);
    verifier('FDJ non applicable', rendus.ctx.fdjApplicable, false);
    verifier('réception carburant non applicable', rendus.ctx.receptionApplicable, false);
    verifier('jaugeage non applicable', rendus.ctx.jaugeageApplicable, false);
    verifier('aucun contrôle de quart compté', rendus.ctx.controlesInfo.total, 0);
    verifier('pointage neutralisé hors service', rendus.ctx.prochainPointage, null);
  });

  await cas('A2 · quart de la veille laissé ouvert', {
    employee: employe(), roleDuJour: 'pompiste', pointageActifSite: true,
    quartDuJour: 'matin', serviceCourant: service('pompiste', 'soir', 1),
    receptionRole: 'employe', jaugeageActif: true,
    reponses: { mission_catalog: { data: catalogue('pompiste'), error: null } },
  }, ({ rendus, verifier }) => {
    verifier('un quart de la veille n’est pas le service du jour', rendus.action.lienTexte, 'Prendre mon poste →');
    verifier('barre de progression masquée', rendus.pct, null);
    verifier('tuiles de repli', rendus.tuiles, ['prisedeposte', 'planning', 'evolution', 'progression']);
    verifier('aucun contrôle de quart compté', rendus.ctx.controlesInfo.total, 0);
    verifier('pointage neutralisé', rendus.ctx.prochainPointage, null);
  });

  await cas('A3 · consultation externe, hors service', {
    employee: employe({ consultation_externe: true }), roleDuJour: 'pompiste',
    pointageActifSite: true, quartDuJour: 'matin', serviceCourant: null,
  }, ({ rendus, journal, verifier, verifierQue }) => {
    verifierQue('aucune prise de poste proposée à un consultant externe',
      rendus.action.lien === null, JSON.stringify(rendus.action));
    verifier('tuiles sans prise de poste', rendus.tuiles, ['planning', 'evolution', 'progression']);
    verifier('phrase du Coach', journal.textes.conseillerEmployeTexte,
      'Vous consultez ce site sans y être en service.');
    verifierQue('statut « Consultation externe »',
      journal.textes.conseillerEmployeStatut.includes('Consultation externe'),
      journal.textes.conseillerEmployeStatut);
  });

  await cas('A4 · site sans pointage, aucun service', {
    employee: employe(), roleDuJour: 'caissiere', pointageActifSite: false,
    quartDuJour: 'matin', serviceCourant: null,
  }, ({ rendus, verifier }) => {
    verifier('barre de progression masquée', rendus.pct, null);
    verifier('prise de poste proposée quand même', rendus.action.lien, 'NEXUS-Prise-De-Poste-v1.html');
    verifier('aucun contrôle de quart compté', rendus.ctx.controlesInfo.total, 0);
  });

  // =========================================================================
  // B. EN SERVICE — le rôle du jour commande, et il est nommé
  // =========================================================================
  // L'arrivée est POINTÉE par défaut dans cette section (18/09/2026, second
  // lot). Ce n'est pas une commodité : sans elle, aucun écran opérationnel
  // n'est atteignable (seconde garde de nexusRequireAuth), les tuiles
  // retombent sur le repli « Pointer mon arrivée », et la section B
  // cesserait de mesurer ce qu'elle prétend mesurer — le rôle du jour. Le cas
  // « en service, arrivée non pointée » a désormais sa propre section E.
  const enService = (role, extra = {}) => ({
    employee: employe(), roleDuJour: role, pointageActifSite: true, quartDuJour: 'matin',
    serviceCourant: service(role),
    reponses: {
      mission_catalog: { data: catalogue(role), error: null },
      pointages: { data: [{ type: 'arrivee', service_id: `svc-${role}` }], error: null },
    },
    forfait: 'professional', receptionRole: 'employe', ...extra,
  });
  // Le même état, arrivée NON pointée — ce que voit un employé qui a pris son
  // poste mais n'a pas encore pointé.
  const enServiceSansArrivee = (role, extra = {}) => enService(role, {
    reponses: { mission_catalog: { data: catalogue(role), error: null } }, ...extra,
  });

  await cas('B1 · pompiste en service, arrivée pointée', enService('pompiste'),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('écrans opérationnels atteignables', rendus.ctx.operationnelAtteignable, true);
      verifierQue('barre de progression affichée', rendus.pct !== null, `pct = ${rendus.pct}`);
      verifier('libellé du rôle transmis aux tuiles', rendus.libelleRole, 'Pompiste');
      verifier('titre de section', rendus.titreSection, 'Mes outils du quart');
      verifierQue('tuile Missions en tête', rendus.tuiles[0] === 'missions', JSON.stringify(rendus.tuiles));
      verifierQue('inventaire applicable à un pompiste', rendus.tuiles.includes('inventaire'), JSON.stringify(rendus.tuiles));
      verifierQue('FDJ jamais prescrit à un pompiste', !rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
      verifierQue('statut préfixé du rôle du jour',
        journal.textes.conseillerEmployeStatut.startsWith('Pompiste · '),
        journal.textes.conseillerEmployeStatut);
    });

  await cas('B2 · caissière en service (FDJ, forfait Professional)', enService('caissiere'),
    ({ rendus, verifier, verifierQue }) => {
      verifierQue('FDJ prescrit à une caissière', rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
      verifier('libellé du rôle', rendus.libelleRole, 'Caissière');
    });

  await cas('B3 · caissière, forfait Essential', enService('caissiere', { forfait: 'essential' }),
    ({ rendus, verifierQue }) => {
      verifierQue('FDJ non prescrit hors Professional', !rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
    });

  await cas('B4 · renfort en service', enService('renfort'),
    ({ rendus, verifierQue }) => {
      verifierQue('pas d’inventaire pour un renfort', !rendus.tuiles.includes('inventaire'), JSON.stringify(rendus.tuiles));
      verifierQue('pas de FDJ pour un renfort', !rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
    });

  await cas('B5 · manager en service', enService('manager'),
    ({ rendus, verifier, verifierQue }) => {
      verifier('libellé du rôle', rendus.libelleRole, 'Manager');
      verifierQue('au plus quatre tuiles', rendus.tuiles.length <= 4, JSON.stringify(rendus.tuiles));
    });

  await cas('B6 · polyvalent en service', enService('polyvalent'),
    ({ rendus, journal, verifierQue }) => {
      verifierQue('libellé lisible', typeof rendus.libelleRole === 'string' && rendus.libelleRole.length > 0,
        String(rendus.libelleRole));
      verifierQue('statut préfixé du rôle',
        journal.textes.conseillerEmployeStatut.includes(' · '), journal.textes.conseillerEmployeStatut);
    });

  // Article 5 : un rôle inconnu ne provoque jamais un refus, et ne se traduit
  // pas non plus par du vide à l'écran.
  await cas('B7 · rôle du jour inconnu (Article 5)', enService('archiviste'),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('rôle affiché brut, jamais vide', rendus.libelleRole, 'archiviste');
      verifierQue('statut préfixé du rôle brut',
        journal.textes.conseillerEmployeStatut.startsWith('archiviste · '),
        journal.textes.conseillerEmployeStatut);
      verifierQue('l’écran reste utilisable',
        rendus.action !== undefined && rendus.tuiles.length > 0, JSON.stringify(rendus.tuiles));
    });

  // =========================================================================
  // C. ARRIVÉE POINTÉE, puis JOURNÉE TERMINÉE
  // =========================================================================
  await cas('C1 · pompiste, arrivée pointée', {
    ...enService('pompiste'),
    reponses: {
      mission_catalog: { data: catalogue('pompiste'), error: null },
      pointages: { data: [{ type: 'arrivee', service_id: 'svc-pompiste' }], error: null },
    },
  }, ({ rendus, verifierQue }) => {
    verifierQue('la prochaine action n’est plus l’arrivée',
      !/arriv/i.test(rendus.action.lienTexte || ''), JSON.stringify(rendus.action));
    verifierQue('barre de progression affichée', rendus.pct !== null, `pct = ${rendus.pct}`);
  });

  await cas('C2 · journée terminée (départ pointé, service refermé)', {
    employee: employe(), roleDuJour: 'pompiste', pointageActifSite: true, quartDuJour: 'matin',
    serviceCourant: null,
    reponses: {
      mission_catalog: { data: catalogue('pompiste'), error: null },
      pointages: {
        data: [{ type: 'arrivee', service_id: 'svc-clos' }, { type: 'depart', service_id: 'svc-clos' }],
        error: null,
      },
    },
  }, ({ rendus, journal, verifier, verifierQue }) => {
    verifier('phrase du Coach', journal.textes.conseillerEmployeTexte,
      'Votre journée est enregistrée — il n’y a plus rien à faire ici aujourd’hui.');
    verifierQue('statut « journée terminée »',
      journal.textes.conseillerEmployeStatut.includes('Votre journée est terminée'),
      journal.textes.conseillerEmployeStatut);
    verifierQue('aucune prise de poste proposée sur une journée close',
      !/Prendre mon poste/.test(rendus.action.lienTexte || ''), JSON.stringify(rendus.action));
    // Une journée terminée a bien eu lieu : elle s'affiche accomplie, elle ne
    // s'efface pas. C'est la limite exacte de « hors service ⇒ barre masquée »
    // (acquis du 14/09/2026, conservé le 18/09).
    verifier('barre de progression à 100 % — la journée accomplie reste visible', rendus.pct, 100);
    verifier('Ouverture cochée', rendus.etapes.find(e => e.code === 'ouverture').etat.statut, 'fait');
    verifier('Clôture cochée', rendus.etapes.find(e => e.code === 'cloture').etat.statut, 'fait');
  });

  // =========================================================================
  // P. LA SECONDE PORTE — « en service » ne suffit pas (18/09/2026, 2e lot)
  //
  // `nexusRequireAuth` pose DEUX questions. Le premier lot du 18/09 n'avait
  // fermé que la première (aucun service ouvert). Le parcours connecté sur
  // Test a montré la seconde, restée grande ouverte : S2 (pompiste) et S5
  // (caissière `professional`), en service mais arrivée non pointée,
  // recevaient les tuiles Missions, Inventaire, FDJ et Réception, et les
  // quatre écrans rebondissaient vers NEXUS-Pointage-v1.html. S6, arrivée
  // pointée, les ouvrait. Les cas ci-dessous sont ce relevé, figé.
  // =========================================================================
  await cas('P1 · pompiste en service, arrivée non pointée (défaut S2)',
    enServiceSansArrivee('pompiste'),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('écran opérationnel non atteignable', rendus.ctx.operationnelAtteignable, false);
      verifier('tuiles : le geste qui débloque, et rien qui rebondisse',
        rendus.tuiles, ['pointage', 'progression', 'planning', 'evolution']);
      verifier('titre de section', rendus.titreSection, 'Mes écrans');
      verifier('phrase du Coach', journal.textes.conseillerEmployeTexte,
        'Pointez votre arrivée : vos missions et vos contrôles s’ouvriront ensuite.');
      verifier('prochaine action = pointer l’arrivée', rendus.action.lienTexte, 'Pointer l’arrivée →');
      verifier('lien de la prochaine action', rendus.action.lien, 'NEXUS-Pointage-v1.html');
      // Ce qui reste VRAI : le service existe, et ses contrôles sont bien
      // applicables. Ils ne sont pas encore atteignables — c'est autre chose,
      // et la barre de progression continue donc de les compter.
      verifierQue('barre de progression affichée : le service a commencé',
        rendus.pct !== null, `pct = ${rendus.pct}`);
      verifier('inventaire toujours applicable', rendus.ctx.inventaireApplicable, true);
      verifierQue('statut : le service est bien en cours',
        journal.textes.conseillerEmployeStatut.includes('Pompiste · '),
        journal.textes.conseillerEmployeStatut);
    });

  await cas('P2 · caissière professional, arrivée non pointée (défaut S5)',
    enServiceSansArrivee('caissiere'),
    ({ rendus, verifier, verifierQue }) => {
      verifierQue('aucune tuile FDJ qui rebondirait',
        !rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
      verifierQue('aucune tuile Missions qui rebondirait',
        !rendus.tuiles.includes('missions'), JSON.stringify(rendus.tuiles));
      verifierQue('aucune tuile Inventaire qui rebondirait',
        !rendus.tuiles.includes('inventaire'), JSON.stringify(rendus.tuiles));
      // FDJ reste APPLICABLE — le forfait et le rôle n'ont pas changé. Le
      // contrôle est dû, il n'est simplement pas encore ouvrable.
      verifier('FDJ toujours applicable', rendus.ctx.fdjApplicable, true);
    });

  await cas('P3 · contre-témoin : la même caissière, arrivée pointée (S6)',
    enService('caissiere'),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('écrans opérationnels atteignables', rendus.ctx.operationnelAtteignable, true);
      verifierQue('FDJ de nouveau prescrit', rendus.tuiles.includes('fdj'), JSON.stringify(rendus.tuiles));
      verifier('titre de section', rendus.titreSection, 'Mes outils du quart');
      verifierQue('le Coach reprend le travail du quart',
        !/Pointez votre arrivée/.test(journal.textes.conseillerEmployeTexte),
        journal.textes.conseillerEmployeTexte);
    });

  // Un site qui a désactivé le pointage n'exige jamais l'arrivée : la garde
  // `nexusPointageArriveeManquant` s'y arrête d'elle-même
  // (`pointage_actif = false`). Promettre « Mes écrans » là serait un faux
  // blocage, aussi grave que la fausse promesse inverse.
  await cas('P4 · site sans pointage, service ouvert',
    enServiceSansArrivee('pompiste', { pointageActifSite: false }),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('atteignable sans arrivée', rendus.ctx.operationnelAtteignable, true);
      verifierQue('tuile Missions rendue', rendus.tuiles.includes('missions'), JSON.stringify(rendus.tuiles));
      verifier('titre de section', rendus.titreSection, 'Mes outils du quart');
      verifierQue('aucune invitation à pointer sur un site sans pointage',
        !/Pointez votre arrivée/.test(journal.textes.conseillerEmployeTexte),
        journal.textes.conseillerEmployeTexte);
    });

  // LA DISTINCTION QUI FAIT TOUT : la garde regarde l'arrivée de la JOURNÉE,
  // la barre de progression compte par SERVICE (correctif du 13/09/2026).
  // Deux quarts le même jour, arrivée pointée sur le premier : la garde
  // laisse passer, donc l'accueil doit proposer les écrans — tout en
  // rappelant de pointer l'arrivée de ce second quart.
  await cas('P5 · second service du jour, arrivée pointée sur le premier',
    enServiceSansArrivee('pompiste', {
      reponses: {
        mission_catalog: { data: catalogue('pompiste'), error: null },
        pointages: {
          data: [{ type: 'arrivee', service_id: 'svc-du-matin' }, { type: 'depart', service_id: 'svc-du-matin' }],
          error: null,
        },
      },
    }),
    ({ rendus, verifier, verifierQue }) => {
      verifier('atteignable : la garde regarde la journée', rendus.ctx.operationnelAtteignable, true);
      verifierQue('tuile Missions rendue', rendus.tuiles.includes('missions'), JSON.stringify(rendus.tuiles));
      // Et pourtant l'arrivée de CE service n'est pas pointée : les deux
      // vérités cohabitent sans se contredire.
      verifier('arrivée du service courant non pointée', rendus.ctx.arriveeFaite, false);
      verifier('la carte rappelle de pointer ce quart', rendus.action.lienTexte, 'Pointer l’arrivée →');
    });

  // Une consultation externe n'est jamais renvoyée au pointage : les deux
  // gardes l'exemptent. Elle n'a pourtant rien d'opérationnel à faire — d'où
  // la tuile de repli SANS prise de poste (déjà mesuré en A3).
  await cas('P6 · consultation externe, service ouvert, arrivée non pointée',
    enServiceSansArrivee('pompiste', { employee: employe({ consultation_externe: true }) }),
    ({ rendus, journal, verifier, verifierQue }) => {
      verifier('exemptée par les deux gardes', rendus.ctx.operationnelAtteignable, true);
      verifierQue('aucune invitation à pointer',
        !/Pointez votre arrivée/.test(journal.textes.conseillerEmployeTexte),
        journal.textes.conseillerEmployeTexte);
    });

  // La règle elle-même, appelée directement. Les six cas ci-dessus l'exercent
  // à travers l'accueil, ce qui est l'essentiel — mais deux de ses états ne
  // sont pas atteignables par cet écran : un `pointageActif` indéterminé
  // (`chargerPointageActif` rend toujours un booléen strict) et « hors
  // service alors que l'arrivée du jour est pointée » (fin de journée). Ces
  // deux-là se mesurent ici, sur la fonction pure.
  {
    const nom = 'P7 · la règle, appelée directement';
    const atteignable = etat => nexusEcranOperationnelAtteignable(etat);
    // Le défaut est « pointage exigé » : une erreur réseau ou une colonne
    // absente ne doit pas faire promettre un écran que la garde refermera.
    verifier(nom, 'pointageActif indéterminé ⇒ arrivée exigée',
      atteignable({ enService: true, arriveePointeeJour: false }), false);
    verifier(nom, 'pointageActif null ⇒ arrivée exigée',
      atteignable({ enService: true, arriveePointeeJour: false, pointageActif: null }), false);
    // La PREMIÈRE porte reste fermée pour elle-même : avoir pointé son
    // arrivée ce matin n'ouvre pas un écran opérationnel le soir, service
    // clos. `nexusPriseDePosteManquante` exige un service, point.
    verifier(nom, 'hors service, même arrivée pointée',
      atteignable({ enService: false, arriveePointeeJour: true, pointageActif: true }), false);
    verifier(nom, 'en service et arrivée pointée',
      atteignable({ enService: true, arriveePointeeJour: true, pointageActif: true }), true);
    verifier(nom, 'manager exempté des deux gardes',
      atteignable({ enService: false, arriveePointeeJour: false, estManager: true }), true);
    verifier(nom, 'consultation externe exemptée des deux gardes',
      atteignable({ enService: false, arriveePointeeJour: false, consultationExterne: true }), true);
    verifier(nom, 'un état vide ne promet rien', atteignable({}), false);
    verifier(nom, 'aucun état ne promet rien', atteignable(undefined), false);
  }

  // =========================================================================
  // D. LE RAPPEL « LES DEUX CHEMINS » — reprendre son poste, changer de rôle
  // =========================================================================
  {
    const html = executerDeuxChemins(employe(), service('caissiere', 'soir'), false);
    verifierQue('D1 · rappel de service', 'rôle lisible', /Caissière/.test(html), html);
    verifierQue('D1 · rappel de service', 'quart rappelé', /soir/.test(html), html);
    verifierQue('D1 · rappel de service', 'lien de reprise présent',
      /NEXUS-Prise-De-Poste-v1\.html/.test(html) && /Changer de rôle/.test(html), html);
    verifierQue('D2 · rappel sans service', 'affichage seul, aucune écriture',
      !/insert/i.test(executerDeuxChemins(employe(), null, false)), 'écriture trouvée');
  }

  // =========================================================================
  // E. GARDES DE DOCTRINE
  // =========================================================================
  verifierQue('E1 · doctrine', 'l’accueil n’écrit jamais sur shifts',
    !/\.insert\(/.test(SRC_INIT) && !/\.upsert\(/.test(SRC_INIT) && !/\.update\(/.test(SRC_INIT),
    'écriture trouvée dans initAccueilEmploye');
  verifierQue('E2 · doctrine', 'aucune redirection d’office depuis l’accueil',
    !/location\.(href|replace)/.test(SRC_INIT), 'redirection trouvée dans initAccueilEmploye');
  verifierQue('E3 · doctrine', 'roleADroitModule laisse passer un rôle inconnu (Article 5)',
    purs.roleADroitModule('fdj', 'archiviste') === true, 'refus par rôle inconnu');
  verifierQue('E4 · doctrine', 'aucun cinquième calcul de quart dans l’accueil (Article 11)',
    !/heure_debut.*getHours|function .*calculerQuart/.test(SRC_INIT), 'calcul de quart trouvé');

  console.log(`${ok} contrôles verts, ${echecs.length} rouges`);
  if (echecs.length) {
    echecs.forEach(e => console.log('  ÉCHEC — ' + e));
    process.exit(1);
  }
})();
